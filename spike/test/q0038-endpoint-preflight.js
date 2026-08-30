// Q-0038: the preflight's guarantee is per endpoint, not per range.
//
// What a run can find missing is a ref, so a range holding one endpoint an earlier step creates
// and one that already exists is two different questions. Asking a single one of them is what let
// `harness run chore Q-0035` print a clean preview and then bill $13.86 to an implementer before
// the review failed on an integration branch that was knowably absent before the run started.
//
// Every fixture builds its own throwaway repository, and adapter calls are counted from the
// run-history occurrences the engine writes — never inferred from a missing artifact, which a step
// that is billed and then fails would satisfy falsely.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Backlog } from '../src/backlog.js';
import { FlowError, runFlow } from '../src/engine.js';

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n').slice(0, 6).join('\n  ')}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x); };
const silent = new Proxy({}, { get: (_, name) => (name === 'gate' ? async () => 'advance' : () => {}) });

// Q-0035's AC-2 list: what a message may never claim, since an ancestry check cannot establish that
// any of it happened. Kept identical here so a new message cannot re-introduce the vocabulary.
const FORBIDDEN = /\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/i;

// A repository with one commit on main, the two roles the mock adapter recognises, and a ticket at
// the stage the flows below consume. `principal-architect` is the role the mock writes a file for
// under allowWrite (`q0034-chore-preflight.js:40` says why), which is what makes a paired negative
// able to complete rather than fail on an empty range for an unrelated reason.
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0038-'));
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'README.md'), 'fixture\n');
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  write(path.join(harnessDir, 'roles', 'principal-architect.md'), '---\nadapter: mock\n---\nImplementer.\n');
  write(path.join(harnessDir, 'roles', 'code-reviewer.md'), '---\nadapter: mock\n---\nReviewer.\n');
  write(path.join(harnessDir, 'roles', 'developer-backend.md'), '---\nadapter: mock\n---\nBackend developer.\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Endpoint preflight', intent: 'Fixture.', owner: 'qa' });
  ticket.meta.stage = 'requirements'; backlog.write(ticket);
  return { root, harnessDir, backlog, ticket };
}

// The chore shape this ticket is about: an implementer in a worktree whose base is the integration
// branch, then a reviewer over integration...implement. `extra` goes between them.
const choreFlow = (diff = 'harness/{id}/integration...harness/{id}/implement', extra = []) => ({
  name: 'probe', consumes: 'requirements', produces: 'reviewed',
  steps: [
    { id: 'implement', role: 'principal-architect', adapter: 'mock', worktree: true,
      branch: 'harness/{id}/implement', base: 'harness/{id}/integration',
      input: { backlog: ['ticket.md'], repo: true }, output: { writes: ['dev/implement-report.md'] } },
    ...extra,
    { id: 'review', role: 'code-reviewer', adapter: 'mock',
      input: { backlog: ['ticket.md'], diff }, output: { writes: ['review/iter-{iter}.md'] } },
  ],
});
// runFlow records the flow's own file in the run manifest, and loadFlow is what normally sets it.
const onDisk = (f, flow) => ({ ...flow, file: path.join(f.harnessDir, 'flows', `${flow.name}.yaml`) });
const run = (f, flow, options = {}) => runFlow({
  flow: onDisk(f, flow), ticket: f.backlog.read(f.ticket.meta.id), backlog: f.backlog, harnessDir: f.harnessDir,
  repoDir: f.root, config: { repo: { base_branch: 'main' } }, ui: silent, auto: true, ...options,
}).then((r) => r ?? null, (e) => e);

const manifests = (root, ticketId) => {
  const runs = path.join(root, '.quorum', 'runs');
  if (!fs.existsSync(runs)) return [];
  return fs.readdirSync(runs).filter((d) => d.startsWith(`${ticketId}-`))
    .map((d) => path.join(runs, d, 'manifest.json')).filter((m) => fs.existsSync(m))
    .map((m) => ({ dir: path.dirname(m), manifest: JSON.parse(fs.readFileSync(m, 'utf8')) }));
};
// Adapter calls actually made, read from the manifest the engine writes for every occurrence.
const adapterCalls = (root, ticketId) => manifests(root, ticketId)
  .flatMap(({ manifest }) => (manifest.steps ?? []).filter((s) => s.kind === 'adapter').map((s) => s.step_id));
