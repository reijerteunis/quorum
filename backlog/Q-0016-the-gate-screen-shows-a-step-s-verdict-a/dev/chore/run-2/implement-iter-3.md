# Q-0016 — implement report, run 2, iteration 3

*A revision round on one finding. §1 answers it, §4 is the mutation evidence, §5 is what I found on
the way, and §7 is what the gate still owes.*

---

## 1. The finding

### MAJOR — the answer outcome was hidden by the read that follows it

**Accepted in full, and the reviewer's diagnosis is exact.** `send()` records what the daemon did
with an answer and then calls `read()`, which synchronously puts the run back in flight. Everything
below the heading was drawn inside the loaded-run branch, so the next paint took the early return and
the answer region was not rendered at all. What that costs is precisely the two sentences AC-11 and
AC-12 exist for:

- **AC-11** — *"On a `204` the screen says which answer it sent"*. It said it for as long as it took
  React to commit, and then stopped. If the follow-up read hangs, the screen never says it; if the
  read fails, what a reader is left with is a failure about a request they did not make, with no
  mention of the answer they did.
- **AC-12** — *"`no-such-gate` renders as the gate is no longer waiting"*. Worse, because that
  sentence is the only thing standing between a reader and answering a third time. Hidden, what is
  left on the page is a request that looks like it is still happening, which reads as an invitation.

Both are on the **unreliable-response paths those criteria are about**, which is why a fixture that
answers the read in the same turn — which is what every existing clause did — could not see it.

**Reproduced before it was fixed.** Four clauses, red against the unfixed screen with discriminating
messages:

```
AssertionError: the screen stopped saying the daemon had taken an answer:
  expected 'Gaterun-7Asking the daemon for /runs/…' to contain 'The daemon accepted this answer:'
AssertionError: a gate that is no longer waiting stopped being reported as that:
  expected 'Gaterun-7Nothing answered /runs/run-7…' to contain 'That gate is not waiting any more…'
```

**What changed.** The answer region is drawn outside the branch that holds one run, in both renders:

```tsx
const shown = loadedFor === handle ? run : runInFlight<WireRun>(handle);
const sent = answer !== null && answer.handle === handle ? answer.state : null;
```

and the not-loaded return carries `{sent === null ? null : <AnswerRegion … />}` beside the run's own
`RequestRegion`. A reader waiting on the follow-up read now sees both: *Asking the daemon for
`/runs/run-7`…* and *The daemon accepted this answer: **Advance**. Reading the run again to see where
it is now.*

**The reviewer offered two remedies and the other one is refused, with its reason.** *Retain the last
loaded run during refresh* would keep the parked question — **and its controls** — on the page after
an answer was accepted, live, until the read returns: `sending` is released by then, so a reader
could answer a gate they had just answered. That is the shape run 2's first round stopped on,
reintroduced through the other door. The region moves; the run does not.

### What the hoist cost, and why it is a second change rather than one line

The loaded-run branch was **carrying the handle guard implicitly**: nothing about one run could be
drawn under another because the branch itself was gated on `loadedFor === handle`. Drawn outside it,
the answer region is gated by nothing — so what it is *about* has to travel with it:

```ts
interface AnsweredGate { readonly handle: string; readonly state: RequestState<GateAnswer>; }
```

