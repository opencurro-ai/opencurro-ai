export interface ProviderMeta {
  id: string;
  label: string;
  defaultBaseUrl: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
  label: string;
  owned_by?: string | null;
  context_window?: number | null;
}

/** Custom HTTP header pair the user configures for a custom provider. */
export interface CustomHeader {
  key: string;
  value: string;
}

/**
 * A user-defined OpenAI-compatible provider, persisted in the backend SQLite database.
 * Multiple providers coexist; each can carry one or more model ids.
 */
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  headers: CustomHeader[];
  models: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Flat config sent to the backend on the wire for the currently selected custom
 * provider. Mirrors the requested Provider object: { id, name, model, baseUrl,
 * apiKey?, headers? }.
 */
export interface CustomProviderConfig {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export type ToolActivityStatus = "running" | "ok" | "error";

/** Outcome of a human review of a submitted plan (mirrors the backend decision). */
export type PlanApprovalStatus = "pending" | "approved" | "canceled" | "edited" | "timeout";

/** Plan review state attached to the submit_plan tool so the chat renders the big review block. */
export interface PlanApprovalInfo {
  /** The backend tool-call id — used to post the user's decision. */
  id: string;
  /** Chat session the plan belongs to. */
  chatId: string;
  /** The plan text the user is reviewing / editing. */
  plan: string;
  status: PlanApprovalStatus;
}

/** A single question the agent asked the user, with context and predefined options. */
export interface AskQuestionItem {
  question: string;
  context: string;
  options: string[];
}

export type AskQuestionStatus = "pending" | "answered" | "timeout";

/** Question-answer state attached to the ask_question_to_user tool for the answer block. */
export interface AskQuestionInfo {
  /** The backend tool-call id — used to post the user's answers. */
  id: string;
  /** Chat session the questions belong to. */
  chatId: string;
  /** The questions the user is answering. */
  questions: AskQuestionItem[];
  status: AskQuestionStatus;
}

export interface ToolActivity {
  id: string;
  name: string;
  label: string;
  status: ToolActivityStatus;
  filePath?: string;
  /** Raw arguments the model passed in the tool call (e.g. file_read offset/limit). */
  args?: Record<string, unknown>;
  /** Full structured tool result (e.g. web_search results) streamed from the backend. */
  result?: unknown;
  /** Live sub-agent run attached to a call_sub_agent tool chip (streamed token by token). */
  subAgent?: SubAgentRun;
  /**
   * Live sub-agent runs attached to a call_multiple_sub_agents tool chip, keyed by each child's
   * unique event id. Every entry is an independent sub-agent run rendered as its own nested block
   * inside the batch tool block.
   */
  multiRuns?: Record<string, SubAgentRun>;
  /** Render order of `multiRuns` (child ids) — preserves the order the sub-agents were requested. */
  multiOrder?: string[];
  /** Human-in-the-loop plan review rendered as the big chat block for submit_plan. */
  plan?: PlanApprovalInfo;
  /** Human-in-the-loop question-answer block rendered for ask_question_to_user. */
  ask?: AskQuestionInfo;
}

/** Structured result streamed back for the read_image tool (no image payload — metadata only). */
export interface ReadImageToolResult {
  ok?: boolean;
  data?: {
    file_path?: string;
    source?: "workspace" | "url";
    content_type?: string;
    size_bytes?: number;
  };
  error?: { code?: string; message?: string };
}

/** Live state of a sub-agent invocation, rendered inside the call_sub_agent chip popup. */
export interface SubAgentRun {
  agent: string;
  task: string;
  reasoning: string;
  output: string;
  tools: ToolActivity[];
  status: ToolActivityStatus;
  error?: string;
  /** True when launched in the background (wait_for_output=false) — runs detached from the turn. */
  background?: boolean;
  /** True when the main agent shared its conversation context (send_my_context=true) with this run. */
  sentContext?: boolean;
  /** Workspace-relative ".curro/sub-agent" file where a background run writes its final output. */
  outputFile?: string;
}

/** A user-defined sub-agent, stored in the backend SQLite database. */
export interface SubAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Sub-agent definition in the backend/wire format sent with each turn. */
export interface BackendSubAgent {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  enabled: boolean;
}

/** A single file inside a skill folder — a bare name or a nested path plus its content. */
export interface SkillFile {
  /** Path relative to the skill folder, e.g. "SKILL.md" or "references/branching.md". */
  path: string;
  content: string;
}

/**
 * A user-defined skill, stored in the backend SQLite database. A skill is a
 * reusable, packaged capability: a folder named after the skill containing an entry markdown file
 * (SKILL.md by default, renameable) plus any number of reference/example/script files.
 */
export interface Skill {
  id: string;
  /** Folder name and unique identifier (e.g. "git-workflow"). */
  name: string;
  description: string;
  /** Entry file name (renameable, defaults to "SKILL.md"). */
  skillFile: string;
  /** Content of the entry file. */
  skillContent: string;
  /** Additional files/folders beyond the entry file. */
  files: SkillFile[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Skill definition in the backend/wire format sent with each turn. */
export interface BackendSkill {
  name: string;
  description: string;
  /** Entry file name, e.g. "SKILL.md". */
  skill_file: string;
  /** Every file in the skill folder, including the entry file. */
  files: Array<{ path: string; content: string }>;
  enabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  tools?: ToolActivity[];
  streaming?: boolean;
  createdAt: number;
  /**
   * Multi-agent team run attached to an assistant message. When present, the message renders the
   * team's collaboration (head + members streaming as their own blocks) instead of a single answer.
   */
  team?: TeamRun;
}

/* ----------------------------------------------------------------- multi-agent teams */

/** A single team member (worker) of a multi-agent collaboration team. */
export interface TeamMember {
  /** Unique id + display name (user-typed). Other agents address this member by this id. */
  id: string;
  description: string;
  systemPrompt: string;
  enabled: boolean;
}

/** A full multi-agent team, stored in the backend SQLite database (like sub-agents/skills). */
export interface AgentTeam {
  id: string;
  name: string;
  /** The head/leader's display name. */
  headName: string;
  /** The head/leader's system prompt. */
  headSystemPrompt: string;
  members: TeamMember[];
  /** Whether this team is the currently active team (only one is active at a time). */
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Team definition in the backend/wire format sent with each turn. */
export interface BackendTeam {
  id: string;
  name: string;
  head: { name: string; system_prompt: string };
  members: Array<{ id: string; description: string; system_prompt: string; enabled: boolean }>;
  enabled: boolean;
}

/** Lifecycle state of a team agent (for the monitoring panel). */
export type TeamAgentStatus = "idle" | "running" | "queued" | "completed" | "failed";

/** Live streaming state of a single team-agent activation, rendered as its own block in chat. */
export interface TeamActivation {
  /** Activation id (agentId::seq) — unique per activation. */
  id: string;
  agentId: string;
  name: string;
  role: "head" | "member";
  /** Short description of what triggered this activation (e.g. "user request", "message from Niko"). */
  trigger: string;
  reasoning: string;
  content: string;
  tools: ToolActivity[];
  status: ToolActivityStatus;
  error?: string;
}

/** The whole team run attached to an assistant message. */
export interface TeamRun {
  teamId: string;
  teamName: string;
  headName: string;
  members: Array<{ id: string; name: string; description: string }>;
  /** Every activation keyed by activation id. */
  activations: Record<string, TeamActivation>;
  /** Chronological render order of activation ids. */
  order: string[];
  sendMessageToTeamEnabled?: boolean;
}

/** A logged inter-agent message (shown in the monitoring panel). */
export interface TeamMessageLog {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  kind: "task" | "message";
  message: string;
  at: number;
}

/** Per-agent live status snapshot (shown in the monitoring panel). */
export interface TeamAgentStatusEntry {
  id: string;
  name: string;
  role: "head" | "member";
  status: TeamAgentStatus;
  queued: number;
}

export interface Conversation {
  /** 20-character alphanumeric session id shared with the backend SQLite database. */
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  /**
   * Server-reported message count for sessions whose full snapshot has not been
   * fetched yet (conversation stubs listed from the database at boot).
   */
  messageCount?: number;
  /**
   * False while this conversation is only a stub from the session list — its
   * snapshot has not been loaded from the database yet. Stubs are never synced
   * back to the server (that would overwrite the stored history).
   */
  loaded?: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number | null;
  children?: FileNode[];
}

export type SearchProvider = "duckduckgo" | "tavily" | "exa" | "serpapi";

/** Web fetch/scrape provider. "builtin" is our free, keyless scraper (default). */
export type FetchProvider = "builtin" | "firecrawl";

/** Status a todo can be in. */
export type TodoStatus = "pending" | "in_progress" | "completed";

/** Priority a todo can carry. */
export type TodoPriority = "low" | "medium" | "high";

/** A single todo item in the session's task list, stored in the backend SQLite database. */
export interface TodoItem {
  /** Unique string identifier (starts at 1; used to refer to the todo in updates). */
  id: string;
  /** Clear description of the task. */
  content: string;
  /** One of `pending`, `in_progress`, or `completed`. */
  status: TodoStatus;
  /** One of `low`, `medium`, or `high`. */
  priority: TodoPriority;
}

/** Structured result streamed back for the TodoWrite / read_todos tools. */
export interface TodoToolResult {
  ok?: boolean;
  data?: {
    todos?: TodoItem[];
    count?: number;
    message?: string;
  };
  error?: { code?: string; message?: string };
}

/**
 * A single persistent memory file, stored in the backend SQLite database.
 * `path` is relative to the virtual memory root (/memory/): a bare name ("MEMORY.md") or a nested
 * path ("projects/app.md"). The agent reads/maintains these via the `memory` tool to self-evolve
 * across chat sessions. Three files are always pre-added and permanent: MEMORY.md, SOUL.md, USER.md.
 */
export interface MemoryFile {
  path: string;
  content: string;
}

/** Structured result streamed back for any of the five memory tools. */
export interface MemoryToolResult {
  ok?: boolean;
  data?: {
    // memory_list
    count?: number;
    files?: Array<{ path?: string; chars?: number; char_limit?: number; preadded?: boolean }>;
    tree?: string;
    // memory_read
    path?: string;
    content?: string;
    chars?: number;
    char_limit?: number;
    preadded?: boolean;
    line_count?: number;
    total_lines?: number;
    first_line?: number | null;
    last_line?: number | null;
    truncated?: boolean;
    // memory_write / memory_edit / memory_delete
    deleted?: boolean;
    created?: boolean;
    message?: string;
  };
  error?: {
    code?: string;
    message?: string;
    available_paths?: string[];
    attempted_chars?: number;
    char_limit?: number;
    over_by?: number;
    preadded_files?: string[];
  };
}

/**
 * A single persistent knowledge file, stored in the backend SQLite database.
 * `path` is relative to the virtual knowledge root (knowledge/): a bare name ("docs.md") or a nested
 * path ("api/reference.md"). The user curates the knowledge base (manual creation, file/folder
 * upload, or URL fetch); the agent reads/maintains it via the knowledge_* tools. Unlike memory, the
 * knowledge base has NO pre-added files and NO character limits — it starts empty.
 */
export interface KnowledgeFile {
  path: string;
  content: string;
}

/**
 * Where a knowledge file was fetched from (the URL method). Persisted per-path so reopening a
 * URL-sourced file offers a "Refetch" action that re-runs the same request and refreshes its content.
 */
export interface KnowledgeSource {
  /** The fetched URL (empty when the source was a pasted curl command). */
  url: string;
  format?: "markdown" | "text" | "json" | "autodetect";
  headers?: Array<{ key: string; value: string }>;
  apiKey?: string;
  /** Original pasted curl command, when the fetch was curl-based. */
  curl?: string;
  /** Epoch ms of the last successful fetch. */
  fetchedAt: number;
}

/** Structured result streamed back for any of the five knowledge tools. */
export interface KnowledgeToolResult {
  ok?: boolean;
  data?: {
    // knowledge_list
    count?: number;
    files?: Array<{ path?: string; chars?: number; lines?: number }>;
    tree?: string;
    // knowledge_read
    path?: string;
    content?: string;
    chars?: number;
    line_count?: number;
    total_lines?: number;
    first_line?: number | null;
    last_line?: number | null;
    truncated?: boolean;
    // knowledge_create / knowledge_edit / knowledge_delete
    created?: boolean;
    deleted?: boolean;
    message?: string;
  };
  error?: {
    code?: string;
    message?: string;
    available_paths?: string[];
    occurrences?: number;
    path?: string;
  };
}

/** A single search hit: the 1-based line number and that line's content. */
export interface SearchLocatorMatch {
  line?: number;
  content?: string;
}

/**
 * Structured result streamed back for the memory_search / knowledge_search tools. Each result is a
 * matched file path plus, for every hit, the 1-based line number and that line's content (also
 * pre-rendered as a `LINE <n>: <content>` block in `preview`).
 */
export interface SearchLocatorToolResult {
  ok?: boolean;
  data?: {
    query?: string;
    result_count?: number;
    match_count?: number;
    results?: Array<{
      path?: string;
      lines?: number[];
      matches?: SearchLocatorMatch[];
      preview?: string;
    }>;
    message?: string;
  };
  error?: { code?: string; message?: string };
}

/** Result returned by the URL → knowledge fetch endpoint (POST /api/scrape). */
export interface ScrapeResult {
  ok?: boolean;
  url: string;
  status: number;
  format: string;
  title: string;
  description: string;
  content: string;
  content_type: string;
}

/** One file attached to the conversation by the attach_files tool (for preview/download). */
export interface AttachedFile {
  /** The backend-issued unique id for the attachment (used as a React key). */
  id: string;
  /** Display name (basename) of the file. */
  name: string;
  /** Workspace-relative path used to build the preview/download URL. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** Best-effort MIME type derived from the file extension. */
  content_type: string;
  /** Human friendly size label, e.g. "2.4 KB". */
  size_label?: string;
}

/** Structured result streamed back for the embed_url tool. */
export interface EmbedUrlToolResult {
  ok?: boolean;
  data?: {
    url?: string;
    message?: string;
  };
  error?: { code?: string; message?: string; url?: string };
}

/** Structured result streamed back for the attach_files tool. */
export interface AttachFilesToolResult {
  ok?: boolean;
  data?: {
    files?: AttachedFile[];
    file_count?: number;
    errors?: Array<{ path?: string; error?: string }>;
    message?: string;
  };
  error?: { code?: string; message?: string; errors?: Array<{ path?: string; error?: string }> };
}

/** Live browser preview state driven by the embed_url tool. */
export interface BrowserPreview {
  /** The URL currently shown in the browser preview panel. */
  url: string;
  /** Whether the preview panel is open. */
  open: boolean;
}

export interface Settings {
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  baseUrl: string;
  searchProvider: SearchProvider;
  fetchProvider: FetchProvider;
  tavilyApiKey: string;
  exaApiKey: string;
  serpapiApiKey: string;
  firecrawlApiKey: string;
  /**
   * Whether the agent may use the sub-agent session tools (list_sub_agent_sessions /
   * reuse_same_sub_agent_session). "no" (default) hides both tools and their usage guidance;
   * "yes" enables them so the agent can continue previously run sub-agent sessions.
   */
  enableReuseSubAgentSession: "no" | "yes";
  /**
   * Whether multi-agent team mode is enabled. When "yes" and a team is active, the first user
   * message of a turn goes to the team's head/leader agent instead of the single agent. Default "no".
   */
  multiAgent: "no" | "yes";
  /**
   * Whether team members may message each other directly (gates the send_message_to_team tool).
   * Default "no" — members report to the leader, who coordinates. Only meaningful in team mode.
   */
  sendMessageToTeam: "no" | "yes";
  /**
   * Reasoning effort forwarded to the model. One of the presets
   * ("low" | "medium" | "high" | "max") or a custom string the model supports.
   * Defaults to "high"; models without reasoning support ignore it.
   */
  effort: string;
  /**
   * Sampling temperature (0–2) forwarded to the model. Defaults to 0.2; models
   * that don't support custom temperatures ignore or clamp the value.
   */
  temperature: number;
}

/** The four built-in reasoning-effort presets shown in Settings. */
export const EFFORT_PRESETS = ["low", "medium", "high", "max"] as const;
export type EffortPreset = (typeof EFFORT_PRESETS)[number];

/** Provider-format message sent to the backend to preserve history across turns. */
export interface BackendMessage {
  role: "user" | "assistant";
  content: string;
}

/** Payload sent to POST /api/chat/stream to start (or reconnect to) a turn. */
export interface StreamRequest {
  chat_id: string;
  user_message?: string;
  history?: BackendMessage[];
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  custom_provider?: CustomProviderConfig;
  max_iterations?: number;
  temperature?: number;
  /** Reasoning effort preset or custom string; forwarded to the provider. */
  effort?: string;
  since_event_id?: number;
  tavily_api_key?: string;
  exa_api_key?: string;
  serpapi_api_key?: string;
  search_provider?: SearchProvider;
  fetch_provider?: FetchProvider;
  firecrawl_api_key?: string;
  sub_agents?: BackendSubAgent[];
  skills?: BackendSkill[];
  todos?: TodoItem[];
  memory?: MemoryFile[];
  knowledge?: KnowledgeFile[];
  /** Mirrors settings.enableReuseSubAgentSession; gates the sub-agent session tools this turn. */
  enable_reuse_sub_agent_session?: "no" | "yes";
  /** Multi-agent team mode. When "yes" with a valid `team`, the turn is routed to the team runner. */
  multi_agent_enabled?: "no" | "yes";
  /** Whether members may message each other (gates send_message_to_team). */
  send_message_to_team_enabled?: "no" | "yes";
  /** The active agent team definition sent with the turn. */
  team?: BackendTeam;
}

/** SSE event payloads emitted by the curro-ai agent. */
export interface SSEEventData {
  _event_id?: number;
  value?: string;
  current?: number;
  limit?: number;
  state?: string;
  label?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  result?: Record<string, unknown>;
  message?: string;
  code?: string;
  content?: string;
  reasoning?: string | null;
  iteration_count?: number;
  aborted?: boolean;
  // Sub-agent side-channel fields
  agent?: string;
  task?: string;
  tool_id?: string;
  output?: string;
  error?: string;
  /** Whether this sub-agent run was launched in the background (wait_for_output=false). */
  background?: boolean;
  /** Whether the main agent shared its conversation context (send_my_context=true) with the run. */
  context_shared?: boolean;
  /** Workspace-relative ".curro/sub-agent" file where a background run writes its output. */
  output_file?: string;
  /**
   * Parent tool-call id set on every sub_agent_* event that belongs to a call_multiple_sub_agents
   * batch, so the frontend nests the child run inside the batch's tool block instead of a top-level
   * chip. Absent for a plain call_sub_agent run.
   */
  parent_tool_id?: string;
  /** 10-character session id of the individual sub-agent run this event belongs to. */
  sub_session_id?: string;
  // call_multiple_sub_agents batch-start fields
  /** Number of sub-agents in the batch (multi_sub_agents_start). */
  count?: number;
  /** The child sub-agents listed at batch start, each with its own child id + metadata. */
  agents?: Array<{
    id?: string;
    agent?: string;
    task?: string;
    background?: boolean;
    context_shared?: boolean;
    sub_session_id?: string;
    error?: string;
  }>;
  // submit_plan review fields
  chat_id?: string;
  plan?: string;
  // ask_question_to_user fields
  questions?: Array<{ question?: string; context?: string; options?: string[] }>;
  // todo_updated (TodoWrite) fields
  todos?: TodoItem[];
  // memory_updated (memory tool) fields
  memoryFiles?: MemoryFile[];
  // knowledge_updated (knowledge tools) fields
  knowledgeFiles?: KnowledgeFile[];
  // embed_url fields
  url?: string;
  // attach_files fields
  files?: AttachedFile[];
  file_count?: number;
  // memory-agent fields (memory_agent_queued / memory_agent_start / done)
  /** 10-character id of the background memory-agent run/session. */
  run_id?: string;
  /** Memory file paths a finished memory-agent run wrote/edited/deleted. */
  updated_files?: string[];
  /** How many memory-build requests were waiting behind this run when it started. */
  queued_remaining?: number;
  /** True when a replayed run was interrupted (e.g. backend restart) before finishing. */
  interrupted?: boolean;
  // ---- multi-agent team fields ---------------------------------------------
  /** team_start: the team id/name. */
  team_id?: string;
  team_name?: string;
  /** team_start: the head/leader. */
  head?: { id?: string; name?: string };
  /** team_start: the members (id + name + description). */
  members?: Array<{ id?: string; name?: string; description?: string }>;
  /** team_agent_*: the id of the agent this event belongs to. */
  agent_id?: string;
  /** team_agent_* / team_start: the role of the agent. */
  role?: "head" | "member" | string;
  /** team_agent_start: what triggered this activation. */
  trigger?: string;
  /** team_status: per-agent status snapshot. */
  team_agents?: Array<{ id?: string; name?: string; role?: string; status?: string; queued?: number }>;
  /** team_status: coordination counters. */
  pending?: number;
  activations?: number;
  /** team_message: routing metadata. */
  from_id?: string;
  from_name?: string;
  to_id?: string;
  to_name?: string;
  kind?: "task" | "message" | string;
  /** team_start: whether member-to-member messaging is enabled. */
  send_message_to_team_enabled?: boolean;
}

/** Lifecycle states of a background memory-agent run. */
export type MemoryAgentRunStatus = "queued" | "running" | "completed" | "failed";

/**
 * Metadata of one background memory-agent session, stored in the backend SQLite database.
 * A new run is created every time the main agent completes a turn; runs execute strictly
 * one at a time through the backend queue.
 */
export interface MemoryAgentRunMeta {
  id: string;
  chatSessionId: string;
  status: MemoryAgentRunStatus;
  provider: string;
  model: string;
  summary: string;
  error?: string | null;
  updatedFiles: string[];
  queuedAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
}

/** Counters for the memory-agent sessions popup. */
export interface MemoryAgentRunCounts {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Live (streamed) state of one memory-agent run, rendered in the memory-agent popup.
 * Ephemeral — rebuilt from the run's SSE stream (live or replayed); the durable record
 * lives in the backend SQLite database.
 */
export interface MemoryAgentLiveRun {
  id: string;
  reasoning: string;
  output: string;
  tools: ToolActivity[];
  status: "running" | "completed" | "failed";
  error?: string;
  updatedFiles: string[];
}
