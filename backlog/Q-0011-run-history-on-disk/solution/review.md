# Architecture review — Q-0011 solution, final revision

*Reviewer: architecture-reviewer. Ticket Q-0011, stage requirements → solutioning.*

**Verdict: approve.** The four directives in `solution/review.md` are closed, none of them is
regressed, and the contracts are concrete enough that I would let QA start writing tests against
them. The architecture is right and the seams are real.

There are four loose ends. **None of them is a defect in this solution**, none is fixable by
another architect round, and three of them are edits to files the architect is forbidden to touch.
They are listed at the end as a pre-qa-red checklist for the maintainer, not as revision
directives. One of them — a sentence still living in `ticket.md` — will reach the QA agent's
prompt if it is not deleted first, so read that section before running the next stage.

---

## The four directives, verified

| Directive | State | Evidence |
| --- | --- | --- |
| 1. `depends_on: []` on both tasks, verbatim | closed | `draft.md:193`, `draft.md:223` |
| 2. Both tasks carry a `description` in the Q-0006 form | closed | both name their files, freeze `contracts/Q-0011/**`, and assign `spike/test/**` to qa-red — including on `q0011-cli-reader-validator`, where `developer-tooling`'s allow-list makes the prose the only guard |
| 3. `argv` struck from the writer contract | closed | `grep -rn argv contracts/Q-0011/` returns nothing; no `argv` property in the schema either, so the two frozen contracts no longer point in opposite directions |
| 4. E-3 for gate interruption | closed | `solution/errata.md`, dated 2026-08-23, naming AC-10's superseded sentence, with the QA scenario impact spelled out |

The deferred round-7 findings are noted where they were asked for: N-1 (the run-id/ticket-id join
invariant is not semantically checked) and N-2 (run-directory size is measured on the first real
run) each appear as one line under **Open questions**. Nothing was re-argued and no contract
surface was added.

**The fan-out is a real fan-out.** With `depends_on: []` on both, `waves()`
(`spike/src/fanout.js:26-36`) produces a single wave, and `runFanOut` (`spike/src/engine.js:442`)
awaits one `Promise.all` over it. `development.yaml` resolves `role: "developer-{role}"` and
`adapter: "{role.adapter}"`, so `backend` → `harness/roles/developer-backend.md` → codex and
`tooling` → `harness/roles/developer-tooling.md` → claude/sonnet, concurrently, on
`spike/src/**` and `spike/bin/harness.js`. That is M1's definition of done, and it is the reason
this ticket was pulled forward from M2. The choice of the repository-local `tooling` role over the
stage contract's generic three-role vocabulary is correctly justified in the solution and matches
`harness/architecture.md`'s current write contract.

---

## What I verified against the code, not the prose

**Every live criterion has exactly one owner, and every task cites contracts.**

| Criteria | Owner | Contracts cited |
| --- | --- | --- |
| AC-1 – AC-5, AC-8 – AC-11 | `q0011-engine-writer` (backend/codex) | manifest schema, writer contract, mock contract |
| AC-12 – AC-14 | `q0011-cli-reader-validator` (tooling/claude) | manifest schema, writer contract, CLI contract, mock contract |
| AC-6, AC-7 | struck by the scope cut | no orphan |

Twelve live criteria, twelve assignments, no double ownership, no criterion without a task. The
owned file sets are disjoint by construction: `spike/src/**` plus four docs against
`spike/bin/harness.js`.

**The manifest schema executes, and it is strict where it claims to be.** I compiled
`contracts/Q-0011/run-manifest.schema.json` with the repository's own validator
(`Ajv2020` + `ajv-formats`, `strict: false`, as configured in `spike/src/contracts.js:17`) and ran
a synthetic manifest through it. `x-quorum-contract` is ignored as an unknown keyword rather than
rejected, so E-2's annotation costs the validator nothing. Results:

| Case | Outcome |
| --- | --- |
| well-formed two-vendor manifest | valid |
| required field removed (`ticket_path`) | rejected — `must have required property` |
| negative token count | rejected — `must be >= 0` |
| unexpected extra field | rejected — `must NOT have additional properties` |
| absolute `ticket_path` | rejected by the `relative_path` lookahead |
| `running` with `ended_at: null`, `duration_ms: null` | valid, as AC-3 requires |
| script occurrence with `usage: null`, `attempts: 0` | valid, as the writer contract requires |
| **`cost_usd: 0` on a token-only vendor's roll-up** | **valid** |
| **duplicate `occurrence_dir`** | **valid** |
| **roll-up contradicting its occurrences' usage** | **valid** |

The last three are the whole argument for E-2, and they settle it on evidence: three of AC-14's
four required failures fall out of the schema with no new code, and the fourth cannot be expressed
in JSON Schema at all, because a genuinely reported zero is a legal value. Naming the semantic
capability is more honest than pretending structure catches it, and the erratum supersedes AC-14's
"needs no new capability" sentence explicitly rather than silently.

**The CLI can honour E-2 without reaching into `spike/src`.** `validate(schema, data)` and
`readData(file)` are both exported from `spike/src/contracts.js`; `spike/bin/harness.js:154`
already imports from that module. The reader can read the schema, test the annotation and run the
semantic pass entirely inside `bin/harness.js`. The engine/CLI seam survives the ticket intact.

