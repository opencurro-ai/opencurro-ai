import type { StoredMessage } from "../../services/sessionStore.js";

/**
 * Process-level store of every team agent's persistent conversation, keyed by chatId then by agent
 * id. A multi-agent turn rebuilds its orchestrator each user message, but the head and members must
 * REMEMBER their prior context across turns (and across the many activations within a turn) — this
 * singleton is where those transcripts live so nothing is lost. It mirrors how subAgentSessionStore
 * outlives a single turn.
 *
 * Only the provider-format transcript is kept here (bounded per chat). Durable persistence of the
 * user-visible stream still happens through the SSE event buffer → SQLite, exactly like the main and
 * sub agents.
 */
export interface TeamAgentTranscript {
  agentId: string;
  /** The full provider-format conversation (system prompt is applied separately at send time). */
  messages: StoredMessage[];
  updatedAt: number;
}

/** Upper bound on distinct chats retained so a long-lived process can't grow without bound. */
const MAX_CHATS = 200;

export class TeamSessionStore {
  private readonly byChat = new Map<string, Map<string, TeamAgentTranscript>>();

  /** Get an agent's stored transcript (empty array if none yet). Returns the live array by reference. */
  getMessages(chatId: string, agentId: string): StoredMessage[] {
    return this.byChat.get(chatId || "")?.get(agentId)?.messages ?? [];
  }

  /** Persist an agent's transcript (stored by reference so later mutations are reflected). */
  setMessages(chatId: string, agentId: string, messages: StoredMessage[]): void {
    const key = chatId || "";
    let agents = this.byChat.get(key);
    if (!agents) {
      // Evict the oldest chat once the cap is exceeded (Map preserves insertion order).
      while (this.byChat.size >= MAX_CHATS) {
        const oldest = this.byChat.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.byChat.delete(oldest);
      }
      agents = new Map<string, TeamAgentTranscript>();
      this.byChat.set(key, agents);
    }
    agents.set(agentId, { agentId, messages, updatedAt: Date.now() });
  }

  /** Whether any transcript exists for the chat (i.e. the team has run at least once here). */
  has(chatId: string): boolean {
    return this.byChat.has(chatId || "");
  }

  /** Remove all transcripts for a chat (used by tests / when a chat is deleted). */
  clear(chatId: string): void {
    this.byChat.delete(chatId || "");
  }
}

/** The single shared instance used by the multi-agent orchestrator. */
export const teamSessionStore = new TeamSessionStore();
