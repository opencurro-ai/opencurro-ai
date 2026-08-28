import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config.js";
import type { ToolRegistry } from "./tools/registry.js";
import type { Provider } from "./providers/types.js";
import type { ToolCall, ToolCallDelta } from "./providers/types.js";
import {
  buildImageMessage,
  extractImageAttachment,
  withoutImageAttachment,
} from "./tools/readImage.js";
import type { StoredMessage } from "../services/sessionStore.js";
import type {
  SubAgentDefinition,
  SubAgentRuntime,
  ToolContext,
  ToolResult,
} from "./tools/types.js";
import { safeJsonParse } from "../utils/json.js";
import { safeResolve } from "../utils/paths.js";

/**
 * Tools a sub-agent may never use: the sub-agent meta tools (prevents recursive delegation) and
 * the skill meta tools (the skill runtime is only wired to the main agent's turn).
 */
export const SUB_AGENT_EXCLUDED_TOOLS: readonly string[] = [
  "call_sub_agent",
  "list_sub_agents",
  "list_skills",
  "skill_initialize",
  "TodoWrite",
  "read_todos",
];

/** Directory (relative to the workspace root) where background sub-agent outputs are written. */
export const SUB_AGENT_OUTPUT_DIR = ".curro/sub-agent";

export interface SubAgentRuntimeDeps {
  /** The resolved provider serving this turn (built-in or custom). */
  provider: Provider;
  tools: ToolRegistry;
  config: AppConfig;
  chatId: string;
  definitions: SubAgentDefinition[];
  /** Provider/model/credentials — identical to the main agent's, but a separate API call. */
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  /** Emit an SSE side-channel event onto the turn's event buffer. */
  send: (event: string, data: Record<string, unknown>) => void;
}

/**
 * Build the SubAgentRuntime bound to a single main-agent turn. The returned object is injected
 * into the ToolContext so call_sub_agent / list_sub_agents can enumerate and execute sub-agents.
 */
export function createSubAgentRuntime(deps: SubAgentRuntimeDeps): SubAgentRuntime {
  const runner = new SubAgentRunner(deps);
  return {
    definitions: deps.definitions,
    available: () => runner.available(),
    run: (params, ctx) => runner.run(params, ctx),
  };
}

/** Internal result of running a sub-agent's Thought -> Action -> Observation loop to completion. */
interface SubAgentLoopResult {
  ok: boolean;
  aborted: boolean;
  output: string;
  error?: string;
}

class SubAgentRunner {
  constructor(private readonly deps: SubAgentRuntimeDeps) {}

  /** Enabled sub-agents exposed to the model via list_sub_agents. */
  available(): Array<{ name: string; description: string }> {
    return this.deps.definitions
      .filter((def) => def.enabled !== false && def.name.trim().length > 0)
      .map((def) => ({ name: def.name, description: def.description ?? "" }));
  }

  private find(name: string): SubAgentDefinition | undefined {
    const target = name.trim().toLowerCase();
    return this.deps.definitions.find(
      (def) => def.enabled !== false && def.name.trim().toLowerCase() === target,
    );
  }

  /**
   * Dispatch a sub-agent invocation. When `wait_for_output` is true (the default) the sub-agent
   * runs to completion and its final report is returned directly to the main agent. When it is
   * false the sub-agent is launched in the BACKGROUND — fully detached from the main agent's turn
   * (its own abort signal, so aborting/ending the main turn never stops it) — and the tool returns
   * immediately with the path of the ".curro/sub-agent" file where its output will be written.
   */
  async run(
    params: { agent: string; task: string; wait_for_output?: boolean },
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const task = (params.task ?? "").trim();

    const definition = this.find(params.agent ?? "");
    if (!definition) {
      const names = this.available().map((a) => a.name);
      return {
        ok: false,
        error: {
          code: "unknown_sub_agent",
          message:
            `Unknown or disabled sub-agent "${params.agent}". ` +
            (names.length > 0
              ? `Available sub-agents: ${names.join(", ")}.`
              : "No sub-agents are currently available. The user can create one from Settings."),
        },
      };
    }

    if (!task) {
      return {
        ok: false,
        error: { code: "missing_task", message: "A non-empty task is required for the sub-agent." },
      };
    }

    // Default to waiting: only run in the background when explicitly asked to.
    const waitForOutput = params.wait_for_output !== false;

    return waitForOutput
      ? this.runForeground(definition, task, ctx)
      : this.runBackground(definition, task, ctx);
  }

