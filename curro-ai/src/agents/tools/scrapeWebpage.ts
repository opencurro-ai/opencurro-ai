import { z } from "zod";
import { defineTool, type ToolResult } from "./types.js";
import { scrapePage, crawlSite } from "../../scraper/scraper.js";

const MAX_CRAWL_PAGES = 10;
const MAX_CRAWL_DEPTH = 3;
const MAX_CONTENT_CHARS = 200_000;

const schema = z
  .object({
    url: z.string().describe("The URL to scrape."),
    format: z
      .enum(["markdown", "text", "json", "autodetect"])
      .default("markdown")
      .describe("Output format for the extracted content (default markdown)."),
    crawl: z
      .boolean()
      .default(false)
      .describe("When true, crawl linked pages on the same site (bounded, default false)."),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(MAX_CRAWL_PAGES)
      .default(6)
      .describe("Max pages to fetch when crawling. Ignored unless crawl is true."),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(MAX_CRAWL_DEPTH)
      .default(2)
      .describe("Max link depth when crawling. Ignored unless crawl is true."),
    extractImages: z
      .boolean()
      .default(true)
      .describe("Include extracted image URLs in the result (HTML pages)."),
    extractLinks: z
      .boolean()
      .default(true)
      .describe("Include extracted link URLs in the result (HTML pages)."),
  })
  .strict();

function truncate(text: string, max = MAX_CONTENT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... [truncated ${text.length - max} chars]`;
}

export const scrapeWebpageTool = defineTool({
  name: "scrape_webpage",
  description:
    "Scrape a webpage (or crawl a site) using the built-in free scraper. " +
    "Returns clean readable content (Markdown/text/JSON) plus page title, description, " +
    "language, images, and links. No API key needed. For deep research set crawl=true " +
    "to also fetch linked pages on the same site (bounded by maxPages/maxDepth).",
  schema,
  label: (args) => (args.crawl ? `Crawl: ${args.url}` : `Scrape: ${args.url}`),
  async execute(args, ctx): Promise<ToolResult> {
    const url = args.url.trim();
    if (!url) {
      return { ok: false, error: { code: "missing_url", message: "No URL provided." } };
    }

    try {
      if (args.crawl) {
        const pages = await crawlSite({
          seedUrl: url,
          maxPages: args.maxPages,
          depth: args.maxDepth,
          sameOrigin: true,
          signal: ctx.signal,
          maxChars: MAX_CONTENT_CHARS,
        });
        return {
          ok: true,
          data: {
            provider: "builtin",
            mode: "crawl",
            url,
            page_count: pages.length,
            pages: pages.map((page) => ({
              url: page.url,
              status: page.status,
              title: page.title,
              description: page.description,
              lang: page.lang,
              content: truncate(page.content),
              links: args.extractLinks ? page.links.slice(0, 200) : undefined,
              images: args.extractImages ? page.images.slice(0, 200) : undefined,
            })),
          },
        };
      }

      const result = await scrapePage({
        url,
        format: args.format,
        maxChars: MAX_CONTENT_CHARS,
        signal: ctx.signal,
      });

      return {
        ok: true,
        data: {
          provider: "builtin",
          mode: "single",
          url: result.url,
          status: result.status,
          format: result.format,
          title: result.title,
          description: result.description,
          lang: result.lang,
          canonical_url: result.canonical_url,
          content: truncate(result.content),
          links: args.extractLinks ? result.links.slice(0, 200) : undefined,
          images: args.extractImages ? result.images.slice(0, 200) : undefined,
          metadata: result.metadata,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "scrape_failed",
          message: error instanceof Error ? error.message : String(error),
          url,
        },
      };
    }
  },
});