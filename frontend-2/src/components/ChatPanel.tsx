"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useChatStream } from "@/hooks/useChatStream";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

export function ChatPanel() {
  const conversations = useStore((s) => s.conversations);
  const currentId = useStore((s) => s.currentId);
  const bumpFiles = useStore((s) => s.bumpFiles);
  const { send, stop } = useChatStream(bumpFiles);

  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentId);
    return conv?.messages ?? [];
  }, [conversations, currentId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </div>
      <Composer onSend={send} onStop={stop} />
    </div>
  );
}
