import { env } from '../lib/env.js';
import type { AgentEvent, MerchantProfile } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { setPendingFinancingApproval } from '../agent/memory.js';

// Calls the Python browser-agent service and forwards browser_step events.
// Phase 1 of the live Lotus flow: fills the cart, navigates to checkout,
// pauses with the browser open, and returns runId + cart summary so the LLM
// can ask the merchant to confirm in chat. The merchant's "yes" is what
// triggers the LLM to call confirmProcurementCheckout(runId).
//
// The LLM produces item names; browser-agent demands SKUs (the API rejects
// unknown ones). We translate name -> sku via the catalog mock-tng serves.
export const runProcurementAgent: ToolHandler = async function* (input, ctx) {
  const rawItems = (input.items as Array<{ name: string; quantity: number }>) ?? [];
  const resolved = await Promise.all(
    rawItems.map(async (it) => ({
      sku: await mapNameToSku(it.name),
      quantity: it.quantity,
    })),
  );
  // The LLM often lists the same product under multiple natural-language
  // names ("eggs", "fresh eggs", "telur") which all map to one SKU. Merge
  // duplicates so the cart doesn't get the same item twice and the FE
  // confirm card doesn't trip on duplicate React keys.
  const items = mergeBySku(resolved);
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

  // Cash check. If the cart total exceeds Mak Cik's cash on hand, branch to
  // the SOS Credit financing flow instead of the normal payment confirmation.
  // The browser is still paused at checkout either way; we just decide which
  // handoff card the FE shows next.
  const profile = await fetchMerchantProfile();
  const totalRm = parseRm(total);
  const shortfallRm = totalRm !== null ? totalRm - profile.cashOnHandRm : null;
  const needsFinancing =
    shortfallRm !== null && shortfallRm > 0 && profile.tngFinancing !== undefined;

  if (needsFinancing && profile.tngFinancing) {
    const terms = profile.tngFinancing;
    const approvedAmountRm = clamp(
      Math.ceil(shortfallRm / 10) * 10,
      terms.minAmountRm,
      terms.maxAmountRm,
    );
    const repayableAmountRm = round2(approvedAmountRm * (1 + terms.flatFeePct / 100));

    // Gate acceptFinancingTerms until Mak Cik sends a new chat message. The
    // LLM otherwise tends to call it in the same turn and the financing
    // looks auto-approved. The gate is cleared at the top of the next
    // runAgent call (see core.ts).
    setPendingFinancingApproval(ctx.sessionId, runId);

    yield {
      type: 'handoff',
      kind: 'financing_offer',
      payload: {
        runId,
        items: enrichedItems,
        subtotal,
        total,
        totalRm,
        cashOnHandRm: profile.cashOnHandRm,
        shortfallRm,
        approvedAmountRm,
        repayableAmountRm,
        terms,
      },
    };

    return {
      ok: true,
      runId,
      items: enrichedItems,
      subtotal,
      total,
      cashOnHandRm: profile.cashOnHandRm,
      shortfallRm,
      financing: {
        productName: terms.productName,
        approvedAmountRm,
        repayableAmountRm,
        tenureDays: terms.tenureDays,
      },
      message:
        `Cart filled, browser paused at checkout. Total ${total} but Mak Cik only has RM ${profile.cashOnHandRm.toFixed(2)} cash on hand. SOS Credit (${terms.productName}) is pre-approved for RM ${approvedAmountRm}, repayable RM ${repayableAmountRm} over ${terms.tenureDays} hari (auto-deduct ${terms.dailyDeductionPctOfSales}% of daily TNG sales). Tell her gently that cash tak cukup, then say SOS Credit boleh tolong cover and the terms are in the card. Ask if she agrees to the terms (ya/setuju). DO NOT call any tool yet. Only after she agrees, call acceptFinancingTerms with the runId, items, subtotal, total, and approvedAmountRm.`,
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

async function fetchMerchantProfile(): Promise<MerchantProfile> {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) throw new Error(`mock-tng /merchant returned ${res.status}`);
  return (await res.json()) as MerchantProfile;
}

function parseRm(s: string | null): number | null {
  if (!s) return null;
  const match = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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

function mergeBySku(
  items: Array<{ sku: string; quantity: number }>,
): Array<{ sku: string; quantity: number }> {
  const totals = new Map<string, number>();
  for (const it of items) {
    totals.set(it.sku, (totals.get(it.sku) ?? 0) + it.quantity);
  }
  return Array.from(totals, ([sku, quantity]) => ({ sku, quantity }));
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
