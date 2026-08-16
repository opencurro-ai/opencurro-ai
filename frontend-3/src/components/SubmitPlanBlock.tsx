import { useState } from "react";
import { Check, ClipboardList, Loader2, PencilLine, PencilOff, X, Timer } from "lucide-react";
import type { PlanApprovalInfo, ToolActivity } from "@/types";
import { decidePlan } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";

const STATUS_LABELS: Record<PlanApprovalInfo["status"], string> = {
  pending: "Awaiting your review",
  approved: "Approved — the agent is starting the task",
  canceled: "Canceled — the agent will retry",
  edited: "Approved with your edits — the agent is starting the task",
  timeout: "No response received — the agent continued independently",
};

const STATUS_BADGE: Record<PlanApprovalInfo["status"], { icon: string; className: string }> = {
  pending: { icon: "clock", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  approved: { icon: "check", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  canceled: { icon: "x", className: "border-red-500/40 bg-red-500/10 text-red-300" },
  edited: { icon: "pencil", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  timeout: { icon: "timer", className: "border-[var(--color-border)] text-[var(--color-muted)]" },
};

function StatusIcon({ status }: { status: PlanApprovalInfo["status"] }) {
  const badge = STATUS_BADGE[status];
  switch (badge.icon) {
    case "check":
      return <Check className="h-3.5 w-3.5" />;
    case "x":
      return <X className="h-3.5 w-3.5" />;
    case "pencil":
      return <PencilLine className="h-3.5 w-3.5" />;
    case "timer":
      return <Timer className="h-3.5 w-3.5" />;
    default:
      return <Loader2 className="h-3.5 w-3.5 animate-pulse" />;
  }
}

/**
 * The big inline review block for the submit_plan tool. Rendered directly in the chat message
 * (no popup) so the user can read the full plan and decide: Approve, Cancel, or Edit + save.
 */
export function SubmitPlanBlock({ tool }: { tool: ToolActivity }) {
  const plan = tool.plan;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (!plan) {
    return (
      <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-4 text-sm text-[var(--color-muted)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent-2)]" />
          Waiting for the plan…
        </div>
      </div>
    );
  }

  const decided = plan.status !== "pending";
  const badge = STATUS_BADGE[plan.status];

  const sendDecision = async (decision: "approved" | "canceled" | "edited") => {
    if (saving || (decision === "edited" && draft.trim().length === 0)) return;
    setSaving(true);
    const updatedPlan = decision === "edited" ? draft : plan.plan;
    const ok = await decidePlan(plan.chatId, plan.id, decision, updatedPlan);
    // Only flip the UI when the backend actually accepted the decision. If it was already
    // decided (timeout raced the click), the incoming tool_result event owns the status.
    if (ok) {
      const status = decision === "edited" ? "edited" : decision;
      useStore.getState().updatePlanForTool(plan.id, {
        status,
        plan: decision === "edited" ? updatedPlan : undefined,
      });
      if (decision === "edited") setEditing(false);
    }
    setSaving(false);
  };

  const startEdit = () => {
    setDraft(plan.plan);
    setEditing(true);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 fade-in">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elev2)]/50 px-4 py-3">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--color-fg)]">
          <ClipboardList className="h-4 w-4 text-[var(--color-accent)]" />
          Implementation Plan
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            badge.className,
          )}
        >
          <StatusIcon status={plan.status} />
          {STATUS_LABELS[plan.status]}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Plan to review
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(8, Math.min(28, draft.split("\n").length + 2))}
            spellCheck={false}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-3 font-mono text-xs leading-relaxed text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60"
            placeholder="Edit the plan…"
          />
        ) : (
          <div className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-3 font-mono text-xs leading-relaxed text-[var(--color-fg)]">
            {plan.plan || "(empty plan)"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-elev2)]/30 px-4 py-3">
        {decided || saving ? (
          <span className="text-xs text-[var(--color-muted)]">
            {saving ? "Submitting…" : STATUS_LABELS[plan.status]}
          </span>
        ) : editing ? (
          <>
            <button
              type="button"
              disabled={saving || draft.trim().length === 0}
              onClick={() => sendDecision("edited")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save &amp; Approve
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
            >
              <PencilOff className="h-3.5 w-3.5" />
              Discard edits
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => sendDecision("approved")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition enabled:hover:brightness-110 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => sendDecision("canceled")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition enabled:hover:bg-red-500/20 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition enabled:hover:border-[var(--color-accent)]/60 enabled:hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}