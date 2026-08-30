# Q-0038 — Implement report, round 5

*Written in `.harness/worktrees/harness__Q-0038__implement` on branch `harness/Q-0038/implement`,
2026-08-30.*

**No code changed this round.** The diff against `main` is byte-identical to round 1's. That is not
a claim that nothing was owed — it is the disposition the two normative errata require, and the
verification they left outstanding is what this round performed.

| Round | Finding | Disposition |
| --- | --- | --- |
| 1, 2, 3 | AC-12's `npm install --prefix spike` was never run | **Closed.** Ran this round, clean. E-2 withdrew itself as E-3(a); AC-12 stands unamended and is met. |
| 4 | `ctx.diffInputs` is keyed only by the range, so an earlier materialisation can be reused by a later deferred site | **Reported, not fixed**, per erratum E-3(b). Verified independently below. Needs its own ticket. |

---

## 1. Round 4's finding, addressed

`review/chore-iter-4.md` reports that `ctx.diffInputs` is keyed only by the interpolated range, so a
site materialising a range **before** a later step creates one of its endpoints leaves bytes that a
second site over the identical range then receives from the cache, because `buildPrompt` prefers
`ctx.diffInputs?.get(range)` unconditionally (`spike/src/engine.js:740`).

`requirements/errata.md` **E-3(b)** rules this real, pre-existing, and not this ticket's — *"reported,
not fixed"*, charter §2's *a defect found while reading is reported, never fixed in passing* applied
to a defect found while reviewing. I did not fix it. I did re-derive its three load-bearing claims
rather than inherit them, because E-3(b) states them as a reading of both texts and a reading is
checkable:

**(a) `buildPrompt` is untouched by this change.** The engine diff has exactly five hunks —
`@@ -48`, `@@ -93`, `@@ -122`, `@@ -787`, `@@ -817` (`git diff main...HEAD -- spike/src/engine.js |
grep '^@@'`). `buildPrompt`'s diff branch sits at `:735–742` on this branch, between the third hunk's
end and the fourth's start. It is in no hunk.

**(b) `main`'s preflight does not remove a cached entry either**, so the hazard is not introduced
here. `main`'s loop is three lines (`git show main:spike/src/engine.js | sed -n '132,136p'`):

```js
if (perTask && /\{[\w.]+\}/.test(range)) continue;
const pending = range.split('...').find((ref) => createdSoFar.has(ref));
if (pending != null) { ctx.deferredDiffs.set(range, { … }); continue; }
if (!ctx.diffInputs.has(range)) ctx.diffInputs.set(range, materialiseDiff(site, ctx));
```

The deferral branch `continue`s; nothing deletes. The new code records the deferral and never
materialises; nothing deletes there either. An earlier materialisation survives a later deferral on
both texts, identically.

**(c) No shipped flow reaches it.** It needs one range read both before *and* after its producing
step. Every diff site in `harness/flows/` and `spike/templates/harness/flows/`:

| Site | Shape |
| --- | --- |
| `chore.yaml:32` | `harness/{id}/integration...harness/{id}/implement` — the only site, and it is after its producer |
| `review.yaml:12`, `:19` | `{base}...harness/{id}/integration` — parallel members of one group, no producer between them |

So the precondition is absent from every flow that ships, in both trees.

**Why it is not fixed here, in one sentence beyond the erratum:** deleting the cached entry on
deferral would make two sites materialise the same range separately at different moments, which
AC-10's *"every panel member receives identical bytes"* forbids — so the fix is a choice between
keying by site, invalidating on deferral, and accepting the behaviour, and that choice needs its own
requirement rather than a line from an implementer. **It needs its own ticket, and opening one is
the human's at the gate.**

---

## 2. Rounds 1–3's finding, and what closed it

E-3(a) withdrew E-2 on the strength of round 4 actually running the install, once
`.claude/settings.json` gained `Bash(npm install --prefix spike*)` and the permission was delivered
into the worktree by fast-forwarding `harness/Q-0038/integration`. I confirmed the allowlist entry is
present in this worktree (`.claude/settings.json:8`) and ran the install again from scratch this
round. **AC-12 is satisfied outright, not by erratum.**

