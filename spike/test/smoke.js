// End-to-end smoke test with the mock adapter: init → ticket → requirements → solutioning,
// exercising a parallel group, a verdict-driven backward edge, gates, worktrees and stage transitions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawnSync, spawn } from 'node:child_process';
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
// This fixture repo is not a node project, so point both commands at something it can run. The
// install command writes a marker, which lets the assertions below prove it ran in the
// integration worktree and ran *before* the tests.
{
  const hy = path.join(tmp, 'harness/harness.yaml');
  fs.writeFileSync(hy, fs.readFileSync(hy, 'utf8')
    .replace(/install: npm install.*/, 'install: sh -c "date > .installed"')
    .replace(/test: npm test.*/, 'test: sh tests/check.sh'));
}
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
const solutioningOut = r.stdout;   // reused far below for the base-sync reporting checks
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
// The integrate step must prepare the worktree before testing it: a fresh checkout has no
// dependencies, and a suite that cannot start would otherwise satisfy expect: fail (Q-0004).
assert(fs.existsSync(path.join(tmp, '.harness/worktrees/harness__T-0001__integration/.installed')),
  'integrate runs commands.install in the integration worktree before the tests');

// An exhausted loop lands on a human-locked gate that --auto may NOT walk through. This check
// used to assert the opposite and passed only because closed stdin resolved as '' → advance —
// two bugs cancelling out. Removing the defaulting turned it into a 24-minute hang (Q-0011).
r = run(['ticket', 'new', 'Second ticket']);
r = run(['run', 'requirements', 'T-0002', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' });
assert(r.stdout.includes('loop exhausted'), 'exhausted loop reaches a gate');
assert(r.stdout.includes('human-locked'), '--auto does not bypass the exhaustion gate');
assert(r.status !== 0, 'a gate with no answer available fails the run');
assert(/stdin closed without one/.test(r.stdout + r.stderr), 'the run says which gate it could not answer, instead of hanging or assuming');
assert(!/gate: auto-advanced \(human-locked\)/.test(r.stdout), 'a human-locked gate is never auto-advanced');

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

  // Money spent by a step that then failed still has to appear in the run's cost.
  const log3 = fs.readFileSync(at('runs.log'), 'utf8');
  assert(/step=pm-claude .*FAILED cost=0\.07/.test(log3), 'a failed step records what it cost');
  const failLine = log3.split('\n').find((l) => / failed /.test(l)) ?? '';
  const runCost = Number((failLine.match(/cost=([\d.]+)/) ?? [])[1] ?? 0);
  assert(runCost >= 0.07, `failed run's cost includes the failed step (saw ${runCost})`);

  // A failed run writes no history entry, so the next run must not reuse its id.
  run(['run', 'requirements', 'T-0003', '--adapter', 'mock', '--auto']);
  const ids = [...fs.readFileSync(at('runs.log'), 'utf8').matchAll(/\brun=(\d+) flow=/g)].map((m) => m[1]);
  assert(new Set(ids).size === ids.length, `each run attempt gets its own id (saw ${ids.join(', ')})`);
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

  // claude reports failure inside the envelope on stdout, with stderr empty — and can set
  // is_error while exiting 0. Deciding on the exit code alone loses the message entirely.
  const { claudeAdapter } = await import('../src/adapters/claude.js');
  let stubN = 0;
  // A fake CLI on disk, so the real spawn/parse path runs and production code needs no seam.
  const claudeStub = (code, stdout) => {
    const p = path.join(tmp, `fake-claude-${stubN++}.sh`);
    fs.writeFileSync(p, `#!/bin/sh\ncat <<'QEOF'\n${stdout}\nQEOF\nexit ${code}\n`, { mode: 0o755 });
    return claudeAdapter({ bin: p });
  };
  const envelope = (o) => JSON.stringify(o);
  const cases = [
    ['exit 1 with the reason only in the envelope', 1, envelope({ is_error: true, subtype: 'error_max_turns', result: 'reached the turn limit', total_cost_usd: 4.54 }), /error_max_turns.*turn limit/s],
    ['is_error: true while exiting 0', 0, envelope({ is_error: true, result: 'overloaded', total_cost_usd: 4.54 }), /overloaded/],
    ['nothing on either stream', 1, '', /no output on stderr or stdout/],
  ];
  for (const [label, code, stdout, expected] of cases) {
    let caught = null;
    try { await claudeStub(code, stdout).run({ prompt: 'x', schema: { type: 'object', properties: {}, required: [] }, cwd: tmp }); } catch (e) { caught = e; }
    assert(caught !== null && expected.test(caught.message), `claude surfaces: ${label} (got ${caught?.message?.slice(0, 90)})`);
    if (stdout) assert(caught.usage?.cost_usd === 4.54, `a failed claude step carries its cost: ${label}`);
  }
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

// `retry` at an exhaustion gate authorises EXACTLY one more traversal, and only for that loop.
// The retry's own goto is the grace traversal, so the next failure re-presents the gate
// (DECISIONS 2026-08-22, correcting an off-by-one caught by the Q-0006 reviewer).
{
  const id = run(['ticket', 'new', 'Retry semantics']).stdout.match(/T-\d{4}/)[0];
  const dir = fs.readdirSync(path.join(tmp, 'backlog')).find((d) => d.startsWith(id));
  const at = (rel) => path.join(tmp, 'backlog', dir, rel);
  // Pre-seed an unrelated counter: a review retry must not refund a ticket's qa budget.
  const before = fs.readFileSync(at('ticket.md'), 'utf8').replace('iterations: {}', 'iterations:\n  qa-final.unrelated: 2');
  fs.writeFileSync(at('ticket.md'), before);

  // Non-interactive gates are answered explicitly. The first gate consumes retry; with no
  // second answer available, the process exits by itself when the gate is presented again.
  const child = spawnSync('node', [bin, 'run', 'requirements', id, '--adapter', 'mock', '--gate-answer', 'retry'],
    { cwd: tmp, stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, MOCK_ALWAYS_FAIL: '1' }, timeout: 25000 });
  assert(child.status !== 0, 'the unanswered second exhaustion gate exits non-zero');
  const log = () => (fs.existsSync(at('runs.log')) ? fs.readFileSync(at('runs.log'), 'utf8') : '');

  const runsLog = log();
  // hof runs once, loops once (its whole budget), hits the gate; retry buys exactly one more and
  // the gate returns. A fourth traversal would mean retry handed back the whole budget.
  const traversals = (runsLog.match(/step=head-of-product/g) ?? []).length;
  assert(traversals === 3, `retry grants exactly one more traversal, no more (saw ${traversals}, expected 3)`);
  assert(/gate=retry counter=requirements\.head-of-product set=1/.test(runsLog), 'the retry grant is recorded in runs.log');
  const after = fs.readFileSync(at('ticket.md'), 'utf8');
  assert(/requirements\.head-of-product: 2/.test(after), 'the retried loop ends one past its limit, not reset to zero');
  assert(/qa-final\.unrelated: 2/.test(after), 'a retry does not refund an unrelated loop’s budget');
}

// Interrupting a run at a gate must record the outcome and persist counters. Otherwise Ctrl-C is
// an undocumented way to hand back the iteration budget and retry forever (found by Q-0004).
{
  const id = run(['ticket', 'new', 'Interrupted at a gate']).stdout.match(/T-\d{4}/)[0];
  const dir = fs.readdirSync(path.join(tmp, 'backlog')).find((d) => d.startsWith(id));
  const at = (rel) => path.join(tmp, 'backlog', dir, rel);
  // No --auto, so it stops at the flow's closing gate and waits on stdin.
  const child = spawn('node', [bin, 'run', 'requirements', id, '--adapter', 'mock'], { cwd: tmp, stdio: ['pipe', 'pipe', 'pipe'] });
  const deadline = Date.now() + 20000;
  const waitFor = (test) => {
    while (Date.now() < deadline) {
      if (fs.existsSync(at('runs.log')) && test(fs.readFileSync(at('runs.log'), 'utf8'))) return true;
      execSync('sleep 0.2');
    }
    return false;
  };
  const reached = waitFor((log) => /step=head-of-product/.test(log));
  assert(reached, 'the interrupt fixture reaches the gate');
  child.kill('SIGINT');
  const recorded = waitFor((log) => / interrupted /.test(log));
  child.kill('SIGKILL');   // belt and braces; the process should already be gone
  assert(recorded, 'an interrupted run is recorded in runs.log');
  const ticket4 = fs.readFileSync(at('ticket.md'), 'utf8');
  assert(ticket4.includes('stage: draft'), 'an interrupted run does not advance the stage');
  assert(/requirements\.head-of-product: \d/.test(ticket4), 'an interrupted run persists its counters instead of refunding them');
}

// A bounded loop that never shows its verdict to the step it returns to cannot converge. qa-red
// shipped that way: scenario-review looped to scenarios, neither step received the review, and a
// round cost $4.45 re-reviewing a file write-tests had not changed because it never knew why (Q-0011).
{
  const { lintFlow, FlowError } = await import('../src/engine.js');
  const blind = {
    name: 'blind', consumes: 'a', produces: 'b',
    steps: [
      { id: 'author', role: 'r', adapter: 'claude', input: { backlog: ['spec.md'] }, output: { write: 'draft.md' } },
      { id: 'judge', role: 'r', adapter: 'codex', input: { backlog: ['draft.md'] }, output: { write: 'review.md', verdict: 'ok|no' },
        on_fail: { goto: 'author', max_iterations: 2, on_exhausted: 'gate' } },
    ],
  };
  let err = null;
  try { lintFlow(blind); } catch (e) { err = e; }
  assert(err instanceof FlowError && /loop cannot converge/.test(err.message), 'a loop that hides its verdict from the step it returns to fails lint');
  assert(/never receives review\.md/.test(err.message), 'the lint names the artifact that never arrives');

  blind.steps[0].input.backlog.push('review.md');
  assert(lintFlow(blind) === true, 'feeding the verdict back makes the loop lintable');

  // A fan-out target is exempt: the engine hands it the integration result directly.
  const fanned = {
    name: 'fanned', consumes: 'a', produces: 'b',
    steps: [
      { id: 'devs', fan_out: { from: 'tasks.yaml' }, step: { id: 'x', role: 'r' } },
      { id: 'integrate', type: 'integrate', branches: ['b'], output: { writes: ['report.md'] },
        on_fail: { goto: 'devs', max_iterations: 2, on_exhausted: 'gate' } },
    ],
  };
  assert(lintFlow(fanned) === true, 'a fan-out target is exempt — the engine feeds it the result');
}

// "could not sync base:" with nothing after the colon reported a failure and withheld the reason.
// Two causes: a merge that fails without conflicting, and a base branch that does not exist yet —
// which is normal on a ticket's first pass and not a failure at all (Q-0011).
{
  const { mergeFailure } = await import('../src/engine.js');
  assert(/conflicts: a\.md, b\.md/.test(mergeFailure({ conflicts: ['a.md', 'b.md'] })), 'conflicts are listed when there are any');
  assert(/git: fatal: invalid reference/.test(mergeFailure({ conflicts: [], error: '\nfatal: invalid reference: main\n' })), "git's own words are used when nothing conflicted");
  assert(mergeFailure({ conflicts: [] }) === 'git reported no reason', 'a failure with no reason says so instead of trailing off');
  assert(mergeFailure(undefined) === 'git reported no reason', 'a missing result does not crash the reporter');

  // End to end: solutioning loops the architect, so its second round syncs to the ticket branch
  // that the first integrate step has not created yet — the exact case that printed the empty
  // warning on every Q-0011 run.
  const sol = solutioningOut;
  assert(/does not exist yet — nothing to sync/.test(sol), 'a base branch that does not exist yet is stated, not warned about');
  assert(!/could not sync/.test(sol), 'no sync warning is raised when there was nothing to sync');
  assert(!/(could not sync|CONFLICT|FAILED)[^\n]*[—:]\s*$/m.test(sol), 'no failure is ever reported with an empty reason');
}

// A base-sync conflict cannot be fixed by re-running the developers — their worktrees branch from
// the ticket branch, where nothing is wrong. Q-0011 burned all three iterations and $8.63 learning
// that, because integrate routed it into on_fail like any test failure.
{
  const id = run(['ticket', 'new', 'Base conflict']).stdout.match(/T-\d{4}/)[0];
  const dir = fs.readdirSync(path.join(tmp, 'backlog')).find((d) => d.startsWith(id));
  const at = (rel) => path.join(tmp, 'backlog', dir, rel);

  // Put the ticket branch and the base branch in genuine conflict over one file.
  const branch = `harness/${id}/integration`;
  const cur = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmp, encoding: 'utf8' }).trim();
  execSync(`git checkout -q -b ${branch} && echo ticket-side > clash.txt && git add clash.txt && git -c user.email=a@b -c user.name=t commit -q -m ticket`, { cwd: tmp });
  execSync(`git checkout -q ${cur} && echo base-side > clash.txt && git add clash.txt && git -c user.email=a@b -c user.name=t commit -q -m base`, { cwd: tmp });

  const hy = path.join(tmp, 'harness/harness.yaml');
  const savedCfg = fs.readFileSync(hy, 'utf8');
  fs.writeFileSync(hy, savedCfg.replace(/base_branch: .*/, `base_branch: ${cur}`));

  // input.backlog carries its own report so the convergence lint is satisfied — this fixture is
  // about the base conflict, not about a blind loop.
  fs.writeFileSync(path.join(tmp, 'harness/flows/base-clash.yaml'), `name: base-clash\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: integrate\n    type: integrate\n    branches: ["${branch}"]\n    into: "${branch}"\n    input: { backlog: [dev/integration.md] }\n    output: { writes: [dev/integration.md] }\n    on_fail: { goto: integrate, max_iterations: 3, on_exhausted: gate }\n`);

  const bc = run(['run', 'base-clash', id, '--adapter', 'mock', '--auto']);
  assert(bc.status !== 0, 'a base-sync conflict fails the run');
  assert(/cannot sync .* with /.test(bc.stdout + bc.stderr), 'the failure names the two branches that disagree');
  assert(/re-running the developers cannot fix it/.test(bc.stdout + bc.stderr), 'it says why looping would not help');
  assert(!/iteration 1\/3/.test(bc.stdout), 'a base conflict does not consume the iteration budget');
  assert(/base-conflict base=/.test(fs.readFileSync(at('runs.log'), 'utf8')), 'the base conflict is distinguishable in runs.log');

  fs.writeFileSync(hy, savedCfg);
  fs.rmSync(path.join(tmp, 'harness/flows/base-clash.yaml'));
  execSync(`git checkout -q ${cur} -- clash.txt || true`, { cwd: tmp });
}

