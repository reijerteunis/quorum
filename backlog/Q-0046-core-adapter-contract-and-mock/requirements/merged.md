# Q-0046 — `core/adapters`: the contract layer and the mock adapter

*Merged requirement, head-of-product, 2026-08-26. Route: **chore** (`requirements → chore → human
gate`). Parent Q-0009. Depends on Q-0041 (`main:contained`); depended on by Q-0047. Charter:
`harness/port-charter.md`; §6's Q-0046 row (`:314`) is normative, inherited invariants are register
rows **1, 13, 21, 22**, and Erratum E-1 below amends row 1's assignment for this ticket alone.
Surfaces: `packages/core/src/adapters/` and its tests, and nothing else.*

> **Authority.** Every message, regex, ordering claim, export list and preserved defect below was
> re-derived against the working tree at `9b3781f` while merging these candidates, not carried over
> on either candidate's word. Where this document and the charter differ, the charter's §6 table is
> right except where E-1 names it.

---

## Problem

`spike/src/adapters/index.js` is 210 lines and `mock.js` is 125, and together they are the file a
contributor's Gemini adapter inherits. Everything in them exists because a real run failed and cost
real money: `withRetry` because a dropped connection is not a verdict, `authError` because Q-0001's
first real run died seconds in on an expired Codex login that `check()` had reported ✓ minutes
earlier — after the parallel Claude step had been paid for, `PROBE_SCHEMA` because a rule living in a
comment let `adapters --probe` report codex unusable while the login was fine, and
`checkAgainstSchema` because accepting `verdict: "approve"` alongside a list of blockers is not
tolerance but a routing bug that advances a ticket on a verdict its own findings contradict.

The mock lands here rather than with the vendors because it is what every test and demo runs on.
`docs/04-architecture.md` keeps it in the package for that reason, and Q-0054 cannot port a suite
without it.

**The exposure is not that a function disappears** — a lost function is loud, an import fails. It is
three-fold and every part is silent.

**This module's consumers do not exist yet.** `getAdapter` is called by `engine.js:206` (Q-0050) and
`bin/harness.js:472` (Q-0010); `checkAgainstSchema` by `engine.js:273` (Q-0052); `probeAdapter` by
`bin/harness.js:479` (Q-0010). Between this landing and Q-0052's, nothing in the workspace exercises
this module except its own tests.

**The retry wrapper is the one place where a wrong classification costs money rather than
correctness.** `transientError` decides whether a failure is retried five times over 75 seconds or
given up on immediately, and both errors are expensive in opposite directions. Its list is
specific-before-generic on purpose — *"429 rate_limit_error is a rate limit, not an anonymous 5xx"*
(`index.js:45`) — and reordering it during transcription changes which sentence a user reads without
changing whether they are retried, so no test asserting only the boolean would catch it.

**`probeAdapter` is a check whose failure mode is to blame the wrong thing.** `withRetry` returns
`usage: null` when no attempt reported a measure (`index.js:93–94`, added by Q-0034 so `rollup()`
cannot invent a vendor row); `probeAdapter` then dereferences `res.usage.cost_usd` with no guard
(`:159`). An adapter whose login is perfect and which reports no usage therefore returns
`{ok: false, error: "Cannot read properties of null (reading 'cost_usd')"}`, which the CLI renders as
`✗ login not usable: …`. That is *"a check that skips its subject must not report success"*
(2026-08-25) in its other direction — a check that examines its subject, crashes inside its own
reporting, and attributes the crash to the subject.

Underneath all three: **the suites that would catch a slip run against the spike.**
`smoke.js:137–176` and `:449–503`, `q0006-engine.js:87–88`, `q0011-run-history.js:144–148` and
`q0034-probe-schema.js` all import from `spike/src/adapters/`. They are frozen under charter §3 and
Q-0054 translates them last, so until then the only thing asserting that `core`'s contract layer
behaves like the spike's is this ticket's own tests.

---

## User stories

- **As the contributor writing a Gemini adapter**, I need the contract to be a TypeScript interface I
  can implement against, with the retry policy, the auth translation and the probe already applied to
  whatever I return — so that "what an adapter must do" is a type error rather than a paragraph in
  `03-adapter-contract.md` I might not read.
- **As the maintainer**, when a run stops I need to know which of three things happened: the network
  dropped (retried, gave up, and it says after how many attempts), the login is dead (not retried,
  one actionable sentence), or the agent answered wrongly (every problem listed, nothing defaulted).
  A single generic failure message costs an hour — M0 paid it.
- **As the maintainer**, I need a probe's ✗ to mean the login is unusable. If it can also mean the
  probe crashed on its own reporting path, the one command that exists to de-risk a paid run has
  become another thing to distrust.
- **As the cold-clone adopter**, I need the BYOS promise enforced where it cannot be bypassed: no
  code path, test, fixture or example accepts an API key, and `check()` is never allowed to look like
  proof of a login.
- **As Q-0054 and as the QA author**, I need the mock to behave in `packages/core` exactly as it does
  in the spike — same env switches, same call-key discriminator, same verdict-on-first-call rule —
  because every end-to-end test in the regression suite is written against those switches.

---

## Erratum E-1 — register row 1 is split, and the half this ticket cannot write is re-pointed

*Dated 2026-08-26. Amends `harness/port-charter.md` §6's invariant column for the **Q-0046** row
only. §2's register text is unchanged; the other thirteen children are unaffected.*

**What the register says.** Row 1 (`:127`) reads *"`check()` refuses on `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY` / `CODEX_API_KEY` **before** probing the CLI, so a missing binary cannot mask a key;
only `adapters --probe` proves a login"*, and §6 assigns it to **Q-0046**.

**What the code says.** The refusal is not in `adapters/index.js`. It is in `claude.js:12` and
`codex.js:22`, inside each vendor's `check()`, ahead of the `--version` probe, each with the comment
explaining the ordering. `mockAdapter`'s `check()` (`mock.js:28`) performs no such check and returns
`'mock 0.0.1'`. Both vendor files are **Q-0047's** (§6 `:315`), and §6 assigns row 1 to neither.

**The decision.** Row 1 splits into two halves with two owners.

- **Q-0046 owns the half it can write:** nothing in `packages/core/src/adapters/` calls `check()`;
  `probeAdapter` is the only authenticated round-trip and it never stands in for presence; the
  exported contract states in its own JSDoc that `check()` is cheap, makes no request, and does not
  prove a login. Enforced by AC-9.
- **Q-0047 owns the refusal and its ordering**, and **Q-0047's requirement must carry a criterion
  asserting that the refusal fires before the CLI probe, over all three variable names, and that it
  still fires when the configured executable is missing.** Charter §2's own words are the reason it
  cannot be dropped: *"a rewrite that probes first and refuses second passes every test that checks
  only the refusal."*

