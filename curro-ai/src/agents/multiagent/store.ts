import type { StoredMessage } from "../../services/sessionStore.js";

/**
 * In-memory store of every team agent's conversation history, keyed by chat id. This preserves each
 * agent's context ACROSS user turns of the same chat (each /stream call is a fresh TeamRunner, but
 * the actors resume the histories stored here), mirroring how the SessionStore keeps the main
 * agent's live transcript. It is runtime-only, like SessionStore — the durable record of what
 * happened is the SQLite event log.
 */
export class TeamSessionStore {
  /** chatId -> (lowercased agent id -> that agent's conversation history). */
  private readonly byChat = new Map<string, Map<string, StoredMessage[]>>();

  /** The stored per-agent histories for a chat (empty map when none exist yet). */
  get(chatId: string): Map<string, StoredMessage[]> {
    return this.byChat.get(chatId) ?? new Map<string, StoredMessage[]>();
  }

  /** Replace the stored per-agent histories for a chat. */
  set(chatId: string, histories: Map<string, StoredMessage[]>): void {
    this.byChat.set(chatId, histories);
  }

  /** Drop a chat's stored team histories (e.g. when the session is deleted). */
  delete(chatId: string): void {
    this.byChat.delete(chatId);
  }
}
