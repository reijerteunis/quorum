# Q-0092 — `quorum runs` and the run-history presentation layer

*Merged requirement, run 1, iteration 1. Written against the tree at `2c42a4d` — the tip after
Q-0091's entry landed. Every figure below was run against that tree; nothing is transcribed from the
ticket body, and §1 records the five places where the body and the tree disagree.*

**Verdict: ready. Thirteen criteria, no split proposed, no blocking open question.**

The ticket is one command with one clear seam, and it fits the ceiling. What it is *not* is what the
body describes: three of its five framing sentences are false against the tree, and two of the three
change the work rather than only the arithmetic. §1 is therefore the load-bearing section and §5
acts on it.

---

## 1. What was measured, and where the ticket body is wrong

Every claim in this section was executed or read against `2c42a4d`. The corrections are grouped by
whether they change the work.

### The three that change the work

**M-1 — `@quorum/core`'s barrel exports no run-history symbol at all.** The body says *"Everything
it reads is already in `core`"*, and that is true of the **module** and false of the **public API**.
`packages/core/src/index.ts` exports eighteen value symbols; the run-history readers are none of
them. `packages/core/src/run-history/reader.ts` exports `manifestShapeError`, `readRunsDir`,
`sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal`, `resolveRunDirectory` and
`TICKET_ID_PATTERN`, and the barrel reaches for none of them, because `packages/core`'s `exports`
map publishes `"."` alone with no wildcard subpath (Q-0096 AC-5) — so a deep import does not resolve
either, and `package.test.ts` proves that in a plain Node process.

This is Q-0096's finding one layer down and in the same shape: a cut assumed a surface that had never
been opened. It is not a blocker — the remedy is six names and is AC-4 — but it means the ticket's
one-sentence summary of its own dependencies understates it, and it drags three landed pins with it
(M-6 below).

**M-2 — `packages/cli` cannot read the selected run's manifest, and no `core` function reads one.**
`packages/cli/src/frame.source.test.ts:177` forbids `node:fs`, `node:child_process`, `node:readline`,
`node:os` and `node:url` in **every** production module of the package, asserted as
`toStrictEqual([])` over the whole production set. The spike's detail path is
`JSON.parse(fs.readFileSync(manifestPath, 'utf8'))` inline in the `runs` case
(`spike/bin/harness.js:490`).

`core` has no counterpart. `readRunsDir` parses **every** sibling manifest, and both the frozen
contract (*"after selecting a run it reads only that run directory"*) and Q-0034's AC-13 forbid using
it for a detail request — the spike's own `listRuns` is a lazy closure for exactly this reason, with
the comment recording that eagerly calling it *"coupled a single-run request to the health and size
of its siblings"*.

So this is the case ground rule 4 contemplates in its own words — *"say so if it is genuinely
absent"* — and it is genuinely absent. `core` gains one reader (AC-3). The alternative is either a
behaviour change on the one property Q-0034 opened this path to fix, or `node:fs` in `packages/cli`,
which turns a landed guard red. Neither is available.

**M-3 — the module layout is forced, and a natural split turns AC-10 red.**
`frame.source.test.ts:63` derives the frame/command partition from `COMMANDS`: a production module is
a *command module* if its basename is a registered command, and a *frame module* otherwise. A frame
module naming any symbol in `DOMAIN` is a failure — `domainOffenders` reports *"X belongs to
@quorum/core and to a command"*. Since AC-4 puts the six reader symbols into `DOMAIN` (it must:
`package.test.ts` asserts the barrel is **exactly** `[...domain(), ...ERRORS]`), a helper module such
as `run-history-format.ts` would be a frame module forbidden to name `vendorTokenTotal`,
`isIncomplete` or `occurrenceSeq`.

The consequence is stated here rather than left to be discovered at review: **every symbol the
presentation layer takes from `core` is named in `runs.ts`**. A helper module is permitted only if it
names none of them — which `formatVendorSummary` cannot, since it calls `vendorTokenTotal`.

### The two that stop a wrong figure travelling

**M-4 — the body's account of `q0034-review-fixes.js` B2 is stale by one ticket, and it names the
wrong line.** The body says B2's `tokens=1100` assertion *"reads the per-step line, because
`printRunDetailHuman` never renders the roll-up"*. That was true until Q-0037 and is not true now.
The file says so itself, at `spike/test/q0034-review-fixes.js:102–106`:

> The roll-up rows, which is where `vendorTokenTotal` runs and where this scenario's property lives.
> It was asserted on the DETAIL view until Q-0037, and that was reading the wrong line:
> `printRunDetailHuman` renders no roll-up at all, so the `tokens=1100` below used to match the
> per-step usage line — the exact line AC-8 rewrites. Re-aimed at the roll-up itself rather than
> deleted, so the double-count guard keeps a subject instead of quietly losing one.

Measured: `:107–110` runs `cli(root, ['runs'])` — the **list** — and asserts `tokens=1100` on the
roll-up, `tokens=n/a` on the malformed codex row, and no `1350` anywhere. The per-step guard is a
**separate block** at `:112–118`, over `cli(root, ['runs', 'Q-0011-1'])`, asserting the four measures
at their own values, no `1350`, and no `unpriced_steps`.

Both halves must be translated and they are two criteria, not one (AC-8 and AC-9). This matters
beyond bookkeeping: an implementer following the body would aim the double-count guard at the detail
view — which is precisely the defect Q-0037 repaired, restored by a document.

