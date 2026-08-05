import { Check, Info } from 'lucide-react'

import { Section } from '@/components/settings/Section'
import { inputClass } from '@/components/settings/styles'
import { useSettingsStore } from '@/store/useSettingsStore'

const SANDBOX_FACTS = [
  'Sandbox creation is automatic on the first message.',
  'Sessions time out after one hour with resume-friendly lifecycle handling.',
  'Code, shell commands and file tools run inside the sandbox, never on your machine.',
]

export function SandboxTab() {
  const { novitaApiKey, novitaTemplateId, setNovitaApiKey, setNovitaTemplateId } = useSettingsStore()

  return (
    <div className="space-y-8">
      <Section
        kicker="Sandbox"
        title="Novita sandbox"
        description="A secure execution environment where the agent runs code, shell commands and file operations."
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-sandbox-key" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              API key
            </label>
            <input
              id="settings-sandbox-key"
              value={novitaApiKey}
              onChange={(event) => setNovitaApiKey(event.target.value)}
              placeholder="Novita API key"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="settings-sandbox-template" className="mb-1.5 block text-xs font-semibold text-[#34322d]">
              Template ID <span className="font-normal text-[#858481]">(optional)</span>
            </label>
            <input
              id="settings-sandbox-template"
              value={novitaTemplateId}
              onChange={(event) => setNovitaTemplateId(event.target.value)}
              placeholder="Optional custom sandbox template id"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[16px] border border-border bg-[#f5f5f5] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#34322d]">
            <Info className="size-3.5 text-[#a855f7]" />
            How it works
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-[#858481]">
            {SANDBOX_FACTS.map((fact) => (
              <li key={fact} className="flex gap-2">
                <Check className="mt-[2px] size-3.5 shrink-0 text-[#22c55e]" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  )
}
