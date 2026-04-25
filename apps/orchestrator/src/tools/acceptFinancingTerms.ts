import type { ToolHandler } from './registry.js';
import { getPendingFinancingApproval, clearPendingFinancingApproval } from '../agent/memory.js';

// Bridges the SOS Credit T&C step back into the existing procurement
// confirmation flow. The browser is still paused at checkout from
// runProcurementAgent. Once Mak Cik agrees to the financing terms in chat,
// the LLM calls this tool which re-emits a procurement_confirm handoff so
// the existing "Reply yes to pay" UX takes over. No browser-agent call here;
// nothing to do server-side beyond echoing the cart for the second card.
export const acceptFinancingTerms: ToolHandler = async function* (input, ctx) {
  const runId = input.runId as string | undefined;
  const items = (input.items as Array<{ sku: string; quantity: number; name?: string }>) ?? [];
  const subtotal = (input.subtotal as string | undefined) ?? null;
  const total = (input.total as string | undefined) ?? null;
  const approvedAmountRm = input.approvedAmountRm as number | undefined;

  if (!runId) {
    throw new Error('acceptFinancingTerms requires runId from runProcurementAgent.');
  }

  // Hard gate. Set when runProcurementAgent emitted a financing_offer; only
  // cleared when Mak Cik sends a new message via /chat. If still set, the
  // LLM is trying to chain in the same turn before she has agreed. Throwing
  // surfaces a tool error to the LLM, which usually self-corrects to text.
  if (getPendingFinancingApproval(ctx.sessionId) !== null) {
    throw new Error(
      'Cannot accept SOS Credit terms yet: Mak Cik has not replied with agreement in chat. Send a text message asking her to confirm (ya / setuju), then wait for her reply before calling this tool again.',
    );
  }
  clearPendingFinancingApproval(ctx.sessionId);

  yield {
    type: 'handoff',
    kind: 'procurement_confirm',
    payload: {
      runId,
      items,
      subtotal,
      total,
      financingApprovedRm: approvedAmountRm,
    },
  };

  return {
    ok: true,
    runId,
    approvedAmountRm,
    message:
      `SOS Credit terms accepted. Approved RM ${approvedAmountRm ?? '?'}. Tell Mak Cik the credit is locked in and ask one final time for explicit yes/boleh/confirm to place the order. Only call confirmProcurementCheckout(runId) after she replies yes.`,
  };
};