**The engine-side defects the contracts name are real and correctly located.** `withRetry`'s
accumulator (`spike/src/adapters/index.js:72-78`) sums `input_tokens`, `output_tokens` and
`cost_usd` only, so `cached_input_tokens` and `cache_write_input_tokens` are dropped on the
retry-success path and on every billed throw — AC-9's defect, named in the right file. `attempts`
is stamped only when `attempt > 1` and never on the error path, which the writer contract requires
it to expose on both. `mock.js`'s `MOCK_FAIL_WRITE` throw carries `usage` and no `vendor`, which is
precisely what the mock contract's per-call `error.vendor` requirement closes. And
`ensureExcluded` (`spike/src/git.js:30-35`) is neither exported nor able to resolve a linked
worktree, where `.git` is a file — a live problem, because this repository dogfoods itself out of
`.harness/worktrees/` and `findProject()` resolves `repoDir` to the worktree.

**The contracts will be in the developers' worktrees.** `taskPromptSection`
(`spike/src/fanout.js:45-48`) inlines each `contracts:` path read from the worktree and prints a
blocker notice when the file is absent. The four files exist on `harness/Q-0011/contracts`, and
`merge-contracts` lands them on `harness/Q-0011/integration`, which is the fan-out's `base`. The
chain holds.

**Nothing here needs a change to the test runner.** `spike/test/run.js` discovers `test/*.js`, so
qa-red's new files execute without an unowned edit.

---

## Judgement calls I am not re-opening

**E-1 (null-usage occurrences create no vendor row) is the right trade.** It buys the stronger
invariant — every roll-up row is exactly reproducible from persisted occurrence usage, with no
inference — at the cost of an adapter occurrence that died before reporting anything being visible
in detail but absent from the summary. That is the honest direction: the alternative fabricates an
accounting row from routing metadata, which is the same class of error as pricing a token-only
vendor. One thing for the scenario author to keep in view rather than change: the list view can
therefore show fewer occurrences than the run ran, and only the detail view tells you so. If that
ever reads as a total, it is the risk the requirement already names.

**`exhausted` reserved but never written** is traced correctly: `engine.js:251` records the event
against ticket history and continues to a gate, after which the run ends `aborted`, `regressed` or
`completed`. Telling QA not to require an `exhausted` manifest fixture is the useful part.

**AC-2's spawn-record clause** was settled in round 7 and by the maintainer: it constrains what a
spawn record may contain, it does not require one to exist. The contracts now persist none. I
agree, and I note only that this resolution lives in `review.md`, which qa-red never reads — see
the checklist below.

---

## Before `harness run qa-red Q-0011` — maintainer, not architect

### 1. `ticket.md` still promises an events schema (do this one)

`backlog/Q-0011-run-history-on-disk/ticket.md:82` reads:

> It should also produce the first contract the repository can execute end to end, now that
> `harness validate` exists: **an events schema that qa-red can fail a real artifact against.**

The hand fix of 2026-08-23 removed "an events file per step" from the sentence above it and left
this one. `spike/src/engine.js:352` splices `ticket.body` verbatim ahead of every input in every
prompt, so the QA agent is told, in the ticket's own voice, that its job is to fail a real artifact
against an events schema — which the scope cut removed and which no contract or task provides. The
manifest schema is that artifact. Deleting the clause, or replacing "an events schema" with "a run
manifest schema", costs eleven words and removes the last surviving trace of B-1. No task owns
`ticket.md`, correctly, so nobody downstream can do this.

### 2. Point the tasks at `errata.md`

`taskPromptSection` inlines only `contracts:`; the errata reach a developer no other way, and
qa-red's `scenarios` step reads `requirements/merged.md`, `solution/solution.md` and
`solution/tasks.yaml` — never `errata.md`. Q-0033 solved this by listing
`backlog/Q-0006-…/solution/errata.md` among its task contracts. Adding
`backlog/Q-0011-run-history-on-disk/solution/errata.md` to both tasks' `contracts:` lists is the
same one-line move. Until then the amendments travel only in the draft's **Status** block, and
`finalize`'s instruction protects the Contracts and Tasks sections but not that one.

### 3. The backend task owns five doc files and is told nothing about them

`owns:` reaches no agent, and the description — which does — says "Implement the engine writer
against the referenced frozen contracts" without naming a documentation obligation. The
requirement's checklist asks for three things I confirmed are still missing: `docs/GLOSSARY.md` has
no **run history** term (now used in more than one file, which the docs rule makes a requirement),
`docs/04-architecture.md` has no `.quorum/runs/` layout, and `docs/03-adapter-contract.md` has not
been told about the widened usage/result/error boundary. No test can catch any of these. One
sentence in the description fixes it.

### 4. E-2 deserves a DECISIONS entry, and no task will write one

"Step-output validation is Quorum's contract with its own agents" (2026-08-22) enumerates exactly
three validations and says they must not be confused. Annotation-driven semantic checks inside
`harness validate` are a fourth, in a fourth location. The rules say not to narrow a decision
silently. Note the ownership trap: the capability is built by the tooling task, `docs/DECISIONS.md`
belongs to the backend task, and neither description mentions it — so on the current wording it
gets written by nobody.

---

## What I would be on call for

The record, the money and the two-vendor fan-out, as specified. The engine writes one atomic
manifest and two text files per occurrence; the CLI reads them back without repairing anything; the
roll-up reproduces exactly from what the vendors reported and invents no money; and the contract
that guards all of it is executable today against the repository's own validator, which I ran. With
item 1 above closed, QA can start writing tests this morning.
