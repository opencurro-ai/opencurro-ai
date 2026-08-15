import { Router, type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { AgentRunner, type RunAgentRequest } from "../agents/agent.js";
import { SessionEventBuffer } from "../services/eventBuffer.js";
import type { SessionStore, StoredMessage } from "../services/sessionStore.js";
import type { SubAgentDefinition } from "../agents/tools/types.js";
import { initSSE, formatSSE } from "../utils/sse.js";

interface StreamBody {
  chat_id?: string;
  user_message?: string;
  history?: StoredMessage[];
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  max_iterations?: number;
  temperature?: number;
  since_event_id?: number;
  tavily_api_key?: string;
  exa_api_key?: string;
  serpapi_api_key?: string;
  search_provider?: "tavily" | "exa" | "serpapi";
  firecrawl_api_key?: string;
  sub_agents?: unknown;
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

export function buildChatRouter(
  agent: AgentRunner,
  store: SessionStore,
  config: AppConfig,
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

  router.post("/stream", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as StreamBody;
    const chatId = body.chat_id?.trim();
    if (!chatId) {
      res.status(400).json({ error: "chat_id is required." });
      return;
    }

    const startNew = Boolean(
      body.user_message && body.provider && body.model && body.api_key,
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
        apiKey: body.api_key!,
        baseUrl: body.base_url,
        maxIterations: body.max_iterations ?? config.maxIterations,
        temperature: body.temperature,
        tavilyApiKey: body.tavily_api_key,
        exaApiKey: body.exa_api_key,
        serpapiApiKey: body.serpapi_api_key,
        searchProvider: body.search_provider,
        firecrawlApiKey: body.firecrawl_api_key,
        subAgents: normalizeSubAgents(body.sub_agents),
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
