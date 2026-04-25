import { env } from '../lib/env.js';
import type { AgentEvent } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

// Calls the Python browser-agent service and forwards browser_step events.
// The LLM produces item names; browser-agent demands SKUs (the API rejects
// unknown ones). We translate name -> sku via the catalog mock-tng serves.
export const runProcurementAgent: ToolHandler = async function* (input) {
  const rawItems = (input.items as Array<{ name: string; quantity: number }>) ?? [];
  const items = await Promise.all(
    rawItems.map(async (it) => ({
      sku: await mapNameToSku(it.name),
      quantity: it.quantity,
    })),
  );
  const mode = (input.mode as 'scripted' | 'agent' | undefined) ?? 'scripted';

  const res = await fetch(`${env.BROWSER_AGENT_URL}/run/lotus_procurement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, mode }),
  });
  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : '';
    throw new Error(`browser-agent /run/lotus_procurement returned ${res.status} ${detail}`);
  }

  yield* forwardBrowserStream(res.body);

  return { ok: true, message: 'Cart ready. Hand off to merchant for payment.' };
};

let _catalog: Array<{ sku: string; name: string; brand?: string }> | null = null;

async function getCatalog(): Promise<Array<{ sku: string; name: string; brand?: string }>> {
  if (_catalog) return _catalog;
  const url = `${env.MOCK_TNG_URL}/data/lotus-catalog.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lotus catalog unreachable at ${url}: ${res.status}`);
  _catalog = (await res.json()) as Array<{ sku: string; name: string; brand?: string }>;
  return _catalog;
}

async function mapNameToSku(name: string): Promise<string> {
  const catalog = await getCatalog();
  const lc = name.toLowerCase();
  const exact = catalog.find((p) => p.name.toLowerCase() === lc);
  if (exact) return exact.sku;
  const partial = catalog.find(
    (p) => p.name.toLowerCase().includes(lc) || lc.includes(p.name.toLowerCase()),
  );
  if (partial) return partial.sku;
  throw new Error(
    `No catalog match for "${name}". Available: ${catalog.map((p) => p.name).join(', ')}`,
  );
}

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
