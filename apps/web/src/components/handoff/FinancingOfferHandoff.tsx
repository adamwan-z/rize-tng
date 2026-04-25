import { LifeBuoy } from 'lucide-react';
import { formatRm } from '../../lib/format.js';

type Terms = {
  productName: string;
  providerName: string;
  tenureDays: number;
  flatFeePct: number;
  aprPct: number;
  dailyDeductionPctOfSales: number;
  summary: string;
  tnc: string[];
};

export function FinancingOfferHandoff({ payload }: { payload: Record<string, unknown> }) {
  const totalRm = (payload.totalRm as number | undefined) ?? null;
  const total = (payload.total as string | undefined) ?? null;
  const cashOnHandRm = (payload.cashOnHandRm as number | undefined) ?? 0;
  const shortfallRm = (payload.shortfallRm as number | undefined) ?? 0;
  const approvedAmountRm = (payload.approvedAmountRm as number | undefined) ?? 0;
  const repayableAmountRm = (payload.repayableAmountRm as number | undefined) ?? 0;
  const terms = payload.terms as Terms | undefined;

  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 pl-7 relative shadow-sm">
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-1 bg-tng-orange rounded-r-sm"
      />
      <div className="flex items-center gap-2 mb-3 text-tng-orange">
        <LifeBuoy className="w-4 h-4" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest">
          {terms?.productName ?? 'SOS Credit'} · pre-approved
        </span>
      </div>
      <h3 className="font-display font-bold text-[20px] leading-tight tracking-tight text-ink-900 mb-2 text-balance">
        Cash tak cukup hari ni. SOS Credit boleh tolong cover.
      </h3>
      {terms?.summary && (
        <p className="text-[15px] leading-relaxed text-ink-700 mb-4">{terms.summary}</p>
      )}

      <dl className="grid grid-cols-2 gap-3 mb-4 text-[13px]">
        <div className="bg-surface-2 rounded-lg px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Cash on hand
          </dt>
          <dd className="font-display font-bold text-ink-900 mt-0.5 tabular-nums">
            {formatRm(cashOnHandRm)}
          </dd>
        </div>
        <div className="bg-surface-2 rounded-lg px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Total cart
          </dt>
          <dd className="font-display font-bold text-ink-900 mt-0.5 tabular-nums">
            {totalRm !== null ? formatRm(totalRm) : (total ?? '-')}
          </dd>
        </div>
      </dl>

      <div
        className="rounded-xl p-4 mb-4 border"
        style={{
          background: 'rgba(255, 184, 0, 0.10)',
          borderColor: 'rgba(255, 184, 0, 0.45)',
        }}
      >
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-700">
            Approved untuk Mak Cik
          </span>
          <span className="font-display font-bold text-[24px] text-ink-900 tabular-nums">
            {formatRm(approvedAmountRm)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-700">
          <span>Repay dalam {terms?.tenureDays ?? 30} hari</span>
          <span className="tabular-nums font-semibold text-ink-900">
            {formatRm(repayableAmountRm)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[12px] text-ink-500 mt-1">
          <span>Shortfall ditampung</span>
          <span className="tabular-nums">{formatRm(shortfallRm)}</span>
        </div>
      </div>

      {terms?.tnc && terms.tnc.length > 0 && (
        <div className="mb-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-500 mb-2">
            Terma & Syarat
          </div>
          <ol className="space-y-1.5 text-[13px] text-ink-700 leading-relaxed list-decimal list-inside">
            {terms.tnc.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="border-t border-surface-2 pt-3 text-[13px] text-ink-700">
        Reply <span className="font-semibold text-ink-900">ya</span> atau{' '}
        <span className="font-semibold text-ink-900">setuju</span> dalam chat untuk terima terma.
        Lepas tu saya tanya sekali lagi sebelum bayar.
      </div>
    </div>
  );
}
