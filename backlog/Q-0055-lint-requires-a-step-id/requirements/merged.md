# Q-0055 — Lint requires a step id wherever the engine interpolates one

*Merged requirement, run 1, iteration 1. Measured against `72510ee` on 2026-09-08. Every claim about
the tree below was produced by running code or enumerating files. Where a candidate, the ticket body
or a source comment disagrees with a measurement here, §0 says so and this document is the one that
was re-derived.*

**Surfaces touched:** `packages/core/src/lint/` (the rule and its tests),
`packages/shared/src/flow.ts` (comments only), `packages/core/src/engine/diff.ts` (comment only),
`docs/02-sdlc-pipeline-spec.md`, and the two CLI surfaces that already print lint output. **No flow
file changes** in either corpus — §0.2 measures why — so `docs.test.ts`'s byte-identical §5 snippets
are untouched by construction. No UI: M3 and M4 do not exist.

---

## 0. Corrections to what was inherited

The ticket's 2026-09-07 cutover correction is sound and its three re-measured sites are right. Five
further things — three in the ticket body, one in each candidate — are wrong or missing, and three of
them change the shape of the work.

### 0.1 The body's proposed rule is under-scoped, and the site it misses is the worst one

The body says the fix is *"require it on the kinds the engine interpolates it into, which is every
kind that can carry `worktree: true` or `on_fail`"*, and proposes *"probably two rules"*. Measured,
`step.id` reaches these consumers, and only two are gated on `worktree` or `on_fail`:

| site | what it names | reached when |
| --- | --- | --- |
| `engine/steps.ts:187` | `const stepId = String(step.id)` — the value every site below reads | **every agent step** |
| `engine/steps.ts:200` | the worktree branch `harness/<ticket>/<id>` | `step.worktree` |
| `engine/steps.ts:238` | the run-history occurrence directory and its `step_id` | **every agent step** |
| `engine/steps.ts:233,250,262` | the `stepId` carried on every emitted event | **every agent step** |
| `engine/steps.ts:312` | the default `verdict_file` name | every step declaring a verdict |
| `engine/composite.ts:130` | **the fan-out child's default id, `` `${step.id}:{task.id}` ``** | **every fan-out parent** whose template omits `id` |
| `engine/routing.ts:110` | the loop counter `<flow>.<id>` | `on_fail` with no explicit `counter` |
| `engine/routing.ts:116,133,141` | the iteration warning and both gate sentences | `on_fail` |
| `lint/lint.ts` | fourteen of its sixteen messages | every step |

Two consequences the body does not have. An id-less **plain agent step** — no worktree, no `on_fail`
— still writes `.quorum/runs/<run>/steps/001-undefined/` and a manifest carrying
`step_id: "undefined"`; `occurrenceDirName` (`packages/shared/src/constants.ts:76`) replaces only `/`
and `:`, so the word survives verbatim. And **`composite.ts:130` is a site named nowhere in the
ticket, in its correction, or in the codex candidate**: an id-less fan-out parent gives its children
the id `undefined:<task.id>`, whose default branch then carries a `:` that git refuses as a refname —
the standing defect pinned at `composite.ts:141` under Q-0053 AC-14.

So the body's two-rule shape leaves three of these open. §3's single rule is both wider and cheaper.
*(From the claude candidate's §0.1, extended with `steps.ts:187`, `:312` and the verdict-file site.)*

### 0.2 The gate exception holds — and the corpus figure both this document's sources carried is wrong

The claude candidate reports *"36 steps, of which 24 non-gate and 12 gates"*. Re-enumerated by
parsing both shipped corpora and flattening `parallel` groups exactly as `flattenSteps` does:

| corpus | files | steps | gates (all id-less) | non-gate (all with ids) |
| --- | --- | --- | --- | --- |
| `harness/flows/` | 6 | 26 | 6 | 20 |
| `packages/cli/templates/harness/flows/` | 6 | 26 | 6 | 20 |
| **both** | **12** | **52** | **12** | **40** |

Per file, one corpus: `chore` 4 (1 gate), `development` 3 (1), `qa-red` 5 (1), `requirements` 4 (1),
`review` 4 (1), `solutioning` 6 (1). There is no third case in either tree, so the rule refuses
nothing that ships here or that `quorum init` scaffolds for a stranger, and the exemption is exactly
one kind rather than a list. The conclusion is unchanged; the count is corrected because a figure
that enters a durable record wrong is re-derived by the next reader against the wrong number.

`askGate` (`routing.ts:14–50`) was read to confirm the exemption is a property of the engine and not
an accident of the corpus: it identifies a gate by `gateId`, `kind` and `reason`, reads `step.id`
nowhere, and allocates no occurrence.

**The one shipped fan-out template carries its own `id`** (`development.yaml`), so
`composite.ts:130`'s default is exercised by no shipped flow — which is why §0.1's worst site went
unnoticed for so long.

### 0.3 Both candidates' schema arguments are structurally wrong, in opposite directions

This is the one place the candidates materially disagree — codex AC-12 makes `id` **required** in
`packages/shared/src/flow.ts`; claude AC-7 keeps it **optional** — and each defends its position with
a claim about the file that is false:

- **Claude AC-7:** *"requiring it in zod would additionally force `agentStepFields` to be split,
  since the fan-out template shares that shape and keeps its id optional."* False.
  `agentStepFields` (`flow.ts:149`) does **not** contain `id`; `agentStepSchema` (`:194`) and
  `fanOutStepTemplateSchema` (`:280`) each declare their own. No split would be needed.
- **Codex risk 3:** *"Reusing that schema for the fan-out template would also require a template
  id."* Also false, and for the same reason: `fanOutStepTemplateSchema` does not reuse
  `agentStepSchema`, and `flow.ts:270–278` says in as many words that keeping it a declaration of
  its own rather than an alias is deliberate.

What *is* true, and is what a required `id` would actually do: `parallelGroupSchema` (`:201`) types
its members as `agentStepSchema`, so members would inherit the requirement — which is what codex
wants — while the fan-out template would be untouched. So the mechanical objection to codex AC-12
does not exist. The ruling in §AC-7 rests on three other things instead, and they are stronger.
**Do not re-derive this from either candidate.**

### 0.4 The linter's own messages are unusable on an id-less step

`lint.ts`'s module JSDoc says *"fourteen of the sixteen open with the step id — the token a reader
greps for in the YAML."* Run against id-less steps, that token is the word `undefined`:

```
- undefined: on_fail without goto
- undefined: has a verdict but no on_fail/route — verdicts must go somewhere
- undefined: fan_out needs a step template
- undefined: integrate needs branches
- undefined: input.diff must be two "..."-joined endpoints, … got "nonsense"
```

With **two** id-less steps each carrying two defects, `lintFlow` reports four problems that are
pairwise identical, so a reader cannot tell which step any of them belongs to. This is an argument
for the ticket that the ticket does not make: requiring an id repairs the linter's own diagnostics,
not only the engine's branch names. It also constrains the new message — AC-4. *(Claude's §0.3.)*

