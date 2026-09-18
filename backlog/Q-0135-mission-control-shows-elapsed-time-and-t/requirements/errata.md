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
