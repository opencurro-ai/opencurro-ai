import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { messageTeamLeaderTool } from "./message_team_leader.js";
import type { TeamRuntime, ToolContext } from "./types.js";

function makeTeam(overrides: Partial<TeamRuntime> = {}): {
  team: TeamRuntime;
  reports: Array<{ from: string; message: string }>;
} {
  const reports: Array<{ from: string; message: string }> = [];
  const team: TeamRuntime = {
    selfId: "Niko",
    selfName: "Niko",
    selfRole: "member",
    leaderId: "Elio",
    leaderName: "Elio",
    messagingEnabled: false,
    listMembers: () => [],
    delegate: () => ({ delivered: [], unknown: [] }),
    sendToTeam: () => ({ delivered: [], unknown: [] }),
    messageLeader: (fromName, message) => {
      reports.push({ from: fromName, message });
      return { delivered: true };
    },
    status: () => [],
    ...overrides,
  };
  return { team, reports };
}

function ctxWith(team: TeamRuntime | undefined): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, team };
}

describe("message_team_leader tool", () => {
  const registry = new ToolRegistry().registerAll([messageTeamLeaderTool]);

  it("is registered with my_name + message required", () => {
    assert.ok(registry.has("message_team_leader"));
    const schema = registry.schemas.find((s) => s.function.name === "message_team_leader");
    assert.ok(schema);
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required.sort(), ["message", "my_name"]);
  });

  it("delivers a report to the team leader", async () => {
    const { team, reports } = makeTeam();
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Niko", message: "Design done — see index.html." },
      ctxWith(team),
    );
    assert.equal(result.ok, true);
    assert.equal(reports.length, 1);
    assert.equal(reports[0]!.from, "Niko");
    assert.match((result.data as { message: string }).message, /delivered to the team leader/);
  });

  it("falls back to the agent's own name when my_name is blank", async () => {
    const { team, reports } = makeTeam();
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "   ", message: "hi" },
      ctxWith(team),
    );
    assert.equal(result.ok, true);
    assert.equal(reports[0]!.from, "Niko");
  });

  it("rejects when called by the leader", async () => {
    const { team } = makeTeam({ selfRole: "head" });
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Elio", message: "x" },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_member");
  });

  it("reports a delivery failure", async () => {
    const { team } = makeTeam({ messageLeader: () => ({ delivered: false }) });
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Niko", message: "x" },
      ctxWith(team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "delivery_failed");
  });

  it("errors when the team runtime is absent", async () => {
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Niko", message: "x" },
      ctxWith(undefined),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("rejects missing fields via schema validation", async () => {
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Niko" } as Record<string, unknown>,
      ctxWith(makeTeam().team),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("exposes a clear UI label", () => {
    assert.equal(
      messageTeamLeaderTool.label({ my_name: "Niko", message: "x" }),
      "Report to leader (from Niko)",
    );
  });
});