**M-5 — `runs` binary coverage is in four spike files, not two, and neither named file carries what
the body says.** The body says *"Inherits 505 lines — `q0011-runs-cli.js` (221) and
`q0011-run-history.js` (284)"*. `wc -l` gives **220** and **283**, so the total is 503; and the
framing is wrong in both directions. A census of `'runs'` invocations across `spike/test/`:

| file | lines | what of `runs` it carries | who owns the rest of its binary half |
| --- | --- | --- | --- |
| `q0011-runs-cli.js` | 220 | **all five `runs` scenarios**, `:29–82` — 54 lines, 11 invocations | `validate`, eight invocations — **carried by Q-0091 already** |
| `q0011-run-history.js` | 283 | **one** invocation, `:121–124` — a separate reader process shows a billed failure's usage | nothing; the other 279 lines are library-only and already carried by six counterparts |
| `q0034-review-fixes.js` | 157 | **B2** (`:78–119`) and **B4** (`:141–154`) — the roll-up/per-step split and the five confinement tokens | B3's `FlowError` routing — Q-0094 |
| `q0080-allocation.js` | 216 | one status assertion at `:206` | `ticket new` (Q-0093), `board` (Q-0099) |

So the inherited work is roughly **110 lines of scenario across four files**, not 503 across two, and
two-thirds of the two named files is either another ticket's or already done. This is Q-0091's E-4
arriving on the next child in the cut: *a child translates a command-scoped set of behaviours across
several files and never a file*, and an implementer translating faithfully by file would re-do
Q-0091's work and re-classify a `split` file as finished.

### Three smaller measurements, recorded so they are not re-derived

**M-6 — three landed pins move, and all three are identity assertions.** Adding six names to the
barrel moves: `frame.source.test.ts`'s `DOMAIN` (14 → 20) and its `COMMAND_DOMAIN` (a `runs.ts` row);
`package.test.ts`'s `expect(domain()).toHaveLength(14)` and its
`expect(Object.keys(barrel).sort()).toStrictEqual([...domain(), ...ERRORS].sort())`; and
`frame.source.test.ts`'s `node:path` clause, which asserts
`commandModules().filter(FRAME_ONLY_IO) === ['lint.ts']` and becomes `['lint.ts', 'runs.ts']`.
A fourth moves if AC-3's reader lands in `reader.ts`: `run-history.source.test.ts:72–79` pins that
file's exports as an identity, both the source list and `Object.keys`.

**M-7 — `manifestShapeError` is not one of the symbols this ticket needs.** The body lists it among
what the command reads. Measured: it is called in exactly one place,
`packages/core/src/run-history/reader.ts:120`, inside `readRunsDir`. The spike's `runs` case never
names it. Exporting it would put a symbol on the public surface that no command needs, which the
barrel's own doc comment forbids in as many words.

**M-8 — the four exit sites on the `runs` paths are all soft, and none of them is `die`.**
`spike/bin/harness.js:499`, `:517`, `:523`, `:531` set `process.exitCode = 1`; `:498` and `:522`
write `c.red('✗ ') + message` to **stderr** first. That spelling is byte-identical to `die`'s and the
mechanism is not: the process finishes writing. `packages/cli/src/fail.ts` already names all four
line numbers as the reason `failSoftly` exists, so the frame was built for this command.

