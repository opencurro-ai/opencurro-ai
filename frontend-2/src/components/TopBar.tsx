"use client";

import { PanelLeftOpen, Settings, Sparkles, PanelRight } from "lucide-react";
import { useStore } from "@/store/useStore";

export function TopBar({ onToggleFiles }: { onToggleFiles: () => void }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]/50 px-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
            title="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold">Curro AI</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="hidden items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:text-[var(--color-fg)] sm:flex"
          title="Settings"
        >
          <span className="max-w-[160px] truncate">
            {settings.model ? `${settings.provider} · ${settings.model}` : "No model selected"}
          </span>
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleFiles}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)] lg:hidden"
          title="Toggle file explorer"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
