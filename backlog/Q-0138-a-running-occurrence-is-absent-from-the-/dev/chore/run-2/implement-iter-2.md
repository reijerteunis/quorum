# Q-0138 — implement, run 2, iteration 2

`verdict=proceed`. A revision round: both majors from `review/chore/run-2/chore-iter-1.md` are
**accepted**, and the observation is restated for the gate because an implement step cannot discharge
it. Nothing here required a decision entry, a file outside `developer-generalist`'s paths, or
behaviour a landed decision preserves.

**`packages/core/src/run-history/writer.ts` is untouched this round** — the production change is
unchanged from iteration 1, so §4's GO-3 measurements and every core-side criterion stand as reported
there. What moved is the evidence for AC-9 and AC-10.

---

## 1. The two majors, each in full

### M-1 — AC-9's fixture was a claim about the writer, not a join to it. **Fixed.**

The finding is right, and it is right about the thing that mattered: `retained.test.ts` built the
manifest and the occurrence directory by hand, so it stayed green if `allocate` stopped producing a
server-readable manifest or drifted from the document invented beside it. AC-9's own words are *"the
AC-7 arrangement behind a running daemon"*, and iteration 1 delivered the arrangement's *shape*
rather than the arrangement.

Iteration 1's stated reason for that — §5(c), that `initialiseRunHistory` is deliberately absent from
`@quorum/core`'s barrel so a surface presenting run history cannot create a run directory — **is true
and was the wrong conclusion.** That absence is about the *writer's API*. It says nothing about the
producer, and the producer is reachable: `runFlow` is on the barrel, `host.start` is its one
production caller, and the chain a start drives is
`steps.ts` → `allocateOccurrence` → `allocate` → `manifest.json` on disk → these routes. This
package's own test fixture header already says *"This package's suite drives REAL runs, so it spawns
real `git` and writes real run history"*. So the join was available all along and is **longer than
AC-7's arrangement**: it is what the daemon actually does, and it is what GO-5 will do by hand.

**The barrier is the part that needed solving, and the criterion is explicit about it:** *"a
deterministic barrier after allocation and before completion rather than infer the state from a
sleep"*. Measured against the tree, the product offers exactly one asynchronous pause a test can hold:

- a **script** step allocates an occurrence and then calls `runCommand`, which is **synchronous** — it
  blocks the event loop, so the daemon could not answer a request while it ran. Same for `integrate`.
- a **gate** allocates no occurrence, and in `runAgentStep` `terminalOccurrence` runs *before* any
  gate is reached, so a parked run has nothing running.
- `runFlow`'s stream is lazy only in that the run **starts** on the first pull; `sink.emit` is a
  lossless FIFO and the run does not suspend per event, so declining to pull holds nothing.
- an **adapter** step's `await adapter.run(...)` is the one genuine yield, and the mock adapter's only
  latency is `setTimeout(cfg.delayMs ?? 20)`.

A real `delayMs` would make the state a window and every assertion a race against it — which is what
the criterion forbids — and it would also make `host.shutdown()` wait the delay out, because shutdown
resolves only once each live run has finished persisting.

**So the barrier is a timer that cannot fire.** Under `vi.useFakeTimers({ toFake: ['setTimeout',
'setInterval'] })`, installed before the run starts, the mock's timer never fires: the run allocates
the occurrence, persists the prompt it is about to send, emits its `step` event and stops inside
`adapter.run` indefinitely. The release is an explicit `vi.advanceTimersByTimeAsync(HELD_MS)`. Nothing
waits for a duration anywhere, and **nothing terminates to make the occurrence visible** — the flow
has one step, so there is no sibling that *could*, which is stronger than a second occurrence that
merely did not.

Three details are load-bearing and are stated in place:

- **The window is opened by an event, not a poll.** `runAgentStep` emits `step` *after* allocating and
  persisting the prompt and *before* awaiting the adapter, so receiving that event **is** the proof
  that the barrier has been reached. Awaited on the host's own subscription, which needs no timer —
  which matters, because the only timer available is faked. The existing `until()` idiom in
  `host.test.ts` polls with `setTimeout` and would have hung.
- **The fake clock is advanced on every exit, a failed assertion included.** The promise the run is
  suspended on waits for a *fake* timer, so restoring the real clock without firing it would leave
  that promise pending for ever and `shutdown()` would never resolve — a failing assertion would
  present as a hung file rather than as a failure.
- **`toFake` is the two timer functions and nothing else.** The clock the writer stamps `started_at`
  from stays real, because a manifest is what these routes answer from.

