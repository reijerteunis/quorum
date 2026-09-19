# Q-0138 — implement, run 2, iteration 3

`verdict=proceed`. A revision round over one finding from
`review/chore/run-2/chore-iter-2.md`, **accepted in full**, plus its three observations restated for
the gate because an implement step cannot discharge them. Nothing here required a decision entry, a
file outside `developer-generalist`'s paths, or behaviour a landed decision preserves.

**`packages/core/src/run-history/writer.ts` is untouched this round and is byte-identical to
iteration 1's** (`git diff HEAD` over that file is empty). So the production change, iteration 1 §4's
GO-3 measurements and every core-side criterion stand as reported there. What moved is the evidence
for AC-10.

---

## 1. The major, in full

> *AC-10 is still not tested through the real producer-to-rendering chain. The test obtains `running`
> from a real daemon response, but only interpolates it into a source-text search at line 825; the web
> rendering test separately consumes a hand-built fixture. Consequently, the real wire response never
> reaches `HistoryScreen`.*

**Accepted, and the substance is right rather than nearly right.** Iteration 2 compared **one of
seventeen** fields — `detail.steps[0].status` — against `history-screen.tsx`'s *text*. Every other
field the screen renders (`kind`, `duration_ms`, `seq`, `step_id`, the retained `files` array and its
names and sizes) could have drifted between what the daemon produces and what the fixture asserts,
with both suites green. A source-text scan is this repository's weakest instrument, and AC-10's own
job for its instrument is *"the fixture and the producer cannot drift"* — a job one literal does not
do. Iteration 2 defended the scan on the ground that it was strictly stronger than what it replaced,
which was true and is not the standard.

### Why the remedy took the shape it did, measured rather than asserted

The finding asks for the produced responses to reach a behavioural rendering test. **No process in
this workspace can hold both halves**, and that is a fact about the package graph rather than a
preference:

| | |
| --- | --- |
| producing a response | needs `@quorum/core` (the writer) and `packages/server` (the projection) |
| rendering one | needs React, `react-dom/client` and jsdom, which exist only in `@quorum/web` |
| `apps/web/package.json` | declares **one** workspace dependency, `@quorum/shared` |

Giving the browser app a dependency on the engine, or on the daemon it talks to over HTTP, to make a
test convenient is an architecture change — `04-architecture.md`'s dependency direction and its
package table — and no criterion of this ticket authorises one. Reimplementing `read.ts`'s projection
inside `apps/web` would be a second copy of it, free to drift.

**So the two halves meet at an artifact, and the artifact is a recording rather than an invention.**
This is the one shape that answers the finding: the bytes `HistoryScreen` renders are bytes a real
run really put on the wire, and an executed producer test is what keeps them that way.

### What shipped

**`apps/web/test/fixtures/running-occurrence.json`** — the three bodies (`/history`,
`/history/:id`, `/history/:id/retained`) a real run answered while held between allocation and
completion, captured verbatim through a throwaway harness and then deleted, with a `note` field
saying what it is and how to re-record it. Nothing in it was typed by hand.

**`apps/web/test/history-producer.test.ts`** (new, jsdom) — **the behavioural half the finding asks
for**. It reads the recording, mounts `HistoryScreen` against a fetcher that answers those three
bodies *unaltered*, expands the row, and asserts the occurrence renders `NO_OUTPUT_RUNNING_TEXT`, that
the region is not `NO_OUTPUT_TERMINAL_TEXT`, and — wider than the anchor — that the terminal sentence
appears **nowhere on the rendered row**, because a second copy elsewhere is the same false claim to a
reader. It also asserts the prompt the run had already retained is named and the output it cannot yet
have is not. A path the screen asks for that the run did not answer **throws** rather than resolving
`undefined`, so a screen that started asking for something else fails here instead of rendering over
a hole. It lives under `test/` because it reads a file and `apps/web/src` may import no `node:`
specifier — Q-0014's boundary, used as intended.

**Its premise is asserted rather than assumed**, in its own file and again in the producer's: the
recording must be **of** a step that had not finished (`status: 'running'`, `duration_ms: null`, one
retained file and that file the prompt). A recording of a *finished* occurrence would render the
terminal sentence and the main clause would pass for the wrong reason; this is what stops the
recording being quietly replaced by an easier one.

