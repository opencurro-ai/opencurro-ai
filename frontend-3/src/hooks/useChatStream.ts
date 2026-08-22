import { useCallback, useRef } from "react";
import { abortChat, streamChat } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { CUSTOM_PROVIDER_PREFIX, toCustomProviderConfig } from "@/lib/providers";
import type {
  AttachedFile,
  BackendMessage,
  BackendSkill,
  BackendSubAgent,
  ChatMessage,
  MemoryFile,
  SSEEventData,
  TodoItem,
} from "@/types";
import { uid } from "@/utils/id";

/**
 * Convert the file objects the backend streams (AttachedFileInfo shape) into the frontend
 * AttachedFile shape, assigning a stable id and dropping anything that lacks a usable path.
 */
function normalizeAttachedFiles(
  raw: unknown,
  prefix = "att",
): AttachedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: AttachedFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const path = typeof record.path === "string" && record.path.trim().length > 0 ? record.path.trim() : "";
    if (!path) continue;
    const name =
      typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : path.split("/").pop() ?? path;
    out.push({
      id: uid(prefix),
      name,
      path,
      size: typeof record.size === "number" ? record.size : 0,
      content_type: typeof record.content_type === "string" ? record.content_type : "application/octet-stream",
      size_label: typeof record.size_label === "string" ? record.size_label : undefined,
    });
  }
  return out;
}

/** Pull the url out of an embed_url tool result / event payload, or "" when absent. */
function extractUrl(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : "";
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

/**
 * Persist an LLM-created sub-agent (create_sub_agent result) into the browser-local store so it
 * becomes a user-owned sub-agent available in this and future sessions. Re-creating an existing
 * name updates it in place instead of duplicating.
 */
function persistCreatedSubAgent(
  s: ReturnType<typeof useStore.getState>,
  raw: Record<string, unknown>,
): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const systemPrompt = typeof raw.system_prompt === "string" ? raw.system_prompt : "";
  const tools = Array.isArray(raw.tools) ? raw.tools.filter((t): t is string => typeof t === "string") : [];
  const existing = s.subAgents.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    s.updateSubAgent(existing.id, { name, description, systemPrompt, tools, enabled: true });
  } else {
    s.addSubAgent({ name, description, systemPrompt, tools, enabled: true });
  }
}

/**
 * Persist an LLM-created skill (create_skill result) into the browser-local store so it becomes a
 * user-owned skill available in this and future sessions. The returned skill_file is treated as
 * the entry file and its content as the entry content; all remaining files are stored alongside.
 */