What the case asserts, all of it against what a real run produced:

| | |
| --- | --- |
| the manifest on disk | `[['work', 'running', null]]`, `occurrence_dir` `steps/001-work` |
| `GET /history` | `occurrenceCount` **1**, `incomplete` **true** |
| `GET /history/:id` | `[[1, 'work', 'running', null]]` |
| `GET /history/:id/retained` | `[[1, 'work', ['prompt.txt']]]`, `warnings` `[]` |
| `GET /history/:id/file` | 200, and `Buffer.byteLength(text)` **equals the byte count the listing reported**, so the file served and the file measured are one file; the text contains `# Ticket T-0001`, so it is the prompt this run composed rather than a string written here |

The manifest is read **off disk**, never from `history.manifest` — R-5's risk, closed by construction:
the in-memory snapshot has always held the occurrence, so a case reading it would pass over the
unchanged function.

**The one hand-built case that remains is the discriminator, and it must be hand-built.** A manifest
recording no occurrence at all is what a run leaves in its first instants, and no run a test can
drive stands still there long enough to be read. It keeps `occurrenceCount` at 0 and the retained
listing empty, so the clauses above are not satisfied by any manifest.

### M-2 — AC-10's instrument was a source-text scan. **The instrument is gone; the job moved to where it can be executed.**

The finding's substance is right: `apps/web/test/history-producer.test.ts` matched literals in
`writer.ts` and in `history-screen.tsx` and proved nothing about runtime behaviour. **It is deleted**,
and `apps/web/turbo.json` — which existed only to declare that file's cross-package read — is deleted
with it, which is the finding's own conditional (*"retained only if that behavioral test actually
reads outside the package"*).

**The remedy as written could not be built where the finding asks for it, and this is measured rather
than asserted.** A *"behavioral producer-to-wire fixture consumed by the rendering test"* needs two
things in one process: the producer (`@quorum/core`) and the wire projection (`packages/server`'s
`read.ts`). `apps/web` declares **one** workspace dependency, `@quorum/shared`; the rendering test
lives under `src/`, which may import no `node:` specifier and no `@quorum/core` at all. Giving the
browser app a devDependency on the engine *and* on the daemon it talks to over HTTP, to make a test
convenient, is an architecture change — `04-architecture.md`'s dependency direction and its package
table — and no criterion of this ticket authorises one. Reimplementing `read.ts`'s projection inside
`apps/web` would be a second copy of it, free to drift.

**So the join sits in `packages/server`, where both halves exist, and its producing side is now
executed.** The AC-10 case reads `detail.steps[0].status` off the wire from a real allocation and
requires `apps/web/src/history-screen.tsx` to branch on **that value**, with a clause showing the
needle discriminates rather than matching nothing. That is strictly stronger than what was deleted,
where *both* sides were source reads.

Reading `apps/web`'s tracked source from this package is not new and not a workaround:
`packages/server/src/static.test.ts` already derives the shell's twelve paths from
`apps/web/src/routes.ts` rather than transcribing them, for the same reason and with the same
justification — `packages/server` may not import `apps/web` in either direction, and what makes
reading it legal is that it is tracked source.

**`packages/server/turbo.json` needed no change, and that is measured rather than assumed.**
`@quorum/core#test` declares `../../apps/**/*.tsx`, and turbo's own `inputs` report lists
`apps/web/src/history-screen.tsx` under that task; `@quorum/server` depends on `@quorum/core`, so the
root `test` task's `^test` edge puts that task's hash inside this one. Declaring it again would be the
same claim written twice, free to drift — which is exactly the reasoning that file already gives for
*not* re-declaring `docs/04-architecture.md`. The two reads it does declare,
`apps/web/src/routes.ts` and `apps/web/vite.config.ts`, are the ones nothing covers; a `.tsx` under
`apps/web/src` is not one of them. Recorded in the file, with the measurement.

**One measurement failed and is reported rather than presented as done.** The isolating method this
repository usually uses — compare a task's hash with and without a declaration — **does not
discriminate in this workspace**: appending one line to `packages/cli/src/exit.ts`, a file no other
package declares, moved `@quorum/core#test`, `@quorum/server#test` **and** `@quorum/shared#test`.
`globalCacheInputs.hashOfInternalDependencies` is in every task's hash, so any package's change moves
every hash. The instrument that *does* discriminate is turbo's `inputs` map, which names the files
hashed for a task, and that is what the measurement above uses.

### The observation — GO-3's threshold, restated for the gate

