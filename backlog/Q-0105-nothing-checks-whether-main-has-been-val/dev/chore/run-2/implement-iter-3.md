# Q-0105 — implement, run 2, iteration 3

**A revision round against review iteration 2's single major.** Iteration 1's two findings were
addressed in the previous round and iteration 2 confirms both; what remained was the work-tree
discriminator itself. Three files changed, 142 insertions. No document moved, no export was added,
and `containment` was not touched.

---

## 1. The finding, and what it actually claimed

> major: `packages/core/src/git/git.ts:66` — Every exit status 128 from the initial work-tree probe
> is classified as "not a work tree" and ultimately suppressed as `null`. Git also returns 128 when
> a repository exists but cannot be opened … Add a classification strategy and regression fixture
> that distinguish a confirmed non-work-tree from these fatal repository errors **without depending
> on localized stderr**; fatal errors that cannot be proven to mean absence must produce
> `indeterminate (git failed)` while a genuine non-work-tree remains `null`.

**Accepted in full, and it is right on the merits.** The previous round's JSDoc admitted the gap in
its own "residual limit" paragraph and argued it was unclosable. That argument was not measured, and
it turns out to be wrong.

The finding matters for the same reason the ticket exists: this fact's success output is **silence**,
so a failure rendered as nothing is indistinguishable from a clean bill of health — *"a check that
skips its subject must not report success"* (2026-08-25). AC-3 puts it as a criterion: a failed probe
reaches its own reason and never the state that renders nothing.

---

## 2. What I measured before changing anything

Two probe runs against real repositories on **git 2.55.0**, built and thrown away inside a scratch
test file (deleted; it appears in no commit). Five fixtures: a directory that is not a repository, a
repository at `core.repositoryformatversion = 99`, one carrying an unknown `extensions.*` key, one
refused for ownership via git's own `GIT_TEST_ASSUME_DIFFERENT_OWNER=1`, and a subdirectory of each.

**M-A — the exit code cannot discriminate, which is the reviewer's premise and it holds exactly.**

| fixture | `rev-parse --is-inside-work-tree` | stderr's first line |
| --- | --- | --- |
| not a repository | **128** | `fatal: not a git repository (or any of the parent directories): .git` |
| format version 99 | **128** | `fatal: Expected git repo version <= 1, found 99` |
| unknown extension | **128** | `fatal: unknown repository extension found:` |
| dubious ownership | **128** | `fatal: detected dubious ownership in repository at '…'` |

**M-B — no other repository-requiring probe discriminates either.** `rev-parse --git-dir`,
`rev-parse --git-path HEAD` and `config --local --list` were each run over all five fixtures: every
one exits **128** in every failure case. `config --local --list` is the near miss — it prints
`warning:` for the two format cases and `fatal: --local can only be used inside a git repository`
for absence and for ownership — but that difference is **prose**, which git translates, and a locale
may not decide a state. So the reviewer's "without depending on localized stderr" rules out the only
signal those probes carry.

**M-C — `rev-parse --resolve-git-dir` is the one probe that answers while the repository is
unopenable.** It asks whether a *path* is a gitdir, or a gitfile naming one, and it runs neither the
ownership check nor the format check:

| fixture | `rev-parse --resolve-git-dir <dir>/.git` |
| --- | --- |
| not a repository | 128 |
| format version 99 | **0** (prints the repository path) |
| unknown extension | **0** |
| dubious ownership | **0** |
| ownership-refused **subdirectory** | 128 — there is no `.git` at that path |

That last row is the residual, and §5 states it rather than hiding it.

**M-D — `GIT_TEST_ASSUME_DIFFERENT_OWNER=1` reproduces the ownership refusal** on this git build,
which is what makes the reviewer's named example testable without a second user account.

---

## 3. What changed, file by file

### `packages/core/src/git/git.ts` (+61 / −29)

