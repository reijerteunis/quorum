# Decisions — Quorum

*Status: index, 2026-08-28. Was one 1,675-line document until it was split into one file per
decision under [`decisions/`](decisions/); this page is the map. Nothing was rewritten — see
[A decision is a file; this page is the index](decisions/057-a-decision-is-a-file.md).*

Every decision and why, append-only, newest last. If code and a numbered doc disagree, the doc is
wrong until an entry here says otherwise. Never contradict an entry silently: add a new one, or
amend the old one naming the new.

**An entry is cited by its title and date** — *"skipped is not passed" (2026-08-25)* — not by its
file name or its number. The number orders the folder and carries no other meaning; the title and
the date are what the citations across `docs/`, `harness/`, `backlog/` and the source comments
already use, and they are unchanged.

**To add one:** write `decisions/<next-number>-<slug>.md`, whose first line is
`# <Title> — <YYYY-MM-DD>`, followed by **Decision**, **Alternatives considered** and **Why**; then
add its line at the bottom of this page. Never edit an entry that has landed. A reversal is a new
entry naming the old one; a correction to an old one is an erratum entry, which is why
[040](decisions/040-erratum-m1s-closing-entry-on-q-0006s-empty-diff.md) and
[043](decisions/043-the-erratum-is-closed-the-sentence-was-true.md) exist as entries rather than as
edits. `packages/shared/src/docs.test.ts` fails if this page and the folder disagree.

## 2026-08-06

- [Agent-agnostic = multi-vendor via subscription-authed CLIs](decisions/001-agent-agnostic-multi-vendor-via-subscription-authed-clis.md)
- [Flows are versioned files; UI is editor/runner; opinion ships as templates](decisions/002-flows-are-versioned-files.md)
- [v1 is a local web app; desktop shell is a later wrapper](decisions/003-v1-is-a-local-web-app.md)
- [Git worktrees are the execution model](decisions/004-git-worktrees-are-the-execution-model.md)
- [Human-gated by default, auto opt-in per gate](decisions/005-human-gated-by-default.md)
- [Mission control, not cockpit](decisions/006-mission-control.md)
- [Canonical harness compiled to vendor dialects](decisions/007-canonical-harness-compiled-to-vendor-dialects.md)
- [v1 cut and launch test](decisions/008-v1-cut-and-launch-test.md)

## 2026-08-21

- [Backlog is files in git, no ticketing tool](decisions/009-backlog-is-files-in-git.md)
- [One flow per SDLC stage, chained by backlog state](decisions/010-one-flow-per-sdlc-stage.md)
- [Bounded backward edges in the flow engine](decisions/011-bounded-backward-edges-in-the-flow-engine.md)
- [Writer and reviewer are never the same vendor](decisions/012-writer-and-reviewer-are-never-the-same-vendor.md)
- [Solutioning emits contracts; red phase tests against contracts](decisions/013-solutioning-emits-contracts.md)
- [Deploy gate is human-locked; script steps pulled into v1](decisions/014-deploy-gate-is-human-locked.md)
- [Cross-vendor rule refined: judges over mixed-vendor candidates are allowed](decisions/015-cross-vendor-rule-refined-judges-over-mixed-vendor-candidates.md)
- [Spike exists: quorum (engine + adapters + backlog, mock-verified)](decisions/016-spike-exists-quorum-engine-adapters-backlog.md)
- [Branch layout: `harness/<id>/integration` plus sibling step/task branches](decisions/017-branch-layout-harness-id-integration-plus-sibling-step-task.md)
- [`integrate` is one generic step type used by three stages](decisions/018-integrate-is-one-generic-step-type-used-by-three.md)

## 2026-08-22

