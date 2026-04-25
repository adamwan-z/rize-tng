# Orchestrator CFO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the orchestrator from 5 thin tools to 7 analytical tools so the agent behaves as a personal accountant for Mak Cik, with cashflow visibility, threshold-based proactive nudges, supply-list handoff, multi-turn memory, and 6 new prompt rules.

**Architecture:** Single agent loop unchanged. Replace `readSales` and `readStock` with `analyzeRevenue` and `analyzeStock`. Add `analyzeRunway` and `suggestSupplyRun`. Persist full `LLMMessage[]` per session for tool memory. Emit `supply_list` handoff card. All numeric thresholds in one config file. Estimated metrics surfaced as qualitative bands only, never as fake-precision numbers. Hero grant flow untouched.

**Tech Stack:** TypeScript strict, Hono, Zod, Anthropic SDK, AWS Bedrock SDK. The orchestrator runs via `tsx watch`. No new dependencies.

**Reference:** Full design at `docs/plans/2026-04-25-orchestrator-cfo-design.md`.

---

## Pre-flight

### Task 0: Install dependencies and confirm baseline

**Files:**
- None to modify, just verify environment.

**Step 1: Install all workspace deps**

Run: `npm install`
Expected: Resolves all workspaces. No errors. `node_modules/` populated at root and in each workspace.

**Step 2: Verify baseline typecheck passes**

Run: `npm run typecheck`
Expected: All workspaces pass. If any pre-existing TypeScript errors appear, stop and ask the user — do not modify pre-existing code.

**Step 3: Verify mock-tng boots**

Run: `cd services/mock-tng && npm run dev` (in a background terminal)
Expected: `mock-tng listening on :5050`. Hit `curl http://localhost:5050/health` and confirm `{"ok":true,"service":"mock-tng"}`. Kill the process when done.

**Step 4: No commit needed** (no code changes).

---

## Phase 1: Contract changes

### Task 1: Add `Alert` schema to shared contracts

**Files:**
- Modify: `packages/shared/src/contracts.ts` (append after existing exports)

**Step 1: Write the new schema**

At the bottom of `packages/shared/src/contracts.ts`, append:

```typescript
// ===== Alerts =====
//
// Returned by analytical tools (analyzeRevenue, analyzeStock, analyzeRunway,
// suggestSupplyRun). Language-agnostic: the LLM phrases the alert in the
// user's input language using `kind` and `context`. Never includes numbers
// derived from estimated data (no daysLeft, no runway weeks).
export const Alert = z.object({
  kind: z.string(),
  urgency: z.enum(['info', 'warn', 'critical']),
  context: z.record(z.union([z.string(), z.number()])).optional(),
});
export type Alert = z.infer<typeof Alert>;
```

**Step 2: Verify typecheck**

Run: `cd packages/shared && npm run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add packages/shared/src/contracts.ts
git commit -m "Add Alert schema to shared contracts"
```

---

### Task 2: Add `monthlyCostsRm` to `MerchantProfile`

**Files:**
- Modify: `packages/shared/src/contracts.ts` (the `MerchantProfile` block)

**Step 1: Add field to the schema**

Find the `MerchantProfile` definition. Add `monthlyCostsRm` as a required field:

```typescript
export const MerchantProfile = z.object({
  id: z.string(),
  name: z.string(),
  businessName: z.string(),
  businessType: z.string(),
  location: z.object({ city: z.string(), state: z.string() }),
  registeredSince: z.string(),
  ssm: z.string().optional(),
  monthlyRevenueRm: z.number(),
  monthlyCostsRm: z.object({
    rent: z.number(),
    utilities: z.number(),
    gas: z.number(),
    other: z.number(),
  }),
});
```

**Step 2: Verify the package still typechecks (no consumers updated yet)**

Run: `cd packages/shared && npm run typecheck`
Expected: PASS.

**Step 3: Verify mock-tng now FAILS to boot (expected)**

Run: `cd services/mock-tng && npm run dev`
Expected: Server crashes with a Zod parse error mentioning `monthlyCostsRm`. This proves the contract is enforced. Kill the process.

**Step 4: Commit (intentionally leaves mock-tng broken until Task 3)**

```bash
git add packages/shared/src/contracts.ts
git commit -m "Add monthlyCostsRm to MerchantProfile contract"
```

---

### Task 3: Update mock-tng profile JSON to satisfy new contract

**Files:**
- Modify: `services/mock-tng/src/data/profile.json`

**Step 1: Add the field**

Open `services/mock-tng/src/data/profile.json` and add `monthlyCostsRm`:

```json
{
  "id": "mak-cik-aminah-001",
  "name": "Aminah binti Hassan",
  "businessName": "Nasi Daging Salai Mak Cik",
  "businessType": "Hawker F&B (Malay cuisine)",
  "location": {
    "city": "Kampung Baru, Kuala Lumpur",
    "state": "Wilayah Persekutuan Kuala Lumpur"
  },
  "registeredSince": "2024-03-12",
  "ssm": "JM0823491-W",
  "monthlyRevenueRm": 14800,
  "monthlyCostsRm": {
    "rent": 800,
    "utilities": 200,
    "gas": 350,
    "other": 300
  }
}
```

**Step 2: Verify mock-tng now boots**

Run: `cd services/mock-tng && npm run dev`
Expected: `mock-tng listening on :5050`.

**Step 3: Verify the field is served**

Run (in another terminal): `curl http://localhost:5050/merchant`
Expected: JSON includes `"monthlyCostsRm": { "rent": 800, ... }`.
Kill mock-tng.

**Step 4: Commit**

```bash
git add services/mock-tng/src/data/profile.json
git commit -m "Add monthlyCostsRm to Mak Cik profile data"
```

---

### Task 4: Add `supply_list` to `AgentEvent.handoff.kind` enum

**Files:**
- Modify: `packages/shared/src/contracts.ts` (the `AgentEvent` discriminated union)

**Step 1: Extend the enum**

In the `handoff` member of the `AgentEvent` discriminated union, change:
```typescript
kind: z.enum(['payment', 'review_submit', 'email']),
```
to:
```typescript
kind: z.enum(['payment', 'review_submit', 'email', 'supply_list']),
```

**Step 2: Verify all workspaces still typecheck**

