import type { ModelInfo, ProviderMeta } from "@/types";

export async function fetchProviders(): Promise<ProviderMeta[]> {
  const res = await fetch("/api/providers", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load providers (${res.status})`);
  return res.json();
}

export async function fetchModels(
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<ModelInfo[]> {
  const res = await fetch("/api/providers/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl || undefined }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to load models (${res.status})`);
  return data.models ?? [];
}

export async function fetchFileTree(): Promise<import("@/types").FileNode[]> {
  const res = await fetch("/api/files/tree", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load file tree (${res.status})`);
  const data = await res.json();
  return data.tree ?? [];
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to read file (${res.status})`);
  return data.content ?? "";
}

export async function abortChat(chatId: string): Promise<void> {
  await fetch(`/api/chat/abort/${encodeURIComponent(chatId)}`, { method: "POST" }).catch(() => {});
}
