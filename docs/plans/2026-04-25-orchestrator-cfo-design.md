# Orchestrator CFO design

> **Historical record (2026-04-25).** Captures the original CFO upgrade design. **Subsequently superseded in part:** the `analyzeStock` tool and all stock data have been removed (CFO does not track inventory; resupply is dialog-driven via `suggestSupplyRun({items})`). Treat this doc as the rationale for the cashflow/runway/grants spine. For current tool inventory and prompt rules, read `IMPLEMENTATION.md` and `apps/orchestrator/src/agent/prompts.ts`.

## Context

The orchestrator originally exposed five tools: `readSales`, `readStock`, `matchGrants`, `runProcurementAgent`, `runGrantAgent`. The first two were thin pass-throughs to mock-tng. The agent answered narrowly when asked but did not behave like the personal CFO promised in `CONTEXT.md`. This design upgrades the orchestrator into a true accountant-grade brain that surfaces cashflow visibility, anticipates problems before they happen, and offers honest advice grounded in measured data. The grant flow remains the live demo hero. Lane C has since shipped live browser integration; the orchestrator exposes both `suggestSupplyRun` (default safe handoff) and `runProcurementAgent` (opt-in live Lotus path) as a result.

The change is additive on the agent loop and architecture. All new capability lives in tool handlers, alert thresholds, and prompt rules. No new services, no new patterns.

## Scope

In:
- Replace `readSales` and `readStock` with analytical equivalents that return derived insights, not raw rows.
- Add four new tools: `analyzeRevenue`, `analyzeStock`, `analyzeRunway`, `suggestSupplyRun`.
- Add `monthlyCostsRm` to `MerchantProfile`.
- Add `supply_list` to the `AgentEvent.handoff.kind` enum and a matching frontend card.
- Add a per-session alert gate so threshold-triggered nudges never repeat in one session.
- Fix the multi-turn memory bug so the LLM remembers tool results across user turns.
- Add six new system prompt rules for empathy, scope discipline, verification, pronoun resolution, language matching, and stock specificity.

Out:
- Live procurement via Lane C (now opt-in via prompt rule, default is the supply-list handoff card).
- Menu profitability, pricing advice, marketing, expansion advice (consultant scope, not accountant).
- Tax or SST guidance.
- Forecasting beyond the next week.
- Voice or audio output.

## Architecture changes

The agent loop in `apps/orchestrator/src/agent/core.ts` does not change in shape. Tools dispatch sequentially, the LLM still routes via tool descriptions, SSE plumbing is untouched. What changes:

| Layer | Change |
| --- | --- |
| `packages/shared/src/contracts.ts` | New `Alert` schema. `MerchantProfile` gains `monthlyCostsRm`. `AgentEvent.handoff.kind` gains `'supply_list'`. |
| `apps/orchestrator/src/agent/memory.ts` | Replaced. New `Session` type stores full `LLMMessage[]` plus a `firedAlerts: Set<string>`. |
| `apps/orchestrator/src/agent/thresholds.ts` | New. Single config file for all numeric thresholds. |
| `apps/orchestrator/src/agent/prompts.ts` | Six new rules added (see below). Tool list updated. |
| `apps/orchestrator/src/agent/toolSchemas.ts` | Two schemas removed, four added. Total 7. |
| `apps/orchestrator/src/tools/` | `readSales.ts` and `readStock.ts` deleted. `analyzeRevenue.ts`, `analyzeStock.ts`, `analyzeRunway.ts`, `suggestSupplyRun.ts` added. `registry.ts` updated. |
| `apps/orchestrator/src/tools/registry.ts` | `ToolHandler` signature gains an `alertGate` callback in its context. |
| `services/mock-tng/src/data/profile.json` (Lane D) | Adds realistic `monthlyCostsRm` for Mak Cik. |
| `apps/web/src/components/handoff/SupplyListHandoff.tsx` (Lane A) | New green card for `kind: 'supply_list'`. |

## Contract changes

```typescript
// packages/shared/src/contracts.ts

// Returned by analytical tools. Language-agnostic. The LLM phrases the alert
// in the user's input language using `kind` plus `context`.
export const Alert = z.object({
  kind: z.string(),
  urgency: z.enum(['info', 'warn', 'critical']),
  context: z.record(z.union([z.string(), z.number()])).optional(),
});
export type Alert = z.infer<typeof Alert>;

// MerchantProfile gains:
monthlyCostsRm: z.object({
  rent: z.number(),
  utilities: z.number(),
  gas: z.number(),
  other: z.number(),
}),

// AgentEvent.handoff.kind enum extends to:
kind: z.enum(['payment', 'review_submit', 'email', 'supply_list']),
```

