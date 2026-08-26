# Q-0045 — implementation report

*`core/contracts`: ajv validation and the `run-manifest-v1` semantic pass. Chore route, **iteration
2** (revision). Branch `harness/Q-0045/implement`; iteration 1 is committed at `306027e`, this round
adds one uncommitted change on top.*

---

## Iteration 2 — the review finding, addressed

`review/chore-iter-1.md` returned **one major and no blocker**. It is correct, I have made exactly
the change it asks for, and nothing else.

### What it said

> The permanent core suite reads `spike/package.json` through `repoFile` and compares dependency
> versions against it. Q-0009's cutover is expected to delete `spike/`, so this test will then fail
> solely because the frozen implementation was removed; that contradicts AC-9's rule that no
> permanent test assert a fact the next landing changes and the implementation report's claim that
> the suite does not depend on the spike. Keep the literal `^8.20.0` and `^3.0.1` assertions, plus
> the lockfile and runtime-resolution checks, but remove the runtime dependency on
> `spike/package.json`.

### What changed — `packages/core/src/contracts/contracts.source.test.ts:87–94`

The only edit in this round. Three lines removed, the test's name and comment rewritten:

```diff
-  test('core declares both dependencies at the versions the spike already carries', () => {
+  test('core declares both dependencies, at the versions AC-1 names', () => {
+    // The literals are the criterion; they are not read back from spike/package.json at run time.
+    // The Q-0009 cutover deletes spike/, and a permanent test may not assert a fact this
+    // repository's next landing changes ("A red test is a permanent acceptance test", 2026-08-23).
     const pkg = JSON.parse(repoFile('packages/core/package.json')) as { dependencies: Record<string, string> };
     expect(pkg.dependencies.ajv).toBe('^8.20.0');
     expect(pkg.dependencies['ajv-formats']).toBe('^3.0.1');
-    const spike = JSON.parse(repoFile('spike/package.json')) as { dependencies: Record<string, string> };
-    expect(pkg.dependencies.ajv).toBe(spike.dependencies.ajv);
-    expect(pkg.dependencies['ajv-formats']).toBe(spike.dependencies['ajv-formats']);
   });
```

The literals stay, the lockfile test is untouched, and AC-11's runtime-resolution test is untouched.
No test was deleted: the folder is still 76 tests, because what went was three assertions inside a
test, not the test. `repoFile` throws when its subject is missing, so the removed lines were a hard
dependency on the spike's continued existence rather than a soft one.

### Why the reviewer is right, and my iteration-1 reasoning was not

I had written those three lines to stop the two version literals drifting from the spike's before the
cutover. That intent was sound and the instrument was wrong. The literals **are** the criterion —
AC-1 names `^8.20.0` and `^3.0.1` explicitly — so the cross-check bought nothing the literals did not
already assert, while costing a dependency on a directory this repository's next landing deletes.
The cheapest reading: if the spike's versions had drifted, the correct failure is against AC-1's
literals, which is what remains.

### I checked that this was the only instance

Every other `repoFile` call under `packages/core/src/contracts/` reads a path that survives the
cutover — `contracts/Q-0011/run-manifest.schema.json`,
`contracts/Q-0006/ticket-review-state.schema.json`, Q-0006's committed `ticket.md`,
`packages/core/package.json`, `packages/core/src/index.ts`, `pnpm-lock.yaml`. Two mentions of the
word "spike" remain in the folder's tests and **neither is a dependency on it existing**:

- `contracts.source.test.ts:176` asserts the *resolved* `ajv` path does **not** contain `spike` —
  true whether or not the spike is there, and it gets truer at the cutover.
- `contracts.source.test.ts:67` forbids the string `spike` on any import/export line of the module —
  a ban, not a read.

The rest are comments citing spike line numbers as evidence, which is this repository's house style
and is what `lint.source.test.ts:50–61` warns against forbidding by bare word.

### Two claims in iteration 1's report that this fix corrects

