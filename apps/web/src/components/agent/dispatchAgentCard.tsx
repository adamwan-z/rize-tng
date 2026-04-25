import { GrantMatchedCard } from './GrantMatchedCard.js';
import { ProcurementCard } from './ProcurementCard.js';
import { RevenueCard } from './RevenueCard.js';
import { normalizeForSparkline } from '../../lib/format.js';

type DispatchInput = {
  toolName: string;
  input: Record<string, unknown>;
  result: unknown;
  status: 'running' | 'done';
};

// Returns null when no rich card is available. MessageList falls back to
// ToolCallCard's JSON view in that case.
export function dispatchAgentCard({ toolName, input, result, status }: DispatchInput) {
  if (toolName === 'readSales' && status === 'done') return renderRevenue(result);
  if (toolName === 'matchGrants' && status === 'done') return renderGrants(result);
  if (toolName === 'runProcurementAgent') return renderProcurement(input, status);
  return null;
}

function renderRevenue(raw: unknown) {
  const r = raw as {
    period: 'today' | '7d' | '30d';
    totalRm: number;
    count: number;
    avgTicketRm: number;
    transactions: Array<{ timestamp: string; amountRm: number }>;
  } | null;
  if (!r || typeof r.totalRm !== 'number') return null;

  // Bucket transactions by day so the sparkline always shows 7 bars even when
  // the user asked for a longer or shorter window.
  const byDay = new Map<string, number>();
  for (const tx of r.transactions ?? []) {
    const day = tx.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + tx.amountRm);
  }
  const days = [...byDay.keys()].sort();
  const recent = days.slice(-7).map((d) => byDay.get(d) ?? 0);
  const series = normalizeForSparkline(
    recent.length === 7 ? recent : padLeft(recent, 7, 0),
  );

  const todayRm = recent[recent.length - 1] ?? r.totalRm;
  const yesterdayRm = recent[recent.length - 2] ?? todayRm;

  // Period-aware framing so the card never says "Today" for a 7d/30d query.
  if (r.period === 'today') {
    const deltaPercent =
      yesterdayRm > 0 ? ((todayRm - yesterdayRm) / yesterdayRm) * 100 : undefined;
    return (
      <RevenueCard
        eyebrow="Today · Kampung Baru"
        totalRm={Number(todayRm.toFixed(2))}
        {...(deltaPercent !== undefined && {
          deltaPercent: Number(deltaPercent.toFixed(1)),
          comparedTo: 'yesterday',
        })}
        orderCount={r.count}
        series={series}
      />
    );
  }

  // 7d / 30d: show the cumulative total. Skip the delta pill because we have
  // no prior-period total to compare against.
  const eyebrow =
    r.period === '7d'
      ? 'Last 7 days · Kampung Baru'
      : 'Last 30 days · Kampung Baru';
  return (
    <RevenueCard
      eyebrow={eyebrow}
      totalRm={Number(r.totalRm.toFixed(2))}
      orderCount={r.count}
      series={series}
    />
  );
}

function renderGrants(raw: unknown) {
  const r = raw as {
    matches: Array<{
      grant: {
        id: string;
        name: string;
        agency: string;
        maxAmountRm: number;
        submissionMethod: 'web_form' | 'email';
      };
      reasons: string[];
    }>;
  } | null;
  if (!r?.matches?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {r.matches.slice(0, 3).map(({ grant, reasons }) => (
        <GrantMatchedCard
          key={grant.id}
          grantName={grant.name}
          agency={grant.agency}
          maxAmountRm={grant.maxAmountRm}
          collateralFree
          steps={reasons.slice(0, 3)}
        />
      ))}
    </div>
  );
}

function renderProcurement(input: Record<string, unknown>, status: 'running' | 'done') {
  // The LLM passes `items: [{ name, quantity }]`. The browser-agent has its
  // own per-line-item prices via the catalog, but those don't surface in the
  // tool_result today (Lane B owns expanding the contract). Pass priceRm: 0
  // and let ProcurementCard hide the price column when every item is 0.
  const rawItems = input.items as Array<{ name: string; quantity: number }> | undefined;
  if (!rawItems?.length) return null;
  const items = rawItems.map((it) => ({
    name: it.name,
    qty: `${it.quantity} unit${it.quantity > 1 ? 's' : ''}`,
    priceRm: 0,
  }));
  return (
    <ProcurementCard
      source="Lotus's"
      live={status === 'running'}
      items={items}
    />
  );
}

function padLeft<T>(arr: T[], len: number, fill: T): T[] {
  if (arr.length >= len) return arr.slice(-len);
  return [...Array(len - arr.length).fill(fill), ...arr];
}
