import { Grant } from '@tng-rise/shared';
import smeGrowthFund from '../data/sme-growth-fund.json' with { type: 'json' };

const raw: unknown[] = [smeGrowthFund];

// Validate at module load time. If a grant JSON drifts from the schema, the
// orchestrator fails fast on startup rather than during a live demo.
export const grants: Grant[] = raw.map((entry) => Grant.parse(entry));

export function getGrantById(id: string): Grant | undefined {
  return grants.find((g) => g.id === id);
}

export function listGrants(): Grant[] {
  return grants;
}
