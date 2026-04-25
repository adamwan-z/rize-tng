// Anthropic-format tool schemas. Bedrock uses the same JSON-Schema shape
// when the underlying model is Claude. Qwen needs a separate adapter inside
// llm/qwen.ts since its tool format differs.

export const TOOL_SCHEMAS = [
  {
    name: 'analyzeRevenue',
    description:
      'Analyze merchant revenue for a period. Returns totals, count, average ticket, trend vs the prior period of the same length, day-of-week breakdown, peak hours, and alerts. Use when the user asks about jualan, revenue, business, today, this week, or this month.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d', 'mtd'],
          description: 'Time window. Default to 7d if vague.',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'analyzeRunway',
    description:
      'Compute the merchant cashflow position: weekly inflow, estimated weekly outflow, runway, and a qualitative profit band (comfortable / tight / losing). Use when the user asks about cashflow, untung, kos, kewangan, or whether the business is healthy. Only weeklyInflowRm and profitEstimate are safe to surface to the user; do not quote weeklyNet, runwayWeeks, breakevenRevenue, or any monthly cost amount.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'suggestSupplyRun',
    description:
      'Build a supply list handoff card from items the user has named in conversation. The CFO does not track inventory; gather the items and quantities from her in dialog before calling this. Use after she confirms what she wants to restock and how much.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Item name as Mak Cik named it (e.g. "Ramly patty", "roti bun", "cheese slice")' },
              qty: { type: 'number', description: 'Quantity she wants to buy' },
              unit: { type: 'string', description: 'Optional unit (kg, packet, biji). Omit if she did not specify.' },
            },
            required: ['name', 'qty'],
          },
          description: 'Items confirmed by the user in dialog. Never invent items.',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'matchGrants',
    description:
      'Find Malaysian SME grants the merchant qualifies for. Returns grant details with eligibility reasoning. Use when the user mentions grants, financing, capital, or asks for help growing the business.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'runProcurementAgent',
    description:
      'Open Lotus supermarket and add ingredients to cart. Stops at the checkout page with the live browser kept open and returns runId, items, subtotal, and total. After this returns you MUST restate the cart and total to the merchant in chat and ask for explicit confirmation. Do not assume she wants to checkout; wait for her reply, then call confirmProcurementCheckout(runId).',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
            },
            required: ['name', 'quantity'],
          },
          description: 'Ingredients to add to the cart.',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'confirmProcurementCheckout',
    description:
      'Resume a paused Lotus run and place the order. Clicks Place Order on the live browser kept open by runProcurementAgent, captures the order reference, then closes the browser. Use ONLY after runProcurementAgent has returned with a runId AND the merchant has explicitly confirmed in her next message (yes / boleh / confirm / proceed / ok). Never call this on your own.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runId: {
          type: 'string',
          description: 'The runId returned by runProcurementAgent.',
        },
      },
      required: ['runId'],
    },
  },
  {
    name: 'acceptFinancingTerms',
    description:
      'Accept the SOS Credit terms on behalf of the merchant after she has explicitly agreed in chat (ya / setuju / agree / ok). Bridges the financing card back into the normal procurement_confirm flow so the next step is the final payment confirmation. Use ONLY when runProcurementAgent emitted a financing_offer handoff AND the merchant has agreed to the terms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        runId: { type: 'string', description: 'The runId returned by runProcurementAgent.' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              quantity: { type: 'number' },
              name: { type: 'string' },
            },
            required: ['sku', 'quantity'],
          },
          description: 'Cart items from the previous runProcurementAgent result.',
        },
        subtotal: { type: 'string', description: 'Cart subtotal string from runProcurementAgent.' },
        total: { type: 'string', description: 'Checkout total string from runProcurementAgent.' },
        approvedAmountRm: {
          type: 'number',
          description: 'SOS Credit approved amount from the financing_offer handoff.',
        },
      },
      required: ['runId', 'items', 'total', 'approvedAmountRm'],
    },
  },
  {
    name: 'runGrantAgent',
    description:
      'Open a grant portal and fill the application form. Stops before Submit so the merchant reviews and submits themselves. Use only after matchGrants and the user confirms which grant to apply for.',
    input_schema: {
      type: 'object' as const,
      properties: {
        grantId: {
          type: 'string',
          description: 'ID of the grant from matchGrants.',
        },
      },
      required: ['grantId'],
    },
  },
] as const;

export type ToolName = (typeof TOOL_SCHEMAS)[number]['name'];
