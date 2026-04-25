import { Router } from 'express';
import { MerchantProfile, type Transaction } from '@tng-rise/shared';
import profile from './data/profile.json' with { type: 'json' };
import { generateTransactions } from './data/transactions.js';

export const routes = Router();

// Validate the profile JSON once at boot. If someone edits the JSON in a way
// that breaks the contract, mock-tng fails to start. Better than mid-demo.
const validatedProfile = MerchantProfile.parse(profile);

routes.get('/merchant', (_req, res) => {
  res.json(validatedProfile);
});

routes.get('/transactions', (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
  const transactions: Transaction[] = generateTransactions(new Date(), days);
  res.json(transactions);
});
