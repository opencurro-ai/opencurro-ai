import type { AppConfig } from "../../config.js";
import type { Provider, ToolCall, ToolCallDelta } from "../providers/types.js";
import type { ToolRegistry, OpenAIToolSchema } from "../tools/registry.js";
import type { StoredMessage } from "../../services/sessionStore.js";
import type {
  ToolContext,
  ToolResult,
  TeamRuntime,
  TeamMemberSummary,
  TeamMemberStatus,
  SkillRuntime,
  TodoRuntime,
  MemoryRuntime,
  KnowledgeRuntime,
  WebToolsConfig,
} from "../tools/types.js";
import { safeJsonParse } from "../../utils/json.js";
import {
  buildImageMessage,
  extractImageAttachment,
  withoutImageAttachment,
} from "../tools/readImage.js";
import { SUB_AGENT_RESTRICTED_TOOLS } from "../tools/subAgentRestrictedTools.js";
import { TEAM_HEAD_TOOLS, TEAM_MEMBER_TOOLS, isTeamTool } from "../tools/teamTools.js";
import { buildHeadSystemPrompt } from "./head/headAgent.js";
import { buildMemberSystemPrompt } from "./members/memberAgent.js";
import { actorStatus, type TeamActor, type TeamDefinition, type TeamInboxMessage } from "./types.js";

/** The sender label used for the originating user request. */
const USER_SENDER = "user";

export interface TeamRunnerDeps {
  provider: Provider;
  tools: ToolRegistry;
  config: AppConfig;
  chatId: string;
  team: TeamDefinition;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  /** Shared runtimes for the whole team turn (mirror the main agent's). */
  web: WebToolsConfig;
  skills?: SkillRuntime;
  todos?: TodoRuntime;
  memory?: MemoryRuntime;
  knowledge?: KnowledgeRuntime;
  visionCapable?: boolean;
  /** Emit an SSE event onto the turn's buffer. */
  send: (event: string, data: Record<string, unknown>) => void;
  /** Abort signal for the whole team turn (user cancellation). */
  signal: AbortSignal;
  /**
   * Pre-existing actor conversation histories (keyed by lowercased agent id), preserved across
   * user turns of the same chat so every agent keeps its context. Missing agents start fresh.
   */
  priorHistories?: Map<string, StoredMessage[]>;
}

/**
 * The multi-agent TEAM runtime.
 *
 * It runs a whole team of real, independent agents (one head/leader + N members) inside a single
 * chat turn. Each agent is an "actor" with its own persistent conversation, its own inbox queue, and
 * its own streaming Thought→Action→Observation loop. Agents collaborate purely by sending each other
 * messages through the five team tools:
 *  - the head delegates work with delegate_task_or_send_message and checks get_team_members_status,
 *  - members report back with message_team_leader and talk to peers with send_message_to_team.
 *
 * Message delivery NEVER creates a new session: a message is appended to the target actor's existing
 * conversation, and the actor is (re)activated to process it, so context is always preserved.
 *
 * Concurrency & the queue: JavaScript is single-threaded, so each actor is serialized by a `running`
 * flag. If a message arrives for an actor that is busy, it waits in that actor's inbox; when the
 * actor becomes free it drains ALL queued messages at once and processes them as one combined turn.
 * Multiple different actors run concurrently (their async loops interleave on the event loop). The
 * whole team turn completes only when every actor is idle with an empty inbox (quiescence).
 *
 * The head may finish and go idle after delegating; its members keep working and the head is
 * re-activated automatically when a member reports back — stopping/finishing the head never stops the
 * members.
 */
export class TeamRunner implements TeamRuntime {
  readonly headAgentId: string;

  private readonly actors = new Map<string, TeamActor>();
  /** Actor lookup by lowercased id for tolerant matching. */
  private readonly byKey = new Map<string, TeamActor>();
  private readonly order: string[] = [];
  private readonly startedActors = new Set<string>();

  /** Number of actor loops currently executing (for quiescence detection). */
  private active = 0;
  private idleResolvers: Array<() => void> = [];

  /** Cached per-role tool schemas. */
  private readonly headSchemas: OpenAIToolSchema[];
  private readonly memberSchemas: OpenAIToolSchema[];
  private readonly headAllowed: Set<string>;
  private readonly memberAllowed: Set<string>;

