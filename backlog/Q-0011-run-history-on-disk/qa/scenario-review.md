# Q-0011 — Scenario review (architecture reviewer)

*Reviewing `qa/scenarios.md` and `qa/red-report.md` for stage `qa-red`. Verdict: **approve**.*

Two questions decide this gate: does every live acceptance criterion have at least one scenario,
and does the red report show the suite failing on assertions rather than on compile errors. Both
are yes. I checked the claims against the artifacts rather than against the prose — the two new
test files on `harness/Q-0011/tests`, the four frozen contracts on `harness/Q-0011/contracts`,
`ticket.md` on `main`, and `spike/bin/harness.js` — because the scenario document itself warns
that the requirement, the contracts and the ticket body disagree in places.

## Coverage

Twelve criteria are live; AC-6 and AC-7 were retired in full by the 2026-08-23 scope cut. Every
one of the twelve has a scenario in the document and an executable scenario in the suite.

| AC | Scenario in `scenarios.md` | Executable scenario | Red status |
| --- | --- | --- | --- |
| AC-1 | 4 given/when/thens | `AC-1 initialises exclusively…`, `AC-1 fatal initialisation…` | red (assert) |
| AC-2 | 4 | `AC-2/EDGE-7` | red (assert) |
| AC-3 | 5 | `AC-3/AC-4/AC-5/AC-8`, `AC-3 parallel…`, `AC-3/AC-10/EDGE-9` | red (assert) |
| AC-4 | 5 | `AC-3/AC-4/AC-5/AC-8`, `AC-4/AC-5`, `AC-4/EDGE-8`, `EDGE-5/EDGE-8/EDGE-14` | red (assert) |
| AC-5 | 4 | `AC-3/AC-4/AC-5/AC-8`, `AC-4/AC-5` | red (assert) |
| AC-6 | retired — declared, not dropped | — | n/a |
| AC-7 | retired — declared, not dropped | — | n/a |
| AC-8 | 4 | `AC-3/AC-4/AC-5/AC-8`, `AC-8/AC-10` | red (assert) |
| AC-9 | 5 | `AC-9/AC-10/EDGE-4`, `AC-9/EDGE-19` | red (assert) |
| AC-10 | 5 | `AC-9/AC-10/EDGE-4`, `AC-8/AC-10`, `AC-3/AC-10/EDGE-9` | red (assert) |
| AC-11 | 7 | `AC-11` | red (assert) |
| AC-12 | 5 | `AC-12/EDGE-10/EDGE-11`, `AC-12 missing history…` | red (assert) |
| AC-13 | 5 | `AC-13/EDGE-9`, `AC-13/EDGE-20`, `AC-13/EDGE-12` | red (assert) |
| AC-14 | 5 | `AC-14` (green), `AC-14/EDGE-13` (red) | red (assert) |

All twenty-one edge cases carry a scenario as well: EDGE-1 through EDGE-9, EDGE-14, EDGE-19 and
EDGE-21 on the writer side, EDGE-9 through EDGE-13, EDGE-15 through EDGE-18 and EDGE-20 on the
reader side. Nothing in the document is orphaned and nothing in the suite is unsourced.

AC-6 and AC-7 deserve a note, because "no scenario" is normally the finding this review exists to
make. Here it is correct. The scope cut removed the event stream in full, the numbering was
deliberately preserved so the four review rounds and the frozen contracts keep pointing at the
same criteria, and the document says so in both the AC list and its scope-cut section rather than
leaving a silent gap. The vendor-neutrality those criteria carried is now carried by AC-9, and
AC-9 is tested.

## The red is on assertions, and it is deep

Both new files loaded and executed. `q0011-run-history.js` ran two scenarios green before its
failures, `q0011-runs-cli.js` ran one — which is the proof that matters, because a link-time
failure on any of the file's imports (`withRetry` from `spike/src/adapters/index.js`, `validate`
from `spike/src/contracts.js`, `mockAdapter`, the frozen schema read from disk) would have
executed zero. I confirmed `withRetry` is exported at `spike/src/adapters/index.js:68`. There is
no `SyntaxError` and no `ERR_MODULE_NOT_FOUND` anywhere in the report.

Every one of the twenty-four failures is a `node:assert` failure: strict-equal diffs, `Missing
expected rejection`, `assert.match` regex misses, one `assert.doesNotThrow` reporting an unwanted
exception, and several custom assertion messages. The environment was sound underneath them —
`red-integration.md` records `npm install --prefix spike` exiting 0 before `npm test` exited 1,
which is the invariant the 2026-08-22 decision on false reds requires. And `smoke.js` and
`q0006-engine.js` both stayed green: "2 of 4 test file(s) failed" is the two new files and only
the two new files.

