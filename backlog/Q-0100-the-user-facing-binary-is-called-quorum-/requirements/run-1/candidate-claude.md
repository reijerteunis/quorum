# Q-0100 — The user-facing binary is called `quorum`, not `harness`

*Requirements, run 1, candidate: product-manager (claude). Written 2026-09-06 against the tree at
`main`, after Q-0103's cutover.*

---

## 0. What I measured, and where the ticket body is wrong

The body carries a re-measurement dated 2026-09-06. I re-ran it rather than relaying it, because
this repository's own record says a measurement copied from a document is not a measurement
(Q-0099). Two of its three headline figures hold and one does not.

**Confirmed.** Eight printed sites across six source files — five in `packages/cli/src`, one in
`packages/core/src/backlog`. Enumerated in §3, AC-1. `spike/` and `spike/bin/harness.js` do not
exist, so the body's open question 1 is void.

**Corrected: ten test files move, not thirteen.** The body says *"nine in `packages/cli`, four in
`packages/core`"*. Measured by grepping each of the eight strings across `packages/**/*.test.ts`,
the files that assert a substring which changes are:

| package | files |
| --- | --- |
| `packages/cli/src` | `adapters.test.ts`, `board.test.ts`, `init.test.ts`, `lint.test.ts`, `main.test.ts`, `run.test.ts`, `ticket.test.ts`, `validate.test.ts` |
| `packages/core/src/backlog` | `backlog.source.test.ts`, `project.test.ts` |

Eight and two. The likely origin of thirteen is worth stating, because it is the difference between
the two senses of the word this whole ticket is about: **four further files assert only the prefix
`no harness/harness.yaml found`**, which names the *folder* and does not move —
`packages/cli/src/fail.test.ts:110`, `run.test.ts:518`, `runs.test.ts:324`, `ticket.test.ts:169`.
Counting files that mention the sentence gives thirteen; counting files whose assertion changes
gives ten. AC-8 turns that distinction into a check rather than a footnote.

**New, and it is the sharpest way to state the problem.** The product already contradicts itself
inside a single process. `packages/cli/src/commands.ts:58` — the help every unrecognised command
prints — opens `quorum — Quorum's command line.` and lists nine `quorum <command>` rows. Run
`quorum run` with no arguments and it answers `usage: harness run <flow> <ticket> …`. The adopter
is not merely told the wrong name; they are told two names by one binary, one screen apart.

**New: the guard this ticket needs already exists and is one file wide.**
`packages/cli/src/commands.test.ts` holds `FOLDER = /harness\/\S*/g` and asserts that `HELP`, with
folder spellings stripped, contains no `harness` — *"never calls the product a harness"*. Its own
comments record that the pattern read `harness\/\S+` until Q-0093 corrected it to `\S*`, because
`\S+` admitted `harness/harness.yaml` and refused the bare `harness/` that `quorum init` must print.
That regex has been debugged in place. AC-4 generalises it over every printed string rather than
writing a second one.

**New: ground rules 1, 2 and 5 are void.** `spike/` is deleted (rule 1), its tests with it (rule 2),
and `packages/core/src/spike-parity.test.ts` no longer exists (rule 5) — Q-0103 deleted the register
with the tree it compared against. Rules 3 (preserve behaviour, report defects rather than fixing
them in passing) and 4 (`packages/core` already holds the logic) stand and are carried into §6.

**New: `packages/cli/templates/harness/**` names no command.** Twenty template files, grepped for
`harness <verb>`: zero hits. An adopter's scaffolded `harness/` needs no edit, and `templates.test.ts`'s
byte-parity guard against `harness/flows/` is not disturbed. This closes a question the body left
implicit.

---

## 1. Problem

An adopter installs Quorum, runs `quorum init`, and is told:

```
✓ harness/ and backlog/ created in /home/them/their-repo
  next: harness adapters · harness ticket new "…" · harness run requirements T-0001
```

There is no binary called `harness`. `packages/cli/package.json` installs one bin, `quorum`. Every
one of those three commands fails with *command not found*, at roughly minute three of the thirty
the cold-clone test allows. Q-0093's entry records this being confirmed on the packed-install path
rather than predicted: *"a stranger who has just installed `quorum` is told to run a binary called
`harness`"*.