**Why an erratum rather than a criterion.** Centralising the guard into the contract wrapper is the
other available answer and charter §2 forbids it: it is a behaviour change — `mockAdapter().check()`
would begin refusing, and every contributor adapter would inherit a guard it does not have today —
and the route for a deliberate behaviour change is its own `docs/DECISIONS.md` entry accepted
*before* implementation, never a silent improvement discovered in review. Leaving the criterion in
this ticket instead would name a surface this ticket may not write, which the revise loop cannot
close and every round would be right to refuse (*"A requirement may not name a surface its flow
cannot write"*, 2026-08-25). Reporting row 1 as closed here would be the exact failure the row
exists to prevent.

**This erratum is committed by hand** into `backlog/Q-0046-…/requirements/errata.md` alongside this
document, before the first run — `backlog/` is not an agent-writable surface (`commitAll`,
`spike/src/fanout.js:80–93`).

---

## Context the implementer should not re-derive

| What | Where |
| --- | --- |
| The module | `spike/src/adapters/index.js` — `getAdapter` `:27`, `TRANSIENT` `:37`, `transientError` `:55`, `withRetry` `:68`, `AUTH_PATTERNS` `:120`, `RELOGIN` `:126`, `authError` `:129`, `PROBE_SCHEMA` `:142`, `PROBE_PROMPT` `:147`, `probeAdapter` `:149`, `extractJson` `:169`, `checkAgainstSchema` `:181` |
| The mock | `spike/src/adapters/mock.js` — `calls` `:11`, `TASKS` `:12`, `mockAdapter` `:25`, `nonempty` `:106`, `numericSwitch` `:107`, `mockProfile` `:114` |
| Its specification | `docs/03-adapter-contract.md:19–46` (interface), `:54–70` (structured tail), `:72–80` (BYOS), `:82–96` (`check()` is not proof) |
| In-repo consumers, all later tickets | `spike/src/engine.js:8` (Q-0050/Q-0052), `spike/bin/harness.js:19` (Q-0010), `claude.js:3` and `codex.js:6` (Q-0047) |
| Frozen suites covering it | `smoke.js:137–176`, `:449–503`; `q0006-engine.js:87–88`; `q0011-run-history.js:144–148`; `q0034-probe-schema.js`. Q-0054's to translate; **frozen** (§3) |
| Already exported by `@quorum/shared` — import, never re-spell | `AdapterEvent`, `adapterEventSchema`, `retryEventSchema` (`events.ts`); `USAGE_MEASURES` and `UsageMeasure` (`constants.ts:149–153`); `FINDING_PATTERN` (`:138`) |
| **Not** exported by `@quorum/shared` | `retryPolicySchema` and `adapterConfigSchema` are module-private consts in `shared/src/project.ts:36,50`. Only `projectConfigSchema` and `ProjectConfig` are exported (`:56`, `:93`). Reach the adapter config as `ProjectConfig['adapters']`, or declare the structural type locally — **adding an export to `shared` is a non-goal** (AC-2) |
| The four-validations note, written for this ticket | `packages/shared/src/step-output.ts:1–26` — names `checkAgainstSchema` as *"Ported by Q-0046"* and says why none of the four validations is another |
| Register row 22's operative reading | `packages/shared/src/events.ts`, the "vendor identity" note — no vendor-specific field and no vendor branching outside an adapter; a neutral open `vendor` label is permitted and required |
| The folder rule | *"`core` is organised in folders named after the port's children"* (2026-08-26). Landed pattern: `src/git/git.ts`, `src/backlog/backlog.ts` + `project.ts`, `src/contracts/contracts.ts` + `run-manifest.ts`, `src/lint/lint.ts` — `<folder>/<folder>.ts` plus siblings, **no barrel** |
| The house-rule test pattern to copy | `packages/core/src/contracts/contracts.source.test.ts` — import-specifier assertion `:55–70`, no-`any` sweep `:79–85` |
| Test helpers already shipped | `packages/core/test/corpus.ts` — `repoRoot`, `repoFile` (throws when its subject is missing), `coreSourceFiles` (recursive since Q-0064; keyed by path below `src`, e.g. `adapters/adapters.ts`; throws when a subdirectory holding source is uncovered). `packages/core/test/repo.ts` — `tempDir`, `write`, `walk`, `removeTempDirs` |
| Dependency direction | Charter §4: `core → shared`, never the reverse |

---

## Acceptance criteria

Twelve, each independently testable against throwaway directories the test builds or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next
landing changes (*"A red test is a permanent acceptance test"*, 2026-08-23).

### AC-1 — The module lands in its own folder, exports exactly nine runtime names, adds no dependency, and prints nothing

`packages/core/src/adapters/` holds `adapters.ts` and `mock.ts`, matching the landed
`<folder>/<folder>.ts` pattern and adding no barrel. `adapters.ts` exports exactly eight runtime
values — `getAdapter`, `withRetry`, `transientError`, `authError`, `PROBE_SCHEMA`, `probeAdapter`,
`extractJson`, `checkAgainstSchema` — and `mock.ts` exactly one, `mockAdapter`. Type exports are
permitted and uncounted (AC-2). `PROBE_PROMPT`, `TRANSIENT`, `AUTH_PATTERNS`, `RELOGIN` and the
mock's three helpers stay module-private, as in the spike. TypeScript strict, no `any`, no
`@ts-ignore` without its one-line reason on the same line, no import from `spike/**`.
`packages/core/package.json` and `pnpm-lock.yaml` are **unchanged** — the module uses `node:fs`,
`node:os`, `node:path` and `@quorum/shared` and nothing else — and so is `packages/core/src/index.ts`,
which `packages/shared/src/index.test.ts:52` byte-pins to `export const name = '@quorum/core';\n`.

**Nothing in the folder prints.** No ANSI escape, no marker glyph, no `console.` call, no rendered
sentence: charter §7 assigns event rendering to the CLI's residual scope, and M3's server would
otherwise ship terminal control codes over a WebSocket. The one thing that looks like an exception is
the mock's `stdout` line, which is an **event payload** handed to `onEvent`, not something written to
a stream — and that distinction is what this criterion pins.

*Test:* `Object.keys` over each module namespace equals its list. A source-level test over
`coreSourceFiles()` filtered to `adapters/` asserts each file imports only `node:fs`, `node:os`,
`node:path`, `@quorum/shared` and its own siblings; that no import, export or `require(` line names
`spike`; and that no file contains `console.`, `\x1b`, `✓` or `✗`. `repoFile('packages/core/src/index.ts')`
still equals its pinned byte string. `packages/core/package.json` parses to the same four dependencies
at the same versions. Workspace `pnpm lint`, `pnpm typecheck` and `pnpm test` green.

### AC-2 — The contract is a type, its vocabularies come from `shared`, and every exported symbol carries JSDoc *(register row 22)*

`adapters.ts` exports as types: `Adapter`, `AdapterRunOptions`, `AdapterResult`, `AdapterUsage`,
`ProbeResult`, `RetryPolicy` and `AdapterSchema`. They transcribe `docs/03-adapter-contract.md:19–46`
— `vendor`, `check()`, `run({prompt, schema, model, cwd, extraDirs, maxTurns, allowWrite, onEvent})`,
and a result of `{output, raw, usage, session, vendor, ms}` with `attempts` added by the wrapper.
Options `extraDirs`, `maxTurns`, `model` and `onEvent` are optional, because `probeAdapter` supplies
neither `maxTurns` nor `onEvent` (`index.js:155`).

Four bindings are the criterion, because each is a place a second spelling would drift:

- **`onEvent` is `(event: AdapterEvent) => void`**, importing `AdapterEvent` from `@quorum/shared`.
  Not a local union, not `unknown`. This is how register row 22 is discharged here: an adapter cannot
  emit a shape the one event format does not describe, and no field is vendor-conditional.
- **`AdapterUsage` is keyed by `USAGE_MEASURES`** imported from `@quorum/shared`, plus `vendor`, never
  re-listed as a literal. Every measure is `number | null`; `null` means the vendor did not report it
  and is never zero.
- **`vendor` is an open string**, not an enum of the three shipped names — a contributor's adapter
  must not need `packages/shared` or this file edited to exist.
- **`RetryPolicy` and `getAdapter`'s config parameter are declared here or derived from
  `ProjectConfig['adapters']`.** `retryPolicySchema` and `adapterConfigSchema` are module-private in
  `shared/src/project.ts` and adding an export to `shared` is a non-goal; a locally declared
  structural type is the answer, with one line of JSDoc naming why.

`AdapterSchema` describes the JSON Schema subset `checkAgainstSchema` and `PROBE_SCHEMA` actually
read: `type`, `properties` (each with optional `type`, `enum`, `minLength`, `minItems`, `maxItems`,
`items.type`, `items.pattern`, `description`), `required`, `additionalProperties`. It is a structural
type, **not** a zod schema and not derived from one — collapsing it into `shared`'s zod is the
boundary register row 13 forbids (AC-7). It is named `AdapterSchema` rather than `StepSchema` because
`shared` already exports `stepOutputDeclarationSchema` / `StepOutputDeclaration` for the *flow file's*
`output:` block, and the two mean opposite things.

The module and **every exported symbol and non-obvious interface field** carry JSDoc stating their
contract. Counterintuitive preserved behaviour carries one line naming its authority
(`Why: preserved defect, see Q-0046 AC-11`); ticket or DECISIONS prose is never transcribed into a
source file.

*Test:* a compile-time fixture implementing `Adapter` and emitting one event of each `AdapterEvent`
kind type-checks; one emitting `{type: 'tool'}` does not (`@ts-expect-error` with its one-line
reason). A runtime test parses every event the mock and the retry wrapper emit through
`adapterEventSchema` and asserts each parses. A source-level test asserts `adapters.ts` contains
`from '@quorum/shared'`, does not re-spell the five measure names as a literal array, and that every
`export` line is preceded by a `/** … */` block.

### AC-3 — `getAdapter` resolves a name to a wrapped adapter, and its registry is honest about being incomplete

`getAdapter(name, config = {})` looks `name` up in a module-level registry, throws
`unknown adapter "<name>" (known: <keys joined by ", ">)` when absent, reads `config[name] ?? {}`, and
returns `withRetry(factory(cfg), cfg.retry)`. The `known:` list is `Object.keys(registry)` and is
never a literal.

**At this ticket's landing the registry holds `mock` alone**, because `claude.js` and `codex.js` are
Q-0047's. `getAdapter('claude')` therefore throws `unknown adapter "claude" (known: mock)` in `core`
while the spike returns an adapter. This is stated as a criterion rather than left to be discovered:

- It is not a shipped behaviour change. `packages/cli` does not exist until Q-0010, `engine.js` still
  imports the spike's registry, and no user-facing command can reach `core`'s.
- The message **format** is preserved and pinned by a test; the **membership** is not asserted here.
- **Q-0047 restores it, and Q-0047's requirement must carry a criterion saying so.** The implement
  report names this as the one transitional divergence and names Q-0047 as its owner.

Injecting factories through a registration seam or importing unported vendor modules are both
refused: the first is a new API that would outlive the two evenings it bridges, the second breaks §3.

*Test:* `getAdapter('mock')` returns an object whose `vendor` is `'mock'` and whose `run` is not the
raw factory's; `getAdapter('nope')` throws a message matching `/^unknown adapter "nope" \(known: .+\)$/`
whose parenthesised list equals the registry's keys read back through the same public surface;
`getAdapter('mock', {mock: {delayMs: 0}})` reaches the factory's config and
`getAdapter('mock', {mock: {retry: {attempts: 1}}})` reaches the wrapper's.

### AC-4 — `withRetry` is the whole retry policy, in one place, with usage that survives failure

`withRetry(adapter, {attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000} = {})` returns
`{...adapter, run}`, so `vendor`, `check` and anything a contributor added pass through untouched.
Its `run`:

1. Accumulates the five measures across **every** attempt, adding a measure only when that attempt
   reported it non-null, and tracks the vendor each attempt declared.
2. On success returns `{...res, vendor, usage, attempts}` where `vendor` is
   `res.vendor ?? res.usage?.vendor ?? adapter.vendor`, and **`usage` is `null` unless at least one
   measure was reported** — otherwise `{vendor, ...spent}`. A per-call declaration takes precedence;
   the adapter's own vendor is used only when the call omits one.
3. On a failure `transientError` does not recognise, or on the last attempt: attaches `e.attempts`;
   attaches `e.vendor` and `e.usage = {vendor, ...spent}` **only when a measure was reported**;
   appends `` ` (gave up after ${attempt} attempts)` `` **only when the failure was transient**; and
   rethrows the same error object.
4. Otherwise emits `{type: 'retry', vendor: adapter.vendor, attempt, of: attempts, delayMs, reason,
   message: String(e.message).slice(0, 160)}` — the **unwrapped** adapter's vendor, which is
   deliberately different from the thrown error's `usage.vendor` and both are preserved — sleeps
   `min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)`, and tries again. No retry event is emitted
   for a terminal failure or after the last permitted attempt.

The default schedule spans 5s + 10s + 20s + 40s = 75s, sized against a home connection gone for about
a minute. The asymmetry is the reason and belongs in the module's JSDoc, cited not transcribed: a dead
network wastes 75 seconds, giving up early wastes a step that cost dollars and ten minutes.

*Test:* an adapter failing twice with `Connection closed mid-response` then succeeding is called three
times, returns `attempts: 3`, and reports `cost_usd` summed across all three attempts (the
`q0011-run-history.js:144` case); exactly two `retry` events are emitted and each parses against
`retryEventSchema`; an adapter that always fails transiently is called exactly `attempts` times and
its message ends `gave up after 3 attempts`; an adapter failing with `401 Unauthorized` is called
**once** and its message is unchanged; an adapter succeeding with no measure reported returns
`usage: null`; one reporting only `input_tokens` returns a usage object whose other four measures are
`null`; a cache-bearing attempt does not add cache measures into `input_tokens` a second time; a
failed attempt that reported usage puts it on the thrown error; a wrapped adapter still answers
`check()` and still reports `vendor`. Every timing test passes `baseDelayMs: 0` — no test waits on a
production default.

### AC-5 — `transientError` and `authError` classify exactly as they do today, including their false positives

`transientError(text = '')` returns a description or `null`. It **short-circuits on `authError`
first** — auth and model-availability failures never self-heal — then tests the twelve `TRANSIENT`
patterns **in source order**, which is specific-before-generic: rate limit and overloaded precede the
bare status-code alternation, so `429 rate_limit_error` reports *"a rate limit"* and not *"a server
error"*. **The order is the criterion, not just the outcome**: reordering changes the sentence a user
reads without changing whether the call is retried, so no boolean assertion would notice.

`authError(vendor, text = '')` returns one actionable line or `null`. The model-availability match
runs **before** the auth patterns and produces a different sentence, naming the model and the
subscription and **not** telling the user to log in again. The nine `AUTH_PATTERNS` and the two
`RELOGIN` entries port verbatim, with the `` `${vendor} login` `` fallback for a vendor not in the
map — which is the contributor's inheritance.

*Test:* the five retryable and four non-retryable strings from `smoke.js:451–469` asserted against the
same expectations; `429 rate_limit_error` asserted to report *"a rate limit"* specifically, proving
the ordering; the real Codex refresh-token sentence from `smoke.js:139` yielding
`codex logout && codex login`; `401 Unauthorized` recognised for claude; a compile error left alone;
the `gpt-5.2-codex` model error asserted to name the model and *"ChatGPT subscription"* and asserted
**not** to match `/log ?out/i`; `authError('gemini', '401 Unauthorized')` falling back to
`gemini login`.

### AC-6 — `extractJson` is the only place vendor-wrapping tolerance lives, and it defaults to nothing *(register rows 13, 21)*

`extractJson(text)` tries, in order: every ```` ```json ```` (or bare ```` ``` ````) fence from the
**last** backwards; then `JSON.parse` from the last `\n{`; then `JSON.parse(text.trim())`. It returns
`null` when none parses — never `{}`, never a partial object, never a repaired one. That is the row-21
half this module owns: a missing structured tail becomes a `null` that `checkAgainstSchema` reports as
`output is not an object`, so the engine stops with a message rather than proceeding on a default.

