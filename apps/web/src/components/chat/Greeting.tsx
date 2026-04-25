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
      <div className="w-12 h-12 rounded-full bg-tng-blue flex items-center justify-center text-white font-display font-bold text-lg flex-shrink-0">
        R
      </div>
      <div className="flex-1">
        <div className="font-display font-bold text-ink-900 text-[18px] tracking-tight mb-1">
          Hai Mak Cik {name}.
        </div>
        <div className="text-[15px] leading-relaxed text-ink-700">
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
