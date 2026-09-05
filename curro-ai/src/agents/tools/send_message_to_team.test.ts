import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { sendMessageToTeamTool } from "./send_message_to_team.js";
import { makeFakeTeam, member, ctxFor } from "./teamTestUtils.js";

describe("send_message_to_team tool", () => {
  const registry = new ToolRegistry().registerAll([sendMessageToTeamTool]);

  it("delivers member-to-member messages when enabled", async () => {
    const team = makeFakeTeam([member("arlo"), member("niko")], { sendMessageToTeamEnabled: true });
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "niko", message: "need the design" }] },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, true);
    assert.equal(team.teamMessages.length, 1);
    assert.equal(team.teamMessages[0]!.fromId, "arlo");
  });

  it("is blocked when the setting is disabled", async () => {
    const team = makeFakeTeam([member("arlo"), member("niko")], { sendMessageToTeamEnabled: false });
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "niko", message: "hi" }] },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "member_messaging_disabled");
  });

  it("cannot be used by the head", async () => {
    const team = makeFakeTeam([member("arlo")], { sendMessageToTeamEnabled: true });
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "arlo", message: "x" }] },
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_member");
  });

  it("drops self-messaging and reports no valid recipients", async () => {
    const team = makeFakeTeam([member("arlo"), member("niko")], { sendMessageToTeamEnabled: true });
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "arlo", message: "to myself" }] },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "no_valid_recipients");
  });

  it("fails outside a team", async () => {
    const result = await registry.execute(
      "send_message_to_team",
      { recipients: [{ agent_id: "niko", message: "x" }] },
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });
});
