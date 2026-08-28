# Q-0073 — The input guard's verdict depends on checkout state

*Merged requirement · head-of-product · 2026-08-28 · judged at `b459b2c`*

## 0. What I verified before merging

The ticket's measured section says not to re-derive its table from the body, and I did not. What
follows is what I checked against the guard itself, because each fact decided something in the
merge.

**The load-bearing check is collection, and the ticket's correction 1 is right.**
`turbo-inputs.test.ts:348` — `if (!fs.existsSync(path.join(repoRoot, value))) continue;` inside
`pathLiterals` — decides whether a quoted string is a repository path at all. The
`fs.statSync(…).isDirectory()` at `:1303` only chooses which failure sentence prints. A fix aimed
at `:1303` alone moves the message and leaves the dependence.

**Four other existence checks are not the defect and must survive.** `:250` and `:261` refuse to
walk a missing corpus, `:287` refuses to run without the installed `turbo`, `:1261` refuses a
manifested read that is absent from disk. Each fails loudly, which is *"a check that skips its
subject must not report success"* (2026-08-25) working correctly. Drawing this line is most of the
work; "stop reading the filesystem" applied without it deletes four guards doing their job.

**One candidate's file paths are stale.** The two core occurrences are
`packages/core/src/fanout/fanout.source.test.ts` and `packages/core/src/git/git.source.test.ts` —
folders since Q-0064, not the flat paths the codex candidate names.

**The implementer may not write the decision entry.** `harness/roles/developer-generalist.md:23`
reads *"You do not append to docs/DECISIONS.md; a decision is the human's to record, so if your
work implies one, name it in your summary."* A criterion requiring the step to land that entry is
a surface its flow cannot write, which is what cost Q-0069 three correct refusals and an
exhaustion gate.

**The dependency question is already answered, and neither candidate had the evidence.** `git` is
invoked by the core suite's own test support today — `packages/core/test/repo.ts:28` and `:108` —
so git is already a hard requirement of running this suite, not a new one. `execFileSync` is
already imported by the guard (`:103`, used at `:290` for turbo). And the injectable-collector
seam AC-3 needs has precedent: `SourceCollector` at `packages/core/test/corpus.ts:25`, added by
Q-0064 for exactly this reason.

**Two citations, not one.** `node_modules/.bin/turbo` is named from `READ_BASES` twice — the
`packages/core/src/test-command.test.ts` entry at `:1232` and the guard's own entry immediately
below it — and both name `NOT_READ` as the answer. A shape that removes the register entry must
correct both.

**The census reproduces and its units were unstated.** `pathLiterals` builds a `Set` per file, so
the ticket's "occurrences" are per-file-distinct mentions. A raw scan gives 578 / 79 / 499 / 18
where the record says 461 / 67 / 394 / 16; the distinct counts (307 / 37 / 270 / 10 / 3) match
either way. Recorded because AC-5 is stated against those numbers and the next person to check
will otherwise think the record is wrong.

## 1. Problem

`packages/core/src/turbo-inputs.test.ts` guards what a turbo cache hit is entitled to claim. Its
clause B collects a quoted string as a repository path only when that string names something
present on disk, and classifies it as a directory only when the directory is there when the suite
runs. Two of the paths the suites name — `REPO_WORKTREE_ROOT` (`.harness/worktrees`) and
`RUN_HISTORY_ROOT` (`.quorum/runs`) — are directories **Quorum itself creates** and `.gitignore`
excludes; `git ls-files` reports zero tracked files under either.

So the guard's verdict is a function of what the checkout happens to contain:

| environment | the two directories | verdict |
| --- | --- | --- |
| a maintainer's checkout that has run a flow | present | **red — 2 failed, 49 passed** |
| a fresh `integrate` worktree | absent | green — 51 passed |
| a fresh clone (CI's shape) | absent | green — 51 passed |

Every gate this repository has runs in one of the two green rows. When Q-0072 merged, its implement
step and its `integrate` step both reported green while `main` was red for every developer, and it
surfaced only because someone re-ran the forced suite on `main` after the merge instead of trusting
`integrate`'s tick. Q-0072's DECISIONS entry says CI reported green too; the ticket's correction 2
is right that CI has never executed this code — `main` is ahead of `origin/main` and the newest run
on `main` predates the merge. The fresh-clone row is the measured proxy for CI's disk state and is
recorded as that, not as an observation of CI.

This is **Q-0071's shape inverted**. There the gates were blind because they replayed a cache; here
they are blind because they run on clean checkouts — the one condition under which the check cannot
fire. A guard that only the unguarded environment can trip is worse than no guard, because its
green is read as coverage.

Q-0072 registered the two instances in `NOT_READ` by hand after its gate. That closes those two and
leaves the class open: the next product constant naming a directory Quorum creates trips the guard
on somebody's machine and nowhere else. `NOT_READ` is the register for *a path named but never
opened*; it is not the instrument for deciding whether a literal is a path at all.

## 2. User stories

**`maintainer`** — I merge a reviewed change whose `integrate` step went green, re-run the suite on
`main`, and it fails on a file nobody in the ticket touched. I need the answer my machine gives to
be the answer the gate gave, so that a green tick at the gate means the tree is green.

**`contributor`** — I clone Quorum and `pnpm test` passes. I then run a flow to see the product
work, run the suite again, and it fails naming a constant in a package I never opened. I need a
suite whose verdict does not depend on whether I have used the product.

**`adopter`** — not affected, stated rather than omitted. This guard is Quorum's own repository test
infrastructure; it ships in no template, no `harness init` output and no command a stranger runs, so
the cold-clone path is untouched.

## 3. Surfaces

`packages/core/src/turbo-inputs.test.ts`, and `packages/core/test/` if the chosen seam needs one —
test infrastructure inside `packages`, which `developer-generalist`'s `paths` covers, which
`commitAll` does not revert, and which is not a derived copy. All three questions of *"`.claude/rules/`
is a derived copy, not a surface a requirement may name"* (2026-08-27) were asked of every surface
below, not the `backlog/` question alone.

No CLI command, no daemon, no flow, no role, no `harness/` file, no `backlog/` file, no persisted
format, no `turbo.json`, no package configuration, no `.github/`. The one conditional exception is
`docs/DECISIONS.md` under AC-11, which is a human commit and not work for a step.

## 4. The rule this ticket settles

Both candidates recommended shape (2) and left the choice to the implementer. I am deciding it
here instead, because on the recommended chore route there is no solutioning stage: an open design
question would be answered by one implementer in a worktree with no gate between it and the code,
which is the failure *"The port takes the chore route"* (2026-08-25) reserves the full SDLC for.

**Repository membership is decided from the git-tracked set, obtained once, in one place, and
injectable.** A literal is a repository path when git tracks it or tracks something below it; it
is a directory when git tracks something below it. The census is what decides this and not taste:
shape (1) — classify by the literal's role rather than by existence — must answer *is this a path?*
for **307 distinct literals** where existence currently answers it by dropping 270 of them (lint
messages, import specifiers, shell fragments, argv fixtures, prose), and doing that without a
syntax tree is the open-ended work Q-0072's erratum E-1 already refused to buy, while the parser
that would make it tractable is forbidden by AC-9. Shape (2) changes one classification site and
moves exactly **3** literals. Shape (3) is a supplement, not a fix, and AC-7 gives the drift it
worries about a louder home. Shape (4) is refused outright by AC-8: making every environment agree
by having the suite `mkdir` its own subject makes the verdict depend on a fixture rather than
removing the dependence, and gives a test a side effect on the reader's working tree.

Which git command, and how directory-ness is derived from the tracked set, remain the
implementer's call under AC-9's properties. That is implementation, not design.

## 5. Acceptance criteria

**AC-1 — Membership is decided from one inventory, not from the working tree.** Both classifying
decisions — whether a quoted literal is a repository path (`turbo-inputs.test.ts:342–352`) and
whether a collected path is a directory (`:1303`) — take their answer from a single repository
inventory obtained in one place, and neither calls `existsSync`, `statSync` or an equivalent
working-filesystem probe to decide whether a literal is in the guard's subject set. The rule can be
stated in one sentence and changed in one place.

**AC-2 — The four loud-failure checks survive, and the remaining working-tree reads are audited in
the guard.** `:250`, `:261`, `:287` and `:1261` still read the filesystem and still throw when
their subject is absent; they are byte-identical in the diff. The guard's prose states the
distinction AC-1 draws — existence used to *classify* is the defect, existence used to *refuse to
run over a missing subject* is the rule — and enumerates every remaining place the verdict could
vary with untracked state, with one sentence each on why it cannot. The known candidates are
`filesBelow`'s walks over `backlog`, `spike/src`, `harness/flows`, `harness/roles` and
`spike/templates/harness/flows`; `typescriptFiles`'s walks of both suites' sources; `reported()`,
whose input set turbo derives from an enumeration of its own; and the new inventory's failure
modes. The audit lands in the guard beside the other registers, not in the implementation summary,
which is not durable and is not read again after the gate.

**AC-3 — The property is asserted directly, and it fires in every environment.** A test runs the
clause-B classification over both suites' real sources twice, against two inventories differing
only in what an untracked working tree can add — at minimum `.harness/worktrees`, `.quorum/runs`
and `node_modules/.bin/turbo` — and requires **both the verdict and the reported occurrence list**
to be identical, not merely the same pass/fail. It is meaningful without those directories
existing, so it fires in an `integrate` worktree and on CI, which are exactly the environments
structurally blind to the defect today. This is the ticket's property stated so a machine can check
it: *the guard returns the same verdict on a clean checkout and on one that has run flows.*

**AC-4 — The classifier's subject is pinned in both directions, clause by clause.** Over a fixture:
(a) each category the existence filter excludes today stays excluded, with at least one case each
for an import specifier, a lint or diagnostic message, a shell fragment, an argument carrying an
absolute temporary path, and prose — so a rule that had started promoting every slash-containing
string fails here; (b) a tracked file and a tracked directory are still collected and are
classified as file and directory respectively — so a rule that had stopped consulting the inventory
at all fails here rather than passing quietly. Each is asserted individually, per Q-0071:
*demonstrating that a guard has a subject proves the guard fires, not that each of its clauses
does.*

**AC-5 — No unintended contraction.** The set of literals the guard collects from the two audited
suites is unchanged from the measured baseline — 37 distinct, 67 per-file-distinct — except for the
three literals the census names. Any other difference is named in the implementation summary with
its justification, and the forced core suite detects an unintended reduction.

**AC-6 — The two registered instances are closed by the mechanism, not by the register.**
`.harness/worktrees` and `.quorum/runs` are removed from `NOT_READ` (`:238–244`, entries and their
comment) and the suite is green without them, because the classifier no longer collects them. If
the implementation cannot remove them, the criterion is unmet: an entry that exists because the
mechanism cannot answer is the state this ticket exists to end.

**AC-7 — No register entry can go dead unnoticed.** A test requires every `NOT_READ` key to be a
path the classifier would still collect if a suite named it; a key the scan can no longer see fails
and is named in the message. `node_modules/.bin/turbo` is the live instance — under a tracked
inventory it becomes uncollectable — so it is either kept deterministically collectable without
consulting the working tree, or removed together with **both** `READ_BASES` citations that name
`NOT_READ` as its answer (`:1232` and the guard's own entry below it), with its intended treatment
covered by a focused test. The guard's existing self-audit — *"this file is audited by its own lists
rather than exempt from them"* — stays green, and the two must agree rather than trading one silent
gap for another.

**AC-8 — No test writes to the reader's working tree.** Any fixture that constructs checkout states
does so in a temporary directory or a disposable worktree. No test creates, replaces or deletes
`.harness/worktrees`, `.quorum/runs`, or any other artifact in the developer's checkout. This is a
criterion and not a test-implementation preference: the repository's worktree-safety property is
that nothing writes to a working tree it was not handed.

**AC-9 — Runs in a worktree, fails loudly, adds no dependency.** The guard passes from a normal
checkout, a fresh clone, and a git worktree — where `.git` is a **file**, not a directory, which is
where `integrate` runs. Any subprocess it uses is already a hard requirement of running this suite
(git is invoked today at `packages/core/test/repo.ts:28`; turbo at `turbo-inputs.test.ts:290`),
fails with a named error rather than silently yielding an empty inventory, and introduces no new
package: Q-0072 AC-11 stands unchanged, because `pnpm-lock.yaml` is a declared hashed input of the
very task under change and CI installs `--frozen-lockfile`.

**AC-10 — Verified in two real environments before the gate, forced.** `npm test --prefix spike`
and `pnpm turbo run test --force` — reporting 0 cached — pass (a) on a checkout where
`.harness/worktrees` and `.quorum/runs` exist and (b) in a fresh worktree where they do not. Both
pass/fail counts are recorded in the ticket's record. Stated as a criterion because the gate's own
`integrate` runs in row (b) and therefore cannot see the class this ticket closes.

**AC-11 — Failure stays actionable, and a decision is a human commit.** A failure names the source
file and the literal; the directory-specific explanation may be retained where directory-ness is
determined deterministically, and correctness must not depend on which message variant prints. If
the implemented rule changes what the guard *claims* about a literal — from *"names something on
disk"* to *"names something git tracks"* — a `docs/DECISIONS.md` entry lands with the change as a
**human commit at or before the gate**; `harness/roles/developer-generalist.md:23` forbids the step
from appending to that file, so the step's obligation is to name the decision in its summary and
nothing more.

## 6. Non-goals

- **Rewriting clauses C1–C4 or their registers.** `INDIRECT_ROUTES`, `ROOT_DERIVATIONS`,
  `ESCAPING_LITERALS`, `READ_APIS` and `READ_BASES` are out of scope except for the `NOT_READ`
  citations AC-7 requires corrected.
- **Widening what the guard covers.** No new manifest entry, walk or read. This ticket makes an
  existing verdict stable; it does not make it stricter, and it does not audit all 307
  syntactically path-shaped literals as filesystem inputs.
- **Redesigning the guard around data-flow or role analysis** — shape (1), refused in §4.
- **Creating `.harness/worktrees` or `.quorum/runs` before every run** — shape (4), refused by AC-8.
- **Auto-registering every exported constant from `packages/shared/src/constants.ts`** — shape (3);
  narrow, and it does not stop a directory literal appearing anywhere else.
- **Fixing only the two known instances.** Registering them is what Q-0072 already did.
- **Changing what `NOT_READ` means.** It remains the register for a path deliberately named and
  never opened.
- **The residual limits erratum E-1 stated.** The subprocess-read gap (limit 1) and the finite
  `READ_APIS` list (limit 5) stay open and registered, exactly as they are.
- **Any turbo or CI configuration.** `turbo.json`, both package configurations,
  `.github/workflows/ci.yml`, `package.json`'s scripts and `harness/harness.yaml`'s `commands.test`
  are untouched. No claim is made that CI observed the original defect.
- **Q-0072's two successors.** Successor A (a temp-workspace fixture proving the escaping-input
  configuration through a real cache on CI's Linux checkout) and successor B (whether CI and a
  developer's `pnpm test` should be one command) are separate tickets and are not started here.
- **`constants.ts` and `constants.test.ts`.** The constants and their assertions are correct; the
  guard is what is wrong. Renaming or relocating a constant to dodge the guard is refused.
- **Product behaviour.** Nothing in `core`, `shared` or `spike` outside test support changes, so the
  port's freeze and *"The port preserves behaviour"* (2026-08-25) are not engaged. No adapter
  contract, public API, command output, persistent format, schema, gate policy or cross-vendor rule
  moves, and nothing is added to the cold-clone path.

## 7. Open questions — none blocking

**OQ-1 — which git command, and how directory-ness is derived. Owner: implementer.** Not blocking:
§4 fixes the rule, AC-9 fixes its properties, and this is implementation. `git ls-files` reflects
the index, so a developer who has staged a new file gets it counted; turbo's own enumeration is
circular here, since the guard would be classifying by the thing it exists to check.

**OQ-2 — a repository exported without git, or a sparse checkout. Owner: implementer, answered in
the guard's prose.** Recommendation: accept and fail loudly, matching every corpus reader in both
packages. A sparse checkout can track a path that is absent from disk; under AC-1 that literal is
collected, which is the safe direction — the guard asks more, not less.

**OQ-3 — is the `backlog` walk a second instance? Owner: implementer, under AC-2's audit.**
`filesBelow('backlog')` collects any untracked `<id>/ticket.md` a `/ticket` invocation has just
created, and its coverage answer then depends on turbo's own enumeration of untracked files. It is
probably benign — both package configurations declare `../../backlog/*/ticket.md` as a glob — but
AC-2 requires it checked rather than assumed. **If it is a genuine second instance, split it into
its own ticket rather than absorbing it here.** This requirement is one classification rule.

**OQ-4 — chore or full SDLC? Owner: human, before the run.** Recommendation **chore**. A red phase
could technically exist — AC-3's property test fails today — but the full SDLC would hand
`automation-qa` the job of writing the very test that is this ticket's deliverable, putting one file
under two owners, which is what *"every file a red test requires must be owned by exactly one
task"* (2026-08-23) exists to prevent. It also matches the measured cost: $26–37 against $350–550.
**Operational prerequisite, because it has cost money twice:** `harness/Q-0073/integration` must be
created by hand before the first chore run, since `review` diffs against a branch only `integrate`
creates.

## 8. Risks

1. **The gate cannot see this defect class, including for its own fix.** `integrate` runs in a
   fresh worktree — row (b) — so the blindness this ticket closes applies to the run that closes
   it. Mitigated twice: AC-3 makes the property checkable *without* the environment varying, and
   AC-10 requires the two-environment run before the gate. Third time in this series that a
   ticket's subject has appeared inside the instrument built to enforce it.
2. **Review-loop cost, on the file with the worst precedent in the repository.** Five implement
   rounds and $95.78, four correct and different majors, ended only by two errata. A finding
   against this ticket's addition is a blocker or a major only if it **demonstrates** two
   inventories or two environments producing different verdicts or different occurrence lists; an
   unenumerated way a verdict could theoretically vary, named without a demonstration, is a nit.
   Q-0072's errata E-1 and E-2 continue to govern the clauses they bound and nothing here reopens
   them. Written into the requirement because a review loop cannot decide for itself when a guard
   is finished and must be told.
3. **The failure direction inverts, and the new one is the safer half.** Under a tracked inventory
   a literal naming a genuinely new file the author has not yet staged is dropped, so a
   pre-`git add` local run under-collects. At the gate and on CI the file is tracked, collected and
   must be declared — so the gate becomes the stricter of the two, the exact inverse of today,
   where the developer is stricter than the gate and the gate is the one that merges. AC-2's audit
   should say this in the guard's own prose.
4. **A dead register entry trades one silent gap for another.** `node_modules/.bin/turbo` is cited
   twice and the guard's self-audit requires every path the guard itself names to appear in one of
   the three lists. AC-7's dead-entry check and that self-audit must agree.
5. **Platform variation.** Fixtures should avoid platform-specific separators and must exercise the
   git-worktree metadata layout (`.git` as a file), or the guard becomes deterministic on one
   operating system and not another.

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable. `check()` and the three refused key names are untouched; nothing added introduces a secret input path. |
| **Worktree safety** | Engaged, and it is AC-8: no test writes to the reader's checkout, which is also why shape (4) is refused. |
| **Gate behaviour** | Unchanged. AC-10 adds a verification the human performs before the gate, not a new gate or a new answer. |
| **File format and schema** | Nothing persisted changes. `constants.ts`'s exported values are untouched, so no consumer, contract or frozen schema moves. |
| **Lint rules** | No `lintFlow` rule and no ESLint rule changes; Q-0069's single type-aware rule stays the only one and covers the new test code. |
| **Cold-clone impact** | None. Repository-internal test infrastructure. |
| **Product-agnostic** | Satisfied; no SaaS product is named. |
| **Vocabulary** | No new term. "Guard", "clause" and "register" are the guard file's existing local vocabulary, not additions to `docs/GLOSSARY.md`. |

## 10. Provenance

**From the ticket's own measured section, kept by both:** the three-environment table, the causation
isolation, correction 1 (collection, not directory classification) and correction 2 (CI has never
run this code), and the census that decides shape (1) against shape (2).

**From the claude candidate:** the distinction between existence used to *classify* (the defect) and
existence used to *refuse to run over a missing subject* (the rule), which is the spine of AC-1 and
AC-2 and which the codex candidate's blanket "no filesystem-existence decision" would have broken;
the four loud-failure line references; the durable in-guard audit rather than an implementation
summary; the correct post-Q-0064 file paths; the pre-bounded review loop, now risk 2; the
recognition that the decision entry is a human commit; the `SourceCollector` seam precedent; and the
surface check performed against all three questions rather than the `backlog/` one.

**From the codex candidate, five things the claude candidate lacked:** fixture isolation as an
acceptance criterion rather than a non-goal (AC-8); negative fixtures for each category the
existence filter excludes today, which is what stops a fix from over-collecting (AC-4a); the
no-contraction regression against the baseline (AC-5); comparing **reported occurrences** and not
only pass/fail, without which both environments could agree by skipping the same subjects (AC-3);
and the git-worktree `.git`-is-a-file hazard, which matters precisely because `integrate` runs there
(AC-9). Its explicit either/or resolution of `node_modules/.bin/turbo` also sharpened AC-7.

**Struck.** Codex's AC-13, AC-14 and AC-15 — BYOS, safety, "other product invariants" — are a
checklist rather than independently testable criteria; the substantive half of AC-14 became AC-8 and
the rest is §9. Codex's AC-12 required the implementer to land a `docs/DECISIONS.md` entry, which
`developer-generalist.md:23` forbids: AC-11 makes it a human commit and leaves the step with naming
it. Codex's AC-5 referred findings to "the ticket's solution", which the recommended chore route
does not produce; retargeted to the implementation summary. Codex's stale flat paths for
`fanout.source.test.ts` and `git.source.test.ts` are corrected. Claude's separate audit criterion
was folded into AC-2 so that criterion does real work rather than only forbidding a diff.

**Decided rather than averaged.** Both candidates left the shape to the implementer. §4 settles it,
because the recommended chore route has no solutioning gate and the census plus Q-0072 AC-11's
standing dependency ban already determine the answer. What remains open — which command, how
directory-ness is derived — is implementation and is bounded by AC-9.

**Size.** Eleven criteria, each independently testable, within the ten-to-fifteen rule. The
codex candidate's fifteen included three that were not criteria; the merge is not a trim of either
document but a re-cut of both.
