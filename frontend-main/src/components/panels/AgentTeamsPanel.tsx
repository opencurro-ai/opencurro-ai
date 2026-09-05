import { useState } from "react";
import { Check, Crown, Plus, Trash2, Users, UserPlus, Pencil, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import { HEAD_PROMPT_TEMPLATE, isDefaultTeam } from "@/lib/defaultAgentTeams";
import type { AgentTeam, AgentTeamMember } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, PanelHeader, TextArea, TextInput, Toggle } from "@/components/ui/primitives";
import { uid } from "@/utils/id";
import { cn } from "@/utils/cn";

interface MemberDraft {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

interface TeamDraft {
  id: string | null;
  name: string;
  headName: string;
  headPrompt: string;
  members: MemberDraft[];
  enabled: boolean;
}

const emptyDraft = (): TeamDraft => ({
  id: null,
  name: "",
  headName: "",
  headPrompt: "",
  members: [],
  enabled: false,
});

function toDraft(team: AgentTeam): TeamDraft {
  return {
    id: team.id,
    name: team.name,
    headName: team.head.name,
    headPrompt: team.head.systemPrompt,
    members: team.members.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      systemPrompt: m.systemPrompt,
    })),
    enabled: team.enabled,
  };
}

export function AgentTeamsPanel() {
  const agentTeams = useStore((s) => s.agentTeams);
  const teamModeOn = useStore((s) => s.settings.agentTeamEnabled === "yes");
  const setSettings = useStore((s) => s.setSettings);
  const addAgentTeam = useStore((s) => s.addAgentTeam);
  const updateAgentTeam = useStore((s) => s.updateAgentTeam);
  const deleteAgentTeam = useStore((s) => s.deleteAgentTeam);
  const setActiveTeam = useStore((s) => s.setActiveTeam);

  // Only show real teams (filter out tombstones for deleted defaults).
  const teams = agentTeams.filter((t) => !t.id.startsWith("deleted-"));

  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const headName = draft.headName.trim();
    if (!name) return setError("A team name is required.");
    if (!headName) return setError("A team leader name is required.");
    if (!draft.headPrompt.trim()) return setError("A system prompt for the team leader is required.");

    const members: AgentTeamMember[] = [];
    const seen = new Set<string>([headName.toLowerCase()]);
    for (const m of draft.members) {
      const memberName = m.name.trim();
      if (!memberName) return setError("Every team member needs a name.");
      const key = memberName.toLowerCase();
      if (seen.has(key)) return setError(`Duplicate agent name "${memberName}". Names must be unique.`);
      seen.add(key);
      members.push({
        id: m.id,
        name: memberName,
        description: m.description,
        systemPrompt: m.systemPrompt,
      });
    }
    if (members.length === 0) return setError("Add at least one team member.");

    const payload = {
      name,
      head: { name: headName, systemPrompt: draft.headPrompt },
      members,
      enabled: draft.enabled,
    };

    if (draft.id) updateAgentTeam(draft.id, payload);
    else addAgentTeam(payload);
    setDraft(null);
    setError(null);
  };

  const addMember = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      members: [...draft.members, { id: uid("member"), name: "", description: "", systemPrompt: "" }],
    });
  };

  const patchMember = (id: string, patch: Partial<MemberDraft>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      members: draft.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const removeMember = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, members: draft.members.filter((m) => m.id !== id) });
  };

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="Agents that work together" title="Agent teams" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        A team is a head leader plus specialist members that collaborate on your goal. The leader
        delegates work, reviews results, and reports back. Enable team mode below to route your chat
        to the active team.
      </p>

      {/* Team mode master switch */}
      <div
        className="mb-5 flex items-center justify-between gap-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-4"
        style={{ boxShadow: "var(--shadow-chip)" }}
      >
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-[var(--fg)]">Multi-agent team mode</p>
          <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">
            {teamModeOn
              ? "On — your messages go to the active team's leader."
              : "Off — your messages go to the normal single agent."}
          </p>
        </div>
        <Toggle
          checked={teamModeOn}
          onChange={(v) => setSettings({ agentTeamEnabled: v ? "yes" : "no" })}
          label="Team mode"
        />
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] py-12 text-center">
          <Users className="h-8 w-8 text-[var(--subtle)]" />
          <p className="text-sm text-[var(--muted)]">No agent teams yet.</p>
        </div>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-3 p-0">
          {teams.map((team) => (
            <li key={team.id}>
              <article
                className={cn(
                  "flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--bg)] p-5 transition-colors",
                  team.enabled ? "ring-1 ring-[var(--secondary)]" : "hover:bg-[var(--chip)]",
                )}
                style={{ boxShadow: "var(--shadow-chip)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-serif-display m-0 text-2xl text-[var(--fg)]">{team.name}</h3>
                    <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                      <Crown className="h-3.5 w-3.5 text-[var(--secondary)]" />
                      {team.head.name}
                      <span className="text-[var(--subtle)]">
                        · {team.members.length} member{team.members.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDefaultTeam(team.id) && (
                      <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--subtle)]">
                        default
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--subtle)]">Active</span>
                    <Toggle
                      checked={team.enabled}
                      onChange={() => setActiveTeam(team.id)}
                      label="Set active team"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {team.members.slice(0, 8).map((m) => (
                    <span
                      key={m.id}
                      title={m.description}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                    >
                      {m.name}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)] pt-3">
                  <Button
                    variant="ghost"
                    className="px-2"
                    onClick={() => {
                      setError(null);
                      setDraft(toDraft(team));
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 text-[var(--subtle)] hover:text-[var(--danger)]"
                    onClick={() => deleteAgentTeam(team.id)}
                    title="Delete team"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </article>
            </li>
          ))}
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

            {/* Head / leader */}
            <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                <Crown className="h-3.5 w-3.5 text-[var(--secondary)]" /> Team leader (head)
              </div>
              <Field label="Leader name">
                <TextInput
                  value={draft.headName}
                  onChange={(e) => setDraft({ ...draft, headName: e.target.value })}
                  placeholder="e.g. Elio"
                />
              </Field>
              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    <span>System prompt</span>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, headPrompt: HEAD_PROMPT_TEMPLATE })}
                      className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] hover:border-[var(--secondary)]"
                    >
                      <FileText className="h-3 w-3" /> Use template
                    </button>
                  </span>
                }
              >
                <TextArea
                  rows={6}
                  value={draft.headPrompt}
                  onChange={(e) => setDraft({ ...draft, headPrompt: e.target.value })}
                  className="font-mono text-xs"
                  placeholder="Describe how the leader should plan, delegate, review, and report…"
                />
              </Field>
            </section>

            {/* Members */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
                  Team members ({draft.members.length})
                </span>
                <Button variant="outline" className="px-2 py-1 text-xs" onClick={addMember}>
                  <UserPlus className="h-3.5 w-3.5" /> Add team member
                </Button>
              </div>

              {draft.members.length === 0 && (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--subtle)]">
                  No members yet. Add at least one specialist for the leader to delegate to.
                </p>
              )}

              {draft.members.map((m, i) => (
                <div
                  key={m.id}
                  className="space-y-2.5 rounded-[var(--radius-md)] border border-[var(--border)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--subtle)]">
                      Member {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-[var(--subtle)] hover:text-[var(--danger)]"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Field label="Name (agent id)">
                    <TextInput
                      value={m.name}
                      onChange={(e) => patchMember(m.id, { name: e.target.value })}
                      placeholder="e.g. Arlo"
                    />
                  </Field>
                  <Field label="Short description">
                    <TextInput
                      value={m.description}
                      onChange={(e) => patchMember(m.id, { description: e.target.value })}
                      placeholder="e.g. Engineer — writes code and builds the app"
                    />
                  </Field>
                  <Field label="System prompt">
                    <TextArea
                      rows={4}
                      value={m.systemPrompt}
                      onChange={(e) => patchMember(m.id, { systemPrompt: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="Describe this member's specialization and how it should work + report back…"
                    />
                  </Field>
                </div>
              ))}
            </section>

            <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
              <Toggle
                checked={draft.enabled}
                onChange={(v) => setDraft({ ...draft, enabled: v })}
                label="Set as active team"
              />
              <span className="text-sm text-[var(--muted)]">Set as the active team</span>
            </div>

            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
