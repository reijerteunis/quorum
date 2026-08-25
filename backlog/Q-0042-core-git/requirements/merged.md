# Q-0042 — `core/git`: worktrees, ancestry and containment

*Merged requirement, 2026-08-25, from `candidate-claude.md` and `candidate-codex.md`. Route: chore
(`requirements → chore → human gate`). Parent: Q-0009. Charter: `harness/port-charter.md` §6, row
Q-0042; invariants inherited: register rows 8 and 19. Surfaces: `packages/core` (new module and its
tests) and `packages/shared` (one additive type module and one line in its entry point).*

## Problem

`spike/src/git.js` is 163 lines and carries more decided behaviour per line than any other module in
the port. It holds the repository's only reader of git ancestry, and each rule it enforces was bought
after a failure that cost real money:

- Q-0035 found the engine and the board answering *"is this branch contained?"* two different ways,
  and the wrong one — a bare `try { … } catch { return false }` — was the one that printed a sentence
  to the user. The fix was one `ancestry()` primitive both callers reach.
- The same review round found that reading a **failed shallow probe** as "not shallow" hands the
  confident negative back through the side door, so `shallowState` became three-valued too. The
  closing entry notes this was *"the second time this class of conflation has had to be closed in the
  same week"*.
- Q-0036 established that containment is derived from git on every `board` invocation and stored
  nowhere, and that a hostile branch name in agent-written frontmatter never reaches a git command
  line.

Every one of these has an obvious implementation that is wrong, and each survives in the spike as a
comment explaining why. A TypeScript rewrite is exactly where they get lost: `execFileSync` throws
`unknown` under `strict`, `e.status` is not reachable without narrowing, and the shortest route to a
clean compile is the shape rule 1 forbids. Nothing in the existing suite would go red — the spike
keeps the old behaviour, and a test ported alongside a mis-ported module agrees with it.

The maintainer cannot tell a wrong containment answer from a right one by looking at it:
`main:contained` is four characters either way. That is why this module is first in the port, and why
its criteria below are written as exit codes rather than as intentions.

## User stories

- **As the maintainer**, when I run the board I need `main:contained` to mean git proved it and
  `main:indeterminate(git failed)` to mean git could not answer, so I never merge, delete or abandon
  a branch on the strength of a sentence the tool could not support.
- **As the cold-clone adopter**, I need every code-writing step to run in a worktree under
  `.harness/worktrees/` and my own working tree to be untouched, in a shallow clone as much as in a
  full one, so trying Quorum on my repository cannot cost me work.
