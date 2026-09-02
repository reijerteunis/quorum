---
id: Q-0097
title: The workspace emits JavaScript
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0097/integration
priority: p1
created: 2026-09-02
iterations:
  chore.review: 3
history:
  - stage: draft
    run: 1
    flow: requirements
    status: aborted
    stage_before: draft
    stage_after: draft
    at: 2026-09-02T08:28:07.068Z
    cost: 7.587
  - stage: requirements
    run: 2
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-02T08:52:37.359Z
    cost: 8.176
  - stage: requirements
    run: 3
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-02T10:59:26.431Z
    cost: 0
  - stage: requirements
    run: 3
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-02T11:32:27.063Z
    cost: 0
  - stage: reviewed
    run: 3
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-02T12:25:23.882Z
    cost: 75.628
---
Split from **Q-0096** at its requirements gate on 2026-09-02, where the merged requirement measured
**21 criteria against a ceiling of fifteen** and cut the ticket in three. This is **B**, the middle
one. Q-0096 keeps the export surface (AC-1 to AC-6) and runs first; **Q-0098** takes the binary and
the packaging (AC-15 to AC-21) and runs after this one. Order: **Q-0096 → Q-0097 → Q-0098 → Q-0095**.

The requirement's own reason for cutting here: *"three of the four review loops this project has run
over a twenty-criterion ticket reached their exhaustion gate."* The seam falls on two dependency
edges that already exist — Q-0096's half needs the emit **decision** and not the emit **artifact**,
and Q-0098's half needs the artifact.

**The full merged requirement is `backlog/Q-0096-the-workspace-emits-javascript-and-quoru/requirements/merged.md`.**
Its §M-6, §M-7, §M-10, §3 and §8 are this ticket's background. It is named rather than transcribed
only for the *narrative*; every criterion below is written out in full, because `input.backlog`
resolves against **this** folder and nothing injects a sibling's document into this ticket's run.

## The precondition, and it is absolute

**AC-0's decision entry is written and landed — *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02).** It rules the emit strategy, whether the suites resolve source or emitted output, what
`outputs` a build task declares and **whether `build` is a root task at all**. `developer-generalist`
is forbidden to write a decision entry (`harness/roles/developer-generalist.md:23`), so an implement
step handed a criterion that depends on an absent ruling has one channel: prose the human does not
read until the gate.

This is the **tenth** appearance in this repository of a loop handed work no step in it can perform.
The ninth was Q-0062, whose requirement named the hazard by name and whose run was launched without
the entry anyway — three implement rounds and an exhaustion gate before round 3 refused correctly and
supplied a draft. Round 2 of that run, handed a blocker it could not clear, answered by adding a
**sixth** citation of the absent entry. Do not launch this ticket until 078 is in the index.

## Acceptance criteria

