import express from 'express';
import cors from 'cors';
import { routes } from './routes.js';

const PORT = Number(process.env.PORT ?? 5000);
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mock-tng' }));
app.use(routes);

app.listen(PORT, () => {
  console.log(`mock-tng listening on :${PORT}`);
});
