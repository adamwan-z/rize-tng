# Plan

> Walking-skeleton approach. End-to-end works by hour 3, fakely. Each lane swaps in real implementation behind locked contracts. The demo runbook is your continuous test suite.

## Time gates

| Time | Gate | Pass condition |
| --- | --- | --- |
| **3:00 PM Sat** | Repo live | All 4 lanes have cloned and read `CONTEXT.md`, `PLAN.md`, their `IMPLEMENTATION.md` section |
| **4:30 PM Sat** | Skeleton up | `docker compose up` runs all 4 services, frontend can call all backends, all return mocks |
| **6:00 PM Sat** | Vertical slice | Runbook steps 1 to 3 pass (greeting, today's revenue, plain-language summary). Real LLM behind it. |
| **10:00 PM Sat** | First check-in | Procurement flow happy path works (live BrowserUse on Lotus, hand-off card renders). Or cut. |
| **1:00 AM Sun** | Grant flow works | Runbook step 5 passes (grant match, BrowserUse fills target portal, stops at Submit). **THIS IS THE HERO.** |
| **3:00 AM Sun** | LLM swap test | Full runbook passes with `LLM_PROVIDER=bedrock`. Multi-cloud validated. |
| **4:00 AM Sun** | OSS integration | Screenshots from BrowserUse runs land in Alibaba OSS. Confirm by pulling one. |
| **5:00 AM Sun** | OBS fallback recorded | 90-second clean recording of full runbook saved locally on demo laptop. |
| **7:00 AM Sun** | **Feature freeze** | Bug fixes only. No new code. |
| **8:00 AM Sun** | Pitch dry run | Run on demo laptop with venue WiFi if possible. |

## Walking skeleton (phase 1, by 4:30 PM)

By 4:30 PM Saturday, this works end-to-end with fake brains:

1. User opens `http://localhost:3000`
2. Types "show me today's revenue"
3. Frontend `POST`s to orchestrator `/chat` (real endpoint)
4. Orchestrator returns a hardcoded `AgentEvent` stream (no LLM yet)
5. Frontend renders the stream as if it were live

Every node is fake. The pipes are real. From here, lanes swap in real logic behind the contracts in `packages/shared/src/contracts.ts`.

## Phase order

1. **Skeleton** (3 PM to 4:30 PM): contracts locked, Docker Compose running, hello-world from each service, frontend renders mock stream
2. **Vertical slice** (4:30 PM to 6 PM): real LLM in orchestrator, real mock TNG data, one tool (`analyzeRevenue`) wired end-to-end
3. **Tool implementations** (6 PM to 1 AM): all tools wired, both BrowserUse flows working
4. **Model swap and multi-cloud** (1 AM to 4 AM): Bedrock validated, OSS integration, optional Qwen for Malay copy
5. **Polish and record** (4 AM to 7 AM): UI polish, deck, runbook recording
6. **Pitch** (7 AM to 8 AM): freeze, dry run, breakfast, go

## Demo runbook

This is your continuous test. Run it every 2 hours after the 6 PM gate.

```
1. Open http://localhost:3000
2. Greeting card appears with Mak Cik's name
3. Type: "Macam mana business hari ni?"
   → Expect: revenue card showing today's RM amount, 7-day trend, plain-language summary in <5s
4. Type: "Ada grant untuk saya?"
   → Expect: agent calls matchGrants, returns 2-3 matched grants with eligibility reasons
5. Reply: "Yang TEKUN tu lah" (or click a grant card)
   → Expect: agent says "ok let me apply for you", opens browser viewport
   → Browser opens grant portal, navigates to application form
   → Agent types into fields one by one, visible in viewport
   → Stops before Submit. Hand-off card appears: "Sila semak dan submit di sini"
6. Click "Take over" → real tab opens with form pre-filled (or screenshot if cross-origin blocks the autofill handoff)
```

If a step fails, the lane that owns that step pauses other work and fixes it. Nothing else ships until the runbook passes again.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Demo grant portal changes overnight | Lane C tests against the actual demo target by 6 PM. Has Playwright-scripted fallback that replays recorded actions from a working run. |
| BrowserUse flaky during live demo | OBS recording is the cut-to-tape fallback. Runbook practiced 3+ times. |
| Bedrock auth fails on demo day | Flip `LLM_PROVIDER=anthropic`. Demo runs on Anthropic API. Multi-cloud story shifts to "we deployed on both, demo'd on Anthropic for resilience". |
| Demo laptop misbehaves | All services run locally, no internet dependency except LLM API. Tether to phone hotspot if venue WiFi dies. |
| Integration drift between lanes | Walking skeleton plus runbook every 2 hours catches drift in under 2 hours. |
| Scope creep at 11 PM ("what if we added X?") | Hard rule in `CLAUDE.md`: nothing outside `IMPLEMENTATION.md` without team consensus. |
| Lane C blocked because real portal does not cooperate | Lane D builds a local replica grant portal as static HTML, served from mock-tng. Honest framing for judges: "this is illustrative of the MARA application form". |

## What we do not do

- Ship code that does not pass the runbook
- Merge anything to `main` without the originating lane confirming the runbook still passes
- Add a new tool, endpoint, or screen after 1 AM Sunday
- Refactor after 7 AM Sunday
- Demo on a laptop the team has not tested on
