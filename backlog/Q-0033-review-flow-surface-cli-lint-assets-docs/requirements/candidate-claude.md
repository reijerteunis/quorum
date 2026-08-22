# Q-0033 — Review flow surface: CLI, lint, config, shipped assets and docs

*Candidate requirement (product-manager, Claude). Ticket Q-0033, stage draft → requirements. Milestone M1. Depends on Q-0006, which is merged to `main` at `5d16e06`.*

*Scope note: this is the second half of a split, not a new design. Q-0006's `requirements/merged.md`, `solution/solution.md` and the seven frozen contracts under `contracts/Q-0006/` are consumed unchanged; `solution/errata.md` E-1 (retry semantics) and E-2 (the split) govern where they contradict. Everything below was re-checked against the code on `main` — the confirmations and the four corrections are listed in §Confirmation.*

## Problem

Q-0006 built the engine that runs a review: round numbering, diff materialisation, the derived cross-flow regression, counters, retry and exhaustion, rework sync, audit and failure containment. None of it is reachable. `harness/flows/` still ships four flows and `review.yaml` is not one of them; `harness/roles/` still ships nine roles and `code-reviewer` is not one of them. The engine's review machinery is dead code until a flow file calls it.

Three consequences, all of them present on `main` today:

- **The ticket that built it cannot use it.** Q-0006 sits at stage `green`. The only flow that consumes `green` is `review`, which does not exist. A ticket the SDLC declares ready for review has nowhere to go.
- **Lint cannot see the loop the engine now supports.** `lintFlow` skips any `goto` beginning with `flow:` (`spike/src/engine.js:30`), accepts `max_iterations: 0` because `Number.isInteger(0)` is true (`:31`), never validates `counter` at all, and has no rule about a single-vendor panel. `harness lint` loads each file on its own (`spike/bin/harness.js:117-125`), so a cross-flow target that names a missing flow is discovered at the moment the run would have regressed — after the panel has been paid for.
- **A gate can still advance itself.** `spike/bin/harness.js:71` maps an empty answer to `advance`. A human gate that answers itself when nobody is there is the one thing this product may not do, and `--auto` reaching an exhaustion gate is only prevented in the engine, not at the surface that has to supply the answer.

This ticket ships everything a human or a flow file touches. It writes no engine behaviour; where a criterion below is enforced in `spike/src/**`, Q-0006 already enforces it and this ticket only ships the file that reaches it or the lint that guards it.

## User stories

**Maintainer.** As a solo maintainer with Claude and Codex subscriptions, `harness run review Q-0006` is a command that exists, on a flow file I can read and a role file I can edit. When I break the flow — a bound of zero, a counter spelled `iterations.review`, a panel that quietly runs both reviewers on one vendor — `harness lint` tells me before a run starts, not after two reviewers have billed me.

**Adopter.** As a stranger trying Quorum on my own repo, the review stage costs me no new setup: no subscription beyond the two CLIs I already have, no file I must author. `harness init` writes my repository's actual base branch into `harness/harness.yaml`, so a `master` repo works without my knowing the key exists — and when the ref is wrong the error names the key and the file rather than failing on a git message.

**Contributor.** As someone adapting the shipped templates, `review.yaml` and `code-reviewer.md` are readable examples of a bounded cross-flow loop. When I point a backward edge at a flow whose chain never leads home, lint names both flows and the stage where the chain dies. When I run with `--adapter mock`, the override does not turn my legitimately cross-vendor flow into a lint failure.

## Acceptance criteria

Surfaces touched: **`harness/`** (one flow, one role, one config key), **CLI** (`init`, `lint`, `run` preflight, `--gate-answer`, `board`), **docs and README**. No engine behaviour, no UI. Thirteen criteria — inside the fifteen the ticket-size decision of 2026-08-22 allows, and the reason this ticket exists.

### Shipped assets

1. **`review.yaml` ships in both places and matches the frozen contract.** `harness/flows/review.yaml` exists. Parsed with `YAML.parse` and stripped of the loader-only `file` key, it deep-equals `contracts/Q-0006/review-flow.contract.yaml` parsed the same way — panel, named verdict inputs, artifact paths, threshold instructions, `counter: review`, `max_iterations: 3`, `on_exhausted: gate`, closing human gate. `harness lint` reports it ✓. `diff -rq harness/flows spike/templates/harness/flows` prints nothing (it prints nothing today for four flows; five after this).