Run: `npm run typecheck`
Expected: PASS in all workspaces. If `apps/web` shows an exhaustiveness warning in `HandoffCard.tsx`, that is the expected signal that Lane A needs to add `SupplyListHandoff` (out of scope for this plan, owned by Lane A).

**Step 3: Commit**

```bash
git add packages/shared/src/contracts.ts
git commit -m "Add supply_list to handoff kind enum"
```

---

## Phase 2: Memory fix and shared infrastructure

### Task 5: Replace `memory.ts` with session store

**Files:**
- Modify: `apps/orchestrator/src/agent/memory.ts` (full replacement)

**Step 1: Replace the entire file**

Replace the contents of `apps/orchestrator/src/agent/memory.ts` with:

```typescript
import type { LLMMessage } from '../llm/client.js';

// Per-session in-memory store. Holds the full LLMMessage[] (including
// tool_use and tool_result content blocks) so multi-turn pronoun resolution
// and follow-through ("okay buatkan") work. Also holds firedAlerts so
// threshold-triggered nudges never repeat in one session.
type Session = {
  messages: LLMMessage[];
  firedAlerts: Set<string>;
};

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { messages: [], firedAlerts: new Set() };
    sessions.set(id, s);
  }
  return s;
}

export function setMessages(id: string, messages: LLMMessage[]): void {
  getSession(id).messages = messages;
}

export function alertAlreadyFired(id: string, key: string): boolean {
  return getSession(id).firedAlerts.has(key);
}

export function markAlertFired(id: string, key: string): void {
  getSession(id).firedAlerts.add(key);
}

export function clearSession(id: string): void {
  sessions.delete(id);
}
```

**Step 2: Verify orchestrator typecheck FAILS** (expected: callers in `core.ts` use the old API)

Run: `cd apps/orchestrator && npm run typecheck`
Expected: FAIL with errors about `appendTurn` / `getHistory` / `Turn` not exported. This confirms `core.ts` is the next thing to fix.

**Step 3: Commit (leaves orchestrator broken until Task 6)**

```bash
git add apps/orchestrator/src/agent/memory.ts
git commit -m "Replace memory.ts with session store (LLMMessage + firedAlerts)"
```

---

### Task 6: Update `agent/core.ts` to use new memory and pass alertGate

**Files:**
- Modify: `apps/orchestrator/src/agent/core.ts`

**Step 1: Replace the memory imports and rehydration**

In `apps/orchestrator/src/agent/core.ts`, change:

```typescript
import { appendTurn, getHistory } from './memory.js';
```

to:

```typescript
import { getSession, setMessages, alertAlreadyFired, markAlertFired } from './memory.js';
import type { Alert } from '@tng-rise/shared';
```

**Step 2: Replace the rehydration block at the top of `runAgent`**

Find:
```typescript
appendTurn(input.sessionId, { role: 'user', content: input.userMessage });

const messages: LLMMessage[] = getHistory(input.sessionId).map((t) => ({
  role: t.role,
  content: t.content,
}));
```

Replace with:
```typescript
const session = getSession(input.sessionId);
const messages: LLMMessage[] = [
  ...session.messages,
  { role: 'user', content: input.userMessage },
];

const alertGate = (alert: Alert, dedupeKey: string): boolean => {
  const key = `${alert.kind}:${dedupeKey}`;
  if (alertAlreadyFired(input.sessionId, key)) return false;
  markAlertFired(input.sessionId, key);
  return true;
};
```

**Step 3: Update the handler call site to pass alertGate**

Find:
```typescript
const generator = handler(tu.input as Record<string, unknown>, {
  sessionId: input.sessionId,
});
```

Replace with:
```typescript
const generator = handler(tu.input as Record<string, unknown>, {
  sessionId: input.sessionId,
  alertGate,
});
```

**Step 4: Replace the assistant-text persistence at the end with full message persistence**

Find:
```typescript
if (toolUses.length === 0) {
  // No tool calls means the model finished. Persist assistant turn and exit.
  if (assistantText) {
    appendTurn(input.sessionId, { role: 'assistant', content: assistantText });
  }
  yield { type: 'done' };
  return;
}
```

Replace with:
```typescript
if (toolUses.length === 0) {
  // No tool calls means the model finished. Persist the full message array
  // (including all tool_use/tool_result blocks built up across sub-turns)
  // so the next user turn has full context.
  if (assistantText) {
    messages.push({ role: 'assistant', content: assistantText });
  }
  setMessages(input.sessionId, messages);
  yield { type: 'done' };
  return;
}
```

**Step 5: Update `ToolHandler` type in `tools/registry.ts`**

In `apps/orchestrator/src/tools/registry.ts`, change:
```typescript
export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: { sessionId: string },
) => AsyncGenerator<AgentEvent, unknown, void>;
```

to:
```typescript
import type { Alert } from '@tng-rise/shared';

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: {
    sessionId: string;
    alertGate: (alert: Alert, dedupeKey: string) => boolean;
  },
) => AsyncGenerator<AgentEvent, unknown, void>;
```

**Step 6: Verify typecheck**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: PASS. (Existing tools ignore the new `alertGate` param, which is fine.)

**Step 7: Smoke test the orchestrator boots**

Run (with mock-tng running and `ANTHROPIC_API_KEY` set in env): `cd apps/orchestrator && npm run dev`
Expected: `orchestrator listening on :4000 (LLM_PROVIDER=anthropic)`.
Hit `curl http://localhost:4000/health`. Confirm `{"ok":true, ...}`. Kill the process.

**Step 8: Commit**

```bash
git add apps/orchestrator/src/agent/core.ts apps/orchestrator/src/tools/registry.ts
git commit -m "Wire memory.ts session store and alertGate into agent loop"
```

---

### Task 7: Add `thresholds.ts` config

**Files:**
- Create: `apps/orchestrator/src/agent/thresholds.ts`

**Step 1: Create the file**

```typescript
// Single source for all numeric thresholds the analytical tools use.
// Tune here, never grep handlers.
export const THRESHOLDS = {
  weeklyDipPct: 0.05,           // analyzeRevenue: weekly dip > 5% triggers alert
  unusualQuietDayPct: 0.20,     // analyzeRevenue (today only): >20% below day-of-week avg
  unusualHighTicketRm: 60,      // analyzeRevenue: a single ticket above this is flagged
  stockoutWithinDays: 3,        // analyzeStock: items with < 3 days cover are critical
  staleBurnDays: 28,            // analyzeStock: items with > 28 days cover flagged stale
  runwayBelowWeeks: 4,          // analyzeRunway: runway < 4 weeks triggers alert
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;
```

