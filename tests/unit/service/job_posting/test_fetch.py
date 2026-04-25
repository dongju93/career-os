from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import HTTPException

from career_os_api.service.job_posting import fetch as fetch_module
from tests.httpx_stubs import SequenceAsyncClient, make_http_status_error, make_response


@pytest.mark.asyncio
async def test_fetch_url_content_delegates_saramin_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fetch_saramin_job_posting = AsyncMock(return_value=b"<html>saramin</html>")

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: True)
    monkeypatch.setattr(
        fetch_module,
        "fetch_saramin_job_posting",
        fetch_saramin_job_posting,
    )

    client = MagicMock()
    content, content_type = await fetch_module.fetch_url_content(
        "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
        client,
    )

    assert content == b"<html>saramin</html>"
    assert content_type == "text/html; charset=utf-8"
    fetch_saramin_job_posting.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_url_content_delegates_wanted_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fetch_wanted_job_posting = AsyncMock(return_value=b"<html>wanted</html>")

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)
    monkeypatch.setattr(fetch_module, "is_wanted_url", lambda url: True)
    monkeypatch.setattr(
        fetch_module,
        "fetch_wanted_job_posting",
        fetch_wanted_job_posting,
    )

    client = MagicMock()
    content, content_type = await fetch_module.fetch_url_content(
        "https://www.wanted.co.kr/wd/349998",
        client,
    )

    assert content == b"<html>wanted</html>"
    assert content_type == "text/html; charset=utf-8"
    fetch_wanted_job_posting.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_url_content_rejects_unsupported_domains_before_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)

    class _NeverCalled:
        async def get(self, *_args, **_kwargs):
            raise AssertionError(
                "http client should not be called for unsupported domains"
            )

        def stream(self, *_args, **_kwargs):
            raise AssertionError(
                "http client should not be called for unsupported domains"
            )

    with pytest.raises(HTTPException) as exc_info:
        await fetch_module.fetch_url_content(
            "https://example.com/jobs/1", _NeverCalled()
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unsupported job board domain: example.com"


@pytest.mark.asyncio
async def test_fetch_url_content_returns_response_body_and_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient(
        [
            make_response(
                "https://example.com/jobs/1",
                content=b"<html>external</html>",
                headers={"content-type": "text/html; charset=utf-8"},
            )
        ]
    )

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)

    content, content_type = await fetch_module.fetch_url_content(
        "https://example.com/jobs/1",
        client,
    )

    assert content == b"<html>external</html>"
    assert content_type == "text/html; charset=utf-8"
    assert client.calls == [("https://example.com/jobs/1", {})]


@pytest.mark.asyncio
async def test_fetch_url_content_maps_invalid_url_to_bad_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient([httpx.InvalidURL("bad url")])

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)

    with pytest.raises(HTTPException) as exc_info:
        await fetch_module.fetch_url_content("bad url", client)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid URL provided"


@pytest.mark.asyncio
async def test_fetch_url_content_maps_upstream_status_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient(
        [make_http_status_error("https://example.com/jobs/1", 404)]
    )

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)

    with pytest.raises(HTTPException) as exc_info:
        await fetch_module.fetch_url_content("https://example.com/jobs/1", client)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Upstream server returned 404"


@pytest.mark.asyncio
async def test_fetch_url_content_maps_request_errors_to_bad_gateway(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient(
        [
            httpx.RequestError(
                "boom",
                request=httpx.Request("GET", "https://example.com/jobs/1"),
            )
        ]
    )

    monkeypatch.setattr(fetch_module, "detect_platform", lambda url: None)
    monkeypatch.setattr(fetch_module, "is_saramin_url", lambda url: False)

    with pytest.raises(HTTPException) as exc_info:
        await fetch_module.fetch_url_content("https://example.com/jobs/1", client)

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to reach the requested URL"
