import type { LLMClient, LLMEvent, LLMMessage, LLMTool } from './client.js';
import { env } from '../lib/env.js';

// Qwen via Alibaba DashScope. Used optionally for Malay paraphrase, where its
// regional grounding helps. Tool-use shape differs from Claude, so this adapter
// is intentionally minimal: text-only streaming, no tool support yet. If we
// promote Qwen to the agent loop, expand this with DashScope's function calling.
export class QwenClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
  }

  async *stream(input: {
    system: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): AsyncIterable<LLMEvent> {
    if (input.tools.length > 0) {
      throw new Error('Qwen adapter does not support tools yet. Use anthropic or bedrock.');
    }

    const body = {
      model: this.model,
      input: {
        messages: [
          { role: 'system', content: input.system },
          ...input.messages.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '',
          })),
        ],
      },
      parameters: { incremental_output: true, result_format: 'message' },
    };

    const res = await fetch(
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok || !res.body) {
      throw new Error(`Qwen returned ${res.status}: ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload) as {
            output?: { choices?: Array<{ message?: { content?: string } }> };
          };
          const text = parsed.output?.choices?.[0]?.message?.content;
          if (text) yield { type: 'text_delta', text };
        } catch {
          // skip malformed lines
        }
      }
    }
    yield { type: 'message_stop', stopReason: 'end_turn' };
  }
}

export function makeQwenClient(): QwenClient {
  if (!env.DASHSCOPE_API_KEY) {
    throw new Error('LLM_PROVIDER=qwen but DASHSCOPE_API_KEY is not set');
  }
  return new QwenClient({ apiKey: env.DASHSCOPE_API_KEY, model: env.QWEN_MODEL });
}
