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
