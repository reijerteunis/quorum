« Q-0099 — CLI `board` and `adapters`, the two commands that always exit 0

*Merged requirement, run 1, iteration 1. Written against the tree at `f7d0c43`, 2026-09-04.*

---

## 0. What was re-measured, and what it changes

The ticket body is Appendix A of Q-0091's merged requirement, transcribed on **2026-09-03**. Since
then **four tickets have landed on this ticket's subject** — Q-0091 (`lint`, `validate`), Q-0092
(`runs`), Q-0093 (`init`, `ticket`) and Q-0094 (`run`). Every claim below was re-derived rather than
inherited, and **eight of the findings change the work**. Two of them are shipped tests that go red
the moment this ticket registers a name.

### The findings that change the work

**M-1 — Two shipped guards use `board` as their negative fixture, and both fail when it is
registered.** The single most important measurement here, because it is invisible until an implement
round runs the suite and then reads as a mystery.

- `packages/cli/src/commands.test.ts:107–109`, *"the extraction has a subject"*, appends a synthetic
  `  quorum board …` line to `HELP` and asserts
  `mentioned(withStray).filter((name) => !isCommand(name))` is `['board']`. Once `board` is a
  command, `isCommand('board')` is `true`, the filter yields `[]`, and the assertion fails.
- `packages/cli/src/frame.source.test.ts:455–457`, *"AC-10 — an unregistered command module fails"*,
  uses `const unregistered: [string, string][] = [['board.ts', 'containment();']]` and asserts —
  through `.toContain` — the offender `board.ts: a command module with no entry saying which domain
  symbols it may name`. Once `COMMAND_DOMAIN` gains a `board.ts` row, which AC-10 below requires,
  that sentence is not produced and the assertion fails.

Neither may be repaired by weakening. Both are *demonstrations that a guard discriminates*, which is
what *"A check is not established by reading it"* (2026-08-29) exists to require, so each must be
**re-aimed at a name that is not a command and shown still to fire**. AC-2 is that criterion, and it
exists so this arrives as a criterion rather than as two red tests diagnosed from scratch.

**M-2 — the ticket body names the wrong register.** It says *"`main.test.ts`'s `INVOCATIONS` gains
`board` and `adapters`"*. Q-0091 **split** that list in two (`main.test.ts:23–46`):

- `INVOCATIONS` is AC-6's subject — the four shapes that must **print the help** and leave the status
  at 0. Adding `board` there asserts that `quorum board` prints `HELP`, which is false, and turns
  AC-6 red.
- `READ_ONLY` is `INVOCATIONS` plus one real invocation of each read-only command, and is what drives
  the byte-identical tree-and-refs snapshot. That is the register this ticket's claim belongs to.

**M-3 — `board.ts` may not import `node:fs`, so the spike's `existsSync` guard cannot be
reproduced.** `frame.source.test.ts` asserts `production().filter(([, text]) => IO_MODULE.test(text))`
is `[]`, and `IO_MODULE` (`:189`) is
`/from '(node:fs[^']*|node:child_process|node:os|node:url)'/`. The spike guards with
`fs.existsSync(path.join(harnessDir, 'flows'))` (`spike/bin/harness.js:355`), while
`lintFlowDirectory` documents the alternative in its own header: *"a missing directory throws a raw
`ENOENT` rather than a `FlowError` … preserved defect"* (`packages/core/src/lint/lint.ts:276–278`).
So the **mechanism is forced to change while the behaviour is preserved**: a narrow catch on
`ENOENT`. Stated here rather than left to a review round, because the obvious wide `catch {}` also
swallows a lint crash and the `ENOTDIR` the spike propagates.

**M-4 — the ticket body's negative claim is false, and it is false about the file AC-5 orders
translated in full.** The body says the form `owner=qa cost=$0.00 iter={}` *"exists nowhere under
`spike/test/`"*. `grep -rn "owner=qa cost" spike/ packages/` returns exactly one line:

```
spike/test/q0036-board-containment.js:126:
  assert.match(output(r), /T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/, 'the row keeps its exact current shape')
```

That is scenario **C3**. The remedy the body proposes — assert a zero-cost, empty-iterations row in
full — is right; its justification is not. Recorded because a reader re-deriving against a stated
negative stops looking.

**M-5 — the inherited risk is obsolete: `init` and `ticket new` both exist.** The body's *"Risks it
inherits"* says the board fixtures *"cannot use `quorum init` or `quorum ticket new` … both are
Q-0093's"*. Q-0093 shipped **2026-09-04**; both are in `COMMANDS` and in `HANDLERS`. Verified
end to end: `init` scaffolds `path.resolve(rest[0] ?? '.')` (`init.ts:52–53`), `ticket` resolves its
backlog through `loadProject(flags.project)` (`ticket.ts:58–64`), and `loadProject(dir?)`
(`project.ts:78`) takes the directory as a parameter. So `q0036-board-containment.js`'s own approach
— build the project through the CLI so the frontmatter is *"exactly what the product writes"*
(`:45–46`) — **translates directly** through `test/invoke.ts`, with `--project` in place of
`process.chdir`. The body's fallback (hand-write `harness.yaml`, call `Backlog.create()`) is now the
*worse* option and is registered as rejected.

**M-6 — the `CREDENTIAL` scan does not match the wording it is being cited against.** The base
candidate justifies rewriting the `adapters` help line by claiming the package-wide credential scan
would refuse the spike's `CLIs installed + no API keys`. Measured against all nine patterns
(`frame.source.test.ts:788–791`), it would not: `/API_KEY/i` requires an underscore, and `API keys`
carries a space. **The rewrite obligation stands and its authority moves**: it is
`.claude/rules/product-boundaries.md` — the word is **subscription** — together with `commands.ts`'s
own header, which commits to carrying each line's *information* rewritten rather than transcribed.
Recorded because a criterion resting on a mechanism that does not fire costs a review round arguing
about it.

**M-7 — the `loadProject`-and-`die` block has four copies, not two.** It is in `lint.ts:54–58`,
`run.ts:230`, `runs.ts:75` and `ticket.ts:58–64`. This ticket makes it **six**, not the five the base
candidate's open question counts, so the threshold sentence in that question is mis-aimed. The rule
forcing the duplication is Q-0091 E-6's and is inherited rather than re-litigated; only the count
moves. Note also that `board` needs the **whole** `Project` — `backlog`, `harnessDir`, `repoDir` and
`config` — where `lint.ts`'s helper returns a directory, so this is the same catch-and-die shape and
not a copyable function.

**M-8 — `runs.test.ts` has no tree-and-refs snapshot, so the precedent the base candidate cites for
`adapters` does not exist.** The recommendation survives — `main.test.ts`'s claim is a snapshot
around **unmocked** commands, and adding `adapters` would force `vi.mock('@quorum/core')` into the
file that proves `lint` and `validate` write nothing — but it is a **new** shape rather than an
inherited one. And `READ_ONLY`'s own JSDoc promise, *"the list grows with each read-only command as
it lands"*, is **already false**: `runs` is not in it. AC-9 makes the promise honest rather than
repeating it.

