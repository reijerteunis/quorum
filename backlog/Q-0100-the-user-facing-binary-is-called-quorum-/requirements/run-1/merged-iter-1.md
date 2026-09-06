« Q-0100 — The user-facing binary is called `quorum`, not `harness`

*Merged requirement, run 1, iteration 1. Written 2026-09-06 against `main`, after Q-0103's cutover.
Merged from `candidate-claude.md` and `candidate-codex.md`; see §9 for provenance.*

**Verdict: needs-input.** One blocking question (OQ-1), with a measured recommendation. Everything
else is settled and both branches of that question are specified below, so the gate answers one
question and an implementer starts immediately.

---

## 0. What was measured, and what both candidates got wrong

Every figure below was re-run at `main` rather than taken from the ticket body or from either
candidate, because this repository's own record is that a measurement copied from a document is not
a measurement (Q-0099).

**Confirmed.** Eight printed sites across six source files — five modules in `packages/cli/src`, one
file in `packages/core/src/backlog`. Enumerated in AC-1. `spike/`,
`packages/core/src/spike-parity.test.ts` and `harness/port-charter.md` are all absent, so the ticket
body's open question 1 is void and ground rules 1, 2 and 5 have no subject.

**Confirmed — candidate-claude's correction of the ticket body holds.** The body says thirteen test
files pin these strings. **Ten** files hold an assertion that changes; the other three mention a
sentence whose changing half they do not assert. The full lists are in AC-7 and AC-8.

**Corrected in candidate-claude — AC-8 named files where it means assertions.** Of its four
"unchanged" files, `run.test.ts` and `ticket.test.ts` both *do* change: each carries a
command-shaped assertion in AC-7's set **and** a folder-only assertion in AC-8's. Only
`fail.test.ts` and `runs.test.ts` are untouched as files. Stated as four *assertions*, the
criterion is exactly right and is the sharpest check in the document; stated as four files it is
false and a reviewer would block on it.

**Corrected in candidate-claude — the documents hold fifteen command-shaped occurrences, not
nine.** Measured across `docs/01`–`docs/05`, `docs/GLOSSARY.md`, `docs/README.md`, `README.md` and
`CLAUDE.md`: **11 lines in 3 files, 15 occurrences.** Its table also says "3 lines" for
`02-sdlc-pipeline-spec.md` and then lists four line numbers. Full table in AC-11.

**Corrected in candidate-codex — AC-5 quotes a truncated string.** `run.ts:49–50` is one constant
built from two source lines, and the second half — `' [--verbose] [--gate-answer
advance|retry|abort]'` — is missing from that criterion's quoted text. Read as a byte contract, as
four errata in the last stretch were (Q-0091 E-3, Q-0094 E-1/E-2/E-3(b)), it specifies a shorter
usage line than the one that ships.

**New, and neither candidate has it — the `core` site defers to a document that no longer exists.**
There are **eleven** `Q-0100` citations in production source, across six `packages/cli/src` files:
`adapters.ts:15,45,113`, `board.ts:35,114`, `init.ts:45`, `run.ts:44`, `runs.ts:36,69`,
`ticket.ts:56,67`. The twelfth deferral, `packages/core/src/backlog/project.ts:30`, cites neither:
it says *"the binary will be `quorum` (Q-0010). Carried, not fixed (charter §2)"* — and
`harness/port-charter.md` was deleted by Q-0103. So an implementer scanning for `Q-0100` clears
eleven sites and leaves the one in `core`, still pointing at a charter that is gone. AC-3 is written
so that cannot happen.

**New — the product already contradicts itself inside one process.**
`packages/cli/src/commands.ts:58` opens `quorum — Quorum's command line.` and lists nine
`quorum <command>` rows. `quorum run` with no arguments answers `usage: harness run <flow>
<ticket> …`. The adopter is not merely told a wrong name; they are told two names by one binary,
one screen apart. Candidate-claude's finding, and it is the shortest statement of the problem.

**New — the guard this ticket needs already exists and is one file wide.**
`packages/cli/src/commands.test.ts:32` holds `const FOLDER = /harness\/\S*/g` and asserts that
`HELP`, with folder spellings stripped, contains no `harness`. Its own comments record the regex
reading `harness\/\S+` until Q-0093 corrected it, because `\S+` admitted `harness/harness.yaml` and
refused the bare `harness/`. That discrimination has been debugged in place; AC-4 generalises it
rather than writing a second one.

