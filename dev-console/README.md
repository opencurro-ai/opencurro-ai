# dev-console — Curro AI developer console (React 19 + Vite)

A dark-themed, developer-focused **observability console** for the **curro-ai** agent, built with
React **19.2.8**, **Vite**, **Tailwind CSS v4**, **zustand**, and **lucide-react**.

Unlike a normal chat UI, this app is built for **watching the agent work**: every SSE event the
agent emits, every `/api/*` request the app makes, every tool's raw arguments and raw result, and a
live "what is the LLM doing right now" indicator are all streamed into a dedicated console.

## Layout

- **Left — Dev Console.** The centerpiece. A live, filterable stream of:
  - **Events** — every agent SSE event (`iteration`, `status`, `reasoning`, `token`, `tool_call`,
    `tool_result`, `sub_agent_*`, `plan_review`, `ask_question`, `embed_url`, `done`, `error`, …)
    with its full raw payload and backend `_event_id`.
  - **Network** — every HTTP request the app makes (method, path, status, round-trip time, and the
    raw request body), captured by a global `fetch` interceptor. The SSE chat stream is flagged and
    its body is never consumed.
  - **System** — turn start/stop and abort notices.
  - A top **LLM activity** card shows the current phase (thinking / reasoning / responding / tool /
    sub-agent / waiting / done) with iteration progress, and an **Observing URL** card surfaces the
    latest `embed_url` target.
- **Center** — the conversation used to drive the agent. Each tool renders its specialized,
  human-readable block **plus a universal raw inspector** (raw arguments + raw result JSON, tool id,
  and status) so nothing about a tool call is hidden.
- **Right** — a live tree-based file explorer of the agent workspace.
- **Top** — a Settings popup for provider API keys and model selection, plus a toggle for the console.

## Ephemeral session, persistent keys

This is a developer console, so each page load starts clean: **conversations, todos, memory,
knowledge, sub-agents, skills, and the event log are all in-memory only** and are wiped on refresh.
The **only** thing persisted to `localStorage` is your credentials — provider API keys, search/fetch
keys, and custom providers (see `partialize` in `src/store/useStore.ts`).

## API routes & proxy

- Every backend call goes to this app's own **same-origin `/api/*` routes**, defined as a typed
  registry in `src/app/api/routes.ts`.
- `vite.config.ts` configures a dev/preview **proxy**: `/api` → `http://localhost:8787` (the
  curro-ai backend), with `changeOrigin: true`, so streaming (SSE) and CORS keep working through a
  proxy URL.

```
dev-console/
├── vite.config.ts          # react + tailwind plugins, @ alias, /api proxy → curro-ai
└── src/
    ├── app/                # main.tsx (installs the fetch logger), App.tsx, globals.css, api/
    ├── components/         # DevConsole, TopBar, ChatPanel, MessageList/Item, Composer,
    │                       # FileExplorer, SettingsModal, ToolChip (+ RawToolData), …
    ├── hooks/              # useChatStream (SSE consumer → feeds the dev console)
    ├── lib/                # api client + devlog (fetch instrumentation)
    ├── store/              # zustand store (ephemeral session + persisted API keys, devLog, activity)
    ├── types/              # shared types (incl. DevLogEntry, AgentActivity)
    └── utils/              # cn, id helpers
```

## Run

```bash
cd dev-console
npm install
npm run dev        # http://localhost:5173
```

Make sure the curro-ai backend is running first (`cd ../curro-ai && npm run dev` → port 8787).

Then open Settings (top-right), choose a provider, paste your API key, load models, pick one, and
send a task — then watch the Dev Console on the left.

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Vite dev server (port 5173)          |
| `npm run build`    | `tsc -b` type check + `vite build`   |
| `npm run typecheck`| TypeScript check only                |
| `npm run preview`  | Serve the production build (port 4173) |
