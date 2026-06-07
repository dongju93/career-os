"""Unit tests for career_os_api.chatkit.store.PostgresChatKitStore.

The store is driven against fake psycopg connection/cursor doubles (the same style
as tests/unit/database/test_job_search_groups_db.py) so we assert SQL scoping,
payload round-tripping, pagination, the thread cap, and cross-user isolation without
a live database.
"""

import uuid
from collections.abc import Sequence
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, cast

import pytest
from chatkit.store import NotFoundError
from chatkit.types import (
    ActiveStatus,
    AssistantMessageContent,
    AssistantMessageItem,
    InferenceOptions,
    ThreadMetadata,
    UserMessageItem,
    UserMessageTextContent,
)

from career_os_api.chatkit.context import ChatKitRequestContext
from career_os_api.chatkit.store import ChatKitThreadLimitError, PostgresChatKitStore
from career_os_api.config import settings as app_settings

_NOW = datetime(2026, 6, 5, 12, 0, tzinfo=UTC)


# ── model builders ────────────────────────────────────────────────────────────


def make_thread(
    thread_id: str = "thr_a00001", title: str | None = None
) -> ThreadMetadata:
    return ThreadMetadata(
        id=thread_id, created_at=_NOW, title=title, status=ActiveStatus()
    )


def make_user_message(
    item_id: str = "msg_u00001", thread_id: str = "thr_a00001", text: str = "안녕하세요"
) -> UserMessageItem:
    return UserMessageItem(
        id=item_id,
        thread_id=thread_id,
        created_at=_NOW,
        content=[UserMessageTextContent(text=text)],
        inference_options=InferenceOptions(),
    )


def make_assistant_message(
    item_id: str = "msg_a00001", thread_id: str = "thr_a00001", text: str = "네"
) -> AssistantMessageItem:
    return AssistantMessageItem(
        id=item_id,
        thread_id=thread_id,
        created_at=_NOW,
        content=[AssistantMessageContent(text=text)],
    )


def thread_row(thread: ThreadMetadata) -> dict[str, Any]:
    return {"id": thread.id, "payload": thread.model_dump(mode="json")}


def item_row(item: UserMessageItem | AssistantMessageItem) -> dict[str, Any]:
    return {"id": item.id, "payload": item.model_dump(mode="json")}


# ── fake DB doubles ───────────────────────────────────────────────────────────


class FakeCursor:
    def __init__(
        self,
        *,
        fetchone: Sequence[Any] | None = None,
        fetchall: Sequence[Any] | None = None,
        rowcount: int = 0,
    ) -> None:
        self._fetchone = list(fetchone or [])
        self._fetchall = list(fetchall or [])
        self.rowcount = rowcount
        self.executed: list[tuple[str, Any]] = []

    async def __aenter__(self) -> FakeCursor:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def execute(self, sql: str, params: Any = None) -> None:
        self.executed.append((sql, params))

    async def fetchone(self) -> Any:
        return self._fetchone.pop(0) if self._fetchone else None

    async def fetchall(self) -> Any:
        return self._fetchall.pop(0) if self._fetchall else []


class _NoopTransaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *exc: Any) -> bool:
        return False


class FakeConnection:
    def __init__(self, cursors: Sequence[FakeCursor]) -> None:
        self._cursors = list(cursors)
        self.row_factories: list[Any] = []

    def cursor(self, *, row_factory: Any = None) -> FakeCursor:
        self.row_factories.append(row_factory)
        return self._cursors.pop(0)

    def transaction(self) -> _NoopTransaction:
        return _NoopTransaction()


class FakePool:
    def __init__(self, conn: FakeConnection) -> None:
        self._conn = conn

    @asynccontextmanager
    async def connection(self):  # type: ignore[no-untyped-def]
        yield self._conn


def make_store_and_context(
    cursors: Sequence[FakeCursor], user_id: uuid.UUID | None = None
) -> tuple[PostgresChatKitStore, ChatKitRequestContext, FakeConnection]:
    conn = FakeConnection(cursors)
    pool = FakePool(conn)
    store = PostgresChatKitStore(cast(Any, pool))
    context = ChatKitRequestContext(
        user_id=user_id or uuid.uuid7(), pool=cast(Any, pool)
    )
    return store, context, conn


