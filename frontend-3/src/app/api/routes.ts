/**
 * API routes — the single source of truth for every `/api/*` endpoint the frontend
 * calls. In the browser these same-origin routes are served by Vite's dev/preview
 * proxy, which forwards them to the curro-ai backend (see `vite.config.ts`).
 *
 * This mirrors the Next.js App Router `src/app/api/<route>/route.ts` layout that
 * `frontend-2` used, expressed as a typed registry for the Vite/React app.
 */

export type HttpMethod = "GET" | "POST";

export interface ApiRoute {
  /** Logical name used by the client (e.g. `chat.stream`). */
  name: string;
  method: HttpMethod;
  /** Path template, e.g. `/api/chat/abort/:chatId`. `:name` segments become params. */
  path: string;
  /** Description of the backend endpoint this route proxies to. */
  description: string;
}

export const API_ROUTES = {
  providersList: {
    name: "providers.list",
    method: "GET",
    path: "/api/providers",
    description: "List the configured LLM providers.",
  },
  providersModels: {
    name: "providers.models",
    method: "POST",
    path: "/api/providers/models",
    description: "Fetch the models available for a provider given its API key.",
  },
  chatStream: {
    name: "chat.stream",
    method: "POST",
    path: "/api/chat/stream",
    description: "Start a turn (or reconnect to an in-flight turn) and stream SSE.",
  },
  chatAbort: {
    name: "chat.abort",
    method: "POST",
    path: "/api/chat/abort/:chatId",
    description: "Cancel the running turn for a chat session.",
  },
  chatPlanDecision: {
    name: "chat.plan.decision",
    method: "POST",
    path: "/api/chat/plan/:chatId/:toolCallId",
    description: "Submit the user's decision (approve / cancel / edited) for a submitted plan.",
  },
  filesTree: {
    name: "files.tree",
    method: "GET",
    path: "/api/files/tree",
    description: "Read the workspace file tree (bounded) for the explorer.",
  },
  filesRead: {
    name: "files.read",
    method: "GET",
    path: "/api/files/read",
    description: "Read a single workspace file's contents.",
  },
} as const satisfies Record<string, ApiRoute>;

export type ApiRouteName = keyof typeof API_ROUTES;

/** Fill `:param` segments of a route path and append an optional query string. */
export function routeUrl(
  route: ApiRoute,
  options?: { params?: Record<string, string>; query?: Record<string, string | number | undefined> },
): string {
  let path: string = route.path;
  for (const [key, value] of Object.entries(options?.params ?? {})) {
    path = path.replaceAll(`:${key}`, encodeURIComponent(value));
  }

  const query = options?.query;
  if (query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    if (qs) path += `?${qs}`;
  }
  return path;
}
