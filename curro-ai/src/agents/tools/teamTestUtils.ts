import type { TeamRosterEntry, TeamRuntime, ToolContext } from "./types.js";

/**
 * Test-only helpers for the multi-agent team tools. A lightweight in-memory TeamRuntime records the
 * messages/queries routed through it so tests can assert on delivery without spinning up the real
 * orchestrator or a provider.
 */
export interface RecordedDelegate {
  fromId: string;
  messages: Array<{ agent_id: string; message: string }>;
}
export interface RecordedLeaderMessage {
  fromId: string;
  myName: string;
  message: string;
}
export interface RecordedTeamMessage {
  fromId: string;
  recipients: Array<{ agent_id: string; message: string }>;
}

export interface FakeTeam extends TeamRuntime {
  readonly delegations: RecordedDelegate[];
  readonly leaderMessages: RecordedLeaderMessage[];
  readonly teamMessages: RecordedTeamMessage[];
}

export function makeFakeTeam(
  members: TeamRosterEntry[],
  options?: { sendMessageToTeamEnabled?: boolean; head?: { id: string; name: string } },
): FakeTeam {
  const delegations: RecordedDelegate[] = [];
  const leaderMessages: RecordedLeaderMessage[] = [];
  const teamMessages: RecordedTeamMessage[] = [];
  const known = new Set(members.map((m) => m.id));
  const split = (entries: Array<{ agent_id: string; message: string }>) => {
    const delivered: string[] = [];
    const unknown: string[] = [];
    for (const e of entries) (known.has(e.agent_id) ? delivered : unknown).push(e.agent_id);
    return { delivered, unknown };
  };

  return {
    sendMessageToTeamEnabled: options?.sendMessageToTeamEnabled ?? true,
    head: options?.head ?? { id: "head", name: "Leader" },
    delegations,
    leaderMessages,
    teamMessages,
    roster: () => members.map((m) => ({ ...m })),
    statusOf: (ids) => members.filter((m) => ids.includes(m.id)).map((m) => ({ ...m })),
    delegate: (fromId, messages) => {
      delegations.push({ fromId, messages });
      return split(messages);
    },
    messageLeader: (fromId, myName, message) => {
      leaderMessages.push({ fromId, myName, message });
      return { ok: true };
    },
    messageTeam: (fromId, recipients) => {
      teamMessages.push({ fromId, recipients });
      return split(recipients);
    },
  };
}

export function member(id: string, description = ""): TeamRosterEntry {
  return { id, name: id, role: "member", description, status: "idle", queued: 0 };
}

export function ctxFor(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspaceRoot: "/tmp", shellTimeoutMs: 10_000, ...overrides };
}
