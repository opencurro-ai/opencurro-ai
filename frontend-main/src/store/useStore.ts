import { create } from "zustand";
import { persist, type StateStorage, createJSONStorage } from "zustand/middleware";
import type {
  AskQuestionInfo,
  AskQuestionStatus,
  AttachedFile,
  BrowserPreview,
  ChatMessage,
  Conversation,
  CustomProvider,
  FetchProvider,
  KnowledgeFile,
  KnowledgeSource,
  MemoryFile,
  ModelInfo,
  PlanApprovalStatus,
  ProviderMeta,
  SearchProvider,
  Settings,
  Skill,
  SubAgent,
  SubAgentRun,
  TodoItem,
  ToolActivity,
} from "@/types";
import { uid } from "@/utils/id";
import { CUSTOM_PROVIDER_PREFIX } from "@/lib/providers";
import { DEFAULT_SUB_AGENTS, mergeSubAgentsWithDefaults } from "@/lib/defaultSubAgents";
import { DEFAULT_SKILLS, mergeSkillsWithDefaults } from "@/lib/defaultSkills";
import {
  DEFAULT_MEMORY_FILES,
  canonicalMemoryPath,
  isPreaddedMemory,
  mergeMemoryWithDefaults,
} from "@/lib/defaultMemory";
import { hasUnsafeSegment, normalizeKnowledgePath, sanitizeKnowledge } from "@/lib/defaultKnowledge";

/** The five workspace sections the rail switches between. */
export type Section = "chat" | "memory" | "knowledge" | "agents" | "skills";

/** Connection state surfaced to the user. Slow ≠ offline; only a lost connection is "offline". */
export type Connection = "online" | "reconnecting" | "offline";

/**
 * A run that the backend is executing independently of this browser. Persisted so that after a
 * refresh/close/reconnect the client can re-attach to the running agent and continue streaming.
 */
export interface ActiveRun {
  chatId: string;
  assistantId: string;
  /** Last SSE `_event_id` this client has applied — the resume cursor. */
  lastEventId: number;
  startedAt: number;
}

interface StreamDelta {
  contentDelta?: string;
  reasoningDelta?: string;
  lastEventId?: number;
}

interface AppState {
  // Persisted
  conversations: Conversation[];
  currentId: string | null;
  settings: Settings;
  subAgents: SubAgent[];
  skills: Skill[];
  todos: TodoItem[];
  memory: MemoryFile[];
  knowledge: KnowledgeFile[];
  knowledgeSources: Record<string, KnowledgeSource>;
  customProviders: CustomProvider[];
  activeRun: ActiveRun | null;

  // Ephemeral UI
  section: Section;
  providers: ProviderMeta[];
  models: ModelInfo[];
  modelsLoading: boolean;
  settingsOpen: boolean;
  todosOpen: boolean;
  filesOpen: boolean;
  streaming: boolean;
  connection: Connection;
  filesVersion: number;
  preview: BrowserPreview;
  attachedFiles: AttachedFile[];

  // Conversations
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  ensureConversation: () => string;

  // Messages
  addMessage: (convId: string, message: ChatMessage) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  /** Reset a message's streamed body (used before a full resume replay). */
  resetMessageStream: (convId: string, msgId: string) => void;
  /** Batched hot-path append: content + reasoning deltas and the resume cursor in one write. */
  applyAssistantDelta: (convId: string, msgId: string, delta: StreamDelta) => void;
  upsertTool: (convId: string, msgId: string, tool: ToolActivity) => void;

  // Active run (resumable streaming)
  setActiveRun: (run: ActiveRun | null) => void;
  setActiveRunCursor: (lastEventId: number) => void;

  // submit_plan review
  setPlanPending: (
    convId: string,
    msgId: string,
    toolId: string,
    info: { id: string; chatId: string; plan: string },
  ) => void;
  setPlanStatus: (convId: string, msgId: string, toolId: string, status: PlanApprovalStatus) => void;
  updatePlanForTool: (toolId: string, patch: { status?: PlanApprovalStatus; plan?: string }) => void;

