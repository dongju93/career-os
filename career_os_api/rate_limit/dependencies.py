from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import Depends, HTTPException, Request, Response, status

from career_os_api.auth.dependencies import get_current_user
from career_os_api.rate_limit.limiter import check_quota, check_rate_limit

TimeUnit = Literal["minute", "hour", "day", "month"]

_WINDOW_SECONDS: dict[str, int] = {
    "minute": 60,
    "hour": 3_600,
    "day": 86_400,
    "month": 2_592_000,  # 30-day approx for TTL; bucket label pins exact boundary
}


def _route_key(request: Request) -> str:
    route = request.scope.get("route")
    if route is None:
        return request.url.path
    return route.path


def _bucket_label(per: TimeUnit) -> str:
    now = datetime.now(UTC)
    if per == "minute":
        return now.strftime("%Y-%m-%dT%H:%M")
    if per == "hour":
        return now.strftime("%Y-%m-%dT%H")
    if per == "day":
        return now.strftime("%Y-%m-%d")
    return now.strftime("%Y-%m")


def _bucket_end(per: TimeUnit) -> int:
    now = datetime.now(UTC).replace(microsecond=0)
    if per == "minute":
        end = now.replace(second=0) + timedelta(minutes=1)
    elif per == "hour":
        end = now.replace(minute=0, second=0) + timedelta(hours=1)
    elif per == "day":
        end = now.replace(hour=0, minute=0, second=0) + timedelta(days=1)
    else:
        if now.month == 12:
            end = now.replace(
                year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0
            )
        else:
            end = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0)
    return int(end.timestamp())


def rate_limit(limit: int, *, per: TimeUnit) -> Any:
    """Sliding-window rate limit dependency. Returns Depends for use in dependencies=[...]."""
    window_seconds = _WINDOW_SECONDS[per]

    async def _enforce(
        request: Request,
        response: Response,
        current_user: Annotated[dict, Depends(get_current_user)],  # noqa: B008
    ) -> None:
        redis = getattr(request.app.state, "redis", None)
        if redis is None:
            return

        key = f"rl:{current_user['id']}:{_route_key(request)}"
        result = await check_rate_limit(redis, key, limit, window_seconds)

        response.headers["RateLimit-Limit"] = str(limit)
        response.headers["RateLimit-Remaining"] = str(max(0, limit - result.count))
        response.headers["RateLimit-Reset"] = str(result.reset_at)

        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"요청 한도를 초과했습니다. {result.retry_after}초 후에 다시 시도해주세요.",
                headers={
                    "Retry-After": str(result.retry_after),
                    "RateLimit-Limit": str(limit),
                    "RateLimit-Remaining": "0",
                    "RateLimit-Reset": str(result.reset_at),
                },
            )

    return Depends(_enforce)


def quota(limit: int, *, per: TimeUnit) -> Any:
    """Fixed-window quota dependency. Resets at the next calendar boundary in UTC."""

    async def _enforce(
        request: Request,
        response: Response,
        current_user: Annotated[dict, Depends(get_current_user)],  # noqa: B008
    ) -> None:
        redis = getattr(request.app.state, "redis", None)
        if redis is None:
            return

        bucket = _bucket_label(per)
        key = f"quota:{current_user['id']}:{_route_key(request)}:{bucket}"
        end = _bucket_end(per)
        result = await check_quota(redis, key, limit, end)

        response.headers["X-Quota-Limit"] = str(limit)
        response.headers["X-Quota-Remaining"] = str(max(0, limit - result.count))
        response.headers["X-Quota-Reset"] = str(result.resets_at)

        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"할당량을 초과했습니다. {result.retry_after}초 후 초기화됩니다.",
                headers={
                    "Retry-After": str(result.retry_after),
                    "X-Quota-Limit": str(limit),
                    "X-Quota-Remaining": "0",
                    "X-Quota-Reset": str(result.resets_at),
                },
            )

    return Depends(_enforce)
