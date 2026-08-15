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
} from "lucide-react";
import type { SubAgentRun, ToolActivity } from "@/types";
import { cn } from "@/utils/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file_write: FilePlus2,
  file_read: FileText,
  file_list: FolderTree,
  str_replace: Pencil,
  shall_tool: Terminal,
  web_search: Globe,
  fatch_web_urls: Globe,
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
