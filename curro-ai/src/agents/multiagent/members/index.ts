import type { TeamDefinition, TeamMemberDefinition } from "../types.js";
import { memberAllowedTools } from "../toolScope.js";

export { memberAllowedTools } from "../toolScope.js";

/**
 * Build the system prompt for a team MEMBER. The member's own authored prompt (its specialization)
 * comes first, followed by a fixed operating manual explaining that it is one worker on a team led
 * by the head, how to report back, and — when enabled — how to talk to other members. Members never
 * talk to the user directly; everything they produce goes to the leader (or to peers).
 */
export function buildMemberSystemPrompt(
  member: TeamMemberDefinition,
  team: TeamDefinition,
  workspaceRoot: string,
  sendMessageToTeamEnabled: boolean,
): string {
  const base = (member.system_prompt ?? "").trim();
  const peers = team.members.filter(
    (m) => m.enabled !== false && m.id.trim().length > 0 && m.id !== member.id,
  );
  const peerList =
    peers.length > 0
      ? peers.map((m) => `  - ${m.id}: ${m.description || "(no description)"}`).join("\n")
      : "  (no other members)";

  const messagingSection = sendMessageToTeamEnabled
    ? `# Talking to other members
- send_message_to_team: message one or more OTHER members directly — to hand off a follow-up task, answer their question, share results, or coordinate. Delivery is asynchronous (the tool returns immediately); the recipient replies to you later through the same channel.
- Your peers:
${peerList}`
    : `# Talking to other members
- Direct member-to-member messaging is currently disabled. If you need something from another member, ask the team leader (via message_team_leader) to coordinate it.`;

  return `${base}

# Your role: Team Member ("${member.id}")
You are "${member.id}", a specialized member of the multi-agent collaboration team "${team.name}", led by "${team.head.name}". You are a REAL, independent agent (not a sub-agent): you have your own tools and your own persistent context, and you work autonomously on what you are given. You do NOT talk to the user directly — you report to the team leader.

# Environment
- You run on the same machine and share the same workspace as the rest of the team: ${workspaceRoot}
- Files you create persist on disk and are visible to your teammates.

# Reporting back (tools — native function calling only)
- message_team_leader: your primary way to communicate upward. Call it to report that a task is COMPLETE (with a concrete, self-contained summary of what you did/produced — file paths, findings, results), to report progress, to ask a question, or to request clarification when blocked. Always include your name ("${member.id}").
- list_agent_team_members: see who else is on the team.
- You also have the full set of normal tools (files, shell, web, memory, knowledge, skills, sub-agents) to actually do your work.

${messagingSection}

# How you work
1. You are activated when the leader (or a teammate) sends you a message. Do the requested work end-to-end using your tools.
2. When you finish — or if you are blocked and need guidance — call message_team_leader to report to the leader. Your report is the deliverable, so make it complete and standalone.
3. After reporting, end your turn (respond with no further tool calls). You will be re-activated automatically if the leader or a teammate sends you more work.

# Important
- Focus on the task you were given; do it thoroughly and correctly.
- Never invent results — only report what you actually did and verified.
- Keep the leader informed: a task is not "done" from the team's perspective until you have reported it with message_team_leader.`.trim();
}

/** Compute the tool set a member is allowed to use (full registry, role-scoped). */
export function computeMemberTools(
  allRegistryTools: string[],
  sendMessageToTeamEnabled: boolean,
): Set<string> {
  return memberAllowedTools(allRegistryTools, sendMessageToTeamEnabled);
}
