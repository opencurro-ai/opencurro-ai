import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({});

/**
 * list_agent_team_members — available to BOTH the team head/leader and every team member. Returns
 * the roster of the current multi-agent team (each member's exact id/name + description) so an agent
 * can decide who to delegate to or communicate with. The head is included so members know their
 * leader; members are returned enabled-only.
 */
export const listAgentTeamMembersTool = defineTool({
  name: "list_agent_team_members",
  description:
    "Get a list of all agent team members available to the current agent. Returns each team " +
    "member's exact agent id (used to target them with the messaging tools) and a short " +
    "description of their specialization. Use it to discover who is on the team before delegating " +
    "or communicating.",
  schema,
  label: () => "List Team Members",
  async execute(_args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "You are not running inside a multi-agent team, so there are no team members.",
        },
      };
    }

    const members = ctx.team.roster().map((m) => ({
      agent_id: m.id,
      name: m.name,
      description: m.description,
    }));

    return {
      ok: true,
      data: {
        team_head: { agent_id: ctx.team.head.id, name: ctx.team.head.name },
        members,
        count: members.length,
      },
    };
  },
});
