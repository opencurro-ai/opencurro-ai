import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { listAgentTeamMembersTool } from "./list_agent_team_members.js";
import type { TeamMemberInfo, TeamRuntime, ToolContext } from "./types.js";

function makeTeam(members: TeamMemberInfo[]): TeamRuntime {
  return {
    selfId: "Niko",
    selfName: "Niko",
    selfRole: "member",
    leaderId: "Elio",
    leaderName: "Elio",
    messagingEnabled: true,
    listMembers: () => members,
    delegate: () => ({ delivered: [], unknown: [] }),
    sendToTeam: () => ({ delivered: [], unknown: [] }),
    messageLeader: () => ({ delivered: true }),
    status: () => [],
  };
}

function ctxWith(team: TeamRuntime | undefined): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, team };
}

describe("list_agent_team_members tool", () => {
  const registry = new ToolRegistry().registerAll([listAgentTeamMembersTool]);

  it("is registered with no required params", () => {
    assert.ok(registry.has("list_agent_team_members"));
    const schema = registry.schemas.find((s) => s.function.name === "list_agent_team_members");
    assert.ok(schema);
    const required = (schema!.function.parameters.required as string[]) ?? [];
    assert.equal(required.length, 0);
  });

  it("lists members and the leader", async () => {
    const members: TeamMemberInfo[] = [
      { agent_id: "Arlo", name: "Arlo", description: "engineer", role: "member" },
      { agent_id: "Milo", name: "Milo", description: "architect", role: "member" },
    ];
    const result = await registry.execute("list_agent_team_members", {}, ctxWith(makeTeam(members)));
    assert.equal(result.ok, true);
    const data = result.data as {
      team_leader: { agent_id: string };
      members: Array<{ agent_id: string; description: string }>;
      count: number;
    };
    assert.equal(data.team_leader.agent_id, "Elio");
    assert.equal(data.count, 2);
    assert.deepEqual(
      data.members.map((m) => m.agent_id),
      ["Arlo", "Milo"],
    );
  });

  it("handles a team with no other members", async () => {
    const result = await registry.execute("list_agent_team_members", {}, ctxWith(makeTeam([])));
    assert.equal(result.ok, true);
    assert.equal((result.data as { count: number }).count, 0);
  });

  it("errors when the team runtime is absent", async () => {
    const result = await registry.execute("list_agent_team_members", {}, ctxWith(undefined));
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("exposes a clear UI label", () => {
    assert.equal(listAgentTeamMembersTool.label({}), "List team members");
  });
});