  /** The head's most recent final (tool-call-free) answer — the user-facing result. */
  private lastHeadFinal = "";

  constructor(private readonly deps: TeamRunnerDeps) {
    const head = deps.team.head;
    this.headAgentId = head.name.trim();

    // Build the head actor.
    const headActor: TeamActor = {
      id: this.headAgentId,
      name: this.headAgentId,
      role: "head",
      description: "Team leader",
      systemPrompt: buildHeadSystemPrompt(deps.team, deps.config.workspaceRoot),
      history: deps.priorHistories?.get(this.headAgentId.toLowerCase()) ?? [],
      inbox: [],
      running: false,
      stopped: false,
      activated: false,
    };
    this.register(headActor);

    // Build each member actor.
    for (const member of deps.team.members) {
      const id = member.name.trim();
      if (!id) continue;
      if (this.byKey.has(id.toLowerCase())) continue; // ignore duplicate names
      const actor: TeamActor = {
        id,
        name: id,
        role: "member",
        description: member.description ?? "",
        systemPrompt: buildMemberSystemPrompt(member, deps.team, deps.config.workspaceRoot),
        history: deps.priorHistories?.get(id.toLowerCase()) ?? [],
        inbox: [],
        running: false,
        stopped: false,
        activated: false,
      };
      this.register(actor);
    }

    // Tool access per role: the sub-agent-safe tool surface (no recursion, no human-in-the-loop),
    // plus that role's team collaboration tools.
    this.headAllowed = this.buildAllowed(TEAM_HEAD_TOOLS);
    this.memberAllowed = this.buildAllowed(TEAM_MEMBER_TOOLS);
    this.headSchemas = deps.tools.schemasFor(this.headAllowed);
    this.memberSchemas = deps.tools.schemasFor(this.memberAllowed);
  }

  private register(actor: TeamActor): void {
    this.actors.set(actor.id, actor);
    this.byKey.set(actor.id.toLowerCase(), actor);
    this.order.push(actor.id);
  }

  /**
   * The allowed tool set for a role: every registered tool that is safe for a delegated agent
   * (excludes the sub-agent restricted set — no recursive delegation, no submit_plan /
   * ask_question_to_user / embed_url / attach_files / todos) and is not a team tool, PLUS the given
   * team tools for this role.
   */
  private buildAllowed(roleTeamTools: readonly string[]): Set<string> {
    const allowed = new Set<string>();
    for (const name of this.deps.tools.names()) {
      if (isTeamTool(name)) continue;
      if (SUB_AGENT_RESTRICTED_TOOLS.includes(name)) continue;
      allowed.add(name);
    }
    for (const name of roleTeamTools) {
      if (this.deps.tools.has(name)) allowed.add(name);
    }
    return allowed;
  }

  // -------------------------------------------------------------------------------------------
  // Public entry point
  // -------------------------------------------------------------------------------------------

  /**
   * Run the team turn: deliver the user's request to the head, then let the team collaborate until
   * quiescence (every actor idle with an empty inbox) or the turn is aborted. Returns the head's
   * final user-facing answer and the (mutated) actor histories so the caller can persist them.
   */
  async run(userMessage: string): Promise<{ ok: boolean; finalAnswer: string; aborted: boolean }> {
    const head = this.byKey.get(this.headAgentId.toLowerCase());
    if (!head) {
      return { ok: false, finalAnswer: "", aborted: false };
    }

    // Announce the roster so the frontend can render a block per agent up front.
    this.deps.send("team_start", {
      team: this.deps.team.name,
      head_agent_id: this.headAgentId,
      team_agents: this.order.map((id) => {
        const a = this.actors.get(id)!;
        return { agent_id: a.id, name: a.name, role: a.role, description: a.description };
      }),
    });

    // The user's request goes to the head.
    this.enqueue(head, {
      from: USER_SENDER,
      fromLabel: "the user",
      body: userMessage,
    });
    this.deps.send("team_agent_message", {
      from: USER_SENDER,
      from_label: "User",
      to: head.id,
      to_label: head.name,
      message: userMessage,
    });

    this.scheduleActor(head.id);
    await this.waitForQuiescence();

    const aborted = this.deps.signal.aborted;
    return { ok: !aborted, finalAnswer: this.lastHeadFinal, aborted };
  }

