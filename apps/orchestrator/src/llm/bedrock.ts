import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import type { LLMClient, LLMEvent, LLMMessage, LLMTool } from './client.js';
import { env } from '../lib/env.js';

// Bedrock Converse API normalises across providers. We use it because Claude
// models on Bedrock keep the same tool-use semantics as the Anthropic SDK,
// so the agent loop is identical to anthropic.ts.
export class BedrockClient implements LLMClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(opts: { region: string; modelId: string }) {
    this.client = new BedrockRuntimeClient({ region: opts.region });
    this.modelId = opts.modelId;
  }

  async *stream(input: {
    system: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): AsyncIterable<LLMEvent> {
    const messages: Message[] = input.messages.map((m) => ({
      role: m.role,
      content: toBedrockContent(m.content),
    }));

    const tools: Tool[] = input.tools.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: { json: t.input_schema as never },
      },
    }));

    const cmd = new ConverseStreamCommand({
      modelId: this.modelId,
      system: [{ text: input.system }],
      messages,
      toolConfig: tools.length > 0 ? { tools } : undefined,
      inferenceConfig: { maxTokens: 4096 },
    });

    const response = await this.client.send(cmd);
    if (!response.stream) {
      throw new Error('Bedrock returned no stream');
    }

    let pendingToolUse: { id: string; name: string; inputJson: string } | null = null;

    for await (const event of response.stream) {
      if (event.contentBlockStart?.start?.toolUse) {
        pendingToolUse = {
          id: event.contentBlockStart.start.toolUse.toolUseId ?? '',
          name: event.contentBlockStart.start.toolUse.name ?? '',
          inputJson: '',
        };
      } else if (event.contentBlockDelta?.delta?.text) {
        yield { type: 'text_delta', text: event.contentBlockDelta.delta.text };
      } else if (event.contentBlockDelta?.delta?.toolUse?.input && pendingToolUse) {
        pendingToolUse.inputJson += event.contentBlockDelta.delta.toolUse.input;
      } else if (event.contentBlockStop && pendingToolUse) {
        const input = pendingToolUse.inputJson ? JSON.parse(pendingToolUse.inputJson) : {};
        yield { type: 'tool_use', id: pendingToolUse.id, name: pendingToolUse.name, input };
        pendingToolUse = null;
      } else if (event.messageStop) {
        const reason = event.messageStop.stopReason;
        const stop =
          reason === 'end_turn'
            ? 'end_turn'
            : reason === 'tool_use'
              ? 'tool_use'
              : reason === 'max_tokens'
                ? 'max_tokens'
                : 'error';
        yield { type: 'message_stop', stopReason: stop };
      }
    }
  }
}

function toBedrockContent(content: LLMMessage['content']): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  return content.map((block): ContentBlock => {
    if (block.type === 'text') return { text: block.text };
    if (block.type === 'tool_use') {
      return {
        toolUse: {
          toolUseId: block.id,
          name: block.name,
          input: block.input as never,
        },
      };
    }
    return {
      toolResult: {
        toolUseId: block.tool_use_id,
        content: [{ text: block.content }],
      },
    };
  });
}

export function makeBedrockClient(): BedrockClient {
  return new BedrockClient({ region: env.AWS_REGION, modelId: env.BEDROCK_MODEL_ID });
}
