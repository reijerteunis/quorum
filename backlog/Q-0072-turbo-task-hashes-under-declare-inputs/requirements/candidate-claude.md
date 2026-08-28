# Q-0072 — Turbo's task hashes under-declare their inputs

*Requirement, 2026-08-28. Surfaces: repository build configuration (`turbo.json`, `package.json`,
`.github/workflows/ci.yml`), the two workspace suites that read outside their own package, and
`docs/04-architecture.md`. No CLI, daemon, flow or adapter surface. Route: chore.*

---

## Problem

The `maintainer` runs `pnpm test`, reads `7 successful, 7 cached, FULL TURBO`, and believes the
workspace is green. What that line actually says is weaker: **nothing inside each package has
changed.** It does not say that nothing each task *reads* has changed, and the two are far apart
here, because both real suites read most of the repository.

`turbo.json` declares no `inputs` and no `dependsOn`. Its only root-relative declarations are four
`globalDependencies`. Every other hashed input is package-relative, so a task's hash moves only
when a file inside its own package moves. Meanwhile `@quorum/shared`'s suite reads five documents
under `docs/`, `harness/harness.yaml`, every flow file, every role file, **every `ticket.md` in the
backlog**, nine files under `spike/`, and two files under `packages/core`; `@quorum/core`'s suite
reads `docs/03`, `docs/04`, `turbo.json`, `.github/workflows/ci.yml`, three frozen contracts, a
ticket body, `pnpm-lock.yaml`, all of `spike/src/**`, and three files under `packages/shared`. None
of it moves a hash.

The demonstration is inside the guard written to close the same class of defect one layer up.
`packages/shared/src/project.test.ts:130` asserts that `harness/harness.yaml`'s `commands.test`
forces turbo — Q-0065's enforcement — over a file that is not among that task's hashed inputs.
Delete the `--force` and the hash does not move; the guard replays green. And it has cost something
already: Q-0071's own evening produced a `ticket.md` whose title failed
`packages/shared/src/ticket.test.ts`, while `pnpm turbo run test` reported `7 cached / 9 ms / FULL
TURBO` and exit 0 over it. That verdict would have replayed indefinitely, because the corpus it
walks is an input turbo does not hash.

The second axis is the missing `dependsOn`. `packages/shared/package.json` exports `./src/index.ts`,
so `core` compiles `shared`'s source directly — yet a change in `shared` invalidates none of
`@quorum/core`'s `test`, `lint` or `typecheck`. Q-0069's `@typescript-eslint/no-deprecated` is
type-aware and reads `shared`'s declarations while linting `core`: a deprecation introduced next
door leaves `core`'s lint tick cached and green.

Q-0071 and Q-0065 made both gates that matter execute everything, which is exactly why nothing will
surface this again until someone trusts a hit. What remains is the `maintainer`'s local loop, the
`contributor`'s first run, and a repository whose cache means something other than what it appears
to mean.

## User stories

- **`maintainer`** — *I want a cached `pnpm test` to mean "nothing this suite reads has changed", so
  that a green local run is a reason to stop looking rather than a reason to run it again forced.*
- **`contributor`** — *I want a change I make in `packages/shared` to invalidate the checks in
  `packages/core` that read it, so that my first pull request is not green on my machine and red in
  CI for a reason neither of us can see.*

## What was verified for this requirement

Re-derived on 2026-08-28 against the installed turbo, per the ticket's *verify first* instruction
and this repository's rule that an inherited measurement is re-run before it enters a durable
record. Each command is named with the question it answers. Nothing was modified; the tree is clean.

