import { formatRm } from '../../lib/format.js';

export type DeclineCardProps = {
  what: string;                 // e.g. "second cash advance this month"
  reason: string;               // one sentence explanation in BI
  cashOnHandRm?: number;        // optional, surfaces the CFO's reasoning
  monthlyDebtServiceRm?: number;
  alternative?: {               // the "do this instead" path
    label: string;
    cta: string;
    onClick?: () => void;
  };
};

export function DeclineCard({
  what,
  reason,
  cashOnHandRm,
  monthlyDebtServiceRm,
  alternative,
}: DeclineCardProps) {
  return (
    <div
      className="bg-surface-1 border border-surface-2 rounded-2xl p-6 pl-7 relative shadow-sm"
    >
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-1 bg-tng-orange rounded-r-sm"
      />
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-tng-orange mb-3">
        Tahan dulu · CFO check
      </div>
      <h3 className="font-display font-bold text-[20px] leading-tight tracking-tight text-ink-900 mb-2 text-balance">
        Saya tak boleh approve {what} sekarang.
      </h3>
      <p className="text-[15px] leading-relaxed text-ink-700 mb-4">{reason}</p>
      {(cashOnHandRm !== undefined || monthlyDebtServiceRm !== undefined) && (
        <dl className="grid grid-cols-2 gap-3 mb-4 text-[13px]">
          {cashOnHandRm !== undefined && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Cash on hand
              </dt>
              <dd className="font-display font-bold text-ink-900 mt-0.5 tabular-nums">
                {formatRm(cashOnHandRm)}
              </dd>
            </div>
          )}
          {monthlyDebtServiceRm !== undefined && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Bayar bulanan (loans)
              </dt>
              <dd className="font-display font-bold text-ink-900 mt-0.5">
                {formatRm(monthlyDebtServiceRm)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {alternative && (
        <div className="border-t border-surface-2 pt-4 flex items-center justify-between gap-3">
          <span className="text-[14px] text-ink-700">{alternative.label}</span>
          <button
            type="button"
            onClick={alternative.onClick}
            className="inline-flex items-center gap-2 font-display font-semibold text-[14px] text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-4 py-2 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition-colors duration-200 cursor-pointer"
          >
            {alternative.cta}
          </button>
        </div>
      )}
    </div>
  );
}
