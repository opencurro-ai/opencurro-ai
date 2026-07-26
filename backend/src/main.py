from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.agents.agent import AgentRunner
from src.agents.providers.registry import ProviderRegistry
from src.agents.sandbox.registry import SandboxRegistry
from src.agents.subagents import SubAgentRunner
from src.agents.tools.registry import ToolRegistry
from src.api.chat import build_chat_router
from src.api.providers import build_provider_router
from src.api.sandbox import build_sandbox_router
from src.core.config import get_settings
from src.services.session_store import SessionStore

settings = get_settings()
provider_registry = ProviderRegistry()
sandbox_registry = SandboxRegistry()
tool_registry = ToolRegistry()
session_store = SessionStore()
sub_agent_runner = SubAgentRunner(
    provider_registry=provider_registry,
    tool_registry=tool_registry,
    session_store=session_store,
)
agent_runner = AgentRunner(
    provider_registry=provider_registry,
    sandbox_registry=sandbox_registry,
    tool_registry=tool_registry,
    session_store=session_store,
    sub_agent_runner=sub_agent_runner,
)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}


app.include_router(build_provider_router(provider_registry), prefix=settings.api_prefix)
app.include_router(build_chat_router(agent_runner, session_store), prefix=settings.api_prefix)
app.include_router(build_sandbox_router(session_store, sandbox_registry), prefix=settings.api_prefix)