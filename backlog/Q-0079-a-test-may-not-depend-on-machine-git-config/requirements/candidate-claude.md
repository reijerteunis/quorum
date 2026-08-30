# Q-0079 — A test may not depend on the machine's git configuration

*Requirements, candidate (claude), 2026-08-30. Iteration 1.*

---

## Problem

Three times in three days, a test in this repository has asserted over a property of the machine
running it rather than a property of the commit under test. Each instance passed implement, a
review, `integrate`'s `tests=ok`, and at least one hand verification, and each was found only after
merging. The `maintainer` therefore cannot read a green tick as "this commit is sound"; they can
only read it as "this commit is sound *here*", and the difference is invisible at the moment the
gate is answered.

The ticket asks for a guard. Before designing one, this requirement made the measurement the ticket
asked for rather than inheriting the belief that no local reproduction exists. **That belief is
false, and disproving it changed the shape of the answer twice.**

### Measurement 1 — a discriminating local reproduction exists

Measured on git 2.55.0, macOS 25.3.0, in throwaway repositories. "unfixed" is `git commit -q -m m`;
"fixed" is `git -c user.email=q@a -c user.name=qa commit -q -m m`.

| row | environment | unfixed | fixed |
| --- | --- | --- | --- |
| A | ambient (this machine) | **PASS** — `Ruud <info@ruud.tech>` | PASS — `qa <q@a>` |
| B | `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null` | **PASS** — `Ruud van Engelenhoven <ruudvanengelenhoven@Ruuds-MacBook-Pro.local>` | PASS |
| C | `user.useConfigOnly=true` alone | **PASS** — `Ruud <info@ruud.tech>` | PASS |
| D | B **and** C together | **FAIL** — `Author identity unknown` | **PASS** |
| E | `GIT_COMMITTER_NAME=` | — | **FAIL** — `fatal: empty ident name (for <q@a>) not allowed` |

Row **D** discriminates, and is the environment this requirement builds on:

```
GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.useConfigOnly GIT_CONFIG_VALUE_0=true
```

Both of the ticket's failed attempts are explained rather than merely repeated. Row **B** is the
first: emptying the config files leaves macOS deriving a name from the OS user record, so the
unfixed shape still passes — the ticket's observation, confirmed, and the committer string above is
the evidence. Row **E** is the second: `GIT_COMMITTER_NAME` is an environment variable and beats a
`-c` flag, so it breaks the *fixed* shape and discriminates in the wrong direction. Row **C** is the
trap between them: `user.useConfigOnly` alone changes nothing here, because this machine's global
config genuinely supplies an identity — it forbids *inference*, not *configuration*. Only the
conjunction models a bare Linux runner.

### Measurement 2 — the class is not closed; three live instances are on `main` today

Running the real suites under row D:

| suite | ambient | hostile (row D) |
| --- | --- | --- |
| `@quorum/core` (vitest) | 956 passed, 2 skipped | **956 passed, 2 skipped — clean** |
| `spike` (16 files) | all pass | **2 of 16 files failed, 8 scenarios** |

The eight failures come from three source lines, all `git merge -q --no-ff` with no identity, all
reporting `Committer identity unknown`:

| site | scenarios it fails |
| --- | --- |
| `spike/test/q0035-empty-range.js:74` | E1 |
| `spike/test/q0035-empty-range.js:191` | E6 |
| `spike/test/q0077-base-flag.js:52` | B1–B6 (it is inside the shared `contained()` fixture) |

These are the ancestors of the three sites `cf3b2e6` fixed: `diff.test.ts` was ported from
`q0035-empty-range.js`, and the port carried the defect forward while leaving the original in place.
The ticket's instruction not to treat `diff.test.ts`'s correctness as evidence the class is closed
was right, and this is the proof.

### Measurement 3 — CI cannot see them, because CI supplies the missing identity

`.github/workflows/ci.yml`'s `spike` job runs, before the suite:

```yaml
- run: |
    git config --global user.email "ci@quorum.invalid"
    git config --global user.name "Quorum CI"
```

