import { Router, type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { AgentRunner, type RunAgentRequest } from "../agents/agent.js";
import { SessionEventBuffer } from "../services/eventBuffer.js";
import type { SessionStore, StoredMessage } from "../services/sessionStore.js";
import type { PlanApprovalStore } from "../services/planApprovalStore.js";
import type { QuestionStore } from "../services/questionStore.js";
import type { SkillDefinition, SkillFileDefinition, SubAgentDefinition } from "../agents/tools/types.js";
import { normalizeTodos } from "../agents/todos.js";
import { initSSE, formatSSE } from "../utils/sse.js";

/** Extract a string field from an untrusted object (used on the custom_provider payload). */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Derive the API key used for provider auth: prefer the top-level key, else custom provider's. */
function effectiveApiKey(body: StreamBody): string {
  const top = (body.api_key ?? "").trim();
  if (top) return top;
  if (body.custom_provider && typeof body.custom_provider === "object") {
    const custom = body.custom_provider as Record<string, unknown>;
    return str(custom.apiKey);
  }
  return "";
}

interface StreamBody {
  chat_id?: string;
  user_message?: string;
  history?: StoredMessage[];
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  custom_provider?: unknown;
  max_iterations?: number;
  temperature?: number;
  since_event_id?: number;
  tavily_api_key?: string;
  exa_api_key?: string;
  serpapi_api_key?: string;
  search_provider?: "duckduckgo" | "tavily" | "exa" | "serpapi";
  fetch_provider?: "builtin" | "firecrawl";
  firecrawl_api_key?: string;
  sub_agents?: unknown;
  skills?: unknown;
  todos?: unknown;
}

/** Defensively coerce the client-provided sub-agent definitions into safe, well-typed values. */
function normalizeSubAgents(raw: unknown): SubAgentDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: SubAgentDefinition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const systemPrompt =
      typeof record.system_prompt === "string"
        ? record.system_prompt
        : typeof record.systemPrompt === "string"
          ? (record.systemPrompt as string)
          : "";
    const tools = Array.isArray(record.tools)
      ? record.tools.filter((t): t is string => typeof t === "string")
      : [];
    out.push({
      name,
      description: typeof record.description === "string" ? record.description : "",
      system_prompt: systemPrompt,
      tools,
      enabled: record.enabled !== false,
    });
  }
  return out;
}

/** Defensively coerce the client-provided skill definitions into safe, well-typed values. */
function normalizeSkills(raw: unknown): SkillDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: SkillDefinition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;

    const skillFile =
      typeof record.skill_file === "string" && record.skill_file.trim().length > 0
        ? record.skill_file.trim()
        : typeof record.skillFile === "string" && record.skillFile.trim().length > 0
          ? record.skillFile.trim()
          : "SKILL.md";

    const rawFiles = Array.isArray(record.files) ? record.files : [];
    const files: SkillFileDefinition[] = [];
    for (const file of rawFiles) {
      if (!file || typeof file !== "object") continue;
      const f = file as Record<string, unknown>;
      const path = typeof f.path === "string" ? f.path.trim() : "";
      if (!path) continue;
      files.push({ path, content: typeof f.content === "string" ? f.content : "" });
    }

    out.push({
      name,
      description: typeof record.description === "string" ? record.description : "",
      skillFile,
      files,
      enabled: record.enabled !== false,
    });
  }
  return out;
}

