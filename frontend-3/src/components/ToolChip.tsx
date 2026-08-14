import {
  FilePlus2,
  FileText,
  FolderTree,
  Pencil,
  Terminal,
  Loader2,
  Check,
  X,
} from "lucide-react";
import type { ToolActivity } from "@/types";
import { cn } from "@/utils/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  file_write: FilePlus2,
  file_read: FileText,
  file_list: FolderTree,
  str_replace: Pencil,
  shall_tool: Terminal,
};

export function ToolChip({ tool }: { tool: ToolActivity }) {
  const Icon = ICONS[tool.name] ?? Terminal;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs fade-in",
        "bg-[var(--color-bg-elev2)]",
        tool.status === "error"
          ? "border-red-500/40 text-red-300"
          : tool.status === "ok"
            ? "border-emerald-500/30 text-[var(--color-fg)]"
            : "border-[var(--color-accent)]/40 text-[var(--color-fg)]",
      )}
      title={tool.label}
    >
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="max-w-[280px] truncate font-medium">{tool.label}</span>
      {tool.status === "running" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent-2)]" />
      ) : tool.status === "ok" ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <X className="h-3.5 w-3.5 text-red-400" />
      )}
    </div>
  );
}
