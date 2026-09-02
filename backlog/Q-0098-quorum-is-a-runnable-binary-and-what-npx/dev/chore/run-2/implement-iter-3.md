# Q-0098 implement — run 2, iteration 3

*Revision round. One major from `review/chore/run-2/chore-iter-2.md`, addressed, plus the two
instances of the same defect that fixing it exposed. One file changed:
`packages/cli/src/build.test.ts`, +52 / −15. No manifest, lockfile, flow, document or `spike/` file
was touched.*

---

## 1. The finding

> **major: `packages/cli/src/build.test.ts:1362`** The non-POSIX branch does not actually skip the
> mode assertion: it executes an assertion that necessarily passes and returns, so Vitest reports the
> test as passed and never shows the required explanation that the mode check was unavailable.
> Replace this with Vitest's explicit conditional skip mechanism (with a reason visible in its
> report), while retaining the executable-bit assertion on POSIX platforms.

**The finding is correct, and it is this repository's most-recorded defect sitting inside the
criterion written to forbid it.** The shipped code was:

```ts
if (process.platform === 'win32') {
  expect(process.platform, 'SKIPPED on win32: …').toBe('win32');
  return;
}
```

`expect(process.platform).toBe('win32')` **inside a branch entered only when
`process.platform === 'win32'`** cannot fail. And the string is an `expect` *message*, which Vitest
renders only when an assertion fails — so on Windows that test reported `✓ passed`, in the sentence
AC-16 spends a paragraph forbidding: *"an explicit skip notice naming the unavailable check, never a
silent pass"*. Iteration 1 wrote a check that reports success over a subject nothing examined, one
criterion after the requirement named that failure mode by date.

## 2. The mechanism

Vitest **4.1.11** (`node_modules/vitest/package.json`), whose `TestContext` declares both halves this
needs — read out of the installed typings rather than assumed:

```
readonly skip: { (note?: string): never; (condition: boolean, note?: string): void }
readonly annotate: { (message: string, type?: string, …): Promise<TestAnnotation>; … }
```

`ctx.skip(condition, note)` is the *explicit conditional skip mechanism* the review asked for: the
runner marks the test skipped and carries the note into the report. `ctx.annotate(note)` is its
partial counterpart, for the one place where a whole-test skip would be the opposite lie — see §3.3.

Two module-level constants carry it, so the predicate and the sentence exist once
(`build.test.ts:1261`–`1281`):

- **`POSIX_MODES`** — `process.platform !== 'win32'`. Its JSDoc states what it is allowed to be: it
  decides whether a check **runs** and never what one answers, which is `harness/rules.md`'s *a
  machine property may shape a fixture or refuse a check and may never be the oracle*, and *"A
  test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30).
- **`NO_POSIX_MODES`** — the reason, in the words the report shows.

## 3. What changed, and why it is three sites rather than one

### 3.1 The reviewed test, split in two

The old test carried **two** assertions of different kinds: the emitted file's mode bit (POSIX-only)
and `scripts.build` containing `chmod +x` (a manifest read, true on every platform). `ctx.skip` ends
the test it is called in, so skipping the whole test on win32 would have taken a platform-independent
assertion with it — trading a false pass for a false *not-run*, which is the same defect facing the
other way.

So they are now two tests:

- **`the build is what sets the mode, because tsc sets none`** — the manifest assertion, unconditional,
  no `runBuild()` and no 300 s timeout, because it reads a file rather than building one. Its comment
  says why it is its own test.
- **`and the emitted target carries the bit that build set`** — `ctx.skip(!POSIX_MODES,
  NO_POSIX_MODES)` **first**, then `runBuild()` and the `mode & 0o111` assertion. The skip is called
  before the build deliberately: a build paid for on the way to a check that cannot run is a cost
  with no verdict behind it.

The executable-bit assertion on POSIX platforms is retained in full, as the review required.

### 3.2 The neighbour one test below — a bare `return`, and no message at all

