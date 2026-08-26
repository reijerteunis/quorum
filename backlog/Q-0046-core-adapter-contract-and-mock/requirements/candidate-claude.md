# Q-0046 — `core/adapters`: the contract layer and the mock adapter

*Candidate requirement, product-manager (claude), 2026-08-26. Route: **chore** (`requirements →
chore → human gate`). Parent: Q-0009. Depends on Q-0041 (landed, `main:contained`). Depended on by
Q-0047. Charter: `harness/port-charter.md`; §6's Q-0046 row (`:314`) is normative and the inherited
invariants are register rows **1, 13, 21, 22**. Surfaces: `packages/core/src/adapters/` and its
tests. Nothing under `spike/`, nothing in `packages/shared`, no flow file, no contract, no doc, no
CLI — `packages/cli` does not exist until Q-0010.*

> **Authority of the facts below.** Every message, regex, ordering claim and preserved defect was
> re-derived against the working tree at `9b3781f`. Six of them were established by **executing**
> `spike/src/adapters/index.js` and `mock.js`, not by reading them; those six are marked *(run)* and
> carry the observed output verbatim. Where this document and the charter ever differ, the charter's
> §6 table is right.

## Problem

`spike/src/adapters/index.js` is 210 lines and it is the file a contributor's Gemini adapter
inherits. Everything in it exists because a real run failed and cost real money:

- **`withRetry`** exists because Q-0006 run 7 lost a $0.35 step to a minute of bad wifi, and because
  losing a paid step to a dropped connection is the kind of thing that makes a tool untrustworthy.
