import { env } from '../lib/env.js';
import type { StockItem } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

export const readStock: ToolHandler = async function* () {
  const res = await fetch(`${env.MOCK_TNG_URL}/stock`);
  if (!res.ok) {
    throw new Error(`mock-tng /stock returned ${res.status}`);
  }
  const items = (await res.json()) as StockItem[];

  const lowStock = items.filter((s) => s.currentQty < s.weeklyUsage);

  return {
    items,
    lowStock: lowStock.map((s) => ({
      name: s.name,
      currentQty: s.currentQty,
      weeklyUsage: s.weeklyUsage,
      daysLeft: Number((s.currentQty / (s.weeklyUsage / 7)).toFixed(1)),
    })),
  };
};
