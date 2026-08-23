# Test output

```

  "assert(/head-of-product: 1/.test(ticket()), 'backward edge counter persisted (needs-input → retry once)');\n" +
  '\n' +
  '// Solutioning: architect in worktree, reviewer revise→approve loop, finalize\n' +
  "r = run(['run', 'solutioning', 'T-0001', '--adapter', 'mock', '--auto']);\n" +
  'const solutioningOut = r.stdout;   // reused far below for the base-sync reporting checks\n' +
  "assert(r.status === 0, 'solutioning flow completes');\n" +
  "assert(r.stdout.includes('iteration 1/2 → goto architect'), 'review loop bounced back to architect once');\n" +
  "assert(fs.existsSync(path.join(tmp, 'backlog', td, 'solution/solution.md')), 'solution.md written');\n" +
  "assert(ticket().includes('stage: solutioned'), 'stage advanced to solutioned');\n" +
  "const wt = execSync('git worktree list', { cwd: tmp, encoding: 'utf8' });\n" +
  "assert(wt.includes('harness/T-0001/contracts'), 'architect ran in its own worktree/branch');\n" +
  "assert(execSync('git status --porcelain', { cwd: tmp, encoding: 'utf8' }).split('\\n').every((l) => !l || l.includes('backlog') || l.includes('harness/') ), 'user working tree untouched except backlog/');\n" +
  '\n' +
  "assert(fs.existsSync(path.join(tmp, 'backlog', td, 'solution/tasks.yaml')), 'tasks.yaml emitted');\n" +
  "assert(execSync('git log --oneline harness/T-0001/integration -- contracts', { cwd: tmp, encoding: 'utf8' }).length > 0, 'contracts merged into ticket branch');\n" +
  '\n' +
  '// qa-red: QA writes tests in a worktree; prove-red integrates and expects the suite to FAIL\n' +
  "r = run(['run', 'qa-red', 'T-0001', '--adapter', 'mock', '--auto']);\n" +
  "assert(r.status === 0, 'qa-red flow completes');\n" +
  "assert(r.stdout.includes('red as expected'), 'suite proven red on the ticket branch');\n" +
  "assert(ticket().includes('stage: red'), 'stage advanced to red');\n" +
  '\n' +
  '// development: fan-out by role in dependency waves, integrate, tests green; flaky dev forces one scoped retry\n' +
  "r = run(['run', 'development', 'T-0001', '--adapter', 'mock', '--auto'], { MOCK_DEV_FLAKY: '1' });\n" +
  "assert(r.status === 0, 'development flow completes');\n" +
  "assert(r.stdout.includes('2 task(s) in 2 wave(s)'), 'tasks fanned out in dependency waves');\n" +
  "assert(r.stdout.includes('tests exit 1, expected pass') && r.stdout.includes('scoped to failing tasks'), 'failed integration re-ran fan-out scoped to failing tasks');\n" +
  "assert(r.stdout.includes('tests green'), 'integrated branch is green');\n" +
  "assert(ticket().includes('stage: green'), 'stage advanced to green');\n" +
  "const tree = execSync('git ls-tree -r --name-only harness/T-0001/integration', { cwd: tmp, encoding: 'utf8' });\n" +
  "assert(tree.includes('src/T-0001.1.ts') && tree.includes('src/T-0001.2.ts') && tree.includes('tests/check.sh') && tree.includes('contracts/ProrationService.ts'), 'ticket branch holds contracts, tests and both implementations');\n" +
  "assert(!fs.existsSync(path.join(tmp, 'src')), 'user working tree still untouched');\n" +
  '// The integrate step must prepare the worktree before testing it: a fresh checkout has no\n' +
  '// dependencies, and a suite that cannot start would otherwise satisfy expect: fail (Q-0004).\n' +
  "assert(fs.existsSync(path.join(tmp, '.harness/worktrees/harness__T-0001__integration/.installed')),\n" +
  "  'integrate runs commands.install in the integration worktree before the tests');\n" +
  '\n' +
  '// An exhausted loop lands on a human-locked gate that --auto may NOT walk through. This check\n' +
  "// used to assert the opposite and passed only because closed stdin resolved as '' → advance —\n" +
  '// two bugs cancelling out. Removing the defaulting turned it into a 24-minute hang (Q-0011).\n' +
  "r = run(['ticket', 'new', 'Second ticket']);\n" +
  "r = run(['run', 'requirements', 'T-0002', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' });\n" +
  "assert(r.stdout.includes('loop exhausted'), 'exhausted loop reaches a gate');\n" +
  "assert(r.stdout.includes('human-locked'), '--auto does not bypass the exhaustion gate');\n" +
  "assert(r.status !== 0, 'a gate with no answer available fails the run');\n" +
  "assert(/stdin closed without one/.test(r.stdout + r.stderr), 'the run says which gate it could not answer, instead of hanging or assuming');\n" +
  "assert(!/gate: auto-advanced \\(human-locked\\)/.test(r.stdout), 'a human-locked gate is never auto-advanced');\n" +
  '\n' +
  "assert(run(['board']).stdout.includes('T-0001'), 'board lists tickets');\n" +
  '\n' +
  '// BYOS guard: an API key in the environment is refused *before* the CLI is probed, so a CLI that\n' +
  '// is missing on this machine cannot mask the key (found by the Q-0001 probe, 2026-08-22).\n' +
  '{\n' +
  "  const keys = { ANTHROPIC_API_KEY: 'sk-smoke', OPENAI_API_KEY: 'sk-smoke', CODEX_API_KEY: 'sk-smoke' };\n" +
  "  const out = run(['adapters'], keys).stdout;\n" +
  "  assert(/claude: ANTHROPIC_API_KEY is set/.test(out), 'claude adapter refuses an API key regardless of CLI presence');\n" +
  "  assert(/codex: CODEX_API_KEY\\/OPENAI_API_KEY is set/.test(out), 'codex adapter refuses an API key regardless of CLI presence');\n" +
  '}\n' +
  '\n' +
  "// A failing branch of a parallel group must not discard the siblings' finished work, and the\n" +
  '// failed run must still be recorded on the ticket (found by the Q-0001 run, 2026-08-22).\n' +
  '{\n' +
  "  run(['ticket', 'new', 'Parallel failure']);\n" +
  "  const dir = fs.readdirSync(path.join(tmp, 'backlog')).find((d) => d.startsWith('T-0003'));\n" +
  "  const r3 = run(['run', 'requirements', 'T-0003', '--adapter', 'mock', '--auto'], { MOCK_FAIL_WRITE: 'candidate-claude.md' });\n" +
  "  const at = (rel) => path.join(tmp, 'backlog', dir, rel);\n" +
  "  assert(r3.status !== 0, 'a failed parallel branch fails the run');\n" +
  "  assert(fs.existsSync(at('requirements/candidate-codex.md')), 'surviving parallel sibling keeps its output');\n" +
  "  assert(!fs.existsSync(at('requirements/candidate-claude.md')), 'failed parallel sibling wrote nothing');\n" +
  "  assert(/ failed /.test(fs.readFileSync(at('runs.log'), 'utf8')), 'failed run is recorded in runs.log');\n" +
  "  assert(fs.readFileSync(at('ticket.md'), 'utf8').includes('stage: draft'), 'failed run does not advance the stage');\n" +
  '\n' +
  "  // Money spent by a step that then failed still has to appear in the run's cost.\n" +
  "  const log3 = fs.readFileSync(at('runs.log'), 'utf8');\n" +
  "  assert(/step=pm-claude .*FAILED cost=0\\.07/.test(log3), 'a failed step records what it cost');\n" +
  "  const failLine = log3.split('\\n').find((l) => / failed /.test(l)) ?? '';\n" +
  '  const runCost = Number((failLine.match(/cost=([\\d.]+)/) ?? [])[1] ?? 0);\n' +
  "  assert(runCost >= 0.07, `failed run's cost includes the failed step (saw ${runCost})`);\n" +
  '\n' +
  '  // A failed run writes no history entry, so the next run must not reuse its id.\n' +
  "  run(['run', 'requirements', 'T-0003', '--adapter', 'mock', '--auto']);\n" +
  "  const ids = [...fs.readFileSync(at('runs.log'), 'utf8').matchAll(/\\brun=(\\d+) flow=/g)].map((m) => m[1]);\n" +
  "  assert(new Set(ids).size === ids.length, `each run attempt gets its own id (saw ${ids.join(', ')})`);\n" +
  '}\n' +
  '\n' +
  '// Auth failures are translated into one actionable line instead of a vendor stack trace.\n' +
  '{\n' +
  "  const { authError, probeAdapter } = await import('../src/adapters/index.js');\n" +
  "  const { mockAdapter } = await import('../src/adapters/mock.js');\n" +
  "  const real = 'ERROR codex_login::auth::manager: Failed to refresh token: Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.';\n" +
  "  assert(/codex logout && codex login/.test(authError('codex', real) ?? ''), 'codex auth failure"... 28966 more characters


✗ 2 Q-0033 scenario group(s) failed
✗ q0033-surface.js exited 1

✗ 2 of 3 test file(s) failed

```
