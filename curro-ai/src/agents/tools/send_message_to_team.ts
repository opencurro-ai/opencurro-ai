import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const recipientSchema = z.object({
  agent_id: z.string().describe("The exact unique ID of the target agent team member."),
  message: z
    .string()
    .describe(
      "The message to send to this agent. It may contain a new task, instruction, question, request " +
        "for clarification, feedback, context, update, follow-up, coordination request, or any other " +
        "agent-to-agent communication.",
    ),
});

const schema = z.object({
  recipients: z
    .array(recipientSchema)
    .min(1)
    .describe(
      "The list of agent team members that should receive messages. Each recipient is identified by " +
        "their exact agent ID and can receive an independent message.",
    ),
});

/**
 * send_message_to_team — TEAM MEMBERS ONLY, and gated by a user setting (disabled by default). It
 * lets one member communicate directly with one or more OTHER members (assign follow-up work,
 * answer a question, share results, coordinate). Delivery is asynchronous: each message is placed on
 * the recipient's mailbox and the recipient is scheduled to run when free (queued and batch-
 * delivered if busy). The tool returns immediately. The recipient can tell who contacted them from
 * the message header, so it can reply via this same tool.
 */
export const sendMessageToTeamTool = defineTool({
  name: "send_message_to_team",
  description:
    "Send messages to one or more agent team members using their exact agent IDs. Use this tool " +
    "when you need to communicate with existing team members. Messages can be used to assign new " +
    "tasks, provide instructions, ask questions, request clarification, share information or " +
    "context, give feedback, send updates, continue an existing discussion, coordinate work, " +
    "delegate responsibilities, change priorities, request progress reports, or have general " +
    "agent-to-agent communication. Multiple team members can receive messages in a single tool call.",
  schema,
  label: (args) => {
    const ids = (args.recipients ?? []).map((r) => r.agent_id).filter(Boolean);
    const shown = ids.slice(0, 3).join(", ");
    const extra = ids.length > 3 ? `, +${ids.length - 3}` : "";
    return `Message team → ${shown}${extra}`.trim() || "Message team";
  },
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
          message: "Only team members can use send_message_to_team; the leader uses delegate_task_or_send_message.",
        },
      };
    }
    if (!ctx.team.sendMessageToTeamEnabled) {
      return {
        ok: false,
        error: {
          code: "member_messaging_disabled",
          message:
            "Member-to-member messaging is currently disabled by the user. Report to the team leader " +
            "with message_team_leader instead, and the leader can coordinate the other members.",
        },
      };
    }

    // A member cannot message itself.
    const recipients = args.recipients.filter((r) => r.agent_id.trim() !== ctx.teamSelfId);
    const { delivered, unknown } = ctx.team.messageTeam(ctx.teamSelfId, recipients);

    if (delivered.length === 0) {
      return {
        ok: false,
        error: {
          code: "no_valid_recipients",
          message:
            `None of the target agent ids exist on the team${
              unknown.length > 0 ? `: ${unknown.join(", ")}` : ""
            }. Call list_agent_team_members to get the exact agent ids.`,
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
          `Your message/task was delivered to ${delivered.length} team member(s) (${delivered.join(", ")}). ` +
          `They will work on it and reply to you later through this same channel — you do not need to ` +
          `wait. Continue your own work, and check back for their replies in your inbox.` +
          (unknown.length > 0
            ? ` Note: these agent ids were not found and were skipped: ${unknown.join(", ")}.`
            : ""),
      },
    };
  },
});
