# Scenario review — Q-0050, round 4

*Architecture reviewer, 2026-08-29 · verdict **revise**. This traversal is the one the exhaustion
gate's second `retry` at 08:16 authorised (`runs.log:51`: `counter=qa-red.scenario-review set=1`), so
this verdict exhausts the loop a third time and re-presents that gate rather than looping. The work
list is written for that: mechanical, bounded, split by who can perform each item, and closing with
what an `advance` would actually ship.*

*Inputs: `requirements/merged.md`, `qa/scenarios.md` (round 4), `qa/red-report.md`,
`qa/red-integration.md`, `solution/errata.md` E-1–E-7, `solution/tasks.yaml`. Also **read**, because
the report is truncated and — as E-7 predicts — shows nothing about the engine: the seven test files
on `harness/Q-0050/tests` at `74a043b`, `packages/core/test/corpus.ts`,
`packages/shared/test/corpus.ts`, `packages/core/src/turbo-inputs.test.ts`,
`packages/core/turbo.json`, `packages/shared/turbo.json`, `packages/shared/src/containment.ts`,
`contracts/Q-0050/run-messages.fixture.json`, and round 3's own review. **Provenance, stated because
it differs from round 3's:** everything below was derived by reading the tree at `74a043b`, not by
executing it. Where a claim turns on how a guard classifies something, I cite the guard's own
deciding line so the claim is checkable without a run. E-6(a)'s hand-measured table remains this
ticket's red-phase evidence and I have not re-measured it; it predates round 4's four test-file
edits.*

## The two questions this step asks, answered first

**Every acceptance criterion has at least one scenario: yes, 13 of 13**, and every criterion except
the three correctly declared testless — AC-13a and AC-13e as gate actions, AC-12e per E-5(b) — has at
least one *executing* test. Nothing is uncovered at the criterion level. Round 3's mechanical items 1,
2, 3 and 6 are genuinely done: `q0050.source.test.ts` reads through `test/corpus.ts`, the temp-repo
`harness/harness.yaml` is registered, `engine.test.ts`'s three unsatisfiable spy matchers are real
`vi.spyOn` calls with AC-10a's on-disk half beside them, and the traceability table exists.

**The red report shows the suite failing on assertions rather than compile errors: yes, for what it
shows — and it again shows only `@quorum/shared`.** `Tasks: 5 successful, 6 total`,
`Failed: @quorum/shared#test`, `Test Files 2 failed | 9 passed (11)`. `@quorum/core#test` was pruned
by `dependsOn: ["^test"]`. **That is expected and is not a round-4 defect**: E-7 says so in as many
words, and `runFlow` stores `config` at run start, so round 4's `prove-red` ran the pre-`--continue`
command. I do not re-open it. Of the two failures the artifact can carry, the retained tail shows the
second — `index.test.ts:50`, an `AssertionError` from `.not.toContain`, not a transform or import
failure. The first is elided by `testReport`'s middle truncation; by elimination it is
`docs.test.ts`'s AC-13b block, the only other shared test either round changed and the one round 3
measured red. **No compile failures, then.** But see B-1: the one new red the gate's own artifact can
see this round is a red no task can turn green.

**Verdict: revise.** Satisfiability first, per this role's ordering. One assertion cannot go green
against any implementation obeying the contracts, and it takes development's `integrate` down with
it; and two of round 3's five remedies were answered in the document rather than in the tests.

---

## Blockers

### B-1 — AC-13c's new assertion can never go green, and it blocks the development stage as well as this one

`packages/shared/src/index.test.ts:47-52`, added this round:

```ts
test('shared never imports core', () => {
  for (const [name, text] of sharedSourceFiles()) {
    expect(importSpecifiers(text), `${name} must remain below core`).not.toContain(`${SCOPE}core`);
    expect(text, `${name} must not reach core by repository path`).not.toContain('packages/core');
  }
});
```

