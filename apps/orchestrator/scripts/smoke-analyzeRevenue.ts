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
