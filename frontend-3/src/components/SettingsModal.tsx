import { useEffect, useState } from "react";
import { X, KeyRound, RefreshCw, Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchModels, fetchProviders } from "@/lib/api";
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

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && providers.length === 0) {
      fetchProviders().then(setProviders).catch(() => {});
    }
  }, [open, providers.length, setProviders]);

  if (!open) return null;

  const currentKey = settings.apiKeys[settings.provider] ?? "";

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-20 backdrop-blur-sm"
      onClick={() => setOpen(false)}
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
            onClick={() => setOpen(false)}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Field label="Provider">
            <select
              value={settings.provider}
              onChange={(e) => {
                setSettings({ provider: e.target.value, model: "" });
                setModels([]);
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]/50"
            >
              {(providers.length > 0
                ? providers
                : [
                    { id: "openrouter", label: "OpenRouter", defaultBaseUrl: "" },
                    { id: "groq", label: "Groq", defaultBaseUrl: "" },
                    { id: "nvidia", label: "NVIDIA NIM", defaultBaseUrl: "" },
                  ]
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

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
              placeholder="Leave empty to use the provider default"
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
                {models.length === 0 ? (
                  <option value="">{settings.model || "Load models →"}</option>
                ) : (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
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

          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button
            onClick={() => setOpen(false)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}
