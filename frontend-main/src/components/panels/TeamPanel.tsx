import { useState } from "react";
import { Check, ChevronDown, Crown, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, PanelHeader, Select, TextArea, TextInput, Toggle } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";
import type { TeamMember } from "@/types";

const NAME_MAX = 60;
/** A member id/name: letters, digits, spaces and single -/_ (used as the addressable agent id). */
const MEMBER_ID_PATTERN = /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/;

/** Built-in default teams have ids prefixed with "default-" and cannot be deleted (only edited). */
function isDefaultTeam(id: string): boolean {
  return id.startsWith("default-");
}

/** Ready-made templates for the head/leader system prompt. */
const HEAD_TEMPLATES: Array<{ label: string; prompt: string }> = [
  {
    label: "Balanced coordinator",
    prompt: `You are the team leader. Turn the user's goal into a shipped result by orchestrating your specialists.

# How you lead
- Understand the user's true goal first.
- Break the work into clear pieces and delegate each to the best-suited member. Run independent work in parallel; sequence dependent work.
- Give each member a complete, self-contained brief (objective, context, constraints, expected deliverable).
- Review every report critically; send back anything incomplete or wrong with specific feedback.
- When everything is done and verified, deliver a clear final summary to the user.

Be decisive, efficient, and quality-obsessed. Coordinate the specialists — do not do their hands-on work yourself.`,
  },
  {
    label: "Fast shipper",
    prompt: `You are the team leader, optimizing for shipping quickly without sacrificing correctness.

- Identify the shortest path to a working result and delegate aggressively in parallel.
- Prefer the simplest approach that meets the requirement; avoid gold-plating.
- Delegate, then let members run; review their reports and only iterate where it materially improves the outcome.
- Conclude as soon as the goal is met with a concise summary to the user.`,
  },
  {
    label: "Rigorous reviewer",
    prompt: `You are the team leader, optimizing for correctness and quality.

- Break work into well-scoped pieces with clear acceptance criteria.
- Delegate to the right specialists and require each to report exactly what they did and how they verified it.
- Scrutinize every report; delegate fixes and independent verification where risk is high.
- Only conclude once the work is verified, then give the user a thorough, well-organized summary.`,
  },
];

interface MemberDraft extends TeamMember {}

interface Draft {
  id: string | null;
  name: string;
  headName: string;
  headSystemPrompt: string;
  members: MemberDraft[];
}

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  headName: "",
  headSystemPrompt: "",
  members: [],
});

