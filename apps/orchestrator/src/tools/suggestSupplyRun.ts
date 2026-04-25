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
