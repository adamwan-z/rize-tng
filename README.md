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
