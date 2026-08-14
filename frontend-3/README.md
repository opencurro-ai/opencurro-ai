# frontend-3 — Curro AI chat interface (React 19 + Vite)

A professional, dark-themed, fully responsive chat UI for the **curro-ai** agent, rebuilt from
`frontend-2` (Next.js) as a fast, streaming-focused **React 19 + Vite** single-page app. Built with
React **19.2.8**, **Vite**, **Tailwind CSS v4**, **zustand**, and **lucide-react**.

## Layout

- **Left** — chat UI with a collapsible chat-history sidebar (persisted in localStorage via zustand).
- **Center** — the conversation: user messages in bubbles, AI responses without bubbles, minimal
  tool-activity chips (`Create: path`, `Read: path`, `List: path`, `Edit: path`, `Terminal: …`),
  and a shiny animated **Thinking…** indicator plus a streaming caret.
- **Right** — a tree-based file explorer of the agent workspace that updates in real time (polls
  while the agent runs, refreshes after each tool result, and has a manual refresh button).
  Click any file to preview its contents.
- **Top** — a Settings popup for adding provider API keys and choosing a model.

## Real-time streaming

Tokens stream over SSE and render token-by-token. Reasoning, tool calls and tool results interrupt
the text stream and resume afterwards, exactly as the agent emits them — no mock-ups.

## API routes & proxy

- Every backend call goes to this app's own **same-origin `/api/*` routes**, defined as a typed
  registry in `src/app/api/routes.ts` (the Vite/React equivalent of the Next.js App Router
  `src/app/api/<route>/route.ts` handlers used by `frontend-2`).
- `vite.config.ts` configures a dev/preview **proxy**: `/api` → `http://localhost:8787` (the
  curro-ai backend), with `changeOrigin: true`. The browser never talks to `localhost` directly —
  the proxy resolves the backend server-side, which is required when the UI is opened via a proxy
  URL instead of on the same machine as the agent.

```
frontend-3/
├── vite.config.ts          # react + tailwind plugins, @ alias, /api proxy → curro-ai
└── src/
    ├── app/                # main.tsx, App.tsx, globals.css, api/ (route registry)
    ├── components/         # Sidebar, TopBar, ChatPanel, MessageList/Item, Composer,
    │                       # FileExplorer, SettingsModal, ToolChip, ThinkingIndicator
    ├── hooks/              # useChatStream (SSE consumer)
    ├── lib/                # api client (talks to /api/* routes)
    ├── store/              # zustand store (conversations, settings, UI) with persistence
    ├── types/              # shared types
    └── utils/              # cn, id helpers
```

## Run

```bash
cd frontend-3
npm install
npm run dev        # http://localhost:5173
```

Make sure the curro-ai backend is running first (`cd ../curro-ai && npm run dev` → port 8787).

Then open Settings (top-right), choose a provider (OpenRouter / Groq / NVIDIA), paste your API key,
click **Load** to fetch models, pick one, and start chatting.

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Vite dev server (port 5173)          |
| `npm run build`    | `tsc -b` type check + `vite build`   |
| `npm run typecheck`| TypeScript check only                |
| `npm run preview`  | Serve the production build (port 4173) |
