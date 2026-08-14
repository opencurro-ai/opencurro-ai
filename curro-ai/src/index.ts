import express from "express";
import cors from "cors";
import { config, ensureWorkspace } from "./config.js";
import { createProviderRegistry } from "./agents/providers/registry.js";
import { createToolRegistry } from "./agents/tools/index.js";
import { AgentRunner } from "./agents/agent.js";
import { SessionStore } from "./services/sessionStore.js";
import { buildChatRouter } from "./api/chat.js";
import { buildProviderRouter } from "./api/providers.js";
import { buildFilesRouter } from "./api/files.js";

function main(): void {
  ensureWorkspace();

  const providers = createProviderRegistry();
  const tools = createToolRegistry();
  const store = new SessionStore();
  const agent = new AgentRunner(providers, tools, config);

  const app = express();
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? true : config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "25mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "curro-ai",
      workspace: config.workspaceRoot,
      providers: providers.list().map((p) => p.id),
      tools: tools.schemas.map((s) => s.function.name),
      max_iterations: config.maxIterations,
    });
  });

  app.use("/api/providers", buildProviderRouter(providers));
  app.use("/api/chat", buildChatRouter(agent, store, config));
  app.use("/api/files", buildFilesRouter(config));

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[curro-ai] listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`[curro-ai] workspace: ${config.workspaceRoot}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
