# Architecture

## One-liner

A React chat UI talks to a Hono orchestrator that runs an LLM tool-use loop. Tools call a mock TNG API for merchant data, a curated grants knowledge base, and a Python browser agent for live web automation.

## Diagram

```
┌─────────────────┐    SSE     ┌────────────────────┐
│  Frontend (web) │◀──────────▶│  Orchestrator      │
│  React + Vite   │  POST/chat │  Hono + Node       │
└─────────────────┘            │  ┌──────────────┐  │
                               │  │ Agent loop   │  │
                               │  │ + tool reg.  │  │
                               │  └──────┬───────┘  │
                               │         │          │
                               │  ┌──────┴───────┐  │
                               │  │ LLMClient    │──┼──▶ AWS Bedrock (cognition)
                               │  │ adapter      │  │   or Anthropic (dev)
                               │  └──────────────┘  │
                               └────┬───────┬───────┘
                                    │       │
                          HTTP/JSON │       │ HTTP/JSON-lines
                                    ▼       ▼
                          ┌─────────────┐  ┌──────────────────┐
                          │ Mock TNG    │  │ Browser agent    │
                          │ Express     │  │ FastAPI + Pyt.   │
                          │ /merchant   │  │ Playwright +     │
                          │ /transactions│  │ browser-use      │
                          │ /stock      │  │                  │
                          └─────────────┘  │ Screenshots ────▶│ Alibaba OSS (hands)
                                           └──────────────────┘
                          ┌─────────────────────────────┐
                          │ Grants KB (5 grants, JSON)  │  imported by orchestrator
                          └─────────────────────────────┘
```

## Why these choices

**Frontend in React, not native.** Hackathon demo runs in a browser. Mobile-friendly viewport is enough.

**Orchestrator in Node + Hono, not Python.** TS contracts are the spine of the project. Same language across frontend, orchestrator, and mock-tng means types flow without serialisation drama.

**Browser agent in Python.** `browser-use` and Playwright Python are first class. The orchestrator talks to it over HTTP, so language boundary is clean.

**LLM via adapter.** `getLLM()` returns the right client for `LLM_PROVIDER`. Anthropic for dev (fastest iteration), Bedrock for the demo (multi-cloud story), Qwen as optional Malay paraphrase.

**SSE not WebSockets.** One-way streaming. SSE is simpler, tunes through proxies, and the orchestrator's Hono `stream()` handles it natively.

**JSON-lines from browser agent to orchestrator.** Plain newline-delimited events. The orchestrator parses line by line and forwards as `browser_step` AgentEvents.

## Data flow for the hero (grant) scenario

1. User: "Ada grant untuk saya?"
2. Frontend POSTs `/chat` → Orchestrator
3. Orchestrator runs LLM loop, model decides to call `matchGrants`
4. `matchGrants` reads `packages/grants-kb/` and `mock-tng /merchant`, returns top matches
5. LLM produces a 2 to 3 sentence summary plus follow-up suggestion
6. User: "Yang TEKUN tu lah"
7. LLM calls `runGrantAgent({ grantId: "tekun-mikro" })`
8. Orchestrator POSTs `browser-agent /run/grant_application`
9. Browser agent opens portal, fills fields, emits step events
10. Orchestrator forwards each step as a `browser_step` AgentEvent
11. After last step, orchestrator emits `handoff` event with `kind: review_submit`
12. Frontend renders the handoff card with a "Take over" CTA

## Failure handling

- LLM error → `error` event → frontend shows red banner, agent loop ends
- Tool error → caught in agent loop → `tool_result` with error string → LLM sees and replies kindly
- Browser-use loop / failure → flow catches exception → falls back to `recordings/<flow>_happy_path.json` replay
- Bedrock auth failure → flip env var to Anthropic, restart, demo continues
