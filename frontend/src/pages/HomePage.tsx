import { useMemo, useRef, useState } from 'react'
import { ArrowUp, TriangleAlert } from 'lucide-react'

import { SettingsModal } from '@/components/settings/SettingsModal'
import { NavigationRail } from '@/components/sidebar/NavigationRail'
import { setPendingPrompt } from '@/lib/pendingPrompt'
import { navigate, sessionPath } from '@/lib/router'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

export function HomePage() {
  const { createChat } = useChatStore()
  const { novitaApiKey, providerKeys, selectedModel, selectedProvider } = useSettingsStore()
  const [prompt, setPrompt] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
    <div className="app h-dvh w-dvw flex overflow-hidden" style={{ background: '#f8f8f7' }}>
      <NavigationRail onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex flex-1 min-w-0 min-h-0">
        <section className="flex flex-col flex-1 min-w-0 h-full min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-start px-4 pt-20 md:pt-28 pb-8">
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

                </div>
              </div>
            </div>
          </div>
          <footer className="shrink-0 px-4 pb-3 pt-2">
            <p className="text-center text-[11px] text-[#858481]/80">
              Curro AI can make mistakes — verify important work.
            </p>
          </footer>
        </section>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