*Test:* a fenced block chosen over earlier prose; the **last** of two fences chosen; a malformed last
fence falling back to an earlier valid one; a bare leading object parsed through the trimmed-text
branch; a JSON array returned unchanged as an array (which AC-7 then rejects); prose returning `null`;
empty string and `undefined` returning `null`.

### AC-7 — `checkAgainstSchema` stays strict about Quorum's own schema and minimal about everything else *(register row 13)*

`checkAgainstSchema(output, schema): string[]` — empty when the output matches. It reports, in this
push order: a non-object, `null` or array input as the single message `output is not an object`; then
each missing `required` key; then each unknown key when `additionalProperties === false`; then, per
property **in `schema.properties` declaration order**, an enum violation, a non-string or too-short
string, a non-array, a `minItems`/`maxItems` violation, a non-string item, and an item failing
`items.pattern`; then the verdict/findings coupling — the **first** enum value requires empty
`findings`, every other declared value requires at least one. All eighteen message strings port
verbatim, and every problem found is reported rather than the first.

**The coupling is the criterion that matters**: it is what stops the engine advancing a ticket on
`approve` alongside a list of blockers, and it is the specific thing the 2026-08-22 decision moved
*into* this function rather than the engine.

It stays minimal on purpose: no recursion into nested objects, no validation of non-string `items`,
no knowledge of `$ref`, `oneOf` or `format`. Those belong to ajv over solutioning's contracts, which
is Q-0045's landed module. **This function must not import `../contracts/`, must not import zod or
ajv, and must not be re-expressed as a zod schema** — `packages/shared/src/step-output.ts:1–26` names
all four validations and why none is another.

