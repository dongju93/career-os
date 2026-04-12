import httpx
from fastapi import HTTPException, status

from career_os_api.service.job_posting.platform import detect_platform
from career_os_api.service.job_posting.saramin import (
    fetch_saramin_job_posting,
    is_saramin_url,
)


async def fetch_url_content(url: str) -> tuple[bytes, str]:
    # Enforce the domain allowlist before any outbound request is made.
    # detect_platform raises HTTPException 400 for unrecognised hosts, which
    # prevents SSRF against internal services or cloud metadata endpoints.
    detect_platform(url)

    if is_saramin_url(url):
        content = await fetch_saramin_job_posting(url)
        return content, "text/html; charset=utf-8"

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.InvalidURL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid URL provided",
            ) from None
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Upstream server returned {e.response.status_code}",
            ) from e
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to reach the requested URL",
            ) from None

        content_type = response.headers.get("content-type", "text/plain")
        return response.content, content_type