// The prompt each adapter was handed, beside the manifest that names it.
function adapterPrompts(root, ticketId) {
  const out = {};
  for (const { dir, manifest } of manifests(root, ticketId)) {
    for (const s of manifest.steps ?? []) {
      const f = path.join(dir, s.occurrence_dir ?? '', 'prompt.txt');
      if (s.kind === 'adapter' && fs.existsSync(f)) out[s.step_id] = fs.readFileSync(f, 'utf8');
    }
  }
  return out;
}
// tasks.yaml plus the role its tasks name, so a fan-out really reaches and bills its adapters.
const seedTasks = (f, ids) => write(path.join(f.ticket.dir, 'solution', 'tasks.yaml'),
  `tasks:\n${ids.map((id) => `  - id: ${id}\n    role: backend\n    title: Task ${id}\n    depends_on: []\n`).join('')}`);

console.log('q0038 per-endpoint preflight');

await scenario('P1', 'AC-1 — each endpoint is classified on its own, and only a fan_out template may be left unresolved', async () => {
  // (a) Both endpoints pre-existing: judged at run start, so a missing one costs nothing. The
  // implement branch is created by no step of this flow, which is what makes it class (c) here.
  const preExisting = fixture();
  git(preExisting.root, 'branch', preExisting.ticket.meta.branch, 'main');
  const nothingCreates = await run(preExisting, {
    name: 'probe', consumes: 'requirements', produces: 'reviewed',
    steps: [choreFlow().steps[0], { ...choreFlow('harness/{id}/integration...harness/{id}/absent').steps[1] }],
  });
  assert.ok(nothingCreates instanceof FlowError, `expected a FlowError, got ${nothingCreates?.constructor?.name}`);
  assert.match(nothingCreates.message, /names missing ref "harness\/\S*\/absent"/, nothingCreates.message);
  assert.deepEqual(adapterCalls(preExisting.root, preExisting.ticket.meta.id), [],
    'a range of two pre-existing endpoints is judged before anything is billed');

  // (b) One endpoint created by an earlier step: the range is deferred rather than materialised, so
  // the run reaches step time. Had the preflight materialised it, the implement branch did not yet
  // exist and the run would have failed at run start with a missing ref instead of completing.
  const deferred = fixture();
  git(deferred.root, 'branch', deferred.ticket.meta.branch, 'main');
  const completed = await run(deferred, choreFlow());
  assert.ok(!(completed instanceof Error), `a deferred range must reach step time: ${completed?.message}`);
  assert.equal(completed.status, 'completed');

  // (c) An outer step's unresolved {…} is class (c), never the template class: it fails on the ref
  // it names. With no step-created sibling this is exactly today's failure, at the same moment.
  const outer = fixture();
  git(outer.root, 'branch', outer.ticket.meta.branch, 'main');
  const unresolved = await run(outer, choreFlow('{base}...harness/{id}/{nope}'));
  assert.ok(unresolved instanceof FlowError, `expected a FlowError, got ${unresolved?.constructor?.name}`);
  assert.match(unresolved.message, /names missing ref "harness\/\S*\/\{nope\}"/, unresolved.message);
  assert.deepEqual(adapterCalls(outer.root, outer.ticket.meta.id), []);

  // And with one: the sibling is class (a), so no deferral is recorded — a half-interpolated key
  // could never be looked up at step time — and the endpoint that IS due is still resolved now.
  // That is AC-2 governing the timing of a failure AC-1 already classified: the same message class
  // as before, earlier and for free rather than after the producing adapter has been billed.
  const mixed = fixture();
  git(mixed.root, 'branch', mixed.ticket.meta.branch, 'main');
  const halfInterpolated = await run(mixed, choreFlow('harness/{id}/implement...harness/{id}/{nope}'));
  assert.ok(halfInterpolated instanceof FlowError, `expected a FlowError, got ${halfInterpolated?.constructor?.name}`);
  assert.match(halfInterpolated.message, /names missing ref "harness\/\S*\/\{nope\}"/, halfInterpolated.message);
  assert.match(halfInterpolated.message, /is not created until step "implement" runs/, halfInterpolated.message);
  assert.deepEqual(adapterCalls(mixed.root, mixed.ticket.meta.id), []);
});

