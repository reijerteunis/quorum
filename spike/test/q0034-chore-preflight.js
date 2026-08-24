// The chore flow must survive the Q-0006 diff preflight and range guard.
//
// Both were written on Q-0006's branch in August, before chore.yaml existed, and landed on
// 2026-08-24 — where they met a flow that reviews integration...implement, a range whose right
// endpoint is created BY the run and whose shape is not {base}...{integration}. The preflight
// refused at run start ("review requires an integrated branch") and the guard would have refused
// at step time. Found by `harness run chore Q-0036 --dry`, at a cost of $0, the day the landing
// happened: a semantic conflict between an old branch and a newer flow that no git merge could
// surface. See Q-0034.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { Backlog } from '../src/backlog.js';
import { FlowError, loadFlow, runFlow } from '../src/engine.js';

let failed = 0;
const scenario = async (id, title, fn) => {
  try { await fn(); console.log(`✓ ${id} — ${title}`); }
  catch (e) { failed++; console.error(`✗ ${id} — ${title}\n  ${e.message}`); }
};
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const write = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x); };
const silent = new Proxy({}, { get: (_, name) => (name === 'gate' ? async () => 'advance' : () => {}) });
const env = async (values, fn) => {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) v == null ? delete process.env[k] : process.env[k] = v;
  try { return await fn(); } finally { for (const [k, v] of Object.entries(old)) v == null ? delete process.env[k] : process.env[k] = v; }
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0034-chore-'));
  git(root, 'init', '-q', '-b', 'main');
  write(path.join(root, 'README.md'), 'fixture\n');
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '-m', 'base');
  const harnessDir = path.join(root, 'harness');
  // The architect role is the one the mock adapter writes a file for under allowWrite, which is
  // what makes the implement→review diff non-empty without a real CLI.
  write(path.join(harnessDir, 'roles', 'principal-architect.md'), '---\nadapter: mock\n---\nImplementer.\n');
  write(path.join(harnessDir, 'roles', 'code-reviewer.md'), '---\nadapter: mock\n---\nReviewer.\n');
  const backlog = new Backlog(path.join(root, 'backlog'));
  const ticket = backlog.create({ title: 'Chore preflight', intent: 'Fixture.', owner: 'qa' });
  ticket.meta.stage = 'requirements'; backlog.write(ticket);
  return { root, harnessDir, backlog, ticket };
}

const CHORE = (extraReviewRange) => [
  'name: chore-shaped', 'consumes: requirements', 'produces: reviewed', 'steps:',
  '  - id: implement', '    role: principal-architect', '    adapter: mock', '    worktree: true',
  '    branch: "harness/{id}/implement"', '    base: "harness/{id}/integration"',
  '    input: { backlog: [ticket.md, "review/chore-iter-*.md"] }', '    output: { writes: [dev/implement-report.md] }',
  '  - id: review', '    role: code-reviewer', '    adapter: mock',
  '    input:', '      backlog: [ticket.md]',
  `      diff: "${extraReviewRange ?? 'harness/{id}/integration...harness/{id}/implement'}"`,
  '    output: { writes: ["review/chore-iter-{iter}.md"], verdict: approve|revise }',
  '    on_fail: { goto: implement, max_iterations: 1, on_exhausted: gate }',
  '  - id: integrate', '    type: integrate', '    branches: ["harness/{id}/implement"]',
  '    into: "harness/{id}/integration"', '    expect: pass',
  '    output: { writes: [dev/integration.md] }',
  '  - gate: human', '    reason: approve',
].join('\n') + '\n';

console.log('q0034 chore preflight');

