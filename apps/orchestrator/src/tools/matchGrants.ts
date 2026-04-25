import { listGrants } from '@tng-rise/grants-kb';
import type { Grant, MerchantProfile } from '@tng-rise/shared';
import { env } from '../lib/env.js';
import type { ToolHandler } from './registry.js';

// Rule-based matching. No vector DB. The KB is small enough to filter in memory.
// We prioritise grants where the merchant clearly qualifies on revenue, location,
// and registration age.
export const matchGrants: ToolHandler = async function* () {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) {
    throw new Error(`mock-tng /merchant returned ${res.status}`);
  }
  const profile = (await res.json()) as MerchantProfile;

  const grants = listGrants();
  const matches = grants
    .map((grant) => ({
      grant,
      reasons: explainEligibility(grant, profile),
    }))
    .filter((m) => m.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length)
    .slice(0, 3);

  return {
    profile,
    matches,
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
  return reasons;
}
