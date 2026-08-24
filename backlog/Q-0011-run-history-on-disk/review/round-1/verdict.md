# Q-0011 review — round 1 verdict (panel synthesis)

**Verdict: changes-requested.** 4 blockers, 10 majors, 6 nits survive after deduplication.

Two reviewers ran: `claude` (4 blockers, 8 majors, 6 nits) and `codex` (4 majors). Twenty findings survive from twenty-two reported. Line numbers are preserved as each reviewer cited them on `harness/Q-0011/integration`.

## Deduplication

| Merge | Sources | Resolution |
| --- | --- | --- |
| AC-12 ticket-filter exit code | claude major 3 (`spike/bin/harness.js:421`), codex major 4 (`spike/bin/harness.js:417`) | Same defect, same branch, independently found. Merged as **major 5**, keeping both line cites. |
| AC-5 `output.txt` guarantee | codex major 2 (`spike/src/engine.js:223`, adapter-failure path), claude major 1 (`spike/src/engine.js:746`, integrate path) | Same rule broken in two functions. Merged as **major 2** with both sites named; needs two fixes, one rule. |

Not merged, though adjacent: claude major 4 (`harness.js:398`, sibling manifests read in detail mode) and codex major 3 (`harness.js:401`, path escape from `.quorum/runs/`) are separate AC-13 defects three lines apart. One rewrite of the selection block closes both, but they are distinct failures and each needs its own assertion.

Nothing was dropped as wrong. Every finding cites a specific line, an acceptance criterion or a frozen contract clause, and — where the reviewers made verifiable claims about repository state — those claims check out.

---

## Blockers

**blocker 1 — `spike/src/engine.js:324` · the internal `_started` field is persisted, so mid-run manifests violate their own frozen schema.** `allocateOccurrence` stamps `_started` on the object pushed into `ctx.history.manifest.steps`, removed only at `:334`; `replaceManifest` (`:352`) serialises the whole snapshot. Any manifest written while another occurrence is still running carries `_started`, and `contracts/Q-0011/run-manifest.schema.json` sets `additionalProperties: false`. Reachable through any `parallel:` block or fan-out wave, and permanent if the process is killed in that window — exactly the state AC-13 promises will be readable. Fix off-object (a side `Map` in `ctx.history`, or a projection stripping underscore keys), then assert that a manifest read *during* a parallel step validates.

**blocker 2 — `spike/bin/harness.js:138` · `vendorTokenTotal` double-counts Claude's cache-creation tokens.** `spike/src/adapters/claude.js:60` folds `cache_creation_input_tokens` into `input_tokens` *and* reports it as `cache_write_input_tokens`; the CLI adds both. `contracts/Q-0011/run-history-writer.contract.md` states the rule verbatim — *"Input totals already include vendor-reported cache components; readers do not add them again."* Against the M0 measurement on record (~71,600 input of which 38,400 cache) this overstates by roughly 35% on the single number the ticket exists to produce. The comment above the function asserts the opposite of what the writer does.

**blocker 3 — `spike/src/engine.js:290` · AC-1's collision refusal is not implemented, and an undeclared stage guard stands in for it.** The code compares the in-memory ticket stage against `ticket.md` on disk — a property in no criterion and no contract — while a real collision falls through to `mkdirSync` at `:297` and surfaces as a raw `EEXIST` Node stack via `spike/bin/harness.js:449`. The AC-1 scenario passes only because `nextRunId` allocates `<id>-2`, so the directory never collides and the stage guard fires instead: the criterion under test is never reached. Translate the errno into a `FlowError` naming the directory, drop or separately justify the stage guard, and rewrite the scenario to pre-create the directory `nextRunId` will actually allocate.

**blocker 4 — `spike/src/engine.js:745` · the branch is 91 commits behind `main`, 15 of them in the three files this ticket instruments.** Verified independently: `merge-base` is `2d1206b`, `git rev-list --count harness/Q-0011/integration..main` is 91, and 15 of those touch `spike/src/engine.js`, `spike/bin/harness.js` or `spike/src/adapters/`. Named collisions confirmed in the log: `8420a11` (`--dry` must not mutate the ticket), `c69cd99` (`finish()` rolls the ticket branch back), `78f626d` (empty diff range is a failure), `c35b0f0` (`lint.js` extraction), `ce26288` (keep every result line — the branch still carries the old `out.slice(-8000)` report at `:745`). This diff inserts hooks into `runFlow`, `runScript`, `runIntegrate` and `finish`, which is precisely where those commits landed. Merge `main`, re-run the suite, and re-review the reconciled hunks; do not resolve these conflicts at the gate.

---

## Majors

**major 1 — `spike/src/engine.js:239` · billed usage is lost when post-adapter processing throws.** *(codex)* Between the adapter returning and `terminalOccurrence` persisting usage at `:260`, several operations can throw — writing declared outputs, verdict files, committing the worktree. The outer handler at `:133` marks the occurrence failed with an `unknown` error and retains neither `res.usage`, vendor nor attempts, so a billed call lands in the record with `usage: null` and is excluded from the roll-up. That is AC-10's exact scenario and the ticket's founding grievance. Retain the adapter result on the occurrence the moment the call returns.