**`insideWorkTree` → `workTreeProbe`, returning three answers rather than a boolean.** The old
signature was `boolean | null` and the ambiguity lived in the `false`: git's own "there is no work
tree" and the classifier's reading of a fatal shared one value. The new `WorkTreeProbe` union names
them — `inside`, `outside` (git established there is no work tree to ask about), `failed` (the probe
could not answer) — so the two things that must not be confused cannot share a value.

**A new module-private `repositoryAt(repoDir)`**, four lines, reached **only** from the fatal branch:

```ts
function workTreeProbe(repoDir: string): WorkTreeProbe {
  try { return git(['rev-parse', '--is-inside-work-tree'], repoDir) === 'true' ? 'inside' : 'outside'; }
  catch (error) {
    if (exitStatus(error) !== GIT_FATAL) return 'failed';
    return repositoryAt(repoDir) ? 'failed' : 'outside';
  }
}
```

It is **git's own answer, not an inference**, which is what AC-3 requires: no stderr is read, no
filesystem heuristic decides anything, and the exit code that classifies is one git spends on a
question with only two outcomes.

**`pushLag`'s call site** turns on the three-way probe: `failed` → `indeterminate (git failed)`,
`outside` → `null`, `inside` → carry on. No other branch of the function moved.

**Three JSDoc blocks re-stated to what is now true.** `GIT_FATAL`'s block carries M-A's measured
table in one sentence — the four messages git spends the same code on — so the next reader does not
re-derive it. `pushLag`'s `null` paragraph now names all three outcomes. The spawn-budget sentence
gains one clause: the second probe does not raise the seven-spawn ceiling AC-12(4) pins, because it
is reached only where git has already given up, on a path that returns two spawns in. The seven-spawn
assertion at `git.test.ts:821` is unedited and green.

### `packages/core/src/git/git.test.ts` (+56)

**Two fixtures, one per refusal mechanism, because they fail at different moments** — ownership is
refused during discovery, an unreadable format during setup — so neither stands in for the other.

Both open by measuring their own premise with a local `statusOf` helper, asserting that the refused
repository *and* the plain directory beside it both fatal with **the same 128**. Without that pair
the tests would pass over a fixture that never refused anything, and the claim "the exit code cannot
be the discriminator" would be asserted from the source rather than from git — *"a check is not
established by reading it"* (2026-08-29).

`GIT_FATAL` is re-declared in the test rather than exported from the module: a test sharing the
constant with the code would agree with it about the one thing under test, and exporting it would
move an AC-12 register for no reason.

The ownership test unstubs the hook and re-runs `pushLag` on the **same directory**, which then
reports an ordinary `no remote` — so the assertion above it is about the refusal and not about a
fixture that was broken all along.

### `packages/cli/src/board.test.ts` (+25)

The board-level regression the finding asked for: a project fixture with an upstream and two unpushed
commits, refused by `core.repositoryformatversion = 99`. It asserts the cannot-say line renders, the
command still exits **0** (AC-11), and the ticket rows still print — the failure is one legend, not a
broken command. **The non-repository neighbour is in the same test**, asserting `lagLine(...)` is
still `null`, so the two halves of the distinction cannot drift apart in later edits.

---

## 4. Red before green (AC-14)

One mutation — `return repositoryAt(repoDir) ? 'failed' : 'outside'` replaced by `return 'outside'`,
which is the previous round's behaviour exactly — run against both suites and restored afterwards.
No mutation marker survives anywhere under `packages/*/src`.

| suite | result under the mutation | message |
| --- | --- | --- |
| `git.test.ts` | 2 failed, 77 passed | `a repository git refused was reported as no repository: expected null to strictly equal { state: 'indeterminate', … }` |
| `git.test.ts` (ownership) | (same run) | `expected null to strictly equal { state: 'indeterminate', … }` |
| `board.test.ts` | 1 failed, 31 passed | `a repository git refused to open printed nothing at all: expected null not to be null` |

Exactly the three new assertions go red, each naming its own subject; nothing else in either file
moves. Restored: `git.test.ts` 79 passed, `board.test.ts` 32 passed.

