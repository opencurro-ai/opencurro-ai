import { ToolRegistry } from "./registry.js";
import { fileReadTool } from "./fileRead.js";
import { fileWriteTool } from "./fileWrite.js";
import { fileListTool } from "./fileList.js";
import { strReplaceTool } from "./strReplace.js";
import { applyMultipleEditsTool } from "./applyMultipleEdits.js";
import { shellTool } from "./shell.js";
import { shellViewTool } from "./shellView.js";
import { webSearchTool } from "./webSearch.js";
import { fetchWebUrlsTool } from "./fetchWebUrls.js";
import { readImageTool } from "./readImage.js";
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
export { applyMultipleEditsTool } from "./applyMultipleEdits.js";
export { readImageTool, SUPPORTED_IMAGE_EXTENSIONS } from "./readImage.js";
export { callSubAgentTool } from "./call_sub_agent.js";
export { listSubAgentsTool } from "./list_sub_agents.js";
export { shellViewTool } from "./shellView.js";
export {
  shellSessionStore,
  ShellSessionStore,
  MAX_SESSION_BUFFER_CHARS,
} from "./shellSessions.js";
export type { ShellSessionSnapshot, ShellSessionStatus } from "./shellSessions.js";

/** Build the default registry with the agent's file/web/shell tools plus the sub-agent tools. */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry().registerAll([
    fileReadTool,
    fileWriteTool,
    fileListTool,
    strReplaceTool,
    applyMultipleEditsTool,
    shellTool,
    shellViewTool,
    webSearchTool,
    fetchWebUrlsTool,
    readImageTool,
    callSubAgentTool,
    listSubAgentsTool,
  ]);
}

export const tools = {
  fileReadTool,
  fileWriteTool,
  fileListTool,
  strReplaceTool,
  applyMultipleEditsTool,
  shellTool,
  shellViewTool,
  webSearchTool,
  fetchWebUrlsTool,
  readImageTool,
  callSubAgentTool,
  listSubAgentsTool,
};
