# Q-0045 — `core/contracts`: ajv validation and the run-manifest semantic pass

*Merged requirement, head-of-product, 2026-08-26. Route: **chore** (`requirements → chore → human
gate`). Parent: Q-0009. Depends on Q-0041 (landed). Depended on by Q-0049. Charter:
`harness/port-charter.md`; §6's Q-0045 row (`:313`) is normative and the inherited invariants are
register rows 13 and 14. Surfaces: `packages/core/src/contracts/`, its tests,
`packages/core/package.json` and `pnpm-lock.yaml`. Nothing under `spike/`, nothing in
`packages/shared`, no flow file, no contract file, no doc, no CLI — `packages/cli` does not exist
until Q-0010.*

> **Authority of the facts below.** Every message, ordering claim, escape sequence and preserved
> defect was re-derived against the working tree at `9ef83e8` during this merge, not transcribed
> from either candidate. Where the two candidates disagreed, the repository decided; where a
> candidate asserted something the repository contradicts, it is named in *Provenance*.

## Problem

`spike/src/contracts.js` is forty-one lines and it is why this project's contracts are contracts
rather than documentation. Before it existed, solutioning emitted seven artifacts for Q-0006 of
which one could be executed, which made the red phase a hope — *"Contracts are executable: ajv in
the toolchain, `harness validate` in the flows"* (`docs/DECISIONS.md`, 2026-08-22) exists to close
exactly that.

Beside it, and **not** beside the validator it extends, sits the product-level semantic pass:
`computeManifestRollup` (`spike/bin/harness.js:270`), `checkRunManifestSemantics` (`:298`) and the
`TERMINAL_STATUSES` list at `:131` that only they read. That is ninety lines of versioned product
contract implemented inside a CLI command — unreachable by M3's server and undiscoverable by a
contributor. Charter §7 names "contract validation and the `run-manifest-v1` semantic pass" among
the things exported from `core` rather than implemented in the CLI.

**The exposure is not that a check disappears.** A lost check is loud: a fixture stops failing. The
exposure is that the port keeps every message and destroys what they are *worth*, in three ways
nothing in this repository can currently detect.

**The roll-up recomputation is a check only because it is a second implementation.** Two functions
compute a per-vendor roll-up from occurrence usage today, deliberately: `rollup()` at
`spike/src/engine.js:463` writes it, and `computeManifestRollup()` recomputes it to see whether the
writer told the truth. They are written differently — an accumulator against a group-then-sum — and
their disagreement is the signal. Q-0049 ports the writer and **depends on this ticket**. The
obvious move at that point, or a reviewer's suggestion here, is that one should import the other. It
would compile, keep every message, and leave every test green — and the check would become a
tautology, comparing a manifest against a recomputation by the code that wrote it, able to detect a
hand-edited file and nothing else. That is precisely *"a check that skips its subject must not
report success"* (2026-08-25), arriving through a refactor.

**"Skipped is not passed" is this module's whole reason for having an annotation.** A schema with no
recognised `x-quorum-contract` still receives full structural validation and can still earn `✓`;
what it must never earn is silence about the checks that did not run. The spike prints an explicit
skip line *before* the verdict line, and register row 14 requires it. A port returning `{ok, errors}`
and nothing else loses the distinction entirely, and no consumer can then tell "validated against
`run-manifest-v1`" from "structurally fine, nobody looked". `harness run chore Q-0035 --dry` printed
a clean preview for a range it had not examined and the real run then billed $13.86; this is the
same shape one layer down.

**The ordering between the two passes is load-bearing and invisible.** The semantic pass runs *only
when structural validation passed*, and its errors *replace* the structural result rather than
joining it (`spike/bin/harness.js:508–512`). That ordering is what lets `checkRunManifestSemantics`
assume a well-formed document — it reads `data.steps`, `s.usage.vendor` and `data.rollup` with no
guards. A port that runs both and concatenates produces more errors from the same input, which is a
behaviour change, and one that reads like an improvement.

Underneath all three is the structural problem the port has everywhere: **the suites that would catch
a slip run against the spike.** `spike/test/q0011-runs-cli.js`, `q0034-review-fixes.js`,
`q0011-run-history.js` and `smoke.js` all import from `spike/src/` or drive `bin/harness.js`; they
are frozen under charter §3 and Q-0054 translates them last. Between this ticket and that one, the
only thing asserting that `core` validates what the spike validates is this ticket's own tests.

## User stories

- **As the maintainer**, when I point contract validation at a run manifest I need to know whether
  the semantic pass ran. A green tick that might mean "checked against `run-manifest-v1`" and might
  mean "nobody looked" is worse than no tick, because I will act on it.
- **As the maintainer**, I need a manifest's roll-up checked by something that is not the code that
  wrote it. Per-vendor figures are what I read to decide whether a ticket was cut wrong; a
  self-confirming check tells me nothing.
- **As a QA author writing a `type: script` step**, I need validation to fail on a violation and to
  name the instance path, so a contract failure is a red test rather than prose in a review.
- **As the cold-clone adopter**, I need a contract violation to print the path and the rule that
  failed, not an ajv stack trace, and an unreadable schema to fail before it validates anything.
- **As the contributor writing `packages/cli` (Q-0010) or M3's server**, I need contract validation
  to be a function in `core` returning a structured result — including whether the semantic checks
  ran and why not — so the CLI's job is choosing a marker and a colour and nothing else.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/contracts.js` — module-level `ajv` `:17`, `validate` `:21`, `readData` `:32`, `validateFile` `:37` |
