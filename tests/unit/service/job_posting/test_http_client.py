import asyncio
import socket
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx2
import pytest
from bs4 import BeautifulSoup
from fastapi import HTTPException

from career_os_api.service.job_posting import http_client as module
from career_os_api.service.job_posting.extractor import _collect_images_as_base64
from career_os_api.service.job_posting.saramin import fetch_saramin_job_posting
from career_os_api.service.job_posting.wanted import fetch_wanted_job_posting

URL = "https://www.saramin.co.kr/posting"
PUBLIC_IP = "93.184.216.34"


def dns_records(*addresses: str) -> list:
    return [
        (
            socket.AF_INET6 if ":" in ip else socket.AF_INET,
            socket.SOCK_STREAM,
            socket.IPPROTO_TCP,
            "",
            (ip, 443),
        )
        for ip in addresses
    ]


@pytest.fixture
async def network(monkeypatch):
    resolver = AsyncMock(return_value=dns_records(PUBLIC_IP))
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", resolver)
    sender = AsyncMock(return_value=httpx2.Response(200, content=b"ok"))
    monkeypatch.setattr(httpx2.AsyncHTTPTransport, "handle_async_request", sender)
    return resolver, sender


@pytest.mark.parametrize(
    "destination",
    [
        "http://www.saramin.co.kr/x",
        "https://www.saramin.co.kr:8443/x",
        "https://user:pass@www.saramin.co.kr/x",
        "https://saramin.co.kr.evil.test/x",
        "https://evil.test/x",
        "https://127.0.0.1/x",
        "https://[::1]/x",
        "https://169.254.169.254/latest/meta-data",
        "https://www.saramin.co.kr./x",
    ],
)
async def test_rejects_unsafe_url_before_dns(network, destination):
    resolver, sender = network
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(module.UnsafeDestinationError):
            await client.get(destination)
    resolver.assert_not_called()
    sender.assert_not_called()


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.0.1",
        "169.254.169.254",
        "100.100.100.200",
        "0.0.0.0",
        "224.0.0.1",
        "240.0.0.1",
        "::1",
        "::",
        "fd00::1",
        "fe80::1",
        "ff02::1",
        "::ffff:127.0.0.1",
        "2002:7f00:1::",
        "64:ff9b::a00:1",
        "2001:db8::1",
    ],
)
async def test_rejects_entire_dns_answer_when_one_address_is_unsafe(network, address):
    resolver, sender = network
    resolver.return_value = dns_records(PUBLIC_IP, address)
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(module.UnsafeDestinationError):
            await client.get(URL)
    sender.assert_not_called()


async def test_empty_dns_and_lookup_failure_fail_closed(network):
    resolver, sender = network
    resolver.side_effect = [[], socket.gaierror("unavailable")]
    async with module.JobPostingHttpClient(timeout=1) as client:
        for _ in range(2):
            with pytest.raises(module.UnsafeDestinationError):
                await client.get(URL)
    sender.assert_not_called()


async def test_pins_connection_and_preserves_tls_identity_and_query(network):
    resolver, sender = network
    # If a second hostname lookup occurs it would yield an internal address.
    resolver.side_effect = [dns_records(PUBLIC_IP), dns_records("127.0.0.1")]
    async with module.JobPostingHttpClient(timeout=1) as client:
        response = await client.get(URL, params={"q": "a b"})
    request = sender.call_args.args[0]
    assert request.url.host == PUBLIC_IP
    assert request.url.query == b"q=a+b"
    assert request.headers["host"] == "www.saramin.co.kr"
    assert request.extensions["sni_hostname"] == "www.saramin.co.kr"
    assert request.headers["connection"] == "close"
    assert response.request.url.host == "www.saramin.co.kr"
    resolver.assert_awaited_once()


async def test_ipv6_and_connection_fallback_use_only_validated_addresses(network):
    resolver, sender = network
    resolver.return_value = dns_records("2606:4700:4700::1111", PUBLIC_IP)
    sender.side_effect = [httpx2.ConnectError("unreachable"), httpx2.Response(200)]
    async with module.JobPostingHttpClient(timeout=1) as client:
        assert (await client.get(URL)).status_code == 200
    assert [call.args[0].url.host for call in sender.call_args_list] == [
        "2606:4700:4700::1111",
        PUBLIC_IP,
    ]
    resolver.assert_awaited_once()


