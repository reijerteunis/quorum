# Q-0107 — implement report, run 2 iteration 2

*Revision round. One blocker from `review/chore/run-2/chore-iter-1.md`, addressed. Three files
changed, 376 insertions. Verified forced: workspace **7/7 tasks, 0 cached**; lint + typecheck
**14/14, 0 cached**; spike **19/19**; `harness lint` **6/6**; `pnpm sweep:git-identity` green.
`spike-dependencies.test.ts` goes from 11 tests to 22.*

---

## 0. The blocker, and what it turned out to be about

> **blocker:** `packages/cli/src/spike-dependencies.test.ts:475` — AC-29 requires AC-10's disposition
> key set to be derived from a scan of the tree so an overlooked dependency becomes red, but this
> suite only iterates the hand-written `DISPOSITIONS` array […] A dependency can therefore be omitted
> entirely while every assertion remains green.

**Accepted in full.** Measured against the file as it stood: `EXCLUSIONS` was derived and checked in
both directions against a live scan, and `DISPOSITIONS` was checked only for internal consistency —
unique sites, a permitted verdict, an evidence file that exists, a sentence of some length, and
pinned class counts. Every one of those passes over a register with a row missing. The reviewer
named the right file, the right line and the right failure mode.

**Splitting it precisely, because the two halves have different answers.** A pre-change dependency
falls into one of two cases:

1. **Left in the tree.** Already caught — the live scan reaches it and it is an unregistered site.
2. **Removed with no verdict written.** Caught by nothing. This is the whole of the finding.

Case 2 is a claim about a set of things that are *gone*, and the only complete witness to it is the
tree they were removed from.

---

## 1. Why the reviewer's stated remedy is refused in its strongest form, with the measurement

> *"Derive the pre-change dependency/site inventory independently from repository content (or another
> executable source of truth), compare it one-to-one with `DISPOSITIONS`…"*

The literal reading — reconstruct the pre-change workspace and diff its site list against the
register — needs `git show <base>:<file>` for every file at the base commit. **That makes the
verdict a property of the clone, not of the commit**, and the numbers are in this repository's own
CI:

| job | `fetch-depth` | runs the workspace suite? |
| --- | --- | --- |
| `workspace` | **unset → 1** (`ci.yml:25`) | yes |
| `git identity sweep (bare checkout)` | **0** (`ci.yml:153`) | yes, via the sweep script |
| `git identity sweep (populated checkout)` | **0** (`ci.yml:179`) | yes |

So one commit would **pass in two jobs and fail in a third**, and a contributor's
`git clone --depth 1` would fail where a full clone passed. That is *"A test's verdict is a property
of the commit, not of the checkout or the account"* (2026-08-30) — instance 1 of Q-0079's three was
*"two directories a working checkout has and a fresh clone does not"*, and clone depth is the same
shape. **Introducing that defect inside the ticket whose subject is checks that report success over
an absent subject is not a trade I am willing to make silently.**

Two alternatives were considered and rejected rather than left unexamined:

- **Raise `workspace` to `fetch-depth: 0`.** Outside every criterion's surfaces, moves
  `test-command.test.ts`'s CI register, and does not help a shallow clone off CI. It converts a test
  defect into a CI-configuration dependency.
- **Commit a generated snapshot of the pre-change scan.** A snapshot that nothing can verify is a
  hand-written list one layer removed, which is the thing the finding objects to.

**The limit is now written where a reader meets it**, in `treeFiles()`'s JSDoc and in the file
header, rather than left to be re-derived: the *subject* side is derivable and is derived; the *site*
side is bounded instead.

---

## 2. What I built

### 2.1 A derived key set — the tree the cutover deletes

`treeFiles()` is `git ls-files --cached spike`, relative to that tree's root. Every file in it must
be accounted for by one of three things:

| | |
| --- | --- |
| a **verdict** | some `DISPOSITIONS` row's `subject` names it |
| a **live read** | the `corpus()` scan still reaches it, so it is a registered `EXCLUSIONS` entry |
| a **registered silence** | `NEVER_NAMED` — one entry, `README.md`, with the reason it was never read |

