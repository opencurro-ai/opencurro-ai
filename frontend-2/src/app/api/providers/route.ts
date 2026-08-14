import { proxyJson } from "@/lib/proxy";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return proxyJson("/api/providers");
}