**M-9 — a fifth sentence naming a binary called `harness`, and this ticket brings two of them.**
`spike/bin/harness.js:422` prints ``· presence only — logins NOT verified; run `harness adapters
--probe` before a real run``. Q-0100's body names three (the board hint, `ProjectNotFoundError`,
`usage: harness validate`) and Q-0093 confirmed a fourth (`init`'s next-steps line). The adapters
notice is a **fifth**, and it arrives here. Preserved verbatim under ground rule 3; recorded so
Q-0100's register is complete before that ticket runs.

**M-10 — the ticket body's `## 11. Provenance` section is Q-0091's, transcribed by mistake.** It
describes ruling `validateArtifact`'s single-read property *"now in AC-8"*, a structurally-invalid
run manifest and a *"struck AC-16 routed to Q-0094"* — none of which is this ticket's AC-8, this
ticket's subject, or this ticket's scope. It is the parent document's account of its own merge,
carried across with Appendix A. It binds nothing and is superseded by §12 below.

### The findings that confirm rather than change

**M-11 — the `lintFlowDirectory` substitution is behaviour-identical, measured rather than assumed.**
The worry is that `lintFlowDirectory` *lints* where `loadFlow` merely loads, so a flow that parses
but fails lint would be dropped here and kept there. It is not: `loadFlow` **already calls
`lintFlow`** (`packages/core/src/engine/loaders.ts:16–21`), and `lintFlowDirectory`'s per-file body is
the same three steps — parse, assign `file`, `lintFlow` — pushing a record **without** `flow` on any
throw (`lint/lint.ts:282–299`). The cross-flow pass afterwards only pushes `problems` and never
removes `flow`. So `records.filter((r) => r.flow !== undefined).map((r) => r.flow)` is the spike's
`flows` array exactly, modulo:

| | spike `board` | `lintFlowDirectory` |
| --- | --- | --- |
| order | `readdirSync`, unspecified | `.sort()` |
| missing directory | guarded by `existsSync` | raw `ENOENT` — M-3 |
| work done | parse + lint per file | the same, plus one cross-flow walk |

**M-12 — the order divergence is latent and no rendered byte moves.** `chore.yaml` and
`solutioning.yaml` both `consume: requirements`, so `flows.find()` picks by array order. On this
machine `readdirSync('harness/flows')` already returns sorted order, so `chore` wins under both. What
the change removes is a non-determinism, not a hint.

**M-13 — this is the first command child that needs no new `@quorum/core` symbol.** All six domain
symbols are already exported and already in `DOMAIN` (`frame.source.test.ts:339–345`): `loadProject`,
`containment`, `lintFlowDirectory` for `board`; `loadProject`, `getAdapter`, `probeAdapter` for
`adapters`. `package.test.ts:334` derives the expected barrel surface *from that block by regex*, so
the barrel does not move either. Q-0091 added three names, Q-0092 six, Q-0093 two; this ticket adds
none — ground rule 4 satisfied for the first time rather than merely asserted.

**M-14 — the citations.** `case 'board':` is `spike/bin/harness.js:353`; `case 'adapters':` is
`:406` and its `return;` is **`:424`**, `:425` being the closing brace. The body says `:425` in its
header and `:424` in its AC-7(c); **AC-7(c) is right**. `currentBranch` is defined at `:287` and
called only at `:326` inside `init` — the body's claim, confirmed. `board` reaches `loadFlow` at
`:355`.

**M-15 — the inherited-coverage figure is correct, for the first time in this cut.** `wc -l
spike/test/q0036-board-containment.js` is **220** exactly — no `+1`, no scope error — and the whole
file is board scenarios, so *"`board`'s whole binary half is `q0036-board-containment.js` plus one
row at `q0033-surface.js:342`"* holds. `docs/06-development-plan.md:571` and `:705` both warn that
Q-0099 *"still carries one"* of the wrong figures; measured, it does not. Stated because the standing
instruction is to distrust it, and the next reader would otherwise re-derive against a warning that
does not apply here. (`q0033-surface.js` is 476 lines, which is the base candidate's correction of an
earlier `446`, confirmed.)

**M-16 — `owner=` is the account unless it is supplied.**
`Backlog.create({ owner = process.env.USER ?? 'unknown', … })` (`backlog/backlog.ts:190`), the
preserved `owner` defect ground rule 3 forbids closing here. `q0036`'s `makeTicket` passes
`--owner qa` (`:49`); `q0033`'s does not. A translated fixture asserting `owner=` **must** supply
one, or its verdict is a property of the account — refused by *"A test's verdict is a property of the
commit, not of the checkout or the account"* (2026-08-30).

**M-17 — the containment interface already refuses a hostile branch name.** `stateOf(branch:
unknown)` (`git/git.ts:261–275`) returns `null` for a non-string, then matches against a `Set` built
from `for-each-ref` **before** any git invocation, so `--upload-pack=…` resolves to
`indeterminate(no branch)` and never reaches a command line. C8's safety is therefore a `core`
property; the CLI-level claim is only that `board` builds no git argument of its own, which
`IO_MODULE` (no `node:child_process`) and `COMMAND_DOMAIN` already enforce structurally.

**M-18 — a column with no consuming flow emits an empty dim span.** `c.dim(next ? … : '')` produces
`\x1b[2m\x1b[0m`, not nothing. Invisible to every translated assertion, because they all read through
`plain()`. Preserved anyway: it costs one ternary and a port preserves behaviour.

**M-19 — the help's description column is 42, and both new lines fit it.** Measured over all seven
shipped lines: every one lands at column 42, the widest prefix being `  quorum validate <schema.json>
<file…>` at 39. `  quorum board` is 14 and `  quorum adapters [--probe] [--json]` is 36, so no
existing line reflows. `commands.test.ts:239` pins `columns.length` at **7**; it becomes **9**.

**M-20 — turbo needs no new input, and the parity pins are identifiable.**
`../../harness/flows/*.yaml` is already declared for `@quorum/cli#test`, so a board test reading the
six shipped flows adds no declaration. In `packages/core/src/spike-parity.test.ts`,
`q0036-board-containment.js` (`:236`) is `verdict: 'cli'`, `carriedBy: []`, with **no**
`binaryCarriedBy` and a `binaryHalf` still ending *"— Q-0010"*; `q0033-surface.js` (`:173`) carries
four counterparts and its `binaryHalf` **already names this ticket** — *"and S11's board
compatibility — Q-0099"*. The four totals — 220 / 2739 / 2469 / 5428 and 55% — are pinned at
`:1202–1207`; `wc -l spike/test/*.js` is 5465, less `run.js`'s 37, which is 5428.

---

## 1. Problem

`quorum` dispatches seven commands. Two of the spike's eight are missing, and they are the two a
stranger reaches **first**.

For the **adopter**, `quorum init` prints `next: harness adapters · …` and the command it names does
not exist. `adapters` is the one command that de-risks a paid run before it is paid for — it says
whether the vendor CLIs are installed and, with `--probe`, whether the subscription actually answers
— so without it the first thing a cold-clone user is told to do fails. `board` is the third step of
the same path: the kanban that says which tickets exist, what stage each is at, and, since Q-0036,
where the code actually is relative to the base branch.

For the **maintainer**, `board` is the only surface that renders **containment**, the git-derived fact
a stage cannot carry. `stage: reviewed` says a review happened; `main:not-contained(+12)` says the
code is not in the base branch, and the two are routinely different. Nothing else in the product
answers that question, so until `board` is ported it is unanswerable from the binary.

Both commands are also structurally the *simplest* remaining, which is why they are one ticket: each
ends in `return;` and can only exit 0 (`spike/bin/harness.js:398`, `:424`), where every other ported
command carries an exit-code contract. What they cost is not control flow but **rendering fidelity**
— 220 lines of board scenarios pin the containment vocabulary token by token, and the `adapters`
surface has **no inherited coverage at all**.

The risk this ticket carries is different from its predecessors'. It is not *"can the presentation
layer be built"* — the domain logic is entirely in `core`, and this is the first child needing no new
barrel symbol (M-13). It is that **registering these two names breaks two shipped guards that use
them as negative fixtures** (M-1), and that the criterion naming the register to extend names the
wrong one (M-2).

---

## 2. User stories

**Adopter.** *As a cold-clone adopter, I run `quorum adapters` because `quorum init` just told me to,
and I am told which of my vendor CLIs Quorum can see — one line each, with a version — so I know
before I spend anything whether the two subscriptions I already pay for are visible. When I add
`--probe`, I am told whether each login actually answers, with the round-trip and what it cost.*

**Adopter.** *As a cold-clone adopter, `quorum board` shows me my one ticket under `draft` with the
command that moves it forward, so I do not have to read the flow files to learn what to run next.*

**Maintainer.** *As a solo maintainer with fifty-odd tickets, `quorum board` tells me both facts at
once: the stage each ticket claims, and whether its branch is actually in `main`. When git cannot
answer — a shallow clone, a base ref that is not there, a branch nobody created — it tells me that in
those words and never guesses `not-contained`, because a false negative would send me looking for work
that is already landed.*

**Contributor.** *As an adapter contributor, `quorum adapters --probe --json` gives me a
machine-readable report of what my adapter's `check()` and a real round-trip returned, so the
contract I am implementing has an observable surface.*

---

## 3. Acceptance criteria

Eleven, each independently testable. Every test runs through `main` via
`packages/cli/test/invoke.ts` — the dispatch boundary is part of the claim (Q-0091 AC-2) — and every
fixture is pointed with `--project <dir>` rather than `process.chdir`, which exercises the flag the
spike reads inside its own `loadProject` and avoids a working-directory race between test files.

---

### AC-1 — `board` and `adapters` are registered, in the spike header's order, and their help lines fit the column

`COMMANDS` (`commands.ts:34`) becomes, exactly:

```ts
['help', 'init', 'ticket', 'board', 'run', 'lint', 'adapters', 'validate', 'runs']
```

`board` between `ticket` and `run`, `adapters` between `lint` and `validate`, because
`spike/bin/harness.js:5` sits between `:4` and `:6`, and `:8` between `:7` and `:9` — the ordering
rule Q-0092, Q-0093 and Q-0094 each applied. `HANDLERS` (`main.ts`) gains the two matching entries;
the `Readonly<Record<Command, CommandHandler>>` type makes a name without a handler, or a handler
without a name, a compile error.

`HELP` gains two lines carrying the **information** of the spike header's counterparts, rewritten
rather than transcribed:

- `board` — that it is a kanban of tickets by stage.
- `adapters` — its two flags `[--probe] [--json]`, that it reports which vendor CLIs are installed,
  and that `--probe` also proves the login. **The spike's `CLIs installed + no API keys` may not
  survive**: the word is **subscription**, per `.claude/rules/product-boundaries.md` and
  `commands.ts`'s own header. Note that the package-wide credential scan would *not* have caught the
  old wording (M-6), so this clause is the only thing enforcing it.

*Test:* a Q-0099 block in `commands.test.ts` in the shape its four predecessors wrote.
(a) Both pins — `[...COMMANDS]` and `mentioned(HELP)` — move to the nine-name list and are shown
`not.toStrictEqual` the seven-name value they held, so neither was widened to a `toContain` that
accepts either. (b) `isCommand('board')` and `isCommand('adapters')` are `true`. (c) The `adapters`
line contains `[--probe] [--json]` and says what `--probe` adds; the `board` line says what it shows;
neither carries `API key` in any spelling. (d) Order: `indexOf('ticket') < indexOf('board') <
indexOf('run')` and `indexOf('lint') < indexOf('adapters') < indexOf('validate')`. (e) The alignment
test's `columns.length` register moves **7 → 9** and the single-column assertion still holds — the
column is 42 and both new prefixes (14 and 36) clear it (M-19), so no existing line reflows.

---

### AC-2 — the two guards that use `board` as their negative fixture are re-aimed, and shown still to discriminate

Both are demonstrations that a guard fires, so neither may be deleted or weakened (M-1).

(a) `commands.test.ts:107–109` builds `withStray` by appending a `board` line to `HELP` and asserts
the unregistered set is `['board']`. Re-aim the synthetic line at a name the frame does not dispatch
and will not — one that is not among the spike's eight — and keep both halves: the extraction finds
it, **and** `isCommand` rejects it.

(b) `frame.source.test.ts:455–457`'s `unregistered` fixture is `[['board.ts', 'containment();']]`.
Re-aim the module name the same way. Its sibling clause — `domainOffenders([], [], COMMAND_DOMAIN)`
containing `lint.ts: an entry for a module that is no command's` — is unaffected and stays.

*Test:* each re-aimed fixture produces the same offender message it produced before, over the
post-change `COMMAND_DOMAIN` and `COMMANDS`; and the **old** fixture value is shown, in an assertion
or a comment at the site, to no longer discriminate — so a later reader cannot restore it thinking it
was arbitrary.

---

### AC-3 — the board's columns and its hint, over the flow set `core` already computes, with its three divergences ruled in place

`quorum board` iterates `@quorum/shared`'s `STAGES` in order. For each stage:

1. Its tickets are those whose `meta.stage` equals it.
2. An **empty** column is skipped **except** `draft`, `requirements` and `solutioned`, which always
   render.
3. The header is `c.bold(stage.padEnd(14))` followed by `c.dim(hint)`, where `hint` is
   `→ harness run <flow-name> <id>` for the **first** flow whose `consumes` is that stage, and the
   empty string otherwise — which emits an empty dim span, preserved (M-18).
4. **The binary in that hint stays `harness`.** Ground rule 3 and Q-0100, which owns all five such
   sentences at once (M-9); a fix here would be that ticket done badly, one command at a time.

The flow set comes from `lintFlowDirectory(path.join(harnessDir, 'flows'))`, keeping the records whose
`flow` is present.

**Three divergences from the spike are forced, and each carries a one-line `Why:` naming its
authority** — never a transcription of this document, per `harness/rules.md`:

| | divergence | authority |
| --- | --- | --- |
| 1 | the flow set comes from `lintFlowDirectory`, so records are **sorted** where `readdirSync` was unspecified | behaviour-identical by M-11; the non-determinism removed by M-12 |
| 2 | a missing `flows/` is a narrow **`ENOENT` catch**, not `fs.existsSync` | `node:fs` is refused to production modules by `frame.source.test.ts`'s AC-11 scan (M-3) |
| 3 | the `loadProject`-and-`die` block is a **fifth and sixth copy** | Q-0091 E-6 and `runs.ts`'s own header: a shared frame module would name `loadProject`, which AC-10's partition forbids (M-7) |

Divergence 2 is spelled precisely: catch, test `(error as NodeJS.ErrnoException).code === 'ENOENT'`,
rethrow otherwise. The spike's `existsSync` guard returns `true` for a *file* named `flows` and then
crashes in `readdirSync` with `ENOTDIR`, so a blanket `catch {}` would be a behaviour change wearing a
port's clothes — and would turn any failure, a corrupt `harness/` or a permissions error, into "no
hint" while reporting success, which is *"a check that skips its subject must not report success"*
(2026-08-25) applied to a command.

*Test:* (a) over a fixture with tickets at two stages only, the rendered column set is those two plus
`draft`, `requirements` and `solutioned`, in `STAGES` order, and no other stage appears.
(b) Over a **two-flow fixture** whose flows both `consume: requirements` and whose filename order
would disagree with sorted order, the hint names the sorted-first — the rule, not today's answer;
this is divergence 1's subject. (c) Over the **six shipped flows**, the `requirements` hint is
`chore`, with the reason carried in the assertion message; the read is an already-declared turbo
input (M-20). (d) A project whose `harness/` holds no `flows/` renders every column, prints no hint
and exits 0 — and the same fixture with `flows` as a **file** is shown to throw, which is divergence
2's subject and what makes the catch narrow rather than blanket. (e) `padEnd(14)` asserted on a stage
name shorter than 14 and on `requirements`, which is 12.

---

### AC-4 — the ticket row, byte for byte

Each ticket in a column renders as one line:

```
  <c.teal(id)> <title>  <c.dim(`owner=${owner} cost=$${cost} iter=${iter}${token}`)>
```

with two leading spaces, two spaces before the dim span, `cost` the sum of `history[].cost` treating a
missing `cost` as 0 and formatted `toFixed(2)`, and `iter` `JSON.stringify(meta.iterations ?? {})`.
`token` is AC-5's, inside the same dim span.

*Test:* the two assertions `q0033-surface.js:342` **actually** makes, translated —
`/iter=.*review.*2/` and `/cost=\$1\.25/` after `plain()` — over a fixture that rewrites `iterations`
to `review: 2` and appends `q0033-surface.js:341`'s two history rows, one with `cost: 0` and one with
`cost: 1.25`, so the **sum** is exercised rather than a single value echoed. Plus **C3's full-row
form**, `/T-0001[^\n]*owner=qa cost=\$0\.00 iter=\{\}/` (`q0036-board-containment.js:126`), which pins
the zero-cost and empty-iterations ends of both formats — the assertion the ticket body said did not
exist (M-4). The fixture supplies `--owner qa` explicitly, because the default is the account (M-16).

---

### AC-5 — containment is rendered in the glossary's vocabulary and nothing else

One token per row, appended inside the dim span, with a leading space:

| result | token |
| --- | --- |
| contained | ` <base>:contained` |
| not contained | ` <base>:not-contained(+<n>)` |
| indeterminate | ` <base>:indeterminate(<reason>)` |
| suppressed, or no question asked | *(nothing)* |

`<base>` is `config.repo?.base_branch ?? 'main'`, defaulted at the reading site and **never**
substituted for a configured value. The four reasons are `missing ref`, `shallow clone`, `git failed`
and `no branch`, and no fifth spelling is introduced. The board says **contained**, never "merged",
"landed" or "shipped".

A `no branch` result renders **only** at `solutioned`, `red`, `green`, `reviewed`, `qa-passed`,
`deployed`, and is suppressed at every other stage; a `stateOf` returning `null` renders nothing. The
branch value goes through `containment(repoDir, base).stateOf(branch)` and `board.ts` constructs no
git argument itself (M-17).

*Test:* `q0036-board-containment.js` C1–C10 translated in full, each keeping its own discriminating
assertion:

| | claim |
| --- | --- |
| C1 | `main:contained`, no `indeterminate`, **and** nothing written: `ticket.md` byte-identical, `for-each-ref` unchanged, no file appearing or vanishing under `backlog`, `harness`, `.quorum` |
| C2 | `not-contained(+2)` counts `base..branch`; `(+3)` — the symmetric difference — is refused |
| C3 | a draft ticket naming an unresolvable branch renders **unannotated, not indeterminate**; a ticket with no `branch:` key the same; an empty backlog renders with no `fatal:` |
| C4 | a `trunk` base that does not resolve is `trunk:indeterminate(missing ref)`, never a containment claim, and no raw `fatal:` reaches the user |
| C5 | a **genuinely shallow** clone is `indeterminate(shallow clone)` with **no ahead count** and never `not-contained` — absent history cannot disprove ancestry |
| C6 | a non-git project renders every row and exits 0, matching neither `main:` nor `indeterminate` nor `fatal:` |
| C7 | a `master`-based project prints `master:contained` and the string `main` appears **nowhere** |
| C8 | `branch: "--upload-pack=touch pwned"` renders unannotated or indeterminate, and creates no `pwned` file in the fixture **or** in `process.cwd()` |
| C9 | a tag sharing the branch name does not stop the branch being annotated — `main:contained`, no `indeterminate` |
| C10 | `no branch` at all six claiming stages and at none of the four quiet ones, plus the no-`branch:`-key case rendering nothing at any stage |

C5's fixture keeps the `file://` scheme and `--depth 1`, because `--depth` is silently ignored for a
plain local path, and keeps the `rev-parse --is-shallow-repository` pre-assertion that the fixture is
genuinely shallow. Every fixture commit carries `-c user.email=… -c user.name=…` **at the call site**,
per `harness/rules.md` and because `git-identity.test.ts` reads literals.

---

### AC-6 — the two legends, each printed only when a row earned it

The **cost legend** prints when any listed ticket has a non-empty `history`, and carries the
tokens-only qualification — billed cost where the vendor reports one, token-only vendors not
included. The **indeterminate legend** prints when any *rendered* row was indeterminate, **exactly
once**, naming all four reasons and saying that indeterminate does not mean the code is missing. A row
whose `no branch` was suppressed does not arm it — the spike sets its flag from the post-suppression
value, which is what makes that clause true rather than incidental.

*Test:* C4's `output.split('git could not answer').length - 1 === 1` — one legend line however many
rows were indeterminate. C10's `/does not exist \(no branch\)/`, the legend covering the reason it
just printed. Plus a no-history fixture asserting the cost legend **absent** and a with-history one
asserting it present, so both directions have a subject; and a fixture whose only `no branch` is
suppressed, asserting the indeterminate legend absent.

---

### AC-7 — `adapters`: presence, probe and JSON

For `claude` then `codex`, in that order, each resolved through `getAdapter(name, config.adapters)`:

1. `await adapter.check()` succeeding prints `✓ <name>: <version>` (`✓` green).
2. It **throwing** prints `✗ <name>: <message>` (`✗` red), contributes
   `{ adapter, installed: false, error }` to the report, and **the loop continues**.
3. **Without `--probe`**: `probeAdapter` is not called, the report records
   `{ adapter, installed: true, version, login: 'unverified' }`, and after the loop the dim
   presence-only notice prints — preserved verbatim, including the `harness adapters --probe` it names
   (M-9, Q-0100's).
4. **With `--probe`**: each *successful* check is probed with the resolved `repoDir` as `cwd`, and an
   indented second line reads either `  ✓` + dim(` login verified — round-trip <ms>ms`) — with
   `, $<cost to 4dp>` appended when `cost_usd` is **non-null**, and `, <n> tokens` when `tokens` is
   **truthy** — or `  ✗ <bold>login not usable</bold>: <error>`. The report entry is
   `{ adapter, installed: true, version, login: 'verified'|'failed', ...probeResult }`, in that key
   order, the spread last.
5. **With `--json`**: `JSON.stringify({ probed: Boolean(flags.probe), adapters: report }, null, 2)`
   prints **after** the human lines. Deliberately a combined stream and not JSON-only; a consumer
   piping it gets both, exactly as today.

Both flags are read with `Boolean(...)`, so `--probe` bare and `--probe x` behave as the spike's
truthiness does. `--project` is passed through to `loadProject`, per Q-0091 E-6.

*Test:* driven against a **stubbed `getAdapter` and `probeAdapter`**, so no vendor CLI is required and
the verdict is a property of the commit rather than of the machine (2026-08-30) — see R-2. Nine
cases, all new: both present; one absent and the second still reported; probe ok; probe failed;
`cost_usd: null`, asserted **not** to render `$0.0000`; `tokens: 0`, asserted not to render
`, 0 tokens`; `--json` alone; `--probe --json` together, with the JSON parsed, its `probed` and
per-adapter keys asserted, and the human lines asserted to precede it; and the stub asserted to be in
force, so a case that accidentally reached the real registry fails loudly rather than passing on a
machine that happens to have the CLI. Every case asserts **exit 0**.

---

### AC-8 — BYOS, and the four defects reported rather than fixed

(a) **No file anywhere in `packages/cli` matches any pattern in `frame.source.test.ts:788`'s
`CREDENTIAL` list**, which already covers `commands.ts` and therefore `HELP`. **The test proving the
refusal is rendered may not spell a key**: it makes the stubbed `check()` reject with a sentence the
test does not have to know, and asserts the CLI reproduces whatever the adapter threw, verbatim.
Note that this scan is *not* what forces AC-1's help rewrite (M-6) — the two obligations are separate
and neither stands in for the other.

(b) **The refusal still says `Harness runs on subscription OAuth only`.** That string is `core`'s
(`adapters/claude.ts`, `codex.ts`) and Q-0068's. The CLI's only job is to render `e.message`
unaltered; pinned through (a)'s adapter-threw-it property rather than by quoting the sentence.

(c) **`adapters` exits 0 even when both CLIs are absent** (`spike/bin/harness.js:424` `return`s).
Preserved, with an authority line at the site: an adopter's CI step running `quorum adapters` reports
success on a machine with no vendor CLI at all.

(d) **Q-0066's crash is preserved.** `probeAdapter` dereferences a null `usage`, so an adapter whose
login is perfect and which reports no usage answers `✗ login not usable: Cannot read properties of
null`. Not caught in passing: Q-0066 lands in both trees together, and a fix here would leave the
spike disagreeing.

*Test:* a case asserting **exit 0** with both adapters' `check()` rejecting, whose test name and
comment say the zero is preserved and name the successor register — **Q-0090's GA-4**, exactly as
`main.ts:78` already cites it for the unknown-command zero (which answers OQ-1); and a case where the
stub's `probeAdapter` returns the Q-0066 shape, asserting the CLI renders it as a login failure — the
defect made visible rather than repaired.

---

### AC-9 — neither command writes, and the read-only register is made honest

Neither `board` nor `adapters` creates, modifies or deletes any file, and neither moves a ref.

**`board` joins `main.test.ts`'s `READ_ONLY`** — not `INVOCATIONS`, which is AC-6's list of shapes
that must print the help (M-2) — so the byte-identical tree-and-refs snapshot covers it, and the
companion assertion showing the commands *really ran inside the fixture* gains a `board` row. The
existing fixture already carries everything `board` needs: `harness/harness.yaml` with
`base_branch: main`, an empty `backlog/`, one flow consuming `draft`, and a repository with two refs.

**`adapters` does not join `READ_ONLY`**, and the reason is recorded rather than left as a silence:
adding it would force `vi.mock('@quorum/core')` into a file whose whole claim is a snapshot around
**unmocked** commands, weakening `lint` and `validate` to strengthen nothing — the guard would then
be proving that a stub writes no files — and an unmocked `adapters` would spawn a real vendor CLI,
which is R-2. It takes the same two-half snapshot in `adapters.test.ts` around a file-local stub.
This is a **new** shape and not an inherited one: `runs.test.ts` has no such snapshot (M-8).

In the same change, `READ_ONLY`'s JSDoc claim that *"the list grows with each read-only command as it
lands"* is corrected to the rule the tree actually follows, naming `runs` and `adapters` as the two
commands covered elsewhere and why.

*Test:* the existing *"every invocation shape leaves the working tree and the ref namespace as it
found them"* covers `board` once it is in `READ_ONLY`, and the existing *"shown to fail against a
handler that writes"* clause already proves that loop has a subject. `adapters.test.ts` takes the
same two-half snapshot — every path with its bytes, plus `for-each-ref` — around a probing
invocation, with the fixture's non-emptiness asserted first.

---

### AC-10 — `COMMAND_DOMAIN` gains two rows, `FRAME_ONLY_IO` gains one, and the barrel does not move

`frame.source.test.ts`'s `COMMAND_DOMAIN` (`:370`) gains exactly:

```ts
'board.ts':    ['loadProject', 'containment', 'lintFlowDirectory'],
'adapters.ts': ['loadProject', 'getAdapter', 'probeAdapter'],
```

The register fails in both directions already — a module naming a symbol its row omits, and a row
permitting a symbol its module does not name — so each row is a claim rather than a permission. Its
own JSDoc anticipates this ticket by name: *"Q-0094 added `run.ts`, and Q-0099 adds two more the same
way."*

`FRAME_ONLY_IO`'s identity list (`:545`) moves from
`['init.ts', 'lint.ts', 'run.ts', 'runs.ts', 'ticket.ts']` to that list **plus `board.ts` alone**:
`board.ts` joins `<harnessDir>/flows` with `node:path`, and `adapters.ts` imports nothing from Node at
all. Because the assertion is a `toStrictEqual` over identities, `adapters.ts`'s **absence** is as
much a claim as `board.ts`'s presence.

**`DOMAIN` does not grow, and therefore neither does `@quorum/core`'s barrel** (M-13) —
`package.test.ts:334` extracts the `DOMAIN` block by regex and asserts the barrel equals it plus the
five error classes, so an unnecessary export would fail there. This is the first command child to need
none, which is worth asserting rather than merely observing. Neither module opens a terminal
(`TERMINAL_OWNER` stays `['gate.ts']`) nor resolves its own location (`SELF_LOCATING` unchanged), and
both registers are asserted to keep their current size after two production modules were added.

*Test:* both new rows shown discriminating over **mutated copies** — an extra symbol and a missing one
each producing their own offender sentence — which is the demonstration Q-0092's row wrote for itself.
`FRAME_ONLY_IO`'s list shown `not.toStrictEqual` the five-name value it held. The barrel's key set
asserted unchanged against its pre-change value.

---

### AC-11 — `spike-parity.test.ts` records the translated binary half, and the four totals are re-derived unmoved

Per ground rule 5 and GO-2, using `Entry.binaryCarriedBy` — Q-0091's E-2 field — and **not** a fourth
verdict:

1. `q0036-board-containment.js` keeps `verdict: 'cli'` and `carriedBy: []` — the audit refuses a
   `cli` entry that names `carriedBy` — and gains
   `binaryCarriedBy: ['packages/cli/src/board.test.ts']`. Its `binaryHalf` note moves from
   *"— Q-0010"* to naming what has been carried, so the prose and the field cannot disagree about who
   owes what.
2. `q0033-surface.js` appends `packages/cli/src/board.test.ts` to its four counterparts, and its
   `binaryHalf` loses *"and S11's board compatibility — Q-0099"*, leaving `S3.2`/`S3.3` for Q-0095
   alone. The existing `.toMatch(/Q-0095/)` clause still holds; a `.not.toMatch(/— Q-0099\b/)` joins
   the Q-0093 and Q-0094 clauses beside it, in the shape those two established.
3. **`adapters` moves no register entry**, stated in the entry rather than left as a silence: no
   `spike/test/` file outside `smoke.js` exercises the command. The one occurrence of the string in
   `q0033-surface.js` is `:249`, a flow-lint scenario about a review panel spanning two adapters.
   `smoke.js:126–132` is Q-0095's.
4. The identity pins that enumerate every claiming row move to the eight-row value and are shown
   `not.toStrictEqual` the seven-row one they held — named rather than counted, which is the
   correction Q-0094 already made to that clause.
5. The four totals — **220 / 2739 / 2469 / 5428**, and **55%** — are **re-derived and shown unmoved**,
   because this ticket adds a field and touches no `spike/test/` file (ground rule 2).

*Test:* the register's existing `audit()` covers existence and collection of the new counterpart, so
`board.test.ts` must exist and be collected by the configured include. The identity clause is shown
red against the superseded list.

---

## 4. Non-goals

1. **`lint` and `validate`** — Q-0091's, shipped.
2. **`runs`** — Q-0092's · **`init` and `ticket`** — Q-0093's · **`run` and the gate reader** —
   Q-0094's. All shipped; none is touched beyond AC-2's two re-aimed fixtures and AC-9's JSDoc
   correction.
3. **The user-facing sentences naming a binary called `harness`** — **Q-0100's**, and there are now
   **five** (M-9). The board's hint and the adapters presence-only notice are two of them and are
   **preserved verbatim**; `ProjectNotFoundError`'s sentence reaches both new commands unchanged.
4. **The BYOS refusal's product name** — Q-0068's, distinct from Q-0100 and in `core` rather than here.
5. **Q-0066's probe crash** — preserved by AC-8(d), fixed in both trees by its own ticket.
6. **`adapters` exiting 0 with no CLI present** — preserved by AC-8(c); routed to Q-0090's GA-4 with
   the unknown-command zero, which is the same class.
7. **The `owner` defect** (`backlog.ts:190` defaults to `process.env.USER`) — nine recorded instances,
   preserved again; fixtures supply an owner rather than the code acquiring one.
8. **Any change to `spike/`** — ground rules 1 and 2. No `spike/src/` edit, no `spike/test/` edit, so
   no charter §3 freeze re-record is owed.
9. **Colour policy.** No TTY test, no `NO_COLOR`, no `FORCE_COLOR` — Q-0090 AC-3's preserved limits
   reach these two commands unchanged.
10. **A new `@quorum/core` symbol or a widened barrel.** Measured, nothing needs one (M-13).
11. **Any exit code other than 0.** Both commands `return`. `die` is reachable only through
    `ProjectNotFoundError`, exactly as in `lint` and `runs`.
12. **Another adapter, including Gemini**; a daemon, server, UI or persisted containment. Containment
    and adapter status are computed for the invocation and never stored.
13. **A new dependency**, and **a new packed-install fixture** — Q-0098's already guards that path.
14. **Redefining `--json` as a JSON-only stream.** The combined human-then-JSON output is spike parity
    and is preserved; changing it is a separately authorised contract change.
15. **A `verdict`/`blocked` channel for the implement step** — Q-0083's, and GO-4 says it does not
    exist yet.

---

## 5. Open questions

None blocks solutioning. No answer changes a file format or the adapter contract, and each carries a
recommendation that can be ruled at the gate.

**OQ-1 — which successor owns changing `adapters` to a non-zero status when all checks fail?**
*Answered by measurement rather than deferred.* The Codex candidate raised this as potentially
blocking, on the ground that AC-8's test comment cannot "name the successor" until an id exists. It
can: `main.ts:78` already carries *"The successor is Q-0090's GA-4"* for the identical preserved zero,
and Q-0090's merged requirement `:533` is *"GA-4 — open the successor for the exit table's two
zeros"*. A register reference is the established form here, and no new id is needed. *Ruled.*

**OQ-2 — does `adapters` belong in `main.test.ts`'s `READ_ONLY`?** *Recommended: no*, per AC-9, for
two reasons rather than one — the mocking would weaken `lint` and `validate`'s snapshot, and an
unmocked run would spawn a real vendor CLI. Recorded because the base candidate's justification cited
a `runs` precedent that does not exist (M-8), so the reasoning is new even though the answer is not.
*Owner: the gate.*

**OQ-3 — should the empty dim span be preserved?** A column with no consuming flow emits
`\x1b[2m\x1b[0m` (M-18), which every translated assertion strips through `plain()` and no human sees.
*Recommended: preserve*, with one authority line. It costs a ternary, a port preserves behaviour, and
M3's web UI may yet read the raw stream. *Owner: the gate.*

**OQ-4 — should the `requirements` hint be asserted over the six shipped flows, or over a fixture?**
*Recommended: both*, as AC-3(b) and (c). The fixture proves the **rule** — sorted-first wins — and is
stable; the shipped directory proves **today's answer** is `chore` and would go red if a seventh flow
sorted ahead of it, which is worth noticing. The read is already a declared turbo input (M-20).
*Owner: the gate.*

**OQ-5 — is six copies of the `loadProject`-and-`die` block still the right answer?** `lint.ts`,
`run.ts`, `runs.ts` and `ticket.ts` carry it today and AC-3's divergence 3 adds two more (M-7 — the
count is six, not the five the base candidate reached). The rule that forces it — a domain symbol may
be named by a command module and by nothing else — is Q-0091 E-6's and is **inherited, not
re-litigated**. Registered so the count is visible when someone does ask; `board`'s copy additionally
needs the whole `Project` rather than a directory, so a shared helper is not a copy-and-paste away.
*Owner: a successor, not this ticket.*

**OQ-6 — should `board.test.ts` spawn the built binary for any criterion?** *Recommended: no.*
`q0036-board-containment.js` spawns because the spike has no other entry point; `packages/cli` runs
through `main` in process, which is the dispatch-boundary claim Q-0091 AC-2 makes, and
`build.test.ts` already owns the one spawned-binary property (Q-0098 AC-15(c)). Ten scenarios each
spawning a Node process would cost seconds for a claim `invoke` already makes. *Owner: the gate.*

---

## 6. Risks

**R-1 — the two negative fixtures (M-1).** Measured, not predicted: `commands.test.ts:107` and
`frame.source.test.ts:455` both fail the moment `board` is registered. *Mitigation: AC-2, which also
requires the old fixture value be shown non-discriminating.*

**R-2 — an `adapters` test that reaches a real vendor CLI has a machine-dependent verdict.**
`adapter.check()` runs `claude --version` / `codex --version`. On a developer's machine with both
installed it passes; on CI's `ubuntu-latest` it does not, or the reverse — *"A test's verdict is a
property of the commit, not of the checkout or the account"* (2026-08-30). *Mitigation: AC-7's stub,
asserted to be in force so an accidental real call fails loudly.*

**R-3 — a `--probe` that reaches `probeAdapter` for real spends money and writes.** `probeAdapter` is
invoked with `cwd: repoDir`, and a real round-trip bills a subscription; Q-0001 measured a
hello-world probe inside the project at $0.39. *Mitigation: the same stub; and AC-9's `adapters`
snapshot would see any directory a probe created.*

**R-4 — a missing ref or a shallow clone reported as `not-contained`.** Turning missing evidence into
a negative claim is the failure the glossary's three-state vocabulary exists to prevent, and it is the
one a maintainer would act on wrongly — going to look for work that is already landed. *Mitigation:
AC-5's C4 and C5 assert the **reason token**, not merely the absence of `contained`.*

**R-5 — C5's shallow fixture is easy to build wrong.** `git clone --depth 1` is **silently ignored**
for a plain local path; only the `file://` scheme makes it real, and a fixture that silently was not
shallow would assert `indeterminate(shallow clone)` over a repository that could answer — passing for
the wrong reason. *Mitigation: translate the `file://` clone and the
`rev-parse --is-shallow-repository === 'true'` pre-assertion verbatim.*

**R-6 — C8's injection assertion must be made where a stray write would land.** The spike asserts no
`pwned` file in the fixture **and** in `process.cwd()`. Under Vitest the working directory is the
package root and a test using `--project` never chdirs, so the second assertion is about a different
directory than the spike's and must be kept, not dropped as redundant.

**R-7 — fixture commits without an explicit identity.** Every `git commit` in a board fixture needs
`-c user.email=… -c user.name=…` **spelled at the call site**, because `git-identity.test.ts` reads
literals and a helper supplying them invisibly looks like a violation to the guard written to find
one. `main.test.ts:246–248` is the shape to copy, comment included.

**R-8 — a wide catch around `lintFlowDirectory` would swallow a real lint crash.** *Mitigation: AC-3's
divergence 2 and its `flows`-is-a-file fixture, which is the subject that proves the catch narrow.*

**R-9 — `binaryCarriedBy` recorded on the wrong row.** `q0036-board-containment.js` is the **only**
`binary-only` file in the register and its 220 lines are exactly that bucket's total, so a mis-edit
there is arithmetically visible; `q0033-surface.js`'s row is not, and dropping one of its four
existing counterparts while appending the fifth would pass every clause except the identity pin.
*Mitigation: AC-11's identity pins name every counterpart rather than counting them.*

**R-10 — the ticket body's own provenance section misleads (M-10).** §11 of the body is Q-0091's,
describing `validateArtifact` and an AC-16 that belongs to Q-0094. An implementer reading the body for
scope could take criteria from it that are not this ticket's. *Mitigation: §12 below supersedes it,
and this risk is named so the contradiction is visible rather than discovered.*

---

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-8(a). The `CREDENTIAL` scan already covers `HELP`; the refusal-rendering test never spells a key, and the refusal itself stays `core`'s, verbatim. The `adapters` help line is rewritten with **subscription** under AC-1, whose authority is `product-boundaries.md` rather than the scan (M-6). **No API-key path is added in code, test, fixture or help text.** |
| **Worktree safety** | AC-9. Both commands are reads. Neither creates a worktree, moves a ref, or writes under `.harness/` or `.quorum/`. The `board` snapshot covers both halves — tree and `for-each-ref`. |
| **Gate behaviour** | n/a. Neither command runs a flow, reaches a gate, or advances a stage. |
| **File format and its schema** | n/a. `board` reads ticket frontmatter through `Backlog.list()` and `harness.yaml` through `loadProject`; neither is validated here, and `projectConfigSchema` stays *"declared and validated nowhere"* (Q-0043 AC-11). `--json`'s shape is the spike's report object, preserved key for key including the spread order. |
| **Cross-vendor rule** | n/a. Neither command authors, reviews, judges or executes a flow step. |
| **Product-agnostic** | Applies. `claude` and `codex` are adapters, not SaaS integrations; vendor-specific behaviour stays below the adapter interface. |
| **Lint rules** | No flow file changes. `harness lint` is unaffected. `board` *consumes* `lintFlowDirectory`'s records and adds no lint rule. |
| **Cold-clone impact** | **Both commands are on the 30-minute path** — `init` names `adapters` in its next-steps line, and `board` is what a stranger runs to see their first ticket. This ticket *shortens* the path by making the command `init` recommends exist. Registry-resolved `npx quorum` stays refused (Q-0029, M6); nothing here claims otherwise. |
| **Turbo inputs** | Unchanged. `../../harness/flows/*.yaml` is already declared for `@quorum/cli#test`; `package.test.ts`'s `DECLARED` list needs no entry. |
| **Port charter** | No `spike/src/` or `spike/test/` change, so no freeze re-record is owed. Q-0010's children are outside `port-charter.md`'s `children:` list; the rule is ground rule 1's, not the guard's. |
| **Error handling** | Per-adapter errors render verbatim and do not stop the loop; both commands preserve exit 0. |

---

## 8. What this ticket does *not* resolve, stated rather than implied

- `adapters` reporting **exit 0 with no vendor CLI installed** is preserved and now has an authority
  line; an adopter's CI step still reads success on a machine with nothing installed. Q-0090's GA-4.
- **Five** user-facing sentences now name a binary called `harness`, two of them arriving with this
  ticket: the board's hint and the adapters presence-only notice, beside `ProjectNotFoundError`'s
  sentence, `validate`'s usage line and `init`'s next-steps line. **One ticket: Q-0100**, whose body
  names three and should be corrected to five.
- Q-0066's probe crash renders a perfect login as an unusable one.
- Q-0068's `Harness runs on subscription OAuth only` reaches the terminal unaltered.
- `owner=` is still the OS account unless supplied.
- The `loadProject`-and-`die` block is a fifth and sixth copy (OQ-5).
- `READ_ONLY`'s JSDoc promise is corrected to what the tree does; making the register itself complete
  for `runs` is not this ticket's, and is named rather than silently left.
- The ticket body's §11 is the parent's provenance and binds nothing (M-10, R-10).

---

## 9. Sizing

**Eleven criteria**, against the ten-to-fifteen the 2026-08-22 sizing decision puts on a ticket and
against Q-0091's measured ceiling of fifteen. The base candidate had twelve; its AC-12 was **struck as
not independently testable** — its three clauses are AC-3's two fixtures plus an assertion the
existing `domainOffenders` scan already makes — and folded into AC-3 as ruled divergences carrying
authority lines. Compression, not trimming: nothing it required was dropped.

The distribution is honest about where the work is. **AC-5 alone is 220 lines of translated
scenarios** with ten git fixtures, and AC-7 is nine cases with no inherited coverage at all, while
AC-1, AC-2, AC-10 and AC-11 are register and guard work measured in tens of lines. Two criteria —
AC-2 and AC-9 — exist only because a measurement found something the ticket body could not have
known, which is the argument for the requirements run rather than for going straight to an implement
step.

**New test files: two** (`board.test.ts`, `adapters.test.ts`). **Modified: four** (`commands.ts`,
`commands.test.ts`, `main.ts`, `main.test.ts`), **plus two registers** (`frame.source.test.ts`,
`spike-parity.test.ts`). **New production modules: two.** **New barrel symbols: none** — the first
command child of which that is true.

---

## 10. Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. Q-0010's children are not in `harness/port-charter.md`'s
   `children:` list, so the branch-scope job reports them out of scope rather than failing them — the
   rule is this body's, not the guard's. If a change there is genuinely required, stop and say so; it
   takes §3's mirror-and-re-record path and is a decision, not a step.
2. **The spike's own tests are not deleted or edited to make room.** A child *adds* coverage under
   `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059's
   traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash and Q-0068's product name in
   the BYOS refusal are open tickets landing in both trees; do not close one here. **Q-0100** carries
   the user-facing sentences that name a binary called `harness`, including the board's own hint and
   the adapters presence notice — preserve them verbatim.
4. **`packages/core` already holds the logic.** `containment`, `lintDirectory`, `lintFlowDirectory`,
   `getAdapter` and `probeAdapter` are all exported from `packages/core/src/index.ts` — re-verified at
   this gate. If something appears to need porting, look there first and say so if it is genuinely
   absent; the CLI is a presentation layer over an API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   **re-derived rather than adjusted**. Use the `binaryCarriedBy` field Q-0091 added — see GO-2.

---

## 11. Gate obligations

**GO-1 — Q-0091 must be `reviewed` before this ticket's chore run.** Satisfied: Q-0091 is `reviewed`
and `main:contained` as of 2026-09-03, and its guard migration, barrel symbols and register schema are
all present in the tree measured above. Running the two concurrently would have been refused for a
second reason: Q-0039 is unfixed, so two runs on one ticket share a worktree and compute the same run
id.

**GO-2 — the register schema is Q-0091's ruling and is inherited, not re-litigated.** Ground rule 5
was **unsatisfiable as written** for `q0036-board-containment.js`: `admissible()` permits a
binary-spawning file that imports no spike source only the verdict `cli`, and `audit()` fails a `cli`
entry that names `carriedBy` — verified at this gate against the shipped mutation test, which produces
`q0036-board-containment.js: 'cli' names counterparts it may not have`. Use
`Entry.binaryCarriedBy`; do not add a fourth verdict.

**GO-3 — `harness/Q-0099/integration` must exist before the first chore run.** Measured at this gate:
`git branch --list 'harness/Q-0099*'` returns nothing. Per `docs/02-sdlc-pipeline-spec.md` §5.8,
`review` diffs against that branch and only `integrate`, which runs later, creates it, so a first-pass
run refuses in the preflight rather than billing (Q-0038). **This is an operational precondition, not
a design question, and does not block solutioning.** *Owner: the maintainer, before the chore run.*

**GO-4 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on has no
`blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31); the remedy is an
erratum written **during** the loop, as soon as the contradiction is provable — and, per Q-0094's
E-3, landed **at a gate**, because an erratum landed between a review returning and the next implement
starting has no reliable window.

