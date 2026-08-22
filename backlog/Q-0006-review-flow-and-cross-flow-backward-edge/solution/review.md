# Q-0006 — Architecture review of `solution/draft.md` (round 3)

**Verdict: revise.** Two blockers, two majors, five minors. The approach, the decomposition and
the ownership model are right and unchanged; do not touch them. Both blockers are contract edits,
and one of them exists because round 2's suggested fix was itself off by one — that is my error to
own, not the architect's.

Verified against `main` at `4c69a48` (line numbers below are that tree), the contracts branch
`harness/Q-0006/contracts` at `28432ce`, the four shipped flows and roles, `spike/package.json`
and `spike/test/smoke.js`.

## Round 2 is closed — all of it

Stated first and in detail so the revision does not undo any of it.

- **B1 resolved, and I checked the file, not the claim.** `git diff 3482247..28432ce` touches only
  `contracts/Q-0006/**`, `harness/architecture.md` and `harness/roles/developer-backend.md`.
  `spike/templates/harness/roles/developer-backend.md` still reads `paths: [services/api,
  packages/domain]`. The template-sharing rule is now written down in `architecture.md`, and it is
  the right rule: flows and `code-reviewer.md` byte-shared, config/context/developer roles
  repo-specific.
- **B2's ambiguity resolved** — one integer is named, QA knows what to assert. The *value* is
  wrong; see Blocker 1. This is a different defect from the one round 2 raised.
- **B3 resolved.** `major: src/mock.ts:1 (mock) placeholder finding` satisfies
  `^(blocker|major|nit): .+:[1-9][0-9]* .+`. I ran the pattern against it.
- **B4 resolved.** The runtime contract binds `harness run` to the full directory validation before
  any `adapter.run` *and* before any ticket-folder write — the second half matters, because
  `runFlow` writes `runs.log` at `engine.js:68` before the first step. `Q0006-cli-lint` owns it.
- **B5 resolved.** `spike/test/smoke.js:70-73` is named, the qa-red list says invert it, and the
  non-TTY behaviour is specified as exit non-zero rather than block. That is the correct call:
  `spawnSync` gives the child an EOF stdin, so `readline.question` would never resolve.
- **M1–M5 resolved.** The qa-red list covers the eight previously untested criteria; exhaustion is
  a zero-cost event with one full-cost terminal event, which is right because `board`
  (`bin/harness.js:96`) sums `h.cost` over history; `--gate-answer` is repeatable and consumed in
  encounter order; `init` outside git keeps `main` and succeeds; `contracts/` is absent from the
  backend role's paths and every task freezes `contracts/Q-0006/**`.
- **N1–N5 resolved**, including the honest note that the engine reads role-body prose and never
  `paths` frontmatter (`engine.js:127`, `loadRole`), and that `harness/architecture.md` is still
  placeholder prose outside the role table.
- **Re-verified from round 1 and still true:** AC-3 (no invented engine field), the existing
  cross-vendor lint passing on the shipped flow (`engine.js:43-49` — the verdict's inputs name
  `claude.md` and `codex.md`, whose producers are two different adapters), `output.writes` writing
  the same `document` to both the round path and the stable path (`engine.js:171-174`), the
  `{round}` interpolation reaching `input.backlog` (`engine.js:294`), the four-task serial chain
  producing four single-task waves each merged into `harness/Q-0006/integration` before the next
  (`engine.js:348-373`, with `ticket.meta.branch` = `harness/Q-0006/integration`, `backlog.js:64`),
  and `readFiles` returning `[]` for an absent `review/verdict.md` so AC-21 cannot break the
  existing `draft → green` path (`backlog.js:74-84`).

---

## Blockers

### B1. `retry` set to `max_iterations - 1` buys two more regressions, not one

`review-runtime.contract.md`: *"`retry` sets only `iterations.review` to `max_iterations - 1`
(persisted value `2` for the shipped limit), then regresses to the configured target."*
`draft.md`, chosen approach: *"`retry` grants exactly one additional regression traversal."*
AC-18: *"`retry` authorises exactly one more traversal."* Those are not the same behaviour, and the
contract's own trace proves it.

