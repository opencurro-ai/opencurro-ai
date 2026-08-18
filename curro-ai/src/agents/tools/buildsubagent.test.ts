import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { buildSubAgentTool, SUB_AGENT_CREATE_RESTRICTED_TOOLS } from "./buildsubagent.js";
import { listSubAgentsTool } from "./list_sub_agents.js";
import { callSubAgentTool } from "./call_sub_agent.js";
import { fileReadTool } from "./fileRead.js";
import { askUserTool } from "./askuser.js";
import { submitPlanTool } from "./submit_plan.js";
import type { ToolContext } from "./types.js";

/** The full set of tools that would be granted to an LLM-created sub-agent by default. */
const AVAILABLE_TOOL_NAMES = [
  "file_read",
  "file_write",
  "file_list",
  "str_replace",
  "apply_multiple_edits",
  "shall_tool",
  "shell_view",
  "bash_write_to_process",
  "web_search",
  "fatch_web_urls",
  "read_image",
  "call_sub_agent",
  "list_sub_agents",
  "list_skills",
  "skill_initialize",
  "submit_plan",
  "ask_question_to_user",
  "create_sub_agent",
  "create_skill",
];

function ctxFor(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workspaceRoot: "/tmp",
    shellTimeoutMs: 10_000,
    availableToolNames: AVAILABLE_TOOL_NAMES,
    ...overrides,
  };
}

describe("create_sub_agent tool", () => {
  let registry: ToolRegistry;

  before(() => {
    registry = new ToolRegistry().registerAll([
      fileReadTool,
      callSubAgentTool,
      listSubAgentsTool,
      submitPlanTool,
      askUserTool,
      buildSubAgentTool,
    ]);
  });

  it("is registered and selectable by the LLM alongside existing tools", () => {
    assert.ok(registry.has("create_sub_agent"));
    const schema = registry.schemas.find((s) => s.function.name === "create_sub_agent");
    assert.ok(schema, "create_sub_agent must appear in the OpenAI tools array");
    assert.equal(schema!.type, "function");
    assert.equal(schema!.function.parameters.type, "object");
    const props = schema!.function.parameters.properties as Record<string, unknown>;
    assert.ok(props.name, "name property must be declared");
    assert.ok(props.description, "description property must be declared");
    assert.ok(props.system_prompt, "system_prompt property must be declared");
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required.sort(), ["description", "name", "system_prompt"]);
  });

  it("creates a sub-agent granting every tool except the restricted metacontrol tools", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      {
        name: "deepexplorer",
        description: "Deeply explores a codebase to answer hard questions.",
        system_prompt: "You are a thorough research sub-agent. Explore the repo and report findings.",
      },
      ctxFor(),
    );

    assert.equal(result.ok, true);
    const data = result.data as {
      created_sub_agent: { name: string; description: string; system_prompt: string; tools: string[]; enabled: boolean };
      granted_tools: number;
    };
    assert.ok(data.created_sub_agent, "must return the created sub-agent definition");
    assert.equal(data.created_sub_agent.name, "deepexplorer");
    assert.equal(data.created_sub_agent.description, "Deeply explores a codebase to answer hard questions.");
    assert.equal(data.created_sub_agent.enabled, true);

    const tools = data.created_sub_agent.tools;
    assert.equal(data.granted_tools, tools.length);

    // Restricted metacontrol tools must never be granted.
    for (const excluded of SUB_AGENT_CREATE_RESTRICTED_TOOLS) {
      assert.ok(!tools.includes(excluded), `must not grant ${excluded}`);
    }
    assert.ok(tools.includes("file_read"), "must grant ordinary tools like file_read");
    assert.ok(tools.includes("web_search"), "must grant web_search");
    assert.ok(tools.includes("create_skill"), "must grant create_skill");
    assert.ok(tools.includes("create_sub_agent"), "must grant create_sub_agent");
    // Every granted tool must exist in the source list and be unique.
    assert.equal(new Set(tools).size, tools.length, "granted tools must be unique");
    for (const t of tools) assert.ok(AVAILABLE_TOOL_NAMES.includes(t));
  });

  it("granted tools follow registry order and all are real tools", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      {
        name: "coder",
        description: "Writes and refactors code.",
        system_prompt: "You write production code.",
      },
      ctxFor(),
    );
    assert.equal(result.ok, true);
    const tools = (result.data as { created_sub_agent: { tools: string[] } }).created_sub_agent.tools;
    const expectedOrder = AVAILABLE_TOOL_NAMES.filter((t) => !SUB_AGENT_CREATE_RESTRICTED_TOOLS.includes(t));
    assert.deepEqual(tools, expectedOrder);
  });

  it("grants every available tool (deduplicated) with no exclusions in the input", async () => {
    const withDuplicates = [...AVAILABLE_TOOL_NAMES, "file_read", "file_read"];
    const result = await registry.execute(
      "create_sub_agent",
      {
        name: "multi",
        description: "Handles multiple concerns.",
        system_prompt: "Do everything well.",
      },
      ctxFor({ availableToolNames: withDuplicates }),
    );
    assert.equal(result.ok, true);
    const tools = (result.data as { created_sub_agent: { tools: string[] } }).created_sub_agent.tools;
    assert.equal(new Set(tools).size, tools.length, "duplicates must be removed");
  });

  it("fails cleanly when the registry is unavailable (e.g. an unusual runtime)", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      {
        name: "orphan",
        description: "No tools available.",
        system_prompt: "N/A",
      },
      ctxFor({ availableToolNames: undefined }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "registry_unavailable");
  });

  it("validates the args with the zod schema", () => {
    const parsed = buildSubAgentTool.schema.parse({
      name: "researcher",
      description: "Looks things up.",
      system_prompt: "Research and summarize.",
    });
    assert.equal(parsed.name, "researcher");
  });

  it("rejects a missing name via the registry", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      { description: "d", system_prompt: "p" } as Record<string, unknown>,
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("rejects a missing description and system_prompt via the registry", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      { name: "x" } as Record<string, unknown>,
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("rejects a name over 70 characters via schema validation", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      { name: "a".repeat(71), description: "d", system_prompt: "p" },
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("rejects a description over 300 characters via schema validation", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      { name: "ok", description: "d".repeat(301), system_prompt: "p" },
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("exposes a clear UI label", () => {
    assert.equal(buildSubAgentTool.label({ name: "helper", description: "x", system_prompt: "y" }), "Create Sub-Agent: helper");
  });

  it("returns a valid ToolResult and never throws", async () => {
    const result = await registry.execute(
      "create_sub_agent",
      { name: "stable", description: "d", system_prompt: "p" },
      ctxFor(),
    );
    assert.equal(typeof result.ok, "boolean");
    if (result.ok) assert.ok(result.data);
    assert.deepEqual(Object.keys(result).sort(), ["data", "ok"]);
  });
});