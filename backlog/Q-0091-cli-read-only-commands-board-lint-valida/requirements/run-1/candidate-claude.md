# Q-0091 — CLI read-only commands: `board`, `lint`, `validate`, `adapters`

*Requirements, run 1, candidate-claude. Written against the tree at `5cc23c7`, not against the
ticket body: four of the body's premises are corrected below, with the measurement each time.*

---

## 0. What was measured, and what the ticket body gets wrong

The body's spike line map is **right** and is the only inherited figure that survived re-measurement.
`grep -n "    case '"` gives `board` at `:353`, `lint` at `:400`, `adapters` at `:406`, `validate`
at `:426`, `runs` at `:462` — so 47 + 6 + 20 + 36 = **109 lines**, exactly as claimed. Everything
below is a correction.

**M-1. The inherited coverage is 696 lines, not 698, and neither component figure is right.**
`wc -l` gives `q0033-surface.js` **476** (body: 446) and `q0036-board-containment.js` **220** (body:
221). The body's own arithmetic is also internally inconsistent — 446 + 221 is 667, not 698. The 220
is independently confirmed: `packages/core/src/spike-parity.test.ts` pins `linesOf(named('binary-only'))`
at 220 and `q0036-board-containment.js` is the only file in that class.

**M-2. The coverage is spread across five files, not two, and the body's grouping rationale is
false.** "Grouped because … their two test files cover them together" does not hold:

| file | lines | what of Q-0091 it carries | who else owns it |
| --- | --- | --- | --- |
| `q0036-board-containment.js` | 220 | **all of `board`** — 13 invocations, C1–C10 | nothing |
| `q0033-surface.js` | 476 | `lint` at `:73` (the `lintFixture` helper), `:142`, `:271`; one `board` row at `:342` | `init` (Q-0093), `run` + gate answers (Q-0094) — 16 of its 20 invocations |
| `q0011-runs-cli.js` | 220 | **all of `validate`** — 8 invocations, including the skip notice at `:94` and `:114` | `runs` (Q-0092) |
| `q0040-undecided.js` | 413 | one `validate` invocation at `:404` | the five gate sites (Q-0094) |
| `smoke.js` | 780 | `lint` `:40`, `board` `:123`, `adapters` `:129`, `validate` `:647–648` | Q-0095 |

The consequence is not cosmetic. **`validate`'s entire binary half lives in a file the cut assigns
to Q-0092**, and `q0011-runs-cli.js`'s register entry says so in as many words: its `binaryHalf` is
*"`harness runs` listing and detail, including its exit codes, **and the skipped-check notice as the
CLI actually prints it**"*. So Q-0091 and Q-0092 both have work in that one entry, and neither can
translate the file wholesale. Q-0091 translates a **command-scoped set of behaviours across five
files**, never a file.

**M-3. `currentBranch` is not `board`'s, and `loadFlow` is.** The body's table says `board` needs
`currentBranch`. It does not: `spike/bin/harness.js:287` defines it and `:326` is its only call
site, inside `init` — Q-0093's. What `board` actually reaches that the table omits is `loadFlow`,
at `:355`. A port working from the table would have carried a helper `board` never calls and missed
one it does.

**M-4. Two symbols these commands need are not on `@quorum/core`'s public surface.** The barrel
(`packages/core/src/index.ts`) exports sixteen names. `readData` — which `validate` calls at
`:437` so an unreadable schema dies with its own message before any artifact is opened — is exported
from `contracts/contracts.ts:115` and **not re-exported**. `ProjectNotFoundError` — thrown by
`loadProject`, which all four commands call first — is exported from `backlog/project.ts:32` and
**not re-exported**, while the barrel's own doc comment says the three error classes it does carry
are "the error classes a caller has to catch". This is Q-0096's finding arriving one layer down: a
run measured what the cut assumed.

`STAGES` is fine — it is `@quorum/shared`'s (`stages.ts:20`), and `packages/cli/package.json`
already declares that dependency.

---

## 1. Problem

The `maintainer` has a `quorum` binary since Q-0098 that prints its own help and nothing else. The
four commands that only read — the board they check before starting work, the lint that tells them a
flow file is wrong, the validate a `qa-red` script step calls, and the adapters check that is
supposed to be run *before* a paid run — exist only in `spike/bin/harness.js`, which is not what
`pnpm exec quorum` runs.

