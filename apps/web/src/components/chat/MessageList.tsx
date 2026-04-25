import { useEffect, useRef } from 'react';
import { Message } from './Message.js';
import { ToolCallCard } from './ToolCallCard.js';
import { BrowserViewport } from '../browser/BrowserViewport.js';
import { HandoffCard } from '../handoff/HandoffCard.js';

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent_text'; id: string; text: string }
  | {
      kind: 'tool_call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'running' | 'done';
      result?: unknown;
    }
  | {
      kind: 'browser_run';
      id: string;
      runId: string;
      steps: Array<{ step: number; description: string; screenshotUrl?: string }>;
    }
  | {
      kind: 'handoff';
      id: string;
      handoffKind: 'payment' | 'review_submit' | 'email' | 'supply_list';
      payload: Record<string, unknown>;
    }
  | { kind: 'error'; id: string; message: string };

export function MessageList({ items, streaming }: { items: ChatItem[]; streaming: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items]);

  return (
    <div className="flex-1 overflow-y-auto py-6 space-y-4">
      {items.map((item) => {
        switch (item.kind) {
          case 'user':
            return <Message key={item.id} role="user" text={item.text} />;
          case 'agent_text':
            return <Message key={item.id} role="agent" text={item.text} streaming={streaming} />;
          case 'tool_call':
            return (
              <ToolCallCard
                key={item.id}
                name={item.name}
                input={item.input}
                status={item.status}
                result={item.result}
              />
            );
          case 'browser_run':
            return <BrowserViewport key={item.id} runId={item.runId} steps={item.steps} />;
          case 'handoff':
            return <HandoffCard key={item.id} kind={item.handoffKind} payload={item.payload} />;
          case 'error':
            return (
              <div
                key={item.id}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                Alamak, ada masalah: {item.message}
              </div>
            );
        }
      })}
      <div ref={endRef} />
    </div>
  );
}
