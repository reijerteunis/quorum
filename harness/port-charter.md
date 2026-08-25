# The port charter — Q-0009

*Status: written 2026-08-25 by Q-0009. The ground rules for porting `spike/` into
`packages/core` and `packages/shared` across fourteen child tickets, Q-0041 to Q-0054. Q-0009
ports nothing; this document and the guard beside it are its output. Read with
`harness/rules.md` and `harness/architecture.md`, which points here.*

## Why this lives in `harness/` and not in the ticket folder

Q-0009's requirement asks for the charter under
`backlog/Q-0009-port-the-spike-to-packages-core/`. It cannot live there and be read, for two
reasons that are properties of the engine rather than preferences:

1. **An agent's writes under `backlog/` are discarded.** `commitAll` reverts and cleans
   `backlog/` before every step commit (`spike/src/fanout.js`), because the engine owns ticket
   state and an agent once rewrote a ticket's frontmatter on its branch. A charter written
   there by an implementer never reaches a commit at all.
2. **A child could not read it even if it did.** `input.backlog` resolves against *the running
   ticket's own folder* (`spike/src/engine.js:704–705`). Q-0041 reading
   `requirements/merged.md` reads Q-0041's copy; nothing in the flow file can point a child at
   another ticket's directory.

`harness/` is the opposite on both counts: it survives an agent's commit, and
`harness/architecture.md` is injected verbatim into every `chore` implement step
(`chore.yaml:14`). Pointing at this file from there is the only route by which the charter
reaches the fourteen agents that need it. `harness/` is one of the four surfaces Q-0009's
requirement declares, so this is a relocation within scope, not a new one.

This file is repository-specific context, like `rules.md` and `architecture.md`. It has no
counterpart under `spike/templates/harness/` and must not acquire one — it describes Quorum's
own port, not an adopter's project.

---

## 1. The route

Decided in `docs/DECISIONS.md`, **"The port takes the chore route, except the one child that
has new behaviour" (2026-08-25)**. Thirteen children — Q-0041, Q-0042, Q-0043, Q-0044, Q-0045,
Q-0046, Q-0047, Q-0048, Q-0049, Q-0051, Q-0052, Q-0053, Q-0054 — take `requirements → chore →
human gate`. **Q-0050 alone** takes the full SDLC, because the event stream is the port's one
authorised behaviour change and five later tickets code against its shape. Q-0009 itself takes
chore.

Three consequences that entry fixes, repeated here because they change how runs are scheduled:

- **Q-0050's solutioning runs early**, in parallel with Q-0041–Q-0048, not when Q-0050's turn in
  the landing order arrives. Run order and landing order are different things.
- **Every child ports its module's unit-level tests with the module.** Q-0054 keeps only the
  end-to-end regression suite and the CLI-driven files whose translation cannot be split per
  module. A child that ports a module and leaves all of its tests to Q-0054 makes chore's
  `integrate` step examine nothing the run produced, which is a green tick over an unexamined
  subject.
- **Q-0050 is the only child that may be routed differently**, and the only one needing the
  fan-out role table to grant it anything.

## 2. Behaviour preservation

**The default is that the port preserves externally observable behaviour, and the ported tests
are the proof.** Externally observable means: what a command prints and its exit code, what is
written to `backlog/`, `.quorum/` and `runs.log` and in what format, which branches and
worktrees exist and where, what an adapter is invoked with, and when a run stops. Internal file
layout, function names and module boundaries are explicitly *not* preserved — §7 requires
several of them to change.

**One exception is authorised: `runFlow` becoming `AsyncIterable<Event>`, owned by Q-0050.**
Nothing else. A child that finds a defect, an inconsistency or an obvious improvement while
reading the spike **stops and reports it** — it does not fix it in passing. The route for a
deliberate behaviour change is its own `docs/DECISIONS.md` entry or a dated erratum in the
child's folder, written and accepted *before* it is implemented, never a silent improvement
discovered in review.

The reason is narrow and worth stating: the port's only proof is that the ported tests still
describe the ported code. A quiet fix breaks the proof, and it breaks it invisibly — the spike's
suite stays green because the spike still has the old behaviour, and the workspace suite stays
green because it was ported from a tree that had the new one. Both green, the product wrong.
Register row 20 is the case in point: a known defect that the port must carry forward unfixed.

### The invariant register

