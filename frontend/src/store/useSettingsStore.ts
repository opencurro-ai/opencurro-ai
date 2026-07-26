import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ProviderId, SubAgentConfig } from '@/types/chat'
import type { ProviderMetadata, ProviderModel } from '@/types/provider'

export type SearchProvider = 'tavily' | 'exa' | 'serpapi'

interface SettingsState {
  providerKeys: Record<ProviderId, string>
  providerBaseUrls: Record<ProviderId, string>
  selectedProvider: ProviderId
  selectedModel: string
  novitaApiKey: string
  novitaTemplateId: string
  tavilyApiKey: string
  exaApiKey: string
  serpapiApiKey: string
  searchProvider: SearchProvider
  firecrawlApiKey: string
  providerCatalog: ProviderMetadata[]
  modelsByProvider: Record<ProviderId, ProviderModel[]>
  subAgents: SubAgentConfig[]
  setProviderKey: (provider: ProviderId, value: string) => void
  setProviderBaseUrl: (provider: ProviderId, value: string) => void
  setSelectedProvider: (provider: ProviderId) => void
  setSelectedModel: (model: string) => void
  setNovitaApiKey: (value: string) => void
  setNovitaTemplateId: (value: string) => void
  setTavilyApiKey: (value: string) => void
  setExaApiKey: (value: string) => void
  setSerpapiApiKey: (value: string) => void
  setSearchProvider: (value: SearchProvider) => void
  setFirecrawlApiKey: (value: string) => void
  setProviderCatalog: (providers: ProviderMetadata[]) => void
  setModelsForProvider: (provider: ProviderId, models: ProviderModel[]) => void
  addSubAgent: (config: SubAgentConfig) => void
  updateSubAgent: (id: string, config: Partial<SubAgentConfig>) => void
  deleteSubAgent: (id: string) => void
  toggleSubAgent: (id: string) => void
}

function generateId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `sub-${Date.now()}-${random}`
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      providerKeys: { openrouter: '', groq: '', nvidia: '' },
      providerBaseUrls: {
        openrouter: 'https://openrouter.ai/api/v1',
        groq: 'https://api.groq.com/openai/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
      },
      selectedProvider: 'openrouter',
      selectedModel: '',
      novitaApiKey: '',
      novitaTemplateId: '',
      tavilyApiKey: '',
      exaApiKey: '',
      serpapiApiKey: '',
      searchProvider: 'tavily',
      firecrawlApiKey: '',
      providerCatalog: [],
      modelsByProvider: { openrouter: [], groq: [], nvidia: [] },
      subAgents: [],
      setProviderKey: (provider, value) => set((state) => ({ providerKeys: { ...state.providerKeys, [provider]: value } })),
      setProviderBaseUrl: (provider, value) => set((state) => ({ providerBaseUrls: { ...state.providerBaseUrls, [provider]: value } })),
      setSelectedProvider: (provider) => set({ selectedProvider: provider, selectedModel: '' }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setNovitaApiKey: (value) => set({ novitaApiKey: value }),
      setNovitaTemplateId: (value) => set({ novitaTemplateId: value }),
      setTavilyApiKey: (value) => set({ tavilyApiKey: value }),
      setExaApiKey: (value) => set({ exaApiKey: value }),
      setSerpapiApiKey: (value) => set({ serpapiApiKey: value }),
      setSearchProvider: (value) => set({ searchProvider: value }),
      setFirecrawlApiKey: (value) => set({ firecrawlApiKey: value }),
      setProviderCatalog: (providerCatalog) => set({ providerCatalog }),
      setModelsForProvider: (provider, models) => set((state) => ({ modelsByProvider: { ...state.modelsByProvider, [provider]: models } })),
      addSubAgent: (config) => set((state) => ({
        subAgents: [...state.subAgents, { ...config, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      })),
      updateSubAgent: (id, updates) => set((state) => ({
        subAgents: state.subAgents.map((sa) => sa.id === id ? { ...sa, ...updates, updatedAt: new Date().toISOString() } : sa),
      })),
      deleteSubAgent: (id) => set((state) => ({
        subAgents: state.subAgents.filter((sa) => sa.id !== id),
      })),
      toggleSubAgent: (id) => set((state) => ({
        subAgents: state.subAgents.map((sa) => sa.id === id ? { ...sa, enabled: !sa.enabled, updatedAt: new Date().toISOString() } : sa),
      })),
    }),
    {
      name: 'novita-agent-settings',
      partialize: (state) => ({
        providerKeys: state.providerKeys,
        providerBaseUrls: state.providerBaseUrls,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
        novitaApiKey: state.novitaApiKey,
        novitaTemplateId: state.novitaTemplateId,
        tavilyApiKey: state.tavilyApiKey,
        exaApiKey: state.exaApiKey,
        serpapiApiKey: state.serpapiApiKey,
        searchProvider: state.searchProvider,
        firecrawlApiKey: state.firecrawlApiKey,
        modelsByProvider: state.modelsByProvider,
        subAgents: state.subAgents,
      }),
    },
  ),
)