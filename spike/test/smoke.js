// End-to-end smoke test with the mock adapter: init → ticket → requirements → solutioning,
// exercising a parallel group, a verdict-driven backward edge, gates, worktrees and stage transitions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'harness.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-smoke-'));
const run = (args, env = {}) => {
  const r = spawnSync('node', [bin, ...args], { cwd: tmp, encoding: 'utf8', env: { ...process.env, ...env } });
  process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr);
  return r;
};
const assert = (cond, msg) => { if (!cond) { console.error('✗ ' + msg); process.exit(1); } console.log('✓ ' + msg); };

execSync('git init -q && git -c user.email=a@b -c user.name=t commit -q --allow-empty -m init', { cwd: tmp });
assert(run(['init']).status === 0, 'init');
{ const hy = path.join(tmp, 'harness/harness.yaml'); fs.writeFileSync(hy, fs.readFileSync(hy, 'utf8').replace(/test: npm test.*/, 'test: sh tests/check.sh')); }
assert(run(['lint']).status === 0, 'lint passes on shipped flows');
assert(run(['ticket', 'new', 'Subscription downgrade mid-cycle', '--intent', 'Clinics can downgrade mid-cycle. Define proration.', '--owner', 'ruud']).status === 0, 'ticket created');

const td = fs.readdirSync(path.join(tmp, 'backlog'))[0];
const ticket = () => fs.readFileSync(path.join(tmp, 'backlog', td, 'ticket.md'), 'utf8');
assert(ticket().includes('stage: draft'), 'ticket starts at draft');

// Wrong stage is refused
assert(run(['run', 'solutioning', 'T-0001', '--adapter', 'mock', '--auto']).status !== 0, 'refuses flow whose consumes != ticket stage');

// Requirements: parallel PMs, head-of-product verdict (mock fails once → loops once → passes), gate auto
let r = run(['run', 'requirements', 'T-0001', '--adapter', 'mock', '--auto']);
assert(r.status === 0, 'requirements flow completes');
assert(fs.existsSync(path.join(tmp, 'backlog', td, 'requirements/candidate-claude.md')) && fs.existsSync(path.join(tmp, 'backlog', td, 'requirements/candidate-codex.md')), 'both PM candidates written');
assert(fs.existsSync(path.join(tmp, 'backlog', td, 'requirements/merged.md')), 'merged requirement written');
assert(ticket().includes('stage: requirements'), 'stage advanced to requirements');
assert(/head-of-product: 1/.test(ticket()), 'backward edge counter persisted (needs-input → retry once)');

// Solutioning: architect in worktree, reviewer revise→approve loop, finalize
r = run(['run', 'solutioning', 'T-0001', '--adapter', 'mock', '--auto']);
assert(r.status === 0, 'solutioning flow completes');
assert(r.stdout.includes('iteration 1/2 → goto architect'), 'review loop bounced back to architect once');
assert(fs.existsSync(path.join(tmp, 'backlog', td, 'solution/solution.md')), 'solution.md written');
assert(ticket().includes('stage: solutioned'), 'stage advanced to solutioned');
const wt = execSync('git worktree list', { cwd: tmp, encoding: 'utf8' });
assert(wt.includes('harness/T-0001/contracts'), 'architect ran in its own worktree/branch');
assert(execSync('git status --porcelain', { cwd: tmp, encoding: 'utf8' }).split('\n').every((l) => !l || l.includes('backlog') || l.includes('harness/') ), 'user working tree untouched except backlog/');

assert(fs.existsSync(path.join(tmp, 'backlog', td, 'solution/tasks.yaml')), 'tasks.yaml emitted');
assert(execSync('git log --oneline harness/T-0001/integration -- contracts', { cwd: tmp, encoding: 'utf8' }).length > 0, 'contracts merged into ticket branch');

// qa-red: QA writes tests in a worktree; prove-red integrates and expects the suite to FAIL
r = run(['run', 'qa-red', 'T-0001', '--adapter', 'mock', '--auto']);
assert(r.status === 0, 'qa-red flow completes');
assert(r.stdout.includes('red as expected'), 'suite proven red on the ticket branch');
assert(ticket().includes('stage: red'), 'stage advanced to red');

// development: fan-out by role in dependency waves, integrate, tests green; flaky dev forces one scoped retry
r = run(['run', 'development', 'T-0001', '--adapter', 'mock', '--auto'], { MOCK_DEV_FLAKY: '1' });
assert(r.status === 0, 'development flow completes');
assert(r.stdout.includes('2 task(s) in 2 wave(s)'), 'tasks fanned out in dependency waves');
assert(r.stdout.includes('tests exit 1, expected pass') && r.stdout.includes('scoped to failing tasks'), 'failed integration re-ran fan-out scoped to failing tasks');
assert(r.stdout.includes('tests green'), 'integrated branch is green');
assert(ticket().includes('stage: green'), 'stage advanced to green');
const tree = execSync('git ls-tree -r --name-only harness/T-0001/integration', { cwd: tmp, encoding: 'utf8' });
assert(tree.includes('src/T-0001.1.ts') && tree.includes('src/T-0001.2.ts') && tree.includes('tests/check.sh') && tree.includes('contracts/ProrationService.ts'), 'ticket branch holds contracts, tests and both implementations');
assert(!fs.existsSync(path.join(tmp, 'src')), 'user working tree still untouched');