It is not one line. Eight sentences the CLI can print name a binary that does not exist, spread over
six files and six of the eight commands. Every one of them was preserved deliberately, each carrying
an authority comment naming this ticket — `board.ts:114`, `adapters.ts:113`, `init.ts:44`,
`run.ts:43`, `ticket.ts:67`, `project.ts:29`, and `runs.ts:35`'s preserved-defect list item 3. The
class was left whole on purpose so it could be ruled once. This is that ruling.

What makes it more than a rename is that the word means two things and both are load-bearing.
`.claude/rules/product-boundaries.md` is explicit: *"'Harness' is the concept and the folder
(`harness/`); 'Quorum' is the product. Never call the product a harness, never call the folder
quorum."* One shipped string carries both senses at once:

```
no harness/harness.yaml found — run `harness init` in your repo
```

`harness/harness.yaml` is the folder and must survive untouched. `harness init` is the command and
must become `quorum init`. A `sed s/harness/quorum/g` produces `no quorum/quorum.yaml found`, which
is wrong twice, and passes any test that only looks for the word.

**Surfaces touched:** the **CLI**, and only the CLI. `harness/` is not edited, `backlog/` is not
edited, and the daemon and web UI do not exist yet — though §5 OQ-1 is a question about the one
message M3's server will inherit.

---

## 2. User stories

**`adopter` — the cold-clone stranger.** *As someone trying Quorum on my own repository for the
first time, I want every command the tool tells me to run to be a command that exists, so that the
first thing I do after installing it is not a shell error.* Today `quorum init` hands them three
commands that all fail, and `quorum board`'s hint hands them a fourth.

**`maintainer` — the solo maintainer.** *As someone driving several repositories through Quorum, I
want a usage line to be copy-pasteable, so that a mistyped invocation costs me one correction rather
than two.* Today `quorum run` with no arguments prints a usage line that is wrong in its first word.

**`contributor` — the adapter contributor.** *As someone reading this repository to add an adapter or
a flow template, I want the product's own output to obey the naming rule the repository enforces on
me, so that I can tell a deliberate spelling from an accident.* Today `commands.test.ts` enforces the
rule over the help text and nothing enforces it anywhere else, so the eight divergences look like
oversights rather than the registered, dated preservations they are.

---

## 3. Acceptance criteria

Numbered, each independently testable. AC-1's rows are independently testable individually.

### AC-1 — The eight printed sentences name `quorum`

Each site below prints the *after* text exactly, with everything other than the binary name
unchanged — including the em dashes, the middle dots, the `…` in `<file…>`, the two-space indent on
`init`'s line and the `padEnd(14)` column on the board's.

| # | site | after |
| --- | --- | --- |
| 1 | `packages/cli/src/adapters.ts:115` | ``· presence only — logins NOT verified; run `quorum adapters --probe` before a real run`` |
| 2 | `packages/cli/src/board.ts:117` | `→ quorum run ${next.name} <id>` |
| 3 | `packages/cli/src/init.ts:49` | `  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001` |
| 4 | `packages/cli/src/run.ts:49` | `usage: quorum run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock] [--verbose] [--gate-answer advance\|retry\|abort]` |
| 5 | `packages/cli/src/run.ts:143` | `--base needs a revision: quorum run <flow> <ticket> --base <ref>` |
| 6 | `packages/cli/src/ticket.ts:68` | `usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]` |
| 7 | `packages/cli/src/validate.ts:62` | `usage: quorum validate <schema.json> <file…>` |
| 8 | `packages/core/src/backlog/project.ts:33` | ``no harness/harness.yaml found — run `quorum init` in your repo`` |

Row 8 is the criterion that discriminates a substitution from a ruling: `harness/harness.yaml`
survives byte for byte and only the backticked command moves. Row 4 is one concatenated constant
across two source lines; both halves are one string.

### AC-2 — No comment still says this is somebody else's to rule

