# Q-0094 — implement, run 2, iteration 2

Revision round. The run-2 review returned two majors. **One was real and is fixed; one is refused by
measurement, and it owes an erratum I may not write.** Nothing else was touched: the diff is three
files, +106/−25, all under `packages/cli`.

---

## Major 1 — `gate.ts:166`, the handle that outlives a SIGTERM. **Accepted, and it was real.**

> *"The readline interface is only closed after `rl.question()` resolves, while a SIGTERM causes
> `askGate`'s abort promise to reject without settling this pending question. The run can therefore
> finish and remove its process handlers while the readline interface and its input listeners remain
> open, violating AC-7(7)…"*

### Reproduced red before it was believed

The claim is a leak, so the oracle is a listener count, and `gate.test.ts` already had one —
`attached()`, which sums readline's `data`/`keypress`/`end` listeners on the input stream. A new
whole-run test drives `quorum run` to an interactive gate and sends a real `SIGTERM` at the prompt:

```
AssertionError: the readline handle outlived the run it was opened for: expected 2 to be +0
```

**Two listeners, still attached, after the run had ended and its process handlers were off.** The
exit-code assertions passed in the same run — the run does end `interrupted` and exits 130 — so the
outcome was right and the handle was the defect, exactly as the review said.

### Why it happened, which is narrower than "the close is late"

`rl.close()` sat after the `await`, so it ran on every path *that settles*. The interrupt paths are
the ones that deliberately **do not settle**: leaving the promise pending is what lets `askGate`'s
abort race win, so that a deliberate interrupt is `interrupted` and never `undecided` (AC-11(5)).
Moving the close later could never have covered them.

The real asymmetry is in how an interrupt arrives:

| route | what the reader hears | handle closed before? |
| --- | --- | --- |
| Ctrl-C on a TTY | readline's own `SIGINT` event | yes — `rl.close()` in that handler |
| `SIGTERM` | **nothing** | no |
| any other abort of the run's signal | **nothing** | no |

`SIGINT` was covered because readline hands it to us. `SIGTERM` has no readline event at all, so the
only cue that can reach a reader parked on a question is the run's own `AbortSignal` — and the
reader was not given it.

The review's *"potentially keeping the process alive"* is the milder half. Under the real binary
`run.ts` reaches `process.exit(130)`, which ends the process regardless. The acute half is the one
AC-7(7) names and the one this package's own suite runs in: `test/invoke.ts` replaces `process.exit`
with a throw, so in process the leaked handle stays attached to the test's stream after the
invocation returns — leaked past the end of the run, in a Vitest worker that outlives it.

### The fix

`GateReaderOptions` gains `signal?: AbortSignal`, and `typed()` treats an abort exactly as it
already treated Ctrl-C: **close the handle, settle nothing.** The two flags became one `cancel()`,
because they were always the same concept — *an interrupt took this decision, so do not report that
nobody was there*.

- `packages/cli/src/gate.ts:205` — the cue, registered **after** `rl.question` and the `close`
  listener so `cancel` cannot close the handle before the listeners that read its `close` exist.
  A signal that has already fired gets `cancel()` called directly, because `AbortSignal` fires no
  event for a listener added after the fact.
- `packages/cli/src/gate.ts` `finally` — `removeEventListener` and `rl.close()` on every settling
  path, so a refusal below leaks neither the handle nor a listener on a signal that outlives the
  gate. The cancelled path never reaches it and needs neither: `cancel` closed the handle and
  `once` took the listener off.
- `packages/cli/src/run.ts:168` — the controller is now built before the reader and its signal is
  passed in. Five lines, three of them comment.

### Both branches mutation-tested, and each is killed by its own test

| mutation | result |
| --- | --- |
| remove the whole cue | **1 failed, 25 passed** — only the new SIGTERM test |
| remove only the already-aborted branch, keep the listener | **1 failed, 26 passed** — only the already-aborted test |

The pre-existing Ctrl-C test (AC-11(5)) stays green under **both**, which is the discriminating
result: it proves the SIGINT route is served by readline's own event and does not depend on this
wiring, so the new test has its own subject rather than shadowing one that already had coverage.

I added the already-aborted test because that branch is otherwise unfalsifiable, and a branch with
no subject is the defect class this repository has recorded most often. It asserts what the reader
must **not** do — settle — as well as what it must: an answer there would race the classification,
and a `stdin-closed` rejection would call a deliberate interrupt *nobody was there*.

---

## Major 2 — `gate.ts:215`, the angle brackets. **Refused, on three measurements.**

> *"The required AC-6 diagnostic says `pass --gate-answer <advance|retry|abort>` (or
> `<advance|abort>`), including the angle brackets… Update both variants to the exact required text
> and adjust the tests accordingly."*

I did not make this change. The evidence:

**1. The spike prints no brackets** (`spike/bin/harness.js:97`):

```js
… — pass --gate-answer ${retry ? 'advance|retry|abort' : 'advance|abort'} (repeatable, …
```

