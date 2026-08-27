# Q-0047 — `core/adapters`: the claude and codex adapters

*Requirement candidate, product-manager role, 2026-08-26. Route: **chore** (`requirements → chore →
human gate`). Parent Q-0009; charter `harness/port-charter.md`, §6 row `Q-0047`. Depends on Q-0041
and Q-0046, both verified `main:contained` at the time of writing.*

Every citation below was read against the working tree, not inferred from a ticket body. Where this
document and `harness/port-charter.md` §6 differ, **the charter is right** — except where an erratum
in this ticket's folder supersedes it, and one is proposed here.

---

## Problem

`packages/core/src/adapters/` currently holds the contract layer and the mock. It holds no vendor.
`getAdapter('claude')` throws `unknown adapter "claude" (known: mock)` while the spike answers it —
a transitional divergence Q-0046 shipped deliberately (its AC-3) and named this ticket as the owner
of closing.

Behind that one missing line sit two files that carry more expensive knowledge per line than
anything else in the port. `spike/src/adapters/claude.js` (99 lines, including the shared `exec`)
and `codex.js` (91 lines) are where M0's findings actually live: the flag that stops a developer's
personal `~/.codex/config.toml` outranking a versioned flow file, the parse order that stops a
vendor failure printing as `exited 1:` and nothing, the token arithmetic that stopped a roll-up
under-reporting by three orders of magnitude, and the `stdin` error listener that stopped an expired
login presenting as a `node:events` stack trace. None of that is visible in the shape of the code.
All of it is one plausible simplification away from being lost, and — this is the part that makes it
worth a requirement rather than a translation — **losing it would not turn either suite red.** The
spike stays green because the spike still has the old behaviour; the ported suite stays green
because it was written from the tree that has the new one.

Three specific things are unresolved and this document has to settle them rather than hand them to
a revise loop:

1. **The ticket's one structural change is two changes with different authority.**
   `docs/04-architecture.md:62` asks for a per-adapter `capabilities.ts` *"with a version probe, so
   a CLI update breaks one file"*. Moving flag names and JSONL field names into their own module is
   internal layout, which charter §2 explicitly does not preserve. A version probe is a new CLI
   invocation with a new decision attached — new behaviour, which charter §2 forbids without its own
   decision entry accepted first. Treating the sentence as one unit either blocks the port or
   smuggles a feature into it.
2. **Register row 2 is split the way row 1 was, and nobody has said so yet.** Its first two clauses
   are in this ticket's files. Its third — *"a role's default model never crosses vendors"* — is
   `resolveModel` at `spike/src/engine.js:670`, called only from the agent step at `:205`, which
   charter §6 gives to **Q-0052**. A criterion asking this ticket to assert it would name a file
   this ticket may not write, which is *"A requirement may not name a surface its flow cannot
   write"* (`docs/DECISIONS.md`, 2026-08-25) arriving through a register instead of through a
   backlog path.
3. **This ticket turns a landed, reviewed test red by design.**
   `packages/core/src/adapters/adapters.source.test.ts:53` asserts the folder is exactly
   `['adapters/adapters.ts', 'adapters/mock.ts']`. Adding vendors breaks it. That is correct and
   intended — but an implementer under time pressure closes it by relaxing `toStrictEqual` to
   `toContain`, and the house rule dies silently in the same commit that appears to honour it.

---

## User stories

**`contributor` — the adapter contributor.** *"I am writing a `gemini` adapter. I open `codex.ts`
to copy it, and I want the vendor's vocabulary — its flags, its JSONL field names, its sandbox
values — in one place I can edit, and the logic that uses them in another I can read. When the
codex CLI renames a flag next month, I want exactly one file to have changed."*

**`maintainer` — the solo maintainer.** *"When a run fails, I want the vendor's own sentence, not a
Node stack trace and not `exited 1:` followed by nothing. When it succeeds, I want the token count
to be the real one, so the per-vendor roll-up I read at the end of a ticket is not fiction."*

**`adopter` — the cold-clone adopter.** *"If I have an API key in my environment — because every
other tool I own wants one — I want to be told that, in that sentence, whether or not the CLI is
installed on this machine. I do not want `not installed` while the real problem is that Quorum
would have silently billed my key."*

**Surfaces:** `packages/core` (the library API and its Vitest suite) and `docs/03-adapter-contract.md`.
Not the CLI — `quorum adapters --probe` is Q-0010, and this ticket reaches the real CLIs through an
opt-in test instead (AC-13).

---

## Context the implementer should not re-derive

Read once; every line below was verified against the tree.

**What is already there.** `packages/core/src/adapters/adapters.ts` exports exactly eight runtime
names (`PROBE_SCHEMA`, `authError`, `checkAgainstSchema`, `extractJson`, `getAdapter`,
`probeAdapter`, `transientError`, `withRetry`), pinned by `adapters.source.test.ts:38`. Its
`registry` is a module-private const holding `{ mock: mockAdapter }`, with a JSDoc that names this
ticket as the restorer. `AdapterRunOptions`, `AdapterResult`, `AdapterUsage`, `AdapterError`,
`AdapterConfig`, `RetryPolicy` and `Adapter` are all typed there — **this ticket adds no type to the
contract**, it implements the one that exists.

