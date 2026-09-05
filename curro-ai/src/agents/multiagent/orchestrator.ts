import type { AppConfig } from "../../config.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { resolveProvider } from "../providers/registry.js";
import type { Provider } from "../providers/types.js";
import type { ToolRegistry, OpenAIToolSchema } from "../tools/registry.js";
import type { ChatSession, StoredMessage } from "../../services/sessionStore.js";
import type { SessionEventBuffer } from "../../services/eventBuffer.js";
import type { PlanApprovalStore } from "../../services/planApprovalStore.js";
import type { QuestionStore } from "../../services/questionStore.js";
import type {
  MemoryRuntime,
  TeamDeliveryResult,
  TeamMemberInfo,
  TeamMemberStatusRecord,
  TeamRuntime,
  ToolContext,
  WebToolsConfig,
} from "../tools/types.js";
import { isVisionCapableModel } from "../../utils/vision.js";
import { createMemoryRuntime } from "../memory.js";
import { createKnowledgeRuntime } from "../knowledge.js";
import { createTodoRuntime } from "../todos.js";
import { createSkillRuntime } from "../skills.js";
import { mergeDefaultSkills, resolveDefaultSkills } from "../skills/index.js";
import { createSubAgentRuntime } from "../subagents.js";
import { mergeDefaultSubAgents, resolveDefaultSubAgents } from "../sub-agents/index.js";
import {
  TEAM_HEAD_ONLY_TOOLS,
  TEAM_MEMBER_ONLY_TOOLS,
  TEAM_MESSAGING_TOOL,
  TEAM_TOOLS,
} from "../tools/teamTools.js";
import { runAgentTurn, type AgentLoopDeps } from "./loop.js";
import { buildHeadSystemPrompt } from "./head/systemprompt.js";
import { buildMemberSystemPrompt } from "./members/systemprompt.js";
import { teamSessionStore } from "./teamSessionStore.js";
import {
  toMemberStatus,
  type ActorStatus,
  type AgentRole,
  type InboxMessage,
  type MultiAgentRunRequest,
  type TeamDefinition,
} from "./types.js";

/** Sub-agent session tools are not offered to team agents by default (kept consistent, low-risk). */
const SESSION_REUSE_TOOLS = ["list_sub_agent_sessions", "reuse_same_sub_agent_session"];

/** A single running agent within a team turn — head or member — with its own reused session. */
interface Actor {
  id: string; // lowercase key
  name: string; // display name (== agent id the model uses)
  role: AgentRole;
  systemPrompt: string;
  toolSchemas: OpenAIToolSchema[];
  allowed: Set<string>;
  history: StoredMessage[];
  status: ActorStatus;
  inbox: InboxMessage[];
  queued: boolean;
  runs: number;
}

/**
 * The multi-agent team runner. Executes one team turn: it seeds the head with the user's message,
 * then drives a bounded-concurrency scheduler in which the head delegates to members, members report
 * back, and (optionally) members message each other — all through inboxes so every agent reuses the
 * SAME session/context. The turn ends when every agent is idle and no inbox has pending work.
 *
 * Reliability guarantees (why this cannot freeze the app like the previous attempt):
 *  - At most `config.maxTeamConcurrency` agents ever stream from the LLM at once; the rest wait in a
 *    queue and start as slots free up. This bounds token/event throughput to a small constant.
 *  - Every inter-agent message goes through a shared, coalesced inbox; a busy agent's messages are
 *    delivered as ONE combined turn when it is next free — no re-run per message.
 *  - A hard `config.maxTeamMessages` budget stops NEW scheduling if agents ping-pong pathologically.
 *  - All streaming rides the existing SessionEventBuffer + DB write queue (which coalesce deltas),
 *    exactly like the single agent and sub-agents.
 */
