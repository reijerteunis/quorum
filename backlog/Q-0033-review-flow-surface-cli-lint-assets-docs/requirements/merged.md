# Q-0033 — Review flow surface: CLI, lint, config, shipped assets and docs

*Merged requirement (head-of-product). Ticket Q-0033, stage draft → requirements. Milestone M1. Depends on Q-0006, merged to `main` at `5d16e06`.*

*Scope note: this is the surface half of a split, not a new design. Q-0006's `requirements/merged.md`, `solution/solution.md` and the seven frozen contracts under `contracts/Q-0006/` are consumed unchanged; `solution/errata.md` E-1 (retry semantics) and E-2 (the split) govern where a contract and later evidence disagree. Every claim below was re-checked against the code on `main`.*

## Problem

Q-0006 built the engine that runs a review — round numbering, diff materialisation, the derived cross-flow regression, counters, retry and exhaustion, rework sync, audit and failure containment. None of it is reachable. `harness/flows/` ships four flows and `review.yaml` is not one of them; `harness/roles/` ships nine roles and `code-reviewer` is not one of them. The review machinery is dead code until a flow file calls it.

Three consequences, all present on `main` today:

- **The ticket that built it cannot use it.** Q-0006 sits at stage `green`. The only flow that consumes `green` is `review`, which does not exist. A ticket the SDLC declares ready for review has nowhere to go.
- **Lint cannot see the loop the engine now supports.** `lintFlow` skips any `goto` beginning with `flow:` (`spike/src/engine.js:30`), accepts `max_iterations: 0` because `Number.isInteger(0)` is true (`:31`), never validates `counter` at all, and has no rule about a single-vendor panel. `harness lint` loads each file in isolation (`spike/bin/harness.js:117-125`), so a cross-flow target naming a missing flow is discovered at the moment the run would have regressed — after the panel has been paid for.
- **A gate can still answer itself.** `spike/bin/harness.js:71` maps an empty answer to `advance`. A human gate that advances when nobody is there is the one thing this product may not do.

This ticket writes no engine behaviour. Where a criterion below is enforced in `spike/src/**`, Q-0006 already enforces it and this ticket ships the file that reaches it, or the lint that guards it, or the test that proves it from the outside.

## User stories

**Maintainer.** As a solo maintainer with Claude and Codex subscriptions, `harness run review Q-0006` is a command that exists, over a flow file I can read and a role file I can edit. When I break the flow — a bound of zero, a counter spelled `iterations.review`, a panel that quietly runs both reviewers on one vendor — `harness lint` tells me before a run starts, not after two reviewers have billed me.

**Adopter.** As a stranger trying Quorum on my own repo, the review stage costs me no new setup: no subscription beyond the two CLIs I already have, no file I must author. `harness init` writes my repository's actual base branch into `harness/harness.yaml`, so a `master` repo works without my knowing the key exists.

**Contributor.** As someone adapting the shipped templates, `review.yaml` and `code-reviewer.md` are readable examples of a bounded cross-flow loop. When I point a backward edge at a flow whose chain never leads home, lint names both flows and the stage where the chain dies. When I run with `--adapter mock`, the override does not turn my legitimately cross-vendor flow into a lint failure.

## Acceptance criteria

Surfaces touched: **`harness/`** (one flow, one role, one config key), **CLI** (`init`, `lint`, `run` preflight, `--gate-answer`, `board`), **docs**. No engine behaviour, no UI. Thirteen criteria — inside the fifteen the ticket-size decision of 2026-08-22 allows, which is the reason this ticket exists.

### Shipped assets

