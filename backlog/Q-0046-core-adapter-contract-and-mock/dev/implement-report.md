# Q-0046 — implement report

*`core/adapters`: the contract layer and the mock adapter. Chore route, **iteration 2** — a revision
round against `review/chore-iter-1.md`. Branch `harness/Q-0046/implement`.*

---

## 1. The review finding, and what it changed

`review/chore-iter-1.md` returned **one major and no blocker**:

> `packages/core/src/adapters/adapters.ts:133` `AdapterResult.vendor` is required even though AC-4
> explicitly permits an adapter call to omit `vendor` and requires `withRetry` to fall back through
> `res.usage?.vendor` to `adapter.vendor`. The implementation's own test has to conceal this mismatch
> with `as AdapterResult` at `adapters.test.ts:239`, so a contributor implementing the documented
> fallback case receives a type error. Make the raw adapter result type permit an omitted vendor
> while keeping the retry-wrapped result's resolved vendor explicit.

**Accepted in full, and it is right on all three of its claims.** The fallback existed in the
implementation (`res.vendor ?? res.usage?.vendor ?? adapter.vendor`) and in the JSDoc, and the type
denied it. Three independent authorities say the omission is legal, and I checked each rather than
taking the finding's word:

- **AC-4 clause 2** — *"`vendor` is `res.vendor ?? res.usage?.vendor ?? adapter.vendor` … A per-call
  declaration takes precedence; the adapter's own vendor is used only when the call omits one."*
- **`docs/03-adapter-contract.md:48–51`** — *"The result's `vendor` is a per-call billing
  declaration. … Only when a call omits its vendor does the wrapper use `adapter.vendor`."*
- **AC-2** — the result is *"`{output, raw, usage, session, vendor, ms}` **with `attempts` added by
  the wrapper**"*, which is the seam this fix draws.

The two casts were the tell. A test that has to widen a type to express the case the criterion
describes is reporting a defect in the type, and this one is exactly the contributor-facing surface
the ticket exists to get right — a Gemini adapter that omits the declaration would have met a
compile error for doing what the contract document tells it it may do.

### The shape of the fix

The wrapper is the thing that resolves the vendor, so the type splits where the wrapper sits:

| Type | What it is | `vendor` | `attempts` |
| --- | --- | --- | --- |
| `AdapterResult` | what a **raw** adapter call answers with — the six fields `03-adapter-contract.md:38–45` names | `vendor?: string`, the per-call declaration | absent |
| `RetriedAdapterResult extends AdapterResult` | what a **wrapped** call answers with | `vendor: string`, resolved | `attempts: number`, required |
| `Adapter` | one vendor CLI | `run` → `Promise<AdapterResult>` | |
| `RetryingAdapter extends Adapter` | an adapter that has been through `withRetry` | `run` → `Promise<RetriedAdapterResult>` | |

`withRetry` and `getAdapter` now return `RetryingAdapter`, so the resolution is explicit in the
type of everything above this layer rather than asserted in prose — which is the second half of what
the finding asked for.

**`attempts` moved with it, and that is the same fix rather than a second one.** Round 1 had
`attempts?: number` on `AdapterResult` with the JSDoc *"Written by `withRetry`, never by an
adapter"* — the identical defect the finding names, one field over: a guarantee only the wrapper can
make, expressed as optional on the raw contract. Leaving it there while creating a wrapper type
would have fixed one half of a two-field seam. AC-2's own wording (*"with `attempts` added by the
wrapper"*) is what authorises the placement, and `AdapterResult` is now exactly the six fields the
contract document lists — no more, no less.

### What did not change

**No statement in any function body was touched.** The diff over `adapters.ts` is four JSDoc blocks,
one `?`, two new interfaces and three return-type annotations. `withRetry`'s accounting, its vendor
resolution, its retry event, its give-up message and `getAdapter`'s registry lookup are
character-identical to round 1. This round cannot have changed runtime behaviour, and the 445-test
suite passing unchanged is the evidence.

### Alternatives I rejected

- **Keeping `vendor` required and deleting the fallback.** It would contradict AC-4 clause 2 and
  `03-adapter-contract.md:48–51`, and removing a fallback is a behaviour change charter §2 forbids.
- **`vendor?: string` with `withRetry` still returning `Adapter`.** Half the finding: the raw type
  would be honest and the wrapper's guarantee would vanish, leaving every future consumer —
  Q-0050's engine first — reading `vendor?: string` off a result where it is always a string.
- **An inline `Adapter & { run(…): Promise<RetriedAdapterResult> }` on both signatures,** to avoid
  naming `RetryingAdapter`. Same type, spelled twice, and Q-0050 would have no name to import.

### Criteria this touches

