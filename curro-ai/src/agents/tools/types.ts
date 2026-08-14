import type { z } from "zod";

/** Structured result returned by every tool. Mirrors the shape the model observes. */
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}

/** Runtime context handed to a tool on execution. */
export interface ToolContext {
  /** Absolute path all file operations are sandboxed to. */
  workspaceRoot: string;
  /** Timeout (ms) applied to shell commands. */
  shellTimeoutMs: number;
  /** Abort signal so long running tools stop when the turn is cancelled. */
  signal?: AbortSignal;
}

/**
 * A Tool is fully self describing: name, description, a zod schema (used both to build
 * the OpenAI function schema and to validate arguments), a label helper for the UI, and
 * an async executor. Adding a new tool = create one file exporting a Tool and register it.
 */
export interface Tool<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: Schema;
  /** Short human friendly label for UI chips, e.g. "Create: src/app.ts". */
  label: (args: z.infer<Schema>) => string;
  execute: (args: z.infer<Schema>, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * A tool with its schema type erased — used wherever tools of different schema shapes are stored
 * together. `Tool<Schema>` is invariant in Schema (the schema field is covariant while the
 * label/execute params are contravariant), so a generic alias won't accept heterogeneous tools.
 * This standalone interface widens the schema-dependent parts to accept any concrete Tool.
 */
export interface AnyTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  label: (args: never) => string;
  execute: (args: never, ctx: ToolContext) => Promise<ToolResult>;
}

/** Helper to define a tool with full type inference from its schema. */
export function defineTool<Schema extends z.ZodTypeAny>(tool: Tool<Schema>): Tool<Schema> {
  return tool;
}
