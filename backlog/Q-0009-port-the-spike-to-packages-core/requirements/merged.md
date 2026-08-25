# Q-0009 — The port charter

*Merged requirement, head-of-product, 2026-08-25. **Iteration 2. Verdict: ready.** Candidates:
`candidate-claude.md`, `candidate-codex.md`, both unchanged from iteration 1 — the requirements
flow's backward edge returns to `head-of-product`, not to the product managers, so this pass
re-judges the same two documents plus my own previous verdict.*

---

## What changed since iteration 1, and why this is now `ready`

Iteration 1 returned `needs-input` on four blockers. Re-tested against the repository, three of
them do not survive and the fourth is mine to fix rather than to ask about.

**1. The ticket was too wide in time. That still holds, and the remedy is applied here rather than
requested.** AC-1 to AC-9 of both candidates must be true *before* Q-0041 runs; their cutover
criteria cannot be true until *after* Q-0010 and Q-0054 land, which is the end of M2. No gate can
ever see all twelve true, so the ticket would either sit at `requirements` for a whole milestone or
pass on criteria nobody examined — the failure named on 2026-08-25 as *"a check that skips its
subject must not report success"*. My own role instruction says that when a requirement is too big
I name the seam and describe the tickets it should become; iteration 1 named the seam and then
asked permission to use it, which is a round spent to arrive at the same human gate this flow
already ends with. **This document is therefore written at the cut.** Q-0009 is the charter, twelve
criteria, every one verifiable on the day it lands. The cutover is carried below in full as
`CO-1`–`CO-4` for a follow-up ticket — proposed id **Q-0055**, the next free one. Nothing is
trimmed; it is relocated, and the owner accepts or rejects the cut at this flow's gate.

**2. Treating the routing question as a blocker was circular.** AC-1 charters this ticket to *make*
that decision. Requiring the decision before the ticket that produces it can be specified is a loop
with no exit. What I actually needed to check was whether any criterion's *design* changes with the
answer, and it does not: the charter is a document plus a guard, its shape is identical under either
route, and the operating checklist covers the hazards of both because Q-0050 may be routed
differently from the other thirteen in any case. Downgraded to **OQ-1**, with a recommendation
stated and the human gate as the place it is confirmed — the same technique iteration 1 already used
for the schema-location question.

**3. The missing ticket folders blocked the cutover, and the cutover has moved.** `backlog/` has no
folder for **Q-0010**, **Q-0012**, **Q-0039** or **Q-0040**. Only Q-0010 was load-bearing, and only
for `CO-1` and `CO-2`. The freeze criterion was already restructured as policy-now / SHA-later, and
is sharpened further below.

**4. The gate-answer channel was never this ticket's blocker.** Iteration 1 said so in as many
words ("blocker for Q-0050, not for the charter"). With the charter's scope it is out of Q-0009
entirely; the charter's only duty is to name its owner and its deadline. **OQ-2.**

### A correction to iteration 1's own evidence

Iteration 1 reported that *"no role may write `packages/core` or `packages/shared`"* and called it a
ten-line edit blocking all fourteen children. That overstated it. `harness/roles/developer-generalist.md`
— the role `chore.yaml`'s `implement` step actually runs — carries
`paths: [package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, spike, harness, docs]`.
On the recommended chore route, no child implementer is handed a contract forbidding its target
directory.

The gap is real but narrower, and it points somewhere more useful. `harness/architecture.md`'s role
table is fed to that same implementer as context on every chore run, and it lists only
`backend → spike/src/, harness/, docs/, backlog/`, `tooling → spike/bin/, spike/test/`,
`frontend → apps/*, packages/ui, packages/i18n` and `data → packages/database`. So it grants no role
the two directories the port fills, names three directories that do not exist, and omits
`developer-generalist` altogether — an agent reads a table that contradicts its own role file.
On the full-SDLC route it *would* block, because `development.yaml` fans out to `developer-{role}`.
AC-4 stays, at its true size: a coherence fix, not a stop-the-world one.

Reading it also sharpened the freeze. `developer-generalist` may write `spike`, and so it should —
Q-0038 and Q-0040 are chore-shaped tickets whose whole subject is `spike/src`. The freeze is a
property of *these fourteen tickets*, not of any role, which is exactly why it belongs in CI keyed
on the child branch names (AC-6) rather than in a path list.

### Size

Twelve criteria. At the top of the ten-to-fifteen band and acceptable here only because each one is
a document or a configuration artifact whose verification is a single read or a single command, and
because they can all be true on the same day. Three of the twelve (AC-4, AC-6, AC-7) touch
configuration or CI; the other nine are prose the charter carries. That is a normal chore shape.

---

## Problem

The runnable Quorum is `spike/`: 2,261 lines of plain Node ESM across seven modules, a 616-line CLI
(`spike/bin/harness.js`), 3,142 lines of tests, **three** dependencies (`ajv`, `ajv-formats`,
`yaml` — the parent ticket body says two) and a hand-rolled discovering runner. Q-0008 built the
workspace it moves into: `packages/{core,shared,cli,server,compiler,templates}` and `apps/web` exist
with strict TypeScript, Vitest, ESLint and a two-job CI, and `packages/core/src` and
`packages/shared/src` each hold exactly `index.ts` and `index.test.ts`. M2 cannot close until those
two are real, and M3's daemon cannot start until the domain logic it needs lives in a package it can
import rather than in a binary it would have to shell out to.

