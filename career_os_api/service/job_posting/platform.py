from enum import StrEnum
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException, status

# Maps known job board domains to their platform identifier.
_DOMAIN_MAP: dict[str, str] = {
    "saramin.co.kr": "saramin",
    "wanted.co.kr": "wanted",
}


class Platform(StrEnum):
    saramin = "saramin"
    wanted = "wanted"


def detect_platform(url: str) -> Platform:
    """
    Validate the URL and classify it by domain.

    Raises HTTPException 400 for malformed URLs or unsupported domains.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""

    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL: could not parse hostname",
        )

    # Strip subdomains (e.g. www.saramin.co.kr → saramin.co.kr)
    # by checking whether the host ends with any known domain.
    for domain, platform_value in _DOMAIN_MAP.items():
        if host == domain or host.endswith(f".{domain}"):
            return Platform(platform_value)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported job board domain: {host}",
    )


def extract_posting_id(url: str, platform: Platform) -> str:
    """Derive the platform-native posting ID from the source URL."""
    params = parse_qs(urlparse(url).query)
    if platform is Platform.saramin:
        return params.get("rec_idx", ["unknown"])[0]
    # Wanted URLs follow the pattern /wd/:id
    path_parts = urlparse(url).path.rstrip("/").split("/")
    return path_parts[-1] if path_parts else "unknown"
