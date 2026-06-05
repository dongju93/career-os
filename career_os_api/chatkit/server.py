"""Career OS ChatKit server.

Text-only assistant: each turn is grounded solely in the current thread's stored
history plus the new user message. No tools, no retrieval, no file/page context.
The Agents SDK is pointed at the app's shared `AsyncOpenAI` via
`set_default_openai_client` (the SDK keeps a module-global client rather than
accepting one per `Runner` call), and tracing is disabled to avoid extra egress.
"""

import logging
from collections.abc import AsyncIterator

from agents import Agent, Runner, set_default_openai_client, set_tracing_disabled
from chatkit.agents import AgentContext, simple_to_agent_input, stream_agent_response
from chatkit.server import ChatKitServer
from chatkit.store import Store
from chatkit.types import ThreadMetadata, ThreadStreamEvent, UserMessageItem
from openai import AsyncOpenAI

from career_os_api.chatkit.context import ChatKitRequestContext

_logger = logging.getLogger(__name__)

_AGENT_NAME = "career-os-assistant"

_SYSTEM_INSTRUCTIONS = (
    "당신은 Career OS의 구직 활동 도우미입니다.\n"
    "사용자가 직접 입력한 텍스트와 이 대화의 이전 메시지만 볼 수 있습니다.\n"
    "확인할 수 없는 개인 데이터나 저장 데이터를 추측하지 마세요.\n"
    "구직 관련 질문에 한국어로 간결하게 답변하고, 필요한 정보가 없으면 "
    "사용자에게 텍스트로 알려 달라고 요청하세요."
)


def build_career_os_agent(model: str) -> Agent[AgentContext[ChatKitRequestContext]]:
    """Construct the chat agent. No tools are registered — kept as a pure factory so
    the 'no tools' guarantee is unit-testable without invoking the model."""
    return Agent[AgentContext[ChatKitRequestContext]](
        name=_AGENT_NAME,
        instructions=_SYSTEM_INSTRUCTIONS,
        model=model,
        tools=[],
    )


def _derive_title(thread: ThreadMetadata, message: UserMessageItem | None) -> str:
    """Short, human-readable title from the first text part, or a deterministic fallback."""
    if message is not None:
        for part in message.content:
            text = getattr(part, "text", None)
            if text and text.strip():
                return text.strip()[:60]
    return f"대화 {thread.id[-6:]}"


class CareerOsChatKitServer(ChatKitServer[ChatKitRequestContext]):
    def __init__(
        self,
        store: Store[ChatKitRequestContext],
        *,
        openai_client: AsyncOpenAI,
        model: str,
    ) -> None:
        super().__init__(store)
        self._model = model
        # Reuse the app's single AsyncOpenAI for all agent runs; disable tracing
        # export so the SDK does not attempt extra network calls per turn.
        set_default_openai_client(openai_client, use_for_tracing=False)
        set_tracing_disabled(True)
        self._agent = build_career_os_agent(model)

    async def respond(
        self,
        thread: ThreadMetadata,
        input_user_message: UserMessageItem | None,
        context: ChatKitRequestContext,
    ) -> AsyncIterator[ThreadStreamEvent]:
        from career_os_api.config import settings

        # Most-recent-N items, then reversed to chronological order for the model.
        items_page = await self.store.load_thread_items(
            thread.id,
            after=None,
            limit=settings.chatkit_history_item_limit,
            order="desc",
            context=context,
        )
        items = list(reversed(items_page.data))
        input_items = await simple_to_agent_input(items)

        if not thread.title:
            thread.title = _derive_title(thread, input_user_message)
            await self.store.save_thread(thread, context)

        agent_context: AgentContext[ChatKitRequestContext] = AgentContext(
            thread=thread, store=self.store, request_context=context
        )
        result = Runner.run_streamed(self._agent, input_items, context=agent_context)

        _logger.info(
            "chatkit.respond.start thread_id=%s user_id=%s request_id=%s",
            thread.id,
            context.user_id,
            context.request_id,
        )
        async for event in stream_agent_response(agent_context, result):
            yield event
        _logger.info("chatkit.respond.end thread_id=%s", thread.id)
