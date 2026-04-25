import { analyzeRevenue } from './analyzeRevenue.js';
import { analyzeStock } from './analyzeStock.js';
import { analyzeRunway } from './analyzeRunway.js';
import { suggestSupplyRun } from './suggestSupplyRun.js';
import { matchGrants } from './matchGrants.js';
import { runProcurementAgent } from './runProcurementAgent.js';
import { runGrantAgent } from './runGrantAgent.js';
import type { AgentEvent, Alert } from '@tng-rise/shared';

// A tool handler can either return a single result, or yield AgentEvents
// (for tools that need to stream progress, like the browser agent flows).
export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: {
    sessionId: string;
    alertGate: (alert: Alert, dedupeKey: string) => boolean;
  },
) => AsyncGenerator<AgentEvent, unknown, void>;

export const tools: Record<string, ToolHandler> = {
  analyzeRevenue,
  analyzeStock,
  analyzeRunway,
  suggestSupplyRun,
  matchGrants,
  runProcurementAgent,
  runGrantAgent,
};

export function hasTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(tools, name);
}
