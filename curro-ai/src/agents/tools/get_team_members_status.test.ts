import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { getTeamMembersStatusTool } from "./get_team_members_status.js";
import type { TeamMemberStatusRecord, TeamRuntime, ToolContext } from "./types.js";

function makeTeam(overrides: Partial<TeamRuntime> = {}): TeamRuntime {
  const statuses: Record<string, TeamMemberStatusRecord> = {
    Niko: { agent_id: "Niko", name: "Niko", role: "member", status: "working", queued_messages: 0 },
    Arlo: { agent_id: "Arlo", name: "Arlo", role: "member", status: "queued", queued_messages: 2 },
  };
  return {
    selfId: "Elio",
    selfName: "Elio",
    selfRole: "head",
    leaderId: "Elio",
    leaderName: "Elio",
    messagingEnabled: false,
    listMembers: () => [],
    delegate: () => ({ delivered: [], unknown: [] }),
    sendToTeam: () => ({ delivered: [], unknown: [] }),
    messageLeader: () => ({ delivered: true }),
    status: (ids): TeamMemberStatusRecord[] =>
      ids.map(
        (id) =>
          statuses[id] ?? {
            agent_id: id,
            name: id,
            role: "member",
            status: "unknown",
            queued_messages: 0,
          },
      ),
    ...overrides,
  };
}

function ctxWith(team: TeamRuntime | undefined): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, team };
}

describe("get_team_members_status tool", () => {
  const registry = new ToolRegistry().registerAll([getTeamMembersStatusTool]);

  it("is registered with an agent_ids array schema", () => {
    assert.ok(registry.has("get_team_members_status"));
    const schema = registry.schemas.find((s) => s.function.name === "get_team_members_status");
    assert.ok(schema);
    const required = schema!.function.parameters.required as string[];
    assert.deepEqual(required, ["agent_ids"]);
  });

  it("returns statuses for known and unknown members", async () => {
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: ["Niko", "Arlo", "Ghost"] },
      ctxWith(makeTeam()),
    );
    assert.equal(result.ok, true);
    const data = result.data as { statuses: TeamMemberStatusRecord[] };
    assert.equal(data.statuses.length, 3);
    assert.equal(data.statuses[0]!.status, "working");
    assert.equal(data.statuses[1]!.status, "queued");
    assert.equal(data.statuses[1]!.queued_messages, 2);
    assert.equal(data.statuses[2]!.status, "unknown");
  });

  it("rejects when called by a non-leader", async () => {
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: ["Niko"] },
      ctxWith(makeTeam({ selfRole: "member" })),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_leader");
  });

  it("errors when the team runtime is absent", async () => {
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: ["Niko"] },
      ctxWith(undefined),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("rejects an empty agent_ids array via schema validation", async () => {
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: [] },
      ctxWith(makeTeam()),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });

  it("exposes a clear UI label", () => {
    assert.equal(getTeamMembersStatusTool.label({ agent_ids: ["Niko"] }), "Status: Niko");
    assert.equal(getTeamMembersStatusTool.label({ agent_ids: ["Niko", "Arlo"] }), "Status: 2 members");
  });
});