Trace with `max_iterations: 3`:

| event | `iterations.review` | outcome |
| --- | --- | --- |
| rejection 1–3 | 1, 2, 3 | regress (`n <= max_iterations`, `engine.js:208`) |
| rejection 4 | 4 | exhaustion gate |
| answer `retry` | set to 2 | `runGate` returns `{goto: 'flow:development'}` (`engine.js:223`) → `runFlow` regresses and ends the run (`engine.js:78-82`) — **regression A** |
| next rejection | 3 | `3 <= 3` → regress — **regression B** |
| next rejection | 4 | gate again |

One `retry` therefore buys two full development→review round trips, i.e. up to eight more agent
calls, on the answer the human gave to *stop* the loop. Round 2's B2 offered `max_iterations - 1`
and asserted it means "the very next rejection re-presents the gate" — that arithmetic was wrong,
and the architect implemented it faithfully and then documented the real consequence accurately.
The document is now internally consistent with the engine and inconsistent with AC-18.

This is the ticket's core safety property, so it does not get to be approximate.

**Fix (pick one, and make all three statements agree):**

- (a) `retry` persists `iterations.review = max_iterations` (shipped value **`3`**). Regression A is
  the one extra traversal; the next rejection increments to 4 and re-presents the gate. This is what
  AC-18 says and it needs no requirement change. Recommended.
- (b) Keep `max_iterations - 1` and state plainly in the contract, the draft and `runs.log` that a
  human `retry` authorises **two** further traversals — and get AC-18 amended, which is Ruud's call,
  not the architect's.

Either way keep D4's scope clause, and have QA assert the integer in `ticket.md` plus the exact
number of regressions that follow before the gate returns.

### B2. Both `.schema.json` contracts are written in a language nothing in this repository can run

`spike/package.json` declares one dependency, `yaml`. `npm test --prefix spike` is
`node test/smoke.js` — no framework, no validator. The only validation in the codebase is
`checkAgainstSchema` (`adapters/index.js:93-101`), whose own comment reads *"Minimal schema check:
required keys present, enums honoured. Not a full validator on purpose."* It cannot express
`oneOf`, `pattern`, `if/then`, `minItems`/`maxItems` or `additionalProperties` — which is every
constraint that gives `review-artifacts.schema.json` and `ticket-review-state.schema.json` their
value. Meanwhile the draft states: *"No dependency is added."*

So the qa-red list contains two entries QA cannot implement as written — *"schema-valid mock
`changes-requested` artifacts"* and *"legacy ticket-schema compatibility"* — and the draft's
Verification section claims only that the two files **parse**, which is not the same as being
executable against anything.

There is a second, independent defect in the same area, and it needs its own answer:
**`review-artifacts.schema.json` describes an object the system never persists.** The engine writes
the markdown `document` to the `writes` paths (`engine.js:171-174`) and
`{verdict, findings, summary}` to `.harness/<step-id>-verdict.json` (`engine.js:175-178`). That JSON
has no `document`, and the schema's verdict branch requires `document` with
`additionalProperties: false`. An end-to-end assertion "the verdict artifact validates against the
contract" therefore fails on every run, and no task is authorised to change what is persisted. QA
would write a red test that no development task can turn green.

And the runtime consequence: `schemaFor` (`engine.js:271-281`) gives the verdict step
`findings: {type: 'array', items: {type: 'string'}}` with no pattern and no coupling to `verdict`,
so a real Claude verdict returning `approve` **with** findings, or a finding with no `file:line`,
passes `checkAgainstSchema` and the run advances to `reviewed`. AC-6's second sentence and AC-7's
citation format are, today, enforced for the mock only.

**Fix — all three parts:**

1. Say which artifact each schema governs. For `review-artifacts.schema.json` the honest subject is
   the adapter's returned `output` object, tested by a unit test that calls `mockAdapter().run()`
   directly. If you want an end-to-end assertion instead, give `Q0006-runtime` an explicit clause to
   persist the full structured output in `.harness/<step-id>-verdict.json` (adding `document`) and
   say so in the runtime contract.
