import { useEffect, useMemo, useState } from 'react'

import { ChatWorkspace } from '@/components/chat/ChatWorkspace'
import { HistorySidebar } from '@/components/chat/HistorySidebar'
import { FileExplorer } from '@/components/files/FileExplorer'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

function App() {
  const { sendMessage, stopStreaming } = useAgentChat()
  const { activeChatId, chats, createChat, isStreaming, iterationCurrent, iterationLimit, setActiveChat } = useChatStore()
  const { novitaApiKey, providerKeys, selectedModel, selectedProvider } = useSettingsStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState('')
  const [mobileTab, setMobileTab] = useState<'chat' | 'files'>('chat')

  useEffect(() => {
    if (!chats.length) {
      const id = createChat()
      setActiveChat(id)
      return
    }
    if (!activeChatId) {
      setActiveChat(chats[0].id)
    }
  }, [activeChatId, chats, createChat, setActiveChat])

  const activeChat = useMemo(() => chats.find((chat) => chat.id === (activeChatId || chats[0]?.id)) ?? chats[0], [activeChatId, chats])
  const readyToChat = Boolean(providerKeys[selectedProvider] && selectedModel && novitaApiKey)

  if (!activeChat) return null

  const handleSendMessage = async (value: string) => {
    try {
      setError('')
      await sendMessage(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="app h-dvh w-dvw flex flex-col overflow-hidden" style={{ background: 'radial-gradient(circle at top left, rgba(255, 199, 0, 0.16), transparent 22%), linear-gradient(180deg, #fbfbfa 0%, #f8f8f7 100%)' }}>
      <div className="hidden md:grid md:grid-cols-[minmax(360px,40%)_1fr] flex-1 min-h-0">
        <section className="flex flex-col h-full min-h-0 px-5">
          <ChatWorkspace
            chat={activeChat}
            disabled={!readyToChat}
            isStreaming={isStreaming}
            iterationCurrent={iterationCurrent}
            iterationLimit={iterationLimit}
            onSendMessage={handleSendMessage}
            onStop={stopStreaming}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            error={error}
          />
        </section>
        <section className="flex flex-col h-full min-h-0 p-3 pr-5">
          <FileExplorer chat={activeChat} />
        </section>
      </div>

      <div className="flex md:hidden flex-1 min-h-0 flex-col">
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className={`absolute inset-0 flex flex-col min-h-0 ${mobileTab === 'chat' ? 'flex' : 'hidden'}`}>
            <ChatWorkspace
              chat={activeChat}
              disabled={!readyToChat}
              isStreaming={isStreaming}
              iterationCurrent={iterationCurrent}
              iterationLimit={iterationLimit}
              onSendMessage={handleSendMessage}
              onStop={stopStreaming}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
              error={error}
            />
          </div>
          <div className={`absolute inset-0 flex-col min-h-0 ${mobileTab === 'files' ? 'flex' : 'hidden'}`}>
            <div className="flex-1 min-h-0 p-3 flex flex-col">
              <FileExplorer chat={activeChat} />
            </div>
          </div>
        </div>
        <nav className="h-[62px] border-t border-border bg-white/98 flex shadow-[0_-4px_16px_rgba(52,50,45,0.05)] shrink-0">
          <button
            className={`flex-1 flex flex-col items-center justify-center gap-[6px] text-[11px] transition-colors ${mobileTab === 'chat' ? 'text-[#9a6a00] bg-[rgba(255,199,0,0.12)]' : 'text-[#858481]'}`}
            onClick={() => setMobileTab('chat')}
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M7 10h10M7 14h7"/><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V4a2 2 0 0 1 2-2h8a8 8 0 0 1 8 8Z"/></svg>
            <span>Chat</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center justify-center gap-[6px] text-[11px] transition-colors ${mobileTab === 'files' ? 'text-[#9a6a00] bg-[rgba(255,199,0,0.12)]' : 'text-[#858481]'}`}
            onClick={() => setMobileTab('files')}
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
            <span>Files</span>
          </button>
        </nav>
      </div>

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

export default App
