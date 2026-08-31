# Implement report — Q-0062, revision round 5

*Three findings in `review/chore/run-2/chore-iter-4.md` — two majors and a nit. All three are
addressed. The blocker that consumed rounds 1–3 is gone: the decision entry exists and round 4
verified it, and this round's review did not raise it.*

**No production source changed this round.** The diff is two guards, one register and two documents:

```
 docs/04-architecture.md                       |   8 +-
 docs/06-development-plan.md                   |  20 +-
 packages/core/src/engine/q0062.source.test.ts | 142 ++++++++++++++++------
 packages/core/src/spike-parity.test.ts        |  12 +-
 spike/test/q0062-worktree-lifecycle.js        | 108 ++++++++++++-----
 5 files changed, 220 insertions(+), 70 deletions(-)
```

---

## Finding 1 and 2 — major: the AC-4 scan sees only selected single-quoted spellings

> *"its patterns recognize only selected single-quoted spellings, so commands such as
> `git(["branch", "-d", branch])`, shell-form `git branch -D`, or a double-quoted push deletion pass
> unnoticed"* — and the same, duplicated, in the spike's required pin.

**The finding is correct, and it was worse than it reads.** The two scans were six regexes over the
raw text, four of which anchored on a single quote:

```js
['branch -d',      /'branch',\s*'-d'/],   // one argv spelling, one quote style
['branch -D',      /'-D'/],               // any single-quoted -D, anywhere
['push --delete',  /'push'/],             // the *word* push, single-quoted
```

That is a scan of one project's habits rather than of a command. Everything the reviewer named
passed, and so did a template literal, a concatenated shell string, and a `git tag -d`.

### The shape that replaced it

Both trees now read **argv tokens**, and the reasoning is in the source rather than here:

```js
const argv = (text) => text.split(/[^\w.:/@-]+/)
  .map((token) => (/^:+$/.test(token) ? token : token.replace(/:+$/, '')))
  .filter(Boolean);
```

Three properties, each load-bearing and each measured before it was relied on:

1. **A quote is a property of the spelling, not of the command**, so quotes are separators.
   `['branch', '-d', b]`, `["branch", "-d", b]`, `` `git branch -d ${b}` `` and a plain
   `git branch -d` in a shell string all reduce to the same two adjacent tokens.
2. **`.` is part of a token**, so a property access stays one token and `list.push` is never the
   verb `push`. This is the whole reason the two `push` clauses can exist: measured across both
   trees' production sources there are **138 `x.push(` sites and not one bare `push`**. Without it,
   a `push` clause fires on every array in the corpus and the guard means nothing.
3. **A colon that ends a token is JavaScript punctuation; one that begins it is a refspec.** This
   was found by running, not by reading: with a naive class, `{ deleteBranch: true }` tokenises as
   `deleteBranch:` and the *first* clause — the one that exists to catch exactly that — read clean.
   Two of seven tests were red on the first run for that reason.

The clause set, in declared order:

| Clause | Fires on |
| --- | --- |
| `deleteBranch` | the primitive's own option, in any quoting |
| `branch -d` / `-D` / `--delete` | `branch` with the flag among the three tokens that follow |
| `tag -d` | a tag is a ref too |
| `update-ref` | the plumbing verb at all |
| `push --delete` | `push` with `-d` or `--delete` within three tokens |
| `push :ref` | `push` with a token beginning `:` within three — both `':' + b` and `:refs/heads/x` |
| `a delete flag` | **the backstop**: any `-d`, `-D` or `--delete` token, whatever verb it hangs off |

The backstop is what makes this *"the production-wide no-ref-deletion rule"* the reviewer asked for
rather than a longer list of anticipated commands. It is affordable because it was measured: the
corpus holds **zero** `-d` and **zero** `--delete` tokens, and exactly one `-D` — the primitive's.

### What it still cannot see, said in the guard rather than discovered later

A flag assembled at run time — `args.push(flag)` where `flag` is a variable — is invisible to any
scan of text. That limit is written into the clause set's own JSDoc, next to the reason it does not
matter much: `WorktreeRemover` takes **two** parameters, so no call site can ask for a deletion
however the call is spelled, and that half cannot be talked out of firing. Claiming completeness
here would be this ticket's own subject arriving inside its guard.

### AC-13 — demonstrated by restoring the old file, not by describing it

Each mutation was applied to a **real production file**, both guards run against it, and the
mutation reverted. `git status --porcelain` confirmed empty afterwards.

**`packages/core/src/engine/lifecycle.ts`**, one line inserted after the removal:

