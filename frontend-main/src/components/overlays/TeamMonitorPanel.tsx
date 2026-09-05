import { ArrowRight, Crown, Loader2, Radio, User, Users } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { TeamAgentStatus, TeamAgentStatusEntry, TeamMessageLog } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

const STATUS_TONE: Record<TeamAgentStatus, string> = {
  running: "border-[var(--secondary)] text-[var(--secondary)]",
  queued: "border-[color:color-mix(in_oklab,var(--warning)_35%,transparent)] text-[var(--warning)]",
  completed: "border-[color:color-mix(in_oklab,var(--success)_35%,transparent)] text-[var(--success)]",
  failed: "border-[color:color-mix(in_oklab,var(--danger)_35%,transparent)] text-[var(--danger)]",
  idle: "border-[var(--border)] text-[var(--muted)]",
};

function AgentRow({ agent }: { agent: TeamAgentStatusEntry }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
      {agent.role === "head" ? (
        <Crown className="h-4 w-4 shrink-0 text-[var(--secondary)]" />
      ) : (
        <User className="h-4 w-4 shrink-0 text-[var(--muted)]" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">{agent.name}</span>
      {agent.queued > 0 && (
        <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          {agent.queued} queued
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] capitalize",
          STATUS_TONE[agent.status],
        )}
      >
        {agent.status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
        {agent.status}
      </span>
    </div>
  );
}

function MessageRow({ message }: { message: TeamMessageLog }) {
  const isSystem = message.fromId === "system";
  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-2.5">
      {!isSystem && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <span className="font-medium text-[var(--fg)]">{message.fromName}</span>
          <ArrowRight className="h-3 w-3" />
          <span className="font-medium text-[var(--fg)]">{message.toName}</span>
          <span
            className={cn(
              "ml-1 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
              message.kind === "task"
                ? "border-[var(--secondary)] text-[var(--secondary)]"
                : "border-[var(--border)] text-[var(--subtle)]",
            )}
          >
            {message.kind}
          </span>
        </div>
      )}
      <p className={cn("m-0 whitespace-pre-wrap break-words text-xs leading-relaxed", isSystem ? "text-[var(--danger)]" : "text-[var(--muted)]")}>
        {message.message.length > 600 ? `${message.message.slice(0, 600)}…` : message.message}
      </p>
    </li>
  );
}

export function TeamMonitorPanel() {
  const open = useStore((s) => s.teamMonitorOpen);
  const setOpen = useStore((s) => s.setTeamMonitorOpen);
  const agents = useStore((s) => s.teamStatus);
  const messages = useStore((s) => s.teamMessages);
  const pending = useStore((s) => s.teamPending);
  const activations = useStore((s) => s.teamActivations);

  const running = agents.filter((a) => a.status === "running").length;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      align="top"
      size="lg"
      icon={<Users className="h-4 w-4" />}
      title={
        <span className="flex items-center gap-2">
          Team monitor
          <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--muted)]">
            {running} running · {pending} in flight · {activations} activations
          </span>
        </span>
      }
    >
      <div className="space-y-5 p-5">
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            <Radio className="h-3.5 w-3.5" /> Agents
          </h3>
          {agents.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />}>
              No team run yet. Enable multi-agent mode and send a message to see the team work here.
            </EmptyState>
          ) : (
            <div className="space-y-1.5">
              {agents.map((a) => (
                <AgentRow key={a.id} agent={a} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            <ArrowRight className="h-3.5 w-3.5" /> Message queue &amp; activity
          </h3>
          {messages.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No inter-agent messages yet.</p>
          ) : (
            <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto">
              {messages.reduceRight<TeamMessageLog[]>((acc, m) => (acc.push(m), acc), []).map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