The second assertion scans the **whole text** of every shared source file. `sharedSourceFiles()`
(`packages/shared/test/corpus.ts:101-106`) returns every non-test `.ts` under `packages/shared/src`,
and `packages/shared/src/containment.ts:3` reads:

```
// the derivation lives in packages/core's git module (Q-0042) and the rendering in the CLI
```

That is the failure at `index.test.ts:50` in the report's tail. **This is the first of the two
unsatisfiability shapes — the fix lies in a file no task owns.**

- `containment.ts` is not named by any task. The only task touching `packages/shared` is
  `q0050-shared-events`, whose scope is *"Own `packages/shared/src/events.ts` **only**"*.
- The test cannot be fixed from development either: **all eight tasks say "Do not touch … tests"**.
- And the comment is *correct*. Deleting an accurate cross-reference from a landed module to satisfy
  an over-broad scan is the test wagging the source, and charter §2 would have a reviewer block it.

**It is worse than one red criterion.** AC-13c is a permanent structural guard, not a red test — the
scenarios document says as much. While it fails, `@quorum/shared#test` stays red **after
`q0050-documentation` lands**, so `@quorum/core#test` stays pruned for the whole fan-out, and
development's `integrate` with `expect: pass` can never go green. That is round 3's B-1 arriving
through a third door, one stage further downstream.

**The remedy is three lines and the file already contains both halves of it.** Assert over import
specifiers rather than file text — which is what the criterion says — and assemble the needle the way
`SCOPE` is assembled at `:11` *for exactly this reason*, so no `packages/core` literal is left in the
source (see B-3):

```ts
const CORE_PATH = `packages/${'core'}`;
…
for (const specifier of importSpecifiers(text)) {
  expect(specifier.includes(`${SCOPE}core`) || specifier.includes(CORE_PATH),
    `${name} imports ${specifier}`).toBe(false);
}
```

`codeLines()` (`packages/shared/test/corpus.ts:120`) is the other precedented tool here — it exists
for *"this token may appear in prose but never in code"*, which is this problem stated in the corpus
module's own words. Either works; the import-specifier form is stronger, because it tests the claim
rather than a proxy for it.

### B-2 — Round 4 added no tests. Thirteen of round 3's fourteen scenarios still have none, and the new table says they do

Measured by reading the branch: `harness/Q-0050/tests` at `1d79099` (round 3) carried **37 tests in
six engine files**; at `74a043b` (round 4) it carries **37 tests in six engine files**. The
`write-tests` commit message is accurate — *"Updated four existing test files; created no new
files"* — and `git diff 1d79099 74a043b` touches `engine.test.ts` (assertions added to one existing
test), `q0050.source.test.ts`, `turbo-inputs.test.ts` and `index.test.ts`. `channel.test.ts`,
`loaders.test.ts`, `lifecycle.test.ts` and `lifecycle-routing.test.ts` are byte-unchanged.

Round 3's item 4 was *"write the fourteen missing tests, **or** strike the scenarios with a stated
reason."* Round 4 did neither. It answered a test-existence question with prose: *"All fourteen
listed scenarios … are written out below with a concrete mechanism, not just a restated criterion."*
A mechanism written in a document is not an executing test, and the red phase's whole job is to show
the test failing. AC-10a is the one genuine closure — it now has the on-disk half of the dry
scenario. The other thirteen have nothing anywhere:

**AC-2b** · **AC-2c** · **AC-2f** · **AC-5a** · **AC-5b** · **AC-5e** · **AC-8b** · **AC-8c** ·
**AC-8d** · **AC-9e** · **AC-10d** · **AC-12c** · **AC-12d**

Round 3 named five it would not let through, and its reasons stand unchanged: AC-8b/c/d are the
entire observable surface of cross-flow regression, which E-3 puts in `engine.ts` where nothing
tests it; AC-12c and AC-12d are two of the eight preserved defects, and an implementer who "fixes"
either is green everywhere — the port's standing hazard.