Its stated justification — *"The suite drives the engine, which commits worktrees with the ambient
git identity"* — is stale. The only commit-creating call in either production tree is
`spike/src/fanout.js:92` / `packages/core/src/fanout/fanout.ts:290`, and both carry
`-c user.email=harness@local -c user.name=harness`; `fanout.js:112` / `fanout.ts:313` do the same on
their merges. Nothing under `spike/bin` or `packages/cli/src` creates a commit at all. On the
evidence of measurement 2 — where the *only* hostile failures are the three fixture lines — that
step is now masking exactly this class and nothing else.

### The correction that matters most: there is no strict environment

The ticket's decision 3 proposes "a job that runs the suite under a deliberately hostile git
configuration and an empty checkout", on the reasoning that this catches all three instances by
construction. **It does not, and the reason is worth stating plainly, because it is the shape the
class actually has.**

Instance 3 is strict on a bare Linux checkout and permissive on a developer's machine. Q-0072's
instance 1 is the exact inverse: `turbo-inputs.test.ts` clause B only saw a directory literal when
the directory existed, and `.harness/worktrees` and `.quorum/runs` exist on a working checkout and
in neither a fresh worktree nor a fresh clone — so *implement, `integrate` and CI all reported green
while `main` was red*. There, the empty checkout was the **permissive** side and a human's populated
working tree was the strict one.

Laying the two axes out shows the hole:

| | identity present | identity absent |
| --- | --- | --- |
| **bare checkout** | CI `spike` job — the most permissive cell of the four, which is where the three live sites hid | CI `workspace` job — strict for instance 3 |
| **populated checkout** | a developer's machine — strict for instance 1, and covered only by a human's discipline | **nothing covers this** |

So the property to assert is not "the suite passes in the hostile environment". It is **the verdict
is the same in both environments** — which is precisely what Q-0073 already did for one guard, by
making the file inventory injectable and running clause B over two inventories
(`turbo-inputs.test.ts:1682–1687`). That existing code is the pattern; this ticket generalises it
and gives it the one instrument injection cannot reach, because git's identity resolution happens
inside a child process rather than in our own code.

---

## User stories

**`maintainer`** — As the maintainer, when a gate reports green I want that to mean the commit is
sound in every environment the project supports, not only in the one I happen to be sitting in, so
that answering a gate is not an act of faith about my own `~/.gitconfig`.

**`maintainer`** — As the maintainer, when a test does depend on a machine property, I want the
failure to name the dependence at the line that causes it, before the merge, rather than as
`Committer identity unknown` inside a fixture on a runner three hours later.

**`contributor`** — As an adapter contributor whose Linux machine has no global git identity, I want
`pnpm test` and `npm test --prefix spike` to pass on a clean clone, so that my first contribution is
not a red suite I did not cause and cannot diagnose.

**`adopter`** — As a cold-clone adopter, I want none of this to lengthen my first 30 minutes: the
environment sweep is CI's and an opt-in local command, never something I must understand to run
`npx quorum`.

Surfaces touched: **`.github/`** (the workflow and one shared script), **`packages/`** (one guard
and one `turbo.json` declaration), **`spike/test`** (three fixture lines), **`harness/rules.md`**,
and root `package.json`. The CLI surface, the daemon and every flow file are untouched.

---

## The rule this ticket establishes

> **A test's verdict must be a function of the commit under test, not of the checkout it runs in or
> the account it runs as.**

Instances 1 and 2 are *the checkout*; instance 3 is *the account*. This one sentence is what the
three instances share, and it is what the ticket asked to be named — the shape rather than a
mechanism.

The line the rule draws, stated as two lists so it can be applied without judgement:

**A test may read** — the tracked-and-unignored inventory (`git ls-files --cached --others
--exclude-standard`, per *"Membership is a git question, not a filesystem one"*, 2026-08-28); its
own package's files; `os.tmpdir()`; the `git` binary's presence and its own output; a repository it
built itself; a `PATH` shim it installed itself; environment variables it set itself through
`withEnv` (`packages/core/test/env.ts`).

