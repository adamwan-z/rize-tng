import { formatRm } from '../../lib/format.js';

export type ProfitBand = 'comfortable' | 'tight' | 'losing';

export type RunwayCardProps = {
  weeklyInflowRm: number;
  weeklyFixedCostRm: number;
  weeklySupplyCostRm: number;
  weeklyNetRm: number;
  profitEstimate: ProfitBand;
};

const BAND_LABEL: Record<ProfitBand, string> = {
  comfortable: 'SELESA',
  tight: 'KETAT',
  losing: 'RUGI',
};

const BAND_THEME: Record<
  ProfitBand,
  { pillBg: string; pillText: string; pillDot: string; bigNumber: string }
> = {
  comfortable: {
    pillBg: 'bg-tng-green/10',
    pillText: 'text-tng-green',
    pillDot: 'bg-tng-green',
    bigNumber: 'text-tng-green',
  },
  tight: {
    pillBg: 'bg-tng-orange/10',
    pillText: 'text-tng-orange',
    pillDot: 'bg-tng-orange',
    bigNumber: 'text-tng-orange',
  },
  losing: {
    pillBg: 'bg-tng-pink/10',
    pillText: 'text-tng-pink',
    pillDot: 'bg-tng-pink',
    bigNumber: 'text-tng-pink',
  },
};

export function RunwayCard({
  weeklyInflowRm,
  weeklyFixedCostRm,
  weeklySupplyCostRm,
  weeklyNetRm,
  profitEstimate,
}: RunwayCardProps) {
  const theme = BAND_THEME[profitEstimate];
  const isLosing = weeklyNetRm < 0;
  const cushionLabel = isLosing ? 'KURANG MINGGU NI' : 'CUSHION MINGGU NI';
  const totalCost = weeklyFixedCostRm + weeklySupplyCostRm;

  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
          Cashflow · Minggu ni
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-widest ${theme.pillBg} ${theme.pillText}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${theme.pillDot}`} />
          {BAND_LABEL[profitEstimate]}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <div className={`font-display font-extrabold text-[56px] leading-none tracking-tight ${theme.bigNumber}`}>
          <span className="font-mono text-sm font-medium tracking-wider text-ink-500 mr-2">
            RM
          </span>
          {Math.abs(weeklyNetRm).toFixed(2)}
        </div>
        <div className="text-right font-mono text-[11px] uppercase tracking-widest text-ink-500">
          {cushionLabel}
        </div>
      </div>

      <div className="font-mono text-[13px] text-ink-500 tracking-wide">
        Masuk <strong className="text-ink-900 font-semibold">{formatRm(weeklyInflowRm)}</strong>
        {'  ·  '}
        Keluar <strong className="text-ink-900 font-semibold">{formatRm(totalCost)}</strong>
      </div>
    </div>
  );
}