| Mutation | Round-4 guard | Round-5 guard |
| --- | --- | --- |
| `git(["branch", "-d", branch], context.repoDir)` | ✓ **6/6 pass — blind** | ✗ `engine/lifecycle.ts: branch -d, a delete flag` |
| `` runCommand(`git branch -D ${branch}`, context.repoDir) `` | ✓ **6/6 pass — blind** | ✗ `engine/lifecycle.ts: branch -D, a delete flag` |
| `git(["push", "origin", "--delete", branch], context.repoDir)` | — | ✗ `engine/lifecycle.ts: push --delete, a delete flag` |

**`spike/src/engine.js`**, the same three at the `removeWorktree(ctx.repoDir, branch)` site:

| Mutation | Round-4 guard | Round-5 guard |
| --- | --- | --- |
| `execFileSync('git', ["branch", "-d", branch], { cwd: ctx.repoDir })` | ✓ **both AC-4 scenarios pass** | ✗ `engine.js: branch -d, a delete flag` |
| `` runCommand(`git branch -D ${branch}`, ctx.repoDir) `` | — | ✗ `engine.js: branch -D, a delete flag` |
| `` runCommand(`git push origin :${branch}`, ctx.repoDir) `` | ✓ **both AC-4 scenarios pass** | ✗ `engine.js: push :ref` |

**One thing that fell out of the spike demonstration is worth more than the fix.** With a real
`git branch -d` running on every removed worktree, the round-4 suite passed the *behavioural* AC-4
scenario too — *"no ref is deleted: both branches still resolve"*. Not because nothing tried, but
because `git branch -d` refuses a branch unmerged into `HEAD`, so both survived. The behavioural
test proves no ref **was** deleted; only the source scan proves none is **asked** for. That is the
division of labour the file's header always claimed, now shown rather than asserted — and it is why
weakening the source scan mattered even though the behavioural half stayed green.

### Positive and negative controls, in the suite rather than in this report

Both trees gained a table-driven test. **Ten forms** must be seen — single- and double-quoted argv,
a template-literal shell line, a concatenated shell line, `tag -d`, `update-ref -d`, a
double-quoted push deletion, a colon refspec assembled (`':' + b`) and written out
(`:refs/heads/${b}`), and the primitive asked to do it. **Five innocent snippets** must report
nothing: an array push carrying a colon, an array push carrying a flag, `worktree remove --force`,
`branch --list`, and the shipped call site itself. The second table is what stops the first from
being satisfied by a scan that fires on everything.

The primitive's positive control moved from two live clauses to three
(`['deleteBranch', 'branch -D', 'a delete flag']`), and the real-file mutation test now runs **both**
spellings — the one the earlier scan could see and the one it could not.

The spike's single AC-4 source scenario became three, so the file reports **13** scenarios rather
than 11. All 13 green.

---

## Finding 3 — nit: the plan's parity totals are not what the guard pins

> *"the durable Q-0062 entry says `336 / 2026 / 2338 / 4700`, but `spike-parity.test.ts` now pins
> `336 / 2026 / 2407 / 4769`"*

Correct, and **the nit understated it**, because this round moved the number again: widening the
AC-4 scan took `q0062-worktree-lifecycle.js` from 345 to 401 lines, and it is the one file
classified `library-only`, so only its own column moves.

| | binary-only | both | library-only | total | share |
| --- | --- | --- | --- | --- | --- |
| before Q-0062 (Q-0054) | 336 | 2001 | 2059 | 4396 | 53% |
| implement round | 336 | 2026 | 2338 | 4700 | 50% |
| round 3 (`regressed`/`interrupted`) | 336 | 2026 | 2407 | 4769 | 50% |
| **round 5 (this one)** | **336** | **2026** | **2463** | **4825** | **49%** |

`spike-parity.test.ts` is updated to the last row and its comment records why it moved twice inside
one review loop. **The share crossed a rounding boundary**: 2362 / 4825 = 49.5%, so the guard's own
`Math.round` assertion is now `49`, not `50`.

`docs/06-development-plan.md`'s Q-0062 entry carries the final figures, names the two superseded
pairs as belonging to earlier implement reports, and says they are not what shipped — rather than
silently replacing a number a reader might have quoted.

### Two corrections beyond the nit, made deliberately and flagged for the reviewer to rule on

Crossing 53% → 49% falsified two **present-tense** claims that neither the criteria nor the review
named:

- `docs/04-architecture.md:73` — *"53% of `spike/test/`, by line, spawns `spike/bin/harness.js`"*
- `docs/06-development-plan.md:102` — M2's own done-when, *"53% of the suite by line"*

Both now read 49%, keep 53% beside it as what Q-0054 counted, and say the figure is re-derived by
`spike-parity.test.ts` rather than transcribed. Both status lines are bumped accordingly.

