import { OpenAICompatibleProvider } from "./base.js";

export const openRouterProvider = new OpenAICompatibleProvider({
  id: "openrouter",
  label: "OpenRouter",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  extraHeaders: {
    "X-Title": "Curro AI",
    "HTTP-Referer": "https://curro.ai",
  },
});
