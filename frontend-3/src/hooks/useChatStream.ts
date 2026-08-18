import { useCallback, useRef } from "react";
import { abortChat, streamChat } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { CUSTOM_PROVIDER_PREFIX, toCustomProviderConfig } from "@/lib/providers";
import type { BackendMessage, BackendSubAgent, ChatMessage, SSEEventData } from "@/types";
import { uid } from "@/utils/id";

interface SSEHandlers {
  onEvent: (event: string, data: SSEEventData) => void;
}

/**
 * Parse a text/event-stream body and dispatch each event. Robust to chunk
 * boundaries and CRLF line endings, so tokens stream smoothly over the proxy.
 */
async function consumeSSE(res: Response, handlers: SSEHandlers, signal: AbortSignal): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Normalize CRLF so both "\n\n" and "\r\n\r\n" delimit events.
    buffer = buffer.replace(/\r\n/g, "\n");

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      try {
        handlers.onEvent(event, JSON.parse(dataLines.join("\n")) as SSEEventData);
      } catch {
        /* ignore malformed event */
      }
    }
  }
}

export function useChatStream(onFilesChanged?: () => void) {
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const store = useStore.getState();
      const { settings, customProviders } = store;
      const isCustom = settings.provider.startsWith(CUSTOM_PROVIDER_PREFIX);
      const customProvider = customProviders.find((p) => p.id === settings.provider);
      const apiKey = isCustom
        ? (customProvider?.apiKey ?? "")
        : (settings.apiKeys[settings.provider] ?? "");

      const convId = store.ensureConversation();
      const conv = useStore.getState().conversations.find((c) => c.id === convId)!;

      // History (prior turns) in backend format, before adding the new user message.
      const history: BackendMessage[] = conv.messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      // Sub-agent definitions live in the browser (localStorage) and travel with each turn.
      const subAgents: BackendSubAgent[] = store.subAgents.map((a) => ({
        name: a.name,
        description: a.description,
        system_prompt: a.systemPrompt,
        tools: a.tools,
        enabled: a.enabled,
      }));

      const userMsg: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      store.addMessage(convId, userMsg);

      if (conv.messages.length === 0) {
        store.renameConversation(convId, text.slice(0, 48) + (text.length > 48 ? "…" : ""));
      }

      const assistantId = uid("msg");
      store.addMessage(convId, {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        tools: [],
        createdAt: Date.now(),
      });
      store.setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const finish = () => {
        useStore.getState().updateMessage(convId, assistantId, { streaming: false });
        useStore.getState().setStreaming(false);
        onFilesChanged?.();
      };

      try {
        const res = await streamChat(
          {
            chat_id: convId,
            user_message: text,
            history,
            provider: settings.provider,
            model: settings.model,
            api_key: apiKey,
            base_url: settings.baseUrl || undefined,
            custom_provider: isCustom && customProvider
              ? toCustomProviderConfig(customProvider, settings.model)
              : undefined,
            max_iterations: 1000,
            tavily_api_key: settings.tavilyApiKey || undefined,
            exa_api_key: settings.exaApiKey || undefined,
            serpapi_api_key: settings.serpapiApiKey || undefined,
            search_provider: settings.searchProvider,
            firecrawl_api_key: settings.firecrawlApiKey || undefined,
            sub_agents: subAgents,
          },
          controller.signal,
        );

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          useStore.getState().updateMessage(convId, assistantId, {
            content: `⚠️ ${errText || `Request failed (${res.status})`}`,
          });
          finish();
          return;
        }

        await consumeSSE(
          res,
          {
            onEvent: (event, data) => {
              const s = useStore.getState();
              switch (event) {
                case "reasoning":
                  s.appendReasoning(convId, assistantId, String(data.value ?? ""));
                  break;
                case "token":
                  s.appendToken(convId, assistantId, String(data.value ?? ""));
                  break;
                case "tool_call":
                  s.upsertTool(convId, assistantId, {
                    id: String(data.id ?? uid("tool")),
                    name: String(data.name ?? "tool"),
                    label: String(data.label ?? data.name ?? "tool"),
                    status: "running",
                    args: (data.args as Record<string, unknown> | undefined) ?? undefined,
                    filePath:
                      (data.args as Record<string, unknown> | undefined)?.file_path as
                        | string
                        | undefined,
                  });
                  break;
                case "plan_review": {
                  const planId = String(data.id ?? uid("tool"));
                  s.setPlanPending(convId, assistantId, planId, {
                    id: planId,
                    chatId: String(data.chat_id ?? convId),
                    plan: String(data.plan ?? ""),
                  });
                  break;
                }
                case "ask_question": {
                  const askId = String(data.id ?? uid("tool"));
                  const questions = (data.questions ?? []).map((q) => ({
                    question: String(q?.question ?? ""),
                    context: String(q?.context ?? ""),
                    options: (q?.options ?? []).map((o) => String(o)),
                  }));
                  s.setQuestionPending(convId, assistantId, askId, {
                    id: askId,
                    chatId: String(data.chat_id ?? convId),
                    questions,
                  });
                  break;
                }
                case "tool_result": {
                  const ok = Boolean(data.ok);
                  const id = String(data.id ?? uid("tool"));
                  const name = String(data.name ?? "tool");
                  const result = (data.result ?? {}) as { decision?: string } | undefined;
                  s.upsertTool(convId, assistantId, {
                    id,
                    name,
                    label: String(data.label ?? data.name ?? "tool"),
                    status: ok ? "ok" : "error",
                    result: data.result,
                  });
                  if (name === "submit_plan" && result?.decision) {
                    const statusMap: Record<string, "approved" | "canceled" | "edited" | "timeout"> = {
                      approved: "approved",
                      edited: "edited",
                      canceled: "canceled",
                      timeout: "timeout",
                    };
                    const planStatus = statusMap[result.decision];
                    if (planStatus) s.setPlanStatus(convId, assistantId, id, planStatus);
                  }
                  if (name === "ask_question_to_user" && (result?.decision === "answered" || result?.decision === "timeout")) {
                    s.setQuestionStatus(
                      convId,
                      assistantId,
                      id,
                      result.decision === "answered" ? "answered" : "timeout",
                    );
                  }
                  onFilesChanged?.();
                  break;
                }
                case "sub_agent_start":
                  s.startSubAgent(convId, assistantId, String(data.id ?? ""), {
                    session: String(data.session ?? ""),
                    agent: String(data.agent ?? ""),
                    task: String(data.task ?? ""),
                  });
                  break;
                case "sub_agent_reasoning":
                  s.appendSubAgentReasoning(
                    convId,
                    assistantId,
                    String(data.id ?? ""),
                    String(data.value ?? ""),
                  );
                  break;
                case "sub_agent_token":
                  s.appendSubAgentToken(
                    convId,
                    assistantId,
                    String(data.id ?? ""),
                    String(data.value ?? ""),
                  );
                  break;
                case "sub_agent_tool_call":
                  s.upsertSubAgentTool(convId, assistantId, String(data.id ?? ""), {
                    id: String(data.tool_id ?? uid("subtool")),
                    name: String(data.name ?? "tool"),
                    label: String(data.label ?? data.name ?? "tool"),
                    status: "running",
                    args: (data.args as Record<string, unknown> | undefined) ?? undefined,
                    filePath: (data.args as Record<string, unknown> | undefined)?.file_path as
                      | string
                      | undefined,
                  });
                  break;
                case "sub_agent_tool_result":
                  s.upsertSubAgentTool(convId, assistantId, String(data.id ?? ""), {
                    id: String(data.tool_id ?? uid("subtool")),
                    name: String(data.name ?? "tool"),
                    label: String(data.label ?? data.name ?? "tool"),
                    status: data.ok ? "ok" : "error",
                    result: data.result,
                  });
                  onFilesChanged?.();
                  break;
                case "sub_agent_done":
                  s.finishSubAgent(convId, assistantId, String(data.id ?? ""), {
                    status: data.ok ? "ok" : "error",
                    output: data.output != null ? String(data.output) : undefined,
                    error: data.error != null ? String(data.error) : undefined,
                  });
                  break;
                case "error":
                  s.appendToken(convId, assistantId, `\n\n⚠️ ${String(data.message ?? "Agent error")}`);
                  break;
                case "done":
                  finish();
                  break;
                default:
                  break;
              }
            },
          },
          controller.signal,
        );
        finish();
      } catch (error) {
        if (!controller.signal.aborted) {
          useStore.getState().updateMessage(convId, assistantId, {
            content: `⚠️ ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        finish();
      } finally {
        abortRef.current = null;
      }
    },
    [onFilesChanged],
  );

  const stop = useCallback(async () => {
    const convId = useStore.getState().currentId;
    abortRef.current?.abort();
    if (convId) {
      await abortChat(convId);
    }
    useStore.getState().setStreaming(false);
  }, []);

  return { send, stop };
}