export function TeamPanel() {
  const teams = useStore((s) => s.agentTeams);
  const addTeam = useStore((s) => s.addTeam);
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const setActiveTeam = useStore((s) => s.setActiveTeam);
  const multiAgent = useStore((s) => s.settings.multiAgent);
  const setSettings = useStore((s) => s.setSettings);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError("A team name is required.");
    const headName = draft.headName.trim();
    if (!headName) return setError("A team leader name is required.");
    if (!draft.headSystemPrompt.trim()) return setError("A team leader system prompt is required.");

    const members = draft.members
      .map((m) => ({ ...m, id: m.id.trim() }))
      .filter((m) => m.id.length > 0);
    if (members.length === 0) return setError("Add at least one team member.");

    const ids = new Set<string>();
    for (const m of members) {
      if (m.id.length > NAME_MAX) return setError(`Member name "${m.id}" is too long.`);
      if (!MEMBER_ID_PATTERN.test(m.id))
        return setError(`Member name "${m.id}" is invalid — use letters, digits, spaces and single -/_.`);
      if (m.id.toLowerCase() === "head" || m.id.toLowerCase() === "user")
        return setError(`"${m.id}" is a reserved name.`);
      const key = m.id.toLowerCase();
      if (ids.has(key)) return setError(`Duplicate member name "${m.id}".`);
      ids.add(key);
      if (!m.systemPrompt.trim()) return setError(`Member "${m.id}" needs a system prompt.`);
    }

    const payload = { name, headName, headSystemPrompt: draft.headSystemPrompt, members };
    if (draft.id) updateTeam(draft.id, payload);
    else addTeam(payload);
    setDraft(null);
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="A crew that works together" title="Agent teams" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        A team is a leader plus specialists that collaborate on your goal: the leader delegates,
        members work in parallel and report back, and the leader reviews and delivers the result.
        Enable multi-agent mode and turn on one team to make the leader handle your next message.
      </p>

      <div className="mb-5 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--chip)] px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-[var(--fg)]">Multi-agent mode</p>
          <p className="m-0 text-xs text-[var(--muted)]">
            {multiAgent === "yes"
              ? "On — your next message goes to the active team's leader."
              : "Off — messages go to the single agent."}
          </p>
        </div>
        <Toggle
          checked={multiAgent === "yes"}
          onChange={(v) => setSettings({ multiAgent: v ? "yes" : "no" })}
          label="Multi-agent mode"
        />
      </div>

      <ul className="grid list-none grid-cols-1 gap-3 p-0">
        {teams.map((team) => {
          const isDefault = isDefaultTeam(team.id);
          return (
            <li key={team.id}>
              <article
                className={cn(
                  "flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--bg)] p-5 transition-colors",
                  team.active ? "ring-1 ring-[var(--secondary)]" : "hover:bg-[var(--chip)]",
                )}
                style={{ boxShadow: "var(--shadow-chip)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-serif-display m-0 text-2xl text-[var(--fg)]">{team.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                      <Crown className="h-3.5 w-3.5 text-[var(--secondary)]" />
                      Leader: <span className="font-medium text-[var(--fg)]">{team.headName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDefault && (
                      <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--subtle)]">
                        default
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--subtle)]">{team.active ? "Active" : "Off"}</span>
                    <Toggle
                      checked={team.active}
                      onChange={(v) => setActiveTeam(team.id, v)}
                      label="Active team"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {team.members.map((m) => (
                    <span
                      key={m.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                        m.enabled
                          ? "border-[var(--border)] text-[var(--fg)]"
                          : "border-dashed border-[var(--border)] text-[var(--subtle)]",
                      )}
                      title={m.description}
                    >
                      {m.id}
                    </span>
                  ))}
                  {team.members.length === 0 && (
                    <span className="text-xs text-[var(--subtle)]">No members yet.</span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)] pt-3">
                  <Button
                    variant="ghost"
                    className="px-2"
                    onClick={() => {
                      setError(null);
                      setDraft({
                        id: team.id,
                        name: team.name,
                        headName: team.headName,
                        headSystemPrompt: team.headSystemPrompt,
                        members: team.members.map((m) => ({ ...m })),
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
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

      <div className="mt-4">
        <Button onClick={() => { setError(null); setDraft(emptyDraft()); }}>
          <Plus className="h-4 w-4" /> Create agent team
        </Button>
      </div>

      <TeamEditor
        draft={draft}
        error={error}
        onChange={setDraft}
        onClose={() => { setDraft(null); setError(null); }}
        onSave={save}
      />
    </div>
  );
}

function TeamEditor({
  draft,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft | null;
  error: string | null;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={Boolean(draft)}
      onClose={onClose}
      icon={<Users className="h-4 w-4" />}
      title={draft?.id ? "Edit agent team" : "Create agent team"}
      size="lg"
      footer={
        <Button onClick={onSave}>
          <Check className="h-4 w-4" /> Save team
        </Button>
      }
    >
      {draft && (
        <div className="space-y-5 p-5">
          <Field label="Team name" hint={`${draft.name.length}/${NAME_MAX}`} hintError={draft.name.length > NAME_MAX}>
            <TextInput
              value={draft.name}
              maxLength={NAME_MAX}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="e.g. saas build"
            />
          </Field>

          <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
              <Crown className="h-3.5 w-3.5 text-[var(--secondary)]" /> Team leader
            </div>
            <Field label="Leader name">
              <TextInput
                value={draft.headName}
                maxLength={NAME_MAX}
                onChange={(e) => onChange({ ...draft, headName: e.target.value })}
                placeholder="e.g. Elio"
              />
            </Field>
            <Field label="Leader system prompt">
              <div className="mb-1.5">
                <Select
                  value=""
                  onChange={(e) => {
                    const tpl = HEAD_TEMPLATES.find((t) => t.label === e.target.value);
                    if (tpl) onChange({ ...draft, headSystemPrompt: tpl.prompt });
                  }}
                >
                  <option value="">Insert a template…</option>
                  {HEAD_TEMPLATES.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <TextArea
                rows={7}
                value={draft.headSystemPrompt}
                onChange={(e) => onChange({ ...draft, headSystemPrompt: e.target.value })}
                className="font-mono text-xs"
                placeholder="Describe how the leader should coordinate the team…"
              />
            </Field>
          </section>

          <MembersEditor draft={draft} onChange={onChange} />

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function MembersEditor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const setMember = (index: number, patch: Partial<MemberDraft>) =>
    onChange({
      ...draft,
      members: draft.members.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  const removeMember = (index: number) =>
    onChange({ ...draft, members: draft.members.filter((_, i) => i !== index) });
  const addMember = () =>
    onChange({
      ...draft,
      members: [...draft.members, { id: "", description: "", systemPrompt: "", enabled: true }],
    });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
          Team members ({draft.members.length})
        </span>
      </div>

      {draft.members.map((member, index) => (
        <MemberRow
          key={index}
          member={member}
          onChange={(patch) => setMember(index, patch)}
          onRemove={() => removeMember(index)}
        />
      ))}

      <Button variant="outline" className="w-full border-dashed" onClick={addMember}>
        <Plus className="h-4 w-4" /> Add team member
      </Button>
    </section>
  );
}

function MemberRow({
  member,
  onChange,
  onRemove,
}: {
  member: MemberDraft;
  onChange: (patch: Partial<MemberDraft>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(!member.id);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--subtle)] transition-transform", open && "rotate-180")} />
          <span className="truncate text-sm font-medium text-[var(--fg)]">
            {member.id.trim() || "New member"}
          </span>
          {member.description && (
            <span className="truncate text-xs text-[var(--subtle)]">— {member.description}</span>
          )}
        </button>
        <Toggle checked={member.enabled} onChange={(v) => onChange({ enabled: v })} label="Enabled" />
        <button
          type="button"
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--subtle)] hover:text-[var(--danger)]"
          title="Remove member"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--border)] p-3">
          <Field label="Member name (this is the agent id)">
            <TextInput
              value={member.id}
              maxLength={NAME_MAX}
              onChange={(e) => onChange({ id: e.target.value })}
              placeholder="e.g. Arlo"
            />
          </Field>
          <Field label="Short description">
            <TextInput
              value={member.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="e.g. Engineer — writes code and builds the app"
            />
          </Field>
          <Field label="System prompt">
            <TextArea
              rows={5}
              value={member.systemPrompt}
              onChange={(e) => onChange({ systemPrompt: e.target.value })}
              className="font-mono text-xs"
              placeholder="Describe this member's specialization and how it should work…"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
