import { ToolRegistry } from "./registry.js";
import { fileReadTool } from "./fileRead.js";
import { fileWriteTool } from "./fileWrite.js";
import { fileListTool } from "./fileList.js";
import { strReplaceTool } from "./strReplace.js";
import { shellTool } from "./shell.js";
import { webSearchTool } from "./webSearch.js";
import { fetchWebUrlsTool } from "./fetchWebUrls.js";

export { ToolRegistry } from "./registry.js";
export type { Tool, ToolContext, ToolResult, WebToolsConfig, SearchProvider } from "./types.js";
export { defineTool } from "./types.js";
export { webSearchTool, SEARCH_PROVIDERS } from "./webSearch.js";
export { fetchWebUrlsTool } from "./fetchWebUrls.js";

/** Build the default registry with the agent's seven tools registered. */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry().registerAll([
    fileReadTool,
    fileWriteTool,
    fileListTool,
    strReplaceTool,
    shellTool,
    webSearchTool,
    fetchWebUrlsTool,
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
};
