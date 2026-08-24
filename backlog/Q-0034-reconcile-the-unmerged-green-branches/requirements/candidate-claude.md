# Q-0034 — Reconcile the unmerged green branches (Q-0006, Q-0011)

*Requirement candidate · product-manager (claude) · 2026-08-24 · milestone M2*

## Problem

Two tickets that M1 paid for and marked `green` are not in this repository. `harness/Q-0011/integration` is 48 commits ahead of `main` and carries the entire run-history feature — the engine writing `.quorum/runs/<id>/`, the reader that lists and inspects those runs, and the per-vendor roll-up that reports money where a vendor reports money and tokens where it does not. `harness/Q-0006/integration` is 3 commits ahead and carries 45 insertions across `spike/src/engine.js` and `spike/src/adapters/index.js`. Neither is in any clone, and nothing says so: `harness board` shows both tickets as `green`, beside Q-0033, which is also `green` and *is* on `main`. The board renders the same word for work that shipped and work that exists on one laptop.

The `maintainer` did not discover this from the board. It surfaced on 2026-08-24 while chasing why `.quorum/` was absent from the working tree, and the first explanation reached for — `.gitignore` — was wrong. `grep -rn "\.quorum" spike/src spike/bin` on `main` returns nothing, because the code that would create the directory was never merged.

Three separable things are wrong, and this requirement covers all three because one investigation produced them and one branch can close them:

1. **The code is not on `main`.** Landing it is judgement, not a command — see the findings below.
2. **`green` does not distinguish "integrates and passes its suite" from "shipped".** Nothing in the stage list, the board or `docs/02-sdlc-pipeline-spec.md` §3.4 makes that distinction, so the gap was invisible until someone went looking for a directory.
3. **The empty-diff diagnosis is on the record twice, and the record is still not settled.** The M1 closing entry explains Q-0006's empty review diff one way; the erratum of 2026-08-24 says that explanation does not hold and leaves two hypotheses open. The engine ships one of those explanations as a user-facing sentence.

### What the investigation found

Facts an implementer or reviewer can re-derive. Four of them correct the ticket body, and each changes what should be built.

| Claim in the ticket | What the repository says |
| --- | --- |
| Q-0011's merge must reconcile a `lint.js` that appears deleted | The apparent deletion is an artifact of `git diff main <branch>` (two-dot). `git merge-tree --write-tree main harness/Q-0011/integration` conflicts in exactly four files — `docs/DECISIONS.md`, `docs/GLOSSARY.md`, `spike/bin/harness.js`, `spike/src/engine.js` — and does not touch `spike/src/lint.js`, which a three-way merge keeps. |
| Q-0011 ships `harness history` | The command is `harness runs [ticket\|run-id] [--json]`, and `contracts/Q-0011/runs-cli.contract.md` specifies it under that name. |
| `materialiseDiff` hard-codes "already merged into main" for any empty range | It does not. It runs `git merge-base --is-ancestor <integration> <base>` and only then chooses that sentence; the other branch says "no commits to review". The defect is elsewhere — see the next two rows. |
| Either the branch moved after the review, or the diagnosis was wrong | The branch moved, and the diagnosis was accurate at the time. At review run 10 (`2026-08-23T22:58:25Z`, per `backlog/Q-0006-…/runs.log`) `main` was `cdec5e9` and the branch head was `998f397`; `git merge-base --is-ancestor 998f397 cdec5e9` succeeds and `git diff --stat cdec5e9...998f397` is empty. `git reflog show harness/Q-0006/integration` then shows run 11 merging `main` in (`02f248f`), run 11's failure resetting it back to `998f397` — logged as `run=11 rolled-back` — and runs 12–13 merging the task branches to today's `29ad00a`. |

Two further findings, neither in the ticket body:

- **Q-0006's branch contains the fix for the billing half of the empty-diff problem, and a guard that contradicts a documented plan.** It adds a run-level preflight (`ctx.diffInputs`) that materialises every distinct diff range once, before the first step runs, so no agent can be billed before a bad range is found and every panel member receives identical bytes. On `main` the check still runs inside `buildPrompt`, per step — which is why Q-0006's review paid for a Codex reviewer and a $3.25 Claude reviewer against zero bytes. The same branch also adds `if (range !== \`${base}...${integration}\`) throw` — which forbids exactly the workaround `main`'s own error message recommends ("point `input.diff` at the merge commit") and pre-empts M1's carried-forward `--base` flag. That guard is a decision, not a merge detail.
- **The working tree is already dirty with Q-0034 work that collides with Q-0006's branch.** Uncommitted changes to `spike/src/engine.js` (a `--dry` run that mutated `ticket.md`, advanced the stage and wrote `runs.log` having invoked nothing) and to `spike/src/adapters/index.js` (`PROBE_SCHEMA` declared `summary` but required only `ok`, which OpenAI strict structured outputs reject — so `adapters --probe` reported codex's login as unusable while the login was fine), plus untracked `spike/test/q0034-dry-run.js` and `spike/test/q0034-probe-schema.js`. Both source changes touch the same `PROBE_SCHEMA` / `PROBE_PROMPT` lines Q-0006's branch rewrites, with a different `summary` value. A merge performed from a dirty tree either refuses or silently loses one side.

The exact dollar value of the unlanded work is not load-bearing here and no criterion depends on it. For context, M1's closing entry records `runs.log` sums of $33.74 for Q-0006 and $65.42 for Q-0011 across their whole lives, and warns that `ticket.md`'s `history` roll-up understates both.

## User stories

**`maintainer`** — I finished two tickets a day ago and I cannot tell from `harness board` that their code is not on `main`. I want the board to tell me where a ticket's branch actually is, and I want these two branches landed with the conflicts resolved by someone who looked at them, not squashed away.

**`adopter`** — I cloned the repository, read that Quorum records run history on disk, ran a flow, and found no `.quorum/` and no `harness runs`. I want the feature the docs describe to be in the clone, and I want the tool to fail loudly rather than politely when something it needs is missing.

**`contributor`** — I want to know what `green` means before I quote it in an adapter or a template. If it means "the suite passed on a branch", the docs should say that and the board should show me the rest.

## Acceptance criteria

Every criterion is checkable on the CLI surface or on repository state. None requires re-running a paid flow except AC-6.

### Landing the two branches

1. `git merge-base --is-ancestor harness/Q-0006/integration main` exits 0, and on `main`: `spike/src/engine.js` materialises every distinct `input.diff` range once at run level before the first step executes, and `spike/src/adapters/index.js` lists `summary` in `PROBE_SCHEMA.required`. No content from the branch's 45 insertions is dropped without being named in AC-5's landing note.
2. `git merge-base --is-ancestor harness/Q-0011/integration main` exits 0; `grep -rn "\.quorum" spike/src spike/bin` returns at least one hit; `node spike/bin/harness.js runs --json` exits 0 and emits valid JSON on a repository with no recorded runs as well as on one with them. `.quorum/` remains in `.gitignore` — the feature ships in the clone, the run data does not.
3. No decision or term is lost to a conflict resolution: every `^## ` heading present in `docs/DECISIONS.md` and every `^\*\*` term in `docs/GLOSSARY.md` on either `main` or `harness/Q-0011/integration` before the landing is present after it, and entries stay in date order. `spike/src/lint.js` still exists and `node spike/bin/harness.js lint` exits 0.
4. `npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile` followed by `npm test --prefix spike && pnpm turbo run test` passes on `main` after both landings. The same command's result on `main` *before* the first landing is captured as the baseline in the same file, so a pre-existing failure is not mistaken for one the merge caused.
5. `backlog/Q-0034-…/dev/landing-Q-0006.md` and `…/dev/landing-Q-0011.md` each record: the method used (merge, rebase or re-derive) and why; the head SHAs of `main` and the branch immediately before; every conflict encountered and how it was resolved; anything deliberately dropped and why. A reader can check a resolution against the branch without re-running the merge.
6. Q-0011's diff is reviewed by two vendors before it lands, and the verdict and findings are files under `backlog/Q-0011-…/review/`. Findings not fixed before landing are opened as tickets, and their ids appear in the landing note. The review reads the branch while it is still unlanded.

### What `green` means, and where the code is

