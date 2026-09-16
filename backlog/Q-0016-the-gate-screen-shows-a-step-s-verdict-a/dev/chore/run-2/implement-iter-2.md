# Q-0016 — implement report, run 2, iteration 2

*A revision round. All three findings are addressed and none is refused; §1 answers each one, §5 is
what I found on the way, and §7 is what the gate still owes.*

---

## 1. The three findings

### BLOCKER — `load()` released the in-flight guard, so a Refresh let a second answer race the first

**Accepted in full, and the reviewer's diagnosis is exact.** `load()` set `sending.current = false`
and cleared the answer state, so pressing Refresh while an answer was outstanding re-enabled the
controls and a reader could send a different one — and what a released guard permits is not a repeat
of the answer already sent but an **`abort` overtaking an `advance`**. The second half is real too:
the older request then cleared the guard unconditionally while a newer one was pending.

**What changed.** A read releases nothing and withdraws nothing:

```ts
const load = useCallback(() => {
  if (!sending.current) setAnswer(null);
  read();
}, [read]);
```

The release in `send` stays unconditional, and it is now **correct by construction rather than by
luck**: nothing but the answer's own resolution clears the guard, so no second answer can begin while
it holds, so the request that clears it is always the request that set it. The reviewer's second
clause is closed by the same line rather than by a second condition.

**The two halves of *inert* still have to agree**, which is what round 1 was right about and fixed
the wrong way round. Because `load()` also leaves an in-flight answer standing, `busy` stays true and
the controls stay disabled — so what a reader gets is the run read again with the outstanding
answer's own sentence beside it, naming the request it is waiting for. A read is not a withdrawal.

**Two consequences I had to close rather than inherit.** The generation counter guarded the answer as
well as reads, and a Refresh bumps it — so once `load()` stopped clearing the region, a settled answer
arriving after a Refresh would have been *dropped*, leaving the controls inert with nothing
outstanding. That counter now governs reads and nothing else; an unmount-only `alive` ref is what
stops a late answer settling a screen that is gone; and a `showing` ref — `loadedFor`'s half that an
async continuation can reach — clears rather than settles an answer about a run the screen has moved
off. That last case is not reachable from this app today (nothing links to a second gate URL), and it
is two lines rather than an abstraction: without them my fix would have replaced a race with a
permanent *on its way*.

### MAJOR — the shell opened a socket at the gate route

**Accepted.** `app.tsx` built a `RunConnection` for every route the register gives a `:handle`, the
gate route included, so visiting a screen erratum E-2/GO-4 ruled holds no socket opened one anyway.
The finding is right that this is the ruling's subject rather than its letter: a shell streaming a run
behind a screen that is deliberately not live is the same socket by another door, and it answers a
**second way about the same handle** — one the host never minted is a 1008 close there and a route
refusal here.

**What changed**, and it is one name rather than a rule about children:

```ts
const handle = rendered.kind === 'screen' && rendered.route.path !== GATE_ROUTE && 'handle' in rendered.params
  ? rendered.params.handle : undefined;
```

`/runs/:handle` and `/runs/:handle/steps/:stepId` are untouched, and the test asserts both directions
so the clause discriminates rather than reporting that nothing anywhere connects. Off a connecting
route the top bar shows the `idle` sentence, which is what `/backlog` already shows and which
`shell.test.ts` already pins as present rather than blank.

**Not pre-existing-therefore-not-mine.** It *is* pre-existing — the route has carried a `:handle`
since Q-0014 — and it became a defect when this ticket put a screen behind it with a ruling attached,
which is why it is fixed here rather than registered.

### MAJOR — the refused state did not report the daemon's own condition

**Accepted, and the reviewer is right about the authority.** Round 1 delivered AC-10's `refused`
clause in a weaker form and flagged it for the gate; a criterion is not relaxed by an implement report
saying so, and no erratum touches AC-10. My round-1 reasoning — that AC-1 authorises exactly one added
field — does not hold either: AC-1 says what `gates` is *for* and forbids nothing beside it, and the
seven-key assertion that made the limit feel binding was **my own test**, not a criterion.

**What changed.** `WireRun` gains `refusal`, carrying `RunView.refusal` whole:

```ts
readonly refusal: { readonly condition: string; readonly remedy: string | null } | null;
```

It narrows nothing, so Q-0121 GO-3's naming rule is satisfied for the reason `gates` is rather than as
an exception. **It is deliberately not a `WireRefusal`**, and that is the one judgement in this change
worth a reviewer's eye: that shape carries a `code` which `startRefusalCode` produces so `POST /runs`
can pick a **status** for a request it is refusing, and a run row is answered `200` — a code here
would attach a status nobody sent to a refusal nobody asked for, and composing one would have meant
moving that classifier between modules to reach the projection. The condition is `core`'s own sentence
and the remedy is the daemon's, both rendered unaltered (decision 082's two owners).

