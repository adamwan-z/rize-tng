import { Mail } from 'lucide-react';

export function EmailHandoff({ payload }: { payload: Record<string, unknown> }) {
  const to = (payload.to as string | undefined) ?? '';
  const subject = (payload.subject as string | undefined) ?? '';
  const body = (payload.body as string | undefined) ?? '';
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <Mail className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Email draf siap</span>
      </div>
      <p className="text-sm text-ink-900 mb-3 leading-relaxed">
        {grantName} ni dihantar melalui emel. Saya dah draf untuk Mak Cik. Sila
        semak dan hantar dari mailbox sendiri.
      </p>
      <details className="mb-3 text-xs">
        <summary className="cursor-pointer text-tng-green font-mono uppercase tracking-wider">
          Tengok preview
        </summary>
        <div className="mt-2 space-y-1 text-ink-900">
          <div>
            <span className="font-mono text-[10px] uppercase text-ink-500">to</span> {to}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-ink-500">subject</span>{' '}
            {subject}
          </div>
          <pre className="whitespace-pre-wrap font-body bg-surface-1 border border-surface-2 rounded p-2 mt-1">
            {body}
          </pre>
        </div>
      </details>
      <a
        href={mailto}
        className="inline-flex items-center gap-2 rounded-lg bg-tng-yellow hover:bg-tng-yellow-deep px-4 py-2 text-ink-900 text-sm font-display font-bold shadow-cta active:translate-y-0.5 active:shadow-none transition-colors duration-200 cursor-pointer"
      >
        Buka mail client
      </a>
    </div>
  );
}