2. **`code-reviewer.md` ships in both places, byte-identical.** `diff harness/roles/code-reviewer.md spike/templates/harness/roles/code-reviewer.md` prints nothing. The two roles *directories* are deliberately not compared: `developer-backend.md` differs between repo and template by design, and `developer-tooling.md` is repo-local (docs/06). Frontmatter contains neither `adapter` nor `model`, so each step controls its own vendor and no vendor receives another's model alias; the existing smoke assertion that no shipped template pins a codex model still passes. The body states the persona: reads the supplied requirement, solution and diff; never edits or rewrites code; classifies every finding as exactly `blocker`, `major` or `nit`; cites every finding as `file:line`. The severity *threshold* wording stays in the verdict step's `instructions`, not in the role.

3. **The flow uses only fields the engine has.** No `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true }` or `tasks: true`, no `on_fail.with:`. Testable: under `--adapter mock`, `review.yaml` runs `green → regressed` and `green → reviewed` end to end with no change to `spike/src/**`.

### Configuration and `init`

4. **Both config files declare the review keys.** `harness/harness.yaml` and `spike/templates/harness/harness.yaml` carry `repo: { base_branch: <name>, max_diff_bytes: 200000 }`, each with a one-line comment saying what it does. `base_branch` is already present in both; `max_diff_bytes` is added. A config file omitting either key stays valid and resolves to `main` and `200000`, so no existing project file becomes invalid.

5. **`harness init` discovers the base branch safely.** Run inside a repository on branch `master`, `init` writes `base_branch: master`. Run outside a repository, or on an unborn branch git cannot name, it leaves `main`, exits 0 and prints no error. It changes no other key, and a git failure never fails `init`.

### Lint

6. **Cross-flow targets resolve, and the chain must come home.** Every `goto: flow:<target>` names a loadable `<target>.yaml`. Starting at the target's `produces`, lint follows flows by matching `consumes` until the source flow's `consumes` is reached, keeping a visited set of `(flow, stage)` pairs so the walk terminates. Missing target, dead end, ambiguity on a stage the walk actually reaches, and a repeated pair each fail with a message naming source flow, target flow and the stage where the chain dies. A stage with two consumers that the walk never reaches does not fail. `review → development` and `review → qa-red` are positive fixtures; the self-target `review → review` is built in a temporary harness directory as the named negative fixture and dies at stage `reviewed`. Shipped flow files are never mutated by a fixture.

7. **Bounds and counter spelling are checked.** `max_iterations` must be an integer greater than zero: missing, non-integer, `0` and negative each fail, naming the step and the field. (`0` passes today.) `counter` must be a non-empty key without an `iterations.` prefix; `counter: iterations.review` fails with a message giving the corrected spelling `review`, because the prefixed form would create a literal `"iterations.review"` key nested inside `iterations`.

8. **A single-vendor panel fails lint.** In a flow with `cross_vendor: required`, a parallel group containing two or more steps that share a role must span at least two adapters; the message names every member id and the shared adapter. The shipped `review.yaml` passes this rule and the existing verdict-input rule together — the verdict step's two named inputs are written by two different adapters, which the cross-vendor refinement of 2026-08-21 permits for a judge.

9. **`harness run` performs the same validation first, from disk.** Before its first `adapter.run` and before any write to the ticket folder, `run` executes the complete flow-directory validation of criterion 6–8 and reports the identical error, exiting non-zero. It loads pristine flow files from disk **before** any `--adapter` override is applied in memory. Two tests: with a sibling flow that has an unresolvable target, `harness run review <id> --adapter mock` exits non-zero and the ticket's `runs.log` gains no line; and `harness run review <id> --adapter mock` on a valid harness does *not* fail the single-vendor panel rule, which the override would otherwise trigger on every mock run.

### Gate answers

10. **A gate answer is never defaulted, and never silently invented.** `--gate-answer advance|retry|abort` is repeatable and consumed once each in encounter order, so an exhaustion `advance` followed by a closing-gate `abort` is expressible as two flags. When the explicit answers run out the CLI may read a TTY. On non-TTY stdin, or when the answer is missing, empty or not one of the three words, the process exits non-zero with an error naming the gate; it neither blocks nor defaults to `advance`. `--auto` does not answer an exhaustion gate: with `--auto` and no `--gate-answer`, an exhausted loop exits non-zero naming the gate rather than walking through it.

### Regression suite and evidence

11. **The existing suite stays green, with its assumption made explicit.** `npm test --prefix spike` passes, including `draft → green`, the API-key refusals and the no-pinned-codex-model assertion. The exhausted-loop assertion at `spike/test/smoke.js:82-85` supplies an explicit `--gate-answer` instead of relying on the empty-line default this ticket removes. `harness board` needs no production change: its regression test asserts that a persisted `iterations.review` appears in the existing `iter={…}` output and that a run's cost is counted once across an exhaustion event (`cost: 0`) plus its terminal event.

