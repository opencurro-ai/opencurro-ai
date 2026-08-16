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
  session: string;
  agent: string;
  task: string;
  reasoning: string;
  output: string;
  tools: ToolActivity[];
  status: ToolActivityStatus;
  error?: string;
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

export type SearchProvider = "tavily" | "exa" | "serpapi";

export interface Settings {
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  baseUrl: string;
  searchProvider: SearchProvider;
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
  firecrawl_api_key?: string;
  sub_agents?: BackendSubAgent[];
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
  session?: string;
  agent?: string;
  task?: string;
  tool_id?: string;
  output?: string;
  error?: string;
  new_session?: boolean;
  // submit_plan review fields
  chat_id?: string;
  plan?: string;
}
