from src.agents.providers.base import LLMProvider
from src.agents.providers.openai_compatible import OpenAICompatibleProvider
from src.schemas.providers import ProviderMetadata, ProviderType


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[ProviderType, LLMProvider] = {
            ProviderType.OPENROUTER: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.OPENROUTER,
                    label="OpenRouter",
                    default_base_url="https://openrouter.ai/api/v1",
                )
            ),
            ProviderType.GROQ: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.GROQ,
                    label="Groq",
                    default_base_url="https://api.groq.com/openai/v1",
                )
            ),
            ProviderType.NVIDIA: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.NVIDIA,
                    label="NVIDIA NIM",
                    default_base_url="https://integrate.api.nvidia.com/v1",
                )
            ),
            ProviderType.FIREWORKS: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.FIREWORKS,
                    label="Fireworks AI",
                    default_base_url="https://api.fireworks.ai/inference/v1",
                )
            ),
        }

    def get(self, provider_type: ProviderType) -> LLMProvider:
        return self._providers[provider_type]

    def list_supported(self) -> list[ProviderMetadata]:
        return [provider.metadata for provider in self._providers.values()]