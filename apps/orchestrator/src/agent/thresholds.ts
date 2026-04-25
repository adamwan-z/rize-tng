// Single source for all numeric thresholds the analytical tools use.
// Tune here, never grep handlers.
export const THRESHOLDS = {
  weeklyDipPct: 0.05,           // analyzeRevenue: weekly dip > 5% triggers alert
  unusualQuietDayPct: 0.20,     // analyzeRevenue (today only): >20% below day-of-week avg
  unusualHighTicketRm: 60,      // analyzeRevenue: a single ticket above this is flagged
  runwayBelowWeeks: 4,          // analyzeRunway: runway < 4 weeks triggers alert
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;
