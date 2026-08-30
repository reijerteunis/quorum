// Q-0057 — a chore review artifact is named by the run that wrote it, and a revise round reads
// its own run only.
//
// The defect: `chore.yaml`'s review step wrote `review/chore-iter-{iter}.md`, and `{iter}` is set
// to 1 at RUN start. A run-scoped counter was the only thing naming a ticket-scoped path, so every
// second run of the flow on a ticket overwrote the first run's reviews and fed the surviving
// mixture back to the implementer through `chore.yaml`'s `review/chore-iter-*.md` input glob.
// Measured twice on real tickets — Q-0041 (2026-08-25) and Q-0073 (2026-08-28).
//
// The flow under test is the SHIPPED file, read from harness/flows/chore.yaml and mutated in
// exactly the three ways the mock adapter needs (choreFlow below). Inlining a chore-shaped flow —
// what q0034-chore-preflight.js does, for a subject that is the engine rather than the file —
// would leave these scenarios green after a revert of the two paths this ticket changed, which is
// the one thing they exist to catch.
//
// Prompts are read from run history rather than rebuilt by calling buildPrompt: the assertions are
// about the text an adapter was actually handed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Backlog } from '../src/backlog.js';
import { loadFlow, runFlow } from '../src/engine.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHIPPED_CHORE = path.join(repoRoot, 'harness', 'flows', 'chore.yaml');

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x); };
// Gate answers are consumed in order; anything past the end advances. An exhaustion gate is
// human-locked, so `auto` never answers it and every scenario here reaches this.
const ui = (answers = []) => new Proxy({}, {
  get: (_, name) => (name === 'gate' ? async () => answers.shift() ?? 'advance' : () => {}),
});
const env = async (values, fn) => {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) v == null ? delete process.env[k] : process.env[k] = v;
  try { return await fn(); } finally { for (const [k, v] of Object.entries(old)) v == null ? delete process.env[k] : process.env[k] = v; }
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0057-'));
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'README.md'), 'fixture\n');
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  write(path.join(harnessDir, 'roles', 'principal-architect.md'), '---\nadapter: mock\n---\nImplementer.\n');
  write(path.join(harnessDir, 'roles', 'code-reviewer.md'), '---\nadapter: mock\n---\nReviewer.\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Chore reviews are run scoped', intent: 'Fixture.', owner: 'qa' });
  ticket.meta.stage = 'requirements'; backlog.write(ticket);
  backlog.writeFile(ticket, 'requirements/merged.md', '# Merged requirement\n\nThe specification.\n');
  backlog.writeFile(ticket, 'requirements/errata.md', '# Errata\n\nE-1 stands across runs.\n');
  // §5.8's prerequisite: only `integrate` creates the integration branch, and `review` diffs
  // against it, so a first chore run needs it by hand.
  git(root, 'branch', ticket.meta.branch, 'main');
  return { root, harnessDir, backlog, ticket };
}

/**
 * The shipped chore flow, mutated only where the mock adapter cannot stand in for a vendor CLI.
 *
 * 1. `implement.role` → principal-architect, the one role the mock writes a file for, which is what
 *    makes the implement→review diff non-empty (materialiseDiff refuses an empty range).
 * 2. `integrate.run_tests` dropped — the fixture repository has no suite; the merge still runs.
 * 3. `review.on_fail.max_iterations` where a scenario needs a particular number of rounds.
 *
 * Everything the ticket is about — the review step's write path, the implement step's input glob,
 * cross_vendor, the diff range and the gates — is the shipped file's own text.
 */
function choreFlow(harnessDir, { maxIterations = null } = {}) {
  const flow = YAML.parse(fs.readFileSync(SHIPPED_CHORE, 'utf8'));
  const step = (id) => {
    const found = flow.steps.find((s) => s.id === id);
    assert.ok(found, `the shipped chore flow no longer has a step "${id}"`);
    return found;
  };
  step('implement').role = 'principal-architect';
  delete step('integrate').run_tests;
  if (maxIterations != null) step('review').on_fail.max_iterations = maxIterations;
  const file = path.join(harnessDir, 'flows', 'chore.yaml');
  write(file, YAML.stringify(flow));
  return loadFlow(file);            // lints the mutated flow on the way in
}

const run = ({ root, harnessDir, backlog, ticket }, flow, { verdict, answers = [] } = {}) =>
  env({ MOCK_ALWAYS_FAIL: verdict === 'revise' ? '1' : null, MOCK_ALWAYS_PASS: verdict === 'approve' ? '1' : null }, () =>
    runFlow({
      flow, ticket: backlog.read(ticket.meta.id), backlog, harnessDir, repoDir: root,
      config: { adapterOverride: 'mock', repo: { base_branch: 'main' } }, ui: ui(answers), auto: true,
    }));

