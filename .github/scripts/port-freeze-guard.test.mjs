// Exercises port-freeze-guard.sh against a throwaway repository in a temp directory.
//
//   node .github/scripts/port-freeze-guard.test.mjs
//
// Q-0009's AC-6 asks for four directions on scratch branches — a child touching spike/src fails,
// another ticket's branch does not fire, a child carrying the exemption marker passes and says
// which exemption it honoured, and the freeze-SHA half reports itself skipped rather than passing.
// Doing that by hand means creating branches in the real repository, which leaves refs behind;
// this builds its own repository instead and deletes it. Deliberately not wired into CI: it needs
// git and a writable temp directory, and the guard it tests already runs on every push.
//
// Plain node, no test runner — `packages/*` owns Vitest and this is repository CI machinery, not
// workspace code.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const GUARD = path.join(ROOT, '.github', 'scripts', 'port-freeze-guard.sh');
const CHARTER = path.join(ROOT, 'harness', 'port-charter.md');

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'port-freeze-'));
const R = path.join(SCRATCH, 'repo');

const git = (args, cwd = R) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (rel, s) => fs.writeFileSync(path.join(R, rel), s);

for (const d of ['harness', '.github/scripts', 'spike/src']) fs.mkdirSync(path.join(R, d), { recursive: true });
git(['init', '-q', '-b', 'main', '.']);
git(['config', 'user.email', 'guard-test@quorum.invalid']);
git(['config', 'user.name', 'guard test']);
fs.copyFileSync(CHARTER, path.join(R, 'harness/port-charter.md'));
fs.copyFileSync(GUARD, path.join(R, '.github/scripts/port-freeze-guard.sh'));
write('spike/src/engine.js', 'original\n');
write('README.md', 'x\n');
git(['add', '-A']);
git(['commit', '-qm', 'base']);
const FREEZE = git(['rev-parse', 'HEAD']);

