import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, Trash2, X, Terminal, Server } from 'lucide-react'

import { killSandbox } from '@/lib/api'
import { navigate, sessionPath } from '@/lib/router'
import { useChatStore } from '@/store/useChatStore'

interface HistorySidebarProps {
  onClose: () => void
  onStop?: () => void
  hideClose?: boolean
}

interface ContextMenuState {
  chatId: string
  x: number
  y: number
}

export function HistorySidebar({ onClose, onStop, hideClose = false }: HistorySidebarProps) {
  const { activeChatId, chats, deleteChat, setActiveChat, isStreaming, streamingChatId } = useChatStore()
  const currentChatId = activeChatId || chats[0]?.id
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [killingId, setKillingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
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

  const handleContextMenu = useCallback((e: React.MouseEvent, chatId: string) => {
    e.preventDefault()
    setContextMenu({ chatId, x: e.clientX, y: e.clientY })
  }, [])

  const handleTouchStart = useCallback((chatId: string) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ chatId, x: 0, y: 0 })
    }, 500)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }, [])

  const handleKillSandbox = useCallback(async (chatId: string) => {
    setKillingId(chatId)
    setContextMenu(null)
    try {
      await killSandbox(chatId)
    } catch {
      // sandbox may already be gone
    } finally {
      setKillingId(null)
    }
  }, [])

  const handleDeleteChat = useCallback((chatId: string) => {
    const remaining = chats.filter((chat) => chat.id !== chatId)
    if (streamingChatId === chatId) {
      onStop?.()
    }
    deleteChat(chatId)
    if (chatId === currentChatId) {
      if (remaining.length > 0) {
        navigate(sessionPath(remaining[0].id))
      } else {
        navigate('/')
      }
    }
  }, [chats, currentChatId, deleteChat, onStop, streamingChatId])

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      onStop?.()
    }
    navigate('/')
    onClose()
  }, [isStreaming, onClose, onStop])

  return (
    <aside className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-[#ffc700] grid place-items-center text-[#34322d] font-extrabold text-sm shadow-[0_10px_20px_rgba(255,199,0,0.26)]">
            A
          </div>
          <h2 className="font-bold text-[15px] text-[#34322d]">Chat History</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-[18px]" />
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chats.map((chat) => {
          const isActive = chat.id === currentChatId
          const hasSandbox = !!chat.sandbox
          return (
            <div
              key={chat.id}
              className={`group flex items-start gap-2 rounded-[14px] border px-3 py-3 transition cursor-pointer ${
                isActive
                  ? 'border-[rgba(255,199,0,0.4)] bg-[rgba(255,199,0,0.1)] text-[#34322d]'
                  : 'border-[#eee] bg-white text-[#858481] hover:border-[#ddd] hover:bg-[rgba(55,53,47,0.02)]'
              }`}
              onClick={() => { setActiveChat(chat.id); navigate(sessionPath(chat.id)); onClose() }}
              onContextMenu={(e) => handleContextMenu(e, chat.id)}
              onTouchStart={() => handleTouchStart(chat.id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[13px]">{chat.title || 'New chat'}</div>
                <div className="mt-1 truncate text-xs text-[#858481]">
                  {chat.messages[chat.messages.length - 1]?.content || 'No messages yet'}
                </div>
                {hasSandbox && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#858481]/60 font-mono truncate">
                    <Server className="size-[10px] shrink-0" />
                    <span className="truncate">{chat.sandbox!.sandboxId}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-[#858481] opacity-0 group-hover:opacity-100 hover:bg-[rgba(55,53,47,0.06)] hover:text-[#ef4444] transition"
                onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id) }}
                aria-label={`Delete ${chat.title}`}
              >
                <Trash2 className="size-[14px]" />
              </button>
            </div>
          )
        })}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] bg-white border border-[#eee] rounded-[12px] shadow-lg py-1"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="px-3 py-2 text-[11px] text-[#858481] font-medium border-b border-[#eee]">
            Chat Actions
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#34322d] hover:bg-[rgba(55,53,47,0.04)] transition disabled:opacity-40"
            disabled={killingId === contextMenu.chatId}
            onClick={(e) => {
              e.stopPropagation()
              handleKillSandbox(contextMenu.chatId)
            }}
          >
            <Terminal className="size-[14px] text-[#858481]" />
            <span>{killingId === contextMenu.chatId ? 'Killing...' : 'Kill Sandbox'}</span>
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#ef4444] hover:bg-[rgba(239,68,68,0.04)] transition"
            onClick={(e) => {
              e.stopPropagation()
              const id = contextMenu.chatId
              setContextMenu(null)
              handleDeleteChat(id)
            }}
          >
            <Trash2 className="size-[14px]" />
            <span>Delete Chat</span>
          </button>
        </div>
      )}
    </aside>
  )
}