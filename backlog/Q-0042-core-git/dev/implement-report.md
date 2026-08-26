# Q-0042 — implementation report

`core/git`: worktrees, ancestry and containment. Chore route, iteration 1 — no review report from an
earlier round was present, so nothing below is a revision.

## What shipped, file by file

### `packages/shared/src/containment.ts` — new (AC-11, OQ-2)

The closed sets, declared once as `as const` tuples with their inferred union types, following the
`FINDING_SEVERITIES` precedent in the same package:

- `CONTAINMENT_STATES` — `contained`, `not-contained`, `indeterminate`.
- `ANCESTRY_REASONS` — `git failed`, `shallow clone`, `shallow state unknown`.
- `CONTAINMENT_REASONS` — `missing ref`, `shallow clone`, `git failed`.

and the two result shapes built from them, `AncestryResult` and `ContainmentResult`. The header
records which surface can produce which reason (requirement fact 2: `containment()` structurally
cannot emit `shallow state unknown`, because the same combined probe that would leave the shallow
state unknown makes the function return `null` before any branch is examined — which is why
`GLOSSARY.md` lists three board reasons while this module can produce four).

Impossible combinations are unrepresentable rather than merely undocumented. `contained` carries
`reason?: never` and `ahead?: never`, `not-contained` carries `reason?: never`, and `indeterminate`
requires a reason from its own set. The `?: never` members are load-bearing: without them the claim
holds for fresh object literals (excess property checking) and silently fails for anything assigned
through a variable.

A six-line `StatesAreClosed` proof asserts both result shapes draw their `state` from
`CONTAINMENT_STATES`. It uses an unsatisfied `Assert<T extends true>` constraint deliberately — a
conditional type that merely evaluates to `never` compiles cleanly and would prove nothing.