  // ask_question_to_user Q&A
  setQuestionPending: (
    convId: string,
    msgId: string,
    toolId: string,
    info: { id: string; chatId: string; questions: AskQuestionInfo["questions"] },
  ) => void;
  setQuestionStatus: (convId: string, msgId: string, toolId: string, status: AskQuestionStatus) => void;
  updateQuestionForTool: (toolId: string, patch: { status?: AskQuestionStatus }) => void;

  // Sub-agent live runs
  startSubAgent: (
    convId: string,
    msgId: string,
    toolId: string,
    run: Pick<SubAgentRun, "session" | "agent" | "task">,
  ) => void;
  applySubAgentDelta: (
    convId: string,
    msgId: string,
    toolId: string,
    delta: { outputDelta?: string; reasoningDelta?: string },
  ) => void;
  upsertSubAgentTool: (convId: string, msgId: string, toolId: string, tool: ToolActivity) => void;
  finishSubAgent: (
    convId: string,
    msgId: string,
    toolId: string,
    patch: { status: SubAgentRun["status"]; output?: string; error?: string },
  ) => void;

  // Sub-agent management
  addSubAgent: (input: Omit<SubAgent, "id" | "createdAt" | "updatedAt">) => void;
  updateSubAgent: (id: string, patch: Partial<Omit<SubAgent, "id" | "createdAt">>) => void;
  deleteSubAgent: (id: string) => void;
  toggleSubAgent: (id: string) => void;

  // Skill management
  addSkill: (input: Omit<Skill, "id" | "createdAt" | "updatedAt">) => void;
  updateSkill: (id: string, patch: Partial<Omit<Skill, "id" | "createdAt">>) => void;
  deleteSkill: (id: string) => void;
  toggleSkill: (id: string) => void;

  // Todos / memory / knowledge
  setTodos: (todos: TodoItem[]) => void;
  setMemory: (files: MemoryFile[]) => void;
  saveMemoryFile: (path: string, content: string, originalPath?: string) => string | null;
  deleteMemoryFile: (path: string) => void;
  setKnowledge: (files: KnowledgeFile[]) => void;
  saveKnowledgeFile: (path: string, content: string, originalPath?: string) => string | null;
  deleteKnowledgeFile: (path: string) => void;
  setKnowledgeSource: (path: string, source: KnowledgeSource | null) => void;

  // Preview + attached files
  setPreview: (url: string) => void;
  setPreviewOpen: (open: boolean) => void;
  addAttachedFiles: (files: AttachedFile[]) => void;
  setFilesOpen: (open: boolean) => void;

  // Custom providers
  addCustomProvider: (input: Omit<CustomProvider, "id" | "createdAt" | "updatedAt">) => CustomProvider;
  updateCustomProvider: (id: string, patch: Partial<Omit<CustomProvider, "id" | "createdAt">>) => void;
  deleteCustomProvider: (id: string) => void;
  selectCustomProvider: (id: string) => void;

  // Settings + UI
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (provider: string, key: string) => void;
  setSearchProvider: (provider: SearchProvider) => void;
  setFetchProvider: (provider: FetchProvider) => void;
  setSearchApiKey: (provider: "tavily" | "exa" | "serpapi" | "firecrawl", key: string) => void;
  setProviders: (p: ProviderMeta[]) => void;
  setModels: (m: ModelInfo[]) => void;
  setModelsLoading: (v: boolean) => void;
  setSection: (section: Section) => void;
  setSettingsOpen: (v: boolean) => void;
  setTodosOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setConnection: (c: Connection) => void;
  bumpFiles: () => void;
}

