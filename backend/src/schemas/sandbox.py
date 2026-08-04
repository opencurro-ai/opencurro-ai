from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SandboxSettings(BaseModel):
    api_key: str = Field(min_length=1)
    template_id: Optional[str] = None
    provider: Literal["novita"] = "novita"
    timeout_seconds: int = Field(default=3600, ge=60, le=60 * 60 * 24)


class FileInfoModel(BaseModel):
    name: str
    type: str
    path: str
    size: Optional[int] = None
    mode: Optional[int] = None
    permissions: Optional[str] = None
    owner: Optional[str] = None
    group: Optional[str] = None
    modified_time: Optional[str] = None
    symlink_target: Optional[str] = None


class FileTreeNode(BaseModel):
    name: str
    path: str
    type: Literal["file", "dir"]
    size: Optional[int] = None
    modified_time: Optional[str] = None
    children: list["FileTreeNode"] = Field(default_factory=list)


class ToolExecutionResult(BaseModel):
    ok: bool
    data: Optional[Any] = None
    error: Optional[dict[str, Any]] = None