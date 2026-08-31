// Q-0062 — a run gives back the worktrees it obtained, and only those, and never a ref.
//
// Every fixture builds its own repository under os.tmpdir() and asks git itself what happened, so
// no verdict here depends on this checkout's branches, its ignored directories, its git identity or
// the machine's git configuration ("A test's verdict is a property of the commit, not of the
// checkout or the account", docs/DECISIONS.md 2026-08-30).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { loadFlow, runFlow } from '../src/engine.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.stack ?? e.message}`); }
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };

const IMPLEMENT = 'harness/T-0001/implement';
const INTEGRATION = 'harness/T-0001/integration';
const worktreeOf = (root, branch) => path.join(root, '.harness', 'worktrees', branch.replace(/\//g, '__'));

// One worktree step and one integrate, which is the shape every code-writing flow has and the one
// that obtains both kinds of worktree in a single run.
const CODING_FLOW = `name: coding
consumes: green
produces: reviewed
steps:
  - id: implement
    role: principal-architect
    adapter: mock
    worktree: true
    branch: "${IMPLEMENT}"
    base: "${INTEGRATION}"
    input: { repo: true }
    output: { writes: [dev/implement.md] }
  - id: merge
    type: integrate
    branches: ["${IMPLEMENT}"]
    into: "${INTEGRATION}"
    input: { backlog: [dev/implement.md] }
    output: { writes: [dev/integration.md] }
`;

function fixture({ flow = CODING_FLOW, commands = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0062-worktrees-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  const backlog = new Backlog(path.join(root, 'backlog'));
  write(path.join(harnessDir, 'roles', 'principal-architect.md'), '---\nadapter: mock\n---\nArchitect.\n');
  const flowFile = path.join(harnessDir, 'flows', 'coding.yaml');
  write(flowFile, flow);
  const ticket = backlog.create({ title: 'Worktree lifecycle', intent: 'Exercise Q-0062.' });
  ticket.meta.stage = 'green'; backlog.write(ticket);
  const messages = [];
  const ui = {
    info: (m) => messages.push(`info ${m}`), warn: (m) => messages.push(`warn ${m}`),
    step: (a, b) => messages.push(`step ${a} ${b}`), done: (a, b) => messages.push(`done ${a} ${b}`), trace() {},
    gate: async () => 'advance',
  };
  const config = { adapterOverride: 'mock', adapters: {}, repo: { base_branch: 'main' }, ...(commands ? { commands } : {}) };
  const run = (extra = {}) => runFlow({
    flow: loadFlow(flowFile), ticket, backlog, harnessDir, repoDir: root, config, ui, auto: true, ...extra,
  });
  return { root, harnessDir, backlog, ticket, ui, messages, config, run, flowFile };
}

// runs.log with Backlog.log's ISO timestamp taken off; the timestamp belongs to no assertion here.
const logLines = (f) => fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8')
  .split('\n').filter(Boolean).map((l) => l.replace(/^\S+ /, ''));

await scenario('AC-1', 'a finished run gives both worktrees back, says so once each, and logs the count', async () => {
  const f = fixture();
  const out = await f.run();
  assert.equal(out.status, 'completed');

  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), false, `${branch}: directory still on disk`);
    assert.equal(git(f.root, 'worktree', 'list').includes(branch.replace(/\//g, '__')), false, `${branch}: still registered`);
    assert.equal(f.messages.filter((m) => m === `info ${branch}: worktree removed — ${worktreeOf(f.root, branch)}`).length, 1);
  }
  assert.ok(logLines(f).includes('run=1 removed-worktrees=2 kept=0'), 'the cleanup line is missing from runs.log');
  // Before the terminal line, and the terminal line is still the last one.
  const lines = logLines(f);
  assert.ok(lines.indexOf('run=1 removed-worktrees=2 kept=0') < lines.findIndex((l) => l.startsWith('run=1 completed')));
  assert.match(lines.at(-1), /^run=1 completed /);
});

await scenario('AC-1', 'the cleanup line carries this run\'s number, and one carrying another moves the next id', async () => {
  // nextRunId reads `run=<n>` on EVERY line of runs.log, not only the start line
  // (requirements/errata.md E-1), so the number on the cleanup line is a constraint rather than a
  // free choice. Asserting only that the next run is 2 would pass under either reading; the second
  // half is what discriminates.
  const f = fixture();
  await f.run();
  assert.equal(logLines(f).filter((l) => l.startsWith('run=1 removed-worktrees=')).length, 1);

  f.ticket.meta.stage = 'green'; f.backlog.write(f.ticket);
  const second = await f.run();
  assert.equal(second.runId, 2, 'the cleanup line must not have moved the id');

  fs.appendFileSync(path.join(f.ticket.dir, 'runs.log'), 'run=9 removed-worktrees=0 kept=0\n');
  f.ticket.meta.stage = 'green'; f.backlog.write(f.ticket);
  const third = await f.run();
  assert.equal(third.runId, 10, 'every run= in the log is read, so a foreign number moves the next id');
});

await scenario('AC-2', 'a run that did not finish leaves the worktree, its registration and its branch', async () => {
  // The stopper is the LAST step, so both worktrees exist by the time the run gives up on itself.
  const f = fixture({ flow: `${CODING_FLOW}  - id: stop\n    type: script\n    run: exit 7\n` });
  const out = await f.run().catch((e) => e);
  assert.equal(out.status ?? 'threw', 'aborted');

  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), true, `${branch}: the worktree must survive a run that stopped`);
    assert.ok(git(f.root, 'worktree', 'list').includes(branch.replace(/\//g, '__')));
  }
  assert.match(git(f.root, 'show', `${IMPLEMENT}:contracts/ProrationService.ts`), /ProrationService/);
  assert.equal(f.messages.some((m) => m.includes('worktree removed')), false);
  assert.equal(logLines(f).some((l) => l.includes('removed-worktrees=')), false);
});

await scenario('AC-3', 'a bystander survives, a reused worktree does not, and one branch is one entry', async () => {
  const f = fixture();
  git(f.root, 'branch', 'someone/elses-work', 'main');
  const bystander = worktreeOf(f.root, 'someone/elses-work');
  git(f.root, 'worktree', 'add', '-q', bystander, 'someone/elses-work');
  git(f.root, 'branch', IMPLEMENT, 'main');
  const reused = worktreeOf(f.root, IMPLEMENT);
  git(f.root, 'worktree', 'add', '-q', reused, IMPLEMENT);

  await f.run();

  assert.equal(fs.existsSync(reused), false, 'a run that reused a worktree is the run that finished with it');
  assert.equal(fs.existsSync(bystander), true, 'a worktree this run never touched is nobody\'s to remove');
  assert.ok(git(f.root, 'worktree', 'list').includes('someone__elses-work'));
  assert.equal(git(f.root, 'rev-parse', '--verify', 'someone/elses-work').length, 40);
  // integrate asks for the ticket worktree by the same branch every time, so it is one entry.
  assert.equal(f.messages.filter((m) => m.startsWith(`info ${INTEGRATION}: worktree removed`)).length, 1);
  assert.ok(logLines(f).includes('run=1 removed-worktrees=2 kept=0'));
});

await scenario('AC-4', 'no ref is deleted: both branches still resolve, and both still carry the work', async () => {
  const f = fixture();
  await f.run();

  const branches = git(f.root, 'branch', '--list', 'harness/*');
  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.ok(branches.includes(branch), `${branch} must outlive its worktree`);
    assert.equal(git(f.root, 'rev-parse', '--verify', branch).length, 40);
  }
  assert.match(git(f.root, 'show', `${IMPLEMENT}:contracts/ProrationService.ts`), /ProrationService/);
  assert.match(git(f.root, 'show', `${INTEGRATION}:contracts/ProrationService.ts`), /ProrationService/);
});

await scenario('AC-4', 'no source file asks for a ref to be deleted, and the scan fires over one that does', () => {
  // The property cannot be observed by running a flow that never deletes a ref, which is every
  // flow. What stops the next change trying is this.
  const refDeletions = (text) => [
    ['deleteBranch', /deleteBranch/],
    ['branch -d', /'branch',\s*'-d'/],
    ['branch -D', /'-D'/],
    ['branch --delete', /'--delete'/],
    ['update-ref -d', /update-ref/],
    ['push --delete', /'push'/],
  ].filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

  const srcDir = path.join(spike, 'src');
  const sources = fs.readdirSync(srcDir, { recursive: true })
    .filter((rel) => rel.endsWith('.js'))
    .map((rel) => [rel, fs.readFileSync(path.join(srcDir, rel), 'utf8')]);
  assert.ok(sources.length >= 6, 'the scan needs a corpus, or it reports success over nothing');

  // git.js declares the option and is the one file allowed to spell it; nothing else may.
  const offenders = sources.filter(([rel]) => rel !== 'git.js')
    .flatMap(([rel, text]) => refDeletions(text).map((label) => `${rel}: ${label}`));
  assert.deepEqual(offenders, [], `a source file asks for a ref deletion: ${offenders.join(', ')}`);
  assert.deepEqual(refDeletions(fs.readFileSync(path.join(srcDir, 'git.js'), 'utf8')), ['deleteBranch', 'branch -D'],
    'the positive control: without it this scan would pass over patterns that match nothing');

  // And it fires over the call site edited to ask for one, which is the mutation a reviewer wants
  // to see rather than be told about.
  const engine = fs.readFileSync(path.join(srcDir, 'engine.js'), 'utf8');
  assert.ok(engine.includes('removeWorktree(ctx.repoDir, branch)'), 'the call site the mutation rewrites has moved');
  const mutated = engine.replace('removeWorktree(ctx.repoDir, branch)', 'removeWorktree(ctx.repoDir, branch, { deleteBranch: true })');
  assert.notEqual(mutated, engine);
  assert.deepEqual(refDeletions(mutated), ['deleteBranch']);
  for (const [verb, snippet] of [
    ['branch -d', "git(['branch', '-d', b], repo)"],
    ['branch -D', "git(['branch', '-D', b], repo)"],
    ['branch --delete', "git(['branch', '--delete', b], repo)"],
    ['update-ref -d', "git(['update-ref', '-d', ref], repo)"],
    ['push --delete', "git(['push', 'origin', ':' + b], repo)"],
  ]) assert.ok(refDeletions(snippet).includes(verb), `${verb} must be seen`);
});

await scenario('AC-5', 'a worktree holding uncommitted content is kept, and the warning names the paths', async () => {
  // The real shape rather than a contrived one: commands.install runs inside the integration
  // worktree, and anything it writes there that git can see is content --force would discard.
  const f = fixture({ commands: { install: 'printf dirt > left-behind.txt', test: 'printf ok' } });
  write(f.flowFile, CODING_FLOW.replace('    into:', '    run_tests: true\n    into:'));
  const out = await f.run();
  assert.equal(out.status, 'completed');

  const kept = worktreeOf(f.root, INTEGRATION);
  assert.equal(fs.existsSync(path.join(kept, 'left-behind.txt')), true, 'the fixture must actually dirty the worktree');
  assert.equal(fs.existsSync(kept), true, 'a dirty worktree is kept');
  assert.ok(git(f.root, 'worktree', 'list').includes(INTEGRATION.replace(/\//g, '__')));
  assert.ok(f.messages.includes(`warn ${INTEGRATION}: worktree kept — ${kept} holds uncommitted content: left-behind.txt`),
    `the warning must name the paths — got ${JSON.stringify(f.messages.filter((m) => m.startsWith('warn')))}`);
  // The clean one in the same run is gone, so this is a decision about the worktree rather than a
  // run that stopped removing.
  assert.equal(fs.existsSync(worktreeOf(f.root, IMPLEMENT)), false);
  assert.ok(logLines(f).includes('run=1 removed-worktrees=1 kept=1'));
});

await scenario('AC-6', 'a removal that fails keeps that worktree, removes the next, and changes no outcome', async () => {
  // A real failure rather than a stub: a locked worktree is one `git worktree remove --force`
  // refuses, and `git status` inside it still answers, so exactly the removal fails.
  const control = fixture();
  await control.run();

  const f = fixture({
    flow: CODING_FLOW.replace(
      '  - id: merge',
      `  - id: lock\n    type: script\n    run: git worktree lock ${JSON.stringify(worktreeOf('.', IMPLEMENT))}\n  - id: merge`),
  });
  const out = await f.run();

  assert.equal(out.status, 'completed', 'a failed removal is not a failed run');
  assert.equal(fs.existsSync(worktreeOf(f.root, IMPLEMENT)), true, 'the worktree git refused stays');
  assert.equal(fs.existsSync(worktreeOf(f.root, INTEGRATION)), false, 'cleanup continues past a failure');
  const warning = f.messages.find((m) => m.startsWith(`warn ${IMPLEMENT}: worktree kept — could not remove`));
  assert.ok(warning, `the failure must warn — got ${JSON.stringify(f.messages.filter((m) => m.startsWith('warn')))}`);
  assert.ok(warning.includes(worktreeOf(f.root, IMPLEMENT)), 'the warning names the directory');
  assert.ok(logLines(f).includes('run=1 removed-worktrees=1 kept=1'));

  // The record itself, against the run that had no failure. `at` is a wall-clock stamp and is the
  // one field that may differ between two runs of the same flow.
  assert.equal(f.ticket.meta.stage, control.ticket.meta.stage);
  const entry = (x) => { const { at: _at, ...rest } = x.ticket.meta.history.at(-1); return rest; };
  assert.deepEqual(entry(f), entry(control));
  const terminal = (x) => logLines(x).find((l) => l.startsWith('run=1 completed'));
  assert.equal(terminal(f), terminal(control));
  assert.equal(logLines(f).filter((l) => l.startsWith('run=1 completed')).length, 1);
});

await scenario('AC-7', 'a dry run obtains nothing, so it removes nothing', async () => {
  const f = fixture();
  git(f.root, 'branch', IMPLEMENT, 'main');
  const byHand = worktreeOf(f.root, IMPLEMENT);
  git(f.root, 'worktree', 'add', '-q', byHand, IMPLEMENT);
  const before = git(f.root, 'rev-parse', IMPLEMENT);

  const out = await f.run({ dry: true });
  assert.equal(out.status, 'completed');

  assert.equal(fs.existsSync(byHand), true, 'a dry run may not remove a worktree it did not make');
  assert.ok(git(f.root, 'worktree', 'list').includes(IMPLEMENT.replace(/\//g, '__')));
  assert.equal(git(f.root, 'rev-parse', IMPLEMENT), before);
  assert.equal(f.messages.some((m) => m.includes('worktree removed')), false);
});

if (failed) {
  console.error(`\n✗ ${failed} Q-0062 worktree-lifecycle scenario(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\n✓ q0062 worktree lifecycle');
}
