import { env } from '../lib/env.js';
import type { LLMClient } from './client.js';
import { makeAnthropicClient } from './anthropic.js';
import { makeBedrockClient } from './bedrock.js';
import { makeQwenClient } from './qwen.js';

let cached: LLMClient | null = null;

export function getLLM(): LLMClient {
  if (cached) return cached;
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      cached = makeAnthropicClient();
      break;
    case 'bedrock':
      cached = makeBedrockClient();
      break;
    case 'qwen':
      cached = makeQwenClient();
      break;
  }
  return cached;
}

export type { LLMClient } from './client.js';
