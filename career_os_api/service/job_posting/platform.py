from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException, status


class Platform(StrEnum):
    saramin = "saramin"
    wanted = "wanted"


@dataclass(frozen=True)
class PlatformAdapter:
    """Bundles all platform-specific metadata and URL logic in one place.

    Adding a new platform requires one entry here, one new fetcher module,
    one entry in fetch._FETCH_DISPATCH, and one DDL migration for the CHECK
    constraint.
    """

    domain: str
    base_url: str
    extract_id: Callable[[str], str]  # raises HTTPException 400 on failure


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


def _extract_saramin_id(url: str) -> str:
    params = parse_qs(urlparse(url).query)
    rec_idx = params.get("rec_idx", [None])[0]
    if not rec_idx:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract posting ID: 'rec_idx' query parameter is missing",
        )
    try:
        return validate_posting_id(rec_idx, Platform.saramin)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saramin URL contains an invalid rec_idx parameter",
        ) from exc


def _extract_wanted_id(url: str) -> str:
    path_segments = urlparse(url).path.rstrip("/").split("/")
    # path_segments for /wd/321 → ["", "wd", "321"]
    if len(path_segments) < 3 or path_segments[1] != "wd" or not path_segments[2]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        )
    try:
        return validate_posting_id(path_segments[2], Platform.wanted)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wanted posting URL must follow the /wd/{id} path pattern",
        ) from exc


PLATFORM_REGISTRY: dict[Platform, PlatformAdapter] = {
    Platform.saramin: PlatformAdapter(
        domain="saramin.co.kr",
        base_url="https://www.saramin.co.kr",
        extract_id=_extract_saramin_id,
    ),
    Platform.wanted: PlatformAdapter(
        domain="wanted.co.kr",
        base_url="https://www.wanted.co.kr",
        extract_id=_extract_wanted_id,
    ),
}

# Computed from the registry so consumers that reference this dict directly
# stay correct without changes when platforms are added.
PLATFORM_BASE_URLS: dict[Platform, str] = {
    p: a.base_url for p, a in PLATFORM_REGISTRY.items()
}


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
    # by checking whether the host ends with any registered domain.
    for platform, adapter in PLATFORM_REGISTRY.items():
        domain = adapter.domain
        if host == domain or host.endswith(f".{domain}"):
            return platform

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
    return PLATFORM_REGISTRY[platform].extract_id(url)
