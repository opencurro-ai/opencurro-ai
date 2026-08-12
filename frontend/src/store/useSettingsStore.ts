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
       providerKeys: { openrouter: '', groq: '', nvidia: '', fireworks: '', ollama_cloud: '', opencode_zen: '', aihubmix: '', blueclaw: '', requesty: '', unorouter: '', vercel_ai_gateway: '', zenmux: '', kilo_code: '', chutes: '', cohere: '', mistral: '', cerebras: '', sambanova: '', huggingface: '', pollinations: '', z_ai: '', siliconflow: '', airforce: '', inceptionlabs: '', deepseek: '', routeway: '', opentyphoon: '', sarvam: '', sealion: '', openadapter: '' },
      providerBaseUrls: {
        openrouter: 'https://openrouter.ai/api/v1',
        groq: 'https://api.groq.com/openai/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        fireworks: 'https://api.fireworks.ai/inference/v1',
        ollama_cloud: 'https://ollama.com/api/v1',
        opencode_zen: 'https://opencode.ai/zen/v1',
        aihubmix: 'https://api.aihubmix.com/v1',
        blueclaw: 'https://openai.blueclaw.network/v1',
        requesty: 'https://router.requesty.ai/v1',
        unorouter: 'https://api.unorouter.com/v1',
        vercel_ai_gateway: 'https://ai-gateway.vercel.sh/v1',
        zenmux: 'https://zenmux.ai/api/v1',
        kilo_code: 'https://api.kilo.ai/api/gateway',
        chutes: 'https://llm.chutes.ai/v1',
        cohere: 'https://api.cohere.ai/compatibility/v1',
        mistral: 'https://api.mistral.ai/v1',
        cerebras: 'https://api.cerebras.ai/v1',
        sambanova: 'https://api.sambanova.ai/v1',
        huggingface: 'https://router.huggingface.co/v1',
        pollinations: 'https://gen.pollinations.ai/v1',
        z_ai: 'https://open.bigmodel.cn/api/paas/v4/',
        siliconflow: 'https://api.siliconflow.com/v1',
        airforce: 'https://api.airforce/v1',
        inceptionlabs: 'https://api.inceptionlabs.ai/v1',
        deepseek: 'https://api.deepseek.com/v1',
        routeway: 'https://api.routeway.ai/v1',
        opentyphoon: 'https://api.opentyphoon.ai/v1',
        sarvam: 'https://api.sarvam.ai/v1',
        sealion: 'https://api.sea-lion.ai/v1',
        openadapter: 'https://api.openadapter.in/v1',
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
      modelsByProvider: { openrouter: [], groq: [], nvidia: [], fireworks: [], ollama_cloud: [], opencode_zen: [], aihubmix: [], blueclaw: [], requesty: [], unorouter: [], vercel_ai_gateway: [], zenmux: [], kilo_code: [], chutes: [], cohere: [], mistral: [], cerebras: [], sambanova: [], huggingface: [], pollinations: [], z_ai: [], siliconflow: [], airforce: [], inceptionlabs: [], deepseek: [], routeway: [], opentyphoon: [], sarvam: [], sealion: [], openadapter: [] },
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
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState>
        return {
          ...current,
          ...p,
          providerKeys: { ...current.providerKeys, ...p.providerKeys },
          providerBaseUrls: { ...current.providerBaseUrls, ...p.providerBaseUrls },
          modelsByProvider: { ...current.modelsByProvider, ...p.modelsByProvider },
        }
      },
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