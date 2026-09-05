import type { TeamDefinition, TeamMemberDefinition } from "./types.js";

/** Read a trimmed string field, tolerating both snake_case and camelCase keys. */
function pickString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (typeof v === "string") return v;
  }
  return "";
}

/**
 * Defensively coerce the client-provided team payload into a safe, well-typed TeamDefinition.
 * Returns undefined when there is no usable team (no leader name / no id). Mirrors the codebase's
 * normalizeSubAgents / normalizeSkills approach so untrusted input can never crash the runtime.
 */
export function normalizeTeam(raw: unknown): TeamDefinition | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;

  const id = pickString(record, "id").trim();
  const name = pickString(record, "name").trim();

  const leaderRaw =
    record.leader && typeof record.leader === "object"
      ? (record.leader as Record<string, unknown>)
      : {};
  const leaderName = pickString(leaderRaw, "name").trim();
  const leaderPrompt = pickString(leaderRaw, "system_prompt", "systemPrompt");

  if (!leaderName) return undefined;

  const membersRaw = Array.isArray(record.members) ? record.members : [];
  const members: TeamMemberDefinition[] = [];
  const seen = new Set<string>();
  for (const item of membersRaw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const memberName = pickString(m, "name").trim();
    if (!memberName) continue;
    const key = memberName.toLowerCase();
    if (seen.has(key) || key === leaderName.toLowerCase()) continue; // no dupes, no clash with leader
    seen.add(key);
    members.push({
      name: memberName,
      description: pickString(m, "description"),
      system_prompt: pickString(m, "system_prompt", "systemPrompt"),
      enabled: m.enabled !== false,
    });
  }

  return {
    id: id || `team-${leaderName.toLowerCase()}`,
    name: name || "Agent team",
    enabled: record.enabled !== false,
    leader: { name: leaderName, system_prompt: leaderPrompt },
    members,
  };
}
