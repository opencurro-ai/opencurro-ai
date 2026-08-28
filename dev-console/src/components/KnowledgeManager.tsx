import { useRef, useState } from "react";
import {
  X,
  Library,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  FileText,
  Upload,
  Globe,
  RefreshCw,
  Loader2,
  FolderUp,
  FilePlus2,
  Download,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { KnowledgeFile, KnowledgeSource, ScrapeResult } from "@/types";
import {
  KNOWLEDGE_ROOT,
  buildKnowledgeTree,
  normalizeKnowledgePath,
} from "@/lib/defaultKnowledge";
import { scrapeUrl, type ScrapeHeader } from "@/lib/api";
import { cn } from "@/utils/cn";

/** Text-ish extensions we accept for file/folder upload (binary files are skipped). */
const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "txt", "text", "rst", "adoc",
  "json", "jsonl", "yaml", "yml", "toml", "ini", "env", "csv", "tsv",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt",
  "c", "h", "cpp", "hpp", "cs", "php", "swift", "sh", "bash", "zsh",
  "html", "htm", "css", "scss", "less", "xml", "svg", "sql", "graphql", "gql",
  "vue", "svelte", "astro", "log", "conf", "cfg", "properties", "gitignore", "dockerfile",
]);

const MAX_UPLOAD_BYTES = 1_000_000; // 1 MB per file — keep localStorage sane.

type View =
  | { kind: "list" }
  | { kind: "editor"; draft: Draft }
  | { kind: "upload" }
  | { kind: "url"; editingPath?: string };

interface Draft {
  originalPath: string;
  path: string;
  content: string;
  isNew: boolean;
}

const emptyDraft = (): Draft => ({ originalPath: "", path: "", content: "", isNew: true });
const toDraft = (file: KnowledgeFile): Draft => ({
  originalPath: file.path,
  path: file.path,
  content: file.content,
  isNew: false,
});

