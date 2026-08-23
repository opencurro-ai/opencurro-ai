import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";
import { requireMemory, memoryFailure } from "./memory_list.js";

const schema = z
  .object({
    query: z.string().describe("The search query."),
  })
  .strict();

type MemorySearchArgs = z.infer<typeof schema>;

/**
 * memory_search — search persistent memory with a natural-language query and return ONLY the
 * locations of matches: the file paths and the 1-based line numbers where the query was found. It
 * intentionally does NOT return file contents — the agent follows up with memory_read at those exact
 * paths/lines to load what it needs.
 */
export const memorySearchTool = defineTool({
  name: "memory_search",
  description:
    "Search persistent memory using a natural-language query. Returns only the file paths where the " +
    "query was found and the line numbers where each match occurs (no file contents). Use " +
    "memory_read on those paths/lines to load the actual text.",
  schema,
  label: (args: MemorySearchArgs) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    return query ? `Memory: search "${query}"` : "Memory: search";
  },
  async execute(args: MemorySearchArgs, ctx: ToolContext): Promise<ToolResult> {
    const unavailable = requireMemory(ctx);
    if (unavailable) return unavailable;
    try {
      return ctx.memory!.search(args.query);
    } catch (error) {
      return memoryFailure(error);
    }
  },
});