**The new table makes this harder to see, not easier, which is the part that needs saying.** F-3
asked for the criterion → file → test map so that B-4 would be visible without a reviewer opening
seven files. As delivered it names sixteen tests that do not exist, including thirteen attributed to
`engine.test.ts`, which contains exactly three tests: *"is lazy, emits the exact banner, and ends in
one terminal event"*, *"rejects a stage mismatch before context construction or any write"*, and
*"dry is the same run but all three persistent writers are replaced"*. A traceability table whose
rows are aspirations reads as coverage and is not — *"a check that skips its subject must not report
success"* (2026-08-25), arriving in a table this time. Every row must name a test that exists, or say
`— none` in the state column.

### B-3 — The fixture-oracle remedy was applied to the document and not to the tests, and the AC-13c move traded six guard failures for new ones

Two halves, both measurable by reading.

**(a) Five of the seven owned texts still have no oracle.** The document claims *"the two
hand-retyped literals (`log.retryGrant`, `log.recordEvent`) and the two substring/prefix matches
(`log.terminal`, `log.gateAnswer`) are replaced with full-string equality against the fixture
value."* They are not — the two files holding them were not touched this round:

| Site | State at `74a043b` |
| --- | --- |
| `lifecycle.test.ts:55` | `expect.stringMatching(\`run=7 ${status} stage=\`)` — prefix; cost, tokens and `errorSuffix` untested |
| `lifecycle.test.ts:73` | `'run=7 exhausted stage=solutioned→solutioned cost=0'` — hand-retyped |
| `lifecycle-routing.test.ts:47` | `expect.stringContaining('answer=advance')` — substring |
| `lifecycle-routing.test.ts:104` | `'run=3 gate=retry counter=f.review set=2 (one further traversal authorised)'` — hand-retyped |

`run-messages.fixture.json` is still imported by exactly one file and referenced twice
(`engine.test.ts:57`, `:66` — `runBanner`, `terminalInfo`). `crossFlowRegression`, `loopIteration`,
`loopExhausted`, `exhaustionReason`, `rollback`, `gateAutoAdvanced`, `gateDryRun`, `log.rollback`,
`log.start` are asserted nowhere. Charter §2 preserves this text as externally observable behaviour;
five of seven owned sites have no oracle, so an implementer can ship wrong narration and be green.

**(b) Moving AC-13c into `packages/shared` looks likely to have reopened the guard on the other
side.** The document says the move *"costs no new register entry"*. `packages/core/src/turbo-inputs.test.ts`
scans both packages (`SUITES`, `:130-133`), and three of its own definitions decide this:

- `isLiteral` (`:1039`) is **"a single-quoted or double-quoted string … Nothing else is"**. So
  `'packages/core'` in `index.test.ts:50` is a collected path literal, and it names a **directory**
  that `packages/shared/turbo.json` does not declare — it declares `../core/package.json`,
  `../core/src/index.ts` and `../core/src/backlog/project.ts`, three files. Clause B's assertion at
  `:1687-1692` requires `undeclaredPaths('@quorum/shared#test', …)` to equal exactly four entries.
- `COLLECTED_BASELINE` is an identity register, not a floor — `packages/shared/src/index.test.ts`
  has exactly three entries (`:1623-1625`), all files. A fourth, unregistered, is a failure.
- By the same `isLiteral` rule, `q0050.source.test.ts:8`'s
  `repoFile(\`packages/core/src/engine/${name}\`)` is a **template**, so it is an indirect clause C1
  site (`:1796-1797`, `:1807`) needing an `INDIRECT_ROUTES` entry. Round 3's advice — "read through
  `repoFile()` … with no register edit at all" — held for the landed files because they pass
  *quoted literals*; a template is a different site.

