from __future__ import annotations

from typing import Any, AsyncGenerator, Optional

import httpx

from src.agents.providers.openai_compatible import OpenAICompatibleProvider
from src.agents.providers.base import ProviderStreamDelta
from src.schemas.providers import ProviderMetadata, ProviderModel


class CohereProvider(OpenAICompatibleProvider):
    async def list_models(self, api_key: str, base_url: Optional[str] = None) -> list[ProviderModel]:
        endpoint = f"{(base_url or self.metadata.default_base_url).rstrip('/')}/models"
        headers = self._headers(api_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(endpoint, headers=headers)
            if response.status_code == 404:
                return self._fallback_models()
            response.raise_for_status()
            payload = response.json()

        items = payload.get("data", payload)
        if not isinstance(items, list):
            return self._fallback_models()

        models: list[ProviderModel] = []
        for item in items:
            model_id = item.get("id") or item.get("name")
            if not model_id:
                continue
            models.append(
                ProviderModel(
                    id=model_id,
                    provider=self.metadata.id,
                    label=model_id,
                    owned_by=item.get("owned_by") or item.get("provider") or item.get("architecture", {}).get("tokenizer"),
                    supports_tools=True,
                    context_window=item.get("context_length") or item.get("top_provider", {}).get("context_length") or item.get("max_context_window"),
                )
            )
        if not models:
            return self._fallback_models()
        models.sort(key=lambda model: model.label.lower())
        return models

    async def stream_chat_completion(
        self,
        *,
        api_key: str,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        base_url: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[ProviderStreamDelta, None]:
        endpoint = f"{(base_url or self.metadata.default_base_url).rstrip('/')}/chat/completions"
        headers = self._headers(api_key)
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "tools": tools,
            "temperature": temperature,
            "stream": True,
        }
        if tools:
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=30.0)) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                response.raise_for_status()
                async for event in self._iter_sse_events(response):
                    if event == "[DONE]":
                        break
                    choice = (event.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    finish_reason = choice.get("finish_reason")
                    text = self._extract_text(delta.get("content"))
                    reasoning = self._extract_text(delta.get("reasoning") or delta.get("reasoning_content") or delta.get("reason") or "")
                    tool_calls = delta.get("tool_calls") or None
                    if text or reasoning or tool_calls or finish_reason:
                        yield ProviderStreamDelta(
                            text=text,
                            reasoning=reasoning,
                            tool_calls=tool_calls,
                            finish_reason=finish_reason,
                            raw=event,
                        )

    def _fallback_models(self) -> list[ProviderModel]:
        model_ids = [
            "command-a-plus-05-2026",
            "command-r7b-03-2026",
            "command-r-plus-05-2026",
            "command-r-05-2026",
            "command-a-powerful",
        ]
        return [
            ProviderModel(
                id=mid,
                provider=self.metadata.id,
                label=mid,
            )
            for mid in model_ids
        ]
