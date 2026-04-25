import { formatRm, formatPercent } from '../../lib/format.js';

export type RevenueCardProps = {
  totalRm: number;
  deltaPercent: number;
  comparedTo: string;
  orderCount: number;
  series: number[];
  topSeller?: { name: string; rm: number; orders: number };
};

export function RevenueCard({
  totalRm,
  deltaPercent,
  comparedTo,
  orderCount,
  series,
  topSeller,
}: RevenueCardProps) {
  const positive = deltaPercent >= 0;
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        Today · Kampung Baru
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display font-extrabold text-[56px] leading-none tracking-tight text-ink-900">
          <span className="font-mono text-sm font-medium tracking-wider text-ink-500 mr-2">
            RM
          </span>
          {totalRm.toFixed(2)}
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-widest ${
            positive ? 'bg-tng-green/10 text-tng-green' : 'bg-tng-pink/10 text-tng-pink'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${positive ? 'bg-tng-green' : 'bg-tng-pink'}`} />
          {formatPercent(deltaPercent)}
        </span>
      </div>
      <div className="font-mono text-[13px] text-ink-500 tracking-wide">
        vs {comparedTo} · {orderCount} orders
      </div>
      <div className="flex items-end gap-1.5 h-20" aria-hidden>
        {series.map((value, i) => {
          const isPeak = i === series.length - 1;
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-[3px] ${
                isPeak ? 'bg-tng-yellow' : 'bg-tng-blue-100'
              }`}
              style={{ height: `${Math.max(8, value * 100)}%` }}
            />
          );
        })}
      </div>
      {topSeller && (
        <div className="bg-surface-2 rounded-lg px-4 py-3 text-sm text-ink-700">
          <strong className="text-ink-900 font-semibold">Top seller:</strong>{' '}
          {topSeller.name}, {formatRm(topSeller.rm)} across {topSeller.orders} orders.
        </div>
      )}
    </div>
  );
}
