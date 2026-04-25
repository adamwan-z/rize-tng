import { ShoppingCart } from 'lucide-react';

export function PaymentHandoff({ payload }: { payload: Record<string, unknown> }) {
  const cartUrl = (payload.cartUrl as string | undefined) ?? '#';
  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 mb-2 text-emerald-700">
        <ShoppingCart className="w-4 h-4" />
        <span className="font-semibold">Cart dah ready</span>
      </div>
      <p className="text-sm text-emerald-900 mb-3">
        Saya dah tambah semua barang dalam cart Lotus. Mak Cik review dan bayar di sini.
      </p>
      <a
        href={cartUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700"
      >
        Buka Lotus cart
      </a>
    </div>
  );
}
