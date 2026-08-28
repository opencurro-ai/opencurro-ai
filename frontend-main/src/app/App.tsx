import { useEffect, useRef } from "react";
import { Rail } from "@/components/Rail";
import { TopBar } from "@/components/TopBar";
import { Composer } from "@/components/Composer";
import { NetworkBanner } from "@/components/NetworkBanner";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { KnowledgePanel } from "@/components/panels/KnowledgePanel";
import { AgentsPanel } from "@/components/panels/AgentsPanel";
import { SkillsPanel } from "@/components/panels/SkillsPanel";
import { SettingsModal } from "@/components/editors/SettingsModal";
import { TodoPanel } from "@/components/overlays/TodoPanel";
import { FilesPanel } from "@/components/overlays/FilesPanel";
import { PreviewPanel } from "@/components/overlays/PreviewPanel";
import { useStore } from "@/store/useStore";
import { useChatStream, useConnectionWatch } from "@/hooks/useChatStream";
import { fetchProviders } from "@/lib/api";

export function App() {
  const section = useStore((s) => s.section);
  const setProviders = useStore((s) => s.setProviders);
  const ensureConversation = useStore((s) => s.ensureConversation);
  const { send, resume, stop } = useChatStream();
  const resumedRef = useRef(false);

  useConnectionWatch();

  useEffect(() => {
    ensureConversation();
    fetchProviders().then(setProviders).catch(() => {});
  }, [ensureConversation, setProviders]);

  // Re-attach to a run the backend may still be executing (survives refresh/close/reconnect).
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const run = useStore.getState().activeRun;
    if (run) void resume(run);
  }, [resume]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="relative flex min-h-0 flex-1 flex-col">
          {section === "chat" && <ChatPanel onSend={send} />}
          {section !== "chat" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-[640px]:px-4">
              {section === "memory" && <MemoryPanel />}
              {section === "knowledge" && <KnowledgePanel />}
              {section === "agents" && <AgentsPanel />}
              {section === "skills" && <SkillsPanel />}
            </div>
          )}
        </main>

        <Composer onSend={send} onStop={stop} />
      </div>

      <NetworkBanner />
      <SettingsModal />
      <TodoPanel />
      <FilesPanel />
      <PreviewPanel />
    </div>
  );
}
