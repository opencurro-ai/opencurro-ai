import type { AppConfig } from "../../config.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { resolveProvider } from "../providers/registry.js";
import type { Provider } from "../providers/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { SessionEventBuffer } from "../../services/eventBuffer.js";
import type { PlanApprovalStore } from "../../services/planApprovalStore.js";
import type { QuestionStore } from "../../services/questionStore.js";
import type { StoredMessage } from "../../services/sessionStore.js";
import type {
  KnowledgeFile,
  MemoryFile,
  SkillDefinition,
  SubAgentDefinition,
  TeamRosterEntry,
  TeamRuntime,
  ToolContext,
  WebToolsConfig,
} from "../tools/types.js";
import { createSubAgentRuntime } from "../subagents.js";
import { createSkillRuntime } from "../skills.js";
import { mergeDefaultSkills, resolveDefaultSkills } from "../skills/index.js";
import { resolveDefaultSubAgents, mergeDefaultSubAgents } from "../sub-agents/index.js";
import { createTodoRuntime } from "../todos.js";
import { createMemoryRuntime } from "../memory.js";
import { createKnowledgeRuntime } from "../knowledge.js";
import { isVisionCapableModel } from "../../utils/vision.js";
import { Semaphore } from "./concurrency.js";
import { runTeamAgentLoop } from "./agentLoop.js";
import { teamSessionStore } from "./teamSessionStore.js";
import { buildHeadSystemPrompt, computeHeadTools } from "./head/index.js";
import { buildMemberSystemPrompt, computeMemberTools } from "./members/index.js";
import {
  HEAD_AGENT_ID,
  type TeamAgentState,
  type TeamDefinition,
  type TeamMessage,
} from "./types.js";

/** Everything needed to run one multi-agent team turn (mirrors RunAgentRequest + team fields). */
export interface RunTeamRequest {
  chatId: string;
  userMessage: string;
  team: TeamDefinition;
  /** Whether members may message each other (gates send_message_to_team). */
  sendMessageToTeamEnabled: boolean;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  customProvider?: unknown;
  temperature?: number;
  effort?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  serpapiApiKey?: string;
  searchProvider?: "duckduckgo" | "tavily" | "exa" | "serpapi";
  fetchProvider?: "builtin" | "firecrawl";
  firecrawlApiKey?: string;
  subAgents?: SubAgentDefinition[];
  skills?: SkillDefinition[];
  memory?: MemoryFile[];
  knowledge?: KnowledgeFile[];
}

type Send = (event: string, data: Record<string, unknown>) => void;

/**
 * The multi-agent runner. Analogous to AgentRunner, but instead of a single loop it constructs a
 * TeamOrchestrator that coordinates the head + members, streams every agent's output onto the shared
 * event buffer, and completes when the whole team goes quiescent.
 */
export class MultiAgentRunner {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly config: AppConfig,
    private readonly planApprovals: PlanApprovalStore,
    private readonly askQuestions: QuestionStore,
  ) {}

  async run(request: RunTeamRequest, buffer: SessionEventBuffer, signal: AbortSignal): Promise<void> {
    const send: Send = (event, data) => buffer.append(event, data);

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
        (m) => m.enabled !== false && m.id.trim().length > 0,
      );
      if (enabledMembers.length === 0) {
        // A team with no members degenerates to a single leader answering the user directly, which is
        // just the normal agent — guard against it so the head doesn't wait forever for helpers.
        send("error", {
          code: "empty_team",
          message: "This agent team has no enabled members. Add members or disable multi-agent mode.",
        });
        send("done", { ok: false });
        return;
      }

      // Shared per-turn runtimes (identical to the single agent's), forwarded to EVERY team agent so
      // members/head can use memory, knowledge, skills, sub-agents and todos.
      const memoryRuntime = createMemoryRuntime(request.memory ?? []);
      const knowledgeRuntime = createKnowledgeRuntime(request.knowledge ?? []);
      const todoRuntime = createTodoRuntime([]);
      const defaultSubAgents = await resolveDefaultSubAgents();
      const subAgentRuntime = createSubAgentRuntime({
        provider,
        tools: this.tools,
        config: this.config,
        chatId: request.chatId,
        definitions: mergeDefaultSubAgents(defaultSubAgents, request.subAgents ?? []),
        model: request.model,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        temperature: request.temperature,
        effort: request.effort,
        send,
      });
      const defaultSkills = await resolveDefaultSkills();
      const skillRuntime = createSkillRuntime(
        mergeDefaultSkills(defaultSkills, request.skills ?? []),
      );

      const web: WebToolsConfig = {
        searchProvider: request.searchProvider ?? this.config.searchProvider,
        fetchProvider: request.fetchProvider ?? this.config.fetchProvider,
        tavilyApiKey: request.tavilyApiKey || this.config.tavilyApiKey || undefined,
        exaApiKey: request.exaApiKey || this.config.exaApiKey || undefined,
        serpapiApiKey: request.serpapiApiKey || this.config.serpapiApiKey || undefined,
        firecrawlApiKey: request.firecrawlApiKey || this.config.firecrawlApiKey || undefined,
      };

      const orchestrator = new TeamOrchestrator({
        provider,
        tools: this.tools,
        config: this.config,
        request,
        send,
        signal,
        web,
        memoryRuntime,
        knowledgeRuntime,
        todoRuntime,
        subAgentRuntime,
        skillRuntime,
        planApprovals: this.planApprovals,
        askQuestions: this.askQuestions,
      });

      await orchestrator.run();
      send("done", { ok: !signal.aborted, aborted: signal.aborted });
    } catch (error) {
      send("error", { code: "team_crashed", message: messageOf(error) });
      send("done", { ok: false });
    } finally {
      buffer.setDone();
    }
  }
}

