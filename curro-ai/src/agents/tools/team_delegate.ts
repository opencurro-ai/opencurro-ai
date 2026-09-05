import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  messages: z
    .array(
      z.object({
        agent_id: z
          .string()
          .min(1, "agent_id is required.")
          .describe("The exact ID of the team member agent that should receive this message."),
        message: z
          .string()
          .min(1, "message is required.")
          .describe(
            "The message to send to the team member. For task assignments, include all necessary " +
              "context, requirements, constraints, and expected results so the team member can work " +
              "independently.",
          ),
      }),
    )
    .min(1, "Provide at least one message.")
    .describe("A list of messages to send to team members."),
});

export const teamDelegateTool = defineTool({
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
    "provided message and can respond with the requested information or the result of the " +
    "assigned task.",
  schema,
  label: (args) => {
    const count = Array.isArray(args.messages) ? args.messages.length : 0;
    if (count === 1) return `Delegate → ${args.messages[0]?.agent_id ?? "member"}`;
    return `Delegate to ${count} member${count === 1 ? "" : "s"}`;
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.team || !ctx.teamAgentId) {
      return {
        ok: false,
        error: {
          code: "team_unavailable",
          message:
            "This tool is only available to the head of a multi-agent team. No team runtime is active.",
        },
      };
    }
    return ctx.team.delegate(ctx.teamAgentId, args.messages);
  },
});
