import { ClipboardCheck } from 'lucide-react';

export function ReviewSubmitHandoff({ payload }: { payload: Record<string, unknown> }) {
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';
  const url = (payload.applicationUrl as string | undefined) ?? '#';
  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <ClipboardCheck className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Form dah lengkap</span>
      </div>
      <p className="text-sm text-ink-900 mb-3 leading-relaxed">
        Saya dah isi form {grantName}. Sila semak dan klik Submit di sini.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-tng-green px-4 py-2 text-white text-sm font-display font-semibold hover:bg-tng-green/90"
      >
        Take over and submit
      </a>
    </div>
  );
}