interface OrchestratorDeps {
  provider: Provider;
  tools: ToolRegistry;
  config: AppConfig;
  request: RunTeamRequest;
  send: Send;
  signal: AbortSignal;
  web: WebToolsConfig;
  memoryRuntime: ReturnType<typeof createMemoryRuntime>;
  knowledgeRuntime: ReturnType<typeof createKnowledgeRuntime>;
  todoRuntime: ReturnType<typeof createTodoRuntime>;
  subAgentRuntime: ReturnType<typeof createSubAgentRuntime>;
  skillRuntime: ReturnType<typeof createSkillRuntime>;
  planApprovals: PlanApprovalStore;
  askQuestions: QuestionStore;
}

/**
 * Coordinates one multi-agent team turn.
 *
 * Design guarantees (these are what keep the app responsive and prevent the historical freeze):
 *  - Each agent processes ONE activation at a time. Messages that arrive while it is busy are queued
 *    on its mailbox and drained together (coalesced into a single prompt) when it next runs — bursts
 *    collapse instead of spawning an activation per message.
 *  - Concurrent provider streams are capped by a shared semaphore (config.multiAgentMaxConcurrency).
 *  - A team-wide activation cap (config.multiAgentMaxActivations) is a hard backstop against runaway
 *    ping-pong.
 *  - Messaging is fire-and-forget: no agent ever blocks waiting for another, so there is no deadlock.
 *  - The turn ends when the team is quiescent (nothing running, nothing queued).
 */
class TeamOrchestrator implements TeamRuntime {
  readonly sendMessageToTeamEnabled: boolean;
  readonly head: { id: string; name: string };

  private readonly agents = new Map<string, TeamAgentState>();
  private readonly semaphore: Semaphore;
  private readonly maxActivations: number;
  private readonly allRegistryTools: string[];
  private readonly headTools: Set<string>;
  private readonly memberTools: Set<string>;

  private pending = 0;
  private activationCount = 0;
  private cappedNotified = false;
  private resolveDone: (() => void) | null = null;
  private donePromise: Promise<void> | null = null;
  /** Per-activation flag: did this member message the leader during its current activation? */
  private readonly messagedLeader = new Set<string>();

  constructor(private readonly deps: OrchestratorDeps) {
    const team = deps.request.team;
    this.sendMessageToTeamEnabled = deps.request.sendMessageToTeamEnabled;
    this.head = { id: HEAD_AGENT_ID, name: team.head.name || "Team Leader" };
    this.semaphore = new Semaphore(deps.config.multiAgentMaxConcurrency);
    this.maxActivations = deps.config.multiAgentMaxActivations;
    this.allRegistryTools = deps.tools.names();
    this.headTools = computeHeadTools(this.allRegistryTools);
    this.memberTools = computeMemberTools(this.allRegistryTools, this.sendMessageToTeamEnabled);
    this.initAgents();
  }

