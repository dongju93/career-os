from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from career_os_api.config import settings
from career_os_api.constants import WANTED_USER_AGENT
from career_os_api.service.job_posting.platform import Platform, validate_posting_id

WANTED_DOMAIN = "wanted.co.kr"
WANTED_BASE_URL = "https://www.wanted.co.kr"
WANTED_JOB_API_URL = f"{WANTED_BASE_URL}/api/v4/jobs"

# Ordered mapping of Wanted API detail field keys to human-readable labels.
# Each detail value is an HTML fragment (may contain <img> tags) so it is
# embedded raw to keep images discoverable by the extractor's image collector.
WANTED_DETAIL_FIELDS: list[tuple[str, str]] = [
    ("intro", "Job Introduction"),
    ("main_tasks", "Main Tasks"),
    ("requirements", "Requirements"),
    ("preferred_points", "Preferred Qualifications"),
    ("benefits", "Benefits"),
    ("recruitment_process", "Hiring Process"),
]


def is_wanted_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host == WANTED_DOMAIN or host.endswith(f".{WANTED_DOMAIN}")


async def fetch_wanted_job_posting(url: str) -> bytes:
    """
    Fetch only the current job posting from a Wanted /wd/{id} URL.

    Flow:
    1. Extract the posting ID from the /wd/{id} URL path.
    2. Call the internal REST API (/api/v4/jobs/{id}), which returns a clean
       JSON document — no page navigation, ads, or recommended listings.
    3. Reassemble the JSON fields into a compact HTML document so that
       <img> tags embedded inside the HTML detail fragments remain
       discoverable by the extractor's image collector.
    """
    path_segments = urlparse(url).path.rstrip("/").split("/")
    # path_segments for /wd/349998 → ["", "wd", "349998"]
    if len(path_segments) < 3 or path_segments[1] != "wd" or not path_segments[2]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        )

    try:
        posting_id = validate_posting_id(path_segments[2], Platform.wanted)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        ) from exc

    headers = {
        "User-Agent": WANTED_USER_AGENT,
        "Accept": "application/json",
        "Referer": url,
    }

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=settings.http_fetch_timeout, headers=headers
    ) as client:
        try:
            resp = await client.get(f"{WANTED_JOB_API_URL}/{posting_id}")
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Wanted returned {e.response.status_code}",
            ) from e
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach Wanted",
            ) from None

    return _build_posting_html(resp.json())


def _build_posting_html(data: dict) -> bytes:
    """
    Convert Wanted's JSON API response into a compact HTML document.

    Top-level scalar fields (title, company name, location, etc.) are
    wrapped in plain tags.  Detail sub-fields already contain HTML
    fragments with <img> tags and are embedded raw inside <section>
    elements — BeautifulSoup can then collect those images exactly as it
    does for inlined Saramin iframe content.
    """
    job = data.get("job", {})
    detail = job.get("detail", {})
    company = job.get("company", {})
    address = job.get("address", {})
    exp_level = job.get("experience_level", {})

    parts: list[str] = []

    # --- Header: identity and key facts ---
    if title := (job.get("title") or detail.get("title")):
        parts.append(f"<h1 class='job_title'>{title}</h1>")
    if name := company.get("name"):
        parts.append(f"<p class='company_name'>{name}</p>")
    if industry := company.get("industry_name"):
        parts.append(f"<p class='industry'>{industry}</p>")
    if location := address.get("full_location"):
        parts.append(f"<p class='location'>{location}</p>")
    if exp_name := exp_level.get("name"):
        parts.append(f"<p class='experience_req'>{exp_name}</p>")
    if expire := job.get("expire_time"):
        parts.append(f"<p class='deadline'>{expire}</p>")

    # Salary — both ends are optional; include if at least one is present
    annual_from = job.get("annual_from")
    annual_to = job.get("annual_to")
    if annual_from is not None or annual_to is not None:
        parts.append(f"<p class='salary'>{annual_from} ~ {annual_to}</p>")

    # --- Detail sections (raw HTML fragments preserved) ---
    for field_key, label in WANTED_DETAIL_FIELDS:
        if html_fragment := detail.get(field_key):
            parts.append(
                f"<section class='{field_key}'>"
                f"<h2>{label}</h2>"
                f"{html_fragment}"
                f"</section>"
            )

    # --- Metadata ---
    if tags := job.get("job_hash_tags"):
        tag_labels = [t.get("title", "") for t in tags if t.get("title")]
        if tag_labels:
            parts.append(f"<p class='tags'>{' '.join(tag_labels)}</p>")

    if tech_stacks := job.get("tech_stacks"):
        stack_names = [s.get("title", "") for s in tech_stacks if s.get("title")]
        if stack_names:
            parts.append(f"<p class='tech_stack'>{', '.join(stack_names)}</p>")

    return "\n".join(parts).encode("utf-8")
