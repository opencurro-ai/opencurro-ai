import { useRef, useState } from "react";
import {
  X,
  Blocks,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  Upload,
  FileText,
  FolderTree,
  FilePlus2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Skill, SkillFile } from "@/types";
import { cn } from "@/utils/cn";

/** Skill folder names must be lowercase alphanumeric segments joined by single hyphens. */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Maximum length of the short description the agent uses to pick the right skill. */
const SKILL_DESC_MAX_CHARS = 300;

/** Maximum length of the skill name (its folder name / identifier). */
const SKILL_NAME_MAX_CHARS = 70;

interface DraftFile extends SkillFile {
  /** Stable key for React list rendering (not persisted). */
  key: string;
}

interface Draft {
  id: string | null;
  name: string;
  description: string;
  skillFile: string;
  skillContent: string;
  files: DraftFile[];
  enabled: boolean;
}

let fileKeySeq = 0;
const nextFileKey = (): string => `f${++fileKeySeq}`;

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  description: "",
  skillFile: "SKILL.md",
  skillContent: "",
  files: [],
  enabled: true,
});

const toDraft = (skill: Skill): Draft => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  skillFile: skill.skillFile || "SKILL.md",
  skillContent: skill.skillContent,
  files: skill.files.map((f) => ({ ...f, key: nextFileKey() })),
  enabled: skill.enabled,
});

export function SkillsManager() {
  const open = useStore((s) => s.skillsOpen);
  const setOpen = useStore((s) => s.setSkillsOpen);
  const skills = useStore((s) => s.skills);
  const addSkill = useStore((s) => s.addSkill);
  const updateSkill = useStore((s) => s.updateSkill);
  const deleteSkill = useStore((s) => s.deleteSkill);
  const toggleSkill = useStore((s) => s.toggleSkill);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const startCreate = () => {
    setError(null);
    setDraft(emptyDraft());
  };

  const startEdit = (skill: Skill) => {
    setError(null);
    setDraft(toDraft(skill));
  };

  const closeEditor = () => {
    setDraft(null);
    setError(null);
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    const description = draft.description.trim();
    const skillFile = draft.skillFile.trim() || "SKILL.md";

    if (!name) return setError("Skill name is required.");
    if (!SKILL_NAME_PATTERN.test(name))
      return setError(
        "Skill name must be lowercase letters, numbers and single hyphens (e.g. git-workflow).",
      );
    if (name.length > SKILL_NAME_MAX_CHARS)
      return setError(`Skill name must be ${SKILL_NAME_MAX_CHARS} characters or fewer.`);
    if (!description) return setError("Short description is required.");
    if (description.length > SKILL_DESC_MAX_CHARS)
      return setError(`Short description must be ${SKILL_DESC_MAX_CHARS} characters or fewer.`);

    // Names are the folder name and the identifier the agent uses — they must be unique.
    const clash = skills.some(
      (s) => s.id !== draft.id && s.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (clash) return setError(`A skill named "${name}" already exists.`);

    // Validate additional files: non-empty, unique, and not colliding with the entry file.
    const seen = new Set<string>([skillFile.toLowerCase()]);
    const cleanedFiles: SkillFile[] = [];
    for (const f of draft.files) {
      const path = f.path.trim().replace(/^[\\/]+/, "");
      if (!path) return setError("Every added file needs a file name.");
      if (seen.has(path.toLowerCase()))
        return setError(`Duplicate file path "${path}". File paths must be unique.`);
      seen.add(path.toLowerCase());
      cleanedFiles.push({ path, content: f.content });
    }

    const payload = {
      name,
      description,
      skillFile,
      skillContent: draft.skillContent,
      files: cleanedFiles,
      enabled: draft.enabled,
    };

    if (draft.id) updateSkill(draft.id, payload);
    else addSkill(payload);
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
            <Blocks className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">
              {draft ? (draft.id ? "Edit Skill" : "New Skill") : "Skills"}
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
          <SkillEditor draft={draft} setDraft={setDraft} error={error} onSave={save} />
        ) : (
          <SkillList
            skills={skills}
            onCreate={startCreate}
            onEdit={startEdit}
            onDelete={deleteSkill}
            onToggle={toggleSkill}
          />
        )}
      </div>
    </div>
  );
}

