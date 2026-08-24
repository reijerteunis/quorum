// Q-0035: the empty-range diagnostic reports evidence, not a story.
//
// Every fixture builds its own throwaway repository. Nothing here asserts the containment state of
// any branch in THIS repository — that would be red only until the next landing and green forever
// after, which the permanent-acceptance-test decision (2026-08-23) exists to prevent.
//
// Two habits this file keeps deliberately, both from the requirement's risk list. It never asserts
// a whole sentence: it checks that required evidence is present and that prohibited claims are
// absent, because a punctuation-sensitive snapshot breaks on every rewording and proves nothing.
// And it never assumes a short SHA is a fixed width — git chooses the abbreviation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Backlog } from '../src/backlog.js';
import { FlowError, lintFlow, materialiseDiff, runFlow, validateFlowDirectory } from '../src/engine.js';
import { ancestry, shallowState } from '../src/git.js';

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${String(e.message).split('\n').slice(0, 6).join('\n  ')}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (cwd, msg, extra = []) => git(cwd, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', ...extra, '-m', msg);
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x); };
const silent = new Proxy({}, { get: (_, name) => (name === 'gate' ? async () => 'advance' : () => {}) });

// AC-2's list. `merge-base` is deliberately absent: it is the name of the command the message must
// quote verbatim, and of the commit a three-dot range is defined against — so a bare /merge/ would
// forbid the evidence along with the story. What is banned is the claim that an event took place.
const FORBIDDEN = /\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/i;
const BRANCH = 'harness/T-9/integration';

// A repository with one commit on main and, unless told otherwise, a ticket branch beside it.
function repo({ branch = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0035-'));
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'a.txt'), 'one\n');
  git(root, 'add', '-A'); commit(root, 'base');
  if (branch) git(root, 'branch', BRANCH);
  return root;
}
const ctxFor = (root, vars = {}) => ({
  repoDir: root, config: { repo: { base_branch: 'main' } }, vars,
  ticket: { meta: { id: 'T-9' } }, backlog: { log: () => {} }, runId: 1,
});
const STEP = { id: 'review-claude', input: { diff: '{base}...harness/{id}/integration' } };
const failure = (step, ctx) => { try { materialiseDiff(step, ctx); } catch (e) { return e; } return null; };

// AC-1's five elements, asserted together because a message missing any one of them cannot be
// re-checked by hand — which is the entire point of the ticket.
function assertEvidence(message, { root, left = 'main', right = BRANCH, range, written, outcome }) {
  const leftSha = git(root, 'rev-parse', '--short', left);
  const rightSha = git(root, 'rev-parse', '--short', right);
  assert.ok(message.includes(`\`${range}\``), `names the interpolated range: ${message}`);
  assert.ok(message.includes(`\`${written}\``), `names the range as the flow file writes it: ${message}`);
  assert.ok(message.includes(left) && message.includes(right), `names both endpoints: ${message}`);
  assert.ok(message.includes(leftSha), `names the left short SHA ${leftSha}: ${message}`);
  assert.ok(message.includes(rightSha), `names the right short SHA ${rightSha}: ${message}`);
  assert.ok(message.includes(`git merge-base --is-ancestor ${right} ${left}`), `quotes the check it ran: ${message}`);
  assert.ok(message.includes(outcome), `states the outcome "${outcome}": ${message}`);
  assert.doesNotMatch(message, FORBIDDEN, 'the message claims a historical event');
}

console.log('q0035 empty-range diagnostic');

