import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessagesSquare, Search, Server, SquarePen, Terminal, Trash2, X } from 'lucide-react'

import { killSandbox } from '@/lib/api'
import { navigate, sessionPath } from '@/lib/router'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/useChatStore'
import type { ChatRecord } from '@/types/chat'

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

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const
type ChatGroup = (typeof GROUP_ORDER)[number]

const DAY_MS = 86_400_000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function getChatGroup(isoDate: string): ChatGroup {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'Older'
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'Previous 7 days'
  return 'Older'
}

function getPreview(chat: ChatRecord): string {
  const lastMessage = chat.messages[chat.messages.length - 1]
  return lastMessage?.content.trim() || 'No messages yet'
}

const CONTEXT_MENU = { width: 190, height: 120 } as const

export function HistorySidebar({ onClose, onStop, hideClose = false }: HistorySidebarProps) {
  const { activeChatId, chats, deleteChat, setActiveChat, isStreaming, streamingChatId } = useChatStore()
  const currentChatId = activeChatId || chats[0]?.id
  const [query, setQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [killingId, setKillingId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const groupedChats = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const visible = (normalizedQuery
      ? chats.filter((chat) =>
          chat.title.toLowerCase().includes(normalizedQuery)
          || getPreview(chat).toLowerCase().includes(normalizedQuery),
        )
      : [...chats]
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    const groups = new Map<ChatGroup, ChatRecord[]>()
    for (const chat of visible) {
      const group = getChatGroup(chat.updatedAt)
      const bucket = groups.get(group)
      if (bucket) bucket.push(chat)
      else groups.set(group, [chat])
    }
    return GROUP_ORDER
      .filter((group) => groups.has(group))
      .map((group) => ({ group, items: groups.get(group) ?? [] }))
  }, [chats, query])

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

  const openContextMenu = useCallback((chatId: string, x: number, y: number) => {
    setContextMenu({
      chatId,
      x: Math.max(8, Math.min(x, window.innerWidth - CONTEXT_MENU.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - CONTEXT_MENU.height - 8)),
    })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, chatId: string) => {
    e.preventDefault()
    openContextMenu(chatId, e.clientX, e.clientY)
  }, [openContextMenu])

  const handleTouchStart = useCallback((e: React.TouchEvent, chatId: string) => {
    const touch = e.touches[0]
    if (!touch) return
    longPressTimer.current = setTimeout(() => {
      openContextMenu(chatId, touch.clientX, touch.clientY)
    }, 500)
  }, [openContextMenu])

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
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold text-[#34322d]">Chats</h2>
          <span className="text-[11px] font-medium text-[#858481]">{chats.length}</span>
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
        {groupedChats.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <div className="grid size-10 place-items-center rounded-[14px] bg-[rgba(255,199,0,0.1)]">
              <MessagesSquare className="size-[18px] text-[#b78200]" />
            </div>
            <p className="text-[13px] font-medium text-[#34322d]">
              {query.trim() ? 'No chats match your search' : 'No chats yet'}
            </p>
            <p className="text-[11px] text-[#858481]">
              {query.trim() ? 'Try a different keyword.' : 'Start a new chat to see it here.'}
            </p>
            {!query.trim() ? (
              <button
                onClick={handleNewChat}
                className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#ffc700] px-3 py-2 text-[12px] font-semibold text-[#34322d] transition-all hover:brightness-[1.03] active:scale-[0.97]"
              >
                <SquarePen className="size-[14px]" />
                New chat
              </button>
            ) : null}
          </div>
        ) : (
          groupedChats.map(({ group, items }, groupIndex) => (
            <section key={group}>
              <h3
                className={cn(
                  'px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#858481]/70',
                  groupIndex === 0 ? 'pt-1' : 'pt-4',
                )}
              >
                {group}
              </h3>
              <div className="space-y-[2px]">
                {items.map((chat) => {
                  const isActive = chat.id === currentChatId
                  const isChatStreaming = isStreaming && streamingChatId === chat.id
                  const sandboxId = chat.sandbox?.sandboxId
                  return (
                    <div
                      key={chat.id}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive || undefined}
                      className={cn(
                        'group relative flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-transparent px-3 py-2.5 transition-colors',
                        isActive
                          ? 'bg-[rgba(255,199,0,0.1)]'
                          : 'hover:bg-[rgba(55,53,47,0.04)]',
                      )}
                      onClick={() => { setActiveChat(chat.id); navigate(sessionPath(chat.id)); onClose() }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveChat(chat.id)
                          navigate(sessionPath(chat.id))
                          onClose()
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, chat.id)}
                      onTouchStart={(e) => handleTouchStart(e, chat.id)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isChatStreaming ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-[#ffc700] animate-[pulse_1.4s_infinite_ease-in-out]" />
                          ) : null}
                          <span className="truncate text-[13px] font-medium text-[#34322d]">
                            {chat.title || 'New chat'}
                          </span>
                        </div>
                        <div className="mt-[3px] truncate text-[11px] leading-[1.45] text-[#858481]">
                          {getPreview(chat)}
                        </div>
                      </div>
                      {sandboxId ? (
                        <span
                          className="shrink-0 text-[#858481]/50"
                          title={`Sandbox: ${sandboxId}`}
                          aria-label={`Sandbox ${sandboxId}`}
                        >
                          <Server className="size-[12px]" />
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="shrink-0 rounded-[8px] p-1.5 text-[#858481] opacity-0 transition-all hover:bg-[rgba(239,68,68,0.08)] hover:text-[#ef4444] group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id) }}
                        aria-label={`Delete ${chat.title || 'chat'}`}
                      >
                        <Trash2 className="size-[14px]" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
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
