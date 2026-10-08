# Flight Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `joebenscoter86/hit_list` into Flight Deck, the tool the pilot reel promises: paste one link into the Claude desktop Code tab, and every morning one tab shows what you owe people from Slack and email, sorted, with old items in red, refreshed hourly without a button.

**Architecture:** Keep the existing Node/Express/SQLite app (server mode). Add an in-process hourly scheduler, a corrections log that feeds the headless pull prompt and a `triage.md` rules file, a waiting-days calculation surfaced in the UI, and a documented `claude://code/new` deep link. Rewrite the agent runbook for a desktop-app user. Folder mode (no server, Cowork only) is the gated fallback in Phase 3.

**Tech Stack:** Node 20+, Express 4, better-sqlite3, `node --test` (built in, no new dependencies), Claude Code CLI for the headless pull.

**Spec:** `docs/superpowers/specs/2026-10-08-flight-deck-design.md` (Content repo). Script it serves: `brands/joe-b/writing-room/reels/2026-10-07-slack-email-hit-list/2026-10-08-flight-deck-pilot-v1.md`.

## Global Constraints

- Node `>=20` (`package.json` engines). No new runtime dependencies.
- Server binds `127.0.0.1` only. Never change this.
- Product name is **Flight Deck**; state dir `~/.flight-deck`; launchd label `com.flightdeck.server`; repo `flight-deck`; keyword `FLIGHTDECK`.
- No secrets in git. `config.json` stays git-ignored.
- The viewer never needs a terminal, GitHub, or npm by hand. Anything the runbook can't do for them goes in the guide page, not the script.
- No em dashes in any user-facing copy (README, runbook, UI, guide).
- Commit after every task. Work on `main` after Task 1 moves the old state to `hit-list-legacy`.

---

## Phase 0: the tests that decide the plan (Joe, by hand, before Task 3 ships)

### Task 0: Verify server mode works for a desktop-app user

No code. Record results in `docs/decisions/2026-10-xx-phase-0-results.md` in the repo.

- [ ] **Step 1: Headless pull sees connectors (the gating test).** On Joe's personal Mac, which has the desktop app with Slack/Gmail/Calendar connectors on and the CLI installed:

```bash
claude -p --permission-mode bypassPermissions --setting-sources user,project,local \
  "List the names of every MCP tool you have whose name starts with slack_, gmail_ or gcal_. Output only the names, one per line."
```

Expected if PASS: tool names appear (e.g. `gmail_search_messages`). If the list is empty, server mode's hourly pull cannot work on a desktop-only install. Then try the same command with `--mcp-config` pointing at a file that registers the connectors as remote MCP servers (URLs from the desktop app's connector settings). Record which worked.

- [ ] **Step 2: A desktop-only user gets Claude Code without installing anything.** On a Mac (or a fresh macOS user account) that has never had the CLI: install the Claude desktop app, open the Code tab, start a session, run `which claude` in that session. Record whether a binary exists and its path. Then, from a plain Terminal outside the app, run `claude --version`. Record whether launchd would be able to find it (if not, `config.claudeBin` must point at the app-installed path and the runbook must discover it).

- [ ] **Step 3: Runbook from a link.** In the desktop Code tab, paste: `Read https://raw.githubusercontent.com/joebenscoter86/hit_list/main/CLAUDE.md and follow it step by step. Only ask me the questions it tells you to ask.` Record every point where it stalled, asked something the runbook didn't tell it to, or needed Joe to type a command.

- [ ] **Step 4: Work-account check.** Ask two or three people on Team/Enterprise Claude plans whether their desktop app shows a Code tab. Record yes/no. This sizes the folder-mode audience.