7. `harness board` shows, for every ticket whose `branch` value resolves to an existing git ref, whether that ref is contained in `repo.base_branch` and how many commits it is ahead — for example `branch=unlanded (+48)` beside `branch=landed`. The fact is derived from git each time the board renders; nothing is stored in `ticket.md`. A ticket with no such ref renders exactly as it does today, and the command exits 0 in a repository with no `harness/*` branches at all.
8. `docs/02-sdlc-pipeline-spec.md` §3.4 and the **Stage** entry in `docs/GLOSSARY.md` state that a stage is the ticket's position in the SDLC and never implies its code is on the base branch, and name the board output from AC-7 as where landing is visible.
9. `docs/DECISIONS.md` gains an entry recording that landing is derived from git rather than tracked as a stage or a frontmatter field, with the alternatives considered (a `landed:` field; a stage after `deployed`) and why they were rejected.

### The diagnosis and the record

10. `docs/DECISIONS.md` gains an entry that names the erratum of 2026-08-24 and settles it, with evidence a reader can re-run: the two heads at review run 10, the containment check, and the reflog entries that moved the branch afterwards. It states plainly whether the sentence the engine printed was accurate.
11. The empty-range failure in `materialiseDiff` names the evidence behind its conclusion — both refs with their short SHAs and the outcome of the containment check — and not only the conclusion. A test in `spike/test/` covers both the contained and the not-contained case and asserts that both SHAs appear in the message.
12. A flow whose first step invokes an adapter and whose later step carries an `input.diff` over an empty range fails before that adapter is invoked. Tested with the mock adapter by counting invocations; the count is zero.

### The fixes already in flight

13. `harness run <flow> <ticket> --dry` leaves `ticket.md` byte-identical, creates no file in the ticket folder including `runs.log`, and does not advance the stage; the real run afterwards still consumes the stage the preview previewed. Covered by `spike/test/q0034-dry-run.js`, committed on the ticket branch.
14. `PROBE_SCHEMA` lists every property it declares in `required`, and the same holds for every schema shape `schemaFor()` emits; a test asserts both. Covered by `spike/test/q0034-probe-schema.js`, committed on the ticket branch. `harness adapters --probe` reports codex's login on its own merits rather than failing on a schema the vendor rejects.

## Non-goals

- **A `--base` flag, or reviewing a ticket whose branch has already landed.** It is M1's carried-forward open item and deserves its own ticket. This one must not close the door on it — see open question 2.
- **A new frontmatter field, a new stage, or a change to what `deployed` means.** `deploy.yaml` does not exist yet; it is Q-0012.
- **Porting run history to `packages/core`.** That is Q-0009. This ticket lands the spike implementation as it is.
- **The other two M1 carry-overs**: no lock on a ticket, and `finish()` not rolling back task branches.
- **Deleting or tidying the abandoned and contaminated branches** (`…-run11-abandoned`, `…-contaminated`, `tests-round1`, `tests-round6`). They are audit trail until something needs them gone.
- **Automating landing.** No merge queue, no "land" command, no flow that merges to the base branch. Merging to `main` stays a human act.
- **Any board work in the Studio UI.** AC-7 is the CLI board only; M3 owns the web surface.
- **Recomputing M1's cost record.** The roll-up understates and that is documented; fixing it is not this ticket.

## Open questions

1. **Merge, rebase or re-derive Q-0011?** *Owner: `maintainer`. Recommendation: merge.* The 48 commits are the audit trail of a five-round solutioning and a two-vendor fan-out, and four conflicts is a tractable number. A rebase rewrites evidence M1's closing entry cites by SHA. If the engine conflict proves intractable against 81 commits of later work, re-deriving the feature is the honest fallback and AC-5 is where that gets said. **Not a blocker** — either answer satisfies AC-2.
2. **Does Q-0006's `input.diff must resolve to {base}...{integration}` guard land as written?** *Owner: `maintainer`. **Blocker.*** It forbids the workaround the engine's own empty-range message recommends, and it narrows the surface the `--base` flag needs. Three options: land it as written and accept that the message must change with it (AC-11 touches that message anyway); land it relaxed to a warning; drop that hunk and record the drop under AC-5. Deciding after the merge means deciding it inside a conflict resolution, which is the worst place for it.
3. **Order of landing.** *Owner: implementer. Recommendation: Q-0006 first.* It is clean today; Q-0011's engine conflict is against `main` either way, and Q-0006's engine changes are small and adjacent. Re-run `git merge-tree --write-tree main harness/Q-0011/integration` after the first landing rather than trusting today's four-file result.
4. **Which probe prompt survives?** Q-0006's branch sends `{"ok": true, "summary": "subscription answered"}`; the working tree sends `"ok"` and exports the constant so a test can import it. *Recommendation: the branch's wording, the working tree's export.* Cosmetic, but it is a conflict someone will hit blind.
5. **Should the ticket body's `harness history` be corrected to `harness runs`?** *Recommendation: yes, in the same change, so the ticket and the contract agree.*
6. **Is 14 criteria one ticket?** *Owner: `head-of-product` at the gate.* It is at the top of the documented range. They share one investigation and one branch, which is the argument for keeping them together. If the gate wants a split, the clean cut is AC-7 to AC-9 — the visibility work is the only part that is not a one-off, and it is the part that stops this recurring, so it should not be the part that gets dropped.