await scenario('C1', 'a chore-shaped flow runs end to end: flow-created ranges defer to step time and the guard admits integration...implement', async () => {
  const { root, harnessDir, backlog, ticket } = fixture();
  write(path.join(harnessDir, 'flows', 'chore-shaped.yaml'), CHORE());
  // The integration branch exists before the run, created by hand from main — the same act
  // Q-0008's reflog records one minute before its chore run. The implement branch does not.
  git(root, 'branch', ticket.meta.branch, 'main');
  const flow = loadFlow(path.join(harnessDir, 'flows', 'chore-shaped.yaml'));

  const res = await env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () =>
    runFlow({ flow, ticket, backlog, harnessDir, repoDir: root, config: {}, ui: silent, auto: true }));

  assert.equal(res.status, 'completed', 'the chore-shaped flow must complete');
  assert.equal(backlog.read(ticket.meta.id).meta.stage, 'reviewed');
  const review = fs.readFileSync(path.join(ticket.dir, 'review', 'chore-iter-1.md'), 'utf8');
  assert.ok(review.length > 0, 'the review step ran and wrote its report');
});

await scenario('C1b', 'a dry run of the chore-shaped flow previews without demanding branches only a real run creates', async () => {
  const { root, harnessDir, backlog, ticket } = fixture();
  write(path.join(harnessDir, 'flows', 'chore-shaped.yaml'), CHORE());
  git(root, 'branch', ticket.meta.branch, 'main');
  const flow = loadFlow(path.join(harnessDir, 'flows', 'chore-shaped.yaml'));
  const before = fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8');

  const res = await runFlow({ flow, ticket: backlog.read(ticket.meta.id), backlog, harnessDir, repoDir: root, config: {}, ui: silent, dry: true });

  assert.equal(res.status, 'completed');
  assert.equal(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8'), before, 'dry run mutated the ticket');
  assert.equal(backlog.read(ticket.meta.id).meta.stage, 'requirements');
});

await scenario('C2', 'the preflight still fails before any step for a pre-existing-ref range with a missing endpoint', async () => {
  const { root, harnessDir, backlog, ticket } = fixture();
  // Review-flow shape: base...integration, integration deliberately absent. The implement step
  // would run first — the preflight must fail before it can be billed. Written as {base} rather
  // than a literal "main" since Q-0035: the lint rule wants the placeholder, and the interpolated
  // range — and therefore everything this scenario asserts — is identical either way.
  write(path.join(harnessDir, 'flows', 'chore-shaped.yaml'), CHORE('{base}...harness/{id}/integration'));
  const flow = loadFlow(path.join(harnessDir, 'flows', 'chore-shaped.yaml'));

  const err = await env({ MOCK_ALWAYS_PASS: '1', MOCK_ALWAYS_FAIL: null }, () =>
    runFlow({ flow, ticket, backlog, harnessDir, repoDir: root, config: {}, ui: silent, auto: true })).then(() => null, (e) => e);

  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  assert.match(err.message, /review requires an integrated branch/);
  assert.ok(!fs.existsSync(path.join(ticket.dir, 'dev', 'implement-report.md')),
    'the implement step ran before the preflight refused — an adapter was billed against bad evidence');
});

await scenario('C3', 'the guard still rejects a range aimed at refs unrelated to the ticket', async () => {
  const { root, harnessDir, backlog, ticket } = fixture();
  git(root, 'branch', ticket.meta.branch, 'main');
  git(root, 'branch', 'some/other-branch', 'main');
  const file = path.join(harnessDir, 'flows', 'chore-shaped.yaml');
  write(file, CHORE('main...some/other-branch'));

  // Since Q-0035 this range is caught statically too, so loadFlow never returns it — which is the
  // improvement, not a regression. The flow is therefore parsed without linting, so that the
  // engine's own runtime guard is still the thing under test here; the lint layer is asserted
  // separately, immediately below and in q0035-empty-range.js.
  assert.throws(() => loadFlow(file), /input\.diff must be two/, 'harness lint must reject it before the run starts');
  const flow = { ...YAML.parse(fs.readFileSync(file, 'utf8')), file };

  const err = await runFlow({ flow, ticket, backlog, harnessDir, repoDir: root, config: {}, ui: silent, auto: true })
    .then(() => null, (e) => e);

  assert.ok(err instanceof FlowError, `expected a FlowError, got ${err?.constructor?.name}: ${err?.message}`);
  assert.match(err.message, /must relate the configured base or this ticket's own branches/);
});

if (failed) { console.error(`\n✗ ${failed} scenario(s) failed`); process.exit(1); }
console.log('\n✓ 4 scenarios passed');