I did not execute the guard, so treat (b) as derived rather than measured — but each claim cites the
line that decides it, and the remedy costs nothing either way. B-1's rewrite removes the
`'packages/core'` literal; and `q0050.source.test.ts` need not read at all, because `coreSourceFiles()`
already returns the text beside the name:

```ts
const engine = new Map(coreSourceFiles()
  .filter(([name]) => name.startsWith('engine/'))
  .map(([name, text]) => [name.slice('engine/'.length), text]));
const production = [...engine.keys()];
const source = (name: string): string => {
  const text = engine.get(name);
  if (text === undefined) throw new Error(`q0050.source.test.ts: no engine source named ${name}`);
  return text;
};
```

That deletes the `repoFile` route site outright rather than registering it, and throws rather than
defaulting, so the scan cannot pass over a subject that has gone.

---

## Findings

**F-1 — AC-3a's own stated requirement is unmet, and the document states it precisely.** The
scenario says the terminal event must be proved *"through `runFlow`/`engine.ts` (not through
`lifecycle.ts`'s `finish()` called directly, which only proves the payload's shape)"*. `engine.test.ts`
runs one status, `completed`. The other four are `lifecycle.test.ts`'s `test.each`, which calls
`finish()` directly — the thing the scenario rules insufficient. Either a second engine-level run per
status, or the scenario should say which half it is content with.

**F-2 — AC-4c's duplicate-answer clause is still unexercised.** `lifecycle-routing.test.ts:50-57`
covers no channel, a stale `gateId` and an invalid answer. The scenario's clause (i) — a second
`advance` envelope for a `gateId` **already answered** — has no test. It is the clause that matters
for M3, where two consumers can answer the same question.

**F-3 — AC-4g's mechanism was specified and not built.** The scenario asks for the log line to be
read *"synchronously inside the fake `answerGate` before resolving"*, which is what makes "before the
answer is acted on" observable. The test asserts only that `appendLog` was called with a substring,
after the fact.

**F-4 — AC-6d's ordering half is likewise specified and not built.** The scenario asks for the
`exhausted` entry and its log line to be read from disk *inside the still-unresolved callback*;
`lifecycle-routing.test.ts:88-96` asserts `recordOccurrenceEvent` was called and the gate event was
emitted, in no asserted order.

**F-5 — round 3's F-5 and F-6 are unchanged, and the document says both are fixed.**
`lifecycle.test.ts:106-107` still asserts `realBacklog.write`/`realBacklog.log` were not called, on a
view whose own `write`/`log` are `vi.fn()` — provably unreachable, which is why the document promised
its removal ("removed entirely, since it was provably unreachable"). And AC-9d still asserts call
counts on an injected `resetBranch` (`:76-92`); no real task branch exists in any test, so row 20's
carried gap is still argued with a mock's return value rather than a branch head.

**F-6 — AC-9f's rounded half is still untested.** `lifecycle.test.ts` asserts `cost: 1.23456` on
`finish()`'s payload and `cost: null` on an `outcome()` call that never had a cost. Nothing compares a
non-integer raw cost against the rounded value `outcome()` persists, which is the whole of the
criterion.

**F-7 — AC-11a's disk half is still unasserted.** `engine.test.ts:74-84` checks four substrings of the
refusal message. The scenario's added half — no `runs.log` line, no run directory under `.quorum/runs/`
— is the part that proves the refusal happens before any bookkeeping, and it is the part not written.

**F-8 — AC-13d's stronger half is still unasserted.** `q0050.source.test.ts:41-45` counts
`Why: preserved defect, see Q-0050 AC-12.` occurrences with `toBeGreaterThanOrEqual(2)`. The document
promises a count matching the number of preserved defects *and* a substring scan proving no line
transcribes a sentence from `docs/DECISIONS.md` or the ticket body. Neither exists — and a floor
rather than an identity is the exact shape Q-0073 replaced (*"a count is not an identity"*).

---

## Nits

