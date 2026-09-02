# Q-0096 — implement report, run 2, iteration 1

*Chore route, `developer-generalist`. Scope: **AC-1 to AC-6 only** — the export surface. AC-7 to
AC-14 are Q-0097's and AC-15 to AC-21 are Q-0098's; nothing below touches either.*

**Precondition met before a line was written.** AC-0's entry is landed —
*"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02), commit `58ffd85`
— and it is what this change is built against. GO-1 held: unlike the ninth instance (Q-0062), this
run was not launched over an absent entry.

---

## 1. What was built

`@quorum/core` resolves, at runtime and at typecheck, and exports sixteen symbols behind an
explicit `"."` subpath. The mechanism is decision 078(b)'s conditional map, and **all three
directions it demands were demonstrated with their negatives rather than named** — the failure this
repository keeps paying for is a mechanism asserted from a document instead of run.

| direction | resolves to | proof | negative, measured |
| --- | --- | --- | --- |
| Vitest | `src/index.ts` | `import('@quorum/core')` from `packages/cli` | drop `quorum-source` from `ssr.resolve.conditions` → *"Failed to resolve entry for package `@quorum/core`"* |
| `tsc` | `src/index.ts` | `pnpm turbo run typecheck --force` green, 14/14 | drop `customConditions` → `TS2307: Cannot find module '@quorum/core'` at every import site |
| plain `node` | `dist/index.js` | spawned process, `ERR_MODULE_NOT_FOUND` naming `@quorum/core/dist/index.js` | before the change the same import named `@quorum/core/index.js` — Node's legacy fall-through |

The condition is `quorum-source`. `ssr.resolve` rather than `resolve`, because Vitest's node
environment resolves through Vite's server pipeline; I set both first, measured that the client list
was redundant, and dropped it. The default list is spread rather than replaced.

---

## 2. Criterion by criterion

**AC-1 — resolves at runtime and at typecheck.** `packages/core/package.json` gains the conditional
map. Asserted in `packages/cli/src/package.test.ts` — the package that *declares the dependency*,
per §M-5, so the failure under test is a missing entry point and not a missing link. Five tests: the
Vitest import resolves; the manifest keys are the ruled shape; `customConditions` is the typecheck
half of the same cause (asserted as a cause, because a test cannot assert a compile success — the
same reasoning and the same shape as the assertion it replaces); the plain-Node process is sent to
the emit; `@quorum/shared` still resolves.

**AC-2 — the barrel exports the public API.** `packages/core/src/index.ts` is the sixteen. The
identity is pinned in `packages/cli/src/package.test.ts` as
`Object.keys(barrel).sort()` `toStrictEqual` `[...domain(), ...ERRORS].sort()`, where `domain()` is
**read out of `frame.source.test.ts`'s own `DOMAIN` register** by regex and `ERRORS` is the three
error classes, separately declared and commented. Nothing is hand-typed twice, which is what the
criterion asks. The derivation carries a has-a-subject test (`toHaveLength(13)` plus two named
members), without which a regex that silently matched nothing would make every assertion vacuous.
`packages/core/src/index.test.ts` asserts the file is no longer the stub.

**Why the identity lives in `cli` and not in `core`:** `DOMAIN` is in `packages/cli`, and a
`packages/core` test reading it would invert the dependency direction — the error Q-0089 was caught
making in the other direction. `core` keeps a local check that the surface is real, so a gutted
barrel fails in `core` too and not only in its consumer.

**AC-3 — the byte pin in `packages/shared` is retired with its reason recorded.** The second half of
*"core declares the dependency, and nothing else in core changed"* is gone; the dependency half
stays, and eight lines of comment record what was removed, whose subject expired when, and where the
surface is policed instead. Not deleted silently.

**AC-4 — Q-0090's expiring assertions are replaced.** All three, plus the `@ts-expect-error`, which
is **removed and not left** — and Q-0090's chosen mechanism worked exactly as designed: the first
typecheck after the manifest change reported `TS2578: Unused '@ts-expect-error' directive`, so the
change could not have been made quietly. The `OUTSIDE` row describing `packages/core/package.json`
as *"AC-9, the three absent keys"* is corrected with them, as are the other two rows, and the
module's own header — which still described the closed AC-9 — is rewritten.

