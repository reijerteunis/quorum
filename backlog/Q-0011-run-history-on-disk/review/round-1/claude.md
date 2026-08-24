# Q-0011 review — round 1 (claude)

**Verdict: changes-requested.** 4 blockers, 8 majors, 6 nits.

Line numbers are as they appear on `harness/Q-0011/integration`. I verified every finding
against the branch's files, not the patch text.

## What is right

Worth saying, because it is most of the diff. The engine-writes / CLI-reads seam is real and
clean; nothing in `spike/bin/harness.js` imports from `spike/src` except the two contract helpers
it was always allowed. `replaceManifest` (`spike/src/engine.js:346`) is correctly synchronous —
`openSync` → `writeFileSync` → `fsyncSync` → `closeSync` → `renameSync` — so the signal path
cannot race an in-flight writer over the temporary name, which is the one thing N-6 in the
solution asked for and the one thing an async implementation would have got wrong. The roll-up
(`engine.js:374`) never sums money across vendors and never turns a `null` into a `0`. Reserving
`exhausted` in the schema without ever writing it matches M-4. The `x-quorum-contract` annotation
is the right selector — better than `$id` or filename — and it is recorded in `docs/DECISIONS.md`
with alternatives, as the rules require.

---

## Blockers

### blocker 1 — `spike/src/engine.js:324` the internal `_started` field is written into manifests, which then violate their own schema

`allocateOccurrence` stamps `_started: Date.now()` onto the occurrence object
(`spike/src/engine.js:324`) and pushes that same object reference into
`ctx.history.manifest.steps` (`:326`). It is removed only in `terminalOccurrence`
(`:334`). `replaceManifest` serialises the whole snapshot (`:352`), so **any manifest written
while some other occurrence is still running contains `_started` on that occurrence.**

`contracts/Q-0011/run-manifest.schema.json` sets `additionalProperties: false` on `$defs/step`
and does not declare `_started`. So the file on disk is invalid against the frozen contract.

Failure scenario, fully reachable today:

1. A `parallel:` block or a fan-out wave starts two adapter steps. `runAgentStep` allocates
   synchronously at `:205` before its first `await`, so both occurrences are in `steps[]`
   with `_started` set.
2. The faster one finishes → `terminalOccurrence` → `replaceManifest` writes a manifest
   containing the slower occurrence, `_started` and all.
3. `harness runs <id>` in another terminal, or `harness validate contracts/Q-0011/run-manifest.schema.json .quorum/runs/<id>/manifest.json`, now reads a document that fails with
   `additionalProperties ("_started")`.
4. If the process is `SIGKILL`ed in that window, the artifact is **permanently** invalid — and
   that is precisely the "run killed before it could finalise" state AC-13 is written for and
   AC-3 promises will be readable.

The final manifest of a clean run is fine, which is why the suite misses this: the AC-3 parallel
scenario in `spike/test/q0011-run-history.js` only inspects the manifest after `run()` resolves.

**Fix:** keep the start time off the persisted object — a side `Map<occurrence, number>` in
`ctx.history`, or serialise through a projection that strips underscore-prefixed keys. Then add
an assertion that a manifest read *during* a parallel step validates against the schema; without
it this class returns.

### blocker 2 — `spike/bin/harness.js:138` `vendorTokenTotal` double-counts Claude's cache-creation tokens

```js
// cached_input_tokens is already counted inside input_tokens (writer contract); cache-write
// tokens are a genuinely separate spend, so they're added rather than double-counting cache reads.
function vendorTokenTotal(row) {
  const parts = [row.input_tokens, row.output_tokens, row.cache_write_input_tokens].filter(...)
```

The premise in that comment is wrong for the only vendor that reports these fields.
`spike/src/adapters/claude.js:60`:

```js
input_tokens: u ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) : null,
...
cache_write_input_tokens: u?.cache_creation_input_tokens ?? null,
```

`cache_creation_input_tokens` is inside `input_tokens` **and** is the whole of
`cache_write_input_tokens`. Adding the second to the first counts it twice.

`contracts/Q-0011/run-history-writer.contract.md` states the rule the code breaks, verbatim:
*"Input totals already include vendor-reported cache components; readers do not add them again."*
The mock contract says the same of the mock.