The record should keep round 3's substantive point, because it was right and the measurement is now
reversed: rounds 1–2 argued the pnpm substitution was equivalent and checked five packages against
the lockfile; the real npm install moved `spike/node_modules/fast-uri` to **3.1.5**. It is 3.1.5 in
this worktree now, matching `spike/package-lock.json:62`, and `npm install` reports `up to date` —
so the tree the spike suite ran against this round is the lockfile's, which is what the criterion was
protecting and what three rounds of measurement had not established.

---

## 3. AC-12 verification, measured this round

One environment row: the implement worktree. The main-checkout row is `integrate`'s and the human's
after the merge — risk 7 says a green tick is worktree-scoped, and this report does not claim a row
it did not run.

**Environment: `.harness/worktrees/harness__Q-0038__implement`, branch `harness/Q-0038/implement`**

| Command | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | ✅ `Lockfile is up to date` · `Already up to date` · 8 workspace projects · 163 ms |
| `npm install --prefix spike --no-audit --no-fund` | ✅ `up to date in 88ms` — the tree already matches `spike/package-lock.json` from round 4's install |
| `npm test --prefix spike` | ✅ **all 15 test files passed** |
| `pnpm turbo run test --force` | ✅ **7 successful, 7 total · 0 cached** · 27.53 s |
| `node spike/bin/harness.js lint` | ✅ 6/6 shipped flows clean (AC-10) |
| `git status --short` | ✅ empty — neither install moved a tracked file |

**Workspace counts, per package:**

| Package | Test files | Tests |
| --- | --- | --- |
| `@quorum/core` | 41 passed, 1 skipped (42) | 911 passed, 2 skipped (913) |
| `@quorum/shared` | 11 passed | 107 passed |
| `@quorum/server`, `cli`, `web`, `templates`, `compiler` | 1 passed each | 1 passed each |
| **Total** | **57 passed, 1 skipped** | **1,023 passed, 2 skipped** |

The one skipped file is `packages/core/src/adapters/real-cli.probe.test.ts`, the live-CLI probe gated
on `QUORUM_REAL_CLI`. Q-0065's record documents exactly this: 31/31 files and 0 skipped under the
switch, 30 passed and 1 skipped without it. `pnpm turbo run test --force` is the command AC-12 names
and it does not set the switch, so the skip is the expected state of that command and is not caused
by this change. Reported rather than rounded to green.

**`0 cached` is the load-bearing number.** A worktree resolves turbo's cache to the main checkout's,
so without `--force` a verdict can be replayed rather than computed — *"The test command defeats its
own cache"* (2026-08-27).

Scenarios belonging to this ticket, all green: `q0038-endpoint-preflight.js` P1–P7,
`q0077-base-flag.js` B6–B7, and the re-cut `q0035-empty-range.js` E16.

---

## 4. The change, file by file

Unchanged since round 1. Restated because the reviewer reads this beside the diff, and because no
review round has yet engaged with it.

### `spike/src/engine.js` (+165/−52, five hunks)

- **`:52` — one new context field, `baseOverride: base ?? null`.** `vars.base` cannot answer *"did
  the maintainer type `--base`?"*, because `:51` sets it either way and an override may legitimately
  name the configured value. Only a diagnostic reads it. An absent field means no override, so every
  hand-built fixture context keeps the configured wording untouched — the Q-0066 shape, avoided
  deliberately (AC-8, risk 4).
- **`:131–156` — the preflight loop, rewritten to judge endpoints.** `classifyEndpoints` replaces the
  single `.find()` over both endpoints. Both endpoints pre-existing → materialise, unchanged. Any
  producer → record the deferral, **retaining every producer** rather than the first match, then
  resolve every class-(c) endpoint the range still has and stop the run if one is absent. A
  half-interpolated key records no deferral, since it could never be looked up at step time.
- **`:810–836` — `classifyEndpoints`.** Three classes, left to right: `step-created`, `template`
  (only inside a `fan_out` `step:` template), `pre-existing` (everything else, including a ref only a
  *later* step creates). A range that is not exactly two endpoints returns none, so `materialiseDiff`'s
  shape guard keeps owning that failure rather than a classifier answering a different question.
- **`:838–846` — `notDueClause`.** What the preflight may say about the endpoint that is *not* due.
  It is not supposed to resolve, so calling it one that *"does not resolve either"* would be the same
  category error the diagnosis half exists to remove (AC-3).
