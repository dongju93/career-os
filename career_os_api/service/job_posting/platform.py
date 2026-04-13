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


PLATFORM_BASE_URLS: dict[Platform, str] = {
    Platform.saramin: "https://www.saramin.co.kr",
    Platform.wanted: "https://www.wanted.co.kr",
}


def validate_posting_id(posting_id: str, platform: Platform) -> str:
    """
    Normalize and validate a platform-native posting identifier.

    All currently supported job boards use numeric identifiers. Reject blank
    or malformed IDs at the schema boundary so storage never collapses
    unrelated postings onto the same `(platform, posting_id)` key.
    """
    normalized = posting_id.strip()
    if not normalized:
        raise ValueError("posting_id must not be empty")
    if not normalized.isdigit():
        raise ValueError(f"{platform.value} posting_id must contain only digits")
    return normalized


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
    """
    Derive the platform-native posting ID from the source URL.

    Raises HTTPException 400 if the URL does not contain a recognisable ID,
    preventing placeholder values from collapsing unrelated records in storage.
    """
    params = parse_qs(urlparse(url).query)
    if platform is Platform.saramin:
        rec_idx = params.get("rec_idx", [None])[0]
        if not rec_idx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract posting ID: 'rec_idx' query parameter is missing",
            )
        try:
            return validate_posting_id(rec_idx, platform)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Saramin URL contains an invalid rec_idx parameter",
            ) from exc
    # Wanted job posting URLs follow the strict pattern /wd/{id}.
    # Validating the /wd/ prefix prevents company pages, event pages, or other
    # Wanted URLs from being stored as job postings.
    path_segments = urlparse(url).path.rstrip("/").split("/")
    # path_segments for /wd/321 → ["", "wd", "321"]
    if len(path_segments) < 3 or path_segments[1] != "wd" or not path_segments[2]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        )
    try:
        return validate_posting_id(path_segments[2], platform)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        ) from exc
