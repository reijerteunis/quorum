# Q-0090 — implement report, run 2, iteration 5

**Revision round.** The run-2 iteration-4 review returned **one major**, and
`requirements/errata.md` **E-1** — written at the second exhaustion gate — rules it. This round
implements that ruling and nothing else. One file changed.

---

## The finding, and the ruling it arrived with

Review round 4, `packages/cli/src/frame.source.test.ts:60`:

> `--exclude-standard` removes every ignored file from the BYOS and signal-handler inventories, not
> just generated or binary content. An ignored text fixture, documentation example, shell script, or
> local configuration containing a credential path would therefore pass while AC-12 explicitly covers
> all `packages/cli/**`; the sandbox at line 227 demonstrates this failure mode by hiding
> credential-bearing text.

The finding is correct, and the sandbox I had written to *prove* the git inventory was the clearest
possible demonstration of the hole: it created `generated/log.txt` containing `ANTHROPIC_API_KEY=x`,
gitignored it, and asserted the inventory did not carry it. That assertion was true, and what it
proved was that the guard could not see a credential.

E-1 rules the remedy rather than leaving it to a fifth round:

> Walk `packages/cli/**` on the filesystem. Exclusions are **narrow, enumerated and asserted** —
> generated and binary paths only, `node_modules/`, `.turbo/` and any emitted output among them —
> never a blanket ignore rule, and each one is a named entry a later reader can weigh rather than a
> silent filter. The guard's own file stays excluded and that exclusion stays asserted load-bearing,
> per Q-0079.

That is what I implemented.

---

## File by file

### `packages/cli/src/frame.source.test.ts` — the only file changed

**128 insertions, 46 deletions.** Three changes, and the third is most of the diff.

**1. `inventory()` is a pruning filesystem walk.** It was `execFileSync('git', ['ls-files',
'--cached', '--others', '--exclude-standard', '-z'])`; it is now a recursive `readdirSync` walk that
prunes the directory names in a new `GENERATED` list and returns every other file, relative to the
root it was handed. Pruned *during* the walk rather than filtered after it, so an installed
dependency tree is never read — the exclusion is what keeps this affordable as well as what keeps it
narrow.

**An entry that is neither a file nor a directory stops the guard** rather than being dropped. This
is the clause that does not appear in E-1's text and that I judged its ruling requires: a walk
testing only `isFile()` and `isDirectory()` drops a symlink in silence, which is an exclusion nobody
enumerated — the exact shape E-1 forbids. It fails closed and it is demonstrated to fire.

**2. `GENERATED` is `['node_modules', '.turbo']`, and its JSDoc carries the argument.** Both are
installed or generated, nothing under either is authored, and — checked against this checkout — they
are exactly the two ignored paths inside the package (`git status --ignored --short packages/cli`
reports `packages/cli/.turbo/` and `packages/cli/node_modules/`, and nothing else).

The JSDoc states, in E-1's own terms, why this guard and
`packages/core/src/turbo-inputs.test.ts` correctly use different inventories: that file asks *what
does turbo hash*, and answers it with git; AC-12 asks whether a credential is **present in this
package's tree**, and existence is a filesystem question. It cites E-1 by name, so the next reader
who reaches for *"Membership is a git question, not a filesystem one"* (2026-08-28) finds the ruling
that pre-empts them rather than re-deriving the finding a fourth time.

**Two things are deliberately *not* excluded, and both are stated in the source:**

- **Emitted output.** E-1 names it as an acceptable exclusion; I did not add one. This workspace
  emits nothing, the output layout is Q-0096's to choose, and naming a directory here now would be
  this ticket deciding it — which is the objection **review round 2** raised against a `bin` target
  assumed to end in `.js`. If Q-0096's output is ignored and unscanned, that is Q-0096's entry to add,
  with a fixture, and the register below will make it a visible act.
- **Binary content.** Text is decoded as UTF-8 unconditionally. The direction is deliberate and was
  in the file before this round: a lossy decode can only make a scan report *more* than it should,
  where an exclusion is the only thing that can make it report *less*.

**3. The one git-shaped sandbox test became three.** The old test's whole premise was that git
performed the exclusion, so it could not be edited into shape.

| test | what it pins |
| --- | --- |
| *an ignored file is scanned, which is the whole of what E-1 ruled* | Over a repository the test builds: git is **shown** to drop `ignored/notes.txt`, and the inventory is **shown** to carry it. Both halves, because the second alone would pass over a `.gitignore` that never ignored anything. |
| *each enumerated exclusion excuses a real file, and nothing else is dropped* | A fixture per `GENERATED` entry, derived from the list; the inventory is exactly `['kept.json', 'src/kept.ts']`; each fixture is asserted to exist, so the rule removes a member rather than having no subject. |
| *an entry it cannot classify stops the walk instead of leaving the scan* | A dangling symlink makes `inventory()` throw. |

