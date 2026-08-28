# Q-0072 — Turbo's task hashes under-declare their inputs

*Merged requirement, 2026-08-28. Surfaces: `turbo.json`, `package.json`, `.github/workflows/ci.yml`,
the two workspace suites that read outside their own package (`packages/shared`, `packages/core`),
and `docs/04-architecture.md`. No CLI, daemon, flow, adapter, backlog or harness-format surface.
Route: **chore** — this is configuration and machinery, and there is no behaviour a test could fail
on before it exists.*

---

## Problem

The `maintainer` runs `pnpm test`, reads `7 successful, 7 cached, FULL TURBO`, and believes the
workspace is green. What that line actually says is weaker: **nothing inside each package has
changed.** It does not say that nothing each task *reads* has changed, and here the two are far
apart, because both real suites read most of the repository.

`turbo.json` declares no `inputs` and no `dependsOn`. Its only root-relative declarations are four
`globalDependencies` — `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`, `vitest.shared.js`.
Every other hashed input is package-relative, so a task's hash moves only when a file inside its own
package moves. Meanwhile `@quorum/shared`'s suite reads five documents under `docs/`,
`harness/harness.yaml`, `harness/architecture.md`, every flow file, every role file, **every
`ticket.md` in the backlog**, a recursive walk of `spike/src/**`, `spike/templates/harness/harness.yaml`,
and three files under `packages/core`; `@quorum/core`'s suite reads `docs/03`, `docs/04`,
`turbo.json`, `.github/workflows/ci.yml`, three frozen contracts, a ticket body, `pnpm-lock.yaml`,
`spike/src/**`, and four files under `packages/shared`. None of it moves a hash.

The demonstration lives inside the guard written to close the same class of defect one layer up.
`packages/shared/src/project.test.ts:130` asserts that `harness/harness.yaml`'s `commands.test`
forces turbo — Q-0065's enforcement — over a file that is not among that task's hashed inputs.
Delete the `--force` and the hash does not move; a cached `pnpm test` replays green over the guard
written to catch exactly that. **Q-0065's enforcement is invisible to the cache it defeats.** The
same holds for `packages/core/src/test-command.test.ts` asserting over `turbo.json`,
`.github/workflows/ci.yml` and `spike/src/**`, and for every corpus assertion the port freeze
depends on.

It has already cost something. Q-0071's own evening produced a `ticket.md` whose 85-column title
failed `packages/shared/src/ticket.test.ts`, while `pnpm turbo run test` reported `7 cached / 9 ms /
FULL TURBO` and exit 0 over it. That verdict would have replayed indefinitely, because the corpus it
walks is an input turbo does not hash. Q-0043's containment flake survived the same way until a
forced re-run failed 1 of 123 — *a flaky test behind a cache reports its last mood.*

The second axis is the missing `dependsOn`. `packages/core/package.json` declares
`"@quorum/shared": "workspace:*"` and `packages/shared/package.json` exports `./src/index.ts`, so
`core` compiles and lints `shared`'s **source** — yet a change in `shared` invalidates none of
`@quorum/core`'s `test`, `lint` or `typecheck`. Q-0069's `@typescript-eslint/no-deprecated` is
type-aware and reads `shared`'s declarations while linting `core`: a deprecation introduced next
door leaves `core`'s lint tick cached and green.

Q-0065 and Q-0071 made both gates that matter execute everything, which is exactly why nothing will
surface this again until someone trusts a hit. What remains is the `maintainer`'s local loop, the
`contributor`'s first run, and a repository whose cache means something other than what it appears
to mean.

**After this ticket a cache hit must mean: no file this task reads, and no same-kind task in a
package it depends on, has changed since the cached successful result.** It must no longer mean only
that files inside the task's own package have not changed. That sentence is the ticket.

## User stories

- **`maintainer`** — *I want a cached `pnpm test` to mean "nothing this suite reads has changed", so
  that a green local run is a reason to stop looking rather than a reason to run it again forced.*
- **`contributor`** — *I want a change I make in `packages/shared` to invalidate the checks in
  `packages/core` that read it, so that my first pull request is not green on my machine and red in
  CI for a reason neither of us can see.*

