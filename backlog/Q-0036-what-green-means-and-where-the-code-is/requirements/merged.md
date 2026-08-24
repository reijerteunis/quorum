# Q-0036 — What `green` means, and where the code is

*Merged requirement · head-of-product · 2026-08-24 · milestone M2 · iteration 1 · routed through the chore flow*

*Scope is AC-14 … AC-17 of `backlog/Q-0034-reconcile-the-unmerged-green-branches/requirements/merged.md`. This document expands those four into nine independently testable criteria and does not re-open the seam, the routing or the ordering that document settled.*

## Problem

`harness board` prints a ticket's stage and never says whether the ticket's code is in the clone. Stage and containment are different facts and the board shows only the first, so work that integrated and passed its suite on a branch is rendered identically to work that is on `main`. That is how Q-0006 and Q-0011 sat unlanded for a day: nobody found it from the board, and it surfaced on 2026-08-24 only because someone went looking for a missing `.quorum/` directory and first blamed `.gitignore`, which was wrong.

The documentation does not close the gap either. `docs/02-sdlc-pipeline-spec.md` §3.4 draws the state machine and calls the board "a kanban over this field"; the **Stage** entry in `docs/GLOSSARY.md` defines a stage as "the ticket's position in the SDLC state machine". Neither says what `green` asserts, and — the part that caused the incident — neither says what it does not assert. A reader is left to assume, and the natural assumption is the wrong one.

Containment cannot be stored. It is a fact about two refs at the moment of reading, and either ref can move afterwards. A `landed:` field in `ticket.md` would be a copy of a git fact held in mutable state, which is the disease this ticket treats rather than a cure for it — and a wrong field is worse than no field, because it is believed. So the board derives the answer on every invocation and writes nothing.

Surfaces touched: the `harness board` CLI, `docs/02-sdlc-pipeline-spec.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md`, `docs/06-development-plan.md`. No Studio surface, no flow, no stage transition, no adapter, no persistent field, no schema.

## What the repository says today

Re-derived on 2026-08-24 against this working repository with read-only commands. Every row changes a criterion below.

| Claim | What the repository says |
| --- | --- |
| Q-0006, Q-0011 and Q-0033 are unlanded | **Not any more, and neither is anything else.** `git merge-base --is-ancestor <branch> main` exits 0 for *all five* resolvable ticket branches — Q-0006, Q-0008, Q-0011, Q-0033 and Q-0034 — after Q-0034's landing (`655e05a`, `0c93a1a`). There is no live "not contained" example anywhere in this repository, so **no test may assert a containment state against a branch in it**: such a test would be red only until the next landing and permanently green afterwards, which is exactly the failure the 2026-08-23 decision on permanent acceptance tests exists to prevent. |
| Containment matters only from `green` onward | `backlog/Q-0011-run-history-on-disk/ticket.md` reads `stage: red` and its branch is merged, because a review backward edge regressed it after the work had landed. A green-or-later filter hides the exact ticket this investigation was about. |
| "Every ticket whose branch resolves" is a quiet filter | It is, but not a perfect one. Five of eleven ticket branches resolve; the six that do not are all at `draft`. **One that resolves — Q-0034 — is also at `draft`**, so dropping the stage filter annotates one draft row today. Neither candidate knew this. See OQ-1. |
| A non-zero ancestry result means "not contained" | It means one of two different things. `git merge-base --is-ancestor <a> <b>` exits **0** when `<a>` is an ancestor, **1** when it is provably not, and **128** on a missing ref. Conflating 1 with anything above it manufactures precisely the false confidence this ticket removes. |
| A shallow clone fails loudly | It does not. `git rev-parse --is-shallow-repository` answers `false` here; in a shallow clone the ancestry check answers from the history it has rather than erroring, so a **negative can be silently wrong while a positive stays sound** — history that is present proves ancestry, history that is absent cannot disprove it. There is no error to catch, so the implementation must ask. |
| The board makes a git call today | It does not. `case 'board'` (`spike/bin/harness.js:422–442`) reads `t.meta.stage`, `t.meta.history`, `t.meta.owner` and `t.meta.iterations` and spawns nothing. This is the first git call in the render path — new surface, not a tweak. |
| New machinery is needed to call git | No. `execFileSync` is imported at `spike/bin/harness.js:14`, and `loadProject()` already yields `repoDir` and `config`. |
| There is a ref helper to reuse | Only as a closure. `hasRef` lives inside `materialiseDiff` (`spike/src/engine.js:715`) and the ancestry pattern beside it (`:728`); `spike/src/git.js` exports `ensureWorktree`, `removeWorktree` and `ensureExcluded` and nothing that reads ref state. |
| The base branch is an open question | It is not. `harness/harness.yaml` sets `repo.base_branch: main`, `harness init` rewrites it to the clone's own branch, and the engine's fallback is `config.repo?.base_branch ?? 'main'` (`spike/src/engine.js:45`). |
| Board output is unpinned | It is pinned. `spike/test/q0033-surface.js:315` asserts `/iter=.*review.*2/` and `/cost=\$1\.25/` against `harness board`; `spike/test/smoke.js:98` asserts a ticket id appears. Any new field must be additive. |
| §3.4 is free prose | It is parsed by a test. `spike/test/q0033-surface.js:328` (S13.1) extracts §3.4 by heading and asserts on the **column positions** of the ASCII diagram's `└─┘` connector runs. Prose may be added; the fenced diagram must not move. |
| A project is always a git repository | It is not. `harness init` outside a repository is deliberate — "*Anything else — no repo, detached HEAD, a branch Git cannot name — leaves the template's `main` untouched*" (`spike/bin/harness.js:397–399`). `harness board` in a non-repository is reachable and must not crash. |
| A branch name is trusted input | It is not. `t.meta.branch` comes from `ticket.md`, which agents write. `spike/src/git.js:6–8` already records the rule — branch names are "*untrusted input reaching a command line*" — which is why every call there passes an argv array to `execFileSync`. |
| Test fixtures must be built from scratch | They must not. `initFixture({ gitRepo: false })` and `initFixture({ branch: 'master' })` already exist in `spike/test/q0033-surface.js:47`, and `spike/test/run.js:16–18` discovers every `test/*.js` by name order with no wiring. |