Correct, and unchanged: `writer.ts` is untouched this round, so iteration 1 §4's figures stand —
112 manifest replacements against 57, ≈5.6 ms per extra replacement, and an
allocation-to-finalisation p95 up **≈335–350 ms (+88%)** on a 55-occurrence synthetic loop, against
**+0.014%** of `Q-0015-4`'s real 41.5-minute wall time. GO-3's instruction is that a performance
successor is opened **before this ticket closes**. **I cannot open one** — `backlog/` belongs to the
harness and an agent's edits under it are discarded — so it is named here again for the gate. It is
not a criterion and not a blocker: non-goal 6 keeps the roll-up's shape and the whole-list
serialisation out of this ticket either way.

---

## 2. Files changed

**`packages/server/src/retained.test.ts`** — the Q-0138 block replaced end to end (+233 net). A
module-level `WORKSPACE` in `static.test.ts`'s idiom, carrying why `apps/web`'s screen may be read and
what hashes the read; a `whileHeld(body)` helper owning the fixture, host, socket, fake clock and
every restore path; the behavioural AC-8/AC-9 case; the AC-10 join; and the hand-built empty-`steps`
discriminator, which keeps `manifestOf`, `occurrence` and `writeRun` in use.

**`apps/web/test/history-producer.test.ts`** — deleted (−87). The source-text scan M-2 names.

**`apps/web/turbo.json`** — deleted (−28). Its only declared read was the deleted file's.

**`apps/web/src/history-retained.test.ts`** — the AC-10 comment corrected (−15/+15 region). It cited
the deleted file as the place the producer claim is established; it now names
`packages/server/src/retained.test.ts`'s block and says in one paragraph why the join lives there
rather than here.

---

## 3. Shown red before green

Executed, not read. Reverting the one line in `allocate` — the whole production change — turns the
two new behavioural cases red with discriminating messages:

```
× the writer names it, the listing counts it, the detail says running, and its prompt is readable
  AssertionError: the manifest does not name the step this run is inside:
    expected [] to strictly equal [ [ 'work', 'running', null ] ]
× AC-10 — the status a real allocation produces is the one the screen branches on
  AssertionError: this run produced no occurrence to read a status from:
    expected undefined to be 'running'
```

The third case stays green over the same mutation, which is the discriminator working: a manifest
recording nothing is unaffected by when the manifest is written. The line was restored and
`git diff packages/core/src/run-history/writer.ts` is empty.

Iteration 1's three mutations over the core and web halves are unaffected and unrepeated here.

---

## 4. Verification, and the one red I could not clear

Run in this worktree, which has **neither `.harness/worktrees` nor `.quorum/runs`** — GO-6's bare row.

| | |
| --- | --- |
| `pnpm turbo run lint typecheck --force --continue` | **14/14 tasks, 0 cached** |
| `pnpm exec quorum lint` | 6/6 |
| `pnpm sweep:git-identity` | *"environment discriminates (negative and positive probes both as expected)"*, both rows |
| `@quorum/shared` · `@quorum/core` · `@quorum/server` · `@quorum/web` · `@quorum/compiler` · `@quorum/templates` | **green forced** — 303 · 1643 (+2 skipped) · **277** · **579** · 1 · 1 |
| `@quorum/cli` | **602 passed, 7 failed, 84 skipped** — one cause, below |

`@quorum/web` is 26 files / 579 tests where it was 27 / 583: the deleted file's four. `@quorum/server`
is 277 where it was 276: two cases became three.

### The seven red cli tests are the index, not the change, and this is diagnosed rather than asserted

Every one of the seven fails inside `isolate()` with the identical message:

```
Error: corpus missing: apps/web/test/history-producer.test.ts
       — the isolated workspace cannot be built without it
```

`packages/cli/test/workspace.ts`'s `trackedUnder` asks
`git ls-files --cached --others --exclude-standard`, and `--cached` reports what the **index** holds.
Both files this round deletes are committed in `HEAD` and I may neither commit nor stage — `git add`
is not available to me — so the index still lists two paths that are not on disk, and `copy()` refuses
by design. Measured:

```
$ git ls-files --deleted
apps/web/test/history-producer.test.ts
apps/web/turbo.json
$ git ls-files --cached -- apps/web/test/history-producer.test.ts apps/web/turbo.json
apps/web/test/history-producer.test.ts
apps/web/turbo.json
$ ls apps/web/turbo.json apps/web/test/history-producer.test.ts
No such file or directory
```

