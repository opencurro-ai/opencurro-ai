import { useState } from "react";
import { ChevronRight, Crown, Loader2, User, Users } from "lucide-react";
import type { TeamActivation, TeamRun } from "@/types";
import { cn } from "@/utils/cn";
import { ToolChip } from "./ToolChip";

/**
 * Renders a full multi-agent team run inside an assistant message: the team header, then each agent
 * activation (head + members) as its own block in chronological order — streaming reasoning, tool
 * calls, and output live, exactly like a real agent. The head and members appear directly in the
 * chat (they are real agents, not sub-agents hidden behind a chip).
 */
export function TeamRunView({ run }: { run: TeamRun }) {
  const activations = run.order
    .map((id) => run.activations[id])
    .filter((a): a is TeamActivation => Boolean(a));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Users className="h-3.5 w-3.5 text-[var(--secondary)]" />
        <span className="font-medium text-[var(--fg)]">{run.teamName}</span>
        <span className="text-[var(--subtle)]">
          · led by {run.headName} · {run.members.length} member{run.members.length === 1 ? "" : "s"}
        </span>
      </div>

      {activations.map((activation) => (
        <ActivationBlock key={activation.id} activation={activation} />
      ))}
    </div>
  );
}

function ActivationBlock({ activation }: { activation: TeamActivation }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isHead = activation.role === "head";
  const hasContent = activation.content.trim().length > 0;
  const working = activation.status === "running";

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border p-3",
        isHead
          ? "border-[color:color-mix(in_oklab,var(--secondary)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--secondary)_5%,transparent)]"
          : "border-[var(--border)] bg-[var(--bg)]",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full",
            isHead
              ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
              : "bg-[var(--chip)] text-[var(--muted)]",
          )}
        >
          {isHead ? <Crown className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm font-semibold text-[var(--fg)]">{activation.name}</span>
        <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          {isHead ? "team leader" : "member"}
        </span>
        {activation.trigger && (
          <span className="truncate text-[10px] text-[var(--subtle)]">· {activation.trigger}</span>
        )}
        {working && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[var(--secondary)]" />}
      </div>

      <div className="space-y-2 pl-8">
        {activation.reasoning.trim().length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius-md)] bg-[var(--chip)]">
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showReasoning && "rotate-90")} />
              Reasoning
            </button>
            {showReasoning && (
              <div className="whitespace-pre-wrap px-3 pb-2.5 text-xs leading-relaxed text-[var(--muted)]">
                {activation.reasoning}
              </div>
            )}
          </div>
        )}

        {activation.tools.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {activation.tools.map((tool) => (
              <ToolChip key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {hasContent ? (
          <div
            className={cn(
              "whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--fg)]",
              working && "caret",
            )}
          >
            {activation.content}
          </div>
        ) : working && activation.tools.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
          </div>
        ) : null}

        {activation.error && <div className="text-xs text-[var(--danger)]">⚠️ {activation.error}</div>}
      </div>
    </div>
  );
}