`build.test.ts:1379` (as it stood) was `if (process.platform === 'win32') return;` in AC-16's
direct-execution test. That is the **same defect in a worse form**: not a tautological assertion but
no assertion and no notice whatsoever, reported as a pass. It is governed by the same sentence of the
same criterion — direct execution is exactly what a mode bit buys — so it now uses the same
`ctx.skip` with the same reason. Fixing one instance and leaving its neighbour would be *"review the
fix round, not only the feature round"* (Q-0034) failing on the round that was told about it.

### 3.3 AC-25's replay test — annotated, not skipped, and the difference is the point

`build.test.ts:1843` narrowed silently: `if (process.platform !== 'win32') { …mode…; …exec…; }`. Same
class, but a whole-test skip is **wrong** here, because the rest of that test — the removal, the cache
`HIT` from turbo's summary, the restored file, its shebang, and the plain-node spawn — is AC-25's
subject and holds on every platform. Reporting it as *skipped* would say nothing ran when nearly all
of it did.

So the branch stays and the else-branch **annotates**: `await ctx.annotate(NO_POSIX_MODES)`, the test
callback becoming `async (ctx)`. The report then carries the notice beside a passing test, which is
the honest statement — *this test ran, and these two assertions could not*. The comment in place says
that, so a later reader does not "fix" the asymmetry between the two mechanisms.

---

## 4. Demonstrated red before green

Each mechanism was **executed** rather than reasoned about — *"A check is not established by reading
it"* (2026-08-29). Every mutation was reverted; `git status` reports one modified file.

### 4.1 The finding reproduced, and the fix contrasted, in one run

`POSIX_MODES` temporarily forced to `false`, and the **old shape** temporarily restored beside the new
one with `win32` swapped for `darwin` so the branch is taken on this machine. Both in the same
reporter output:

```
✓ … > OLD SHAPE under the same condition 0ms
↓ … > and the emitted target carries the bit that build set 0ms
      [POSIX mode bits are unavailable on darwin, so the executable bit cannot be asserted]
↓ … > and it runs when executed directly, which is the difference the mode bit makes 0ms
      [POSIX mode bits are unavailable on darwin, so the executable bit cannot be asserted]
```

The first line **is** the review's finding: `✓`, `0ms`, and the reason nowhere in the report. The next
two are what replaced it. That contrast is the whole of the round.

### 4.2 The annotation renders

Same forced condition, AC-25 alone:

```
✓ … > a hit restores the file with its shebang, its mode bit and its behaviour intact 2207ms
  ❯ src/build.test.ts:1853:17 notice
    ↳ POSIX mode bits are unavailable on darwin, so the executable bit cannot be asserted
```

Checked because an annotation nobody's reporter prints would have been decoration. It prints.

### 4.3 The POSIX branch still has a subject

The risk in splitting a test is ending with three checks and two subjects. Mutation: `&& chmod +x
dist/quorum.js` removed from `packages/cli/package.json`'s build script — which changes the task hash,
so the next `runBuild()` is a miss and `tsc` emits mode 644.

| test | result |
| --- | --- |
| `the build is what sets the mode, because tsc sets none` | red — `expected 'rm -rf dist && tsc -p tsconfig.build.…' to contain 'chmod +x'` |
| `and the emitted target carries the bit that build set` | red — `…/dist/quorum.js is not executable: expected +0 not to be +0` |
| `and it runs when executed directly…` | red — `spawnSync …/dist/quorum.js EACCES` |
| `the first bytes are the shebang…` | green, correctly — a shebang is not a mode |

**3 failed | 1 passed.** The split kept every subject, and the third row is the behavioural
counterpart earning its place: `EACCES` is the failure an installed `bin` shim would give a user.
The manifest was then restored byte for byte and the emit rebuilt.

---

## 5. What I deliberately left alone

- **Iteration 2's two majors stand as fixed.** Nothing in the AC-18 `pnpm exec` mechanism, the
  `offline()` helper, the three-package packer agreement or the packed-manifest divergence guard was
  touched this round. This review raised no finding against them.
- **No new criterion, no new command, no `COMMANDS`/`HELP`/`HANDLERS` change** — non-goal 4.
- **No environment switch to make the skip path reachable on this machine.** Deriving `POSIX_MODES`
  from a `QUORUM_*` variable would make the branch testable in-suite and would be a test-only switch
  manufacturing a path, which AC-17's standing prohibition refuses and whose spirit covers this. The
  branch is proven by mutation and the mutation is in §4, which is the same treatment Q-0079 gave its
  deliberately uncovered cell.
