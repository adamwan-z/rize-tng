# TNG Rise

> Hackathon project. Speed and the working demo come first. Read `CONTEXT.md` and `PLAN.md` before doing anything substantive.

## What this is

A personal CFO agent for Malaysian micro F&B merchants on TNG eWallet. Built for the TNG Digital hackathon. Theme: financial inclusion. Hero demo is a live BrowserUse agent that fills a Malaysian SME grant application end-to-end. Full background in `CONTEXT.md`.

## Read these before working

## Foundational Principles

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

| File | Read it for |
| --- | --- |
| `CONTEXT.md` | Persona, problem, hackathon constraints, decisions already made |
| `PLAN.md` | Phased build plan with time gates, runbook, risk register |
| `IMPLEMENTATION.md` | Per-lane build spec. Read your lane's section. |
| `<your-lane>/CLAUDE.md` | Lane-specific conventions, files you own, how to run |

## Repo layout

```
apps/
  web/           Lane A: React chat UI
  orchestrator/  Lane B: Agent core, LLM, tool dispatching
services/
  browser-agent/ Lane C: Python BrowserUse runner
  mock-tng/      Lane D: Mock TNG merchant API
packages/
  shared/        Shared TS types and Zod schemas (THE contract)
  grants-kb/     Curated grant data (5 real Malaysian grants)
infra/           Docker, multi-cloud setup notes
docs/            Architecture, multi-cloud rationale, persona
pitch/           Deck, demo runbook, OBS fallback recording
```

## Lane ownership

Each lane has a folder. Do not write code outside your lane. If you need a contract, define it in `packages/shared` and tell the consumer in chat.

| Lane | Owner folder | Deliverable |
| --- | --- | --- |
| A: Frontend | `apps/web/` | Chat UI, browser viewport, polish, OBS recording |
| B: Orchestrator | `apps/orchestrator/`, `packages/shared/` | LLM client, agent loop, tool registry, SSE |
| C: Browser agent | `services/browser-agent/` | Playwright + browser-use flows |
| D: Data + infra | `services/mock-tng/`, `packages/grants-kb/`, `infra/`, `docs/`, `pitch/` | Mocks, KB, Docker, multi-cloud, deck stats |

## Conventions

- **TypeScript everywhere except the browser agent (Python).** Strict mode on. No `any` without a comment explaining why.
- **No em dashes in any user-facing copy or docs.** Use periods, commas, or new sentences. House style.
- **No double negatives.** Use positive framing.
- **Mock data is realistic.** Malaysian names, KL addresses, RM amounts, real grant names. No "John Doe", no "$100".
- **Chat copy is friendly Bahasa-Inggeris.** Drop in occasional Malay words ("alamak", "boleh", "macam mana"). Never use slang you are unsure about.
- **Imports come from `@tng-rise/shared`.** Do not duplicate types across services.
- **Brand and visual tokens come from `apps/web/public/design-system.html`.** Lane A pulls colors, type, and component patterns from there. Pitch lifts type and palette from the same file.
- **Tool errors do not crash the demo.** Wrap in try/catch and surface to the chat as a friendly message ("alamak, saya tak boleh buka Lotus sekarang"). Log the real error.
- **No scope creep.** Anything outside `IMPLEMENTATION.md` requires team consensus.

## Commands

```bash
# Run everything
docker compose up

# Run one service in dev
cd apps/web && npm run dev                    # :3000
cd apps/orchestrator && npm run dev           # :4000
cd services/browser-agent && uv run python -m src.server   # :5001
cd services/mock-tng && npm run dev           # :5000

# Type check shared contracts
cd packages/shared && npm run typecheck

# Run the demo runbook (manual)
# Open http://localhost:3000 and follow pitch/demo-runbook.md
```

## Hard rules

1. **Never fake a tool call.** If the LLM is supposed to call `matchGrants`, it must actually call the function. Theatre fails when judges ask how it works.
2. **Never break the live demo path for a refactor.** The runbook in `pitch/demo-runbook.md` must pass at all times after the 6PM Saturday gate.
3. **Never commit secrets.** AWS, Alibaba, Anthropic keys live in `.env` (gitignored). Document required keys in `.env.example`.
4. **Never block another lane.** If a contract is unclear, mock it on your side, post the question in chat. Lane B resolves contract conflicts.

## When stuck

- Type-level confusion: `packages/shared/src/contracts.ts` is the source of truth
- "Does this fit?": check `IMPLEMENTATION.md` for your lane
- "Are we still on track?": check `PLAN.md` time gates
- "What is this for?": re-read `CONTEXT.md`
