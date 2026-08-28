import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types";
import { ToolChip } from "./ToolChip";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { cn } from "@/utils/cn";

export function MessageItem({ message }: { message: ChatMessage }) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end fade-in">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--color-accent)] px-4 py-2.5 text-sm text-white shadow-lg shadow-[var(--color-accent)]/10">
          {message.content}
        </div>
      </div>
    );
  }

  const hasContent = message.content.trim().length > 0;
  const showThinking = message.streaming && !hasContent && (message.tools?.length ?? 0) === 0;

  return (
    <div className="flex gap-3 fade-in">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)]">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.reasoning && message.reasoning.trim().length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", showReasoning && "rotate-90")}
              />
              Reasoning
            </button>
            {showReasoning && (
              <div className="whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed text-[var(--color-muted)]">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {(message.tools?.length ?? 0) > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {message.tools!.map((tool) => (
              <ToolChip key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {showThinking && <ThinkingIndicator />}

        {hasContent && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-fg)]",
              message.streaming && "caret",
            )}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