## User stories

**`maintainer`** — I finish a ticket, the flow marks it `green`, and a day later I cannot tell from `harness board` whether the code is in my clone. I want the board to tell me where each ticket's branch actually is, read from git at the moment I look, so unlanded work is visible without me remembering to check and without a field that goes stale the first time I merge by hand.

**`adopter`** — I cloned Quorum, possibly shallowly, and I do not know its branch conventions. I want the board to say "I cannot tell, and here is why" rather than assert something false. A tool that guesses wrong once is a tool I stop believing, and the board is the first thing I run.

**`contributor`** — I want to know what `green` means before I quote it in a flow template or a docs page. If it means "the integration branch integrated and passed its configured suite", the docs should say exactly that, say what it does not mean, and point me at where the rest of the answer lives.

## Acceptance criteria

Nine criteria, each independently checkable on the CLI, in a test, or on repository state. `<base>` is `repo.base_branch` from `harness/harness.yaml`, falling back to `main` exactly as `spike/src/engine.js:45` already does.

**AC-1 — The board says where the code is, for every ticket whose branch resolves, derived on every invocation.**
For every ticket whose `branch` frontmatter value is present and resolves to a commit, `harness board` names `<base>` and shows exactly one of three states:

- **contained** — the ticket branch tip is an ancestor of the `<base>` tip;
- **not contained**, with how many commits are reachable from the ticket branch and not from `<base>`;
- **indeterminate**, with a reason from a closed set.

`<base>` is read from configuration and printed literally, never assumed: a project configured with `base_branch: master` displays `master` and queries `master`, and the string `main` appears nowhere it has not been read from a file.

A ticket with no `branch` value, or whose `branch` does not resolve to a commit, renders **exactly as it does today** — unannotated, and not called indeterminate. There is **no stage filter**: the source scope's `green`/`reviewed`/`qa-passed`/`deployed` set is a strict subset of "every resolvable branch", so this satisfies AC-14 while also covering Q-0011, which sits at `red` and is merged. See OQ-1.

The state is recomputed from git on each invocation and nothing is persisted: after `harness board`, every `ticket.md` is byte-identical, no file is created or modified under `backlog/`, `harness/` or `.quorum/`, no cache is written, and no ref moves. No frontmatter field records containment, now or ever.

**AC-2 — The state is selected from git's own exit codes and from nothing else.**
The mapping is fixed here because the difference between two of these exit codes is the whole ticket:

- The project directory is not a git work tree → **no row is annotated**, the board renders as it does today, exit 0.
- `<base>` fails `git rev-parse --verify --quiet refs/heads/<base>^{commit}` → every otherwise-annotated row is **indeterminate (missing ref)** and no ancestry check runs.
- `git merge-base --is-ancestor <branch> <base>` exits **0** → contained; exits **1** → not contained; **any other exit** → **indeterminate (git failed)**. Exit 1 is never inferred from a failure, a timeout or an absent binary.
- The repository is shallow (`git rev-parse --is-shallow-repository` reports `true`) → an exit **1** becomes **indeterminate (shallow clone)** and no ahead count is shown; an exit **0** still reports contained, because ancestry found in the history that is present is real, while history that is absent cannot disprove it.
- The ahead count is computed only for a proven not-contained result, and is exactly `git rev-list --count <base>..<branch>` — commits reachable from the ticket branch and not from `<base>`. It is not a symmetric difference (`...`), not a total commit count, and not a file count. If that command fails, the row becomes indeterminate (git failed).

**AC-3 — The answer comes from two local refs, through argv, and from nothing else.**
No state is ever inferred from a ticket's stage, its branch name, its `history`, identical file trees, the working tree, or a remote — two refs with the same tree and no ancestry relationship are *not contained*. The board performs no `fetch`, `pull`, `ls-remote` or any other subcommand that contacts a remote, does not deepen a shallow clone, and behaves identically offline. Every git invocation passes an argv array to `execFileSync`, never a shell string, and treats `t.meta.branch` as untrusted input disambiguated as `refs/heads/<branch>`: a ticket whose `branch` is `--upload-pack=touch pwned` renders unannotated or indeterminate, creates no file named `pwned`, and exits 0. The containment helper lives in `spike/src/git.js` beside the existing argv rule, not inline in `spike/bin/harness.js`, so `materialiseDiff`'s duplicate closure has one place to move in M2's port.

**AC-4 — The rendered wording is fixed here, not left to the implementer.**
The annotation is appended to the existing dim segment of each ticket line, after `iter=…`, as one token:

- `main:contained`
- `main:not-contained(+12)`
- `main:indeterminate(missing ref)` · `main:indeterminate(shallow clone)` · `main:indeterminate(git failed)`

`main` is the configured `<base>`, printed literally. The reason set is closed to those three strings; a new reason requires a new criterion. When at least one row reads `indeterminate`, one dim legend line is printed after the board — following the precedent of the existing cost legend at `spike/bin/harness.js:436–440` — stating that git could not answer, **not** that the code is missing; when no row is indeterminate, no such line appears. The same tokens are used in the tests (AC-7) and in the documentation (AC-8). This is settled at the requirements gate on purpose: the chore flow has no solutioning step, so anything left open here is chosen by the implementer and then frozen by a test.

**AC-5 — Nothing that reads the board today breaks, and no git failure reaches the user as a crash.**
The annotation is added beside the existing per-ticket fields, never substituted for one: `owner=`, `cost=$`, `iter=`, the stage headings, the `→ harness run <flow> <id>` hints and the token-only cost legend are unchanged in content and order, and `spike/test/q0033-surface.js` and `spike/test/smoke.js` pass unmodified. `harness board` exits **0** and prints no stack trace and no raw git stderr in each of: a repository with no `harness/*` branches; a backlog where no ticket carries a `branch`; a backlog with no tickets; a directory that is not a git repository; a shallow clone; and a repository whose `<base>` ref is missing. Containment is information, never a failure condition: it gates nothing, lints nothing and changes no exit code. Existing failures to load or parse `harness.yaml` or a ticket keep their current behaviour and are not suppressed. See OQ-2.

**AC-6 — The board's cost is bounded and shared.**
Whether the project is a git work tree, whether it is shallow, and whether `<base>` resolves are each determined **once per invocation**, not once per ticket. No annotated ticket costs more than two git invocations, so a board of *n* tickets issues at most `2n + 3`. Checkable by counting spawns in a test or by inspection; the point is that the render path cannot grow super-linearly as the backlog does, and that a shallow-clone probe is not paid eleven times.

