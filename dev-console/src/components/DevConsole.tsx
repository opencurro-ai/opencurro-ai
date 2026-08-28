import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  Braces,
  ChevronRight,
  Cpu,
  Eraser,
  ExternalLink,
  Filter,
  Radio,
  Search,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { AgentActivity, DevLogEntry } from "@/types";
import { cn } from "@/utils/cn";

/** Max rows rendered after filtering (keeps the DOM light even with thousands of events). */
const RENDER_CAP = 800;

type KindFilter = "all" | "sse" | "http" | "system";

const KIND_FILTERS: Array<{ id: KindFilter; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "all", label: "All", icon: Filter },
  { id: "sse", label: "Events", icon: Zap },
  { id: "http", label: "Network", icon: Wifi },
  { id: "system", label: "System", icon: Terminal },
];

/** HH:MM:SS.mmm in local time. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Colour accent per SSE event family so the stream is scannable at a glance. */
function eventColor(event: string | undefined): string {
  if (!event) return "text-[var(--color-muted)]";
  if (event === "error") return "text-red-300";
  if (event === "done") return "text-emerald-300";
  if (event.startsWith("tool")) return "text-[var(--color-accent-2)]";
  if (event.startsWith("sub_agent")) return "text-purple-300";
  if (event === "token" || event === "message_complete") return "text-[var(--color-fg)]";
  if (event === "reasoning") return "text-amber-300";
  if (event === "iteration" || event === "status") return "text-sky-300";
  return "text-[var(--color-accent)]";
}

function truncate(value: string, max = 120): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** One-line human summary of an SSE payload for the collapsed row. */
function sseSummary(entry: DevLogEntry): string {
  const d = (entry.data ?? {}) as Record<string, unknown>;
  switch (entry.event) {
    case "token":
    case "reasoning":
    case "sub_agent_token":
    case "sub_agent_reasoning":
      return truncate(String(d.value ?? ""));
    case "tool_call":
    case "sub_agent_tool_call":
      return `${String(d.name ?? "tool")} — ${truncate(String(d.label ?? ""), 60)}`;
    case "tool_result":
    case "sub_agent_tool_result":
      return `${String(d.name ?? "tool")} → ${d.ok ? "ok" : "error"}`;
    case "iteration":
      return `${Number(d.current ?? 0)} / ${Number(d.limit ?? 0)}`;
    case "status":
      return String(d.label ?? d.state ?? "");
    case "sub_agent_start":
      return `${String(d.agent ?? "")} · ${truncate(String(d.task ?? ""), 60)}`;
    case "sub_agent_done":
      return d.ok ? "ok" : `error: ${truncate(String(d.error ?? ""), 60)}`;
    case "embed_url":
      return String(d.url ?? "");
    case "error":
      return truncate(String(d.message ?? d.code ?? "agent error"));
    case "message_complete":
      return truncate(String(d.content ?? ""), 80);
    default:
      return "";
  }
}

const PHASE_STYLES: Record<AgentActivity["phase"], { label: string; dot: string; text: string }> = {
  idle: { label: "Idle", dot: "bg-[var(--color-muted)]", text: "text-[var(--color-muted)]" },
  starting: { label: "Starting", dot: "bg-sky-400", text: "text-sky-300" },
  thinking: { label: "Thinking", dot: "bg-sky-400", text: "text-sky-300" },
  reasoning: { label: "Reasoning", dot: "bg-amber-400", text: "text-amber-300" },
  responding: { label: "Responding", dot: "bg-emerald-400", text: "text-emerald-300" },
  tool: { label: "Tool", dot: "bg-[var(--color-accent-2)]", text: "text-[var(--color-accent-2)]" },
  sub_agent: { label: "Sub-agent", dot: "bg-purple-400", text: "text-purple-300" },
  waiting: { label: "Waiting", dot: "bg-amber-400", text: "text-amber-300" },
  done: { label: "Done", dot: "bg-emerald-400", text: "text-emerald-300" },
  error: { label: "Error", dot: "bg-red-400", text: "text-red-300" },
};

