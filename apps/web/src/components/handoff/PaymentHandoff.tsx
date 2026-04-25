import { ShoppingCart } from 'lucide-react';

export function PaymentHandoff({ payload }: { payload: Record<string, unknown> }) {
  const cartUrl = (payload.cartUrl as string | undefined) ?? '#';
  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <ShoppingCart className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Cart dah ready</span>
      </div>
      <p className="text-sm text-ink-900 mb-3 leading-relaxed">
        Saya dah tambah semua barang dalam cart Lotus. Mak Cik review dan bayar di sini.
      </p>
      <a
        href={cartUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-tng-yellow hover:bg-tng-yellow-deep px-4 py-2 text-ink-900 text-sm font-display font-bold shadow-cta active:translate-y-0.5 active:shadow-none transition-colors duration-200 cursor-pointer"
      >
        Buka Lotus cart
      </a>
    </div>
  );
}
