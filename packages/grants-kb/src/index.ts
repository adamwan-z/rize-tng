import { Grant } from '@tng-rise/shared';
import tekunMikro from '../data/tekun-mikro.json' with { type: 'json' };
import maraSpgb from '../data/mara-spgb.json' with { type: 'json' };
import terajuBumiputera from '../data/teraju-bumiputera.json' with { type: 'json' };
import bnmIaes from '../data/bnm-iaes.json' with { type: 'json' };
import aimIkhtiar from '../data/aim-ikhtiar.json' with { type: 'json' };

const raw: unknown[] = [tekunMikro, maraSpgb, terajuBumiputera, bnmIaes, aimIkhtiar];

// Validate at module load time. If a grant JSON drifts from the schema, the
// orchestrator fails fast on startup rather than during a live demo.
export const grants: Grant[] = raw.map((entry) => Grant.parse(entry));

export function getGrantById(id: string): Grant | undefined {
  return grants.find((g) => g.id === id);
}

export function listGrants(): Grant[] {
  return grants;
}
