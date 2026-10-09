import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must run before any import of src/config.js (which reads env at module load).
export function withTestEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-deck-test-'));
  process.env.FLIGHT_DECK_STATE_DIR = dir;
  process.env.FLIGHT_DECK_CONFIG = path.join(
    path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'config.test.json');
  return dir;
}