| The lift | `spike/bin/harness.js` — `TERMINAL_STATUSES` `:131`, `computeManifestRollup` `:270`, `checkRunManifestSemantics` `:298`, the `validate` command that composes them `:488–516`, the colour helper `:44` |
| Its only in-repo consumers | `spike/bin/harness.js:20` (`validateFile`, `readData`); `spike/test/q0011-run-history.js:13` and `spike/test/smoke.js:568` (`validate`); `spike/test/q0034-review-fixes.js:14` (`validateFile`). All four are Q-0054's to translate |
| The frozen authority for the semantic checks | `contracts/Q-0011/runs-cli.contract.md:34–52` — "Executable manifest validation": the annotation, the four check families, the null-to-zero case, and "JSONL support is not added" in as many words |
| The erratum that created the pass | `backlog/Q-0011-run-history-on-disk/solution/errata.md` E-2, 2026-08-23 |
| The schema the pass extends | `contracts/Q-0011/run-manifest.schema.json` — **frozen** |
| The other real fixture | `contracts/Q-0006/ticket-review-state.schema.json` — `oneOf`, `if/then`, `format: date-time`, nested `required`, and a non-URI `$id`. **Frozen** |
| The independent twin that must stay independent | `spike/src/engine.js:463` — the writer's `rollup()`. Q-0049's, not this ticket's |
| Already in `shared`, not to be spelled twice | `USAGE_MEASURES` (`packages/shared/src/constants.ts:149–151`) — the five measures in the order the roll-up compares them |
| The folder rule | *"`core` is organised in folders named after the port's children"* (2026-08-26). This module's folder is `contracts/`; `src/git/`, `src/backlog/` and `src/lint/` are the landed pattern |
| The house-rule test pattern to copy | `packages/core/src/lint/lint.source.test.ts:50–61` — the allowed-import-specifier assertion, and `:45` on adding no public re-export |
| Test helpers already shipped | `packages/core/test/corpus.ts` — `repoRoot`, `repoFile` (throws when its subject is missing), `coreSourceFiles` (recursive since Q-0064, keyed by path below `src`, e.g. `contracts/contracts.ts`); `packages/core/test/repo.ts` — `tempDir`, `write`, `walk`, `removeTempDirs` |
| Where types must not go | Charter §4: the dependency direction is `core → shared`, never the reverse |

## Facts established by running and reading the code

Each was re-derived during this merge at `9ef83e8`. The criteria depend on all of them.

1. **`validate`'s error string** is `` `${e.instancePath || '/'}: ${e.message}` `` with
   `` ` ("${e.params.additionalProperty}")` `` appended when that param is present
   (`spike/src/contracts.js:26`).
2. **The ajv instance is module-level** (`:17`) and caches compiled schemas by `$id`. Validating the
   same object twice is free; validating a *different* object carrying the same `$id` throws
   `schema with key or id "…" already exists`.
3. **That defect is reachable from the shipped CLI**, because `validateFile` re-reads the schema per
   data file (`:38`) and the CLI loops data files (`bin/harness.js:500`).
4. **A schema that does not compile throws**, loudly and by design.
5. **`strict: false` is what lets `x-quorum-contract` sit in a schema at all.**
6. **`readData` selects YAML on `/\.ya?ml$/i`** — `.yaml`, `.yml`, `.YAML`, `.YML`; everything else
   goes to `JSON.parse`.
7. **The skip line prints before the verdict line, and both print** (`bin/harness.js:506–514`).
8. **A structurally invalid manifest never reaches the semantic pass** — the pass is gated on `r.ok`
   (`:507`), and its errors *replace* `r.errors` (`:512`).
9. **The pass has exactly fourteen distinct messages**, transcribed in AC-5 from
   `bin/harness.js:298–355`. Twelve is the number a first reading suggests; a non-adapter occurrence
   can emit three, and the roll-up comparison emits three.
10. **`TERMINAL_STATUSES` has exactly two readers**, `:313` and `:333`, both inside
    `checkRunManifestSemantics`. It moves with the pass and raises no ownership question with Q-0049.
11. **A mixed roll-up passes**: two `claude` occurrences, one priced and one unpriced, against
    `step_count: 2, unpriced_steps: 1` validates clean. A vendor whose every occurrence is unpriced
    recomputes to `cost_usd: null`, and a row saying `0` is refused by vendor and field.
12. **`contracts/Q-0006/ticket-review-state.schema.json` still validates the committed Q-0006
    ticket's frontmatter**, and rejects malformed history across `oneOf`, `if/then`,
    `format: date-time` and nested `required`.
13. **`harness/Q-0045/integration` exists and `git merge-base --is-ancestor … main` exits 0** —
    charter §8's first pre-run item is already satisfied.
14. **No shipped flow calls `harness validate`** — neither `harness/flows/` nor
    `spike/templates/harness/flows/`. No flow file needs editing.
15. **`.quorum/` holds no tracked file** (`git ls-files .quorum` returns nothing), so no committed
    run manifest exists to use as a fixture. This settles codex OQ-3.
16. **`packages/core/src/index.ts` is byte-pinned from another package.**
    `packages/shared/src/index.test.ts:47–53` asserts it equals `export const name = '@quorum/core';\n`.
    Adding a re-export there turns a landed, reviewed test red.
17. **`packages/core/package.json` declares only `@quorum/shared` and `yaml`**, and `pnpm-lock.yaml`
    carries only `ajv@6.15.0`, ESLint's transitive copy. `spike/package.json:17–18` declares
    `ajv ^8.20.0` and `ajv-formats ^3.0.1`.
18. **CI's `workspace` job runs `pnpm install --frozen-lockfile` and never
    `npm install --prefix spike`** (`.github/workflows/ci.yml`), while chore's `integrate` runs
    `commands.install`, which does. `spike/node_modules` is gitignored. Any workspace test that
    executes the spike therefore passes at `integrate` and fails in CI. This is why AC-9 is written
    as it is.
