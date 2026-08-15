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
  Globe,
  ExternalLink,
} from "lucide-react";
import type { ToolActivity } from "@/types";
import { cn } from "@/utils/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file_write: FilePlus2,
  file_read: FileText,
  file_list: FolderTree,
  str_replace: Pencil,
  shall_tool: Terminal,
  web_search: Globe,
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

const PROVIDER_LABELS: Record<string, string> = {
  tavily: "Tavily",
  exa: "Exa",
  serpapi: "SerpAPI",
};

export function ToolChip({ tool }: { tool: ToolActivity }) {
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
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs fade-in",
        "bg-[var(--color-bg-elev2)]",
        tool.status === "error"
          ? "border-red-500/40 text-red-300"
          : tool.status === "ok"
            ? "border-emerald-500/30 text-[var(--color-fg)]"
            : "border-[var(--color-accent)]/40 text-[var(--color-fg)]",
        hasResult && "cursor-pointer hover:border-[var(--color-accent)]/60",
      )}
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
      {tool.status === "running" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent-2)]" />
      ) : tool.status === "ok" ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <X className="h-3.5 w-3.5 text-red-400" />
      )}
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
