"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types";
import { MessageItem } from "./MessageItem";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastLen = messages.reduce((n, m) => n + m.content.length + (m.tools?.length ?? 0), 0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastLen]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)]">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Curro AI</h2>
          <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
            Your autonomous local coding agent. Ask it to build, edit, or run code — it works
            directly in your workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      {messages.map((m) => (
        <MessageItem key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