**A fifth rendering site neither candidate names:** `diffSites` labels a diff problem with
`view.id` and a fan-out template's with `` `${view.id}.step` `` (`lint.ts:149,151`), so an id-less
step's range problem reads `undefined:` and `undefined.step:` too. AC-6 preserves both.

### 0.5 A run lints its own flow, which is what decides AC-10

Neither candidate's problem statement says where lint sits relative to a run. Measured:
`engine/loaders.ts:19`, `loadFlow` calls `lintFlow` on every load; `packages/cli/src/run.ts:151`
lints the **whole directory** before the flow is loaded and before any project state is read. So once
this rule lands, an id-less step cannot reach the engine through `quorum run` at all.

It can still reach it through `runFlow` called with a flow object — `packages/core`'s own tests do
this, and M3's server will. **`flowSchema` is on neither path**: `loadFlow` casts (`as Flow`) and
never parses, and `lint.source.test.ts:107` forbids `lint.ts` from importing zod or naming
`flowSchema` at all.

### 0.6 What is void

The body's *"The right shape is probably two rules"* is superseded by §3. The *Sequencing*
paragraph's surviving half — this is a behaviour change, so it could not go into Q-0044, and it lands
against `packages/core` alone — is correct and unchanged.

---

## 1. Problem

`lintFlow` requires an `id` on no step kind. Reproduced against the built linter, every kind lints
clean without one:

| step, no `id` | `lintFlow` |
| --- | --- |
| plain agent | `true` |
| agent with `worktree: true` | `true` |
| agent with `on_fail` | `true` |
| script | `true` |
| integrate | `true` |
| fan-out parent | `true` |
| `parallel` member | `true` |
| gate | `true` — **correct, and the only correct one** |

The engine then interpolates the literal string `undefined` into every consumer in §0.1. A maintainer
gets a worktree on `harness/Q-0123/undefined`, a loop counter named `chore.undefined`, a run-history
directory `steps/001-undefined`, and — through a fan-out — a child id `undefined:T1` whose default
branch git refuses. None of these is an error and all of them are silently wrong.

This is the class `quorum lint` exists to prevent, and it is worse than the sixteen defects it does
catch, because those stop the run. An adopter writing their first flow file is exactly the person who
omits an id, and `harness/T-0001/undefined` is a poor thirty-minute experience.

---

## 2. User stories

**`maintainer`.** *As a solo maintainer, I want `quorum lint` to refuse a flow whose step the engine
cannot name, so that a defect I would otherwise meet as a strangely-named branch three steps into a
paid run is one the linter tells me about in under a second, before anything is billed.*

**`adopter`.** *As a cold-clone adopter writing my first flow, I want the linter to tell me which step
is missing an id and where to find it in the file, so that my first thirty minutes end in a merged
branch rather than in a `harness/T-0001/undefined` I have to work out for myself.*

**`contributor`.** *As a contributor adding a flow template, I want one stated rule about which steps
need ids — and one stated exception — so that I do not have to read the engine to find out which of
my steps the linter will accept.*

---

## 3. The rule, stated once

> **Every step that is not a gate must carry a usable id. A gate step must not be required to.**
>
> **"Is a gate"** means what `lint.ts:250` already means by it: `step.gate` is truthy.
> **"Carries a usable id"** means `step.id` is truthy, and additionally — where it is a string — not
> blank after `trim()`.

