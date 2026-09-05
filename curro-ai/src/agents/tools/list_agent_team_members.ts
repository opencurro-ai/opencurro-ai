import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({}).strict();

type ListArgs = z.infer<typeof schema>;

export const listAgentTeamMembersTool = defineTool({
  name: "list_agent_team_members",
  description: "Get a list of all agent team members available to the current agent.",
  schema,
  label: (_args: ListArgs) => "List team members",
  async execute(_args: ListArgs, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "The team runtime is not available in this context.",
        },
      };
    }

    const members = ctx.team.listMembers();
    return {
      ok: true,
      data: {
        team_leader: { agent_id: ctx.team.leaderId, name: ctx.team.leaderName, role: "head" },
        members: members.map((m) => ({
          agent_id: m.agent_id,
          name: m.name,
          description: m.description,
        })),
        count: members.length,
        message:
          members.length > 0
            ? "Use the exact agent_id of a member when delegating, messaging, or checking status."
            : "This team currently has no other members besides the leader.",
      },
    };
  },
});