- **`spike/` untouched.** `packages/core/src/spike-parity.test.ts` needed no re-derivation and **its
  totals did not move** — this round adds no file under `spike/test/` and changes none. Stated rather
  than skipped, per the requirement's §9.
- **A pre-existing lint warning is reported, not fixed:** `packages/core/src/backlog/backlog.ts:276`,
  *"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is a
  warning, `lint` passes, the file is unmodified in this worktree, and it is not this ticket's —
  ground rule 3.
- **The registered limits are unchanged and still apply.** AC-19 proves the easy case, a CLI whose
  binary needs nothing from its declared dependencies at run time, and acquires its real subject at
  Q-0091's first value import (078(g)). AC-17 proves the emit does not swallow a status and proves no
  command's code; the table's 130 is Node's default disposition rather than the frame's contract, and
  is Q-0094's.

---

## 6. Still owed at the gate — GO-2, unchanged from iteration 2

**An erratum ruling AC-26's wording is owed, and an implement step may not write one.** AC-26 words
the constraint as *"`path.relative(PACKAGE, target)` has exactly one path segment"*; measured,
`path.relative(PACKAGE, 'dist/quorum.js')` splits into **two**, so the literal wording is satisfied
only by a target at the package root and contradicts the criterion's own admissibility table, which
lists `dist/quorum.js` as admissible. No code moves either way — the shipped assertion is the property
both readings share, that `path.join(here, '..')` resolves to the package root — so this is a wording
defect and nothing in the run is blocked on it. `developer-generalist`'s paths do not include
`backlog/`, and the engine discards a ticket file an agent writes. Repeated here because an obligation
recorded only in a superseded round's report is one that quietly expires.

---

## 7. Verification

The worktree row. The `main` row is owed after the merge, per Q-0072's closing finding.

Installed first, per `harness/rules.md` — `commands.install` runs only in an `integrate` worktree:
`pnpm install --frozen-lockfile` → *Already up to date* (213 ms), then `pnpm turbo run build --force`
→ 3/3.

| check | result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `packages/cli` suite | **159 tests, 10 files** — `build.test.ts` 50 → **51** |
| `npm test --prefix spike` | **19/19 files** |
| `node spike/bin/harness.js lint` (inside the worktree) | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

Net test count from this round: **+1**, the split. `git status` reports exactly one modified file.

---

## 8. One leftover, restated because it is still there

`.harness/q98probe/`, created by iteration 2 while measuring `pnpm exec`'s fallback behaviour, is
still present and **still cannot be removed**: `rm -rf .harness/q98probe` is refused by the harness's
permission configuration, in both absolute and relative form, on this iteration as on the last. It is
under `.gitignore`'s `.harness/` entry, `git status` does not see it, it is therefore not committed,
and the worktree itself is removed at the end of the run (Q-0062). Repeated rather than dropped,
because a reader finding it should know where it came from and that two rounds tried.

---

## 9. File by file

**`packages/cli/src/build.test.ts`** — the only file changed.

| region | change |
| --- | --- |
| `:1261`–`:1281` | **new** — `POSIX_MODES` and `NO_POSIX_MODES`, with the JSDoc stating that a machine property refuses a check and is never the oracle, and why an `expect` message is not a skip notice |
| `:1380`–`:1389` | the manifest half split out as its own unconditional test, with the reason it is separate |
| `:1391`–`:1399` | **new shape** — `ctx.skip(!POSIX_MODES, NO_POSIX_MODES)` before `runBuild()`, then the mode-bit assertion |
| `:1401`–`:1410` | the direct-execution test's bare `return` replaced by the same `ctx.skip` |
| `:1823`, `:1843`–`:1853` | AC-25's callback is now `async (ctx)`, and its win32 branch annotates instead of narrowing in silence |

No production file moved. The `bin` target, the build script, `files`, the root manifest and the
lockfile are all byte-identical to what iteration 2's review approved.