await scenario('P2', 'AC-2/AC-3 — a deferred range still proves its pre-existing endpoint, before anything is billed', async () => {
  // The night this ticket is about: chore.yaml reviews integration...implement on a ticket whose
  // integration branch does not exist. The right endpoint is owed by the implement step; the left
  // is an ordinary ref that could have been checked for free, and now is.
  const f = fixture();
  const err = await run(f, choreFlow());
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  assert.deepEqual(adapterCalls(f.root, f.ticket.meta.id), [], 'no adapter may be billed against a knowably absent ref');

  const id = f.ticket.meta.id;
  assert.match(err.message, /review requires an integrated branch/, 'the identifying phrase for its endpoint class');
  assert.ok(err.message.includes('left endpoint'), `it says which endpoint failed: ${err.message}`);
  assert.ok(err.message.includes(`harness/${id}/integration...harness/${id}/implement`), 'it names the interpolated range');
  assert.ok(err.message.includes('harness/{id}/integration...harness/{id}/implement'), 'and the range as the flow file writes it');
  assert.match(err.message, /Neither the diff nor the containment check was run/);
  assert.doesNotMatch(err.message, FORBIDDEN);
  assert.doesNotMatch(err.message, /contained/, 'it invents no containment outcome for a ref it could not read');
  // The clause this criterion exists for. The right endpoint is not supposed to resolve yet, so
  // reporting it as one that does not resolve either is the same category error, in the same
  // message, that the diagnosis half removes.
  assert.match(err.message, new RegExp(`the right endpoint harness/${id}/implement is not created until step "implement" runs`), err.message);
  assert.doesNotMatch(err.message, /does not resolve either/, 'a branch no step has produced yet has not failed to resolve');
  assert.doesNotMatch(err.message, /was expected to create harness\/\S*\/integration/,
    `no step owed the endpoint that failed: ${err.message}`);

  // The paired negative, which is what makes the refusal discriminating: the same flow, with the
  // ticket branch present, must still run.
  const ok = fixture();
  git(ok.root, 'branch', ok.ticket.meta.branch, 'main');
  const res = await run(ok, choreFlow());
  assert.ok(!(res instanceof Error), `a fix that refuses everything fails here: ${res?.message}`);
  assert.equal(res.status, 'completed');
  assert.deepEqual(adapterCalls(ok.root, ok.ticket.meta.id), ['implement', 'review']);
});

