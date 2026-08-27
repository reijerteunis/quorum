markdown
# Q-0047 — `core/adapters`: the claude and codex adapters

*Merged requirement, head-of-product, 2026-08-26. Route: **chore** (`requirements → chore → human
gate`), per "The port takes the chore route, except the one child that has new behaviour"
(`docs/DECISIONS.md`, 2026-08-25). Parent Q-0009; charter `harness/port-charter.md`, §6 row
`Q-0047` (`:315`). Depends on Q-0041 and Q-0046, both verified `main:contained`.*

Every citation below was re-read against the working tree while merging. Where this document and
`harness/port-charter.md` differ, **the charter is right** — except where the erratum in §"Before
the first run" supersedes it for one named clause.

---

## Before the first run — three actions, by hand, none of which a run can perform

**This section is first because forgetting any of it costs money after the implementer has been
paid.** `backlog/` is not an agent-writable surface: `commitAll` runs `git checkout -- backlog` and
`git clean -qfd -- backlog` before every agent step commits (`spike/src/fanout.js:80–93`).

1. **Create `harness/Q-0047/integration` from `main`.** Verified absent —
   `git rev-parse --verify harness/Q-0047/integration` fails today. `chore.yaml`'s `review` step
   diffs `harness/Q-0047/integration...harness/Q-0047/implement`, and only `integrate`, which runs
   later, creates the left endpoint. Forgetting it fails the run **after** the implementer has run,
   which is exactly how Q-0035 lost $13.86.

2. **Commit erratum E-1** below, verbatim, to
   `backlog/Q-0047-core-claude-and-codex-adapters/requirements/errata.md`. Without it a reviewer
   citing charter §6's row-2 assignment against AC-4 is **correct**, and the revise loop cannot
   close a criterion whose only possible fix lies in a file this ticket may not write — the shape of
   "A requirement may not name a surface its flow cannot write" (2026-08-25), which cost Q-0009
   $23.25 to establish.

3. **Paste the Q-0052 block** below into `backlog/Q-0052-…/ticket.md`. An obligation handed forward
   in an implement report and nowhere else does not survive: reports are not read again after the
   gate. Row 2's third clause dies with this ticket unless it is written into the body of the ticket
   that inherits it.

Also: **pass no more `--gate-answer` values than you would authorise blind.** They are consumed in
order by whichever gate arrives first, and an engine-presented exhaustion gate is a gate.

### Erratum E-1 — 2026-08-26 — register row 2 is split; Q-0052 owns the cross-vendor clause

> **Supersedes:** the invariant column of `harness/port-charter.md` §6's **Q-0047** row (`:315`), so
> far as it assigns register row 2 (`:128`) whole to this ticket, and the same list as restated in
> `backlog/Q-0047-core-claude-and-codex-adapters/ticket.md`. §2's register text at `:128` is
> unchanged, and the other thirteen children are unaffected.
>
> **Replacement:** row 2 splits into two halves with two owners.
>
> - **Q-0047 owns the adapter half.** `codex` passes `--ignore-user-config` on every invocation and
>   passes `-m` only when the caller names a model; `claude` passes `--model` only when the caller
>   names one; neither pins a vendor model name anywhere, as a default, a fallback or a literal.
>   Enforced by **AC-4**.
> - **Q-0052 owns the cross-vendor half.** *"A role's default model never crosses vendors"* is
>   `resolveModel` (`spike/src/engine.js:670`), called from exactly one place — the agent step at
>   `spike/src/engine.js:207` — which charter §6 (`:320`) assigns to **Q-0052**. Its frozen coverage
>   is `spike/test/smoke.js:620–626`. If Q-0052's cut instead leaves `resolveModel` with the run
>   loop, the owner is Q-0050 and the obligation moves with the function.
>
> **Why the charter's assignment does not work as written.** An adapter receives a `model` string or
> nothing. It cannot know which role asked, which vendor that role defaults to, or whether the step
> overrode it — the decision has already been taken two layers up, in a file this ticket may not
> write. A criterion asking Q-0047 to assert the non-leak could be discharged only by testing
> `engine.js`, or by asserting something weaker and calling it row 2.
>
> **What this erratum does not do.** It does not weaken row 2. Reporting the row as *closed* by this
> ticket is the failure the register exists to prevent; the implement report names the split and
> names Q-0052 as owner of the untested half — the same obligation Q-0046's E-1 placed on this
> ticket for row 1, which AC-3 now discharges.

### Block to paste into Q-0052's ticket body

> **Inherited from Q-0047 (erratum E-1, 2026-08-26).** Register row 2's third clause — *"a role's
> default model never crosses vendors"* — is **Q-0052's**, not Q-0047's. It is `resolveModel`
> (`spike/src/engine.js:670`), called only from the agent step (`:207`), which this ticket ports.
> Q-0052's requirement must carry it as a criterion: the step's own `model` always wins; a role's
> default is inherited **only** when `role.meta.adapter` equals the resolved adapter name; otherwise
> no model is passed at all, so the CLI picks one its own login supports. A `model: opus` reached a
> codex step once already (Q-0001). Frozen coverage: `spike/test/smoke.js:620–626`. If this ticket's
> cut leaves `resolveModel` with the run loop, the obligation moves to Q-0050 with the function.

---

## Problem

`packages/core/src/adapters/` holds the contract layer and the mock. It holds no vendor.
`getAdapter('claude')` throws `unknown adapter "claude" (known: mock)` while the spike answers it —
the one transitional divergence Q-0046 shipped deliberately (its AC-3), whose own JSDoc at
`packages/core/src/adapters/adapters.ts:249–254` names this ticket as the restorer.

Behind that missing line sit two files carrying more expensive knowledge per line than anything else
in the port. `spike/src/adapters/claude.js` (94 lines, including the shared `exec`) and `codex.js`
(91 lines) are where M0's findings actually live: the flag that stops a developer's personal
`~/.codex/config.toml` outranking a versioned flow file; the parse-before-decide order that stops a
vendor failure printing as `exited 1:` and nothing; the token arithmetic that stopped a roll-up
under-reporting by three orders of magnitude; the `usage` attached to a thrown error that stopped one
crashed review hiding $4.54 of a $10.25 run; and the `stdin` error listener Q-0063 added last night,
which stops an expired login presenting as a `node:events` stack trace.

