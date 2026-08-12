from src.agents.providers.base import LLMProvider
from src.agents.providers.cohere import CohereProvider
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
            ProviderType.VERCEL_AI_GATEWAY: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.VERCEL_AI_GATEWAY,
                    label="Vercel AI Gateway",
                    default_base_url="https://ai-gateway.vercel.sh/v1",
                )
            ),
            ProviderType.ZENMUX: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.ZENMUX,
                    label="ZenMux",
                    default_base_url="https://zenmux.ai/api/v1",
                )
            ),
            ProviderType.KILO_CODE: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.KILO_CODE,
                    label="Kilo Code",
                    default_base_url="https://api.kilo.ai/api/gateway",
                )
            ),
            ProviderType.CHUTES: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.CHUTES,
                    label="Chutes",
                    default_base_url="https://llm.chutes.ai/v1",
                )
            ),
            ProviderType.COHERE: CohereProvider(
                ProviderMetadata(
                    id=ProviderType.COHERE,
                    label="Cohere",
                    default_base_url="https://api.cohere.ai/compatibility/v1",
                )
            ),
            ProviderType.MISTRAL: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.MISTRAL,
                    label="Mistral AI",
                    default_base_url="https://api.mistral.ai/v1",
                )
            ),
            ProviderType.CEREBRAS: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.CEREBRAS,
                    label="Cerebras",
                    default_base_url="https://api.cerebras.ai/v1",
                )
            ),
            ProviderType.SAMBANOVA: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.SAMBANOVA,
                    label="SambaNova",
                    default_base_url="https://api.sambanova.ai/v1",
                )
            ),
            ProviderType.HUGGINGFACE: OpenAICompatibleProvider(
                ProviderMetadata(
                    id=ProviderType.HUGGINGFACE,
                    label="Hugging Face",
                    default_base_url="https://router.huggingface.co/v1",
                )
            ),
        }

    def get(self, provider_type: ProviderType) -> LLMProvider:
        return self._providers[provider_type]

    def list_supported(self) -> list[ProviderMetadata]:
        return [provider.metadata for provider in self._providers.values()]