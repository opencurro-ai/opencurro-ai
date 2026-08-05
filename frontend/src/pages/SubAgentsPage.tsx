import { useEffect, useState } from 'react'
import { ArrowLeft, Bot, Pencil, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'

import { NavigationRail } from '@/components/sidebar/NavigationRail'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { navigate } from '@/lib/router'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { SubAgentConfig } from '@/types/chat'

const AVAILABLE_TOOLS = [
  { name: 'file_read', description: 'Read file content from sandbox' },
  { name: 'file_write', description: 'Write content to a file' },
  { name: 'str_replace', description: 'Replace string in a file' },
  { name: 'apply_patch', description: 'Apply structured patches to files' },
  { name: 'list_files', description: 'List directory contents' },
  { name: 'shall_tool', description: 'Execute shell commands' },
  { name: 'shell_view', description: 'View background shell output' },
  { name: 'web_search', description: 'Search the web' },
  { name: 'fatch_web_urls', description: 'Fetch URL content' },
]

interface SubAgentFormData {
  name: string
  description: string
  systemPrompt: string
  tools: string[]
}

const emptyForm: SubAgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  tools: ['file_read', 'file_write', 'shall_tool'],
}

export function SubAgentsPage() {
  const { subAgents, addSubAgent, updateSubAgent, deleteSubAgent, toggleSubAgent } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SubAgentFormData>(emptyForm)
  const [toolSearch, setToolSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTools = toolSearch
    ? AVAILABLE_TOOLS.filter(
        (t) =>
          t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
          t.description.toLowerCase().includes(toolSearch.toLowerCase()),
      )
    : AVAILABLE_TOOLS

  const filteredSubAgents = searchQuery
    ? subAgents.filter(
        (sa) =>
          sa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sa.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : subAgents

  useEffect(() => {
    if (!showForm) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setShowForm(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [showForm])

  function handleCreate() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function handleEdit(config: SubAgentConfig) {
    setForm({
      name: config.name,
      description: config.description,
      systemPrompt: config.systemPrompt,
      tools: [...config.tools],
    })
    setEditingId(config.id)
    setShowForm(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (editingId) {
      updateSubAgent(editingId, {
        name: form.name.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
        tools: form.tools,
      })
    } else {
      addSubAgent({
        name: form.name.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
        tools: form.tools,
        enabled: true,
        id: '',
        createdAt: '',
        updatedAt: '',
      })
    }
    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
  }

  function toggleTool(toolName: string) {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter((t) => t !== toolName)
        : [...prev.tools, toolName],
    }))
  }

  return (
    <div className="app h-dvh w-dvw flex overflow-hidden" style={{ background: '#f8f8f7' }}>
      <NavigationRail onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex flex-1 min-w-0 min-h-0">
        <section className="flex flex-col flex-1 min-w-0 h-full min-h-0">
          {/* Header */}
          <header className="shrink-0 border-b border-border bg-white px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
                aria-label="Back to home"
              >
                <ArrowLeft className="size-[18px]" />
              </button>
              <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[rgba(168,85,247,0.12)] text-[#a855f7]">
                <Bot className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-bold text-[#34322d]">Sub-Agents</div>
                <div className="text-xs text-[#858481]">Create and manage specialized AI agents</div>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-[12px] bg-[#ffc700] px-4 py-2.5 text-sm font-semibold text-[#34322d] shadow-[0_6px_14px_rgba(255,199,0,0.22)] transition-colors hover:brightness-[1.03]"
              >
                <Plus className="size-4" />
                Create Sub-Agent
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-[900px] px-6 py-6">
              {/* Search */}
              <div className="relative mb-6 animate-[fadeUp_0.2s_ease]">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sub-agents by name or description..."
                  className="w-full rounded-[16px] border border-border bg-white px-5 py-3.5 pl-12 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                />
                <svg
                  viewBox="0 0 24 24"
                  className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#858481]"
                  strokeWidth={1.8}
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>

              {/* Sub-agents list */}
              {filteredSubAgents.length === 0 ? (
                <div className="animate-[fadeUp_0.25s_ease] rounded-[20px] border border-border bg-white p-12 text-center">
                  <div className="mx-auto grid size-16 place-items-center rounded-full bg-[rgba(168,85,247,0.08)]">
                    <Bot className="size-8 text-[#a855f7]" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-[#34322d]">
                    {searchQuery ? 'No sub-agents found' : 'No sub-agents yet'}
                  </div>
                  <div className="mt-1 text-sm text-[#858481]">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'Create your first specialized agent to get started'}
                  </div>
                  {!searchQuery && (
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="mt-6 inline-flex items-center gap-2 rounded-[12px] bg-[#ffc700] px-5 py-2.5 text-sm font-semibold text-[#34322d] shadow-[0_6px_14px_rgba(255,199,0,0.22)] transition-colors hover:brightness-[1.03]"
                    >
                      <Plus className="size-4" />
                      Create Sub-Agent
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 animate-[fadeUp_0.25s_ease]">
                  {filteredSubAgents.map((sa, index) => (
                    <div
                      key={sa.id}
                      style={{ animationDelay: `${index * 30}ms` }}
                      className="animate-[fadeUp_0.2s_ease] rounded-[18px] border border-border bg-white p-5 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[rgba(168,85,247,0.12)] text-[#a855f7]">
                          <Bot className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-[#34322d]">{sa.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                sa.enabled
                                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                                  : 'bg-[#858481]/10 text-[#858481]'
                              }`}
                            >
                              {sa.enabled ? 'enabled' : 'disabled'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[#858481] line-clamp-2">
                            {sa.description || 'No description provided'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {sa.tools.map((tool) => (
                              <span
                                key={tool}
                                className="rounded-md border border-border bg-[#f5f5f5] px-2 py-1 text-[10px] font-medium text-[#858481]"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSubAgent(sa.id)}
                            className="grid size-9 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
                            title={sa.enabled ? 'Disable' : 'Enable'}
                          >
                            {sa.enabled ? (
                              <ToggleRight className="size-5 text-[#22c55e]" />
                            ) : (
                              <ToggleLeft className="size-5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(sa)}
                            className="grid size-9 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to delete "${sa.name}"? This action cannot be undone.`,
                                )
                              ) {
                                deleteSubAgent(sa.id)
                              }
                            }}
                            className="grid size-9 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(239,68,68,0.08)] hover:text-[#ef4444]"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-[rgba(17,17,17,0.45)] backdrop-blur-[4px]" />
          <div
            className="absolute left-1/2 top-1/2 z-[1] w-[min(560px,calc(100dvw-24px))] max-h-[calc(100dvh-40px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[22px] border border-border bg-white p-[24px] shadow-[0_32px_80px_rgba(17,17,17,0.25)] animate-[fadeUp_0.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-lg font-bold text-[#34322d]">
                {editingId ? 'Edit Sub-Agent' : 'Create Sub-Agent'}
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="grid size-8 place-items-center rounded-[8px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#34322d]">
                  Sub-Agent Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., deepexplorer"
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                  maxLength={20}
                />
                <div className="mt-1 text-[10px] text-[#858481]">{form.name.length}/20 characters</div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#34322d]">
                  Short Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g., Performs deep research and analysis"
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                  maxLength={70}
                />
                <div className="mt-1 text-[10px] text-[#858481]">
                  {form.description.length}/70 characters
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#34322d]">
                  System Prompt
                </label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                  placeholder="You are a specialized agent that..."
                  className="min-h-[120px] w-full resize-y rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#34322d]">
                  Allowed Tools
                </label>
                <div className="relative mb-3">
                  <input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Search tools..."
                    className="w-full rounded-[14px] border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                  />
                  <svg
                    viewBox="0 0 24 24"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#858481]"
                    strokeWidth={1.8}
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <div className="max-h-[220px] space-y-1 overflow-auto rounded-[14px] border border-border bg-white p-2">
                  {filteredTools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[rgba(55,53,47,0.04)]"
                    >
                      <input
                        type="checkbox"
                        checked={form.tools.includes(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                        className="size-4 accent-[#ffc700] rounded-[4px] border-[#d0d0d0] text-[#ffc700] focus:ring-[#ffc700]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#34322d]">{tool.name}</div>
                        <div className="text-[10px] text-[#858481]">{tool.description}</div>
                      </div>
                    </label>
                  ))}
                  {filteredTools.length === 0 && (
                    <div className="px-3 py-2.5 text-xs text-[#858481]">
                      No tools match your search.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-[12px] px-[14px] py-[11px] text-sm font-semibold text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-[12px] bg-[#ffc700] px-[14px] py-[11px] text-sm font-semibold text-[#34322d] shadow-[0_12px_26px_rgba(255,199,0,0.24)] transition-colors hover:brightness-[1.03] disabled:opacity-50"
                disabled={!form.name.trim()}
              >
                {editingId ? 'Save Changes' : 'Create Sub-Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