// A worktree is a full checkout, so backlog/ sits in every step's working directory. An agent
// editing a ticket there can rewrite engine-owned state — stage, counters, history, cost — and
// commit it to a branch that later merges back. Q-0011's architect reset iterations to {} and
// deleted three history entries; a merge conflict caught it, which is luck, not design.
{
  const { commitAll } = await import('../src/fanout.js');
  const wt = path.join(tmp, '.harness/worktrees/harness__T-0001__contracts');
  if (fs.existsSync(wt)) {
    // Set up the real-world shape: a ticket tracked on the branch, as it is in a live repo.
    const dir = path.join(wt, 'backlog', td);
    fs.mkdirSync(dir, { recursive: true });
    const ticketInWt = path.join(dir, 'ticket.md');
    const before = '---\nid: T-0001\nstage: solutioned\niterations:\n  solutioning.review: 2\n---\nintent\n';
    fs.writeFileSync(ticketInWt, before);
    execSync(`git add -A -- backlog && git -c user.email=a@b -c user.name=t commit -q -m setup`, { cwd: wt });

    // Now an agent rewrites engine-owned frontmatter and drops a stray file beside it.
    fs.writeFileSync(ticketInWt, before.replace('stage: solutioned', 'stage: deployed').replace('  solutioning.review: 2\n', ''));
    fs.writeFileSync(path.join(dir, 'sneaked.md'), 'written by an agent\n');
    fs.mkdirSync(path.join(wt, 'src'), { recursive: true });
    fs.writeFileSync(path.join(wt, 'src', 'legit.ts'), 'export const ok = true;\n');

    const dropped = [];
    // The message is an agent's step summary — untrusted text on a command line. Backticks in one
    // crashed a real run (Q-0011); $(…) would have been executed rather than committed.
    const nasty = 'write-tests: Created `spike/test/q0011.js` $(touch /tmp/quorum-pwned) "quoted" \\backslash [Q-0011]';
    const files = commitAll(wt, nasty, (d) => dropped.push(...d));
    assert(!fs.existsSync('/tmp/quorum-pwned'), 'a commit message never reaches a shell');
    assert(execSync('git log -1 --pretty=%s', { cwd: wt, encoding: 'utf8' }).trim() === nasty, 'the message is committed verbatim, backticks and all');

    assert(dropped.length >= 2, `backlog edits are reported, not silently dropped (${dropped.length})`);
    assert(fs.readFileSync(ticketInWt, 'utf8') === before, 'an agent cannot rewrite engine-owned ticket state from a worktree');
    assert(!fs.existsSync(path.join(wt, 'backlog', td, 'sneaked.md')), 'a file an agent adds under backlog/ is removed, not committed');
    assert((files ?? []).every((f) => !f.startsWith('backlog/')), 'nothing under backlog/ is committed from a worktree');
    assert((files ?? []).some((f) => f.endsWith('legit.ts')), 'work outside backlog/ still commits normally');
    // A left-behind dirty backlog would break the next merge, so the worktree must come back clean.
    assert(!execSync('git status --porcelain -- backlog', { cwd: wt, encoding: 'utf8' }).trim(), 'the worktree is left clean under backlog/');
  }
}

