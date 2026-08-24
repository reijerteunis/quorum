# Q-0034 — Reconcile the unmerged green branches (Q-0006, Q-0011)

*Merged requirement · head-of-product · 2026-08-24 · milestone M2 · iteration 2*

*Verdict: **needs-input**, on one question. Round 1 raised three blockers; two are cleared below with evidence — the range guard does not foreclose the `--base` flag, and the merge-authority question is already answered by the chore-flow decision of 2026-08-24. What remains is size: seventeen criteria across three routings. The seam is proposed with every criterion assigned, so accepting or overriding it is a one-line answer.*

## Problem

Two tickets that M1 paid for and marked `green` are not in this repository. `harness/Q-0011/integration` is 48 commits ahead of `main` and carries the entire run-history feature — the engine writing `.quorum/runs/<id>/`, the reader that lists and inspects those runs, and the per-vendor roll-up that reports money where a vendor reports money and tokens where it does not. `harness/Q-0006/integration` is 3 commits ahead, 45 insertions across `spike/src/engine.js` and `spike/src/adapters/index.js`. Neither is in any clone, and nothing says so: `harness board` shows both tickets as `green`, beside Q-0033, which is also `green` and *is* on `main`. The board renders the same word for work that shipped and work that exists on one laptop.

Nobody found this from the board. It surfaced on 2026-08-24 while chasing why `.quorum/` was absent from the working tree, and the first explanation reached for — `.gitignore` — was wrong. `grep -rn "\.quorum" spike/src spike/bin` on `main` returns nothing, because the code that would create the directory was never merged.

Four separable things are wrong, and one investigation produced all four:

1. **The code is not on `main`,** and landing it is judgement rather than a command.
2. **`green` does not distinguish "integrates and passes its suite" from "shipped."** Nothing in the stage list, the board or `docs/02-sdlc-pipeline-spec.md` §3.4 makes that distinction, which is why the gap stayed invisible until someone went looking for a directory.
3. **The empty-diff diagnosis is on the record twice and still unsettled,** and the engine ships one of the two explanations as a user-facing sentence.
4. **Two fixes are already written and uncommitted in the working tree,** and one of them collides with the branch being landed on the exact same lines.

## What the repository actually says

Every row re-derived on 2026-08-24 against the working repository with read-only commands. Rows 1–4 correct the ticket body; rows 5–8 correct one or both candidates; rows 9–11 correct the round-1 merged document. Each changes what should be built.