None of that is visible in the shape of the code, all of it is one plausible simplification away
from being lost, and — the reason this is a requirement rather than a translation — **losing it
would not turn either suite red.** The spike stays green because the spike still has the old
behaviour; the ported suite stays green because it was written from the tree that has the new one.
That is the standing hazard of the whole port (charter §2), and this child carries more of it than
its siblings.

Three things are unresolved and this document settles them rather than handing them to a revise
loop; a fourth is settled by the erratum above.

1. **The ticket's "one structural change" is two changes with different authority.**
   `docs/04-architecture.md` (§Adapters) asks for a per-adapter `capabilities.ts` *"with a version
   probe, so a CLI update breaks one file"*. Moving flag names and JSONL field names into their own
   module is internal layout, which charter §2 explicitly does **not** preserve. A version probe is
   a new CLI invocation with a new decision attached — new behaviour, which charter §2 routes
   through a decision entry accepted **before** implementation. Treating the sentence as one unit
   either blocks the port or smuggles a feature into it. Settled at this gate: **extract, do not
   probe** (§"Questions settled here", Q-1).

2. **This ticket turns landed, reviewed assertions red by design, in three places, and only one is
   obvious.** `packages/core/src/adapters/adapters.source.test.ts:52` pins the folder to exactly
   `['adapters/adapters.ts', 'adapters/mock.ts']`. Less obviously, `:75` allows only `node:fs`,
   `node:os`, `node:path` and `@quorum/shared` as import specifiers — **`node:child_process` is not
   on it**, and `exec.ts` cannot spawn without it. And `:78`'s regex `/^\.\/[a-z-]+\.js$/` rejects
   `./claude.capabilities.js` while accepting `./claude-capabilities.js`. Neither candidate found
   the last two. AC-1 and AC-2 make all three explicit, because the failure mode is not that a test
   breaks — it is that it gets relaxed to `toContain` in the same commit that appears to honour it,
   after which a ninth file arrives unnoticed forever.

3. **The real-CLI evidence has no CLI to run it from.** `docs/04-architecture.md` (§Testing
   strategy) names `quorum adapters --probe` as the acceptance route, and that command is Q-0010's.
   Settled at this gate: Q-0046's `probeAdapter` is already in `core` and is the same code path
   minus rendering, so an opt-in Vitest file calls it directly (Q-3, AC-13).

---

## User stories

**`maintainer` — the solo maintainer.** *"When a run fails I want the vendor's own sentence, not a
Node stack trace and not `exited 1:` followed by nothing. When it succeeds I want the token count to
be the real one, so the per-vendor roll-up I read at the end of a ticket is not fiction. And I want
a versioned flow file to decide what runs, not whatever is in my `~/.codex/config.toml`."*

**`adopter` — the cold-clone adopter.** *"If I have an API key in my environment — because every
other tool I own wants one — I want to be told that, in that sentence, whether or not the CLI is
installed on this machine. I do not want `not installed` while the real problem is that Quorum would
otherwise have billed my key."*

**`contributor` — the adapter contributor.** *"I am writing a `gemini` adapter and I open `codex.ts`
to copy it. I want the vendor's vocabulary — its flags, its enumerated values, its JSONL field names
— in one file I can read top to bottom, and the logic that uses them in another. When the codex CLI
renames a flag next month I want exactly one file to have changed."*

**Surfaces:** `packages/core` (library API and its Vitest suite), `docs/03-adapter-contract.md`, and
one status-line note in `docs/04-architecture.md`. Not the CLI — `quorum adapters --probe` is
Q-0010, and this ticket reaches the real CLIs through an opt-in test instead (AC-13).

---

## Context the implementer should not re-derive

Read once. Every line was verified against the working tree on 2026-08-26.

**What Q-0046 already built, so no adapter builds it twice.** `withRetry` owns retries, usage
accumulation across attempts, the `attempts` count, the `retry` event, and the fallback from a
call's `vendor` to `usage.vendor` to `adapter.vendor`. `getAdapter` (`adapters.ts:266–271`) already
resolves `config[name] ?? {}`, hands it to the factory, and wraps the result in `withRetry(…,
cfg.retry)` — so configuration plumbing exists and what remains is that each factory **uses**
`cfg.bin` and `cfg.extraArgs`. `AdapterRunOptions`, `AdapterResult`, `AdapterUsage`, `AdapterError`,
`AdapterConfig`, `RetryPolicy`, `Adapter` and `RetryingAdapter` are all typed at `adapters.ts:42–199`
— **this ticket adds no type to the contract**, it implements the one that exists.

**The two vendor files, by line.**

| Behaviour | claude | codex |
| --- | --- | --- |
| BYOS refusal, ahead of the probe | `:12` — `ANTHROPIC_API_KEY` only | `:21` — `CODEX_API_KEY` **or** `OPENAI_API_KEY` |
| `check()` success / failure | `:13–15` | `:22–24` |
| argv construction | `:21–29` | `:32–50` |
| `spawn` event | `:31`, every argument through `q()` (`:68`) | `:52`, a raw `args.join(' ')` |
| `stdout` event | `:32` | `:60` |
| failure read from **stdout** | `:36–46`; envelope parsed before deciding, `is_error` honoured at exit 0 | `:77–84`; JSONL errors collected at `:72–73`, unwrapped at `:10–13` |
| structured tail | `:47–49` | `:85–86`, `-o last.txt` read, `JSON.parse` then `extractJson` |
| usage | `:56–66`, cache fields folded into `input_tokens` | `:54` initialised, `:64–70` accumulated, `cost_usd` always `null` |
| temp directory | — | created `:27` (prefix `harness-codex-`), removed `:78` and `:87` |
| shared `exec` | `:70–94`, EPIPE listener `:88–91` | imported from `claude.js` |

**`exec()` is already fixed and must be ported as fixed.** Q-0063 added the `p.stdin` `'error'`
listener; charter `:226` says so in as many words: *"Q-0047 must port the **fixed** `exec()`"*. Its
test is `spike/test/q0063-stdin-epipe.js`, four checks, and it is a library-level test of this
ticket's module — charter §1 therefore requires it to land here in Vitest, not to wait for Q-0054.

