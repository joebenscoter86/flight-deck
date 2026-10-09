import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withTestEnv } from './helpers/config.js';
const stateDir = withTestEnv();
const { initDb, getDb, insertTask } = await import('../src/db/client.js');
const {
  recordCorrection, recentCorrections, correctionsSince, buildCorrectionsBlock,
  readTriageRules, writeTriageRules, triageRulesWrittenAt,
} = await import('../src/triage.js');

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

test('non-tier moves (blocked, personal) and no-op moves are not corrections', () => {
  const t = insertTask({ list_date: '2026-10-08', priority: 'should_do', task: 'x', source: 'email' });
  recordCorrection(getDb(), t, 'blocked');
  recordCorrection(getDb(), t, 'should_do');
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
  assert.equal(triageRulesWrittenAt(stateDir), null);
  writeTriageRules(stateDir, '- Anything from Sally is must_do');
  assert.equal(fs.readFileSync(path.join(stateDir, 'triage.md'), 'utf8'), '- Anything from Sally is must_do');
  assert.equal(readTriageRules(stateDir), '- Anything from Sally is must_do');
});

test('corrections made later the same day as a rules rewrite still count', () => {
  const t = insertTask({ list_date: '2026-10-08', priority: 'could_do', task: 'y', source: 'email' });
  const rulesWrittenAt = '2026-10-08T12:00:00.000Z';
  const before = correctionsSince(getDb(), rulesWrittenAt);
  recordCorrection(getDb(), t, 'must_do', '2026-10-08T11:00:00.000Z');
  assert.equal(correctionsSince(getDb(), rulesWrittenAt), before);
  recordCorrection(getDb(), t, 'should_do', '2026-10-08T15:00:00.000Z');
  assert.equal(correctionsSince(getDb(), rulesWrittenAt), before + 1);
});