*Test:* `{verdict: 'approve', findings: ['x'], summary: 1, extra: 2}` against a generated verdict
schema asserted as the exact ordered array
`["unknown \"extra\"", "\"summary\" must be a non-empty string", "approve requires empty findings"]`;
`changes-requested` without findings asserted by message; a three-value vocabulary asserted to treat
the second and third values alike; the `q0006-engine.js:87–88` fixtures — six bad outputs each
returning a non-empty array and the good one returning `[]`; `null`, `[]` and a string each returning
`["output is not an object"]`; a `FINDING_PATTERN` item failure reporting
`"findings" item has invalid format: …`. A source-level test asserts no file under `adapters/` imports
`zod`, `ajv` or `../contracts/`.

### AC-8 — `PROBE_SCHEMA` obeys the rule that broke the probe, and the rule is checked rather than commented

`PROBE_SCHEMA` is `{type: 'object', properties: {ok: {type: 'boolean'}, summary: {type: 'string'}},
required: ['ok', 'summary'], additionalProperties: false}` and the private `PROBE_PROMPT` ports
verbatim.

The rule — **every schema Quorum sends a vendor lists every declared property in `required` and sets
`additionalProperties: false`** — ports as an executable check, not as a comment. OpenAI strict
structured outputs reject anything else, and the resulting vendor error looks exactly like a broken
login, which is how `adapters --probe` reported codex unusable while the login was fine.

**The `schemaFor` half of `q0034-probe-schema.js` does not move here.** `schemaFor` lives in
`engine.js:679` and belongs to Q-0052; asserting it here would mean importing `spike/src/engine.js`
(forbidden by §3 and AC-1) or duplicating another child's module. The helper is written here over
`PROBE_SCHEMA` and exported for reuse, the spike's test keeps covering `schemaFor` until Q-0052 ports
it, and **Q-0052's requirement must carry that criterion**. The implement report states this as
coverage *deferred with a named owner*, never as coverage that is complete — the skipped-is-not-passed
rule applied to a test's own scope.