export function KnowledgeManager() {
  const open = useStore((s) => s.knowledgeOpen);
  const setOpen = useStore((s) => s.setKnowledgeOpen);
  const knowledge = useStore((s) => s.knowledge);
  const knowledgeSources = useStore((s) => s.knowledgeSources);
  const saveKnowledgeFile = useStore((s) => s.saveKnowledgeFile);
  const deleteKnowledgeFile = useStore((s) => s.deleteKnowledgeFile);

  const [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => setOpen(false);
  const goList = () => {
    setError(null);
    setView({ kind: "list" });
  };

  const saveDraft = (draft: Draft): boolean => {
    const path = normalizeKnowledgePath(draft.path);
    if (!path) {
      setError("A file path is required.");
      return false;
    }
    const err = saveKnowledgeFile(path, draft.content, draft.isNew ? undefined : draft.originalPath);
    if (err) {
      setError(err);
      return false;
    }
    setError(null);
    return true;
  };

  const title =
    view.kind === "editor"
      ? view.draft.isNew
        ? "New Knowledge File"
        : "Edit Knowledge File"
      : view.kind === "upload"
        ? "Upload Files or Folder"
        : view.kind === "url"
          ? view.editingPath
            ? "Refetch from URL"
            : "Fetch from URL"
          : "Knowledge Base";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            {view.kind !== "list" && (
              <button
                onClick={goList}
                className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                title="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Library className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <button
            onClick={close}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {view.kind === "list" && (
          <KnowledgeList
            knowledge={knowledge}
            knowledgeSources={knowledgeSources}
            onNew={() => {
              setError(null);
              setView({ kind: "editor", draft: emptyDraft() });
            }}
            onUpload={() => {
              setError(null);
              setView({ kind: "upload" });
            }}
            onUrl={() => {
              setError(null);
              setView({ kind: "url" });
            }}
            onEdit={(f) => {
              setError(null);
              setView({ kind: "editor", draft: toDraft(f) });
            }}
            onRefetch={(path) => {
              setError(null);
              setView({ kind: "url", editingPath: path });
            }}
            onDelete={deleteKnowledgeFile}
          />
        )}

        {view.kind === "editor" && (
          <KnowledgeEditor
            draft={view.draft}
            error={error}
            setDraft={(d) => setView({ kind: "editor", draft: d })}
            onSave={() => {
              if (saveDraft(view.draft)) goList();
            }}
          />
        )}

        {view.kind === "upload" && <UploadView onDone={goList} />}

        {view.kind === "url" && <UrlView editingPath={view.editingPath} onDone={goList} />}
      </div>
    </div>
  );
}

function KnowledgeList({
  knowledge,
  knowledgeSources,
  onNew,
  onUpload,
  onUrl,
  onEdit,
  onRefetch,
  onDelete,
}: {
  knowledge: KnowledgeFile[];
  knowledgeSources: Record<string, KnowledgeSource>;
  onNew: () => void;
  onUpload: () => void;
  onUrl: () => void;
  onEdit: (f: KnowledgeFile) => void;
  onRefetch: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const tree = knowledge.length > 0 ? buildKnowledgeTree(knowledge.map((f) => f.path)) : "";

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          A file-tree knowledge base of durable reference material — stored only in this browser,
          never on the server. The agent reads and maintains it with its{" "}
          <code>knowledge_list</code>, <code>knowledge_read</code>, <code>knowledge_create</code>,{" "}
          <code>knowledge_edit</code>, and <code>knowledge_delete</code> tools. Add knowledge three
          ways: create a file manually, upload files/folders, or fetch a URL. Files live under{" "}
          <code>{KNOWLEDGE_ROOT}</code>.
        </p>

        {/* Add-knowledge method buttons */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <MethodButton icon={FilePlus2} label="New file" hint="Create manually" onClick={onNew} />
          <MethodButton icon={Upload} label="Upload" hint="Files or folder" onClick={onUpload} />
          <MethodButton icon={Globe} label="URL" hint="Fetch & save" onClick={onUrl} />
        </div>

        {knowledge.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center">
            <Library className="h-8 w-8 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">
              No knowledge files yet. Add some with the options above.
            </p>
          </div>
        ) : (
          <>
            <pre className="mb-3 max-h-40 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
              {tree}
            </pre>
            <ul className="space-y-2">
              {knowledge.map((file) => {
                const source = knowledgeSources[file.path];
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
                            {KNOWLEDGE_ROOT}
                            {file.path}
                          </span>
                          {source && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent-2)]/40 px-1.5 py-0.5 text-[10px] text-[var(--color-accent-2)]"
                              title={source.url || "Fetched from a curl command"}
                            >
                              <Globe className="h-2.5 w-2.5" />
                              URL
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-[var(--color-muted)]">
                          {file.content.trim().length > 0
                            ? file.content.trim().slice(0, 160)
                            : "(empty)"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                            {file.content.length} chars
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {source && (
                          <button
                            onClick={() => onRefetch(file.path)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-accent-2)]"
                            title="Refetch from URL"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(file)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-fg)]"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(file.path)}
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
          </>
        )}
      </div>
    </>
  );
}

function MethodButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-3 text-center transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-elev)]"
    >
      <Icon className="h-5 w-5 text-[var(--color-accent)]" />
      <span className="text-xs font-medium text-[var(--color-fg)]">{label}</span>
      <span className="text-[10px] text-[var(--color-muted)]">{hint}</span>
    </button>
  );
}

function KnowledgeEditor({
  draft,
  error,
  setDraft,
  onSave,
}: {
  draft: Draft;
  error: string | null;
  setDraft: (d: Draft) => void;
  onSave: () => void;
}) {
  const patch = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const chars = draft.content.length;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="File path">
          <input
            type="text"
            value={draft.path}
            onChange={(e) => patch({ path: e.target.value })}
            placeholder="e.g. docs.md or api/reference.md"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50"
          />
          <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
            Stored under <code>{KNOWLEDGE_ROOT}</code>. Use a nested path like{" "}
            <code>api/reference.md</code> to create folders.
          </span>
        </Field>

        <Field label="Content" hint={`${chars} chars`}>
          <textarea
            value={draft.content}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder="Durable reference knowledge the agent can read…"
            rows={16}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]/50"
          />
        </Field>

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

interface ParsedUpload {
  path: string;
  content: string;
  bytes: number;
}

