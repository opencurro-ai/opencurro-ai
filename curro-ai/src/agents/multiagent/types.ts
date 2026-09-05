import type { StoredMessage } from "../../services/sessionStore.js";
import type { TeamAgentRole, TeamAgentStatus } from "../tools/types.js";

/**
 * A single team member definition, authored in the frontend (multi-agent team page) and sent to the
 * backend with each turn when the active team is enabled. The member's `name` is its unique agent id.
 */
export interface TeamMemberDefinition {
  /** Unique name used as the member's agent id (e.g. "Niko"). */
  name: string;
  /** Short human description of the member's specialization (shown by list_agent_team_members). */
  description: string;
  /** The complete system prompt that specialises this member. */
  system_prompt: string;
}

/** The team head/leader definition — only a name and a system prompt. */
export interface TeamHeadDefinition {
  /** The head's display name (also its agent id). */
  name: string;
  /** The head's complete system prompt. */
  system_prompt: string;
}

/** A full multi-agent collaboration team definition sent from the frontend. */
export interface TeamDefinition {
  /** Team name (e.g. "saas build"). */
  name: string;
  head: TeamHeadDefinition;
  members: TeamMemberDefinition[];
}

/**
 * A message queued for delivery to a team agent. `from` is the sending agent's id (or "user" for the
 * originating user request); `body` is the message text. Queued messages are drained together and
 * delivered as a single combined user turn when the agent becomes free.
 */
export interface TeamInboxMessage {
  /** Sender agent id, or "user" when it is the originating user request. */
  from: string;
  /** Human-readable sender label (name / role) used to frame the delivered message. */
  fromLabel: string;
  /** The message content. */
  body: string;
}

/** Internal live state of one team agent (actor) within a running team turn. */
export interface TeamActor {
  /** The agent id (its name). */
  id: string;
  /** Display name. */
  name: string;
  role: TeamAgentRole;
  description: string;
  /** The agent's system prompt. */
  systemPrompt: string;
  /** The agent's full conversation history (provider format), preserved across activations. */
  history: StoredMessage[];
  /** Pending messages waiting to be delivered to this agent. */
  inbox: TeamInboxMessage[];
  /** True while the agent's loop is executing (used to serialize its runs). */
  running: boolean;
  /** True once the agent has been permanently stopped for this turn. */
  stopped: boolean;
  /** Whether this actor has ever been activated (started at least once) this turn. */
  activated: boolean;
}

/** Map an actor's live flags to the public status reported by get_team_members_status. */
export function actorStatus(actor: TeamActor): TeamAgentStatus {
  if (actor.stopped) return "stopped";
  if (actor.running) return "working";
  if (actor.inbox.length > 0) return "queued";
  return "idle";
}
