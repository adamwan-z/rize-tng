import { z } from 'zod';

// ===== Chat =====
export const ChatRequest = z.object({
  message: z.string().min(1),
  sessionId: z.string(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// ===== Agent stream events (SSE) =====
//
// Streamed from orchestrator to frontend. Discriminated on `type`. The frontend
// uses an exhaustive switch on this discriminator to render each event kind.
export const AgentEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({
    type: z.literal('tool_call'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('tool_result'),
    id: z.string(),
    name: z.string(),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('browser_step'),
    runId: z.string(),
    step: z.number(),
    description: z.string(),
    screenshotUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal('handoff'),
    kind: z.enum(['payment', 'review_submit', 'email']),
    payload: z.record(z.unknown()),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('done') }),
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

// ===== Merchant profile =====
export const MerchantProfile = z.object({
  id: z.string(),
  name: z.string(),
  businessName: z.string(),
  businessType: z.string(),
  location: z.object({ city: z.string(), state: z.string() }),
  registeredSince: z.string(),
  ssm: z.string().optional(),
  monthlyRevenueRm: z.number(),
});
export type MerchantProfile = z.infer<typeof MerchantProfile>;

// ===== Transaction =====
export const Transaction = z.object({
  id: z.string(),
  timestamp: z.string(),
  amountRm: z.number(),
  customerRef: z.string(),
});
export type Transaction = z.infer<typeof Transaction>;

// ===== Stock =====
export const StockItem = z.object({
  name: z.string(),
  unit: z.string(),
  currentQty: z.number(),
  weeklyUsage: z.number(),
  lastPriceRm: z.number(),
});
export type StockItem = z.infer<typeof StockItem>;

// ===== Grant =====
export const Grant = z.object({
  id: z.string(),
  name: z.string(),
  agency: z.string(),
  description: z.string(),
  maxAmountRm: z.number(),
  eligibility: z.array(z.string()),
  submissionMethod: z.enum(['web_form', 'email']),
  applicationUrl: z.string().optional(),
  applicationEmail: z.string().email().optional(),
  emailTemplate: z
    .object({
      subject: z.string(),
      body: z.string(),
    })
    .optional(),
});
export type Grant = z.infer<typeof Grant>;

// ===== Browser agent =====
export const BrowserRunRequest = z.object({
  flow: z.enum(['lotus_procurement', 'grant_application']),
  inputs: z.record(z.unknown()),
});
export type BrowserRunRequest = z.infer<typeof BrowserRunRequest>;

// Streamed event from browser agent back to orchestrator. Same shape as the
// `browser_step` AgentEvent so the orchestrator can forward without re-shaping.
export const BrowserStepEvent = z.object({
  runId: z.string(),
  step: z.number(),
  description: z.string(),
  screenshotUrl: z.string().optional(),
});
export type BrowserStepEvent = z.infer<typeof BrowserStepEvent>;
