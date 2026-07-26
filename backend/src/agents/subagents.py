from __future__ import annotations

import json
from typing import Any, Optional

from src.agents.providers.registry import ProviderRegistry
from src.agents.tools.registry import ToolRegistry
from src.services.event_buffer import SessionEventBuffer
from src.services.session_store import SessionStore


class SubAgentRunner:
    def __init__(
        self,
        *,
        provider_registry: ProviderRegistry,
        tool_registry: ToolRegistry,
        session_store: SessionStore,
    ) -> None:
        self.provider_registry = provider_registry
        self.tool_registry = tool_registry
        self.session_store = session_store

    async def run(
        self,
        *,
        chat_id: str,
        session_name: str,
        agent_config: dict[str, Any],
        task: str,
        sandbox_adapter,
        sandbox_context,
        buffer: SessionEventBuffer,
        provider,
        model: str,
        api_key: str,
        base_url: Optional[str] = None,
        tavily_api_key: Optional[str] = None,
        exa_api_key: Optional[str] = None,
        search_provider: Optional[str] = None,
        firecrawl_api_key: Optional[str] = None,
    ) -> str:
        sub_session_key = f"sub:{chat_id}:{session_name}"
        session = self.session_store.get_or_create(sub_session_key)

        if not session.messages:
            system_prompt = agent_config.get("system_prompt", "")
            system_prompt += "\n\nAfter you complete the work, provide a complete summary of what you found and what you figured out."
            session.messages.append({"role": "system", "content": system_prompt})

        session.messages.append({"role": "user", "content": task})

        allowed_tool_names = set(agent_config.get("tools", []))
        tool_schemas = [
            s for s in self.tool_registry.schemas
            if s.get("function", {}).get("name") in allowed_tool_names
        ]

        iteration = 0
        max_iterations = 100000

        while iteration < max_iterations:
            iteration += 1

            content_parts: list[str] = []
            reasoning_parts: list[str] = []
            streamed_tool_calls: list[dict] = []
            finish_reason: Optional[str] = None

            try:
                async for delta in provider.stream_chat_completion(
                    api_key=api_key,
                    model=model,
                    messages=self._build_messages(session.messages),
                    tools=tool_schemas,
                    base_url=base_url,
                ):
                    if delta.text:
                        cleaned = delta.text.replace("\r\n", "\n")
                        if cleaned:
                            content_parts.append(cleaned)
                            await buffer.append("sub_agent_token", {
                                "session": session_name,
                                "value": cleaned,
                            })
                    if delta.reasoning:
                        cleaned = delta.reasoning.replace("\r\n", "\n")
                        if cleaned:
                            reasoning_parts.append(cleaned)
                            await buffer.append("sub_agent_reasoning", {
                                "session": session_name,
                                "value": cleaned,
                            })
                    if delta.tool_calls:
                        streamed_tool_calls = self._merge_tool_calls(
                            streamed_tool_calls, delta.tool_calls
                        )
                    if delta.finish_reason:
                        finish_reason = delta.finish_reason
            except Exception as exc:
                await buffer.append("sub_agent_error", {
                    "session": session_name,
                    "message": f"Sub-agent provider error: {exc}",
                })
                return f"Sub-agent error: {exc}"

            try:
                if streamed_tool_calls or finish_reason == "tool_calls":
                    assistant_msg: dict[str, Any] = {
                        "role": "assistant",
                        "content": "".join(content_parts) or None,
                        "tool_calls": streamed_tool_calls,
                    }
                    if reasoning_parts:
                        assistant_msg["reasoning_content"] = "".join(reasoning_parts)
                    session.messages.append(assistant_msg)

                    for tc in streamed_tool_calls:
                        tool_name = tc.get("function", {}).get("name", "unknown")
                        tool_args = tc.get("function", {}).get("arguments", "{}")

                        payload = self._safe_json_loads(tool_args)
                        await buffer.append("sub_agent_tool_call", {
                            "session": session_name,
                            "name": tool_name,
                            "label": self._tool_label(tool_name, payload),
                            "arguments": tool_args,
                            "file_path": payload.get("file_path"),
                            "command": payload.get("command"),
                            "query": payload.get("query"),
                            "url": payload.get("url"),
                            "path": payload.get("path"),
                            "session_name": payload.get("session_name") or payload.get("session") or "default",
                            "session_names": payload.get("session_names"),
                            "old_string": payload.get("old_string"),
                            "new_string": payload.get("new_string"),
                            "input": payload.get("input"),
                        })

                        result = await self.tool_registry.execute(
                            tool_name,
                            tool_args,
                            sandbox_adapter=sandbox_adapter,
                            sandbox_context=sandbox_context,
                            provider=provider,
                            model=model,
                            api_key=api_key,
                            base_url=base_url,
                            chat_id=chat_id,
                            session_store=self.session_store,
                            tavily_api_key=tavily_api_key,
                            exa_api_key=exa_api_key,
                            search_provider=search_provider,
                            firecrawl_api_key=firecrawl_api_key,
                        )

                        session.messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "name": tool_name,
                            "content": json.dumps(result),
                        })

                        await buffer.append("sub_agent_tool_result", {
                            "session": session_name,
                            "name": tool_name,
                            "ok": result.get("ok", False),
                            "result": result,
                        })

                    continue

                final_content = "".join(content_parts)
                assistant_msg = {"role": "assistant", "content": final_content}
                if reasoning_parts:
                    assistant_msg["reasoning_content"] = "".join(reasoning_parts)
                session.messages.append(assistant_msg)

                await buffer.append("sub_agent_done", {
                    "session": session_name,
                    "content": final_content,
                })

                return final_content

            except Exception as exc:
                await buffer.append("sub_agent_error", {
                    "session": session_name,
                    "message": f"Sub-agent loop error: {exc}",
                })
                return f"Sub-agent loop error: {exc}"

        msg = "Sub-agent reached maximum iterations."
        await buffer.append("sub_agent_error", {
            "session": session_name,
            "message": msg,
        })
        return msg

    def _build_messages(self, messages: list[dict]) -> list[dict]:
        built: list[dict] = []
        for message in messages:
            m: dict = {"role": message["role"]}
            if message.get("content") is not None:
                m["content"] = message["content"]
            if message.get("reasoning_content") is not None:
                m["reasoning_content"] = message["reasoning_content"]
            if message.get("tool_calls") is not None:
                m["tool_calls"] = message["tool_calls"]
            if message.get("tool_call_id") is not None:
                m["tool_call_id"] = message["tool_call_id"]
            if message.get("name") is not None:
                m["name"] = message["name"]
            built.append(m)
        return built

    def _merge_tool_calls(self, accumulated: list[dict], incoming: list[dict]) -> list[dict]:
        merged = accumulated[:] if accumulated else []
        for chunk in incoming:
            index = chunk.get("index", len(merged))
            while len(merged) <= index:
                merged.append({"id": None, "type": "function", "function": {"name": "", "arguments": ""}})
            target = merged[index]
            if chunk.get("id"):
                target["id"] = chunk["id"]
            if chunk.get("type"):
                target["type"] = chunk["type"]
            function = chunk.get("function") or {}
            target_function = target.setdefault("function", {"name": "", "arguments": ""})
            if function.get("name"):
                target_function["name"] += function["name"]
            if function.get("arguments"):
                target_function["arguments"] += function["arguments"]
        return merged

    def _safe_json_loads(self, raw: str) -> dict:
        import re
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw or "")
            if not match:
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}

    def _tool_label(self, tool_name: str, payload: dict) -> str:
        if tool_name == "shall_tool":
            return f"Terminal: {payload.get('command', 'unknown')}"
        if tool_name == "shell_view":
            sessions = payload.get("session_names", [])
            return f"Shell View: {', '.join(sessions) if sessions else 'unknown'}"
        if tool_name == "list_files":
            return f"List: {payload.get('path', 'unknown')}"
        if tool_name == "web_search":
            return "Web Search"
        if tool_name == "fatch_web_urls":
            return f"Fetch: {payload.get('url', 'url')}"
        if tool_name == "apply_patch":
            return "Apply Patch"
        if tool_name == "str_replace":
            return f"Edit: {payload.get('file_path', 'unknown')}"
        prefix = "Create" if tool_name == "file_write" else "Read"
        return f"{prefix}: {payload.get('file_path', 'unknown')}"