**What `withRetry` already does, so no adapter does it twice.** Retries, usage accumulation across
attempts, `attempts`, the `retry` event, and the fallback from a call's `vendor` to `usage.vendor`
to `adapter.vendor`. Both vendor adapters declare `vendor` per call, so the fallback is not
exercised by them; that is preserved, not changed.

**The two vendor files, by line.**

| Behaviour | claude | codex |
| --- | --- | --- |
| BYOS refusal, ahead of the probe | `:12` — `ANTHROPIC_API_KEY` only | `:21` — `CODEX_API_KEY` **or** `OPENAI_API_KEY` |
| argv construction | `:21–30` | `:32–51` |
| `spawn` event | `:31`, quoted through `q()` (`:68`) | `:52`, a raw `args.join(' ')` |
| `stdout` event | `:32` | `:60` |
| failure read from **stdout** | `:38–46`, envelope parsed first, `is_error` honoured at exit 0 | `:77–84`, JSONL errors collected at `:70–71`, unwrapped at `:9–12` |
| structured tail | `:47–48`, `structured_output` then `extractJson(result)` | `:85–86`, `-o last.txt` parsed then `extractJson` |
| usage | `:56–66`, cache fields folded into `input_tokens` | `:56–68`, `reasoning_output_tokens` added to output, `cost_usd` always `null` |
| shared `exec` | `:70–99`, including the `EPIPE` listener at `:88–91` | imported from `claude.js` |

**`exec()` is already fixed and must be ported as fixed.** Q-0063 added the `p.stdin` `'error'`
listener; charter §3's table says in as many words: *"Q-0047 must port the **fixed** `exec()`"*. Its
test is `spike/test/q0063-stdin-epipe.js`, four checks, and it is a library-level test of this
ticket's module — charter §1 therefore requires it to land here in Vitest, not to wait for Q-0054.

**`overrideAdapters` (`spike/bin/harness.js:612`) is three lines and two subtleties.** It walks
`flow.steps`, and for each step `s.parallel ?? [s]`, and sets `x.adapter = name` **only where
`x.adapter` is already truthy**. It never visits a `fan_out` step's `step:` template — that path is
covered instead by `ctx.config.adapterOverride` at `engine.js:204`, which the CLI sets on the same
line. Both halves exist for a reason and both are preserved; only the function is this ticket's, the
`ctx.config` half is Q-0052's.

**Where the register lands.** Rows 2, 4 and 22 (charter §2). Row 4 is already split in the register
itself (`Q-0047, Q-0049`): the adapter half is stdout-parsing, the thrown error carrying `usage`,
and cache-inclusive tokens; the roll-up half is Q-0049's. Row 2's split is **not** in the register
and is proposed below.

---

## Proposed erratum E-1 — register row 2's third clause has no home in this ticket's files

*To be committed by hand to `backlog/Q-0047-core-claude-and-codex-adapters/requirements/errata.md`
before the first run, alongside the merged requirement. `backlog/` is not an agent-writable surface
(`spike/src/fanout.js:80–93`), so no run can produce it.*

**Supersedes:** the invariant column of `harness/port-charter.md` §6's `Q-0047` row, so far as it
assigns register row 2 (`§2`, row 2) whole to this ticket. §2's register text is unchanged and the
other children are unaffected.

**Replacement:** row 2 splits into two halves with two owners.

- **Q-0047 owns the adapter half.** `codex` passes `--ignore-user-config` on every invocation, and
  passes `-m` only when the caller names a model; `claude` passes `--model` only when the caller
  names one; neither pins a vendor model name anywhere. Enforced by **AC-4**.
- **Q-0052 owns the cross-vendor half.** *"A role's default model never crosses vendors"* is
  `resolveModel` (`spike/src/engine.js:670`), called only from the agent step (`:205`), which
  charter §6 assigns to Q-0052. Its frozen coverage is `spike/test/smoke.js:620–626`. Q-0052's
  requirement must carry it as a criterion; if that child's cut instead leaves `resolveModel` with
  the run loop, the owner is Q-0050 and the obligation moves with the function.

**Why the charter's assignment does not work as written.** An adapter is handed a `model` string or
nothing. It cannot know which role asked, which vendor the role defaults to, or whether a step
overrode it — that decision has already been taken two layers up. A criterion asking this ticket to
assert the non-leak could only be discharged by writing a test against `engine.js`, which this
ticket may not touch, or by asserting something weaker and calling it row 2.

**What this erratum does not do.** It does not weaken row 2, and reporting the row as *closed* by
this ticket would be the failure the register exists to prevent. The implement report names the
split and names Q-0052 as owner of the untested half — exactly as Q-0046's E-1 required of row 1,
which is the obligation this ticket now discharges under AC-3.

