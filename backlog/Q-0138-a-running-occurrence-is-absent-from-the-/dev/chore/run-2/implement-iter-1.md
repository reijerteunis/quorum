# Q-0138 — implement, run 2, iteration 1

`verdict=proceed`. Nothing here required a decision entry, a file outside `developer-generalist`'s
paths, or behaviour a landed decision preserves. One thing was found that sits outside those paths
and is **registered rather than fixed** — §5 — because no criterion names it.

---

## 1. What changed, file by file

### The production change is one line

**`packages/core/src/run-history/writer.ts`** — AC-1, AC-2, AC-3, AC-4, AC-12.

`RunHistory.allocate` calls the **existing** `replaceManifest()` after `active.add(occurrence)`, and
nothing else. No `rollup()` call beside it: an allocation adds no usage, so Q-0037's whole-list
recompute stays at N+2 rather than doubling to 2N+2 (AC-3). No new function, no new export, no
change to the replacement path — AC-2 is satisfied by *reusing* the atomic sequence rather than by a
second one, so `run-history.source.test.ts`'s export register is untouched. AC-4 falls out of the
same reuse: `replaceManifest()`'s default is non-fatal, so a failed allocate-time write costs one
`host.warn` naming the manifest path and nothing else, exactly as `terminal()`'s does, while the
run-start write keeps `{ fatal: true }`.

Two docblocks were **corrected in place** (AC-12) rather than appended to:

- `occurrenceStart`'s. Two of its sentences were false after the change — *"re-serialised on each
  terminal occurrence"* and the account of why the sixteenth-key defect hid. It now says the array
  is re-serialised **on every replacement**, and records R-1 explicitly: the hiding place is gone, so
  the same mistake would now reach disk on every run rather than on the fraction of occurrences a
  neighbour happened to make visible. Stated as *the better failure rather than a new hazard*, with
  the reason the key-set assertion is now made at allocation time too.
- `RunHistory.allocate`'s, which now states what the function does, that the replacement carries
  whatever roll-up the last terminal left, and that a failed one costs one warning.

Both carry a one-line `Why:` citation rather than a transcription of the requirement, per
`harness/rules.md`.

### Core tests

**`packages/core/src/run-history/writer.test.ts`** — six new `describe` blocks, and one corrected
comment.

Every new assertion reads `manifest.json` **off disk** rather than `history.manifest`, which is R-5's
risk closed by construction: the in-memory snapshot has always held the occurrence, so a case reading
it would pass over the unchanged function. The state is staged by **not calling `terminal`** — a
hand-driven writer completes nothing on its own, which is the deterministic barrier.

- **AC-1** — the manifest names the occurrence the moment it is allocated, with `occurrence_dir`,
  `status: 'running'` and `duration_ms: null`, and the run still `running` with no `ended_at`; then
  two more allocations with the first still open, asserted in manifest order.
- **AC-2** — three allocations take three sequence numbers, three directories and one order; and the
  allocate-time write goes through the temporary file and the rename, with the manifest's own path
  never a `writeFileSync` target and no `.tmp` surviving.
- **AC-3** — `vi.spyOn(manifestModule, 'rollup')` counts the writer's own calls (the spy on the
  namespace the writer resolves through does intercept them, verified). Run start 0, five
  allocations 0, five terminals 5, finalise 6 — **N+2, not 2N+2**. Plus: three allocations with no
  terminal leave `rollup: []` on disk.
- **AC-4** — the manifest write is made to throw and nothing else is: `allocate` still returns the
  occurrence, its directory exists, the warn is collected **by exact equality** with the path in it,
  and a later `terminal()` persists the step the failed write could not. A second case keeps the
  run-start write fatal.
- **AC-6** — the occurrence key set is asserted **by equality against the frozen contract's own
  `$defs.step.required` list**, read out of `contracts/Q-0011/run-manifest.schema.json` rather than
  transcribed, *and* against `OCCURRENCE_KEYS`, so the two registers agree and neither stands alone.
  Then the manifest is validated structurally and semantically at all three moments — run start, a
  running occurrence, finalisation.
- **AC-12** — a guard asserting no surviving sentence in `writer.ts` claims the old cadence, with the
  pre-change text quoted as the fixture it is shown red against so the scan cannot lose its subject;
  plus a `toStrictEqual` over the **whole** finished manifest of a completed run, with only the three
  clock-decided values normalised, so anything an extra replacement leaked into what a completed run
  leaves behind fails by name.

The comment on the pre-existing *"a still-running occurrence on disk carries no sixteenth key"* test
was corrected: that state used to be reachable only through a neighbour terminating. The test
**stays** — a neighbour's write is a second route to the same document and a later change could break
one and not the other — and its comment now says so and points at AC-6.

