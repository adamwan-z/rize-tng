import { ShoppingBag } from 'lucide-react';

type Item = { sku: string; quantity: number; name?: string };

export function ProcurementConfirmHandoff({ payload }: { payload: Record<string, unknown> }) {
  const items = (payload.items as Item[] | undefined) ?? [];
  const subtotal = (payload.subtotal as string | undefined) ?? null;
  const total = (payload.total as string | undefined) ?? subtotal;

  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-3 text-tng-green">
        <ShoppingBag className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Cart siap untuk checkout</span>
      </div>
      <ul className="mb-3 space-y-1 text-sm text-ink-900">
        {items.map((it) => (
          <li key={it.sku} className="flex justify-between gap-3">
            <span>
              <span className="font-semibold">{it.quantity} ×</span> {it.name ?? it.sku}
            </span>
          </li>
        ))}
      </ul>
      <div className="text-sm border-t border-tng-green/20 pt-2 space-y-1">
        {subtotal && (
          <div className="flex justify-between text-ink-700">
            <span>Subtotal</span>
            <span>{subtotal}</span>
          </div>
        )}
        {total && (
          <div className="flex justify-between text-ink-900">
            <span className="font-semibold">Total dengan delivery</span>
            <span className="font-semibold">{total}</span>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-ink-700">
        Reply <span className="font-semibold">yes</span> dalam chat untuk confirm bayar. Browser
        akan tutup lepas order placed.
      </p>
    </div>
  );
}