await scenario('E1', 'AC-1/AC-2/AC-4.1 — right contained in left: the failure names its evidence and claims no event', async () => {
  const root = repo();
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), 'one\ntwo\n'); git(root, 'add', '-A'); commit(root, 'work');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);

  const err = failure(STEP, ctxFor(root, { base: 'main', id: 'T-9' }));
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}`);
  assertEvidence(err.message, {
    root, range: `main...${BRANCH}`, written: '{base}...harness/{id}/integration', outcome: 'contained',
  });
  // The word this ticket exists to remove, and the advice the guard refuses.
  assert.doesNotMatch(err.message, /merge commit/, 'it must not recommend a range the guard rejects');
});

await scenario('E2', 'AC-4.2 — different commits with identical trees: not contained, and never called the same commit', async () => {
  const root = repo();
  commit(root, 'theirs', ['--allow-empty']);                 // main moves; the tree does not
  git(root, 'checkout', '-q', BRANCH);
  commit(root, 'ours', ['--allow-empty']);                   // the branch moves; the tree does not
  git(root, 'checkout', '-q', 'main');
  assert.equal(git(root, 'diff', '--stat', `main...${BRANCH}`), '', 'fixture must produce an empty range');

  const err = failure(STEP, ctxFor(root, { base: 'main', id: 'T-9' }));
  assertEvidence(err.message, {
    root, range: `main...${BRANCH}`, written: '{base}...harness/{id}/integration', outcome: 'not contained',
  });
  const leftSha = git(root, 'rev-parse', '--short', 'main');
  const rightSha = git(root, 'rev-parse', '--short', BRANCH);
  assert.notEqual(leftSha, rightSha, 'fixture must put the endpoints on different commits');
  assert.ok(err.message.includes('identical trees'), `it must say what is actually equal: ${err.message}`);
  assert.doesNotMatch(err.message, /same commit|identical commits/i, 'identical trees are not the same commit');
});

await scenario('E3', 'AC-4.3 — nothing added since the merge base, trees differ: not contained, nothing added', async () => {
  const root = repo();
  write(path.join(root, 'b.txt'), 'on main\n'); git(root, 'add', '-A'); commit(root, 'main moves for real');
  git(root, 'checkout', '-q', BRANCH);
  commit(root, 'ours', ['--allow-empty']);
  git(root, 'checkout', '-q', 'main');
  assert.equal(git(root, 'diff', '--stat', `main...${BRANCH}`), '', 'fixture must produce an empty range');

  const err = failure(STEP, ctxFor(root, { base: 'main', id: 'T-9' }));
  assertEvidence(err.message, {
    root, range: `main...${BRANCH}`, written: '{base}...harness/{id}/integration', outcome: 'not contained',
  });
  assert.ok(err.message.includes('adds nothing since its merge base'), `it must say nothing was added: ${err.message}`);
  assert.doesNotMatch(err.message, /identical trees/, 'these trees are not identical and must not be called so');
});

await scenario('E4', 'AC-4.4 — the check could not answer: indeterminate with a reason, never a containment claim', async () => {
  // Deep enough that a shallow fetch truncates, with the merge base still inside the window: the
  // clone can see the two tips diverge and cannot see far enough to disprove ancestry.
  const origin = repo({ branch: false });
  commit(origin, 'c2', ['--allow-empty']);
  commit(origin, 'c3 (merge base)', ['--allow-empty']);
  git(origin, 'branch', BRANCH);
  write(path.join(origin, 'b.txt'), 'main only\n'); git(origin, 'add', '-A'); commit(origin, 'main moves');
  git(origin, 'checkout', '-q', BRANCH);
  commit(origin, 'branch moves, tree unchanged', ['--allow-empty']);
  git(origin, 'checkout', '-q', 'main');

  const clone = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'q0035-clone-')), 'clone');
  git(os.tmpdir(), 'clone', '-q', '--depth', '2', '--no-single-branch', `file://${origin}`, clone);
  assert.equal(git(clone, 'rev-parse', '--is-shallow-repository'), 'true', 'fixture must be genuinely shallow');
  git(clone, 'branch', BRANCH, `origin/${BRANCH}`);
  assert.equal(git(clone, 'diff', '--stat', `main...${BRANCH}`), '', 'fixture must produce an empty range');

  const err = failure(STEP, ctxFor(clone, { base: 'main', id: 'T-9' }));
  assertEvidence(err.message, {
    root: clone, range: `main...${BRANCH}`, written: '{base}...harness/{id}/integration', outcome: 'indeterminate',
  });
  assert.ok(err.message.includes('shallow clone'), `it must carry the reason: ${err.message}`);
  // The whole point: absent history may not be rendered as a confident negative.
  assert.doesNotMatch(err.message, /is not contained|→ not contained/, 'absent history cannot disprove ancestry');
  assert.doesNotMatch(err.message, /→ contained/, 'and it cannot prove it either');

  // The other half of AC-4.4 — an exit that is neither 0 nor 1 — cannot be reached through
  // materialiseDiff, because a range whose endpoints do not resolve fails earlier by AC-5. It is
  // asserted at the primitive, which is the layer that owns the rule.
  const broken = ancestry(clone, 'no/such/ref', 'main');
  assert.equal(broken.state, 'indeterminate', 'a failed check is never "not contained"');
  assert.equal(broken.reason, 'git failed');
  assert.ok(broken.detail && !broken.detail.includes('\n'), 'git stderr is normalised to a single line');
});

await scenario('E5', 'AC-5 — an unresolvable endpoint fails with the evidence that exists and keeps its identifying phrase', async () => {
  // Right endpoint missing: the integration branch was never created.
  const noBranch = repo({ branch: false });
  const missingRight = failure(STEP, ctxFor(noBranch, { base: 'main', id: 'T-9' }));
  const mainSha = git(noBranch, 'rev-parse', '--short', 'main');
  assert.match(missingRight.message, /review requires an integrated branch/, 'the existing phrase is preserved');
  assert.ok(missingRight.message.includes('right endpoint'), 'it says which endpoint failed');
  assert.ok(missingRight.message.includes(mainSha), 'it gives the short SHA of the endpoint that does resolve');
  assert.ok(missingRight.message.includes(`main...${BRANCH}`), 'it names the complete range');
  assert.match(missingRight.message, /Neither the diff nor the containment check was run/);
  assert.doesNotMatch(missingRight.message, FORBIDDEN);
  assert.doesNotMatch(missingRight.message, /contained|not contained/, 'it invents no containment outcome');

  // Left endpoint missing: the configured base does not resolve.
  const noBase = repo();
  const branchSha = git(noBase, 'rev-parse', '--short', BRANCH);
  const missingLeft = failure(STEP, ctxFor(noBase, { base: 'trunk', id: 'T-9' }));
  assert.match(missingLeft.message, /repo\.base_branch in harness\/harness\.yaml/, 'the existing phrase is preserved');
  assert.match(missingLeft.message, /names missing ref/, 'and so is this one');
  assert.ok(missingLeft.message.includes('left endpoint'), 'it says which endpoint failed');
  assert.ok(missingLeft.message.includes(branchSha), 'it gives the short SHA of the endpoint that does resolve');
  assert.doesNotMatch(missingLeft.message, FORBIDDEN);

  // A ticket branch other than integration keeps the generic phrase.
  const other = repo();
  const generic = failure({ id: 'review', input: { diff: '{base}...harness/{id}/implement' } }, ctxFor(other, { base: 'main', id: 'T-9' }));
  assert.match(generic.message, /input\.diff names missing ref "harness\/T-9\/implement"/);
  assert.ok(generic.message.includes(git(other, 'rev-parse', '--short', 'main')));
});

