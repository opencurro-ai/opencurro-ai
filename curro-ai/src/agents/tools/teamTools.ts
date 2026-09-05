/**
 * The multi-agent team tools. These are the collaboration tools used only by agents running inside
 * a multi-agent team (the head/leader and the members). They are the single canonical list, reused
 * to:
 *   - hide every team tool from the ordinary single agent (AgentRunner filters these out),
 *   - restrict them from sub-agents (a sub-agent spawned by a team member must not manage the team),
 *   - and select the per-role subset advertised to the head vs. a member at team runtime.
 *
 * Visibility per role is enforced at team runtime by advertising only the right subset in each
 * agent's tool schemas; this list is the superset that is always kept out of non-team contexts.
 */

/** Head-only team tools. */
export const TEAM_HEAD_ONLY_TOOLS = [
  "delegate_task_or_send_message",
  "get_team_members_status",
] as const;

/** Member-only team tools. */
export const TEAM_MEMBER_ONLY_TOOLS = ["message_team_leader"] as const;

/** Team tools available to both the head and the members. */
export const TEAM_SHARED_TOOLS = ["list_agent_team_members", "send_message_to_team"] as const;

/**
 * The team tool gated behind the "agent-to-agent messaging" setting. When the setting is off it is
 * hidden from every agent (head and members) and its guidance is omitted from the system prompt.
 */
export const TEAM_MESSAGING_TOOL = "send_message_to_team";

/** Every team tool name — the superset kept out of single-agent and sub-agent contexts. */
export const TEAM_TOOLS: readonly string[] = [
  ...TEAM_HEAD_ONLY_TOOLS,
  ...TEAM_MEMBER_ONLY_TOOLS,
  ...TEAM_SHARED_TOOLS,
];

/** True when the given tool name is one of the multi-agent team tools. */
export function isTeamTool(name: string): boolean {
  return TEAM_TOOLS.includes(name);
}