  /** The final actor histories (for cross-turn persistence). Keyed by lowercased agent id. */
  histories(): Map<string, StoredMessage[]> {
    const map = new Map<string, StoredMessage[]>();
    for (const actor of this.actors.values()) {
      map.set(actor.id.toLowerCase(), actor.history);
    }
    return map;
  }

  // -------------------------------------------------------------------------------------------
  // TeamRuntime implementation (called from the team tools)
  // -------------------------------------------------------------------------------------------

  listMembers(): TeamMemberSummary[] {
    return this.order
      .map((id) => this.actors.get(id)!)
      .filter((a) => a.role === "member")
      .map((a) => ({ agent_id: a.id, name: a.name, description: a.description, role: a.role }));
  }

  status(agentIds: string[]): TeamMemberStatus[] {
    return agentIds.map((rawId) => {
      const actor = this.byKey.get((rawId ?? "").trim().toLowerCase());
      if (!actor) {
        return {
          agent_id: rawId,
          name: rawId,
          role: "member" as const,
          status: "unknown" as const,
          queued_messages: 0,
        };
      }
      return {
        agent_id: actor.id,
        name: actor.name,
        role: actor.role,
        status: actorStatus(actor),
        queued_messages: actor.inbox.length,
      };
    });
  }

  delegate(
    fromAgentId: string,
    messages: Array<{ agent_id: string; message: string }>,
  ): ToolResult {
    const sender = this.byKey.get((fromAgentId ?? "").trim().toLowerCase());
    if (!sender || sender.role !== "head") {
      return {
        ok: false,
        error: {
          code: "not_leader",
          message: "Only the team head can delegate tasks with delegate_task_or_send_message.",
        },
      };
    }
    return this.route(sender, messages, "the team leader");
  }

  sendToTeam(
    fromAgentId: string,
    recipients: Array<{ agent_id: string; message: string }>,
  ): ToolResult {
    const sender = this.byKey.get((fromAgentId ?? "").trim().toLowerCase());
    if (!sender) {
      return {
        ok: false,
        error: { code: "unknown_sender", message: "The sending agent is not part of this team." },
      };
    }
    const senderLabel = sender.role === "head" ? "the team leader" : `your teammate ${sender.name}`;
    return this.route(sender, recipients, senderLabel);
  }

  messageLeader(fromAgentId: string, myName: string, message: string): ToolResult {
    const sender = this.byKey.get((fromAgentId ?? "").trim().toLowerCase());
    const head = this.byKey.get(this.headAgentId.toLowerCase());
    if (!sender || !head) {
      return {
        ok: false,
        error: { code: "team_unavailable", message: "The team leader is not available." },
      };
    }
    const label = (myName ?? "").trim() || sender.name;
    this.enqueue(head, {
      from: sender.id,
      fromLabel: `your team member ${label}`,
      body: message,
    });
    this.deps.send("team_agent_message", {
      from: sender.id,
      from_label: sender.name,
      to: head.id,
      to_label: head.name,
      message,
    });
    this.scheduleActor(head.id);
    return {
      ok: true,
      data: {
        delivered_to: head.name,
        message:
          "Your message was delivered to the team leader. The leader will review it and respond " +
          "when ready. Your turn is complete — you can stop now; you will be re-activated if the " +
          "leader sends you more work.",
      },
    };
  }

