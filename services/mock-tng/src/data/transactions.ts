import type { Transaction } from '@tng-rise/shared';

// Deterministic RNG so transactions are reproducible per-day. Mulberry32.
function mulberry32(seed: number) {
  let t = seed;
  return function () {
    t = (t + 0x6d2b79f5) | 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Hour weights modelling Mak Cik's burger stall: closed before 11, peaks lunch and dinner.
const HOUR_WEIGHTS: Record<number, number> = {
  11: 0.4,
  12: 1.6,
  13: 1.2,
  14: 0.4,
  15: 0.2,
  16: 0.2,
  17: 0.4,
  18: 1.5,
  19: 1.3,
  20: 0.5,
};

// Day-of-week multipliers: Friday and Saturday strongest, Mondays slowest.
// Sun = 0, Mon = 1, ..., Sat = 6.
const DAY_MULT: Record<number, number> = {
  0: 1.0,
  1: 0.7,
  2: 0.85,
  3: 0.95,
  4: 1.0,
  5: 1.25,
  6: 1.2,
};

const ITEMS: Array<{ label: string; minRm: number; maxRm: number }> = [
  { label: 'Burger Ramly single', minRm: 5, maxRm: 7 },
  { label: 'Burger Ramly + cheese', minRm: 7, maxRm: 9 },
  { label: 'Burger special (cheese + telur)', minRm: 9, maxRm: 12 },
  { label: 'Set burger 2 ekor', minRm: 12, maxRm: 16 },
  { label: 'Set keluarga (4 burger)', minRm: 22, maxRm: 28 },
  { label: 'Burger + air sirap', minRm: 8, maxRm: 11 },
];

export function generateTransactions(now: Date, days = 30): Transaction[] {
  const out: Transaction[] = [];
  const seed = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  const rng = mulberry32(seed);

  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    day.setHours(0, 0, 0, 0);
    const dayOfWeek = day.getDay();
    const dayMult = DAY_MULT[dayOfWeek] ?? 1;

    // Recent week dip: 5% lower for the most recent 7 days. The agent should spot this.
    const recentDip = d < 7 ? 0.95 : 1.0;

    const baseCount = 32 + Math.floor(rng() * 18); // 32 to 50 transactions
    const txCount = Math.max(8, Math.round(baseCount * dayMult * recentDip));

    for (let i = 0; i < txCount; i++) {
      const hour = pickHour(rng);
      const minute = Math.floor(rng() * 60);
      const second = Math.floor(rng() * 60);
      const item = ITEMS[Math.floor(rng() * ITEMS.length)]!;
      const amountRm = Number(
        (item.minRm + rng() * (item.maxRm - item.minRm)).toFixed(2),
      );
      const ts = new Date(day);
      ts.setHours(hour, minute, second, 0);

      out.push({
        id: `tx_${ts.getTime()}_${i}`,
        timestamp: ts.toISOString(),
        amountRm,
        customerRef: `cust_${Math.floor(rng() * 100000).toString().padStart(5, '0')}`,
      });
    }
  }

  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

function pickHour(rng: () => number): number {
  const total = Object.values(HOUR_WEIGHTS).reduce((a, b) => a + b, 0);
  let target = rng() * total;
  for (const [hourStr, weight] of Object.entries(HOUR_WEIGHTS)) {
    target -= weight;
    if (target <= 0) return Number(hourStr);
  }
  return 12;
}