**AC-5 — explicit, not a wildcard.** `exports` has one key. Two clauses, each shown red
independently by adding `"./*": "./src/*"`: the map-shape clause reported `[ '.', './*' ]`, and the
behavioural clause stopped seeing `ERR_PACKAGE_PATH_NOT_EXPORTED`. The negative is asserted **in a
spawned Node process**, because Vite refuses an unexported subpath while *transforming* the file — a
static `import()` of one fails the whole test file rather than rejecting a promise, so there is no
honest way to write it in process, and Node's resolver is the authority on an `exports` map anyway.

**AC-6 — registers.** Section 5.

---

## 3. File by file

| file | change |
| --- | --- |
| `packages/core/package.json` | the conditional `exports` map. The only production change in the diff. |
| `packages/core/src/index.ts` | the stub becomes the sixteen-symbol barrel, with a module JSDoc stating why the list is a decision and why types are not re-exported. |
| `tsconfig.base.json` | `customConditions: ["quorum-source"]`. |
| `vitest.shared.js` | `ssr.resolve.conditions`, with a header giving the mechanism, why `ssr` and not `resolve`, why the defaults are spread, and what turns it red. |
| `packages/cli/src/package.test.ts` | AC-9's block replaced by AC-1 (5 tests), AC-2 (2) and AC-5 (2); `inPlainNode` helper; three `OUTSIDE` descriptions; module header. |
| `packages/core/src/index.test.ts` | the scaffold test becomes AC-2's local half. |
| `packages/shared/src/index.test.ts` | AC-3. |
| `packages/shared/turbo.json` | `../core/src/index.ts` input removed — the read it covered is gone. |
| `packages/core/src/turbo-inputs.test.ts` | `MANIFEST` key removed; `COLLECTED_BASELINE` −8/+1 with its count 73 → 66; the `covered()` witness re-aimed at `packages/core/package.json`. |
| seven `*.source.test.ts` in `packages/core` | the byte pins replaced — section 4. |

---

## 4. The finding that outgrew its criterion: **eight** byte pins, not one

AC-3 names one byte pin of the stub barrel. **There are eight.** Seven sit inside `packages/core`,
in `adapters`, `backlog`, `contracts`, `fanout`, `git`, `lint` and `run-history`, each under a name
like *"packages/core/src/index.ts is untouched, so Q-0041's byte pin stays green"*, and each
asserting the same thing: *this port child adds no public re-export.*

**They all die for one reason, and it is exactly AC-3's reason.** Q-0096 is the ticket that gives
the package a public surface, so *"adds no public re-export"* stops having a subject in all eight
places simultaneously. This is R-7 realised — *"the emit collides with a guard nobody enumerated"* —
and it is larger than the requirement's search found. R-7 says an implement step that trips one
**reports it rather than editing it in passing**; editing was unavoidable, so this section is the
report.

