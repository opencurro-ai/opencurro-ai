import { API_ROUTES, routeUrl } from "@/app/api/routes";
import type { FileNode, ModelInfo, ProviderMeta, StreamRequest } from "@/types";

/**
 * Client API — every call goes to this app's own `/api/*` routes (defined in
 * `src/app/api/routes.ts`), which Vite proxies to the curro-ai backend. The browser
 * never talks to the backend directly, so `localhost` stays server-side.
 */

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchProviders(): Promise<ProviderMeta[]> {
  const data = await requestJson<{ providers?: ProviderMeta[] } | ProviderMeta[]>(
    routeUrl(API_ROUTES.providersList),
  );
  return Array.isArray(data) ? data : data.providers ?? [];
}

export async function fetchModels(
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<ModelInfo[]> {
  const data = await requestJson<{ models?: ModelInfo[] }>(
    routeUrl(API_ROUTES.providersModels),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl || undefined }),
    },
  );
  return data.models ?? [];
}

export async function fetchFileTree(path?: string): Promise<FileNode[]> {
  const data = await requestJson<{ tree?: FileNode[] }>(
    routeUrl(API_ROUTES.filesTree, { query: { path } }),
  );
  return data.tree ?? [];
}

export async function fetchFileContent(path: string): Promise<string> {
  const data = await requestJson<{ content?: string }>(
    routeUrl(API_ROUTES.filesRead, { query: { path } }),
  );
  return data.content ?? "";
}

export async function abortChat(chatId: string): Promise<void> {
  await fetch(routeUrl(API_ROUTES.chatAbort, { params: { chatId } }), { method: "POST" }).catch(
    () => {},
  );
}

export type PlanDecision = "approved" | "canceled" | "edited";

export interface QuestionAnswerPayload {
  question: string;
  answer: string;
}

/**
 * Submit the user's answers to a pending ask_question_to_user request. Returns false when the
 * backend reports the request is no longer pending (already answered, timed out, or unknown) —
 * the UI treats that as a no-op instead of an error.
 */
export async function submitAnswers(
  chatId: string,
  toolCallId: string,
  answers: QuestionAnswerPayload[],
): Promise<boolean> {
  try {
    const data = await requestJson<{ ok?: boolean }>(
      routeUrl(API_ROUTES.chatQuestionAnswer, { params: { chatId, toolCallId } }),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Submit the user's decision for a submitted plan. Returns false when the backend reports the
 * plan is no longer pending (already decided, timed out, or unknown) — the UI treats that as a
 * no-op instead of an error.
 */
export async function decidePlan(
  chatId: string,
  toolCallId: string,
  decision: PlanDecision,
  plan?: string,
): Promise<boolean> {
  try {
    const data = await requestJson<{ ok?: boolean }>(
      routeUrl(API_ROUTES.chatPlanDecision, { params: { chatId, toolCallId } }),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          plan: decision === "edited" ? plan : undefined,
        }),
      },
    );
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function streamChat(body: StreamRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(routeUrl(API_ROUTES.chatStream), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}
