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
- **Chat copy default register is friendly Bahasa-Inggeris** (the demo persona Mak Cik's voice). Drop in occasional Malay words ("alamak", "boleh", "macam mana"). The orchestrator mirrors the user's input language — English, Mandarin (普通话), or any Claude-supported language — so static FE chrome (Greeting, button labels) stays in BM but agent chat replies adapt. Never use slang you are unsure about.
- **Imports come from `@tng-rise/shared`.** Do not duplicate types across services.
- **Brand and visual tokens come from `apps/web/public/design-system.html`.** Lane A pulls colors, type, and component patterns from there. Pitch lifts type and palette from the same file.
- **Tool errors do not crash the demo.** Wrap in try/catch and surface to the chat as a friendly message ("alamak, saya tak boleh buka Lotus sekarang"). Log the real error.
- **No scope creep.** Anything outside `IMPLEMENTATION.md` requires team consensus.

## Commands

```bash
# Boot all 3 TS services in one terminal (mock-tng + orchestrator + web)
npm run dev

# Same plus the Python browser-agent (requires uv + playwright installed)
npm run dev:full

# Or boot each individually
npm run dev:mock-tng        # :5050
npm run dev:orchestrator    # :4000
npm run dev:web             # :3000
npm run dev:browser-agent   # :5001

# Production-style path (Docker images)
docker compose up

# Type check shared contracts
cd packages/shared && npm run typecheck

# Run the demo runbook (manual)
# Open http://localhost:3000 and follow pitch/demo-runbook.md
```


## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `.claude/tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First**: Write plan to `.claude/tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `.claude/tasks/todo.md`
6. **Capture Lessons**: Update `.claude/tasks/lessons.md` after corrections

---

## Pattern Files

Patterns are organized by domain in `.claude/patterns/`:

```
patterns/
├── frontend/     # DataTables, Dialogs, Page Layout, Schemas
├── backend/      # Domain Structure, Routes, Migrations, Testing
└── shared/       # Pull Requests
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