**`packages/server/src/retained.test.ts`** — the source scan is **deleted** (`SCREEN`,
`SCREEN_SOURCE` and both `toContain` clauses; `grep -c SCREEN_SOURCE` is 0). In its place, the AC-10
case starts the same held run and asserts **`toStrictEqual` over all three bodies** against the
recording. Every field is compared as recorded — `status` and `duration_ms` among them — with exactly
two normalised:

| key | why it cannot be pinned |
| --- | --- |
| `started_at` | a clock; a recording that pinned it would be red on the next run |
| `bytes` | the size of a prompt the fixture's own ticket text decides, and an unrelated edit to that fixture would turn it red |

**The normalisation is narrow and the register is what keeps it narrow.** `settle()` reports the
*paths* it replaced, and both sides are asserted equal to a five-entry register
(`$.list.runs[0].started_at`, `$.detail.manifest.started_at`,
`$.detail.manifest.steps[0].started_at`, `$.detail.steps[0].started_at`,
`$.retained.occurrences[0].files[0].bytes`) — so a normalisation that stopped reaching a clock, or
started reaching a third field, fails by name rather than silently weakening the comparison. It uses
`Object.hasOwn` rather than `in`, so a wire field spelled like something on `Object.prototype` is
compared rather than normalised away.

**Neither half can pass alone, which is AC-10's closing clause** — *"satisfying it by editing the
fixture alone must leave it red"* — and §3 demonstrates it rather than claiming it.

**`packages/server/turbo.json`** — one declared input,
`../../apps/web/test/fixtures/*.json`, with the measurement. This is the first read here that is
**not** a TypeScript file, and that is the whole reason it needs declaring: `@quorum/core#test`
declares `../../apps/**/*.ts` and `../../apps/**/*.tsx`, which the `^test` edge carries into this
task and which is why the status scan needed no entry, and **no glob in that list reaches a
`.json`**. Measured the way that file's existing header prescribes, and **not** by comparing hashes —
iteration 2 recorded that the hash instrument does not discriminate in this workspace, because
`globalCacheInputs.hashOfInternalDependencies` sits in every task's hash. What discriminates is
turbo's own `inputs` report:

```
before:  turbo run test --filter=@quorum/server --dry=json
         names apps/web/src/history-screen.tsx, and running-occurrence.json 0 times in the whole graph
after:   names it once
web:     turbo run test --filter=@quorum/web   --dry=json  — once, via $TURBO_DEFAULT$
```

So a cached pass on either side would have stood over an edited recording, and now cannot.

**`apps/web/src/history-retained.test.ts`** — the hand-built fixture is **kept**, which is what
AC-10's `Test:` clause directs and which this round did not disturb. Only the comment moved: it
described the retired status scan, and now names both executed halves and why the producer's lives in
`packages/server`.

**`apps/web/turbo.json` stays deleted.** The finding's own conditional was that the cross-package
turbo input be *"retained only if that behavioral test actually reads outside the package"*. It does
not — it reads a file inside `apps/web` — so the declaration that was needed is the one in
`packages/server`, which is where the cross-package read now is.

---

## 2. Files changed

| file | |
| --- | --- |
| `apps/web/test/fixtures/running-occurrence.json` | **new**, 106 lines. The recording. |
| `apps/web/test/history-producer.test.ts` | **new**, 143 lines. The behavioural rendering half. |
| `packages/server/src/retained.test.ts` | the AC-10 case rewritten as an equality over the recording; `SCREEN`/`SCREEN_SOURCE` deleted; `WORKSPACE`'s docblock re-derived, because the read it documents changed and its conclusion reversed. |
| `packages/server/turbo.json` | one input, with the measurement. |
| `apps/web/src/history-retained.test.ts` | one comment corrected. No fixture and no assertion moved. |

Everything else on the branch is iterations 1 and 2's and is untouched.

---

## 3. Shown red before green

Executed, three mutations with distinct signatures, each restored and verified restored
(`git diff HEAD` empty for both production files afterwards).

**(a) Edit the recording alone — one unrelated field, `attempts` 0 → 1.** This is the field the old
status scan could never have seen, and it is the clause the finding turns on:

```
× AC-10 — what this run answers is still the recording the screen renders
  AssertionError: what this daemon answers is no longer
  apps/web/test/fixtures/running-occurrence.json, which apps/web renders through HistoryScreen
  — re-record it from this run rather than editing the screen's expectations …
  -  "attempts": 1,
  +  "attempts": 0,
```

**(b) Revert the one production line in `allocate`.** Two cases red, both by name:

```
× the writer names it, the listing counts it, the detail says running, and its prompt is readable
  AssertionError: the manifest does not name the step this run is inside:
    expected [] to strictly equal [ [ 'work', 'running', null ] ]
× AC-10 — what this run answers is still the recording the screen renders
  AssertionError: the clocks and sizes in what this run answers are not the ones this register names:
    expected [ Array(2) ] to strictly equal [ Array(5) ]
```

The second fires on the *register* rather than the equality, which is the register doing its job: a
producer that stopped recording the occurrence has no `steps[0].started_at` and no retained `bytes`
to normalise at all.

**(c) Point the screen's branch at a status no allocation produces** (`step.status === 'in-progress'`).
The behavioural rendering test red — which is what the source scan was approximating, now established
by execution rather than by matching text:

```
× it renders the not-finished sentence and never the terminal one
  AssertionError: the occurrence a real allocation produced rendered no output sentence at all:
    expected 'No output file was retained for this …' to be 'No output yet: this step has not fini…'
```

Iteration 1's three mutations over the core and web halves are unaffected and were not repeated.

---

## 4. Verification

Run in this worktree, which has **neither `.harness/worktrees` nor `.quorum/runs`** — GO-6's bare
row. The populated `main` row is the merge's.

| | |
| --- | --- |
| `pnpm install --frozen-lockfile` | already up to date |
| `pnpm turbo run test --force --continue` | **7/7 tasks, 0 cached** |
| `@quorum/shared` · `@quorum/core` · `@quorum/server` · `@quorum/web` · `@quorum/cli` · `@quorum/compiler` · `@quorum/templates` | 303 · 1643 (+2 skipped) · **277** · **582** · **693** · 1 · 1 |
| `pnpm turbo run lint typecheck --force --continue` | **14/14 tasks, 0 cached** |
| `pnpm exec quorum lint` | 6/6 |
| `pnpm sweep:git-identity` | *"the workspace suite executed and green with no resolvable git identity"* |

`@quorum/web` is 27 files / 582 tests where iteration 2 left 26 / 579: the new file's three.
`@quorum/server` stays at 12 / 277, the AC-10 case having been rewritten rather than added to.

### Iteration 2's red `@quorum/cli` row is green, and the diagnosis it gave was right

Iteration 2 reported 7 failures in `@quorum/cli`, all `corpus missing: apps/web/test/history-producer.test.ts`,
and diagnosed them correctly: `packages/cli/test/workspace.ts`'s `trackedUnder` asks
`git ls-files --cached --others --exclude-standard`, and `--cached` reports the **index**, which still
listed two files that round had deleted but could not stage. It predicted the condition *"cannot arise
on the tree `integrate` runs against"*. The harness committed that round, so the index and the disk now
agree, and **all 693 pass here** — the prediction held and the row is complete for the first time since
that deletion. The underlying defect is unchanged and stays registered below.

---

## 5. Registered, not fixed

**(a) `trackedUnder`'s index-dependence in the deletion direction** — carried unchanged from
iteration 2 §5(a) and now latent again rather than firing. Its own JSDoc records that `--others` was
added at Q-0093 so a verdict stopped being *"a property of whether anyone has run `git add`"*; that is
closed for an **added** file and open for a **deleted** one, which `harness/rules.md`'s *"a test's
verdict is a property of the commit"* reaches. Not fixed: no criterion of this ticket names
`packages/cli/test/workspace.ts`, and the repair carries a judgement that is a gate's rather than an
implementer's — whether a path git reports as `--deleted` should be **skipped** or should still refuse,
against that copier's deliberate *"refusing a missing corpus rather than building a workspace that is
quietly short of a file"*.

