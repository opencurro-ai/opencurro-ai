import { z } from "zod";
import { defineTool, type ToolContext, type ToolResult } from "./types.js";

const schema = z.object({
  session: z
    .string()
    .describe(
      "The unique session identifier where the sub-agent should execute. Use this to target an " +
        "existing agent session. Reuse the same session to preserve the sub-agent's memory across " +
        "follow-up questions; use a new name to start a fresh sub-agent conversation.",
    ),
  agent: z
    .string()
    .describe(
      "The name of the specialized sub-agent to execute the task. Call list_sub_agents first to " +
        "discover the available sub-agents and their names.",
    ),
  task: z
    .string()
    .describe("A clear and detailed description of the task that the selected sub-agent should complete."),
});

export const callSubAgentTool = defineTool({
  name: "call_sub_agent",
  description:
    "Call a specialized sub-agent to perform a specific task within a given session and return the " +
    "result. Use this tool when a dedicated sub-agent is better suited for the requested work or for " +
    "completing the task faster. The sub-agent runs as a completely separate call with its own tools " +
    "and memory, and returns only its final result.",
  schema,
  label: (args) => `Sub-Agent: ${args.agent}${args.session ? ` (${args.session})` : ""}`,
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.subAgents) {
      return {
        ok: false,
        error: {
          code: "sub_agents_unavailable",
          message: "Sub-agents are not available in this context.",
        },
      };
    }
    return ctx.subAgents.run(
      { session: args.session, agent: args.agent, task: args.task },
      ctx,
    );
  },
});
