from __future__ import annotations

from src.agents.sandbox.base import SandboxContext
from src.schemas.sandbox import ToolExecutionResult

FILE_WRITE_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "file_write",
        "description": "Create or overwrite a file at the given path inside the sandbox. Use for creating new files or fully rewriting existing ones.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Absolute path starting with /home/user/. Example: /home/user/project/src/App.tsx"
                },
                "content": {
                    "type": "string",
                    "description": "The full content to write to the file."
                }
            },
            "required": ["file_path", "content"]
        }
    }
}


async def execute_file_write(*, sandbox_adapter, sandbox_context: SandboxContext, arguments: dict, **kwargs) -> ToolExecutionResult:
    try:
        file_path = arguments["file_path"]
        content = arguments["content"]
        
        # Calculate the number of lines in the content
        line_count = content.count('\n') + (1 if content and not content.endswith('\n') else 0)
        
        data = await sandbox_adapter.write_file(sandbox_context, file_path, content)
        
        # Add line_count to the returned data
        if isinstance(data, dict):
            data["line_count"] = line_count
        else:
            data = {"line_count": line_count, "result": data}
        
        return ToolExecutionResult(ok=True, data=data)
    except Exception as exc:
        return ToolExecutionResult(
            ok=False,
            error={
                "code": "file_write_failed",
                "message": str(exc),
                "file_path": arguments.get("file_path"),
            },
        )