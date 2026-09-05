import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { delegateTaskOrSendMessageTool } from "./delegate_task_or_send_message.js";
import type {
  TeamDeliveryResult,
  TeamMemberInfo,
  TeamMemberStatusRecord,
  TeamRuntime,
  ToolContext,
} from "./types.js";

/** A minimal fake TeamRuntime that records deliveries, for testing the tools in isolation. */
function makeTeam(overrides: Partial<TeamRuntime> = {}): {
  team: TeamRuntime;
  delegated: Array<{ agent_id: string; message: string }>;
} {
  const delegated: Array<{ agent_id: string; message: string }> = [];
  const members: TeamMemberInfo[] = [
    { agent_id: "Niko", name: "Niko", description: "designer", role: "member" },
    { agent_id: "Arlo", name: "Arlo", description: "engineer", role: "member" },
  ];
  const known = new Set(["niko", "arlo"]);
  const team: TeamRuntime = {
    selfId: "Elio",
    selfName: "Elio",
    selfRole: "head",
    leaderId: "Elio",
    leaderName: "Elio",
    messagingEnabled: true,
    listMembers: () => members,
    delegate: (messages): TeamDeliveryResult => {
      const delivered: string[] = [];
      const unknown: string[] = [];
      for (const m of messages) {
        if (known.has(m.agent_id.toLowerCase())) {
          delegated.push(m);
          delivered.push(m.agent_id);
        } else {
          unknown.push(m.agent_id);
        }
      }
      return { delivered, unknown };
    },
    sendToTeam: () => ({ delivered: [], unknown: [] }),
    messageLeader: () => ({ delivered: true }),
    status: (ids): TeamMemberStatusRecord[] =>
      ids.map((id) => ({
        agent_id: id,
        name: id,
        role: "member",
        status: "idle",
        queued_messages: 0,
      })),
    ...overrides,
  };
  return { team, delegated };
}

function ctxWith(team: TeamRuntime | undefined): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, team };
}

describe("delegate_task_or_send_message tool", () => {
  const registry = new ToolRegistry().registerAll([delegateTaskOrSendMessageTool]);

  it("is registered and exposes the correct schema", () => {
    assert.ok(registry.has("delegate_task_or_send_message"));
    const schema = registry.schemas.find((s) => s.function.name === "delegate_task_or_send_message");
    assert.ok(schema);
    const props = schema!.function.parameters.properties as Record<string, unknown>;
    assert.ok(props.messages, "messages property must be declared");
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required, ["messages"]);
  });

  it("delegates to known members and reports delivery", async () => {
    const { team, delegated } = makeTeam();
    const result = await registry.execute(
      "delegate_task_or_send_message",
      {
        messages: [
          { agent_id: "Niko", message: "Design the landing page." },
          { agent_id: "Arlo", message: "Build the API." },
        ],
      },
      ctxWith(team),
    );
    assert.equal(result.ok, true);
    assert.equal(delegated.length, 2);
    const data = result.data as { delivered_to: string[]; unknown_agent_ids: string[] };
    assert.deepEqual(data.delivered_to.sort(), ["Arlo", "Niko"]);
    assert.equal(data.unknown_agent_ids.length, 0);
  });

  it("reports unknown agent ids while still delivering to valid ones", async () => {
    const { team } = makeTeam();
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "Niko", message: "x" }, { agent_id: "Ghost", message: "y" }] },
      ctxWith(team),
    );
    assert.equal(result.ok, true);
    const data = result.data as { delivered_to: string[]; unknown_agent_ids: string[] };
    assert.deepEqual(data.delivered_to, ["Niko"]);
    assert.deepEqual(data.unknown_agent_ids, ["Ghost"]);
  });

  it("fails when no recipients match", async () => {
    const { team } = makeTeam();
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "Ghost", message: "y" }] },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "no_valid_recipients");
  });

  it("rejects when called by a non-leader", async () => {
    const { team } = makeTeam({ selfRole: "member" });
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "Niko", message: "x" }] },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_leader");
  });

  it("errors when the team runtime is absent (single-agent context)", async () => {
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "Niko", message: "x" }] },
      ctxWith(undefined),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("rejects an empty messages array via schema validation", async () => {
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [] },
      ctxWith(makeTeam().team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("exposes clear UI labels", () => {
    assert.equal(
      delegateTaskOrSendMessageTool.label({ messages: [{ agent_id: "Niko", message: "x" }] }),
      "Delegate → Niko",
    );
    assert.equal(
      delegateTaskOrSendMessageTool.label({
        messages: [
          { agent_id: "Niko", message: "x" },
          { agent_id: "Arlo", message: "y" },
        ],
      }),
      "Delegate → 2 members",
    );
  });
});
