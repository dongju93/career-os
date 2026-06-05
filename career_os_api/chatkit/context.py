"""Per-request context handed to the ChatKit SDK.

The ChatKit `Store` and `ChatKitServer` are generic over a context type. The SDK
passes whatever instance we provide straight through to every store method, so we
use it to carry the *authenticated* user identity and the resources each store
operation needs. Crucially, `user_id` is derived only from the verified
`current_user` — never from the request body — so every DB query can be scoped to
the caller and cross-tenant access is impossible by construction.
"""

from dataclasses import dataclass
from uuid import UUID

from psycopg_pool import AsyncConnectionPool


@dataclass(frozen=True, slots=True)
class ChatKitRequestContext:
    """Immutable context threaded through ChatKit store/server calls for one request."""

    user_id: UUID
    pool: AsyncConnectionPool
    request_id: str | None = None
    locale: str | None = None