// Exhausted loop lands on a gate; --auto advances it
r = run(['ticket', 'new', 'Second ticket']);
r = run(['run', 'requirements', 'T-0002', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' });
assert(r.stdout.includes('loop exhausted'), 'exhausted loop reaches a human gate');

assert(run(['board']).stdout.includes('T-0001'), 'board lists tickets');

// BYOS guard: an API key in the environment is refused *before* the CLI is probed, so a CLI that
// is missing on this machine cannot mask the key (found by the Q-0001 probe, 2026-08-22).
{
  const keys = { ANTHROPIC_API_KEY: 'sk-smoke', OPENAI_API_KEY: 'sk-smoke', CODEX_API_KEY: 'sk-smoke' };
  const out = run(['adapters'], keys).stdout;
  assert(/claude: ANTHROPIC_API_KEY is set/.test(out), 'claude adapter refuses an API key regardless of CLI presence');
  assert(/codex: CODEX_API_KEY\/OPENAI_API_KEY is set/.test(out), 'codex adapter refuses an API key regardless of CLI presence');
}

// A failing branch of a parallel group must not discard the siblings' finished work, and the
// failed run must still be recorded on the ticket (found by the Q-0001 run, 2026-08-22).
{
  run(['ticket', 'new', 'Parallel failure']);
  const dir = fs.readdirSync(path.join(tmp, 'backlog')).find((d) => d.startsWith('T-0003'));
  const r3 = run(['run', 'requirements', 'T-0003', '--adapter', 'mock', '--auto'], { MOCK_FAIL_WRITE: 'candidate-claude.md' });
  const at = (rel) => path.join(tmp, 'backlog', dir, rel);
  assert(r3.status !== 0, 'a failed parallel branch fails the run');
  assert(fs.existsSync(at('requirements/candidate-codex.md')), 'surviving parallel sibling keeps its output');
  assert(!fs.existsSync(at('requirements/candidate-claude.md')), 'failed parallel sibling wrote nothing');
  assert(/ failed /.test(fs.readFileSync(at('runs.log'), 'utf8')), 'failed run is recorded in runs.log');
  assert(fs.readFileSync(at('ticket.md'), 'utf8').includes('stage: draft'), 'failed run does not advance the stage');
}

// Auth failures are translated into one actionable line instead of a vendor stack trace.
{
  const { authError, probeAdapter } = await import('../src/adapters/index.js');
  const { mockAdapter } = await import('../src/adapters/mock.js');
  const real = 'ERROR codex_login::auth::manager: Failed to refresh token: Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.';
  assert(/codex logout && codex login/.test(authError('codex', real) ?? ''), 'codex auth failure becomes an actionable message');
  assert(authError('claude', 'Error: 401 Unauthorized') !== null, 'claude 401 is recognised as an auth failure');
  assert(authError('codex', 'codex exited 1: compile error in foo.ts') === null, 'a non-auth failure is left alone');

  // A model the subscription cannot use is a 400, not an auth failure; say which is which.
  const modelErr = `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.2-codex' model is not supported when using Codex with a ChatGPT account."}}`;
  const translated = authError('codex', modelErr) ?? '';
  assert(/gpt-5\.2-codex/.test(translated) && /ChatGPT subscription/.test(translated), 'unsupported-model error names the model and the subscription');
  assert(!/log ?out/i.test(translated), 'unsupported-model error does not tell the user to re-login');

  assert((await probeAdapter(mockAdapter())).ok === true, 'probe succeeds on a working adapter');
  const broken = { vendor: 'codex', async check() { return 'x'; }, async run() { throw new Error(real); } };
  const p = await probeAdapter(broken);
  assert(p.ok === false && /logout/.test(p.error), 'probe reports an unusable login rather than claiming ✓');
}

// No shipped flow or role may pin a vendor model name: they go stale, and a name that works on
// an API key can be rejected on a subscription (Q-0001, codex 0.149.0 rejected every gpt-5*).
{
  const tplRoot = path.join(root, 'templates', 'harness');
  const files = [...fs.readdirSync(path.join(tplRoot, 'flows')).map((f) => path.join(tplRoot, 'flows', f)),
                 ...fs.readdirSync(path.join(tplRoot, 'roles')).map((f) => path.join(tplRoot, 'roles', f))];
  const offenders = files.filter((f) => /^\s*model:\s*gpt-/m.test(fs.readFileSync(f, 'utf8'))).map((f) => path.basename(f));
  assert(offenders.length === 0, `no shipped template pins a codex model name (${offenders.join(', ') || 'none'})`);
}

// A role's default model must not leak to a step running on a different vendor's adapter.
{
  const { resolveModel } = await import('../src/engine.js');
  const role = { meta: { adapter: 'claude', model: 'opus' } };
  assert(resolveModel({}, role, 'claude') === 'opus', 'role model applies on its own vendor');
  assert(resolveModel({}, role, 'codex') === undefined, 'role model does not leak to another vendor');
  assert(resolveModel({ model: 'x' }, role, 'codex') === 'x', 'an explicit step model always wins');
}

console.log('\nall good — ' + tmp);
