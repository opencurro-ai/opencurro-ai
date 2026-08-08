import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from src.agents.agent import AgentRunner
from src.schemas.chat import ChatStreamRequest
from src.services.event_buffer import SessionEventBuffer
from src.services.session_store import SessionStore


def build_chat_router(agent_runner: AgentRunner, session_store: SessionStore) -> APIRouter:
    router = APIRouter(prefix="/chat", tags=["chat"])

    @router.post("/abort/{chat_id}")
    async def abort_chat(chat_id: str) -> dict[str, bool]:
        session = session_store.get(chat_id)
        if not session:
            return {"ok": False}
        if session.agent_task is not None and not session.agent_task.done():
            session.agent_task.cancel()
        if session.event_buffer is not None:
            session.event_buffer.set_done()
        return {"ok": True}

    @router.post("/stream")
    async def stream_chat(request: ChatStreamRequest) -> StreamingResponse:
        session = session_store.get_or_create(request.chat_id)

        start_new = bool(request.user_message and request.provider and request.model and request.api_key and request.sandbox)

        if start_new:
            if session.agent_task is not None and not session.agent_task.done():
                session.agent_task.cancel()
            buffer = SessionEventBuffer()
            session.event_buffer = buffer
            session.agent_task = asyncio.create_task(
                agent_runner.run_agent(request, buffer)
            )
            generator = agent_runner.stream_sse(request.chat_id, request.since_event_id)
            return StreamingResponse(generator, media_type="text/event-stream")

        has_buffer = session.event_buffer is not None

        if has_buffer:
            generator = agent_runner.stream_sse(request.chat_id, request.since_event_id)
            return StreamingResponse(generator, media_type="text/event-stream")

        raise HTTPException(status_code=400, detail="No active agent and no user message provided.")

    return router
