import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";
import { scrapePage } from "../../scraper/scraper.js";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONTENT_CHARS = 200_000;

const schema = z.object({
  url: z.string().describe("The URL to fetch"),
});

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

/** Fetch a page through the free Firecrawl API (requires an API key). */
async function scrapeWithFirecrawl(url: string, apiKey: string, ctx: ToolContext) {
  const { signal, cleanup } = timeoutSignal(ctx);
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
      signal,
    });
    const text = await response.text();
    const data = JSON.parse(text || "{}") as {
      success?: boolean;
      data?: { markdown?: string | null; rawHtml?: string | null; url?: string | null };
    };
    if (!response.ok || data.success === false) {
      return { ok: false, error: { code: "fetch_failed", message: `Firecrawl HTTP ${response.status}: ${text.slice(0, 500)}`, url } };
    }
    const content = data.data?.markdown ?? data.data?.rawHtml ?? "";
    return { ok: true, data: { provider: "firecrawl", url: data.data?.url ?? url, content: truncate(content) } };
  } catch (error) {
    return { ok: false, error: { code: "fetch_failed", message: error instanceof Error ? error.message : String(error), url } };
  } finally {
    cleanup();
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS) + `\n... [truncated ${text.length - MAX_CONTENT_CHARS} chars]`;
}

export const fetchWebUrlsTool = defineTool({
  name: "fatch_web_urls",
  description:
    "Fetch and extract clean content from a single URL. Uses the built-in free " +
    "scraper by default (no API key needed), or Firecrawl when configured. " +
    "Use this to get the full content of a webpage beyond search snippets.",
  schema,
  label: (args) => `Fetch: ${args.url}`,
  async execute(args, ctx): Promise<ToolResult> {
    const url = args.url.trim();
    if (!url) {
      return { ok: false, error: { code: "missing_url", message: "No URL provided." } };
    }

    const apiKey = ctx.web?.firecrawlApiKey;
    const fetchProvider: "builtin" | "firecrawl" = ctx.web?.fetchProvider ?? "builtin";

    // Use Firecrawl only when explicitly selected AND a key is configured;
    // otherwise always fall back to the free built-in scraper.
    if (fetchProvider === "firecrawl" && apiKey) {
      const res = await scrapeWithFirecrawl(url, apiKey, ctx);
      if (res.ok) return res as ToolResult;
    }

    try {
      const result = await scrapePage({
        url,
        format: "markdown",
        maxChars: MAX_CONTENT_CHARS,
        signal: ctx.signal,
      });
      return {
        ok: true,
        data: {
          provider: "builtin",
          url: result.url,
          title: result.title,
          description: result.description,
          content: truncate(result.content),
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "fetch_failed",
          message: error instanceof Error ? error.message : String(error),
          url,
        },
      };
    }
  },
});