Twenty-two behaviours that were paid for in real money and would be cheap to lose in a rewrite,
because in each case the obvious implementation is the wrong one. The child named in each row
inherits the row and must name it among its own invariants.

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
| 20 | `finish()` does **not** roll back task branches. This is a known gap carried into M2, and the port preserves it rather than fixing it in passing — a fix is its own ticket under §2 | Q-0050 | *M1 closed* (2026-08-24) |
| 21 | Invalid structured output saves the raw text beside the ticket and stops the run with a clear message; nothing is silently defaulted | Q-0046, Q-0050 | `harness/rules.md` — *"Errors are explicit"* |
| 22 | No vendor-specific event field or branching logic exists outside its adapter; every adapter maps onto `shared`'s one event schema and nothing downstream learns which vendor produced an event | Q-0041, Q-0046, Q-0047 | `docs/04-architecture.md:28`; `harness/rules.md` |

Row 20 is the shape to watch generally: a port is a tempting place to fix a known defect
quietly. Row 1 is the shape to watch specifically — a rewrite that probes first and refuses
second passes every test that checks only the refusal.

## 3. The freeze

**The rule.** No ticket in Q-0009's set — Q-0041 through Q-0054, and Q-0009 itself — may modify
or delete any file under `spike/src/`, and none may delete `spike/`. The port is built *beside*
the machinery it runs on. `spike/` is not dead code being replaced: it is the harness Quorum is
currently developed with, every one of these fifteen tickets runs through it, and it is the
port's only independent witness. A witness that has been edited is not one.

The freeze is a property of *these fifteen tickets*, not of any role. `developer-generalist`
may write `spike` and should — Q-0038 and Q-0040 are chore-shaped tickets whose whole subject is
`spike/src`. That is why it is enforced on branch names in CI rather than in a role's `paths`.

**Enforcement.** `.github/scripts/port-freeze-guard.sh`, run by the `port-freeze` job in
`.github/workflows/ci.yml`, reads the machine-readable block below. Any branch
`harness/<id>/*` whose `<id>` is in the `children` list and whose diff against `main` touches
`spike/src/` fails the job. Branches for any other ticket are out of the guard's scope and it
says so rather than passing silently.

The `children` list holds the **fourteen**, not Q-0009 itself, because that is what Q-0009's
requirement specifies the guard to key on. Q-0009's own compliance rests on its stated non-goal
— it writes no code in `packages/**` and does not change `spike/` — and not on the guard. That
is a deliberate, narrow gap: the ticket that wrote the freeze is not policed by it. Adding
`Q-0009` to the list would close it, and would need saying out loud rather than doing quietly.

**The exemption path.** An exemption is a human act, recorded in git forever. Add a commit on
the child's branch whose message carries the trailer

```
Port-freeze-exemption: <ticket-id> <one line saying what and why>
```

The guard finds it in any commit between the merge base and the branch tip, passes, and prints
the trailer it honoured. An agent does not write this trailer — the harness authors the commit
messages on a child's branches, so an exemption can only come from the human amending or adding
a commit deliberately.

**The freeze SHA is not yet named.** The SHA-anchored half of the freeze — that `main` acquired
no `spike/src` change after the port began — cannot be recorded until four open tickets that
legitimately edit `spike/src` are settled:

| Ticket | Subject | Must |
| --- | --- | --- |
| Q-0037 | Run-history review remainder — one major, eight nits | land in the spike before the freeze, or be re-targeted at `core` |
| Q-0038 | Deferred-range failures name their producing step | as above |
| Q-0039 | One run at a time per ticket *(no folder yet)* | as above |
| Q-0040 | A gate can say "undecided" *(no folder yet)* | as above |

Re-targeting any of them at `core` makes it a port-plus-feature and larger than it currently
looks. Until all four are settled and the SHA is written into the block below, **the guard
reports its SHA-anchored half as SKIPPED, not as passed** — the 2026-08-25 rule applied to the
guard itself. Its branch-scope half is live now, because fourteen child runs start long before
the SHA exists and an inert guard would protect none of them.

<!-- port-freeze:begin — read by .github/scripts/port-freeze-guard.sh; keep the three keys and their format -->
```yaml
children: Q-0041 Q-0042 Q-0043 Q-0044 Q-0045 Q-0046 Q-0047 Q-0048 Q-0049 Q-0050 Q-0051 Q-0052 Q-0053 Q-0054
freeze-sha: not-yet-recorded
exemption-trailer: Port-freeze-exemption
```
<!-- port-freeze:end -->

## 4. Where the schemas live, and which way the dependency points

**`packages/shared` owns the zod schemas**, the trace/event format and the shared constants.
`packages/core` imports them and defines none of its own. `docs/04-architecture.md` is the
authority; `docs/06-development-plan.md` was corrected to agree.

