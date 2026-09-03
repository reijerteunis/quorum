# Q-0091 — CLI read-only commands: `board`, `lint`, `validate`, `adapters`

*Merged requirement, run 1, iteration 1. Written against the tree at `5cc23c7`. Every inherited
figure below was re-measured; four of the ticket body's premises and one of each candidate's
citations did not survive, and each correction carries its measurement.*

**Verdict: needs-input, on size.** The document is complete and the design is settled — what is not
settled is that this is one ticket. §3 rules the seam and names the two tickets. Nothing below is
withdrawn: the criteria are written once, in full, and partitioned so the split is a mechanical read
rather than a rewrite.

---

## 0. What was measured, and what it corrects

**M-1 — the inherited coverage is 696 lines, not 698, and neither component figure is right.**
`wc -l` gives `q0033-surface.js` **476** (body: 446) and `q0036-board-containment.js` **220** (body:
221). The body's own arithmetic is also internally inconsistent — 446 + 221 is 667. The 220 is
independently confirmed: `packages/core/src/spike-parity.test.ts:1134` pins
`linesOf(named('binary-only'))` at 220 and `q0036-board-containment.js` is the only file in that
class. *(Claude M-1, verified.)*

**M-2 — the grouping premise is false, and this is the finding the cut turns on.** *"Grouped because
… their two test files cover them together"* does not hold in either direction. Measured across
`spike/test/`:

| file | lines | what of Q-0091 it carries | who owns the rest |
| --- | --- | --- | --- |
| `q0036-board-containment.js` | 220 | **all of `board`** — 14 `board` invocations, scenarios C1–C10 | nothing |
| `q0033-surface.js` | 476 | `lint` only — `:73`, `:142`, `:271`; plus one `board` row at `:342` | `init`/`ticket` (Q-0093), `run` + gates (Q-0094) — 16 of 20 invocations |
| `q0011-runs-cli.js` | 220 | **all of `validate`** — 8 invocations, the skip notice at `:94` and `:114` | `runs` (Q-0092) |
| `q0040-undecided.js` | 413 | one `validate` invocation at `:404` | the five gate sites (Q-0094) |
| `smoke.js` | 780 | `lint` `:40`, `board` `:123`, `adapters` `:126–132`, `validate` `:647–648` | Q-0095 |

Two consequences. **`validate`'s entire binary half lives in Q-0092's file**, whose register entry
says so in as many words — its `binaryHalf` is *"`harness runs` listing and detail … **and the
skipped-check notice as the CLI actually prints it**"*. And **`adapters` has no coverage in either
file the ticket body names**: the single occurrence of the string in `q0033-surface.js` is `:249`,
a flow-lint scenario about review panels spanning two adapters, not the command. `adapters`' only
inherited proof is `smoke.js:126–132`, which is Q-0095's. So Q-0091 translates a **command-scoped
set of behaviours across five files**, never a file, and one of its four commands inherits nothing
at all. *(Claude M-2, verified and extended — the `adapters` half is new here.)*

**M-3 — `currentBranch` is not `board`'s, and `loadFlow` is.** The body's table gives `board`
`currentBranch`. `spike/bin/harness.js:287` defines it and `:326` is its only call site, inside
`init` — Q-0093's. What `board` reaches that the table omits is `loadFlow`, at `:355`. A port
working from the table carries a helper `board` never calls and misses one it does. *(Claude M-3,
verified.)*

**M-4 — two symbols these commands need are not on `@quorum/core`'s public surface.** The barrel
exports sixteen names. `readData` — which `validate` calls at `:437` so an unreadable schema dies
with its own message before any artifact is opened — is exported from `contracts/contracts.ts:115`
and **not re-exported**. `ProjectNotFoundError` — thrown by `loadProject`, which all four commands
call first — is exported from `backlog/project.ts:32` and **not re-exported**, while the barrel's own
doc comment calls the three it does carry *"the error classes a caller has to catch"*. This is
Q-0096's finding arriving one layer down. `STAGES` is fine: it is `@quorum/shared`'s
(`stages.ts:20`) and `packages/cli/package.json` already declares that dependency. *(Claude M-4,
verified.)*