Failure scenario: the M0 measurement on record is a Claude step reporting ~71,600 input of which
38,400 was cache. A run like that displays `tokens=110000` where the vendor reported 71,600 +
output — a ~35% overstatement on the single number this ticket exists to produce. The qa-red
fixture (`spike/test/q0011-runs-cli.js`, `usage()`) sets both cache fields to `null`, so
`120` is asserted and the defect is invisible.

**Fix:** `input_tokens + output_tokens`, and extend the CLI fixture to carry non-null
`cache_write_input_tokens` so the assertion can catch a regression.

### blocker 3 — `spike/src/engine.js:290` AC-1's "directory already exists" refusal is not implemented; an undeclared stage guard stands in for it

AC-1: *"If the directory already exists, the run stops before spawning any adapter, script,
integrate step or gate, **naming the existing directory**; it is never reused or overwritten."*

What the code does:

```js
const persistedStage = fs.existsSync(historyRoot)
  ? parseFrontmatter(fs.readFileSync(path.join(ctx.ticket.dir, 'ticket.md'), 'utf8')).meta.stage
  : null;
if (persistedStage && persistedStage !== ctx.ticket.meta.stage) {
  throw new FlowError(`run directory allocation refused: ticket stage conflicts with persisted run history (…)`);
}
fs.mkdirSync(runDir, { recursive: false });     // :297
```

Two separate problems.

*The guard is not the criterion.* It compares the in-memory ticket stage with `ticket.md` on disk
whenever `.quorum/runs/` exists at all — a different property, in no acceptance criterion and in
no contract, with an error message that names a directory conflict it did not check. Nothing in
`contracts/Q-0011/run-history-writer.contract.md` authorises it.

*It exists because the red test needs it.* In `spike/test/q0011-run-history.js`, the AC-1
scenario re-runs the same ticket to trigger the refusal. But `nextRunId` (`engine.js`) reads
`runs.log` and returns **2** on the second call, so `runDir` is `<id>-2`, which does not exist and
`mkdirSync` succeeds. The `assert.rejects(…, /exist|run directory/i)` only passes because the test
hand-builds a ticket with `stage: 'draft'` while disk says `requirements`, and the stage guard
fires. The criterion under test is never reached.

*So the real path is unexercised and mis-reports.* An actual collision hits `mkdirSync`
(`:297`), which throws a plain `Error: EEXIST: file already exists, mkdir '…'`. That is not a
`FlowError`, so `spike/bin/harness.js:449` re-throws and `main().catch` (`:460`) prints a Node
stack. This repository has a decision entry about exactly that shape of failure
("a failure that withholds the one thing the reader needs").

**Fix:** wrap `mkdirSync` and translate `EEXIST` (and any other errno) into a `FlowError` naming
the directory and what to do about it; drop the stage guard or, if the collision it detects is
real, raise it as a separate ticket with its own criterion. Then rewrite the AC-1 scenario so it
actually collides — pre-create `.quorum/runs/<id>-<n>` for the id `nextRunId` will allocate.

### blocker 4 — the branch is 91 commits behind `main` on the three files it instruments

`git merge-base main harness/Q-0011/integration` is `2d1206b`; `main` is `4c83ccf`.
`git rev-list --count harness/Q-0011/integration..main` = **91**, and those commits touch
`spike/src/engine.js`, `spike/bin/harness.js` and `spike/src/adapters/` — the same three files.

Concretely, this branch's `engine.js` predates:

- `readOnlyBacklog` (`8420a11`, "`--dry` must not mutate the ticket it previews", Q-0034) — and
  this diff adds a new `if (!dry)` bookkeeping branch to `runFlow`, the same function;
- `ctx.branchHeadAtStart` and the ticket-branch rollback in `finish()` (Q-0033) — and this diff
  adds manifest finalisation to `finish()`;
- the run-level `diffInputs` preflight and empty-range guard (`78f626d`, Q-0006) — inside
  `runFlow`'s `try`, which this diff restructures;
- `testReport()` (Q-0033). Branch `engine.js:745` still writes the old
  `out.slice(-8000)` report, which drops the head of a large suite — the defect Q-0033 fixed;
