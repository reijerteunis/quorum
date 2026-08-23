# Q-0011 — architecture review of the solution, revision 4

*Reviewer: architecture-reviewer. Round 4. Verdict: **revise** — four blockers, four majors, three nits.*

## What I checked against

`requirements/merged.md`, `solution/draft.md` (rev 4), `solution/errata.md`, `harness/architecture.md`, `harness/rules.md`, and the five contracts as they actually exist on `harness/Q-0011/contracts` (commit `f974f04`). Then against the code the contracts have to land on: `spike/src/engine.js`, `spike/src/adapters/{index,claude,codex,mock}.js`, `spike/src/git.js`, `spike/src/contracts.js`, `spike/bin/harness.js`, `spike/test/smoke.js`.

Note for the record: `contracts/Q-0011/` does not exist on `main`. It exists only on the contracts branch. That matches the stated sequencing ("the contracts branch lands before QA-red and development fan-out"), so it is not a finding — but it does mean this review is of the branch, not of the working tree.

## What is right, and worth keeping

This revision is materially better than a document that merely survived three rounds, and three things deserve to be named because a later round should not undo them.

**The Ajv trap is caught.** `spike/src/contracts.js:17` holds one module-level Ajv instance and `validate()` calls `ajv.compile(schema)` on every invocation. I confirmed the behaviour directly: compiling the *same object* twice is cached and silent, compiling a *different object with the same `$id`* throws `schema with key or id "…" already exists`. Today's `harness validate <schema> <a.json> <b.json>` re-reads the schema per file via `validateFile()` (`bin/harness.js:154`), so the moment a contract carries an `$id` — as both Q-0011 schemas do, and neither Q-0006 schema does in a form that collides — the second file crashes the command. `runs-cli.contract.md:42-43` requires exactly the fix ("compiles the schema once per invocation and reuses that same schema object… must not re-register the same `$id`"). That is a latent bug found by reading, not by running, and the contract closes it.

**Occurrence allocation is deterministic by construction.** `run-history-writer.contract.md:36-40` requires synchronous allocation at step-attempt start, ordered by allocation rather than completion. That is not a stylistic preference: `runStep` fans parallel siblings out with `Promise.allSettled(step.parallel.map(...))` (`engine.js:120`), and `runAgentStep` runs `loadRole`, `getAdapter`, `ensureWorktree` and `buildPrompt` synchronously before its first `await`. Allocating there — and only there — makes the parallel directory names reproducible, which is what AC-4's test needs. Getting this right is the difference between a testable contract and a flaky one.

**E-1 follows the Q-0006 precedent properly.** A dated erratum that names the superseded clause, is referenced from `ticket.md`, and states its own scenario impact, rather than a test quietly outvoting a requirement. The reasoning is also correct: `adapter` is routing metadata and `usage.vendor` is the billing vendor, and grouping the roll-up by the former would produce a row that cannot be reproduced from the event stream. It does not weaken the ticket's motivating example — the Q-0006 crash carried usage on the thrown error (`claude.js:44`, `codex.js:82`), so the $4.54 case is an *included* occurrence, not an excluded one.

**Ownership is genuinely disjoint.** `spike/src/**` to backend/codex, `spike/bin/harness.js` to tooling/claude, `spike/test/q0011-*.js` to QA. That is the seam M1's definition of done asks for, and unlike Q-0006 it is real rather than asserted.

---

## Blockers

### B1 — Nothing can emit a schema-valid `step_started`, so AC-2's argv record has no producer

`run-events.schema.json:287-338` makes `step_started_data` require all six of `step_id`, `kind`, `role`, `adapter`, `model`, `argv`, with `additionalProperties: false`. `run-history-writer.contract.md:52` says "Persist argv only in `step_started.data.argv`; there is no `spawn` event." `run-history-writer.contract.md:10-11` says built-in adapters translate native output into `{type, data}` payloads and that "an adapter never supplies run metadata."

Those three sentences cannot all hold.

- `argv` is constructed inside the adapters — `claude.js:21-29` and `codex.js:32-50` — and never leaves them. `adapter.run(options)` receives `{prompt, schema, model, cwd, extraDirs, maxTurns, allowWrite, onEvent}` (`adapters/index.js:3`) and no step identity, so the adapter cannot populate `step_id`, `kind` or `role`.
- The engine knows `step_id`, `kind`, `role`, `adapter` and `model`, and never sees argv. What the adapters emit today is not even the raw material: `claude.js:31` emits `{type: 'spawn', cmd: <string>}` where `q()` (`claude.js:65`) quotes and truncates each token to 80 characters with an ellipsis. There is no argv array anywhere.
- Deferring the event until argv exists is not available either. AC-6 requires `seq` to start at 1 and requires `tail -f` on a live run to show progress, so `step_started` has to be the first line and has to precede the spawn.