**Confirmed — the surfaces are legal for the flow that will run this.** Checked against
`harness/roles/developer-generalist.md`, which `chore.yaml:7` runs: `packages`, `docs`, `harness`
and `README.md` are in `paths:`, so AC-1, AC-7 and AC-11 name writable surfaces. `contracts` is
**not** in `paths:` and `docs/decisions/` is refused in the role's own prose, so AC-13's exclusions
are the boundary rather than a preference. `CLAUDE.md` and `.claude/rules/` are absent from `paths:`
— Q-0103 lost three implement rounds to exactly that.

**Confirmed — three surfaces need nothing.** `harness/**` holds **zero** command-shaped occurrences
outside `flows/`, and `harness/flows/**` holds zero. `packages/cli/templates/**` — twenty files —
holds zero. An adopter's scaffolded `harness/` needs no edit and `templates.test.ts`'s byte-parity
guard is not disturbed.

---

## 1. Problem

An adopter installs Quorum, runs `quorum init`, and reads:

```
✓ harness/ and backlog/ created in /home/them/their-repo
  next: harness adapters · harness ticket new "…" · harness run requirements T-0001
```

There is no binary called `harness`. `packages/cli/package.json` installs one bin, `quorum`. All
three of those commands fail with *command not found*, at roughly minute three of the thirty the
cold-clone test allows. Q-0093's entry records this being **confirmed on a real packed install**
rather than predicted: *"a stranger who has just installed `quorum` is told to run a binary called
`harness`"*.

Eight sentences the CLI can print name a binary that does not exist, across six files and six of
the nine commands. Each was preserved deliberately, each carrying an authority comment deferring
the spelling to this ticket, so that the class could be ruled once. This is that ruling.

What makes it more than a rename is that the word means two things and both are load-bearing.
`.claude/rules/product-boundaries.md`: *"'Harness' is the concept and the folder (`harness/`);
'Quorum' is the product. Never call the product a harness, never call the folder quorum."* One
shipped string carries both senses at once:

```
no harness/harness.yaml found — run `harness init` in your repo
```

`harness/harness.yaml` is the folder and must survive byte for byte. `harness init` is the command
and must become `quorum init`. A `sed s/harness/quorum/g` yields `no quorum/quorum.yaml found`,
which is wrong twice and passes any test that only looks for the word.

**Surfaces touched:** the CLI, one `core` error, their tests, and three documents. No flow, no
worktree, no gate, no schema, no adapter, no credential path.

---

## 2. User stories

**`adopter` — the cold-clone stranger.** *As someone trying Quorum on my own repository for the
first time, I want every command the tool tells me to run to be a command that exists, so that the
first thing I do after installing it is not a shell error.* Today `quorum init` hands them three
dead commands and `quorum board`'s hint a fourth.

**`maintainer` — the solo maintainer.** *As someone driving several repositories through Quorum, I
want a usage line to be copy-pasteable, so that a mistyped invocation costs one correction rather
than two.*

**`contributor` — the adapter or flow contributor.** *As someone reading this repository to add an
adapter, I want the product's own output to obey the naming rule the repository enforces on me, so
that I can tell a deliberate spelling from an accident.* Today one test file enforces the rule over
one constant, and the eight divergences read as oversights rather than the dated preservations they
are.

---

## 3. Acceptance criteria

Fourteen, each independently testable. AC-1's rows are independently testable individually.

### AC-1 — The seven CLI sentences name `quorum`

Each prints the *after* text exactly, everything but the binary name unchanged — the em dashes, the
middle dots, the `…` in `<file…>`, the two-space indent on `init`'s line, the `padEnd(14)` column on
the board's.

| # | site | after |
| --- | --- | --- |
| 1 | `packages/cli/src/adapters.ts:115` | ``· presence only — logins NOT verified; run `quorum adapters --probe` before a real run`` |
| 2 | `packages/cli/src/board.ts:117` | `→ quorum run ${next.name} <id>` |
| 3 | `packages/cli/src/init.ts:49` | `  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001` |
| 4 | `packages/cli/src/run.ts:49–50` | `usage: quorum run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock] [--verbose] [--gate-answer advance\|retry\|abort]` |
| 5 | `packages/cli/src/run.ts:143` | `--base needs a revision: quorum run <flow> <ticket> --base <ref>` |
| 6 | `packages/cli/src/ticket.ts:68` | `usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]` |
| 7 | `packages/cli/src/validate.ts:62` | `usage: quorum validate <schema.json> <file…>` |