## Tool inventory

Seven tools. Three kept, two replaced, two added net.

### `analyzeRevenue(period)` (replaces `readSales`)

Description for the LLM: analyze merchant revenue for a period. Use when she asks about jualan, revenue, business, today, this week, or this month.

Input: `{ period: 'today' | '7d' | '30d' | 'mtd' }`

Output:
```typescript
{
  period: string;
  totalRm: number;            // measured, safe to surface
  count: number;              // measured, safe to surface
  avgTicketRm: number;        // measured, safe to surface
  trendVsPriorPct: number;    // measured, safe to surface
  byDayOfWeek: Record<string, { totalRm: number; count: number }>;
  peakHours: number[];        // top 3 hours
  alerts: Alert[];
}
```

Alert kinds: `weekly_dip_above_5pct`, `unusual_quiet_day`, `unusual_high_ticket`.

### `analyzeStock()` (replaces `readStock`)

Description: get stock levels with qualitative urgency band per item plus alerts. Use when she asks about stok, barang, restock, or what is running out.

Output:
```typescript
{
  items: Array<{
    name: string;
    unit: string;
    currentQty: number;                          // OK to mention as approx
    urgency: 'ok' | 'low' | 'critical';          // qualitative, derived from internal daysLeft
  }>;
  alerts: Alert[];
}
```

Internal computation uses `daysLeft = currentQty / (weeklyUsage / 7)` but never surfaces the number. Alert kinds: `stockout_within_3_days`, `stale_stock`.

### `analyzeRunway()` (new)

Description: compute cashflow position. Use when she asks about cashflow, untung, kos, or whether the business is healthy.

Output:
```typescript
{
  weeklyInflowRm: number;        // measured, safe to surface
  weeklyFixedCostRm: number;     // estimated, do not surface
  weeklySupplyCostRm: number;    // estimated, do not surface
  weeklyNetRm: number;           // estimated, do not surface
  runwayWeeks: number;           // estimated, do not surface
  breakevenRevenueRm: number;    // estimated, do not surface
  profitEstimate: 'comfortable' | 'tight' | 'losing';   // qualitative band, safe to surface
  alerts: Alert[];
}
```

Profit band rules:
- `comfortable` if `weeklyNet > 0.3 * weeklyInflow`
- `tight` if `0 <= weeklyNet <= 0.3 * weeklyInflow`
- `losing` if `weeklyNet < 0`

Alert kinds: `runway_below_4_weeks`, `negative_weekly_margin`.

### `suggestSupplyRun()` (new, emits handoff)

Description: build a draft shopping list. Use when she asks about restock, beli barang, or after `analyzeStock` flags critical urgency.

Output to LLM:
```typescript
{
  items: Array<{
    name: string;
    suggestedQty: number;
    unit: string;
    costRm: number;             // approx, framed as "lebih kurang"
    urgency: 'critical' | 'low';
  }>;
  totalCostRm: number;          // approx
  alerts: Alert[];
}
```

Side effect (yielded mid-execution):
```typescript
{
  type: 'handoff',
  kind: 'supply_list',
  payload: {
    items: [...],
    totalCostRm: number,
    lotusUrl: 'https://www.lotuss.com.my/',
  },
}
```

`suggestedQty` defaults to `weeklyUsage` (one week of cover).

### Kept unchanged

- `matchGrants()`
- `runGrantAgent(grantId)` (hero flow)
- `runProcurementAgent(items)` (Lane C live Lotus path; the prompt routes here only when Mak Cik explicitly opts in)

## Alert taxonomy and gate

All alert kinds:
```
analyzeRevenue:   weekly_dip_above_5pct, unusual_quiet_day, unusual_high_ticket
analyzeStock:     stockout_within_3_days, stale_stock
analyzeRunway:    runway_below_4_weeks, negative_weekly_margin
```

`suggestSupplyRun` reuses `stockout_within_3_days` so it does not double-fire if `analyzeStock` already mentioned it that session.

Gate key: `${kind}:${context.item ?? ''}`. So:
- Two different items can both fire the same kind in one session (daging then santan).
- The same item cannot fire the same kind twice in one session.
- Item-less alerts (runway, revenue) fire at most once per session.
- A new `sessionId` resets the gate.

## Memory fix

Replace `memory.ts`. Persist the full `LLMMessage[]` per session so tool_use and tool_result blocks survive across user turns. Required for pronoun resolution ("yang tu lah") and follow-through ("okay buatkan").

