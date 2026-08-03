from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from src.schemas.chat import ChatMessage


@dataclass
class ChatSessionState:
    chat_id: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    sandbox_context: Optional[Any] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    event_buffer: Optional[Any] = None
    agent_task: Optional[asyncio.Task] = None
    code_server_task: Optional[asyncio.Task] = None

    def hydrate(self, history: list[ChatMessage]) -> None:
        if history:
            self.messages = [message.model_dump(exclude_none=True) for message in history]
            self.updated_at = datetime.utcnow()


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, ChatSessionState] = {}

    def get_or_create(self, chat_id: str) -> ChatSessionState:
        if chat_id not in self._sessions:
            self._sessions[chat_id] = ChatSessionState(chat_id=chat_id)
        return self._sessions[chat_id]

    def upsert_history(self, chat_id: str, history: list[ChatMessage]) -> ChatSessionState:
        session = self.get_or_create(chat_id)
        session.hydrate(history)
        return session

    def get(self, chat_id: str) -> Optional[ChatSessionState]:
        return self._sessions.get(chat_id)

    def delete(self, chat_id: str) -> None:
        self._sessions.pop(chat_id, None)