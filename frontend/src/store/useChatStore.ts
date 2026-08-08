import { create } from 'zustand'

import type { BackendMessage, SandboxInfo, SubAgentStream, ToolChip, UiMessage } from '@/types/chat'
import { createId } from '@/utils/id'

function createEphemeralChatId(): string {
  return createId('chat')
}

interface ChatState {
  chatId: string
  title: string
  messages: UiMessage[]
  modelHistory: BackendMessage[]
  eventHistory: Array<Record<string, unknown>>
  sandbox?: SandboxInfo
  isStreaming: boolean
  streamingChatId: string | null
  statusLabel: string
  iterationCurrent: number
  iterationLimit: number
  subAgentStreams: Record<string, SubAgentStream>

  setStatusLabel: (value: string) => void
  setStreaming: (value: boolean) => void
  setStreamingChatId: (chatId: string | null) => void
  setIteration: (current: number, limit: number) => void
  resetChat: () => void
  setLastMessageIdle: () => void
  addUserMessage: (content: string) => void
  startAssistantMessage: () => string
  appendAssistantToken: (token: string) => void
  appendAssistantReasoning: (token: string) => void
  finalizeAssistantMessage: (content: string, reasoning?: string) => void
  markAssistantError: (message: string) => void
  addToolChip: (tool: ToolChip) => void
  updateLastToolChip: (updates: Partial<ToolChip>) => void
  setSandboxInfo: (sandbox: SandboxInfo) => void
  replaceModelHistory: (history: BackendMessage[]) => void
  addEvent: (event: Record<string, unknown>) => void
  setSubAgentStream: (session: string, stream: SubAgentStream) => void
  appendSubAgentToken: (session: string, token: string) => void
  appendSubAgentReasoning: (session: string, token: string) => void
  addSubAgentToolChip: (session: string, chip: ToolChip) => void
  updateLastSubAgentToolChip: (session: string, updates: Partial<ToolChip>) => void
  setSubAgentStatus: (session: string, status: SubAgentStream['status']) => void
  removeSubAgentStream: (session: string) => void
}

function emptyState() {
  return {
    chatId: createEphemeralChatId(),
    title: 'New chat',
    messages: [] as UiMessage[],
    modelHistory: [] as BackendMessage[],
    eventHistory: [] as Array<Record<string, unknown>>,
    isStreaming: false,
    streamingChatId: null as string | null,
    statusLabel: 'Ready',
    iterationCurrent: 0,
    iterationLimit: 1000,
    subAgentStreams: {} as Record<string, SubAgentStream>,
  }
}

const initialState = emptyState()

