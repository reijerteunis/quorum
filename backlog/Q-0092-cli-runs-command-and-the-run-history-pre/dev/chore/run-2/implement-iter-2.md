# Q-0092 — implement run 2, iteration 2

*Revision round. One major finding from `review/chore/run-2/chore-iter-1.md`, accepted and fixed.
Two files changed, 23 insertions, 1 deletion. No file under `spike/` was touched.*

---

## 1. The finding, and why I accepted it

> **major:** `packages/cli/src/runs.ts:259` The branch checks `token !== undefined`, whereas the
> authoritative spike checks `if (token)`. Consequently, `quorum runs ""` now reports
> `unknown run or ticket:` and exits non-zero, while the spike treats the empty positional value like
> no token and lists all runs. […] Use the spike's truthiness condition […] and add a parity test for
> an empty positional argument.

**Correct in every particular, and it is a behaviour divergence rather than a rendering difference.**
I verified the three things it rests on rather than taking them from the report:

1. **The spike selects on truthiness.** `spike/bin/harness.js:471` is `if (token) {`, and the
   tokenless listing is the fall-through below it at `:526–531`.
2. **The empty positional survives the parser, so the two spellings genuinely differ.**
   `packages/cli/src/argv.ts:61–62` pushes every non-`--` token into `positional` with no filtering,
   so `quorum runs ""` reaches the handler with `rest[0] === ''`. Had the parser dropped it, the two
   spellings would have been indistinguishable and the finding cosmetic. It does not.
3. **The divergent path is the failure sentence.** With the strict guard, `''` entered the token
   branch, `readRun` answered `not-a-run` (`resolveRunDirectory` rejects `''` lexically at
   `reader.ts:212`), `parseTicketId('')` failed, and the command printed
   `unknown run or ticket: ` — the token empty — and exited 1.

Ground rule 3 makes this decisive: behaviour is preserved, and a divergence introduced by the port is
not a preserved defect but a defect I added. It is fixed rather than registered.

**The reviewer's aside is also fair and I acted on it.** Iteration 1's report claimed a comparison
this case was absent from. §4 below is the re-audit, done conditional by conditional rather than
asserted a second time.

---

## 2. What changed, file by file

### `packages/cli/src/runs.ts` — 5 insertions, 1 deletion

The selection guard only. `if (token !== undefined)` → `if (token)`, with four lines of authority
above it naming the spike line, the parser line that makes the two spellings differ, and what the
strict form did:

```ts
// Truthiness rather than `token !== undefined`, so that `quorum runs ""` lists every run exactly
// as `quorum runs` does. `parseArgv` keeps an empty positional (`argv.ts:62`), so the two spellings
// genuinely differ on it, and the strict one turns a token the spike reads as *absent* into
// `unknown run or ticket: ` and a non-zero exit. Why: preserved behaviour, see `spike/bin/harness.js:471`.
if (token) {
```

The comment names the authority and does not transcribe the review or the ticket body, per
`harness/rules.md` § Comments. TypeScript narrows `string | undefined` to `string` on truthiness
exactly as it did on the strict test, so nothing below the guard changed and no cast was introduced.

### `packages/cli/src/runs.test.ts` — 18 insertions

One test, in the AC-5 describe block where selection lives, immediately before *"a run id wins over a
ticket-id reading of the same token"*:

> `an empty positional is no token at all, and lists exactly what no positional lists`

It asserts the property the two spellings disagree on rather than a rendering of it — that
`invoke(['runs', ''])` and `invoke(['runs'])` produce **identical** stdout, identical exit codes and
an empty stderr, over the three-run corrupt store. Asserting equality against the tokenless
invocation rather than a literal is deliberate: it cannot drift if the listing's format ever moves,
and it is the property the spike has.

Its comment states which assertion discriminates the two spellings, so a later reader does not have
to re-derive why the test exists.

---

## 3. Demonstrated red before green

The test was run against the **superseded** spelling before the fix was restored, so it is known to
have a subject rather than assumed to:

```
 ❯ src/runs.test.ts:194:33
     expect(plain(empty.stdout)).toBe(plain(absent.stdout))

 Test Files  1 failed (1)
      Tests  1 failed | 36 skipped (37)
```

The diff Vitest printed is the finding itself: the tokenless invocation printed the three-run listing
and the empty-token one printed nothing at all. Restored to `if (token)`, the file is **37 passed**.

---

## 4. The re-audit the reviewer's aside asked for

Iteration 1 claimed a comparison against the spike that this case was missing from, so I redid it
rather than repeat the claim. Every conditional and every formatter in the presentation layer,
compared against `spike/bin/harness.js:200–283`:

| site | spike | `runs.ts` | verdict |
| --- | --- | --- | --- |
| `formatMoney` | `v == null` | `value == null` | identical |
| `formatTokens` | `v == null` | `value == null` | identical |
| `formatVendorSummary` | interpolates `row.unpriced_steps` | `String(row.unpriced_steps)` | identical output; `String()` is the lint rule, not a behaviour change |
| `formatOccurrenceUsage` | four measures, no sum, no `unpriced_steps` | same | identical |
| `statusLabel` | `completed`/`running`/else | same | identical |
| `runHeaderLine` stage | `m.stage?.before ?? '?'` | same | identical |
| `runHeaderLine` duration | `m.duration_ms == null` | same | identical |
| `printRunsListHuman` empty state | `!runs.length` | same | identical |
| roll-up rows | `m.rollup ?? []` | same | identical |
| occurrence `duration_ms` | `s.duration_ms ?? 'n/a'` | `== null ? 'n/a' : String(…)` | equivalent on every input, `0` included |
| occurrence `adapter`/`model`/`verdict` | `?? 'n/a'` | same | identical |
| occurrence usage | `s.usage ? … : 'n/a'` | `step.usage ? …` | identical |
| occurrence error | `if (s.error)` | same | identical |
| **token selection** | **`if (token)`** | **was `token !== undefined`** | **the one divergence — fixed** |