**AC-7 — Tests prove every outcome on purpose-built fixtures, never on this repository.**
A new `spike/test/q0036-*.js`, discovered automatically by `spike/test/run.js`, covers seven cases, building temporary git repositories with the existing `initFixture`/`projectFixture` helpers from `spike/test/q0033-surface.js:47`:

1. a contained ticket branch;
2. a **diverged** branch — commits on both sides — asserting the count is `<base>..<branch>` and not the symmetric difference, so an implementation measuring total distance fails;
3. a ticket branch that does not resolve, asserting the row is unchanged and unannotated;
4. a missing `<base>` ref, asserting `indeterminate(missing ref)`;
5. a shallow clone whose relevant ancestry is absent, asserting `indeterminate(shallow clone)` with no ahead count — produced with `git clone --depth 1 file://…`, since `--depth` is silently ignored for a plain local path;
6. a project directory that is not a git repository (`initFixture({ gitRepo: false })`), asserting today's output and exit 0;
7. a project whose base branch is `master` (`initFixture({ branch: 'master' })`), asserting the annotation names `master` and that `main` appears nowhere in it.

**No test asserts the containment state of any branch in this repository.** As of 2026-08-24 all five resolvable ticket branches are contained in `main`, so such an assertion would be red only until the next landing and green forever after. The mock-adapter regression suite stays green.

**AC-8 — The docs say what `green` means, and where containment is visible.**
`docs/02-sdlc-pipeline-spec.md` §3.4 and the **Stage** entry in `docs/GLOSSARY.md` both state: a stage is the ticket's position in the SDLC state machine; `green` means the ticket's integration branch integrated and passed its configured suite; no stage — `green` or any later one — implies the branch is contained in `<base>`; and `harness board` is where the git-derived containment result appears, in AC-4's wording. The state sequence, its arrows and its loop bounds are unchanged, and no stage is added, renamed, reordered or given a new transition. §3.4's parseability is preserved — prose is added around the fenced diagram, whose lines and column positions are untouched, and `spike/test/q0033-surface.js` S13.1 passes unmodified. The status line of `docs/02-sdlc-pipeline-spec.md` is bumped with the date and what changed, per the docs rule.

**AC-9 — The decision, the vocabulary and the plan are on the record.**
`docs/DECISIONS.md` gains an append-only entry in the required shape — title with date, **Decision**, **Alternatives considered**, **Why** — recording that containment is derived from git on each board invocation and never stored. Its alternatives are a `landed:` field in `ticket.md` frontmatter, a stage after `deployed`, and computing it once into a cache under `.quorum/`; each is rejected with its reason (a copy of a git fact in mutable state drifts, and a wrong field is believed; a stage would make merging a flow-advanced transition when merging is a human act outside every flow, and `deployed` belongs to Q-0012; a cache is the same drift with an extra file). The entry also records AC-2's exit-code mapping and AC-2's shallow asymmetry — a positive survives truncated history, a negative does not — as the product's rule for reading git ancestry, so nobody re-derives or "simplifies" it later. `docs/GLOSSARY.md` defines **Containment** — the git-derived relationship between a ticket branch tip and the configured base branch, with its three states — before the term's second use, introducing no synonym for it (not "merged", "landed", "shipped" or "in main") and no synonym for **stage**, **ticket**, **flow** or **base branch**. `docs/06-development-plan.md` lists Q-0034, Q-0035 and Q-0036 as M2 work with one line each, without rewriting the historical M1 record or its carried-forward items, and its status line is bumped.

### Coverage

| Source criterion | Covered by |
| --- | --- |
| AC-14 — the board says where the code is | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| AC-15 — the docs say what `green` means | AC-8 |
| AC-16 — the decision is on the record | AC-9 |
| AC-17 — the plan and the vocabulary keep up | AC-9 |

## Non-goals