**GO-5 — Q-0100's register is short by two.** Its body names three sentences and Q-0093 confirmed a
fourth; this ticket preserves a **fifth**, the adapters presence-only notice (M-9). Correcting that
ticket's body is the human's, and is cheaper now than after Q-0100's own requirements run measures it.

---

## 12. Provenance

*This section supersedes the `## 11. Provenance` in the ticket body, which is Q-0091's own merge
account carried across with Appendix A and describes work — `validateArtifact`'s single-read property,
a struck AC-16 routed to Q-0094 — that is not this ticket's (M-10).*

**The Claude candidate is the base**, and its §0 is why: it was written against the tree rather than
against the ticket body, and its two decisive findings are structurally confirmed here. **M-1** — that
`board` is the *negative fixture* in two shipped guards, both of which go red the moment the name is
registered — is the kind of finding that otherwise arrives as two unexplained red tests an implement
round diagnoses from scratch; it became AC-2. **M-2** — that the criterion naming the register to
extend names `INVOCATIONS` where the claim belongs to `READ_ONLY` — would have turned AC-6 red while
asserting something false. Taken largely intact: the `lintFlowDirectory` behaviour-identity analysis,
the `node:fs` prohibition forcing a narrow `ENOENT` catch, the C1–C10 scenario table, the eight
`adapters` cases, the barrel-does-not-move observation, and the fixture strategy.