let pass = 0, failed = 0, last = '';
function expect(name, want, env, cwd = R) {
  const r = spawnSync('bash', ['.github/scripts/port-freeze-guard.sh'], {
    cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
  last = (r.stdout ?? '') + (r.stderr ?? '');
  if (r.status === want) { console.log(`ok   ${name.padEnd(58)} exit ${r.status}`); pass++; }
  else { console.log(`FAIL ${name.padEnd(58)} exit ${r.status}, wanted ${want}\n${last}`); failed++; }
}
function says(s) {
  if (last.includes(s)) { console.log(`       ↳ ${s}`); pass++; }
  else { console.log(`       ↳ FAIL: output did not contain: ${s}\n${last}`); failed++; }
}
function record(sha) {
  const f = path.join(R, 'harness/port-charter.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^freeze-sha: .*$/m, `freeze-sha: ${sha}`));
}
function touchSpikeOn(branch, message) {
  git(['checkout', '-q', 'main']);
  git(['checkout', '-q', '-b', branch]);
  write('spike/src/engine.js', `edited on ${branch}\n`);
  git(['add', '-A']);
  git(['commit', '-qm', message]);
}
const scope = (branch) => ({ HALF: 'branch-scope', BRANCH: branch, BASE: 'main' });

console.log('== policy ==');
// Set the state this section is about, rather than inheriting whatever the repository's charter
// currently holds. Seeded from the real file, these three checks passed only while the SHA was
// unrecorded and went red the day it was — a verdict that was a property of the checkout and not
// of the behaviour, which is the class decision 069 (2026-08-30) forbids.
record('not-yet-recorded');
expect('policy parses the charter', 0, { HALF: 'policy' });
says('SKIPPED, not passed');
const OUT = path.join(SCRATCH, 'gh-output.txt');
fs.writeFileSync(OUT, '');
expect('policy emits freeze_sha for the job condition', 0, { HALF: 'policy', GITHUB_OUTPUT: OUT });
if (fs.readFileSync(OUT, 'utf8').includes('freeze_sha=not-yet-recorded')) {
  console.log('       ↳ freeze_sha=not-yet-recorded, so the workflow skips the freeze-SHA job'); pass++;
} else { console.log(`       ↳ FAIL: GITHUB_OUTPUT held ${JSON.stringify(fs.readFileSync(OUT, 'utf8'))}`); failed++; }

console.log('\n== branch-scope: AC-6’s four directions ==');
git(['checkout', '-q', '-b', 'harness/Q-0041/implement']);
write('README.md', 'ported\n');
git(['add', '-A']);
git(['commit', '-qm', 'a port that leaves the spike alone']);
expect('a child that leaves spike/src alone -> clear', 0, scope('harness/Q-0041/implement'));
says('branch-scope CLEAR');

expect('a branch that is not harness/<ticket>/… -> out of scope', 0, scope('some-random-branch'));
says('the freeze does not apply');

touchSpikeOn('harness/Q-0038/implement', 'Q-0038 legitimately edits spike/src');
expect('another ticket touching spike/src -> does not fire', 0, scope('harness/Q-0038/implement'));
says("not one of Q-0009's fourteen children");

touchSpikeOn('harness/Q-0041/violate', 'the port edits spike/src');
expect('a child touching spike/src with no exemption -> FAILS', 1, scope('harness/Q-0041/violate'));
says('the port freeze forbids it changing spike/src');

console.log('\n== the exemption must be complete, not merely present ==');
touchSpikeOn('harness/Q-0041/bare', 'touch spike\n\nPort-freeze-exemption:\n');
expect('bare trailer, no ticket and no reason -> FAILS', 1, scope('harness/Q-0041/bare'));
says('malformed or names another ticket');

touchSpikeOn('harness/Q-0041/noreason', 'touch spike\n\nPort-freeze-exemption: Q-0041\n');
expect('trailer naming the ticket but no reason -> FAILS', 1, scope('harness/Q-0041/noreason'));
says('malformed or names another ticket');

touchSpikeOn('harness/Q-0041/wrongticket', 'touch spike\n\nPort-freeze-exemption: Q-0042 authorised elsewhere\n');
expect('trailer naming a different ticket -> FAILS', 1, scope('harness/Q-0041/wrongticket'));
says('malformed or names another ticket');

touchSpikeOn('harness/Q-0041/prose', 'touch spike\n\nI considered a Port-freeze-exemption: Q-0041 but did not add one\n');
expect('the trailer mentioned in prose, not at column 0 -> FAILS', 1, scope('harness/Q-0041/prose'));
says('the port freeze forbids it changing spike/src');

touchSpikeOn('harness/Q-0041/exempt', 'touch spike\n\nPort-freeze-exemption: Q-0041 the ported module needs a shared constant\n');
expect('a complete trailer -> EXEMPT', 0, scope('harness/Q-0041/exempt'));
says('branch-scope EXEMPT');
says('the ported module needs a shared constant');

console.log('\n== the freeze-SHA half ==');
git(['checkout', '-q', 'main']);
record('not-yet-recorded');
expect('no SHA recorded -> refuses; it never exits 0', 1, { HALF: 'freeze-sha', BASE: 'main' });
says('SKIPPED, not passed');

record(FREEZE);
expect('SHA recorded, base unchanged under spike/src -> clear', 0, { HALF: 'freeze-sha', BASE: 'main' });
says('freeze-SHA CLEAR');

write('spike/src/engine.js', 'a fix that landed after the freeze\n');
git(['add', '-A']);
git(['commit', '-qm', 'a fix lands in the spike after the freeze']);
record(FREEZE);
expect('SHA recorded, base HAS moved under spike/src -> FAILS', 1, { HALF: 'freeze-sha', BASE: 'main' });
says('has acquired changes under spike/src since the freeze');

record('0000000000000000000000000000000000000000');
expect('recorded SHA is not a commit here -> FAILS', 1, { HALF: 'freeze-sha', BASE: 'main' });
says('is not a commit in this repository');

// `record` leaves the charter modified in the working tree, and the checkout below moves to a
// commit where that file differs — git would refuse rather than clobber it. Restore first.
git(['checkout', '--', 'harness/port-charter.md']);
git(['checkout', '-q', '-b', 'sidetrack', FREEZE]);
write('README.md', 'unrelated\n');
git(['add', '-A']);
git(['commit', '-qm', 'off to one side']);
const SIDE = git(['rev-parse', 'HEAD']);
git(['checkout', '-q', 'main']);
record(SIDE);
expect('recorded SHA is not an ancestor of the base -> FAILS', 1, { HALF: 'freeze-sha', BASE: 'main' });
says('is not an ancestor of');

console.log('\n== fails closed ==');
record('not-yet-recorded');
expect('unknown HALF -> FAILS', 1, { HALF: 'nonsense' });
says('unknown HALF');

expect('missing charter -> FAILS', 1, { HALF: 'policy', CHARTER: 'harness/nope.md' });
says('refuses to pass on a policy it cannot find');

const wildcard = path.join(SCRATCH, 'charter-wildcard.md');
fs.writeFileSync(wildcard, fs.readFileSync(CHARTER, 'utf8').replace(/^exemption-trailer: .*$/m, 'exemption-trailer: .*'));
expect('a charter whose trailer is a wildcard -> FAILS', 1, { HALF: 'policy', CHARTER: wildcard });
says('is not a plain token');

const noblock = path.join(SCRATCH, 'charter-noblock.md');
fs.writeFileSync(noblock, fs.readFileSync(CHARTER, 'utf8').replace(/^children: .*$/m, ''));
expect('a charter with no readable block -> FAILS', 1, { HALF: 'policy', CHARTER: noblock });
says('cannot parse');

console.log('\n== a repository the guard cannot read ==');
const shallow = path.join(SCRATCH, 'shallow');
try {
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${R}`, shallow], { encoding: 'utf8' });
  expect('shallow clone -> fails closed rather than reporting clear', 1, scope('harness/Q-0041/x'), shallow);
  says('shallow clone');
} catch (e) {
  console.log(`skip shallow clone: ${e.message.split('\n')[0]}`);
}

fs.rmSync(SCRATCH, { recursive: true, force: true });
console.log(`\n${pass} checks passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
