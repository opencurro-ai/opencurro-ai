import { useMemo, useState } from "react";
import { ExternalLink, Globe, Loader2, RefreshCw, X } from "lucide-react";
import { useStore } from "@/store/useStore";

/**
 * Live browser preview panel. The embed_url tool opens it to render a public URL (a running app
 * frontend, website, audio/video, image, document, etc.) inside an embedded browser viewport.
 */
export function PreviewPanel() {
  const preview = useStore((s) => s.preview);
  const setPreviewOpen = useStore((s) => s.setPreviewOpen);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const url = useMemo(() => preview.url.trim(), [preview.url]);

  if (!preview.open) return null;

  const reload = () => {
    setLoading(true);
    setKey((k) => k + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setPreviewOpen(false)}
    >
      <div
        className="flex h-[90vh] w-[min(1100px,90vw)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] shadow-2xl fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <h2 className="shrink-0 text-sm font-semibold">Browser Preview</h2>
            <div className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev2)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
              {url || "No URL"}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={reload}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
              title="Reload"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => setPreviewOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-[var(--color-bg-elev2)] hover:text-[var(--color-fg)]"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-[var(--color-bg)]">
          {url ? (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-[var(--color-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent-2)]" />
                  <span className="text-xs">Loading preview…</span>
                </div>
              )}
              <iframe
                key={key}
                src={url}
                title="Browser preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
                referrerPolicy="no-referrer"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                className="h-full w-full border-0"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
              No URL to preview.
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-muted)]">
          Some sites block embedding in an iframe; if the preview stays blank, open it in a new
          tab with the external-link button above.
        </div>
      </div>
    </div>
  );
}