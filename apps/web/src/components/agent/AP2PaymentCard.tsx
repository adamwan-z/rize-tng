export type AP2PaymentCardProps = {
  amountRm: number;
  payee: string;
  onHold?: () => void;
};

export function AP2PaymentCard({ amountRm, payee, onHold }: AP2PaymentCardProps) {
  return (
    <div
      className="rounded-2xl p-8 flex flex-col gap-5 shadow-md"
      style={{ background: 'var(--tng-blue)', color: 'var(--surface-1)' }}
    >
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-tng-yellow">
        Paying from eWallet
      </span>
      <div>
        <div className="font-display font-extrabold text-[64px] leading-none tracking-tight">
          <span className="font-mono text-base font-medium align-middle mr-2 text-white/70 tracking-wider">
            RM
          </span>
          {amountRm.toFixed(2)}
        </div>
        <div className="text-[15px] mt-2 text-white/80">to {payee}</div>
      </div>
      <button
        type="button"
        onClick={onHold}
        className="w-full justify-center inline-flex items-center gap-2 font-display font-bold text-base text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-5 py-4 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition"
      >
        Hold to pay
      </button>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-tng-yellow/70 text-center">
        Agent-initiated · User-signed
      </div>
    </div>
  );
}
