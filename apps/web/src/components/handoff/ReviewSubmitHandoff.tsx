import { ClipboardCheck } from 'lucide-react';

export function ReviewSubmitHandoff({ payload }: { payload: Record<string, unknown> }) {
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';
  const url = (payload.applicationUrl as string | undefined) ?? '#';
  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 mb-2 text-emerald-700">
        <ClipboardCheck className="w-4 h-4" />
        <span className="font-semibold">Form dah lengkap</span>
      </div>
      <p className="text-sm text-emerald-900 mb-3">
        Saya dah isi form {grantName}. Sila semak dan klik Submit di sini.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700"
      >
        Take over and submit
      </a>
    </div>
  );
}