Numbering is preserved from Q-0096's merged requirement so citations across the three tickets
resolve. *Test:* sketches are the implementer's starting point, not a frozen contract — where one is
wrong, an erratum corrects it **during** the loop, as soon as the contradiction is provable (*"An
erratum is the last repair, not the first"*, 2026-08-30).

**AC-7 — a `build` task exists, declares real `outputs`, and orders itself by dependency — workspace.**
Declared where the ruling puts it, with `dependsOn: ["^build"]` so one root invocation from a clean
checkout produces prerequisites before consumers, with no manual command and no prior typecheck or
test. Its `outputs` are non-empty, which is the property distinguishing it from all three existing
tasks — `lint`, `typecheck` and `test` still declare `[]`. Root `turbo.json` already declares
`^lint`/`^typecheck`/`^test`, so this joins an ordering convention rather than inventing one.
*Test:* read `turbo.json` and every package-level `turbo.json` (`cli`, `core`, `shared` today);
assert the build task's `outputs` is a non-empty array and the other three are empty. Assert a
package configuration declares `inputs` and nothing else, so root `turbo.json` stays the one place
`env` is decided and the merge keeps `QUORUM_REAL_CLI` (Q-0065). `packages/cli/src/package.test.ts`
already asserts `not.toContain('"outputs"')` for that file — if the build task lands there, that
assertion is **reconciled deliberately and its comment corrected**, never deleted, and the reconciled
form is shown failing against a config that also declares `env`.

**AC-8 — the declared outputs cover exactly what the build writes — workspace.**
Verified by building into a clean tree and comparing emitted paths against the declaration, not by
reading the declaration — *"A check is not established by reading it"* (2026-08-29). Under-declaring
is the stale-artifact hazard in its exact form; over-declaring a whole package directory is equally
refused.
*Test:* build into a tree with the generated directories removed; enumerate what was written; assert
set equality with the declaration, in both directions.

**AC-9 — a replayed build is executable — workspace.**
Clean build, cache preserved, **declared artifacts deleted**, the same build re-run to obtain a cache
hit, and the restored artifact then executed or imported successfully. This establishes that a hit
restores a **usable artifact** rather than reporting a prior verdict — the property no existing task
in this workspace has ever needed, since all three declare `"outputs": []`.
*Test:* assert the cache hit occurred (turbo's own summary), assert the artifact is on disk again,
and execute it.

**AC-10 — a changed input cannot execute a stale artifact — workspace.**
Build, change a tracked source or build-configuration input that affects emitted output, rebuild
through turbo, and prove the **executed** artifact reflects the change.
*Test:* the verdict depends only on tracked files, lockfile-installed dependencies and files the test
creates — never on a pre-existing ignored `dist/`, on user-level configuration or on account identity
(*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).

**AC-11 — repeated builds do not depend on leftovers — workspace.**
The build succeeds with generated directories absent and with output from an earlier build present,
and produces the same declared artifacts for the same tracked inputs. A removed or renamed source
entry point does not remain executable because an old emitted file survived.
*Test:* build, rename an entry point, rebuild, assert the old emitted path is gone.

**AC-12 — the artifact is invisible to every source scan, and `frame.source.test.ts` regains its two promises — `packages/cli`.**
That file's `GENERATED` register is `['node_modules', '.turbo']` at `:73`, pinned by identity with
`toStrictEqual` at `:298`, and its header makes two promises that break the moment a build writes
under `packages/cli`: that *"emitted output is deliberately not among them"* because the layout is
Q-0096's to choose, and that **"no verdict below depends on whether this checkout has run a build"**.
`packageFiles()` walks the package in any extension with only those two names pruned, so an emitted
copy of `frame.source.test.js` — which quotes every credential pattern — lands in the scan and the
credential assertion goes red.
*Test:* the register gains the emit directory as an **identity, not a count** (Q-0073), with a
fixture demonstrating the new entry excuses a real file, derived from the list as the existing loop
is, so a fourth entry arrives with a subject or fails. Show the credential scan **red** against a
tree carrying an emitted copy of a test file *before* the exclusion lands — which is what proves the
exclusion has a subject rather than being a precaution. Assert the credential scan and the
signal-handler scan return identical verdicts with the artifact present and absent. Assert
`git check-ignore -v` resolves the emitted path to a rule in `.gitignore` (`dist/` at line 4 already
matches, if `dist/` is chosen), that `eslint.config.js:19`'s `**/dist/**` covers it, and that
`packages/core/src/git-identity.test.ts`'s `walk` skips it — three of the four places that must know
already do, and the fourth is the one that fails closed.

**AC-13 — the task registers are derived, or their claims are corrected — `packages/core`, `packages/cli`.**
**The decisive finding of Q-0096's second iteration, and it was verified by hand at the gate rather
than taken from the report.** `packages/core/src/test-discovery.test.ts:59` declares
`TASKS = ['lint','typecheck','test']` under the doc comment *"The three tasks the root `turbo.json`
declares, and therefore the three every package owes"*, and `packages/cli/src/package.test.ts:76`
inlines the same array under the test name *"declares the three tasks turbo runs"*. **Neither is
derived.** Add a `build` task and both stay at three, both comments become false, and turbo silently
skips every package with no `build` script — verbatim the failure the first guard's own describe
block exists to close (*"A package with no `test` script is skipped by turbo in silence"*), and the
`q0050.source.test.ts` fail-open shape Q-0051 found. The first guard's `PACKAGES` half **is** derived
from the workspace globs *"so a package added later is covered without anyone remembering"*; the
asymmetry is that a package added later is covered and a task added later is not.
*Test:* derive the task list from root `turbo.json` so the register cannot narrow in silence, **or**
— if AC-0(c) rules that `build` is not a root task, or not owed by every package — correct both doc
comments to state what is actually asserted and why the set is three rather than four. Either way,
demonstrate the register red first: with the old hand-written array and a `build` task present, show
that a package lacking a `build` script passes unnoticed.

**AC-14 — the harness commands, CI, the sweep and `shared-resolution.test.ts`'s stated reason are changed or demonstrated unchanged — repository.**
`harness/harness.yaml`'s `commands.install` and `commands.test`, `.github/workflows/ci.yml`'s
`workspace` job, and `.github/scripts/git-identity-sweep.sh`, whose phases are `isolation`, `probe`,
`install`, `spike suite`, `workspace suite`. Under Shape A none needs to change, because `test` gains
no `^build` edge; under Shape B all three do. **And `packages/core/src/shared-resolution.test.ts:4`**
states as its reason that *"`turbo.json` has no `build` task and `tsconfig.base.json` emits nothing,
so `@quorum/shared` resolves from its TypeScript source"* — Q-0041's AC-1 resolution proof, whose
stated authority this ticket falsifies while the test keeps passing. Verified present at the gate.
*Test:* if a file is unchanged, **assert it with the reasoning**, so a later reader knows the
question was asked rather than missed. If changed, the `--force` guard in `project.test.ts` and the
executes-not-replays guard in `test-command.test.ts` must both still hold, and
`test-command.test.ts`'s `CI_JOBS` register of seven jobs — pinned by `toStrictEqual` — is updated: a
build **step** inside the existing `workspace` job leaves it alone, a new **job** does not. The
`shared-resolution.test.ts` header is corrected in the same change, since a comment naming an
authority that has stopped being true is what `engineering.md` forbids.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. If a change there is genuinely required, stop and say so.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.**
4. **`packages/core` already holds the logic** — look there before porting anything.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   re-derived rather than adjusted.

## Gate obligations

**GO-1 — AC-0's entry is landed**, *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02), written by hand at Q-0096's requirements gate on
the Q-0058 and Q-0069 precedent. This obligation is discharged; the criteria below are read against
that entry's ruling and a criterion contradicting it is closed by an erratum, not by a round.

**GO-2 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on still
has no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31). If the
review loop produces a finding contradicting a ground rule or AC-0's ruling, the remedy is an erratum
written **during** the loop as soon as the contradiction is provable, not at the exhaustion gate.

**GO-3 — `harness/Q-0097/integration` must exist before the first chore run**, per
`docs/02-sdlc-pipeline-spec.md` §5.8: `review` diffs against that branch and only `integrate`, which
runs later, creates it. A first-pass run refuses in the preflight rather than billing (Q-0038).

**GO-4 — Q-0039 is unfixed.** Do not run this ticket concurrently with Q-0096 or Q-0098: two runs on
one ticket share a worktree and compute the same run id, and there is no lock of any kind in either
tree.

## Non-goals

- The export surface of `@quorum/core` — **Q-0096's**, and it runs first.
- The `bin` target, the shebang, the packed tarball and what `npx quorum` may claim — **Q-0098's**.
- Publishing to the public registry — **Q-0029's**, in M6.
- Any change to `spike/`.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, split from **Q-0096**.