Two collaborator facts were checked rather than assumed, because the detail view's paths depend on
them: `readRun` builds `manifestPath` from the **resolved** directory (`reader.ts:288`), as the spike
does from `realDir`; and a directory with no `manifest.json` reaches the same
`run "<token>": malformed manifest.json (…ENOENT…)` sentence through `readRun`'s catch as it does
through the spike's, so the listing's separate *"missing manifest.json"* wording — which is `core`'s
and unchanged — is not reachable from the detail path in either tree.

**The selection guard was the only divergence.**

---

## 5. Parity proved by execution, not by reading

The finding is a parity claim, so I proved it as one: the same fixture store driven through **both**
binaries, from a scratch harness written under the gitignored `packages/cli/dist/` and deleted
afterwards (`git status` shows only the two intended files).

```
=== THE FINDING — an empty positional lists, as the spike does ===
  exit=1  runs ""  stderr=""
  exit=1  runs
  stdout identical to the tokenless listing: true
  exit codes identical:                      true
  lists a run rather than failing:           true
=== PARITY — the same fixture through spike/bin/harness.js ===
  spike runs "" exit=1, stderr=""
  spike: "" identical to tokenless:          true
  spike stdout === quorum stdout for runs "": true
  spike exit   === quorum exit   for runs "": true
```

**Byte-identical stdout and the same exit code between `spike/bin/harness.js` and
`packages/cli/dist/quorum.js`.** The non-zero exit in both is the damaged sibling under erratum E-4,
not the token — it is the same code the tokenless listing exits with two lines above.

### The §10 table, re-verified through the built binary

`pnpm turbo run build --force` first, then `node packages/cli/dist/quorum.js`:

| invocation | expected | observed |
| --- | --- | --- |
| `runs` over a clean store | 0, listing | 0, listing |
| `runs` over an empty store | 0, `· no runs found` | 0, `· no runs found` |
| `runs`, damaged sibling present | 1, listing **and** warning | 1, both printed |
| `runs Q-9999`, zero matches, clean store | 0 | 0 |
| `runs Q-0011-2` beside a damaged sibling | 0, detail, sibling unnamed | 0, occurrence rendered, `bad` named nowhere |
| `runs ../SECRET.txt --json` | non-zero, nothing disclosed | 1, `{"error":"unknown run or ticket: ../SECRET.txt"}`, no `LEAKED` |

R-7 is why these are executed rather than read: a reviewer under `--sandbox read-only` cannot run
them, and AC-7's soft-versus-hard distinction produces identical bytes either way.

---

## 6. Verification

Installed first — the worktree starts with no dependencies:
`pnpm install --frozen-lockfile` (already up to date, 179 ms), `npm install --prefix spike`.

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached** |
| `packages/cli` suite | **13 files, 271 tests passed** |
| `npm test --prefix spike` | **19/19 files passed**, untouched |
| `pnpm turbo run build --force` | 3/3, `dist/quorum.js` emitted |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `git status --short` | exactly the two intended files |

---

## 7. What I deliberately left alone

- **Everything the earlier iterations shipped.** The review returned one finding and this round
  changes one guard and adds one test. No formatter, no criterion's implementation, no comment
  outside the guard, and no test outside the new one was touched.
- **`resolveRunDirectory`'s dead `''` clause** (`reader.ts:212`). With truthiness restored, `''`
  never reaches `readRun`, so that clause is now unreachable from this command — exactly as it is
  unreachable from the spike, whose `confined` expression carries the identical `['', '.', '..']`
  list below the identical guard. Preserved, not tidied: it is `core`'s and it is defensive for
  callers other than this one.
- **The five preserved defects of AC-12**, unchanged and still pinned.
- **`spike/`**, entirely — ground rules 1 and 2. No freeze re-record is owed.
- **The parity register.** `spike-parity.test.ts` is unchanged from iteration 1: no spike file moved,
  so its line totals and its four corrected rows still hold, re-derived green in this round's forced
  run.

## 8. Not covered by a criterion, reported rather than decided

Nothing in the requirement names the empty positional — AC-5 enumerates *no token*, *a run id*, *a
ticket id* and *any other token*, and `''` is a fourth reading of "no token" that only ground rule 3
settles. I have implemented what the spike does, which is what that rule requires, and I am naming it
here rather than treating the requirement's silence as authorisation to choose. If the gate would
rather `quorum runs ""` were an error, that is a deliberate behaviour change from the spike and needs
an erratum; it is one line and one test either way.

One artefact is outside the worktree and could not be removed from here: `/tmp/q0092-verify.mjs`, the
first draft of the verification harness, written before I moved it under `dist/`. It is outside the
repository, outside every allowed path, and is not committed.
