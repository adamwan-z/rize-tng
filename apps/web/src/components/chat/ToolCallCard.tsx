import { useState } from 'react';
import { Loader2, ChevronRight, Wrench } from 'lucide-react';
import clsx from 'clsx';

export function ToolCallCard({
  name,
  input,
  status,
  result,
}: {
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'done';
  result?: unknown;
}) {
  const [open, setOpen] = useState(status === 'running');

  return (
    <div className="rounded-xl border border-surface-2 bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-surface-2 cursor-pointer transition-colors duration-200 rounded-xl"
      >
        {status === 'running' ? (
          <Loader2 className="w-4 h-4 animate-spin text-tng-blue" />
        ) : (
          <Wrench className="w-4 h-4 text-ink-500" />
        )}
        <span className="font-mono text-xs">{name}</span>
        <span className={clsx('text-xs', status === 'running' ? 'text-tng-blue' : 'text-ink-500')}>
          {status === 'running' ? 'tengah cari...' : 'siap'}
        </span>
        <span className="ml-auto text-ink-500">
          <ChevronRight
            className={clsx(
              'w-4 h-4 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <div>
            <div className="text-ink-500 font-mono uppercase tracking-widest text-[10px] mb-1">input</div>
            <pre className="font-mono bg-surface-1 border border-surface-2 rounded-lg px-2 py-1 overflow-x-auto text-ink-900">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <div className="text-ink-500 font-mono uppercase tracking-widest text-[10px] mb-1">result</div>
              <pre className="font-mono bg-surface-1 border border-surface-2 rounded-lg px-2 py-1 overflow-x-auto max-h-48 text-ink-900">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
