import { useState } from 'react';
import { Loader2, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
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
    <div className="rounded-lg border border-neutral-200 bg-neutral-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        {status === 'running' ? (
          <Loader2 className="w-4 h-4 animate-spin text-tng-500" />
        ) : (
          <Wrench className="w-4 h-4 text-neutral-500" />
        )}
        <span className="font-mono text-xs">{name}</span>
        <span className={clsx('text-xs', status === 'running' ? 'text-tng-600' : 'text-neutral-500')}>
          {status === 'running' ? 'tengah cari...' : 'siap'}
        </span>
        <span className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <div>
            <div className="text-neutral-500">input</div>
            <pre className="font-mono bg-white border border-neutral-200 rounded px-2 py-1 overflow-x-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <div className="text-neutral-500">result</div>
              <pre className="font-mono bg-white border border-neutral-200 rounded px-2 py-1 overflow-x-auto max-h-48">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
