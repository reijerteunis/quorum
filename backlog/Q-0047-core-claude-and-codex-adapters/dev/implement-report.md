# Q-0047 — implement report

*Iteration 3 (revision round). Ticket: `core/adapters` — the claude and codex adapters. Route:
chore. Requirement: `requirements/merged.md` + `requirements/errata.md` (E-1, E-2).*

---

## 1. The review finding, and how it is closed

`review/chore-iter-2.md`, one major, no blocker:

> **major: `packages/core/src/adapters/real-cli.probe.test.ts:41`** — The real-CLI tests call
> `probeAdapter(getAdapter(...))` directly without clearing `ANTHROPIC_API_KEY`, `CODEX_API_KEY`, or
> `OPENAI_API_KEY`. `probeAdapter` deliberately does not call `check()`, and `run()` contains no BYOS
> guard, so either vendor CLI may prefer an inherited API key. This contradicts AC-13's requirement
> that the evidence use the CLI's subscription login with "no key, ever," and could spend API credit
> while falsely being accepted as subscription evidence. Run both probes with all three key variables
> explicitly removed from the environment (and restore them afterward), or otherwise enforce the same
> guarantee around the probe calls.

**The finding is correct and is accepted in full.** Its chain holds link by link against the working
tree: `adapters.ts:12–16` says in as many words that nothing in that module calls `check()`; neither
adapter's `run()` reads an API-key variable (`process.env` appears in `claude.ts` only at `:95` and
in `codex.ts` only at `:88`, both inside `check()`); and `exec` spawns with `env: process.env`
(`exec.ts:54`), so whatever this process holds, the vendor CLI receives.

What makes it worth more than its one-line fix is **where the false assurance lived**. The file's own
JSDoc said:

> *"No API key is read, set or accepted on any path here — if one is in the environment, `check()`
> refuses, and this file does not call `check()` at all because presence and login are separate
> questions."*

Those two clauses contradict each other in a single sentence, and the second one is true. The file
claimed a guarantee by citing the mechanism it had just said it does not use — a documented promise
with nothing behind it, in the one file whose whole purpose is to be the evidence CI cannot produce.
That is *"skipped is not passed"* (2026-08-25) with the subject swapped: not a check reporting
success over something it did not examine, but a **comment** reporting a guarantee nothing enforced.
The reviewer read the sentence rather than accepting it.

### 1.1 What changed

One file, `packages/core/src/adapters/real-cli.probe.test.ts`, three edits.

**A `withoutApiKeys` helper** wraps each probe. It saves the three variables, deletes them, asserts
they are gone, runs the probe, and restores in a `finally` — a variable that was unset comes back
unset rather than as an empty string, which is why the restore is a `Map`-style save of the original
values and not a blanket re-assignment:

```ts
const API_KEY_VARIABLES = ['ANTHROPIC_API_KEY', 'CODEX_API_KEY', 'OPENAI_API_KEY'] as const;

async function withoutApiKeys<T>(probe: () => Promise<T>): Promise<T> {
  const saved = API_KEY_VARIABLES.map((name) => [name, process.env[name]] as const);
  for (const name of API_KEY_VARIABLES) delete process.env[name];
  try {
    for (const name of API_KEY_VARIABLES) expect(process.env[name], `${name} must not reach the CLI`).toBeUndefined();
    return await probe();
  } finally {
    for (const [name, value] of saved) if (value !== undefined) process.env[name] = value;
  }
}
```

**Both call sites go through it** — `withoutApiKeys(() => probeAdapter(getAdapter('claude')))` and
the codex twin. `getAdapter` is called *inside* the guard rather than beside it: it reads no key
today, and putting it inside costs nothing and cannot be wrong later.

**The JSDoc paragraph is rewritten** to describe what the file does instead of what it hopes. It now
names why the guard has to be here: `probeAdapter` does not call `check()` (`adapters.ts:12–16`) and
`run()` carries no BYOS guard, so an inherited key would reach the CLI, which may prefer it — and
the run would then be read as proof that a *subscription* login works.

Two details that are load-bearing rather than stylistic:

- **The deletion is what reaches the child.** `exec` passes `env: process.env` (`exec.ts:54`), so
  removing the variables from this process removes them from the CLI's environment. A guard that
  only asserted would have proved nothing; a guard that only deleted would have been unverifiable.
