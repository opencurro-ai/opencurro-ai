from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Optional

import httpx

from src.agents.providers.base import LLMProvider, ProviderStreamDelta
from src.schemas.providers import ProviderMetadata, ProviderModel, ProviderType


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, metadata: ProviderMetadata) -> None:
        self.metadata = metadata

    async def list_models(self, api_key: str, base_url: Optional[str] = None) -> list[ProviderModel]:
        endpoint = f"{(base_url or self.metadata.default_base_url).rstrip('/')}/models"
        headers = self._headers(api_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(endpoint, headers=headers)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, list):
            items = payload
        else:
            items = payload.get("data", payload)
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
        payload = {
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "parallel_tool_calls": False,
            "temperature": temperature,
            "stream": True,
        }

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

    async def _iter_sse_events(self, response: httpx.Response) -> AsyncGenerator[dict[str, Any] | str, None]:
        buffer = ""
        async for chunk in response.aiter_text():
            buffer += chunk
            while "\n\n" in buffer:
                raw_event, buffer = buffer.split("\n\n", 1)
                data_lines: list[str] = []
                for line in raw_event.splitlines():
                    line = line.strip()
                    if not line or line.startswith(":"):
                        continue
                    if line.startswith("data:"):
                        data_lines.append(line[5:].strip())
                if not data_lines:
                    continue
                data = "\n".join(data_lines)
                if data == "[DONE]":
                    yield data
                    return
                try:
                    yield json.loads(data)
                except json.JSONDecodeError:
                    continue

    def _headers(self, api_key: str) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if self.metadata.id == ProviderType.OPENROUTER:
            headers["X-Title"] = "Novita Agent Studio"
        return headers

    def _extract_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, dict):
                    text = item.get("text") or item.get("content") or ""
                    if text:
                        parts.append(str(text))
                else:
                    parts.append(str(item))
            return "".join(parts)
        return str(value)