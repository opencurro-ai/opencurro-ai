import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { BackendMessage, ChatRecord, SandboxInfo, SubAgentStream, ToolChip, UiMessage } from '@/types/chat'
import { createId } from '@/utils/id'

function createEmptyChat(): ChatRecord {
  const now = new Date().toISOString()
  return {
    id: createId('chat'),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    modelHistory: [],
    eventHistory: [],
  }
}

const initialChat = createEmptyChat()

interface ChatState {
  chats: ChatRecord[]
  activeChatId: string
  isStreaming: boolean
  streamingChatId: string | null
  statusLabel: string
  iterationCurrent: number
  iterationLimit: number
  lastEventId: Record<string, number>
  subAgentStreams: Record<string, SubAgentStream>
  setStatusLabel: (value: string) => void
  setStreaming: (value: boolean) => void
  setStreamingChatId: (chatId: string | null) => void
  setIteration: (current: number, limit: number) => void
  setLastEventId: (chatId: string, eventId: number) => void
  createChat: () => string
  createChatWithId: (chatId: string) => void
  deleteChat: (chatId: string) => void
  setActiveChat: (chatId: string) => void
  setLastMessageIdle: (chatId: string) => void
  addUserMessage: (chatId: string, content: string) => void
  startAssistantMessage: (chatId: string) => string
  appendAssistantToken: (chatId: string, token: string) => void
  appendAssistantReasoning: (chatId: string, token: string) => void
  finalizeAssistantMessage: (chatId: string, content: string, reasoning?: string) => void
  markAssistantError: (chatId: string, message: string) => void
  addToolChip: (chatId: string, tool: ToolChip) => void
  updateLastToolChip: (chatId: string, updates: Partial<ToolChip>) => void
  setSandboxInfo: (chatId: string, sandbox: SandboxInfo) => void
  replaceModelHistory: (chatId: string, history: BackendMessage[]) => void
  addEvent: (chatId: string, event: Record<string, unknown>) => void
  setSubAgentStream: (session: string, stream: SubAgentStream) => void
  appendSubAgentToken: (session: string, token: string) => void
  appendSubAgentReasoning: (session: string, token: string) => void
  addSubAgentToolChip: (session: string, chip: ToolChip) => void
  updateLastSubAgentToolChip: (session: string, updates: Partial<ToolChip>) => void
  setSubAgentStatus: (session: string, status: SubAgentStream['status']) => void
  removeSubAgentStream: (session: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [initialChat],
      activeChatId: initialChat.id,
      isStreaming: false,
      streamingChatId: null,
      statusLabel: 'Ready',
      iterationCurrent: 0,
      iterationLimit: 1000,
      lastEventId: {},
      subAgentStreams: {},
      setStatusLabel: (value) => set({ statusLabel: value }),
      setStreaming: (value) => set({ isStreaming: value }),
      setStreamingChatId: (chatId) => set({ streamingChatId: chatId }),
      setIteration: (current, limit) => set({ iterationCurrent: current, iterationLimit: limit }),
      setLastEventId: (chatId, eventId) => set((state) => ({ lastEventId: { ...state.lastEventId, [chatId]: eventId } })),
      createChat: () => {
        const chat = createEmptyChat()
        set((state) => ({
          chats: [chat, ...state.chats],
          activeChatId: chat.id,
          isStreaming: false,
          statusLabel: 'Ready',
          iterationCurrent: 0,
          iterationLimit: 1000,
          subAgentStreams: {},
        }))
        return chat.id
      },
      createChatWithId: (chatId) => {
        set((state) => {
          if (state.chats.some((chat) => chat.id === chatId)) {
            return { activeChatId: chatId }
          }
          const now = new Date().toISOString()
          const chat: ChatRecord = {
            id: chatId,
            title: 'New chat',
            createdAt: now,
            updatedAt: now,
            messages: [],
            modelHistory: [],
            eventHistory: [],
          }
          return {
            chats: [chat, ...state.chats],
            activeChatId: chatId,
          }
        })
      },
      deleteChat: (chatId) => {
        const chats = get().chats.filter((chat) => chat.id !== chatId)
        const nextChats = chats.length ? chats : [createEmptyChat()]
        set((state) => ({
          chats: nextChats,
          activeChatId: nextChats[0].id,
          streamingChatId: state.streamingChatId === chatId ? null : state.streamingChatId,
          isStreaming: state.streamingChatId === chatId ? false : state.isStreaming,
        }))
      },
      setActiveChat: (chatId) => set({ activeChatId: chatId }),
      setLastMessageIdle: (chatId) => set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat
          const messages = chat.messages.map((message, index) =>
            index === chat.messages.length - 1 && message.role === 'assistant' && message.status === 'streaming'
              ? { ...message, status: 'idle' as const }
              : message,
          )
          return { ...chat, messages }
        }),
      })),
      addUserMessage: (chatId, content) => set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat
          const now = new Date().toISOString()
          const nextMessages: UiMessage[] = [
            ...chat.messages,
            { id: createId('msg'), role: 'user', content, createdAt: now, status: 'idle' },
          ]
          const nextHistory: BackendMessage[] = [...chat.modelHistory, { role: 'user', content, timestamp: now }]
          return {
            ...chat,
            title: chat.messages.length === 0 ? content.slice(0, 48) || 'New chat' : chat.title,
            messages: nextMessages,
            modelHistory: nextHistory,
            updatedAt: now,
          }
        }),
      })),
      startAssistantMessage: (chatId) => {
        const messageId = createId('msg')
        set((state) => ({
          chats: state.chats.map((chat) => chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { id: messageId, role: 'assistant', content: '', reasoning: '', createdAt: new Date().toISOString(), status: 'streaming', toolChips: [] },
                ],
              }
            : chat),
        }))
        return messageId
      },
      appendAssistantToken: (chatId, token) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message, index) => index === chat.messages.length - 1 && message.role === 'assistant'
                ? { ...message, content: `${message.content}${token}` }
                : message),
              updatedAt: new Date().toISOString(),
            }
          : chat),
      })),
      appendAssistantReasoning: (chatId, token) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message, index) => index === chat.messages.length - 1 && message.role === 'assistant'
                ? { ...message, reasoning: `${message.reasoning ?? ''}${token}` }
                : message),
              updatedAt: new Date().toISOString(),
            }
          : chat),
      })),
      finalizeAssistantMessage: (chatId, content, reasoning) => set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat
          const now = new Date().toISOString()
          return {
            ...chat,
            messages: chat.messages.map((message, index) => index === chat.messages.length - 1 && message.role === 'assistant'
              ? { ...message, content, reasoning: reasoning ?? message.reasoning, status: 'idle' }
              : message),
            modelHistory: [...chat.modelHistory, { role: 'assistant', content, timestamp: now }],
            updatedAt: now,
          }
        }),
      })),
      markAssistantError: (chatId, message) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((item, index) => index === chat.messages.length - 1 && item.role === 'assistant'
                ? { ...item, content: message, status: 'error' }
                : item),
              updatedAt: new Date().toISOString(),
            }
          : chat),
      })),
      addToolChip: (chatId, tool) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message, index) => index === chat.messages.length - 1 && message.role === 'assistant'
                ? { ...message, toolChips: [...(message.toolChips ?? []), tool] }
                : message),
              eventHistory: [...chat.eventHistory, { type: 'tool', tool }],
            }
          : chat),
      })),
      updateLastToolChip: (chatId, updates) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message, index) => {
                if (index !== chat.messages.length - 1 || message.role !== 'assistant') return message
                const toolChips = message.toolChips ?? []
                if (toolChips.length === 0) return message
                return {
                  ...message,
                  toolChips: toolChips.map((chip, i) => i === toolChips.length - 1 ? { ...chip, ...updates } : chip),
                }
              }),
            }
          : chat),
      })),
      setSandboxInfo: (chatId, sandbox) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId ? { ...chat, sandbox, updatedAt: new Date().toISOString() } : chat),
      })),
      replaceModelHistory: (chatId, history) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId ? { ...chat, modelHistory: history } : chat),
      })),
      addEvent: (chatId, event) => set((state) => ({
        chats: state.chats.map((chat) => chat.id === chatId ? { ...chat, eventHistory: [...chat.eventHistory, event] } : chat),
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
    }),
    {
      name: 'novita-agent-chats',
      partialize: (state) => ({
        chats: state.chats,
        activeChatId: state.activeChatId,
        isStreaming: state.isStreaming,
        streamingChatId: state.streamingChatId,
        lastEventId: state.lastEventId,
      }),
    },
  ),
)