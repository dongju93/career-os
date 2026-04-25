import asyncio
import base64
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException, status
from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartTextParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from career_os_api.config import settings
from career_os_api.constants import EXTRACTION_SYSTEM_PROMPT, HTML_PARSER
from career_os_api.schemas import JobPostingExtracted
from career_os_api.service.job_posting.platform import (
    PLATFORM_BASE_URLS,
    Platform,
    detect_platform,
    extract_posting_id,
)

_OPENAI_SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}

_H1_PREFIX = "[채용공고 제목]"
_H2_PREFIX = "[섹션]"

# Maximum number of images fetched concurrently. Keeps peak socket usage bounded
# while still parallelising the bulk of the latency.
_IMAGE_CONCURRENCY = 5


def _annotate_headings(soup: BeautifulSoup) -> None:
    """
    Prefix h1/h2 text with structural markers before plain-text extraction.

    After get_text(), heading context is lost; the model cannot distinguish
    a job title heading from surrounding metadata. Injecting markers into the
    soup (before get_text) surfaces that structure in the text content without
    altering the HTML fed to the image collector (which only reads img.src).
    """
    for h1 in soup.find_all("h1"):
        text = h1.get_text(strip=True)
        if text:
            h1.clear()
            h1.append(f"{_H1_PREFIX} {text}")
    for h2 in soup.find_all("h2"):
        text = h2.get_text(strip=True)
        if text:
            h2.clear()
            h2.append(f"{_H2_PREFIX} {text}")


async def _fetch_one_image(
    client: httpx.AsyncClient,
    src: str,
    sem: asyncio.Semaphore,
) -> tuple[str, bytes] | None:
    """
    Fetch a single image under the semaphore gate.

    Returns (mime, raw_bytes) on success, None on any failure or policy
    rejection. Never raises — callers can unconditionally await and check None.
    """
    async with sem:
        try:
            async with client.stream("GET", src) as resp:
                if resp.status_code != 200:
                    return None
                mime = resp.headers.get("content-type", "").split(";")[0].strip()
                if mime not in _OPENAI_SUPPORTED_IMAGE_TYPES:
                    return None
                # Skip before downloading when Content-Length already exceeds budget.
                content_length = resp.headers.get("content-length")
                if (
                    content_length is not None
                    and int(content_length) > settings.max_image_bytes
                ):
                    return None
                chunks: list[bytes] = []
                raw_size = 0
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    raw_size += len(chunk)
                    if raw_size > settings.max_image_bytes:
                        return None
                    chunks.append(chunk)
                return mime, b"".join(chunks)
        except httpx.RequestError:
            return None


