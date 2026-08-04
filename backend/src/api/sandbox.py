from fastapi import APIRouter, HTTPException

from src.agents.sandbox.registry import SandboxRegistry
from src.services.session_store import SessionStore


def build_sandbox_router(session_store: SessionStore, sandbox_registry: SandboxRegistry) -> APIRouter:
    router = APIRouter(prefix="/sandbox", tags=["sandbox"])

    def _get_session(chat_id: str):
        try:
            session = session_store.get(chat_id)
            if session is None or session.sandbox_context is None:
                raise HTTPException(status_code=404, detail="No active sandbox for this chat.")
            return session
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Session lookup failed: {exc}") from exc

    def _get_adapter(provider: str):
        try:
            return sandbox_registry.get(provider)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Sandbox adapter error: {exc}") from exc

    @router.post("/kill/{chat_id}")
    async def kill_sandbox(chat_id: str) -> dict[str, bool]:
        session = _get_session(chat_id)
        try:
            adapter = _get_adapter(session.sandbox_context.provider)
            await adapter.dispose(session.sandbox_context)
            session.sandbox_context = None
            if session.code_server_task is not None and not session.code_server_task.done():
                session.code_server_task.cancel()
            if session.agent_task is not None and not session.agent_task.done():
                session.agent_task.cancel()
            if session.event_buffer is not None:
                session.event_buffer.set_done()
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to kill sandbox: {exc}") from exc

    return router