| Question | Command | Answer |
| --- | --- | --- |
| Which turbo? | `node_modules/.bin/turbo --version` | **2.10.11** |
| What does each `test` task hash? | `turbo run test --dry=json --no-daemon` | `@quorum/shared#test` **24** files, `@quorum/core#test` **56**, five other tasks 5–6. Every entry package-relative (`src/**`, `test/**`, `package.json`, `tsconfig.json`, `vitest.config.js`). The two counts the ticket inherited from Q-0071 hold. |
| Any cross-package edges? | same | `dependencies` and `dependents` are `[]` for all seven tasks. |
| What is root-relative anywhere? | `globalCacheInputs.files` | exactly `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`, `vitest.shared.js`. |
| Is the cache live? | same | `@quorum/core#test` `"status": "HIT"`, `timeSaved` **27,224 ms**; `@quorum/shared#test` HIT, 591 ms. |
| What do the suites actually read outside their package? | reading both `test/corpus.ts` helpers and every call site | the sets in §Problem — **including three the ticket body does not list**: `harness/flows/*.yaml`, `harness/roles/*.md` and every `backlog/*/ticket.md` (shared), plus a recursive walk of `spike/src/**` from *both* packages and a live `import()` of `spike/src/lint.js` from shared. |
| Does any other package read outside itself? | reading `packages/{cli,compiler,server,templates}/src/index.test.ts` and `apps/web/src/index.test.ts` | **No.** All five are scaffold stubs. Only `core` and `shared` are affected. |