  /** Build (or restore) each agent's state, loading persisted transcripts so context survives turns. */
  private initAgents(): void {
    const { request, config } = this.deps;
    const team = request.team;
    const workspace = config.workspaceRoot;

    const headState: TeamAgentState = {
      id: HEAD_AGENT_ID,
      name: this.head.name,
      role: "head",
      systemPrompt: buildHeadSystemPrompt(team, workspace),
      history: teamSessionStore.getMessages(request.chatId, HEAD_AGENT_ID),
      inbox: [],
      running: false,
      status: "idle",
      activations: 0,
      updatedAt: Date.now(),
    };
    this.agents.set(HEAD_AGENT_ID, headState);

    for (const member of team.members) {
      if (member.enabled === false || member.id.trim().length === 0) continue;
      this.agents.set(member.id, {
        id: member.id,
        name: member.id,
        role: "member",
        systemPrompt: buildMemberSystemPrompt(member, team, workspace, this.sendMessageToTeamEnabled),
        history: teamSessionStore.getMessages(request.chatId, member.id),
        inbox: [],
        running: false,
        status: "idle",
        activations: 0,
        updatedAt: Date.now(),
      });
    }
  }

  /** Run the turn to completion (quiescence or abort). */
  async run(): Promise<void> {
    this.emitTeamStart();

    // Deliver the user's message to the head and kick things off.
    this.deliver({
      from: "user",
      fromName: "User",
      to: HEAD_AGENT_ID,
      kind: "task",
      message: this.deps.request.userMessage,
      createdAt: Date.now(),
    });

    this.donePromise = new Promise<void>((resolve) => {
      this.resolveDone = resolve;
    });

    this.maybeSchedule(HEAD_AGENT_ID);

    // If nothing started (shouldn't happen), resolve immediately.
    if (this.pending === 0) return;
    await this.donePromise;
  }

  // ---------------------------------------------------------------- TeamRuntime (tool bridge)

  roster(): TeamRosterEntry[] {
    return Array.from(this.agents.values())
      .filter((a) => a.role === "member")
      .map((a) => this.toRosterEntry(a));
  }

  statusOf(ids: string[]): TeamRosterEntry[] {
    const out: TeamRosterEntry[] = [];
    for (const id of ids) {
      const agent = this.agents.get(id);
      if (agent) out.push(this.toRosterEntry(agent));
    }
    return out;
  }

  delegate(
    fromId: string,
    messages: Array<{ agent_id: string; message: string }>,
  ): { delivered: string[]; unknown: string[] } {
    return this.routeMessages(fromId, messages, "task");
  }

  messageLeader(fromId: string, myName: string, message: string): { ok: boolean } {
    const sender = this.agents.get(fromId);
    const fromName = myName.trim() || sender?.name || fromId;
    this.messagedLeader.add(fromId);
    this.deliver({
      from: fromId,
      fromName,
      to: HEAD_AGENT_ID,
      kind: "message",
      message,
      createdAt: Date.now(),
    });
    this.maybeSchedule(HEAD_AGENT_ID);
    return { ok: true };
  }

  messageTeam(
    fromId: string,
    recipients: Array<{ agent_id: string; message: string }>,
  ): { delivered: string[]; unknown: string[] } {
    return this.routeMessages(fromId, recipients, "message");
  }

  // ---------------------------------------------------------------- internals

  private routeMessages(
    fromId: string,
    messages: Array<{ agent_id: string; message: string }>,
    kind: "task" | "message",
  ): { delivered: string[]; unknown: string[] } {
    const sender = this.agents.get(fromId);
    const fromName = sender?.name ?? fromId;
    const delivered: string[] = [];
    const unknown: string[] = [];
    for (const entry of messages) {
      const to = entry.agent_id?.trim();
      const target = to ? this.agents.get(to) : undefined;
      if (!target || target.role !== "member") {
        if (to) unknown.push(to);
        continue;
      }
      this.deliver({
        from: fromId,
        fromName,
        to: target.id,
        kind,
        message: entry.message ?? "",
        createdAt: Date.now(),
      });
      delivered.push(target.id);
    }
    for (const id of delivered) this.maybeSchedule(id);
    return { delivered, unknown };
  }

