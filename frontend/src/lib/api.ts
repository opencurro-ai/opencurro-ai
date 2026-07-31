import { env } from '@/lib/env'
import type { BackendMessage, ProviderId } from '@/types/chat'
import type { ProviderMetadata, ProviderModel } from '@/types/provider'
import type { SandboxFilesResponse } from '@/types/sandbox'

export interface StreamChatPayload {
  chat_id: string
  user_message?: string
  history?: BackendMessage[]
  provider?: ProviderId
  model?: string
  api_key?: string
  base_url?: string
  sandbox?: {
    api_key: string
    template_id?: string
    provider: 'novita'
    timeout_seconds: number
  }
  max_iterations?: number
  tavily_api_key?: string
  exa_api_key?: string
  serpapi_api_key?: string
  search_provider?: string
  firecrawl_api_key?: string
  sub_agents?: Array<{
    name: string
    description: string
    system_prompt: string
    tools: string[]
    enabled: boolean
  }>
  since_event_id?: number
}

export interface StreamConnection {
  abort: () => void
  promise: Promise<void>
}

export async function fetchProviders(): Promise<ProviderMetadata[]> {
  const response = await fetch(`${env.backendUrl}/api/providers`)
  if (!response.ok) {
    throw new Error('Failed to load providers.')
  }
  return response.json()
}

export async function fetchModels(provider: ProviderId, apiKey: string, baseUrl?: string): Promise<ProviderModel[]> {
  const response = await fetch(`${env.backendUrl}/api/providers/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl || undefined }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to load models.')
  }

  const payload = await response.json()
  return payload.models as ProviderModel[]
}

export async function ensureChatSession(chatId: string, history: BackendMessage[]): Promise<void> {
  await fetch(`${env.backendUrl}/api/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, history }),
  })
}

export async function abortChat(chatId: string): Promise<void> {
  await fetch(`${env.backendUrl}/api/chat/abort/${encodeURIComponent(chatId)}`, {
    method: 'POST',
  })
}

export async function killSandbox(chatId: string): Promise<void> {
  await fetch(`${env.backendUrl}/api/sandbox/kill/${encodeURIComponent(chatId)}`, {
    method: 'POST',
  })
}

export async function fetchSandboxFiles(chatId: string): Promise<SandboxFilesResponse> {
  const params = new URLSearchParams({ chat_id: chatId, path: '/home/user', depth: '6' })
  const response = await fetch(`${env.backendUrl}/api/sandbox/files?${params}`)
  if (!response.ok) {
    throw new Error('No active sandbox yet.')
  }
  return response.json()
}

export async function fetchSandboxFileContent(chatId: string, filePath: string): Promise<string> {
  const params = new URLSearchParams({ chat_id: chatId, path: filePath })
  const response = await fetch(`${env.backendUrl}/api/sandbox/file-content?${params}`)
  if (!response.ok) {
    throw new Error('Failed to load file content.')
  }
  const data = await response.json()
  return data.content as string
}

export async function saveSandboxFileContent(chatId: string, filePath: string, content: string): Promise<void> {
  const response = await fetch(`${env.backendUrl}/api/sandbox/file-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, path: filePath, content }),
  })
  if (!response.ok) {
    throw new Error('Failed to save file.')
  }
}

export function streamChat(
  payload: StreamChatPayload,
  onChunk: (event: string, data: Record<string, unknown>) => void,
  onEventId?: (eventId: number) => void,
): StreamConnection {
  let aborted = false
  let lastEventId = payload.since_event_id ?? -1
  const abortController = new AbortController()

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  class StreamConnectionError extends Error {}

  const connect = async (): Promise<void> => {
    let retryDelay = 500

    while (!aborted) {
      try {
        const modifiedPayload = { ...payload, since_event_id: lastEventId }
        const response = await fetch(`${env.backendUrl}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modifiedPayload),
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new StreamConnectionError(`Server error: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        retryDelay = 500

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n')
            let eventName = 'message'
            const dataLines: string[] = []

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim()
              }
              if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim())
              }
            }

            if (!dataLines.length) continue

            const parsedData = JSON.parse(dataLines.join('\n')) as Record<string, unknown>

            if (typeof parsedData._event_id === 'number') {
              lastEventId = parsedData._event_id
              delete parsedData._event_id
              onEventId?.(lastEventId)
            }

            onChunk(eventName, parsedData)
          }
        }

        return
      } catch (err) {
        if (aborted || abortController.signal.aborted) return

        if (err instanceof StreamConnectionError) {
          throw err
        }

        if (err instanceof TypeError || (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch')))) {
          await sleep(retryDelay)
          retryDelay = Math.min(retryDelay * 2, 15000)
          continue
        }

        throw err
      }
    }
  }

  const promise = connect().catch((err) => {
    if (aborted || abortController.signal.aborted) return
    throw err
  })

  return {
    abort: () => {
      aborted = true
      abortController.abort()
    },
    promise,
  }
}
