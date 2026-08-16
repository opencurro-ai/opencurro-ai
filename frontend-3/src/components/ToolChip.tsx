import { useState } from "react";
import {
  FilePlus2,
  FileText,
  FolderTree,
  Pencil,
  Terminal,
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
} from "lucide-react";
import type { ReadImageToolResult, SubAgentRun, ToolActivity } from "@/types";
import { cn } from "@/utils/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file_write: FilePlus2,
  file_read: FileText,
  file_list: FolderTree,
  str_replace: Pencil,
  shall_tool: Terminal,
  web_search: Globe,
  fatch_web_urls: Globe,
  read_image: ImageIcon,
  call_sub_agent: Bot,
  list_sub_agents: ListTree,
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

const PROVIDER_LABELS: Record<string, string> = {
  tavily: "Tavily",
  exa: "Exa",
  serpapi: "SerpAPI",
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
  // A call_sub_agent chip renders the live sub-agent block once its run has started.
  if (tool.name === "call_sub_agent" && tool.subAgent) {
    return <SubAgentChip tool={tool} run={tool.subAgent} />;
  }
  if (tool.name === "list_sub_agents") {
    return <ListSubAgentsChip tool={tool} />;
  }
  if (tool.name === "file_read") {
    return <FileReadChip tool={tool} />;
  }
  if (tool.name === "read_image") {
    return <ReadImageChip tool={tool} />;
  }
  return <RegularChip tool={tool} />;
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