export class MultiAgentRunner {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly config: AppConfig,
    private readonly planApprovals: PlanApprovalStore,
    private readonly askQuestions: QuestionStore,
  ) {}

  // ---- Per-turn scheduler state (a fresh MultiAgentRunner method call owns its own state via a
  //      TeamTurn instance, so the runner itself stays stateless and reusable across chats). ----

  async run(
    request: MultiAgentRunRequest,
    session: ChatSession,
    buffer: SessionEventBuffer,
    signal: AbortSignal,
  ): Promise<void> {
    const send = (event: string, data: Record<string, unknown>): void => {
      buffer.append(event, data);
    };

    try {
      let provider: Provider;
      try {
        provider = resolveProvider(this.providers, request.provider, request.customProvider);
      } catch (error) {
        send("error", { code: "provider_error", message: messageOf(error) });
        send("done", { ok: false });
        return;
      }

      const team = request.team;
      const enabledMembers = team.members.filter(
        (m) => m.enabled !== false && m.name.trim().length > 0,
      );

      const deps: AgentLoopDeps = {
        provider,
        tools: this.tools,
        model: request.model,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        temperature: request.temperature,
        effort: request.effort,
      };

      // Shared user-state runtimes — one instance per team turn, shared by every agent so memory,
      // knowledge, skills, and todos stay consistent across the whole team (mutations emit the same
      // *_updated events the frontend already persists).
      const memoryRuntime = createMemoryRuntime(request.memory ?? []);
      const knowledgeRuntime = createKnowledgeRuntime(request.knowledge ?? []);
      const todoRuntime = createTodoRuntime(request.todos ?? []);
      const defaultSkills = await resolveDefaultSkills();
      const skillRuntime = createSkillRuntime(
        mergeDefaultSkills(defaultSkills, request.skills ?? []),
      );
      const defaultSubAgents = await resolveDefaultSubAgents();
      const mergedSubAgents = mergeDefaultSubAgents(defaultSubAgents, request.subAgents ?? []);

      const web: WebToolsConfig = {
        searchProvider: request.searchProvider ?? this.config.searchProvider,
        fetchProvider: request.fetchProvider ?? this.config.fetchProvider,
        tavilyApiKey: request.tavilyApiKey || this.config.tavilyApiKey || undefined,
        exaApiKey: request.exaApiKey || this.config.exaApiKey || undefined,
        serpapiApiKey: request.serpapiApiKey || this.config.serpapiApiKey || undefined,
        firecrawlApiKey: request.firecrawlApiKey || this.config.firecrawlApiKey || undefined,
      };

      const turn = new TeamTurn({
        request,
        team,
        enabledMembers,
        deps,
        config: this.config,
        tools: this.tools,
        planApprovals: this.planApprovals,
        askQuestions: this.askQuestions,
        session,
        signal,
        send,
        web,
        memoryRuntime,
        knowledgeRuntime,
        todoRuntime,
        skillRuntime,
        mergedSubAgents,
        visionCapable: isVisionCapableModel(request.model, this.config),
      });

      await turn.execute();
    } catch (error) {
      send("error", { code: "team_crashed", message: messageOf(error) });
      send("done", { ok: false });
    } finally {
      buffer.setDone();
      session.running = false;
      session.updatedAt = Date.now();
    }
  }
}

interface TeamTurnDeps {
  request: MultiAgentRunRequest;
  team: TeamDefinition;
  enabledMembers: MultiAgentRunRequest["team"]["members"];
  deps: AgentLoopDeps;
  config: AppConfig;
  tools: ToolRegistry;
  planApprovals: PlanApprovalStore;
  askQuestions: QuestionStore;
  session: ChatSession;
  signal: AbortSignal;
  send: (event: string, data: Record<string, unknown>) => void;
  web: WebToolsConfig;
  memoryRuntime: MemoryRuntime;
  knowledgeRuntime: ReturnType<typeof createKnowledgeRuntime>;
  todoRuntime: ReturnType<typeof createTodoRuntime>;
  skillRuntime: ReturnType<typeof createSkillRuntime>;
  mergedSubAgents: ReturnType<typeof mergeDefaultSubAgents>;
  visionCapable: boolean;
}

/** One team turn's scheduler + message bus. Owns all mutable per-turn state. */
class TeamTurn {
  private readonly actors = new Map<string, Actor>();
  private readonly head: Actor;
  private readonly runQueue: string[] = [];
  private running = 0;
  private stopped = false;
  private messageCount = 0;
  private deliverySeq = 0;
  private settleResolve: (() => void) | null = null;