**`null` on a refused row is a real case, not a defensive branch.** A record is minted `refused` and
stays so until its start resolves, so a row read inside that window is a refusal nobody has written
yet. The screen says that (`REFUSAL_UNSTATED`) rather than composing a likely reason, and both cases
are tested.

**No decision entry is owed**, re-checked at each of erratum E-3's five grounds rather than assumed:
the event union is unchanged (this is a wire shape, and `gateQuestionEventSchema` is still reused as
an element rather than altered); nothing reads, lists or serves `.harness/`; no route is added, so the
architecture document's route list is still executed rather than changed; no dependency is added; and
the naming rule binds and is met.

---

## 2. File by file

| file | what changed |
| --- | --- |
| `apps/web/src/gate-screen.tsx` | the guard fix — `load()` releases nothing and clears no live answer; `generation` narrowed to reads with the reason in place; `alive` and `showing` added; `GateSubject.refused` carries the refusal; `RefusalRegion`; `REFUSAL_PREFIX` and `REFUSAL_UNSTATED`; `GATE_SUBJECT_TEXT.refused` no longer claims the route carries no reason; the header's no-socket paragraph names the route as well as the screen |
| `apps/web/src/gate-screen.test.ts` | the Refresh pin **inverted** rather than deleted, with a settle step proving it is not a deadlock; two refused-state clauses; the gate route asserted to open no socket, with mission control's route as the discriminator; `run()` fixture gains `refusal` |
| `apps/web/src/app.tsx` | the gate route excluded from the live connection by the register's own constant, with the ruling named; header sentence moved with it |
| `apps/web/src/daemon-client.test.ts` | `RUN` fixture gains `refusal` |
| `packages/shared/src/wire.ts` | `WireRun.refusal` and its schema entry, nullable rather than optional; the docblock says what it is and what it is not |
| `packages/shared/src/wire.test.ts` | a refused row's clause — the reason crosses, a `code` is refused, absent is not a third answer; `RUN` fixture and the two annotation fixtures gain the field so each still demonstrates one omission |
| `packages/server/src/wire.ts` | `wireRunOf` carries `refusal`; docblock states why no code |
| `packages/server/src/http.test.ts` | the key set is eight; a new clause proving the row carries the host's own condition over a real host and app, and `null` on a run that started |
| `docs/04-architecture.md` | the row shape and what `refusal` is and is not; §`apps/web` gains the route-holds-no-socket clause, the read-withdraws-nothing clause and the refused-state clause; status line |

---

## 3. What I deliberately left alone

1. **`packages/core` — untouched.** No engine change, no answer-set change.
2. **No fifteenth route**, no new dependency, no decision entry, no `.harness/` exposure.
3. **`startRefusalCode` stays in `http.ts`.** Moving it beside the status table whose keys it produces
   would have let the row carry a `WireRefusal`; §1 says why the row should not carry one anyway, and
   moving a shipped function to enable a field I then argue against would be tidying twice over.
4. **`run-connection.ts` is untouched.** The exclusion is in the component that owns the controller.
5. **`packages/server/src/static.ts` and the route order are untouched** — see §7(3).
6. **`docs/05-design-prompt.md` and `docs/06-development-plan.md` are untouched.** Neither is a
   subject of these three findings, and the plan's bullets are rewritten by hand at each plan pass.
7. **`backlog/` untouched**, as the role requires.

---

## 4. Shown red before green — five mutations, each with a discriminating message

| # | mutation | what went red |
| --- | --- | --- |
| 1 | `load()` releases the guard again (the reported blocker, restored) | *"a fresh look re-enabled the controls while an answer was outstanding: expected false to be true"* |
| 1b | …with that clause neutralised, to prove the next one is not decorative | *"the fresh look erased the sentence saying an answer is on its way"* |
| 1c | …and with both neutralised, to reach the harm itself | *"a second answer was sent while the first was still in flight: expected 2 to be 1"* |
| 2 | the gate route's exclusion removed from `app.tsx` | *"the gate route opened a socket: expected [ …(1) ] to strictly equal []"* |
| 3 | `wireRunOf` answers `refusal: null` | *"the row carries a reason the host did not give: expected undefined to be 'ticket not found: T-0404'"* |
| 4 | `gateSubjectOf` drops the refusal | *"the daemon's own condition for the refusal is not rendered"* |
| 5 | the refusal schema loses `.strict()` | the *not-a-`WireRefusal`* clause: *"expected [] to strictly equal [ 'unrecognized_keys' ]"* |

1b and 1c were run because assertion order otherwise hides two of the inverted pin's three clauses —
each is independently load-bearing, and **1c is the finding's actual harm**: an `abort` dispatched
after an `advance`, on a control a reader can see is live.

---

## 5. What I found, and where I diverged

