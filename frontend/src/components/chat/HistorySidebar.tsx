import { useCallback, useEffect, useRef, useState } from 'react'
import { MessagesSquare, Search, SquarePen, Terminal, X } from 'lucide-react'

import { killSandbox } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useChatStore } from '@/store/useChatStore'

interface HistorySidebarProps {
  onClose: () => void
  onStop?: () => void
  hideClose?: boolean
}

interface ContextMenuState {
  x: number
  y: number
}

const CONTEXT_MENU = { width: 190, height: 120 } as const

export function HistorySidebar({ onClose, onStop, hideClose = false }: HistorySidebarProps) {
  const { isStreaming, chatId } = useChatStore()
  const [query, setQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [killingId, setKillingId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - CONTEXT_MENU.height - 8)),
    })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    openContextMenu(e.clientX, e.clientY)
  }, [openContextMenu])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    longPressTimer.current = setTimeout(() => {
      openContextMenu(touch.clientX, touch.clientY)
    }, 500)
  }, [openContextMenu])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }, [])

  const handleKillSandbox = useCallback(async () => {
    setKillingId(chatId)
    setContextMenu(null)
    try {
      await killSandbox(chatId)
    } catch {
      // sandbox may already be gone
    } finally {
      setKillingId(null)
    }
  }, [chatId])

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      onStop?.()
    }
    navigate('/')
    onClose()
  }, [isStreaming, onClose, onStop])

  const handleGoToCurrentChat = useCallback(() => {
    if (isStreaming) {
      return
    }
    navigate('/chat')
    onClose()
  }, [isStreaming, onClose])

  return (
    <aside className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold text-[#34322d]">Chat</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
            aria-label="New chat"
          >
            <SquarePen className="size-[17px]" />
          </button>
          {!hideClose ? (
            <button
              onClick={onClose}
              className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
              aria-label="Close sidebar"
            >
              <X className="size-[18px]" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[14px] -translate-y-1/2 text-[#858481]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full rounded-[12px] border border-border bg-[#f8f8f7] py-2 pl-9 pr-8 text-[13px] text-[#34322d] outline-none transition-colors placeholder:text-[#858481]/70 focus:border-[rgba(255,199,0,0.55)] focus:bg-white"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.06)] hover:text-[#34322d]"
              aria-label="Clear search"
            >
              <X className="size-[13px]" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="grid size-10 place-items-center rounded-[14px] bg-[rgba(255,199,0,0.1)]">
            <MessagesSquare className="size-[18px] text-[#b78200]" />
          </div>
          <p className="text-[13px] font-medium text-[#34322d]">
            {query.trim() ? 'No chats match your search' : 'Current session'}
          </p>
          <p className="text-[11px] text-[#858481]">
            {query.trim() ? 'Try a different keyword.' : 'Chat history is not persisted.'}
          </p>

          <div className="mt-2 space-y-[2px] w-full">
            <div
              role="button"
              tabIndex={0}
              className="relative flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-transparent px-3 py-2.5 transition-colors bg-[rgba(255,199,0,0.1)]"
              onClick={handleGoToCurrentChat}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleGoToCurrentChat()
                }
              }}
              onContextMenu={handleContextMenu}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {isStreaming ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-[#ffc700] animate-[pulse_1.4s_infinite_ease-in-out]" />
                  ) : null}
                  <span className="truncate text-[13px] font-medium text-[#34322d]">
                    Active session
                  </span>
                </div>
                <div className="mt-[3px] truncate text-[11px] leading-[1.45] text-[#858481]">
                  Ephemeral — cleared on refresh
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#ffc700] px-3 py-2 text-[12px] font-semibold text-[#34322d] transition-all hover:brightness-[1.03] active:scale-[0.97]"
          >
            <SquarePen className="size-[14px]" />
            New chat
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-white border border-[#eee] rounded-[12px] shadow-lg py-1"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-3 py-2 text-[11px] text-[#858481] font-medium border-b border-[#eee]">
            Session Actions
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#34322d] hover:bg-[rgba(55,53,47,0.04)] transition disabled:opacity-40"
            disabled={killingId === chatId}
            onClick={(e) => {
              e.stopPropagation()
              handleKillSandbox()
            }}
          >
            <Terminal className="size-[14px] text-[#858481]" />
            <span>{killingId === chatId ? 'Killing...' : 'Kill Sandbox'}</span>
          </button>
        </div>
      )}
    </aside>
  )
}
