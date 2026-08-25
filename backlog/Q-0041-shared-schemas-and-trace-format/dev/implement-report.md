# Q-0041 — implementation report (chore, iteration 5)

*Revision round, and the **single traversal** authorised by the `retry` answered at run 3's
exhaustion gate — `runs.log`: `2026-08-25T19:49:23.790Z run=3 gate=retry counter=chore.review set=2
(one further traversal authorised)`. A further rejection re-presents the gate rather than buying
another round.*

**One finding was open. It was correct. It is fixed, and the fix is proved to be load-bearing.**

---

## 1. Which review is current, and why only one finding is open

Three files sit under `review/`, and a reviewer opening the folder will reasonably assume three
findings are outstanding. Only one is. The evidence is the file mtimes against `runs.log`, which
match to the millisecond:

| File | mtime (+02:00) | `runs.log` line | Which run |
| --- | --- | --- | --- |
| `review/chore-iter-1.md` | 21:39:18.885 | `19:39:18.885Z run=3 step=review … verdict=revise` | **run 3 — current, and the only open finding** |
| `review/chore-iter-2.md` | 20:42:02.121 | `18:42:02.121Z run=2 step=review … verdict=revise` | run 2, iteration 2 — settled by **E-1** |
| `review/chore-iter-3.md` | 20:55:32.916 | `18:55:32.916Z run=2 step=review … verdict=revise` | run 2, iteration 3 — settled by **E-1, E-2, E-3** |

So `chore-iter-1.md` is not run 2's first review; it is **run 3's review of round 4's work**, and it
overwrote run 2's first review, which no longer exists anywhere. The cause is in the engine and is
mechanical: `chore.yaml:34` writes `review/chore-iter-{iter}.md`, and `ctx.vars.iter` is initialised
to `1` at **run** start (`spike/src/engine.js:45`) and incremented per traversal (`:155`). It is
run-scoped, not ticket-scoped, so every new run restarts the numbering and its first review lands on
`chore-iter-1.md` again. This is a stop-and-report item, not something this ticket may fix — §6.

Rounds 2 and 3's findings were settled by `requirements/errata.md` and implemented in round 4
(`.passthrough()` → `strict` on the event variants for E-3, `route` left untyped with E-2's evidence,
and the property re-stated and executed against the real linter for E-1). Round 4's report covers
that work; nothing in it is re-opened here, and nothing in it is re-litigated.

---

## 2. The finding, and the check I ran before believing it

> **major: packages/shared/src/flow.ts:181** `agentStepSchema` requires `id`, and the script,
> integrate, and fan-out schemas repeat that requirement, even though `lintFlow` accepts steps of
> those kinds without an `id`; parallel members inherit the same requirement through
> `agentStepSchema`. This violates erratum E-1's binding rule that the schema may require no key
> whose absence lint accepts […] Make `id` optional for every step kind where `lintFlow` does not
> require it, and add real-`lintFlow` presence tests covering an id-less plain agent, parallel
> member, script, integrate, and fan-out step.

It is right on every count. Three review rounds on this ticket were spent arguing about what
`lintFlow` accepts *from reading it*, which is the mistake E-1 exists to end — so I ran it. Each row
below is `spike/src/lint.js`'s own verdict on a flow whose single step carries no `id`, with whatever
else that kind needs to lint clean:

| Step, written with no `id` | Real `lintFlow` |
| --- | --- |
| plain agent — `{role, adapter}` | **ACCEPTS** |
| `parallel` member — `{parallel: [{role, adapter}, {role, adapter}]}` | **ACCEPTS** |
| script — `{type: 'script', run}` | **ACCEPTS** |
| integrate — `{type: 'integrate', branches}` | **ACCEPTS** |
| fan-out — `{fan_out, step}` | **ACCEPTS** |
| agent with `input.diff` | **ACCEPTS** |

The mechanism is one line: `lintFlow` gathers ids with `steps.filter((step) => step.id)`
(`lint.js:59`), so an id-less step is simply absent from the duplicate-id check, and **no other rule
in the function looks for one**. The gate step was never the exception it appeared to be — it was the
only kind anyone had checked, which is why it was the only one already optional.