await scenario('P3', 'AC-4 — a step-created endpoint stays deferred even when the ref already exists at run start', async () => {
  // A second chore round: harness/<id>/implement survives from round 1. Materialising the range at
  // preflight would capture bytes from that round and present them as this one's — and here it
  // would fail outright, since the two branches are identical and the range is empty at run start.
  const f = fixture();
  git(f.root, 'branch', f.ticket.meta.branch, 'main');
  git(f.root, 'branch', `harness/${f.ticket.meta.id}/implement`, 'main');
  assert.equal(git(f.root, 'diff', '--stat', `${f.ticket.meta.branch}...harness/${f.ticket.meta.id}/implement`), '',
    'the fixture must be empty at run start, or it cannot discriminate');

  const res = await run(f, choreFlow());
  assert.ok(!(res instanceof Error), `the run must complete on evidence produced during it: ${res?.message}`);
  const prompts = adapterPrompts(f.root, f.ticket.meta.id);
  assert.ok(prompts.review, 'the reviewer must have been given a prompt');
  assert.match(prompts.review, /## Diff to review/, 'the deferred range is materialised at step time');
  assert.match(prompts.review, /ProrationService/, 'the reviewer read what implement wrote during THIS run');
});

await scenario('P4', 'AC-5 — a deferred range failing on its other endpoint names the step that owed the endpoint that did not fail', async () => {
  // The case half 2 cannot remove: the pre-existing endpoint resolved at preflight and stopped
  // resolving during the run. A script step between the two adapters stages it without inventing a
  // step kind — the base is deleted after the producer has been billed and before the consumer.
  const f = fixture();
  git(f.root, 'branch', f.ticket.meta.branch, 'main');
  const err = await run(f, choreFlow('harness/{id}/integration...harness/{id}/implement', [
    { id: 'drop-base', type: 'script', run: 'git branch -D harness/{id}/integration' },
  ]));
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);

  const id = f.ticket.meta.id;
  const calls = adapterCalls(f.root, id);
  assert.ok(calls.includes('implement'), `the producing adapter ran and was billed: ${calls}`);
  assert.ok(!calls.includes('review'), 'the consuming adapter must not have been billed against a range it cannot read');
  assert.match(err.message, /review requires an integrated branch/, 'the identifying phrase for its endpoint class');
  assert.ok(err.message.includes('left endpoint'), `it says which endpoint failed: ${err.message}`);
  assert.ok(err.message.includes(git(f.root, 'rev-parse', '--short', `harness/${id}/implement`)),
    `it gives the short SHA of the endpoint that does resolve: ${err.message}`);
  // The finding this ticket opened on: today the producer clause appears only when the endpoint
  // that failed is the one a step owed, so this message named no step at all.
  assert.match(err.message, new RegExp(`the range was deferred waiting for step "implement" to create harness/${id}/implement`), err.message);
  assert.doesNotMatch(err.message, /was expected to create harness\/\S*\/integration/,
    'no step owed the endpoint that failed, so none may be blamed for it');
  assert.match(err.message, /Neither the diff nor the containment check was run/);
  assert.doesNotMatch(err.message, FORBIDDEN);
});

