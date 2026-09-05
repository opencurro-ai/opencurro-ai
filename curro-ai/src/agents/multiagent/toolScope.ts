import { HEAD_TEAM_TOOLS, MEMBER_TEAM_TOOLS, isTeamTool } from "../tools/teamTools.js";

/**
 * Tool scoping for the multi-agent team.
 *
 * Both the head and the members are granted the FULL agent tool registry (file, shell, web, memory,
 * knowledge, skills, and even sub-agent delegation — as the feature requires) with three carve-outs:
 *
 *  1. The team tools themselves are removed from the base and re-added per role (each role only sees
 *     the team tools that belong to it).
 *  2. The sub-agent SESSION-reuse tools are gated behind a niche setting for the single agent; team
 *     agents simply do not use them, so they are excluded to keep the surface predictable.
 *  3. The human-in-the-loop tools (submit_plan / ask_question_to_user) are HEAD-ONLY — only the
 *     user-facing leader may pause to talk to the user. Members never block the whole team waiting on
 *     a human, which is a deliberate anti-freeze choice.
 */

/** Sub-agent session-reuse tools — excluded from every team agent. */
const SESSION_REUSE_TOOLS: readonly string[] = [
  "list_sub_agent_sessions",
  "reuse_same_sub_agent_session",
];

/** Human-in-the-loop tools — granted to the head only. */
export const HEAD_ONLY_EXTRA_TOOLS: readonly string[] = ["submit_plan", "ask_question_to_user"];

const HEAD_ONLY_SET = new Set(HEAD_ONLY_EXTRA_TOOLS);
const SESSION_REUSE_SET = new Set(SESSION_REUSE_TOOLS);

/** The base tool set both roles share: every registry tool minus team/session-reuse/head-only tools. */
function baseTools(allRegistryTools: string[]): string[] {
  return allRegistryTools.filter(
    (name) => !isTeamTool(name) && !SESSION_REUSE_SET.has(name) && !HEAD_ONLY_SET.has(name),
  );
}

/** The tools the HEAD may use: base + head team tools + human-in-the-loop tools. */
export function headAllowedTools(allRegistryTools: string[]): Set<string> {
  const set = new Set(baseTools(allRegistryTools));
  for (const t of HEAD_TEAM_TOOLS) if (allRegistryTools.includes(t)) set.add(t);
  for (const t of HEAD_ONLY_EXTRA_TOOLS) if (allRegistryTools.includes(t)) set.add(t);
  return set;
}

/**
 * The tools a MEMBER may use: base + member team tools. send_message_to_team is granted only when
 * the user has enabled member-to-member messaging.
 */
export function memberAllowedTools(
  allRegistryTools: string[],
  sendMessageToTeamEnabled: boolean,
): Set<string> {
  const set = new Set(baseTools(allRegistryTools));
  for (const t of MEMBER_TEAM_TOOLS) {
    if (t === "send_message_to_team" && !sendMessageToTeamEnabled) continue;
    if (allRegistryTools.includes(t)) set.add(t);
  }
  return set;
}
