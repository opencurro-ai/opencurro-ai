import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  recipients: z
    .array(
      z.object({
        agent_id: z
          .string()
          .min(1, "agent_id is required.")
          .describe("The exact unique ID of the target agent team member."),
        message: z
          .string()
          .min(1, "message is required.")
          .describe(
            "The message to send to this agent. It may contain a new task, instruction, question, " +
              "request for clarification, feedback, context, update, follow-up, coordination " +
              "request, or any other agent-to-agent communication.",
          ),
      }),
    )
    .min(1, "Provide at least one recipient.")
    .describe("The list of agent team members that should receive messages."),
});

export const teamSendMessageTool = defineTool({
  name: "send_message_to_team",
  description:
    "Send messages to one or more agent team members using their exact agent IDs. Use this tool " +
    "when you need to communicate with existing team members. Messages can be used to assign new " +
    "tasks, provide instructions, ask questions, request clarification, share information or " +
    "context, give feedback, send updates, continue an existing discussion, coordinate work, " +
    "delegate responsibilities, change priorities, request progress reports, or have general " +
    "agent-to-agent communication. Multiple team members can receive messages in a single tool " +
    "call.",
  schema,
  label: (args) => {
    const count = Array.isArray(args.recipients) ? args.recipients.length : 0;
    if (count === 1) return `Message → ${args.recipients[0]?.agent_id ?? "member"}`;
    return `Message ${count} member${count === 1 ? "" : "s"}`;
  },
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
    return ctx.team.sendToTeam(ctx.teamAgentId, args.recipients);
  },
});
