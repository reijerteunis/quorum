# Q-0125 — implement report, run 2 iteration 2

*A revision round. Written against `d3b7b53` with `docs/decisions/` ending at **093**, the entry
erratum E-1 rules landed. Verdict `proceed`.*

Both of review iteration 1's majors are real, both are the same class — **a check that cannot
fail** — and both are fixed at the layer the finding named rather than by widening the assertion
that happened to sit beside it. Nothing else moved: the thirteen criteria landed in iteration 1 are
untouched except where these two findings reach them, and no new file, dependency or configuration
key was added.

---

## 1. Major 1 — `packages/server/src/package.test.ts:170`, the AC-3 discriminator was tautological

**The finding, restated as I read it.** AC-3 asks for the emission/distribution block to be shown
red **in both directions** (R-7), because the cheapest wrong implementation of an inverted assertion
is to delete it. Iteration 1's discriminator built two fixtures and then asserted over the fields it
had just written into them — `asItWas.scripts?.build` is `undefined` because the line above deleted
it — and for the packed half asserted over `own.files` rather than over `asIfPacked`. So it
confirmed only that the fixtures had been constructed as intended. It could not have gone red for
any change to what AC-3 actually examines.

**What changed.** The rule is now a single predicate, and the real manifest and both fixtures are
judged by it:

```ts
const emitsAndIsNotDistributed = (candidate: Manifest): string[] => [ … ];
```

It returns the list of problems, each tagged with the **half** it belongs to — `emission:` for
producing an artifact and publishing it, `distribution:` for a tarball that does not exist — because
telling the two apart is what the criterion turns on, and a bare boolean cannot say which one
failed.

- The **AC-3 test** gains `expect(emitsAndIsNotDistributed(own)).toStrictEqual([])` above its
  by-name clauses, which the criterion's *Test:* clause requires and which are kept verbatim.
- The **discriminator** hands each fixture to that same function and asserts the **exact list** it
  reports: the pre-Q-0125 manifest must report exactly the two emission problems and no
  distribution one, and the manifest carrying `files: ['dist']` must report exactly the distribution
  problem *"a files allow-list claims a tarball that does not exist"* — which is the
  distribution-specific message the finding asked for, asserted rather than described.
- A third clause feeds a manifest that fails **both** halves at once (no build script, no map, plus
  `files`, `bin` and `private: false`) and asserts the count per half, so the function cannot be
  read as returning whatever was put into it.

**What this does and does not close, stated rather than implied.** Deleting the real AC-3 test
outright would still leave the discriminator green — that is true of any pair of tests and no
arrangement inside one file fixes it. What the finding identified and what is now closed is the
substantive hole: the discriminator exercised **nothing the real assertion uses**, so weakening the
rule — the cheapest way to make a failing real clause pass — was invisible to it. It is now the
first thing that goes red (mutation 1 below).

---

## 2. Major 2 — `packages/cli/src/build.test.ts:1066`, AC-2's subject was written down

**The finding, restated.** AC-2 requires discovery **by glob** so that a sixth `tsconfig.build.json`
joins the uniformity comparison automatically. `buildConfigs()` globbed, and the test then asserted
a hard-coded identity of four paths and, at `:1104`, a hard-coded `configs.length === 4`. A sixth
valid emitter would therefore have failed two maintained census assertions rather than being
compared — the fail-open shape the helper's own docblock refuses one layer up, arriving inside the
clause meant to enforce it.

**What changed.**

- **The subject is derived from the emitters.** `tscEmitConfigs()` takes `emitting()` — turbo's own
  `--dry=json` report, which this file already treats as a better oracle than reading manifests —
  keeps the tasks whose build command drives `tsconfig.build.json`, and maps each to the file it
  owes. `apps/web` is correctly absent, its command being `vite build`. The test asserts that the
  files the glob **finds** are exactly the files the emitters **owe**, so both directions fail
  closed: an emitter missing its configuration, and a configuration in a package that emits nothing.
- **Anti-vacuity is retained and is derived too**: `owed.length > 1`, because a comparison over
  fewer than two configurations proves nothing, and a derivation that matched nothing would
  otherwise make the identity trivially true.
- **The comparison is one function.** `divergences()` returns each disagreement named by file and
  key; the real clause asserts it is empty, and the discrimination test runs a **fixture set**
  through that same function rather than re-describing the comparison beside it. Its
  agreeing-member clause is what stops the function being read as "reports everything".
- **The deleted count clause is replaced by a proof rather than by nothing.** `buildConfigs` now
  takes a root, and a new test runs it over a temporary tree holding `packages/sixth`,
  `apps/seventh` and a `packages/eighth` with no such file — so the discovery is exercised finding a
  package nobody named, in **both** workspace roots, and a package with no configuration is absent
  rather than an error. That is the property `configs.length === 4` was claiming and could not
  establish: a count agreeing with today's tree says nothing about what happens when a sixth
  arrives.
- `buildConfigs` also **sorts** its result. Directory order is a property of the filesystem, so a
  comparison whose reference member came from `readdir` order had a verdict that was not purely the
  commit's — *"A test's verdict is a property of the commit, not of the checkout or the account"*
  (2026-08-30).

AC-12's derived-count clause (*"no `tsconfig.build.json` states a number the glob contradicts"*)
calls `buildConfigs()` unchanged and is unaffected — the root is defaulted.

---

## 3. The mutations, each red with a discriminating message

