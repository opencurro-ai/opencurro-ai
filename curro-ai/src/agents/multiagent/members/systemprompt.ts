import type { TeamDefinition, TeamMemberDefinition } from "../types.js";

/**
 * Build a team member's system prompt: the user-authored member prompt, followed by an environment
 * block that teaches the member how to work inside the team, which collaboration tools it has, and —
 * critically — that it MUST report back to the leader with message_team_leader when done.
 */
export function buildMemberSystemPrompt(
  member: TeamMemberDefinition,
  team: TeamDefinition,
  workspaceRoot: string,
  messagingEnabled: boolean,
): string {
  const base = (member.system_prompt ?? "").trim();

  const otherMembers = team.members.filter(
    (m) => m.name.trim().toLowerCase() !== member.name.trim().toLowerCase(),
  );
  const roster =
    otherMembers.length > 0
      ? otherMembers
          .map((m) => `  - ${m.name} — ${m.description || "team member"} (agent_id: ${m.name})`)
          .join("\n")
      : "  (you are currently the only member besides the leader)";

  const messagingLine = messagingEnabled
    ? `- send_message_to_team: message another member directly (e.g. to ask a question, share a result, or coordinate). Agent-to-agent messaging is ENABLED. When you finish work that another member delegated or is waiting on, send them a short summary with this tool.`
    : "- (Agent-to-agent messaging is disabled by the user, so send_message_to_team is not available. Communicate only with the leader.)";

  return `${base}

# Your role: Team Member "${member.name}"
You are ${member.name} — ${member.description || "a specialist"} — a member of the multi-agent team "${team.name}", led by ${team.leader.name}. You work autonomously on the tasks you are given, using your tools, until each task is fully complete.

# Your team
- Team leader: ${team.leader.name} (agent_id: ${team.leader.name})
- Other members:
${roster}

# How to work
- Each message you receive tells you who it is from (the team leader or another member) and what they need. Complete the requested task thoroughly using your tools.
- Focus on your specialization. If a task is outside your expertise or depends on work only another member can do, say so clearly in your report instead of guessing.
- You may receive several messages at once (they were queued while you were busy) — handle each one, then report.

# Reporting back (REQUIRED)
- When you finish a task the TEAM LEADER gave you, you MUST call message_team_leader to report completion. Include your name and a complete, self-contained summary of exactly what you did, produced, or found (concrete results, file paths, conclusions) — the leader relies on this to review and continue.
- If you cannot finish, report the blocker to the leader with message_team_leader so they can help or re-plan.

# Team tools (native function calling only)
- message_team_leader: report task completion/progress, ask the leader questions, or share information. ALWAYS include your name (${member.name}).
- list_agent_team_members: list the team members and their exact agent_ids.
${messagingLine}
- You also have the full set of normal tools (files, shell, web, memory, knowledge, skills, sub-agents, and more).

# Environment
- You run on the same machine and share one workspace with your team: ${workspaceRoot}
- All file paths are relative to this workspace (file_read requires an absolute path). Files you create persist on disk and are visible to the whole team.`.trim();
}