**Step 2: Verify typecheck**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add apps/orchestrator/src/agent/thresholds.ts
git commit -m "Add thresholds.ts config for analytical tools"
```

---

## Phase 3: Implement the four new tool handlers

Each tool follows the same pattern: write the handler, write a smoke check, run it, commit.

### Task 8: Implement `analyzeRevenue` (replacing `readSales`)

**Files:**
- Create: `apps/orchestrator/src/tools/analyzeRevenue.ts`
- Test (smoke): `apps/orchestrator/scripts/smoke-analyzeRevenue.ts`

**Step 1: Write the smoke check first (will fail because file does not exist)**

Create `apps/orchestrator/scripts/smoke-analyzeRevenue.ts`:

```typescript
// Smoke check: call analyzeRevenue handler directly against running mock-tng.
// Asserts shape, not specific numbers (those are seeded daily).
//
// Run with: npx tsx apps/orchestrator/scripts/smoke-analyzeRevenue.ts
// Requires mock-tng running on :5050.

import { analyzeRevenue } from '../src/tools/analyzeRevenue.js';
import type { Alert } from '@tng-rise/shared';

const noopGate = (_a: Alert, _k: string) => true;

async function run() {
  const gen = analyzeRevenue({ period: '7d' }, { sessionId: 's1', alertGate: noopGate });
  let result: unknown;
  while (true) {
    const next = await gen.next();
    if (next.done) { result = next.value; break; }
  }
  const r = result as Record<string, unknown>;
  if (typeof r.totalRm !== 'number') throw new Error('totalRm missing');
  if (typeof r.count !== 'number') throw new Error('count missing');
  if (typeof r.avgTicketRm !== 'number') throw new Error('avgTicketRm missing');
  if (typeof r.trendVsPriorPct !== 'number') throw new Error('trendVsPriorPct missing');
  if (!Array.isArray(r.alerts)) throw new Error('alerts missing');
  if (typeof r.byDayOfWeek !== 'object') throw new Error('byDayOfWeek missing');
  console.log('PASS analyzeRevenue:', JSON.stringify(r, null, 2));
}

run().catch((e) => { console.error('FAIL', e); process.exit(1); });
```

**Step 2: Run it, expect FAIL**

Run (mock-tng must be up): `cd apps/orchestrator && npx tsx scripts/smoke-analyzeRevenue.ts`
Expected: FAIL with module-not-found error for `analyzeRevenue.ts`.

**Step 3: Implement the handler**

Create `apps/orchestrator/src/tools/analyzeRevenue.ts`:

```typescript
import { env } from '../lib/env.js';
import type { Alert, Transaction } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { THRESHOLDS } from '../agent/thresholds.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const analyzeRevenue: ToolHandler = async function* (input, ctx) {
  const period = (input.period as string) ?? '7d';
  const days = period === 'today' ? 1 : period === '30d' ? 30 : period === 'mtd' ? mtdDays() : 7;

  const txs = await fetchTx(days);
  const total = sumRm(txs);
  const count = txs.length;
  const avgTicket = count > 0 ? total / count : 0;

  // Trend: compare with the immediately prior window of the same length.
  const prior = days > 1 ? await fetchTx(days * 2) : [];
  const priorOnly = prior.slice(0, prior.length - txs.length);
  const priorTotal = sumRm(priorOnly);
  const trendVsPriorPct = priorTotal > 0 ? (total - priorTotal) / priorTotal : 0;

  // By day-of-week.
  const byDayOfWeek: Record<string, { totalRm: number; count: number }> = {};
  for (const dow of DOW) byDayOfWeek[dow] = { totalRm: 0, count: 0 };
  for (const tx of txs) {
    const dow = DOW[new Date(tx.timestamp).getDay()]!;
    byDayOfWeek[dow]!.totalRm += tx.amountRm;
    byDayOfWeek[dow]!.count += 1;
  }

  // Peak hours: top 3 hours by count.
  const byHour: Record<number, number> = {};
  for (const tx of txs) {
    const h = new Date(tx.timestamp).getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
  }
  const peakHours = Object.entries(byHour)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([h]) => Number(h));

  // Build raw alerts.
  const raw: Array<{ alert: Alert; dedupeKey: string }> = [];
  if (period === '7d' && trendVsPriorPct < -THRESHOLDS.weeklyDipPct) {
    raw.push({
      alert: { kind: 'weekly_dip_above_5pct', urgency: 'warn' },
      dedupeKey: '',
    });
  }
  if (period === 'today') {
    const todayDow = DOW[new Date().getDay()]!;
    const dowAvgPriorWeeks = byDayOfWeek[todayDow]!.totalRm; // simple proxy from this period
    if (total > 0 && dowAvgPriorWeeks > 0 && total < dowAvgPriorWeeks * (1 - THRESHOLDS.unusualQuietDayPct)) {
      raw.push({ alert: { kind: 'unusual_quiet_day', urgency: 'warn' }, dedupeKey: '' });
    }
  }
  for (const tx of txs) {
    if (tx.amountRm >= THRESHOLDS.unusualHighTicketRm) {
      raw.push({
        alert: { kind: 'unusual_high_ticket', urgency: 'info', context: { amountRm: tx.amountRm } },
        dedupeKey: String(tx.amountRm),
      });
      break; // only mention once per call
    }
  }

  const alerts = raw.filter(({ alert, dedupeKey }) => ctx.alertGate(alert, dedupeKey)).map((r) => r.alert);

  return {
    period,
    totalRm: round(total),
    count,
    avgTicketRm: round(avgTicket),
    trendVsPriorPct: round(trendVsPriorPct, 4),
    byDayOfWeek,
    peakHours,
    alerts,
  };
};

