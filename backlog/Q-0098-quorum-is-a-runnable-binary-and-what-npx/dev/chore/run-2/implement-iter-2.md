# Q-0098 implement — run 2, iteration 2

*Revision round. Two majors from `review/chore/run-2/chore-iter-1.md`, both addressed. One file
changed: `packages/cli/src/build.test.ts`, +183 / −50.*

---

## 1. The two findings

### Major 1 — AC-18 executed the shim, not the mechanism (`build.test.ts:1466`)

**The finding is correct.** AC-18's R-4 procedure selected **Mechanism A**, whose documented command
is `pnpm exec quorum help` from the repository root. Iteration 1 asserted
`execFileSync(shim, ['help'], …)` — the generated `sh` script, by absolute path. That proves the shim
file is runnable; it says nothing about pnpm's own command resolution, which is the step a
contributor actually depends on, and nothing about a package runner being unable to satisfy the name.

**What changed.** Three things, deliberately kept as separate facts rather than merged into one
assertion:

1. **`offline(cache)` is now a single module-level helper** (`:1439`–`:1460`) rather than an object
   literal rebuilt per fixture. Closed loopback port, a cache directory the caller owns, zero
   retries, audit and fund off. Extracted because AC-20 asks *both* supported paths to configure
   execution the same way, and two spellings of "no registry can answer" are two guarantees that can
   drift under one word. Used by the new AC-18 test, by AC-19(b)'s install, and by the
   registry-is-dead test.
2. **A new test runs the documented command** (`:1507`): `attempt('pnpm', ['exec', 'quorum', 'help'],
   offline(cache))`, asserting exit 0, `usage: quorum` on stdout, and that the command list equals
   `helpNames(HELP)` — derived from `HELP` rather than transcribed, the same discipline AC-15's
   plain-node spawn already uses.
3. **A new test shows the no-fallback guarantee discriminates** (`:1527`). This is the one that
   matters: without it, "it ran under a dead registry" is decoration, because a command that never
   consults a registry proves nothing by failing to reach one. It asserts on the **message** and not
   merely on the non-zero status — a fetch against the closed port would also fail, and "it failed"
   would then pass for a reason unrelated to this commit. pnpm declining to resolve a name locally
   and pnpm failing to reach a registry are different sentences, and only the first is evidence.

**The existing package-link assertions are retained in full** (`:1495`–`:1504`), as the review asked.
The direct shim exec is kept too, with a comment saying what it is: AC-16's *"and under an installed
shim"* half — the fact that the mode bit reaches an installed launcher. It is no longer presented as
AC-18's mechanism.

### Major 2 — the packer agreement checked one of three packages (`build.test.ts:1647`)

**The finding is correct, and its second half — the unguarded manifest claim — is the more serious
one.** AC-19 defines a three-package distribution set (R-2), `@quorum/core` and `@quorum/shared` are
packed by AC-19(b) and installed into the consumer, and the test packed only `packages/cli`. A
divergence in either of the other two would have shipped a different tarball from the one the suite
checked, while the test comment and iteration 1's report both claimed agreement across all three.
That is the fail-open shape this repository keeps finding — Q-0051 in `q0050.source.test.ts`, Q-0097
in `test-discovery.test.ts`.

**What changed.**

1. **The pack helpers were restructured** so the packer is an explicit argument rather than baked in:
   `packWith(packer, directory, destination)` returns the tarball path, `pathsIn(tarball)` its file
   list, `manifestIn(tarball)` its **packed manifest** — which is not always the manifest on disk,
   and that is the point. `packedPaths` survives as a one-line pnpm wrapper so the two earlier tests
   did not churn.
2. **The agreement test loops over `DISTRIBUTION`** (`:1735`), comparing both packers' file lists for
   `cli`, `core` and `shared`, each with a vacuity guard naming the package.
3. **A second test guards the manifest divergence** (`:1756`) — the reviewer's *"if the divergence is
   intended to remain guarded"*. It is intended, and it is load-bearing: it is the entire reason
   AC-19(b) packs with pnpm. If pnpm stopped rewriting `workspace:*`, that install would fail at
   dependency resolution against a closed registry and the error would name a **network** rather than
   a **protocol** — a confusing failure a long way from its cause.

**The divergence applies to more than the CLI, which the review's wording did not assume and the
measurement settles.** `@quorum/cli` declares `workspace:*` on core and shared; `@quorum/core`
declares it on shared; `@quorum/shared` declares none. So the guard's subject is `['cli', 'core']`,
pinned as a **register rather than a count** (Q-0073: *a count is not an identity*), with
`@quorum/shared`'s absence stated and its reason given. The expected pnpm value is derived from the
sibling's own manifest via `versionOf`, so the assertion is about *the substitution* and not about
`0.0.0` happening to be the current version.

---

## 2. The measurements that decided the shape

Run before the code, not after it.