## What was verified for this requirement

Read at the gate, on 2026-08-28, because three inherited measurements have been wrong in this
repository in a week. Nothing was modified; the tree is clean. Each row names the question it
answers.

| Question | Read | Answer |
| --- | --- | --- |
| Does `turbo.json` say what the ticket says? | `turbo.json` | **Yes**, verbatim: four `globalDependencies`, three tasks, `outputs: []` on each, `env: ["QUORUM_REAL_CLI"]` on `test`, no `inputs`, no `dependsOn`. |
| Is there a real workspace dependency for `^kind` to hang an edge on? | `packages/core/package.json`, `packages/shared/package.json` | **Yes, and it is one-directional.** `core` declares `@quorum/shared: workspace:*`; `shared` declares no dependency on `core`. So `^lint`/`^typecheck`/`^test` create shared→core edges and **cannot** create a cycle. |
| May the chore implementer write every surface this requirement names? | `harness/roles/developer-generalist.md:3` | **Yes.** Its `paths` are `package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, spike, harness, docs`. All five surfaces are inside it. The three-question surface test of 2026-08-27 passes: role paths ✓, no `commitAll` revert (nothing under `backlog/`) ✓, nothing derived ✓. |
| May it write the decision entry? | same file, lines 22–25 | **No, by the role's own instruction** — *"You do not append to docs/DECISIONS.md; a decision is the human's to record, so if your work implies one, name it in your summary."* AC-13 is written to match the role that will run, not to override it. |
| What does CI actually invoke? | `.github/workflows/ci.yml` | `pnpm turbo run lint --force`, `… typecheck --force`, `… test --force` — turbo directly, not `package.json`'s scripts, which are `turbo run <task>` with no force. The divergence AC-9 guards is real. |
| Which sentence in the workflow does this change falsify? | same, workspace-job comment | *"The guard … lives in `packages/core/src/test-command.test.ts` and is itself in no package's hashed inputs, so it is only trustworthy while this job and `integrate` both force."* |
| Which sentence in the architecture doc? | `docs/04-architecture.md:67` | *"A developer's local `pnpm test` is unforced and keeps its cache, which is where a cache earns its keep."* |
| What do the suites actually read outside their own package? | every `repoFile` / `spikeSource` / `corpusFiles` / `ticketFiles` / `flowFiles` / `roleFiles` call site in both packages, plus both `test/corpus.ts` helpers | The sets in §Problem — **including four the ticket body does not list**: `harness/flows/*.yaml`, `harness/roles/*.md`, `harness/architecture.md` and every `backlog/*/ticket.md` (shared), and `.github/workflows/ci.yml` (core). |
| Does any other package read outside itself? | the five scaffold packages and `apps/web` | **No.** All are stubs. Only `core` and `shared` are affected. |

Two things this requirement did **not** verify, and takes from the ticket body's probe of the same
day rather than from anyone's prose: that turbo 2.10.11 accepts a `../`-escaping glob in a package
task's `inputs` (measured in a dry run, 24 → 34 and 56 → 66 files, exit 0, no warning), and that
`dependsOn: ["^test"]` moves the dependent's hash. Both required mutating `turbo.json`, which the
gate did not do. Both are re-established by AC-1 and AC-5 rather than assumed.

## Acceptance criteria

1. **The escaping input is proved through a real cache before the configuration is designed on
   it.** Before any other criterion, and using the workspace's installed turbo: a non-dry run writes
   a cache entry; an unchanged re-run is a hit; an edit to a file matched **only** through a
   `../`-escaping input causes the next run to execute rather than restore; reverting the edit
   permits the original entry to be used again. The proof inspects an observable side effect of
   execution as well as turbo's reported status, so a changed summary label alone cannot satisfy it.
   If escaping inputs are not honoured in a real run, the implementer **stops and reports**, naming
   which fallback the evidence points at — shape (1) `globalDependencies`, shape (3) alone, or shape
   (4) relocating the assertions — and does not choose one. Commands and outputs go in the summary.
