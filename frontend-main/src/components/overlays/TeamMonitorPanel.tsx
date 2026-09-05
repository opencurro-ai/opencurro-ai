import { Loader2, Check, X, Circle, Clock, Users, ArrowRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import type { TeamAgentStatus, TeamMessageLogEntry } from "@/types";

/** Live monitoring panel for the active multi-agent team run: agent statuses, the queue, and the
 * inter-agent message flow. This is the inspection surface for what the team is doing. */
export function TeamMonitorPanel() {
  const open = useStore((s) => s.teamMonitorOpen);
  const setOpen = useStore((s) => s.setTeamMonitorOpen);
  const live = useStore((s) => s.teamLive);

  const agents = live ? live.order.map((id) => live.agents[id]).filter(Boolean) : [];
  const head = agents.find((a) => a.role === "head");
  const members = agents.filter((a) => a.role === "member");
  const working = agents.filter((a) => a.status === "working").length;
  const queued = agents.filter((a) => a.status === "queued").length;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      align="top"
      size="lg"
      icon={<Users className="h-4 w-4" />}
      title={live ? `Team monitor — ${live.teamName}` : "Team monitor"}
    >
      <div className="space-y-5 p-5">
        {!live ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] py-12 text-center">
            <Users className="h-8 w-8 text-[var(--subtle)]" />
            <p className="max-w-sm text-sm text-[var(--muted)]">
              No team run yet. Enable multi-agent mode and send a message — the team's activity will
              appear here live.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <StatusChip label={live.active ? "Running" : "Finished"} active={live.active} />
              <span className="rounded-full bg-[var(--chip)] px-2 py-1">{working} working</span>
              <span className="rounded-full bg-[var(--chip)] px-2 py-1">{queued} queued</span>
              <span className="rounded-full bg-[var(--chip)] px-2 py-1">
                {live.totalMessages} message{live.totalMessages === 1 ? "" : "s"}
              </span>
              {live.messagingEnabled && (
                <span className="rounded-full bg-[var(--chip)] px-2 py-1">agent↔agent on</span>
              )}
            </div>

            {live.notices.length > 0 && (
              <div className="space-y-1.5">
                {live.notices.map((n, i) => (
                  <p
                    key={i}
                    className="rounded-[var(--radius-md)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]"
                  >
                    {n.message}
                  </p>
                ))}
              </div>
            )}

            {/* Agents */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Agents
              </h3>
              <ul className="space-y-1.5">
                {head && <AgentRow agent={head} />}
                {members.map((a) => (
                  <AgentRow key={a.id} agent={a} />
                ))}
                {agents.length === 0 && (
                  <li className="text-xs text-[var(--subtle)]">Starting up…</li>
                )}
              </ul>
            </section>

            {/* Message flow */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Message flow
              </h3>
              {live.messages.length === 0 ? (
                <p className="text-xs text-[var(--subtle)]">No inter-agent messages yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {live.messages.slice(-60).map((m) => (
                    <MessageRow key={m.id} entry={m} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function AgentRow({
  agent,
}: {
  agent: { id: string; name: string; role: "head" | "member"; status: TeamAgentStatus; queued: number; runs: number };
}) {
  return (
    <li className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
      <StatusIcon status={agent.status} />
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
        {agent.name}
        <span
          className={cn(
            "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            agent.role === "head"
              ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
              : "border border-[var(--border)] text-[var(--muted)]",
          )}
        >
          {agent.role === "head" ? "Leader" : "Member"}
        </span>
      </span>
      {agent.queued > 0 && (
        <span className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
          {agent.queued} queued
        </span>
      )}
      <span className="text-[10px] capitalize text-[var(--subtle)]">{agent.status}</span>
    </li>
  );
}

function MessageRow({ entry }: { entry: TeamMessageLogEntry }) {
  const kindLabel: Record<TeamMessageLogEntry["kind"], string> = {
    delegate: "task",
    report: "report",
    team_message: "message",
    user: "user",
  };
  return (
    <li className="rounded-[var(--radius-md)] bg-[var(--chip)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <span className="font-medium text-[var(--fg)]">{entry.fromName}</span>
        <ArrowRight className="h-3 w-3" />
        <span className="font-medium text-[var(--fg)]">{entry.toId}</span>
        <span className="ml-1 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[9px] uppercase">
          {kindLabel[entry.kind]}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{entry.message}</p>
    </li>
  );
}

function StatusIcon({ status }: { status: TeamAgentStatus }) {
  if (status === "working")
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--secondary)]" />;
  if (status === "queued") return <Clock className="h-4 w-4 shrink-0 text-[var(--warning)]" />;
  if (status === "done") return <Check className="h-4 w-4 shrink-0 text-[var(--success)]" />;
  if (status === "failed") return <X className="h-4 w-4 shrink-0 text-[var(--danger)]" />;
  return <Circle className="h-4 w-4 shrink-0 text-[var(--subtle)]" />;
}

function StatusChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium",
        active ? "bg-[var(--secondary)] text-[var(--secondary-fg)]" : "bg-[var(--chip)] text-[var(--muted)]",
      )}
    >
      {active && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}
