import { z } from "zod";
import { defineTool, type SubAgentDefinition, type ToolContext, type ToolResult } from "./types.js";

/** Maximum length of the sub-agent's invocation name (its call ID). */
export const MAX_SUB_AGENT_NAME_CHARS = 70;

/** Maximum length of the short description the main agent uses to pick the sub-agent. */
export const MAX_SUB_AGENT_DESC_CHARS = 300;

/**
 * Tools an LLM-authored sub-agent is never granted automatically. These are the human-in-the-loop
 * meta tools (ask_question_to_user / submit_plan) and the sub-agent delegation meta tools
 * (call_sub_agent / list_sub_agents), which would let a sub-agent prompt the user or delegate work
 * recursively. Every other registered tool is granted by default; the user can further restrict
 * a created sub-agent by editing it afterwards.
 */
export const SUB_AGENT_CREATE_RESTRICTED_TOOLS: readonly string[] = [
  "ask_question_to_user",
  "submit_plan",
  "call_sub_agent",
  "list_sub_agents",
];

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "A sub-agent name is required.")
    .max(
      MAX_SUB_AGENT_NAME_CHARS,
      `The sub-agent name must be ${MAX_SUB_AGENT_NAME_CHARS} characters or fewer.`,
    )
    .describe(
      "Enter a unique name for the sub-agent. This name is its call ID (used with call_sub_agent) " +
        "and must be unique. Maximum 70 characters.",
    ),
  description: z
    .string()
    .trim()
    .min(1, "A short description is required.")
    .max(
      MAX_SUB_AGENT_DESC_CHARS,
      `The short description must be ${MAX_SUB_AGENT_DESC_CHARS} characters or fewer.`,
    )
    .describe(
      "Enter a concise description of what the sub-agent is responsible for, when it should be " +
        "used, and what type of work it is designed to perform. This description is used by the " +
        "main agent to understand when the sub-agent is relevant. Maximum 300 characters.",
    ),
  system_prompt: z
    .string()
    .min(1, "A system prompt is required.")
    .describe(
      "Enter the comprehensive system prompt that will control the sub-agent. Define its role, " +
        "objectives, responsibilities, reasoning and execution behavior, workflow, output " +
        "requirements, constraints, failure handling, and any domain-specific instructions it " +
        "must follow. Write the prompt as complete system-level instructions. There is no " +
        "character limit.",
    ),
});

export const buildSubAgentTool = defineTool({
  name: "create_sub_agent",
  description:
    "Create and register a specialized sub-agent that you can invoke for a specific task or " +
    "responsibility. Before creating a sub-agent, define a clear invocation name, a concise " +
    "description of its purpose, and a comprehensive system prompt that fully specifies how the " +
    "sub-agent must behave and operate. The sub-agent name is its call ID and must be unique. Do " +
    "not omit any required field. The created sub-agent is saved to the user's browser-local " +
    "storage (treated as a user-owned installed sub-agent) and becomes available to " +
    "list_sub_agents / call_sub_agent in this and future sessions. By default the sub-agent is " +
    "granted every tool except ask_question_to_user, submit_plan, call_sub_agent and " +
    "list_sub_agents; the user can restrict its tools later.",
  schema,
  label: (args) => `Create Sub-Agent: ${args.name}`,
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const available = ctx.availableToolNames;
    if (!available) {
      return {
        ok: false,
        error: {
          code: "registry_unavailable",
          message:
            "The tool registry is not available in this context, so the sub-agent's allowed tools " +
            "could not be determined. create_sub_agent can only be used by the main agent.",
        },
      };
    }

    try {
      const name = args.name.trim();
      const excluded = new Set(SUB_AGENT_CREATE_RESTRICTED_TOOLS);
      const seen = new Set<string>();
      const tools: string[] = [];
      for (const toolName of available) {
        if (seen.has(toolName) || excluded.has(toolName)) continue;
        seen.add(toolName);
        tools.push(toolName);
      }

      const created: SubAgentDefinition = {
        name,
        description: args.description.trim(),
        system_prompt: args.system_prompt,
        tools,
        enabled: true,
      };

      return {
        ok: true,
        data: {
          created_sub_agent: created,
          granted_tools: tools.length,
          message:
            `Created sub-agent "${name}" and granted it ${tools.length} tools. It has been saved ` +
            "to the user's browser and is now available via list_sub_agents and call_sub_agent.",
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "create_sub_agent_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
});