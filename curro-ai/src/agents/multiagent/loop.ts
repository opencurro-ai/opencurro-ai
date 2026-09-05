import type { Provider, ToolCall, ToolCallDelta } from "../providers/types.js";
import type { ToolRegistry, OpenAIToolSchema } from "../tools/registry.js";
import type { StoredMessage } from "../../services/sessionStore.js";
import type { ToolContext, ToolResult } from "../tools/types.js";
import {
  buildImageMessage,
  extractImageAttachment,
  withoutImageAttachment,
} from "../tools/readImage.js";
import { safeJsonParse } from "../../utils/json.js";

/** Provider/model/credentials shared by every agent in a team (identical to the user's choice). */
export interface AgentLoopDeps {
  provider: Provider;
  tools: ToolRegistry;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
}

/** Structured result of running one agent turn (a full Thought -> Action -> Observation loop). */
export interface AgentTurnResult {
  ok: boolean;
  aborted: boolean;
  /** The agent's final natural-language answer for this run. */
  output: string;
  error?: string;
}

/** Arguments for a single agent turn. */
export interface AgentTurnArgs {
  deps: AgentLoopDeps;
  /** The agent's full system prompt. */
  systemPrompt: string;
  /**
   * The agent's persistent conversation history. It already ends with the user/team message that
   * triggers this run. It is mutated in place so the caller retains the updated transcript (the same
   * session is reused across runs — context is never lost).
   */
  history: StoredMessage[];
  /** The OpenAI tool schemas advertised to this agent (its per-role subset). */
  toolSchemas: OpenAIToolSchema[];
  /** The set of tool names this agent is permitted to actually execute. */
  allowed: Set<string>;
  /** The tool-execution context for this agent (carries the team runtime, memory, etc.). */
  toolCtx: ToolContext;
  /** Emit an SSE event for this agent (already stamped with the agent id by the caller). */
  send: (event: string, data: Record<string, unknown>) => void;
  /** Abort signal for the whole team turn. */
  signal: AbortSignal;
}

/**
 * Run one agent's unbounded Thought -> Action -> Observation loop to completion. There is NO
 * iteration limit — the agent stops only when it produces a final answer with no tool calls, or the
 * team turn is aborted. Streams `agent_reasoning` / `agent_token` / `agent_tool_call` /
 * `agent_tool_result` events via `send`. The final answer is returned to the caller (which emits
 * `agent_message` / `agent_done`).
 *
 * This mirrors the single-agent and sub-agent loops exactly (native function calling, image handling,
 * reasoning_content preservation), so behaviour is consistent across the whole system.
 */
export async function runAgentTurn(args: AgentTurnArgs): Promise<AgentTurnResult> {
  const { deps, systemPrompt, history, toolSchemas, allowed, toolCtx, send, signal } = args;
  const { provider, tools } = deps;

  const answerAcrossTurns: string[] = [];

  try {
    // Unbounded loop: no iteration limit for team agents. It ends on a final answer or abort.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal.aborted) {
        return { ok: false, aborted: true, output: "" };
      }

      const answerParts: string[] = [];
      const reasoningParts: string[] = [];
      let toolCalls: ToolCall[] = [];

      try {
        const stream = provider.streamChatCompletion({
          apiKey: deps.apiKey,
          model: deps.model,
          messages: buildProviderMessages(systemPrompt, history),
          tools: toolSchemas,
          baseUrl: deps.baseUrl,
          temperature: deps.temperature,
          effort: deps.effort,
          signal,
        });

        for await (const delta of stream) {
          if (delta.reasoning) {
            const cleaned = normalize(delta.reasoning);
            reasoningParts.push(cleaned);
            send("agent_reasoning", { value: cleaned });
          }
          if (delta.text) {
            const cleaned = normalize(delta.text);
            answerParts.push(cleaned);
            send("agent_token", { value: cleaned });
          }
          if (delta.toolCalls) {
            toolCalls = mergeToolCalls(toolCalls, delta.toolCalls);
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return { ok: false, aborted: true, output: "" };
        }
        const message = `Agent provider error: ${messageOf(error)}`;
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
          const toolArgs = safeJsonParse(toolCall.function.arguments);
          const label = tools.label(name, toolArgs);

          send("agent_tool_call", {
            tool_id: toolCall.id,
            name,
            args: toolArgs,
            label,
          });

          const result: ToolResult = allowed.has(name)
            ? await tools.execute(name, toolArgs, toolCtx)
            : {
                ok: false,
                error: {
                  code: "tool_not_permitted",
                  message: `This agent is not permitted to use the tool "${name}".`,
                },
              };

          const resultForModel = withoutImageAttachment(result);
          const imageAttachment = extractImageAttachment(result);

          history.push({
            role: "tool",
            tool_call_id: toolCall.id ?? undefined,
            name,
            content: JSON.stringify(resultForModel),
          });

          if (imageAttachment) imageMessages.push(buildImageMessage(imageAttachment));

          send("agent_tool_result", {
            tool_id: toolCall.id,
            name,
            ok: result.ok,
            result: resultForModel,
            label,
          });
        }

        for (const imageMessage of imageMessages) {
          history.push(imageMessage);
        }

        // Observation delivered — loop so the agent can reason about the results.
        continue;
      }

      // No tool calls -> final answer for this run.
      const finalContent = answerParts.join("");
      const finalMessage: StoredMessage = { role: "assistant", content: finalContent };
      if (reasoningParts.length > 0) finalMessage.reasoning_content = reasoningParts.join("");
      history.push(finalMessage);

      const output = finalContent.trim() || answerAcrossTurns.join("\n").trim();
      return { ok: true, aborted: false, output };
    }
  } catch (error) {
    return { ok: false, aborted: false, output: "", error: `Agent failed: ${messageOf(error)}` };
  }
}

/** Build provider (OpenAI) messages: the system prompt followed by the agent's conversation. */
export function buildProviderMessages(
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
