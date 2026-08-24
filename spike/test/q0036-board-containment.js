// Q-0036: what `green` means, and where the code is — the board's containment annotation.
//
// Every case builds its own throwaway repository. No test here asserts the containment state of
// any branch in THIS repository: as of 2026-08-24 every resolvable ticket branch is contained in
// main, so such an assertion would be red only until the next landing and green forever after —
// exactly the failure the permanent-acceptance-test decision (2026-08-23) exists to prevent.
// The helpers mirror initFixture/projectFixture in q0033-surface.js, which is a script rather
// than a module, so they cannot be imported without running its whole suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(spike, 'bin', 'harness.js');
let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n').slice(0, 4).join('\n  ')}`); }
};
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const write = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commitEmpty = (cwd, msg) => git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', msg);
const commitAll = (cwd, msg) => { git(cwd, 'add', '-A'); git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', msg); };
const cli = (cwd, args, env = {}) => spawnSync(process.execPath, [bin, ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 20000,
});
const output = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');

function initFixture({ branch = 'main', commit = true, gitRepo = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0036-'));
  if (gitRepo) {
    git(root, 'init', '-q', '-b', branch);
    if (commit) commitEmpty(root, 'init');
  }
  return { root, result: cli(root, ['init']) };
}
function projectFixture(opts) {
  const f = initFixture(opts);
  assert.equal(f.result.status, 0, output(f.result));
  return f.root;
}
// A ticket is created through the CLI so its frontmatter — including the default
// branch: harness/T-0001/integration — is exactly what the product writes.
function makeTicket(root, title = 'Board fixture') {
  const r = cli(root, ['ticket', 'new', title, '--owner', 'qa']);
  assert.equal(r.status, 0, output(r));
  const dir = fs.readdirSync(path.join(root, 'backlog')).find((x) => x.startsWith('T-0001'));
  return path.join(root, 'backlog', dir);
}
const TICKET_BRANCH = 'harness/T-0001/integration';
const walk = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .map((d) => path.join(d.parentPath ?? d.path, d.name)).sort();

console.log('q0036 board containment');

await scenario('C1', 'a contained branch is annotated, nothing is written, and no legend appears', async () => {
  const root = projectFixture();
  const ticket = makeTicket(root);
  git(root, 'branch', TICKET_BRANCH);
  const ticketBefore = fs.readFileSync(path.join(ticket, 'ticket.md'));
  const refsBefore = git(root, 'for-each-ref');
  const filesBefore = ['backlog', 'harness', '.quorum'].map((d) => walk(path.join(root, d)));
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001[^\n]*main:contained/);
  assert.doesNotMatch(output(r), /indeterminate/);
  // AC-1: derived, never persisted — byte-identical ticket, no new or modified files, no ref moved.
  assert.deepEqual(fs.readFileSync(path.join(ticket, 'ticket.md')), ticketBefore, 'ticket.md must be byte-identical');
  assert.equal(git(root, 'for-each-ref'), refsBefore, 'no ref may move');
  assert.deepEqual(['backlog', 'harness', '.quorum'].map((d) => walk(path.join(root, d))), filesBefore, 'no file may appear or vanish');
});

await scenario('C2', 'a diverged branch counts base..branch, not the symmetric difference', async () => {
  const root = projectFixture();
  makeTicket(root);
  git(root, 'checkout', '-q', '-b', TICKET_BRANCH);
  commitEmpty(root, 'ours 1'); commitEmpty(root, 'ours 2');
  git(root, 'checkout', '-q', 'main');
  commitEmpty(root, 'theirs 1');
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /main:not-contained\(\+2\)/, 'ahead count must be base..branch');
  assert.doesNotMatch(output(r), /\(\+3\)/, 'a symmetric-difference count would read +3');
});

