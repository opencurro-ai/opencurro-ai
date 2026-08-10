export type ChatRole = 'user' | 'assistant'

export type ProviderId = 'openrouter' | 'groq' | 'nvidia' | 'fireworks' | 'ollama_cloud' | 'opencode_zen' | 'aihubmix' | 'blueclaw' | 'requesty' | 'unorouter' | 'vercel_ai_gateway'

export interface ToolChip {
  id: string
  name: string
  label: string
  filePath?: string
  command?: string
  sessionName?: string
  sessionNames?: string[]
  path?: string
  query?: string
  url?: string
  oldString?: string
  newString?: string
  input?: string
  ok?: boolean
  resultData?: Record<string, unknown>
}

export interface UiMessage {
  id: string
  role: ChatRole
  content: string
  reasoning?: string
  createdAt: string
  status?: 'idle' | 'streaming' | 'error'
  toolChips?: ToolChip[]
}

export interface BackendMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<Record<string, unknown>>
  tool_call_id?: string
  name?: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

export interface SandboxInfo {
  sandboxId: string
  provider: string
  rootPath: string
  codeServerUrl?: string
}

export interface SubAgentConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SubAgentStream {
  session: string
  agent: string
  content: string
  reasoning: string
  toolChips: ToolChip[]
  status: 'running' | 'done' | 'error'
}

export interface ChatRecord {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: UiMessage[]
  modelHistory: BackendMessage[]
  eventHistory: Array<Record<string, unknown>>
  sandbox?: SandboxInfo
}