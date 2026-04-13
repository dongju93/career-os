from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException, status

from career_os_api.config import settings
from career_os_api.constants import HTML_PARSER, SARAMIN_USER_AGENT

SARAMIN_DOMAIN = "saramin.co.kr"
SARAMIN_BASE_URL = "https://www.saramin.co.kr"
SARAMIN_JOB_AJAX_URL = f"{SARAMIN_BASE_URL}/zf_user/jobs/relay/view-ajax"

# Whitelist: only these sections constitute the actual job posting.
# Order matters — they are joined in reading flow order.
JOB_POSTING_SECTIONS = [
    ".wrap_jv_header",  # job title, company name, deadline
    ".jv_cont.jv_summary",  # key info: experience, salary, location
    ".jv_cont.jv_detail",  # full job description (iframe inlined)
    ".jv_cont.jv_location",  # work location with address
    ".jv_cont.jv_howto",  # application method and dates
    ".jv_cont.jv_company",  # company profile
]


def is_saramin_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host == SARAMIN_DOMAIN or host.endswith(f".{SARAMIN_DOMAIN}")


async def fetch_saramin_job_posting(url: str) -> bytes:
    """
    Fetch only the current job posting from a Saramin relay/view URL.

    Flow:
    1. Call the internal AJAX endpoint (view-ajax) with rec_idx to get the
       job detail shell — without recommended listings.
    2. The detail section (.jv_cont.jv_detail) contains an <iframe> that
       loads the actual posting content (images, description) from view-detail.
       Fetch that URL and inline its .user_content directly into the soup,
       replacing the iframe element so the images are present in the output.
    3. Extract only the whitelisted job posting sections.
    """
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    rec_idx_list = params.get("rec_idx", [])

    if not rec_idx_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saramin URL is missing rec_idx parameter",
        )

    rec_idx = rec_idx_list[0]

    headers = {
        "User-Agent": SARAMIN_USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": url,
    }

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=settings.http_fetch_timeout, headers=headers
    ) as client:
        try:
            ajax_resp = await client.get(
                SARAMIN_JOB_AJAX_URL,
                params={"rec_idx": rec_idx, "rec_seq": "0"},
            )
            ajax_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Saramin returned {e.response.status_code}",
            ) from e
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach Saramin",
            ) from None

        soup = BeautifulSoup(ajax_resp.content, HTML_PARSER)
        await _inline_iframe_content(client, soup)

    return _extract_posting_sections(soup)


async def _inline_iframe_content(
    client: httpx.AsyncClient, soup: BeautifulSoup
) -> None:
    """Replace the detail iframe with its .user_content, if accessible."""
    iframe = soup.select_one(".jv_cont.jv_detail iframe.iframe_content")
    if not iframe:
        return

    iframe_src = iframe.get("src")
    if not isinstance(iframe_src, str):
        return
    if iframe_src.startswith("/"):
        iframe_src = f"{SARAMIN_BASE_URL}{iframe_src}"

    try:
        detail_resp = await client.get(iframe_src)
        if detail_resp.status_code == 200:
            detail_soup = BeautifulSoup(detail_resp.content, HTML_PARSER)
            user_content = detail_soup.select_one(".user_content")
            if user_content:
                iframe.replace_with(user_content)
    except httpx.RequestError:
        pass  # Leave the iframe in place if the fetch fails


def _extract_posting_sections(soup: BeautifulSoup) -> bytes:
    parts = [str(el) for sel in JOB_POSTING_SECTIONS if (el := soup.select_one(sel))]
    if not parts:
        return str(soup).encode("utf-8")
    return "\n".join(parts).encode("utf-8")
