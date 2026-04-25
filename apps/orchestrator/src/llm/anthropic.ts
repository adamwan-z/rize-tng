import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMEvent, LLMMessage, LLMTool } from './client.js';
import { env } from '../lib/env.js';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  async *stream(input: {
    system: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): AsyncIterable<LLMEvent> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: input.system,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : (m.content as never),
      })),
      tools: input.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as never,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          // The full input arrives in `content_block_stop`. We surface the tool_use
          // when the block completes, with the accumulated input.
        }
      } else if (event.type === 'message_stop') {
        // Resolve the final message to inspect tool_use blocks.
        const final = await stream.finalMessage();
        for (const block of final.content) {
          if (block.type === 'tool_use') {
            yield {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }
        }
        const stop =
          final.stop_reason === 'end_turn'
            ? 'end_turn'
            : final.stop_reason === 'tool_use'
              ? 'tool_use'
              : final.stop_reason === 'max_tokens'
                ? 'max_tokens'
                : 'error';
        yield { type: 'message_stop', stopReason: stop };
      }
    }
  }
}

export function makeAnthropicClient(): AnthropicClient {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set');
  }
  return new AnthropicClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.LLM_MODEL });
}
