# Q-0011 — Scenario review (architecture reviewer)

*Reviewed 2026-08-23, `solutioned` → qa-red gate, iteration 2. Read directly: `qa/scenarios.md`
(working tree), `qa/red-report.md`, `qa/red-integration.md`, `requirements/merged.md`,
`solution/errata.md`, `solution/tasks.yaml`, the four frozen contracts on
`harness/Q-0011/contracts`, and both test files as committed on `harness/Q-0011/tests`.*

**Verdict: revise.** Both checks this gate names pass. The revise is on a third property the gate
exists to protect, and it is the same one that failed at iteration 1 — because the suite has not
changed since.

---

## The finding that decides this iteration

**Iteration 2 rewrote the scenario document and did not touch a single assertion.**

| Artifact | Iteration 1 | Iteration 2 |
| --- | --- | --- |
| `qa/scenarios.md` | committed at `HEAD` | +255 / −176 lines in the working tree |
| `spike/test/q0011-run-history.js` | blob `b1a5ae8` | blob `b1a5ae8` |
| `spike/test/q0011-runs-cli.js` | blob `787e86b` | blob `787e86b` |

No commit on `harness/Q-0011/tests` has touched `spike/test/` since `6d126b9` (13:15:38); the same
blobs are at the tests head and the integration head. `qa/red-report.md` matches those files
scenario-for-scenario — 14 writer groups (12 fail, 2 pass) and 9 CLI groups (8 fail, 1 pass).

This matters for what happens next. The iteration-1 review is not stale and its blockers were not
argued with; they were not reached. Running the qa-red flow a third time will regenerate this
report unchanged and bill another pass for it. The fixes below are seven edits inside
`spike/test/**`, which qa-red already owns — no contract change, no task-ownership change, no
scope movement. `docs/DECISIONS.md`'s M0 entry has the measured version of this argument:
*"Reviewer rounds are for finding problems; they are a bad way to fix them"* — $0 and two minutes
for one targeted pass against $10 and 42 minutes for the loop.

---

## The two checks asked for

### 1. Every acceptance criterion has at least one scenario — pass

Twelve criteria are live after the 2026-08-23 scope cut. All twelve have a scenario and all twelve
have an executing test group.

| AC | scenarios.md | test group |
| --- | --- | --- |
| AC-1 | :81 | `q0011-run-history.js:50`, `:70` |
| AC-2 | :96 | `q0011-run-history.js:59` |
| AC-3 | :111 | `q0011-run-history.js:76`, `:127` |
| AC-4 | :129 | `q0011-run-history.js:76`, `:120`, `:149` |
| AC-5 | :147 | `q0011-run-history.js:76`, `:120` |
| AC-8 | :170 | `q0011-run-history.js:76` |
| AC-9 | :185 | `q0011-run-history.js:91`, `:100` |
| AC-10 | :203 | `q0011-run-history.js:91`, `:127` |
| AC-11 | :221 | `q0011-run-history.js:107` |
| AC-12 | :245 | `q0011-runs-cli.js:27`, `:37` |
| AC-13 | :263 | `q0011-runs-cli.js:41`, `:49`, `:58` |
| AC-14 | :281 | `q0011-runs-cli.js:64`, `:72` |

AC-6 and AC-7 carry no scenario, correctly: the scope cut removes `events.jsonl`, the typed
envelope, `seq` contiguity and JSONL support in `harness validate` in full, and scenarios.md:56
records the retirement rather than silently skipping it. All 21 edge cases are tagged onto a
group; EDGE-1…EDGE-21 appear across the two files with no gap.

The document's three testability flags are correct and I re-verified the first two. `ticket.md`'s
body on `main` still ends with the "events schema that qa-red can fail a real artifact against"
sentence the scope cut was meant to remove, no task owns that file, and `spike/src/engine.js`
splices the body into downstream prompts — Flag 1 stands and is a maintainer action. Flag 2 is
right that `argv` appears nowhere in the frozen schema, and the suite correctly asserts its
*absence* (`q0011-run-history.js:67`) rather than testing a deleted requirement sentence. Flag 3's
admission that the run-id/ticket-id join is a naming convention no validator checks is the kind of
thing a weaker document would have claimed as covered.