12. **Real-CLI evidence is on the record.** At this ticket's closing gate the maintainer runs the first real `harness run review <id>` on real Claude Code and Codex CLI and saves the evidence in this ticket's folder: that both reviewers received the harness-materialised diff under plan / read-only sandbox, and that the severity threshold behaved as instructed. This is a manual acceptance action — it spends subscriptions, so no automated test asserts it and it never runs inside development fan-out.

### Documentation

13. **The docs agree with the shipped flow in the same change.** `docs/02-sdlc-pipeline-spec.md`: §3.4's state diagram draws the review rejection to the derived stage rather than back to `green`; §5.5 is rewritten as the flow actually ships (three-dot `{base}...harness/{id}/integration`, `{round}`, unprefixed `counter: review`, no `judge`/`findings:`/`tasks:`/`with:`, no pinned model names); §10 Q1 is answered no for M1. `docs/06-development-plan.md`: M1's review line reflects the split across Q-0006 and Q-0033. `docs/DECISIONS.md`: one entry for the derived regression target, one for the exhaustion gate that `--auto` cannot bypass — both are behaviour on `main` today with no entry naming them. `docs/GLOSSARY.md`: **Gate** gains a sentence distinguishing an author-declared `human-locked` gate from the exhaustion gate the engine presents. `README.md` gains the one command `harness run review <id>` and no new setup step.

## Non-goals

- **Anything Q-0006 owns.** Round numbering, diff materialisation and truncation, derived regression, counter increment, retry and exhaustion semantics, atomic panel failure, invalid-output containment, rework worktree sync, history and cost events, `harness/flows/development.yaml`'s verdict input, and `spike/src/adapters/**`. This ticket ships the files and the lint that reach them; it does not re-specify or re-implement them, and it does not re-cut a contract under `contracts/Q-0006/`.
- **Re-opening settled questions.** The derived regression target, `{round}` from the filesystem, retry set to `max_iterations` (errata E-1), the severity threshold, the read-only panel and the no-payload rework are decided in Q-0006's merged requirement and are inputs here.
- **A lighter `fix.yaml`**, scoped rework or a review-generated `tasks.yaml`.
- **Auto-starting the target flow after a regression.**
- **Budget enforcement.** `harness.yaml` carries `budget:` and nothing reads it; that lands before M3.
- **Tracing the producing vendor of an integrated diff in lint** — not statically knowable, so it could only pass vacuously.
- **A `--json` or machine-readable lint report**, and any CI mode.
- **Naming gates in `--gate-answer`** (e.g. `verdict=retry`); encounter order is the contract.
- **`qa-final.yaml`, `deploy.yaml`, a `rework` stage, a third reviewer, the Gemini adapter, any UI.**
- **Renaming `.harness/worktrees/` to `.quorum/worktrees/`** — real drift between spike and rules, not this ticket's.
- **A single-vendor fallback when only one CLI is logged in.** The panel fails with the existing translated auth message.

## Open questions (none blocking)

| # | Question | Owner | Default already in the criteria |
|---|---|---|---|
| 1 | Which ticket carries the first real review run (criterion 12)? Q-0006 sits at `green` and is blocked on this flow existing; Q-0033 would be reviewing the ticket that created the reviewer. | Ruud | Run it on Q-0006 — its diff is real, substantial and already integrated. The evidence file lives in this ticket's folder either way. |
| 2 | Does the exhaustion gate reusing the `human-locked` kind muddy the vocabulary, given the glossary defines `human-locked` as deploy's? | This ticket's docs work | Keep the kind; criterion 13 adds the distinguishing sentence. Renaming the kind is an engine change and belongs to whichever ticket needs it. |
| 3 | Is `max_diff_bytes: 200000` right? | This ticket's implementation | Ship 200 000; tune after criterion 12's real run. |
| 4 | Should `init` writing the *current* branch be narrowed (e.g. prefer the remote HEAD) so an adopter running `init` on a feature branch does not pin it as the base? | Ruud | Ship the current branch as the contract specifies. The value is one commented line in `harness.yaml` and a wrong ref errors by name before any agent is spawned. |
| 5 | Should `harness lint` report every flow's problems in one pass, or stop at the first? | This ticket's implementation | Report all, exit non-zero once — the current per-file loop already prints every file. |

## Risks