For the `adopter` this is the sharper problem. `quorum adapters` is the second thing the README will
tell a stranger to type, immediately after `init`, and it is the command that proves the BYOS
promise: that Quorum refuses to run on anything but the vendor CLI's own subscription. Today the
binary they installed cannot answer.

Underneath both is a state the repository has not been in before. `packages/cli` carries five landed
guards written when *no command existed* and asserting, in effect, that none does:
`frame.source.test.ts`'s `DOMAIN` scan forbids any production module from naming `Backlog`,
`containment`, `lintDirectory`, `getAdapter`, `probeAdapter`, `validateArtifact` or `loadProject`;
its `IO_MODULE` scan forbids importing `node:path`; `commands.test.ts` pins `COMMANDS` to `['help']`;
`main.test.ts` asserts every invocation leaves the tree byte-identical; and `package.test.ts` pins
the core barrel at thirteen domain symbols plus three errors. Q-0091 is the first ticket that must
move all of them. **A ticket that moves five guards is the ticket most likely to weaken one**, which
is why a third of the criteria below are about the guards rather than about the commands.

And one guard cannot be satisfied as the ticket body asks. Ground rule 5 requires
`spike-parity.test.ts` to be updated so it does not "leave a register saying the work is still
owed". Measured, it cannot say anything else: `admissible()` at `:887` allows a file that reaches the
binary and imports no spike source **only** the verdict `cli`, and `audit()` at `:945` fails a `cli`
entry that names counterparts. `q0036-board-containment.js` is exactly that file. The register's
vocabulary was designed by Q-0054 for a two-suite world — spike against `packages/core` — and has no
value for *"this binary half is now carried by `packages/cli`"*. §5 rules on it.

---

## 2. User stories

- **As the `maintainer`**, I run `quorum board` in my repository and see every ticket by stage with
  its containment token, so that I can tell a ticket whose stage says `reviewed` from one whose code
  is actually in `main` — without going back to the spike binary.
  *Surface: CLI.*
- **As the `maintainer`**, I run `quorum lint` after editing a flow file and get the same
  per-file diagnostic the spike gives me, exit 1 when a flow is broken, so I find out before a run
  bills a vendor.
  *Surface: CLI, reading `harness/flows/`.*
- **As the `adopter`**, I run `quorum adapters` as my second command and it tells me which vendor
  CLIs are present — and refuses, naming the variable, if I have a key in my environment — so I
  learn that this product runs on my subscription and not on a key before I have invested any time.
  *Surface: CLI.*
- **As the `contributor`**, `quorum validate <schema> <file…>` exits 1 on a non-conforming artifact
  so a `qa-red` `type: script` step turns red on a contract violation, and prints the notice
  `contracts/Q-0011/runs-cli.contract.md` requires when no semantic contract applies — so a skip is
  never read as a pass.
  *Surface: CLI, called from a flow's script step.*

---

## 3. Acceptance criteria

Numbered from AC-1. Q-0091 inherits no numbering: the AC-22 to AC-26 space Q-0097 and Q-0098 shared
belonged to the split of Q-0096's single 21-criterion body, and this ticket was never part of it.

### The surface exists

**AC-1 — the frame registers exactly four new commands, and the help says what they do.**
`COMMANDS` becomes the five names, `HELP` gains four lines, and `HANDLERS` gains four entries — the
`Record<Command, CommandHandler>` type makes a name without a handler, or a handler without a name,
fail to compile. The help lines preserve the *information* of `spike/bin/harness.js:4–9` (the flags
each command takes, and what it does) and its ordering relative to the other commands, but are
**rewritten rather than transcribed** because three constraints bind them at once: they must name
`quorum` and never call the product a harness (`commands.test.ts`'s existing clause, and
`.claude/rules/product-boundaries.md`); they must not use the words "API key", "token" or
"credential", which `harness/product-context.md` forbids and for which the word is **subscription**
— so the spike's `CLIs installed + no API keys` may not survive as written; and they must not match
any pattern in `frame.source.test.ts`'s `CREDENTIAL` list.
*Test:* `commands.test.ts`'s two pins — `expect([...COMMANDS]).toStrictEqual(['help'])` and
`expect(mentioned(HELP)).toStrictEqual(['help'])` — move to the five names and are **demonstrated
red against the old value** rather than edited to fit. The `mentioned()` extraction and the
`isCommand` cross-check are untouched, so a fifth line without a handler still fails.

