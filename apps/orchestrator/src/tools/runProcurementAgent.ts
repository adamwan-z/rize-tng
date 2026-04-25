import { env } from '../lib/env.js';
import type { AgentEvent } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

// Calls the Python browser-agent service and forwards browser_step events.
// Phase 1 of the live Lotus flow: fills the cart, navigates to checkout,
// pauses with the browser open, and returns runId + cart summary so the LLM
// can ask the merchant to confirm in chat. The merchant's "yes" is what
// triggers the LLM to call confirmProcurementCheckout(runId).
//
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

  let runId: string | null = null;
  let subtotal: string | null = null;
  let total: string | null = null;
  let orderRef: string | null = null;
  let completedInPhase1 = false;
  let resolvedItems: Array<{ sku: string; quantity: number }> = items;

  for await (const event of forwardBrowserStream(res.body)) {
    if (event.result) {
      const r = event.result as Record<string, unknown>;
      if (typeof r.runId === 'string') runId = r.runId;
      if (typeof r.subtotal === 'string') subtotal = r.subtotal;
      if (typeof r.total === 'string') total = r.total;
      if (typeof r.orderRef === 'string') orderRef = r.orderRef;
      if (r.completedInPhase1 === true) completedInPhase1 = true;
      if (Array.isArray(r.items)) {
        resolvedItems = r.items as Array<{ sku: string; quantity: number }>;
      }
    }
    // Strip the result field before yielding to FE; it is internal.
    const { result: _result, ...forFe } = event;
    yield forFe as AgentEvent;
  }

  const enrichedItems = await enrichWithNames(resolvedItems);

  // Agent mode sometimes one-shots and clicks Place Order itself. The
  // browser-agent surfaces this as completedInPhase1 with a captured order
  // ref. Treat as a successful purchase, no confirmation needed.
  if (completedInPhase1) {
    return {
      ok: true,
      completedInPhase1: true,
      orderRef,
      total,
      items: enrichedItems,
      message:
        'Order was placed by the agent in one shot. Tell the merchant the purchase is done, read out the order reference and total, and that Lotus will deliver to the slot picked.',
    };
  }

  // Fallback path (replay recording) won't reach checkout either, so there's
  // no pending run and nothing to confirm. Surface plainly so the LLM can
  // explain what happened instead of pretending the cart is ready.
  if (!runId) {
    return {
      ok: false,
      message:
        'Cart fill did not pause at checkout (likely fell back to recorded replay). Nothing to confirm.',
    };
  }

  yield {
    type: 'handoff',
    kind: 'procurement_confirm',
    payload: {
      runId,
      items: enrichedItems,
      subtotal,
      total,
    },
  };

  return {
    ok: true,
    runId,
    items: enrichedItems,
    subtotal,
    total,
    message:
      'Cart filled, browser paused at checkout. Restate items + total to the merchant and ask for explicit confirmation. Only call confirmProcurementCheckout(runId) after she says yes / boleh / confirm.',
  };
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
  // Token overlap. Substring-aware so "burger" matches "Hamburger" and
  // "ramly burger" maps to the first Ramly product (LLM colloquialisms).
  const scored = catalog
    .map((p) => ({ p, score: tokenOverlap(name, p.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 0) return scored[0]!.p.sku;
  throw new Error(
    `No catalog match for "${name}". Available: ${catalog.map((p) => p.name).join(', ')}`,
  );
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\W+/).filter(Boolean);
}

function tokenOverlap(query: string, candidate: string): number {
  const queryTokens = tokenize(query);
  const candidateTokens = tokenize(candidate);
  let score = 0;
  for (const qt of queryTokens) {
    if (candidateTokens.some((ct) => ct.includes(qt) || qt.includes(ct))) {
      score++;
    }
  }
  return score;
}

async function enrichWithNames(
  items: Array<{ sku: string; quantity: number }>,
): Promise<Array<{ sku: string; quantity: number; name: string }>> {
  const catalog = await getCatalog();
  return items.map((it) => {
    const product = catalog.find((p) => p.sku === it.sku);
    return { sku: it.sku, quantity: it.quantity, name: product?.name ?? it.sku };
  });
}

// browser-agent terminator includes done/result/awaiting_confirmation which
// we need on the orchestrator side but should not forward to the FE. Same
// shape as runGrantAgent's parse type.
type BrowserAgentLine = {
  runId: string;
  step: number;
  description: string;
  screenshotUrl?: string;
  done?: boolean;
  result?: Record<string, unknown>;
  error?: string;
  awaiting_confirmation?: boolean;
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
        // Skip malformed lines. Browser agent is the source of truth.
      }
    }
  }
}
