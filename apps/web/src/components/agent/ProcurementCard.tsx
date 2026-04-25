import { formatRm } from '../../lib/format.js';

export type ProcurementItem = {
  name: string;
  qty: string;       // "10 kg", "2 L"
  priceRm: number;   // 0 means "price not yet known"; the card hides prices when every item is 0
};

export type ProcurementCardProps = {
  source: string;    // "Lotus's"
  live?: boolean;
  items: ProcurementItem[];
  onPay?: () => void;
  onEdit?: () => void;
};

export function ProcurementCard({
  source,
  live = false,
  items,
  onPay,
  onEdit,
}: ProcurementCardProps) {
  // Hide price column and total when no item carries a price. Avoids RM 0.00
  // showing up everywhere while the orchestrator's tool_result is still just
  // {ok, message} and per-item prices come from the browser agent's catalog.
  const showPrices = items.some((i) => i.priceRm > 0);
  const total = showPrices ? items.reduce((sum, i) => sum + i.priceRm, 0) : 0;
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-700">
          {live && (
            <span className="relative w-2 h-2 rounded-full bg-tng-green">
              <span className="absolute inset-[-4px] rounded-full border border-tng-green opacity-40 animate-ping" />
            </span>
          )}
          BrowserUse · {source}
        </span>
        {live && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tng-blue-100 text-tng-blue font-mono text-[11px] font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-tng-blue" />
            Live
          </span>
        )}
      </div>
      <div>
        {items.map((item, i) => (
          <div
            key={i}
            className={`grid ${
              showPrices ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'
            } gap-3 py-2.5 items-baseline ${
              i < items.length - 1 ? 'border-b border-surface-2' : ''
            }`}
          >
            <div>
              <span className="text-[15px] text-ink-900">{item.name}</span>
              <span className="ml-2 text-ink-500 font-mono text-xs tracking-wide">
                {item.qty}
              </span>
            </div>
            {showPrices && (
              <span className="font-mono text-sm font-medium text-ink-900 tracking-wide">
                {formatRm(item.priceRm)}
              </span>
            )}
          </div>
        ))}
      </div>
      {showPrices ? (
        <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline pt-3 border-t-2 border-ink-900">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-700">
            Total
          </span>
          <span className="font-display font-bold text-[22px] tracking-tight text-ink-900">
            {formatRm(total)}
          </span>
        </div>
      ) : (
        <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500 pt-3 border-t border-surface-2">
          Total at Lotus's checkout
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPay}
          className="flex-1 justify-center inline-flex items-center gap-2 font-display font-bold text-[15px] text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-5 py-3 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition"
        >
          Pay with eWallet
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 justify-center inline-flex items-center gap-2 font-display font-semibold text-[15px] text-ink-900 bg-transparent border border-surface-2 hover:bg-surface-2 px-5 py-3 rounded-lg"
        >
          Edit list
        </button>
      </div>
    </div>
  );
}
