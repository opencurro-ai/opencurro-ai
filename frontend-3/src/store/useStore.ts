import { create } from "zustand";
import { persist } from "zustand/middleware";
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
import {
  DEFAULT_SUB_AGENTS,
  mergeSubAgentsWithDefaults,
} from "@/lib/defaultSubAgents";
import { DEFAULT_SKILLS, mergeSkillsWithDefaults } from "@/lib/defaultSkills";
import {
  DEFAULT_MEMORY_FILES,
  canonicalMemoryPath,
  isPreaddedMemory,
  mergeMemoryWithDefaults,
} from "@/lib/defaultMemory";
import {
  hasUnsafeSegment,
  normalizeKnowledgePath,
  sanitizeKnowledge,
} from "@/lib/defaultKnowledge";

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
  /** Fetch metadata for URL-sourced knowledge files, keyed by file path (enables refetch). */
  knowledgeSources: Record<string, KnowledgeSource>;
  customProviders: CustomProvider[];

  // Ephemeral UI
  providers: ProviderMeta[];
  models: ModelInfo[];
  modelsLoading: boolean;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  subAgentsOpen: boolean;
  skillsOpen: boolean;
  todosOpen: boolean;
  memoryOpen: boolean;
  knowledgeOpen: boolean;
  filesOpen: boolean;
  streaming: boolean;
  filesVersion: number;
  /** Live browser preview driven by the embed_url tool. */
  preview: BrowserPreview;
  /** Files attached by the attach_files tool (for preview/download). */
  attachedFiles: AttachedFile[];

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

  // Actions — submit_plan human-in-the-loop review
  setPlanPending: (
    convId: string,
    msgId: string,
    toolId: string,
    info: { id: string; chatId: string; plan: string },
  ) => void;
  setPlanStatus: (
    convId: string,
    msgId: string,
    toolId: string,
    status: PlanApprovalStatus,
  ) => void;
  setPlanText: (convId: string, msgId: string, toolId: string, plan: string) => void;
  updatePlanForTool: (toolId: string, patch: { status?: PlanApprovalStatus; plan?: string }) => void;

  // Actions — ask_question_to_user human-in-the-loop Q&A
  setQuestionPending: (
    convId: string,
    msgId: string,
    toolId: string,
    info: { id: string; chatId: string; questions: AskQuestionInfo["questions"] },
  ) => void;
  setQuestionStatus: (
    convId: string,
    msgId: string,
    toolId: string,
    status: AskQuestionStatus,
  ) => void;
  updateQuestionForTool: (
    toolId: string,
    patch: { status?: AskQuestionStatus },
  ) => void;

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

  // Actions — custom skill management (persisted in the browser)
  addSkill: (input: Omit<Skill, "id" | "createdAt" | "updatedAt">) => void;
  updateSkill: (id: string, patch: Partial<Omit<Skill, "id" | "createdAt">>) => void;
  deleteSkill: (id: string) => void;
  toggleSkill: (id: string) => void;

  // Actions — todo list (persisted in the browser; owned by the TodoWrite/read_todos tools)
  setTodos: (todos: TodoItem[]) => void;

  // Actions — memory files (persisted in the browser; owned by the `memory` tool)
  setMemory: (files: MemoryFile[]) => void;
  saveMemoryFile: (path: string, content: string, originalPath?: string) => string | null;
  deleteMemoryFile: (path: string) => void;

  // Actions — knowledge base files (persisted in the browser; owned by the knowledge_* tools + UI)
  setKnowledge: (files: KnowledgeFile[]) => void;
  saveKnowledgeFile: (path: string, content: string, originalPath?: string) => string | null;
  deleteKnowledgeFile: (path: string) => void;
  /** Attach or clear (source=null) the URL fetch metadata for a knowledge file path. */
  setKnowledgeSource: (path: string, source: KnowledgeSource | null) => void;

  // Actions — browser preview (embed_url) & attached files (attach_files)
  setPreview: (url: string) => void;
  setPreviewOpen: (open: boolean) => void;
  addAttachedFiles: (files: AttachedFile[]) => void;
  setFilesOpen: (open: boolean) => void;

  // Actions — custom OpenAI-compatible providers (persisted in the browser)
  addCustomProvider: (input: Omit<CustomProvider, "id" | "createdAt" | "updatedAt">) => CustomProvider;
  updateCustomProvider: (id: string, patch: Partial<Omit<CustomProvider, "id" | "createdAt">>) => void;
  deleteCustomProvider: (id: string) => void;
  selectCustomProvider: (id: string) => void;

  // Actions — settings & UI
  setSettings: (patch: Partial<Settings>) => void;
  setApiKey: (provider: string, key: string) => void;
  setSearchProvider: (provider: SearchProvider) => void;
  setFetchProvider: (provider: FetchProvider) => void;
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
  setSkillsOpen: (v: boolean) => void;
  setTodosOpen: (v: boolean) => void;
  setMemoryOpen: (v: boolean) => void;
  setKnowledgeOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
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
      subAgents: [...DEFAULT_SUB_AGENTS],
      skills: [...DEFAULT_SKILLS],
      todos: [],
      memory: DEFAULT_MEMORY_FILES.map((f) => ({ ...f })),
      knowledge: [],
      knowledgeSources: {},
      customProviders: [],

      providers: [],
      models: [],
      modelsLoading: false,
      sidebarOpen: true,
      settingsOpen: false,
      subAgentsOpen: false,
      skillsOpen: false,
      todosOpen: false,
      memoryOpen: false,
      knowledgeOpen: false,
      filesOpen: false,
      streaming: false,
      filesVersion: 0,
      preview: { url: "", open: false },
      attachedFiles: [],

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

      setPlanText: (convId, msgId, toolId, plan) =>
        set((s) => ({
          conversations: patchTool(s.conversations, convId, msgId, toolId, (tool) =>
            tool.plan ? { ...tool, plan: { ...tool.plan, plan } } : tool,
          ),
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

      // Locate the question tool by its unique id across every conversation/message. Used by
      // the answer block, which does not know the enclosing convId/msgId.
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

      // Locate the plan tool by its unique id across every conversation/message. Used by the
      // review block, which does not know the enclosing convId/msgId.
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

      addSkill: (input) =>
        set((s) => {
          const now = Date.now();
          const skill: Skill = { id: uid("skill"), createdAt: now, updatedAt: now, ...input };
          return { skills: [skill, ...s.skills] };
        }),

      updateSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, ...patch, updatedAt: Date.now() } : sk,
          ),
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

      // Replace the whole memory set (used when the `memory` tool emits memory_updated). Defends
      // against malformed input and always keeps the three pre-added files present + first.
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

      // Create or update a single memory file from the UI (Settings memory editor). Enforces
      // unique paths (case-insensitive), canonicalizes pre-added names, and renames when
      // originalPath differs. Returns an error string, or null on success.
      saveMemoryFile: (path, content, originalPath) => {
        const cleanPath = canonicalMemoryPath(path.trim().replace(/^[\\/]+/, "").replace(/\/+/g, "/"));
        if (!cleanPath) return "A file path is required.";
        if (/(^|\/)\.\.?(\/|$)/.test(cleanPath)) return "Path cannot contain '.' or '..' segments.";

        const original = originalPath ? canonicalMemoryPath(originalPath) : "";
        // Renaming a pre-added file is not allowed (they are permanent, fixed names).
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

      // Delete a custom memory file. Pre-added files are permanent and silently ignored.
      deleteMemoryFile: (path) =>
        set((s) => {
          if (isPreaddedMemory(path)) return {};
          return {
            memory: mergeMemoryWithDefaults(
              s.memory.filter((f) => f.path.toLowerCase() !== canonicalMemoryPath(path).toLowerCase()),
            ),
          };
        }),

      // Replace the whole knowledge set (used when a knowledge tool emits knowledge_updated). Defends
      // against malformed input; there are no defaults, so an empty/invalid input yields an empty base.
      // Prunes source metadata whose file no longer exists so the two stay consistent.
      setKnowledge: (files) =>
        set((s) => {
          const knowledge = sanitizeKnowledge(files);
          const live = new Set(knowledge.map((f) => f.path.toLowerCase()));
          const knowledgeSources = Object.fromEntries(
            Object.entries(s.knowledgeSources).filter(([path]) => live.has(path.toLowerCase())),
          );
          return { knowledge, knowledgeSources };
        }),

      // Create or update a single knowledge file from the UI (Knowledge popup). Enforces unique paths
      // (case-insensitive), rejects traversal, and renames when originalPath differs. Returns an error
      // string, or null on success.
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

          // Carry source metadata across a rename so a URL-sourced file keeps its refetch info.
          let knowledgeSources = s.knowledgeSources;
          if (original && original.toLowerCase() !== cleanPath.toLowerCase() && knowledgeSources[original]) {
            const { [original]: moved, ...rest } = knowledgeSources;
            knowledgeSources = { ...rest, [cleanPath]: moved };
          }
          return { knowledge: sanitizeKnowledge(knowledge), knowledgeSources };
        });
        return null;
      },

      // Delete a knowledge file by path. No files are protected — any file can be removed.
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
          models: (input.models.length > 0 ? input.models : [""]),
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
          // If the deleted provider was selected, fall back to a built-in provider.
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
        set((s) => ({
          settings: { ...s.settings, apiKeys: { ...s.settings.apiKeys, [provider]: key } },
        })),
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

          // If a key is entered for a search provider while the currently selected
          // provider has no key, auto-select the provider being configured so the
          // agent never falls back to a provider without a key. DuckDuckGo is free
          // and always "has" a key, so entering a paid key never overrides an
          // intentional DuckDuckGo selection.
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
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSubAgentsOpen: (subAgentsOpen) => set({ subAgentsOpen }),
      setSkillsOpen: (skillsOpen) => set({ skillsOpen }),
      setTodosOpen: (todosOpen) => set({ todosOpen }),
      setMemoryOpen: (memoryOpen) => set({ memoryOpen }),
      setKnowledgeOpen: (knowledgeOpen) => set({ knowledgeOpen }),
      setFilesOpen: (filesOpen) => set({ filesOpen }),
      setPreview: (url) =>
        set((s) => ({ preview: { url, open: s.preview.url !== url || s.preview.open } })),
      setPreviewOpen: (open) => set((s) => ({ preview: { ...s.preview, open } })),
      addAttachedFiles: (files) =>
        set((s) => {
          const seen = new Set(s.attachedFiles.map((f) => f.path));
          const fresh = files.filter((f) => f && f.path && !seen.has(f.path));
          if (fresh.length === 0) return {};
          return { attachedFiles: [...s.attachedFiles, ...fresh] };
        }),
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
          subAgents: mergeSubAgentsWithDefaults(
            Array.isArray(p.subAgents) ? p.subAgents : current.subAgents,
          ),
          skills: mergeSkillsWithDefaults(
            Array.isArray(p.skills) ? p.skills : current.skills,
          ),
          todos: Array.isArray(p.todos) ? p.todos : current.todos,
          memory: mergeMemoryWithDefaults(
            Array.isArray(p.memory) ? p.memory : current.memory,
          ),
          knowledge: sanitizeKnowledge(Array.isArray(p.knowledge) ? p.knowledge : current.knowledge),
          knowledgeSources:
            p.knowledgeSources && typeof p.knowledgeSources === "object"
              ? (p.knowledgeSources as Record<string, KnowledgeSource>)
              : current.knowledgeSources,
          customProviders: Array.isArray(p.customProviders) ? p.customProviders : current.customProviders,
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
      }),
    },
  ),
);