  private deliver(message: TeamMessage): void {
    const target = this.agents.get(message.to);
    if (!target) return;
    target.inbox.push(message);
    if (!target.running && target.status !== "running") {
      target.status = "queued";
    }
    target.updatedAt = Date.now();
    this.deps.send("team_message", {
      from_id: message.from,
      from_name: message.fromName,
      to_id: message.to,
      to_name: target.name,
      kind: message.kind,
      message: message.message,
    });
    this.emitStatus();
  }

  private maybeSchedule(agentId: string): void {
    if (this.deps.signal.aborted) return;
    const agent = this.agents.get(agentId);
    if (!agent || agent.running || agent.inbox.length === 0) return;
    if (this.activationCount >= this.maxActivations) {
      if (!this.cappedNotified) {
        this.cappedNotified = true;
        this.deps.send("team_warning", {
          code: "activation_cap_reached",
          message:
            `The team reached its safety limit of ${this.maxActivations} activations for this turn ` +
            `and stopped scheduling new work to protect the app. Pending messages were not processed.`,
        });
      }
      return;
    }
    void this.startActivation(agent);
  }

  private async startActivation(agent: TeamAgentState): Promise<void> {
    this.pending += 1;
    this.activationCount += 1;
    agent.running = true;
    agent.status = "running";
    agent.activations += 1;
    const activationId = `${agent.id}::${agent.activations}`;

    // Drain the whole mailbox into one coalesced user turn (bursts collapse into a single activation).
    const drained = agent.inbox.splice(0, agent.inbox.length);
    const trigger = describeTrigger(drained);
    const combined = this.renderInbox(agent, drained);

    // First head message of the chat: prepend the persistent memory/knowledge context, like the
    // single agent does, so the leader starts already knowing its accumulated context.
    let userContent = combined;
    if (agent.history.length === 0) {
      const blocks = [
        this.deps.memoryRuntime.firstMessageContext().trim(),
        this.deps.knowledgeRuntime.firstMessageContext().trim(),
      ].filter((b) => b.length > 0);
      if (blocks.length > 0) userContent = `${blocks.join("\n\n")}\n\n${combined}`;
    }
    agent.history.push({ role: "user", content: userContent });

    if (agent.role === "member") this.messagedLeader.delete(agent.id);

    this.deps.send("team_agent_start", {
      id: activationId,
      agent_id: agent.id,
      role: agent.role,
      name: agent.name,
      trigger,
    });
    this.emitStatus();

    const toolCtx = this.buildToolCtx(agent);
    const stampedSend: Send = (event, data) => this.deps.send(event, { agent_id: agent.id, role: agent.role, name: agent.name, ...data });

    let result;
    try {
      result = await runTeamAgentLoop({
        provider: this.deps.provider,
        model: this.deps.request.model,
        apiKey: this.deps.request.apiKey,
        baseUrl: this.deps.request.baseUrl,
        temperature: this.deps.request.temperature,
        effort: this.deps.request.effort,
        tools: this.deps.tools,
        allowed: agent.role === "head" ? this.headTools : this.memberTools,
        toolSchemas: this.deps.tools.schemasFor(agent.role === "head" ? this.headTools : this.memberTools),
        toolCtx,
        systemPrompt: agent.systemPrompt,
        history: agent.history,
        send: stampedSend,
        activationId,
        signal: this.deps.signal,
        semaphore: this.semaphore,
      });
    } catch (error) {
      result = { ok: false, aborted: false, output: "", error: messageOf(error) };
    }

    // Persist the grown transcript so the agent remembers across activations + turns.
    teamSessionStore.setMessages(this.deps.request.chatId, agent.id, agent.history);

    agent.running = false;
    agent.status = result.aborted ? "idle" : result.ok ? "completed" : "failed";
    agent.updatedAt = Date.now();

    this.deps.send("team_agent_done", {
      id: activationId,
      agent_id: agent.id,
      role: agent.role,
      name: agent.name,
      ok: result.ok,
      aborted: result.aborted,
      output: result.output,
      error: result.error,
    });

    // Safety net: if a member finished its activation WITHOUT reporting to the leader (and it is not
    // an abort), auto-notify the leader so the head always gets closure and the turn can conclude.
    if (
      agent.role === "member" &&
      !result.aborted &&
      !this.messagedLeader.has(agent.id) &&
      !this.deps.signal.aborted
    ) {
      const note =
        result.ok
          ? result.output.trim().length > 0
            ? `I have finished my current work. Summary:\n\n${result.output.trim()}`
            : "I have finished my current work."
          : `I could not complete my work${result.error ? `: ${result.error}` : "."}`;
      this.deliver({
        from: agent.id,
        fromName: agent.name,
        to: HEAD_AGENT_ID,
        kind: "message",
        message: note,
        createdAt: Date.now(),
      });
      this.maybeSchedule(HEAD_AGENT_ID);
    }

    // Drain any messages that arrived while this agent was running (batch-processed next activation).
    this.maybeSchedule(agent.id);

    this.pending -= 1;
    this.emitStatus();
    if (this.pending === 0) this.finish();
  }

