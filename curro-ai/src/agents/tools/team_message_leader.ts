import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  my_name: z
    .string()
    .min(1, "my_name is required.")
    .describe(
      "Your name as the team member sending this message. This identifies who is communicating " +
        "with the head team leader.",
    ),
  message: z
    .string()
    .min(1, "message is required.")
    .describe(
      "The message to send to the head team leader. This can be a task completion report, progress " +
        "update, question, request for clarification, important information, or general " +
        "work-related communication.",
    ),
});

export const teamMessageLeaderTool = defineTool({
  name: "message_team_leader",
  description:
    "Use this tool to communicate directly with the head team leader. You can use it to inform the " +
    "team leader that a task has been completed, report task progress or updates, ask questions, " +
    "request clarification or guidance, share important information, or have general work-related " +
    "communication. Always provide your name so the head team leader knows which team member sent " +
    "the message.",
  schema,
  label: (args) => `Report to leader${args.my_name ? ` (${args.my_name})` : ""}`,
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team || !ctx.teamAgentId) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message:
            "This tool is only available to members of a multi-agent team. No team runtime is active.",
        },
      };
    }
    return ctx.team.messageLeader(ctx.teamAgentId, args.my_name, args.message);
  },
});