---

## Acceptance criteria

Every criterion is testable with Vitest and stub shell scripts, without a vendor CLI and without
spending anything, **except AC-13**, which is the one thing CI cannot answer.

The stub technique is the spike's own (`smoke.js:157–172`): write a `#!/bin/sh` script into a temp
directory, point `cfg.bin` at it, and have it record `"$@"` to a file and print a canned envelope on
stdout. Every argv, exit-code and parsing criterion below is reachable that way.

### AC-1 — The module lands as six files in `adapters/`, adds no dependency, and prints nothing

`packages/core/src/adapters/` gains exactly:

| File | Exports | Ported from |
| --- | --- | --- |
| `claude.ts` | `claudeAdapter` | `spike/src/adapters/claude.js:1–68` |
| `codex.ts` | `codexAdapter` | `spike/src/adapters/codex.js` |
| `exec.ts` | `exec` | `spike/src/adapters/claude.js:70–99` |
| `claude.capabilities.ts` | one `as const` data object | *(new file, same literals)* |
| `codex.capabilities.ts` | one `as const` data object | *(new file, same literals)* |
| `override.ts` | `overrideAdapters` | `spike/bin/harness.js:612` |

`overrideAdapters` goes in its own file rather than into `adapters.ts` so that Q-0046's pinned
eight-name export list stays true as written. `packages/core/package.json` gains no dependency —
these files reach for `node:child_process`, `node:fs`, `node:os`, `node:path`, `@quorum/shared` and
each other, and nothing else. No file in the module writes to stdout or stderr, or contains an ANSI
escape: rendering belongs to the CLI (charter §7). Every exported symbol, interface field and
non-obvious parameter carries JSDoc (`harness/rules.md`); no `any`, no `@ts-ignore` without a
same-line reason.

*Test:* a source-level test in the style of `adapters.source.test.ts`, reading through
`coreSourceFiles()` (`packages/core/test/corpus.ts`), asserting the exact file list, the exact
export list per file, the absence of `console.` and of ``, and that `packages/core/src/index.ts`
is still byte-for-byte `export const name = '@quorum/core';\n`.

### AC-2 — The registry regains its two entries, in the spike's key order, and Q-0046's folder assertion is updated rather than weakened

`getAdapter('claude')` and `getAdapter('codex')` each return a `RetryingAdapter` whose `vendor` is
that name, configured from the matching `harness.yaml` entry (`bin`, `extraArgs`, `retry`). The
registry's key order is **`claude, codex, mock`**, matching `spike/src/adapters/index.js:25`, so the
unknown-adapter message is exactly:

```
unknown adapter "gemini" (known: claude, codex, mock)
```

The `registry` JSDoc in `adapters.ts` — which currently describes the mock-only registry as a
transitional divergence and points here — is rewritten to describe what it now is. No other line of
`adapters.ts` changes.

`adapters.source.test.ts:53` ("the folder is two files, and neither is a barrel") is updated to the
new **exact** list from AC-1. It stays a `toStrictEqual` over a sorted array. Relaxing it to
`toContain`, to a length check, or to a filter is a blocker: the assertion's whole value is that a
seventh file cannot arrive unnoticed.

*Test:* both resolutions; the message string verbatim for an unknown name; the updated folder
assertion failing when a file is added to the fixture.

### AC-3 — The BYOS refusal fires before the CLI is probed, per adapter, and still fires when the executable is missing *(register row 1, Q-0047's half — Q-0046 erratum E-1)*

Four properties, and the second and third are the ones that make it a real criterion rather than a
restatement:

1. **The refusal happens.** `claudeAdapter().check()` rejects when `ANTHROPIC_API_KEY` is set, with
   the message `ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only`.
   `codexAdapter().check()` rejects when `CODEX_API_KEY` **or** `OPENAI_API_KEY` is set, with
   `CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only`.
   *(On the product name in those two strings, see AC-12 and OQ-2 — it is preserved here.)*
2. **The asymmetry is preserved.** `claude` does **not** refuse on `OPENAI_API_KEY` or
   `CODEX_API_KEY`; `codex` does **not** refuse on `ANTHROPIC_API_KEY`. A test asserting all three
   names against one adapter is asserting a behaviour change and must not be written. "All three
   variable names" is a property of the pair, not of either.
3. **It fires *before* the probe, provably.** Point `cfg.bin` at a stub that writes a sentinel file
   and exits 0. With the key set, `check()` rejects with the message from (1) **and the sentinel does
   not exist**. Asserting only the message would pass against a rewrite that probes first — which is
   charter §2's stated reason for the row: *"a rewrite that probes first and refuses second passes
   every test that checks only the refusal."*
4. **A missing executable does not mask it.** With `cfg.bin` pointing at a path that does not exist
   and the key set, the rejection is still (1)'s message — never `CLI not runnable`. With the key
   unset and the same missing bin, it is `claude CLI not runnable: …` / `codex CLI not runnable: …`,
   carrying whatever the spawn failure reported.