| Claim | What the repository says |
| --- | --- |
| Q-0011's merge must reconcile a `spike/src/lint.js` that appears deleted | The apparent deletion is an artifact of two-dot `git diff main <branch>`. The file is absent from the branch because `main` created it after the merge-base (`2d1206b`), so a three-way merge keeps it untouched. Verified: `git cat-file -e harness/Q-0011/integration:spike/src/lint.js` fails; `merge-tree` never mentions the path. |
| Q-0011 ships `harness history` | The command is `harness runs [ticket\|run-id] [--json]`. `spike/bin/harness.js:393` on the branch dispatches `case 'runs'`, and `contracts/Q-0011/runs-cli.contract.md` is titled for it. Both the ticket body and Codex AC-4 name a command that does not exist. |
| `materialiseDiff` hard-codes "already merged into main" for any empty range | It does not. `spike/src/engine.js:460–467` on `main` runs `git merge-base --is-ancestor <integration> <base>` and only then selects that sentence; the other branch says "no commits to review". The defect is narrower and real — see the next row. |
| The diagnostic is simply wrong | The conclusion follows from the check, but the message reports the conclusion without the evidence, and it recommends a workaround — *"point `input.diff` at the merge commit"* (`spike/src/engine.js:466`) — that Q-0006's own branch makes impossible at `spike/src/engine.js:456`. It also states a *historical event* ("is already merged into") from an *ancestry fact*, which is the shape of claim the erratum exists to warn about. |
| Q-0011 conflicts in exactly four files | **Five.** `git merge-tree $(git merge-base main harness/Q-0011/integration) main harness/Q-0011/integration` reports `changed in both` for `docs/04-architecture.md`, `docs/DECISIONS.md`, `docs/GLOSSARY.md`, `spike/bin/harness.js` and `spike/src/engine.js`, across **7** conflicted hunks. `docs/04-architecture.md` is a numbered living document and both candidates omit it from their loss-checks. |
| Q-0006 is "3 unmerged commits" | Misleading. The three are `ebf1c6e` (*"Merge branch 'main' into harness/Q-0006/integration"*), `aa746ad` (the only development commit) and its integration merge. Three `fix(engine) … [Q-0006]` commits — `78f626d`, `9e488d7`, `bfb90c0` — are ancestors of **both** `main` and the branch, having been hand-applied to `main` out of band. The reconciliation task is to land one commit's 45 insertions, not to merge a feature branch. |
| Q-0006's merge is "clean today" | Provably clean, and the evidence is worth stating: merge-base is `6cc9da4`, the branch changes exactly `spike/src/engine.js` and `spike/src/adapters/index.js` since then, and `git diff --name-only 6cc9da4..main` intersects that set in **zero** files. Not a fast-forward — `main` is 16 commits ahead on unrelated paths — but a conflict-free three-way merge. |
| Q-0006 is "45 insertions across two files" | True by line count and misleading by content. The branch carries six separable decisions: a run-level diff preflight (`ctx.diffInputs`, `spike/src/engine.js:30`, `:55`) that materialises every distinct range before the first step runs; the range guard at `:456`; counter plumbing through `handleFail`/`runGate`; a `schemaFor` findings-pattern relaxation for non-review verdict enums; a UTF-8 truncation fix; and a rename of the SIGINT terminal outcome from `interrupted` to `aborted` (`:42`). The last is a persisted-vocabulary change neither candidate noticed. |
| The range guard removes the surface the `--base` flag needs | It does not. `expectedRange` is `${base}...${integration}` where `base` is `ctx.vars.base ?? config.repo.base_branch` — exactly what a `--base` flag would set. The guard forbids a *flow file* pointing `input.diff` somewhere unrelated to the pair the engine resolved, which is the thing that should be forbidden. Round 1 called this a blocker; it is a decision with an obvious answer. |
| The board already knows about git | It does not. `case 'board'` in `spike/bin/harness.js` reads `t.meta.stage` and `t.meta.history` and makes no git call at all. AC-14 is genuinely the first git call in the render path, which is why the missing-ref case has to be designed rather than assumed. |
| The base branch must be confirmed | `harness/harness.yaml:20` sets `repo.base_branch: main`. Answered; not an open question. |
| The working tree is clean | It is not. `spike/src/engine.js` (a `--dry` run that mutated `ticket.md`, advanced the stage and wrote `runs.log` having invoked nothing) and `spike/src/adapters/index.js` (`PROBE_SCHEMA` declared `summary` but required only `ok`, which OpenAI strict structured outputs reject) are modified, plus untracked `spike/test/q0034-dry-run.js` and `spike/test/q0034-probe-schema.js`. `spike/test/run.js` discovers every `spike/test/*.js`, so those two files are already executing locally while being absent from git — the evidence is unreproducible until they are committed. Both source changes touch the same `PROBE_SCHEMA`/`PROBE_PROMPT` lines Q-0006's branch rewrites, with a different `summary` value. |
| Q-0011 has been reviewed | It has not. `backlog/Q-0011-run-history-on-disk/` contains `dev`, `qa`, `requirements` and `solution` and no `review/`. |

The dollar value of the unlanded work is not load-bearing and no criterion depends on it. For context, M1's closing entry records `runs.log` sums of $33.74 for Q-0006 and $65.42 for Q-0011 across their whole lives, and warns that `ticket.md`'s `history` roll-up understates both.

## User stories

