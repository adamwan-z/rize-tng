# Browser-agent API design

> **Historical record (2026-04-25).** Captures the original Lane C API spec. **Persona examples in this doc are stale:** the "Siti binti Hassan / Sitis Nasi Lemak Klang" demo profile has been retired in favour of the single repo-wide persona "Aminah binti Hassan / Burger Bakar Mak Cik / Kampung Baru". The API contracts and Pydantic shapes remain authoritative; only the example values are out of date. See `services/browser-agent/src/flows/__main__.py` and root `README.md` for current sample data.

> Lane C runner becomes a clean, independently-callable service. Three usage modes (HTTP, Python import, CLI) over one core function per flow. Strict input validation. Loose coupling: depends on inputs in, yields events out.

## Goals

1. **Independent runnability.** A teammate can call the browser-agent without booting the orchestrator or FE. Minimum dependency is mock-tng (which serves the HTML page being driven).
2. **Strict input validation.** Bad inputs are rejected with HTTP 422 before Chromium boots. For Lotus, requested SKUs are cross-checked against the live catalog; you cannot ask for items that do not exist.
3. **Three call modes off one function.** HTTP endpoint, Python import, and standalone CLI all wrap the same async generator. No code duplication.
4. **Two execution modes.** `scripted` (deterministic Playwright, demo-safe, no API key) and `agent` (browser-use + Anthropic, the wow moment). Selected by request body.
5. **Fallback unchanged.** On runtime failure the existing `replay_recording()` path still kicks in so the demo never goes dark.

## Architecture

```
                                                       services/mock-tng (Lane D)
                                                       ─────────────────────────────
                                                       :5000
                                                       /grant.html         ← form mock
                                                       /lotus.html         ← cart mock
                                                       /products/<sku>.jpg ← assets
                                                       /data/lotus-catalog.json
                                                              ▲
                                                              │ fetch (cached)
                                                              │ for SKU validation
                                                              │ and as page navigation
                                                              │ target
                                                              │
services/browser-agent (Lane C) ──────────────────────────────┘
─────────────────────────────────
src/flows/grant_application.py     async def run_grant_application(*, run_id, profile,
src/flows/lotus_procurement.py     application_url, mode) -> AsyncIterator[StepEvent]

       ▲                       ▲                       ▲
       │ imports               │ imports               │ imports
       │                       │                       │
src/server.py            src/__main__.py          tests / other py code
(FastAPI, NDJSON)        (CLI runner)             (direct python)
       ▲
       │ HTTP POST /run/grant_application
       │
apps/orchestrator (Lane B)
   src/tools/runGrantAgent.ts
       ▲
       │ tool call from LLM loop, SSE forward to FE
       │
apps/web (Lane A)
```

## Public interface

### Pydantic models (the API spec)

```python
# src/flows/types.py

class GrantProfile(BaseModel):
    full_name:        str           = Field(min_length=2)
    nric:             str           = Field(pattern=r"^\d{6}-\d{2}-\d{4}$")
    mobile:           str           = Field(pattern=r"^01\d-?\d{7,8}$")
    email:            EmailStr
    business_name:    str           = Field(min_length=2)
    business_reg_no:  str           = Field(min_length=4)
    business_type:    Literal["F&B", "Retail", "Services", "Manufacturing", "Tech", "Other"]
    business_address: str           = Field(min_length=10)
    years_operating:  int           = Field(ge=0, le=100)
    employee_count:   int           = Field(ge=0, le=10000)
    annual_revenue:   int           = Field(ge=0)
    requested_amount: int           = Field(ge=0)
    purpose:          str           = Field(min_length=10)


class GrantApplicationRequest(BaseModel):
    profile:         GrantProfile
    application_url: str | None     = None
    grant_id:        str            = "unknown"
    mode:            Literal["scripted", "agent"] = "scripted"


class ShoppingItem(BaseModel):
    sku:      str
    quantity: int = Field(ge=1, le=99)


class LotusProcurementRequest(BaseModel):
    items: list[ShoppingItem] = Field(min_length=1)
    mode:  Literal["scripted", "agent"] = "scripted"

    @model_validator(mode="after")
    def _check_skus(self) -> "LotusProcurementRequest":
        valid = get_valid_skus()
        unknown = sorted({i.sku for i in self.items} - valid)
        if unknown:
            raise ValueError(
                f"Unknown SKU(s): {unknown}. "
                f"Available example: {sorted(valid)[:5]} ({len(valid)} total)"
            )
        return self


class StepEvent(TypedDict, total=False):
    runId: str           # always
    step: int            # always
    description: str     # always
    screenshotUrl: str   # most events
    done: bool           # only on final event
    result: dict         # only on final event; structured outcome
    error: str           # only on the failure-fallback terminator
```