**M-9 — two smaller facts worth writing down once.** `packages/cli/src/commands.ts` cites the spike
header lines for `lint` and `validate` as `:6` and `:8`; measured they are `:7` and `:9`. Nothing
depends on it and no erratum is owed — but `runs` is header line **10**, the last, which is
unambiguous either way and settles where it goes in `HELP`. And `core` carries **two** spellings of
the ticket-id grammar: `parseTicketId` in `@quorum/shared` (the capturing form, exported from that
barrel) and `TICKET_ID_PATTERN` in `reader.ts` (the test form, not exported from `core`'s barrel).
Q-0080's ruling is one spelling per tree; OQ-2 recommends which the CLI uses and registers the
duplicate.

---

## 2. Problem

**For the `maintainer`.** `quorum` can lint flows and validate artifacts, and it cannot answer the
question the product exists to answer: *what did that run cost, and what did each step do?* Run
history has been on disk since Q-0011 and `packages/core` has read it since Q-0049, but the only
thing that can show it to a human is `spike/bin/harness.js` — the tree the cutover deletes. Until
`quorum runs` exists, every cost figure in `docs/06-development-plan.md` is obtained by running the
spike, and the binary a stranger installs cannot report on the runs it just performed.

**For the port.** This is the second of Q-0010's four command children and the one that carries a
*ruling* rather than only a translation. Q-0037's OQ-2 was settled on 2026-09-01: **an occurrence's
usage is not a roll-up row and is not rendered as one.** That decision exists because the two were
collapsed once and the collapse survived a review — a roll-up field synthesised onto a single
occurrence where it can only be 0 or 1, and four separately measured fields folded into one sum on
the line whose whole job is to show what one step reported. A `packages/cli` that re-collapses them
reintroduces Q-0011's round-2 nit 5, and the guards that catch it are two blocks in two views, not
one (M-4).

**What is not the problem.** The reading is done. `readRunsDir`, `sortRuns`, `isIncomplete`,
`occurrenceSeq`, `vendorTokenTotal` and `resolveRunDirectory` are in `core`, tested there, and
`reader.ts` writes nothing and does not import `writer.ts`. What is missing is a **presentation
layer**, an **export surface** (M-1) and **one reader** (M-2).

---

## 3. User stories

**`maintainer`** — *I have just paid for a chore run. I want `quorum runs Q-0092` to list its runs
newest first with each vendor's cost and tokens separately, and `quorum runs Q-0092-3` to show me
every occurrence in order with what it billed, so that I can write down what the ticket cost without
opening a JSON file.*

**`maintainer`** — *When a run directory is damaged I want the listing to name it, render its healthy
siblings anyway, and exit non-zero — so that a store problem is visible without costing me the
history I asked for.*

**`adopter`** — *`quorum help` tells me `runs` exists and what it takes. Running it in a repository
with no history prints an empty state and exits 0, rather than a stack trace or silence.*

**`contributor`** — *`quorum runs --json` gives me one ANSI-free document I can pipe into `jq`, and
its exit code tells me whether the store was healthy — so a script can consume run history without
scraping a terminal.*

---

## 4. Size: thirteen criteria, and why this is one ticket

`harness/roles/head-of-product.md:12` puts a ticket at about ten criteria and rarely more than
fifteen. This is thirteen, and no split is proposed. The reasoning is measured rather than asserted:

- **One command, one case block, one module.** M-3 forces the presentation into `runs.ts`. There is
  no seam inside it that a second ticket could own without both halves editing the same file.
- **The barrel change is not separable.** `runs` is the only command that needs the six reader
  symbols, so a "surface" ticket would be a scan narrowed with no consumer in the tree — the shape
  Q-0091's E-1 refused for the same reason.
- **The two views are one behaviour.** List and detail share `runHeaderLine`, `statusLabel`,
  `isIncomplete` and the money/token formatters; the Q-0037 ruling is precisely about the *contrast*
  between them, so splitting them puts a ruling's two halves in two tickets.

Where this differs from Q-0091 — which had to split at 21 — is that there the seam was already
visible in the spike source: `lint` and `validate` end in `process.exit`, `board` and `adapters` end
in `return`. Here there is one case block and no such line.

---

## 5. Acceptance criteria

Numbered, independently testable. Each names its surface. **Every criterion is `packages/**` unless
it says otherwise; nothing in `spike/` is edited, per ground rules 1 and 2.**

### AC-1 — `runs` is a registered command, dispatched through the frame

**Surface: `packages/cli/src/commands.ts`, `packages/cli/src/main.ts`.**

`COMMANDS` gains `'runs'` and `HANDLERS` gains its entry, so the two cannot drift (the record is
keyed by `Command`, and either half alone fails to compile). `HELP` gains one line carrying the
information of `spike/bin/harness.js:10` — the command, what it takes, and what it does — rewritten
rather than transcribed, in the product's own name and aligned to the existing description column. It
goes **last**, because that header line is last (M-9).

*Test:* `commands.test.ts`'s existing derivation — the names it reads out of `HELP` must be exactly
`COMMANDS` — passes with four entries rather than three, and a `HELP` naming a command not in
`COMMANDS` still fails. `invoke(['runs'])` reaches the handler rather than printing the help, which
is what an unregistered command would do.

### AC-2 — the presentation layer is one command module, and the frame/command partition still holds

**Surface: `packages/cli/src/runs.ts`, `packages/cli/src/frame.source.test.ts`.**

The ten functions the ticket body names — `formatMoney`, `formatTokens`, `formatVendorSummary`,
`formatOccurrenceUsage`, `statusLabel`, `runHeaderLine`, `printRunsListHuman`, `runsListJSON`,
`printRunDetailHuman`, `runDetailJSON` — and the command handler live in `runs.ts` and nowhere else.
A second production module is permitted only if it names no symbol in `DOMAIN` (M-3).

`frame.source.test.ts`'s `node:path` clause moves from `['lint.ts']` to `['lint.ts', 'runs.ts']`:
`runs.ts` joins the runs root, relativises the manifest path, and normalises the occurrence directory
to forward slashes, all of which the spike does with `node:path`. The package-wide `IO_MODULE`
prohibition is **unchanged** — `runs.ts` imports no `node:fs`.

*Test:* the AC-10 and AC-11 blocks in `frame.source.test.ts` pass unmodified except for that one
list, and the mutation demonstrations beside them still fire. Adding `import fs from 'node:fs'` to
`runs.ts` turns the `IO_MODULE` assertion red with `runs.ts` named.

### AC-3 — `core` gains the one reader that is genuinely absent, and reads exactly one run

**Surface: `packages/core/src/run-history/reader.ts`,
`packages/core/src/run-history/run-history.source.test.ts`.**

`core` exposes a way to select **one** run by token and read its manifest, without the caller
touching `node:fs` and without parsing any sibling. Three outcomes must be distinguishable by the
caller:

1. **a run** — the resolved directory, the manifest path, and the parsed document;
2. **not a run** — the token names nothing inside the runs root, disclosing nothing about what it
   pointed at (this is `resolveRunDirectory`'s existing contract and its `null`);
3. **malformed** — the manifest is there and does not parse, carrying **the parser's own words**, so
   the CLI can print `run "<token>": malformed manifest.json (<message>)` byte for byte.

It writes nothing, and `reader.ts` still does not import `./writer.js`.

**Recommended shape** (OQ-1, non-blocking): one function taking `(runsRoot, token)` and answering a
discriminated result, so the confinement and the read stay paired — that pairing is where Q-0034's
realpath lesson lives, and separating them invites a caller to resolve lexically and read anyway. The
alternative — exporting `resolveRunDirectory` and a `readRunManifest(runDir)` beside it — satisfies
this criterion equally and is named in OQ-1.

*Test:* `run-history.source.test.ts`'s reader identity pin moves from eight names to nine, and is
**shown red against the old list** rather than edited to fit. A fixture with a genuine run, a
non-existent token, an out-of-root symlink and a run whose `manifest.json` is `{broken` exercises all
three outcomes; the malformed case's message contains the parser's text.

### AC-4 — the barrel exports the six symbols the command needs, and not a seventh

**Surface: `packages/core/src/index.ts`, `packages/cli/src/frame.source.test.ts`,
`packages/cli/src/package.test.ts`.**

`@quorum/core` gains `readRunsDir`, `sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal`
and AC-3's reader — six values — plus the types the signatures name (`RunEntry`, `RunWarning`,
`RunManifest`, `VendorRollup`, `Occurrence`, `OccurrenceUsage`), **exported by name, never
wholesale**, so they add no runtime key.

`manifestShapeError` is **not** exported: no command calls it (M-7), and the barrel's rule is that a
name is added because a command needs it. `TICKET_ID_PATTERN` is not exported either — see OQ-2.

`DOMAIN` gains the six (14 → 20) and `COMMAND_DOMAIN` gains a `'runs.ts'` row naming exactly the
domain symbols that module names, `loadProject` among them.

*Test:* `package.test.ts`'s identity — `Object.keys(barrel).sort()` equals `[...domain(), ...ERRORS]`
— passes over the new lists, and its `toHaveLength(14)` register-has-a-subject pin is moved with a
companion assertion that the register **no longer holds the fourteen it held before this ticket**,
which is Q-0091's own pattern for a moved pin. An entry in `COMMAND_DOMAIN['runs.ts']` permitting a
symbol `runs.ts` does not name fails, and so does a symbol `runs.ts` names that the entry omits — both
demonstrated on mutated copies.

### AC-5 — selection and ordering follow the frozen contract exactly

**Surface: `packages/cli/src/runs.ts`. Authority: `contracts/Q-0011/runs-cli.contract.md`.**

- `quorum runs` with no token lists every readable manifest.
- A token that names an existing run directory **wins** and selects detail.
- Otherwise a token matching `^[A-Z]+-[0-9]{4}$` is a `ticket_id` filter over manifests only. Zero
  matches over a healthy store is an empty list and **exit 0**, whether the ticket has never run or
  does not exist. `backlog/` is never consulted.
- Any other token is an unknown-run error.
- List order is `started_at` **descending**, then `run_id` **ascending in plain string order** — so
  with equal timestamps `Q-0011-10` precedes `Q-0011-2`. Not a numeric sort; `sortRuns` already
  decides this and the CLI does not re-sort.
- A missing runs root prints the empty state and exits 0.

*Test:* the translated form of `q0011-runs-cli.js:29–54` — three runs across two tickets plus a
`bad/` sibling; every id present; the documented order asserted by index; the filter excluding the
other ticket; `Q-9999` over a **clean** store exiting 0 and over the corrupt store exiting non-zero
(erratum E-4's split, both clauses kept); `q-0011` and `Q-11` both refused; and an empty fixture
printing the empty state at exit 0.

### AC-6 — the confinement guard holds through the command, and discloses nothing

**Surface: `packages/cli/src/runs.ts`.**

The five tokens `q0034-review-fixes.js` B4 drives — `../secret`, `.quorum/secret`, an absolute path,
`..` and `.` — are each refused with a non-zero exit and disclose nothing of the document they point
at, in `--json` mode as well as human mode. A **single-segment symlink inside the runs root pointing
out of it** is refused too: it passes every lexical test, and only resolving both sides for real sees
through it.

The CLI does not reimplement any of this. Confinement is `core`'s (`resolveRunDirectory`, and AC-3's
reader through it), which is the whole point of the Q-0049 AC-11 clause that gave that function its
`realpath` half.

*Test:* B4's five tokens translated, plus the out-of-root symlink case, asserting on the exit code
and on the absence of the planted marker in stdout. The symlink fixture is built under `os.tmpdir()`
and removed after, as `reader.test.ts` does.

### AC-7 — the four failure paths are soft, and a store warning always forces a non-zero exit

**Surface: `packages/cli/src/runs.ts`, `packages/cli/src/fail.ts`.**

No path of this command calls `die`. All four use `failSoftly`, so a listing that reports a warning
still prints the listing (M-8):

| path | what is printed | where | status |
| --- | --- | --- | --- |
| detail, manifest will not parse | `run "<token>": malformed manifest.json (…)` | stderr, or one JSON object on stdout | 1 |
| ticket filter with store warnings | the filtered listing, then each warning | stdout | 1 |
| unknown run or ticket | `unknown run or ticket: <token>` | stderr, or one JSON object on stdout | 1 |
| full listing with store warnings | the listing, then each warning | stdout | 1 |

The human error lines are `c.red('✗ ') + message` — the same spelling `die` uses, deliberately, and
the *mechanism* is what differs.

*Test:* each of the four exercised through `invoke`, asserting `exitCode === ERROR` **and**
`hard === false`, and that the output that precedes the failure is present. `fail.test.ts`'s existing
demonstration that the two mechanisms differ is unchanged. A missing project is the one hard exit:
`loadProject` throws `ProjectNotFoundError`, which is caught and passed to `die`, exactly as `lint.ts`
does — uncaught it would reach `dieOnUnexpected` and print a Node stack where the spike prints a
sentence.

### AC-8 — the human listing renders the roll-up, and never a cross-vendor money total

**Surface: `packages/cli/src/runs.ts`.**

Each run is one header line — run id, ticket, flow, stage `before -> after`, status, duration — with
`(incomplete)` appended when `status` is `running` or `ended_at` is null; a missing `duration_ms`
reads `duration=n/a`; an absent stage endpoint reads `?`. Beneath it, one indented line per roll-up
row: `<vendor>: cost=<money> tokens=<total> unpriced_steps=<n>`.

- money is three decimals or `n/a`, never two — at two, a real `$0.004` step renders `$0.00` and
  becomes indistinguishable from a vendor that reported zero;
- `tokens` is `vendorTokenTotal`'s sum of input and output. The cache pair is a **breakdown and never
  a summand**: input totals already contain every vendor-reported cache component;
- every summary states `unpriced_steps`;
- **there is no combined money total** across vendors, and no combined token total.

Then the warnings, one line each, naming the run directory.

*Test:* B2's list half translated — a well-formed claude row and the malformed codex row beside it —
asserting `claude: … tokens=1100`, **no `1350` anywhere**, and `codex: … tokens=n/a`. Plus
`q0011-runs-cli.js:35–39`: `cost=n/a` for the unpriced vendor, `unpriced_steps=0` and
`unpriced_steps=1` on their own rows, and no line matching a combined or total money figure.

### AC-9 — the detail view renders an occurrence's own usage, and no roll-up field

**Surface: `packages/cli/src/runs.ts`. Authority: Q-0037 OQ-2, ruled 2026-09-01.**

Occurrences are ordered by the **numeric** prefix of `occurrence_dir` (`occurrenceSeq`), so
`steps/002-` precedes `steps/010-`. Each is two lines: the step id with its project-relative
occurrence path in forward slashes, then `kind`, `adapter`, `model`, status, `started_at`,
`duration_ms`, `attempts` and `verdict`, with `n/a` for each absent value. Then `usage: ` and, where
the occurrence has one:

> `<vendor>: cost=<money> input_tokens=<n> output_tokens=<n> cached_input_tokens=<n>
> cache_write_input_tokens=<n>`

**The four measures print separately, each through the token formatter, so a null reads `n/a` and
never `0`. `unpriced_steps` does not appear** — over a single occurrence it can only be 0 or 1 and
says nothing the status does not. Summing stays the roll-up's business. An occurrence with no usage
prints `usage: n/a`; an occurrence with an error prints `error: <category>: <message>`.

An incomplete manifest is labelled, with its **project-relative path named**, and no other file is
required to decide completeness.

*Test:* B2's per-step half translated — the four fields at their own values, **no `1350`**, and
`unpriced_steps` absent from the whole detail output. Plus `q0011-runs-cli.js:56–72`: occurrence order
asserted by index; a failed occurrence with `usage: null` still exposing its category and message; the
incomplete label naming `manifest.json`; and the manifest **read back byte-identical afterwards**,
because a reader repairs nothing. Plus `q0011-run-history.js:121–124`: a billed failure's usage
survives into a separate reader process, which is the assertion that proves this view reads the file
rather than the run's memory.

### AC-10 — `--json` is one ANSI-free document in every mode, including both errors

**Surface: `packages/cli/src/runs.ts`.**

`--json` emits exactly one JSON document as all of stdout, with no escape byte.

- **list** — `{ mode: 'list', runs: [...], warnings: [...] }`, each run carrying `run_id`,
  `ticket_id`, `flow`, `stage`, `status`, `started_at`, `ended_at`, `duration_ms`, `incomplete` and
  `rollup`; each warning as `"<runId>: <message>"`;
- **detail** — `{ mode: 'detail', run: <the manifest as read>, incomplete, manifest_path, warnings: [] }`,
  where `manifest_path` is project-relative;
- **either error** — `{ error: "<the same sentence the human mode prints>" }`, on **stdout**, with a
  non-zero exit.

*Test:* `q0011-runs-cli.js:73–81` translated: for list and detail, stdout parses as one document and
contains no `\x1b[`; the unknown-token case exits non-zero and, where it printed anything, that too
parses. The detail document's `run` is deep-equal to the manifest on disk, which is the assertion that
catches a reader that reshapes what it read.

### AC-11 — a detail request reads only the run it was asked for

**Surface: `packages/cli/src/runs.ts`. Authority: `runs-cli.contract.md`, Q-0034 AC-13.**

Selecting one run must not parse its siblings. A repository with a year of history must not pay for
every manifest to answer a question about one.

*Test:* two forms, and the first is required. **Observable:** a fixture holding one healthy run and
one damaged sibling; `quorum runs <the healthy id>` exits 0, prints the detail, and names the damaged
sibling **nowhere** — where the same store listed exits 1 and names it. **Stronger, recommended:**
count reads, as `q0011-runs-cli.js:194–204` counts them for `validateArtifact` — the sibling's
`manifest.json` is read zero times. The property is invisible in the output otherwise, which is why
the spike's `listRuns` is a closure and carries a comment saying so.

### AC-12 — the preserved defects are reported, pinned and not fixed

**Surface: `packages/cli/src/runs.ts`, `packages/core/src/run-history/reader.ts` (comments only).**

Ground rule 3. Each carries a one-line `Why:` naming its authority, and none is repaired:

1. **The list and the detail disagree about a symlinked run directory.** `readdirSync` with
   `withFileTypes` has `lstat` semantics, so a symlink to a sibling run is silently absent from a
   listing while `resolveRunDirectory` accepts it. Two answers to one question. Already recorded at
   `reader.ts:111–114`; the CLI inherits it and says so.
2. **`vendorTokenTotal` answers `null` when both totals are null while the cache fields are
   populated.** Ruled by Q-0037 a *ruling* rather than a fix: no adapter can produce that row, and
   `n/a` is the honest rendering of absent summands. Summing 700+250 would print a number that is not
   a token total in the one place run history exists to report one.
3. **The binary is called `harness` in `ProjectNotFoundError`'s message**, which `runs` reaches
   through `loadProject` exactly as `lint` does. **Q-0100's**, registered and not touched here — that
   ticket exists to rule the class once rather than per command.
4. **`manifestShapeError` proves five things and casts.** A manifest that passes it can still carry a
   field of the wrong type, so a formatter can meet one. Deliberate: refusing here would make a
   listing fail on a sibling's damage.
5. **`runDetailJSON`'s `warnings` is always the empty array.** A detail request collects none by
   construction; the key is present so the two modes have one shape.

*Test:* defects 1 and 2 pinned by assertion — the symlink case in both views, and the malformed row
reading `n/a` — so a later "fix" is a deliberate act rather than a silent one. 3, 4 and 5 are recorded
in comments with their authority; the sentence in 3 is not edited.

### AC-13 — the parity register records the translation, and its totals are re-derived

**Surface: `packages/core/src/spike-parity.test.ts`. Authority: ground rule 5, Q-0091 erratum E-2.**

Four rows are corrected, because four files carry `runs` coverage (M-5):

- `q0011-runs-cli.js` — `binaryCarriedBy` gains this ticket's counterpart, and `binaryHalf`'s prose
  stops saying *"What remains is `harness runs` … — Q-0092"*;
- `q0011-run-history.js` — `binaryHalf` is re-attributed from the generic "Q-0010" to this ticket and
  gains `binaryCarriedBy`; its one invocation is a `runs` detail assertion, not a parent's;
- `q0034-review-fixes.js` — `binaryHalf` names B2 and B4 as carried here, gains `binaryCarriedBy`, and
  keeps B3's `FlowError` routing as Q-0094's;
- `q0080-allocation.js` — prose only (OQ-3): its `runs` line is a duplicate of an assertion translated
  under AC-5, and its binary half is dominated by `ticket new`, which is Q-0093's.

`binaryCarriedBy` is permitted on `cli` and `split` and validated as `carriedBy` is — existence and
collection failing separately. It is **additive**: naming a counterpart does not claim the file's
binary half is complete, which is what the prose records.

**The line totals are re-derived, not adjusted.** No file under `spike/` is edited, so
`linesOf(named('binary-only')) === 220`, `both === 2739`, `library-only === 2469`, `total === 5428`
and the transfer share `55%` are all expected to hold. Stated rather than skipped: *"it did not move"*
is a measurement and a silent share is the defect the register exists to prevent.

*Test:* `audit()` returns no problem over the edited register; a `binaryCarriedBy` naming a file that
does not exist and one naming a file no include collects fail **separately**; and the five totals
above are asserted at their current values.

---

## 6. Non-goals

1. **No new command.** `board`, `adapters`, `init`, `ticket` and `run` stay unimplemented — Q-0099,
   Q-0093 and Q-0094.
2. **No change to `spike/`.** Not `spike/src` (ground rule 1, and the port freeze is recorded at
   `7fd540b`), not `spike/test` (ground rule 2). No freeze re-record is owed.
3. **No fix to any preserved defect in AC-12**, and no fix to Q-0059, Q-0060, Q-0066 or Q-0068.
4. **The binary name is not renamed here.** Q-0100 owns the class; a `sed` is explicitly refused by
   that ticket, because the folder is `harness/` and the concept is a harness.
5. **No cap, truncation or pagination on run history.** Q-0076 owns whether run history is archival or
   diagnostic, and the answer decides the treatment.
6. **No colour policy.** No TTY test, no `NO_COLOR`, no `FORCE_COLOR` — Q-0090's non-goal 11 stands,
   and `--json` is already escape-free by construction rather than by stripping.
7. **No new output.** No sorting flag, no `--limit`, no filter beyond the contract's ticket-id
   selection, no cross-vendor total. The contract forbids the last of these by name.
8. **`readRunsDir`'s eager sibling parse is not optimised.** AC-11 is about *not calling it*; making
   it lazy is a `core` change with no consumer asking for one.
9. **The two ticket-id grammars are not unified.** OQ-2 registers it; unifying them touches
   `backlog.test.ts`'s import and is a `core` question.
10. **No decision entry is owed.** Every ruling this ticket rests on is already written — Q-0037's
    OQ-2, Q-0091's E-2, Q-0096's export-surface ruling and decision 078. Nothing here contradicts one.

---

## 7. Open questions

**None is blocking.** Each carries a recommendation the implement step may act on.

**OQ-1 — the shape of `core`'s single-run read (AC-3).** Two shapes satisfy the criterion. **(a)** One
function `(runsRoot, token)` answering a discriminated result, keeping confinement and read paired.
**(b)** Export `resolveRunDirectory` and add `readRunManifest(runDir)` beside it, letting the CLI
compose them. **Recommended: (a)**, because the pairing is where Q-0034's realpath lesson lives and
(b) leaves a caller free to resolve lexically and read anyway — which is the defect that path was
opened to close. (b) costs one extra barrel symbol and is otherwise equivalent. Either way
`run-history.source.test.ts`'s identity pin moves and must be shown red first.

**OQ-2 — which ticket-id grammar the command uses.** `core` carries two (M-9). **Recommended:**
`parseTicketId` from `@quorum/shared`, which is what the spike uses, what `Backlog` uses to allocate,
and what keeps Q-0080's *one spelling per tree* true across `runs` and Q-0093's `ticket new`. It is a
declared dependency of `packages/cli` and pure — it reads nothing and spawns nothing. Note it would be
the package's first **value** import from `@quorum/shared` in production source, `exit.ts`'s being a
type; that is a fact, not an objection. `TICKET_ID_PATTERN`'s duplication in `reader.ts` is registered
in a comment and left for a `core` ticket.

**OQ-3 — `q0080-allocation.js`'s register row.** **Recommended: prose only, no `binaryCarriedBy`.**
Its `runs` line asserts a ticket-id filter with zero matches exits 0, which AC-5 already translates
from `q0011-runs-cli.js:47`; the file's binary half is `ticket new`'s refusal text, which is Q-0093's.
Claiming a counterpart there would read as more done than is done. Recorded because a reviewer will
otherwise ask why one of the four census rows has no field.

**OQ-4 — whether the frozen contract's first sentence needs an erratum.**
`contracts/Q-0011/runs-cli.contract.md` opens *"The reader lives entirely in
`spike/bin/harness.js`"* — a **location** claim that the port necessarily falsifies, as it falsified
the same claim for `lint` and `validate`. **Recommended: no.** Charter §2 preserves behaviour, not
location, and Q-0091's E-3 already ruled that this contract's prose states what must be *conveyed*
rather than a literal to match. The sentence is noted in `runs.ts`'s module comment so a later reader
meets the reasoning rather than the contradiction.

---

## 8. Risks

**R-1 — four landed pins move, and moving them by adjustment is the failure mode.** `DOMAIN`'s length,
the barrel identity, the `node:path` command list, and `reader.ts`'s export identity. Every one is an
identity assertion that will fail with a clear message, and the temptation is to edit it to fit. Q-0091
and Q-0096 both moved pins by demonstrating them red against the superseded value first; this ticket
does the same, and AC-3, AC-4 and AC-13 each say so.

**R-2 — splitting the presentation into a helper module turns AC-10 red, and the error message will
not obviously say why.** The failure reads *"X belongs to @quorum/core and to a command"*, which
sounds like a mis-import rather than *"this module is not named after a registered command"*. M-3 is
the warning; the remedy is to keep the layer in `runs.ts`, not to widen `COMMAND_DOMAIN`.

**R-3 — the ticket body's B2 sentence, followed literally, restores the defect Q-0037 fixed.** An
implementer aiming the double-count guard at the detail view would reproduce, exactly, the mistake the
file's own comment records. M-4 is the correction and AC-8/AC-9 are the two criteria; the file at
`spike/test/q0034-review-fixes.js:102–106` is the evidence and should be read rather than the body.

**R-4 — reaching for `node:fs` in `runs.ts`.** It is the obvious way to read one manifest and it is
the wrong layer; it turns a landed guard red with a message that names the module. AC-3 exists so this
does not become an argument at review.

**R-5 — a first-pass approve.** 42 of 59 chore reviews to date returned `revise`, and Q-0051's is the
precedent: a clean first review is distrusted and then confirmed, not banked. Two things here are
invisible to reading and must be **run**: AC-11's read-count property, and AC-7's soft-versus-hard
distinction, which produces the same bytes either way.

**R-6 — the reviewer may be unable to execute the suite.** Q-0091 and Q-0096 both recorded a codex
reviewer approving on reading alone because `--sandbox read-only` refused the run. So the exit codes
and the `--json` shapes are verified **through the built binary** at the gate, not taken from the
report — see §10.

**R-7 — an implementer may "tidy" `vendorTokenTotal`'s null or the symlink disagreement.** Both look
like defects because they are; both are ruled preserved with authority. AC-12 pins them so a change is
deliberate.

**R-8 — Q-0039 is unchanged and named.** Two runs on one ticket share a worktree and compute the same
run id. This ticket reads run history and writes none, so it does not widen that hazard; it is named
because the children of Q-0010 that could run in parallel are still run one at a time.

---

## 9. Cross-cutting checklist

| pillar | answer |
| --- | --- |
| **BYOS** | No credential path is added. `runs.ts` is a new production module and is therefore scanned by `frame.source.test.ts`'s package-wide credential guard, whose inventory is a filesystem walk rather than a git listing (Q-0090 E-1). No test, fixture or example names an API key. |
| **Worktree safety** | n/a in the strong sense, and worth stating: this command **writes nothing at all**. It reads `.quorum/runs/` through `core`, whose `reader.ts` reaches for no filesystem write and does not import `writer.ts`. No worktree, branch or ticket is touched. |
| **Human-gated by default** | n/a. `runs` runs no flow and reaches no gate. |
| **Files are the database** | Directly upheld: the whole command is a reader over `.quorum/runs/`, and it repairs and infers nothing. An incomplete run is reported as it stands; a missing field is not defaulted. |
| **Cross-vendor rule** | n/a to the command. Applies to the ticket's own chore run, where the reviewer must not be the implementer's vendor. |
| **Product-agnostic** | No product name appears. The one product-boundary defect in reach is the binary called `harness`, inherited through `ProjectNotFoundError` and registered to Q-0100. |
| **Errors are explicit** | AC-7 is this pillar. Nothing defaults silently: a malformed manifest names the parser's words, an unknown token names the token, a damaged sibling is named and forces a non-zero exit while its healthy siblings still render. |
| **File format and schema** | The run manifest is read, never written and never validated here — `quorum validate` against `contracts/Q-0011/run-manifest.schema.json` is that job, and Q-0091 shipped it. `manifestShapeError` proves only enough to sort and render. |
| **Lint rules** | No flow file changes, so `harness lint` is untouched. `@typescript-eslint/no-deprecated` covers the new modules as it covers every `packages/**/*.ts`. |
| **Cold-clone impact** | One line in `quorum help` and one more command a stranger can run. It **shortens** the first 30 minutes rather than lengthening them: after a first run, the cost and the per-step trace are readable from the binary rather than only from a JSON file. |
| **Docs** | `docs/04-architecture.md`'s `packages/cli` paragraph says *"Since Q-0091 it dispatches two commands"*; that becomes three in the same change, per the docs rule. No numbered doc or decision entry is contradicted. |

---

## 10. Environment and verification

**Install before either suite.** The implement step's worktree has no dependencies:
`pnpm install --frozen-lockfile`, then `npm install --prefix spike --no-audit --no-fund`. Reporting a
suite as unrun is honest; reporting it green without installing is not.

**Both suites, forced.** `pnpm turbo run test --force` and `npm test --prefix spike`. The spike suite
must stay green untouched — that is what ground rules 1 and 2 are for, and a red spike here means
something was edited that should not have been.

**Build before claiming an exit code.** `pnpm turbo run build`, then exercise
`node packages/cli/dist/quorum.js runs …` against a fixture repository. Six statuses are the claim and
each is verified by execution rather than from a report:

| invocation | expected |
| --- | --- |
| `runs` over a clean store | 0, listing printed |
| `runs` over an empty store | 0, empty state printed |
| `runs` over a store with a damaged sibling | 1, listing **and** warning printed |
| `runs <ticket>` with zero matches, clean store | 0 |
| `runs <run-id>` | 0, detail printed |
| `runs ../secret --json` | non-zero, nothing disclosed |

**Verify in both environment rows** (Q-0072's closing finding): once in the `integrate` worktree,
which has neither `.harness/worktrees` nor `.quorum/runs`, and again forced on `main` after the merge,
where both exist. `turbo-inputs.test.ts`'s existence-independence is the guard that was built for
exactly this, and a new read of `os.tmpdir()` or of a new path may earn a registration on the way in.

**Run the git-identity sweep.** `pnpm sweep:git-identity` — byte-identically what CI runs, and
runnable in a linked worktree since Q-0058.

**Two properties are invisible unless run** and are checked by mutation at the gate rather than read:
AC-11's read-count (a sibling's manifest is read zero times for a detail request) and AC-7's
soft-versus-hard exit (identical bytes, different mechanism — `fail.test.ts`'s existing demonstration
is the model).

---

## 11. Provenance

Read for this document, at `2c42a4d`: `spike/bin/harness.js` (`:1–10`, `:124–300`, `:462–533`);
`spike/test/q0011-runs-cli.js`, `q0011-run-history.js`, `q0034-review-fixes.js`,
`q0080-allocation.js`; `packages/core/src/run-history/reader.ts`, `manifest.ts`,
`run-history.source.test.ts`, `reader.test.ts`; `packages/core/src/index.ts`, `index.test.ts`,
`spike-parity.test.ts`; `packages/cli/src/` in full — `commands.ts`, `main.ts`, `argv.ts`,
`colour.ts`, `exit.ts`, `fail.ts`, `lint.ts`, `validate.ts`, `quorum.ts`, `index.ts`,
`frame.source.test.ts`, `package.test.ts` — and `packages/cli/test/invoke.ts`;
`packages/shared/src/constants.ts`; `contracts/Q-0011/runs-cli.contract.md`;
`backlog/Q-0091-…/requirements/errata.md` and `merged.md`; `harness/port-charter.md`;
`docs/04-architecture.md`; `docs/06-development-plan.md`; `harness/rules.md`;
`harness/product-context.md`.

Measured by execution: the `'runs'` census across `spike/test/` (four files); `wc -l` on the four;
the scenario boundaries in `q0011-runs-cli.js`; the four `process.exitCode` sites in the `runs` case;
the spike header line numbers; `grep` for `manifestShapeError`'s call sites and for
`TICKET_ID_PATTERN`'s.

**Nothing in §1 is inherited from the ticket body, from Q-0010's body, or from
`docs/06-development-plan.md`.** Three of those five corrections exist because a figure was
transcribed rather than re-run — which is the class this repository keeps recording, and the reason
this section is first.
