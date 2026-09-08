# Q-0055 — Lint requires a step id wherever the engine interpolates one

*Requirement, run 1, candidate: claude. Measured against `72510ee` on 2026-09-08. Every claim about
the tree in this document was produced by running code or enumerating files, never by reading the
ticket body; where the two disagree, §0 says so.*

**Surfaces touched:** the CLI (`quorum lint`, the `quorum run` preflight, and `quorum board`
indirectly), `packages/core/src/lint/`, `packages/shared/src/flow.ts` (comments only),
`packages/core/src/engine/diff.ts` (comment only), and `docs/02-sdlc-pipeline-spec.md`. No UI —
M3 and M4 do not exist. `harness/flows/` and the twenty template files are **not** edited: they
already satisfy the rule, which §0.2 measures.

---

## 0. Corrections to the inherited body

The ticket was corrected on 2026-09-07 for the cutover and its three re-measured sites are right.
Four further things in it are wrong or incomplete, and three of them change the shape of the work.

### 0.1 The proposed rule is under-scoped, measured

The body says the fix is *"require it on the kinds the engine interpolates it into, which is every
kind that can carry `worktree: true` or `on_fail`"*, and proposes *"probably two rules"*.

Measured, `step.id` reaches **eleven** consumers, and only two of them are gated on `worktree` or
`on_fail`:

| site | what it names | reached when |
| --- | --- | --- |
| `engine/steps.ts:200` | the worktree branch `harness/<ticket>/<id>` | `step.worktree` |
| `engine/steps.ts:238` | a run-history occurrence directory and `step_id` | **every agent step** |
| `engine/steps.ts:355,359` | the same, for a script step, plus three error messages | **every script step** |
| `engine/composite.ts:230` | the same, for an integrate step | **every integrate step** |
| `engine/composite.ts:130` | the fan-out child's default id, `` `${step.id}:{task.id}` `` | **every fan-out parent** whose template omits `id` |
| `engine/routing.ts:110` | the loop counter `<flow>.<id>` | `on_fail` with no explicit `counter` |
| `engine/routing.ts:117,133,134,141,142` | the iteration warning and both gate sentences | `on_fail` |
| `engine/engine.ts:322` | the `stepId` carried on every emitted event | every step |
| `engine/engine.ts:344` | `goto` target resolution | every step that is a target |
| `engine/composite.ts:274,347` | the `step=` field of a `runs.log` line | every integrate step |
| `lint/lint.ts` | fourteen of its sixteen messages | every step |

So the body's rule leaves an id-less plain agent step writing
`.quorum/runs/<run>/001-undefined/prompt.txt` and a manifest carrying `step_id: "undefined"`, with
no branch and no counter involved. `occurrenceDirName` (`packages/shared/src/constants.ts:76`)
replaces only `/` and `:`, so the word survives verbatim. **`composite.ts:130` is a fourth
interpolation site the body does not name at all**, and it is the worst of them: an id-less fan-out
parent gives its children the id `undefined:<task.id>`, whose default branch then carries a `:` that
git refuses as a refname (the standing defect at `composite.ts:141`, Q-0053 AC-14).

The consequence is §3's rule: **one rule, not two, keyed on the step not being a gate** — which is
both wider and cheaper than what the body proposed.

### 0.2 The gate exception is right, and now measured on both corpora rather than on one line

The body cites `chore.yaml:59` as the id-less gate. Enumerating **both** shipped corpora — six flows
in `harness/flows/` and six in `packages/cli/templates/harness/flows/` — gives 36 steps, of which:

- **24 non-gate steps, every one of which carries an id.**
- **12 gate steps, none of which carries one.**

There is no third case in either tree. So the rule refuses nothing that ships, in this repository or
in what `quorum init` scaffolds for a stranger, and the exemption is exactly one kind rather than a
list. `askGate` (`routing.ts:14–50`) was read to confirm the exemption is a property of the engine
and not an accident of the corpus: it identifies a gate by `gateId`, `kind` and `reason`, reads
`step.id` nowhere, and allocates no occurrence.

### 0.3 The linter's own messages are unusable on an id-less step — nobody had measured this

