/**
 * The single canonical list of the multi-agent collaboration ("agent team") tools.
 *
 * These 5 tools ONLY exist inside a multi-agent team turn. They are never available to the normal
 * single agent, and never to sub-agents. Each is scoped to a specific role:
 *
 *  - Head/leader ONLY:
 *      delegate_task_or_send_message — assign tasks / message team members
 *      get_team_members_status       — inspect what each member is doing
 *  - Team members ONLY:
 *      message_team_leader           — report back to the head (completion, questions, updates)
 *      send_message_to_team          — member-to-member communication (gated by a user setting)
 *  - Both head and members:
 *      list_agent_team_members       — enumerate the team roster
 *
 * This list is the ONE source of truth. It is reused by:
 *  - tools/index.ts                  — registration
 *  - agent.ts                        — the single agent NEVER sees these (always filtered out)
 *  - subAgentRestrictedTools.ts      — sub-agents NEVER see these
 *  - multiagent/*                    — the head/member runners select the right subset per role
 *
 * Keep it in exactly one place; do not fork it.
 */
export const TEAM_TOOLS: readonly string[] = [
  "delegate_task_or_send_message",
  "get_team_members_status",
  "send_message_to_team",
  "list_agent_team_members",
  "message_team_leader",
];

/** Team tools the HEAD/leader may use. */
export const HEAD_TEAM_TOOLS: readonly string[] = [
  "delegate_task_or_send_message",
  "get_team_members_status",
  "list_agent_team_members",
];

/** Team tools a MEMBER may use (send_message_to_team is additionally gated by a user setting). */
export const MEMBER_TEAM_TOOLS: readonly string[] = [
  "message_team_leader",
  "send_message_to_team",
  "list_agent_team_members",
];

/** The member team tool that is only granted when the user has enabled member-to-member messaging. */
export const SEND_MESSAGE_TO_TEAM_TOOL = "send_message_to_team";

const TEAM_TOOL_SET = new Set(TEAM_TOOLS);

/** True when a tool name is one of the multi-agent team tools. */
export function isTeamTool(name: string): boolean {
  return TEAM_TOOL_SET.has(name);
}
