import { useState } from "react";
import {
  FilePlus2,
  FileText,
  FolderTree,
  Pencil,
  PencilLine,
  Braces,
  Terminal,
  Timer,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  ExternalLink,
  Bot,
  ListTree,
  Image as ImageIcon,
  Link2,
  Eye,
  CornerDownLeft,
  Blocks,
  FolderTree as FolderTreeIcon,
  PackagePlus,
  UserPlus,
  Wand2,
  Wrench,
  ListTodo,
  ClipboardList,
  Paperclip,
  Download,
  Brain,
  FileEdit,
  Trash2,
  List,
  Library,
} from "lucide-react";
import type {
  AttachFilesToolResult,
  AttachedFile,
  EmbedUrlToolResult,
  KnowledgeToolResult,
  MemoryToolResult,
  ReadImageToolResult,
  SubAgentRun,
  TodoToolResult,
  ToolActivity,
} from "@/types";
import { cn } from "@/utils/cn";
import { SubmitPlanBlock } from "./SubmitPlanBlock";
import { AskQuestionBlock } from "./AskQuestionBlock";
import { API_ROUTES, routeUrl } from "@/app/api/routes";
import { useStore } from "@/store/useStore";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file_write: FilePlus2,
  file_read: FileText,
  file_list: FolderTree,
  str_replace: Pencil,
  apply_multiple_edits: PencilLine,
  shall_tool: Terminal,
  shell_view: Eye,
  bash_write_to_process: CornerDownLeft,
  web_search: Globe,
  fatch_web_urls: Globe,
  read_image: ImageIcon,
  image_search: ImageIcon,
  call_sub_agent: Bot,
  list_sub_agents: ListTree,
  list_skills: Blocks,
  skill_initialize: PackagePlus,
  create_sub_agent: UserPlus,
  create_skill: Wand2,
  TodoWrite: ListTodo,
  read_todos: ClipboardList,
  memory: Brain,
  knowledge_list: Library,
  knowledge_read: FileText,
  knowledge_create: FilePlus2,
  knowledge_edit: FileEdit,
  knowledge_delete: Trash2,
  embed_url: Link2,
  attach_files: Paperclip,
};

interface SearchResultItem {
  title?: string;
  url?: string;
  Description?: string;
  description?: string;
}

interface SearchToolResult {
  ok?: boolean;
  data?: {
    query?: string;
    provider?: string;
    results?: SearchResultItem[];
    result_count?: number;
  };
  error?: { code?: string; message?: string };
}

interface ListToolResult {
  ok?: boolean;
  data?: { available_sub_agents?: Array<{ name?: string; description?: string }> };
}

interface SkillListItem {
  name?: string;
  description?: string;
  skill_file?: string;
  files?: string[];
  tree?: string;
}

interface ListSkillsToolResult {
  ok?: boolean;
  data?: { count?: number; skills?: SkillListItem[] };
  error?: { code?: string; message?: string };
}

interface InitializedSkillItem {
  skill_name?: string;
  path?: string;
  skill_file?: string;
  files?: string[];
}

interface FailedSkillItem {
  skill_name?: string;
  error?: string;
}

interface SkillInitializeToolResult {
  ok?: boolean;
  data?: {
    success?: boolean;
    initialized?: InitializedSkillItem[];
    failed?: FailedSkillItem[];
  };
  error?: { code?: string; message?: string };
}

interface FileReadToolResult {
  ok?: boolean;
  data?: {
    file_path?: string;
    content?: string;
    line_count?: number;
    total_lines?: number;
    first_line?: number | null;
    last_line?: number | null;
    truncated?: boolean;
    truncated_lines?: number;
  };
  error?: { code?: string; message?: string };
}

interface WebFetchPage {
  url?: string;
  status?: number;
  title?: string;
  description?: string;
  lang?: string;
  content?: string;
}

interface WebFetchToolResult {
  ok?: boolean;
  data?: {
    provider?: string;
    mode?: "single" | "crawl";
    url?: string;
    title?: string;
    description?: string;
    content?: string;
    page_count?: number;
    pages?: WebFetchPage[];
  };
  error?: { code?: string; message?: string; url?: string };
}

const PROVIDER_LABELS: Record<string, string> = {
  tavily: "Tavily",
  exa: "Exa",
  serpapi: "SerpAPI",
  builtin: "Built-in scraper",
  firecrawl: "Firecrawl",
};

function StatusIcon({ status }: { status: ToolActivity["status"] }) {
  if (status === "running")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent-2)]" />;
  if (status === "ok") return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  return <X className="h-3.5 w-3.5 text-red-400" />;
}

function chipClasses(status: ToolActivity["status"], clickable: boolean): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs fade-in",
    "bg-[var(--color-bg-elev2)]",
    status === "error"
      ? "border-red-500/40 text-red-300"
      : status === "ok"
        ? "border-emerald-500/30 text-[var(--color-fg)]"
        : "border-[var(--color-accent)]/40 text-[var(--color-fg)]",
    clickable && "cursor-pointer hover:border-[var(--color-accent)]/60",
  );
}

export function ToolChip({ tool }: { tool: ToolActivity }) {
  // A submit_plan tool renders the big inline review block (not the compact chip).
  if (tool.name === "submit_plan") {
    return <SubmitPlanBlock tool={tool} />;
  }
  // An ask_question_to_user tool renders the big inline answer block (not the compact chip).
  if (tool.name === "ask_question_to_user") {
    return <AskQuestionBlock tool={tool} />;
  }
  // A call_sub_agent chip renders the live sub-agent block once its run has started.
  if (tool.name === "call_sub_agent" && tool.subAgent) {
    return <SubAgentChip tool={tool} run={tool.subAgent} />;
  }
  if (tool.name === "shall_tool") {
    return <ShellChip tool={tool} />;
  }
  if (tool.name === "shell_view") {
    return <ShellViewChip tool={tool} />;
  }
  if (tool.name === "bash_write_to_process") {
    return <BashWriteToProcessChip tool={tool} />;
  }
  if (tool.name === "list_sub_agents") {
    return <ListSubAgentsChip tool={tool} />;
  }
  if (tool.name === "list_skills") {
    return <ListSkillsChip tool={tool} />;
  }
  if (tool.name === "skill_initialize") {
    return <SkillInitializeChip tool={tool} />;
  }
  if (tool.name === "file_read") {
    return <FileReadChip tool={tool} />;
  }
  if (tool.name === "read_image") {
    return <ReadImageChip tool={tool} />;
  }
  if (tool.name === "image_search") {
    return <ImageSearchChip tool={tool} />;
  }
  if (tool.name === "fatch_web_urls") {
    return <FetchChip tool={tool} />;
  }
  if (tool.name === "str_replace") {
    return <StrReplaceChip tool={tool} />;
  }
  if (tool.name === "apply_multiple_edits") {
    return <ApplyMultipleEditsChip tool={tool} />;
  }
  if (tool.name === "create_sub_agent") {
    return <CreateSubAgentChip tool={tool} />;
  }
  if (tool.name === "create_skill") {
    return <CreateSkillChip tool={tool} />;
  }
  if (tool.name === "TodoWrite") {
    return <TodoWriteChip tool={tool} />;
  }
  if (tool.name === "read_todos") {
    return <TodoReadChip tool={tool} />;
  }
  if (tool.name === "memory") {
    return <MemoryChip tool={tool} />;
  }
  if (KNOWLEDGE_TOOLS.has(tool.name)) {
    return <KnowledgeChip tool={tool} />;
  }
  if (tool.name === "embed_url") {
    return <EmbedUrlChip tool={tool} />;
  }
  if (tool.name === "attach_files") {
    return <AttachFilesChip tool={tool} />;
  }
  return <RegularChip tool={tool} />;
}

