import logging
import math
import time
import uuid
from dataclasses import dataclass

from redis.asyncio import Redis
from redis.exceptions import RedisError

_logger = logging.getLogger(__name__)

# Atomic sliding-window check implemented as a Lua script so ZREMRANGEBYSCORE,
# ZCARD, and ZADD execute in a single round-trip with no TOCTOU race.
#
# KEYS[1] = rl:{user_id}:{route}
# ARGV[1] = now_ms       — current epoch milliseconds
# ARGV[2] = window_ms    — window length in milliseconds
# ARGV[3] = limit        — max requests allowed in window
# ARGV[4] = ttl_seconds  — EXPIRE duration (window_seconds + 1)
# ARGV[5] = request_uuid — unique hex string; avoids ZADD member collision on
#                          same-millisecond requests (ZADD updates score for
#                          existing member, silently dropping one request)
#
# Returns {count, -1}          on accept (count = requests in window after add)
# Returns {count, oldest_ms}   on reject (count before add; oldest for Retry-After)
_SLIDING_WINDOW_LOG_LUA = """
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local ttl    = tonumber(ARGV[4])
local uid    = ARGV[5]

local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)

if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    return {count, oldest[2] or now}
end

redis.call('ZADD', key, now, uid)
redis.call('EXPIRE', key, ttl)
return {count + 1, -1}
"""


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    count: int
    limit: int
    reset_at: int
    retry_after: int


@dataclass(frozen=True)
class QuotaResult:
    allowed: bool
    count: int
    limit: int
    resets_at: int
    retry_after: int


async def check_rate_limit(
    redis: Redis,
    key: str,
    limit: int,
    window_seconds: int,
) -> RateLimitResult:
    try:
        script = redis.register_script(_SLIDING_WINDOW_LOG_LUA)
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000
        result = await script(
            keys=[key],
            args=[now_ms, window_ms, limit, window_seconds + 1, uuid.uuid7().hex],
        )
        count = int(result[0])
        second = int(result[1])

        if second == -1:
            return RateLimitResult(
                allowed=True,
                count=count,
                limit=limit,
                reset_at=(now_ms + window_ms) // 1000,
                retry_after=0,
            )
        oldest_ms = second
        return RateLimitResult(
            allowed=False,
            count=count,
            limit=limit,
            reset_at=(oldest_ms + window_ms) // 1000,
            retry_after=max(0, math.ceil((oldest_ms + window_ms - now_ms) / 1000)),
        )
    except RedisError:
        _logger.warning("Redis error in check_rate_limit key=%s; failing open", key)
        return RateLimitResult(
            allowed=True,
            count=0,
            limit=limit,
            reset_at=int(time.time()) + window_seconds,
            retry_after=0,
        )


async def check_quota(
    redis: Redis,
    key: str,
    limit: int,
    bucket_end: int,
) -> QuotaResult:
    try:
        count = int(await redis.incr(key))
        ttl = max(1, bucket_end - int(time.time()))
        await redis.expire(key, ttl, nx=True)
        allowed = count <= limit
        return QuotaResult(
            allowed=allowed,
            count=count,
            limit=limit,
            resets_at=bucket_end,
            retry_after=max(0, bucket_end - int(time.time())) if not allowed else 0,
        )
    except RedisError:
        _logger.warning("Redis error in check_quota key=%s; failing open", key)
        return QuotaResult(
            allowed=True,
            count=0,
            limit=limit,
            resets_at=bucket_end,
            retry_after=0,
        )