  constructor(private readonly d: TeamTurnDeps) {
    const { team, enabledMembers, request } = d;
    const messagingEnabled = request.enableTeamMessaging === true;

    // Restore prior per-agent sessions (context) for this chat + team, if any.
    const store = teamSessionStore.ensure(request.chatId, team.id);

    // Build the head actor.
    const headHistory = store.actors.get(key(team.leader.name))?.history ?? [];
    this.head = {
      id: key(team.leader.name),
      name: team.leader.name,
      role: "head",
      systemPrompt: buildHeadSystemPrompt(team, d.config.workspaceRoot, messagingEnabled),
      ...this.buildToolAccess("head", messagingEnabled),
      history: headHistory,
      status: "idle",
      inbox: [],
      queued: false,
      runs: 0,
    };
    this.actors.set(this.head.id, this.head);

    // Build member actors, reusing their stored histories where present.
    for (const member of enabledMembers) {
      const id = key(member.name);
      if (this.actors.has(id)) continue; // ignore duplicate names
      const history = store.actors.get(id)?.history ?? [];
      this.actors.set(id, {
        id,
        name: member.name,
        role: "member",
        systemPrompt: buildMemberSystemPrompt(member, team, d.config.workspaceRoot, messagingEnabled),
        ...this.buildToolAccess("member", messagingEnabled),
        history,
        status: "idle",
        inbox: [],
        queued: false,
        runs: 0,
      });
    }
  }

  /** Compute the advertised tool schemas + allowed set for a role. */
  private buildToolAccess(
    role: AgentRole,
    messagingEnabled: boolean,
  ): { toolSchemas: OpenAIToolSchema[]; allowed: Set<string> } {
    const base = this.d.tools
      .names()
      .filter((n) => !TEAM_TOOLS.includes(n) && !SESSION_REUSE_TOOLS.includes(n));

    const extra: string[] = ["list_agent_team_members"];
    if (role === "head") extra.push(...TEAM_HEAD_ONLY_TOOLS);
    else extra.push(...TEAM_MEMBER_ONLY_TOOLS);
    if (messagingEnabled) extra.push(TEAM_MESSAGING_TOOL);

    const names = [...base, ...extra];
    const allowed = new Set(names);
    return { toolSchemas: this.d.tools.schemasFor(names), allowed };
  }

  /** Run the whole team turn to completion. */
  async execute(): Promise<void> {
    const { team, send, request, memoryRuntime, knowledgeRuntime } = this.d;

    send("team_run_start", {
      team_id: team.id,
      team_name: team.name,
      messaging_enabled: request.enableTeamMessaging === true,
      leader: { agent_id: this.head.name, name: this.head.name },
      members: [...this.actors.values()]
        .filter((a) => a.role === "member")
        .map((a) => ({ agent_id: a.name, name: a.name, description: describe(this.d, a.name) })),
    });

    // Seed the head with the user's message. On the first message of a chat, prepend the pre-added
    // memory context + the roster so the leader starts already knowing its team and its memory.
    const isFirstUserMessage = !this.head.history.some((m) => m.role === "user");
    const rosterBlock = this.buildRosterBlock();
    const memoryContext = isFirstUserMessage ? memoryRuntime.firstMessageContext().trim() : "";
    const knowledgeContext = isFirstUserMessage
      ? knowledgeRuntime.firstMessageContext().trim()
      : "";
    const preamble = [memoryContext, knowledgeContext, isFirstUserMessage ? rosterBlock : ""]
      .filter((b) => b.length > 0)
      .join("\n\n");
    const headContent = preamble
      ? `${preamble}\n\n# User request\n${request.userMessage}`
      : request.userMessage;

    this.head.history.push({ role: "user", content: headContent });
    this.enqueue(this.head, `User request: ${truncate(request.userMessage, 120)}`);

    // Abort: stop scheduling new work; running loops observe the signal and exit on their own.
    const onAbort = (): void => {
      this.stopped = true;
      this.checkSettle();
    };
    if (this.d.signal.aborted) onAbort();
    else this.d.signal.addEventListener("abort", onAbort, { once: true });

    this.pump();
    await this.waitForSettle();

    // Persist every agent's transcript for the next user turn (context reuse) + the head transcript
    // as the chat's canonical session messages so the conversation continues seamlessly.
    this.persistSessions();

    send("team_done", {
      ok: !this.d.signal.aborted,
      aborted: this.d.signal.aborted,
      total_messages: this.messageCount,
    });
    send("done", { ok: !this.d.signal.aborted, aborted: this.d.signal.aborted });
  }

