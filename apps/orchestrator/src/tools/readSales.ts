import { env } from '../lib/env.js';
import type { Transaction } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

// Pulls transactions from mock-tng. The LLM gets summary stats; raw rows are
// available via the tool result if a follow-up question needs them.
export const readSales: ToolHandler = async function* (input) {
  const period = (input.period as string) ?? '7d';
  const days = period === 'today' ? 1 : period === '30d' ? 30 : 7;

  const res = await fetch(`${env.MOCK_TNG_URL}/transactions?days=${days}`);
  if (!res.ok) {
    throw new Error(`mock-tng /transactions returned ${res.status}`);
  }
  const transactions = (await res.json()) as Transaction[];

  const total = transactions.reduce((sum, t) => sum + t.amountRm, 0);
  const count = transactions.length;
  const avgTicket = count > 0 ? total / count : 0;

  return {
    period,
    days,
    totalRm: Number(total.toFixed(2)),
    count,
    avgTicketRm: Number(avgTicket.toFixed(2)),
    transactions,
  };
};
