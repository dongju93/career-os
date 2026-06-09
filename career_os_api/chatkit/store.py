"""PostgreSQL-backed ChatKit `Store`.

Every method is scoped to `context.user_id`, so a thread or item that belongs to
another user — or does not exist — is indistinguishable and surfaces as the SDK's
`NotFoundError`. Thread/item models are stored verbatim as JSONB (`payload`) so
SDK schema changes do not break persistence; a few columns (`title`, `status`,
`created_at`, `updated_at`, `item_type`) are denormalized for ordering/observability.

All DB access goes through `run_database_operation()` for the project's standard
retry / `DatabaseUnavailableError` handling.
"""

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from chatkit.store import NotFoundError, Store
from chatkit.types import Page, ThreadItem, ThreadMetadata
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import TypeAdapter

from career_os_api.chatkit.context import ChatKitRequestContext
from career_os_api.config import settings
from career_os_api.database.retry import run_database_operation

_logger = logging.getLogger(__name__)

# ThreadItem is a discriminated union, so it has no `.model_validate`; a TypeAdapter
# reconstructs the correct concrete subtype from a stored payload dict.
_ITEM_ADAPTER: TypeAdapter[ThreadItem] = TypeAdapter(ThreadItem)


class ChatKitThreadLimitError(Exception):
    """Raised when a user would exceed `chatkit_max_threads_per_user`."""


def _dumps(payload: dict[str, Any]) -> str:
    # ensure_ascii=False keeps Korean text compact in JSONB storage.
    return json.dumps(payload, ensure_ascii=False)


def _status_label(thread: ThreadMetadata) -> str | None:
    status = getattr(thread, "status", None)
    return getattr(status, "type", None)


async def _keyset_select(
    conn: AsyncConnection,
    *,
    table: str,
    sort_col: str,
    owner_clause: str,
    owner_params: tuple[Any, ...],
    after: str | None,
    limit: int,
    order: str,
) -> tuple[list[dict[str, Any]], bool]:
    """Keyset-paginate `table` by `(sort_col, id)`, scoped by `owner_clause`.

    Returns `(rows, has_more)` where each row has `id` and `payload`. `table`,
    `sort_col` and `owner_clause` are trusted internal constants; all user values
    are bound as parameters.
    """
    descending = order == "desc"
    direction = "DESC" if descending else "ASC"
    comparison = "<" if descending else ">"

    async with conn.cursor(row_factory=dict_row) as cur:
        cursor_value: Any = None
        if after is not None:
            lookup_sql = (
                f"SELECT {sort_col} AS sort_value FROM {table} "
                f"WHERE id = %s AND {owner_clause}"
            )
            await cur.execute(lookup_sql, (after, *owner_params))  # type: ignore[arg-type]
            cursor_row = await cur.fetchone()
            if cursor_row is None:
                # Stale/foreign cursor — nothing to return.
                return [], False
            cursor_value = cursor_row["sort_value"]

        sql = f"SELECT id, payload FROM {table} WHERE {owner_clause}"
        params: list[Any] = list(owner_params)
        if after is not None:
            sql += f" AND ({sort_col}, id) {comparison} (%s, %s)"
            params.extend((cursor_value, after))
        sql += f" ORDER BY {sort_col} {direction}, id {direction} LIMIT %s"
        params.append(limit + 1)

        await cur.execute(sql, tuple(params))  # type: ignore[arg-type]
        rows = await cur.fetchall()

    has_more = len(rows) > limit
    return rows[:limit], has_more


