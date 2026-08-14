import { OpenAICompatibleProvider } from "./base.js";

export const opencodeZenProvider = new OpenAICompatibleProvider({
  id: "opencode_zen",
  label: "OpenCode Zen",
  defaultBaseUrl: "https://opencode.ai/zen/v1",
});