const defaultSettings: Settings = {
  provider: "openrouter",
  model: "",
  apiKeys: {},
  baseUrl: "",
  searchProvider: "duckduckgo",
  fetchProvider: "builtin",
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

const emptyRun = (run: Pick<SubAgentRun, "session" | "agent" | "task">): SubAgentRun => ({
  session: run.session,
  agent: run.agent,
  task: run.task,
  reasoning: "",
  output: "",
  tools: [],
  status: "running",
});

/**
 * Debounced localStorage adapter: decouples the disk-write cadence from the state-update cadence
 * so streaming (which updates state ~60×/s) never floods localStorage. Writes are coalesced and
 * flushed after a short idle, and force-flushed on pagehide so the resume cursor is always durable.
 */
function createDebouncedStorage(delayMs: number): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    for (const [key, value] of pending) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* quota / private mode — best effort */
      }
    }
    pending.clear();
  };

  if (typeof window !== "undefined") {
    // Force durability before the tab goes away — critical so the resume cursor survives refresh.
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending.set(name, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentId: null,
      settings: defaultSettings,
      subAgents: [...DEFAULT_SUB_AGENTS],
      skills: [...DEFAULT_SKILLS],
      todos: [],
      memory: DEFAULT_MEMORY_FILES.map((f) => ({ ...f })),
      knowledge: [],
      knowledgeSources: {},
      customProviders: [],
      activeRun: null,

      section: "chat",
      providers: [],
      models: [],
      modelsLoading: false,
      settingsOpen: false,
      todosOpen: false,
      filesOpen: false,
      streaming: false,
      connection: "online",
      filesVersion: 0,
      preview: { url: "", open: false },
      attachedFiles: [],

      newConversation: () => {
        const id = uid("conv");
        const conv: Conversation = {
          id,
          title: "New thread",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ conversations: [conv, ...s.conversations], currentId: id, section: "chat" }));
        return id;
      },

      ensureConversation: () => {
        const { currentId } = get();
        if (currentId && get().conversations.some((c) => c.id === currentId)) return currentId;
        return get().newConversation();
      },

      selectConversation: (id) => set({ currentId: id, section: "chat" }),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const currentId = s.currentId === id ? (conversations[0]?.id ?? null) : s.currentId;
          const activeRun = s.activeRun?.chatId === id ? null : s.activeRun;
          return { conversations, currentId, activeRun };
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
              ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
              : c,
          ),
        })),

      resetMessageStream: (convId, msgId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId
                      ? { ...m, content: "", reasoning: "", tools: [], streaming: true }
                      : m,
                  ),
                }
              : c,
          ),
        })),

      applyAssistantDelta: (convId, msgId, delta) =>
        set((s) => {
          const activeRun =
            delta.lastEventId != null && s.activeRun && s.activeRun.chatId === convId
              ? { ...s.activeRun, lastEventId: delta.lastEventId }
              : s.activeRun;
          if (!delta.contentDelta && !delta.reasoningDelta) {
            return activeRun === s.activeRun ? {} : { activeRun };
          }
          return {
            activeRun,
            conversations: s.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === msgId
                        ? {
                            ...m,
                            content: delta.contentDelta ? m.content + delta.contentDelta : m.content,
                            reasoning: delta.reasoningDelta
                              ? (m.reasoning ?? "") + delta.reasoningDelta
                              : m.reasoning,
                          }
                        : m,
                    ),
                  }
                : c,
            ),
          };
        }),

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

      setActiveRun: (activeRun) => set({ activeRun }),
      setActiveRunCursor: (lastEventId) =>
        set((s) => (s.activeRun ? { activeRun: { ...s.activeRun, lastEventId } } : {})),

      setPlanPending: (convId, msgId, toolId, info) =>
        set((s) => ({
          conversations: patchTool(
            s.conversations,
            convId,
            msgId,
            toolId,
            (tool) => ({ ...tool, plan: { ...info, status: "pending" as const } }),
            () => ({
              id: toolId,
              name: "submit_plan",
              label: "Submit Plan",
              status: "running",
              plan: { ...info, status: "pending" as const },
            }),
          ),
        })),

      setPlanStatus: (convId, msgId, toolId, status) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) =>
            tool.plan ? { ...tool, plan: { ...tool.plan, status } } : tool,
          ),
        })),

      updatePlanForTool: (toolId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.tools?.some((t) => t.plan?.id === toolId)
                ? {
                    ...m,
                    tools: m.tools.map((t) =>
                      t.plan?.id === toolId
                        ? {
                            ...t,
                            plan: { ...t.plan, ...patch },
                            status: patch.status && patch.status !== "pending" ? "ok" : t.status,
                          }
                        : t,
                    ),
                  }
                : m,
            ),
          })),
        })),

      setQuestionPending: (convId, msgId, toolId, info) =>
        set((s) => ({
          conversations: patchTool(
            s.conversations,
            convId,
            msgId,
            toolId,
            (tool) => ({ ...tool, ask: { ...info, status: "pending" as const } }),
            () => ({
              id: toolId,
              name: "ask_question_to_user",
              label: `Ask ${info.questions.length} Question${info.questions.length === 1 ? "" : "s"}`,
              status: "running",
              ask: { ...info, status: "pending" as const },
            }),
          ),
        })),

      setQuestionStatus: (convId, msgId, toolId, status) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) =>
            tool.ask ? { ...tool, ask: { ...tool.ask, status } } : tool,
          ),
        })),

      updateQuestionForTool: (toolId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.tools?.some((t) => t.ask?.id === toolId)
                ? {
                    ...m,
                    tools: m.tools.map((t) =>
                      t.ask?.id === toolId
                        ? {
                            ...t,
                            ask: { ...t.ask, ...patch },
                            status: patch.status && patch.status !== "pending" ? "ok" : t.status,
                          }
                        : t,
                    ),
                  }
                : m,
            ),
          })),
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

      applySubAgentDelta: (convId, msgId, toolId, delta) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) => {
            const run = tool.subAgent ?? emptyRun({ session: "", agent: "", task: "" });
            return {
              ...tool,
              subAgent: {
                ...run,
                output: delta.outputDelta ? run.output + delta.outputDelta : run.output,
                reasoning: delta.reasoningDelta ? run.reasoning + delta.reasoningDelta : run.reasoning,
              },
            };
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
          subAgents: s.subAgents.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)),
        })),

      deleteSubAgent: (id) => set((s) => ({ subAgents: s.subAgents.filter((a) => a.id !== id) })),

      toggleSubAgent: (id) =>
        set((s) => ({
          subAgents: s.subAgents.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled, updatedAt: Date.now() } : a,
          ),
        })),

      addSkill: (input) =>
        set((s) => {
          const now = Date.now();
          const skill: Skill = { id: uid("skill"), createdAt: now, updatedAt: now, ...input };
          return { skills: [skill, ...s.skills] };
        }),

      updateSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch, updatedAt: Date.now() } : sk)),
        })),

      deleteSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),

      toggleSkill: (id) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, enabled: !sk.enabled, updatedAt: Date.now() } : sk,
          ),
        })),

      setTodos: (todos) =>
        set((s) => ({
          todos: Array.isArray(todos)
            ? todos.filter(
                (t) =>
                  t &&
                  typeof t === "object" &&
                  typeof t.id === "string" &&
                  typeof t.content === "string",
              )
            : s.todos,
        })),

      setMemory: (files) =>
        set((s) => ({
          memory: Array.isArray(files)
            ? mergeMemoryWithDefaults(
                files.filter(
                  (f) => f && typeof f === "object" && typeof f.path === "string" && f.path.trim().length > 0,
                ),
              )
            : s.memory,
        })),

      saveMemoryFile: (path, content, originalPath) => {
        const cleanPath = canonicalMemoryPath(path.trim().replace(/^[\\/]+/, "").replace(/\/+/g, "/"));
        if (!cleanPath) return "A file path is required.";
        if (/(^|\/)\.\.?(\/|$)/.test(cleanPath)) return "Path cannot contain '.' or '..' segments.";

        const original = originalPath ? canonicalMemoryPath(originalPath) : "";
        if (original && isPreaddedMemory(original) && original.toLowerCase() !== cleanPath.toLowerCase()) {
          return "The three core files (MEMORY.md, SOUL.md, USER.md) cannot be renamed.";
        }

        const clash = get().memory.some(
          (f) =>
            f.path.toLowerCase() === cleanPath.toLowerCase() &&
            (!original || f.path.toLowerCase() !== original.toLowerCase()),
        );
        if (clash) return `A memory file named "${cleanPath}" already exists.`;

        set((s) => {
          const exists = s.memory.some(
            (f) => f.path.toLowerCase() === (original || cleanPath).toLowerCase(),
          );
          const memory = exists
            ? s.memory.map((f) =>
                f.path.toLowerCase() === (original || cleanPath).toLowerCase()
                  ? { path: cleanPath, content }
                  : f,
              )
            : [...s.memory, { path: cleanPath, content }];
          return { memory: mergeMemoryWithDefaults(memory) };
        });
        return null;
      },

      deleteMemoryFile: (path) =>
        set((s) => {
          if (isPreaddedMemory(path)) return {};
          return {
            memory: mergeMemoryWithDefaults(
              s.memory.filter((f) => f.path.toLowerCase() !== canonicalMemoryPath(path).toLowerCase()),
            ),
          };
        }),

      setKnowledge: (files) =>
        set((s) => {
          const knowledge = sanitizeKnowledge(files);
          const live = new Set(knowledge.map((f) => f.path.toLowerCase()));
          const knowledgeSources = Object.fromEntries(
            Object.entries(s.knowledgeSources).filter(([path]) => live.has(path.toLowerCase())),
          );
          return { knowledge, knowledgeSources };
        }),

      saveKnowledgeFile: (path, content, originalPath) => {
        const cleanPath = normalizeKnowledgePath(path);
        if (!cleanPath) return "A file path is required.";
        if (hasUnsafeSegment(cleanPath)) return "Path cannot contain '.' or '..' segments.";

        const original = originalPath ? normalizeKnowledgePath(originalPath) : "";
        const clash = get().knowledge.some(
          (f) =>
            f.path.toLowerCase() === cleanPath.toLowerCase() &&
            (!original || f.path.toLowerCase() !== original.toLowerCase()),
        );
        if (clash) return `A knowledge file named "${cleanPath}" already exists.`;

        set((s) => {
          const exists = s.knowledge.some(
            (f) => f.path.toLowerCase() === (original || cleanPath).toLowerCase(),
          );
          const knowledge = exists
            ? s.knowledge.map((f) =>
                f.path.toLowerCase() === (original || cleanPath).toLowerCase()
                  ? { path: cleanPath, content }
                  : f,
              )
            : [...s.knowledge, { path: cleanPath, content }];

          let knowledgeSources = s.knowledgeSources;
          if (original && original.toLowerCase() !== cleanPath.toLowerCase() && knowledgeSources[original]) {
            const { [original]: moved, ...rest } = knowledgeSources;
            knowledgeSources = { ...rest, [cleanPath]: moved };
          }
          return { knowledge: sanitizeKnowledge(knowledge), knowledgeSources };
        });
        return null;
      },

      deleteKnowledgeFile: (path) =>
        set((s) => {
          const target = normalizeKnowledgePath(path).toLowerCase();
          const knowledgeSources = Object.fromEntries(
            Object.entries(s.knowledgeSources).filter(([p]) => p.toLowerCase() !== target),
          );
          return {
            knowledge: s.knowledge.filter((f) => f.path.toLowerCase() !== target),
            knowledgeSources,
          };
        }),

      setKnowledgeSource: (path, source) =>
        set((s) => {
          const clean = normalizeKnowledgePath(path);
          if (!clean) return {};
          if (source === null) {
            const rest = { ...s.knowledgeSources };
            delete rest[clean];
            return { knowledgeSources: rest };
          }
          return { knowledgeSources: { ...s.knowledgeSources, [clean]: source } };
        }),

      addCustomProvider: (input) => {
        const now = Date.now();
        const provider: CustomProvider = {
          id: uid(CUSTOM_PROVIDER_PREFIX),
          createdAt: now,
          updatedAt: now,
          ...input,
          models: input.models.length > 0 ? input.models : [""],
        };
        set((s) => ({ customProviders: [provider, ...s.customProviders] }));
        return provider;
      },

      updateCustomProvider: (id, patch) =>
        set((s) => ({
          customProviders: s.customProviders.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        })),

      deleteCustomProvider: (id) =>
        set((s) => {
          const customProviders = s.customProviders.filter((p) => p.id !== id);
          let settings = s.settings;
          if (s.settings.provider === id) {
            settings = { ...s.settings, provider: "openrouter", model: "", baseUrl: "" };
          }
          return { customProviders, settings };
        }),

      selectCustomProvider: (id) =>
        set((s) => {
          const provider = s.customProviders.find((p) => p.id === id);
          if (!provider) return {};
          const model = provider.models.find((m) => m.trim().length > 0) ?? "";
          return { settings: { ...s.settings, provider: id, model, baseUrl: "" } };
        }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setApiKey: (provider, key) =>
        set((s) => ({ settings: { ...s.settings, apiKeys: { ...s.settings.apiKeys, [provider]: key } } })),
      setSearchProvider: (searchProvider) => set((s) => ({ settings: { ...s.settings, searchProvider } })),
      setFetchProvider: (fetchProvider) => set((s) => ({ settings: { ...s.settings, fetchProvider } })),
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

          if (provider !== "firecrawl" && key.trim()) {
            const selected = s.settings.searchProvider ?? "duckduckgo";
            const selectedHasKey =
              selected === "duckduckgo"
                ? true
                : selected === "tavily"
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
      setSection: (section) => set({ section }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setTodosOpen: (todosOpen) => set({ todosOpen }),
      setStreaming: (streaming) => set({ streaming }),
      setConnection: (connection) => set({ connection }),
      setPreview: (url) => set((s) => ({ preview: { url, open: s.preview.url !== url || s.preview.open } })),
      setPreviewOpen: (open) => set((s) => ({ preview: { ...s.preview, open } })),
      addAttachedFiles: (files) =>
        set((s) => {
          const seen = new Set(s.attachedFiles.map((f) => f.path));
          const fresh = files.filter((f) => f && f.path && !seen.has(f.path));
          if (fresh.length === 0) return {};
          return { attachedFiles: [...s.attachedFiles, ...fresh] };
        }),
      setFilesOpen: (filesOpen) => set({ filesOpen }),
      bumpFiles: () => set((s) => ({ filesVersion: s.filesVersion + 1 })),
    }),
    {
      name: "haku-curro-frontend",
      storage: createJSONStorage(() => createDebouncedStorage(400)),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...p.settings },
          subAgents: mergeSubAgentsWithDefaults(Array.isArray(p.subAgents) ? p.subAgents : current.subAgents),
          skills: mergeSkillsWithDefaults(Array.isArray(p.skills) ? p.skills : current.skills),
          todos: Array.isArray(p.todos) ? p.todos : current.todos,
          memory: mergeMemoryWithDefaults(Array.isArray(p.memory) ? p.memory : current.memory),
          knowledge: sanitizeKnowledge(Array.isArray(p.knowledge) ? p.knowledge : current.knowledge),
          knowledgeSources:
            p.knowledgeSources && typeof p.knowledgeSources === "object"
              ? (p.knowledgeSources as Record<string, KnowledgeSource>)
              : current.knowledgeSources,
          customProviders: Array.isArray(p.customProviders) ? p.customProviders : current.customProviders,
          activeRun: p.activeRun ?? null,
        };
      },
      partialize: (s) => ({
        conversations: s.conversations,
        currentId: s.currentId,
        settings: s.settings,
        subAgents: s.subAgents,
        skills: s.skills,
        todos: s.todos,
        memory: s.memory,
        knowledge: s.knowledge,
        knowledgeSources: s.knowledgeSources,
        customProviders: s.customProviders,
        activeRun: s.activeRun,
      }),
    },
  ),
);
