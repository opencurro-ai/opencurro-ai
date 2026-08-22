import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { memoryTool } from "./memory.js";
import { createMemoryRuntime } from "../memory.js";
import type { MemoryFile, ToolContext } from "./types.js";

describe("memory tool", () => {
  const registry = new ToolRegistry().registerAll([memoryTool]);

  function ctxFor(initial: MemoryFile[] = []) {
    const runtime = createMemoryRuntime(initial);
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];
    const ctx: ToolContext = {
      workspaceRoot: "/workspace",
      shellTimeoutMs: 10_000,
      memory: runtime,
      emit: (event, data) => events.push({ event, data }),
    };
    return { ctx, events, runtime };
  }

  it("is registered and selectable by the LLM with the documented schema", () => {
    assert.ok(registry.has("memory"));
    const schema = registry.schemas.find((s) => s.function.name === "memory");
    assert.ok(schema, "memory must appear in the OpenAI tools array");
    const props = schema!.function.parameters.properties as Record<string, unknown>;
    assert.ok(props.operation && props.path && props.content && props.old_str && props.new_str);
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required, ["operation"]);
  });

  it("memory_list always includes the three pre-added files with their limits", async () => {
    const { ctx } = ctxFor();
    const result = await registry.execute("memory", { operation: "memory_list" }, ctx);
    assert.equal(result.ok, true);
    const data = result.data as { count: number; files: Array<{ path: string; char_limit?: number; preadded: boolean }> };
    const byPath = Object.fromEntries(data.files.map((f) => [f.path, f]));
    assert.ok(byPath["MEMORY.md"] && byPath["SOUL.md"] && byPath["USER.md"]);
    assert.equal(byPath["MEMORY.md"]!.char_limit, 8000);
    assert.equal(byPath["SOUL.md"]!.char_limit, 2000);
    assert.equal(byPath["USER.md"]!.char_limit, 2000);
    assert.equal(byPath["MEMORY.md"]!.preadded, true);
  });

  it("writes a memory file, emits memory_updated, and reads it back", async () => {
    const { ctx, events } = ctxFor();
    const write = await registry.execute(
      "memory",
      { operation: "memory_write", path: "USER.md", content: "Name: Ada" },
      ctx,
    );
    assert.equal(write.ok, true);
    assert.equal(events.at(-1)!.event, "memory_updated");

    const read = await registry.execute("memory", { operation: "memory_read", path: "USER.md" }, ctx);
    assert.equal(read.ok, true);
    assert.equal((read.data as { content: string }).content, "Name: Ada");
  });

  it("canonicalizes pre-added file case (memory.md -> MEMORY.md)", async () => {
    const { ctx } = ctxFor();
    const write = await registry.execute(
      "memory",
      { operation: "memory_write", path: "/memory/memory.md", content: "hi" },
      ctx,
    );
    assert.equal((write.data as { path: string }).path, "MEMORY.md");
  });

  it("creates custom nested files with no char limit", async () => {
    const { ctx } = ctxFor();
    const big = "x".repeat(20_000);
    const write = await registry.execute(
      "memory",
      { operation: "memory_write", path: "projects/app.md", content: big },
      ctx,
    );
    assert.equal(write.ok, true);
    assert.equal((write.data as { char_limit?: number }).char_limit, undefined);
  });

  it("rejects a write that exceeds a pre-added file's char limit without applying it", async () => {
    const { ctx } = ctxFor();
    const tooBig = "a".repeat(2001);
    const result = await registry.execute(
      "memory",
      { operation: "memory_write", path: "SOUL.md", content: tooBig },
      ctx,
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "memory_char_limit_exceeded");
    assert.equal((result.error as { over_by: number }).over_by, 1);

    // The file must remain unchanged (empty).
    const read = await registry.execute("memory", { operation: "memory_read", path: "SOUL.md" }, ctx);
    assert.equal((read.data as { content: string }).content, "");
  });

  it("rejects an edit that would push the file over its limit", async () => {
    const { ctx } = ctxFor([{ path: "SOUL.md", content: "a".repeat(1990) }]);
    const result = await registry.execute(
      "memory",
      { operation: "memory_edit", path: "SOUL.md", old_str: "a".repeat(1990), new_str: "b".repeat(2001) },
      ctx,
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "memory_char_limit_exceeded");
  });

  it("edits with exact match and errors clearly on not-found / not-unique", async () => {
    const { ctx } = ctxFor([{ path: "MEMORY.md", content: "one two two" }]);
    const notFound = await registry.execute(
      "memory",
      { operation: "memory_edit", path: "MEMORY.md", old_str: "three", new_str: "x" },
      ctx,
    );
    assert.equal((notFound.error as { code: string }).code, "memory_old_str_not_found");

    const notUnique = await registry.execute(
      "memory",
      { operation: "memory_edit", path: "MEMORY.md", old_str: "two", new_str: "x" },
      ctx,
    );
    assert.equal((notUnique.error as { code: string }).code, "memory_old_str_not_unique");

    const ok = await registry.execute(
      "memory",
      { operation: "memory_edit", path: "MEMORY.md", old_str: "one", new_str: "1" },
      ctx,
    );
    assert.equal(ok.ok, true);
    assert.equal((ok.data as { chars: number }).chars, "1 two two".length);
  });

  it("reading an over-limit file works without error", async () => {
    // Simulates a legacy/over-limit file arriving from the browser; reads must never fail.
    const { ctx } = ctxFor([{ path: "SOUL.md", content: "z".repeat(5000) }]);
    const read = await registry.execute("memory", { operation: "memory_read", path: "SOUL.md" }, ctx);
    assert.equal(read.ok, true);
    assert.equal((read.data as { content: string }).content.length, 5000);
  });

  it("refuses to delete a pre-added file with a structured error, but deletes custom files", async () => {
    const { ctx } = ctxFor([{ path: "notes.md", content: "temp" }]);
    const forbidden = await registry.execute(
      "memory",
      { operation: "memory_delete", path: "MEMORY.md" },
      ctx,
    );
    assert.equal(forbidden.ok, false);
    assert.equal((forbidden.error as { code: string }).code, "memory_delete_forbidden");

    const deleted = await registry.execute("memory", { operation: "memory_delete", path: "notes.md" }, ctx);
    assert.equal(deleted.ok, true);
    const list = await registry.execute("memory", { operation: "memory_list" }, ctx);
    const paths = (list.data as { files: Array<{ path: string }> }).files.map((f) => f.path);
    assert.ok(!paths.includes("notes.md"));
  });

  it("returns a structured not-found error listing available paths", async () => {
    const { ctx } = ctxFor();
    const result = await registry.execute("memory", { operation: "memory_read", path: "ghost.md" }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "memory_not_found");
    assert.ok(Array.isArray((result.error as { available_paths: string[] }).available_paths));
  });

  it("rejects path traversal", async () => {
    const { ctx } = ctxFor();
    const result = await registry.execute(
      "memory",
      { operation: "memory_read", path: "../secrets.md" },
      ctx,
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "memory_invalid_path");
  });

  it("requires the fields each operation needs", async () => {
    const { ctx } = ctxFor();
    const noPath = await registry.execute("memory", { operation: "memory_read" }, ctx);
    assert.equal((noPath.error as { code: string }).code, "memory_missing_field");
    const noContent = await registry.execute("memory", { operation: "memory_write", path: "x.md" }, ctx);
    assert.equal((noContent.error as { code: string }).code, "memory_missing_field");
  });

  it("firstMessageContext contains the three pre-added files only", () => {
    const { runtime } = ctxFor([
      { path: "USER.md", content: "Ada" },
      { path: "projects/app.md", content: "should not appear" },
    ]);
    const ctxBlock = runtime.firstMessageContext();
    assert.ok(ctxBlock.includes("## MEMORY.md"));
    assert.ok(ctxBlock.includes("## SOUL.md"));
    assert.ok(ctxBlock.includes("## USER.md"));
    assert.ok(ctxBlock.includes("Ada"));
    assert.ok(!ctxBlock.includes("should not appear"));
  });

  it("errors when the memory runtime is absent (e.g. sub-agent context)", async () => {
    const ctx: ToolContext = { workspaceRoot: "/workspace", shellTimeoutMs: 10_000 };
    const result = await registry.execute("memory", { operation: "memory_list" }, ctx);
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "memory_unavailable");
  });

  it("exposes a clear UI label", () => {
    assert.equal(memoryTool.label({ operation: "memory_list" }), "Memory: list");
    assert.equal(
      memoryTool.label({ operation: "memory_write", path: "USER.md" }),
      "Memory: write USER.md",
    );
  });
});
