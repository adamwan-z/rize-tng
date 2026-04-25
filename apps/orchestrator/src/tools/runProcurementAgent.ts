import { env } from '../lib/env.js';
import type { AgentEvent } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

// Calls the Python browser-agent service and forwards browser_step events
// through the orchestrator's SSE stream. The browser-agent emits JSON-lines.
export const runProcurementAgent: ToolHandler = async function* (input) {
  const res = await fetch(`${env.BROWSER_AGENT_URL}/run/lotus_procurement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: input }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`browser-agent /run/lotus_procurement returned ${res.status}`);
  }

  yield* forwardBrowserStream(res.body);

  return { ok: true, message: 'Cart ready. Hand off to merchant for payment.' };
};

async function* forwardBrowserStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Browser agent emits one JSON object per line.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const step = JSON.parse(trimmed) as {
          runId: string;
          step: number;
          description: string;
          screenshotUrl?: string;
        };
        yield {
          type: 'browser_step',
          runId: step.runId,
          step: step.step,
          description: step.description,
          ...(step.screenshotUrl ? { screenshotUrl: step.screenshotUrl } : {}),
        };
      } catch {
        // Skip malformed lines. Browser agent is the source of truth.
      }
    }
  }
}