- AC-1d's JSDoc scan is still `/\/\*\*[\s\S]*?export /` per file (`q0050.source.test.ts:14`), which
  one comment above one export satisfies. The document says *"Fixed in this round's rewrite of the
  scanner"*; the regex is unchanged. Anchor it per export.
- The AC-13c paragraph says `packages/shared/src/index.test.ts` *"already declares
  `packages/core/package.json` and `packages/core/src/index.ts` as inputs (line 48)"*. A test file
  declares no inputs; `packages/shared/turbo.json` does, and it names three specific files rather
  than the package. The distinction is what B-3(b) turns on.
- AC-5c/5d's `channel.test.ts:43-58` proves `return()` awaits its finaliser, which is the channel's
  half. The scenario also promises `interrupted` persisted "with the same shape as 5b"; the finaliser
  in that test is a bare promise, so the persistence half rides on AC-5b, which has no test.
- AC-10f's identity assertion lives in `engine.test.ts:104` (`toBe(originalIterations)`) over a flow
  with `steps: []`, so no counter is ever incremented on the aliased object. The scenario's own
  wording — *"a flow whose loop fails once during the dry run"* — is the discriminating half.
- AC-8a's *"a spy on B's step dispatch records zero calls"* is asserted as `finishRun` not having
  been called (`lifecycle-routing.test.ts:117`). The target flow's `{ id: 'never' }` step is present
  and nothing watches it.

---

## Coverage at criterion level

Executing tests at `74a043b`: **37** in `packages/core/src/engine/*.test.ts` (unchanged from round
3), **3** in `packages/shared/src/events.q0050.test.ts` (green, per E-6(c)), **2** in
`packages/shared/src/docs.test.ts` and `index.test.ts` (the two the report shows red).

| Criterion | Executing test | State |
| --- | --- | --- |
| AC-1a/1c | `q0050.source.test.ts` #1, #2; `corpus.test.ts:38` extended | green today (guards) |
| AC-1b | landed `fanout.source.test.ts`, `run-history.source.test.ts` | covered by inheritance — correctly stated |
| AC-1d | `q0050.source.test.ts` #1 | weak (nit) |
| AC-2a | `engine.test.ts` #1 | 2 of 7 texts (B-3a) |
| AC-2b, 2c, 2f | — | **none** (B-2) |
| AC-2d | `channel.test.ts` #1 | red ✓ |
| AC-2e | `events.q0050.test.ts` | green already, correctly declared (E-6(c)) |
| AC-3a | `engine.test.ts` #1 + `lifecycle.test.ts` each ×5 | partial — `completed` only at engine level (F-1) |
| AC-3b | `channel.test.ts` #2 | red ✓ |
| AC-3c/3d | `events.q0050.test.ts` | green already, correctly declared |
| AC-4a/4b/4d/4e/4f/4h | `lifecycle-routing.test.ts` #1–4; `q0050.source.test.ts` #4 | red ✓ |
| AC-4c | `lifecycle-routing.test.ts` #3 | partial — duplicate answer (F-2) |
| AC-4g | `lifecycle-routing.test.ts` #2 | partial — substring (B-3a, F-3) |
| AC-5a, 5b, 5e | — | **none** (B-2) |
| AC-5c/5d | `lifecycle-routing.test.ts` #5; `channel.test.ts` #3 | red ✓; persistence half rides on AC-5b |
| AC-6a/6b/6c/6e | `lifecycle-routing.test.ts` #6, #7, #4 | red ✓ |
| AC-6d | `lifecycle-routing.test.ts` #7 + `lifecycle.test.ts` #3 | partial — ordering (F-4), hand literal |
| AC-7a/7b/7c | `lifecycle-routing.test.ts` #8, #9 | red ✓; 7b still a hand literal |
| AC-8a | `lifecycle-routing.test.ts` #10 | partial — the stage half is untested |
| AC-8b, 8c, 8d | — | **none** (B-2) |
| AC-9a/9c | `lifecycle.test.ts` each ×5, #2 | red ✓ |
| AC-9b | `lifecycle.test.ts` each ×5 | partial — prefix oracle |
| AC-9d | `lifecycle.test.ts` #4 + `q0050.source.test.ts` #5 | partial (F-5) |
| AC-9e | — | **none** (B-2) |
| AC-9f | `lifecycle.test.ts` each ×5, #2 | partial — rounded half (F-6) |
| AC-10a | `engine.test.ts` #3 | red ✓ — **closed this round** |
| AC-10b/10c | `engine.test.ts` #3 | red ✓ — **B-3 of round 3 closed** |
| AC-10d | — | **none** (B-2) |
| AC-10e | `lifecycle-routing.test.ts` #4 | partial — no `gateDryRun` text |
| AC-10f | `engine.test.ts` #3 | partial (nit) |
| AC-11a | `engine.test.ts` #2 | red ✓; disk half missing (F-7) |
| AC-11b–11g | `loaders.test.ts` #1–5 | red ✓ |
| AC-12a/12b | `lifecycle.test.ts` #4, #5; `q0050.source.test.ts` #6 | red ✓ |
| AC-12c, 12d | — | **none** (B-2) |
| AC-12e | none, by E-5(b) | correctly not a test |
| AC-13a/13e | gate actions | n/a |
| AC-13b | `packages/shared/src/docs.test.ts` | red ✓ — satisfiable by `q0050-documentation` |
| AC-13c | `packages/shared/src/index.test.ts` | **unsatisfiable** (B-1) |
| AC-13d | `q0050.source.test.ts` #4, #6 | partial (F-8) |

