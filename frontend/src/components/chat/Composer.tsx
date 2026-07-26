import { useState } from 'react'
import type { FormEvent } from 'react'
import { TriangleAlert } from 'lucide-react'

interface ComposerProps {
  disabled?: boolean
  isStreaming: boolean
  iterationCurrent: number
  iterationLimit: number
  readyToChat: boolean
  placeholder: string
  onSubmit: (value: string) => Promise<void>
  onStop: () => void
  onOpenSettings: () => void
}

export function Composer({ disabled, isStreaming, iterationCurrent, iterationLimit, readyToChat, placeholder, onSubmit, onStop, onOpenSettings }: ComposerProps) {
  const [value, setValue] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextValue = value.trim()
    if (!nextValue || disabled || isStreaming) return
    setValue('')
    await onSubmit(nextValue)
  }

  return (
    <div>
      <div className="iteration-row flex items-center justify-between mb-3">
        <div className="iteration-pill inline-flex items-center gap-2 px-[10px] py-[7px] rounded-[12px] bg-[rgba(255,199,0,0.12)] text-[#b78200] border border-[rgba(255,199,0,0.18)] text-xs font-semibold">
          <span className="live-dot w-2 h-2 rounded-full bg-[#ffc700] animate-[pulse_1.4s_infinite_ease-in-out]" />
          Iteration {iterationCurrent}/{iterationLimit}
        </div>
        {isStreaming ? (
          <button className="stop-btn px-3 py-2 rounded-[12px] text-[#ef4444] text-[13px] hover:bg-[rgba(239,68,68,0.08)]" type="button" onClick={onStop}>
            Stop
          </button>
        ) : null}
      </div>

      {!readyToChat ? (
        <div className="warning-banner flex items-center gap-[10px] mb-3 px-[14px] py-3 rounded-[16px] border border-[rgba(249,115,22,0.25)] text-[#f97316] bg-[rgba(249,115,22,0.08)] shadow-sm text-[13px]" data-design-id="api-key-warning">
          <TriangleAlert className="size-[18px] shrink-0" />
          <span>
            Configure API keys in{' '}
            <button className="underline hover:no-underline font-medium" onClick={onOpenSettings}>Settings</button>
            {' '}to start chatting.
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="input-card min-h-[146px] bg-white border border-border rounded-[24px] shadow-md px-[18px] py-4 flex flex-col justify-between">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            className="input-field w-full min-h-[72px] border-0 bg-transparent resize-none outline-none text-[#34322d] text-sm leading-[1.7] placeholder:text-[#858481]"
          />
          <div className="composer-actions flex items-center justify-between gap-3 mt-2">
            <div />
            <button
              type="submit"
              className="send-btn w-[38px] h-[38px] rounded-[12px] bg-[#ffc700] text-[#34322d] shadow-[0_10px_16px_rgba(255,199,0,0.25)] grid place-items-center transition-transform hover:brightness-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disabled || isStreaming || !value.trim()}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" className="size-[18px]"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