*Test:* `PROBE_SCHEMA.additionalProperties === false`; `Object.keys(properties)` minus `required` is
empty; the assertion is a reusable exported helper so Q-0052 imports the rule rather than retyping it;
a deliberately non-conforming schema is asserted to fail the helper, so the helper is shown able to
fire.

### AC-9 — `probeAdapter` is the only proof of a login, and it is the same probe *(register row 1, this ticket's half — E-1)*

`probeAdapter(adapter, {cwd, model} = {})` calls `adapter.run` **exactly once** with `PROBE_PROMPT`,
`PROBE_SCHEMA`, `allowWrite: false`, `extraDirs: []` and a `cwd` that defaults to a fresh
`fs.mkdtempSync` directory — **deliberately empty**, because running it in the project loads
`CLAUDE.md`, the rules and everything else the repo carries, which turned a hello-world round-trip
into $0.39. A directory it created is removed in `finally`; one the caller supplied is not.

On success it validates the output with `checkAgainstSchema` and returns
`{ok: true, vendor, ms, cost_usd, tokens, session}` where `tokens` is
`(input_tokens ?? 0) + (output_tokens ?? 0)`. On invalid structured output it returns `ok: false` with
`structured output invalid (<problems joined by "; ">)` and the first 400 characters of `raw`. On a
throw it returns `ok: false` with `authError(adapter.vendor, e.message) ?? e.message` — normalised
**here** as well as inside each built-in adapter, so a contributor's adapter does not have to remember
to translate its vendor's auth noise. Cleanup happens on all three paths.

**`probeAdapter` never calls `check()`, and nothing else in this module does either.** That is the
half of register row 1 this ticket can enforce (E-1): presence and login are separate questions, and
no code path here can let the cheap one stand in for the expensive one. The exported contract's JSDoc
says so — `check()` is cheap, makes no authenticated request, and its success does not prove a login.
**No test makes a paid request**; every test uses the mock or a local stub.

*Test:* a stub returning a valid probe answer gives `ok: true` with `ms` a number and `tokens` summed;
one returning `{ok: true}` with no `summary` gives `ok: false` with
`structured output invalid (missing "summary")`; one throwing the real Codex refresh-token sentence
gives `ok: false` whose error contains `logout` (the `smoke.js:175` case);
`probeAdapter(mockAdapter())` gives `ok: true` (the `smoke.js:150` case); a supplied `cwd` still
exists afterwards and a defaulted one does not, asserted on both the success and the throw path;
`adapter.run` asserted called exactly once and `check` never.

### AC-10 — The mock ports byte-for-behaviour, writes only inside its `cwd`, and keeps the process-scoped counter

`mockAdapter(cfg = {})` ports whole: `vendor: 'mock'`; `check()` returning `'mock 0.0.1'`; the role
and ticket extraction from the prompt; the call key `role:task` or `role:kind` where `kind` is
`verdict` or `plain`; the `cfg.delayMs ?? 20` sleep; the `TASKS` fixture and its `{id}` substitution;
the architect's `contracts/ProrationService.ts`; QA's `tests/check.sh`; the developer's
`src/<task>.ts`; `output.ok` when the schema asks for it; `output.document` in both its forms; the
verdict rule — **last** enum value on the first call per key, **first** afterwards, with the
placeholder finding; the usage shape in which the two cache switches are folded **into**
`input_tokens` rather than computed independently; and a result of
`{vendor, output, raw: JSON.stringify(output), usage, session: null, ms: 20}`.

Every environment switch ports with its exact name and semantics: `MOCK_VENDOR`,
`MOCK_CACHED_INPUT_TOKENS`, `MOCK_CACHE_WRITE_INPUT_TOKENS`, `MOCK_TOKEN_ONLY`, `MOCK_ALWAYS_PASS`,
`MOCK_ALWAYS_FAIL` (mutually exclusive, and saying so), `MOCK_DEV_FLAKY`, `MOCK_FAIL_WRITE` (whose
thrown error carries `vendor` and a billed `usage`, because the request was charged before it failed),
and `MOCK_RUN_HISTORY_PROFILES` with its four distinct validation messages. A numeric switch must be a
finite non-negative number; a malformed or non-object profile map, and a non-object role profile, each
fail explicitly with their own message.

**Write containment:** when `allowWrite` is false the mock creates no contract, test or source file;
when true it writes only the same relative paths under the supplied `cwd` as the spike, and nothing
outside it.

**The module-scoped `calls` map is preserved and no reset is exported.** In the spike every `run` is a
fresh process, so the counter is per-run; under Vitest a test file shares the module for its lifetime.
Tests therefore select behaviour with `MOCK_ALWAYS_PASS` / `MOCK_ALWAYS_FAIL` or with distinct role
names, and no test depends on being the first caller for a key it shares with another. Adding a reset
export would be a behaviour change under §2 and is refused; the constraint is recorded in the module's
JSDoc and named in the implement report as something Q-0054 inherits.

*Test:* the verdict rule asserted twice over one key and asserted independent of order under each
always-switch; `MOCK_ALWAYS_PASS=1` with `MOCK_ALWAYS_FAIL=1` throwing its exact message;
`MOCK_TOKEN_ONLY=1` giving `cost_usd: null`; a cache switch asserted to leave
`cached_input_tokens ≤ input_tokens` (the invariant `mock-adapter-run-history.contract.md` states, and
which the pre-Q-0034 mock violated); the four `MOCK_RUN_HISTORY_PROFILES` failures each asserted by
message; `MOCK_FAIL_WRITE` throwing an error carrying `vendor` and `usage.cost_usd === 0.07`;
`MOCK_DEV_FLAKY=1` writing nothing on the second task's first call and saying so in `summary`;
`allowWrite: false` asserted to leave a `tempDir()` empty, and `allowWrite: true` asserted via `walk`
to have created files only under it; the emitted event asserted `stdout`-only and parsed against
`adapterEventSchema`; every test restoring the environment it changed.

### AC-11 — Four preserved defects, carried unfixed and reported *(charter §2)*

None is repaired. Each is pinned by a test asserting the current behaviour, so a later "cleanup" turns
this suite red rather than passing silently, and each is named in `dev/implement-report.md` with the
statement that it is preserved.

1. **`probeAdapter` blames the login for its own crash.** `withRetry` returns `usage: null` when no
   measure was reported; `probeAdapter` dereferences `res.usage.cost_usd` unguarded, so an adapter
   whose login is perfect returns `{ok: false, error: "Cannot read properties of null (reading
   'cost_usd')"}`, which the CLI renders as `login not usable`. No optional chain, no guard, no
   default. **This is the most tempting fix in the ticket and the most important one to leave:** the
   port's proof is that the ported tests describe the ported code, and the spike still has this.
   Proposed as a follow-up ticket in the report.
