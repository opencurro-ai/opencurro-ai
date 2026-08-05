import { Info } from 'lucide-react'

import { Section } from '@/components/settings/Section'
import { inputClass, selectClass } from '@/components/settings/styles'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { SearchProvider } from '@/store/useSettingsStore'

const SEARCH_PROVIDERS: Array<{ id: SearchProvider; label: string; hint: string }> = [
  { id: 'tavily', label: 'Tavily', hint: 'Fast, AI-native search API' },
  { id: 'exa', label: 'Exa', hint: 'Neural web search with deep coverage' },
  { id: 'serpapi', label: 'SerpAPI', hint: 'Google search results API' },
]

export function WebSearchTab() {
  const {
    searchProvider,
    setSearchProvider,
    tavilyApiKey,
    setTavilyApiKey,
    exaApiKey,
    setExaApiKey,
    serpapiApiKey,
    setSerpapiApiKey,
    firecrawlApiKey,
    setFirecrawlApiKey,
  } = useSettingsStore()

  const active = SEARCH_PROVIDERS.find((provider) => provider.id === searchProvider) ?? SEARCH_PROVIDERS[0]

  const activeKey = searchProvider === 'tavily' ? tavilyApiKey : searchProvider === 'exa' ? exaApiKey : serpapiApiKey

  function handleKeyChange(value: string) {
    if (searchProvider === 'tavily') setTavilyApiKey(value)
    else if (searchProvider === 'exa') setExaApiKey(value)
    else setSerpapiApiKey(value)
  }

  return (
    <div className="space-y-8">
      <Section
        kicker="Web tools"
        title="Search and fetch"
        description="Give the agent the ability to search the web and read page content at runtime."
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-search-provider" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              Search provider
            </label>
            <select
              id="settings-search-provider"
              value={searchProvider}
              onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}
              className={selectClass}
            >
              {SEARCH_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#858481]">{active.hint}</p>
          </div>

          <div>
            <label htmlFor="settings-search-key" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              {active.label} API key <span className="font-normal text-[#858481]">(web search)</span>
            </label>
            <input
              id="settings-search-key"
              value={activeKey}
              onChange={(event) => handleKeyChange(event.target.value)}
              placeholder={`${active.label} API key`}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="settings-firecrawl-key" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              Firecrawl API key <span className="font-normal text-[#858481]">(web fetch)</span>
            </label>
            <input
              id="settings-firecrawl-key"
              value={firecrawlApiKey}
              onChange={(event) => setFirecrawlApiKey(event.target.value)}
              placeholder="Firecrawl API key (web fetch)"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[16px] border border-border bg-[#f5f5f5] p-4 text-xs leading-relaxed text-[#858481]">
          <Info className="mt-[2px] size-3.5 shrink-0 text-[#a855f7]" />
          These keys enable the agent to search the web and fetch page content. Optional — leave blank to skip web features.
        </div>
      </Section>
    </div>
  )
}
