import { useCallback, useMemo, useState } from 'react';
import type { AgentEvent } from '@tng-rise/shared';
import { useAgentStream } from '../../hooks/useAgentStream.js';
import { MessageList, type ChatItem } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { Greeting } from './Greeting.js';
import { playHandoffCue } from '../../lib/sound.js';

export function ChatWindow({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);

  const onEvent = useCallback((event: AgentEvent) => {
    if (event.type === 'handoff') playHandoffCue();
    setItems((prev) => mergeEvent(prev, event));
  }, []);

  const { send, status } = useAgentStream({ sessionId, onEvent });

  const onSubmit = useCallback(
    async (message: string) => {
      setItems((prev) => [
        ...prev,
        { kind: 'user', id: crypto.randomUUID(), text: message },
        { kind: 'agent_text', id: crypto.randomUUID(), text: '' },
      ]);
      await send(message);
    },
    [send],
  );

  // The grant shortcut is a button, not a typed message. Skip the user bubble
  // and go straight to the agent's reply so the chat reads as a one-tap action.
  const sendSilent = useCallback(
    async (message: string) => {
      setItems((prev) => [
        ...prev,
        { kind: 'agent_text', id: crypto.randomUUID(), text: '' },
      ]);
      await send(message);
    },
    [send],
  );

  // Unlock the grant shortcut once the merchant has actually completed a Lotus
  // checkout. Sticky for the rest of the session so it reads as "next step
  // unlocked" rather than a fleeting toast — and hide it again once she has
  // applied for every grant in the KB this session, so the badge doesn't keep
  // pulsing when there is nothing left to apply for.
  //
  // TOTAL_GRANTS_IN_KB mirrors the count in packages/grants-kb. Bump it if a
  // grant is added there.
  const TOTAL_GRANTS_IN_KB = 2;
  const showGrantBadge = useMemo(() => {
    const lotusCompleted = items.some(
      (it) =>
        it.kind === 'tool_call' &&
        it.name === 'confirmProcurementCheckout' &&
        it.status === 'done' &&
        (it.result as { ok?: boolean } | undefined)?.ok === true,
    );
    if (!lotusCompleted) return false;

    const appliedGrantIds = new Set<string>();
    for (const it of items) {
      if (
        it.kind === 'tool_call' &&
        it.name === 'runGrantAgent' &&
        it.status === 'done'
      ) {
        const r = it.result as { ok?: boolean; grantId?: string } | undefined;
        if (r?.ok === true && typeof r.grantId === 'string') {
          appliedGrantIds.add(r.grantId);
        }
      }
    }
    return appliedGrantIds.size < TOTAL_GRANTS_IN_KB;
  }, [items]);

  const onGrantClick = useCallback(() => {
    void sendSilent('business grant');
  }, [sendSilent]);

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto px-4">
      <div className="pt-6">
        <Greeting />
      </div>
      <MessageList items={items} streaming={status === 'streaming'} />
      <ChatInput
        onSubmit={onSubmit}
        disabled={status === 'streaming'}
        showGrantBadge={showGrantBadge}
        onGrantClick={onGrantClick}
      />
    </div>
  );
}

// Reducer that folds AgentEvents into the rendered chat items list.
function mergeEvent(items: ChatItem[], event: AgentEvent): ChatItem[] {
  switch (event.type) {
    case 'text': {
      // Append to the most recent agent_text bubble.
      const last = items[items.length - 1];
      if (last && last.kind === 'agent_text') {
        return [...items.slice(0, -1), { ...last, text: last.text + event.content }];
      }
      return [...items, { kind: 'agent_text', id: crypto.randomUUID(), text: event.content }];
    }
    case 'tool_call':
      return [
        ...items,
        {
          kind: 'tool_call',
          id: event.id,
          name: event.name,
          input: event.input,
          status: 'running',
        },
      ];
    case 'tool_result':
      return items.map((item) =>
        item.kind === 'tool_call' && item.id === event.id
          ? { ...item, status: 'done', result: event.result }
          : item,
      );
    case 'browser_step':
      return upsertBrowserStep(items, event);
    case 'handoff':
      return [
        ...items,
        {
          kind: 'handoff',
          id: crypto.randomUUID(),
          handoffKind: event.kind as 'payment' | 'review_submit' | 'email' | 'decline',
          payload: event.payload,
        },
      ];
    case 'error':
      return [...items, { kind: 'error', id: crypto.randomUUID(), message: event.message }];
    case 'done':
      // No-op. Hook flips status. We could remove empty trailing agent_text bubbles here.
      return items;
  }
}

function upsertBrowserStep(
  items: ChatItem[],
  event: Extract<AgentEvent, { type: 'browser_step' }>,
): ChatItem[] {
  const existing = items.find(
    (i) => i.kind === 'browser_run' && i.runId === event.runId,
  );
  if (existing && existing.kind === 'browser_run') {
    return items.map((i) =>
      i === existing
        ? {
            ...existing,
            steps: [
              ...existing.steps,
              {
                step: event.step,
                description: event.description,
                ...(event.screenshotUrl ? { screenshotUrl: event.screenshotUrl } : {}),
              },
            ],
          }
        : i,
    );
  }
  return [
    ...items,
    {
      kind: 'browser_run',
      id: crypto.randomUUID(),
      runId: event.runId,
      steps: [
        {
          step: event.step,
          description: event.description,
          ...(event.screenshotUrl ? { screenshotUrl: event.screenshotUrl } : {}),
        },
      ],
    },
  ];
}
