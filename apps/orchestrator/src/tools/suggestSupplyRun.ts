import type { ToolHandler } from './registry.js';

type SupplyItem = { name: string; qty: number; unit?: string };

// Dialog-driven: items come from the LLM, which gathered them from Mak Cik
// in chat. The CFO does not track inventory. No prices, no urgency, no
// catalog lookups. Just turns a confirmed item list into a handoff card.
export const suggestSupplyRun: ToolHandler = async function* (input, _ctx) {
  const items = input.items as SupplyItem[] | undefined;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('suggestSupplyRun requires a non-empty items array');
  }

  yield {
    type: 'handoff',
    kind: 'supply_list',
    payload: {
      items,
      lotusUrl: 'https://www.lotuss.com.my/',
    },
  };

  return { items };
};
