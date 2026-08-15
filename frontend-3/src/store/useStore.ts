import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChatMessage,
  Conversation,
  ModelInfo,
  ProviderMeta,
  SearchProvider,
  Settings,
  SubAgent,
  SubAgentRun,
  ToolActivity,
} from "@/types";
import { uid } from "@/utils/id";

interface AppState {
  // Persisted
  conversations: Conversation[];
  currentId: string | null;
  settings: Settings;
  subAgents: SubAgent[];

  // Ephemeral UI
  providers: ProviderMeta[];
  models: ModelInfo[];
  modelsLoading: boolean;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  subAgentsOpen: boolean;
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

  // Actions — sub-agent live runs (attached to a call_sub_agent tool chip)
  startSubAgent: (
    convId: string,
    msgId: string,
    toolId: string,
    run: Pick<SubAgentRun, "session" | "agent" | "task">,
  ) => void;
  appendSubAgentToken: (convId: string, msgId: string, toolId: string, token: string) => void;
  appendSubAgentReasoning: (convId: string, msgId: string, toolId: string, token: string) => void;
  upsertSubAgentTool: (convId: string, msgId: string, toolId: string, tool: ToolActivity) => void;
  finishSubAgent: (
    convId: string,
    msgId: string,
    toolId: string,
    patch: { status: SubAgentRun["status"]; output?: string; error?: string },
  ) => void;

  // Actions — custom sub-agent management (persisted in the browser)
  addSubAgent: (input: Omit<SubAgent, "id" | "createdAt" | "updatedAt">) => void;
  updateSubAgent: (id: string, patch: Partial<Omit<SubAgent, "id" | "createdAt">>) => void;
  deleteSubAgent: (id: string) => void;
  toggleSubAgent: (id: string) => void;

  // Actions — settings & UI
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (provider: string, key: string) => void;
  setSearchProvider: (provider: SearchProvider) => void;
  setSearchApiKey: (
    provider: "tavily" | "exa" | "serpapi" | "firecrawl",
    key: string,
  ) => void;
  setProviders: (p: ProviderMeta[]) => void;
  setModels: (m: ModelInfo[]) => void;
  setModelsLoading: (v: boolean) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (v: boolean) => void;
  setSubAgentsOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  bumpFiles: () => void;
}

const defaultSettings: Settings = {
  provider: "openrouter",
  model: "",
  apiKeys: {},
  baseUrl: "",
  searchProvider: "tavily",
  tavilyApiKey: "",
  exaApiKey: "",
  serpapiApiKey: "",
  firecrawlApiKey: "",
};

function touch(conv: Conversation): Conversation {
  return { ...conv, updatedAt: Date.now() };
}

/** Immutably update a single tool (by id) inside a single message (by id) inside a conversation. */
function patchTool(
  conversations: Conversation[],
  convId: string,
  msgId: string,
  toolId: string,
  updater: (tool: ToolActivity) => ToolActivity,
  createIfMissing?: () => ToolActivity,
): Conversation[] {
  return conversations.map((c) =>
    c.id === convId
      ? {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId) return m;
            const tools = m.tools ? [...m.tools] : [];
            const idx = tools.findIndex((t) => t.id === toolId);
            if (idx === -1) {
              if (!createIfMissing) return m;
              tools.push(updater(createIfMissing()));
            } else {
              tools[idx] = updater(tools[idx]);
            }
            return { ...m, tools };
          }),
        }
      : c,
  );
}

