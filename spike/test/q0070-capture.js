// runCommand loses no output, and an overflow is not reported as a timeout.
//
// The child used to write through a pipe, which imposed two ceilings rather than one. Node's 1 MiB
// maxBuffer killed a progressive writer mid-run with the configured SIGKILL, and `timedOut` tests
// that signal — so an overflow reported a fifteen-minute timeout about a command that finished in
// twenty-six seconds. Worse, and not a maxBuffer overflow at all: process.exit() does not flush a
// pipe, so a monolithic writer discarded its own unwritten bytes and one pipe buffer was all that
// ever arrived. A child that did that and exited zero returned code 0 with 65,536 of 2,097,152
// bytes, integrate wrote tests=ok, and `expect: pass` was satisfied by a suite whose output had
// been thrown away. Raising maxBuffer could never have reached that cell.
//
// The matrix below is the whole point: three separate records each named a different single
// discriminator — the write shape, the exit status, the exit route — and all three were wrong. Only
// the conjunction reaches the false green, which is why every cell is asserted rather than a
// representative one.
//
// This is the spike half of a change that lands in both trees together, so the port keeps the
// independent witness the freeze exists to provide. Q-0070 is not one of Q-0009's fourteen
// children, so the freeze does not apply — port-freeze-guard.sh exits 0 saying so. See Q-0070 and
// docs/decisions/058-a-commands-output-is-captured-whole.md.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from '../src/fanout.js';

let n = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); n += 1; console.log(`  ✓ ${name}`); }
  catch (e) { failed += 1; console.error(`  ✗ ${name}\n    ${e.message}`); }
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q0070-'));

const TWO_MIB = 2 * 1024 * 1024;
const UNDER_OLD_CEILING = 900 * 1024;

// A child that writes `bytes` and then leaves, in each of the ways proposed as the discriminator.
const producer = (bytes, shape, leaves, status) => {
  const chunk = 1024;
  const write = shape === 'monolithic'
    ? `const s='x'.repeat(${bytes});process.stdout.write(s);`
    : `for(let i=0;i<${bytes / chunk};i++)process.stdout.write('x'.repeat(${chunk}));`;
  const leave = leaves === 'by exit()' ? `process.exit(${status});` : `process.exitCode=${status};`;
  return `node -e ${JSON.stringify(write + leave)}`;
};

for (const shape of ['monolithic', 'progressive']) {
  for (const leaves of ['naturally', 'by exit()']) {
    for (const status of [0, 3]) {
      const cell = `${shape}, leaves ${leaves}, status ${status}`;
      const known = shape === 'monolithic' && leaves === 'by exit()' && status === 0 ? ' [THE FALSE GREEN]' : '';
      check(`2 MiB arrives whole and the status survives — ${cell}${known}`, () => {
        const r = runCommand(producer(TWO_MIB, shape, leaves, status), dir);
        assert.equal(r.out.length, TWO_MIB, `${cell}: got ${r.out.length} of ${TWO_MIB} bytes`);
        assert.equal(r.code, status, `${cell}: the child's own status, not a kill's`);
        assert.equal(r.timedOut, false, `${cell}: nothing here timed out`);
      });
    }
  }
}

check('a 900 KiB child still returns code 0 and every byte — the under-ceiling regression', () => {
  const r = runCommand(producer(UNDER_OLD_CEILING, 'progressive', 'naturally', 0), dir);
  assert.equal(r.out.length, UNDER_OLD_CEILING);
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
});

check('stderr is discarded on the success path', () => {
  const r = runCommand('printf OUT; printf ERR >&2', dir);
  assert.deepEqual(r, { code: 0, out: 'OUT', timedOut: false });
});

check('the failure path is whole stdout then whole stderr, never interleaved', () => {
  // Interleaved by arrival this reads OUTERROUT2. Two capture files is what makes it OUTOUT2ERR,
  // and a single shared file is what this assertion exists to refuse.
  const r = runCommand('printf OUT; printf ERR >&2; printf OUT2; exit 1', dir);
  assert.equal(r.out, 'OUTOUT2ERR');
  assert.equal(r.code, 1);
});

check('a timeout is still a timeout, and it keeps what the child produced', () => {
  const started = Date.now();
  const r = runCommand(`node -e ${JSON.stringify("process.stdout.write('EARLY');setTimeout(()=>{},60000);")}`, dir, { timeoutMs: 750 });
  assert.equal(r.timedOut, true);
  assert.equal(r.out, 'EARLY', 'a timeout must not also lose the evidence');
  assert.ok(Date.now() - started < 10_000, 'the timeout must fire well inside the 60s the child asked for');
});

check('stdin is still ignored, so a command that reads it finishes instead of waiting', () => {
  const r = runCommand('cat', dir, { timeoutMs: 10_000 });
  assert.equal(r.timedOut, false, 'a prompting command must fail fast, not hang');
  assert.equal(r.code, 0);
});

check('a capture that cannot be created throws, and reports no verdict', () => {
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = path.join(dir, 'no', 'such', 'place');
  try {
    assert.throws(() => runCommand('printf hello', dir), /could not create the directory it captures output into/);
    // The throw names the capture, so it can never be read as something the command did — and it
    // never reaches the engine's tests= line, which is what keeps it out of expect: pass/fail.
    assert.throws(() => runCommand('exit 1', dir), /no result is reported for it/);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
  }
});

fs.rmSync(dir, { recursive: true, force: true });
if (failed) { console.error(`\n✗ ${failed} Q-0070 scenario(s) failed`); process.exit(1); }
