#!/usr/bin/env node
// Demo mode: a made-up list for screenshots and screen recordings.
//
// Runs a second copy of the app on its own port with its own data folder
// (~/.flight-deck-demo), so it never touches or shows the real list. The data is
// rebuilt on every start so "today" and the waiting-days counts are always current.
// Nothing here reads any account: the hourly pull is switched off.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEMO_DIR = path.join(os.homedir(), '.flight-deck-demo');
const PORT = Number(process.env.FLIGHT_DECK_DEMO_PORT) || 3900;

fs.mkdirSync(DEMO_DIR, { recursive: true });
for (const f of ['todo.db', 'todo.db-shm', 'todo.db-wal', 'last-refresh.json', 'state.json']) {
  fs.rmSync(path.join(DEMO_DIR, f), { force: true });
}
const configPath = path.join(DEMO_DIR, 'config.json');
fs.writeFileSync(configPath, JSON.stringify({
  userName: 'Alex Rivera',
  userEmail: 'alex@brightside.example',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  activeProjects: ['Northwind Renewal', 'Website Relaunch'],
  port: PORT,
  claudePull: { enabled: false },
  refresh: { everyMinutes: 60, quietHours: [0, 24] },
}, null, 2));

// Must be set before src/config.js is imported.
process.env.FLIGHT_DECK_STATE_DIR = DEMO_DIR;
process.env.FLIGHT_DECK_CONFIG = configPath;

const { initDb, insertTask, insertMeeting, updateTask, updateList, todayLocal } = await import('../src/db/client.js');
initDb();

const today = todayLocal();
const daysAgo = n => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const slack = id => `https://brightside.slack.com/archives/C0DEMO/p${id}`;
const mail = id => `https://mail.google.com/mail/u/0/#inbox/${id}`;

const TASKS = [
  // Must do. The first one is the reel's opening shot: two weeks old, in red, on top.
  { priority: 'must_do', source: 'slack', waiting: 14, est_minutes: 10, project: null,
    task: 'Reply to Sally re: Q3 expense report approval',
    notes: 'Sally Chen in #finance: "Can you approve the Q3 expenses? I need it before we close the books."',
    source_url: slack('1700000000000100') },
  { priority: 'must_do', source: 'email', waiting: 4, est_minutes: 15, project: 'Northwind Renewal',
    task: 'Reply to Marcus re: contract renewal terms',
    notes: 'Marcus Webb (Northwind) is asking whether the two-year pricing still stands. Second nudge.',
    source_url: mail('demo-thread-1') },
  { priority: 'must_do', source: 'slack', waiting: 1, est_minutes: 5, project: 'Website Relaunch',
    task: "Answer Priya's question about the launch date",
    notes: 'Priya Patel in a DM: "Are we still on for the 21st? Design needs to know today."',
    source_url: slack('1700000000000200') },
  { priority: 'must_do', source: 'calendar', waiting: 0, est_minutes: 15, project: 'Northwind Renewal',
    task: 'Prep for Northwind Renewal call' },

  { priority: 'should_do', source: 'email', waiting: 2, est_minutes: 20, project: null,
    task: 'Send Dana the revised onboarding deck',
    notes: 'Dana Okafor asked for the version with the new pricing slide.',
    source_url: mail('demo-thread-2') },
  { priority: 'should_do', source: 'slack', waiting: 0, est_minutes: 15, project: 'Website Relaunch',
    task: "Review Tom's draft of the customer announcement",
    notes: 'Tom Alvarez in #relaunch: "Draft is in the doc, would love your eyes before Thursday."',
    source_url: slack('1700000000000300') },
  { priority: 'should_do', source: 'email', waiting: 1, est_minutes: 5, project: null,
    task: 'Reply to Jordan re: Thursday workshop headcount',
    notes: 'Jordan Lee needs a final number for catering.',
    source_url: mail('demo-thread-3') },
  { priority: 'should_do', source: 'asana', waiting: 0, est_minutes: 30, project: 'Website Relaunch',
    task: 'Update status on "Pricing page copy" (due Friday)',
    notes: 'Assigned to you in Asana. No update in six days.',
    source_url: 'https://app.asana.com/0/demo/1' },

  { priority: 'could_do', source: 'email', waiting: 0, est_minutes: 20, project: null,
    task: 'Read the industry report Leah forwarded',
    notes: 'Leah Kim: "No rush, thought of you when I saw the section on renewals."',
    source_url: mail('demo-thread-4') },
  { priority: 'could_do', source: 'slack', waiting: 2, est_minutes: 5, project: null,
    task: 'Weigh in on team offsite dates',
    notes: 'Poll in #team. Eight of ten people have answered.',
    source_url: slack('1700000000000400') },

  { priority: 'blocked', source: 'manual', waiting: 0, est_minutes: 45, project: null,
    task: 'Finalize next quarter budget', notes: 'Waiting on numbers from finance.' },
  { priority: 'personal', source: 'manual', waiting: 0, est_minutes: 5, project: null,
    task: 'Book dentist appointment' },
];

TASKS.forEach((t, i) => {
  const { waiting, ...row } = t;
  insertTask({
    ...row, list_date: today, sort_order: i,
    original_date: waiting > 0 ? daysAgo(waiting) : null,
    external_id: `demo-${i}`,
  });
});

// Two finished items so the progress numbers are not zero.
for (const task of ['Approve Tom\'s time-off request', 'Send the signed NDA back to legal']) {
  const row = insertTask({ list_date: today, priority: 'should_do', task, source: 'email', est_minutes: 5 });
  updateTask(row.id, { done: 1 });
}

const MEETINGS = [
  ['Team standup', 9, 30, 15, 0],
  ['Northwind Renewal call', 11, 0, 45, 1],
  ['1:1 with Priya', 14, 0, 30, 0],
  ['Website Relaunch review', 15, 30, 60, 1],
];
for (const [title, h, m, mins, prep] of MEETINGS) {
  insertMeeting({
    list_date: today, title, start_time: at(h, m),
    end_time: new Date(Date.parse(at(h, m)) + mins * 60000).toISOString(),
    duration_min: mins, needs_prep: prep,
  });
}

// Looks like it refreshed on the last hour, as the real one would have.
const lastHour = new Date(); lastHour.setMinutes(0, 0, 0);
updateList(today, { last_refreshed_at: lastHour.toISOString() });

console.log(`Demo list seeded in ${DEMO_DIR}. Nothing here is real, and your own list is untouched.`);
await import('../src/server.js');
console.log(`Open http://localhost:${PORT} (if that port was busy, see ${path.join(DEMO_DIR, 'state.json')}). Press Ctrl+C to stop.`);
