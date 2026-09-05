import type { StoredMessage } from "../../services/sessionStore.js";
import type { AgentRole } from "./types.js";

/** The persisted conversation of a single agent (head or member) across team turns. */
export interface StoredActorSession {
  id: string;
  name: string;
  role: AgentRole;
  /** The agent's full provider-format transcript, reused so context is never lost between turns. */
  history: StoredMessage[];
}

/** A team's per-chat session: one persistent conversation per agent, keyed by agent id. */
export interface TeamSession {
  chatId: string;
  teamId: string;
  actors: Map<string, StoredActorSession>;
}

/**
 * Process-level, in-memory store of team agent sessions, keyed by chatId. It keeps each agent's
 * transcript alive ACROSS user turns so the head and every member retain their full context — the
 * team collaboration tools reuse these same sessions rather than ever creating a new one. Bounded
 * per process; the newest chats are retained.
 */
class TeamSessionStore {
  private readonly sessions = new Map<string, TeamSession>();
  private readonly maxChats = 200;

  /** The team session for a chat when it exists and belongs to the same team. */
  get(chatId: string, teamId: string): TeamSession | undefined {
    const session = this.sessions.get(chatId);
    if (!session) return undefined;
    if (session.teamId !== teamId) return undefined;
    return session;
  }

  /** Create (or reset for a new team) the team session for a chat. */
  ensure(chatId: string, teamId: string): TeamSession {
    const existing = this.sessions.get(chatId);
    if (existing && existing.teamId === teamId) {
      // Refresh LRU position.
      this.sessions.delete(chatId);
      this.sessions.set(chatId, existing);
      return existing;
    }
    const session: TeamSession = { chatId, teamId, actors: new Map() };
    this.sessions.set(chatId, session);
    this.prune();
    return session;
  }

  reset(chatId: string): void {
    this.sessions.delete(chatId);
  }

  private prune(): void {
    while (this.sessions.size > this.maxChats) {
      const oldest = this.sessions.keys().next().value;
      if (oldest === undefined) break;
      this.sessions.delete(oldest);
    }
  }
}

/** Singleton team session store shared across the process. */
export const teamSessionStore = new TeamSessionStore();
