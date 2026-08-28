import { useState } from "react";
import { HelpCircle, Loader2, Send, Timer } from "lucide-react";
import type { AskQuestionInfo, ToolActivity } from "@/types";
import { submitAnswers } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";

const STATUS_LABELS: Record<AskQuestionInfo["status"], string> = {
  pending: "Awaiting your answers",
  answered: "Answers submitted — the agent is continuing",
  timeout: "No response received — the agent continued independently",
};

/**
 * The big inline block for the ask_question_to_user tool. Renders each question the agent
 * asked with its context and predefined options. The user selects one option per question (or
 * types a custom answer) and clicks Send; the answers are posted back to the backend and the
 * agent continues using them.
 */
export function AskQuestionBlock({ tool }: { tool: ToolActivity }) {
  const info = tool.ask;
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [usingCustom, setUsingCustom] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  if (!info) {
    return (
      <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-4 text-sm text-[var(--color-muted)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent-2)]" />
          Waiting for the questions…
        </div>
      </div>
    );
  }

  const decided = info.status !== "pending";
  const questions = info.questions;

  const answerFor = (index: number): string => {
    if (usingCustom[index]) return custom[index] ?? "";
    return selected[index] ?? "";
  };

  const allAnswered = questions.every((_, i) => answerFor(i).trim().length > 0);

  const submit = async () => {
    if (saving || !allAnswered) return;
    setSaving(true);
    const answers = questions.map((q, i) => ({
      question: q.question,
      answer: answerFor(i).trim(),
    }));
    const ok = await submitAnswers(info.chatId, info.id, answers);
    // Only flip the UI when the backend actually accepted the answers. If it was already
    // decided (timeout raced the click), the incoming tool_result event owns the status.
    if (ok) {
      useStore.getState().updateQuestionForTool(info.id, { status: "answered" });
    }
    setSaving(false);
  };

  const selectOption = (index: number, option: string) => {
    setUsingCustom((prev) => ({ ...prev, [index]: false }));
    setSelected((prev) => ({ ...prev, [index]: option }));
  };

  const toggleCustom = (index: number) => {
    setUsingCustom((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 fade-in">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elev2)]/50 px-4 py-3">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--color-fg)]">
          <HelpCircle className="h-4 w-4 text-[var(--color-accent)]" />
          Questions
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            info.status === "pending"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : info.status === "answered"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-[var(--color-border)] text-[var(--color-muted)]",
          )}
        >
          {info.status === "timeout" ? (
            <Timer className="h-3.5 w-3.5" />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" />
          )}
          {STATUS_LABELS[info.status]}
        </span>
      </div>

      <div className="space-y-4 px-4 py-3">
        {questions.map((q, index) => (
          <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Question {index + 1} of {questions.length}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--color-fg)]">{q.question}</div>
            {q.context && (
              <div className="mt-1 leading-relaxed text-xs text-[var(--color-muted)]">{q.context}</div>
            )}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {q.options.map((option, oi) => {
                const active = usingCustom[index] ? false : selected[index] === option;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={decided || saving}
                    onClick={() => selectOption(index, option)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-60",
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-fg)] enabled:hover:border-[var(--color-accent)]/60 enabled:hover:text-[var(--color-accent)]",
                    )}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />}
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={decided || saving}
                onClick={() => toggleCustom(index)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs transition disabled:opacity-60",
                  usingCustom[index]
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] enabled:hover:border-[var(--color-accent)]/60 enabled:hover:text-[var(--color-accent)]",
                )}
              >
                {usingCustom[index] ? "Use a provided option" : "Write a custom answer"}
              </button>

              {usingCustom[index] && (
                <input
                  type="text"
                  value={custom[index] ?? ""}
                  disabled={decided || saving}
                  onChange={(e) => setCustom((prev) => ({ ...prev, [index]: e.target.value }))}
                  placeholder="Type your answer…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 px-3 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/60"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-elev2)]/30 px-4 py-3">
        {decided || saving ? (
          <span className="text-xs text-[var(--color-muted)]">
            {saving ? "Submitting…" : STATUS_LABELS[info.status]}
          </span>
        ) : (
          <button
            type="button"
            disabled={saving || !allAnswered}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition enabled:hover:brightness-110 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send{questions.length > 1 ? ` (${questions.length} questions)` : ""}
          </button>
        )}
      </div>
    </div>
  );
}