**It cannot arise on the tree `integrate` runs against**, where the deletion is committed and
`--cached` no longer lists either path. It is not specific to this ticket: any change that deletes a
tracked file under an emitting package hits it in the implement step's worktree.

I could not obtain a green `@quorum/cli` row for GO-6 in this worktree and am not going to claim one.
The three attempts I made and why each was refused: staging the deletion (`git add`, `git restore`,
`git update-index` — a permission the harness does not give an implement step, and routing around it
with a synonym is still routing around it); running the suite under an empty `GIT_INDEX_FILE` so
`--others` would report the working tree (the environment-prefixed form is not available either); and
restoring the two files to make it green, which would verify the *old* tree rather than this one.

---

## 5. Registered, not fixed

**(a) `trackedUnder`'s index-dependence, the deletion direction.** Its own JSDoc records that
`--others` was added at Q-0093 because the index-only read *"described paths in the index, with
current contents"* and made a verdict *"a property of whether anyone has run `git add` rather than of
the change"*. That is fixed for an **added** file and not for a **deleted** one, which §4 now
demonstrates. `harness/rules.md`'s *"A test's verdict is a property of the commit, not of the checkout
or the account"* reaches it. **Not fixed here**, for three reasons: no criterion of this ticket names
`packages/cli/test/workspace.ts`; the repair carries a judgement that is a gate's rather than an
implementer's — whether a path git reports as `--deleted` should be **skipped** or should still
refuse, against the copier's deliberate *"refusing a missing corpus rather than building a workspace
that is quietly short of a file"*; and both of that helper's comments would need re-reasoning. The
mechanical part is two lines: subtract `git ls-files --deleted` from the list, which is an index-only
question with an exact answer.

**(b) The AC-9 fixture's remaining hand-built case is deliberate**, and §1 says which one and why.

**(c) A pre-existing lint warning, untouched.** `packages/core/src/backlog/backlog.ts:448` —
*"Unused eslint-disable directive (no problems were reported from `no-control-regex`)"*. Present before
this branch; that file is unmodified in it.

**(d) Not touched, per §5's non-goals:** no field added to `RunManifest`, `Occurrence`, any wire type
or any HTTP response; no route enumerates `steps/` and `packages/server` composes no occurrence path;
no cap, retention or eviction; no timer, poll or automatic refresh in the browser —
`contracts/Q-0015`'s *"Refresh is the only repeat read"* is untouched and still binds; `readRun` is
still *"a cast, never a check"*; mission control and Q-0019's resume are unchanged. The fake clock
this round installs is **a test's**, inside one helper, restored on every exit.

---

## 6. Gate obligations

- **GO-1 (E-1)** — ruled: no decision entry owed. Nothing this round changes that, and nothing was
  written to `docs/decisions/`.
- **GO-2 (E-2)** — one ticket at twelve criteria; the seam was not needed. **AC-6 and AC-11, the two
  named as not eligible for trimming, are implemented in full and untouched this round.** E-2 also
  says to weight the review at `writer.ts` rather than at the screen (R-4) — worth repeating, because
  this round moved only evidence and that file is unchanged.
- **GO-3** — discharged in iteration 1 §4, **threshold crossed**, successor owed and restated in §1
  above for the gate. Figures stand: the write path is unchanged.
- **GO-4** — measured rather than assumed, which is what R-6 asks. The branch's whole diff against
  `main` is **60,708 bytes across 10 files** — 832 insertions, 17 deletions — against
  `repo.max_diff_bytes`'s 200,000, so **no truncation is predicted and R-6's prediction holds so far**.
  The file count fell from twelve to ten because two of iteration 1's files are removed. Confirming it
  against the review's own prompt is the operator's at the gate; Q-0137 predicted the same and was
  refuted, so it is to be read rather than trusted.
- **GO-5** — **not discharged here, and an implement step cannot discharge it.** It requires
  `quorum open`, a served bundle verified by content, a real `chore` run started *through* the daemon,
  and a transcription into `runs.log`, which is under `backlog/`. Flagged as owed. Its instruction to
  pick a **`chore`** row — 469 of 469 blind by §0 M-3 — is the right one, and this change is what
  makes such a row renderable at all. Worth noting beside it: the AC-9 case now exercises the same
  chain GO-5 walks by hand, through the daemon and over a socket, which narrows what GO-5 can be
  surprised by without replacing it.
- **GO-6** — the bare environment row is verified above for six of seven packages, with the seventh's
  red diagnosed in §4 and unobtainable in this worktree. The `main` row is post-merge.
