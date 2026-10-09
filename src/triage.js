import fs from 'node:fs';
import path from 'node:path';

const TIERS = new Set(['must_do', 'should_do', 'could_do']);

// A correction is the user moving an item between the three triage tiers. Moves to
// blocked/personal are workflow, not a judgment about urgency, so they are ignored.
// `at` is written as an ISO string (not SQLite's datetime('now')) so it compares
// correctly against the rules file's mtime in correctionsSince.
export function recordCorrection(db, task, toPriority, at = new Date().toISOString()) {
  if (!task || !TIERS.has(task.priority) || !TIERS.has(toPriority) || task.priority === toPriority) return null;
  return db.prepare(`
    INSERT INTO corrections (task_id, task, source, from_priority, to_priority, at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(task.id, task.task, task.source || 'manual', task.priority, toPriority, at);
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