The iteration-2 rewrite is a genuine improvement to the document: it is contract-checked rather
than prose-derived, it names the specific regressions it targets (the retry wrapper's `attempts`,
the accumulator dropping cache fields), and it pins field names, enum values and the
`occurrence_dir` regex to the committed schema. None of that reached the suite.

### 2. The red report fails on assertions, not compile errors — pass

Conclusively. Both files loaded, resolved every import (`../src/backlog.js`, `../src/engine.js`,
`../src/adapters/mock.js`, `../src/contracts.js`), parsed
`contracts/Q-0011/run-manifest.schema.json`, and ran every group through to their own trailing
summaries (`✗ 12 Q-0011 writer scenario group(s) failed`, `✗ 8 Q-0011 CLI scenario group(s)
failed`) — output a module-load failure cannot produce. Every failure carries a real diff:

- `0 !== 1` on `manifests(f).length` — `.quorum/runs/` is absent because the writer does not exist
- `'mock' !== 'claude'` — `MOCK_VENDOR` is not honoured
- `undefined !== null` — unreported measures are absent keys rather than explicit `null`
- regex misses against the CLI's help text — `harness runs` is not a command yet

Three groups pass, each defensibly: AC-14 structural validation (`q0011-runs-cli.js:64`) works
because `harness validate` and the schema already exist, and EDGE-21/EDGE-1 assert over frozen
documents rather than behaviour.

`qa/red-integration.md` confirms the red was proven the way M1 requires — base and tests branches
merged, `npm install --prefix spike` exit 0, `npm test --prefix spike` exit 1 — satisfying the
"a suite that could not start is not a red phase" guard from *Red for the right reason is an engine
property*. `smoke.js` and `q0006-engine.js` stay green. The alarming-looking `✗` lines near the top
of the report (`ticket T-0001 is at stage "draft"`, `1 of 2 parallel step(s) failed`, `Preparing
worktree`) are `smoke.js`'s own deliberate negative-path diagnostics, not a broken Q-0011 fixture —
worth restating because they read badly in a report a human skims.

---

## Why this is still a revise

A qa-red gate hands development a suite that fails now for the right reason **and goes green only
when the criteria are met**. The second half is where this suite has holes, and they are the same
holes as last time.

This is the mirror image of the defect recorded in *"Red for the right reason" is an engine
property*: there a broken environment counted as red; here an unimplemented feature will count as
green. The same entry's closing line applies directly — **a gate only catches what it is pointed
at**, and the tags are what point this one.

### Blockers

**B-1 — EDGE-6 injects no failure** (`q0011-run-history.js:136`). The group runs a normal flow and
asserts `m.steps.length === 3`, that `warnings` is empty, and that `typeof fs.renameSync ===
'function'` — a tautology about the Node standard library. Its own comment concedes the point.
scenarios.md:336 requires a manifest replacement or `output.txt` write **forced to fail** after
`.quorum/runs/<id>/` exists, proving the engine warns with the affected path and continues rather
than discarding an already-billed step. The requirement names this as a standing risk ("writing
history becomes a way to lose a paid run") and as the one place where two engineering rules
deliberately point in different directions. It will ship untested.

**B-2 — the signal path is never signalled** (`q0011-run-history.js:127`). The group spawns
`node -e 'process.kill(process.pid, "SIGTERM")'` — a throwaway child with no connection to the
harness — asserts it died, then runs a *normal* flow and asserts the status is terminal.
`assert.notEqual(m.status, 'running')` passes trivially on `completed`. Nothing exercises AC-3's
"a run killed with Ctrl-C or `SIGTERM` ends `interrupted`, never `running` and never `completed`",
nor AC-10's in-flight occurrence `interrupted`, nor errata E-3's gate-level run interruption. E-3
was written specifically to resolve a contradiction in this area; the resolution is unverified.

**B-3 — no parallel-step regression test exists** (`q0011-run-history.js:76` is the closest home).
`grep -c parallel` returns 0 in both Q-0011 test files; every fixture flow is sequential. AC-3's
own text mandates the test in as many words — "Updates from parallel steps are serialised by the
engine; a regression test with two parallel mock steps proves no step's record is lost" — and
scenarios.md:111 carries the bullet. Of AC-3's properties this is the one whose failure is silent
and corrupts accounting, and it is the only manifest concurrency the engine actually has.

**B-4 — AC-12 asserts nothing about what the command prints** (`q0011-runs-cli.js:27`). The group
covers run ids, ordering, the ticket filter and exit codes. It never asserts money for priced
vendors, token counts for unpriced ones, `n/a` for an unknown cost, vendors listed separately, the
absence of a combined total, or the unpriced-step count — which is the whole of AC-12's content
requirement. An implementer who makes every assertion in this group pass can print a single blended
dollar figure across Claude and Codex. That is precisely what *Codex cost is reported as tokens,
never priced locally* was decided to prevent, and it is the requirement's first listed risk. Of the
blockers, this is the one most likely to reach a user.

### Majors

**M-1 — AC-1's "nothing has been billed" is never asserted** (`q0011-run-history.js:70`, and
`:50`). The fatal-init group asserts the run rejects and the blocking file is unchanged; it never
asserts that no adapter was invoked. A failure that happened *after* a spawn would pass it. The
ordering claim in scenarios.md:81 — the run directory, `steps/` and a `status: "running"` manifest
exist **strictly before** the first spawn, "proved by instrumenting the spawn/exec entry point" —
has no instrumentation anywhere in the suite; `:50` only counts manifests after the run finishes.
"Nothing has been billed yet, so this failure is free" is AC-1's entire justification for being
fatal, and it is the untested half.

