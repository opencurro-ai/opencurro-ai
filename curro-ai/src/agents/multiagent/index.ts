/**
 * The multi-agent collaboration team ("multiagent").
 *
 * A real team of full agents — a head/leader plus specialist members — that collaborate to achieve
 * the user's goal. Unlike the sub-agent system (one-way, isolated, non-recursive delegation), this
 * is a peer collaboration: the head delegates and reviews, members work autonomously and report
 * back, and members can message each other (when enabled). Every agent reuses its OWN persistent
 * session/context; messages between agents are routed through inboxes and executed by a bounded,
 * queue-driven scheduler that makes runaway concurrency/token flooding impossible.
 *
 * Runtime layout:
 *  - head/    — the team leader's system prompt (the orchestrator wires the head loop).
 *  - members/ — the members' system prompt (the orchestrator wires the member loops).
 */
export { MultiAgentRunner } from "./orchestrator.js";
export { DEFAULT_TEAM, DEFAULT_TEAM_ID } from "./defaultTeam.js";
export { teamSessionStore } from "./teamSessionStore.js";
export type {
  TeamDefinition,
  TeamLeaderDefinition,
  TeamMemberDefinition,
  MultiAgentRunRequest,
  AgentRole,
  ActorStatus,
  InboxMessage,
} from "./types.js";
export { normalizeTeam } from "./normalize.js";
