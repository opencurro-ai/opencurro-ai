import { proxyJson } from "@/lib/proxy";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  return proxyJson("/api/providers/models", { method: "POST", body });
}
