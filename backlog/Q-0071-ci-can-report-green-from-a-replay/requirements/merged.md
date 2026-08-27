# Q-0071 — CI can report green from a replay, and its cache outlives the commit it was built for

*Requirements, merged. Stage `draft` → `requirements`. Written 2026-08-27.*

**A vocabulary note first.** This document is about GitHub Actions, which uses "job" and "step" for
its own things. Quorum's glossary reserves **step** for a step in a flow. Where this document says
*job* or *workflow step* it means GitHub Actions; where it says *step* alone it means a flow step.
The `integrate` step and the chore flow's human gate are Quorum's; the `workspace` job is CI's.

---

## Problem

The repository has one automated gate that runs without being asked: `.github/workflows/ci.yml`.
Its `workspace` job can report every package green having executed nothing.

`:20–24` restores Turbo's result cache across runs, and `:25–27` run `pnpm lint`, `pnpm typecheck`
and `pnpm test` — `turbo run <task>` with no `--force` in all three cases. On a push that touches
only `harness/` and `docs/`, every package's content hash is unchanged, every task is a hit, and the
job reports success in milliseconds. That is not hypothetical: `docs/DECISIONS.md` records the
identical mechanism measured on this repository one layer up, where a ticket touching only
`harness/` and `docs/` replayed all seven packages inside an `integrate` step and wrote `tests=ok`
having run nothing.

Q-0065 closed that layer by appending `--force` to `harness/harness.yaml`'s `commands.test`. The fix
does not reach here and cannot: `integrate` runs `harness.yaml`'s command, CI runs `package.json`'s.
Two independent paths, one closed.

It has already hidden something. Q-0043's containment flake survived behind a cached pass and
surfaced only when a forced re-run failed 1 of 123 on 2026-08-26. **A flaky test behind a cache
reports its last mood.**

### What this requirement changes about the ticket's account

The ticket body is right that the defect exists and right about which lines cause it. Five things in
it are wrong or incomplete against the repository. Each was re-derived here rather than inherited,
and two of them change the design.

1. **The runner is `ubuntu-latest`** (`ci.yml:10`), so the fallback prefix is `turbo-Linux-`, not
   `turbo-macOS-`. Cosmetic, but the key is quoted in the ticket as evidence.

2. **There is no CI badge.** `README.md` and the numbered docs contain no shields.io image and no
   workflow badge; a grep for `shields`, `badge.svg` and `workflows/ci.yml/badge` returns nothing.
   "State what the CI badge claims" therefore has no surface as written. The intent is honoured on
   the surfaces that exist — a comment in the workflow (AC-5) and `docs/04-architecture.md` §Testing
   (AC-6) — rather than silently dropped.

3. **`restore-keys` is not, by itself, a route to a wrong answer.** Turbo's cache key is a content
   hash over the task's declared inputs, not the commit SHA. Restoring an older `.turbo` supplies
   *more entries*; a hit still means "a task with exactly these inputs passed once". What the
   cross-commit fallback actually does is widen the window across which a stale or flaky conclusion
   survives, and make a hit routine rather than rare. The ticket's framing — "the cache a job reads
   was usually built for a different commit" — is factually right and is the wrong thing to be
   alarmed by on its own. *Before trusting a git command as evidence, state which question it
   answers* (Q-0034) applies to a cache key too, and it changes what to fix.

