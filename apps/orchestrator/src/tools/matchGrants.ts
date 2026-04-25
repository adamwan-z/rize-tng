import { listGrants } from '@tng-rise/grants-kb';
import type { Grant, MerchantProfile } from '@tng-rise/shared';
import { env } from '../lib/env.js';
import type { ToolHandler } from './registry.js';
import { bumpMatchGrantsCallCount } from '../agent/memory.js';

// Rule-based matching. No vector DB. The KB is small enough to filter in memory.
//
// Two-grant rotation by call count:
//   - 1st call in a session: surfaces SME Growth Fund (web form).
//   - 2nd+ call in a session: surfaces iTEKAD (email submission via Gmail).
//
// Both grants are real and Mak Cik qualifies for both. The rotation lets the
// LLM frame iTEKAD as "satu lagi geran" on the follow-up turn after she has
// already engaged with the first one.
export const matchGrants: ToolHandler = async function* (_input, ctx) {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) {
    throw new Error(`mock-tng /merchant returned ${res.status}`);
  }
  const profile = (await res.json()) as MerchantProfile;

  const callCount = bumpMatchGrantsCallCount(ctx.sessionId);
  const grants = listGrants();
  const surfaceId = callCount === 1 ? 'sme-growth-fund' : 'itekad-bnm';
  const surfaced = grants.find((g) => g.id === surfaceId);

  const matches = surfaced
    ? [{ grant: surfaced, reasons: explainEligibility(surfaced, profile) }].filter(
        (m) => m.reasons.length > 0,
      )
    : [];

  return {
    profile,
    matches,
    callCount,
    // Hint to the LLM that this is a follow-up surfacing, so the chat reply
    // can naturally read "satu lagi geran" / "another grant" rather than
    // re-introducing it cold.
    isFollowUp: callCount > 1,
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
