// A vendor CLI that exits before reading its prompt must fail its step, not kill the process.
//
// `exec()` writes the whole prompt to the child's stdin. Prompts run to 50-150KB against a 64KB
// pipe buffer, so the write cannot complete in one pass and depends on the child draining it — and
// an expired login, a rejected model alias or a crashed CLI all exit first. Before Q-0063 the
// resulting EPIPE landed on a stream with no 'error' listener, so Node threw `Unhandled 'error'
// event` and killed the run: the vendor's own message was replaced by a node:events stack trace,
// which is precisely the failure `authError()` exists to prevent. It presented as a flaky CI test
// (`q0011-run-history.js`, EDGE-21) because on an unloaded machine the write wins the race.
//
// Authorised to be fixed in the spike by backlog/Q-0009-…/requirements/errata.md E-2; Q-0047 ports
// the fixed version. See Q-0063.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from '../src/adapters/claude.js';

let n = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); n += 1; console.log(`  ✓ ${name}`); }
  catch (e) { failed += 1; console.error(`  ✗ ${name}\n    ${e.message}`); }
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q0063-'));
const script = (body) => {
  const p = path.join(dir, `bin-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(p, `#!/bin/sh\n${body}\n`); fs.chmodSync(p, 0o755); return p;
};

// Comfortably past a 64KB pipe buffer, so the write provably cannot complete in one pass.
const HUGE = 'x'.repeat(512 * 1024);

await check('a CLI that exits 0 without reading stdin does not crash the process', async () => {
  const bin = script("printf 'done'\nexit 0");
  const r = await exec(bin, [], { cwd: dir, stdin: HUGE });
  assert.equal(r.code, 0, 'the child exit code is the authority');
  assert.equal(r.stdout, 'done');
});

await check('a CLI that exits non-zero without reading stdin reports its own exit code', async () => {
  const bin = script("printf 'vendor said no' >&2\nexit 7");
  const r = await exec(bin, [], { cwd: dir, stdin: HUGE });
  assert.equal(r.code, 7, 'the vendor exit code must survive, not be replaced by an EPIPE');
  assert.match(r.stderr, /vendor said no/, "the vendor's own message must reach the caller");
});

await check('the truncated prompt is recorded rather than swallowed', async () => {
  const bin = script('exit 3');
  const r = await exec(bin, [], { cwd: dir, stdin: HUGE });
  assert.equal(r.code, 3);
  assert.match(r.stderr, /closed its input before the prompt was fully written/,
    'a prompt that was never delivered is a fact the run needs — never default silently');
});

await check('a CLI that does read its prompt is unaffected', async () => {
  const bin = script('wc -c');
  const r = await exec(bin, [], { cwd: dir, stdin: HUGE });
  assert.equal(r.code, 0);
  assert.equal(Number(r.stdout.trim()), HUGE.length, 'the whole prompt must still arrive');
  assert.doesNotMatch(r.stderr, /closed its input/, 'no truncation note when nothing was truncated');
});

await check('a missing binary still resolves with code -1 rather than throwing', async () => {
  const r = await exec(path.join(dir, 'does-not-exist'), [], { cwd: dir, stdin: 'small' });
  assert.equal(r.code, -1, "exec() resolves on spawn failure; that behaviour is preserved");
  assert.match(r.stderr, /ENOENT/);
});

fs.rmSync(dir, { recursive: true, force: true });
if (failed) { console.error(`\n✗ ${failed} Q-0063 scenario(s) failed`); process.exit(1); }
