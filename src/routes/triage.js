import { Router } from 'express';
import { config } from '../config.js';
import { readTriageRules, writeTriageRules } from '../triage.js';

export const triageRouter = Router();

triageRouter.get('/', (req, res) => res.json({ rules: readTriageRules(config.stateDir) }));

triageRouter.put('/', (req, res) => {
  const rules = typeof req.body?.rules === 'string' ? req.body.rules : null;
  if (rules === null) return res.status(400).json({ error: 'rules (string) required' });
  writeTriageRules(config.stateDir, rules.trim() + '\n');
  res.json({ ok: true });
});