The stream always ends with one event marked `done: true`. The `result`
field on that event carries the structured outcome:

- Grant: `{ok, grantId, mode, applicationUrl, referenceNumber}` — the
  reference number is captured from the success page after Submit.
- Lotus: `{ok, mode, items, subtotal, total}` — totals are captured
  from the checkout page strings.

### HTTP endpoints

| Endpoint | Method | Body | Response | Errors |
|---|---|---|---|---|
| `POST /run/grant_application` | POST | `GrantApplicationRequest` | `application/x-ndjson` stream of `StepEvent` (one JSON object per `\n`-terminated line) | `422` invalid input. `503` Chromium fails to launch. Runtime failure emits `{step:99, description:"Live run failed (...)..."}` then continues with replay. |
| `POST /run/lotus_procurement` | POST | `LotusProcurementRequest` | same | `422` invalid input or unknown SKU. `503` if mock-tng catalog unreachable at first request. Same runtime fallback. |
| `GET /health` | GET | — | `{ ok: true, service: "browser-agent" }` | — |
| `GET /screenshots/{file}` | GET | — | PNG | `404`. Dev-only. Prod uses OSS URLs. |

### Python import

```python
from src.flows.grant_application import run_grant_application

async for event in run_grant_application(
    run_id="local-test-1",
    profile={"full_name": "Siti binti Hassan", ...},   # GrantProfile-shaped dict
    application_url="http://localhost:5000/grant.html",
    mode="scripted",
):
    print(event)
```

The function validates `profile` using the same Pydantic model the HTTP path uses, so direct callers cannot bypass validation.

### CLI

```bash
cd services/browser-agent

# Default profile (Aunty Siti) against local mock
uv run python -m src.flows.grant_application --mock

# Custom profile from JSON, agent mode
uv run python -m src.flows.grant_application --profile profile.json --mode agent

# Lotus
uv run python -m src.flows.lotus_procurement --mock
uv run python -m src.flows.lotus_procurement --items shopping.json --mode scripted
```

`--mock` uses a hardcoded demo profile / shopping list so a teammate can run cold without authoring inputs. Output is one `StepEvent` per line, pretty-printed.

## Catalog single source of truth

Currently the `PRODUCTS` array is inlined in `index_lotus.html`. We extract it to JSON so two readers stay in sync:

- **HTML page** loads `/data/lotus-catalog.json` via `fetch()` on page load and renders the catalog from it.
- **Browser-agent** fetches the same URL once at first request and caches the SKU set in module global. Used by the `LotusProcurementRequest` validator.

If mock-tng is down at first browser-agent request, the catalog fetch fails and the endpoint returns `503` with `{detail: "Lotus catalog unreachable at <url>: <reason>"}`. Browser-agent retries on the next request (the cache is unset on failure), so the failure is recoverable without a restart.

The grant form has no equivalent catalog. Profile validation is purely structural via Pydantic.

## Mode dispatch

```python
async def run_grant_application(*, run_id, profile, application_url, mode):
    inputs = GrantApplicationRequest(profile=profile, application_url=application_url, mode=mode)
    try:
        if inputs.mode == "scripted":
            async for event in _run_grant_scripted(run_id, inputs): yield event
        else:
            async for event in _run_grant_agent(run_id, inputs): yield event
    except Exception as exc:
        yield {"runId": run_id, "step": 99,
               "description": f"Live run failed ({exc}). Falling back to recorded replay."}
        async for event in replay_recording(...): yield event
```

`_run_grant_scripted` ports `fill_scripted.py` (deterministic Playwright). `_run_grant_agent` ports `fill_agent.py` (browser-use + Anthropic). Both yield `StepEvent`s shaped identically so consumers cannot tell which mode ran.

For Lotus, same structure with `_run_lotus_scripted` and `_run_lotus_agent`.

## File changes