Stated plainly, because the reviewer reads the report beside the diff and the previous one is now
wrong in two places:

1. Under *Modified — `packages/core/package.json`* it said *"A test asserts the two agree with the
   spike's, so they cannot drift before the cutover."* **No longer true, and deliberately so.** The
   versions are pinned by AC-1's literals alone.
2. The coverage table's AC-1 row said *"both dependency versions against the spike's"*. Corrected in
   the table at the foot of this document.

A third claim was **overstated rather than false**, and it is the one that let the defect through: the
report said *"No test asserts a fact this repository's next landing changes. Nothing spawns the
spike…"*. Nothing did spawn the spike — I had checked the expensive failure mode (fact 18's
integrate-green/CI-red split) and not the cheap one, a plain file read. The claim was true about
execution and false about the suite as a whole.

---

## One thing the same reasoning implies that I did **not** change

**Stop-and-report, under AC-12.** The rule the reviewer applied to my one line applies far more
widely in this workspace already, and closing it is not this ticket's to do.

`packages/shared/test/corpus.ts:82` exports `spikeSource(relative)`, and landed, reviewed tests from
Q-0041 use it heavily to assert that spike source still reads a particular way —
`packages/shared/src/events.test.ts` (≈12 assertions across `claude.js`, `codex.js`, `mock.js`,
`adapters/index.js`, `engine.js`, `bin/harness.js`), `constants.test.ts` (`git.js`, `fanout.js`,
`engine.js`, `backlog.js`), `stages.test.ts`, `ticket.test.ts`, `step-output.test.ts` and
`project.test.ts`. Every one of them reads `spike/**` at run time and will fail at the cutover for
the same reason my three lines would have.

Those tests are deliberate and well-argued — the 2026-08-25 event-union entry says in as many words
that the package's suite *"asserts that those lines still read the way they are quoted here, rather
than trusting the transcription"*, which is a real check that has to read the spike to work. So this
is a **scheduling** question for the cutover, not a defect in Q-0041. I raise it because the
reviewer's finding generalises and someone should own it:

- It is **not mine**: `packages/shared` is an explicit non-goal of this ticket, and the requirement's
  *Scope drift* risk says any change outside `packages/core/src/contracts/`, its tests,
  `packages/core/package.json` and `pnpm-lock.yaml` is unrequested.
- It is plausibly **Q-0054's or the Q-0009 cutover's**, both of which already own deleting `spike/`
  and translating the suites that point at it.

I changed nothing there and am not proposing a fix — reporting it is the whole action, per charter §2
and AC-12.

---

## Verification, this round

All after the edit, from this worktree.

| Command | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21 successful, 21 total**, **0 cached** |
| `pnpm --filter @quorum/core test` | **15 files, 316 tests passed** |
| `pnpm --filter @quorum/core test src/contracts` | **76 tests passed** — unchanged from iteration 1 |
| `pnpm install --frozen-lockfile` | `Lockfile is up to date` — succeeds |
| `git status --short` | one modified file, nothing untracked |

`--force` is deliberate and I ran it rather than trusting the 6-of-7 cached result the plain
invocation returned: Q-0065 records a cached run reporting 7/7 while a forced one failed 1 of 123,
and this ticket's own risk list names a changed dependency graph as when a stale cache is most
plausible.

**What I could not verify this round, rather than working around.** Iteration 1 proved the frozen
spike suite green by symlinking `spike/node_modules/{ajv,ajv-formats,yaml}` into the workspace pnpm
store and removing them afterwards. `npm install --prefix spike` and `ln` are both denied in this
non-interactive session, so I could not repeat it. I created `spike/node_modules`, found `ln`
refused, and **removed the empty directory again** — the tree is byte-identical to how I found it
apart from the one test file. This is low risk and I am not treating it as proven: this round touches
no file the spike loads, the spike freeze is intact (`git status` reports nothing under `spike/`,
tracked or untracked), and chore's `integrate` runs the real `commands.install`, which begins
`npm install --prefix spike`, and will prove it properly. I would rather name the gap than let
"iteration 1 checked it" stand in for a check I did not perform.

