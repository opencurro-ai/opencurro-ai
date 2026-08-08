from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from src.schemas.providers import ProviderType
from src.schemas.sandbox import SandboxSettings


MessageRole = Literal["system", "user", "assistant", "tool"]


class ChatMessage(BaseModel):
    role: MessageRole
    content: Optional[str] = None
    reasoning_content: Optional[str] = None
    tool_calls: Optional[list[dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatStreamRequest(BaseModel):
    chat_id: str = Field(min_length=1)
    user_message: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)
    provider: ProviderType | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    sandbox: SandboxSettings | None = None
    max_iterations: int = Field(default=1000, ge=1, le=1000)
    tavily_api_key: str | None = None
    exa_api_key: str | None = None
    serpapi_api_key: str | None = None
    search_provider: str | None = None
    firecrawl_api_key: str | None = None
    sub_agents: list[dict[str, Any]] = Field(default_factory=list)
    since_event_id: int = Field(default=-1)


class SSEEvent(BaseModel):
    event: str
    data: dict[str, Any]