// architecture.md's role table is the fan-out write contract, and it says frontmatter and prose
// "must agree so tooling can validate them". Nothing validated it, so developer-tooling.md existed
// on disk while being invisible to the architect, and every Q-0033 task went to backend by
// default — a single-vendor fan-out where the whole point is two (Q-0011, 2026-08-23).
{
  const repo = path.join(root, '..');
  const arch = path.join(repo, 'harness', 'architecture.md');
  if (fs.existsSync(arch)) {                       // repo-consistency check; skipped in a fixture
    const rows = [...fs.readFileSync(arch, 'utf8').matchAll(/^\| (\w+) \| (\w+) \| ([^|]+)\|/gm)]
      .filter(([, role]) => !['role'].includes(role));
    assert(rows.length >= 2, `the role table has rows (found ${rows.length})`);

    for (const [, role, vendor, dirs] of rows) {
      const file = path.join(repo, 'harness', 'roles', `developer-${role}.md`);
      assert(fs.existsSync(file), `role table row "${role}" has a role file`);
      const text = fs.readFileSync(file, 'utf8');
      assert(new RegExp(`^adapter:\\s*${vendor}$`, 'm').test(text), `developer-${role} runs on the vendor the table names (${vendor})`);

      const declared = (text.match(/^paths:\s*\[(.+)\]$/m) ?? [])[1];
      assert(declared, `developer-${role} declares paths in frontmatter`);
      const tabled = dirs.split(',').map((d) => d.replace(/`/g, '').trim().replace(/\/$/, '')).sort();
      const front = declared.split(',').map((d) => d.trim().replace(/\/$/, '')).sort();
      assert(JSON.stringify(front) === JSON.stringify(tabled),
        `developer-${role} frontmatter matches the table (${front.join()} vs ${tabled.join()})`);
      // The engine never reads `paths`; the allow-list only reaches an agent through the prose.
      for (const dir of front) {
        assert(text.includes(dir), `developer-${role} prose names its allowed path ${dir}`);
      }
    }
    // Two live roles on two vendors, or a fan-out can never be multi-vendor.
    const vendors = new Set(rows.map(([, , v]) => v));
    assert(vendors.size >= 2, `the role table spans more than one vendor (${[...vendors].join()})`);
  }
}

// A dropped connection is not a verdict. Losing a paid step to a minute of bad wifi is what
// killed Q-0006 run 7 — the network went away mid-response and took a $0.35 step with it.
{
  const { withRetry, transientError } = await import('../src/adapters/index.js');

  const retryable = [
    ['API Error: Connection closed mid-response. The response above may be incomplete.', /closed mid-response/],
    ['Error: socket hang up', /hung up/],
    ['FetchError: request failed, reason: ECONNRESET', /network error/],
    ['529 overloaded_error: Overloaded', /overload/],
    ['429 rate_limit_error', /rate limit/],
  ];
  for (const [msg, expected] of retryable) {
    const d = transientError(msg);
    assert(d !== null && expected.test(d), `worth retrying: ${msg.slice(0, 40)}`);
  }
  // Deterministic failures must NOT be retried — the same answer costs the same money again.
  for (const msg of [
    'ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only',
    "codex: model \"gpt-5\" is not available on a ChatGPT subscription",
    'claude failed (exit 1, error_max_turns): reached the turn limit',
    'Invalid schema for response_format: additionalProperties is required',
  ]) {
    assert(transientError(msg) === null, `not worth retrying: ${msg.slice(0, 44)}`);
  }

  // The wrapper: fails twice with a transient error, then succeeds. Costs accumulate across
  // attempts, because every attempt was billed.
  let calls = 0;
  const flaky = {
    vendor: 'test',
    async run() {
      calls += 1;
      if (calls < 3) { const e = new Error('API Error: Connection closed mid-response'); e.usage = { input_tokens: 10, output_tokens: 1, cost_usd: 0.1 }; throw e; }
      return { vendor: 'test', output: { ok: true }, raw: '', usage: { input_tokens: 10, output_tokens: 1, cost_usd: 0.1 }, session: null, ms: 1 };
    },
  };
  const events = [];
  const res = await withRetry(flaky, { attempts: 3, baseDelayMs: 1 }).run({ onEvent: (e) => events.push(e) });
  assert(calls === 3 && res.output.ok === true, 'a transient failure is retried until it succeeds');
  assert(Math.abs(res.usage.cost_usd - 0.3) < 1e-9, 'the retried step reports what all its attempts cost');
  assert(events.filter((e) => e.type === 'retry').length === 2, 'each retry is announced rather than sitting silent');

  // Give up eventually, and say so.
  let tries = 0;
  const dead = { vendor: 'test', async run() { tries += 1; throw new Error('Error: socket hang up'); } };
  let caught = null;
  try { await withRetry(dead, { attempts: 3, baseDelayMs: 1 }).run({}); } catch (e) { caught = e; }
  assert(tries === 3 && /gave up after 3 attempts/.test(caught.message), 'retries are bounded and the give-up is explicit');

  // A deterministic failure is not retried even once.
  let authTries = 0;
  const badLogin = { vendor: 'test', async run() { authTries += 1; throw new Error('401 Unauthorized'); } };
  try { await withRetry(badLogin, { attempts: 3, baseDelayMs: 1 }).run({}); } catch { /* expected */ }
  assert(authTries === 1, 'a deterministic failure is not retried');
}

// `expect: fail` must not accept a suite that never started. A worktree has no node_modules, so
// without this a missing dependency proves "red" on every ticket, forever (found by Q-0004).
{
  const { environmentFailure } = await import('../src/engine.js');
  const notRed = [
    ["node:internal/modules/esm/resolve:264\nError: Cannot find package 'yaml' imported from /x/bin.js", /missing dependency "yaml"/],
    ['Error: Cannot find module \'./nope.js\'', /missing module "\.\/nope\.js"/],
    ['code: \'ERR_MODULE_NOT_FOUND\'', /could not be resolved/],
    ['/x/test.js:12\nSyntaxError: Unexpected token \'||\'', /does not parse/],
    ['sh: vitest: command not found', /not installed/],
  ];
  for (const [out, expected] of notRed) {
    const d = environmentFailure(out);
    assert(d !== null && expected.test(d), `a broken environment is not a red phase: ${out.split('\n').pop().slice(0, 44)}`);
  }
  // The other half matters more: a real failing suite must still count as red.
  const realRed = [
    'AssertionError [ERR_ASSERTION]: expected stage to be red\n  at Object.<anonymous>\n✗ 3 of 71 checks failed',
    '✗ init\nnpm ERR! Test failed.  See above for more details.',   // npm says ERR! on every failure
    'FAIL test/review.test.js\n  ● review flow › regresses the stage\n    expect(received).toBe(expected)',
  ];
  for (const out of realRed) {
    assert(environmentFailure(out) === null, `a genuine assertion failure is still red: ${out.split('\n')[0].slice(0, 44)}`);
  }

  // A suite is entitled to print these signatures. This very block does, and matching a test's
  // own pass message rejected a real red phase on Q-0006 run 6 — the detector failed on the
  // output of the tests written to prove it works.
  const inResultLines = [
    "✓ a broken environment is not a red phase: Error: Cannot find package 'yaml' imported from /x/bin.js",
    "\x1b[32m✓\x1b[0m handled: Cannot find module './nope.js'",
    'ok 4 - reports ERR_MODULE_NOT_FOUND',
    "1) rejects SyntaxError: Unexpected token '||'",
  ];
  for (const line of inResultLines) {
    assert(environmentFailure(`✓ setup\n${line}\n✓ done`) === null,
      `a signature quoted inside a test result is not an environment failure: ${line.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 40)}`);
  }
  // But the same signature on its own line — an actual crash — must still be caught.
  assert(environmentFailure("✓ setup\nnode:internal/modules/esm/resolve\nError: Cannot find package 'yaml' imported from /x/bin.js") !== null,
    'an unhandled crash is still an environment failure even after some checks passed');
}

// qa-red proves a red phase by writing NEW test files. A runner that does not discover them
// leaves the suite green and `integrate --expect fail` loops to a gate having proved nothing.
{
  const rdir = path.join(tmp, 'runner-check');
  fs.mkdirSync(rdir, { recursive: true });
  fs.copyFileSync(path.join(root, 'test', 'run.js'), path.join(rdir, 'run.js'));
  fs.writeFileSync(path.join(rdir, 'smoke.js'), 'process.exit(0);\n');
  const runner = () => spawnSync(process.execPath, [path.join(rdir, 'run.js')], { encoding: 'utf8' });
  assert(runner().status === 0, 'test runner exits 0 when every discovered file passes');

  fs.writeFileSync(path.join(rdir, 'new-red.js'), 'process.exit(1);\n');
  const red = runner();
  assert(red.status === 1, 'a newly added failing test file turns the suite red');
  assert(/new-red\.js/.test(red.stdout + red.stderr), 'the runner names the file that failed');

  fs.rmSync(path.join(rdir, 'new-red.js'));
  assert(runner().status === 0, 'the suite goes green again once the failing file is gone');
}

// Contracts must be executable, or qa-red's red phase is prose. checkAgainstSchema cannot express
// oneOf / if-then / format / nested required; the contract validator must (DECISIONS 2026-08-22).
{
  const { validate } = await import('../src/contracts.js');
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      stage: { type: 'string', enum: ['draft', 'requirements'] },
      history: {
        type: 'array',
        items: {
          type: 'object',
          required: ['run', 'at'],
          properties: { run: { type: 'integer' }, at: { type: 'string', format: 'date-time' }, cost: { type: 'number' } },
          additionalProperties: false,
        },
      },
    },
    required: ['stage'],
    additionalProperties: false,
  };
  const good = { stage: 'draft', history: [{ run: 1, at: '2026-08-22T16:51:48.368Z', cost: 4.146 }] };
  assert(validate(schema, good).ok, 'the contract validator accepts a conforming artifact');

  const cases = [
    [{}, /required property 'stage'/, 'missing required key'],
    [{ stage: 'nonsense' }, /must be equal to one of/, 'enum violation'],
    [{ stage: 'draft', extra: 1 }, /additionalProperty|must NOT have additional/, 'additionalProperties: false'],
    [{ stage: 'draft', history: [{ run: 1, at: 'yesterday' }] }, /format "date-time"/, 'format constraint'],
    [{ stage: 'draft', history: [{ run: 'one', at: '2026-08-22T00:00:00Z' }] }, /must be integer/, 'nested type'],
  ];
  for (const [data, expected, label] of cases) {
    const r = validate(schema, data);
    assert(!r.ok && expected.test(r.errors.join(' ')), `contract validator rejects: ${label} (${r.errors.join('; ') || 'accepted!'})`);
  }

  // And it has to be reachable from a qa-red script step, i.e. exit non-zero from the CLI.
  fs.writeFileSync(path.join(tmp, 'c.schema.json'), JSON.stringify(schema));
  fs.writeFileSync(path.join(tmp, 'good.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(tmp, 'bad.json'), JSON.stringify({ stage: 'nonsense' }));
  assert(run(['validate', 'c.schema.json', 'good.json']).status === 0, 'harness validate exits 0 on a conforming artifact');
  assert(run(['validate', 'c.schema.json', 'bad.json']).status === 1, 'harness validate exits 1 so a red test can fail on it');
}

// Tokens-only: a vendor that reports no cost is unpriced, not free. Rounding null to $0.000
// would state a price Quorum does not know (DECISIONS, 2026-08-22).
{
  const { formatCost } = await import('../src/engine.js');
  assert(formatCost({ cost_usd: 2.2056, input_tokens: 1, output_tokens: 2 }) === 'cost=$2.206', 'a priced step shows money');
  const unpriced = formatCost({ cost_usd: null, input_tokens: 71600, output_tokens: 4218 });
  assert(/n\/a/.test(unpriced) && /75818 tokens/.test(unpriced), 'an unpriced step shows tokens, not $0.000');
  assert(!/\$0\.000/.test(unpriced), 'an unpriced step is never displayed as free');
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