const emptyRun = (
  run: Pick<SubAgentRun, "session" | "agent" | "task">,
): SubAgentRun => ({
  session: run.session,
  agent: run.agent,
  task: run.task,
  reasoning: "",
  output: "",
  tools: [],
  status: "running",
});

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentId: null,
      settings: defaultSettings,
      subAgents: [],

      providers: [],
      models: [],
      modelsLoading: false,
      sidebarOpen: true,
      settingsOpen: false,
      subAgentsOpen: false,
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

      startSubAgent: (convId, msgId, toolId, run) =>
        set((s) => ({
          conversations: patchTool(
            s.conversations,
            convId,
            msgId,
            toolId,
            (tool) => ({
              ...tool,
              subAgent: tool.subAgent
                ? { ...tool.subAgent, session: run.session, agent: run.agent, task: run.task }
                : emptyRun(run),
            }),
            () => ({
              id: toolId,
              name: "call_sub_agent",
              label: `Sub-Agent: ${run.agent}${run.session ? ` (${run.session})` : ""}`,
              status: "running",
              subAgent: emptyRun(run),
            }),
          ),
        })),

      appendSubAgentToken: (convId, msgId, toolId, token) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) => {
            const run = tool.subAgent ?? emptyRun({ session: "", agent: "", task: "" });
            return { ...tool, subAgent: { ...run, output: run.output + token } };
          }),
        })),

      appendSubAgentReasoning: (convId, msgId, toolId, token) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) => {
            const run = tool.subAgent ?? emptyRun({ session: "", agent: "", task: "" });
            return { ...tool, subAgent: { ...run, reasoning: run.reasoning + token } };
          }),
        })),

      upsertSubAgentTool: (convId, msgId, toolId, subTool) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) => {
            const run = tool.subAgent ?? emptyRun({ session: "", agent: "", task: "" });
            const tools = [...run.tools];
            const idx = tools.findIndex((t) => t.id === subTool.id);
            if (idx === -1) tools.push(subTool);
            else tools[idx] = { ...tools[idx], ...subTool };
            return { ...tool, subAgent: { ...run, tools } };
          }),
        })),

      finishSubAgent: (convId, msgId, toolId, patch) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) => {
            const run = tool.subAgent ?? emptyRun({ session: "", agent: "", task: "" });
            return {
              ...tool,
              subAgent: {
                ...run,
                status: patch.status,
                output: patch.output != null && patch.output.length > 0 ? patch.output : run.output,
                error: patch.error,
              },
            };
          }),
        })),

      addSubAgent: (input) =>
        set((s) => {
          const now = Date.now();
          const agent: SubAgent = { id: uid("sa"), createdAt: now, updatedAt: now, ...input };
          return { subAgents: [agent, ...s.subAgents] };
        }),

      updateSubAgent: (id, patch) =>
        set((s) => ({
          subAgents: s.subAgents.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
          ),
        })),

      deleteSubAgent: (id) => set((s) => ({ subAgents: s.subAgents.filter((a) => a.id !== id) })),

      toggleSubAgent: (id) =>
        set((s) => ({
          subAgents: s.subAgents.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled, updatedAt: Date.now() } : a,
          ),
        })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setApiKey: (provider, key) =>
        set((s) => ({
          settings: { ...s.settings, apiKeys: { ...s.settings.apiKeys, [provider]: key } },
        })),
      setSearchProvider: (searchProvider) => set((s) => ({ settings: { ...s.settings, searchProvider } })),
      setSearchApiKey: (provider, key) =>
        set((s) => {
          const field =
            provider === "tavily"
              ? "tavilyApiKey"
              : provider === "exa"
                ? "exaApiKey"
                : provider === "serpapi"
                  ? "serpapiApiKey"
                  : "firecrawlApiKey";
          const patch: Partial<Settings> = { [field]: key };

          // If a key is entered for a search provider while the currently selected
          // provider has no key, auto-select the provider being configured so the
          // agent never falls back to a provider without a key.
          if (provider !== "firecrawl" && key.trim()) {
            const selected = s.settings.searchProvider ?? "tavily";
            const selectedHasKey =
              selected === "tavily"
                ? Boolean(s.settings.tavilyApiKey?.trim())
                : selected === "exa"
                  ? Boolean(s.settings.exaApiKey?.trim())
                  : Boolean(s.settings.serpapiApiKey?.trim());
            if (!selectedHasKey) patch.searchProvider = provider;
          }

          return { settings: { ...s.settings, ...patch } };
        }),
      setProviders: (providers) => set({ providers }),
      setModels: (models) => set({ models }),
      setModelsLoading: (modelsLoading) => set({ modelsLoading }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSubAgentsOpen: (subAgentsOpen) => set({ subAgentsOpen }),
      setStreaming: (streaming) => set({ streaming }),
      bumpFiles: () => set((s) => ({ filesVersion: s.filesVersion + 1 })),
    }),
    {
      name: "curro-ai-frontend",
      // Deep-merge settings with defaults so settings persisted before the
      // search/fetch fields were added still gain the new fields (searchProvider
      // defaults to tavily, keys default to "").
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          subAgents: Array.isArray(p.subAgents) ? p.subAgents : current.subAgents,
        };
      },
      partialize: (s) => ({
        conversations: s.conversations,
        currentId: s.currentId,
        settings: s.settings,
        subAgents: s.subAgents,
      }),
    },
  ),
);