```typescript
// memory.ts
type Session = {
  messages: LLMMessage[];
  firedAlerts: Set<string>;
};
const sessions = new Map<string, Session>();

export const getSession = (id: string): Session => {
  let s = sessions.get(id);
  if (!s) {
    s = { messages: [], firedAlerts: new Set() };
    sessions.set(id, s);
  }
  return s;
};

export const setMessages = (id: string, messages: LLMMessage[]): void => {
  getSession(id).messages = messages;
};
```

`agent/core.ts` rehydrates at the top of `runAgent` and persists at the bottom. The synthetic `appendTurn` and `Turn` types are deleted.

`ToolHandler` signature gains `alertGate`:
```typescript
export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: {
    sessionId: string;
    alertGate: (alert: Alert, dedupeKey: string) => boolean;
  },
) => AsyncGenerator<AgentEvent, unknown, void>;
```

Tools build raw alerts then filter through `ctx.alertGate(alert, alert.context?.item ?? '')` before returning.

## System prompt updates

Six new rules to add to `apps/orchestrator/src/agent/prompts.ts`:

1. Empathy first. If she expresses frustration (penat, susah, tak guna), validate in one sentence before any tool call.
2. Stay in accountant lane. Strategy questions (open new shop, hire, marketing, menu changes, pricing) get a polite defer and an offer to show financial summary.
3. Gently verify. If she states a fact a tool can verify, call the tool and reconcile rather than agreeing or contradicting.
4. Pronoun resolution. Anchor "yang tu" or "yang ni" to prior tool results. If ambiguous, ask which one.
5. Language match. Mirror her register. Mostly Bahasa input means Bahasa-Inggeris reply. English input means English with light Malay flavour. Mirror code-switching.
6. Tiered stock specificity. If 1 critical stock item, name it. If 2, name both. If 3 or more, say "ada beberapa barang" and offer to show the list. Always offer to call `suggestSupplyRun` afterward.

Plus the existing tool inventory, persona, no-em-dashes, no-jargon rules stay.

Plus a tool-specific rule for `analyzeRunway`: only `weeklyInflowRm` and `profitEstimate` are safe to surface. Never quote `weeklyNet`, `runwayWeeks`, `breakevenRevenueRm`, or any monthly cost amount.

Plus a Supply run path rule: default to `suggestSupplyRun` (safe handoff card). Call `runProcurementAgent` only when Mak Cik explicitly says "open Lotus", "order live", "buka cart", or similar. Lane C is shipped, so live procurement is reachable on demand.

Plus alert intent reference (so the LLM knows what each kind means without us coding translations):
```
weekly_dip_above_5pct  -> weekly revenue down >5% vs prior week
unusual_quiet_day      -> today is quieter than usual for this day-of-week
unusual_high_ticket    -> a transaction unusually larger than typical today
stockout_within_3_days -> item in context.item will run out very soon
stale_stock            -> item in context.item moves slowly, large idle stock
runway_below_4_weeks   -> cashflow runway is tight
negative_weekly_margin -> weekly outflow exceeds inflow
```

## Thresholds

```typescript
// apps/orchestrator/src/agent/thresholds.ts
export const THRESHOLDS = {
  weeklyDipPct:          0.05,
  unusualQuietDayPct:    0.20,
  unusualHighTicketRm:   60,
  stockoutWithinDays:    3,
  staleBurnDays:         28,
  runwayBelowWeeks:      4,
};
```

All tools import from this file. Tuning is one edit, no grep.

## Frontend dependencies (Lane A)

Two changes, both small:

1. New component `apps/web/src/components/handoff/SupplyListHandoff.tsx`. Renders a green-bordered card from `payload: { items, totalCostRm, lotusUrl }`. Items as a checkbox list with item name, suggested qty plus unit, and cost. Total at the bottom. "Buka Lotus" button as an `<a target="_blank">` to `lotusUrl`. Wire it into `HandoffCard.tsx`'s switch.

2. Optional starter chips below the greeting in `ChatWindow.tsx`. Three example questions ("Macam mana business minggu ni?", "Stok cukup tak?", "Ada grant untuk saya?") that fill the input on click. Avoids cold-start empty room.

Tell Lane A in chat with the handoff payload shape and the chip texts.

## Mock data dependencies (Lane D)

One change to `services/mock-tng/src/data/profile.json`:
```json
"monthlyCostsRm": {
  "rent": 800,
  "utilities": 200,
  "gas": 350,
  "other": 300
}
```

Numbers are illustrative. Lane D refines if they have better estimates.

The runtime parser in `services/mock-tng/src/routes.ts:11` already validates the profile JSON via `MerchantProfile.parse(profile)`. With the contract change, mock-tng will refuse to boot until the JSON is updated. Fail-fast is correct.

Lane D also updates `pitch/deck.md` slide 4 and `pitch/demo-runbook.md` to reframe the procurement step as a supply-list handoff (not live browser) for the demo, with the live-browser version mentioned as the next milestone.

