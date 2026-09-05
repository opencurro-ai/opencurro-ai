import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const messageSchema = z
  .object({
    agent_id: z
      .string()
      .describe("The exact ID of the team member agent that should receive this message."),
    message: z
      .string()
      .describe(
        "The message to send to the team member. This can be a complete task assignment, instruction, " +
          "question, update, feedback, clarification request, additional context, or general " +
          "communication. For task assignments, include all necessary context, requirements, " +
          "constraints, and expected results so the team member can work independently.",
      ),
  })
  .strict();

const schema = z
  .object({
    messages: z
      .array(messageSchema)
      .min(1)
      .describe(
        "A list of messages to send to team members. Each message can contain a task, instruction, " +
          "question, update, feedback, clarification request, or general communication.",
      ),
  })
  .strict();

type DelegateArgs = z.infer<typeof schema>;

export const delegateTaskOrSendMessageTool = defineTool({
  name: "delegate_task_or_send_message",
  description:
    "Delegate tasks or communicate with one or more team members in your multi-agent team. Use this " +
    "tool whenever you need to send a task, instruction, question, update, feedback, additional " +
    "context, clarification, or general message to a team member. You can communicate with multiple " +
    "team members in a single call. For task delegation, provide a clear, complete, and self-contained " +
    "message containing the objective, relevant context, requirements, constraints, and expected " +
    "result. Select the most appropriate team member based on their specialization and capabilities. " +
    "Independent tasks can be assigned to multiple team members simultaneously for parallel execution. " +
    "Do not assign dependent tasks simultaneously unless the required dependencies or results are " +
    "already available. This tool can also be used for normal agent-to-agent communication, such as " +
    "asking questions, requesting clarification, sharing information, providing feedback, sending " +
    "updates, or continuing a conversation. Always use the exact agent ID of the intended team member. " +
    "Each team member receives the provided message and can respond with the requested information or " +
    "the result of the assigned task.",
  schema,
  label: (args: DelegateArgs) => {
    const ids = Array.isArray(args.messages)
      ? args.messages.map((m) => m.agent_id).filter(Boolean)
      : [];
    if (ids.length === 0) return "Delegate task";
    if (ids.length === 1) return `Delegate → ${ids[0]}`;
    return `Delegate → ${ids.length} members`;
  },
  async execute(args: DelegateArgs, ctx: ToolContext): Promise<ToolResult> {
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
          message:
            "Only the team leader can delegate tasks. Members should use message_team_leader or " +
            "send_message_to_team instead.",
        },
      };
    }

    const { delivered, unknown } = ctx.team.delegate(args.messages);

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
          `The task/message was delivered to ${delivered.length} team member(s) (${delivered.join(
            ", ",
          )}). ` +
          (unknown.length > 0
            ? `These agent IDs were not recognized and were skipped: ${unknown.join(", ")}. `
            : "") +
          "The member(s) are now working and will report their results back to you later via " +
          "message_team_leader — you do not block on them. Continue with your own work, delegate " +
          "more tasks, or end your turn; you will be woken up when results arrive.",
      },
    };
  },
});
