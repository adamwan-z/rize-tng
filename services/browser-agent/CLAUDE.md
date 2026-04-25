# Lane C: Browser agent

You are building the browser automation service for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane C section of `/IMPLEMENTATION.md`.

## Tech
Python 3.12, FastAPI, browser-use, Playwright Chromium. Use `uv` for deps.

## Files you own
Everything under `services/browser-agent/`.

## Flows
Two flows: `lotus_procurement` and `grant_application`. Implement grant first. It is the hero.

## Streaming format
JSON-lines (newline-delimited JSON), one event per line. Each event is `{ runId, step, description, screenshotUrl? }`. The orchestrator parses line-by-line and forwards as `browser_step` AgentEvents to the frontend.

## Stable selectors
Prefer `data-testid` if available. Otherwise text content (`page.get_by_text`). Avoid CSS class selectors that look auto-generated. Document every selector in `src/lib/selectors.py` with `last_verified` set to the date you last confirmed it works.

## Storage
Upload screenshots to Alibaba OSS in production. Bucket: `tng-rise-screenshots`, region `ap-southeast-3` (KL). In dev, write to `./screenshots/` and serve via FastAPI static (`/screenshots/<file>`). The OSS client falls back to local URLs when env vars are missing, so the dev loop never blocks on cloud setup.

## Fallback recording
If browser-use fails (selectors changed, model loops, network blip), `flows/*` catch the exception and yield from `replay_recording()` instead. Recordings live in `recordings/{flow}_happy_path.json` as a list of `{ description, screenshotUrl }` entries. Keep the recordings recent: re-record after every meaningful change to the live flow.

The hardcoded placeholder screenshot URLs in the seed recordings should be replaced with real captures from a successful live run before 6 PM Saturday.

## Run
```
cd services/browser-agent
uv sync
uv run python -m playwright install chromium
uv run python -m src.server
```

Service on :5001. Headed browser in dev (set `HEADLESS=0`, the default), headless in container.

## Don't
- Do not browse anywhere outside the demo target sites.
- Do not store user data in screenshots beyond what the demo needs.
- Do not run headless in dev. You need to see the browser to debug.
- Do not hardcode form values. Take them from the request payload.
- Do not let a live browser-use failure crash the run. Catch and fall back.