**The spike's registry key order is `claude, codex, mock`** (`spike/src/adapters/index.js:25`), which
is what makes the unknown-adapter message's known-list read the way AC-2 requires.

**`overrideAdapters` (`spike/bin/harness.js:612`) is one line and two blind spots.** It walks
`flow.steps`, and within each step `s.parallel ?? [s]`, setting `x.adapter = name` **only where
`x.adapter` is already truthy**. It never visits a `fan_out` step's `step:` template — that path is
covered instead by `ctx.config.adapterOverride` at `spike/src/engine.js:206`, which the CLI sets on
the same line and which is **Q-0052's**. Both halves are preserved; only the function is this
ticket's.

**Register rows.** Rows 2, 4 and 22 (charter §2), plus row 1's Q-0047 half from Q-0046's E-1. Row 4
is already split in the register itself (`Q-0047, Q-0049`, `:130`): the adapter half is
stdout-parsing, the thrown error carrying `usage`, and cache-inclusive tokens; the roll-up half is
Q-0049's. Row 2's split is E-1's, above.

---

## Acceptance criteria

Thirteen, every one testable with Vitest and `#!/bin/sh` stub executables, without a vendor CLI and
without spending anything — **except AC-13**, which is the one thing CI cannot answer. The stub
technique is the spike's own (`spike/test/smoke.js:157–172`): write a script into a temp directory,
point `cfg.bin` at it, have it record `"$@"` and print a canned envelope on stdout.

### AC-1 — The module lands as eight files, adds no dependency, prints nothing, and the three landed assertions that constrain it move with it

`packages/core/src/adapters/` holds exactly these, and `coreSourceFiles()` returns them in this
order:

| Corpus key | Exports | Ported from |
| --- | --- | --- |
| `adapters/adapters.ts` | *(unchanged — the pinned eight)* | Q-0046 |
| `adapters/claude-capabilities.ts` | one `as const` data object | *(new file, same literals)* |
| `adapters/claude.ts` | `claudeAdapter` | `spike/src/adapters/claude.js:1–68` |
| `adapters/codex-capabilities.ts` | one `as const` data object | *(new file, same literals)* |
| `adapters/codex.ts` | `codexAdapter` | `spike/src/adapters/codex.js` |
| `adapters/exec.ts` | `exec` | `spike/src/adapters/claude.js:70–94` |
| `adapters/mock.ts` | *(unchanged)* | Q-0046 |
| `adapters/override.ts` | `overrideAdapters` | `spike/bin/harness.js:612` |

No barrel: the folder gains no `index.ts`. `overrideAdapters` is its own file rather than an addition
to `adapters.ts` so that Q-0046's pinned eight-name export list at `adapters.source.test.ts:37–40`
stays true as written.

**Capabilities are named with a hyphen, not a second dot, and this is not a style choice.**
`adapters.source.test.ts:78` admits a relative specifier only if it matches `/^\.\/[a-z-]+\.js$/`;
`./claude.capabilities.js` fails that regex and `./claude-capabilities.js` passes it. Hyphenating
keeps a landed, reviewed assertion unedited.

`packages/core/package.json` gains **no** dependency. No file in the folder writes to stdout or
stderr or contains an ANSI escape — rendering belongs to the CLI (charter §7). Every exported symbol,
interface field and non-obvious parameter carries a JSDoc block (`harness/rules.md`); no `any`, no
`@ts-ignore` without a same-line reason. `packages/core/src/index.ts` stays byte-for-byte
`export const name = '@quorum/core';\n`.

*Test:* extend `adapters.source.test.ts` — it already asserts all of the above over
`moduleSources()`, so most of this criterion is discharged by the existing suite once AC-2's three
edits land.

### AC-2 — The registry regains its two entries, and the three landed assertions are updated exactly, never weakened

`getAdapter('claude')` and `getAdapter('codex')` each return a `RetryingAdapter` whose `vendor` is
that name, built by a factory that reads `bin`, `extraArgs` and `retry` from that vendor's
`harness.yaml` entry. The registry's key order is **`claude, codex, mock`**, matching
`spike/src/adapters/index.js:25`, so the message is exactly:

```
unknown adapter "gemini" (known: claude, codex, mock)
```

The `registry` JSDoc at `adapters.ts:249–254`, which describes the mock-only registry as a
transitional divergence and points here, is rewritten to describe what it now is. **No other line of
`adapters.ts` changes.**

Three assertions in `adapters.source.test.ts` are updated, and each is updated in the narrowest way
that admits the new files:

1. **`:52`** — the folder list becomes AC-1's eight keys. It stays a `toStrictEqual` over the sorted
   array. Relaxing it to `toContain`, to a length check, to a filter or to a regex is a **blocker**:
   the assertion's whole value is that a ninth file cannot arrive unnoticed.
2. **`:75`** — the allowed-specifier list gains `node:child_process` and nothing else. `exec.ts` is
   the only file that may import it.
3. **`:78`** — unchanged. If the implementer finds it must change, the file names are wrong, not the
   test.

*Test:* both resolutions and their `vendor`; the unknown-name message verbatim; `bin` and `extraArgs`
reaching the argv of the adapter they were configured for and not the other; and the updated folder
assertion failing when a ninth file is added to a fixture tree.

### AC-3 — The BYOS refusal fires before the CLI is probed, per adapter, and still fires when the executable is missing *(register row 1, Q-0047's half — Q-0046 erratum E-1)*

Four properties. The second, third and fourth are what make this a criterion rather than a
restatement.

1. **The refusal happens.** `claudeAdapter().check()` rejects when `ANTHROPIC_API_KEY` is set, with
   `ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only`.
   `codexAdapter().check()` rejects when `CODEX_API_KEY` **or** `OPENAI_API_KEY` is set, with
   `CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only`.
   *(On the product name in those two strings, see Q-4 — it is preserved here, byte for byte.)*
