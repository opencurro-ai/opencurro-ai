import { ToolRegistry } from "./registry.js";
import { fileReadTool } from "./fileRead.js";
import { fileWriteTool } from "./fileWrite.js";
import { fileListTool } from "./fileList.js";
import { strReplaceTool } from "./strReplace.js";
import { shellTool } from "./shell.js";

export { ToolRegistry } from "./registry.js";
export type { Tool, ToolContext, ToolResult } from "./types.js";
export { defineTool } from "./types.js";

/** Build the default registry with the agent's five tools registered. */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry().registerAll([
    fileReadTool,
    fileWriteTool,
    fileListTool,
    strReplaceTool,
    shellTool,
  ]);
}

export const tools = {
  fileReadTool,
  fileWriteTool,
  fileListTool,
  strReplaceTool,
  shellTool,
};
