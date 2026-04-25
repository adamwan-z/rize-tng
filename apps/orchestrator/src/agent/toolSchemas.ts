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
    name: 'analyzeStock',
    description:
      'Get current stock levels with qualitative urgency band (ok / low / critical) per item plus alerts for items running low. Use when the user asks about stok, barang, restock, or what is running out. Never quote days-of-cover numbers; the urgency band is the safe-to-surface signal.',
    input_schema: {
      type: 'object' as const,
      properties: {},
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
      'Build a draft shopping list for items running low or critical. Returns suggested quantities and approximate costs, and emits a supply-list handoff card the user can act on. Use when the user asks about restock, supply run, beli barang, or after analyzeStock flags critical urgency.',
    input_schema: {
      type: 'object' as const,
      properties: {},
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
      'Open Lotus supermarket and add ingredients to cart. Stops before payment so the merchant pays themselves. Returns when the cart is ready.',
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
