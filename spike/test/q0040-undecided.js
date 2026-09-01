// Q-0040 — a run that reaches a gate nobody can answer is undecided, and keeps the branch it proved.
//
// Every fixture builds its own repository under os.tmpdir() and asks git itself what happened, so
// no verdict here depends on this checkout's branches, its ignored directories, its git identity or
// the machine's git configuration ("A test's verdict is a property of the commit, not of the
// checkout or the account", docs/DECISIONS.md 2026-08-30).
//
// **The three TTY sites are reached through a one-line preload**, which sets `process.stdin.isTTY`
// before node evaluates the entry point. `ui.gate` branches on that property, so without it
// `bin/harness.js:110`, `:115` and `:119` are unreachable from a spawned process — a pipe is never a
// TTY — and the suite's only previous coverage of them was `q0033-surface.js`'s `skipped('S10.5')`.
// The binary still runs as the main module, unmodified. It is a value the test sets itself, which is
// what the 2026-08-30 rule permits; nothing is read from the machine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Backlog } from '../src/backlog.js';
import { TERMINAL_STATUSES } from '../src/contracts.js';
import { FlowError, GateUnansweredError, loadFlow, runFlow } from '../src/engine.js';

const spike = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(spike, 'bin', 'harness.js');
let failed = 0;
async function scenario(id, title, fn) {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.stack ?? e.message}`); }
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const clean = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');

const IMPLEMENT = 'harness/T-0001/implement';
const INTEGRATION = 'harness/T-0001/integration';
const GATE_REASON = 'Chore owner approves the review';
const worktreeOf = (root, branch) => path.join(root, '.harness', 'worktrees', branch.replace(/\//g, '__'));

// A chore-shaped flow: write in a worktree, merge into the ticket branch, then ask a human.
//
// **The merge before the gate is the whole point of the fixture.** A gate reached before anything
// has been integrated proves nothing about the rollback — chore.yaml's exhaustion gate precedes its
// integrate, which is why no exhaustion-gate failure in this backlog ever produced a `rolled-back`
// line. The destructive case is the terminal human gate, after the merge.
const PROVING_FLOW = `name: coding
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
  - id: approve
    gate: human
    reason: "${GATE_REASON}"
