# Implementation

> Per-lane build spec. Each lane reads their section, copies their per-lane `CLAUDE.md` into their folder, and runs Claude Code from that folder.

## How to use this file

1. Each lane lead picks their lane below
2. Reads their section in full
3. Copies the **per-lane `CLAUDE.md` draft** at the bottom of their section into the right folder (e.g. `apps/web/CLAUDE.md`)
4. Starts Claude Code in that folder. CC reads the lane's `CLAUDE.md`, follows pointers up to the root, and gets full context.

## Shared contracts

Owned by Lane B. Lives in `packages/shared/src/contracts.ts`. Every service imports from `@tng-rise/shared`.

```typescript
import { z } from 'zod';

// ===== Chat =====
export const ChatRequest = z.object({
  message: z.string().min(1),
  sessionId: z.string(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// ===== Agent stream events (SSE) =====
export const AgentEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('tool_call'), id: z.string(), name: z.string(), input: z.record(z.unknown()) }),
  z.object({ type: z.literal('tool_result'), id: z.string(), name: z.string(), result: z.unknown() }),
  z.object({
    type: z.literal('browser_step'),
    runId: z.string(),
    step: z.number(),
    description: z.string(),
    screenshotUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal('handoff'),
    kind: z.enum(['payment', 'review_submit', 'email']),
    payload: z.record(z.unknown()),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('done') }),
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

// ===== Merchant profile =====
export const MerchantProfile = z.object({
  id: z.string(),
  name: z.string(),
  businessName: z.string(),
  businessType: z.string(),
  location: z.object({ city: z.string(), state: z.string() }),
  registeredSince: z.string(),
  ssm: z.string().optional(),
  monthlyRevenueRm: z.number(),
});
export type MerchantProfile = z.infer<typeof MerchantProfile>;

// ===== Transaction =====
export const Transaction = z.object({
  id: z.string(),
  timestamp: z.string(),
  amountRm: z.number(),
  customerRef: z.string(),
});
export type Transaction = z.infer<typeof Transaction>;

// ===== Grant =====
export const Grant = z.object({
  id: z.string(),
  name: z.string(),
  agency: z.string(),
  description: z.string(),
  maxAmountRm: z.number(),
  eligibility: z.array(z.string()),
  submissionMethod: z.enum(['web_form', 'email']),
  applicationUrl: z.string().optional(),
  applicationEmail: z.string().email().optional(),
  emailTemplate: z.object({ subject: z.string(), body: z.string() }).optional(),
});
export type Grant = z.infer<typeof Grant>;

// ===== Browser agent =====
export const BrowserRunRequest = z.object({
  flow: z.enum(['lotus_procurement', 'grant_application']),
  inputs: z.record(z.unknown()),
});
export type BrowserRunRequest = z.infer<typeof BrowserRunRequest>;
```

## Shared agent system prompt

Owned by Lane B. Canonical prompt lives in `apps/orchestrator/src/agent/prompts.ts`. See that file for the current text.

Summary of current behaviour (see also `docs/plans/2026-04-25-orchestrator-cfo-design.md` for rationale):