1. **`review.yaml` ships in both places and matches the frozen contract.** `harness/flows/review.yaml` exists. Parsed with `YAML.parse` and stripped of the loader-only `file` key, it deep-equals `contracts/Q-0006/review-flow.contract.yaml` parsed the same way — `consumes: green`, `produces: reviewed`, `cross_vendor: required`, the two-step `code-reviewer` panel on `claude` and `codex` writing `review/round-{round}/{vendor}.md` from the merged requirement, solution and `{base}...harness/{id}/integration` diff; the verdict step reading both named panel artifacts plus requirement and solution, writing `review/round-{round}/verdict.md` and `review/verdict.md`, carrying the threshold instructions, `goto: flow:development`, `counter: review`, `max_iterations: 3`, `on_exhausted: gate`; and the closing `gate: human`. `harness lint` reports it ✓. A new test asserts `harness/flows/` and `spike/templates/harness/flows/` are file-for-file identical — the directories match today for four flows and no test says so.

2. **`code-reviewer.md` ships in both places, byte-identical, and satisfies its contract.** `diff harness/roles/code-reviewer.md spike/templates/harness/roles/code-reviewer.md` prints nothing. The two roles *directories* are deliberately not compared: `developer-backend.md` differs between repo and template by design and `developer-tooling.md` is repo-local (docs/06), so a directory rule would be false. Frontmatter contains neither `adapter` nor `model`, so each step controls its own vendor and no vendor receives another's model alias; the existing assertion that no shipped template pins a codex model (`spike/test/smoke.js:175`) stays green. The body states the persona of `contracts/Q-0006/code-reviewer-role.contract.md`: reads the supplied requirement, solution and diff; never edits or rewrites code; classifies every finding as exactly `blocker`, `major` or `nit`; cites every finding as `file:line`. The severity *threshold* wording stays in the verdict step's `instructions`, not in the role.

3. **The flow uses only fields the engine has.** No `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true }` or `tasks: true`, no `on_fail.with:`. Testable end to end: under `--adapter mock`, `review.yaml` runs `green → regressed` and `green → reviewed` with no change to `spike/src/**`.

### Configuration and `init`