The port is already cut into fourteen tickets and **all fourteen folders exist** with substantial
bodies. What does not exist is the thing that makes fourteen independent tickets add up to one
working package: a written answer to which flow they take, whether they may change behaviour, which
invariants they must not lose, in what order they land, and what the CLI is left holding. Left
unwritten, each of the fourteen answers those questions for itself, across several evenings, and
they will not answer them the same way.

Four problems belong to this ticket rather than to any module. Each was checked against the
repository on 2026-08-25.

**The port's source is not frozen, and four open tickets edit it.** Q-0037, Q-0038, Q-0039 and
Q-0040 are not in this set and all four change engine behaviour. A fix landing in
`spike/src/engine.js` after Q-0050 has ported the run loop is silently absent from `core`, and
nothing would notice: the spike's suite stays green because the spike still has the fix, and the
workspace suite stays green because it was ported from a tree that did not. Both suites green, the
product wrong. Nothing in any role's `paths` prevents it — `developer-generalist` may write `spike`,
and for Q-0038 and Q-0040 it must.

**The fan-out write contract has drifted from the role files it is supposed to describe.** As above:
`harness/architecture.md`'s table grants neither `packages/core` nor `packages/shared`, names
`packages/ui`, `packages/i18n` and `packages/database` (none of which exist), and does not mention
the one role that actually runs a chore. The engine reads none of this; it reaches an agent as
prose, which is precisely why the prose has to be right.

**The public API is design work, not transliteration.** `docs/04-architecture.md:37` specifies
`runFlow(opts): AsyncIterable<Event>`. `spike/src/engine.js:37` takes a `ui` object and prints,
across 33 `ui.` call sites. One of them — `ctx.ui.gate` at `engine.js:574` — does not print; it
*asks*, and `await`s `advance`, `retry` or `abort`. An `AsyncIterable` carries values one way, and
nothing in the documented API says how an answer gets back in. `04-architecture.md:28` already fixes
the six event kinds (`spawn`, `tool`, `text`, `verdict`, `usage`, `done`) and `:68–69` already says
there is no persisted event stream in this version, so the open part is narrower than either
candidate assumed — but it sits at the centre of the port and five tickets serialise behind it.

**Two documents disagree about where the schemas live, and one disagrees with itself.**
`docs/04-architecture.md:19` gives `shared` *"types, schemas (zod), event/trace format, constants"*.
`docs/06-development-plan.md:79` has `packages/core` porting *"engine/backlog/fanout/git/adapters
with zod schemas for flow, ticket, role, step output"*, while `:91` gives `packages/shared` the
*"zod schemas, the trace/event format, constants"*. Wrong once at the bottom of the dependency
graph is cheap; discovered at Q-0050 it is not.

---

## User stories

**`maintainer`.** As the solo maintainer, I want the port's ground rules written once and cited by
all fourteen children, so that fourteen runs across several evenings produce one coherent `core`
rather than fourteen locally-reasonable ports that disagree at the seams — and so that when a
child's reviewer asks "was this behaviour change authorised?", a document answers instead of a
judgement call at $7 a round.

**`contributor`.** As a contributor adding a vendor adapter, I want the contract layer to arrive in
`packages/core` with its refusals and its error translation intact — `check()` refusing when
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set and refusing *before* it probes the
CLI, `authError()` at the contract layer where every adapter inherits it, and one vendor-neutral
event format with the vendor mapping confined to my adapter — so that copying `codex` into `gemini`
still gives me those for free, as `docs/03-adapter-contract.md` promises.

**`adopter`.** As a stranger cloning the repository, I want one binary and one suite, so that the
first thing the README tells me to run is `quorum` and there is no second, differently-named
programme in a `spike/` directory whose relationship to the product I have to work out. Today
`CLAUDE.md` tells me to run `node spike/bin/harness.js`. That is the follow-up ticket's job; what
this ticket owes me is that the port adds no step to the first thirty minutes before then.

---

## Scope

Q-0009 produces **no source code in `packages/**`** and owns exactly four things:

1. **The charter** — the ground rules, the invariant register, the freeze policy, the per-child
   operating checklist, the dependency order, the cost checkpoint and the end-state boundary,
   committed to `backlog/Q-0009-port-the-spike-to-packages-core/` where a child's agent can read it.
2. **The two decisions the port cannot start without** — the routing and the behaviour-preservation
   policy — as `docs/DECISIONS.md` entries, because both outlive this ticket.
3. **The harness and CI changes that make fourteen child runs safe** — the write-contract
   reconciliation and the freeze guard.
4. **Reconciling the ticket set with the charter** — the fourteen child bodies, and this ticket's
   own body, which currently claims the cutover.

**Surfaces:** `harness/`, `backlog/`, `docs/`, repository CI. Not the CLI, and not `packages/**`.

**The cutover leaves this ticket** — see *Carried over* below.

---

## Acceptance criteria

Twelve, each naming its surface and each verifiable on the day the charter lands.

**AC-1 — The routing is decided once, for all fourteen.** *(Surface: `docs/`.)* A dated
`docs/DECISIONS.md` entry with **Decision** / **Alternatives considered** / **Why** states which
flow each child of Q-0009 takes, and says in as many words which children it covers. Its reasoning
addresses the shape neither shipped route was designed for: the chore flow exists because *"a
scaffold has no behaviour a test could fail on before it exists"*, which is false here — a ported
module has behaviour and 3,142 lines describing it — while the full SDLC's `qa-red` has nothing to
write, because the failing suite already exists in `spike/test/`. If any child is routed differently
from the rest, the entry names it and says why. *Test:* the entry exists in the required shape; each
of the fourteen child ticket bodies cites it by title and date; a reviewer can name the flow for any
child without asking a human.