- **A `landed:`, `contained:`, `ahead:` or last-checked field, or any new frontmatter.** AC-1 derives the answer precisely so no field can drift.
- **Adding, removing, renaming or reordering a stage**, including a stage after `deployed`, and changing what `red`, `green`, `reviewed`, `qa-passed` or `deployed` mean.
- **Deciding *how* code arrived** — merged, rebased, cherry-picked or re-derived. Containment is an ancestry fact about two refs, not a historical narrative, and the 2026-08-24 erratum is on the record about the cost of confusing the two.
- **Proving equivalent file content exists on `<base>`** when the tip is not an ancestor. Identical trees without ancestry are not contained, and the board says so.
- **A history of containment** — when a branch landed, who landed it, or an alert when it changes. The board reports the present state each time it is run.
- **Correcting Q-0011's stage.** It reads `red` while merged, after a review backward edge regressed it. That belongs to the remainder of that review (Q-0037); this ticket only stops the board from being silent about it.
- **Any command that merges, rebases, lands, deletes, prunes or fetches a branch,** any merge queue or `land` command, and any change to the rule that a flow never writes to the working tree or to `<base>`. Merging stays a human act.
- **Deepening a shallow clone,** fetching missing history, or reporting anything about a branch that exists only on a remote or a remote-tracking ref.
- **A `--base` flag.** The board reads `repo.base_branch`. The flag is M1's carried-forward item for `harness run` and belongs to its own ticket.
- **Inferring that `blocked` or `abandoned` was reached from `green`.** The current stage does not preserve that provenance and the board does not guess it.
- **A machine-readable board contract.** No `--json` for `board`, no new flag, no stable column format anything may parse. AC-5 preserves what is already pinned; it does not promise more.
- **Any Studio or web work.** AC-1 is the CLI board. M3 owns the web surface and will read the same derivation.
- **Re-scoping, implementing or depending on Q-0034 or Q-0035.** This ticket is independent of both and touches neither `materialiseDiff` nor the landing.
- **Tidying the abandoned, contaminated and per-task branches** under `harness/*`. They are audit trail; the board says nothing about them beyond what AC-1 says about any resolvable branch.
- **Fixing the known understatement in `ticket.md`'s `history` roll-up,** which the board's `cost=` field inherits. Unchanged by this work.
- **Improving board performance beyond AC-6**, and **adding a dependency**. Git is already a hard requirement and `execFileSync` is already imported.

## Open questions

None blocks implementation. Three questions were raised by the candidates or by the repository check; each is a one-line change if the gate disagrees.

**OQ-1 — Should containment be reported only from `green` onward?** *Owner: `maintainer`. Answered: no filter. Reverse by re-adding a stage list to AC-1 **and** flipping AC-1's unresolvable-ref clause to indeterminate.*
The inherited scope is "green or later". The repository argues against it: Q-0011 is at `red` today and fully contained, so the filter hides the exact ticket this work exists for. Dropping it also removes code — no stage list to keep in step with `STAGES`, and no `blocked`/`abandoned` special case, which Codex correctly flagged as a hazard since both are enterable from any stage.

The honest cost, which neither candidate saw: **Q-0034 sits at `draft` and its branch resolves**, so today the board would annotate one draft row. That is true and unremarkable rather than wrong, and the stage heading above it supplies the context.