- [ ] **Step 5: Decide.** Step 1 PASS → Phases 1 and 2 as written. Step 1 FAIL → Phase 1 still ships (it is all useful under folder mode's eventual server-less sibling), Task 3's pull trigger changes per the result, and Phase 3 moves up. Write the decision at the top of the results file.

---

## Phase 1: tasks that do not depend on Phase 0

### Task 1: Branch the old state, rename to Flight Deck

**Files:**
- Modify: `package.json`, `config.example.json`, `src/config.js:10-12,62`, `scripts/install.js:12,15`, `scripts/uninstall.js`, `scripts/open.sh`, `web/index.html`, `web/app.js` (display strings only), `README.md` (title and name only; full rewrite is Task 8), `CLAUDE.md` (name only; rewrite is Task 8), `.gitignore`

**Interfaces:**
- Produces: `config.stateDir` resolves to `~/.flight-deck`, falling back to an existing `~/.hit-list` so Joe's own install keeps working. Env override `FLIGHT_DECK_STATE_DIR` (used by tests in Task 2). Env override `FLIGHT_DECK_CONFIG` replaces `HIT_LIST_CONFIG`.

- [ ] **Step 1: Preserve the old state**

```bash
git checkout -b hit-list-legacy && git push -u origin hit-list-legacy
git checkout main
```

- [ ] **Step 2: Rename the GitHub repo** to `flight-deck` (Settings → General → Repository name). GitHub redirects the old URL. Update the local remote:

```bash
git remote set-url origin https://github.com/joebenscoter86/flight-deck.git
```

- [ ] **Step 3: State dir and config path with env overrides.** In `src/config.js` replace lines 10 to 12 and the `resolveConfigPath` candidates:

```js
// State (SQLite DB, server logs, the port/PID file) lives here, outside the repo.
// FLIGHT_DECK_STATE_DIR overrides it (tests use a temp dir). An existing ~/.hit-list
// from the Hit List era is honored so an in-place upgrade keeps its data.
const LEGACY_STATE_DIR = path.join(HOME, '.hit-list');
const STATE_DIR = process.env.FLIGHT_DECK_STATE_DIR
  || (fs.existsSync(LEGACY_STATE_DIR) && !fs.existsSync(path.join(HOME, '.flight-deck'))
      ? LEGACY_STATE_DIR
      : path.join(HOME, '.flight-deck'));
fs.mkdirSync(STATE_DIR, { recursive: true });
```

and in `resolveConfigPath`:

```js
  const candidates = [
    process.env.FLIGHT_DECK_CONFIG,
    path.join(STATE_DIR, 'config.json'),
    path.join(REPO_ROOT, 'config.json'),
  ].filter(Boolean);
```

Change the default on line 62 to `productName: user.productName || 'Flight Deck',`.

- [ ] **Step 4: Every other occurrence.** Find them all, then fix by hand (do not blind-sed the README prose; the product sentences change in Task 8):

```bash
grep -rn --exclude-dir=node_modules --exclude-dir=.git -iE "hit[ _-]?list" .
```

Required values: `package.json` name `flight-deck`, description "Flight Deck: a local daily to-do dashboard..."; `config.example.json` `productName` "Flight Deck"; `scripts/install.js` `PLIST_PATH` label `com.flightdeck.server` and `STATE_DIR` `.flight-deck` (import it from config instead of recomputing: `import { config } from '../src/config.js'` then `config.stateDir`); `scripts/uninstall.js` same label; `scripts/open.sh` reads `$HOME/.flight-deck/state.json` and falls back to `$HOME/.hit-list/state.json`; `web/index.html` `<title>Flight Deck</title>`; MCP server name in `src/mcp/tools.js:11` `'flight-deck'`; the `claude mcp add` line in docs uses `flight-deck`.

- [ ] **Step 5: Smoke test**

```bash
npm install && cp config.example.json config.json && npm start &
sleep 2 && curl -s http://localhost:3847/health && ls ~/.flight-deck && kill %1
```

Expected: `{"ok":true,"port":3847}` and `state.json` in `~/.flight-deck`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Rename Hit List to Flight Deck; state dir ~/.flight-deck with legacy fallback"
```

### Task 2: Test harness

**Files:**
- Create: `tests/helpers/config.js`, `tests/fixtures/config.test.json`, `tests/smoke.test.js`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `tests/helpers/config.js` exports `withTestEnv()` which sets `FLIGHT_DECK_STATE_DIR` to a fresh temp dir and `FLIGHT_DECK_CONFIG` to the fixture **before** `src/config.js` is imported. Every later test file imports this helper first.

- [ ] **Step 1: Fixture**

`tests/fixtures/config.test.json`:
```json
{
  "productName": "Flight Deck",
  "userName": "Test User",
  "userEmail": "test@example.com",
  "userSlackId": "U0TEST",
  "orgDomain": "example.com",
  "timezone": "America/New_York",
  "workHoursPerDay": 8,
  "port": 3999,
  "activeProjects": ["Alpha"],
  "excludeKeywords": [],
  "claudePull": { "enabled": false },
  "refresh": { "everyMinutes": 60, "quietHours": [20, 7] },
  "ageRedDays": 3
}
```

- [ ] **Step 2: Helper**

`tests/helpers/config.js`:
```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must run before any import of src/config.js (which reads env at module load).
export function withTestEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-deck-test-'));
  process.env.FLIGHT_DECK_STATE_DIR = dir;
  process.env.FLIGHT_DECK_CONFIG = path.join(
    path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'config.test.json');
  return dir;
}
```

- [ ] **Step 3: Smoke test**

`tests/smoke.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTestEnv } from './helpers/config.js';
const stateDir = withTestEnv();
const { config } = await import('../src/config.js');

test('config loads the fixture and uses the temp state dir', () => {
  assert.equal(config.productName, 'Flight Deck');
  assert.equal(config.stateDir, stateDir);
  assert.equal(config.userSlackId, 'U0TEST');
});
```

- [ ] **Step 4: Script and run**

`package.json` scripts: add `"test": "node --test tests/"`.

Run: `npm test`
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add tests package.json && git commit -m "Add node --test harness with isolated state dir"
```

### Task 3: Hourly refresh inside the server

**Files:**
- Create: `src/scheduler.js`, `tests/scheduler.test.js`
- Modify: `src/config.js` (add `refresh`), `src/server.js:48-53`, `config.example.json`

**Interfaces:**
- Consumes: `runRefresh()` from `src/pipeline/index.js` (already guards against overlapping runs).
- Produces: `isQuietHour(hour, [start, end])`, `nextDelayMs(now, everyMinutes)`, `startScheduler({ everyMinutes, quietHours, run, log })` returning `{ stop }`.

- [ ] **Step 1: Failing tests**