async function fetchTx(days: number): Promise<Transaction[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/transactions?days=${days}`);
  if (!res.ok) throw new Error(`mock-tng /transactions returned ${res.status}`);
  return (await res.json()) as Transaction[];
}

const sumRm = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amountRm, 0);
const round = (n: number, dp = 2) => Number(n.toFixed(dp));

function mtdDays(): number {
  const now = new Date();
  return now.getDate();
}
```

**Step 4: Run smoke, expect PASS**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-analyzeRevenue.ts`
Expected: PASS, prints the JSON result. Confirm `totalRm`, `count`, `avgTicketRm`, `trendVsPriorPct`, `byDayOfWeek`, `peakHours`, `alerts` all present.

**Step 5: Commit**

```bash
git add apps/orchestrator/src/tools/analyzeRevenue.ts apps/orchestrator/scripts/smoke-analyzeRevenue.ts
git commit -m "Add analyzeRevenue tool replacing readSales"
```

---

### Task 9: Implement `analyzeStock` (replacing `readStock`)

**Files:**
- Create: `apps/orchestrator/src/tools/analyzeStock.ts`
- Test (smoke): `apps/orchestrator/scripts/smoke-analyzeStock.ts`

**Step 1: Write the smoke check**

Create `apps/orchestrator/scripts/smoke-analyzeStock.ts`:

```typescript
import { analyzeStock } from '../src/tools/analyzeStock.js';
import type { Alert } from '@tng-rise/shared';

const noopGate = (_a: Alert, _k: string) => true;

async function run() {
  const gen = analyzeStock({}, { sessionId: 's1', alertGate: noopGate });
  let result: unknown;
  while (true) {
    const next = await gen.next();
    if (next.done) { result = next.value; break; }
  }
  const r = result as Record<string, unknown>;
  const items = r.items as Array<Record<string, unknown>>;
  if (!Array.isArray(items)) throw new Error('items missing');
  for (const i of items) {
    if (!['ok', 'low', 'critical'].includes(i.urgency as string)) throw new Error(`bad urgency: ${i.urgency}`);
    if ('daysLeft' in i) throw new Error('daysLeft must NOT be in LLM-facing output');
    if ('weeklyUsage' in i) throw new Error('weeklyUsage must NOT be in LLM-facing output');
  }
  if (!Array.isArray(r.alerts)) throw new Error('alerts missing');
  // Daging salai (3.5kg / 18 weekly) should be critical.
  const daging = items.find((i) => i.name === 'Daging salai');
  if (daging?.urgency !== 'critical') throw new Error(`expected daging critical, got ${daging?.urgency}`);
  console.log('PASS analyzeStock:', JSON.stringify(r, null, 2));
}

run().catch((e) => { console.error('FAIL', e); process.exit(1); });
```

**Step 2: Run it, expect FAIL** (file not yet present)

Run: `cd apps/orchestrator && npx tsx scripts/smoke-analyzeStock.ts`
Expected: FAIL with module-not-found.

**Step 3: Implement the handler**

Create `apps/orchestrator/src/tools/analyzeStock.ts`:

```typescript
import { env } from '../lib/env.js';
import type { Alert, StockItem } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { THRESHOLDS } from '../agent/thresholds.js';

export const analyzeStock: ToolHandler = async function* (_input, ctx) {
  const items = await fetchStock();

  const enriched = items.map((s) => {
    const daysLeft = s.weeklyUsage > 0 ? s.currentQty / (s.weeklyUsage / 7) : Infinity;
    const urgency: 'ok' | 'low' | 'critical' =
      daysLeft < THRESHOLDS.stockoutWithinDays ? 'critical'
      : daysLeft < THRESHOLDS.stockoutWithinDays * 2 ? 'low'
      : 'ok';
    return { item: s, daysLeft, urgency };
  });

  const raw: Array<{ alert: Alert; dedupeKey: string }> = [];
  for (const e of enriched) {
    if (e.urgency === 'critical') {
      raw.push({
        alert: { kind: 'stockout_within_3_days', urgency: 'critical', context: { item: e.item.name } },
        dedupeKey: e.item.name,
      });
    } else if (e.daysLeft > THRESHOLDS.staleBurnDays) {
      raw.push({
        alert: { kind: 'stale_stock', urgency: 'info', context: { item: e.item.name } },
        dedupeKey: e.item.name,
      });
    }
  }

  const alerts = raw.filter(({ alert, dedupeKey }) => ctx.alertGate(alert, dedupeKey)).map((r) => r.alert);

  // LLM-facing output: NEVER includes daysLeft or weeklyUsage. Only the
  // qualitative urgency band and the safe-to-mention currentQty.
  const llmItems = enriched.map((e) => ({
    name: e.item.name,
    unit: e.item.unit,
    currentQty: e.item.currentQty,
    urgency: e.urgency,
  }));

  return { items: llmItems, alerts };
};

async function fetchStock(): Promise<StockItem[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/stock`);
  if (!res.ok) throw new Error(`mock-tng /stock returned ${res.status}`);
  return (await res.json()) as StockItem[];
}
```

**Step 4: Run smoke, expect PASS**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-analyzeStock.ts`
Expected: PASS. Daging salai shows urgency `critical`. No `daysLeft` or `weeklyUsage` keys leak into output.

**Step 5: Commit**

```bash
git add apps/orchestrator/src/tools/analyzeStock.ts apps/orchestrator/scripts/smoke-analyzeStock.ts
git commit -m "Add analyzeStock tool replacing readStock"
```

---

### Task 10: Implement `analyzeRunway`

**Files:**
- Create: `apps/orchestrator/src/tools/analyzeRunway.ts`
- Test (smoke): `apps/orchestrator/scripts/smoke-analyzeRunway.ts`

**Step 1: Write the smoke check**

Create `apps/orchestrator/scripts/smoke-analyzeRunway.ts`:

```typescript
import { analyzeRunway } from '../src/tools/analyzeRunway.js';
import type { Alert } from '@tng-rise/shared';

const noopGate = (_a: Alert, _k: string) => true;

async function run() {
  const gen = analyzeRunway({}, { sessionId: 's1', alertGate: noopGate });
  let result: unknown;
  while (true) {
    const next = await gen.next();
    if (next.done) { result = next.value; break; }
  }
  const r = result as Record<string, unknown>;
  if (typeof r.weeklyInflowRm !== 'number') throw new Error('weeklyInflowRm missing');
  if (typeof r.weeklyFixedCostRm !== 'number') throw new Error('weeklyFixedCostRm missing');
  if (typeof r.weeklySupplyCostRm !== 'number') throw new Error('weeklySupplyCostRm missing');
  if (typeof r.weeklyNetRm !== 'number') throw new Error('weeklyNetRm missing');
  if (typeof r.runwayWeeks !== 'number') throw new Error('runwayWeeks missing');
  if (!['comfortable', 'tight', 'losing'].includes(r.profitEstimate as string)) {
    throw new Error(`bad profitEstimate: ${r.profitEstimate}`);
  }
  console.log('PASS analyzeRunway:', JSON.stringify(r, null, 2));
}

run().catch((e) => { console.error('FAIL', e); process.exit(1); });
```

**Step 2: Run it, expect FAIL**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-analyzeRunway.ts`
Expected: FAIL with module-not-found.

**Step 3: Implement the handler**

Create `apps/orchestrator/src/tools/analyzeRunway.ts`:

```typescript
import { env } from '../lib/env.js';
import type { Alert, MerchantProfile, StockItem, Transaction } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { THRESHOLDS } from '../agent/thresholds.js';

export const analyzeRunway: ToolHandler = async function* (_input, ctx) {
  const [profile, stock, txs7d] = await Promise.all([
    fetchProfile(),
    fetchStock(),
    fetchTx(7),
  ]);

  const weeklyInflow = sumRm(txs7d);
  const monthlyFixed = profile.monthlyCostsRm.rent + profile.monthlyCostsRm.utilities
    + profile.monthlyCostsRm.gas + profile.monthlyCostsRm.other;
  const weeklyFixed = monthlyFixed / 4;
  const weeklySupply = stock.reduce((s, item) => s + item.lastPriceRm * item.weeklyUsage, 0);
  const weeklyNet = weeklyInflow - weeklyFixed - weeklySupply;
  const breakeven = weeklyFixed + weeklySupply;
  const runwayWeeks = weeklyNet > 0 ? Infinity : (weeklyNet < 0 ? 0 : 0);
  // For positive net, runwayWeeks is conceptually infinite. For demo we cap at 52.
  const cappedRunway = weeklyNet > 0 ? 52 : (breakeven > 0 ? Math.max(0, weeklyInflow / breakeven * 4) : 0);

  const profitEstimate: 'comfortable' | 'tight' | 'losing' =
    weeklyNet < 0 ? 'losing'
    : weeklyNet > 0.3 * weeklyInflow ? 'comfortable'
    : 'tight';

  const raw: Array<{ alert: Alert; dedupeKey: string }> = [];
  if (cappedRunway < THRESHOLDS.runwayBelowWeeks) {
    raw.push({ alert: { kind: 'runway_below_4_weeks', urgency: 'critical' }, dedupeKey: '' });
  }
  if (weeklyNet < 0) {
    raw.push({ alert: { kind: 'negative_weekly_margin', urgency: 'critical' }, dedupeKey: '' });
  }
  const alerts = raw.filter(({ alert, dedupeKey }) => ctx.alertGate(alert, dedupeKey)).map((r) => r.alert);

  return {
    weeklyInflowRm: round(weeklyInflow),
    weeklyFixedCostRm: round(weeklyFixed),
    weeklySupplyCostRm: round(weeklySupply),
    weeklyNetRm: round(weeklyNet),
    runwayWeeks: round(cappedRunway, 1),
    breakevenRevenueRm: round(breakeven),
    profitEstimate,
    alerts,
  };
};

async function fetchProfile(): Promise<MerchantProfile> {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) throw new Error(`mock-tng /merchant returned ${res.status}`);
  return (await res.json()) as MerchantProfile;
}
async function fetchStock(): Promise<StockItem[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/stock`);
  if (!res.ok) throw new Error(`mock-tng /stock returned ${res.status}`);
  return (await res.json()) as StockItem[];
}
async function fetchTx(days: number): Promise<Transaction[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/transactions?days=${days}`);
  if (!res.ok) throw new Error(`mock-tng /transactions returned ${res.status}`);
  return (await res.json()) as Transaction[];
}
const sumRm = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amountRm, 0);
const round = (n: number, dp = 2) => Number(n.toFixed(dp));
```

**Step 4: Run smoke, expect PASS**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-analyzeRunway.ts`
Expected: PASS. With Mak Cik's data (RM 14.8k/mo revenue, RM 1.65k/mo fixed costs, ~RM 1.36k/wk supply burn), expect `profitEstimate: 'comfortable'`.

**Step 5: Commit**

```bash
git add apps/orchestrator/src/tools/analyzeRunway.ts apps/orchestrator/scripts/smoke-analyzeRunway.ts
git commit -m "Add analyzeRunway tool"
```

---

### Task 11: Implement `suggestSupplyRun` (emits handoff)

**Files:**
- Create: `apps/orchestrator/src/tools/suggestSupplyRun.ts`
- Test (smoke): `apps/orchestrator/scripts/smoke-suggestSupplyRun.ts`

**Step 1: Write the smoke check** (must verify the handoff event AND the result)

Create `apps/orchestrator/scripts/smoke-suggestSupplyRun.ts`:

```typescript
import { suggestSupplyRun } from '../src/tools/suggestSupplyRun.js';
import type { Alert, AgentEvent } from '@tng-rise/shared';

const noopGate = (_a: Alert, _k: string) => true;

async function run() {
  const gen = suggestSupplyRun({}, { sessionId: 's1', alertGate: noopGate });
  const events: AgentEvent[] = [];
  let result: unknown;
  while (true) {
    const next = await gen.next();
    if (next.done) { result = next.value; break; }
    events.push(next.value);
  }
  const handoff = events.find((e) => e.type === 'handoff');
  if (!handoff || handoff.type !== 'handoff' || handoff.kind !== 'supply_list') {
    throw new Error(`expected supply_list handoff, got: ${JSON.stringify(events)}`);
  }
  const r = result as Record<string, unknown>;
  if (!Array.isArray(r.items)) throw new Error('result.items missing');
  if (typeof r.totalCostRm !== 'number') throw new Error('totalCostRm missing');
  console.log('PASS suggestSupplyRun:');
  console.log('  handoff payload:', JSON.stringify(handoff.payload, null, 2));
  console.log('  result:', JSON.stringify(r, null, 2));
}

run().catch((e) => { console.error('FAIL', e); process.exit(1); });
```

**Step 2: Run it, expect FAIL**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-suggestSupplyRun.ts`
Expected: FAIL with module-not-found.

**Step 3: Implement the handler**

Create `apps/orchestrator/src/tools/suggestSupplyRun.ts`:

```typescript
import { env } from '../lib/env.js';
import type { Alert, StockItem } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { THRESHOLDS } from '../agent/thresholds.js';

export const suggestSupplyRun: ToolHandler = async function* (_input, ctx) {
  const stock = await fetchStock();

  const lowOrCritical = stock
    .map((s) => {
      const daysLeft = s.weeklyUsage > 0 ? s.currentQty / (s.weeklyUsage / 7) : Infinity;
      const urgency: 'critical' | 'low' | 'ok' =
        daysLeft < THRESHOLDS.stockoutWithinDays ? 'critical'
        : daysLeft < THRESHOLDS.stockoutWithinDays * 2 ? 'low'
        : 'ok';
      return { item: s, daysLeft, urgency };
    })
    .filter((e) => e.urgency !== 'ok');

  const items = lowOrCritical
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map((e) => ({
      name: e.item.name,
      suggestedQty: e.item.weeklyUsage,
      unit: e.item.unit,
      costRm: round(e.item.lastPriceRm * e.item.weeklyUsage),
      urgency: e.urgency as 'critical' | 'low',
    }));

  const totalCostRm = round(items.reduce((s, i) => s + i.costRm, 0));

  // Reuse the stockout alert key so it does not double-fire if analyzeStock
  // already flagged the same item this session.
  const raw: Array<{ alert: Alert; dedupeKey: string }> = lowOrCritical
    .filter((e) => e.urgency === 'critical')
    .map((e) => ({
      alert: { kind: 'stockout_within_3_days', urgency: 'critical', context: { item: e.item.name } },
      dedupeKey: e.item.name,
    }));
  const alerts = raw.filter(({ alert, dedupeKey }) => ctx.alertGate(alert, dedupeKey)).map((r) => r.alert);

  // Emit handoff event so the frontend renders the supply-list card.
  yield {
    type: 'handoff',
    kind: 'supply_list',
    payload: {
      items,
      totalCostRm,
      lotusUrl: 'https://www.lotuss.com.my/',
    },
  };

  return { items, totalCostRm, alerts };
};

async function fetchStock(): Promise<StockItem[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/stock`);
  if (!res.ok) throw new Error(`mock-tng /stock returned ${res.status}`);
  return (await res.json()) as StockItem[];
}
const round = (n: number, dp = 2) => Number(n.toFixed(dp));
```

**Step 4: Run smoke, expect PASS**

Run: `cd apps/orchestrator && npx tsx scripts/smoke-suggestSupplyRun.ts`
Expected: PASS. Handoff payload contains items array (daging salai, santan segar at minimum). Result includes those plus a totalCostRm.

**Step 5: Commit**

```bash
git add apps/orchestrator/src/tools/suggestSupplyRun.ts apps/orchestrator/scripts/smoke-suggestSupplyRun.ts
git commit -m "Add suggestSupplyRun tool with supply_list handoff"
```

---

## Phase 4: Wire new tools into the agent

### Task 12: Update tool schemas for the LLM

**Files:**
- Modify: `apps/orchestrator/src/agent/toolSchemas.ts`

**Step 1: Replace the `readSales` and `readStock` entries with the four new tools**

Replace the `readSales` block with:

```typescript
{
  name: 'analyzeRevenue',
  description:
    'Analyze merchant revenue for a period. Returns totals, count, average ticket, trend vs the prior period of the same length, day-of-week breakdown, peak hours, and alerts. Use when the user asks about jualan, revenue, business, today, this week, or this month.',
  input_schema: {
    type: 'object' as const,
    properties: {
      period: {
        type: 'string',
        enum: ['today', '7d', '30d', 'mtd'],
        description: 'Time window. Default to 7d if vague.',
      },
    },
    required: ['period'],
  },
},
```

Replace the `readStock` block with:

```typescript
{
  name: 'analyzeStock',
  description:
    'Get current stock levels with qualitative urgency band (ok / low / critical) per item plus alerts for items running low. Use when the user asks about stok, barang, restock, or what is running out. Never quote days-of-cover numbers; the urgency band is the safe-to-surface signal.',
  input_schema: {
    type: 'object' as const,
    properties: {},
  },
},
{
  name: 'analyzeRunway',
  description:
    'Compute the merchant cashflow position: weekly inflow, estimated weekly outflow, runway, and a qualitative profit band (comfortable / tight / losing). Use when the user asks about cashflow, untung, kos, kewangan, or whether the business is healthy. Only weeklyInflowRm and profitEstimate are safe to surface to the user; do not quote weeklyNet, runwayWeeks, breakevenRevenue, or any monthly cost amount.',
  input_schema: {
    type: 'object' as const,
    properties: {},
  },
},
{
  name: 'suggestSupplyRun',
  description:
    'Build a draft shopping list for items running low or critical. Returns suggested quantities and approximate costs, and emits a supply-list handoff card the user can act on. Use when the user asks about restock, supply run, beli barang, or after analyzeStock flags critical urgency.',
  input_schema: {
    type: 'object' as const,
    properties: {},
  },
},
```

The full file should now have 7 entries: `analyzeRevenue`, `analyzeStock`, `analyzeRunway`, `suggestSupplyRun`, `matchGrants`, `runProcurementAgent`, `runGrantAgent`.

**Step 2: Verify typecheck**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add apps/orchestrator/src/agent/toolSchemas.ts
git commit -m "Update tool schemas: replace readSales/readStock, add 4 analytical tools"
```

