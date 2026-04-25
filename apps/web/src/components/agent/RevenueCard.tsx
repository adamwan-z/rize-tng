import { useState } from 'react';
import { formatRm, formatPercent } from '../../lib/format.js';

export type RevenueCardProps = {
  eyebrow?: string;
  totalRm: number;
  deltaPercent?: number;       // omit to hide the delta pill
  comparedTo?: string;         // required when deltaPercent is provided
  orderCount: number;
  dailyInflowRm: number[];     // length 7, oldest first; rightmost is "today"
  topSeller?: { name: string; rm: number; orders: number };
};

// Malay short day names. Index matches Date.getDay() (0=Sun, 6=Sat).
const MS_DAY_SHORT = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];

export function RevenueCard({
  eyebrow = 'Today · Kampung Baru',
  totalRm,
  deltaPercent,
  comparedTo,
  orderCount,
  dailyInflowRm,
  topSeller,
}: RevenueCardProps) {
  const hasDelta = typeof deltaPercent === 'number';
  const positive = hasDelta ? deltaPercent! >= 0 : false;
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {eyebrow}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display font-extrabold text-[56px] leading-none tracking-tight text-ink-900">
          <span className="font-mono text-sm font-medium tracking-wider text-ink-500 mr-2">
            RM
          </span>
          {totalRm.toFixed(2)}
        </div>
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-widest ${
              positive ? 'bg-tng-green/10 text-tng-green' : 'bg-tng-pink/10 text-tng-pink'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${positive ? 'bg-tng-green' : 'bg-tng-pink'}`} />
            {formatPercent(deltaPercent!)}
          </span>
        )}
      </div>
      <div className="font-mono text-[13px] text-ink-500 tracking-wide">
        {hasDelta && comparedTo ? `vs ${comparedTo} · ` : ''}{orderCount} orders
      </div>

      <DailyBars values={dailyInflowRm} />

      {topSeller && (
        <div className="bg-surface-2 rounded-lg px-4 py-3 text-sm text-ink-700">
          <strong className="text-ink-900 font-semibold">Top seller:</strong>{' '}
          {topSeller.name}, {formatRm(topSeller.rm)} across {topSeller.orders} orders.
        </div>
      )}
    </div>
  );
}

function DailyBars({ values }: { values: number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...values, 1);
  const peakIdx = values.lastIndexOf(max);
  const todayDow = new Date().getDay();
  const dayLabels = values.map((_, i) => {
    const dow = (todayDow - (values.length - 1 - i) + 7) % 7;
    return MS_DAY_SHORT[dow] ?? '';
  });

  // Default the active read-out to peak so the card always says something
  // meaningful at rest. Hover overrides.
  const activeIdx = hovered ?? peakIdx;
  const activeRm = values[activeIdx] ?? 0;
  const activeLabel = dayLabels[activeIdx] ?? '';
  const activeIsToday = activeIdx === values.length - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3 font-mono text-[11px] text-ink-500">
        <span className="uppercase tracking-widest">7 hari lepas</span>
        <span>
          <strong className="text-ink-900 font-semibold tabular-nums">
            {formatRm(activeRm)}
          </strong>{' '}
          <span className="text-ink-500">
            · {activeIsToday ? `${activeLabel} (hari ni)` : activeLabel}
            {hovered === null && activeIdx === peakIdx && !activeIsToday ? ' (paling laku)' : ''}
          </span>
        </span>
      </div>
      <div
        className="flex items-end gap-1.5 h-20"
        onMouseLeave={() => setHovered(null)}
      >
        {values.map((value, i) => {
          const isToday = i === values.length - 1;
          const isActive = i === activeIdx;
          const heightPct = Math.max(8, (value / max) * 100);
          return (
            <button
              key={i}
              type="button"
              title={`${dayLabels[i]}: ${formatRm(value)}`}
              onMouseEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              aria-label={`${dayLabels[i]}: ${formatRm(value)}`}
              className={`flex-1 rounded-t-[3px] cursor-default transition-opacity duration-150 ${
                isToday ? 'bg-tng-yellow' : 'bg-tng-blue-100'
              } ${
                hovered !== null && !isActive ? 'opacity-50' : 'opacity-100'
              } hover:opacity-100`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-end gap-1.5 font-mono text-[10px] text-ink-500">
        {dayLabels.map((label, i) => {
          const isToday = i === values.length - 1;
          const isActive = i === activeIdx;
          return (
            <span
              key={i}
              className={`flex-1 text-center ${isActive ? 'text-ink-900 font-semibold' : ''} ${
                isToday && !isActive ? 'text-ink-700' : ''
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