2. **The asymmetry is preserved.** `claude` does **not** refuse on `OPENAI_API_KEY` or
   `CODEX_API_KEY`; `codex` does **not** refuse on `ANTHROPIC_API_KEY`. "All three variable names" is
   a property of the pair, not of either — a test asserting all three against one adapter is
   asserting a behaviour change and must not be written.
3. **It fires *before* the probe, provably.** Point `cfg.bin` at a stub that creates a sentinel file
   and exits 0. With the key set, `check()` rejects with (1)'s message **and the sentinel does not
   exist**. Asserting only the message passes against a rewrite that probes first, which is charter
   §2's stated reason for this row: *"a rewrite that probes first and refuses second passes every
   test that checks only the refusal."*
4. **A missing executable does not mask it.** With `cfg.bin` at a path that does not exist and the
   key set, the rejection is still (1)'s message — never `CLI not runnable`. With the key unset and
   the same missing bin, it is `claude CLI not runnable: …` / `codex CLI not runnable: …`, carrying
   whatever the spawn failure reported.

On success `check()` resolves to the trimmed `--version` stdout and makes no authenticated request —
the contract's JSDoc already says so and must stay true.

*Test:* all four, both adapters, environment restored after each case. Frozen sibling coverage, not
edited: `spike/test/smoke.js:100–107`.

### AC-4 — argv is built from the per-adapter capabilities module and is byte-identical to the spike *(register row 2, adapter half — erratum E-1)*

Both adapters build their argument list from their capabilities module, and **the resulting array is
identical, element for element and in order, to what the spike passes** — for every combination of
`allowWrite` true and false, `model` present and absent, zero and several `extraDirs`, and
`extraArgs` configured and not:

```
claude: -p --output-format json --json-schema <json> --permission-mode acceptEdits|plan
        [--model <m>] [--add-dir <d>]… [<extraArgs>…]

codex:  exec --json --output-schema <tmp>/schema.json -o <tmp>/last.txt -C <cwd>
        --sandbox workspace-write|read-only --skip-git-repo-check --ephemeral
        --ignore-user-config [-m <m>] [--add-dir <d>]… [<extraArgs>…] -
```

`--ignore-user-config` is unconditional. `-m` and `--model` appear **only** when the caller passed a
non-empty model; no vendor model alias appears anywhere in the module as a default, a fallback or a
literal. Codex's trailing `-` stays last, after `extraArgs`. Codex's temp directory keeps the prefix
`harness-codex-` verbatim (`codex.js:27`) — a folder name, not a product name, and not the wording
finding. **`extraArgs` may duplicate a flag the adapter already passes; that is preserved behaviour
and not an invitation to add precedence logic.** `maxTurns` is accepted and ignored on claude, as
today (`claude.js:17–20`); no turn-budget flag is passed, and codex does not destructure it at all.

**What "capabilities" means here, and what it does not.** Each capabilities module is one `as const`
data object holding the vendor's vocabulary and nothing else: the default `bin`, the version-probe
argv as inert data, every flag token, every enumerated flag value (`acceptEdits`, `plan`,
`workspace-write`, `read-only`), and every field name read out of the vendor's envelope or JSONL. It
has **no functions, no I/O, no branching, and no version selection** — see Q-1. **The two modules do
not share an interface**: claude returns one JSON envelope and codex streams JSONL, so a common type
would describe neither, and `docs/04-architecture.md` designs `gemini` as a copy-and-edit of `codex`,
which is the intended reuse and needs none.

*Test:* argv equality against literal expected arrays for both adapters across every combination
above; plus a source-level assertion that no argv token literal (a string beginning with `-`) and no
vendor field-name literal appears in `claude.ts` or `codex.ts` — they live in the capabilities
modules and nowhere else, which is the only thing that makes *"a CLI update breaks one file"* true.

### AC-5 — Failure is read from stdout, translated, and carries what it cost *(register row 4, adapter half)*

Both vendors report failures on stdout, not stderr. Preserved exactly:

- **claude** parses the envelope *before* deciding. It fails when `r.code !== 0` **or**
  `env.is_error === true` at exit 0. The detail is `env.result`, else `env.error.message`, else
  `env.subtype`, else the last 2000 characters of `stderr + "\n" + stdout`, else the literal
  `no output on stderr or stdout` when both are whitespace-only. The message is
  `claude failed (exit <n>[, <subtype>]): <detail truncated to 2000>`.
- **codex** collects error text while streaming — `type: 'error'`, `type: 'turn.failed'`, and
  `item.type === 'error'` — unwraps the vendor's JSON nested inside `message` (`inner.error.message`,
  else `inner.message`, else the original), de-duplicates, and joins with `; `. The message is
  `codex exited <n>: <reported | tail | no output on stderr or stdout>`.
- **Both** consult `authError(vendor, stderr + "\n" + stdout)` first and use its one actionable
  sentence when it recognises the failure.
- **Both** attach `usage` to the thrown error, so `withRetry` and Q-0049's roll-up can count an
  attempt the vendor already billed. Codex's usage object exists from before the spawn, so a stream
  that dies mid-turn still reports what it had.
- **Codex removes its temp directory on every terminal path** — success (`:87`), non-zero exit
  (`:78`), and a spawn failure, which `exec` resolves as `code: -1` and therefore takes the
  non-zero branch.

*Test:* stubs producing each shape — exit 1 with empty stdout; exit 0 with `is_error: true`; an
envelope carrying `total_cost_usd: 4.54` (the failed-cost case, matching `smoke.js:172`); a codex
JSONL error with a nested vendor JSON message; an expired-refresh-token string that must come back as
`codex logout && codex login`; a compile error that must **not** be translated. Assert the temp
directory is gone in every codex case, including the spawn failure.

### AC-6 — Tokens are cache-inclusive on claude and reasoning-inclusive on codex; codex cost is always `null`, never zero

`usageOf` (`claude.js:56–66`) is ported unchanged: `input_tokens` is
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, each missing field counting
zero; `cached_input_tokens` is the read count; `cache_write_input_tokens` the creation count;
`output_tokens` is the reported value; `cost_usd` is `total_cost_usd`. When the envelope carries no
`usage` at all, every token measure is `null` — **not zero**. `session` is `env.session_id ?? null`.

