import type { ChatRequest } from '@tng-rise/shared';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? '';

// Returns the raw fetch Response so the caller can read the SSE stream from
// `response.body`. We do not use EventSource since it is GET-only.
export async function postChat(req: ChatRequest, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${ORCHESTRATOR_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /chat failed: ${res.status} ${text}`);
  }
  if (!res.body) {
    throw new Error('Response has no body');
  }
  return res;
}