**The dependency direction is `core → shared`, and never the reverse.** `shared` depends on no
other workspace package. Nothing in `shared` may import from `core`, `cli`, `server`,
`compiler`, `templates` or `apps/web`, and no cycle is permitted. A child that finds itself
wanting the reverse edge has found a shape that belongs in `shared`, or one that belongs in
neither.

## 5. Dependency and landing order

A checkable rule, in five clauses. A reviewer given any two children can say which lands first.

1. **Q-0041 lands before any child that imports `packages/shared`** — which is all thirteen
   others.
2. **Q-0042 through Q-0048 may land in any order** once their declared dependencies are green.
   They have no dependency on each other beyond `shared`, so they may also *run* in parallel.
3. **Q-0049, Q-0050, Q-0051, Q-0052, Q-0053 land in that order**, each consuming the run context
   the one before it defines.
4. **Q-0054 lands last** and cannot land until every module port it exercises has landed.
5. **A child whose declared dependency is not `main:contained` on `harness board` does not
   start its first run.** Landing order is checked before the run, not discovered in review.

**Run order is not landing order.** Q-0050's solutioning runs early, alongside Q-0041–Q-0048,
because Q-0049 and Q-0051–Q-0053 serialise behind the event-stream design and the answer channel
must be settled while the independent children are still running.

### Q-0054's relationship to Q-0010, decided

Most of the spike suite drives `bin/harness.js` and imports no source module — `smoke.js`,
`q0011-runs-cli.js` and `q0036-board-containment.js` — so the acceptance evidence for a `core`
port runs through `packages/cli`, which is Q-0010 and has no ticket folder. Q-0054's body names
three routes. **The charter picks the first: Q-0054 ports the library-level suites and leaves the
CLI-driven ones on the spike until Q-0010 lands.**

The other two are rejected on the charter's own rules. Sequencing Q-0054 entirely after Q-0010
serialises the whole port behind unticketed work and delays the only ticket that can prove any
of the others. Re-aiming the CLI-driven suites at core's public API changes what they test,
which is a behaviour change to the frozen witness under §2 and destroys the independence that
makes the witness worth having.

The consequence is that between Q-0054 and the cutover the repository genuinely has two suites
and both are required — which is what §6's checklist and CI already assume. The CLI-driven
suites transfer at Q-0010, and the new binary is proved before the old one is deleted.

## 6. The per-child register

What each child ports, the CLI-held domain logic it lifts, what it depends on, and the register
rows it inherits. Ownership is stated once here so fourteen bodies do not each re-derive it.

| Child | Ports from `spike/src` | Lifts from `spike/bin/harness.js` | Depends on | Invariants |
| --- | --- | --- | --- | --- |
| Q-0041 | *(new)* `packages/shared`: zod schemas, event union, constants; `STAGES` from `backlog.js:6` | — | — | 22 |
| Q-0042 | `git.js` — worktrees, `ancestry()`, containment, `shallowState()` | — | Q-0041 | 8, 19 |
| Q-0043 | `backlog.js` — frontmatter, `Backlog`, ticket walk | `findProject`, `loadProject` (:46–61) | Q-0041 | 9, 19 |
| Q-0044 | `lint.js` — `FlowError`, `flattenSteps`, `lintFlow`, `validateFlowDirectory` | `lintDirectory` (:374) | Q-0041 | 12, 16, 18 |
| Q-0045 | `contracts.js` — ajv validation | `run-manifest-v1` semantic pass and roll-up recomputation (:270–360) | Q-0041 | 13, 14 |
| Q-0046 | `adapters/index.js` — contract layer, `checkAgainstSchema`, `extractJson`, `authError`, mock | — | Q-0041 | 1, 13, 21, 22 |
| Q-0047 | `adapters/claude.js`, `adapters/codex.js`, per-adapter `capabilities` | `overrideAdapters` (:612) | Q-0041, Q-0046 | 2, 4, 22 |
| Q-0048 | `fanout.js` — tasks, waves, worktrees, branches, `commitAll` | — | Q-0041, Q-0042 | 19 |
| Q-0049 | run history in `engine.js` — manifest, occurrences, roll-ups | reader: `manifestShapeError` (:142), `readRunsDir` (:151), `sortRuns` (:171), `occurrenceSeq` (:184), `isIncomplete`, `realpath` traversal guard (:135–246) | Q-0041, Q-0045 | 3, 4, 15 |
| Q-0050 | `engine.js` run loop, routing, stage transitions, `runFlow` as event stream | — | Q-0041, Q-0049 | 5, 6, 16, 17, 19, 20, 21 |
| Q-0051 | `engine.js` diff preflight and materialisation | — | Q-0050 | 10, 11, 12 |
| Q-0052 | `engine.js` agent, gate and script steps | — | Q-0051 | 17 |
| Q-0053 | `engine.js` fan-out and integrate steps | — | Q-0052, Q-0048 | 7 |
| Q-0054 | `spike/test/**` library-level suites → Vitest; CI gating | — | all above | — |

