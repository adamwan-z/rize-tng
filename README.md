# TNG Rise

Personal CFO agent for Malaysian micro F&B merchants on TNG eWallet. Hackathon project, April 2026.

## Quick start

```bash
cp .env.example .env       # fill in keys
npm install                # installs all workspaces
docker compose up --build  # all 4 services
```

Open http://localhost:3000 and follow `pitch/demo-runbook.md`.

## What this is

See [`CONTEXT.md`](./CONTEXT.md) for the full story. Short version: an AI agent that reads a stall owner's TNG transactions, helps her procure supplies, and applies for Malaysian SME grants on her behalf using live browser automation.

## Repo layout

```
apps/
  web/              Lane A: React chat UI
  orchestrator/     Lane B: Agent core (LLM + tool dispatch)
services/
  browser-agent/    Lane C: Python browser-use runner
  mock-tng/         Lane D: Mock TNG merchant API
packages/
  shared/           Shared TS contracts (zod schemas)
  grants-kb/        Curated Malaysian SME grant data
infra/              Docker compose, multi-cloud setup notes
docs/               Architecture, persona, multi-cloud rationale
pitch/              Deck, demo runbook, stats
```

## Read order for new contributors

1. [`CLAUDE.md`](./CLAUDE.md) — house rules
2. [`CONTEXT.md`](./CONTEXT.md) — why this exists
3. [`PLAN.md`](./PLAN.md) — phased build plan with time gates
4. [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — per-lane build spec

## Per-lane entry points

| Lane | Folder | Per-lane CLAUDE.md |
| --- | --- | --- |
| A: Frontend | `apps/web/` | [`apps/web/CLAUDE.md`](./apps/web/CLAUDE.md) |
| B: Orchestrator | `apps/orchestrator/` | [`apps/orchestrator/CLAUDE.md`](./apps/orchestrator/CLAUDE.md) |
| C: Browser agent | `services/browser-agent/` | [`services/browser-agent/CLAUDE.md`](./services/browser-agent/CLAUDE.md) |
| D: Data + infra | `services/mock-tng/`, `packages/grants-kb/`, `infra/` | [`services/mock-tng/CLAUDE.md`](./services/mock-tng/CLAUDE.md) |

## Browser agent (Lane C) usage

The browser-agent service drives Playwright (deterministic) or browser-use
(AI agent) over a target form. It is independently runnable: minimum deps
are mock-tng (which serves the HTML mocks) and Chromium. No orchestrator,
no FE, no LLM required for `mode: "scripted"`.

### Standalone setup

```bash
# Two terminals, or use docker compose
cd services/mock-tng     && npm install && npm run dev      # :5050
cd services/browser-agent && uv sync && uv run python -m playwright install chromium
cd services/browser-agent && uv run python -m src.server     # :5001
```

### Three ways to call it

**1. As an HTTP service** (any language, any caller)

```bash
# Grant application
curl -N -X POST http://localhost:5001/run/grant_application \
  -H 'Content-Type: application/json' \
  -d '{
    "profile": {
      "full_name": "Siti binti Hassan",
      "nric": "740512-10-5234",
      "mobile": "012-3456789",
      "email": "siti@example.com",
      "business_name": "Siti Nasi Lemak",
      "business_reg_no": "JM0892341-K",
      "business_type": "F&B",
      "business_address": "Lot 23, Jalan Klang Lama, 41200 Klang",
      "years_operating": 8,
      "employee_count": 3,
      "annual_revenue": 60000,
      "requested_amount": 50000,
      "purpose": "Expand to a permanent stall location."
    },
    "mode": "scripted"
  }'

# Lotus procurement
curl -N -X POST http://localhost:5001/run/lotus_procurement \
  -H 'Content-Type: application/json' \
  -d '{
    "items": [
      {"sku": "RAMLY-BEEF-12", "quantity": 2},
      {"sku": "GARD-BURG-6",   "quantity": 4}
    ],
    "mode": "scripted"
  }'
```

Response is `application/x-ndjson` — one JSON event per `\n`-terminated line.

**2. As a Python import** (tests, other Python services)

```python
from src.flows.grant_application import run_grant_application

async for event in run_grant_application(
    run_id="local-1",
    profile={"full_name": "Siti binti Hassan", ...},
    application_url="http://localhost:5050/grant.html",
    mode="scripted",
):
    print(event)
```

The function validates `profile` through the same Pydantic model the HTTP
path uses, so direct callers cannot bypass validation.

**3. As a standalone CLI** (cold demo, no other service running)

```bash
cd services/browser-agent
uv run python -m src.flows grant --mock                 # default Aunty Siti profile
uv run python -m src.flows grant --profile p.json --mode agent
uv run python -m src.flows lotus --mock                 # default 8-item shopping list
uv run python -m src.flows lotus --items shop.json --mode scripted
```

Stdout is one `StepEvent` JSON per line. Exit 0 on success.

### API contract

| Endpoint | Body | Response | Errors |
| --- | --- | --- | --- |
| `POST /run/grant_application` | `GrantApplicationRequest` | NDJSON `StepEvent` stream | `422` invalid profile. Live failure emits a fallback step then continues with replay. |
| `POST /run/lotus_procurement` | `LotusProcurementRequest` | NDJSON `StepEvent` stream | `422` empty items or unknown SKU. `503` if mock-tng catalog unreachable. |
| `GET /health` | — | `{ok: true}` | — |

#### `StepEvent` shape

Every line in the response stream is one `StepEvent`:

```json
{
  "runId": "uuid",
  "step": 1,
  "description": "Buka portal grant",
  "screenshotUrl": "https://.../runs/<id>.png",
  "done": false,
  "result": null,
  "error": null
}
```

| Field | Type | Always set | Meaning |
| --- | --- | --- | --- |
| `runId` | string | yes | UUID per call. Same value on every event in the stream. Use to correlate. |
| `step` | int | yes | Monotonically increasing within a run. Useful for ordering. |
| `description` | string | yes | Human-readable progress (Bahasa-Inggeris). Render in the FE viewport. |
| `screenshotUrl` | string | no | URL to a PNG. Present on most events. Show in the browser viewport. |
| `done` | bool | only on final event | `true` on the terminator. Stream may send 0 more events after. |
| `result` | object | only on final event | Structured outcome (see below). |
| `error` | string | only on failure terminator | Error message if the live run failed and even the fallback failed cleanly. |

#### Sample full response

**Grant application** (8 events for a successful run, last one has `done: true`):

```jsonc
{"runId":"a1...","step":1,"description":"Buka portal grant tekun-mikro","screenshotUrl":"..."}
{"runId":"a1...","step":2,"description":"Step 1/3 Applicant","screenshotUrl":"..."}
{"runId":"a1...","step":3,"description":"Masukkan nama: Siti binti Hassan","screenshotUrl":"..."}
{"runId":"a1...","step":4,"description":"Step 2/3 Business info","screenshotUrl":"..."}
{"runId":"a1...","step":5,"description":"Masukkan SSM: JM0892341-K","screenshotUrl":"..."}
{"runId":"a1...","step":6,"description":"Step 3/3 Funding details","screenshotUrl":"..."}
{"runId":"a1...","step":7,"description":"Borang lengkap. Submitting.","screenshotUrl":"..."}
{"runId":"a1...","step":8,"description":"Submitted. Reference: TER-2026-04-8821","screenshotUrl":"..."}
{"runId":"a1...","step":9,"description":"Application submitted. Reference: TER-2026-04-8821","done":true,"result":{"ok":true,"grantId":"tekun-mikro","mode":"scripted","applicationUrl":"http://localhost:5050/grant.html","referenceNumber":"TER-2026-04-8821"}}
```

The grant `result` shape:
```ts
{
  ok: boolean,
  grantId: string,
  mode: "scripted" | "agent",
  applicationUrl: string,
  referenceNumber: string | null   // e.g. "TER-2026-04-8821" once submission confirms
}
```

**Lotus procurement** (final event):
```jsonc
{"runId":"b2...","step":12,"description":"Cart ready for payment hand-off.","done":true,"result":{"ok":true,"mode":"scripted","items":[{"sku":"RAMLY-BEEF-12","quantity":2}],"subtotal":"RM 137.00","total":"RM 142.40"}}
```

The lotus `result` shape:
```ts
{
  ok: boolean,
  mode: "scripted" | "agent",
  items: Array<{sku: string, quantity: number}>,
  subtotal: string | null,   // e.g. "RM 137.00"
  total: string | null       // e.g. "RM 142.40"
}
```

#### How to consume the stream

Read line-by-line. Each line is one JSON object. Stop when you see `"done": true`
or when the HTTP connection closes.

```ts
const res = await fetch(url, { method: 'POST', body });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    handle(event);
    if (event.done) return event.result;   // success: returns the structured outcome
  }
}
```

Strict validation: passing `items: [{sku: "FAKE-SKU", quantity: 1}]` returns
`422 Unknown SKU(s): ['FAKE-SKU']` before Chromium launches.

Modes: `scripted` (default, deterministic Playwright, no API key) or `agent`
(browser-use + Anthropic, requires `ANTHROPIC_API_KEY`).

Full spec: [`docs/superpowers/specs/2026-04-25-browser-agent-api-design.md`](./docs/superpowers/specs/2026-04-25-browser-agent-api-design.md)
