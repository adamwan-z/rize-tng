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

  // Always-7-day rolling tail for the UI sparkline. Fetched even when the
  // requested period is shorter (today/1d) so the card has real bar heights
  // instead of zero-padded flats.
  const sparkSource = days >= 7 ? txs : await fetchTx(7);
  const dailyInflowRm = bucketByDay(sparkSource, 7).map((n) => round(n));

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
    // Real per-day-of-week baseline: average revenue on this DOW across the
    // prior 28 days, excluding today itself. Without this we would compare
    // today's total against today's total and never fire the alert.
    const todayDow = new Date().getDay();
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const baseline = await fetchTx(28);
    const dailyTotals = new Map<string, number>();
    for (const tx of baseline) {
      if (new Date(tx.timestamp).getDay() !== todayDow) continue;
      const dateKey = tx.timestamp.slice(0, 10);
      if (dateKey === todayDateKey) continue;
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + tx.amountRm);
    }
    const priorDowDays = Array.from(dailyTotals.values());
    if (priorDowDays.length > 0) {
      const dowAvg = priorDowDays.reduce((s, v) => s + v, 0) / priorDowDays.length;
      if (total > 0 && dowAvg > 0 && total < dowAvg * (1 - THRESHOLDS.unusualQuietDayPct)) {
        raw.push({ alert: { kind: 'unusual_quiet_day', urgency: 'warn' }, dedupeKey: '' });
      }
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
    dailyInflowRm,
    alerts,
  };
};

// Buckets transactions into the most-recent N daily totals, oldest first.
// Pads with 0 when a day has no transactions so the series is always length N.
function bucketByDay(txs: Transaction[], n: number): number[] {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    const day = tx.timestamp.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + tx.amountRm);
  }
  const sorted = [...totals.keys()].sort();
  const recent = sorted.slice(-n).map((d) => totals.get(d) ?? 0);
  return recent.length >= n ? recent : [...Array(n - recent.length).fill(0), ...recent];
}

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