**AC-2 — no command re-parses the command line.** Each handler takes the `ParsedArgv` the frame
hands it and reads `rest` and `flags` from that object. `board` and `lint` read neither; `adapters`
reads `flags.probe` and `flags.json`; `validate` reads `rest`. No command module calls `parseArgv`,
reads `process.argv`, or defines a second flag table.
*Test:* a source scan over the command modules for `process.argv` and `parseArgv(`, plus a
behavioural test per command driving it through `main(argv)` rather than by calling the handler
directly, so the dispatch boundary is the thing exercised.

### `board`

**AC-3 — the columns and the hint.** Every stage of `@quorum/shared`'s `STAGES`, in that order, with
its name bold-padded to 14 characters; an empty column is skipped **except** `draft`, `requirements`
and `solutioned`, which always render; and a column whose stage some flow `consumes` carries the dim
hint `→ harness run <flow> <id>`.
*Test:* over a fixture with tickets in two stages, asserting the rendered column set and the absence
of the others.

**AC-4 — the ticket row, byte for byte.**
`  <teal id> <title>  <dim>owner=<owner> cost=$<n.nn> iter=<json><token></dim>`, with `cost` the sum
of `history[].cost` to two decimals and `iter` `JSON.stringify` of `meta.iterations ?? {}`.
*Test:* the assertion `q0033-surface.js:342` makes —
`/T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/` after ANSI stripping — plus a non-zero cost row and
a row carrying a populated `iterations` object.

