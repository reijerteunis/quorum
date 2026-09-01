# quorum (spike)

A one-week spike for Quorum — the open-source, local-first mission control for
agentic software engineering, launching on heyruud.com. It proves the SDLC pipeline:
stage-chained flows, multi-vendor CLI agents on subscription OAuth, backlog as files in git.
Works on any repository; Ruud dogfoods it on his own SaaS products (feedmind, flextann and
whatever comes next), but nothing in here is specific to any of them. No UI yet — the
terminal and the ticket folder are the interface. See `docs/ADAPTER-CONTRACT.md` and
`docs/sdlc-pipeline-spec.md`.

## What's in it

- `src/engine.js` — flow runner: `consumes`/`produces` stage chaining, `parallel` groups, per-step
  JSON-schema structured output written to the backlog, verdict routing with bounded backward
  edges (`on_fail.goto` + `max_iterations` + `on_exhausted: gate`), human/auto/human-locked gates,
  worktree per writing step, static flow lint (incl. the cross-vendor rule).
- `src/adapters/` — `claude` (`claude -p --json-schema`), `codex` (`codex exec --output-schema`),
  `mock` (no CLI; exercises loops). One contract, see docs.
- `src/backlog.js` — ticket folders with frontmatter state, `runs.log`, iteration counters.
- `src/fanout.js` — `fan_out` (tasks.yaml → one worktree per task, dependency waves, `failing-tasks-only` retry scope) and `integrate` (merge branches into the ticket's integration branch, run the test command, `expect: pass|fail`).
- `templates/harness/` — `harness.yaml`, four flows (`requirements`, `solutioning`, `qa-red`, `development`), eight roles, and three context files (`rules.md`, `architecture.md`, `product-context.md`) every project fills in once — they are what make the same flows produce product-specific output in each repo.
- `test/smoke.js` — end-to-end with the mock adapter, `draft → green` (30 checks).

## Run it

```bash
npm install
npm test                                   # mock end-to-end, no CLIs needed

# on any repo (Claude Code + Codex CLI installed and logged in, NO API keys in env):
cd ~/code/<your-saas>
node ~/quorum (spike)/bin/harness.js init
$EDITOR harness/product-context.md harness/architecture.md harness/rules.md   # 10 lines each is enough to start
node ~/quorum (spike)/bin/harness.js adapters            # both must be ✓
node ~/quorum (spike)/bin/harness.js ticket new "<a small, real feature>" \
   --intent "<one paragraph of intent>" --owner <you>
node ~/quorum (spike)/bin/harness.js run requirements T-0001 --verbose
node ~/quorum (spike)/bin/harness.js board
node ~/quorum (spike)/bin/harness.js run solutioning T-0001 --verbose
node ~/quorum (spike)/bin/harness.js run qa-red T-0001 --verbose
node ~/quorum (spike)/bin/harness.js run development T-0001 --verbose
```

`harness.yaml → commands.test` is what `integrate` runs (default `npm test`).

Flags: `--auto` advances human gates (never `human-locked`), `--dry` prints what would run,
`--adapter mock` swaps every step's vendor, `--project <dir>` targets another repo.

## What the spike must answer (in order)

1. Structured tail on both CLIs with a multi-KB markdown `document` field — see the four
   questions in `docs/ADAPTER-CONTRACT.md`.
2. The review loop with real models: does Claude's `revise` actually make Codex's second draft
   better, or do they oscillate? Read `solution/review.md` round by round.
3. Cost per ticket through two stages on real subscriptions.
4. Development on a real repo (pick the smallest of your SaaS repos first): do two vendors' worktrees merge cleanly, and does the
   `failing-tasks-only` retry converge within 3 iterations? Read
   `dev/development/run-<run>/integration-iter-<iter>.md` — one per round, kept rather than overwritten
   since Q-0087.

## Design notes surfaced by the spike

- Git refs are files: `harness/T-0001` cannot coexist with `harness/T-0001/contracts`. The
  ticket's integration branch is therefore `harness/<id>/integration`; step and task branches
  sit beside it (`…/contracts`, `…/tests`, `…/<task.id>`). The spec's branch names need this fix.
- `integrate` is generic: solutioning uses it to land contracts, qa-red uses it with
  `expect: fail` to prove red, development uses it with `expect: pass` and a retry loop.
- When integration fails on tests (no conflicts), every task is re-run with the test output in
  its prompt; only conflicted tasks are re-run when the failure is a conflict. Cheap to refine
  later (map failing tests → tasks) once we see real output.
- Fan-out waves: later waves merge earlier ones into the integration branch first and sync each
  task worktree to it, so a frontend task really builds on the backend task it depends on.

- The lint caught a flaw in the spec: a judge over N candidates necessarily shares a vendor with
  one of them. The cross-vendor rule is now "a reviewing step must see at least one input written
  by another vendor" — strict writer≠reviewer for single-writer review, relaxed for judges over
  mixed-vendor candidates. Fold this into DECISIONS.md.
- Cross-flow backward edges (`goto: flow:development`) regress the ticket's stage and stop; the
  target flow is run next by its owner. Simple, and it keeps ownership per stage intact.
- An exhausted loop becomes a gate with three answers: advance (accept as is), retry (one more
  round, counters reset), abort.