`tests/scheduler.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isQuietHour, nextDelayMs } from '../src/scheduler.js';

test('quiet hours wrap midnight', () => {
  assert.equal(isQuietHour(22, [20, 7]), true);
  assert.equal(isQuietHour(3, [20, 7]), true);
  assert.equal(isQuietHour(7, [20, 7]), false);
  assert.equal(isQuietHour(12, [20, 7]), false);
});

test('quiet hours inside one day', () => {
  assert.equal(isQuietHour(13, [12, 14]), true);
  assert.equal(isQuietHour(15, [12, 14]), false);
});

test('next delay lands on the next whole interval', () => {
  const now = new Date('2026-10-08T09:17:00Z');
  assert.equal(nextDelayMs(now, 60), 43 * 60 * 1000);
  assert.equal(nextDelayMs(new Date('2026-10-08T09:00:00Z'), 60), 60 * 60 * 1000);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test`
Expected: FAIL, cannot find module `../src/scheduler.js`.

- [ ] **Step 3: Implement**

`src/scheduler.js`:
```js
// In-process refresh timer. The reel's promise is "you didn't even have to press
// refresh", so the server refreshes itself on the hour and skips quiet hours.

export function isQuietHour(hour, [start, end]) {
  if (start === end) return false;
  return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}

export function nextDelayMs(now, everyMinutes) {
  const ms = everyMinutes * 60 * 1000;
  const elapsed = now.getTime() % ms;
  return elapsed === 0 ? ms : ms - elapsed;
}

export function startScheduler({ everyMinutes, quietHours, run, log = console.log, timezone }) {
  let timer = null;
  const tick = async () => {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now));
    if (!isQuietHour(hour % 24, quietHours)) {
      try { await run(); log(`[scheduler] refresh ran at ${now.toISOString()}`); }
      catch (e) { log(`[scheduler] refresh failed: ${e.message}`); }
    }
    timer = setTimeout(tick, nextDelayMs(new Date(), everyMinutes));
  };
  timer = setTimeout(tick, nextDelayMs(new Date(), everyMinutes));
  return { stop: () => clearTimeout(timer) };
}
```

- [ ] **Step 4: Config.** In `src/config.js` under `// Behavior` add:

```js
  refresh: {
    everyMinutes: Number(user.refresh?.everyMinutes) > 0 ? Number(user.refresh.everyMinutes) : 60,
    quietHours: Array.isArray(user.refresh?.quietHours) && user.refresh.quietHours.length === 2
      ? user.refresh.quietHours.map(Number) : [20, 7],
  },
```

Add to `config.example.json`: `"refresh": { "everyMinutes": 60, "quietHours": [20, 7] },` with a README note that `quietHours` is `[start, end]` in the user's timezone, 24-hour.

- [ ] **Step 5: Wire it.** In `src/server.js`, after `app.listen(...)`:

```js
import { startScheduler } from './scheduler.js';
import { runRefresh } from './pipeline/index.js';
// ...
startScheduler({
  everyMinutes: config.refresh.everyMinutes,
  quietHours: config.refresh.quietHours,
  timezone: config.timezone,
  run: () => runRefresh(),
});
```

(`runRefresh` throws "Refresh already in progress" if the UI button is mid-run; the scheduler logs and waits for the next tick.)

- [ ] **Step 6: Run tests, then a timed smoke**

Run: `npm test` → all pass. Then start the server with `refresh.everyMinutes: 1` in a scratch config and watch the log for two `[scheduler] refresh ran` lines.

- [ ] **Step 7: Commit**

```bash
git add src/scheduler.js src/server.js src/config.js config.example.json tests/scheduler.test.js
git commit -m "Refresh on a timer inside the server, with quiet hours"
```

### Task 4: Corrections log and triage rules

**Files:**
- Create: `src/triage.js`, `src/routes/triage.js`, `tests/triage.test.js`
- Modify: `src/db/schema.sql`, `src/routes/tasks.js:60-78` (PATCH), `src/pipeline/claude-pull.js:9-20,116` (prompt), `src/server.js` (mount route)

**Interfaces:**
- Produces: table `corrections(id, task_id, task, source, from_priority, to_priority, at)`; `recordCorrection(db, task, toPriority)`; `recentCorrections(db, limit)`; `buildCorrectionsBlock(rows)` (string for the prompt); `readTriageRules(stateDir)` / `writeTriageRules(stateDir, text)`; routes `GET /api/triage` and `PUT /api/triage` (`{ rules: string }`).
- The pull prompt gains a RULES block and a CORRECTIONS block, and a STEP 5 that rewrites the rules once there are 10 or more corrections since the rules were last written.

- [ ] **Step 1: Failing tests**