**`packages/core/src/run-history/retained.test.ts`** — AC-7, in the one block of that file whose
manifest is **not** hand-built. This is M-8's gap: `listRetainedFiles` had never been run against a
real `RunHistory`. A temp git repository, a ticket, `initialiseRunHistory`, `allocate`, `persist` of
`prompt.txt` — exactly what `runAgentStep` does before a vendor is invoked — and then the listing,
with no `terminal` call. The occurrence is listed with its prompt and its byte count, `warnings` is
empty, the manifest that produced it is read back and asserted `running`/`duration_ms: null`, and
`readRetainedFile` returns the bytes while the step is still going. A second case adds a sibling
allocation without the first finishing.

**`packages/core/src/engine/run-composition.test.ts`** — AC-5. A `--dry` walk over an adapter, a
script and an integrate step: the terminal event arrives, **all three steps genuinely ran** (asserted
by their `step` events, so the clause is not about a walk that stopped early), and
`.quorum/runs` does not exist at all. Paired with a **discriminator**: the same three steps on a real
walk allocate `[implement, adapter]`, `[probe, script]`, `[integrate, integrate]`. Without that pair
the dry clause is satisfied by a flow that allocates nowhere.

**`packages/core/src/turbo-inputs.test.ts`** — one `READ_BASES` row. Q-0072's guard refused AC-7's
new `runsRoot` base on the first full run, which is the machinery working; the row records that it
is `path.join(repo(), '.quorum', 'runs')` inside a temp repository and that the manifest read back
from it is the writer's own.

### Server tests

**`packages/server/src/retained.test.ts`** — AC-8's route half and AC-9, **over a real socket**
(`serve()` + `fetch` against the bound port) rather than through `app.request`, unlike every case
above it: these are the three routes a browser issues for a run in flight and the listing is one of
them. A manifest recording one `running` occurrence, no `ended_at`, and a directory holding
`prompt.txt` and no `output.txt`. `GET /history` counts **1**, `incomplete: true`; `GET /history/:id`
carries `[1, 'implement', 'running']`; `GET /history/:id/retained` answers 200 with **no warning**,
the same `seq` and `step_id`, the prompt with its size and no `output.txt`; and
`GET /history/:id/file` returns the bytes. Every body is parsed with the wire schema it is declared
against. A second case keeps an empty `steps` array at zero, so the first is not satisfied by any
manifest. **No second occurrence terminates anywhere in either case.**

### Web

**`apps/web/src/history-text.ts`** — a new `INCOMPLETE_NO_OCCURRENCES_TEXT`, and `NO_OCCURRENCES_TEXT`
gained the clause saying it is now said only where the run reached an end. The new sentence states
the bound and claims nothing beyond it:

> *"No occurrences are in what this run last recorded, and the run has not ended: this is the
> manifest as it stood when this page read it, not an account of what has happened since."*

It names **no remedy**, and it says nothing about occurrences it cannot see — the manifest cannot
tell *not written yet* from *genuinely none* (OQ-4), and a sentence that guessed would be inventing
the difference. Its docblock distinguishes it from `INCOMPLETE_TEXT`, which is the **row's** and is
about the run, where this is the opened region's and is about the list.

**`apps/web/src/history-screen.tsx`** — AC-11. `OpenedRun` already receives `WireRunHistory`, which
carries `incomplete` (M-6), so the branch needed no new field, no new route and no new request. The
region carries `data-no-occurrences="incomplete" | "ended"` so which branch produced the sentence is
assertable rather than inferred from the prose.