**What replaced them, and why not deletion.** AC-3's method, applied consistently: each is now an
assertion that still says something true and is still a decision — *which of this folder's exports
the barrel carries*. `lint` contributes three of its six, `git` one, `contracts` one, `fanout` one,
`backlog` three, `adapters` two, and **`run-history` contributes nothing, which is now an assertion
rather than a consequence** (its six readers are Q-0092's to present). Each is derived by
intersecting the module's own key set with the barrel, not by transcribing `index.ts`. Deleting
seven landed pins silently is what AC-3 refuses; leaving them red was not an option.

**Shown red.** Removing `containment` from the barrel fails `git.source.test.ts` (`expected [] to
strictly equal [ 'containment' ]`) **and** the AC-2 identity register in `cli`, from one dropped
export, in two packages.

**One thing the guard caught in me.** My first version used `await import('../index.js')`.
Q-0072's clause C1 refused all seven — *"imports ../index.js dynamically, which no static scan
follows"*. Static imports throughout. The machinery working as designed, and the fourth ticket in
this repository to be refused on the way in.

---

## 5. AC-6 — every register, individually

| register | verdict | evidence |
| --- | --- | --- |
| `SUITES` | **untouched**, checked | still exactly `@quorum/shared#test` and `@quorum/core#test`. My new reads are in `packages/cli`, which is deliberately not audited there — its floors are *"calibrated for these two"* and widening is routed by name to Q-0091. Stated rather than assumed: **the new AC-1/AC-2/AC-5 reads are therefore not audited by `turbo-inputs.test.ts`**; what covers them is `package.test.ts`'s own `OUTSIDE` register and `packages/cli/turbo.json`. |
| `MANIFEST` | **updated** | `packages/core/src/index.ts` removed from `@quorum/shared#test`; that read no longer happens. |
| `NOT_READ` | **untouched**, checked | I added no literal the scan collects that nothing hashes. Clause B green. |
| `READ_BASES` | **untouched — and demonstrated red first** | my first draft of `index.test.ts` derived its own `PACKAGE` base, and clause C4 reported `packages/core/src/index.test.ts: PACKAGE`. Rather than register a fourth way, I routed the read through `repoFile`, the route that already is one. The red is the demonstration that the register has a subject. |
| `COLLECTED_BASELINE` | **updated — the eighth register, which no criterion names** | −8 (the byte-pin reads), +1 (`index.test.ts`, which still reads the file to say it is no longer the stub). **73 → 66 occurrences over 40 literals**, the literal count unmoved because that path is still collected once. |
| `spike-parity.test.ts` | **no-op, reported as a measurement** | re-run, not assumed: `binary-only` 220, `both` 2,739, `library-only` 2,469, **total 5,428, share 55%** — unchanged, because no file under `spike/test/**` changed. Ground rule 5 satisfied by re-derivation. |

**`COLLECTED_BASELINE` is worth naming separately: this is its first contraction.** Its doc comment
says membership is checked in one direction only — additions are fine, losses are the failure it
exists to catch. What makes these eight legitimate is that *the read stopped happening*, not that an
assertion was weakened, and the register now says so in place. My first draft of that paragraph said
sixty-seven; counting the array gave sixty-six, because I had forgotten the eighth removal was the
one AC-3 names. The corrected sentence records the slip, per this repository's own rule that a
measurement copied from a sentence is not a measurement.

---

## 6. What needs the human — two items, neither of which I may write

### 6.1 An erratum is owed on AC-1's *Test:* sketch (GO-2)

AC-1 asks to *"additionally import from a Node process outside the source directories … so the
claim is about package metadata rather than about the bundler."* **A successful plain-Node import is
unachievable in this half.** Under decision 078(b) the default condition resolves `./dist/index.js`,
and `dist/` is Q-0097's; pointing the default at source instead is what 078(b) forbids in as many
words, and plain Node cannot execute the barrel's TypeScript anyway.

**Decision 078(b)'s own wording is satisfiable and is what I implemented** — *"a proof that a plain
`node` process, which knows no such condition, gets `dist/`"*. So the contradiction is between the
sketch and the ruling that post-dates it, not between the sketch and the code. What the test asserts
is that resolution **reaches** the declared artifact: the error names `dist/index.js` and no longer
names the legacy `index.js` fall-through. Both clauses discriminate. The assertion carries a comment
saying it becomes `RESOLVED` at Q-0097 and is that ticket's to replace.

The requirement calls sketches *"the implementer's starting point, not a frozen contract"*, so I
took the ruling over the sketch. Recorded here because GO-2 routes an unactionable finding to an
erratum written **during** the loop, and `requirements/errata.md` is a ticket file this role may not
write — the engine discards it. This is the tenth appearance of a loop handed work no step in it can
perform, arriving as a documentation repair rather than a blocker.

### 6.2 Hand-off to Q-0097 — `@quorum/shared` needs the same treatment, or the emit cannot run

`@quorum/shared`'s `exports` still names `./src/index.ts` for both conditions. I left it alone
deliberately: no criterion of this half names that manifest, and it has no `dist/` to point at.

**But it is load-bearing for Q-0097 and is not obvious from that ticket's criteria.** Twenty-one
production files in `packages/core` import `@quorum/shared`, so the `dist/index.js` Q-0097 emits
will carry `import … from '@quorum/shared'`. Under plain Node that resolves to
`packages/shared/src/index.ts` — TypeScript source — and dies on the first relative specifier;
measured here as `ERR_MODULE_NOT_FOUND` on `packages/shared/src/constants.js`. So Q-0097's AC-7 must
give `@quorum/shared` the same conditional map, or the built binary will not run and AC-15 will
discover it. Stated now rather than left to be found.

---

## 7. Deliberately left alone

1. **`packages/shared/package.json`'s `exports`** — §6.2.
2. **`packages/core/src/shared-resolution.test.ts`'s header**, which states *"`turbo.json` has no
   `build` task and `tsconfig.base.json` emits nothing"* as its authority. Still true after this
   change — I added no build task — and it is **AC-14's**, which is Q-0097's. Named so it is not
   read as missed.
3. **`test-discovery.test.ts:59` and `package.test.ts:76`'s hand-written `['lint','typecheck','test']`** —
   AC-13, Q-0097's. They are still correct today because no fourth task exists.
4. **Types re-exported from the barrel.** Sixteen values, per AC-2 and OQ-2's *"let a later child add
   a seventeenth"*. A command child needing `RunFlowOptions` adds it — an ordinary edit, not a trap.
5. **A pre-existing lint warning**, reported not fixed per ground rule 3:
   `packages/core/src/backlog/backlog.ts:276` — *"Unused eslint-disable directive
   (no-control-regex)"*. Not in my diff; 0 errors, and it predates this change.
6. **`spike/`** — untouched, both `src` and `test`. Ground rules 1 and 2. No freeze re-record owed.
7. **`docs/`** — searched for claims this change falsifies and found none; the only hit,
   `06-development-plan.md:597`, describes why the ticket exists and stays true. `docs.test.ts` is
   green. The plan's sequencing was already corrected at the gate in `7014212`. AC-21 is Q-0098's.
8. **`backlog/`** — no ticket file written; the engine discards them.

---

## 8. Verification

Run in this worktree after `pnpm install --frozen-lockfile` and
`npm install --prefix spike --no-audit --no-fund`.

```
pnpm turbo run test lint typecheck --force   21/21 tasks, 0 cached
  @quorum/shared   142 passed
  @quorum/core   1,281 passed, 2 skipped
  @quorum/cli      100 passed
  server / web / compiler / templates   1 each
  lint  0 errors, 1 pre-existing warning     typecheck  clean
npm test --prefix spike                      19/19 test files
node spike/bin/harness.js lint               6/6 flows
pnpm sweep:git-identity                      both suites green with no resolvable git identity
```

**The counts move the way decision 078(b) predicts, and the arithmetic is self-checking.** (b)
recorded 142 / 1,280+2 / 94. Now 142 / 1,281+2 / 100: `core` +1 (one scaffold test removed, two
added, seven pins replaced one for one) and `cli` +6 (three removed, nine added). **No verdict moved
behind a build artifact** — every one of them still proves TypeScript source, which is the whole
point of clause (b).

**One environment row, not two — stated rather than implied (R-4).** This worktree has **neither**
`.harness/worktrees` nor `.quorum/runs`, which is the fresh-clone row that CI and `integrate` see.
The second row — a working checkout that has both — is owed at the merge, per Q-0072's closing
finding, where a merged, reviewed, integrate-green change failed on `main`. Nothing in this change
reads either directory, but that is a reason to expect the row to pass, not a substitute for running
it.

**R-3 applies and is worse than usual here.** The merge is red in an existing checkout until
`pnpm install` runs — and beyond Q-0090's measured case, `tsconfig.base.json` and `vitest.shared.js`
both changed, so a stale editor TypeScript server will report `TS2307` on `@quorum/core` until it
restarts. It looks like a code defect and is not.

---

## 9. Checks shown red before green

Not read, run. Each was demonstrated and then restored.

| what | how it was made to fail |
| --- | --- |
| the Vitest condition | dropped `quorum-source` → *"Failed to resolve entry for package"* |
| the tsc condition | dropped `customConditions` → `TS2307` at both import sites |
| Q-0090's `@ts-expect-error` tripwire | fired on its own, `TS2578`, on the first typecheck |
| AC-2's identity register | dropped `containment` from the barrel → red in `cli` **and** in `git.source.test.ts` |
| AC-5, both clauses | added `"./*": "./src/*"` → the map-shape clause and the Node clause each failed separately |
| `COLLECTED_BASELINE` | red with seven lost occurrences before it was updated |
| `READ_BASES` clause C4 | red with `index.test.ts: PACKAGE` before the read was routed through `repoFile` |
| `DOMAIN` derivation | guarded by its own has-a-subject test, so a regex matching nothing fails loudly |
