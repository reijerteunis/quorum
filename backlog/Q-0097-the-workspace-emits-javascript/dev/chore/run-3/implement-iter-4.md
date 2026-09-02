# Implement — Q-0097, chore run 3, iteration 4

**A revision round that changes no behaviour.** Review iteration 3 returned one major; it is closed
by a human-authored erratum written after that review, and the erratum names no code change. What
this round did instead is verify — the suites, the sweep, and the two measurements the erratum
itself carries — plus one seven-line comment-only edit whose justification is set out in full below
and flagged as the round's single judgment call.

---

## 1. The finding, and how it is closed

Review iteration 3, `review/chore/run-3/chore-iter-3.md`, single major, `build.test.ts:303`:

> The new isolated-workspace audit contradicts binding erratum E-1 … Restore the E-1 audit shape,
> **or obtain a new human-authored erratum that explicitly supersedes E-1** before retaining this
> strategy.

**The second remedy is the one that happened.** `requirements/errata.md` **E-2 — "E-1 is withdrawn;
AC-8 stands unamended and satisfied" (2026-09-02)** supersedes E-1 in full. Its ruling, in its own
terms:

- E-1's concurrency defence for `.harness` and `.quorum` is *true*, and it is **"an argument for
  moving the observation, not for narrowing the criterion."**
- E-1's cost objection *"weighed a round that was already being paid for"* — iteration 3 was in
  flight when E-1 was written, and never saw it, a step's inputs being read when it starts.
- **"No code changes on account of this entry. `INSTALLED`, the isolated workspace and the
  git-based outside observer all stand as iteration 3 shipped them."**

E-2 also rules on the finding itself: iteration 3's major is **"an artifact of E-1 and not a defect
in the change"** — correct on its own terms, and the ruling is what moved. The reviewer enforced a
ruling faithfully, which is the loop working.

**So no logic changed this round.** I verified that E-2's premise holds rather than assuming it —
see §3 and §4.

---

## 2. What I changed

### `packages/cli/src/build.test.ts` — +7 lines, comments only, no logic

Two `Why:` authority lines, in the form `engineering.md` prescribes (*"Where behaviour is
counterintuitive on purpose — an option that looks wrong and is load-bearing — add one line naming
the authority"*).

**At `INSTALLED` (the one-name prune list):**

```
 * Why: the five this replaced are `requirements/errata.md` E-1's register, which **E-2 withdraws**.
 * Read E-1 alone and this line contradicts a ruling; E-2 is the one that stands.
```

**At `isolate()` (the isolated-copy audit):**

```
 * Why: `requirements/errata.md` E-1 **rejected** this split and **E-2 withdraws E-1**, ruling that
 * the concurrency argument moves the observation rather than narrowing the criterion. Cited because
 * a reader meeting E-1 first would read this as contradicting a ruling — which a review round did.
```

### Why this is not a violation of E-2's "no code changes"

**Stated plainly because it is the one judgment call in this round, and a reviewer should be able to
overrule it cheaply.**

I read *"no code changes on account of this entry"* as governing the three things the sentence
names — `INSTALLED`, the isolated workspace, the git-based observer — all of which are untouched.
It is not read as forbidding a citation *of* E-2. Three reasons:

1. **E-1 is still in `errata.md` and is still readable.** E-2 supersedes E-1 rather than deleting
   it. A maintainer who opens `errata.md` meets E-1 first — it is the earlier entry — and E-1
   explicitly rules the five-name register and **explicitly rejects** the isolated split. Without a
   pointer, the shipped code reads as contradicting a landed ruling.
2. **One of the two sites already had a dangling reference.** `INSTALLED`'s doc comment said *"the
   whole of why it is one name **and not five**"* — and nothing in the file said what "five" was.
   That is a comment referring to an authority a reader cannot reach.
3. **This is the precise failure that cost round 3.** A reviewer read the code against E-1 and
   raised a major. The cheapest defence against a fourth round on the same subject is for the code
   to name the ruling that survives. A future maintainer reads only the code — not this report, and
   not the review thread.

Both lines cite rather than transcribe, per `harness/rules.md`. If the reviewer disagrees, the
remedy is one revert of a comment block; nothing depends on it.

---

## 3. What I verified, and how

Everything below was run in this worktree after `pnpm install --frozen-lockfile`, and everything
after the edit was re-run.

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached** |
| `npm test --prefix spike` | **19/19 test files** |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | **green** — both suites, no resolvable identity |
| `git status --porcelain` | one modified file |
| `git ls-files --others --exclude-standard` | **empty** |

**The sweep is the one worth calling out**, because it is the check a new `build` task could
plausibly have broken and no earlier round could have run against a build. It executes both suites
in a bare checkout with **no resolvable git identity**, and `build.test.ts` spawns `git ls-files`
and turbo inside it. It passes — `git ls-files` needs no identity — and it ran **from a linked
worktree**, which is Q-0058's fix to `GIT_CONFIG_GLOBAL` working in the environment `chore.yaml`
puts an implementer in.

**Zero untracked-unignored files after a full build** closes GO-5's class on the real tree rather
than in a fixture. The two files §1 of the requirement opened on —
`packages/shared/test/corpus.js` and `corpus.d.ts`, `tsc` output emitted beside its source because
nothing configured an `outDir` — are what that check exists to catch, and the shipped
`tsconfig.build.json` arrangement means the build now produces none of their kind.

---

## 4. Measurements re-derived rather than inherited

*"A measurement copied from a document is not a measurement"* (Q-0058). E-2 carries two figures
transcribed from iteration 3's report into a durable record. I re-measured both.

**E-2's write-set figures — confirmed exactly.**

```
$ find packages/{shared,core,cli}/dist   -type f | wc -l   →  96
$ find packages/{shared,core,cli}/.turbo -type f | wc -l   →  12
```

96 + 12 = **108 paths written, 96 under `dist/`, 12 under `.turbo/`** — E-2's sentence, verified.
These are *narrative* figures: the shipped tests assert the *property* (set equality in both
directions, `toBeGreaterThan(0)` floors, `toStrictEqual([])`) and pin no count, which is right — a
count would go red on any added source file, where the property does not.

**R-1's defect, proven closed live.** The merged requirement's decisive finding was that
`@quorum/core`'s emit would not run, because `packages/shared`'s manifest sent Node to TypeScript
source. Reproduced now, from `packages/core`:

```
resolve: …/packages/shared/dist/index.js
import OK, symbols: 58
```

Before AC-22 this resolved to `…/packages/shared/src/index.ts` and died with
`ERR_MODULE_NOT_FOUND … packages/shared/src/constants.js`. The chain
`core/dist/index.js` → `@quorum/shared` → `shared/dist/index.js` now holds.

**The declaration and the manifests, read rather than assumed.** Root `turbo.json` declares `build`
with `dependsOn: ["^build"]` and `outputs: ["dist/**"]`; `lint`, `typecheck` and `test` still
declare `[]`; `test.env` still holds `QUORUM_REAL_CLI` (Q-0065). Exactly three manifests declare a
`build` script — `shared`, `core`, `cli`, each `rm -rf dist && tsc -p tsconfig.build.json` — and
**root `package.json` declares none**, which is R-4's ruling holding.

**Ground rule 5 — the parity register, re-run and recorded as the expected no-op.**
`spike-parity.test.ts` passes with `binary-only 220 / both 2739 / library-only 2469 / total 5428`,
**share 55%**. This ticket adds no spike test file and moves no assertion between the halves, so
the totals are unmoved. Recorded rather than skipped: a share that *had* moved would mean something
was misclassified, and that would be the finding rather than the arithmetic.

---

## 5. One gap, stated rather than glossed

**OQ-1's residue — the delete-then-restore round trip performed *by hand* at the gate — I could not
complete.** My sandbox refused every spelling of removing a `dist/` directory (`rm -rf`, and a
`node -e` `fs.rmSync`). What I could do, I did:

- **cache hit:** `pnpm turbo run build` → `3 cached, 3 total, 14ms >>> FULL TURBO`
- **plain-node import of the emit:** from `packages/cli`, `@quorum/core` resolves to
  `…/packages/core/dist/index.js` and imports **16 symbols**, matching the register Q-0096 shipped
- **the chain:** the `@quorum/shared` import in §4

**The full round trip including the deletion is proven by the suite and passed** —
`build.test.ts:891`, *"a cache hit restores an artifact a plain node process can import and use"*:
force build → `removeEmit()` → assert the emit is **absent** → unforced rebuild → assert
`cache.status === 'HIT'` **from turbo's machine-readable summary** (its comment is explicit that
output text and timing are not the oracle) → assert the emit is back → import under plain node →
assert the exported symbols equal `publicApi()`. So the property is established; what is missing is
only the second, by-hand observation of it, and I would rather say that than report a hand check I
did not run.