- **Persona**: TNG Rise, the CFO for the smallest businesses. Default register is friendly Bahasa-Inggeris (Mak Cik's voice); mirrors any user-input language including Mandarin (普通话) and English. CFO-grade financial discipline for the demo persona Mak Cik; adapts to other TNG merchants who open in a different language. Never em dashes, never jargon.
- **Tool inventory** (6 tools):
  - `analyzeRevenue(period)`: revenue analytics with trend, day-of-week, peak hours, alerts
  - `analyzeRunway()`: cashflow position, profit qualitative band ('comfortable' / 'tight' / 'losing')
  - `suggestSupplyRun({items})`: dialog-driven. Takes items the LLM gathered from Mak Cik in chat (name, qty, optional unit) and emits a `supply_list` handoff card. The CFO does not track inventory; this tool is a list-builder, not a stock checker.
  - `matchGrants()`: rule-based match against the grants KB
  - `runGrantAgent(grantId)`: hero flow, live browser fill of the application portal
  - `runProcurementAgent(items)`: live Lotus browser. Triggered downstream of `suggestSupplyRun` via the supply-list card's CTA (FE wiring owned by Lane A).
- **Behaviour rules**: empathy first, CFO lane only (surface the numbers, defer the call on operational/strategy questions), gentle verification, pronoun resolution, language match, resupply dialog (gather items from her, never invent), cadence awareness (ask once per session when she usually restocks).
- **Honesty rules**: qualitative-only for estimated metrics (no monthly cost amounts surfaced). For `analyzeRunway`, only `weeklyInflowRm` and `profitEstimate` are safe to mention. The CFO has no view of inventory, so it never makes claims about what is in stock; it asks.
- **Threshold-triggered nudges**: tools return language-agnostic alerts (`kind` + `urgency` + `context`); the LLM phrases them in the user's language. Per-session gate prevents repetition.

---

# Lane A: Frontend (`apps/web/`)

## Goal

Build a clean React chat interface that streams agent responses, renders tool calls visibly, embeds a live browser viewport for BrowserUse runs, and looks polished enough for judges. Function over form. Mobile-friendly width but desktop demo is fine.

## Stack

React 18, Vite, TypeScript strict, Tailwind, shadcn/ui, react-markdown for chat copy.

## File structure

```
apps/web/
├── CLAUDE.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx       # Main chat container
│   │   │   ├── MessageList.tsx
│   │   │   ├── Message.tsx          # Renders text/tool_call/tool_result
│   │   │   ├── ChatInput.tsx
│   │   │   └── ToolCallCard.tsx     # Collapsible "agent is using analyzeRevenue..."
│   │   ├── browser/
│   │   │   └── BrowserViewport.tsx  # Receives browser_step events, shows screenshots
│   │   ├── handoff/
│   │   │   ├── HandoffCard.tsx      # "Take over" button card
│   │   │   ├── PaymentHandoff.tsx
│   │   │   ├── ReviewSubmitHandoff.tsx
│   │   │   └── EmailHandoff.tsx     # mailto: link
│   │   └── ui/                      # shadcn primitives
│   ├── hooks/
│   │   └── useAgentStream.ts        # SSE consumer for /chat
│   ├── lib/
│   │   └── api.ts                   # Typed client
│   └── styles/
└── public/
```

## Acceptance criteria

- [ ] Chat input sends to `POST /chat` (orchestrator) and consumes SSE stream
- [ ] Each `AgentEvent` type renders distinctly: text bubbles, tool-call cards, browser viewport, handoff cards
- [ ] Tool calls visibly show what tool is running with a spinner, then collapse on result
- [ ] BrowserViewport renders incoming `browser_step` events with screenshot plus step description, scrolling new steps in
- [ ] Handoff cards are visually prominent (green border, large CTA)
- [ ] Email handoff opens `mailto:` with pre-filled subject and body
- [ ] No layout shift during streaming
- [ ] Demo runbook steps 1 to 3 work end-to-end

## Stretch

- Subtle TNG-orange accent palette (sample from the actual TNG eWallet)
- Greeting card with Mak Cik's name and a placeholder photo
- Sound cue on handoff

## Per-lane CLAUDE.md (copy into `apps/web/CLAUDE.md`)

```markdown
# Lane A: Frontend

You are building the React chat UI for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane A section of `/IMPLEMENTATION.md` before writing code.

## Tech
React 18, Vite, TypeScript strict, Tailwind, shadcn/ui.

## Files you own
Everything under `apps/web/`. Do not touch other lanes' folders.

## Contracts
Import all types from `@tng-rise/shared`. If you need a new event type, propose it to Lane B in chat. Do not fork types locally.

## SSE consumption
The orchestrator streams `AgentEvent` over Server-Sent Events at `POST /chat`. Use `fetch` with a `ReadableStream` reader since you are POSTing a body (the native `EventSource` API is GET-only). Wrap it in a `useAgentStream` hook.

## Visual conventions
- Chat bubbles: user right (gray-100), agent left (white with border)
- Tool call cards: collapsible, gray border, monospace tool name, spinner while running
- Browser viewport: bordered container, 16:9, max 800px wide, replace contents on each `browser_step`
- Handoff: green-bordered card with bold CTA button

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

Frontend on :3000. Orchestrator on :4000. Configure proxy in `vite.config.ts`.

## Don't
- Do not add a routing library. One screen.
- Do not add Redux or Zustand. React state plus the stream hook is enough.
- Do not fake stream events. Always render real ones from the orchestrator.
- Do not start polishing pixels before the runbook passes end-to-end.
```

---

# Lane B: Orchestrator (`apps/orchestrator/`)

## Goal

The agent core. Receives chat messages, runs the LLM tool-use loop, dispatches tool calls (mock TNG, browser agent, grants KB), streams `AgentEvent`s back to the frontend over SSE. Owns the `LLMClient` abstraction so the model can be swapped via env var.

## Stack

Node 20, TypeScript strict, Hono (preferred) or Express, Zod, AWS SDK (Bedrock), Anthropic SDK, Alibaba SDK if Qwen is used.

## File structure

```
apps/orchestrator/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── server.ts                    # HTTP entry, SSE endpoint
│   ├── routes/
│   │   └── chat.ts                  # POST /chat, streams AgentEvents
│   ├── agent/
│   │   ├── core.ts                  # Tool-use loop
│   │   ├── prompts.ts               # System prompt
│   │   ├── memory.ts                # In-memory session store + alert gate
│   │   ├── thresholds.ts            # Numeric thresholds for analytical tools
│   │   └── toolSchemas.ts           # JSON schemas for LLM
│   ├── tools/
│   │   ├── registry.ts              # Map tool name → handler
│   │   ├── analyzeRevenue.ts        # Period revenue + trend + alerts
│   │   ├── analyzeRunway.ts         # Cashflow position + profit band
│   │   ├── suggestSupplyRun.ts      # Dialog-driven list builder, emits supply_list handoff
│   │   ├── matchGrants.ts           # Reads packages/grants-kb
│   │   ├── runProcurementAgent.ts   # Live Lotus browser, downstream of supply_list card
│   │   └── runGrantAgent.ts
│   ├── llm/
│   │   ├── client.ts                # LLMClient interface
│   │   ├── anthropic.ts
│   │   ├── bedrock.ts
│   │   ├── qwen.ts                  # Optional, for Malay paraphrase
│   │   └── index.ts                 # getLLM()
│   └── lib/
│       ├── sse.ts
│       └── env.ts
└── tests/
    └── runbook.test.ts              # Optional: runbook as integration test
```

## Acceptance criteria

- [x] `POST /chat` accepts `ChatRequest`, returns SSE stream of `AgentEvent`s
- [x] LLM tool-use loop terminates correctly on `done` and on errors
- [x] All six tools registered and callable by the LLM (`analyzeRevenue`, `analyzeRunway`, `suggestSupplyRun`, `matchGrants`, `runGrantAgent`, `runProcurementAgent`)
- [x] `LLM_PROVIDER` env var swaps Anthropic and Bedrock without code changes
- [x] Tool call errors surface as `error` events, never crash the server
- [x] System prompt loaded from `prompts.ts`
- [x] `matchGrants` returns at least 2 grants for Mak Cik with eligibility reasoning
- [x] Multi-turn memory: full `LLMMessage[]` (incl. tool_use / tool_result blocks) persisted per session
- [x] Per-session alert gate so threshold-triggered nudges do not repeat
- [x] Qualitative-only honesty rules for estimated metrics (no day-counts, no monthly cost amounts surfaced)
- [ ] Demo runbook steps 1, 2, 4, 5 work end-to-end with the real LLM (pending live verification with `ANTHROPIC_API_KEY`)

## LLM client interface

```typescript
export interface LLMClient {
  stream(input: {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }>;
    tools: Array<{ name: string; description: string; input_schema: object }>;
  }): AsyncIterable<LLMEvent>;
}

export type LLMEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'message_stop' };
```

## Per-lane CLAUDE.md (copy into `apps/orchestrator/CLAUDE.md`)

```markdown
# Lane B: Orchestrator

You are building the agent core for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane B section of `/IMPLEMENTATION.md`.

## Tech
Node 20, TypeScript strict, Hono (preferred) or Express. Zod for validation.

## Files you own
Everything under `apps/orchestrator/`. You also own `packages/shared/`.

## LLM abstraction
Never call vendor SDKs outside `src/llm/`. Always go through `getLLM()`. Default `LLM_PROVIDER=anthropic` for development. `bedrock` for the demo. `qwen` is optional and used only for Malay paraphrase.

## Tool dispatching
- Tools needing merchant data: call mock TNG (`http://mock-tng:5050`)
- Tools needing grant data: read `packages/grants-kb/data/*.json` directly
- Tools needing a browser run: call browser agent (`http://browser-agent:5001`) and forward `browser_step` events through your SSE stream

## SSE
Stream `AgentEvent`s. Always end with `done` or `error`. Set `Content-Type: text/event-stream`. Disable buffering on the response.

## System prompt
Lives in `src/agent/prompts.ts`. Reload on dev. Do not inline the prompt elsewhere.

## Tool schemas
Use Anthropic tool format (JSON Schema). Lives in `src/agent/toolSchemas.ts`.

## Memory
In-memory `Map` keyed by `sessionId`. No database. Session resets on server restart, fine for the demo.

## Email-submission grants
For `submissionMethod: "email"` grants, do not call the browser agent. Emit a `handoff` event with `kind: "email"` and the pre-filled subject and body in the payload. The frontend will open `mailto:`.

## Run
```
cd apps/orchestrator
npm install
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npm run dev
```

## Don't
- Do not add a vector DB. Grant matching is rule-based for the demo.
- Do not store conversation history beyond the in-memory session map.
- Do not hardcode merchant data. Always go through mock-tng.
- Do not catch errors silently. Surface them as `error` events to the frontend.
```

---

# Lane C: Browser agent (`services/browser-agent/`)

## Goal

A Python service that runs Playwright plus browser-use to execute two flows: Lotus procurement and grant application. Streams progress back to the orchestrator. Each step emits a screenshot and a description.

## Stack

Python 3.12, FastAPI, browser-use, Playwright (Chromium), uv for deps.

## File structure

```
services/browser-agent/
├── CLAUDE.md
├── pyproject.toml
├── Dockerfile                       # FROM playwright/python, includes Chromium
├── src/
│   ├── server.py                    # FastAPI, POST /run/{flow}, streams progress
│   ├── runner.py                    # Wraps browser-use, emits step events
│   ├── flows/
│   │   ├── __init__.py
│   │   ├── lotus_procurement.py     # Search ingredients, add to cart, stop at checkout
│   │   └── grant_application.py     # Open grant portal, fill form, stop at Submit
│   ├── storage/
│   │   └── oss.py                   # Upload screenshots to Alibaba OSS
│   └── lib/
│       └── selectors.py             # Stable selectors with fallbacks
└── recordings/                      # Cached run replays for fallback
    ├── lotus_happy_path.json
    └── grant_happy_path.json
```

## Acceptance criteria

- [ ] `POST /run/grant_application` accepts `{ grantId, profile }`, returns SSE stream of step events
- [ ] Each step uploads a screenshot to OSS (or local file storage as fallback) and yields `{ step, description, screenshotUrl }`
- [ ] Grant flow opens target portal, fills application up to Submit, stops cleanly
- [ ] Lotus flow opens Lotus, searches for items, adds to cart, stops at checkout
- [ ] If browser-use fails, runner falls back to a Playwright-scripted replay from `recordings/`
- [ ] Screenshots upload to Alibaba OSS in production mode, local in dev
- [ ] Headed browser in dev (so debugging is possible). Headless in container.

## Grant target selection

**Verify by 6 PM Saturday.** Try in this order:

1. TEKUN Nasional online application form (preferred, simpler eligibility)
2. MARA Graduan
3. Local replica we host (fallback if no real portal cooperates)

If using a local replica, Lane D builds it as a static HTML form mimicking the agency's design, served from mock-tng. Honest framing for judges: "this is illustrative of the application form".

## Per-lane CLAUDE.md (copy into `services/browser-agent/CLAUDE.md`)

```markdown
# Lane C: Browser agent

You are building the browser automation service for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane C section of `/IMPLEMENTATION.md`.

## Tech
Python 3.12, FastAPI, browser-use, Playwright Chromium. Use `uv` for deps.

## Files you own
Everything under `services/browser-agent/`.

## Flows
Two flows: `lotus_procurement` and `grant_application`. Implement grant first. It is the hero.

## Stable selectors
Prefer `data-testid` if available. Otherwise text content. Avoid CSS class selectors that look auto-generated. Document every selector in `src/lib/selectors.py` with the date you last verified it.

## Streaming
The orchestrator calls you over HTTP. Stream progress as JSON-lines or SSE. Each event is `{ runId, step, description, screenshotUrl }`. Take a screenshot after every meaningful action.

## Storage
Upload screenshots to Alibaba OSS in production. Use bucket `tng-rise-screenshots`, region `ap-southeast-3` (KL). In dev, write to `./screenshots/` and serve via FastAPI static.

## Fallback
If browser-use fails (selectors changed, model loops), fall back to a Playwright-scripted replay from `recordings/{flow}_happy_path.json`. The replay is a list of `{ action, selector, value }` recorded during a successful run.

## Run
```
cd services/browser-agent
uv sync
uv run python -m playwright install chromium
uv run python -m src.server
```

Service on :5001.

## Don't
- Do not browse anywhere outside the demo target sites
- Do not store user data in screenshots beyond what the demo needs
- Do not run headless in dev. You need to see the browser to debug.
- Do not hardcode form values. Take them from the request payload.
```

---

# Lane D: Mock TNG, Grants KB, Infra

## Goal

The data and infra backbone. Realistic mock TNG merchant data. Curated grants knowledge base with 5 real Malaysian grants (mix of web_form and email submission). Docker Compose orchestration. Alibaba OSS bucket setup. Multi-cloud rationale doc. Pitch deck stats.

## File structure

```
services/mock-tng/
├── CLAUDE.md
├── package.json
├── Dockerfile
└── src/
    ├── server.ts                    # Express, GET /merchant, /transactions
    ├── data/
    │   ├── profile.json             # Mak Cik
    │   └── transactions.json        # 30 days of believable QR receipts
    └── routes.ts

packages/grants-kb/
├── package.json
├── data/
│   ├── tekun-mikro.json
│   ├── mara-graduan.json
│   ├── teraju-bumiputera.json
│   ├── bnm-iaes.json                # Email submission example
│   └── aim-microcredit.json
└── src/
    └── index.ts                     # Typed exports

infra/
├── docker-compose.yml               # All services
├── docker-compose.prod.yml          # Stretch: production overrides
├── .env.example
├── aws/
│   └── README.md                    # Bedrock model IDs, region, IAM
└── alibaba/
    └── README.md                    # OSS bucket, ECS sizing for stretch

docs/
├── architecture.md
├── multi-cloud-rationale.md
└── persona.md

pitch/
├── deck.md                          # Outline, hand off to Lane A for visuals
├── script.md
├── demo-runbook.md
└── stats.md                         # 3-5 real Malaysian SME stats
```

## Acceptance criteria

- [ ] Mock TNG returns Mak Cik's profile and 30 days of realistic transactions (no stock; the CFO does not track inventory)
- [ ] Transaction amounts feel real: RM 8 to RM 35 for nasi orders, peak Friday lunch, slow Mondays
- [ ] Grants KB has 5 real Malaysian grants (verified URLs and eligibility), at least one with `submission_method: "email"`
- [ ] `docker compose up` brings all 4 services up cleanly
- [ ] `.env.example` documents all required keys (AWS, Alibaba, Anthropic)
- [ ] Alibaba OSS bucket created, credentials in `.env.example`
- [ ] `docs/multi-cloud-rationale.md` is one page, judge-ready
- [ ] Demo runbook in `pitch/demo-runbook.md` matches the one in `PLAN.md`
- [ ] 3 to 5 real stats in `pitch/stats.md` with sources cited

## Mock data realism rules

Mak Cik's stall: open 11 AM to 9 PM, peak 12:30 to 1:30 PM and 6 to 7:30 PM. Average ticket RM 12. About 30 to 50 customers per day. Friday and Saturday busiest. Mondays slowest. Recent dip in revenue 5% week-over-week (a hook for the agent to spot).

## Grants KB schema sample

```json
{
  "id": "tekun-mikro",
  "name": "Skim Pembiayaan Mikro TEKUN",
  "agency": "TEKUN Nasional",
  "description": "Pembiayaan mikro untuk usahawan kecil sehingga RM 50,000",
  "maxAmountRm": 50000,
  "eligibility": [
    "Warganegara Malaysia",
    "Umur 18-60",
    "Perniagaan beroperasi sekurang-kurangnya 6 bulan",
    "Pendapatan bulanan kurang RM 8,000"
  ],
  "submissionMethod": "web_form",
  "applicationUrl": "https://www.tekun.gov.my/...",
  "applicationEmail": null,
  "emailTemplate": null
}
```

Email-submission example:

```json
{
  "id": "example-email-grant",
  "name": "...",
  "submissionMethod": "email",
  "applicationUrl": null,
  "applicationEmail": "applications@example.gov.my",
  "emailTemplate": {
    "subject": "Permohonan Pembiayaan Mikro - {{businessName}}",
    "body": "Salam sejahtera,\n\nSaya {{name}} ingin memohon..."
  }
}
```

## Per-lane CLAUDE.md (copy into `services/mock-tng/CLAUDE.md`)

```markdown
# Lane D: Mock TNG, Grants KB, Infra

You are building the data and infra backbone for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane D section of `/IMPLEMENTATION.md`.

## Folders you own
- `services/mock-tng/`
- `packages/grants-kb/`
- `infra/`
- `docs/`
- `pitch/` (collaborate with Lane A on the deck)

## Data realism is your most important deliverable
The data you generate is what the LLM sees. If it is lazy, the agent's responses are lazy. Spend time making it feel like a real Malaysian stall.

## Mock TNG
Express plus TypeScript. Two endpoints:
- `GET /merchant` returns `MerchantProfile`
- `GET /transactions?days=30` returns `Transaction[]`

Hard-code Mak Cik's data. Generate 30 days of transactions with realistic distribution: peak hours, slow Mondays, RM 12 average ticket, 5% week-over-week dip in the most recent week. Stock is intentionally not exposed: TNG Rise is the CFO, not the COO. Inventory awareness comes from chat dialog with Mak Cik (see `apps/orchestrator/src/agent/prompts.ts` resupply rules), not a data feed.

## Grants KB
5 real Malaysian SME grants. Verify URLs work. Mix web_form (3 to 4) and email (1 to 2). Schema in `packages/shared/src/contracts.ts`.

## Multi-cloud
Two clouds, both doing real work:
- AWS Bedrock for LLM (Lane B uses)
- Alibaba OSS for screenshot storage (Lane C uses)

You set up both. Document setup in `infra/aws/README.md` and `infra/alibaba/README.md` so any teammate can re-create it.

## Pitch deck stats
Find 3 to 5 real Malaysian micro-SME stats. Sources: AKPK, BNM annual report, DOSM. Cite sources. Do not invent numbers.

## Run
```
cd services/mock-tng
npm install
npm run dev    # :5050

# From repo root
docker compose up
```

## Don't
- Do not invent stats. Cite or omit.
- Do not ship sample data with "John Doe" or "test"
- Do not add real auth or real APIs to mock-tng
- Do not hold up other lanes for perfect data. Get believable data shipped fast, refine in phase 2.
```
