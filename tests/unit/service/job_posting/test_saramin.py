import httpx
import pytest
from fastapi import HTTPException

from career_os_api.service.job_posting import saramin as saramin_module
from tests.httpx_stubs import SequenceAsyncClient, make_http_status_error, make_response


@pytest.mark.asyncio
async def test_fetch_saramin_job_posting_extracts_only_job_posting_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ajax_html = b"""
    <html>
      <body>
        <div class="wrap_jv_header">Career OS header</div>
        <div class="jv_cont jv_summary">3 years, Seoul</div>
        <div class="jv_cont jv_detail">
          <iframe class="iframe_content" src="/zf_user/jobs/view-detail?rec_idx=4930"></iframe>
        </div>
        <div class="jv_cont jv_howto">Apply online</div>
        <div class="recommended_jobs">Do not include me</div>
      </body>
    </html>
    """
    detail_html = b"""
    <html>
      <body>
        <div class="user_content">
          <p>Detailed job description</p>
          <img src="https://static.example.com/posting.png" />
        </div>
      </body>
    </html>
    """
    client = SequenceAsyncClient(
        [
            make_response(
                saramin_module.SARAMIN_JOB_AJAX_URL,
                content=ajax_html,
                headers={"content-type": "text/html; charset=utf-8"},
            ),
            make_response(
                "https://www.saramin.co.kr/zf_user/jobs/view-detail?rec_idx=4930",
                content=detail_html,
                headers={"content-type": "text/html; charset=utf-8"},
            ),
        ]
    )

    monkeypatch.setattr(
        saramin_module.httpx,
        "AsyncClient",
        lambda **kwargs: client,
    )

    content = await saramin_module.fetch_saramin_job_posting(
        "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930"
    )
    html = content.decode("utf-8")

    assert "Career OS header" in html
    assert "3 years, Seoul" in html
    assert "Detailed job description" in html
    assert "Apply online" in html
    assert "Do not include me" not in html
    assert client.calls[0] == (
        saramin_module.SARAMIN_JOB_AJAX_URL,
        {"params": {"rec_idx": "4930", "rec_seq": "0"}},
    )
    assert client.calls[1][0] == (
        "https://www.saramin.co.kr/zf_user/jobs/view-detail?rec_idx=4930"
    )


@pytest.mark.asyncio
async def test_fetch_saramin_job_posting_requires_rec_idx() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await saramin_module.fetch_saramin_job_posting(
            "https://www.saramin.co.kr/zf_user/jobs/relay/view"
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Saramin URL is missing rec_idx parameter"


@pytest.mark.asyncio
async def test_fetch_saramin_job_posting_maps_upstream_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient(
        [make_http_status_error(saramin_module.SARAMIN_JOB_AJAX_URL, 503)]
    )

    monkeypatch.setattr(
        saramin_module.httpx,
        "AsyncClient",
        lambda **kwargs: client,
    )

    with pytest.raises(HTTPException) as exc_info:
        await saramin_module.fetch_saramin_job_posting(
            "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930"
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Saramin returned 503"


@pytest.mark.asyncio
async def test_fetch_saramin_job_posting_maps_request_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = SequenceAsyncClient(
        [
            httpx.RequestError(
                "boom",
                request=httpx.Request("GET", saramin_module.SARAMIN_JOB_AJAX_URL),
            )
        ]
    )

    monkeypatch.setattr(
        saramin_module.httpx,
        "AsyncClient",
        lambda **kwargs: client,
    )

    with pytest.raises(HTTPException) as exc_info:
        await saramin_module.fetch_saramin_job_posting(
            "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930"
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to reach Saramin"
