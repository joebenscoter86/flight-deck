import { Router } from 'express';
import { config } from '../config.js';
import { todayLocal } from '../db/client.js';
import { runRefresh, isRunning, lastSummary } from '../pipeline/index.js';
import { refreshHealth } from '../health.js';
import { buildLaunchUri } from '../ask-claude.js';

export const refreshRouter = Router();

refreshRouter.post('/', async (req, res) => {
  if (isRunning()) return res.status(409).json({ error: 'Refresh in progress' });
  try {
    const result = await runRefresh({
      skipClaudePull: req.body?.skipClaudePull === true,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

refreshRouter.get('/status', (req, res) => {
  res.json({
    in_progress: isRunning(),
    last: lastSummary(),
    health: refreshHealth(lastSummary()),
    mode: config.claudePullMode,
  });
});

// --- Refresh through the Claude app (fallback; see claude-pull.js) --------------

// The link the page's button opens. The prompt is kept short because deep links
// have a length limit; the session fetches the full instructions from here.
refreshRouter.get('/manual-link', (req, res) => {
  const port = req.socket.localPort;
  const prompt = `Refresh my Flight Deck list. Run this and do exactly what it prints: curl -s http://localhost:${port}/api/refresh/manual-prompt`;
  res.json({ prompt, launch_uri: buildLaunchUri(prompt) });
});

refreshRouter.get('/manual-prompt', async (req, res) => {
  const { buildManualPrompt } = await import('../pipeline/claude-pull.js');
  res.type('text/plain').send(buildManualPrompt(todayLocal(), req.socket.localPort));
});

refreshRouter.post('/ingest', async (req, res) => {
  if (isRunning()) return res.status(409).json({ error: 'A refresh is already running. Try again in a minute.' });
  try {
    const result = await runRefresh({ manualResult: req.body });
    if (result.errors.length) return res.status(400).json({ ok: false, errors: result.errors });
    res.json({ ok: true, added: result.added.claude, read: result.pull.sources, missing: result.pull.missing });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
