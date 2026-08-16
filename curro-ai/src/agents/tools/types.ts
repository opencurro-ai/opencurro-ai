import type { z } from "zod";

/** Structured result returned by every tool. Mirrors the shape the model observes. */
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}

/** Web search providers supported by the web_search tool. */
export type SearchProvider = "tavily" | "exa" | "serpapi";

/** API keys + provider selection for the web_search and fatch_web_urls tools. */
export interface WebToolsConfig {
  /** Active search provider; tavily is the default. */
  searchProvider: SearchProvider;
  tavilyApiKey?: string;
  exaApiKey?: string;
  serpapiApiKey?: string;
  firecrawlApiKey?: string;
}

/**
 * A user-defined sub-agent. Definitions are authored in the frontend and stored in the
 * user's browser (localStorage); they are sent to the backend with each turn. A sub-agent
 * is a completely separate LLM call — its own system prompt, its own allowed tools, and its
 * own conversation memory keyed by session name — with no access to the main agent history.
 */
export interface SubAgentDefinition {
  /** Short unique name the main agent uses to target this sub-agent (e.g. "deepexplorer"). */
  name: string;
  /** Short human description shown by list_sub_agents. */
  description: string;
  /** System prompt that specialises this sub-agent. */
  system_prompt: string;
  /** Tool names (from the main tool registry) this sub-agent is allowed to use. */
  tools: string[];
  /** When false the sub-agent is hidden from list_sub_agents and cannot be called. */
  enabled?: boolean;
}

/**
 * Runtime bridge injected into the ToolContext for the main agent's turn so the
 * call_sub_agent / list_sub_agents tools can enumerate and execute sub-agents. It is
 * intentionally absent from the context handed to a sub-agent's own tool calls, which
 * prevents recursive sub-agent invocation.
 */
export interface SubAgentRuntime {
  /** All definitions provided by the user for this turn (enabled + disabled). */
  readonly definitions: SubAgentDefinition[];
  /** Names + descriptions of the sub-agents that can currently be called (enabled only). */
  available(): Array<{ name: string; description: string }>;
  /**
   * Execute a sub-agent for the given task and return ONLY its final output.
   * Streams live progress (tokens, reasoning, nested tool calls) via SSE side-channel events.
   */
  run(
    params: { session: string; agent: string; task: string },
    ctx: ToolContext,
  ): Promise<ToolResult>;
}

/** Runtime context handed to a tool on execution. */
export interface ToolContext {
  /** Absolute path all file operations are sandboxed to. */
  workspaceRoot: string;
  /** Id of the chat session the tool is running within (used by human-in-the-loop tools). */
  chatId?: string;
  /** Push an SSE event onto the session buffer so the frontend can react before the tool returns. */
  emit?: (event: string, data: Record<string, unknown>) => void;
  /** Human-in-the-loop plan approval runtime — present only for main-agent tool calls. */
  planApprovals?: import("../../services/planApprovalStore.js").PlanApprovalStore;
  /** How long a submitted plan waits for a user decision before auto-continuing. */
  planApprovalTimeoutMs?: number;
  /** Timeout (ms) applied to shell commands. */
  shellTimeoutMs: number;
  /** Abort signal so long running tools stop when the turn is cancelled. */
  signal?: AbortSignal;
  /** Optional keys/provider for the web search and fetch tools. */
  web?: WebToolsConfig;
  /** Sub-agent runtime — present only for main-agent tool calls, never for sub-agent tool calls. */
  subAgents?: SubAgentRuntime;
  /** Id of the tool call currently executing; used to correlate nested sub-agent events in the UI. */
  toolCallId?: string;
  /** The model id currently serving the agent (used by the read_image tool for error reporting). */
  model?: string;
  /** Whether the selected model accepts image inputs; false blocks the read_image tool. */
  visionCapable?: boolean;
}

/**
 * A Tool is fully self describing: name, description, a zod schema (used both to build
 * the OpenAI function schema and to validate arguments), a label helper for the UI, and
 * an async executor. Adding a new tool = create one file exporting a Tool and register it.
 */
export interface Tool<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: Schema;
  /** Short human friendly label for UI chips, e.g. "Create: src/app.ts". */
  label: (args: z.infer<Schema>) => string;
  execute: (args: z.infer<Schema>, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * A tool with its schema type erased — used wherever tools of different schema shapes are stored
 * together. `Tool<Schema>` is invariant in Schema (the schema field is covariant while the
 * label/execute params are contravariant), so a generic alias won't accept heterogeneous tools.
 * This standalone interface widens the schema-dependent parts to accept any concrete Tool.
 */
export interface AnyTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  label: (args: never) => string;
  execute: (args: never, ctx: ToolContext) => Promise<ToolResult>;
}

/** Helper to define a tool with full type inference from its schema. */
export function defineTool<Schema extends z.ZodTypeAny>(tool: Tool<Schema>): Tool<Schema> {
  return tool;
}
