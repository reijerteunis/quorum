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
import { execFileSync, spawn } from 'node:child_process';
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
// Polls until a child process has got far enough to be worth interrupting; q0011's own helper.
const waitFor = async (predicate, message, timeout = 15000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return assert.fail(message);
};

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

await scenario('AC-1', 'a regressed run gives its worktrees back too, because it did what it set out to do', async () => {
  // OQ-5, and the half of AC-1's disjunct `completed` cannot stand in for. A regression is not a
  // failure: the run sent its ticket back deliberately. `finished()` is one predicate and this is
  // its second member — were cleanup keyed on `completed` alone, every scenario above still passes.
  // handleFail returns the goto on its first traversal rather than gating, so the run reaches the
  // `flow:` branch with both worktrees already obtained.
  const f = fixture({
    flow: `${CODING_FLOW}  - id: verdict\n    type: script\n    run: exit 7\n    on_fail: { goto: "flow:development", max_iterations: 1, on_exhausted: gate }\n`,
  });
  write(path.join(f.harnessDir, 'flows', 'development.yaml'),
    'name: development\nconsumes: red\nproduces: green\nsteps:\n  - id: build\n    role: principal-architect\n    adapter: mock\n');

  const out = await f.run();
  assert.equal(out.status, 'regressed', 'the flow must actually regress, or this asserts nothing about regressed');
  assert.equal(f.ticket.meta.stage, 'red');

  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), false, `${branch}: directory still on disk`);
    assert.equal(git(f.root, 'worktree', 'list').includes(branch.replace(/\//g, '__')), false, `${branch}: still registered`);
    // AC-4 holds on this path as much as on the completed one, which is what makes the regressed
    // ticket's next round free: the work it is being sent back to is still on its branch.
    assert.equal(git(f.root, 'rev-parse', '--verify', branch).length, 40);
  }
  assert.ok(f.messages.includes(`info ${IMPLEMENT}: worktree removed — ${worktreeOf(f.root, IMPLEMENT)}`));
  assert.ok(logLines(f).includes('run=1 removed-worktrees=2 kept=0'), 'the cleanup line is missing from runs.log');
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

await scenario('AC-2', 'an interrupted run keeps the directory it stopped in', async () => {
  // The third member of AC-2's disjunct, and the one the maintainer's story is actually about — the
  // run that stopped is the one whose worktree somebody is about to open. It needs a child process:
  // the spike reaches `interrupted` only through its SIGINT/SIGTERM handler, which ends in
  // process.exit(130) and would take this runner with it. Same shape as q0011's EDGE-9.
  const f = fixture({
    flow: `${CODING_FLOW}  - id: waiting\n    gate: human\n`,
  });
  const source = `import { runFlow, loadFlow } from ${JSON.stringify(path.join(spike, 'src/engine.js'))};\n`
    + `import { Backlog } from ${JSON.stringify(path.join(spike, 'src/backlog.js'))};\n`
    + `const root=process.argv[1], h=root+'/harness', b=new Backlog(root+'/backlog'), t=b.list()[0];\n`
    + `const ui={info(){},warn(){},step(){},done(){},trace(){},gate:()=>new Promise(()=>{})};\n`
    + `await runFlow({flow:loadFlow(h+'/flows/coding.yaml'),ticket:t,backlog:b,harnessDir:h,repoDir:root,`
    + `config:{adapterOverride:'mock',adapters:{},repo:{base_branch:'main'}},ui,auto:false});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source, f.root], { stdio: 'ignore' });

  // The gate is the last step, so both worktrees exist by the time the run is waiting at it —
  // which is what makes the interruption land on a run that is holding something.
  await waitFor(() => fs.existsSync(worktreeOf(f.root, INTEGRATION)),
    'the run never reached its gate holding both worktrees');
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));

  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), true, `${branch}: an interrupted run may not remove a worktree`);
    assert.ok(git(f.root, 'worktree', 'list').includes(branch.replace(/\//g, '__')), `${branch}: still registered`);
    assert.equal(git(f.root, 'rev-parse', '--verify', branch).length, 40);
  }
  const lines = logLines(f);
  assert.ok(lines.some((l) => l.startsWith('run=1 interrupted')), `the run must record itself interrupted — got ${JSON.stringify(lines)}`);
  assert.equal(lines.some((l) => l.includes('removed-worktrees=')), false, 'an interrupted run writes no cleanup line');
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

// The argv-shaped tokens of `text`, the same reading `packages/core/src/engine/q0062.source.test.ts`
// takes of its own tree. A quote is a property of the spelling and not of the command, so quotes
// are separators: ['branch', '-d', b], ["branch", "-d", b], a template literal and a plain shell
// line all reduce to the same two adjacent tokens. A property access stays one token, because `.`
// is part of a token, so `list.push` is never the verb `push` — which is what lets the push clauses
// exist at all. A colon ending a token is JavaScript punctuation and is dropped; one beginning it
// is a refspec and is kept.
const argv = (text) => text.split(/[^\w.:/@-]+/)
  .map((token) => (/^:+$/.test(token) ? token : token.replace(/:+$/, '')))
  .filter(Boolean);
const is = (...flags) => (token) => flags.includes(token);
const near = (tokens, verb, matches) =>
  tokens.some((token, index) => token === verb && tokens.slice(index + 1, index + 4).some(matches));

// Every way a source could delete a ref, or ask removeWorktree to delete one for it, read as
// tokens so no clause depends on quote style or on whether the command was built as an argv array
// or written out as a shell line. The last clause is the backstop: no source outside the primitive
// carries a -d, -D or --delete token at all, so a deletion flag on a verb nobody anticipated is
// still reported. What no scan of the text can see is a flag assembled at run time, which is why
// core's two-parameter WorktreeRemover is the other half of this pin.
const REF_DELETIONS = [
  ['deleteBranch', (t) => t.includes('deleteBranch')],
  ['branch -d', (t) => near(t, 'branch', is('-d'))],
  ['branch -D', (t) => near(t, 'branch', is('-D'))],
  ['branch --delete', (t) => near(t, 'branch', is('--delete'))],
  ['tag -d', (t) => near(t, 'tag', is('-d', '-D', '--delete'))],
  ['update-ref', (t) => t.includes('update-ref')],
  ['push --delete', (t) => near(t, 'push', is('-d', '--delete'))],
  ['push :ref', (t) => near(t, 'push', (token) => token.startsWith(':'))],
  ['a delete flag', (t) => t.some(is('-d', '-D', '--delete'))],
];
const refDeletions = (text) => {
  const tokens = argv(text);
  return REF_DELETIONS.filter(([, fires]) => fires(tokens)).map(([label]) => label);
};

await scenario('AC-4', 'no source file asks for a ref to be deleted, and the scan fires over one that does', () => {
  // The property cannot be observed by running a flow that never deletes a ref, which is every
  // flow. What stops the next change trying is this.
  const srcDir = path.join(spike, 'src');
  const sources = fs.readdirSync(srcDir, { recursive: true })
    .filter((rel) => rel.endsWith('.js'))
    .map((rel) => [rel, fs.readFileSync(path.join(srcDir, rel), 'utf8')]);
  assert.ok(sources.length >= 6, 'the scan needs a corpus, or it reports success over nothing');

  // git.js declares the option and is the one file allowed to spell it; nothing else may.
  const offenders = sources.filter(([rel]) => rel !== 'git.js')
    .flatMap(([rel, text]) => refDeletions(text).map((label) => `${rel}: ${label}`));
  assert.deepEqual(offenders, [], `a source file asks for a ref deletion: ${offenders.join(', ')}`);
  assert.deepEqual(refDeletions(fs.readFileSync(path.join(srcDir, 'git.js'), 'utf8')),
    ['deleteBranch', 'branch -D', 'a delete flag'],
    'the positive control: without it this scan would pass over clauses that match nothing');
});

await scenario('AC-4', 'the scan fires over the call site edited to ask for a deletion, in either spelling', () => {
  // The mutation a reviewer wants to see rather than be told about, performed on the real file in
  // both spellings: the one an earlier round's scan could see, and the one it could not.
  const engine = fs.readFileSync(path.join(spike, 'src', 'engine.js'), 'utf8');
  assert.ok(engine.includes('removeWorktree(ctx.repoDir, branch)'), 'the call site the mutations rewrite has moved');

  const asked = engine.replace('removeWorktree(ctx.repoDir, branch)', 'removeWorktree(ctx.repoDir, branch, { deleteBranch: true })');
  assert.notEqual(asked, engine);
  assert.deepEqual(refDeletions(asked), ['deleteBranch']);

  const tidied = engine.replace('removeWorktree(ctx.repoDir, branch)',
    'removeWorktree(ctx.repoDir, branch); git(["branch", "-d", branch], ctx.repoDir)');
  assert.notEqual(tidied, engine);
  assert.deepEqual(refDeletions(tidied), ['branch -d', 'a delete flag']);
});

await scenario('AC-4', 'every spelling of a deletion is seen, and nothing that is not one', () => {
  // Quote style and command construction are properties of the spelling; the clause set is a
  // property of the command. Each row is the positive control for one clause.
  for (const [form, snippet, clause] of [
    ['a single-quoted argv', "git(['branch', '-d', b], repo)", 'branch -d'],
    ['a double-quoted argv', 'git(["branch", "-d", b], repo)', 'branch -d'],
    ['a shell line in a template literal', 'runCommand(`git branch -D ${b}`, repo)', 'branch -D'],
    ['a shell line built by concatenation', 'exec("git branch --delete " + b)', 'branch --delete'],
    ['a tag, which is a ref too', 'git(["tag", "-d", name], repo)', 'tag -d'],
    ['plumbing', "git(['update-ref', '-d', ref], repo)", 'update-ref'],
    ['a double-quoted push deletion', 'git(["push", "origin", "--delete", b], repo)', 'push --delete'],
    ['a colon refspec assembled', "git(['push', 'origin', ':' + b], repo)", 'push :ref'],
    ['a colon refspec written out', 'exec(`git push origin :refs/heads/${b}`)', 'push :ref'],
    ['the primitive asked to do it', 'removeWorktree(dir, branch, { deleteBranch: true })', 'deleteBranch'],
  ]) assert.ok(refDeletions(snippet).includes(clause), `${form} must be seen as ${clause}`);

  // And the other half, which is what makes the first half mean anything: a scan that fires over
  // the whole corpus reports nothing. `x.push` is not the verb `push`.
  for (const [what, snippet] of [
    ['an array push carrying a colon', 'messages.push(`${branch}: worktree removed — ${dir}`)'],
    ['an array push carrying a flag', "args.push('--force', dir)"],
    ['the removal this ticket adds', "git(['worktree', 'remove', '--force', dir], repo)"],
    ['listing the branches it keeps', "git(['branch', '--list', 'harness/*'], repo)"],
    ['the call site as it ships', 'removeWorktree(ctx.repoDir, branch)'],
  ]) assert.deepEqual(refDeletions(snippet), [], `${what} is not a ref deletion`);
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