  /**
   * Run the sub-agent to completion within the main agent's turn and return its final output.
   * The sub-agent shares the main turn's abort signal, so cancelling the turn cancels it too.
   */
  private async runForeground(
    definition: SubAgentDefinition,
    task: string,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const parentId = ctx.toolCallId ?? `subagent_${Date.now()}`;
    const result = await this.runLoop(definition, task, parentId, ctx, ctx.signal, {
      background: false,
    });

    if (result.aborted) {
      return { ok: false, error: { code: "aborted", message: "The sub-agent run was aborted." } };
    }
    if (!result.ok) {
      return {
        ok: false,
        error: { code: "sub_agent_failed", message: result.error ?? "The sub-agent failed." },
      };
    }
    return {
      ok: true,
      data: {
        agent: definition.name,
        wait_for_output: true,
        background: false,
        output: result.output,
      },
    };
  }

  /**
   * Launch the sub-agent in the background and return immediately. The run is fully detached from
   * the main agent's turn: it uses its own AbortController (never the turn's signal), so aborting,
   * stopping, or losing the connection to the main agent does NOT stop the sub-agent. Its final
   * report is written to a ".curro/sub-agent/<name>-output-<id>.md" file the main agent reads later.
   */
  private async runBackground(
    definition: SubAgentDefinition,
    task: string,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const parentId = ctx.toolCallId ?? `subagent_${Date.now()}`;
    const fileName = `${slugifyName(definition.name)}-output-${random5()}.md`;
    const relPath = `${SUB_AGENT_OUTPUT_DIR}/${fileName}`;

    let outputAbs: string;
    try {
      outputAbs = safeResolve(ctx.workspaceRoot, relPath);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "sub_agent_output_path_error",
          message: `Could not resolve the background output file path: ${messageOf(error)}`,
        },
      };
    }

    // Write an initial "running" placeholder so the main agent can read the file immediately and
    // see the sub-agent is still working, even before it finishes.
    try {
      await fs.mkdir(path.dirname(outputAbs), { recursive: true });
      await fs.writeFile(
        outputAbs,
        renderOutputFile({ definition, task, status: "running", output: "" }),
        "utf8",
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "sub_agent_output_write_error",
          message: `Could not create the background output file "${relPath}": ${messageOf(error)}`,
        },
      };
    }

    // A dedicated controller detached from the main turn. It is intentionally never aborted from
    // here, so the background sub-agent keeps running after the main agent aborts, stops, or the
    // connection drops. It only exists to satisfy tools that expect a signal in their context.
    const backgroundController = new AbortController();

    // The background context must NOT carry the main turn's abort signal.
    const backgroundCtx: ToolContext = {
      ...ctx,
      signal: backgroundController.signal,
      toolCallId: parentId,
    };

    this.deps.send("sub_agent_background_started", {
      id: parentId,
      agent: definition.name,
      task,
      output_file: relPath,
    });

    // Fire-and-forget: the loop runs independently of this tool call's returned promise.
    void this.runLoop(definition, task, parentId, backgroundCtx, backgroundController.signal, {
      background: true,
    })
      .then((result) =>
        writeOutputFile(outputAbs, {
          definition,
          task,
          status: result.aborted ? "aborted" : result.ok ? "completed" : "failed",
          output: result.output,
          error: result.error,
        }),
      )
      .catch((error) =>
        writeOutputFile(outputAbs, {
          definition,
          task,
          status: "failed",
          output: "",
          error: messageOf(error),
        }),
      );

    return {
      ok: true,
      data: {
        agent: definition.name,
        wait_for_output: false,
        background: true,
        output_file: relPath,
        message:
          `Sub-agent "${definition.name}" has started in the background. You can keep doing other ` +
          `work now — you do not need to wait. Its final output will be written to the file ` +
          `"${relPath}". Read that file with file_read when you need the result; while the sub-agent ` +
          `is still working the file shows a "running" status, and it is replaced with the complete ` +
          `report once the sub-agent finishes.`,
      },
    };
  }

  /**
   * Execute a sub-agent's unbounded Thought -> Action -> Observation loop to completion, streaming
   * progress as `sub_agent_*` events correlated to the parent tool-call id. Returns a structured
   * result (ok / aborted / output / error) rather than a ToolResult so both the foreground and
   * background callers can shape their own response.
   */
  private async runLoop(
    definition: SubAgentDefinition,
    task: string,
    parentId: string,
    outerCtx: ToolContext,
    signal: AbortSignal | undefined,
    options: { background: boolean },
  ): Promise<SubAgentLoopResult> {
    const { send, provider, tools, config } = this.deps;

    // Allowed tools = the sub-agent's chosen tools, minus the sub-agent meta tools, that
    // actually exist in the registry. This is the tool set both advertised and enforced.
    const allowed = new Set(
      (definition.tools ?? []).filter(
        (name) => tools.has(name) && !SUB_AGENT_EXCLUDED_TOOLS.includes(name),
      ),
    );
    const toolSchemas = tools.schemasFor(allowed);

    // Each call_sub_agent invocation is an independent, fresh sub-agent conversation.
    const history: StoredMessage[] = [{ role: "user", content: task }];

    const systemPrompt = buildSubAgentSystemPrompt(definition, config.workspaceRoot);

    send("sub_agent_start", {
      id: parentId,
      agent: definition.name,
      task,
      background: options.background,
    });

    // Tool executions for a sub-agent must NOT see the sub-agent runtime (no recursion) and
    // carry the sub-agent's own signal (the background signal when detached).
    const subToolCtx: ToolContext = {
      workspaceRoot: outerCtx.workspaceRoot,
      shellTimeoutMs: outerCtx.shellTimeoutMs,
      signal,
      web: outerCtx.web,
      model: this.deps.model,
      visionCapable: outerCtx.visionCapable,
      availableToolNames: tools.names(),
    };

    const answerAcrossTurns: string[] = [];

    try {
      // Unbounded loop: the sub-agent has no iteration limit. It only stops when the model
      // returns a final answer (no tool calls) or the run is aborted via its own signal.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) {
          send("sub_agent_done", { id: parentId, ok: false, aborted: true, output: "" });
          return { ok: false, aborted: true, output: "" };
        }

        const answerParts: string[] = [];
        const reasoningParts: string[] = [];
        let toolCalls: ToolCall[] = [];

        try {
          const stream = provider.streamChatCompletion({
            apiKey: this.deps.apiKey,
            model: this.deps.model,
            messages: buildProviderMessages(systemPrompt, history),
            tools: toolSchemas,
            baseUrl: this.deps.baseUrl,
            temperature: this.deps.temperature,
            signal,
          });

          for await (const delta of stream) {
            if (delta.reasoning) {
              const cleaned = normalize(delta.reasoning);
              reasoningParts.push(cleaned);
              send("sub_agent_reasoning", { id: parentId, value: cleaned });
            }
            if (delta.text) {
              const cleaned = normalize(delta.text);
              answerParts.push(cleaned);
              send("sub_agent_token", { id: parentId, value: cleaned });
            }
            if (delta.toolCalls) {
              toolCalls = mergeToolCalls(toolCalls, delta.toolCalls);
            }
          }
        } catch (error) {
          if (signal?.aborted) {
            send("sub_agent_done", { id: parentId, ok: false, aborted: true, output: "" });
            return { ok: false, aborted: true, output: "" };
          }
          const message = `Sub-agent provider error: ${messageOf(error)}`;
          send("sub_agent_done", { id: parentId, ok: false, output: "", error: message });
          return { ok: false, aborted: false, output: "", error: message };
        }

        const namedCalls = toolCalls.filter((c) => c.function.name);

        if (namedCalls.length > 0) {
          const assistantMessage: StoredMessage = {
            role: "assistant",
            content: answerParts.join("") || null,
            tool_calls: namedCalls.map((c) => ({
              id: c.id,
              type: c.type,
              function: { name: c.function.name, arguments: c.function.arguments },
            })),
          };
          if (reasoningParts.length > 0) assistantMessage.reasoning_content = reasoningParts.join("");
          history.push(assistantMessage);
          if (answerParts.length > 0) answerAcrossTurns.push(answerParts.join(""));

          const imageMessages: StoredMessage[] = [];

          for (const toolCall of namedCalls) {
            const name = toolCall.function.name;
            const args = safeJsonParse(toolCall.function.arguments);
            const label = tools.label(name, args);

            send("sub_agent_tool_call", {
              id: parentId,
              tool_id: toolCall.id,
              name,
              args,
              label,
            });

            const result: ToolResult = allowed.has(name)
              ? await tools.execute(name, args, subToolCtx)
              : {
                  ok: false,
                  error: {
                    code: "tool_not_permitted",
                    message: `The sub-agent "${definition.name}" is not permitted to use the tool "${name}".`,
                  },
                };

            // Mirror the main agent: strip any read_image attachment from the model-visible
            // tool message and inject the image as a vision content part afterwards.
            const resultForModel = withoutImageAttachment(result);
            const imageAttachment = extractImageAttachment(result);

            history.push({
              role: "tool",
              tool_call_id: toolCall.id ?? undefined,
              name,
              content: JSON.stringify(resultForModel),
            });

            if (imageAttachment) imageMessages.push(buildImageMessage(imageAttachment));

            send("sub_agent_tool_result", {
              id: parentId,
              tool_id: toolCall.id,
              name,
              ok: result.ok,
              result: resultForModel,
              label,
            });
          }

          // Append vision inputs after all tool responses for contiguous tool messages.
          for (const imageMessage of imageMessages) {
            history.push(imageMessage);
          }

          // Observation delivered — loop so the sub-agent can reason about the results.
          continue;
        }

        // No tool calls -> final answer for the sub-agent.
        const finalContent = answerParts.join("");
        const finalMessage: StoredMessage = { role: "assistant", content: finalContent };
        if (reasoningParts.length > 0) finalMessage.reasoning_content = reasoningParts.join("");
        history.push(finalMessage);

        const output = finalContent.trim() || answerAcrossTurns.join("\n").trim();
        send("sub_agent_done", { id: parentId, ok: true, output });

        return { ok: true, aborted: false, output };
      }
    } catch (error) {
      const message = `Sub-agent failed: ${messageOf(error)}`;
      send("sub_agent_done", { id: parentId, ok: false, output: "", error: message });
      return { ok: false, aborted: false, output: "", error: message };
    }
  }
}