Row 4 is **one constant concatenated from two source lines**; both halves are the string, and the
second half is the one candidate-codex's AC-5 omits.

### AC-2 — The eighth sentence, and the ruling it waits on

`packages/core/src/backlog/project.ts:33` today defaults to
``no harness/harness.yaml found — run `harness init` in your repo``. **This criterion branches on
OQ-1, which the gate answers.**

- **Ruled (a) — recommended — the message stays in `core` and only its words change.** The default
  becomes ``no harness/harness.yaml found — run `quorum init` in your repo``. `harness/harness.yaml`
  survives byte for byte and only the backticked command moves. `packages/cli` gains nothing. No
  decision entry is owed (GO-1). **This is the row that discriminates a ruling from a
  substitution.**
- **Ruled (b) — the instruction leaves `core`.** Then this document is **not** implemented as
  written: see OQ-1, which specifies the split and the sequencing, because (b) takes the ticket to
  roughly eighteen criteria and puts a human-written decision entry in front of the first line of
  code.

### AC-3 — No comment still defers the spelling, and none is left citing a deleted document

The subject is **twelve** sites, derived rather than transcribed: the eleven production citations of
`Q-0100` (§0) and `project.ts:29–30`, which cites `Q-0010` and `charter §2` instead. Each is removed
or rewritten to the ruling this ticket lands. `packages/cli/src/init.test.ts:180`'s test title —
*"and that line calls the binary `harness`, which is preserved and is Q-0100's to rule"* — moves
with its assertion, as do the sibling titles at `adapters.test.ts:145`, `run.test.ts:109` and
`ticket.test.ts:120`.

Two things this criterion does **not** authorise. Past-tense provenance JSDoc citing
`spike/bin/harness.js` is untouched — Q-0103 AC-19 forbids rewriting it, and `validate.ts:12` and
`ticket.ts:67` carry exactly that. And a scan keyed on the string `Q-0100` is **insufficient**: it
clears eleven sites and leaves the one in `core`. A comment promising what the code no longer does
is this repository's most-recorded defect class (Q-0092, Q-0097, Q-0053); leaving one behind here
would be that defect landed by the ticket whose whole subject is a sentence disagreeing with
reality.

### AC-4 — A guard refuses a printed sentence that names the product a harness

One test, generalising `commands.test.ts`'s existing `FOLDER` discrimination from `HELP` to every
user-facing string the CLI can print. Its subject is **string literals containing whitespace** in
the production modules of `packages/cli/src` plus `packages/core/src/backlog/project.ts`. With
`/harness\/\S*/g` stripped, no such literal contains `harness` in any case.

Both conditions were measured, not chosen:

- **Literals, not comments.** `packages/cli`'s production modules carry provenance comments citing
  `spike/bin/harness.js`; a scan that read comments would demand precisely the edit Q-0103 AC-19
  rules out.
- **Whitespace, not a name list.** A path segment has none. This admits `project.ts:63`'s
  `path.join(d, 'harness', 'harness.yaml')` and `:81`'s `path.join(repoDir, 'harness')` with no
  exemption register — a register being the thing that goes stale (Q-0073).

After AC-1 and AC-2 land, the only whitespace-bearing literals still holding the word are
`init.ts:62`'s `harness/ and backlog/ created in` and AC-2's `harness/harness.yaml`, both of which
`FOLDER` strips to nothing. `init.ts:39`'s `'../templates/harness/'` has no whitespace. The guard is
clean on the intended tree, and clean for the right reason.

### AC-5 — The guard's discrimination is demonstrated in both directions

Following `commands.test.ts:51–69`, which shows its filter working rather than asserting it: the
test proves `FOLDER` removes `harness/harness.yaml` and a bare `harness/` while leaving `runs the
harness`, and proves a whitespace-free `'harness'` is not a subject while ``run `harness init` `` is.
A filter that removed everything would make the guard vacuous — *"a check that skips its subject
must not report success"* (2026-08-25) arriving inside the check written to enforce this rule.