export function buildChatRouter(
  agent: AgentRunner,
  store: SessionStore,
  config: AppConfig,
  planApprovals: PlanApprovalStore,
  askQuestions: QuestionStore,
): Router {
  const router = Router();

  router.post("/abort/:chatId", (req: Request, res: Response) => {
    const session = store.get(String(req.params.chatId));
    if (!session) {
      res.json({ ok: false });
      return;
    }
    session.abortController?.abort();
    session.eventBuffer?.setDone();
    session.running = false;
    res.json({ ok: true });
  });

  /**
   * Supply the user's decision for a pending submit_plan review.
   *   body: { decision: "approved" | "canceled" | "edited", plan?: string }
   * `plan` is required (and enforced) when decision is "edited". A no-op (ok:false) is returned
   * when no matching pending plan exists (already decided, timed out, or aborted).
   */
  router.post("/plan/:chatId/:toolCallId", (req: Request, res: Response) => {
    const chatId = String(req.params.chatId);
    const toolCallId = String(req.params.toolCallId);
    const body = (req.body ?? {}) as { decision?: unknown; plan?: unknown };

    const decision = String(body.decision ?? "");
    if (decision !== "approved" && decision !== "canceled" && decision !== "edited") {
      res.status(400).json({ error: "decision must be one of approved, canceled, edited." });
      return;
    }

    const plan = typeof body.plan === "string" ? body.plan : "";
    if (decision === "edited" && plan.trim().length === 0) {
      res.status(400).json({ error: "A non-empty plan is required when decision is edited." });
      return;
    }

    const supplied = planApprovals.decide(chatId, toolCallId, decision, decision === "edited" ? plan : undefined);
    res.json({ ok: supplied });
  });

  /**
   * Supply the user's answers for a pending ask_question_to_user request.
   *   body: { answers: [{ question: string, answer: string }] }
   * A no-op (ok:false) is returned when no matching pending request exists (already
   * answered, timed out, or aborted).
   */
  router.post("/question/:chatId/:toolCallId", (req: Request, res: Response) => {
    const chatId = String(req.params.chatId);
    const toolCallId = String(req.params.toolCallId);
    const body = (req.body ?? {}) as { answers?: unknown };

    if (!Array.isArray(body.answers)) {
      res.status(400).json({ error: "answers must be an array of { question, answer } objects." });
      return;
    }

    const answers = body.answers
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        question: typeof item.question === "string" ? item.question : "",
        answer: typeof item.answer === "string" ? item.answer : "",
      }))
      .filter((a) => a.question.trim().length > 0);

    if (answers.length === 0) {
      res.status(400).json({ error: "At least one non-empty answer is required." });
      return;
    }

    const supplied = askQuestions.submitAnswers(chatId, toolCallId, answers);
    res.json({ ok: supplied });
  });

  router.post("/stream", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as StreamBody;
    const chatId = body.chat_id?.trim();
    if (!chatId) {
      res.status(400).json({ error: "chat_id is required." });
      return;
    }

    const startNew = Boolean(
      body.user_message &&
        body.provider &&
        body.model &&
        (body.api_key || Boolean(body.custom_provider)),
    );

    if (startNew) {
      // Cancel any in-flight turn for this chat before starting a fresh one.
      const existing = store.get(chatId);
      if (existing?.running) {
        existing.abortController?.abort();
        existing.eventBuffer?.setDone();
      }

      const session = store.hydrate(chatId, body.history ?? []);
      const buffer = new SessionEventBuffer();
      const abortController = new AbortController();
      session.eventBuffer = buffer;
      session.abortController = abortController;
      session.running = true;

      const runRequest: RunAgentRequest = {
        chatId,
        userMessage: body.user_message!,
        provider: body.provider!,
        model: body.model!,
        apiKey: effectiveApiKey(body),
        baseUrl: body.base_url,
        customProvider: body.custom_provider,
        maxIterations: body.max_iterations ?? config.maxIterations,
        temperature: body.temperature,
        tavilyApiKey: body.tavily_api_key,
        exaApiKey: body.exa_api_key,
        serpapiApiKey: body.serpapi_api_key,
        searchProvider: body.search_provider,
        fetchProvider: body.fetch_provider,
        firecrawlApiKey: body.firecrawl_api_key,
        subAgents: normalizeSubAgents(body.sub_agents),
        skills: normalizeSkills(body.skills),
        todos: normalizeTodos(body.todos),
      };

      // Fire-and-forget the autonomous agent loop; the response streams from the buffer.
      void agent.run(runRequest, session, buffer, abortController.signal).catch((error) => {
        buffer.append("error", {
          code: "agent_crashed",
          message: error instanceof Error ? error.message : String(error),
        });
        buffer.setDone();
        session.running = false;
      });

      await streamFromBuffer(res, buffer, body.since_event_id ?? -1);
      return;
    }

    // Reconnect path: attach to an existing buffer and replay from since_event_id.
    const session = store.get(chatId);
    if (session?.eventBuffer) {
      await streamFromBuffer(res, session.eventBuffer, body.since_event_id ?? -1);
      return;
    }

    res.status(400).json({ error: "No active agent and no user_message provided." });
  });

  return router;
}

async function streamFromBuffer(
  res: Response,
  buffer: SessionEventBuffer,
  sinceId: number,
): Promise<void> {
  initSSE(res);
  let closed = false;
  res.on("close", () => {
    closed = true;
  });

  try {
    for await (const event of buffer.subscribe(sinceId)) {
      if (closed) break;
      res.write(formatSSE(event.event, event.data));
    }
  } catch {
    // client disconnected or buffer ended; fall through to close.
  } finally {
    if (!closed) res.end();
  }
}
