import { proxyJson } from "@/lib/proxy";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "";
  return proxyJson(`/api/files/read?path=${encodeURIComponent(path)}`);
}
