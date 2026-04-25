import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { ChatRequest } from '@tng-rise/shared';
import { runAgent } from '../agent/core.js';
import { formatSse, sseHeaders } from '../lib/sse.js';

export const chat = new Hono();

chat.post('/chat', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid ChatRequest', issues: parsed.error.issues }, 400);
  }

  for (const [key, value] of Object.entries(sseHeaders())) {
    c.header(key, value);
  }

  return stream(c, async (s) => {
    s.onAbort(() => {
      // Client disconnected. The async generator is GC'd by the runtime.
    });

    try {
      for await (const event of runAgent({
        sessionId: parsed.data.sessionId,
        userMessage: parsed.data.message,
      })) {
        await s.write(formatSse(event));
        if (event.type === 'done') return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      await s.write(formatSse({ type: 'error', message }));
      await s.write(formatSse({ type: 'done' }));
    }
  });
});