- **The assertion is the enforcement, not decoration.** If a later edit drops the deletion, the probe
  fails loudly instead of quietly spending API credit and reporting green. Its JSDoc says so, so
  nobody removes it as noise.

**All three variables are cleared for both probes**, not just each vendor's own. The probe's risk is
spending API credit, both variables reach codex, and one process runs both tests. This does **not**
touch AC-3's asymmetry, which is a property of `check()` in `claude.ts` and `codex.ts` — those files
are unchanged this round, and their tests still assert that claude refuses on `ANTHROPIC_API_KEY`
alone and codex on the other two alone.

### 1.2 The remedy I did not take, and why

The finding offers two routes. I took the second ("otherwise enforce the same guarantee around the
probe calls") and deliberately **did not add a BYOS guard to `run()`**.

Adding one would be an unregistered behaviour change. The spike's `run()` has no such guard on either
vendor; adding it to `core` alone would mean the two trees refuse different things until the cutover,
with both suites green over the divergence — the precise failure the freeze exists to expose and
*"The port preserves behaviour"* (2026-08-25) exists to forbid. It would also be a *product* decision
wearing a test fix's clothes: whether every adapter call re-checks the environment, or only `check()`
does, is charter-§2 behaviour and belongs to a decision entry, not to a revision round closing a
test-hygiene finding. The guarantee AC-13 asks for is about **this file's** probe calls, and that is
where it is now enforced.

---

## 2. Files changed this round

| File | Change |
| --- | --- |
| `packages/core/src/adapters/real-cli.probe.test.ts` | `withoutApiKeys` added; both probe calls wrapped; the "What it uses" JSDoc paragraph rewritten to describe the enforcement instead of citing `check()`. |

**No other file in the repository was touched this round.** In particular: `claude.ts`, `codex.ts`,
both capabilities modules, `exec.ts`, `override.ts`, `adapters.ts`, the three landed assertions in
`adapters.source.test.ts`, and both docs are byte-identical to iteration 2. The finding was about how
a test reaches the vendor, not about what the adapters do.

## 3. The branch as a whole, file by file

For the reviewer reading the full diff (`main...HEAD`, 18 files, +2147/−15). Unchanged from
iteration 2 except the one file above.

**New — the module (AC-1's eight, plus tests):** `claude.ts`, `codex.ts`, `exec.ts` (the Q-0063-fixed
`exec`, EPIPE listener and all), `override.ts` (`overrideAdapters` lifted from
`spike/bin/harness.js:612`), `claude-capabilities.ts`, `codex-capabilities.ts`. No barrel; no
`index.ts` in the folder; no dependency added to `packages/core/package.json`; nothing in the folder
prints.

**New — tests:** `claude.test.ts`, `codex.test.ts`, `exec.test.ts` (Q-0063's four checks as Vitest,
plus a missing-binary case), `override.test.ts`, `registry.test.ts`, `capabilities.source.test.ts`,
`real-cli.probe.test.ts` (AC-13, opt-in), and `packages/core/test/cli-stub.ts` — a stub executable
that records its argv and stdin, which is what makes the "refused before it probed" sentinel and the
element-for-element argv assertions possible.

**Modified — exactly four files, each in the narrowest way:**

- `adapters.ts` — **only** the registry line and its JSDoc, as AC-2 requires. `{ claude, codex, mock }`
  in the spike's key order (`spike/src/adapters/index.js:25`), so the unknown-adapter sentence reads
  identically on both sides of the port.
- `adapters.source.test.ts` — the three landed assertions, updated and never weakened. The folder
  list at `:52` stays a `toStrictEqual` over the sorted array and gains a companion test that
  *shows it firing* on a fixture tree with a ninth file; the import allow-list gains
  `node:child_process` and nothing else, plus a new assertion that `exec.ts` is the only file that
  may hold it; the `/^\.\/[a-z-]+\.js$/` specifier regex is **unchanged**, which is why the
  capability modules are hyphenated rather than dotted.
- `docs/03-adapter-contract.md` — AC-11's two known divergences, doc side only: the codex invocation
  block gains `--add-dir`, and the claude block gains the same `only if the flow names one`
  qualification codex's line already carried. Status line bumped.
- `docs/04-architecture.md` — one clause recording that the version probe is deferred to Q-0067, so
  the sentence is not read as shipped. Status line bumped.

Iteration 2's substance, for a reviewer coming to this diff cold: five narrowings were removed from
`claude.ts` and `codex.ts` so that a vendor field is transcribed rather than corrected
(`env.result ?? stdout`, `env.session_id ?? null`, direct measure propagation, truthiness rather than
an object test on `usage`), each restoration carrying a `Why:` line, and eleven tests were added to
hold the line — each verified to fail against the narrowed source before the fix was restored.

## 4. Stop-and-report — AC-12's list, plus one more

Carried forward in full; nothing here changed this round.

1. **Erratum E-1, and Q-0052 owns register row 2's cross-vendor half.** Row 2 splits.
   Q-0047 discharges the **adapter** half and only that: `--ignore-user-config` unconditional on
   every codex invocation (`codex.ts:108`), `-m` and `--model` present only when the caller names a
   model, and no vendor model alias anywhere in either capabilities module as a default, a fallback
   or a literal. The clause *"a role's default model never crosses vendors"* is **not closed here**
   and is not closeable here: an adapter receives a model string or nothing and cannot know which
   role asked. It is `resolveModel` (`spike/src/engine.js:670`), called only from the agent step
   (`:205` — E-1's own correction to the merge), which is **Q-0052's**. Frozen coverage:
   `spike/test/smoke.js:620–626`. Reporting row 2 as *closed* by this ticket is the failure the
   register exists to prevent, so it is reported as **half closed, half owed**.
2. **Register rows discharged.** Row 1's Q-0047 half — the BYOS refusal firing **before** the
   `--version` probe, per adapter, still firing when the executable is missing — is discharged by
   AC-3, completing the split Q-0046's E-1 opened; the sentinel test is what proves the *order*
   rather than the message. Row 4's **adapter** half (failure read from stdout, the thrown error
   carrying `usage`, cache-inclusive tokens) is discharged by AC-5 and AC-6; its **roll-up** half
   remains **Q-0049's**. Row 22 is discharged by AC-9.
3. **The "Harness" wording is preserved, byte for byte, and is not fixed here.**
   `packages/core/src/adapters/claude.ts:95` and `codex.ts:88` say *"Harness runs on subscription
   OAuth only"*, which `.claude/rules/product-boundaries.md` forbids — "Harness" is the concept and
   the folder, never the product. Their spike twins are `claude.js:12` and `codex.js:21`; the pinned
   fixtures are `spike/test/smoke.js:464` (frozen) and
   `packages/core/src/adapters/adapters.test.ts:314` (Q-0046's). This is the first ticket that
   *may* fix it and it does not: the message text is what a command prints, the fix must land in
   both trees together or the port loses its independent witness, and **Q-0068** is open for it with
   the decision it needs — what the sentence says instead.
4. **Q-0066 is not fixed.** `probeAdapter` dereferences a `null` usage and reports an adapter's own
   `TypeError` as `login not usable`. Both shipped vendors do report usage, so AC-13's probe is
   unaffected. The fix must land in `spike` and `packages/core` together.
5. **`docs/03-adapter-contract.md`'s open question 4 is still open** (now `:181–182` after this
   change's edits, not the `:175–176` the requirement cites): whether `--permission-mode plan` still
   lets claude read the repo and its `--add-dir` folders. Per Q-5, left open deliberately —
   answering it needs a read-only step over a real repository, not a hello-world round-trip, and it
   is equally a question about the spike.
6. **Found in iteration 2 — a defect present in *both* trees, now pinned in `core`.**
   A claude envelope whose `result` is present but **not a string**, with no `structured_output`,
   **crashes the run**: `raw` is that non-string value, `extractJson(raw)` is typed `string | null`
   and reached with it, and `text.matchAll` throws
   `TypeError: text.matchAll is not a function or its return value is not iterable`. The vendor's
   answer is replaced by a Node stack trace — the same shape Q-0063 removed from `exec()`. Evidence:
   a differential run in which **both** the spike adapter and the ported one throw the identical
   constructor and message over the identical stub. It is **not fixed here** and is pinned instead,
   as `PRESERVED DEFECT` in `claude.test.ts` with a `Why:` line. It wants a ticket in the
   Q-0066/Q-0068 shape: the fix lands in `spike/src/adapters/claude.js` and
   `packages/core/src/adapters/claude.ts` together, and it needs a decision — whether an adapter
   coerces a malformed `result` or stops with an explicit error, which `harness/rules.md`'s *"never
   default silently"* suggests.

## 5. Deliberately left alone

No BYOS guard was added to `run()` (§1.2). Beyond that, unchanged from iteration 2: the two `cmd`
builders are still built differently — `quoted` on claude, a raw `join` on codex — because unifying
them changes what a run prints (AC-9 asserts the asymmetry from both sides). `extraArgs` may still
duplicate a flag the adapter already passed, and no precedence logic was added. `maxTurns` is still
accepted and ignored on claude with no turn-budget flag passed, and codex still does not destructure
it. Codex's temp prefix is still `harness-codex-` — a folder name, not the product name, and not the
wording finding. `overrideAdapters` still skips a `fan_out` step's `step:` template, which is
preserved and is reached instead by `ctx.config.adapterOverride` (`spike/src/engine.js:204`),
**Q-0052's** to port. `transientError` was not narrowed. Nothing was exported from
`packages/shared`, no type was added to the adapter contract, `packages/core/src/index.ts` is
byte-unchanged, and no version probe was written (Q-1 → **Q-0067**).

## 6. Verification

Every check below was run **after** this round's edit.

| Check | Result |
| --- | --- |
| `pnpm turbo run test --force` | **562 passed, 2 skipped** (26 files passed, 1 skipped). **0 cached** — Q-0065, so no replay stands in for an execution. |
| `pnpm turbo run typecheck lint --force` | **14/14 tasks successful, 0 cached.** No `any`, no `@ts-ignore`. |
| The 2 skipped | `real-cli.probe.test.ts`, guarded by `describe.skipIf(!process.env.QUORUM_REAL_CLI)`. Reported **skipped**, never passed (AC-13). |
| The changed file is actually checked | `eslint.config.js:12` lints `packages/**/*.ts` and ignores only `node_modules`, `dist`, `.turbo`, `coverage` and `spike/**`; `packages/core/tsconfig.json` extends the base with no `include`/`exclude`, so tsc reads every `.ts` under the package. The file is linted and type-checked, not silently exempt. |
| Freeze (charter §3) | `git diff --stat main -- spike/` is **empty**. No commit on this branch touches any file under `spike/`. |

**One check I could not run, stated rather than implied.** `npm test --prefix spike` — the first
half of `harness.yaml`'s `commands.test` — **does not run in this worktree**. It dies with
`Cannot find package 'yaml'` on eleven of twelve files, because a fresh worktree is a fresh checkout
with no `node_modules` (`spike/node_modules` is absent; `yaml`, `ajv` and `ajv-formats` are
spike-local dependencies), and the install was not permitted to me here. That is the first of the six
engine defects the *"red for the right reason"* decision records, and `integrate` installs
dependencies before running the command for exactly this reason — so the spike half of the suite will
be executed there, on the merged result, which is the run that matters. **I am not reporting it as
passed.** What I can report is that nothing on this branch could have changed it: no file under
`spike/` is modified, and the one spike file that does run here without dependencies —
`q0063-stdin-epipe.js`, which imports only `node:` built-ins — passes all five of its checks.

**What the guard's own correctness rests on.** `withoutApiKeys` only executes when the probe
executes, which is under `QUORUM_REAL_CLI` at the gate — CI cannot exercise it, by the same
constraint that makes AC-13 opt-in at all. Its two claims are therefore verifiable by reading rather
than by running: `exec.ts:54` spawns with `env: process.env`, and the `finally` restores only the
variables whose saved value was not `undefined`. The `expect` inside it is what converts a future
regression into a failure rather than a silent charge.

## 7. For the human at the gate

AC-13's real-CLI evidence is still owed and is the one thing CI cannot answer. On the merged branch:

```
QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core
```

`--force` matters (Q-0065). Paste both result lines and each CLI's `--version` into
`dev/integration.md`. It costs roughly $0.39 on claude even in an empty directory (M0), runs on the
CLI's own login, and — as of this round, enforced rather than asserted — reaches no API key on any
path.