class PostgresChatKitStore(Store[ChatKitRequestContext]):
    def __init__(self, pool: AsyncConnectionPool) -> None:
        # Kept for symmetry with other app stores; each method reads context.pool so
        # the same instance works across requests/connections.
        self._pool = pool

    async def _run[T](
        self,
        context: ChatKitRequestContext,
        operation: Callable[[AsyncConnection], Awaitable[T]],
        *,
        idempotent: bool = True,
        label: str,
    ) -> T:
        return await run_database_operation(
            context.pool, operation, idempotent=idempotent, label=label
        )

    # ── threads ──────────────────────────────────────────────────────────────

    async def load_thread(
        self, thread_id: str, context: ChatKitRequestContext
    ) -> ThreadMetadata:
        async def operation(conn: AsyncConnection) -> ThreadMetadata:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT payload FROM chatkit_threads "
                    "WHERE id = %s AND user_id = %s",
                    (thread_id, context.user_id),
                )
                row = await cur.fetchone()
            if row is None:
                raise NotFoundError(f"Thread {thread_id} not found")
            return ThreadMetadata.model_validate(row["payload"])

        return await self._run(context, operation, label="chatkit.load_thread")

    async def save_thread(
        self, thread: ThreadMetadata, context: ChatKitRequestContext
    ) -> None:
        user_id = context.user_id
        payload = _dumps(thread.model_dump(mode="json"))
        status = _status_label(thread)
        max_threads = settings.chatkit_max_threads_per_user

        async def operation(conn: AsyncConnection) -> None:
            async with conn.transaction(), conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM chatkit_threads WHERE id = %s AND user_id = %s",
                    (thread.id, user_id),
                )
                is_new = await cur.fetchone() is None
                if is_new:
                    # Serialize concurrent cap checks for this user so two simultaneous
                    # new-thread saves can't both observe count < max_threads and
                    # together exceed the cap (TOCTOU between COUNT and INSERT below).
                    # pg_advisory_xact_lock auto-releases at transaction end.
                    await cur.execute(
                        "SELECT pg_advisory_xact_lock(hashtext(%s::text))",
                        (str(user_id),),
                    )
                    await cur.execute(
                        "SELECT COUNT(*) FROM chatkit_threads WHERE user_id = %s",
                        (user_id,),
                    )
                    count_row = await cur.fetchone()
                    count = count_row[0] if count_row else 0
                    if count >= max_threads:
                        raise ChatKitThreadLimitError(
                            f"thread limit {max_threads} reached"
                        )
                await cur.execute(
                    """
                    -- Conflict target matches the (id, user_id) unique constraint, not
                    -- the bare `id` PK: a same-id row owned by another user must raise
                    -- a UniqueViolation here rather than silently being overwritten.
                    INSERT INTO chatkit_threads
                        (id, user_id, title, status, payload, created_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (id, user_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        status = EXCLUDED.status,
                        payload = EXCLUDED.payload,
                        updated_at = NOW()
                    """,
                    (
                        thread.id,
                        user_id,
                        thread.title,
                        status,
                        payload,
                        thread.created_at,
                    ),
                )

        # Non-idempotent: the cap guard makes the write conditional.
        await self._run(
            context, operation, idempotent=False, label="chatkit.save_thread"
        )

    async def load_threads(
        self,
        limit: int,
        after: str | None,
        order: str,
        context: ChatKitRequestContext,
    ) -> Page[ThreadMetadata]:
        async def operation(conn: AsyncConnection) -> tuple[list[dict[str, Any]], bool]:
            return await _keyset_select(
                conn,
                table="chatkit_threads",
                sort_col="updated_at",
                owner_clause="user_id = %s",
                owner_params=(context.user_id,),
                after=after,
                limit=limit,
                order=order,
            )

        rows, has_more = await self._run(
            context, operation, label="chatkit.load_threads"
        )
        data = [ThreadMetadata.model_validate(row["payload"]) for row in rows]
        next_after = rows[-1]["id"] if has_more and rows else None
        return Page(data=data, has_more=has_more, after=next_after)

    async def delete_thread(
        self, thread_id: str, context: ChatKitRequestContext
    ) -> None:
        async def operation(conn: AsyncConnection) -> int:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM chatkit_threads WHERE id = %s AND user_id = %s",
                    (thread_id, context.user_id),
                )
                return cur.rowcount

        deleted = await self._run(
            context, operation, idempotent=False, label="chatkit.delete_thread"
        )
        if deleted == 0:
            raise NotFoundError(f"Thread {thread_id} not found")

    # ── items ────────────────────────────────────────────────────────────────

    async def load_thread_items(
        self,
        thread_id: str,
        after: str | None,
        limit: int,
        order: str,
        context: ChatKitRequestContext,
    ) -> Page[ThreadItem]:
        async def operation(conn: AsyncConnection) -> tuple[list[dict[str, Any]], bool]:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM chatkit_threads WHERE id = %s AND user_id = %s",
                    (thread_id, context.user_id),
                )
                if await cur.fetchone() is None:
                    raise NotFoundError(f"Thread {thread_id} not found")
            return await _keyset_select(
                conn,
                table="chatkit_items",
                sort_col="created_at",
                owner_clause="thread_id = %s AND user_id = %s",
                owner_params=(thread_id, context.user_id),
                after=after,
                limit=limit,
                order=order,
            )

        rows, has_more = await self._run(
            context, operation, label="chatkit.load_thread_items"
        )
        data = [_ITEM_ADAPTER.validate_python(row["payload"]) for row in rows]
        next_after = rows[-1]["id"] if has_more and rows else None
        return Page(data=data, has_more=has_more, after=next_after)

    async def add_thread_item(
        self, thread_id: str, item: ThreadItem, context: ChatKitRequestContext
    ) -> None:
        await self._insert_item(thread_id, item, context, upsert=False)

    async def save_item(
        self, thread_id: str, item: ThreadItem, context: ChatKitRequestContext
    ) -> None:
        await self._insert_item(thread_id, item, context, upsert=True)

    async def _insert_item(
        self,
        thread_id: str,
        item: ThreadItem,
        context: ChatKitRequestContext,
        *,
        upsert: bool,
    ) -> None:
        user_id = context.user_id
        payload = _dumps(item.model_dump(mode="json"))
        conflict = (
            # Conflict target matches the (id, user_id) unique constraint, not the
            # bare `id` PK — mirrors save_thread: a same-id row owned by another
            # user must raise a UniqueViolation here rather than being overwritten.
            "ON CONFLICT (id, user_id) DO UPDATE SET "
            "payload = EXCLUDED.payload, item_type = EXCLUDED.item_type, "
            "updated_at = NOW()"
            if upsert
            else ""
        )
        insert_sql = f"""
            INSERT INTO chatkit_items
                (id, thread_id, user_id, item_type, payload, created_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s)
            {conflict}
        """
        item_params = (item.id, thread_id, user_id, item.type, payload, item.created_at)

        async def operation(conn: AsyncConnection) -> None:
            async with conn.transaction(), conn.cursor() as cur:
                await cur.execute(insert_sql, item_params)  # type: ignore[arg-type]
                # Keep thread-list recency (load_threads orders by updated_at).
                await cur.execute(
                    "UPDATE chatkit_threads SET updated_at = NOW() "
                    "WHERE id = %s AND user_id = %s",
                    (thread_id, user_id),
                )

        label = "chatkit.save_item" if upsert else "chatkit.add_thread_item"
        await self._run(context, operation, idempotent=upsert, label=label)

    async def load_item(
        self, thread_id: str, item_id: str, context: ChatKitRequestContext
    ) -> ThreadItem:
        async def operation(conn: AsyncConnection) -> ThreadItem:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT payload FROM chatkit_items "
                    "WHERE id = %s AND thread_id = %s AND user_id = %s",
                    (item_id, thread_id, context.user_id),
                )
                row = await cur.fetchone()
            if row is None:
                raise NotFoundError(f"Item {item_id} not found in thread {thread_id}")
            return _ITEM_ADAPTER.validate_python(row["payload"])

        return await self._run(context, operation, label="chatkit.load_item")

    async def delete_thread_item(
        self, thread_id: str, item_id: str, context: ChatKitRequestContext
    ) -> None:
        async def operation(conn: AsyncConnection) -> int:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM chatkit_items "
                    "WHERE id = %s AND thread_id = %s AND user_id = %s",
                    (item_id, thread_id, context.user_id),
                )
                return cur.rowcount

        deleted = await self._run(
            context, operation, idempotent=False, label="chatkit.delete_thread_item"
        )
        if deleted == 0:
            raise NotFoundError(f"Item {item_id} not found in thread {thread_id}")

    # ── attachments (out of scope: text-only chat) ───────────────────────────

    async def save_attachment(
        self, attachment: Any, context: ChatKitRequestContext
    ) -> None:
        raise NotImplementedError("attachments are not supported")

    async def load_attachment(
        self, attachment_id: str, context: ChatKitRequestContext
    ) -> Any:
        raise NotImplementedError("attachments are not supported")

    async def delete_attachment(
        self, attachment_id: str, context: ChatKitRequestContext
    ) -> None:
        raise NotImplementedError("attachments are not supported")
