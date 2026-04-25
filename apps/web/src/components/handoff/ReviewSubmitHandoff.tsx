import { CheckCircle2 } from 'lucide-react';

export function ReviewSubmitHandoff({ payload }: { payload: Record<string, unknown> }) {
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';
  const referenceNumber = payload.referenceNumber as string | undefined;
  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Permohonan dah submit</span>
      </div>
      <p className="text-sm text-ink-900 mb-2 leading-relaxed">
        Borang {grantName} dah dihantar. Mak Cik tunggu update dari pihak agency ya.
      </p>
      {referenceNumber && (
        <p className="text-sm text-ink-700 leading-relaxed">
          Reference: <span className="font-mono font-semibold text-ink-900">{referenceNumber}</span>
        </p>
      )}
    </div>
  );
}