The module imports nothing, adds no dependency (`zod` is still `shared`'s only one), reads no file
and spawns nothing, so it stays inside the constraints `shared`'s own suite already enforces.

### `packages/shared/src/index.ts` — one line

`export * from './containment.js';`, in alphabetical position. It satisfies the entry point's
existing per-line regex (`^export \* from '\./[a-z-]+\.js';$`), which is why the filename is
lowercase-and-hyphen.

### `packages/core/src/git.ts` — new, the port

All eight functions, behaviour preserved: `ensureWorktree`, `removeWorktree`, `ancestry`,
`shallowState`, `shortSha`, `emptyRangeEvidence`, `containment`, `ensureExcluded`. The spike's
comments came across with them — they are the decided rationale, not implementation notes, and each
of them is the reason its function is not shorter.

**The `unknown`-typed throw, which is where rule 1 dies in a rewrite.** `execFileSync` throws
`unknown` under `strict` and `e.status` is not reachable without narrowing, so the two shapes the
requirement names as risks (`catch { return false }` and `catch (e: any)`) are the shortest routes to
a clean compile. Instead there is one `errorProperty(error, key)` guard, and two readers over it:

- `exitStatus(error)` returns the child's status only when it is a **number**, so anything that is
  not a number is not a `1` and takes the `git failed` path. A spawn failure, a signal, a missing
  binary and a thrown non-Error all reach `indeterminate`, never `not-contained`.
- `failureDetail(error)` is the spike's `firstLine(e.stderr) ?? firstLine(e.message)`, unchanged,
  including the 200-character truncation and the `null` when neither yields a line.

**Constants taken rather than re-spelled.** The worktree root is `REPO_WORKTREE_ROOT` and the
`/` → `__` rule is `worktreeDirName`, both from `shared`. The exclude pattern `'.harness/'` stays a
literal with a comment saying why: `TICKET_ARTIFACT_DIR` is the other `.harness` namespace, lacks the
trailing slash, and this string is appended to a file in the user's repository, so it is externally
observable and must survive byte for byte.

**One narrowing decision worth pointing at.** `containment` needs an `AncestryReason` as a
`ContainmentReason`, and the sets differ by one member. Rather than widen the board's set or leave an
unreachable branch untyped, there is a three-line `boardReason()` with the structural argument in its
doc comment. It changes no observable behaviour: `containment` passes a boolean `shallow`, so
`ancestry` returns only `shallow clone` or `git failed` there, and `boardReason` maps both to
themselves. I considered an overload on `ancestry` that would make the fact type-level instead;
rejected because TypeScript does not verify an implementation's return type against each overload
signature, so it would be an unchecked assertion wearing a type's clothes.

Only `node:child_process`, `node:fs` and `node:path`. No `any`, no `@ts-ignore`, no new dependency,
no `shell`, no `execSync`, no string command line — every call is `execFileSync` with an argv array.

### `packages/core/src/git.test.ts` — new, 49 tests (AC-2 … AC-10, AC-12)

Every case builds the repository, topology and shallow state it asserts. No case asserts the
containment state of a branch in *this* repository — that would be red until the next landing and
green forever after, which the permanent-acceptance-test decision (2026-08-23) forbids.

E13's library-level assertions (`spike/test/q0035-empty-range.js:150`, `:542–557`) came across whole,
and q0036's nine board cases are covered at the library level against `containment()`: C1 contained
plus "nothing written", C2 `base..branch` and not the symmetric difference, C3 the two unannotated
cases, C4 `missing ref`, C5 shallow, C6 not a repository, C7 a `master`-based repository (the
configured base used literally), C8 the three injection-shaped values, C9 a tag beside a branch of
the same name. The CLI-driven file itself stays with the spike until Q-0010, per charter §5.

Two mechanisms are worth flagging to the reviewer because they are the only unusual thing in the
suite:

- **A counting/failing `git` first on `PATH`** (`installGitShim`). It counts process spawns for
  AC-6's ≤ 2n + 3 budget without changing the module's signature — the requirement names this as an
  acceptable means — and, with an `exit 3` for a chosen subcommand, it is how AC-4's two
  `git failed` cases are reached at all. A repository healthy enough to have been probed, with a
  branch that came out of `for-each-ref` and a base that resolves, cannot otherwise make
  `merge-base` or `rev-list` fail. POSIX only, which the workspace already is
  (`04-architecture.md` puts Windows beyond WSL out of v1).
- **A `file://` clone with `--depth 1`**, because `--depth` is silently ignored for a plain local
  path — as `q0036-board-containment.js:132` already notes. Each fixture asserts
  `rev-parse --is-shallow-repository` reports `true` before relying on it, so a test cannot pass by
  being accidentally deep.

### `packages/core/src/git.source.test.ts` — new, 9 tests (AC-1, AC-5, AC-11)

The criteria that are properties of the code rather than of its behaviour, and that a later module
would break silently: `merge-base` and `--is-ancestor` appear in `git.ts` and in no other source
file; the module exports exactly the eight functions; `packages/core/src/index.ts` still reads
exactly `export const name = '@quorum/core';`; the forbidden spellings `replace(/\//g` and
`.harness/worktrees` do not appear in `git.ts`; the exclude literal and the `TICKET_ARTIFACT_DIR`
comment are present; `shared` declares the three sets, adds no dependency and re-exports the module;
and neither file describes a branch as merged, landed or shipped.

The type-level half is five `@ts-expect-error` directives — an out-of-set ancestry reason, a
`contained` with an `ahead`, a `not-contained` with a `reason`, an `indeterminate` without one, and
`shallow state unknown` as a board reason. Each fails the build if the line it guards ever starts
compiling, so `pnpm typecheck` passing is itself the assertion.

### `packages/core/test/repo.ts`, `packages/core/test/corpus.ts` — new test support

Outside `src/` because Vitest collects `src/**/*.test.ts` and these are not suites — the same reason
`packages/shared/test/corpus.ts` sits where it does. Both readers fail loudly when their subject is
missing rather than reporting a pass over nothing.

## Verification

| | |
| --- | --- |
| `pnpm lint` | green |
| `pnpm typecheck` | green (this is what proves the five `@ts-expect-error` directives) |
| `pnpm test` | green — 7 packages; `@quorum/core` 60 tests in 4 files, `@quorum/shared` 86 in 9 |
| `git status` | `spike/**` untouched; `packages/core/src/index.ts` untouched; one line added to `packages/shared/src/index.ts` |

**Mutation-checked, because both suites can be green over a wrong port.** I temporarily broke the two
rules that cost the most to lose and confirmed the suite bites:

- Removing rule 1's `exitStatus(error) !== 1` guard — the `catch { return false }` shape Q-0035
  removed — turns **5 tests red**, including AC-2's non-repository and unresolvable-ref cases and
  AC-4's `git failed` case.
- Reading a failed shallow probe as `false` instead of `null` turns **1 test red** (AC-3).

Both were reverted; the shipped file is the unmutated one.

**The spike suite could not be run in this worktree, and that is an environment gap rather than a
result.** `npm test --prefix spike` fails all 11 files with `Cannot find package 'yaml'` because
`spike/node_modules` does not exist here, and `npm ci --prefix spike` is not permitted in this
sandbox. No file under `spike/` was modified or deleted (see `git status` above), the `port freeze
(branch scope)` CI job answers that question independently, and CI's `spike` job runs `npm ci`
before `npm test`. The chore flow's `integrate` step will run both halves of
`npm test --prefix spike && pnpm turbo run test` in a worktree that installs first.

## Deliberately left alone

- **`packages/core/src/index.ts`** — not modified, so `packages/shared/src/index.test.ts:52`'s byte
  pin stays green. Q-0048, this ticket's only declared dependent, is in the same package and imports
  `./git.js` directly. This is AC-1 and OQ-1 as decided; the pin itself is reported below.
- **Rendering.** No `main:contained` / `main:not-contained(+12)` / `main:indeterminate(<reason>)`
  token is produced anywhere. This ticket produces states; the CLI prints them (Q-0010).
- **`materialiseDiff`, the empty-range message, the range guard, the preflight** — Q-0051.
  `emptyRangeEvidence` ships as the primitive and none of the prose that quotes it.
- **`fanout.js`** — Q-0048. **`loadProject`, the board command, frontmatter** — Q-0043.
- **Docs.** No numbered doc, `GLOSSARY.md` or `DECISIONS.md` edit. OQ-5 decided there is none to
  make here, `04-architecture.md` already lists `git` among what `core` is seeded from, and the
  fourth reason's prose belongs to Q-0051.
- **Caching or persisting containment** — nothing is stored, cached or carried across invocations.
- **Retries, timeouts, cancellation, command logging, a general git abstraction, remote refs or tags
  as containment sources, any read of the reflog** — none added.

## Findings: noticed while reading, reported and not acted on (AC-13, charter §2)

None of these is a defect I introduced, and none is fixed.

1. **The byte pin is a phase-bound fact persisted as an assertion (OQ-1).**
   `packages/shared/src/index.test.ts:52–53` pins `packages/core/src/index.ts` byte for byte under
   the heading *"core declares the dependency, and nothing else in core changed"*. Its own comment
   says it exists to prove Q-0041's diff was minimal — a fact about one run's scope, guaranteed false
   the moment any child adds a public export to `core`. It cost this ticket nothing, because Q-0042
   needs no re-export. It **will** block the first child that does, most likely Q-0043, whose board
   work needs `containment` reachable from the CLI. Narrowing it to what it actually protects (that
   `packages/core` declares `@quorum/shared` as `workspace:*`) is a two-line edit.

2. **`ensureExcluded` writes to the console from a library (OQ-3).** Preserved exactly, with a
   comment saying why it must not change here: what a command prints is externally observable, and
   the channel is Q-0050's to decide. `shared`'s event union already has a `warn` member, which is
   precisely what makes this tempting.

3. **`shallowState` maps any successful non-`true` output onto `false` (OQ-4).** Preserved. My
   judgement, offered rather than acted on: it is asymmetric with rule 1 — a probe that succeeded but
   printed something unrecognised is no more evidence of "not shallow" than a probe that failed. It
   is unreachable today, since `rev-parse --is-shallow-repository` prints exactly `true` or `false`,
   and becomes reachable only if git changes that. A test pins the current behaviour so a later
   ticket that wants to change it has to say so.

4. **`ensureWorktree` has no equivalent of `containment`'s branch-name guard, and argv does not close
   that gap.** `containment` matches each ticket's `branch` value against git's own branch list, so a
   hostile name never reaches a command line. `ensureWorktree` interpolates whatever it is handed
   into `refs/heads/${branch}` and passes it to `worktree add -b <branch>`. argv prevents *shell*
   injection; it does not prevent *option* injection — a branch name beginning with `-` is parsed by
   git as an option. It is latent rather than live, because every caller composes the name as
   `harness/<ticket-id>/<leaf>` and the prefix means the argument never starts with a dash. Worth
   knowing for Q-0048, which owns the fan-out that builds those names from an agent-written
   `tasks.yaml`.

5. **A worktree directory deleted by hand wedges the branch.** Both `ensureWorktree` and
   `removeWorktree` decide what to do from `fs.existsSync(dir)` alone. If the directory is gone but
   git still has the worktree registered, `removeWorktree` issues no removal and the stale
   administrative entry survives; the next `ensureWorktree` then fails on git's *"missing but already
   registered worktree"*. Existing behaviour, preserved.

6. **The `.harness/` exclude pattern hides more than the worktree root.** `info/exclude` patterns
   without a leading slash match at any depth, so `.harness/` also excludes every ticket's
   `TICKET_ARTIFACT_DIR` — `backlog/<ticket>/.harness/`, where `<step>-verdict.json` and the raw text
   saved on invalid structured output land. `git ls-files` confirms nothing under any `.harness/` is
   tracked in this repository today. This may well be deliberate (those artifacts are run scratch),
   but the constant comments describe the two namespaces as unrelated, and one pattern silently
   covers both. Not changed: the pattern is externally observable and register row 19 territory.

## Notes for the gate

- **Nothing here implies a decision entry.** OQ-2 (the closed sets live in `shared`) was decided at
  the requirements gate and is implemented as decided; the rest is a behaviour-preserving port.
- **The invariant register rows this ticket inherits are rows 8 and 19.** Row 8 is `ancestry`'s three
  values, the shallow asymmetry and the three-valued probe — AC-2 and AC-3, each mutation-checked
  above. Row 19 is worktrees under `.harness/worktrees/` and the user's working tree never written
  to — AC-9, which asserts `git status --porcelain` is empty after a worktree is created, so the
  exclusion is proved by its effect rather than by the file's contents alone.