AC-2 lists seven type exports; the module now exports eleven, having already added `AdapterError`
and `AdapterConfig` in round 1. **AC-1 permits this in as many words** — *"Type exports are permitted
and uncounted (AC-2)"* — and the eight **runtime** names AC-1 does count are unchanged, which
`adapters.source.test.ts:36` asserts and which passed. No new export was added to `packages/shared`,
no dependency was added, `packages/core/package.json` and `pnpm-lock.yaml` are still untouched, and
`packages/core/src/index.ts` still holds its pinned byte string.

---

## 2. File by file

### Changed this round

**`packages/core/src/adapters/adapters.ts`** — `AdapterResult.vendor` optional with the JSDoc naming
why and pointing at `RetriedAdapterResult`; `attempts` moved off it; `RetriedAdapterResult` and
`RetryingAdapter` added with their JSDoc; `withRetry` and `getAdapter` re-typed. Bodies unchanged.

**`packages/core/src/adapters/adapters.test.ts`** — the two `as AdapterResult` casts deleted, so the
`silent` and `viaUsage` stubs now return an object with no `vendor` and type-check as a contributor
would write them. The comment says so, because the absence of a cast is the assertion and an absence
is easy to reintroduce.

### Unchanged since round 1 — the rest of the branch

**`packages/core/src/adapters/adapters.ts`** (536 lines) — the contract as types, then `getAdapter`
over a module-level registry, `TRANSIENT` / `transientError`, `withRetry`, `AUTH_PATTERNS` /
`RELOGIN` / `authError`, `PROBE_SCHEMA` / `PROBE_PROMPT` / `probeAdapter`, `extractJson`,
`checkAgainstSchema`. Eight runtime exports; `PROBE_PROMPT`, `TRANSIENT`, `AUTH_PATTERNS` and
`RELOGIN` module-private as in the spike. All eighteen `checkAgainstSchema` message strings and both
`authError` sentences port verbatim; `TRANSIENT`'s twelve entries keep their source order, with the
JSDoc naming the ordering as load-bearing.

**`packages/core/src/adapters/mock.ts`** (182 lines) — `mockAdapter`, with `calls`, `TASKS`,
`nonempty`, `numericSwitch` and `mockProfile` private. Every environment switch keeps its exact name
and semantics; the cache measures stay folded **into** `input_tokens`; the verdict rule stays
last-enum-on-first-call-per-key; no reset is exported (OQ-8), and the module JSDoc records that
constraint because Q-0054 inherits it.

**Tests — 129 across five files, all written fresh against the ported code, none transcribed from the
spike's runner.** `adapters.test.ts` (37: registry, retry policy, classification, defects 2 and 3),
`mock.test.ts` (38: switches, write containment, usage invariants), `probe.test.ts` (13: the probe
and defect 1), `structured-output.test.ts` (27: `extractJson` and `checkAgainstSchema`),
`adapters.source.test.ts` (14: the criteria that are properties of the source).

**`packages/core/test/strict-schema.ts`** — AC-8's rule as an executable helper over any schema bound
for a vendor, placed beside `corpus.ts` and `repo.ts` rather than inside this module's suite because
its second subject (`schemaFor`) lands in Q-0052, which imports this instead of retyping the rule.

**`packages/core/test/env.ts`** — `withEnv`, so every test restores the environment it changed.

**`packages/core/src/corpus.test.ts`** — one assertion widened. It named the two module folders that
existed when Q-0064 wrote it (`/(backlog|git)/`); `coreSourceFiles`'s guard reports the *first*
uncovered directory it meets, so adding `adapters/` made it report a third name and the test red.
Widened to `[a-z-]+`, which is what the assertion was always about. **This is the one file outside
`packages/core/src/adapters/` that this branch changes**, and it is a test made robust against the
next child rather than a behaviour changed.

---

## 3. Deliberately left alone

### The four preserved defects (AC-11, charter §2)

None is repaired. Each is pinned by a test asserting today's behaviour, so a later cleanup turns this
suite red instead of passing quietly, and each carries a one-line `Why:` naming its authority.

1. **`probeAdapter` blames the login for its own crash.** `res.usage!.cost_usd` is unguarded, so an
   adapter whose login is perfect and which reports no measure answers `{ok: false, error: "Cannot
   read properties of null (reading 'cost_usd')"}`, which a caller renders as *login not usable*.
   The most tempting fix in the ticket and the most important to leave: the spike still has it, so a
   quiet fix leaves both suites green over a product that disagrees with itself. **It deserves its
   own ticket** — a live defect in the one command that exists to de-risk a paid run.
2. **`transientError` retries any bare `429/500/502/503/504/529`.** A compile error mentioning line
   502 is retried five times across 75 seconds. Pinned at `adapters.test.ts:357`.
3. **`transientError` calls `authError('x', …)`** with a placeholder vendor and discards the
   sentence. Pinned through `authError('x', '401 Unauthorized')`, reachable only because the
   placeholder is a real argument.
4. **The mock assumes `schemaFor`'s output** and throws a raw `TypeError` on a schema with no
   `properties`. No guard added.

### Transitional divergences and deferrals, each with a named owner