**major 2 — `spike/src/engine.js:223` (adapter failure) and `spike/src/engine.js:746` (integrate) · `output.txt` is not guaranteed.** *(codex + claude, one rule, two sites)* The adapter failure path writes `output.txt` only when the thrown error carries a non-null `raw`, so a billed failure without `raw` leaves the directory empty and makes the on-disk shape depend on adapter-specific error behaviour. On the integrate side, the occurrence is allocated at `:675` and `output.txt` written at `:746`, with the base-sync throw at `:702` and any `mergeInto`/`ticketWorktree` failure in between — so the most common integrate failure yields an empty folder. The writer contract says integrate occurrences *always* receive `output.txt`, empty if there was no text; AC-5 says the same for adapter attempts. Write it in a `finally` or seed it at allocation, and assert it on the failure branch EDGE-2/EDGE-3 already exercises.

**major 3 — `spike/bin/harness.js:401` · run selection permits reads outside `.quorum/runs/`.** *(codex)* The positional token is joined straight to `runsRoot` and any resulting existing directory is accepted as an exact run; tokens containing `..`, `/` or absolute components select elsewhere, and `--json` echoes the parsed document to stdout. AC-13 confines reads to the selected run directory. Require a single valid basename, resolve the candidate, and verify its parent is exactly the resolved runs root.

**major 4 — `spike/bin/harness.js:398` · detail mode parses every sibling manifest before opening the one requested.** *(claude)* `readRunsDir(runsRoot)` runs unconditionally ahead of the token dispatch, so `harness runs Q-0011-3` reads the whole history to display one run — the coupling AC-13 forbids, and a real cost on a repository with a year of runs. Move the call into the two list branches.

**major 5 — `spike/bin/harness.js:417` (also `:421`) · ticket-filtered lists exit 0 while naming a malformed sibling.** *(codex + claude, independently)* The branch renders warnings through `printRunsListHuman` and returns without setting `process.exitCode`. A script piping `harness runs Q-0011` is told success while history is corrupt. The two reviewers proposed different remedies and the contract settles it: AC-12 and `runs-cli.contract.md` require the malformed sibling to be named *and* the command to exit non-zero, so codex's fix (`exitCode = 1` whenever warnings were rendered) is the one that holds; claude's alternative of suppressing sibling warnings in filter mode would contradict AC-12. The inline comment resolving a frozen contract by argument should go with it, and the qa-red assertion freezing exit 0 (`spike/test/q0011-runs-cli.js`) needs re-pointing.

**major 6 — `spike/src/engine.js:390` · `errorOf` re-implements auth/transient classification and already disagrees with the source of truth.** *(claude)* `spike/src/adapters/index.js` exports `authError()` (`:120`) and `transientError()` (`:55`), and the DECISIONS entry places them at the contract layer so contributor adapters inherit them. The hand-rolled substitutes mis-file the *"model is not supported when using Codex with a ChatGPT account"* failure — the headline finding of Q-0001 — as `category: "adapter"`, omit `ENOTFOUND`, `EAI_AGAIN`, `EPIPE`, `fetch failed` and `stream interrupted`, and let `\b5\d\d\b` match any three-digit number as `transient`. The retry wrapper and the manifest can now classify one error two ways. Import and derive.

**major 7 — `spike/bin/harness.js:143` · `formatMoney` rounds real costs to `$0.00`.** *(claude)* `toFixed(2)` against `formatCost`'s `toFixed(3)` everywhere else. The tokens-only decision forbids rounding a cost to `$0.000`; `$0.00` is the same failure one digit earlier, and it makes a $0.004 step indistinguishable from a vendor-reported zero — the distinction the semantic validator goes to real trouble to preserve.

**major 8 — `spike/src/engine.js:440` · a one-second timer in `runGate` exists only to make a test win a race, and loses it.** *(claude)* `setTimeout(() => {}, 1000)` is justified by a hypothetical UI whose gate promise owns no libuv handle; the CLI's own gate holds a `readline` handle, so the only consumer is the fixture in `spike/test/q0011-run-history.js`. After 1000 ms the loop drains and the child exits with no manifest finalisation — the opposite of the stated intent — and the test passes only because 10 ms polling usually delivers `SIGTERM` inside the window. Delete it; give the fixture a promise that owns its own handle.

**major 9 — `spike/src/adapters/mock.js:38` · `scope` splits on a directory this repository does not use, putting absolute paths into persisted output.** *(claude)* The split targets `.quorum/worktrees/`, but `spike/src/git.js:11` writes worktrees to `.harness/worktrees/` — and this ticket's own non-goals say so explicitly. The split never matches, so `scope` is the full absolute `cwd`, the call counter silently becomes per-worktree (changing long-standing mock semantics untested), and `key` is interpolated into `output.summary` at `:54` — reaching `output.txt`, ticket artifacts (`engine.js:241`) and commit subjects (`engine.js:251`) as `/private/var/folders/…`. AC-2 prohibits absolute paths in anything persisted. Drop `scope` from the key; the `kind` discriminator is the part that was needed and it is sound.

