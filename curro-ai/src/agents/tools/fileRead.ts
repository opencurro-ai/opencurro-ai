import fs from "node:fs/promises";
import { z } from "zod";
import { defineTool, type ToolResult } from "./types.js";
import { safeResolve, toWorkspaceRelative } from "../../utils/paths.js";

const schema = z.object({
  file_path: z
    .string()
    .describe("Path to the file to read, relative to the workspace root (e.g. src/index.ts)."),
});

export const fileReadTool = defineTool({
  name: "file_read",
  description:
    "Read the full contents of an existing file inside the workspace. Returns the raw text content.",
  schema,
  label: (args) => `Read: ${args.file_path}`,
  async execute(args, ctx): Promise<ToolResult> {
    try {
      const absolute = safeResolve(ctx.workspaceRoot, args.file_path);
      const content = await fs.readFile(absolute, "utf8");
      return {
        ok: true,
        data: {
          file_path: toWorkspaceRelative(ctx.workspaceRoot, absolute),
          content,
          line_count: content.length === 0 ? 0 : content.split("\n").length,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "file_read_failed",
          message: error instanceof Error ? error.message : String(error),
          file_path: args.file_path,
        },
      };
    }
  },
});
