/**
 * Catalog of tools a sub-agent can be granted, mirroring the tools registered in the
 * curro-ai backend (src/agents/tools). The sub-agent meta tools (call_sub_agent /
 * list_sub_agents) are intentionally excluded to prevent recursive delegation.
 */
export interface SubAgentToolMeta {
  name: string;
  label: string;
  description: string;
}

export const SUB_AGENT_TOOLS: readonly SubAgentToolMeta[] = [
  {
    name: "file_read",
    label: "Read file",
    description:
      "Read a file from the local filesystem. file_path must be an absolute path; use offset/limit to read sections of large files.",
  },
  {
    name: "file_write",
    label: "Write file",
    description: "Create a new file or fully overwrite an existing one.",
  },
  {
    name: "file_list",
    label: "List files",
    description: "List files and directories inside a workspace directory.",
  },
  {
    name: "str_replace",
    label: "Edit file",
    description: "Exact string replacement inside an existing file.",
  },
  {
    name: "shall_tool",
    label: "Terminal",
    description: "Run a shell command from the workspace directory.",
  },
  {
    name: "web_search",
    label: "Web search",
    description: "Search the web for up-to-date information.",
  },
  {
    name: "fatch_web_urls",
    label: "Fetch URL",
    description: "Fetch and extract clean content from a single URL.",
  },
  {
    name: "read_image",
    label: "Read image",
    description:
      "Read an image from the local workspace or a live hosted image URL and visually analyze it. Requires a vision-capable model.",
  },
] as const;

export const SUB_AGENT_TOOL_NAMES: readonly string[] = SUB_AGENT_TOOLS.map((t) => t.name);

const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  SUB_AGENT_TOOLS.map((t) => [t.name, t.label]),
);

/** Human-friendly label for a tool name, falling back to the raw name. */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