**A test may not let its verdict depend on** — git's identity resolution (`user.name`, `user.email`,
and the OS-user-record fallback); any other value from the global or system git config
(`init.defaultBranch`, `core.autocrlf`, `commit.gpgsign`, `merge.ff`, `pull.rebase`); the existence
of a gitignored directory that use creates (`.harness/worktrees`, `.quorum/runs`, `node_modules`);
the untracked or ignored contents of the working tree; the operating system's user name, host name
or locale.

**Three uses of a machine property, and only one is the defect** — this is the ticket's decision 4,
and Q-0073 already ruled half of it:

1. **As a fixture input** — building a temp repository, choosing a temp path. Correct, unrestricted.
2. **To refuse to run** — `repoFile`'s `existsSync` throwing `corpus missing: …`, and the four
   checks Q-0073 deliberately left alone. Correct, and required by *"a check that skips its subject
   must not report success"* (2026-08-25). A criterion of this ticket may not touch them.
3. **To decide a verdict** — the defect. Existence used to *classify*, an identity resolved from
   the account, a directory listing used as an oracle.

A deliberate violation is entered in a register with a per-entry reason, in the shape
`turbo-inputs.test.ts`'s `NOT_READ` established: *a list a reviewer must approve rather than a
pattern that quietly excuses a class*.

---

## Acceptance criteria

**AC-1 — The three live sites carry an identity, and no fourth survives.**
`spike/test/q0035-empty-range.js:74`, `:191` and `spike/test/q0077-base-flag.js:52` each pass
`-c user.email=q@a -c user.name=qa` before `merge`, matching the file's own `commit()` helper. The
audit is by execution and not by reading: after the change, the full spike suite passes under the
row-D environment with no global identity available. *Test:* `npm test --prefix spike` under the
AC-2 environment reports 16 of 16 files passing.

**AC-2 — The hostile environment is defined once, in a file both CI and a developer run.**
The four variables of row D live in exactly one place, `.github/scripts/` beside the existing
`port-freeze-guard.sh`, and both callers invoke that file rather than restating it. A definition
copied into `ci.yml` and into a `package.json` script is refused: the two would drift, and a
developer would then be unable to reproduce what CI claims. *Test:* the variable names appear in
exactly one tracked file outside this requirement and its guard.

**AC-3 — The environment proves itself before it certifies anything.**
Before running either suite, the script demonstrates that its own environment discriminates: an
identity-less commit in a throwaway repository must **fail**, and the same commit with explicit
`-c` flags must **succeed**. If either probe comes out the other way, the script exits non-zero
naming which probe broke, and runs no suite.