### AC-6 — The guard's file list is derived from the package, not written into the test

Computed the way `packages/cli/src/frame.source.test.ts:48` already computes it —
`const production = () => files().filter(([name]) => !name.endsWith('.test.ts'))` — or from
`COMMANDS` plus the frame set. **Not** a hand-written array. Q-0051 found `q0050.source.test.ts`
scanning a hand-written six-name list while a seventh engine file went unread and the suite reported
green; the fix was to derive from `production`. A command module added by M3 must be covered without
anyone remembering.

### AC-7 — The ten pinning test files move with the strings

| package | files |
| --- | --- |
| `packages/cli/src` | `adapters.test.ts`, `board.test.ts`, `init.test.ts`, `lint.test.ts`, `main.test.ts`, `run.test.ts`, `ticket.test.ts`, `validate.test.ts` |
| `packages/core/src/backlog` | `backlog.source.test.ts`, `project.test.ts` |

Two need more than a substitution, and a substitution would weaken them:

- `board.test.ts:225–226` asserts `draft` padded by nine and `requirements` padded by two against
  the hint. The padding is `stage.padEnd(14)` and is independent of the hint's text, so both numbers
  stay **9 and 2**. A round that "fixes" the padding has misread the test.
- `backlog.source.test.ts:119` is a **source-text** pin, not a behavioural one, titled *"the
  sentence is the CLI's, byte for byte"* — a byte-identity against a tree that no longer exists. It
  moves with AC-2 and its title says what it now pins.

`main.test.ts:341` is the board hint asserted through dispatch rather than in the board's own suite;
it is in the set for that reason.

### AC-8 — The folder half is proven to have survived, by four assertions that never named a command

`fail.test.ts:110–111`, `run.test.ts:518`, `runs.test.ts:324` and `ticket.test.ts:169` assert only
`no harness/harness.yaml found`. All four are **unchanged and pass**. They are the executable form
of this ticket's central distinction: a change that corrupted the path turns all four red while
every criterion above still passes.

Stated as **assertions**, not files: `run.test.ts` and `ticket.test.ts` each also carry a
command-shaped assertion in AC-7's set. Only `fail.test.ts` and `runs.test.ts` are untouched as
whole files.

### AC-9 — Verified through the built binary, not only in process

At least `init`, `board`, `run` (no arguments), `ticket` (no arguments), `validate` (no arguments)
and `adapters` are exercised through the emitted `dist/quorum.js` and their output shown to name
`quorum`. Reuse what the package has — `build.test.ts`'s `binTarget()`, and the spawn sites
`end-to-end.test.ts`, `init.test.ts` and `failure-paths.test.ts` already carry — rather than adding
a seventh spawn helper.

Not ceremony: Q-0101 measured that `invoke()`'s `exitCode` is an argument handed to a spied
`process.exit` and never a status an operating system reported, and the reviewer on five of the last
six chore runs could not execute the suite under `--sandbox read-only`. The sentence an adopter
reads comes out of a real process or it is not verified.

### AC-10 — Each of the eight is shown red before green

Reverting any one row of AC-1, or AC-2's, turns at least one named test red, and the failing test is
named per row: eight rows, eight discriminating failures. AC-4's guard is separately demonstrated
red by restoring any one of them.

### AC-11 — The documents that describe these commands are corrected in the same change

*"When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them
in the same change."* Measured: **15 occurrences across 11 lines in 3 files.**

| file | lines | occurrences |
| --- | --- | --- |
| `docs/GLOSSARY.md` | `:23` (×3 — `harness runs <token>`, `harness ticket new`, `harness init`), `:25`, `:28`, `:105`, `:112` | 7 |
| `docs/02-sdlc-pipeline-spec.md` | `:158`, `:470`, `:474`, `:595`, `:607` (×2) | 6 |
| `docs/03-adapter-contract.md` | `:93` (×2) | 2 |

`docs/02-sdlc-pipeline-spec.md:607`'s `harness init --template sdlc` and `harness template diff`
name commands that **do not exist** — no `--template` flag, no `template` subcommand. They move to
`quorum` with the rest and their non-existence is **reported, not invented into being**: they belong
to M5's compiler and the template library, and writing a criterion for them here would be this
ticket growing a feature.