await scenario('E6', 'AC-6 — every remedy passes the guard, and a guard failure stays a guard failure', async () => {
  const root = repo();
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), 'one\ntwo\n'); git(root, 'add', '-A'); commit(root, 'work');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);
  const ctx = ctxFor(root, { base: 'main', id: 'T-9' });

  const messages = [
    failure(STEP, ctx).message,                                                     // empty range
    failure(STEP, ctxFor(repo({ branch: false }), { base: 'main', id: 'T-9' })).message,   // missing ref
  ];
  for (const message of messages) {
    assert.doesNotMatch(message, /merge commit/, 'the withdrawn recommendation must be gone');
    // Every range the message names, checked against the layer that owns it: an uninterpolated one
    // belongs to the lint rule, an interpolated one to the engine's guard.
    for (const named of [...message.matchAll(/`([^`\s]*\.\.\.[^`\s]*)`/g)].map((m) => m[1])) {
      if (named.includes('{')) {
        assert.doesNotThrow(() => lintFlow({
          name: 'probe', consumes: 'a', produces: 'b',
          steps: [{ id: 'review', input: { diff: named } }],
        }), `a range the message names is rejected by harness lint: ${named}`);
      } else {
        const guarded = failure({ id: 'probe', input: { diff: named } }, ctx);
        assert.doesNotMatch(String(guarded?.message ?? ''), /must relate the configured base/,
          `a range the message names is rejected by the engine's guard: ${named}`);
      }
    }
  }

  // A malformed or unrelated range still fails at the guard, before any diff or containment work.
  git(root, 'branch', 'some/other-branch', 'main');
  const unrelated = failure({ id: 'review', input: { diff: 'main...some/other-branch' } }, ctx);
  assert.match(unrelated.message, /must relate the configured base or this ticket's own branches/);
  assert.ok(unrelated.message.includes('main...some/other-branch'), 'it names the supplied range');
  assert.ok(unrelated.message.includes('harness/T-9/'), 'and the allowed endpoint classes');
  assert.doesNotMatch(unrelated.message, /is empty|containment|contained/, 'a guard failure must not read as an empty-range diagnosis');
  const malformed = failure({ id: 'review', input: { diff: 'main..harness/T-9/integration' } }, ctx);
  assert.match(malformed.message, /must relate the configured base or this ticket's own branches/);
});

await scenario('E7', 'AC-7 — the guard derives its expected endpoints from ctx.vars.base, so a future --base composes', async () => {
  const root = repo();
  git(root, 'branch', 'release');
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), 'one\ntwo\n'); git(root, 'add', '-A'); commit(root, 'work');
  git(root, 'checkout', '-q', 'main');
  const ctx = ctxFor(root, { base: 'release', id: 'T-9' });

  // A base other than the repository default is accepted and produces a real patch.
  const diff = materialiseDiff(STEP, ctx);
  assert.match(diff, /\+two/, 'a run given another base still materialises its diff');
  // And an unrelated ref is still refused under that base.
  const err = failure({ id: 'review', input: { diff: 'release...some/other' } }, ctx);
  assert.match(err.message, /must relate the configured base/);
  assert.ok(err.message.includes('"release"'), 'the guard reports the base it was actually given');
});