**(a) The inverted pin is Q-0116's shape, and the sentence it replaced was wrong in the right
direction.** Round 1's clause asserted that a fresh look *releases* the controls, under a comment
correctly naming the hazard it was closing — a ref and a state disagreeing, so a control looks live
and swallows a press. That hazard is real and the remedy was the wrong one of the two available. The
test now carries both halves of the history so a later reader does not re-derive the release as an
improvement.

**(b) The AC-13 source scan refused a word I wrote, and the guard was right.** It forbids
`\bdiff` in the screen's source, and my comment said *"a second, different answer"* — reported as
*"the screen names diff"*. The scan over-collects by design (a prefix, not a whole word), which is
the safe direction, so the **prose moved rather than the needle**: weakening a guard to admit a
comment is how a scan stops being about its subject.

**(c) The daemon probe this environment refused last round now runs, and one measurement is worth
recording.** Against `quorum open --no-open --port 7921` on the merged tree: `/runs/run-1/gate`,
`/backlog` and `/settings` each answer **200 text/html** to a browser's own `Accept`, a missing asset
answers **404 text/plain**, and `GET /runs/never-minted` answers **404** with the daemon's own
`{code: "no-such-run", condition: "no run is registered under that handle", remedy: null}` — which is
AC-10's `no-such-run` state end to end rather than in process.

**(d) The refusal field cannot be proven over a real socket, and the reason is a ruling rather than a
gap.** `POST /runs` answers a refused start with a `WireRefusal` carrying **no handle** and `GET /runs`
excludes refused starts (Q-0121), so no client is ever told a refused run's handle — the row is
reachable only by guessing one. So the proof is `http.test.ts`'s: a real host, a real app, a real
refusal, read back through the schema a browser parses it with. That is honest rather than a
shortcut, and it is the same constraint that makes the `refused` state contrived-but-real on the
screen.

**(e) One risk the requirement named has not materialised this round.** R-6 predicted truncation; this
diff is **368 lines across nine files**, so `repo.max_diff_bytes` is not in play and the reviewer sees
the whole change.

---

## 6. Verification

- `pnpm install --frozen-lockfile`, then `pnpm turbo run test lint typecheck --force --continue` —
  **21/21 tasks successful, 0 cached**. Run after every mutation was reverted, and again after the
  last comment edit.
- `pnpm turbo run build --force` — **5/5, 0 cached**, so the changed modules compile into the served
  bundle and the four `tsc` emits are unaffected.
- `pnpm exec quorum lint` — **6/6**.
- Package counts after the change: `@quorum/shared` 247, `@quorum/server` 212, `@quorum/core` 1546,
  `@quorum/cli` 692, `apps/web` 15 files / 319 tests, of which `gate-screen.test.ts` is 38.
  *(Round 1's report said 349 for this package; I could not reproduce that figure by any invocation
  and the suite is green either way — recorded rather than silently corrected.)*
- **Environment row: the bare one.** Checked rather than assumed — this worktree has neither
  `.harness/worktrees` nor `.quorum/runs`, and the daemon probe above created neither. The populated
  row on `main` after the merge, and Q-0079's git-identity sweep, are the gate's (GO-6).

---

## 7. For the gate

1. **The `refusal` field is a second wire widening, taken rather than referred back.** The reviewer
   offered *"carry the refusal through and render it, or obtain an explicit requirements ruling"*;
   I took the first, because AC-10 asks for the condition in as many words, nothing in my paths or in
   a landed entry forbade it, and E-3's five grounds each still answer *no entry owed*. If the gate
   disagrees about the shape rather than the field, the decision is whether a row should carry a
   `WireRefusal` with its `code` — which costs a function moving between two server modules and is
   argued against in §1.

2. **Nothing holds `04-architecture.md`'s row-key sentence against the schema.** The document names
   the eight fields and `http.test.ts` asserts the same eight, and no check compares them, so the
   paragraph can go quietly out of date. I did not add one: deriving the key set means reaching into
   zod's internals past the `z.ZodType<WireRun>` annotation, which is brittle across versions, and
   inventing a check is beyond AC-14's *Test:* clause. Registered rather than left unmentioned.

3. **An observation about a route this change does not touch, stated carefully because it is easy to
   overstate.** With a browser navigation `Accept`, `GET /project` answers **200 text/html** rather
   than JSON — `mountStatic` is registered first and classifies a navigation before the JSON routes
   are reached. It is pre-existing (Q-0122's own hand verification used a default `Accept`, which
   still answers JSON), the app's own fetch sends `Accept: */*` and is unaffected, and a human who
   types `/project` getting the shell is defensible. **I am not claiming it is a defect** — it is a
   measurement somebody should weigh once, and not on this ticket.

4. **GO-6's real walk is still owed**: a run parked at a real gate, answered from the browser, with
   the run continuing. The route serves and the read routes answer, which is as far as a probe
   without an adapter reaches.
