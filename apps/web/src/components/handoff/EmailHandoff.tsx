import { Mail } from 'lucide-react';

export function EmailHandoff({ payload }: { payload: Record<string, unknown> }) {
  const to = (payload.to as string | undefined) ?? '';
  const subject = (payload.subject as string | undefined) ?? '';
  const body = (payload.body as string | undefined) ?? '';
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 mb-2 text-emerald-700">
        <Mail className="w-4 h-4" />
        <span className="font-semibold">Email draf siap</span>
      </div>
      <p className="text-sm text-emerald-900 mb-3">
        {grantName} ni dihantar melalui emel. Saya dah draf untuk Mak Cik. Sila semak dan hantar dari mailbox sendiri.
      </p>
      <details className="mb-3 text-xs">
        <summary className="cursor-pointer text-emerald-700">Tengok preview</summary>
        <div className="mt-2 space-y-1 text-emerald-900">
          <div>
            <span className="font-mono text-[10px] uppercase text-emerald-600">to</span> {to}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-emerald-600">subject</span> {subject}
          </div>
          <pre className="whitespace-pre-wrap font-sans bg-white border border-emerald-200 rounded p-2 mt-1">
            {body}
          </pre>
        </div>
      </details>
      <a
        href={mailto}
        className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700"
      >
        Buka mail client
      </a>
    </div>
  );
}