Four required-`id` schemas is four presence rules lint does not have. That is zod adding rules to the
flow format, which is what AC-3 was written to prevent, what E-1 makes the whole of the property, and
what `docs/DECISIONS.md` ("Zod describes structure and types…", 2026-08-25) states as *"the schema
may add no rule about which keys are present."* That entry also claims *"after the third implement
round the schema requires nothing lint does not"* — **that claim was false when it was written, and
is true of this file only from this round onward.** No document needed editing; the code needed to
catch up with it.

### I swept the rest of the package for the same defect rather than patching the named line

If four presence rules survived three rounds, the question is whether any others did. I checked every
required key in the package against the real linter. `id` was the only violation:

| Required key | Does lint require it? | Verdict |
| --- | --- | --- |
| `flowSchema.consumes`, `.produces` | Yes — `lint.js:124`; `lintFlow({})` and `lintFlow({consumes, steps})` both refuse | correct, unchanged |
| `onFailSchema.goto` | Yes — `lint.js:63`, *"on_fail without goto"* | correct, unchanged |
| `onFailSchema.max_iterations` | Yes — `lint.js:65`, absent fails `Number.isInteger` | correct, unchanged |
| `onFailSchema.on_exhausted` | Yes — `lint.js:75`, absent is `!== 'gate'` | correct, unchanged |
| `parallel`, `gate`, `type`, `fan_out` | Present by construction — the selector chooses that branch *on* them | not a presence rule |
| `stepInputSchema`, `stepOutputDeclarationSchema` | Every field already optional | nothing to check |

`agentStepResultSchema` (`step-output.ts`) requires `summary`, and E-1 does not reach it: it is a
value Quorum constructs from an agent's answer, not a flow object lint ever sees.

---

## 3. File by file

Two files changed. Nothing else in the package was touched.

### `packages/shared/src/flow.ts` — `id` optional on four schemas, plus the reasoning

- **`agentStepSchema:190`** — `id: z.string()` → `id: z.string().optional()`, with a doc-comment
  saying why and pointing at the header. This one line is also what fixes the `parallel` half of the
  finding: `parallelGroupSchema:198` is `z.array(agentStepSchema)`, so its members inherit it.
- **`scriptStepSchema:222`**, **`integrateStepSchema:233`**, **`fanOutStepSchema:282`** — the same
  change, each with a one-line comment rather than a repeat of the argument.
- **Header, the PRESENCE paragraph** — rewritten from a sentence into the three cases it actually
  governs, so the next reader does not have to re-derive the third: `name`/`steps` optional,
  `consumes`/`produces` required, and `id` optional on every kind with `lint.js:59` cited as the
  mechanism and the six-row probe above recorded as having been *run*.
- **The cost is stated in the same paragraph rather than left implicit.** `id` is now
  `string | undefined` on every step type a consumer holds, and the engine genuinely needs one — it
  interpolates `harness/<ticket>/<step.id>` for a worktree branch (`engine.js:211`) and keys a loop
  counter `<flow>.<step.id>` (`engine.js:541`). A reader who finds that surprising should find the
  reason next to the field, not in a report nobody opens again. It is a gap in lint, and closing it
  here would be the very failure this change corrects; §6 reports it.
- **`fanOutStepTemplateSchema:275`** — comment only. It read *"`id` is optional here where it is
  required on a real agent step"*, which this round makes false. It now records that the two schemas
  are structurally identical and are deliberately **not** aliased to each other: they are different
  things — one is a step the engine runs, the other a template it copies per task — and an alias
  would make a later change to one silently a change to the other.

No other schema, field, type or export in the file moved.

### `packages/shared/src/flow.test.ts` — the tests the finding asks for, plus one it implies

- **`ID_LESS_CASES`** — the same flow written once per step kind with its step carrying no `id`:
  plain agent, `parallel` member, script, integrate (with `branches`), fan-out (with its `step:`
  template), and the gate step. Each row carries whatever else its kind needs to lint clean, so the
  only variable under test is the missing id. The gate row overlaps one row in `PRESENCE_CASES`
  deliberately — this table is *all six kinds*, and dropping one to avoid a duplicate assertion would
  make it five and hide which kind is which.
- **`presence: no step kind requires an id…`** — for each row: the real `lintFlow` accepts it (the
  premise), the schema accepts it (the fix), and the schema returns it **unchanged** (AC-4 rule 3,
  which the new optional field must not quietly breach).