**AC-2 — Behaviour preservation is a written policy with a register behind it.** *(Surface:
`docs/`, `backlog/`.)* A `docs/DECISIONS.md` entry states the default — the port preserves
externally observable behaviour, and the ported tests are the proof — names the single authorised
exception (`runFlow` becoming an event stream, owned by Q-0050), and defines the route for anything
else: a deliberate behaviour change stops the child and gets its own DECISIONS entry or a dated
erratum *before* it is implemented, never a silent improvement discovered in review. The invariant
register below is committed with the charter. *Test:* the entry exists; the register exists with
every row citing a DECISIONS entry by title and date; a reviewer presented with an unregistered
behaviour change can point at the clause that forbids it.

**AC-3 — The schema location is settled, and the documents that disagree are made to agree.**
*(Surface: `docs/`.)* One of `docs/04-architecture.md:19`, `docs/06-development-plan.md:79` and
`docs/06-development-plan.md:91` is edited so that a reader cannot reach two answers, and the
allowed dependency direction between `core` and `shared` is stated explicitly, with no reverse or
circular dependency permitted. *Test:* grep both documents for the schema location; no contradiction
survives; Q-0041's body names the package; the dependency direction is one sentence a linter could
later enforce.

**AC-4 — The fan-out write contract admits the port, and says the same thing as the role files.**
*(Surface: `harness/`.)* `harness/architecture.md`'s role table and its allowed-path prose grant the
roles the port uses write access to `packages/core`, `packages/shared` and any other workspace
directory a child needs; the table accounts for `developer-generalist`, which the chore flow's
`implement` step runs and which the table does not currently mention; and rows naming directories
that do not exist (`packages/ui`, `packages/i18n`, `packages/database`) are reconciled rather than
left to mislead. Each role's `paths` frontmatter and its body prose agree, as `harness/architecture.md`
requires of itself. The prose names the freeze and points at the charter. *Test:* for every role the
port can invoke, the table, the role's `paths` and the role's prose name the same directories; no
child's target directory is missing from all three; the freeze is named.

**AC-5 — The freeze is a written policy now, and a SHA when one can be named.** *(Surface:
`backlog/`.)* The charter states the freeze rule, its exemption path, and the list of tickets that
must land in the spike before the freeze or be re-targeted at `core` — Q-0037, Q-0038, Q-0039 and
Q-0040 are the four known today, of which Q-0039 and Q-0040 have no folder yet. The charter is
explicit that the SHA is *not yet named*, and records it as soon as those four are settled. *Test:*
the policy, the exemption path and the four-ticket list are in the charter, and the charter says
plainly that the SHA is outstanding; once recorded, `git cat-file -e <sha>` succeeds and each of the
four records which side of the freeze it landed on.

**AC-6 — The freeze is enforced by CI, keyed on the port's own branches, and it never reports a
green tick for a check it did not run.** *(Surface: repository CI.)* Given a branch named
`harness/<id>/*` where `<id>` is one of the fourteen children, whose diff against `main` modifies or
deletes any file under `spike/src/`, CI fails with a message naming the freeze and pointing at the
charter. Given a branch for any other ticket, the guard does not fire — Q-0038 and Q-0040 change
`spike/src` legitimately, and `developer-generalist`'s `paths` include `spike` for exactly that
reason. Given a child branch carrying the exemption marker AC-5 specifies, CI passes and says which
exemption it honoured. **Before the freeze SHA exists the guard reports that it is inert, rather
than printing a pass** — the 2026-08-25 rule applied to the guard itself. *Test:* all four
directions, on scratch branches. *(Rationale: the engineering rules put safety in code rather than
convention, and "no ticket in this set may edit `spike/src`" is the one rule here that fourteen
separate agent runs have both the means and the motive to break.)*

**AC-7 — Both suites stay green and both stay wired, until the cutover commit.** *(Surface:
repository CI, `harness/`.)* `.github/workflows/ci.yml` keeps its `spike (regression suite)` job
required beside `workspace (lint, typecheck, test)`, and `harness/harness.yaml`'s `commands.install`
and `commands.test` keep installing both dependency sets and running both suites chained — which
they do today — so that every child's `integrate` step proves the spike and the workspace together.
A failure of the spike job blocks the affected child from landing. *Test:* CI shows two jobs on
every push during the port; a child's `dev/integration.md` shows both suites ran; a change that
leaves only one is rejected before the cutover.

**AC-8 — The ticket set says the same thing as the charter.** *(Surface: `backlog/`.)* Each of
Q-0041 through Q-0054 names, in its body: the spike source it ports; the CLI-held domain logic it
lifts out of `spike/bin/harness.js`, where it has any; its dependencies and the tickets that depend
on it; a non-empty list of invariants drawn from the register; and explicit non-goals. No child
assigns module-porting work back to Q-0009. Q-0009's own body is reconciled with this requirement,
so it no longer claims the cutover. *Test:* all fourteen bodies carry all five items and every
register row appears in at least one child; the parent body names the follow-up ticket. *(Sizing
note: all fourteen bodies already exist and every one cites the parent and at least one dated
DECISIONS entry. An audit on 2026-08-25 found explicit non-goals in five of fourteen and a declared
dependency in six of fourteen, so this is a bounded gap-fill pass, not fourteen new documents.)*

