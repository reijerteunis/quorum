# Q-0073 — The input guard's verdict depends on checkout state

*Requirements candidate · product-manager · 2026-08-28 · written at `b459b2c`*

## 0. What I re-derived, and what it changes

The ticket says *"do not re-derive it from this body"*, so every number below was recomputed
against the real guard rather than read from the record.

**The census reproduces exactly, and its units were unstated.** Scanning both audited suites'
sources (`packages/{shared,core}/{src,test}/**/*.ts`, the guard file itself excluded exactly as
clause B excludes it) through `pathLiterals`'s own three syntactic filters:

| | ticket's figure | recomputed | raw occurrences |
| --- | --- | --- | --- |
| candidates | 461 / **307** distinct | 461 / **307** | 578 |
| collected, because they exist here | 67 / **37** | 67 / **37** | 79 |
| dropped, because they do not | 394 / **270** | 394 / **270** | 499 |
| collected and classified as a directory | 16 / **10** | 16 / **10** | 18 |
| on-disk state diverges from git | 7 / **3** | 7 / **3** | 7 |

Every distinct count matches. The middle column matches too, once you know what it counts:
`pathLiterals` builds a `Set` **per file**, so the ticket's "occurrences" are per-file-distinct
mentions, not raw ones. Recorded here because the raw scan gives 578 / 79 / 499 / 18, and the next
person to check this will get those numbers and think the record is wrong. It is not.

The three divergent literals are exactly the ones named: `.harness/worktrees` (in
`packages/shared/src/constants.ts`, `constants.test.ts`, `packages/core/src/git/git.source.test.ts`,
`packages/core/src/fanout/fanout.source.test.ts`), `.quorum/runs` (both `shared` files) and
`node_modules/.bin/turbo` (`test-command.test.ts`). Of the ten directories the guard collects
today, eight — `harness/flows`, `harness/roles`, `packages/core`, `packages/core/src`,
`packages/shared`, `packages/shared/src`, `spike/src`, `spike/templates/harness/flows` — hold
tracked files and exist in every checkout. Two do not, and they are the defect.

**Both of the ticket's corrections hold, and correction 1 has a consequence the body does not
draw.** The guard performs six existence checks, and they are two different things:

- **Classification — the defect.** `turbo-inputs.test.ts:348` decides whether a quoted string *is a
  path at all*; `:1303` decides whether a collected path is *a directory*. Both read the working
  tree, and both change their answer with it.
- **Refusing to run over a missing subject — the repository's own rule, and not the defect.**
  `:250`, `:261`, `:287` and `:1261` fail loudly when a corpus directory, a walk target, the
  installed `turbo` or a manifested read is absent. That is *"a check that skips its subject must
  not report success"* (2026-08-25) working correctly, and it must survive this ticket untouched.

Drawing that line is most of the work, because "stop reading the filesystem" applied without it
would delete four guards that are doing their job.

**Correction 2 is now stronger than when it was written.** `main` is 15 commits ahead of
`origin/main`; no CI run has executed this code. The fresh-clone row was measured on a fresh clone,
which is the same disk state, and it is honest to keep saying so.

---

## 1. Problem

`packages/core/src/turbo-inputs.test.ts` guards what a turbo cache hit is entitled to claim. Its
clause B collects a quoted string as a repository path only when that string names something
present on disk, and classifies it as a directory only when the directory is there when the suite
runs. Two of the paths the suites name — `REPO_WORKTREE_ROOT` (`.harness/worktrees`) and
`RUN_HISTORY_ROOT` (`.quorum/runs`) — are directories **Quorum itself creates** and `.gitignore`
excludes. `git ls-files` reports zero tracked files under either.

So the guard's verdict is a function of what the checkout happens to contain:

| environment | the two directories | verdict |
| --- | --- | --- |
| a maintainer's checkout that has run a flow | present | **red** |
| a fresh `integrate` worktree | absent | green |
| a fresh clone (CI's shape) | absent | green |

Every gate this repository has runs in one of the two green rows. When Q-0072 merged, its implement
step, its `integrate` step and CI all reported green while `main` was red for every developer, and
it surfaced only because someone re-ran the forced suite on `main` after the merge instead of
trusting `integrate`'s tick.

This is **Q-0071's shape inverted**. There the gates were blind because they replayed a cache; here
they are blind because they run on clean checkouts — the one condition under which the check cannot
fire. A guard that only the unguarded environment can trip is worse than no guard, because its
green is read as coverage.

Q-0072 registered the two instances in `NOT_READ` by hand after its gate. That closes those two and
leaves the class open: the next product constant naming a directory Quorum creates will trip the
guard on somebody's machine and nowhere else, and `NOT_READ` is the register for *a path named but
never opened*, not the instrument for deciding whether a literal is a directory at all.

## 2. User stories

**`maintainer`** — I merge a reviewed change whose `integrate` step went green, re-run the suite on
`main`, and it fails on a file nobody in the ticket touched. I need the answer my machine gives to
be the answer the gate gave, so that a green tick at the gate means the tree is green.

**`contributor`** — I clone Quorum, run `pnpm test`, and it passes. I then run a flow to see the
product work, run the suite again, and it fails naming a constant in a package I never opened. I
need a test suite whose verdict does not depend on whether I have used the product.

**`adopter`** — not affected. This guard is Quorum's own repository test infrastructure and ships in
no template, no `harness init` output and no command a stranger runs. Stated rather than omitted,
because the cold-clone test is a standing question here and the honest answer is that this ticket
does not touch it.

## 3. Surfaces

**None of the four product surfaces.** The change is confined to `packages/core` test
infrastructure — `packages/core/src/turbo-inputs.test.ts`, and `packages/core/test/corpus.ts` if
the chosen shape needs a seam there. No CLI command, no daemon, no flow, no role, no `harness/`
file, no `backlog/` file and no persisted format changes. The one conditional exception is
`docs/DECISIONS.md` under AC-11, which is a human commit rather than work for a step.

## 4. Acceptance criteria

**AC-1 — Classification no longer consults the working tree.** Neither of the two classifying
decisions — whether a quoted literal is a repository path (`turbo-inputs.test.ts:342–352`) and
whether a collected path is a directory (`:1303`) — is taken from `fs.existsSync` or `fs.statSync`
against the working tree. Both are taken from one repository inventory obtained in one place, so
that the rule can be stated in a sentence and changed in one.

**AC-2 — The four loud-failure checks are unchanged.** `:250`, `:261`, `:287` and `:1261` still
read the filesystem and still throw when their subject is absent. Testable from the diff: those
four lines are byte-identical, and the guard's prose states the distinction AC-1 draws — existence
used to *classify* is the defect, existence used to *refuse to run over a missing subject* is the
rule.

**AC-3 — The property is asserted directly, and in every environment.** A test runs the clause-B
classification over both suites' real sources twice, against two inventories that differ only in
paths an untracked working tree can add — at minimum `.harness/worktrees`, `.quorum/runs` and
`node_modules/.bin/turbo` — and requires the two verdicts to be identical. It is meaningful without
those directories existing, so it fires in an `integrate` worktree and on CI, which are exactly the
environments structurally blind to the defect today. This is the property the ticket asks for,
stated so a machine can check it: **the guard returns the same verdict on a clean checkout and on
one that has run flows.**

**AC-4 — That test is demonstrated to have a subject, in both of its halves.** Per Q-0071 —
*demonstrating that a guard has a subject proves the guard fires, not that each of its clauses
does* — the demonstration covers the file half and the directory half separately: over a fixture
naming a tracked file, a tracked directory and an untracked-but-present product directory, the
classifier's answers are asserted individually, so a rule that had stopped consulting the inventory
at all fails here rather than passing quietly.

**AC-5 — The two registered instances are closed by the mechanism, not by the register.** The
`NOT_READ` entries added by hand at `:238–244` are removed and the suite is green without them,
because the classifier no longer collects those paths. If the chosen shape cannot remove them, the
criterion is unmet — an entry that exists because the mechanism cannot answer is the state this
ticket exists to end.

**AC-6 — No register entry can go dead unnoticed.** A test requires every `NOT_READ` key to be a
path the classifier would still collect if a suite named it; a key the scan can no longer see fails
and is named. `node_modules/.bin/turbo` is the live instance — under any tracked-inventory rule it
becomes uncollectable, so it is removed together with the citation in `READ_BASES` at `:1232` that
names `NOT_READ` as its answer. Without this, a shape that fixes the class silently leaves the
register asserting nothing, which is the repository's own *check that skips its subject* one level
in.

**AC-7 — Every remaining working-tree dependence is audited, in the guard.** The implementer
enumerates each place the guard's verdict could still vary with untracked state and, for each,
either removes it or records one sentence saying why it cannot change a verdict. The known
candidates are `filesBelow`'s walks over `backlog`, `spike/src`, `harness/flows`, `harness/roles`
and `spike/templates/harness/flows`; `reported()`, whose input set turbo derives from a file
enumeration of its own; and the new inventory's own failure modes. The audit lands in the guard
beside the other registers — not in the implementation summary, which is not a durable record and
is not read again after the gate.

**AC-8 — Verified in two real environments before the gate, and the two agree.** The full
`packages/core` suite is run (a) on a checkout where `.harness/worktrees` and `.quorum/runs` exist
and (b) in a fresh worktree where they do not; both are green, and both pass/fail counts are
recorded in the ticket's record. Stated as a criterion because the gate's own `integrate` step runs
in row (b) and therefore cannot see the class this ticket closes.

**AC-9 — No new dependency, and any subprocess is already required.** Q-0072 AC-11 stands and its
reason is unchanged: `pnpm-lock.yaml` is a declared hashed input of the very task under change and
CI installs `--frozen-lockfile`, so no parser and no new package. Where the inventory comes from a
subprocess, that subprocess must already be a hard requirement of running this suite, must fail
loudly rather than silently yielding an empty inventory, and must work inside a git worktree —
which is where `integrate` runs.

**AC-10 — The review loop is bounded by the property.** Q-0072's errata E-1 and E-2 continue to
govern the clauses they bound; nothing here reopens them. For this ticket's own addition, a finding
is a blocker or a major only if it **demonstrates** two inventories or two environments producing
different verdicts. An unenumerated way a verdict could theoretically vary, named without a
demonstration, is a nit. Written into the requirement because the same file produced four correct
and different majors across five implement rounds at $95.78, and a review loop cannot decide for
itself when a guard is finished.

**AC-11 — If the claim changes, the decision is a human commit.** Should the chosen shape change
what the guard claims about a literal — for example from *"names something on disk"* to *"names
something git tracks"* — a `docs/DECISIONS.md` entry lands with the change. **The implementer does
not write it.** `harness/roles/developer-generalist.md` states *"You do not append to
docs/DECISIONS.md; a decision is the human's to record"*, so the criterion on the step is to name
the decision in its summary, and the entry is a human commit at or before the gate. No criterion in
this document names `backlog/`, `.claude/` or any other derived file: each was checked against all
three questions of *"`.claude/rules/` is a derived copy"* (2026-08-27) — may the role write it, will
`commitAll` revert it, and is it derived — rather than against the `backlog/` question alone.

## 5. Non-goals

- **Rewriting clauses C1–C4 or their registers.** `INDIRECT_ROUTES`, `ROOT_DERIVATIONS`,
  `ESCAPING_LITERALS`, `READ_APIS` and `READ_BASES` are out of scope except where AC-6 requires the
  `:1232` citation corrected.
- **Widening what the guard covers.** No new manifest entry, walk or read. This ticket makes an
  existing verdict stable; it does not make it stricter.
- **The residual limits E-1 stated.** The subprocess-read gap (limit 1) and the finite `READ_APIS`
  list (limit 5) stay open, registered, exactly as they are.
- **Any turbo or CI configuration.** `turbo.json`, both package configurations,
  `.github/workflows/ci.yml`, `package.json`'s scripts and `harness/harness.yaml`'s `commands.test`
  are untouched.
- **Q-0072's two successors.** Successor A (a temp-workspace fixture proving the escaping-input
  configuration through a real cache on CI's Linux checkout) and successor B (whether CI and a
  developer's `pnpm test` should be one command) are separate tickets and are not started here.
- **`packages/shared/src/constants.ts` and `constants.test.ts`.** The constants and their
  assertions are correct; the guard is what is wrong. Renaming or relocating a constant to dodge the
  guard is refused.
- **A test that creates directories in the repository.** Shape (4) is out: making every environment
  agree by having the suite `mkdir` its own subject makes the verdict depend on a fixture rather
  than removing the dependence, and it gives a test a side effect on the reader's working tree.
  AC-3 excludes it by construction, since a classifier that still reads the disk cannot be handed
  two inventories.
- **Product behaviour.** Nothing in `core`, `shared` or `spike` outside test support changes, so the
  port's freeze and *"The port preserves behaviour"* (2026-08-25) are not engaged.

## 6. Open questions

**OQ-1 — which shape? Owner: whoever implements, settled before the first line.** Not a blocker for
this requirement: the criteria above are written to bind any shape. My recommendation is **(2), an
inventory resolved against git, with the inventory injectable** — which is (2) plus the seam AC-3
needs, and the seam has precedent in `coreSourceFiles`'s `SourceCollector`, added by Q-0064 for
exactly this reason.

The census decides it. Shape (1) — classify by the literal's role rather than by existence — would
have to answer *is this a path?* for **307 distinct literals**, where existence currently answers it
by dropping 270 of them: lint messages, import specifiers, shell fragments, argv fixtures and prose.
Doing that without a syntax tree is the open-ended work E-1 already refused to buy, and AC-9 forbids
the dependency that would make it tractable. Shape (2) changes one classification site and moves
exactly **3** literals, leaving the other 34 collected as they are. Shape (3) — auto-registering
every product path constant — is a supplement rather than a fix, and AC-6 gives the drift it worries
about a louder home.

**OQ-2 — `git ls-files`, `git ls-tree HEAD`, or turbo's own enumeration? Owner: implementer.**
Recommendation `git ls-files`, because it reflects the index: a developer who has staged a new file
gets it counted, and turbo's enumeration is circular here — the guard would be classifying by the
thing it exists to check. Directory-ness is then derived from the tracked set (a literal is a
directory when some tracked path lies below it), which is what AC-1's "one place" means in practice.

**OQ-3 — is depending on `.git` acceptable? Owner: implementer, answer expected in the guard's
prose.** A repository exported without git could no longer run this suite. Recommendation: accept
and fail loudly, matching every corpus reader in both packages, and note that turbo — already a
hard requirement of this test — derives its own hashes from the same source.

**OQ-4 — does the new rule warrant a DECISIONS entry? Owner: human at the gate.** Recommendation
yes for shapes (1) and (2), because *"a literal names something git tracks"* is a rule later tickets
will cite, and the guard's claim is the thing this repository keeps having to write down. AC-11
carries it either way.

**OQ-5 — chore flow or full SDLC? Owner: human, before the run.** Recommendation **chore**. A red
phase could technically exist here — AC-3's property test fails today — but the full SDLC would hand
`automation-qa` the job of writing the very test that is this ticket's deliverable, putting one file
under two owners, which is the failure *"every file a red test requires must be owned by exactly one
task"* (2026-08-23) exists to prevent. Chore also matches the measured cost: $26–37 against
$350–550. Operational note, since it has cost money twice: `harness/Q-0073/integration` must be
created by hand before the first chore run, because `review` diffs against a branch only
`integrate` creates.

## 7. Risks

1. **The gate cannot see this defect class, including for its own fix.** `integrate` runs in a fresh
   worktree — row (b) of the table — so the very blindness this ticket closes applies to the run
   that closes it. Mitigated twice: AC-3 makes the property checkable *without* the environment
   varying, and AC-8 requires the two-environment run before the gate. This is the third time in
   this series that a ticket's subject has turned up inside the instrument built to enforce it, and
   it is the reason AC-8 is a criterion rather than a nice-to-have.
2. **Review-loop cost.** The precedent on this exact file is five implement rounds and $95.78, with
   every finding correct and different, ended only by two errata. AC-10 pre-bounds it with a
   demonstrable test rather than waiting for an exhaustion gate to do it at $10–30 a round. If a
   round still returns an undemonstrated bypass as a major, the answer is an erratum, not another
   round.
3. **The failure direction inverts, and the new one is the safer half.** Under a tracked inventory,
   a literal naming a genuinely new file the author has not yet staged is dropped, so a developer's
   pre-`git add` run under-collects. At the gate and on CI the file is tracked, collected and must be
   declared — so the gate is the stricter of the two, and nothing lands unguarded. That is the exact
   inverse of today, where the developer is stricter than the gate and the gate is the one that
   merges. AC-7's audit should say this in the guard's own prose.
4. **The audit may find a second instance and enlarge the ticket.** `filesBelow`'s walk over
   `backlog` collects any untracked `<id>/ticket.md` a `/ticket` invocation has just created, and
   its coverage answer then depends on turbo's own enumeration of untracked files. It is probably
   benign — the package configurations declare `../../backlog/*/ticket.md` as a glob — but AC-7
   requires it checked rather than assumed. If it turns out to be a genuine second instance, split
   it rather than absorbing it: this ticket is one classification rule.
5. **Removing a `NOT_READ` entry touches a reviewed, landed register.** `node_modules/.bin/turbo` is
   cited from `READ_BASES` at `:1232`, and the guard's self-audit test at `:1315–1326` requires
   every path the guard itself names to be accounted for in one of the three lists. AC-6's dead-entry
   check and that self-audit have to agree, or the fix trades one silent gap for another.

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable. `check()` and the three refused key names are untouched. |
| **Worktree safety** | Engaged, and it is why shape (4) is a non-goal: no test may create directories in the reader's checkout. Nothing here writes to a working tree. |
| **Gate behaviour** | Unchanged. AC-8 adds a verification the human performs before the gate, not a new gate or a new answer. |
| **File format and schema** | No persisted format changes. `constants.ts`'s exported values are untouched, so no consumer, contract or frozen schema moves. |
| **Lint rules** | No `lintFlow` rule and no ESLint rule changes. The one type-aware rule Q-0069 enabled stays the only one; new test code is inside `packages/**/*.ts` and is therefore covered by it. |
| **Cold-clone impact** | None. The guard is repository-internal and reaches no adopter's first thirty minutes. |
| **Product-agnostic** | Satisfied; the change names no SaaS product. |
| **Vocabulary** | No new term. "Guard", "clause" and "register" are this file's existing local vocabulary, not additions to `docs/GLOSSARY.md`. |