`tests/triage.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withTestEnv } from './helpers/config.js';
const stateDir = withTestEnv();
const { initDb, getDb, insertTask } = await import('../src/db/client.js');
const { recordCorrection, recentCorrections, buildCorrectionsBlock, readTriageRules, writeTriageRules }
  = await import('../src/triage.js');

initDb();

test('a tier change is logged with before and after', () => {
  const t = insertTask({ list_date: '2026-10-08', priority: 'should_do', task: 'Reply to Sally re: expenses', source: 'slack' });
  recordCorrection(getDb(), t, 'must_do');
  const rows = recentCorrections(getDb(), 10);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from_priority, 'should_do');
  assert.equal(rows[0].to_priority, 'must_do');
  assert.equal(rows[0].source, 'slack');
});

test('non-tier moves (blocked, personal) are not corrections', () => {
  const t = insertTask({ list_date: '2026-10-08', priority: 'should_do', task: 'x', source: 'email' });
  recordCorrection(getDb(), t, 'blocked');
  assert.equal(recentCorrections(getDb(), 10).length, 1);
});

test('corrections block is prompt-ready', () => {
  const block = buildCorrectionsBlock([{ task: 'Reply to Sally', source: 'slack', from_priority: 'should_do', to_priority: 'must_do', at: '2026-10-08T12:00:00Z' }]);
  assert.match(block, /slack/);
  assert.match(block, /should_do -> must_do/);
  assert.equal(buildCorrectionsBlock([]), 'NONE');
});

test('triage rules round-trip through the state dir', () => {
  assert.equal(readTriageRules(stateDir), '');
  writeTriageRules(stateDir, '- Anything from Sally is must_do');
  assert.equal(fs.readFileSync(path.join(stateDir, 'triage.md'), 'utf8'), '- Anything from Sally is must_do');
  assert.equal(readTriageRules(stateDir), '- Anything from Sally is must_do');
});
```

- [ ] **Step 2: Run, expect failure** (`npm test` → cannot find `../src/triage.js`).

- [ ] **Step 3: Schema.** Append to `src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS corrections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER,
  task          TEXT NOT NULL,
  source        TEXT,
  from_priority TEXT NOT NULL,
  to_priority   TEXT NOT NULL,
  at            TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_corrections_at ON corrections(at);
```

- [ ] **Step 4: Implement `src/triage.js`**

```js
import fs from 'node:fs';
import path from 'node:path';

const TIERS = new Set(['must_do', 'should_do', 'could_do']);

// A correction is the user moving an item between the three triage tiers. Moves to
// blocked/personal are workflow, not a judgment about urgency, so they are ignored.
export function recordCorrection(db, task, toPriority) {
  if (!TIERS.has(task.priority) || !TIERS.has(toPriority) || task.priority === toPriority) return null;
  return db.prepare(`
    INSERT INTO corrections (task_id, task, source, from_priority, to_priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(task.id, task.task, task.source || 'manual', task.priority, toPriority);
}

export function recentCorrections(db, limit = 20) {
  return db.prepare('SELECT * FROM corrections ORDER BY at DESC, id DESC LIMIT ?').all(limit);
}

export function correctionsSince(db, isoOrNull) {
  if (!isoOrNull) return db.prepare('SELECT COUNT(*) AS n FROM corrections').get().n;
  return db.prepare('SELECT COUNT(*) AS n FROM corrections WHERE at > ?').get(isoOrNull).n;
}

export function buildCorrectionsBlock(rows) {
  if (!rows.length) return 'NONE';
  return rows.map(r => `- [${r.source}] "${r.task}": ${r.from_priority} -> ${r.to_priority} (${r.at})`).join('\n');
}

export function triagePath(stateDir) { return path.join(stateDir, 'triage.md'); }

export function readTriageRules(stateDir) {
  try { return fs.readFileSync(triagePath(stateDir), 'utf8'); } catch { return ''; }
}

export function writeTriageRules(stateDir, text) {
  fs.writeFileSync(triagePath(stateDir), text);
}

export function triageRulesWrittenAt(stateDir) {
  try { return fs.statSync(triagePath(stateDir)).mtime.toISOString(); } catch { return null; }
}
```

- [ ] **Step 5: Route `src/routes/triage.js`** and mount in `src/server.js` as `app.use('/api/triage', triageRouter);`

```js
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
```

- [ ] **Step 6: Log corrections on PATCH.** In `src/routes/tasks.js` PATCH handler, before `updateTask`:

```js
import { recordCorrection } from '../triage.js';
// ...
  const current = getTask(id);
  if ('priority' in req.body) recordCorrection(getDb(), current, req.body.priority);
```

(The handler already fetched the task for the 404 check; reuse that variable instead of a second `getTask`.) The MCP `todo_update_task` tool goes through `updateTask` directly in `src/mcp/tools.js`; add the same `recordCorrection` call there where `priority` is in the patch.

- [ ] **Step 7: Prompt.** In `src/pipeline/claude-pull.js`, `buildPrompt` gains two parameters `(port, today, layer2Notes, lastRefreshedAt, triageRules, correctionsBlock, rewriteRules)`. Insert after the CONTEXT block:

```
============================================================
HOW ${config.userName} TRIAGES (learned rules; apply these over the defaults below)
============================================================
${triageRules || '(no learned rules yet; use the defaults)'}

RECENT CORRECTIONS (the user moved these between tiers; treat them as the ground truth for similar items)
${correctionsBlock}
```

and replace the two hard-coded priority sentences ("Use must_do priority if the message has been waiting >24h..." and "Use must_do if email is from yesterday or earlier...") with: `Default tiering when no learned rule applies: must_do if waiting more than 24h or a direct question from a project contact; otherwise should_do. Could_do is for FYIs the user may want to act on.`

Add before FINAL OUTPUT:

```
============================================================
STEP 5: LEARN (only if told to)
============================================================
REWRITE_RULES: ${rewriteRules ? 'YES' : 'NO'}
If YES: read the learned rules and the corrections above, and write an updated, short
(under 20 lines) set of triage rules in the user's terms (people, projects, kinds of
message) that would have produced the corrections. Then save them:

curl -s -X PUT http://localhost:${port}/api/triage -H 'Content-Type: application/json' \\
  -d '{"rules":"<the rules, newline-escaped>"}'
```

In `runClaudePull`, compute the inputs:

```js
import { recentCorrections, buildCorrectionsBlock, readTriageRules, correctionsSince, triageRulesWrittenAt } from '../triage.js';
// ...
  const corrections = recentCorrections(getDb(), 20);
  const rewriteRules = correctionsSince(getDb(), triageRulesWrittenAt(config.stateDir)) >= 10;
  const prompt = buildPrompt(state.port, today, layer2, lastRefreshedAt,
    readTriageRules(config.stateDir), buildCorrectionsBlock(corrections), rewriteRules);
```

- [ ] **Step 8: Run tests** (`npm test` → all pass), then a manual check: drag a task between tiers in the UI, `sqlite3 ~/.flight-deck/todo.db 'select * from corrections'` shows the row, and `~/.flight-deck/claude-pull.log` from the next refresh shows the CORRECTIONS block populated.

- [ ] **Step 9: Commit**

```bash
git add src/triage.js src/routes/triage.js src/db/schema.sql src/routes/tasks.js src/mcp/tools.js src/pipeline/claude-pull.js src/server.js tests/triage.test.js
git commit -m "Log tier corrections and feed learned triage rules into the pull prompt"
```

### Task 5: Waiting days, red at the top

**Files:**
- Create: `src/age.js`, `tests/age.test.js`
- Modify: `src/db/client.js:105-128` (`listTasks`), `src/config.js` (`ageRedDays`), `web/app.js:255-300` (`renderTaskCard`), `web/styles.css`

**Interfaces:**
- Produces: `waitingDays(task, todayISO)`; every task from `listTasks` carries `waiting_days` (integer) and `overdue` (boolean, `waiting_days >= config.ageRedDays`). `config.ageRedDays` default 3.

- [ ] **Step 1: Failing test**

`tests/age.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitingDays } from '../src/age.js';

