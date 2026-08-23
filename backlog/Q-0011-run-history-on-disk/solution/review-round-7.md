# Architecture review — Q-0011 solution, revision 7

*Reviewer: architecture-reviewer. Ticket Q-0011, stage requirements → solutioning. Round 5.*

**Verdict: revise.** Two blockers, three majors, two nits.

The design is not the problem. Revision 7 is materially stronger than its predecessor and I would
be willing to be on call for the shape it describes. What stops it is machinery: a repair
scheduled after the stage that needs it, and a task dependency that undoes the reason this ticket
exists. Both are one-line fixes on the contracts branch.

---

## What I verified, and what holds

I traced every structural claim against the running spike rather than accepting the prose.

**The AC→owner map is complete and each live criterion has exactly one owner.** AC-1–AC-5 and
AC-8–AC-11 to `q0011-engine-writer`; AC-12–AC-14 to `q0011-cli-reader-validator`; AC-6 and AC-7
struck by the scope cut with no orphan. Twelve live criteria, twelve assignments, no double
ownership. Both tasks cite the contracts they implement.

**The manifest schema is executable and strict, not documentation.** `additionalProperties: false`
at every level, `required` covering every property including the nullable ones (so a missing field
fails rather than defaulting), `nullable_number` with `minimum: 0` giving AC-14's negative-token
rejection, `relative_path` with a lookahead that rejects both POSIX and Windows absolute paths for
AC-2, `format: date-time` plus a `Z$` pattern for AC-3's UTC requirement, and `occurrence_dir`
pinned to `^steps/[0-9]{3,}-[^/:]+$`, which enforces AC-4's zero-padding, its "continues past 999"
rule and its `:`-sanitising in one expression. `schema_version: {const: 1}` is a real escape hatch.
Three of AC-14's four required failures — missing field, negative token, extra property — fall out
of the schema without a line of new code.

**E-2 is correct and the CLI can honour it without reaching into `spike/src`.** I checked
`spike/src/contracts.js`: `validate(schema, data)` and `readData(file)` are both exported, and
`spike/bin/harness.js:154` already calls `validateFile`. The reader can read the schema, test for
`x-quorum-contract: run-manifest-v1`, and run the semantic pass entirely inside `bin/harness.js`.
The claim that "the current CLI can use the already exported contract helpers" is true, and the
CLI/engine seam survives it. E-2's reasoning is also right on the merits: JSON Schema cannot tell
a genuinely reported `cost_usd: 0` from AC-14's required mutation of `null` to `0`, so naming the
capability beats pretending the structure catches it.

**The per-call vendor fix is right against the code.** `withRetry` in `adapters/index.js:68-103`
spreads `...adapter`, so a static `vendor` survives; `mock.js` already returns `vendor: 'mock'` on
its success path but its `MOCK_FAIL_WRITE` throw carries `usage` and no `vendor`. Taking
`result.vendor`/`error.vendor` first with the static adapter as fallback is exactly the right
resolution of B-1, and the mock contract's requirement that the billed-failure path carry
`error.vendor` closes the hole.

**AC-9's cache-field defect is real and correctly located.** `withRetry`'s `spent` accumulator
(`index.js:72-78`) sums only `input_tokens`, `output_tokens` and `cost_usd`; `cached_input_tokens`
and `cache_write_input_tokens` are dropped on the retry-success path and on every billed throw.
The contract's "survive accumulation and the success/error wrapper paths" names the right file.

**The linked-worktree exclusion finding (N-7) is a genuine defect, not defensive prose.**
`spike/src/git.js:30-35` joins `repoDir/.git/info/exclude` and returns silently when the directory
is absent. In a linked worktree `.git` is a *file*, so `path.dirname(f)` does not exist and
`ensureExcluded` returns having done nothing — and this repository dogfoods itself out of
`.harness/worktrees/`, where `findProject()` in `bin/harness.js:32-38` resolves `repoDir` to the
worktree because `harness/harness.yaml` is present there. Without the fix, `.quorum/` would appear
in `git status` and `spike/test/smoke.js:56` would fail. Good catch.

**M-4's `exhausted` reservation is defensible.** I traced it: `engine.js:251` calls
`recordEvent(ctx, …, 'exhausted', 0)` against ticket history and then presents a gate; the run
subsequently terminates `aborted`, `regressed` or `completed`. No run terminates `exhausted`
today. Keeping the value in the enum while forbidding it as a manifest outcome, and saying so to
QA, is the honest reading of AC-3's "status covers …". I am not re-raising this.

**`spike/test/run.js` auto-discovers.** New test files need no registration, so the tooling task
does not need an unowned edit to the runner. Confirmed at `run.js:16-18`.

---

## Blockers

### B-1 — QA's prompt will still ask for the event stream the scope cut removed

`solution/draft.md:254` resolves B-2 by having `q0011-engine-writer` — a **development** task —
correct `ticket.md`. That is one stage too late.