This is the highest-value criterion in the ticket and it is not defensive padding. Every mechanism
here rests on git 2.55's treatment of `user.useConfigOnly` and on `GIT_CONFIG_COUNT` not being
outranked by a `-c` flag. A git upgrade, a runner image that ships a system-level identity, or an
action that runs `git config --global` in an earlier step each turn this job permissive — and a
permissive job reports **green over everything**, which is this repository's recurring failure in
its purest form (*"skipped is not passed"*, 2026-08-25; *"a check is not established by reading
it"*, 2026-08-29). The environment is a check, so it must have a subject.
*Test:* two probes, each asserted in both directions, exercised by `port-freeze-guard.test.mjs`'s
sibling.

**AC-4 — CI's `spike` job stops supplying a global identity.**
The `git config --global` step is deleted, and the comment above it is replaced by one naming what
is true now: the engine's own commits carry explicit `-c` flags (`spike/src/fanout.js:92`, `:112`),
so nothing in the suite needs an ambient identity once AC-1 lands. This moves the spike suite out of
the most permissive cell of the four and is what makes every future push able to see instance 3.
*Test:* the string `user.email` does not appear in `ci.yml` outside the AC-5 job's script
invocation; the `spike` job is green on a runner with no global config.

**AC-5 — CI covers the populated checkout, which nothing covers today.**
One new job creates `.harness/worktrees/` and `.quorum/runs/` in the checkout — the two directories
Q-0072 registered by hand in `NOT_READ` — and runs both suites twice: once under the AC-2
environment and once with a configured identity. Together with AC-4 this leaves three of the four
cells covered on every push. The fourth, *bare checkout with an identity present*, is deliberately
uncovered and the reason is written in the job's comment: a defect visible only there is one where
*having* an identity breaks a test, a different and much rarer shape, and covering it costs a fourth
run for no measured instance. *Test:* the job is red before AC-1 lands and green after; the
uncovered cell is named in the file rather than left to be inferred.

**AC-6 — A maintainer runs any cell with one command.**
Root `package.json` gains a script that invokes the AC-2 file, so `pnpm <script>` locally is
byte-identically what CI runs. `pnpm test` and `npm test --prefix spike` are unchanged and stay
unforced and ambient — a developer's ordinary loop does not get slower, which is where a cache and a
warm config earn their keep (*"The test command defeats its own cache"*, 2026-08-27).

**AC-7 — A commit-creating git subcommand in a test carries an explicit identity, or is registered.**
A guard under `packages/core/src/` scans every file in `packages/**/*.test.ts`, `packages/*/test/**`
and `spike/test/*.js`, and fails when a git invocation names one of `commit`, `commit-tree`,
`merge`, `cherry-pick`, `revert`, `rebase`, `am`, `stash` (push/save/create), `notes`, or `tag` with
`-a`/`-s`/`-m`, without `-c user.email=…` and `-c user.name=…` on the same invocation.

`packages/*/test/**` is in the corpus deliberately and is not an afterthought: `packages/core/test/
repo.ts` holds two of the repository's commit sites and the comment that already states this rule
in prose — *"An identity is passed per invocation so the suite does not depend on the machine's git
config."* A guard whose corpus excluded non-`.test.ts` helpers would miss the file that documents
the rule it enforces.

**AC-8 — The guard's exemptions are the ones this repository actually uses, and each is
demonstrated firing.**
`merge --abort` (three sites: `fanout.ts:317`, `fanout.test.ts:415`, `spike/src/fanout.js:116`) and
a lightweight `tag` (`git.test.ts:305`, `q0036-board-containment.js:212`) create no commit and need
no identity — both are confirmed by measurement 2, where the core suite passed hostile with all five
present. `rebase`/`am` with `--abort`/`--continue`/`--skip` and `stash list`/`show`/`drop`/`pop`/
`apply`/`clear` are exempt on the same reasoning. Each exemption is exercised by a fixture that
would trip the guard without it — *demonstrating that a guard has a subject proves the guard fires,
not that each of its clauses does* (Q-0071).

**AC-9 — The guard fails closed and its register cannot rot.**
It names its corpus and refuses an empty or implausibly small one rather than reporting a pass over
nothing; every register entry is asserted to still be a site the scan would collect, so an entry
that stops matching is reported rather than left excusing nothing (Q-0073's finding, where
`node_modules/.bin/turbo` became uncollectable on day one); and its doc comment states its own
limit — **it sees literals only**. A subcommand held in a variable, or reached through a helper
called with a computed argument, is invisible to it, which is the C1/C4 lesson from
`turbo-inputs.test.ts` arriving before the guard is written rather than four review rounds into it.
That limit is why the scan is the tripwire and AC-3–AC-5 are the oracle, and the comment says so.

**AC-10 — The guard's out-of-package reads are declared.**
`packages/core/turbo.json` gains `../../spike/test/**` (and `../../.github/scripts/**` if a
criterion asserts over the script), and `turbo-inputs.test.ts` stays green without a new `NOT_READ`
entry. The accepted cost is stated in the declaration's comment: seventeen spike test files now
invalidate `@quorum/core#test`, which is correct under *"A cache hit names what the task reads, not
what its package contains"* (2026-08-28) and will cost re-runs.

**AC-11 — The rule is written once, and no vocabulary is invented.**
`harness/rules.md` gains one paragraph under *Language and tests* carrying the rule sentence, the
two lists, and the three-uses distinction, citing the decision entry by title and date rather than
transcribing it. `docs/04-architecture.md` §Testing strategy gains one sentence on what the new job
claims, in the register the Q-0071 and Q-0072 sentences beside it already use. **No `GLOSSARY.md`
term is added** — the glossary is product vocabulary (harness, flow, gate, adapter), and an
engineering rule about tests belongs in `harness/rules.md`; this is ruled here so an implementer
does not add one on the grounds that a new noun appeared. `.claude/rules/` is not named by any
criterion: it is a derived copy (2026-08-27), and naming it is the Q-0069 AC-11(b) failure.

**AC-12 — Verification is performed in both environment rows, forced.**
Per Q-0072's closing finding, both suites are run forced in the `integrate` worktree — which has
neither `.harness/worktrees` nor `.quorum/runs` — and again on `main` after the merge, where both
exist. A tick from one row is not evidence for the other, and on this ticket of all tickets it
cannot be.

---

## Non-goals

- **Not `cf3b2e6`.** `diff.test.ts`'s three `merge` calls are correct and are not touched.
- **Not Q-0073's four refusing existence checks.** Use (2) above is correct and pinned; a criterion
  that deleted one would remove a guard doing its job.
- **Not the allocator.** `spike/src/backlog.js:51` returning `T-0001` for every id is real, is on the
  cold-clone path, and wants its own ticket. It is named in the ticket body so it does not expire and
  is out of scope here.
- **Not a general environment-isolation framework.** Nothing sandboxes `HOME`, containerises the
  suite, or intercepts `execFileSync`. The rule plus two instruments is the whole of it.
- **Not the product's own commit identity.** Whether `fanout.ts:290` pinning `harness@local` is the
  right thing for a user's repository is a product question, raised as OQ-3.
- **Not `harness.yaml`'s `commands.test`.** See OQ-2 — recommended against, with reasoning.
- **Not Windows.** Windows beyond WSL is a v1 non-goal (`04-architecture.md`), so the matrix stays
  POSIX, as `installGitShim` already assumes.
- **Not a fourth CI cell.** Bare checkout with an identity present is deliberately uncovered (AC-5).

---

## Open questions

**OQ-1 — the decision entry (BLOCKING, owner: human, at the requirements gate).**
This ticket establishes a repository-wide rule and rules on four design questions, so it owes a
`docs/decisions/` entry. **The implementer may not write it**: `harness/roles/developer-generalist.md`
says *"You do not add to docs/decisions/ or its index; a decision is the human's to record."* This is
the precondition-external-to-the-document shape that exhausted Q-0070's loop at a limit of 1, so it
is named here rather than asserted, and AC-11 requires the rules text to *cite* an entry rather than
create one. Proposed title: ***"A test's verdict is a property of the commit, not of the checkout or
the account"* (2026-08-30)**. It must record: the rule sentence; the four-cell table and the finding
that no single environment is strict; the ruling that both instruments ship with the runtime oracle
primary; and the three-uses distinction that extends Q-0073's refuse/classify ruling with the
fixture-input case. If the human rules differently on scan-vs-job, AC-7 to AC-10 fall and the rest
stands.

**OQ-2 — should `harness.yaml`'s `commands.test` carry the hostile environment, so `integrate` is
the gate rather than CI?** *Recommendation: no.* It would move detection before the merge, which is
attractive — instance 3 passed `integrate`. But `commands.test` is what every ticket's `integrate`
runs, so it would make an unrelated ticket's gate red for a hazard its author did not introduce and
cannot see in their own diff, and it reverses part of *"The test command defeats its own cache"*
(2026-08-27) by adding a second reason that command differs from `package.json`'s. AC-7's scan runs
inside the ordinary suite and therefore *does* fire at `integrate`, which buys most of the benefit
at none of the cost. Revisit if a fourth instance lands that the scan cannot see.

**OQ-3 — should the engine ever commit with an ambient identity?** `fanout.ts:290`/`:313` pin
`harness@local`, so a user's harness commits are not attributable to them. That may be right (the
harness made the commit, not the human) or wrong (a merged branch's history reads as a robot's).
Out of scope; named so the observation does not expire.