**Every child's non-goals include, without restating them:** porting another child's module;
editing `spike/**` (§3); fixing a defect found while reading (§2); the cutover; the `quorum`
binary (Q-0010); persisting the event stream; and anything on v1's exclusion list.

## 7. The end-state boundary

The spike's module boundary is not the boundary to reproduce. `spike/bin/harness.js` holds
domain logic that `docs/04-architecture.md` places in `core` — the clearest instance being
`loadProject()`, named there as part of core's public API and implemented at
`spike/bin/harness.js:54`.

**Exported from `core` or `shared`, not implemented in the CLI:** project loading; ticket and
frontmatter handling; flow linting; contract validation and the `run-manifest-v1` semantic pass;
adapter control, including `check()`, probing and adapter override resolution; fan-out; run
history, both writer and reader; and engine behaviour.

**The CLI's residual scope** is argument handling, invocation of core, event rendering and
process exit behaviour. Nothing else.

A port that faithfully reproduced `bin/harness.js` would hand Q-0010 a package that cannot be
reused, and M3's server would have to shell out to a binary for logic it should import. That
this boundary actually holds is checked at the cutover, not by any child.

## 8. Pre-run checklist

Four known defects in the machinery the port runs on. Each has already cost real money at n=1;
the port makes n=15. Route-conditional items are marked.

- [ ] **Create `harness/<id>/integration` before the ticket's first chore run.** *(chore route
      only — thirteen children and Q-0009.)* `review` diffs
      `harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs
      later, creates the left endpoint. Q-0008 and Q-0036 passed only because the branch was
      made by hand minutes before. Forgetting it fails the run *after* the implementer has been
      paid, which is how Q-0035 lost $13.86.
- [ ] **Pass no more `--gate-answer` values than you would authorise blind.** They are consumed
      in order by whichever gate arrives first, and an engine-presented exhaustion gate is a
      gate. Prefer too few: the run fails, which is recoverable, instead of advancing.
- [ ] **Treat `budget.per_run_usd` as descriptive.** It is 10 and nothing reads it; a single
      step has spent $13.86 past it uninterrupted. The cap is your attention, not the config.
- [ ] **One run per ticket at a time.** Nothing enforces it (Q-0039). Two runs overlapped twice
      in one night during M1 and one run's rollback moved a branch another live run was holding.
- [ ] **Confirm the child's declared dependency is `main:contained`** before starting its first
      run (§5, clause 5).
- [ ] **Expect an unanswerable gate to fail the run and roll the ticket branch back** (Q-0040).
      Answer the final gate, or accept that proven-green work is discarded and the merge must be
      re-performed by hand.
- [ ] **Q-0050 only:** its solutioning runs early, in parallel with Q-0041–Q-0048, and the gate
      answer channel is settled there before Q-0049–Q-0053 start.

## 9. The cost checkpoint

**When.** After the first three children reach `reviewed` — whichever three they are.

**Inputs.** Each child's `runs.log` and `ticket.md` history: billed Claude cost, Codex tokens,
wall clock, run count, and how many steps reported no price.

**Format — per vendor, never blended.** Billed Claude cost as money; Codex as tokens with cost
`null` rendered `n/a` beside the token count, never `$0.000`; wall clock per child; and a count
of unpriced steps, so the reader knows how much of the total the figure cannot see.

**The threshold, stated before the number arrives.** The estimate is $350–550 across fourteen,
from measured chore tickets at $26.81 (Q-0036) and $36.66 (Q-0035) — about $25–39 each. The
remaining eleven are **re-cut or re-routed rather than continued** if any of these holds:

- mean billed Claude cost across the three exceeds **$40 per child**; or
- the projection for fourteen exceeds **$550**; or
- any one child needed **more than three chore runs** to reach `reviewed`.

The third is the one to watch: a child that loops is a child cut wrong, and cost is the symptom
rather than the disease.

## 10. What this charter does not own

The cutover — deleting `spike/`, retiring the second CI job and this guard, and rewriting every
document that tells a reader to run the spike — is drafted as `CO-1`–`CO-4` in Q-0009's merged
requirement and belongs to a follow-up ticket, proposed **Q-0055**, which runs only after Q-0010
and Q-0054 both report `main:contained`. The event stream's shape belongs to Q-0050. The four
machinery defects belong to Q-0037–Q-0040. This charter works around them and fixes none.
