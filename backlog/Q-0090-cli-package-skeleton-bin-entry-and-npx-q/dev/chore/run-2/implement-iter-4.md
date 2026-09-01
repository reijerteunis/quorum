# Q-0090 — implement report, run 2, iteration 4

**Revision round.** `review/chore/run-2/chore-iter-3.md` returned **one major**. It is accepted in
full, fixed, and demonstrated red before green. One file changed: 123 insertions, 17 deletions, all
in `packages/cli/src/frame.source.test.ts`.

---

## The finding, and why it is right

> **major: packages/cli/src/frame.source.test.ts:35** The BYOS guard derives only `*.ts` files below
> `packages/cli/src`, while AC-12 explicitly requires scanning all of `packages/cli/**`, including
> tests, fixtures, help text, and documentation examples. Credentials introduced in a non-TypeScript
> fixture, package-level documentation, or configuration file would therefore pass unnoticed. Derive
> the scan from the package root and cover all relevant text files, with narrow, asserted exclusions
> for the guard itself and any binary/generated content.

Accepted without qualification. AC-12's test clause is *"a scan over `packages/cli/**`"* and the
guard's subject was `readdirSync(SRC, { recursive: true })` filtered to `.ts` — fifteen files, all of
them modules. `package.json`, `turbo.json`, `tsconfig.json` and `vitest.config.js` were outside it,
and so was any non-TypeScript file inside `src/`. **A claim wider than its subject, reporting green
over the part it never read** — this repository's most-recorded defect class, arriving inside the
guard AC-12 exists to install.

---

## What changed, and the one decision inside it

### `packages/cli/src/frame.source.test.ts`

**Two inventories, because the criteria have two subjects.** AC-8's text is *"a source-level guard
over `packages/cli/src/**`"* and it is about **modules** — which import a domain symbol, which import
an IO module — so its `src`-derived TypeScript walk is correct and is untouched. AC-12 and AC-4(d)
both name **`packages/cli`**, so they now derive from what the package carries in any extension.
Both derivations remain computed; neither is a written-down list.

**The package inventory is `git ls-files --cached --others --exclude-standard -z`, run with `cwd` at
the package root.** This is the decision in the change, and it is the reviewer's *"narrow, asserted
exclusions for … binary/generated content"* answered by removing the need for a list rather than by
writing one:

- A `readdirSync` walk of the package root also collects `node_modules/` and `.turbo/`. Excluding
  them by name means a hand-written list, and a list is the wrong instrument twice over — it rots
  silently as new generated directories appear, and Q-0073 already found one in this repository
  **excusing nothing while reading as coverage**.
- Git's answer is the same one turbo asks for when it hashes a task's inputs: tracked and
  untracked-unignored in, ignored out. See *"Membership is a git question, not a filesystem one"*
  (2026-08-28). `packages/core/src/turbo-inputs.test.ts:351–361` is the existing precedent and the
  invocation is deliberately identical to it, `-z` included, so a path holding a quote or a newline
  is not silently renamed by git's quoting.
- It is also what keeps the verdict a property of the commit. `.turbo/` exists after a test run and
  not before, and the rule is that a gitignored directory *use* creates may not move an answer — the
  exact defect Q-0073 closed. A hand-written exclusion would have re-introduced that dependence from
  the other side.

**Nothing is excluded as binary.** Every file is decoded as UTF-8 unconditionally. Stated in the
JSDoc with its reason: a lossy decode can only make the scan report *more* than it should, where an
exclusion is the only thing that could make it report *less*. There is no binary content in the
package today, so adding a binary exclusion now would be an exclusion excusing nothing — the shape
Q-0073 recorded, added on purpose.

**The exclusions are exactly one, and it is the guard itself.** `GUARD` and `GUARD_IN_PACKAGE` are
now both **derived** from `import.meta.url` rather than typed as literals, so renaming this file
cannot leave an exclusion excusing a file that is no longer there. The load-bearing test is unchanged
in intent and re-aimed at the package inventory: the set of files matching any credential pattern
must be **exactly** `['src/frame.source.test.ts']`.

**Three assertions were added and one moved.**