---

## What round 5 has to change

**QA, in this loop — all mechanical, all in files QA writes:**

1. **B-1.** Rewrite `index.test.ts`'s AC-13c assertion over `importSpecifiers(text)` with an
   assembled needle, per the file's own `SCOPE` idiom at `:11`. Three lines. This is the one item
   that must land — everything else is rigour; this one is the difference between a red phase and a
   burnt fan-out.
2. **B-3(b).** Build `q0050.source.test.ts`'s six sources from `coreSourceFiles()`'s own text rather
   than a templated `repoFile`, throwing on a missing name.
3. **B-2.** Write the thirteen missing tests, or strike each with a stated reason and a `— none` row
   in the table. AC-8b/c/d, AC-12c and AC-12d I would not let through a second time: three are the
   whole observable surface of cross-flow regression and two are preserved defects nothing pins.
4. **B-3(a).** Interpolate the five unasserted owned texts and replace the two hand literals and two
   prefix matches with full-string fixture equality — in the test files, this time.
5. Make every traceability row name a test that exists, and mark the rest `— none`.
6. F-1 through F-8 where they are cheap: AC-11a's disk half, AC-9f's rounded half, AC-4c's duplicate
   envelope, AC-13d's identity count and no-transcription scan.

**Human, at the gate — nothing new is owed.** E-5, E-6 and E-7 already carry every item round 3
routed here, and E-7 correctly predicts this round's report. The decision entry *"What a run's event
stream carries, and how a gate answer travels back"* (2026-08-28) has landed since E-4 was written,
so `solution/errata.md`'s closing *"still owed"* paragraph is stale and its removal is the only
document change I would ask for — and it is a note, not a blocker.

**If you `advance` instead of `retry`, this is what ships.** A red phase pinning roughly 19 of 37
behaviours, with cross-flow regression, cancellation, `parallel` ordering and two of the eight
preserved defects unpinned, five of seven narration strings without an oracle — **and B-1 still in
the tree**, which stops `@quorum/core#test` from ever executing in `integrate` and makes
development's `expect: pass` unreachable. **B-1 must be fixed before the fan-out starts whichever
answer the gate gets.** It is a three-line edit to one test file; if the loop is not retried, it is
the E-5 shape again — a hand fix at the gate, recorded as an erratum, before `development` runs.