---

## Everything below is unchanged from iteration 1

Carried forward because AC-12 requires the report to hold it, and this document replaces the previous
one. The code it describes is committed at `306027e` and this round did not touch it.

### OQ-4 — which import strategy was needed

**None of the three; a fourth was required, and option (c) does not work.** Tried in the order OQ-4
sets:

**(a) The spike's import verbatim** — `import Ajv2020 from 'ajv/dist/2020.js'`,
`import addFormats from 'ajv-formats'`. Two errors on the instance line:

```
src/contracts/contracts.ts(42,13): error TS2349: This expression is not callable.
  Type 'typeof import(".../ajv-formats/dist/index")' has no call signatures.
src/contracts/contracts.ts(42,28): error TS2351: This expression is not constructable.
  Type 'typeof import(".../ajv/dist/2020")' has no construct signatures.
```

**(b) The named import** — `import { Ajv2020 } from 'ajv/dist/2020.js'`. TS2351 goes; TS2349 stays,
because `ajv-formats` declares no named export of its plugin.

**(c) `esModuleInterop: true` in `tsconfig.base.json`** — applied, and it changed **nothing**: both
errors survived verbatim. `esModuleInterop` governs *CommonJS emit* — it injects `__importDefault`
into files compiling to `require`. Every workspace package is `"type": "module"` under
`module: nodenext`, so these files emit ES modules and the flag never applies. The real rule in play
is ESM→CJS interop: both packages are CommonJS carrying `.d.ts` files written in ES module syntax, so
TypeScript models `default` as the whole `module.exports` namespace, which is neither callable nor
constructable.

**`tsconfig.base.json` is byte-unchanged in the diff** — I reverted it after measuring, rather than
leave a workspace default altered for no effect. What ships is confined to `contracts.ts`:

```ts
import { Ajv2020 } from 'ajv/dist/2020.js';
import * as ajvFormats from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';

const addFormats = ajvFormats.default as unknown as FormatsPlugin;
```

