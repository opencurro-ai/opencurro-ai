import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { getTeamMembersStatusTool } from "./get_team_members_status.js";
import { makeFakeTeam, member, ctxFor } from "./teamTestUtils.js";

describe("get_team_members_status tool", () => {
  const registry = new ToolRegistry().registerAll([getTeamMembersStatusTool]);

  it("returns status for known ids and lists unknown ids", async () => {
    const team = makeFakeTeam([
      { ...member("arlo"), status: "running", queued: 2 },
      { ...member("niko"), status: "idle", queued: 0 },
    ]);
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: ["arlo", "niko", "ghost"] },
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, true);
    const data = result.data as {
      statuses: Array<{ agent_id: string; status: string; queued_messages: number }>;
      unknown_agent_ids: string[];
    };
    assert.equal(data.statuses.length, 2);
    const arlo = data.statuses.find((s) => s.agent_id === "arlo")!;
    assert.equal(arlo.status, "running");
    assert.equal(arlo.queued_messages, 2);
    assert.deepEqual(data.unknown_agent_ids, ["ghost"]);
  });

  it("rejects non-head callers", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: ["arlo"] },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_leader");
  });

  it("fails outside a team", async () => {
    const result = await registry.execute("get_team_members_status", { agent_ids: ["arlo"] }, ctxFor());
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("requires at least one agent id", async () => {
    const result = await registry.execute(
      "get_team_members_status",
      { agent_ids: [] },
      ctxFor({ team: makeFakeTeam([]), teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });
});
