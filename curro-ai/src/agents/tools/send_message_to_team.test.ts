import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { sendMessageToTeamTool } from "./send_message_to_team.js";
import type { TeamDeliveryResult, TeamRuntime, ToolContext } from "./types.js";

function makeTeam(overrides: Partial<TeamRuntime> = {}): {
  team: TeamRuntime;
  sent: Array<{ agent_id: string; message: string }>;
} {
  const sent: Array<{ agent_id: string; message: string }> = [];
  const known = new Set(["niko", "arlo", "elio"]);
  const team: TeamRuntime = {
    selfId: "Milo",
    selfName: "Milo",
    selfRole: "member",
    leaderId: "Elio",
    leaderName: "Elio",
    messagingEnabled: true,
    listMembers: () => [],
    delegate: () => ({ delivered: [], unknown: [] }),
    sendToTeam: (recipients): TeamDeliveryResult => {
      const delivered: string[] = [];
      const unknown: string[] = [];
      for (const r of recipients) {
        if (known.has(r.agent_id.toLowerCase())) {
          sent.push(r);
          delivered.push(r.agent_id);
        } else {
          unknown.push(r.agent_id);
        }
      }
      return { delivered, unknown };
    },
    messageLeader: () => ({ delivered: true }),
    status: () => [],
    ...overrides,
  };
  return { team, sent };
}

function ctxWith(team: TeamRuntime | undefined): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, team };
}

describe("send_message_to_team tool", () => {
  const registry = new ToolRegistry().registerAll([sendMessageToTeamTool]);

  it("is registered with a recipients array schema", () => {
    assert.ok(registry.has("send_message_to_team"));
    const schema = registry.schemas.find((s) => s.function.name === "send_message_to_team");
    assert.ok(schema);
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required, ["recipients"]);
  });

  it("sends messages to known members when messaging is enabled", async () => {
    const { team, sent } = makeTeam();
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "Arlo", message: "Here is the schema." }] },
      ctxWith(team),
    );
    assert.equal(result.ok, true);
    assert.equal(sent.length, 1);
    assert.deepEqual((result.data as { delivered_to: string[] }).delivered_to, ["Arlo"]);
  });

  it("is blocked when agent-to-agent messaging is disabled", async () => {
    const { team } = makeTeam({ messagingEnabled: false });
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "Arlo", message: "x" }] },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_messaging_disabled");
  });

  it("fails when no recipients match", async () => {
    const { team } = makeTeam();
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "Ghost", message: "x" }] },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "no_valid_recipients");
  });

  it("errors when the team runtime is absent", async () => {
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "Arlo", message: "x" }] },
      ctxWith(undefined),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("rejects an empty recipients array via schema validation", async () => {
    const { team } = makeTeam();
    const result = await registry.execute("send_message_to_team", { recipients: [] }, ctxWith(team));
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("exposes clear UI labels", () => {
    assert.equal(
      sendMessageToTeamTool.label({ recipients: [{ agent_id: "Arlo", message: "x" }] }),
      "Message → Arlo",
    );
    assert.equal(
      sendMessageToTeamTool.label({
        recipients: [
          { agent_id: "Arlo", message: "x" },
          { agent_id: "Niko", message: "y" },
        ],
      }),
      "Message → 2 members",
    );
  });
});
