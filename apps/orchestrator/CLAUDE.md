# Lane B: Orchestrator

You are building the agent core for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane B section of `/IMPLEMENTATION.md`.

## Tech
Node 20, TypeScript strict, Hono. Zod for validation.

## Files you own
Everything under `apps/orchestrator/`. You also own `packages/shared/`.

## LLM abstraction
Never call vendor SDKs outside `src/llm/`. Always go through `getLLM()`. Default `LLM_PROVIDER=anthropic` for development. `bedrock` for the demo. `qwen` is optional and used only for Malay paraphrase.

## Tool dispatching
- Tools needing merchant data: call mock TNG (`http://mock-tng:5050`)
- Tools needing grant data: read `packages/grants-kb` directly via `import { listGrants, getGrantById } from '@tng-rise/grants-kb'`
- Tools needing a browser run: call browser agent (`http://browser-agent:5001`) and forward `browser_step` events through your SSE stream

## Tool handler contract
A handler is `AsyncGenerator<AgentEvent, unknown, void>`. Yield events to stream progress. Return the final result (becomes the `tool_result` value). Errors thrown by a handler are caught by the agent loop and surfaced as `error` events without crashing the server.

## SSE
Stream `AgentEvent`s. Always end with `done` or `error`. Set `Content-Type: text/event-stream`. Disable buffering on the response (`X-Accel-Buffering: no`).

## System prompt
Lives in `src/agent/prompts.ts`. Reload on dev. Do not inline the prompt elsewhere.

## Tool schemas
Anthropic tool format (JSON Schema). Lives in `src/agent/toolSchemas.ts`. Bedrock Converse API uses the same shape for Claude models.

## Memory
In-memory `Map` keyed by `sessionId`. No database. Session resets on server restart, fine for the demo.

## Email-submission grants
For `submissionMethod: "email"` grants, do not call the browser agent. `runGrantAgent` short-circuits to a `handoff` event with `kind: "email"` and the pre-filled subject and body in the payload. The frontend opens `mailto:`.

## Run
```
cd apps/orchestrator
npm install
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npm run dev
```

Service on :4000.

## Don't
- Do not add a vector DB. Grant matching is rule-based for the demo.
- Do not store conversation history beyond the in-memory session map.
- Do not hardcode merchant data. Always go through mock-tng.
- Do not catch errors silently. Surface them as `error` events to the frontend.
- Do not edit `packages/shared/` types without telling the other lanes in chat.