Three properties follow, each deliberate:

1. **One rule, one predicate.** No enumeration of kinds, no `worktree`/`on_fail` conditions. A step
   kind added later is covered by default and must opt out explicitly, which is the safe direction:
   §0.1 shows a rule enumerating conditions had already missed three of nine interpolation sites at
   the moment the ticket was written, including the one that produces an unusable refname.
2. **Presence and blankness, not type.** `id: 42` still lints clean; that refusal is the schema's and
   is already asserted. A `typeof === 'string'` rule here would be `packages/shared`'s rule arriving
   through the linter — the failure the 2026-08-25 zod boundary exists to prevent — and its measured
   cost is three of the six type-divergence rows rather than one (Appendix A.3).
3. **The blank clause has a precedent one screen up, in this file.** `lint.ts:187` already refuses a
   counter with `(typeof counter !== 'string' || !counter.trim())`. A blank id names the branch
   `harness/<ticket>/   `, which git refuses as a refname, so the same test earns its place. This is
   what settles the codex candidate's one blocking question **and the half of it that was not asked**
   — see OQ-1.

Refused by the rule, therefore: `id` absent, `id: ''`, `id: '   '`, `id: null`, `id: 0`, and a step
that is not an object at all (`steps: ['a-string']`, `steps: [42]`) — all of which lint clean today.
Unchanged: `steps: null` and `steps: [null]`, which still throw a raw `TypeError` out of
`flattenSteps` before any rule runs (preserved defect 4).

---

## 4. Acceptance criteria

*Each is independently testable. Every `Test:` was written against code that was executed.*

**AC-1 — the rule.** `lintFlow` reports a problem for every step whose `gate` is falsy and whose `id`
fails §3's usable-id test. The gate predicate is the one already at `lint.ts:250` and is not
re-spelled; if the usable-id test is factored, the duplicate-id filter at `lint.ts:171` continues to
use truthiness and the two are not silently unified.
*Test:* the six `ID_LESS_CASES` rows — agent, `parallel` member, script, integrate, fan-out parent,
gate — split five refusals against one acceptance; `id: ''`, `id: '   '`, `id: 0`, `id: null`,
`steps: ['a-string']` and `steps: [42]` are each refused as their own row.

**AC-2 — the gate exemption.** A gate step with no id lints clean, alone and beside a refused id-less
step. `gate: 42` is a gate for this rule, because it is one for the deploy-gate rule.
*Test:* `{ gate: 'human', reason: 'approve' }` and `{ gate: 42 }` each lint clean as the only step; a
flow holding one id-less gate and one id-less agent step reports **exactly one** problem, and it
locates the agent step.

**AC-3 — the fan-out template stays exempt.** A `fan_out` step's `step:` template is not required to
carry an id, and `flattenSteps` does not begin descending into it.
*Test:* `{ id: 'devs', fan_out: {…}, step: { role: 'r' } }` lints clean; removing the **parent's**
`id` reports one problem locating the parent; the template's own id-lessness never produces one.

**AC-4 — the diagnostic locates a step it cannot name by id.** The seventeenth message must convey
three things: **where the step is in the file**, **that an id is what is missing**, and nothing that
renders the absent value — it may not contain the token `undefined` or `null` for the missing id.
The locator grammar is pinned, because two id-less steps must be distinguishable and M4's flow editor
will place a marker from it:

- a top-level step is located by its **one-based position in the flow's own `steps` list**;
- a `parallel` member is located by its group's one-based top-level position **and** its own
  one-based position within that group.

The locator is therefore derived from the flow's `steps` array and **not** from `flattenSteps`, which
erases the enclosing group's position. The exact bytes around that grammar are the implementer's,
per *a requirement describes what must be conveyed; only a fixture, a frozen contract's own file, or
a criterion quoting bytes pins bytes* (Q-0094 E-3). Two forms satisfying it, offered as illustration
and not as contract: `step 3: id is required` and
`step 2, parallel member 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it`.
*Test:* a top-level step and a `parallel` member each locate distinguishably; a flow with two id-less
steps produces two **different** messages; neither contains `undefined` or `null`.

