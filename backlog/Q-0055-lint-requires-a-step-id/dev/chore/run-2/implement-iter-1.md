# Q-0055 — implement report, run 2 iteration 1

*Against `3587270`. Every measurement below was produced by running code; the mutation table in §6
was produced by editing `lint.ts` one clause at a time and running the suite against each.*

---

## 1. The rule, as it shipped

> Every step that is not a gate must carry a usable id. A gate must not be required to.
> "Usable" means `step.id` is truthy and, where it is a string, not blank after `trim()`.

Plus AC-14's second, separate rule: a flow that declares no step — the absent key **and** the empty
list — is refused with `flow needs steps`.

Two new messages, so **eighteen** per-flow diagnostics rather than sixteen:

```
step 3: id is required — the engine names a branch, a loop counter and a run-history occurrence after it
step 2, parallel member 1: id is required — the engine names a branch, a loop counter and a run-history occurrence after it
flow needs steps
```

Neither renders the absent value. The locator is derived from the flow's own `steps` array and never
from `flattenSteps`, which erases the enclosing group's position (R-4).

---

## 2. File by file

### `packages/core/src/lint/lint.ts` (+79 lines)

- **`usableId(step)`** — module-private. Truthiness plus a blank clause, with the precedent named in
  place (`on_fail.counter` has been `typeof !== 'string' || !trim()` since the spike). The **type** is
  deliberately not tested; `id: 42` still lints clean.
- **`locatedSteps(steps)`** — module-private, plus a `LocatedStep` interface. Walks the flow's own
  list, descends into `parallel` and into nothing else. It selects the same steps `flattenSteps` does,
  including for a truthy non-array `parallel`, so no shape that throws a raw `TypeError` there is
  reached by a rule that would refuse it politely instead.
- **The id rule** sits immediately after the duplicate-id check, so an id-less step's other messages
  (which still open `undefined:`) are explained by the line above them.
- **`flow needs steps`** sits immediately before `flow needs consumes/produces` — the two flow-level
  presence rules together.
- **The duplicate-id filter keeps plain truthiness**, with the reason recorded: the two predicates
  disagree on a blank id, and swapping in `usableId` there drops `duplicate step id "   "` from a flow
  that has one. Measured, not asserted — mutation 6 in §6.
- **Module JSDoc**: sixteen → eighteen, "fourteen of the sixteen" → "fourteen of the eighteen", and a
  new paragraph naming the four that cannot open with a step id.
- **OQ-4's ruling is in the check's own comment**, per the Q-0108 precedent, as two lines rather than
  a transcription: *"a lint rule with no engine counterpart owes no decision entry — `cross_vendor`'s
  two and the deploy gate are the precedent. Ruled at Q-0055's requirements gate, OQ-4."*

The module still contains no `harness/` literal (`lint.source.test.ts` forbids it), no `.parse(` but
`YAML.parse`, and no `any`.

### `packages/core/src/lint/lint.test.ts` (99 → 120 tests)

- **AC-2's register retitled to "the eighteen messages, verbatim"**, gaining rows **17** (both locator
  forms) and **18** (`flow needs steps`).
- **Five new describes** for AC-1, AC-2, AC-3, AC-4, AC-5/AC-6 and AC-14 — nineteen tests.
- **Preserved defect 5 inverted rather than deleted** (AC-9): it now asserts the refusal over the same
  six-kind flow, checking that the six locators are exactly
  `step 1 / step 2, parallel member 1 / step 2, parallel member 2 / step 3 / step 4 / step 5` and that
  the gate contributes none. The enclosing describe moved to **"the eight preserved defects"**; its
  neighbours and their numbering are untouched.
- **`ID_LESS_CASES` changed direction and kept every row** (AC-8a). Each row now carries the verdict it
  expects — five `false`, the gate `true` — and the schema assertion beside it is unchanged, which is
  what makes it the third boundary (*lint refuses / schema accepts*) rather than an emptied register.
  Its arithmetic is asserted (5 refused, 1 accepted) so a row silently dropping out fails.
- **`TYPE_DIVERGENCE_CASES` lost exactly one row** (AC-8c): `steps: ['just-a-string']` **moved** to the
  refusing register with the sentence saying the two rules now agree by coincidence and for unrelated
  reasons. The other five are untouched, `{ id: 42 }` and `{ gate: 42 }` among them. One row's fixture
  (`cross_vendor` that is a number) gained a step, because it carried `steps: []`.
- **The `semantic` register gains three rows and is length-pinned at twelve** (AC-8b).
- **Non-goal 8**: `lint.test.ts:354`'s citation now names Q-0056 alone.