# ── load_thread ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_thread_returns_validated_thread_scoped_by_user() -> None:
    thread = make_thread(title="이력서 첨삭")
    cursor = FakeCursor(fetchone=[{"payload": thread.model_dump(mode="json")}])
    store, context, _ = make_store_and_context([cursor])

    loaded = await store.load_thread(thread.id, context)

    assert loaded.id == thread.id
    assert loaded.title == "이력서 첨삭"
    sql, params = cursor.executed[0]
    assert "user_id = %s" in sql
    assert params == (thread.id, context.user_id)


@pytest.mark.asyncio
async def test_load_thread_missing_raises_not_found() -> None:
    cursor = FakeCursor(fetchone=[None])
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(NotFoundError):
        await store.load_thread("thr_missing", context)


@pytest.mark.asyncio
async def test_load_thread_foreign_is_indistinguishable_from_missing() -> None:
    # Foreign thread: the WHERE user_id clause filters it out → fetchone None → 404.
    cursor = FakeCursor(fetchone=[None])
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(NotFoundError):
        await store.load_thread("thr_other_users", context)
    sql, params = cursor.executed[0]
    assert "user_id = %s" in sql
    assert context.user_id in params


# ── save_thread (+ cap) ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_save_thread_new_under_cap_inserts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(app_settings, "chatkit_max_threads_per_user", 50)
    thread = make_thread()
    # exists? -> None (new); count -> (0,); insert (no fetch)
    cursor = FakeCursor(fetchone=[None, (0,)])
    store, context, _ = make_store_and_context([cursor])

    await store.save_thread(thread, context)

    insert_sql, insert_params = cursor.executed[-1]
    assert "INSERT INTO chatkit_threads" in insert_sql
    assert context.user_id in insert_params


@pytest.mark.asyncio
async def test_save_thread_new_over_cap_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(app_settings, "chatkit_max_threads_per_user", 1)
    thread = make_thread()
    cursor = FakeCursor(fetchone=[None, (1,)])  # new thread, already at cap
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(ChatKitThreadLimitError):
        await store.save_thread(thread, context)
    # No INSERT should have run after the cap check.
    assert all("INSERT INTO chatkit_threads" not in sql for sql, _ in cursor.executed)


@pytest.mark.asyncio
async def test_save_thread_existing_updates_without_counting() -> None:
    thread = make_thread()
    cursor = FakeCursor(fetchone=[(1,)])  # exists -> not new, skip count
    store, context, _ = make_store_and_context([cursor])

    await store.save_thread(thread, context)

    # exists-check + upsert only; no COUNT(*) query.
    assert all("COUNT(*)" not in sql for sql, _ in cursor.executed)
    assert any(
        "ON CONFLICT (id, user_id) DO UPDATE" in sql for sql, _ in cursor.executed
    )


# ── load_threads (pagination) ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_threads_paginates_and_sets_cursor() -> None:
    threads = [make_thread(f"thr_{i:06d}") for i in range(3)]
    cursor = FakeCursor(fetchall=[[thread_row(t) for t in threads]])
    store, context, _ = make_store_and_context([cursor])

    page = await store.load_threads(limit=2, after=None, order="desc", context=context)

    assert [t.id for t in page.data] == [threads[0].id, threads[1].id]
    assert page.has_more is True
    assert page.after == threads[1].id  # cursor = last returned id
    sql, params = cursor.executed[0]
    assert "user_id = %s" in sql
    assert params[-1] == 3  # LIMIT = limit + 1


@pytest.mark.asyncio
async def test_load_threads_no_more_when_fewer_rows() -> None:
    threads = [make_thread(f"thr_{i:06d}") for i in range(2)]
    cursor = FakeCursor(fetchall=[[thread_row(t) for t in threads]])
    store, context, _ = make_store_and_context([cursor])

    page = await store.load_threads(limit=5, after=None, order="desc", context=context)

    assert len(page.data) == 2
    assert page.has_more is False
    assert page.after is None


# ── load_thread_items ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_thread_items_requires_thread_ownership() -> None:
    ownership = FakeCursor(fetchone=[None])  # thread not owned / missing
    store, context, _ = make_store_and_context([ownership])

    with pytest.raises(NotFoundError):
        await store.load_thread_items(
            "thr_foreign", after=None, limit=20, order="asc", context=context
        )