**AC-9 — Each child run has an operating checklist, and it is used.** *(Surface: `backlog/`,
`runs.log`.)* The charter carries the pre-run checklist covering the four known hazards in the
machinery the port runs on: create `harness/<id>/integration` before the first run, because `review`
diffs against `harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs
later, creates the left endpoint; pass no more `--gate-answer` values than would be authorised
blind, because they are consumed in order by whichever gate arrives first and an engine-presented
exhaustion gate is a gate; treat `budget.per_run_usd` as descriptive, because it is 10 and a single
step has spent $13.86 past it uninterrupted; and run at most one run per ticket at a time, because
nothing enforces it. The checklist marks which items are route-conditional, so it stays correct
whichever way AC-1 goes. *Test:* the checklist is in the charter; across the first three children,
no run in `runs.log` fails for a missing integration branch or an overlapping run.

**AC-10 — The dependency and landing order is a gate a reviewer can check.** *(Surface:
`backlog/`.)* The charter records the order as a checkable rule: Q-0041 lands before any child that
imports `packages/shared`; Q-0042 through Q-0048 may land in any order once their declared
dependencies are green; Q-0049, Q-0050, Q-0051, Q-0052 and Q-0053 land in that order, each
consuming the run context the one before it defines; Q-0054 lands last and cannot land until every
module port it exercises has landed. The rule states how Q-0054 relates to **Q-0010**, which has no
ticket folder: most of the spike suite drives `bin/harness.js` and imports no source module, so the
acceptance evidence for a `core` port runs through `packages/cli`, and the charter picks one of the
three routes Q-0054's body already names rather than leaving it to be discovered. *Test:* given any
two child tickets, a reviewer can say which must land first and cite the rule; a child whose
dependency is not green is rejected before its first run; the Q-0054/Q-0010 relationship is stated.

**AC-11 — The cost checkpoint is defined before the number arrives.** *(Surface: `backlog/`.)* The
charter names the checkpoint — after the first three children reach `reviewed` — its inputs, and the
threshold above which the remaining eleven are re-cut or re-routed rather than continued. Its format
is per-vendor and never blended: billed Claude cost as money, Codex as tokens with cost `null`
rendered `n/a` beside its token count, wall clock per child, and a count of unpriced steps. *Test:*
the checkpoint, its threshold and its format are in the charter before Q-0041 runs; when it is
performed, the record carries three measured children, a comparison with the $350–550 estimate, and
one stated decision.

**AC-12 — The end-state boundary is written down, so children and Q-0010 can be judged against it.**
*(Surface: `backlog/`, `docs/`.)* The charter states what must be exported from `core` or `shared`
rather than implemented in the CLI — project loading, ticket and frontmatter handling, flow linting,
contract validation, adapter control, fan-out, run history and engine behaviour — naming the
CLI-held code the port lifts: `loadProject` (`spike/bin/harness.js:54`), the run-history reader
(`manifestShapeError`:142, `readRunsDir`:151, `sortRuns`:171, `occurrenceSeq`:184 and the `realpath`
traversal guard), the `run-manifest-v1` semantic pass and its roll-up recomputation,
`lintDirectory`:374 and `overrideAdapters`:612. It states the CLI's residual scope: argument
handling, invocation of core, event rendering and process exit behaviour. *Test:* the boundary is in
the charter; each named piece of CLI-held logic appears in exactly one child's body under AC-8; the
check that it actually holds is `CO-3`, at the cutover.

---

## The invariant register

Referenced by AC-2 and AC-8, and reproduced here so the charter's implementer does not re-derive
twenty-two decisions. These are behaviours that were paid for in real money and would be cheap to
lose in a rewrite, because in each case the obvious implementation is the wrong one. The register is
Q-0009's artifact; the child named in each row inherits the row.

| # | Invariant | Child | Source decision |
| --- | --- | --- | --- |
| 1 | `check()` refuses on `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `CODEX_API_KEY` **before** probing the CLI, so a missing binary cannot mask a key; only `adapters --probe` proves a login | Q-0046 | *check() proves presence; only `adapters --probe` proves login* (2026-08-22) |
| 2 | `codex` always passes `--ignore-user-config`; `-m` only when a flow names a model; a role's default model never crosses vendors | Q-0047 | *Flows never pin a vendor model name* (2026-08-22) |
| 3 | Claude cost is money, Codex is tokens with cost `null`; no rate table ships; `null` renders `n/a`, never `$0.000`; a roll-up states how many steps were unpriced | Q-0049 | *Codex cost is reported as tokens, never priced locally* (2026-08-22) |
| 4 | A failed step's cost is in the roll-up; both vendors report failures on **stdout**, not stderr; Claude's `usage.input_tokens` excludes cache traffic | Q-0047, Q-0049 | *M0 closed* (2026-08-22) |
| 5 | `retry` at an exhaustion gate sets **that** loop's counter to `max_iterations` — exactly one more traversal — touches no other counter, and is recorded in `runs.log` | Q-0050 | *`retry` authorises exactly one more traversal* (2026-08-22) |
| 6 | Every terminal outcome — completed, regressed, failed, interrupted — writes to `runs.log` with counters persisted; an interrupt does not refund a budget | Q-0050 | *Red for the right reason is an engine property* (2026-08-22) |
| 7 | `integrate` installs dependencies in the worktree first, syncs the base branch first, rejects a suite that could not start rather than counting it red, and ignores an environment signature on a line that reports a result | Q-0053 | same |
| 8 | Ancestry is read through one primitive, three-valued: exit 0 contained, exit 1 not contained, anything else indeterminate; in a shallow repository exit 1 becomes indeterminate; the shallow probe is itself three-valued | Q-0042 | *Containment is derived from git on each board invocation* (2026-08-24); *The erratum is closed* (2026-08-25) |
| 9 | Containment is computed on every `board` invocation and stored nowhere; no `ticket.md` byte changes | Q-0043 | *Containment is derived from git…* (2026-08-24) |
| 10 | An empty diff range reports evidence — both endpoints, the short SHA each resolved to, the check run verbatim, and its outcome as contained / not contained / indeterminate — never a story about how the code arrived, and carries at most one remedy the range guard would accept | Q-0051 | *The erratum is closed* (2026-08-25) |
| 11 | A preflight that declines to examine something reports it as **skipped**; `--dry` mutates nothing and is the same run machinery, not a second path | Q-0051 | *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) |
| 12 | The diff range guard admits only the configured base or a branch under `harness/<ticket-id>/`; the lint reads every `input.diff` a flow can hold, **including inside a fan-out step's `step:` template**, which `flattenSteps` does not visit | Q-0044, Q-0051 | *The erratum is closed* (2026-08-25) |
| 13 | Three validations stay distinct: `checkAgainstSchema` strict against Quorum's own generated schema, ajv fully strict against solutioning's contracts, and vendor-wrapping tolerance confined to `extractJson` | Q-0045, Q-0046 | *Step-output validation is Quorum's contract with its own agents* (2026-08-22) |
| 14 | `x-quorum-contract: run-manifest-v1` selects the semantic pass; a missing or unknown annotation reports that semantic checks were **skipped**, never that they passed | Q-0045 | *Product-level schema annotations select semantic validation* (2026-08-23) |
| 15 | The run manifest is atomically replaced; gates and fan-out parents allocate no occurrence; adapter occurrences retain exact `prompt.txt` and `output.txt`; a `running` manifest is reported, not repaired; the reader's traversal guard resolves `realpath` rather than testing strings | Q-0049 | *Q-0034 closed* (2026-08-24) |
| 16 | `goto: flow:<target>` derives the regression stage from the target flow's `consumes`; whole-directory lint proves the return chain exists | Q-0044, Q-0050 | *Cross-flow regression uses a derived regression target* (2026-08-23) |
| 17 | An exhaustion gate cannot be bypassed by `--auto`; answers are full words consumed in order; a missing, empty, invalid or disallowed answer fails rather than inventing a decision; `human-locked` cannot be flipped | Q-0050, Q-0052 | *Non-auto exhaustion gates require an explicit human or scripted answer* (2026-08-23) |
| 18 | The cross-vendor rule is satisfied by a panel spanning vendors, not by writer ≠ reviewer | Q-0044 | *Cross-vendor rule refined* (2026-08-21) |
| 19 | A flow never writes to the user's working tree; worktrees live under `.harness/worktrees/`, run history under `.quorum/`; `finish()` rolls the ticket branch back on failure | Q-0042, Q-0048, Q-0050 | *Git worktrees are the execution model* (2026-08-06); *Branch layout* (2026-08-21) |
| 20 | `finish()` does **not** roll back task branches. This is a known gap carried into M2, and the port preserves it rather than fixing it in passing — a fix is its own ticket under AC-2 | Q-0050 | *M1 closed* (2026-08-24) |
| 21 | Invalid structured output saves the raw text beside the ticket and stops the run with a clear message; nothing is silently defaulted | Q-0046, Q-0050 | `harness/rules.md` — *"Errors are explicit"* |
| 22 | No vendor-specific event field or branching logic exists outside its adapter; every adapter maps onto `shared`'s one event schema and nothing downstream learns which vendor produced an event | Q-0041, Q-0046, Q-0047 | `docs/04-architecture.md:28`; `harness/rules.md` |

