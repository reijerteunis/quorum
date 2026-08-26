# Q-0045 — `core/contracts`: ajv validation and the run-manifest semantic pass

*Product-manager candidate (claude), 2026-08-26. Route: **chore** (`requirements → chore → human
gate`). Parent: Q-0009. Depends on Q-0041 (landed). Charter: `harness/port-charter.md`; §6's
register row for Q-0045 is normative, and the inherited invariants are rows 13 and 14. Surfaces:
`packages/core` — one new module folder, its tests, and two lines of `package.json` plus the
lockfile. Nothing under `spike/`, nothing in `packages/shared`, no flow file, no contract file, no
CLI: `packages/cli` does not exist until Q-0010.*

> **Note on this document's authority.** Every message, ordering claim, exit code and preserved
> defect below was obtained by **running** `spike/src/contracts.js` and `spike/bin/harness.js
> validate` against the repository's own committed contracts, not by reading the source. Where a
> transcription would have been plausible and wrong, the run is quoted. See *Evidence* at the end.

## Problem

`spike/src/contracts.js` is 41 lines and it is the reason this project's contracts are contracts
rather than documentation. Before it existed, solutioning emitted seven artifacts for Q-0006 of
which only one could be executed, which made the red phase a hope — *"Contracts are executable:
ajv in the toolchain"* (`docs/DECISIONS.md`, 2026-08-22) exists to close exactly that.

Beside it, and **not** beside the validator it extends, sits the product-level semantic pass:
`checkRunManifestSemantics` and `computeManifestRollup` at `spike/bin/harness.js:270–360`, plus the
`TERMINAL_STATUSES` list at `:131` that only they read. It is 90 lines of versioned product
contract implemented inside a CLI command — a contract M3's server cannot reach and a contributor
cannot find. Charter §7 names "contract validation and the `run-manifest-v1` semantic pass" among
the things exported from `core` rather than implemented in the CLI.

**The exposure is not that a check disappears.** A lost check is loud: a fixture stops failing.
The exposure is that the port keeps all fourteen semantic messages and destroys what they are
*worth*, in three ways nothing in this repository can currently detect.

**The roll-up recomputation is only a check because it is a second implementation.** Two functions
compute a per-vendor roll-up from occurrence usage today, deliberately: `rollup()` at
`spike/src/engine.js:463` writes it, and `computeManifestRollup()` at `spike/bin/harness.js:275`
recomputes it to see whether the writer told the truth. They are written differently — an
accumulator that folds each usage into a row, against a group-then-sum — and their agreement is the
evidence. Q-0049 ports the writer and **depends on this ticket**. The obvious move at that point,
or a reviewer's suggestion here, is that one of them should import the other. It would compile, it
would keep every message, every existing test would stay green, and the check would become a
tautology: a manifest is compared against a recomputation by the code that wrote it, which can
detect a hand-edited file and nothing else. That is the exact failure *"a check that skips its
subject must not report success"* (2026-08-25) names, arriving through a refactor.

**"Skipped is not passed" is this module's whole reason for having an annotation.** A schema with
no recognised `x-quorum-contract` still gets full structural validation and can still earn `✓`;
what it must never earn is silence about the checks that did not run. The spike prints an explicit
skip line **before** the verdict line, and register row 14 requires it. A port that returns
`{ok, errors}` and nothing else loses the distinction entirely, and nothing downstream can tell
"validated against `run-manifest-v1`" from "structurally fine, nobody looked". `harness run chore
Q-0035 --dry` printed a clean preview for a range it had not examined and the real run then billed
$13.86; this is the same shape one layer down.

**The ordering between structural and semantic validation is load-bearing and invisible.** The
semantic pass runs **only when structural validation passed**, and when it finds problems its
errors **replace** the structural result rather than joining it. Verified: a manifest that is both
structurally invalid (an extra property) and semantically invalid (a duplicate `occurrence_dir`)
reports only the structural error. That ordering is what lets `checkRunManifestSemantics` assume a
well-formed document — it reads `data.steps`, `s.usage.vendor` and `data.rollup` without guards. A
port that runs both passes and concatenates produces more errors from the same input, which is a
behaviour change, and one that reads like an improvement.

Underneath all three is the structural problem the port has everywhere: **the suites that would
catch a slip run against the spike.** `spike/test/q0011-runs-cli.js`, `q0034-review-fixes.js`,
`q0011-run-history.js` and `smoke.js` all import from `spike/src/` or drive `bin/harness.js`; they
are frozen under charter §3 and Q-0054 translates them last. Between this ticket and that one, the
only thing asserting that `core` validates what the spike validates is this ticket's own tests.

## User stories

