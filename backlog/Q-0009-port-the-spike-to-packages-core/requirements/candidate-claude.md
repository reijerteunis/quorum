# Q-0009 — Port the spike to `packages/core`

*Requirement candidate (claude), 2026-08-25. Parent ticket: owns the ground rules, the order and
the cutover. Ports nothing — the port is Q-0041 through Q-0054.*

## Problem

The runnable Quorum is `spike/`: 2,261 lines of plain Node ESM across seven modules, a 616-line
CLI, 3,142 lines of tests, three dependencies and a hand-rolled test runner. Q-0008 built the
workspace it moves into — `packages/{core,shared,cli,server,compiler,templates}` and `apps/web`
exist with strict TypeScript, Vitest, ESLint and a two-job CI, and every one of them holds an
`index.ts` and an `index.test.ts` and nothing else. M2 cannot close until `core` and `shared` are
real, and M3's daemon cannot start until the domain logic it needs is in a package it can import
rather than in a binary it would have to shell out to.

The port is already cut into fourteen tickets, and their folders exist. What does not exist is the
thing that makes fourteen independent tickets add up to one working package: a written answer to
which flow they take, whether they may change behaviour, and what happens to `spike/` at the end.
Left unwritten, each of the fourteen answers those questions for itself, and they will not answer
them the same way.

Three problems are specific to this ticket rather than to any module, and each has evidence in the
repository today.

**The port's source is not frozen, and four open tickets edit it.** The ticket body says no ticket
in this set may edit `spike/src/**`. Q-0037, Q-0038, Q-0039 and Q-0040 are not in this set and all
four change engine behaviour — a deferred-range diagnostic, a lock on a ticket, a gate that can say
"undecided". A fix that lands in `spike/src/engine.js` after Q-0050 has ported the run loop is
silently absent from `core`, and nothing in the repository would notice: the spike's suite stays
green because the spike still has the fix, and the workspace suite stays green because it was
ported from a tree that did not.

**No role may write `packages/**`.** `harness/architecture.md:27–28` is the repository's current
fan-out write contract, and it reads `backend → spike/src/, harness/, docs/, backlog/` and
`tooling → spike/bin/, spike/test/`. `chore.yaml`'s `implement` step reads that file. Every child
implementer would therefore be handed a write contract that forbids the only directory it was sent
to fill, and grants the one directory the port must not touch. This is a ten-line edit and it
blocks all fourteen.

**The public API is design work, not transliteration.** `04-architecture.md:37` specifies
`runFlow(opts): AsyncIterable<Event>`. `spike/src/engine.js:37` takes a `ui` object and prints —
33 call sites. One of those, `ui.gate`, does not print: it *asks*, and waits for `advance`,
`retry` or `abort`. An `AsyncIterable` carries values one way. Nothing in the documented API says
how an answer gets back in, and Q-0052 (gate steps) and M3's WebSocket both consume whatever
Q-0050 decides. That hole is at the centre of the port and it is open.

## User stories

**Maintainer.** As the solo maintainer, I want the port's ground rules written down once and cited
by all fourteen children, so that fourteen runs across several evenings produce one coherent
`core` rather than fourteen locally-reasonable ports that disagree at the seams — and so that when
a child's reviewer asks "was this behaviour change authorised?", there is a document that answers
instead of a judgement call at $7 a round.

**Adapter contributor.** As a contributor adding a vendor adapter, I want the contract layer to
arrive in `packages/core` with the refusals and the error translation intact — `check()` refusing
before it probes the CLI when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set,
`authError()` at the contract layer where every adapter inherits it — so that copying `codex` into
`gemini` still gives me those for free after the port, as `03-adapter-contract.md` promises.

**Cold-clone adopter.** As a stranger cloning the repository, I want one binary and one suite, so
that the first thing the README tells me to run is `quorum` and there is no second, differently-named
programme in a `spike/` directory whose relationship to the product I have to work out. Today
`CLAUDE.md` tells a reader to run `node spike/bin/harness.js`; after the cutover it must not.

## Scope

Q-0009 owns exactly three things and produces no source code in `packages/**`:

1. **The charter** — the ground rules, the invariant register, the freeze point and the per-child
   operating checklist, committed to the ticket folder and reachable by the children's agents.
2. **The two decisions the port cannot start without** — which flow the children take, and whether
   the port may change behaviour — as `docs/DECISIONS.md` entries, because both outlive this ticket.
