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

export interface Settings {
  provider: string;
  model: string;
  apiKeys: Record<string, string>; // provider id -> api key
  baseUrl: string;
}

// Provider-format message sent to the backend to preserve history.
export interface BackendMessage {
  role: "user" | "assistant";
  content: string;
}