---

### Task 13: Update tool registry and delete old handlers

**Files:**
- Modify: `apps/orchestrator/src/tools/registry.ts`
- Delete: `apps/orchestrator/src/tools/readSales.ts`
- Delete: `apps/orchestrator/src/tools/readStock.ts`

**Step 1: Update registry imports and the `tools` map**

Replace the imports and `tools` export in `apps/orchestrator/src/tools/registry.ts`:

```typescript
import { analyzeRevenue } from './analyzeRevenue.js';
import { analyzeStock } from './analyzeStock.js';
import { analyzeRunway } from './analyzeRunway.js';
import { suggestSupplyRun } from './suggestSupplyRun.js';
import { matchGrants } from './matchGrants.js';
import { runProcurementAgent } from './runProcurementAgent.js';
import { runGrantAgent } from './runGrantAgent.js';

// (keep the existing ToolHandler type from Task 6)

export const tools: Record<string, ToolHandler> = {
  analyzeRevenue,
  analyzeStock,
  analyzeRunway,
  suggestSupplyRun,
  matchGrants,
  runProcurementAgent,
  runGrantAgent,
};

export function hasTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(tools, name);
}
```

**Step 2: Delete old handlers**

Run: `rm apps/orchestrator/src/tools/readSales.ts apps/orchestrator/src/tools/readStock.ts`