3. **The cutover** — deleting `spike/`, repointing CI and `harness.yaml`, and fixing every document
   that tells a reader to run the old binary — after Q-0010 and Q-0054 are contained in `main`.

Everything else belongs to a child. Where this document names an invariant, it names it so a child
can inherit it; it does not specify any module's port.

## Acceptance criteria

Each is independently testable and names its surface. AC-1 to AC-5 must be met before Q-0041 runs;
AC-6 to AC-9 hold while the port is in flight; AC-10 to AC-12 are the cutover.

### Before the first child runs

**AC-1 — The routing is decided once, for all fourteen.** *(Surface: `docs/`.)* A dated
`docs/DECISIONS.md` entry with Decision / Alternatives considered / Why states which flow every
child of Q-0009 takes, and says in as many words that the choice applies to all fourteen. Its
reasoning addresses the shape neither existing route was designed for: the chore flow exists
because a scaffold has no behaviour a test could fail on, which is false here — a ported module has
behaviour and 3,142 lines describing it — while the full SDLC's `qa-red` has nothing to write,
because the failing suite already exists in `spike/test/`. *Test:* the entry exists in the required
shape; each of the fourteen child tickets cites it by title; a reviewer can name the flow for any
child without asking a human.

**AC-2 — Behaviour preservation is a written policy with a register behind it.** *(Surface:
`docs/`, `backlog/`.)* A `docs/DECISIONS.md` entry states the default — the port preserves
behaviour, and the ported tests are the proof — names the single authorised exception (`runFlow`
becoming an event stream, owned by Q-0050), and defines the route for anything else: a deliberate
behaviour change stops the child ticket and gets its own DECISIONS entry or a dated erratum
*before* it is implemented, never a silent improvement discovered in review. The invariant register
below is committed with the charter, and each of the fourteen child tickets carries an "invariants
that must survive this port" list drawn from it. *Test:* the entry exists; the register exists with
every row citing a DECISIONS entry by title and date; every child ticket body carries a non-empty
invariant list.

**AC-3 — The schema location is settled, and the two documents that disagree are made to agree.**
*(Surface: `docs/`.)* `docs/04-architecture.md:19` gives `shared` *"types, schemas (zod),
event/trace format, constants"*; `docs/06-development-plan.md`'s Q-0009 line reads as though `core`
carries them. One of them is edited in the same change so that a reader cannot reach two answers,
and Q-0041's ticket cites the settled one. *Test:* grep both documents for the schema location; no
contradiction survives; Q-0041's body names the package.

**AC-4 — The fan-out write contract admits the port and closes the spike.** *(Surface: `harness/`.)*
`harness/architecture.md`'s role table and its allowed-path prose grant the roles the port uses
write access to `packages/**` (and `apps/**` where a child needs it), and mark `spike/src/**` as
frozen for the port's duration. The frontmatter `paths` and the prose agree, as that file requires
of itself. *Test:* the table lists `packages/`; a chore `implement` step run on any child is not
handed a write contract that excludes its target directory; the prose names the freeze.

**AC-5 — The freeze point is a recorded SHA, not an intention.** *(Surface: `backlog/`.)* The
charter names the commit on `main` at which `spike/src/**` is frozen, and lists the tickets that
must land in the spike before that commit or be re-targeted at `core` — Q-0037, Q-0038, Q-0039 and
Q-0040 are the four known today. *Test:* the SHA is in the charter and `git cat-file -e <sha>`
succeeds; each of the four named tickets records which side of the freeze it lands on.

### While the port is in flight

**AC-6 — The freeze is enforced by CI, not by convention.** *(Surface: repository CI.)* Given a
branch whose diff against `main` modifies or deletes any file under `spike/src/`, the workspace CI
job fails with a message naming the freeze and pointing at the charter. Given the same branch
carrying the exemption marker the charter specifies, CI passes. *Test:* both directions, on a
scratch branch. *(Rationale: the engineering rules put safety in code rather than convention, and
"no ticket may edit `spike/src`" is the one rule in this set that fourteen separate agent runs
have both the means and the motive to break.)*

**AC-7 — Both suites stay green and both stay wired, until the cutover commit.** *(Surface:
repository CI, `harness/`.)* `.github/workflows/ci.yml` keeps its `spike (regression suite)` job,
and `harness/harness.yaml`'s `commands.install` and `commands.test` keep installing both dependency
sets and running both suites chained, so that every child's `integrate` step proves the spike and
the workspace together. *Test:* CI shows two jobs on every push during the port; a child's
`dev/integration.md` shows both suites ran; a change that leaves only one is rejected before the
cutover.

