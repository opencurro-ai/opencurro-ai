import { useCallback, useEffect, useRef } from 'react'

import { ensureChatSession, streamChat } from '@/lib/api'
import type { StreamConnection } from '@/lib/api'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { createId } from '@/utils/id'

export function useAgentChat() {
  const store = useChatStore()
  const settings = useSettingsStore()

  const connectionRef = useRef<StreamConnection | null>(null)

  const makeHandler = useCallback(
    (chatId: string) => {
      return (event: string, data: Record<string, unknown>) => {
        store.addEvent(chatId, { type: event, data })
        if (event === 'status') {
          const label = typeof data.label === 'string' ? data.label : 'Working...'
          store.setStatusLabel(label)
        }
        if (event === 'iteration') {
          const current = typeof data.current === 'number' ? data.current : 0
          const limit = typeof data.limit === 'number' ? data.limit : 1000
          store.setIteration(current, limit)
        }
        if (event === 'sandbox') {
          const sandboxId = typeof data.sandbox_id === 'string' ? data.sandbox_id : ''
          const provider = typeof data.provider === 'string' ? data.provider : 'novita'
          const rootPath = typeof data.root_path === 'string' ? data.root_path : '/home/user'
          store.setSandboxInfo(chatId, { sandboxId, provider, rootPath })
          store.setStatusLabel('Thinking...')
        }
        if (event === 'tool_call') {
          const dataSessionNames = data.session_names
          const sessionNames = Array.isArray(dataSessionNames) ? dataSessionNames.filter((s: unknown): s is string => typeof s === 'string') : undefined
          const toolName = typeof data.name === 'string' ? data.name : 'tool'
          const chipSession = typeof data.session === 'string' ? data.session : (typeof data.session_name === 'string' ? data.session_name : undefined)
          store.addToolChip(chatId, {
            id: createId('tool'),
            name: toolName,
            label: typeof data.label === 'string' ? data.label : 'Tool activity',
            filePath: typeof data.file_path === 'string' ? data.file_path : undefined,
            command: typeof data.command === 'string' ? data.command : undefined,
            sessionName: chipSession || 'default',
            sessionNames,
            path: typeof data.path === 'string' ? data.path : undefined,
            query: typeof data.query === 'string' ? data.query : undefined,
            url: typeof data.url === 'string' ? data.url : undefined,
            oldString: typeof data.old_string === 'string' ? data.old_string : undefined,
            newString: typeof data.new_string === 'string' ? data.new_string : undefined,
            input: typeof data.input === 'string' ? data.input : undefined,
          })
          if (toolName === 'call_sub_agent' && chipSession) {
            store.setSubAgentStream(chipSession, {
              session: chipSession,
              agent: typeof data.agent === 'string' ? data.agent : '',
              content: '',
              reasoning: '',
              toolChips: [],
              status: 'running',
            })
          }
        }
        if (event === 'tool_result') {
          store.updateLastToolChip(chatId, {
            ok: typeof data.ok === 'boolean' ? data.ok : undefined,
            resultData: typeof data.result === 'object' && data.result !== null ? data.result as Record<string, unknown> : undefined,
          })
        }
        if (event === 'reasoning') {
          const token = typeof data.value === 'string' ? data.value : ''
          store.appendAssistantReasoning(chatId, token)
        }
        if (event === 'token') {
          const token = typeof data.value === 'string' ? data.value : ''
          store.appendAssistantToken(chatId, token)
        }
        if (event === 'message_complete') {
          const finalContent = typeof data.content === 'string' ? data.content : ''
          const finalReasoning = typeof data.reasoning === 'string' ? data.reasoning : undefined
          store.finalizeAssistantMessage(chatId, finalContent, finalReasoning)
          store.setStatusLabel('Ready')
        }
        if (event === 'error') {
          const message = typeof data.message === 'string' ? data.message : 'Unknown error'
          store.markAssistantError(chatId, message)
          store.setStatusLabel('Issue detected')
        }
        if (event === 'done') {
          store.setStreaming(false)
          store.setStatusLabel('Ready')
        }
        if (event.startsWith('sub_agent_')) {
          const session = typeof data.session === 'string' ? data.session : 'default'
          if (event === 'sub_agent_token') {
            const value = typeof data.value === 'string' ? data.value : ''
            store.appendSubAgentToken(session, value)
          }
          if (event === 'sub_agent_reasoning') {
            const value = typeof data.value === 'string' ? data.value : ''
            store.appendSubAgentReasoning(session, value)
          }
          if (event === 'sub_agent_tool_call') {
            const toolName = typeof data.name === 'string' ? data.name : 'tool'
            const dataSessionNames = data.session_names
            const sessionNames = Array.isArray(dataSessionNames) ? dataSessionNames.filter((s: unknown): s is string => typeof s === 'string') : undefined
            store.addSubAgentToolChip(session, {
              id: createId('tool'),
              name: toolName,
              label: typeof data.label === 'string' ? data.label : 'Tool activity',
              filePath: typeof data.file_path === 'string' ? data.file_path : undefined,
              command: typeof data.command === 'string' ? data.command : undefined,
              sessionName: typeof data.session_name === 'string' ? data.session_name : 'default',
              sessionNames,
              path: typeof data.path === 'string' ? data.path : undefined,
              query: typeof data.query === 'string' ? data.query : undefined,
              url: typeof data.url === 'string' ? data.url : undefined,
              oldString: typeof data.old_string === 'string' ? data.old_string : undefined,
              newString: typeof data.new_string === 'string' ? data.new_string : undefined,
              input: typeof data.input === 'string' ? data.input : undefined,
            })
          }
          if (event === 'sub_agent_tool_result') {
            store.updateLastSubAgentToolChip(session, {
              ok: typeof data.ok === 'boolean' ? data.ok : undefined,
              resultData: typeof data.result === 'object' && data.result !== null ? data.result as Record<string, unknown> : undefined,
            })
          }
          if (event === 'sub_agent_done') {
            store.setSubAgentStatus(session, 'done')
          }
          if (event === 'sub_agent_error') {
            store.setSubAgentStatus(session, 'error')
          }
        }
      }
    },
    [store],
  )

  const getStreamPayload = useCallback(
    (chatId: string, userMessage?: string, history?: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content?: string | null; timestamp?: string }>, sinceEventId?: number) => ({
      chat_id: chatId,
      user_message: userMessage,
      history,
      provider: settings.selectedProvider,
      model: settings.selectedModel,
      api_key: settings.providerKeys[settings.selectedProvider],
      base_url: settings.providerBaseUrls[settings.selectedProvider],
      sandbox: {
        api_key: settings.novitaApiKey,
        template_id: settings.novitaTemplateId || undefined,
        provider: 'novita' as const,
        timeout_seconds: 3600,
      },
      max_iterations: 1000,
      tavily_api_key: settings.tavilyApiKey || undefined,
      exa_api_key: settings.exaApiKey || undefined,
      search_provider: settings.searchProvider,
      firecrawl_api_key: settings.firecrawlApiKey || undefined,
      sub_agents: settings.subAgents.length > 0 ? settings.subAgents.map((sa) => ({
        name: sa.name,
        description: sa.description,
        system_prompt: sa.systemPrompt,
        tools: sa.tools,
        enabled: sa.enabled,
      })) : undefined,
      since_event_id: sinceEventId,
    }),
    [settings],
  )

  useEffect(() => {
    if (store.isStreaming && store.activeChatId) {
      const chatId = store.activeChatId
      const handler = makeHandler(chatId)
      const sinceId = store.lastEventId[chatId] ?? -1
      const payload = getStreamPayload(chatId, undefined, undefined, sinceId)

      const conn = streamChat(
        payload,
        handler,
        (eventId) => store.setLastEventId(chatId, eventId),
      )
      connectionRef.current = conn
    }

    return () => {
      if (connectionRef.current) {
        connectionRef.current.abort()
        connectionRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    const chatId = store.activeChatId || store.chats[0]?.id
    if (!chatId) {
      throw new Error('No active chat available.')
    }
    if (!settings.selectedModel) {
      throw new Error('Select a model first.')
    }
    const providerKey = settings.providerKeys[settings.selectedProvider]
    if (!providerKey) {
      throw new Error(`Add a ${settings.selectedProvider} API key first.`)
    }
    if (!settings.novitaApiKey) {
      throw new Error('Add a Novita sandbox API key first.')
    }

    const chat = store.chats.find((item) => item.id === chatId)
    if (!chat) {
      throw new Error('Chat not found.')
    }

    if (connectionRef.current) {
      connectionRef.current.abort()
      connectionRef.current = null
    }

    store.addUserMessage(chatId, content)
    store.addEvent(chatId, { type: 'user_message', content })
    const assistantId = store.startAssistantMessage(chatId)
    void assistantId
    store.setStatusLabel('Thinking...')
    store.setStreaming(true)
    store.setIteration(0, 1000)
    store.setLastEventId(chatId, -1)

    const nextHistory = [...chat.modelHistory, { role: 'user' as const, content }]
    await ensureChatSession(chatId, nextHistory)

    const handler = makeHandler(chatId)
    const payload = getStreamPayload(chatId, content, chat.modelHistory, -1)

    const conn = streamChat(
      payload,
      handler,
      (eventId) => store.setLastEventId(chatId, eventId),
    )
    connectionRef.current = conn

    try {
      await conn.promise
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.markAssistantError(chatId, message)
      store.setStreaming(false)
      store.setStatusLabel('Issue detected')
      throw error
    }
  }, [
    store,
    settings,
    makeHandler,
    getStreamPayload,
  ])

  return { sendMessage }
}