`lint.ts`'s module JSDoc says *"fourteen of the sixteen open with the step id — the token a reader
greps for in the YAML."* Run against id-less steps, that token is the word `undefined`:

```
- undefined: on_fail without goto
- undefined: has a verdict but no on_fail/route — verdicts must go somewhere
- undefined: fan_out needs a step template
- undefined: integrate needs branches
- undefined: input.diff must be two "..."-joined endpoints, … got "nonsense"
```

And with **two** id-less steps each carrying two defects, `lintFlow` reports four problems that are
pairwise identical, so a reader cannot tell which step any of them belongs to. This is an argument
for the ticket that the ticket does not make: requiring an id repairs the linter's own diagnostics,
not only the engine's branch names. It also constrains the new message — §AC-4.

### 0.4 A run lints its own flow, so this closes the defect at the gate that matters

Neither the body nor its correction says where lint sits relative to a run. Measured:
`engine/loaders.ts:19`, `loadFlow` calls `lintFlow` on every load, and `packages/cli/src/run.ts:151`
lints the **whole directory** before the flow is loaded and before any adapter is reached. So once
this rule lands, an id-less step cannot reach the engine through `quorum run` at all.

It can still reach it through `runFlow` called with a flow object — `packages/core`'s own tests do
this, and M3's server will. That is what decides AC-10.

### 0.5 What is void

The body's *"The right shape is probably two rules"* is superseded by §3. Its *Sequencing*
paragraph's surviving half — this is a behaviour change, lands against `packages/core` alone — is
correct and unchanged.

---

## 1. Problem

`lintFlow` requires an `id` on no step kind. Reproduced against `packages/core/dist/lint/lint.js`,
every kind lints clean without one:

| step, no `id` | `lintFlow` |
| --- | --- |
| plain agent | `true` |
| agent with `worktree: true` | `true` |
| script | `true` |
| integrate | `true` |
| fan-out | `true` |
| `parallel` member | `true` |
| agent with `on_fail` | `true` |
| gate | `true` — **correct, and the only correct one** |

The engine then interpolates the literal string `undefined` into the eleven consumers of §0.1. A
`maintainer` gets a worktree on `harness/Q-0123/undefined`, a loop counter named
`chore.undefined`, and a run-history directory `001-undefined` — none of which is an error, and all
of which are silently wrong. An `adopter` writing their first flow file is exactly the person who
omits an id, and the linter that exists to catch it instead reports a clean flow and then produces
a branch named after a JavaScript primitive.

This is the class `quorum lint` exists to prevent, and it is worse than the defects it does catch,
because the other sixteen stop the run.

---

## 2. User stories

**`maintainer`.** *As a solo maintainer, I want `quorum lint` to refuse a flow whose step the engine
cannot name, so that a defect I would otherwise meet as a strangely-named branch three steps into a
paid run is one the linter tells me about in under a second, before anything is billed.*

**`adopter`.** *As a cold-clone adopter writing my first flow, I want the linter to tell me which
step is missing an id and where to find it in the file, so that my first thirty minutes end in a
merged branch rather than in a `harness/T-0001/undefined` I have to work out for myself.*

**`contributor`.** *As a contributor adding a flow template, I want one stated rule about which
steps need ids — and one stated exception — so that I do not have to read the engine to find out
which of my steps the linter will accept.*

---

## 3. The rule, stated once

> **Every step that is not a gate must carry an id. A gate step must not be required to.**
>
> "Carries an id" means what `lint.ts:171` already means by it: `step.id` is truthy. "Is a gate"
> means what `lint.ts:250` already means by it: `step.gate` is truthy.

Three properties follow, and each is deliberate:

1. **One rule, one predicate.** No enumeration of kinds, no `worktree`/`on_fail` conditions. A step
   kind added later is covered by default and must opt out explicitly, which is the safe direction:
   §0.1 shows that a rule enumerating conditions had already missed two of five interpolation sites
   at the moment the ticket was written.
2. **Presence, not type.** `id: 42` still lints clean. The linter type-checks nothing anywhere else
   (`lint.test.ts:1013`), and a type rule here would be `packages/shared`'s rule arriving through
   the linter — the failure the 2026-08-25 zod boundary exists to prevent. Truthiness is also what
   keeps five of the six type-divergence rows intact; see AC-8 and Appendix A.3.
