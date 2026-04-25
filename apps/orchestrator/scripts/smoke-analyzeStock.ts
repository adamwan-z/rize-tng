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
