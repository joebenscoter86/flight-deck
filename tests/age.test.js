import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitingDays } from '../src/age.js';

test('waiting days counts from original_date, then created_at, then list_date', () => {
  assert.equal(waitingDays({ original_date: '2026-10-01', created_at: '2026-10-05 10:00:00', list_date: '2026-10-08' }, '2026-10-08'), 7);
  assert.equal(waitingDays({ original_date: null, created_at: '2026-10-05 10:00:00', list_date: '2026-10-08' }, '2026-10-08'), 3);
  assert.equal(waitingDays({ original_date: null, created_at: null, list_date: '2026-10-08' }, '2026-10-08'), 0);
});
