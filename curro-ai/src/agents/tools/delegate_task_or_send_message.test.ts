import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "./registry.js";
import { delegateTaskOrSendMessageTool } from "./delegate_task_or_send_message.js";
import { makeFakeTeam, member, ctxFor } from "./teamTestUtils.js";

describe("delegate_task_or_send_message tool", () => {
  const registry = new ToolRegistry().registerAll([delegateTaskOrSendMessageTool]);

  it("is registered with the correct schema", () => {
    const schema = registry.schemas.find((s) => s.function.name === "delegate_task_or_send_message");
    assert.ok(schema);
    const props = schema!.function.parameters.properties as Record<string, unknown>;
    assert.ok(props.messages, "messages array must be declared");
    assert.deepEqual(schema!.function.parameters.required, ["messages"]);
  });

  it("delegates to valid members and reports delivery", async () => {
    const team = makeFakeTeam([member("arlo"), member("niko")]);
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "arlo", message: "build it" }, { agent_id: "niko", message: "design it" }] },
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, true);
    const data = result.data as { delivered_to: string[]; unknown_agent_ids: string[] };
    assert.deepEqual(data.delivered_to.sort(), ["arlo", "niko"]);
    assert.equal(team.delegations.length, 1);
    assert.equal(team.delegations[0]!.fromId, "head");
  });

  it("reports unknown agent ids and fails when none are valid", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "ghost", message: "hi" }] },
      ctxFor({ team, teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "no_valid_recipients");
  });

  it("rejects use by a non-head agent", async () => {
    const team = makeFakeTeam([member("arlo")]);
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "arlo", message: "x" }] },
      ctxFor({ team, teamSelfId: "arlo", teamSelfRole: "member" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "not_team_leader");
  });

  it("fails cleanly outside a team", async () => {
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [{ agent_id: "arlo", message: "x" }] },
      ctxFor(),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "team_unavailable");
  });

  it("rejects an empty messages array via schema", async () => {
    const result = await registry.execute(
      "delegate_task_or_send_message",
      { messages: [] },
      ctxFor({ team: makeFakeTeam([]), teamSelfId: "head", teamSelfRole: "head" }),
    );
    assert.equal(result.ok, false);
    assert.equal((result.error as { code: string }).code, "invalid_arguments");
  });
});