### `packages/shared/src/flow.ts` (+40 / −38)

No schema declaration changed. All five `id: z.string().optional()` and `steps: …optional()` stay.
Corrected: the PRESENCE block's third case, the *"cost of the third case"* paragraph (which named
`engine.js:211` and `:541`), the four sibling comments, the `steps` field comment, the sixteen →
eighteen count, `fanOutStepTemplateSchema`'s reason for its own optional id, and *"nine flows this
schema accepts and lint refuses"* → **twelve**.

### `packages/shared/src/flow.test.ts` (+42), `packages/shared/src/docs.test.ts` (+43)

AC-7's two assertions (five optional declarations counted from the source; four stale sentences
refused, with an anti-vacuity anchor) and AC-13's three (§4's row sliced out of §4 rather than
searched for across the page, both exemptions, the status line).

### `packages/core/src/engine/diff.ts` (+9 / −3) and `diff.test.ts` (+41)

The code is **kept** and the comment rewritten (AC-10): it now says why the fallback is still
reachable — `runFlow` takes a flow object and lints nothing, which is how this package's own tests
reach it and how M3's server will — rather than that lint permits an id-less step. Two new tests: one
exercising both renderings through the real preflight (`harness/T-9/undefined` for the branch,
the string `null` for the quoted producer), one refusing the stale sentences with an anti-vacuity
anchor on the fallback itself.

### `packages/cli/src/board.ts` (+41 / −13) and `board.test.ts` (+5 tests)

AC-16/AC-17. `flowsIn` returns `{ flows, unreadable }` instead of dropping the records with no flow;
`unreadableFlowsLegend` renders at most one dim line, first among the legends because it is the only
one explaining something *missing* from the output above:

```
· could not read = broken.yaml — a flow that fails to load or lint has no → quorum run hint above; quorum lint says why
```

It names the files and nothing else, prints nothing when there are none, and the exit code stays
`SUCCESS` in both shapes. The AC-17 test scans **both** outputs for six reassurance patterns
(`all flows`, `flows are valid`, `every flow`, `valid`, `ok`, `passed`).

### `packages/cli/src/step-id.test.ts` (new, 223 lines, 7 tests)

AC-11, through the built binary as separate OS processes, spawning a copy it built itself via
`../test/workspace.ts` — the first of the two shapes Q-0098 AC-15(c) permits. The fixture is a real
git repository scaffolded by `quorum init` with a ticket from `quorum ticket new`, and it runs the
**same flow twice**:

| | `quorum lint` | `quorum run probe T-0001` | `.quorum/runs` | branches |
| --- | --- | --- | --- | --- |
| step has no `id` | exit **1**, `✗ probe.yaml` | exit **1** | absent | none |
| step has `id: probe-step` | exit **0**, seven ticks | exit **0** | present | `harness/T-0001/probe-step` |

The step carries `worktree: true`, so the *only* difference between the two invocations is the id —
which makes "no run directory and no branch" a fact rather than an assertion that cannot fail. The
six flows `quorum init` scaffolds are asserted still ticking, which is the cold-clone half.

### Fixture repairs (§4)

---

## 3. Two places the requirement did not survive contact

Both are reported rather than resolved by improvisation, and both are cheap for the gate to reverse.

### 3.1 AC-5's *"the sixteen verbatim assertions pass unedited"* collides with AC-14, on one fixture

AC-2's **message 15** is `expect(onlyProblem({ name: 'f', steps: [] })).toBe('flow needs consumes/produces')`.
AC-14 refuses `steps: []`, so that flow now produces **two** problems and `onlyProblem` fails.

AC-5 was written before AC-14 was folded in at the gate, and AC-15 explicitly authorises flipping
rows that assert the opposite. **What I did**: kept the message byte-identical and gave the fixture a
step — `{ name: 'f', steps: [{ id: 's' }] }` — with the reason recorded inline. AC-5's normative half
("every existing message keeps its exact text") is met; its *Test* clause's word *unedited* is not,
for one fixture out of sixteen.

If the gate prefers the other reading — AC-5 binds and `steps: []` is not refused — the change is one
clause in `lint.ts` and it removes most of §4's fixture work with it. I did not take it, because
AC-14's *Test* clause names `steps: []` explicitly and a Test clause is part of a criterion.

### 3.2 AC-15 says two rows and the measurement is six

AC-15 names `lint.test.ts:1086` (*"no steps"*) and `:1088` (*"neither"*). Measured, **six of the nine**
`PRESENCE_CASES` rows carried `steps: []` or no `steps` key and are refused by AC-14:

| row | carried | disposition |
| --- | --- | --- |
| `no name` | `steps: []` | **gained a step** — its subject is the missing `name` |
| `no steps` | no key | **moved** to the refusing register (AC-15's first) |
| `neither` | no key | **moved** to the refusing register (AC-15's second) |
| `the loader-injected file` | no key | **gained a step** — its subject is `file` |
| `a key nothing reads` | no key | **gained a step** — its subject is `notes` |
| `stages outside the ten-member list` | `steps: []` | **gained a step** — its subject is the stage strings |

The distinction I drew: a row that was *about* the absent key cannot be repaired by adding one,
because repairing it deletes the claim — those two moved, as AC-15 requires. The other four merely
*happened* to carry it, and each keeps its own subject. `PRESENCE_CASES` is 9 → 7 and the register's
prose says so. AC-15's *"the register's own arithmetic is re-derived rather than adjusted"* is met:
`semantic` is length-pinned at twelve and `flow.ts`'s comment re-derived to match.

### 3.3 AC-9's counts, as a consequence of the same fold-in

AC-9 asks for *seventeen* diagnostics, *"fourteen of the seventeen"*, one new register row, and *"the
third that cannot"* open with a step id. AC-14 makes all four one larger: **eighteen**, *"fourteen of
the eighteen"*, **two** new register rows, and **four** that cannot (the two flow-level messages plus
both of Q-0055's). Recorded as arithmetic rather than as a deviation.

---

## 4. What the rule cost outside the linter, and why nothing quietly changed

`steps: []` and the absent key appear in ten flow fixtures across seven files. Each is a fixture whose
assertion was never about steps.

| file | change |
| --- | --- |
| `core/src/lint/lint.test.ts` | `basic()` gains `- id: s`, used by ~25 directory-walk fixtures |
| `core/src/lint/lint.test.ts` | message 15's fixture and one `TYPE_DIVERGENCE_CASES` row gain a step |
| `core/test/run-fixture.ts` | the on-disk file gains `- id: implement` |
| `core/src/engine/engine.test.ts` | the on-disk file gains `- id: pm` |
| `core/src/engine/diff.test.ts` | the on-disk file gains `- id: probe-step` |
| `core/src/engine/loaders.test.ts` | the `valid` half gains `- id: x` |
| `cli/src/lint.test.ts` | `basicFlow()` gains `- id: s` |
| `cli/src/board.test.ts` | `basicFlow()` gains `- id: s` |
| `cli/src/main.test.ts` | the snapshot fixture's `sample.yaml` gains `- id: s` |

**Three of those needed a second half, and it is worth reading.** `run-fixture.ts`, `engine.test.ts`
and `diff.test.ts` each write a flow file, load it through `loadFlow` — which lints — and then hand
the result to `runFlow`. Adding a step to the file would have made **every** test in those files run a
mock agent step it had not been running. So the file carries a step and the object does not:
`{ ...loadFlow(flowFile), steps: [] }`. The loader is still exercised, `flow.file` is still set, and
every test behaves exactly as before. Without this, `engine.test.ts`'s banner test went red on
`cost $0.01 tokens 244` where it asserts `cost $0 tokens 0` — which is how the need was found rather
than reasoned about.

---

## 5. What was deliberately not done

- **Non-goal 3** — `id: 42` still lints clean. A `typeof` here would move three type-divergence rows
  instead of one; asserted as its own row.
- **Non-goal 4** — the fourteen id-prefixed messages got **no** positional fallback. An id-less step's
  other problems still read `undefined: integrate needs branches`, and AC-6 pins that.
  **One measured consequence the requirement does not name**: the panel message renders an id-less
  member as *nothing at all* — `parallel group r1,  shares role "rev" …`, two spaces — because
  `Array.prototype.join` renders `undefined` as the empty string. Left alone under non-goal 4, and the
  id problem printed above it now says which member. Pinned in AC-5's ordering test so it cannot move
  unnoticed.
- **Non-goals 1, 2, 6, 9, 10** — no gate gains an id, `flattenSteps` still does not descend into a
  fan-out template, `composite.ts:141`'s branch defect is untouched, nothing historical is repaired,
  no dependency added.
- **`packages/shared/src/flow.ts` carries one stale sentence I did not fix**: *"Both halves are
  asserted in flow.test.ts against the REAL `lintFlow`, imported from spike/src/lint.js and
  executed."* Q-0107 moved those properties to `packages/core/src/lint/lint.test.ts` and Q-0103
  deleted the spike, so both halves of that sentence are false and were false before this ticket. It
  belongs to the citation sweep the cutover deliberately did not do, and fixing it in passing is the
  scope creep this role is told to refuse. **Reported, not fixed.**
- **A pre-existing ESLint warning** at `packages/core/src/backlog/backlog.ts:281` (unused
  `eslint-disable` for `no-control-regex`) survives. Not mine, not touched.
- **GO-5** — correcting this ticket's bullet in `docs/06-development-plan.md` is **not done, and
  deliberately**. Q-0094's erratum E-3(a) rules that this page's bullets are rewritten by hand at each
  plan pass and that an implement step editing it turns a harmless revert into a review finding. It is
  the gate's.
- **GO-4** — the both-rows forced verification is after the merge, so it is the gate's too. What I can
  report is §7.

---

## 6. AC-12 — every new clause demonstrated red on its own

Six mutations, six distinct signatures. Each was applied alone, with the other five intact.

| # | mutation | what went red |
| --- | --- | --- |
| 1 | the id loop short-circuits | **18 tests**, across AC-1 to AC-6, AC-14's separation clause, the inverted preserved-defect pin, the third-boundary register and the `semantic` list |
| 2 | `usableId` → `Boolean(id)` | **2 tests**. `AssertionError: id: "   ": expected true to be false` and `lint must refuse a step with no usable id (Q-0055)`. `id: ''` and `id: 0` are falsy either way, so this isolates the blank clause exactly |
| 3 | the gate exemption dropped | **12 tests**, including `lintFlow must accept: a gate step with no id — chore.yaml:59`, both shipped corpora refusing all six flows, and the twelve-gate derivation |
| 4 | `locatedSteps` → `flattenSteps(steps).map(…)` | **5 tests**. `expected [ 'step 1', 'step 2', 'step 3' ] to deeply equal [ 'step 1, parallel member 1', …(2) ]` — R-4's hazard, shown rather than argued |
| 5 | `flow needs steps` suppressed | **4 tests**. `lintFlow was expected to refuse this flow and did not`, the ordering pair, and `lint must refuse no `steps` key — was a PRESENCE row until Q-0055 AC-14` |
| 6 | the duplicate-id filter uses `usableId` | **1 test**. `expected [ …(2) ] to deeply equal [ 'duplicate step id "   "', …(2) ]` |

**Mutation 6 corrected my own comment.** The first version of that comment claimed unifying the
predicates would make `id: ''` report twice. It would not — `''` is falsy under both. The real cost is
in the other direction and one message wide, and the fixture was rewritten to `id: '   '` so it
discriminates. The comment now says what was measured.

**A seventh, for AC-16**: suppressing the board's legend line turned three of its five tests red, each
naming the file it expected. The remaining two are the negative halves and correctly stayed green.

---

## 7. Verification

- **`pnpm turbo run test lint typecheck --force --continue` — 21/21 tasks, 0 cached.**
  `@quorum/core` 1343 passed | 2 skipped, `@quorum/shared` 158, `@quorum/cli` 605 across 25 files,
  four scaffolds 1 each. **2110 passed, 2 skipped.**
- **`pnpm sweep:git-identity` — exit 0**, with the script's own
  *"environment discriminates (negative and positive probes both as expected)"* and
  *"the workspace suite executed and green with no resolvable git identity"*.
- **`pnpm exec quorum lint` in this repository — six green ticks**, through the binary the build
  produced. All twelve shipped flow files across both corpora lint clean, which is AC-5's second half
  and AC-13's *no flow file moves*.
- **AC-11 through the built binary**, in a repository the fixture created, with the discriminating
  pair in §2.
- This worktree started with no `node_modules`; `pnpm install --frozen-lockfile` and
  `pnpm turbo run build` were run first, so what was tested is what `integrate` will run.

## 8. For the gate

1. **§3.1** — AC-5's *unedited* against AC-14, on one fixture. Ruled the minimal way; reversible in one
   clause if the gate reads it the other way.
2. **§3.2** — AC-15 names two rows; six were affected. Four kept their subjects, two moved as required.
3. **§3.3** — seventeen is eighteen, and three-that-cannot is four.
4. **§5** — `flow.ts`'s stale spike citation, reported and not fixed.
5. **GO-1**: `docs/decisions/` ends at **084** and no entry was landed before this round, which under
   GO-1's own wording is the gate ratifying OQ-4's *no entry owed*. The authority sits in the check's
   own comment per Q-0108. If the gate disagrees, the entry must land before the next round starts.
6. **GO-5** is untouched and is the human's.