**M-A — `pnpm exec` is not a package runner.** `pnpm exec definitely-not-a-real-binary-q98 --version`
at the repository root exits **254** with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "…" not
found`. It installs nothing and consults no registry — unlike `npx`, and unlike `pnpm dlx`. So the
dead-registry environment is belt-and-braces and the *structural* guarantee is what carries AC-20's
"fails rather than falling back". Both are now asserted, because relying on the environment alone
would be asserting a property of a tool nobody measured.

**M-B — the divergence, executed rather than described.** With the packers swapped in the new guard,
the failure message is `expected 'workspace:*' to be '0.0.0'`. That is OQ-3's divergence measured
directly: **npm's packed manifest carries the literal `workspace:*`; pnpm's carries `0.0.0`.** Both
branches M-8 poses as alternatives are real, one per packer.

**M-C — `pnpm exec quorum help` succeeds under `offline()`.** Confirmed; corepack did not attempt to
fetch `pnpm@10.31.0` under the dead registry, which was the risk worth checking before relying on the
environment.

---

## 3. Demonstrated red before green

Every new assertion was shown to fire, by mutating its subject rather than by reading it — *"A check
is not established by reading it"* (2026-08-29). Each mutation was reverted and the manifests are
byte-restored (`git status` reports one modified file).

| # | mutation | result |
| --- | --- | --- |
| 1 | `node_modules/.bin/quorum` moved aside | `pnpm exec quorum help` → **exit 254**, test red: `expected 254 to be +0` |
| 2 | no-fallback probe aimed at `quorum` (which *is* linked) | red: `pnpm exec resolved a command that is linked nowhere — it fell back` |
| 3 | `@quorum/shared`'s `files` set to `["package.json"]` | red: **`@quorum/shared` packed nothing — the comparison is vacuous** |
| 4 | the two sides packed different packages | red: `pnpm pack and npm pack disagree on which files @quorum/cli ships` (63 vs 17 paths) |
| 5 | packers swapped in the manifest guard | red: `pnpm no longer rewrites @quorum/core for @quorum/cli … expected 'workspace:*' to be '0.0.0'` |
| 6 | `@quorum/core`'s `workspace:` dependency removed | red: `the set of packages declaring a workspace dependency moved: expected ['cli'] to strictly equal ['cli','core']` |

**Mutation 1 is the strongest result and deserves naming.** `quorum` is a name that exists on the
public registry. With no local shim, `pnpm exec quorum help` **exits 254 rather than fetching it** —
so the no-fallback claim is proven against the real command name and not only against a synthetic
one. Under `npx` that same line would have installed a stranger's package, which is exactly what
AC-20 and decision 078(d) exist to refuse.

**Mutation 3 is what shows Major 2 was a real gap:** before this round that mutation passed unnoticed,
because `@quorum/shared` was never packed by the test at all.

**Mutation 4 covers the fail-open risk nobody named** — that the equality assertion might be comparing
a thing with itself if `packWith`/`pathsIn` silently returned one tarball. It does not.

---

## 4. Two false authority citations, found and fixed

Not in the review, and reported here rather than fixed silently, because one of them is an obligation
only the human can discharge.

**`requirements/errata.md` on disk contains exactly one entry, E-1** (the pack-count ruling).
Iteration 1 left two comments citing errata that do not say what the comment claims:

- **`build.test.ts:1272` cited "E-2", which does not exist.** Rewritten to state the measurement
  directly: AC-26 words the constraint as *"`path.relative(PACKAGE, target)` has exactly one path
  segment"*, and `path.relative(PACKAGE, dist/quorum.js)` splits into **two** — so the literal
  wording is satisfied only by a target at the package root and contradicts the criterion's own
  admissibility table, which lists `dist/quorum.js` as admissible. The code asserts the property both
  readings agree on (`path.join(here, '..')` resolves to the package root) and was already correct;
  only the justification was pointing at nothing.
- **`build.test.ts:1555` cited "E-1 of this ticket's run"** for the pnpm/npm manifest divergence. E-1
  rules on pack **counts** and says nothing about packers or the workspace protocol. Rewritten to
  state the measurement and to point at the new guard that now executes it.

`build.test.ts:194`, `:239` and `:358` also cite E-1/E-2 — those are **Q-0097's** lines and Q-0097's
errata, and are correct. They were checked, not assumed, and left alone.

A dangling citation is worse than no citation: `harness/rules.md` says *cite, do not transcribe*,
which only works if following the pointer arrives somewhere.

---

## 5. Owed at the gate — GO-2

**An erratum ruling AC-26's wording is owed, and an implement step may not write it.**
`developer-generalist`'s paths do not include `backlog/`, and the engine discards a ticket file an
agent writes. The contradiction is provable by arithmetic (§4 above) and it is *only* a wording
defect — no code moves either way, because the shipped assertion is the property both readings share.
Recorded in the source comment as a measurement with the erratum named as owed, which is the channel
available to this step. Nothing in the run is blocked on it.

*"A refused finding is a gate, not another round"* (2026-08-31); Q-0097's run cost two errata by
writing one from a claim, so this one states what was **run**: `path.relative` was evaluated, not
reasoned about.

---

## 6. What I deliberately left alone

- **No new criterion, no new command, no `COMMANDS`/`HELP`/`HANDLERS` change.** Non-goal 4; the
  `frame.source.test.ts` AC-8 scan is what would fail.
- **The `workspace:*` → `0.0.0` divergence is guarded, not resolved.** Resolving it means bundling —
  078 Shape D, non-goal 7, which acquires its subject at Q-0091's first value import.
- **No `scratch()`/temp-directory helper was extracted**, though the file has ten `mkdtempSync` sites
  and four of them (Q-0097's, at `:773`, `:814`, `:860`, `:1113`) do not register with `isolated`.
  New code follows the neighbouring Q-0098 idiom — `mkdtempSync` then `isolated.push` — because
  extracting the helper would have invited changing those four, which are not this ticket's. Reported
  rather than tidied.
- **`@quorum/core`'s pack size** — OQ-4, still the gate's judgement at the close. `files: ["dist"]`
  bounds it; whether what remains wants a successor is not a blocker.
- **`spike/` untouched.** `packages/core/src/spike-parity.test.ts` needed no re-derivation and **its
  totals did not move** — this round adds no file under `spike/test/` and changes none. Stated rather
  than skipped, per the requirement's §9.
- **AC-19's registered limit is unchanged and still applies:** `packages/cli`'s emitted JavaScript
  carries no runtime `@quorum/*` specifier, so the packed fixture proves the easy case — a CLI whose
  binary needs nothing from its declared dependencies at run time. It acquires its real subject at
  Q-0091's first value import (078(g)).
- **AC-17's registered limit is unchanged:** the boundary proof shows the emit does not swallow a
  status. It proves no command's code, and the table's 130 is Node's default disposition rather than
  the frame's contract (M-10). Both are Q-0091 to Q-0094's.

---

## 7. Verification

Both environment rows are not available to an implement step — this is the worktree row; the `main`
row is owed after the merge, per Q-0072's closing finding.

Installed first, per `harness/rules.md` (`commands.install` runs only in an `integrate` worktree):
`pnpm install --frozen-lockfile` → *Already up to date*, then `pnpm turbo run build`.

| check | result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `packages/cli` suite | **158 tests, 10 files** — `build.test.ts` 47 → **50** |
| `npm test --prefix spike` | **19/19 files** |
| `node spike/bin/harness.js lint` (inside the worktree) | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

Net test count from this round: **+3** — two AC-18 tests, and the packer block split from one test
into two.

---

## 8. One leftover, stated rather than hidden

I created `.harness/q98probe/` in this worktree while measuring `pnpm exec`'s fallback behaviour and
the pack output, and **could not remove it**: `rm -rf` on that path was refused by the harness's
permission configuration, in both absolute and relative form. It is under `.gitignore`'s `.harness/`
entry, `git status` does not see it, and it is therefore **not committed** — the worktree itself is
removed at the end of the run (Q-0062). Named because a fixture leaking under a directory nobody
inspects is a defect this repository has already paid for once, in worktrees, and because a reader
finding it should know where it came from.

Two other permission notes, in the Q-0038 class rather than as complaints: `npm install --prefix
spike` and a bare `npm pack` are both refused at the Bash level, so the spike suite was run against
its already-installed `node_modules` and every `npm pack` measurement was made **inside the test
suite**, which is where the reviewer wanted them anyway.

---

## 9. File by file

**`packages/cli/src/build.test.ts`** — the only file changed.

| region | change |
| --- | --- |
| `:1439`–`:1460` | new module-level `offline(cache)`, the single definition of "nothing can be fetched" |
| `:1463`–`:1475` | new `attempt()` in the AC-18 block — runs at the repository root, reports streams instead of throwing |
| `:1500`–`:1504` | the direct shim exec kept, relabelled as AC-16's "under an installed shim" half |
| `:1507`–`:1525` | **new** — `pnpm exec quorum help` under `offline()`, command list derived from `HELP` |
| `:1527`–`:1545` | **new** — `pnpm exec` declines rather than falling back, asserted on the message |
| `:1690`–`:1720` | `packWith` / `pathsIn` / `manifestIn` / `manifestOf` / `versionOf` / `workspaceDepsOf`; `packedPaths` kept as a pnpm wrapper |
| `:1666`, `:1679` | AC-19(b)'s inline pack loops routed through `packWith`; its env is now `offline(cache)` |
| `:1728`–`:1732` | the registry-is-dead proof now uses the **same** `offline()` the fixtures use, not a second spelling |
| `:1735`–`:1754` | packer agreement over all three packages, each with a vacuity guard naming it |
| `:1756`–`:1791` | **new** — the manifest divergence guarded, over the `['cli','core']` register |
| `:1269`, `:1555` | two false errata citations replaced with the measurements they should have carried |

No manifest, lockfile, flow, document or `spike/` file was touched this round.
`packages/core/package.json` and `packages/shared/package.json` were mutated during the red
demonstrations and restored byte for byte — confirmed by `git status`, which reports one modified
file.
