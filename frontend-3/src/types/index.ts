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

export type ToolActivityStatus = "running" | "ok" | "error";

export interface ToolActivity {
  id: string;
  name: string;
  label: string;
  status: ToolActivityStatus;
  filePath?: string;
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
  max_iterations?: number;
  temperature?: number;
  since_event_id?: number;
  tavily_api_key?: string;
  exa_api_key?: string;
  serpapi_api_key?: string;
  search_provider?: SearchProvider;
  firecrawl_api_key?: string;
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
}
