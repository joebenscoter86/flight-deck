// Which connectors the hourly pull reads from, and what it may do with them.
//
// The core three (Calendar, Gmail, Slack) are expected; any other connector the
// user already has in Claude can be added as an "extra source" in config with no
// code change. The pull session is only ever allowed read-style tools on the
// connectors it is using (see allowRules), because it reads untrusted text.

export const CORE_SOURCES = {
  calendar: { label: 'Google Calendar', taskSource: 'calendar', match: /calendar/i },
  gmail:    { label: 'Gmail',           taskSource: 'email',    match: /gmail/i },
  slack:    { label: 'Slack',           taskSource: 'slack',    match: /slack/i },
};

// Task `source` values already spoken for; an extra source may not reuse them.
const RESERVED_SLUGS = new Set(['calendar', 'email', 'gmail', 'slack', 'manual', 'gcx', 'fathom', 'carried_over']);

// Tool-name prefixes that only read. Anything else (send, create, delete, update,
// reply, trash...) is never allowed, whatever the connector.
export const READ_VERBS = ['get', 'list', 'search', 'read', 'find', 'fetch', 'query', 'lookup', 'view', 'describe', 'retrieve'];

export function slugify(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function normalizeExtraSources(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const name = typeof s?.name === 'string' ? s.name.trim() : '';
    const slug = slugify(name);
    if (!slug || RESERVED_SLUGS.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const instructions = typeof s.instructions === 'string' && s.instructions.trim()
      ? s.instructions.trim()
      : 'Things assigned to me or waiting on me that are still open.';
    out.push({ name, slug, instructions });
  }
  return out;
}

// Parse `claude mcp list` output: "claude.ai Gmail: https://... - ✔ Connected".
export function parseMcpList(text) {
  const servers = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^(.+?): \S.* - (.+)$/);
    if (!m) continue;
    const tail = m[2].toLowerCase();
    const status = tail.includes('connected') ? 'connected'
      : tail.includes('auth') ? 'needs-auth' : 'failed';
    servers.push({ name: m[1].trim(), status });
  }
  return servers;
}

// "claude.ai Google Calendar" -> "mcp__claude_ai_Google_Calendar"
export function toolPrefix(serverName) {
  return 'mcp__' + serverName.replace(/[^A-Za-z0-9_-]/g, '_');
}

function pickServer(servers, test) {
  const hits = servers.filter(s => test(s.name));
  return hits.find(s => s.status === 'connected') || hits[0] || null;
}

// Match configured sources to the connectors actually present. A source with no
// connected server lands in `missing` and the pull carries on without it.
export function resolveSources({ coreKeys, extraSources, servers }) {
  const active = [];
  const missing = [];
  const place = (entry, server) => {
    if (server?.status === 'connected') active.push({ ...entry, server: server.name });
    else missing.push({ label: entry.label, reason: server ? server.status : 'not-found' });
  };
  for (const key of coreKeys) {
    const core = CORE_SOURCES[key];
    if (!core) continue;
    place({ key, kind: 'core', label: core.label, taskSource: core.taskSource },
      pickServer(servers, n => core.match.test(n)));
  }
  for (const x of extraSources) {
    const want = squash(x.name);
    const first = squash(x.name.split(/[^A-Za-z0-9]+/)[0]);
    place({ key: x.slug, kind: 'extra', label: x.name, taskSource: x.slug, instructions: x.instructions },
      pickServer(servers, n => squash(n).includes(want) || (first.length >= 4 && squash(n).includes(first))));
  }
  return { active, missing };
}

// --allowedTools rules for the pull: read-style tools on the active connectors only.
// Some connectors repeat their own name in tool names (slack_search_public), so each
// verb is allowed bare and behind that prefix.
export function allowRules(active) {
  const rules = [];
  for (const s of active) {
    const prefix = toolPrefix(s.server);
    const own = s.server.replace(/^claude\.ai\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const stems = new Set(['', `${own}_`, `${own.split('_')[0]}_`]);
    for (const stem of stems) for (const v of READ_VERBS) rules.push(`${prefix}__${stem}${v}_*`);
  }
  return rules;
}
