from __future__ import annotations

from typing import Any

from src.schemas.sandbox import ToolExecutionResult


CALL_SUB_AGENT_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "call_sub_agent",
        "description": "Call a specialized sub-agent to perform a specific task within a given session and return the result. Use this tool when a dedicated sub-agent is better suited for the requested work or for completing the task faster.",
        "parameters": {
            "type": "object",
            "properties": {
                "session": {
                    "type": "string",
                    "description": "The unique session identifier where the sub-agent should execute. Use this to target an existing agent session."
                },
                "agent": {
                    "type": "string",
                    "description": "The name of the specialized sub-agent to execute the task."
                },
                "task": {
                    "type": "string",
                    "description": "A clear and detailed description of the task that the selected sub-agent should complete."
                }
            },
            "required": ["session", "agent", "task"]
        }
    }
}


async def execute_call_sub_agent(*, arguments: dict[str, Any], sandbox_adapter, sandbox_context, **kwargs) -> ToolExecutionResult:
    session_name = arguments.get("session")
    agent_name = arguments.get("agent")
    task = arguments.get("task")

    if not all([session_name, agent_name, task]):
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "missing_parameters",
                "message": "session, agent, and task are required.",
            },
        )

    sub_agents = kwargs.get("sub_agents", [])
    agent_config = None
    for sa in sub_agents:
        if sa.get("name") == agent_name and sa.get("enabled", True):
            agent_config = sa
            break

    if not agent_config:
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "agent_not_found",
                "message": f"Sub-agent '{agent_name}' not found or not enabled.",
            },
        )

    sub_agent_runner = kwargs.get("sub_agent_runner")
    if not sub_agent_runner:
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "sub_agent_runner_not_available",
                "message": "Sub-agent runner is not available.",
            },
        )

    buffer = kwargs.get("buffer")
    if not buffer:
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "buffer_not_available",
                "message": "Event buffer is not available.",
            },
        )

    chat_id = kwargs.get("chat_id", "")
    provider = kwargs.get("provider")
    model = kwargs.get("model", "")
    api_key = kwargs.get("api_key", "")
    base_url = kwargs.get("base_url", "")

    try:
        final_output = await sub_agent_runner.run(
            chat_id=chat_id,
            session_name=session_name,
            agent_config=agent_config,
            task=task,
            sandbox_adapter=sandbox_adapter,
            sandbox_context=sandbox_context,
            buffer=buffer,
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
            tavily_api_key=kwargs.get("tavily_api_key"),
            exa_api_key=kwargs.get("exa_api_key"),
            serpapi_api_key=kwargs.get("serpapi_api_key"),
            search_provider=kwargs.get("search_provider"),
            firecrawl_api_key=kwargs.get("firecrawl_api_key"),
        )

        return ToolExecutionResult(
            ok=True,
            data={
                "session": session_name,
                "agent": agent_name,
                "output": final_output,
            },
        )
    except Exception as exc:
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "sub_agent_failed",
                "message": str(exc),
            },
        )