`;

function fixture({ gate } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0040-undecided-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'base');
  // The integration branch exists before the run, which is chore.yaml's own precondition and is
  // load-bearing twice: the rollback is additionally guarded by branchHeadAtStart being truthy, so
  // a branch the run itself created is spared the reset whatever its status. Without this the
  // control case would report no rollback for a reason unrelated to the classification.
  git(root, 'branch', INTEGRATION, 'HEAD');
  const harnessDir = path.join(root, 'harness');
  const backlog = new Backlog(path.join(root, 'backlog'));
  write(path.join(harnessDir, 'roles', 'principal-architect.md'), '---\nadapter: mock\n---\nArchitect.\n');
  const flowFile = path.join(harnessDir, 'flows', 'coding.yaml');
  write(flowFile, PROVING_FLOW);
  const ticket = backlog.create({ title: 'Undecided at a gate', intent: 'Exercise Q-0040.' });
  ticket.meta.stage = 'green'; backlog.write(ticket);
  const messages = [];
  const ui = {
    info: (m) => messages.push(`info ${m}`), warn: (m) => messages.push(`warn ${m}`),
    step: (a, b) => messages.push(`step ${a} ${b}`), done: (a, b) => messages.push(`done ${a} ${b}`), trace() {},
    gate: gate ?? (async ({ kind, reason }) => {
      throw new GateUnansweredError(
        `gate (${kind}) "${reason}" needs an answer and stdin closed without one — run it interactively, or answer it on stdin`,
        { kind, reason, condition: 'stdin-closed' },
      );
    }),
  };
  const config = { adapterOverride: 'mock', adapters: {}, repo: { base_branch: 'main' } };
  const run = (extra = {}) => runFlow({
    flow: loadFlow(flowFile), ticket, backlog, harnessDir, repoDir: root, config, ui, ...extra,
  });
  return { root, backlog, ticket, ui, messages, run };
}

// runs.log with Backlog.log's ISO timestamp taken off; the timestamp belongs to no assertion here.
const logLines = (f) => fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8')
  .split('\n').filter(Boolean).map((l) => l.replace(/^\S+ /, ''));

await scenario('AC-5', 'the branch keeps the merge the run proved, and the run does not throw', async () => {
  const f = fixture();
  const before = git(f.root, 'rev-parse', INTEGRATION);
  // Nothing failed, so nothing propagates: an await that rejected here would mean the run was
  // still being classified as a failure, and every assertion below would be about that run.
  const out = await f.run();
  assert.equal(out.status, 'undecided');

  const after = git(f.root, 'rev-parse', INTEGRATION);
  assert.notEqual(after, before, 'the integrate step must have moved the branch, or this proves nothing');
  // The merge itself survived, not merely some commit: the work the run proved is still reachable
  // from the branch, which is the property the rollback used to destroy.
  git(f.root, 'merge-base', '--is-ancestor', IMPLEMENT, INTEGRATION);
  assert.equal(logLines(f).some((l) => l.includes('rolled-back')), false, 'an undecided run rolls nothing back');
  assert.equal(f.messages.some((m) => m.includes('rolled back to')), false, 'and prints no rollback warning');
});

await scenario('AC-5', 'the same flow stopped by an operator error still rolls the branch back', async () => {
  // The control case, and it is what makes the one above a claim about `undecided` rather than
  // about the fixture: identical flow, identical merge, a gate that stops for a different reason.
  // A fix that spared every non-advancing status its rollback passes the case above and fails this.
  const f = fixture({
    gate: async ({ kind, reason }) => {
      throw new FlowError(`gate (${kind}) "${reason}" was given an empty answer — say advance, retry or abort; a gate is never assumed`);
    },
  });
  const before = git(f.root, 'rev-parse', INTEGRATION);
  await assert.rejects(f.run(), /was given an empty answer/);
  assert.equal(git(f.root, 'rev-parse', INTEGRATION), before, 'an operator error keeps every consequence a failure has');
  assert.ok(logLines(f).some((l) => l.startsWith('run=1 failed ')), 'and is still recorded as a failure');
  assert.ok(logLines(f).some((l) => l.includes('rolled-back')));
});

await scenario('AC-6', 'every worktree the run obtained is still there, and no ref was deleted', async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 'undecided');

  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), true, `${branch}: directory gone`);
    assert.ok(git(f.root, 'worktree', 'list').includes(branch.replace(/\//g, '__')), `${branch}: registration gone`);
    // *"A run removes the worktrees it made, and never the refs"* (2026-08-31) is untouched here.
    assert.equal(git(f.root, 'rev-parse', '--verify', branch).length, 40, `${branch}: ref gone`);
  }
  assert.equal(f.messages.some((m) => m.includes('worktree removed')), false);
  assert.equal(logLines(f).some((l) => l.includes('removed-worktrees=')), false);
});

await scenario('AC-6', 'the same flow answered `advance` gives them back, so this is not a blanket reprieve', async () => {
  // The `completed` control AC-6 asks for by name: without it, a change that skipped cleanup for
  // every status leaves the case above green.
  const f = fixture({ gate: async () => 'advance' });
  assert.equal((await f.run()).status, 'completed');
  for (const branch of [IMPLEMENT, INTEGRATION]) {
    assert.equal(fs.existsSync(worktreeOf(f.root, branch)), false, `${branch}: directory kept`);
  }
  assert.ok(logLines(f).includes('run=1 removed-worktrees=2 kept=0'));
});

await scenario('AC-7', 'no stage moves, one history entry says so, and no occurrence is failed', async () => {
  const f = fixture();
  const before = f.ticket.meta.stage;
  const out = await f.run();
  assert.equal(out.stage, before);

  const frontmatter = fs.readFileSync(path.join(f.ticket.dir, 'ticket.md'), 'utf8');
  assert.match(frontmatter, new RegExp(`stage: ${before}`));
  assert.match(frontmatter, /status: undecided/);
  assert.match(logLines(f).at(-1), new RegExp(`^run=1 undecided stage=${before}→${before} cost=\\S+ tokens=\\d+`));

  // "A gate allocates no occurrence" is a property of the engine rather than of this ticket, so it
  // is asserted rather than assumed: nothing is left running and nothing was closed as failed.
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, '.quorum', 'runs', 'T-0001-1', 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'undecided');
  assert.deepEqual(manifest.steps.map((s) => s.step_id), ['implement', 'merge']);
  assert.deepEqual(manifest.steps.map((s) => s.status), ['completed', 'completed']);
});

await scenario('AC-13', 'the diagnostic is verbatim, and the line beside it says what was kept', async () => {
  const f = fixture();
  await f.run();
  const head = git(f.root, 'rev-parse', INTEGRATION).slice(0, 7);

  // The sentence the operator acts on reaches them unchanged: it used to arrive through the
  // failure path this status no longer takes.
  assert.ok(f.messages.includes(
    `warn gate (human) "${GATE_REASON}" needs an answer and stdin closed without one — run it interactively, or answer it on stdin`,
  ), f.messages.join('\n'));
  assert.ok(f.messages.includes(
    `warn gate (human) "${GATE_REASON}" went unanswered — stdin closed while the question was open;`
    + ` nothing was rolled back: ${INTEGRATION} stays at ${head}, 2 worktrees kept`,
  ), f.messages.join('\n'));
  assert.ok(logLines(f).includes(
    `run=1 undecided-gate kind=human reason=${JSON.stringify(GATE_REASON)} condition=stdin-closed`
    + ` branch=${INTEGRATION} kept-at=${head} kept-worktrees=2`,
  ), logLines(f).join('\n'));
  // Before the terminal line, as the cleanup count is.
  const lines = logLines(f);
  assert.ok(lines.findIndex((l) => l.includes('undecided-gate')) < lines.findIndex((l) => l.startsWith('run=1 undecided stage=')));
});

await scenario('AC-13', 'both records name the gate\'s own reason, not only its kind', async () => {
  // AC-13 asks for the line to name the unanswered gate, and a flow may hold more than one gate of
  // the same kind: `kind=human` identifies neither, so the reason is the identifier. Asserted on
  // its own rather than left implicit in the whole-string matches above, so a reword that drops it
  // fails saying which of the two records lost it.
  const f = fixture();
  await f.run();
  const disposition = f.messages.find((m) => m.includes('went unanswered')) ?? '';
  const record = logLines(f).find((l) => l.includes('undecided-gate')) ?? '';
  assert.ok(disposition.includes(`"${GATE_REASON}"`), `disposition must name the reason: ${disposition}`);
  assert.ok(record.includes(`reason=${JSON.stringify(GATE_REASON)}`), `runs.log must name the reason: ${record}`);
});

await scenario('AC-13', 'the three conditions read differently, so a maintainer knows what to do next', async () => {
  // Which one occurred is what tells a scripting maintainer whether to supply another
  // `--gate-answer` or to run interactively, so it may not collapse into one wording.
  const sentences = [];
  for (const condition of ['answers-exhausted', 'stdin-closed', 'no-answer-channel']) {
    const f = fixture({
      gate: async ({ kind, reason }) => { throw new GateUnansweredError('no answer', { kind, reason, condition }); },
    });
    await f.run();
    sentences.push(f.messages.find((m) => m.includes('went unanswered')));
  }
  assert.equal(sentences.filter(Boolean).length, 3);
  assert.equal(new Set(sentences).size, 3, 'each condition must read differently');
});

await scenario('AC-3', 'classification is by type: an empty message is undecided, the verbatim words are not', async () => {
  const empty = fixture({
    gate: async ({ kind, reason }) => { throw new GateUnansweredError('', { kind, reason, condition: 'stdin-closed' }); },
  });
  assert.equal((await empty.run()).status, 'undecided');

  // The discriminating case: it fails against a classifier keyed on message text and passes
  // against one keyed on the type. The wording is bin/harness.js:96's, byte for byte.
  const verbatim = fixture({
    gate: async ({ kind, reason }) => {
      throw new FlowError(`gate (${kind}) "${reason}" needs an answer and stdin closed without one — pass --gate-answer advance|abort (repeatable, consumed in order), or run interactively`);
    },
  });
  await assert.rejects(verbatim.run(), /stdin closed without one/);
  assert.ok(logLines(verbatim).some((l) => l.startsWith('run=1 failed ')), 'the same words must still be a failure');
});

// --- The CLI's five gate sites, and its exit codes ---------------------------------------
//
// A project the CLI itself created, so `harness run` is exercised through the same path an
// adopter walks. `requirements` is used rather than the flow above because it needs no worktree.

function cliFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0040-cli-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  assert.equal(spawnSync(process.execPath, [bin, 'init'], { cwd: root, encoding: 'utf8' }).status, 0);
  assert.equal(spawnSync(process.execPath, [bin, 'ticket', 'new', 'Gate sites'], { cwd: root, encoding: 'utf8' }).status, 0);
  // What makes the interactive branch of ui.gate reachable: one line, preloaded with node's own
  // `--import` before the entry point is evaluated, so the binary runs unchanged as the main module
  // and `process.argv` is what it would be in an adopter's terminal. A wrapper that imported the
  // binary itself would work too and would put a `import(<computed>)` in this file, which the parity
  // register correctly refuses to classify.
  const preload = path.join(root, 'tty.mjs');
  write(preload, 'process.stdin.isTTY = true;\n');
  const reset = () => {
    const dir = fs.readdirSync(path.join(root, 'backlog')).find((d) => d.startsWith('T-0001'));
    const file = path.join(root, 'backlog', dir, 'ticket.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^stage: \w+$/m, 'stage: draft'));
  };
  const pipe = (args, input = '') => {
    reset();
    return spawnSync(process.execPath, [bin, ...args], {
      cwd: root, encoding: 'utf8', input, timeout: 30000, env: { ...process.env, MOCK_ALWAYS_PASS: '1' },
    });
  };
  const tty = (args, input) => {
    reset();
    return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, bin, ...args], {
      cwd: root, encoding: 'utf8', input, timeout: 30000, env: { ...process.env, MOCK_ALWAYS_PASS: '1' },
    });
  };
  return { root, pipe, tty };
}

await scenario('AC-2/AC-9', 'each of the CLI\'s five gate sites gets the classification and the exit code it earns', () => {
  // Five sites, three failing and two undecided, and both halves are load-bearing: a criterion that
  // checked only the status would pass over a fix that spared every failure its rollback.
  const f = cliFixture();
  const RUN = ['run', 'requirements', 'T-0001', '--adapter', 'mock'];
  const errors = [];
  const check = (id, r, status, pattern) => {
    const out = clean(r);
    try {
      assert.equal(r.status, status, `exit ${r.status}, expected ${status}`);
      assert.match(out, pattern);
      console.log(`  ✓ ${id}`);
    } catch (e) { errors.push(`${id}: ${e.message}\n${out}`); console.error(`  ✗ ${id}`); }
  };

  // Each label is the line of bin/harness.js the case reaches, named in a comment rather than in
  // the string: a quoted value carrying the binary's name and whitespace is prose to the parity
  // register, and five registrations to say "these are labels" would be five chances to go stale.

  // The two sites where no answer was available: undecided, exit 3.
  check(':96 answers exhausted, stdin not a TTY',
    f.pipe(RUN), 3, /needs an answer and stdin closed without one — pass --gate-answer/);
  check(':110 stdin closes mid-question',
    f.tty(RUN, ''), 3, /needs an answer and stdin closed without one — run it interactively/);

  // The three operator errors: somebody was there and got it wrong, so the run still fails, exit 1.
  check(':86 a --gate-answer that is not an allowed word',
    f.pipe([...RUN, '--gate-answer', 'ad']), 1, /expected exactly one of/);
  check(':115 an empty answer on a TTY',
    f.tty(RUN, '\n'), 1, /was given an empty answer/);
  check(':119 an answer the CLI does not understand',
    f.tty(RUN, 'zzz\n'), 1, /did not understand "zzz"/);

  assert.equal(errors.length, 0, errors.join('\n\n'));
});

await scenario('AC-9', 'exit 3 is its own code, and the run says the work is intact', () => {
  const f = cliFixture();
  const r = f.pipe(['run', 'requirements', 'T-0001', '--adapter', 'mock']);
  const out = clean(r);
  // Not merely non-zero: 1 is an operator error and 2 is a deliberate abort, so a script wrapping
  // `harness run` can tell "nobody was there" from either.
  assert.equal(r.status, 3, out);
  assert.match(out, /nothing was rolled back/);
  assert.match(out, /run #1 undecided/);
  const dir = fs.readdirSync(path.join(f.root, 'backlog')).find((d) => d.startsWith('T-0001'));
  assert.match(fs.readFileSync(path.join(f.root, 'backlog', dir, 'ticket.md'), 'utf8'), /stage: draft/);
});

await scenario('AC-10', 'undecided is a run status, and never a gate answer', () => {
  // The vocabulary boundary, exercised rather than read: what a human may say at a gate is
  // unchanged, so nothing invents a decision — *"Non-auto exhaustion gates require an explicit
  // human or scripted answer"* (2026-08-23) is untouched.
  const f = cliFixture();
  const r = f.pipe(['run', 'requirements', 'T-0001', '--adapter', 'mock', '--gate-answer', 'undecided']);
  assert.equal(r.status, 1, clean(r));
  assert.match(clean(r), /expected exactly one of: advance \/ (retry \/ )?abort/);
});

await scenario('AC-10', 'the spike\'s terminal vocabulary carries the word, and the occurrence enum does not', () => {
  assert.ok(TERMINAL_STATUSES.includes('undecided'), 'a run may end undecided');
  // The boundary is the whole criterion: `undecided` is what a *run* concluded about itself, and a
  // step is never undecided because a gate allocates no occurrence. Both halves are asserted over
  // the frozen schema, because one of them alone is satisfied by a schema that admits the word
  // everywhere or nowhere.
  const schema = JSON.parse(fs.readFileSync(path.join(spike, '..', 'contracts', 'Q-0011', 'run-manifest.schema.json'), 'utf8'));
  assert.ok(schema.properties.status.enum.includes('undecided'),
    'the run-level enum admits it, or harness validate refuses a manifest the engine just wrote');
  assert.equal(schema.$defs.step.properties.status.enum.includes('undecided'), false,
    'an occurrence is never undecided: a gate allocates none');
});

await scenario('AC-10', 'harness validate agrees with the engine about where the word may appear', () => {
  // The assertions above read the enums; this one runs the pass a maintainer runs. They are not the
  // same check: the schema is reachable from `validateArtifact` through a `$defs` indirection and a
  // semantic pass, and a criterion that only read the file would pass over a validator that never
  // consulted it. Both directions, because admitting it everywhere satisfies the positive half.
  const f = cliFixture();
  const manifest = (status, stepStatus) => ({
    schema_version: 1, run_id: 'T-0001-1', ticket_id: 'T-0001', ticket_path: 'backlog/T-0001-x/ticket.md',
    flow: 'requirements', flow_file: 'harness/flows/requirements.yaml',
    stage: { before: 'draft', after: 'draft' },
    started_at: '2026-09-01T10:00:00.000Z', ended_at: '2026-09-01T10:00:01.000Z', duration_ms: 1000,
    status,
    steps: stepStatus === undefined ? [] : [{
      step_id: 'head-of-product', occurrence_dir: 'steps/001-head-of-product', kind: 'adapter',
      role: 'head-of-product', adapter: 'mock', model: null, branch: null, worktree: null,
      started_at: '2026-09-01T10:00:00.000Z', duration_ms: 500, attempts: 1,
      status: stepStatus, verdict: null, error: null, usage: null,
    }],
    rollup: [],
  });
  const check = (name, value) => {
    const file = path.join(f.root, name);
    fs.writeFileSync(file, JSON.stringify(value));
    return f.pipe(['validate', path.join(spike, '..', 'contracts', 'Q-0011', 'run-manifest.schema.json'), file]);
  };
  assert.equal(check('run-undecided.json', manifest('undecided')).status, 0,
    'a run that ended undecided validates');
  const refused = check('step-undecided.json', manifest('undecided', 'undecided'));
  assert.equal(refused.status, 1, 'an occurrence carrying it is refused');
  assert.match(clean(refused), /\/steps\/0\/status/);
});

process.exit(failed ? 1 : 0);