Both resolve at run time to exactly what the spike's default imports resolve to (`Ajv2020Default ===
Ajv2020` is `true`; `ajvFormats.default` is the plugin function), which the byte comparison below
then proves end to end. The double cast narrows to a precise declared type rather than to `any`.

### The one edit outside the declared surface

`packages/core/src/backlog/backlog.source.test.ts:140` — landed with Q-0043 — asserts
`packages/core/package.json`'s dependency map **exhaustively** with `toStrictEqual`. AC-1 requires
adding `ajv` and `ajv-formats`, so that assertion goes red the moment it does. I widened it **without
weakening it**: the set stays exhaustive, so a stray dependency still turns it red, and Q-0043's own
claim — that `yaml` was its one addition — is untouched. Ten lines in one `test`, with a comment
naming Q-0045 and the 2026-08-22 entry. Forced by the criterion, not chosen, and not disguised as
in-scope.

### Files

**Added — `packages/core/src/contracts/contracts.ts` (162 lines).** The port of
`spike/src/contracts.js` plus the composition lifted from `spike/bin/harness.js:488–516`. One
module-level Ajv, `addFormats(new Ajv2020({ allErrors: true, strict: false }))`. `validate` builds
its error string character for character as the spike does. `readData` selects YAML on `/\.ya?ml$/i`
and JSON otherwise — no sniffing, no JSONL. `validateFile` keeps its signature, return shape and
per-call schema read, documented as load-bearing because it is what makes AC-8 defect 1 reachable.
`validateArtifact` is new: structural, then annotation, then pass, with semantic errors *replacing*
structural ones. `SemanticOutcome` is a three-member discriminated union, so `{ ran: true, reason: …
}` does not compile; three `@ts-expect-error` directives fail the build if any ever starts compiling.
No exported type is or wraps an ajv error object.

**Added — `packages/core/src/contracts/run-manifest.ts` (182 lines).** All fourteen messages verbatim
in push order, an occurrence identified by `step_id` and never by index. `TERMINAL_STATUSES` declared
here and unexported (fact 10, OQ-7). `ROLLUP_FIELDS` is `['step_count', 'unpriced_steps',
...USAGE_MEASURES]`, importing the five measures from `@quorum/shared`. The recomputation is
unexported, so the namespace is exactly `['checkRunManifestSemantics']`. The pass carries no guards,
through a single documented cast.

**Added — five test files (923 lines, 76 tests),** split by **which schema `$id` each consumes**, not
by taste: the module-level Ajv registers an `$id` for the process's life, so one file can put one
object identity per `$id` through the validator, and Vitest isolates files.

| File | Tests | Covers |
| --- | --- | --- |
| `contracts.test.ts` | 19 | AC-2, AC-3, AC-4, AC-8 defects 3 and 5, AC-10's rejection cases |
| `run-manifest.test.ts` | 25 | AC-5, AC-6, AC-8 defects 4 and 6, AC-10's first bullet |
| `validate-artifact.test.ts` | 14 | AC-7, AC-9, AC-10's two annotation-selection proofs |
| `schema-cache.test.ts` | 1 | AC-8 defect 1, alone |
| `contracts.source.test.ts` | 17 | AC-1, AC-2's single-construction rule, AC-6's independence rule, AC-9's no-printing rule, AC-11 |

`run-manifest.test.ts` proves every fixture structurally valid against the real frozen contract before
asserting anything semantic — a fixture the schema already rejects would prove the pass catches what
JSON Schema catches. The source-level rules assert **import specifiers and call shapes, not bare
words**, because the module names `checkAgainstSchema`, `removeSchema` and `../run-history/` in its
comments precisely to say what it may not reach for.

**Modified — `packages/core/package.json`:** two lines, `"ajv": "^8.20.0"` and
`"ajv-formats": "^3.0.1"`. **Modified — `pnpm-lock.yaml`:** regenerated, 44 added lines; ESLint's
`ajv@6.15.0` untouched, both majors coexisting.

### AC-9 — the one-time byte comparison against the spike CLI

Performed once in iteration 1, in a throwaway file **deleted afterwards** — CI never installs
`spike/node_modules` while `integrate` does (fact 18), and the cutover deletes `spike/`. Four
fixtures in one temporary directory; `node spike/bin/harness.js validate <schema> <data>` per case in
a fresh process; the core side rendered from `validateArtifact`'s return by the renderer transcribed
into `validate-artifact.test.ts`, with `vi.resetModules()` between cases. `$TMP` is
`/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/q0045-compare-n6KCwD` on both sides.

```
case: clean run-manifest
equal: true
spike: "\x1b[32m✓\x1b[0m $TMP/clean.json matches run-manifest.schema.json\n"
core : "\x1b[32m✓\x1b[0m $TMP/clean.json matches run-manifest.schema.json\n"

case: broken run-manifest
equal: true
spike: "\x1b[31m✗\x1b[0m $TMP/broken.json violates run-manifest.schema.json:\n    rollup: vendor \"codex\" has a row but no occurrence reported its usage\n"
core : "\x1b[31m✗\x1b[0m $TMP/broken.json violates run-manifest.schema.json:\n    rollup: vendor \"codex\" has a row but no occurrence reported its usage\n"

case: generic schema, invalid data
equal: true
spike: "\x1b[2m·\x1b[0m $TMP/artifact.json: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)\n\x1b[31m✗\x1b[0m $TMP/artifact.json violates other.schema.json:\n    /: must have required property 'a'\n"
core : "\x1b[2m·\x1b[0m $TMP/artifact.json: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)\n\x1b[31m✗\x1b[0m $TMP/artifact.json violates other.schema.json:\n    /: must have required property 'a'\n"