/** Terminal states a background sub-agent output file can record. */
type SubAgentOutputStatus = "running" | "completed" | "failed" | "aborted";

interface SubAgentOutputFile {
  definition: SubAgentDefinition;
  task: string;
  status: SubAgentOutputStatus;
  output: string;
  error?: string;
}

/** Render the markdown body of a background sub-agent's output file. */
function renderOutputFile(file: SubAgentOutputFile): string {
  const { definition, task, status, output, error } = file;
  const lines: string[] = [
    `# Sub-agent: ${definition.name}`,
    "",
    `- Status: ${status}`,
    "",
    "## Task",
    "",
    task.trim() || "(no task provided)",
    "",
    "## Output",
    "",
  ];
  if (status === "running") {
    lines.push("_The sub-agent is still working. Re-read this file later for the final report._");
  } else if (output.trim().length > 0) {
    lines.push(output.trim());
  } else {
    lines.push("_(the sub-agent produced no textual output)_");
  }
  if (error) {
    lines.push("", "## Error", "", error.trim());
  }
  return `${lines.join("\n")}\n`;
}

/** Best-effort write of a background sub-agent's output file; failures are swallowed. */
async function writeOutputFile(absPath: string, file: SubAgentOutputFile): Promise<void> {
  try {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, renderOutputFile(file), "utf8");
  } catch {
    // Best-effort: the background run has already completed; nothing more we can do.
  }
}