| assertion | what happened |
| --- | --- |
| `nothing … matches any credential spelling` | re-aimed from `scanned()` to `packageFiles()` |
| `the scan reaches past src and past TypeScript` | **new** — names `package.json`, `turbo.json`, `tsconfig.json`, `vitest.config.js` individually and `src/main.ts`, so the scan quietly shrinking is a failure rather than a smaller green |
| `the self-exclusion is load-bearing, and it is the only one` | re-aimed at the package inventory |
| `generated content is excluded by git and not by a list` | **new** — the sandbox demonstration below |
| module-scan subject test | gained `expect(names).toContain(GUARD)`; `scanned()` was retired and its one remaining use replaced by `files()` |

`scanned()` was deleted because after the re-aim its own doc comment — *"everything the scans below
read"* — was false of every scan left. AC-8's production scan already excludes tests, the guard among
them.

---

## Widened one line beyond the literal finding, stated so it can be struck

**AC-4(d)'s signal-handler scan was widened in the same change**, from `scanned()` to the package
inventory. This is not what the reviewer asked for and I am naming it rather than burying it.

The reasoning: AC-4(d)'s criterion text is *"a test asserts … that `packages/cli` registers no signal
handler"*, so it carries the **identical** claim-wider-than-subject defect one clause up, and
`vitest.config.js` is executable code the old subject could not see. Fixing the flagged instance
while leaving its twin in the same file — after being shown the mistake — is what round 2 of Q-0079
was criticised for. It costs one line and reuses the inventory the finding already required.

If the reviewer reads this as scope creep, reverting it is two lines and nothing else depends on it.

---

## Demonstrated red before green

Every clause was shown to have a subject. None of this is asserted from reading.

**1 — the gap the reviewer named, reproduced.** Two files planted, one outside `src` and one inside
it but not TypeScript:

```
packages/cli/fixture.json      { "note": "ANTHROPIC_API_KEY=sk-demo" }
packages/cli/src/helper.sh     export TOKEN="$OPENAI_API_KEY"
```

The new guard fails on both, on **two** clauses:

```
AssertionError: adapters run on the vendor CLI's own login; there is no key path:
  expected [ 'fixture.json: API_KEY', …(3) ] to strictly equal []
+   "fixture.json: API_KEY"
+   "src/helper.sh: API_KEY"
+   "fixture.json: ANTHROPIC_"
+   "src/helper.sh: OPENAI_"

AssertionError: expected [ 'fixture.json', …(2) ] to strictly equal [ 'src/frame.source.test.ts' ]
```

**2 — the previous guard could not have seen either.** Shown rather than argued, by listing the
inventory the old code used (`find packages/cli/src -type f -name '*.ts'`): fifteen files, and
neither planted file among them. So the guard the reviewer flagged was **green over both
credentials**, which is the finding confirmed on the tree rather than inferred from the code.

**3 — the AC-4(d) widening fires on a file its old subject could not reach.** `src/helper.sh`
rewritten to carry `process.once('SIGINT', …)`:

```
AssertionError: expected [ 'src/helper.sh' ] to strictly equal []
```

**4 — the ignored-content exclusion has a subject.** Its ignore rule mutated from `generated/` to
`MUTATED`:

```
AssertionError: expected [ '.gitignore', …(2) ] to strictly equal [ '.gitignore', 'kept.json' ]
+   "generated/log.txt"
```

Both planted files were removed and the mutation reverted before the verification runs below;
`git ls-files --others --exclude-standard packages/cli` is empty, so no fixture was left behind.

---

## Why the exclusion demonstration is a built repository and not an assertion about this checkout

Two reasons, and the second is a measurement I made rather than a preference:

1. Asserting *"the inventory excludes `.turbo/`"* against this checkout makes the verdict depend on
   whether a build has run here — `.turbo/` is a gitignored directory *use* creates, which
   `harness/rules.md` forbids as an oracle in as many words.
2. **I checked whether the ignored content in this package would trip the scan, and it would not.**
   `grep -riE 'API_KEY|credential|bearer|secret'` over `packages/cli/node_modules/` and
   `packages/cli/.turbo/` returns nothing — vitest's default reporter logs file names and counts, not
   test titles, so the log carries none of this guard's vocabulary. So no assertion about *this*
   checkout could have been load-bearing anyway. I record it because I expected the opposite and was
   wrong: a measurement, not a story.

The sandbox is therefore where the mechanism is proved — a repository the test builds under
`os.tmpdir()` with `git init --quiet`, its own `.gitignore`, one kept file and one ignored file
carrying a credential. Both sides are values the test set itself. `git init` creates no commit, so no
identity is resolved and the git-identity sweep passes over it (confirmed below).

---

