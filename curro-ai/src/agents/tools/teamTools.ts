/**
 * The single canonical list of the five multi-agent TEAM collaboration tools.
 *
 * These tools are ONLY ever available to agents participating in a multi-agent collaboration team
 * (the head leader or a member). They are registered in the shared tool registry (so the registry
 * derives their schemas and validates their arguments), but they are hidden from the normal single
 * agent and from every sub-agent: their execution requires a `team` runtime in the ToolContext,
 * which is injected only for team agents.
 *
 * Availability by role:
 *  - Head leader only:  delegate_task_or_send_message, get_team_members_status
 *  - Members (and head): send_message_to_team, message_team_leader
 *  - Everyone in the team: list_agent_team_members
 *
 * Note on message_team_leader / send_message_to_team: the head does NOT use message_team_leader
 * (it IS the leader) and does NOT use send_message_to_team (it uses delegate_task_or_send_message);
 * members do NOT use delegate_task_or_send_message / get_team_members_status. The per-role tool
 * schemas the team runtime advertises enforce this; the tools themselves also validate the caller's
 * role at runtime.
 */
export const TEAM_TOOLS: readonly string[] = [
  "delegate_task_or_send_message",
  "get_team_members_status",
  "send_message_to_team",
  "list_agent_team_members",
  "message_team_leader",
];

/** Tools exposed to the team HEAD leader (plus list_agent_team_members shared below). */
export const TEAM_HEAD_TOOLS: readonly string[] = [
  "delegate_task_or_send_message",
  "get_team_members_status",
  "list_agent_team_members",
];

/** Tools exposed to a team MEMBER (plus list_agent_team_members shared below). */
export const TEAM_MEMBER_TOOLS: readonly string[] = [
  "send_message_to_team",
  "message_team_leader",
  "list_agent_team_members",
];

/** Fast membership test for the team tool set. */
const TEAM_SET = new Set(TEAM_TOOLS);

/** True when a tool name is one of the five team collaboration tools. */
export function isTeamTool(name: string): boolean {
  return TEAM_SET.has(name);
}
