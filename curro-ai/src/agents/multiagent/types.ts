import type { StoredMessage } from "../../services/sessionStore.js";
import type { TeamAgentStatus } from "../tools/types.js";

export type { TeamAgentStatus } from "../tools/types.js";

/**
 * A single team member (worker) of a multi-agent collaboration team. Definitions are authored in the
 * frontend and travel with each turn on the wire (like sub-agents/skills). The member's `id` is also
 * its display name — the user names each member, and that name IS the agent id the head/other members
 * address it by.
 */
export interface TeamMemberDefinition {
  /** Unique id + display name the head and other members use to address this member. */
  id: string;
  /** Short description of the member's specialization (shown by list_agent_team_members). */
  description: string;
  /** The member's specialized system prompt. */
  system_prompt: string;
  /** When false the member is hidden from the roster and cannot be addressed. */
  enabled?: boolean;
}

/**
 * A full multi-agent team: a single head/leader agent plus its members. The head coordinates and
 * reviews; members do the work. Authored in the frontend, sent with each turn.
 */
export interface TeamDefinition {
  /** Stable team id (frontend-generated). */
  id: string;
  /** Team display name. */
  name: string;
  /** The head/leader — only a name and a system prompt (it has no fixed specialization). */
  head: {
    /** Display name of the leader (also its agent id, always normalized to "head" internally). */
    name: string;
    system_prompt: string;
  };
  /** The team members (workers). */
  members: TeamMemberDefinition[];
  /** When false the whole team is inactive (the user toggles which team is active). */
  enabled?: boolean;
}

/** The canonical internal agent id of the head/leader. Members use their own ids. */
export const HEAD_AGENT_ID = "head";

/** Kinds of message that can flow between agents. */
export type TeamMessageKind = "task" | "message";

/** A single message routed between agents (user→head, head→member, member→head, member→member). */
export interface TeamMessage {
  /** Sender agent id ("user" for the initial prompt, HEAD_AGENT_ID for the head, or a member id). */
  from: string;
  /** Human-facing sender name (for rendering + prompt headers). */
  fromName: string;
  /** Recipient agent id (HEAD_AGENT_ID or a member id). */
  to: string;
  /** Whether this is a delegated task or a general message. */
  kind: TeamMessageKind;
  /** The message body. */
  message: string;
  /** Epoch ms the message was created. */
  createdAt: number;
}

/** Live in-memory state of one agent (head or member) during a team turn. */
export interface TeamAgentState {
  id: string;
  name: string;
  role: "head" | "member";
  systemPrompt: string;
  /** The agent's persistent provider-format conversation (grows across activations + turns). */
  history: StoredMessage[];
  /** Pending messages waiting to be processed on the next activation (coalesced into one prompt). */
  inbox: TeamMessage[];
  /** True while an activation of this agent is currently executing. */
  running: boolean;
  /** Current lifecycle state (for status queries + the monitoring panel). */
  status: TeamAgentStatus;
  /** Monotonic activation counter — used to mint unique per-activation ids for the UI. */
  activations: number;
  /** Epoch ms of the last state change. */
  updatedAt: number;
}