```
services/browser-agent/
  src/flows/types.py             NEW   Pydantic models, StepEvent
  src/flows/grant_application.py REWRITE  scripted + agent + fallback
  src/flows/lotus_procurement.py REWRITE  scripted + agent + fallback
  src/flows/_grant_scripted.py   NEW   ported fill_scripted.py
  src/flows/_grant_agent.py      NEW   ported fill_agent.py
  src/flows/_lotus_scripted.py   NEW   ported fill_scripted_lotus.py
  src/flows/_lotus_agent.py      NEW   ported fill_agent_lotus.py
  src/flows/__main__.py          NEW   CLI entry, dispatched per --flow
  src/lib/catalog.py             NEW   Cached fetch + get_valid_skus
  src/server.py                  UPDATE Typed bodies, 503 mapping
  pyproject.toml                 UPDATE Add langchain-anthropic, httpx

services/mock-tng/
  data/lotus-catalog.json        NEW   PRODUCTS extracted
  public/grant.html              MOVED from index.html
  public/lotus.html              MOVED from index_lotus.html, refactored
                                       to fetch /data/lotus-catalog.json
  public/products/               MOVED 15 product images
  src/server.ts                  UPDATE express.static('public')
                                       + serve /data/*.json

apps/orchestrator/src/tools/
  runGrantAgent.ts               UPDATE snake_case keys, pass mode (default 'scripted')
  runProcurementAgent.ts         UPDATE same

README.md                        UPDATE Lane C usage section, three call modes
services/browser-agent/CLAUDE.md UPDATE Three call shapes documented
```

## Sample interactions

### Valid grant call
```bash
curl -N -X POST http://localhost:5001/run/grant_application \
  -H 'Content-Type: application/json' \
  -d '{
    "profile": {
      "full_name": "Siti binti Hassan",
      "nric": "740512-10-5234",
      "mobile": "012-3456789",
      "email": "siti.nasilemak@gmail.com",
      "business_name": "Sitis Nasi Lemak Klang",
      "business_reg_no": "JM0892341-K",
      "business_type": "F&B",
      "business_address": "Lot 23, Jalan Klang Lama, Pandamaran, 41200 Klang, Selangor",
      "years_operating": 8,
      "employee_count": 3,
      "annual_revenue": 60000,
      "requested_amount": 50000,
      "purpose": "Expand to a permanent stall location with kitchen equipment."
    },
    "mode": "scripted"
  }'
```

Stream:
```
{"runId":"...","step":1,"description":"Buka portal grant","screenshotUrl":"..."}
{"runId":"...","step":2,"description":"Step 1/3 Applicant","screenshotUrl":"..."}
{"runId":"...","step":3,"description":"Masukkan nama: Siti binti Hassan","screenshotUrl":"..."}
...
{"runId":"...","step":N,"description":"Borang lengkap. Berhenti sebelum Submit.","screenshotUrl":"..."}
```

### Invalid Lotus call (unknown SKU)
```bash
curl -X POST http://localhost:5001/run/lotus_procurement \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"sku":"FAKE-SKU-999","quantity":1}]}'
# HTTP 422
# {"detail":[{"loc":["body"],"msg":"Unknown SKU(s): ['FAKE-SKU-999']. Available example: ['EGG-GRADE-A-30','GARD-BURG-6',...] (15 total)"}]}
```

### Invalid grant call (bad NRIC)
```bash
curl -X POST http://localhost:5001/run/grant_application \
  -d '{"profile":{"nric":"abc",...}}'
# HTTP 422
# {"detail":[{"loc":["body","profile","nric"],"msg":"String should match pattern '^\\d{6}-\\d{2}-\\d{4}$'"}]}
```

## Out of scope

- Re-recording happy-path JSON files with real screenshots (separate task once live runs work).
- WebSocket streaming to FE (NDJSON to orchestrator SSE is already wired).
- AP2 / payment handoff for Lotus.
- Authentication on browser-agent endpoints (demo internal-only).
- Persisting run history.

## Risks

| Risk | Mitigation |
|---|---|
| Catalog JSON drifts from inlined PRODUCTS | Single extraction; HTML loads from JSON; no inline PRODUCTS allowed. |
| Mock-tng down when browser-agent boots | Catalog fetch lazy (on first lotus request), cache cleared on failure so retry works. |
| Agent mode fails mid-run | Same fallback path as today: yield error step, replay recording. |
| Orchestrator passes wrong key shape | Snake-case the keys explicitly in the orchestrator update. Pydantic 422 surfaces as a clear error event in the SSE stream. |
| browser-use + langchain-anthropic version drift | Pin in pyproject.toml. |
