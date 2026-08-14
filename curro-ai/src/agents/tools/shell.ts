import { spawn } from "node:child_process";
import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  command: z
    .string()
    .describe("The shell command to run, e.g. 'npm install', 'ls -la', 'node script.js'."),
  session_name: z
    .string()
    .default("default")
    .describe("Logical session/label for grouping related commands (informational)."),
  wait_for_output: z
    .boolean()
    .default(true)
    .describe(
      "If true (default) wait for the command to finish and return stdout/stderr/exit_code. " +
        "If false, start the command in the background and return immediately with the PID.",
    ),
});

const MAX_OUTPUT_CHARS = 200_000;

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_OUTPUT_CHARS) + `\n... [truncated ${text.length - MAX_OUTPUT_CHARS} chars]`,
    truncated: true,
  };
}

function runForeground(command: string, ctx: ToolContext): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd: ctx.workspaceRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
    }, ctx.shellTimeoutMs);

    const onAbort = () => {
      if (settled) return;
      child.kill("SIGKILL");
    };
    ctx.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onAbort);
      resolve({
        ok: false,
        error: { code: "command_spawn_failed", message: error.message, command },
      });
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onAbort);
      const out = truncate(stdout);
      const err = truncate(stderr);
      const timedOut = signal === "SIGKILL" && !ctx.signal?.aborted;
      resolve({
        ok: code === 0,
        data: {
          command,
          exit_code: code,
          signal,
          stdout: out.text,
          stderr: err.text,
          truncated: out.truncated || err.truncated,
          timed_out: timedOut,
        },
      });
    });
  });
}

function runBackground(command: string, ctx: ToolContext): ToolResult {
  try {
    const child = spawn("bash", ["-lc", command], {
      cwd: ctx.workspaceRoot,
      env: process.env,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return {
      ok: true,
      data: {
        command,
        pid: child.pid,
        background: true,
        message: `Started command in background with PID ${child.pid}.`,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "command_spawn_failed",
        message: error instanceof Error ? error.message : String(error),
        command,
      },
    };
  }
}

export const shellTool = defineTool({
  name: "shall_tool",
  description:
    "Execute a shell (terminal) command on the machine where the agent runs, from the workspace directory. " +
    "Use it to install packages, run builds, execute scripts, inspect the environment, etc. " +
    "State such as created files persists on disk between commands.",
  schema,
  label: (args) => `Terminal: ${args.command}`,
  async execute(args, ctx): Promise<ToolResult> {
    if (!args.command || !args.command.trim()) {
      return { ok: false, error: { code: "missing_command", message: "No command provided." } };
    }
    if (args.wait_for_output) {
      return runForeground(args.command, ctx);
    }
    return runBackground(args.command, ctx);
  },
});
