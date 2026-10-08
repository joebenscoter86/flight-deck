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
