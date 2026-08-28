# Haku (frontend-main) — Design & Architecture Specification

`frontend-main` is a production, streaming-first frontend for the **curro-ai** agent backend.
It re-implements the useful functionality discovered in `frontend-3` (analysis-only reference)
inside a completely new, calm **Haku** design language, with a resilient, resumable networking
layer as its headline capability.

- **Reference (do not modify):** `frontend-3/` (functional + prior design reference)
- **Reference design:** `new_design.html` (Haku visual language)
- **Backend (integration target):** `curro-ai/` (Express + SSE agent)
- **New implementation:** `frontend-main/`

---

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | React 19 | automatic JSX runtime |
| Build/dev | Vite 8 | `/api` proxy to curro-ai |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS variables | Haku tokens as `@theme` + `:root` |
| State | Zustand 5 (`persist`) | debounced localStorage |
| Icons | lucide-react | |
| Types | TypeScript 7 (strict) | `tsc -b` is the type gate |
| Lint | oxlint | TS7-compatible (typescript-eslint is not yet) |

All dependencies are pinned to their latest stable release. `.npmrc` sets `legacy-peer-deps`
because a few tools still advertise a `<TS7` peer range even though they run correctly.

---

## 2. Design system (from `new_design.html`)

Tokens live in `src/app/globals.css` (both as Tailwind `@theme` colors and `:root` variables):

```
--bg #ffffff   --rail #f6f6f2   --fg #1c1c19   --muted #6f6f68   --subtle #9a9a93
--secondary #3c3d38 (the single dark accent)   --secondary-fg #f7f7f4
--border #e6e6e0   --chip #f3f3ef   --chip-hover #ecece6
radii: sm 8 / md 12 / lg 16 / xl 24 / 2xl 28   rail width 4.5rem
shadow-card / shadow-card-focus / shadow-chip / shadow-pop   ease cubic-bezier(.22,1,.36,1)
Fonts: Figtree (UI) + Instrument Serif italic (display headings)
```

Motion: `panel-in`, `fade-in`, `pop-in`, `overlay-in`, `stagger-in`, plus streaming affordances
(`shimmer-text`, pulsing `dot`s, blinking `caret`). All disabled under `prefers-reduced-motion`.

### Layout

```
┌ rail (4.5rem) ┬──────────────── stage ─────────────────┐
│  logo         │  topbar: "Haku" · context · todo/files/settings │
│  ◦ Chat       │  ┌───────────── canvas (section) ─────────────┐ │
│  ◦ Memory     │  │  chat hero / message stream  |  panels      │ │
│  ◦ Knowledge  │  └────────────────────────────────────────────┘ │
│  ◦ Sub-agents │  dock: composer (textarea + attach + send)      │
│  ◦ Skills     │  "Haku can be wrong…"                            │
│  avatar       │                                                 │
└───────────────┴─────────────────────────────────────────────────┘
```

The rail switches the canvas between five sections (`chat`, `memory`, `knowledge`, `agents`,
`skills`). The composer dock is always present; sending a message from any section switches to
`chat`. Managers (memory/knowledge/sub-agent/skill editors, settings, todos, files, preview)
open as calm modal overlays built on a shared `Modal` shell.

---

## 3. Source layout

```
src/
├── app/            App.tsx, main.tsx, globals.css, api/routes.ts (typed /api registry)
├── components/
│   ├── Rail, TopBar, Composer, NetworkBanner
│   ├── ui/         Modal + primitives (Field, TextInput, Button, Toggle, PanelHeader…)
│   ├── chat/       ChatPanel, MessageList, MessageItem, ToolChip, ThinkingIndicator,
│   │               SubmitPlanBlock, AskQuestionBlock
│   ├── panels/     MemoryPanel, KnowledgePanel, AgentsPanel, SkillsPanel (+ inline editors)
│   ├── editors/    SettingsModal (+ CustomProviderEditor)
│   └── overlays/   TodoPanel, FilesPanel, PreviewPanel
├── hooks/          useChatStream, useConnectionWatch, useAutoScroll
├── lib/            api, net, sse, chatStream, streamBatcher, streamDispatch,
│                   providers, subAgentTools, default{Memory,Knowledge,Skills,SubAgents}
├── store/          useStore (zustand + persist, debounced storage)
├── types/          index.ts (wire + UI types)
└── utils/          cn, id, format
```

Framework-agnostic data/contract modules (`types`, `providers`, `subAgentTools`, the `default*`
data, `app/api/routes`, `utils/cn`, `utils/id`) are shared verbatim with the reference so the
backend contract stays authoritative; **all UI, state, and networking are rebuilt from scratch.**

