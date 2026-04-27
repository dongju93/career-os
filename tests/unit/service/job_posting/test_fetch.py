from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from career_os_api.service.job_posting import fetch as fetch_module
from career_os_api.service.job_posting.platform import Platform


@pytest.mark.asyncio
async def test_fetch_url_content_delegates_saramin_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_fetch = AsyncMock(return_value=b"<html>saramin</html>")
    monkeypatch.setitem(fetch_module._FETCH_DISPATCH, Platform.saramin, mock_fetch)

    content, content_type = await fetch_module.fetch_url_content(
        "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
        AsyncMock(),
    )

    assert content == b"<html>saramin</html>"
    assert content_type == "text/html; charset=utf-8"
    mock_fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_url_content_delegates_wanted_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_fetch = AsyncMock(return_value=b"<html>wanted</html>")
    monkeypatch.setitem(fetch_module._FETCH_DISPATCH, Platform.wanted, mock_fetch)

    content, content_type = await fetch_module.fetch_url_content(
        "https://www.wanted.co.kr/wd/349998",
        AsyncMock(),
    )

    assert content == b"<html>wanted</html>"
    assert content_type == "text/html; charset=utf-8"
    mock_fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_url_content_rejects_unsupported_domains_before_request() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await fetch_module.fetch_url_content("https://example.com/jobs/1", AsyncMock())

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported job board domain: example.com"
