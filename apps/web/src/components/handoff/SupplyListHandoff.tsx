import { ShoppingCart, ExternalLink } from 'lucide-react';
import { formatRm } from '../../lib/format.js';

type SupplyItem = {
  name: string;
  suggestedQty: number;
  unit: string;
  costRm: number;
  urgency: 'critical' | 'low';
};

export function SupplyListHandoff({ payload }: { payload: Record<string, unknown> }) {
  const items = (payload.items as SupplyItem[] | undefined) ?? [];
  const totalCostRm = (payload.totalCostRm as number | undefined) ?? 0;
  const lotusUrl = (payload.lotusUrl as string | undefined) ?? 'https://www.lotuss.com.my/';

  const critical = items.filter((i) => i.urgency === 'critical');
  const low = items.filter((i) => i.urgency === 'low');

  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green, #008443)',
      }}
    >
      <div className="flex items-center gap-2 mb-1 text-tng-green">
        <ShoppingCart className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Supply run · list draf</span>
      </div>
      <p className="text-sm text-ink-700 mb-4 leading-relaxed">
        Saya susun ikut urgency. Mak Cik review dulu, kalau ok boleh order sendiri.
      </p>

      {critical.length > 0 && (
        <SupplyGroup
          label="Urgent · restock dalam 3 hari"
          accentClass="bg-tng-orange"
          items={critical}
        />
      )}
      {low.length > 0 && (
        <SupplyGroup
          label="Low · restock minggu ni"
          accentClass="bg-tng-yellow-deep"
          items={low}
        />
      )}

      <div className="mt-4 pt-3 border-t border-surface-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          Anggaran total
        </span>
        <span className="font-display font-bold text-[20px] text-ink-900 tabular-nums">
          {formatRm(totalCostRm)}
        </span>
      </div>

      <a
        href={lotusUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-tng-yellow hover:bg-tng-yellow-deep px-4 py-2 text-ink-900 text-sm font-display font-bold shadow-cta active:translate-y-0.5 active:shadow-none transition-colors duration-200 cursor-pointer"
      >
        Buka Lotus
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <p className="mt-2 text-[12px] text-ink-500 leading-relaxed">
        Atau cakap "order live" kalau nak saya checkout sendiri.
      </p>
    </div>
  );
}

function SupplyGroup({
  label,
  accentClass,
  items,
}: {
  label: string;
  accentClass: string;
  items: SupplyItem[];
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${accentClass}`} aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          {label}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-baseline justify-between gap-3 bg-surface-1 border border-surface-2 rounded-lg px-3 py-2"
          >
            <span className="font-display font-semibold text-[14px] text-ink-900 truncate">
              {item.name}
            </span>
            <span className="font-mono text-[11px] text-ink-500 shrink-0">
              {item.suggestedQty} {item.unit}
            </span>
            <span className="font-display font-bold text-[14px] text-ink-900 tabular-nums shrink-0">
              {formatRm(item.costRm)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