**M-2 — AC-11 runs one vendor** (`q0011-run-history.js:107`). Two steps, both `codex`, both
token-only. Untested from scenarios.md:221: the mixed priced/unpriced run and "no field anywhere
sums `claude` and `codex` money together"; E-1's fail-before-usage occurrence creating no vendor
row *on the writer side*; the distinction between a genuinely reported `cost_usd: 0` (counted in
`unpriced_steps`, summed) and a reported nothing; and recomputation of the roll-up from persisted
occurrence usage. The requirement's "Notes for solutioning" nominated that last check for the
tooling task to balance the halves, and it landed in neither. The CLI fixture's mixed
`claude`/`codex` manifest (`q0011-runs-cli.js:16`) is hand-authored, so it exercises the reader's
input, not the writer's grouping. AC-11 is this ticket's central accounting invariant.

**M-3 — `attempts` is asserted only where it is already correct** (`q0011-run-history.js:76`,
failure path at `:91`). The suite asserts `[1, 0, 1]` — first-try success and script-step zero —
and the failure group asserts `error.category` but never `attempts`. scenarios.md:170 and :203 name
the defect exactly ("the retry wrapper only stamped `attempts` when `attempt > 1`") and require
`attempts === 3` after two retryable failures plus a correct count on the failing path. A scenario
document that identifies a specific regression and a suite that does not test it is the worst
combination available.

**M-4 — AC-4's two hardest bullets have no test** (`q0011-run-history.js:149`). `grep -c` returns 0
for `goto`, `on_fail` and `fan_out` across both files. EDGE-8's tag sits on the
1000-sequential-script-step allocator test, which proves 1000 *distinct* step ids get distinct
directories — not the actual claim, that one step id revisited across a backward edge produces two
occurrences at different sequence numbers that do not overwrite each other, with other steps
interleaved. AC-4's fan-out bullet is likewise untested. In fairness the `:` and `/` sanitising
**is** genuinely proven at `:76` (`shell:one` → `steps/002-shell-one`, `beta/two` →
`steps/003-beta-two`), so AC-4 is partly covered.

**M-5 — the cross-process read-back is never demonstrated** (`q0011-run-history.js:91`). The writer
group reads its own manifest in-process; the CLI detail group (`q0011-runs-cli.js:49`) reads a
hand-authored fixture. No test writes a billed failure with the engine, exits, and reads its error
and usage back through `harness runs`. scenarios.md:203 asks for exactly that, and it is the
ticket's motivating story — "the Q-0006 crash, replayed against this feature, shows its $4.54". It
is also the only test that would prove the two fan-out halves compose, which is what M1's
definition of done is buying.

**M-6 — EDGE-7's linked-worktree shape is untested** (`q0011-run-history.js:59`). The fixture is
`git init`, so `.git` is always a directory. scenarios.md:342 specifically calls for the
`.git`-as-a-file shape "this repository's own dogfooded runs use under `.harness/worktrees/`", plus
the unwritable-exclude warning path. If `ensureExcluded` does not resolve through a `.git` file,
every dogfooded run dirties its worktree — and this suite would not notice.

