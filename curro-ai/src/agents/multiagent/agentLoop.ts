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
import type { Semaphore } from "./concurrency.js";

/** Result of running one activation of a team agent (head or member) to completion. */
export interface TeamAgentLoopResult {
  ok: boolean;
  aborted: boolean;
  /** The agent's final answer text for this activation (its last message with no tool calls). */
  output: string;
  error?: string;
}

export interface TeamAgentLoopArgs {
  /** Provider + credentials — identical to the user's main selection; a separate stream per agent. */
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  tools: ToolRegistry;
  /** Tool names this agent may use (already role-scoped). */
  allowed: Set<string>;
  /** OpenAI tool schemas advertised to the model (the `allowed` subset). */
  toolSchemas: OpenAIToolSchema[];
  /** The tool-execution context for this agent (carries team + teamSelfId + shared runtimes). */
  toolCtx: ToolContext;
  /** Fully-rendered system prompt for this agent. */
  systemPrompt: string;
  /**
   * The agent's conversation, mutated in place so the caller can persist the grown transcript. The
   * triggering message(s) must already be appended as the final user turn before calling.
   */
  history: StoredMessage[];
  /** Emit a `team_agent_*` event already stamped with this activation's id + agent identity. */
  send: (event: string, data: Record<string, unknown>) => void;
  /** The activation id (unique per activation) used as the `id` on every emitted event. */
  activationId: string;
  signal: AbortSignal;
  /** Concurrency limiter — a permit is held only around each provider stream, not tool execution. */
  semaphore: Semaphore;
}

/**
 * Run one activation of a team agent: an unbounded Thought → Action → Observation loop (no iteration
 * limit, per requirement) that streams reasoning/tokens and executes tool calls until the model
 * returns a final answer with no tool calls, or the run is aborted. Concurrency across agents is
 * bounded by the semaphore, which is acquired ONLY around each provider stream (never held during
 * tool execution) so agents that are merely waiting on a tool don't starve others.
 */
export async function runTeamAgentLoop(args: TeamAgentLoopArgs): Promise<TeamAgentLoopResult> {
  const {
    provider,
    tools,
    allowed,
    toolSchemas,
    toolCtx,
    systemPrompt,
    history,
    send,
    activationId,
    signal,
    semaphore,
  } = args;

  const answerAcrossTurns: string[] = [];

  try {
    // Unbounded loop — stops only on a final answer (no tool calls) or an abort.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal.aborted) {
        return { ok: false, aborted: true, output: "" };
      }

      const answerParts: string[] = [];
      const reasoningParts: string[] = [];
      let toolCalls: ToolCall[] = [];

      try {
        // Hold a concurrency permit only for the duration of the stream.
        await semaphore.acquire();
        try {
          const stream = provider.streamChatCompletion({
            apiKey: args.apiKey,
            model: args.model,
            messages: buildProviderMessages(systemPrompt, history),
            tools: toolSchemas,
            baseUrl: args.baseUrl,
            temperature: args.temperature,
            effort: args.effort,
            signal,
          });

          for await (const delta of stream) {
            if (delta.reasoning) {
              const cleaned = normalize(delta.reasoning);
              reasoningParts.push(cleaned);
              send("team_agent_reasoning", { id: activationId, value: cleaned });
            }
            if (delta.text) {
              const cleaned = normalize(delta.text);
              answerParts.push(cleaned);
              send("team_agent_token", { id: activationId, value: cleaned });
            }
            if (delta.toolCalls) {
              toolCalls = mergeToolCalls(toolCalls, delta.toolCalls);
            }
          }
        } finally {
          semaphore.release();
        }
      } catch (error) {
        if (signal.aborted) return { ok: false, aborted: true, output: "" };
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

          send("team_agent_tool_call", {
            id: activationId,
            tool_id: toolCall.id,
            name,
            args: toolArgs,
            label,
          });

          const result: ToolResult = allowed.has(name)
            ? await tools.execute(name, toolArgs, { ...toolCtx, toolCallId: toolCall.id ?? undefined })
            : {
                ok: false,
                error: {
                  code: "tool_not_permitted",
                  message: `You are not permitted to use the tool "${name}".`,
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

          send("team_agent_tool_result", {
            id: activationId,
            tool_id: toolCall.id,
            name,
            ok: result.ok,
            result: resultForModel,
            label,
          });
        }

        for (const imageMessage of imageMessages) history.push(imageMessage);

        // Observation delivered — loop so the agent can reason about the results.
        continue;
      }

      // No tool calls -> final answer for this activation.
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

/** Build provider (OpenAI) messages: system prompt followed by the agent's conversation. */
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
