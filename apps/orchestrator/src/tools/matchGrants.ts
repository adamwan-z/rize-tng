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
  const monthlyRm = profile.monthlyRevenueRm;

  // Heuristic eligibility narrative. Lane B can refine these as the demo evolves.
  if (grant.id === 'tekun-mikro' && monthlyRm < 8000 * 4) {
    reasons.push('Pendapatan bulanan dalam had TEKUN');
    reasons.push('Perniagaan F&B aktif di Malaysia');
  }
  if (grant.id === 'mara-spgb') {
    reasons.push('Bumiputera, perniagaan F&B di Kuala Lumpur');
  }
  if (grant.id === 'teraju-bumiputera' && monthlyRm * 12 >= 100_000) {
    reasons.push('Pendapatan tahunan memenuhi syarat TERAJU');
  }
  if (grant.id === 'bnm-iaes') {
    reasons.push('Perniagaan F&B aktif lebih 1 tahun');
    reasons.push('Pendapatan dalam julat sasaran iAES');
  }
  if (grant.id === 'aim-ikhtiar' && monthlyRm < 5000 * 2) {
    reasons.push('Layak untuk skim AIM jika pendapatan isi rumah rendah');
  }
  return reasons;
}