async def _collect_images_as_base64(
    soup: BeautifulSoup,
    domain_base: str,
) -> list[str]:
    """
    Find all <img> elements in the soup, fetch up to MAX_IMAGES of them
    concurrently, and return a list of base64-encoded data URLs.

    Images embedded in the job description are commonly used by Korean job
    boards to display formatted text — passing them to the vision model ensures
    that content is not silently dropped.

    Concurrency is bounded by _IMAGE_CONCURRENCY via asyncio.Semaphore. An
    overall deadline (http_image_total_timeout) is layered on top of the
    per-image httpx timeout so the entire gather cannot block indefinitely.
    """
    # Derive the effective root domain from domain_base (e.g. "www.saramin.co.kr"
    # → "saramin.co.kr") so that CDN subdomains (cdn.*, img.*) are also allowed
    # while completely off-domain URLs from tampered HTML are rejected.
    base_host = urlparse(domain_base).hostname or ""
    effective_domain = base_host[4:] if base_host.startswith("www.") else base_host

    absolute_srcs: list[str] = []
    for img in soup.find_all("img"):
        src = str(img.get("src", "")).strip()
        if not src:
            continue
        if src.startswith("//"):
            src = f"https:{src}"
        elif src.startswith("/"):
            src = f"{domain_base}{src}"
        if src.startswith("http"):
            src_host = urlparse(src).hostname or ""
            if not (
                src_host == effective_domain
                or src_host.endswith(f".{effective_domain}")
            ):
                continue
            absolute_srcs.append(src)

    candidates = absolute_srcs[: settings.max_images]
    if not candidates:
        return []

    sem = asyncio.Semaphore(_IMAGE_CONCURRENCY)
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=settings.http_image_timeout
    ) as client:
        try:
            async with asyncio.timeout(settings.http_image_total_timeout):
                raw_results: list[tuple[str, bytes] | None] = await asyncio.gather(
                    *[_fetch_one_image(client, src, sem) for src in candidates]
                )
        except TimeoutError:
            raw_results = []

    # Apply cumulative byte budget after all fetches complete. Results are
    # ordered identically to candidates so earlier images retain priority.
    data_urls: list[str] = []
    total_b64_bytes = 0
    for result in raw_results:
        if result is None:
            continue
        mime, raw = result
        b64 = base64.b64encode(raw).decode()
        b64_size = len(b64)
        if total_b64_bytes + b64_size > settings.max_total_image_bytes:
            break
        data_urls.append(f"data:{mime};base64,{b64}")
        total_b64_bytes += b64_size

    return data_urls


def _build_messages(
    text_content: str,
    platform: Platform,
    source_url: str,
    posting_id: str,
    image_data_urls: list[str],
) -> list[ChatCompletionMessageParam]:
    """
    Assemble the typed message list: system instructions, then a user message
    containing the extraction prompt, plain text, and any images.
    """
    extraction_prompt = (
        "Extract all job posting fields from the content below.\n\n"
        "=== IDENTITY (already known — echo back exactly) ===\n"
        f"platform: {platform.value}\n"
        f"posting_url: {source_url}\n"
        f"posting_id: {posting_id}\n\n"
        "=== FIELD-BY-FIELD INSTRUCTIONS ===\n"
        "company_name      : Company or organization name. KO: 회사명, 기업명.\n"
        "job_title         : Exact job posting title. "
        "The content has been pre-processed: the h1 heading is marked as '[채용공고 제목] <title text>'. "
        "Extract the text that follows this marker. "
        "If no [채용공고 제목] marker appears, use the most prominent role name at the very top of the content. "
        "Never use the '채용직군' category value (e.g. '개발·데이터') — that is a job category, not the title.\n"
        "experience_req    : Experience requirement as written (e.g. '3년 이상', '신입', '경력 무관', 'Entry level'). null if absent.\n"
        "education_req     : Education requirement as written (e.g. '학력 무관', '대졸 이상', \"Bachelor's required\"). null if absent.\n"
        "employment_type   : Contract type as written (e.g. '정규직', '계약직', '인턴', 'Full-time', 'Contract'). null if absent.\n"
        "location          : Work location. KO: 근무지, 근무위치. null if absent.\n"
        "deadline          : Application deadline.\n"
        "                    - Specific calendar date → normalize to YYYY-MM-DD.\n"
        "                    - Descriptive text → preserve exactly (e.g. '채용 시 마감', 'Until filled').\n"
        "                    - null if absent.\n"
        "salary            : Compensation as written (e.g. '4,000만원 이상', '회사 내규에 따름', 'Negotiable'). null if absent.\n"
        "job_description   : Company / role introduction. KO: 회사 소개, 직무 소개. Copy full text; do NOT summarize.\n"
        "responsibilities  : What the person will do. KO: 담당업무, 주요업무, 업무 내용. Copy all bullet points verbatim.\n"
        "qualifications    : Required qualifications. KO: 자격요건, 지원 자격, 필수 요건. Copy all items verbatim.\n"
        "preferred_points  : Nice-to-have qualifications. KO: 우대사항, 우대 조건. Copy all items verbatim.\n"
        "benefits          : Perks and welfare. KO: 혜택 및 복지, 복리후생. Copy all items verbatim.\n"
        "hiring_process    : Recruitment steps in order. KO: 전형 절차, 채용 프로세스. Copy verbatim.\n"
        "tech_stack        : Every specific technology named for this role.\n"
        "                    - Include: programming languages, frameworks, databases, cloud platforms, tools.\n"
        "                    - Exclude: generic business terms, process methods (e.g. 'Agile', 'OKR').\n"
        "                    - Return as a list of separate strings: ['Python', 'Django', 'PostgreSQL'].\n"
        "                    - null if none are mentioned.\n"
        "tags              : Hashtag-style labels exactly as they appear in the source. KO: 태그. E.g. ['#스타트업', '#원격근무']. null if none.\n"
        "application_method: How to apply as written (e.g. '홈페이지 접수', 'Email application'). null if absent.\n"
        "application_form  : URL or form name for the application. null if absent.\n"
        "contact_person    : Recruiter or contact person name. null if absent.\n"
        "homepage          : Company website URL. null if absent.\n"
        "job_category      : Job category or function as written (e.g. '백엔드 개발', 'Software Engineer'). null if absent.\n"
        "industry          : Company's industry domain as written (e.g. 'IT/인터넷', 'Fintech'). null if absent.\n\n"
        "=== IMAGE RULE ===\n"
        "If images are attached, read every visible character in them and treat that text as part of the content for all fields above.\n\n"
        f"--- CONTENT ---\n{text_content}\n--- END CONTENT ---"
    )

    text_part: ChatCompletionContentPartTextParam = {
        "type": "text",
        "text": extraction_prompt,
    }

    content: list[
        ChatCompletionContentPartTextParam | ChatCompletionContentPartImageParam
    ] = [text_part]

    for data_url in image_data_urls:
        image_part: ChatCompletionContentPartImageParam = {
            "type": "image_url",
            "image_url": {"url": data_url, "detail": "high"},
        }
        content.append(image_part)

    system_message: ChatCompletionSystemMessageParam = {
        "role": "system",
        "content": EXTRACTION_SYSTEM_PROMPT,
    }
    user_message: ChatCompletionUserMessageParam = {
        "role": "user",
        "content": content,
    }

    return [system_message, user_message]


