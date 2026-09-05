import { useState } from "react";
import { Activity, ChevronRight, Crown, Loader2, User } from "lucide-react";
import type { ChatMessage, TeamAgentRun } from "@/types";
import { cn } from "@/utils/cn";
import { ToolChip } from "./ToolChip";

/** Small colored dot + label reflecting a team agent's live status. */
function StatusPill({ run }: { run: TeamAgentRun }) {
  const status = run.status === "error" ? "error" : (run.liveStatus ?? "idle");
  const map: Record<string, { label: string; className: string }> = {
    working: { label: "working", className: "bg-[var(--secondary)] text-[var(--secondary-fg)]" },
    queued: { label: "queued", className: "bg-[var(--chip)] text-[var(--muted)]" },
    idle: { label: "idle", className: "bg-[var(--chip)] text-[var(--subtle)]" },
    stopped: { label: "stopped", className: "bg-[var(--chip)] text-[var(--subtle)]" },
    unknown: { label: "…", className: "bg-[var(--chip)] text-[var(--subtle)]" },
    error: { label: "error", className: "bg-[var(--danger-soft)] text-[var(--danger)]" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", s.className)}>
      {status === "working" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {s.label}
    </span>
  );
}

function AgentBlock({ run }: { run: TeamAgentRun }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isHead = run.role === "head";
  const hasOutput = run.output.trim().length > 0;
  const working = (run.liveStatus ?? "idle") === "working" && run.status === "running";

  return (
    <div className="fade-in">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full",
            isHead
              ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
              : "bg-[var(--chip)] text-[var(--fg)]",
          )}
          aria-hidden
        >
          {isHead ? <Crown className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm font-semibold text-[var(--fg)]">{run.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--subtle)]">
          {isHead ? "leader" : "member"}
        </span>
        <StatusPill run={run} />
      </div>

      <div className="ml-8 min-w-0 space-y-2">
        {run.reasoning.trim().length > 0 && (
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
                {run.reasoning}
              </div>
            )}
          </div>
        )}

        {run.tools.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            {run.tools.map((tool) => (
              <ToolChip key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {hasOutput && (
          <div
            className={cn(
              "whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--fg)]",
              working && "caret",
            )}
          >
            {run.output}
          </div>
        )}

        {run.error && <p className="text-xs text-[var(--danger)]">⚠️ {run.error}</p>}
      </div>
    </div>
  );
}

/** The collapsible team monitor: routed messages + live statuses. */
function TeamMonitor({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const messages = message.teamMessages ?? [];
  const runs = message.teamOrder?.map((id) => message.teamRuns?.[id]).filter(Boolean) as TeamAgentRun[] | undefined;

  if (messages.length === 0 && (!runs || runs.length === 0)) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
      >
        <Activity className="h-3.5 w-3.5" />
        Team monitor
        <span className="text-[var(--subtle)]">
          ({messages.length} message{messages.length === 1 ? "" : "s"})
        </span>
        <ChevronRight className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-2.5">
          {runs && runs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {runs.map((r) => (
                <span
                  key={r.agentId}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                >
                  {r.role === "head" ? <Crown className="h-2.5 w-2.5 text-[var(--secondary)]" /> : null}
                  {r.name}
                  <span className="text-[var(--subtle)]">· {r.liveStatus ?? "idle"}</span>
                  {r.queued ? <span className="text-[var(--subtle)]">· {r.queued} queued</span> : null}
                </span>
              ))}
            </div>
          )}
          {messages.length > 0 && (
            <ul className="space-y-1.5">
              {messages.map((m, i) => (
                <li key={i} className="text-xs leading-relaxed text-[var(--muted)]">
                  <span className="font-medium text-[var(--fg)]">{m.fromLabel}</span>
                  <span className="text-[var(--subtle)]"> → </span>
                  <span className="font-medium text-[var(--fg)]">{m.toLabel}</span>
                  <span className="text-[var(--subtle)]">: </span>
                  <span className="line-clamp-2">{m.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Render a multi-agent team turn: one streaming block per agent + a team monitor. */
export function TeamRunView({ message }: { message: ChatMessage }) {
  const order = message.teamOrder ?? [];
  const runs = order.map((id) => message.teamRuns?.[id]).filter(Boolean) as TeamAgentRun[];

  return (
    <div className="min-w-0 flex-1 space-y-5">
      {message.teamName && (
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--subtle)]">
          <Activity className="h-3.5 w-3.5" /> Team · {message.teamName}
        </div>
      )}
      {runs.map((run) => (
        <AgentBlock key={run.agentId} run={run} />
      ))}
      <TeamMonitor message={message} />
    </div>
  );
}