await scenario('C3', 'an unresolvable or absent branch renders as today, as does an empty backlog', async () => {
  const root = projectFixture();
  const ticket = makeTicket(root); // its branch frontmatter names a ref that was never created
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/, 'the row keeps its exact current shape');
  assert.doesNotMatch(output(r), /main:/);
  assert.doesNotMatch(output(r), /indeterminate/, 'an unresolvable branch is unannotated, not indeterminate');
  // No branch key at all — same behaviour.
  write(path.join(ticket, 'ticket.md'), read(ticket, 'ticket.md').replace(/^branch: .*\n/m, ''));
  const r2 = cli(root, ['board']);
  assert.equal(r2.status, 0, output(r2));
  assert.doesNotMatch(output(r2), /main:|indeterminate/);
  // No tickets at all.
  const empty = projectFixture();
  const r3 = cli(empty, ['board']);
  assert.equal(r3.status, 0, output(r3));
  assert.doesNotMatch(output(r3), /fatal:|indeterminate/);
});

await scenario('C4', 'a missing base ref is indeterminate (missing ref) with the legend, never a containment claim', async () => {
  const root = projectFixture();
  makeTicket(root);
  git(root, 'branch', TICKET_BRANCH);
  const configFile = path.join(root, 'harness', 'harness.yaml');
  write(configFile, read(configFile).replace('base_branch: main', 'base_branch: trunk'));
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001[^\n]*trunk:indeterminate\(missing ref\)/);
  assert.doesNotMatch(output(r), /trunk:contained|trunk:not-contained/, 'a missing ref is never a containment claim');
  assert.equal(output(r).split('git could not answer').length - 1, 1, 'exactly one legend line explains indeterminate');
  assert.doesNotMatch(output(r), /fatal:/, 'raw git stderr never reaches the user');
});

await scenario('C5', 'a shallow clone turns a provable-only-with-history negative into indeterminate (shallow clone)', async () => {
  const origin = projectFixture();
  makeTicket(origin);
  commitAll(origin, 'ticket files');
  git(origin, 'branch', TICKET_BRANCH);
  commitEmpty(origin, 'later work on main');
  // In the full history the branch IS contained — the shallow clone must not claim otherwise.
  git(origin, 'merge-base', '--is-ancestor', `refs/heads/${TICKET_BRANCH}`, 'refs/heads/main');
  // --depth is silently ignored for a plain local path; the file:// scheme makes it real.
  const clone = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'q0036-clone-')), 'clone');
  git(os.tmpdir(), 'clone', '-q', '--depth', '1', '--no-single-branch', `file://${origin}`, clone);
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true', 'fixture must be genuinely shallow');
  git(clone, 'branch', TICKET_BRANCH, `origin/${TICKET_BRANCH}`);
  const r = cli(clone, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001[^\n]*main:indeterminate\(shallow clone\)/);
  assert.doesNotMatch(output(r), /\(\+\d+\)/, 'no ahead count may accompany a shallow indeterminate');
  assert.doesNotMatch(output(r), /not-contained/, 'absent history cannot disprove ancestry');
  assert.match(output(r), /git could not answer/);
});

await scenario('C6', 'a project that is not a git repository renders as today and exits 0', async () => {
  const root = projectFixture({ gitRepo: false });
  makeTicket(root);
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001/);
  assert.doesNotMatch(output(r), /main:|indeterminate|fatal:|not a git repository/i);
});

await scenario('C7', 'a master-based project annotates master and says main nowhere', async () => {
  const root = projectFixture({ branch: 'master' });
  makeTicket(root);
  git(root, 'branch', TICKET_BRANCH);
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.match(output(r), /T-0001[^\n]*master:contained/, 'the configured base is printed literally');
  assert.doesNotMatch(output(r), /\bmain\b/, 'the string main must be read from a file, never assumed');
});

await scenario('C8', 'an injection-shaped branch value never reaches a git command line', async () => {
  const root = projectFixture();
  const ticket = makeTicket(root);
  write(path.join(ticket, 'ticket.md'), read(ticket, 'ticket.md').replace(/^branch: .*$/m, 'branch: "--upload-pack=touch pwned"'));
  const r = cli(root, ['board']);
  assert.equal(r.status, 0, output(r));
  assert.doesNotMatch(output(r), /main:contained|main:not-contained/, 'a hostile name renders unannotated or indeterminate');
  assert.equal(fs.existsSync(path.join(root, 'pwned')), false, 'no file named pwned may be created');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'pwned')), false, 'no file named pwned may be created here either');
});

if (failed) { console.error(`\n✗ ${failed} Q-0036 scenario(s) failed`); process.exit(1); }
console.log('✓ q0036 board containment: all scenarios passed');