2. **Every out-of-package file each `test` task reads is in that task's hashed input set.** Each
   affected package's `test` task declares `inputs: ["$TURBO_DEFAULT$", …]` plus globs covering its
   own out-of-package reads. `$TURBO_DEFAULT$` is first in every array introduced here: the default
   package-relative set is preserved, never replaced by a hand-maintained list, and a dry run after
   the change still contains every package-relative input present in the baseline (24 for
   `@quorum/shared#test`, 56 for `@quorum/core#test`) before counting the new ones. The final list
   is derived from the test code in the implementation revision, not from this document's examples.
   Proof: a table of `taskId → input count before → after`, and every enumerated read present in the
   after set. The five scaffold packages read nothing outside themselves and are expected unchanged
   at 5–6 inputs; a move there is a finding to report, not a rounding error. Note the closure this
   produces: `@quorum/core`'s suite reads `turbo.json` and `.github/workflows/ci.yml`, so declaring
   them makes the AC-9 and Q-0071 guards inputs of the task that runs them.
3. **Corpus inputs are declared on `test` only.** The out-of-package `docs/`, `harness/`, `spike/`,
   `contracts/`, `backlog/`, `.github/` and lockfile globs go on `test`; they are **not** added to
   `lint` or `typecheck`, and **not** added to `globalDependencies`. Proof: editing an asserted
   documentation file invalidates the affected `test` task and leaves every `lint` and `typecheck`
   hash unchanged. The cross-package half of those two tasks is AC-4's job, which is a different
   mechanism.
4. **A change under `packages/shared/src` invalidates `@quorum/core`'s `test`, `lint` and
   `typecheck`.** Via `dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]`. All three, not `test`
   alone — `typecheck` compiles `shared`'s source and Q-0069's type-aware rule reads its declarations
   while linting `core`. No cross-kind edge is introduced. The edge is one-directional, because
   `core` depends on `shared` and `shared` does not depend on `core`: `shared`'s suite reading
   `core`'s files is covered by AC-2's **inputs** and must not be expressed as a dependency edge.
   Proof: a dry run shows the shared task as a dependency of the core task for each kind, and
   editing a tracked file under `packages/shared/src/` moves all three core hashes.
5. **Both of today's failures are reproduced before the change and shown absent after, by the
   implementer.** Append one line to `docs/GLOSSARY.md`: today both test hashes are byte-identical
   afterwards. Append one line to `packages/shared/src/constants.ts`: today `core`'s hash is
   unchanged. Record the hashes before and after in both states. Then repeat the coverage query
   **once inside a git worktree**, because that is where `integrate` runs and turbo resolves a
   worktree's cache to the main checkout's (Q-0065) — an input glob that does not resolve there
   breaks the step this repository trusts most. Every probe restores its subject file;
   `git status --short` is empty afterwards, on success and on failure.
6. **No hash moves for a file nothing reads.** The implementer names a control file that no suite
   reads, verifies that claim rather than asserting it, edits it, and shows all 21 task hashes
   unchanged. This is what makes AC-2 a precise declaration rather than a blanket one, and it is the
   criterion that would catch an over-broad glob.
7. **A new out-of-package read that no declared input covers fails a check.** A guard, in whichever
   package can see the whole picture, comparing what the two suites read against turbo's effective
   inputs. Minimum acceptable implementation: an explicit, audited manifest of out-of-package reads
   checked against `--dry=json`'s reported inputs, **plus** a check that the named corpus helpers are
   the only route out of a package — so a read added by a new `repoFile('…')`, `spikeSource('…')` or
   `corpusFiles('…')` call cannot bypass the manifest unnoticed. Demonstrated to have a subject, and
   — per Q-0071's rule that demonstrating a guard fires does not demonstrate each of its clauses
   fires — each clause demonstrated independently: a fixture evading only the manifest clause must
   fail it, and a fixture evading only the escape-route clause must fail it. It fails, never skips,
   when turbo or a corpus file is absent. This is what keeps the fix from decaying the first time
   somebody adds a `repoFile()` call.
