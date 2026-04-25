// Anthropic-format tool schemas. Bedrock uses the same JSON-Schema shape
// when the underlying model is Claude. Qwen needs a separate adapter inside
// llm/qwen.ts since its tool format differs.

export const TOOL_SCHEMAS = [
  {
    name: 'readSales',
    description:
      'Get the merchant transaction history for a given period. Use when the user asks about revenue, today, this week, or how the business is doing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d'],
          description: 'Time window. Default to 7d if user is vague.',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'readStock',
    description:
      'Get current stock levels and weekly usage for the merchant. Use when the user asks what they need to restock, or about ingredient supply.',
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