## Risks

- **The landings are performed by hand on `main`, by a human, in a dirty working tree.** This is the one place in the project where someone touches the base branch directly, and the tree currently holds uncommitted Q-0034 work that overlaps Q-0006's diff. Mitigation: commit or stash the in-flight work on the ticket branch first (AC-13, AC-14), then land, then verify with AC-1 to AC-4. A `git merge --no-commit` dry pass before each real one costs nothing.
- **A careless conflict resolution in `docs/DECISIONS.md` silently deletes decisions.** Both sides append to an append-only file, so "take ours" or "take theirs" is wrong by construction. AC-3 exists to make that mechanically checkable rather than a matter of care.
- **A mis-resolved `spike/src/engine.js` merge could resurrect code Q-0033 deliberately removed** — most obviously by re-inlining the lint rules that now live in `spike/src/lint.js`. AC-3's `harness lint` check catches the loud version; the landing note is what catches the quiet one.
- **Reviewing 48 commits may exceed what a reviewer can hold.** The three-dot diff is roughly 1,189 insertions, within `max_diff_bytes` of 200,000, so it will not truncate — but the M0 finding stands that reviewer rounds are for finding problems and a bad way to fix them. AC-6 deliberately allows findings to become follow-up tickets rather than forcing a revise loop on a branch that is already a day stale.
- **This ticket changes the gate machinery, the board and the diff materialiser — the reflexes the flows themselves use.** The decision of 2026-08-23 says not to drive that work through the full SDLC, and the chore flow of 2026-08-24 is the routing that replaces it. A red phase over "the branch is not merged yet" is a fact about the repository, not a behaviour, and Q-0033 spent about $41 proving that costs money to learn twice. AC-11 to AC-14 are ordinary behaviour changes and carry ordinary tests; AC-1 to AC-6 are verified by repository state.
- **Landing Q-0011 makes the engine write `.quorum/runs/` in this repository for the first time.** `.gitignore` covers it, so nothing new gets committed — but Q-0008's CI workflow has never run against a tree where those writes happen. AC-4 running both suites is the check.
- **AC-7 puts a git call in the board's render path.** On a repository with many tickets that is one `merge-base` per ticket. Fast, but it is the first time the board touches git at all, and it must not turn a missing ref into a crash.

## Cross-cutting checklist

- **BYOS** — No auth path is added or changed. AC-14 makes the existing login proof honest: `adapters --probe` currently reports codex as unusable because of a schema the vendor rejects, not because of anything about the subscription. `check()`'s refusal on `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `CODEX_API_KEY` is untouched, and no key appears in any test, fixture or example.
- **Worktree safety** — No flow writes to the working tree. The landings are the maintainer's own merges into `main`, outside any flow, and AC-5 records them. Worktrees stay under `.quorum/worktrees/`; the ticket branch stays `harness/Q-0034/integration`.
- **Gate behaviour** — Unchanged. No gate becomes `auto`, no `human-locked` gate is touched, and AC-12 concerns when a step fails, not who answers for it.
- **File format and schema** — No change to `ticket.md`'s frontmatter; AC-7 derives its answer from git precisely so no field can drift. Q-0011's `contracts/Q-0011/run-manifest.schema.json` lands as the branch wrote it and is not amended here.
- **Lint rules** — None added. `harness lint` must exit 0 after both landings (AC-3), which is also the check that the whole-directory flow lint survived the engine merge.
- **Cold-clone impact** — Net positive and no added step. A clone gains `harness runs` and the run history the docs already describe, and the board gains one derived column in output the adopter already reads. Nothing lengthens the first 30 minutes.