8. **Nothing that forces today stops forcing.** `.github/workflows/ci.yml` still runs all three
   tasks with `--force` and still restores no turbo task-result cache; `harness/harness.yaml`'s
   `commands.test` is untouched; the Q-0065 and Q-0071 guards in
   `packages/core/src/test-command.test.ts` and `packages/shared/src/project.test.ts` pass unchanged.
   This ticket makes a *hit* trustworthy; it does not make a gate rely on one.
9. **`package.json`'s scripts and CI's invocations are asserted to name the same tasks.** CI invokes
   `pnpm turbo run <task> --force` directly, so `lint`, `typecheck` and `test` in `package.json` are
   no longer what CI runs; they are identical today and nothing says they stay so. A guard fails when
   the workspace job and the three root scripts stop naming the same task set. `package.json` does
   **not** gain `--force` and no `:ci` script is added — Q-0071 considered and rejected both.
10. **The two claims this change falsifies are corrected where a reader meets them.** (a) The
    workspace-job comment in `.github/workflows/ci.yml` says the Q-0071 guard *"is itself in no
    package's hashed inputs, so it is only trustworthy while this job and `integrate` both force"* —
    after AC-2 the workflow file the guard reads becomes a hashed input of the task that runs it, so
    the sentence is false and must say what is now true, and say it precisely: it was the guard's
    *subject* that was unhashed, never the guard file, which has always been inside its own package.
    (b) `docs/04-architecture.md:67` ends *"A developer's local `pnpm test` is unforced and keeps its
    cache, which is where a cache earns its keep"*; it must state what a hit now claims — **"nothing
    this task reads has changed"** — against what it claimed before, **"nothing inside this package
    has changed"**, and say that CI's claim is different and stronger because CI forces.
11. **`turbo.json` still validates, and no experimental surface is adopted.** It validates against
    the schema it declares (`node_modules/turbo/schema.json`); the `test` task's
    `env: ["QUORUM_REAL_CLI"]` is untouched and still `env` rather than `passThroughEnv` — Q-0065 AC-6
    asserts this and paid probes must keep moving the hash. No new dependency, and no turbo upgrade.
    `futureFlags` is **not** enabled: turbo 2.10.11 does offer a root-level `inputs` block prepended
    to every task, with per-task negation, but the bundled schema gates it behind
    `futureFlags.globalConfiguration`. Adopting an experimental configuration surface is a decision,
    not an implementation choice — stop and report if the chosen shape appears to need one.
12. **The cost is measured, not estimated, and `dependsOn`'s two consequences are recorded.** Three
    samples each of `pnpm test`, before and after, in three states: no edit, after a `docs/` edit,
    after a `packages/shared/src` edit. Fewer replays is the point of the ticket and the decision
    entry needs the number rather than an adjective. Also record the two ordering consequences of
    AC-4, stated rather than discovered: the task graph gains edges, so `shared` completes before
    `core` and CI's forced run goes from one parallel wave to two — measure that too — and a failure
    in a dependency now **skips** its dependents rather than reporting them, so a developer sees
    fewer failures per run unless `--continue` is passed.
13. **The decision is named, not written.** `developer-generalist` may not append to
    `docs/DECISIONS.md`, and this entry is Ruud's to write at the gate. The implementation summary
    names the entry's proposed title, the shape chosen, each shape rejected with its reason, the
    cache-hit sentence from §Problem, and both consequences from AC-12 — in a form Ruud can lift.

## Non-goals

- **Changing what CI or `integrate` force.** Q-0065 and Q-0071 stand. This ticket is about what a
  *hit* claims, not about where hits are allowed.
- **Making CI invoke `package.json`'s scripts instead of turbo directly.** That reverses part of a
  decision entry dated 2026-08-27 and needs a new entry naming the old one, not an implementer's
  choice. AC-9 guards the divergence; deciding it is Successor B below.
- **An automated real-cache fixture, or running one on CI.** AC-1 is a one-time capability proof.
  The durable version is Successor A below.
- **Writing `docs/DECISIONS.md`,** or any file under `backlog/`. The first is the role's own
  instruction; the second is reverted by `commitAll` before every agent commit.
- **Shape (4), relocating the cross-tree corpus assertions.** It touches landed, reviewed tests in
  two packages. If the AC-7 guard turns out to be impractical, stop and report; do not relocate
  tests to make the configuration easier.
