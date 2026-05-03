from redis.asyncio import Redis

from career_os_api.config import settings


def create_redis_client() -> Redis | None:
    if not settings.redis_url:  # None or empty string → rate limiting disabled
        return None
    # Redis.from_url() only configures the connection pool — no network I/O
    # occurs here. Connections open lazily on the first awaited command.
    return Redis.from_url(
        settings.redis_url,
        decode_responses=False,  # Lua script returns raw integer arrays
        max_connections=20,
    )
