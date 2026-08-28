import { useState } from "react";
import {
  X,
  Brain,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  FileText,
  Lock,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { MemoryFile } from "@/types";
import {
  MEMORY_ROOT,
  isPreaddedMemory,
  memoryCharLimit,
  canonicalMemoryPath,
} from "@/lib/defaultMemory";
import { cn } from "@/utils/cn";

interface Draft {
  /** The path being edited (empty when creating a new file). */
  originalPath: string;
  path: string;
  content: string;
  isNew: boolean;
}

const emptyDraft = (): Draft => ({ originalPath: "", path: "", content: "", isNew: true });

const toDraft = (file: MemoryFile): Draft => ({
  originalPath: file.path,
  path: file.path,
  content: file.content,
  isNew: false,
});

export function MemoryManager() {
  const open = useStore((s) => s.memoryOpen);
  const setOpen = useStore((s) => s.setMemoryOpen);
  const memory = useStore((s) => s.memory);
  const saveMemoryFile = useStore((s) => s.saveMemoryFile);
  const deleteMemoryFile = useStore((s) => s.deleteMemoryFile);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const startCreate = () => {
    setError(null);
    setDraft(emptyDraft());
  };
  const startEdit = (file: MemoryFile) => {
    setError(null);
    setDraft(toDraft(file));
  };
  const closeEditor = () => {
    setDraft(null);
    setError(null);
  };

  const save = () => {
    if (!draft) return;
    const path = draft.path.trim();
    if (!path) return setError("A file path is required.");

    const limit = memoryCharLimit(path);
    if (limit !== undefined && draft.content.length > limit) {
      return setError(
        `${canonicalMemoryPath(path)} is limited to ${limit} characters (currently ${draft.content.length}). ` +
          "Shorten the content before saving.",
      );
    }

    const err = saveMemoryFile(path, draft.content, draft.isNew ? undefined : draft.originalPath);
    if (err) return setError(err);
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
            <Brain className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">
              {draft ? (draft.isNew ? "New Memory File" : "Edit Memory File") : "Agent Memory"}
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
          <MemoryEditor draft={draft} setDraft={setDraft} error={error} onSave={save} />
        ) : (
          <MemoryList
            memory={memory}
            onCreate={startCreate}
            onEdit={startEdit}
            onDelete={deleteMemoryFile}
          />
        )}
      </div>
    </div>
  );
}

function MemoryList({
  memory,
  onCreate,
  onEdit,
  onDelete,
}: {
  memory: MemoryFile[];
  onCreate: () => void;
  onEdit: (f: MemoryFile) => void;
  onDelete: (path: string) => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          The agent's persistent, self-maintained memory — stored only in this browser, never on the
          server. It reads and updates these files with its <code>memory</code> tool to evolve for
          you across chats. The three core files (<code>MEMORY.md</code>, <code>SOUL.md</code>,{" "}
          <code>USER.md</code>) are auto-loaded at the start of every conversation and cannot be
          deleted. You can view, edit, or add files here at any time.
        </p>

        {memory.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <Brain className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">No memory files.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {memory.map((file) => {
              const preadded = isPreaddedMemory(file.path);
              const limit = memoryCharLimit(file.path);
              const over = limit !== undefined && file.content.length > limit;
              return (
                <li
                  key={file.path}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                        <span className="truncate font-mono text-sm font-semibold">
                          {MEMORY_ROOT}
                          {file.path}
                        </span>
                        {preadded && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/40 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
                            <Lock className="h-2.5 w-2.5" />
                            core
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-[var(--color-muted)]">
                        {file.content.trim().length > 0
                          ? file.content.trim().slice(0, 160)
                          : "(empty)"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
                            over
                              ? "border-red-500/40 bg-red-500/10 text-red-300"
                              : "border-[var(--color-border)] bg-[var(--color-bg-elev)] text-[var(--color-muted)]",
                          )}
                        >
                          {file.content.length}
                          {limit !== undefined ? ` / ${limit}` : ""} chars
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => onEdit(file)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-fg)]"
                        title={preadded ? "View / edit" : "Edit"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(file.path)}
                        disabled={preadded}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition",
                          preadded
                            ? "cursor-not-allowed text-[var(--color-muted)]/40"
                            : "text-[var(--color-muted)] hover:bg-red-500/10 hover:text-red-300",
                        )}
                        title={preadded ? "Core files cannot be deleted" : "Delete"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Memory File
        </button>
      </div>
    </>
  );
}

function MemoryEditor({
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
  const preadded = isPreaddedMemory(draft.originalPath || draft.path);
  const limit = memoryCharLimit(draft.path);
  const chars = draft.content.length;
  const over = limit !== undefined && chars > limit;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="File path">
          <input
            type="text"
            value={draft.path}
            onChange={(e) => patch({ path: e.target.value })}
            placeholder="e.g. preferences.md or projects/app.md"
            disabled={preadded}
            className={cn(
              "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50",
              preadded && "cursor-not-allowed opacity-70",
            )}
          />
          <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
            {preadded ? (
              <>This is a permanent core file — its name cannot be changed.</>
            ) : (
              <>
                Stored under <code>{MEMORY_ROOT}</code>. Use a nested path like{" "}
                <code>projects/app.md</code> to create folders. Custom files have no size limit.
              </>
            )}
          </span>
        </Field>

        <Field
          label="Content"
          hint={limit !== undefined ? `${chars}/${limit} chars` : `${chars} chars`}
          hintError={over}
        >
          <textarea
            value={draft.content}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder="What the agent should remember…"
            rows={16}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

        {over && (
          <p className="text-xs text-red-300">
            Over the {limit}-character limit by {chars - (limit ?? 0)}. Shorten the content to save.
          </p>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={onSave}
          disabled={over}
          className={cn(
            "flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90",
            over && "cursor-not-allowed opacity-50",
          )}
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </div>
    </>
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