  /** Shared routing for delegate/sendToTeam: enqueue each message to its recipient + activate it. */
  private route(
    sender: TeamActor,
    messages: Array<{ agent_id: string; message: string }>,
    senderLabel: string,
  ): ToolResult {
    const delivered: string[] = [];
    const failed: Array<{ agent_id: string; error: string }> = [];

    for (const msg of messages) {
      const targetId = (msg?.agent_id ?? "").trim();
      const body = (msg?.message ?? "").trim();
      const target = this.byKey.get(targetId.toLowerCase());
      if (!target) {
        failed.push({
          agent_id: targetId,
          error: `No team member with id "${targetId}" exists. Available: ${this.order.join(", ")}.`,
        });
        continue;
      }
      if (target.id === sender.id) {
        failed.push({ agent_id: targetId, error: "An agent cannot send a message to itself." });
        continue;
      }
      if (!body) {
        failed.push({ agent_id: targetId, error: "The message must not be empty." });
        continue;
      }
      this.enqueue(target, { from: sender.id, fromLabel: senderLabel, body });
      this.deps.send("team_agent_message", {
        from: sender.id,
        from_label: sender.name,
        to: target.id,
        to_label: target.name,
        message: body,
      });
      this.scheduleActor(target.id);
      delivered.push(target.name);
    }

    if (delivered.length === 0 && failed.length > 0) {
      return {
        ok: false,
        error: {
          code: "delivery_failed",
          message: `None of the messages could be delivered. ${failed
            .map((f) => `${f.agent_id}: ${f.error}`)
            .join(" ")}`,
        },
      };
    }

    return {
      ok: true,
      data: {
        delivered_to: delivered,
        failed: failed.length > 0 ? failed : undefined,
        message:
          `Message(s) delivered to: ${delivered.join(", ")}. ` +
          "They are now working on it and will report their results back to you when ready. You do " +
          "not need to wait — continue with anything else, or stop and you will be re-activated " +
          "when they respond." +
          (failed.length > 0 ? ` Note: ${failed.length} message(s) failed to deliver.` : ""),
      },
    };
  }

  // -------------------------------------------------------------------------------------------
  // Actor scheduling + the message queue
  // -------------------------------------------------------------------------------------------

  /** Append a message to an actor's inbox (the queue). */
  private enqueue(actor: TeamActor, message: TeamInboxMessage): void {
    if (actor.stopped) return;
    actor.inbox.push(message);
    this.emitStatus(actor);
  }

  /**
   * Ensure an actor is (or will be) processing its inbox. If it is idle, start its run loop; if it is
   * already running, the newly-queued message will be drained when its current loop iteration ends.
   */
  private scheduleActor(id: string): void {
    const actor = this.byKey.get(id.toLowerCase());
    if (!actor || actor.stopped || actor.running) return;
    if (actor.inbox.length === 0) return;
    actor.running = true;
    this.active += 1;
    void this.runActor(actor)
      .catch((error) => {
        // runActor is defensively written not to throw, but never let a stray rejection wedge the
        // whole team turn — surface it and let the actor settle so quiescence can still be reached.
        this.deps.send("team_agent_error", { agent_id: actor.id, message: messageOf(error) });
      })
      .finally(() => {
        actor.running = false;
        this.active -= 1;
        // A message may have arrived for this actor while its final loop iteration was ending — if
        // so, relaunch it. (No await runs between the inbox-empty check inside runActor and here.)
        if (!actor.stopped && actor.inbox.length > 0) {
          this.scheduleActor(actor.id);
          return;
        }
        this.emitStatus(actor);
        if (this.active === 0) this.checkQuiescence();
      });
  }

  /**
   * Drive one actor: while it has queued messages (and the turn is not aborted), drain ALL of them
   * into a single combined user turn and run the streaming agentic loop over its own conversation.
   */
  private async runActor(actor: TeamActor): Promise<void> {
    while (!actor.stopped && !this.deps.signal.aborted && actor.inbox.length > 0) {
      const batch = actor.inbox.splice(0, actor.inbox.length);
      actor.activated = true;

      if (!this.startedActors.has(actor.id)) {
        this.startedActors.add(actor.id);
        this.deps.send("team_agent_start", {
          agent_id: actor.id,
          name: actor.name,
          role: actor.role,
          description: actor.description,
        });
      }
      this.emitStatus(actor);

      const delivered = buildDeliveredUserContent(batch);
      actor.history.push({ role: "user", content: delivered });

      await this.agenticLoop(actor);
    }
  }

  /**
   * The streaming Thought→Action→Observation loop for a single actor. Unbounded (no iteration
   * limit): it runs until the model returns a final answer with no tool calls, or the turn aborts.
   * Emits team_agent_* events stamped with the actor id so the frontend renders each agent live.
   */
  private async agenticLoop(actor: TeamActor): Promise<void> {
    const { provider, tools } = this.deps;
    const isHead = actor.role === "head";
    const toolSchemas = isHead ? this.headSchemas : this.memberSchemas;
    const allowed = isHead ? this.headAllowed : this.memberAllowed;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.deps.signal.aborted) {
        this.deps.send("team_agent_turn_done", { agent_id: actor.id, ok: false, aborted: true });
        return;
      }