2. Say how the schemas are executed. Either add a validator to `spike/package.json` as a
   devDependency — the rules permit it with a one-line justification in the solution document, and
   the "No dependency is added" sentence then has to go — or keep the two files as documentation and
   write out, clause by clause, the hand-rolled assertions QA implements (regex on each finding,
   `findings.length === 0` on approve, the `oneOf` legacy/new history discrimination, the
   `cost === 0` rule for `exhausted`). Naming the clauses is what makes them testable; a JSON Schema
   nobody can run is prose in JSON clothing.
3. Decide, in the runtime contract, whether the engine rejects `approve` + non-empty findings and
   malformed `file:line` citations from a **real** vendor via the existing AC-23 invalid-output path,
   or whether it accepts them. Both are defensible for M1; silence is not, because AC-6 and AC-7
   read as behaviour and are currently mock-only.

---

## Majors

### M1. `README.md` is outside the backend role's write allow-list, and AC-30 requires it

`Q0006-assets-docs` is told to own `README.md`. The role table added to `harness/architecture.md`
on the contracts branch gives backend `spike/`, `harness/`, `docs/`, `backlog/`, and
`harness/roles/developer-backend.md` says *"only in your allowed paths: spike, harness, docs,
backlog. When a contract is wrong, you stop and report it rather than improvise."* A development
agent following its role stops; one that does not, violates the allow-list this ticket's safety
story is built on. AC-30 requires the README to gain `harness run review <id>`.