Codex accumulates from the JSONL stream, reading `usage` at `ev.usage`, `ev.payload.usage` or
`ev.item.usage`; `output_tokens` is `(output_tokens ?? 0) + (reasoning_output_tokens ?? 0) ||
<previous>`, preserving the existing `||` fallback verbatim; `cached_input_tokens` is
`u.cached_input_tokens`; `cache_write_input_tokens` stays `null`; `cost_usd` is `null` on every path
and **no rate table exists anywhere in the module** (*"Codex cost is reported as tokens, never priced
locally"*, 2026-08-22). `session` is `ev.thread_id ?? ev.session_id ?? ev.payload?.thread_id ??
<previous>`. Lines that are not JSON are ignored without failing the run.

*Test:* the exact 0.149.0 envelope from `docs/03-adapter-contract.md:143`
(`input_tokens: 13970, cached_input_tokens: 9984, output_tokens: 6, reasoning_output_tokens: 0`) and
a claude envelope reproducing the M0 probe (65 uncached against ~74k total, all three input
components non-zero so a double-count and an omission fail differently). Assert codex `cost_usd` is
`null` and never `0`, and that a usage-free claude envelope yields `null` for all five measures.

### AC-7 — The structured tail comes from the vendor's own channel first, and nothing is repaired or defaulted

claude prefers `env.structured_output`, falling back to `extractJson(env.result ?? stdout)`; `raw` is
`env.result ?? stdout`. codex reads `<tmp>/last.txt` when it exists, `JSON.parse` first and
`extractJson` second, falling back to `stdout` when the file is absent; `raw` is that text. Neither
adapter validates — `checkAgainstSchema` is the engine's call, and `extractJson` is the only place
vendor-wrapping tolerance lives (register row 13). Neither repairs a value or substitutes a default:
an unparseable answer yields `null`, which becomes an explicit stop upstream (register row 21). Both
return `{ vendor, output, raw, usage, session, ms }` and nothing else.

*Test:* structured output present; absent with a fenced JSON block in the text; absent with nothing
parseable (expect `null`); codex with `last.txt` present, malformed, and missing.

### AC-8 — `exec()` ports as Q-0063 fixed it, with its four checks

The `p.stdin` `'error'` listener is present. `EPIPE` appends
`[quorum] the CLI closed its input before the prompt was fully written` to `stderr` and lets `'close'`
resolve, so **the child's exit code stays the authority**; any other stdin error resolves
`{ code: -1 }` with the error text appended. A spawn failure resolves `{ code: -1, stderr: String(e) }`.
Line splitting delivers each complete line to `onLine` in order and flushes a trailing partial line
on close.

`spike/test/q0063-stdin-epipe.js`'s four checks land here as Vitest: a stdin payload comfortably past
a 64 KB pipe buffer against stubs that (a) exit 0 without reading, (b) exit 7 without reading — the
vendor exit code and its message must both survive, (c) exit 3 and produce the truncation notice, and
(d) read the whole prompt and report its byte count. **The spike file is not edited, deleted or
re-pointed** (charter §3).

### AC-9 — Both adapters emit only `spawn` and `stdout` on `shared`'s union, and their `cmd` asymmetry is preserved *(register row 22)*

`onEvent` is typed `(event: AdapterEvent) => void` from `@quorum/shared`, so an adapter cannot emit a
kind the one event format does not describe. Each adapter emits `{type:'spawn', vendor, cmd}` once
before spawning and `{type:'stdout', line}` per complete line, in order, with no step id — the engine
supplies that. **Neither emits `retry`**, which the union permits and which belongs to `withRetry`;
this needs its own assertion, because the type allows what the behaviour forbids. No `tool` or `text`
event is invented (`packages/shared/src/events.ts` records why at length). No vendor-specific field
reaches the union; `vendor` is the one neutral, open label.

**The two `cmd` strings are built differently and stay that way:** claude maps every argument through
`q()` (`claude.js:68` — single-quote wrap when the argument contains whitespace or a quote, inner
quotes escaped, truncated to 80 characters with `…`), codex joins raw (`codex.js:52`). Unifying them
changes what a run prints. `q()` moves with `claude.ts` and stays module-private.

*Test:* the emitted sequence and kinds for both adapters; a schema argument long enough to exercise
`q()`'s truncation; a codex `cmd` containing a path with a space, asserted unquoted; and no `retry`
event from either adapter under any stub.

### AC-10 — `overrideAdapters` lifts from the CLI with both of its blind spots intact

`overrideAdapters(flow, name)` walks `flow.steps`, and within each step `parallel ?? [step]`, setting
`adapter = name` **only where the step already declares one**. A step with no `adapter` key is left
without one, so the engine's `step.adapter ?? role.meta.adapter ?? 'claude'` chain still applies. A
`fan_out` step's `step:` template is **not** visited — the fan-out is reached instead by
`ctx.config.adapterOverride` (`spike/src/engine.js:206`), which the CLI sets on the same line and
which is Q-0052's to port. The function mutates the flow object in place, returns nothing, and reads
or writes no file.

This is the same shape as register row 12's warning about `flattenSteps` and a `fan_out` template. It
is preserved, and it is named in the implement report so Q-0052's reviewer knows where the other half
is.

*Test:* a flow fixture with a plain step, a `parallel` group, a step declaring no adapter, and a
`fan_out` step whose template declares one — asserting exactly which of them changed.

### AC-11 — The port is checked against `docs/03-adapter-contract.md`, and a divergence is fixed on the doc side only

Every flag and field name in the two capabilities modules is checked against the invocation blocks
(`:103–104`, `:110–112`) and the verification table (`:124–130`). **Where the document is wrong, the
document is fixed in this change** (`harness/rules.md`: *"when code and docs disagree, the docs are
wrong until a DECISIONS entry says otherwise"*), with its status line bumped. **Where the code looks
wrong, nothing is fixed** — it is a stop-and-report under charter §2.

Two divergences are already known and are not a licence to hunt for more:

1. The **codex** invocation block (`:110–112`) omits `--add-dir <dir>`, which the adapter passes for
   every `extraDirs` entry (`codex.js:47`) and which the verification table at `:128` lists as
   *verified present*. The block gains it.
2. The **claude** block (`:104`) shows `--model <alias>` unqualified, while codex's line carries
   `[-m <model> only if the flow names one]`. Claude's flag is equally conditional
   (`claude.js:26`). The block gains the same qualification.

`docs/04-architecture.md`'s §Adapters sentence gains one clause noting that the version probe is
deferred and naming the follow-up ticket the gate opened (Q-1), so a later reader does not take it
for shipped. Its status line is bumped. **No other doc is edited.**

*Test:* the two doc edits are in the diff; and a source-level assertion that every flag literal in
each capabilities module appears somewhere in `docs/03-adapter-contract.md`, so the two cannot drift
apart again without a test failing.

### AC-12 — The module's tests land with it, the freeze holds, and every stop-and-report is named

Vitest coverage for AC-1 to AC-11 lands in `packages/core/src/adapters/`, written fresh against the
ported code rather than transcribed from the spike's runner, so chore's `integrate` examines what this
run produced (charter §1). It covers, at minimum, the subjects the frozen suites cover:
`smoke.js:100–107` (the BYOS refusal), `:150–178` (claude's stdout failure paths and failed-step
cost), and `q0063-stdin-epipe.js` in full. **No file under `spike/` is edited, deleted or re-pointed**
(charter §3).

`dev/implement-report.md` names, each with its file and line:

1. **Erratum E-1** and **Q-0052 as owner of row 2's cross-vendor half**. Reporting row 2 as *closed*
   here is the failure the register exists to prevent.
2. **Row 1's Q-0047 half is discharged by AC-3**, completing the split Q-0046's E-1 opened. Row 4's
   adapter half is discharged by AC-5 and AC-6; its roll-up half remains Q-0049's. Row 22 is
   discharged by AC-9.
3. **The wording finding, preserved.** `claude.js:12`, `codex.js:21` and the frozen fixture at
   `smoke.js:465` call the product *"Harness"*, which `.claude/rules/product-boundaries.md` forbids.
   The ported strings are byte-identical and pinned by AC-3. See Q-4.
4. **Q-0066 is not fixed here.** `probeAdapter` dereferences a `null` usage and reports an adapter's
   own `TypeError` as `login not usable`. Both shipped vendors do report usage, so AC-13's probe is
   unaffected — but the fix must land in `spike` and `packages/core` together or the port loses its
   independent witness, which is Q-0066's whole point.
5. **`docs/03-adapter-contract.md`'s open question 4** (`:175–176`) is still open. See Q-5.

Anything else found while porting is recorded with the exact fixture, the actual output and the
expected authority, and the implementer **stops**. It does not narrow a regex, add a guard, unify the
two `cmd` builders, add precedence logic to `extraArgs`, rename the temp prefix, add an export to
`packages/shared`, or edit a contract, ticket or doc beyond AC-11's two divergences. A reviewer may
treat an unregistered behaviour change as a blocker by citing *"The port preserves behaviour"*
(2026-08-25) without arguing its merits.

### AC-13 — Real-CLI evidence exists, is opt-in, and reports itself as skipped rather than passed

CI cannot log in to a subscription, and this ticket's two files are the only ones in the port whose
acceptance evidence cannot come from CI (`docs/04-architecture.md`, §Testing strategy). So:

- One file — `packages/core/src/adapters/real-cli.probe.test.ts` — runs
  `probeAdapter(getAdapter('claude'))` and `probeAdapter(getAdapter('codex'))` against **the ported
  adapters**, in a temp directory, asserting `ok === true`, a non-null `session`, a positive
  `tokens`, and — for claude only — a non-null `cost_usd`.
- It is guarded by `describe.skipIf(!process.env.QUORUM_REAL_CLI)`, so a default `pnpm test` reports
  it **skipped**, never passed. *"A check that skips its subject must not report success"*
  (2026-08-25) applies to this file most of all: it is the only proof of the thing CI cannot see.
- Its JSDoc states the one command that runs it, warns that it costs roughly $0.39 on claude even in
  an empty directory (M0's measurement), and states that it uses the CLI's own login — no key, ever.
- **The human runs it once at the gate**, on the merged branch, with `--force` so a cached pass
  cannot stand in for an executed one (Q-0065), and pastes both result lines plus each CLI's
  `--version` into `dev/integration.md`. That run is the real-CLI acceptance evidence for AC-4
  through AC-7; everything before it is stubs, which is genuinely most of the way and is not the
  same thing.

---

## Questions settled here

These were open in one or both candidates. Each is settled rather than carried, because each has a
determinate answer the charter already dictates and none changes the design.

**Q-1 — the version probe is deferred; the extraction lands.** `docs/04-architecture.md` asks for a
per-adapter `capabilities.ts` *"with a version probe"*. The extraction half is authorised: charter §2
says internal file layout and module boundaries are explicitly **not** preserved, and AC-4 proves the
extraction with byte-identical argv. The probe half is not: it adds a CLI invocation, needs a
supported-version range that will go stale, and needs a policy for an unknown or unsupported version
(warn? refuse? on which surface?). All of that is behaviour, and charter §2's route for behaviour is a
decision entry accepted *before* implementation. **Deferring requires no authority; adding it does.**
The capabilities modules carry the version-probe argv as inert data so the follow-up is a small ticket
rather than a re-cut. Open the follow-up at this gate — proposed id **Q-0067**, to run after Q-0010
gives it a surface to report on — and AC-11 notes the deferral in the architecture doc so nobody reads
the sentence as shipped. *(Candidate-codex's AC-5, which requires each adapter to obtain the installed
version before selecting capabilities, is the version this decision rejects.)*

**Q-2 — register row 2's third clause goes to Q-0052 by erratum.** Settled above. An adapter receives
a model string or nothing and cannot know its provenance; the decision is `resolveModel`'s, two layers
up, in a file this ticket may not write.

**Q-3 — real-CLI evidence comes from `probeAdapter`, not from `quorum adapters --probe`.**
Candidate-codex correctly identifies that `docs/04-architecture.md` names the CLI command and that
Q-0010 owns it, and correctly refuses `check()` or a vendor login-status command as equivalent
evidence. But `probeAdapter` is already in `packages/core` (Q-0046) and *is* the command's engine —
`adapters --probe` will be a renderer over it. Calling it from an opt-in test is the same
authenticated round-trip minus terminal formatting, so this ticket needs no dependency on Q-0010.
AC-13.

**Q-4 — the "Harness" wording is preserved, pinned and carried.** The two refusal messages call the
product *"Harness"*, which `.claude/rules/product-boundaries.md` forbids, and this is the first ticket
that *may* fix it. It does not. The message text is what a command prints, which charter §2 lists as
externally observable; preserving needs no authority and changing it needs an erratum first; and
fixing it here alone would leave the spike saying one thing and `core` another until the cutover,
which is precisely the divergence the freeze exists to make visible. Open a follow-up scoped the way
Q-0066 is — *"the fix must land in `spike` and `packages/core` together"* — proposed id **Q-0068**,
covering `claude.js:12`, `codex.js:21`, their ported twins, and the frozen fixture at
`smoke.js:465`, and settling whether the replacement says "subscription OAuth" or the glossary's
"subscription". AC-3 and AC-12 are written for this answer.

---

## Open questions

**Q-5 — `docs/03-adapter-contract.md`'s open question 4.** Whether `--permission-mode plan` still lets
claude read the repo and its `--add-dir` folders is the last unanswered question in that document, and
AC-13's probe is the only moment a real CLI runs. **Non-blocking; recommendation: leave it open.**
Answering it needs a read-only step over a real repository rather than a hello-world round-trip, it is
equally a question about the spike, and folding it in makes AC-13 a second experiment. If the human
wants it, it is a note in `dev/integration.md`, not a criterion. *(Both candidates agree.)*

**Q-6 — should `exec` be exported from the package root?** Owner: implementer. **Recommendation: no.**
It is exported from `adapters/exec.ts` for its own test and for `codex.ts`; `packages/core/src/index.ts`
is byte-pinned by Q-0041 and AC-1 does not touch it. Stated so a reviewer does not spend a round on it.

---

## Non-goals

- **A version probe of either CLI** (Q-1), and any version-keyed selection between capability sets.
- **`tool` and `text` events**, or any parsing of vendor JSONL into normalised events — it would
  change what `--verbose` prints; `packages/shared/src/events.ts` records the refusal in full.
- **Persisting, replaying or transporting the event stream.**
- **Fixing Q-0066**, narrowing `transientError`, unifying the two `cmd` builders, adding precedence
  logic to `extraArgs`, or any other defect Q-0046 preserved. They stay pinned.
- **Changing the "Harness" wording** without the follow-up Q-4 describes.
- **`resolveModel` and `ctx.config.adapterOverride`** — Q-0052 (erratum E-1).
- **Any edit under `spike/`** (charter §3), including `spike/test/smoke.js:465`.
- **The `quorum` binary, the `adapters --probe` command, and any command rendering or exit code** —
  Q-0010.
- **Adding an export to `packages/shared`**, or any type to the adapter contract.
- **Q-0049's roll-up**, its `n/a` rendering, and its unpriced-step count.
- **Local codex pricing**, a rate table, or treating an absent cost as zero.
- **Honouring `maxTurns` through an unverified vendor flag.**
- **Another child's module**, the cutover, and everything on v1's exclusion list (multi-user, remote
  daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, the Gemini adapter, the
  desktop shell).

---

## Risks

**The capabilities extraction is the one place the port is not a translation, and a reviewer will read
it that way.** Mitigated by AC-4's byte-identical-argv assertion and by the source-level rule that no
argv token literal survives in the adapter file — together they make the extraction provable rather
than argued. Residual risk: an implementer who over-abstracts into a shared interface across two
genuinely different vendor shapes. AC-4 forbids it in as many words.

**Three landed, reviewed assertions go red by design, and only one is obvious.** The folder list at
`adapters.source.test.ts:52` announces itself; the import allow-list at `:75` and the specifier regex
at `:78` do not, and an implementer who hits them under time pressure relaxes the wrong one. AC-2
names all three, names the narrowest edit for each, and makes weakening the folder assertion a
blocker.

**A quiet fix leaves both suites green over a wrong product.** The standing hazard of the whole port
(charter §2). This ticket carries more temptation than most: `probeAdapter`'s `TypeError`, the two
inconsistent `cmd` builders, the product name in the refusal, and codex's `|| usage.output_tokens`
fallback all look like tidy-ups. AC-12 lists each as a report rather than a change.

**No CI evidence for the real CLIs.** AC-13's opt-in test is the only proof, it costs about $0.39 on
claude, and it depends on the human running it at the gate.

**Register row 2 closes while looking closed.** If erratum E-1 is not committed, either the
implementer asserts something weaker and calls it row 2, or a reviewer blocks correctly and the loop
cannot close it. If the Q-0052 block is not pasted, the clause is inherited by nobody.

**The first run fails after the implementer has run** if `harness/Q-0047/integration` is not created
by hand. Verified absent today.

**Cost.** Measured chore children ran $26.81 (Q-0036) and $36.66 (Q-0035); Q-0046 is the fair
comparator. Eight files and thirteen criteria put this at the upper end. Charter §9's checkpoint rule
applies: more than three chore runs to reach `reviewed` means the child was cut wrong, not that it
needs a fourth.

**On size.** Thirteen criteria is at the upper end of the ten-to-fifteen band and was weighed rather
than accepted. It is not split, for two reasons: the surface is one module with two files and no
natural seam that does not sever `exec` from its callers or the capabilities from the argv they build;
and eleven of the thirteen are "the ported code equals the spike, here is the fixture", which is
mechanical rather than design work — the shape that converges, as Q-0046 did. The two that are not
mechanical (AC-4's extraction, AC-13's opt-in probe) are the ones a reviewer should read first.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | The subject of AC-3. No code path, test, fixture or doc line in this change accepts an API key; the refusals are the product's hard promise and their *ordering* is what AC-3 exists to prove. AC-13's probe runs on the CLI's own login. |
| **Worktree safety** | n/a to the module — no adapter writes outside the `cwd` it is handed. `allowWrite` maps to `--permission-mode`/`--sandbox` and is set by the engine, not here. Codex's temp directory is under `os.tmpdir()` and removed on every terminal path. Nothing is written to the working tree, `backlog/`, `.quorum/` or `.harness/worktrees/`. |
| **Gate behaviour** | n/a. This ticket adds no gate and reads none. The chore flow's own final gate must be answered by a human, or `finish()` rolls back a proven-green merge (Q-0040). |
| **File format and schema** | No new persisted format. `AdapterUsage`, `AdapterResult` and `AdapterEvent` belong to `shared` and Q-0046; this ticket adds no type to the contract and no export to `packages/shared`. Codex's temp schema file is disposable. |
| **Lint and cross-vendor rules** | No flow-lint rule changes. ESLint and `tsc --noEmit` strict pass across the workspace. |
| **Files are the database** | No persistent state is introduced; capability definitions are source files. |
| **Errors are explicit** | AC-5 and AC-7: failures are parsed from stdout before any fallback, an unparseable tail yields `null` rather than a repaired value, and nothing is silently defaulted (register row 21). |
| **Cold-clone impact** | Neutral by design, and Q-1 is where it would stop being: a version probe adds a CLI spawn to a path a newcomer hits in their first 30 minutes, which needs a reason. Deferring keeps the first-run path exactly as long as it is today. |
| **Product-agnostic** | No SaaS product is named. The one product-naming defect in scope is preserved and reported (Q-4). |
| **Freeze** | Nothing under `spike/` is touched. CI's `port freeze (branch scope)` job covers `harness/Q-0047/*`. |

---

## Provenance

**Candidate-claude supplies the spine** and most of the text: the erratum-E-1 split of register row 2
with its "an adapter cannot know which role asked" argument; the separation of the authorised
extraction from the unauthorised version probe; the eight-file layout with `override.ts` kept out of
`adapters.ts` to protect Q-0046's pinned export list; the opt-in `probeAdapter` test that dissolves
codex's OQ-3; the per-line behaviour table; the "Before the first run" section; and the doc divergence
at `03-adapter-contract.md:110–112`.

**Candidate-codex supplies four things candidate-claude missed**, all kept: `maxTurns` is accepted and
ignored with no turn-budget flag passed (AC-4); `extraArgs` may legitimately duplicate a flag and
precedence logic must not be added during a port (AC-4, risks); cleanup on the **spawn-failure** path,
not only on success and non-zero exit (AC-5); and the explicit hermeticity requirement — no test may
read a developer's home configuration or depend on subscription state (AC-12, AC-13). Its risk
register is also sharper on the two ways cache tokens can be got wrong, which AC-6's fixture
requirement now reflects. Its structure — a flat numbered list of twenty — was not kept: several of
its criteria are facets of one testable claim, and at twenty the ticket exceeds the size a chore run
converges at.

**Where they disagreed, this document picks.** Four questions candidate-codex declared blocking are
settled in §"Questions settled here" rather than returned: three resolve to "add no behaviour", which
needs no authority under charter §2, and the fourth is a hand-committed erratum with a Q-0046
precedent. Candidate-codex's AC-5 — each adapter obtains the installed CLI version before selecting
capabilities — is the one substantive proposal rejected outright.

**Found while merging, in neither candidate.** `adapters.source.test.ts:75` admits only `node:fs`,
`node:os`, `node:path` and `@quorum/shared` as import specifiers, so it must gain
`node:child_process` or `exec.ts` cannot spawn; and `:78`'s `/^\.\/[a-z-]+\.js$/` rejects
`./claude.capabilities.js` while accepting `./claude-capabilities.js`, which is why AC-1 names the
capability files with a hyphen and AC-2 leaves that regex alone. Candidate-claude's OQ-3 recommended
the dotted name, which would have failed a landed test on the first `pnpm test`. Also corrected:
`spike/src/adapters/claude.js` is **94** lines, not the 83 the ticket body carries (stale, written
before Q-0063) nor the 99 candidate-claude reports; `ctx.config.adapterOverride` is at
`spike/src/engine.js:206`, not `:204`; the folder assertion is at `adapters.source.test.ts:52`, not
`:53`; and codex's `--add-dir` flatMap is at `codex.js:47`, not `:49`.

**Verified against the working tree on 2026-08-26 while merging:** both spike adapter files line by
line; `spike/src/adapters/index.js:20–32`; `spike/bin/harness.js:612`; `spike/src/engine.js:202–212`
and `:666–675`; `spike/test/q0063-stdin-epipe.js` and `smoke.js:100–107, 150–178, 462–468`;
`packages/core/src/adapters/adapters.ts:176–275`; `packages/core/src/adapters/adapters.source.test.ts`
in full; `packages/core/test/corpus.ts:26–73`; `packages/shared/src/events.ts` exports and
`packages/shared/src/index.ts`; `harness/port-charter.md:127–148, 226, 313–321`;
`backlog/Q-0046-…/requirements/errata.md` E-1; `docs/03-adapter-contract.md` in full;
`docs/04-architecture.md` §§`packages/core`, Adapters, Testing strategy. Branch state checked with
`git merge-base --is-ancestor`: `harness/Q-0041/integration` and `harness/Q-0046/integration` are both
contained in `main`; `harness/Q-0047/integration` does not exist.

**Decisions this document leans on, by title and date:** *The port takes the chore route, except the
one child that has new behaviour* (2026-08-25) · *The port preserves behaviour; one exception is
authorised and everything else stops the child* (2026-08-25) · *A requirement may not name a surface
its flow cannot write* (2026-08-25) · *Q-0035 accepted: a check that skips its subject must not report
success* (2026-08-25) · *The event union is derived from what the product emits* (2026-08-25) ·
*Unknown keys are refused where Quorum owns the key set* (2026-08-25) · *`core` is organised in folders
named after the port's children* (2026-08-26) · *Flows never pin a vendor model name; codex runs with
`--ignore-user-config`* (2026-08-22) · *check() proves presence; only `adapters --probe` proves login*
(2026-08-22) · *Codex cost is reported as tokens, never priced locally* (2026-08-22) ·
*Step-output validation is Quorum's contract with its own agents* (2026-08-22) · *Ticket size is the
dominant cost driver* (2026-08-22).
