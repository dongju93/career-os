import base64
from types import SimpleNamespace
from typing import TypedDict, cast
from unittest.mock import AsyncMock

import httpx
import pytest
from bs4 import BeautifulSoup
from fastapi import HTTPException
from openai.types.chat import (
    ChatCompletionContentPartImageParam,
    ChatCompletionContentPartTextParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from career_os_api.config import settings
from career_os_api.service.job_posting import extractor as extractor_module
from career_os_api.service.job_posting.platform import Platform
from career_os_api.service.job_posting.schema import JobPostingExtracted
from tests.support import SequenceAsyncClient, make_response

UserContentPart = (
    ChatCompletionContentPartTextParam | ChatCompletionContentPartImageParam
)


class ParseCallKwargs(TypedDict):
    model: str
    messages: list[ChatCompletionMessageParam]
    response_format: type[JobPostingExtracted]
    temperature: int


def _require_system_text(message: ChatCompletionMessageParam) -> str:
    content = cast(ChatCompletionSystemMessageParam, message)["content"]
    assert isinstance(content, str)
    return content


def _require_user_content(message: ChatCompletionMessageParam) -> list[UserContentPart]:
    content = cast(ChatCompletionUserMessageParam, message)["content"]
    assert isinstance(content, list)
    return cast(list[UserContentPart], content)


def _require_text_part(part: UserContentPart) -> ChatCompletionContentPartTextParam:
    assert part["type"] == "text"
    return cast(ChatCompletionContentPartTextParam, part)


def _require_image_part(part: UserContentPart) -> ChatCompletionContentPartImageParam:
    assert part["type"] == "image_url"
    return cast(ChatCompletionContentPartImageParam, part)


def test_build_messages_includes_required_context_and_images() -> None:
    messages = extractor_module._build_messages(
        text_content="Backend Engineer\nPython",
        platform=Platform.saramin,
        source_url="https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=4930",
        posting_id="4930",
        image_data_urls=[
            "data:image/png;base64,abc",
            "data:image/png;base64,def",
        ],
    )

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "Never invent" in _require_system_text(messages[0])

    content = _require_user_content(messages[1])
    text_part = _require_text_part(content[0])
    assert text_part["type"] == "text"
    assert "platform: saramin" in text_part["text"]
    assert "posting_id: 4930" in text_part["text"]
    assert "Backend Engineer" in text_part["text"]
    assert [_require_image_part(part)["image_url"]["url"] for part in content[1:]] == [
        "data:image/png;base64,abc",
        "data:image/png;base64,def",
    ]


@pytest.mark.asyncio
async def test_collect_images_as_base64_normalizes_sources_and_skips_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Off-domain URL must be silently dropped; saramin subdomains are allowed.
    soup = BeautifulSoup(
        """
        <div>
          <img src="/static/a.png" />
          <img src="//cdn.saramin.co.kr/b.jpg" />
          <img src="https://img.saramin.co.kr/c.gif" />
          <img src="https://example.com/offsite.png" />
          <img src="" />
        </div>
        """,
        "html.parser",
    )
    client = SequenceAsyncClient(
        [
            make_response(
                "https://www.saramin.co.kr/static/a.png",
                content=b"png-bytes",
                headers={"content-type": "image/png"},
            ),
            httpx.RequestError(
                "boom",
                request=httpx.Request("GET", "https://cdn.saramin.co.kr/b.jpg"),
            ),
            make_response(
                "https://img.saramin.co.kr/c.gif",
                content=b"gif-bytes",
                headers={"content-type": "image/gif; charset=binary"},
            ),
        ]
    )

    monkeypatch.setattr(
        extractor_module.httpx,
        "AsyncClient",
        lambda **kwargs: client,
    )

    data_urls = await extractor_module._collect_images_as_base64(
        soup,
        "https://www.saramin.co.kr",
    )

    assert data_urls == [
        f"data:image/png;base64,{base64.b64encode(b'png-bytes').decode()}",
        f"data:image/gif;base64,{base64.b64encode(b'gif-bytes').decode()}",
    ]
    assert len(client.calls) == 3  # offsite.png was never fetched
    assert client.calls[0][0] == "https://www.saramin.co.kr/static/a.png"
    assert client.calls[1][0] == "https://cdn.saramin.co.kr/b.jpg"
    assert client.calls[2][0] == "https://img.saramin.co.kr/c.gif"


class FakeCompletions:
    def __init__(self, response: object) -> None:
        self._response = response
        self.calls: list[ParseCallKwargs] = []

    async def parse(
        self,
        *,
        model: str,
        messages: list[ChatCompletionMessageParam],
        response_format: type[JobPostingExtracted],
        temperature: int,
    ) -> object:
        self.calls.append(
            {
                "model": model,
                "messages": messages,
                "response_format": response_format,
                "temperature": temperature,
            }
        )
        return self._response


class FakeAsyncOpenAI:
    def __init__(self, api_key: str, response: object) -> None:
        self.api_key = api_key
        self.completions = FakeCompletions(response)
        self.chat = SimpleNamespace(completions=self.completions)


@pytest.mark.asyncio
async def test_extract_job_posting_returns_parsed_model(
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting: JobPostingExtracted,
) -> None:
    collect_images = AsyncMock(return_value=["data:image/png;base64,abc"])
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(refusal=None, parsed=sample_job_posting)
            )
        ]
    )
    holder: dict[str, FakeAsyncOpenAI] = {}

    def fake_openai_factory(api_key: str) -> FakeAsyncOpenAI:
        client = FakeAsyncOpenAI(api_key=api_key, response=response)
        holder["client"] = client
        return client

    monkeypatch.setattr(
        extractor_module, "detect_platform", lambda url: Platform.saramin
    )
    monkeypatch.setattr(
        extractor_module,
        "extract_posting_id",
        lambda url, platform: sample_job_posting.posting_id,
    )
    monkeypatch.setattr(
        extractor_module,
        "_collect_images_as_base64",
        collect_images,
    )
    monkeypatch.setattr(extractor_module, "AsyncOpenAI", fake_openai_factory)

    result = await extractor_module.extract_job_posting(
        b"<html><body><h1>Backend Engineer</h1></body></html>",
        sample_job_posting.posting_url,
    )

    assert result.model_dump() == sample_job_posting.model_dump()
    collect_images.assert_awaited_once()
    parse_kwargs = holder["client"].completions.calls[0]
    assert holder["client"].api_key == "test-openai-api-key"
    assert parse_kwargs["model"] == settings.openai_model
    assert parse_kwargs["response_format"] is JobPostingExtracted
    content = _require_user_content(parse_kwargs["messages"][1])
    assert "Backend Engineer" in _require_text_part(content[0])["text"]


@pytest.mark.asyncio
async def test_extract_job_posting_maps_model_refusal_to_http_error(
    monkeypatch: pytest.MonkeyPatch,
    sample_job_posting: JobPostingExtracted,
) -> None:
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(refusal="safety policy", parsed=None)
            )
        ]
    )

    monkeypatch.setattr(
        extractor_module, "detect_platform", lambda url: Platform.saramin
    )
    monkeypatch.setattr(
        extractor_module,
        "extract_posting_id",
        lambda url, platform: sample_job_posting.posting_id,
    )
    monkeypatch.setattr(
        extractor_module,
        "_collect_images_as_base64",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        extractor_module,
        "AsyncOpenAI",
        lambda api_key: FakeAsyncOpenAI(api_key=api_key, response=response),
    )

    with pytest.raises(HTTPException) as exc_info:
        await extractor_module.extract_job_posting(
            b"<html><body><h1>Backend Engineer</h1></body></html>",
            sample_job_posting.posting_url,
        )

    assert exc_info.value.status_code == 422
    assert (
        exc_info.value.detail == "Model refused to process the content: safety policy"
    )
