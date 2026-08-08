import { Loader2, TriangleAlert } from 'lucide-react'

import { Section } from '@/components/settings/Section'
import { inputClass, selectClass } from '@/components/settings/styles'
import { useProviders } from '@/hooks/useProviders'
import { useSettingsStore } from '@/store/useSettingsStore'
import { cn } from '@/lib/utils'
import type { ProviderId } from '@/types/chat'

const providers: ProviderId[] = ['openrouter', 'groq', 'nvidia', 'fireworks']

const PROVIDER_META: Record<ProviderId, { description: string; iconClass: string }> = {
  openrouter: { description: 'Access any foundation model', iconClass: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]' },
  groq: { description: 'Fast inference API', iconClass: 'bg-[rgba(249,115,22,0.12)] text-[#f97316]' },
  nvidia: { description: 'NVIDIA AI models', iconClass: 'bg-[rgba(16,185,129,0.12)] text-[#10b981]' },
  fireworks: { description: 'Fast open-source model inference', iconClass: 'bg-[rgba(139,92,246,0.12)] text-[#8b5cf6]' },
}

export function ModelsTab() {
  const {
    modelsByProvider,
    providerBaseUrls,
    providerKeys,
    selectedModel,
    selectedProvider,
    setProviderBaseUrl,
    setProviderKey,
    setSelectedModel,
    setSelectedProvider,
  } = useSettingsStore()
  const { error, loadingModels, loadModels } = useProviders()

  return (
    <div className="space-y-8">
      <Section
        kicker="Active configuration"
        title="Provider and model"
        description="Choose which provider and model the agent uses for every conversation."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="settings-provider" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              Provider
            </label>
            <select
              id="settings-provider"
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as ProviderId)}
              className={selectClass}
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settings-model" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              Model
            </label>
            <select
              id="settings-model"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className={selectClass}
            >
              <option value="">Select model</option>
              {(modelsByProvider[selectedProvider] ?? []).map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
            {(modelsByProvider[selectedProvider] ?? []).length === 0 ? (
              <p className="mt-1.5 text-[11px] text-[#858481]">Fetch models with the button below to populate this list.</p>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-[14px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-[#ef4444]">{error}</div>
        ) : null}
      </Section>

      <Section
        kicker="Credentials"
        title="API keys"
        description="Keys are stored locally in your browser and are only sent to the matching provider."
      >
        <div className="space-y-3">
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider]
            return (
              <div key={provider} className="rounded-[18px] border border-border bg-[#f5f5f5] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className={cn('grid size-[34px] shrink-0 place-items-center rounded-[12px]', meta.iconClass)}>
                      <svg viewBox="0 0 24 24" className="size-[18px]" strokeWidth={1.8}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold capitalize text-[#34322d]">{provider}</div>
                      <div className="truncate text-[11px] text-[#858481]">{meta.description}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadModels(provider)}
                    className="shrink-0 rounded-[12px] border border-border bg-white/60 px-3 py-2 text-xs font-semibold text-[#858481] transition-colors hover:bg-white hover:text-[#34322d]"
                  >
                    {loadingModels && provider === selectedProvider ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
                    Fetch models
                  </button>
                </div>
                <input
                  value={providerKeys[provider] ?? ''}
                  onChange={(event) => setProviderKey(provider, event.target.value)}
                  placeholder={`${provider.toUpperCase()} API key`}
                  className={inputClass}
                />
                <input
                  value={providerBaseUrls[provider] ?? ''}
                  onChange={(event) => setProviderBaseUrl(provider, event.target.value)}
                  placeholder="Base URL"
                  className={cn(inputClass, 'mt-2')}
                />
              </div>
            )
          })}
        </div>
      </Section>

      <div className="warn-inline flex items-start gap-[10px] rounded-[14px] border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-[14px] py-3 text-xs text-[#b45309]">
        <TriangleAlert className="mt-[-1px] size-[18px] shrink-0" />
        OpenRouter API key is required to use the agent.
      </div>
    </div>
  )
}
