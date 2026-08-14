import { proxyJson } from "@/lib/proxy";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await params;
  return proxyJson(`/api/chat/abort/${encodeURIComponent(chatId)}`, { method: "POST" });
}
