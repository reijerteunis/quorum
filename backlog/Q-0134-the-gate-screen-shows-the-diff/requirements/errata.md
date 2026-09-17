# Q-0134 — errata

Written at the requirements gate on 2026-09-17, before any implement step runs. The window for an
erratum is a gate (Q-0094 E-3), and a chore implement step reads **this file** and not `ticket.md`
(Q-0125).

`requirements/merged.md` is the specification — fourteen criteria, ready at iteration 2. Nothing
below changes a criterion.

---

## E-1 — GO-1 ratified: no decision entry is owed, and the ruling lives in the route's authority comment

§0.1's ruling is taken. Its test is the one this repository actually applies — *does any landed
sentence go false?* — and it answers no at five named sites, each re-checked rather than relayed:
the glossary's **Event** term, `events.ts`'s *"one optional field and not the beginning of a
family"*, decision 097, the glossary's **Occurrence** and **Run history**. Nothing is added to the
union and nothing new is persisted, so there is nothing to supersede. Each limb has its own recent
precedent for owing none — a read-only daemon route (Q-0119, Q-0121 GO-1), bounded in-flight daemon
memory (Q-0123), an out-of-band `RunFlowOptions` callback (Q-0131 GO-1, one day old and the same
act). Recorded in AC-5's authority comment on Q-0108's precedent.

## E-2 — a third transport was found at this gate, measured, and refused; it is recorded so it is not re-derived

The operator looked for a design in which the daemon holds **nothing**, and found one. It is refused,
and the measurement is written down because the idea is a natural one and the next reader will have
it.

**The bytes are already a file.** A review step's materialised diff is persisted verbatim inside its
own `prompt.txt` under `.quorum/runs/<run>/steps/<n>-<step>/`, and it is **delimited by a string
Quorum itself composes at exactly one site** — `packages/core/src/engine/diff.ts:408` writes
`## Diff to review`, `### git diff --stat <range>`, the stat, `## Patch (<range>)`, the bytes and the
truncation notice as one expression. Verified on `Q-0131-2/steps/002-review/prompt.txt`: 235,016
bytes, 19 `diff --git` headers, and **the range appears inside the delimiter twice** — which answers
the ticket body's *"nothing on the wire says which range this run's reviewer saw"* without inventing
a transport at all. `GET /history/:id` already reads run history, so the route would extend an
existing reader rather than add a kind of state, and *"Files are the database … no hidden state in
the daemon"* would be satisfied outright rather than argued around.

**It loses on one specific ground, and the ground is this repository's most-recorded failure.**
`materialiseDiff` holds `truncated`, `limit`, `bytes.length`, `full.length` and the `omitted` file
list as **structured values**, and *renders* them into a `## Truncation notice` section. Serving from
`prompt.txt` gets the patch text cleanly but would have to read those facts back **out of the
rendered notice** — inference where identity is available, which is exactly what *"A gate question
carries the decision that reached it"* (2026-09-17) refused one day ago for a different field.
§0.4's design captures them where they are produced, at one site, with no second measurement and no
extra git spawn. **The patch bytes are not the hard part; the truncation metadata is**, and that is
what decides between the two.

Two further costs, stated so the refusal is not thinner than it looks: it would make the gate screen
a second reader of run-history *path layout*, and it would couple a browser surface to `.quorum/runs`
— the kind of coupling Q-0127 E-1 deliberately kept off the backlog surface. **Not refused** on the
ground that it is slower or that the daemon route is easier.

**Non-goal 6 is unchanged and does not cover this**: it forbids *persisting a second copy*, and this
alternative persists nothing. It is refused here on its own terms.

## E-3 — GO-2 ratified: fourteen criteria, taken deliberately, with AC-9 named as the seam

Fourteen is inside this role's ceiling of fifteen and is accepted as-is rather than trimmed. **AC-9,
rendering fidelity, is the seam** — Q-0122 E-1's shape — and if the review loop exhausts, the remedy
named in advance is **a second erratum splitting at AC-9, not a further implement round**.
**AC-1 is not eligible for trimming** under any circumstance: §0.3 measured that **186 of 208
`## Patch (` prompts — 89% — are on the deferred path that never enters `ctx.diffInputs`**, so an
implementation reading the cache at the gate is correct on `review.yaml`, green in any test written
against it, and **blank on every chore run this product performs**. It is the only criterion whose
subject no existing guard reaches.

Both candidates' own cuts were refused by the document and the gate agrees: codex's 22 is far past
the ceiling, and claude's 14 delivers only a file-and-line summary, which leaves this ticket's
headline for a third ticket and splits one truncation fact across two transports — the drift the
ticket body warns about.

## E-4 — GO-3 discharged: the contract note is written by hand at this gate

`contracts/Q-0050/run-events.contract.md` gains its note. **`contracts/` is not among
`developer-generalist`'s fourteen roots** — it cost Q-0129 an implement round two days ago and
Q-0131 avoided it by doing exactly this — so it was never a criterion, and AC-13 correctly asks only
that the note exist.

**What it records is the counterpoint to decision 097 rather than a qualification of it**: the
evidence a reviewer was given deliberately does *not* travel on the union, while `reached` does, and
the reason is **size and replay rather than kind** — 200,000 B against a 214 B mean event and a
buffer replayed to every late subscriber, against `reached`'s measured 13 KB. Two halves of one
screen, opposite answers, both measured.

## E-5 — the run corrected the ticket body, and the operator's own re-measurement, in three places

Recorded because the body was re-measured by hand hours before the run and was still wrong.

**The gate is TWO steps after the review, not three.** `chore.yaml` is `implement` → `review` →
`integrate` → `gate`. The body's *"three steps after"* is off by one; the conclusion is unchanged and
slightly strengthened, since a step that materialises no diff still sits between the reviewer and the
gate.

**The dependency question is cheaper than either candidate or the operator assumed.** `apps/web`
already bundles React and Tailwind as devDependencies named in `04-architecture.md`, and
`JUSTIFICATIONS` (`apps/web/test/package.test.ts`) is checked in **both** directions — so a diff
renderer is a precedented devDependency decision the architect may take and it owes **no second
decision entry**. The operator's re-measurement got the *mechanism* right (a devDependency growing
the served bundle rather than an install edge) and the *weight* wrong.

**And it re-derived two of candidate-claude's figures and kept its own**, naming both: `--stat`
sections at 1,169 B mean / 4,937 B max against that candidate's 1,262 / 5,033, and 56 of 208 stat
sections carrying an elided path against 52. Neither difference moves a criterion, and the document
says so rather than quietly picking one.

## E-6 — GO-4, GO-5 and GO-6 are the operator's at the close, and GO-5 is not a formality

**GO-5** requires the diff region transcribed verbatim from a browser **including a truncated case**,
and — because R-2 means **no ticket in this backlog has a non-empty range**, re-measured at this gate
as **42 of 42** integration branches contained in `main` — `runs.log` must say **how the range was
built**. Q-0016's GO-6 was reported discharged when its by-hand half had not been performed; every
gate since has been written to be unfakeable for that reason.