**AC-5 — additive to the sixteen, and deterministic.** New problems join the existing accumulated
`FlowError` in deterministic flow order; lint does not stop at the first missing id. Every existing
message keeps its exact text, and their relative order among themselves is unchanged for any flow
whose steps all carry ids. `lint.test.ts:70`'s verbatim register is retitled to seventeen and gains
one row.
*Test:* the sixteen verbatim assertions pass unedited; all **twelve** shipped files across both
corpora still lint clean through `lintFlowDirectory` (§0.2's 52 steps).

**AC-6 — an id-less step still reports its other defects, unchanged.** The fourteen id-prefixed
messages are **not** given positional fallbacks: an id-less step's other problems keep rendering
`undefined`, and the id problem in the same report is what explains the prefix.
*Test:* `{ type: 'integrate' }` as the only step yields exactly two problems, one of them the frozen
`undefined: integrate needs branches`; an id-less step with a bad `input.diff` still produces the
`undefined:` range message (§0.4's fifth site) beside its id problem.

**AC-7 — the schema does not follow.** All five `id: z.string().optional()` declarations in
`packages/shared/src/flow.ts` stay optional. What changes is prose: the PRESENCE block's third case
(`flow.ts:60–66`), its *"cost of the third case"* paragraph naming `engine.js:211` and `:541`, and
the four sibling comments at `:189`, `:225`, `:236`, `:285`, each of which asserts *"lint requires an
id on no step kind"* and becomes false. Each is corrected to say why the key stays optional **now** —
because presence is lint's — and cites this ticket.
Three reasons, replacing both candidates' broken structural arguments (§0.3):
  (a) *"Zod describes structure and types; the flow lint keeps the semantics"* (2026-08-25) states it
      in its own words — *the schema may add no rule about which keys are present*. A presence rule in
      both places is checked twice and free to drift, silently, because nothing runs the schema in
      front of lint (§0.5).
  (b) `lint.test.ts:1119–1126` records that the schema **did** require `id` on the agent, script,
      integrate and fan-out kinds until Q-0041 iteration 5 removed them as *"four presence rules lint
      does not have, and the exact failure E-1 names"*. Codex AC-12 is a reversal of that, which owes
      a decision entry naming the old one — turning a lint change into a decision ticket, for a rule
      lint will now enforce anyway.
  (c) It would take the new message out of the `semantic` register's protection (AC-8b), whose
      property is that a lint refusal is never pre-empted by a zod issue.
*Test:* the schema accepts all six `ID_LESS_CASES` flows unchanged, including the five the linter now
refuses; no `flow.ts` comment asserts that lint requires an id on no kind.

**AC-8 — the divergence registers gain a third boundary, and one row moves.** `lint.test.ts`'s
`Q-0041 AC-3 as errata E-1 amends it` block draws two boundaries today: *lint accepts / schema
accepts* (presence) and *lint accepts / schema rejects* (types). This rule creates a third — *lint
refuses / schema accepts* — which E-1 permits, its property being that **lint succeeding implies the
schema requires no absent key**. Three consequences, each recorded rather than absorbed:
  (a) five `ID_LESS_CASES` rows flip to `lintAccepts === false` with their schema assertion kept
      unchanged; the gate row is unmoved, and the block's prose is rewritten — it currently narrates
      the pre-Q-0055 history as current.
  (b) the `semantic` list in *"no zod issue replaces a lint message"* gains a tenth row for the id
      rule, and `flow.ts:101`'s *"nine flows this schema accepts and lint refuses"* becomes ten.
  (c) **`TYPE_DIVERGENCE_CASES` loses exactly one of its six rows** — `steps: ['just-a-string']`,
      which lint now refuses on presence and the schema still refuses on type. It **moves** with
      prose saying the two rules agree by coincidence and for different reasons, rather than being
      deleted. The other five rows are verified untouched by execution, `{ id: 42 }` and `{ gate: 42 }`
      among them, which is what §3.2 buys.
*Test:* the three registers each assert their own boundary and name it; removing the id rule turns the
new boundary's block red rather than silently emptying it.

**AC-9 — the counts and the pin move together.** `lint.test.ts:970`'s preserved-defect *"5 — lint
requires an `id` on no step kind, so an id-less step lints clean"* is **inverted, not deleted** — it
asserts the refusal, keeping the gate row as the acceptance, so a regression fails a check rather
than passing an absent one (the Q-0037 AC-4h shape). Its enclosing describe, *"AC-12 — FlowError, and
the nine preserved defects"*, moves to eight, and its neighbours are untouched. `lint.ts`'s module
JSDoc becomes *seventeen* per-flow diagnostics and *fourteen of the seventeen* open with the step id —
the new message being the third that cannot, which is AC-4's whole point and is said in that sentence
rather than left as arithmetic.
*Test:* restoring `lintFlow`'s pre-change body turns the inverted pin red with a message naming the id
rule; the AC-5 register has seventeen entries and both JSDoc numbers agree with it.

**AC-10 — the engine keeps its defensive rendering, and its comment stops being false.**
`engine/diff.ts:465–467` says the absent id is rendered two ways *"which lint does not yet refuse; see
Q-0055"*. After this lands that clause is false and the code is still reachable, because `runFlow`
takes a flow object and only `loadFlow` and the `quorum run` preflight lint (§0.5). The code is
**kept** and the comment rewritten: deleting it would make the engine's correctness depend on a caller
having linted, which contradicts *safety is enforced in `core`, never by convention*
(`harness/rules.md`), and M3's server is the caller that makes that concrete. No new runtime fallback
from a missing id to `undefined` or `null` is introduced anywhere.
*Test:* `diff.ts` carries no claim that lint permits an id-less step; the two renderings (`undefined`
for the branch, `null` for the quoted producer) remain distinguishable and covered.

**AC-11 — the two CLI surfaces report it, and nothing begins.** Through the **built binary**, not in
process: a flows directory holding one id-less step gives `quorum lint` exit 1 with the message
indented under the right filename through the existing `renderFlowReport`; and `quorum run <flow>
<ticket>` exits 1 on the same defect before any adapter is reached — **with no run directory under
`.quorum/runs/` and no branch matching `*/undefined` created**. No exit code, colour or marker
changes, and no CLI-only validation path is added.
*Test:* both invocations spawned as real processes; the run case asserts the two absences, which is
the ticket's purpose stated as a check rather than as a promise.

**AC-12 — every new clause is demonstrated red before it is trusted.** Each behavioural clause of
AC-1 to AC-4 and AC-8 is shown failing against the pre-change linter **on its own**, not collectively
— *showing a guard has a subject proves the guard fires, not that each of its clauses does* (Q-0071).
*Test:* the implement report names, per clause, the mutation and the resulting message.

**AC-13 — the spec gains the rule.** `docs/02-sdlc-pipeline-spec.md` §4's table gains one row for the
id rule beside the `cross_vendor: required` row, and states the gate exception. The status line at the
top is bumped with the date and what changed. §5.1–§5.5 are byte-identical copies of the shipped files
and **must not** move: no flow file changes (§0.2).
*Test:* `packages/shared/src/docs.test.ts` passes; the §5 snippet check is untouched.

---

### Added at the gate, 2026-09-08

*OQ-2 and GO-3 were both ruled **fold it in**. These four criteria are written here, at the gate, by
the human — an implementer may not add them (OQ-2's own clause). Non-goals 5 and 7 are struck to
match; nothing else in this document moves.*

**AC-14 — a flow with no steps is refused, by its own rule and its own message.** `flattenSteps`
defaults its argument away (`lint.ts:68`), so `{ name, consumes, produces }` with no `steps` key
lints clean today and the engine then throws a raw `TypeError`. The linter refuses it with a message
naming the flow and the missing key, in the shape the other fifteen use. **This is a second presence
rule and not a clause of the id rule**: it has its own subject, so AC-1's *one rule, one predicate*
story is unchanged and the two are never reported together as one.
*Test:* a flow with no `steps`, and one with `steps: []`, are each refused with that message;
`flattenSteps`'s own preserved-defect behaviour on `null` and `[null]` (AC-12 defect 4) is untouched
and its authority line stays.

**AC-15 — the two `PRESENCE_CASES` rows that assert the opposite are flipped, not deleted.**
`lint.test.ts:1086` (*"no steps"*) and `:1088` (*"neither"*) currently require `lintFlow` to **accept**
these flows, and `flow.ts`'s comment says the same. Both rows move to the refusing side with the
reason recorded inline, and the `flow.ts` comment is corrected. A row deleted rather than flipped
would leave the register smaller and the claim unmade.
*Test:* reverting AC-14's clause turns both flipped rows red on their own, and the register's own
arithmetic is re-derived rather than adjusted.

**AC-16 — a flow the linter refuses is visible on the board rather than absent from it.**
`board.ts:64–70`'s `flowsIn` drops every record whose `flow` is `undefined`, so a flow that fails to
load or lint vanishes from the runnable-flow index and its `→ quorum run <flow> <id>` hint disappears
with no explanation. The board says which flows it could not read, in its own dim register line
beside the containment and push-lag legends, naming the file and nothing more.
*Test:* a directory holding one good flow and one that fails lint renders the good flow's hint **and**
names the bad file; with no bad file the line is absent, so silence still means there is nothing to
say (*"The board reports push lag, and never a CI conclusion"*, 2026-09-06).

**AC-17 — the board still exits 0, and still claims nothing about the flows it did read.** A
refused flow is a fact the board reports, not a failure of the board: `quorum board` is a report and
its zero is ruled (*"What an exit code may claim, and the three zeros it was asked about"*,
2026-09-08). The new line may warn and may never reassure — it names what could not be read and says
nothing about what could.
*Test:* the exit code is `SUCCESS` in both shapes above; no wording equivalent to "all flows valid"
appears anywhere in the output.

---

## 5. Non-goals

1. **The gate step is not given an id**, in either corpus or in the schema. Twelve of twelve shipped
   gates are id-less and the engine never asks one for an id.
2. **The fan-out `step:` template is not required to carry one** (AC-3), and `flattenSteps` is not
   made to descend into it — that would silently subject the template to the duplicate-id, `goto`,
   cross-vendor and loop-convergence rules it is deliberately excluded from (`lint.ts:62–67`).
3. **The id is not type-checked.** `id: 42` keeps linting clean; that refusal is the schema's.
4. **The fourteen id-prefixed messages get no positional fallbacks.** Cost measured: fourteen frozen
   strings rewritten and their register re-pinned, to improve a case that can now only occur alongside
   the id problem itself. AC-6 states the accepted consequence.
5. ~~**The `steps`-less flow is not fixed here**~~ — **folded in at the gate, 2026-09-08; see
   AC-14 and AC-15.** The body calls it *"the same class"* and it is:
   `flattenSteps(steps = [])` defaults the key away, so a flow with no steps lints clean and the
   engine throws a raw `TypeError`. It is a second rule with its own message and flips two
   `PRESENCE_CASES` rows and one `flow.ts` comment. See OQ-2.
6. **`composite.ts:141`'s branch defect is not closed.** A fan-out template omitting `branch:` records
   one branch name and cuts a worktree under another (Q-0053 AC-14). This ticket makes the
   `undefined:` half of that name impossible and leaves the defect and its authority line alone.
7. ~~**The board's silence is registered, not repaired.**~~ — **folded in at the gate, 2026-09-08;
   see AC-16 and AC-17.** `board.ts:66`'s `flowsIn` drops any record
   with no `flow`, so a flow that fails lint disappears from the board's runnable-flow index and its
   `→ quorum run …` hint vanishes with no explanation. Pre-existing for all sixteen rules; this adds a
   seventeenth way to reach it. See GO-3.
8. **No `route` work** — Q-0056 owns `route`'s three incompatible descriptions and the qa-final sketch
   that cannot lint. `lint.test.ts:354` names Q-0055 and Q-0056 as tickets where tightening
   `harness/{id}/integration ` would belong; it does not belong here and that citation is corrected to
   name Q-0056 alone.
9. **Nothing historical is repaired.** Branches, worktrees, run directories and counters already
   carrying `undefined` are left alone; cleaning them is destructive scope. *(Codex non-goal.)*
10. **No dependency is added**, and no adapter, gate-answer, backward-edge or cross-vendor behaviour
    changes.

---

## 6. Open questions

**OQ-1 (settled here) — is `id: ''` refused, and what about whitespace?** Yes to both, by §3's
predicate. The codex candidate raised the empty string as a blocker and asked whether whitespace-only
ids follow; one clause answers both, and its precedent is `lint.ts:187`'s `!counter.trim()` in the
same function. Pure truthiness was rejected because it accepts `'   '`, which names a branch git
refuses; a `typeof === 'string'` rule was rejected because it moves three type-divergence rows instead
of one (Appendix A.3). Not a blocker: it changes one predicate and one register row, not the design.

**OQ-2 (for the gate; not blocking) — does the `steps`-less rule fold in?** Sized rather than
described: one clause, one message, two `PRESENCE_CASES` rows flipped, one `flow.ts` comment
corrected. Against that, a separate ticket costs a requirements run and a chore run over the same file
— roughly what Q-0108 measured as *the gate costing more than the work*. **Recommendation: keep it
out** (non-goal 5) and open the successor at this gate, because it is a second presence rule with its
own message and its own register consequences, and folding it in makes AC-1's "one rule, one
predicate" story two. If the gate folds it in, this document gains AC-14 and AC-15 **at the gate**; an
implementer may not add them. Decide it either way at the gate — GO-2.

**OQ-3 (settled here) — does the schema require the id?** No. AC-7 gives three reasons and §0.3
disposes of both candidates' broken mechanical arguments. Recorded so it is not re-litigated: the
obvious reading of *"lint and the schema should agree"* points the other way, and E-1's property does
not forbid it — it is decision 048 and the Q-0041 iteration-5 history that do.

**OQ-4 (settled here) — is a decision entry owed?** **No**, on measurement rather than taste. The
apparent obstacle is `validDiffRange`'s JSDoc framing the linter as restating the engine — *"a flow
the engine would accept must pass here"* — while this rule adds something the engine has no
counterpart for. Measured, that frame is local to the diff rule and is not a property this repository
holds: `cross_vendor` appears in `packages/core/src/engine/` **only in a comment** (`diff.ts:141`) and
in no code, so both cross-vendor rules are lint-only, and `human-locked` appears there only as a gate
kind the engine honours, never as one it requires a flow to contain. The linter already carries three
rules with no engine counterpart; this is a fourth of the same kind. It contradicts no landed entry
and *executes* one — `flow.ts:76–81` calls this exactly *"a gap in lint, not a licence for this schema
to close it here"*. The authority belongs in the check's own comment, which is the Q-0108 precedent.
**If the gate rules otherwise, the entry must land before the implement step starts** — GO-1.

---

## 7. Risks

**R-1 — an adopter's flow that linted clean now fails.** The intended breaking change and the only
one. Both shipped corpora are clean (§0.2), but neither is an adopter's. Mitigated by AC-4: the
message must make the fix obvious. No migration path is offered and none is wanted — a flow this rule
refuses was producing `harness/<id>/undefined`.

**R-2 — the deliverable is a diagnostic, and a diagnostic cannot be established by reading it.** Three
review rounds went on exactly this on Q-0050. AC-12 is the countermeasure and is not optional.

**R-3 — five registers, and missing one leaves it asserting a linter that no longer exists.**
`lint.test.ts` is 1,222 lines and this touches the AC-2 verbatim register, the AC-12 preserved-defect
pin **and its describe title**, `ID_LESS_CASES`, `TYPE_DIVERGENCE_CASES` and the `semantic` list, plus
two counts in `lint.ts`'s JSDoc and one in `flow.ts:101`. A register left behind reads as coverage.

**R-4 — `flattenSteps` erases the enclosing group's position.** Reusing it alone makes AC-4's
`parallel` locator impossible or misleading. The implementation must walk the flow's own `steps`
array for this rule while leaving `flattenSteps` unchanged for the other sixteen. *(Codex risk 2, the
sharpest thing in that candidate.)*

**R-5 — classification must follow the engine's dispatch, not TypeScript types.** The gate predicate
is `step.gate`'s truthiness, which is `runStep`'s own test; deriving it from a type would misclassify
malformed steps and could replace established messages. *(Codex risk 1.)*

**R-6 — the `not a gate` predicate is default-on.** A future step kind is required to have an id
whether or not it needs one, and must opt out deliberately. That is the direction chosen, and §0.1 is
the evidence: the enumerating alternative had already missed three of nine sites before a line was
written.

**R-7 — scope creep into the fourteen frozen messages.** AC-6 and non-goal 4 bound it. An implementer
who finds `undefined: integrate needs branches` unsatisfying reports it rather than fixing it.

**R-8 — no new turbo input is expected, and that is checked rather than assumed.**
`packages/core/turbo.json` already declares `../../harness/flows/*.yaml` and
`../../packages/cli/templates/harness/flows/*.yaml`. If the change adds a new read,
`turbo-inputs.test.ts` refuses it — the machinery working as designed, not an obstacle.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, credential or `check()` path is touched. |
| **Worktree safety** | Improved, and this is the point: `harness/<id>/undefined` becomes unreachable through `quorum run`, and AC-11 asserts the branch is not created. Nothing new is written to a user's tree. |
| **Gate behaviour** | Unchanged. `askGate` reads no step id; human, auto and human-locked behaviour is untouched; the gate step's exemption is what AC-2 protects. |
| **File format and its schema** | The flow file format gains one presence rule. `flowSchema` is unchanged in structure and corrected in prose (AC-7). No flow file moves, so §5's byte-identical snippets are untouched. |
| **Lint rules** | Sixteen become seventeen; the four cross-flow rules are unchanged. |
| **Cross-vendor rule** | Unchanged, and still evaluated alongside the new rule. |
| **Cold-clone impact** | Net positive and measured. All twenty scaffolded template files satisfy the rule, so a stranger's first `quorum lint` still prints six ticks; the first thirty minutes get longer only for someone who writes a flow and omits an id, which is the case this improves. |
| **Product-agnostic** | n/a. |
| **Files are the database** | n/a. Nothing persistent changes. |
| **Errors are explicit** | Directly served. A silent default — the string `undefined` — becomes an explicit refusal. |

---

## 9. Gate obligations

*Work no step on the chore route may perform. `developer-generalist`'s paths cover `packages`, `docs`
and `harness` and explicitly exclude `docs/decisions/` and the backlog.*

**GO-1.** Ratify OQ-4. If the gate decides an entry **is** owed, it must be written and landed
**before** the implement step is launched. Do not launch with an unwritten entry: that is the pattern
this repository has now recorded sixteen times, and Q-0062 is the case where the requirement named the
hazard in advance and the run was launched anyway, costing three rounds.

**GO-2. Discharged at the gate, 2026-09-08: folded in.** Against this document's own
recommendation, and the reason is Q-0108's measurement rather than a preference — a second
requirements run and a second chore run over the same file is the gate costing more than the work.
**AC-14 and AC-15 are written above, by the human, at the gate**, which is the clause OQ-2 attached
to this answer. Non-goal 5 is struck.

**GO-3. Discharged at the gate, 2026-09-08: folded in, not deferred.** The board's silence is
repaired in this ticket rather than registered and passed on. **AC-16 and AC-17 are written above**,
and non-goal 7 is struck. The reasoning that made it a non-goal — that it is pre-existing and this
ticket merely adds a seventeenth way to reach it — is true and is not a reason to leave it: a flow
absent from the board with no explanation is the silence this repository keeps finding, and the rule
it is repaired under is already written (2026-09-06).

**GO-4.** After the merge, verify forced in **both** environment rows — in the integration worktree,
which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` — per Q-0072's closing
finding. AC-11 is verified through the built binary in the second row.

**GO-5.** Correct this ticket's plan bullet in `docs/06-development-plan.md` to what shipped. It
currently reproduces the body's two-rule shape and its `spike/` line numbers, and §0.1 disproves the
first.

---

## 10. Provenance

**From the claude candidate**, and it is the stronger of the two: §0.1's interpolation-site census and
the conclusion that the rule must be *not a gate* rather than *worktree or on_fail*; §0.2's corpus
enumeration (its figure corrected here); §0.4's measurement that the linter's own messages read
`undefined:`; §0.5's placement of lint relative to a run; §3's single-predicate rule; the refusal to
pin exact bytes (AC-4); AC-7's conclusion; AC-8's three-boundary register analysis, which is the most
useful single thing either candidate produced; AC-9's inverted pin and count arithmetic; AC-10's
keep-the-code-fix-the-comment ruling; AC-11's built-binary discipline; AC-12's per-clause red
demonstration; Appendix A.3's truthiness cost table; and non-goals 5–8 with their sizing.

**From the codex candidate**: the per-kind criteria structure, which is what makes AC-1's test row
list exhaustive; the **locator grammar** in its AC-8, adopted as a pinned criterion where its exact
bytes were not; its AC-9 on accumulation and deterministic order; its AC-15's engine-level assertion
that nothing begins, folded into AC-11 as *no run directory and no branch* — the ticket's purpose
stated as a check; its risk 2 on `flattenSteps` erasing the group position (R-4) and risk 1 on
classifying by the engine's dispatch (R-5); non-goal 9 on not repairing history; and its one blocking
open question, which is answered in §3 and OQ-1 rather than returned.

**From neither, added here**: §0.1's `steps.ts:187`, `:312` and the `composite.ts:130` fan-out child
id — the site named nowhere in the ticket, its correction, or the codex candidate, and the only one
that produces a refname git refuses; §0.2's corrected count (52 steps across both corpora, not 36);
§0.3, which disproves **both** candidates' schema arguments and is the reason AC-7 is argued from
decision 048, the Q-0041 iteration-5 history recorded at `lint.test.ts:1119`, and the `semantic`
register instead; §0.4's fifth rendering site, `diffSites`'s `${label}`, preserved by AC-6; §3's blank
clause and its precedent at `lint.ts:187`; OQ-4's measurement that `cross_vendor` exists in the engine
only as a comment; and AC-9's correction that inverting the pin moves its describe title from nine
preserved defects to eight.

**Where they disagreed, and how it was decided.** The schema (codex AC-12 required, claude AC-7
optional) — **claude's conclusion, neither's reasoning**; see AC-7(a)–(c). The message (codex pinned
bytes, claude pinned nothing) — **split**: the locator grammar is pinned because two id-less steps
must be distinguishable, the wording around it is not, per Q-0094 E-3. The empty-string question
(codex blocking, claude settled by truthiness) — **settled, and wider than either**: truthy *and*
non-blank, which answers the half codex asked about and left open.

---

## Appendix A — the measurements, and how to reproduce them

All at `72510ee`, 2026-09-08.

**A.1 — the id-less table (§1).** The built linter imported into a plain node process, one flow per
kind, each carrying whatever else its kind needs to lint clean. Eight rows, eight `true`. The two rows
the ticket body does not have — *agent with `worktree: true`* and *agent with `on_fail`* — are proof
that the current linter covers neither of the conditions the body's proposed rule would have keyed on.

**A.2 — the corpora (§0.2).** Both flow directories parsed with `yaml`, `parallel` groups flattened
exactly as `flattenSteps` does, each step classified by `step.gate`'s truthiness. 26 steps per
corpus, 52 across both: 12 gates, none with an id; 40 non-gate, all with one. `development.yaml`'s
fan-out template carries both `id: "dev:{task.id}"` and `branch: "harness/{id}/{task.id}"`, so
`composite.ts:130`'s default is exercised by no shipped flow — which is why that site went unnoticed.

**A.3 — what the predicate costs and buys (§3.2, OQ-1, AC-8c).** All of these lint clean today:

| flow | today | under §3 | register |
| --- | --- | --- | --- |
| `steps: [{ id: 42 }]` | clean | **still clean** | stays in `TYPE_DIVERGENCE_CASES` |
| `steps: [{ gate: 42 }]` | clean | **still clean** | stays in `TYPE_DIVERGENCE_CASES` |
| `steps: [{ id: '' }]` | clean | refused | new |
| `steps: [{ id: '   ' }]` | clean | refused | new |
| `steps: [{ id: 0 }]` | clean | refused | new |
| `steps: [{ id: null, role: 'r' }]` | clean | refused | new |
| `steps: ['just-a-string']` | clean | refused | **moves out of `TYPE_DIVERGENCE_CASES`** |
| `steps: [42]` | clean | refused | new |

A `typeof === 'string'` rule would move three of the six type rows instead of one, taking `{ id: 42 }`
with it. That is the measurement behind §3.2, and the reason the blank clause is written as *a string
that trims to nothing* rather than as a type test.

**A.4 — the lint messages on an id-less step (§0.4).** Five single-defect flows and one two-step flow
run through `lintFlow`; every message opens `undefined:` and the two-step flow's four problems are
pairwise identical. `lint.ts` has sixteen per-flow `problems.push` sites, of which fourteen carry a
step id and two are flow-level (`flow needs consumes/produces`, `deploy flow must contain a
human-locked gate`) — which is what the JSDoc's *"fourteen of the sixteen"* counts, and why the new
message makes it *fourteen of the seventeen*.

**A.5 — lint runs before every run, and the schema runs on neither path (§0.5).**
`engine/loaders.ts:19` (`loadFlow` casts `as Flow`, then calls `lintFlow`), `packages/cli/src/run.ts:151`
(`lintDirectory` before `loadFlowByName`), and `lint/lint.source.test.ts:107`, which forbids `lint.ts`
from naming `flowSchema`, `.safeParse(` or zod at all. Read rather than inferred.

**A.6 — the linter already adds rules the engine does not have (OQ-4).** `cross_vendor` in
`packages/core/src/engine/` returns exactly one hit, a comment at `diff.ts:141`; `human-locked` returns
`routing.ts:14` and `:139` and `types.ts`, all of them the engine honouring a gate kind, never
requiring a flow to contain one.

**A.7 — the schema's own history (AC-7b).** `lint.test.ts:1119–1126`: *"Until Q-0041 iteration 5 the
schema required `id` on the agent, script, integrate and fan-out kinds — and `parallel` members
inherited the requirement through `agentStepSchema` — which is four presence rules lint does not have,
and the exact failure E-1 names."* `flow.ts:52–81` states the same ruling and, in its *"cost of the
third case"* paragraph, names this ticket's defect as *"a gap in lint, not a licence for this schema
to close it here"*.
