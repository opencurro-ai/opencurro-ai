import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  agent_ids: z
    .array(z.string().min(1, "An agent id must be a non-empty string."))
    .min(1, "Provide at least one agent id.")
    .describe(
      "A list of exact agent IDs whose current status should be retrieved. Multiple agents can be " +
        "checked in a single call.",
    ),
});

export const teamStatusTool = defineTool({
  name: "get_team_members_status",
  description:
    "Get the current status of one or more agent team members. Use this tool when you need to " +
    "check whether specific agents are currently working, idle, waiting, completed, failed, or " +
    "otherwise unavailable. Provide the exact agent IDs of the agents whose status you want to " +
    "check. You can check multiple agents in a single call. Use the returned status to monitor " +
    "delegated tasks, determine whether an agent is available for new work, identify completed " +
    "work, or detect agents that require attention.",
  schema,
  label: (args) => {
    const count = Array.isArray(args.agent_ids) ? args.agent_ids.length : 0;
    return `Check status (${count})`;
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message:
            "This tool is only available to the head of a multi-agent team. No team runtime is active.",
        },
      };
    }
    const statuses = ctx.team.status(args.agent_ids);
    return {
      ok: true,
      data: {
        count: statuses.length,
        members: statuses,
      },
    };
  },
});