## Error handling

Four layers, each with a clear policy. All preserve the rule that no tool failure crashes the demo.

1. Tool throws: caught by the `try/catch` in `agent/core.ts`. Yields `error` event to frontend, pushes error string into `tool_result` so Claude sees it and writes a friendly recovery line.
2. LLM stream fails (auth expired, network blip): caught by the outer `try/catch`. Yields `error` plus `done`.
3. Contract drift: mock-tng fails to boot via `MerchantProfile.parse`. Loud, immediate.
4. Tool returns wrong shape: not validated at runtime in v1. The tool is our code; treat as a unit-test concern.

## Testing approach

| Layer | What | Where | Cost |
| --- | --- | --- | --- |
| Per-tool smoke | Each handler called directly with thresholds tuned to fire each alert kind. Asserted against expected output shape. | `scripts/smoke-tools.ts`, run with `tsx`. | ~30 min |
| Curl-driven integration | `POST /chat` with the runbook scenarios. SSE event types verified in order. | `scripts/smoke-chat.sh`. | ~30 min |
| Demo runbook (manual) | `pitch/demo-runbook.md` end-to-end via the chat UI. Run every two hours after the 6 PM gate per `PLAN.md`. | Already in place. | 0 |

Negative checks once before the demo:
- Grep transcripts for forbidden tokens (`\d+\.\d+\s*hari`, `RM\s*\d+\s*/(week|month|wk)` in chat output).
- One full runbook pass with `LLM_PROVIDER=bedrock` to validate the multi-cloud path.

No formal test framework. Smoke scripts are throwaway. Out of scope for the demo window.

## Build order

Roughly five hours of focused orchestrator work, with Lane A and Lane D doing their pieces in parallel.

```
T+0:00  [orchestrator] Memory fix in memory.ts                              30 min
T+0:30  [orchestrator] thresholds.ts                                        15 min
T+0:45  [shared]       Contract changes (Alert, monthlyCostsRm,             15 min
                       supply_list handoff kind)
T+1:00  [chat]         Tell Lane A: SupplyListHandoff + starter chips        -
        [chat]         Tell Lane D: monthlyCostsRm + deck/runbook update     -
T+1:00  [orchestrator] Implement 4 new tools and delete the 2 old ones      ~3 hours
T+4:00  [orchestrator] Update prompts.ts with the 6 new rules,              20 min
                       runaway tool rule, runProcurementAgent rule,
                       and alert intent reference
T+4:20  [smoke]        Run smoke-tools and smoke-chat                       40 min
T+5:00  Done. Hand back to Lane A for visual polish.
```

Memory fix must land first. Without it, the supply-run-after-suggestion flow ("okay buatkan") fails and most multi-turn dry runs degrade.

## Out of scope

- Menu profitability, pricing, marketing, expansion advice
- Tax or SST guidance
- Forecasting beyond next week
- Voice or audio output
- Vector DB for grants (rule-based stays)
- Persistent storage beyond the in-memory session map
- Real authentication or TNG eWallet integration
- Lotus cart pre-fill (Lane C ships the live browser integration; cart pre-fill is a follow-up if needed)

## Verification

End-to-end checklist after implementation:

1. `npm install` at repo root succeeds.
2. `cd services/mock-tng && npm run dev` boots without contract errors. The new `monthlyCostsRm` field is required.
3. `cd apps/orchestrator && LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run dev` listens on `:4000`.
4. `curl -N -X POST http://localhost:4000/chat -H 'Content-Type: application/json' -d '{"sessionId":"test","message":"macam mana cashflow hari ni?"}'` streams SSE frames. Expected sequence: `text` deltas, two or more `tool_call` events (`analyzeRunway`, `analyzeStock`), corresponding `tool_result` events, more `text` deltas mentioning the daging stockout in Bahasa-Inggeris with no day count, `done`.
5. Multi-turn smoke: in the same session, send "okay buatkan". Expect `tool_call(suggestSupplyRun)`, a `handoff` event with `kind: 'supply_list'`, and a chat reply. The agent should not re-call `analyzeStock` because memory persisted.
6. Edge-case smoke: send "tak guna lah business ni". Expect a validating reply with no tool call.
7. Edge-case smoke: send "boleh saya buka kedai baru?". Expect a polite defer with an offer to show financial summary.
8. Frontend smoke: open `http://localhost:3000` and walk `pitch/demo-runbook.md` end to end. The grant flow (steps 5 and 7) must still pass unchanged.
9. Negative grep: pipe the chat transcripts through a regex check for forbidden tokens. Should be empty.

If all nine pass, ship.
