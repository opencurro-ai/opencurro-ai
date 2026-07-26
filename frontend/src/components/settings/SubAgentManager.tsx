import { useState } from 'react'
import { Pencil, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'

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

const emptyForm: SubAgentFormData = { name: '', description: '', systemPrompt: '', tools: ['file_read', 'file_write', 'shall_tool'] }

export function SubAgentManager() {
  const { subAgents, addSubAgent, updateSubAgent, deleteSubAgent, toggleSubAgent } = useSettingsStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SubAgentFormData>(emptyForm)
  const [toolSearch, setToolSearch] = useState('')

  const filteredTools = toolSearch
    ? AVAILABLE_TOOLS.filter((t) => t.name.toLowerCase().includes(toolSearch.toLowerCase()) || t.description.toLowerCase().includes(toolSearch.toLowerCase()))
    : AVAILABLE_TOOLS

  function handleCreate() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function handleEdit(config: SubAgentConfig) {
    setForm({ name: config.name, description: config.description, systemPrompt: config.systemPrompt, tools: [...config.tools] })
    setEditingId(config.id)
    setShowForm(true)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (editingId) {
      updateSubAgent(editingId, { name: form.name.trim(), description: form.description.trim(), systemPrompt: form.systemPrompt.trim(), tools: form.tools })
    } else {
      addSubAgent({ name: form.name.trim(), description: form.description.trim(), systemPrompt: form.systemPrompt.trim(), tools: form.tools, enabled: true, id: '', createdAt: '', updatedAt: '' })
    }
    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
  }

  function toggleTool(toolName: string) {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolName) ? prev.tools.filter((t) => t !== toolName) : [...prev.tools, toolName],
    }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-[10px]">
        <label className="field-label flex items-center gap-2 text-sm font-semibold text-[#34322d]">
          <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M12 2a10 10 0 0 1 10 10c0 3.5-2 6.5-5 8l-2-2-2 2-2-2-2 2c-3-1.5-5-4.5-5-8A10 10 0 0 1 12 2Z"/><path d="M8 12h8M12 8v8"/></svg>
          Sub-Agents
        </label>
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] text-xs font-semibold bg-[#ffc700] text-[#34322d] hover:brightness-[1.03] transition-colors shadow-[0_6px_14px_rgba(255,199,0,0.22)]"
        >
          <Plus className="size-3.5" />
          Create Sub-Agent
        </button>
      </div>

      {subAgents.length === 0 ? (
        <div className="rounded-[18px] bg-[#f5f5f5] border border-border p-4 text-sm text-[#858481]">
          No sub-agents yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {subAgents.map((sa) => (
            <div key={sa.id} className="rounded-[14px] bg-[#f5f5f5] border border-border p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#34322d]">{sa.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${sa.enabled ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#858481]/10 text-[#858481]'}`}>
                    {sa.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="text-[11px] text-[#858481] mt-0.5 line-clamp-1">{sa.description || 'No description'}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {sa.tools.map((tool) => (
                    <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white border border-border text-[#858481]">{tool}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSubAgent(sa.id)}
                  className="p-1.5 rounded-[8px] hover:bg-[rgba(55,53,47,0.04)] text-[#858481] hover:text-[#34322d] transition-colors"
                  title={sa.enabled ? 'Disable' : 'Enable'}
                >
                  {sa.enabled ? <ToggleRight className="size-4 text-[#22c55e]" /> : <ToggleLeft className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(sa)}
                  className="p-1.5 rounded-[8px] hover:bg-[rgba(55,53,47,0.04)] text-[#858481] hover:text-[#34322d] transition-colors"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSubAgent(sa.id)}
                  className="p-1.5 rounded-[8px] hover:bg-[rgba(239,68,68,0.08)] text-[#858481] hover:text-[#ef4444] transition-colors"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-[rgba(17,17,17,0.45)] backdrop-blur-[4px]" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100dvw-24px))] max-h-[calc(100dvh-40px)] overflow-auto bg-white border border-border rounded-[22px] shadow-[0_32px_80px_rgba(17,17,17,0.25)] p-[22px] z-[1] animate-[fadeUp_0.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-[18px]">
              <div className="text-lg font-bold text-[#34322d]">{editingId ? 'Edit Sub-Agent' : 'Create Sub-Agent'}</div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-[8px] hover:bg-[rgba(55,53,47,0.04)] text-[#858481] hover:text-[#34322d] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#34322d] mb-1.5">Sub-Agent Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. deepexplorer"
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                  maxLength={20}
                />
                <div className="text-[10px] text-[#858481] mt-1">{form.name.length}/20 characters</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#34322d] mb-1.5">Short Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Performs deep research and analysis."
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                  maxLength={70}
                />
                <div className="text-[10px] text-[#858481] mt-1">{form.description.length}/70 characters</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#34322d] mb-1.5">System Prompt</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                  placeholder="You are a specialized agent that..."
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700] resize-y min-h-[120px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#34322d] mb-1.5">Allowed Tools</label>
                <div className="relative mb-2">
                  <input
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Search tools..."
                    className="w-full rounded-[14px] border border-border bg-white px-4 py-2.5 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700] pl-9"
                  />
                  <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#858481]" strokeWidth={1.8}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <div className="rounded-[14px] border border-border bg-white p-2 max-h-[200px] overflow-auto space-y-0.5">
                  {filteredTools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] hover:bg-[rgba(55,53,47,0.04)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={form.tools.includes(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                        className="rounded-[4px] border-[#d0d0d0] text-[#ffc700] focus:ring-[#ffc700] size-4 accent-[#ffc700]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#34322d]">{tool.name}</div>
                        <div className="text-[10px] text-[#858481]">{tool.description}</div>
                      </div>
                    </label>
                  ))}
                  {filteredTools.length === 0 && (
                    <div className="text-xs text-[#858481] px-2.5 py-2">No tools match your search.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-[18px] border-t border-border mt-[22px]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-[14px] py-[11px] rounded-[12px] font-semibold text-sm text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-[14px] py-[11px] rounded-[12px] font-semibold text-sm bg-[#ffc700] text-[#34322d] shadow-[0_12px_26px_rgba(255,199,0,0.24)] hover:brightness-[1.03] transition-colors disabled:opacity-50"
                disabled={!form.name.trim()}
              >
                {editingId ? 'Save Changes' : 'Create Sub-Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