Each numbered document edited gets its status line bumped with the date and what changed, per
`docs/README.md`'s convention. `docs/GLOSSARY.md` has no status line and needs none.

### AC-12 — `HELP` is untouched and `commands.test.ts` stays green

`packages/cli/src/commands.ts:58–78` already says `quorum` in all ten of its lines and is the one
surface written correctly the first time. The new guard **extends** that file's rule to the rest of
the package; it does not replace, relax or re-implement its assertions, all of which pass unchanged.

### AC-13 — Nothing outside the named surfaces is touched

The change is confined to `packages/cli/src`, `packages/core/src/backlog/project.ts`, their tests,
and AC-11's three documents. Specifically **not**:

- `docs/decisions/**` — append-only, and the implement role is forbidden it in its own prose. Many
  entries name these commands; an entry describing the binary as it was named when it was written
  stays true, which is the ruling Q-0103 already applied to the spike.
- `contracts/**` — **not in the role's `paths:`** and frozen besides.
  `Q-0006/review-lint.contract.md`, `Q-0006/review-runtime.contract.md`, `Q-0011/runs-cli.contract.md`
  and `Q-0033/cli-review-surface.contract.md` hold eleven occurrences between them. After this
  ticket, four frozen contracts name a binary that does not exist; that is **reported at the gate**,
  not repaired here.
- `docs/06-development-plan.md` — rewritten by hand at each plan pass. Q-0094's E-3(a) records an
  implementer's plan edit being reverted and the revert then enforced as a review finding.
- `harness/**`, `CLAUDE.md`, `.claude/rules/**` — Q-0103's E-2 and *"`.claude/rules/` is a derived
  copy"* (2026-08-27) put all three on the human's side of the gate; the latter two are absent from
  the role's `paths:` outright.
- `packages/cli/templates/**` — measured as naming no command at all.

### AC-14 — The preserved defects beside these strings are still preserved

Ground rule 3. Nothing here repairs, in passing: Q-0068's *"… Harness runs on subscription OAuth
only"* at `claude.ts:95` and `codex.ts:89`; `adapters` exiting 0 when both CLIs are absent; an
unknown command printing help and exiting 0 (Q-0090 AC-6); `probeAdapter` dereferencing a null
`usage` (Q-0066); `Backlog.create` defaulting `owner` to `process.env.USER`. Each is somebody else's
ticket and each stays visible as one.

---

## 4. Non-goals

- **Q-0068's BYOS refusal string.** Different sentence, different files, different rule — it calls
  the *product* a harness where this ticket's eight call the *binary* one. Neither closes the other.
  One correction owed to that ticket at the gate: its pin list names `smoke.js:464`, a deleted file.
- **Renaming the `harness/` folder, the concept, or correct prose.** `harness/harness.yaml`,
  `harness/flows/`, `.harness/worktrees/`, `harness/<id>/integration` and every sentence about *the
  harness* are correct and stay.
- **A shared binary-name constant.** See OQ-2.
- **`quorum` gaining, losing or renaming a command**; any change to argv, dispatch, colouring, exit
  codes, board flow selection or init scaffolding beyond the strings above. The eight are the eight.
- **Renaming `ProjectNotFoundError` itself, changing how projects are discovered, or changing the
  error type `loadProject` throws.**
- **Designing M3's HTTP mapping or the UI's recovery action.** Out of scope under either ruling.
- **The stale-citation sweep.** `adapters.test.ts:7`, `board.test.ts:7`, `end-to-end.test.ts:10` and
  `:737`, `failure-paths.test.ts:9` and `docs/04-architecture.md:97` cite
  `packages/core/src/spike-parity.test.ts`, which Q-0103 deleted. `docs/06`'s status line calls this
  *"the citation sweep the cutover deliberately did not do"* and it is one of M2's three remaining
  items. **It has no ticket id** — reported at the gate, not absorbed here.
- **Q-0102 and Q-0105.** Both will be met by this run's `integrate` or CI; neither is its subject.
- **Test-facing names.** `packages/core/src/backlog/q0080-allocation.json:16` and `:83`'s scenario
  titles and `backlog.test.ts:444`'s test title contain `harness init` and `harness runs`. They
  describe the product to a developer reading a failure, not to a user; moving them is optional and
  is a criterion either way.
