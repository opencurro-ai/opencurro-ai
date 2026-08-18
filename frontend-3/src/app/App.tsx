import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ChatPanel } from "@/components/ChatPanel";
import { FileExplorer } from "@/components/FileExplorer";
import { SettingsModal } from "@/components/SettingsModal";
import { SubAgentsManager } from "@/components/SubAgentsManager";
import { SkillsManager } from "@/components/SkillsManager";
import { useStore } from "@/store/useStore";
import { fetchProviders } from "@/lib/api";
import { cn } from "@/utils/cn";

export function App() {
  const setProviders = useStore((s) => s.setProviders);
  const ensureConversation = useStore((s) => s.ensureConversation);
  const [filesOpenMobile, setFilesOpenMobile] = useState(false);

  useEffect(() => {
    ensureConversation();
    fetchProviders().then(setProviders).catch(() => {});
  }, [ensureConversation, setProviders]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleFiles={() => setFilesOpenMobile((v) => !v)} />
        <ChatPanel />
      </main>

      {/* File explorer — persistent on large screens */}
      <aside className="hidden w-80 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] lg:block">
        <FileExplorer />
      </aside>

      {/* File explorer — drawer on smaller screens */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          filesOpenMobile ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            filesOpenMobile ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setFilesOpenMobile(false)}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-80 max-w-[85%] border-l border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl transition-transform",
            filesOpenMobile ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Files
            </span>
            <button onClick={() => setFilesOpenMobile(false)} className="text-[var(--color-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-41px)]">
            <FileExplorer />
          </div>
        </aside>
      </div>

      <SettingsModal />
      <SubAgentsManager />
      <SkillsManager />
    </div>
  );
}