- **As the maintainer**, when I point `quorum validate` at a run manifest I need to know whether
  the semantic pass ran. A green tick that might mean "checked against `run-manifest-v1`" and might
  mean "nobody looked" is worse than no tick, because I will act on it.
- **As the maintainer**, I need the roll-up in a manifest to be checked by something that is not
  the code that wrote it. Per-vendor figures are what I read to decide whether a ticket was cut
  wrong; a self-confirming check tells me nothing.
- **As a QA author writing a `type: script` step**, I need `validate` to exit non-zero on a
  violation and to name the instance path, so a contract failure is a red test rather than prose in
  a review.
- **As the cold-clone adopter**, I need a contract violation to print the path and the rule that
  failed, not an ajv stack trace, and I need an unreadable schema to fail before it validates
  anything.
- **As the contributor writing `packages/cli` (Q-0010) or M3's server**, I need contract validation
  to be a function in `core` returning a structured result — including whether semantic checks ran
  and why not — so the CLI's job is choosing a marker and a colour and nothing else.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/contracts.js` — the module-level `ajv` `:17`, `validate` `:21`, `readData` `:32`, `validateFile` `:37` |
| The lift | `spike/bin/harness.js` — `TERMINAL_STATUSES` `:131`, `computeManifestRollup` `:275`, `checkRunManifestSemantics` `:298`; the `validate` command that composes them `:488–516` |
| Its only in-repo consumers | `spike/bin/harness.js:20` (`validateFile`, `readData`); `spike/test/q0011-run-history.js:13`, `spike/test/smoke.js:568` (`validate`); `spike/test/q0034-review-fixes.js:14` (`validateFile`). All four are Q-0054's to translate |
| The frozen authority for the semantic checks | `contracts/Q-0011/runs-cli.contract.md:35–52` — "Executable manifest validation", which specifies the annotation, the four check families and the null-to-zero case in as many words |
| The erratum that created the pass | `backlog/Q-0011-run-history-on-disk/solution/errata.md` E-2, 2026-08-23 |
| The schema the pass extends | `contracts/Q-0011/run-manifest.schema.json` — `$id` `:3`, `x-quorum-contract` `:4`, the `status` enum `:24`, `$defs.usage` and `$defs.vendor_rollup`. **Frozen** |
| The other real fixture | `contracts/Q-0006/ticket-review-state.schema.json` — `oneOf`, `if/then`, `format: date-time`, nested `required`, and a non-URI `$id` (`Q-0006/ticket-review-state`). **Frozen** |
| The independent twin that must stay independent | `spike/src/engine.js:463` — the writer's `rollup()`. Q-0049's, not this ticket's |
| Already in `shared`, not to be spelled twice | `USAGE_MEASURES` (`constants.ts`) — the five measures in the order the roll-up compares them |
| Test helpers already shipped | `packages/core/test/corpus.ts` — `repoRoot`, `repoFile`, `coreSourceFiles` (recursive since Q-0064, keyed by path below `src`, e.g. `contracts/contracts.ts`); `packages/core/test/repo.ts` — `tempDir`, `write`, `walk`, `removeTempDirs` |
| The folder rule | *"`core` is organised in folders named after the port's children"* (2026-08-26). This module's folder is `contracts/`; `src/git/`, `src/backlog/` and `src/lint/` are the pattern |
| Where types must not go | Charter §4: the dependency direction is `core → shared`, never the reverse |

## Fourteen facts established by running the code

Each was produced this session against the committed repository at `9ef83e8`. The criteria depend
on all fourteen.

1. **`validate`'s error string is** `` `${e.instancePath || '/'}: ${e.message}` `` with
   `` ` ("${e.params.additionalProperty}")` `` appended when that param is present. A missing
   required key and an extra key together yield exactly
   `["/: must have required property 'a'", "/: must NOT have additional properties (\"b\")"]`.
2. **The ajv instance is module-level and caches by schema object.** Validating the *same* object
   twice is free. Validating a *different* object carrying the same `$id` **throws**
   `schema with key or id "…" already exists`.
3. **That defect is reachable from the shipped CLI.** `harness validate
   contracts/Q-0011/run-manifest.schema.json a.json b.json`, with two byte-identical valid
   manifests, prints `✓` for the first and
   `✗ …/b.json: schema with key or id "https://quorum.local/contracts/run-manifest-v1.schema.json" already exists`
   for the second, exit 1 — because `validateFile` re-reads the schema per data file.
4. **A schema that does not compile throws**, loudly and by design: `{type: 'nonsense'}` gives
   `schema is invalid: data/type must be equal to one of the allowed values, …`.
5. **`strict: false` is what lets `x-quorum-contract` sit in a schema at all**, and
   `{"x-quorum-contract": "run-manifest-v1", "type": "object"}` validates `{}` clean.
