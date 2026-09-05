import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z
  .object({
    my_name: z
      .string()
      .describe(
        "Your name as the team member sending this message. This identifies who is communicating with " +
          "the head team leader.",
      ),
    message: z
      .string()
      .describe(
        "The message to send to the head team leader. This can be a task completion report, progress " +
          "update, question, request for clarification, important information, or general work-related " +
          "communication.",
      ),
  })
  .strict();

type MessageLeaderArgs = z.infer<typeof schema>;

export const messageTeamLeaderTool = defineTool({
  name: "message_team_leader",
  description:
    "Use this tool to communicate directly with the head team leader. You can use it to inform the " +
    "team leader that a task has been completed, report task progress or updates, ask questions, " +
    "request clarification or guidance, share important information, or have general work-related " +
    "communication. Always provide your name so the head team leader knows which team member sent the " +
    "message.",
  schema,
  label: (args: MessageLeaderArgs) => {
    const name = typeof args.my_name === "string" ? args.my_name.trim() : "";
    return name ? `Report to leader (from ${name})` : "Report to team leader";
  },
  async execute(args: MessageLeaderArgs, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "The team runtime is not available in this context.",
        },
      };
    }
    if (ctx.team.selfRole !== "member") {
      return {
        ok: false,
        error: {
          code: "not_team_member",
          message:
            "Only team members can message the team leader. The leader talks to members with " +
            "delegate_task_or_send_message.",
        },
      };
    }

    const fromName = (args.my_name ?? "").trim() || ctx.team.selfName;
    const { delivered } = ctx.team.messageLeader(fromName, args.message);

    if (!delivered) {
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
          `Your message was delivered to the team leader (${ctx.team.leaderName}). ` +
          "If the leader is currently busy it will be queued and delivered as soon as the leader is " +
          "free. You do not need to wait — you may continue any remaining work or end your turn.",
      },
    };
  },
});
