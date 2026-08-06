import { useState, useId } from 'react'
import { Bot, BrainCircuit, ChevronRight, Eye, FolderOpen, Settings, Terminal, X } from 'lucide-react'

import { Composer } from '@/components/chat/Composer'
import { useChatStore } from '@/store/useChatStore'
import type { ChatRecord, SubAgentStream, ToolChip } from '@/types/chat'

interface ChatWorkspaceProps {
  chat: ChatRecord
  disabled: boolean
  isStreaming: boolean
  iterationCurrent: number
  iterationLimit: number
  onSendMessage: (value: string) => Promise<void>
  onStop: () => void
  onOpenSettings: () => void
  error?: string
}

function TerminalOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const commandData = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const stdout = commandData?.stdout as string | undefined
  const stderr = commandData?.stderr as string | undefined
  const exitCode = commandData?.exit_code as number | undefined
  const status = commandData?.status as string | undefined
  const pid = commandData?.pid as number | undefined
  const message = commandData?.message as string | undefined
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...'
    : status === 'started' ? 'started'
    : exitCode === 0 ? 'done'
    : exitCode !== undefined ? `exit ${exitCode}`
    : 'done'

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <Terminal className="size-[14px] shrink-0 text-[#858481]" />
        <span className="flex-1 truncate font-mono text-[13px]">
          {chip.label}
          {chip.sessionName ? <span className="ml-2 text-[11px] text-[#858481]">[{chip.sessionName}]</span> : null}
        </span>
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : status === 'started' ? 'text-[#f97316]' : exitCode === 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border p-4 font-mono text-[13px] leading-relaxed bg-[#f5f5f5]">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481]">
            <Terminal className="size-3" />
            <span>$ {chip.command || 'command'}</span>
            {chip.sessionName ? <span className="ml-auto text-[#858481]/60">session: {chip.sessionName}</span> : null}
          </div>
          {chip.ok !== undefined ? (
            <div className="space-y-1">
              {stdout ? <pre className="whitespace-pre-wrap text-[#059669]">{stdout}</pre> : null}
              {stderr ? <pre className="whitespace-pre-wrap text-[#dc2626]/80">{stderr}</pre> : null}
              {message ? <div className="text-[#34322d]/70">{message}</div> : null}
              {pid !== undefined ? <div className="text-[11px] text-[#858481]">PID: {pid}</div> : null}
              {exitCode !== undefined ? (
                <div className={`pt-1 text-[11px] ${exitCode === 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  Exit code: {exitCode}
                </div>
              ) : null}
            </div>
          ) : isRunning ? (
            <div className="flex items-center gap-2 text-[#858481]">
              <span className="inline-block size-2 animate-pulse rounded-full bg-[#ffc700]" />
              Running...
            </div>
          ) : (
            <div className="text-[#858481]">No output</div>
          )}
        </div>
      )}
    </div>
  )
}

function ListFilesOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const items = data?.items as Array<{ name: string; type: string; path: string; size?: number | null }> | undefined
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <FolderOpen className="size-[14px] shrink-0 text-[#858481]" />
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
        </span>
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border p-4 font-mono text-[13px] leading-relaxed bg-[#f5f5f5]">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481]">
            <FolderOpen className="size-3" />
            <span>{chip.path || 'directory'}</span>
          </div>
          {items ? (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.path} className="flex items-center gap-2 text-[13px]">
                  <span className={`shrink-0 ${item.type === 'dir' ? 'text-[#f59e0b]' : 'text-[#858481]'}`}>
                    {item.type === 'dir' ? '📁' : '📄'}
                  </span>
                  <span className="text-[#34322d]">{item.name}</span>
                  {item.type === 'file' && item.size != null ? (
                    <span className="ml-auto text-[11px] text-[#858481]">{item.size} B</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : chip.ok === false ? (
            <div className="text-[#ef4444]">Failed to list directory</div>
          ) : (
            <div className="text-[#858481]">No files found</div>
          )}
        </div>
      )}
    </div>
  )
}

function WebSearchOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const results = data?.results as Array<{ title: string; url: string; Description: string }> | undefined
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <svg viewBox="0 0 24 24" className="size-[14px] shrink-0 text-[#858481]" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
          {chip.query ? <span className="ml-2 text-[11px] text-[#858481]">"{chip.query}"</span> : null}
        </span>
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
        {results && results.length > 0 ? <span className="shrink-0 text-[10px] text-[#858481] ml-2">{results.length} results</span> : null}
      </button>
      {isOpen && results && results.length > 0 ? (
        <div className="border-t border-border p-3 space-y-2 bg-[#f5f5f5]">
          {results.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-[12px] bg-white border border-border p-3 hover:shadow-sm transition-shadow">
              <div className="text-[13px] font-semibold text-[#34322d] mb-1">{r.title}</div>
              <div className="text-[11px] text-[#858481] mb-1 line-clamp-2">{r.Description}</div>
              <div className="text-[10px] text-[#3b82f6] truncate">{r.url}</div>
            </a>
          ))}
        </div>
      ) : isOpen && chip.ok === false ? (
        <div className="border-t border-border p-4 text-[#ef4444] text-[13px] bg-[#f5f5f5]">Search failed</div>
      ) : null}
    </div>
  )
}

function FetchWebOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const content = data?.content as string | undefined
  const url = data?.url as string | undefined
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'
  const displayContent = content ? (content.length > 4000 ? content.slice(0, 4000) + '...' : content) : ''

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <svg viewBox="0 0 24 24" className="size-[14px] shrink-0 text-[#858481]" strokeWidth={1.8}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
          {url ? <span className="ml-2 text-[11px] text-[#858481] font-mono truncate">{url}</span> : null}
        </span>
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && displayContent ? (
        <div className="border-t border-border p-4 font-mono text-[12px] leading-relaxed bg-[#f5f5f5] max-h-[400px] overflow-auto">
          <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-wider text-[#858481]">
            <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Fetched content</span>
            {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[#3b82f6] underline truncate max-w-[200px]">{url}</a> : null}
          </div>
          <pre className="whitespace-pre-wrap text-[#34322d]">{displayContent}</pre>
        </div>
      ) : isOpen && chip.ok === false ? (
        <div className="border-t border-border p-4 text-[#ef4444] text-[13px] bg-[#f5f5f5]">Fetch failed</div>
      ) : null}
    </div>
  )
}

function ShellViewOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const sessions = data?.sessions as Array<{ session_name: string; status: string; output: string }> | undefined
  const isRunning = chip.ok === undefined
  const hasRunning = sessions?.some((s) => s.status === 'running') ?? false

  const statusLabel = isRunning || hasRunning ? 'running...' : 'done'

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <Eye className="size-[14px] shrink-0 text-[#858481]" />
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
        </span>
        <span className={`shrink-0 text-[11px] ${(isRunning || hasRunning) ? 'animate-pulse text-[#858481]' : 'text-[#22c55e]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border p-4 font-mono text-[13px] leading-relaxed bg-[#f5f5f5]">
          {sessions && sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.session_name}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-[#858481]">
                    <Eye className="size-3" />
                    <span className="font-semibold">{session.session_name}</span>
                    <span className={`ml-auto ${session.status === 'running' ? 'text-[#f97316]' : 'text-[#22c55e]'}`}>
                      {session.status}
                    </span>
                  </div>
                  {session.output ? (
                    <pre className="whitespace-pre-wrap text-[#34322d] bg-white rounded-lg p-3 border border-border text-[12px]">{session.output}</pre>
                  ) : (
                    <div className="text-[#858481] text-[12px]">No output yet</div>
                  )}
                </div>
              ))}
            </div>
          ) : chip.ok === false ? (
            <div className="text-[#ef4444]">Failed to view shell output</div>
          ) : (
            <div className="text-[#858481]">Awaiting output...</div>
          )}
        </div>
      )}
    </div>
  )
}

function ApplyPatchOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const operationsRaw = data?.operations as Array<Record<string, unknown>> | undefined
  const totalOps = data?.total_operations as number | undefined
  const succeeded = data?.succeeded as number | undefined
  const failed = data?.failed as number | undefined
  const patchInput = chip.input
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'

  // Compute rich context from operations
  const opTypeCounts: Record<string, number> = {}
  let totalAddedLines = 0
  let totalRemovedLines = 0
  const fileNames: string[] = []
  if (operationsRaw) {
    for (const rawOp of operationsRaw) {
      const opType = rawOp.operation as string
      opTypeCounts[opType] = (opTypeCounts[opType] || 0) + 1
      const fp = rawOp.file_path as string | undefined
      if (fp) {
        const name = fp.split('/').pop()
        if (name && !fileNames.includes(name)) fileNames.push(name)
      }
      const hunks = rawOp.applied_hunks as Array<Record<string, unknown>> | undefined
      if (hunks) {
        for (const h of hunks) {
          totalAddedLines += (h.added_lines as number) || 0
          totalRemovedLines += (h.removed_lines as number) || 0
        }
      }
    }
  }
  const contextParts: string[] = []
  if (opTypeCounts.add) contextParts.push(`+${opTypeCounts.add} add`)
  if (opTypeCounts.update) contextParts.push(`~${opTypeCounts.update} edit`)
  if (opTypeCounts.delete) contextParts.push(`-${opTypeCounts.delete} del`)
  const opsSummary = contextParts.join(', ')

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <svg viewBox="0 0 24 24" className="size-[14px] shrink-0 text-[#858481]" strokeWidth={1.8} fill="none" stroke="currentColor">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
        </span>
        {/* Rich context badges */}
        {opsSummary ? (
          <span className="shrink-0 text-[10px] text-[#858481] font-mono hidden sm:inline">{opsSummary}</span>
        ) : totalOps !== undefined ? (
          <span className="shrink-0 text-[10px] text-[#858481]">{totalOps} op{totalOps !== 1 ? 's' : ''}</span>
        ) : null}
        {fileNames.length > 0 && (
          <span className="shrink-0 text-[10px] text-[#858481]/70 font-mono hidden md:inline max-w-[120px] truncate" title={fileNames.join(', ')}>
            {fileNames.join(', ')}
          </span>
        )}
        {(totalAddedLines > 0 || totalRemovedLines > 0) && (
          <span className="shrink-0 text-[10px] font-mono">
            <span className="text-[#059669]">+{totalAddedLines}</span>
            <span className="text-[#dc2626] ml-0.5">-{totalRemovedLines}</span>
          </span>
        )}
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border bg-[#f5f5f5]">
          {/* --- Raw LLM Patch Input (always visible when expanded) --- */}
          {patchInput ? (
            <div className="border-b border-border">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-[10px] uppercase tracking-wider text-[#858481] font-semibold">
                <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8} fill="none" stroke="currentColor">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span>LLM Patch Input</span>
                <span className="ml-auto text-[9px] font-mono text-[#858481]/60">{patchInput.split('\n').length} lines</span>
              </div>
              <pre className="mx-4 mb-4 whitespace-pre-wrap bg-[#1e1e1e] rounded-[12px] p-4 text-[12px] leading-[1.6] max-h-[400px] overflow-auto shadow-inner">
                <code className="text-[#d4d4d4]">
                  {patchInput.split('\n').map((line, i) => {
                    let lineClass = 'text-[#d4d4d4]'
                    if (line.startsWith('*** Begin Patch') || line.startsWith('*** End Patch')) {
                      lineClass = 'text-[#569cd6] font-bold' // blue for markers
                    } else if (line.startsWith('*** Add File:') || line.startsWith('*** Delete File:') || line.startsWith('*** Update File:') || line.startsWith('*** Move to:')) {
                      lineClass = 'text-[#c586c0] font-semibold' // purple for file ops
                    } else if (line.startsWith('@@')) {
                      lineClass = 'text-[#dcdcaa]' // yellow for hunk headers
                    } else if (line.startsWith('+')) {
                      lineClass = 'text-[#4ec9b0]' // green for additions
                    } else if (line.startsWith('-')) {
                      lineClass = 'text-[#f44747]' // red for removals
                    } else if (line.startsWith(' ')) {
                      lineClass = 'text-[#9cdcfe]/60' // dim for context
                    }
                    return (
                      <div key={i} className={lineClass}>
                        {line || <span className="select-none">&nbsp;</span>}
                      </div>
                    )
                  })}
                </code>
              </pre>
            </div>
          ) : null}

          {/* --- Operations Results --- */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481] font-semibold">
              <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8} fill="none" stroke="currentColor">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>Results</span>
              {succeeded !== undefined ? (
                <span className="ml-auto font-mono text-[9px] text-[#858481]/60">
                  <span className="text-[#059669]">{succeeded} ok</span>
                  {failed != null && failed > 0 ? <span className="ml-2 text-[#ef4444]">{failed} failed</span> : null}
                </span>
              ) : null}
            </div>
            {operationsRaw && operationsRaw.length > 0 ? (
              <div className="space-y-2">
                {operationsRaw.map((rawOp, i) => {
                  const opOk = rawOp.ok as boolean
                  const opOperation = rawOp.operation as string
                  const opFilePath = rawOp.file_path as string | undefined
                  const opMoveTo = rawOp.move_to as string | undefined
                  const opError = rawOp.error as string | undefined
                  const appliedHunks = rawOp.applied_hunks as Array<Record<string, unknown>> | undefined
                  const totalChanges = rawOp.total_changes as number | undefined
                  const hunkCount = appliedHunks?.length ?? 0
                  const addedLines = appliedHunks?.reduce((sum: number, h: Record<string, unknown>) => sum + ((h.added_lines as number) || 0), 0) ?? 0
                  const removedLines = appliedHunks?.reduce((sum: number, h: Record<string, unknown>) => sum + ((h.removed_lines as number) || 0), 0) ?? 0

                  return (
                    <div key={i} className="rounded-[12px] bg-white border border-border p-3 text-[12px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`shrink-0 size-[18px] rounded-full grid place-items-center text-[10px] font-bold ${opOk ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#ef4444]'}`}>
                          {opOk ? '✓' : '✗'}
                        </span>
                        <span className="font-semibold text-[#34322d]">{opOperation}</span>
                        <span className="text-[#858481] truncate font-mono text-[11px]">{opFilePath}</span>
                        {opMoveTo ? (
                          <span className="text-[#858481] text-[10px] ml-auto">→ {opMoveTo}</span>
                        ) : null}
                      </div>
                      {!opOk && opError ? (
                        <div className="text-[#ef4444] text-[11px] mt-1 ml-[26px]">{opError}</div>
                      ) : null}
                      {hunkCount > 0 ? (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-[#858481] ml-[26px]">
                          <span>{totalChanges ?? hunkCount} change{((totalChanges ?? hunkCount) !== 1) ? 's' : ''} applied</span>
                          <span className="text-[#059669]">+{addedLines}</span>
                          <span className="text-[#dc2626]">-{removedLines}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : succeeded !== undefined ? (
              <div className="text-[11px] text-[#858481] italic">No individual operation details available.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function FileWriteOutput({ chip }: { chip: ToolChip }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const lineCount = data?.line_count as number | undefined
  const fileName = chip.filePath ? chip.filePath.split('/').pop() : 'file'
  const isRunning = chip.ok === undefined

  return (
    <div className="flex items-center gap-[5px] py-[6px]">
      {/* File Icon */}
      <svg 
        className="size-[14px] shrink-0 text-[#858481]" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M12 11v6"/>
        <path d="M9 14h6"/>
      </svg>

      {/* Action Text */}
      <span className="text-[13px] font-medium text-[#858481]">
        Create
      </span>

      {/* Filename Badge - Slimmer */}
      <span className="inline-flex items-center px-[8px] py-[2px] bg-[#f9fafb] border border-[#e5e7eb] rounded-[6px] text-[#6b7280] text-[13px] font-mono">
        {fileName}
      </span>

      {/* Green Diff Indicator */}
      {!isRunning && chip.ok && lineCount !== undefined && (
        <span className="text-[#16a34a] text-[13px] font-semibold">
          +{lineCount}
        </span>
      )}

      {/* Status indicators for running/error states */}
      {isRunning && (
        <span className="text-[11px] text-[#858481] animate-pulse ml-1">
          writing...
        </span>
      )}
      {!isRunning && chip.ok === false && (
        <span className="text-[11px] text-[#ef4444] ml-1">
          failed
        </span>
      )}
    </div>
  )
}

function FileReadOutput({ chip }: { chip: ToolChip }) {
  const fileName = chip.filePath ? chip.filePath.split('/').pop() : 'file'
  const isRunning = chip.ok === undefined

  return (
    <div className="flex items-center gap-[5px] py-[6px]">
      {/* File Icon */}
      <svg 
        className="size-[14px] shrink-0 text-[#858481]" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>

      {/* Action Text */}
      <span className="text-[13px] font-medium text-[#858481]">
        Read
      </span>

      {/* Filename Badge - Slimmer */}
      <span className="inline-flex items-center px-[8px] py-[2px] bg-[#f9fafb] border border-[#e5e7eb] rounded-[6px] text-[#6b7280] text-[13px] font-mono">
        {fileName}
      </span>

      {/* Status indicators for running/error states */}
      {isRunning && (
        <span className="text-[11px] text-[#858481] animate-pulse ml-1">
          reading...
        </span>
      )}
      {!isRunning && chip.ok === false && (
        <span className="text-[11px] text-[#ef4444] ml-1">
          failed
        </span>
      )}
    </div>
  )
}

function StrReplaceOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const resultData = chip.resultData
  const data = (resultData?.data as Record<string, unknown> | undefined) ?? resultData
  const oldString = chip.oldString ?? (data?.old_string as string | undefined)
  const newString = chip.newString ?? (data?.new_string as string | undefined)
  const occurrences = data?.occurrences as number | undefined
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
      >
        <svg viewBox="0 0 24 24" className="size-[14px] shrink-0 text-[#858481]" strokeWidth={1.8} fill="none" stroke="currentColor">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span className="flex-1 truncate text-[13px]">
          {chip.label}
        </span>
        <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {statusLabel}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-border p-4 font-mono text-[13px] leading-relaxed bg-[#f5f5f5] space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481]">
              <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8} fill="none" stroke="currentColor">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Old string</span>
            </div>
            <pre className="whitespace-pre-wrap text-[#dc2626] bg-white rounded-lg p-3 border border-border text-[12px] max-h-[200px] overflow-auto">{oldString ?? ''}</pre>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481]">
              <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8} fill="none" stroke="currentColor">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>New string</span>
            </div>
            <pre className={`whitespace-pre-wrap bg-white rounded-lg p-3 border border-border text-[12px] max-h-[200px] overflow-auto ${newString ? 'text-[#059669]' : 'text-[#858481]'}`}>{newString || '(empty)'}</pre>
          </div>
          {occurrences !== undefined ? (
            <div className="text-[11px] text-[#858481]">
              {occurrences} occurrence{occurrences !== 1 ? 's' : ''} replaced
            </div>
          ) : null}
          {chip.ok === false ? (
            <div className="text-[#ef4444] text-[12px]">Edit failed</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SubAgentOutput({ chip, isOpen, onToggle }: { chip: ToolChip; isOpen: boolean; onToggle: () => void }) {
  const subAgentStreams = useChatStore((state) => state.subAgentStreams)
  const session = chip.sessionName || 'default'
  const stream: SubAgentStream | undefined = subAgentStreams[session]
  const isRunning = chip.ok === undefined

  const statusLabel = isRunning ? 'running...' : chip.ok ? 'done' : 'error'

  function renderToolChip(subChip: ToolChip) {
    if (subChip.name === 'shall_tool') {
      return <TerminalOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'shell_view') {
      return <ShellViewOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'list_files') {
      return <ListFilesOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'web_search') {
      return <WebSearchOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'fatch_web_urls') {
      return <FetchWebOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'str_replace') {
      return <StrReplaceOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    if (subChip.name === 'apply_patch') {
      return <ApplyPatchOutput chip={subChip} isOpen={false} onToggle={() => {}} />
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-border text-xs text-[#858481] shadow-sm">
        <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        {subChip.label}
      </span>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
        <button
          onClick={onToggle}
          className={`flex w-full items-center gap-2 px-4 py-3 text-left text-xs transition-colors hover:bg-[rgba(55,53,47,0.04)] ${chip.ok === false ? 'text-[#ef4444]' : 'text-[#34322d]'}`}
        >
          <Bot className="size-[14px] shrink-0 text-[#a855f7]" />
          <span className="flex-1 truncate text-[13px]">
            {stream ? stream.agent : 'Sub-Agent'}
            <span className="ml-2 text-[11px] text-[#858481]">[{session}]</span>
          </span>
          <span className={`shrink-0 text-[11px] ${isRunning ? 'animate-pulse text-[#858481]' : chip.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {statusLabel}
          </span>
        </button>
      </div>

      {isOpen && stream && (
        <div className="fixed inset-0 z-50" onClick={onToggle}>
          <div className="absolute inset-0 bg-[rgba(17,17,17,0.55)] backdrop-blur-[8px]" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(680px,calc(100dvw-24px))] max-h-[calc(100dvh-40px)] overflow-auto bg-white border border-border rounded-[22px] shadow-[0_32px_80px_rgba(17,17,17,0.25)] z-[1] animate-[fadeUp_0.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-border rounded-t-[22px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[rgba(168,85,247,0.12)] grid place-items-center">
                  <Bot className="size-[16px] text-[#a855f7]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#34322d]">{stream.agent}</div>
                  <div className="text-[10px] text-[#858481] font-mono">session: {stream.session}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-1 rounded-full ${stream.status === 'running' ? 'bg-[#fef3c7] text-[#b45309] animate-pulse' : stream.status === 'done' ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#ef4444]'}`}>
                  {stream.status}
                </span>
                <button type="button" onClick={onToggle} className="p-1.5 rounded-[8px] hover:bg-[rgba(55,53,47,0.04)] text-[#858481]">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {stream.reasoning && (
                <div className="rounded-[14px] bg-[#faf5ff] border border-[#e8d5f5] p-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#7c3aed] font-semibold mb-2">
                    <BrainCircuit className="size-3" />
                    <span>Reasoning</span>
                  </div>
                  <div className="text-[13px] leading-relaxed text-[#6b21a8] italic whitespace-pre-wrap">{stream.reasoning}</div>
                </div>
              )}

              <div className="rounded-[14px] bg-[#f5f5f5] border border-border p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481] font-semibold mb-2">
                  <Bot className="size-3" />
                  <span>Output</span>
                </div>
                <div className="text-[13px] leading-relaxed text-[#34322d] whitespace-pre-wrap font-[15px]">
                  {stream.content || (stream.status === 'running' ? (
                    <span className="text-[#858481] italic">Waiting for sub-agent response...</span>
                  ) : (
                    <span className="text-[#858481] italic">No output</span>
                  ))}
                  {stream.status === 'running' && stream.content ? <span className="inline-block size-1.5 bg-[#a855f7] rounded-full ml-1 animate-pulse" /> : null}
                </div>
              </div>

              {stream.toolChips.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#858481] font-semibold mb-2">
                    <svg viewBox="0 0 24 24" className="size-3" strokeWidth={1.8}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>Tool Calls</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stream.toolChips.map((subChip) => (
                      <div key={subChip.id}>
                        {renderToolChip(subChip)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ReasoningBlock({
  reasoning,
  isStreaming = false,
}: {
  reasoning: string
  isStreaming?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()

  const toggle = () => setIsOpen((prev) => !prev)

  return (
    <div className="mt-[6px]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="-mx-2 flex cursor-pointer select-none items-center gap-[5px] rounded-[8px] px-2 py-[6px] text-[13px] font-medium leading-none text-[#858481] transition-colors duration-150 ease-out hover:text-[#34322d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/60"
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-[14px] shrink-0 transition-transform duration-200 ease-out ${isOpen ? 'rotate-90' : ''}`}
        />
        <span>Reasoning</span>
        {isStreaming ? (
          <span
            aria-hidden="true"
            className="ml-1 inline-block size-[5px] shrink-0 rounded-full bg-[#a855f7] animate-pulse"
          />
        ) : null}
      </button>

      <div
        id={contentId}
        role="region"
        aria-label="Reasoning details"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden" inert={!isOpen}>
          <div className="pb-1 pt-2 pl-[26px] text-[13px] leading-[1.7] text-[#6b6b66] whitespace-pre-wrap">
            {reasoning}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChatWorkspace({
  chat,
  disabled,
  isStreaming,
  iterationCurrent,
  iterationLimit,
  onSendMessage,
  onStop,
  onOpenSettings,
  error,
}: ChatWorkspaceProps) {
  const [openTerminals, setOpenTerminals] = useState<Set<string>>(new Set())

  const toggleTerminal = (chipId: string) => {
    setOpenTerminals((prev) => {
      const next = new Set(prev)
      if (next.has(chipId)) next.delete(chipId)
      else next.add(chipId)
      return next
    })
  }

  const readyToChat = !disabled

  const sandboxInfo = chat.sandbox
  const codeServerUrl = sandboxInfo?.codeServerUrl
    ?? (sandboxInfo?.sandboxId
      ? `https://8080-${sandboxInfo.sandboxId}.us-phx-1.sandbox.novita.ai/?folder=${sandboxInfo.rootPath ?? '/home/user'}/`
      : undefined)

  const openCodeServer = () => {
    if (!codeServerUrl) return
    window.open(codeServerUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <header className="flex items-center justify-between py-4 border-b border-border gap-4 shrink-0">
        <div className="flex items-center gap-[14px] min-w-0">
          <div className="text-[15px] font-bold truncate">{chat.title || 'New chat'}</div>
        </div>
        <div className="flex items-center gap-[6px] shrink-0">
          <button
            className="w-[34px] h-[34px] rounded-[10px] grid place-items-center transition-colors shrink-0 hover:bg-[rgba(55,53,47,0.04)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            onClick={openCodeServer}
            disabled={!codeServerUrl}
            title={codeServerUrl ? 'Open VS Code in your browser' : 'VS Code becomes available once the sandbox is ready'}
            aria-label="Open VS Code"
          >
            <img src="/vscode-icon.svg" alt="" className="size-[18px]" />
          </button>
          <button
            className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center transition-colors shrink-0 ${!readyToChat ? 'text-[#f97316] animate-[pulse_1.6s_infinite_ease-in-out]' : 'text-[#858481]'} hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]`}
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </header>

      <div className="messages flex-1 min-h-0 overflow-auto py-5 px-0">
        <div className="flex flex-col gap-6 max-w-[760px] mx-auto">
          {chat.messages.map((message) => (
            <article key={message.id}>
              {message.role === 'user' ? (
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5b67f5] to-[#8f42ff] grid place-items-center text-xs font-bold shrink-0 shadow-[0_10px_20px_rgba(104,90,255,0.25)]">
                    <span className="text-white">U</span>
                  </div>
                  <div className="user-bubble flex-1 bg-white border border-border rounded-[22px] px-4 py-[15px] text-sm leading-[1.65] shadow-sm text-[#34322d]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="assistant-block">
                  <div className="assistant-head flex items-center gap-2 mb-3">
                    <div className="assistant-name text-lg font-extrabold">
                      <span className="text-[#a855f7]">Curro</span> <span className="text-[#34322d]">AI</span>
                    </div>
                  </div>
                  <div className="assistant-copy text-[15px] leading-relaxed text-[#34322d]">
                    {message.content || (message.status === 'streaming' ? (
                      <div className="thinking flex items-center gap-[10px] pt-[6px]">
                        <div className="thinking-line flex items-baseline gap-[6px] font-bold text-[#858481]">
                          <span style={{ color: '#a855f7' }}>Curro</span> thinking
                          <span className="thinking-dots inline-block">
                            <span className="animate-[blinkWave_1.8s_infinite_ease-in-out]" style={{ opacity: 0.25, display: 'inline-block' }}>.</span>
                            <span className="animate-[blinkWave_1.8s_infinite_ease-in-out]" style={{ opacity: 0.25, display: 'inline-block', animationDelay: '0.12s' }}>.</span>
                            <span className="animate-[blinkWave_1.8s_infinite_ease-in-out]" style={{ opacity: 0.25, display: 'inline-block', animationDelay: '0.24s' }}>.</span>
                            <span className="animate-[blinkWave_1.8s_infinite_ease-in-out]" style={{ opacity: 0.25, display: 'inline-block', animationDelay: '0.36s' }}>.</span>
                          </span>
                        </div>
                      </div>
                    ) : '')}
                  </div>
                  {message.reasoning ? (
                    <ReasoningBlock reasoning={message.reasoning} isStreaming={message.status === 'streaming'} />
                  ) : null}
                      {message.toolChips && message.toolChips.length > 0 ? (
                    <div className="flex flex-wrap gap-[10px] mt-3">
                      {message.toolChips.map((tool) =>
                        tool.name === 'call_sub_agent' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <SubAgentOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'list_sub_agents' ? (
                          <span key={tool.id} className={`inline-flex items-center gap-2 px-3 py-[6px] rounded-full bg-white border border-border text-xs text-[#34322d] shadow-sm ${tool.ok === false ? 'border-red-300 bg-red-50 text-red-600' : ''}`}>
                            <Bot className="size-[14px] text-[#a855f7]" />
                            <span>{tool.label}</span>
                          </span>
                        ) : tool.name === 'shall_tool' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <TerminalOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'shell_view' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <ShellViewOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'list_files' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <ListFilesOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'web_search' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <WebSearchOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'fatch_web_urls' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <FetchWebOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'str_replace' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <StrReplaceOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'apply_patch' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <ApplyPatchOutput chip={tool} isOpen={openTerminals.has(tool.id)} onToggle={() => toggleTerminal(tool.id)} />
                          </div>
                        ) : tool.name === 'file_write' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <FileWriteOutput chip={tool} />
                          </div>
                        ) : tool.name === 'file_read' ? (
                          <div key={tool.id} className="w-full max-w-xl">
                            <FileReadOutput chip={tool} />
                          </div>
                        ) : (
                          <span key={tool.id} className={`inline-flex items-center gap-2 px-3 py-[6px] rounded-full bg-white border border-border text-xs text-[#34322d] shadow-sm ${tool.ok === false ? 'border-red-300 bg-red-50 text-red-600' : ''}`}>
                            <span className="text-[#858481] flex items-center">
                              <svg viewBox="0 0 24 24" className="size-[14px]" strokeWidth={1.8}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </span>
                            <span>{tool.label}</span>
                            {tool.filePath ? <small className="text-[#858481] font-mono">{tool.filePath}</small> : null}
                          </span>
                        )
                      )}
                    </div>
                ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-[10px] mb-3 px-[14px] py-3 rounded-[16px] border border-[rgba(239,68,68,0.25)] text-[#ef4444] bg-[rgba(239,68,68,0.08)] shadow-sm text-[13px] shrink-0">
          <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" strokeWidth={1.8}><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3 2.6 18A2 2 0 0 0 4.3 21h15.4a2 2 0 0 0 1.7-3l-7.7-13.7a2 2 0 0 0-3.4 0Z"/></svg>
          {error}
        </div>
      ) : null}

      <footer className="pt-[14px] pb-[18px] shrink-0">
        <Composer
          disabled={disabled}
          isStreaming={isStreaming}
          iterationCurrent={iterationCurrent}
          iterationLimit={iterationLimit}
          readyToChat={readyToChat}
          placeholder={disabled ? 'Configure API keys in Settings to start chatting.' : 'Ask Curro to help you build something...'}
          onSubmit={onSendMessage}
          onStop={onStop}
          onOpenSettings={onOpenSettings}
        />
      </footer>
    </div>
  )
}