- **`presence: an id-less step is still parsed as its own kind, not demoted to an agent step`** — the
  finding does not ask for this and the change needs it. Making `id` optional must not blur the
  selector, so this asserts that `{gate: 42}`, `{type: 'script', run: 5}`,
  `{type: 'integrate', branches: 7}` and `{fan_out: 42}` — all id-less — still fail on **their own
  kind's field** (`steps.0.gate`, `steps.0.run`, `steps.0.branches`, `steps.0.fan_out`) rather than
  falling through to the permissive agent branch. Without it, a later widening could silently make a
  malformed integrate step an agent step and take lint's `integrate needs branches` message out of
  `quorum lint`'s output.

**I checked that the new test actually catches the defect**, rather than assuming it. Restoring
`id: z.string()` on `agentStepSchema` and re-running gives
`FAIL … AssertionError: the schema must accept a plain agent step with no id`, 1 failed / 26 passed.
The fix was then restored and the suite is green. A test added alongside a fix that would pass
without it is not a test, and this round is the last one the gate authorises.

---

## 4. What I deliberately left alone

- **Every other schema in the package.** `constants`, `stages`, `ticket`, `role`, `step-output`,
  `events` and `index` are untouched; no finding reaches them and the sweep in §2 found nothing.
- **`route`** — still carried untouched by passthrough, per **E-2**. Iteration 3 asked for a shape;
  three clauses of this requirement forbid inventing one and there is nothing to derive one from.
- **The event union** — still `strict`, per **E-3**, with `vendor` an open string per AC-9.
- **`consumes` / `produces`** — still plain strings, not `stageSchema`. E-1 preserves this explicitly:
  *"they are structurally strings."*
- **`fanOutStepTemplateSchema` as a separate declaration** — now identical in shape to
  `agentStepSchema`. Collapsing them is tidying I was not sent to do, and §3 records why it would be
  the wrong tidy anyway.
- **`docs/`** — nothing to correct. The DECISIONS entry already states this round's rule in this
  round's words; the code was what disagreed with it.
- **`spike/`** — read only. `git status` shows two modified files, both under `packages/shared/`,
  none under `spike/`, so the `branch-scope` freeze job is clear.
- **`docs/DECISIONS.md`** — I do not append to it; §7 names what may want an entry.

---

## 5. Criteria that require something to be stated in this report

This file is the artifact of record and is overwritten each round, so the three standing statements
are restated rather than left in a superseded copy.

**AC-1 — the dependency justification.** *zod is the only schema library whose runtime validation and
inferred TypeScript types come from one declaration, which is the entire reason for putting these
shapes in a package rather than writing interfaces.* It is the sole `dependencies` entry; `yaml` is a
devDependency used only by the corpus tests and by nothing that ships.

**AC-8 — the event disposition table.**

| What exists today | Where | Disposition |
| --- | --- | --- |
| `{type: 'spawn', vendor, cmd}` | `claude.js:31`, `codex.js:52` | member, fields verbatim |
| `{type: 'stdout', line}` | `claude.js:32`, `codex.js:60`, `mock.js:66` | member, fields verbatim |
| `{type: 'retry', vendor, attempt, of, delayMs, reason, message}` | `adapters/index.js:109` | member, fields verbatim (contract layer, not a vendor) |
| `ui.step(id, m)` / `ui.done(id, m)` | `bin/harness.js:66–67` | members `step`, `done` |
| `ui.info(m)` / `ui.warn(m)` | `bin/harness.js:64–65` | members `info`, `warn`, no step id |
| `ui.gate({kind, reason, ticketDir, retry})` | `bin/harness.js:74–127` | the **question** is a member; the answer channel is Q-0050's |
| `tool`, `text` | emitted by nothing | **not added** — needs an adapter to normalise vendor JSONL, which changes `--verbose` and enlarges Q-0047 |

**AC-11 — the spike contains no transition table.** `STAGES` is used for board column ordering
(`bin/harness.js:434`) and a hard-coded first-three subset (`:436`); transitions are the flow
directory's `consumes`/`produces` (`engine.js:38–40`, `:622–624`, `lint.js:147–181`); nothing
validates `meta.stage ∈ STAGES` at read or write. What moved is the list.

---

## 6. Stop-and-report — defects seen while reading, not fixed