4. **The route to a wrong answer is the input set, and the ticket does not mention it.**
   `turbo.json` declares **no `inputs` and no `dependsOn`**, and its only root-relative declarations
   are four `globalDependencies` — `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`,
   `vitest.shared.js`. Turbo's default input set is otherwise package-scoped. Both suites read and
   assert on files well outside their own package: `@quorum/shared` on `docs/02-…`, `docs/03-…`,
   `docs/04-…`, `docs/DECISIONS.md`, `docs/GLOSSARY.md`, `harness/harness.yaml`, `spike/src/**`,
   `spike/bin/harness.js`, `spike/templates/harness/harness.yaml` and three files under
   `packages/core`; `@quorum/core` on `docs/03-…`, `docs/04-…`, `turbo.json`, `contracts/Q-0006/**`,
   `contracts/Q-0011/**`, `backlog/Q-0006-…/ticket.md`, `pnpm-lock.yaml` and several files under
   `packages/shared`. **None of it moves a hash.**

   The demonstration worth remembering: `packages/shared/src/project.test.ts:130` carries a block
   titled *"Q-0065 AC-3 — the configured test command defeats this repository's cache"*, which
   asserts that `harness/harness.yaml`'s `commands.test` forces turbo. `harness/harness.yaml` is not
   among that task's hashed inputs. Delete `--force` from `harness.yaml` and the hash does not move,
   so a cached `pnpm test` replays green over the guard written to catch exactly that. **Q-0065's
   enforcement is invisible to the cache it exists to defeat.**

   There is a second axis. `turbo.json` declares no `dependsOn`, and `packages/shared/package.json`
   exports `./src/index.ts` directly, so `core` compiles `shared` from source — yet a change in
   `shared` invalidates none of `@quorum/core`'s `test`, `lint` **or** `typecheck` hash. Q-0069's
   `@typescript-eslint/no-deprecated` is type-aware and reads `shared`'s declarations while linting
   `core`; a deprecation introduced in `shared` leaves `core`'s lint tick cached and green.

   This is bigger than one workflow file, it affects a developer's local `pnpm test` as much as CI,
   and the fix needs its own decision. It is **not** in this ticket's scope. It is drafted in full
   as a successor at the end of this document so the obligation cannot expire.

5. **The ticket's shape 2 — "narrow the cache key" — is refuted on both counts.** Its own aside says
   *"turbo's own per-package hashing may already make this redundant — check before building it."*
   Checked, and it does: the hash is content-addressed, so key-narrowing removes no incorrect hit,
   and it destroys what cache value remains, because an exact-SHA key can only hit on a *re-run of
   the same SHA* — precisely the moment a flake must not be replayed. It is the worst of both: no
   speed and no honesty. Rejected in the design below rather than left as an option, and AC-3 is the
   criterion that forecloses it.

---

## User stories

**`maintainer`.** *As the maintainer, I want a green tick on a commit to mean the workspace's lint,
typecheck and test tasks were executed against that commit, so that I can treat CI as the standing
gate it is, rather than as a mood ring for whatever the cache last held.*

**`contributor`.** *As an adapter contributor, I want to know what the repository's checks actually
examined, so that a green run on my pull request tells me my change was tested rather than that my
change happened not to move a hash.*

**`adopter`.** Not a persona for this ticket. CI is this repository's own machinery; `harness init`
copies `spike/templates/harness/` and ships no workflow file, and nothing on the cold-clone path
reads `.github/`. Stated so the omission is visible rather than assumed.

---

## Surface audit

The three questions the repository now requires of every criterion's surface, per *"A requirement
may not name a surface its flow cannot write"* (2026-08-25) and *"`.claude/rules/` is a derived
copy"* (2026-08-27). Performed here, at the routing decision, rather than left for a revise loop.

| Surface named below | May `developer-generalist` write it? | Will `commitAll` revert it? | Is it derived? |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | **yes** — `.github` is in `paths` | no | no |
| `packages/**` (the guard test) | **yes** — `packages` is in `paths` | no | no |
| `docs/04-architecture.md` | **yes** — `docs` is in `paths` | no | no |
| `dev/implement-report.md` | written by the step's declared `output.writes` | no (the flow's own artifact) | no |
| `docs/DECISIONS.md` | **no** — the role forbids it: *"You do not append to docs/DECISIONS.md; a decision is the human's to record"* | no | no |
| `backlog/**` | **no** | **yes** — reverted and cleaned before every agent commit | no |
| `.claude/**` | **no** — outside `paths`, and a derived copy of `harness/` | no | **yes** |

**Binding consequence.** No criterion below asks the implementer to write `docs/DECISIONS.md`,
`backlog/**` or `.claude/**`. This ticket does imply a decision entry — it settles what a green tick
claims — and AC-11 asks the implementer to *name* it in its report. Writing it is Ruud's, at the
gate or before.

**Route: the chore flow** (`requirements → chore → human gate`). The criterion is whether a red
phase can exist, and it cannot: the work changes what the repository's CI *is*, and the assertions
available are file assertions over configuration — the same shape Q-0065 shipped. Nothing here
changes product behaviour.

---

## Design, and why this shape

Recommended: **on CI, every workspace task executes.** Three consequences, each a criterion below.