Row 20 is the shape to watch generally: a port is a tempting place to fix a known defect quietly,
and a quiet fix breaks the only proof the port has, which is that the ported tests still describe
the ported code. Row 1 is the shape to watch specifically: a rewrite that probes first and refuses
second passes every test that checks only the refusal.

---

## Non-goals

- **Porting any module.** Q-0009 writes no TypeScript in `packages/**`. If it does, the cut into
  fourteen has failed and that is worth stopping for.
- **The cutover.** Drafted below as `CO-1`–`CO-4` for a follow-up ticket; not performed here.
- **Designing the event stream.** Q-0050 owns `runFlow(opts): AsyncIterable<Event>` and the gate
  question inside it. The charter records that it is the one authorised behaviour change and names
  its owner and deadline; it does not decide its shape.
- **Fixing the four hazards.** Q-0038 exists; Q-0039 and Q-0040 are planned and unticketed; the
  chore flow's first-pass integration branch has no ticket. AC-9's checklist works around all four
  and the Risks section states the scheduling recommendation; this ticket fixes none of them.
- **Changing `spike/`.** Not to ease a port, not to fix a bug found while reading it, and not to
  delete it — that is the follow-up's.
- **The `quorum` binary.** Q-0010, which has no ticket folder yet.
- **Persisting the event stream.** `docs/04-architecture.md:68–69` says there is no persisted event
  stream in this version and incomplete `running` manifests are reported rather than repaired; the
  port does not change that, however tempting once events exist.
- **Redesigning behaviour the spike tests already cover**, adding features, new flow semantics, new
  stage transitions, or budget enforcement.
