import { useStore } from "@/store/useStore";
import { uid } from "@/utils/id";
import type { StreamBatcher } from "@/lib/streamBatcher";
import type {
  AttachedFile,
  KnowledgeFile,
  MemoryFile,
  SSEEventData,
  TodoItem,
} from "@/types";

type Store = ReturnType<typeof useStore.getState>;

export interface DispatchContext {
  convId: string;
  msgId: string;
  batcher: StreamBatcher;
  onFilesChanged?: () => void;
  /** When resuming a run, the message is reset once on the first replayed event. */
  resume: { pending: boolean };
}

function normalizeAttachedFiles(raw: unknown, prefix = "att"): AttachedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: AttachedFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const path =
      typeof record.path === "string" && record.path.trim().length > 0 ? record.path.trim() : "";
    if (!path) continue;
    const name =
      typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : (path.split("/").pop() ?? path);
    out.push({
      id: uid(prefix),
      name,
      path,
      size: typeof record.size === "number" ? record.size : 0,
      content_type:
        typeof record.content_type === "string" ? record.content_type : "application/octet-stream",
      size_label: typeof record.size_label === "string" ? record.size_label : undefined,
    });
  }
  return out;
}

function extractUrl(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : "";
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

function persistCreatedSubAgent(s: Store, raw: Record<string, unknown>): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const systemPrompt = typeof raw.system_prompt === "string" ? raw.system_prompt : "";
  const tools = Array.isArray(raw.tools) ? raw.tools.filter((t): t is string => typeof t === "string") : [];
  const existing = s.subAgents.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) s.updateSubAgent(existing.id, { name, description, systemPrompt, tools, enabled: true });
  else s.addSubAgent({ name, description, systemPrompt, tools, enabled: true });
}

function persistCreatedSkill(s: Store, raw: Record<string, unknown>): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const skillFile = (
    typeof raw.skill_file === "string" && raw.skill_file.trim().length > 0 ? raw.skill_file : "SKILL.md"
  ).replace(/^[\\/]+/, "");
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
  if (existing)
    s.updateSkill(existing.id, {
      name,
      description,
      skillFile,
      skillContent,
      files: extraFiles,
      enabled: true,
    });
  else s.addSkill({ name, description, skillFile, skillContent, files: extraFiles, enabled: true });
}

/**
 * Apply a single SSE event to the store. Token/reasoning events go through the batcher
 * (rAF-coalesced); everything else is applied immediately after flushing the batcher so
 * ordering between streamed text and structured events is preserved.
 */
