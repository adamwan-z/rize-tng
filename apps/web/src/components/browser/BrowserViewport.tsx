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
    <div className="rounded-2xl border border-surface-2 overflow-hidden bg-surface-1 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-2 bg-surface-2/60 text-xs text-ink-700">
        <Globe className="w-3.5 h-3.5 text-tng-blue" />
        <span className="font-mono uppercase tracking-widest text-[10px] font-semibold text-ink-500">
          browser_run · {runId.slice(0, 8)}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-700 tabular-nums">
          step {latest?.step ?? 0} of {steps.length}
        </span>
      </div>
      <div className="aspect-[16/9] bg-surface-2 flex items-center justify-center">
        {latest?.screenshotUrl ? (
          <img
            src={latest.screenshotUrl}
            alt={latest.description}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-sm text-ink-500 font-editorial italic">Tengah buka browser...</div>
        )}
      </div>
      <div className="px-3 py-2 text-sm text-ink-700 border-t border-surface-2 leading-relaxed">
        {latest?.description}
      </div>
    </div>
  );
}
