# Q-0042 — `core/git`: worktrees, ancestry and containment

*Requirement, 2026-08-25. Surface: `packages/core` (new module and its tests) and `packages/shared`
(one additive type module — see OQ-1). Route: chore. Parent: Q-0009; charter:
`harness/port-charter.md` §6, row Q-0042; invariants inherited: register rows 8 and 19.*

## Problem

`spike/src/git.js` is 163 lines and it is the densest piece of decided behaviour in the port. It
holds the only place in the repository that reads git ancestry, and the rules it enforces were each
bought after a failure that cost money:

- Q-0035 found that the engine and the board answered *"is this branch contained?"* two different
  ways, and the wrong one — a bare `try { … } catch { return false }` — was the one that printed a
  sentence to the user. The fix was one `ancestry()` primitive both callers reach.
- The same review round found that reading a **failed shallow probe** as "not shallow" hands the
  confident negative back through the side door, so `shallowState` became three-valued too. The
  closing entry notes this was *"the second time this class of conflation has had to be closed in
  the same week"*.
- Q-0036 established that containment is derived from git on every `board` invocation and stored
  nowhere, and that a hostile branch name in agent-written frontmatter never reaches a git command
  line.

Every one of these rules has an obvious implementation that is wrong, and every one of them survives
in the spike as a comment explaining why the obvious thing is wrong. A TypeScript rewrite is exactly
the moment they get lost: `catch (e)` over `unknown` in strict mode is awkward, and the shortest way
to make `tsc` happy is the shape rule 1 forbids. Nothing in the existing suite would go red — the
spike keeps the old behaviour, and a test ported alongside a mis-ported module agrees with it.

The **maintainer** cannot tell a wrong containment answer from a right one by looking at it: `main:contained`
is four characters either way. That is why this module is first in the port, and why its criteria are
written as exit codes rather than as intentions.

## User stories

- **As the maintainer**, when I run the board I need `main:contained` to mean git proved it and
  `main:indeterminate(git failed)` to mean git could not answer, so that I never merge, delete or
  abandon a branch on the strength of a sentence the tool could not support.
- **As the cold-clone adopter**, I need every code-writing step to run in a worktree under
  `.harness/worktrees/` and my own working tree to be untouched, in a shallow clone as much as in a
  full one, so that trying Quorum on my repository cannot cost me work.
