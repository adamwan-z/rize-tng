type TngBarProps = {
  thin?: boolean;
};

// 70% blue left + 30% yellow right with a 45 degree seam.
// Seam length matches bar height for a true 45 degree cut.
export function TngBar({ thin = false }: TngBarProps) {
  const h = thin ? 8 : 14;
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        height: h,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 30% 0 0',
          background: 'var(--tng-blue)',
          clipPath: `polygon(0 0, 100% 0, calc(100% - ${h}px) 100%, 0 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: `0 0 0 70%`,
          background: 'var(--tng-yellow)',
          clipPath: `polygon(${h}px 0, 100% 0, 100% 100%, 0 100%)`,
        }}
      />
    </div>
  );
}