- the `lint.js` extraction, and `runGate` returning `counter` alongside `limit` (`engine.js:457`
  here returns `{ goto, limit }`; `main` returns `{ goto, counter, limit }` and `runFlow` reads
  `res.counter`).

Every one of those has a DECISIONS entry. The merge will conflict in `runFlow`, `runScript`,
`runIntegrate` and `finish` — precisely where this ticket inserts its hooks — and a careless
resolution silently reverts a shipped fix. This is the "state outliving the run that created it"
pattern named in M1's closing entry.

**Fix:** merge `main` into the branch, re-run the suite, and re-review the reconciled
`runFlow`/`runIntegrate`/`finish` hunks. Do not resolve these conflicts at the gate.

---

## Majors

### major 1 — `spike/src/engine.js:746` an integrate step that throws before this line leaves no `output.txt`

`contracts/Q-0011/run-history-writer.contract.md`: *"Script and integrate occurrences have no
`prompt.txt` and **always** receive `output.txt`, including captured stdout/stderr or an empty
file when the command produces no text."*

The occurrence is allocated at `engine.js:675`; `output.txt` is written at `:746`. Everything in
between can throw:

- the base-sync conflict throw at `:702` — the failure whose own comment records that Q-0011 spent
  its entire budget and $8.63 hitting it three times;
- a merge failure in `mergeInto`, or `ticketWorktree` failing to create the worktree.

In each case `runFlow`'s catch (`:133`) marks the occurrence `failed` with category `integrate`
— correctly — but the directory contains nothing at all. A maintainer opening
`steps/00N-integrate/` after the most common integrate failure finds an empty folder, which is
the exact experience this ticket was written to end.

**Fix:** write `output.txt` in a `finally`, or seed it with the running `notes` at allocation and
overwrite at `:746`. The EDGE-2/EDGE-3 scenario should assert `output.txt` exists on the
install-failure branch it already exercises.

### major 2 — `spike/bin/harness.js:398` detail mode reads every sibling manifest

AC-13: *"It reads only files inside the selected run directory."*

`const { runs: allRuns, warnings } = readRunsDir(runsRoot);` runs unconditionally, before the
token dispatch, so `harness runs Q-0011-3` parses every `manifest.json` under `.quorum/runs/`
before opening the one requested at `:405`. On a repository with a year of run history that is
also a real cost, and it re-introduces exactly the coupling AC-13 forbids.

**Fix:** move the `readRunsDir` call into the two list branches.

### major 3 — `spike/bin/harness.js:421` ticket-filter mode never exits non-zero, even when it names a malformed sibling

AC-12: *"One malformed run directory does not hide its valid siblings: readable runs are listed,
the malformed one is named, and the command exits non-zero."*

The ticket-filter branch prints `warnings` through `printRunsListHuman` (`:423`) and then
`return`s without touching `process.exitCode`. The inline comment argues a malformed directory
cannot be attributed to a ticket — a fair design point, but it resolves a frozen contract by
comment, and the qa-red suite freezes the wrong side of it
(`spike/test/q0011-runs-cli.js`, `assert.equal(cli(root, ['runs', 'Q-9999']).status, 0)` with a
`bad` directory present). A script piping `harness runs Q-0011` gets exit 0 while history is
corrupt.

**Fix:** pick one and make it consistent — either exit non-zero whenever a warning was printed,
or do not print sibling warnings in filter mode at all. Silently printing a problem and reporting
success is the worst of the three.

### major 4 — `spike/src/engine.js:390` `errorOf` re-implements auth/transient classification, and already disagrees with the source of truth

`spike/src/adapters/index.js` exports `authError()` (`:120`) and `transientError()` (`:55`), and
the DECISIONS entry for `authError` says it *"lives at the contract layer so contributor adapters
inherit it."* `errorOf` ignores both and hand-rolls substitutes:

```js
function authErrorCategory(vendor, message) { return message.includes('login expired or missing') || /authentication|not logged in|API_KEY is set/i.test(message); }
function transientErrorCategory(message) { return /connection|socket|ECONN|ETIMEDOUT|rate.?limit|overload|\b(429|5\d\d)\b|timed? ?out/i.test(message); }
```

