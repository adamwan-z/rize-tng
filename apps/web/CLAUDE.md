# Lane A: Frontend

You are building the React chat UI for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane A section of `/IMPLEMENTATION.md` before writing code.

## Tech
React 18, Vite, TypeScript strict, Tailwind, lucide-react for icons. Optionally add shadcn/ui primitives if needed.

## Files you own
Everything under `apps/web/`. Do not touch other lanes' folders.

## Contracts
Import all types from `@tng-rise/shared`. If you need a new event type, propose it to Lane B in chat. Do not fork types locally.

## SSE consumption
The orchestrator streams `AgentEvent` over Server-Sent Events at `POST /chat`. Use `fetch` with a `ReadableStream` reader since you are POSTing a body (the native `EventSource` API is GET-only). The `useAgentStream` hook in `src/hooks/useAgentStream.ts` already does this correctly.

## Visual conventions
- Chat bubbles: user right (gray-200), agent left (white with border)
- Tool call cards: collapsible, gray border, monospace tool name, spinner while running
- Browser viewport: bordered container, 16:9, max 800px wide, replace contents on each `browser_step`
- Handoff: emerald-bordered card with bold CTA button

## Copy rules
- No em dashes, ever
- Friendly Bahasa-Inggeris
- Specific RM amounts and dates
- Replace "Loading..." with "Sekejap ya" or "Tengah cari"

## Run
```
cd apps/web
npm install
npm run dev
```

Frontend on :3000. Orchestrator on :4000. Vite proxy is configured in `vite.config.ts` so calls to `/chat` forward to the orchestrator without CORS.

## Don't
- Do not add a routing library. One screen.
- Do not add Redux or Zustand. React state plus the stream hook is enough.
- Do not fake stream events. Always render real ones from the orchestrator.
- Do not start polishing pixels before the runbook passes end-to-end.