- **`:848–872` — `missingEndpointFailure`.** One function now raises the missing-endpoint failure for
  both callers, so which layer noticed does not change what a maintainer reads. The three identifying
  phrases are chosen by the failing endpoint's own class and are byte-identical to Q-0035's. The
  `--base` branch is keyed on `ctx.baseOverride != null` — on whether the flag was *typed*, never on
  whether its value differs.
- **`:898–916` — `materialiseDiff`'s endpoint loop.** The `deferred?.ref === ref` ternary — the only
  site in the file conditioned that way — becomes two clauses that are never conflated: the failing
  endpoint's own producer is named as the step *expected to create* it; a producer of the **other**
  endpoint says the range *was deferred waiting for* that step, and never that it owed the ref that
  failed. Both appear when both endpoints were deferred.

### `spike/test/q0038-endpoint-preflight.js` (new, 332 lines)

P1 AC-1 (four sub-cases) · P2 AC-2/AC-3 with its paired negative · P3 AC-4 · P4 AC-5 at **run
level**, staged with a `type: script` step that deletes the base between the producer and the
consumer, so no fallback statement is owed · P5 AC-5 both-deferred, run in **both endpoint orders**
· P6 AC-7 `--dry` · P7 AC-1/AC-2 for the `fan_out` template, with its paired negative. Adapter calls
are counted from run-history occurrences, never inferred from a missing artifact.

### `spike/test/q0035-empty-range.js` (+15/−12, E16(a) only)

The one authorised edit, per AC-6. `calls.includes('implement')` → `assert.deepEqual(calls, [])`, and
the short-SHA assertion removed because the implement branch is now never created and the test's own
`git rev-parse --short` would throw. **Everything AC-6 enumerates survives unedited**, the negative
`doesNotMatch(/was expected to create harness\/\S*\/integration/)` at `:645` most of all. E16(b),
E11, E12, E15, E17 and `q0034-chore-preflight.js` C1/C1b/C2/C3 are untouched.

### `spike/test/q0077-base-flag.js` (+72)

B6 (unit) and B7 (CLI, end to end) added. B1–B5 untouched — AC-8 said this should *add* a scenario,
and it does.

### `docs/02-sdlc-pipeline-spec.md` (+3/−3) and `docs/GLOSSARY.md` (+8/−3)

§5.5's two range paragraphs rewritten in prose; the status line at `:3` bumped with the date and what
changed. The **Preflight** glossary entry states the per-endpoint guarantee. No new term, no synonym.

---

## 5. Deliberately left alone

| | Authority |
| --- | --- |
| The `diffInputs` cache key (round 4's finding) | E-3(b) — reported, not fixed; needs its own ticket |
| `spike/src/git.js:20–21`, `ensureWorktree`'s silent `HEAD` fallback | D-7 — evidence, not scope |
| `chore.yaml`'s step order; any new `harness lint` rule for the first-pass problem | Non-goals |
| `budget.per_run_usd`, still `10` at `harness/harness.yaml:14` | Non-goals |
| `packages/**` — not opened | AC-12, §Sequencing |
| `contracts/`, `backlog/`, `docs/decisions/`, `docs/06-development-plan.md` | Outside the role's paths, or the human's |
| `emptyRangeFailure`'s wording, outcomes, remedies and its deferred clauses at `:871`/`:880`/`:893` | AC-10 |
| The relatedness guard's position and message | D-4 |
| `q0006-engine.js` — not edited, and passes | AC-9 |

---

## 6. For the human at the gate

1. **Round 4's finding needs a ticket.** E-3(b) left open whether it is opened now or at close.
2. **The change itself is still unreviewed on its merits.** Four review rounds produced one finding
   about the report's verification and one about a pre-existing hazard; none engaged with the
   165-line engine change. E-3(a) says as much — *"that is a gap in the review, not evidence of
   quality either way, and the human at the gate reads the diff."*
3. **Verify forced on `main` after the merge**, not from `integrate`'s tick (risk 7).
4. **OQ-3 is still owed:** fold into Q-0051's body that its aborted D-5 is obsolete and the `.find()`
   it ruled preserved no longer exists.
5. **`npm ci --prefix spike`** remains unresolved in the allowlist — E-2 raised it, E-3 left it open.