- **Publishing, or what registry-resolved `npx quorum` may claim** — Q-0029's, in M6.

---

## 5. Open questions

### OQ-1 — **blocker.** Owner: the human at the requirements gate. Does the user-facing instruction stay inside `packages/core`?

`ProjectNotFoundError`'s message is a library telling a human what to type. `packages/core` does not
know whether a CLI, M3's server or a test is calling it, and the same error will one day be rendered
into a browser, where ``run `quorum init` in your repo`` is advice to someone who may not have a
shell. AC-2 branches on the answer and GO-1 makes a decision entry conditional on it.

**It is a blocker rather than a footnote for one mechanical reason.** Under (b) a decision entry
must exist *before* the implement step runs, and no step on this route may write one —
`harness/roles/developer-generalist.md` says so in its own prose: *"You do not add to
docs/decisions/ or its index; a decision is the human's to record."* A requirement that rules (b)
by itself hands the loop work no agent in it can perform, which this repository has now recorded
fifteen times and priced twice with numbers (Q-0091's $14.28, Q-0101's $31.16).

**Recommendation: (a) — the message stays in `core` and only its word changes.** Four reasons,
measured:

1. **Six catch sites print `error.message` unaltered** — `adapters.ts:51`, `board.ts:41`,
   `lint.ts:56`, `run.ts:230`, `runs.ts:75`, `ticket.ts:62`. Splitting the sentence means six sites
   each composing an instruction: six chances to drift, which is the exact defect this ticket exists
   to close, reintroduced one layer down.
2. **M3's server does not exist.** `docs/06` records the CLI cut moving twice *"because a run
   measured something it assumed"*, both times on a dependency nobody had measured. Designing this
   message around an unbuilt HTTP surface is that move.
3. **The property `core` must keep is untouched by the word.** `backlog.source.test.ts:111` already
   enforces *"a library may not end its host"* — no `process.exit`, no `console.` in `project.ts`.
4. **What froze this sentence has expired.** `project.ts:30` cites `charter §2`, and Q-0103 deleted
   the charter. The constraint that made it byte-identical to a second tree went with that tree.

**If (a) is ruled:** this document is ready as written, the ticket is machinery, no decision entry
is owed, and it is roughly a day's work at fourteen criteria.

**If (b) is ruled, it must not be implemented as written.** (b) adds a decision entry, a
surface-neutral `core` message, six CLI composition sites, a single-source rendering, and a
non-CLI-consumer assertion — taking the ticket to roughly eighteen criteria, past the fifteen
ceiling. The seam is clean and the order is forced:

- **Q-0100 keeps this document unchanged**, including AC-2's word-only form, so the adopter-facing
  defect closes on all eight sentences now.
- **A successor takes the architecture**, allocated by the human at this gate because `backlog/` is
  not agent-writable. Its body, written out here so it cannot expire: *`ProjectNotFoundError` carries
  a diagnosis — the file it looked for and the directory it searched from — and no imperative. The
  six CLI catch sites render the recovery instruction from one place rather than six.
  Constructing the error directly, or receiving it from `loadProject` outside the CLI, yields the
  diagnosis alone; `core` imports no presentation package. A decision entry against
  `04-architecture.md`'s statement of what `core` is responsible for lands before any code.* Six
  criteria, and the four existing folder-only assertions in AC-8 are its regression check too.

Candidate-codex specifies that successor well and its AC-9 to AC-12 are the body to reuse.

### OQ-2 — non-blocking. Owner: the implementer, recommendation given. One owned constant for the binary name, or eight literals?

**Recommendation: literals.** The name changes once, here, and never again; `commands.ts` already
spells it ten times in `HELP` and is the file a reader opens first. A constant would have to be
declared twice, since `packages/core` cannot import `packages/cli` — indirection bought with a
second declaration. Against that, eight literals is eight places to get wrong once, which is what
AC-4's guard is for; that is why the guard is a criterion and not a nicety.

### OQ-3 — non-blocking. Owner: the implementer. Does AC-4's guard extend to all of `packages/core`?