| # | mutation | what went red |
| --- | --- | --- |
| 1 | `emitsAndIsNotDistributed` made blind to `files` | AC-3 discriminator: *"a files allow-list is not reported as a distribution claim: expected [] to strictly equal [ Array(1) ]"* |
| 2 | `packages/server/package.json` reverted to its pre-Q-0125 shape | AC-3: *"the manifest stopped emitting, or started claiming to be distributed: expected […(2)] to strictly equal []"* |
| 3 | a stray `apps/web/tsconfig.build.json` | AC-2: *"the files the glob finds are not the ones the `tsc` emitters owe"*, `+ "apps/web/tsconfig.build.json"` |
| 4 | `packages/server/tsconfig.build.json` moved away | AC-2, the other direction: `- "packages/server/tsconfig.build.json"` |
| 5 | `rootDir: "source"` in `packages/shared/tsconfig.build.json` | AC-2, both clauses: *"packages/shared/tsconfig.build.json's compilerOptions diverges from packages/cli/tsconfig.build.json's"* |
| 6 | `buildConfigs` stops descending into `apps` | the glob proof: `- "apps/seventh/tsconfig.build.json"` |

Mutations 1 and 2 are the two directions R-7 asks for on AC-3. Mutations 3 and 4 are the two
directions the derived identity buys, which the hard-coded list could give in only one. Mutation 5
establishes `divergences()` over a real file rather than over the fixture that demonstrates it — a
guard shown red only by its neighbour has not been established (Q-0107). Mutation 6 is what the
deleted count clause could not do.

Every mutation was reverted and the tree re-verified: `git status` reports exactly two modified
files, `packages/cli/src/build.test.ts` and `packages/server/src/package.test.ts`, and no untracked
file anywhere.

---

## 4. What I deliberately did not do

**No change to any criterion's subject.** Both findings are about instruments, and a criterion's
*Test:* clause bounds the instrument (Q-0067 erratum E-1) — a reviewer may find an instrument fails
the job that clause gives it, which is exactly what both of these findings correctly are. AC-3's
*Test:* clause names the four surviving `toBeUndefined()` keys, `private`, `type` and the
both-directions demonstration; all are still asserted by name, with the predicate added above them
rather than replacing them. AC-2's clause names discovery by glob and comparison over every
discovered configuration; both are now literally true where one was maintained by hand.

**No second enforcer, and no widening.** `divergences()` replaced the per-key `expect` loop rather
than sitting beside it, because two implementations of one comparison is the drift this repository
keeps finding; the value-level shape assertions (`outDir`, `rootDir`, `declaration`, `noEmit` and
the two file sets) stay, since agreement on the wrong options is not agreement.

**No change to `packages/cli/test/workspace.ts`.** `emitting()` and `isolate()` are derived and were
already correct; the fix belongs in the consumer that stopped deriving from them.

**Nothing else from iteration 1 was touched** — no manifest, no `tsconfig.build.json`, no document,
no register, no count-bearing sentence. The eleven mutations recorded in iteration 1's report still
stand; these six are additional.

---

## 5. Verification

**GO-2, bare environment row.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`.
Forced throughout, after `pnpm install --frozen-lockfile` (*"Already up to date"*, 186 ms):

- `pnpm turbo run build --force` → **5 successful, 0 cached, 2.936 s**
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**, all green
- `pnpm sweep:git-identity` → **7/7 tasks, 0 cached**, *"the workspace suite executed and green with
  no resolvable git identity"*
- `pnpm exec quorum lint` → green

The populated row on `main` after the merge is the gate's, per Q-0072's closing finding.

**GO-3, re-timed rather than inherited.** Nothing in this round touches `isolate()` or the emitting
set, so the budgets were not expected to move — and they were re-run anyway rather than assumed,
because both comments stake their figure on a measurement:

| | Q-0122 (four emitters) | iteration 1 | this round |
| --- | --- | --- | --- |
| forced whole-workspace build | 2.5 s / 4 tasks | 2.579–2.62 s / 5 tasks | **2.936 s / 5 tasks** |
| `end-to-end.test.ts`, budget 90 s | 5.6–5.7 s | 5.83 / 6.00 s | **5.94 s** |
| `step-id.test.ts`, budget 180 s | 3.3 s | 3.49 / 3.53 s | **3.52 s** |

The build figure is one cold run and sits just above the spread iteration 1 recorded across four
(2.579–2.62 s); the structural reason it lengthens no chain is unchanged — the fifth task serialises
after `@quorum/core` and `@quorum/shared` through `dependsOn: ["^build"]` and nothing depends on it.

---

## 6. Open

**Nothing new.** R-2, R-5, R-6 and R-8 stand exactly as iteration 1 recorded them; this round adds
no consumer, no out-of-package read and no declaration. §7's seam was not needed and no erratum is
owed or requested.

**One nit and one observation, neither fixed here.** `build.test.ts`'s AC-12 `LIVE` register still
matches the two `tsconfig.build.json` headers with a literal needle rather than one derived from the
glob's count — redundant rather than fail-open, the sibling clause already deriving the spelling and
refusing every other one, and outside both findings. And `build.test.ts:209`'s symlink-write bound,
corrected in iteration 1 from *"all three"* to four `tsc` emitters plus Vite, went stale at Q-0122
rather than in this ticket; it is the only count site found so far that AC-12's own enumeration did
not list.