6. **`readData` selects YAML on `/\.ya?ml$/i`** — `.yaml`, `.yml` and `.YAML` all parse as YAML;
   every other extension goes to `JSON.parse`, so a `.txt` holding YAML throws a JSON parse error.
7. **The skip line prints before the verdict line**, and both print. A generic schema over an
   invalid file emits `· <f>: run-manifest semantic checks skipped (schema has no recognised
   x-quorum-contract annotation)` and then `✗ <f> violates <schema>:` with the errors.
8. **A structurally invalid manifest never reaches the semantic pass.** One carrying both an extra
   top-level property and a duplicate `occurrence_dir` reports only the structural error.
9. **All fourteen semantic messages reproduce verbatim** — transcribed in AC-6 from live output.
10. **`TERMINAL_STATUSES` has exactly two readers**, `:313` and `:333`, both inside
    `checkRunManifestSemantics`. Nothing else in `spike/` declares or reads that list, so it moves
    with the pass and no ownership question arises with Q-0049.
11. **A mixed roll-up passes**: two `claude` occurrences, one priced $1 and one unpriced, against a
    row of `step_count: 2, unpriced_steps: 1, cost_usd: 1` validates clean. A vendor whose every
    occurrence is unpriced recomputes to `cost_usd: null`, and a row saying `0` is refused by name.
12. **`contracts/Q-0006/ticket-review-state.schema.json` still validates the committed Q-0006
    ticket's frontmatter today**, exit 0, with the skip notice. A malformed `at` gives one error
    (`/history/0/at: must match format "date-time"`); a legacy entry missing `stage` gives **eight**
    across `oneOf`, `if/then` and nested `required`. The 2026-08-22 entry's "verified on the real
    artifacts, not a fixture" is still true and this ticket keeps it true.
13. **`harness/Q-0045/integration` exists and is `main:contained`, zero commits ahead.** Charter
    §8's first pre-run item is already satisfied — the failure that cost Q-0035 $13.86 is not
    waiting on this run.
14. **No shipped flow calls `harness validate`.** Neither `harness/flows/` nor
    `spike/templates/harness/flows/` contains the command, so nothing in the twelve flow files
    depends on this module at run time and no flow needs editing.

## Acceptance criteria

Each is independently testable against throwaway directories the test builds, or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next
landing changes — the permanent-acceptance-test decision (2026-08-23).

### AC-1 — The module exists, exports exactly five names, and the two dependencies land with their lockfile

`packages/core/src/contracts/` holds `contracts.ts` and `run-manifest.ts`. `contracts.ts` exports
`validate`, `readData`, `validateFile`, `validateArtifact` and `checkRunManifestSemantics` — five
names, no more — importing the last from `./run-manifest.js`. TypeScript strict, no `any`, no
`@ts-ignore`, no import from `spike/**`. `packages/core/package.json` gains `ajv` at `^8.20.0` and
`ajv-formats` at `^3.0.1`, the versions `spike/package.json` already carries, and
`pnpm-lock.yaml` is updated in the same change.

`packages/core/src/index.ts` is untouched: `packages/shared/src/index.test.ts:52–53` pins it byte
for byte, and every consumer this ticket has is in-package.

*Test:* `Object.keys` over the module namespace equals the five names, every value a function. A
source-level test over `coreSourceFiles()` asserts that every file under `contracts/` imports only
`node:fs`, `node:path`, `yaml`, `ajv/dist/2020.js`, `ajv-formats`, `@quorum/shared` and its own
siblings, and that no import or `require` line names `spike`. `repoFile('packages/core/src/index.ts')`
still equals `export const name = '@quorum/core';\n`. `packages/core/package.json` declares both
dependencies; `pnpm-lock.yaml` contains an `ajv@8` entry. Workspace `pnpm lint`, `pnpm typecheck`
and `pnpm test` are green, and `pnpm install --frozen-lockfile` succeeds from a clean checkout.

*Note:* the lockfile already carries `ajv@6.15.0` as a transitive dependency of ESLint. That is not
this module's ajv and must not be reused; the workspace will hold both majors, which pnpm handles.

### AC-2 — `validate(schema, data)` is the same validator, configured the same way, reporting the same strings

One module-level Ajv 2020 instance, constructed `addFormats(new Ajv2020({allErrors: true, strict: false}))`
— created once at module scope, not per call. It returns `{ok: true, errors: []}` or
`{ok: false, errors: string[]}`, never throws on invalid *data*, and throws on a schema that does
not compile. Each error is
`` `${instancePath || '/'}: ${message}` `` plus `` ` ("${params.additionalProperty}")` `` when that
param exists, in ajv's own error order.