      const answerParts: string[] = [];
      const reasoningParts: string[] = [];
      let toolCalls: ToolCall[] = [];
      let finishReason: string | null = null;

      try {
        const stream = provider.streamChatCompletion({
          apiKey: this.deps.apiKey,
          model: this.deps.model,
          messages: buildProviderMessages(actor.systemPrompt, actor.history),
          tools: toolSchemas,
          baseUrl: this.deps.baseUrl,
          temperature: this.deps.temperature,
          effort: this.deps.effort,
          signal: this.deps.signal,
        });

        for await (const delta of stream) {
          if (delta.reasoning) {
            const cleaned = normalize(delta.reasoning);
            reasoningParts.push(cleaned);
            this.deps.send("team_agent_reasoning", { agent_id: actor.id, value: cleaned });
          }
          if (delta.text) {
            const cleaned = normalize(delta.text);
            answerParts.push(cleaned);
            this.deps.send("team_agent_token", { agent_id: actor.id, value: cleaned });
          }
          if (delta.toolCalls) {
            toolCalls = mergeToolCalls(toolCalls, delta.toolCalls);
          }
          if (delta.finishReason) finishReason = delta.finishReason;
        }
      } catch (error) {
        if (this.deps.signal.aborted) {
          this.deps.send("team_agent_turn_done", { agent_id: actor.id, ok: false, aborted: true });
          return;
        }
        const message = `Provider error: ${messageOf(error)}`;
        this.deps.send("team_agent_error", { agent_id: actor.id, message });
        this.deps.send("team_agent_turn_done", { agent_id: actor.id, ok: false, error: message });
        return;
      }

      const namedCalls = toolCalls.filter((c) => c.function.name);
      const hasToolCalls = namedCalls.length > 0 || finishReason === "tool_calls";

      if (hasToolCalls && namedCalls.length > 0) {
        const assistantMessage: StoredMessage = {
          role: "assistant",
          content: answerParts.join("") || null,
          tool_calls: namedCalls.map((c) => ({
            id: c.id,
            type: c.type,
            function: { name: c.function.name, arguments: c.function.arguments },
          })),
        };
        if (reasoningParts.length > 0) assistantMessage.reasoning_content = reasoningParts.join("");
        actor.history.push(assistantMessage);

        const imageMessages: StoredMessage[] = [];

        for (const toolCall of namedCalls) {
          const name = toolCall.function.name;
          const args = safeJsonParse(toolCall.function.arguments);
          const label = tools.label(name, args);

          this.deps.send("team_agent_tool_call", {
            agent_id: actor.id,
            tool_id: toolCall.id,
            name,
            args,
            label,
          });

          const result: ToolResult = allowed.has(name)
            ? await tools.execute(name, args, this.buildToolCtx(actor, toolCall.id ?? undefined))
            : {
                ok: false,
                error: {
                  code: "tool_not_permitted",
                  message: `The agent "${actor.name}" is not permitted to use the tool "${name}".`,
                },
              };

          const resultForModel = withoutImageAttachment(result);
          const imageAttachment = extractImageAttachment(result);

          actor.history.push({
            role: "tool",
            tool_call_id: toolCall.id ?? undefined,
            name,
            content: JSON.stringify(resultForModel),
          });

          if (imageAttachment) imageMessages.push(buildImageMessage(imageAttachment));

          this.deps.send("team_agent_tool_result", {
            agent_id: actor.id,
            tool_id: toolCall.id,
            name,
            ok: result.ok,
            result: resultForModel,
            label,
          });
        }

        for (const imageMessage of imageMessages) actor.history.push(imageMessage);

        // Observation delivered — loop so the actor can reason about the results.
        continue;
      }

      // No tool calls -> the actor's final answer for this activation.
      const finalContent = answerParts.join("");
      const finalMessage: StoredMessage = { role: "assistant", content: finalContent };
      if (reasoningParts.length > 0) finalMessage.reasoning_content = reasoningParts.join("");
      actor.history.push(finalMessage);

      // The head's final tool-call-free answer is the user-facing result of the whole turn.
      if (isHead && finalContent.trim().length > 0) this.lastHeadFinal = finalContent;

