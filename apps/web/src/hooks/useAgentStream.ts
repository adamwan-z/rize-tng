import { useCallback, useRef, useState } from 'react';
import type { AgentEvent } from '@tng-rise/shared';
import { postChat } from '../lib/api.js';

type Status = 'idle' | 'streaming' | 'done' | 'error';

// SSE consumer for POST /chat. Calls onEvent for every parsed AgentEvent.
// Returns send() to start a new turn and abort() to cancel an in-flight stream.
export function useAgentStream(opts: {
  sessionId: string;
  onEvent: (event: AgentEvent) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (message: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('streaming');
      setError(null);

      try {
        const res = await postChat(
          { sessionId: opts.sessionId, message },
          controller.signal,
        );
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split on the SSE frame separator (\n\n). The remaining partial frame
          // stays in `buffer` and is completed by the next chunk.
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;
            try {
              const event = JSON.parse(json) as AgentEvent;
              opts.onEvent(event);
              if (event.type === 'done') {
                setStatus('done');
                return;
              }
            } catch (err) {
              console.warn('Failed to parse SSE frame', json, err);
            }
          }
        }
        setStatus('done');
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus('idle');
          return;
        }
        setStatus('error');
        setError(err instanceof Error ? err.message : 'unknown error');
      }
    },
    [opts],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { send, abort, status, error };
}