await scenario('P5', 'AC-5 — when both endpoints were deferred, both step/ref pairs appear, in either endpoint order', async () => {
  // A fan_out step declared `worktree: true` is remembered by the preflight under its own id while
  // runFanOut creates task branches, so the branch a later step waits for is never written —
  // q0035's E16(b) trick, doubled, which gives a range whose two endpoints are owed by two
  // different steps and neither of which is ever created. A single `.find()` over the range would
  // keep the first match only, which is the asymmetry one level down.
  for (const [left, right] of [['build', 'check'], ['check', 'build']]) {
    const f = fixture();
    git(f.root, 'branch', f.ticket.meta.branch, 'main');
    seedTasks(f, ['alpha']);
    const fanOut = (id, prefix) => ({
      id, worktree: true, fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on' },
      step: {
        branch: `harness/{id}/${prefix}{task.id}`, base: 'harness/{id}/integration',
        input: { backlog: ['ticket.md'], repo: true }, output: { writes: [`dev/${prefix}{task.id}.md`] },
      },
    });
    const err = await run(f, {
      name: 'probe', consumes: 'requirements', produces: 'reviewed',
      steps: [
        fanOut('build', ''), fanOut('check', 'chk-'),
        { id: 'review', role: 'code-reviewer', adapter: 'mock',
          input: { backlog: ['ticket.md'], diff: `harness/{id}/${left}...harness/{id}/${right}` },
          output: { writes: ['review/iter-{iter}.md'] } },
      ],
    });
    assert.ok(err instanceof FlowError, `${left}...${right}: expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
    const id = f.ticket.meta.id;
    const calls = adapterCalls(f.root, id);
    assert.ok(calls.includes('build:alpha') && calls.includes('check:alpha'), `both producers ran: ${calls}`);
    assert.ok(!calls.includes('review'), 'the consuming adapter must not have been billed');
    // The endpoint that failed is blamed on its own producer; the other one explains the deferral.
    assert.match(err.message, new RegExp(`step "${left}" was expected to create harness/${id}/${left}`), err.message);
    assert.match(err.message, new RegExp(`the range was deferred waiting for step "${right}" to create harness/${id}/${right}`), err.message);
    assert.doesNotMatch(err.message, new RegExp(`was expected to create harness/${id}/${right}\\b`),
      `${left}...${right}: the step that owed the other endpoint must not be blamed for this one`);
    assert.doesNotMatch(err.message, FORBIDDEN);
  }
});

await scenario('P6', 'AC-7 — --dry refuses what a real run refuses, and still writes nothing', async () => {
  const f = fixture();
  const before = fs.readFileSync(path.join(f.ticket.dir, 'ticket.md'), 'utf8');
  const err = await run(f, choreFlow(), { auto: false, dry: true });
  assert.ok(err instanceof FlowError, `a clean preview of a run that cannot start is silence, not evidence: ${err?.status}`);
  assert.match(err.message, /review requires an integrated branch/);
  assert.match(err.message, /is not created until step "implement" runs/);
  assert.deepEqual(adapterCalls(f.root, f.ticket.meta.id), [], 'a dry run invokes no adapter');
  assert.equal(fs.readFileSync(path.join(f.ticket.dir, 'ticket.md'), 'utf8'), before, 'dry run mutated the ticket');
});

await scenario('P7', 'AC-1/AC-2 — a fan_out template is judged per endpoint too, so the checkable half is checked', async () => {
  // The template skip had the same shape as the wholesale deferral one level down:
  // `harness/{id}/integration...harness/{id}/{task.id}` has one endpoint that cannot be resolved
  // until tasks.yaml is expanded and one that is an ordinary ref, and the whole site was skipped.
  // No shipped flow carries a template input.diff, so this is the class rather than a case.
  const f = fixture();
  seedTasks(f, ['alpha']);
  const err = await run(f, {
    name: 'probe', consumes: 'requirements', produces: 'reviewed',
    steps: [{
      id: 'build', fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on' },
      step: {
        branch: 'harness/{id}/{task.id}', base: 'harness/{id}/integration',
        input: { backlog: ['ticket.md'], repo: true, diff: 'harness/{id}/integration...harness/{id}/{task.id}' },
        output: { writes: ['dev/{task.id}.md'] },
      },
    }],
  });
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  assert.deepEqual(adapterCalls(f.root, f.ticket.meta.id), [], 'the fan-out was billed against an endpoint that could have been checked');
  // The identifying phrase is chosen by the failing endpoint's own class, not by the site: this
  // one is the integration branch, so it reads exactly as it does for an ordinary step.
  assert.match(err.message, /review requires an integrated branch/, err.message);
  assert.ok(err.message.includes('left endpoint'), `it says which endpoint failed: ${err.message}`);
  assert.ok(err.message.includes('harness/{id}/integration...harness/{id}/{task.id}'), 'it names the range as the flow file writes it');
  // And the endpoint that has no value yet is described as the template site lint names, not as a
  // ref that failed.
  assert.match(err.message, /is a per-task template with no value until "build\.step" expands its tasks/, err.message);
  assert.doesNotMatch(err.message, /does not resolve either/, 'an endpoint with no value yet has not failed to resolve');
  assert.doesNotMatch(err.message, FORBIDDEN);

  // The paired negative: with the integration branch present the template range is still left to
  // step time, one range per task, and the fan-out runs.
  const ok = fixture();
  seedTasks(ok, ['alpha']);
  write(path.join(ok.root, 'work.txt'), 'real work\n');
  git(ok.root, 'add', 'work.txt');
  git(ok.root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'work');
  git(ok.root, 'branch', ok.ticket.meta.branch);
  git(ok.root, 'reset', '-q', '--hard', 'HEAD~1');            // main back to base; the branch is ahead
  const res = await run(ok, {
    name: 'probe', consumes: 'requirements', produces: 'reviewed',
    steps: [{
      id: 'build', fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on' },
      step: {
        branch: 'harness/{id}/{task.id}', base: 'harness/{id}/integration',
        input: { backlog: ['ticket.md'], repo: true, diff: '{base}...harness/{id}/{task.id}' },
        output: { writes: ['dev/{task.id}.md'] },
      },
    }],
  });
  assert.ok(!(res instanceof Error), `a template range whose other endpoint resolves must still run: ${res?.message}`);
  assert.ok(adapterCalls(ok.root, ok.ticket.meta.id).includes('build:alpha'), 'the fan-out ran');
});

if (failed) { console.error(`\n✗ ${failed} Q-0038 scenario(s) failed`); process.exit(1); }
console.log('✓ q0038 per-endpoint preflight: all scenarios passed');
