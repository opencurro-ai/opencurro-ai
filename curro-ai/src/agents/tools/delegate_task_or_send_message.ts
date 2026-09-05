import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const messageSchema = z.object({
  agent_id: z
    .string()
    .describe("The exact ID of the team member agent that should receive this message."),
  message: z
    .string()
    .describe(
      "The message to send to the team member. This can be a complete task assignment, " +
        "instruction, question, update, feedback, clarification request, additional context, or " +
        "general communication. For task assignments, include all necessary context, requirements, " +
        "constraints, and expected results so the team member can work independently.",
    ),
});

const schema = z.object({
  messages: z
    .array(messageSchema)
    .min(1)
    .describe(
      "A list of messages to send to team members. Each message can contain a task, instruction, " +
        "question, update, feedback, clarification request, or general communication.",
    ),
});

/**
 * delegate_task_or_send_message — HEAD/LEADER ONLY. Assign tasks to, or communicate with, one or
 * more team members in a single call. Delivery is asynchronous: each message is placed on the
 * recipient's mailbox and the recipient is scheduled to run when it is free. The tool returns
 * immediately — the head does NOT block waiting for the members' results. Members report back later
 * via message_team_leader.
 */
export const delegateTaskOrSendMessageTool = defineTool({
  name: "delegate_task_or_send_message",
  description:
    "Delegate tasks or communicate with one or more team members in your multi-agent team. Use " +
    "this tool whenever you need to send a task, instruction, question, update, feedback, " +
    "additional context, clarification, or general message to a team member. You can communicate " +
    "with multiple team members in a single call. For task delegation, provide a clear, complete, " +
    "and self-contained message containing the objective, relevant context, requirements, " +
    "constraints, and expected result. Select the most appropriate team member based on their " +
    "specialization and capabilities. Independent tasks can be assigned to multiple team members " +
    "simultaneously for parallel execution. Do not assign dependent tasks simultaneously unless " +
    "the required dependencies or results are already available. This tool can also be used for " +
    "normal agent-to-agent communication, such as asking questions, requesting clarification, " +
    "sharing information, providing feedback, sending updates, or continuing a conversation. " +
    "Always use the exact agent ID of the intended team member. Each team member receives the " +
    "provided message and can respond with the requested information or the result of the assigned " +
    "task.",
  schema,
  label: (args) => {
    const ids = (args.messages ?? []).map((m) => m.agent_id).filter(Boolean);
    const shown = ids.slice(0, 3).join(", ");
    const extra = ids.length > 3 ? `, +${ids.length - 3}` : "";
    return `Delegate → ${shown}${extra}`.trim() || "Delegate task";
  },
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
          message:
            "Only the team leader can delegate tasks with this tool. Team members should use " +
            "message_team_leader or send_message_to_team instead.",
        },
      };
    }

    const { delivered, unknown } = ctx.team.delegate(ctx.teamSelfId, args.messages);

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
          `The task/message was delivered to ${delivered.length} team member(s) (${delivered.join(", ")}). ` +
          `They have started working on it and will send you their results or a reply later via ` +
          `message_team_leader — you do NOT need to wait. Continue coordinating: delegate more work, ` +
          `check progress with get_team_members_status, or, if you have nothing left to do right now, ` +
          `stop and simply await their reports (the members keep running even after you stop).` +
          (unknown.length > 0
            ? ` Note: these agent ids were not found and were skipped: ${unknown.join(", ")}.`
            : ""),
      },
    };
  },
});
