#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';

const HOME = os.homedir();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const SERVER_JS = path.join(APP_DIR, 'src', 'server.js');
const PLIST_PATH = path.join(HOME, 'Library', 'LaunchAgents', 'com.flightdeck.server.plist');
const STATE_DIR = config.stateDir;

// launchd starts the server with a bare PATH. The hourly pull shells out to
// `claude`, which normally lives in ~/.local/bin, so put it (and wherever this
// shell finds it) on the agent's PATH.
const CLAUDE_DIRS = [path.join(HOME, '.local', 'bin')];
try {
  const found = path.dirname(execSync('command -v claude', { stdio: ['ignore', 'pipe', 'ignore'], shell: '/bin/sh' }).toString().trim());
  if (found && !CLAUDE_DIRS.includes(found)) CLAUDE_DIRS.unshift(found);
} catch {}

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.flightdeck.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${SERVER_JS}</string>
  </array>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${STATE_DIR}/server.log</string>
  <key>StandardErrorPath</key><string>${STATE_DIR}/server.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${[...CLAUDE_DIRS, '/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin'].join(':')}</string>
  </dict>
</dict>
</plist>
`;

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
fs.writeFileSync(PLIST_PATH, plist);
console.log(`Wrote plist to ${PLIST_PATH}`);

try { execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: 'pipe' }); } catch {}
execSync(`launchctl load "${PLIST_PATH}"`);
console.log('Loaded launchd agent.');

// The first start can take a few seconds; wait for the server to report its port.
const statePath = path.join(STATE_DIR, 'state.json');
const startedAfter = Date.now() - 1000;
let state = null;
for (let i = 0; i < 40 && !state; i++) {
  await new Promise(r => setTimeout(r, 500));
  try {
    const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (Date.parse(s.started_at) >= startedAfter) state = s;
  } catch {}
}
if (state) {
  console.log(`Server is up on http://localhost:${state.port} (pid ${state.pid})`);
} else {
  console.error('Server did not start within 20 seconds. Check ' + path.join(STATE_DIR, 'server.log'));
  process.exit(1);
}