async def extract_job_posting(
    html_content: bytes,
    source_url: str,
) -> JobPostingExtracted:
    """
    Parse a fetched job posting page into structured data.

    Flow:
    1. Classify the source URL by domain to determine the platform.
    2. Strip the HTML to plain text for the primary extraction prompt.
    3. Collect <img> elements, fetch them as base64 so image-embedded text
       (common on Korean job boards) is readable by the vision model.
    4. Call the model with structured output enforced via response_format —
       the response is constrained to the JobPostingExtracted schema.
    5. Return only fields explicitly present in the source; all others are null.

    Raises:
        HTTPException 400 for unsupported domains.
        HTTPException 422 if the model refuses to process the content.
    """
    platform = detect_platform(source_url)
    domain_base = PLATFORM_BASE_URLS[platform]

    soup = BeautifulSoup(html_content, HTML_PARSER)
    _annotate_headings(soup)
    text_content = soup.get_text(separator="\n", strip=True)
    posting_id = extract_posting_id(source_url, platform)
    image_data_urls = await _collect_images_as_base64(soup, domain_base)

    messages = _build_messages(
        text_content=text_content,
        platform=platform,
        source_url=source_url,
        posting_id=posting_id,
        image_data_urls=image_data_urls,
    )

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    result = await client.chat.completions.parse(
        model=settings.openai_model,
        messages=messages,
        response_format=JobPostingExtracted,
        reasoning_effort=settings.openai_reasoning_effort,
    )

    message = result.choices[0].message
    if message.refusal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Model refused to process the content: {message.refusal}",
        )

    return message.parsed  # type: ignore[return-value]