function persistCreatedSkill(
  s: ReturnType<typeof useStore.getState>,
  raw: Record<string, unknown>,
): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const skillFile = (typeof raw.skill_file === "string" && raw.skill_file.trim().length > 0
    ? raw.skill_file
    : "SKILL.md").replace(/^[\\/]+/, "");
  const rawFiles = Array.isArray(raw.files) ? raw.files : [];
  const files: Array<{ path: string; content: string }> = [];
  for (const f of rawFiles) {
    if (!f || typeof f !== "object") continue;
    const rec = f as Record<string, unknown>;
    const p = typeof rec.path === "string" ? rec.path.trim().replace(/^[\\/]+/, "") : "";
    if (!p) continue;
    files.push({ path: p, content: typeof rec.content === "string" ? rec.content : "" });
  }

  const entry = files.find((f) => f.path.toLowerCase() === skillFile.toLowerCase());
  const entryContent = entry?.content ?? "";
  const skillContent =
    typeof raw.skill_content === "string" && raw.skill_content.trim().length > 0
      ? raw.skill_content
      : entryContent;
  const extraFiles = files.filter((f) => f.path.toLowerCase() !== skillFile.toLowerCase());

  const existing = s.skills.find((sk) => sk.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) {
    s.updateSkill(existing.id, {
      name,
      description,
      skillFile,
      skillContent,
      files: extraFiles,
      enabled: true,
    });
  } else {
    s.addSkill({ name, description, skillFile, skillContent, files: extraFiles, enabled: true });
  }
}

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

      // Skill definitions also live in the browser and travel with each turn. The entry file
      // (skillFile/skillContent) is flattened into the files array alongside the extra files so
      // the backend receives every file the skill folder should contain.
      const skills: BackendSkill[] = store.skills.map((sk) => {
        const entryName = sk.skillFile.trim() || "SKILL.md";
        const files = [
          { path: entryName, content: sk.skillContent },
          ...sk.files
            .filter((f) => f.path.trim().length > 0)
            .map((f) => ({ path: f.path.trim(), content: f.content })),
        ];
        return {
          name: sk.name,
          description: sk.description,
          skill_file: entryName,
          files,
          enabled: sk.enabled,
        };
      });

      // Todo definitions live in the browser (localStorage) and travel with each turn. They are
      // the authoritative task list the LLM reads/writes via the TodoWrite / read_todos tools.
      const todos: TodoItem[] = store.todos;

      // Memory files live in the browser (localStorage) and travel with each turn. They are the
      // agent's persistent, self-maintained memory read/written via the `memory` tool. The three
      // pre-added files (MEMORY.md, SOUL.md, USER.md) are auto-loaded by the backend into the
      // first message of a chat.
      const memory: MemoryFile[] = store.memory;

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
            fetch_provider: settings.fetchProvider,
            firecrawl_api_key: settings.firecrawlApiKey || undefined,
            sub_agents: subAgents,
            skills,
            todos,
            memory,
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
                  // Persist LLM-created sub-agents / skills into the browser store so they are
                  // treated as user-owned and available in future sessions.
                  const payload = (data.result as Record<string, unknown> | undefined)?.data as
                    | Record<string, unknown>
                    | undefined;
                  if (ok && name === "create_sub_agent" && payload?.created_sub_agent) {
                    persistCreatedSubAgent(s, payload.created_sub_agent as Record<string, unknown>);
                  }
                  if (ok && name === "create_skill" && payload?.created_skill) {
                    persistCreatedSkill(s, payload.created_skill as Record<string, unknown>);
                  }
                  // Todo tools carry the full updated todo list in the result data — persist it so
                  // the popup and browser storage match the latest agent state.
                  if ((name === "TodoWrite" || name === "read_todos") && Array.isArray(payload?.todos)) {
                    s.setTodos(payload.todos as TodoItem[]);
                  }
                  // embed_url — reflect the URL in the browser preview panel (backup to the event).
                  if (name === "embed_url") {
                    const url = extractUrl(data.result);
                    if (url) {
                      s.setPreview(url);
                      s.setPreviewOpen(true);
                    }
                  }
                  // attach_files — surface the attached files in the popup (backup to the event).
                  if (name === "attach_files") {
                    const files = normalizeAttachedFiles(payload?.files, "att");
                    if (files.length > 0) {
                      s.addAttachedFiles(files);
                      s.setFilesOpen(true);
                    }
                  }
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
                case "todo_updated": {
                  // TodoWrite replaced the todo list — persist it to the browser so it survives
                  // reloads and stays in sync with the popup and future turns.
                  if (Array.isArray(data.todos)) {
                    s.setTodos(data.todos as TodoItem[]);
                  }
                  break;
                }
                case "memory_updated": {
                  // The memory tool wrote/edited/deleted a file — persist the full current set to
                  // the browser so it survives reloads and travels with future turns/sessions.
                  if (Array.isArray(data.memoryFiles)) {
                    s.setMemory(data.memoryFiles as MemoryFile[]);
                  }
                  break;
                }
                case "embed_url": {
                  // The embed_url tool opened the browser preview panel — render the URL live.
                  const url = extractUrl(data);
                  if (url) {
                    s.setPreview(url);
                    s.setPreviewOpen(true);
                  }
                  break;
                }
                case "attach_files": {
                  // The attach_files tool surfaced files — add them to the popup and open it.
                  const files = normalizeAttachedFiles(data.files, "att");
                  if (files.length > 0) {
                    s.addAttachedFiles(files);
                    s.setFilesOpen(true);
                  }
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
