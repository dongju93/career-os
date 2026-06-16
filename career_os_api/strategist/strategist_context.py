"""Per-request context handed to the Strategist agent run.

Mirrors the ChatKit context pattern: identity is carried here, sourced only from
the verified `current_user`, never from model arguments. Every tool reads
`ctx.context.user_id`, so each DB query is scoped to the caller and cross-tenant
access is impossible by construction. Unlike ChatKit there is no nested
`AgentContext` wrapper — the plan run owns its history, so the SDK's
`RunContextWrapper` carries this dataclass directly.

`target_group_id` carries the server-resolved job-search group a plan run is
scoped to. The list tool reads it instead of trusting a model-supplied group, so
the model cannot widen the analysis past the requested group. It is `None` for the
tool-less artifact run, which has no group concept.
"""

from dataclasses import dataclass
from uuid import UUID

from psycopg_pool import AsyncConnectionPool


@dataclass(frozen=True, slots=True)
class StrategistRunContext:
    """Immutable identity + resources for one plan run."""

    user_id: UUID
    pool: AsyncConnectionPool
    request_id: str | None = None
    target_group_id: UUID | None = None