2. **`transientError` retries on any bare `429/500/502/503/504/529`** anywhere in a message, so a
   compile error mentioning line 502 is retried five times across 75 seconds. The alternation is not
   narrowed and no boundary beyond the existing `\b` is added.
3. **`transientError` calls `authError` with the placeholder vendor `'x'`**, building a sentence that
   is discarded and only tested for nullness. The call is not refactored to take a vendor.
4. **The mock assumes `schemaFor`'s output** and throws a raw `TypeError` on a schema with no
   `properties` (`mock.js:54`). No guard is added.

The report additionally names **register rows 1, 13, 21 and 22 and where each is discharged**,
including row 1's split under Erratum E-1 and the fact that Q-0047 owns the refusal-ordering half.
Reporting row 1 as closed by this ticket would be the exact failure the row exists to prevent.

*Test:* defects 1, 2 and 4 asserted by observable outcome against the exact strings above; defect 3
asserted through `authError('x', '401 Unauthorized')` returning
`x login expired or missing — run: x login`, which is only reachable because the placeholder is passed.

### AC-12 — The module's unit-level tests land with it, the frozen suite is untouched, and anything else stops the child

Charter §1 requires every child to port its module's unit-level tests, so chore's `integrate` examines
what the run produced rather than replaying two suites that predate it. The Vitest coverage above is
written fresh against the ported code — not a transcription of the spike's runner — and covers, at
minimum, the subjects the frozen suites cover: `smoke.js:137–176`, `:449–503`, `q0006-engine.js:87–88`,
`q0011-run-history.js:144–148`, and `q0034-probe-schema.js`'s `PROBE_SCHEMA` half. **None of those
five files is edited, deleted or re-pointed** (§3); they keep running against the spike, and Q-0054
decides later what becomes of the duplicated sections.

If transcription or the tests reveal a spike defect, an inconsistency, or a behaviour this document
does not cover, the implementer records the exact fixture, the actual output and the expected
authority in `dev/implement-report.md` and **stops**. It does not fix the behaviour, add a guard,
narrow a regex, register the vendor adapters early, add a mock reset, widen `checkAgainstSchema`, add
an export to `packages/shared`, or edit a contract, ticket or doc in passing. The route for a
deliberate change is its own `docs/DECISIONS.md` entry or a dated erratum in this ticket's folder,
accepted **before** it is implemented. A reviewer may treat an unregistered behaviour change as a
blocker by citing *"The port preserves behaviour"* (2026-08-25) without arguing the change's merits.

The report also states: the transitional divergence AC-3 produced and that Q-0047 owns restoring it;
that AC-8's `schemaFor` half is deferred to Q-0052; row 1's split per E-1; and the wording finding
below.

**One stop-and-report is already known and is not this ticket's to fix.** `claude.js:12`,
`codex.js:22` and the fixture at `smoke.js:465` call the product *"Harness"*
(`… Harness runs on subscription OAuth only`), which `.claude/rules/product-boundaries.md` forbids —
"Harness" is the concept and the folder, never the product. All three are in frozen or Q-0047-owned
files. The report names it; nothing in this ticket changes it.

---

## Before the first run — two actions, both by hand, both costly to forget

1. **Create `harness/Q-0046/integration` from `main`.** It does not exist (`git branch -a --list
   '*Q-0046*'` returns nothing). `chore.yaml`'s `review` step diffs
   `harness/Q-0046/integration...harness/Q-0046/implement`, and only `integrate` — which runs later —
   creates the left endpoint. Forgetting it fails the run **after** the implementer has been paid,
   which is how Q-0035 lost $13.86. This is the single highest-value line in this document.
2. **Commit Erratum E-1** to `backlog/Q-0046-…/requirements/errata.md` alongside this merged
   requirement. `backlog/` is not an agent-writable surface, so no run can produce it, and a reviewer
   citing charter §6's row-1 assignment against AC-9 would otherwise be right.

Both dependencies are satisfied: `harness/Q-0041/integration` and `harness/Q-0045/integration` are
both `main:contained` (§5 clause 5).

---

## Non-goals

- **`claude.js`, `codex.js` and the per-adapter `capabilities` split** — Q-0047. Including the
  `check()` API-key refusal and its ordering (E-1), `exec()` and its `EPIPE` handling (Q-0063, fixed
  in the spike and to be ported *as fixed*), JSONL parsing, and `--ignore-user-config`.
- **`overrideAdapters`** (`spike/bin/harness.js:612`) — §6 assigns it to Q-0047.
- **The `adapters` and `adapters --probe` CLI commands** (`bin/harness.js:467–487`) — §6's Q-0046 row
  lifts **nothing** from `bin/harness.js`, and §6 is normative. The presence loop, the `--json` report
  assembly, the colour and the exit codes stay in the CLI until Q-0010; `probeAdapter` is the export
  §7's prose means and it already exists.
- **`schemaFor`** (`engine.js:679`) and everything that generates a step's schema — Q-0052.
- **Writing the raw output beside the ticket** (`engine.js:274–277`) and the `FlowError` it throws —
  Q-0050/Q-0052. This ticket owns only the half of row 21 that produces the problem strings and
  refuses to default (AC-6, AC-7). Nothing here writes into `backlog/` or `.quorum/`.
- **Fixing anything found while reading** — §2. That covers all four items in AC-11, and in particular
  the `probeAdapter` null-usage crash, which is the one most likely to be argued for.
- **Editing `spike/**`** — §3. The five suites that import this module stay where they are.
- **Adding anything to `packages/shared`**, including exporting `retryPolicySchema` or
  `adapterConfigSchema`, or moving the `Adapter` interface there. `AdapterEvent`, `USAGE_MEASURES`,
  `FINDING_PATTERN` and `ProjectConfig` are imported; nothing is added. Q-0041 is landed and its
  package is declarations-only and browser-safe.
- **Re-expressing `checkAgainstSchema` in zod or ajv**, or letting either import the other — register
  row 13 and `step-output.ts:1–26`.
- **Adding `tool` or `text` event kinds**, parsing vendor JSONL into normalised events, or persisting,
  replaying or transporting an event — decided 2026-08-25, owned by Q-0050.
- **A registration seam, runtime adapter discovery or a plugin surface** of any kind (AC-3).
- **Re-exporting from `packages/core/src/index.ts`** — byte-pinned by
  `packages/shared/src/index.test.ts:52`.