// A second run needs the stage back at what the flow consumes; runFlow refuses otherwise.
function rewind({ backlog, ticket }) {
  const current = backlog.read(ticket.meta.id);
  current.meta.stage = 'requirements';
  backlog.write(current);
}

// Every prompt one step of one run was handed, in the order the run made the calls. A missing
// prompt.txt throws rather than shrinking the list: an assertion reading prompts[0] of an empty
// array tests the string "undefined" and passes over anything.
function promptsOf(root, ticketId, runNumber, stepId) {
  const steps = path.join(root, '.quorum', 'runs', `${ticketId}-${runNumber}`, 'steps');
  const prompts = fs.readdirSync(steps).sort()
    .filter((name) => name.endsWith(`-${stepId}`))
    .map((name) => fs.readFileSync(path.join(steps, name, 'prompt.txt'), 'utf8'));
  assert.ok(prompts.length > 0, `run ${runNumber} recorded no ${stepId} prompt`);
  return prompts;
}

const reviewFiles = (ticket) => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.relative(ticket.dir, path.join(dir, d.name))]);
  const root = path.join(ticket.dir, 'review');
  return fs.existsSync(root) ? walk(root).sort() : [];
};

console.log('q0057 run-scoped chore reviews');

await scenario('R1', 'AC-1: {run} is the id the run was allocated, and it does not move when {iter} does', async () => {
  const f = fixture();
  // A ticket whose runs.log already ends at run=2 — so a `{run}` left at 1, or one tracking the
  // iteration counter, cannot pass.
  fs.writeFileSync(path.join(f.ticket.dir, 'runs.log'),
    '2026-08-29T10:00:00.000Z run=1 flow=chore start stage=requirements\n'
    + '2026-08-29T11:00:00.000Z run=2 flow=chore start stage=requirements\n');
  const file = path.join(f.harnessDir, 'flows', 'run-var.yaml');
  write(file, [
    'name: run-var', 'consumes: requirements', 'produces: reviewed', 'steps:',
    '  - id: write', '    role: principal-architect',
    '    output: { writes: ["x/run-{run}.md", "x/run-{run}-iter-{iter}.md"] }',
    '  - id: check', '    role: code-reviewer', '    output: { verdict: approve|revise }',
    '    on_fail: { goto: write, max_iterations: 1, on_exhausted: gate }',
  ].join('\n') + '\n');

  const res = await run(f, loadFlow(file), { verdict: 'revise' });

  assert.equal(res.status, 'completed');
  assert.deepEqual(fs.readdirSync(path.join(f.ticket.dir, 'x')).sort(),
    ['run-3-iter-1.md', 'run-3-iter-2.md', 'run-3.md'],
    '{run} must be 3 — nextRunId\'s answer — at every iteration, and nothing else may appear');
  const lines = fs.readFileSync(path.join(f.ticket.dir, 'runs.log'), 'utf8').trim().split('\n').slice(2);
  assert.ok(lines.length > 0, 'the run wrote its own log lines');
  for (const line of lines) {
    assert.match(line, /\brun=3\b/, `every line this run wrote says run=3, got: ${line}`);
  }
});