19. **`tsconfig.base.json` sets `module: nodenext`, `moduleResolution: nodenext`, `strict: true`,
    `skipLibCheck: true`, and does not set `esModuleInterop`.** Under `nodenext` TypeScript implies
    `esModuleInterop`, so the spike's import form is expected to compile unchanged — expected, not
    asserted, which is why OQ-4 survives as an ordered strategy.
20. **The colour helper is** `dim: \x1b[2m…\x1b[0m`, `green: \x1b[32m…\x1b[0m`,
    `red: \x1b[31m…\x1b[0m` (`bin/harness.js:44`).

## Acceptance criteria

Twelve, each independently testable against throwaway directories the test builds or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next
landing changes — *"A red test is a permanent acceptance test"* (2026-08-23).

### AC-1 — The module exists in its own folder, exports exactly five runtime names, and the two dependencies land with their lockfile

`packages/core/src/contracts/` holds `contracts.ts` and `run-manifest.ts`. `contracts.ts` exports
five **runtime** values and no more — `validate`, `readData`, `validateFile`, `validateArtifact`,
`checkRunManifestSemantics` — importing the last from `./run-manifest.js`. TypeScript `type`
exports are permitted and uncounted, provided none of them is or wraps an ajv error object.
TypeScript strict, no `any`, no `@ts-ignore` without its one-line reason, no import from `spike/**`.
`packages/core/package.json` gains `ajv` at `^8.20.0` and `ajv-formats` at `^3.0.1` — the versions
`spike/package.json` already carries — and `pnpm-lock.yaml` is regenerated in the same change.

`packages/core/src/index.ts` is **untouched** (fact 16), matching how `git`, `backlog` and `lint`
landed: every consumer this ticket has is in-package.

*Test:* `Object.keys` over the module namespace equals the five names, every value a function. A
source-level test over `coreSourceFiles()` asserts that every file keyed `contracts/…` imports only
`node:fs`, `node:path`, `yaml`, `ajv/dist/2020.js`, `ajv-formats`, `@quorum/shared` and its own
siblings, and that no import, export or `require(` line names `spike` — the shape at
`lint.source.test.ts:50–61`. `repoFile('packages/core/src/index.ts')` still equals
`export const name = '@quorum/core';\n`. `packages/core/package.json` declares both dependencies;
`pnpm-lock.yaml` contains an `ajv@8` entry. Workspace `pnpm lint`, `pnpm typecheck` and `pnpm test`
green, and `pnpm install --frozen-lockfile` succeeds from a clean checkout.

*Note:* the lockfile's existing `ajv@6.15.0` is ESLint's and must not be reused; the workspace will
hold both majors, which pnpm handles.

### AC-2 — `validate(schema, data)` is the same validator, configured the same way, reporting the same strings

One module-level Ajv 2020 instance, constructed
`addFormats(new Ajv2020({allErrors: true, strict: false}))` at module scope, not per call. It
returns `{ok: true, errors: []}` or `{ok: false, errors: string[]}`, never throws on invalid
*data*, and throws on a schema that does not compile — an authoring bug, which must stay loud. Each
error is `` `${instancePath || '/'}: ${message}` `` plus `` ` ("${params.additionalProperty}")` ``
when that param exists, in ajv's own error order.

*Test:* a document violating both `required` and `additionalProperties` returns exactly
`["/: must have required property 'a'", "/: must NOT have additional properties (\"b\")"]`; a
`format: date-time` violation (proving `ajv-formats` is registered, not merely installed); an
unknown keyword accepted (proving `strict: false`); two independent violations returned together
(proving `allErrors: true`); `oneOf`, `if/then`, enum, type and nested-`required` violations each
reporting the nested instance path a caller needs to locate them; a non-compiling schema asserted to
throw; a source-level assertion that the file constructs Ajv exactly once.

### AC-3 — `readData` reads JSON and YAML by extension, case-insensitively, and nothing else

`.yaml`, `.yml`, `.YAML` and `.YML` go to `YAML.parse`; every other path goes to `JSON.parse`. Both
propagate their parser's error unchanged. No content sniffing, no inferred extension, no frontmatter
extraction, no JSONL — `contracts/Q-0011/runs-cli.contract.md:36` refuses it in as many words.

*Test:* one file per extension; a `.txt` holding valid YAML asserted to throw a JSON parse error; a
missing file asserted to throw `ENOENT` with the path in the message.

### AC-4 — `validateFile` keeps its signature, its return shape and its per-call schema read

`validateFile(schemaFile, dataFile)` reads the schema, reads the data, validates, and returns
`{...validate(schema, data), schema: basename(schemaFile), data: basename(dataFile)}` — basenames,
not paths. Read, parse and schema-compilation failures throw. **It reads the schema on every call**,
which is what makes AC-8 defect 1 reachable and is therefore not an implementation detail to
optimise away.

*Test:* a valid pair returns `{ok: true, errors: [], schema: 'x.schema.json', data: 'y.json'}`, the
basenames asserted against full paths in a nested temporary directory; an invalid pair carries the
same two keys alongside its errors; an unreadable schema and an unreadable data file each throw.

### AC-5 — `checkRunManifestSemantics` reports the same fourteen problems, with the same text, in the same order

`checkRunManifestSemantics(data): string[]` — empty when clean, never throwing on well-formed input.
Verbatim, with `${…}` marking interpolation:

| # | Message |
| --- | --- |
| 1 | `steps: duplicate occurrence_dir "${occurrence_dir}"` |
| 2 | `rollup: duplicate vendor "${vendor}"` |
| 3 | `run: terminal status "${status}" requires non-null ended_at and duration_ms` |
| 4 | `run: status "running" requires null ended_at and duration_ms` |
| 5 | `run: duration_ms ${duration_ms} does not match ended_at - started_at (${computed})` |
| 6 | `steps[${step_id}]: kind "adapter" requires non-null adapter` |
| 7 | `steps[${step_id}]: kind "${kind}" requires null adapter, got "${adapter}"` |
| 8 | `steps[${step_id}]: kind "${kind}" requires null model` |
| 9 | `steps[${step_id}]: kind "${kind}" requires null usage` |
| 10 | `steps[${step_id}]: terminal status "${status}" requires non-null duration_ms` |
| 11 | `steps[${step_id}]: status "running" requires null duration_ms` |
| 12 | `rollup: missing row for vendor "${vendor}" (occurrences report usage but rollup has no entry)` |
| 13 | `rollup: vendor "${vendor}" field "${field}" is ${JSON.stringify(persisted)}, recomputed from occurrence usage is ${JSON.stringify(computed)}` |
| 14 | `rollup: vendor "${vendor}" has a row but no occurrence reported its usage` |

**The order is the order the source pushes**: duplicate occurrence directories, then duplicate
roll-up vendors, then the three run-level lifecycle checks, then the per-step block in step order
(6–11, and a single step may emit several — a `script` occurrence carrying an adapter *and* usage
emits 7 and 9), then the roll-up comparison — 12 and 13 in computed-vendor order, then 14 in
persisted order. Message 5 fires only when `started_at`, `ended_at` and `duration_ms` are all
present. A step is identified by its **`step_id`**, never its array position. `TERMINAL_STATUSES` is
`['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted']`, declared once inside
this module and not exported (fact 10).

*Test:* one fixture per message asserting the exact string, built against the real
`contracts/Q-0011/run-manifest.schema.json` shape; a fixture carrying several problems asserting the
**entire** array as an ordered literal; the `script`-occurrence case asserting two messages from one
step; a clean manifest asserting `[]`.

### AC-6 — The roll-up is recomputed by this module's own implementation, which is unexported and imports nothing from `run-history`

Grouping is by the exact `usage.vendor` value over occurrences carrying `usage`; occurrences with no
`usage` are skipped. Each row carries `vendor`, `step_count`, `unpriced_steps` and the five
`USAGE_MEASURES` from `@quorum/shared` — imported, not spelled out again. `step_count` counts
usage-bearing occurrences; `unpriced_steps` counts those whose `cost_usd` is null or absent; each
measure sums the non-null values and is **`null` when every value was null**. A reported zero stays
zero. Comparison against the persisted row is strict (`!==`) across all seven fields in that order,
so a persisted `0` against a recomputed `null` is reported by vendor and field — the whole reason
the pass exists (E-2, 2026-08-23; `runs-cli.contract.md:49–52`).

**The recomputation is not exported.** Q-0049 ports the writer's `rollup()`
(`spike/src/engine.js:463`) as its own implementation and must not import this one, nor this one
that. Two independent implementations agreeing is the evidence; one compared against itself is a
tautology that can only detect a hand-edited file. Its container shape is therefore internal and
unconstrained.