- **Adding all of `docs/**`, `contracts/**`, `backlog/**`, `harness/**` or `spike/**` to
  `globalDependencies`** — shape (1), rejected: it would invalidate all 21 task-package pairs on any
  `docs/` edit, in a repository where `docs/` changes on every ticket.
- **Disabling or forcing local `pnpm lint`, `pnpm typecheck` or `pnpm test` by default.** An
  unchanged local run should stay cached; that is the point of making the hit mean something.
- **The spike suite.** `npm test --prefix spike` is not a turbo task and hashes nothing. Unchanged,
  and it must stay green.
- **Upgrading turbo, pnpm, Node, ESLint, TypeScript or Vitest;** remote caching, `boundaries`,
  `tags`, a `build` task, or any turbo feature this repository does not use today.
- **Package exports, dependency direction, or `harness/harness.yaml`.** No adopter receives
  `turbo.json` and `harness init` does not copy it; there is no cold-clone surface here.
- **Re-deriving the ticket body's probe results from the prose above them.** The prose predates the
  measurements and the measurements supersede it.

## Deferred, with successor bodies

Written out rather than promised, because in this repository a deferred obligation dies unless the
next ticket's body carries it.

**Successor A — Prove the escaping-input configuration automatically, and on CI's Linux checkout.**
AC-1 is a one-time manual proof recorded in an implementation summary, and a summary is not read
again after the gate. The durable form is an automated fixture that, in an isolated temporary
workspace using the installed turbo, performs a non-dry run that writes a cache entry, confirms an
unchanged second run is a hit, changes a file matched only through a `../`-escaping input, confirms
the next run executes instead of restoring, and confirms that reverting permits the original key
again — inspecting a side effect of task execution as well as turbo's reported status, so a changed
label alone cannot satisfy it. It runs on CI's Linux checkout, unconditionally: not skipped by
operating system, branch type, cache state or missing optional software, since a check that skips its
subject must not report success. It uses an isolated temporary workspace, depends on no pre-existing
repository cache, and leaves `git status --short` empty after success and after failure. Its value is
that an incompatible turbo upgrade then fails visibly instead of silently restoring the old meaning
of a hit. Deferred from Q-0072 because it is a self-contained engineering problem — a temp-workspace
turbo harness — whose cost is comparable to the whole of Q-0072, and because it is worth nothing
until Q-0072 establishes the configuration it would defend. Open first: whether the fixture can use
the real workspace's `turbo.json` or must synthesise a minimal one, and whether a CI run of it can be
kept under the workspace job's current wall time.

**Successor B — CI's command surface: one spelling or two.** Q-0071 chose `pnpm turbo run <task>
--force` invoked directly in `.github/workflows/ci.yml`, and explicitly rejected both a `test:ci`
script in `package.json` and a `TURBO_FORCE` environment variable — the first because it moves the
force one indirection away from the file a reader of a CI result opens, the second because it is
legible only to someone who goes looking. The consequence, raised at that ticket's gate and carried
into Q-0072: `package.json`'s `lint`, `typecheck` and `test` are no longer what CI runs. Q-0072's
AC-9 adds a guard that they cannot diverge silently; it does not decide whether they should be one
command. What this ticket settles: whether a developer's `pnpm test` and CI's tick should be the same
command spelled once, and if so how `--force` is expressed without putting a runner's flag inside a
script every developer runs unforced. It reverses part of a dated decision entry, so it needs its own
entry naming that one. Do not open it until AC-9's guard has been in place long enough to say whether
the divergence is a real risk or a theoretical one — the guard is the evidence this ticket needs.

## Open questions

None blocks implementation. The shape question both candidates raised is settled here rather than
deferred to the gate: **(2) per-task `inputs` as `["$TURBO_DEFAULT$", …out-of-package globs…]` plus
(3) same-kind `^lint` / `^typecheck` / `^test` edges.** The 2026-08-28 measurements establish that
both halves work on this turbo, and a precise input set is the same claim this repository makes
everywhere else — a tick names what it examined — stated in the file the runner actually reads.
Shape (1)'s single virtue is zero drift risk, which AC-7 answers directly; its cost is invalidating
every task in every package on every `docs/` edit, which is roughly a full cold workspace run per
documentation commit. If AC-1 shows escaping inputs are not honoured in a real run, the fallback is
not chosen by the implementer — it stops and reports.

- **OQ-1 — Glob granularity, decided per package rather than once. (non-blocking; implementer.)**
  Recommendation: directory globs where the suite reads a whole tree (`spike/src/**`,
  `contracts/Q-0006/**`, `contracts/Q-0011/**`, `harness/flows/*.yaml`, `harness/roles/*.md`,
  `backlog/*/ticket.md`), named files where it reads named files. Specifically, do **not** give
  `@quorum/core#test` a blanket `docs/**`: it reads `docs/03` and `docs/04` only and it is the
  27-second task, so `docs/**` would re-run it on every DECISIONS entry. `@quorum/shared#test` is the
  0.6-second task and already reads `docs/DECISIONS.md` and `docs/GLOSSARY.md`, so a blanket
  `docs/**` there costs almost nothing and buys drift resistance. Cost decides each one, not
  symmetry; record which you chose and why.
