from collections.abc import Awaitable, Callable

from career_os_api._types import AsyncHttpClient
from career_os_api.service.job_posting.platform import Platform, detect_platform
from career_os_api.service.job_posting.saramin import fetch_saramin_job_posting
from career_os_api.service.job_posting.wanted import fetch_wanted_job_posting

_FETCH_DISPATCH: dict[Platform, Callable[[str, AsyncHttpClient], Awaitable[bytes]]] = {
    Platform.saramin: fetch_saramin_job_posting,
    Platform.wanted: fetch_wanted_job_posting,
}


async def fetch_url_content(
    url: str, http_client: AsyncHttpClient
) -> tuple[bytes, str]:
    # detect_platform raises HTTPException 400 for unrecognised hosts, which
    # prevents SSRF against internal services or cloud metadata endpoints.
    platform = detect_platform(url)
    content = await _FETCH_DISPATCH[platform](url, http_client)
    return content, "text/html; charset=utf-8"