test('waiting days counts from original_date, then created_at, then list_date', () => {
  assert.equal(waitingDays({ original_date: '2026-10-01', created_at: '2026-10-05 10:00:00', list_date: '2026-10-08' }, '2026-10-08'), 7);
  assert.equal(waitingDays({ original_date: null, created_at: '2026-10-05 10:00:00', list_date: '2026-10-08' }, '2026-10-08'), 3);
  assert.equal(waitingDays({ original_date: null, created_at: null, list_date: '2026-10-08' }, '2026-10-08'), 0);
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement `src/age.js`**

```js
const DAY = 24 * 60 * 60 * 1000;

// How long an item has been waiting on the user. original_date is set when a task is
// carried over; created_at is the first time a source produced it; list_date is the floor.
export function waitingDays(task, todayISO) {
  const first = task.original_date || (task.created_at || '').slice(0, 10) || task.list_date;
  const diff = Math.floor((Date.parse(todayISO) - Date.parse(first)) / DAY);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}
```

- [ ] **Step 4: Surface it.** In `src/db/client.js` `listTasks`, map the rows before returning:

```js
import { waitingDays } from '../age.js';
import { config } from '../config.js';   // already imported at the top of this file
// ...
  return rows.map(t => {
    const waiting_days = waitingDays(t, date);
    return { ...t, waiting_days, overdue: waiting_days >= config.ageRedDays };
  });
```

In `src/config.js` under `// Behavior`: `ageRedDays: Number(user.ageRedDays) > 0 ? Number(user.ageRedDays) : 3,` and add `"ageRedDays": 3` to `config.example.json`.

- [ ] **Step 5: UI.** In `web/app.js` `renderTaskCard`, next to the priority pill (line ~398), add:

```js
${t.waiting_days > 0 ? `<span class="waiting ${t.overdue ? 'overdue' : ''}">waiting ${t.waiting_days}d</span>` : ''}
```

and on the card's outer div add `${t.overdue && tier === 'must_do' ? 'overdue-card' : ''}` to the class list. In `web/styles.css`:

```css
.waiting { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .7; margin-left: .5rem; }
.waiting.overdue { color: #ff3b30; opacity: 1; }
.overdue-card { border-left-color: #ff3b30 !important; box-shadow: inset 4px 0 0 #ff3b30; }
```

Sort within must_do so overdue items come first: where `subset` is built (line ~423) add `.sort((a, b) => (b.overdue - a.overdue) || (a.sort_order ?? 0) - (b.sort_order ?? 0))`.

- [ ] **Step 6: Run tests, then look at it** with a task whose `original_date` is two weeks ago (`sqlite3` update) and confirm the red left edge and "waiting 14d".

- [ ] **Step 7: Commit**

```bash
git add src/age.js src/db/client.js src/config.js config.example.json web/app.js web/styles.css tests/age.test.js
git commit -m "Show waiting days; overdue must-dos go red and sort first"
```

### Task 6: The button opens Claude Desktop

**Files:**
- Modify: `src/ask-claude.js:118-120`, `web/app.js` (button labels only), `tests/ask-claude.test.js` (create)

**Interfaces:**
- Produces: `buildLaunchUri(prompt, folder)` returns `claude://code/new?q=<encoded prompt>&folder=<encoded absolute repo path>`. Route `POST /api/ask-claude/:id` is unchanged in shape.

- [ ] **Step 1: Failing test**

`tests/ask-claude.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTestEnv } from './helpers/config.js';
withTestEnv();
const { buildLaunchUri } = await import('../src/ask-claude.js');

test('launch uri is a documented claude:// deep link with a prefilled prompt', () => {
  const uri = buildLaunchUri('Reply to Sally re: expenses', '/Users/me/flight-deck');
  const u = new URL(uri);
  assert.equal(u.protocol, 'claude:');
  assert.equal(u.host + u.pathname, 'code/new');
  assert.equal(u.searchParams.get('q'), 'Reply to Sally re: expenses');
  assert.equal(u.searchParams.get('folder'), '/Users/me/flight-deck');
});
```

- [ ] **Step 2: Run, expect failure** (old implementation returns `antigravity://...`).

- [ ] **Step 3: Implement.** Replace `buildLaunchUri` in `src/ask-claude.js`:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Deep link into Claude Desktop's Code tab with the prompt prefilled (the user
 * presses Enter). Documented at support.claude.com "Open Claude Desktop with a link".
 * The prompt is truncated by the app at ~14,000 characters; ours are far shorter.
 */
export function buildLaunchUri(prompt, folder = REPO_ROOT) {
  const u = new URL('claude://code/new');
  u.searchParams.set('q', prompt);
  u.searchParams.set('folder', folder);
  return u.toString();
}
```

The prompt text in `buildPrompt` references "the hit-list MCP server"; change to "the flight-deck MCP server".

- [ ] **Step 4: UI label.** In `web/app.js` both `ask-claude-btn` buttons: label "Open in Claude". Keep "Copy prompt" as the fallback for anyone whose app does not handle the link.

- [ ] **Step 5: Run tests; click the button** on Joe's Mac and confirm Claude Desktop opens the Code tab with the prompt in the composer and asks to confirm the folder.

- [ ] **Step 6: Commit**

```bash
git add src/ask-claude.js web/app.js tests/ask-claude.test.js
git commit -m "Open tasks in Claude Desktop via the documented claude://code/new link"
```

### Task 7: Beginner config

**Files:**
- Modify: `config.example.json`, `src/config.js` (comment only), `README.md` config table (full README is Task 8)

- [ ] **Step 1: Reorder `config.example.json`** so the five beginner fields come first, the rest after a `"_advanced"` marker key (JSON has no comments; a key whose value is a sentence is the convention here):

```json
{
  "userName": "Your Name",
  "userEmail": "you@example.com",
  "userSlackId": "U0XXXXXXXXX",
  "timezone": "America/New_York",
  "activeProjects": ["Project Alpha", "Project Beta"],

  "_advanced": "Everything below has a working default. Leave it unless the guide tells you otherwise.",
  "productName": "Flight Deck",
  "orgDomain": "example.com",
  "workHoursPerDay": 8,
  "port": 3847,
  "excludeKeywords": [],
  "refresh": { "everyMinutes": 60, "quietHours": [20, 7] },
  "ageRedDays": 3,
  "claudePull": { "enabled": true },
  "claudeBin": "claude",
  "slack": { "workspaceUrl": "https://your-workspace.slack.com" },
  "guidecx": { "enabled": false, "apiBase": "https://api.guidecx.com/api/v2", "webBaseUrl": "", "token": "" },
  "fathom": { "enabled": false, "apiBase": "https://api.fathom.ai/external/v1", "apiKey": "" }
}
```

`orgDomain` is derived from `userEmail` in `src/config.js` when absent: `orgDomain: (user.orgDomain || (user.userEmail || '').split('@')[1] || '').toLowerCase(),`.

- [ ] **Step 2: `npm test` and `npm start` with the new example copied to `config.json`.** Expected: starts; `/health` ok.

- [ ] **Step 3: Commit** `git commit -am "Beginner-first config example; derive orgDomain from email"`.

### Task 7b: Sources scaffold (core three plus any connected tool)

Added 2026-10-08. Spec section 3a. Steps are an outline, not finished code like the tasks above; write the tests first.

**Files:**
- Create: `src/sources.js`, `tests/sources.test.js`
- Modify: `src/config.js` (`claudePull.sources`, `extraSources`), `config.example.json`, `src/pipeline/claude-pull.js` (prompt assembled from enabled sources), `web/app.js` (source badge fallback), `src/routes/warp-log.js` if it groups by a fixed source list

**Interfaces:**
- Produces: `config.claudePullSources` (subset of `['calendar', 'gmail', 'slack']`, default all three); `config.extraSources` (array of `{ name, slug, instructions }`, slug derived from name: lower case, non-alphanumerics to `-`); `buildExtraSourceStep(source, port, stepNumber)` returning the prompt text for one extra source.

- [ ] **Step 1: Failing tests** for slug derivation, for config dropping malformed `extraSources` entries, and for `buildExtraSourceStep` (contains the name, the instructions, `"source":"<slug>"`, and the "if you have no tools for this, say so and move on" line).
- [ ] **Step 2: Config.** Parse `claudePull.sources` and `extraSources`; add both to `config.example.json` under `_advanced` (`"extraSources": []`).
- [ ] **Step 3: Prompt.** Split `buildPrompt`'s Calendar, Slack and Gmail steps into separate functions and include only those in `config.claudePullSources`. Append one generated step per extra source. The SUMMARY line gains an `extra` object keyed by slug.
- [ ] **Step 4: UI.** Find every place the web UI maps a source to a label, icon or color and give unknown sources a neutral badge showing the name. Check the Warp Log's by-source grouping the same way.
- [ ] **Step 5: Manual check** on Joe's Mac with one real extra connector: add an `extraSources` entry, refresh, confirm items arrive with the right source and a second refresh adds no duplicates.
- [ ] **Step 6: Commit.** Task 8's runbook then gains the "I can also see X and Y connected" question and the drop-a-missing-core-source behavior from spec 3a.

---

## Phase 2: depends on Phase 0 results

### Task 8: The runbook and README for a desktop-app user

**Files:**
- Rewrite: `CLAUDE.md`, `README.md`
- Create: `docs/decisions/` (Phase 0 results live here)

**Interfaces:**
- Consumes: Phase 0 results (Step 1 connector visibility, Step 2 binary path).
- Produces: the document the guide page's prompt points at. Must be followable by Claude Code in the desktop app with the user answering only the questions listed.

- [ ] **Step 1: Write `CLAUDE.md`** with exactly these sections and this voice (plain, second person to the user, imperative to the agent):

```markdown
# Flight Deck: setup runbook (for Claude, with the user watching)

You are setting up Flight Deck for someone who does not code. They pasted one link to get
here. Do every step yourself. Ask them only the questions marked ASK. Before anything that
needs their password (Homebrew, Node), tell them: "Your Mac is about to ask for your
password. That's the Mac, not me." Confirm each step in one sentence, then move on.

## Step 0: What you're building (say this to the user once)
"Flight Deck is a page on your computer that lists what you owe people, pulled from your
Slack and email every hour. Nothing is uploaded anywhere; it runs from a folder on this Mac."

## Step 1: Prerequisites
- Run `node --version`. Need 20 or newer. If missing: run `xcode-select -p`; if that fails,
  install Command Line Tools (`xcode-select --install`, the user clicks Install). Then install
  Homebrew from https://brew.sh (one command; password prompt) and `brew install node`.
- Run `claude --version`. If missing, this session is running inside Claude Desktop, so the
  binary exists; find it with `ls ~/.local/bin/claude ~/.local/share/claude 2>/dev/null` and
  record the path for Step 3's `claudeBin`. [Phase 0 Step 2 result replaces this line.]
- ASK: "Are your Slack, Gmail and Google Calendar connectors turned on in Claude?
  (Customize > Connectors)". If no, walk them to that screen and wait.

## Step 2: Get the code
`git clone https://github.com/joebenscoter86/flight-deck.git ~/flight-deck && cd ~/flight-deck && npm install`

## Step 3: Config (ASK these five, nothing else)
Copy `config.example.json` to `~/.flight-deck/config.json` and fill:
- ASK name; ASK email (derive orgDomain); timezone from `date +%Z` (confirm);
- ASK Slack member ID ("In Slack: your profile picture > Profile > the three dots > Copy member ID. It starts with U.");
- ASK "What projects or clients should it track? Two or three names is plenty."
- Set `slack.workspaceUrl` from the Slack URL they use; set `claudeBin` if Step 1 found a path.
Leave everything under `_advanced` alone.

## Step 4: Start it and keep it running
`npm run install:agent` (writes a launchd agent and starts the server). Confirm with
`curl -s http://localhost:3847/health`. If the port moved, read `~/.flight-deck/state.json`.

## Step 5: First refresh
`curl -s -X POST http://localhost:3847/api/refresh -H 'Content-Type: application/json' -d '{}'`
It takes one to three minutes. Then `open http://localhost:3847`. Tell the user: "That's
your list. Drag anything that's in the wrong column; it learns from that."

## Step 6: What happens tomorrow (say this, then stop)
"It refreshes itself every hour from 7am to 8pm. Open this tab in the morning. For the first
few days, move things between must-do, should-do and could-do; after about ten moves it
rewrites its own rules."

## If something goes wrong
- Refresh adds nothing: `tail -50 ~/.flight-deck/claude-pull.log`. If it shows no slack_/gmail_
  tools, the connectors are not reachable; send the user to the guide's "empty list" section.
- Port in use: the server picks the next free one; the real port is in `~/.flight-deck/state.json`.
- To stop: `npm run uninstall:agent`. To remove everything: also delete `~/.flight-deck` and `~/flight-deck`.

## Guardrails
- Never commit `config.json`. Never bind to anything but 127.0.0.1. Never change the
  `bypassPermissions` pull into something network-facing.
```

- [ ] **Step 2: Rewrite `README.md`** as one path: what it is (three sentences), the morning screenshot, "Set it up: paste this into Claude Desktop's Code tab" with the exact prompt (`Read https://raw.githubusercontent.com/joebenscoter86/flight-deck/main/CLAUDE.md and follow it step by step. Ask me only the questions it tells you to ask.`), then "How it works" (the architecture diagram from the old README), "What leaves your computer" (verbatim from the spec section 5.7), then an "Advanced" section holding the old config table, MCP tools, GuideCX/Fathom, Warp Log, manual operations and troubleshooting.

- [ ] **Step 3: Dry run.** On a Mac without `~/.flight-deck`, paste the README prompt into the desktop Code tab and let it run with no help. Log every stall in `docs/decisions/2026-10-xx-runbook-dry-run.md`. Fix the runbook until a run completes with only the five ASKs plus password prompts.

- [ ] **Step 4: Commit** `git add CLAUDE.md README.md docs && git commit -m "Runbook and README for a desktop-app user pasting one link"`.

### Task 9: Guide page `/guides/flightdeck`

**Files (joebenscoter-site repo):** `src/content/guides/flightdeck.md` per `production/joeb-guide-pages.md` in the Content repo.

**Interfaces:**
- Consumes: the README prompt from Task 8.
- Produces: the page the comment keyword delivers; `funnel.json` in the reel's distribution folder links `https://joebenscoter.com/guides/flightdeck?ref=dm`.

- [ ] **Step 1: Write the page** with the eight sections from the spec (section 5), in this order and with these headings: What you're about to get; Before you start; The prompt (one code block, the README prompt, with a copy button if the template has one); The next half hour; Tomorrow morning; If something's in the way (subheadings: "No Code tab, or Claude Code is disabled at work" → folder mode once Phase 3 ships, until then "email me"; "Slack isn't an approved connector" → set `claudePull` to email and calendar only by telling Claude "skip Slack"; "It asked for my password"; "The list is empty"; "Port already in use"; "Stop or uninstall"); What leaves your computer; Power users.
- [ ] **Step 2: Publish** per the guide-pages runbook; verify the unlock works; add `funnel.json` to the reel's distribution folder when it exists.
- [ ] **Step 3: Commit** in the site repo; push to `main` deploys.

---

## Phase 3: folder mode (gated: Phase 0 Step 1 fails, or Step 4 shows a real blocked audience)

### Task 10: Folder mode prompts

**Files:**
- Create: `folder-mode/README.md`, `folder-mode/SETUP.md`, `folder-mode/REFRESH.md`, `folder-mode/FLIGHTDECK.template.md`, `folder-mode/flightdeck.template.html`

No server code. Everything here is a prompt Cowork follows and a template it fills.

- [ ] **Step 1: `SETUP.md`** (the Cowork runbook; the guide's folder-mode prompt is `Read https://raw.githubusercontent.com/joebenscoter86/flight-deck/main/folder-mode/SETUP.md and follow it.`): ask the user to attach an empty folder named Flight Deck; ASK the same five questions as Task 8 Step 3; write `FLIGHTDECK.md` from the template; create `state/items.json` as `[]` and `corrections.md` empty; run `REFRESH.md` once; open `flightdeck.html`; then tell the user: "Type /schedule, pick Hourly, and paste this: `Read REFRESH.md in my Flight Deck folder and do what it says.`" (Phase 0 Step 2's answer on whether Cowork can create the schedule itself decides whether that last line is an instruction to the user or to Cowork.)

- [ ] **Step 2: `REFRESH.md`**: read `FLIGHTDECK.md` (identity and rules) and `corrections.md`; search Slack DMs, mentions and unanswered threads since the `last_run` in `state/meta.json` (default 24h); search Gmail `is:unread in:inbox`; list today's calendar; merge into `state/items.json` keyed by `slack:<channel>:<ts>` and `gmail:<threadId>`, never re-adding an id marked done; tier each new item using the rules then the defaults (same text as Task 4 Step 7); if `corrections.md` has 10 or more lines since the rules were last rewritten, rewrite the rules section of `FLIGHTDECK.md`; render `flightdeck.html` from `flightdeck.template.html` (three columns, overdue items first and red when waiting 3+ days, today's meetings in a side column, each item's title a link to its source, each item carrying an "Open in Claude" link `claude://cowork/new?q=<task context>&folder=<this folder>`); write `last_run`.

- [ ] **Step 3: `FLIGHTDECK.template.md`**: sections Identity (name, email, Slack ID, timezone, projects), Rules (empty list with the defaults as comments), Done (ids the user marked done by editing the html's checkbox, which writes back... no: in folder mode "done" is the user deleting the line in `flightdeck.html` or telling Cowork; keep it that simple and say so).

- [ ] **Step 4: Dry run** on Joe's Mac in Cowork with a scratch folder; one hourly cycle observed; record in `docs/decisions/`.

- [ ] **Step 5: Commit** `git add folder-mode && git commit -m "Folder mode: Cowork-only Flight Deck with no server"`; add the folder-mode prompt to the guide page's "No Code tab" section.

---

## Self-review notes

- Spec coverage: changes 1 to 9 map to Tasks 1, 3, 4, 5, 6, 7, 8, 2 and 1 respectively; unknowns to Task 0; folder mode to Task 10; guide to Task 9. Script lines in spec section 6 are satisfied by Tasks 3, 6, 8 and 9.
- Type consistency: `recordCorrection(db, task, toPriority)` is used in Task 4 Steps 4 and 6 with the same signature; `waitingDays(task, todayISO)` in Task 5 Steps 1, 3 and 4; `buildLaunchUri(prompt, folder)` in Task 6 Steps 1 and 3; `config.refresh.{everyMinutes,quietHours}` and `config.ageRedDays` defined in Tasks 3 and 5 and used by the fixture in Task 2.
- Known soft spot: Task 8 Step 1's `claude` binary discovery line is written for the expected Phase 0 outcome and is marked to be replaced by the measured result.
