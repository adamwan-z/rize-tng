import { env } from '../lib/env.js';
import type { Alert, MerchantProfile, Transaction } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { THRESHOLDS } from '../agent/thresholds.js';

export const analyzeRunway: ToolHandler = async function* (_input, ctx) {
  const [profile, txs7d] = await Promise.all([fetchProfile(), fetchTx(7)]);

  const weeklyInflow = sumRm(txs7d);
  const monthlyFixed = profile.monthlyCostsRm.rent + profile.monthlyCostsRm.utilities
    + profile.monthlyCostsRm.gas + profile.monthlyCostsRm.other;
  const weeklyFixed = monthlyFixed / 4;
  const weeklySupply = profile.monthlyCostsRm.supplies / 4;
  const weeklyOutflow = weeklyFixed + weeklySupply;
  const weeklyNet = weeklyInflow - weeklyOutflow;
  const breakeven = weeklyOutflow;
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
    weeklyOutflowRm: round(weeklyOutflow),
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
async function fetchTx(days: number): Promise<Transaction[]> {
  const res = await fetch(`${env.MOCK_TNG_URL}/transactions?days=${days}`);
  if (!res.ok) throw new Error(`mock-tng /transactions returned ${res.status}`);
  return (await res.json()) as Transaction[];
}
const sumRm = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amountRm, 0);
const round = (n: number, dp = 2) => Number(n.toFixed(dp));
