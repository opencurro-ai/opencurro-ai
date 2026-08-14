import type { AppConfig } from "../config.js";
import { buildSystemPrompt } from "./systemprompt.js";
import type { ProviderRegistry } from "./providers/registry.js";
import type { ToolRegistry } from "./tools/index.js";
import type { ToolCall, ToolCallDelta } from "./providers/types.js";
import type { ChatSession, StoredMessage } from "../services/sessionStore.js";
import type { SessionEventBuffer } from "../services/eventBuffer.js";
import { safeJsonParse } from "../utils/json.js";

export interface RunAgentRequest {
  chatId: string;
  userMessage: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxIterations: number;
  temperature?: number;
}

export class AgentRunner {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly config: AppConfig,
  ) {}

  /**
   * Execute a full autonomous turn: stream reasoning + tokens, run tools natively, and
   * loop (Thought -> Action -> Observation) until the model produces a final answer with
   * no further tool calls or the iteration limit is hit.
   */
  async run(
    request: RunAgentRequest,
    session: ChatSession,
    buffer: SessionEventBuffer,
    signal: AbortSignal,
  ): Promise<void> {
    const send = (event: string, data: Record<string, unknown>) => buffer.append(event, data);

    try {
      let provider;
      try {
        provider = this.providers.get(request.provider);
      } catch (error) {
        send("error", { code: "provider_error", message: messageOf(error) });
        send("done", { ok: false });
        return;
      }

      session.messages.push({ role: "user", content: request.userMessage });
      const systemPrompt = buildSystemPrompt(this.config.workspaceRoot);
      const maxIterations = clampIterations(request.maxIterations, this.config.maxIterations);

      const visibleAnswer: string[] = [];
      const visibleReasoning: string[] = [];
      let iteration = 0;

      send("iteration", { current: 0, limit: maxIterations });

      while (iteration < maxIterations) {
        if (signal.aborted) {
          send("done", { ok: false, aborted: true });
          return;
        }

        iteration += 1;
        send("iteration", { current: iteration, limit: maxIterations });
        send("status", { state: "thinking", label: "Thinking..." });

        const answerParts: string[] = [];
        const reasoningParts: string[] = [];
        let toolCalls: ToolCall[] = [];
        let finishReason: string | null = null;

        try {
          const stream = provider.streamChatCompletion({
            apiKey: request.apiKey,
            model: request.model,
            messages: this.buildProviderMessages(systemPrompt, session.messages),
            tools: this.tools.schemas,
            baseUrl: request.baseUrl,
            temperature: request.temperature,
            signal,
          });

          for await (const delta of stream) {
            if (delta.reasoning) {
              const cleaned = normalize(delta.reasoning);
              reasoningParts.push(cleaned);
              visibleReasoning.push(cleaned);
              send("reasoning", { value: cleaned });
            }
            if (delta.text) {
              const cleaned = normalize(delta.text);
              answerParts.push(cleaned);
              visibleAnswer.push(cleaned);
              send("token", { value: cleaned });
            }
            if (delta.toolCalls) {
              toolCalls = mergeToolCalls(toolCalls, delta.toolCalls);
            }
            if (delta.finishReason) {
              finishReason = delta.finishReason;
            }
          }
        } catch (error) {
          if (signal.aborted) {
            send("done", { ok: false, aborted: true });
            return;
          }
          send("error", { code: "provider_api_error", message: `Provider API error: ${messageOf(error)}` });
          send("done", { ok: false });
          return;
        }

        const hasToolCalls = toolCalls.some((c) => c.function.name) || finishReason === "tool_calls";

        if (hasToolCalls) {
          const assistantMessage: StoredMessage = {
            role: "assistant",
            content: answerParts.join("") || null,
            tool_calls: toolCalls.map((c) => ({
              id: c.id,
              type: c.type,
              function: { name: c.function.name, arguments: c.function.arguments },
            })),
          };
          if (reasoningParts.length > 0) assistantMessage.reasoning_content = reasoningParts.join("");
          session.messages.push(assistantMessage);

          for (const toolCall of toolCalls) {
            if (!toolCall.function.name) continue;
            const args = safeJsonParse(toolCall.function.arguments);

            send("tool_call", {
              id: toolCall.id,
              name: toolCall.function.name,
              args,
              label: this.tools.label(toolCall.function.name, args),
            });

            const result = await this.tools.execute(toolCall.function.name, args, {
              workspaceRoot: this.config.workspaceRoot,
              shellTimeoutMs: this.config.shellTimeoutMs,
              signal,
            });

            session.messages.push({
              role: "tool",
              tool_call_id: toolCall.id ?? undefined,
              name: toolCall.function.name,
              content: JSON.stringify(result),
            });

            send("tool_result", {
              id: toolCall.id,
              name: toolCall.function.name,
              ok: result.ok,
              result,
              label: this.tools.label(toolCall.function.name, args),
            });
          }

          // Observation delivered — loop again so the model can reason about the results.
          continue;
        }

        // No tool calls -> this is the final assistant answer for the turn.
        const finalContent = answerParts.join("");
        const finalMessage: StoredMessage = { role: "assistant", content: finalContent };
        if (reasoningParts.length > 0) finalMessage.reasoning_content = reasoningParts.join("");
        session.messages.push(finalMessage);

        send("message_complete", {
          content: visibleAnswer.join(""),
          reasoning: visibleReasoning.length > 0 ? visibleReasoning.join("") : null,
          iteration_count: iteration,
        });
        send("done", { ok: true });
        return;
      }

      send("error", {
        code: "iteration_limit_reached",
        message: "Reached the maximum number of iterations before completing the turn.",
      });
      send("done", { ok: false });
    } finally {
      buffer.setDone();
      session.running = false;
      session.updatedAt = Date.now();
    }
  }

  private buildProviderMessages(systemPrompt: string, messages: StoredMessage[]): Array<Record<string, unknown>> {
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
}

function clampIterations(requested: number, max: number): number {
  if (!Number.isFinite(requested) || requested < 1) return max;
  return Math.min(Math.floor(requested), max);
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
