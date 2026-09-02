---
id: Q-0098
title: quorum is a runnable binary, and what npx quorum may claim
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0098/integration
priority: p1
created: 2026-09-02
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-02T13:28:04.292Z
    cost: 9.431
---
Split from **Q-0096** at its requirements gate on 2026-09-02, where the merged requirement measured
**21 criteria against a ceiling of fifteen** and cut the ticket in three. This is **C**, the last one.
Q-0096 keeps the export surface (AC-1 to AC-6), **Q-0097** takes the build task and the emit
(AC-7 to AC-14). Order: **Q-0096 → Q-0097 → Q-0098 → Q-0095**. This ticket needs Q-0097's artifact.

**Q-0095 needs this ticket's binary half and not its packed half**, which is why AC-19 and AC-20 sit
**off M2's critical path** and AC-15 to AC-17 do not. If the run is at risk of exceeding its bound,
that is the seam to cut on — not the credential and registry-resolution guarantees.

**The full merged requirement is `backlog/Q-0096-the-workspace-emits-javascript-and-quoru/requirements/merged.md`.**
Its §M-2, §M-3, §M-9 and §3 are this ticket's background. Every criterion below is written out in
full, because `input.backlog` resolves against **this** folder and nothing injects a sibling's
document into this ticket's run.

## The precondition

**AC-0's decision entry is written and landed — *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02)** — and it is Q-0097's precondition too. Two of its seven clauses are this ticket's directly:
**(d)** what `npx quorum` may claim before Q-0029, and **(e)** where the artifact sits and what
`files` must carry — `spike/bin/harness.js:321` resolves shipped templates as
`path.join(here, '..', 'templates', 'harness')`, **relative to the binary's own file**, so the
artifact's location is load-bearing for Q-0093's `init`. `developer-generalist` is forbidden to write
a decision entry (`harness/roles/developer-generalist.md:23`).

## Acceptance criteria

Numbering is preserved from Q-0096's merged requirement so citations across the three tickets
resolve. *Test:* sketches are the implementer's starting point, not a frozen contract — where one is
wrong, an erratum corrects it **during** the loop, as soon as the contradiction is provable.

**AC-15 — `quorum help` runs under plain `node`, from a clean clone, and exits 0 — `packages/cli`.**
The full chain: install → build → execute the file `bin.quorum` names → the frame's `HELP` on stdout
→ exit 0. No Vitest anywhere in that chain. The target `./bin/quorum.js` is provisional and may move;
`package.test.ts` deliberately asserts only that the key carries a non-empty string, its comment
naming *"an extensionless launcher, a `dist/` layout"* as legitimate choices here.
*Test:* resolve `bin.quorum` from the manifest, spawn it with `process.execPath`, assert stdout
carries the command list and `status === 0`. **Demonstrated red before green** — against `main` the
target does not exist and the spawn fails `ENOENT`, and that red must be *shown*, because a test
passing for want of a subject is this repository's most-recorded defect (*"a check that skips its
subject must not report success"*, 2026-08-25).

**AC-16 — the artifact carries a shebang and is executable — `packages/cli`.**
`#!/usr/bin/env node` as the **first** bytes, matching `spike/bin/harness.js:1`, with the mode bit
set. A banner emitted after any other byte does not work.
*Test:* read the first line; `fs.statSync(...).mode & 0o111` is non-zero. On a platform without POSIX
modes the mode assertion is skipped **and says so** rather than passing silently.

**AC-17 — the exit-code table survives the process boundary — `packages/cli`.**
Q-0090 owns 0, 1, 2, 130 on signal, and **3 for `undecided`** (Q-0040), proven in process today.
This proves at least one non-zero code reaches a shell through the built artifact, so the emit is
known not to swallow `process.exitCode`.
*Test:* spawn the binary in a way that yields a known non-zero status; assert the observed code. The
preserved defect this must **not** silently fix: an unknown command prints help and exits **0**
(`main.ts`, *"Why: preserved, see Q-0090 AC-6"*), successor Q-0090 GA-4.

**AC-18 — the workspace path works, and resolves locally — `packages/cli`.**
*Test:* assert the executed path lies inside the workspace package under test. **The criterion must
name the mechanism it asserts**, because there is no shim to test today: `pnpm install
--frozen-lockfile` creates none, since nothing depends on `@quorum/cli` and pnpm is never asked to
resolve the target — measured by Q-0090 and recorded in `package.test.ts:69`'s own comment. Either
something is made to depend on it, or the assertion is over `pnpm --filter @quorum/cli exec quorum`.
Choosing by accident is what is refused.