- `pnpm turbo run lint --force`, `pnpm turbo run typecheck --force`, `pnpm turbo run test --force`.
- The `actions/cache@v4` step restoring `.turbo`, and the comment above it at `:19`, are deleted.
  With every task forced it supplies nothing, so removing the cross-commit fallback is a by-product
  rather than a fix.
- `actions/setup-node@v4`'s `cache: pnpm` **stays**. It caches *downloads*, not *conclusions*. That
  distinction is the sentence the documentation criteria have to land: a dependency cache replays a
  fetch, a task cache replays a verdict, and only the second one can make a tick a lie.

**Why all three tasks and not only `test`.** The ticket suggests `test` alone as cheapest, and the
codex candidate went further and made "does not force `lint` or `typecheck`" a criterion. That is
overruled, on two grounds that are documented rather than assumed. Q-0069's decision entry states
that `harness.yaml`'s `commands.test` runs neither `lint` nor `typecheck`, so the deprecation rule
that ticket added *"is enforced by CI alone"* — a cached lint tick is the only thing standing
between this repository and a silently reintroduced deprecated API. And turbo declares no
`dependsOn`, so a change in `shared` leaves `core`'s lint and typecheck hashes untouched even though
`core` compiles `shared`'s source. Forcing only `test` would leave replayable exactly the two ticks
whose blindness Q-0069 already paid for. The measured cost of the extra two is under two seconds.

