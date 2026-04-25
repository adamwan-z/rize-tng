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
