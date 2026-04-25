import { Globe } from 'lucide-react';

export function BrowserViewport({
  runId,
  steps,
}: {
  runId: string;
  steps: Array<{ step: number; description: string; screenshotUrl?: string }>;
}) {
  const latest = steps[steps.length - 1];
  return (
    <div className="rounded-xl border border-neutral-300 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
        <Globe className="w-3.5 h-3.5" />
        <span className="font-mono">browser_run · {runId.slice(0, 8)}</span>
        <span className="ml-auto">
          step {latest?.step ?? 0} of {steps.length}
        </span>
      </div>
      <div className="aspect-[16/9] bg-neutral-100 flex items-center justify-center">
        {latest?.screenshotUrl ? (
          <img
            src={latest.screenshotUrl}
            alt={latest.description}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-sm text-neutral-500">Tengah buka browser...</div>
        )}
      </div>
      <div className="px-3 py-2 text-sm text-neutral-700 border-t border-neutral-200">
        {latest?.description}
      </div>
    </div>
  );
}