Every authority comment that defers the spelling to Q-0100 is removed or rewritten to the ruling
this ticket lands. Measured, there are seven: `adapters.ts:15` and `:113`, `board.ts:114`,
`init.ts:44–48`, `run.ts:43–47`, `ticket.ts:67`, `project.ts:29–30`, and `runs.ts:35`'s
preserved-defect item 3. `init.test.ts:180`'s test title — *"and that line calls the binary
`harness`, which is preserved and is Q-0100's to rule"* — moves with its assertion.

A comment promising what the code no longer does is the defect this repository has recorded five
times (Q-0092, Q-0097, Q-0053). Leaving one behind here would be that defect landed by the ticket
whose whole subject is a sentence disagreeing with reality.

### AC-3 — `ProjectNotFoundError` is ruled, in one direction, with its reason in the code

Per §5 OQ-1, which is a blocker and must be answered at the gate before an implementer starts.

- **If ruled (a) — the message stays in `core` and only its words change:** row 8 of AC-1 is the
  whole of it, `packages/cli` gains nothing, and one line at `project.ts:29` states that the sentence
  names the binary this workspace installs. No decision entry is owed (GO-1).
- **If ruled (b) — the instruction leaves `core`:** `ProjectNotFoundError` carries a diagnosis
  naming `harness/harness.yaml` and the directory searched from, and no imperative; each of the six
  CLI catch sites (`adapters.ts:51`, `board.ts:41`, `lint.ts:56`, `run.ts:230`, `runs.ts:75`,
  `ticket.ts:62`) renders the instruction. A decision entry against `04-architecture.md`'s statement
  of what `core` is responsible for lands **before** any code, and the six sites derive the sentence
  from one place rather than six.

### AC-4 — A guard refuses a printed sentence that names the product a harness

One test, generalising `commands.test.ts`'s existing `FOLDER` discrimination from `HELP` to every
user-facing string the CLI can print. Its subject is **string literals containing whitespace** in the
production modules of `packages/cli/src` plus `packages/core/src/backlog/project.ts`. With
`/harness\/\S*/g` stripped, no such literal contains `harness` in any case.

The two conditions are what make it executable, and both were measured rather than assumed:

- **Literals, not comments.** `packages/cli`'s production modules carry twelve comment occurrences
  of `harness` — provenance JSDoc citing `spike/bin/harness.js:536` and similar. Q-0103 AC-19
  forbids rewriting past-tense provenance, so a scan that read comments would demand exactly the
  edit the cutover ruled out.
- **Whitespace, not a name list.** A path segment has none. This is what admits `project.ts:63`'s
  `path.join(d, 'harness', 'harness.yaml')` and `:81`'s `path.join(repoDir, 'harness')` without an
  exemption register — a register being the thing that goes stale (Q-0073).

Measured: after AC-1 lands, the only whitespace-bearing literals containing the word are
`init.ts:62`'s `harness/ and backlog/ created in` and row 8's `harness/harness.yaml`, both of which
`FOLDER` strips to nothing. `init.ts:39`'s `'../templates/harness/'` has no whitespace. The guard is
clean on the intended tree, and it is clean for the right reason.

### AC-5 — The guard's discrimination is demonstrated in both directions

Following `commands.test.ts:51–69`, which shows its filter working rather than asserting it: the
test proves `FOLDER` removes `harness/harness.yaml` and `harness/` while leaving `runs the harness`,
and proves a whitespace-free `'harness'` is not a subject while `run \`harness init\`` is. A filter
that removed everything would make the guard vacuous, which is *"a check that skips its subject must
not report success"* (2026-08-25) arriving inside the check written to enforce this rule.

### AC-6 — The guard's file list is derived from the package, not written into the test

The production modules are computed the way `frame.source.test.ts` already computes them, or from
`COMMANDS` plus the frame set — not from a hand-written array. Q-0051 found `q0050.source.test.ts`
scanning a hand-written six-name list while a seventh engine file went unread and the suite reported
green; the fix was to derive from `production`. A new command module added by M3 must be covered by
this guard without anyone remembering.

### AC-7 — The ten pinning test files move with the strings

The ten files in §0's table assert the `quorum` forms. Two need more than a substitution and are
called out because a substitution would weaken them:

- `board.test.ts:225–226` asserts `draft` padded by nine and `requirements` padded by two against
  the hint. The padding is `stage.padEnd(14)` and is independent of the hint's text, so both
  numbers stay 9 and 2 — a run that "fixes" the padding has misread the test.
- `backlog.source.test.ts:119` is a **source-text** pin, not a behavioural one, titled *"the sentence
  is the CLI's, byte for byte"*. Its title referred to a byte-identity against a tree that no longer
  exists; it moves with row 8 and its title says what it now pins.

### AC-8 — The folder half is proven to have survived, by the assertions that never named a command

`fail.test.ts:110`, `run.test.ts:518`, `runs.test.ts:324` and `ticket.test.ts:169` assert only
`no harness/harness.yaml found`. They are **unchanged** and pass. They are the executable form of
this ticket's central distinction: a change that corrupted the path would turn all four red while
every criterion above still passed.

### AC-9 — Verified through the built binary, not only in process

At least `init`, `board`, `run` (no arguments), `ticket` (no arguments), `validate` (no arguments)
and `adapters` are exercised through the emitted `dist/quorum.js` and their output shown to name
`quorum`. Reuse what the package has — `build.test.ts:1163`'s `binTarget()`, and the spawn sites
`end-to-end.test.ts`, `init.test.ts` and `failure-paths.test.ts` already carry — rather than adding
a seventh spawn helper.

This is not ceremony. Q-0101 measured that `invoke()`'s `exitCode` is an argument handed to a spied
`process.exit` and never a status an operating system reported, and the reviewer on five of the last
six chore runs could not execute the suite under `--sandbox read-only`. The sentence an adopter reads
comes out of a real process or it is not verified.

### AC-10 — Each of the eight is shown red before green

Reverting any one row of AC-1 alone turns at least one named test red, and the failing test is named
per row. Eight rows, eight discriminating failures. AC-4's guard is separately demonstrated red by
restoring any one of them.

### AC-11 — The documents that describe these commands are corrected in the same change

*"When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them
in the same change."* Measured, the numbered documents and the glossary hold nine command-shaped
occurrences:

| file | occurrences |
| --- | --- |
| `docs/GLOSSARY.md` | 5 — **Ticket** (`harness runs <token>`, `harness ticket new`, `harness init`), **Stage** (`harness board`), **Containment** (`harness board`), **Base override** (`harness run … --base`), **Dry run** (`harness run … --dry`) |
| `docs/02-sdlc-pipeline-spec.md` | 3 lines — `:158` `harness board`, `:470` and `:474` `harness lint`, `:595` `harness lint` |
| `docs/03-adapter-contract.md` | 1 — `:93` `harness adapters` / `harness adapters --probe` |

`docs/02-sdlc-pipeline-spec.md:607`'s `harness init --template sdlc` and `harness template diff`
name commands that **do not exist** — no `--template` flag, no `template` subcommand. They are moved
to `quorum` with the rest and their non-existence is *reported*, not invented into being: they
belong to M5's compiler and to the template library, and writing a criterion for them here would be
this ticket growing a feature.

Each numbered document edited gets its status line bumped with the date and what changed, per
`docs/README.md`'s convention.

### AC-12 — `HELP` is untouched and `commands.test.ts` stays green

`packages/cli/src/commands.ts:58–78` already says `quorum` in all ten of its lines and is the one
surface that was written correctly the first time. The new guard **extends** that file's rule to the
rest of the package; it does not replace, relax or re-implement its assertions, all of which still
pass unchanged.

### AC-13 — Nothing outside the named surfaces is touched

The change's file list is confined to `packages/cli/src`, `packages/core/src/backlog/project.ts`,
their tests, and the three documents in AC-11. Specifically **not**: `docs/decisions/**`
(append-only, and 15 entries name these commands — an entry describing the binary as it was named
when it was written stays true, which is the ruling Q-0103 already applied to the spike);
`contracts/**` (frozen; `Q-0006/review-lint.contract.md`, `Q-0006/review-runtime.contract.md`,
`Q-0011/runs-cli.contract.md` and `Q-0033/cli-review-surface.contract.md` name six commands between
them and an implementer may not edit a frozen contract); `docs/06-development-plan.md` (rewritten by
hand at each plan pass — Q-0094's E-3(a) records an implementer's plan edit being reverted and the
revert then enforced as a review finding); `harness/**`, `CLAUDE.md` and `.claude/rules/**`
(Q-0103's E-2 and *"`.claude/rules/` is a derived copy"* (2026-08-27) put all three on the human's
side of the gate); and `packages/cli/templates/**`, which §0 measured as naming no command at all.

