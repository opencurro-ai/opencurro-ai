from src.agents.providers.base import LLMProvider
from src.agents.providers.openai_compatible import OpenAICompatibleProvider
from src.agents.providers.ollama_cloud import OllamaCloudProvider
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
            ProviderType.OLLAMA_CLOUD: OllamaCloudProvider(
                ProviderMetadata(
                    id=ProviderType.OLLAMA_CLOUD,
                    label="Ollama Cloud",
                    default_base_url="https://ollama.com/api/v1",
                )
            ),
            ProviderType.OPENCODE_ZEN: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.OPENCODE_ZEN,
                    label="OpenCode Zen",
                    default_base_url="https://opencode.ai/zen/v1",
                )
            ),
            ProviderType.AIHUBMIX: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.AIHUBMIX,
                    label="AIHubMix",
                    default_base_url="https://api.aihubmix.com/v1",
                )
            ),
            ProviderType.BLUECLAW: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.BLUECLAW,
                    label="Blue Claw",
                    default_base_url="https://openai.blueclaw.network/v1",
                )
            ),
            ProviderType.REQUESTY: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.REQUESTY,
                    label="Requesty",
                    default_base_url="https://router.requesty.ai/v1",
                )
            ),
            ProviderType.UNOROUTER: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.UNOROUTER,
                    label="UnoRouter",
                    default_base_url="https://api.unorouter.com/v1",
                )
            ),
        }

    def get(self, provider_type: ProviderType) -> LLMProvider:
        return self._providers[provider_type]

    def list_supported(self) -> list[ProviderMetadata]:
        return [provider.metadata for provider in self._providers.values()]