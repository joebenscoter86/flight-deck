import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, normalizeExtraSources, parseMcpList, toolPrefix, resolveSources, allowRules,
} from '../src/sources.js';

const MCP_LIST = `Checking MCP server health…

claude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ✔ Connected
claude.ai Google Calendar: https://calendarmcp.googleapis.com/mcp/v1 - ✔ Connected
claude.ai Slack: https://mcp.slack.com/mcp - ! Needs authentication
claude.ai monday.com: https://mcp.monday.com/mcp - ✔ Connected
playwright: npx @playwright/mcp@latest - ✗ Failed to connect
`;

test('slugs are lower case with dashes', () => {
  assert.equal(slugify('Monday.com'), 'monday-com');
  assert.equal(slugify('  Asana  '), 'asana');
});

test('malformed, duplicate and reserved extra sources are dropped', () => {
  const out = normalizeExtraSources([
    { name: 'Monday.com', instructions: 'Overdue items' },
    { name: 'monday com' },
    { name: 'Slack' },
    { instructions: 'no name' },
    'nonsense',
    { name: 'Asana' },
  ]);
  assert.deepEqual(out.map(s => s.slug), ['monday-com', 'asana']);
  assert.equal(out[0].instructions, 'Overdue items');
  assert.match(out[1].instructions, /assigned to me/);
  assert.deepEqual(normalizeExtraSources(undefined), []);
});

test('mcp list output parses into names and statuses', () => {
  const servers = parseMcpList(MCP_LIST);
  assert.equal(servers.length, 5);
  assert.deepEqual(servers[2], { name: 'claude.ai Slack', status: 'needs-auth' });
  assert.equal(servers[4].status, 'failed');
});

test('sources resolve to connected connectors; the rest are reported missing', () => {
  const { active, missing } = resolveSources({
    coreKeys: ['calendar', 'gmail', 'slack'],
    extraSources: normalizeExtraSources([{ name: 'Monday.com' }, { name: 'Asana' }]),
    servers: parseMcpList(MCP_LIST),
  });
  assert.deepEqual(active.map(s => [s.key, s.taskSource, s.server]), [
    ['calendar', 'calendar', 'claude.ai Google Calendar'],
    ['gmail', 'email', 'claude.ai Gmail'],
    ['monday-com', 'monday-com', 'claude.ai monday.com'],
  ]);
  assert.deepEqual(missing, [
    { label: 'Slack', reason: 'needs-auth' },
    { label: 'Asana', reason: 'not-found' },
  ]);
});

test('allow rules cover read verbs on active connectors and nothing else', () => {
  assert.equal(toolPrefix('claude.ai Google Calendar'), 'mcp__claude_ai_Google_Calendar');
  const rules = allowRules([{ server: 'claude.ai Gmail' }, { server: 'claude.ai Slack' }]);
  assert.ok(rules.includes('mcp__claude_ai_Gmail__search_*'));
  assert.ok(rules.includes('mcp__claude_ai_Gmail__get_*'));
  assert.ok(rules.includes('mcp__claude_ai_Slack__slack_read_*'));
  assert.ok(rules.every(r => r.startsWith('mcp__claude_ai_Gmail__') || r.startsWith('mcp__claude_ai_Slack__')));
  const writes = ['send', 'reply', 'forward', 'trash', 'delete', 'create', 'update', 'label', 'mark'];
  for (const w of writes) assert.ok(!rules.some(r => r.includes(`__${w}`) || r.includes(`_${w}_`)), w);
  assert.ok(rules.every(r => !/__\*|^\*/.test(r)), 'no rule allows a whole connector');
});