**Recommendation: no.** Scope it to `packages/cli`'s production modules plus
`packages/core/src/backlog/project.ts`, measured as the only file in `core` holding a user-facing
sentence with the word in it. Widening adds `scaffold.ts`'s path segments and every engine literal
for no measured subject, and a guard with exemptions is a register that goes stale (Q-0073). If a
second `core` sentence appears, the file list is where it is added — and AC-6 requires that list to
be derived where it matters.

### OQ-4 — non-blocking, raised not changed. Owner: the human. Is `p2` right?

The frontmatter says `p2`. The measured consequence is that the cold-clone path — what M6 is scored
on, and `harness/product-context.md`'s quality pillar 7 — hands a stranger three dead commands in
the first five minutes, confirmed by Q-0093 on a real packed install. Q-0102 carried the same kind
of frontmatter/plan disagreement and was corrected by hand. `backlog/` is not agent-writable, so
this is raised rather than changed.

---

## 6. Ground rules, restated for the post-cutover tree

Q-0010's five are repeated in this ticket's body because a child cannot read its parent. Three have
no subject and are stated void rather than silently ignored.

| rule | status |
| --- | --- |
| 1. Do not modify `spike/src/` | **void** — `spike/` does not exist (Q-0103) |
| 2. The spike's own tests are not deleted or edited | **void** — same |
| 3. Behaviour is preserved; a known defect is reported, not fixed in passing | **stands** — AC-14 |
| 4. `packages/core` already holds the logic; look there first | **stands** — and OQ-1 is the one place it is a question rather than a lookup |
| 5. `spike-parity.test.ts` is updated in the same change | **void** — deleted by Q-0103 |

**GO-1** is unchanged and is answered by OQ-1: a decision entry is owed only under (b).

**GO-2 is settled by events.** It weighed running before or after Q-0093. Q-0093 has shipped, its
instance exists, and the count is eight. What survives is its refusal: **do not run this
concurrently with another ticket**, because Q-0039 is unfixed and two runs on one ticket share a
worktree and compute the same run id.

**GO-3 stands:** `harness/Q-0100/integration` must exist before the first chore run
(`docs/02-sdlc-pipeline-spec.md:595`) — `review` diffs against it and only `integrate`, which runs
later, creates it.

**GO-4 — if OQ-1 is ruled (b), allocate the successor at this gate** from the body in §5, before the
chore run starts.

---

## 7. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | n/a to behaviour. `adapters.ts:115`'s notice sits beside the vendor refusal strings; those are Q-0068's and AC-14 keeps them. No credential path is added, read or named. |
| **Worktree safety** | n/a. No flow, worktree or branch behaviour changes; the chore run's own `integrate` is the only thing that writes a branch. |
| **Gate behaviour** | n/a. No gate, exhaustion or otherwise, is added or altered. |
| **File format / schema** | n/a under (a). Under (b), `ProjectNotFoundError`'s message is a contract six CLI sites and M3's server read, which is why (b) owes a decision entry first. |
| **Lint rules** | n/a. No flow file changes, so `harness lint`'s subject is unchanged. |
| **Exit codes** | unchanged at all eight sites. `run`, `ticket` and `validate`'s usage refusals still exit 1 through `die`; `board` and `adapters` still exit 0. |
| **Regression** | `pnpm lint`, `pnpm typecheck` and `pnpm turbo run test --force --continue` pass; the mock end-to-end stays green. This is what `integrate` runs and is not restated as a criterion. |
| **Installation paths** | the workspace-local and locally packed paths keep working; nothing claims registry-resolved `npx quorum`. |
| **Cold-clone impact** | the ticket's whole point, and the only row here that is not "n/a": it removes four dead commands from the first two screens a stranger sees. |
| **Product-agnostic** | unaffected — no SaaS product is named anywhere in the change. |
| **Product boundaries** | central. AC-4 is *"never call the product a harness, never call the folder quorum"* made executable beyond the one constant that already enforces it. |

---

## 8. Risks

**R-1 — A blanket substitution corrupts the folder.** Highest, and why this is not a `sed`. One
string carries both senses. Mitigated by AC-2 quoting the target bytes and by AC-8, where four
untouched assertions go red if the path moved.

**R-2 — The guard fails open.** A hand-written file list stops covering a module added later —
exactly what Q-0051 found in `q0050.source.test.ts`, six names scanned while a seventh file went
unread and the suite stayed green. AC-6 requires derivation from `production()`.

