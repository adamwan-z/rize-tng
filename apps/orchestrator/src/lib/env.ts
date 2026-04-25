import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  LLM_PROVIDER: z.enum(['anthropic', 'bedrock', 'qwen']).default('anthropic'),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),

  ANTHROPIC_API_KEY: z.string().optional(),

  AWS_REGION: z.string().default('ap-southeast-5'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  BEDROCK_MODEL_ID: z.string().default('anthropic.claude-sonnet-4-6'),

  DASHSCOPE_API_KEY: z.string().optional(),
  QWEN_MODEL: z.string().default('qwen-max'),

  MOCK_TNG_URL: z.string().url().default('http://localhost:5050'),
  BROWSER_AGENT_URL: z.string().url().default('http://localhost:5001'),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
