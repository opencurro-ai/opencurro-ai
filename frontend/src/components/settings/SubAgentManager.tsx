import { useState } from 'react'
import { ArrowUpRight, Bot, Search, ToggleLeft, ToggleRight } from 'lucide-react'

import { navigate } from '@/lib/router'
import { useSettingsStore } from '@/store/useSettingsStore'

export function SubAgentManager() {
  const { subAgents, toggleSubAgent } = useSettingsStore()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSubAgents = searchQuery
    ? subAgents.filter(
        (sa) =>
          sa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sa.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : subAgents

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="field-label flex items-center gap-2 text-sm font-semibold text-[#34322d]">
          <Bot className="size-[18px]" strokeWidth={1.8} />
          Sub-Agents
        </label>
        <button
          type="button"
          onClick={() => navigate('/sub-agents')}
          className="flex items-center gap-1.5 rounded-[12px] bg-[#ffc700] px-3 py-2 text-xs font-semibold text-[#34322d] shadow-[0_6px_14px_rgba(255,199,0,0.22)] transition-colors hover:brightness-[1.03]"
        >
          Manage Sub-Agents
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      {/* Search */}
      {subAgents.length > 0 && (
        <div className="relative mb-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sub-agents..."
            className="w-full rounded-[14px] border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
          />
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#858481]" strokeWidth={1.8} />
        </div>
      )}

      {/* Sub-agents list */}
      {subAgents.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-[#f5f5f5] p-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[rgba(168,85,247,0.08)]">
            <Bot className="size-6 text-[#a855f7]" />
          </div>
          <div className="mt-3 text-sm font-medium text-[#34322d]">No sub-agents yet</div>
          <div className="mt-1 text-xs text-[#858481]">
            Create specialized agents on the dedicated page
          </div>
          <button
            type="button"
            onClick={() => navigate('/sub-agents')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-[12px] bg-[#ffc700] px-4 py-2 text-xs font-semibold text-[#34322d] shadow-[0_6px_14px_rgba(255,199,0,0.22)] transition-colors hover:brightness-[1.03]"
          >
            Create Sub-Agent
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      ) : filteredSubAgents.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-[#f5f5f5] p-4 text-center text-sm text-[#858481]">
          No sub-agents match your search
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubAgents.map((sa) => (
            <div
              key={sa.id}
              className="flex items-center gap-3 rounded-[14px] border border-border bg-[#f5f5f5] p-3 transition-colors hover:bg-white"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[rgba(168,85,247,0.12)] text-[#a855f7]">
                <Bot className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[#34322d]">{sa.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      sa.enabled
                        ? 'bg-[#22c55e]/10 text-[#22c55e]'
                        : 'bg-[#858481]/10 text-[#858481]'
                    }`}
                  >
                    {sa.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-[#858481]">
                  {sa.description || 'No description'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSubAgent(sa.id)}
                className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
                title={sa.enabled ? 'Disable' : 'Enable'}
              >
                {sa.enabled ? (
                  <ToggleRight className="size-5 text-[#22c55e]" />
                ) : (
                  <ToggleLeft className="size-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