### AC-14 — The preserved defects beside these strings are still preserved

Ground rule 3. Nothing here repairs, in passing: Q-0068's `"… is set — unset it; Harness runs on
subscription OAuth only"` at `claude.ts:95` and `codex.ts:89`; `adapters` exiting 0 when both CLIs
are absent; an unknown command printing help and exiting 0 (Q-0090 AC-6); `probeAdapter`
dereferencing a null `usage` (Q-0066); or `Backlog.create` defaulting `owner` to `process.env.USER`.
Each is somebody else's ticket and each stays visible as one.

---

## 4. Non-goals

- **Q-0068's BYOS refusal string.** Different sentence, different files, different rule — it calls
  the *product* a harness, where this ticket's eight call the *binary* one. Neither closes the
  other. One correction owed to that ticket at the gate: its pin list names `smoke.js:464`, a
  deleted file, and misses `packages/cli/src/end-to-end.test.ts:715`, which pins the same string
  today.
- **Renaming the `harness/` folder, the concept, or correct prose.** `harness/harness.yaml`,
  `harness/flows/`, `.harness/worktrees/`, `harness/<id>/integration` and every sentence about *the
  harness* are correct and stay.
- **A binary-name constant.** See OQ-2.
- **`quorum` gaining, losing or renaming a command.** The eight are the eight.
- **The stale-citation sweep.** Four `packages/cli` test files cite `packages/core/src/spike-parity.test.ts`
  in their headers — `adapters.test.ts:7`, `board.test.ts:7`, `end-to-end.test.ts:10` and `:737`,
  `failure-paths.test.ts:9` — and `docs/04-architecture.md:97` does too. The file was deleted by
  Q-0103. `docs/06-development-plan.md`'s status line calls this *"the citation sweep the cutover
  deliberately did not do"* and it is one of M2's three remaining items. **It has no ticket id**,
  which is reported at the gate rather than absorbed here.
- **Q-0102 (the sweep red under load) and Q-0105 (nothing checks that `main` was validated by CI).**
  Both will be met by this run's `integrate` and neither is its subject.
- **Test-facing names.** `packages/core/src/backlog/q0080-allocation.json:16` and `:83`'s scenario
  titles and `backlog.test.ts:444`'s test title contain `harness init` and `harness runs`. They
  describe the product to a developer reading a failure, not to a user; moving them is optional and
  is not a criterion either way.

---

## 5. Open questions

**OQ-1 — blocker, owner: the human at the requirements gate. Does the user-facing instruction stay
inside `packages/core`?**

`ProjectNotFoundError`'s message is a library telling a human what to type. `packages/core` does not
know whether a CLI, M3's server or a test is calling it, and the same error will be rendered into a
browser, where *"run `quorum init` in your repo"* is advice to someone who may not have a shell.
AC-3 branches on the answer and GO-1 makes a decision entry conditional on it, so it must be settled
before an implementer starts.

**Recommendation: (a), the message stays in `core` and only its word changes.** Three reasons,
measured rather than argued.

1. Six CLI catch sites print `error.message` **unaltered**. Splitting the sentence means six sites
   each composing an instruction, which is six chances to drift — the exact shape of the defect this
   ticket exists to close, reintroduced one layer down.
2. M3's server does not exist. `docs/06-development-plan.md` records the cut moving twice *"because
   a run measured something it assumed"*, both times on a dependency nobody had measured. Designing
   this message around an unbuilt HTTP surface is the same move.
3. The property `core` must keep is *"a library may not end its host"*, and
   `backlog.source.test.ts:111` already enforces it: no `process.exit`, no `console.` in
   `project.ts`. That property is untouched by which word the message carries. What made this
   sentence frozen was the port's byte-identity requirement against a tree that no longer exists —
   the constraint expired with the cutover.

