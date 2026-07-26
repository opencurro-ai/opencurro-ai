from __future__ import annotations

import asyncio
import json
import re
from typing import Any, AsyncGenerator, Optional

from src.agents.providers.registry import ProviderRegistry
from src.agents.sandbox.registry import SandboxRegistry
from src.agents.subagents import SubAgentRunner
from src.agents.systemprompts.systemprompt import SYSTEM_PROMPT
from src.agents.tools.registry import ToolRegistry
from src.schemas.chat import ChatMessage, ChatStreamRequest
from src.services.event_buffer import SessionEventBuffer
from src.services.session_store import SessionStore


class AgentRunner:
    def __init__(
        self,
        *,
        provider_registry: ProviderRegistry,
        sandbox_registry: SandboxRegistry,
        tool_registry: ToolRegistry,
        session_store: SessionStore,
        sub_agent_runner: SubAgentRunner,
    ) -> None:
        self.provider_registry = provider_registry
        self.sandbox_registry = sandbox_registry
        self.tool_registry = tool_registry
        self.session_store = session_store
        self.sub_agent_runner = sub_agent_runner

    async def run_agent(self, request: ChatStreamRequest, buffer: SessionEventBuffer) -> None:
        async def send(event: str, data: dict) -> None:
            await buffer.append(event, data)

        try:
            try:
                session = self.session_store.upsert_history(request.chat_id, request.history)
                session.messages.append(ChatMessage(role="user", content=request.user_message).model_dump(exclude_none=True))
            except Exception as exc:
                await send("error", {"message": f"Session setup failed: {exc}", "code": "session_setup_failed"})
                await send("done", {"ok": False})
                return

            await send("iteration", {"current": 0, "limit": request.max_iterations})

            try:
                sandbox_adapter = self.sandbox_registry.get(request.sandbox.provider)
            except Exception as exc:
                await send("error", {"message": f"Sandbox adapter error: {exc}", "code": "sandbox_adapter_error"})
                await send("done", {"ok": False})
                return

            if session.sandbox_context is None:
                await send("status", {"state": "creating_sandbox", "label": "Creating sandbox..."})
                try:
                    session.sandbox_context = await sandbox_adapter.create(request.sandbox)
                except Exception as exc:
                    await send("error", {"message": f"Sandbox creation failed: {exc}", "code": "sandbox_create_failed"})
                    await send("done", {"ok": False})
                    return
                await send(
                    "sandbox",
                    {
                        "sandbox_id": session.sandbox_context.sandbox_id,
                        "provider": session.sandbox_context.provider,
                        "root_path": session.sandbox_context.root_path,
                    },
                )

            try:
                provider = self.provider_registry.get(request.provider)
            except Exception as exc:
                await send("error", {"message": f"Provider error: {exc}", "code": "provider_error"})
                await send("done", {"ok": False})
                return

            visible_answer_parts: list[str] = []
            visible_reasoning_parts: list[str] = []
            iteration = 0

            while iteration < request.max_iterations:
                iteration += 1
                await send("iteration", {"current": iteration, "limit": request.max_iterations})
                await send("status", {"state": "thinking", "label": "Thinking..."})

                assistant_content_parts: list[str] = []
                assistant_reasoning_parts: list[str] = []
                streamed_tool_calls: list[dict] = []
                finish_reason: Optional[str] = None

                try:
                    async for delta in provider.stream_chat_completion(
                        api_key=request.api_key,
                        model=request.model,
                        messages=self._build_provider_messages(session.messages),
                        tools=self.tool_registry.schemas,
                        base_url=request.base_url,
                    ):
                        if delta.text:
                            cleaned = self._normalize_delta(delta.text)
                            if cleaned:
                                assistant_content_parts.append(cleaned)
                                visible_answer_parts.append(cleaned)
                                await send("token", {"value": cleaned})
                        if delta.reasoning:
                            cleaned = self._normalize_delta(delta.reasoning)
                            if cleaned:
                                assistant_reasoning_parts.append(cleaned)
                                visible_reasoning_parts.append(cleaned)
                                await send("reasoning", {"value": cleaned})
                        if delta.tool_calls:
                            streamed_tool_calls = self._merge_tool_calls(streamed_tool_calls, delta.tool_calls)
                        if delta.finish_reason:
                            finish_reason = delta.finish_reason
                except Exception as exc:
                    await send(
                        "error",
                        {
                            "message": f"Provider API error: {exc}",
                            "code": "provider_api_error",
                        },
                    )
                    await send("done", {"ok": False})
                    return

                try:
                    if streamed_tool_calls or finish_reason == "tool_calls":
                        assistant_tool_message = {
                            "role": "assistant",
                            "content": "".join(assistant_content_parts) or None,
                            "tool_calls": streamed_tool_calls,
                        }
                        if assistant_reasoning_parts:
                            assistant_tool_message["reasoning_content"] = "".join(assistant_reasoning_parts)
                        session.messages.append(assistant_tool_message)

                        for tool_call in streamed_tool_calls:
                            tool_name = tool_call.get("function", {}).get("name", "unknown")
                            tool_args = tool_call.get("function", {}).get("arguments", "{}")
                            tool_payload = self._safe_json_loads(tool_args)
                            file_path = tool_payload.get("file_path")
                            command = tool_payload.get("command")
                            session_name = tool_payload.get("session_name") or tool_payload.get("session") or "default"
                            session_names = tool_payload.get("session_names")
                            list_path = tool_payload.get("path")
                            query = tool_payload.get("query")
                            url = tool_payload.get("url")
                            old_string = tool_payload.get("old_string")
                            new_string = tool_payload.get("new_string")
                            raw_input = tool_payload.get("input")
                            sub_agent = tool_payload.get("agent") if tool_name == "call_sub_agent" else None
                            await send(
                                "tool_call",
                                {
                                    "name": tool_name,
                                    "file_path": file_path,
                                    "command": command,
                                    "session": tool_payload.get("session") if tool_name == "call_sub_agent" else None,
                                    "agent": sub_agent,
                                    "session_name": session_name,
                                    "session_names": session_names,
                                    "path": list_path,
                                    "query": query,
                                    "url": url,
                                    "old_string": old_string,
                                    "new_string": new_string,
                                    "input": raw_input,
                                    "label": self._tool_label(tool_name, file_path, command, list_path, session_names, url=url, agent=sub_agent),
                                },
                            )

                            tool_task = asyncio.create_task(
                                self.tool_registry.execute(
                                    tool_name,
                                    tool_args,
                                    sandbox_adapter=sandbox_adapter,
                                    sandbox_context=session.sandbox_context,
                                    provider=provider,
                                    model=request.model,
                                    api_key=request.api_key,
                                    base_url=request.base_url,
                                    chat_id=request.chat_id,
                                    session_store=self.session_store,
                                    buffer=buffer,
                                    sub_agent_runner=self.sub_agent_runner,
                                    sub_agents=request.sub_agents,
                                    tavily_api_key=request.tavily_api_key,
                                    exa_api_key=request.exa_api_key,
                                    serpapi_api_key=request.serpapi_api_key,
                                    search_provider=request.search_provider,
                                    firecrawl_api_key=request.firecrawl_api_key,
                                )
                            )

                            try:
                                result = await tool_task
                            except Exception as exc:
                                result = {"ok": False, "error": {"code": "tool_execution_failed", "message": str(exc)}}

                            session.messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tool_call.get("id"),
                                    "name": tool_name,
                                    "content": json.dumps(result),
                                    "metadata": {"file_path": file_path},
                                }
                            )

                            await send(
                                "tool_result",
                                {
                                    "name": tool_name,
                                    "file_path": file_path,
                                    "ok": result.get("ok", False),
                                    "result": result,
                                },
                            )
                        continue

                    final_message = "".join(assistant_content_parts)
                    final_assistant_message: dict[str, Any] = {"role": "assistant", "content": final_message}
                    if assistant_reasoning_parts:
                        final_assistant_message["reasoning_content"] = "".join(assistant_reasoning_parts)
                    session.messages.append(final_assistant_message)
                    await send(
                        "message_complete",
                        {
                            "content": "".join(visible_answer_parts),
                            "iteration_count": iteration,
                            "reasoning": "".join(visible_reasoning_parts) if visible_reasoning_parts else None,
                        },
                    )

                    await send("done", {"ok": True})
                    return

                except Exception as exc:
                    await send(
                        "error",
                        {
                            "message": f"Agent loop error: {exc}",
                            "code": "agent_loop_error",
                        },
                    )
                    await send("done", {"ok": False})
                    return

            await send(
                "error",
                {
                    "message": "Iteration limit reached before the agent could finish the turn.",
                    "code": "iteration_limit_reached",
                },
            )
            await send("done", {"ok": False})
        except asyncio.CancelledError:
            await send("done", {"ok": False})
            raise
        finally:
            buffer.set_done()

    async def stream_sse(self, chat_id: str, since_event_id: int = -1) -> AsyncGenerator[str, None]:
        session = self.session_store.get(chat_id)
        if not session or not session.event_buffer:
            yield self._sse("error", {"message": "No active session or event buffer.", "code": "no_session"})
            yield self._sse("done", {"ok": False})
            return

        async for event_data in session.event_buffer.subscribe(since_event_id):
            yield self._sse(event_data["event"], event_data["data"])

    def _build_provider_messages(self, messages: list[dict]) -> list[dict]:
        built_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for message in messages:
            built: dict = {"role": message["role"]}
            if message.get("content") is not None:
                built["content"] = message.get("content")
            if message.get("reasoning_content") is not None:
                built["reasoning_content"] = message.get("reasoning_content")
            if message.get("tool_calls") is not None:
                built["tool_calls"] = message.get("tool_calls")
            if message.get("tool_call_id") is not None:
                built["tool_call_id"] = message.get("tool_call_id")
            if message.get("name") is not None:
                built["name"] = message.get("name")
            built_messages.append(built)
        return built_messages

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

    def _tool_label(self, tool_name: str, file_path: Optional[str], command: Optional[str] = None, list_path: Optional[str] = None, session_names: Optional[list[str]] = None, url: Optional[str] = None, **kwargs) -> str:
        if tool_name == "call_sub_agent":
            return f"Sub-Agent: {kwargs.get('agent', 'unknown')}"
        if tool_name == "list_sub_agents":
            return "List Sub-Agents"
        if tool_name == "shall_tool":
            return f"Terminal: {command or 'unknown'}"
        if tool_name == "shell_view":
            sessions = ", ".join(session_names) if session_names else "unknown"
            return f"Shell View: {sessions}"
        if tool_name == "list_files":
            return f"List: {list_path or 'unknown'}"
        if tool_name == "web_search":
            return f"Web Search"
        if tool_name == "fatch_web_urls":
            return f"Fetch: {url or 'url'}"
        if tool_name == "apply_patch":
            return f"Apply Patch"
        if tool_name == "str_replace":
            return f"Edit: {file_path or 'unknown'}"
        prefix = "Create" if tool_name == "file_write" else "Read"
        return f"{prefix}: {file_path or 'unknown'}"

    def _normalize_delta(self, text: str) -> str:
        return text.replace("\r\n", "\n")

    def _sse(self, event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"
