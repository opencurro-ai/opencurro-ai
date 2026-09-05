import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/utils/cn";
import { ToolChip } from "./ToolChip";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { SubmitPlanBlock } from "./SubmitPlanBlock";
import { AskQuestionBlock } from "./AskQuestionBlock";

function MessageItemImpl({ message }: { message: ChatMessage }) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end fade-in">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[var(--radius-lg)] rounded-br-md bg-[var(--secondary)] px-4 py-2.5 text-sm leading-relaxed text-[var(--secondary-fg)]">
          {message.content}
        </div>
      </div>
    );
  }

  const tools = message.tools ?? [];
  // submit_plan / ask_question_to_user render as full-width blocks, not inline chips.
  const blockTools = tools.filter(
    (t) => t.name === "submit_plan" || t.name === "ask_question_to_user",
  );
  const chipTools = tools.filter(
    (t) => t.name !== "submit_plan" && t.name !== "ask_question_to_user",
  );

  const hasContent = message.content.trim().length > 0;
  const showThinking = message.streaming && !hasContent && tools.length === 0;

  return (
    <div className="flex gap-3 fade-in">
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--secondary)] text-[var(--secondary-fg)]"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.9" />
        </svg>
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {message.teamAgent && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-2.5 py-1 text-xs font-medium text-[var(--fg)]">
              {message.teamAgent.name}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  message.teamAgent.role === "head"
                    ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
                    : "border border-[var(--border)] text-[var(--muted)]",
                )}
              >
                {message.teamAgent.role === "head" ? "Leader" : "Member"}
              </span>
            </span>
          </div>
        )}

        {message.reasoning && message.reasoning.trim().length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--chip)]">
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", showReasoning && "rotate-90")}
              />
              Reasoning
            </button>
            {showReasoning && (
              <div className="whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed text-[var(--muted)]">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {chipTools.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {chipTools.map((tool) => (
              <ToolChip key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {blockTools.map((tool) =>
          tool.name === "submit_plan" ? (
            <SubmitPlanBlock key={tool.id} tool={tool} />
          ) : (
            <AskQuestionBlock key={tool.id} tool={tool} />
          ),
        )}

        {showThinking && <ThinkingIndicator />}

        {hasContent && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--fg)]",
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

export const MessageItem = memo(MessageItemImpl);