*Test:* the two-error case of fact 1 asserted as a literal array; a `format: date-time` violation
(proving `ajv-formats` is registered and not merely installed); an unknown keyword accepted
(proving `strict: false`); two independent violations in one document returned together (proving
`allErrors: true`); a non-compiling schema asserted to throw; a source-level assertion that the
file constructs Ajv exactly once.

### AC-3 — `readData` reads JSON and YAML by extension, case-insensitively, and nothing else

`.yaml`, `.yml`, `.YAML` and `.YML` go to `YAML.parse`; every other path goes to `JSON.parse`. Both
propagate their parser's error unchanged. No content sniffing, no extension is added, no JSONL
support — `contracts/Q-0011/runs-cli.contract.md:36` says so in as many words.

*Test:* one file per extension, plus a `.txt` holding valid YAML asserted to throw a JSON parse
error, plus a missing file asserted to throw `ENOENT` with the path in the message.

### AC-4 — `validateFile` keeps its signature, its return shape and its per-call schema read

`validateFile(schemaFile, dataFile)` reads the schema, reads the data, validates, and returns
`{...validate(...), schema: basename(schemaFile), data: basename(dataFile)}` — basenames, not
paths. **It reads the schema on every call**, which is what makes AC-5's first defect reachable and
is therefore not an implementation detail to optimise away.

*Test:* a valid pair returns `{ok: true, errors: [], schema: 'x.schema.json', data: 'y.json'}` with
basenames asserted against full paths in a nested temporary directory; an invalid pair carries the
same two keys alongside the errors; an unreadable schema and an unreadable data file each throw.

### AC-5 — Eight preserved defects, carried unfixed and reported *(charter §2)*

Each was found by reading or running the spike this session. None is repaired; each is pinned by a
test so a later "cleanup" turns this suite red rather than passing silently, and each is named in
`dev/implement-report.md` with the statement that it is preserved.

1. **Two data files against a schema carrying an `$id` fail on the second** with ajv's
   `schema with key or id "…" already exists` (fact 3). The module-level instance caches by
   `$id`, and each call hands it a fresh copy. Neither a fresh Ajv per call, nor `removeSchema`,
   nor hoisting the schema read out of the loop may be introduced here.
2. `validate` mutates shared state: every compiled schema stays in the module-level instance for
   the life of the process, so a long-lived server accumulates them. M3's problem, not this one.
3. A non-compiling schema throws a raw ajv `Error`, not a typed one, and the CLI renders it on the
   same line shape as a missing file — the reader cannot tell an authoring bug from a typo in a
   path.
4. `checkRunManifestSemantics` assumes structural validity and has no guards; called directly on a
   malformed document it can produce `rollup: missing row for vendor "undefined"` or throw. Safe
   only because AC-8 orders the two passes. The port does not add guards.
5. `readData` runs a second time on the data file for the semantic pass, so a file that changes
   between the two reads is validated as one document and checked as another.
6. Ajv accepts `contracts/Q-0006/ticket-review-state.schema.json`'s non-URI `$id`
   (`Q-0006/ticket-review-state`) without complaint under `strict: false`.
7. `computeManifestRollup` groups on `s.usage.vendor` with no check that it is a string, so a
   missing vendor becomes the key `undefined` and is reported as a missing row for a vendor of that
   name.
8. A `.yml` schema and a `.yaml` schema of the same name are indistinguishable in the returned
   `schema` basename only by extension, which is the whole disambiguation — noted because AC-4
   returns basenames rather than paths and a diagnostic naming two files identically is possible.

*Test:* defect 1 asserted directly against `contracts/Q-0011/run-manifest.schema.json` — two calls
to `validateFile` with two valid data files, the second asserted to throw with the `$id` in the
message. Defects 3, 4, 6 and 7 asserted by their observable outcome. Defects 2, 5 and 8 recorded in
the report and covered by comment rather than by test, because asserting them would require
observing process state or racing the filesystem.

### AC-6 — `checkRunManifestSemantics` reports the same fourteen problems, with the same text, in the same order

`checkRunManifestSemantics(data): string[]` — an array, empty when clean, never throwing on
well-formed input. Verbatim, with `${…}` marking interpolation:

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
persisted order. A step index is its **`step_id`**, not its array position. `TERMINAL_STATUSES` is
`['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted']`, declared once inside
this module (fact 10) and not exported.

*Test:* one fixture per message asserting the exact string, built from the real
`contracts/Q-0011/run-manifest.schema.json` shape; a fixture carrying several problems asserting the
**entire** array as a literal, in order; the `script` case asserting two messages from one step; a
clean manifest asserting `[]`.

### AC-7 — The roll-up is recomputed by this module's own implementation, which is not exported and imports nothing from `run-history`