- [Product-agnostic; launched open source via heyruud.com; dogfooded on Ruud's SaaS portfolio](decisions/019-product-agnostic.md)
- [Name: Quorum](decisions/020-name-quorum.md)
- [Flows never pin a vendor model name; codex runs with `--ignore-user-config`](decisions/021-flows-never-pin-a-vendor-model-name.md)
- [check() proves presence; only `adapters --probe` proves login](decisions/022-check-proves-presence.md)
- [Cost and duration per stage, measured](decisions/023-cost-and-duration-per-stage.md)
- [M0 closed: the adapters work, but nothing about them was where the risk was](decisions/024-m0-closed-the-adapters-work.md)
- [Codex cost is reported as tokens, never priced locally](decisions/025-codex-cost-is-reported-as-tokens.md)
- [Contracts are executable: ajv in the toolchain, `harness validate` in the flows](decisions/026-contracts-are-executable-ajv-in-the-toolchain.md)
- [`retry` at an exhaustion gate authorises exactly one more traversal](decisions/027-retry-at-an-exhaustion-gate-authorises-exactly-one-more.md)
- ["Red for the right reason" is an engine property, not a role property](decisions/028-red-for-the-right-reason-is-an-engine-property.md)
- [Ticket size is the dominant cost driver](decisions/029-ticket-size-is-the-dominant-cost-driver.md)
- [Step-output validation is Quorum's contract with its own agents](decisions/030-step-output-validation-is-quorums-contract-with-its-own.md)

## 2026-08-23

- [Product-level schema annotations select semantic validation](decisions/031-product-level-schema-annotations-select-semantic-validation.md)
- [Every file a red test requires must be owned by exactly one task](decisions/032-every-file-a-red-test-requires-must-be-owned.md)
- [Tasks are small; the fan-out is the unit of parallelism, not of scope](decisions/033-tasks-are-small.md)
- [A red test is a permanent acceptance test; phase-bound facts are evidence](decisions/034-a-red-test-is-a-permanent-acceptance-test.md)
- [Do not drive harness-machinery work through the harness](decisions/035-do-not-drive-harness-machinery-work-through-the-harness.md)
- [Cross-flow regression uses a derived regression target](decisions/036-cross-flow-regression-uses-a-derived-regression-target.md)
- [Non-auto exhaustion gates require an explicit human or scripted answer](decisions/037-non-auto-exhaustion-gates-require-an-explicit-human.md)

## 2026-08-24

- [M1 closed: the mechanisms hold; what fails is scope, ownership and evidence](decisions/038-m1-closed-the-mechanisms-hold.md)
- [A chore flow for machinery and configuration work](decisions/039-a-chore-flow-for-machinery-and-configuration-work.md)
- [Erratum: M1's closing entry on Q-0006's empty diff](decisions/040-erratum-m1s-closing-entry-on-q-0006s-empty-diff.md)
- [Containment is derived from git on each board invocation, never stored](decisions/041-containment-is-derived-from-git-on-each-board-invocation.md)
- [Q-0034 closed: an unlanded branch's cost is not its merge conflict](decisions/042-q-0034-closed-an-unlanded-branchs-cost.md)

## 2026-08-25

- [The erratum is closed: the sentence was true, and it was still the wrong sentence](decisions/043-the-erratum-is-closed-the-sentence-was-true.md)
- [Q-0035 accepted: a check that skips its subject must not report success](decisions/044-q-0035-accepted-a-check-that-skips-its-subject.md)
- [The port takes the chore route, except the one child that has new behaviour](decisions/045-the-port-takes-the-chore-route.md)
- [The port preserves behaviour; one exception is authorised and everything else stops the child](decisions/046-the-port-preserves-behaviour.md)
- [A requirement may not name a surface its flow cannot write](decisions/047-a-requirement-may-not-name-a-surface-its-flow.md)
- [Zod describes structure and types; the flow lint keeps the semantics](decisions/048-zod-describes-structure-and-types.md)
- [The event union is derived from what the product emits, and `tool` and `text` are not invented](decisions/049-the-event-union-is-derived-from-what-the-product.md)
- [Unknown keys are refused where Quorum owns the key set, and preserved where it does not](decisions/050-unknown-keys-are-refused-where-quorum-owns-the-key.md)

## 2026-08-26

- [`core` is organised in folders named after the port's children; `shared` stays flat](decisions/051-core-is-organised-in-folders-named-after-the-ports.md)

## 2026-08-27

- [Type-aware linting is on for exactly one rule](decisions/052-type-aware-linting-is-on-for-exactly-one-rule.md)
- [`.claude/rules/` is a derived copy, not a surface a requirement may name](decisions/053-claude-rules-is-a-derived-copy.md)
- [The test command defeats its own cache, in configuration and not in the engine](decisions/054-the-test-command-defeats-its-own-cache.md)
- [A green tick names what it examined, and CI's names execution](decisions/055-a-green-tick-names-what-it-examined.md)

## 2026-08-28

- [A cache hit names what the task reads, not what its package contains](decisions/056-a-cache-hit-names-what-the-task-reads.md)
- [A decision is a file; this page is the index](decisions/057-a-decision-is-a-file.md)
- [A command's output is captured whole, or the run stops](decisions/058-a-commands-output-is-captured-whole.md)
- [A nit does not contradict an approval](decisions/059-a-nit-does-not-contradict-an-approval.md)
- [Membership is a git question, not a filesystem one](decisions/060-membership-is-a-git-question-not-a-filesystem-one.md)
- [An absent branch is an answer, and the board decides whether it is worth saying](decisions/061-an-absent-branch-is-an-answer.md)
- [What a run's event stream carries, and how a gate answer travels back](decisions/062-what-a-runs-event-stream-carries.md)

## 2026-08-29

- [A reviewer approves the change it asked for](decisions/063-a-reviewer-approves-the-change-it-asked-for.md)
- [A red tick names what failed, not what was skipped](decisions/064-a-red-tick-names-what-failed.md)
- [Erratum: two clauses of "What a run's event stream carries" describe a different engine](decisions/065-erratum-two-clauses-of-062-describe-a-different-engine.md)
- [A check is not established by reading it](decisions/066-a-check-is-not-established-by-reading-it.md)

## 2026-08-30

- [A range is checked one endpoint at a time, because an endpoint is what can be absent](decisions/067-a-range-is-checked-one-endpoint-at-a-time.md)
- [An erratum is the last repair, not the first](decisions/068-an-erratum-is-the-last-repair-not-the-first.md)
- [A test's verdict is a property of the commit, not of the checkout or the account](decisions/069-a-tests-verdict-is-a-property-of-the-commit.md)

## 2026-08-31

- [A refused finding is a gate, not another round](decisions/070-a-refused-finding-is-a-gate-not-another-round.md)
- [The port is closed, and what it cost was scaffolding](decisions/071-the-port-is-closed-and-its-cost-was-scaffolding.md)
- [A config key is camelCase under `adapters.<vendor>` and snake_case everywhere else](decisions/072-a-config-key-is-camelcase-under-adapters.md)
- [A run removes the worktrees it made, and never the refs](decisions/073-a-run-removes-the-worktrees-it-made.md)

## 2026-09-01

- [The plan and the backlog are checked against each other, and the two directions are not the same](decisions/074-the-plan-and-the-backlog-are-checked-against-each-other.md)
- [An entry's date is the date it takes its place in the index](decisions/075-an-entrys-date-is-the-date-it-takes-its-place.md)
- [A run nobody answered is undecided, and keeps the branch it proved](decisions/076-a-run-that-nobody-answered-is-undecided.md)
- [Erratum: `--auto` does reach an unanswered gate, and can end a run undecided](decisions/077-erratum-auto-does-reach-an-unanswered-gate.md)

## 2026-09-02

- [The emit serves the binary, and no test verdict moves behind it](decisions/078-the-emit-serves-the-binary.md)