**The identity register, and why it is not a count.** My first draft asserted
`GENERATED.length > 1`. That is wrong here in a way worth recording: the fixtures are *derived from
the list*, so removing an entry removes its own subject and the behavioural assertion stays green
over a shorter rule. I found this by mutating `GENERATED` to `['node_modules']` and watching only the
arity floor fire. The list is now written out a second time as a `toStrictEqual` identity — Q-0073's
*"a count is not an identity"*, arriving in the same shape one layer down. Removing an entry is red;
adding one is red until the entry is deliberately registered, and its fixture is created
automatically.

---

## Red before green

Each new clause was demonstrated failing on its own, against the file as it now stands.

| mutation | result |
| --- | --- |
| `inventory()` restored to `git ls-files --cached --others --exclude-standard` | **3 failed / 10 passed.** `AssertionError: an ignored credential is invisible again — E-1: expected [ '.gitignore' ] to include 'ignored/notes.txt'` |
| `GENERATED` shortened to `['node_modules']` | **1 failed / 12 passed.** `the exclusion list moved — each entry is a named claim: expected [ 'node_modules' ] to strictly equal [ 'node_modules', '.turbo' ]` |
| the prune dropped — `walk(full)` unconditionally | **5 failed / 8 passed.** `expected [ '.turbo/nested/output.txt', …(3) ] to strictly equal [ 'kept.json', 'src/kept.ts' ]` — and the four real scans fail with it, because the walk then reads an installed tree |
| the `else throw` dropped, so an unclassifiable entry is skipped | **1 failed / 12 passed.** `expected [Function] to throw an error` |

The file was restored from a copy after each mutation and the working tree checked with
`git status --short --untracked-files=all`, which reports the one modified file and nothing else.

---

## What I deliberately left alone

- **`packages/core/src/turbo-inputs.test.ts` keeps `git ls-files --exclude-standard`.** E-1 says in
  as many words that the two guards ask different questions and correctly use different inventories,
  and that *"that is not an inconsistency to be tidied away, and neither entry needs amending"*.
  Making them agree would be the scope creep the ruling exists to prevent.
- **`packages/cli/src/fail.ts`** — round 4's subject, unchanged. **`packages/cli/src/package.test.ts`**
  — round 3's subject, unchanged. Neither was named by round 4.
- **`GENERATED` gained no third entry.** See above: no `dist`, no `coverage`, nothing speculative.
- **No production module changed.** This round touches one test file; the frame itself is untouched.
- **`AC-10`'s registers did not move and nothing needed re-deriving.** The change removes a
  subprocess read and adds no read outside the package beyond the `os.tmpdir()` sandboxes that were
  already there, so `packages/cli/turbo.json`'s two declared inputs are unchanged, `SUITES` and
  `MANIFEST` in `turbo-inputs.test.ts` are unchanged, `CI_JOBS` is unchanged, and
  `spike-parity.test.ts`'s four pinned totals are untouched — no `spike/test/` file is translated by
  this round.
- **No ticket file, no `docs/decisions/` entry, no `harness/` file.** Nothing here implies a decision:
  E-1 is the authority and it is already written.

---

## Residual limits, stated rather than left to be found

1. **The prune matches a directory *name* at any depth**, not a path anchored to the package root. A
   nested `node_modules` is therefore pruned too, which is what pnpm can produce and what I want; an
   authored directory that happened to be called `.turbo` would be skipped, which nothing does.
2. **Every collected file is read as UTF-8**, including one that is not text. Safe by direction (it
   can only over-report), and asserted nowhere, because there is no such file in the package.
3. **A symlink stops the guard.** If a later ticket legitimately adds one to `packages/cli`, this
   test fails until somebody decides whether the link's target is in scope. That is the intended
   trade: fail closed on an unclassified entry rather than drop it.
4. **Third narrowing of this one guard**, as E-1 records — round 3 found it scanning `src/**/*.ts`
   only, round 4 found the git replacement blind to ignored files, and this round walks the
   filesystem. The pattern is the ticket's own subject arriving inside its guard, and the reason each
   clause above is demonstrated red rather than read.

---

## Verification

Run in this implement worktree, everything forced.

| check | result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0, *"Lockfile is up to date"* — AC-1's install still passes with the manifest as declared |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — 1516 passed, 2 skipped. `@quorum/core` 1280/1282, `@quorum/shared` 142, **`@quorum/cli` 90 across 8 files**, `frame.source.test.ts` **11 → 13** |
| `npm test --prefix spike` | **19/19 test files passed** |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

`@quorum/shared` being green also confirms AC-11(a) is still closed: the `Q-0096` bullet added in an
earlier round keeps `plan-backlog.test.ts` satisfied, and the suite this ticket was handed red at its
requirements gate is green.

The identity sweep is worth naming for this round specifically. The new E-1 test runs `git init` in a
sandbox — not a commit-creating subcommand, so it resolves no identity — and every exclusion
assertion is made over a directory the test built rather than over this checkout, so no verdict here
moves with whether `node_modules/` or `.turbo/` happen to exist. The sweep runs both suites in a bare
checkout and again in one carrying `.harness/worktrees` and `.quorum/runs`, and is green in both
rows, which is that property measured rather than claimed.

---

## Nothing is owed to the human by this round

The five gate obligations (GA-1 to GA-5) stand as the requirement records them; this round adds none
and discharges none. No criterion was found ambiguous or contradictory, and no work was refused.