**AC-8 — Each child run has an operating checklist, and it is used.** *(Surface: `backlog/`, CLI.)*
The charter carries the pre-run checklist for a child ticket, covering the three known hazards in
the machinery the port runs on: create `harness/<id>/integration` before the first run, because
`review` diffs against a branch only `integrate` creates and `integrate` runs later; pass no more
`--gate-answer` values than would be authorised blind, because they are consumed in order by
whichever gate arrives first and an engine-presented exhaustion gate is a gate; and treat
`budget.per_run_usd` as descriptive, because it is 10 and a single step has spent $13.86 past it
uninterrupted. *Test:* the checklist is in the charter; across the first three children, no run in
`runs.log` fails for a missing integration branch.

**AC-9 — The estimate is replaced by a measurement, and the decision to continue is explicit.**
*(Surface: `backlog/`.)* After the first three children reach `reviewed`, Q-0009 records from their
`runs.log` the billed Claude cost, the Codex tokens and the wall clock per child — per-vendor, never
blended, an unpriced step shown as `n/a` beside its token count — compares them with the
$350–550 estimate in the ticket body, and states in writing whether the remaining eleven proceed as
cut, are re-cut, or are re-routed. *Test:* the record exists with three measured children and one
stated decision.

### The cutover

**AC-10 — The preconditions are checkable, and each is one command.** *(Surface: CLI, repository.)*
The cutover commit is not made until all four hold: every one of the fourteen children and Q-0010
is at stage `reviewed` or later **and** `harness board` reports it `main:contained`;
`git diff <freeze-sha>..main -- spike/src` is empty; `pnpm lint && pnpm typecheck && pnpm test`
passes on `main`; and the spike's own suite passes on `main`. *Test:* run the four; all pass, and
the ticket folder records their output.

**AC-11 — The new binary is proved before the old one is deleted, and it costs nothing to prove.**
*(Surface: CLI.)* From a clean clone of the cutover branch, with `spike/` already removed:
`quorum lint` validates all six flow files in `harness/flows/`; `quorum board` renders every ticket
with its stage and its containment token; `quorum run <flow> <ticket> --dry` completes and reports
what it *skipped* as skipped rather than as passed; and one non-dry run on the mock adapter
completes end to end. The commands and their output are committed to the ticket folder. No
subscription-authed adapter is required, so this criterion is repeatable by anyone. *Test:* the four
commands, from a fresh clone.