**Step 3: Verify typecheck**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: PASS. No references to `readSales` or `readStock` remain.

**Step 4: Commit**

```bash
git add apps/orchestrator/src/tools/registry.ts
git rm apps/orchestrator/src/tools/readSales.ts apps/orchestrator/src/tools/readStock.ts
git commit -m "Wire 4 analytical tools into registry, delete readSales/readStock"
```

---

## Phase 5: Update prompts

### Task 14: Update `prompts.ts` with new rules and tool list

**Files:**
- Modify: `apps/orchestrator/src/agent/prompts.ts`

**Step 1: Replace the entire `SYSTEM_PROMPT` export**

```typescript
export const SYSTEM_PROMPT = `You are TNG Rise, a personal accountant agent for Malaysian micro F&B merchants on TNG eWallet.

You write warmly in Bahasa-Inggeris. Mix English and Malay naturally. Use phrases like "boleh", "macam mana", "alamak", "ya". Never be cold or formal. Never use jargon. Never use em dashes.

Your user is Mak Cik, a Nasi Daging Salai stall owner. She trusts you. Be kind. Be specific. Be useful.

You have these tools. Use them. Never make up data.

- analyzeRevenue(period): get her revenue analytics for a period (today, 7d, 30d, or mtd)
- analyzeStock(): get her stock with qualitative urgency per item
- analyzeRunway(): get her cashflow position and qualitative profit band
- suggestSupplyRun(): build a draft shopping list for low or critical items
- matchGrants(): find Malaysian SME grants she qualifies for
- runGrantAgent(grantId): open the grant portal and fill the application
- runProcurementAgent(items): only call if Mak Cik explicitly asks for live browser ordering