Two things this requirement does **not** claim to have verified, and that the ticket body records
from a probe run earlier the same day: that turbo 2.10.11 accepts a `../`-escaping glob in a
package task's `inputs` (measured there in a dry run, 24 → 34 and 56 → 66), and that `dependsOn:
["^test"]` moves the dependent's hash. Both were probed by mutating `turbo.json`, which this
requirement did not do. They are re-listed as AC-3's first obligation rather than assumed.

## Acceptance criteria

1. **Every file a task reads is in that task's hashed input set.** For each of the seven `test`
   tasks, `turbo run test --dry=json` lists every out-of-package path that task's suite reads.
   Coverage is proved against the enumerated read set, not against a spot check, and the evidence
   is a table of `taskId → input count before → after`. The five scaffold packages are expected to
   be unchanged at 5–6 inputs; if one of them moves, that is a finding to report, not a rounding
   error. Note the closure this produces: `packages/core`'s suite reads `turbo.json`, so declaring
   it makes the guard in AC-4 an input of the task that runs it.
2. **A change in `packages/shared/src` invalidates `@quorum/core`'s `test`, `lint` and
   `typecheck`.** All three, not `test` alone — `typecheck` compiles `shared`'s source and Q-0069's
   type-aware lint rule reads its declarations.
3. **Both failures are reproduced before the change and shown absent after, by the implementer.**
   Append one line to `docs/GLOSSARY.md`: today both hashes are byte-identical afterwards. Append
   one line to `packages/shared/src/constants.ts`: today `core`'s hash is unchanged. Record the
   four hashes before and the four after. Repeat the coverage query **once inside a git worktree**,
   because that is where `integrate` runs and turbo resolves a worktree's cache to the main
   checkout's (Q-0065) — an input glob that does not resolve there breaks the step this repository
   trusts most.
4. **A new out-of-package read that no declared input covers fails a check.** A guard, in whichever
   package can see the whole picture, that refuses a read the configuration does not cover.
   Demonstrated to have a subject: a fixture read outside every declared glob must fail it, and —
   per Q-0071's rule that demonstrating a guard fires does not demonstrate each of its clauses
   fires — a fixture that evades each clause independently must fail it too. This is what keeps the
   fix from decaying the first time somebody adds a `repoFile()` call.
5. **No hash moves for a file nothing reads.** The implementer names a control file that no suite
   reads, verifies that claim, edits it, and shows every task hash unchanged. *This criterion holds
   under the recommended shape and is struck if OQ-1 is answered with shape (1); see Open
   questions.*
6. **Nothing that forces today stops forcing.** `.github/workflows/ci.yml` still runs all three
   tasks with `--force`; `harness/harness.yaml`'s `commands.test` is untouched; the Q-0065 and
   Q-0071 guards in `packages/core/src/test-command.test.ts` and
   `packages/shared/src/project.test.ts` pass unchanged. This ticket makes a *hit* trustworthy; it
   does not make a gate rely on one.
7. **The two claims this change falsifies are corrected where a reader meets them.**
   `.github/workflows/ci.yml`'s comment says the Q-0071 guard *"is itself in no package's hashed
   inputs, so it is only trustworthy while this job and `integrate` both force"* — after AC-1 that
   is false and must say what is now true. `docs/04-architecture.md` §Testing (line 67) ends *"A
   developer's local `pnpm test` is unforced and keeps its cache, which is where a cache earns its
   keep"*; it must state what a hit now claims — **"nothing this task reads has changed"** — against
   what it claimed before, **"nothing inside this package has changed"**.
8. **`package.json`'s scripts and CI's invocations are asserted to name the same tasks.** CI now
   invokes `pnpm turbo run <task> --force` directly, so `lint`, `typecheck` and `test` in
   `package.json` are no longer what CI runs; they are identical today and nothing says they stay
   so. A check fails when they diverge. `package.json` does **not** gain `--force` and no `:ci`
   script is added — Q-0071 rejected both.
9. **No new dependency and no experimental turbo surface.** In particular, `futureFlags` is not
   enabled: turbo 2.10.11 does offer a root-level `inputs` block that is prepended to every task's
   inputs and supports per-task negation, but the bundled schema gates it behind
   `futureFlags.globalConfiguration`. Adopting an experimental configuration surface is a decision,
   not an implementation choice — stop and report if the chosen shape appears to need one.
10. **`turbo.json` still validates against the schema it declares** (`node_modules/turbo/schema.json`),
    and the `test` task's `env: ["QUORUM_REAL_CLI"]` declaration is untouched and still `env` rather
    than `passThroughEnv` — Q-0065 AC-6 asserts this and paid probes must keep moving the hash.
11. **The cost is measured, not estimated.** Three timings before and three after, three samples
    each: `pnpm test` with no edit, after a `docs/` edit, and after a `packages/shared/src` edit.
    Fewer replays is the point of the ticket, and the decision entry needs the number rather than an
    adjective. If `dependsOn` is used, also record its two consequences: the task graph gains
    ordering edges, and a failure in a dependency now *skips* its dependents rather than reporting
    them — so a developer sees fewer failures per run unless `--continue` is passed.
12. **The decision is named, not written.** `developer-generalist` may not append to
    `docs/DECISIONS.md`, and this entry is Ruud's. The implementation summary names the entry's
    title, the shape chosen, and each shape rejected with its reason, in a form Ruud can lift.

## Non-goals

- **Changing what CI or `integrate` force.** Q-0071 and Q-0065 stand. This ticket is about what a
  *hit* claims, not about where hits are allowed.
- **Writing `docs/DECISIONS.md`,** or any file under `backlog/`. Both are outside the step's reach —
  the first by the role's own instruction, the second because `commitAll` reverts it.
- **Shape (4), relocating the cross-tree corpus assertions.** It touches landed, reviewed tests in
  two packages. If the AC-4 guard turns out to be impractical, stop and report; do not relocate
  tests to make the configuration easier.
- **The spike suite.** `npm test --prefix spike` is not a turbo task and hashes nothing. Unchanged.
- **Remote caching, `boundaries`, `tags`, a `build` task, or any turbo feature this repository does
  not use today.**
- **`harness/harness.yaml`, `packages/shared/package.json`'s `exports`, and the shipped
  `spike/templates/`.** No adopter receives `turbo.json`; there is no cold-clone surface here.
- **Re-deriving the two probe results from the ticket body's prose.** The prose predates the
  measurements and the measurements supersede it.

## Open questions

- **OQ-1 — Which shape? (blocker; owner: Ruud, at the gate.)** The requirement is written against
  **(2) per-task `inputs` as `["$TURBO_DEFAULT$", …out-of-package globs…]` plus (3) `dependsOn:
  ["^lint"]`, `["^typecheck"]`, `["^test"]`**, because a precise input set is the same claim this
  repository makes everywhere else — a tick names what it examined — stated in the file the runner
  reads. Its one real objection is drift, which AC-4 answers. The alternative is **(1)
  `globalDependencies`**: zero drift risk, one place, and over-broad — any `docs/` edit invalidates
  all 21 task-package pairs, at a measured cost of roughly one full cold workspace run. If Ruud
  picks (1), **AC-5 is struck and AC-4 becomes unnecessary**; everything else stands. Absent an
  answer at the gate, the implementer takes (2)+(3).
- **OQ-2 — Glob granularity? (non-blocking; owner: implementer.)** Directory-level (`docs/**`,
  `spike/src/**`, `harness/**`, `contracts/**`, `backlog/**`) or file-level. Recommendation:
  directory-level, because file-level is precisely where drift bites — a new read inside a covered
  tree then needs no configuration change. The cost is that `@quorum/core#test`, the 27-second one,
  re-runs on any `docs/` edit.
- **OQ-3 — Does `turbo.json` accept comments? (non-blocking; owner: implementer.)** Verify against
  this turbo rather than assume. If it does, one line naming the claim belongs beside the
  declarations; if not, AC-7's prose in `docs/04-architecture.md` carries it alone.
- **OQ-4 — Should AC-8 be severed? (non-blocking; owner: Ruud.)** It is the one criterion here that
  is not about hashing. It is cheap and adjacent — both are "what is this tick claiming" — but if it
  is dropped at the gate, a successor ticket body must be written there, not merely promised.
- **OQ-5 — Does turbo already fold `turbo.json` into every task hash? (non-blocking; owner:
  implementer.)** If it does, declaring it as an input for `core` is redundant and harmless; verify
  rather than reason about it.

## Risks

1. **The declared set drifts from the read set.** The failure mode is identical to today's and just
   as quiet. AC-4 is the whole mitigation; if it is weak, the ticket buys one clean afternoon.
2. **`../`-escaping globs are unproven outside a dry run.** They have not been exercised through a
   real cache *write and restore*, inside a git worktree, or on CI's checkout. AC-3 covers the
   worktree; the rest surfaces at the first `integrate`, which forces and will therefore fail loudly
   rather than quietly.
3. **`dependsOn` changes more than hashing.** It adds ordering edges, and it changes what
   `--filter @quorum/core` runs — including the probe invocation Q-0065 AC-8 pins in
   `real-cli.probe.test.ts`, which would then also run `@quorum/shared#test`. The assertion is on
   the file's text so it still passes, but the documented command's behaviour moves, and that
   belongs in the summary rather than in someone's surprise.
4. **`backlog/**` as an input to `@quorum/shared#test` means every ticket edit invalidates it** —
   which is correct, and is exactly the miss Q-0071's evening produced. It also means the run's own
   ticket folder moves the hash mid-run. Harmless while `integrate` forces; worth naming so it is
   not rediscovered.
5. **The local loop gets slower**, and this repository has already accepted that trade twice. The
   difference here is that the cost lands on the `maintainer`'s own keystrokes rather than on a
   runner, so AC-11's numbers are what make it a decision instead of a preference.
6. **This is machinery the flows depend on** — the 2026-08-23 rule. The chore route is right and the
   exposure is bounded: `integrate` runs the very suites whose hashing is changing, forced, so a
   mistake fails the run rather than blessing it. `commands.test` is not changing, so Q-0065's
   snapshot-at-run-start problem does not apply.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example touches a key. The one adjacency is AC-10: the `QUORUM_REAL_CLI` declaration selects paid probes and must keep moving the task's hash. |
| **Worktree safety** | No flow writes to the user's tree. The relevant property is the reverse — the configuration must resolve *inside* a worktree, since `integrate` runs there against the main checkout's cache. AC-3. |
| **Gate behaviour** | Unchanged. Chore's gates and `cross_vendor: required` stand. |
| **File format and schema** | `turbo.json` against `node_modules/turbo/schema.json` (AC-10). No Quorum file format changes, so no zod schema in `packages/shared` moves. |
| **Lint rules** | ESLint does not read `turbo.json`. Q-0069's rule is a *beneficiary* of AC-2, not a subject. |
| **Glossary** | No new term. "Cache hit" is turbo's vocabulary, not Quorum's, and is used only in prose about the build. |
| **Cold-clone impact** | None for an `adopter` — `turbo.json` is this repository's own configuration and `harness init` does not copy it. Marginally slower for a `contributor`'s first `pnpm test`, which executes rather than replays. |
