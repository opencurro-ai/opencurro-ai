import type { TeamDefinition, TeamMemberDefinition } from "./types.js";

/**
 * Defensively coerce the client-provided team payload into a safe, well-typed TeamDefinition. Returns
 * null when the payload cannot form a usable team (no name, no head prompt, or no enabled members) —
 * the chat API then falls back to the single-agent path rather than starting a broken team turn.
 */
export function normalizeTeam(raw: unknown): TeamDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;

  const id = typeof rec.id === "string" && rec.id.trim().length > 0 ? rec.id.trim() : "team";
  const name = typeof rec.name === "string" && rec.name.trim().length > 0 ? rec.name.trim() : "Agent team";

  const headRaw = (rec.head ?? {}) as Record<string, unknown>;
  const headName = typeof headRaw.name === "string" ? headRaw.name.trim() : "";
  const headPrompt =
    typeof headRaw.system_prompt === "string"
      ? headRaw.system_prompt
      : typeof headRaw.systemPrompt === "string"
        ? (headRaw.systemPrompt as string)
        : "";

  const membersRaw = Array.isArray(rec.members) ? rec.members : [];
  const members: TeamMemberDefinition[] = [];
  const seen = new Set<string>();
  for (const item of membersRaw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const memberId = typeof m.id === "string" ? m.id.trim() : typeof m.name === "string" ? m.name.trim() : "";
    if (!memberId) continue;
    const key = memberId.toLowerCase();
    if (seen.has(key) || key === "head" || key === "user") continue; // reserved / duplicate ids
    seen.add(key);
    const systemPrompt =
      typeof m.system_prompt === "string"
        ? m.system_prompt
        : typeof m.systemPrompt === "string"
          ? (m.systemPrompt as string)
          : "";
    members.push({
      id: memberId,
      description: typeof m.description === "string" ? m.description : "",
      system_prompt: systemPrompt,
      enabled: m.enabled !== false,
    });
  }

  const enabledMembers = members.filter((m) => m.enabled !== false);
  if (enabledMembers.length === 0) return null;

  return {
    id,
    name,
    head: { name: headName || "Team Leader", system_prompt: headPrompt },
    members,
    enabled: rec.enabled !== false,
  };
}