- **Any new dependency**, and any change to `packages/core/package.json` or `pnpm-lock.yaml`.
- **Changing flow, ticket, role, project, run-history or task file formats.**
- **Budget enforcement, a lock on a ticket, `--base`, gate semantics, worktree pruning** — Q-0038,
  Q-0039, Q-0040, Q-0062. Also the Q-0009 cutover, the `quorum` binary, the daemon and Studio.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace, visual
  node canvas, eval suites, Gemini adapter, desktop shell.

---

## Open questions

**None blocks the implementer.** Each is recorded as decided with its evidence, so no revise round is
spent on it. This ticket runs the chore route, which has no architect: a question deferred to a stage
that does not exist is a round of the revise loop, not a decision.

| # | Question | Resolution | Owner |
| --- | --- | --- | --- |
| OQ-1 | **Where does the BYOS refusal live?** The register assigns row 1 to Q-0046; the code is in Q-0047's two files. Centralise into the wrapper, or preserve per-vendor? | **Preserve per-vendor; split the row.** Centralising is a behaviour change — `mockAdapter().check()` would begin refusing and every contributor adapter would inherit a guard it lacks today — and §2 requires a decision entry *before* such a change. Q-0046 discharges the half it can write (AC-9); the ordering assertion is Q-0047's. Recorded as **Erratum E-1**, committed by hand. Raised as a blocker by the codex candidate; settled here rather than by iteration, because the revise loop cannot close a criterion naming a surface the flow may not write. | decided / Q-0047 |
| OQ-2 | **The registry cannot hold `claude` or `codex` until Q-0047.** Ship with `mock` alone, accept factories through a seam, or land both tickets atomically? | **`mock` alone (AC-3).** A seam and a `registerAdapter` are new APIs nobody asked for and both would outlive the two evenings they bridge; atomic landing merges two children and defeats the per-module cut. Nothing user-facing reaches `core`'s registry before Q-0010, the message *format* is preserved and pinned, and membership is Q-0047's criterion. | decided / Q-0047 |
| OQ-3 | What are the files called? `adapters/index.ts` would mirror the spike. | **`adapters/adapters.ts` and `adapters/mock.ts`.** The landed pattern is `<folder>/<folder>.ts` plus siblings — `git/git.ts`, `backlog/backlog.ts` + `project.ts`, `contracts/contracts.ts` + `run-manifest.ts` — and `contracts.source.test.ts:45` pins "neither is a barrel". An `index.ts` inside a folder is the shape that becomes one. | decided |
| OQ-4 | Do `Adapter` and friends belong in `packages/shared`, since M3's server will want them? | **No — `core/adapters`.** `shared` is declarations-only and browser-safe by its own test; an `Adapter` is a function-typed contract over a spawned process. Nothing outside `core` needs it before M3. `AdapterEvent` is imported *from* shared, which is the direction §4 permits. Promoting it later is a move with a caller to justify it; doing it now repeats `projectConfigSchema` — shipped declared and called nowhere. | decided |
| OQ-5 | Does `AdapterSchema` type-check against what `schemaFor` returns, given `schemaFor` is untyped JavaScript in another ticket? | **It cannot be proved here, and that is the answer.** Type it from the fields `checkAgainstSchema` reads (AC-2), keep it permissive, and let **Q-0052** assert assignability when it ports `schemaFor`. A field `checkAgainstSchema` reads that `AdapterSchema` cannot express is a stop-and-report, never a widening to `any`. | implementer / Q-0052 |
| OQ-6 | `probeAdapter`'s null-usage crash is a live defect in a command that exists to de-risk paid runs. Fix it? | **No — preserve, pin, report** (AC-11 defect 1). §2 is unambiguous and the reasoning is this ticket's own subject: the spike keeps the old behaviour, so a quiet fix leaves both suites green over a product that disagrees with itself. It deserves its own ticket, proposed in the implement report. | decided |
| OQ-7 | `q0034-probe-schema.js` covers `PROBE_SCHEMA` and `schemaFor` with one helper. Port both halves? | **Port the `PROBE_SCHEMA` half, export the helper, leave `schemaFor`'s half on the spike** (AC-8). Porting it would mean importing `spike/src/engine.js` — forbidden by §3 and AC-1 — or duplicating Q-0052's module. The deferral is named as deferred, with Q-0052 as owner. | decided |
| OQ-8 | The mock's counter is module-scoped and Vitest shares a module across a file. Add a reset for tests? | **No.** A test-only export is a behaviour change under §2, and Q-0054 would then have two ways to control the mock. Tests select behaviour with the always-switches or distinct role names (AC-10). The constraint is recorded in the module's JSDoc, because Q-0054 inherits it and will otherwise rediscover it as flakiness. | decided |

---

## Risks

- **`harness/Q-0046/integration` does not exist.** See "Before the first run". Forgetting it fails the
  run after the implementer has been paid.
- **The registry narrowing reads as a regression.** A reviewer diffing `getAdapter` against the spike
  sees one entry and a `known:` list that no longer names the vendors. AC-3 states it, pins the format
  rather than the membership, and assigns restoration to Q-0047 — point the reviewer at AC-3 before
  the implementation.
- **Three of the four preserved defects look exactly like bugs to fix**, and one is a genuine live
  defect in a safety command. An implementer who fixes it makes AC-11 red and everything else green,
  which is the shape §2 exists to catch. A reviewer should read the AC-11 tests before the module.
- **The retry classification is testable only through its outcomes**, and AC-5's ordering claim has no
  natural defender: reordering `TRANSIENT` keeps every boolean assertion green and changes only which
  sentence a user reads. The `429 rate_limit_error` case is the guard, and it is one line a later
  tidy-up could delete with no other test failing.
- **The mock's shared counter will present as flaky Vitest ordering**, most likely in Q-0054 rather
  than here. AC-10 is the discipline; the JSDoc is what carries it forward.
- **Q-0047 lands directly on top of this.** Boundary drift in either direction — the vendor adapters
  re-implementing `authError`, or this module acquiring vendor knowledge to make Q-0047 easier —
  defeats the reason `authError` sits at the contract layer. Treat any vendor name outside a test
  fixture, other than in `RELOGIN`, as unrequested.
- **`shared` looks like it exports more than it does.** `retryPolicySchema` and `adapterConfigSchema`
  are private consts; an implementer importing them hits a compile error and may reach for an export
  in `shared`, which is a non-goal. AC-2 names the two legal routes.
- **`integrate` can report a cached pass** (Q-0065). `pnpm turbo run test` runs without `--force`, and
  a cached run has already reported 7/7 while a forced re-run failed 1 of 123. Verify the merge with
  `--force` before trusting `tests=ok`.
