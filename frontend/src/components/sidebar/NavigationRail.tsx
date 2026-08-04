import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MessagesSquare, Settings, SquarePen } from 'lucide-react'

import { HistorySidebar } from '@/components/chat/HistorySidebar'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'

const isApplePlatform =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)

const SHORTCUTS = {
  toggleChats: isApplePlatform ? '⌘B' : 'Ctrl+B',
  newChat: isApplePlatform ? '⇧⌘O' : 'Ctrl+Shift+O',
} as const

interface RailItemProps {
  icon: ReactNode
  label: string
  shortcut?: string
  /** VS Code style active state: accent indicator + quiet tint. */
  active?: boolean
  /** Live activity dot shown while an agent run is in progress. */
  badge?: boolean
  /** Attention dot nudging the user to finish setup. */
  attention?: boolean
  onClick: () => void
}

function RailItem({ icon, label, shortcut, active = false, badge = false, attention = false, onClick }: RailItemProps) {
  return (
    <div className="group relative flex w-full justify-center py-[2px]">
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#ffc700] transition-all duration-150',
          active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
        )}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active || undefined}
        className={cn(
          'relative grid h-11 w-11 place-items-center rounded-[12px] transition-[background-color,color,scale] duration-150 active:scale-[0.92]',
          active
            ? 'bg-[rgba(255,199,0,0.14)] text-[#34322d]'
            : 'text-[#858481] hover:bg-[rgba(55,53,47,0.05)] hover:text-[#34322d]',
        )}
      >
        {icon}
        {badge ? (
          <span
            aria-hidden
            className="absolute right-[9px] top-[9px] size-2 rounded-full bg-[#ffc700] ring-2 ring-white animate-[pulse_1.4s_infinite_ease-in-out]"
          />
        ) : null}
        {attention ? (
          <span
            aria-hidden
            className="absolute right-[9px] top-[9px] size-2 rounded-full bg-[#f97316] ring-2 ring-white animate-[pulse_1.6s_infinite_ease-in-out]"
          />
        ) : null}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-x-1 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-[10px] border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#34322d] opacity-0 shadow-[0_8px_24px_rgba(52,50,45,0.08)] transition-all duration-150 md:flex md:group-hover:translate-x-0 md:group-hover:opacity-100"
      >
        {label}
        {shortcut ? (
          <kbd className="rounded-[6px] border border-border bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#858481]">
            {shortcut}
          </kbd>
        ) : null}
      </span>
    </div>
  )
}

interface NavigationRailProps {
  onOpenSettings: () => void
  /** Abort the active agent run. Used before starting a new chat. */
  onStop?: () => void
}

/**
 * NavigationRail — a slim, always-visible icon rail inspired by the VS Code
 * activity bar, Cursor, and the collapsed ChatGPT sidebar. It hosts the
 * global actions (home, new chat, chat history, settings) and renders the
 * chat history as a flyout panel next to the rail, so the rail itself stays
 * visible and interactive at all times.
 *
 * Layout contract: the rail is exactly `w-16` (4rem) wide; the flyout panel
 * and its backdrop are offset by `left-16` to sit flush against the rail.
 */
export function NavigationRail({ onOpenSettings, onStop }: NavigationRailProps) {
  const [chatsOpen, setChatsOpen] = useState(false)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const readyToChat = useSettingsStore((state) =>
    Boolean(state.providerKeys[state.selectedProvider] && state.selectedModel && state.novitaApiKey),
  )

  const closeChats = useCallback(() => setChatsOpen(false), [])
  const toggleChats = useCallback(() => setChatsOpen((open) => !open), [])

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      onStop?.()
    }
    setChatsOpen(false)
    navigate('/')
  }, [isStreaming, onStop])

  const handleGoHome = useCallback(() => {
    setChatsOpen(false)
    navigate('/')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === 'Escape') {
        setChatsOpen(false)
        return
      }
      const mod = event.metaKey || event.ctrlKey
      if (!mod || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'b' && !event.shiftKey) {
        event.preventDefault()
        setChatsOpen((open) => !open)
      } else if (key === 'o' && event.shiftKey) {
        event.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  return (
    <>
      <nav
        aria-label="Primary"
        className="relative z-40 flex h-full w-16 shrink-0 select-none flex-col items-center border-r border-border bg-white"
      >
        <div className="group relative flex w-full justify-center pb-1 pt-3">
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="Curro AI — Home"
            className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#ffc700] text-sm font-extrabold text-[#34322d] transition-[filter,scale] duration-150 hover:brightness-[0.97] active:scale-[0.94]"
          >
            A
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-x-1 -translate-y-1/2 items-center whitespace-nowrap rounded-[10px] border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#34322d] opacity-0 shadow-[0_8px_24px_rgba(52,50,45,0.08)] transition-all duration-150 md:flex md:group-hover:translate-x-0 md:group-hover:opacity-100"
          >
            Curro AI — Home
          </span>
        </div>

        <div className="flex w-full flex-1 flex-col items-center pt-1">
          <RailItem
            icon={<SquarePen className="size-[20px]" />}
            label="New chat"
            shortcut={SHORTCUTS.newChat}
            onClick={handleNewChat}
          />
          <RailItem
            icon={<MessagesSquare className="size-[20px]" />}
            label="Chats"
            shortcut={SHORTCUTS.toggleChats}
            active={chatsOpen}
            badge={isStreaming}
            onClick={toggleChats}
          />
        </div>

        <div className="flex w-full flex-col items-center pb-3">
          <RailItem
            icon={<Settings className="size-[20px]" />}
            label="Settings"
            attention={!readyToChat}
            onClick={onOpenSettings}
          />
        </div>
      </nav>

      {/* Chat history flyout (anchored right of the rail) */}
      <div
        className={cn(
          'pointer-events-none fixed inset-0 z-30 transition-[visibility] duration-300',
          chatsOpen ? 'visible' : 'invisible',
        )}
      >
        <div
          aria-hidden
          className={cn(
            'pointer-events-auto absolute inset-y-0 left-16 right-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
            chatsOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeChats}
        />
        <div
          className={cn(
            'pointer-events-auto absolute bottom-0 left-16 top-0 w-[min(320px,calc(100dvw-4rem))] border-r border-border bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            chatsOpen ? 'translate-x-0' : '-translate-x-[102%]',
          )}
        >
          <HistorySidebar onClose={closeChats} onStop={onStop} />
        </div>
      </div>
    </>
  )
}
