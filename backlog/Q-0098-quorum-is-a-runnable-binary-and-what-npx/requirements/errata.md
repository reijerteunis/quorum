# Errata — Q-0098

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30). An erratum states what was **run**, not what was reasoned: Q-0097's run
cost two of them by writing one from a claim, and this one is a measurement.

## E-1 — every pack count in §3 is a built-checkout count, so no criterion may take its verdict from one — 2026-09-02

**Ruled: AC-19 asserts over the declared `files` allow-list and the entry point, and never over a
file count, a byte size, or the absence of build output.** Nothing in `merged.md` is false and no
criterion is narrowed; what is added is the environment the numbers were taken in, which the document
does not record.

**Written at the requirements gate, before the chore run**, because the hazard is one an implementer
would otherwise meet as a red suite in an environment row nobody chose.

### The measurement

`packages/*` carry **no `.npmignore` and no package-level `.gitignore`**, and npm consults ignore
files in the package directory only — it never reads the repository root. §3 M-7 establishes this.
The consequence it does not draw is that the root `.gitignore`'s `dist/` and `.turbo/` entries have
no effect on packing, so **gitignored build output ships, and every count therefore depends on
whether the checkout has ever run a build.** Measured 2026-09-02 at `51c56f5`:

| package | packs here | of which build output | a fresh clone packs |
| --- | --- | --- | --- |
| `@quorum/cli` | 40 | 18 (14 `dist/`, 4 `.turbo/`) | **22** |
| `@quorum/core` | 167 | 66 | **101** |
| `@quorum/shared` | 52 | 24 | **28** |

§3's three figures — 40, 167 and 52 — are all the left-hand column. They are correct and they are
**not** properties of the commit.

### Why this is a ruling and not a note

*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30). An
AC-19 assertion of the shape *"the tarball contains N files"* or *"the tarball contains no build
output"* is green in a fresh clone and red in any checkout that has built — and **red everywhere,
including CI, the moment a `build` runs before `test`**.

This is not hypothetical and not new. It is exactly the assertion Q-0096's **E-1** retired, one
ticket ago, for the identical reason: requiring `ERR_MODULE_NOT_FOUND` was green in a fresh clone and
red wherever `dist/` existed. The same trap, one layer out, in the same subsystem.

Declaring `files` removes the dependence, because an allow-list decides the contents instead of the
checkout doing it. That is an argument for **asserting the allow-list**, not for assuming the problem
self-corrects: an assertion written today, before `files` lands, is written in the built row.

### The trap in the `cli` figure specifically, which survives the obvious re-measurement

The arithmetic resolves exactly. Tracked files under `packages/cli` were **19** at Q-0096's gate
(`729dcb3`) and are **22** now, Q-0097 having added `build.test.ts`, `build-fixture.test.ts` and
`tsconfig.build.json`. So:

- the inherited figure decomposes as **19 tracked + 3 turbo logs = 22** — three, not four, because
  there was no `build` task then to write `turbo-build.log`; and
- today's decomposes as **22 tracked + 4 logs + 14 `dist/` = 40**.

**A fresh clone today packs 22 — the same number as the inherited figure, from a different set of
files.** Anyone re-measuring in a clean checkout to test the ticket body's claim gets 22, matches it,
and concludes nothing has changed. `merged.md` §3 says *"22 files, 90.6 kB is Q-0096's gate figure
and is superseded; do not transcribe it"*, which is the right instruction with the wrong reason: the
number is not stale, it is **environment-dependent and coincidentally equal**, which is worse,
because it survives the check a careful reader would run.

### What this does not do

It does not touch M-7's three-tarball ruling or M-8's finding that `@quorum/cli` cannot install from
its own tarball alone, both of which stand and are the larger findings. It adds no criterion. It
constrains **how** AC-19 is tested and not **what** it must achieve, which is the distinction Q-0097's
withdrawn E-1 failed to observe when it narrowed a criterion to fit an implementation nobody had
attempted yet.
