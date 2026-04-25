import { env } from '../lib/env.js';
import type { AgentEvent } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

// Phase 2 of the live Lotus flow. Resumes the paused browser run identified
// by `runId`, clicks Place Order on the live checkout page, captures the
// order reference, and lets browser-agent close the browser. Call ONLY after
// runProcurementAgent has paused at checkout AND the merchant has explicitly
// confirmed in chat.
export const confirmProcurementCheckout: ToolHandler = async function* (input) {
  const runId = input.runId as string | undefined;
  if (!runId) {
    throw new Error('confirmProcurementCheckout requires a runId from runProcurementAgent.');
  }

  const url = `${env.BROWSER_AGENT_URL}/run/lotus_procurement/${encodeURIComponent(runId)}/confirm`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : '';
    throw new Error(
      `browser-agent /run/lotus_procurement/${runId}/confirm returned ${res.status} ${detail}`,
    );
  }

  let orderRef: string | null = null;
  let total: string | null = null;

  for await (const event of forwardBrowserStream(res.body)) {
    if (event.result) {
      const r = event.result as Record<string, unknown>;
      if (typeof r.orderRef === 'string') orderRef = r.orderRef;
      if (typeof r.total === 'string') total = r.total;
    }
    const { result: _result, ...forFe } = event;
    yield forFe as AgentEvent;
  }

  return {
    ok: true,
    runId,
    orderRef,
    total,
    message: orderRef
      ? `Order placed. Reference ${orderRef}. Tell the merchant the order is confirmed and read out the reference.`
      : 'Order placement returned without a reference. Tell the merchant something looked off and to check Lotus directly.',
  };
};

type BrowserAgentLine = {
  runId: string;
  step: number;
  description: string;
  screenshotUrl?: string;
  done?: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

async function* forwardBrowserStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent & { result?: Record<string, unknown> }, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const step = JSON.parse(trimmed) as BrowserAgentLine;
        const evt: AgentEvent & { result?: Record<string, unknown> } = {
          type: 'browser_step',
          runId: step.runId,
          step: step.step,
          description: step.description,
          ...(step.screenshotUrl ? { screenshotUrl: step.screenshotUrl } : {}),
        };
        if (step.result) (evt as { result: Record<string, unknown> }).result = step.result;
        yield evt;
      } catch {
        // ignore malformed lines
      }
    }
  }
}
