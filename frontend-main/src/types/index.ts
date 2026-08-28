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
 * A user-defined OpenAI-compatible provider, persisted in the browser (localStorage).
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
  /** Workspace-relative ".curro/sub-agent" file where a background run writes its final output. */
  outputFile?: string;
}

/** A user-defined sub-agent, stored in the browser (localStorage) — never on the server. */
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
 * A user-defined skill, stored in the browser (localStorage) — never on the server. A skill is a
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
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
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

/** A single todo item in the session's task list, stored in the browser (localStorage). */
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
 * A single persistent memory file, stored in the browser (localStorage) — never on the server.
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
 * A single persistent knowledge file, stored in the browser (localStorage) — never on the server.
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

/**
 * Structured result streamed back for the memory_search / knowledge_search tools. Each result is a
 * matched file path plus the 1-based line numbers where the natural-language query was found — no
 * file contents are returned, only locations.
 */
export interface SearchLocatorToolResult {
  ok?: boolean;
  data?: {
    query?: string;
    result_count?: number;
    match_count?: number;
    results?: Array<{ path?: string; lines?: number[] }>;
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
}

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
  /** Workspace-relative ".curro/sub-agent" file where a background run writes its output. */
  output_file?: string;
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
}