export function dispatchStreamEvent(event: string, data: SSEEventData, ctx: DispatchContext): void {
  const { convId, msgId, batcher } = ctx;
  const s = useStore.getState();

  // On the first replayed event of a resume, wipe the (possibly partial) message once so the
  // full replay rebuilds it deterministically — no duplicated or missing tokens.
  if (ctx.resume.pending) {
    ctx.resume.pending = false;
    s.resetMessageStream(convId, msgId);
  }

  switch (event) {
    case "reasoning":
      batcher.appendReasoning(String(data.value ?? ""));
      return;
    case "token":
      batcher.token(String(data.value ?? ""));
      return;
    case "sub_agent_reasoning":
      batcher.subReasoning(String(data.id ?? ""), String(data.value ?? ""));
      return;
    case "sub_agent_token":
      batcher.subToken(String(data.id ?? ""), String(data.value ?? ""));
      return;
  }

  // Non-delta event → make sure buffered text lands first.
  batcher.flush();

  switch (event) {
    case "tool_call":
      s.upsertTool(convId, msgId, {
        id: String(data.id ?? uid("tool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: "running",
        args: (data.args as Record<string, unknown> | undefined) ?? undefined,
        filePath: (data.args as Record<string, unknown> | undefined)?.file_path as string | undefined,
      });
      break;

    case "plan_review": {
      const planId = String(data.id ?? uid("tool"));
      s.setPlanPending(convId, msgId, planId, {
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
      s.setQuestionPending(convId, msgId, askId, {
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
      s.upsertTool(convId, msgId, {
        id,
        name,
        label: String(data.label ?? data.name ?? "tool"),
        status: ok ? "ok" : "error",
        result: data.result,
      });

      const payload = (data.result as Record<string, unknown> | undefined)?.data as
        | Record<string, unknown>
        | undefined;
      if (ok && name === "create_sub_agent" && payload?.created_sub_agent) {
        persistCreatedSubAgent(s, payload.created_sub_agent as Record<string, unknown>);
      }
      if (ok && name === "create_skill" && payload?.created_skill) {
        persistCreatedSkill(s, payload.created_skill as Record<string, unknown>);
      }
      if ((name === "TodoWrite" || name === "read_todos") && Array.isArray(payload?.todos)) {
        s.setTodos(payload.todos as TodoItem[]);
      }
      if (name === "embed_url") {
        const url = extractUrl(data.result);
        if (url) {
          s.setPreview(url);
          s.setPreviewOpen(true);
        }
      }
      if (name === "attach_files") {
        const files = normalizeAttachedFiles(payload?.files, "att");
        if (files.length > 0) {
          s.addAttachedFiles(files);
          s.setFilesOpen(true);
        }
      }
      if (name === "submit_plan" && result?.decision) {
        const map: Record<string, "approved" | "canceled" | "edited" | "timeout"> = {
          approved: "approved",
          edited: "edited",
          canceled: "canceled",
          timeout: "timeout",
        };
        const planStatus = map[result.decision];
        if (planStatus) s.setPlanStatus(convId, msgId, id, planStatus);
      }
      if (
        name === "ask_question_to_user" &&
        (result?.decision === "answered" || result?.decision === "timeout")
      ) {
        s.setQuestionStatus(convId, msgId, id, result.decision === "answered" ? "answered" : "timeout");
      }
      ctx.onFilesChanged?.();
      break;
    }

    case "todo_updated":
      if (Array.isArray(data.todos)) s.setTodos(data.todos as TodoItem[]);
      break;

    case "memory_updated":
      if (Array.isArray(data.memoryFiles)) s.setMemory(data.memoryFiles as MemoryFile[]);
      break;

    case "knowledge_updated":
      if (Array.isArray(data.knowledgeFiles)) s.setKnowledge(data.knowledgeFiles as KnowledgeFile[]);
      break;

    case "embed_url": {
      const url = extractUrl(data);
      if (url) {
        s.setPreview(url);
        s.setPreviewOpen(true);
      }
      break;
    }

    case "attach_files": {
      const files = normalizeAttachedFiles(data.files, "att");
      if (files.length > 0) {
        s.addAttachedFiles(files);
        s.setFilesOpen(true);
      }
      break;
    }

    case "sub_agent_start":
      s.startSubAgent(convId, msgId, String(data.id ?? ""), {
        agent: String(data.agent ?? ""),
        task: String(data.task ?? ""),
        background: data.background === true,
        outputFile: data.output_file != null ? String(data.output_file) : undefined,
      });
      break;

    case "sub_agent_background_started":
      // A background (wait_for_output=false) sub-agent was launched and detached from the turn.
      // Register the run so the chip renders even though no further sub_agent_* events may arrive
      // once the main turn ends (the sub-agent writes its result to the output_file instead).
      s.startSubAgent(convId, msgId, String(data.id ?? ""), {
        agent: String(data.agent ?? ""),
        task: String(data.task ?? ""),
        background: true,
        outputFile: data.output_file != null ? String(data.output_file) : undefined,
      });
      break;

    case "sub_agent_tool_call":
      s.upsertSubAgentTool(convId, msgId, String(data.id ?? ""), {
        id: String(data.tool_id ?? uid("subtool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: "running",
        args: (data.args as Record<string, unknown> | undefined) ?? undefined,
        filePath: (data.args as Record<string, unknown> | undefined)?.file_path as string | undefined,
      });
      break;

    case "sub_agent_tool_result":
      s.upsertSubAgentTool(convId, msgId, String(data.id ?? ""), {
        id: String(data.tool_id ?? uid("subtool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: data.ok ? "ok" : "error",
        result: data.result,
      });
      ctx.onFilesChanged?.();
      break;

    case "sub_agent_done":
      s.finishSubAgent(convId, msgId, String(data.id ?? ""), {
        status: data.ok ? "ok" : "error",
        output: data.output != null ? String(data.output) : undefined,
        error: data.error != null ? String(data.error) : undefined,
      });
      break;

    case "error":
      s.applyAssistantDelta(convId, msgId, {
        contentDelta: `\n\n⚠️ ${String(data.message ?? "Agent error")}`,
      });
      break;

    default:
      break;
  }
}
