# Q-0097 — implement, run 3, iteration 3

*A revision round. `review/chore/run-3/chore-iter-2.md` returned **one major**, against
`packages/cli/src/build.test.ts:182` — the `UNAUDITED` list. It is correct, it is not disputed, and
it needed no erratum: it contradicts no ground rule and no clause of "The emit serves the binary,
and no test verdict moves behind it" (2026-09-02), so GO-2's route was not used. **Three files
changed — 441 insertions, 134 deletions** — and the working tree afterwards is exactly those three.*

---

## 1. The finding, and what it actually was

> The AC-8 audit excludes `.git`, `.harness`, and `.quorum`, although AC-8 requires enumerating every
> path the real build writes and exempts only Turbo cache metadata and logs. A changed build script
> could write into or delete content under any of these directories while the exact-output check
> remains green; the test explicitly acknowledges this blind spot at lines 177–180, making it an
> **unchosen weakening of the criterion**.

Accurate in every part, and the phrase that decides the fix is *unchosen*. AC-8 grants **one**
exemption in its own words — *"Turbo's own cache metadata and logs are not treated as package
artifacts"* — and iteration 2 helped itself to four more. Its defence for two of them was true:
`.harness` and `.quorum` are written by any concurrent harness run, so auditing them in the real
checkout would take the verdict from the machine (*"A test's verdict is a property of the commit, not
of the checkout or the account"*, 2026-08-30). But that is an argument for **moving the
observation**, not for narrowing the criterion — and iteration 2 wrote the blind spot into a JSDoc
and called it an accepted limit rather than fixing it.

The remedy the reviewer names is the one taken:

> Replace the broad pruning with an observation strategy that distinguishes build writes from
> concurrent activity — such as instrumenting the build **or running the audited build in an isolated
> workspace** — while retaining the separately required real-workspace build proof.

Two observation strategies now exist, one per region, and **between them no hand-written list of
directory names excuses anything.**

---

## 2. What changed, file by file

### 2.1 `packages/cli/src/build.test.ts` — the audit

#### The isolated workspace (`isolate`) — new, and where AC-8's exactness now lives

A temporary copy carrying the emitting packages' **tracked** files and the root configuration turbo
needs to plan a build: the four files that make a directory a pnpm-and-turbo workspace
(`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`) plus root
`globalDependencies`, **read out of `turbo.json` rather than listed**, so a fifth arrives without
anyone remembering. Tracked files only, so the copy is the commit rather than the checkout — and
`dist/`, `.turbo/`, `.harness/` and `.quorum/` are all gitignored, so none of them arrives to be
mistaken for something this build wrote.

Two details are load-bearing rather than incidental:

- **`node_modules` is mirrored as a real directory of symlinks, not as one symlink.** A single link
  is a *leaf*, and a write under a leaf is invisible; a directory of links means a file the build
  creates there is a new entry and is reported. §3 M3 is the mutation that made me measure this
  rather than assume it.
- **The `@quorum` scope is re-pointed at the copy's own packages**, so the copy builds itself rather
  than the tree it was taken from. Verified: `packages/core/node_modules/@quorum/shared` in the copy
  resolves inside the copy.

The audit over it prunes **nothing at all** — 187 entries, 28 of them under `node_modules` — and the
one exemption is applied by **naming** turbo's metadata paths rather than by declining to walk the
directory holding them, so what is excused is enumerated. Measured on a clean isolated build:
**108 paths written, 96 under `dist/`, 12 under `.turbo/`, 0 strays, 0 removals**; ~150 ms to make
the copy, 1.9 s to build in it.

#### The real-workspace proof — retained, and given a different observer

R-4 and OQ-1 make it load-bearing: with no build step in CI, the forced workspace suite is the only
thing that builds this repository's own packages on every push, so an isolated-only AC-8 would leave
the real emit unbuilt until Q-0098. What the copy adds is exactness; what this adds is that **the
artifact everything downstream imports is the one that was audited**.

Two regions:

- **Outside** the emitting packages the observer is **git** — `gitVisible`, using
  `git ls-files --cached --others --exclude-standard`, the oracle *"Membership is a git question, not
  a filesystem one"* (2026-08-28) chose by name. This is precisely *"an observation strategy that
  distinguishes build writes from concurrent activity"*: git lists neither `.git` nor `.harness` nor
  `.quorum` nor `node_modules` nor the emit, so a concurrent harness run **cannot enter the audit**
  rather than having to be pruned out of it. The emit being gitignored, every path git can see is one
  the build has no business touching, so both clauses are a bare `toStrictEqual([])`.
- **Inside** them it is the walk, with turbo's metadata named rather than skipped and `node_modules`
  the only pruned name.

#### `UNAUDITED` (five names) → `INSTALLED` (one), and the difference stated

`node_modules` stays pruned **in the real-workspace walk only**, and its JSDoc says why in a measured
sentence rather than a plausible one: the `.vite` and `.vite-temp` directories inside each package's
own `node_modules` are written by **the Vitest process running this very test** — not a hypothetical
concurrent writer but the one running now. It is a bound rather than a blind spot **because the
isolated audit descends into it**, which is asserted in the isolated test and demonstrated in §3 M3.

#### `inventory` and `fingerprint` — `lstat`, so the audit is total

Split so one walker serves both. `fingerprint` handles the three cases the old `statSync` +
`readFileSync` shape could not survive once nothing was pruned: a regular file hashes, a **symlink**
records its target (so a copy's `node_modules` can be walked without walking an installed dependency
tree, and replacing a link with a file is still visible), and anything else records its mode.
`gitVisible` uses `lstatSync(…, { throwIfNoEntry: false })` — absence is **refused, never
classified** (Q-0073): a tracked path the working tree does not hold is skipped in *both* snapshots,
so a build deleting one is still reported by the comparison rather than quietly excused here.

#### The four tests of AC-8

1. *audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing
   else* — nothing pruned; removals asked of the whole copy; strays, and both directions against
   `outputs` per package.
2. *and that audit reports a build that writes into `.git`, `.harness` or `.quorum`, or deletes a
   file* — **the finding closed, run rather than argued.** The emitting package's **own** build
   script is read out of the copy and appended to, so what is exercised is a real build task writing
   where no criterion allows. It reports exactly `['.git/written', '.harness/written',
   '.quorum/written']` and the removal.
3. *the real workspace builds, and its emit and the declaration agree in both directions* — the two
   regions above.
4. *and the outside observer has a subject, and is blind to exactly what the copy covers* — a git
   repository the test builds itself, **staged and never committed**, so no identity is resolved
   (Q-0079). Three claims: git reports a tracked overwrite and a new unignored file; git is blind to
   a gitignored `.harness/worktrees/concurrent`, which is *why* no prune list has to name it; and the
   unpruned walk **does** see that path, so the region git cannot see is covered rather than excused.

Plus the replacement for the old five-fixture loop: *and the four names that left the exclusion list
are back in scope, while the one that stayed is not* — a fixture per name, derived from the lists, so
the change of reach is **priced** rather than asserted.

Kept unchanged in substance: the name-only-snapshot subject test (its closing sentence now says what
the two observers each rest on), the export-map declarations test, the `.tsbuildinfo` test, and all
of AC-7, AC-9, AC-12, AC-14 and AC-23. Call sites that relied on the old default prune now pass
`INSTALLED` explicitly, AC-23's `candidates()` among them with the reason in place.

### 2.2 `packages/cli/turbo.json` and `src/package.test.ts` — the reads the copy performs

Q-0072's rule, applied on the way in. `isolate()` opens files outside this package, so:

- **`../../pnpm-workspace.yaml` is declared** — the one new read nothing else hashes.
- `OUTSIDE` gains `pnpm-workspace.yaml`, `.nvmrc`, `packages/shared` and `packages/core`, each with
  the mechanism that hashes it: `.nvmrc` and `tsconfig.base.json` are root `globalDependencies`, and
  the two package subtrees arrive through the `^test` edges the workspace dependencies create.
  `tsconfig.base.json`'s existing entry gained the second reader rather than being left describing
  one.

`turbo-inputs.test.ts` is untouched and correctly so: its `SUITES` are `shared` and `core`, and its
own doc comment says `@quorum/cli`'s declaration is checked by this package's suite instead.

---

## 3. Demonstrated red before green

Six mutations, each run and each reverted. The tree afterwards is the three files above and nothing
else; `git status --porcelain` lists no untracked file.

| # | mutation | result |
| --- | --- | --- |
| 1 | `inventory`'s default prune ← the old `['node_modules','.git','.turbo','.harness','.quorum']` | **The finding, reproduced.** 3 tests red, the decisive one `the audit is blind to a build that writes into the three directories the pruned shape excused: expected [] to strictly equal [ '.git/written', …(2) ]` |
| 2 | `gitVisible` drops `--others --exclude-standard` | `git no longer reports a write it can see: expected [ 'tracked.txt' ] to strictly equal [ 'tracked.txt', 'untracked.txt' ]` |
| 3 | the copy's `node_modules` mirrored as **one symlink** | **Passed** — see below. After the clause was corrected: `the audit did not descend into the copy's node_modules: expected 0 to be greater than 0` |
| 4 | `isTurboMetadata` returns `false` | 3 red: `turbo wrote no cache metadata, so the one exemption excuses nothing real`, the isolated strays becoming 15, and `@quorum/cli wrote inside itself and outside dist/: expected [ '.turbo/turbo-build.log' ] to strictly equal []` |
| 5 | `@quorum/shared`'s **real** build script appends to `../../README.md` | `the build wrote a file git can see, which its emit is not: expected [ 'README.md' ] to strictly equal []` |
| 6 | the same script deletes `../../CLAUDE.md` | `the build removed a file git can see: expected [ 'CLAUDE.md' ] to strictly equal []` |

Mutations 5 and 6 modified tracked files by design; both were restored from git and `git status`
confirmed clean before continuing.

**Mutation 3 found a defect in this round's own guard before it shipped, and it is this ticket's
defect class arriving inside the fix for it.** The clause asserting the isolated audit *descends
into* `node_modules` counted paths whose segments *include* `node_modules` — and a mirror made as a
single symlink records the name itself as a leaf, whose sole segment is `node_modules`, so the clause
was satisfied by the very shape it existed to refuse and the mutation passed. It now requires a
segment with something **below** it. *"A check is not established by reading it"* (2026-08-29): the
clause was read three times while being written, and only running the mutation disproved it.

---

## 4. Verification

All forced, in this worktree, after `pnpm install --frozen-lockfile` ("Already up to date", 178 ms)
and `npm install --prefix spike` ("up to date").

- **`pnpm turbo run lint typecheck test --force`** — **21 of 21 tasks successful, 0 cached**, 40.6 s.
- Workspace suites: `cli` **10 files / 134 tests**, `shared` 12 files / 143 tests, `core` 57 files,
  the four stubs 1 file each. `build.test.ts` is **26 tests in 9.3 s**; its three isolated or real
  builds cost about 2 s each.
- **`npm test --prefix spike`** — **19 of 19 files passed.**
- **`node spike/bin/harness.js lint`** — 6 of 6 flows.
- **`pnpm sweep:git-identity`** — green: *"both suites executed and green with no resolvable git
  identity"*. The new fixture runs `git init` and `git add` and **never commits**, so no identity is
  resolved.
- **Both environment rows** (Q-0072's closing finding): `build.test.ts`, `package.test.ts` and
  `frame.source.test.ts` green — 59 tests — with `.harness/worktrees` and `.quorum/runs` **absent**,
  and green again with both created and populated, the fixtures then removed. This matters more this
  round than last: those two names are no longer excused, so their presence is now something the
  audit could in principle react to, and it does not.
- **Ground rule 5** — `spike-parity.test.ts` re-run rather than skipped: 26 tests pass and the pinned
  totals are **unmoved** — `binary-only` 220, `both` 2739, `library-only` 2469, total **5428**,
  transfer share **55%**. Asserted as a no-op rather than assumed to be one: this round adds no spike
  test file and moves no assertion between the halves.

---

## 5. Deliberately left alone

- **Everything outside the audit.** The review returned one finding, so `build-fixture.test.ts`,
  `frame.source.test.ts`, `test-discovery.test.ts`, `shared-resolution.test.ts`, `docs.test.ts`, the
  three `tsconfig.build.json` files, all four manifests, root `turbo.json`, `vitest.shared.js` and
  `docs/04-architecture.md` are untouched.
- **`packages/cli/turbo.json`'s `not.toContain('"outputs"')` guard** (R-7) — the contract 078(c)
  states, left in place with its reasoning asserted rather than replaced. Only the `inputs` array and
  its comment moved.
- **`turbo-inputs.test.ts`'s `SUITES` floors** — explicitly not this ticket's to move (RK-6).
- **`test-command.test.ts:406`'s "at least" message** and **`docs.test.ts:202`'s guard keyed on
  `Q-0041`** — registered non-goals (ground rule 3, R-4, R-9). Both still real, both still one line.
- **`spike/`** — untouched, ground rule 1; `git diff --name-only -- spike/` is empty. **`backlog/`**
  likewise, and it is the harness's.
- **Vitest's include** — still taken by reference and not narrowed; the emit exclusion is a widening
  of the *exclude*, which `test-discovery.test.ts` permits and a narrowing would not be.

## 6. Reported and not fixed

- **`packages/core/src/backlog/backlog.ts:276`** — `pnpm lint` reports one warning, *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. Pre-existing, in a
  file this ticket does not touch, a warning rather than an error, so the task exits 0 and CI is
  unaffected. Ground rule 3. Unchanged from iteration 2.

## 7. For the reviewer, and for the gate

**The residual limits, stated as a bounded list rather than as a paragraph nobody reads.** AC-8 is
now the union of two observations, and what neither reaches is:

1. **A write that leaves the isolated copy through a `node_modules` symlink** into the real store.
   The copy's own `node_modules` entries are audited as links, so replacing one is visible; a write
   *through* one lands outside the copy. Closing it means a full dependency install per test, which
   buys minutes of wall clock for a case no `tsc` invocation can reach.
2. **A gitignored path outside an emitting package, in the real workspace** — covered whole by the
   isolated audit, which is the trade this round makes deliberately and the previous one made
   silently.
3. **`.turbo`, everywhere** — excused, but by AC-8's own words, and by naming rather than pruning:
   mutation 4 shows the paths are enumerated and that removing the classification reports them.
4. **A rewrite identical in bytes and in timestamp** — invisible to any fingerprint, and produced by
   no compiler.

Each is a property of the mechanism rather than a name on a list, which is the difference the finding
asked for.

**A departure from the literal wording, stated rather than buried.** The remedy offers *"instrumenting
the build"* first. Portable instrumentation would have to observe a shell — the build script is
`rm -rf dist && tsc -p tsconfig.build.json`, and the threat model is a *changed* script, so a
Node-level `fs` shim would be blind to `echo`, `cp` or `rm`. The second option was taken instead, and
the real-workspace proof was retained as instructed — with a different observer rather than a shorter
prune list, which is what makes it exact where it can be and honest where it cannot.

**Cost.** One isolated copy is ~150 ms to create and ~1.9 s to build; `build.test.ts` runs in 9.3 s
in total against 300 s timeouts, and it ran concurrently with `build-fixture.test.ts`'s own turbo
invocations in every full-suite run above without interference.

**Nothing here needs a decision entry.** No criterion was contradicted, no ruling of *"The emit serves
the binary, and no test verdict moves behind it"* (2026-09-02) was touched, and no existing verdict
moved behind the artifact.
