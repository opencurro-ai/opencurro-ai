import { useEffect, useState } from "react";
import {
  X,
  KeyRound,
  RefreshCw,
  Check,
  Globe,
  Bot,
  ChevronRight,
  Plus,
  Trash2,
  Plug,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchModels, fetchProviders } from "@/lib/api";
import { FALLBACK_PROVIDERS, isCustomProviderId } from "@/lib/providers";
import type { CustomHeader, SearchProvider } from "@/types";
import { cn } from "@/utils/cn";

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const providers = useStore((s) => s.providers);
  const setProviders = useStore((s) => s.setProviders);
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const modelsLoading = useStore((s) => s.modelsLoading);
  const setModelsLoading = useStore((s) => s.setModelsLoading);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setApiKey = useStore((s) => s.setApiKey);
  const setSearchProvider = useStore((s) => s.setSearchProvider);
  const setSearchApiKey = useStore((s) => s.setSearchApiKey);
  const setSubAgentsOpen = useStore((s) => s.setSubAgentsOpen);
  const subAgentCount = useStore((s) => s.subAgents.length);

  const customProviders = useStore((s) => s.customProviders);
  const updateCustomProvider = useStore((s) => s.updateCustomProvider);
  const deleteCustomProvider = useStore((s) => s.deleteCustomProvider);
  const selectCustomProvider = useStore((s) => s.selectCustomProvider);

  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (open && providers.length === 0) {
      fetchProviders().then(setProviders).catch(() => {});
    }
  }, [open, providers.length, setProviders]);

  if (!open) return null;

  const builtInProviderList = providers.length > 0 ? providers : FALLBACK_PROVIDERS;
  const isCustom = isCustomProviderId(settings.provider);
  const selectedCustom = customProviders.find((p) => p.id === settings.provider);
  const currentKey = isCustom ? (selectedCustom?.apiKey ?? "") : (settings.apiKeys[settings.provider] ?? "");
  const currentProviderMeta = isCustom
    ? { defaultBaseUrl: selectedCustom?.baseUrl ?? "" }
    : builtInProviderList.find((p) => p.id === settings.provider);

  const loadModels = async () => {
    if (!currentKey) {
      setError("Enter an API key first.");
      return;
    }
    setError(null);
    setModelsLoading(true);
    try {
      const list = await fetchModels(settings.provider, currentKey, settings.baseUrl);
      setModels(list);
      if (list.length > 0 && !list.some((m) => m.id === settings.model)) {
        setSettings({ model: list[0].id });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleProviderChange = (value: string) => {
    if (isCustomProviderId(value)) {
      selectCustomProvider(value);
      setModels([]);
      return;
    }
    setSettings({ provider: value, model: "", baseUrl: "" });
    setModels([]);
  };

  const modelOptions = isCustom
    ? (selectedCustom?.models.filter((m) => m.trim().length > 0) ?? [])
    : models.map((m) => m.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-20 backdrop-blur-sm"
      onClick={() => { setOpen(false); setEditorOpen(false); }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <button
            onClick={() => { setOpen(false); setEditorOpen(false); }}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <Field label="Provider">
            <select
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
            >
              <optgroup label="Providers">
                {builtInProviderList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              {customProviders.length > 0 && (
                <optgroup label="Custom Providers">
                  {customProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>

          {isCustom ? (
            <>
              {selectedCustom && (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3 text-xs text-[var(--color-muted)]">
                  Connected to <span className="font-medium text-[var(--color-fg)]">{selectedCustom.baseUrl || "no base URL"}</span>
                  {selectedCustom.models.filter((m) => m.trim()).length > 0 && (
                    <div className="mt-1.5">
                      Models:{" "}
                      <span className="text-[var(--color-fg)]">
                        {selectedCustom.models.filter((m) => m.trim()).join(", ")}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setEditorOpen(true)}
                    className="mt-2 flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                  >
                    <Plug className="h-3 w-3" /> Edit or add models
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label={`API key (${settings.provider})`}>
                <input
                  type="password"
                  value={currentKey}
                  onChange={(e) => setApiKey(settings.provider, e.target.value)}
                  placeholder="sk-…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                />
              </Field>

              <Field label="Base URL (optional override)">
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ baseUrl: e.target.value })}
                  placeholder={
                    currentProviderMeta?.defaultBaseUrl
                      ? `Default: ${currentProviderMeta.defaultBaseUrl}`
                      : "Leave empty to use the provider default"
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                />
              </Field>

              <Field label="Model">
                <div className="flex gap-2">
                  <select
                    value={settings.model}
                    onChange={(e) => setSettings({ model: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  >
                    {modelOptions.length === 0 ? (
                      <option value="">{settings.model || "Load models →"}</option>
                    ) : (
                      modelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={loadModels}
                    disabled={modelsLoading}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm transition hover:border-[var(--color-accent)]/50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", modelsLoading && "animate-spin")} />
                    Load
                  </button>
                </div>
              </Field>

              {settings.model && (
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings({ model: e.target.value })}
                  placeholder="Or type a model id manually"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-xs text-[var(--color-muted)] outline-none focus:border-[var(--color-accent)]/50"
                />
              )}
            </>
          )}

          {/* Custom provider management */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">Custom AI Providers</h3>
            </div>
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              Connect any OpenAI-compatible endpoint — provide a name, base URL, optional API key,
              one or more models, and optional custom headers. They appear in the provider dropdown
              above and stream exactly like built-in providers.
            </p>

            {customProviders.length > 0 && (
              <ul className="mb-3 space-y-2">
                {customProviders.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--color-fg)]">
                        {p.name || p.id}
                      </p>
                      <p className="truncate text-[11px] text-[var(--color-muted)]">
                        {p.baseUrl || "no base URL"} ·{" "}
                        {p.models.filter((m) => m.trim()).length} model(s)
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {settings.provider === p.id && (
                        <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                          Active
                        </span>
                      )}
                      <button
                        onClick={() => selectCustomProvider(p.id)}
                        className="px-1 py-1 text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                        title="Set as active provider"
                      >
                        <Plug className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCustomProvider(p.id)}
                        className="px-1 py-1 text-[var(--color-muted)] transition hover:text-red-300"
                        title="Delete provider"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setEditorOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
            >
              <Plus className="h-4 w-4" />
              Add Custom Provider
            </button>
          </div>

          {editorOpen && (
            <CustomProviderEditor
              existing={selectedCustom}
              onSaved={(created) => {
                selectCustomProvider(created.id);
                setEditorOpen(false);
              }}
              onClose={() => setEditorOpen(false)}
              onSave={(id, patch) => updateCustomProvider(id, patch)}
            />
          )}

          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold">Search & Fetch</h3>
            </div>
                <p className="mb-3 text-xs text-[var(--color-muted)]">
                  Keys for the agent's web tools — search the web and fetch page content at runtime.
                  The selected provider's key is used; if it has no key, any provider with a key is used.
                </p>

                <Field label="Search provider">
                  <select
                    value={settings.searchProvider ?? "tavily"}
                    onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  >
                    <option value="tavily">Tavily — fast AI-native search</option>
                    <option value="exa">Exa — neural web search</option>
                    <option value="serpapi">SerpAPI — Google results</option>
                  </select>
                </Field>

                <Field label="Tavily API key (web search)">
                  <input
                    type="password"
                    value={settings.tavilyApiKey}
                    onChange={(e) => setSearchApiKey("tavily", e.target.value)}
                    placeholder="tvly-…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  />
                </Field>

                <Field label="Exa API key (web search)">
                  <input
                    type="password"
                    value={settings.exaApiKey}
                    onChange={(e) => setSearchApiKey("exa", e.target.value)}
                    placeholder="exa-…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  />
                </Field>

                <Field label="SerpAPI API key (web search)">
                  <input
                    type="password"
                    value={settings.serpapiApiKey}
                    onChange={(e) => setSearchApiKey("serpapi", e.target.value)}
                    placeholder="SerpAPI key"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  />
                </Field>

                <Field label="Firecrawl API key (web fetch)">
                  <input
                    type="password"
                    value={settings.firecrawlApiKey}
                    onChange={(e) => setSearchApiKey("firecrawl", e.target.value)}
                    placeholder="fc-…"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                  />
                </Field>
              </div>

              <div className="border-t border-[var(--color-border)] pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-semibold">Sub-Agents</h3>
                </div>
                <p className="mb-3 text-xs text-[var(--color-muted)]">
                  Create specialized sub-agents the main agent can delegate work to for more accurate
                  results. Stored only in this browser.
                </p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setSubAgentsOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2.5 text-sm transition hover:border-[var(--color-accent)]/50"
                >
                  <span className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-[var(--color-accent)]" />
                    Manage sub-agents
                    <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {subAgentCount}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
                </button>
              </div>

          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={() => { setOpen(false); setEditorOpen(false); }}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  existing: { id: string; name: string; baseUrl: string; apiKey: string; headers: CustomHeader[]; models: string[] } | undefined;
  onSaved: (provider: { id: string }) => void;
  onClose: () => void;
  onSave: (id: string, patch: Partial<{ name: string; baseUrl: string; apiKey: string; headers: CustomHeader[]; models: string[] }>) => void;
}

function CustomProviderEditor({ existing, onSaved, onClose, onSave }: EditorProps) {
  const addCustomProvider = useStore((s) => s.addCustomProvider);
  const [name, setName] = useState(existing?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [models, setModels] = useState<string[]>(existing?.models.length ? existing.models : [""]);
  const [headers, setHeaders] = useState<CustomHeader[]>(existing?.headers.length ? existing.headers : []);
  const [error, setError] = useState<string | null>(null);

  function updateModel(index: number, value: string) {
    setModels((prev) => prev.map((m, i) => (i === index ? value : m)));
  }
  function addModel() {
    setModels((prev) => [...prev, ""]);
  }
  function removeModel(index: number) {
    setModels((prev) => prev.filter((_, i) => i !== index));
  }

  function updateHeader(index: number, patch: Partial<CustomHeader>) {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }
  function addHeader() {
    setHeaders((prev) => [...prev, { key: "", value: "" }]);
  }
  function removeHeader(index: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }

  const save = () => {
    const trimmedModels = models.map((m) => m.trim()).filter((m) => m.length > 0);
    if (!name.trim()) return setError("Provider Name is required.");
    if (!baseUrl.trim()) return setError("Base URL is required.");
    if (trimmedModels.length === 0) return setError("Add at least one Model Name / ID.");

    const cleanHeaders = headers
      .filter((h) => h.key.trim().length > 0)
      .map((h) => ({ key: h.key.trim(), value: h.value }));

    if (existing) {
      onSave(existing.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        apiKey: apiKey.trim(),
        models: trimmedModels,
        headers: cleanHeaders,
      });
      onSaved(existing);
    } else {
      const created = addCustomProvider({
        name: name.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        apiKey: apiKey.trim(),
        models: trimmedModels,
        headers: cleanHeaders,
      });
      onSaved(created);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-elev)] p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{existing ? "Edit Custom Provider" : "New Custom Provider"}</h4>
        <button onClick={onClose} className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Field label="Provider Name *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Local AI"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
        />
      </Field>

      <Field label="Base URL *">
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://example.com/v1"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
        />
        <span className="mt-1 block text-[10px] text-[var(--color-muted)]">
          OpenAI-compatible base URL. We append <code>/chat/completions</code> automatically and won't add /v1 if it's already present.
        </span>
      </Field>

      <Field label="API Key (optional)">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-… (leave empty for no auth)"
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
          Models (Model Name / ID) *
        </span>
        <div className="space-y-2">
          {models.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={m}
                onChange={(e) => updateModel(i, e.target.value)}
                placeholder="qwen/qwen3-30b"
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
              />
              <button
                onClick={() => removeModel(i)}
                disabled={models.length <= 1}
                className="shrink-0 px-1.5 py-1 text-[var(--color-muted)] transition hover:text-red-300 disabled:opacity-30"
                title="Remove model"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addModel}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
        >
          <Plus className="h-3 w-3" /> Add another model
        </button>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
          Custom Headers (optional)
        </span>
        {headers.length === 0 ? (
          <p className="mb-2 text-[11px] text-[var(--color-muted)]">
            No custom headers. These are sent with every request, e.g. <code>X-API-Key: abc123</code>.
          </p>
        ) : (
          <div className="space-y-2">
            {headers.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(i, { key: e.target.value })}
                  placeholder="X-API-Key"
                  className="w-1/2 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(i, { value: e.target.value })}
                  placeholder="value"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
                />
                <button
                  onClick={() => removeHeader(i)}
                  className="shrink-0 px-1.5 py-1 text-[var(--color-muted)] transition hover:text-red-300"
                  title="Remove header"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={addHeader}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
        >
          <Plus className="h-3 w-3" /> Add Header
        </button>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
        >
          <Check className="h-3.5 w-3.5" />
          {existing ? "Save & Connect" : "Connect"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}