export const useChatStore = create<ChatState>()((set) => ({
  ...initialState,

  setStatusLabel: (value) => set({ statusLabel: value }),
  setStreaming: (value) => set({ isStreaming: value }),
  setStreamingChatId: (chatId) => set({ streamingChatId: chatId }),
  setIteration: (current, limit) => set({ iterationCurrent: current, iterationLimit: limit }),

  resetChat: () => set(emptyState()),

  setLastMessageIdle: () => set((state) => {
    const messages = state.messages.map((message, index) =>
      index === state.messages.length - 1 && message.role === 'assistant' && message.status === 'streaming'
        ? { ...message, status: 'idle' as const }
        : message,
    )
    return { messages }
  }),

  addUserMessage: (content) => set((state) => {
    const now = new Date().toISOString()
    const nextMessages: UiMessage[] = [
      ...state.messages,
      { id: createId('msg'), role: 'user', content, createdAt: now, status: 'idle' },
    ]
    const nextHistory: BackendMessage[] = [...state.modelHistory, { role: 'user', content, timestamp: now }]
    return {
      title: state.messages.length === 0 ? content.slice(0, 48) || 'New chat' : state.title,
      messages: nextMessages,
      modelHistory: nextHistory,
    }
  }),

  startAssistantMessage: () => {
    const messageId = createId('msg')
    set((state) => ({
      messages: [
        ...state.messages,
        { id: messageId, role: 'assistant', content: '', reasoning: '', createdAt: new Date().toISOString(), status: 'streaming', toolChips: [] },
      ],
    }))
    return messageId
  },

  appendAssistantToken: (token) => set((state) => ({
    messages: state.messages.map((message, index) => index === state.messages.length - 1 && message.role === 'assistant'
      ? { ...message, content: `${message.content}${token}` }
      : message),
  })),

  appendAssistantReasoning: (token) => set((state) => ({
    messages: state.messages.map((message, index) => index === state.messages.length - 1 && message.role === 'assistant'
      ? { ...message, reasoning: `${message.reasoning ?? ''}${token}` }
      : message),
  })),

  finalizeAssistantMessage: (content, reasoning) => set((state) => {
    const now = new Date().toISOString()
    return {
      messages: state.messages.map((message, index) => index === state.messages.length - 1 && message.role === 'assistant'
        ? { ...message, content, reasoning: reasoning ?? message.reasoning, status: 'idle' }
        : message),
      modelHistory: [...state.modelHistory, { role: 'assistant', content, timestamp: now }],
    }
  }),

  markAssistantError: (message) => set((state) => ({
    messages: state.messages.map((item, index) => index === state.messages.length - 1 && item.role === 'assistant'
      ? { ...item, content: message, status: 'error' }
      : item),
  })),

  addToolChip: (tool) => set((state) => ({
    messages: state.messages.map((message, index) => index === state.messages.length - 1 && message.role === 'assistant'
      ? { ...message, toolChips: [...(message.toolChips ?? []), tool] }
      : message),
    eventHistory: [...state.eventHistory, { type: 'tool', tool }],
  })),

  updateLastToolChip: (updates) => set((state) => ({
    messages: state.messages.map((message, index) => {
      if (index !== state.messages.length - 1 || message.role !== 'assistant') return message
      const toolChips = message.toolChips ?? []
      if (toolChips.length === 0) return message
      return {
        ...message,
        toolChips: toolChips.map((chip, i) => i === toolChips.length - 1 ? { ...chip, ...updates } : chip),
      }
    }),
  })),

  setSandboxInfo: (sandbox) => set({ sandbox }),

  replaceModelHistory: (history) => set({ modelHistory: history }),

  addEvent: (event) => set((state) => ({
    eventHistory: [...state.eventHistory, event],
  })),

  setSubAgentStream: (session, stream) => set((state) => ({
    subAgentStreams: {
      ...state.subAgentStreams,
      [session]: stream,
    },
  })),

  appendSubAgentToken: (session, token) => set((state) => {
    const existing = state.subAgentStreams[session]
    if (!existing) return state
    return {
      subAgentStreams: {
        ...state.subAgentStreams,
        [session]: { ...existing, content: existing.content + token },
      },
    }
  }),

  appendSubAgentReasoning: (session, token) => set((state) => {
    const existing = state.subAgentStreams[session]
    if (!existing) return state
    return {
      subAgentStreams: {
        ...state.subAgentStreams,
        [session]: { ...existing, reasoning: existing.reasoning + token },
      },
    }
  }),

  addSubAgentToolChip: (session, chip) => set((state) => {
    const existing = state.subAgentStreams[session]
    if (!existing) return state
    return {
      subAgentStreams: {
        ...state.subAgentStreams,
        [session]: { ...existing, toolChips: [...existing.toolChips, chip] },
      },
    }
  }),

  updateLastSubAgentToolChip: (session, updates) => set((state) => {
    const existing = state.subAgentStreams[session]
    if (!existing || existing.toolChips.length === 0) return state
    const chips = existing.toolChips
    const updatedChips = chips.map((c, i) => i === chips.length - 1 ? { ...c, ...updates } : c)
    return {
      subAgentStreams: {
        ...state.subAgentStreams,
        [session]: { ...existing, toolChips: updatedChips },
      },
    }
  }),

  setSubAgentStatus: (session, status) => set((state) => {
    const existing = state.subAgentStreams[session]
    if (!existing) return state
    return {
      subAgentStreams: {
        ...state.subAgentStreams,
        [session]: { ...existing, status },
      },
    }
  }),

  removeSubAgentStream: (session) => set((state) => {
    if (!(session in state.subAgentStreams)) return state
    const rest = { ...state.subAgentStreams }
    delete rest[session]
    return { subAgentStreams: rest }
  }),
}))
