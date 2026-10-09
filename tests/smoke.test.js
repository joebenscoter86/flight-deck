import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTestEnv } from './helpers/config.js';
const stateDir = withTestEnv();
const { config } = await import('../src/config.js');

test('config loads the fixture and uses the temp state dir', () => {
  assert.equal(config.productName, 'Flight Deck');
  assert.equal(config.stateDir, stateDir);
  assert.equal(config.userSlackId, 'U0TEST');
});