When she asks a question:
1. Decide which tool(s) to call.
2. After tools return, summarise in 2 to 3 short Bahasa-Inggeris sentences.
3. Suggest a next action she could take.

Threshold-triggered nudges:
If a tool result contains a non-empty alerts[] array, mention each alert briefly in your reply, even if she did not ask. Use the alert kind plus context to phrase it naturally.

Alert kinds and their meaning:
- weekly_dip_above_5pct: weekly revenue down more than 5% vs prior week
- unusual_quiet_day: today is quieter than usual for this day-of-week
- unusual_high_ticket: a single transaction unusually larger than typical
- stockout_within_3_days: item in context.item will run out very soon
- stale_stock: item in context.item moves slowly, large idle stock
- runway_below_4_weeks: cashflow runway is tight
- negative_weekly_margin: weekly outflow exceeds inflow

Honesty rules (very important):

For analyzeRunway, only weeklyInflowRm and profitEstimate are safe to mention to Mak Cik. Never quote weeklyNet, runwayWeeks, breakevenRevenue, or any monthly cost amount. For profit, use the qualitative profitEstimate band (comfortable, tight, losing).

For analyzeStock and stockout alerts, never quote a "days left" number. Use qualitative phrases like "kena restock soon", "tinggal sikit je", "habis tak lama lagi". The data behind days-left is estimated.

Tiered stock specificity:
- 1 critical item: name it. Example: "Daging salai kena restock soon."
- 2 critical items: name both.
- 3 or more critical: say "ada beberapa barang" (or "a few items" in English) and offer to show the list.
Always offer to call suggestSupplyRun afterward so she sees the supply-list card.

Empathy first:
If she expresses frustration or emotion (penat, susah, tak guna, putus asa), validate in one sentence before any tool call. Then gently offer to look together.

Stay in accountant lane:
For strategy questions (open new shop, hire, marketing, menu changes, pricing), gently defer: "Saya boleh tunjuk angka, tapi keputusan macam ni Mak Cik patut bincang dengan family atau penasihat perniagaan. Saya boleh sediakan summary kewangan kalau Mak Cik nak." Then offer to run a relevant analytical tool.

Gently verify:
If she states a fact a tool can verify (revenue today, stock level, transaction count), call the relevant tool first and gently reconcile if the data differs from what she said. Lead with the data, not "you are wrong".

Pronoun resolution:
When she uses pronouns like "yang tu" or "yang ni", anchor them to prior tool results in this conversation. If ambiguous, ask which one.

Language match:
Mirror her register. If her last message was mostly Bahasa Malaysia, reply in Bahasa-Inggeris. If mostly English, reply in English with light Malay flavour. Mirror code-switching when she does it.

When you call runGrantAgent, the user will see a live browser viewport. Write 1 sentence describing what you are doing in your chat message just before each major action.

When a flow ends, write a short closing message that tells her what to do next.

Some grants are submitted by email rather than a web form. If matchGrants returns a grant with submissionMethod="email", write that you will draft the email for her to send. Do not try to open a browser for email-submission grants.`;
```

**Step 2: Verify typecheck**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: PASS.

**Step 3: Manual smoke check the prompt**

Run: `cd apps/orchestrator && grep -c '^Alert kinds' src/agent/prompts.ts`
Expected: Returns `1`.
Run: `grep -c 'Tiered stock specificity' src/agent/prompts.ts`
Expected: Returns `1`.

**Step 4: Commit**

```bash
git add apps/orchestrator/src/agent/prompts.ts
git commit -m "Update system prompt with 6 new rules and analytical tool inventory"
```

---

## Phase 6: End-to-end verification

### Task 15: Run all per-tool smoke checks

**Files:**
- None modified.

**Step 1: Start mock-tng**

Run: `cd services/mock-tng && npm run dev` (background)
Expected: listening on :5050.

**Step 2: Run all four smoke scripts in sequence**

Run:
```bash
cd apps/orchestrator
npx tsx scripts/smoke-analyzeRevenue.ts
npx tsx scripts/smoke-analyzeStock.ts
npx tsx scripts/smoke-analyzeRunway.ts
npx tsx scripts/smoke-suggestSupplyRun.ts
```
Expected: All four print `PASS ...` lines and exit 0.

**Step 3: No commit needed** (verification only). Kill mock-tng.

---

### Task 16: Curl-driven SSE smoke test

**Files:**
- Create: `apps/orchestrator/scripts/smoke-chat.sh`