**OQ-4 — does the populated-checkout job need `node_modules` present or absent as a third axis?**
Probably not: `pnpm install` creates it in every cell. Named because `harness/rules.md` already
records that an agent's worktree has no dependencies until it installs them, which is the same
class of surprise.

**OQ-5 — is `spike/test/**` the right turbo declaration, or should the guard read the spike corpus
through a narrower glob?** AC-10 takes the broad declaration because over-declaring costs a re-run
while under-declaring costs a silent cache hit. Flagged for the reviewer to disagree with.

---

## Risks

**R-1 — the hostile environment silently stops being hostile.** The single largest risk, and the
reason AC-3 exists. A git upgrade, a runner image with a system identity, or a `git config --global`
in an earlier step turns the job permissive, and a permissive job is green over everything. AC-3's
self-proof is the mitigation and must not be traded away for brevity.

**R-2 — the scan is trusted past its limit.** It sees literals. A reader who takes a green scan as
"no test depends on git identity" is over-reading it exactly as a reader took `integrate`'s
`tests=ok` for instance 3. AC-9 puts the limit in the guard's own doc comment, where the next person
to extend it will read it.

**R-3 — removing the spike job's identity (AC-4) breaks something this measurement did not reach.**
The census found no other commit path in `spike/src`, `spike/bin` or `packages/cli/src`, and the
hostile run's only failures were the three fixture lines — but the spike suite drives the engine
through many paths and one may commit through a route the grep missed. If so the job goes red
loudly, in CI, before a merge, which is the correct outcome and not a regression.

