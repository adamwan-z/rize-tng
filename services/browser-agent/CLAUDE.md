# Lane C: Browser agent

You are building the browser automation service for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane C section of `/IMPLEMENTATION.md` before writing code.

## Tech
Python 3.12, FastAPI, browser-use, Playwright Chromium. Use `uv` for deps.

## Files you own
Everything under `services/browser-agent/`.

## Architecture

The flow functions in `src/flows/` are the implementation. `src/server.py`,
`src/flows/__main__.py`, and any direct Python caller are all *consumers* of
the same async generators.

```
src/flows/grant_application.py      run_grant_application(run_id, profile, ..., mode)
src/flows/lotus_procurement.py      run_lotus_procurement(run_id, items, mode)
       ▲                                        ▲                                ▲
   imports                                  imports                          imports
   src/server.py (FastAPI HTTP)        src/flows/__main__.py (CLI)      tests/external py
```

Modes: `scripted` (deterministic Playwright, demo-safe, no API key) and
`agent` (browser-use + Anthropic, the wow moment). On runtime failure,
both fall back to `replay_recording()`.

## Three ways to call

**HTTP** — `POST /run/grant_application` or `POST /run/lotus_procurement`.
Body validated through Pydantic models in `src/flows/types.py`. Returns
NDJSON stream of StepEvent. Bad inputs → 422. Mock-tng catalog unreachable
→ 503.

**Python import** —
```python
from src.flows.grant_application import run_grant_application
async for event in run_grant_application(run_id="x", profile={...}, mode="scripted"):
    ...
```

**CLI** —
```bash
uv run python -m src.flows grant --mock
uv run python -m src.flows lotus --mock --mode scripted
```

## Input contract

`src/flows/types.py` is the API spec. Every caller routes through these
Pydantic models so validation cannot be bypassed.

- `GrantProfile` — strict shape (NRIC pattern, mobile pattern, email format).
- `ShoppingItem` — `sku` cross-checked against `services/mock-tng/data/lotus-catalog.json`.

The catalog is a single source of truth: the Lotus HTML mock fetches it
client-side; `src/lib/catalog.py` fetches it server-side for SKU validation.

## Streaming format
JSON-lines (newline-delimited JSON), one event per line. Each event is
`{ runId, step, description, screenshotUrl? }`. The orchestrator parses
line-by-line and forwards as `browser_step` AgentEvents to the frontend.

## Stable selectors
Prefer `data-testid` if available. Otherwise text content (`page.get_by_text`).
Avoid CSS class selectors that look auto-generated. Document every selector in
`src/lib/selectors.py` with `last_verified` set to the date you last confirmed
it works.

## Storage
Upload screenshots to Alibaba OSS in production. Bucket: `tng-rise-screenshots`,
region `ap-southeast-3` (KL). In dev, write to `./screenshots/` and serve via
FastAPI static (`/screenshots/<file>`). The OSS client falls back to local URLs
when env vars are missing, so the dev loop never blocks on cloud setup.

## Fallback recording
If a live run fails (selectors changed, network blip, agent loops), the flow
catches the exception and yields from `replay_recording()` instead. Recordings
live in `recordings/{flow}_happy_path.json` as a list of `{ description,
screenshotUrl }` entries. Re-record after every meaningful change.

The hardcoded placeholder URLs in the seed recordings should be replaced with
real captures from a successful live run before 6PM Saturday.

## Run

```
cd services/browser-agent
uv sync
uv run python -m playwright install chromium
uv run python -m src.server
```

Service on :5001. Headed browser in dev (set `HEADLESS=0`, the default),
headless in container.

For solo demos without booting orchestrator/FE:

```
# Terminal 1
cd services/mock-tng && npm run dev          # serves /grant.html, /lotus.html, /data/lotus-catalog.json

# Terminal 2
cd services/browser-agent
uv run python -m src.flows grant --mock      # cold demo, default profile
uv run python -m src.flows lotus --mock      # cold demo, default shopping list
```

## Don't
- Do not browse anywhere outside the demo target sites.
- Do not store user data in screenshots beyond what the demo needs.
- Do not run headless in dev. You need to see the browser to debug.
- Do not hardcode form values. Take them from the request payload.
- Do not let a live browser-use failure crash the run. Catch and fall back.
- Do not bypass `src/flows/types.py` validation by constructing internal-only
  call paths. Every caller routes through the Pydantic models.