**AC-12 — One revertable commit does the cutover, documents included.** *(Surface: repository,
`harness/`, `docs/`.)* A single commit deletes `spike/`, removes CI's `spike` job, switches
`harness/harness.yaml`'s `commands.install` and `commands.test` to the workspace alone, and updates
every document that tells a reader to run the spike — at minimum `CLAUDE.md` ("Until M2 lands, the
runnable code is the spike in `spike/`" and its Commands section), `harness/architecture.md`,
`docs/04-architecture.md`'s status line, `docs/06-development-plan.md`'s M2 section and
`docs/GLOSSARY.md` where it names the spike. *Test:* `git revert <sha>` applies cleanly; a search
for `spike` outside `docs/DECISIONS.md` and existing `backlog/` folders returns nothing
instructional; a reader following `CLAUDE.md` from that commit runs `quorum` and succeeds.

## The invariant register

Referenced by AC-2. These are behaviours that were paid for in real money and would be cheap to
lose in a rewrite, because in each case the obvious implementation is the wrong one. The register
is Q-0009's artifact; the child ticket named in each row inherits the row.

| # | Invariant | Child | Source decision |
| --- | --- | --- | --- |
| 1 | `check()` refuses on `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `CODEX_API_KEY` **before** probing the CLI, so a missing binary cannot mask a key; only `adapters --probe` proves a login | Q-0046 | *check() proves presence; only `adapters --probe` proves login* (2026-08-22) |
| 2 | `codex` always passes `--ignore-user-config`; `-m` only when a flow names a model; a role's default model never crosses vendors | Q-0047 | *Flows never pin a vendor model name* (2026-08-22) |
| 3 | Claude cost is money, Codex is tokens with cost `null`; no rate table; `null` renders `n/a`, never `$0.000`; a roll-up states how many steps were unpriced | Q-0049 | *Codex cost is reported as tokens, never priced locally* (2026-08-22) |
| 4 | A failed step's cost is in the roll-up; both vendors report failures on **stdout**, not stderr; Claude's `usage.input_tokens` excludes cache traffic | Q-0047, Q-0049 | *M0 closed* (2026-08-22) |
| 5 | `retry` at an exhaustion gate sets **that** loop's counter to `max_iterations` — exactly one more traversal — touches no other counter, and is recorded in `runs.log` | Q-0050 | *`retry` authorises exactly one more traversal* (2026-08-22) |
| 6 | Every terminal outcome — completed, regressed, failed, interrupted — writes to `runs.log` with counters persisted; an interrupt does not refund a budget | Q-0050 | *Red for the right reason is an engine property* (2026-08-22) |
| 7 | `integrate` installs dependencies in the worktree first, syncs the base branch first, rejects a suite that could not start rather than counting it red, and ignores an environment signature on a line that reports a result | Q-0053 | same |
| 8 | Ancestry is read through one primitive, three-valued: exit 0 contained, exit 1 not contained, anything else indeterminate; in a shallow repository exit 1 becomes indeterminate; the shallow probe is itself three-valued | Q-0042 | *Containment is derived from git on each board invocation* (2026-08-24); *The erratum is closed* (2026-08-25) |
| 9 | Containment is computed on every `board` invocation and stored nowhere; no `ticket.md` byte changes | Q-0043 | *Containment is derived from git…* (2026-08-24) |
| 10 | An empty diff range reports evidence — both endpoints, the short SHA each resolved to, the check run verbatim, and its outcome as contained / not contained / indeterminate — never a story about how the code arrived, and carries at most one remedy the range guard would accept | Q-0051 | *The erratum is closed* (2026-08-25) |
| 11 | A preflight that declines to examine something reports it as **skipped**; `--dry` mutates nothing and is the same machinery, not a second path | Q-0051 | *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) |
| 12 | The diff range guard admits only the configured base or a branch under `harness/<ticket-id>/`; the lint reads every `input.diff` a flow can hold, **including inside a `fan_out` step template**, which `flattenSteps` does not visit | Q-0044, Q-0051 | *The erratum is closed* (2026-08-25) |
| 13 | Three validations stay distinct: `checkAgainstSchema` strict against Quorum's own generated schema, ajv fully strict against solutioning's contracts, and vendor-wrapping tolerance confined to `extractJson` | Q-0045, Q-0046 | *Step-output validation is Quorum's contract with its own agents* (2026-08-22) |
| 14 | `x-quorum-contract: run-manifest-v1` selects the semantic pass; a missing or unknown annotation reports that semantic checks were **skipped**, never that they passed | Q-0045 | *Product-level schema annotations select semantic validation* (2026-08-23) |
| 15 | The run manifest is atomically replaced; gates and fan-out parents allocate no occurrence; adapter occurrences retain exact `prompt.txt` and `output.txt`; a `running` manifest is reported, not repaired; the reader's traversal guard resolves `realpath` rather than testing strings | Q-0049 | *Q-0034 closed* (2026-08-24) |
| 16 | `goto: flow:<target>` derives the regression stage from the target flow's `consumes`; whole-directory lint proves the return chain exists | Q-0044, Q-0050 | *Cross-flow regression uses a derived regression target* (2026-08-23) |
| 17 | An exhaustion gate cannot be bypassed by `--auto`; answers are full words consumed in order; a missing, empty, invalid or disallowed answer fails rather than inventing a decision; `human-locked` cannot be flipped | Q-0050, Q-0052 | *Non-auto exhaustion gates require an explicit human or scripted answer* (2026-08-23) |
| 18 | `cross_vendor: required` is satisfied by a panel spanning vendors, not by writer ≠ reviewer | Q-0044 | *Cross-vendor rule refined* (2026-08-21) |
| 19 | A flow never writes to the user's working tree; worktrees live under `.harness/worktrees/`, run history under `.quorum/`; `finish()` rolls the ticket branch back on failure | Q-0042, Q-0048, Q-0050 | *Git worktrees are the execution model* (2026-08-06); *Branch layout* (2026-08-21) |
| 20 | `finish()` does **not** roll back task branches. This is a known gap carried into M2, and the port preserves it rather than fixing it in passing — a fix is its own ticket under AC-2 | Q-0050 | *M1 closed* (2026-08-24) |

Row 20 is the shape to watch generally: a port is a tempting place to fix a known defect quietly,
and a quiet fix breaks the only proof the port has, which is that the ported tests still describe
the ported code.

## Non-goals

- **Porting any module.** Q-0009 writes no TypeScript in `packages/**`. If it does, the cut into
  fourteen has failed and that is worth stopping for.
- **Designing the event stream.** Q-0050 owns `runFlow(opts): AsyncIterable<Event>` and the gate
  question inside it. Q-0009 records that it is the one authorised behaviour change and blocks on
  its shape (OQ-2), it does not decide it.
- **Fixing the four hazards.** Q-0038, Q-0039 and Q-0040 exist; the chore flow's first-pass branch
  problem has no ticket yet. Q-0009 works around all four with a checklist (AC-8) and states its
  scheduling recommendation under Risks; it fixes none of them.
- **Changing `spike/`.** Not to ease a port, not to fix a bug found while reading it, not to delete
  it before AC-10 and AC-11.
- **The `quorum` binary.** Q-0010. Q-0009 depends on it for the cutover and does not build it.
- **Persisting the event stream.** `04-architecture.md` says there is no persisted event stream in
  this version and incomplete manifests are reported rather than repaired; the port does not change
  that, however tempting once events exist.
- **Anything on the v1 exclusion list** — multi-user, remote daemon, cloud sync, plugin
  marketplace, visual node canvas, eval suites, Gemini adapter, desktop shell — and, specifically,
  no new `core` API that exists only because M3 might want it.

## Open questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Which flow do the fourteen take? The chore flow's rationale does not apply (a ported module has behaviour), and the full SDLC's `qa-red` has nothing to write (the failing suite exists in `spike/test/`). A third possibility is worth naming: the full SDLC with `qa-red` reduced to *porting* the existing suite as its red artifact, which is exactly what Q-0054 is. | Ruud + head-of-product | **Blocker** — routes all fourteen; nothing starts without it (AC-1). |
| OQ-2 | How does a gate answer reach an `AsyncIterable`? `ui.gate` asks and awaits; an async iterable yields. The plausible shapes — a bidirectional generator taking answers via `next(answer)`, a callback passed in `opts` beside the stream, or an out-of-band `answerGate(runId, answer)` — differ in what M3's WebSocket and Q-0052 can do, and one of them is much harder to resume after a daemon restart. | Q-0050 + principal architect | **Blocker for Q-0050**, not for Q-0041–Q-0048. It also interacts with Q-0040: an event stream is the natural place for a gate to say "undecided" rather than "failed". |
| OQ-3 | `shared` or `core` for the zod schemas? `04-architecture.md` says `shared`; the plan's Q-0009 line reads otherwise. Q-0041 assumes `shared`. | Ruud | **Blocker for Q-0041** (AC-3). Cheap to settle, expensive to discover at Q-0050. |
| OQ-4 | `zod` is a new dependency and needs its one-line justification; the port also carries `yaml`, `ajv` and `ajv-formats` across. Does `shared` take `zod` alone, or does `core` re-export? | Q-0041 | Not blocking; record the justification where the rules require it. |
| OQ-5 | `spike/test/**` holds frozen qa-red fixtures — Q-0037 records a `runGate` timer that cannot be removed without editing one. Does porting a frozen fixture to Vitest count as editing it, and if the port changes an assertion's shape, what authorises that? | Q-0054 + Ruud | Not blocking now; **blocking for Q-0054**, and it is the ticket most likely to discover it late. |
| OQ-6 | Does the `harness` binary name survive as an alias through the transition, or is `quorum` the only name from Q-0010 onward? Nothing in a flow file invokes it; `harness/harness.yaml`'s `commands` and the documents do. | Q-0010 | Not blocking; decide before AC-12 writes the documents. |
| OQ-7 | The chore flow's missing first-pass integration branch has no ticket, only a note in Q-0038's body. Fourteen runs is where it stops being a footnote. Ticket it, or leave it to AC-8's checklist? | Ruud | Not blocking; AC-8 covers the port either way. |
| OQ-8 | After AC-9's measurement, what threshold triggers a re-cut rather than continuing? Stating it before the number arrives is cheaper than arguing about it afterwards. | Ruud | Not blocking. |

None of these changes a file format or the adapter contract, so by `harness/product-context.md`'s
rule none is a blocker for the requirement as a whole — but OQ-1 and OQ-3 block the first child, and
OQ-2 blocks the fifth-largest risk in the milestone.

## Risks

**The source moves under the port.** Highest-likelihood risk, and it is not in the ticket body.
Four open tickets edit `spike/src/**`, the port runs over several evenings, and a fix landed after
its module was ported is invisible: both suites stay green, because each is testing the tree it was
written against. AC-5 and AC-6 are the mitigation — a named freeze SHA and a CI guard — and AC-10
verifies it with `git diff <freeze-sha>..main -- spike/src` being empty at the cutover. The
scheduling consequence is that Q-0037–Q-0040 either land before the freeze or are re-targeted at
`core`, which makes them ports-plus-features and larger than they look.

**Fourteen runs on machinery with four known defects.** Each hazard has already cost real money at
n=1; the port makes n=14. The most expensive is the unanswerable gate: a non-interactive run that
reaches one fails, and `finish()` then rolls back a merge it had just proven green — it has cost
Q-0035 and Q-0036 their merge on consecutive nights, forty seconds after the suite went green in
one case. **Recommendation: land Q-0040 before queueing fourteen chore runs.** It is listed in M2
already, it is the only one of the four that destroys completed work rather than merely wasting a
run, and paying for it once is cheaper than working around it fourteen times.

**The engine chain stalls on OQ-2.** Q-0049 through Q-0053 are strictly ordered and all five wait
on the event-stream shape. If OQ-2 is unresolved when Q-0050 starts, the cost is not one ticket but
five, plus whatever Q-0052 and M3 build against a shape that then changes. Mitigation: settle OQ-2
as a written design before Q-0050's requirements run, and run Q-0041 through Q-0048 — which are
independent of each other beyond `shared` — while it is being settled.

**The port is judged by tests that were ported by the same process.** Q-0054 is the only ticket that
can prove any of the others, and it is last. A subtle mis-port and a correspondingly mis-ported
test agree with each other. Partial mitigation: AC-7 keeps both suites running throughout, so the
spike's untouched suite remains an independent witness until the cutover — which is a second reason
the freeze matters, since a witness that has been edited is not one.

**Fourteen tickets is fourteen contexts.** The sizing decision is right and this is its cost:
fourteen agents each read the charter, the invariant register and their own ticket, and any drift
between the charter and a child's ticket body is drift between fourteen implementations. Mitigation:
the charter is the single source and children cite it rather than restating it (AC-1, AC-2).

**Cost.** $350–550 estimated across the children, from measured chore tickets at $26.81 and $36.66.
The estimate could be low: those two were single-module changes to a spike, while a port carries
review of a whole module's behaviour. AC-9 forces the number to be checked after three rather than
after fourteen.

## Cross-cutting checklist

- **BYOS.** No new code path touches a key. Register row 1 makes the refusal — and its ordering
  before the CLI probe — an explicit invariant of Q-0046, because a rewrite that probes first and
  refuses second passes every test that checks only the refusal. No fixture, no test and no example
  in the ported packages may name a key except as a variable the code refuses on.
- **Worktree safety.** Register row 19. Nothing in this ticket runs a flow that writes to the
  working tree; the cutover commit is made by hand on a branch, as every merge in this repository is.
- **Gate behaviour.** Register row 17. AC-8's checklist governs how many `--gate-answer` values a
  child run may carry; AC-11's proof includes a `--dry` run, which reaches no gate, and one mock
  run, which does.
- **File formats and their schemas.** The port changes none. `ticket.md` frontmatter, `runs.log`
  lines, flow YAML, role files and `.quorum/runs/<id>/manifest.json` are byte-compatible across the
  cutover — `contracts/Q-0011/run-manifest.schema.json` is frozen, and the port is not a ticket that
  opens it legitimately. Testable at the cutover: a manifest written by the spike validates under
  `quorum validate` afterwards.
- **Lint rules.** Register rows 12, 16 and 18. `quorum lint` must accept all six shipped flow files
  and reject the same things `harness lint` rejects; AC-11 runs it on the real `harness/flows/`.
- **Cold-clone impact.** Net positive, and it is the point: one binary instead of two, one suite
  instead of two, and `CLAUDE.md` no longer instructing a newcomer to run a directory called
  `spike`. Until the cutover the impact is zero, because a newcomer sees exactly what they see today.
- **Product-agnostic.** No change; nothing in the port names a SaaS product.
- **Errors are explicit.** Register rows 10, 11, 13 and 14 are all instances of it, and three of the
  four were bought with money. The port's single most likely regression is a `catch {}` that turns
  an unanswerable question into a confident answer — which is the defect Q-0035 was created to fix,
  in the same file Q-0051 is about to port.