`spike/src/engine.js:352` splices `ticket.body` verbatim into every prompt the engine builds, for
every step of every flow. The current body of
`backlog/Q-0011-run-history-on-disk/ticket.md` reads:

> …puts a run's history on disk under `.quorum/runs/<id>/`: **an events file per step**, a manifest
> describing the run… It should also produce the first contract the repository can execute end to
> end… **an events schema that qa-red can fail a real artifact against.**

qa-red consumes `solutioned` and runs before `development`. The QA agent will therefore be told,
in its own prompt, that this ticket ships an events file per step and that its job is to fail a
real artifact against an events schema. Both were cut on 2026-08-23. `requirements/merged.md`
carries the cut and `errata.md` carries E-1 and E-2, but the ticket body — which is prepended
ahead of every input and reads as the ticket's own statement of intent — contradicts all three.

The most likely outcome is QA writing scenarios against `events.jsonl` and a JSONL-aware
`harness validate`, neither of which any task implements, and the red phase failing for the wrong
reason. This repository has already recorded what that costs: *"A gate only catches what it is
pointed at."*

**Required:** correct `ticket.md`'s body on the contracts branch, before qa-red, and remove
`backlog/Q-0011-run-history-on-disk/ticket.md` from `q0011-engine-writer`'s `owns`. Development
should not be editing the live state file the engine mutates during its own run; the ticket's
frontmatter is being appended to by `recordEvent` in the main working tree at the same moment a
fan-out worktree holds a divergent copy of it on a branch.

### B-2 — `depends_on` collapses the fan-out into two single-role waves

`solution/draft.md:212` declares:

```yaml
  depends_on:
    - q0011-engine-writer
```

`waves()` at `spike/src/fanout.js:26-36` groups a task into the first wave in which all of its
`depends_on` are already complete. With this edge the plan is `[[q0011-engine-writer],
[q0011-cli-reader-validator]]`, and `runFanOut` (`engine.js:440-467`) iterates waves with a plain
`for…of`, awaiting `Promise.all` inside each. Concurrency exists only *within* a wave. So the
development stage runs codex alone, merges, then claude alone.

That is the exact shape that disqualified Q-0006. The M0 closing entry in `docs/DECISIONS.md`
records it: *"Its `tasks.yaml` is four tasks, one role, four serial waves, single vendor… M1's
done-when asks for 'two roles on two vendors fan out into worktrees'."* `docs/06-development-plan.md`
pulled Q-0011 forward from M2 for precisely this reason, and the requirement's own Size section
says the ticket is *"deliberately **not split**… because the engine and CLI halves are two roles on
two vendors on disjoint files."* A serialised two-wave plan delivers two roles and two vendors but
not a fan-out, and M1 loses its demonstration a second time.

The justification at `draft.md:223` argues against itself: *"the contracts land before fan-out, so
CLI implementation can proceed independently, while its real-artifact integration assertions run
once the writer is available."* If it can proceed independently, the edge should not exist. The
"real-artifact integration assertions" are what the `integrate` step is for — it merges both
branches onto `harness/Q-0011/integration` and runs `commands.test` there, which is where a CLI
test that needs a writer-produced `manifest.json` belongs and where it will find one.

The edge is not free documentation either. `taskPromptSection` (`fanout.js:49`) emits *"Depends on:
q0011-engine-writer (already merged into your base branch)"*, so it changes what the tooling agent
is told and what its worktree contains.

**Required:** `depends_on: []` on `q0011-cli-reader-validator`, with the cross-task assertions
stated as the responsibility of the `integrate` step. If a real ordering constraint is later found,
that is the seam the requirement already identified as the split point — take the split, don't
serialise the fan-out.

---

## Majors

### M-1 — the `owns` lists never reach the agent; the tasks carry no `description`

`draft.md:186` and `draft.md:214` express the whole disjointness argument through `owns:`. I
grepped `spike/src/` and `spike/bin/`: nothing reads `owns`, and nothing reads
`acceptance_criteria`. `taskPromptSection` (`fanout.js:42-51`) forwards exactly four fields —
`title`, `description`, `contracts`, `depends_on` — and `description` is emitted only when present.
Neither Q-0011 task has one. `harness/architecture.md` says this outright: *"The engine does not
read `paths` frontmatter; enforcement reaches an agent through the allowed-path prose in the role
body."*

What actually reaches the two developers is therefore the role allow-lists alone:
`developer-backend` gets `spike/src, harness, docs, backlog` and `developer-tooling` gets
`spike/bin, spike/test`. Three consequences the `owns` lists were meant to prevent:

- **`developer-tooling` may write `spike/test/**`, including qa-red's red tests.** The task's
  `owns: spike/test/q0011-*.js` is precisely the glob QA's failing tests will match. The role body
  says *"You make the failing tests for your task pass and nothing more"*, which is weaker than a
  prohibition. Every Q-0006 task said *"Do not edit tests"* in its `description` for exactly this
  reason, and `docs/DECISIONS.md` records the failure mode: *"a test quietly outvoting a contract."*
- **`developer-backend` may write all of `harness/` and all of `backlog/`**, well beyond
  `spike/src/**` plus the four named docs — including flow files, which the non-goals forbid
  changing.
- **Nothing tells either agent that `contracts/Q-0011/**` is frozen.** They fall outside both
  allow-lists, so the protection is incidental rather than stated. Every Q-0006 task said *"Do not
  edit … contracts/Q-0006/**"*.

**Required:** give each task a `description` in the Q-0006 style — the concrete file list, the
prohibition on editing tests, and the prohibition on editing `contracts/Q-0011/**`. Keep `owns` for
human readers, but stop relying on it for enforcement.

### M-2 — the writer contract mandates persisting `argv`; the schema has nowhere to put it

`contracts/Q-0011/run-history-writer.contract.md:19` reads *"Persist argv when a command record
needs it, but never an environment object."* With AC-6 and AC-7 cut there is no event stream, so
the only structured sink is the manifest — and `run-manifest.schema.json` declares
`additionalProperties: false` on both the root and `$defs/step`, with no `argv` property anywhere.
A developer who obeys the writer contract produces a manifest that fails `harness validate`, which
is AC-14. Two frozen contracts pointing in opposite directions is the thing this stage exists to
catch.

AC-2's clause — *"a spawn record carries the adapter's argv only"* — is a *constraint* on spawn
records, not a requirement that one exist, and spawn records left with the event stream. The
cheapest correct fix is to delete the sentence.

**Required:** either strike "Persist argv when a command record needs it" from the writer contract,
or add an explicit `argv` array to the step definition in the schema. Do not leave both.

### M-3 — AC-10's gate-interruption sentence is unsatisfiable, and no erratum says so

AC-10 states: *"A step interrupted at a gate appears as `interrupted`."* The scope cut then
resolved the fourth blocker by rewriting AC-4 so that *"gates allocate no directory, whether
answered, auto-advanced or skipped by `--dry`."* Gates are their own steps and run sequentially, so
when a run is sitting at a gate no occurrence is in flight and none can be marked. The writer
contract's signal bullet (`run-history-writer.contract.md:29`) says *"mark active occurrences and
the run `interrupted`"* — with zero active occurrences at a gate, only the run status is written,
which AC-3 already covers.

This is residue from the cut: AC-4 was edited and AC-10 was not. Left alone, QA writes "Ctrl-C at a
gate produces a step record with `status: interrupted`" from an AC sentence that no implementation
can satisfy, and it fails forever.

The architect has already used the erratum mechanism twice and `docs/DECISIONS.md` is explicit that
this is the right instrument: *"Contract erratum, not a silent override."* This third override is
currently carried only by implication.

**Required:** an E-3 in `solution/errata.md` superseding AC-10's gate sentence — an occurrence can
be `interrupted` only when an adapter, script or integrate step was in flight; a signal received at
a gate is recorded at run level only — plus one sentence in the writer contract making the
zero-active-occurrence case explicit.

---

## Nits

### N-1 — the AC-1 join rule is the one invariant nothing checks

AC-1 makes the naming rule the entire substitute for changing `runs.log`: *"`run=3` in `Q-0011`'s
`runs.log` and `history` is directory `Q-0011-3`"*, and notes the corollary that the two strings are
deliberately not identical. The schema's `run_id` pattern
(`^[A-Za-z0-9][A-Za-z0-9._-]*-[1-9][0-9]*$`) accepts the shape but does not couple `run_id` to
`ticket_id`, and the semantic checks at `contracts/Q-0011/runs-cli.contract.md:40-45` cover
occurrence uniqueness, lifecycle consistency, kind nullability, vendor uniqueness and roll-up
equality — not this. `run_id === ticket_id + "-" + n` is a two-line addition to a checker that
already has both fields in hand, and it is the only thing tying the new record to the old one.

### N-2 — open question 2 is left unanswered

The requirement assigns *"How large does a run directory actually get?"* to the architect with the
instruction *"measure, do not design"*. Open question 1 is answered (`Text is unbounded in Q-0011`);
question 2 is not mentioned anywhere in the solution. Measuring genuinely requires an
implementation, so deferring is correct — but the solution should say that it is being deferred to
the first real run and who records the number, rather than passing over it in silence.

---

## What I would accept

Fix B-1 and B-2 on the contracts branch, add the two task `description` blocks (M-1), delete one
sentence from the writer contract (M-2), and add E-3 (M-3). None of that changes the architecture;
all of it is metadata and prose on artifacts that have not yet been consumed. With those in place I
would let QA start writing tests against these contracts today, and I would be willing to be on
call for what comes out.