- **As the adapter contributor**, I need one primitive I can read to learn how this product decides
  containment, so a module I write later cannot answer the same question a second way.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/git.js` — argv helper `:8`, `ensureWorktree` `:10–24`, `removeWorktree` `:26–30`, `ancestry` `:55–65`, `shallowState` `:71–74`, `firstLine` `:76–79`, `shortSha` `:85–87`, `emptyRangeEvidence` `:99–106`, `containment` `:119–147`, `ensureExcluded` `:149–161`, `safe` `:163` |
| Its callers | `spike/src/engine.js:9` (`ensureWorktree`, `ensureExcluded`, `shortSha`, `emptyRangeEvidence`), used at `:214`, `:374`, `:809`, `:861`; `spike/src/fanout.js:7`, used at `:138` with `base = null`; `spike/bin/harness.js:432` (`containment`), rendered `:437–443` |
| Its executable statements today | `spike/test/q0035-empty-range.js:150` and `:542–557` (E13, library-level — calls `ancestry` and `shallowState` directly); `spike/test/q0036-board-containment.js` C1–C9 (CLI-driven) |
| Constants already landed | `packages/shared/src/constants.ts` — `REPO_WORKTREE_ROOT` (`.harness/worktrees`), `worktreeDirName(branch)` (`/` → `__`), `DEFAULT_BASE_BRANCH`. `TICKET_ARTIFACT_DIR` (`.harness`) is a **different namespace** and is not the exclude pattern — see AC-11 |
| The `as const` precedent for a closed set | `FINDING_SEVERITIES` and `USAGE_MEASURES` in `packages/shared/src/constants.ts`, each with its inferred union type |
| Where types must not go | Charter §4: the dependency direction is `core → shared` and never the reverse |

Four facts established while reading, which the criteria depend on:

1. **`packages/shared/src/index.test.ts` pins `packages/core/src/index.ts` byte for byte** —
   `expect(readFileSync('packages/core/src/index.ts','utf8')).toBe("export const name = '@quorum/core';\n")`,
   under the heading *"core declares the dependency, and nothing else in core changed"*. Adding a
   re-export there turns Q-0041's landed test red, which chore's `integrate` runs
   (`npm test --prefix spike && pnpm turbo run test`) — so the run would fail *after* the implementer
   and both reviewers had been paid. **Both candidate requirements asked for that re-export and
   neither saw the pin.** AC-1 and OQ-1 settle it.
2. **`containment()` can never produce `indeterminate (shallow state unknown)`.** Its shallow value
   comes from the same combined probe (`rev-parse --is-inside-work-tree --is-shallow-repository`,
   `:121`) that gates the whole function: if the probe fails the function returns `null` and the row
   renders unannotated. The board therefore has three reasons, which is what `GLOSSARY.md` records;
   the fourth is reachable only through `emptyRangeEvidence` → `ancestry(…, { shallow: null })`.
3. **`packages/shared` carries no containment or ancestry type today.** Q-0041 landed flow, ticket,
   role, step-output, events, stages and constants and nothing else, so the ticket body's *"types in
   `shared` should make the closed set closed"* is an addition to a landed package (OQ-2).
4. **The exclude pattern is the literal `'.harness/'`** (`spike/src/git.js:15`), with a trailing
   slash, and no constant spells it. It is written into the user's `info/exclude`, so it is
   externally observable and must survive byte for byte.

## Acceptance criteria

Each is independently testable against a throwaway repository the test builds. **No criterion may be
satisfied by asserting the containment state of a branch in *this* repository** — that is red until
the next landing and green forever after, which the permanent-acceptance-test decision (2026-08-23)
forbids and which both spike suites already avoid by construction.

**AC-1 — The module exists, exports eight functions, and `core` reads git ancestry in exactly one file.**
`packages/core/src/git.ts` exports `ensureWorktree`, `removeWorktree`, `ancestry`, `shallowState`,
`shortSha`, `emptyRangeEvidence`, `containment` and `ensureExcluded`. **`packages/core/src/index.ts`
is not modified** and in-package consumers (Q-0048) import `./git.js` directly; the public re-export
is deferred to the child that first needs a cross-package consumer (OQ-1).
*Test:* a source-level test over `packages/core/src/**` asserts that `merge-base` and `--is-ancestor`
appear in `git.ts` and in no other source file, so a later module cannot grow a second reader without
going red; and that `packages/core/src/index.ts` still reads exactly `export const name = '@quorum/core';`
so `packages/shared/src/index.test.ts` stays green. (Register row 8; Q-0035.)

**AC-2 — `ancestry` selects its state from git's exit code and from nothing else, and its `detail` is one normalised line that decides nothing.**
Signature `ancestry(repoDir, ref, inRef, { shallow = false, shallowDetail = null })`. Every result
carries all four keys `{ state, reason, detail, command }`, with `command` reading exactly
`git merge-base --is-ancestor <ref> <inRef>`. The five outcomes:

| Condition | `state` | `reason` | `detail` |
| --- | --- | --- | --- |
| exit 0 (in any shallow state) | `contained` | `null` | `null` |
| exit 1, `shallow: false` | `not-contained` | `null` | `null` |
| exit 1, `shallow: true` | `indeterminate` | `shallow clone` | `null` |
| exit 1, `shallow: null` | `indeterminate` | `shallow state unknown` | the `shallowDetail` passed in |
| any other exit, a signal, a spawn failure, a timeout, or no git on `PATH` | `indeterminate` | `git failed` | normalised, per below |

A thrown error is **never** treated as proof of `not-contained` unless its process exit status is
exactly `1`. `detail` is the first non-empty trimmed line of git's stderr, falling back to the first
non-empty trimmed line of the error's `message`, truncated to at most 200 characters, and `null` when
neither yields one.
*Test:* all five outcomes over real repositories, including a directory that is not a git repository
and a ref that does not resolve — both of which must produce `indeterminate (git failed)` and never
`not-contained`. `detail` is asserted non-empty and free of newlines for those two, and asserted
nowhere to be load-bearing: no state and no reason is derived from its text.

**AC-3 — `shallowState` is three-valued and says when it could not ask.**
`shallowState(repoDir)` invokes `git rev-parse --is-shallow-repository` and returns
`{ shallow: true | false | null, detail }`. Output exactly `true` gives `{ shallow: true, detail: null }`;
**any other successful output gives `{ shallow: false, detail: null }`**, preserving spike behaviour;
a failed invocation gives `{ shallow: null, detail }` with the detail normalised as in AC-2 — never
`false`.
*Test:* three cases, the third against a directory that is not a repository. (This is E13's second
half, `spike/test/q0035-empty-range.js:554–557`.)

**AC-4 — `containment` derives the board's answer, distinguishes its two null cases, and never guesses an ahead count.**
`containment(repoDir, base)` performs one combined probe of `--is-inside-work-tree` and
`--is-shallow-repository`, returns `null` when that probe fails **or** when the first value does not
report a work tree, and otherwise an object whose `stateOf(branch)` returns:

- `null` when `branch` is not a string, or is not in the local-branch set (the row renders
  unannotated, exactly as before);
- `{ state: 'indeterminate', reason: 'missing ref' }` when `refs/heads/<base>^{commit}` does not
  resolve;
- `{ state: 'contained' }` — **no `reason`, no `ahead`**;
- `{ state: 'not-contained', ahead: n }`, where `n` counts `refs/heads/<base>..refs/heads/<branch>`
  — the commits reachable from the branch and not from the base, **not** the symmetric difference —
  computed **only** after `ancestry` has proven `not-contained`;
- `{ state: 'indeterminate', reason }` for AC-2's `shallow clone` and `git failed`, with no `ahead`
  key — including the case where the ahead count itself fails, which is `git failed`.

Deriving containment **writes nothing**: no file created or modified, no ref moved, no cache, nothing
in `ticket.md` or `.quorum/`.
*Test:* one case per bullet, plus a snapshot of the repository directory listing and of
`git for-each-ref` taken before and after a full pass and asserted identical. (Q-0036 C1–C7; the
derivation half of register row 9, whose board-invocation half is Q-0043's.)

**AC-5 — An untrusted branch name never reaches a git command line, and a tag does not mask a branch.**
The local branch set is read **once** via `for-each-ref --format=%(refname:lstrip=2) refs/heads`, and
each ticket's `branch` value is matched against it as a plain string; only names that came out of git
are ever interpolated into a `refs/heads/…` argument. A value shaped like an option
(`--upload-pack=touch /tmp/pwned`), like a shell fragment (`main; echo hi`) or like a path traversal
returns `null` and causes no additional git invocation. Every git call in the module goes through
`execFileSync` with an argv array and never a shell. `lstrip=2` is required rather than
`%(refname:short)`, whose shortening is ambiguity-dependent: with `refs/tags/<name>` beside
`refs/heads/<name>` it emits `heads/<name>` and the lookup misses a branch that resolves.
*Test:* the three injection-shaped values above, and a repository carrying a tag and a branch of the
same name. (Q-0036 C8, C9.)

**AC-6 — A board of n tickets costs at most 2n + 3 git invocations.**
The work-tree-and-shallow probe, the base-ref check and the branch list are issued **once per
`containment()` call**; each `stateOf()` costs at most two more. The closure shape is preserved for
this reason: a rewrite to a plain function either re-probes per ticket or moves the caching to the
caller.
*Test:* counts invocations by any means that does not change the module's signature — for example a
counting `git` shim placed first on `PATH` for the test's duration — over a fixture with a known n,
and asserts the total is ≤ 2n + 3.

**AC-7 — `emptyRangeEvidence` asks the question in the right direction, and `sameTree` is three-valued.**
`emptyRangeEvidence(repoDir, left, right)` probes shallow state once, passes both `shallow` and its
`detail` into `ancestry`, and asks whether the **right** endpoint is contained in the **left** —
because a three-dot range shows what the right endpoint added since its merge base with the left.
`sameTree` is computed **only** when the check returned `not-contained`: it resolves `<left>^{tree}`
and `<right>^{tree}` and is `true`/`false` when both resolve, `null` when either does not, and `null`
for every other check state. A failed tree comparison never changes the ancestry state.
*Test:* a contained pair; a not-contained pair with differing trees; a not-contained pair whose two
commits hold identical trees; an unresolvable endpoint; and a shallow repository in which a would-be
exit 1 arrives as `indeterminate (shallow clone)` with `sameTree: null`.

**AC-8 — `shortSha` returns git's own abbreviation, or `null`.**
`rev-parse --verify --quiet --short <ref>`; `null` when the ref does not resolve or git fails, which
is also how a caller tests an endpoint's existence — one invocation answers both questions.
*Test:* asserts the value equals what git itself reports for that ref rather than matching a fixed
width, and that an unresolvable ref yields `null` without throwing. Nothing in the module or its
tests assumes an abbreviation length.

**AC-9 — Worktrees are created where the safety rule says, and only there.**
`ensureWorktree(repoDir, branch, base)` returns `<repoDir>/<REPO_WORKTREE_ROOT>/<worktreeDirName(branch)>`
and:

- returns an existing directory unchanged, invoking git not at all;
- otherwise creates the worktree root and adds `.harness/` to the repository's exclude file **before**
  adding the worktree;
- checks out `branch` with `worktree add <dir> <branch>` when `refs/heads/<branch>` resolves, creating
  and resetting nothing;
- otherwise creates the branch with `worktree add -b <branch> <dir> <start>`, where `<start>` is
  `base` when `base` is non-empty and `refs/heads/<base>` resolves, and `HEAD` when `base` is absent,
  `null` (which `spike/src/fanout.js:138` passes) or does not resolve;
- never writes to the user's working tree.

`removeWorktree(repoDir, branch, { deleteBranch = false })` derives the same directory, removes the
worktree with `--force` when the directory exists, issues no removal command when it does not,
retains the branch by default, and with `{ deleteBranch: true }` attempts `branch -D` afterwards —
a failed delete is swallowed, as today.
*Test:* one case per bullet, asserting the returned path, which branch the worktree is on, and that
the repository's own checkout is unmodified throughout. (Register row 19.)

**AC-10 — `ensureExcluded` resolves the exclude file through git and never throws.**
It asks git for `--git-path info/exclude`, uses an absolute answer as-is and resolves a relative one
against `repoDir` (so a worktree or a `.git`-file layout is honoured), creates the parent directory,
and appends `pattern` followed by one newline **only** when that exact line is not already present —
preserving today's newline handling, including the empty-file case. Any failure of resolution,
directory creation, read or append produces one warning on the same channel and in the same shape as
today, naming the pattern and the best-known target path, and returns normally rather than failing
worktree creation.
*Test:* first call appends, second call does not, a file without a trailing newline gains one, a
pattern that is a prefix of an existing line is still appended, and a repository git cannot read
produces a warning rather than an exception.

**AC-11 — The closed sets are closed and live in `shared`; no literal is re-spelled; the workspace's own rules hold.**
A new module `packages/shared/src/containment.ts` (lowercase-and-hyphen filename, so
`packages/shared/src/index.test.ts`'s entry-point regex still matches) declares the state and reason
sets once as `as const` tuples with their inferred union types, following the `FINDING_SEVERITIES`
precedent, and is re-exported by one added line in `packages/shared/src/index.ts`. States are exactly
`contained`, `not-contained`, `indeterminate`. Ancestry reasons are exactly `git failed`,
`shallow clone`, `shallow state unknown`; the board-facing containment reasons are exactly
`missing ref`, `shallow clone`, `git failed`, with a comment recording which surface can produce
which (fact 2 above). The result types are modelled so that **impossible combinations are not
representable** — `not-contained` with a reason, `contained` with an `ahead`, `indeterminate` without
an allowed reason. `core`'s return types are built from these declarations, so a state or reason
outside the set is a compile error. The module adds no dependency to `shared` (`zod` stays its only
one) and imports nothing from `core`.

`core/git.ts` takes the worktree root and the `/` → `__` rule from `REPO_WORKTREE_ROOT` and
`worktreeDirName` rather than re-spelling them. The exclude pattern `'.harness/'` **stays a literal**
with a comment saying why: `TICKET_ARTIFACT_DIR` is a different namespace and lacks the trailing
slash, so it is the wrong constant. No `any`; no `@ts-ignore` without a same-line reason; no new
dependency — the module needs `node:child_process`, `node:fs` and `node:path` and nothing else.
*Test:* a source-level assertion that `replace(/\//g` and the string `'.harness/worktrees'` do not
appear in `packages/core/src/git.ts`; a type-level assertion that an out-of-set reason fails to
compile; and `pnpm lint` and `pnpm typecheck` green.

**AC-12 — The module's tests ship with it, and every one builds its own repository.**
E13's library-level assertions (`spike/test/q0035-empty-range.js:150`, `:542–557`) come across as
Vitest tests under `packages/core`, and the nine board cases of `spike/test/q0036-board-containment.js`
are covered here at the library level against `containment()` — that CLI-driven file itself stays
with the spike until Q-0010, per charter §5. Every test constructs the topology and shallow state it
asserts; none depends on this repository's branches. Fixtures use plain `init` / `commit` /
`clone --depth` so no test fails for a git-version reason. `pnpm test` is green from a clean clone.
*Test:* the suite runs under `packages/core`'s existing Vitest configuration and is picked up by the
workspace CI job with no change to `.github/workflows/ci.yml` or `turbo.json`. (Charter §1,
consequence 2 — a child that leaves its tests to Q-0054 makes `integrate` examine nothing this run
produced.)

**AC-13 — Behaviour is preserved, and anything found is reported rather than fixed.**
No file under `spike/**` is modified or deleted (charter §3, enforced by the `port freeze (branch scope)`
CI job), the spike suite passes unchanged, and no observable behaviour of any ported function differs
from the spike's. Any defect, inconsistency, performance or ergonomics issue the implementer notices
while reading — including the two named in OQ-1 and OQ-4 — is named in the step's implementation
report and is **not** acted on. If a ported test appears to expose defective behaviour, implementation
stops and reports rather than changing the behaviour or the test.
*Test:* the freeze job is green on the branch, and the report either names findings or states that
there are none.

## Non-goals

- **Rendering.** The `main:contained` / `main:not-contained(+12)` / `main:indeterminate(<reason>)`
  token is the CLI's and moves in Q-0010. This ticket produces the states; it prints nothing, and no
  vocabulary it exposes describes a branch as merged, landed or shipped.
- **The board command itself**, `loadProject`, ticket frontmatter — Q-0043.
- **`materialiseDiff`, the empty-range message, the range guard and the preflight** — Q-0051. This
  ticket ships the evidence-gathering primitives those consume and none of the prose that quotes them.
- **`fanout.js`** — Q-0048, which depends on this.
- **Fixing anything**, including `ensureExcluded`'s `console.warn` (OQ-3), the byte-pin in
  `packages/shared/src/index.test.ts` (OQ-1), and `shallowState`'s treatment of an unexpected
  successful probe output (OQ-4).
- **Editing `spike/**`** (charter §3), the cutover, the `quorum` binary (Q-0010), persisting the event
  stream, and everything on v1's exclusion list.
- **Caching or persisting containment** in frontmatter, in `.quorum/`, in `runs.log` or in memory
  across invocations — a cache is the same drift with an extra file.
- **A `--base <ref>` flag**, retries, timeouts, cancellation, command logging, a general git
  abstraction, a new process-execution dependency, support for remote refs or tags as containment
  sources, or any read of the reflog.

## Open questions

None blocks implementation. Each is answered below; the answers are binding for this ticket.

| # | Question | Owner | Blocker? |
| --- | --- | --- | --- |
| OQ-1 | `packages/shared/src/index.test.ts` pins `packages/core/src/index.ts` byte for byte. Who narrows it, and when? | Ruud | No — decided for Q-0042; **will** block a later child |
| OQ-2 | Do the closed sets live in `packages/shared` or in `packages/core/src/git.ts`? | Decided at this gate | No |
| OQ-3 | `ensureExcluded` prints with `console.warn`. Preserve, or route to the event stream? | Decided at this gate | No |
| OQ-4 | Is `shallowState`'s "any successful non-`true` output → `false`" intentional? | Decided at this gate | No |
| OQ-5 | The glossary lists three indeterminate reasons; the module can produce four. | Decided at this gate | No |

**OQ-1 — decided: Q-0042 does not touch `packages/core/src/index.ts`, and reports the pin.** The
assertion sits under *"core declares the dependency, and nothing else in core changed"* and its own
comment says it exists to prove Q-0041's diff was minimal — it is a fact about **one run's scope**,
not a permanent property of the repository, and it is guaranteed false the moment any child adds a
module to `core`. That is the shape the 2026-08-23 decision names: a phase-bound fact persisted as an
assertion. Q-0042 needs no public export — its only declared dependent, Q-0048, is in the same
package and imports `./git.js` — so the minimal, charter-conformant move is to leave both files
alone and put the pin in the implementation report under charter §2. Narrowing it to what it actually
protects (that `packages/core` declares `@quorum/shared` as `workspace:*`) is a two-line edit and
belongs to a human commit or to the first child that genuinely needs a cross-package export — most
likely Q-0043, whose board work needs `containment` reachable from the CLI. **If Ruud prefers to
narrow it by hand before this run, AC-1's second sentence inverts and the rest of this requirement is
unchanged.**

**OQ-2 — decided: `packages/shared`, additively.** The ticket body already says *"types in `shared`
should make the closed set closed"*, charter §4 gives `shared` the shared types and forbids the
reverse edge, and Q-0010's CLI and M3's UI both render these three states and must not re-derive the
reason strings from prose. Reopening Q-0041, which is landed and contained in `main`, is rejected:
the register's per-child column says what each child *ports*, not that no later child may add to a
package. Adding a module plus one entry-point line changes no existing schema and breaks nothing
Q-0041 landed — unlike the `core` entry point, `packages/shared/src/index.ts` is asserted only by a
per-line regex that an added `export * from './containment.js';` satisfies.

**OQ-3 — decided: preserve `console.warn` exactly.** A library that writes to the console is a wart,
and `shared`'s event union already has a `warn` member — which is precisely why this is tempting and
why it must not happen here. What a command prints is externally observable, so changing the channel
is an unregistered behaviour change under charter §2; the channel is Q-0050's to decide. Preserve,
and name it in the implementation report.

**OQ-4 — decided: preserve, and report if it looks wrong.** `shallowState` compares git's output to
`true` exactly and maps everything else that succeeded onto `false`. AC-3 preserves that. If the
implementer judges it defective, charter §2 requires it named in the report, not fixed.

**OQ-5 — decided: no doc edit here.** `GLOSSARY.md`'s Containment entry describes the **board**, and
the board genuinely has three reasons, for the structural reason in fact 2 above. The fourth is
reachable only through the empty-range diagnostic, whose prose Q-0051 owns. AC-11 requires the type
to carry a comment recording which surface produces which.

## Risks

**The rewrite that makes `tsc` happy is the rewrite rule 1 forbids.** `execFileSync` throws `unknown`
under `strict` and `e.status` is not reachable without narrowing, so the shortest route to a clean
compile is `catch { return false }` or `catch (e: any)` — the first is exactly the defect Q-0035
removed, the second is an ESLint error. AC-2's non-repository and unresolvable-ref cases exist to
make the first one red rather than merely plausible. **This is the single most expensive thing in
this ticket to lose.**

**A boolean `shallow` collapses `null` into `false` silently**, letting absent history produce a
confident negative through the back door. AC-3 and AC-11's type modelling are the two independent
guards.

**Both suites can be green over a wrong port** (charter §2): the spike keeps the old behaviour and a
test ported alongside a mis-ported module agrees with it. The mitigation here is unusually strong and
should be used — every criterion above is asserted against **real git**, not against a transcription,
so the independent witness is git itself rather than the spike's suite.

**Editing `packages/core/src/index.ts` fails `integrate` after everyone has been paid.** See fact 1
and OQ-1. This is the exact shape that cost Q-0035 $13.86, arriving through a landed test rather than
through a missing branch.

**`harness/Q-0042/integration` does not exist yet.** Charter §8's first checklist item: `review`
diffs `harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later,
creates the left endpoint. Create the branch before the first chore run.

**Environment variance in fixtures.** `rev-parse --is-shallow-repository` needs git ≥ 2.15, and
`worktree remove --force` and `for-each-ref --format=%(refname:lstrip=2)` have their own floors; a
`--depth` clone of a plain local path is silently ignored, so a shallow fixture needs the `file://`
scheme (as `q0036-board-containment.js:132` already does). A test that fails on the CI image for a
git-version reason reads as a port defect.

**Scope creep into Q-0051.** `emptyRangeEvidence` is one function away from the empty-range message,
and the message is the interesting part. It is not this ticket's, and writing it here collides with
Q-0051's ownership of the same file set.

## Cross-cutting checklist

- **BYOS** — n/a and provably so: the module reads no environment variable, accepts no credential and
  spawns only `git`. No test, fixture or comment may introduce one.
- **Worktree safety** — this is the enforcement point (register row 19). AC-9 covers the location,
  the naming and the untouched working tree; AC-10 covers the exclusion that keeps `.harness/` out of
  the user's status.
- **Gate behaviour** — n/a. This module presents no gate and reads no counter.
- **File format and schema** — the module writes no product file. It appends one line to the
  repository's own `info/exclude` (AC-10) and creates worktree directories (AC-9). The closed-set
  types are declarations, not a persisted format (AC-11).
- **Lint rules** — n/a; the flow lint is Q-0044. ESLint's two workspace rules apply (AC-11).
- **Cross-vendor rule** — n/a to the module; the chore flow's review panel satisfies it.
- **Product-agnostic** — no SaaS-specific knowledge; every function takes the repository directory as
  data.
- **Cold-clone impact** — none. A library port with no new dependency, no new command and no change
  to what a newcomer runs in their first thirty minutes.
- **Cost** — the charter's estimate is $25–39 per child; this is the second of fourteen, and the cost
  checkpoint (charter §9) falls after the first three reach `reviewed`.

## Provenance

**Size.** Thirteen criteria over eight exported functions in a 163-line module — within the
ten-to-fifteen band, so this is **not** split. Claude shipped 13, Codex shipped 26; Codex's are
mostly one behaviour cut across three criteria (worktrees at 3–6, ancestry at 7–9, empty range at
14–15), and folding them loses no content while giving a bounded revise loop far less to find.

**From `candidate-claude.md`, kept largely intact:** the framing that each rule was bought with money;
the context table with line numbers, which turns reading the spike into a check rather than a
discovery; fact 2 (containment structurally cannot emit `shallow state unknown`) and the OQ-5 answer
that follows from it; the ≤ 2n + 3 invocation budget (AC-6) and the closure-preservation argument
behind it, which Codex omits entirely and which is what stops a "simplification" that re-probes per
ticket; the `lstrip=2`-versus-`%(refname:short)` tag reasoning; the requirement that no criterion
assert this repository's own topology; the `harness/<id>/integration` and git-version risks; and the
`tsc`-shaped risk that opens the risk section.

**From `candidate-codex.md`, kept where it was sharper:** the exact `detail` normalisation, including
the fallback to the error's `message` and the `null` case, which Claude's version omitted (AC-2);
"never `not-contained` unless the process exit status is exactly 1", which is a stronger statement
than a table row (AC-2); the preservation of "any successful non-`true` shallow output → `false`"
and the open question about it (AC-3, OQ-4); the demand that impossible combinations be
*unrepresentable* rather than merely typed, which is the difference between a union and a
discriminated union (AC-11); the explicit split of `containment`'s two `null` causes (AC-4); and the
long non-goals list, from which the "no retries, timeouts, cancellation, command logging, general git
abstraction" line is taken verbatim in substance.

**Added at this gate, in neither candidate:** fact 1 — `packages/shared/src/index.test.ts` pins
`packages/core/src/index.ts` byte for byte, and **both candidates required the re-export that breaks
it**, which would have failed `integrate` after the implementer and both reviewers were paid. AC-1
and OQ-1 settle it in the minimal direction and put the pin on the record as a stop-and-report
finding.

**Corrected at this gate:** Claude's AC-11 asked for a source-level assertion that the literal
`.harness` never appears in `git.ts`. That is unsatisfiable — `ensureWorktree` passes `'.harness/'`
to `ensureExcluded` as the exclude pattern, `TICKET_ARTIFACT_DIR` is a documented *different*
namespace and lacks the trailing slash, and the pattern is written into the user's `info/exclude`, so
it is externally observable and must survive byte for byte. AC-11 now names `replace(/\//g` and
`'.harness/worktrees'` as the forbidden spellings and tests the exclude file's resulting content
instead.

**Decided rather than deferred.** Both candidates marked the location of the closed sets as blocking
and assigned it to Ruud at this gate. The ticket body (*"types in `shared` should make the closed set
closed"*), charter §4 and the `FINDING_SEVERITIES` precedent all point the same way, so it is decided
here (OQ-2) rather than returned. The remaining four questions are answered from the behaviour-
preservation decision and the charter, so nothing blocks the chore run.