**Why not narrow the cache key** (the ticket's shape 2). Refuted above and by AC-3.

**Why not a second, forced required job** (the ticket's shape 3, and the codex candidate's implicit
worry). It doubles the workflow to buy a cache whose measured value is a few tens of seconds.
Rejected on cost/benefit, not on principle.

**Why not `TURBO_FORCE=1` as a job-level `env`.** Q-0065 refused environment injection when the
alternative was a flag in a file the user reads, and most of that reasoning transfers: a flag on the
command line is legible at the point of use, an environment variable is legible only if you go
looking. The part that does *not* transfer is Q-0065's stronger objection — that it would put a
runner's name inside `core` — because `ci.yml` is already a turbo-aware file. So this is a
preference for legibility, not a rule. AC-1 is written as a property; an implementer with a reason
to prefer the env block satisfies AC-1 and says why in its report.

**Why not a `test:ci` script in `package.json`.** It would move the force one indirection away from
the file a reader of a CI result actually opens, and give the repository two answers to "what does
`pnpm test` do". AC-7 forbids it for that reason, so it is not re-opened in review.

**Why CI's evidence is turbo's own summary and not a parser.** The codex candidate asked for a
criterion that the check *fail if it cannot establish that forced execution was requested*. Struck.
It means parsing turbo's presentation output, which its own risk section warns goes stale across
versions, and it makes the tick depend on a string. The durable form of that intent is a file
assertion over the workflow — AC-4 — plus the fact that a forced run's summary reports zero cached
tasks, which a reader can see without any parser.

**Cost.** `docs/DECISIONS.md` records the forced workspace suite at **25–30 s** against 9 ms
replayed, and the forced whole-workspace lint at **1.88 s** — both measured on a developer machine
on 2026-08-27, not on an ubuntu runner. Expect roughly half a minute added to a job that already
spends longer than that on checkout and `pnpm install --frozen-lockfile`. AC-10 requires the
implementer to re-measure rather than inherit these, because three inherited measurements in this
repository have been wrong in the last week.

**A property worth naming, because a later ticket will be tempted to undo it.** The guard AC-4 adds
asserts over `.github/workflows/ci.yml`, and `ci.yml` is in no package's hashed inputs. A
file-assertion guard over an unhashed file is only trustworthy on a run that executes it. After this
ticket both gates that matter do execute it — CI because AC-1 forces, `integrate` because Q-0065's
`commands.test` forces. If a future ticket restores a cached CI path, this guard is the first thing
it silences. That belongs in the comment AC-5 asks for.

---

## Acceptance criteria

Numbered, independently testable, surface named in each.

**AC-1 — CI executes; it does not replay.** *Surface: `.github/workflows/ci.yml`.* The `workspace`
job invokes `lint`, `typecheck` and `test` such that **no task can be satisfied from a cache entry**
on any push or pull request, local or remote cache alike. Verify by running the job, or the same
commands locally against a warm `.turbo`: no task reports `cached`, and turbo's summary reports zero
cached tasks. The recommended form is three steps `pnpm turbo run <task> --force`; any form with the
same property satisfies this criterion, and an implementer choosing another says why in its report.

**AC-2 — the result cache is gone from the workflow; the dependency cache stays.** *Surface:
`.github/workflows/ci.yml`.* The `actions/cache@v4` step at `:20–24` restoring `path: .turbo`,
together with its `key`, its `restore-keys` and the comment at `:19` that explains it, is deleted.
The `actions/setup-node@v4` step's `cache: pnpm` at `:14–17` is unchanged. Verify by reading the
file: no workflow step restores or saves a turbo result cache; `cache: pnpm` is still present.

**AC-3 — a re-run of the same commit executes too.** *Surface: `.github/workflows/ci.yml`.* Given a
successful run and whatever cache it left behind, a re-run of the required check **for the same
commit** executes every selected task again. An exact-commit hit must not turn the check into a
replay. This is the criterion that forecloses key-narrowing and the one that lets a flake surface:
a cached pass must never suppress or stand in for a failing execution at the checked-out commit.
Verify: run the workspace commands twice in succession with the cache directory left in place; the
second run reports zero cached tasks.

**AC-4 — a guard, demonstrated to have a subject before it is trusted.** *Surface: a test file under
`packages/**` in a suite CI runs — `packages/core/src/test-command.test.ts` is the natural home, as
Q-0065's precedent for exactly this class of claim.* A test reads the real
`.github/workflows/ci.yml` and asserts:

  a. each of `lint`, `typecheck` and `test` is invoked in a form that cannot be satisfied by a
     replay;
  b. no workflow step restores or saves a turbo result cache (no `path: .turbo`, no `turbo-` cache
     key);
  c. the workflow sets `QUORUM_REAL_CLI` nowhere — a runner has no subscription login, and
     `packages/core/src/adapters/real-cli.probe.test.ts:65`'s `describe.skipIf` must keep skipping
     there.

The same test carries the **pre-ticket workflow text** as a fixture string and asserts that it fails
(a) and (b). A guard whose only evidence is a green run has not been shown to have a subject
(Q-0069). Verify: the test passes on the branch, and the fixture half fails if inverted.

**AC-5 — the workflow states what its green tick claims.** *Surface: `.github/workflows/ci.yml`.* A
comment above the `workspace` job says, in two or three sentences: that the job executes lint,
typecheck and test against this commit rather than replaying a cached conclusion; that the pnpm
cache below it replays downloads and never a verdict; and that a required check reporting green
having executed nothing is the failure this repository calls *"skipped is not passed"*. It **cites**
the 2026-08-25 decision rather than transcribing it (`harness/rules.md`, Comments). Verify by
reading: a reader who has never seen this ticket can tell from the file alone what the tick means.

**AC-6 — `docs/04-architecture.md` agrees with what CI does.** *Surface: `docs/04-architecture.md`.*
§Testing (`:64–67`) says what the workspace job executes and that it is forced, distinguishing the
pnpm download cache from a task-result cache. The document's status line is bumped with the date and
what changed, per the docs rule. Verify: read §Testing and the status line; no other numbered doc
contradicts them.

**AC-7 — the boundary is pinned: nothing outside CI is forced.** *Surfaces: `package.json`,
`harness/harness.yaml`, the repository.* `package.json`'s three scripts remain
`turbo run lint|typecheck|test` with no `--force` and no added `:ci` variant, so a developer's local
run keeps its cache; `harness/harness.yaml` is unchanged; no `TURBO_FORCE` environment variable is
set anywhere. Verify: `git diff package.json harness/harness.yaml` is empty, and `grep -rn
TURBO_FORCE` over the repository returns nothing outside this ticket's own prose.

**AC-8 — `turbo.json` is unchanged.** *Surface: `turbo.json`.* The hash-input defect described above
is a successor ticket, not this one. No `inputs`, `dependsOn`, `globalDependencies` or `env` key is
added, removed or edited here. Verify: `git diff turbo.json` is empty.

**AC-9 — the other four jobs are untouched.** *Surface: `.github/workflows/ci.yml`.* `jobs.spike`
runs `npm test` under `spike/`, which caches nothing and is already honest; the three
`port-freeze-*` jobs, whose `if:`-conditioned skipped-not-passed design is the local precedent for
this ticket's own question, are left as they are. Verify: `git diff` against the base shows no
change to any line from `jobs.port-freeze-policy` (`:39`) to the end of the file, and none to any
`if:` condition.

**AC-10 — the cost is measured, not estimated.** *Surface: `dev/implement-report.md`.* The report
records wall-clock for each of the three tasks run forced and the same task replayed, on the machine
the implementer ran on, with the sample count, and states plainly that these are developer-machine
numbers rather than ubuntu-runner numbers. No figure is inherited from `docs/DECISIONS.md` or from
this requirement without being re-run. Verify by reading the report.

**AC-11 — the implied decision is named, not written.** *Surface: `dev/implement-report.md`, and
`docs/DECISIONS.md` by its absence.* The report names the decision this change implies — what a
green tick claims, why CI executes while local development still replays, and why the pnpm cache
survives — in a form Ruud can turn into an entry. `docs/DECISIONS.md` is unchanged on the implement
branch. Verify: `git diff docs/DECISIONS.md` is empty; the report contains the naming paragraph.

**AC-12 — nothing else regressed.** *Surface: the repository.* After the change, `pnpm lint`,
`pnpm typecheck` and `pnpm test` pass locally, and `npm test --prefix spike` passes. The chore's own
`integrate` step runs `harness.yaml`'s `commands.test`, which already forces, so this is a real
check and not a replay of one. Verify: the `integrate` step reaches `tests=ok`.

---

## Non-goals

- **Fixing turbo's under-declared task hashes.** The largest finding in this document, and
  deliberately not this ticket: it affects local `pnpm test` and every future cached path equally,
  it has at least four candidate shapes with different costs, and one of them depends on a turbo
  capability that has to be verified before it can be designed around. Successor drafted below.
- **Changing `package.json`'s scripts or `harness/harness.yaml`.** A developer's local `pnpm test`
  keeps its cache. That is where a cache earns its keep, and Q-0065 already covers the path where a
  local result is used as evidence.
- **Renaming the `workspace` job.** A rename invalidates any branch-protection rule naming it as a
  required check, which is a worse failure than an imprecise label. The claim goes in a comment and
  in the docs instead. OQ-1.
- **Adding a second required CI job that duplicates the existing run.** The ticket's third shape.
  Rejected on cost: it doubles the workflow to preserve a cache worth tens of seconds.
- **Parsing turbo's output as CI evidence.** Struck from the codex candidate for the reason given in
  the design section. The guard is a file assertion, not a log parser.
- **Adding a README badge.** There is none today; adding one is a new surface with its own claim to
  state, and this ticket is about making the claim true, not about advertising it.
- **Fixing or quarantining the intermittent `git.test.ts` containment failure** tracked through
  Q-0061 and absorbed into Q-0064. Forcing makes it visible; it does not fix it, and this ticket
  does not guarantee that an intermittent failure occurs on any particular run.
- **Whether `integrate` should also run `lint` and `typecheck`.** The ticket names this as a
  neighbour it does not own, and that is right. Note that forcing CI's `lint` makes the Q-0069
  deprecation net *reliable* where it was previously cached, which lowers the urgency of that
  question without answering it. It still needs its own ticket.
- **Introducing remote caching, a cache service, or any new dependency.**
- **Caching on other CI providers, matrix builds, or self-hosted runners.** Not present.

---

## Open questions

None blocks solutioning. Three that the candidates carried are resolved here rather than passed on.

**OQ-1 — does `main` carry branch protection naming `workspace (lint, typecheck, test)` as a
required check?** *Owner: Ruud. Non-blocking, and made moot by the design.* Repository settings are
not readable from the working tree. The recommendation is not to rename the job either way, and
AC-5 puts the claim in a comment rather than in the name, so no protection rule depends on this
change. Answer it only if someone later wants the name itself to carry the claim.

**OQ-2 — "state what the CI badge claims".** *Resolved.* There is no badge: `README.md` and the
numbered docs contain no shields.io image or workflow badge. The intent is read onto the surfaces
that exist — the in-file comment (AC-5) and `docs/04-architecture.md` §Testing (AC-6). Recorded
rather than silently dropped.

**OQ-3 — does the repository use a turbo remote cache?** *Resolved.* `ci.yml` sets no `TURBO_TOKEN`
or `TURBO_TEAM` and `turbo.json` configures no remote cache. It would not change the design if one
were added later: AC-1 is written as "no task can be satisfied from a cache entry", and `--force`
bypasses local and remote replay alike. The implementer confirms this holds on the turbo version in
`package.json` (`^2.10.11`) and says so in its report.

**OQ-4 — turbo's task hashes under-declare their inputs.** *Owner: a successor ticket. Blocking for
that ticket, not for this one.* Full body below.

---

## Risks

1. **Longer CI, unmeasured on the target runner.** Every push pays roughly half a minute more. The
   local measurements are on a developer machine; ubuntu runners are typically slower per core and
   the workspace suite runs seven packages in parallel. Mitigated by AC-10 requiring measurement and
   by the absolute size being small against install and checkout. If it turns out materially worse
   on CI, forcing `test` alone is the fallback and costs one line — at the documented price that
   the lint and typecheck ticks become replayable again.
2. **Forcing hides the hash defect rather than fixing it.** After this ticket both gates that matter
   execute everything, so the under-declared inputs stop mattering *there* — which means nothing
   will surface them again until someone trusts a cached result. That is precisely how this defect
   survived Q-0065. Mitigated only by the successor being written, which is why it is drafted in
   full below rather than described.
3. **The new guard is itself unhashed.** AC-4's test asserts over `ci.yml`, which no package's hash
   contains. It is trustworthy today because both gates force. A future ticket restoring a cached CI
   path silences it. AC-5's comment is where that gets said.
4. **A configuration-only guard can go stale against turbo.** AC-4 asserts that a flag is present,
   not that the flag still means what it means today. A future turbo could rename or re-scope it and
   the guard would stay green over a replaying job. Mitigated by AC-3, which is written as an
   observable property of a re-run rather than as a string, and by the flag being one the version in
   `package.json` documents.
5. **The evidence here is local, not from a CI log.** The workflow file, `turbo.json`'s declarations
   and turbo's documented content-hashing establish the *mechanism* conclusively; how often CI has
   actually replayed is an inference from it. Nobody read a GitHub Actions log for this requirement.
   If an implementer can reach one cheaply, citing a run whose summary shows cached tasks converts
   the inference into an observation — worth doing, not worth blocking on. Note that the `spike` job
   has been red since 2026-08-24 (Q-0063, unhandled `EPIPE`); that is a different job and does not
   affect the `workspace` job's caching.
6. **Scope creep toward the successor.** The hash finding is the more interesting defect and an
   implementer will be tempted to fix it in passing. AC-8 makes `turbo.json` being unchanged a
   testable criterion for exactly that reason, and `developer-generalist` already forbids an
   unrequested default.

---

## Cross-cutting checklist

Held as a checklist rather than as acceptance criteria: the codex candidate carried these as one
bundled criterion, which is not independently testable and would be judged as a unit at review.

- **BYOS.** No API key on any path. The workflow sets `QUORUM_REAL_CLI` nowhere (AC-4c): the
  variable selects the live-CLI probe, a runner has no subscription login, and
  `real-cli.probe.test.ts` must keep skipping there. Forcing `test` means CI now *executes* that
  file and reports it skipped, which is the honest outcome and not a change of behaviour.
- **Worktree safety.** n/a — no engine or flow code changes. The implementer works in
  `.harness/worktrees/harness__Q-0071__implement` as every chore does and writes nothing to the
  user's working tree.
- **Gate behaviour.** Unchanged. The chore flow's human gate, its bounded revise loop
  (`max_iterations: 2`, `on_exhausted: gate`) and `cross_vendor: required` all stand as shipped.
- **Files are the database.** No persistent state introduced; no file format, schema field, CLI
  option, adapter behaviour or flow behaviour changes.
- **File format and schema.** `turbo.json` untouched (AC-8), `harness/harness.yaml` untouched
  (AC-7), no zod schema in `packages/shared` touched, no flow file touched, no `ticket.md`
  frontmatter key added.
- **Lint rules.** No rule added or removed. Q-0069's `@typescript-eslint/no-deprecated` is unchanged
  in configuration and strictly better enforced in fact, because its CI tick can no longer be a
  replay.
- **Errors are explicit.** A test failure, or an inability to execute the selected tasks, fails the
  check. It never falls back to replayed output.
- **Product-agnostic.** No product-specific knowledge introduced.
- **Cold-clone impact.** None. CI is this repository's own machinery; `harness init` ships no
  workflow file, and local `pnpm test` keeps its cache. A stranger's first 30 minutes are
  unaffected.
- **Prerequisite, operator-performed.** `harness/Q-0071/integration` must exist before the chore
  flow's first run — `review` diffs against it and only `integrate`, which runs later, creates it
  (GLOSSARY, *Chore flow*). Several runs have now paid for forgetting this; it is named here so this
  one does not.
- **If implementation reveals that a product contract must change**, the implementer stops and says
  so in its report rather than proceeding — the `developer-generalist` role already requires this,
  which is why it is a checklist line and not a criterion.

---

## Provenance

**From the claude candidate**, which is the substantially stronger document and the spine of this
one: the five factual corrections to the ticket body and the evidence for each; the surface audit
performed at the routing decision; the recommendation to force all three tasks with the two
documented reasons; the deletion of the `actions/cache` step with `cache: pnpm` retained and the
downloads-versus-verdicts distinction that goes with it; the guard-with-a-failing-fixture pattern
and its three assertions; the resolution of "state what the badge claims" onto the workflow comment
and `docs/04-architecture.md`; the boundary criteria over `package.json`, `harness/harness.yaml` and
`turbo.json`; the measured-not-inherited rule; the decision-named-not-written rule; the observation
that the guard is itself unhashed; and the successor draft, carried below essentially intact.

**From the codex candidate**, three contributions that survive and are better for being stated
separately: **AC-3**, the same-commit re-run — the property that actually forecloses the ticket's
key-narrowing shape and the one that lets a flake surface, which the claude candidate left implicit
in its AC-1; the framing that a cached pass must not suppress or replace a failing execution at the
checked-out commit, folded into AC-3; and the explicit non-goal rejecting a second required job that
duplicates the run, plus the non-goal on the `git.test.ts` flake. Its open question on remote
caching is resolved as OQ-3 rather than dropped, and its risk that a configuration-only guard goes
stale against a future turbo becomes risk 4, which sharpened AC-3 into a property rather than a
string check.

**Struck from the codex candidate, with reasons rather than by averaging.** Its AC-5 — *"does not
force `lint` or `typecheck`"* — is overruled: Q-0069's decision entry states its deprecation rule is
enforced by CI alone, and turbo's missing `dependsOn` leaves `core`'s lint hash untouched when
`shared` changes, so those are the two ticks least safe to replay. Its AC-6 pushes a check rename to
carry the claim; overruled, because a rename can break branch protection to buy a label, and a
comment carries the same claim at no risk. Its AC-7 — the check must fail if it cannot establish
that forced execution was requested — is struck as a log parser wearing a criterion's clothes, a
hazard its own risk section names. Its AC-11 (*"work stops and the ticket returns to requirements"*)
is a process instruction the role already carries, and its AC-12 bundled eight cross-cutting
concerns into one criterion; both moved to the checklist above, where they can be read without being
mistaken for independently testable claims.

**From the ticket body**: the defect, the two lines that cause it, the Q-0043 evidence, and the
insistence that the question is *what a green tick is being claimed for* rather than whether caching
is good. Its shape 1 is adopted and widened to all three tasks; its shape 2 is refuted on its own
invitation to check first; its shape 3 is rejected on cost; its fourth aside, `turbo.json`'s
`inputs`, is the successor.

**Verified against the repository while merging** rather than taken from either candidate:
`ci.yml:10` is `ubuntu-latest`; no badge markup exists in `README.md` or the numbered docs;
`turbo.json` declares no `inputs` and no `dependsOn`, four `globalDependencies`, and
`env: ["QUORUM_REAL_CLI"]` on `test`; `package.json`'s three scripts carry no `--force`; `.github`
is in `developer-generalist`'s `paths`; `packages/shared/src/project.test.ts:130` carries the
Q-0065 AC-3 block; and both suites reference out-of-package paths under `docs/`, `harness/`,
`spike/src/`, `contracts/`, `backlog/` and each other. The per-task hashed-file **counts** quoted by
the claude candidate (24 for `shared`, 56 for `core`) come from its own `turbo run test --dry=json`
and were not re-run here; the successor's implementer re-derives them rather than inheriting them,
per AC-10's rule applied to itself.

---

## Successor: draft body for the hash-input defect

Drafted in full, per the pattern Q-0065 used for Q-0070, because a deferred obligation that is only
*described* dies. Suggested id **Q-0072**; suggested title: *"Turbo's task hashes under-declare
their inputs, so a cached green survives the change that should have failed it."* M2.

> Found by Q-0071's requirements run, 2026-08-27, which correctly declined to fix it: that ticket's
> subject is CI's tick, this defect is equally present in a developer's local `pnpm test`, and the
> remedy is a decision about how this workspace declares what a task depends on.
>
> **The defect.** `turbo.json` declares **no `inputs` and no `dependsOn`**. Its only root-relative
> declarations are four `globalDependencies` — `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`,
> `vitest.shared.js`. Turbo's default input set is otherwise package-scoped, so a task's hash moves
> only when a file inside its own package changes.
>
> Both suites assert on files outside their own package. `@quorum/shared` reads `docs/02-…`,
> `docs/03-…`, `docs/04-…`, `docs/DECISIONS.md`, `docs/GLOSSARY.md`, `harness/harness.yaml`,
> `spike/src/**`, `spike/bin/harness.js`, `spike/templates/harness/harness.yaml`, and three files
> under `packages/core`. `@quorum/core` reads `docs/03-…`, `docs/04-…`, `turbo.json`,
> `contracts/Q-0006/**`, `contracts/Q-0011/**`, `backlog/Q-0006-…/ticket.md`, `pnpm-lock.yaml`, and
> several files under `packages/shared`. None of it moves a hash. **Re-derive the exact hashed-input
> set with `turbo run test --dry=json --no-daemon` before designing against it** — Q-0071's
> requirement quotes counts of 24 and 56 files from one such run and did not re-run them, and this
> repository has had three inherited measurements turn out wrong in a week.
>
> **The demonstration.** `packages/shared/src/project.test.ts:130` carries a block titled *"Q-0065
> AC-3 — the configured test command defeats this repository's cache"*, asserting that
> `harness/harness.yaml`'s `commands.test` forces turbo. `harness/harness.yaml` is not one of that
> task's hashed inputs. Delete `--force` from `harness.yaml` and the hash does not move; a cached
> `pnpm test` replays green over the guard written to catch exactly that. **Q-0065's enforcement is
> invisible to the cache it defeats.** The same is true of `packages/core/src/test-command.test.ts`
> asserting over `turbo.json` and over `spike/src/**`, and of every corpus assertion the port freeze
> depends on.
>
> **The second axis.** `turbo.json` declares no `dependsOn`, and `packages/shared/package.json`
> exports `./src/index.ts`, so `core` compiles `shared`'s source directly — yet a change in `shared`
> invalidates none of `@quorum/core`'s `test`, `lint` or `typecheck` hash. Q-0069's
> `@typescript-eslint/no-deprecated` is type-aware and reads `shared`'s declarations while linting
> `core`: a deprecation introduced in `shared` leaves `core`'s lint tick cached and green.
>
> **Why it survives Q-0071.** That ticket makes CI execute everything and `integrate` already
> forces, so both gates are honest regardless of the hashes. What remains is a developer's local
> `pnpm test`, every future path that trusts a hit, and the fact that this repository's cache
> currently means something other than what it appears to mean.
>
> **Shapes, none decided.** (1) Add the shared out-of-package corpus to `globalDependencies` — one
> place, and over-broad: any edit under `docs/` would invalidate every task in every package,
> including `lint` and `typecheck`, on a repository where `docs/` changes constantly. (2) Declare
> per-task `inputs` as `["$TURBO_DEFAULT$", …]` plus the out-of-package globs each package actually
> reads — precise, and **verify first whether turbo 2.10 accepts a `../`-escaping glob in a package
> task's `inputs` at all**; historically package inputs are package-relative and cannot escape, and
> designing around a capability that does not exist is how a chore round is wasted. (3) Add
> `dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]` for the cross-package half — standard, and
> it changes task ordering as well as hashing, so state that consequence rather than discover it.
> (4) Move the cross-tree corpus assertions into a task whose inputs can legitimately cover them —
> heaviest, and it touches landed reviewed tests in two packages.
>
> **Also decide what the cache means afterwards**, and say it where a reader meets it: after this
> ticket a hit should mean "nothing this task reads has changed", and today it means "nothing inside
> this package has changed". Those are different claims and only one of them is worth trusting.
>
> Needs its own `docs/DECISIONS.md` entry — Ruud's to write; the implementer names it. Belongs to M2.
