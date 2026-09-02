# Errata — Q-0097

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30), as amended by *"A reviewer approves the change it asked for"*
(2026-08-29).

## E-1 — AC-8's exemption set is the five directories `UNAUDITED` names, not `.turbo` alone — 2026-09-02

**Ruled: the *Test:* sketch's exemption clause is superseded; the criterion is unchanged.** Written
by hand at the human's ruling during chore run 3, after review iteration 2 returned it as its single
major and the implement step's only write path — `dev/chore/run-{run}/implement-iter-{iter}.md` — left
it no channel but prose. Q-0083's `blocked` verdict does not exist, which is GO-2's case arriving
exactly as the requirement predicted it would.

### The contradiction

AC-8 carries two clauses that cannot both be satisfied.

The first is its siting, in bold in the criterion: **"It runs against the real workspace, and that
siting is load-bearing"** (R-4, OQ-1) — because with no build step in CI, the forced workspace suite
is the only thing that builds this repository's own packages on every push.

The second is its *Test:* sketch: *"enumerate every path written, and assert set equality with the
declaration in both directions … Turbo's own cache metadata and logs are not treated as package
artifacts."* Read literally, `.turbo` is the **only** exemption the criterion authorises.

**In the real workspace those two clauses contradict each other**, and the proof is this run.
Measured 2026-09-02 while chore run 3's implement step was executing:

- `.quorum/runs/Q-0097-3/` — **this run's own history**, being written by the harness as the suite
  that contains the test runs; and
- `.harness/worktrees/harness__Q-0097__implement` — **this run's own worktree**.

A test that enumerated those directories would take its verdict from whichever harness activity
happened to be in flight. That is *"A test's verdict is a property of the commit, not of the checkout
or the account"* (2026-08-30), and the two directories are the exact pair Q-0072's closing finding
names — present in a working checkout, absent in a fresh clone and in a linked worktree.

`node_modules` and `.git` are unexempted by the same literal reading and fail for their own reasons:
`.git` is an object store git rewrites on its own schedule, and content-hashing an installed
dependency tree on every suite run buys a flake and a large bill rather than a guard.

### The ruling

**AC-8's exemption set is the five entries of `UNAUDITED` — `node_modules`, `.git`, `.turbo`,
`.harness`, `.quorum` — each carrying its reason in place, and everything else in the repository is
audited.** The criterion's substance is unchanged: set equality in both directions, over an
enumeration of what the build *wrote*, against the declaration.

The scope this leaves is wide rather than residual, and that is what makes the ruling proportionate.
Review iteration 1's two majors were both real and are both closed: the audit now fingerprints
**content and modification time** rather than path names, so a build that *overwrote* a tracked
source, a manifest or a configuration is visible where a name-snapshot subtracted it away; and it
walks from the **workspace root** rather than per emitting package, so a write to the repository
root, to `docs/`, to `spike/`, or into a package that emits nothing is in scope. What remains
unaudited is an install, a version-control store, a build tool's own cache, and two directories the
running harness owns.

**The accepted limit is stated rather than left to be found:** a build that wrote *into* one of the
five would be invisible. Nothing does — each emitting package's build script is
`rm -rf dist && tsc -p tsconfig.build.json`, and `tsc` writes only under its `outDir`. The limit is
theoretical today and the register is what makes a sixth entry a visible act rather than a quiet one.

### The alternative the reviewer proposed, and why it is not taken

The finding offers a second remedy: *"running the audited build in an isolated workspace … while
retaining the separately required real-workspace build proof."* **It is coherent, and it is refused
on proportion rather than on principle** — which is worth recording, because a later reader should
not think it was misunderstood.

It splits AC-8 into two criteria: a real-workspace build that proves the emit happens on every push,
and an isolated-workspace audit that proves exact output-set equality without concurrency. That buys
coverage of the two harness directories and of `node_modules`. It costs a further implement round on
a ticket that has already billed $50.09 across two, and it buys it against a blind spot no shipped
build script can reach. AC-9, AC-10 and AC-11 already run against a temporary workspace by OQ-1's
ruling, so the isolated half of the machinery exists; if a build script ever writes outside its
`outDir`, that is the shape to adopt, and this paragraph is where to start.

### What this erratum does not do

It does not widen AC-8, does not touch AC-9 to AC-11, and does not excuse the emit directory itself:
**"Assert the emit lands only under the declared directory"** stands unchanged, and the two untracked
files §1 records — `packages/shared/test/corpus.js` and `corpus.d.ts`, which were a missing `outDir`
and are what that clause exists to catch — remain its subject.

It rules on the criterion's text alone. Whether the shipped code satisfies the ruling is review
round 3's question, not this entry's.

## E-2 — E-1 is withdrawn; AC-8 stands unamended and satisfied — 2026-09-02

**Ruled: E-1 is superseded in full. AC-8's text is not corrected, because it did not need
correcting.** Written at the exhaustion gate of chore run 3, on the precedent of Q-0038's E-3, which
withdrew that ticket's E-2 once round 4 ran the command the amendment had been written to excuse and
AC-12 stood unamended and satisfied.

### What E-1 got wrong

E-1 ruled that AC-8's exemption set was the five entries of `UNAUDITED`, and refused the reviewer's
alternative — an isolated-workspace audit beside a retained real-workspace build proof — **on
proportion**: a further implement round against a blind spot no shipped build script could reach.