Ground rule 3 preserves behaviour. Adding brackets to a preserved spike string is a behaviour
change, and this ticket is not the place for one.

**2. Two landed fixtures build this exact sentence, and both say "byte for byte".**

- `spike/test/q0040-undecided.js:264`
- `packages/core/src/engine/undecided.test.ts:243`

Both construct the message with no brackets and throw it as a plain `FlowError` to prove a run is
classified by error **type** and not by its words — the discriminator AC-6(2) exists to make
non-optional. If the shipped CLI's wording drifts from theirs, those fixtures stop being *the
verbatim wording* and quietly become an arbitrary string: they keep passing while their subject has
moved. That is this repository's most-recorded defect class, arriving inside the check written to
prevent it.

**3. The requirement's text is placeholder notation, and the review's own remedy concedes it.**
AC-6 quotes `pass --gate-answer <advance|retry|abort or advance|abort>` — **one** bracketed group
containing the word "or". No single message can be verbatim that. The review had to *transform* it
into two variants to make it actionable; once a transformation is needed the text is not verbatim,
and the question is only which reading. The same sentence eight words earlier writes
`gate (<kind>) "<reason>"`, where `<kind>` is unambiguously a placeholder — so `<…>` is the
document's notation throughout that message, not literal output.

The shipped code already matches the spike byte for byte, so **nothing changed here except one
authority comment** at `gate.ts:242–247`, naming the two fixtures and why the wording may not drift.
That is so a later reader meets the reasoning at the site rather than re-raising this.

**An erratum is owed on AC-6's wording** — the placeholder notation should be spelled so a reviewer
cannot read it as literal. I cannot write it: `requirements/errata.md` is under `backlog/`, which
the engine discards, and *"A refused finding is a gate, not another round"* (2026-08-31) routes an
implement step's refusal to the human gate rather than to another traversal. Flagged here, not
improvised.

---

## File by file

| file | change |
| --- | --- |
| `packages/cli/src/gate.ts` | `GateReaderOptions.signal` added and documented; `typed()`'s two interrupt flags unified into one `cancel()`; the abort cue registered inside the promise executor after both listeners; `removeEventListener` + `rl.close()` moved into a `finally`; the module and function JSDoc updated to state that an interrupt closes the handle and settles nothing; one authority comment at the AC-6 throw site recording why the word list carries no brackets. |
| `packages/cli/src/run.ts` | The `AbortController` is built before the reader and `signal: cancellation.signal` is passed to `createGateReader`, with a comment naming AC-7(7). |
| `packages/cli/src/gate.test.ts` | Two tests added. One whole-run: a `SIGTERM` at an interactive gate exits 130, is not `undecided`, and leaves **zero** listeners on the input stream. One unit: a reader handed an already-aborted signal keeps no handle and settles nothing either way. |

## What I deliberately left alone

- **`spike/src/**` and `spike/test/**`** — untouched (ground rules 1 and 2). No mirror-and-re-record
  path is owed.
- **`packages/core/src/spike-parity.test.ts`** — no `spike/test/**` line moved, so its pinned totals
  and transfer share do not move. AC-14(5) is satisfied by showing that rather than by silence; the
  forced core suite is green.
- **The AC-6 message text** — refused above, preserved.
- **The abandonment signal.** `runFlow` races the caller's signal with its own `abandonment`
  controller (`engine.ts:388`). A consumer that stopped iterating would abort that one and reach the
  same shape of leak — but `consumeRun` uses `for await` with no `break`, so it is unreachable from
  this command. Reported, not chased: it is not the finding, and covering it would mean `core`
  publishing a signal it does not publish today.
- **The `waiting` map entry** a cancelled gate leaves behind in the banner rendezvous. Bounded by
  the number of gates, holds no handle, and is dropped with the reader. Not a leak in the sense
  AC-7(7) names.
- **Everything the review did not raise.** No tidying, no renames beyond the one flag the fix
  merged, no new option, no new dependency.

## Verification

All forced, in this worktree after `pnpm install --frozen-lockfile` and
`npm install --prefix spike`:

| | |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — `@quorum/cli` 19 files, **422 tests** passed |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `npm test --prefix spike` | **19/19 files passed** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"*, both environment rows |
| `src/gate.test.ts` | **27/27**, up from 25 |

The two new tests were each shown **red before green**, and each mutation kills exactly one of them
while leaving the other twenty-six green.

## For the gate

1. **AC-6's wording owes an erratum** — the placeholder notation reads as literal output and cost
   this round a major. The shipped string is the spike's and two landed fixtures depend on it.
2. **No decision entry is owed by this round.** Passing the run's own `AbortSignal` to the reader is
   the mechanism AC-11(3) already names, used for the criterion AC-7(7) already states; it is not
   new behaviour and not a new surface.
3. **OQ-4's split test is not tripped.** The gate reader took one revise round, not two, and the
   defect it carried was R-1's neighbour — the interrupt race the requirement predicted would be
   invisible to reading and have to be caught by outcome. It was.
