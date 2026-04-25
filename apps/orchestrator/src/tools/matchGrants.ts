import { listGrants } from '@tng-rise/grants-kb';
import type { Grant, MerchantProfile } from '@tng-rise/shared';
import { env } from '../lib/env.js';
import type { ToolHandler } from './registry.js';
import { getAppliedGrantIds } from '../agent/memory.js';

// Rule-based matching. No vector DB. The KB is small enough to filter in memory.
//
// Grants Mak Cik has already run runGrantAgent for this session are filtered
// out. Order is the listing order in grants-kb (SME Growth Fund first, iTEKAD
// second), so the natural flow is:
//   - 1st call: surfaces SME Growth Fund
//   - After SME applied, next call: surfaces iTEKAD with isFollowUp=true
//   - After both applied: matches=[] and the LLM tells her there's nothing left
export const matchGrants: ToolHandler = async function* (_input, ctx) {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) {
    throw new Error(`mock-tng /merchant returned ${res.status}`);
  }
  const profile = (await res.json()) as MerchantProfile;

  const applied = getAppliedGrantIds(ctx.sessionId);

  // Surface one match at a time. The prompt tells the LLM to lead with the top
  // match anyway; offering more than one creates cognitive load.
  const matches = listGrants()
    .filter((g) => !applied.has(g.id))
    .map((grant) => ({ grant, reasons: explainEligibility(grant, profile) }))
    .filter((m) => m.reasons.length > 0)
    .slice(0, 1);

  return {
    profile,
    matches,
    appliedCount: applied.size,
    // Hint to the LLM that this is a follow-up (Mak Cik has already applied
    // for at least one grant earlier in the session). The chat reply should
    // read "satu lagi geran" / "another grant" rather than introducing it cold.
    isFollowUp: applied.size > 0,
  };
};

function explainEligibility(grant: Grant, profile: MerchantProfile): string[] {
  const reasons: string[] = [];
  const annualRm = profile.monthlyRevenueRm * 12;

  if (grant.id === 'sme-growth-fund') {
    reasons.push('Perniagaan F&B berdaftar SSM, aktif di Malaysia');
    if (annualRm < 500_000) {
      reasons.push('Pendapatan tahunan dalam had SME Growth Fund');
    }
  }
  if (grant.id === 'itekad-bnm') {
    reasons.push('Micro-enterprise berdaftar SSM dengan rekod TnG eWallet');
    reasons.push('Cashflow trend menaik, sesuai untuk naik taraf ke kiosk tetap');
    if (annualRm < 500_000) {
      reasons.push('Saiz perniagaan dalam skop iTEKAD micro-financing');
    }
  }
  return reasons;
}
