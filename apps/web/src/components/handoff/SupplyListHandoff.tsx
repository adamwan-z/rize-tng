import { ShoppingCart, ExternalLink } from 'lucide-react';

type SupplyItem = {
  name: string;
  qty: number;
  unit?: string;
};

export function SupplyListHandoff({ payload }: { payload: Record<string, unknown> }) {
  const items = (payload.items as SupplyItem[] | undefined) ?? [];
  const lotusUrl = (payload.lotusUrl as string | undefined) ?? 'https://www.lotuss.com.my/';

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
        Ni list yang Mak Cik dah confirm. Review dulu, kalau ok boleh order sendiri.
      </p>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-baseline justify-between gap-3 bg-surface-1 border border-surface-2 rounded-lg px-3 py-2"
          >
            <span className="font-display font-semibold text-[14px] text-ink-900 truncate">
              {item.name}
            </span>
            <span className="font-mono text-[12px] text-ink-700 shrink-0 tabular-nums">
              {item.qty}{item.unit ? ` ${item.unit}` : ''}
            </span>
          </li>
        ))}
      </ul>

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
