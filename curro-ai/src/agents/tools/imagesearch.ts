import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

/**
 * Live image search implemented on top of the existing SerpAPI integration (Google Images
 * engine). It reuses the project's existing search provider configuration (ctx.web.serpapiApiKey)
 * and returns each result's real, direct image URL plus the source page when available.
 * See https://serpapi.com/google-images-results for the response shape.
 */

const MAX_IMAGE_RESULTS = 20;
const REQUEST_TIMEOUT_MS = 30_000;

export const IMAGE_SEARCH_PROVIDER_SERPAPI = "serpapi";

const schema = z
  .object({
    query: z.string().min(1).describe("The search query used to find relevant images."),
  })
  .strict();

interface ImageSearchResult {
  title?: string;
  image_url: string;
  source_url?: string;
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

interface SerpApiImageItem {
  title?: string;
  link?: string;
  original?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
}

/**
 * Run a live Google Images search through SerpAPI and return up to MAX_IMAGE_RESULTS images.
 * Only results that expose a usable direct image URL are kept.
 */
async function searchSerpApiImages(
  query: string,
  apiKey: string,
  ctx: ToolContext,
): Promise<ImageSearchResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(MAX_IMAGE_RESULTS));

  const { signal, cleanup } = timeoutSignal(ctx);
  try {
    const response = await fetch(url.toString(), { method: "GET", signal });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
    }

    const items = (data as { images_results?: SerpApiImageItem[] }).images_results ?? [];
    return items
      .slice(0, MAX_IMAGE_RESULTS)
      .map((item) => {
        const imageUrl = item.original ?? item.thumbnail ?? item.thumbnails?.[0]?.url ?? "";
        return {
          title: item.title,
          image_url: imageUrl,
          source_url: item.link,
        };
      })
      .filter((result) => Boolean(result.image_url))
      .slice(0, MAX_IMAGE_RESULTS);
  } finally {
    cleanup();
  }
}

export const imageSearchTool = defineTool({
  name: "image_search",
  description:
    "Search the web for images using a search query. The tool performs a live image search " +
    "and returns image results with direct live image URLs and source URLs. Use this tool " +
    "whenever the agent needs to find images or visual references.",
  schema,
  label: (args) => `Image Search: ${args.query}`,
  async execute(args, ctx): Promise<ToolResult> {
    const query = args.query.trim();
    if (!query) {
      return {
        ok: false,
        error: { code: "missing_query", message: "No search query provided." },
      };
    }

    const apiKey = ctx.web?.serpapiApiKey;
    if (!apiKey) {
      return {
        ok: false,
        error: {
          code: "missing_api_key",
          message:
            "No SerpAPI key configured for image search. " +
            "This tool reuses the existing SerpAPI integration (Google Images engine); " +
            "add a SerpAPI key in Settings.",
          provider: IMAGE_SEARCH_PROVIDER_SERPAPI,
        },
      };
    }

    try {
      const results = await searchSerpApiImages(query, apiKey, ctx);
      return {
        ok: true,
        data: {
          query,
          provider: IMAGE_SEARCH_PROVIDER_SERPAPI,
          result_count: results.length,
          results,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "image_search_failed",
          provider: IMAGE_SEARCH_PROVIDER_SERPAPI,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
});