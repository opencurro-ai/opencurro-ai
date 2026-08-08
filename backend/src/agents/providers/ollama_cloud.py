from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Optional

import httpx

from src.agents.providers.base import ProviderStreamDelta
from src.agents.providers.openai_compatible import OpenAICompatibleProvider
from src.schemas.providers import ProviderMetadata, ProviderModel


class OllamaCloudError(Exception):
    pass


class OllamaCloudProvider(OpenAICompatibleProvider):
    def __init__(self, metadata: ProviderMetadata) -> None:
        super().__init__(metadata)

    async def list_models(self, api_key: str, base_url: Optional[str] = None) -> list[ProviderModel]:
        endpoint = "https://ollama.com/api/tags"
        headers = self._headers(api_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(endpoint, headers=headers)
            response.raise_for_status()
            payload = response.json()

        items = payload.get("models", [])
        models: list[ProviderModel] = []
        for item in items:
            model_id = item.get("name")
            if not model_id:
                continue
            models.append(
                ProviderModel(
                    id=model_id,
                    provider=self.metadata.id,
                    label=model_id,
                    owned_by="ollama",
                    supports_tools=True,
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
        endpoint = "https://ollama.com/api/chat"
        headers = self._headers(api_key)
        clean_messages = self._normalize_messages(messages)
        clean_tools = self._normalize_tools(tools)
        payload: dict[str, Any] = {
            "model": model,
            "messages": clean_messages,
            "stream": True,
        }
        if clean_tools:
            payload["tools"] = clean_tools

        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=30.0)) as client:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    error_msg = f"Ollama Cloud error ({response.status_code})"
                    try:
                        data = json.loads(body)
                        if err := data.get("error"):
                            error_msg = f"Ollama Cloud: {err}"
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        text = body.decode(errors="replace").strip()
                        if text:
                            error_msg = f"Ollama Cloud error ({response.status_code}): {text}"
                    raise OllamaCloudError(error_msg)

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if err := event.get("error"):
                        raise OllamaCloudError(str(err))
                    yield self._delta_from_event(event)

    def _normalize_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean: list[dict[str, Any]] = []
        for msg in messages:
            entry: dict[str, Any] = {"role": msg["role"]}
            content = msg.get("content")
            if content is not None:
                entry["content"] = content

            if msg["role"] == "assistant":
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    entry["tool_calls"] = self._normalize_tool_calls(tool_calls)
            elif msg["role"] == "tool":
                entry["tool_name"] = msg.get("name", "")
            clean.append(entry)
        return clean

    def _normalize_tool_calls(self, tool_calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for tc in tool_calls:
            func = tc.get("function", {})
            args = func.get("arguments", "{}")
            if isinstance(args, str):
                try:
                    args = json.loads(args or "{}")
                except json.JSONDecodeError:
                    args = {}
            normalized.append({
                "function": {
                    "name": func.get("name", ""),
                    "arguments": args,
                }
            })
        return normalized

    def _normalize_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean: list[dict[str, Any]] = []
        for tool in tools:
            func = tool.get("function", {})
            clean.append({
                "type": tool.get("type", "function"),
                "function": {
                    "name": func.get("name", ""),
                    "description": func.get("description", ""),
                    "parameters": func.get("parameters", {}),
                },
            })
        return clean

    def _delta_from_event(self, event: dict[str, Any]) -> ProviderStreamDelta:
        message = event.get("message") or {}
        content = self._extract_text(message.get("content"))
        reasoning = self._extract_text(
            message.get("thinking") or message.get("reasoning") or message.get("reasoning_content") or ""
        )
        raw_tool_calls = message.get("tool_calls") or None
        tool_calls = self._openai_style_tool_calls(raw_tool_calls)
        done = event.get("done", False)
        finish_reason = event.get("done_reason") if done else None

        return ProviderStreamDelta(
            text=content if content else None,
            reasoning=reasoning if reasoning else None,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
            raw=event,
        )

    def _openai_style_tool_calls(self, tool_calls: Any) -> Any:
        if not tool_calls:
            return None
        normalized: list[dict[str, Any]] = []
        for i, tc in enumerate(tool_calls):
            func = tc.get("function", {})
            args = func.get("arguments", {})
            if isinstance(args, dict):
                args = json.dumps(args)
            normalized.append({
                "index": i,
                "id": f"call_{i}",
                "type": "function",
                "function": {
                    "name": func.get("name", ""),
                    "arguments": args,
                },
            })
        return normalized