## What I deliberately left alone

- **`fail.ts`.** Run-2 iterations 1 and 2 both landed on `stackOf`; round 3 wrote
  `(error as { stack?: unknown }).stack ?? String(error)` out verbatim so the spike's four
  behaviours — the unguarded property access that raises on a thrown `null`, `{ stack: 42 }` reported
  as `42`, `String(e)` for a thrown symbol, and the `+` inside `die` raising on a symbol-valued
  `stack` — are all preserved with the coercion left where the spike leaves it. The round-3 reviewer
  did not raise it again. Untouched.
- **`package.test.ts`.** Round 3 removed the `.js` suffix requirement on the `bin` target; it now
  asserts only that the key carries a non-empty string, because the executable, its extension and the
  output layout are Q-0096's. Untouched.
- **AC-8's `src`-scoped guard.** Its criterion says `packages/cli/src/**` and its subject is modules.
  Widening it to the package would put `package.json` and `turbo.json` in front of a regex looking for
  `runFlow`, which is noise, not coverage.
- **`spike/`, in both halves.** No file under `spike/src/` or `spike/test/` was read into or written
  by this change. Ground rules 1 and 2; no freeze re-record is owed.
- **`backlog/`.** GA-3 — `backlog/Q-0010-…/ticket.md` §2's four stale figures — is the human's; the
  engine discards an agent's edit there.
- **Registers.** `spike-parity.test.ts`'s four pins are untouched and unmoved: this ticket translates
  no `spike/test/` file, and the core suite is green over them. `test-command.test.ts`'s seven-key
  `CI_JOBS` does not move — no CI job added. `test-discovery.test.ts` does not move — the three
  scripts already existed. `turbo-inputs.test.ts`'s `SUITES` doc comment was settled in round 1 and is
  unaffected: the new reads are `git ls-files` at the package root, inside what `$TURBO_DEFAULT$`
  already hashes, and `os.tmpdir()`, which `fail.test.ts` and `main.test.ts` already reached before
  this round.
- **AC-11.** Both halves landed in earlier rounds and are green — the Q-0096 bullet is in
  `docs/06-development-plan.md` (`plan-backlog.test.ts` passes) and `:481`'s four figures read nine
  files / 2,959 lines / 55% / 780.

---

## Verification — forced, on the final tree

| check | result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0, lockfile up to date |
| `pnpm turbo run test --force --continue` | **7/7 tasks, 0 cached.** `@quorum/cli` 8 files / **88 tests** (was 86), `@quorum/core` 1280 passed 2 skipped, `@quorum/shared` 142 passed |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `npm test --prefix spike` | **19/19 test files** |
| `node spike/bin/harness.js lint` | **6/6** flows |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `git status --short` | one modified file; no stray fixtures |

`frame.source.test.ts` went from 9 tests to 11.

**Not yet done, and it is the human's row:** AC-12 requires both suites green **in both environment
rows** per Q-0072's closing finding. Everything above is the implement worktree. The `integrate`
worktree — which has neither `.harness/worktrees` nor `.quorum/runs` — and the forced re-run on `main`
after the merge are the remaining half.

---

## Residual limits, stated rather than left to be found

1. **A hostile global excludes file refuses rather than lies.** `--exclude-standard` honours
   `core.excludesFile`, which this test did not set. If a machine's global ignore dropped
   `package.json` from the inventory, the new *"reaches past src and past TypeScript"* test names it
   and fails. That is the authorised direction — a machine property may **refuse a run** and may never
   be the **oracle** — and it matches `turbo-inputs.test.ts`, which uses the same bare flag against
   the real repository.
2. **A credential reachable only through a subprocess is not covered**, the same limit
   `turbo-inputs.test.ts` records as its residual 1. The scan reads bytes in the package; it does not
   follow what a command run from the package might fetch.
3. **`git` is a hard requirement of this file now.** It already was of the workspace suite —
   `packages/core/test/repo.ts` spawns it for every sandbox — and the failure is a named throw rather
   than an empty inventory reporting a pass over nothing.

---

## No decision is implied by this round

Nothing here needs a `docs/decisions/` entry: the mechanism is an existing decision applied
(*"Membership is a git question, not a filesystem one"*, 2026-08-28), not a new one. The gate
obligations already on the record are unchanged — GA-3 (Q-0010's §2 figures), GA-4 (the exit table's
two zeros), GA-5 (AC-9's finding into Q-0091's body).
