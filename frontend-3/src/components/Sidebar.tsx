import { MessageSquarePlus, Trash2, PanelLeftClose, MessageSquare } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";

export function Sidebar() {
  const conversations = useStore((s) => s.conversations);
  const currentId = useStore((s) => s.currentId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  if (!sidebarOpen) return null;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)]">
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          onClick={() => newConversation()}
          className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm font-medium transition hover:border-[var(--color-accent)]/50"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[var(--color-muted)]">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                    conv.id === currentId
                      ? "bg-[var(--color-bg-elev2)] text-[var(--color-fg)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-bg-elev2)]/60 hover:text-[var(--color-fg)]",
                  )}
                >
                  <button
                    onClick={() => selectConversation(conv.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="shrink-0 text-[var(--color-muted)] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] p-3 text-[11px] text-[var(--color-muted)]">
        Curro AI · local coding agent
      </div>
    </aside>
  );
}
