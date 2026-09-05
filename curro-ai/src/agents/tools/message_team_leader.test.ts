import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { messageTeamLeaderTool } from "./message_team_leader.js";
import { makeFakeTeam, member, ctxFor } from "./teamTestUtils.js";

describe("message_team_leader tool", () => {
  const registry = new ToolRegistry().registerAll([messageTeamLeaderTool]);

  it("delivers a member's report to the leader with the sender id + name", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Arlo", message: "Task complete." },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, true);
    assert.equal(team.leaderMessages.length, 1);
    assert.equal(team.leaderMessages[0]!.fromId, "arlo");
    assert.equal(team.leaderMessages[0]!.myName, "Arlo");
    assert.equal(team.leaderMessages[0]!.message, "Task complete.");
  });

  it("rejects use by the head", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Leader", message: "x" },
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_member");
  });

  it("fails outside a team", async () => {
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "x", message: "y" },
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("requires my_name and message via schema", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "message_team_leader",
      { my_name: "Arlo" } as Record<string, unknown>,
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });
});
