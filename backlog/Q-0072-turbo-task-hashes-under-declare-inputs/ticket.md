---
id: Q-0072
title: Turbo's task hashes under-declare their inputs
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0072/integration
priority: p2
created: 2026-08-27
iterations:
  chore.review: 3
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-28T05:24:26.510Z
    cost: 6.052
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-28T07:08:26.371Z
    cost: 0
---
Found by Q-0071's requirements run, 2026-08-27, which correctly declined to fix it: that ticket's
subject is CI's tick, this defect is equally present in a developer's local `pnpm test`, and the
remedy is a decision about how this workspace declares what a task depends on.

**The defect.** `turbo.json` declares **no `inputs` and no `dependsOn`**. Its only root-relative
declarations are four `globalDependencies` — `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`,
`vitest.shared.js`. Turbo's default input set is otherwise package-scoped, so a task's hash moves
only when a file inside its own package changes.

Both suites assert on files outside their own package. `@quorum/shared` reads `docs/02-…`,
`docs/03-…`, `docs/04-…`, `docs/DECISIONS.md`, `docs/GLOSSARY.md`, `harness/harness.yaml`,
`spike/src/**`, `spike/bin/harness.js`, `spike/templates/harness/harness.yaml`, and three files
under `packages/core`. `@quorum/core` reads `docs/03-…`, `docs/04-…`, `turbo.json`,
`contracts/Q-0006/**`, `contracts/Q-0011/**`, `backlog/Q-0006-…/ticket.md`, `pnpm-lock.yaml`, and
several files under `packages/shared`. None of it moves a hash. **Re-derive the exact hashed-input
set with `turbo run test --dry=json --no-daemon` before designing against it** — Q-0071's
requirement quotes counts of 24 and 56 files from one such run and did not re-run them, and this
repository has had three inherited measurements turn out wrong in a week.

**The demonstration.** `packages/shared/src/project.test.ts:130` carries a block titled *"Q-0065
AC-3 — the configured test command defeats this repository's cache"*, asserting that
`harness/harness.yaml`'s `commands.test` forces turbo. `harness/harness.yaml` is not one of that
task's hashed inputs. Delete `--force` from `harness.yaml` and the hash does not move; a cached
`pnpm test` replays green over the guard written to catch exactly that. **Q-0065's enforcement is
invisible to the cache it defeats.** The same is true of `packages/core/src/test-command.test.ts`
asserting over `turbo.json` and over `spike/src/**`, and of every corpus assertion the port freeze
depends on.

**The second axis.** `turbo.json` declares no `dependsOn`, and `packages/shared/package.json`
exports `./src/index.ts`, so `core` compiles `shared`'s source directly — yet a change in `shared`
invalidates none of `@quorum/core`'s `test`, `lint` or `typecheck` hash. Q-0069's
`@typescript-eslint/no-deprecated` is type-aware and reads `shared`'s declarations while linting
`core`: a deprecation introduced in `shared` leaves `core`'s lint tick cached and green.

**Why it survives Q-0071.** That ticket makes CI execute everything and `integrate` already
forces, so both gates are honest regardless of the hashes. What remains is a developer's local
`pnpm test`, every future path that trusts a hit, and the fact that this repository's cache
currently means something other than what it appears to mean.

**Shapes, none decided.** (1) Add the shared out-of-package corpus to `globalDependencies` — one
place, and over-broad: any edit under `docs/` would invalidate every task in every package,
including `lint` and `typecheck`, on a repository where `docs/` changes constantly. (2) Declare
per-task `inputs` as `["$TURBO_DEFAULT$", …]` plus the out-of-package globs each package actually
reads — precise, and **verify first whether turbo 2.10 accepts a `../`-escaping glob in a package
task's `inputs` at all**; historically package inputs are package-relative and cannot escape, and
designing around a capability that does not exist is how a chore round is wasted. (3) Add
`dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]` for the cross-package half — standard, and
it changes task ordering as well as hashing, so state that consequence rather than discover it.
(4) Move the cross-tree corpus assertions into a task whose inputs can legitimately cover them —
heaviest, and it touches landed reviewed tests in two packages.