- **OQ-2 — Can AC-7's guard identify reads without becoming a second fragile TypeScript parser?
  (non-blocking; implementer.)** The escape routes are few and named — `repoFile`, `spikeSource`,
  `corpusFiles`, `ticketFiles`, `flowFiles`, `roleFiles`, and `repoRoot` itself — and they take
  string literals, so a scan of the two suites plus a rule that `repoRoot` is used nowhere but
  `test/corpus.ts` is probably enough. If it is not, the manifest half is the floor and the
  escape-route half is reported as unachieved rather than faked.
- **OQ-3 — Does `turbo.json` accept comments? (non-blocking; implementer.)** Verify against this
  turbo rather than assume. If it does, one line naming the claim belongs beside the declarations; if
  not, AC-10's prose carries it alone.
- **OQ-4 — Does turbo already fold `turbo.json` into every task hash? (non-blocking; implementer.)**
  If it does, declaring it as an input for `core` is redundant and harmless; verify rather than
  reason about it.

## Risks

1. **The declared set drifts from the read set.** The failure mode is identical to today's and just
   as quiet. AC-7 is the whole mitigation; if it is weak, the ticket buys one clean afternoon.
2. **`../`-escaping globs are unproven outside a dry run.** They have not been exercised through a
   real cache *write and restore*, inside a worktree, or on CI's checkout. AC-1 covers the first,
   AC-5 the second, Successor A the third. What limits the damage is that both gates force, so a
   mistake fails loudly rather than blessing quietly.
3. **`dependsOn` changes more than hashing.** It adds ordering edges and it changes what
   `--filter @quorum/core` runs — including the probe invocation Q-0065 AC-8 pins in
   `real-cli.probe.test.ts`, which would then also run `@quorum/shared#test`. That assertion is on
   the file's text so it still passes, but the documented command's behaviour moves, and that belongs
   in the summary rather than in someone's surprise.
4. **`backlog/*/ticket.md` as an input to `@quorum/shared#test` means every ticket edit invalidates
   it** — which is correct, and is exactly the miss Q-0071's evening produced. It also means a run's
   own ticket folder moves the hash mid-run. Harmless while `integrate` forces; worth naming so it is
   not rediscovered as a defect.
5. **The local loop gets slower**, and this repository has accepted that trade twice already. The
   difference is that the cost now lands on the `maintainer`'s own keystrokes rather than on a
   runner, which is what makes AC-12's numbers a decision rather than a preference.
6. **The two suites read each other's trees.** Input globs are not edges, so this creates no cycle,
   and the package dependency runs one way only. But it does mean an edit under `packages/core/src`
   can invalidate `@quorum/shared#test` and vice versa, which is broader than either suite strictly
   needs. Correct, and worth stating so it is not read later as a mistake.