If (a) is ruled, this ticket is machinery, owes no decision entry, and is roughly a day's work.

**OQ-2 — non-blocking, owner: the implementer, recommendation given. One owned constant for the
binary name, or eight literals?**

**Recommendation: literals.** The name changes once, in this change, and never again; `commands.ts`
already spells it out ten times in `HELP` and is the file a reader looks at first. A constant would
also have to be declared twice — `packages/core` cannot import `packages/cli` — so it would buy
indirection in exchange for a second declaration. Against that: eight literals is eight places to
get wrong once. AC-4's guard is what makes the literal form safe, which is why it is a criterion
rather than a nicety.

**OQ-3 — non-blocking, owner: the implementer. Does AC-4's guard extend to all of `packages/core`?**

**Recommendation: no.** Scope it to `packages/cli`'s production modules plus
`packages/core/src/backlog/project.ts`, which §0 measured as the only file in `core` holding a
user-facing sentence with the word in it. Widening to all of `core` adds `scaffold.ts:74`'s path
segment and every engine literal for no measured subject, and a guard with exemptions is a register
that goes stale. If a second `core` sentence appears later, the file list is where it is added and
AC-6 requires that list to be derived for `packages/cli` where it matters.

**OQ-4 — non-blocking, owner: the human. Is p2 right?**

The frontmatter says `p2`. The measured consequence is that the cold-clone path — the thing M6 is
scored on, and quality pillar 7 — hands a stranger three dead commands within the first five
minutes, and Q-0093 confirmed it on a real packed install. Q-0102's frontmatter carried the same
kind of disagreement with the plan and was corrected by hand. `backlog/` is not agent-writable, so
this is raised, not changed.

---

## 6. Ground rules, restated for the post-cutover tree

Q-0010's five are repeated in this ticket's body because a child cannot read its parent. Three no
longer have a subject and are stated void rather than silently ignored:

| rule | status |
| --- | --- |
| 1. Do not modify `spike/src/` | **void** — `spike/` does not exist (Q-0103) |
| 2. The spike's own tests are not deleted or edited | **void** — same |
| 3. Behaviour is preserved; a known defect is reported, not fixed in passing | **stands** — AC-14 |
| 4. `packages/core` already holds the logic; look there first | **stands** — and OQ-1 is the one place it is a question rather than a lookup |
| 5. `spike-parity.test.ts` is updated in the same change | **void** — deleted by Q-0103 |

**GO-3 stands unchanged:** `harness/Q-0100/integration` must exist before the first chore run
(`docs/02-sdlc-pipeline-spec.md:595`) — `review` diffs against it and only `integrate`, which runs
later, creates it.

**GO-2 is settled by events.** It said sequencing was cheap either way and that running before
Q-0093 would save that ticket a fourth instance. Q-0093 has shipped, the fourth instance exists, and
the count is eight. What survives is its refusal: do not run this concurrently with any other
ticket, because Q-0039 is unfixed and two runs on one ticket share a worktree and compute the same
run id.

---

## 7. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | n/a to behaviour. `adapters.ts:115`'s notice sits beside the vendor refusal strings; those are Q-0068's and AC-14 keeps them. No credential path is added, read or named. |
| **Worktree safety** | n/a. No flow, no worktree, no branch behaviour changes. The chore run's own `integrate` is the only thing that writes a branch. |
| **Gate behaviour** | n/a. No gate, exhaustion or otherwise, is added or altered. |
| **File format / schema** | n/a under OQ-1(a). Under OQ-1(b), `ProjectNotFoundError`'s message is a contract six CLI sites and M3's server read, which is why (b) owes a decision entry first. |
| **Lint rules** | n/a. No flow file changes, so `harness lint`'s subject is unchanged. |
| **Exit codes** | unchanged at every one of the eight sites. `run`, `ticket` and `validate`'s usage refusals still exit 1 through `die`; `board` and `adapters` still exit 0. |
| **Cold-clone impact** | the ticket's whole point, and the only entry in this table that is not "n/a". It shortens the first thirty minutes by removing four dead commands from the first two screens a stranger sees. |
| **Product-agnostic** | unaffected — no SaaS product is named anywhere in the change. |
| **Product boundaries** | central. AC-4 is the rule *"never call the product a harness, never call the folder quorum"* made executable beyond the one file that already enforces it. |