@pytest.mark.asyncio
async def test_load_thread_items_returns_items() -> None:
    item = make_user_message()
    ownership = FakeCursor(fetchone=[(1,)])
    items_cursor = FakeCursor(fetchall=[[item_row(item)]])
    store, context, conn = make_store_and_context([ownership, items_cursor])

    page = await store.load_thread_items(
        item.thread_id, after=None, limit=20, order="asc", context=context
    )

    assert len(page.data) == 1
    assert isinstance(page.data[0], UserMessageItem)
    assert page.data[0].content[0].text == "안녕하세요"
    # items query scoped by both thread_id and user_id
    items_sql, items_params = items_cursor.executed[0]
    assert "thread_id = %s AND user_id = %s" in items_sql
    assert context.user_id in items_params


# ── add/save item (touches thread updated_at) ─────────────────────────────────


@pytest.mark.asyncio
async def test_add_thread_item_inserts_and_touches_thread() -> None:
    item = make_user_message()
    cursor = FakeCursor()
    store, context, _ = make_store_and_context([cursor])

    await store.add_thread_item(item.thread_id, item, context)

    insert_sql, insert_params = cursor.executed[0]
    update_sql, update_params = cursor.executed[1]
    assert "INSERT INTO chatkit_items" in insert_sql
    assert "ON CONFLICT" not in insert_sql  # plain insert for add
    assert context.user_id in insert_params
    assert "UPDATE chatkit_threads SET updated_at = NOW()" in update_sql
    assert update_params == (item.thread_id, context.user_id)


@pytest.mark.asyncio
async def test_save_item_upserts_and_touches_thread() -> None:
    item = make_assistant_message()
    cursor = FakeCursor()
    store, context, _ = make_store_and_context([cursor])

    await store.save_item(item.thread_id, item, context)

    insert_sql, _ = cursor.executed[0]
    update_sql, _ = cursor.executed[1]
    assert "INSERT INTO chatkit_items" in insert_sql
    assert "ON CONFLICT (id) DO UPDATE" in insert_sql
    assert "UPDATE chatkit_threads" in update_sql


# ── load_item ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_item_returns_item() -> None:
    item = make_user_message()
    cursor = FakeCursor(fetchone=[{"payload": item.model_dump(mode="json")}])
    store, context, _ = make_store_and_context([cursor])

    loaded = await store.load_item(item.thread_id, item.id, context)

    assert loaded.id == item.id
    sql, params = cursor.executed[0]
    assert "id = %s AND thread_id = %s AND user_id = %s" in sql
    assert context.user_id in params


@pytest.mark.asyncio
async def test_load_item_missing_raises_not_found() -> None:
    cursor = FakeCursor(fetchone=[None])
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(NotFoundError):
        await store.load_item("thr_a00001", "msg_missing", context)


# ── delete ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_thread_success() -> None:
    cursor = FakeCursor(rowcount=1)
    store, context, _ = make_store_and_context([cursor])

    await store.delete_thread("thr_a00001", context)

    sql, params = cursor.executed[0]
    assert "DELETE FROM chatkit_threads WHERE id = %s AND user_id = %s" in sql
    assert params == ("thr_a00001", context.user_id)


@pytest.mark.asyncio
async def test_delete_thread_missing_raises_not_found() -> None:
    cursor = FakeCursor(rowcount=0)
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(NotFoundError):
        await store.delete_thread("thr_missing", context)


@pytest.mark.asyncio
async def test_delete_thread_item_missing_raises_not_found() -> None:
    cursor = FakeCursor(rowcount=0)
    store, context, _ = make_store_and_context([cursor])

    with pytest.raises(NotFoundError):
        await store.delete_thread_item("thr_a00001", "msg_missing", context)


# ── attachments unsupported ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_attachments_are_not_implemented() -> None:
    store, context, _ = make_store_and_context([])

    with pytest.raises(NotImplementedError):
        await store.save_attachment(cast(Any, object()), context)
    with pytest.raises(NotImplementedError):
        await store.load_attachment("att_1", context)
    with pytest.raises(NotImplementedError):
        await store.delete_attachment("att_1", context)
