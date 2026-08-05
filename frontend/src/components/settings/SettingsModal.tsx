import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { Bot, Box, Cpu, Globe, PanelLeftClose, PanelLeftOpen, Settings, X } from 'lucide-react'

import { ModelsTab } from '@/components/settings/ModelsTab'
import { SandboxTab } from '@/components/settings/SandboxTab'
import { WebSearchTab } from '@/components/settings/WebSearchTab'
import { SubAgentManager } from '@/components/settings/SubAgentManager'
import { cn } from '@/lib/utils'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

type TabId = 'models' | 'sandboxes' | 'web-search' | 'sub-agents'

interface TabDef {
  id: TabId
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { id: 'models', label: 'Models', icon: <Cpu className="size-[18px] shrink-0" /> },
  { id: 'sandboxes', label: 'Sandboxes', icon: <Box className="size-[18px] shrink-0" /> },
  { id: 'web-search', label: 'Web Search', icon: <Globe className="size-[18px] shrink-0" /> },
  { id: 'sub-agents', label: 'Sub Agents', icon: <Bot className="size-[18px] shrink-0" /> },
]

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('models')
  const [railOpen, setRailOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  function handleTablistKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((tab) => tab.id === activeTab)
    let nextIndex = -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % TABS.length
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1
    } else {
      return
    }
    event.preventDefault()
    const next = TABS[nextIndex]
    setActiveTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(17,17,17,0.55)] backdrop-blur-[8px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="absolute left-1/2 top-1/2 z-[1] flex h-[min(680px,calc(100dvh-48px))] w-[min(960px,calc(100dvw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] border border-border bg-white shadow-[0_32px_80px_rgba(17,17,17,0.25)] outline-none animate-[fadeUp_0.25s_ease]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Navigation rail */}
        <aside
          aria-label="Settings sections"
          className={cn(
            'flex shrink-0 flex-col overflow-hidden border-r border-border bg-white transition-[width] duration-200 ease-out',
            railOpen ? 'w-56' : 'w-16',
          )}
        >
          <div className="flex h-[60px] shrink-0 items-center border-b border-border px-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#ffc700] text-sm font-extrabold text-[#34322d]">
              A
            </div>
            <span
              className={cn(
                'ml-2.5 min-w-0 truncate whitespace-nowrap text-sm font-bold text-[#34322d] transition-opacity duration-150',
                railOpen ? 'opacity-100' : 'opacity-0',
              )}
            >
              Curro AI
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Settings sections"
            onKeyDown={handleTablistKeyDown}
            className="flex flex-1 flex-col gap-[2px] px-2 py-3"
          >
            {TABS.map((tab) => (
              <div key={tab.id} className="relative flex w-full items-center">
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#ffc700] transition-all duration-150',
                    activeTab === tab.id ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
                  )}
                />
                <button
                  type="button"
                  role="tab"
                  id={`settings-tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`settings-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  ref={(element) => { tabRefs.current[tab.id] = element }}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={cn(
                    'flex h-10 w-full items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/60',
                    activeTab === tab.id
                      ? 'bg-[rgba(255,199,0,0.14)] text-[#34322d]'
                      : 'text-[#858481] hover:bg-[rgba(55,53,47,0.05)] hover:text-[#34322d]',
                  )}
                >
                  {tab.icon}
                  <span
                    className={cn(
                      'min-w-0 truncate whitespace-nowrap transition-opacity duration-150',
                      railOpen ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-border p-2">
            <button
              type="button"
              onClick={() => setRailOpen((value) => !value)}
              aria-label={railOpen ? 'Collapse navigation' : 'Expand navigation'}
              title={railOpen ? 'Collapse navigation' : 'Expand navigation'}
              className="flex h-10 w-full items-center justify-center gap-3 rounded-[12px] text-[#858481] transition-colors duration-150 hover:bg-[rgba(55,53,47,0.05)] hover:text-[#34322d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/60"
            >
              {railOpen ? <PanelLeftClose className="size-[18px] shrink-0" /> : <PanelLeftOpen className="size-[18px] shrink-0" />}
              <span
                className={cn(
                  'min-w-0 truncate whitespace-nowrap text-xs font-medium transition-opacity duration-150',
                  railOpen ? 'opacity-100' : 'hidden',
                )}
              >
                Collapse
              </span>
            </button>
          </div>
        </aside>

        {/* Tab content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[rgba(255,199,0,0.15)] text-[#a16a00]">
              <Settings className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-[#34322d]">Settings</div>
              <div className="text-xs text-[#858481]">Configure the agent to match your workflow</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="ml-auto grid size-8 shrink-0 place-items-center rounded-[10px] text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.05)] hover:text-[#34322d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/60"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              key={activeTab}
              role="tabpanel"
              id={`settings-panel-${activeTab}`}
              aria-labelledby={`settings-tab-${activeTab}`}
              tabIndex={0}
              className="animate-[fadeUp_0.18s_ease] px-6 py-6 outline-none"
            >
              {activeTab === 'models' ? <ModelsTab /> : null}
              {activeTab === 'sandboxes' ? <SandboxTab /> : null}
              {activeTab === 'web-search' ? <WebSearchTab /> : null}
              {activeTab === 'sub-agents' ? <SubAgentManager /> : null}
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] px-[14px] py-[11px] text-sm font-semibold text-[#858481] transition-colors hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] bg-[#ffc700] px-[14px] py-[11px] text-sm font-semibold text-[#34322d] shadow-[0_12px_26px_rgba(255,199,0,0.24)] transition-colors hover:brightness-[1.03]"
            >
              Save Changes
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}