1. **Q-0006 has not itself been reviewed, and cannot be until this lands.** Its engine work merged to `main` on evidence from its own red suite. If criterion 12's real run — or Q-0006's eventual review — demands an engine change, this ticket's lint and CLI work rebases onto it. Mitigated by ordering: this ticket depends on Q-0006 and starts from merged `main`.
2. **Removing the empty-answer default surfaces every place that relied on it.** The known one is `spike/test/smoke.js:82-85` (criterion 11). An unknown one appears as a run that exits non-zero where it used to advance — which is the correct behaviour, arriving as a surprise.
3. **The preflight ordering bug is invisible until it isn't.** If validation ran after the `--adapter mock` override, every mock run would fail the single-vendor panel rule and read as a lint bug rather than an ordering bug. Criterion 9 tests both directions for exactly this reason.
4. **The return-chain walk is being written against five flows and must survive seven.** When `qa-final.yaml` and `deploy.yaml` land (Q-0012), stage `reviewed` gains a consumer and new chains become reachable. The visited-set rule and "ambiguity only on a reached stage" are what keep that from turning into a lint failure on a correct flow set.
5. **Two copies of every shipped asset.** Nothing enforces that `harness/` and `spike/templates/harness/` stay identical; criteria 1 and 2 make it a test rather than a habit, and deliberately scope the comparison so the legitimately-divergent files do not force a false rule.
6. **`init` pins whatever branch it finds.** Cold-clone friendly when the adopter is on their default branch, quietly wrong when they are not (open question 4).
7. **Cold-clone cost.** This ticket adds one command to the README path and one key to `harness.yaml`. It adds no setup step — but the stage it unlocks costs two reviewers and a judge, on a first-run budget that the M0 measurements already show cannot hold all seven stages in thirty minutes. Not this ticket's decision to take; worth not making worse.

## Cross-cutting checklist

- **BYOS.** No new auth path, no key on any path including `init`, tests and examples. The panel uses the existing `claude` and `codex` adapters and their `check()` guards; `harness adapters --probe` remains the way to learn a login is dead before paying for a round.
- **Worktree safety.** This ticket adds no writing step. The reviewers declare no `worktree`, so they run with `allowWrite: false`, create no branch, and touch nothing outside `backlog/<ticket>/review/`. `init` writes only into the target directory.
- **Gates.** One `gate: human` at the end of the flow, flippable to `auto` by the user; the exhaustion gate stays unbypassable by `--auto` (criterion 10). No `human-locked` gate is authored — that stays deploy's.
- **Files are the database.** New shipped files (`review.yaml`, `code-reviewer.md` and their template copies), one new config key (`repo.max_diff_bytes`). All additive; no existing ticket, flow or config file becomes invalid.
- **Lint rules.** Three added: cross-flow target and return chain, bound and counter spelling, single-vendor panel — all shared with `harness run`'s preflight.
- **Cold-clone impact.** One README command, one config key written by `init` that the adopter never has to see. No new setup step.
- **Errors are explicit.** Lint before any spawn or ticket write (criterion 9); a missing base ref names the key and file (Q-0006, guarded here by criterion 4); a gate answer is never defaulted (criterion 10).
- **Product-agnostic.** The flow, the role text and the tests speak only about diffs, contracts and requirements; no product name appears.

## Confirmation — what re-checking the design against `main` found

The ticket asked for a short, confirmatory pass and predicted that a long one would mean the shared design was less settled than it looks. It was short. The design held; four things changed, all of them scope reductions or precision:

- **`repo.base_branch` already ships** in both `harness/harness.yaml` and the template, added by the integrate work in Q-0004. Only `max_diff_bytes` and the `init` discovery remain (criteria 4 and 5).
- **`harness/flows/development.yaml` already reads `review/verdict.md`** and is byte-identical to its template copy. Q-0006's runtime task owns that file; nothing is left here, and Q-0006's AC-21 is done.
- **Q-0006's AC-1 and AC-2 as written would fail.** `diff -rq harness/roles spike/templates/harness/roles` is not empty and must not be: `developer-backend.md` differs by design (adopter paths versus Quorum's layout — the divergence a reviewer caught in solutioning) and `developer-tooling.md` is repo-local. Criterion 2 compares the one file that must match.
- **`max_iterations: 0` passes lint today**, because `Number.isInteger(0)` is true, and `counter` is not validated at all — `handleFail` falls back to `${flow.name}.${step.id}`. Criterion 7 names both explicitly rather than saying "validate the bound".

One implementation detail worth carrying into solutioning, because it is a real change and not a line of prose: the CLI's flag parser (`spike/bin/harness.js:24-27`) overwrites a repeated flag, so `--gate-answer` cannot be repeatable without changing it. Everything else in criterion 10 is new code in `ui.gate`.
