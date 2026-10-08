import {
  insertTask, findExisting, findByIdentity, computeIdentityHash, reviveRow,
  insertMeeting, clearMeetings, getDb,
} from '../db/client.js';
import { emit } from '../sse.js';

// Two-layer dedup used by every source pull: exact (source, external_id) first,
// then identity_hash across all dates. Returns true if a pre-existing row makes
// this insertion a no-op. Side effect: if an existing row is dismissed (done=0),
// it's revived to today's list and the insert is skipped.
// Dismiss semantics: "not today, but let the source bring it back."
export function shouldSkipInsert(t, today) {
  if (t.external_id) {
    const existing = findExisting(t.source, t.external_id);
    if (existing) {
      if (existing.done === 0 && existing.status === 'dismissed') {
        const revived = reviveRow(existing.id, today);
        emit('task.updated', revived);
      }
      return true;
    }
  }
  const hash = computeIdentityHash(t.task, t.project, t.source);
  const match = findByIdentity(hash);
  // Done rows block re-insertion forever (completion contract).
  // Today-list matches block duplicates within the same refresh.
  // Dismissed matches do NOT block — let the source emit a fresh row.
  if (match && (match.done === 1 || match.list_date === today)) {
    return true;
  }
  return false;
}

const TIERS = new Set(['must_do', 'should_do', 'could_do']);
const STATUSES = new Set(['active', 'blocked', 'deferred', 'in_progress']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpUrl = v => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v) ? v.slice(0, 2000) : null);
const posInt = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : null);

// The pull session's output is model-written text derived from other people's
// messages, so nothing in it is trusted: every field is type-checked, clamped and
// limited to the sources that were actually enabled for this run.
export function cleanTask(raw, allowedSources) {
  if (!raw || typeof raw !== 'object') return null;
  const task = str(raw.task, 300);
  if (!task || !allowedSources.has(raw.source)) return null;
  return {
    task,
    source: raw.source,
    priority: TIERS.has(raw.priority) ? raw.priority : 'should_do',
    project: str(raw.project, 120),
    notes: str(raw.notes, 2000),
    est_minutes: posInt(raw.est_minutes, 480),
    external_id: str(raw.external_id, 300),
    source_url: httpUrl(raw.source_url),
    original_date: typeof raw.original_date === 'string' && ISO_DATE.test(raw.original_date) ? raw.original_date : null,
  };
}

export function cleanMeeting(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = str(raw.title, 300);
  const start = str(raw.start_time, 40);
  const end = str(raw.end_time, 40);
  if (!title || !start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return null;
  const mins = posInt(raw.duration_min, 1440) ?? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000));
  return { title, start_time: start, end_time: end, duration_min: mins, needs_prep: raw.needs_prep ? 1 : 0 };
}

// Write one pull's result into the database. `active` is the resolved source list
// for this run. Returns counts by task source plus meetings.
export function ingestPullResult(result, { today, active }) {
  const counts = { meetings: 0, tasks: {} };
  const allowed = new Set(active.map(s => s.taskSource));
  const reported = result?.sources && typeof result.sources === 'object' ? result.sources : {};

  // Only replace today's meetings when the calendar was really read; an empty
  // array from a failed read must not wipe a good list.
  if (allowed.has('calendar') && Array.isArray(result?.meetings) && reported.calendar === 'ok') {
    const meetings = result.meetings.map(cleanMeeting).filter(Boolean);
    clearMeetings(today);
    for (const m of meetings) insertMeeting({ ...m, list_date: today });
    emit('meetings.replaced', { date: today, count: meetings.length });
    counts.meetings = meetings.length;
  }

  for (const raw of Array.isArray(result?.tasks) ? result.tasks : []) {
    const t = cleanTask(raw, allowed);
    if (!t || shouldSkipInsert(t, today)) continue;
    const row = insertTask({ ...t, list_date: today });
    emit('task.created', row);
    counts.tasks[t.source] = (counts.tasks[t.source] || 0) + 1;
  }

  if (Array.isArray(result?.classifications)) {
    const upd = getDb().prepare('UPDATE tasks SET status = ?, resurface_date = ? WHERE id = ?');
    for (const c of result.classifications) {
      if (!Number.isInteger(c?.id)) continue;
      const date = typeof c.resurface_date === 'string' && ISO_DATE.test(c.resurface_date) ? c.resurface_date : null;
      upd.run(STATUSES.has(c.status) ? c.status : 'active', date, c.id);
    }
  }
  return counts;
}