function StatusBadge({ status, ok }: { status?: number; ok?: boolean }) {
  if (status == null) {
    return (
      <span className="rounded border border-[var(--color-border)] px-1 text-[10px] text-[var(--color-muted)]">
        {ok === false ? "ERR" : "—"}
      </span>
    );
  }
  const good = status >= 200 && status < 400;
  return (
    <span
      className={cn(
        "rounded border px-1 text-[10px] font-medium tabular-nums",
        good
          ? "border-emerald-500/40 text-emerald-300"
          : "border-red-500/40 bg-red-500/10 text-red-300",
      )}
    >
      {status}
    </span>
  );
}

/** The live "what is the LLM doing right now" card at the top of the console. */
function ActivityCard() {
  const activity = useStore((s) => s.agentActivity);
  const streaming = useStore((s) => s.streaming);
  const style = PHASE_STYLES[activity.phase];
  const active = streaming || (activity.phase !== "idle" && activity.phase !== "done" && activity.phase !== "error");

  const pct =
    activity.maxIterations > 0
      ? Math.min(100, Math.round((activity.iteration / activity.maxIterations) * 100))
      : 0;

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]/60 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-[var(--color-muted)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          LLM activity
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {active && (
            <span
              className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", style.dot)}
            />
          )}
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", style.dot)} />
        </span>
        <span className={cn("text-sm font-semibold", style.text)}>{style.label}</span>
        {activity.maxIterations > 0 && (
          <span className="ml-auto font-mono text-[10px] text-[var(--color-muted)] tabular-nums">
            iter {activity.iteration}/{activity.maxIterations}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-[var(--color-muted)]" title={activity.detail}>
        {activity.detail}
      </p>
      {activity.maxIterations > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-elev2)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Card surfacing the URL the agent last asked to observe (embed_url). */
function ObservedUrlCard() {
  const observedUrl = useStore((s) => s.observedUrl);
  const setPreview = useStore((s) => s.setPreview);
  const setPreviewOpen = useStore((s) => s.setPreviewOpen);
  if (!observedUrl) return null;

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]/40 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-[var(--color-accent-2)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Observing URL
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setPreview(observedUrl);
            setPreviewOpen(true);
          }}
          className="min-w-0 flex-1 truncate text-left font-mono text-xs text-[var(--color-accent)] hover:underline"
          title={observedUrl}
        >
          {observedUrl}
        </button>
        <a
          href={observedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: DevLogEntry }) {
  const [open, setOpen] = useState(false);

  const raw =
    entry.kind === "http"
      ? { method: entry.method, url: entry.url, status: entry.status, ok: entry.ok, durationMs: entry.durationMs, streaming: entry.streaming, requestBody: entry.requestBody, message: entry.message }
      : entry.kind === "sse"
        ? { event: entry.event, eventId: entry.eventId, scope: entry.scope, data: entry.data }
        : { message: entry.message };

  const summary = entry.kind === "sse" ? sseSummary(entry) : entry.kind === "http" ? (entry.url ?? "") : (entry.message ?? "");
  const path = entry.kind === "http" && entry.url ? entry.url.replace(/^https?:\/\/[^/]+/, "") : "";

  return (
    <div className="border-b border-[var(--color-border)]/50 font-mono text-[11px] leading-relaxed">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-2 py-1 text-left hover:bg-[var(--color-bg-elev2)]/40"
      >
        <ChevronRight
          className={cn(
            "mt-0.5 h-3 w-3 shrink-0 text-[var(--color-muted)] transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="shrink-0 text-[var(--color-muted)] tabular-nums">{formatTime(entry.ts)}</span>

        {entry.kind === "sse" && (
          <>
            <span className={cn("shrink-0 font-semibold", eventColor(entry.event))}>{entry.event}</span>
            {summary && <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{summary}</span>}
          </>
        )}

        {entry.kind === "http" && (
          <>
            <span className="shrink-0 font-semibold text-[var(--color-accent)]">{entry.method}</span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]" title={entry.url}>
              {path || entry.url}
            </span>
            {entry.durationMs != null && (
              <span className="shrink-0 text-[var(--color-muted)] tabular-nums">{entry.durationMs}ms</span>
            )}
            {entry.streaming ? (
              <span className="shrink-0 rounded border border-[var(--color-accent)]/40 px-1 text-[10px] text-[var(--color-accent)]">
                SSE
              </span>
            ) : (
              <StatusBadge status={entry.status} ok={entry.ok} />
            )}
          </>
        )}

        {entry.kind === "system" && (
          <>
            <span
              className={cn(
                "shrink-0 font-semibold",
                entry.level === "error" ? "text-red-300" : entry.level === "warn" ? "text-amber-300" : "text-[var(--color-muted)]",
              )}
            >
              system
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{summary}</span>
          </>
        )}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--color-border)]/50 bg-[var(--color-bg-elev2)]/50 px-3 py-2 text-[10px] leading-relaxed text-[var(--color-fg)]">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function DevConsole() {
  const devLog = useStore((s) => s.devLog);
  const clearDevLog = useStore((s) => s.clearDevLog);
  const streaming = useStore((s) => s.streaming);

  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = devLog.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (!q) return true;
      if (e.kind === "sse") {
        return (
          (e.event ?? "").toLowerCase().includes(q) ||
          JSON.stringify(e.data ?? "").toLowerCase().includes(q)
        );
      }
      if (e.kind === "http") {
        return (
          (e.url ?? "").toLowerCase().includes(q) ||
          (e.method ?? "").toLowerCase().includes(q) ||
          String(e.status ?? "").includes(q)
        );
      }
      return (e.message ?? "").toLowerCase().includes(q);
    });
    return rows.length > RENDER_CAP ? rows.slice(rows.length - RENDER_CAP) : rows;
  }, [devLog, kind, query]);

  // Auto-scroll to the newest row while "follow" is on.
  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, follow]);

  const counts = useMemo(() => {
    let sse = 0;
    let http = 0;
    let system = 0;
    for (const e of devLog) {
      if (e.kind === "sse") sse++;
      else if (e.kind === "http") http++;
      else system++;
    }
    return { sse, http, system, total: devLog.length };
  }, [devLog]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg-elev)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)]">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold">Dev Console</div>
            <div className="text-[10px] text-[var(--color-muted)]">agent observability</div>
          </div>
        </div>
        <button
          onClick={clearDevLog}
          className="flex h-7 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-[10px] text-[var(--color-muted)] transition hover:border-red-500/50 hover:text-red-300"
          title="Clear the event stream"
        >
          <Eraser className="h-3 w-3" />
          Clear
        </button>
      </div>

      <ActivityCard />
      <ObservedUrlCard />

      {/* Filter bar */}
      <div className="space-y-2 border-b border-[var(--color-border)] p-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-2">
          <Search className="h-3.5 w-3.5 text-[var(--color-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter events, urls, payloads…"
            className="h-7 w-full bg-transparent text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)]"
          />
        </div>
        <div className="flex items-center gap-1">
          {KIND_FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setKind(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] transition",
                kind === id
                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-fg)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
              title={label}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stream */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[var(--color-muted)]">
            <Braces className="h-6 w-6 opacity-40" />
            <p className="text-xs">
              {devLog.length === 0
                ? "No activity yet. Send a message to watch the agent work."
                : "No events match this filter."}
            </p>
          </div>
        ) : (
          filtered.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-2 py-1.5 text-[10px] text-[var(--color-muted)]">
        <div className="flex items-center gap-2 tabular-nums">
          <span className={cn("flex items-center gap-1", streaming && "text-[var(--color-accent)]")}>
            <Zap className="h-3 w-3" />
            {counts.sse}
          </span>
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            {counts.http}
          </span>
          <span className="flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            {counts.system}
          </span>
        </div>
        <button
          onClick={() => setFollow((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 transition",
            follow ? "text-[var(--color-accent)]" : "hover:text-[var(--color-fg)]",
          )}
          title={follow ? "Auto-follow is on" : "Auto-follow is off"}
        >
          <ArrowDownToLine className="h-3 w-3" />
          {follow ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}
