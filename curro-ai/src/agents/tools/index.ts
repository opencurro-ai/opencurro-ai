import { ToolRegistry } from "./registry.js";
import { fileReadTool } from "./fileRead.js";
import { fileWriteTool } from "./fileWrite.js";
import { fileListTool } from "./fileList.js";
import { strReplaceTool } from "./strReplace.js";
import { shellTool } from "./shell.js";
import { webSearchTool } from "./webSearch.js";
import { fetchWebUrlsTool } from "./fetchWebUrls.js";
import { callSubAgentTool } from "./call_sub_agent.js";
import { listSubAgentsTool } from "./list_sub_agents.js";

export { ToolRegistry } from "./registry.js";
export type {
  Tool,
  ToolContext,
  ToolResult,
  WebToolsConfig,
  SearchProvider,
  SubAgentDefinition,
  SubAgentRuntime,
} from "./types.js";
export { defineTool } from "./types.js";
export { webSearchTool, SEARCH_PROVIDERS } from "./webSearch.js";
export { fetchWebUrlsTool } from "./fetchWebUrls.js";
export { callSubAgentTool } from "./call_sub_agent.js";
export { listSubAgentsTool } from "./list_sub_agents.js";

/** Build the default registry with the agent's file/web/shell tools plus the sub-agent tools. */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry().registerAll([
    fileReadTool,
    fileWriteTool,
    fileListTool,
    strReplaceTool,
    shellTool,
    webSearchTool,
    fetchWebUrlsTool,
    callSubAgentTool,
    listSubAgentsTool,
  ]);
}

export const tools = {
  fileReadTool,
  fileWriteTool,
  fileListTool,
  strReplaceTool,
  shellTool,
  webSearchTool,
  fetchWebUrlsTool,
  callSubAgentTool,
  listSubAgentsTool,
};
