# Errata — Q-0098

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30). An erratum states what was **run**, not what was reasoned: Q-0097's run
cost two of them by writing one from a claim, and both entries here are measurements.

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

## E-2 — AC-18's shim mechanism needs an install *after* the build, and the fixture performs one — 2026-09-02

**Ruled: AC-18 is unchanged in what it must prove. The fixture may run the workspace's own
`pnpm install --frozen-lockfile` after building, because the shim is an install-time artifact and
decision 078(b) guarantees no build has run by install time.** Written by hand after chore run 2
aborted at `integrate` with the suite red, which is the first time the change was executed.

### What failed, and the experiment that explains it

`integrate` merged, installed to exit 0, and the suite exited 1 on **two** AC-18 tests:
`node_modules/.bin/quorum` did not exist, and `pnpm exec quorum help` exited **254**.

Measured in the integrate worktree rather than reasoned about:

- with `packages/cli/dist/quorum.js` **absent** at install time, `pnpm install --frozen-lockfile`
  links **no** `node_modules/.bin/quorum`; and
- re-running the identical command once the artifact exists **creates the shim** — *"Already up to
  date"*, 182 ms.

So **pnpm links a bin shim during install, and only where the target exists.** The fixture's own
`runBuild()` creates the artifact but cannot retroactively make a completed install link anything.

### Why the mechanism was not wrong to choose, and why it is not a slip

AC-18 offered exactly two mechanisms and required one to be chosen deliberately — *"Choosing by
accident is what is refused."* Mechanism A was chosen with a measurement behind it, and review
round 1 correctly made the fixture invoke `pnpm exec` rather than the shim file. Nothing in that
chain is careless.

What neither the criterion nor the reviewer had is the interaction with **078(b)**, which
deliberately gives `test` no `^build` edge so that no existing verdict moves behind a build artifact.
That guarantee has a consequence nobody drew: from a clean checkout the order is **install → test**,
so `dist/` is *guaranteed* absent when install runs, and therefore **any assertion resting on a pnpm
bin shim depends on a build having preceded an install** — which 078(b) guarantees will not have
happened. The implementer's worktree had built before installing, so the shim was there, and the
verdict was a property of the order that checkout happened to run things in rather than of the
commit (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
2026-08-30). `packages/cli/src/package.test.ts:69` had recorded the same absence for the narrower
reason that nothing depended on the package; making something depend on it removed that reason and
left this one.

### The ruling

The fixture links the shim itself, by running the workspace's own
`pnpm install --frozen-lockfile` **after** `runBuild()` and before asserting. Three things make this
the honest form rather than a convenience:

1. **It adds no task-graph edge.** 078(b)'s prohibition is on `test` depending on `build` in
   `turbo.json`, so that the workspace's other 1,500-odd verdicts keep proving source. A fixture that
   builds and installs inside itself moves no other verdict; `build.test.ts` already calls
   `runBuild()` for the same reason.
2. **It is the sequence a contributor actually performs** — install, build, then use the command. The
   criterion is about the documented workspace path, and this is that path.
3. **It is idempotent and bounded**: measured at 182 ms with nothing to do, and it only ever *adds*
   the shim install would have created had the artifact existed.

**The side effect is registered rather than hidden.** The fixture writes to the developer's
`node_modules/.bin`, which Q-0073 objects to in the general case. It is accepted here because the
write is exactly the one a correct install performs, is self-correcting on the next install, and the
alternative is no coverage of AC-18's documented mechanism at all. The fixture says so in place.

### What this does not do

It does not weaken AC-18, which still proves that `pnpm exec quorum help` runs and resolves locally
under `offline()`. It does not touch AC-20's negative half, which is sound and does **not** rest on
the shim: it probes a deliberately absent name and asserts the message says *"not found"*, so it
passes for its own reason rather than for want of a subject. And it does not alter
`harness/harness.yaml`, CI, or the sweep, which AC-14 of Q-0097 requires to stay as they are.