They already disagree:

- `authError` deliberately classifies *"The 'gpt-5' model is not supported when using Codex with a
  ChatGPT account"* as an auth-class failure — the headline finding of Q-0001, thrown by
  `codex.js:81`. `authErrorCategory` matches none of its patterns, so the manifest records
  `category: "adapter"`. The one failure mode the product has a decision entry about is
  mis-filed in the record built to explain failures.
- `transientErrorCategory` omits `ENOTFOUND`, `EAI_AGAIN`, `EPIPE`, `fetch failed`,
  `temporarily unavailable` and `stream interrupted`, all in `TRANSIENT`
  (`adapters/index.js:37`). Meanwhile `\b5\d\d\b` matches any three-digit number 500–599 anywhere
  in the message — a token count, a line number, a port — and files it as `transient`.

So the retry wrapper and the manifest can classify the same error two different ways.

**Fix:** `import { authError, transientError } from './adapters/index.js'` and derive the
category from them.

### major 5 — `spike/bin/harness.js:143` `formatMoney` rounds real costs to `$0.00`

```js
const formatMoney = (v) => (v == null ? 'n/a' : `$${v.toFixed(2)}`);
```

Everything else in the product uses three decimals: `formatCost` in `engine.js` is
`toFixed(3)`, and `round()` is `Math.round(n * 1000) / 1000`. The tokens-only decision is
explicit that a cost must *"never [be] rounded to `$0.000`"*; `$0.00` is the same failure one
digit earlier. A step that genuinely cost $0.004 prints as free, and the reader cannot tell it
from a vendor-reported zero — which the semantic validator goes to real trouble to keep
distinguishable.

**Fix:** `toFixed(3)`, matching `formatCost`.

### major 6 — `spike/src/engine.js:440` a one-second timer in `runGate` exists only to make a test win a race, and does not

```js
const signalWindow = setTimeout(() => {}, 1000);
```

The stated justification is a custom UI whose gate promise owns no libuv handle. The CLI's own
gate uses `readline` on stdin and holds a handle, so the only consumer is the fake UI in
`spike/test/q0011-run-history.js` (`gate: () => new Promise(() => {})`).

It does not solve the problem it names. After 1000 ms the timer clears, the loop drains, the
never-settling `await` is abandoned and the child exits — with no manifest finalisation, which is
the opposite of the intent. The test only passes because `waitFor` polls every 10 ms and usually
delivers `SIGTERM` inside the window. On a loaded CI box it flakes, and the failure will read as
"interruption handling is broken" rather than "the test lost a race".

**Fix:** delete the timer. Give the test a gate promise that owns a handle (`new Promise(() =>
setInterval(() => {}, 1000))`, cleaned up by the signal path), so the fixture holds the process
open rather than production code doing it on the fixture's behalf.

### major 7 — `spike/src/adapters/mock.js:38` `scope` splits on a directory this repository does not use, and puts absolute paths into persisted output

```js
const scope = cwd ? path.resolve(cwd).split(`${path.sep}.quorum${path.sep}worktrees${path.sep}`)[0] : '';
```

Worktrees are created under `.harness/worktrees/` — `spike/src/git.js:11`, and this ticket's own
non-goals say so explicitly: *"No rename of `.harness/worktrees/`. `spike/src/git.js` writes
worktrees to `.harness/worktrees/` … both directories exist until the rename ticket lands."*

The split therefore never matches, and `scope` is the full absolute `cwd`. Consequences:

- The intended effect — one call counter per project rather than per worktree — silently does not
  happen. The `calls` key becomes per-worktree, changing long-standing mock semantics
  ("a reviewer returns the failing verdict on its first call per role") in a way nothing tests.
- `key` is interpolated into `output.summary` at `:54`, so `raw` — persisted verbatim to
  `output.txt` and written into ticket artifacts at `engine.js:241` — now carries
  `/private/var/folders/…`. Commit subjects too: `engine.js:251` uses
  `res.output.summary?.slice(0, 60)`, so the mock's commits become machine-specific path
  fragments. AC-2 asks that nothing persisted carry an absolute path.

