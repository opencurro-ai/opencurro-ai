import { z } from "zod";
import { defineTool, type SearchProvider, type ToolContext, type ToolResult } from "./types.js";

const MAX_SEARCH_RESULTS = 15;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_DESCRIPTION_WORDS = 150;
const TRUNCATION_MARKER = "........";

export const SEARCH_PROVIDER_TAVILY = "tavily";
export const SEARCH_PROVIDER_EXA = "exa";
export const SEARCH_PROVIDER_SERPAPI = "serpapi";
export const SEARCH_PROVIDERS: readonly SearchProvider[] = [
  SEARCH_PROVIDER_TAVILY,
  SEARCH_PROVIDER_EXA,
  SEARCH_PROVIDER_SERPAPI,
] as const;

const schema = z.object({
  query: z.string().describe("The search query"),
});

interface SearchResult {
  title: string;
  url: string;
  Description: string;
}

/**
 * Clean excessive whitespace, then enforce a hard word limit on result text.
 * Returns text of up to `maxWords` words; longer text is cut to the first
 * `maxWords` words followed by the truncation marker. Empty/null-safe.
 */
function truncateDescription(text: string, maxWords = MAX_DESCRIPTION_WORDS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(" ")} ${TRUNCATION_MARKER}`;
}

function timeoutSignal(ctx: ToolContext): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  ctx.signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function fetchJson(url: string, init: RequestInit, ctx: ToolContext): Promise<unknown> {
  const { signal, cleanup } = timeoutSignal(ctx);
  try {
    const response = await fetch(url, { ...init, signal });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
    }
    return body;
  } finally {
    cleanup();
  }
}

async function searchTavily(query: string, apiKey: string, ctx: ToolContext): Promise<SearchResult[]> {
  const data = (await fetchJson(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: MAX_SEARCH_RESULTS }),
    },
    ctx,
  )) as { results?: Array<{ title?: string; url?: string; content?: string; description?: string }> };

  return (data.results ?? []).slice(0, MAX_SEARCH_RESULTS).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    Description: truncateDescription(item.content ?? item.description ?? ""),
  }));
}

async function searchExa(query: string, apiKey: string, ctx: ToolContext): Promise<SearchResult[]> {
  const data = (await fetchJson(
    "https://api.exa.ai/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        numResults: MAX_SEARCH_RESULTS,
        contents: { highlights: true },
      }),
    },
    ctx,
  )) as {
    results?: Array<{
      title?: string;
      url?: string;
      highlights?: string[];
      text?: string;
    }>;
  };

  return (data.results ?? []).slice(0, MAX_SEARCH_RESULTS).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    Description: truncateDescription(
      item.highlights && item.highlights.length > 0
        ? item.highlights.join(" ")
        : item.text ?? "",
    ),
  }));
}

async function searchSerpApi(query: string, apiKey: string, ctx: ToolContext): Promise<SearchResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("engine", "google");
  url.searchParams.set("num", String(MAX_SEARCH_RESULTS));

  const data = (await fetchJson(url.toString(), { method: "GET" }, ctx)) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic_results ?? []).slice(0, MAX_SEARCH_RESULTS).map((item) => ({
    title: item.title ?? "",
    url: item.link ?? "",
    Description: truncateDescription(item.snippet ?? ""),
  }));
}

export const webSearchTool = defineTool({
  name: "web_search",
  description:
    "Search the web for up-to-date information, news, and general knowledge. " +
    "Returns up to 15 results with titles, URLs, and descriptions.",
  schema,
  label: (args) => `Web Search: ${args.query}`,
  async execute(args, ctx): Promise<ToolResult> {
    const query = args.query.trim();
    if (!query) {
      return { ok: false, error: { code: "missing_query", message: "No search query provided." } };
    }

    const keys: Record<SearchProvider, string | undefined> = {
      [SEARCH_PROVIDER_TAVILY]: ctx.web?.tavilyApiKey,
      [SEARCH_PROVIDER_EXA]: ctx.web?.exaApiKey,
      [SEARCH_PROVIDER_SERPAPI]: ctx.web?.serpapiApiKey,
    };

    // Use the selected provider when its key is set; otherwise fall back to the
    // first provider that has a key so a stale/missing selection never breaks search.
    const selected: SearchProvider = ctx.web?.searchProvider ?? SEARCH_PROVIDER_TAVILY;
    const provider: SearchProvider = keys[selected]
      ? selected
      : (SEARCH_PROVIDERS.find((p) => keys[p]) ?? SEARCH_PROVIDER_TAVILY);
    const apiKey = keys[provider];

    if (!apiKey) {
      return {
        ok: false,
        error: {
          code: "missing_api_key",
          message:
            `No search API key configured for ${provider}. ` +
            "Add a key for Tavily, Exa or SerpAPI in Settings.",
        },
      };
    }

    try {
      const results =
        provider === SEARCH_PROVIDER_EXA
          ? await searchExa(query, apiKey, ctx)
          : provider === SEARCH_PROVIDER_SERPAPI
            ? await searchSerpApi(query, apiKey, ctx)
            : await searchTavily(query, apiKey, ctx);

      return {
        ok: true,
        data: {
          query,
          provider,
          results,
          result_count: results.length,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "web_search_failed",
          provider,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
});