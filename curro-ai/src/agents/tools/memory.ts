import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";
import { MEMORY_ROOT } from "../memory.js";

/** The five operations the single `memory` tool multiplexes over. */
export const MEMORY_OPERATIONS = [
  "memory_list",
  "memory_write",
  "memory_edit",
  "memory_read",
  "memory_delete",
] as const;

const schema = z
  .object({
    operation: z
      .enum(MEMORY_OPERATIONS)
      .describe(
        "Choose the memory operation that matches the task. Use memory_list to discover available " +
          "memories, memory_read to retrieve existing information, memory_write to create or " +
          "completely replace a memory file, memory_edit to make a precise change to existing " +
          "memory, and memory_delete to permanently remove a memory file.",
      ),
    path: z
      .string()
      .optional()
      .describe(
        "Path of the memory file relative to the memory directory (e.g. \"MEMORY.md\" or " +
          "\"projects/app.md\"). Always use the exact path returned by memory_list when operating on " +
          "an existing memory. Required for memory_read, memory_write, memory_edit, and " +
          "memory_delete. Do not use paths outside the memory directory.",
      ),
    content: z
      .string()
      .optional()
      .describe(
        "Complete memory content to store in the specified file. Use this when creating a new " +
          "memory or intentionally replacing the entire contents of an existing memory. Keep the " +
          "stored information clear, factual, and useful for future agent runs. Used only by " +
          "memory_write.",
      ),
    old_str: z
      .string()
      .optional()
      .describe(
        "The exact text currently present in the memory file that should be replaced. The text " +
          "must match exactly, including spacing and line breaks. Use memory_edit for targeted " +
          "changes instead of rewriting the entire file. If the exact text is not found or appears " +
          "more than once, do not guess; adjust the target and try again.",
      ),
    new_str: z
      .string()
      .optional()
      .describe(
        "The new text that should replace old_str in the memory file. Preserve the surrounding " +
          "memory structure and only change the information that needs to be updated. Used only by " +
          "memory_edit.",
      ),
  })
  .strict();

type MemoryArgs = z.infer<typeof schema>;

/** Short, human-friendly UI label for the tool chip, tolerant of partial args. */
function memoryLabel(args: MemoryArgs): string {
  const op = args.operation;
  const short = op ? op.replace(/^memory_/, "") : "memory";
  const pretty = short.charAt(0).toUpperCase() + short.slice(1);
  if (op === "memory_list") return "Memory: list";
  const path = typeof args.path === "string" && args.path.trim().length > 0 ? args.path.trim() : "";
  return path ? `Memory: ${short} ${path}` : `Memory: ${pretty}`;
}

/**
 * Persistent memory management tool. A single tool that multiplexes over five operations
 * (memory_list / memory_read / memory_write / memory_edit / memory_delete) so the agent can build
 * and evolve a durable, self-maintained memory that persists across chat sessions (stored in the
 * user's browser). This is the mechanism by which the agent self-evolves for the user: it records
 * durable facts, preferences, decisions and context, and keeps them accurate over time.
 */
export const memoryTool = defineTool({
  name: "memory",
  description:
    "Persistent memory management tool for the agent. Use this tool to store, retrieve, update, " +
    "organize, and remove information that should persist across conversations or agent runs. This " +
    "is how you self-evolve for the user: over time you build up an accurate picture of who they " +
    "are, what they prefer, and what you have learned. Memory files live under the /memory/ " +
    "directory. Three files are always pre-added and permanent — MEMORY.md (durable facts and " +
    "knowledge, max 8000 chars), SOUL.md (your evolving persona and operating principles, max 2000 " +
    "chars) and USER.md (who the user is and how they like to work, max 2000 chars). Their contents " +
    "are auto-loaded into your context at the start of every conversation, so keep them tight and " +
    "high-signal. You may also create your own uncapped files and folders (e.g. preferences.md, " +
    "projects/app.md, decisions/, facts/) — those are NOT auto-loaded, so read them explicitly when " +
    "relevant. Use memory deliberately: read relevant memories before decisions that depend on past " +
    "context; write/edit memories as you learn new durable information; and delete memories that are " +
    "no longer valid (the three pre-added files cannot be deleted). When a write or edit would " +
    "exceed a file's character limit it fails without applying — in that case summarize and condense " +
    "the entire file into a shorter version (keeping the important information) and memory_write it " +
    "again. Operations: memory_list (discover files + their sizes/limits), memory_read (load a " +
    "file's contents by exact path), memory_write (create or fully replace a file's contents), " +
    "memory_edit (exact-match old_str -> new_str replacement), memory_delete (remove a non-pre-added " +
    "file). Always memory_list or memory_read before editing so you use exact paths and exact text.",
  schema,
  label: memoryLabel,
  async execute(args: MemoryArgs, ctx: ToolContext): Promise<ToolResult> {
    const memory = ctx.memory;
    if (!memory) {
      return {
        ok: false,
        error: {
          code: "memory_unavailable",
          message:
            "The memory tool is not available in this context (memory is only accessible to the " +
            "main agent, not sub-agents).",
        },
      };
    }

    try {
      switch (args.operation) {
        case "memory_list":
          return memory.list();

        case "memory_read": {
          if (!isNonEmpty(args.path)) return missingField("path", "memory_read");
          return memory.read(args.path);
        }

        case "memory_write": {
          if (!isNonEmpty(args.path)) return missingField("path", "memory_write");
          if (typeof args.content !== "string") return missingField("content", "memory_write");
          return memory.write(args.path, args.content, ctx);
        }

        case "memory_edit": {
          if (!isNonEmpty(args.path)) return missingField("path", "memory_edit");
          if (!isNonEmpty(args.old_str)) return missingField("old_str", "memory_edit");
          return memory.edit(args.path, args.old_str, args.new_str ?? "", ctx);
        }

        case "memory_delete": {
          if (!isNonEmpty(args.path)) return missingField("path", "memory_delete");
          return memory.remove(args.path, ctx);
        }

        default:
          return {
            ok: false,
            error: {
              code: "memory_unknown_operation",
              message: `Unknown memory operation. Use one of: ${MEMORY_OPERATIONS.join(", ")}.`,
            },
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "memory_operation_failed",
          message: `Memory operation failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  },
});

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Structured error telling the model exactly which field a chosen operation still needs. */
function missingField(field: string, operation: string): ToolResult {
  return {
    ok: false,
    error: {
      code: "memory_missing_field",
      message: `The "${operation}" operation requires a non-empty \`${field}\`. Memory files live under ${MEMORY_ROOT}.`,
      operation,
      missing_field: field,
    },
  };
}