**AC-5 — containment is rendered in the glossary's vocabulary and nothing else.** One token per row,
appended inside the dim span: ` <base>:contained`, ` <base>:not-contained(+<n>)`,
` <base>:indeterminate(<reason>)` — and the base name is read from `config.repo.base_branch`,
defaulted to `main` at the reading site, never assumed. The board says "contained" and never
"merged", "landed" or "shipped". A `stateOf` result of `indeterminate (no branch)` renders **only**
where the stage is one of `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, `deployed`, and is
suppressed at `draft`, `requirements`, `blocked`, `abandoned` and where `containment` returned
`null`.
*Test:* C1–C10 of `q0036-board-containment.js` translated in full — contained, `not-contained(+2)`
counting `base..branch` and never the symmetric difference, the ten-stage sweep of C10, an absent
`branch:` key, a missing base ref, a genuinely shallow clone, a non-git project, a `master`-based
project where the string `main` appears nowhere, the `--upload-pack=` injection value, and a tag
sharing the branch name.

**AC-6 — the two legends, each printed only when a row earned it.** The cost legend prints when any
ticket has a non-empty `history`; the indeterminate legend prints when any *rendered* row was
indeterminate, exactly once, and names all four reasons.
*Test:* C4's assertion that `output.split('git could not answer').length - 1 === 1`, plus a fixture
with no history asserting the cost legend absent and one with history asserting it present.

**AC-7 — the flows are read through `core`, and the order is deterministic.** `board` reaches the
flow set through `lintFlowDirectory(path.join(harnessDir, 'flows'))`, keeping the records that
carry a `flow`, rather than re-implementing the spike's `readdirSync` + `loadFlow` + `catch`. A
missing `flows/` directory is caught and yields no hint rather than throwing its raw `ENOENT`.
**This is a ruled divergence and is registered as one**: the spike's `readdirSync` order is not
specified, `lintFlowDirectory` sorts, and `chore.yaml` and `solutioning.yaml` **both** `consume:
requirements` — so the hint for that column is order-dependent today. Measured on this machine,
`readdirSync('harness/flows')` already returns sorted order, so `chore` wins under both, and the
visible output is unchanged; what moves is a latent non-determinism, not a rendered byte.
*Test:* over the six shipped flows, the `requirements` column's hint is asserted to be
`harness run chore` and the assertion carries the reason; separately, a fixture whose `flows/`
directory does not exist renders the board and exits 0.

**AC-8 — `board` writes nothing and moves no ref.** C1's three-part property: `ticket.md`
byte-identical, `git for-each-ref` unchanged, and the recursive listing of `backlog/`, `harness/` and
`.quorum/` unchanged.

### `lint`

**AC-9 — the rendering is the CLI's and the records are core's.** `core`'s `lintDirectory` returns
`{ ok, records }` with, in its own words, *"no marker, colour, indentation or escape byte
anywhere"*, and the problems already flattened. The CLI adds exactly what the spike's local
`lintDirectory` (`:296–311`) added: `✓ <filename>` in green for a clean file, and for a failing one
`✗ <filename>` in red followed by one `  - <problem>` line per problem. The bullet flattening and
the leading-hyphen strip are **not** re-implemented — `flattenProblems` already does both in `core`,
and a second copy is the transcription defect this repository keeps paying for.
*Test:* the diagnostic-block extraction `q0033-surface.js:38–46` performs, over the shipped flow
directory (clean, exit 0) and over `lintFixture`-shaped directories reproducing the S6.2–S6.10
return-chain cases and S9's multi-file aggregation; plus an assertion that no command module
contains the flattening regex.

### `adapters`

**AC-10 — presence, probe and JSON.** For `claude` then `codex` in that order: `✓ <name>: <version>`
on a successful `check()`, `✗ <name>: <message>` on a throw, with the failing adapter contributing
`{ adapter, installed: false, error }` to the report and the loop continuing. With `--probe`, an
indented second line — `✓ login verified — round-trip <ms>ms`, plus `, $<cost to 4dp>` when
`cost_usd` is non-null and `, <n> tokens` when `tokens` is truthy, or `✗ login not usable: <error>`.
Without `--probe`, the dim presence-only notice. With `--json`, the report as
`{ probed, adapters }` at two-space indent, after the human lines.
*Test:* driven against a stubbed `getAdapter`/`probeAdapter` so no vendor CLI is required, covering
present/absent, probe ok/failed, `cost_usd: null` (which must not render `$0.0000`), `tokens: 0`,
and both flags together.

**AC-11 — BYOS, and the two defects that are reported rather than fixed.**
(a) No file anywhere in `packages/cli` — source, test, fixture, manifest or configuration — matches
any pattern in `frame.source.test.ts`'s `CREDENTIAL` list. The refusal is `core`'s `check()`
(`claude.ts:95`, `codex.ts:89`) and the CLI's only job is to render the message it throws, verbatim,
on the `✗ <name>: <message>` line. **The test proving that rendering does not create a key**: it
makes `check()` reject with the refusal sentence, which is a string the test never has to spell,
because it asserts the CLI reproduces whatever the adapter threw.
(b) The refusal sentence still says *"Harness runs on subscription OAuth only"*. Q-0068's, not this
ticket's — the CLI must not rewrite it on the way through, and a test pins that the message reaches
the terminal unaltered.
(c) **`adapters` exits 0 even when both CLIs are absent**, because `spike/bin/harness.js:424`
`return`s. Preserved, and registered with an authority line rather than carried silently: an
adopter's CI step running `quorum adapters` reports success on a machine with no vendor CLI at all.
*Test:* a case asserting exit 0 with both adapters failing, whose name and comment say the zero is
preserved and name the successor obligation.

### `validate`

**AC-12 — the schema is read once, first, and a bad one dies with its own message.**
`readData(schemaFile)` before any artifact is opened; on a throw,
`die("cannot read schema <file>: <message>")`. Missing arguments die with the usage line
`usage: harness validate <schema.json> <file…>`, unchanged.
*Test:* an unreadable schema, a schema that is not JSON, and both missing-argument shapes.

**AC-13 — per-file outcomes, and the notice a frozen contract requires.** For each data file, in
argv order: a throw prints `✗ <file>: <message>` and counts as bad; where
`semantic.ran === false && semantic.reason === 'unrecognised-annotation'`, the dim notice prints
**before** the verdict; then `✓ <file> matches <schema>` or `✗ <file> violates <schema>:` followed by
the errors, each on its own line indented four spaces. The notice keeps the words *run-manifest
semantic checks were skipped*, is the sentence Q-0037 shipped, and says "no **recognised**
x-quorum-contract annotation" rather than "no annotation" — because that one outcome covers an
absent annotation and a present-but-unsupported one alike, and `contracts/Q-0011/runs-cli.contract.md:46–48`
is frozen and is not this role's to amend.
*Test:* the three shapes `validate-artifact.test.ts` drives — no annotation, `unknown-v1`, and an
empty annotation — through the real renderer, plus a clean run manifest (no notice) and a
semantically broken one (no notice, errors indented).

**AC-14 — the exit code, and it is observable without spawning a process.** Exit 1 if any file was
bad, 0 otherwise, set through `failSoftly()` rather than `process.exit`. Same for `lint`. This is a
ruled divergence from `spike/bin/harness.js:404` and `:460`, on three grounds stated together: the
external status is identical; `fail.ts`'s own doc says the soft path exists so pending output still
reaches the terminal, which is strictly better on a pipe; and a `process.exit` inside a command
makes the command **untestable in process**, killing the Vitest worker — which would force every
assertion in this ticket to spawn a binary and turn Q-0091 into Q-0095.
*Test:* at least one assertion per command reading `process.exitCode` after `await main(argv)`,
with the value restored afterwards.

**AC-15 — `core` stops carrying a copy of the CLI's renderer.** `validate-artifact.test.ts`'s AC-9
block holds a `render` helper whose own doc comment says it is *"the renderer that belongs to the
CLI, transcribed"* and that it *"is only worth having while it still reproduces what the CLI
prints"*. Once the CLI's renderer exists, that helper is a second copy of a 180-character sentence in
a package that may not import the one that owns it. It is **retired by replacement, not deleted** —
Q-0096's precedent with `index.test.ts`'s byte pin: `core`'s block keeps asserting that the four
outcomes are distinguishable from `validateArtifact`'s return value alone, loses the escape bytes and
the sentence, and gains a pointer naming the `packages/cli` test that now owns the rendering.
*Test:* a scan asserting the notice sentence occurs in exactly one `packages/**` file.

### The `@quorum/core` surface

**AC-16 — the barrel gains what these commands need, and no wildcard.** `readData` and
`ProjectNotFoundError` are added to `packages/core/src/index.ts`, with the barrel's doc comment
updated to say why each is there — `readData` because `validate` reads the schema before any
artifact, `ProjectNotFoundError` because it is the fourth error class a caller has to catch and it
is the *first* thing all four commands can hit. Any type the commands need
(`DirectoryReport`, `ProbeResult`, `TicketRecord`, `AdapterConfig`, …) is added by name, which the
barrel's own comment already describes as an ordinary edit. `"."` stays the only exported subpath.
*Test:* `package.test.ts`'s Q-0096 AC-2 derivation moves with it — `expect(domain()).toHaveLength(13)`
and "exactly the thirteen plus the three" become the new counts, each shown red against the old
value — and Q-0096 AC-5's wildcard refusal is untouched and still passes.
**Measured, and not to be re-derived from the ticket body:** `ProjectConfig['adapters']` is already
assignable to `getAdapter`'s `Record<string, AdapterConfig>` — `packages/core/src/engine/steps.ts:194`
does exactly that call over a `config: ProjectConfig` and typechecks today. There is no cast to
write and no Q-0052-style `unknown` boundary here.

**AC-17 — the project-not-found sentence survives the port unchanged.** Every one of the four
commands calls `loadProject()` first and catches `ProjectNotFoundError`, printing it through
`die(error.message)` so the user sees
`✗ no harness/harness.yaml found — run \`harness init\` in your repo` and exit 1 — including the
`harness` the binary is not called, which `core`'s own comment records as carried and not fixed. An
uncaught `ProjectNotFoundError` would reach `dieOnUnexpected` and print a Node stack instead, which
is a visible regression against the spike.
*Test:* each of the four commands run from a directory with no project, asserting the sentence and
exit 1, and asserting no stack trace reaches the output.

### The guards Q-0091 is the first to move

**AC-18 — the `DOMAIN` scan is re-scoped to the frame, not deleted.**
`frame.source.test.ts`'s AC-8 currently forbids **every** production module from naming any of the
thirteen domain symbols. Four command modules must name seven of them. The scan is narrowed from
"every production module" to "every **frame** module" — the six Q-0090 files, named as a derived set
rather than a hand-written list where possible — and gains its inverse: **each command module names
only the domain symbols its command needs**, so `board.ts` naming `probeAdapter` is a failure. The
list's `toBeGreaterThan(10)` positive control and the "the scan has a subject" clause stay.
*Test:* both directions demonstrated on a mutated copy — a domain symbol moved into `main.ts` fails;
a domain symbol used by the wrong command fails; the shipped tree passes.

**AC-19 — the CLI reads no file directly, so the strongest half of the I/O guard survives.**
No production module in `packages/cli` imports `node:fs`, `node:child_process`, `node:readline` or
`node:os` — every read, spawn and git invocation goes through `@quorum/core`, which is ground rule
4 as an executable property rather than an intention. `node:path` is admitted for the command
modules alone, because `<harnessDir>/flows` has to be joined somewhere and `Project` carries no
`flowsDir`; the frame's six modules keep the whole prohibition.
*Test:* the `IO_MODULE` regex splits into the four forbidden specifiers (package-wide production) and
`node:path`/`node:url` (frame-only), with each clause shown firing.
*Alternative considered and rejected:* adding `flowsDir` to `Project` in `core` removes `node:path`
from the CLI entirely and is one line — but `project.test.ts:78` pins `Object.keys(loaded)` to
exactly four, so it moves a landed pin in the package Q-0092 to Q-0094 all consume, to save one
import. Registered so a reviewer does not re-open it.

**AC-20 — the "writes nothing" property is extended to the commands rather than narrowed away.**
`main.test.ts`'s AC-8 snapshot currently runs a fixed `INVOCATIONS` list and asserts the tree is
byte-identical. Every one of Q-0091's four commands is read-only, so the list **grows** to include
them — `board`, `lint`, `validate` with a schema and an artifact, and `adapters` against a stubbed
registry — and the property holds unchanged. It is the cheapest available proof that four new
commands introduced no write path.
*Test:* the existing "the snapshot has a subject" clause is untouched and still fires.

### The register

**AC-21 — `spike-parity.test.ts` can say that a binary half has been translated, and the totals are
re-derived.** The register gains `binaryCarriedBy?: string[]`, permitted only on `cli` and `split`
entries, validated exactly as `carriedBy` is — each path inside a workspace package, on disk, and
collected by the Vitest include — and `binaryHalf`'s prose stops ending at "— Q-0010" and instead
names what remains and whose it is. Three entries move: `q0036-board-containment.js` gains the board
test; `q0033-surface.js` gains the lint test and its `binaryHalf` splits `init` to Q-0093 and the
gate answers to Q-0094; `q0011-runs-cli.js` gains the validate test and keeps `runs` as Q-0092's.
The `Verdict` union is **not** extended — `cli` is a true statement about the *spike file* (it
spawns the binary and imports no spike source) and stays true after translation; what was missing
was a place to record the counterpart, not a fourth verdict.
*Test:* the four numbers — 220 / 2739 / 2469 / 5428 and 55% — are **re-derived and shown unmoved**,
which is the expected result because Q-0091 edits no file under `spike/test/`, and "it did not move"
is stated as a measurement rather than skipped. Each new audit clause is demonstrated firing on a
mutated register: a `binaryCarriedBy` naming a file that does not exist, one naming a file no include
collects, and one on a `ported` entry.

---

## 4. Non-goals

1. `runs` (Q-0092), `init` and `ticket` (Q-0093), `run`, the gate reader and the signal handler
   (Q-0094). No stub, no help line, no `COMMANDS` entry for any of them.
2. The mock end-to-end suite through the binary (Q-0095). Every assertion here runs **in process**;
   Q-0091 spawns nothing.
3. `smoke.js`, `q0040-undecided.js:404` and the sixteen non-`lint` invocations of
   `q0033-surface.js`. They are named in §0 so the seam is visible, not so this ticket crosses it.
4. Q-0068's *"Harness runs on subscription OAuth only"*. Rendered unchanged (AC-11b).
5. Q-0066's `probeAdapter` crash on a null usage — an adapter whose login is fine and reports no
   usage still answers `✗ login not usable: Cannot read properties of null`. Both trees together,
   not here.
6. Q-0059's traversing `dirOf` and Q-0060's silent frontmatter.
7. Q-0067's version probe. `adapters` prints whatever `check()` returns and asks nothing about it.
8. Q-0090's GA-4 — the unknown-command zero and `regressed` exiting 0. Untouched.
9. TTY detection, `NO_COLOR` and `FORCE_COLOR`. Q-0090 non-goal 11, unchanged: escapes are written
   into a pipe exactly as the spike writes them, and the tests strip them the way the spike tests do.
10. Any change to `spike/src/**` or any deletion or edit of a file under `spike/test/**` (ground
    rules 1 and 2). If a change to `spike/src` appears necessary, the implement step stops and says
    so.
11. Validating `harness.yaml`. `projectConfigSchema` stays declared and called nowhere (Q-0043
    AC-11); every reading site keeps its own fallback.
12. Windows. Q-0098 registered the build as POSIX-only and this ticket does not widen it.

---

## 5. Open questions

**OQ-1 (decide at the gate; owner: human).** Is `binaryCarriedBy` the right shape for the register,
or should the `Verdict` union gain a value such as `cli-ported`? Recommendation: `binaryCarriedBy`,
for the reason in AC-21 — the verdict describes the spike file's *own* properties, which translation
does not change, and `admissible()` derives it from the file's text, so a fourth verdict would need
that derivation to learn about a second tree. This is flagged because the register is a file Q-0092,
Q-0093, Q-0094 and Q-0095 will each edit next, and picking the shape once is cheaper than four
tickets picking it separately.

**OQ-2 (blocking a successor, not this ticket; owner: human).** The board's hint prints
`→ harness run <flow> <id>` and `ProjectNotFoundError` says ``run `harness init` in your repo`` — a
command that does not exist, in the product's first-run path. Both are preserved here on `core`'s own
recorded precedent (*"Carried, not fixed (charter §2)"*, `project.ts:31`). But that makes three
user-facing sites (and Q-0093's `init` next-steps line will be a fourth) telling an adopter to run a
binary named `harness`. **A successor ticket is owed and an implement step cannot open one**, because
`backlog/` is not an agent-writable surface. Recommendation: allocate it at this gate, scoped to
*every* user-facing occurrence of the old binary name at once, and distinct from Q-0068, whose
subject is the adapter refusal string.

**OQ-3 (owner: implementer, at Q-0095's gate).** `smoke.js:126–132` is the only end-to-end proof
that a key in the environment produces the refusal. `frame.source.test.ts`'s AC-12 forbids the
spelling `ANTHROPIC_API_KEY` **anywhere in `packages/cli`**, including tests, with only the guard
file itself exempt. So when Q-0095 translates that assertion it must either earn a second exemption
or place the assertion outside this package. Nothing is owed here — AC-11(a) deliberately proves the
rendering without creating a key — but the collision should be written into Q-0095's body now rather
than discovered by its implementer.

**OQ-4 (owner: implementer).** AC-15 retires `validate-artifact.test.ts`'s `render` helper. The
alternative is to leave both copies and accept that they can drift, which that helper's own doc
comment already argues against. Recommendation as written; raised because it edits a test in
`packages/core` on a `packages/cli` ticket.

**OQ-5 (owner: implementer).** Flat `src/board.ts`, `src/lint.ts`, `src/validate.ts`,
`src/adapters.ts`, or a `src/commands/` directory. Recommendation: flat, matching the frame's own
layout; `src/commands.ts` already exists as the registry and a `src/commands/` beside it reads as
the same thing. `frame.source.test.ts` walks `src` recursively, so either satisfies the scans.

---

## 6. Risks

**R-1 — five guards move in one ticket, and a weakened guard reports green.** This is the repository's
most-recorded defect class (*"A check is not established by reading it"*, 2026-08-29). Mitigation:
every re-scoping in AC-18 to AC-21 requires a mutation demonstrated red, and none of them may be
satisfied by deleting a clause — the `DOMAIN` scan gains an inverse, the I/O scan splits rather than
shrinks, the snapshot list grows, and the register gains a field.

**R-2 — the translated `board` fixtures cannot use `quorum init` or `quorum ticket new`, which is how
`q0036-board-containment.js` builds every one of its ten.** Both are Q-0093's. Mitigation, and it
preserves the property the spike file was protecting: build the project directly (write
`harness/harness.yaml`, as `main.test.ts`'s existing AC-8 fixture already does) and create the ticket
with **`Backlog.create()` from `@quorum/core`** — the same code path `quorum ticket new` will call, so
the frontmatter is still "exactly what the product writes", which is what that file's comment at
`:44–46` asks for. Hand-writing `ticket.md` YAML would lose it.

**R-3 — `q0011-runs-cli.js` is Q-0092's file and holds all of `validate`'s coverage.** Two tickets
editing one register entry, potentially concurrently. Mitigation: `binaryCarriedBy` is a list, so the
entry accumulates rather than being overwritten; and Q-0010's body already warns that Q-0039 becomes
a blocker the moment two children run at once, so these two run one at a time.

**R-4 — the skip notice is transcribed in four places** (`spike/bin/harness.js:453`,
`packages/core/src/contracts/validate-artifact.test.ts:157` and `:189`, and
`spike/test/q0011-runs-cli.js`), governed by a frozen contract, and a fifth copy is about to be
written. Mitigation: AC-15 reduces it to one copy in `packages/cli` plus the spike's, and AC-13
requires the CLI test to carry the contract citation so the next person to edit it knows the sentence
is not theirs.

**R-5 — `lintFlowDirectory`'s sort changes which flow the `requirements` column advertises, on a
filesystem whose `readdir` order differs from this one.** Measured as identical here (§AC-7) and
pinned; stated rather than left to be found, because the visible token is `chore` and the alternative
is `solutioning`.

**R-6 — scope pressure from `q0033-surface.js`.** Sixteen of its twenty invocations are not this
ticket's, and its scenarios are large and interleaved. The failure mode is an implementer translating
the file rather than the command. Mitigation: §0's table is the boundary, and AC-9's test names the
scenarios it covers rather than the file.

**R-7 — the merge is red in an existing checkout until `pnpm install` links the new dependency
graph.** Q-0090 recorded this exact effect. Nothing in this ticket changes it; the implement step
must run `pnpm install --frozen-lockfile` before either suite, and run **both** — `npm test --prefix
spike` and `pnpm turbo run test --force` — because its worktree has no dependencies until it installs
them (`harness/rules.md`).

---

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-11. No key path is added; the CLI names no credential spelling; the refusal is rendered from `core`'s throw and never re-spelled. AC-12's scan over the whole package is kept intact rather than exempted. |
| **Worktree safety** | n/a by construction — all four commands are read-only, and AC-8 and AC-20 make that executable rather than asserted. |
| **Gate behaviour** | n/a. No command here reaches a gate; the gate reader and the five throw sites are Q-0094's. |
| **File format and its schema** | No new file format, no schema change. `Project`'s four-key shape is deliberately unchanged (AC-19's rejected alternative). |
| **Lint rules** | No flow file changes, so `harness lint` has nothing new to check. `@typescript-eslint/no-deprecated` applies to the new modules as to every `packages/**/*.ts`. |
| **Turbo inputs** | The new tests build their fixtures in `os.tmpdir()` and read nothing outside `packages/cli`, so `packages/cli/turbo.json` needs no new entry. `packages/core/turbo.json` already declares `../../packages/*/**/*.test.ts`, which is what makes `spike-parity.test.ts`'s new counterpart checks correctly invalidate. Confirm rather than assume, per Q-0072. |
| **Cold-clone impact** | Positive and material. `adapters` is the second command the README tells a stranger to type and `board` is the third; today the installed binary can answer neither. Nothing here lengthens the first 30 minutes. |
| **Product boundaries** | AC-1: the help says Quorum, never calls the product a harness, and uses "subscription" rather than any credential word. The board's `harness run` hint and the project-not-found sentence are preserved defects with an owed successor (OQ-2), not new prose. |

---

## 8. Environment and verification

- `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` **before**
  either suite; the implement step's worktree starts with no `node_modules`.
- Both suites, forced: `npm test --prefix spike` and `pnpm turbo run test --force`. The spike suite
  must be unchanged — 0 edits under `spike/**` — and green.
- `pnpm lint` and `pnpm typecheck`, forced.
- `pnpm sweep:git-identity`, which since Q-0058 runs in a linked worktree.
- Verified in **both** environment rows per Q-0072's closing finding: inside the `integrate`
  worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again forced on `main`
  after the merge, where both exist.
- One manual proof beyond the suites, because these four commands are the product's visible surface:
  `pnpm turbo run build && pnpm exec quorum board`, `lint`, `adapters` and `validate` run in this
  repository, and their output compared line for line against
  `node spike/bin/harness.js <same>`. Any difference is either named in AC-7, AC-14 or AC-17 as a
  ruled divergence, or it is a defect.
