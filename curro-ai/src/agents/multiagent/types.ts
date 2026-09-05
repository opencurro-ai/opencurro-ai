import type { StoredMessage } from "../../services/sessionStore.js";
import type {
  KnowledgeFile,
  MemoryFile,
  SkillDefinition,
  SubAgentDefinition,
  TeamMemberStatus,
  TodoItem,
} from "../tools/types.js";

/**
 * A single team member agent, authored by the user in the frontend and sent with each turn.
 * The member's `name` doubles as its unique agent id used for routing messages. Each member is a
 * real agent with its own persistent session/context — NOT a sub-agent — reused across the whole
 * team turn (and across turns while the team stays active).
 */
export interface TeamMemberDefinition {
  /** Unique agent id + display name (e.g. "Niko"). The name IS the agent id. */
  name: string;
  /** Short description of the member's specialization/role (shown to the leader and other members). */
  description: string;
  /** The system prompt that specialises this member. */
  system_prompt: string;
  /** When false the member is excluded from the team for this run. */
  enabled?: boolean;
}

/** The team leader/head agent — only a name and a system prompt (no description needed). */
export interface TeamLeaderDefinition {
  /** Display name + agent id of the leader (e.g. "Elio"). */
  name: string;
  /** The system prompt that specialises the leader. */
  system_prompt: string;
}

/** A full multi-agent team: a leader plus its members. Authored in the frontend, stored in SQLite. */
export interface TeamDefinition {
  /** Stable unique id of the team. */
  id: string;
  /** Human readable team name (e.g. "saas build"). */
  name: string;
  /** The team leader/head. */
  leader: TeamLeaderDefinition;
  /** The team members. */
  members: TeamMemberDefinition[];
  /** When false the team is not usable (the user's on/off toggle for the team). */
  enabled?: boolean;
}

/**
 * Everything the multi-agent runner needs to execute a team turn. Mirrors the single-agent
 * RunAgentRequest for the provider/model/credentials/web/runtime-state fields, plus the team.
 */
export interface MultiAgentRunRequest {
  chatId: string;
  userMessage: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  customProvider?: unknown;
  temperature?: number;
  effort?: string;
  /** The active team for this run. */
  team: TeamDefinition;
  /** Whether the send_message_to_team (agent-to-agent messaging) tool is enabled. */
  enableTeamMessaging: boolean;
  /** Per-request web tool keys/provider (from frontend settings). */
  tavilyApiKey?: string;
  exaApiKey?: string;
  serpapiApiKey?: string;
  firecrawlApiKey?: string;
  searchProvider?: "duckduckgo" | "tavily" | "exa" | "serpapi";
  fetchProvider?: "builtin" | "firecrawl";
  /** User runtime state (shared across every agent in the team, like the single agent). */
  subAgents?: SubAgentDefinition[];
  skills?: SkillDefinition[];
  todos?: TodoItem[];
  memory?: MemoryFile[];
  knowledge?: KnowledgeFile[];
}

/** Whether an agent is the head/leader or a regular member. */
export type AgentRole = "head" | "member";

/** Lifecycle status of an agent actor within a team turn. */
export type ActorStatus = "idle" | "queued" | "working" | "done" | "failed";

/** A message queued in an agent's inbox, waiting to be delivered when the agent next runs. */
export interface InboxMessage {
  /** Agent id of the sender. */
  fromId: string;
  /** Display name of the sender. */
  fromName: string;
  /** Role of the sender. */
  fromRole: AgentRole;
  /** How the message was sent (for framing + monitoring). */
  kind: "delegate" | "team_message" | "report" | "user";
  /** The message body. */
  message: string;
}

/** Maps an ActorStatus to the tool-facing TeamMemberStatus. */
export function toMemberStatus(status: ActorStatus | undefined): TeamMemberStatus {
  switch (status) {
    case "idle":
      return "idle";
    case "queued":
      return "queued";
    case "working":
      return "working";
    case "done":
      return "done";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

export type { StoredMessage };
