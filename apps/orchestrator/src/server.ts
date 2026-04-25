import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { chat } from './routes/chat.js';
import { env } from './lib/env.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => c.json({ ok: true, provider: env.LLM_PROVIDER, model: env.LLM_MODEL }));

app.route('/', chat);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`orchestrator listening on :${info.port} (LLM_PROVIDER=${env.LLM_PROVIDER})`);
});
