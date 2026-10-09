import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshHealth } from '../src/health.js';

test('no refresh yet, or a clean one, shows nothing', () => {
  assert.equal(refreshHealth(null).level, 'ok');
  const h = refreshHealth({ errors: [], pull: { missing: [] }, finished_at: 't' });
  assert.deepEqual(h, { level: 'ok', messages: [], at: 't' });
});

test('a skipped source is a warning in plain words', () => {
  const h = refreshHealth({ errors: [], pull: { missing: ['Slack is in Claude but not connected yet'] } });
  assert.equal(h.level, 'warn');
  assert.match(h.messages[0].text, /^Slack is in Claude but not connected yet\. Until then/);
});

test('user-facing errors pass through; raw ones are replaced and kept as detail', () => {
  const h = refreshHealth({
    errors: ['Claude is signed out on this computer, so your list could not update.', 'Claude pull: claude exited 1: ENOENT'],
    pull: { missing: ['Slack could not be reached'] },
  });
  assert.equal(h.level, 'error');
  assert.equal(h.messages[0].text, 'Claude is signed out on this computer, so your list could not update.');
  assert.match(h.messages[1].text, /could not update on the last try/);
  assert.equal(h.messages[1].detail, 'Claude pull: claude exited 1: ENOENT');
  assert.equal(h.messages.length, 3);
});