**R-4 — the register becomes a rubber stamp.** `NOT_READ` works because each entry carries a reason
a reviewer approved. A register that accumulates entries with `// legacy` is worse than no register,
because it reads as coverage.

**R-5 — CI cost.** One new job with two suite runs, roughly doubling the wall-clock of a push's test
coverage. Judged worth it: CI is this project's only automated verdict, and three instances in three
days is the measured failure rate the cost is bought against.

**R-6 — the guard's corpus and the port.** `spike/test` is written by the tooling role and
`packages/core` by both; while Q-0009's port is in flight, a guard spanning both trees will report on
files two roles own. Q-0079 is not among the port charter's fourteen children
(`harness/port-charter.md:242` lists Q-0041–Q-0054), so the freeze does not bind it — the Q-0038 and
Q-0057 precedent — and it touches `spike/test`, not `spike/src`, in any case.

---

## Cross-cutting checklist

- **BYOS** — n/a. No criterion introduces a key, a token or a credential path. The hostile
  environment sets git config variables only.
- **Worktree safety** — n/a to the product; relevant to the verification. AC-5 creates
  `.harness/worktrees/` and `.quorum/runs/` **in the CI checkout**, never in a user's working tree,
  and no flow writes them. AC-12's `integrate`-worktree row is required precisely because that
  worktree is the environment the gate reads from.
- **Gate behaviour** — unchanged. No flow file, loop bound, `on_exhausted` or gate kind is touched.
  OQ-1 is a precondition answered *at* the requirements gate, not a change to how gates work.
- **File format and schema** — none. No ticket, flow, role, manifest or contract schema changes; no
  zod schema in `packages/shared` is added or altered.
- **Lint rules** — none added. AC-7's guard is a Vitest suite, not an ESLint rule: it must read
  `spike/test/*.js`, and `spike/**` is outside ESLint's scope entirely (Q-0069), so a lint rule could
  not see two thirds of its subject.
- **Cold-clone impact** — neutral to positive. `pnpm test` and `npm test --prefix spike` are
  unchanged; the new command is opt-in and named in no README step. The `contributor` on a Linux
  machine with no global identity is strictly better off after AC-1, because the spike suite passes
  on their clean clone for the first time.
- **Product-agnostic** — yes. Nothing names a SaaS product.
- **Vocabulary** — "job" throughout refers to a GitHub Actions job, never to a flow **step**; no
  glossary term is added (AC-11).