- **A gate that cannot be answered destroys a proven-green merge** (Q-0040, open). It has cost two
  tickets their merge on consecutive nights. Run this where a human can answer the final gate; if the
  run dies there, re-perform `integrate` by hand before trusting the branch.
- **`budget.per_run_usd` stops nothing** (Q-0038). It reads 10; a single step has spent $13.86 past it
  uninterrupted. The cap is attention, not config.
- **Scope drift into Q-0050–Q-0053.** Reading `checkAgainstSchema` means reading `schemaFor` and the
  engine's failure path. Any change outside `packages/core/src/adapters/` and its tests is
  unrequested — this ticket touches no `package.json` and no lockfile, which makes the boundary
  unusually easy to check.

---

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | Central, and deliberately split. No code path, test, fixture or example accepts an API key or makes a paid request; the module reads no `*_API_KEY` variable, because the refusal lives in Q-0047's two `check()` implementations. What this ticket enforces is the other half: `probeAdapter` is the only login proof, nothing here calls `check()`, and no path can let presence stand in for a login (AC-9). Row 1's ordering assertion is Q-0047's, per Erratum E-1. |
| **Worktree safety** | n/a directly. The module spawns nothing and creates no branch or worktree; `probeAdapter`'s temporary directory is under `os.tmpdir()`, never the repository, and is removed in `finally`. The mock writes only inside the `cwd` its caller supplies, asserted by AC-10. |
| **Gate behaviour** | n/a — nothing here presents or answers a gate. The chore route's human gate is unchanged. |
| **Files are the database** | Preserved. No persistence is added; the only writes are `probeAdapter`'s disposable sandbox and the mock's caller-scoped artifacts, both already in the spike. Nothing writes into `backlog/` or `.quorum/`. |
| **File format and its schema** | No format changes. `PROBE_SCHEMA` is a value Quorum sends a vendor, unchanged. `AdapterUsage`'s five measures come from `shared`'s `USAGE_MEASURES` rather than a second spelling, which is the drift the constant was extracted to prevent. |
| **Lint rules** | n/a — no flow lint rule is added, removed or read. TypeScript strict, ESLint and the package-boundary rules apply to the new folder. |
| **Cross-vendor rule** | n/a — no reviewing or judging step is created or changed. `vendor` is a neutral open label and no field in the union is vendor-conditional (AC-2, register row 22's operative reading in `shared/src/events.ts`). |
| **Containment** | n/a — this module runs no git. Both dependencies are `main:contained`; this ticket's own integration branch does not yet exist and must be created by hand. |
| **Cold-clone impact** | Neutral to positive. No new dependency, no new command, no new prompt. The one thing an adopter meets on this path is `adapters --probe`'s message quality, preserved exactly. |
| **Errors are explicit** | Mostly, and the exceptions are AC-11's. `extractJson` returns `null` rather than an empty object; `checkAgainstSchema` returns every problem rather than the first and never substitutes a value or chooses a verdict; `authError` and the give-up message both say what happened and what to do. Against that, `probeAdapter` can report a crash as an unusable login and `transientError` can retry a deterministic failure — both preserved, both pinned, both in the report. |
| **Product-agnostic** | No SaaS product is named or implied; mock fixture names stay generic. One wording finding is reported and not fixed: `claude.js:12`, `codex.js:22` and `smoke.js:465` call the product "Harness", which `product-boundaries.md` forbids. All three are frozen or Q-0047's. |

---

## Provenance

**The claude candidate supplied the spine.** Its evidence-first method — every message, regex and
ordering claim re-derived, six of them by executing the spike rather than reading it — is what makes
the criteria testable rather than aspirational, and it is carried through: the `checkAgainstSchema`
push order, the `extractJson` branch behaviour, the `withRetry` accounting including `usage: null`,
the retry event's use of the *unwrapped* adapter's vendor, and the `probeAdapter` null-usage crash all
come from it and were re-verified here. Its **AC-11 (preserved defects, pinned and reported)** has no
counterpart in the other candidate and is the criterion most likely to save this ticket: without it,
an implementer fixes the probe crash, every test passes, and `core` silently disagrees with the spike
in the one place the port has no independent witness. Its resolutions of the file-naming, `shared`
promotion, `q0034` split and mock-reset questions are adopted as written (OQ-3, OQ-4, OQ-7, OQ-8), as
are the "nothing prints" rule and the pre-run branch warning.

**The codex candidate supplied four things the other lacked**, all folded in: the **JSDoc criterion**
(now part of AC-2) — a contributor-facing contract whose fields are undocumented is a paragraph in a
doc by another name; **mock write containment** as an explicit, separately testable boundary (AC-10);
the **mock usage-validation rules** — finite non-negative numeric switches, non-object profile maps,
non-object role profiles — which the other candidate compressed into a list of switch names; and the
flat statement that **no test may make a paid request** (AC-9), which is worth its own sentence rather
than being implied by "use the mock". Its explicit "tests restore every global they change" is kept in
AC-10. Its framing of the two blockers as *blockers* was also right, and is what made this merge worth
doing carefully.

**What was struck, and why.** The codex candidate's AC-12 — `check()` refuses all three API-key
variables before probing, tested over all three names and with the CLI missing — is **removed as a
criterion of this ticket**. Its only possible implementation is in `claude.js` and `codex.js`, which
Q-0047 owns and this ticket may not write; leaving it in would be the fifth appearance of *"a loop
spending its budget on work no agent in it can perform"*, and every revise round would be right to
refuse it. It is replaced by Erratum E-1, AC-9's dischargeable half, and an explicit obligation on
Q-0047's requirement. Its twenty-one criteria are folded to twelve, within the sizing rule: AC-1/AC-2
became AC-2, AC-4–AC-8 became AC-4 and AC-5, AC-11/AC-12 became AC-9 and E-1, AC-13/AC-14/AC-15 became
AC-6 and AC-7, AC-16–AC-18 became AC-10, and AC-21 (a cross-cutting section in the test report) became
the checklist above, since a report restating a checklist is not an independently testable criterion.

**One factual correction to both.** The claude candidate's context table lists `retryPolicySchema` and
`adapterConfigSchema` as already available in `@quorum/shared`. They are module-private consts in
`shared/src/project.ts:36,50`; only `projectConfigSchema` and `ProjectConfig` are exported. An
implementer following that line hits a compile error and is one step from adding an export to a
finished, declarations-only package — which is a non-goal. AC-2 now names the two legal routes.

**Size.** Twelve criteria, against the ten-to-fifteen band. The module is 335 lines of JavaScript with
no authorised behaviour change and four preserved defects; the criteria are dense but each is one
subject with its own test. The natural seam — contract layer versus mock — was considered and
rejected, because splitting them would leave Q-0054 unable to run anything and would make the mock a
ticket with no consumer.
