import type { AgentEvent, Alert } from '@tng-rise/shared';
import { getLLM } from '../llm/index.js';
import type { LLMContentBlock, LLMMessage, LLMTool } from '../llm/client.js';
import { TOOL_SCHEMAS } from './toolSchemas.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools, hasTool } from '../tools/registry.js';
import {
  getSession,
  setMessages,
  alertAlreadyFired,
  markAlertFired,
  clearPendingFinancingApproval,
} from './memory.js';

const MAX_TURNS = 6;

// Top-level agent loop. Yields AgentEvents that the route handler writes to the
// SSE stream. Each iteration: send messages to LLM, stream text deltas, collect
// tool_use blocks, run tools, append tool_results, repeat.
export async function* runAgent(input: {
  sessionId: string;
  userMessage: string;
}): AsyncGenerator<AgentEvent, void, void> {
  const llm = getLLM();
  const session = getSession(input.sessionId);
  // A new user message means any pending financing approval gate should be
  // released. If she said yes, the LLM will now be allowed to call
  // acceptFinancingTerms; if she said no, the flag was stale anyway.
  clearPendingFinancingApproval(input.sessionId);
  const messages: LLMMessage[] = [
    ...session.messages,
    { role: 'user', content: input.userMessage },
  ];

  const alertGate = (alert: Alert, dedupeKey: string): boolean => {
    const key = `${alert.kind}:${dedupeKey}`;
    if (alertAlreadyFired(input.sessionId, key)) return false;
    markAlertFired(input.sessionId, key);
    return true;
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    let assistantText = '';

    try {
      for await (const event of llm.stream({
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOL_SCHEMAS as unknown as LLMTool[],
      })) {
        if (event.type === 'text_delta') {
          assistantText += event.text;
          yield { type: 'text', content: event.text };
        } else if (event.type === 'tool_use') {
          toolUses.push({ id: event.id, name: event.name, input: event.input });
        } else if (event.type === 'message_stop') {
          break;
        }
      }
    } catch (err) {
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : 'LLM stream failed',
      };
      yield { type: 'done' };
      return;
    }

    if (toolUses.length === 0) {
      // No tool calls means the model finished. Persist the full message array
      // (including all tool_use/tool_result blocks built up across sub-turns)
      // so the next user turn has full context.
      if (assistantText) {
        messages.push({ role: 'assistant', content: assistantText });
      }
      setMessages(input.sessionId, messages);
      yield { type: 'done' };
      return;
    }

    // Append the assistant message with text + tool_use blocks.
    const assistantContent: LLMContentBlock[] = [];
    if (assistantText) assistantContent.push({ type: 'text', text: assistantText });
    for (const tu of toolUses) {
      assistantContent.push({
        type: 'tool_use',
        id: tu.id,
        name: tu.name,
        input: tu.input,
      });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute each tool call. Forward any AgentEvents the tool emits during execution.
    const toolResults: LLMContentBlock[] = [];
    for (const tu of toolUses) {
      yield {
        type: 'tool_call',
        id: tu.id,
        name: tu.name,
        input: tu.input as Record<string, unknown>,
      };

      if (!hasTool(tu.name)) {
        const errMsg = `Unknown tool: ${tu.name}`;
        yield { type: 'error', message: errMsg };
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: errMsg });
        continue;
      }

      try {
        const handler = tools[tu.name]!;
        const generator = handler(tu.input as Record<string, unknown>, {
          sessionId: input.sessionId,
          alertGate,
        });
        let result: unknown = null;
        while (true) {
          const next = await generator.next();
          if (next.done) {
            result = next.value;
            break;
          }
          yield next.value;
        }
        yield {
          type: 'tool_result',
          id: tu.id,
          name: tu.name,
          result,
        };
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'tool failed';
        yield { type: 'error', message: `${tu.name}: ${errMsg}` };
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: `Error: ${errMsg}`,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  yield {
    type: 'error',
    message: `Agent hit max turns (${MAX_TURNS}) without finishing.`,
  };
  yield { type: 'done' };
}