**The Codex candidate contributed five things Claude did not have**, each folded in by name: the
**adapters presence-only notice also names a binary called `harness`**, which makes Q-0100's register
five sentences rather than four and is now M-9, non-goal 3 and GO-5; the **verbatim legend texts**,
which are pinned in AC-6 rather than paraphrased; the **preconditions block**, which became §11's gate
obligations; the framing of `--json` as a **deliberately combined human-and-JSON stream** that
consumers must not treat as JSON-only, now non-goal 14; and the more exhaustive **non-goals** list,
which §4 largely takes — the daemon, cloud sync, a new dependency, Gemini, persisted containment and
the packed-install non-regression are all its rows.

**Where they disagreed, and how it was ruled.** Codex's AC-8 puts `adapters` in the read-only
invocation set *"backed by a stubbed adapter registry"*; that is refused, because the stub would have
to live in `main.test.ts`, whose whole claim is a snapshot around **unmocked** commands — AC-9 gives
it the property in its own file instead. Codex's AC-1 (*"describes the commands in Quorum
vocabulary"*) is not independently testable on its own and is met through AC-1's four pinned clauses
plus the compile-time coupling in `Record<Command, CommandHandler>`. Codex's OQ-1 was raised as
potentially blocking and is **answered by measurement** rather than deferred: `main.ts:78` already
names Q-0090's GA-4 for the identical preserved zero, so the successor reference AC-8 requires has an
established form and needs no new id. Its OQ-3 — *does the schema require changing `q0033-surface.js`
too?* — is answered here rather than left to the implementer: **yes**, because that row's
`binaryHalf` names this ticket by id today, and AC-11(2) says exactly what moves.