7. **This is machinery the flows depend on** — the 2026-08-23 rule. The chore route is right and the
   exposure is bounded: `integrate` runs the very suites whose hashing is changing, forced, so a
   mistake fails the run rather than blessing it. `commands.test` is not changing, so Q-0065's
   snapshot-at-run-start problem does not apply here.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example touches a key, and no paid probe runs in CI. The one adjacency is AC-11: the `QUORUM_REAL_CLI` declaration selects paid probes and must keep moving the task's hash, which is why it stays `env` and not `passThroughEnv`. |
| **Worktree safety** | No flow write path changes. The relevant property is the reverse — the configuration must resolve *inside* a worktree, since `integrate` runs there against the main checkout's cache (AC-5). Probe fixtures write only below a temporary directory and leave no branch or worktree behind. |
| **Gate behaviour** | Unchanged. Chore's gates and `cross_vendor: required` stand. |
| **Files as the database** | No persistent product state, no `backlog/`, `harness/` or `.quorum/` format change, so no zod schema in `packages/shared` moves. `turbo.json` is validated against `node_modules/turbo/schema.json` (AC-11). |
| **Lint rules** | No ESLint scope or rule change. ESLint does not read `turbo.json`. Q-0069's type-aware rule is a *beneficiary* of AC-4, not a subject. New TypeScript in the AC-7 guard is strict, no `any`, no unreasoned suppression. |
| **Glossary** | No new term. "Cache hit" is turbo's vocabulary, not Quorum's, and appears only in prose about the build. |
| **Cold-clone impact** | None for an `adopter` — `turbo.json` is this repository's own configuration and `harness init` does not copy it. Marginally slower for a `contributor`'s first `pnpm test`, which executes rather than replays; no new dependency and no new setup step. |

## Provenance

**Claude's candidate is the spine.** Its problem statement, its correction of the two prose claims
(AC-10), its precision control (AC-6), its worktree re-check (inside AC-5), its `package.json`/CI
parity guard (AC-9), its measurement criterion (AC-12), its "the decision is named, not written"
(AC-13) and its risk list are taken largely as written. It was also right about the read set: it
found four out-of-package reads the ticket body omits, and the gate confirmed all four.

**Four things are taken from Codex over Claude.** (i) AC-3, corpus inputs on `test` only and never on
`lint`, `typecheck` or `globalDependencies` — a real precision win that Claude's candidate left
unsaid, and it matters most on the 27-second task. (ii) AC-1's insistence that the escaping-glob
capability be proved through a **real** cache write and restore, inspecting a side effect and not
only turbo's summary; Claude's candidate was content with the dry run and listed the gap as a risk.
(iii) The explicit per-suite input lists, which make AC-2's "derive it from the code" checkable rather
than aspirational. (iv) The manifest-versus-parser framing of the drift guard, which is now OQ-2 and
sets AC-7's floor — Claude's AC-4 asked for a guard without saying what its minimum acceptable form
was.

**What was struck, and why.** Codex's AC-9 and AC-10 — an automated temp-workspace cache fixture and
running it unconditionally on CI — are the best idea in either document and the wrong size for this
ticket; they are Successor A, written out in full above. Codex's AC-11 and AC-12, which require CI to
invoke `package.json`'s scripts while forwarding `--force`, are struck because they reverse part of
the decision entry of 2026-08-27, which considered and rejected exactly that shape; a reversal is a
new entry, not an implementer's choice, and it is Successor B. Codex's AC-1, requiring Ruud to append
the decision entry *before* implementation begins, is struck as over-constraining and contrary to the
shipped role, which says a decision is named in the summary and recorded by the human — making it a
precondition would block the run on an action nothing in the flow can perform.

**What the head of product settled rather than passing on.** Both candidates carried the shape choice
as a blocking open question, and Claude's even supplied its own default — a blocker with a default is
not a blocker, it is an unmade decision. It is made in §Open questions: (2)+(3), with reasons, and
with the fallback route defined for the one measurement that could overturn it. The merged document
is thirteen criteria over a small implementation — one `turbo.json` edit, one substantial guard, two
prose corrections and recorded evidence — which is inside the size this project can carry. Folding in
Codex's two heaviest criteria would have made it fifteen-plus with two new workstreams attached, and
that is the shape that has cost this repository a loop at every stage.