- **Exact internal source parity.** Code may be reorganised to meet the documented package
  boundaries; what is preserved is externally observable behaviour, not file layout.
- **Hidden state.** Nothing moves out of files into a database or the daemon.
- **Any path that accepts a subscription secret**, in code, fixture, test or example.
- **Anything on the v1 exclusion list** — multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell — and specifically no new `core`
  API that exists only because M3 might want it.

---

## Open questions

Per `harness/product-context.md`, an open question is a blocker when it would change a file format
or the adapter contract. **None of these does**, and none changes the design of a criterion above.

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Which flow do the fourteen take? Neither route fits as written: the chore flow's rationale is false here (a ported module has behaviour), and `qa-red` has nothing to write (the failing suite exists in `spike/test/`). A third option is worth naming — the full SDLC with `qa-red` reduced to *porting* the existing suite, which is exactly what Q-0054 is. **Recommendation:** chore for thirteen, because the ported tests are the `integrate` proof and cross-vendor review is what actually catches a mis-port, while solutioning's contracts add nothing when the contract *is* the spike's existing behaviour plus `04-architecture.md`'s public API; and a solutioning stage for **Q-0050 alone**, because the event stream is design work five tickets code against, not a port. | Ruud, at this flow's gate | **No.** AC-1 charters this ticket to make the decision, and every criterion's design is stable under either answer. Treating it as a precondition would be circular. |
| OQ-2 | How does a gate answer reach an `AsyncIterable`? `ctx.ui.gate` (`engine.js:574`) asks and awaits; an async iterable yields. `04-architecture.md:28` already fixes the six event kinds and `:68–69` already rules out persistence, so what is open is the answer channel — a bidirectional generator taking answers via `next(answer)`, a callback in `opts` beside the stream, or an out-of-band `answerGate(runId, answer)` — plus ordering, terminal events and error representation. They differ sharply in what M3's WebSocket can do and in how a run resumes after a daemon restart, and one is the natural home for Q-0040's "undecided" gate. | Principal architect + Q-0050 | **Not for this ticket.** Blocking for Q-0050, and Q-0049–Q-0053 serialise behind it — settle it as a written design *while* Q-0041–Q-0048 run, not when Q-0050 starts. The charter names that owner and that deadline (AC-10). |
| OQ-3 | `shared` or `core` for the zod schemas? `04-architecture.md:19` says `shared`; `06-development-plan.md` says both, at `:79` and `:91`. **Default assumed:** `shared` — the architecture document is the specific authority and the plan's `:79` is summary prose. Overturn it at the gate or it stands. | Ruud | No — a default is stated, and AC-3 makes the ticket settle it either way. |
| OQ-4 | Must Q-0039 (one run at a time per ticket) and Q-0040 (a gate can say "undecided") land before the children start, or will documented manual controls do? Neither has a ticket folder. **Recommendation:** land Q-0040 first — it is the only one of the four hazards that destroys completed work rather than merely wasting a run. | Ruud | No for the charter; it is the decision to *queue fourteen runs*, and it changes which items in AC-9's checklist are live. |
| OQ-5 | `zod` is a new dependency needing the one-line justification `harness/rules.md` requires; the port also carries `yaml`, `ajv` and `ajv-formats` across. Does `shared` take `zod` alone, or does `core` re-export? | Q-0041 | No; record the justification where the rules require it. |
| OQ-6 | `spike/test/**` holds frozen qa-red fixtures — Q-0037 records a `runGate` timer that cannot be removed without editing one. Does translating a frozen fixture to Vitest count as editing it, what authorises a changed assertion shape, and what evidence establishes regression equivalence when a test cannot be translated one-for-one? | Q-0054 + Ruud | No now; **blocking for Q-0054**, and the ticket most likely to discover it late. |
| OQ-7 | Does the `harness` binary name survive as an alias through the transition, or is `quorum` the only name from Q-0010 onward? No flow file invokes it; `harness/harness.yaml`'s `commands` and the documents do. | Q-0010 | No; decide before `CO-4` writes the documents. |
| OQ-8 | The chore flow's missing first-pass integration branch has no ticket, only a note in Q-0038's body. Fourteen runs is where it stops being a footnote — and it applies to Q-0009 itself. Ticket it, or leave it to AC-9's checklist? | Ruud | No; AC-9 covers the port either way. |

---

## Risks

**The source moves under the port.** Highest-likelihood risk and absent from the parent ticket body.
Four open tickets edit `spike/src/**`, the port runs over several evenings, and a fix landed after
its module was ported is invisible — both suites stay green, because each tests the tree it was
written against. AC-5 and AC-6 are the mitigation and `CO-1` verifies it. The scheduling consequence
is that Q-0037–Q-0040 either land before the freeze or are re-targeted at `core`, which makes them
ports-plus-features and larger than they currently look.

**Fourteen runs on machinery with four known defects.** Each hazard has already cost real money at
n=1; the port makes n=14. The most expensive is the unanswerable gate: a non-interactive run that
reaches one fails, and `finish()` then rolls back a merge it had just proven green — it has cost
Q-0035 and Q-0036 their merge on consecutive nights, forty seconds after the suite went green in one
case. **Recommendation: land Q-0040 before queueing fourteen runs.** It is already in M2, it is the
only one of the four that destroys completed work rather than merely wasting a run, and paying for
it once is cheaper than working around it fourteen times.