Without it, a screen moved from one run to another names the first run's gate path under the second
run's heading — a prop is committed before the effect reacting to it runs, and an answer still in
flight is not cleared by that effect either (that is run 2's own blocker fix). `loadedFor` cannot
stand in for it: it moves with the read, which is a request that has not come back yet. Mutation 2
is that shown red.

One consequence, and it is the rule run 2 established rather than a new one: **`busy` reads the
guard, not this handle's answer.** `answer?.state.kind === 'in-flight'` is exactly `sending.current`,
so the two halves of *inert* agree. Drawn from `sent` instead, a second run's controls would be live
while the guard still held the first run's answer — a control a reader can press that silently does
nothing, which is the disagreement §5(f) of the last report named. Mutation 3 is that shown red.

---

## 2. File by file

| file | what changed |
| --- | --- |
| `apps/web/src/gate-screen.tsx` | `AnsweredGate` — the answer and the run it is about; `sent`, the answer this handle may see; the answer region drawn in the not-loaded return as well as the loaded one, with the reason in place; `busy` moved above the branch and read from the guard; `loadedFor`'s comment narrowed to the run, which is now all it guards; two words moved for the source scans (§5(b)) |
| `apps/web/src/gate-screen.test.ts` | `afterAnswering()` — a daemon whose second read never arrives or fails; two `test.each` pairs, under AC-11 for the `204` and AC-12 for `no-such-gate`; one clause for the handle guard and the inert-controls half; one word moved for a source scan |
| `docs/04-architecture.md` | §`apps/web` gains the clause that what the daemon did with an answer outlives the read that follows it, and that what each region is about travels with it; the status line's `apps/web` summary moved with it |

---

## 3. What I deliberately left alone

1. **`packages/shared` and `packages/server` — untouched this round.** The finding is a rendering
   defect in one module; no wire shape, no projection and no route is implicated.
2. **`packages/core` — untouched.** No engine change, no answer-set change.
3. **No fifteenth route, no new dependency, no decision entry, no `.harness/` exposure.** Re-checked
   at each of erratum E-3's five grounds and each still answers *no entry owed*: the event union is
   unchanged, nothing reads or serves `.harness/`, the route list is executed rather than changed,
   nothing was added to a manifest, and Q-0121 GO-3's naming rule is unaffected — this round adds no
   wire field at all.
4. **`run-connection.ts` and the gate route's exclusion from it — untouched.** GO-4 stands.
5. **The `showing` ref and its branch in `send`** — see the nit in §7(1). It still does work and its
   comment still describes it.
6. **The AC-13 needles.** Two of them fired on prose I wrote. The prose moved; weakening a scan to
   admit a comment is how a scan stops being about its subject (§5(b)).
7. **`docs/05-design-prompt.md` and `docs/06-development-plan.md`** — neither is a subject of this
   finding, and the plan's bullets are rewritten by hand at each plan pass.
8. **`backlog/` untouched**, as the role requires.

---

## 4. Shown red before green — five mutations, each with a discriminating message

| # | mutation | what went red |
| --- | --- | --- |
| 1 | the answer region put back inside the loaded-run branch (**the reported defect, restored**) | 4 tests — *"the screen stopped saying the daemon had taken an answer"* (×2) and *"a gate that is no longer waiting stopped being reported as that"* (×2) |
| 2 | `sent` taken from the answer with no handle comparison | *"one run's answer is rendered under another run's heading: expected 'Gaterun-8 · chore · Q-0016Refresh…' not to contain '/runs/run-7/gate'"* |
| 3 | `busy` narrowed to `sent?.kind === 'in-flight'` | *"a control was live while an answer was still outstanding: expected false to be true"* |
| 4 | *(as 1, per case)* the `204` pair alone | the two AC-11 clauses, each naming the missing sentence rather than the branch |
| 5 | *(as 1, per case)* the `no-such-gate` pair alone | the two AC-12 clauses |

Every new clause also carries its own anti-vacuity assertion: the two `test.each` pairs assert
`controls(container).length === 0` — *the run is still loaded, so this clause has lost its subject* —
which is what proves they are exercising the branch that used to hide the region rather than passing
over the loaded one; and the handle clause asserts the second run drew a control at all before
asserting it is inert.

---

## 5. What I found, and where I diverged

**(a) The fixture shape is the finding, not the assertion.** Every clause that existed answered the
follow-up read in the same turn as the answer, so the region came back before anything was asserted
and the defect was invisible to all of them. `afterAnswering()` separates the two: the first read
answers a parked run, the POST answers, and the **second** read either never arrives or fails. That
is the shape the criteria are about — *"the screen says which answer it sent"* is a claim about the
exchange that happened, and it has to hold when the request after it does not.

**(b) Three source scans fired on prose I wrote, and all three were right.** The AC-13 scan over the
screen forbids `\bdiff` as a prefix, and my comment said *"answers to different questions"* —
reported as *"the screen names diff"*. It also forbids `blocker`, and I had cited the review's
blocker by that word. And Q-0017's containment scan forbids `landed` in every file under `src`, which
caught four *"the read never lands"* comments in the new fixture. Each over-collects by design, which
is the safe direction, so the prose moved: *two unlike questions*, *what the run-2 review stopped
on*, *never arrives*. This is the second consecutive round in which that scan has refused a comment
of mine; the last report recorded the first, which is why I checked rather than assumed the needles
were wrong.

**(c) The distinction between the two guards is now stated where the code is.** `loadedFor` guards
the run and nothing else, `AnsweredGate.handle` guards the answer, and the comment above `shown`
says why they are separate: a question and its controls may only be drawn from a run this handle was
read for, while what the daemon did with an answer is established by that exchange alone. The old
comment said `loadedFor` guarded *"everything above"*, which the hoist made false — corrected in the
same change, on the rule that a comment claiming what the code no longer does is the class this
repository records most.

**(d) The loopback probe round 2 performed could not be repeated, and I am not reporting it as
done.** `pnpm exec quorum open --no-open --port 7923` starts against this worktree and prints
`✓ Quorum is serving http://127.0.0.1:7923`, so the built bundle loads and the daemon binds — but
both `curl` and `node -e` with `fetch` were refused by this session's command approval, and the
session is non-interactive. Round 2 got those approved and measured `200 text/html` at the gate
route, a `404 text/plain` for a missing asset and `GET /runs/never-minted` answering the daemon's own
`no-such-run`; nothing in this round touches routing, the static mount or the wire, so those
measurements stand unaltered. The daemon created nothing: this worktree still has neither `.harness`
nor `.quorum`, checked after it was stopped.

**(e) Two package suites fail under a root `vitest run` and are green through turbo**, which is worth
recording because it wasted a measurement: `apps/web/test/package.test.ts`'s and
`packages/server/src/package.test.ts`'s source-condition clauses resolve through `quorum-source` only
when the package's own configuration is in play. Verified through `pnpm turbo run test` — which is
what `integrate` runs — they pass. Nothing was changed for it.

---

## 6. Verification

- `pnpm install --frozen-lockfile`, then `pnpm turbo run test lint typecheck --force --continue` —
  **21/21 tasks successful, 0 cached**. Run after every mutation was reverted.
- `pnpm turbo run build --force` — **5/5, 0 cached**, so the changed module compiles into the served
  bundle and the four `tsc` emits are unaffected.
- `pnpm exec quorum lint` — **6/6**.
- `pnpm sweep:git-identity` — **green in both checkout shapes**, the workspace suite executed with no
  resolvable git identity. Run this round rather than deferred, because the round adds tests.
- Package counts after the change: `apps/web` 15 files / **324** tests, of which
  `gate-screen.test.ts` is **43** (38 before this round). Diff: **171 lines across three files**, so
  `repo.max_diff_bytes` is not in play and the reviewer sees the whole change — R-6 does not fire
  here, where it did on the round before.
- **Environment row: the bare one.** Checked rather than assumed, twice — after the sweep and after
  the daemon was stopped — this worktree has neither `.harness/worktrees` nor `.quorum/runs`. The
  populated row on `main` after the merge is the gate's (GO-6).

---

## 7. For the gate

1. **A nit I am reporting rather than fixing.** `send`'s stale-handle branch still reads
   `showing.current !== handle` and clears the answer. With the handle carried on the answer state,
   clearing is no longer what keeps the region correct — what that branch is still load-bearing for
   is **not starting a read for a run the screen has moved off**, which would otherwise put the new
   run's screen in flight for a read nobody asked for. Its comment states both reasons and is
   accurate, so I left it. Removing the clearing would be tidying a guard this finding did not
   reach.

2. **GO-6's real walk is still owed**, and this round reached less of it than the last: a run parked
   at a real gate, answered from the browser, with the run continuing. §5(d) says exactly how far the
   probe got and why.

3. **One state is correct and unexplained, deliberately.** A screen showing run B while an answer to
   run A is still outstanding draws B's controls **inert** — the guard is global — with the sentence
   explaining why hidden, because that sentence is about A. Inert-with-no-explanation is the better
   of the two available wrongs against live-and-silent, and the state is not reachable in the shipped
   app: nothing links to the gate screen at all until Q-0015, so moving between two gate URLs is a
   full page load. Pinned by the clause in §4 mutation 3 rather than left to be found.

4. **The run-2 reviewer's observation is carried forward.** Its patch contained no patch for
   `packages/shared/src/wire.ts` or `wire.test.ts` and it read them from the branch instead — which
   is Q-0124's truncation warning working, and R-6 as the requirement predicted it. Recorded so the
   gate knows those two files were reviewed by inspection rather than from a diff.