case: missing data file
equal: true
spike: "\x1b[31m✗\x1b[0m $TMP/absent.json: ENOENT: no such file or directory, open '$TMP/absent.json'\n"
core : "\x1b[31m✗\x1b[0m $TMP/absent.json: ENOENT: no such file or directory, open '$TMP/absent.json'\n"
```

Four for four, including the escape sequences, the four-space continuation indent and the skip line's
position **before** the verdict line. The permanent suite asserts the same four shapes as literals and
never executes the spike. **This round did not re-run it** — see the verification note above; nothing
in this round touches the rendered bytes or the code behind them.

### AC-7 — the read-count difference, named

`validateArtifact` reads the schema **once** and the data **once**, reusing both. The spike reads each
twice (`bin/harness.js:494` then inside `validateFile`; `validateFile` then `:510`). Read count is
internal, which charter §2 does not preserve, and reading once removes a race rather than changing an
outcome. **One spike path therefore has no counterpart:** the `catch` at `bin/harness.js:510–511`
that prints `✗ <file>: <message>` when the *second* read of an already-validated data file fails.
With a single read that branch is unreachable — a strictly smaller set of failures, not a different
one.

### AC-8 — the six preserved defects, none repaired

1. **Two data files against a schema carrying an `$id` fail on the second.** Preserved. Pinned by
   `schema-cache.test.ts`: the second `validateFile` throws `schema with key or id
   "https://quorum.local/contracts/run-manifest-v1.schema.json" already exists`, and it does not
   recover. No per-call instance, no `removeSchema`, no hoisted read; a source test forbids the first
   two by call shape.
2. **`validate` mutates shared state** — every compiled schema stays for the process's life, so a
   long-lived server accumulates. Preserved; recorded here and in the comment above the instance,
   which names it as M3's problem. Asserting it needs process-state observation, which AC-8 does not
   ask for.
3. **A non-compiling schema throws a raw ajv `Error`, not a typed one.** Preserved. Pinned by
   `contracts.test.ts`: `name === 'Error'`, no `code`, only the message distinguishes it.
4. **`checkRunManifestSemantics` assumes structural validity and guards nothing.** Preserved. Pinned
   by `run-manifest.test.ts` (`null` throws `TypeError`; `{}` reports clean) and from the other side
   by `validate-artifact.test.ts`, on a fixture broken both structurally and semantically where only
   the structural error appears and `ran` is `false`.
5. **Ajv accepts Q-0006's non-URI `$id` under `strict: false`.** Preserved, pinned against the
   committed schema.
6. **The roll-up groups on `usage.vendor` with no check that it is a string.** Preserved. Usage with
   no vendor groups under `undefined` and is reported as `rollup: missing row for vendor "undefined"
   (…)`. The line carries a one-line `Why:`.

### Register rows

**Row 13 — three validations stay distinct.** No file under `packages/core/src/contracts/` imports
anything matching `adapters`; neither `checkAgainstSchema(` nor `extractJson(` is called anywhere in
it. No vendor-specific parsing or tolerance entered the ajv validator — vendor labels reach the
roll-up only as opaque `usage.vendor` strings with no branch on their value.
`spike/src/adapters/index.js` was not read, imported or changed.

**Row 14 — a skipped semantic pass says so.** `SemanticOutcome`'s three states, of which only
`{ ran: true }` may be read as "the checks were performed"; `contract: null` names its reason
`unrecognised-annotation`; the recognised-but-suppressed state names `structurally-invalid`; no
caller can infer any of it from `ok`. The renderer emits the skip line **when and only when**
`reason === 'unrecognised-annotation'`, before the verdict, both asserted byte for byte.

### What I deliberately left alone

- **`spike/**` — nothing**, tracked or untracked (charter §3). The four suites importing
  `contracts.js` stay pointed at the spike; they are Q-0054's.
- **`packages/core/src/index.ts`** — byte-unchanged, so Q-0041's pin at
  `packages/shared/src/index.test.ts:47–53` stays green. A test re-asserts it.
- **`packages/shared`** — nothing added, and nothing changed, including the `spikeSource` matter
  raised above. `USAGE_MEASURES` is imported; `TERMINAL_STATUSES` stays with the pass.
- **`tsconfig.base.json`** — reverted to its committed bytes after (c) was measured.
- **The two roll-up implementations stay separate,** with no door left open for Q-0049: the
  recomputation is unexported, and a source test forbids importing `run-history` or calling anything
  matching `/\brollup\s*\(/`.
- **The `$id` collision was not fixed** — OQ-6's answer and a follow-up ticket's work, even though it
  is the defect most obviously worth fixing and the tests would be simpler without it.
- **No frozen contract, `ticket.md`, numbered doc, `DECISIONS.md` entry or flow file was touched.**
  No shipped flow calls `harness validate` (fact 14) and the CLI's printed behaviour is unchanged.
- **No second `x-quorum-contract` value, no registry, no version negotiation, no JSONL.**
- **`packages/core/test/`** — unchanged; `repoFile`, `tempDir`, `write` and `removeTempDirs` used as
  Q-0064 left them.

---

## Coverage against the twelve criteria

| | Criterion | Where |
| --- | --- | --- |
| AC-1 | Folder, five runtime exports, dependencies, lockfile, `index.ts` untouched | `contracts.source.test.ts` — surface, folder contents, specifiers, no `spike`, no `any`, **both dependency versions as AC-1's literals** *(corrected this round)*, `ajv@8` and `ajv-formats@3` in the lockfile |
| AC-2 | Same validator, same configuration, same strings | `contracts.test.ts` × 8 — the two-error literal, `format`, `strict: false`, `allErrors`, `oneOf`/`if-then`/nested-`required`, enum, type, a non-compiling schema; plus the single-construction source test |
| AC-3 | JSON and YAML by extension, case-insensitively, nothing else | `contracts.test.ts` × 4 — four extensions, a `.txt` of valid YAML rejected by `JSON.parse`, ENOENT naming the path |
| AC-4 | Signature, return shape, per-call schema read | `contracts.test.ts` × 3 — basenames from a nested path, invalid pair, both unreadable cases |
| AC-5 | Fourteen messages, same text, same order | `run-manifest.test.ts` × 15 — one per message (7 and 9 together), a twelve-message ordered literal, and `step_id`-not-index |
| AC-6 | Second implementation, unexported, no `run-history` | `run-manifest.test.ts` × 7 behavioural + `contracts.source.test.ts` × 3 structural, including the B2 cache double-count and all seven fields in order |
| AC-7 | Three states, ordering, replacement | `validate-artifact.test.ts` × 7, including three `@ts-expect-error` type-level assertions |
| AC-8 | Six preserved defects | `schema-cache.test.ts` (1), `contracts.test.ts` (3, 5), `run-manifest.test.ts` (4, 6), report + comment (2) |
| AC-9 | Nothing prints; four line shapes reproducible | `validate-artifact.test.ts` × 5 byte-exact + `contracts.source.test.ts` forbidding escapes, glyphs and rendered sentences + the one-time comparison above. **The suite no longer reads any spike path** *(this round)* |
| AC-10 | Real artifacts are the fixtures, missing one fails loudly | Both frozen contracts and Q-0006's committed frontmatter, every repository read through `repoFile` |
| AC-11 | Three validations distinct; the ported ajv is the workspace's | `contracts.source.test.ts` — no adapter import or call, `ajv` resolved from `packages/core` asserted to start `8.`, not from `spike`, plus an end-to-end call through the public surface |
| AC-12 | Stop and report | This document — OQ-4's fourth strategy, the forced `backlog.source.test.ts` widening, the six defects, both register rows, the read-count difference, the byte comparison, the `spikeSource` observation, and the spike suite I could not re-run this round |
