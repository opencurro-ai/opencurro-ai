import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  my_name: z
    .string()
    .describe(
      "Your name as the team member sending this message. This identifies who is communicating " +
        "with the head team leader.",
    ),
  message: z
    .string()
    .describe(
      "The message to send to the head team leader. This can be a task completion report, progress " +
        "update, question, request for clarification, important information, or general " +
        "work-related communication.",
    ),
});

/**
 * message_team_leader — TEAM MEMBERS ONLY. A member uses this to report task completion, progress,
 * questions, or any information back to the head/leader. Delivery is asynchronous: the message is
 * placed on the head's mailbox and the head is scheduled to run when free (if the head is busy the
 * message queues and is delivered in one batch when the head becomes available). The tool returns
 * immediately.
 */
export const messageTeamLeaderTool = defineTool({
  name: "message_team_leader",
  description:
    "Use this tool to communicate directly with the head team leader. You can use it to inform the " +
    "team leader that a task has been completed, report task progress or updates, ask questions, " +
    "request clarification or guidance, share important information, or have general work-related " +
    "communication. Always provide your name so the head team leader knows which team member sent " +
    "the message.",
  schema,
  label: (args) => `Report to leader${args.my_name ? ` (from ${args.my_name})` : ""}`,
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team || !ctx.teamSelfId) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "This tool is only available to team members inside a multi-agent team.",
        },
      };
    }
    if (ctx.teamSelfRole !== "member") {
      return {
        ok: false,
        error: {
          code: "not_team_member",
          message: "Only team members can message the team leader; you are the team leader.",
        },
      };
    }

    const result = ctx.team.messageLeader(ctx.teamSelfId, args.my_name ?? "", args.message ?? "");
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: "delivery_failed",
          message: "The message to the team leader could not be delivered.",
        },
      };
    }

    return {
      ok: true,
      data: {
        message:
          `Your message was delivered to the team leader (${ctx.team.head.name}). The leader will ` +
          `review it and respond or assign follow-up work when free — you do not need to wait. You ` +
          `may keep working if you still have pending work, otherwise you can stop; the leader will ` +
          `reach you again through your inbox if needed.`,
      },
    };
  },
});