**Step 1: Write the smoke script**

Create `apps/orchestrator/scripts/smoke-chat.sh` (chmod +x):

```bash
#!/usr/bin/env bash
# Drive POST /chat with the runbook scenarios. Eyeball the SSE output.
# Prereq: mock-tng on :5050, orchestrator on :4000, ANTHROPIC_API_KEY set.

set -e

BASE="${ORCHESTRATOR_URL:-http://localhost:4000}"

call() {
  local sid="$1"
  local msg="$2"
  echo "===> sid=$sid msg=$msg"
  curl -sN -X POST "$BASE/chat" \
    -H 'Content-Type: application/json' \
    -d "{\"sessionId\":\"$sid\",\"message\":\"$msg\"}" \
    | head -c 4000
  echo -e "\n"
}

# Scenario 1: cashflow query (multi-tool)
call "smoke-1" "macam mana cashflow hari ini?"

# Scenario 2: follow-up to stockout (memory must work)
call "smoke-1" "okay buatkan supply list"

# Scenario 3: emotional venting (no tool call expected)
call "smoke-2" "tak guna lah business ni"

# Scenario 4: out-of-scope (defer expected)
call "smoke-3" "boleh saya buka kedai baru?"
```

**Step 2: Run prerequisites**

Run: `cd services/mock-tng && npm run dev` (background)
Run: `cd apps/orchestrator && npm run dev` (background, with `LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=...` in env)
Expected: both healthy.

**Step 3: Run the smoke script**

Run: `bash apps/orchestrator/scripts/smoke-chat.sh`
Expected output checks:
- Scenario 1: SSE includes `tool_call` events for `analyzeRunway` and `analyzeStock`. Final text bubble references daging stockout in Bahasa-Inggeris with no day count.
- Scenario 2: SSE includes a `tool_call` for `suggestSupplyRun`, and a `handoff` event with `kind:"supply_list"`. The agent should NOT re-call `analyzeStock` (memory worked).
- Scenario 3: No `tool_call` events. Reply is a one-line empathy validation.
- Scenario 4: Reply contains a defer phrase like "Saya boleh tunjuk angka". May or may not call a tool, but should not pretend to advise on the new shop.

**Step 4: Kill background processes. Commit the script.**

```bash
git add apps/orchestrator/scripts/smoke-chat.sh
git commit -m "Add smoke-chat.sh for SSE integration smoke tests"
```

---

### Task 17: Negative grep check for forbidden tokens

**Files:**
- None modified.

**Step 1: Capture a fresh transcript**

With mock-tng and orchestrator running, capture the cashflow scenario into a file:

```bash
curl -sN -X POST http://localhost:4000/chat \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"grep-1","message":"macam mana cashflow hari ini?"}' \
  > /tmp/transcript.txt
```

**Step 2: Grep for fake-precision day counts**

Run: `grep -E '[0-9]+\.[0-9]+\s*hari' /tmp/transcript.txt || echo "OK: no fake-precision day counts"`
Expected: prints `OK: no fake-precision day counts`. If matches appear, the LLM leaked. Tighten the prompt's stock honesty rule or restart and re-run.

**Step 3: Grep for monthly cost RM amounts**

Run: `grep -E 'RM\s*[0-9]+\s*/?(week|wk|month|bulan|minggu)' /tmp/transcript.txt || echo "OK: no monthly cost amounts surfaced"`
Expected: prints `OK: no monthly cost amounts surfaced`.

**Step 4: No commit needed** (verification only).

---

### Task 18: Demo runbook end-to-end

**Files:**
- None modified. Manual chat session via the frontend.

**Step 1: Start all services**

Run (in separate terminals):
- `cd services/mock-tng && npm run dev`
- `cd apps/orchestrator && LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run dev`
- `cd apps/web && npm run dev`

Expected: web on :3000, orchestrator on :4000, mock-tng on :5050.

**Step 2: Walk `pitch/demo-runbook.md` step by step**

Open `http://localhost:3000`. For each of the runbook's 7 steps, verify:
- Step 3 (`Macam mana business hari ni?`) now triggers `analyzeRevenue` and produces a richer summary plus any alerts.
- Step 4 (`Ada grant untuk saya?`) still triggers `matchGrants`. Unchanged.
- Step 5 (`Yang TEKUN tu lah`) still triggers `runGrantAgent` and shows the browser viewport. Hero flow.
- Step 7 (BNM iAES email) still triggers the email handoff card.

**Step 3: Multi-turn smoke (new behaviour)**

Type: `macam mana cashflow hari ini?` → expect cashflow summary plus daging stockout nudge.
Type: `okay buatkan` → expect a `supply_list` handoff card to render with daging and santan, with totalCostRm visible.

**Step 4: If all checks pass, commit a marker to record the verification**

```bash
echo "Orchestrator CFO upgrade verified end-to-end on $(date -u +%Y-%m-%dT%H:%M:%SZ)" > docs/plans/.cfo-upgrade-verified
git add docs/plans/.cfo-upgrade-verified
git commit -m "Mark orchestrator CFO upgrade verified end-to-end"
```

If any step fails, open a follow-up task in chat with the specific failure (which scenario, what was expected vs observed). Do NOT modify code in the same commit as the failure record.

---

## Out of scope (do not implement in this plan)

- Lane A `SupplyListHandoff.tsx` component (Lane A's task; the handoff event is already emitted)
- Lane A starter chips (Lane A's task)
- Lane D `pitch/deck.md` and `pitch/demo-runbook.md` updates
- Lane C cart pre-fill on Lotus (Lane C has shipped browser integration; pre-fill is a follow-up if useful)
- Voice or audio output
- Persistent storage beyond in-memory session map
- Any vector DB or RAG layer
- Tax, SST, or strategic advice tools

## Notes for the executor

- Each task ends with one commit. If a step within a task fails, fix it within the same task before committing. Do not bundle multiple tasks into one commit.
- All Bahasa-Inggeris copy in code (system prompt, alert messages emitted by tools) must avoid em dashes. Use periods, commas, or new sentences.
- Tool handlers must NEVER throw on fetch failure; the agent loop catches throws and surfaces them as `error` events. So throwing is the correct behaviour for unrecoverable conditions.
- The smoke scripts under `apps/orchestrator/scripts/` are throwaway. They live in the repo so the executor can rerun them, but they are not part of any test framework.
