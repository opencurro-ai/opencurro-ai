import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MultiAgentRunner } from "./orchestrator.js";
import { teamSessionStore } from "./teamSessionStore.js";
import type { MultiAgentRunRequest, TeamDefinition } from "./types.js";
import { ProviderRegistry } from "../providers/registry.js";
import type { Provider, StreamDelta } from "../providers/types.js";
import { createToolRegistry } from "../tools/index.js";
import { PlanApprovalStore } from "../../services/planApprovalStore.js";
import { QuestionStore } from "../../services/questionStore.js";
import { SessionEventBuffer } from "../../services/eventBuffer.js";
import type { ChatSession } from "../../services/sessionStore.js";
import { config } from "../../config.js";

/** A scripted fake provider that drives a full head → member → report → done collaboration. */
function makeScriptedProvider(): Provider {
  let callId = 0;
  const nextId = () => `call_${++callId}`;

  async function* stream(messages: Array<Record<string, unknown>>): AsyncGenerator<StreamDelta> {
    const system = String((messages[0]?.content as string) ?? "");
    const isHead = system.includes("Team Leader (Head)");
    const priorAssistant = messages.filter((m) => m.role === "assistant");
    const usedTool = (name: string): boolean =>
      priorAssistant.some((m) =>
        Array.isArray(m.tool_calls) &&
        (m.tool_calls as Array<{ function?: { name?: string } }>).some(
          (c) => c.function?.name === name,
        ),
      );
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastUserText = String((lastUser?.content as string) ?? "");

    if (isHead) {
      if (lastUserText.includes("Report from")) {
        // Review run: everything is done, produce the final user-facing answer.
        yield { text: "All tasks are complete. The team delivered the result." };
        yield { finishReason: "stop" };
        return;
      }
      if (!usedTool("delegate_task_or_send_message")) {
        // First head step: delegate to the member.
        yield {
          toolCalls: [
            {
              index: 0,
              id: nextId(),
              type: "function",
              function: {
                name: "delegate_task_or_send_message",
                arguments: JSON.stringify({
                  messages: [{ agent_id: "Niko", message: "Please design the landing page." }],
                }),
              },
            },
          ],
        };
        yield { finishReason: "tool_calls" };
        return;
      }
      // After delegation: end the head's first run without a final user answer yet.
      yield { text: "I have delegated the design work; waiting for results." };
      yield { finishReason: "stop" };
      return;
    }

    // Member behaviour.
    if (!usedTool("message_team_leader")) {
      yield {
        toolCalls: [
          {
            index: 0,
            id: nextId(),
            type: "function",
            function: {
              name: "message_team_leader",
              arguments: JSON.stringify({
                my_name: "Niko",
                message: "Design complete — see index.html.",
              }),
            },
          },
        ],
      };
      yield { finishReason: "tool_calls" };
      return;
    }
    yield { text: "Design finished and reported to the leader." };
    yield { finishReason: "stop" };
  }

  return {
    metadata: { id: "fake", label: "Fake", defaultBaseUrl: "http://localhost" },
    async listModels() {
      return [];
    },
    streamChatCompletion(options) {
      return stream(options.messages);
    },
  };
}

function makeTeam(): TeamDefinition {
  return {
    id: "test-team",
    name: "test team",
    leader: { name: "Elio", system_prompt: "You lead." },
    members: [{ name: "Niko", description: "designer", system_prompt: "You design." }],
  };
}

function makeSession(chatId: string): ChatSession {
  return {
    chatId,
    messages: [],
    eventBuffer: null,
    abortController: null,
    running: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function collect(buffer: SessionEventBuffer): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const out: Array<{ event: string; data: Record<string, unknown> }> = [];
  for await (const ev of buffer.subscribe(-1)) out.push({ event: ev.event, data: ev.data });
  return out;
}

describe("MultiAgentRunner orchestration", () => {
  it("runs a head → member → report → done collaboration and terminates", async () => {
    const chatId = "chat_test_1";
    teamSessionStore.reset(chatId);

    const providers = new ProviderRegistry().register(makeScriptedProvider());
    const tools = createToolRegistry();
    const runner = new MultiAgentRunner(
      providers,
      tools,
      config,
      new PlanApprovalStore(),
      new QuestionStore(),
    );

    const request: MultiAgentRunRequest = {
      chatId,
      userMessage: "Build me a landing page.",
      provider: "fake",
      model: "fake-model",
      apiKey: "x",
      team: makeTeam(),
      enableTeamMessaging: false,
    };

    const session = makeSession(chatId);
    const buffer = new SessionEventBuffer();

    // A hard timeout guard: if the collaboration ever failed to terminate, this test would hang;
    // the AbortSignal.timeout ensures the run cannot loop forever even on a regression.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    timer.unref?.();

    await runner.run(request, session, buffer, controller.signal);
    clearTimeout(timer);

    const events = await collect(buffer);
    const names = events.map((e) => e.event);

    assert.ok(names.includes("team_run_start"), "should announce the team");
    assert.ok(names.includes("team_message"), "the head should delegate to the member");
    assert.ok(
      events.some((e) => e.event === "agent_start" && e.data.role === "member"),
      "the member should start working",
    );
    assert.ok(
      events.some((e) => e.event === "agent_done" && e.data.role === "member" && e.data.ok === true),
      "the member should finish",
    );
    assert.ok(names.includes("team_done"), "the turn should end");
    assert.equal(names[names.length - 1], "done", "the stream must end with done");
    assert.ok(events.at(-1)!.data.ok === true, "the final done should be ok");

    // The head ran at least twice (delegate, then review after the member reported).
    const headStarts = events.filter((e) => e.event === "agent_start" && e.data.role === "head");
    assert.ok(headStarts.length >= 2, "the head should run again to review the member's report");

    // Context is retained across the turn for the next user message.
    const stored = teamSessionStore.get(chatId, "test-team");
    assert.ok(stored, "the team session should be stored for context reuse");
    assert.ok((stored!.actors.get("elio")?.history.length ?? 0) > 0, "head history retained");
    assert.ok((stored!.actors.get("niko")?.history.length ?? 0) > 0, "member history retained");
  });

  it("respects the abort signal and ends cleanly", async () => {
    const chatId = "chat_test_2";
    teamSessionStore.reset(chatId);

    const providers = new ProviderRegistry().register(makeScriptedProvider());
    const tools = createToolRegistry();
    const runner = new MultiAgentRunner(
      providers,
      tools,
      config,
      new PlanApprovalStore(),
      new QuestionStore(),
    );

    const request: MultiAgentRunRequest = {
      chatId,
      userMessage: "Build me a landing page.",
      provider: "fake",
      model: "fake-model",
      apiKey: "x",
      team: makeTeam(),
      enableTeamMessaging: false,
    };

    const session = makeSession(chatId);
    const buffer = new SessionEventBuffer();
    const controller = new AbortController();
    controller.abort(); // aborted before it starts

    await runner.run(request, session, buffer, controller.signal);
    const events = await collect(buffer);
    const last = events.at(-1)!;
    assert.equal(last.event, "done");
    assert.equal(last.data.ok, false);
  });
});
