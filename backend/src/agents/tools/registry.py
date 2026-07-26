from __future__ import annotations

import json
from typing import Any

from src.agents.tools.call_sub_agent import CALL_SUB_AGENT_TOOL_SCHEMA, execute_call_sub_agent
from src.agents.tools.fatch_web_urls import FETCH_WEB_URLS_TOOL_SCHEMA, execute_fatch_web_urls
from src.agents.tools.file_read import FILE_READ_TOOL_SCHEMA, execute_file_read
from src.agents.tools.file_write import FILE_WRITE_TOOL_SCHEMA, execute_file_write
from src.agents.tools.list_files import LIST_FILES_TOOL_SCHEMA, execute_list_files
from src.agents.tools.list_sub_agents import LIST_SUB_AGENTS_TOOL_SCHEMA, execute_list_sub_agents
from src.agents.tools.shall_tool import SHALL_TOOL_SCHEMA, execute_shall_tool
from src.agents.tools.shell_view import SHELL_VIEW_TOOL_SCHEMA, execute_shell_view
from src.agents.tools.apply_patch import APPLY_PATCH_TOOL_SCHEMA, execute_apply_patch
from src.agents.tools.str_replace import STR_REPLACE_TOOL_SCHEMA, execute_str_replace
from src.agents.tools.web_search_tool import WEB_SEARCH_TOOL_SCHEMA, execute_web_search


class ToolRegistry:
    def __init__(self) -> None:
        self._schemas = [
            CALL_SUB_AGENT_TOOL_SCHEMA,
            LIST_SUB_AGENTS_TOOL_SCHEMA,
            FILE_WRITE_TOOL_SCHEMA,
            FILE_READ_TOOL_SCHEMA,
            APPLY_PATCH_TOOL_SCHEMA,
            SHALL_TOOL_SCHEMA,
            STR_REPLACE_TOOL_SCHEMA,
            LIST_FILES_TOOL_SCHEMA,
            SHELL_VIEW_TOOL_SCHEMA,
            WEB_SEARCH_TOOL_SCHEMA,
            FETCH_WEB_URLS_TOOL_SCHEMA,
        ]
        self._handlers = {
            "call_sub_agent": execute_call_sub_agent,
            "list_sub_agents": execute_list_sub_agents,
            "file_write": execute_file_write,
            "file_read": execute_file_read,
            "apply_patch": execute_apply_patch,
            "shall_tool": execute_shall_tool,
            "str_replace": execute_str_replace,
            "list_files": execute_list_files,
            "shell_view": execute_shell_view,
            "web_search": execute_web_search,
            "fatch_web_urls": execute_fatch_web_urls,
        }

    @property
    def schemas(self) -> list[dict[str, Any]]:
        return self._schemas

    async def execute(
        self,
        tool_name: str,
        arguments: str | dict[str, Any],
        *,
        sandbox_adapter,
        sandbox_context,
        **extra_kwargs,
    ):
        if tool_name not in self._handlers:
            return {
                "ok": False,
                "error": {
                    "code": "unknown_tool",
                    "message": f"Unknown tool: {tool_name}",
                },
            }

        try:
            if isinstance(arguments, str):
                parsed_arguments = json.loads(arguments or "{}")
            else:
                parsed_arguments = arguments
        except json.JSONDecodeError as exc:
            return {
                "ok": False,
                "error": {
                    "code": "invalid_arguments",
                    "message": f"Failed to parse tool arguments: {exc}",
                    "raw": arguments,
                },
            }

        try:
            result = await self._handlers[tool_name](
                sandbox_adapter=sandbox_adapter,
                sandbox_context=sandbox_context,
                arguments=parsed_arguments,
                **extra_kwargs,
            )
            return result.model_dump(exclude_none=True)
        except Exception as exc:
            return {
                "ok": False,
                "error": {
                    "code": "tool_handler_error",
                    "message": f"Tool '{tool_name}' execution failed: {exc}",
                },
            }