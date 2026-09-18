# Q-0135 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at its gate and binding on the implementer and the
reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands, and all ten of
its criteria stand as written.

## E-1 — GO-1 is discharged: AC-8 is ruled as written — 2026-09-18

**Supersedes** GO-1's *"rule AC-8 before the run starts"* and OQ-1's status as a question. It
supersedes **no criterion**: AC-8 is ruled exactly as `merged.md` specifies it, and the re-cut that
OQ-1 names as the consequence of a refusal does not happen.

**The ruling.** `WireRun` and `wireRunSchema` gain `readonly dry: boolean` — **required rather than
optional, and never inferred**. `RunRecord` retains the start request's effective value (`false`
where the field was omitted), `RunView` declares it, and `wireRunOf` projects it.

**Why, on evidence measured at this gate rather than on §0.2's reading of the source.** The hazard is
not theoretical and it is not a missing answer; it is a wrong one, and it reproduced on this
ticket's own run within the hour:

1. A `--dry` walk of `requirements` on Q-0135 reported `run #1` to its caller and wrote no run
   history — `reportRunNumber` is outside the `!dry` guard at `engine.ts:357`, deliberately and with
   a comment saying so, while `initialiseRunHistory` is inside it at `:366`.
2. `nextRunId` is `max(history entries, the run=N matches in runs.log) + 1` and **reserves nothing**,
   and under `dry` both sources are stubbed by `readOnlyBacklog`.
3. The real run then took `run=1` and created `.quorum/runs/Q-0135-1`.

So a browser that had watched the dry walk holds `ticketId` and a non-null `runId`, composes
`Q-0135-1`, and reads a manifest belonging to **a different run** — rendering this run's
`started_at`, elapsed and per-vendor cost as the dry walk's. It is reachable from the shipped UI:
`ticket-page.tsx:351` carries the `data-dry` checkbox, `:614` sends the field, and Q-0130 AC-12's
`FORBIDDEN` start fields are `['auto', 'base']`, so `dry` is deliberately permitted.

Inferring dryness from a 404 is refused on the ground *"A gate question carries the decision that
reached it"* (2026-09-17) refused inference where identity is available — and here inference is not
merely weaker but **insufficient**, because a 404 is the case it would get right.

**No decision entry is owed, and the reason is recorded rather than assumed.** Adding to `WireRun` is
precedented: Q-0016 added `gates` and `refusal` to this exact shape with no entry. Q-0121 GO-3's
naming rule permits the name, `dry` narrowing no `RunView` field. `WIRE_START_FIELDS` already carries
`'dry'`, so this makes the wire symmetric in a word it already speaks in one direction. *"A dry run
changes nothing the caller passed it"* (2026-09-11) is about what a walk **writes**, and a read row
is not a write — that entry stays true verbatim.

**The bound, so a reviewer does not raise it.** This rules one field onto one shape. It does not
authorise a second start-request field onto `WireRun`, and it does not reopen what `--dry` may
change: R-8 still binds, so the field moves across every projection and fixture together.

## E-2 — GO-2 is discharged: AC-11's narrowing is ruled as written — 2026-09-18

**Supersedes** GO-2's *"rule AC-11's narrowing at the gate too"*. It supersedes no criterion, and it
authorises no widening beyond the one AC-11 specifies.

**The ruling.** `apps/web/test/source.test.ts`'s clause *'nothing refetches on a timer, and nothing
persists a board in the browser'* is narrowed from **no timer primitive appears** to **no fetch is
reachable from a timer callback**. The narrowing is permitted, it is a visible act, and the
implementer does not owe an argument for it — which is what ruling it here buys, on Q-0083's channel.

**Why it is a restoration rather than a weakening.** The guard bans the bare strings `setInterval(`,
`setTimeout(` and `requestIdleCallback(` across every file under `apps/web/src`, comments included,
with no exemption register — while its own comment justifies itself **entirely** in terms of
refetching: *"an interval would make the most expensive route on the transport this app's hot
path."* It is keyed on the mechanism where its own title and comment name the behaviour. Narrowing
it to the behaviour restores the subject it already claims. Seventh instance in this repository of a
guard keyed on a name rather than the behaviour it is about (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108,
Q-0115, Q-0122).

**What it must still forbid, stated so the narrowing cannot be over-read.** A timer that reaches
`fetch`, `requestJson`, or any `fetch*` helper — directly or through a function it calls — still
fails, and so does any persisted board. The permitted case is exactly the one AC-12 needs: a timer
whose callback reads a clock and sets local state. **The narrowed guard must be shown red over a
fixture that polls**, which AC-11 already requires; a narrowing demonstrated only by the suite going
green has not been established (*"A check is not established by reading it"*, 2026-08-29).

**The failure mode to avoid, named rather than left to be rediscovered.** Q-0079's round 2 is the
case: a repair for a comment bypass shipped a repository-wide silencer — the same shape under a new
token, written by the hand that had just been shown the mistake. A narrowing that introduces a
per-file opt-out, an exemption register, or any marker a future file can carry to escape the clause
is **refused by this ruling**; what is permitted is a change to the *predicate*, not an escape hatch
beside it. This is also the Q-0014 AC-5 failure to avoid — a scan narrowed until every file carrying
the defect sits outside it.