*Test:* AC-1's five-name surface already excludes it. A source-level test asserts that no file under
`packages/core/src/contracts/` imports from `../run-history/` or names `rollup(`. Behaviourally,
through `checkRunManifestSemantics`: an unpriced vendor whose row says `cost_usd: 0` fails with
message 13 naming the vendor and the field (the frozen contract's own AC-14 case); a genuinely
reported `cost_usd: 0` passes; a mixed priced/unpriced vendor validates clean against
`step_count: 2, unpriced_steps: 1` (fact 11); a vendor with usage and no row gives 12; a row with no
usage gives 14; a token total inflated by re-adding a cache component fails on `input_tokens`, which
is `spike/test/q0034-review-fixes.js` scenario B2's subject.

### AC-7 — `validateArtifact` composes the two passes, and a skipped semantic pass says so *(register row 14)*

`validateArtifact(schemaFile, dataFile)` performs, in this order:

1. Structural validation of the data against the schema. Throws where `validateFile` throws.
2. Reads the schema's `x-quorum-contract`. The single recognised value is `run-manifest-v1`; a
   missing, empty or unrecognised value selects no pass. Selection is never by filename, path, title
   or `$id`.
3. Runs `checkRunManifestSemantics` **only when** the contract is recognised **and** step 1 returned
   `ok`. Its errors **replace** the structural result's errors; they are never concatenated, because
   step 1 returned none.

It returns `{ok, errors, schema, data, semantic}`, where `semantic` is exactly one of:

| `semantic` | When |
| --- | --- |
| `{contract: 'run-manifest-v1', ran: true}` | recognised, and structural validation passed |
| `{contract: 'run-manifest-v1', ran: false, reason: 'structurally-invalid'}` | recognised, structural validation failed |
| `{contract: null, ran: false, reason: 'unrecognised-annotation'}` | missing, empty or unknown annotation |

Three states, not two. **`ran: true` is the only value that may be read as "the semantic checks were
performed"**, and no caller may infer it from `ok`.

**The schema and the data are each read once per call and reused for both passes.** The spike reads
the schema twice (`bin/harness.js:494` and inside `validateFile`) and the data twice (`validateFile`
and `:510`). Read *count* is internal, which charter §2 does not preserve, and reading once removes
a race between the two reads rather than changing any outcome. It is named in the implement report
as the one internal difference from the spike, and it is the reason the spike's second-read `catch`
path has no counterpart here.

*Test:* a `run-manifest-v1` schema over a clean manifest gives `ok: true, ran: true`; over a
semantically broken one, `ok: false, ran: true` with only the semantic messages; over a fixture that
is broken **both** structurally and semantically, `ok: false, ran: false,
reason: 'structurally-invalid'` with only the structural error and **no** semantic message, so the
suppression is what is proved (fact 8); a generic schema and an `x-quorum-contract: unknown-v1`
schema each give `contract: null, ran: false, reason: 'unrecognised-annotation'` while still
returning the structural verdict — clean data `ok: true`, invalid data `ok: false`.

### AC-8 — Six preserved defects, carried unfixed and reported *(charter §2)*

None is repaired. Each is pinned by a test or named in `dev/implement-report.md` with the statement
that it is preserved, so a later "cleanup" turns this suite red rather than passing silently.

1. **Two data files against a schema carrying an `$id` fail on the second**, with ajv's
   `schema with key or id "…" already exists` (facts 2–3). The module-level instance caches by
   `$id` and each call hands it a fresh copy. Neither a fresh Ajv per call, nor `removeSchema`, nor
   hoisting the schema read out of a caller's loop may be introduced here.
2. `validate` mutates shared state: every compiled schema stays in the module-level instance for the
   life of the process, so a long-lived server accumulates them. M3's problem, not this one.
3. A non-compiling schema throws a raw ajv `Error`, not a typed one, so a caller cannot distinguish
   an authoring bug from a filesystem failure without reading the message.
4. `checkRunManifestSemantics` assumes structural validity and has no guards; called directly on a
   malformed document it can report `rollup: missing row for vendor "undefined"` or throw. Safe only
   because AC-7 orders the two passes. The port adds no guards.
5. Ajv accepts `contracts/Q-0006/ticket-review-state.schema.json`'s non-URI `$id`
   (`Q-0006/ticket-review-state`) without complaint under `strict: false`.
6. The roll-up groups on `usage.vendor` with no check that it is a string, so a missing vendor
   becomes the key `undefined` and is reported as a missing row for a vendor of that name.

*Test:* defect 1 asserted directly against `contracts/Q-0011/run-manifest.schema.json` — two
`validateFile` calls with two valid data files, the second asserted to throw with the `$id` in the
message. Defects 3, 4, 5 and 6 asserted by observable outcome. Defect 2 is recorded in the report
and covered by a comment, because asserting it requires observing process state.

### AC-9 — Nothing in `core` prints, and the CLI's four line shapes are reproducible from what `validateArtifact` returns

No ANSI escape, no marker glyph, no indentation and no user-facing sentence appears anywhere in
`packages/core/src/contracts/`. Charter §7 assigns event rendering to the CLI's residual scope; M4's
flow editor shows validation errors in a browser where an escape byte is a bug, and M3's server
would otherwise ship terminal control codes over a WebSocket. The *shape* of the API changes, which
§2 explicitly does not preserve; the *printed bytes* do not, and this criterion is what proves it.

The test defines a renderer of four line shapes, transcribed as literals, and drives it from
`validateArtifact`'s return value:

- `\x1b[2m·\x1b[0m ${f}: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)` — emitted when and only when `semantic.reason === 'unrecognised-annotation'`, **before** the verdict line
- `\x1b[32m✓\x1b[0m ${f} matches ${result.schema}`
- `\x1b[31m✗\x1b[0m ${f} violates ${result.schema}:\n    ${result.errors.join('\n    ')}`
- `\x1b[31m✗\x1b[0m ${f}: ${error.message}` for a throw

Four cases are asserted byte for byte including the escape sequences: clean run-manifest, broken
run-manifest, generic schema over invalid data (two lines, skip first), and a missing data file.
Exit-code mapping — non-zero when any file was bad — is asserted as a property of the returned `ok`
values, not implemented in `core`.

**The test does not execute the spike.** Byte-equality with `spike/bin/harness.js validate` is
verified **once, by the implementer**, by running both over the same four inputs and pasting the
comparison into `dev/implement-report.md`. It is not a permanent assertion, for two independent
reasons, both verified: CI's `workspace` job never installs `spike/node_modules` while chore's
`integrate` does (fact 18), so a spawning test would report green at `integrate` and red in CI; and
the Q-0009 cutover deletes `spike/`, so such a test asserts a fact this repository's next landing
changes, which *"A red test is a permanent acceptance test"* (2026-08-23) forbids. A test that skips
itself when the spike is absent is not available either — that is this ticket's own subject.

### AC-10 — The real committed artifacts are the fixtures, and a missing one fails loudly

Two of this repository's frozen contracts are exercised through the **ported** code:

- `contracts/Q-0011/run-manifest.schema.json` validates manifest fixtures the tests construct, and
  its `x-quorum-contract` selects the semantic pass. Manifests are constructed rather than read,
  because `.quorum/` holds no tracked file (fact 15), and they are constructed against the real
  frozen schema rather than a simplified copy of it.
- `contracts/Q-0006/ticket-review-state.schema.json` validates the YAML frontmatter of
  `backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md`, read from the repository, and
  reports the semantic pass as skipped. It rejects a malformed copy with the full `oneOf` /
  `if/then` / nested-`required` error set and a bad `at` with the `format: date-time` error, both
  asserted as literals.

Every fixture read from the repository is read through `repoFile`, which throws when its subject is
missing — a test that cannot find its artifact fails rather than passing over nothing. No committed
contract, ticket, schema or doc is edited to make any of this pass.

### AC-11 — Three validations stay distinct, and the ported code is what runs *(register row 13)*

The implementation does not import, call, replace or change `checkAgainstSchema` or `extractJson` in
`spike/src/adapters/index.js`, and introduces no vendor-specific parsing or tolerance into the ajv
validator. `checkAgainstSchema` is Q-0046's and stays strict against Quorum's own generated schema;
vendor-wrapping tolerance stays confined to `extractJson`; this module stays fully strict against
solutioning's contracts.

Because `packages/cli` does not exist, nothing outside `packages/core` imports this module at
landing. The criterion is that it *could*: the module resolves and runs from a plain import of its
source path, with `ajv` resolved from the workspace rather than from `spike/node_modules` or from
ESLint's transitive `ajv@6`.

*Test:* a test resolving `ajv`'s `package.json` from `packages/core` and asserting its version
starts with `8`; a source-level assertion that no file under `contracts/` names `checkAgainstSchema`
or `extractJson`; and one end-to-end validation through the module's public surface with no relative
path escaping `packages/`.

### AC-12 — Stop and report

If transcription or the tests reveal a spike defect, an inconsistency, or a behaviour this document
does not cover, the implementer records the exact fixture, the actual output and the expected
authority in `dev/implement-report.md` and **stops**. It does not fix the behaviour, add a guard,
widen the annotation vocabulary, remove the `$id` collision, merge the two roll-up implementations,
or edit a contract, ticket or doc in passing. The route for a deliberate change is its own
`docs/DECISIONS.md` entry or a dated erratum in this ticket's folder, accepted **before** it is
implemented.

The report also: names all six defects in AC-8 and states for each that it is preserved; names
register rows 13 and 14 and where each is discharged; states which of the three import strategies in
OQ-4 was needed; carries AC-9's one-time byte comparison against the spike CLI; and names the
read-count difference decided in AC-7.

## Non-goals

- **Another child's module.** The run-history writer and reader, including the writer's own
  `rollup()`, are **Q-0049's**; the engine is Q-0050–Q-0053; adapters are Q-0046 and Q-0047.
- **Fixing anything found while reading** — charter §2. That covers all six items in AC-8, including
  the `$id` collision, which is the one most likely to be argued for.
- **Merging the two roll-up implementations**, now or by leaving a door open for Q-0049 to do it.
- **Editing `spike/**`** — charter §3. The four suites that import `contracts.js` stay where they
  are and keep running against the spike; Q-0054 translates them.
- **Editing any frozen contract, any `ticket.md`, or any numbered doc.**
  `contracts/Q-0011/run-manifest.schema.json`, `contracts/Q-0011/runs-cli.contract.md` and
  `contracts/Q-0006/ticket-review-state.schema.json` are read-only here, and no doc changes because
  the CLI's behaviour does not.
- **Re-exporting from `packages/core/src/index.ts`** — byte-pinned by
  `packages/shared/src/index.test.ts:47–53`.
- **A second recognised `x-quorum-contract` value**, a version-negotiation scheme, or a registry of
  semantic passes. One value is recognised; the third state in AC-7 is what an unknown one gets.
- **JSONL, event-stream or streaming input** — `runs-cli.contract.md:36` and Q-0011's E-2 both refuse
  it, and no persisted event stream exists in v1.
- **Replacing ajv with Q-0041's zod schemas, or adding anything to `packages/shared`.**
  `USAGE_MEASURES` is imported; nothing is added. JSON Schema is the language solutioning emits and
  zod cannot read it.
- **Writing, repairing, migrating or atomically replacing a run manifest**; changing `.quorum/`,
  `backlog/`, `harness/`, ticket, manifest or roll-up file formats.
- **The `quorum` binary, argument handling, colour, exit codes, the `validate` command's usage string
  and its `cannot read schema` die path** — Q-0010 and the cutover.
- **Budget enforcement, a lock on a ticket, `--base`, gate semantics, worktree pruning** — Q-0039,
  Q-0040, Q-0062 and the carried M1 items. Also the Q-0009 cutover, the daemon and Studio behaviour.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

**None blocks the implementer.** Each is recorded as decided with its evidence, so no revise round is
spent on it. The two that a candidate marked blocking and assigned to a solution architect are
answered here instead: this ticket runs the **chore** route, which has no architect, and an open
question deferred to a stage that does not exist is a round of the revise loop, not a decision.

| # | Question | Resolution | Owner |
| --- | --- | --- | --- |
| OQ-1 | What is the composed function called, and does it exist at all — or does the CLI keep composing the two passes itself? | **`validateArtifact`, and it exists.** Charter §7 puts "contract validation and the `run-manifest-v1` semantic pass" in `core`, and the *composition* — annotation selection, ordering, error replacement — is the part that carries register row 14. Leaving it in the CLI means M3's server re-deriving it. `validateContract` was considered and rejected: "contract" is the glossary term for the schema, not for the act of checking against one. AC-7 fixes the return type, which answers codex OQ-1. | decided |
| OQ-2 | Is the roll-up recomputation exported, and does it return a `Map` or a serialisable shape? | **Not exported, so the container is internal and unconstrained.** Exporting it invites Q-0049 to import it, which turns the check into a tautology (AC-6). It is exercised through `checkRunManifestSemantics`, which is how the CLI reaches it today. This answers codex OQ-2 by dissolving it. | decided |
| OQ-3 | Which committed run manifest is the canonical semantic-test input? | **There is none.** `git ls-files .quorum` returns nothing (fact 15). Tests construct manifests against the real frozen `run-manifest.schema.json`; the two *committed* artifacts exercised are that schema and Q-0006's ticket frontmatter (AC-10). | decided |
| OQ-4 | `ajv` has no `exports` map and its `dist/2020.d.ts` ends `export default Ajv2020` in a CJS package. Does `import Ajv2020 from 'ajv/dist/2020.js'` type-check under `module: nodenext` with `esModuleInterop` unset? | **Expected yes — `nodenext` implies `esModuleInterop` — but verify rather than assume.** Try in this order and report which was needed: (a) the spike's import verbatim; (b) the named import `import { Ajv2020 } from 'ajv/dist/2020.js'`, which the same `.d.ts` also declares; (c) only if neither compiles, add `esModuleInterop: true` to `tsconfig.base.json`. (c) changes every package's compilation and must be named in the implement report with the exact `tsc` error that forced it — a workspace default changed without being asked is a decision taken on someone else's behalf. `skipLibCheck: true` is already on, so ajv's declarations are not the risk; the import form is. | implementer |
| OQ-5 | One file or two? | **Two, in one folder:** `contracts.ts` (ajv, the three ported functions, the composition) and `run-manifest.ts` (the semantic pass, its roll-up, `TERMINAL_STATUSES`). The 2026-08-23 decision's own framing is that a *product-level* pass is selected by a *generic* validator; one file is how the next recognised annotation ends up appended to the ajv module. The exported surface is `contracts.ts`'s, so consumers see one import path. | decided |
| OQ-6 | Should the module-level Ajv instance become per-call, removing AC-8 defect 1 for free? | **No.** It changes `harness validate`'s output and exit code on a multi-file invocation, and charter §2 forbids fixing a defect found while reading. It would also discard the compiled-schema cache, which is why the instance is shared. The fix is a follow-up ticket; this one reports it. | decided |
| OQ-7 | Where does `TERMINAL_STATUSES` live — `shared/constants.ts`, or with the pass? | **With the pass, unexported.** Fact 10: both readers are inside `checkRunManifestSemantics`. A constant with one consumer does not belong in the package everything imports, and Q-0043's `projectConfigSchema` — shipped declared and called nowhere — is the precedent to avoid. If Q-0049 needs it, promoting it then is a two-line change with a caller to justify it. | decided |

## Risks

- **The roll-up independence is the whole ticket and it has no natural defender.** Nothing fails if
  the two implementations converge — not a test, not `tsc`, not CI — until a writer bug ships
  undetected. AC-6's source-level assertion is the only guard, and **a reviewer should read that test
  before reading the implementation.** Q-0049 inherits the same obligation from the other side and
  its requirement should say so.
- **"Skipped is not passed" is easy to satisfy in the letter and lose in the spirit.** A
  `validateArtifact` returning two states instead of three, or a caller reading `ok` as "the semantic
  checks were fine", reproduces the $13.86 failure at a different altitude. AC-7's three states and
  the `ran: true` rule are what make it checkable.
- **The `$id` collision looks exactly like a bug to fix.** It is one, and it is not this ticket's. An
  implementer who removes it makes every test in AC-8 red and every other test green, which is the
  shape charter §2 exists to catch.
- **Null-to-zero corruption.** Generic summing utilities initialise totals to zero, which would erase
  the product distinction between unpriced usage and a reported zero — the single defect the pass was
  written to catch. AC-6 requires both directions as dedicated cases.
- **Dependency duplication reads as cleanup.** ajv and zod serve different contract languages;
  a later tidy-up that removes one after seeing overlapping validation code would be wrong. AC-11 and
  the 2026-08-22 dependency justification preserve the boundary.
- **The lockfile.** This is the port's first child to add a runtime dependency to `packages/core`.
  `commands.install` runs `pnpm install --frozen-lockfile`, so a `package.json` edit without a
  regenerated `pnpm-lock.yaml` fails `integrate` **after** the implementer has been billed. Q-0041
  got this right (`86a4b90` touched the lockfile); note that `pnpm-lock.yaml` is not in
  `developer-generalist`'s `paths` frontmatter, which is advice rather than enforcement — the file
  must still be written.
- **CI and `integrate` do not install the same things** (fact 18). Any test in `packages/core` that
  reaches outside the pnpm workspace passes at `integrate` and fails on the next push. AC-9 is
  written to stay inside the workspace for exactly this reason.
- **`integrate` can report a cached pass** (Q-0065). `pnpm turbo run test` without `--force` replays
  a green it did not execute, and this ticket changes a dependency graph, which is when a stale cache
  is most plausible. Verify the merge with `--force` before trusting `tests=ok`.
- **A gate that cannot be answered destroys a proven-green merge** (Q-0040, open). Run this where a
  human can answer the final gate; if the run dies there, re-perform `integrate` by hand before
  trusting the branch.
- **The Q-0006 frontmatter fixture is a committed backlog file.** It is stable — Q-0006 is closed and
  contained — but a future run against that ticket would change it. A copied fixture would break the
  2026-08-22 entry's *"verified on the real artifacts, not a fixture"*, which is the claim that made
  the validator worth adding. Accepted, and named here so a later failure reads as a signal rather
  than as flakiness.
- **Scope drift into Q-0049.** Reading the semantic pass means reading the manifest schema, which
  means reading the writer. The reviewer should treat any change outside
  `packages/core/src/contracts/`, its tests, `packages/core/package.json` and `pnpm-lock.yaml` as
  unrequested.
- **`harness/Q-0045/integration` already exists and is contained** (fact 13) — charter §8's most
  expensive pre-run item is satisfied. Confirm it is still contained immediately before the run
  rather than assuming it from this document.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable, no network. `ajv` and `ajv-formats` are offline and already vendored in `spike/`. No code path, test, fixture or example accepts a key. |
| **Worktree safety** | n/a directly — the module reads two files and returns a value; it creates no branch, worktree or ref and writes nothing. Tests write only to `tempDir()` and read this repository read-only. |
| **Gate behaviour** | n/a — nothing here presents or answers a gate. The manifest *statuses* it reasons about include `exhausted` and `interrupted`, but only as strings in a persisted document. The chore route's human gate is unchanged. |
| **Files are the database** | Preserved. `readData` reads caller-selected files; no persistence and no hidden state are added. |
| **File format and its schema** | The run manifest is the subject and its schema is frozen. No format changes; `run-manifest-v1` stays selected only by its annotation. `USAGE_MEASURES` comes from `shared`; no zod schema is added. |
| **Lint rules** | n/a — no flow lint rule is added, removed or read. `lintFlow` (Q-0044) and this module never meet. TypeScript, ESLint and package-boundary rules apply to the new folder. |
| **Cross-vendor rule** | n/a — no reviewing or judging step is created or changed. Roll-up grouping uses neutral vendor labels and adds no vendor-specific logic (register row 22's operative reading). |
| **Containment** | n/a — this module runs no git. |
| **Cold-clone impact** | Two new runtime dependencies in `packages/core`, both already in the spike's tree, both install-time only. No new command, prompt or step. Neutral. |
| **Errors are explicit** | Mostly, and the exceptions are AC-8's. `validate` never swallows a violation; a non-compiling schema throws loudly by design; the semantic pass names the vendor and field it disagrees about; a skipped semantic pass is reported as skipped, never as passed or silently defaulted. Against that, three of the six preserved defects are silences, all named in the report rather than fixed. |
| **Product-agnostic** | No SaaS product is named or implied in the module, its tests or its fixtures. |

## Provenance

**The claude candidate is the spine, and it earned that by running the code rather than reading it.**
Its fourteen semantic messages, their push order, the `step_id`-not-index detail, the
structural-suppresses-semantic ordering, the skip-line-before-verdict-line ordering, the
`readData` extension rules and the `$id` collision all transcribe exactly against
`spike/bin/harness.js:266–355` and `:488–516`. Its self-correction is worth naming, because it is
this ticket's own subject matter: the pass has fourteen distinct messages, not the twelve a first
reading of the source suggests. AC-1 through AC-8, AC-10 and AC-12 are substantially its work, as
are OQ-4 through OQ-7 and most of the risks.

**The codex candidate contributed the cleaner statement of the generic validator** — its AC-1
through AC-5 read better than claude's on what `validate`, `readData` and `validateFile` owe a
caller, and its AC-3 phrasing that "callers are not required to inspect AJV error objects" became
the type constraint in AC-1. Its AC-11 (separation from `checkAgainstSchema` and `extractJson`) is
the clearest statement of register row 13 either candidate produced and is now AC-11 here; claude
had it as a non-goal, which is weaker, because a non-goal is not tested. Its "reported zero remains
zero" phrasing is in AC-6, and its null-to-zero and dependency-duplication risks are carried
verbatim in substance.

**Four things were rejected, each against the repository rather than against the other candidate.**

1. **Codex AC-13 — "exports the public contract operations through the package's established source
   entry point."** Refused. `packages/shared/src/index.test.ts:47–53` asserts
   `packages/core/src/index.ts` equals `export const name = '@quorum/core';\n` byte for byte, and
   `packages/core/src/lint/lint.source.test.ts:45` records that the landed modules deliberately add
   no public re-export. Following codex here turns a landed, reviewed test in another package red.
   Claude caught this and cited the line.
2. **Codex AC-6 — "Core exports `computeManifestRollup(steps)`."** Refused. Exporting it is what
   lets Q-0049 import it, and Q-0049 *depends on this ticket*, so the invitation is live. The check's
   entire value is that it is a second implementation; comparing a manifest against a recomputation
   by the code that wrote it detects a hand-edited file and nothing else. Not exporting is the only
   form of this rule that is enforcement rather than advice.
3. **Codex OQ-1 and OQ-2, marked "Blocker: yes. Owner: solution architect."** There is no solution
   architect on the chore route — `requirements → chore → human gate`, per the 2026-08-25 routing
   decision. A blocking question assigned to a stage this ticket does not run is a revise round, not
   a decision, and the revise loop cannot close it: this is the shape recorded in *"A requirement may
   not name a surface its flow cannot write"* (2026-08-25), one level up. Both are answered above
   with evidence — OQ-1 by AC-7's return type, OQ-2 by dissolving the container question. Codex OQ-3
   is answered by `git ls-files .quorum`, which returns nothing: no committed manifest exists.
4. **Claude AC-9 — spawn `spike/bin/harness.js validate` from a Vitest test and compare bytes.**
   Refused, and this is the finding neither candidate's reviewer would have got cheaply. CI's
   `workspace` job runs `pnpm install --frozen-lockfile` and nothing else, while chore's `integrate`
   runs `commands.install`, which begins `npm install --prefix spike`. `spike/node_modules` is
   gitignored. So that test finds its `ajv` at `integrate` and reports green, and fails on the next
   push to GitHub — the "integrate green, CI red" split, on a ticket whose subject is checks that
   report success without examining their subject. Independently, the Q-0009 cutover deletes
   `spike/`, so the test asserts a fact this repository's next landing changes, which claude's own
   criteria preamble forbids by citing the 2026-08-23 permanent-acceptance decision. AC-9 now
   transcribes the four line shapes as literals and moves the byte comparison to a one-time
   verification in the implement report.

**Two smaller corrections to the claude candidate.** Its eighth preserved defect — that a `.yml` and
a `.yaml` schema of the same stem are "indistinguishable in the returned `schema` basename only by
extension" — is not a defect: a basename includes its extension, so they are distinguishable, and the
sentence appears to concede as much. Dropped, leaving six. And its defect 5 (the data file read
twice) sat in tension with its own OQ-7, which decides the *schema* is read once: the two reads are
the same kind of internal, and leaving one "preserved" and the other not invites an implementation
that accidentally does neither consistently. AC-7 now decides both explicitly — read once, reuse,
name it in the report as the single internal difference — which is what charter §2 means by not
preserving internals.

**Size.** Twelve criteria, against the ten-to-fifteen band. Neither candidate was oversized: claude
shipped twelve and codex fourteen, and codex's fourteen collapse cleanly because its AC-1 through
AC-5 describe one ported module and its AC-6 through AC-9 one semantic pass. No split is needed and
none is proposed.