**M-7 — EDGE-3 is tagged but not asserted** (`q0011-run-history.js:114`). The group proves EDGE-2
(an integrate step with no commands still gets one occurrence with an empty `output.txt`). EDGE-3's
actual claim — a failing install phase and a failing test phase each produce **one** occurrence,
not two, with `error.category: "integrate"` — is not exercised at all.

**M-8 — EDGE-21 freezes the enum but not the mapping** (`q0011-run-history.js:145`, with the only
real error path at `:91`). The group asserts the schema's category list. scenarios.md:398 requires
five forced failure modes mapping to `auth`, `transient`, `structured_output`, `script` and
`integrate`. The suite's one error assertion is `assert.ok(bad.error.category)`, which accepts any
non-empty string, including `"unknown"` for all five.

### Nits

**N-1** — AC-3's initial-manifest and mid-run-read bullets (scenarios.md:111) have no test: nothing
reads `manifest.json` before the run ends, so "written at start with `status: running`" and "a
mid-run read describes everything finished so far" are unverified.

**N-2** — AC-3's torn-read bullet has no test; write/fsync/rename is asserted only by inspection.

**N-3** — AC-13's "reads only files inside the selected run directory" (scenarios.md:263) has no
test; nothing traces file access, so a reader that consulted `backlog/` or a sibling run passes.

**N-4** — `q0011-runs-cli.js:58` fails with an uncaught `JSON.parse` SyntaxError rather than a named
assertion. It is a legitimate red (the CLI prints help instead of JSON) and the group's try/catch
contains it, but `Unexpected token 'h'` in a report a human skims reads like a broken test. Guard
the parse and assert the message.

**N-5** — EDGE-21 (`:145`) and EDGE-1 (`:157`) pass in the red phase because they assert over frozen
documents — the schema's enum, `tasks.yaml`'s role and ownership strings — rather than over
behaviour. They are worth keeping as contract-freeze guards but should not be counted as red-phase
coverage of those edges.

---

## What would make this an approve

Seven edits, all inside `spike/test/**`:

1. Rewrite EDGE-6 (`:136`) to force a write failure after run-directory creation and assert the
   warning names the path and the run continues.
2. Rewrite the signal group (`:127`) to signal the harness run itself; assert `interrupted` at run
   level, at occurrence level for in-flight work, and — per E-3 — with no occurrence created for an
   interrupt taken at a gate.
3. Add a two-parallel-mock-step flow; assert both terminal records survive in the final manifest.
4. Extend AC-12 (`q0011-runs-cli.js:27`) to assert the per-vendor rendering: money, tokens, `n/a`,
   separate rows, no combined total, unpriced-step count.
5. Add the `attempts === 3` retry case and assert `attempts` on the failing path; assert
   `error.category` equals the specific expected category, not merely that one exists.
6. Extend AC-11 to a mixed priced/unpriced run covering E-1's null-usage exclusion, the
   reported-zero case, and recomputation from persisted occurrence usage.
7. Add a backward-edge flow producing two occurrences of one step id, and prove one billed failure
   is readable by `harness runs` from a separate process (covers M-4 and M-5 together).

M-1, M-6 and M-7 are each a one-line addition to a group that already exists and should ride along:
assert no adapter was invoked on the fatal-init path, run one fixture from a linked worktree, and
fail an integrate install phase.

Separately, and outside this suite: the maintainer should fix `ticket.md`'s stale "events schema"
sentence before the next `harness run qa-red Q-0011`, as Flag 1 and `solution/review.md`'s checklist
both ask. Nothing in this ticket's task ownership does it, and the engine splices that body into
every downstream prompt — including the prompt that would write the next version of these tests.

## A note on how to spend the next pass

The document is good and does not need another round; the suite does. Re-running the whole flow
regenerates 255 lines of prose that were already right and — on this iteration's evidence — leaves
the assertions where they are. Applying the seven edits directly to `spike/test/**` is the cheaper
and more likely path to green, and it is the one M0 measured. The underlying pressure is familiar:
12 live criteria and 21 edge cases is a lot of surface for one qa-red pass, which is *Ticket size is
the dominant cost driver* showing up one stage later than usual.