**The engine chain stalls on OQ-2.** Q-0049 through Q-0053 are strictly ordered and all five wait on
the event-stream shape. If OQ-2 is unresolved when Q-0050 starts, the cost is not one ticket but
five, plus whatever Q-0052 and M3 build against a shape that then changes. Mitigation: settle it as
a written design while Q-0041–Q-0048 — independent of each other beyond `shared` — run in parallel.

**The port is judged by tests ported by the same process.** Q-0054 is the only ticket that can prove
any of the others, and it is last. A subtle mis-port and a correspondingly mis-ported test agree
with each other. Partial mitigation: AC-7 keeps both suites running throughout, so the spike's
untouched suite remains an independent witness until the cutover — a second reason the freeze
matters, since a witness that has been edited is not one. Q-0054's own body adds a wrinkle AC-10
must settle: most of that suite drives the binary, so the witness runs through `packages/cli`.

**Boundary leakage.** Copying the spike's file layout directly would leave reusable domain logic in
the CLI and vendor details above the adapters, blocking M3 reuse. AC-12 states the end-state;
`CO-3` checks it.

**Fourteen tickets is fourteen contexts.** The sizing decision is right and this is its cost: any
drift between the charter and a child's body is drift between fourteen implementations. Mitigation:
the charter is the single source and children cite it rather than restating it (AC-8).

**Cost.** $350–550 estimated across the children, from measured chore tickets at $26.81 and $36.66.
The estimate could be low: those were single-module changes to a spike, while a port carries review
of a whole module's behaviour. AC-11 forces the number to be checked after three rather than after
fourteen.

---

## Cross-cutting checklist

- **BYOS.** No new code path touches a subscription secret. Register row 1 makes the refusal — *and
  its ordering before the CLI probe* — an explicit invariant, because a rewrite that probes first
  and refuses second passes every test that checks only the refusal. No fixture, test or example in
  the ported packages may name one of the three environment variables except as a value the code
  refuses on.
- **Worktree safety.** Register row 19. Nothing in this ticket runs a flow that writes to the
  working tree; if it takes the chore route its implementer works in a worktree on
  `harness/Q-0009/implement`, and that branch's base — `harness/Q-0009/integration` — must exist
  before the first run (AC-9, and it applies to this ticket as much as to its children).
- **Gate behaviour.** Register row 17. Human-gated stays the default, `auto` stays opt-in,
  `human-locked` cannot be overridden, exhausted loops still land on a human gate. AC-9 governs how
  many `--gate-answer` values a child run may carry.
- **File formats and their schemas.** The port changes none. `ticket.md` frontmatter, `runs.log`
  lines, flow YAML, role files and `.quorum/runs/<id>/manifest.json` are byte-compatible across the
  cutover — `contracts/Q-0011/run-manifest.schema.json` is frozen and neither this ticket nor its
  children open it legitimately. Testable at `CO-3`: a manifest written by the spike validates under
  `quorum validate` afterwards.
- **Lint rules.** Register rows 12, 16 and 18. `quorum lint` must accept all six flow files
  currently in `harness/flows/` and reject the same things `harness lint` rejects. (Six, not eight —
  `qa-final.yaml` and `deploy.yaml` are Q-0012 and do not exist yet.)
- **Cold-clone impact.** Zero until the cutover, then net positive and it is the point: one binary
  instead of two, one suite instead of two, and `CLAUDE.md` no longer instructing a newcomer to run
  a directory called `spike`. The port adds no step to the existing first-run path.
- **Product-agnostic.** No change; nothing in the port names a SaaS product.
- **Errors are explicit.** Register rows 10, 11, 13, 14 and 21 are all instances, and four of the
  five were bought with money. The port's single most likely regression is a bare `catch {}` that
  turns an unanswerable question into a confident answer — the defect Q-0035 was created to fix, in
  the same file Q-0051 is about to port. AC-6 applies the same rule to this ticket's own guard: a
  freeze check with no SHA to check against says so rather than passing.

---

## Carried over: the cutover ticket

Drafted in full so the cut loses nothing and the follow-up can be created by copy. **Proposed id
Q-0055** — the next free one; Q-0010, Q-0012, Q-0039 and Q-0040 are reserved by
`docs/06-development-plan.md` and still have no folder. **Runs only after Q-0010 and Q-0054 both
report `main:contained` on `harness board`.**

**CO-1 — The preconditions are checkable, and each is one command.** The cutover commit is not made
until all four hold: every one of the fourteen children and Q-0010 is at stage `reviewed` or later
**and** `harness board` reports it `main:contained`; `git diff <freeze-sha>..main -- spike/src` is
empty; `pnpm lint && pnpm typecheck && pnpm test` passes on `main`; and the spike's own suite passes
on `main`. *Test:* run the four; all pass, and the ticket folder records their output.

**CO-2 — The new binary is proved before the old one is deleted, and it costs nothing to prove.**
From a clean clone of the cutover branch with `spike/` already removed: `quorum lint` validates
every flow file in `harness/flows/`; `quorum board` renders every ticket with its stage and its
containment token; `quorum run <flow> <ticket> --dry` completes and reports what it *skipped* as
skipped rather than as passed; and one non-dry run on the mock adapter completes end to end.
Commands and output are committed to the ticket folder. No subscription-authed adapter is required,
so this is repeatable by anyone.

**CO-3 — The boundary AC-12 stated actually holds.** Project loading, ticket and frontmatter
handling, flow linting, contract validation, adapter control, fan-out, run history and engine
behaviour are exported from `core` or `shared` rather than implemented in the CLI; the CLI is
limited to argument handling, invocation of core, event rendering and process exit behaviour; and a
manifest written by the spike before the cutover validates under `quorum validate` after it. *Test:*
import each named export from `packages/core` in a scratch script; grep the CLI for domain logic;
run the validation.