**`maintainer`** — I finished two tickets a day ago and cannot tell from `harness board` that their code is not on `main`. I want the board to tell me where a ticket's branch actually is, and I want these two branches landed with the conflicts resolved by someone who looked at them, not squashed away.

**`adopter`** — I cloned the repository, read that Quorum records run history on disk, ran a flow, and found no `.quorum/` and no `harness runs`. I want the feature the docs describe to be in the clone, and I want the tool to fail loudly rather than politely when the evidence a step needs is missing.

**`contributor`** — I want to know what `green` means before I quote it in an adapter or a template. If it means "the suite passed on a branch", the docs should say that and the board should show me the rest.

## Proposed split

Seventeen criteria is over the size this project has measured itself against, but the count is the smaller problem. The three workstreams route differently, and one of them cannot be routed through a flow at all:

- **Landing** is a human act on `main`. No flow may write outside `.quorum/worktrees/`, and none exists that could merge to the base branch. It also carries an ordering dependency no single run can express: Q-0011's diff must be reviewed *while it is still unlanded*.
- **The diagnostic** is an ordinary behaviour change with ordinary tests, and it is the only part with a genuine red phase.
- **The board and `green`** is the only part that stops this recurring, which is exactly why it must not be the part that gets dropped when the landing runs long.

The seam:

| Ticket | Scope | Criteria | Route |
| --- | --- | --- | --- |
| **Q-0034** (re-scoped) | Land both branches, with a reconciliation record, a cross-vendor review of Q-0011 while unlanded, landing evidence, and the two in-flight fixes that collide with the landing | AC-1 … AC-9 | Human, outside the flows, per the 2026-08-23 decision |
| **Q-0035** | The empty-range diagnostic: evidence not story, no adapter billed, the message reconciled with the guard, the erratum settled | AC-10 … AC-13 | Chore flow |
| **Q-0036** | What `green` means and where the code is: board containment column, docs, decision entry | AC-14 … AC-17 | Chore flow |

**This seam differs from round 1's in one place, deliberately.** Round 1 put the two in-flight fixes in Q-0035 and then had to record that "Q-0035 cannot start before Q-0034 because `PROBE_SCHEMA` is edited on both Q-0006's branch and in the working tree with different values". A cross-ticket dependency on the same lines of the same file is a bad cut. Putting AC-8 and AC-9 in Q-0034 means the `PROBE_SCHEMA` collision is resolved exactly once, by the person already resolving it, and Q-0035 inherits a settled file.

Order is **Q-0034 → Q-0035 → Q-0036**. Q-0035 follows Q-0034 because Q-0006's landing rewrites `materialiseDiff`, and rewriting the same function from two directions is how the round-1 seam would have gone wrong. Q-0036 is independent of both and goes last only because it is the least urgent — nothing is at risk while it waits, whereas the two branches rot against `main` every day they are not landed.

**Routing note on Q-0035.** It is the one part with a real red phase, so the full SDLC is defensible. I recommend the chore flow anyway: `materialiseDiff` is the function the review flow itself calls to build its own input, so a full-SDLC run on Q-0035 would be reviewing a branch through the code that branch is changing. That is the reflexive hazard the 2026-08-23 decision names, and Q-0033 spent roughly $41 learning it costs money to rediscover.

If the gate prefers one ticket, the criteria below stand as written; the split is a recommendation about cost and routing, not about content.

## Acceptance criteria

Every criterion is checkable on the CLI surface, in a test, or on repository state. Only AC-2 requires re-running a paid flow. `<base>` is `main`, resolved from `harness/harness.yaml:20`.

### Q-0034 — landing the two branches