`unaccounted()` reports the rest and is asserted empty; `stale()` reports the other direction — a row
naming a subject the tree does not have — and is asserted empty too. `LEFT_THE_TREE` holds AC-8's
moved fixture as its own register, so the move is asserted *gone from where it was and present where
it went* rather than excused for being absent.

This is `spike-parity.test.ts`'s shape, which is what AC-29 names: keys from the tree, a
classification per key, a new file failing until it is classified.

**`--cached` alone, where `corpus()` also takes `--others --exclude-standard`**, and the divergence
is documented in place rather than left as an unexplained inconsistency. That spelling is Q-0073's
answer to *what does turbo hash*, where an untracked-unignored file counts. This one answers *what
does Q-0103 delete*, where it does not — and taking the wider form would make a scratch file left in
that directory turn the suite red, which is the defect described in §1 arriving by the back door.

### 2.2 Each row's claim, checked rather than read

`Disposition` gained two fields, filled in for all 35 rows:

- **`files`** — the file or files the site lived in. Each must exist.
- **`subject`** — every path under the tree the site named, relative to that tree's root. Each must
  be one the tree still has, or one `LEFT_THE_TREE` records. Empty where the site named the tree by a
  bare segment or by prose rather than by a path — those rows make no claim about a subject and can
  therefore hide none.

From which two per-row checks, and they are the one-to-one comparison the finding asks for:

- **`retired` / `re-aimed` / `moved`** — the row's own files must no longer carry a read of the row's
  subject. A row claiming a removal that did not happen fails, naming itself.
- **`kept`** — at least one of the row's files must still yield a site, and every such site must be a
  registered exclusion. **A `kept` row whose tripwire quietly vanished is the same silence as a
  missing row, one verdict along**, which is 079(b)'s *"the clause is shown to fire"* asserted rather
  than reviewed.

Subjects are spelled **relative to the tree root** (`src/engine.js`, not the whole path) — not a
style choice: a whole path is a read position by the guard's own second shape, so a register spelled
the other way would collect itself. `spikeSource('src/engine.js')`, the helper AC-9 retires, spelled
its argument the same way for the same reason.

### 2.3 The mutation AC-29 asks for by name, which was missing

The file demonstrated that `sitesIn` fires on an appended read. **It never demonstrated the
*register* going red**, which is what AC-29's *Test* clause requires and what Q-0071's rule
distinguishes: showing a guard has a subject proves the guard fires, not that the comparison built on
it does. There is now a test that runs the register's own comparison over the real corpus plus one
synthetic file and asserts it reports exactly that file — and asserts the same comparison over the
real tree reports nothing, so the first line is a demonstration rather than a coincidence.

---

## 3. Red before green, against the live tree (AC-11)

Every mutation reverted (OQ-2); the recorded message identifies the intended assertion in each case,
which is AC-11's evidence bar.

