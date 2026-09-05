import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Trash2, Users } from "lucide-react";
import { useStore } from "@/store/useStore";
import { isDefaultTeam } from "@/lib/defaultTeams";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, PanelHeader, TextArea, TextInput, Toggle } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

/** Ready-made templates the user can drop into the leader (head) system prompt. */
const LEADER_TEMPLATES: Array<{ label: string; text: string }> = [
  {
    label: "Orchestrator",
    text: `You are the head/leader of a multi-agent team. Your job is to understand the user's goal, break it into clear self-contained tasks, delegate each to the best-suited member (with complete context, requirements, constraints, and the exact deliverable), review their results, request fixes when needed, and deliver the finished result to the user. Run independent tasks in parallel; sequence dependent ones. You coordinate and review — your members do the hands-on work.`,
  },
  {
    label: "Product builder",
    text: `You are the head of a product-building team. Turn the user's request into a finished, high-quality product by orchestrating specialists: plan the architecture first, then design, then implementation, then debugging and polish. Delegate precise tasks, verify each deliverable against a high bar, and only finish once the whole goal is met and verified. Summarize what the team produced and where it lives.`,
  },
  {
    label: "Research lead",
    text: `You are the head of a research team. Decompose the user's question into focused sub-questions, delegate them to your researchers and analysts, cross-check their findings for accuracy and sourcing, and synthesize a single well-organized, cited answer. Delegate independent research in parallel; review critically before delivering.`,
  },
];

interface MemberDraft {
  name: string;
  description: string;
  systemPrompt: string;
}

interface Draft {
  id: string | null;
  name: string;
  leaderName: string;
  leaderSystemPrompt: string;
  members: MemberDraft[];
  enabled: boolean;
}

const emptyMember = (): MemberDraft => ({ name: "", description: "", systemPrompt: "" });

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  leaderName: "",
  leaderSystemPrompt: "",
  members: [emptyMember()],
  enabled: true,
});

