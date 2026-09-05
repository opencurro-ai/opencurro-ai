import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({}).describe("No parameters.");

export const teamListMembersTool = defineTool({
  name: "list_agent_team_members",
  description:
    "Get a list of all agent team members available to the current agent. Returns each team " +
    "member's name (agent id), role, and short description so you know who you can delegate to or " +
    "communicate with.",
  schema,
  label: () => "List team members",
  async execute(_args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message:
            "This tool is only available inside a multi-agent team. No team runtime is active.",
        },
      };
    }
    const members = ctx.team.listMembers();
    return {
      ok: true,
      data: {
        head_agent_id: ctx.team.headAgentId,
        count: members.length,
        members,
      },
    };
  },
});