---

## 4. Backend integration

The browser only ever calls this app's own same-origin `/api/*` routes; Vite proxies them to
`CURRO_API_URL` (default `http://localhost:8787`). This keeps `localhost` server-side and SSE
working through a remote proxy URL.

Routes (typed in `app/api/routes.ts`): `GET /api/providers`, `POST /api/providers/models`,
`POST /api/chat/stream`, `POST /api/chat/abort/:chatId`, `POST /api/chat/plan/:chatId/:toolCallId`,
`POST /api/chat/question/:chatId/:toolCallId`, `GET /api/files/tree|read|preview|download`,
`POST /api/scrape`.

The backend already models runs as **server-owned**: `POST /api/chat/stream` with a full payload
starts a fresh turn; the same route with only `{ chat_id, since_event_id }` *reconnects* to the
in-flight run and **replays buffered events** from a cursor. Every SSE frame carries `_event_id`.
`frontend-main` is the client that fully exploits this.

---

## 5. Resumable, browser-independent runs

The agent (and every sub-agent) runs on the backend independently of the browser.

- On send, the client records an `activeRun { chatId, assistantId, lastEventId }` in **persisted**
  store state, then streams.
- On refresh/close/reconnect, `App` reads `activeRun` and calls `resume(run)`: it re-opens the
  stream with `since_event_id`, **replays the buffered output in a flash**, then continues live.
  The persisted message content is already on screen instantly (from localStorage) while the
  replay reconciles it.
- A browser/SSE disconnect **never** cancels the run. The `AbortController` is wired to exactly
  one thing: the user pressing **Stop** (which also calls `POST /api/chat/abort/:chatId`).
- If the backend no longer knows the run (finished + evicted, or restarted) a reconnect returns
  4xx → the client resolves the run cleanly (`"gone"`) and keeps whatever was produced.

Durability detail: the resume cursor must survive a refresh, so the debounced storage layer
force-flushes on `pagehide` / `visibilitychange:hidden` / `beforeunload`.

---

## 6. Resilient networking (slow ≠ offline)

Centralized in `lib/net.ts`, `lib/sse.ts`, `lib/chatStream.ts`; every agent and sub-agent stream,
tool call, and API request goes through it.

Rules:
1. **No client-side timeouts.** `parseSSEStream` blocks on `reader.read()` for as long as the
   connection stays open — a trickle below 1 KB/s is fine. Vite's proxy sets `timeout: 0` /
   `proxyTimeout: 0` so the dev proxy never severs a slow stream either.
2. **Distinguish the four states:** slow network (keep waiting) · dropped stream (reconnect from
   `since_event_id`) · server error 5xx (backoff + retry) · offline (`navigator.onLine === false`
   → wait for the `online` event, then reconnect).
3. **Only true offline surfaces UI.** `NetworkBanner` shows a quiet "offline / reconnecting" pill;
   a slow connection shows nothing and keeps streaming.
4. **Reconnect, don't fail.** `runChatStream` loops indefinitely: connect → stream → on drop,
   reconnect from the last applied `_event_id` (no lost/duplicated tokens). Capped exponential
   backoff is a *pause between attempts*, never a timeout on a live request. `resilientFetch`
   applies the same policy to JSON endpoints.

Result: 500 / 100 / 10 / <1 KB/s, high latency, and packet loss all continue without a Network
Error; only a fully-disconnected device shows one.

---

## 7. Streaming state & render performance

- **Batching:** `StreamBatcher` coalesces token / reasoning / sub-agent deltas and flushes to the
  store at most once per animation frame — hundreds of tokens/sec become ~60 store writes/sec.
- **Debounced persistence:** a custom `StateStorage` decouples disk writes from state updates
  (~400 ms coalesce), so streaming never thrashes localStorage; force-flushed before unload.
- **Targeted subscriptions & memoized rows** (`MessageItem` is `memo`) keep re-renders local; the
  auto-scroll hook uses a cheap tail signal and only pins when the user is already at the bottom.

Handled states: idle/empty hero, thinking indicator, live tokens with caret, collapsible
reasoning, tool chips (running/ok/error) with expandable result panels, live nested sub-agent
runs, human-in-the-loop plan review & questions, todos/memory/knowledge live updates, embed_url
preview, attach_files, and error/offline/gone terminal states.

---

## 8. Verification

`tsc -b` (0 errors) · `vite build` (0 errors) · `oxlint` (0 errors) · dev-server + proxy reach the
live backend (`/api/providers`, reconnect contract) · a jsdom mount smoke test renders the shell
with 0 React errors. Latest stable versions across the board.
