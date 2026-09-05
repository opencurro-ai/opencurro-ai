import type { AppConfig } from "../../config.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { resolveProvider } from "../providers/registry.js";
import type { Provider } from "../providers/types.js";
import type { ToolRegistry } from "../tools/index.js";
import type { ChatSession, StoredMessage } from "../../services/sessionStore.js";
import type { SessionEventBuffer } from "../../services/eventBuffer.js";
import type {
  KnowledgeFile,
  MemoryFile,
  SkillDefinition,
  TodoItem,
  WebToolsConfig,
} from "../tools/types.js";
import { isVisionCapableModel } from "../../utils/vision.js";
import { createMemoryRuntime } from "../memory.js";
import { createKnowledgeRuntime } from "../knowledge.js";
import { createTodoRuntime } from "../todos.js";
import { createSkillRuntime } from "../skills.js";
import { mergeDefaultSkills, resolveDefaultSkills } from "../skills/index.js";
import { TeamRunner } from "./team.js";
import { TeamSessionStore } from "./store.js";
import type { TeamDefinition } from "./types.js";

export { TeamRunner } from "./team.js";
export { TeamSessionStore } from "./store.js";
export type { TeamDefinition, TeamMemberDefinition, TeamHeadDefinition } from "./types.js";

/** A request to run one user turn against a multi-agent collaboration team. */
export interface TeamRunRequest {
  chatId: string;
  userMessage: string;
  team: TeamDefinition;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  customProvider?: unknown;
  temperature?: number;
  effort?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  serpapiApiKey?: string;
  searchProvider?: "duckduckgo" | "tavily" | "exa" | "serpapi";
  fetchProvider?: "builtin" | "firecrawl";
  firecrawlApiKey?: string;
  skills?: SkillDefinition[];
  todos?: TodoItem[];
  memory?: MemoryFile[];
  knowledge?: KnowledgeFile[];
}

/**
 * Backend service that runs a multi-agent collaboration team for a chat turn. It mirrors
 * AgentRunner.run's contract (drive the turn, stream onto the buffer, persist the transcript), but
 * instead of a single agent it orchestrates a whole team through the TeamRunner. Each agent's
 * conversation persists across turns via the TeamSessionStore so context is never lost.
 */
export class TeamAgentService {
  private readonly teamSessions = new TeamSessionStore();

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly config: AppConfig,
  ) {}

  /** Drop a chat's stored team histories (called when the chat/session is deleted). */
  forget(chatId: string): void {
    this.teamSessions.delete(chatId);
  }

  async run(
    request: TeamRunRequest,
    session: ChatSession,
    buffer: SessionEventBuffer,
    signal: AbortSignal,
  ): Promise<void> {
    const send = (event: string, data: Record<string, unknown>): number => buffer.append(event, data);

    try {
      let provider: Provider;
      try {
        provider = resolveProvider(this.providers, request.provider, request.customProvider);
      } catch (error) {
        send("error", { code: "provider_error", message: messageOf(error) });
        send("done", { ok: false });
        return;
      }

      // Record the user's message on the chat transcript (for reload + persistence).
      session.messages.push({ role: "user", content: request.userMessage });

      // Shared runtimes for the whole team turn (mirror the single agent's).
      const memoryRuntime = createMemoryRuntime(request.memory ?? []);
      const knowledgeRuntime = createKnowledgeRuntime(request.knowledge ?? []);
      const todoRuntime = createTodoRuntime(request.todos ?? []);
      const defaultSkills = await resolveDefaultSkills();
      const skillRuntime = createSkillRuntime(
        mergeDefaultSkills(defaultSkills, request.skills ?? []),
      );

      const web: WebToolsConfig = {
        searchProvider: request.searchProvider ?? this.config.searchProvider,
        fetchProvider: request.fetchProvider ?? this.config.fetchProvider,
        tavilyApiKey: request.tavilyApiKey || this.config.tavilyApiKey || undefined,
        exaApiKey: request.exaApiKey || this.config.exaApiKey || undefined,
        serpapiApiKey: request.serpapiApiKey || this.config.serpapiApiKey || undefined,
        firecrawlApiKey: request.firecrawlApiKey || this.config.firecrawlApiKey || undefined,
      };

      const runner = new TeamRunner({
        provider,
        tools: this.tools,
        config: this.config,
        chatId: request.chatId,
        team: request.team,
        model: request.model,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        temperature: request.temperature,
        effort: request.effort,
        web,
        skills: skillRuntime,
        todos: todoRuntime,
        memory: memoryRuntime,
        knowledge: knowledgeRuntime,
        visionCapable: isVisionCapableModel(request.model, this.config),
        send: (event, data) => send(event, data),
        signal,
        priorHistories: this.teamSessions.get(request.chatId),
      });

      const outcome = await runner.run(request.userMessage);

      // Persist each agent's conversation so the team keeps its context on the next turn.
      this.teamSessions.set(request.chatId, runner.histories());

      // Record the head's final answer on the chat transcript.
      const finalAnswer = outcome.finalAnswer.trim();
      const assistantMessage: StoredMessage = {
        role: "assistant",
        content: finalAnswer.length > 0 ? finalAnswer : "(The team finished with no final summary.)",
      };
      session.messages.push(assistantMessage);

      if (signal.aborted) {
        send("done", { ok: false, aborted: true });
        return;
      }

      send("message_complete", { content: finalAnswer, reasoning: null });
      send("done", { ok: outcome.ok });
    } catch (error) {
      send("error", { code: "team_crashed", message: messageOf(error) });
      send("done", { ok: false });
    } finally {
      buffer.setDone();
      session.running = false;
      session.updatedAt = Date.now();
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
