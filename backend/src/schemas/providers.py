from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    OPENROUTER = "openrouter"
    GROQ = "groq"
    NVIDIA = "nvidia"
    FIREWORKS = "fireworks"
    OLLAMA_CLOUD = "ollama_cloud"


class ProviderMetadata(BaseModel):
    id: ProviderType
    label: str
    default_base_url: str
    supports_tools: bool = True
    supports_streaming: bool = True


class ProviderModel(BaseModel):
    id: str
    provider: ProviderType
    label: str
    owned_by: Optional[str] = None
    supports_tools: Optional[bool] = True
    context_window: Optional[int] = None


class ProviderModelsRequest(BaseModel):
    provider: ProviderType
    api_key: str = Field(min_length=1)
    base_url: Optional[str] = None


class ProviderModelsResponse(BaseModel):
    provider: ProviderType
    models: list[ProviderModel]