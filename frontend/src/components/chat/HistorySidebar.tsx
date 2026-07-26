import { MessageSquarePlus, Trash2, X } from 'lucide-react'

import { useChatStore } from '@/store/useChatStore'

interface HistorySidebarProps {
  onClose: () => void
  onStop?: () => void
}

export function HistorySidebar({ onClose, onStop }: HistorySidebarProps) {
  const { activeChatId, chats, createChat, deleteChat, setActiveChat, isStreaming } = useChatStore()
  const currentChatId = activeChatId || chats[0]?.id

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
            onClick={() => {
              if (isStreaming) onStop?.()
              createChat()
            }}
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-[18px]" />
          </button>
          <button
            onClick={onClose}
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chats.map((chat) => {
          const isActive = chat.id === currentChatId
          return (
            <div
              key={chat.id}
              className={`group flex items-start gap-2 rounded-[14px] border px-3 py-3 transition cursor-pointer ${
                isActive
                  ? 'border-[rgba(255,199,0,0.4)] bg-[rgba(255,199,0,0.1)] text-[#34322d]'
                  : 'border-[#eee] bg-white text-[#858481] hover:border-[#ddd] hover:bg-[rgba(55,53,47,0.02)]'
              }`}
              onClick={() => { setActiveChat(chat.id); onClose() }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[13px]">{chat.title || 'New chat'}</div>
                <div className="mt-1 truncate text-xs text-[#858481]">
                  {chat.messages[chat.messages.length - 1]?.content || 'No messages yet'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-[#858481] opacity-0 group-hover:opacity-100 hover:bg-[rgba(55,53,47,0.06)] hover:text-[#ef4444] transition"
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id) }}
                aria-label={`Delete ${chat.title}`}
              >
                <Trash2 className="size-[14px]" />
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
