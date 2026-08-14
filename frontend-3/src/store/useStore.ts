import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChatMessage,
  Conversation,
  ModelInfo,
  ProviderMeta,
  Settings,
  ToolActivity,
} from "@/types";
import { uid } from "@/utils/id";

interface AppState {
  // Persisted
  conversations: Conversation[];
  currentId: string | null;
  settings: Settings;

  // Ephemeral UI
  providers: ProviderMeta[];
  models: ModelInfo[];
  modelsLoading: boolean;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  streaming: boolean;
  filesVersion: number;

  // Actions — conversations
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  ensureConversation: () => string;

  // Actions — messages
  addMessage: (convId: string, message: ChatMessage) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  appendToken: (convId: string, msgId: string, token: string) => void;
  appendReasoning: (convId: string, msgId: string, token: string) => void;
  upsertTool: (convId: string, msgId: string, tool: ToolActivity) => void;

  // Actions — settings & UI
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (provider: string, key: string) => void;
  setProviders: (p: ProviderMeta[]) => void;
  setModels: (m: ModelInfo[]) => void;
  setModelsLoading: (v: boolean) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  bumpFiles: () => void;
}

const defaultSettings: Settings = {
  provider: "openrouter",
  model: "",
  apiKeys: {},
  baseUrl: "",
};

function touch(conv: Conversation): Conversation {
  return { ...conv, updatedAt: Date.now() };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentId: null,
      settings: defaultSettings,

      providers: [],
      models: [],
      modelsLoading: false,
      sidebarOpen: true,
      settingsOpen: false,
      streaming: false,
      filesVersion: 0,

      newConversation: () => {
        const id = uid("conv");
        const conv: Conversation = {
          id,
          title: "New chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ conversations: [conv, ...s.conversations], currentId: id }));
        return id;
      },

      ensureConversation: () => {
        const { currentId } = get();
        if (currentId && get().conversations.some((c) => c.id === currentId)) return currentId;
        return get().newConversation();
      },

      selectConversation: (id) => set({ currentId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const currentId = s.currentId === id ? (conversations[0]?.id ?? null) : s.currentId;
          return { conversations, currentId };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
        })),

      addMessage: (convId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? touch({ ...c, messages: [...c.messages, message] }) : c,
          ),
        })),

      updateMessage: (convId, msgId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
                }
              : c,
          ),
        })),

      appendToken: (convId, msgId, token) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + token } : m,
                  ),
                }
              : c,
          ),
        })),

      appendReasoning: (convId, msgId, token) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, reasoning: (m.reasoning ?? "") + token } : m,
                  ),
                }
              : c,
          ),
        })),

      upsertTool: (convId, msgId, tool) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) => {
                    if (m.id !== msgId) return m;
                    const tools = m.tools ? [...m.tools] : [];
                    const idx = tools.findIndex((t) => t.id === tool.id);
                    if (idx === -1) tools.push(tool);
                    else tools[idx] = { ...tools[idx], ...tool };
                    return { ...m, tools };
                  }),
                }
              : c,
          ),
        })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setApiKey: (provider, key) =>
        set((s) => ({
          settings: { ...s.settings, apiKeys: { ...s.settings.apiKeys, [provider]: key } },
        })),
      setProviders: (providers) => set({ providers }),
      setModels: (models) => set({ models }),
      setModelsLoading: (modelsLoading) => set({ modelsLoading }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setStreaming: (streaming) => set({ streaming }),
      bumpFiles: () => set((s) => ({ filesVersion: s.filesVersion + 1 })),
    }),
    {
      name: "curro-ai-frontend",
      partialize: (s) => ({
        conversations: s.conversations,
        currentId: s.currentId,
        settings: s.settings,
      }),
    },
  ),
);
