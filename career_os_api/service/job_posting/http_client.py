"""Outbound boundary for untrusted posting HTML, iframe and image URLs.

Only HTTPS on the selected platform's domain tree is supported. DNS answers are
checked on every hop and requests connect to a numeric address, retaining the
original Host and TLS identity. No environment proxy may bypass this boundary.
"""

import asyncio
import ipaddress
import re
import socket
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import TracebackType
from typing import Any, Self

import httpx2

from career_os_api.service.job_posting.platform import PLATFORM_REGISTRY

_MAX_REDIRECTS = 5
_DNS_NAME = re.compile(
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*"
)


class UnsafeDestinationError(httpx2.RequestError):
    """A destination is outside the posting fetcher's outbound policy."""


def _platform_domain(request: httpx2.Request) -> str:
    url = request.url
    if (
        request.method != "GET"
        or url.scheme != "https"
        or url.port not in (None, 443)
        or url.userinfo
        or not _DNS_NAME.fullmatch(url.host)
    ):
        raise UnsafeDestinationError("Unsupported posting destination", request=request)
    for adapter in PLATFORM_REGISTRY.values():
        if url.host == adapter.domain or url.host.endswith(f".{adapter.domain}"):
            return adapter.domain
    raise UnsafeDestinationError("Off-platform posting destination", request=request)


def _public_address(value: str) -> str:
    address = ipaddress.ip_address(value)
    if (
        not address.is_global
        or address.is_multicast
        or address.is_reserved
        or address.is_loopback
        or address.is_link_local
        or address.is_unspecified
    ):
        raise ValueError("Non-public destination")
    # Exclude scoped, mapped and transition addresses: a globally classified
    # IPv6 wrapper must not tunnel to a forbidden IPv4 destination.
    if isinstance(address, ipaddress.IPv6Address) and (
        address.scope_id is not None
        or address.ipv4_mapped is not None
        or address.sixtofour is not None
        or address.teredo is not None
        or address not in ipaddress.IPv6Network("2000::/3")
    ):
        raise ValueError("Unsupported IPv6 destination")
    return str(address)


async def _resolve_public_addresses(request: httpx2.Request) -> list[str]:
    try:
        records = await asyncio.get_running_loop().getaddrinfo(
            request.url.host, 443, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP
        )
        addresses = list(dict.fromkeys(_public_address(str(r[4][0])) for r in records))
        if not addresses:
            raise ValueError("Empty DNS answer")
        return addresses
    except (OSError, ValueError) as exc:
        raise UnsafeDestinationError(
            "Posting destination DNS is unavailable or unsafe", request=request
        ) from exc


class _PinnedTransport(httpx2.AsyncBaseTransport):
    def __init__(self) -> None:
        # IPs can be shared by distinct TLS origins. Never reuse a connection
        # authenticated for another hostname after replacing the URL host.
        self._transport = httpx2.AsyncHTTPTransport(
            trust_env=False,
            http2=False,
            limits=httpx2.Limits(max_keepalive_connections=0),
        )

    async def handle_async_request(self, request: httpx2.Request) -> httpx2.Response:
        _platform_domain(request)
        addresses = await _resolve_public_addresses(request)
        headers = request.headers.copy()
        headers["Host"] = request.url.host
        headers["Connection"] = "close"
        # Do not mutate the original URL: the client needs it for redirect
        # resolution and cookie scope. Only timeout extensions cross the boundary.
        for index, address in enumerate(addresses):
            pinned = httpx2.Request(
                "GET",
                request.url.copy_with(host=address),
                headers=headers,
                extensions={
                    "sni_hostname": request.url.host,
                    "timeout": request.extensions.get("timeout", {}),
                },
            )
            try:
                return await self._transport.handle_async_request(pinned)
            except httpx2.ConnectError, httpx2.ConnectTimeout:
                if index == len(addresses) - 1:
                    raise
        raise AssertionError("DNS parser returned no addresses")

    async def aclose(self) -> None:
        await self._transport.aclose()


class JobPostingHttpClient:
    """GET-only client owning redirect validation, deadlines and IP pinning.

    Implements AsyncHttpClient. Required fetches retain their 502 mapping and
    optional iframe/image fetches retain their RequestError skip behavior.
    """

    def __init__(self, *, timeout: float) -> None:
        self._timeout = timeout
        self._client = httpx2.AsyncClient(
            transport=_PinnedTransport(),
            follow_redirects=False,
            trust_env=False,
            timeout=timeout,
        )

    async def __aenter__(self) -> Self:
        await self._client.__aenter__()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self._client.__aexit__(exc_type, exc, tb)

    async def get(self, url: str, **kwargs: Any) -> httpx2.Response:
        async with self.stream("GET", url, **kwargs) as response:
            await response.aread()
            return response

    @asynccontextmanager
    async def stream(
        self, method: str, url: str, **kwargs: Any
    ) -> AsyncIterator[httpx2.Response]:
        request: httpx2.Request | None = None
        response: httpx2.Response | None = None
        try:
            request = self._client.build_request(method, url, **kwargs)
            domain = _platform_domain(request)
            # One deadline covers DNS, all redirects, connection retries and body
            # reads, including slow trickles that evade a per-read timeout.
            async with asyncio.timeout(self._timeout):
                for hop in range(_MAX_REDIRECTS + 1):
                    if _platform_domain(request) != domain:
                        raise UnsafeDestinationError(
                            "Redirect changed posting platform", request=request
                        )
                    response = await self._client.send(
                        request, stream=True, follow_redirects=False
                    )
                    # HTTPX prepares next_request with relative URL resolution
                    # and cookie semantics even when automatic following is off.
                    next_request = response.next_request
                    if next_request is None:
                        yield response
                        return
                    await response.aclose()
                    response = None
                    if hop == _MAX_REDIRECTS:
                        raise httpx2.TooManyRedirects(
                            "Posting redirect limit exceeded", request=request
                        )
                    request = next_request
        except httpx2.InvalidURL as exc:
            raise UnsafeDestinationError(
                "Malformed posting URL", request=request
            ) from exc
        except TimeoutError as exc:
            raise httpx2.TimeoutException(
                "Posting request deadline exceeded", request=request
            ) from exc
        finally:
            if response is not None:
                await response.aclose()