Sixteen of the writer failures bottom out on the same assertion — `expected exactly one persisted
run manifest`, `0 !== 1`. That is the right signature for an unbuilt writer rather than a shallow
one: the flow runs, the mock adapter is exercised, the steps complete, and only the artifact is
absent. The failures that are *not* that shape are the ones worth having, and each names a defect
that writing a manifest alone cannot make green:

- `'mock' !== 'claude'` — per-call vendor declaration is not yet honoured (EDGE-4). The static
  `adapter.vendor` is still winning, which is exactly what the contract forbids.
- `3 !== 9` — the retry wrapper's accumulator drops `cached_input_tokens` across attempts. This
  is round 7's finding, still live, and the scenario pins both the retry-success and the billed-
  throw path.
- `undefined !== null` — unknown measures come back absent rather than `null`, against AC-9's
  requirement that all five keys exist.
- `Missing expected rejection` — `MOCK_RUN_HISTORY_PROFILES` is not consulted at all yet, so
  neither EDGE-19's explicit-failure rule nor AC-1's existing-directory refusal fires.

On the reader side all four display failures share one root: `runs` is an unknown command, so
`harness.js` prints its usage banner and exits 0. That is a clean assertion failure against real
output, not a crash, and it also tells me the fixtures are isolated correctly — `--project` is an
existing flag parsed at `spike/bin/harness.js:41`, not something the tests invented, which is why
the `validate` scenarios reach the schema at all.

## The three green scenarios are correct

A red report containing passes invites suspicion, so I traced all three. `EDGE-21 — error
category vocabulary is frozen and exhaustive` deep-equals the eight-value enum in the frozen
schema; `EDGE-1 — task ownership remains two-vendor and disjoint` matches `tasks.yaml`'s two
roles and two owned path sets; `AC-14 — real schema validation rejects structural mutations` runs
`harness validate` against the committed schema, which already exists. All three assert over
artifacts that landed on the contracts branch before fan-out. A red phase that failed them would
mean the contracts were wrong, not that the feature was missing — and note that the semantic
sibling, `AC-14/EDGE-13`, correctly fails at `0 !== 1`, so the E-2 semantic pass is genuinely
unbuilt and genuinely tested.

## Two things for the maintainer, neither blocking

**`ticket.md`'s body still contradicts the approved scope.** Testability Flag 1 is accurate, and
the risk is live rather than theoretical: the body on `main` still ends "an events schema that
qa-red can fail a real artifact against", the sentence the scope cut was meant to remove, and
`spike/src/engine.js:352` splices it into every downstream prompt — including the prompt that
produced this review, where I read it verbatim. No task owns `ticket.md`, so nothing in this
ticket's implementation fixes it. Correct it before `harness run development Q-0011`, or a
developer agent will be told to build a feature the scope cut deleted while its own contracts say
otherwise. QA was right to flag it rather than quietly write scenarios around it.

**`scenarios.md`'s EDGE-21 omits the `adapter` error category.** The frozen enum has eight
values — `auth`, `transient`, `structured_output`, **`adapter`**, `script`, `integrate`,
`interrupted`, `unknown` — and the writer contract maps "other adapter failures" to `adapter`.
The scenario prose enumerates five, plus `interrupted` and an `unknown` fallback, and never
mentions `adapter`. This is a prose gap, not a coverage gap: the suite covers the value twice
(`AC-9/AC-10/EDGE-4` asserts `error.category === 'adapter'` on a billed mock failure, and the
vocabulary scenario deep-equals all eight). But the prose is what a human reads at the next gate,
and it currently under-describes the contract it is quoting. One line, whenever `qa/` is next
opened legitimately.

## One thing to expect during development

`AC-11`'s scenario forces its fail-before-usage occurrence by giving the third role a profile
with `cached_input_tokens: -1`, so a single scenario carries both EDGE-19's explicit-failure rule
and E-1's usage-null roll-up rule. That is legitimate — E-1 needs an occurrence that dies before
reporting usage, and the mock's frozen switch surface offers no cleaner lever — but if E-1's
roll-up handling is wrong while EDGE-19's rejection is right, the failure will point at the mock
switch rather than at the roll-up. Expect one round of misattributed diagnosis there, and read
the assertion line rather than the scenario title.

Also worth recording, because it is easy to mistake for a defect: EDGE-20 documents that the
roll-up's `step_count` can be lower than the number of occurrences the run actually ran, and only
the detail view says so. That is E-1's accepted trade-off, it is tested from both sides
(`AC-11`'s no-vendor-row assertion and `AC-13/EDGE-20`'s fixture, which asserts its own roll-up
sums to two while three steps are listed), and it should not be "fixed" during development.

## Verdict

**Approve.** Every live acceptance criterion has a scenario and an executable test; AC-6 and AC-7
are declared retired with their rationale rather than silently missing; the suite fails on
assertions with a clean environment and a green regression suite behind it; and the failures name
specific unbuilt behaviour rather than a missing module. This is a red phase for the right
reason. Fix the `ticket.md` sentence before `development` runs.
