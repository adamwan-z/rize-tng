import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from './routes.js';

const PORT = Number(process.env.PORT ?? 5000);
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mock-tng' }));
app.use(routes);

// Static assets: HTML form mocks and the Lotus catalog JSON. Browser-agent
// navigates to /grant.html and /lotus.html; both pages and browser-agent's
// SKU validator read /data/lotus-catalog.json so the catalog stays in sync.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
app.use(express.static(path.join(root, 'public')));
app.use('/data', express.static(path.join(root, 'data')));

app.listen(PORT, () => {
  console.log(`mock-tng listening on :${PORT}`);
});
