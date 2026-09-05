import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z
  .object({
    agent_ids: z
      .array(z.string())
      .min(1)
      .describe(
        "A list of exact agent IDs whose current status should be retrieved. Multiple agents can be " +
          "checked in a single call.",
      ),
  })
  .strict();

type StatusArgs = z.infer<typeof schema>;

export const getTeamMembersStatusTool = defineTool({
  name: "get_team_members_status",
  description:
    "Get the current status of one or more agent team members. Use this tool when you need to check " +
    "whether specific agents are currently working, idle, waiting, completed, failed, or otherwise " +
    "unavailable. Provide the exact agent IDs of the agents whose status you want to check. You can " +
    "check multiple agents in a single call. Use the returned status to monitor delegated tasks, " +
    "determine whether an agent is available for new work, identify completed work, or detect agents " +
    "that require attention.",
  schema,
  label: (args: StatusArgs) => {
    const ids = Array.isArray(args.agent_ids) ? args.agent_ids.filter(Boolean) : [];
    if (ids.length === 1) return `Status: ${ids[0]}`;
    return `Status: ${ids.length} members`;
  },
  async execute(args: StatusArgs, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "The team runtime is not available in this context.",
        },
      };
    }
    if (ctx.team.selfRole !== "head") {
      return {
        ok: false,
        error: {
          code: "not_team_leader",
          message: "Only the team leader can check team member status.",
        },
      };
    }

    const statuses = ctx.team.status(args.agent_ids);
    return {
      ok: true,
      data: {
        statuses,
        message:
          "Status values: 'working' = currently running, 'queued' = has pending message(s) waiting to " +
          "run, 'idle' = free and available for new work, 'done' = finished its last run, " +
          "'unknown' = no such team member.",
      },
    };
  },
});