On success `check()` resolves to the trimmed first line of the CLI's `--version` output, and makes
no authenticated request (the contract's JSDoc already says so and stays true).

*Test:* all four, both adapters, with the environment restored after each case.

### AC-4 — argv is built from the per-adapter capabilities module and is byte-identical to the spike *(register row 2, adapter half — E-1)*

Both adapters build their argument list from their capabilities module. **The resulting array is
identical, element for element and in order, to what the spike passes**, for every combination of
`allowWrite`, `model` present or absent, zero or several `extraDirs`, and configured `extraArgs`:

```
claude: -p --output-format json --json-schema <json> --permission-mode acceptEdits|plan
        [--model <m>] [--add-dir <d>]… [<extraArgs>…]

codex:  exec --json --output-schema <tmp>/schema.json -o <tmp>/last.txt -C <cwd>
        --sandbox workspace-write|read-only --skip-git-repo-check --ephemeral
        --ignore-user-config [-m <m>] [--add-dir <d>]… [<extraArgs>…] -
```

`--ignore-user-config` is unconditional. `-m` and `--model` appear **only** when the caller passed a
model; no vendor model alias is a default, a fallback or a literal anywhere in the module. Codex's
trailing `-` stays last, after `extraArgs`. Codex's temp directory keeps the prefix
`harness-codex-` verbatim (`codex.js:27`) — it is a folder name, not a product name, and it is not
the wording finding.

**What "capabilities" means here, and what it does not.** Each capabilities module is one `as const`
data object holding the vendor's vocabulary and nothing else: the default `bin`, the version-probe
argv, every flag token, every enumerated flag value (`acceptEdits`, `plan`, `workspace-write`,
`read-only`), and every field name read out of the vendor's envelope or JSONL. It has no functions,
no I/O and no branching. **The two modules do not share an interface** — claude returns one JSON
envelope and codex streams JSONL, so a common type would describe neither; `docs/04-architecture.md:62`
designs `gemini` as a copy-and-edit of `codex`, which is the intended reuse and does not need one.

*Test:* argv equality against literal expected arrays, for both adapters across the combinations
above; plus a source-level assertion that no argv token literal (a string beginning with `-`) and no
vendor field-name literal appears in `claude.ts` or `codex.ts` — they appear in the capabilities
modules and nowhere else, which is the only thing that makes *"a CLI update breaks one file"* true.

### AC-5 — Failure is read from stdout, translated, and carries what it cost *(register row 4, adapter half)*

Both vendors report failures on stdout. Preserved exactly:

- **claude** parses the envelope *before* deciding. It fails when `r.code !== 0` **or**
  `env.is_error === true` at exit 0. The detail is `env.result`, else `env.error.message`, else
  `env.subtype`, else the last 2000 characters of `stderr` + `stdout`, else the literal
  `no output on stderr or stdout` when both are whitespace-only. The message is
  `claude failed (exit <n>[, <subtype>]): <detail truncated to 2000>`.
- **codex** collects error text while streaming — `type: 'error'`, `type: 'turn.failed'`, and
  `item.type === 'error'` — unwraps the vendor's JSON nested inside `message`, de-duplicates, and
  joins with `; `. The message is `codex exited <n>: <reported | tail | no output on stderr or stdout>`.
- **Both** consult `authError(vendor, stderr + stdout)` first and use its one actionable sentence
  when it recognises the failure.
- **Both** attach `usage` to the thrown error, so `withRetry` can count an attempt the vendor
  already billed. Codex's usage object exists from before the spawn, so a stream that dies
  mid-turn still reports what it had.
- **Codex removes its temp directory on the failure path too** (`codex.js:78`).

*Test:* stubs producing each shape — exit 1 with an empty stdout; exit 0 with `is_error: true`; an
envelope carrying `total_cost_usd` (the failed-cost case, `smoke.js:172` asserts `4.54`); a codex
JSONL error with a nested vendor JSON message; an expired-refresh-token string that must come back
as `codex logout && codex login`; a compile error that must **not**. Assert the temp directory is
gone in every codex case.

### AC-6 — Tokens are cache-inclusive on claude and reasoning-inclusive on codex; codex cost is always `null`

`usageOf` (`claude.js:56–66`) is ported unchanged: `input_tokens` is
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, each missing field counting
zero; `cached_input_tokens` is the read count, `cache_write_input_tokens` the creation count;
`cost_usd` is `total_cost_usd`. When the envelope carries no `usage` at all, every token measure is
`null` — not zero.

Codex accumulates from the JSONL stream, reading `usage` at `ev.usage`, `ev.payload.usage` or
`ev.item.usage`; `output_tokens` is `output_tokens + reasoning_output_tokens`, preserving the
existing `|| usage.output_tokens` fallback verbatim; `cost_usd` is `null` on every path, and no rate
table exists anywhere in the module (*"Codex cost is reported as tokens, never priced locally"*,
2026-08-22). `session` comes from `thread_id`, `session_id` or `payload.thread_id` on claude's
`session_id` equivalent. Lines that are not JSON are ignored without failing the run.

*Test:* the exact 0.149.0 envelope from `docs/03-adapter-contract.md`
(`input_tokens: 13970, cached_input_tokens: 9984, output_tokens: 6, reasoning_output_tokens: 0`)
and a claude envelope reproducing the M0 probe (65 uncached against 74264 total). Assert `cost_usd`
is `null` for codex and never `0`.

### AC-7 — The structured tail comes from the vendor's own channel first, and the fallback is `extractJson`

claude prefers `env.structured_output`, falling back to `extractJson(env.result ?? stdout)`; `raw`
is `env.result ?? stdout`. codex reads `<tmp>/last.txt` when it exists, `JSON.parse` first and
`extractJson` second, falling back to `stdout` when the file is absent; `raw` is that text. Neither
adapter validates — `checkAgainstSchema` is the engine's call, and `extractJson` is the only place
vendor-wrapping tolerance lives (register row 13). Neither repairs a value or substitutes a default:
an unparseable answer yields `null`, which becomes an explicit stop upstream (register row 21).
Both return `{ vendor, output, raw, usage, session, ms }` and nothing else.

*Test:* structured output present; absent with a fenced JSON block in the text; absent with nothing
parseable (expect `null`); codex with `last.txt` present, malformed, and missing.

### AC-8 — `exec()` ports as fixed by Q-0063, with its test

The `p.stdin` `'error'` listener is present. `EPIPE` appends
`[quorum] the CLI closed its input before the prompt was fully written` to `stderr` and lets
`'close'` resolve, so the **child's exit code stays the authority**; any other stdin error resolves
`{ code: -1 }` with the error text. A spawn failure resolves `{ code: -1, stderr: String(e) }`. Line
splitting delivers each complete line to `onLine`, and flushes a trailing partial line on close.

`spike/test/q0063-stdin-epipe.js`'s four checks land as Vitest here — a 512 KB stdin against stubs
that exit 0 without reading, exit 7 without reading, exit 3 (the truncation notice), and one that
reads the whole prompt (`wc -c`). The spike file is not edited, deleted or re-pointed (§3).

### AC-9 — Both adapters emit only `spawn` and `stdout`, typed as `shared`'s `AdapterEvent`, and their asymmetry is preserved *(register row 22)*

`onEvent` is typed `(event: AdapterEvent) => void` from `@quorum/shared`, so an adapter cannot emit
a kind the one event format does not describe. Each adapter emits `{type:'spawn', vendor, cmd}` once
before spawning and `{type:'stdout', line}` per line. Neither emits `retry` — that is `withRetry`'s.
No `tool` or `text` event is invented (`packages/shared/src/events.ts` records why at length).

**The two `cmd` strings are built differently and stay that way:** claude maps every argument through
`q()` (`claude.js:68` — single-quote wrap when the argument contains whitespace or a quote, inner
quotes escaped, truncated to 80 characters with `…`), codex joins raw (`codex.js:52`). Unifying them
is a behaviour change to what a run prints. `q()` moves with `claude.ts` and stays module-private.

*Test:* the emitted sequence and kinds for both adapters; a schema argument long enough to exercise
`q()`'s truncation; a codex `cmd` containing an unquoted path, asserted unquoted.

### AC-10 — `overrideAdapters` lifts from the CLI with both of its blind spots intact

`overrideAdapters(flow, name)` walks `flow.steps`, and within each step `parallel ?? [step]`, setting
`adapter = name` **only where the step already declares one**. A step with no `adapter` key is left
without one, so the engine's own `step.adapter ?? role.meta.adapter ?? 'claude'` chain still applies.
A `fan_out` step's `step:` template is **not** visited — the fan-out is reached instead by
`ctx.config.adapterOverride` (`engine.js:204`), which the CLI sets on the same line and which is
Q-0052's to port. The function mutates the flow object in place and returns nothing.

This is the same shape as register row 12's warning about `flattenSteps` and a `fan_out` template.
It is preserved, and it is named in the implement report so Q-0052's reviewer knows where the other
half is.

*Test:* a flow fixture with a plain step, a `parallel` group, a step declaring no adapter, and a
`fan_out` step whose template declares one — asserting exactly which of them changed.

### AC-11 — The port is checked against `docs/03-adapter-contract.md`, and a divergence is fixed on the doc side only

Every flag and field name in the two capabilities modules is checked against the invocation blocks
and the verification table in `docs/03-adapter-contract.md`. **Where the document is wrong, the
document is fixed in this change** (`harness/rules.md`, *"when code and docs disagree, the docs are
wrong until a DECISIONS entry says otherwise"*), with its status line bumped. **Where the code looks
wrong, nothing is fixed** — it is a stop-and-report under charter §2.

One divergence is already known and is not a licence to look for more: the codex invocation block
omits `--add-dir <dir>`, which the adapter passes for every `extraDirs` entry (`codex.js:49`) and
which the verification table two sections later lists as *verified present*. The block gains it.

*Test:* the doc edit is in the diff; a source-level assertion that every flag literal in each
capabilities module appears in `docs/03-adapter-contract.md`, so the two cannot drift apart again
without a test failing.

### AC-12 — The module's unit tests land with it, the frozen suite is untouched, and every stop-and-report is named

Vitest coverage for the criteria above lands in `packages/core/src/adapters/`, written fresh against
the ported code rather than transcribed from the spike's runner, so chore's `integrate` examines what
this run produced (charter §1). It covers, at minimum, the subjects the frozen suites cover:
`smoke.js:104–106` (the BYOS refusal through the CLI), `:152–178` (claude's stdout failure paths and
failed-step cost), and `q0063-stdin-epipe.js` in full. **No file under `spike/` is edited, deleted or
re-pointed** (§3).

`dev/implement-report.md` names, each with its file and line:

1. **The proposed erratum E-1 above**, and Q-0052 as owner of row 2's untested half. Reporting row 2
   as closed here is the failure the register exists to prevent.
2. **Row 1's Q-0047 half is discharged by AC-3**, completing the split Q-0046's E-1 opened. Row 4's
   adapter half is discharged by AC-5 and AC-6; its roll-up half remains Q-0049's.
3. **The wording finding, preserved.** `claude.js:12`, `codex.js:21` and the frozen fixture at
   `smoke.js:465` call the product *"Harness"*, which `.claude/rules/product-boundaries.md` forbids.
   The ported strings are byte-identical and pinned by AC-3's test. See OQ-2.
4. **Q-0066 is not fixed here.** `probeAdapter` dereferences a `null` usage and reports an adapter's
   own `TypeError` as `login not usable`. Both shipped vendors do report usage, so AC-13's probe is
   unaffected — but the fix must land in `spike` and `packages/core` together or the port loses its
   independent witness, which is Q-0066's whole point.
5. **`docs/03-adapter-contract.md`'s open question 4** — whether `--permission-mode plan` still lets
   claude read the repo and its `--add-dir` folders — is still open. See OQ-5.

Anything else found while porting is recorded with the exact fixture, the actual output and the
expected authority, and the implementer **stops**. It does not narrow a regex, add a guard, unify
the two `cmd` builders, rename the temp prefix, add an export to `packages/shared`, or edit a
contract, ticket or doc beyond AC-11's divergence. A reviewer may treat an unregistered behaviour
change as a blocker by citing *"The port preserves behaviour"* (2026-08-25) without arguing its
merits.

### AC-13 — Real-CLI evidence exists, is opt-in, and reports itself as skipped rather than passed

CI cannot log in to a subscription, and this ticket's two files are the only ones in the port whose
acceptance evidence cannot come from CI (`docs/04-architecture.md:64–67`). So:

- A single test file — `adapters/real-cli.probe.test.ts` — runs `probeAdapter(getAdapter('claude'))`
  and `probeAdapter(getAdapter('codex'))` against **the ported adapters**, in a temp directory, and
  asserts `ok === true`, a non-null `session`, a positive `tokens`, and — for claude only — a
  non-null `cost_usd`.
- It is guarded by `describe.skipIf(!process.env.QUORUM_REAL_CLI)`, so a default `pnpm test` reports
  it **skipped**, never passed. *"A check that skips its subject must not report success"*
  (2026-08-25) applies to this file most of all: it is the only proof of the thing CI cannot see.
- The file's JSDoc states the one command that runs it and warns that it costs roughly $0.39 on
  claude even in an empty directory (M0's measurement), and that it uses the CLI's own login —
  no key, ever.
- **The human runs it once at the gate**, on the merged branch, and pastes both lines into
  `dev/integration.md`. The run is the acceptance evidence for AC-4 through AC-7 against a real CLI;
  everything before it is stubs.

---

## Before the first run — three actions, all by hand, all costly to forget

1. **Create `harness/Q-0047/integration` from `main`.** Verified absent: `git rev-parse --verify
   harness/Q-0047/integration` fails. `chore.yaml`'s `review` step diffs
   `harness/Q-0047/integration...harness/Q-0047/implement`, and only `integrate` — which runs later —
   creates the left endpoint. Forgetting it fails the run **after** the implementer has been paid,
   which is how Q-0035 lost $13.86. This is the highest-value line in this document.
2. **Commit erratum E-1** to `requirements/errata.md` beside the merged requirement. `backlog/` is
   not an agent-writable surface, so no run can produce it, and a reviewer citing charter §6's row-2
   assignment against AC-4 would otherwise be right.
3. **Pass no more `--gate-answer` values than you would authorise blind.** They are consumed in
   order by whichever gate arrives first, and an engine-presented exhaustion gate is a gate.

Both declared dependencies are satisfied (§5 clause 5): `harness/Q-0041/integration` and
`harness/Q-0046/integration` are each `main:contained`, verified with `git merge-base --is-ancestor`.

---

## Non-goals

- **A version probe of either CLI.** New behaviour; see OQ-1 and the proposed follow-up.
- **`tool` and `text` events**, or any parsing of vendor JSONL into normalised events. It would
  change what `--verbose` prints; `packages/shared/src/events.ts` records the refusal in full.
- **Fixing Q-0066**, narrowing `transientError`'s bare status-code alternation, or any of the other
  defects Q-0046 preserved. They are pinned in `adapters.ts` and stay pinned.
- **Changing the "Harness" wording** without the erratum or decision entry OQ-2 asks for.
- **`resolveModel` and `ctx.config.adapterOverride`** — Q-0052 (E-1).
- **Any edit under `spike/`** (charter §3), including `spike/test/smoke.js:465`.
- **The `quorum` binary and the `adapters --probe` command** — Q-0010. This ticket ships a library
  and one opt-in test, not a command.
- **`packages/shared`** — no export is added to it.
- **Another child's module**, the cutover, persisting the event stream, and everything on v1's
  exclusion list (multi-user, remote daemon, cloud sync, plugin marketplace, visual node canvas,
  eval suites, the Gemini adapter, the desktop shell).

---

## Open questions

**OQ-1 — Does the version probe land here, or become its own ticket? *(blocker — it decides whether
this is a port or a port plus a feature)*** · Owner: Ruud, at the requirements gate.
`docs/04-architecture.md:62` asks for a per-adapter `capabilities.ts` *"with a version probe"*. The
extraction half is authorised — charter §2 says internal file layout and module boundaries are
explicitly not preserved — and AC-4 covers it with a byte-identical-argv proof. The probe half is
not: it adds a CLI invocation, needs a supported-version range that will go stale, and needs a
decision about what happens when the version is unknown or unsupported (warn? refuse? which
surface?). Every one of those is behaviour, and charter §2's route for behaviour is a decision entry
accepted *before* implementation. **Recommendation: defer**, with the capabilities modules carrying
the version-probe argv as data so the follow-up is a small ticket rather than a re-cut. Proposed
follow-up id **Q-0067** (Q-0066 is the highest currently open), to run after Q-0010 gives it a
surface to report on. If the gate decides otherwise, the probe is an added criterion agreed at the
gate, not something the implementer infers from the architecture sentence.

**OQ-2 — Is the "Harness" wording fixed now, or preserved and carried?** · Owner: Ruud, at the
requirements gate. The two refusal messages call the product *"Harness"*, which
`.claude/rules/product-boundaries.md` forbids. This ticket owns both files and is the first that
*may* fix it — but the message text is what a command prints, which charter §2 lists as externally
observable, and the frozen fixture at `smoke.js:465` asserts it. **Recommendation: preserve, pin and
report**, and fix both trees in one ticket the way Q-0066 is scoped — *"the fix must land in `spike`
and `packages/core` together or the port loses its independent witness."* The alternative, an
erratum authorising the change here, leaves the spike saying one thing and core another until the
cutover, which is precisely the divergence the freeze exists to make visible. AC-3 and AC-12 are
written for the recommendation; the erratum route would change AC-3's expected strings and needs to
be settled before the run, not in review.

**OQ-3 — `claude.capabilities.ts` beside `claude.ts`, or `claude/capabilities.ts` nested?** ·
Owner: implementer, unless the gate says otherwise. **Recommendation: flat**, so
`docs/04-architecture.md:44`'s "one folder per module" stays literally true and the corpus keys stay
one level deep. Stated here so a reviewer does not spend a round on it.

**OQ-4 — Is `overrideAdapters` the right name and the right home?** · Owner: implementer.
**Recommendation: keep the name** (charter §7 calls it *"adapter override resolution"* and the spike
calls it this) and put it in `adapters/override.ts`, so `adapters.ts`'s pinned export list is
untouched. Its engine-side companion stays Q-0052's.

**OQ-5 — Answer `03-adapter-contract.md`'s open question 4 during AC-13's probe?** · Owner: Ruud.
Whether `--permission-mode plan` still lets claude read the repo and its `--add-dir` folders is the
last unanswered question in that document, and the probe is the only moment a real CLI runs.
**Recommendation: leave it open.** Answering it needs a read-only step over a real repository rather
than a hello-world round-trip, it is equally a question about the spike, and folding it in makes
AC-13 a second experiment. If the human wants it, it is a note in `dev/integration.md`, not a
criterion.

**OQ-6 — Should `exec` be exported from the package root?** · Owner: implementer.
**Recommendation: no.** It is exported from `adapters/exec.ts` for its own test and for `codex.ts`;
`packages/core/src/index.ts` is byte-pinned by Q-0041 and this ticket does not touch it.

---

## Risks

**The capabilities extraction is the one place the port is not a translation, and a reviewer will
read it that way.** Mitigated by AC-4's byte-identical-argv assertion and by the source-level rule
that no argv token literal survives in the adapter file — together they make the extraction provable
rather than argued. Residual risk: an implementer who over-abstracts into a shared interface across
two genuinely different vendor shapes. AC-4 forbids it in as many words.

**A landed, reviewed test goes red by design.** `adapters.source.test.ts:53` must change. The
failure mode is not that it breaks, it is that it gets weakened to `toContain` in the same commit
that appears to honour it — after which a seventh file arrives unnoticed forever. AC-2 makes the
exact-list requirement a criterion so a reviewer has something to cite.

**No CI evidence for the real CLIs.** AC-13's opt-in test is the only proof, it costs about $0.39 on
claude, and it depends on the human running it at the gate. If it is skipped there, the ticket ships
two adapters proven only against shell stubs — which is genuinely most of the way, and is not the
same thing.

**A quiet fix leaves both suites green over a wrong product.** The standing hazard of the whole port
(charter §2). This ticket carries more temptation than most: `probeAdapter`'s `TypeError`, the two
inconsistent `cmd` builders, the product name in the refusal, and codex's `|| usage.output_tokens`
fallback all look like tidy-ups. AC-12 lists each one as a report rather than a change.

**Register row 2 closes while looking closed.** If E-1 is not committed, either the implementer
asserts something weaker and calls it row 2, or a reviewer blocks correctly and the loop cannot
close it — the shape of *"A requirement may not name a surface its flow cannot write"*.

**The first run fails after paying the implementer** if `harness/Q-0047/integration` is not created
by hand. Verified absent today.

**Cost.** Measured chore children ran $26.81 (Q-0036) and $36.66 (Q-0035); Q-0046, this ticket's
closest sibling, is the fair comparator. Six files and thirteen criteria put this at the upper end.
Charter §9's checkpoint rule applies: more than three chore runs to reach `reviewed` means the child
was cut wrong, not that it needs a fourth.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | The subject of AC-3. No code path, test, fixture or doc line in this change accepts an API key; the two refusals are the product's hard promise and their ordering is what AC-3 exists to prove. AC-13's probe runs on the CLI's own login. |
| **Worktree safety** | n/a to the module — no adapter writes outside the `cwd` it is handed. `allowWrite` maps to `--permission-mode`/`--sandbox` and is set by the engine, not here. Codex's temp directory is under `os.tmpdir()` and removed on both paths. |
| **Gate behaviour** | n/a. This ticket adds no gate and reads none. The chore flow's own final gate must be answered by a human, or `finish()` rolls back a proven-green merge (Q-0040). |
| **File format and schema** | No new persisted format. `AdapterUsage`, `AdapterResult` and `AdapterEvent` are `shared`'s and Q-0046's; this ticket adds no type to the contract and no export to `packages/shared`. |
| **Lint rules** | No flow-lint rule changes. ESLint and `tsc --noEmit` strict must pass across the workspace. |
| **Cold-clone impact** | Neutral by design, and OQ-1 is where it could stop being: a version probe would add a CLI spawn to a path a newcomer hits in their first 30 minutes, which needs a reason. Deferring it keeps the first-run path exactly as long as it is today. |
| **Product-agnostic** | No SaaS product is named. The one product-naming defect in scope is preserved and reported (OQ-2). |
| **Freeze** | Nothing under `spike/` is touched. CI's `port freeze (branch scope)` job covers `harness/Q-0047/*`. |

---

## Provenance

Written against the working tree on 2026-08-26. Verified while writing: `spike/src/adapters/claude.js`
and `codex.js` line by line; `packages/core/src/adapters/adapters.ts` and `adapters.source.test.ts`;
`packages/core/test/corpus.ts` (recursive since Q-0064); `packages/shared/src/events.ts` and
`index.ts`; `harness/port-charter.md` §§1–9; `backlog/Q-0046-…/requirements/errata.md` E-1 and
`merged.md` AC-11–AC-12; `docs/03-adapter-contract.md` in full; `docs/04-architecture.md:42–67`;
`spike/bin/harness.js:468–486` and `:612`; `spike/src/engine.js:204–206` and `:666–673`;
`spike/test/q0063-stdin-epipe.js` and `smoke.js:104–106, 137–178, 620–626`.

Dependency containment checked with `git merge-base --is-ancestor`: `harness/Q-0041/integration` and
`harness/Q-0046/integration` are both contained in `main`. `harness/Q-0047/integration` does not
exist.

Decisions this document leans on, by title and date: *The port takes the chore route, except the one
child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is
authorised and everything else stops the child* (2026-08-25) · *A requirement may not name a surface
its flow cannot write* (2026-08-25) · *Q-0035 accepted: a check that skips its subject must not
report success* (2026-08-25) · *Flows never pin a vendor model name; codex runs with
`--ignore-user-config`* (2026-08-22) · *check() proves presence; only `adapters --probe` proves
login* (2026-08-22) · *Codex cost is reported as tokens, never priced locally* (2026-08-22) ·
*Step-output validation is Quorum's contract with its own agents* (2026-08-22) · *The event union is
derived from what the product emits* (2026-08-25) · *`core` is organised in folders named after the
port's children* (2026-08-26).
