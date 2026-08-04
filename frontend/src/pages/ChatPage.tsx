import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { HistorySidebar } from '@/components/chat/HistorySidebar'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { useAgentChat } from '@/hooks/useAgentChat'
import { consumePendingPrompt } from '@/lib/pendingPrompt'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

interface ChatPageProps {
  sessionId: string
}

export function ChatPage({ sessionId }: ChatPageProps) {
  const { sendMessage, stopStreaming } = useAgentChat()
  const { activeChatId, chats, createChatWithId, isStreaming, iterationCurrent, iterationLimit, setActiveChat, streamingChatId } = useChatStore()
  const { novitaApiKey, providerKeys, selectedModel, selectedProvider } = useSettingsStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
    if (!sessionId) return
    const chat = chats.find((item) => item.id === sessionId)
    if (!chat) {
      createChatWithId(sessionId)
      return
    }
    setActiveChat(sessionId)
    if (pendingSentRef.current) return
    const prompt = consumePendingPrompt()
    if (prompt) {
      pendingSentRef.current = true
      void handleSendMessage(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === sessionId) ?? chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats, sessionId],
  )

  const activeChatIsStreaming = isStreaming && streamingChatId === activeChat?.id

  if (!activeChat) return null

  return (
    <div className="app h-dvh w-dvw flex flex-col overflow-hidden" style={{ background: '#f8f8f7' }}>
      <section className="flex-1 min-h-0 flex flex-col px-5">
        <ChatWorkspace
          chat={activeChat}
          disabled={!readyToChat}
          isStreaming={activeChatIsStreaming}
          iterationCurrent={iterationCurrent}
          iterationLimit={iterationLimit}
          onSendMessage={handleSendMessage}
          onStop={stopStreaming}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          error={error}
        />
      </section>

      <div
        className={`fixed inset-0 z-30 transition-[visibility,opacity] duration-150 ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-150" onClick={() => setSidebarOpen(false)} />
        <div
          className="absolute left-0 top-0 bottom-0 w-[320px] bg-white border-r border-border shadow-xl transition-transform duration-150 ease-out"
          style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <HistorySidebar onClose={() => setSidebarOpen(false)} onStop={stopStreaming} />
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