The important part is that this and the missing-ref policy are **one decision, not two**. Only two combinations are coherent: *filter + annotate unresolvable refs as indeterminate* (Codex's package), or *no filter + leave unresolvable refs alone* (this document). The cross terms fail — no filter with indeterminate puts that word on six of eleven rows today, which is how an honest signal becomes unreadable; a filter with silence on unresolvable refs is the ambiguity we are removing, applied to precisely the tickets we care most about. Anyone reversing this must reverse both halves.

**OQ-2 — Should an unexpected git failure change the exit code?** *Owner: `maintainer`. Answered: no.*
AC-5 keeps `harness board` at exit 0 and renders indeterminate with a reason. The board is the first thing an adopter runs, and a fresh or shallow clone legitimately cannot answer; a non-zero exit would make the ordinary case look like a broken tool and would break any script running the board as an overview. The engineering rule that errors are explicit is satisfied by naming the reason on the row, not by failing the command.

**OQ-3 — Should `docs/06-development-plan.md` also gain a line for Q-0037?** *Owner: `maintainer`. Recommendation: yes, one line. Not blocking; AC-9 does not require it.*
`backlog/Q-0037-run-history-review-remainder/` exists and belongs to M2 for the same reason the other three do. One line now avoids a second pass over the same document; leaving it out is defensible, since it is nothing to do with this ticket's subject.

## Risks

- **Conflating "not an ancestor" with "could not answer" reintroduces the defect in a new place.** Exit 1 and exit 128 differ by one character in a careless check, and the wrong one produces a confident falsehood — strictly worse than the silence we have today. AC-2 pins the mapping; AC-7 tests both branches of it.
- **A shallow clone does not fail — it answers from truncated history.** There is no error to catch, so the implementation must ask `git rev-parse --is-shallow-repository` rather than wait to be told. A fixture with merely few commits proves nothing; AC-7 requires a genuine `--depth 1` clone over `file://`, because `--depth` is silently ignored for a local path and a test that omits the URL scheme would pass while testing nothing.
- **The demonstration case no longer exists anywhere in this repository.** All five resolvable ticket branches are contained since Q-0034 landed, so neither the implementer nor the cross-vendor reviewer can watch the feature find real unlanded work here, and the pull toward asserting against real branches will be strong. AC-7 forbids it by name.
- **A green ticket whose branch was deleted after merging goes silent.** That is the deliberate consequence of AC-1's unresolvable-ref clause and of dropping the stage filter, and deleting merged branches is a common habit. If it becomes this project's habit, the fix is to adopt the *other* coherent package from OQ-1 in full, not to patch one half of this one.
- **This is the first git call on the render path of the command people run most often.** A crash, a hang or a raw `fatal:` from `board` is worse than the ambiguity it replaces. AC-2's catch-all, AC-5's exit-0 guarantee and AC-7's non-repository fixture are the mitigation, and the last of these is what makes the degradation path proven rather than assumed.
- **The board is the adopter's first read.** A column reading *indeterminate* on every row in a shallow CI checkout looks like a broken tool. Short, closed, actionable reasons plus the conditional legend are what make it read as honesty instead — which is why AC-4 fixes the strings rather than leaving them to be invented.
- **§3.4 and the board line are both already under test, in non-obvious ways.** S13.1 asserts on *column positions* inside §3.4's ASCII diagram, so reflowing it breaks a suite that has nothing to do with this ticket; S11.1–S11.4 pin `iter=` and `cost=$` on the ticket line, so appending is safe and reformatting is not. AC-5 and AC-8 name both.
- **A branch name from `ticket.md` reaches a command line.** The file is agent-written. `spike/src/git.js:6–8` already solved this with argv-only `execFileSync`; the new path reuses that discipline rather than rediscovering it, and AC-3 gives it a test.
- **This is machinery work on the board the flows' own operators read.** The 2026-08-23 decision says not to drive that through the full SDLC, and the chore routing is the answer — but it also means there is no qa-red safety net, so AC-7's coverage is the only thing between a plausible implementation and a wrong one.
- **"Contained" could sprout synonyms.** Three already exist in this repository's prose — landed, merged, shipped. One glossary entry, added before the second use, is the whole mitigation.
- **`docs/DECISIONS.md` is append-only and Q-0035 also appends to it.** If both land in the same window the conflict is mechanical, at the end of the file — but Q-0034's landing already showed what a careless resolution costs there. Land one at a time.

## Cross-cutting checklist

- **BYOS** — n/a in that no auth path is touched, and load-bearing in that nothing here may add one. `harness board` invokes no adapter, makes no vendor request and reads no environment variable naming a key; `check()`'s refusals are untouched. No key appears in code, test, fixture or documentation.
- **Worktree safety** — the board is strictly read-only: it runs no flow, spawns only read-only git commands, creates no worktree, moves, creates or deletes no ref, fetches nothing, and writes nothing to the working tree or to `<base>`. AC-1 asserts `ticket.md` is byte-identical afterwards.
- **Gate behaviour** — unchanged. No gate is added, none becomes `auto`, no `human-locked` gate is touched, and containment gates nothing. The chore flow's own human gate is unchanged.
- **File format and schema** — no persistent field, no schema, no migration. Containment exists only in rendered output.
- **Lint and cross-vendor rule** — no flow or role file changes; `lintFlowDirectory` and the cross-vendor rule are untouched. The chore flow keeps `cross_vendor: required`, satisfied by the routing as shipped.
- **Dependencies** — none. If one becomes necessary it carries a one-line justification in the implementation report and a DECISIONS entry if it changes architecture.
- **Product-agnostic** — the output names only refs and the configured base branch, both read from files. No SaaS product is referenced.
- **Cold-clone impact** — net positive and bounded: no new command, no new flag, no added step before a first run, at most `2n + 3` local git calls and no network. The adopter gains one field in output they already read and one sentence in the docs answering a question the board previously left open. The worst case in a shallow clone is one honest *indeterminate* per row plus a legend line.

## Provenance

**Claude's candidate is the spine.** It is the only one of the two that went and looked, and its correction table is why this document can state the branch state, the pinned tests, the non-repository path and the base branch as verified facts rather than as things an implementer will discover. Its exit-code discipline and its shallow-clone asymmetry — a positive survives truncated history, a negative does not — are the difference between an honest board and the confident falsehood this ticket exists to prevent, and they are merged whole into AC-2. Its bounded-cost criterion (AC-6), its diverged-branch test case, its untrusted-branch-name risk (AC-3), its conditional-legend proposal (AC-4), and most of its non-goals and cross-cutting checklist survive intact.

**Codex's candidate supplied the framing and two things Claude left loose.** Its problem statement is sharper on *why* a stage cannot answer this — a stage is a position in a state machine, containment is a fact about two refs at render time — and that formulation is what AC-8 asks the docs to adopt. Its AC-4 is the only place either candidate pins the count as `<base>..<branch>` and names the two wrong answers (symmetric difference, file count); that is now in AC-2, and AC-7's diverged-branch fixture exists to make an implementation choosing wrongly fail. Its "raw git stderr is not printed" clause is in AC-5, its configured-base-name criterion is in AC-1 and tested in AC-7, and its provenance non-goals — no inference about merge, rebase or cherry-pick; no deepening; no remote-only branches; no `blocked`/`abandoned` provenance guessing — are merged in.

**What I struck.** Codex's criteria are compound: its AC-1 alone bundles eligibility, the exclusion of ineligible tickets from git work, and an exit-code claim, so it cannot fail cleanly and a reviewer cannot say which part is wrong; its AC-16 bundles seven unrelated cross-cutting guarantees plus an escape hatch that returns the ticket to product review mid-implementation, which is a process instruction wearing a criterion's clothes — its checkable parts are in the checklist. Its "Open questions: None" is overconfident for a document that never ran a command against the repository and asserts as current a branch state Q-0034 had already changed. From Claude I struck the PATH-shim test in its AC-5 — asserting on recorded argv through a stub named `git` earlier on `PATH` is a fragile way to test a negative, and AC-3's plain prohibition plus the offline behaviour it implies is what a reviewer can actually check — and its AC-9 grep-for-synonyms test, which cannot distinguish a banned synonym from the word "merged" used correctly in surrounding prose. Its five open questions are down to three: two were answerable from the repository, and one of those — how a shallow clone is distinguished from a proven negative — was never a wording question at all but the central correctness question of the ticket, so it is AC-2 rather than an OQ.

**The one place the candidates contradict each other, and what settles it.** Claude's AC-3 makes a missing *ticket* ref indeterminate while its own AC-1 scopes the feature to tickets whose branch "names an existing ref"; Codex reads the source correctly — AC-14 gates on "whose `branch` value resolves to an existing git ref" and says "a ticket with no resolvable ref renders as it does today" — but then couples that reading to the green-or-later filter. I checked which combination the repository supports and found that this is a single decision with two coherent settings, set out in OQ-1: six of eleven ticket branches do not resolve, all at `draft`, so annotating them as indeterminate without a filter would put that word on more than half the board. I took no-filter-plus-silence, because it covers Q-0011 — at `red` and merged, the ticket this whole investigation was about — and because it is less code than the alternative, and I recorded the cost I found that neither candidate knew: Q-0034 is at `draft` with a resolving branch, so "no filter" is not free of noise, merely far cheaper than the alternative.

**What I decided that neither candidate would.** Three things, all because the chore flow has no solutioning step and no architect stands between this document and the code — whatever the gate leaves open, the implementer chooses and a test then freezes. The rendered strings are pinned (AC-4) rather than deferred to a cosmetic open question. The exit code stays 0 on any git failure, with the reason on the row (AC-5, OQ-2). And the stage filter is dropped in favour of "every ticket whose branch resolves" (AC-1, OQ-1), with the reversal path stated as a pair so nobody flips one half of it.

**On size.** Nine criteria on one CLI surface plus documentation: no contract, no schema, no new dependency, no flow or role change. That is inside the ten-criterion target and makes this the smallest of the three tickets Q-0034 split into — which is the argument for running it rather than dropping it when the landing runs long, since it is the only one of the three that stops the incident recurring.
