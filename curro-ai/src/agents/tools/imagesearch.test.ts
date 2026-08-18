import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_SEARCH_PROVIDER_SERPAPI } from "./imagesearch.js";
import { createToolRegistry, webSearchTool } from "./index.js";
import type { ToolContext } from "./types.js";

function baseCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, ...overrides };
}

interface CallLog {
  url: string;
  init?: RequestInit;
}

describe("image_search tool", () => {
  let registry: ReturnType<typeof createToolRegistry>;

  before(() => {
    registry = createToolRegistry();
  });

  after(() => {
    mock.restoreAll();
  });

  it("is registered in the default tool registry and discoverable by the LLM", () => {
    assert.equal(registry.has("image_search"), true);
    const schemas = registry.schemas;
    const schema = schemas.find((s) => s.function.name === "image_search");
    assert.ok(schema, "image_search schema missing from registry");
    assert.equal(schema!.type, "function");
    assert.equal(schema!.function.name, "image_search");
    assert.match(schema!.function.description, /image/i);
    const params = schema!.function.parameters as Record<string, unknown>;
    assert.equal(params.type, "object");
    const properties = params.properties as Record<string, unknown>;
    assert.ok(properties.query, "query property missing");
    assert.equal((params.required as string[]).includes("query"), true);
    assert.equal((params.additionalProperties ?? true), false);
  });

  it("keeps web_search alongside image_search without clobbering it", () => {
    assert.equal(registry.has("web_search"), true);
    assert.equal(registry.get("web_search"), webSearchTool);
  });

  it("rejects an empty query with a structured error (no crash)", async () => {
    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "k" } });
    const result = await registry.execute("image_search", { query: "   " }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "missing_query");
  });

  it("rejects a missing query argument via zod safely (invalid_arguments)", async () => {
    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "k" } });
    const result = await registry.execute("image_search", {}, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("rejects extra properties because the schema is strict", async () => {
    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "k" } });
    const result = await registry.execute(
      "image_search",
      { query: "cats", bogus_param: true },
      ctx,
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("returns a structured missing_api_key error when no SerpAPI key is configured", async () => {
    const ctx = baseCtx({ web: { searchProvider: "serpapi" } });
    const result = await registry.execute("image_search", { query: "dogs" }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "missing_api_key");
    const err = result.error as { provider?: string };
    assert.equal(err.provider, IMAGE_SEARCH_PROVIDER_SERPAPI);
  });

  it("performs a live image search and returns real direct image URLs", async () => {
    const calls: CallLog[] = [];
    const title = "A Cute Cat";
    const link = "https://example.com/cat-page";
    const original = "https://cdn.example.com/images/cat.jpg";

    mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const body = JSON.stringify({
        images_results: [
          { title, link, original },
          { title: "Thumbnail Only", link: "https://example.com/t", thumbnail: "https://cdn.example.com/t.webp" },
          { title: "No Image", link: "https://example.com/no-image" },
        ],
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "test-key" } });
    const result = await registry.execute("image_search", { query: "cute cat images" }, ctx);

    assert.equal(result.ok, true, JSON.stringify(result.error));
    const data = result.data as {
      query: string;
      provider: string;
      result_count: number;
      results: Array<{ title?: string; image_url?: string; source_url?: string }>;
    };
    assert.equal(data.query, "cute cat images");
    assert.equal(data.provider, IMAGE_SEARCH_PROVIDER_SERPAPI);
    assert.equal(data.result_count, 2); // the "No Image" result is filtered out
    assert.equal(data.results.length, 2);

    assert.equal(data.results[0].title, title);
    assert.equal(data.results[0].image_url, original);
    assert.equal(data.results[0].source_url, link);

    assert.equal(data.results[1].image_url, "https://cdn.example.com/t.webp");

    assert.equal(calls.length, 1);
    const parsed = new URL(calls[0]!.url);
    assert.equal(parsed.searchParams.get("engine"), "google_images");
    assert.equal(parsed.searchParams.get("q"), "cute cat images");
    assert.equal(parsed.searchParams.get("api_key"), "test-key");

    mock.restoreAll();
  });

  it("returns a structured tool error on API/network failure instead of crashing", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNRESET");
    });

    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "k" } });
    const result = await registry.execute("image_search", { query: "landscapes" }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "image_search_failed");
    assert.match((result.error as { message: string }).message, /ECONNRESET/);
    mock.restoreAll();
  });

  it("returns a structured tool error when the provider responds with a non-2xx status", async () => {
    mock.method(globalThis, "fetch", async () => {
      return new Response("invalid key", { status: 401 });
    });

    const ctx = baseCtx({ web: { searchProvider: "serpapi", serpapiApiKey: "bad" } });
    const result = await registry.execute("image_search", { query: "cats" }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "image_search_failed");
    assert.match((result.error as { message: string }).message, /401/);
    mock.restoreAll();
  });

  it("never throws and always returns a structured result", async () => {
    for (const args of [{ query: "a" }, {}, { query: "" }]) {
      const ctx = baseCtx({ web: { searchProvider: "serpapi" } });
      const result = await registry.execute("image_search", args, ctx);
      assert.equal(typeof result.ok, "boolean");
      if (!result.ok) assert.ok(result.error);
    }
  });
});