from __future__ import annotations

from typing import Any

from src.schemas.sandbox import ToolExecutionResult


LIST_SUB_AGENTS_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "list_sub_agents",
        "description": "Returns a list of all available sub-agents that have been created by the user and are currently enabled. Use this to discover which sub-agents can be called.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
}


async def execute_list_sub_agents(*, arguments: dict[str, Any], **kwargs) -> ToolExecutionResult:
    sub_agents = kwargs.get("sub_agents", [])
    available = []
    for sa in sub_agents:
        if sa.get("enabled", True):
            available.append({
                "name": sa.get("name", ""),
                "description": sa.get("description", ""),
            })

    return ToolExecutionResult(
        ok=True,
        data={
            "available_sub_agents": available,
        },
    )