- **`authError`** exists because Q-0001's first real run died several seconds in on an expired Codex
  login that `check()` had reported ✓ minutes earlier — *after* the parallel Claude step had already
  been paid for. It sits at the contract layer, not inside each vendor adapter, so that a third
  adapter gets actionable auth failures for free (*"check() proves presence; only `adapters --probe`
  proves login"*, `docs/DECISIONS.md`, 2026-08-22).
- **`PROBE_SCHEMA`** carries a rule in a comment above it — every property in `required` — that
  nothing checked until Q-0034, by which time `adapters --probe` had been reporting *"login not
  usable"* for codex while the login was fine. The one command that exists to prove a login before a
  paid run had never been able to prove codex at all.
- **`checkAgainstSchema`** is deliberately strict about Quorum's *own* generated schema, because
  accepting `verdict: "approve"` alongside a list of blockers is not tolerance, it is a routing bug
  that advances a ticket on a verdict its own findings contradict (*"Step-output validation is
  Quorum's contract with its own agents"*, 2026-08-22).
- **`extractJson`** is where — and the only place where — tolerance for how a vendor wraps its answer
  belongs.

The mock lands here rather than with the vendors because it is what every test and demo runs on.
`docs/04-architecture.md` keeps it in the package for that reason, and Q-0054 cannot port a suite
without it.

**The exposure is not that a function disappears.** A lost function is loud: an import fails. The
exposure is three-fold and each part is silent.

**First, this is the port's only module whose consumers do not exist yet.** `getAdapter` is called by
`engine.js:206` (Q-0050) and `bin/harness.js:472` (Q-0010); `checkAgainstSchema` by `engine.js:273`
(Q-0052); `probeAdapter` by `bin/harness.js:479` (Q-0010). Every one of those is a later ticket, so
between this landing and Q-0052's, nothing in the workspace exercises this module except its own
tests. Q-0045 had the same shape; the difference is that this module's registry is *incomplete* at
landing — the two vendor adapters are Q-0047's — so `getAdapter('claude')` throws where the spike
returns an adapter. That is a real, temporary divergence and it needs deciding here rather than
being discovered by Q-0047's reviewer (AC-3).

**Second, the retry wrapper is the one place in the product where a wrong classification costs money
rather than correctness.** `transientError` decides whether a failure is retried five times over 75
seconds or given up on immediately. Both errors are expensive in opposite directions: a
misclassified auth failure spends the budget again to reach the same answer, and a misclassified
network drop throws away a paid step. The spike's list is specific-before-generic on purpose — *"429
rate_limit_error is a rate limit, not an anonymous 5xx"* — and a reordering during transcription
changes which sentence a user is shown without changing whether they are retried, so no test that
asserts only the boolean would catch it.

**Third, `probeAdapter` is a check whose failure mode is to blame the wrong thing.** Fact 4 below
shows it reporting *"login not usable: Cannot read properties of null"* for an adapter whose login is
perfect and which simply reports no usage. That is *"a check that skips its subject must not report
success"* (2026-08-25) in its other direction — a check that examines its subject, fails inside its
own reporting, and attributes the failure to the subject. It is **preserved**, because charter §2
forbids fixing a defect found while reading; but it must be pinned by a test and reported, or the
port will quietly acquire a guard and the spike's suite will stay green while the two diverge.

Underneath all three is the structural problem the port has everywhere: **the suites that would catch
a slip run against the spike.** `smoke.js:137–176` and `:449–503`, `q0006-engine.js:87–88`,
`q0011-run-history.js:144–148` and `q0034-probe-schema.js` all import from `spike/src/adapters/`.
They are frozen under charter §3 and Q-0054 translates them last. Between this ticket and that one,
the only thing asserting that `core`'s contract layer behaves like the spike's is this ticket's own
tests.

## User stories

- **As the contributor writing a Gemini adapter**, I need the contract to be a TypeScript interface I
  can implement against, with the retry policy, the auth translation and the probe already applied to
  whatever I return — so that "what an adapter must do" is a type error rather than a paragraph in
  `03-adapter-contract.md` I might not read.
- **As the maintainer**, when a run stops I need to know which of the three things happened: the
  network dropped (retried, then gave up, and it says how many attempts), the login is dead (not
  retried, one actionable sentence), or the agent answered wrongly (the raw text saved and the run
  stopped). A single generic failure message costs an hour, which is exactly what M0 paid.
- **As the maintainer**, I need a probe's ✗ to mean the login is unusable. If it can also mean the
  probe crashed on its own reporting path, the one command that exists to de-risk a paid run has
  become another thing to distrust.
- **As the cold-clone adopter**, I need the BYOS promise enforced where it cannot be bypassed: no code
  path, test or example accepts an API key, and `check()` is never allowed to look like proof of a
  login.
- **As the QA author and as Q-0054**, I need the mock adapter to behave in `packages/core` exactly as
  it does in the spike — same env switches, same call-key discriminator, same verdict-on-first-call
  rule — because every end-to-end test in the regression suite is written against those switches.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/adapters/index.js` — `getAdapter` `:27`, `TRANSIENT` `:37`, `transientError` `:55`, `withRetry` `:68`, `AUTH_PATTERNS` `:120`, `RELOGIN` `:126`, `authError` `:129`, `PROBE_SCHEMA` `:142`, `PROBE_PROMPT` `:147`, `probeAdapter` `:149`, `extractJson` `:169`, `checkAgainstSchema` `:181` |
| The mock | `spike/src/adapters/mock.js` — `calls` `:11`, `TASKS` `:12`, `mockAdapter` `:25`, `nonempty` `:106`, `numericSwitch` `:107`, `mockProfile` `:114` |
| Its specification | `docs/03-adapter-contract.md` — the interface `:19–46`, the structured tail `:54–70`, BYOS `:72–80`, `check()` is not proof `:82–96` |
| In-repo consumers, all of them later tickets | `spike/src/engine.js:8` (Q-0050/Q-0052), `spike/bin/harness.js:19` (Q-0010), `spike/src/adapters/claude.js:3` and `codex.js:6` (Q-0047) |
| The frozen suites that cover it | `smoke.js:137–176` (authError, probe), `:449–503` (transient, withRetry); `q0006-engine.js:87–88` (checkAgainstSchema); `q0011-run-history.js:144–148` (withRetry usage accumulation); `q0034-probe-schema.js` (PROBE_SCHEMA strictness). Q-0054's to translate; **frozen** under §3 |
| Already in `shared`, written for this ticket, not to be spelled twice | `adapterEventSchema` and `AdapterEvent` (`events.ts`) — the three kinds `onEvent` may receive; `USAGE_MEASURES` (`constants.ts:149–151`) — the five measures in `withRetry`'s own order; `FINDING_PATTERN` (`:138`); `retryPolicySchema` and `adapterConfigSchema` (`project.ts`) — the config shape `getAdapter` reads |
| The four-validations note written for this ticket | `packages/shared/src/step-output.ts:1–26` — names `checkAgainstSchema` and `extractJson` as *"Ported by Q-0046"* and says why none of the four is another |
| The folder rule | *"`core` is organised in folders named after the port's children"* (2026-08-26). This module's folder is `adapters/`; `src/git/`, `src/backlog/`, `src/lint/` and `src/contracts/` are the landed pattern, each `<folder>/<folder>.ts` plus siblings, no barrel |
| The house-rule test pattern to copy | `packages/core/src/contracts/contracts.source.test.ts` — the allowed-import-specifier assertion `:55–70`, the "no `any`" sweep `:79–85`, the byte-pin on `index.ts` `:49–53` |
| Test helpers already shipped | `packages/core/test/corpus.ts` — `repoRoot`, `repoFile` (throws when its subject is missing), `coreSourceFiles` (recursive since Q-0064, keyed by path below `src`, e.g. `adapters/adapters.ts`); `packages/core/test/repo.ts` — `tempDir`, `write`, `walk`, `removeTempDirs` |
| Where types must not go | Charter §4: the dependency direction is `core → shared`, never the reverse |

## Facts established by running and reading the code

Each was re-derived at `9b3781f`. Facts marked *(run)* were produced by executing the spike's own
module and are transcribed verbatim from its output. The criteria depend on all of them.

1. **`withRetry`'s five measures are `USAGE_MEASURES`, in the same order** — `index.js:72` declares
   `['input_tokens', 'output_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'cost_usd']`
   and `packages/shared/src/constants.ts:149–151` is the same list, byte for byte, with a JSDoc
   naming this line as one of the two copies to collapse.
2. **`withRetry` returns `usage: null` when no attempt reported any measure** (`:93–94`). This is
   deliberate and was added by Q-0034: an adapter that reported nothing must not acquire a usage
   object, because `rollup()` counts any non-null usage as an occurrence and would invent a vendor
   row with `step_count: 1` for a call nobody measured.
3. **`probeAdapter` dereferences `res.usage.cost_usd` with no guard** (`:159`), so facts 2 and 3
   compose into a live defect.
4. *(run)* **A probe of an adapter that reports no usage returns
   `{"ok":false,"vendor":"stub","ms":0,"error":"Cannot read properties of null (reading 'cost_usd')"}`** —
   both unwrapped and wrapped by `withRetry`, i.e. exactly what `getAdapter` hands
   `bin/harness.js:479`. The CLI renders that as `✗ login not usable: Cannot read properties of
   null …`. An adapter whose every measure is `null` reaches it; one reporting any number does not
   (`{"ok":true,…,"cost_usd":null,"tokens":7}`).
5. *(run)* **`transientError` classifies a bare three-digit number anywhere in a message as a server
   error.** `transientError('TypeError at foo.ts:502 in module bar')` returns `"a server error"`, as
   does `transientError('assertion failed: expected 429 items')`. Both are therefore retried five
   times across 75 seconds before failing.
6. *(run)* **`getAdapter`'s unknown-name message is
   `unknown adapter "gemini" (known: claude, codex, mock)`** — the list is `Object.keys(registry)`,
   so it narrows automatically when the registry does.
7. *(run)* **`checkAgainstSchema`'s messages and their order.** For an output
   `{verdict:'approve', findings:['x'], summary:1, extra:2}` against a generated verdict schema it
   returns exactly
   `["unknown \"extra\"", "\"summary\" must be a non-empty string", "approve requires empty findings"]`.
   The push order is: missing-required, then unknown keys, then per property **in `schema.properties`
   declaration order**, then the verdict/findings coupling last. `null` and `[]` both return
   `["output is not an object"]`.
8. *(run)* **`extractJson` parses a bare leading object** (`'{"a":1}'` → `{a:1}`) through its final
   `JSON.parse(text.trim())` branch rather than the `\n{` branch; **returns a JSON array unchanged**
   (`'[1,2]'` → `[1,2]`), which `checkAgainstSchema` then rejects as not an object; and returns
   `null`, never `{}`, when nothing parses.
9. *(run)* **The mock's call counter is module-scoped and never reset.** Two `run` calls with the same
   role and schema in one process return `changes-requested` then `approve`. In the spike each `run`
   is a fresh process; in Vitest the module is shared for the life of a test file.
10. *(run)* **The mock emits only `stdout` events**, never `spawn`:
    `{"type":"stdout","line":"[mock] code-reviewer:verdict call #1 (model -, cwd quorum, write=false)"}`.
    Its usage is `{vendor:'mock', input_tokens: prompt.length/4|0, output_tokens:200,
    cached_input_tokens:null, cache_write_input_tokens:null, cost_usd:0.01}`.
11. *(run)* **The mock throws `TypeError: Cannot read properties of undefined (reading 'verdict')`
    when handed a schema with no `properties`** (`mock.js:54`). It assumes `schemaFor`'s output.
12. **`transientError` short-circuits on `authError('x', text)`** (`:56`) — a placeholder vendor
    string, so the message it builds is discarded and only its nullness is used. `authError('x',
    '401 Unauthorized')` returns `x login expired or missing — run: x login`, which no user ever sees.
13. **`withRetry`'s retry event names `adapter.vendor`, not the vendor the failed attempt declared**
    (`:109`), while the thrown error's `usage.vendor` uses `declaredVendor ?? adapter.vendor`
    (`:101`). The two are deliberately different and both are preserved.
14. **The API-key refusal is not in this file.** It is in `claude.js:12` and `codex.js:22`, inside
    each `check()`, ahead of the CLI probe — which are **Q-0047's** files. Register row 1 names
    Q-0046; the code that implements its testable half does not land here (AC-11).
15. **`spike/test/q0034-probe-schema.js` covers two subjects with one helper** — `PROBE_SCHEMA`
    (this ticket's) and `schemaFor` (`engine.js:679`, Q-0052's). Its `assertStrict` at `:16–24` is
    the shared instrument.
16. **`packages/core/src/index.ts` is byte-pinned from another package.**
    `packages/shared/src/index.test.ts:47–53` asserts it equals `export const name = '@quorum/core';\n`.
    Adding a re-export there turns a landed, reviewed test red.
17. **`packages/core/package.json` already declares `@quorum/shared`, `ajv`, `ajv-formats` and
    `yaml`.** This ticket needs none of them and adds no dependency: the module uses `node:fs`,
    `node:os`, `node:path` and nothing else.
18. **`harness/Q-0046/integration` does not exist.** `git branch -a --list '*Q-0046*'` returns
    nothing. Charter §8's first and most expensive pre-run item is **not** satisfied.
19. **Both declared dependencies of this ticket are landed and contained.**
    `git merge-base --is-ancestor harness/Q-0041/integration main` and the same for Q-0045 both exit
    0, satisfying charter §5 clause 5.
20. **`smoke.js:465` asserts `transientError` returns null for the string
    `'ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only'`.** That fixture
    calls the product "Harness", which `.claude/rules/product-boundaries.md` forbids. It is a string
    in a frozen test and in Q-0047's source; it is a stop-and-report, not this ticket's to fix.

## Acceptance criteria

Twelve, each independently testable against throwaway directories the test builds or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next
landing changes — *"A red test is a permanent acceptance test"* (2026-08-23).

### AC-1 — The module exists in its own folder, exports exactly nine runtime names, adds no dependency, and prints nothing

`packages/core/src/adapters/` holds `adapters.ts` and `mock.ts`, matching the landed
`<folder>/<folder>.ts` pattern and adding no barrel. `adapters.ts` exports exactly eight runtime
values — `getAdapter`, `withRetry`, `transientError`, `authError`, `PROBE_SCHEMA`, `probeAdapter`,
`extractJson`, `checkAgainstSchema` — and `mock.ts` exactly one, `mockAdapter`. TypeScript `type`
exports are permitted and uncounted (AC-2). TypeScript strict, no `any`, no `@ts-ignore` without its
one-line reason, no import from `spike/**`. `packages/core/package.json` and `pnpm-lock.yaml` are
**unchanged** (fact 17), and so is `packages/core/src/index.ts` (fact 16).

**Nothing in the folder prints.** No ANSI escape, no marker glyph, no `console.` call, no rendered
sentence. Charter §7 assigns event rendering to the CLI's residual scope; M3's server would otherwise
ship terminal control codes over a WebSocket. The one thing that looks like an exception is the
mock's `stdout` line, which is an **event payload** handed to `onEvent`, not something written to a
stream — and that distinction is what the criterion pins.

*Test:* `Object.keys` over each module namespace equals its list. A source-level test over
`coreSourceFiles()` filtered to `adapters/` asserts that every file imports only `node:fs`, `node:os`,
`node:path`, `@quorum/shared` and its own siblings; that no import, export or `require(` line names
`spike`; and that no file contains `console.`, `\x1b`, `✓` or `✗`. `repoFile('packages/core/src/index.ts')`
still equals `export const name = '@quorum/core';\n`. `packages/core/package.json` parses to the same
four dependencies at the same versions. Workspace `pnpm lint`, `pnpm typecheck` and `pnpm test` green.

### AC-2 — The contract is a type, and its event and usage vocabularies come from `shared` *(register row 22)*

The ticket body asks for the boundary to be explicit in types rather than by convention. `adapters.ts`
exports, as types: `Adapter`, `AdapterRunOptions`, `AdapterResult`, `AdapterUsage`, `ProbeResult`,
`RetryPolicy` and `StepSchema`. They transcribe `docs/03-adapter-contract.md:19–46` — `vendor`,
`check()`, `run({prompt, schema, model, cwd, extraDirs, maxTurns, allowWrite, onEvent})`, and a result
of `{output, raw, usage, session, vendor, ms}` with `attempts` added by the wrapper.

Three bindings are the criterion, because each is a place a second spelling would drift:

- **`onEvent` is `(event: AdapterEvent) => void`**, importing `AdapterEvent` from `@quorum/shared`.
  Not a local union, not `unknown`. This is how register row 22 is discharged here: an adapter cannot
  emit a shape the one event format does not describe, and no field is vendor-conditional.
- **`AdapterUsage` is keyed by `USAGE_MEASURES`** from `@quorum/shared` plus `vendor`, imported rather
  than re-listed (fact 1). Every measure is `number | null`; `null` means the vendor did not report
  it and is never zero.
- **`vendor` is an open string**, not an enum of the three shipped names — a contributor's adapter
  must not need `packages/shared` or this file edited to exist, and `getAdapter` already refuses an
  unknown name with a good message (AC-3).

`StepSchema` describes the JSON Schema subset `checkAgainstSchema` and `PROBE_SCHEMA` actually read:
`type`, `properties` (each with optional `type`, `enum`, `minLength`, `minItems`, `maxItems`,
`items.type`, `items.pattern`, `description`), `required`, `additionalProperties`. It is a structural
type, **not** a zod schema and not derived from one — collapsing it into `shared`'s zod is the
boundary register row 13 forbids (AC-7).

*Test:* a compile-time fixture implementing `Adapter` with a `run` that emits one event of each of the
three `AdapterEvent` kinds type-checks; one emitting `{type:'tool'}` does not (asserted with
`@ts-expect-error` plus its one-line reason). A runtime test parses every event the mock and the retry
wrapper emit through `adapterEventSchema` and asserts each parses. A source-level test asserts
`adapters.ts` contains `from '@quorum/shared'` and does **not** re-spell the five measure names as a
literal array.

### AC-3 — `getAdapter` resolves a name to a wrapped adapter, and its registry is honest about being incomplete

`getAdapter(name, config = {})` looks the name up in a module-level registry, throws
`unknown adapter "<name>" (known: <keys joined by ", ">)` when absent, reads `config[name] ?? {}`, and
returns `withRetry(factory(cfg), cfg.retry)`. The `known:` list is derived from the registry's keys
(fact 6) and is never a literal.

**At this ticket's landing the registry holds `mock` alone**, because `claude.js` and `codex.js` are
Q-0047's. `getAdapter('claude')` therefore throws `unknown adapter "claude" (known: mock)` in `core`
while the spike returns an adapter. This is stated as a criterion rather than left to be discovered:

- It is not a shipped behaviour change. `packages/cli` does not exist, `engine.js` still imports the
  spike's registry, and no user-facing command can reach `core`'s.
- The **message format** is preserved and pinned by a test; the **membership** is not asserted here.
- **Q-0047 restores it**, and its requirement must carry a criterion saying so. The implement report
  names this as the one transitional divergence and names Q-0047 as its owner.

*Test:* `getAdapter('mock')` returns an object whose `vendor` is `'mock'` and whose `run` is not the
raw factory's (i.e. it was wrapped); `getAdapter('nope')` throws with a message matching
`/^unknown adapter "nope" \(known: .+\)$/`; the parenthesised list equals the registry's keys read
back through the same public surface; `getAdapter('mock', {mock: {delayMs: 0}})` reaches the factory's
config, and `getAdapter('mock', {mock: {retry: {attempts: 1}}})` reaches the wrapper's.

### AC-4 — `withRetry` is the whole retry policy, in one place, with usage that survives failure

`withRetry(adapter, {attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000} = {})` returns
`{...adapter, run}` — so `vendor`, `check` and anything a contributor added pass through untouched.
Its `run`:

1. Accumulates the five measures across **every** attempt, adding a measure only when the attempt
   reported it non-null, and tracks the vendor each attempt declared.
2. On success returns `{...res, vendor, usage, attempts}` where `vendor` is
   `res.vendor ?? res.usage?.vendor ?? adapter.vendor`, and **`usage` is `null` unless at least one
   measure was reported** (fact 2) — otherwise `{vendor, ...spent}`.
3. On a failure that `transientError` does not recognise, or on the last attempt, attaches
   `e.attempts`, attaches `e.usage = {vendor, ...spent}` **only when a measure was reported**, appends
   `` ` (gave up after ${attempt} attempts)` `` **only when the failure was transient**, and rethrows
   the same error object.
4. Otherwise emits `{type:'retry', vendor: adapter.vendor, attempt, of: attempts, delayMs,
   reason, message: String(e.message).slice(0, 160)}` — the *unwrapped* adapter's vendor (fact 13) —
   sleeps `min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)`, and tries again.

The default schedule spans 5s + 10s + 20s + 40s = 75s of downtime across five attempts, sized against
a home connection gone for about a minute. The asymmetry is the reason and it is recorded in the
module's JSDoc, cited not transcribed: a dead network wastes 75 seconds, giving up early wastes a step
that cost dollars and ten minutes.

*Test:* an adapter failing twice with `Connection closed mid-response` then succeeding is called three
times, returns `attempts: 3`, and reports `cost_usd` summed across all three attempts (the
`q0011-run-history.js:144` case); exactly two `retry` events are emitted and each parses against
`retryEventSchema`; an adapter that always fails transiently is called exactly `attempts` times and
its error message ends `gave up after 3 attempts`; an adapter failing with `401 Unauthorized` is
called **once** and its message is left unchanged; an adapter that succeeds having reported no measure
returns `usage: null`; one that reports only `input_tokens` returns a usage object whose other four
measures are `null`; a failed attempt that reported usage puts it on the thrown error; a wrapped
adapter still answers `check()` and still reports `vendor`. All timing tests pass `baseDelayMs: 0`,
as the spike's do.

### AC-5 — `transientError` and `authError` classify exactly as they do today, including their false positives

`transientError(text = '')` returns a description or `null`. It **short-circuits on `authError`
first** (fact 12) — auth and model-availability failures never self-heal — then tests the twelve
patterns in `TRANSIENT` **in source order**, which is specific-before-generic: rate limit and
overloaded precede the bare status-code alternation, so `429 rate_limit_error` reports *"a rate
limit"* and not *"a server error"*. The order is the criterion, not just the outcome: reordering
changes the sentence a user reads without changing whether the call is retried.

`authError(vendor, text = '')` returns one actionable line or `null`. The model-availability match
runs **before** the auth patterns and produces a different sentence naming the model and the
subscription and **not** telling the user to log in again. The nine `AUTH_PATTERNS` and the two
`RELOGIN` entries port verbatim, with the `` `${vendor} login` `` fallback for a vendor not in the map.

*Test:* the five retryable strings and the four non-retryable ones from `smoke.js:451–469` asserted
against the same expectations, including the API-key string at `:465` (fact 20 — transcribed as a
fixture, its wording reported, not corrected); `429 rate_limit_error` asserted to report *"a rate
limit"* specifically, proving the ordering; the real Codex refresh-token sentence from `smoke.js:139`
asserted to yield `codex logout && codex login`; `401 Unauthorized` recognised for claude; a compile
error left alone; the `gpt-5.2-codex` model error asserted to name the model and *"ChatGPT
subscription"* and asserted **not** to match `/log ?out/i`; `authError('gemini', '401 Unauthorized')`
asserted to fall back to `gemini login`, which is the contributor's inheritance.

### AC-6 — `extractJson` is the only place vendor-wrapping tolerance lives, and it defaults to nothing *(register rows 13, 21)*

`extractJson(text)` tries, in order: every ```` ```json ```` (or bare ```` ``` ````) fence from the
**last** backwards; then `JSON.parse` from the last `\n{`; then `JSON.parse(text.trim())`. It returns
`null` when none parses — never `{}`, never a partial object (fact 8). That is the row-21 half this
module owns: a missing structured tail becomes a `null` that `checkAgainstSchema` reports as
`output is not an object`, so the engine stops with a message. Nothing is silently defaulted.

*Test:* a fenced block chosen over earlier prose; the **last** of two fences chosen; a malformed last
fence falling back to an earlier valid one; a bare leading object parsed (fact 8); a JSON array
returned as an array; prose returning `null`; empty string and `undefined` returning `null`.

### AC-7 — `checkAgainstSchema` stays strict about Quorum's own schema and minimal about everything else *(register row 13)*

`checkAgainstSchema(output, schema): string[]` — empty when the output matches. It reports, in this
push order (fact 7): a non-object input as the single message `output is not an object`; then each
missing `required` key; then each unknown key when `additionalProperties === false`; then, per
property in `schema.properties` declaration order, an enum violation, a non-string or too-short
string, a non-array, a `minItems`/`maxItems` violation, a non-string item, and an item failing
`items.pattern`; then the verdict/findings coupling — the **first** enum value requires empty
`findings`, every other value requires non-empty.

All eighteen message strings port verbatim. **The coupling is the criterion that matters**: it is what
stops the engine advancing a ticket on `approve` alongside a list of blockers, and it is the specific
thing the 2026-08-22 decision moved *into* this function rather than the engine.

It stays minimal on purpose. It does not recurse into nested objects, does not validate `items` of
non-string type, and knows nothing of `$ref`, `oneOf` or `format`. Those belong to ajv, over
solutioning's contracts, which is Q-0045's landed module. **This function must not import
`../contracts/`, must not import zod, and must not be re-expressed as a zod schema** —
`packages/shared/src/step-output.ts:1–26` names all four validations and why none is another.

*Test:* the fact-7 fixture asserted as an exact ordered array literal; `approve` with findings and
`changes-requested` without findings each asserted by message; a three-value vocabulary asserted to
treat the second and third values alike (preserved, AC-8); the `q0006-engine.js:87–88` fixtures — six
bad outputs each returning a non-empty array and the good one returning `[]`; `null`, `[]` and a
string each returning `["output is not an object"]`; a `FINDING_PATTERN` item failure reporting
`"findings" item has invalid format: …`. A source-level test asserts no file under `adapters/` imports
`zod`, `ajv` or `../contracts/`.

### AC-8 — `PROBE_SCHEMA` obeys the rule that broke the probe, and the rule is checked rather than commented

`PROBE_SCHEMA` is `{type:'object', properties:{ok:{type:'boolean'}, summary:{type:'string'}},
required:['ok','summary'], additionalProperties:false}` and `PROBE_PROMPT` ports verbatim.

The rule — **every schema Quorum sends a vendor lists every property in `required`, and sets
`additionalProperties: false`** — is ported as an executable check, not as a comment. OpenAI strict
structured outputs reject anything else, and the resulting vendor error looks exactly like a broken
login, which is how `adapters --probe` reported codex unusable while the login was fine.

**The `schemaFor` half of `q0034-probe-schema.js` does not move here** (fact 15). `schemaFor` lives in
`engine.js` and belongs to Q-0052. The check's helper is written here over `PROBE_SCHEMA` and over any
schema this module sends; the spike's test keeps covering `schemaFor` until Q-0052 ports it, and
**Q-0052's requirement must carry that criterion**. The implement report states this split explicitly
as coverage that is *deferred with a named owner*, never as coverage that is complete — the 2026-08-25
skipped-is-not-passed rule applied to a test's own scope.

*Test:* `PROBE_SCHEMA.additionalProperties === false`; `Object.keys(properties)` minus `required` is
empty; the assertion is written as a reusable helper so Q-0052 can import the *rule* rather than
retype it; a deliberately non-conforming schema is asserted to fail the helper, so the helper is shown
able to fire.

### AC-9 — `probeAdapter` is the only proof of a login, and it is the same probe

`probeAdapter(adapter, {cwd, model} = {})` runs `adapter.run` **once** with `PROBE_PROMPT`,
`PROBE_SCHEMA`, `allowWrite: false`, `extraDirs: []` and a `cwd` that defaults to a fresh
`fs.mkdtempSync` directory — **deliberately empty**, because running it in the project loads
`CLAUDE.md`, the rules and everything else the repo carries, which turned a hello-world round-trip into
$0.39. A directory it created is removed in `finally`; one the caller supplied is not.

On success it validates the output with `checkAgainstSchema` and returns
`{ok: true, vendor, ms, cost_usd, tokens, session}`, where `tokens` is
`(input_tokens ?? 0) + (output_tokens ?? 0)`. On invalid structured output it returns `ok: false` with
`structured output invalid (…)` and the first 400 characters of `raw`. On a throw it returns
`ok: false` with `authError(adapter.vendor, e.message) ?? e.message` — normalised **here** as well as
inside each built-in adapter, so a contributor's adapter does not have to remember to translate its
vendor's auth noise.

**`probeAdapter` never calls `check()`, and nothing else in this module does either.** That is the
half of register row 1 this ticket can enforce: presence and login are separate questions, and no code
path here can let the cheap one stand in for the expensive one.

*Test:* a stub adapter returning a valid probe answer gives `ok: true` with `ms` a number and `tokens`
summed; one returning `{ok: true}` with no `summary` gives `ok: false` with
`structured output invalid (missing "summary")`; one throwing the real Codex refresh-token sentence
gives `ok: false` whose error contains `logout` (the `smoke.js:175` case); `probeAdapter(mockAdapter())`
gives `ok: true` (the `smoke.js:150` case); a supplied `cwd` still exists afterwards and a defaulted
one does not, asserted on both the success and the throw path; `adapter.run` is asserted to have been
called exactly once and `check` never.

### AC-10 — The mock ports byte-for-behaviour, including the process-scoped counter that Vitest changes

`mockAdapter(cfg = {})` ports whole: `vendor: 'mock'`; `check()` returning `'mock 0.0.1'`; the role
and ticket extraction from the prompt; the call key `role:task` or `role:kind` where `kind` is
`verdict` or `plain`; the `cfg.delayMs ?? 20` sleep; the `TASKS` fixture and its `{id}` substitution;
the architect's contract write; QA's `tests/check.sh`; the developer's `src/<task>.ts`; `output.ok`
when the schema asks for it; the verdict rule — **last** enum value on the first call per key, **first**
afterwards; the placeholder finding; and the usage shape of fact 10, in which the cache fields are
folded into `input_tokens` rather than computed independently.

Every environment switch ports with its exact name and semantics: `MOCK_VENDOR`,
`MOCK_CACHED_INPUT_TOKENS`, `MOCK_CACHE_WRITE_INPUT_TOKENS`, `MOCK_TOKEN_ONLY`, `MOCK_ALWAYS_PASS`,
`MOCK_ALWAYS_FAIL` (mutually exclusive, and saying so), `MOCK_DEV_FLAKY`, `MOCK_FAIL_WRITE` (whose
thrown error carries `vendor` and a billed `usage`, because the request was charged before it failed),
and `MOCK_RUN_HISTORY_PROFILES` with its four distinct validation messages.

**The module-scoped `calls` map is preserved and no reset is exported** (fact 9). In the spike every
`run` is a fresh process, so the counter is per-run; in Vitest a test file shares it. Tests in this
package therefore select behaviour with `MOCK_ALWAYS_PASS` / `MOCK_ALWAYS_FAIL` or with distinct role
names, and no test depends on being the first caller for a key it shares with another test. Adding a
reset export would be a behaviour change under charter §2 and is refused; the constraint is recorded
in the module's JSDoc and named in the implement report as something Q-0054 inherits.

*Test:* the verdict rule asserted twice over one key and asserted independent of order under each of
the two always-switches; `MOCK_ALWAYS_PASS=1` with `MOCK_ALWAYS_FAIL=1` asserted to throw its exact
message; `MOCK_TOKEN_ONLY=1` giving `cost_usd: null`; a cache switch asserted to leave
`cached_input_tokens ≤ input_tokens` (the invariant `mock-adapter-run-history.contract.md` states, and
which the pre-Q-0034 mock violated); the four `MOCK_RUN_HISTORY_PROFILES` failures each asserted by
message; `MOCK_FAIL_WRITE` asserted to throw an error carrying `vendor` and `usage.cost_usd === 0.07`;
`MOCK_DEV_FLAKY=1` asserted to write nothing on the second task's first call and to say so in
`summary`; the architect, QA and developer writes asserted to land under a `tempDir()` cwd and nowhere
else; the emitted event asserted to be `stdout`-only and to parse against `adapterEventSchema`; every
test restores the environment it changed.

### AC-11 — Four preserved defects, carried unfixed and reported *(charter §2)*

None is repaired. Each is pinned by a test asserting the current behaviour, so a later "cleanup" turns
this suite red rather than passing silently, and each is named in `dev/implement-report.md` with the
statement that it is preserved.

1. **`probeAdapter` blames the login for its own crash** (facts 2–4). An adapter that reports no
   measure at all returns `{ok: false, error: "Cannot read properties of null (reading 'cost_usd')"}`,
   which the CLI renders as `login not usable`. No optional chain, no guard and no default is added.
   This is the most tempting fix in the ticket and the most important one to leave: the port's proof
   is that the ported tests describe the ported code, and the spike still has this.
2. **`transientError` retries on any bare `429/500/502/503/504/529`** anywhere in a message (fact 5),
   so a compile error mentioning line 502 is retried five times across 75 seconds. The alternation is
   not narrowed and no word boundary beyond the existing `\b` is added.
3. **`transientError` calls `authError` with the placeholder vendor `'x'`** (fact 12), building a
   sentence that is discarded. The call is not refactored to take a vendor.
4. **The mock assumes `schemaFor`'s output** and throws a raw `TypeError` on a schema with no
   `properties` (fact 11). No guard is added.

The report additionally names **register rows 1, 13, 21 and 22 and where each is discharged**,
including the half of row 1 that is **not** dischargeable here: the API-key refusal and its
before-the-probe ordering live in `claude.js:12` and `codex.js:22` (fact 14), which are Q-0047's, so
Q-0047's requirement must carry a criterion asserting the ordering — *"a rewrite that probes first
and refuses second passes every test that checks only the refusal"* (charter §2). Reporting row 1 as
closed by this ticket would be the exact failure the row exists to prevent.

*Test:* defects 1, 2 and 4 asserted by observable outcome against the exact strings above; defect 3
asserted through `authError('x', '401 Unauthorized')` returning `x login expired or missing — run: x
login`, which is only reachable because the placeholder is passed.

### AC-12 — The module's unit-level tests land with it, the frozen suite is untouched, and anything else stops the child

Charter §1 requires every child to port its module's unit-level tests, so that chore's `integrate`
examines what the run produced rather than replaying two suites that predate it. The Vitest coverage
above is written fresh against the ported code — it is not a transcription of the spike's runner —
and it covers, at minimum, the subjects the frozen suites cover: `smoke.js:137–176`, `:449–503`,
`q0006-engine.js:87–88`, `q0011-run-history.js:144–148` and `q0034-probe-schema.js`'s `PROBE_SCHEMA`
half. **None of those five files is edited, deleted or re-pointed** (charter §3); they keep running
against the spike, and Q-0054 decides later what becomes of the now-duplicated sections.

If transcription or the tests reveal a spike defect, an inconsistency, or a behaviour this document
does not cover, the implementer records the exact fixture, the actual output and the expected
authority in `dev/implement-report.md` and **stops**. It does not fix the behaviour, add a guard,
narrow a regex, register the vendor adapters early, add a mock reset, widen `checkAgainstSchema`, or
edit a contract, ticket or doc in passing. The route for a deliberate change is its own
`docs/DECISIONS.md` entry or a dated erratum in this ticket's folder, accepted **before** it is
implemented.

The report also states: which transitional divergence AC-3 produced and that Q-0047 owns restoring it;
which half of AC-8's rule is deferred to Q-0052; and the wording finding at fact 20.

## Non-goals

- **`claude.js` and `codex.js`, and the per-adapter `capabilities` split** — Q-0047. Including the
  `check()` API-key refusal itself, `exec()` and its `EPIPE` handling (Q-0063, already fixed in the
  spike and to be ported *as fixed*), the JSONL parsing, and `--ignore-user-config`.
- **`overrideAdapters`** (`spike/bin/harness.js:612`) — §6 assigns it to Q-0047.
- **The `adapters` and `adapters --probe` CLI commands** (`bin/harness.js:467–487`) — §6's Q-0046 row
  lifts **nothing** from `bin/harness.js`, and §6 is normative. The presence loop, the `--json` report
  assembly, the colour and the exit codes stay in the CLI until Q-0010, even though §7's prose lists
  "probing" among what `core` exports; `probeAdapter` is that export and it already exists.
- **`schemaFor`** (`engine.js:679`) and everything that generates a step's schema — Q-0052.
- **Writing the raw output beside the ticket** (`engine.js:274–277`) and the `FlowError` it throws —
  Q-0052. This ticket owns only the half of row 21 that produces the problem strings and refuses to
  default (AC-6, AC-7).
- **Fixing anything found while reading** — charter §2. That covers all four items in AC-11, and in
  particular the `probeAdapter` null-usage crash, which is the one most likely to be argued for.
- **Editing `spike/**`** — charter §3. The five suites that import this module stay where they are.
- **Adding anything to `packages/shared`**, including moving the `Adapter` interface there.
  `AdapterEvent`, `USAGE_MEASURES`, `FINDING_PATTERN` and `adapterConfigSchema` are imported; nothing
  is added. Q-0041 is landed and its package is declarations-only.
- **Re-expressing `checkAgainstSchema` in zod or ajv**, or letting either import the other — register
  row 13, and `step-output.ts:1–26`.
- **Adding `tool` or `text` event kinds**, parsing vendor JSONL into normalised events, or persisting,
  replaying or transporting an event — decided 2026-08-25 and owned by Q-0050.
- **Re-exporting from `packages/core/src/index.ts`** — byte-pinned by
  `packages/shared/src/index.test.ts:47–53`.
- **Any new dependency**, and any change to `packages/core/package.json` or `pnpm-lock.yaml`.
- **Budget enforcement, a lock on a ticket, `--base`, gate semantics, worktree pruning** — Q-0038,
  Q-0039, Q-0040, Q-0062. Also the Q-0009 cutover, the `quorum` binary, the daemon and Studio
  behaviour.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace, visual
  node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

**None blocks the implementer.** Each is recorded as decided with its evidence, so no revise round is
spent on it. This ticket runs the chore route, which has no architect: a question deferred to a stage
that does not exist is a round of the revise loop, not a decision.

| # | Question | Resolution | Owner |
| --- | --- | --- | --- |
| OQ-1 | What are the files called? `adapters/index.ts` would mirror the spike. | **`adapters/adapters.ts` and `adapters/mock.ts`.** The landed pattern is `<folder>/<folder>.ts` plus siblings — `git/git.ts`, `backlog/backlog.ts` + `project.ts`, `contracts/contracts.ts` + `run-manifest.ts` — and `contracts.source.test.ts:45` pins "neither is a barrel". An `index.ts` inside a folder is the shape that becomes one. | decided |
| OQ-2 | The registry cannot hold `claude` or `codex` until Q-0047. Ship it with `mock` alone, make it injectable, or add a `registerAdapter`? | **`mock` alone (AC-3).** Injection and registration are new APIs nobody asked for, and both would outlive the two evenings they exist to bridge. The message *format* is preserved and pinned; the membership is Q-0047's criterion. Nothing user-facing can reach `core`'s registry before Q-0010, so no shipped behaviour changes. | decided |
| OQ-3 | Do `Adapter` and friends belong in `packages/shared`, since M3's server will want them? | **No — they live in `core/adapters`.** `shared` is declarations-only and browser-safe by its own header; an `Adapter` is a function-typed contract over a spawned process. Nothing outside `core` needs it before M3, and `shared` is Q-0041's finished module. `AdapterEvent` is imported *from* shared, which is the direction charter §4 permits. Promoting it later is a move with a caller to justify it; doing it now repeats `projectConfigSchema` — shipped declared and called nowhere (Q-0043). | decided |
| OQ-4 | Does `StepSchema` type-check against what `schemaFor` returns, given `schemaFor` is untyped JavaScript in another ticket? | **It cannot be proved here, and that is the answer.** Type it from the fields `checkAgainstSchema` reads (AC-2), keep it permissive, and let **Q-0052** assert assignability when it ports `schemaFor`. If the implementer finds a field `checkAgainstSchema` reads that `StepSchema` cannot express, that is a stop-and-report, not a widening to `any`. | implementer / Q-0052 |
| OQ-5 | `probeAdapter`'s null-usage crash (fact 4) is a live defect in a command that exists to de-risk paid runs. Fix it? | **No — preserve, pin, report** (AC-11 defect 1). Charter §2 is unambiguous and the reasoning is this ticket's own subject: the spike keeps the old behaviour, so a quiet fix leaves both suites green over a product that disagrees with itself. It deserves its own ticket, proposed as a follow-up in the implement report — reachable today by any adapter reporting no measure, and the class of failure (a check blaming its subject for its own crash) is exactly what Q-0035 was about. | decided |
| OQ-6 | `q0034-probe-schema.js` covers `PROBE_SCHEMA` and `schemaFor` with one helper. Port both halves? | **Port the `PROBE_SCHEMA` half; export the helper; leave `schemaFor`'s half on the spike** (AC-8). Porting a `schemaFor` assertion would mean this ticket importing `spike/src/engine.js`, which §3 and AC-1 both forbid, or duplicating `schemaFor` in `core`, which is Q-0052's module. The deferral is named as deferred in the report, with Q-0052 as its owner — an unnamed gap is the failure this ticket is otherwise about. | decided |
| OQ-7 | The mock's counter is module-scoped and Vitest shares a module across a file (fact 9). Add a reset for tests? | **No.** A test-only export is a behaviour change under §2, and Q-0054 would then have two ways to control the mock. Tests select behaviour with `MOCK_ALWAYS_PASS` / `MOCK_ALWAYS_FAIL` or with distinct role names (AC-10). The constraint is recorded in the module's JSDoc, because Q-0054 inherits it and will otherwise rediscover it as flakiness. | decided |

## Risks

- **`harness/Q-0046/integration` does not exist** (fact 18). Charter §8's first pre-run item is
  unsatisfied, and `chore.yaml`'s `review` step diffs
  `harness/Q-0046/integration...harness/Q-0046/implement` while only `integrate`, which runs later,
  creates the left endpoint. Forgetting it fails the run **after** the implementer has been paid,
  which is how Q-0035 lost $13.86. **Create the branch from `main` before the first run.** This is the
  single highest-value line in this document.
- **The registry narrowing reads as a regression.** A reviewer diffing `getAdapter` against the spike
  sees a registry with one entry and a `known:` list that no longer names the vendors. AC-3 states it,
  pins the format rather than the membership, and assigns restoration to Q-0047 — but the reviewer
  should be pointed at AC-3 before the implementation.
- **Three of the four preserved defects look exactly like bugs to fix**, and one of them
  (`probeAdapter`) is a genuine live defect in a safety command. An implementer who fixes it makes
  AC-11 red and everything else green, which is the shape charter §2 exists to catch. A reviewer
  should read the AC-11 tests before reading the module.
- **The retry classification is testable only through its outcomes**, and the ordering claim in AC-5
  is the part with no natural defender: reordering `TRANSIENT` keeps every boolean assertion green and
  changes only which sentence a user reads. The `429 rate_limit_error` case is the guard, and it is
  one line that a later tidy-up could delete without any other test failing.
- **The mock's shared counter will present as flaky Vitest ordering**, most likely in Q-0054 rather
  than here. Fact 9 is the diagnosis; AC-10 is the discipline; the JSDoc is what carries it forward.
- **Q-0047 lands directly on top of this and depends on it.** Boundary drift in either direction —
  the vendor adapters re-implementing `authError`, or this module acquiring vendor knowledge to make
  Q-0047 easier — defeats the reason `authError` sits at the contract layer. The reviewer should treat
  any vendor name outside a test fixture, other than in `RELOGIN`, as unrequested.
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
- **Register row 1 cannot be closed here** (fact 14), and a reviewer reading §6's invariant column may
  read that as an unmet criterion. AC-11 names the split and assigns the remainder to Q-0047; the
  charter's table is the normative source and this document does not amend it.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | Central, and partly deferred. No code path, test, fixture or example accepts an API key; the module reads no `*_API_KEY` variable, because the refusal lives in Q-0047's two `check()` implementations (fact 14). What this ticket enforces is the other half of the same rule: `probeAdapter` is the only login proof, nothing here calls `check()`, and no path can let presence stand in for a login (AC-9). Row 1's ordering assertion is named as Q-0047's (AC-11). |
| **Worktree safety** | n/a directly. The module spawns nothing and creates no branch or worktree; `probeAdapter`'s temporary directory is `os.tmpdir()`, never the repository, and is removed in `finally`. The mock writes only inside the `cwd` its caller supplies, and every test supplies a `tempDir()`. |
| **Gate behaviour** | n/a — nothing here presents or answers a gate. The chore route's human gate is unchanged. |
| **Files are the database** | Preserved. No persistence is added; the only writes are `probeAdapter`'s disposable sandbox and the mock's caller-scoped artifacts, both already in the spike. |
| **File format and its schema** | No format changes. `PROBE_SCHEMA` is a value Quorum sends a vendor, unchanged. `AdapterUsage`'s five measures come from `shared`'s `USAGE_MEASURES` rather than a second spelling (fact 1), which is the drift the constant was extracted to prevent. |
| **Lint rules** | n/a — no flow lint rule is added, removed or read. TypeScript, ESLint and the package-boundary rules apply to the new folder. |
| **Cross-vendor rule** | n/a — no reviewing or judging step is created or changed. `vendor` is a neutral open label and no field in the union is vendor-conditional (AC-2, register row 22's operative reading). |
| **Containment** | n/a — this module runs no git. Both declared dependencies are `main:contained` (fact 19); this ticket's own integration branch does not yet exist (fact 18). |
| **Cold-clone impact** | Neutral to positive. No new dependency (fact 17), no new command, no new prompt. The one thing an adopter meets on this path is `adapters --probe`'s message quality, which is preserved exactly. |
| **Errors are explicit** | Mostly, and the exceptions are AC-11's. `extractJson` returns `null` rather than an empty object; `checkAgainstSchema` returns every problem it found rather than the first; `authError` and the retry give-up message both say what happened and what to do. Against that, `probeAdapter` can report a crash as an unusable login and `transientError` can retry a deterministic failure — both preserved, both pinned, both in the report. |
| **Product-agnostic** | No SaaS product is named or implied. One wording finding is reported and not fixed: `smoke.js:465` and Q-0047's two `check()` messages call the product "Harness", which `product-boundaries.md` forbids (fact 20). |