Both halves were wrong, and the implement step's answer is the one that holds. The concurrency
defence for `.harness` and `.quorum` is true and **it is an argument for moving the observation, not
for narrowing the criterion.** And the cost objection weighed a round that was already being paid
for: iteration 3 was in flight when E-1 was written, so the alternative cost nothing that the
schedule had not already spent.

E-1 was written by the operator between iteration 3 starting and its review, to give a `retry` a
subject if the loop exhausted. Iteration 3 never saw it — a step's inputs are read when it starts —
and complied with the reviewer instead, which is why the ruling and the code diverged.

### What shipped instead, and why it is better than what E-1 ruled

- The **isolated audit prunes nothing at all** — 187 entries, 28 of them under `node_modules` — and
  the one exemption is applied by **naming** turbo's metadata paths rather than by declining to walk
  the directory that holds them, so what is excused is enumerated rather than assumed.
- The copy carries **tracked files only**, so it is the commit rather than the checkout — *"A test's
  verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) satisfied by
  construction instead of by an exemption list.
- Outside the emitting packages the real-workspace observer is **git** —
  `git ls-files --cached --others --exclude-standard` — so `.git`, `.harness`, `.quorum` and
  `node_modules` **cannot enter the audit** rather than being pruned out of it. That is *"Membership
  is a git question, not a filesystem one"* (2026-08-28) used as the observation strategy the finding
  asked for.
- `UNAUDITED` (five names) became `INSTALLED` (one), and the single remaining prune is justified by
  measurement rather than plausibility: `.vite` and `.vite-temp` are written by the Vitest process
  running the test itself, and the isolated audit descends into `node_modules` regardless, so it is a
  bound rather than a blind spot.
- Measured on a clean isolated build: **108 paths written, 96 under `dist/`, 12 under `.turbo/`, 0
  strays, 0 removals.**

### The finding this withdrawal closes

Review iteration 3's single major is **an artifact of E-1 and not a defect in the change**. It is
correct on its own terms — the code did contradict a landed erratum — and the remedy it names is the
one taken: *"obtain a new human-authored erratum that explicitly supersedes E-1."* The reviewer
enforced a bad ruling faithfully, which is the loop working; the ruling is what moved.

**No code changes on account of this entry.** `INSTALLED`, the isolated workspace and the git-based
outside observer all stand as iteration 3 shipped them.

### The lesson worth keeping

An erratum is the human's instrument and it is written under the same pressure as everything else. This
one narrowed a criterion to fit an implementation that had not been attempted yet, and the
implementation then did better than the ruling — so the erratum became the thing contradicting the
tree. *"An erratum is the last repair, not the first"* (2026-08-30) is usually read as *do not reach
for it early in a loop*; this run is the second reading, that a repair written before the round it
was meant to unblock has reported can be overtaken by that round. Where an erratum exists only to
give a possible `retry` a subject, it can wait for the round in flight to land.

## E-3 — E-2 overclaimed: the isolated audit does not descend through a symlink — 2026-09-02

**Ruled: one sentence of E-2 is corrected. Its withdrawal of E-1 stands in full, and AC-8 stands
unamended.** Written by hand after run 3's closing gate, with the repairs it describes.

E-2 wrote, of `node_modules` being pruned from the real-workspace walk, that *"it is a bound rather
than a blind spot"* **because "the isolated audit descends into it"**. Review round 4 was right that
this is false, and the code says so plainly: `fingerprint` reduced a symlink to `link:<target>`, so a
build that wrote **through** a link — into `node_modules/typescript/lib/…` — would change a file
outside the audited root and no fingerprint would differ. The isolated audit descends into the
*directory of links*, which is what makes a **new entry** beside them visible; it does not follow one.

The error is the operator's and it is the same one twice: E-1 narrowed a criterion to fit an
implementation not yet attempted, and E-2 transcribed an implementation's own claim into a ruling
without running it. **A sentence in an erratum is a measurement like any other.**

### What was repaired, and what was registered

Two majors from review round 4, both verified in the code before they were believed.

**Fixed — `isTurboMetadata` exempted every path with a `.turbo` segment**, not turbo's metadata and
logs, so `.turbo/stray.js` was discarded by the audit while the JSDoc one line above promised that an
artifact hidden beside a log stays reportable. The predicate now names **two measured shapes** — root
`.turbo/cache/<hash>{-manifest.json,-meta.json,.tar.zst}` and `<package>/.turbo/turbo-<task>.log` —
and anything else under a `.turbo` directory is reported. A mutation appends
`echo stray > .turbo/stray.js` to a real emitting package's own build script and asserts the audit
names it while still excusing the log beside it; it is **demonstrated red against the old predicate**
and green against the new one.

The first attempt at that narrowing was itself wrong and is worth recording: it named only the
per-task log, having been derived from the per-package `.turbo` directories alone, and turned three of
the audit's own clauses red by reporting turbo's root cache as strays. The complete set was then
measured across both locations rather than inferred from one.

**Registered, not fixed — a write through a symlink.** `fingerprint` now records a link's
**`realpath`** rather than its raw target, so re-pointing one is caught; following one is not. Closing
it means auditing the whole dependency tree on every run. The bound is written into `fingerprint`'s
own doc comment beside the identical-bytes-and-timestamp bound it already carried, so it is stated
where the next reader meets it rather than in a document they may not open. **No shipped build script
can reach it** — all three are `rm -rf dist && tsc -p tsconfig.build.json`, and `tsc` writes only
under its `outDir`. A build script that ever writes outside `outDir` is what makes this worth a
ticket.