function UploadView({ onDone }: { onDone: () => void }) {
  const saveKnowledgeFile = useStore((s) => s.saveKnowledgeFile);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedUpload[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    const nextParsed: ParsedUpload[] = [];
    const nextSkipped: string[] = [];

    for (const file of Array.from(fileList)) {
      // Prefer the relative path (folder uploads set webkitRelativePath).
      const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const path = normalizeKnowledgePath(raw);
      if (!path) continue;
      const ext = (path.split(".").pop() ?? "").toLowerCase();
      const isText = TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/");
      if (!isText) {
        nextSkipped.push(`${path} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        nextSkipped.push(`${path} (too large)`);
        continue;
      }
      try {
        const content = await file.text();
        nextParsed.push({ path, content, bytes: file.size });
      } catch {
        nextSkipped.push(`${path} (unreadable)`);
      }
    }

    // De-duplicate by path (later wins) and merge with anything already staged.
    setParsed((prev) => {
      const map = new Map(prev.map((p) => [p.path.toLowerCase(), p]));
      for (const p of nextParsed) map.set(p.path.toLowerCase(), p);
      return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
    });
    setSkipped((prev) => [...prev, ...nextSkipped]);
    setBusy(false);
  };

  const removeStaged = (path: string) =>
    setParsed((prev) => prev.filter((p) => p.path !== path));

  const saveAll = () => {
    if (parsed.length === 0) {
      setError("No files to add.");
      return;
    }
    for (const file of parsed) {
      // Overwrite an existing file at the same path (pass originalPath so it updates in place).
      const exists = useStore
        .getState()
        .knowledge.some((f) => f.path.toLowerCase() === file.path.toLowerCase());
      saveKnowledgeFile(file.path, file.content, exists ? file.path : undefined);
    }
    onDone();
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <p className="text-xs text-[var(--color-muted)]">
          Upload individual files or an entire folder. Text files become knowledge files (their
          folder structure is preserved); binary or oversized files are skipped.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2.5 text-sm transition hover:border-[var(--color-accent)]/50"
          >
            <Upload className="h-4 w-4 text-[var(--color-accent)]" />
            Choose files
          </button>
          <button
            onClick={() => folderInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2.5 text-sm transition hover:border-[var(--color-accent)]/50"
          >
            <FolderUp className="h-4 w-4 text-[var(--color-accent)]" />
            Choose folder
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={folderInput}
            type="file"
            multiple
            // @ts-expect-error non-standard but widely supported directory upload attributes
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {busy && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading files…
          </p>
        )}

        {parsed.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {parsed.length} file{parsed.length === 1 ? "" : "s"} ready
            </div>
            <ul className="max-h-56 space-y-1 overflow-auto">
              {parsed.map((f) => (
                <li
                  key={f.path}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--color-fg)]">
                    {f.path}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                    {f.content.length} chars
                  </span>
                  <button
                    onClick={() => removeStaged(f.path)}
                    className="shrink-0 text-[var(--color-muted)] transition hover:text-red-300"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              {skipped.length} skipped
            </div>
            <ul className="max-h-24 space-y-0.5 overflow-auto text-[10px] text-[var(--color-muted)]">
              {skipped.map((s, i) => (
                <li key={i} className="truncate font-mono">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={saveAll}
          disabled={parsed.length === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90",
            parsed.length === 0 && "cursor-not-allowed opacity-50",
          )}
        >
          <Check className="h-4 w-4" />
          Add {parsed.length > 0 ? parsed.length : ""} to knowledge
        </button>
      </div>
    </>
  );
}

type FetchMethod = "get" | "curl";

/** Suggest a knowledge filename from a URL's path (e.g. https://x.com/docs/api → docs/api.md). */
function suggestPathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p) p = u.hostname.replace(/^www\./, "");
    p = normalizeKnowledgePath(p);
    if (!p) return "docs/docs.md";
    return /\.[a-z0-9]+$/i.test(p) ? `${p}.md` : `${p}.md`;
  } catch {
    return "docs/docs.md";
  }
}

function UrlView({ editingPath, onDone }: { editingPath?: string; onDone: () => void }) {
  const knowledgeSources = useStore((s) => s.knowledgeSources);
  const saveKnowledgeFile = useStore((s) => s.saveKnowledgeFile);
  const setKnowledgeSource = useStore((s) => s.setKnowledgeSource);
  const existing = editingPath ? knowledgeSources[editingPath] : undefined;

  const [method, setMethod] = useState<FetchMethod>(existing?.curl ? "curl" : "get");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [format, setFormat] = useState<NonNullable<KnowledgeSource["format"]>>(
    existing?.format ?? "markdown",
  );
  const [headers, setHeaders] = useState<ScrapeHeader[]>(existing?.headers ?? []);
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [curl, setCurl] = useState(existing?.curl ?? "");
  const [showOptions, setShowOptions] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [savePath, setSavePath] = useState(editingPath ?? "");
  const [error, setError] = useState<string | null>(null);

  const doFetch = async () => {
    setError(null);
    setResult(null);
    setFetching(true);
    try {
      const res = await scrapeUrl({
        url: method === "get" ? url.trim() : undefined,
        curl: method === "curl" ? curl.trim() : undefined,
        format,
        headers: method === "get" ? headers : undefined,
        apiKey: method === "get" ? apiKey.trim() || undefined : undefined,
      });
      setResult(res);
      if (!editingPath && !savePath) {
        setSavePath(suggestPathFromUrl(res.url || url));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  const save = () => {
    if (!result) return;
    const path = normalizeKnowledgePath(savePath);
    if (!path) {
      setError("A file name is required to save.");
      return;
    }
    const exists = useStore
      .getState()
      .knowledge.some((f) => f.path.toLowerCase() === path.toLowerCase());
    const err = saveKnowledgeFile(path, result.content, exists ? path : undefined);
    if (err) {
      setError(err);
      return;
    }
    const source: KnowledgeSource = {
      url: method === "get" ? url.trim() : "",
      format,
      headers: method === "get" && headers.length > 0 ? headers : undefined,
      apiKey: method === "get" ? apiKey.trim() || undefined : undefined,
      curl: method === "curl" ? curl.trim() : undefined,
      fetchedAt: Date.now(),
    };
    setKnowledgeSource(path, source);
    onDone();
  };

  const canFetch = method === "get" ? url.trim().length > 0 : curl.trim().length > 0;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <p className="text-xs text-[var(--color-muted)]">
          Fetch a page or API response with the built-in scraper, review the result, then name it and
          save it as a knowledge file. Nothing is fetched until you press <strong>Fetch</strong>.
        </p>

        {/* Method toggle */}
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] p-1">
          {(["get", "curl"] as FetchMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
                method === m
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              {m === "get" ? "GET request" : "Paste cURL"}
            </button>
          ))}
        </div>

        {method === "get" ? (
          <>
            <Field label="URL">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.example.com/api"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50"
              />
            </Field>

            <button
              onClick={() => setShowOptions((v) => !v)}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              {showOptions ? "Hide" : "Show"} advanced options (headers, API key)
            </button>

            {showOptions && (
              <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/40 p-3">
                <Field label="API key (optional)" hint="sent as Authorization: Bearer">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-…"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]/50"
                  />
                </Field>

                <div>
                  <div className="mb-1.5 text-xs font-medium text-[var(--color-muted)]">
                    Custom headers (optional)
                  </div>
                  <div className="space-y-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={h.key}
                          onChange={(e) =>
                            setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                          }
                          placeholder="Header"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--color-accent)]/50"
                        />
                        <input
                          value={h.value}
                          onChange={(e) =>
                            setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                          }
                          placeholder="Value"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--color-accent)]/50"
                        />
                        <button
                          onClick={() => setHeaders((hs) => hs.filter((_, j) => j !== i))}
                          className="shrink-0 text-[var(--color-muted)] hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setHeaders((hs) => [...hs, { key: "", value: "" }])}
                      className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add header
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <Field label="cURL command" hint="URL & -H headers are parsed">
            <textarea
              value={curl}
              onChange={(e) => setCurl(e.target.value)}
              placeholder={`curl 'https://api.example.com/docs' \\\n  -H 'Authorization: Bearer TOKEN'`}
              rows={5}
              className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-accent)]/50"
            />
          </Field>
        )}

        <Field label="Output format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as NonNullable<KnowledgeSource["format"]>)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
          >
            <option value="markdown">Markdown</option>
            <option value="text">Plain text</option>
            <option value="json">JSON</option>
            <option value="autodetect">Auto-detect</option>
          </select>
        </Field>

        <button
          onClick={doFetch}
          disabled={!canFetch || fetching}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 px-4 py-2.5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/20",
            (!canFetch || fetching) && "cursor-not-allowed opacity-50",
          )}
        >
          {fetching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching…
            </>
          ) : (
            <>
              {editingPath ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {editingPath ? "Refetch" : "Fetch"}
            </>
          )}
        </button>

        {error && <p className="text-xs text-red-300">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/40 p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-[var(--color-fg)]">Fetched</span>
              <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                {result.status}
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                {result.format}
              </span>
              <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                {result.content.length} chars
              </span>
            </div>
            {result.title && (
              <p className="truncate text-xs font-medium text-[var(--color-fg)]">{result.title}</p>
            )}
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
              {result.content.slice(0, 4000) || "(empty response)"}
              {result.content.length > 4000 ? "\n… (truncated preview)" : ""}
            </pre>

            <Field label="Save as" hint={`under ${KNOWLEDGE_ROOT}`}>
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder="docs/docs.md"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)]/50"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={save}
          disabled={!result}
          className={cn(
            "flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90",
            !result && "cursor-not-allowed opacity-50",
          )}
        >
          <Check className="h-4 w-4" />
          Save to knowledge
        </button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-muted)]">{label}</span>
        {hint && <span className="text-[10px] text-[var(--color-muted)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
