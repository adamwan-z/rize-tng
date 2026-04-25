import { useEffect, useState } from 'react';

type Profile = {
  name: string;
  businessName: string;
  location: { city: string; state: string };
};

export function Greeting() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/merchant')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // Generic fallback if mock-tng is unreachable. The card still renders.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile?.name?.split(' ')[0] ?? 'Mak Cik';
  const business = profile?.businessName ?? 'kedai Mak Cik';

  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
      <div
        aria-hidden
        className="w-12 h-12 rounded-full bg-tng-blue flex items-center justify-center flex-shrink-0 relative"
      >
        <svg width="22" height="14" viewBox="0 0 24 16" fill="none" style={{ color: 'var(--rise-accent)' }}>
          <polyline
            points="2 12 12 4 22 12"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-tng-green border-2 border-surface-1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-ink-900 text-[18px] tracking-tight mb-1 text-balance">
          Hai Mak Cik {name}.
        </div>
        <div className="text-[15px] leading-relaxed text-ink-700 text-pretty">
          Saya Rise, CFO digital untuk {business}. Boleh tanya saya pasal jualan,
          stok, atau grant. Mula dengan{' '}
          <span className="font-mono text-[13px] tracking-wide bg-surface-2 px-1.5 py-0.5 rounded">
            "macam mana business hari ni?"
          </span>
        </div>
      </div>
    </div>
  );
}
