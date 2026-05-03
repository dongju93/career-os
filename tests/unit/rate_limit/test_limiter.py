import time

import fakeredis
import pytest_asyncio
from redis.exceptions import RedisError

from career_os_api.rate_limit.limiter import check_quota, check_rate_limit


@pytest_asyncio.fixture
async def fake_redis():
    async with fakeredis.FakeAsyncRedis(decode_responses=False) as client:
        yield client


# ── check_rate_limit ──────────────────────────────────────────────────────────


async def test_rate_limit_first_request_allowed(fake_redis):
    result = await check_rate_limit(
        fake_redis, "rl:user1:/v1/test", limit=5, window_seconds=60
    )
    assert result.allowed is True
    assert result.count == 1
    assert result.limit == 5
    assert result.retry_after == 0


async def test_rate_limit_up_to_limit_all_allowed(fake_redis):
    key = "rl:user2:/v1/test"
    for i in range(1, 4):
        result = await check_rate_limit(fake_redis, key, limit=3, window_seconds=60)
        assert result.allowed is True
        assert result.count == i


async def test_rate_limit_exceeding_limit_rejected(fake_redis):
    key = "rl:user3:/v1/test"
    for _ in range(3):
        await check_rate_limit(fake_redis, key, limit=3, window_seconds=60)

    result = await check_rate_limit(fake_redis, key, limit=3, window_seconds=60)
    assert result.allowed is False
    assert result.count == 3
    assert result.retry_after > 0
    assert result.retry_after <= 60


async def test_rate_limit_reset_after_window_clears(fake_redis):
    key = "rl:user4:/v1/test"
    for _ in range(2):
        await check_rate_limit(fake_redis, key, limit=2, window_seconds=60)

    # Simulate the window expiring by removing the key
    await fake_redis.delete(key)

    result = await check_rate_limit(fake_redis, key, limit=2, window_seconds=60)
    assert result.allowed is True
    assert result.count == 1


async def test_rate_limit_headers_populated(fake_redis):
    result = await check_rate_limit(
        fake_redis, "rl:user5:/v1/test", limit=10, window_seconds=60
    )
    assert result.reset_at > int(time.time())
    assert result.limit == 10


async def test_rate_limit_redis_error_fails_open():
    class _BrokenRedis:
        def register_script(self, _script):
            async def _call(*args, **kwargs):
                raise RedisError("connection refused")

            return _call

    result = await check_rate_limit(
        _BrokenRedis(),  # type: ignore[bad-argument-type]
        "rl:user6:/v1/test",
        limit=5,
        window_seconds=60,
    )
    assert result.allowed is True
    assert result.retry_after == 0


# ── check_quota ───────────────────────────────────────────────────────────────


async def test_quota_first_request_allowed(fake_redis):
    bucket_end = int(time.time()) + 86400
    result = await check_quota(
        fake_redis, "quota:user1:/v1/test:2026-05-03", limit=10, bucket_end=bucket_end
    )
    assert result.allowed is True
    assert result.count == 1
    assert result.retry_after == 0


async def test_quota_up_to_limit_all_allowed(fake_redis):
    bucket_end = int(time.time()) + 86400
    key = "quota:user2:/v1/test:2026-05-03"
    for i in range(1, 4):
        result = await check_quota(fake_redis, key, limit=3, bucket_end=bucket_end)
        assert result.allowed is True
        assert result.count == i


async def test_quota_exceeding_limit_rejected(fake_redis):
    bucket_end = int(time.time()) + 86400
    key = "quota:user3:/v1/test:2026-05-03"
    for _ in range(5):
        await check_quota(fake_redis, key, limit=5, bucket_end=bucket_end)

    result = await check_quota(fake_redis, key, limit=5, bucket_end=bucket_end)
    assert result.allowed is False
    assert result.count == 6
    assert result.retry_after > 0
    assert result.resets_at == bucket_end


async def test_quota_new_bucket_starts_fresh(fake_redis):
    bucket_end = int(time.time()) + 86400
    key_old = "quota:user4:/v1/test:2026-05-02"
    for _ in range(5):
        await check_quota(fake_redis, key_old, limit=5, bucket_end=bucket_end)

    key_new = "quota:user4:/v1/test:2026-05-03"
    result = await check_quota(fake_redis, key_new, limit=5, bucket_end=bucket_end)
    assert result.allowed is True
    assert result.count == 1


async def test_quota_redis_error_fails_open():
    class _BrokenRedis:
        async def incr(self, _key):
            raise RedisError("connection refused")

        async def expire(self, *args, **kwargs):
            raise RedisError("connection refused")

    bucket_end = int(time.time()) + 86400
    result = await check_quota(
        _BrokenRedis(),  # type: ignore[bad-argument-type]
        "quota:user5:/v1/test:2026-05-03",
        limit=10,
        bucket_end=bucket_end,
    )
    assert result.allowed is True
    assert result.retry_after == 0