**major 10 — `spike/src/adapters/index.js:85` · the retry wrapper manufactures a usage object for an adapter that reported none.** *(claude)* `spent` starts all-`null`, so an absent `res.usage` still yields `usage: { vendor, …nulls }`; `rollup` then creates a vendor row with `step_count: 1` and `unpriced_steps: 1`. The writer contract restricts the roll-up to occurrences with non-null usage, and `claude.js:56` returns all-`null` measures whenever the envelope carries no `usage` — so a real response inflates the very `unpriced_steps` figure AC-12 requires the CLI to state out loud. Mirror the shape the error path at `:91` already uses.

---

## Nits

- **nit — `spike/bin/harness.js:195`** the per-step `usage:` line reuses `formatVendorSummary` with a synthesised `unpriced_steps`, printing a roll-up field on a row that is not a roll-up and collapsing four measures into one total, which makes the `cached_input_tokens` / `cache_write_input_tokens` distinction AC-9 preserves unreadable. Print the fields.
- **nit — `spike/src/engine.js:393`** `authErrorCategory(vendor, message)` never uses `vendor`; drop the parameter, or delete the function as part of major 6.
- **nit — `spike/bin/harness.js:383`** `readData(f)` re-reads and re-parses a file `validateFile` parsed one line earlier. Return the parsed document — note the existing `data` field is a display basename, so this needs a new field rather than a reuse.
- **nit — `spike/src/git.js:42`** `ensureExcluded` warns through `console.warn`, bypassing the run's `ui.warn`, so in `--json` consumers it lands on a different stream from every other warning. Pass a warn callback or re-warn at `engine.js:310`.
- **nit — `spike/src/engine.js:98`** when `initialiseRunHistory` throws, the `start` line is already in `runs.log` and `finish()` never runs, leaving a run with no terminal line — the gap Q-0004 closed for interrupts. Harmless to `nextRunId`, which takes a max. Emit `start` only after initialisation succeeds.
- **nit — `spike/src/engine.js:333`** (validator side: `checkRunManifestSemantics` in `spike/bin/harness.js`) the semantic check requires `duration_ms === Date.parse(ended_at) - Date.parse(started_at)` exactly, while the writer clamps with `Math.max(0, …)`. A backwards clock adjustment mid-run produces a manifest the writer considers correct and its own validator rejects. Allow the clamp on both sides, or drop it.

---

## Judging the panel

**Coverage was genuinely complementary, not redundant.** Codex produced four findings against claude's eighteen, but three of the four are things claude missed entirely, and two of those three — usage lost after a successful adapter call, and `output.txt` absent on the adapter failure path — sit on AC-10 and AC-5, the ticket's own reason for existing. Codex read the failure paths; claude read the contracts and the test file. The one place they converged (AC-12's exit code) is the finding most likely to be waved through, which is a reasonable argument that the panel is doing its job.

**Where the reviewers disagreed, the contract decides.** On AC-12, claude offered "exit non-zero, or stop printing sibling warnings in filter mode" as equally acceptable. The second option contradicts AC-12's plain text, so codex's narrower remedy is the correct one. Recorded in major 5 rather than left to the implementer.

**Claude's closing observation is the most important thing either review says**, and it survives independent of any individual finding: three of the four blockers are invisible to the suite in the diff, each because the assertion inspects the artifact at the moment it is most likely to be well-formed. The AC-3 parallel scenario reads the manifest only after `run()` resolves, so it cannot see `_started`. The CLI fixture nulls both cache fields, so the token total cannot double. The AC-1 scenario obtains its rejection from a different guard than the one under test. Fixing the three defects without re-pointing the three scenarios buys a green suite that proves what it proved this round.

**One claim was checked rather than taken on trust.** Blocker 4 is the only finding about repository state rather than code, and the only one that could have gone stale between review and gate. It did not: merge-base `2d1206b`, 91 commits, 15 of them in the instrumented files, and every commit claude named is in the log.

**Observation outside the panel's findings, for the maintainer, not a blocker.** The solution's B-2 requires the maintainer to replace the stale "an events schema" phrase in `backlog/Q-0011-run-history-on-disk/ticket.md` before qa-red, because no implementation task may edit that file and the engine includes the ticket body verbatim in downstream prompts. The phrase is still present in the ticket body carried into this round. Neither reviewer flagged it — correctly, since it is not in the diff — but it is a pre-condition the approved solution names and it is still outstanding.

## Before round 2

1. Merge `main` first (blocker 4). The four other blockers and every major live in `runFlow`, `runIntegrate`, `finish` and the CLI selection block — the same hunks that will conflict. Fixing them on a stale base means fixing them twice.
2. Re-point the three scenarios named above before re-reviewing, otherwise round 2 re-reads a green suite.
3. Majors 3, 4 and 5 are one rewrite of the `harness runs` selection and dispatch block; majors 1 and 2 are one rework of occurrence terminalisation. Batching them is cheaper than five patches.
