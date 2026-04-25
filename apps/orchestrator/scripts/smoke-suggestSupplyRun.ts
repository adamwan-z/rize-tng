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