**Fix:** drop `scope` from the key (the added `kind` discriminator is the part that was actually
needed, and it is sound), or derive it from a project root the adapter is given rather than by
string-splitting a path convention this ticket agreed not to change.

### major 8 — `spike/src/adapters/index.js:85` the wrapper manufactures a usage object for an adapter that reported none

```js
add(res.usage);
const vendor = res.vendor ?? res.usage?.vendor ?? adapter.vendor;
return { ...res, vendor, usage: { vendor, ...spent }, attempts: attempt };
```

`spent` starts all-`null`, so when `res.usage` is absent the wrapper still returns a non-null
`usage` with a vendor. `normaliseUsage` then passes it through, and `rollup` gives that vendor a
row with `step_count: 1`, `unpriced_steps: 1` and every measure `null`.

The writer contract says: *"Group occurrences with **non-null** usage … adapter occurrences with
no reported usage create no vendor row."* Reachable without a contributor adapter:
`claude.js:56` returns all-`null` measures whenever the envelope carries no `usage` object, so a
Claude response missing usage inflates `step_count` and `unpriced_steps` — and
`unpriced_steps` is the number AC-12 requires the CLI to state out loud.

**Fix:** return `usage: measures.some(k => spent[k] != null) ? { vendor, ...spent } : (res.usage ?? null)`, mirroring the shape the error path at `:91` already uses.

---

## Nits

- **nit — `spike/bin/harness.js:195`** the per-step `usage:` line reuses `formatVendorSummary`
  with a synthesised `unpriced_steps: s.usage.cost_usd == null ? 1 : 0`. Printing
  `unpriced_steps=1` against a single occurrence reads as a roll-up field on a row that is not a
  roll-up, and collapsing four measures into one total means the `cached_input_tokens` /
  `cache_write_input_tokens` distinction AC-9 works hard to preserve is unreadable from the CLI.
  Print the fields.

- **nit — `spike/src/engine.js:393`** `authErrorCategory(vendor, message)` never uses `vendor`.
  Drop the parameter (or, better, fold this into major 4 and delete the function).

- **nit — `spike/bin/harness.js:383`** `readData(f)` re-reads and re-parses a file `validateFile`
  has already parsed one line earlier. Return the parsed document from `validateFile` — note its
  existing `data` field is `path.basename(dataFile)`, a display string, so this needs a new field
  rather than a reuse.

- **nit — `spike/src/git.js:42`** `ensureExcluded` reports through `console.warn`, bypassing the
  run's `ui.warn` that every other warning in the engine uses; in `--json` consumers it lands on a
  different stream from everything else. Pass a warn callback, or have the caller at
  `engine.js:310` catch and re-warn.

- **nit — `spike/src/engine.js:98`** when `initialiseRunHistory` throws, the `start` line is
  already in `runs.log` (`:98`) and `finish()` is never called, so that run has no terminal line.
  Harmless for `nextRunId`, which takes a max, but it is the exact gap Q-0004 closed for
  interrupts — *"every terminal outcome … is written to `runs.log`"*. Call `finish(…, 'failed', …)`
  before rethrowing, or emit the `start` line only after initialisation succeeds.

- **nit — `spike/bin/harness.js`, `checkRunManifestSemantics`** the run-level check requires
  `duration_ms === Date.parse(ended_at) - Date.parse(started_at)` exactly, but the writer clamps
  with `Math.max(0, …)` (`engine.js:333` and `finish`). A backwards clock adjustment mid-run
  produces a manifest the writer considers correct and its own validator rejects. Allow the clamp,
  or drop the clamp.

---

## One thing to carry, whatever is done with the above

Three of the four blockers are invisible to the suite in the diff, and each for the same reason:
the assertion looks at the artifact at the moment it is most likely to be well-formed. AC-3's
parallel scenario reads the manifest after `run()` resolves, so it never sees the mid-run document
that carries `_started`. The CLI fixture sets both cache fields to `null`, so the token total can
never double. The AC-1 scenario asserts a rejection it obtains from a different guard than the one
under test.

That is the "a gate only catches what it is pointed at" decision playing out inside a test file
rather than a flow. Whatever else changes, the three scenarios above want re-pointing before this
lands — otherwise the next round re-reviews a green suite that proves the same three things it
proved this time.