await scenario('E8', 'AC-11 — a valid range is untouched: same patch, same stat, same truncation', async () => {
  const root = repo();
  git(root, 'checkout', '-q', BRANCH);
  write(path.join(root, 'a.txt'), `one\n${'padding line\n'.repeat(400)}`); git(root, 'add', '-A'); commit(root, 'work');
  git(root, 'checkout', '-q', 'main');
  const ctx = ctxFor(root, { base: 'main', id: 'T-9' });

  const diff = materialiseDiff(STEP, ctx);
  assert.match(diff, /## Diff to review/);
  assert.match(diff, /### git diff --stat main\.\.\.harness\/T-9\/integration/);
  assert.match(diff, /## Patch \(main\.\.\.harness\/T-9\/integration\)/);
  assert.match(diff, /\+padding line/);
  assert.doesNotMatch(diff, /Truncation notice/, 'an untruncated diff carries no notice');

  const truncated = materialiseDiff(STEP, { ...ctx, config: { repo: { base_branch: 'main', max_diff_bytes: 500 } } });
  assert.match(truncated, /Patch truncated to \d+ UTF-8 bytes \(configured limit 500\)/);
});

await scenario('E9', 'AC-10 — harness lint rejects a malformed or out-of-class input.diff, and admits every shipped flow', async () => {
  const valid = (diff) => ({ name: 'probe', consumes: 'a', produces: 'b', steps: [{ id: 'review', input: { diff } }] });
  for (const good of ['{base}...harness/{id}/integration', 'harness/{id}/integration...harness/{id}/implement', '{base}...harness/{id}/a/b']) {
    assert.doesNotThrow(() => lintFlow(valid(good)), `lint must admit ${good}`);
  }
  const bad = {
    'two dots, not three': 'main..harness/{id}/integration',
    'an interpolated base instead of {base}': 'main...harness/{id}/integration',
    'a ref belonging to no ticket': '{base}...some/other-branch',
    'another ticket\'s branch': '{base}...harness/Q-0001/integration',
    'three endpoints': '{base}...harness/{id}/a...harness/{id}/b',
    'one endpoint': 'harness/{id}/integration',
    'an empty endpoint': '{base}...',
    'a bare ticket prefix with no branch': '{base}...harness/{id}/',
    'not a string at all': 42,
  };
  for (const [why, value] of Object.entries(bad)) {
    let err = null;
    try { lintFlow(valid(value)); } catch (e) { err = e; }
    assert.ok(err instanceof FlowError, `lint must reject ${why} (${JSON.stringify(value)})`);
    assert.match(err.message, /review: input\.diff must be two/, `it names the step and the rule for ${why}`);
    assert.ok(err.message.includes(JSON.stringify(value)), `it quotes the offending value for ${why}`);
    assert.ok(err.message.includes('probe'), `it names the flow for ${why}`);
  }
  // The rule restates the engine's guard and must not have narrowed what a flow may say: every
  // flow this repository ships has to pass it unchanged.
  const flows = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'harness', 'flows');
  assert.doesNotThrow(() => validateFlowDirectory(flows), 'a shipped flow was rejected by the new rule');
  assert.doesNotThrow(() => validateFlowDirectory(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'templates', 'harness', 'flows')),
    'a shipped template flow was rejected by the new rule');
});

// ---- The run-level guarantees. Counted at the adapter boundary, from the run-history occurrence
// records under .quorum/runs/ — never inferred from an artifact's absence, which a step that is
// billed and then fails would satisfy falsely.
function fixture({ shallow = false } = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'q0035-run-'));
  const root = path.join(parent, 'repo');
  if (shallow) {
    // A genuinely truncated clone. Nothing here simulates shallowness: the run-level cases have to
    // meet the same repository an adopter would hand them, or they prove only that a flag was read.
    const origin = path.join(parent, 'origin');
    git(parent, 'init', '-q', '-b', 'main', origin);
    write(path.join(origin, 'README.md'), 'fixture\n');
    git(origin, 'add', '-A'); commit(origin, 'base');
    commit(origin, 'c2', ['--allow-empty']);
    git(parent, 'clone', '-q', '--depth', '1', `file://${origin}`, root);
    assert.equal(git(root, 'rev-parse', '--is-shallow-repository'), 'true', 'fixture must be genuinely shallow');
  } else {
    fs.mkdirSync(root);
    git(root, 'init', '-q', '-b', 'main');
    write(path.join(root, 'README.md'), 'fixture\n');
    git(root, 'add', '-A'); commit(root, 'base');
  }
  const harnessDir = path.join(root, 'harness');
  // Deliberately NOT principal-architect: that is the one role the mock adapter writes a file for,
  // and a branch with a commit on it would make the implement→review range non-empty, which is the
  // opposite of what E11 needs. This implementer commits nothing, which is exactly the real failure
  // AC-9 describes — the reader must learn the step produced nothing, not that a branch is missing.
  write(path.join(harnessDir, 'roles', 'implementer.md'), '---\nadapter: mock\n---\nImplementer.\n');
  write(path.join(harnessDir, 'roles', 'code-reviewer.md'), '---\nadapter: mock\n---\nReviewer.\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Empty range', intent: 'Fixture.', owner: 'qa' });
  ticket.meta.stage = 'requirements'; backlog.write(ticket);
  return { root, harnessDir, backlog, ticket };
}
// A chore-shaped flow: an adapter step first, then a diff-bearing reviewer.
const flowWith = (diff) => ({
  name: 'probe', consumes: 'requirements', produces: 'reviewed',
  steps: [
    { id: 'implement', role: 'implementer', adapter: 'mock', worktree: true,
      branch: 'harness/{id}/implement', base: 'harness/{id}/integration',
      input: { backlog: ['ticket.md'] }, output: { writes: ['dev/implement-report.md'] } },
    { id: 'review', role: 'code-reviewer', adapter: 'mock',
      input: { backlog: ['ticket.md'], diff }, output: { writes: ['review/iter-{iter}.md'] } },
  ],
});
// A commit on `branch` carrying `tree`, made without checking anything out — the fixtures below
// need branches that diverge from main, and a test that juggles worktrees to get them spends its
// attention on git plumbing instead of on the thing under test.
function branchAt(root, branch, tree, parent, message) {
  const sha = git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit-tree', tree, '-p', parent, '-m', message);
  git(root, 'branch', branch, sha);
}
// Adapter calls actually made, read from the manifest the engine writes for every occurrence.
function adapterCalls(root, ticketId) {
  const runs = path.join(root, '.quorum', 'runs');
  if (!fs.existsSync(runs)) return [];
  return fs.readdirSync(runs).filter((d) => d.startsWith(`${ticketId}-`)).flatMap((d) => {
    const manifest = path.join(runs, d, 'manifest.json');
    if (!fs.existsSync(manifest)) return [];
    return (JSON.parse(fs.readFileSync(manifest, 'utf8')).steps ?? [])
      .filter((s) => s.kind === 'adapter').map((s) => s.step_id);
  });
}
// The prompt each adapter was actually handed, read from the run history beside the manifest that
// names it. Asserting on these is what stops a fan-out fixture passing because nothing ran.
function adapterPrompts(root, ticketId) {
  const runs = path.join(root, '.quorum', 'runs');
  if (!fs.existsSync(runs)) return {};
  const out = {};
  for (const d of fs.readdirSync(runs).filter((name) => name.startsWith(`${ticketId}-`))) {
    const manifest = path.join(runs, d, 'manifest.json');
    if (!fs.existsSync(manifest)) continue;
    for (const s of JSON.parse(fs.readFileSync(manifest, 'utf8')).steps ?? []) {
      const f = path.join(runs, d, s.occurrence_dir ?? '', 'prompt.txt');
      if (s.kind === 'adapter' && fs.existsSync(f)) out[s.step_id] = fs.readFileSync(f, 'utf8');
    }
  }
  return out;
}
// runFlow records the flow's own file in the run manifest, and loadFlow is what normally sets it.
// These fixtures build the flow object directly, so they have to supply it too — the same thing
// q0034-chore-preflight.js's C3 does for the same reason.
const onDisk = (f, flow) => ({ ...flow, file: path.join(f.harnessDir, 'flows', `${flow.name}.yaml`) });
const run = (f, flow, repo = {}) => runFlow({
  flow: onDisk(f, flow), ticket: f.backlog.read(f.ticket.meta.id), backlog: f.backlog, harnessDir: f.harnessDir,
  repoDir: f.root, config: { repo: { base_branch: 'main', ...repo } }, ui: silent, auto: true,
}).then((r) => r ?? null, (e) => e);
// A fan-out shaped flow: one fan_out step whose template carries the diff, and nothing else. The
// template's branch and base mirror the shipped development flow — a template without them lands
// every task on `harness/{id}/{step.id}`, which for the default template id contains a colon and is
// not a legal ref, so the fixture would fail on git plumbing rather than on the thing under test.
const fanOutFlowWith = (diff) => ({
  name: 'probe', consumes: 'requirements', produces: 'reviewed',
  steps: [
    { id: 'build', fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on' },
      step: {
        branch: 'harness/{id}/{task.id}', base: 'harness/{id}/integration',
        input: { backlog: ['ticket.md'], repo: true, ...(diff ? { diff } : {}) }, output: { writes: ['dev/{task.id}.md'] },
      } },
  ],
});
// tasks.yaml plus the role its tasks name, so a regression that skipped the preflight would really
// reach and bill the fan-out's adapters. Without them a regression would die in loadTasks instead
// and the zero-invocation assertions below would pass for the wrong reason.
function seedTasks(f, ids) {
  write(path.join(f.harnessDir, 'roles', 'developer-backend.md'), '---\nadapter: mock\n---\nBackend developer.\n');
  write(path.join(f.ticket.dir, 'solution', 'tasks.yaml'),
    `tasks:\n${ids.map((id) => `  - id: ${id}\n    role: backend\n    title: Task ${id}\n    depends_on: []\n`).join('')}`);
}