- **As the adapter contributor**, I need one primitive I can read to learn how this product decides
  containment, so that a module I write later cannot answer the same question a second way.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/git.js` — argv helper `:8`, `ensureWorktree` `:10–24`, `removeWorktree` `:26–30`, `ancestry` `:55–65`, `shallowState` `:71–74`, `firstLine` `:76–79`, `shortSha` `:85–87`, `emptyRangeEvidence` `:99–106`, `containment` `:119–147`, `ensureExcluded` `:149–161`, `safe` `:163` |
| Its callers | `spike/src/engine.js:9` (`ensureWorktree`, `ensureExcluded`, `shortSha`, `emptyRangeEvidence`), used at `:214`, `:374`, `:809`, `:861`; `spike/src/fanout.js:7`, used at `:138` with `base = null`; `spike/bin/harness.js:432` (`containment`), rendered `:437–443` |
| Its executable statements today | `spike/test/q0035-empty-range.js:150` and `:542–557` (scenario E13 — library-level, calls `ancestry` and `shallowState` directly); `spike/test/q0036-board-containment.js` C1–C9 (CLI-driven, drives `harness board`) |
| Constants already landed | `packages/shared/src/constants.ts` — `REPO_WORKTREE_ROOT` (`.harness/worktrees`), `worktreeDirName(branch)` (`/` → `__`), `DEFAULT_BASE_BRANCH` |
| Where types must not go | Charter §4: the dependency direction is `core → shared` and never the reverse |

Two facts found while reading, which the criteria below depend on:

1. **`containment()` can never produce `indeterminate (shallow state unknown)`.** Its shallow value
   comes from the same combined probe (`rev-parse --is-inside-work-tree --is-shallow-repository`,
   `:121`) that gates the whole function, so if the probe fails the function returns `null` and the
   board renders the row unannotated. The board therefore has three reasons, which is what
   `GLOSSARY.md` records; the fourth reason exists and reaches only the empty-range diagnostic via
   `emptyRangeEvidence` → `ancestry(…, { shallow: null })`. See OQ-5.
2. **`packages/shared` currently has no containment or ancestry type** — Q-0041 landed flow, ticket,
   role, step-output, events, stages and constants, and nothing else. The ticket body's *"types in
   `shared` should make the closed set closed"* is therefore an addition to a landed package, not a
   consumption of one. See OQ-1.

## Acceptance criteria

Each is independently testable against a throwaway repository built by the test. No criterion may be
satisfied by asserting the containment state of a branch in *this* repository — that is red until the
next landing and green forever after, which the permanent-acceptance-test decision (2026-08-23)
forbids, and which both spike suites already avoid by construction.

**AC-1 — One ancestry primitive, and `core` reads git ancestry nowhere else.**
`packages/core/src/git.ts` exists and exports `ensureWorktree`, `removeWorktree`, `ancestry`,
`shallowState`, `shortSha`, `emptyRangeEvidence`, `containment` and `ensureExcluded`; `packages/core/src/index.ts`
re-exports them.
*Test:* a source-level test over `packages/core/src/**` asserts that `merge-base` and
`--is-ancestor` appear in `git.ts` and in no other source file, so a later module cannot grow a
second reader without the test going red. (Register row 8; Q-0035.)

**AC-2 — `ancestry` selects its state from git's exit code and from nothing else.**
Signature `ancestry(repoDir, ref, inRef, { shallow = false, shallowDetail = null })`; every result
carries all four keys `{ state, reason, detail, command }`, with `command` reading exactly
`git merge-base --is-ancestor <ref> <inRef>`. The five outcomes:

| Condition | `state` | `reason` | `detail` |
| --- | --- | --- | --- |
| exit 0 | `contained` | `null` | `null` |
| exit 1, `shallow: false` | `not-contained` | `null` | `null` |
| exit 1, `shallow: true` | `indeterminate` | `shallow clone` | `null` |
| exit 1, `shallow: null` | `indeterminate` | `shallow state unknown` | the `shallowDetail` passed in |
| any other exit, or git could not be executed | `indeterminate` | `git failed` | git's own first stderr line, trimmed to one line of at most 200 characters |

*Test:* exercises all five over real repositories, including a directory that is not a git
repository and a ref that does not resolve — both of which must produce `indeterminate (git failed)`
and never `not-contained`. `detail` is asserted to be non-empty and free of newlines, and is
asserted nowhere to be load-bearing (no state or reason is derived from its text).

**AC-3 — `shallowState` is three-valued and says when it could not ask.**
Returns `{ shallow: true | false | null, detail }`. A shallow repository reports `true` with
`detail: null`; an ordinary repository reports `false` with `detail: null`; a probe that fails
reports `shallow: null` with git's first stderr line, normalised as in AC-2 — never `false`.
*Test:* three cases, the third against a directory that is not a repository. (This is E13's second
half at `spike/test/q0035-empty-range.js:554–557`.)

**AC-4 — `containment` derives the board's answer, writes nothing, and distinguishes its null cases.**
`containment(repoDir, base)` returns `null` when `repoDir` is not a git work tree or when the probe
itself fails, and otherwise an object whose `stateOf(branch)` returns:

- `null` when `branch` is not a string, or is not in the set of local branches read once via
  `for-each-ref --format=%(refname:lstrip=2)` — the row renders unannotated, exactly as before;
- `{ state: 'indeterminate', reason: 'missing ref' }` when the configured base does not resolve;
- `{ state: 'contained' }` — with no `reason` and no `ahead` key;
- `{ state: 'not-contained', ahead: n }` where `n` counts `refs/heads/<base>..refs/heads/<branch>`,
  the commits reachable from the branch and not from the base, **not** the symmetric difference, and
  computed only for a proven `not-contained`;
- `{ state: 'indeterminate', reason }` for the shallow and git-failed reasons of AC-2, with no
  `ahead` key — including the case where the ahead count itself fails, which is `git failed`.

*Test:* one case per row, plus a snapshot of the repository directory listing and of
`git for-each-ref` before and after a full pass, asserting that deriving containment created no
file, moved no ref and wrote no cache. (Register row 9's derivation half; Q-0036 C1–C7.)

**AC-5 — An untrusted branch name never reaches a git command line.**
`stateOf` compares the frontmatter value as a plain string against the branch set; a value shaped
like an option (`--upload-pack=touch /tmp/pwned`), like a shell fragment (`main; echo hi`) or like a
path traversal returns `null` and causes no additional git invocation. Every git call in the module
goes through `execFileSync` with an argv array and never a shell. A tag sharing a branch's name does
not stop the branch being annotated — the branch list is read with `lstrip=2`, not `%(refname:short)`,
whose shortening is ambiguity-dependent.
*Test:* the injection-shaped values above, and a repository with a tag and a branch of the same name.
(Q-0036 C8, C9.)

**AC-6 — A board of n tickets costs at most 2n + 3 git invocations.**
The work-tree-and-shallow probe, the base-ref check and the branch list are issued once per
`containment()` call; each `stateOf()` costs at most two more. A rewrite that probes shallow state
per ticket, or re-reads the branch list, fails this criterion.
*Test:* counts invocations by any means that does not change the module's signature — for example a
counting `git` shim placed first on `PATH` for the duration of the test — over a fixture with a
known n, and asserts the total is ≤ 2n + 3.

**AC-7 — `emptyRangeEvidence` asks the question in the right direction, and `sameTree` is three-valued.**
`emptyRangeEvidence(repoDir, left, right)` probes shallow state once, passes it into `ancestry`, and
asks whether the **right** endpoint is contained in the **left** — a three-dot range shows what the
right endpoint added since its merge base with the left. `sameTree` is computed only when the check
returned `not-contained`, and is `true`/`false` when both trees resolve and `null` when either does
not, or when the check returned anything else.
*Test:* a contained pair, a not-contained pair with differing trees, a not-contained pair whose two
commits hold identical trees, an unresolvable endpoint, and a shallow repository in which a
would-be exit 1 arrives as `indeterminate (shallow clone)` with `sameTree: null`.

**AC-8 — `shortSha` returns git's own abbreviation, or `null`.**
`rev-parse --verify --quiet --short <ref>`; `null` when the ref does not resolve, which is also how a
caller tests an endpoint's existence — one invocation answers both questions.
*Test:* asserts the value equals what git itself reports for that ref rather than matching a fixed
width, and that an unresolvable ref yields `null` without throwing. Nothing in the module or its
tests assumes an abbreviation length.

**AC-9 — Worktrees are created where the safety rule says, and only there.**
`ensureWorktree(repoDir, branch, base)` returns
`<repoDir>/<REPO_WORKTREE_ROOT>/<worktreeDirName(branch)>` and:

- returns an existing directory unchanged, invoking git not at all;
- creates the worktree root and adds `.harness/` to the repository's exclude file **before** adding
  the worktree;
- checks out `branch` when `refs/heads/<branch>` exists;
- otherwise creates the branch from `base` when `base` is given and resolves, and from `HEAD`
  when it is absent, `null` (which `spike/src/fanout.js:138` passes) or does not resolve;
- never writes to the user's working tree.

`removeWorktree(repoDir, branch, { deleteBranch = false })` removes the directory with `--force` when
it exists, is a no-op when it does not, and deletes the branch only when asked — a failed delete is
swallowed, as today.
*Test:* one case per bullet, asserting the returned path, the exclude-file content, which branch the
worktree is on, and that the repository's own checkout is unmodified throughout. (Register row 19.)

**AC-10 — `ensureExcluded` resolves the exclude file through git and never throws.**
It asks git for `--git-path info/exclude`, resolves a relative answer against `repoDir` (so a
worktree or a `.git` file layout is honoured), creates the parent directory, and appends the pattern
only when it is not already present as a whole line — preserving today's newline handling, including
the empty-file case. Any failure produces the same warning on the same channel as today, naming the
target path and git's message, and returns normally.
*Test:* first call appends, second call does not, a file without a trailing newline gains one, a
pattern that is a prefix of an existing line is still appended, and a repository git cannot read
produces a warning rather than an exception.

**AC-11 — The `core → shared` edge: the closed sets are closed, and no literal is re-spelled.**
The containment states and the indeterminate reasons are declared once as `as const` tuples with
their inferred union types, in `packages/shared`, and `core`'s return types are built from them, so
a state or reason outside the set is a compile error. `core/git.ts` takes `.harness/worktrees` and
the `/` → `__` rule from `REPO_WORKTREE_ROOT` and `worktreeDirName` rather than re-spelling them.
Nothing in `shared` imports from `core`. No `any`, no `@ts-ignore` without a same-line reason, no
new dependency — the module needs `node:child_process`, `node:fs` and `node:path` and nothing else.
*Test:* a source-level assertion that the literals `.harness` and `replace(/\//g` do not appear in
`packages/core/src/git.ts`, plus `pnpm typecheck` and `pnpm lint` green. (Subject to OQ-1: if the
gate places the types in `core` instead, this criterion's first sentence moves with them and the rest
stands.)

**AC-12 — The module's behaviour is asserted by tests that ship with it.**
E13's library-level assertions (`spike/test/q0035-empty-range.js:150`, `:542–557`) come across as
Vitest tests in `packages/core`, and the nine board cases of `spike/test/q0036-board-containment.js`
are covered here at the library level against `containment()` — that file itself stays with the
spike until Q-0010, per charter §5. Every test builds its own throwaway repository. `pnpm test` is
green from a clean clone.
*Test:* the suite runs under `packages/core`'s existing Vitest configuration and is picked up by the
workspace CI job with no change to `.github/workflows/ci.yml` or `turbo.json`.

**AC-13 — Behaviour is preserved, and anything found is reported rather than fixed.**
No file under `spike/**` is modified (charter §3, enforced by the `port freeze (branch scope)` CI
job), the spike suite passes unchanged, and no observable behaviour of any ported function differs
from the spike's. Any defect, inconsistency or improvement the implementer notices while reading is
named in the step's implementation report — which the engine writes to the ticket folder from the
step's declared output, so it is a surface this flow can produce — and is not acted on.
*Test:* the freeze job is green on the branch, and the report either names findings or states that
there are none.

## Non-goals

- **Rendering.** The board's `main:contained` / `main:not-contained(+12)` / `main:indeterminate(<reason>)`
  token is the CLI's, and moves in Q-0010. This ticket produces the states; it prints nothing.
- **The board command itself**, `loadProject`, ticket frontmatter — Q-0043.
- **`materialiseDiff`, the empty-range message, the range guard and the preflight** — Q-0051. This
  ticket ships the evidence-gathering primitives those consume and none of the prose that quotes them.
- **`fanout.js`** — Q-0048, which depends on this.
- **Fixing anything.** Including `ensureExcluded`'s `console.warn` (OQ-2) and `finish()`'s
  task-branch rollback gap (register row 20, Q-0050's to carry forward unfixed).
- **Editing `spike/**`** (charter §3), the cutover, the `quorum` binary, persisting the event stream,
  and everything on v1's exclusion list.
- **Caching or persisting containment** in frontmatter, in `.quorum/` or in memory across
  invocations. The 2026-08-24 decision requires it derived fresh; a cache is the same drift with an
  extra file.
- **A `--base <ref>` flag**, a new git capability, or any read of the reflog — machine-local, expiring
  and absent from a clone.

## Open questions

| # | Question | Owner | Blocker? |
| --- | --- | --- | --- |
| OQ-1 | Do the closed sets (`ContainmentState`, the indeterminate reasons) live in `packages/shared` or in `packages/core/src/git.ts`? | Ruud, at the requirements gate | **Yes** — it decides AC-11 and what Q-0010 and M3's UI import |
| OQ-2 | `ensureExcluded` prints with `console.warn`. Preserve, or route to the event stream? | Ruud | No |
| OQ-3 | Preserve `containment()`'s closure shape (`{ stateOf }`), or return a plain function? | Implementer | No |
| OQ-4 | Duplicate the nine board cases at library level now, or leave `containment()` covered only by the spike's CLI suite until Q-0010? | Ruud | No |
| OQ-5 | The glossary lists three indeterminate reasons; the module can produce four. Docs gap, or correct as written? | Ruud | No |

**OQ-1, recommended answer: `shared`, additively.** Charter §4 gives `shared` the shared types and
forbids the reverse edge; the CLI in Q-0010 and the UI in M3 both render these three states and must
not re-derive the reason strings from prose. It is a new module plus one line in
`packages/shared/src/index.ts`, changes no existing schema, and breaks nothing Q-0041 landed. It is a
blocker only because it touches the package thirteen tickets import, and that is not a call for an
implementer in a worktree to make alone. If the answer is `core`, nothing else in this requirement
changes.

**OQ-2, recommended answer: preserve exactly.** A library that writes to the console is a wart, and
`packages/shared`'s event union already has a `warn` member — which is precisely why this is
tempting and why it must not happen here. The channel a warning travels on is Q-0050's to decide, and
converting it now is an unregistered behaviour change under charter §2. Preserve, and name it in the
implementation report.

**OQ-3, recommended answer: preserve the closure.** The per-invocation probes it holds are what make
AC-6's 2n + 3 budget possible; flattening it to a plain function either re-probes per ticket or moves
the caching to the caller.

**OQ-4, recommended answer: duplicate at library level.** Charter §1 requires each child to ship its
module's tests, because chore's `integrate` step otherwise runs two suites, passes, and has examined
nothing this run produced — *"skipped is not passed"*, arriving through a route that looks like proof.
Two statements of the board's behaviour coexist until Q-0010 retires the CLI-driven one, which
charter §5 already accepts for the port as a whole.

**OQ-5, recommended answer: no doc edit here.** `GLOSSARY.md`'s Containment entry describes the
board, and the board genuinely has three reasons for the structural reason given above. The fourth is
reachable only through the empty-range diagnostic. The type should carry a comment saying which
surface can produce which, and a docs change — if one is wanted — belongs to Q-0051, which owns that
diagnostic's prose.

## Risks

**The rewrite that makes `tsc` happy is the rewrite rule 1 forbids.** `execFileSync` throws
`unknown` in strict TypeScript, and `e.status` is not reachable without narrowing. The shortest
route to a clean compile is `catch { return false }` or `catch (e: any)` — the first is exactly the
defect Q-0035 removed, the second is an ESLint error. AC-2's non-repository and missing-ref cases
exist to make the first one red rather than plausible. This is the single most expensive thing in
this ticket to lose.

**Both suites can be green over a wrong port** (charter §2): the spike keeps the old behaviour and
a test ported alongside a mis-ported module agrees with it. The mitigation here is unusually strong
and should be used — every criterion above is asserted against *real git*, not against a
transcription, so the independent witness is git itself rather than the spike's suite.

**`harness/Q-0042/integration` does not exist yet.** Charter §8's first checklist item: `review` diffs
`harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later, creates
the left endpoint. Forgetting it fails the run *after* the implementer has been paid — how Q-0035
lost $13.86. Create the branch before the first chore run.

**Environment variance in the fixtures.** `rev-parse --is-shallow-repository` needs git ≥ 2.15, and
`worktree remove --force` and `for-each-ref --format=%(refname:lstrip=2)` have their own floors. A
test that fails on the CI image for a git-version reason reads as a port defect. Prefer fixtures
built with plain `init`/`commit`/`clone --depth`, which is what both spike suites already do.

**Scope creep into Q-0051.** `emptyRangeEvidence` is one function away from the empty-range message,
and the message is the interesting part. It is not this ticket's, and writing it here would collide
with Q-0051's ownership of the same file set.

## Cross-cutting checklist

- **BYOS** — n/a and provably so: the module reads no environment variable, accepts no credential
  and spawns only `git`. No test, fixture or comment may introduce one.
- **Worktree safety** — this is the enforcement point (register row 19). AC-9 covers the location,
  the naming and the untouched working tree; AC-10 covers the exclusion that keeps `.harness/` out of
  the user's status.
- **Gate behaviour** — n/a. This module presents no gate and reads no counter.
- **File format and schema** — the module writes no product file. It appends one line to the
  repository's own `info/exclude` (AC-10) and creates worktree directories (AC-9). The closed-set
  types are declarations, not a persisted format (AC-11, OQ-1).
- **Lint rules** — n/a; the flow lint is Q-0044. ESLint's two workspace rules apply (AC-11).
- **Cold-clone impact** — none. A library port with no new dependency, no new command and no change
  to what a newcomer runs in their first thirty minutes.
- **Cost** — the charter's estimate is $25–39 per child; this is the second of fourteen, and the
  cost checkpoint (charter §9) falls after the first three reach `reviewed`.
