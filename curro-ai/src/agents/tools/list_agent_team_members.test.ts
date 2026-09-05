import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { listAgentTeamMembersTool } from "./list_agent_team_members.js";
import { makeFakeTeam, member, ctxFor } from "./teamTestUtils.js";

describe("list_agent_team_members tool", () => {
  const registry = new ToolRegistry().registerAll([listAgentTeamMembersTool]);

  it("returns the roster and head for the head agent", async () => {
    const team = makeFakeTeam([member("arlo", "engineer"), member("niko", "designer")]);
    const result = await registry.execute(
      "list_agent_team_members",
      {},
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, true);
    const data = result.data as {
      members: Array<{ agent_id: string; description: string }>;
      team_head: { agent_id: string };
      count: number;
    };
    assert.equal(data.count, 2);
    assert.equal(data.team_head.agent_id, "head");
    assert.deepEqual(data.members.map((m) => m.agent_id).sort(), ["arlo", "niko"]);
  });

  it("is available to members too", async () => {
    const team = makeFakeTeam([member("arlo"), member("niko")]);
    const result = await registry.execute(
      "list_agent_team_members",
      {},
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, true);
  });

  it("fails outside a team", async () => {
    const result = await registry.execute("list_agent_team_members", {}, ctxFor());
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });
});