interface StrReplaceToolResult {
  ok?: boolean;
  data?: {
    file_path?: string;
    replaced?: number;
    replace_all?: boolean;
    line_count?: number;
  };
  error?: { code?: string; message?: string };
}

function StrReplaceChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as StrReplaceToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const oldString = tool.args?.old_string as string | undefined;
  const newString = tool.args?.new_string as string | undefined;
  const replaceAll = tool.args?.replace_all as boolean | undefined;
  const canExpand = oldString !== undefined || hasResult;

  const chip = (
    <button
      type="button"
      disabled={!canExpand}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={canExpand ? open : undefined}
      className={chipClasses(tool.status, canExpand)}
      title={tool.label}
    >
      <Pencil className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {canExpand && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!canExpand) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              Edit failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="truncate font-mono">{data?.file_path ?? tool.filePath}</span>
                </span>
                <span
                  className={
                    replaceAll
                      ? "rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]"
                      : "rounded-full border border-dashed border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
                  }
                >
                  replace_all: {replaceAll ? "true" : "false"}
                </span>
                {data?.replaced != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    replaced: {data.replaced}
                  </span>
                )}
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Old string
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                  {oldString && oldString.length > 0 ? oldString : "(empty)"}
                </pre>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  New string
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                  {newString && newString.length > 0 ? newString : "(empty)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ApplyMultipleEditsToolResult {
  ok?: boolean;
  data?: {
    file_path?: string;
    edits_applied?: number;
    line_count?: number;
  };
  error?: { code?: string; message?: string };
}

function ApplyMultipleEditsChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const result = tool.result as ApplyMultipleEditsToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const edits = Array.isArray(tool.args?.edits)
    ? (tool.args?.edits as Array<{ old_text?: string; new_text?: string }>)
    : [];
  const canExpand = edits.length > 0 || hasResult;

  const chip = (
    <button
      type="button"
      disabled={!canExpand}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={canExpand ? open : undefined}
      className={chipClasses(tool.status, canExpand)}
      title={tool.label}
    >
      <PencilLine className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {canExpand && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!canExpand) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Edit failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="truncate font-mono">
                    {data?.file_path ?? tool.filePath ?? String(tool.args?.file_path ?? "")}
                  </span>
                </span>
                <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                  edits: {edits.length}
                </span>
                {data?.edits_applied != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    applied: {data.edits_applied}
                  </span>
                )}
              </div>

              {edits.length > 0 && (
                <div className="space-y-2">
                  {edits.map((edit, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        <PencilLine className="h-3 w-3" />
                        Edit #{i + 1}
                      </div>
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                        Old text
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                        {edit.old_text && edit.old_text.length > 0 ? edit.old_text : "(empty)"}
                      </pre>
                      <div className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                        New text
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                        {edit.new_text && edit.new_text.length > 0 ? edit.new_text : "(empty — deletes matched text)"}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  aria-expanded={showRaw}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  <Braces className="h-3 w-3" />
                  Raw arguments
                  <ChevronRight
                    className={cn("h-3.5 w-3.5 transition-transform", showRaw && "rotate-90")}
                  />
                </button>
                {showRaw && (
                  <pre className="max-h-64 overflow-auto whitespace-pre rounded-b-lg border-t border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                    {JSON.stringify(tool.args ?? {}, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ShellToolResult {
  ok?: boolean;
  data?: {
    command?: string;
    exit_code?: number | null;
    signal?: string | null;
    stdout?: string;
    stderr?: string;
    truncated?: boolean;
    timed_out?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
    timeout_seconds?: number;
    stdout?: string;
    stderr?: string;
    truncated?: boolean;
  };
}

const DEFAULT_SHELL_TIMEOUT = 60;

function ShellChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ShellToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const command = data?.command ?? String(tool.args?.command ?? tool.label);
  const timeoutArg = tool.args?.timeout as number | undefined;
  const timeout = timeoutArg ?? DEFAULT_SHELL_TIMEOUT;
  const effectiveTimeout = error?.timeout_seconds ?? timeout;
  const stdout = data?.stdout ?? error?.stdout;
  const stderr = data?.stderr ?? error?.stderr;
  const truncated = data?.truncated ?? error?.truncated;
  const timedOut = data?.timed_out ?? error?.code === "shell_timeout";

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Terminal className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      <span
        className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
        title={`Command timeout (default ${DEFAULT_SHELL_TIMEOUT}s, max 180s)`}
      >
        <Timer className="h-2.5 w-2.5" />
        {effectiveTimeout}s
      </span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const hasOutput =
    (stdout !== undefined && stdout.length > 0) || (stderr !== undefined && stderr.length > 0);

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
            <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
              <span className="truncate font-mono">{command}</span>
            </span>
            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
              timeout: {effectiveTimeout}s
            </span>
            {data?.exit_code != null && (
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px]",
                  data.exit_code === 0
                    ? "border-[var(--color-border)]"
                    : "border-red-500/40 bg-red-500/10 text-red-300",
                )}
              >
                exit: {data.exit_code}
              </span>
            )}
            {data?.signal && (
              <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                signal: {data.signal}
              </span>
            )}
            {timedOut && (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                title="The command was killed because it exceeded the timeout"
              >
                ⚠ timed out
              </span>
            )}
            {truncated && (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                title="Output was cut at the character limit"
              >
                ⚠ truncated
              </span>
            )}
          </div>

          {error && (
            <p className="whitespace-pre-wrap text-red-300">
              Command failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          )}

          {hasOutput ? (
            <>
              {stdout !== undefined && stdout.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    stdout
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                    {stdout}
                  </pre>
                </div>
              )}
              {stderr !== undefined && stderr.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    stderr
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-red-300">
                    {stderr}
                  </pre>
                </div>
              )}
            </>
          ) : !error ? (
            <p className="text-[var(--color-muted)]">No output.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface ShellViewSession {
  session_name?: string;
  status?: string;
  output?: string;
  stdout?: string;
  stderr?: string;
  command?: string;
  pid?: number | null;
  exit_code?: number | null;
  truncated?: boolean;
}

interface ShellViewToolResult {
  ok?: boolean;
  data?: { sessions?: ShellViewSession[] };
  error?: { code?: string; message?: string; sessions?: ShellViewSession[] };
}

const SHELL_VIEW_STATUS_STYLES: Record<string, string> = {
  running: "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  errored: "border-red-500/40 bg-red-500/10 text-red-300",
};

function statusBadge(session: ShellViewSession) {
  const status = session.status ?? "unknown";
  const style =
    SHELL_VIEW_STATUS_STYLES[status] ??
    "border-dashed border-[var(--color-border)] text-[var(--color-muted)]";
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize",
        style,
      )}
    >
      {status}
    </span>
  );
}

function ShellViewChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ShellViewToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  // The backend includes the session entries in the error payload too, so the
  // drop-down can still show the output that IS available when some are missing.
  const sessions = result?.ok
    ? result.data?.sessions
    : result?.error?.sessions ?? result?.data?.sessions;
  const errorMessage = result && !result.ok ? result.error?.message : undefined;
  const count = sessions?.length ?? 0;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Eye className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {count > 0 && (
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {count}
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {errorMessage && (
            <p className="whitespace-pre-wrap text-red-300">{errorMessage}</p>
          )}
          {!sessions || sessions.length === 0 ? (
            <p className="text-[var(--color-muted)]">No output.</p>
          ) : (
            sessions.map((session, i) => {
              const output = session.output ?? "";
              const hasOutput = output.trim().length > 0;
              const command = session.command ?? session.session_name ?? "";
              return (
                <div
                  key={`${session.session_name ?? "session"}-${i}`}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                    <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                      <Eye className="h-3 w-3 shrink-0 text-[var(--color-accent)]" />
                      <span className="truncate font-mono">{session.session_name}</span>
                    </span>
                    {statusBadge(session)}
                    {command && (
                      <span className="min-w-0 truncate text-[10px]" title={command}>
                        {command}
                      </span>
                    )}
                    {session.pid != null && (
                      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                        pid: {session.pid}
                      </span>
                    )}
                    {session.exit_code != null && (
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px]",
                          session.exit_code === 0
                            ? "border-[var(--color-border)]"
                            : "border-red-500/40 bg-red-500/10 text-red-300",
                        )}
                      >
                        exit: {session.exit_code}
                      </span>
                    )}
                    {session.truncated && (
                      <span
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                        title="Buffered output was capped at the character limit"
                      >
                        ⚠ truncated
                      </span>
                    )}
                  </div>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                    {hasOutput ? output : "(no output yet)"}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface BashWriteToProcessToolResult {
  ok?: boolean;
  data?: {
    session_name?: string;
    input?: string;
    press_enter?: boolean;
    written?: string;
    bytes_written?: number;
  };
  error?: {
    code?: string;
    message?: string;
    session_name?: string;
    status?: string;
    exit_code?: number | null;
    detail?: string;
  };
}

function BashWriteToProcessChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const result = tool.result as BashWriteToProcessToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <CornerDownLeft className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const sessionName = data?.session_name ?? String(tool.args?.session_name ?? "");
  const pressEnter = data?.press_enter ?? tool.args?.press_enter;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <>
              <p className="whitespace-pre-wrap text-red-300">
                Write failed: {error.message ?? error.code ?? "unknown error"}
              </p>
              {error.code === "process_exited" && (
                <p className="text-[var(--color-muted)]">
                  Process status: {error.status ?? "unknown"}
                  {error.exit_code != null ? ` · exit: ${error.exit_code}` : ""}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="truncate font-mono">{sessionName}</span>
                </span>
                <span
                  className={
                    pressEnter
                      ? "rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]"
                      : "rounded-full border border-dashed border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
                  }
                >
                  press_enter: {pressEnter ? "true" : "false"}
                </span>
                {data?.bytes_written != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.bytes_written} bytes
                  </span>
                )}
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Written to stdin
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                  {data?.written ?? ""}
                </pre>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              aria-expanded={showRaw}
              className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              <Braces className="h-3 w-3" />
              Raw arguments
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", showRaw && "rotate-90")}
              />
            </button>
            {showRaw && (
              <pre className="max-h-64 overflow-auto whitespace-pre rounded-b-lg border-t border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                {JSON.stringify(tool.args ?? {}, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CreateSubAgentToolResult {
  ok?: boolean;
  data?: {
    created_sub_agent?: {
      name?: string;
      description?: string;
      system_prompt?: string;
      tools?: string[];
      enabled?: boolean;
    };
    granted_tools?: number;
    message?: string;
  };
  error?: { code?: string; message?: string };
}

function CreateSubAgentChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const result = tool.result as CreateSubAgentToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const created = data?.created_sub_agent;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <UserPlus className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {created?.name && (
        <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
          saved
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const argsName = typeof tool.args?.name === "string" ? tool.args.name : "";
  const argsDescription = typeof tool.args?.description === "string" ? tool.args.description : "";
  const argsSystemPrompt =
    typeof tool.args?.system_prompt === "string" ? tool.args.system_prompt : "";

  const grantedTools = created?.tools ?? [];

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Create sub-agent failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : created ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  {created.name}
                </span>
                <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  {created.tools?.length ?? 0} tool{(created.tools?.length ?? 0) === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                  saved to browser
                </span>
              </div>

              {created.description && (
                <p className="leading-relaxed text-[var(--color-muted)]">{created.description}</p>
              )}

              <div className="space-y-1.5">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60">
                  <button
                    type="button"
                    onClick={() => setShowPrompt((v) => !v)}
                    aria-expanded={showPrompt}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    <Braces className="h-3 w-3" />
                    System prompt
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", showPrompt && "rotate-90")}
                    />
                  </button>
                  {showPrompt && (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-b-lg border-t border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                      {created.system_prompt}
                    </pre>
                  )}
                </div>

                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60">
                  <button
                    type="button"
                    onClick={() => setShowTools((v) => !v)}
                    aria-expanded={showTools}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    <Wrench className="h-3 w-3" />
                    Granted tools ({grantedTools.length})
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", showTools && "rotate-90")}
                    />
                  </button>
                  {showTools && (
                    <div className="flex flex-wrap gap-1 border-t border-[var(--color-border)] p-2">
                      {grantedTools.length === 0 ? (
                        <span className="text-[10px] text-[var(--color-muted)]">No tools granted.</span>
                      ) : (
                        grantedTools.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]"
                          >
                            <Wrench className="h-2.5 w-2.5" />
                            {t}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw arguments */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                    <Braces className="h-3 w-3" />
                    Arguments
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="space-y-2 border-t border-[var(--color-border)] p-2">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Name
                      </div>
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] text-[var(--color-fg)]">
                        {argsName}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Description
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 text-[11px] text-[var(--color-fg)]">
                        {argsDescription}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        System prompt (submitted)
                      </div>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] text-[var(--color-fg)]">
                        {argsSystemPrompt}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <p className="text-[var(--color-muted)]">No created sub-agent in result.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateSkillToolResult {
  ok?: boolean;
  data?: {
    created_skill?: {
      name?: string;
      description?: string;
      skill_file?: string;
      files?: Array<{ path?: string; content?: string }>;
      enabled?: boolean;
    };
    file_count?: number;
    entry_file?: string;
    message?: string;
  };
  error?: { code?: string; message?: string };
}

function CreateSkillChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const result = tool.result as CreateSkillToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const created = data?.created_skill;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Wand2 className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {created?.name && (
        <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
          saved
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const argsSourcePath = typeof tool.args?.source_path === "string" ? tool.args.source_path : "";
  const argsDescription = typeof tool.args?.description === "string" ? tool.args.description : "";
  const files = created?.files ?? [];

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Create skill failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : created ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
                  <Wand2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  {created.name}
                </span>
                <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  {data?.file_count ?? files.length} file{(data?.file_count ?? files.length) === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  saved to browser
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[var(--color-muted)]">
                <span className="text-[10px] font-semibold uppercase tracking-wide">Entry file</span>
                <span className="rounded-full border border-[var(--color-accent)]/40 px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-accent)]">
                  {created.skill_file || "SKILL.md"}
                </span>
              </div>

              {created.description && (
                <p className="leading-relaxed text-[var(--color-muted)]">{created.description}</p>
              )}

              <div className="space-y-1.5">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60">
                  <button
                    type="button"
                    onClick={() => setShowFiles((v) => !v)}
                    aria-expanded={showFiles}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  >
                    <Blocks className="h-3 w-3" />
                    Files ({files.length})
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", showFiles && "rotate-90")}
                    />
                  </button>
                  {showFiles && (
                    <div className="flex flex-wrap gap-1 border-t border-[var(--color-border)] p-2">
                      {files.length === 0 ? (
                        <span className="text-[10px] text-[var(--color-muted)]">No files.</span>
                      ) : (
                        files.map((f, i) => (
                          <span
                            key={`${f.path ?? "file"}-${i}`}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {f.path}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                    <Braces className="h-3 w-3" />
                    Arguments
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="space-y-2 border-t border-[var(--color-border)] p-2">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Name
                      </div>
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] text-[var(--color-fg)]">
                        {created.name}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Description
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 text-[11px] text-[var(--color-fg)]">
                        {argsDescription}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Source path
                      </div>
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] text-[var(--color-fg)]">
                        {argsSourcePath}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <p className="text-[var(--color-muted)]">No created skill in result.</p>
          )}
        </div>
      )}
    </div>
  );
}

const PRIORITY_TAG_STYLES: Record<string, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  low: "border-[var(--color-border)] text-[var(--color-muted)]",
};

const STATUS_TAG_STYLES: Record<string, string> = {
  pending: "border-[var(--color-border)] text-[var(--color-muted)]",
  in_progress: "border-[var(--color-accent)]/40 text-[var(--color-accent)]",
  completed: "border-emerald-500/40 text-emerald-300",
};

interface TodoResultItem {
  id?: string;
  content?: string;
  status?: string;
  priority?: string;
}

function TodoSummaryCard({ todos }: { todos: TodoResultItem[] }) {
  return (
    <ul className="space-y-1.5">
      {todos.map((todo, i) => {
        const status = todo.status ?? "pending";
        const priority = todo.priority ?? "medium";
        return (
          <li
            key={todo.id ?? i}
            className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
          >
            <span
              className={cn(
                "mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                status === "completed" && "border-emerald-400 text-emerald-400",
              )}
            >
              {status === "completed" && <Check className="h-2.5 w-2.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[11px] leading-relaxed text-[var(--color-fg)]",
                  status === "completed" && "text-[var(--color-muted)] line-through",
                )}
              >
                {todo.content || "(empty todo)"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] capitalize",
                    STATUS_TAG_STYLES[status] ?? STATUS_TAG_STYLES.pending,
                  )}
                >
                  {status}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] capitalize",
                    PRIORITY_TAG_STYLES[priority] ?? PRIORITY_TAG_STYLES.medium,
                  )}
                >
                  {priority}
                </span>
                {todo.id && (
                  <span className="font-mono text-[10px] text-[var(--color-muted)]">#{todo.id}</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TodoWriteChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as TodoToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const todos = data?.todos ?? [];
  const argsTodos = Array.isArray(tool.args?.todos)
    ? (tool.args.todos as TodoResultItem[])
    : [];

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <ListTodo className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
        {data?.count ?? argsTodos.length}
      </span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              {error.message ?? error.code ?? "Failed to update todo list"}
            </p>
          ) : data ? (
            <>
              <div className="flex items-center gap-2 text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-fg)]">
                  {todos.length} todo{todos.length === 1 ? "" : "s"}
                </span>
                {data.message && (
                  <span className="min-w-0 truncate" title={data.message}>
                    · {data.message}
                  </span>
                )}
              </div>
              {todos.length === 0 ? (
                <p className="text-[var(--color-muted)]">Todo list is empty.</p>
              ) : (
                <TodoSummaryCard todos={todos} />
              )}
            </>
          ) : (
            <p className="text-[var(--color-muted)]">No todo data in result.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TodoReadChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as TodoToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const todos = data?.todos ?? [];

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <ClipboardList className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
        {todos.length}
      </span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              {error.message ?? error.code ?? "Failed to read todo list"}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-fg)]">
                  {todos.length} todo{todos.length === 1 ? "" : "s"}
                </span>
                <span className="text-[10px]">(read-only)</span>
              </div>
              {todos.length === 0 ? (
                <p className="text-[var(--color-muted)]">No todos found.</p>
              ) : (
                <TodoSummaryCard todos={todos} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const MEMORY_OP_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  memory_list: { label: "list", icon: List },
  memory_read: { label: "read", icon: FileText },
  memory_write: { label: "write", icon: FilePlus2 },
  memory_edit: { label: "edit", icon: FileEdit },
  memory_delete: { label: "delete", icon: Trash2 },
};

function MemoryChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as MemoryToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const operation = typeof tool.args?.operation === "string" ? tool.args.operation : "";
  const meta = MEMORY_OP_META[operation];
  const argsPath = typeof tool.args?.path === "string" ? tool.args.path : undefined;

  const files = data?.files ?? [];
  const OpIcon = meta?.icon ?? Brain;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Brain className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {operation === "memory_list" && data?.count != null && (
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {data.count}
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <div className="space-y-1.5">
              <p className="whitespace-pre-wrap text-red-300">
                {error.message ?? error.code ?? "Memory operation failed"}
              </p>
              {error.code === "memory_char_limit_exceeded" && error.char_limit != null && (
                <p className="text-[var(--color-muted)]">
                  {error.attempted_chars} chars attempted · {error.char_limit} limit ·{" "}
                  {error.over_by} over. Summarize &amp; condense the whole file, then write again.
                </p>
              )}
              {error.available_paths && error.available_paths.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {error.available_paths.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]"
                    >
                      <FileText className="h-2.5 w-2.5" />
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
                  <OpIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {meta?.label ?? "memory"}
                </span>
                {(data?.path ?? argsPath) && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono">
                    memory/{(data?.path ?? argsPath)!.replace(/^memory\//i, "")}
                  </span>
                )}
                {data?.preadded && (
                  <span className="rounded-full border border-[var(--color-accent)]/40 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
                    core
                  </span>
                )}
                {data?.chars != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.chars}
                    {data.char_limit != null ? ` / ${data.char_limit}` : ""} chars
                  </span>
                )}
              </div>

              {/* memory_list — file tree + per-file sizes */}
              {operation === "memory_list" && (
                files.length === 0 ? (
                  <p className="text-[var(--color-muted)]">No memory files.</p>
                ) : (
                  <>
                    {data?.tree && (
                      <pre className="max-h-60 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                        {data.tree}
                      </pre>
                    )}
                    <ul className="space-y-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.path ?? "file"}-${i}`}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-fg)]">
                            {f.path}
                          </span>
                          {f.preadded && (
                            <span className="rounded-full border border-[var(--color-accent)]/40 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
                              core
                            </span>
                          )}
                          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                            {f.chars ?? 0}
                            {f.char_limit != null ? `/${f.char_limit}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )
              )}

              {/* memory_read — the file's contents */}
              {operation === "memory_read" && (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                  {data?.content && data.content.length > 0 ? data.content : "(empty file)"}
                </pre>
              )}

              {/* memory_write / memory_edit — before/after snippet from the args */}
              {(operation === "memory_write" || operation === "memory_edit") && (
                <>
                  {operation === "memory_write" && typeof tool.args?.content === "string" && (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Saved content
                      </div>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                        {(tool.args.content as string) || "(empty)"}
                      </pre>
                    </div>
                  )}
                  {operation === "memory_edit" && (
                    <div className="space-y-2">
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Old string
                        </div>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                          {(tool.args?.old_str as string) || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          New string
                        </div>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                          {(tool.args?.new_str as string) || "(empty — deletes matched text)"}
                        </pre>
                      </div>
                    </div>
                  )}
                  {data?.message && (
                    <p className="text-[var(--color-muted)]">{data.message}</p>
                  )}
                </>
              )}

              {/* memory_delete — confirmation */}
              {operation === "memory_delete" && (
                <p className="text-[var(--color-muted)]">
                  {data?.message ?? `Deleted memory/${data?.path ?? argsPath ?? ""}.`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const KNOWLEDGE_TOOLS = new Set([
  "knowledge_list",
  "knowledge_read",
  "knowledge_create",
  "knowledge_edit",
  "knowledge_delete",
]);

const KNOWLEDGE_OP_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  knowledge_list: { label: "list", icon: List },
  knowledge_read: { label: "read", icon: FileText },
  knowledge_create: { label: "create", icon: FilePlus2 },
  knowledge_edit: { label: "edit", icon: FileEdit },
  knowledge_delete: { label: "delete", icon: Trash2 },
};

/**
 * Renders any of the five knowledge tools as a chip with a drop-down showing the operation output:
 * the file tree + sizes (list), the file contents (read), the created/saved content (create), the
 * old/new strings (edit), or a deletion confirmation (delete). Mirrors MemoryChip.
 */
function KnowledgeChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as KnowledgeToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;

  const operation = tool.name;
  const meta = KNOWLEDGE_OP_META[operation];
  const argsPath =
    typeof tool.args?.knowledge_path === "string" ? tool.args.knowledge_path : undefined;
  const files = data?.files ?? [];
  const OpIcon = meta?.icon ?? Library;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Library className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {operation === "knowledge_list" && data?.count != null && (
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {data.count}
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <div className="space-y-1.5">
              <p className="whitespace-pre-wrap text-red-300">
                {error.message ?? error.code ?? "Knowledge operation failed"}
              </p>
              {error.available_paths && error.available_paths.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {error.available_paths.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]"
                    >
                      <FileText className="h-2.5 w-2.5" />
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
                  <OpIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {meta?.label ?? "knowledge"}
                </span>
                {(data?.path ?? argsPath) && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono">
                    knowledge/{(data?.path ?? argsPath)!.replace(/^knowledge\//i, "")}
                  </span>
                )}
                {data?.chars != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.chars} chars
                  </span>
                )}
                {data?.total_lines != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.total_lines} lines
                  </span>
                )}
              </div>

              {/* knowledge_list — file tree + per-file sizes */}
              {operation === "knowledge_list" &&
                (files.length === 0 ? (
                  <p className="text-[var(--color-muted)]">The knowledge base is empty.</p>
                ) : (
                  <>
                    {data?.tree && (
                      <pre className="max-h-60 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                        {data.tree}
                      </pre>
                    )}
                    <ul className="space-y-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.path ?? "file"}-${i}`}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-fg)]">
                            {f.path}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                            {f.chars ?? 0} chars
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ))}

              {/* knowledge_read — the file's contents */}
              {operation === "knowledge_read" && (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                  {data?.content && data.content.length > 0 ? data.content : "(empty file)"}
                </pre>
              )}

              {/* knowledge_create — the saved content */}
              {operation === "knowledge_create" && typeof tool.args?.content === "string" && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Created content
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                    {(tool.args.content as string) || "(empty)"}
                  </pre>
                </div>
              )}

              {/* knowledge_edit — before/after strings */}
              {operation === "knowledge_edit" && (
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Old string
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                      {(tool.args?.old_str as string) || "(empty)"}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      New string
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                      {(tool.args?.new_str as string) || "(empty — deletes matched text)"}
                    </pre>
                  </div>
                </div>
              )}

              {/* create / edit / delete — trailing message */}
              {operation !== "knowledge_list" &&
                operation !== "knowledge_read" &&
                data?.message && <p className="text-[var(--color-muted)]">{data.message}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmbedUrlChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const setPreview = useStore((s) => s.setPreview);
  const setPreviewOpen = useStore((s) => s.setPreviewOpen);
  const result = tool.result as EmbedUrlToolResult | undefined;
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const url = data?.url ?? String(tool.args?.url ?? "");

  const openInPanel = () => {
    if (!url) return;
    setPreview(url);
    setPreviewOpen(true);
    setOpen(false);
  };

  const chip = (
    <button
      type="button"
      disabled={!url}
      onClick={() => (url ? setOpen((v) => !v) : undefined)}
      aria-expanded={open}
      className={chipClasses(tool.status, Boolean(url))}
      title={tool.label}
    >
      <Link2 className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[300px] truncate font-mono font-medium">{url}</span>
      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
        preview
      </span>
      {url && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Embed failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={openInPanel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/40 px-2.5 py-1.5 text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/10"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Open browser preview
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
              </div>
              <div className="relative min-h-[260px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <iframe
                  src={url}
                  title="Embedded preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
                  referrerPolicy="no-referrer"
                  className="h-[320px] w-full border-0"
                />
              </div>
            </div>
          ) : (
            <p className="text-[var(--color-muted)]">No URL in the tool result.</p>
          )}
        </div>
      )}
    </div>
  );
}

function fileSizeLabel(file: AttachedFile): string {
  if (file.size_label) return file.size_label;
  const bytes = Number.isFinite(file.size) ? file.size : 0;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)} MB`;
}

function AttachFilesChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const setPreview = useStore((s) => s.setPreview);
  const setPreviewOpen = useStore((s) => s.setPreviewOpen);
  const result = tool.result as AttachFilesToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const files: AttachedFile[] = data?.files ?? [];
  const failed = data?.errors ?? (result && !result.ok ? result.error?.errors : undefined);
  const count = data?.file_count ?? files.length;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Paperclip className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
        {count}
      </span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const previewFile = (file: AttachedFile) => {
    setPreview(routeUrl(API_ROUTES.filesPreview, { query: { path: file.path } }));
    setPreviewOpen(true);
  };

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error && (
            <p className="whitespace-pre-wrap text-red-300">
              Attach failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          )}
          {files.length === 0 && !failed?.length ? (
            <p className="text-[var(--color-muted)]">No files attached.</p>
          ) : (
            <ul className="space-y-1.5">
              {files.map((file, i) => (
                <li
                  key={`${file.path ?? "file"}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[var(--color-fg)]">{file.name}</div>
                    <div className="truncate text-[10px] text-[var(--color-muted)]">
                      {file.path} · {fileSizeLabel(file)}
                    </div>
                  </div>
                  <button
                    onClick={() => previewFile(file)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
                    title="Preview in browser preview panel"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <a
                    href={routeUrl(API_ROUTES.filesDownload, { query: { path: file.path } })}
                    download={file.name}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
          {failed && failed.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Skipped ({failed.length})
              </div>
              <ul className="space-y-1">
                {failed.map((f, i) => (
                  <li
                    key={`${f.path ?? "failed"}-${i}`}
                    className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-[var(--color-muted)]"
                  >
                    <span className="font-mono text-red-300">{f.path}</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegularChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool.name] ?? Terminal;

  const result = tool.result as SearchToolResult | undefined;
  const isSearch = tool.name === "web_search";
  const hasResult = isSearch && tool.status !== "running" && Boolean(result);
  const results = result?.ok ? result.data?.results ?? [] : [];
  const query = result?.ok ? result.data?.query : undefined;
  const provider = result?.ok ? result.data?.provider : undefined;
  const error = !result?.ok ? result?.error : undefined;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              Search failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : results.length === 0 ? (
            <p className="text-[var(--color-muted)]">No results found.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-fg)]">
                  {results.length} result{results.length === 1 ? "" : "s"}
                </span>
                {provider && <span>· {PROVIDER_LABELS[provider] ?? provider}</span>}
                {query && (
                  <span className="min-w-0 truncate" title={query}>
                    · “{query}”
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {results.map((item, i) => (
                  <li key={`${item.url ?? "result"}-${i}`}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 transition hover:border-[var(--color-accent)]/50"
                    >
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--color-accent)]">
                          {item.title || item.url}
                        </span>
                        {item.url && (
                          <span className="block truncate text-[10px] text-[var(--color-muted)]">
                            {item.url}
                          </span>
                        )}
                        {(item.Description ?? item.description) && (
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-[var(--color-muted)]">
                            {item.Description ?? item.description}
                          </span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FetchChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as WebFetchToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = !result?.ok ? result?.error : undefined;
  const provider = result?.ok ? result.data?.provider : undefined;
  const isCrawl = result?.ok && (result.data?.mode === "crawl" || Array.isArray(result.data?.pages));

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Globe className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-[var(--color-muted)] transition-transform", open && "rotate-180")}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const truncated = (data?.content ?? "").includes("... [truncated");

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              Fetch failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="truncate">{data?.title || data?.url}</span>
                </span>
                <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                  {PROVIDER_LABELS[provider ?? ""] ?? provider ?? "fetch"}
                </span>
                {isCrawl && data?.page_count != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.page_count} page{data.page_count === 1 ? "" : "s"}
                  </span>
                )}
                {truncated && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    content truncated
                  </span>
                )}
              </div>
              {isCrawl && data?.pages ? (
                <div className="space-y-2">
                  {data.pages.length === 0 ? (
                    <p className="text-[var(--color-muted)]">No pages crawled.</p>
                  ) : (
                    data.pages.map((page, i) => (
                      <div
                        key={`${page.url ?? "page"}-${i}`}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                          <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--color-fg)]">
                            <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                            <span className="truncate">{page.title || page.url}</span>
                          </span>
                          {page.status != null && (
                            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                              {page.status}
                            </span>
                          )}
                          {page.lang && (
                            <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                              {page.lang}
                            </span>
                          )}
                        </div>
                        {page.url && (
                          <div className="mt-1 min-w-0 text-[var(--color-muted)]">
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1 truncate break-all text-[var(--color-accent)] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{page.url}</span>
                            </a>
                          </div>
                        )}
                        {page.description && (
                          <p className="mt-1 leading-relaxed text-[var(--color-muted)]">
                            {page.description}
                          </p>
                        )}
                        {(page.content ?? "").trim() ? (
                          <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                            {page.content}
                          </pre>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {data?.url && data?.title && (
                    <div className="min-w-0 text-[var(--color-muted)]">
                      <a
                        href={data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate break-all text-[var(--color-accent)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{data.url}</span>
                      </a>
                    </div>
                  )}
                  {data?.description && (
                    <p className="leading-relaxed text-[var(--color-muted)]">{data.description}</p>
                  )}
                  {(data?.content ?? "").trim() ? (
                    <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                      {data?.content}
                    </pre>
                  ) : (
                    <p className="text-[var(--color-muted)]">No content returned.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileReadChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as FileReadToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = !result?.ok ? result?.error : undefined;
  const inputOffset = tool.args?.offset as number | undefined;
  const inputLimit = tool.args?.limit as number | undefined;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <FileText className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              Read failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  <span className="truncate font-mono">{data?.file_path}</span>
                </span>
                {inputOffset !== undefined ? (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    offset: {inputOffset}
                  </span>
                ) : (
                  <span className="rounded-full border border-dashed border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    offset: not set
                  </span>
                )}
                {inputLimit !== undefined ? (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    limit: {inputLimit}
                  </span>
                ) : (
                  <span className="rounded-full border border-dashed border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    limit: not set
                  </span>
                )}
                {data?.truncated && (
                  <span
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                    title="Output was cut at the line limit"
                  >
                    ⚠ truncated
                  </span>
                )}
                {data?.truncated_lines ? (
                  <span
                    className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]"
                    title="Lines cut at the maximum line length"
                  >
                    {data.truncated_lines} long line{data.truncated_lines === 1 ? "" : "s"} cut
                  </span>
                ) : null}
              </div>

              <pre className="max-h-80 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                {data?.content || "(empty file)"}
              </pre>

              <p className="text-[10px] text-[var(--color-muted)]">
                {data?.line_count ?? 0} of {data?.total_lines ?? 0} lines
                {data?.first_line != null && data?.last_line != null
                  ? ` · lines ${data.first_line}–${data.last_line}`
                  : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadImageChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ReadImageToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const isUrl = data?.source === "url" || /^https?:\/\//i.test(data?.file_path ?? "");

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <ImageIcon className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  const sourceLabel = isUrl ? "URL" : "workspace";

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              Read failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="flex min-w-0 items-center gap-1 font-medium text-[var(--color-fg)]">
                  {isUrl ? (
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                  )}
                  <span className="truncate font-mono">{data?.file_path}</span>
                </span>
                <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                  source: {sourceLabel}
                </span>
                {data?.content_type && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {data.content_type}
                  </span>
                )}
                {data?.size_bytes != null && (
                  <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                    {(data.size_bytes / 1024).toFixed(data.size_bytes < 1024 ? 0 : 1)} KB
                  </span>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
                The image was attached to the model's vision input for analysis.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ImageSearchResultItem {
  title?: string;
  image_url?: string;
  source_url?: string;
}

interface ImageSearchToolResult {
  ok?: boolean;
  data?: {
    query?: string;
    provider?: string;
    result_count?: number;
    results?: ImageSearchResultItem[];
  };
  error?: { code?: string; message?: string };
}

function ImageSearchChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ImageSearchToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const results = data?.results ?? [];
  const query = data?.query;
  const provider = data?.provider;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <ImageIcon className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Image search failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : results.length === 0 ? (
            <p className="text-[var(--color-muted)]">No images found.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
                <span className="font-medium text-[var(--color-fg)]">
                  {results.length} image{results.length === 1 ? "" : "s"}
                </span>
                {provider && <span>· {PROVIDER_LABELS[provider] ?? provider}</span>}
                {query && (
                  <span className="min-w-0 truncate" title={query}>
                    · “{query}”
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {results.map((item, i) => (
                  <a
                    key={`${item.image_url ?? "image"}-${i}`}
                    href={item.source_url ?? item.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 transition hover:border-[var(--color-accent)]/50"
                  >
                    <span className="relative block aspect-square w-full overflow-hidden bg-[var(--color-bg-elev)]">
                      <img
                        src={item.image_url}
                        alt={item.title ?? query ?? "image"}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.opacity = "0.2";
                        }}
                        className="h-full w-full object-cover transition group-hover:opacity-80"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1 border-t border-[var(--color-border)] px-2 py-1.5">
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-accent)]" />
                      <span className="block truncate text-[10px] text-[var(--color-muted)]">
                        {item.title || "Image result"}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListSubAgentsChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ListToolResult | undefined;
  const agents = result?.ok ? result.data?.available_sub_agents ?? [] : [];
  const hasResult = tool.status !== "running" && Boolean(result);

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <ListTree className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {agents.length === 0 ? (
            <p className="text-[var(--color-muted)]">No sub-agents available.</p>
          ) : (
            <ul className="space-y-1.5">
              {agents.map((a, i) => (
                <li
                  key={`${a.name ?? "agent"}-${i}`}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                >
                  <span className="flex items-center gap-1.5 font-medium text-[var(--color-accent)]">
                    <Bot className="h-3 w-3" />
                    {a.name}
                  </span>
                  {a.description && (
                    <span className="mt-0.5 block leading-relaxed text-[var(--color-muted)]">
                      {a.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ListSkillsChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as ListSkillsToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const skills = result?.ok ? result.data?.skills ?? [] : [];
  const error = result && !result.ok ? result.error : undefined;

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <Blocks className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && skills.length > 0 && (
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {skills.length}
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="text-red-300">
              List skills failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : skills.length === 0 ? (
            <p className="text-[var(--color-muted)]">No skills available.</p>
          ) : (
            <ul className="space-y-2">
              {skills.map((skill, i) => (
                <li
                  key={`${skill.name ?? "skill"}-${i}`}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2"
                >
                  <span className="flex items-center gap-1.5 font-mono font-medium text-[var(--color-accent)]">
                    <Blocks className="h-3 w-3" />
                    {skill.name}
                  </span>
                  {skill.description && (
                    <span className="mt-0.5 block leading-relaxed text-[var(--color-muted)]">
                      {skill.description}
                    </span>
                  )}
                  {skill.tree ? (
                    <pre className="mt-1.5 max-h-60 overflow-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
                      {skill.tree}
                    </pre>
                  ) : (
                    skill.files &&
                    skill.files.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {skill.files.map((f) => (
                          <span
                            key={f}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {f}
                          </span>
                        ))}
                      </div>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SkillInitializeChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const result = tool.result as SkillInitializeToolResult | undefined;
  const hasResult = tool.status !== "running" && Boolean(result);
  const data = result?.ok ? result.data : undefined;
  const error = result && !result.ok ? result.error : undefined;
  const initialized = data?.initialized ?? [];
  const failed = data?.failed ?? [];

  const chip = (
    <button
      type="button"
      disabled={!hasResult}
      onClick={() => setOpen((v) => !v)}
      aria-expanded={hasResult ? open : undefined}
      className={chipClasses(tool.status, hasResult)}
      title={tool.label}
    >
      <PackagePlus className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {hasResult && initialized.length > 0 && (
        <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">
          {initialized.length} ok
        </span>
      )}
      {hasResult && failed.length > 0 && (
        <span className="rounded-full border border-red-500/40 px-1.5 py-0.5 text-[10px] text-red-300">
          {failed.length} failed
        </span>
      )}
      {hasResult && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      )}
      <StatusIcon status={tool.status} />
    </button>
  );

  if (!hasResult) return chip;

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          {error ? (
            <p className="whitespace-pre-wrap text-red-300">
              Initialize failed: {error.message ?? error.code ?? "unknown error"}
            </p>
          ) : (
            <>
              {initialized.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Initialized
                  </div>
                  <ul className="space-y-1.5">
                    {initialized.map((skill, i) => (
                      <li
                        key={`${skill.skill_name ?? "skill"}-${i}`}
                        className="rounded-lg border border-emerald-500/25 bg-[var(--color-bg-elev2)]/60 p-2"
                      >
                        <span className="flex items-center gap-1.5 font-mono font-medium text-[var(--color-fg)]">
                          <FolderTreeIcon className="h-3 w-3 text-emerald-400" />
                          {skill.skill_name}
                        </span>
                        {skill.path && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--color-muted)]">
                            {skill.path}
                          </span>
                        )}
                        {skill.files && skill.files.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {skill.files.map((f) => (
                              <span
                                key={f}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-mono",
                                  f === skill.skill_file
                                    ? "border-[var(--color-accent)]/40 text-[var(--color-accent)]"
                                    : "border-[var(--color-border)] text-[var(--color-muted)]",
                                )}
                              >
                                <FileText className="h-2.5 w-2.5" />
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {failed.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Failed
                  </div>
                  <ul className="space-y-1.5">
                    {failed.map((skill, i) => (
                      <li
                        key={`${skill.skill_name ?? "skill"}-${i}`}
                        className="rounded-lg border border-red-500/30 bg-red-500/5 p-2"
                      >
                        <span className="font-mono font-medium text-red-300">
                          {skill.skill_name}
                        </span>
                        {skill.error && (
                          <span className="mt-0.5 block leading-relaxed text-[var(--color-muted)]">
                            {skill.error}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {initialized.length === 0 && failed.length === 0 && (
                <p className="text-[var(--color-muted)]">No skills initialized.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SubAgentChip({ tool, run }: { tool: ToolActivity; run: SubAgentRun }) {
  const [open, setOpen] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const chip = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={chipClasses(run.status, true)}
      title={tool.label}
    >
      <Bot className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">
        Sub-Agent: {run.agent}
        {run.session ? ` · ${run.session}` : ""}
      </span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform",
          open && "rotate-180",
        )}
      />
      <StatusIcon status={run.status} />
    </button>
  );

  return (
    <div className="w-full">
      {chip}
      {open && (
        <div className="mt-1.5 w-full space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]/80 p-3 text-xs fade-in">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--color-muted)]">
            <span className="flex items-center gap-1 font-medium text-[var(--color-fg)]">
              <Bot className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              {run.agent}
            </span>
            {run.session && (
              <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px]">
                session: {run.session}
              </span>
            )}
          </div>

          {run.task && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Task
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 leading-relaxed text-[var(--color-fg)]">
                {run.task}
              </div>
            </div>
          )}

          {run.reasoning.trim().length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]/60">
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", showReasoning && "rotate-90")}
                />
                Reasoning
              </button>
              {showReasoning && (
                <div className="whitespace-pre-wrap px-2.5 pb-2.5 leading-relaxed text-[var(--color-muted)]">
                  {run.reasoning}
                </div>
              )}
            </div>
          )}

          {run.tools.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Tools
              </div>
              <div className="flex flex-wrap gap-1.5">
                {run.tools.map((t) => (
                  <ToolChip key={t.id} tool={t} />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Output
            </div>
            {run.output.trim().length > 0 ? (
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)]/60 p-2 leading-relaxed text-[var(--color-fg)]",
                  run.status === "running" && "caret",
                )}
              >
                {run.output}
              </div>
            ) : run.status === "running" ? (
              <div className="flex items-center gap-2 text-[var(--color-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent-2)]" />
                Working…
              </div>
            ) : (
              <p className="text-[var(--color-muted)]">No output.</p>
            )}
          </div>

          {run.error && <p className="text-red-300">⚠️ {run.error}</p>}
        </div>
      )}
    </div>
  );
}