**R-3 — The guard reads comments and demands a forbidden edit.** `packages/cli`'s production modules
carry `spike/bin/harness.js` provenance that Q-0103 AC-19 protects. A literal-only scan is not a
simplification; it is what keeps the guard's demands legal.

**R-4 — An implementer edits a surface it may not.** `contracts/**`, `docs/decisions/**`,
`CLAUDE.md` and `.claude/rules/**` all hold the word in command position and all sit outside the
implement role's `paths:` or its own prose. Q-0103 lost three implement rounds refusing this class
and Q-0094 one to a plan edit. AC-13 names the boundary in the requirement so a review round does
not have to discover it.

**R-5 — A criterion's prose is read as a byte contract.** Four errata in the last stretch came from
that reading. Stated once: **AC-1's and AC-2's tables pin bytes, because they quote them; every
other sentence in this document describes what must be conveyed.** Candidate-codex's truncated
`USAGE` is what this risk looks like when it lands.

**R-6 — The run is derailed by a neighbour.** Q-0102 has the git-identity sweep red under load with
CI running it as two required jobs; Q-0105 records `main` standing 89 commits ahead of
`origin/main`. Either can make this run's `integrate` or CI look like this change's failure. Neither
is; both are named so a round does not spend itself diagnosing them.

**R-7 — A first-round approve is banked.** 42 of 59 chore reviews returned `revise`, and Q-0107's
hand review returned `approve` on the first pass and a real blocker on the second over an identical
prompt. This change is small enough to draw a clean approve; AC-9's through-the-binary verification
and AC-10's per-row red demonstration are what make one worth believing.

---

## 9. Provenance

**From candidate-claude — the spine.** The eight-site byte table, the ten-file correction of the
ticket body, the self-contradiction between `HELP` and `run`'s usage line, the discovery that
`commands.test.ts`'s `FOLDER` regex is the guard to generalise, the literals-with-whitespace scan
condition and its two measured justifications, the derivation requirement from `frame.source.test.ts`,
the through-the-binary verification, the AC-13 boundary list, the void-ground-rules table, and the
(a) recommendation with its catch-site and `backlog.source.test.ts:111` reasoning. Its OQ-1 framing
as a blocker is adopted, and the verdict follows it.

**From candidate-codex — four things it does better.** The precise (b) design, reused verbatim as
the successor body in OQ-1 (its AC-9 to AC-12): a surface-neutral `core` message, CLI-owned
recovery, the non-CLI-consumer assertion, and the mixed-use sentence assertion. Its explicit
statement that a repository-wide replacement must not satisfy the criterion (its AC-14). Its
cross-cutting row on the two installation paths and `npx quorum`. And its user story for the
contributor reading core errors, folded into §2.

**Rejected from candidate-codex, with reasons.** Its AC-1 makes a decision entry the first
criterion while declaring *"No blocking product questions remain"* — it answers the blocker in the
(b) direction unilaterally, and no step on this route may write a decision entry. Its seventeen
criteria exceed the fifteen ceiling, which under (b) is a symptom rather than a formatting problem:
(b) is two tickets. Its AC-5 quotes a truncated `USAGE`. Its AC-16 restates what `integrate` runs
and its AC-17 is a checklist rather than a criterion; both are moved to §7.

**Corrected in candidate-claude.** AC-8 named four *files* as unchanged where two of them change
elsewhere — restated as four *assertions*. Its documents table under-counts: fifteen occurrences
across eleven lines in three files, not nine, and its own line list contradicts its count. Its AC-2
subject is incomplete: `project.ts:30` defers via `Q-0010` and `charter §2`, not `Q-0100`, so a scan
for this ticket's id clears eleven sites and leaves the twelfth pointing at a document Q-0103
deleted.

**Verified independently at the gate, from neither candidate.** The eleven `Q-0100` production
citations and the twelfth site's stale charter reference; that `harness/**` and `harness/flows/**`
hold zero command-shaped occurrences, so no harness context file moves; that `contracts` is absent
from `developer-generalist`'s `paths:` while `docs`, `packages` and `harness` are present, which is
what makes AC-11 legal and AC-13's contract exclusion a boundary rather than a preference; and the
six `ProjectNotFoundError` catch sites by file and line.
