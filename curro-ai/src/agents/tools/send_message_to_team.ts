import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const recipientSchema = z
  .object({
    agent_id: z.string().describe("The exact unique ID of the target agent team member."),
    message: z
      .string()
      .describe(
        "The message to send to this agent. It may contain a new task, instruction, question, request " +
          "for clarification, feedback, context, update, follow-up, coordination request, or any other " +
          "agent-to-agent communication.",
      ),
  })
  .strict();

const schema = z
  .object({
    recipients: z
      .array(recipientSchema)
      .min(1)
      .describe(
        "The list of agent team members that should receive messages. Each recipient is identified by " +
          "their exact agent ID and can receive an independent message.",
      ),
  })
  .strict();

type SendArgs = z.infer<typeof schema>;

export const sendMessageToTeamTool = defineTool({
  name: "send_message_to_team",
  description:
    "Send messages to one or more agent team members using their exact agent IDs. Use this tool when " +
    "you need to communicate with existing team members. Messages can be used to assign new tasks, " +
    "provide instructions, ask questions, request clarification, share information or context, give " +
    "feedback, send updates, continue an existing discussion, coordinate work, delegate " +
    "responsibilities, change priorities, request progress reports, or have general agent-to-agent " +
    "communication. Multiple team members can receive messages in a single tool call.",
  schema,
  label: (args: SendArgs) => {
    const ids = Array.isArray(args.recipients)
      ? args.recipients.map((r) => r.agent_id).filter(Boolean)
      : [];
    if (ids.length === 1) return `Message → ${ids[0]}`;
    return `Message → ${ids.length} members`;
  },
  async execute(args: SendArgs, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message: "The team runtime is not available in this context.",
        },
      };
    }
    if (!ctx.team.messagingEnabled) {
      return {
        ok: false,
        error: {
          code: "team_messaging_disabled",
          message:
            "Agent-to-agent messaging is disabled. The user can enable it in Settings. Members should " +
            "report to the team leader with message_team_leader instead.",
        },
      };
    }

    const { delivered, unknown } = ctx.team.sendToTeam(args.recipients);

    if (delivered.length === 0) {
      return {
        ok: false,
        error: {
          code: "no_valid_recipients",
          message:
            `None of the provided agent IDs matched a team member${
              unknown.length > 0 ? ` (unknown: ${unknown.join(", ")})` : ""
            }. Call list_agent_team_members to see the exact agent IDs.`,
          unknown_agent_ids: unknown,
        },
      };
    }

    return {
      ok: true,
      data: {
        delivered_to: delivered,
        unknown_agent_ids: unknown,
        message:
          `Your message was delivered to ${delivered.length} team member(s) (${delivered.join(", ")}). ` +
          (unknown.length > 0
            ? `These agent IDs were not recognized and were skipped: ${unknown.join(", ")}. `
            : "") +
          "They will process it and send their results or reply back to you later — you do not block " +
          "on them. Please continue with your own work.",
      },
    };
  },
});