await scenario('E10', 'AC-8 — a bad range over pre-existing refs fails with zero adapter invocations', async () => {
  // Every failure class AC-8 lists, each with the ticket branch present so the range is judged as
  // pre-existing rather than deferred.
  const cases = {
    'AC-4.1 contained': {
      prepare: (root, ticket) => {
        git(root, 'branch', ticket.meta.branch, 'main');          // identical to main → empty, contained
        return `{base}...harness/{id}/integration`;
      },
      expect: /→ contained/,
    },
    'AC-4.2 identical trees': {
      prepare: (root, ticket) => {
        const base = git(root, 'rev-parse', 'HEAD');
        commit(root, 'theirs', ['--allow-empty']);                // main moves; its tree does not
        branchAt(root, ticket.meta.branch, `${base}^{tree}`, base, 'ours');
        return `{base}...harness/{id}/integration`;
      },
      expect: /identical trees/,
    },
    'AC-4.3 nothing added': {
      prepare: (root, ticket) => {
        const base = git(root, 'rev-parse', 'HEAD');
        write(path.join(root, 'b.txt'), 'main only\n'); git(root, 'add', '-A'); commit(root, 'main moves');
        branchAt(root, ticket.meta.branch, `${base}^{tree}`, base, 'ours');
        return `{base}...harness/{id}/integration`;
      },
      expect: /adds nothing since its merge base/,
    },
    // AC-4.4 at the run level, not only at the message level: a shallow clone whose ancestry check
    // really exits 1. This is the case the old catch rendered as one of the two above, so a
    // regression that reintroduced the confident negative would pass every other row here.
    'AC-4.4 indeterminate': {
      shallow: true,
      prepare: (root, ticket) => {
        const tip = git(root, 'rev-parse', 'main');
        branchAt(root, ticket.meta.branch, `${tip}^{tree}`, tip, 'ours');   // same tree, later commit
        return `{base}...harness/{id}/integration`;
      },
      expect: /indeterminate \(shallow clone\)/,
    },
    'a missing ref': {
      prepare: () => `{base}...harness/{id}/integration`,         // the branch is never created
      expect: /review requires an integrated branch/,
    },
  };
  for (const [label, { prepare, expect, shallow }] of Object.entries(cases)) {
    const f = fixture({ shallow });
    const err = await run(f, flowWith(prepare(f.root, f.ticket)));
    assert.ok(err instanceof FlowError, `${label}: expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
    assert.deepEqual(adapterCalls(f.root, f.ticket.meta.id), [], `${label}: an adapter was billed against bad evidence`);
    assert.match(err.message, expect, `${label}: the run-level failure carries the right diagnosis`);
    assert.doesNotMatch(err.message, FORBIDDEN, `${label}: the message claims a historical event`);
  }

  // Malformed and out-of-class ranges: refused by lint before the run starts, and — if one is
  // smuggled past lint — refused by the engine's guard before any adapter runs. AC-8 counts at the
  // adapter boundary, so both classes are counted there too rather than trusted to lint alone.
  for (const value of ['main..harness/{id}/integration', '{base}...some/other-branch']) {
    let linted = null;
    try { lintFlow(flowWith(value)); } catch (e) { linted = e; }
    assert.ok(linted instanceof FlowError, `lint must refuse ${value} before the run starts`);

    const smuggled = fixture();
    git(smuggled.root, 'branch', smuggled.ticket.meta.branch, 'main');
    git(smuggled.root, 'branch', 'some/other-branch', 'main');
    const guarded = await run(smuggled, flowWith(value));
    assert.ok(guarded instanceof FlowError, `${value}: expected a FlowError, got ${guarded?.constructor?.name}`);
    assert.match(guarded.message, /must relate the configured base/, `${value}: it fails at the guard`);
    assert.doesNotMatch(guarded.message, /is empty|containment/, `${value}: a guard failure must not read as an empty-range diagnosis`);
    assert.deepEqual(adapterCalls(smuggled.root, smuggled.ticket.meta.id), [], `${value}: the guard must fire before any adapter`);
  }

  // One bad range fails the run even when another range is valid. The ticket branch carries real
  // work, so the first range materialises successfully and only the second one is bad.
  const mixed = fixture();
  write(path.join(mixed.root, 'work.txt'), 'real work\n');
  // Stage the one file, not -A: the fixture's backlog/ and harness/ are untracked, and committing
  // them here would put them inside the commit the reset below discards — which deletes the ticket.
  git(mixed.root, 'add', 'work.txt'); commit(mixed.root, 'work');
  git(mixed.root, 'branch', mixed.ticket.meta.branch);
  git(mixed.root, 'reset', '-q', '--hard', 'HEAD~1');            // main back to base; the branch is ahead
  assert.notEqual(git(mixed.root, 'diff', '--stat', `main...${mixed.ticket.meta.branch}`), '', 'the first range must be valid');
  const twoRanges = flowWith('{base}...harness/{id}/integration');
  twoRanges.steps.push({ id: 'second-review', role: 'code-reviewer', adapter: 'mock',
    input: { backlog: ['ticket.md'], diff: '{base}...harness/{id}/nowhere' }, output: { writes: ['review/second.md'] } });
  const both = await run(mixed, twoRanges);
  assert.ok(both instanceof FlowError, 'the run must fail on the bad range');
  assert.deepEqual(adapterCalls(mixed.root, mixed.ticket.meta.id), [], 'one bad range fails the run before any adapter');
});

await scenario('E11', 'AC-9 — a deferred range fails before the adapter that would consume it, naming the step that owed the branch', async () => {
  const f = fixture();
  git(f.root, 'branch', f.ticket.meta.branch, 'main');
  // integration...implement: the right endpoint is created by the implement step of this same
  // flow, so the preflight defers it. The implementer writes nothing outside the backlog, so the
  // branch is created with no commit of its own and the range comes out empty at step time.
  const err = await run(f, flowWith('harness/{id}/integration...harness/{id}/implement'));

  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  const calls = adapterCalls(f.root, f.ticket.meta.id);
  assert.ok(calls.includes('implement'), 'the producing adapter must have run — its output is the evidence');
  assert.ok(!calls.includes('review'), 'the consuming adapter must not have been billed against a bad range');
  // AC-1 through AC-6 hold here too, plus the step that was expected to create the endpoint.
  const id = f.ticket.meta.id;
  assert.ok(err.message.includes(`harness/${id}/integration...harness/${id}/implement`), 'names the interpolated range');
  assert.ok(err.message.includes('harness/{id}/integration...harness/{id}/implement'), 'names the range as written');
  assert.ok(err.message.includes('"implement"'), `names the step that owed the endpoint: ${err.message}`);
  assert.doesNotMatch(err.message, FORBIDDEN);
  // AC-9's purpose clause: the reader must come away knowing the implementer committed nothing.
  // A branch this run created moments ago never *became* contained, so the remedy may not send
  // them off to review it earlier — that is advice about a state that never arose.
  assert.match(err.message, /Remedy: check that step "implement" committed its work/, err.message);
  assert.doesNotMatch(err.message, /before it becomes contained/, 'a deferred endpoint did not become contained; it started that way');
});

await scenario('E12', 'AC-9 — the --dry placeholder for a deferred range is unchanged', async () => {
  const f = fixture();
  git(f.root, 'branch', f.ticket.meta.branch, 'main');
  const before = fs.readFileSync(path.join(f.ticket.dir, 'ticket.md'), 'utf8');
  const res = await runFlow({
    flow: onDisk(f, flowWith('harness/{id}/integration...harness/{id}/implement')),
    ticket: f.backlog.read(f.ticket.meta.id), backlog: f.backlog, harnessDir: f.harnessDir,
    repoDir: f.root, config: { repo: { base_branch: 'main' } }, ui: silent, dry: true,
  });
  assert.equal(res.status, 'completed', 'a preview must not demand branches only a paid run produces');
  assert.equal(fs.readFileSync(path.join(f.ticket.dir, 'ticket.md'), 'utf8'), before, 'dry run mutated the ticket');
  assert.deepEqual(adapterCalls(f.root, f.ticket.meta.id), [], 'a dry run invokes no adapter');
});

await scenario('E13', 'AC-3 — a shallow probe that cannot answer never becomes a confident negative', async () => {
  // The probe is a git call like any other, so it can fail like any other. Read as "not shallow",
  // a failed probe plus an exit 1 yields exactly the confident negative rule 1 forbids: the
  // repository would be ruling out absent history without having established whether any is
  // absent. Asserted at the primitive, which is the layer that owns both rules.
  const root = repo();
  write(path.join(root, 'b.txt'), 'main only\n'); git(root, 'add', '-A'); commit(root, 'main moves');
  // A genuinely not-contained pair, so the check really does exit 1 and only `shallow` decides.
  assert.equal(ancestry(root, 'main', BRANCH).state, 'not-contained', 'fixture must produce a real exit 1');

  const unknown = ancestry(root, 'main', BRANCH, { shallow: null, shallowDetail: 'fatal: not a git repository' });
  assert.equal(unknown.state, 'indeterminate', 'an unanswered shallow probe cannot yield "not contained"');
  assert.equal(unknown.reason, 'shallow state unknown');
  assert.ok(unknown.command.includes('merge-base --is-ancestor'), 'it still quotes the check it ran');
  // The three shallow values stay three distinct answers.
  assert.equal(ancestry(root, 'main', BRANCH, { shallow: true }).reason, 'shallow clone');
  assert.equal(ancestry(root, 'main', BRANCH, { shallow: false }).state, 'not-contained');

  // And the probe itself reports "could not ask" rather than "not shallow".
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'q0035-norepo-'));
  const probe = shallowState(notARepo);
  assert.equal(probe.shallow, null, 'a probe that fails must not report false');
  assert.ok(probe.detail && !probe.detail.includes('\n'), 'its reason is normalised to a single line');
  assert.equal(shallowState(root).shallow, false, 'and an ordinary repository still reports false');
});

await scenario('E14', 'AC-10 — the lint rule reaches a fan_out step\'s template, where a bad range would survive to a billed run', async () => {
  // flattenSteps does not descend into `step:`, so before this rule looked there a malformed range
  // in a fan-out template passed lint and failed at step time — after the fan-out's own adapters
  // had been paid for. The template is a step in every way that matters to materialiseDiff.
  const fanFlow = (diff) => ({
    name: 'probe', consumes: 'a', produces: 'b',
    steps: [{
      id: 'developers',
      fan_out: { from: 'solution/tasks.yaml', by: 'role' },
      step: { id: 'dev:{task.id}', role: 'developer-{role}', input: { diff } },
    }],
  });
  assert.doesNotThrow(() => lintFlow(fanFlow('{base}...harness/{id}/integration')), 'a well-formed template range must pass');

  for (const value of ['main..harness/{id}/integration', '{base}...some/other-branch', 'harness/{id}/integration']) {
    let err = null;
    try { lintFlow(fanFlow(value)); } catch (e) { err = e; }
    assert.ok(err instanceof FlowError, `lint must reject ${value} inside a fan_out template`);
    assert.match(err.message, /developers\.step: input\.diff must be two/, `it names the fan_out step and its template: ${err?.message}`);
    assert.ok(err.message.includes(JSON.stringify(value)), 'it quotes the offending value');
  }

  // A fan_out step carrying no template diff is not a finding, and the shipped development flow —
  // the only fan_out this repository ships — must still pass unchanged.
  assert.doesNotThrow(() => lintFlow({
    name: 'probe', consumes: 'a', produces: 'b',
    steps: [{ id: 'developers', fan_out: { from: 'solution/tasks.yaml' }, step: { id: 'dev:{task.id}', input: { backlog: ['ticket.md'] } } }],
  }), 'a template with no diff must not be a finding');
});

await scenario('E15', 'AC-9 — a deferred range that comes out indeterminate says so, and still names the step that owed the branch', async () => {
  // E11 covers the deferred range that comes out empty and contained. AC-9 asks for the same
  // quality of evidence when it comes out indeterminate, which is the outcome the old catch could
  // not produce at all — so a deferred range was the one place a confident negative could survive.
  const f = fixture({ shallow: true });
  git(f.root, 'branch', f.ticket.meta.branch, 'main');
  // The implement branch already exists from an earlier round: one commit ahead of the ticket
  // branch and holding the same tree. The range is empty, the ancestry check genuinely exits 1,
  // and the truncated history cannot disprove ancestry — so the honest answer is "don't know".
  const implement = `harness/${f.ticket.meta.id}/implement`;
  const tip = git(f.root, 'rev-parse', f.ticket.meta.branch);
  branchAt(f.root, implement, `${tip}^{tree}`, tip, 'an earlier round');

  const err = await run(f, flowWith('harness/{id}/integration...harness/{id}/implement'));
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  const calls = adapterCalls(f.root, f.ticket.meta.id);
  assert.ok(calls.includes('implement'), 'the producing adapter must have run — its output is the evidence');
  assert.ok(!calls.includes('review'), 'the consuming adapter must not have been billed against a range git could not judge');

  assertEvidence(err.message, {
    root: f.root, left: f.ticket.meta.branch, right: implement,
    range: `${f.ticket.meta.branch}...${implement}`,
    written: 'harness/{id}/integration...harness/{id}/implement',
    outcome: 'indeterminate',
  });
  assert.ok(err.message.includes('shallow clone'), `it must carry the reason: ${err.message}`);
  assert.ok(err.message.includes('"implement"'), `it must still name the step that owed the endpoint: ${err.message}`);
  assert.doesNotMatch(err.message, /is not contained|→ not contained/, 'absent history cannot disprove ancestry');
  assert.doesNotMatch(err.message, /→ contained/, 'and it cannot prove it either');
});

await scenario('E16', 'AC-9 — a deferred range whose endpoint does not resolve reports the evidence that exists', async () => {
  // (a) The realistic shape: chore.yaml reviews integration...implement, and on a ticket's first
  // pass the integration branch does not exist yet — its integrate step runs AFTER the review. The
  // range is still deferred on implement, and the endpoint that fails is the other one.
  const first = fixture();
  const implement = `harness/${first.ticket.meta.id}/implement`;
  const err = await run(first, flowWith('harness/{id}/integration...harness/{id}/implement'));
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  const calls = adapterCalls(first.root, first.ticket.meta.id);
  assert.ok(calls.includes('implement'), 'the producing adapter must have run');
  assert.ok(!calls.includes('review'), 'the consuming adapter must not have been billed against an unresolvable range');
  assert.match(err.message, /review requires an integrated branch/, 'the existing identifying phrase is preserved');
  assert.ok(err.message.includes('left endpoint'), `it says which endpoint failed: ${err.message}`);
  assert.ok(err.message.includes(git(first.root, 'rev-parse', '--short', implement)),
    `it gives the short SHA of the endpoint that does resolve: ${err.message}`);
  assert.ok(err.message.includes(`${first.ticket.meta.branch}...${implement}`), 'it names the complete range');
  assert.match(err.message, /Neither the diff nor the containment check was run/);
  assert.doesNotMatch(err.message, FORBIDDEN);
  assert.doesNotMatch(err.message, /contained/, 'it invents no containment outcome for a ref it could not read');
  // No step owed the endpoint that failed, so none may be blamed for it. Crediting the deferring
  // step here would be the same overstatement the ticket exists to remove, one field along.
  assert.doesNotMatch(err.message, /was expected to create harness\/\S*\/integration/,
    `no step owed the integration branch: ${err.message}`);

  // (b) The endpoint that fails IS the one a step owed. A fan_out step declared `worktree: true`
  // is remembered by the preflight under its own id, while runFanOut creates task branches — so
  // the branch the review waits for is never written. That is a flow-authoring mistake, and making
  // it legible is exactly AC-9's purpose clause: the reader learns which step owed the branch
  // rather than that a branch is missing.
  const owed = fixture();
  git(owed.root, 'branch', owed.ticket.meta.branch, 'main');
  seedTasks(owed, ['alpha']);
  const owedErr = await run(owed, {
    name: 'probe', consumes: 'requirements', produces: 'reviewed',
    steps: [
      { id: 'build', worktree: true, fan_out: { from: 'solution/tasks.yaml', by: 'role', respect: 'depends_on' },
        step: {
          branch: 'harness/{id}/{task.id}', base: 'harness/{id}/integration',
          input: { backlog: ['ticket.md'], repo: true }, output: { writes: ['dev/{task.id}.md'] },
        } },
      { id: 'review', role: 'code-reviewer', adapter: 'mock',
        input: { backlog: ['ticket.md'], diff: 'harness/{id}/integration...harness/{id}/build' },
        output: { writes: ['review/iter-{iter}.md'] } },
    ],
  });
  assert.ok(owedErr instanceof FlowError, `expected a FlowError, got ${owedErr?.constructor?.name}: ${owedErr?.message}`);
  const owedCalls = adapterCalls(owed.root, owed.ticket.meta.id);
  assert.ok(owedCalls.includes('build:alpha'), `the producing adapter must have run and been billed: ${owedCalls}`);
  assert.ok(!owedCalls.includes('review'), 'the consuming adapter must not have been billed');
  assert.match(owedErr.message, /names missing ref "harness\/\S*\/build"/, `it names the ref that does not resolve: ${owedErr.message}`);
  assert.match(owedErr.message, /step "build" was expected to create harness\/\S*\/build/,
    `it names the step that owed the endpoint: ${owedErr.message}`);
  assert.ok(owedErr.message.includes(git(owed.root, 'rev-parse', '--short', owed.ticket.meta.branch)),
    'it gives the short SHA of the endpoint that does resolve');
  assert.match(owedErr.message, /Neither the diff nor the containment check was run/);
  assert.doesNotMatch(owedErr.message, FORBIDDEN);
});

await scenario('E17', 'AC-8/AC-11 — the preflight reaches a fan_out template, so its range is judged once, before the fan-out is billed', async () => {
  // The template is a diff site the preflight used to walk straight past. Left out, a bad template
  // range failed only after the fan-out's adapters had been paid for, and a good one was
  // re-materialised by every expanded task.
  const bad = fixture();
  git(bad.root, 'branch', bad.ticket.meta.branch, 'main');        // identical to main → empty range
  seedTasks(bad, ['alpha']);
  const err = await run(bad, fanOutFlowWith('{base}...harness/{id}/integration'));
  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  assert.deepEqual(adapterCalls(bad.root, bad.ticket.meta.id), [], 'the fan-out was billed against a range the preflight could have judged');
  assert.ok(err.message.startsWith('build.step:'), `it names the template site as lint does: ${err.message}`);
  assert.doesNotMatch(err.message, FORBIDDEN);

  // AC-11's once-per-distinct-range, counted rather than assumed. materialiseDiff logs a line to
  // runs.log whenever it truncates, so a small max_diff_bytes turns each materialisation into one
  // durable, countable record — one for the preflight, or one per task without it.
  const good = fixture();
  write(path.join(good.root, 'big.txt'), `${'padding line\n'.repeat(400)}`);
  git(good.root, 'add', 'big.txt'); commit(good.root, 'work');
  git(good.root, 'branch', good.ticket.meta.branch);
  git(good.root, 'reset', '-q', '--hard', 'HEAD~1');              // main back to base; the branch is ahead
  seedTasks(good, ['alpha', 'beta']);
  const res = await run(good, fanOutFlowWith('{base}...harness/{id}/integration'), { max_diff_bytes: 500 });
  assert.ok(!(res instanceof Error), `the fan-out must complete on a valid range: ${res?.message}`);

  const calls = adapterCalls(good.root, good.ticket.meta.id);
  assert.ok(calls.includes('build:alpha') && calls.includes('build:beta'), `both tasks must have run: ${calls}`);
  const range = `main...${good.ticket.meta.branch}`;
  const log = fs.readFileSync(path.join(good.ticket.dir, 'runs.log'), 'utf8');
  const materialisations = [...log.matchAll(/diff truncated range=(\S+)/g)].filter((m) => m[1] === range).length;
  assert.equal(materialisations, 1, `one distinct range must be materialised once, not once per task (got ${materialisations})`);

  // And the one materialisation reached every member of the wave, byte for byte — the other half
  // of AC-11, and the reason counting alone is not enough: a count of one proves nothing if the
  // evidence never arrived.
  const prompts = adapterPrompts(good.root, good.ticket.meta.id);
  // The diff section alone: everything after it — the output contract, the task brief — is
  // per-task by design and would make any two members differ for reasons that are not the evidence.
  const section = (text) => {
    const start = text.indexOf('## Diff to review');
    assert.notEqual(start, -1, 'a task prompt carried no diff at all');
    return text.slice(start, text.indexOf('\n# Output contract', start));
  };
  assert.ok(section(prompts['build:alpha']).includes('+padding line'), 'the first task received the patch');
  assert.equal(section(prompts['build:alpha']), section(prompts['build:beta']), 'both tasks must receive identical bytes');
});

if (failed) { console.error(`\n✗ ${failed} Q-0035 scenario(s) failed`); process.exit(1); }
console.log('✓ q0035 empty-range diagnostic: all scenarios passed');
