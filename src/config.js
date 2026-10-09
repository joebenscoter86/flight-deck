import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE_SOURCES, normalizeExtraSources } from './sources.js';

const HOME = os.homedir();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// State (SQLite DB, server logs, the port/PID file) lives here, outside the repo.
// FLIGHT_DECK_STATE_DIR overrides it (tests use a temp dir). An existing ~/.hit-list
// from the Hit List era is honored so an in-place upgrade keeps its data.
const LEGACY_STATE_DIR = path.join(HOME, '.hit-list');
const STATE_DIR = process.env.FLIGHT_DECK_STATE_DIR
  || (fs.existsSync(LEGACY_STATE_DIR) && !fs.existsSync(path.join(HOME, '.flight-deck'))
      ? LEGACY_STATE_DIR
      : path.join(HOME, '.flight-deck'));
fs.mkdirSync(STATE_DIR, { recursive: true });

// Resolve the config file. Precedence:
//   1. FLIGHT_DECK_CONFIG env var (absolute path)
//   2. ~/.flight-deck/config.json
//   3. <repo root>/config.json
// Copy config.example.json to one of these and fill it in. See README.md.
function resolveConfigPath() {
  const candidates = [
    process.env.FLIGHT_DECK_CONFIG,
    path.join(STATE_DIR, 'config.json'),
    path.join(REPO_ROOT, 'config.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadUserConfig() {
  const p = resolveConfigPath();
  if (!p) {
    throw new Error(
      'No config.json found. Copy config.example.json to config.json ' +
      '(in the repo root or ~/.flight-deck/) and fill it in. See README.md.'
    );
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse config at ${p}: ${e.message}`);
  }
}

const user = loadUserConfig();

// Secrets can live in config.json OR in environment variables. Env wins so you
// can keep tokens out of any file (e.g. inject them from a service manager).
const guidecxToken = process.env.GUIDECX_TOKEN || user.guidecx?.token || null;
const fathomKey = process.env.FATHOM_API_KEY || user.fathom?.apiKey || null;

export const config = {
  // Where state lives
  stateDir: STATE_DIR,
  dbPath: path.join(STATE_DIR, 'todo.db'),
  statePath: path.join(STATE_DIR, 'state.json'),
  logPath: path.join(STATE_DIR, 'server.log'),

  // Server
  defaultPort: user.port || 3847,
  productName: user.productName || 'Flight Deck',

  // Who you are
  userName: user.userName || 'you',
  userEmail: user.userEmail || '',
  userSlackId: user.userSlackId || '',
  orgDomain: (user.orgDomain || (user.userEmail || '').split('@')[1] || '').toLowerCase(),

  // Behavior
  timezone: user.timezone || 'America/New_York',
  workHoursPerDay: user.workHoursPerDay ?? 8,
  activeProjects: Array.isArray(user.activeProjects) ? user.activeProjects : [],
  excludeKeywords: Array.isArray(user.excludeKeywords) ? user.excludeKeywords : [],
  // Self-refresh timer. quietHours is [start, end) in the user's timezone, 24-hour.
  refresh: {
    everyMinutes: Number(user.refresh?.everyMinutes) > 0 ? Number(user.refresh.everyMinutes) : 60,
    quietHours: Array.isArray(user.refresh?.quietHours) && user.refresh.quietHours.length === 2
      ? user.refresh.quietHours.map(Number) : [20, 7],
  },
  // An item waiting this many days or more shows its age in red.
  ageRedDays: Number(user.ageRedDays) > 0 ? Number(user.ageRedDays) : 3,

  // Headless-Claude pull (Slack / Gmail / Calendar via your claude.ai connectors)
  claudeBin: process.env.CLAUDE_BIN || user.claudeBin || 'claude',
  claudePullEnabled: user.claudePull?.enabled !== false,
  // "auto": the server pulls by itself every hour with the claude command-line tool.
  // "manual": that tool is not available, so the Refresh button opens the Claude app
  // and the user presses Enter there. Setup picks this when it finds no CLI.
  claudePullMode: user.claudePull?.mode === 'manual' ? 'manual' : 'auto',
  // Model for the hourly pull. It runs many times a day against the user's plan
  // limits, so the default is the mid-size model, not the account's default.
  claudePullModel: typeof user.claudePull?.model === 'string' && user.claudePull.model.trim()
    ? user.claudePull.model.trim() : 'sonnet',
  // Which of the core three the pull reads. Setup drops any the user cannot connect.
  claudePullSources: Array.isArray(user.claudePull?.sources)
    ? user.claudePull.sources.filter(k => k in CORE_SOURCES)
    : Object.keys(CORE_SOURCES),
  // Any other connector the user already has in Claude: [{ name, instructions }].
  extraSources: normalizeExtraSources(user.extraSources),
  slackWorkspaceUrl: (user.slack?.workspaceUrl || '').replace(/\/$/, ''),

  // GuideCX (optional native source)
  guidecx: {
    enabled: user.guidecx?.enabled !== false && !!guidecxToken,
    apiBase: (user.guidecx?.apiBase || 'https://api.guidecx.com/api/v2').replace(/\/$/, ''),
    webBaseUrl: (user.guidecx?.webBaseUrl || '').replace(/\/$/, ''),
    token: guidecxToken,
  },

  // Fathom (optional native source)
  fathom: {
    enabled: user.fathom?.enabled !== false && !!fathomKey,
    apiBase: (user.fathom?.apiBase || 'https://api.fathom.ai/external/v1').replace(/\/$/, ''),
    apiKey: fathomKey,
  },
};