export function TeamsPanel() {
  const teams = useStore((s) => s.agentTeams);
  const addTeam = useStore((s) => s.addTeam);
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const toggleTeam = useStore((s) => s.toggleTeam);
  const multiAgentEnabled = useStore((s) => s.settings.multiAgentEnabled);
  const setSettings = useStore((s) => s.setSettings);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError("A team name is required.");
    const leaderName = draft.leaderName.trim();
    if (!leaderName) return setError("A team leader name is required.");
    if (!draft.leaderSystemPrompt.trim()) return setError("A leader system prompt is required.");

    const members: MemberDraft[] = [];
    const seen = new Set<string>([leaderName.toLowerCase()]);
    for (const m of draft.members) {
      const mn = m.name.trim();
      if (!mn) continue;
      if (seen.has(mn.toLowerCase())) return setError(`Duplicate member name "${mn}".`);
      seen.add(mn.toLowerCase());
      members.push({ name: mn, description: m.description.trim(), systemPrompt: m.systemPrompt });
    }

    const payload = { name, leaderName, leaderSystemPrompt: draft.leaderSystemPrompt, members, enabled: draft.enabled };
    if (draft.id) updateTeam(draft.id, payload);
    else addTeam(payload);
    setDraft(null);
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="A team that works together" title="Agent teams" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        Real teams of collaborating agents — a head/leader that delegates and reviews, plus specialist
        members. Turn one on to make it the active team; your next message goes to the leader, who
        coordinates the team to complete it.
      </p>

      {!multiAgentEnabled && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--chip)] px-4 py-3">
          <p className="text-sm text-[var(--muted)]">
            Multi-agent mode is currently off. Enable it to use an agent team for your chats.
          </p>
          <Button onClick={() => setSettings({ multiAgentEnabled: true })}>Enable</Button>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] py-12 text-center">
          <Users className="h-8 w-8 text-[var(--subtle)]" />
          <p className="text-sm text-[var(--muted)]">No teams yet.</p>
        </div>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-3 p-0">
          {teams.map((team) => {
            const isDefault = isDefaultTeam(team.id);
            return (
              <li key={team.id}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--bg)] p-5 transition-colors hover:bg-[var(--chip)]",
                    team.enabled && "ring-1 ring-[var(--secondary)]",
                  )}
                  style={{ boxShadow: "var(--shadow-chip)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-serif-display m-0 text-2xl text-[var(--fg)]">{team.name}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Leader: <span className="font-medium text-[var(--fg)]">{team.leaderName}</span>
                        {" · "}
                        {team.members.length} member{team.members.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isDefault && (
                        <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--subtle)]">
                          default
                        </span>
                      )}
                      {team.enabled && (
                        <span className="rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] text-[var(--secondary-fg)]">
                          active
                        </span>
                      )}
                      <Toggle checked={team.enabled} onChange={() => toggleTeam(team.id)} label="Active team" />
                    </div>
                  </div>

                  {team.members.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {team.members.map((m) => (
                        <span
                          key={m.name}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                          title={m.description}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)] pt-3">
                    <Button
                      variant="ghost"
                      className="px-2"
                      onClick={() => {
                        setError(null);
                        setDraft({
                          id: team.id,
                          name: team.name,
                          leaderName: team.leaderName,
                          leaderSystemPrompt: team.leaderSystemPrompt,
                          members: team.members.map((m) => ({ ...m })),
                          enabled: team.enabled,
                        });
                      }}
                    >
                      Edit
                    </Button>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        className="px-2 text-[var(--subtle)] hover:text-[var(--danger)]"
                        onClick={() => deleteTeam(team.id)}
                        title="Delete team"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <Button
          onClick={() => {
            setError(null);
            setDraft(emptyDraft());
          }}
        >
          <Plus className="h-4 w-4" /> Create agent team
        </Button>
      </div>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        icon={<Users className="h-4 w-4" />}
        title={draft?.id ? "Edit agent team" : "Create agent team"}
        size="lg"
        footer={
          <Button onClick={save}>
            <Check className="h-4 w-4" /> Save team
          </Button>
        }
      >
        {draft && (
          <div className="space-y-5 p-5">
            <Field label="Team name">
              <TextInput
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. saas build"
              />
            </Field>

            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Team leader (head)
              </p>
              <div className="space-y-3">
                <Field label="Leader name">
                  <TextInput
                    value={draft.leaderName}
                    onChange={(e) => setDraft({ ...draft, leaderName: e.target.value })}
                    placeholder="e.g. Elio"
                  />
                </Field>
                <Field label="Leader system prompt">
                  <TextArea
                    rows={6}
                    value={draft.leaderSystemPrompt}
                    onChange={(e) => setDraft({ ...draft, leaderSystemPrompt: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="Describe how the leader should orchestrate the team…"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-[var(--subtle)]">Templates:</span>
                  {LEADER_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, leaderSystemPrompt: t.text })}
                      className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:border-[var(--secondary)] hover:text-[var(--fg)]"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                  Team members ({draft.members.length})
                </p>
                <Button
                  variant="ghost"
                  className="px-2"
                  onClick={() => setDraft({ ...draft, members: [...draft.members, emptyMember()] })}
                >
                  <Plus className="h-3.5 w-3.5" /> Add member
                </Button>
              </div>
              <div className="space-y-2">
                {draft.members.map((member, i) => (
                  <MemberEditor
                    key={i}
                    member={member}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        members: draft.members.map((m, mi) => (mi === i ? next : m)),
                      })
                    }
                    onRemove={() =>
                      setDraft({ ...draft, members: draft.members.filter((_, mi) => mi !== i) })
                    }
                  />
                ))}
                {draft.members.length === 0 && (
                  <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--subtle)]">
                    No members yet — add at least one specialist for the leader to delegate to.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Toggle checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
              <span className="text-sm text-[var(--muted)]">Make this the active team</span>
            </div>

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function MemberEditor({
  member,
  onChange,
  onRemove,
}: {
  member: MemberDraft;
  onChange: (next: MemberDraft) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(!member.name);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--muted)] hover:bg-[var(--chip)]"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg)]">
          {member.name.trim() || "New member"}
          {member.description.trim() && (
            <span className="ml-2 text-xs font-normal text-[var(--subtle)]">— {member.description}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-[var(--subtle)] hover:text-[var(--danger)]"
          title="Remove member"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--border)] p-3">
          <Field label="Member name (agent id)">
            <TextInput
              value={member.name}
              onChange={(e) => onChange({ ...member, name: e.target.value })}
              placeholder="e.g. Niko"
            />
          </Field>
          <Field label="Short description">
            <TextInput
              value={member.description}
              onChange={(e) => onChange({ ...member, description: e.target.value })}
              placeholder="e.g. Designer — builds UI screens"
            />
          </Field>
          <Field label="System prompt">
            <TextArea
              rows={5}
              value={member.systemPrompt}
              onChange={(e) => onChange({ ...member, systemPrompt: e.target.value })}
              className="font-mono text-xs"
              placeholder="Describe this member's role, expertise, and how it should work…"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