**CO-4 — One revertable commit does the cutover, documents included.** A single commit deletes
`spike/`, removes CI's `spike (regression suite)` job and every tooling reference that executes or
imports it, switches `harness/harness.yaml`'s `commands.install` and `commands.test` to the
workspace alone, makes the workspace tests the required regression gate, retires AC-6's freeze
guard, and updates every document that tells a reader to run the spike — at minimum `CLAUDE.md`
(*"Until M2 lands, the runnable code is the spike in `spike/`"* and its Commands section),
`harness/architecture.md`, `docs/04-architecture.md`'s status line, `docs/06-development-plan.md`'s
M2 section and `docs/GLOSSARY.md` where it names the spike. *Test:* `git revert <sha>` applies
cleanly; a search for `spike` outside `docs/DECISIONS.md` and existing `backlog/` folders returns
nothing instructional; a reader following `CLAUDE.md` from that commit runs `quorum` and succeeds.

---

## Provenance

**From `candidate-claude.md`** — the evidenced ticket-specific problems (unfrozen source, the
write-contract gap, the `ui.gate`/`AsyncIterable` hole); the invariant register, rows 1–20, which is
the highest-value artifact in either candidate and the thing that stops fourteen agents each losing
a behaviour that was paid for in cash; row 20's instruction to preserve a known defect rather than
fix it quietly; the CI-enforced freeze (AC-6); the freeze-SHA idea (AC-5); both-suites-wired (AC-7);
the hazard checklist (AC-9); the per-vendor cost checkpoint (AC-11); all four cutover criteria; the
three user stories; and the cross-cutting checklist's structure. Its line-level claims were checked
again this iteration and every one held: `engine.js:37` takes `ui` with 33 `ui.` call sites,
`ctx.ui.gate` awaits at `:574`, `loadProject` is at `harness.js:54`, `lintDirectory` at 374,
`overrideAdapters` at 612, `04-architecture.md:19` gives schemas to `shared`. It also silently
corrected the parent ticket body: the spike has **three** dependencies, not two.

**From `candidate-codex.md`** — AC-10, the dependency and landing order as a checkable rule, which
is the best single criterion in either document and which the Claude candidate left in prose;
AC-12's statement of the CLI's *residual* scope ("argument handling, invocation of core, event
rendering, process exit behaviour"), the cleanest expression of the boundary finding anywhere in the
pair; the one-run-per-ticket clause folded into AC-9; the regression-equivalence record folded into
OQ-6; OQ-4's direct scheduling question about Q-0039 and Q-0040; the event-contract completeness
list (ordering, terminal events, error representation) folded into OQ-2; and most of the broader
non-goals — no budget enforcement, no new stage transitions, no hidden state, and no promise of
exact internal source parity.

**Added in iteration 1's merge** — the size judgement and the charter/cutover cut, which neither
candidate made; register rows 21 and 22, which neither had; the narrowing of OQ-2 by
`04-architecture.md:28` and `:68–69`; the finding that `06-development-plan.md` contradicts *itself*
at `:79` and `:91`, so OQ-3 has a defensible default; the restructuring of the freeze into a policy
writable now and a SHA nameable later; and the finding that Q-0010 has no ticket folder while both
cutover criteria depend on it.

**Added or corrected in iteration 2** — the cut is *applied* rather than proposed, which is what the
role instruction actually asks for, and the cutover criteria are carried into a drafted follow-up
instead of held as a blocker. AC-4 is re-scoped after a correction to iteration 1's own evidence:
`harness/roles/developer-generalist.md`, the role `chore.yaml`'s `implement` step runs, already
carries `paths: [… packages, apps, spike, harness, docs]`, so the claim that no role may write
`packages/**` was true of the role *table* and false of the role the recommended route uses; what
remains is that the table grants neither workspace package, names three directories that do not
exist, and omits the generalist entirely, so an agent reads context contradicting its own role file.
AC-6 is rewritten from that reading: the freeze cannot live in a role's `paths`, because the same
role legitimately writes `spike/src` for Q-0038 and Q-0040, so the guard keys on the fourteen child
branch names — and, per the 2026-08-25 rule, reports itself inert rather than green while no freeze
SHA exists. AC-8 absorbs the parent's own body edit and is re-sized against an audit of the fourteen
child bodies, which all exist and all cite the parent and a dated decision, with explicit non-goals
in five and a declared dependency in six. AC-10 gains the Q-0054/Q-0010 question from Q-0054's body:
most of the spike suite drives the binary, so the port's proof runs through a package that has no
ticket. And OQ-1 is downgraded with the reason stated — charging a ticket with making a decision and
then demanding the decision before the ticket may be specified is a loop with no exit.

**Where the candidates disagreed, and the calls made** — *Freeze by CI or by convention:* Claude.
The engineering rules put safety in code, not convention, and the Codex phrasing ("changes
independently required to repair the harness are handled outside Q-0009") permits the drift rather
than detecting it. *Invariants as a list or as a policy:* Claude. "Preserve behaviour covered by the
ported tests" is exactly wrong for the invariants that matter, because the ones that cost money are
the ones the tests under-specify — register row 1 is the proof. *Event contract scope:* both, then
narrowed by the architecture document. *Cost checkpoint:* Claude's format with the Codex demand that
the threshold be stated before the number arrives.