## E-3 — the review loop is ruled at its exhaustion gate: round 3's major is accepted, round 2's first half is refused — 2026-09-18

**Supersedes** nothing in `merged.md`. It rules what the three review rounds asked of **one** guard —
`apps/web/test/source.test.ts`'s narrowed timer clause — so that the one remaining round has a
bounded and satisfiable task rather than a fourth hole to close. Written **at the gate and before
the retry is answered**, because an erratum landed after an answer is not read by the round it was
written for (Q-0097 lost two that way; *"the window for an erratum is a gate"*, Q-0094 E-3).

### What is accepted, because it is a defect and not an escalation

**Round 3's major stands.** `bindings()` matches declaration heads over the text **as written** while
taking depths from `depthsOf`, and the JSDoc above it argues the asymmetry is safe: *"A head found
inside a comment or a string is a name that does not exist, which adds an entry and can never remove
the real one."* **That sentence is false**, and it was verified at this gate by executing the shipped
function rather than by reading it — which is this repository's own rule (*"A check is not
established by reading it"*, 2026-08-29). Over

    const reload = () => 'const fake' && fetchRuns(request, clock);
    setInterval(() => reload(), 1000);

the binding `reload` captures `const reload = () => '` and **does not contain its own fetch**, while
the bogus `fake` — born inside the string — captures `fetchRuns(...)`. `reload` is therefore absent
from `requestingNames`, and the timer calling it is not reported. **The prohibition AC-11 exists to
state is unenforced for that shape.**

The reasoning's error is precise and worth naming, because it is subtle and a fourth round should not
re-derive it: a bogus head does not only **add** an entry, it **terminates the extent** of the real
binding that precedes it whenever its depth is less than or equal to that binding's. The comment
weighed the adding and missed the terminating. The realistic form is not the contrived literal above
but a commented-out line inside a braceless arrow function, where the comment sits at the same
bracket depth as the head:

    const load = () =>
      // const cached = ...
      fetchRuns(request, clock);

**The remedy is the narrow one the review named**, and it is available rather than new: select heads
from `codeOnly`'s **index-preserving** blanked text, or reject a raw head whose declaration token was
blanked. `codeOnly` already exists and `depthsOf` already reads it, so this is one filter and not a
new instrument. **It must be shown red before green** — a string fixture and a comment fixture that
both fail under the current implementation and pass after — because a fix demonstrated only by the
suite staying green has not been established.

### What is refused, and why the refusal is not a weakening

**Round 2's first half is refused as raising the job**: *"Use a syntax-aware traversal or a lexical
scanner that skips literals/comments"* as a **general** demand. AC-11's `Test:` clause bounds this
instrument at four demonstrations — a fixture scheduling a fetch inside a timer fails naming the
file, a render-only tick passes, the two are shown to differ by the fetch alone, and the
pre-narrowing clause is demonstrated to fail over the shipped tick. **A criterion's `Test:` clause
bounds the instrument: a reviewer may find the instrument fails the job that clause gives it — which
is what rounds 1 and 3 correctly did — and may not raise the job.** Seventh site, after Q-0067 E-1
and Q-0131 E-6.

Two further grounds, so the refusal rests on more than precedent. A syntax-aware traversal means a
JavaScript parser inside a test guard, and `.claude/rules/engineering.md` makes a new dependency a
separate decision with its own justification — work no implement step on this route may perform.
And the demand has no stopping condition: three rounds have each found a new hole in a hand-rolled
analyser, and a fourth would find a fifth. **The guard is a tripwire, not a sandbox.**

**Round 2's second half was accepted and has landed**, and is recorded here so it is not re-raised:
`asNeedle` is now used at the callback boundary (`:1180`) as well as in `requestingNames` (`:1144`),
with a discriminating `other$reload` fixture. Round 1's two majors and its nit are likewise closed.

### What the last round owes instead of more strength

**The guard states its blind spots, in its own header and in its failure message.** This is not an
addition to AC-11: that criterion already requires the narrowing be *"recorded in place with its
reason **and in the guard's own failure message**"*, and what a lexical guard cannot see is part of
that reason. It says, in substance, that it is lexical rather than syntax-aware; that it reads a
module's text and not its semantics; and that a callback written to evade it can pass — so a reader
meeting a green tick knows what was examined. That is Q-0079's tripwire discipline, whose header
says it *"sees literals only and says so"*, and `turbo-inputs.test.ts`'s fail-open disclosure. **An
unstated weakness becomes a stated bound**, which is the honest close and is what *"A green tick
names what it examined"* (2026-08-27) asks for.

### The bound on round 4, stated so it is not exceeded

No parser and no new dependency. **E-2's bound is unchanged and still binds**: no file-level
exemption, no comment token, no register of permitted callers — the discriminator is what the
callback does. Nothing outside `apps/web/test/source.test.ts` and its fixtures needs to move for
this, and no criterion of `merged.md` changes. **This is the last round**; whatever it returns, the
gate that follows is answered rather than retried, and anything outstanding is repaired by hand
after it on Q-0073's and Q-0080's precedent.
