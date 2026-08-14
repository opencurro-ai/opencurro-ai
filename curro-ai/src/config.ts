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
}

function parseCorsOrigins(raw: string | undefined): string[] | "*" {
  if (!raw || raw.trim() === "*" || raw.trim() === "") return "*";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 8787),
  workspaceRoot: resolveWorkspaceRoot(),
  maxIterations: Number(process.env.MAX_ITERATIONS ?? 1000),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  shellTimeoutMs: Number(process.env.SHELL_TIMEOUT_MS ?? 180_000),
};

/** Ensure the workspace directory exists so file tools never hit permission/ENOENT errors. */
export function ensureWorkspace(): void {
  fs.mkdirSync(config.workspaceRoot, { recursive: true });
}