  private finish(): void {
    if (this.resolveDone) {
      const resolve = this.resolveDone;
      this.resolveDone = null;
      resolve();
    }
  }

  /** Build the tool-execution context for an agent (team bridge + all shared runtimes). */
  private buildToolCtx(agent: TeamAgentState): ToolContext {
    const { config, web, memoryRuntime, knowledgeRuntime, skillRuntime, todoRuntime, subAgentRuntime } =
      this.deps;
    return {
      workspaceRoot: config.workspaceRoot,
      chatId: this.deps.request.chatId,
      shellTimeoutMs: config.shellTimeoutMs,
      signal: this.deps.signal,
      web,
      memory: memoryRuntime,
      knowledge: knowledgeRuntime,
      skills: skillRuntime,
      todos: todoRuntime,
      subAgents: subAgentRuntime,
      // Human-in-the-loop runtimes only matter to the head (only it holds those tools).
      planApprovals: agent.role === "head" ? this.deps.planApprovals : undefined,
      planApprovalTimeoutMs: config.planApprovalTimeoutMs,
      askQuestions: agent.role === "head" ? this.deps.askQuestions : undefined,
      questionTimeoutMs: config.questionTimeoutMs,
      model: this.deps.request.model,
      visionCapable: isVisionCapableModel(this.deps.request.model, config),
      availableToolNames: this.allRegistryTools,
      emit: this.deps.send,
      // Team bridge:
      team: this,
      teamSelfId: agent.id,
      teamSelfRole: agent.role,
    };
  }

  private renderInbox(agent: TeamAgentState, messages: TeamMessage[]): string {
    return messages
      .map((m) => {
        const senderLabel =
          m.from === "user"
            ? "the User"
            : m.from === HEAD_AGENT_ID
              ? `${m.fromName} (team leader)`
              : `${m.fromName} (team member)`;
        let body = `Message from ${senderLabel}:\n${m.message}`;
        if (agent.role === "member" && m.from === HEAD_AGENT_ID && m.kind === "task") {
          body +=
            `\n\n(This task was assigned to you by your team leader "${this.head.name}". Complete it ` +
            `autonomously using your tools, then call message_team_leader to report your results — or ` +
            `to ask a question if you get blocked. Your report is the deliverable.)`;
        }
        return body;
      })
      .join("\n\n---\n\n");
  }

  private toRosterEntry(agent: TeamAgentState): TeamRosterEntry {
    const team = this.deps.request.team;
    const def = team.members.find((m) => m.id === agent.id);
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.role === "head" ? "Team leader" : def?.description ?? "",
      status: agent.status,
      queued: agent.inbox.length,
    };
  }

  private emitTeamStart(): void {
    this.deps.send("team_start", {
      team_id: this.deps.request.team.id,
      team_name: this.deps.request.team.name,
      head: { id: HEAD_AGENT_ID, name: this.head.name },
      members: this.roster().map((m) => ({ id: m.id, name: m.name, description: m.description })),
      send_message_to_team_enabled: this.sendMessageToTeamEnabled,
    });
  }

  private emitStatus(): void {
    this.deps.send("team_status", {
      team_agents: Array.from(this.agents.values()).map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        queued: a.inbox.length,
      })),
      pending: this.pending,
      activations: this.activationCount,
    });
  }
}

/** A short human-facing description of what triggered an activation (for the UI block header). */
function describeTrigger(messages: TeamMessage[]): string {
  if (messages.length === 0) return "";
  const first = messages[0]!;
  if (first.from === "user") return "user request";
  if (messages.length === 1) return `message from ${first.fromName}`;
  const senders = Array.from(new Set(messages.map((m) => m.fromName)));
  return `${messages.length} messages from ${senders.join(", ")}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Re-export the message type used by the transcript persister. */
export type { StoredMessage };