Per *"The port preserves behaviour; one exception is authorised and everything else stops the child"*
(`docs/DECISIONS.md`, 2026-08-25). **Two are new this round** and both were found by doing the work
rather than by reading around it.

**New — a later run's review silently destroys an earlier run's.** `chore.yaml:34` writes
`review/chore-iter-{iter}.md`, and `ctx.vars.iter` is initialised to `1` at **run** start
(`engine.js:45`) and incremented per traversal (`:155`) — run-scoped, not ticket-scoped. Run 3's
review therefore overwrote run 2's `chore-iter-1.md`, and that review no longer exists. This ticket's
own history is the evidence (§1). It matters beyond tidiness for two reasons: `chore.yaml:13` feeds
`review/chore-iter-*.md` back to the implementer as input, so a revision round can be handed a
*mixture* of reviews from different runs of different code with nothing distinguishing them; and a
ticket that exhausts and is retried loses the record of what its first reviewer said, which is
exactly the evidence a gate needs. The material for a fix is already in the same line —
`reviewRound(ticket)` at `engine.js:45` is a ticket-scoped counter, bound to `{round}`. Not mine to
change: `spike/src` is frozen for the port, and this is a flow-file and engine question.

**New — an id-less step lints clean and then reaches the engine as `undefined`.** The premise of this
round's fix, stated as the defect it is: `lintFlow` requires an id on no step kind, and the engine
needs one — `harness/<ticket>/<step.id>` for a worktree branch (`engine.js:211`) and
`<flow>.<step.id>` for a loop counter (`engine.js:541`). A flow with an id-less agent step passes
lint and then creates a branch literally named `.../undefined`. Same class as the `steps`-less flow
below: lint accepts, the engine falls over downstream. Closing it belongs to Q-0044 (flow lint), and
closing it *here* would be the exact failure this round exists to correct.

**Carried, unchanged.** `nextId()` assumes a `T-` prefix and does not recognise the `Q-` ids in use
(`backlog.js:51`); `route` is linted (`lint.js:77`) and never implemented; `fan_out.from` and
`fan_out.by` are never read (`loadTasks` hard-codes `solution/tasks.yaml`, `fanout.js:14`);
`output.append` is documented (`02-sdlc:365`) and unimplemented; `verdict_file` and `max_turns` are
implemented and undocumented; `priority`, `repos` and `created` are written and never read;
`history[].stage` duplicates `stage_after`; a flow with no `steps` lints clean and then throws a raw
`TypeError` out of the engine (`engine.js:83`, `:115`); and `qa-final.yaml` as sketched at
`02-sdlc-pipeline-spec.md:365–374` would **fail** `lintFlow` today, since its verdict step at `:369`
carries neither `on_fail` nor `route` (for Q-0012).

---

## 7. For the gate

- **The review-overwrite defect needs a ticket, and it is not cosmetic.** It destroyed one review on
  this ticket and it feeds mixed-run reviews back into the implement step. It will do the same on the
  thirteen remaining children of Q-0009, every one of which runs this flow.
- **E-3 may still want its own DECISIONS entry**, as round 4 noted. The rule it draws — *schemas over
  files preserve unknown keys; schemas over values Quorum constructs reject them* — is inherited by
  thirteen later children, and an errata file inside one ticket folder is not where a child's
  reviewer will look for it. A decision is the human's to record, so I name it rather than write it.
- **Nothing in this round changes behaviour.** No file format, no flow semantics, no output, no gate.
  The change is one field's optionality in a package nothing imports yet.

---

## 8. Verification

| Command | Result |
| --- | --- |
| `pnpm lint` | 7 tasks successful |
| `pnpm typecheck` | 7 tasks successful |
| `pnpm test` | 7 tasks successful — `@quorum/shared` **86 tests in 9 files** (84 before this round) |
| `npm test --prefix spike` | **11 test files passed** — the freeze's witness, unchanged and green |
| new test against the restored defect | **fails** — 1 failed / 26 passed, then reverted and green |

Both halves of `harness.yaml`'s `commands.test` (`npm test --prefix spike && pnpm turbo run test`)
are green, so the `integrate` step has been run in advance in the form it will take. `git status`
shows two modified files, both under `packages/shared/`, none under `spike/`. I committed nothing.