**(b) A recording is a golden file, and its tax is stated rather than hidden.** A change to what
`GET /history/:id` projects — a field Q-0018's or a successor's — turns the producer case red even
though nothing about AC-10 is wrong. That is **correct** rather than noise: the recording *is* stale
then, and the renderer would be rendering a shape the daemon no longer produces. The failure message
says so and says to re-record, and the recording's own `note` says where from. It is named here so a
later reader meets it as a decision rather than as a surprise.

**(c) The new turbo input is covered by no guard.** `src/turbo-inputs.test.ts`'s `SUITES` are
`@quorum/shared#test` and `@quorum/core#test`, so nothing scans `packages/server`. That is the
standing residual `packages/server/turbo.json`'s own header already records, and the new entry sits
under it; it is measured rather than checked, which is why the measurement is written beside it.

**(d) A pre-existing lint warning, untouched.** `packages/core/src/backlog/backlog.ts:448` —
*"Unused eslint-disable directive"*. Present before this branch; that file is unmodified in it.

**(e) Not touched, per §5's non-goals:** no field added to `RunManifest`, `Occurrence`, any wire type
or any HTTP response; no route enumerates `steps/` and `packages/server` composes no occurrence path;
no cap, retention or eviction; no timer, poll or automatic refresh in the browser —
`contracts/Q-0015`'s *"Refresh is the only repeat read"* is untouched and still binds; `readRun` is
still *"a cast, never a check"*; mission control and Q-0019's resume are unchanged. The recording is
read by tests only and is not reachable from anything a browser is served.

---

## 6. Gate obligations

- **GO-1 (E-1)** — no decision entry owed; nothing this round changes that, and nothing was written
  to `docs/decisions/`.
- **GO-2 (E-2)** — one ticket at twelve criteria; the seam was not needed. **AC-6 and AC-11, the two
  named as not eligible for trimming, are implemented in full and untouched this round.** E-2's
  instruction to weight the review at `writer.ts` rather than at the screen (R-4) is worth repeating:
  that file is unchanged here and this round moved only evidence.
- **GO-3** — discharged in iteration 1 §4, **threshold crossed**, and the figures stand unchanged
  because the write path did not move: 112 manifest replacements against 57, ≈5.6 ms per extra
  replacement, allocation-to-finalisation p95 up **≈335–350 ms (+88%)** on a 55-occurrence synthetic
  loop, against **+0.014%** of `Q-0015-4`'s real 41.5-minute wall time. GO-3 requires a performance
  successor to be opened **before this ticket closes**. **I cannot open one** — `backlog/` belongs to
  the harness and an agent's edits under it are discarded — so it is named here for the third time.
  It is not a criterion and not a blocker: non-goal 6 keeps the roll-up's shape and the whole-list
  serialisation out of this ticket either way. *(The review's observation, restated.)*
- **GO-4** — measured rather than assumed, which is what R-6 asks. The branch against `main` is
  **13 files and ≈79,400 bytes** — 68,037 B across the 11 tracked files plus the two new ones at
  3,079 B and 8,072 B — against `repo.max_diff_bytes`'s 200,000, so **no truncation is predicted and
  R-6's prediction continues to hold**. Confirming it against the review's own prompt is the
  operator's at the gate; Q-0137 predicted the same and was refuted, so it is to be read rather than
  trusted.
- **GO-5** — **not discharged here, and an implement step cannot discharge it.** It requires
  `quorum open`, a served bundle verified by content, a real `chore` run started *through* the
  daemon, and a transcription into `runs.log`, which is under `backlog/`. Owed. Its instruction to
  pick a **`chore`** row — 469 of 469 blind by §0 M-3 — is the right one, and this change is what
  makes such a row renderable at all. What narrowed since iteration 2: the AC-9 case walks the same
  chain through the daemon over a socket, and AC-10 now walks it all the way to a rendered sentence,
  so what GO-5 can be surprised by is smaller — but it is not nothing, because only GO-5 runs the
  built bundle. *(The review's observation, restated.)*
- **GO-6** — the bare environment row is verified above and is **green for all seven packages this
  round**, which iteration 2's could not be. The `main` row is post-merge. *(The review's third
  observation is answered in §4: the copier defect it named is real, is registered in §5(a), and no
  longer reddens this row.)*