QA is required by AC-2 to write a test that a spawn record carries argv and no environment value. There is no way to write it, because the contract does not name the layer that produces it. Fix by naming the mechanism in one sentence — either the engine passes an occurrence handle plus step metadata into `adapter.run(options)` and the adapter emits the event (which means amending `:10-11`), or `step_started` carries `argv: null` at seq 1 and a separate typed event carries argv at spawn time (which means adding that type to the enum and to AC-2's test). Either is fine. Silence is not.

### B2 — AC-7's raw-deletion test manufactures precisely the `seq` gap that AC-6, AC-13 and AC-14 require to be an error

`run-history-writer.contract.md:14-15` makes `raw` preservation-only: "removing all `raw` lines cannot change a timeline's terminal state, usage, verdict, retries, or roll-up." `mock-adapter-run-history.contract.md:19-20` reinforces it in file terms: "deleting all raw lines proves they are not required." The requirement's AC-7 states the test outright: "the test asserts that the timeline and the roll-up are unchanged when every `raw` event is deleted."

But `seq` is a contiguous per-occurrence counter stamped by the writer (`run-history-writer.contract.md:46`), and deleting an interior line leaves a hole. `runs-cli.contract.md:30` makes non-contiguous `seq` an incompleteness condition the reader must report; `runs-cli.contract.md:38-39` makes it a validation failure; AC-14 requires a `seq` gap to exit 1 with a named error.

So the same artifact must be simultaneously valid (AC-7) and invalid (AC-6/13/14). QA writing both tests as specified produces a suite that contradicts itself against frozen contracts, which is the exact failure the frozen-contract rule exists to prevent. Resolve it explicitly: state whether the raw-independence check is performed over an in-memory filtered event list (my recommendation — it tests the property without fabricating a corrupt file) or over a rewritten file whose `seq` values are renumbered, and say so in both the writer contract and the mock contract.

### B3 — The auto-advanced gate has no defined occurrence, and it is the path every regression test takes

`run-history-writer.contract.md:73-75` defines gate occurrences only for an *answered* gate: "A gate answer (`advance`, `retry`, or `abort`) is a successful gate occurrence: its occurrence status is `completed` and its answer is the `verdict`."

`runGate` never reaches an answer on two common paths (`engine.js:260-262`):

```js
if (kind === 'auto' || (ctx.auto && kind !== 'human-locked')) { ...; return null; }
if (ctx.dry) { ...; return null; }
```

`--auto` is not an edge case here — it is the regression suite. Every run in `spike/test/smoke.js` uses it (lines 38, 41, 49, 62, 68, 84, 103, 119), with one deliberate exception at line 221. So in essentially every test QA will write, it is undefined whether an auto-advanced gate allocates an occurrence directory at all.

This is not cosmetic. Occurrence directories are numbered by a single per-run counter, and `occurrence_dir` is pattern-checked by `run-manifest.schema.json:57` and used by the reader for ordering (`runs-cli.contract.md:17`). Whether the gate consumes a number changes the directory name of every occurrence after it. QA cannot assert a directory name, and the AC-4 backward-edge and fan-out tests both assert directory names.

Define it: does an auto-advanced gate produce an occurrence (and if so, what `verdict` — `"advance"`, or `null`, which the schema permits), and does a `--dry` gate produce one (AC-1 says a dry run writes no run-history directory at all, so presumably not, but say it).

### B4 — The mock contract promises its switch values never reach artifacts, then defines one as the value written into every usage object

`mock-adapter-run-history.contract.md:4-5`: "their values control fixture data and are never copied into run-history artifacts."
`mock-adapter-run-history.contract.md:7`: "`HARNESS_MOCK_VENDOR`, when non-empty, is the emitted usage vendor."

The second sentence is the first sentence's counterexample. `HARNESS_MOCK_VENDOR`'s value becomes `usage.vendor`, which is a required field on every usage object (`run-events.schema.json:244-251`, `run-manifest.schema.json:41`) and the grouping key of every roll-up row. The same applies to the vendor names inside `HARNESS_MOCK_RUN_HISTORY_PROFILES` (`:12-15`), which is described as "the deterministic lever for producing priced and token-only vendors in one real run" — that is, the lever whose whole purpose is to put its values into artifacts.

AC-2 requires a test that "no file written under `.quorum/runs/` contains the value of any environment variable," and the multi-vendor roll-up tests for AC-11 and AC-12 require the profiles switch. Written literally, those tests fail each other. Fix by scoping the promise to what it actually means — the switches themselves, and any value not part of the contracted usage shape, are never persisted — and by scoping AC-2's assertion correspondingly (I would state it as: no artifact contains the name or value of a `HARNESS_*` switch, and no artifact contains a process-environment object).

---

## Majors

### M1 — `fan_out` is a fourth step kind with no place in the `kind` enum

`run-manifest.schema.json:58` and `run-events.schema.json:294-301` fix `kind` at `adapter | script | integrate | gate`. `engine.js:137` dispatches a fifth case: `if (step.fan_out) return runFanOut(step, ctx);`. `runFanOut` (`engine.js:429-441`) is a real step with its own `step.id`, its own `ui.info` lines under that id, and a wave loop that calls `runAgentStep` per task.

`run-history-writer.contract.md:36` says "Allocate an occurrence synchronously at step-attempt start," with no exemption for a container step. So either the fan-out parent gets an occurrence and has no legal `kind`, or it does not and nothing says so. AC-4 requires a fan-out test whose step id contains `:` and whose directory names are asserted; the parent's presence shifts every child's `seq`. One sentence in the writer contract settles it. My recommendation: the fan-out parent allocates no occurrence, and the contract says that explicitly.

### M2 — `$id`-keyed validation degrades silently, against the "never default silently" rule

`runs-cli.contract.md:37-39` and `:45-48` apply the `seq` stream invariant and every manifest semantic check only "when the loaded schema `$id` is the Q-0011 event schema." The `$id` is the literal string `https://quorum.local/contracts/Q-0011/run-events.schema.json`.

Two problems. First, if the `$id` differs for any reason — a copied contract with an adjusted id, the M2 port into `packages/core`, a later ticket that legitimately reopens these files — `harness validate` accepts a corrupt events file with a `seq` gap and prints a green tick. `harness/rules.md` is unambiguous: "Errors are explicit… Never default silently." A validator that silently skips half its checks is the same class of defect as the Q-0006 schema that turned out to be documentation, and it is harder to notice because it *looks* like it ran.

Second, this puts a Quorum backlog ticket id inside a shipped, product-agnostic CLI command. Every adopter's `harness validate` carries a branch keyed to `Q-0011`.

Fix: when the data file is `.jsonl` (or the schema declares the event envelope) and the stream invariants are *not* applied, say so on stdout — "stream invariants not applied: schema `$id` is X, expected Y". Better still, key the checks on a stable identifier that survives the M2 port rather than on a ticket-scoped path.

### M3 — The renderer migration is contracted for `retry` and nothing else, leaving `--verbose` undefined

`runs-cli.contract.md:20` specifies exactly one renderer behaviour: printing nullable `retry.data.message`. But AC-7 reshapes every event the renderer consumes. `ui.trace` (`bin/harness.js:54-59`) reads three flat shapes today — `e.type === 'stdout'` with `e.line` under `--verbose`, `e.type === 'spawn'` with `e.cmd`, and `e.type === 'retry'` with `e.reason/attempt/of/delayMs/message`. After this ticket, `stdout` and `spawn` cease to exist and `retry`'s fields move under `data` with `of` → `max_attempts` and `delayMs` → `delay_ms`.

`--verbose` is the only live-trace surface that exists until M3, and the contract does not say what replaces it: whether it prints `text`, `tool`, `raw`, or the vendor JSONL it prints today. The tooling task owns the file and has nothing to implement against. Specify the renderer's typed-event output, including whether `raw` is shown under `--verbose`.

This is also the one place where the two "disjoint" tasks are coupled: the engine changing event shape and the CLI changing its reader must land together, and both tasks declare `depends_on: []` (`draft.md:153`, `draft.md:162`). The integrate step makes that safe at merge time, but the contract is what keeps the two vendors' implementations compatible in the meantime, and right now it covers one of the four event types the renderer touches.

### M4 — Q-0011 development is declared blocked on Q-0033, which is still at stage `solutioned`

`draft.md:131` states a hard prerequisite: "Q-0033 must land before Q-0011 development because it overlaps `spike/bin/harness.js`, `docs/GLOSSARY.md` and `docs/DECISIONS.md`; Q-0011 rebases before fan-out."

`backlog/Q-0033-*/ticket.md` reads `stage: solutioned`. Q-0033 has qa-red, development and review still ahead of it. Q-0011 is M1's fan-out demonstration and the reason it was pulled forward from M2; putting it behind another ticket's full remaining SDLC is a schedule risk that the plan does not currently carry, and it is expressed only in prose — `tasks.yaml` says `depends_on: []` for both tasks, so nothing enforces or even records it.

I am not asking for a different sequencing decision; that is the maintainer's call. I am asking the solution to state what happens if Q-0033 does not land first — whether Q-0011 proceeds and absorbs the merge conflicts in `harness.js`, or M1's demo waits — and to say which regions of `spike/bin/harness.js` actually overlap, since the claim is currently unverified and drives the whole ordering.

---

## Nits

### N1 — "most-recent-first" does not name a sort key

`runs-cli.contract.md:11` and `:15` require the list "most-recent-first" without saying by what. Run ids are `<ticket-id>-<n>` and `n` is per-ticket (`nextRunId`, `engine.js:388-396`), so lexical order on the directory name is wrong across tickets and `Q-0006-10` sorts before `Q-0006-9`. Presumably `started_at` descending, with a stated tiebreak. Say it — AC-12's list test needs a deterministic order.

### N2 — AC-14's `cost_usd: 0` mutation does not name its target

AC-14 requires that an artifact "with `cost_usd: 0` for a vendor that reported none" exits 1. The only check that can catch it is the manifest semantic rule at `runs-cli.contract.md:47-48` ("`cost_usd: null` when no occurrence for that vendor reported cost"), applied to the roll-up. Applied to an occurrence's `usage`, it is undetectable — `0` is a legal value and a vendor could genuinely report it. Name the artifact and the check so QA mutates the right field.

### N3 — the "existing git helper" is module-private

`run-history-writer.contract.md:33` says to add `.quorum/` to `.git/info/exclude` "through the existing git helper." That helper is `ensureExcluded` at `spike/src/git.js:30`, and it is not exported — `ensureWorktree` calls it internally with `.harness/`. The backend task owns `spike/src/**` so this is a one-word change, but the contract should say the helper is to be exported rather than implying it is already reachable.

---

## Coverage audit

Every acceptance criterion maps to a task and every task references contracts. That part is clean:

| AC | Owner | Contracts referenced | Concrete enough to fail a test against? |
| --- | --- | --- | --- |
| AC-1 | engine-writer | writer, manifest | yes |
| AC-2 | engine-writer | writer, event | **no — B1 (argv producer), B4 (env-value scope)** |
| AC-3 | engine-writer | writer, manifest | yes |
| AC-4 | engine-writer | writer, manifest | **no — B3 and M1 make the `seq` prefix unknown** |
| AC-5 | engine-writer | writer | yes |
| AC-6 | engine-writer | writer, event | **no — B2 conflicts with AC-7** |
| AC-7 | writer + CLI renderer | event, writer, mock, CLI | **no — B2; and M3 leaves the renderer half unspecified** |
| AC-8 | engine-writer | manifest | yes |
| AC-9 | engine-writer | writer, event | yes |
| AC-10 | engine-writer | writer, manifest, E-1 | yes |
| AC-11 | engine-writer | writer, manifest, E-1 | yes |
| AC-12 | cli-reader | CLI, manifest | yes, once N1 names the sort key |
| AC-13 | cli-reader | CLI, manifest, event | yes |
| AC-14 | cli-reader | both schemas, CLI | yes, once M2 and N2 are closed |

Two things I checked and found adequately covered, which a fifth round should not reopen:

- **The retry aggregate.** `adapters/index.js:72-92` is currently wrong in three ways for this ticket — `spent` initialises every measure to `0` and `add()` coerces `null` to `0`, line 85 overwrites `input_tokens`/`output_tokens` with the zero-based accumulator, and line 92 replaces `e.usage` wholesale with `{...spent}`, discarding `vendor`, `cached_input_tokens` and `cache_write_input_tokens` on exactly the billed-throw path AC-10 exists for. `run-history-writer.contract.md:17-18` covers all of it: "Each adapter result and thrown billed error carries the complete usage shape from the schema. Unknown values are `null`, not zero." That is testable as written.
- **Claude's cache accounting.** `claude.js:56-63` already folds `cache_creation_input_tokens` and `cache_read_input_tokens` into `input_tokens` and drops the breakdown; the schema now requires the breakdown as separate nullable fields. `run-history-writer.contract.md:25-28` states the subset relationship correctly and tells readers not to double-add. That matches AC-9 and the 2026-08-22 decision, and the phrasing that earlier rounds flagged as ambiguous now reads unambiguously.

## Verdict

**Revise.** I would not let QA start writing tests today, and the reason is narrow: B1 through B4 each force QA to guess, and each guess produces a test that a correct implementation fails or that contradicts another required test. All four are contract edits measured in sentences, not redesigns, and none of them disturbs the architecture — which, on the substance, I think is right.

One process note, given the DECISIONS entry on review loops not converging. These are the last structural findings I have; M1 through M4 are specification gaps rather than design disagreements, and the nits are one-liners. If the next round closes B1–B4 and M1–M3, this is approvable without another adversarial pass — M4 is a sequencing question for the maintainer rather than for the architect, and it should not hold the ticket. On the evidence from Q-0006, consolidating this review into a single architect pass will close it faster and far more cheaply than another reviewer round.