**AC-19 — a locally packed tarball is runnable, and its contents are a declared contract — `packages/cli`.**
`pnpm pack`, installed into a newly created temporary project outside the repository with no
workspace symlinks and no access to repository `node_modules`, and `quorum help` invoked from it.
The `files` field is declared. **Re-measured by hand at Q-0096's gate on 2026-09-02 rather than
inherited:** `npm pack --dry-run` on this private package **exits 0** and ships **22 files, 90.6 kB
unpacked** — three `.turbo/turbo-*.log` build logs, nine test files including `frame.source.test.ts`
at 17.9 kB, and no `bin` target, with no `files` field to stop any of it. Repository-only material in
exactly the class this criterion rejects, so the contract is load-bearing on day one rather than
hypothetical.
*Test:* inspect the pack manifest; assert it carries the declared entry point and every file the
distribution contract requires, and rejects tests, run artifacts, worktrees and build logs. The
fixture builds its sandbox under `os.tmpdir()` and removes it. `pnpm pack` is confirmed rather than
assumed to honour `files` identically, and a divergence from `npm pack` is reported.
**A registered limit, stated rather than discovered:** `packages/cli`'s only cross-package
**production** import is `import type { RunTerminalEvent }` at `exit.ts:12`, erased at emit — so this
fixture proves the easy case, a CLI with no workspace runtime dependency. It acquires its real
subject at Q-0091's first value import. Either sequence this criterion after Q-0091, or record the
limit in AC-0(g) and in the implement report. Silence is refused.
*Correction carried from the gate, so it is not re-derived wrong:* Q-0096's §M-3 states this as
*"`packages/cli`'s only cross-package import … every other import is package-relative"*. That is true
of **production source only** — `packages/cli/src/exit.test.ts:20` is a cross-package **value**
import of `runTerminalEventSchema` from `@quorum/shared`. It does not change the conclusion, since
tests are not emitted into the binary, and it slightly raises Shape B's measured cost.

**AC-20 — registry resolution cannot satisfy or alter either verdict — `packages/cli`.**
Both paths configure execution so a missing local `quorum` **fails** rather than falling back, and
the packed test additionally points registry access at a test-controlled failing endpoint or gives an
equally explicit offline guarantee. A public package named `quorum` can neither satisfy nor change
the result.
*Test:* assert positively that the executed binary's resolved path is inside the workspace package or
the temporary installation. A network-dependent assertion is refused: it would make the verdict a
property of the machine.

**AC-21 — the documentation separates three claims, and the status line moves — `docs/`.**
`docs/04-architecture.md:7` says *"One command (`npx quorum`) starts a local daemon and opens the
browser UI"* and `:49` says the server *"Serves the built `apps/web`"* — the word *built* already
appears while nothing builds anything. Repository documentation distinguishes the supported
workspace-local path, the supported locally-packed path, and registry-backed `npx quorum`, **which
remains Q-0029's in M6**. No README, architecture document, development-plan bullet, test name or
success message claims a cold machine can obtain Quorum from the public registry.
*Test:* `docs.test.ts` reads this file already; assert the status line carries the landing date and
this ticket. Scan the changed documentation and the new entry for a sentence asserting
registry-resolved `npx quorum`; assert the entry names which two paths are claimed and which is
deferred. If the ruling introduces vocabulary (*build task*, *emitted artifact*), it is defined in
`docs/GLOSSARY.md` before its second use; if it introduces none, that is stated.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. If a change there is genuinely required, stop and say so.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.**
4. **`packages/core` already holds the logic** — look there before porting anything.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   re-derived rather than adjusted.

## Gate obligations

**GO-1 — AC-0's entry is landed**, *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02). What remains is Q-0097: this ticket executes an
artifact, and without Q-0097 there is none.

**GO-2 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on still
has no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31); the remedy
is an erratum written **during** the loop.

**GO-3 — `harness/Q-0098/integration` must exist before the first chore run**, per
`docs/02-sdlc-pipeline-spec.md` §5.8.

**GO-4 — Q-0039 is unfixed.** Do not run concurrently with Q-0096 or Q-0097.

**GO-5 — a pack count is not a property of the commit.** Ruled at the requirements gate on
2026-09-02 and **binding through `requirements/errata.md` E-1, which is where the chore flow reads
it** — `chore.yaml`'s implement step takes `requirements/merged.md`, `requirements/errata.md` and the
review files, and **never this file**, so a rule recorded only here would not reach the implementer.
It is repeated here because a human opening the ticket should not have to find it in an erratum.

`packages/*` carry no `.npmignore` and no package-level `.gitignore`, and npm reads ignore files in
the package directory only — never the repository root — so gitignored `dist/` and `.turbo/` ship and
**every pack count depends on whether the checkout has run a build**. Measured at `51c56f5`:
`@quorum/cli` packs **40** here and **22** in a fresh clone, `@quorum/core` **167** and **101**,
`@quorum/shared` **52** and **28**. The merged requirement's §3 figures are all the built-checkout
column, correctly measured and not properties of the commit.

So **AC-19 asserts over the declared `files` allow-list and the entry point, never over a count, a
byte size, or the absence of build output.** Such an assertion is green in a fresh clone, red in any
checkout that has built, and red everywhere including CI the moment a `build` runs before `test` —
which is precisely the assertion Q-0096's E-1 retired one ticket ago for the same reason.

**And the `22` above is a trap rather than a stale number.** Tracked files under `packages/cli` were
19 at Q-0096's gate and are 22 now, so the inherited figure decomposes as 19 tracked + 3 turbo logs
(three, there being no `build` task then) and today's as 22 tracked + 4 logs + 14 `dist/` = 40. A
fresh clone today packs 22 — the same number, from a different set of files — so re-measuring in a
clean checkout *appears to confirm* the superseded figure.

## Non-goals

- The export surface of `@quorum/core` — **Q-0096's**.
- The build task, its outputs and the replay guarantees — **Q-0097's**.
- **Publishing to the public registry — Q-0029's, in M6.** Asserting registry-resolved `npx quorum`
  is refused here by AC-20 and AC-21, not merely deferred.
- Implementing any command — Q-0091 to Q-0094's.
- Any change to `spike/`.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, split from **Q-0096**.