await scenario('R2', 'AC-3/AC-6: a revise round is fed its own run\'s reviews, numbered from 1 inside that run', async () => {
  const f = fixture();
  const flow = choreFlow(f.harnessDir);

  const first = await run(f, flow, { verdict: 'approve' });
  assert.equal(first.status, 'completed', 'run 1 must complete');
  rewind(f);
  const second = await run(f, flow, { verdict: 'revise' });
  assert.equal(second.status, 'completed', 'run 2 must complete');

  // AC-6: numbering is unchanged WITHIN a run — 1, then one per backward edge — and restarts at 1
  // inside the next run's own directory rather than reusing an earlier one.
  assert.deepEqual(reviewFiles(f.ticket), [
    'review/chore/run-1/chore-iter-1.md',
    'review/chore/run-2/chore-iter-1.md',
    'review/chore/run-2/chore-iter-2.md',
    'review/chore/run-2/chore-iter-3.md',
  ]);

  // AC-3: the second implement round of run 2 — the first one that has a review to be fed.
  const prompts = promptsOf(f.root, f.ticket.meta.id, 2, 'implement');
  assert.equal(prompts.length, 3, 'run 2 implements once per iteration');
  const revise = prompts[1];
  assert.ok(revise.includes(`## Input: backlog/${f.ticket.folder}/review/chore/run-2/chore-iter-1.md`),
    'the revise round must be fed this run\'s own review');
  assert.ok(!revise.includes('review/chore/run-1/'), 'and never an earlier run\'s review');
  assert.ok(!/## Input: \S+review\/chore-iter-/.test(revise), 'and never the legacy flat path');
  assert.ok(revise.includes(`## Input: backlog/${f.ticket.folder}/requirements/errata.md`),
    'the ticket\'s standing corrections still reach the implementer');
});

await scenario('R3', 'AC-5: two runs never overwrite, and the loop still converges', async () => {
  const f = fixture();
  // One backward edge in run 1, none left for run 2: the counter is the ticket's and survives the
  // run, so run 2's first revise verdict lands straight on the exhaustion gate.
  const flow = choreFlow(f.harnessDir, { maxIterations: 1 });

  const first = await run(f, flow, { verdict: 'revise' });
  assert.equal(first.status, 'completed', 'run 1 must complete');
  // Wherever run 1 put them, and whatever they say. Deliberately not a path assertion: it must be
  // the OVERWRITE that fails first when this scenario is run against a flow file that still names
  // its reviews after {iter} alone, rather than the layout.
  const afterRunOne = reviewFiles(f.ticket)
    .map((rel) => [rel, fs.readFileSync(path.join(f.ticket.dir, rel), 'utf8')]);
  assert.equal(afterRunOne.length, 2, 'run 1 must take its backward edge and write two reviews');

  rewind(f);
  const second = await run(f, flow, { verdict: 'revise' });
  assert.equal(second.status, 'completed', 'run 2 must complete');

  // (a) run 1's two files are byte-identical to what run 1 wrote, read after run 2 has finished
  for (const [rel, text] of afterRunOne) {
    assert.equal(fs.readFileSync(path.join(f.ticket.dir, rel), 'utf8'), text, `run 2 overwrote run 1's ${rel}`);
  }
  // (b) three review files across two run directories
  assert.deepEqual(reviewFiles(f.ticket), [
    'review/chore/run-1/chore-iter-1.md',
    'review/chore/run-1/chore-iter-2.md',
    'review/chore/run-2/chore-iter-1.md',
  ]);
  // (c) run 1's second implement step was fed run 1's first review
  const runOnePrompts = promptsOf(f.root, f.ticket.meta.id, 1, 'implement');
  assert.equal(runOnePrompts.length, 2, 'run 1 took its one backward edge');
  assert.ok(runOnePrompts[1].includes(`## Input: backlog/${f.ticket.folder}/review/chore/run-1/chore-iter-1.md`),
    'the loop still converges: the revise round sees the finding it must answer');
  // (d) run 2's implement input contains no run-1 and no legacy file
  const runTwoPrompt = promptsOf(f.root, f.ticket.meta.id, 2, 'implement')[0];
  assert.ok(!runTwoPrompt.includes('review/chore/run-1/'), 'run 2 was fed run 1\'s review');
  assert.ok(!/## Input: \S+review\//.test(runTwoPrompt), 'run 2\'s first implement receives no review at all');
});

await scenario('R4', 'AC-4: the first implement of a run is fed no review, whatever is on disk', async () => {
  // (a) an earlier run's directory is present.
  const withEarlierRun = fixture();
  const flow = choreFlow(withEarlierRun.harnessDir);
  assert.equal((await run(withEarlierRun, flow, { verdict: 'approve' })).status, 'completed');
  assert.ok(fs.existsSync(path.join(withEarlierRun.ticket.dir, 'review/chore/run-1/chore-iter-1.md')));
  rewind(withEarlierRun);
  assert.equal((await run(withEarlierRun, flow, { verdict: 'approve' })).status, 'completed');
  assert.ok(!/## Input: \S+review\//.test(promptsOf(withEarlierRun.root, withEarlierRun.ticket.meta.id, 2, 'implement')[0]),
    'run 2 must open with no review at all, not with run 1\'s');

  // (b) only legacy flat files, the state every ticket in this backlog is in: a new run starts
  // cleanly, writes into the new layout, reads none of them and moves none of them (AC-7).
  const legacyOnly = fixture();
  const legacy = { 'chore-iter-1.md': '# legacy 1\n', 'chore-iter-2.md': '# legacy 2\n' };
  for (const [name, text] of Object.entries(legacy)) {
    write(path.join(legacyOnly.ticket.dir, 'review', name), text);
  }
  const res = await run(legacyOnly, choreFlow(legacyOnly.harnessDir), { verdict: 'approve' });

  assert.equal(res.status, 'completed', 'a ticket carrying only legacy reviews starts a new run');
  assert.ok(!/## Input: \S+review\//.test(promptsOf(legacyOnly.root, legacyOnly.ticket.meta.id, 1, 'implement')[0]),
    'a legacy flat file is not read by the new glob');
  assert.deepEqual(reviewFiles(legacyOnly.ticket),
    ['review/chore-iter-1.md', 'review/chore-iter-2.md', 'review/chore/run-1/chore-iter-1.md']);
  for (const [name, text] of Object.entries(legacy)) {
    assert.equal(fs.readFileSync(path.join(legacyOnly.ticket.dir, 'review', name), 'utf8'), text,
      `the legacy ${name} was rewritten`);
  }
});

if (failed) { console.error(`\n✗ ${failed} scenario(s) failed`); process.exit(1); }
console.log('\n✓ 4 scenarios passed');
