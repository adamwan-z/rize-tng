import { useEffect, useRef, useState } from 'react';

export type AP2PaymentCardProps = {
  amountRm: number;
  payee: string;
  onHold?: () => void;
};

const HOLD_MS = 800;

export function AP2PaymentCard({ amountRm, payee, onHold }: AP2PaymentCardProps) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up if the component unmounts mid-hold so the callback never fires
  // on a torn-down tree.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const start = () => {
    setHolding(true);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      timerRef.current = null;
      onHold?.();
    }, HOLD_MS);
  };

  const cancel = () => {
    setHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="rounded-2xl p-8 flex flex-col gap-5 shadow-md bg-tng-blue text-white">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-tng-yellow">
        Paying from eWallet
      </span>
      <div>
        <div className="font-display font-extrabold text-[64px] leading-none tracking-tight tabular-nums">
          <span className="font-mono text-base font-medium align-middle mr-2 text-white/70 tracking-wider">
            RM
          </span>
          {amountRm.toFixed(2)}
        </div>
        <div className="text-[15px] mt-2 text-white/80">to {payee}</div>
      </div>
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        className="relative w-full overflow-hidden justify-center inline-flex items-center gap-2 font-display font-bold text-base text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-5 py-4 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition-colors duration-200 select-none cursor-pointer touch-manipulation"
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-tng-yellow-deep origin-left ease-linear"
          style={{
            transform: `scaleX(${holding ? 1 : 0})`,
            transitionProperty: 'transform',
            transitionDuration: holding ? `${HOLD_MS}ms` : '120ms',
          }}
        />
        <span className="relative">{holding ? 'Keep holding...' : 'Hold to pay'}</span>
      </button>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-tng-yellow/70 text-center">
        Agent-initiated · User-signed
      </div>
    </div>
  );
}
