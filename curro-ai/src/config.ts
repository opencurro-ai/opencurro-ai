import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Root of the curro-ai package (one level above src/). */
export const PROJECT_ROOT = path.resolve(currentDir, "..");

function resolveWorkspaceRoot(): string {
  const configured = process.env.WORKSPACE_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.resolve(PROJECT_ROOT, configured);
  }
  return path.join(PROJECT_ROOT, "workspace");
}

export interface AppConfig {
  port: number;
  workspaceRoot: string;
  maxIterations: number;
  corsOrigins: string[] | "*";
  shellTimeoutMs: number;
  /** Fallback web tool keys/provider, overridden per-request by the frontend settings. */
  searchProvider: "tavily" | "exa" | "serpapi";
  tavilyApiKey: string;
  exaApiKey: string;
  serpapiApiKey: string;
  firecrawlApiKey: string;
}

function parseCorsOrigins(raw: string | undefined): string[] | "*" {
  if (!raw || raw.trim() === "*" || raw.trim() === "") return "*";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function parseSearchProvider(raw: string | undefined): "tavily" | "exa" | "serpapi" {
  const value = raw?.trim().toLowerCase();
  if (value === "exa" || value === "serpapi") return value;
  return "tavily";
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 8787),
  workspaceRoot: resolveWorkspaceRoot(),
  maxIterations: Number(process.env.MAX_ITERATIONS ?? 1000),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  shellTimeoutMs: Number(process.env.SHELL_TIMEOUT_MS ?? 180_000),
  searchProvider: parseSearchProvider(process.env.SEARCH_PROVIDER),
  tavilyApiKey: process.env.TAVILY_API_KEY?.trim() ?? "",
  exaApiKey: process.env.EXA_API_KEY?.trim() ?? "",
  serpapiApiKey: process.env.SERPAPI_API_KEY?.trim() ?? "",
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY?.trim() ?? "",
};

/** Ensure the workspace directory exists so file tools never hit permission/ENOENT errors. */
export function ensureWorkspace(): void {
  fs.mkdirSync(config.workspaceRoot, { recursive: true });
}