  private buildRosterBlock(): string {
    const members = [...this.actors.values()].filter((a) => a.role === "member");
    if (members.length === 0) {
      return "# Your team\nYou currently have no other members; handle the request yourself using your tools.";
    }
    const lines = members.map((a) => `- ${a.name} — ${describe(this.d, a.name)} (agent_id: ${a.name})`);
    return `# Your team members (delegate to them by their agent_id)\n${lines.join("\n")}`;
  }

  // ---- Scheduler ----

  private enqueue(actor: Actor, _reason: string): void {
    if (this.stopped) return;
    if (actor.status === "working" || actor.queued) return;
    actor.queued = true;
    actor.status = "queued";
    this.runQueue.push(actor.id);
    this.emitStatus(actor);
  }

  private pump(): void {
    if (this.stopped) {
      this.checkSettle();
      return;
    }
    while (this.running < this.d.config.maxTeamConcurrency && this.runQueue.length > 0) {
      const id = this.runQueue.shift();
      if (id === undefined) break;
      const actor = this.actors.get(id);
      if (!actor) continue;
      actor.queued = false;
      actor.status = "working";
      this.running += 1;
      this.emitStatus(actor);
      void this.runActor(actor).finally(() => {
        this.running -= 1;
        this.onActorFinished(actor);
        this.pump();
        this.checkSettle();
      });
    }
    this.checkSettle();
  }

  private onActorFinished(actor: Actor): void {
    if (actor.inbox.length > 0 && !this.stopped && !this.d.signal.aborted) {
      actor.queued = true;
      actor.status = "queued";
      this.runQueue.push(actor.id);
      this.emitStatus(actor);
    }
  }

  private checkSettle(): void {
    if (this.running > 0) return;
    if (!this.stopped && this.runQueue.length > 0) return;
    // Nothing running and nothing left to schedule → the turn is settled.
    if (this.settleResolve) {
      const resolve = this.settleResolve;
      this.settleResolve = null;
      resolve();
    }
  }

  private waitForSettle(): Promise<void> {
    return new Promise((resolve) => {
      this.settleResolve = resolve;
      // Guard: if already settled synchronously before we attached.
      if (this.running === 0 && (this.stopped || this.runQueue.length === 0)) {
        this.settleResolve = null;
        resolve();
      }
    });
  }

  // ---- One agent run ----

