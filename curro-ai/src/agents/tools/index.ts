import { ToolRegistry } from "./registry.js";
import { fileReadTool } from "./fileRead.js";
import { fileWriteTool } from "./fileWrite.js";
import { fileListTool } from "./fileList.js";
import { strReplaceTool } from "./strReplace.js";
import { applyMultipleEditsTool } from "./applyMultipleEdits.js";
import { shellTool } from "./shell.js";
import { shellViewTool } from "./shellView.js";
import { bashWriteToProcessTool } from "./bashWriteToProcess.js";
import { webSearchTool } from "./webSearch.js";
import { imageSearchTool } from "./imagesearch.js";
import { fetchWebUrlsTool } from "./fetchWebUrls.js";
import { readImageTool } from "./readImage.js";
import { callSubAgentTool } from "./call_sub_agent.js";
import { listSubAgentsTool } from "./list_sub_agents.js";
import { listSkillsTool } from "./list_skills.js";
import { skillInitializeTool } from "./skill_initialize.js";
import { submitPlanTool } from "./submit_plan.js";
import { askUserTool } from "./askuser.js";
import { buildSubAgentTool } from "./buildsubagent.js";
import { createSkillTool } from "./createskill.js";
import { todoWriteTool } from "./todowrite.js";
import { readTodosTool } from "./todoread.js";

export { ToolRegistry } from "./registry.js";
export type {
  Tool,
  ToolContext,
  ToolResult,
  WebToolsConfig,
  SearchProvider,
  SubAgentDefinition,
  SubAgentRuntime,
  SkillDefinition,
  SkillFileDefinition,
  SkillRuntime,
  TodoItem,
  TodoRuntime,
} from "./types.js";
export { defineTool } from "./types.js";
export { webSearchTool, SEARCH_PROVIDERS } from "./webSearch.js";
export {
  imageSearchTool,
  IMAGE_SEARCH_PROVIDERS,
  IMAGE_SEARCH_PROVIDER_TAVILY,
  IMAGE_SEARCH_PROVIDER_EXA,
  IMAGE_SEARCH_PROVIDER_SERPAPI,
} from "./imagesearch.js";
export { fetchWebUrlsTool } from "./fetchWebUrls.js";
export { applyMultipleEditsTool } from "./applyMultipleEdits.js";
export { readImageTool, SUPPORTED_IMAGE_EXTENSIONS } from "./readImage.js";
export { callSubAgentTool } from "./call_sub_agent.js";
export { listSubAgentsTool } from "./list_sub_agents.js";
export { listSkillsTool } from "./list_skills.js";
export { skillInitializeTool } from "./skill_initialize.js";
export { buildSubAgentTool } from "./buildsubagent.js";
export { createSkillTool } from "./createskill.js";
export { todoWriteTool } from "./todowrite.js";
export { readTodosTool } from "./todoread.js";
export { submitPlanTool } from "./submit_plan.js";
export { askUserTool, ASK_ANSWERED, ASK_TIMEOUT } from "./askuser.js";
export { shellViewTool } from "./shellView.js";
export { bashWriteToProcessTool } from "./bashWriteToProcess.js";
export {
  shellSessionStore,
  ShellSessionStore,
  MAX_SESSION_BUFFER_CHARS,
} from "./shellSessions.js";
export type { ShellSessionSnapshot, ShellSessionStatus } from "./shellSessions.js";
export type { ProcessWriteResult } from "./shellSessions.js";

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
    bashWriteToProcessTool,
    webSearchTool,
    imageSearchTool,
    fetchWebUrlsTool,
    readImageTool,
    callSubAgentTool,
    listSubAgentsTool,
    listSkillsTool,
    skillInitializeTool,
    submitPlanTool,
    askUserTool,
    buildSubAgentTool,
    createSkillTool,
    todoWriteTool,
    readTodosTool,
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
  bashWriteToProcessTool,
  webSearchTool,
  imageSearchTool,
  fetchWebUrlsTool,
  readImageTool,
  callSubAgentTool,
  listSubAgentsTool,
  listSkillsTool,
  skillInitializeTool,
  submitPlanTool,
  askUserTool,
  buildSubAgentTool,
  createSkillTool,
  todoWriteTool,
  readTodosTool,
};