/** Turn a sub-agent name into a filesystem-safe slug for the output file name. */
function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sub-agent";
}

/** A random 5-digit id (10000–99999) used to keep background output file names unique. */
function random5(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function buildSubAgentSystemPrompt(definition: SubAgentDefinition, workspaceRoot: string): string {
  const base = (definition.system_prompt ?? "").trim();
  return `${base}

# Environment
- You are "${definition.name}", a specialized sub-agent working autonomously on a single delegated task.
- You run on the same machine and share the same workspace as the main agent: ${workspaceRoot}
- All file paths are relative to this workspace (file_read requires an absolute path). Shell commands run from it. Files you create persist on disk.
- You have NO access to the main agent's conversation. Everything you need is in the task you were given.

# Tools (native function calling only)
- Use real tool calls only. Never describe a tool call in prose or output JSON/markdown pretending to be one.
- Only the tools provided to you are available — do not invent tools.

# Final answer (required)
- Keep working with your tools until the task is fully done.
- When finished, respond with NO tool calls and provide a COMPLETE, self-contained final report of exactly what you found, figured out, changed, or produced. This final message is the ONLY thing returned to the main agent, so it must stand on its own — include the concrete results, findings, file paths, and conclusions the main agent needs.`.trim();
}

/** Build provider (OpenAI) messages: system prompt followed by the sub-agent's conversation. */
function buildProviderMessages(
  systemPrompt: string,
  messages: StoredMessage[],
): Array<Record<string, unknown>> {
  const built: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
  for (const message of messages) {
    const entry: Record<string, unknown> = { role: message.role };
    if (message.content !== undefined && message.content !== null) entry.content = message.content;
    else if (message.role === "assistant" && message.tool_calls) entry.content = null;
    if (message.tool_calls) entry.tool_calls = message.tool_calls;
    if (message.tool_call_id) entry.tool_call_id = message.tool_call_id;
    if (message.name) entry.name = message.name;
    // Reasoning-capable models require prior reasoning_content to be passed back unchanged.
    if (message.reasoning_content) entry.reasoning_content = message.reasoning_content;
    built.push(entry);
  }
  return built;
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Merge streamed tool-call fragments into complete tool calls, keyed by index. */
function mergeToolCalls(accumulated: ToolCall[], incoming: ToolCallDelta[]): ToolCall[] {
  const merged = accumulated.slice();
  for (const chunk of incoming) {
    const index = chunk.index ?? merged.length;
    while (merged.length <= index) {
      merged.push({ id: null, type: "function", function: { name: "", arguments: "" } });
    }
    const target = merged[index]!;
    if (chunk.id) target.id = chunk.id;
    if (chunk.function?.name) target.function.name += chunk.function.name;
    if (chunk.function?.arguments) target.function.arguments += chunk.function.arguments;
  }
  return merged;
}