**Fix:** add `README.md` (or the repo root's markdown) to both the architecture table and the role
body and frontmatter, or move the README line to an owner that may write it. One line either way —
but it has to be made, because M5 of round 2 established that the allow-list is a contract, not a
hint.

### M2. Real-CLI evidence is assigned to a fan-out development task, which cannot produce it

`Q0006-assets-docs` lists *"ticket-local real-CLI evidence"* as a deliverable, and the qa-red list
says *"Real-CLI evidence saved in the ticket folder verifies diff delivery and semantic severity
behavior that JSON Schema cannot prove."* A development agent runs inside a worktree, under
`--adapter mock` in the regression suite, and cannot spawn a paid multi-vendor review run — nor
should it: it would be nondeterministic, it would spend the user's subscription from inside a
fan-out, and BYOS means no test may depend on a login. Open question 3 already assigns the evidence
to "this ticket's implementation", meaning the maintainer.

**Fix:** remove it from the task description; record it as a maintainer action at the closing human
gate (a file the human drops into the ticket folder after the first real `harness run review`), and
state explicitly that no automated test asserts its presence. Then AC-7's honest split reads:
instruction text tested literally, schema tested on mock output, semantic severity behaviour
evidenced by hand.

---

## Minors

1. **The run preflight must lint the flow files on disk, not the in-memory flow.**
   `bin/harness.js:136` calls `overrideAdapters(flow, 'mock')`, which rewrites every step's adapter.
   If the preflight validates that object, AC-26's "same-role parallel group must span two adapters"
   fails on every `--adapter mock` run — that is the entire regression suite. The lint contract says
   "directory validation", which implies re-reading files; say it in one clause so no one has to
   rediscover it at 30 checks red.
2. **No task owns the ticket-body correction D1 requires.** D1: *"The ticket body and the §3.4
   diagram are corrected in the same change."* `backlog/` is in the backend allow-list and
   `Q0006-assets-docs` already owns the §3.4 fix; add `backlog/Q-0006-…/ticket.md` to it, noting the
   engine owns the frontmatter and the agent may only touch the body.
3. **The panel steps carry no `instructions`.** Everything the reviewers are told about severity and
   citations reaches them through the role body. That is a legitimate choice, but AC-7's
   "instruction text tested literally" then covers the verdict step only — say so where AC-7's
   testing split is described, so QA does not go looking for panel instructions to assert.
4. **State the consequence of a persisted counter after `advance`.** After an exhaustion gate
   answered `advance`, `iterations.review` stays at 4 forever, so a later review (after a qa-final
   regression under Q-0012) exhausts on its first rejection with no traversals at all. That follows
   from "the counter is persisted on the ticket" and may well be intended, but Q-0012 inherits it;
   one sentence in the runtime contract turns a surprise into a decision.
5. **`{base}` deserves the same treatment as `{round}`.** The runtime contract defines it at review
   run start; the flow fixture uses it in `input.diff`. `interpolate` (`engine.js:319`) leaves
   unknown variables as literal text, so a missing `base` var produces the range
   `{base}...harness/Q-0006/integration` and a git error rather than the named preflight failure
   AC-12 promises. Worth an explicit clause that `{base}` is populated before the ref check runs.

---

## Acceptance-criterion coverage

| AC | Task | Contract | Test | Status |
| --- | --- | --- | --- | --- |
| 1 flow exists, lints, byte-identical | assets-docs | flow fixture | QA list | ok |
| 2 `code-reviewer` role | assets-docs | role contract | QA list | ok |
| 3 engine-supported fields only | assets-docs | flow fixture | AC-27 runs | ok — re-verified field by field |
| 4 two reviewers, two vendors | assets-docs | flow fixture | AC-27 runs | ok |
| 5 reviewers read-only | runtime | runtime §diff | QA list | ok |
| 6 verdict step | assets-docs | flow fixture + artifacts | QA list | **B2** (findings/verdict consistency unenforced off-mock) |
| 7 severity threshold | assets-docs | flow instructions + artifacts | QA list | **B2 + minor 3** |
| 8 rounds never overwrite | runtime | runtime §config | QA list | ok |
| 9 stable `review/verdict.md` | assets-docs | flow fixture | QA list | ok |
| 10–11 diff materialisation + range | runtime | runtime §diff | QA list | ok |
| 12 base branch configured | cli-lint | runtime §config | QA list | ok — **minor 5** |
| 13 derived regression | runtime | runtime §routing | QA list | ok |
| 14 run stops; CLI reports | runtime | runtime §routing | QA list | ok |
| 15 counter persisted; board | runtime + cli-lint | runtime §routing + lint | QA list | ok |
| 16 exact bound + lint | cli-lint | lint contract | QA list | ok |
| 17 exhaustion gate vs `--auto` | runtime | runtime §routing | QA list | ok |
| 18 three distinct answers | runtime | runtime §routing | QA list | **B1** |
| 19 no defaulted answer | cli-lint | runtime §routing | QA list | ok |
| 20 rework sync | runtime | runtime §rework | QA list | ok |
| 21 developers see verdict | runtime | runtime §rework | QA list | ok |
| 22 outcomes distinguishable | runtime | state schema | QA list | **B2** (schema not executable) |
| 23 invalid output stops cleanly | runtime | runtime §atomic | QA list | ok |
| 24 asymmetric panel | runtime | runtime §atomic | QA list | ok |
| 25 cross-flow targets resolve | cli-lint | lint contract | QA list | ok — **minor 1** |
| 26 single-vendor panel fails lint | cli-lint | lint contract | QA list | ok — **minor 1** |
| 27 mock suite covers the loop | qa-red | all | — | ok |
| 28 determinism switches | mock-switch | mock contract | QA list | ok |
| 29 everything else green | qa-red | — | QA list | ok |
| 30 docs agree | assets-docs | — | — | **M1** (README unowned by the role) |
| — real-CLI evidence (open q. 3) | assets-docs | — | — | **M2** |

Every acceptance criterion maps to a task; every task references at least one contract; the serial
chain and its file ownership are sound. What is missing is executability in two contracts and one
integer.

## What I need to see to approve

1. One definition of `retry`, with the persisted integer and the number of regressions that follow
   it, agreeing across AC-18, `draft.md` and `review-runtime.contract.md`. (B1)
2. The subject and the execution mechanism of both `.schema.json` contracts — which object is
   validated, by what, and whether the engine enforces verdict/findings consistency for real
   vendors. (B2)
3. `README.md` inside the backend allow-list, or a different owner for AC-30's README line. (M1)
4. Real-CLI evidence moved off the fan-out and named as a maintainer action with no automated
   assertion. (M2)
5. The five minors folded in as clauses — they are one sentence each.

Everything else I would take on call today.