The comparison covers `step_count`, `unpriced_steps` and then the five `USAGE_MEASURES` from
`@quorum/shared` in that order — the tail is taken from the shared constant, not written out again.
`step_count` counts occurrences carrying `usage`; `unpriced_steps` counts those whose `cost_usd` is
null or absent; each measure sums the non-null values and is **`null` when every value was null**.
Comparison is strict (`!==`), so a persisted `0` against a recomputed `null` is reported by vendor
and field, which is the whole reason the pass exists (E-2, 2026-08-23).

**`computeManifestRollup` is not exported.** Q-0049 ports the writer's `rollup()`
(`spike/src/engine.js:463`) as its own implementation and must not import this one, nor this one
import that. Two independent implementations agreeing is the evidence; one implementation compared
against itself is a tautology that can only detect a hand-edited file.

*Test:* the five-name surface of AC-1 already excludes it. A source-level test asserts that no file
under `packages/core/src/contracts/` imports from `../run-history/` or names `rollup(`.
Behaviourally: an unpriced vendor whose row says `cost_usd: 0` fails with message 13 naming the
vendor and the field (the frozen contract's own AC-14 case); a genuinely reported `cost_usd: 0`
passes; a mixed priced/unpriced vendor validates clean against `step_count: 2, unpriced_steps: 1`
(fact 11); a vendor with usage and no row gives 12; a row with no usage gives 14; a token total
inflated by re-adding a cache component fails on `input_tokens`, which is `spike/test/q0034-review-fixes.js`
scenario B2's subject.

### AC-8 — `validateArtifact` composes the two passes, and a skipped semantic pass says so *(register row 14)*

`validateArtifact(schemaFile, dataFile)` performs, in this order:

1. `validateFile(schemaFile, dataFile)` — structural. Throws where `validateFile` throws.
2. Reads the schema's `x-quorum-contract`. The single recognised value is `run-manifest-v1`; a
   missing, empty or unrecognised value selects no pass.
3. Runs `checkRunManifestSemantics` **only when** the contract is recognised **and** step 1
   returned `ok`. Its errors **replace** the structural result's errors; they are never
   concatenated, because step 1 returned none.

It returns `{ok, errors, schema, data, semantic}`, where `semantic` is exactly one of:

| `semantic` | When |
| --- | --- |
| `{contract: 'run-manifest-v1', ran: true}` | recognised and structural validation passed |
| `{contract: 'run-manifest-v1', ran: false, reason: 'structurally-invalid'}` | recognised, structural validation failed |
| `{contract: null, ran: false, reason: 'unrecognised-annotation'}` | missing, empty or unknown annotation |

Three states, not two. **`ran: true` is the only value that may be read as "the semantic checks
were performed"**, and no caller may infer it from `ok`.

*Test:* a `run-manifest-v1` schema over a clean manifest gives `ok: true, ran: true`; over a
semantically broken one, `ok: false, ran: true` with only the semantic messages; over a
structurally broken one, `ok: false, ran: false, reason: 'structurally-invalid'` with only the
structural errors and **no** semantic message (fact 8), asserted with a fixture that is broken both
ways so the suppression is what is proved; a generic schema and an `x-quorum-contract:
unknown-v1` schema each give `contract: null, ran: false` while still returning the structural
verdict — clean data `ok: true`, invalid data `ok: false` (fact 7).

### AC-9 — Nothing in `core` prints, and the CLI's bytes are reproducible from what `validateArtifact` returns

No ANSI escape, no marker glyph, no indentation and no user-facing sentence appears anywhere in
`packages/core/src/contracts/`. Charter §7 assigns event rendering to the CLI's residual scope,
M4's flow editor shows validation errors in a browser where an escape byte is a bug, and M3's
server would otherwise ship terminal control codes over a WebSocket. The *shape* changes, which §2
explicitly does not preserve; the *printed bytes* do not, and this criterion is what proves it.

*Test:* in one test, apply a renderer of the four line shapes —

- `\x1b[2m·\x1b[0m ${f}: run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)`, emitted when and only when `semantic.reason === 'unrecognised-annotation'`, **before** the verdict line
- `\x1b[32m✓\x1b[0m ${f} matches ${result.schema}`
- `\x1b[31m✗\x1b[0m ${f} violates ${result.schema}:\n    ${result.errors.join('\n    ')}`
- `\x1b[31m✗\x1b[0m ${f}: ${error.message}` for a throw

— and assert the result equals, byte for byte including the escape sequences, what
`spike/bin/harness.js validate` prints for the same inputs, captured by spawning the spike CLI in
the test. Four cases: clean run-manifest, broken run-manifest, generic schema over invalid data
(two lines, skip first), missing data file. Exit-code mapping — non-zero when any file was bad — is
asserted as a property of the returned `ok` values, not implemented in `core`.

### AC-10 — The real committed artifacts are the fixtures, and a missing one fails loudly

Two of this repository's frozen contracts are exercised through the **ported** code:

- `contracts/Q-0011/run-manifest.schema.json` validates a manifest fixture the test constructs,
  and its `x-quorum-contract` selects the semantic pass.
- `contracts/Q-0006/ticket-review-state.schema.json` validates the YAML frontmatter of
  `backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md`, read from the repository,
  and reports the semantic pass as skipped (fact 12). It rejects a malformed copy with the eight
  `oneOf` / `if/then` / nested-`required` errors and a bad `at` with the one `format: date-time`
  error, asserted as literals.

Every fixture read from the repository is read through `repoFile`, which throws when its subject is
missing — a test that cannot find its artifact fails rather than passing over nothing. No committed
contract, ticket or schema is edited to make any of this pass.

*Test:* as described. The frontmatter is extracted in the test from the committed `ticket.md`; if
the block is absent the test fails naming the file.

### AC-11 — The module is reachable from a second workspace package, and the ported code is what runs

Because `packages/cli` does not exist, nothing outside `packages/core` imports this module at
landing. The criterion is that it *could*: the module resolves and runs under Node from a plain
`import` of `@quorum/core`'s source path, with `ajv` resolved from the workspace rather than from
`spike/node_modules`.

*Test:* a test that resolves `ajv`'s `package.json` from `packages/core` and asserts its version
starts with `8`, so the module is not accidentally running on the ESLint transitive `ajv@6` or on
the spike's copy; and one that validates a document end to end through the module's public surface
with no relative path escaping `packages/`.

### AC-12 — Stop and report

If transcription or the tests reveal a spike defect, an inconsistency, or a behaviour this document
does not cover, the implementer records the exact fixture, the actual output and the expected
authority in `dev/implement-report.md` and **stops**. It does not fix the behaviour, add a guard,
widen the annotation vocabulary, remove the `$id` collision, tidy the two roll-up implementations
into one, or edit a contract, a ticket or a doc in passing. The route for a deliberate change is its
own `docs/DECISIONS.md` entry or a dated erratum in this ticket's folder, accepted before it is
implemented.

The report also names all eight defects in AC-5 and states for each that it is preserved, and
states which of the three import strategies in OQ-4 was needed.

## Non-goals

- **Another child's module.** The run-history writer and reader, including the writer's own
  `rollup()`, are **Q-0049's**; the engine is Q-0050–Q-0053; adapters are Q-0046 and Q-0047. In
  particular `checkAgainstSchema` in `spike/src/adapters/index.js` is Q-0046's and stays a
  different validator — register row 13 keeps the three validations distinct, and nothing here may
  make the adapter layer use ajv.
- **Fixing anything found while reading** — charter §2. That covers all eight items in AC-5,
  including the `$id` collision, which is the one most likely to be argued for.
- **Merging the two roll-up implementations**, now or by leaving a door open for Q-0049 to do it.
- **Editing `spike/**`** — charter §3. The four suites that import `contracts.js` stay where they
  are and keep running against the spike; Q-0054 translates them.
- **Editing any frozen contract**, any `ticket.md`, or `docs/`. `contracts/Q-0011/run-manifest.schema.json`,
  `contracts/Q-0011/runs-cli.contract.md` and `contracts/Q-0006/ticket-review-state.schema.json` are
  read-only here, and no numbered doc changes because the CLI's behaviour does not.
- **A second recognised `x-quorum-contract` value**, a version-negotiation scheme, or a registry of
  semantic passes. One value is recognised; the third state in AC-8 is what an unknown one gets.
- **JSONL, event-stream or streaming input** — `contracts/Q-0011/runs-cli.contract.md:36` and
  Q-0011's E-2 both refuse it, and no persisted event stream exists in v1.
- **Adding a rule to `packages/shared`, or a zod schema for the manifest.** `USAGE_MEASURES` is
  imported; nothing is added. JSON Schema is the language solutioning emits and zod cannot read it.
- **Re-exporting from `packages/core/src/index.ts`** — pinned byte for byte by
  `packages/shared/src/index.test.ts:52–53`.
- **The `quorum` binary, argument handling, colour, exit codes, the `validate` command's usage
  string and its `cannot read schema` die path** — Q-0010 and the cutover.
- **Budget enforcement, a lock on a ticket, `--base`, gate semantics, worktree pruning** — Q-0039,
  Q-0040, Q-0062 and the carried M1 items. Also the Q-0009 cutover, the daemon and Studio behaviour.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

None blocks the implementer. Each is recorded as decided with its evidence, so no revise round is
spent on it.

| # | Question | Resolution | Owner |
| --- | --- | --- | --- |
| OQ-1 | What is the composed function called, and does it exist at all — or does the CLI keep composing `validateFile` + `checkRunManifestSemantics` itself? | **`validateArtifact`, and it exists.** Charter §7 puts "contract validation and the `run-manifest-v1` semantic pass" in `core`, and the *composition* — annotation selection, ordering, error replacement — is the part that carries register row 14. Leaving it in the CLI would mean M3's server re-deriving it. `validateContract` was considered and rejected: "contract" is the glossary term for the schema, not for the thing being checked. | decided |
| OQ-2 | Is `computeManifestRollup` exported for direct testing? | **No.** Exporting it invites Q-0049 to import it, which turns the check into a tautology (AC-7). It is exercised through `checkRunManifestSemantics`, which is how the CLI reaches it today. | decided |
| OQ-3 | Where does `TERMINAL_STATUSES` live — `shared/constants.ts`, or with the pass? | **With the pass, unexported.** Fact 10: its only two readers are inside `checkRunManifestSemantics`. A constant with one consumer does not belong in the package everything imports, and Q-0043's `projectConfigSchema` — shipped declared and called nowhere — is the precedent to avoid. If Q-0049 turns out to need it, promoting it then is a two-line change with a caller to justify it. | decided |
| OQ-4 | `ajv` has no `exports` map and its `dist/2020.d.ts` ends `export default Ajv2020` in a CJS package; `tsconfig.base.json` sets `module: nodenext` and does **not** set `esModuleInterop`. Does `import Ajv2020 from 'ajv/dist/2020.js'` type-check? | **Try in this order and report which was needed:** (a) the spike's import verbatim; (b) a named import — `import { Ajv2020 } from 'ajv/dist/2020.js'`, which the same `.d.ts` also declares; (c) only if neither compiles, add `esModuleInterop: true` to `tsconfig.base.json`. (c) changes every package's compilation and must be named in the implementation summary with the exact `tsc` error that forced it — it is a workspace default, and an unrequested default is a decision taken on someone else's behalf. `skipLibCheck: true` is already on, so ajv's own declarations are not the risk; the import form is. | implementer |
| OQ-5 | One file or two? | **Two, in one folder:** `contracts.ts` (ajv, the three ported functions, the composition) and `run-manifest.ts` (the semantic pass, its roll-up and `TERMINAL_STATUSES`). The 2026-08-23 decision's own framing is that a *product-level* pass is selected by a *generic* validator; keeping them in one file is how the next recognised annotation ends up appended to the ajv module. The exported surface is `contracts.ts`'s, so consumers see one import path. | decided |
| OQ-6 | Should the module-level Ajv instance become per-call, which would remove AC-5 defect 1 for free? | **No.** It is a behaviour change to `harness validate`'s exit code and output on a multi-file invocation, and charter §2 forbids fixing a defect found while reading. It also discards the compiled-schema cache, which is the reason the instance is shared. The fix is a follow-up ticket; this one reports it. | decided |
| OQ-7 | Does `validateArtifact` read the schema once and derive the annotation from that object, where the spike reads it separately at `:494`? | **Yes, once per call**, from the object `validateFile` already read. Nothing externally observable changes: the annotation value is identical, and the CLI's fail-fast `cannot read schema` path stays reachable because Q-0010 will read the schema up front with the exported `readData`, exactly as `spike/bin/harness.js:494` does. Read *count* is internal, and §2 does not preserve internals. | decided |

## Risks

- **The roll-up independence is the whole ticket and it has no natural defender.** Nothing fails if
  the two implementations converge — not a test, not `tsc`, not CI — until a writer bug ships
  undetected. AC-7's source-level assertion is the only guard, and **a reviewer should read that
  test before reading the implementation.** Q-0049 inherits the same obligation from the other side
  and its requirement should say so.
- **"Skipped is not passed" is easy to satisfy in the letter and lose in the spirit.** A
  `validateArtifact` that returns two states instead of three, or a caller that reads `ok` as "the
  semantic checks were fine", reproduces the $13.86 failure at a different altitude. AC-8's three
  states and the `ran: true` rule are what make it checkable.
- **The `$id` collision looks exactly like a bug to fix.** It is, and it is not this ticket's. An
  implementer who removes it makes every test in AC-5 red and every existing test green, which is
  the shape §2 exists to catch.
- **The lockfile.** This is the port's first child to add a runtime dependency to `packages/core`.
  `commands.install` in `harness/harness.yaml` runs `pnpm install --frozen-lockfile`, so a
  `package.json` edit without a regenerated `pnpm-lock.yaml` fails `integrate` **after** the
  implementer has been billed. Q-0041 got this right (`86a4b90` touched the lockfile); note that
  `pnpm-lock.yaml` is not in `developer-generalist`'s `paths` frontmatter, which is advice rather
  than enforcement — the file must still be written.
- **`integrate` can report a cached pass** (Q-0065). `pnpm turbo run test` without `--force`
  replays a green it did not execute, and this ticket changes a dependency graph, which is exactly
  when a stale cache is most plausible. Verify the merge with `--force` before trusting `tests=ok`.
- **A gate that cannot be answered destroys a proven-green merge** (Q-0040, open). Run this where a
  human can answer the final gate; if the run dies there, re-perform `integrate` by hand before
  trusting the branch.
- **The Q-0006 frontmatter fixture is a committed backlog file.** It is stable — Q-0006 is closed
  and contained — but a future run against that ticket would change it. The alternative, a copied
  fixture, would break the 2026-08-22 entry's "verified on the real artifacts, not a fixture", which
  is the claim that made the validator worth adding. Accepted, and named here so a later failure is
  read as a signal rather than as flakiness.
- **Scope drift into Q-0049.** Reading `checkRunManifestSemantics` means reading the manifest
  schema, which means reading the writer. The reviewer should treat any change outside
  `packages/core/src/contracts/`, its tests, `packages/core/package.json` and `pnpm-lock.yaml` as
  unrequested.
- **`harness/Q-0045/integration` already exists and is contained** (fact 13) — charter §8's most
  expensive pre-run item is satisfied. It should be confirmed still contained immediately before
  the run rather than assumed from this document.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable, no network. `ajv` and `ajv-formats` are offline, dependency-light and already vendored in `spike/`. No code path, test, fixture or example accepts a key. |
| **Worktree safety** | n/a directly — this module reads two files and returns a value; it creates no branch, worktree or ref and writes nothing. The tests write only to `tempDir()` and read this repository read-only. |
| **Gate behaviour** | n/a — nothing here presents or answers a gate. The manifest *statuses* it reasons about include `exhausted` and `interrupted`, but only as strings in a persisted document. |
| **File format and its schema** | The run manifest is the subject, and its schema is frozen (`contracts/Q-0011/run-manifest.schema.json`). No format changes. `USAGE_MEASURES` comes from `shared`; no zod schema is added, and JSON Schema stays the contract language because zod cannot read what solutioning emits. |
| **Lint rules** | n/a — no flow lint rule is added, removed or read. `lintFlow` (Q-0044) and this module never meet. |
| **Containment** | n/a — this module runs no git. |
| **Cold-clone impact** | Two new runtime dependencies in `packages/core`, both already in the spike's tree, both install-time only. No new command, prompt or step. Neutral. |
| **Errors are explicit** | Mostly, and the exceptions are AC-5's. `validate` never swallows a violation; a non-compiling schema throws loudly by design; the semantic pass names the vendor and field it disagrees about. Against that, four of the eight preserved defects are silences, all named in the report rather than fixed. |
| **Product-agnostic** | No SaaS product is named or implied in the module, its tests or its fixtures. |

## Evidence

Every fact above was produced this session at `9ef83e8`, by running rather than reading:

- `spike/src/contracts.js` imported directly and exercised for error-string format, the `$id`
  collision (both directions), non-compiling schemas, unknown keywords and all four `readData`
  extension cases.
- `node spike/bin/harness.js validate` run against `contracts/Q-0011/run-manifest.schema.json`
  with thirteen mutated manifests, capturing all fourteen semantic messages verbatim, the
  structural-suppresses-semantic ordering, and the mixed priced/unpriced roll-up case; and against
  `contracts/Q-0006/ticket-review-state.schema.json` with the committed Q-0006 frontmatter and two
  malformed copies, capturing the `oneOf` / `if/then` / `format` error sets.
- Output byte-inspected with `cat -A` to establish that the skip line precedes the verdict line and
  to capture the exact escape sequences AC-9 requires.
- `grep` over `spike/` to establish that `TERMINAL_STATUSES` has exactly two readers and that no
  shipped flow calls `harness validate`; `git branch` and `git merge-base --is-ancestor` to
  establish the integration branch's state; `pnpm-lock.yaml` and `git log -- pnpm-lock.yaml` for
  the dependency and lockfile facts.

One transcription was corrected by this method and is worth naming, because it is this ticket's own
subject matter: the semantic pass has **fourteen** distinct messages, not the twelve a first reading
of the source suggests — a step of a non-adapter kind can emit three separate messages (`adapter`,
`model`, `usage`), and the roll-up comparison emits three (missing row, field mismatch, orphan row)
rather than one. A requirement written to protect a message set had miscounted it before running it.
