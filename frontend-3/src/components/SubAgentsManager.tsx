import { useMemo, useState } from "react";
import {
  X,
  Bot,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  Search,
  Wrench,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { SUB_AGENT_TOOLS } from "@/lib/subAgentTools";
import type { SubAgent } from "@/types";
import { cn } from "@/utils/cn";

const DESC_MAX_CHARS = 300;

interface Draft {
  id: string | null;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
}

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  description: "",
  systemPrompt: "",
  tools: [],
  enabled: true,
});

export function SubAgentsManager() {
  const open = useStore((s) => s.subAgentsOpen);
  const setOpen = useStore((s) => s.setSubAgentsOpen);
  const subAgents = useStore((s) => s.subAgents);
  const addSubAgent = useStore((s) => s.addSubAgent);
  const updateSubAgent = useStore((s) => s.updateSubAgent);
  const deleteSubAgent = useStore((s) => s.deleteSubAgent);
  const toggleSubAgent = useStore((s) => s.toggleSubAgent);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const startCreate = () => {
    setError(null);
    setDraft(emptyDraft());
  };

  const startEdit = (agent: SubAgent) => {
    setError(null);
    setDraft({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      enabled: agent.enabled,
    });
  };

  const closeEditor = () => {
    setDraft(null);
    setError(null);
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name) return setError("Name is required.");
    if (description.length > DESC_MAX_CHARS)
      return setError(`Short description must be ${DESC_MAX_CHARS} characters or fewer.`);
    if (!draft.systemPrompt.trim()) return setError("System prompt is required.");

    // Names must be unique (they are how the main agent targets a sub-agent).
    const clash = subAgents.some(
      (a) => a.id !== draft.id && a.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (clash) return setError(`A sub-agent named "${name}" already exists.`);

    const payload = {
      name,
      description,
      systemPrompt: draft.systemPrompt,
      tools: draft.tools,
      enabled: draft.enabled,
    };

    if (draft.id) updateSubAgent(draft.id, payload);
    else addSubAgent(payload);
    closeEditor();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            {draft && (
              <button
                onClick={closeEditor}
                className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                title="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Bot className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">
              {draft ? (draft.id ? "Edit Sub-Agent" : "New Sub-Agent") : "Sub-Agents"}
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {draft ? (
          <SubAgentEditor draft={draft} setDraft={setDraft} error={error} onSave={save} />
        ) : (
          <SubAgentList
            subAgents={subAgents}
            onCreate={startCreate}
            onEdit={startEdit}
            onDelete={deleteSubAgent}
            onToggle={toggleSubAgent}
          />
        )}
      </div>
    </div>
  );
}

function SubAgentList({
  subAgents,
  onCreate,
  onEdit,
  onDelete,
  onToggle,
}: {
  subAgents: SubAgent[];
  onCreate: () => void;
  onEdit: (a: SubAgent) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Create specialized sub-agents the main agent can delegate work to. Each runs as a
          separate call with its own system prompt, tools, and memory. Everything is stored only in
          this browser — never on the server.
        </p>

        {subAgents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <Bot className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">No sub-agents yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {subAgents.map((agent) => (
              <li
                key={agent.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                      <span className="truncate text-sm font-semibold">{agent.name}</span>
                      {!agent.enabled && (
                        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          disabled
                        </span>
                      )}
                    </div>
                    {agent.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {agent.description}
                      </p>
                    )}
                    {agent.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {agent.tools.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
                          >
                            <Wrench className="h-2.5 w-2.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Toggle checked={agent.enabled} onChange={() => onToggle(agent.id)} />
                    <button
                      onClick={() => onEdit(agent)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-fg)]"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(agent.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-red-500/10 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Sub-Agent
        </button>
      </div>
    </>
  );
}

function SubAgentEditor({
  draft,
  setDraft,
  error,
  onSave,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  error: string | null;
  onSave: () => void;
}) {
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const descChars = draft.description.length;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <Field
          label="Sub-agent name"
        >
          <input
            type="text"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. deepexplorer"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

        <Field
          label="Short description"
          hint={`${descChars}/${DESC_MAX_CHARS} chars`}
          hintError={descChars > DESC_MAX_CHARS}
        >
          <textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What this sub-agent specializes in — shown to the main agent when it lists sub-agents."
            rows={2}
            maxLength={DESC_MAX_CHARS}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

        <Field label="System prompt" hint="no limit">
          <textarea
            value={draft.systemPrompt}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            placeholder="Instructions that teach this sub-agent how to behave and what to do…"
            rows={7}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

        <Field label="Allowed tools">
          <ToolMultiSelect
            selected={draft.tools}
            onChange={(tools) => patch({ tools })}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2">
          <Toggle checked={draft.enabled} onChange={() => patch({ enabled: !draft.enabled })} />
          <span className="text-sm text-[var(--color-fg)]">Enabled</span>
        </label>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </div>
    </>
  );
}

function ToolMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tools: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUB_AGENT_TOOLS;
    return SUB_AGENT_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none transition hover:border-[var(--color-accent)]/50"
      >
        <span className={cn(selected.length === 0 && "text-[var(--color-muted)]")}>
          {selected.length === 0
            ? "Select tools…"
            : `${selected.length} tool${selected.length === 1 ? "" : "s"} selected`}
        </span>
        <ChevronLeft
          className={cn("h-4 w-4 text-[var(--color-muted)] transition-transform", open ? "-rotate-90" : "rotate-90")}
        />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-bg-elev2)] px-1.5 py-0.5 text-[10px]"
            >
              <Wrench className="h-2.5 w-2.5" />
              {name}
              <button
                type="button"
                onClick={() => toggle(name)}
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-[var(--color-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-muted)]"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-[var(--color-muted)]">No matching tools.</li>
            ) : (
              filtered.map((tool) => {
                const active = selected.includes(tool.name);
                return (
                  <li key={tool.name}>
                    <button
                      type="button"
                      onClick={() => toggle(tool.name)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--color-bg-elev2)]",
                        active && "bg-[var(--color-bg-elev2)]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          active
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                            : "border-[var(--color-border)]",
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{tool.label}</span>
                        <span className="block text-[11px] text-[var(--color-muted)]">
                          {tool.name} — {tool.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

function Field({
  label,
  hint,
  hintError,
  children,
}: {
  label: string;
  hint?: string;
  hintError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-muted)]">{label}</span>
        {hint && (
          <span className={cn("text-[10px]", hintError ? "text-red-300" : "text-[var(--color-muted)]")}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