**Also decide what the cache means afterwards**, and say it where a reader meets it: after this
ticket a hit should mean "nothing this task reads has changed", and today it means "nothing inside
this package has changed". Those are different claims and only one of them is worth trusting.

**Measured 2026-08-28, before the requirements run.** Both of this body's *verify first*
instructions were carried out against turbo **2.10.11** on a clean tree, reading `tasks[].inputs`
and `tasks[].hash` from `pnpm turbo run test --dry=json`. `turbo.json` and every probed file were
restored afterwards; `git status` is clean. Do not re-derive these from the prose above — it was
written before them.

- **The hashed-input set is package-relative and nothing else.** `@quorum/shared#test` hashes
  **24** files and `@quorum/core#test` **56** — the two counts Q-0071's requirement quoted, which
  therefore hold, in a repository where three inherited measurements failed in a week. Every entry
  is package-relative (`src/**`, `test/**`, `package.json`, `tsconfig.json`, `vitest.config.js`);
  the only root-relative inputs anywhere are the four `globalDependencies`. None of `docs/`,
  `harness/`, `spike/`, `contracts/`, `backlog/`, `pnpm-lock.yaml` or `turbo.json` appears in
  either set. `dependencies` and `dependents` are `[]` for all seven tasks.
- **Both axes reproduce.** Appending one line to `docs/GLOSSARY.md` leaves both hashes
  byte-identical (`@quorum/core 1b9dcd308b9b89fc`, `@quorum/shared 7152b03db47071bb`, before and
  after). Appending one line to `packages/shared/src/constants.ts` moves `shared`'s hash to
  `b6aa5348de10c90d` and leaves `core`'s at `1b9dcd308b9b89fc` — **unchanged**.
- **Shape (2) is available: turbo 2.10.11 does accept a `../`-escaping glob in a package task's
  `inputs`.** With `"inputs": ["$TURBO_DEFAULT$", "../../docs/**", "../../harness/harness.yaml"]`
  the dry run lists those ten files in both packages' hashed sets (24 → 34, 56 → 66), exits 0 and
  emits no warning about the escape; an edit to `docs/GLOSSARY.md` or to `harness/harness.yaml`
  then moves both hashes. The caution written into shape (2) — that package inputs *"historically
  are package-relative and cannot escape"* — does not hold for this version, so it is no longer a
  reason to prefer another shape. **Not tested:** whether a real (non-dry) run honours the escaping
  glob when writing and restoring a cache entry, and how it behaves on CI's checkout.
- **Shape (3) works as expected, and adds edges.** With `"dependsOn": ["^test"]`, the same edit to
  `packages/shared/src/constants.ts` moves `@quorum/core#test`'s hash. It also creates task-graph
  edges where there are none today, which is the ordering consequence the shape says to state
  rather than discover.
- **The cache is live, not theoretical.** The baseline dry run reports `@quorum/core#test` as
  `"status": "HIT"` with `"timeSaved": 28507` ms against a cache entry built at `5576ebb`.

Needs its own `docs/DECISIONS.md` entry — Ruud's to write; the implementer names it. Belongs to M2.

**One more consequence, added at Q-0071's gate rather than by that requirement.** CI now invokes
`pnpm turbo run <task> --force` directly instead of `package.json`'s `lint`, `typecheck` and `test`
scripts, so those scripts are no longer what CI runs. They are identical today and nothing asserts
that they stay so — a later edit to one of them would silently not reach CI. Whether that wants a
guard, or wants CI to go back through the scripts with the force expressed some other way, belongs
with this ticket's question about what a cached result is claiming.

Belongs to M2 in `docs/06-development-plan.md`.