**M-5 — the register cannot say what ground rule 5 requires it to say.** `admissible()`
(`spike-parity.test.ts:887`) permits a file that reaches the binary and imports no spike source
**only** the verdict `cli`; `audit()` (`:945`) fails a `cli` entry that names counterparts.
`q0036-board-containment.js` is exactly that file. The `Verdict` vocabulary was designed by Q-0054
for a two-suite world — spike against `packages/core` — and has no way to record *"this binary half
is now carried by `packages/cli`"*. Ground rule 5 is therefore unsatisfiable without a schema change,
which is OQ-1. *(Claude AC-21's premise, verified against both functions.)*

**M-6 — the exit-code split is in the source, and it is the seam.** `board` (`:398`) and `adapters`
(`:425`) end in `return;` and can only exit 0. `lint` (`:404`) and `validate` (`:460`) end in
`process.exit(ok ? 0 : 1)` and carry an exit-code contract a `type: script` step and a preflight
depend on. Neither candidate names this; §3 uses it. *(New.)*

**M-7 — one candidate citation is wrong and is corrected in AC-16.** Claude's AC-4 quotes
`/T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/` as *"the assertion `q0033-surface.js:342` makes"*.
That regex occurs nowhere under `spike/test/`; `:342` asserts `/iter=.*review.*2/` and
`/cost=\$1\.25/`. A criterion citing an assertion that does not exist is one an implementer cannot
demonstrate red.

**M-8 — Claude's AC-14 justification is half wrong, and the criterion survives on the other half.**
It argues a `process.exit` in a command makes it *"untestable in process, killing the Vitest
worker"*. `die` already calls `process.exit` (`fail.ts:23`) and is tested in process —
`fail.test.ts:64` replaces it with a throw. What is true, and is what AC-6 rests on, is `fail.ts`'s
own recorded reason: an aggregate verdict reached **after** the command has printed everything is
exactly the case `failSoftly` exists for, and it is strictly better on a pipe.

**M-9 — Codex's AC-16 cannot be tested by this ticket and is struck.** It requires the diagnostic
block `quorum lint` prints to match *"the diagnostic block used by the CLI's run preflight"*. The
run preflight is Q-0094's and does not exist in `packages/cli`. The property is real —
`q0033-surface.js:271` proves it in the spike — and it is routed to Q-0094 as an obligation (§5,
non-goal 3) rather than asserted here over an absent subject.

---

## 1. Problem

Since Q-0098 the `maintainer` has a `quorum` binary that prints its own help and nothing else. The
four commands that only read — the board they check before starting work, the lint that says a flow
file is wrong before a run bills a vendor, the `validate` a `qa-red` script step calls so a contract
violation is a red test rather than prose, and the adapters check that is meant to run *before* a
paid run — exist only in `spike/bin/harness.js`, which is not what `pnpm exec quorum` runs.

For the `adopter` the problem is sharper. `quorum adapters` is the second thing the README tells a
stranger to type and it is the command that demonstrates the BYOS promise: that Quorum refuses to
run on anything but the vendor CLI's own subscription. The binary they installed cannot answer.

Underneath both is a state the repository has not been in before. `packages/cli` carries five landed
guards written when **no command existed**, asserting in effect that none does:
`frame.source.test.ts`'s `DOMAIN` scan (`:164–177`) forbids any production module from naming
`Backlog`, `containment`, `lintDirectory`, `getAdapter`, `probeAdapter`, `validateArtifact` or
`loadProject`; its `IO_MODULE` scan (`:144`, `:191`) forbids importing `node:fs`,
`node:child_process`, `node:readline`, `node:os`, `node:path` or `node:url`; `commands.test.ts:94–95`
pins `COMMANDS` and the help to `['help']`; `main.test.ts:22` asserts a fixed invocation list leaves
the tree byte-identical; and `package.test.ts:337–345` pins the core barrel at thirteen domain
symbols derived from that same `DOMAIN` register, plus three errors. **This is the first ticket that
must move all five, and a ticket that moves five guards is the one most likely to weaken one** — the
repository's most-recorded defect class (*"A check is not established by reading it"*, 2026-08-29).

---

## 2. User stories

- **As the `maintainer`**, I run `quorum board` and see every ticket by stage with its containment
  token, so I can tell a ticket whose stage says `reviewed` from one whose code is actually in
  `main`, without going back to the spike binary. *Surface: CLI.*
- **As the `maintainer`**, I run `quorum lint` after editing a flow file and get the same per-file
  diagnostic the spike gives me, exit 1 when a flow is broken, so I find out before a run bills a
  vendor. *Surface: CLI, reading `harness/flows/`.*
- **As the `adopter`**, I run `quorum adapters` as my second command and it tells me which vendor
  CLIs are present — and refuses, naming the variable, if a key is in my environment — so I learn
  this product runs on my subscription before I have invested any time. *Surface: CLI.*
- **As the `contributor`**, `quorum validate <schema> <file…>` exits 1 on a non-conforming artifact
  so a `qa-red` `type: script` step turns red on a contract violation, and prints the notice
  `contracts/Q-0011/runs-cli.contract.md` requires when no semantic contract applies — so a skip is
  never read as a pass. *Surface: CLI, called from a flow's script step.*

---

## 3. Size: this is two tickets, and the seam is measured

Twenty-one independently testable criteria, and there is no honest reading that reaches fifteen.
Four commands is the smaller half of the work; the larger half is that these are the **first**
commands, so they drag five landed guards, two `packages/core` edits and a register schema change
along with them. Codex's 38 and Claude's 21 are the same ticket sized differently, not two scopes.

**The seam is `return` against `process.exit`, and it is in the spike source (M-6).** It is not an
aesthetic grouping: it separates the two commands that carry an exit-code contract a script step
depends on from the two that report state and can only succeed. It also happens to balance the
inherited coverage, because M-2 measured where that coverage actually is.

**Ticket 1 — Q-0091 (re-scoped): `lint` and `validate`, and the guards that admit a command.**
AC-1 to AC-13, thirteen criteria. Sixty-two lines of spike between the two commands, three inherited
sites in `q0033-surface.js` and eight in `q0011-runs-cli.js` — the smallest command surface in the
set. That is deliberate: the guard migration and the barrel change are the risky, shared work, and
they belong where they can be reviewed on their own rather than competing with `board`'s ten
containment scenarios. `validate` is also what *forces* the barrel change, since `readData` is the
one symbol no other command needs.

**Ticket 2 — successor: `board` and `adapters`, the two commands that always exit 0.**
AC-14 to AC-21, eight criteria. `board` brings all 220 lines of `q0036-board-containment.js` and the
glossary-fixed containment vocabulary; `adapters` brings the BYOS surface and, per M-2, no inherited
coverage at all, so every one of its tests is new. Both read `config` (`repo.base_branch`,
`adapters`), both are the first two commands the README's path names, and both carry a preserved
defect the other tickets do not — `board`'s `harness run` hint and `adapters`' Q-0066/Q-0068 pair.

**Order: ticket 1, then ticket 2.** Ticket 1 decides the module layout, moves the five guards, adds
the two barrel symbols and settles the register's shape; ticket 2 then *extends* four registers whose
form is already ruled, which is an ordinary edit. The reverse order pays for the guard migration
underneath the largest translation in the set. Neither blocks Q-0092 to Q-0094, which need only the
guard shape ticket 1 lands.

**What is deliberately not the seam.** Splitting by command into four is over-cutting — `lint` alone
is one criterion and a guard migration cannot be a ticket, because a scan narrowed with no command in
the tree is a guard with no subject, which is the defect class this ticket is most exposed to. And
splitting the guards out ahead of every command fails for the same reason: AC-10's inverse clause
(*each command module names only the domain symbols its command needs*) is unfalsifiable until a
command module exists.

---

## 4. Acceptance criteria

Numbered from AC-1. Q-0091 inherits no numbering: the AC-22 to AC-26 space Q-0097 and Q-0098 shared
belonged to the split of Q-0096's single 21-criterion body, and this ticket was never part of it.

### Group A — Ticket 1: `lint`, `validate`, and the guards that admit a command

**AC-1 — the frame registers `lint` and `validate`, and the help says what they do.** `COMMANDS`
gains the two names, `HELP` gains two lines, `HANDLERS` gains two entries — the
`Record<Command, CommandHandler>` type makes a name without a handler, or a handler without a name,
fail to compile. The help lines preserve the *information* of `spike/bin/harness.js:6` and `:8` (the
arguments each takes, and what it does) and their ordering relative to the other commands, but are
**rewritten rather than transcribed**, because three constraints bind them at once: they name
`quorum` and never call the product a harness (`commands.test.ts`'s existing clause and
`.claude/rules/product-boundaries.md`); they use **subscription** rather than "API key", "token" or
"credential", which `harness/product-context.md` forbids; and they match no pattern in
`frame.source.test.ts`'s `CREDENTIAL` list.
*Test:* `commands.test.ts:94–95`'s two pins move to the new names and are **demonstrated red against
`['help']`** rather than edited to fit. The `mentioned()` extraction and the `isCommand` cross-check
are untouched, so a help line without a handler still fails.

**AC-2 — no command re-parses the command line.** Each handler takes the `ParsedArgv` the frame
hands it and reads `rest` and `flags` from that object; `validate` reads `rest`, `lint` reads
neither. No command module calls `parseArgv`, reads `process.argv`, or defines a second flag table —
which is `main.ts`'s stated purpose for passing the whole object.
*Test:* a source scan over the command modules for `process.argv` and `parseArgv(`, plus a
behavioural test per command driving it through `main(argv)` rather than by calling the handler, so
the dispatch boundary is what is exercised.

**AC-3 — the `@quorum/core` barrel gains what these commands need, and no wildcard.** `readData` and
`ProjectNotFoundError` are added to `packages/core/src/index.ts`, each with the barrel's doc comment
saying why: `readData` because `validate` reads the schema before any artifact is opened,
`ProjectNotFoundError` because it is the fourth error class a caller has to catch and the *first*
thing every command can hit. Any type a command needs (`DirectoryReport`, `ProbeResult`,
`TicketRecord`, `AdapterConfig`, …) is added by name, which the barrel's own comment already calls an
ordinary edit. `"."` stays the only exported subpath.
*Test:* `package.test.ts:337` `toHaveLength(13)` and `:342`'s *"exactly the thirteen plus the three"*
move to the new counts, each shown red against the old value; Q-0096 AC-5's wildcard refusal is
untouched and still passes.
**Sequencing, stated because it is a contradiction if missed:** `package.test.ts` derives the barrel
surface from `frame.source.test.ts`'s `DOMAIN` register, and that register is the list production
modules are *forbidden* to name. `readData` therefore cannot join `DOMAIN` until AC-10 has re-scoped
that prohibition to the frame. AC-3 and AC-10 land together or the derivation contradicts itself.
**Measured, and not to be re-derived from the ticket body:** `ProjectConfig['adapters']` is already
assignable to `getAdapter`'s `Record<string, AdapterConfig>` — `engine/steps.ts:194` makes that exact
call over a `config: ProjectConfig` and typechecks today. There is no cast to write and no
Q-0052-style `unknown` boundary.

**AC-4 — the project-not-found sentence survives the port unchanged.** Every command calls
`loadProject()` first and catches `ProjectNotFoundError`, printing it through `die(error.message)`,
so the user sees ``✗ no harness/harness.yaml found — run `harness init` in your repo`` and exit 1 —
including the `harness` the binary is not called, which `project.ts:31` records as carried and not
fixed. An uncaught `ProjectNotFoundError` reaches `dieOnUnexpected` and prints a Node stack, which is
a visible regression against the spike.
*Test:* each command run from a directory with no project, asserting the sentence, exit 1, and that
no stack trace reaches the output.

**AC-5 — `lint`'s rendering is the CLI's and its records are `core`'s.** `lintDirectory`
(`lint/lint.ts:405`) returns `{ ok, records }` with, in its own words, *"no marker, colour,
indentation or escape byte anywhere"*, and `flattenProblems` (`:388`) has already done both the
bullet flattening and the leading-hyphen strip. The CLI adds exactly what the spike's local
`lintDirectory` (`harness.js:296–311`) added and nothing else: `✓ <filename>` in green for a clean
file, and for a failing one `✗ <filename>` in red followed by one `  - <problem>` line per problem. A
second copy of the flattening regex is the transcription defect this repository keeps paying for.
*Test:* the diagnostic-block extraction `q0033-surface.js:38–46` performs, over the shipped flow
directory (clean, exit 0) and over `lintFixture`-shaped directories reproducing the S6.2–S6.10
return-chain cases and S9's multi-file aggregation; plus an assertion that no command module contains
the flattening regex.

**AC-6 — the aggregate verdict reaches the process through `failSoftly`, and `die` stays `die`.**
`lint` and `validate` set exit 1 through `failSoftly()` rather than `process.exit(1)`; the
usage and unreadable-schema failures keep `die`, which exits hard as the spike does. The external
status is identical in every case. This is a ruled divergence on `fail.ts`'s own recorded reason —
the soft path exists so pending output still reaches the terminal, which matters on a pipe, and the
spike's `process.exit(bad ? 1 : 0)` after everything is already printed is precisely that case. It is
**not** justified by testability: `die` is already observed in process (`fail.test.ts:64`) and the
argument that it could not be is wrong (M-8).
*Test:* at least one assertion per command reading `process.exitCode` after `await main(argv)`, with
the value restored afterwards; plus `fail.test.ts:202`'s existing clause that `failSoftly` never
calls `process.exit`, untouched.

**AC-7 — `validate` reads the schema once, first, and a bad one dies with its own message.**
`readData(schemaFile)` before any artifact is opened; on a throw,
`die("cannot read schema <file>: <message>")`. Missing arguments die with the usage line — the
spike's is `usage: harness validate <schema.json> <file…>` and the word `harness` in it is Q-0068's
neighbouring class, so **which binary name this line uses is OQ-2's ruling** and the criterion is
written to whichever the gate picks.
*Test:* an unreadable schema, a schema that is not JSON, a missing schema argument and a missing data
argument.

**AC-8 — per-file outcomes, one read per artifact, and the notice a frozen contract requires.**
For each data file, in argv order: `validateArtifact(schemaFile, f)` is called **exactly once** and
every structural and semantic outcome is derived from that one result — the artifact is never
re-read to select a semantic check, which `q0011-runs-cli.js:172` (Q-0037 AC-9) pins as the property
`validateArtifact` was added for. A throw prints `✗ <file>: <message>`, counts as bad, and the loop
continues to later files. Where `semantic.ran === false && semantic.reason === 'unrecognised-annotation'`,
the dim notice prints **before** the verdict; where the reason is `structurally-invalid`, it does
**not** print. Then `✓ <file> matches <schema>`, or `✗ <file> violates <schema>:` followed by each
error on its own line indented four spaces. The notice is the sentence Q-0037 shipped, keeps the
words *run-manifest semantic checks were skipped*, says "no **recognised** x-quorum-contract
annotation" rather than "no annotation" — because the one outcome covers an absent annotation and a
present-but-unsupported one alike — never says any check passed, and names `run-manifest-v1` as the
only contract defined. `contracts/Q-0011/runs-cli.contract.md:46–48` is frozen and is not this role's
to amend.
*Test:* the three shapes `validate-artifact.test.ts` drives — no annotation, `unknown-v1`, an empty
annotation — through the real renderer; a clean run manifest (no notice, exit 0); a semantically
broken one (no notice, errors indented, exit 1); a structurally invalid manifest (no notice); an
unreadable artifact followed by a valid one, proving the loop continues; and a spy asserting one
`validateArtifact` call per file.

**AC-9 — `core` stops carrying a transcribed copy of the CLI's renderer.**
`validate-artifact.test.ts`'s AC-9 block holds a `render` helper whose own doc comment calls it *"the
renderer that belongs to the CLI, transcribed"* and says it *"is only worth having while it still
reproduces what the CLI prints"*. Once the CLI's renderer exists, it is a second copy of a
180-character frozen sentence in a package that may not import the one that owns it. It is **retired
by replacement, not deleted** — Q-0096's precedent with `index.test.ts`'s byte pin: `core`'s block
keeps asserting that the four outcomes are distinguishable from `validateArtifact`'s return value
alone, loses the escape bytes and the sentence, and gains a pointer naming the `packages/cli` test
that now owns the rendering.
*Test:* a scan asserting the notice sentence occurs in exactly one file under `packages/**`.

**AC-10 — the `DOMAIN` scan is re-scoped to the frame and gains its inverse, rather than being
deleted.** `frame.source.test.ts:170`'s clause forbids **every** production module from naming any of
the thirteen. Command modules must name some of them. The scan narrows from "every production module"
to "every **frame** module" — the six Q-0090 files, derived rather than hand-listed where possible —
and gains its inverse: **each command module names only the domain symbols its own command needs**,
so a `validate.ts` naming `probeAdapter` is a failure. The `toBeGreaterThan(10)` positive control and
the `:181` "the scan has a subject" clause stay.
*Test:* both directions demonstrated on a mutated copy — a domain symbol moved into `main.ts` fails;
a domain symbol used by the wrong command fails; the shipped tree passes.

**AC-11 — the CLI reads no file directly, so the strongest half of the I/O guard survives.**
No production module in `packages/cli` imports `node:fs`, `node:child_process`, `node:readline` or
`node:os` — every read, spawn and git invocation goes through `@quorum/core`, which is ground rule 4
as an executable property rather than an intention. `node:path` is admitted for command modules
alone, because `<harnessDir>/flows` has to be joined somewhere and `Project` carries no `flowsDir`;
the frame's six modules keep the whole prohibition, and `node:url` stays forbidden everywhere in
production.
*Test:* `IO_MODULE` splits into the four package-wide specifiers and the frame-only pair, each clause
shown firing; `:195`'s "the clause has a subject" control is untouched.
*Alternative considered and rejected, registered so a reviewer does not re-open it:* adding
`flowsDir` to `Project` removes `node:path` from the CLI entirely and is one line, but
`project.test.ts:76` pins `Object.keys(loaded)` to exactly four, so it moves a landed pin in the
package Q-0092 to Q-0094 all consume, to save one import.

**AC-12 — the "writes nothing" property is extended to the new commands rather than narrowed away.**
`main.test.ts:22`'s `INVOCATIONS` list drives a byte-identical-tree snapshot. Both new commands are
read-only, so the list **grows** — `lint`, and `validate` with a schema and an artifact — and the
property holds unchanged. It is the cheapest available proof that a new command introduced no write
path. The `:222` "the snapshot has a subject" clause is untouched.
*Test:* the snapshot covers `backlog/`, `harness/` and `.quorum/` recursively plus
`git for-each-ref`, and is shown to fail against a deliberately writing stub handler.

**AC-13 — `spike-parity.test.ts` can say that a binary half has been translated, and the totals are
re-derived.** Per M-5 the register has no vocabulary for this. It gains
`binaryCarriedBy?: readonly string[]`, permitted only on `cli` and `split` entries and validated
exactly as `carriedBy` is — each path inside a workspace package, on disk, and collected by the
configured include (`audit()`'s two separate failures, existence and collection, both apply) — and
`binaryHalf`'s prose stops ending at *"— Q-0010"* and instead names what remains and whose it is. Two
entries move here: `q0033-surface.js` gains the lint test and its `binaryHalf` splits `init` to
Q-0093 and the gate answers to Q-0094; `q0011-runs-cli.js` gains the validate test and keeps `runs`
as Q-0092's. The `Verdict` union is **not** extended, subject to OQ-1.
*Test:* the four pinned numbers — 220 / 2739 / 2469 / 5428 and 55% — are **re-derived and shown
unmoved**, which is the expected result because this ticket edits no file under `spike/test/`, and
*"it did not move"* is stated as a measurement rather than skipped. Each new audit clause is
demonstrated firing on a mutated register: a `binaryCarriedBy` naming a file that does not exist, one
naming a file no include collects, and one on a `ported` entry.

### Group B — Ticket 2: `board` and `adapters`, the two commands that always exit 0

**AC-14 — the frame registers `board` and `adapters`.** As AC-1, for the remaining two names and
their help lines, with `adapters`' line carrying `[--probe] [--json]`. The spike's
`CLIs installed + no API keys` may not survive as written, for AC-1's second constraint; the word is
**subscription**.
*Test:* as AC-1, each pin shown red against the value ticket 1 left.

**AC-15 — the columns and the hint.** Every stage of `@quorum/shared`'s `STAGES`, in that order, its
name bold-padded to 14 characters; an empty column is skipped **except** `draft`, `requirements` and
`solutioned`, which always render; a column whose stage some flow `consumes` carries the dim hint
`→ harness run <flow> <id>` (the binary name in it is OQ-2's ruling). `board` reaches the flow set
through `lintFlowDirectory(path.join(harnessDir, 'flows'))`, keeping the records that carry a `flow`,
rather than re-implementing the spike's `readdirSync` + `loadFlow` + `catch`; a missing `flows/`
directory yields no hint rather than a raw `ENOENT`.
**This is a ruled divergence and is registered as one:** the spike's `readdirSync` order is
unspecified, `lintFlowDirectory` sorts, and `chore.yaml` and `solutioning.yaml` **both**
`consume: requirements` — so that column's hint is order-dependent today. Measured on this machine
`readdirSync('harness/flows')` already returns sorted order, so `chore` wins under both and no
rendered byte moves; what changes is a latent non-determinism.
*Test:* over a fixture with tickets in two stages, the rendered column set and the absence of the
others; over the six shipped flows, the `requirements` hint asserted to be `chore` with the reason
carried in the assertion; and a fixture whose `flows/` directory does not exist rendering and
exiting 0.

**AC-16 — the ticket row, byte for byte.**
`  <teal id> <title>  <dim>owner=<owner> cost=$<n.nn> iter=<json><token></dim>`, with `cost` the sum
of `history[].cost` to two decimals and `iter` `JSON.stringify(meta.iterations ?? {})`.
*Test:* the assertions `q0033-surface.js:342` actually makes — `/iter=.*review.*2/` and
`/cost=\$1\.25/` after ANSI stripping (M-7: the `owner=qa cost=$0.00 iter={}` form cited by one
candidate exists nowhere in `spike/test/`) — plus a zero-cost, empty-iterations row asserted in full
so both ends of each format are covered.

**AC-17 — containment is rendered in the glossary's vocabulary and nothing else.** One token per row,
appended inside the dim span: ` <base>:contained`, ` <base>:not-contained(+<n>)`,
` <base>:indeterminate(<reason>)`. `<base>` is read from `config.repo.base_branch`, defaulted to
`main` at the reading site and never substituted for a different configured value. The board says
"contained" and never "merged", "landed" or "shipped". A `stateOf` result of `no branch` renders
**only** where the stage is `solutioned`, `red`, `green`, `reviewed`, `qa-passed` or `deployed`, and
is suppressed at `draft`, `requirements`, `blocked`, `abandoned` and wherever `containment` returned
`null`. `board` passes the ticket's branch value through `core`'s interface and constructs no git
argument itself.
*Test:* `q0036-board-containment.js` C1–C10 translated in full — contained; `not-contained(+2)`
counting `base..branch` and never the symmetric difference; C10's ten-stage sweep; an absent
`branch:` key; a missing base ref; a genuinely shallow clone; a non-git project; a `master`-based
project where the string `main` appears nowhere; the `--upload-pack=` injection value, asserted to
add no git option and create no file; and a tag sharing the branch name. Fixtures build their own
repository and set their own git identity — no verdict may depend on this checkout's branches
(*"A test's verdict is a property of the commit"*, 2026-08-30).

**AC-18 — the two legends, each printed only when a row earned it.** The cost legend prints when any
ticket has a non-empty `history` and carries the tokens-only qualification; the indeterminate legend
prints when any *rendered* row was indeterminate, exactly once, and names all four reasons and that
indeterminate does not mean the code is missing.
*Test:* C4's `output.split('git could not answer').length - 1 === 1`, plus a no-history fixture
asserting the cost legend absent and a with-history one asserting it present.

**AC-19 — `adapters`: presence, probe and JSON.** For `claude` then `codex` in that order:
`✓ <name>: <version>` on a successful `check()`, `✗ <name>: <message>` on a throw, with the failing
adapter contributing `{ adapter, installed: false, error }` to the report and the loop continuing to
the other. Without `--probe`, `probeAdapter` is **not called**, successes record `login: 'unverified'`
and the dim presence-only notice prints. With `--probe`, each successful check is probed with the
resolved `repoDir`, and an indented second line reads
`✓ login verified — round-trip <ms>ms`, plus `, $<cost to 4dp>` when `cost_usd` is non-null and
`, <n> tokens` when `tokens` is truthy, or `✗ login not usable: <error>`. With `--json`, the report
prints as `{ probed, adapters }` at two-space indent **after** the human lines, which is deliberate
and not a JSON-only stream.
*Test:* driven against a stubbed `getAdapter`/`probeAdapter` so no vendor CLI is required — present,
absent, probe ok, probe failed, `cost_usd: null` (which must not render `$0.0000`), `tokens: 0`, and
both flags together. Per M-2 there is no inherited coverage to translate: every assertion is new.

**AC-20 — BYOS, and the three defects reported rather than fixed.**
(a) No file anywhere in `packages/cli` — source, test, fixture, manifest or configuration — matches
any pattern in `frame.source.test.ts:227`'s `CREDENTIAL` list. The refusal is `core`'s `check()`
(`claude.ts:95`, `codex.ts:89`) and the CLI's only job is to render the message it throws, verbatim,
on the `✗ <name>: <message>` line. The test proving that rendering creates no key **never spells one**:
it makes `check()` reject with a sentence the test does not have to know, and asserts the CLI
reproduces whatever the adapter threw.
(b) The refusal still says *"Harness runs on subscription OAuth only"*. Q-0068's, not this ticket's —
the CLI must not rewrite it on the way through, and a test pins that it reaches the terminal
unaltered.
(c) **`adapters` exits 0 even when both CLIs are absent** (`harness.js:424` `return`s). Preserved and
registered with an authority line rather than carried silently: an adopter's CI step running
`quorum adapters` reports success on a machine with no vendor CLI at all.
(d) Q-0066's crash — `probeAdapter` dereferencing a null `usage`, so a perfect login answers
`✗ login not usable: Cannot read properties of null` — is preserved and not caught in passing.
*Test:* a case asserting exit 0 with both adapters failing, whose name and comment say the zero is
preserved and name the successor.

**AC-21 — both commands write nothing, and the four registers are extended in the same change.**
AC-12's `INVOCATIONS` list gains `board` and `adapters` (the latter against a stubbed registry) and
the byte-identical property holds; AC-10's per-module symbol map gains `board.ts` and `adapters.ts`
entries; AC-11's `node:path` admission covers them; and AC-13's `binaryCarriedBy` is applied to
`q0036-board-containment.js`, whose whole binary half this ticket carries. `adapters` moves **no**
register entry, because no `spike/test/` file outside `smoke.js` exercises it — stated in the entry
rather than left as a silence.
*Test:* the four pinned totals re-derived and shown unmoved; each extension shown red against ticket
1's shipped state.

---

## 5. Non-goals

1. `runs` (Q-0092), `init` and `ticket` (Q-0093), `run`, the gate reader and the signal handler
   (Q-0094). No stub, no help line, no `COMMANDS` entry for any of them.
2. The mock end-to-end suite through the binary (Q-0095). Every assertion here runs **in process**;
   nothing here spawns the binary.
3. **Lint/run-preflight parity.** `q0033-surface.js:271` proves the two report the identical
   diagnostic for the identical defect; the run preflight is Q-0094's and does not exist here, so the
   property is **routed to Q-0094 as an obligation** rather than asserted over an absent subject
   (M-9). Written into that ticket's body at this gate, per *"a deferred obligation dies unless it is
   written into the next ticket's body"*.
4. `smoke.js`, `q0040-undecided.js:404` and the sixteen non-`lint` invocations of
   `q0033-surface.js`. Named in §0 so the seam is visible, not so this ticket crosses it.
5. Q-0068's *"Harness runs on subscription OAuth only"*; rendered unchanged (AC-20b).
6. Q-0066's `probeAdapter` crash (AC-20d). Both trees together, not here.
7. Q-0059's traversing `dirOf` and Q-0060's silent frontmatter, both preserved.
8. Q-0067's version probe. `adapters` prints whatever `check()` returns and asks nothing about it.
9. Q-0090's GA-4 — the unknown-command zero, and `regressed` exiting 0. Untouched.
10. TTY detection, `NO_COLOR` and `FORCE_COLOR`. Q-0090 non-goal 11, unchanged: escapes are written
    into a pipe exactly as the spike writes them, and the tests strip them as the spike tests do.
11. Any change to `spike/src/**`, and any deletion or edit under `spike/test/**` (ground rules 1 and
    2). If a change to `spike/src` appears necessary, the implement step **stops and says so**.
12. Validating `harness.yaml`. `projectConfigSchema` stays declared and called nowhere (Q-0043
    AC-11); every reading site keeps its own fallback.
13. `--json` on `board`, `lint` or `validate`; JSONL support in `validate`; any new semantic contract
    annotation; any adapter beyond `claude` and `codex`; any persistence of containment or adapter
    status.
14. Registry-resolved `npx quorum` (Q-0029, M6). No output, test or documentation may claim it.
15. Windows. Q-0098 registered the build as POSIX-only and this ticket does not widen it.
16. Any domain-behaviour change in `packages/core`. AC-3 adds two existing symbols to the barrel and
    AC-9 retires a test helper; no implementation moves.

---

## 6. Open questions

**OQ-1 — the register's shape. Owner: human. Blocking, and it must be answered once for four
tickets.** Ground rule 5 cannot be satisfied as written (M-5), so either `Entry` gains
`binaryCarriedBy` or `Verdict` gains a value such as `cli-ported`. **Recommendation:
`binaryCarriedBy`**, on the reasoning in AC-13: the verdict describes the *spike file's own*
properties — it spawns the binary and imports no spike source — which translation does not change,
and `admissible()` derives it from the file's text, so a fourth verdict would require that derivation
to learn about a second tree. It is blocking because Q-0092, Q-0093, Q-0094 and Q-0095 will each edit
this file next, and picking the shape once is cheaper than four tickets picking it separately.

**OQ-2 — the binary name in three user-facing sentences. Owner: human. Blocking for AC-7 and AC-15,
which are written to whichever way it is ruled.** The board's hint prints `→ harness run <flow> <id>`,
`ProjectNotFoundError` says ``run `harness init` in your repo``, and `validate`'s usage line says
`usage: harness validate …` — a binary that does not exist, in the product's first-run path.
`project.ts:31` records the second as *"Carried, not fixed (charter §2)"*. **Recommendation:
preserve all three verbatim here** — a rewrite is a behaviour change on a port ticket and the sites
are not this ticket's to choose between — **and allocate the successor at this gate**, scoped to
*every* user-facing occurrence of the old binary name at once (Q-0093's `init` next-steps line will
be a fourth) and distinct from Q-0068, whose subject is the adapter refusal string. It is blocking
only in the sense that an implement step **cannot open a ticket** — `backlog/` is not an
agent-writable surface — so the obligation expires silently if it is not allocated here. Under the
recommendation no code changes and the implement step is unblocked either way.

**OQ-3 — the module layout. Owner: implementer. Non-blocking.** Flat `src/lint.ts`,
`src/validate.ts`, `src/board.ts`, `src/adapters.ts`, or a `src/commands/` directory.
**Recommendation: flat**, matching the frame's own layout — `src/commands.ts` already exists as the
registry and a `src/commands/` beside it reads as the same thing. `frame.source.test.ts` walks `src`
recursively, so either satisfies the scans.

**OQ-4 — AC-9 edits a test in `packages/core` on a `packages/cli` ticket. Owner: implementer.
Non-blocking.** The alternative is leaving both copies of the frozen sentence and accepting that they
drift, which that helper's own doc comment already argues against. Recommendation as written; raised
so a reviewer meets the reasoning rather than the diff.

**OQ-5 — a collision Q-0095 inherits, recorded now rather than discovered later. Owner: Q-0095's
implementer. Nothing owed here.** `smoke.js:126–132` is the only end-to-end proof that a key in the
environment produces the refusal, and `frame.source.test.ts` AC-12 forbids the spelling
`ANTHROPIC_API_KEY` **anywhere in `packages/cli`**, tests included, with only the guard file exempt.
When Q-0095 translates that assertion it must earn a second exemption or place the assertion outside
this package. AC-20(a) deliberately proves the rendering without creating a key, so this ticket is
clear; the collision belongs in Q-0095's body now.

---

## 7. Risks

**R-1 — five guards move in one ticket, and a weakened guard reports green.** The repository's
most-recorded defect class. *Mitigation:* every re-scoping in AC-10 to AC-13 requires a mutation
demonstrated red, and none may be satisfied by deleting a clause — the `DOMAIN` scan gains an
inverse, the I/O scan splits rather than shrinks, the snapshot list grows, and the register gains a
field. The §3 split is itself a mitigation: the guard migration is reviewed against the smallest
command surface in the set.

**R-2 — the `board` fixtures cannot use `quorum init` or `quorum ticket new`**, which is how
`q0036-board-containment.js` builds every one of its ten. Both are Q-0093's. *Mitigation, and it
preserves the property the spike file protects:* build the project directly (write
`harness/harness.yaml`, as `main.test.ts`'s AC-8 fixture already does) and create the ticket with
**`Backlog.create()` from `@quorum/core`** — the same code path `quorum ticket new` will call, so the
frontmatter is still *"exactly what the product writes"*, which `q0036-board-containment.js:44–46`
asks for. Hand-written `ticket.md` YAML loses it.

**R-3 — `q0011-runs-cli.js` is Q-0092's file and holds all of `validate`'s coverage**, so two tickets
edit one register entry. *Mitigation:* `binaryCarriedBy` is a list, so the entry accumulates rather
than being overwritten; and Q-0010's body already warns that Q-0039 becomes a blocker the moment two
children run concurrently, so these run one at a time.

**R-4 — the skip notice is transcribed in four places** (`harness.js:453`,
`validate-artifact.test.ts:157` and `:189`, `q0011-runs-cli.js`), governed by a frozen contract, and a
fifth copy is about to be written. *Mitigation:* AC-9 reduces it to one copy in `packages/cli` plus
the spike's, and AC-8 requires the CLI test to carry the contract citation so the next person to edit
it knows the sentence is not theirs.

**R-5 — `lintFlowDirectory`'s sort changes which flow the `requirements` column advertises** on a
filesystem whose `readdir` order differs from this one. Measured identical here (AC-15) and pinned;
stated rather than left to be found, because the visible token is `chore` and the alternative is
`solutioning`.

**R-6 — a shallow clone or a missing ref reported as a negative containment claim.** Turning missing
evidence into `not-contained` is the failure the glossary's three-state vocabulary exists to prevent.
*Mitigation:* AC-17's C4 and C5 assert the reason token rather than the absence of `contained`.

**R-7 — fixtures that depend on the machine.** Ambient git identity, installed vendor CLIs, inherited
environment, or this repository's own branches. *Mitigation:* every fixture sets its own identity and
builds its own repository; `adapters` is driven against stubs; BYOS tests set and restore the
environment explicitly. `pnpm sweep:git-identity` runs in §9.

**R-8 — scope pressure from `q0033-surface.js`.** Sixteen of its twenty invocations are not this
ticket's and its scenarios are large and interleaved. The failure mode is an implementer translating
the *file* rather than the *command*. *Mitigation:* §0's table is the boundary and AC-5's test names
the scenarios it covers rather than the file.

**R-9 — the merge is red in an existing checkout until `pnpm install` links the new dependency
graph.** Q-0090 recorded this exact effect. *Mitigation:* §9's install step, run before either suite.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-20. No key path is added; no file in `packages/cli` names a credential spelling; the refusal is rendered from `core`'s throw and never re-spelled. `frame.source.test.ts`'s package-wide `CREDENTIAL` scan is kept intact rather than exempted. |
| **Worktree safety** | n/a by construction — all four commands are read-only, and AC-12 and AC-21 make that executable rather than asserted. |
| **Gate behaviour** | n/a. No command here reaches a gate; the gate reader and the five throw sites are Q-0094's. |
| **File format and schema** | No new file format, no schema change. `Project`'s four-key shape is deliberately unchanged (AC-11's rejected alternative). `validate` consumes existing JSON/YAML through `core`. |
| **Lint rules** | No flow file changes, so `harness lint` has nothing new to check. `@typescript-eslint/no-deprecated` applies to the new modules as to every `packages/**/*.ts`. |
| **Turbo inputs** | New tests build fixtures in `os.tmpdir()` and read nothing outside `packages/cli`, so `packages/cli/turbo.json` needs no new entry. `packages/core/turbo.json` already declares `../../packages/*/**/*.test.ts`, which is what makes AC-13's counterpart checks invalidate correctly. **Confirm rather than assume** (Q-0072). |
| **Packaging** | Q-0098's `files: ["dist"]` and the three-tarball fixture already guard the packed path; a command importing something outside `dist` breaks it. No new criterion — the existing fixture is the guard, and it must be run (§9). |
| **Cold-clone impact** | Positive and material. `adapters` is the second command the README tells a stranger to type and `board` the third; the installed binary can answer neither today. Nothing here lengthens the first 30 minutes or adds an installation step. |
| **Product boundaries** | AC-1 and AC-14: the help says Quorum, never calls the product a harness, and uses "subscription" rather than any credential word. The three `harness`-named sentences are preserved defects with an owed successor (OQ-2), not new prose. |

---

## 9. Environment and verification

- `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` **before**
  either suite; the implement step's worktree starts with no `node_modules`, because
  `commands.install` runs only in an `integrate` worktree (`harness/rules.md`).
- Both suites, forced: `npm test --prefix spike` and `pnpm turbo run test --force`. The spike suite
  must be **unchanged — 0 edits under `spike/**` —** and green.
- `pnpm lint` and `pnpm typecheck`, forced. `pnpm sweep:git-identity`.
- `pnpm turbo run build`, then the packed-install fixture, so the new modules are proven to reach a
  tarball rather than only a transpiler.
- Verified in **both** environment rows per Q-0072's closing finding: inside the `integrate`
  worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again forced on `main`
  after the merge, where both exist.
- **One manual proof beyond the suites**, because these are the product's visible surface:
  `pnpm exec quorum <command>` run in this repository for each shipped command and its output
  compared line for line against `node spike/bin/harness.js <same>`. Any difference is either named
  in AC-6, AC-15 or OQ-2 as a ruled divergence, or it is a defect.

---

## 10. Provenance

**The Claude candidate is the base**, and its §0 is why: it was written against the tree rather than
against the ticket body, and all four of its corrections survived re-measurement here — the 476/220
line counts, the five-file coverage spread, `currentBranch` belonging to `init`, and
`readData`/`ProjectNotFoundError` missing from the barrel. Its decisive contribution is M-5: reading
`admissible()` and `audit()` and finding that ground rule 5 is **unsatisfiable** without a schema
change is the kind of finding that would otherwise have arrived as a failing test in review round 2.
Taken largely intact: the guard inventory and its three re-scopings (AC-10 to AC-12), the renderer
retirement (AC-9), the `flowsDir` alternative registered as rejected (AC-11), the fixture strategy in
R-2, and OQ-2 and OQ-5.

**The Codex candidate contributed four things Claude did not have**, each folded in by name: the
single-read property — `validateArtifact` called exactly once per artifact, never re-reading to select
a semantic check — which is what Q-0037 AC-9 exists to pin and is now in AC-8; the structurally-invalid
run manifest that must **not** print the skip notice, also AC-8; the packed-install non-regression,
now a cross-cutting row rather than a criterion because Q-0098's fixture already guards it; and the
machine-dependence risks that became R-6 and R-7. Its non-goals list was the more exhaustive of the
two and §5 is largely its shape.

**Where they disagreed, and how it was ruled.** Codex's 38 criteria are not a larger scope but the
same scope restated — AC-7 to AC-13 are seven criteria for one rendering rule, and several assert
`core` behaviour (Q-0059's `dirOf`, the BYOS refusal ordering) that no CLI test can reach. They are
compressed into AC-17 and AC-20. Its AC-1 (*"appears in CLI help with its supported arguments and
flags"*) is not independently testable and is replaced by AC-1's compile-time coupling through
`Record<Command, CommandHandler>`. **Its AC-16 is struck outright** (M-9): lint/run-preflight parity
cannot be tested against a preflight that does not exist, and it is routed to Q-0094's body instead
of being asserted over an absent subject. Its open question 1 — *what are the real line totals?* — is
answered here by measurement rather than deferred to the implementer, which is where a question with
a `wc -l` answer belongs.

**Struck from both, and two candidate claims corrected.** Claude's AC-4 cites a regex that exists
nowhere in `spike/test/` (M-7); AC-16 now names the assertions `q0033-surface.js:342` actually makes.
Claude's AC-14 justified the `failSoftly` divergence on testability, which is false — `die` calls
`process.exit` and is already observed in process at `fail.test.ts:64` — so AC-6 keeps the divergence
and rewrites its authority onto `fail.ts`'s own recorded reason (M-8). Both candidates accepted the
ticket body's *"grouped because their two test files cover them together"*; M-2 measures that false
in both directions, and finding that `adapters` has **no** coverage in either named file is what made
the §3 seam measurable rather than a matter of taste.