**`apps/web/src/history-screen.test.ts`** — AC-8's row half (`1 occurrence` singular, with `1
occurrences` refused explicitly, since `toContain` alone would accept it) and AC-11 in three clauses:
an incomplete empty run states the bound and never renders the retired sentence and never an empty
region; a **complete** empty run still renders the old sentence unchanged, which is what keeps this a
narrowing rather than a deletion; and the two constants are asserted not to be each other, which is
the check on the check.

**`apps/web/src/history-retained.test.ts`** — AC-10's rendering half, over the shape a real
allocation leaves (`running`, `duration_ms: null`, one retained file): `NO_OUTPUT_RUNNING_TEXT` and
never `NO_OUTPUT_TERMINAL_TEXT`, prompt named and sized, `output.txt` absent. Plus the other half of
AC-10 — **no second running-state copy was introduced** — asserted over the text module's own exports
so a fourth sentence is a visible act.

**`apps/web/test/history-producer.test.ts`** (new) — AC-10's join, which is what makes *"satisfying
it by editing the fixture alone must leave it red"* true. It reads `allocate`'s body out of
`writer.ts`, extracts the status literal the writer stamps, and requires `history-screen.tsx` to
branch on **that** value; it also requires `allocate` to call `replaceManifest()` and to leave
`duration_ms: null`. Editing a fixture changes none of the three. It refuses to run over a body it
cannot find or that reads as empty, and a fourth clause shows the extraction discriminating a hostile
body.

**`apps/web/turbo.json`** (new) — declares that read. `@quorum/web` depends on `@quorum/shared`
alone, so no `^test` edge carries `@quorum/core`'s hash and, undeclared, a cache hit would stand over
a changed producer (Q-0072). **It carries no `$schema` key, deliberately**, and says so in place:
`test/source.test.ts`'s AC-10 clause counts a URL literal in every file of this package and turbo's
schema URL is one — the key buys editor completion and nothing turbo reads, so it is the cheaper of
the two things to give up. Narrowing a guard that forbids a network literal in the package a browser
is served from is not.

---

## 2. Shown red before green

Not read — executed, three mutations with distinct signatures.

**Remove the one line from `allocate`.** Nine clauses red across three packages:

| suite | clauses |
| --- | --- |
| `run-history/writer.test.ts` | AC-1, AC-2 (both), AC-3's roll-up-at-rest clause, AC-4, AC-6's validation clause — **6** |
| `run-history/retained.test.ts` | AC-7 (both) — **2** |
| `apps/web/test/history-producer.test.ts` | *"allocate no longer replaces the manifest"* — **1** |

**Add `manifest.rollup = rollup(manifest.steps)` at allocate.** AC-3 red by name:
*"an allocation added a roll-up computation: expected `rollup` to be called +0 times, but got 5
times"*. This is what gives AC-3 a subject — see §5 for what it does **not** catch.

**Revert the screen branch to the single sentence.** AC-11 red:
*"expected 'This run recorded no occurrences: not…' to be 'No occurrences are in what this run l…'"*.

---

## 3. Verification

Run in this worktree, which has **neither `.harness/worktrees` nor `.quorum/runs`** — GO-6's bare
row. The populated `main` row is the merge's.

| | |
| --- | --- |
| `pnpm install --frozen-lockfile` | up to date |
| `pnpm turbo run test --force --continue` | **7/7 tasks, 0 cached** |
| `@quorum/core` | 1643 passed, 2 skipped, 69 files |
| `@quorum/server` | 276 passed |
| `@quorum/web` | 583 passed, 27 files |
| `@quorum/cli` | 693 passed, 26 files |
| `pnpm turbo run lint typecheck --force --continue` | **14/14 tasks, 0 cached** |
| `pnpm exec quorum lint` | 6/6 |
| `pnpm sweep:git-identity` | green — the suite executed with no resolvable git identity |

---

## 4. GO-3 — the write cost, both arms, same machine

Measured with a throwaway harness driving the **real writer** over **55 occurrences** — `Q-0015-4`,
the largest run this repository retains — each iteration allocating, persisting a 4 KB prompt and a
2 KB output, terminating with usage, then finalising. Timing covers **allocation to finalisation
only**, excluding fixture setup. 5 warm-ups discarded, then 30 measured. The file was deleted; it is
evidence for this report and not a timing-dependent test, per GO-3.

| arm | manifest replacements | bytes written to the manifest | p50 | p95 |
| --- | ---: | ---: | ---: | ---: |
| **before** (no allocate-time write) | 57 | 1,000,394 | 346 ms | 386 ms / 393 ms |
| **after** (shipped) | 112 | 1,955,529 | 655 / 671 / 674 ms | 740 / 722 / 737 ms |

Two runs of the before arm and three of the after arm, all on this machine, APFS, local disk.

**Per extra replacement: ≈5.6 ms**, which independently corroborates §0 M-4's measured 4.9 ms median
and the 112 = 55 + 55 + 1 + 1 arithmetic it rests on. Bytes roughly double, as expected: the same
whole-list serialisation is paid once more per occurrence.

**GO-3's threshold is crossed and this report says so rather than smoothing it over.** The
allocation-to-finalisation p95 rises by **≈335–350 ms**, which is both more than 100 ms and more than
10% — measured against this synthetic loop it is **+88%**. GO-3's instruction is that a successor is
opened for the performance question before this ticket closes. **I cannot open one**: `backlog/` is
the harness's and an agent's edits under it are discarded. It is named here for the gate.

**Both readings, stated, because the percentage and the absolute figure have different denominators
and only one of them is a run.** The denominator above is ~0.35 s of pure writer work; a real run of
55 occurrences spends its time in adapter calls, git and a test suite — `Q-0015-4`'s own
`duration_ms` is 41.5 minutes, against which **+0.35 s is 0.014%**, which is M-4's prediction
holding. What has genuinely doubled is manifest I/O, and R-2's bound stands unchanged: this is one
filesystem, and a network or fuse-mounted repository could be an order of magnitude worse.

**OQ-3 was not re-opened.** Skipping `fsync` on the allocate-time write would buy most of that back
and is refused for the requirement's own reason — two durability contracts on the one file a run must
never lose — and because AC-2 binds the allocate-time write to the existing complete-temporary-file,
flush, close, rename sequence. Diverging would fail AC-2, not merely trade against it.

---

## 5. Registered, not fixed, and what I deliberately left alone

**(a) `contracts/Q-0011/run-history-writer.contract.md:25` — outside my paths, and not falsified.**
It says *"Update after each terminal occurrence and at run termination."* After this change both
still happen; what is added is a third update point. The sentence mandates minima and does not
declare the cadence exhaustive, so I read it as intact — but a reviewer may read it as exhaustive,
and `contracts/` is not among `developer-generalist`'s fourteen roots. **No criterion of this ticket
names that file**, so this is not a refusal: AC-12's named surfaces are `writer.ts` and `read.ts`,
both writable, and both are done. It is named here so the gate can rule it, as Q-0129, Q-0131 and
Q-0134 each had a contract note written by hand.

**(b) AC-3's N+2 clause is a ceiling, and that is worth a reviewer's attention.** It also passes
against the *unchanged* writer, because the unchanged writer also computes N+2. Its job is
prospective — it turns red the day a `rollup()` call is added at allocation, which is demonstrated in
§2 — and it is not evidence that the change did anything. What is evidence is the roll-up-at-rest
clause beside it, which is red against the unchanged writer.

**(c) AC-9's fixture is hand-built, and the reason is structural rather than a preference.**
`packages/server` cannot drive the writer: `initialiseRunHistory` is deliberately absent from
`@quorum/core`'s barrel, and `run-history.source.test.ts` pins that absence so a surface presenting
run history cannot create a run directory. So the server case constructs the state directly — which
is the deterministic barrier the criterion asks for, since a constructed fixture races nothing — and
**that the writer really produces that state is `packages/core`'s to establish**, by AC-1 and AC-7,
both of which drive the real writer and both of which are red against the unchanged function. The
test's header says this in place rather than leaving a reader to derive it.

**(d) A pre-existing lint warning I did not touch.**
`packages/core/src/backlog/backlog.ts:448` — *"Unused eslint-disable directive (no problems were
reported from `no-control-regex`)"*. Present before this branch; that file is unmodified here.
Reported, not fixed in passing.

**(e) `manifest.ts:154`'s *"recomputed in full on every terminal occurrence"* was left alone** — it
describes the **roll-up**, and AC-3 is precisely what keeps it true.

**(f) Not touched, per §5's non-goals:** no field was added to `RunManifest`, `Occurrence`, any wire
type or any HTTP response; no route enumerates `steps/` and `packages/server` composes no occurrence
path; no cap, retention or eviction; no timer, poll or automatic refresh — `contracts/Q-0015`'s
*"Refresh is the only repeat read"* is untouched and still binds; `readRun` is still *"a cast, never
a check"*; mission control and Q-0019's resume are unchanged.

---

## 6. Gate obligations

- **GO-1 (E-1)** — ruled at the gate: no decision entry owed. The ruling lives in the code's own
  authority comments as one-line `Why:` citations, per Q-0108's precedent. Nothing was written to
  `docs/decisions/`.
- **GO-2 (E-2)** — one ticket at twelve criteria; the seam was not needed. **AC-6 and AC-11, the two
  named as not eligible for trimming, are both implemented in full**, and AC-6 is the one this change
  makes load-bearing on every run rather than on a fraction (R-1).
- **GO-3** — discharged above, **threshold crossed**, successor owed and named for the gate.
- **GO-4** — the review-diff measurement is the operator's at the gate. R-6 predicts no truncation;
  the change is ~700 insertions over 12 files, well inside the 200,000-byte cap on a bare estimate,
  but Q-0137 predicted the same and was refuted, so it is to be **measured rather than assumed**.
- **GO-5** — **not discharged here, and an implement step cannot discharge it.** It requires
  `quorum open`, a served bundle verified by content, a real `chore` run started *through* the
  daemon, and a transcription into `runs.log`, which is under `backlog/` and is the harness's.
  Flagged as owed. The row it names — a `chore` run, measured at 469 of 469 blind — is the right
  choice and this change is what makes that row renderable at all.
- **GO-6** — the bare environment row is verified above. The `main` row is post-merge.
