from fastapi import APIRouter, HTTPException, Query

from src.agents.sandbox.registry import SandboxRegistry
from src.schemas.sandbox import SandboxFilesResponse, SandboxSummary, WriteFileRequest
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

    @router.get("/files", response_model=SandboxFilesResponse)
    async def list_sandbox_files(
        chat_id: str = Query(...),
        path: str = Query("/home/user"),
        depth: int = Query(4, ge=1, le=8),
    ) -> SandboxFilesResponse:
        session = _get_session(chat_id)
        try:
            adapter = _get_adapter(session.sandbox_context.provider)
            tree = await adapter.list_tree(session.sandbox_context, path=path, depth=depth)
            sandbox = SandboxSummary(
                sandbox_id=session.sandbox_context.sandbox_id,
                provider=session.sandbox_context.provider,
                root_path=session.sandbox_context.root_path,
                created_at=session.sandbox_context.created_at,
                timeout_seconds=session.sandbox_context.timeout_seconds,
                template_id=session.sandbox_context.template_id,
            )
            return SandboxFilesResponse(sandbox=sandbox, path=path, tree=tree)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to list files: {exc}") from exc

    @router.get("/file-content")
    async def read_sandbox_file(
        chat_id: str = Query(...),
        path: str = Query(...),
    ) -> dict:
        session = _get_session(chat_id)
        try:
            adapter = _get_adapter(session.sandbox_context.provider)
            content = await adapter.read_file(session.sandbox_context, path)
            return {"path": path, "content": content}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read file: {exc}") from exc

    @router.post("/file-content")
    async def write_sandbox_file(request: WriteFileRequest) -> dict:
        session = _get_session(request.chat_id)
        try:
            adapter = _get_adapter(session.sandbox_context.provider)
            await adapter.write_file(session.sandbox_context, request.path, request.content)
            return {"path": request.path, "ok": True}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to write file: {exc}") from exc

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