---

## 8. Risks

**R-1 — A blanket substitution corrupts the folder.** Highest, and the reason this is not a `sed`.
`no harness/harness.yaml found — run \`harness init\` in your repo` carries both senses in one
string. Mitigated by AC-1 row 8 quoting the target bytes and by AC-8, where four untouched
assertions go red if the path moved.

**R-2 — The guard fails open.** A hand-written file list stops covering a module somebody adds
later, which is exactly what Q-0051 found in `q0050.source.test.ts` — a scan over six names while a
seventh file went unread and the suite stayed green. AC-6 requires derivation.

**R-3 — The guard reads comments and demands a forbidden edit.** Measured: twelve comment
occurrences of `harness` in `packages/cli` production modules, most of them `spike/bin/harness.js`
provenance citations that Q-0103 AC-19 explicitly protects. A literal-only scan is not a
simplification; it is what keeps the guard's demands legal.

**R-4 — An implementer edits a surface it may not.** `docs/06-development-plan.md` (rewritten by
hand at each plan pass), `docs/decisions/**` (append-only), `contracts/**` (frozen), `harness/**`,
`CLAUDE.md` and `.claude/rules/**` all contain the word in command position and all sit outside
`developer-generalist`'s write paths or the engine's revert rules. Q-0103's run lost three implement
rounds refusing exactly this class, and Q-0094's lost one to a plan edit. AC-13 names the boundary
in the requirement so a review round does not have to discover it.

**R-5 — A criterion's prose is read as a byte contract.** Four errata in the last stretch (Q-0091
E-3, Q-0094 E-1, E-2, E-3(b)) came from that reading. Stated once here: **AC-1's table pins bytes,
because it quotes them; everywhere else in this document describes what must be conveyed.**

**R-6 — The run is derailed by a neighbour.** Q-0102 has the git-identity sweep red under load with
CI running it as two required jobs, and Q-0105 records that `main` stood 89 commits ahead of
`origin/main`. Either can make this run's `integrate` or CI look like this change's failure. Neither
is; both are named here so a round does not spend itself diagnosing them.

**R-7 — A first-round approve is banked.** 42 of 59 chore reviews returned `revise`, and Q-0107's
hand review returned `approve` on the first pass and a real blocker on the second over an identical
prompt. This change is small enough to draw a clean approve; AC-9's through-the-binary verification
and AC-10's per-row red demonstration are what make one worth believing.

---

## Appendix A — how each figure in §0 was obtained

Run at `main`, 2026-09-06, after Q-0103's cutover.

- **Eight sites / six files.** `git grep -nE "harness (run|init|ticket|board|adapters|lint|validate|runs) "`
  over the repository excluding `backlog/` and `docs/`, then filtering to non-test source and
  discarding comment lines.
- **Ten test files.** Each of the eight strings grepped separately with `git grep -nF` over
  `packages/**/*.test.ts`, and the matching files deduplicated. The four near-misses were found by
  grepping `no harness/harness.yaml found` separately and comparing the two sets.
- **The guard is clean after the change.** Per-file scan of `packages/cli/src/*.ts` (non-test) for
  quoted literals containing `harness`: twenty-one lines, of which nine are the sites in AC-1, ten
  are comments, and two are `init.ts:39` and `:62`. Both survive `/harness\/\S*/g`.
  `packages/core/src/backlog/project.ts` holds row 8 plus two bare `'harness'` path segments at
  `:63` and `:81`, neither containing whitespace.
- **Templates name no command.** `git grep -nE "harness (run|init|ticket|board|adapters|lint|validate|runs)" -- packages/cli/templates`
  returns nothing over twenty files.
- **Documents.** `git grep -nE` over `docs/01`–`docs/05`, `docs/GLOSSARY.md`, `docs/README.md`,
  `README.md` and `CLAUDE.md`; `docs/06` and `docs/decisions/**` counted separately and excluded by
  AC-13.
- **`spike/`, `spike-parity.test.ts` and `harness/port-charter.md`** each confirmed absent by `ls`.