function SkillList({
  skills,
  onCreate,
  onEdit,
  onDelete,
  onToggle,
}: {
  skills: Skill[];
  onCreate: () => void;
  onEdit: (s: Skill) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Create reusable skills the agent can pull in on demand. Each skill is a folder (named
          after the skill) with an entry <code>SKILL.md</code> plus any reference, example or script
          files. The agent lists your skills, initializes the ones it needs into a{" "}
          <code>.skills</code> folder, then reads them. Everything is stored only in this browser —
          never on the server.
        </p>

        {skills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <Blocks className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">No skills yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {skills.map((skill) => {
              const fileCount = 1 + skill.files.length;
              return (
                <li
                  key={skill.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Blocks className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                        <span className="truncate font-mono text-sm font-semibold">
                          {skill.name}
                        </span>
                        {!skill.enabled && (
                          <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                            disabled
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                          {skill.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          <FileText className="h-2.5 w-2.5" />
                          {skill.skillFile || "SKILL.md"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          <FolderTree className="h-2.5 w-2.5" />
                          {fileCount} file{fileCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Toggle checked={skill.enabled} onChange={() => onToggle(skill.id)} />
                      <button
                        onClick={() => onEdit(skill)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-fg)]"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(skill.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-red-500/10 hover:text-red-300"
                        title="Delete"
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
          New Skill
        </button>
      </div>
    </>
  );
}

function SkillEditor({
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
  const entryInputRef = useRef<HTMLInputElement>(null);
  const descChars = draft.description.length;
  const nameChars = draft.name.length;

  const addFile = () => {
    patch({ files: [...draft.files, { key: nextFileKey(), path: "", content: "" }] });
  };
  const updateFile = (key: string, p: Partial<SkillFile>) => {
    patch({ files: draft.files.map((f) => (f.key === key ? { ...f, ...p } : f)) });
  };
  const removeFile = (key: string) => {
    patch({ files: draft.files.filter((f) => f.key !== key) });
  };

  const readFile = (file: File, onText: (name: string, text: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => onText(file.name, String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const uploadEntry = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    readFile(file, (name, text) => patch({ skillFile: name, skillContent: text }));
  };

  const uploadFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const additions: DraftFile[] = [];
    let remaining = fileList.length;
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Preserve any folder path from the upload (webkitRelativePath) so "guides/x.py" works.
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const path = rel && rel.trim().length > 0 ? rel : file.name;
        additions.push({ key: nextFileKey(), path, content: String(reader.result ?? "") });
        remaining -= 1;
        if (remaining === 0) {
          setDraft((d) => (d ? { ...d, files: [...d.files, ...additions] } : d));
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <Field
          label="Skill name"
          hint={`${nameChars}/${SKILL_NAME_MAX_CHARS} chars`}
          hintError={nameChars > SKILL_NAME_MAX_CHARS}
        >
          <input
            type="text"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. git-workflow"
            maxLength={SKILL_NAME_MAX_CHARS}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
          <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
            This becomes the skill folder name (e.g. <code>.skills/{draft.name.trim() || "myskill"}</code>).
          </span>
        </Field>

        <Field
          label="Short description"
          hint={`${descChars}/${SKILL_DESC_MAX_CHARS} chars`}
          hintError={descChars > SKILL_DESC_MAX_CHARS}
        >
          <textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What this skill teaches the agent to do — shown when it lists skills."
            rows={2}
            maxLength={SKILL_DESC_MAX_CHARS}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

        {/* Entry file (SKILL.md, renameable) */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-fg)]">
              <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              Skill file
            </span>
            <button
              type="button"
              onClick={() => entryInputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
            >
              <Upload className="h-3 w-3" /> Upload file
            </button>
            <input
              ref={entryInputRef}
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={(e) => {
                uploadEntry(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <Field label="File name">
            <input
              type="text"
              value={draft.skillFile}
              onChange={(e) => patch({ skillFile: e.target.value })}
              placeholder="SKILL.md"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50"
            />
          </Field>

          <div className="mt-2">
            <Field label="File content">
              <textarea
                value={draft.skillContent}
                onChange={(e) => patch({ skillContent: e.target.value })}
                placeholder={"# My Skill\n\nInstructions that teach the agent how to perform this task…"}
                rows={8}
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]/50"
              />
            </Field>
          </div>
        </div>

        {/* Additional files / folders */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-fg)]">
              Additional files &amp; folders
            </span>
            <UploadFilesButton onFiles={uploadFiles} />
          </div>
          <p className="mb-2 text-[11px] text-[var(--color-muted)]">
            Use a nested path like <code>references/branching.md</code> or{" "}
            <code>scripts/commit.sh</code> to create folders inside the skill. Use a bare name like{" "}
            <code>example.md</code> for a file at the skill root.
          </p>

          {draft.files.length > 0 && (
            <div className="space-y-2">
              {draft.files.map((file) => (
                <div
                  key={file.key}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/40 p-2.5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <FilePlus2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                    <input
                      type="text"
                      value={file.path}
                      onChange={(e) => updateFile(file.key, { path: e.target.value })}
                      placeholder="references/example.md"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[var(--color-accent)]/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(file.key)}
                      className="shrink-0 px-1 py-1 text-[var(--color-muted)] transition hover:text-red-300"
                      title="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={file.content}
                    onChange={(e) => updateFile(file.key, { content: e.target.value })}
                    placeholder="File content…"
                    rows={4}
                    className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addFile}
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Plus className="h-3 w-3" /> Add file or folder
          </button>
        </div>

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

function UploadFilesButton({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
      >
        <Upload className="h-3 w-3" /> Upload files
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
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
