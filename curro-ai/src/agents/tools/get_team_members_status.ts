import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  agent_ids: z
    .array(z.string())
    .min(1)
    .describe(
      "A list of exact agent IDs whose current status should be retrieved. Multiple agents can be " +
        "checked in a single call.",
    ),
});

/**
 * get_team_members_status — HEAD/LEADER ONLY. Returns the current lifecycle status of the requested
 * team members (idle / running / queued / completed / failed) plus how many messages are queued for
 * each, so the head can monitor delegated work, decide whether an agent is free for new work, or
 * detect agents that need attention.
 */
export const getTeamMembersStatusTool = defineTool({
  name: "get_team_members_status",
  description:
    "Get the current status of one or more agent team members. Use this tool when you need to " +
    "check whether specific agents are currently working, idle, waiting, completed, failed, or " +
    "otherwise unavailable. Provide the exact agent IDs of the agents whose status you want to " +
    "check. You can check multiple agents in a single call. Use the returned status to monitor " +
    "delegated tasks, determine whether an agent is available for new work, identify completed " +
    "work, or detect agents that require attention.",
  schema,
  label: (args) => `Status: ${(args.agent_ids ?? []).slice(0, 3).join(", ") || "team"}`,
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team || !ctx.teamSelfId) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "This tool is only available to the team leader inside a multi-agent team.",
        },
      };
    }
    if (ctx.teamSelfRole !== "head") {
      return {
        ok: false,
        error: {
          code: "not_team_leader",
          message: "Only the team leader can query team member status.",
        },
      };
    }

    const requested = new Set(args.agent_ids.map((id) => id.trim()).filter(Boolean));
    const found = ctx.team.statusOf(Array.from(requested));
    const foundIds = new Set(found.map((f) => f.id));
    const notFound = Array.from(requested).filter((id) => !foundIds.has(id));

    return {
      ok: true,
      data: {
        statuses: found.map((f) => ({
          agent_id: f.id,
          name: f.name,
          role: f.role,
          status: f.status,
          queued_messages: f.queued,
        })),
        unknown_agent_ids: notFound,
      },
    };
  },
});
