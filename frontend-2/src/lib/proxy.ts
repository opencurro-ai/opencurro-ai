// Server-only helpers that proxy requests from the browser to the curro-ai backend.
// Runs on the Next.js server, so it can reach the backend over localhost.

export function backendUrl(path: string): string {
  const base = (process.env.CURRO_API_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Proxy a JSON GET/POST and return the backend's JSON response verbatim. */
export async function proxyJson(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  try {
    const res = await fetch(backendUrl(path), {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (error) {
    return Response.json(
      { error: `Cannot reach curro-ai backend: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