**What this merge changed in the base, and why.** Five measured corrections, each of which would
otherwise have cost a review round. **M-6:** the `CREDENTIAL` scan does *not* match `no API keys` —
`/API_KEY/i` requires an underscore — so the base's justification for rewriting the help line rests on
a mechanism that never fires; the obligation is kept and its authority moved to
`product-boundaries.md`. **M-7:** the `loadProject`-and-`die` block has four copies, not two, so this
ticket makes six and the base's open question mis-states its own threshold. **M-8:** `runs.test.ts`
carries no tree-and-refs snapshot, so the *"shape Q-0092 chose for `runs`"* the base cites as
precedent for `adapters` does not exist — the recommendation survives on its own merits and is now
labelled a new shape. **M-10:** the ticket body's provenance section belongs to Q-0091. **M-15:** the
inherited-coverage figure is **right** — 220 lines exactly, no `+1`, no scope error — which makes this
the first child of the cut whose figure survives re-derivation, against a development plan that warns
at two separate places that it *"still carries one"* of the wrong ones. A warning that does not apply
is worth retiring explicitly, because the next reader re-derives against it.

**And one criterion was struck.** The base's AC-12 collected the three forced divergences into a
criterion of their own; its clauses are not independently testable — two are AC-3's fixtures and the
third is an assertion `domainOffenders` already makes — so it is folded into AC-3, which now carries
the divergence table and the authority-line requirement. Twelve criteria became eleven with nothing
lost, which is the difference between compressing a requirement and trimming one.
»
