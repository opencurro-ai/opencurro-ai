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

/**
 * A single file belonging to a skill. `path` is relative to the skill's own folder — it may be
 * a bare file name ("SKILL.md", "example.md") or a nested path ("references/branching.md",
 * "scripts/commit.sh"). `content` is the raw text written to disk when the skill is initialized.
 */
export interface SkillFileDefinition {
  path: string;
  content: string;
}

/**
 * A user-defined skill. Definitions are authored in the frontend and stored in the user's
 * browser (localStorage); they are sent to the backend with each turn. A skill is a reusable,
 * packaged capability — a folder named after the skill, containing an entry markdown file (by
 * convention SKILL.md, but renameable) plus any number of reference/example/script files. The
 * agent discovers skills with list_skills, then materializes the ones it needs onto disk (inside
 * a workspace ".skills" directory) with skill_initialize before reading their files.
 */
export interface SkillDefinition {
  /** Folder name and unique identifier used by skill_initialize (e.g. "git-workflow"). */
  name: string;
  /** Short human description surfaced to the agent by list_skills. */
  description: string;
  /** Entry markdown file name inside the skill folder (renameable, defaults to "SKILL.md"). */
  skillFile: string;
  /** Every file in the skill folder, including the entry file. */
  files: SkillFileDefinition[];
  /** When false the skill is hidden from list_skills and cannot be initialized. */
  enabled?: boolean;
}

/** One skill that skill_initialize successfully wrote to disk. */
export interface InitializedSkill {
  skill_name: string;
  /** Skill folder path relative to the provided file_path, e.g. ".skills/git-workflow". */
  path: string;
  /** Entry file path relative to the provided file_path, e.g. ".skills/git-workflow/SKILL.md". */
  skill_file: string;
  /** All file paths written for this skill, relative to the provided file_path. */
  files: string[];
}

/** One skill skill_initialize could not write (unknown, disabled, or already initialized). */
export interface FailedSkill {
  skill_name: string;
  error: string;
}

/** Result of a skill_initialize call. */
export interface SkillInitializeResult {
  success: boolean;
  initialized: InitializedSkill[];
  failed: FailedSkill[];
}

/** A skill as surfaced to the agent by list_skills — name, description, and its file tree. */
export interface SkillListEntry {
  name: string;
  description: string;
  /** Entry file name (e.g. "SKILL.md"). */
  skill_file: string;
  /** All file paths relative to the skill folder, sorted. */
  files: string[];
  /** Pretty ASCII tree of the skill folder, ready to show the model. */
  tree: string;
}

/**
 * Runtime bridge injected into the ToolContext for the main agent's turn so the list_skills /
 * skill_initialize tools can enumerate the user's skills and materialize them onto disk. It is
 * intentionally absent from the context handed to a sub-agent's own tool calls.
 */
export interface SkillRuntime {
  /** All skill definitions provided by the user for this turn (enabled + disabled). */
  readonly definitions: SkillDefinition[];
  /** Enabled skills, each with its file tree — what list_skills returns. */
  list(): SkillListEntry[];
  /**
   * Create a ".skills" directory under `filePath` (if missing) and write each requested skill's
   * files into it. Skills that are unknown, disabled, or already initialized are reported in
   * `failed` without aborting the others.
   */
  initialize(
    params: { filePath: string; skillNames: string[] },
    ctx: ToolContext,
  ): Promise<SkillInitializeResult>;
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
  /** Human-in-the-loop question-answer runtime — present only for main-agent tool calls. */
  askQuestions?: import("../../services/questionStore.js").QuestionStore;
  /** How long the user's questions wait for answers before auto-continuing. */
  questionTimeoutMs?: number;
  /** Timeout (ms) applied to shell commands. */
  shellTimeoutMs: number;
  /** Abort signal so long running tools stop when the turn is cancelled. */
  signal?: AbortSignal;
  /** Optional keys/provider for the web search and fetch tools. */
  web?: WebToolsConfig;
  /** Sub-agent runtime — present only for main-agent tool calls, never for sub-agent tool calls. */
  subAgents?: SubAgentRuntime;
  /** Skill runtime — present only for main-agent tool calls, never for sub-agent tool calls. */
  skills?: SkillRuntime;
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
