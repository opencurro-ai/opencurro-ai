/**
 * Dev console network instrumentation.
 *
 * `installFetchLogger()` wraps the global `fetch` exactly once so that EVERY HTTP request the app
 * makes — provider listing, model discovery, the SSE chat stream, file reads, scrapes, plan /
 * question decisions — is recorded into the dev-console event stream (`store.devLog`).
 *
 * It is deliberately non-invasive: it never reads a response body (which would consume the caller's
 * stream or JSON), it only records request metadata plus the response status and round-trip time.
 * The request body is captured from the outgoing init when it is a plain string, so the raw JSON the
 * app sent to the backend is fully inspectable.
 */
import { useStore } from "@/store/useStore";

let installed = false;

/** Best-effort parse of a request body string into JSON for pretty display; falls back to raw. */
function parseBody(body: unknown): unknown {
  if (typeof body !== "string" || body.length === 0) return undefined;
  // Cap extremely large bodies so a giant history payload never bloats the log store.
  const capped = body.length > 200_000 ? `${body.slice(0, 200_000)}… [truncated ${body.length} chars]` : body;
  try {
    return JSON.parse(capped);
  } catch {
    return capped;
  }
}

/** Extract method + URL from the many shapes fetch() accepts. */
function describeRequest(input: RequestInfo | URL, init?: RequestInit): { method: string; url: string; body: unknown } {
  let url = "";
  let method = init?.method ?? "GET";
  const body: unknown = init?.body;

  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    // Request object
    url = input.url;
    method = init?.method ?? input.method ?? "GET";
  }

  return { method: method.toUpperCase(), url, body: parseBody(body) };
}

/** True for the SSE chat stream endpoint, whose body must never be consumed by the logger. */
function isStreamUrl(url: string): boolean {
  return /\/api\/chat\/stream(\?|$)/.test(url);
}

export function installFetchLogger(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { method, url, body } = describeRequest(input, init);
    // Only instrument our own API traffic — ignore Vite HMR, source maps, etc.
    const isApi = /(^|\/)api\//.test(url) || url.includes("/api/");
    const started = Date.now();

    if (!isApi) return originalFetch(input, init);

    const streaming = isStreamUrl(url);
    try {
      const res = await originalFetch(input, init);
      useStore.getState().pushDevLog({
        kind: "http",
        level: res.ok ? "info" : "error",
        method,
        url,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - started,
        requestBody: body,
        streaming,
      });
      return res;
    } catch (error) {
      // A thrown fetch is almost always an abort (user pressed Stop) or a network failure.
      const aborted = error instanceof DOMException && error.name === "AbortError";
      useStore.getState().pushDevLog({
        kind: "http",
        level: aborted ? "info" : "error",
        method,
        url,
        ok: false,
        durationMs: Date.now() - started,
        requestBody: body,
        streaming,
        message: aborted ? "aborted" : error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/** Record an internal system note (info / warn / error) into the dev-console stream. */
export function logSystem(message: string, level: "info" | "warn" | "error" = "info"): void {
  useStore.getState().pushDevLog({ kind: "system", level, message });
}