**AC-1 — Reconciliation record, written before any merge.** `backlog/Q-0034-…/dev/landing-Q-0006.md` and `…/dev/landing-Q-0011.md` each record, for their branch: the examined head SHA and `<base>`'s head SHA at the time; the merge base; the count of unique commits and the changed files; the overlap with base-branch changes made since; the selected strategy (`merge`, `rebase` or `re-derive`) and why; every conflict encountered and how it was resolved; and every behaviour deliberately dropped, mapped to the commit that introduced it and the reason. `landing-Q-0006.md` names each of the six separable changes in the table above — the diff preflight, the range guard, the counter plumbing, the `schemaFor` relaxation, the UTF-8 fix and the SIGINT rename — as retained or dropped. An omission without a recorded reason fails this criterion. A reader can check any resolution against the branch without re-running the merge.

**AC-2 — Q-0011 is reviewed before it lands.** The complete diff of `harness/Q-0011/integration` against `<base>` goes through the review flow while the branch is still unlanded, with a non-empty diff as input and the cross-vendor rule satisfied. The verdict and findings are committed as files under `backlog/Q-0011-…/review/`, which does not exist today. Findings not fixed before landing are opened as tickets and those ids appear in `landing-Q-0011.md`. A `changes-requested` verdict does not advance the ticket.

**AC-3 — Q-0006's behaviour is on `<base>`, and its vocabulary change is explicit.** `git merge-base --is-ancestor harness/Q-0006/integration <base>` exits 0 — or, if the strategy was `re-derive`, `landing-Q-0006.md` names the equivalent commit for every retained behaviour. On `<base>`: `spike/src/engine.js` materialises every distinct `input.diff` range once at run level before the first step executes, and `spike/src/adapters/index.js` lists `summary` in `PROBE_SCHEMA.required`. The SIGINT terminal outcome is stated explicitly: either it stays `interrupted`, distinct from a gate `abort`, or the rename to `aborted` lands with a DECISIONS entry recording why `interrupted` stops being one of the four terminal outcomes the 2026-08-22 entry enforces. It may not change by conflict resolution. `spike/test/q0006-engine.js` passes unmodified.

**AC-4 — Q-0011's behaviour is on `<base>`.** `git merge-base --is-ancestor harness/Q-0011/integration <base>` exits 0, or AC-1's equivalence mapping covers it. `grep -rn "\.quorum" spike/src spike/bin` returns at least one hit. `node spike/bin/harness.js runs --json` exits 0 and emits valid JSON both on a repository with no recorded runs and on one with them. Q-0011's committed tests — `spike/test/q0011-run-history.js` and `spike/test/q0011-runs-cli.js` — pass unmodified; they are the specification of the feature and are not re-derived here. `.quorum/` remains in `.gitignore`: the feature ships in the clone, the run data does not.

**AC-5 — Nothing on the current base is lost to a conflict resolution.** `spike/src/lint.js` still exists and `node spike/bin/harness.js lint` exits 0 — the extracted module is not replaced by an older inline implementation merely because the branch predates Q-0033. Across all three documents that conflict — `docs/DECISIONS.md`, `docs/GLOSSARY.md` and `docs/04-architecture.md` — every `^## ` heading, every `^\*\*` term and every `^#{2,3} ` section present on either side before the landing is present after it, with DECISIONS entries still in date order and the 2026-08-24 erratum intact. All three are append-only or additive, so "take ours" and "take theirs" are wrong by construction.