| clause | mutation | observed |
| --- | --- | --- |
| `unaccounted` | delete `NEVER_NAMED`'s one row | *in the tree and dispositioned by nobody: expected [ 'README.md' ] to strictly equal []* |
| `stale` + subject existence | add subject `src/invented.js` to a row | *a claim about a file that is not there* — and *`src/invented.js` is neither in the tree nor recorded as having left it*, naming the row |
| `readIsGone` | restore a real `repoFile('spike/src/backlog.js')` to `stages.test.ts` | *packages/shared/src/stages.test.ts — the exported tuple deep-equals the spike declaration: the read this row says it removed is still there* |
| `kept` fires | delete the retained `../../spike/test/**` input | *packages/core/turbo.json:46 — ../../spike/test/**: kept, and there is nothing left to fire: expected 0 to be greater than 0* |
| coverage not vacuous | spell `covers` without the separator | two clauses red, including *a new file fails until it is classified: expected [] to strictly equal [ 'CONTRIBUTING.md' ]* |

The synthetic-listing and injected-corpus demonstrations are **committed tests** rather than one-off
transcripts, so they run on every future suite.

---

## 4. One clause I wrote could not fail, and mutating is what caught it

I first wrote the coverage-is-not-vacuous check as *the empty claim never reaches the comparison*
plus *and would account for nothing if it did*, guarded by a `claim !== ''` clause inside `covers`.
**Removing that guard turned nothing red**: `covers('', file)` is already false without it, because
`file === ''` is false and `file.startsWith('/')` is false. So the guard was dead code and the
assertion about it was a check on its own filter — the Q-0050 defect class, in a file written to
close that class.

Rewritten to assert the property that can actually break. The plausible mistake is `covers` spelled
`file.startsWith(claim)` without the separator, which would let the registered bare segment account
for **every file there is** and leave `unaccounted` empty whatever the register said. All three
clauses fail under exactly that mutation, demonstrated above.

A loop asserting that no *other* claim covers the whole tree was written here and **deleted**: under
this tree no directory holds every file, so it could not fail — and under a tree Q-0103 had begun to
empty it would fail on a legitimate state. Both facts are recorded in the test's own comment so the
next reader does not add it back.

---

## 5. Departure from the requirement's text, flagged rather than folded in

**AC-17 says six of the seven spike `turbo.json` inputs go and one stays. This round adds a new one,
in a different package, for a read this round introduced.**

`treeFiles()` lists the spike tree, so `@quorum/cli#test`'s hash must move when that tree's file set
does — otherwise a file added there is dispositioned by a register replayed from a cache that never
took the listing. Q-0072's guard could not see it, because `TREE` is assembled and no literal
appears. So `packages/cli/turbo.json` declares `../../spike/**`, registered in `package.test.ts`'s
`OUTSIDE` and `DECLARED`, with a comment saying it is a **listing** read over-declared as a content
one because turbo has no names-only input, and that Q-0103 removes it.

**It does not falsify AC-17's stated test.** Nothing asserts "one spike input workspace-wide"; the
"sole reader" claim is scoped *in that package* (`packages/core/turbo.json`'s own comment), and my
reader is in `packages/cli`. What it costs is the clean six-go-one-stays narrative, which is why it
is here rather than in a comment.

**R-4 fired twice on my own edits**, in the direction the requirement predicted: AC-30's scan
reported the new turbo input as an unregistered site, and then reported `package.test.ts`'s
`DECLARED` copy of it as a second one. Both are registered with reasons; `EXCLUSIONS` is 8 → 10.

---

## 6. Files

- **`packages/cli/src/spike-dependencies.test.ts`** — `treeFiles`, `relativeToTree`, `covers`,
  `liveSites`, `claims`, `unaccounted`, `stale`, `readIsGone`; `NEVER_NAMED` and `LEFT_THE_TREE`;
  `files` and `subject` on all 35 rows; a new `AC-29` describe block of ten tests; the missing
  register mutation; two new `EXCLUSIONS` entries; header rewritten to state both key sets and the
  limit.
- **`packages/cli/turbo.json`** — `../../spike/**` with its reasoning.
- **`packages/cli/src/package.test.ts`** — one `OUTSIDE` row and one `DECLARED` entry.

## 7. Deliberately unchanged

The 35 verdicts and their sentences, the class counts (`retired` 14, `re-aimed` 17, `kept` 2,
`transcribed` 0, `moved` 2), `corpus()`'s `--others --exclude-standard` spelling (Q-0073's ruling,
and changing it is churn beyond the finding), and everything iteration 1 landed for AC-8 through
AC-19 and AC-30 — the review raised no finding against any of it. `spike/` is intact and tracked
(GO-4); the only write there remains AC-8's move.

## 8. Still open from iteration 1, unchanged

1. `composite.ts:94` and `:248`'s bare `'main'` literals — pinned in both directions, a gate finding
   under R-5 rather than a repair.
2. `backlog.ts:276`'s unused `eslint-disable-next-line no-control-regex` — pre-existing, one warning,
   `pnpm lint` exits 0.
3. `turbo-inputs.test.ts`'s self-audit collects a backticked path inside a comment.
4. **GO-6** — AC-30's header cites **Q-0108** for the deferred JSDoc sweep. I cannot allocate it; the
   backlog belongs to the harness. If the gate allocates a different id, the header needs a one-line
   edit.
5. **R-2, restated because it is the easiest thing to get wrong at this gate**: the sweep is green
   after this change and AC-16 removed roughly half of what it ran. **That is not evidence about
   Q-0102**, whose subject is that script red under load. Its failure rate is not re-measured here.