4. **Both config files declare the review keys.** `harness/harness.yaml` and `spike/templates/harness/harness.yaml` carry `repo: { base_branch: <name>, max_diff_bytes: 200000 }`, each with a one-line comment saying what it does. `base_branch` is already present in both (added by Q-0004's integrate work); `max_diff_bytes` is added. A config omitting either key stays valid and resolves to `main` and `200000`, so no existing project file becomes invalid.

5. **`harness init` discovers the base branch safely.** Run inside a repository on branch `master`, `init` writes `base_branch: master` and `max_diff_bytes: 200000`. Run outside a repository, or on an unborn or detached head git cannot name, it leaves `main`, exits 0 and prints no git error. It changes no other key, and a git failure never fails `init`. An automated test covers a repository whose current branch is not `main`.

### Lint

6. **Cross-flow targets resolve, and the chain must come home.** Every `goto: flow:<target>` names a loadable `<target>.yaml`. Starting at the target's `produces`, lint follows flows by matching `consumes` until the source flow's `consumes` is reached, keeping a visited set of `(flow, stage)` pairs so the walk terminates. Missing target, unloadable target, dead end, ambiguity on a stage the walk actually reaches, and a repeated pair each fail with a message naming source flow, target flow, the stage where the chain dies, and — for ambiguity and cycles — the implicated flows. A stage with two consumers the walk never reaches does not fail. `review → development` and `review → qa-red` are positive fixtures; missing target, dead end, reached-stage ambiguity, cycle and the self-target `review → review` (which dies at stage `reviewed`) are built in temporary harness directories as named negative fixtures. No fixture mutates a shipped flow file.

7. **Bounds and counter spelling are checked.** `max_iterations` must be an integer greater than zero: missing, non-integer, fractional, `0` and negative each fail, naming the step and the field. (`0` passes today.) `counter` must be a non-empty key without an `iterations.` prefix; `counter: iterations.review` fails with a message giving the corrected spelling `review`, because the prefixed form would create a literal `"iterations.review"` key nested inside `iterations`.

8. **A single-vendor panel fails lint.** In a flow with `cross_vendor: required`, a parallel group containing two or more steps that share a role must span at least two adapters; the message names every member id and the shared adapter. The shipped `review.yaml` passes this rule and the existing verdict-input rule together — the verdict step's two named inputs are written by two different adapters, which the cross-vendor refinement of 2026-08-21 permits for a judge.

9. **`harness run` performs the same validation first, from disk.** Before its first `adapter.run` and before any write to the ticket folder, `run` executes the complete flow-directory validation of criteria 6–8 and reports the identical error, exiting non-zero. It loads pristine flow files from disk **before** any `--adapter` override is applied in memory. `harness lint` reports every offending flow in one pass and exits non-zero once. Three assertions: with a sibling flow that has an unresolvable target, `harness run review <id> --adapter mock` exits non-zero, makes zero adapter calls and adds no line to the ticket's `runs.log`; on a valid harness, `harness run review <id> --adapter mock` does *not* fail the single-vendor panel rule, which the override would otherwise trigger on every mock run; and the same invalid fixture produces the same diagnostic through `lint` and through `run`.

### Gate answers

10. **A gate answer is never defaulted, and never silently invented.** `--gate-answer advance|retry|abort` is repeatable and consumed once each in encounter order, so an exhaustion `advance` followed by a closing-gate `abort` is expressible as two flags; a test demonstrates two gates in one run receiving different answers. When the explicit answers run out the CLI may read a TTY. On non-TTY stdin, or when the answer is missing, empty or not one of the three words, the process exits non-zero with an error naming the gate; it neither blocks nor defaults to `advance`. `--auto` does not answer an exhaustion gate: with `--auto` and no `--gate-answer`, an exhausted loop exits non-zero naming the gate rather than walking through it. (The engine already declines to auto-advance it — `handleFail` presents it as kind `human-locked` at `spike/src/engine.js:252` — so this criterion is the CLI half and the test that proves the property from outside.)

### Regression suite and evidence

11. **The existing suite stays green, with its assumption made explicit.** `npm test --prefix spike` passes, including `draft → green`, the API-key refusals and the no-pinned-codex-model assertion. The exhausted-loop assertion at `spike/test/smoke.js:82-85` supplies an explicit `--gate-answer` instead of relying on the empty-line default this ticket removes — it passes `--auto` today and only survives because an empty line means `advance`. New deterministic coverage is added for every lint failure in criteria 6–8, init discovery and fallback, ordered explicit gate answers, the missing non-interactive answer, `--auto` exhaustion protection, and the asset parity of criteria 1 and 2. `harness board` needs no production change: its regression test asserts that a persisted `iterations.review` appears in the existing `iter={…}` output and that a run's cost is counted once across an exhaustion event (`cost: 0`) plus its terminal event. A guard asserts `git diff --quiet 5d16e06 -- contracts/Q-0006/` — the frozen contracts are consumed, never edited. No new dependency.

12. **Real-CLI evidence is on the record.** At this ticket's closing gate the maintainer runs the first real `harness run review <id>` on real Claude Code and Codex CLI and saves the evidence in this ticket's folder: that both reviewers received the harness-materialised diff under plan / read-only sandbox, and that the severity threshold behaved as instructed. This is a manual acceptance action — it spends subscriptions, so no automated test asserts it and it never runs inside development fan-out.

### Documentation

13. **The docs agree with the shipped flow in the same change.** `docs/02-sdlc-pipeline-spec.md`: §3.4's state diagram draws the review rejection to the derived stage rather than back to `green`; §5.5 is rewritten as the flow actually ships — three-dot `{base}...harness/{id}/integration` in the right direction, `{round}` not `{iter}`, unprefixed `counter: review`, no `type: judge`, no `findings:`/`tasks:`/`with:`, and no pinned model names (it currently shows `model: opus` and `model: gpt-5`, the exact alias the 2026-08-22 decision bans); the configured base branch, the diff-size limit and the exhaustion behaviour are described. §10 question 1 (full development versus a lighter `fix` flow) is answered *no lighter flow for M1*. `docs/06-development-plan.md`: M1's review line reflects the split across Q-0006 and Q-0033 and its done-when includes the shipped review surface. `docs/DECISIONS.md`: one entry for the derived regression target, one for the exhaustion gate that `--auto` cannot bypass — both are behaviour on `main` today with no entry naming them. `docs/GLOSSARY.md`: **Gate** gains a sentence distinguishing an author-declared `human-locked` gate (deploy's) from the exhaustion gate the engine presents under the same kind; **Role** is unchanged and covers `code-reviewer`. No new synonym for an existing term.

## Non-goals

- **Anything Q-0006 owns.** Round numbering, diff materialisation and truncation, derived regression, counter increment, retry and exhaustion semantics, atomic panel failure, invalid-output containment, rework worktree sync, history and cost events, `development.yaml`'s verdict input (already shipped and byte-identical to its template), and `spike/src/adapters/**`. This ticket ships the files and the lint that reach them; it does not re-specify, re-implement, or re-cut a contract under `contracts/Q-0006/`.
- **Re-opening settled questions.** The derived regression target, `{round}` from the filesystem, `retry` setting the counter to `max_iterations` (errata E-1), the severity threshold, the read-only panel and the no-payload rework are decided in Q-0006's merged requirement and are inputs here.
- **The README command path.** README today is an eleven-line status stub with no commands in it, so "adds `harness run review <id>` to the normal path" is not testable against it — there is no path. The README rewrite is Q-0028 in M6 and writes the whole first-run sequence at once. What this ticket owes the cold-clone test is the *absence* of a setup step, which criteria 4 and 5 carry: `init` writes the key and the adopter authors nothing.
- **A lighter `fix.yaml`**, scoped rework, a review-generated `tasks.yaml`, or a cross-flow payload mechanism.
- **Auto-starting the target flow after a regression.**
- **Budget enforcement.** `harness.yaml` carries `budget:` and nothing reads it; that lands before M3.
- **Tracing the producing vendor of an integrated diff in lint** — not statically knowable, so the rule could only pass vacuously.
- **A `--json` or machine-readable lint report**, and any CI mode.
- **Naming gates in `--gate-answer`** (e.g. `verdict=retry`); encounter order is the contract.
- **Line-level review comments, pull-request creation, or any remote service.**
- **`qa-final.yaml`, `deploy.yaml`, a `rework` stage, a third reviewer, the Gemini adapter, any UI.**
- **Renaming `.harness/worktrees/` to `.quorum/worktrees/`** — real drift between the spike and the rules, and not this ticket's.
- **A single-vendor fallback when only one CLI is logged in.** The panel fails with the existing translated auth message.
- **Rewriting existing ticket history or migrating legacy entries.**

## Open questions

None blocks solutioning. Each has a default already written into the criteria.

| # | Question | Owner | Default in the criteria |
|---|---|---|---|
| 1 | Which ticket carries the first real review run (criterion 12)? Q-0006 sits at `green` and is blocked on this flow existing; Q-0033 would otherwise review the ticket that created the reviewer. | Ruud | Run it on Q-0006 — its diff is real, substantial and already integrated. The evidence file lives in this ticket's folder either way. |
| 2 | Does the exhaustion gate reusing the `human-locked` kind muddy the vocabulary, given the glossary defines `human-locked` as deploy's? | This ticket's docs work | Keep the kind; criterion 13 adds the distinguishing sentence. Renaming the kind is an engine change and belongs to whichever ticket needs it. |
| 3 | Is `max_diff_bytes: 200000` right? | This ticket's implementation | Ship 200 000; tune after criterion 12's real run. |
| 4 | Should `init` prefer the remote HEAD, so an adopter running `init` on a feature branch does not pin it as the base? | Ruud | Ship the current branch as the runtime contract specifies. The value is one commented line in `harness.yaml`, and a wrong ref errors by name before any agent is spawned. |

**Two questions raised by a candidate and closed here rather than carried:**

- *"Does `retry` persist `max_iterations - 1` or `max_iterations`?"* — **Closed: `max_iterations`, persisted `3`.** `contracts/Q-0006/review-runtime.contract.md` says `max_iterations - 1`, and it is wrong; `backlog/Q-0006-…/solution/errata.md` E-1 (2026-08-22) supersedes exactly that clause, the DECISIONS entry "`retry` at an exhaustion gate authorises exactly one more traversal" records the reasoning, and `spike/src/engine.js:270` implements it. The contract file itself is corrected by whichever ticket next opens it legitimately — not this one, which consumes the contracts frozen. This is an erratum, not an ambiguity, and it does not block.
- *"Which commit is the immutable baseline for the frozen contracts?"* — **Closed: `main` at `5d16e06`** ("merge: Q-0006 review-flow runtime into main"). Written into criterion 11 so every task compares against one snapshot.

## Risks

1. **Q-0006 has not itself been reviewed, and cannot be until this lands.** Its engine work merged on evidence from its own red suite. If criterion 12's real run — or Q-0006's eventual review — demands an engine change, this ticket's lint and CLI work rebases onto it. Mitigated by ordering: this ticket depends on Q-0006 and starts from merged `main`.
2. **Removing the empty-answer default surfaces every place that relied on it.** The known one is `spike/test/smoke.js:82-85` (criterion 11). An unknown one appears as a run that exits non-zero where it used to advance — the correct behaviour, arriving as a surprise.
3. **The preflight ordering bug is invisible until it isn't.** If validation ran after the `--adapter mock` override, every mock run would fail the single-vendor panel rule and read as a lint bug rather than an ordering bug. Criterion 9 tests both directions for exactly this reason.
4. **The return-chain walk is written against five flows and must survive seven.** When `qa-final.yaml` and `deploy.yaml` land (Q-0012), stage `reviewed` gains a consumer and new chains become reachable. The visited-set rule and "ambiguity only on a reached stage" are what keep that from failing a correct flow set.
5. **Lint non-termination.** A cross-flow cycle hangs lint unless `(flow, stage)` pairs are tracked; the cycle and self-target fixtures of criterion 6 exist to prove it terminates.
6. **Two copies of every shipped asset, with no rule keeping them in step.** Criteria 1 and 2 make it a test rather than a habit, and scope the comparison so the legitimately-divergent role files do not force a false rule.
7. **`init` pins whatever branch it finds.** Cold-clone friendly when the adopter is on their default branch, quietly wrong when they are not (open question 4).
8. **Documentation drift is already shipped.** §5.5 currently shows a flow the engine cannot run, including a pinned `gpt-5` that no ChatGPT subscription accepts. A contributor copying it today gets a file that fails lint. Criterion 13 is not cosmetic.
9. **Cold-clone cost.** This ticket adds no setup step, but the stage it unlocks costs two reviewers and a judge, on a first-run budget the M0 measurements already show cannot hold seven stages in thirty minutes. Not this ticket's decision to take; worth not making worse.

## Cross-cutting checklist

- **BYOS.** No new auth path, no key on any code path including `init`, fixtures, tests and examples. The panel uses the existing `claude` and `codex` adapters and their `check()` guards; `harness adapters --probe` remains the way to learn a login is dead before paying for a round. The existing environment-refusal assertions stay green.
- **Worktree safety.** This ticket adds no writing step. The reviewers declare no `worktree`, so they run with `allowWrite: false`, create no branch, and touch nothing outside `backlog/<ticket>/review/`. `init` writes only into the target directory. A lint failure writes nothing at all.
- **Gates.** One `gate: human` at the end of the flow, flippable to `auto` by the user; the exhaustion gate stays unbypassable by `--auto` (criterion 10). No `human-locked` gate is authored — that stays deploy's.
- **Files are the database.** New shipped files (`review.yaml`, `code-reviewer.md`, and their template copies), one new config key (`repo.max_diff_bytes`). All additive; no existing ticket, flow or config file becomes invalid. No persistent state outside `harness/`, `backlog/` and `.quorum/`.
- **Lint rules.** Three added — cross-flow target and return chain, bound and counter spelling, single-vendor panel — all shared with `harness run`'s preflight.
- **Errors are explicit.** Lint before any spawn or ticket write (criterion 9); a missing base ref names the key and the file (Q-0006, reached here by criterion 4); a gate answer is never defaulted (criterion 10).
- **Product-agnostic.** The flow, the role text, the fixtures and the diagnostics speak only about diffs, contracts and requirements. No product name appears; the only vendor names are the two adapters the cross-vendor panel needs.

## Provenance

**Claude's candidate is the spine.** It is the scope-disciplined document — thirteen criteria against Codex's thirty-one for identical scope — and it is the one that re-checked the design against `main` rather than against the contracts alone. Four of its findings are load-bearing and all four verify: `repo.base_branch` already ships in both configs (so only `max_diff_bytes` and the `init` discovery remain); `harness/flows/development.yaml` already reads `review/verdict.md` and matches its template, so nothing is left here; `diff -rq harness/roles spike/templates/harness/roles` is not empty and must not be, which turns Q-0006's AC-1/AC-2 as written into a rule that would fail on correct files; and `max_iterations: 0` passes lint today while `counter` is unvalidated entirely. Its criteria 1–13 map to the merged 1–13 with the changes below. Its implementation note — that `spike/bin/harness.js:24-27` overwrites a repeated flag, so `--gate-answer` cannot be repeatable without changing the parser — is carried into solutioning.

**Codex contributed precision that is kept.** Its enumerated lint fixtures (missing target, dead end, reached-stage ambiguity, cycle, self-target) are more complete than Claude's single named negative and are merged into criterion 6. Its "zero adapter calls and zero writes on a lint failure" is a sharper assertion than "runs.log gains no line" and is merged into criterion 9. Its demand for a named immutable baseline for the frozen contracts was right, and is merged into criterion 11 as `5d16e06` rather than carried as a question. Its explicit statement that `retry`'s behaviour must have one expected result before tests can be written is the correct instinct applied to an already-settled fact.

**What was rejected, and why.**

- **Codex's blocking open question 1 (retry counter value) is not blocking.** The contradiction is real but already resolved: errata E-1 of 2026-08-22 supersedes the contract clause by name, DECISIONS records the reasoning, and the engine implements `max_iterations`. A ticket cannot be held open on a question its own inputs answer; treating a documented erratum as an unresolved conflict would stall solutioning on a decision already taken. Closed above with citations rather than carried.
- **Codex's thirty-one criteria are one scope at three times the granularity.** Its AC-2/3/4/5/6 are five statements about one flow file that is tested by one deep-equal against a frozen fixture; they collapse to criterion 1 with no loss. Its AC-29/30/31 (BYOS, safety, product scope) assert properties the existing suite already guards and no new code threatens — they belong in the cross-cutting checklist, where they are, not in a count that decides how many review rounds this ticket will survive. Thirty-one criteria is precisely the shape that cost Q-0006 its bound at every stage.
- **Codex's AC-3 and AC-8 are factually wrong in the same way.** Both say an existing template-parity check "remains green". No such check exists: `spike/test/smoke.js:171-175` walks the template tree only to assert that no shipped template pins a codex model. Criteria 1 and 2 therefore require the parity assertions to be *added*.
- **The README criterion in both candidates is struck.** README is an eleven-line status stub containing no command, so neither "includes `harness run review <id>` in the normal path" nor "adds no manual step to it" can be tested — there is nothing to add to or subtract from. It moves to non-goals pointing at Q-0028, which owns the first-run path in M6.

**Size judgement.** Thirteen criteria, inside the fifteen the ticket-size decision allows and close to the ten it prefers. This ticket exists because Q-0006 shipped thirty; the split held, and the confirmatory pass the ticket predicted did come back short. No further seam is proposed.
