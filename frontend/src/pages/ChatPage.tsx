import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { NavigationRail } from '@/components/sidebar/NavigationRail'
import { useAgentChat } from '@/hooks/useAgentChat'
import { consumePendingPrompt } from '@/lib/pendingPrompt'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

export function ChatPage() {
  const { sendMessage, stopStreaming } = useAgentChat()
  const { chatId, title, messages, sandbox, eventHistory, modelHistory, isStreaming, iterationCurrent, iterationLimit, streamingChatId } = useChatStore()
  const { novitaApiKey, providerKeys, selectedModel, selectedProvider } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState('')
  const pendingSentRef = useRef(false)

  const readyToChat = useMemo(
    () => Boolean(providerKeys[selectedProvider] && selectedModel && novitaApiKey),
    [novitaApiKey, providerKeys, selectedModel, selectedProvider],
  )

  const handleSendMessage = useCallback(async (value: string) => {
    try {
      setError('')
      await sendMessage(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [sendMessage])

  useEffect(() => {
    if (pendingSentRef.current) return
    const prompt = consumePendingPrompt()
    if (prompt) {
      pendingSentRef.current = true
      void handleSendMessage(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeChat = useMemo(() => ({
    id: chatId,
    title,
    messages,
    sandbox,
    eventHistory,
    modelHistory,
    createdAt: '',
    updatedAt: '',
  }), [chatId, title, messages, sandbox, eventHistory, modelHistory])

  const activeChatIsStreaming = isStreaming && streamingChatId === chatId

  return (
    <div className="app h-dvh w-dvw flex overflow-hidden" style={{ background: '#f8f8f7' }}>
      <NavigationRail onOpenSettings={() => setSettingsOpen(true)} onStop={stopStreaming} />
      <section className="flex-1 min-w-0 min-h-0 flex flex-col px-5">
        <ChatWorkspace
          chat={activeChat}
          disabled={!readyToChat}
          isStreaming={activeChatIsStreaming}
          iterationCurrent={iterationCurrent}
          iterationLimit={iterationLimit}
          onSendMessage={handleSendMessage}
          onStop={stopStreaming}
          onOpenSettings={() => setSettingsOpen(true)}
          error={error}
        />
      </section>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