**AC-6 — The whole suite is green, against a captured baseline.** Both CI jobs are exercised: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test` for the workspace, and `npm ci && npm test` in `spike/` for the regression suite. Both pass on `<base>` after both landings. The same commands' results on `<base>` *before* the first landing are captured in the same file, so a pre-existing failure is not mistaken for one the merge caused. The exact commands and results are recorded. Any new behaviour introduced by the reconciliation itself carries a test.

**AC-7 — Landing evidence names commits, not adjectives.** A completion record names, per branch, the reviewed integration commit and the base-branch commit that contains it, and a scripted check proves the reviewed tree is represented in `<base>` and that a fresh checkout of `<base>` passes both suites. Q-0006 and Q-0011 may not be described as reconciled on the grounds that their original branches are still green. The check is re-runnable by a reader and is recorded as a command, not a claim.

**AC-8 — `--dry` changes nothing.** `harness run <flow> <ticket> --dry` leaves `ticket.md` byte-identical, creates no file in the ticket folder including `runs.log`, does not advance the stage, and does not reset the ticket branch; the real run afterwards still consumes the stage the preview previewed. Covered by `spike/test/q0034-dry-run.js`, which is **committed** — it is untracked today, and `spike/test/run.js` discovers it, so the local suite is currently proving something no clone can reproduce.

**AC-9 — Every schema lists what it declares.** `PROBE_SCHEMA` lists every property it declares in `required`, and so does every shape `schemaFor()` emits; a test asserts both. `harness adapters --probe` reports codex's login on its own merits rather than failing on a schema the vendor rejects. Covered by `spike/test/q0034-probe-schema.js`, likewise committed. The `PROBE_PROMPT` wording collision with Q-0006's branch is resolved once, here, and named under AC-1.

### Q-0035 — the empty-range diagnostic

**AC-10 — The empty-range failure reports evidence, not a story.** The error names the range, both refs with their short SHAs, and the outcome of the containment check that produced its conclusion. It distinguishes only git states the engine has verified and asserts no historical event it cannot prove — in particular it does not say a branch "is already merged" when what it checked was ancestry. Tests in `spike/test/` cover: the integration tip is an ancestor of `<base>`; the refs are different commits with identical trees; the configured range is wrong or empty; a required ref is missing. Each asserts that both SHAs appear in the message.

**AC-11 — No adapter is billed before bad evidence is found.** A flow whose first step invokes an adapter and whose later step carries an `input.diff` over an empty or unresolvable range fails before that adapter is invoked. Tested with the mock adapter by counting invocations; the count is zero, in every case listed in AC-10.

**AC-12 — The message and the guard agree.** The empty-range message no longer recommends pointing `input.diff` at a merge commit, which `spike/src/engine.js:456` forbids. The guard itself is retained: it composes with a future `--base` flag, since `expectedRange` is derived from `ctx.vars.base`, and the criterion asserts that composition explicitly so the flag is not foreclosed. If the maintainer overrides and drops the guard instead, that is recorded under AC-13 and the message may keep its recommendation.

**AC-13 — The record is settled.** `docs/DECISIONS.md` gains an entry naming the 2026-08-24 erratum and closing it, with evidence a reader can re-run: the two heads at review run 10 (`main` at `cdec5e9`, the branch at `998f397`, per `backlog/Q-0006-…/runs.log`), the containment check that succeeds between them, and the reflog entries that moved the branch afterwards. It states plainly whether the sentence the engine printed was accurate at the time, and it records the AC-12 decision with its alternatives.

### Q-0036 — what `green` means, and where the code is

**AC-14 — The board says where the code is.** For every ticket at stage `green` or later whose `branch` value resolves to an existing git ref, `harness board` shows `<base>` and one of three factual states: the tip is contained in `<base>`; it is not contained, with how many commits it is ahead; or the state is indeterminate because a required ref is missing. A missing ref is never reported as contained or not contained. The value is derived from git on each invocation and nothing is stored in `ticket.md`. A ticket with no resolvable ref renders as it does today, and the command exits 0 in a repository with no `harness/*` branches at all. Tests cover all three states.

**AC-15 — The docs say what `green` means.** `docs/02-sdlc-pipeline-spec.md` §3.4 and the **Stage** entry in `docs/GLOSSARY.md` state that a stage is the ticket's position in the SDLC, that `green` means the integration branch integrated and passed its configured suite, and that it never implies the code is contained in `<base>`. Both name AC-14's board output as where containment is visible. The stage state machine is not silently reinterpreted and no stage is added.

**AC-16 — The decision is on the record.** `docs/DECISIONS.md` gains an entry recording that containment is derived from git rather than tracked as a stage or a frontmatter field, with the alternatives considered — a `landed:` field, a stage after `deployed` — and why each was rejected.

**AC-17 — The plan and the vocabulary keep up.** `docs/06-development-plan.md` lists Q-0034, Q-0035 and Q-0036 as M2 work without rewriting the historical M1 record. Any term this work repeats across more than one file is defined in `docs/GLOSSARY.md` before its second use, and no synonym is introduced for an existing term.

## Non-goals

- **A `--base` flag, or reviewing a ticket whose branch has already landed.** M1's carried-forward open item; it deserves its own ticket. AC-12 must not close the door on it.
- **Re-specifying Q-0011 or Q-0006.** Their acceptance criteria were met and their tests are committed. AC-3 and AC-4 assert that those tests still pass; they do not restate the features.
- **A new frontmatter field, a new stage, or a change to what `deployed` means.** `deploy.yaml` does not exist yet; it is Q-0012.
- **Porting run history to `packages/core`.** That is Q-0009. This lands the spike implementation as it is.
- **Backfilling `.quorum/runs/` for runs that predate run-history persistence.**
- **Recomputing M1's cost record,** or fixing the `history` roll-up's known understatement.
- **Reconstructing a definitive narrative for every past empty diff** beyond what git can prove.
- **The other two M1 carry-overs:** no lock on a ticket, and `finish()` not rolling back task branches.
- **Deleting or tidying the abandoned and contaminated branches** (`…-run11-abandoned`, `…-contaminated`, `tests-round1`, `tests-round6`), or deleting the two original integration branches after landing. They are audit trail.
- **Automating landing.** No merge queue, no `land` command, no flow that writes to `<base>`. Merging stays a human act.
- **Any Studio UI work.** AC-14 is the CLI board only; M3 owns the web surface.
- **Changing the adapter contract** beyond the usage fields Q-0011 already requires, and **estimating money for adapters that report none.**

## Open questions

**OQ-1 — Is the three-way split accepted? Owner: `maintainer`. BLOCKER.**
Seventeen criteria across three kinds of work with different routing. The seam and the ordering are above, every criterion is already assigned, and the one change from round 1's proposal — moving the two in-flight fixes into Q-0034 — removes a cross-ticket collision on `PROBE_SCHEMA`. An architect cannot begin until they know which ticket they are solutioning. Answer "accept" and this becomes three tickets of 9, 4 and 4; answer "override" and it is one ticket of 17, with the size cost documented and accepted.

**OQ-2 — Does Q-0034's flow run end at a reviewed branch, with the merge as a recorded human act?** *Owner: `maintainer`. Resolved; override if you disagree.* Round 1 raised this as a blocker. It is answered by the chore-flow decision of 2026-08-24: a chore ticket produces `reviewed` and lands on a human gate, and the human merges. AC-3, AC-4, AC-6 and AC-7 are therefore written as **scripted checks recorded as evidence**, re-runnable by any reader after the merge, rather than as assertions a run performs. That makes them expressible whichever way the routing goes, and it is why this is no longer blocking.

**OQ-3 — Merge, rebase or re-derive Q-0011?** *Owner: implementer. Recommendation: merge.* The 48 commits are the audit trail of a five-round solutioning and a two-vendor fan-out, and five files with seven conflicted hunks is tractable. A rebase rewrites evidence M1's closing entry cites by SHA. If the engine conflict proves intractable against 81 commits of later work, re-deriving is the honest fallback and AC-1 is where that gets said. Not blocking — every answer satisfies AC-4.

**OQ-4 — Order of landing.** *Owner: implementer. Recommendation: Q-0006 first, and this is now a fact rather than an impression.* Its merge-base with `main` is `6cc9da4`; it changes two files since then and `main` has changed neither, so the merge is conflict-free. Re-run `git merge-tree $(git merge-base main harness/Q-0011/integration) main harness/Q-0011/integration` after the first landing rather than trusting today's five-file result. Not blocking.

**OQ-5 — Does the SIGINT rename stay?** *Owner: `maintainer`. Recommendation: keep `interrupted`.* The 2026-08-22 decision names four terminal outcomes and `interrupted` is one of them; `spike/test/q0006-engine.js:184` already asserts `aborted` for a gate abort, so the rename collapses two distinct events into one word in `runs.log`, and Q-0011's `run-manifest.schema.json` accepts both so nothing fails loudly. AC-3 forces the choice into the open either way. Not blocking.

**OQ-6 — Which probe prompt survives?** Q-0006's branch sends `{"ok": true, "summary": "subscription answered"}`; the working tree sends `"ok"` and exports the constant so a test can import it. *Recommendation: the branch's wording, the working tree's export.* Cosmetic, but it is a conflict someone will otherwise hit blind. Not blocking.

**OQ-7 — Do Q-0006 and Q-0011 get append-only history notes pointing at the landing evidence?** *Owner: `maintainer`. Recommendation: yes, one line each.* Existing history is not rewritten either way. Not blocking.

## Risks

- **The landing is performed by hand, on `main`, from a dirty tree.** This is the one place in the project where someone touches the base branch directly, and the tree holds uncommitted work that overlaps Q-0006's diff on the same lines. Mitigation: commit the in-flight work on the ticket branch first (AC-8, AC-9), land, then verify with AC-3 through AC-6. A `git merge --no-commit` dry pass before each real one costs nothing.
- **A careless resolution in `docs/DECISIONS.md`, `docs/GLOSSARY.md` or `docs/04-architecture.md` silently deletes content.** All three conflict; round 1's loss-check covered only the first two. AC-5 makes all three mechanically checkable rather than a matter of care.
- **A mis-resolved `spike/src/engine.js` merge resurrects code Q-0033 deliberately removed** — most obviously by re-inlining the lint rules now in `spike/src/lint.js`. AC-5's `harness lint` check catches the loud version; AC-1's landing note is what catches the quiet one.
- **Q-0006 looks smaller than it is.** Forty-five insertions across two files reads like a formality, and it carries six separable decisions including a persisted-vocabulary change. AC-1's per-change mapping exists because the diff's size invites skipping it.
- **The two untracked test files are load-bearing and invisible to git.** `spike/test/run.js` discovers every `*.js` in the directory, so the local suite currently proves behaviour no clone can reproduce, and a `git checkout` or a stash mishap loses it silently.
- **Reviewing 48 commits may exceed what a reviewer can hold.** The three-dot diff is roughly 1,189 insertions, within `max_diff_bytes` of 200,000, so it will not truncate — but M0's finding stands that reviewer rounds find problems and fix them badly. AC-2 deliberately allows findings to become follow-up tickets rather than forcing a revise loop on a branch that is already stale.
- **Landing Q-0011 makes the engine write `.quorum/runs/` in this repository for the first time,** and Q-0008's CI has never run against a tree where those writes happen. `.gitignore` covers the directory; AC-6 running both CI jobs is the check.
- **AC-14 puts a git call in the board's render path** — the board makes none today, so this is new surface, not a tweak. A missing ref must produce the indeterminate state rather than a crash, and a shallow clone must not be reported as "not contained".
- **This work changes the diff materialiser, the board and the gate machinery — the reflexes the flows themselves use.** The 2026-08-23 decision says not to drive that through the full SDLC, and the chore flow is the routing that replaces it. Q-0035 is the only part with a genuine red phase, and even there the routing note above recommends chore.

## Cross-cutting checklist

- **BYOS** — No auth path is added or changed. AC-9 makes the existing login proof honest: `adapters --probe` currently reports codex as unusable because of a schema the vendor rejects, not because of anything about the subscription. `check()`'s refusal on `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `CODEX_API_KEY` is untouched, and no key appears in any test, fixture or example.
- **Worktree safety** — No flow writes to the working tree or to `<base>`. The landings are the maintainer's own merges, outside any flow, recorded under AC-1 and AC-7. Worktrees stay under `.quorum/worktrees/`; the ticket branch stays `harness/Q-0034/integration`.
- **Gate behaviour** — Unchanged. No gate becomes `auto`, no `human-locked` gate is touched. AC-11 concerns when a step fails, not who answers for it.
- **File format** — No change to `ticket.md`'s frontmatter. AC-14 derives its answer from git precisely so that no field can drift. `contracts/Q-0011/run-manifest.schema.json` lands as the branch wrote it and is not amended here.
- **Dependencies** — None added. If one becomes necessary it carries a one-line justification and, if it changes architecture, a DECISIONS entry.
- **Product-agnostic** — No SaaS product is named anywhere in the change.
- **Cold-clone impact** — Net positive, no added step. A clone gains `harness runs` and the run history the docs already describe; the board gains one derived column in output the adopter already reads. Nothing lengthens the first 30 minutes and no new command is required before a first run.

## Provenance

**Claude's candidate is the spine, again.** It is the only one of the two that went and looked, and its correction table is why this document can state the conflict set, the command name and the branch history as facts rather than as things solutioning will discover. Its criteria survive largely intact, as do its non-goals, most of its risks and its cross-cutting checklist. Its open question 6 put the size question to the gate directly, which is the right instinct and is answered here.

**Codex's candidate supplied what Claude left implicit.** Four contributions are load-bearing and are merged in: current-base preservation as its own criterion rather than a line inside a conflict-resolution check (its AC-6 → AC-5); the *indeterminate* board state for a missing ref, which Claude's two-state formulation would report as a falsehood in a shallow clone (its AC-11 → AC-14); landing evidence naming commits, separated from the narrative landing note (its AC-9 → AC-7); and the requirement that the diagnostic "distinguish only git states the engine has verified", which is a sharper statement of the defect than "names the evidence" (its AC-12 → AC-10). Its reconciliation-record criterion is stricter than Claude's landing note — mapping every retained *and* omitted behaviour to a source commit — and that stricter version is what AC-1 uses. Several of its non-goals and risks are merged in, including shallow-clone ref resolution.

**What I struck.** Codex's AC-3, AC-4 and AC-5 re-specify run files, the history reader and the vendor roll-up — criteria Q-0011 already passed, with committed tests and signed contracts. Re-deriving them here would let this ticket's tests quietly outvote Q-0011's, which is the failure the frozen-contract rule exists to prevent; AC-4 asserts that Q-0011's own tests pass unmodified instead. Codex's AC-14 bundles six unrelated guarantees into one criterion that cannot fail cleanly, so it is demoted to the cross-cutting checklist with its two checkable parts kept. Its AC-4 also names `harness history`, a command that does not exist. Of its four declared blockers, two are solutioning work rather than product decisions (now OQ-3 and OQ-4) and one is answered by `harness/harness.yaml:20`.

**What this round found that neither candidate nor round 1 had.** Three things, each of which changes a criterion. The Q-0011 merge conflicts in **five** files, not four — `docs/04-architecture.md` was missing from every prior loss-check, and it is a numbered living document. Q-0006's "three commits" are a merge of `main` plus one development commit, with three `fix(engine) [Q-0006]` commits already hand-landed on `main` out of band, so the reconciliation question is smaller and more precise than stated. And Q-0006's merge is conflict-free by construction — zero file overlap with `main` since merge-base `6cc9da4` — which turns round 1's ordering *recommendation* into a fact.

**Two of round 1's three blockers are cleared, with reasons.** The range guard does not remove the surface a `--base` flag needs, because `expectedRange` is built from `ctx.vars.base`, which is exactly what the flag would set; the only genuine conflict is with the message text, and that is AC-12. The merge-authority question is answered by the chore-flow decision of 2026-08-24, and the criteria are written as scripted evidence checks so the answer does not change what gets built. What remains is size, which is the finding this role exists to produce and the one nobody downstream will catch.
