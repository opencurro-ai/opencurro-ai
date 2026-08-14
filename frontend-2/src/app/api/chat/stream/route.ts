import { backendUrl } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy the chat stream to the backend and pipe the SSE body straight through to the browser.
export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  try {
    const upstream = await fetch(backendUrl("/api/chat/stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      // @ts-expect-error - duplex is required by Node fetch for streaming request bodies
      duplex: "half",
    });

    if (!upstream.body) {
      const text = await upstream.text();
      return new Response(text, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return Response.json(
      { error: `Cannot reach curro-ai backend: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    );
  }
}
