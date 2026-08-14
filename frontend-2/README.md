# frontend-2 — Curro AI chat interface

A professional, dark-themed, fully responsive chat UI for the **curro-ai** agent, built with
**Next.js 16 (App Router)**, React 19, **zustand**, and Tailwind CSS v4.

## Layout

- **Left** — chat UI with a collapsible chat-history sidebar.
- **Center** — the conversation: user messages in bubbles, AI responses without bubbles, minimal
  tool-activity chips (`Create: path`, `Read: path`, `Edit: path`, `List: path`, `Terminal: …`),
  and a shiny animated **Thinking…** indicator plus a streaming caret.
- **Right** — a tree-based file explorer of the agent workspace that refreshes in real time (it
  polls while the agent runs, refreshes after each tool result, and has a manual refresh button).
  Click any file to preview its contents.
- **Top** — a Settings popup for adding provider API keys and choosing a model.

## Real-time streaming

Tokens stream over SSE and render token-by-token. Reasoning, tool calls and tool results interrupt
the text stream and resume afterwards, exactly as the agent emits them — no mock-ups.

## Proxy

The browser only ever calls this app's own **App Router `/api/*`** route handlers, which proxy to the
curro-ai backend (`CURRO_API_URL`, default `http://localhost:8787`). This avoids browser/localhost
issues and keeps the SSE stream flowing through the server.

## Structure

```
frontend-2/
└── src/
    ├── app/            # layout, page, globals.css, api/ route handlers (proxy)
    ├── components/     # Sidebar, TopBar, ChatPanel, MessageList/Item, Composer,
    │                   # FileExplorer, SettingsModal, ToolChip, ThinkingIndicator
    ├── hooks/          # useChatStream (SSE client)
    ├── lib/            # api client + server proxy helpers
    ├── store/          # zustand store (conversations, settings, UI) with localStorage persistence
    ├── types/          # shared types
    └── utils/          # cn, id helpers
```

## Run

```bash
cd frontend-2
cp .env.example .env      # optional; defaults to http://localhost:8787
npm install
npm run dev               # http://localhost:3001
```

Make sure the curro-ai backend is running first (`cd ../curro-ai && npm run dev`).

Then open Settings (top-right), choose a provider (OpenRouter / Groq / NVIDIA), paste your API key,
click **Load** to fetch models, pick one, and start chatting.