---

## 5. What I deliberately left alone

**The residual, stated rather than hidden, and it is narrower than it was.** A project root sitting
**below** a refused repository's root still reads as absence and renders silence — measured in M-C's
last row. Closing it needs one of two things, and I refused both rather than choosing quietly:

- *git's prose* — the only signal that discriminates at depth (M-B), which the finding itself rules
  out and which a locale would decide.
- *a reimplementation of git's upward discovery walk* — nominating each ancestor's `.git` from the
  filesystem and asking git about it. I costed this and rejected it: it would make a fixture's
  verdict depend on whether the temp directory it was built in happens to sit under a repository,
  which is precisely *"A test's verdict is a property of the commit, not of the checkout or the
  account"* (2026-08-30). Both `board.test.ts:62`'s `tmp()` and `test/repo.ts`'s `notARepo()` build
  under `os.tmpdir()`, so C6 and AC-10 would have become properties of where `TMPDIR` points.

The JSDoc carries the residual and that reasoning in three lines. What the change does close is every
refusal **at `repoDir` itself**, which is where a Quorum project's own `.git` sits — `board.ts:143`
passes the project root — and which is both of the cases the finding names.

**`containment` is untouched.** It answers `null` for the same directory through its own `try/catch`,
which is landed Q-0036/Q-0042 behaviour; AC-1 makes push lag a second function under containment's
rules rather than a change to it, and widening the finding into that function would be scope creep on
a criterion that deliberately kept them apart. Registered here, not fixed.

**No register moved, and that is a measurement rather than an omission.** `repositoryAt` and
`WorkTreeProbe` are module-private, so `git.source.test.ts:28`'s eleven-name export pin, `:41`'s
refusal of the previous list and the barrel's two-name pin are all still exactly right; a `grep` for
`insideWorkTree` across `packages/`, `docs/` and `harness/` returns only the gitignored `dist/`.

**AC-2's closed union and AC-13's glossary entry needed no edit.** This round changes *which
situations reach an existing reason*, not the reason set — there is no new state. The glossary's own
sentence, *"`git failed` (the probe could not answer, which is not the same as git answering that
there is no repository here — that is silence)"*, is more precisely true after this change than
before it, since a refusal is no longer read as git answering that there is no repository.

---

## 6. Verification

Run as `integrate` will run it, `pnpm install --frozen-lockfile` first (*"Already up to date"*):

- `pnpm turbo run test --force --continue` — **7 tasks successful, 0 cached**; `@quorum/cli` 24 files
  / 579 tests, including the packed-install and cache-replay fixtures.
- `pnpm turbo run lint typecheck --force --continue` — **14 tasks successful, 0 cached**.
- `pnpm sweep:git-identity` — exit 0, *"the workspace suite executed and green with no resolvable git
  identity"*. This matters more than usual this round: the ownership fixture stubs an environment
  variable, and the sweep is what proves it did not become the oracle.
- **Live, through the built binary.** `pnpm turbo run build --force` then `pnpm exec quorum board`:
  the board renders every row and its two existing legends and prints **no push-lag line**, because
  `git rev-list --count refs/remotes/origin/main..refs/heads/main` is **0** — the `pushed` state,
  silent by design. Worth recording as a live sighting of the ticket's own subject: the requirement
  measured this repository 2 commits ahead at its gate (M-1) and it is level now, which is the lag
  clearing when somebody pushes rather than the instrument going quiet.

---

## 7. For the gate

Nothing is blocked and no criterion is unsatisfied. Two things are the human's to note:

1. **GO-3 still stands and is the one obligation a local verification cannot discharge.** Everything
   above was measured on this machine; a ticket that fixes *"nothing notices that `main` was never
   validated"* and closes on an unpushed `main` is the defect closing its own ticket.
2. **`containment` carries the same ambiguity for the same directory**, reported in §5 and not fixed
   here. Whether it is worth a successor is a judgement about a function this ticket was told to
   leave alone, and it is not one an implement step should take on its own.
