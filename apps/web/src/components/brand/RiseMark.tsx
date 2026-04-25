export function RiseMark() {
  return (
    <div
      className="flex items-center gap-3"
      role="img"
      aria-label="Living with TNG eWallet, GoRise"
    >
      <div className="flex flex-col text-[10px] font-mono font-semibold uppercase tracking-widest text-ink-500 leading-tight">
        <span>Living</span>
        <span>with</span>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="w-2.5 h-2.5 bg-tng-yellow rounded-sm" />
        <div className="flex flex-col leading-none">
          <span className="font-display font-extrabold text-tng-blue text-[20px] tracking-tight">
            TNG
          </span>
          <span className="font-body font-semibold text-ink-700 text-[10px] tracking-wide mt-0.5">
            eWallet
          </span>
        </div>
      </div>
      <div className="w-px h-8 bg-surface-2" aria-hidden />
      <div className="font-display font-extrabold text-[24px] leading-none tracking-tight">
        <span style={{ color: 'var(--tng-blue-deep)' }}>Go</span>
        <span style={{ color: 'var(--tng-blue)' }}>Rise</span>
      </div>
    </div>
  );
}
