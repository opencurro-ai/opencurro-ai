import { Loader2, Search, Settings, TriangleAlert } from 'lucide-react'

import { useProviders } from '@/hooks/useProviders'
import { SubAgentManager } from '@/components/settings/SubAgentManager'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { ProviderId } from '@/types/chat'
import type { SearchProvider } from '@/store/useSettingsStore'

const providers: ProviderId[] = ['openrouter', 'groq', 'nvidia']

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    modelsByProvider,
    novitaApiKey,
    novitaTemplateId,
    tavilyApiKey,
    exaApiKey,
    serpapiApiKey,
    searchProvider,
    firecrawlApiKey,
    providerBaseUrls,
    providerKeys,
    selectedModel,
    selectedProvider,
    setNovitaApiKey,
    setNovitaTemplateId,
    setTavilyApiKey,
    setExaApiKey,
    setSerpapiApiKey,
    setSearchProvider,
    setFirecrawlApiKey,
    setProviderBaseUrl,
    setProviderKey,
    setSelectedModel,
    setSelectedProvider,
  } = useSettingsStore()
  const { error, loadingModels, loadModels } = useProviders()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute inset-0 bg-[rgba(17,17,17,0.55)] backdrop-blur-[8px]"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100dvw-24px))] max-h-[calc(100dvh-32px)] overflow-auto bg-white border border-border rounded-[22px] shadow-[0_32px_80px_rgba(17,17,17,0.25)] p-[22px] z-[1] animate-[fadeUp_0.25s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head flex items-center gap-[14px] mb-[22px]">
          <div className="modal-icon w-[42px] h-[42px] rounded-[14px] bg-[rgba(255,199,0,0.15)] grid place-items-center text-[#a16a00] shrink-0">
            <Settings className="size-5" />
          </div>
          <div>
            <div className="modal-title text-xl font-bold text-[#34322d]">Settings</div>
            <div className="modal-subtitle text-xs text-[#858481] mt-[2px]">Configure credentials and models</div>
          </div>
        </div>

        <div className="field-group mb-[18px]">
          <label className="field-label flex items-center gap-2 text-sm font-semibold text-[#34322d] mb-[10px]">
            <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            API Configuration
          </label>
          <div className="space-y-4">
            {providers.map((provider) => (
              <div key={provider} className="provider-card rounded-[18px] bg-[#f5f5f5] border border-border p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="ico w-[34px] h-[34px] rounded-[12px] bg-[rgba(59,130,246,0.12)] grid place-items-center text-[#3b82f6] shrink-0">
                      <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                    <div>
                      <div className="provider-name text-sm font-semibold text-[#34322d] capitalize">{provider}</div>
                      <div className="provider-desc text-[11px] text-[#858481]">
                        {provider === 'openrouter' ? 'Access any foundation model' : provider === 'groq' ? 'Fast inference API' : 'NVIDIA AI models'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadModels(provider)}
                    className="px-3 py-2 rounded-[12px] text-xs font-semibold text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors border border-border"
                  >
                    {loadingModels && provider === selectedProvider ? <Loader2 className="size-3 animate-spin inline mr-1" /> : null}
                    Fetch models
                  </button>
                </div>
                <input
                  value={providerKeys[provider]}
                  onChange={(event) => setProviderKey(provider, event.target.value)}
                  placeholder={`${provider.toUpperCase()} API key`}
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
                />
                <input
                  value={providerBaseUrls[provider]}
                  onChange={(event) => setProviderBaseUrl(provider, event.target.value)}
                  placeholder="Base URL"
                  className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700] mt-2"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="field-group mb-[18px]">
          <label className="field-label flex items-center gap-2 text-sm font-semibold text-[#34322d] mb-[10px]">
            Novita Sandbox
          </label>
          <div className="space-y-3">
            <input
              value={novitaApiKey}
              onChange={(event) => setNovitaApiKey(event.target.value)}
              placeholder="Novita API key"
              className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
            />
            <input
              value={novitaTemplateId}
              onChange={(event) => setNovitaTemplateId(event.target.value)}
              placeholder="Optional custom sandbox template id"
              className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
            />
            <p className="text-xs leading-relaxed text-[#858481]">
              Sandbox creation is automatic on the first message. Timeout is set to one hour with resume-friendly lifecycle handling.
            </p>
          </div>
        </div>

        <div className="field-group mb-[18px]">
          <label className="field-label flex items-center gap-2 text-sm font-semibold text-[#34322d] mb-[10px]">
            <Search className="size-[18px]" />
            Web Tools
          </label>
          <div className="space-y-3">
            <div className="rounded-[18px] bg-[#f5f5f5] border border-border p-4">
              <label className="block text-sm font-semibold text-[#34322d] mb-2">Search provider</label>
              <select
                value={searchProvider}
                onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}
                className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none"
              >
                <option value="tavily">Tavily</option>
                <option value="exa">Exa</option>
                <option value="serpapi">SerpAPI</option>
              </select>
            </div>
            {searchProvider === 'tavily' ? (
              <input
                value={tavilyApiKey}
                onChange={(event) => setTavilyApiKey(event.target.value)}
                placeholder="Tavily API key (web search)"
                className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
              />
            ) : searchProvider === 'exa' ? (
              <input
                value={exaApiKey}
                onChange={(event) => setExaApiKey(event.target.value)}
                placeholder="Exa API key (web search)"
                className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
              />
            ) : (
              <input
                value={serpapiApiKey}
                onChange={(event) => setSerpapiApiKey(event.target.value)}
                placeholder="SerpAPI API key (web search)"
                className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
              />
            )}
            <input
              value={firecrawlApiKey}
              onChange={(event) => setFirecrawlApiKey(event.target.value)}
              placeholder="Firecrawl API key (web fetch)"
              className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none placeholder:text-[#858481] focus:border-[#ffc700]"
            />
            <p className="text-xs leading-relaxed text-[#858481]">
              These keys enable the agent to search the web and fetch page content. Optional — leave blank to skip web features.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-[18px]">
          <div className="rounded-[18px] bg-[#f5f5f5] border border-border p-4">
            <label className="block text-sm font-semibold text-[#34322d] mb-2">Active provider</label>
            <select
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}
              className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none"
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="rounded-[18px] bg-[#f5f5f5] border border-border p-4">
            <label className="block text-sm font-semibold text-[#34322d] mb-2">Model</label>
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="w-full rounded-[14px] border border-border bg-white px-4 py-3 text-sm text-[#34322d] outline-none"
            >
              <option value="">Select model</option>
              {modelsByProvider[selectedProvider].map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-group mb-[18px]">
          <SubAgentManager />
        </div>

        <div className="warn-inline flex items-start gap-[10px] px-[14px] py-3 rounded-[14px] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.22)] text-[#b45309] text-xs">
          <TriangleAlert className="size-[18px] shrink-0 mt-[-1px]" />
          OpenRouter API key is required to use the agent.
        </div>

        {error ? (
          <div className="rounded-[14px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-[#ef4444] mt-3">{error}</div>
        ) : null}

        <div className="modal-actions flex justify-end gap-3 pt-[18px] border-t border-border mt-[22px]">
          <button onClick={onClose} className="btn ghost px-[14px] py-[11px] rounded-[12px] font-semibold text-sm text-[#858481] hover:bg-[rgba(55,53,47,0.04)] hover:text-[#34322d] transition-colors">
            Cancel
          </button>
          <button onClick={onClose} className="btn primary px-[14px] py-[11px] rounded-[12px] font-semibold text-sm bg-[#ffc700] text-[#34322d] shadow-[0_12px_26px_rgba(255,199,0,0.24)] hover:brightness-[1.03] transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
