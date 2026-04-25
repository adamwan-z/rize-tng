import type { AgentEvent } from '@tng-rise/shared';

// Format an AgentEvent as an SSE `data:` frame. The frontend decodes the JSON
// payload and switches on `event.type`. We do not use SSE event names because
// the discriminator lives inside the payload, which keeps the schema in one place.
export function formatSse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering so events flush immediately. Some Node middlewares
    // (and Nginx in front of the container) buffer otherwise and the user sees
    // nothing until the stream ends.
    'X-Accel-Buffering': 'no',
  };
}