class TrackedStream(httpx2.AsyncByteStream):
    def __init__(self, *, slow=False):
        self.closed = False
        self.slow = slow

    async def __aiter__(self) -> AsyncIterator[bytes]:
        if self.slow:
            await asyncio.Event().wait()
        yield b"image"

    async def aclose(self):
        self.closed = True


@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
async def test_redirect_preserves_relative_urls_cookies_and_closes_stream(
    network, status
):
    resolver, sender = network
    body = TrackedStream()
    sender.side_effect = [
        httpx2.Response(
            status,
            headers={"location": "/final", "set-cookie": "a=b; Path=/; Secure"},
            stream=body,
        ),
        httpx2.Response(200, content=b"final"),
    ]
    async with module.JobPostingHttpClient(timeout=1) as client:
        response = await client.get(URL)
    assert response.content == b"final"
    assert body.closed
    assert resolver.await_count == 2
    second = sender.call_args_list[1].args[0]
    assert second.url.path == "/final"
    assert second.headers["cookie"] == "a=b"


@pytest.mark.parametrize(
    "target",
    [
        "https://169.254.169.254/",
        "https://[fd00::1]/",
        "http://www.saramin.co.kr/x",
        "https://evil.test/",
        "https://www.wanted.co.kr/x",
    ],
)
async def test_redirect_never_sends_to_forbidden_destination(network, target):
    resolver, sender = network
    body = TrackedStream()
    sender.return_value = httpx2.Response(
        302, headers={"location": target}, stream=body
    )
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(module.UnsafeDestinationError):
            await client.get(URL)
    assert body.closed
    sender.assert_awaited_once()
    resolver.assert_awaited_once()


async def test_same_host_redirect_rechecks_dns_rebinding(network):
    resolver, sender = network
    resolver.side_effect = [dns_records(PUBLIC_IP), dns_records("10.0.0.1")]
    sender.return_value = httpx2.Response(302, headers={"location": "/next"})
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(module.UnsafeDestinationError):
            await client.get(URL)
    assert resolver.await_count == 2
    sender.assert_awaited_once()


async def test_redirect_loop_is_bounded(network):
    _, sender = network
    bodies = []

    def redirect(request):
        body = TrackedStream()
        bodies.append(body)
        return httpx2.Response(302, headers={"location": "/loop"}, stream=body)

    sender.side_effect = redirect
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(httpx2.TooManyRedirects):
            await client.get(URL)
    assert len(bodies) == 6
    assert all(body.closed for body in bodies)


@pytest.mark.parametrize("phase", ["dns", "headers", "body"])
async def test_total_deadline_cancels_slow_io_and_closes_response(network, phase):
    resolver, sender = network

    async def stall(*args, **kwargs):
        await asyncio.Event().wait()

    body = TrackedStream(slow=True)
    if phase == "dns":
        resolver.side_effect = stall
    elif phase == "headers":
        sender.side_effect = stall
    else:
        sender.return_value = httpx2.Response(200, stream=body)
    async with module.JobPostingHttpClient(timeout=0.02) as client:
        with pytest.raises(httpx2.TimeoutException):
            await client.get(URL)
    if phase == "body":
        assert body.closed


@pytest.mark.parametrize(
    "target,expected",
    [
        ("https://cdn.saramin.co.kr/final.png", True),
        ("https://169.254.169.254/latest", False),
    ],
)
async def test_image_redirect_through_real_collector(network, target, expected):
    _, sender = network
    sender.side_effect = [
        httpx2.Response(302, headers={"location": target}),
        httpx2.Response(200, headers={"content-type": "image/png"}, content=b"png"),
    ]
    soup = BeautifulSoup('<img src="/image.png">', "html.parser")
    async with module.JobPostingHttpClient(timeout=1) as client:
        images = await _collect_images_as_base64(
            soup, "https://www.saramin.co.kr", client
        )
    assert bool(images) is expected
    assert sender.await_count == (2 if expected else 1)


async def test_unsafe_iframe_redirect_is_skipped(network):
    _, sender = network
    sender.side_effect = [
        httpx2.Response(
            200,
            content=b'<div class="jv_cont jv_detail"><iframe class="iframe_content" src="/detail"></iframe></div>',
        ),
        httpx2.Response(302, headers={"location": "https://127.0.0.1/"}),
    ]
    async with module.JobPostingHttpClient(timeout=1) as client:
        html = await fetch_saramin_job_posting(URL + "?rec_idx=1", client)
    assert b"iframe" in html
    assert sender.await_count == 2


