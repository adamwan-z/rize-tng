// Provider-neutral streaming interface. Each adapter (anthropic, bedrock, qwen)
// normalises its native event format into LLMEvent. The agent loop consumes
// LLMEvents and emits AgentEvents to the SSE stream.

export type LLMMessage = {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
};

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export type LLMTool = {
  name: string;
  description: string;
  input_schema: object;
};

export type LLMEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'message_stop'; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error' };

export interface LLMClient {
  stream(input: {
    system: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): AsyncIterable<LLMEvent>;
}
