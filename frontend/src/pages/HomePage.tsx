import { useMemo, useRef, useState } from 'react'
import { ArrowUp, Menu, Settings, Sparkles, TriangleAlert } from 'lucide-react'

import { HistorySidebar } from '@/components/chat/HistorySidebar'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { setPendingPrompt } from '@/lib/pendingPrompt'
import { navigate, sessionPath } from '@/lib/router'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

export function HomePage() {
  const { createChat } = useChatStore()
  const { novitaApiKey, providerKeys, selectedModel, selectedProvider } = useSettingsStore()
  const [prompt, setPrompt] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const readyToChat = useMemo(
    () => Boolean(providerKeys[selectedProvider] && selectedModel && novitaApiKey),
    [novitaApiKey, providerKeys, selectedModel, selectedProvider],
  )

  const autoResize = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 320)}px`
  }

  const handleSend = () => {
    const value = prompt.trim()
    if (!value || submitting) return
    if (!readyToChat) {
      setSettingsOpen(true)
      return
    }
    setSubmitting(true)
    try {
      const chatId = createChat()
      setPendingPrompt(value)
      navigate(sessionPath(chatId))
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="app h-dvh w-dvw flex flex-col overflow-hidden" style={{ background: '#f8f8f7' }}>
      <div className="flex flex-1 min-h-0">
        <section className="flex flex-col flex-1 min-w-0 h-full min-h-0">
          <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border gap-4 shrink-0">
            <div className="flex items-center gap-[14px] min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-[44px] h-[44px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors shrink-0"
                aria-label="Toggle sidebar"
              >
                <Menu className="size-[20px]" />
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-[10px] min-w-0 text-left"
                aria-label="Curro AI home"
              >
                <div className="w-8 h-8 rounded-[10px] bg-[#ffc700] grid place-items-center text-[#34322d] font-extrabold shadow-[0_10px_20px_rgba(255,199,0,0.26)] shrink-0 text-sm">
                  A
                </div>
                <div className="text-[15px] font-bold text-[#34322d] truncate">
                  Curro AI
                </div>
              </button>
            </div>
            <div className="flex gap-[2px] shrink-0">
              <button
                className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center transition-colors shrink-0 ${!readyToChat ? 'text-[#f97316] animate-[pulse_1.6s_infinite_ease-in-out]' : 'text-[#858481]'} hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]`}
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
              >
                <Settings className="size-[18px]" />
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-start px-4 pt-12 md:pt-20 pb-8">
              <div className="w-full max-w-[680px]">
                <div className="flex flex-col items-center text-center mb-8 animate-[fadeUp_0.25s_ease]">
                  <h1 className="font-display text-[44px] md:text-[58px] leading-[1.2] tracking-tight text-[#34322d]">
                    Hey{' '}
                    <span className="bg-gradient-to-r from-[#a855f7] to-[#f97316] bg-clip-text text-transparent">boss</span>
                  </h1>
                  <p className="mt-4 font-display text-[22px] md:text-[26px] tracking-tight text-[#858481]">
                    What's on your mind today?
                  </p>
                </div>

                <div className="animate-[fadeUp_0.3s_ease]">
                  {!readyToChat ? (
                    <div className="warning-banner flex items-center gap-[10px] mb-3 px-[14px] py-3 rounded-[16px] border border-[rgba(249,115,22,0.25)] text-[#f97316] bg-[rgba(249,115,22,0.08)] shadow-sm text-[13px]">
                      <TriangleAlert className="size-[18px] shrink-0" />
                      <span>
                        Configure API keys in{' '}
                        <button className="underline hover:no-underline font-medium" onClick={() => setSettingsOpen(true)}>Settings</button>
                        {' '}to start chatting.
                      </span>
                    </div>
                  ) : null}

                  <div className="bg-white border border-border rounded-[28px] shadow-md px-5 py-5 md:px-6">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(event) => {
                        setPrompt(event.target.value)
                        autoResize()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Ask Curro to help you build something..."
                      rows={1}
                      className="w-full border-0 bg-transparent resize-none outline-none text-[#34322d] text-base md:text-[17px] leading-[1.7] placeholder:text-[#858481] min-h-[96px]"
                    />
                    <div className="flex items-center justify-between gap-3 mt-3">
                      <div className="text-[12px] text-[#858481]">
                        Enter to send · Shift+Enter for new line
                      </div>
                      <button
                        onClick={handleSend}
                        className="w-[44px] h-[44px] rounded-[14px] bg-[#ffc700] text-[#34322d] shadow-[0_10px_16px_rgba(255,199,0,0.25)] grid place-items-center transition-transform hover:brightness-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!prompt.trim() || submitting}
                        aria-label="Send message"
                      >
                        <ArrowUp className="size-[20px]" strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>

                  <p className="text-center text-[11px] text-[#858481]/80 mt-5 flex items-center justify-center gap-1.5">
                    <Sparkles className="size-3" />
                    Curro AI can make mistakes — verify important work.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-30 transition-[visibility,opacity] duration-150 ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-150" onClick={() => setSidebarOpen(false)} />
        <div
          className="absolute left-0 top-0 bottom-0 w-[320px] bg-white border-r border-border shadow-xl transition-transform duration-150 ease-out"
          style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <HistorySidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
