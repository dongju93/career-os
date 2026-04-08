import base64

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
from career_os_api.service.job_posting.platform import (
    Platform,
    detect_platform,
    extract_posting_id,
)
from career_os_api.service.job_posting.schema import JobPostingExtracted

# Model requested by caller. Verify this ID is available in your OpenAI account.
OPENAI_MODEL = "gpt-5.4-mini"

# Maximum images forwarded per request to stay within token limits.
MAX_IMAGES = 10

EXTRACTION_SYSTEM_PROMPT = (
    "You are a precise job posting data extractor. "
    "Output ONLY information that is explicitly present in the provided content. "
    "Never invent, infer, or hallucinate any field value. "
    "Set any field to null when the value is not explicitly stated."
)


async def _collect_images_as_base64(
    soup: BeautifulSoup,
    domain_base: str,
) -> list[str]:
    """
    Find all <img> elements in the soup, fetch up to MAX_IMAGES of them,
    and return a list of base64-encoded data URLs.

    Images embedded in the job description are commonly used by Korean job
    boards to display formatted text — passing them to the vision model ensures
    that content is not silently dropped.
    """
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
            absolute_srcs.append(src)

    data_urls: list[str] = []
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        for src in absolute_srcs[:MAX_IMAGES]:
            try:
                resp = await client.get(src)
                if resp.status_code == 200:
                    mime = resp.headers.get("content-type", "image/png").split(";")[0]
                    b64 = base64.b64encode(resp.content).decode()
                    data_urls.append(f"data:{mime};base64,{b64}")
            except httpx.RequestError:
                continue  # Skip unreachable images silently

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
        "Extract the job posting fields from the content below.\n\n"
        f"platform: {platform.value}\n"
        f"posting_url: {source_url}\n"
        f"posting_id: {posting_id}\n\n"
        "EXTRACTION RULES:\n"
        "- Return ONLY values that are explicitly written in the content.\n"
        "- Do NOT infer, guess, or fabricate any value.\n"
        "- Set any missing field to null.\n"
        "- Normalize date deadlines to YYYY-MM-DD format when a calendar "
        "date is given; preserve descriptive terms as-is "
        "(e.g. 'Ongoing recruitment', 'Until filled').\n"
        "- tech_stack: list each technology as a separate string "
        "(e.g. ['Python', 'Django', 'PostgreSQL']).\n"
        "- tags: list tag strings exactly as they appear "
        "(e.g. ['#Rapid_Growth']).\n"
        "- If images are attached, read any text visible in them and "
        "include it in the relevant fields.\n\n"
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
    domain_base = f"https://www.{platform.value}.co.kr"

    soup = BeautifulSoup(html_content, "html.parser")
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
        model=OPENAI_MODEL,
        messages=messages,
        response_format=JobPostingExtracted,
        temperature=0,
    )

    message = result.choices[0].message
    if message.refusal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Model refused to process the content: {message.refusal}",
        )

    return message.parsed  # type: ignore[return-value]