@pytest.mark.parametrize(
    "fetcher,url",
    [
        (fetch_saramin_job_posting, URL + "?rec_idx=1"),
        (fetch_wanted_job_posting, "https://www.wanted.co.kr/wd/1"),
    ],
)
async def test_required_fetch_maps_unsafe_redirect_to_502(network, fetcher, url):
    _, sender = network
    sender.return_value = httpx2.Response(
        302, headers={"location": "https://127.0.0.1/"}
    )
    async with module.JobPostingHttpClient(timeout=1) as client:
        with pytest.raises(HTTPException) as exc:
            await fetcher(url, client)
    assert exc.value.status_code == 502
    sender.assert_awaited_once()


async def test_environment_proxy_cannot_bypass_guard(network, monkeypatch):
    _, sender = network
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("ALL_PROXY", "http://127.0.0.1:1")
    async with module.JobPostingHttpClient(timeout=1) as client:
        assert (await client.get(URL)).content == b"ok"
    sender.assert_awaited_once()


async def test_socket_boundary_receives_pinned_ip_and_separate_verified_tls(
    monkeypatch,
):
    import ssl

    from httpcore2 import AsyncNetworkStream
    from httpcore2._backends.auto import AutoBackend

    tls_hosts = []
    streams = []

    class WireStream(AsyncNetworkStream):
        def __init__(self):
            self.closed = False
            self.writes = []

        async def read(self, max_bytes, timeout=None):
            return b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"

        async def write(self, buffer, timeout=None):
            self.writes.append(buffer)

        async def start_tls(self, ssl_context, server_hostname=None, timeout=None):
            assert ssl_context.check_hostname
            assert ssl_context.verify_mode == ssl.CERT_REQUIRED
            tls_hosts.append(server_hostname)
            return self

        async def aclose(self):
            self.closed = True

    async def connect(**kwargs):
        assert kwargs["host"] == PUBLIC_IP
        assert kwargs["port"] == 443
        stream = WireStream()
        streams.append(stream)
        return stream

    resolver = AsyncMock(return_value=dns_records(PUBLIC_IP))
    monkeypatch.setattr(asyncio.get_running_loop(), "getaddrinfo", resolver)
    connector = AsyncMock(side_effect=connect)
    monkeypatch.setattr(AutoBackend, "connect_tcp", connector)
    async with module.JobPostingHttpClient(timeout=1) as client:
        for host in ("www.saramin.co.kr", "cdn.saramin.co.kr"):
            response = await client.get(f"https://{host}/test")
            assert response.content == b"ok"
    assert tls_hosts == ["www.saramin.co.kr", "cdn.saramin.co.kr"]
    assert connector.await_count == resolver.await_count == 2
    assert all(stream.closed for stream in streams)
    assert b"Host: www.saramin.co.kr" in b"".join(streams[0].writes)
    assert b"Host: cdn.saramin.co.kr" in b"".join(streams[1].writes)


async def test_cancellation_propagates_and_closes_body(network):
    _, sender = network
    started = asyncio.Event()
    body = TrackedStream()

    class WaitingStream(TrackedStream):
        async def __aiter__(self):
            started.set()
            await asyncio.Event().wait()
            yield b"unused"

    body = WaitingStream()
    sender.return_value = httpx2.Response(200, stream=body)
    async with module.JobPostingHttpClient(timeout=1) as client:
        task = asyncio.create_task(client.get(URL))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    assert body.closed


async def test_lifespan_wires_both_fetch_clients_to_security_boundary(
    network, monkeypatch
):
    from unittest.mock import MagicMock

    import main

    monkeypatch.setattr(main, "create_postgres_pool", lambda: AsyncMock())
    monkeypatch.setattr(main, "init_schema", AsyncMock())
    monkeypatch.setattr(main, "create_redis_client", lambda: None)
    monkeypatch.setattr(main, "AsyncOpenAI", lambda **kwargs: AsyncMock())
    monkeypatch.setattr(main, "set_default_openai_client", MagicMock())
    monkeypatch.setattr(main, "set_tracing_disabled", MagicMock())
    monkeypatch.setattr(main, "PostgresChatKitStore", MagicMock())
    monkeypatch.setattr(main, "CareerOsChatKitServer", MagicMock())
    app = main.FastAPI()
    async with main.lifespan(app):
        for client in (app.state.http_client, app.state.image_http_client):
            with pytest.raises(module.UnsafeDestinationError):
                await client.get("https://127.0.0.1/")
    resolver, sender = network
    resolver.assert_not_called()
    sender.assert_not_called()
