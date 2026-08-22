// Test entry point. Runs smoke.js first (the mock-adapter end-to-end regression suite), then
// every other test/*.js in name order.
//
// Discovery is the point: qa-red proves a red phase by writing NEW test files and asserting the
// suite fails. A runner hard-coded to one file would execute none of them, the suite would stay
// green, and `integrate --expect fail` would loop until it hit a gate having proved nothing.
// See Q-0011 / M1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const self = path.basename(fileURLToPath(import.meta.url));

const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.js') && f !== self)
  .sort((a, b) => (a === 'smoke.js' ? -1 : b === 'smoke.js' ? 1 : a.localeCompare(b)));

if (!files.length) {
  console.error('✗ no test files found in ' + dir);
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  if (files.length > 1) console.log(`\n──── ${f} ────`);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  // A test file that crashes or is killed by a signal is a failure, not a pass.
  if (r.status !== 0) { failed += 1; console.error(`✗ ${f} exited ${r.status ?? r.signal}`); }
}

if (failed) {
  console.error(`\n✗ ${failed} of ${files.length} test file(s) failed`);
  process.exit(1);
}
console.log(files.length > 1 ? `\n✓ all ${files.length} test files passed` : '');