3. **The definitions are shared, not restated.** Both predicates are the ones already in the file.
   If the new rule spelled "has an id" differently from the duplicate-id filter, the two rules
   would disagree about the same step, and nothing would notice.

Refused by the rule, therefore: `id` absent, `id: ''`, `id: null`, `id: 0`, and a step that is not
an object at all (`steps: ['a-string']`, `steps: [42]`) — all of which lint clean today.

---

## 4. Acceptance criteria

*Every `Test:` below was written against code that was executed, not against the requirement's own
intent (Q-0049's lesson). Each is independently testable.*

**AC-1 — the rule.** `lintFlow` reports a problem for every step in the flattened step list whose
`id` is falsy and whose `gate` is falsy. The two truthiness tests are the ones already used at
`lint.ts:171` and `lint.ts:250`; neither is re-spelled.
*Test:* the six `ID_LESS_CASES` rows of `lint.test.ts` — agent, `parallel` member, script,
integrate, fan-out, gate — now split five refusals against one acceptance.

**AC-2 — the gate exemption.** A gate step with no id lints clean, in isolation and beside a refused
id-less step. `gate: 42` is a gate for this rule, because it is one for the deploy-gate rule.
*Test:* `{ gate: 'human', reason: 'approve' }` and `{ gate: 42 }` each lint clean as the only step;
a flow holding one id-less gate and one id-less agent step reports **exactly one** problem, and it
names the agent step.

**AC-3 — the fan-out template stays exempt.** A `fan_out` step's `step:` template is not required to
carry an id. `flattenSteps` does not descend into it (`lint.ts:62–67`) and must not start to;
`composite.ts:130` supplies the child's id from the parent's, which is why the parent needs one and
the template does not.
*Test:* `{ id: 'devs', fan_out: {...}, step: { role: 'r' } }` lints clean; the same with the
parent's `id` removed reports one problem, and that problem names the parent.

**AC-4 — the message locates a step it cannot name by id.** The seventeenth message must convey
three things and may use no fourth: **where the step is in the file**, **what kind it is**, and
**that an id is what is missing**. It may not open with the token `undefined`. The locator is a path
into the flow file as written — the index in `flow.steps`, and for a `parallel` member the index of
its group plus its index within it — because that is what a reader greps and what M4's flow editor
will need to place a marker.
The exact bytes are the implementer's to choose within those constraints and are then pinned by
AC-5's register. *A requirement describes what must be conveyed; only a fixture, a frozen contract's
own file, or a criterion quoting bytes pins bytes* (Q-0094 E-3). A form that satisfies this, offered
as an illustration and not as a contract: `steps[3] (integrate): needs an id — the engine names a
branch, a loop counter and a run-history occurrence after it`.
*Test:* the message for a top-level step and for a `parallel` member each locate their step
distinguishably; a flow with two id-less steps produces two **different** messages; no message in
the file's output contains `undefined:` for a step whose only defect is the missing id.

**AC-5 — the change is additive to the other sixteen.** Every existing message keeps its exact text,
and their relative order among themselves is unchanged for any flow whose steps all carry ids. The
`AC-2` register in `lint.test.ts:70` is retitled to seventeen and gains one row.
*Test:* the sixteen verbatim assertions pass unedited; both shipped corpora still lint clean, all
twelve files, through `lintFlowDirectory`.

**AC-6 — an id-less step still reports its other defects.** A step missing both its id and its
`branches` reports **two** problems, and the second keeps its existing `undefined: integrate needs
branches` wording. The fourteen id-prefixed messages are not given positional fallbacks; the id
problem sits in the same report and is what explains the prefix.
*Test:* `{ type: 'integrate' }` as the only step yields exactly two problems, one of them the
frozen `undefined: integrate needs branches`.

**AC-7 — the schema does not follow.** All five `id: z.string().optional()` declarations in
`packages/shared/src/flow.ts` stay optional. A presence rule is the linter's under *"Zod describes
structure and types; the flow lint keeps the semantics"* (2026-08-25), and requiring it in zod would
additionally force `agentStepFields` to be split, since the fan-out template shares that shape and
keeps its id optional (AC-3).
What changes is prose: the PRESENCE block at `flow.ts:186–191` and the four sibling comments at
`:226`, `:237`, `:280`, `:286` each state *"lint requires an id on no step kind"*, which becomes
false. Each is corrected to say why the key stays optional now — because presence is lint's — and
cites this ticket.
*Test:* the schema accepts all six `ID_LESS_CASES` flows unchanged, including the five the linter
now refuses; no `flow.ts` comment asserts that lint requires an id on no kind.

**AC-8 — the divergence register gains its third boundary, and one row moves.** `lint.test.ts`'s
`Q-0041 AC-3 as errata E-1 amends it` block currently draws two boundaries: *lint accepts / schema
accepts* (presence) and *lint accepts / schema rejects* (types). This rule creates a third — *lint
refuses / schema accepts* — which E-1 permits: its property is that **lint succeeding implies the
schema requires no absent key**, and a rule the linter has and the schema does not leaves it intact.
Three consequences, each of which must be recorded rather than absorbed:
  (a) five of the six `ID_LESS_CASES` rows flip to `lintAccepts === false` while their schema
      assertion is kept unchanged; the gate row is unmoved.
  (b) the `semantic` list in *"no zod issue replaces a lint message"* gains a tenth row for the id
      rule, and `flow.ts:101`'s *"nine flows this schema accepts and lint refuses"* becomes ten.
  (c) **`TYPE_DIVERGENCE_CASES` loses exactly one of its six rows** — `steps: ['just-a-string']`,
      which the linter now refuses on presence and the schema still refuses on type. It moves rather
      than disappearing, with prose saying the two rules agree by coincidence and for different
      reasons. Verified by execution that the other five rows are untouched, `{ id: 42 }` among
      them, which is what truthiness buys (§3.2).
*Test:* the three registers each assert their own boundary and name it; removing the id rule turns
the new boundary's block red rather than silently emptying it.

**AC-9 — the counts move.** `lint.ts`'s module JSDoc says *"the sixteen per-flow diagnostics"* and
*"fourteen of the sixteen open with the step id"*. They become seventeen and *fourteen of the
seventeen* — the new message is one of the three that does not open with an id, which is AC-4's
whole point and is worth saying in that sentence rather than leaving the arithmetic to a reader.
*Test:* the register in AC-5 has seventeen entries and the JSDoc's two numbers agree with it.

**AC-10 — the engine keeps its defensive rendering, and its comment stops being false.**
`engine/diff.ts:465–467` says the absent id is rendered two ways *"which lint does not yet refuse;
see Q-0055"*. After this lands that clause is false, and the code is still reachable: `runFlow`
takes a flow object, and only `loadFlow` and the `quorum run` preflight lint (§0.4).
The code is **kept** and the comment rewritten. Deleting it would make the engine's correctness
depend on a caller having linted, which contradicts *"Safety is enforced in `core`, never by
convention"* (`harness/rules.md`), and M3's server is the caller that will make that concrete.
*Test:* `diff.ts` carries no claim that lint permits an id-less step; the two renderings
(`undefined` for the branch, `null` for the quoted producer) are still distinguishable and still
covered.

**AC-11 — the preserved-defect pin is inverted, not deleted.** `lint.test.ts:970`'s *"5 — lint
requires an `id` on no step kind, so an id-less step lints clean"* is the pin recording this defect.
It is rewritten to assert the **refusal**, keeping the gate row as the acceptance, so a regression
fails a check rather than passing an absent one — the Q-0037 AC-4h shape. Its neighbours in the
`AC-12 — FlowError, and the nine preserved defects` block are untouched, and the block's own count
of preserved defects is corrected if the implementer's edit changes it.
*Test:* restoring `lintFlow`'s pre-change body turns this test red with a message naming the id
rule, demonstrated before the fix is trusted.

**AC-12 — the two CLI surfaces report it, and neither contract moves.** `quorum lint` prints the new
problem indented under its file's `✗` line through the existing `renderFlowReport`, and exits 1. The
`quorum run` preflight (`run.ts:151`) prints the same block for the same defect and exits 1 before
any project state is read or any adapter is reached. No exit code, no colour and no marker changes.
*Test:* through the **built binary**, not in process: a flows directory holding one id-less step
gives `quorum lint` exit 1 with the message under the right filename, and `quorum run <flow>
<ticket>` exit 1 with byte-identical output and no run directory created.

**AC-13 — every new clause is demonstrated red before it is trusted.** Each behavioural clause of
AC-1 to AC-4 and AC-8 is shown failing against the pre-change linter on its own, not collectively —
*showing a guard has a subject proves the guard fires, not that each of its clauses does* (Q-0071).
The implement report records which mutation produced which failure.
*Test:* the report names, per clause, the mutation and the resulting message.

**AC-14 — the spec gains the rule.** `docs/02-sdlc-pipeline-spec.md` §4's table gains one row for
the id rule beside the `cross_vendor: required` row, and §5's preamble or the same table states the
gate exception. The status line at the top is bumped with the date and what changed, per the docs
rule. §5.1–§5.5 are byte-identical copies of the shipped files and **must not** move: no flow file
changes (§0.2), so `docs.test.ts` stays green by construction.
*Test:* `packages/shared/src/docs.test.ts` passes; the §5 snippet check is untouched.

---

## 5. Non-goals

1. **The gate step is not given an id**, in either corpus or in the schema. Twelve of twelve shipped
   gates are id-less and the engine never asks one for an id.
2. **The fan-out `step:` template is not required to carry one** (AC-3), and `flattenSteps` is not
   made to descend into it — that would silently subject the template to the duplicate-id, `goto`
   and cross-vendor rules, which `lint.ts:62–67` deliberately excludes it from.
3. **The id is not type-checked.** `id: 42` keeps linting clean; that refusal is the schema's and is
   already asserted.
4. **The fourteen id-prefixed messages are not given positional fallbacks.** Cost measured: fourteen
   frozen strings rewritten and their register re-pinned, to improve a case that can now only occur
   alongside the id problem itself. AC-6 states the accepted consequence.
5. **The `steps`-less flow is not fixed here**, though the body names it as *"the same class"*. It
   is: `flattenSteps(steps = [])` defaults the key away, so a flow with no steps lints clean and the
   engine throws a raw `TypeError`. It is a second rule with its own message, and closing it flips
   two `PRESENCE_CASES` rows and one schema comment. See OQ-1 — folding it in is a gate decision,
   not an implementer's.
6. **`composite.ts:141`'s branch defect is not closed.** A fan-out template omitting `branch:`
   records one branch name and cuts a worktree under another (Q-0053 AC-14). This ticket makes the
   `undefined:` half of that name impossible and leaves the defect and its authority line alone.
7. **The board's silence is registered, not repaired.** `board.ts:66`'s `flowsIn` drops any record
   with no `flow`, so a flow that fails lint disappears from the board's runnable-flow index and its
   `→ quorum run …` hint vanishes with no explanation. That is pre-existing behaviour for all
   sixteen rules; this adds a seventeenth way to reach it. Reported, not fixed, and it wants its own
   ticket.
8. **No `route` work.** Q-0056 owns `route`'s three incompatible descriptions and the qa-final
   sketch that cannot lint.
9. **No whitespace-grammar change.** `lint.test.ts:354` names Q-0055 and Q-0056 as tickets where
   tightening `harness/{id}/integration ` would belong. It does not belong here; that citation is
   corrected to name Q-0056 alone.

---

## 6. Open questions

**OQ-1 (for the gate; not blocking) — does the `steps`-less rule fold in?**
Sized rather than described: one clause, one message, two `PRESENCE_CASES` rows flipped, one
`flow.ts` comment corrected. Against that, a separate ticket costs a requirements run and a chore
run over the same file — roughly what Q-0108 measured as *the gate costing more than the work*. My
recommendation is **fold it in only if the human says so at the gate**, and open a successor
otherwise; an implementer may not widen its own scope, and `developer-generalist` is told in as many
words to stop and report rather than choose. Whichever way it goes, decide it at the gate — an
obligation recorded only in this document's prose is the drift this repository has now found seven
directions of.

**OQ-2 (implementer's, within AC-4) — the message's exact bytes.** Deliberately unpinned, per
Q-0094 E-3. What is pinned is what it must convey.

**OQ-3 (settled here, recorded so it is not re-litigated) — does the schema require the id?**
No. AC-7 gives the two reasons. Raised because the obvious reading of *"lint and the schema should
agree"* points the other way, and E-1's property does not forbid it — it is decision 048 and the
shared `agentStepFields` shape that do.

**OQ-4 (settled here) — `id: ''`, `id: 0`, `id: 42`, `steps: ['a-string']`.** Truthiness: the first
three cases are refused for the first two values and accepted for `42`, and the bare string is
refused. Measured consequences in Appendix A.3.

**OQ-5 (for the gate; blocking if answered the other way) — is a decision entry owed?**
My answer is **no**, and it rests on a measurement rather than on taste. The apparent obstacle is
`validDiffRange`'s JSDoc, which frames the linter as restating the engine — *"a flow the engine
would accept must pass here"* — and this rule adds something the engine has no counterpart for.
Measured, that frame is local to the diff rule and is not a property this repository holds:
`grep cross_vendor packages/core/src/engine/` returns **nothing**, so the two cross-vendor rules are
lint-only, and the engine never requires a deploy flow to contain a `human-locked` gate either. The
linter already carries three rules with no engine counterpart; this is a fourth of the same kind and
contradicts no landed entry. The authority therefore belongs in the check's own comment, which is
the Q-0108 precedent.
**If the gate rules otherwise, the entry must land before the implement step starts, not during the
loop.** That is GO-2, and it is the failure Q-0062 paid three rounds for after its own requirement
had named the hazard in advance.

---

## 7. Risks

**R-1 — an adopter's flow that linted clean now fails.** This is the intended breaking change and
the only one. Both shipped corpora are clean (§0.2), but neither is an adopter's. The mitigation is
AC-4: the message must be good enough that the fix is obvious from reading it. There is no migration
path and none is wanted — a flow this rule refuses was producing `harness/<id>/undefined`.

**R-2 — the deliverable is a diagnostic, and a diagnostic cannot be established by reading it.**
Three review rounds were spent on exactly this on Q-0050. AC-13 is the countermeasure and is not
optional.

**R-3 — four registers, and missing one leaves it asserting a linter that no longer exists.**
`lint.test.ts` is 1,222 lines and this change touches the AC-2 verbatim register, the AC-12
preserved-defect pin, `ID_LESS_CASES`, `TYPE_DIVERGENCE_CASES` and the `semantic` list, plus two
counts in `lint.ts`'s JSDoc and one in `flow.ts`. A register left behind reads as coverage.

**R-4 — scope creep into the fourteen frozen messages.** AC-6 and non-goal 4 exist to bound it. An
implementer who finds `undefined: integrate needs branches` unsatisfying should report it, not fix
it.

**R-5 — the `not a gate` predicate is a default-on rule.** A future step kind is required to have an
id whether or not it needs one, and must opt out deliberately. That is the direction chosen, and
§0.1 is the evidence for choosing it: the enumerating alternative had already missed two of five
sites before anyone wrote a line.

**R-6 — no new turbo input is earned, and that should be checked rather than assumed.**
`packages/core/turbo.json` already declares `../../harness/flows/*.yaml` and
`../../packages/cli/templates/harness/flows/*.yaml`, so no registration is owed **if** the change
adds no new read. If it adds one, `turbo-inputs.test.ts` will refuse it, which is the machinery
working as designed rather than an obstacle.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, no credential, no `check()` path is touched. |
| **Worktree safety** | Improved, and this is the point: the branch `harness/<id>/undefined` becomes unreachable through `quorum run`. Nothing new is written to a user's tree. |
| **Gate behaviour** | Unchanged. `askGate` reads no step id; the gate step's exemption is what AC-2 protects. |
| **File format and its schema** | The flow file format gains one presence rule. `flowSchema` is unchanged in structure and corrected in prose (AC-7). No flow file moves, so §5's byte-identical snippets are untouched. |
| **Lint rules** | Sixteen become seventeen; the four cross-flow rules are unchanged. |
| **Cold-clone impact** | Net positive and measured. All twenty scaffolded template files satisfy the rule, so a stranger's first `quorum lint` still prints six ticks; the first thirty minutes get longer only for someone who writes a flow and omits an id, which is the case this improves. |
| **Product-agnostic** | n/a. |
| **Files are the database** | n/a. Nothing persistent changes. |
| **Errors are explicit** | Directly served. A silent default — the string `undefined` — becomes an explicit refusal. |

---

## 9. Gate obligations

*Work no step on the chore route may perform. `developer-generalist`'s paths cover `packages`,
`docs` and `harness` but explicitly exclude `docs/decisions/` and the backlog.*

**GO-1.** Rule OQ-1 — fold the `steps`-less rule in, or open its successor — **at the gate**. If it
folds in, this document gains AC-15 and AC-16 at the gate; an implementer may not add them.

**GO-2.** Ratify OQ-5. If the gate decides an entry **is** owed, it must be written and landed
**before** the implement step is launched. Do not launch with an unwritten entry: that is the
pattern this repository has now recorded sixteen times, and Q-0062 is the case where the requirement
named the hazard in advance and the run was launched anyway, costing three rounds.

**GO-3.** After the merge, verify forced in **both** environment rows — in the integration worktree,
which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` — per Q-0072's
closing finding. AC-12 is verified through the built binary in the second row.

**GO-4.** Correct this ticket's plan bullet in `docs/06-development-plan.md` to what shipped. The
bullet currently reproduces the body's two-rule shape and its `spike/` line numbers, and §0.1
disproves the first.

**GO-5.** Open the successor for non-goal 7 — a flow that fails lint vanishes from `quorum board`'s
runnable-flow index with no explanation — or record at the gate that it is accepted. Do not leave it
in this document's prose.

---

## Appendix A — the measurements, and how to reproduce them

All at `72510ee`, 2026-09-08.

**A.1 — the id-less table (§1).** `packages/core/dist/lint/lint.js` imported into a plain node
process, one flow per kind, each carrying whatever else its kind needs to lint clean. Eight rows,
eight `true`. The two rows the ticket body does not have — *agent with `worktree: true`* and *agent
with `on_fail`* — are the two that matter, because they are the ones the body's proposed rule would
have covered and are proof that the current linter covers neither.

**A.2 — the corpora (§0.2).** Both flow directories parsed with `yaml`, `parallel` groups
flattened, each step classified by kind. 36 steps: 24 non-gate, all with ids; 12 gates, none with
one. `development.yaml`'s fan-out template carries both `id: "dev:{task.id}"` and
`branch: "harness/{id}/{task.id}"`, so `composite.ts:130`'s default is exercised by no shipped flow
— which is why the site went unnoticed.

**A.3 — what truthiness costs and buys (OQ-4, AC-8c).** Run against the current linter, all of these
lint clean today:

| flow | today | under the rule | register |
| --- | --- | --- | --- |
| `steps: [{ id: 42 }]` | clean | **still clean** | stays in `TYPE_DIVERGENCE_CASES` |
| `steps: [{ id: '' }]` | clean | refused | new |
| `steps: [{ id: 0 }]` | clean | refused | new |
| `steps: [{ id: null, role: 'r' }]` | clean | refused | new |
| `steps: [{ gate: 42 }]` | clean | **still clean** | stays in `TYPE_DIVERGENCE_CASES` |
| `steps: ['just-a-string']` | clean | refused | **moves out of `TYPE_DIVERGENCE_CASES`** |
| `steps: [42]` | clean | refused | new |

A `typeof === 'string'` rule would have moved three of the six type rows instead of one. That is the
measurement behind §3.2.

**A.4 — the lint messages on an id-less step (§0.3).** Five single-defect flows and one two-step
flow, run through `lintFlow`; every message opens `undefined:` and the two-step flow's four problems
are pairwise identical.

**A.5 — lint runs before every run (§0.4).** `engine/loaders.ts:19` and
`packages/cli/src/run.ts:151`, read rather than inferred.

**A.6 — the linter already adds rules the engine does not have (OQ-5).**
`grep -rn "cross_vendor" packages/core/src/engine/*.ts` returns three comment lines and no code;
`human-locked` appears in `routing.ts` only as a gate kind the engine honours, never as one it
requires a flow to contain.