- **The registry holds `mock` alone (AC-3).** `getAdapter('claude')` throws `unknown adapter
  "claude" (known: mock)` here while the spike still answers it. The message *format* is pinned; the
  *membership* deliberately is not — the test reads the printed list back through `getAdapter` and
  asserts every name it prints resolves. **Q-0047 restores the two entries**, and Q-0047's
  requirement must carry a criterion saying so.
- **AC-8's `schemaFor` half is deferred, not covered.** `strictSchemaProblems` is written over
  `PROBE_SCHEMA` and exported for reuse; `schemaFor` lives in `spike/src/engine.js` and importing it
  is forbidden by §3 and AC-1. `spike/test/q0034-probe-schema.js` keeps covering it until **Q-0052**
  ports it, and **Q-0052's requirement must carry that criterion**. Stated as *deferred with a named
  owner*, never as coverage that is complete.

### Register rows, and where each is discharged

| Row | Where |
| --- | --- |
| **1** — the BYOS refusal, and `check()` is not proof of a login | **Split, per Erratum E-1.** The half this ticket can write is discharged: nothing in `packages/core/src/adapters/` calls `check()`, `probeAdapter` is the only authenticated round-trip and never stands in for presence, and `Adapter.check`'s own JSDoc says it is cheap, makes no request and does not prove a login. **The refusal and its ordering are Q-0047's**, and its requirement must assert that the refusal fires *before* the CLI probe, over all three variable names, and still fires when the executable is missing. **Row 1 is not closed by this ticket** — reporting it closed would be the exact failure the row exists to prevent. |
| **13** — the four validations stay four | `checkAgainstSchema` is strict about Quorum's own schema, `extractJson` holds all vendor-wrapping tolerance, `AdapterSchema` is structural and not zod. `adapters.source.test.ts` asserts nothing here imports zod, ajv or `../contracts/`. |
| **21** — never default silently | `extractJson` returns `null` rather than `{}` or a repair; `checkAgainstSchema` reports every problem rather than the first and substitutes no value. |
| **22** — nothing downstream learns which vendor produced an event | `onEvent` is typed as shared's `AdapterEvent`; `vendor` is an open string everywhere; no field is vendor-conditional. |

### Stop-and-report: the wording finding

`spike/src/adapters/claude.js:12`, `spike/src/adapters/codex.js:21` and the fixture at
`spike/test/smoke.js:465` call the product **"Harness"** (*"… Harness runs on subscription OAuth
only"*), which `.claude/rules/product-boundaries.md` forbids — "Harness" is the concept and the
folder, never the product. All three are in frozen or Q-0047-owned files. **Reported, not fixed.**
`adapters.test.ts:313` quotes the string verbatim as a fixture, so the classification is asserted
over the real text; the quotation is not an endorsement of the wording.

### Scope

No `spike/**` file is edited, deleted or re-pointed — `git diff main...HEAD -- spike/` is empty.
Nothing was added to `packages/shared`. No dependency, no lockfile change, no `index.ts` re-export,
no registration seam, no mock reset, no `tool`/`text` event kind, no widening of
`checkAgainstSchema`, and nothing written into `backlog/` or `.quorum/`.

---

## 4. Verification

| What | Result |
| --- | --- |
| `pnpm typecheck` | **green**, 7/7 packages |
| `pnpm lint --force` | **green**, 7/7 packages, 0 cached |
| `pnpm turbo run test --force` | **green** — 7/7 tasks, 0 cached; `@quorum/core` 445 tests across 20 files, of which 129 are this module's |
| `npm test --prefix spike` | **not executed here** — see below |

`--force` throughout, because a cached Turbo run has already reported a pass it never executed
(Q-0065), and this round's whole subject is a type the cache cannot see.

**The spike half of `commands.test` could not be run in this worktree.** It fails with
`ERR_MODULE_NOT_FOUND` because a worktree is a fresh checkout and `spike/node_modules` does not
exist here; installing it was not permitted in this environment. That is environmental and not
caused by this branch — `git diff --stat main -- spike/` and `git status --short -- spike/` are both
empty, so `spike/` is byte-identical to `main`. The chore flow's `integrate` step installs
dependencies in the worktree before running the test command, so `npm test --prefix spike && pnpm
turbo run test` runs both halves properly there. **I am reporting this as unrun rather than as
passing** — the ticket's own subject is that a check which skips something must say so.

---

## 5. For the reviewer

- **Read the AC-11 tests before the module.** Three of the four preserved defects look exactly like
  bugs to fix and one — `probeAdapter`'s null-usage crash — is a genuine live defect in a safety
  command. An implementer who fixes it makes AC-11 red and everything else green.
- **The registry's single entry is AC-3, not a regression.** The `known:` list no longer names the
  vendors because Q-0047 owns their files.
- **This round's diff is two files and no executable statement.** If you are diffing against round 1
  rather than against `main`, `git diff` over `adapters.ts` is four JSDoc blocks, one `?`, two
  interfaces and three return types.
