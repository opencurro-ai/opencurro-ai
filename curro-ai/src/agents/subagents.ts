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

/** Tools a sub-agent may never use — prevents recursive sub-agent invocation. */
export const SUB_AGENT_EXCLUDED_TOOLS: readonly string[] = ["call_sub_agent", "list_sub_agents"];

/**
 * Persistent (process-lifetime) store of sub-agent conversation memory, keyed by
 * `${chatId}::${sessionName}`. Reusing a session name preserves the sub-agent's context so the
 * main agent can ask follow-up questions; a new session name starts a fresh conversation.
 *
 * Serverless note: this is in-memory (no queue, no external store) exactly like the main
 * SessionStore. Within a single request/turn — where the main agent may call a sub-agent
 * several times — memory is fully preserved. Across cold starts it resets, which is the
 * expected trade-off for a stateless serverless deployment.
 */
export class SubAgentSessionStore {
  private readonly sessions = new Map<string, StoredMessage[]>();

  private key(chatId: string, session: string): string {
    return `${chatId}::${session}`;
  }

  /** Whether a session already exists (used to decide new vs. reuse). */
  has(chatId: string, session: string): boolean {
    return this.sessions.has(this.key(chatId, session));
  }

  /** Return the message array for a session, creating an empty one if missing. */
  ensure(chatId: string, session: string): StoredMessage[] {
    const key = this.key(chatId, session);
    let messages = this.sessions.get(key);
    if (!messages) {
      messages = [];
      this.sessions.set(key, messages);
    }
    return messages;
  }
}

export interface SubAgentRuntimeDeps {
  /** The resolved provider serving this turn (built-in or custom). */
  provider: Provider;
  tools: ToolRegistry;
  config: AppConfig;
  sessions: SubAgentSessionStore;
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
   * Execute a sub-agent to completion and return ONLY its final natural-language output.
   * Runs an unbounded Thought -> Action -> Observation loop (no iteration cap), streaming
   * progress as `sub_agent_*` events correlated to the parent tool-call id.
   */
  async run(
    params: { session: string; agent: string; task: string },
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const { send, provider, tools, config, sessions, chatId } = this.deps;
    const parentId = ctx.toolCallId ?? `subagent_${Date.now()}`;
    const session = (params.session ?? "").trim() || "default";
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

    // Allowed tools = the sub-agent's chosen tools, minus the sub-agent meta tools, that
    // actually exist in the registry. This is the tool set both advertised and enforced.
    const allowed = new Set(
      (definition.tools ?? []).filter(
        (name) => tools.has(name) && !SUB_AGENT_EXCLUDED_TOOLS.includes(name),
      ),
    );
    const toolSchemas = tools.schemasFor(allowed);

    const isNewSession = !sessions.has(chatId, session);
    const history = sessions.ensure(chatId, session);
    history.push({ role: "user", content: task });

    const systemPrompt = buildSubAgentSystemPrompt(definition, config.workspaceRoot);

    send("sub_agent_start", {
      id: parentId,
      session,
      agent: definition.name,
      task,
      new_session: isNewSession,
    });

    // Tool executions for a sub-agent must NOT see the sub-agent runtime (no recursion) and
    // must not carry the parent tool-call id.
    const subToolCtx: ToolContext = {
      workspaceRoot: ctx.workspaceRoot,
      shellTimeoutMs: ctx.shellTimeoutMs,
      signal: ctx.signal,
      web: ctx.web,
      model: this.deps.model,
      visionCapable: ctx.visionCapable,
    };

    const answerAcrossTurns: string[] = [];

    try {
      // Unbounded loop: the sub-agent has no iteration limit. It only stops when the model
      // returns a final answer (no tool calls) or the turn is aborted.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (ctx.signal?.aborted) {
          send("sub_agent_done", { id: parentId, ok: false, aborted: true, output: "" });
          return {
            ok: false,
            error: { code: "aborted", message: "The sub-agent run was aborted." },
          };
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
            signal: ctx.signal,
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
          if (ctx.signal?.aborted) {
            send("sub_agent_done", { id: parentId, ok: false, aborted: true, output: "" });
            return { ok: false, error: { code: "aborted", message: "The sub-agent run was aborted." } };
          }
          const message = `Sub-agent provider error: ${messageOf(error)}`;
          send("sub_agent_done", { id: parentId, ok: false, output: "", error: message });
          return { ok: false, error: { code: "sub_agent_provider_error", message } };
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

        return {
          ok: true,
          data: {
            session,
            agent: definition.name,
            output,
          },
        };
      }
    } catch (error) {
      const message = `Sub-agent failed: ${messageOf(error)}`;
      send("sub_agent_done", { id: parentId, ok: false, output: "", error: message });
      return { ok: false, error: { code: "sub_agent_failed", message } };
    }
  }
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

/** Build provider (OpenAI) messages: system prompt followed by the preserved session history. */
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