---

## 6. What I deliberately left alone

- **All logic in `build.test.ts`** — `INSTALLED`, `isolate()`, the git-based outside observer, the
  real-workspace audit. E-2 ratifies them as iteration 3 shipped them.
- **`errata.md`, `ticket.md` and everything under `backlog/`** — the backlog belongs to the harness
  and the engine discards an agent's edits there. E-2 is the human's entry; I cite it and do not
  touch it.
- **`docs/decisions/` and its index** — a decision is the human's to record. This round implies
  none: E-2 is an erratum, not a decision, and the emit strategy was ruled by *"The emit serves the
  binary, and no test verdict moves behind it"* (2026-09-02) before the run.
- **The two registered preserved defects** (ground rule 3, and the merged requirement's §9):
  `test-command.test.ts:406`'s "at least" message over a `toStrictEqual`, and `docs.test.ts:202`'s
  guard being keyed on the literal `Q-0041` rather than on the running ticket. Both are real, both
  are one line, and both are in files this ticket otherwise leaves alone — changing them in passing
  invites a reviewer to read an untouched guard as a moved one.
- **`spike/`** — untouched, ground rule 1. Nothing here needed it: the emit is a workspace concern
  and the spike is plain Node ESM outside pnpm, turbo and ESLint. No freeze re-record is owed.
- **`packages/cli/turbo.json`'s `not.toContain('"outputs"')`** — R-7's ruling; it is already the
  contract 078(c) states.
- **Root `package.json` scripts and CI's `workspace` job** — R-4's ruling, carried as a clause of
  AC-14. No root `build` script, no CI build step, `WORKSPACE_TASKS` and `CI_JOBS` untouched.

---

## 7. Nothing new reported

No new defect was found this round. The one environment limitation — my sandbox's refusal to delete
a directory — is mine and not the repository's, and it is recorded in §5 rather than folded into a
claim.

**GO-2 note:** no finding this round required an erratum. E-2 already did that work, in the shape
*"A refused finding is a gate, not another round"* (2026-08-31) prescribes — with the useful twist
E-2 records about itself, that an erratum written *before* the round it was meant to unblock has
reported can be overtaken by that round.