      this.deps.send("team_agent_turn_done", { agent_id: actor.id, ok: true });
      return;
    }
  }

  /** Build the ToolContext for one of an actor's tool calls. */
  private buildToolCtx(actor: TeamActor, toolCallId: string | undefined): ToolContext {
    return {
      workspaceRoot: this.deps.config.workspaceRoot,
      chatId: this.deps.chatId,
      shellTimeoutMs: this.deps.config.shellTimeoutMs,
      signal: this.deps.signal,
      web: this.deps.web,
      skills: this.deps.skills,
      todos: this.deps.todos,
      memory: this.deps.memory,
      knowledge: this.deps.knowledge,
      team: this,
      teamAgentId: actor.id,
      toolCallId,
      model: this.deps.model,
      visionCapable: this.deps.visionCapable,
      availableToolNames: this.deps.tools.names(),
      emit: (event, data) => this.deps.send(event, data),
    };
  }

  // -------------------------------------------------------------------------------------------
  // Quiescence + status
  // -------------------------------------------------------------------------------------------

  private emitStatus(actor: TeamActor): void {
    this.deps.send("team_agent_status", {
      agent_id: actor.id,
      name: actor.name,
      role: actor.role,
      status: actorStatus(actor),
      queued_messages: actor.inbox.length,
    });
  }

  /** Resolve the quiescence promise if nothing is running and no actor has pending work. */
  private checkQuiescence(): void {
    if (this.active > 0) return;
    const pending = this.order
      .map((id) => this.actors.get(id)!)
      .find((a) => !a.stopped && a.inbox.length > 0);
    if (pending) {
      this.scheduleActor(pending.id);
      return;
    }
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  /** Resolve once the team reaches quiescence (or is already quiescent). */
  private waitForQuiescence(): Promise<void> {
    if (this.active === 0 && !this.order.some((id) => this.actors.get(id)!.inbox.length > 0)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
      // Guard against an already-idle race.
      if (this.active === 0) this.checkQuiescence();
    });
  }
}

/**
 * Frame one or more delivered inbox messages as a single user turn for the receiving actor. When a
 * batch of messages arrived while the actor was busy, they are combined so the actor can address them
 * all in one go, then report back once.
 */
function buildDeliveredUserContent(batch: TeamInboxMessage[]): string {
  if (batch.length === 1) {
    const m = batch[0]!;
    return `You received a message from ${m.fromLabel}:\n\n${m.body}`;
  }
  const header =
    `You received ${batch.length} messages from your team while you were busy. Address each of ` +
    `them, then report your results back.\n`;
  const blocks = batch
    .map((m, i) => `--- Message ${i + 1} (from ${m.fromLabel}) ---\n${m.body}`)
    .join("\n\n");
  return `${header}\n${blocks}`;
}

/** Build provider (OpenAI) messages: system prompt followed by the actor's conversation. */
function buildProviderMessages(
  systemPrompt: string,
  messages: StoredMessage[],
): Array<Record<string, unknown>> {
  const built: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
  for (const message of messages) {
    const entry: Record<string, unknown> = { role: message.role };
    if (message.content !== undefined && message.content !== null) entry.content = message.content;
    else if (message.role === "assistant" && message.tool_calls) entry.content = null;
    if (message.tool_calls) entry.tool_calls = message.tool_calls;
    if (message.tool_call_id) entry.tool_call_id = message.tool_call_id;
    if (message.name) entry.name = message.name;
    if (message.reasoning_content) entry.reasoning_content = message.reasoning_content;
    built.push(entry);
  }
  return built;
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Merge streamed tool-call fragments into complete tool calls, keyed by index. */
function mergeToolCalls(accumulated: ToolCall[], incoming: ToolCallDelta[]): ToolCall[] {
  const merged = accumulated.slice();
  for (const chunk of incoming) {
    const index = chunk.index ?? merged.length;
    while (merged.length <= index) {
      merged.push({ id: null, type: "function", function: { name: "", arguments: "" } });
    }
    const target = merged[index]!;
    if (chunk.id) target.id = chunk.id;
    if (chunk.function?.name) target.function.name += chunk.function.name;
    if (chunk.function?.arguments) target.function.arguments += chunk.function.arguments;
  }
  return merged;
}
