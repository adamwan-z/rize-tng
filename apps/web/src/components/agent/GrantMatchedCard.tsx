import { formatRm } from '../../lib/format.js';

export type GrantMatchedCardProps = {
  grantName: string;
  agency: string;
  maxAmountRm: number;
  collateralFree?: boolean;
  steps: string[];           // already-completed steps, max 3
  followUpNote?: string;     // italic note line
};

function CheckIcon() {
  return (
    <span className="w-5 h-5 rounded-full bg-tng-green/10 text-tng-green inline-flex items-center justify-center flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8.5l3.5 3.5L13 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function GrantMatchedCard({
  grantName,
  agency,
  maxAmountRm,
  collateralFree,
  steps,
  followUpNote,
}: GrantMatchedCardProps) {
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 pl-7 relative shadow-sm">
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-1 bg-tng-yellow rounded-r-sm"
      />
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-3">
        Grant matched · {agency}
      </div>
      <h3 className="font-display font-bold text-[22px] leading-tight tracking-tight text-ink-900 mb-1">
        {grantName}
      </h3>
      <p className="font-mono text-[13px] text-ink-700 tracking-wide mb-4">
        Up to {formatRm(maxAmountRm)}
        {collateralFree ? ' · No collateral required' : ''}
      </p>
      <ul className="flex flex-col gap-3 mb-4">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 text-[15px] text-ink-900">
            <CheckIcon />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      {followUpNote && (
        <div
          className="font-editorial italic text-base text-ink-700 px-4 py-3 rounded-lg"
          style={{ background: 'rgba(255, 107, 53, 0.08)' }}
        >
          {followUpNote}
        </div>
      )}
    </div>
  );
}