**This is outside the acceptance criteria and I am naming it rather than burying it.** AC-12 sends
me to these two documents but names the Q-0062 entry, not the parity share. I made the edits because
`.claude/rules/docs-and-decisions.md` says *"when code and docs disagree, the docs are wrong … fix
the docs in the same PR"*, my change is what made them disagree, and the M2 done-when sentence is
the very place Q-0054 corrected a stale present-tense count for the same reason. If a reviewer reads
this as unauthorised, the two edits are four words and revert cleanly without touching anything else.

**`docs/06-development-plan.md:404` I deliberately left alone.** *"The headline survives unchanged —
2,337 of 4,396 lines, 53%"* sits inside Q-0054's closing account and its numbers are that ticket's
own measurement against a 4,396-line suite. It is history and it is true as history; rewriting
another ticket's landed entry is a different act from correcting a live requirement.

---

## File by file

| File | What changed |
| --- | --- |
| `packages/core/src/engine/q0062.source.test.ts` | `refDeletions` rewritten as a token scan: `argv`, `is`, `near`, a nine-clause `CLAUSES` register, `FORMS` (10 rows) and `INNOCENT` (5 rows). The real-file mutation test runs two spellings; a third test drives both tables. AC-9's three tests, the `WorktreeRemover` two-parameter pin and the corpus are untouched. |
| `spike/test/q0062-worktree-lifecycle.js` | the same scan and the same tables, in JS, hoisted to module scope; the one AC-4 source scenario split into three so a failure names which half broke. The behavioural AC-4, AC-1, AC-2, AC-3, AC-5, AC-6 and AC-7 scenarios are unchanged. |
| `packages/core/src/spike-parity.test.ts` | four pinned totals re-derived to `336 / 2026 / 2463 / 4825`, the share assertion `50` → `49`, and the comment recording both re-measurements and which one crossed the boundary. |
| `docs/06-development-plan.md` | the Q-0062 entry's figures and the three-step history behind them; M2's done-when 53% → 49%; the status line's Q-0062 clause extended with both. |
| `docs/04-architecture.md` | the testing strategy's entangled share 53% → 49%, with Q-0054's figure kept beside it; status line extended. |

## What I deliberately left alone

- **Every landed assertion R-6 does not authorise.** Rows 2 and 4–7 are untouched; the two comment
  edits AC-10 authorises are unchanged from round 1. Candidate-codex's proposal to revise the
  `q0050.source.test.ts:133` task-branch naming pin stays rejected by R-3.
- **The corpus each scan reads.** Core scans `packages/core/src` through `coreSourceFiles()`; the
  spike scans `spike/src/**/*.js`. `packages/shared/src` is scanned by neither, as before. Widening
  the corpus is a different change from strengthening the clauses, and no criterion asks for it —
  reported, not done. (Measured while designing the clauses: `shared` holds no `-d`, `-D`,
  `--delete`, `update-ref` or bare `push` token either, so nothing is hiding there today.)
- **All production source.** `lifecycle.ts`, `spike/src/engine.js`, `engine.ts`, `types.ts`,
  `composite.ts` and `steps.ts` are byte-identical to round 3's; every mutation above was reverted
  and verified.
- **`docs/decisions/` and its index**, written by the maintainer. **`docs/06-development-plan.md:404`**,
  Q-0054's historical measurement. **Any ref deletion, `--prune` command, worktree enumeration,
  `harness.yaml` key or CLI flag** — all non-goals. **The 277 MB already on disk**; this ticket is
  prospective by design.

## For the maintainer

**GO-2 is unchanged and still owed.** `harness/port-charter.md:270` reads
`freeze-sha: 7b6bc70421094ae31eb44257807f84b8f732a20a`; `git diff --name-only 7b6bc70… main --
spike/src` is empty today and `… HEAD -- spike/src` is `spike/src/engine.js`, so *"port freeze"* goes
red on `main` the moment this lands, until the SHA is re-recorded at the merged tip. This round
touched no `spike/src` file, so nothing about that changed.

**One nit of my own, recorded not fixed.** Round 4's report and this ticket's plan entry both once
said the share *"fell from 53% to 50%"*. That was true for exactly one round. The entry now carries
all three measurements rather than only the last, so the next reader can see that a figure derived
from a growing file is not a constant — which is the same lesson as *"a measurement copied from a
document is not a measurement"*, one step further along.

## Verification

Both trees installed in this linked worktree, which starts with no dependencies
(`harness/rules.md`), and everything re-run after the last mutation was reverted:

| Check | Result |
| --- | --- |
| `npm test --prefix spike` | ✓ all 18 test files passed |
| `pnpm turbo run test lint typecheck --force` | ✓ 21/21 tasks, **0 cached**; 1250 passed, 2 skipped |
| `node spike/bin/harness.js lint` | ✓ 6/6 flows |
| `pnpm sweep:git-identity` | ✓ both suites green with no resolvable git identity, 7/7 tasks 0 cached |
| `git status --porcelain --untracked-files=all` | the five modified files above and nothing else |
