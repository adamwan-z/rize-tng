import { GrantMatchedCard } from './GrantMatchedCard.js';
import { ProcurementCard } from './ProcurementCard.js';
import { RevenueCard } from './RevenueCard.js';
import { RunwayCard, type ProfitBand } from './RunwayCard.js';

type DispatchInput = {
  toolName: string;
  input: Record<string, unknown>;
  result: unknown;
  status: 'running' | 'done';
};

// Returns null when no rich card is available. MessageList falls back to
// ToolCallCard's JSON view in that case.
export function dispatchAgentCard({ toolName, input, result, status }: DispatchInput) {
  if (toolName === 'analyzeRevenue' && status === 'done') return renderRevenue(result);
  if (toolName === 'analyzeRunway' && status === 'done') return renderRunway(result);
  if (toolName === 'matchGrants' && status === 'done') return renderGrants(result);
  if (toolName === 'runProcurementAgent') return renderProcurement(input, status);
  return null;
}

function renderRunway(raw: unknown) {
  const r = raw as {
    weeklyInflowRm: number;
    weeklyFixedCostRm: number;
    weeklySupplyCostRm: number;
    weeklyNetRm: number;
    profitEstimate: ProfitBand;
  } | null;
  if (!r || typeof r.weeklyInflowRm !== 'number') return null;
  return (
    <RunwayCard
      weeklyInflowRm={r.weeklyInflowRm}
      weeklyFixedCostRm={r.weeklyFixedCostRm}
      weeklySupplyCostRm={r.weeklySupplyCostRm}
      weeklyNetRm={r.weeklyNetRm}
      profitEstimate={r.profitEstimate}
    />
  );
}

function renderRevenue(raw: unknown) {
  const r = raw as {
    period: 'today' | '7d' | '30d';
    totalRm: number;
    count: number;
    avgTicketRm: number;
    dailyInflowRm?: number[];
  } | null;
  if (!r || typeof r.totalRm !== 'number') return null;

  const recent = Array.isArray(r.dailyInflowRm) ? r.dailyInflowRm : [];
  const padded = recent.length === 7 ? [...recent] : padLeft(recent, 7, 0);

  if (r.period === 'today') {
    // Force the rightmost bar to match the headline. The orchestrator fetches
    // the 7-day series and the 1-day total separately; mock-tng's deterministic
    // seed can return slightly different numbers between the two fetches, and
    // the bar must agree with the big number.
    padded[6] = r.totalRm;
    const todayRm = r.totalRm;
    const yesterdayRm = padded[5] ?? 0;
    // Only show the delta pill when both days have real revenue. Otherwise
    // we'd surface a meaningless "0%" or compare today against zero.
    const deltaPercent =
      yesterdayRm > 0 && todayRm > 0
        ? ((todayRm - yesterdayRm) / yesterdayRm) * 100
        : undefined;
    return (
      <RevenueCard
        eyebrow="Today · Kampung Baru"
        totalRm={Number(todayRm.toFixed(2))}
        {...(deltaPercent !== undefined && {
          deltaPercent: Number(deltaPercent.toFixed(1)),
          comparedTo: 'yesterday',
        })}
        orderCount={r.count}
        dailyInflowRm={padded}
      />
    );
  }

  const eyebrow =
    r.period === '7d'
      ? 'Last 7 days · Kampung Baru'
      : 'Last 30 days · Kampung Baru';
  return (
    <RevenueCard
      eyebrow={eyebrow}
      totalRm={Number(r.totalRm.toFixed(2))}
      orderCount={r.count}
      dailyInflowRm={padded}
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