  private async runActor(actor: Actor): Promise<void> {
    const { send } = this.d;

    // Drain the whole inbox into ONE combined turn (coalescing — busy agents get all messages at once).
    const drained = actor.inbox.splice(0, actor.inbox.length);
    if (drained.length > 0) {
      actor.history.push({ role: "user", content: this.buildInboundMessage(actor, drained) });
    }

    actor.runs += 1;
    const stampedSend = (event: string, data: Record<string, unknown>): void =>
      send(event, { agent_id: actor.name, name: actor.name, role: actor.role, ...data });

    stampedSend("agent_start", {
      run: actor.runs,
      task: this.summarizeInbound(drained),
    });

    const toolCtx = this.buildToolCtx(actor, stampedSend);

    let result;
    try {
      result = await runAgentTurn({
        deps: this.d.deps,
        systemPrompt: actor.systemPrompt,
        history: actor.history,
        toolSchemas: actor.toolSchemas,
        allowed: actor.allowed,
        toolCtx,
        send: stampedSend,
        signal: this.d.signal,
      });
    } catch (error) {
      result = { ok: false, aborted: false, output: "", error: messageOf(error) };
    }

    if (result.aborted) {
      actor.status = "idle";
      stampedSend("agent_done", { run: actor.runs, ok: false, aborted: true });
      return;
    }

    actor.status = result.ok ? "done" : "failed";
    stampedSend("agent_message", { run: actor.runs, content: result.output });
    stampedSend("agent_done", {
      run: actor.runs,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  /** Build the tool context for an agent, including its own team runtime bridge. */
  private buildToolCtx(
    actor: Actor,
    stampedSend: (event: string, data: Record<string, unknown>) => void,
  ): ToolContext {
    const { d } = this;

    // A sub-agent runtime per actor so a team agent can still delegate to sub-agents; its sub_agent_*
    // events are stamped with this agent's id for attribution.
    const subAgentRuntime = createSubAgentRuntime({
      provider: d.deps.provider,
      tools: d.tools,
      config: d.config,
      chatId: d.request.chatId,
      definitions: [...d.mergedSubAgents],
      model: d.deps.model,
      apiKey: d.deps.apiKey,
      baseUrl: d.deps.baseUrl,
      temperature: d.deps.temperature,
      effort: d.deps.effort,
      send: (event, data) => stampedSend(event, data),
      getConversationContext: () => actor.history,
    });

    return {
      workspaceRoot: d.config.workspaceRoot,
      shellTimeoutMs: d.config.shellTimeoutMs,
      chatId: d.request.chatId,
      signal: d.signal,
      web: d.web,
      subAgents: subAgentRuntime,
      skills: d.skillRuntime,
      todos: d.todoRuntime,
      memory: d.memoryRuntime,
      knowledge: d.knowledgeRuntime,
      planApprovals: d.planApprovals,
      planApprovalTimeoutMs: d.config.planApprovalTimeoutMs,
      askQuestions: d.askQuestions,
      questionTimeoutMs: d.config.questionTimeoutMs,
      model: d.deps.model,
      visionCapable: d.visionCapable,
      availableToolNames: d.tools.names(),
      emit: stampedSend,
      team: this.buildTeamRuntime(actor),
    };
  }

  // ---- Team runtime bridge (the collaboration tools call into this) ----

  private buildTeamRuntime(actor: Actor): TeamRuntime {
    const self = actor;
    return {
      selfId: self.name,
      selfName: self.name,
      selfRole: self.role,
      leaderId: this.head.name,
      leaderName: this.head.name,
      messagingEnabled: this.d.request.enableTeamMessaging === true,
      listMembers: (): TeamMemberInfo[] =>
        [...this.actors.values()]
          .filter((a) => a.role === "member")
          .map((a) => ({
            agent_id: a.name,
            name: a.name,
            description: describe(this.d, a.name),
            role: "member" as const,
          })),
      delegate: (messages): TeamDeliveryResult =>
        this.route(self, messages, "delegate", { membersOnly: true }),
      sendToTeam: (recipients): TeamDeliveryResult =>
        this.route(self, recipients, "team_message", { membersOnly: false }),
      messageLeader: (fromName, message): { delivered: boolean } => {
        const ok = this.deliver(self, this.head, "report", message, fromName);
        return { delivered: ok };
      },
      status: (agentIds): TeamMemberStatusRecord[] =>
        agentIds.map((rawId) => {
          const target = this.actors.get(key(rawId));
          if (!target) {
            return {
              agent_id: rawId,
              name: rawId,
              role: "member",
              status: "unknown",
              queued_messages: 0,
            };
          }
          return {
            agent_id: target.name,
            name: target.name,
            role: target.role,
            status: toMemberStatus(target.status),
            queued_messages: target.inbox.length,
          };
        }),
    };
  }

  /** Route a batch of {agent_id, message} to targets, returning delivered/unknown ids. */
  private route(
    from: Actor,
    messages: Array<{ agent_id: string; message: string }>,
    kind: InboxMessage["kind"],
    opts: { membersOnly: boolean },
  ): TeamDeliveryResult {
    const delivered: string[] = [];
    const unknown: string[] = [];
    for (const item of messages) {
      const targetId = (item?.agent_id ?? "").trim();
      const target = this.actors.get(key(targetId));
      const invalid =
        !target ||
        target.id === from.id ||
        (opts.membersOnly && target.role !== "member");
      if (invalid) {
        if (targetId) unknown.push(targetId);
        continue;
      }
      if (this.deliver(from, target!, kind, item.message, from.name)) {
        delivered.push(target!.name);
      } else {
        unknown.push(targetId);
      }
    }
    return { delivered, unknown };
  }

  /** Deliver one message into a target's inbox and (re)schedule it. Enforces the message budget. */
  private deliver(
    from: Actor,
    to: Actor,
    kind: InboxMessage["kind"],
    message: string,
    fromName: string,
  ): boolean {
    if (this.stopped || this.d.signal.aborted) return false;

    this.messageCount += 1;
    if (this.messageCount > this.d.config.maxTeamMessages) {
      // Circuit-breaker: too many inter-agent messages. Stop scheduling new work and let the turn
      // wind down gracefully. This never truncates silently — it is announced to the UI + agents.
      this.stopped = true;
      this.d.send("team_notice", {
        level: "warning",
        code: "team_message_budget_reached",
        message:
          `The team reached its safety limit of ${this.d.config.maxTeamMessages} inter-agent ` +
          "messages for this turn and stopped accepting new messages to protect the app. In-flight " +
          "work will finish and the turn will end.",
      });
      this.checkSettle();
      return false;
    }

    to.inbox.push({
      fromId: from.name,
      fromName,
      fromRole: from.role,
      kind,
      message: typeof message === "string" ? message : String(message ?? ""),
    });

    const id = ++this.deliverySeq;
    this.d.send("team_message", {
      id: `tm_${id}`,
      from_id: from.name,
      from_name: fromName,
      from_role: from.role,
      to_id: to.name,
      to_role: to.role,
      kind,
      message: truncate(String(message ?? ""), 4000),
    });

    this.enqueue(to, `Message from ${fromName}`);
    // A new delivery may make a slot's worth of work available — pump on the next tick to avoid
    // deep synchronous recursion through tool execution.
    queueMicrotask(() => this.pump());
    return true;
  }

  // ---- Message framing ----

  private buildInboundMessage(actor: Actor, drained: InboxMessage[]): string {
    if (drained.length === 0) return "";
    const blocks = drained.map((m) => this.frameMessage(actor, m));
    const header =
      drained.length === 1
        ? "You have received the following message:"
        : `You have received ${drained.length} messages (handle each, then report):`;
    return `${header}\n\n${blocks.join("\n\n---\n\n")}`;
  }

  private frameMessage(actor: Actor, m: InboxMessage): string {
    switch (m.kind) {
      case "delegate":
        return (
          `[Task from your team leader ${m.fromName}]\n${m.message}\n\n` +
          "(This task was assigned by the team leader. When you finish, you MUST call " +
          "message_team_leader to report your results back to the leader.)"
        );
      case "report":
        return `[Report from ${m.fromName} (${m.fromRole === "head" ? "leader" : "member"})]\n${m.message}`;
      case "team_message":
        return (
          `[Message from ${m.fromName} (${m.fromRole === "head" ? "leader" : "member"})]\n${m.message}` +
          (actor.role === "member" && this.d.request.enableTeamMessaging
            ? "\n\n(If this needs a reply or you produced a result they are waiting on, respond with send_message_to_team.)"
            : "")
        );
      default:
        return m.message;
    }
  }

  private summarizeInbound(drained: InboxMessage[]): string {
    if (drained.length === 0) return "";
    if (drained.length === 1) return truncate(drained[0]!.message, 160);
    return `${drained.length} messages from ${[...new Set(drained.map((m) => m.fromName))].join(", ")}`;
  }

  private emitStatus(actor: Actor): void {
    this.d.send("agent_status", {
      agent_id: actor.name,
      name: actor.name,
      role: actor.role,
      status: toMemberStatus(actor.status),
      queued_messages: actor.inbox.length,
    });
  }

  private persistSessions(): void {
    try {
      const store = teamSessionStore.ensure(this.d.request.chatId, this.d.team.id);
      store.actors.clear();
      for (const actor of this.actors.values()) {
        store.actors.set(actor.id, {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          history: actor.history,
        });
      }
      // Mirror the head's transcript into the chat session so the conversation continues seamlessly
      // and the existing DB persistence (settleTurn) stores something meaningful.
      this.d.session.messages = this.head.history;
    } catch {
      // Persistence must never break the turn.
    }
  }
}

/** Lowercased key for case-insensitive agent id matching. */
function key(name: string): string {
  return (name ?? "").trim().toLowerCase();
}

/** Description of a member by name (from the team definition). */
function describe(d: TeamTurnDeps, name: string): string {
  const member = d.team.members.find((m) => key(m.name) === key(name));
  return member?.description ?? "team member";
}

function truncate(text: string, max: number): string {
  const t = typeof text === "string" ? text : String(text ?? "");
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}… [truncated]`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
