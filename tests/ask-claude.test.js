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

test('spaces are percent-encoded, never written as +', () => {
  const uri = buildLaunchUri('a b + c', '/Users/me/my folder');
  assert.ok(!uri.includes('a+b'));
  assert.ok(uri.includes('q=a%20b%20%2B%20c'));
  assert.ok(uri.includes('folder=%2FUsers%2Fme%2Fmy%20folder'));
});
