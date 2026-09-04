# Q-0099 — implement report, chore run 2, iteration 1

*First implement round. There is no earlier review report in this ticket folder, so this is not a
revision round.*

**Status: all eleven criteria implemented. No erratum is owed** — nothing in the merged requirement
turned out to be false or unsatisfiable. One criterion could not be met in its most literal reading
and was met in substance; §3 states it plainly rather than leaving it to the diff.

---

## 1. What changed, file by file

### New — production (254 lines)

**`packages/cli/src/board.ts`** (138 lines). `quorum board`: `STAGES` in order, a column per stage
with tickets plus the three that always render, the header `c.bold(stage.padEnd(14))` and the dim
hint, the ticket row, the containment token, and the two legends. The three divergences AC-3 rules
each carry a one-line `Why:` at their site rather than a transcription of the requirement:

1. the flow set comes from `lintFlowDirectory(path.join(harnessDir, 'flows'))`, keeping the records
   whose `flow` is present — sorted where the spike's directory read is unspecified;
2. a missing `flows/` is a **narrow `ENOENT` catch**, `(error as NodeJS.ErrnoException).code !==
   'ENOENT'` rethrowing everything else, because no production module in this package may import
   `node:fs`;
3. `projectOf` is a fifth copy of `lint.ts`'s `loadProject`-and-`die` block, forced by AC-10's
   partition — and it needs the whole `Project`, where `lint.ts`'s helper answers one directory.

The `→ harness run <flow> <id>` hint is preserved verbatim, with an authority line naming Q-0100.
So is the empty dim span a column with no consuming flow emits.

**`packages/cli/src/adapters.ts`** (116 lines). `quorum adapters [--probe] [--json]`: `claude` then
`codex`, `✓ <name>: <version>` or `✗ <name>: <message>` with the loop continuing, the indented probe
line with its conditional cost and token clauses, the presence-only notice, and the JSON document
printed **after** the human lines. Both flags read with `Boolean(...)`. Two preserved defects carry
authority lines at their sites: the exit-0-with-both-absent (Q-0099 AC-8(c), successor Q-0090 GA-4)
and Q-0066's probe crash. It imports nothing from Node at all.

### New — tests (897 lines)

**`packages/cli/src/board.test.ts`** (509 lines, 21 tests). All ten of
`q0036-board-containment.js`'s scenarios, each keeping its own discriminating assertion — C1's
byte-identical ticket and unmoved refs, C2's `base..branch` count with `(+3)` refused, C3's three
shapes, C4's `trunk:indeterminate(missing ref)` and its single legend line, C5's genuinely shallow
`file://` clone with the `--is-shallow-repository` pre-assertion, C6, C7's `master` with `\bmain\b`
absent, C8's injection value checked in the fixture *and* in `process.cwd()`, C9's tag, and C10's
ten-stage sweep — plus AC-3's column set, both hint fixtures, the no-`flows` and `flows`-is-a-file
pair, the `padEnd(14)` ends, AC-4's S11 row and C3's full-row form, and AC-6's four legend claims.

Fixtures are built through `quorum init` and `quorum ticket new` in process, so the frontmatter is
what the product writes; `--owner qa` is supplied explicitly because the default is the account.
Every commit spells `-c user.email=… -c user.name=…` at the call site.

**`packages/cli/src/adapters.test.ts`** (385 lines, 16 tests). All new — there is no inherited
coverage. `vi.mock('@quorum/core', importOriginal)` replaces exactly `getAdapter` and `probeAdapter`
and leaves `loadProject` and `ProjectNotFoundError` real. The default stub **throws a named error**,
so a case that installed none fails loudly instead of reaching the real registry; the stub is
asserted to be in force in its own test. Nine AC-7 cases, AC-8's four, and AC-9's two-half snapshot.

### Modified

| file | what |
| --- | --- |
| `packages/cli/src/commands.ts` | `COMMANDS` → nine names in the spike header's order; two `HELP` lines at column 42 |
| `packages/cli/src/main.ts` | `HANDLERS` gains `board` and `adapters`; header says eight commands |
| `packages/cli/src/index.ts` | barrel re-exports both modules (the derived rule in `frame.source.test.ts`) |
| `packages/cli/src/commands.test.ts` | AC-1 block; **AC-2(a)** re-aim + the superseded value shown vacuous; registry pin → nine; alignment register 7 → 9 with the seven refused |
| `packages/cli/src/frame.source.test.ts` | `COMMAND_DOMAIN` two rows; `FRAME_ONLY_IO` + `board.ts`; partition list; **AC-2(b)** re-aim + superseded value shown vacuous; four new AC-10 clauses |
| `packages/cli/src/main.test.ts` | `READ_ONLY` gains `['board']`; the "really ran inside it" clause gains a `board` row; `READ_ONLY`'s JSDoc corrected |
| `packages/cli/src/package.test.ts` | AC-10's barrel-did-not-move clause; `OUTSIDE`'s `harness/flows` reason names `board.test.ts` |
| `packages/core/src/spike-parity.test.ts` | AC-11: `binaryCarriedBy` on two rows, prose moved with the field, clause (i) grown, clauses (p) and (q) added, clause (n) moved |
| `docs/04-architecture.md` | the command count six → eight, a paragraph on the pair, status line |

---

## 2. The two guards that were going to go red, and how they were repaired

M-1 was correct and is the single most useful thing the requirements run produced. Both were
demonstrations that a guard discriminates, so neither was weakened:

- `commands.test.ts:107` appended a synthetic `board` line to `HELP` and asserted the unregistered
  set was `['board']`. Re-aimed at **`not-a-command`**, a name that is not one of the spike's eight
  and never will be. A new test then runs the **old** fixture against the post-change registry and
  shows the filter yielding `[]` — the demonstration going vacuous, shown rather than described, so
  a later reader cannot restore the shorter name thinking it was arbitrary.
- `frame.source.test.ts:455`'s `[['board.ts', 'containment();']]` re-aimed the same way, with the
  same paired clause: the old fixture no longer produces the offender sentence, and what it produces
  instead — over its own row alone — is pinned.

---

## 3. The one criterion that could not be met literally, and what was done

**AC-1 asks the `board` help line to say what the command shows. My first draft wrote *"kanban of
tickets by stage, with each ticket's containment"* and it turned `frame.source.test.ts`'s AC-10 scan
red.**

`commands.ts` is a **frame** module, and `domainOffenders` reads a module's raw text — comments
included — for every `DOMAIN` symbol. `containment` is one. So a frame module may not carry the
glossary's word for the thing at all:

```
commands.ts: containment belongs to @quorum/core and to a command
```

The line now reads `kanban of tickets by stage, and where each ticket's code is`, which is the
glossary's own gloss, and `board.ts` — a command module, permitted the symbol — carries the
vocabulary. AC-1's own text only requires *"that it is a kanban of tickets by stage"*, so nothing the
criterion asks for was dropped; what moved is a phrase I chose. The test asserts both halves and the
comment at the site records that this was **measured rather than anticipated**, because the next
person to reach for the word will meet the same guard.

This is not an erratum: no criterion is contradicted, and the requirement's own AC-10 is what
forbids it.

---

## 4. Where I was narrower than the requirement's wording, deliberately

**AC-9 says `READ_ONLY`'s JSDoc should name *"`runs` and `adapters` as the two commands covered
elsewhere"*.** Measured, `runs` is **not** covered elsewhere — M-8 established that `runs.test.ts`
carries no tree-and-refs snapshot at all, and §8 of the requirement says so in as many words
(*"making the register itself complete for `runs` is not this ticket's, and is named rather than
silently left"*). Writing "covered elsewhere" of both would have replaced one false sentence with
another. The JSDoc now distinguishes them:

- `adapters` is outside the list **by decision**, with OQ-2's two reasons, and takes the same
  two-half snapshot in `adapters.test.ts`;
- `runs` is outside it **by omission and still is** — nothing snapshots it, here or there — recorded
  as owed to a successor.

§8 already carries the correct reading, so this is AC-9 satisfied rather than departed from.

---

## 5. A landed clause I moved, with the reason

`spike-parity.test.ts` clause **(n)** (Q-0094's) pinned the *whole* claiming set to the seven rows
that existed after that ticket. Clause **(i)** (Q-0091's) already holds that identity and its own
comment designates it as the one that grows — *"binds Q-0092 to Q-0095 and Q-0099, each of which adds
its own"*. Two absolute copies mean the next child edits two places and neither says which ticket it
is about.

So (i) grew to eight, and (n) was narrowed to what it is **for**: the two rows Q-0094 gave a
counterpart for the first time, named rather than counted, beside its untouched `not.toStrictEqual`
against the pre-Q-0094 five and its `byRun` identity. The superseded seven-row value is shown red in
**(p)**, this ticket's own clause, in the shape every child has written for its own. The comment at
the site says all of this. Precedent: Q-0094 moved a Q-0093 clause for the same class of reason and
recorded it the same way.

Nothing was weakened overall — deleting `binaryCarriedBy` from the board row fails **(i)** and
**(p)**, demonstrated below.

---

## 6. Verification — what was measured rather than observed

### Seven mutations, each shown red on the right test and reverted

| # | mutation | what went red |
| --- | --- | --- |
| 1 | `ENOENT` catch → blanket catch | *"a `flows` that is a file still stops the command"* |
| 2 | legend armed from `found` instead of `spot` | C3, C10 and *"a suppressed `no branch` does not arm the legend"* |
| 3 | `spot.ahead + 1` | C2 (*"a symmetric-difference count would read +3"*) |
| 4 | `cost_usd ?? 0` and `tokens !== undefined` | the null-cost and zero-token cases |
| 5 | `continue` → `break` in the adapter loop | four cases, including AC-8(c) |
| 6 | `binaryCarriedBy` removed from the board row | parity clauses (i) and (p) |
| 7 | the adapters help line one space short | the alignment register |

### Two throwaway parity comparisons — written, run, **deleted**

The sandbox declined to spawn `packages/cli/dist/quorum.js`, so the built-binary check Q-0091,
Q-0092 and Q-0094 each performed was done another way: a temporary Vitest file spawning the **spike**
binary and comparing its raw stdout — colour escapes included — with the ported command's, over the
same fixture.

- **`board`: byte-identical over ten fixture shapes** — contained, unannotated, diverged,
  `no branch` at `reviewed`, a rewritten `iterations` with summed `history`, a `master` base, a
  missing base ref, the injection value, no `flows/`, and an empty backlog. Confirmed to discriminate
  by removing one space from the row separator, which fails it.
- **`adapters`: byte-identical for presence and `--json`** against the **real** registry on this
  machine (both CLIs present, no `--probe`, so nothing was billed), with a floor assertion so the
  comparison cannot be between two empty strings.

Both files were deleted. Neither may land: `spike/` is not a declared turbo input of
`@quorum/cli#test`, and the second reaches the real adapter registry.

The build itself was run (`pnpm turbo run build --force`, 3/3) and the emit exists; only the spawn
was refused by the environment.

### Suites, forced

- `pnpm turbo run lint typecheck test --force` — **21/21 tasks, 0 cached**, 472 CLI tests across 21
  files.
- `npm test --prefix spike` — **all 19 test files passed**.
- `node spike/bin/harness.js lint` — 6/6 flows clean.
- `pnpm sweep:git-identity` — green: both suites executed with no resolvable git identity, which is
  what proves the new fixtures' commit identities are spelled at their call sites.

The four parity totals — **220 / 2739 / 2469 / 5428 and 55%** — are re-derived and unmoved, with a
new clause asserting that `q0036-board-containment.js` is still the whole of the `binary-only`
bucket, so a mis-edit on the row this ticket carried is arithmetically visible.

---

## 7. What I deliberately left alone

- **`spike/`** — no file under it changed, so no charter §3 freeze re-record is owed.
- **`backlog/`** — the harness owns it; nothing was written there.
- **`docs/decisions/`** — none is implied by this work.
- **Q-0100's five sentences.** Two of them are this ticket's: the board's `→ harness run <flow> <id>`
  hint and the adapters presence-only notice. Both preserved verbatim with authority lines. **GO-5
  stands: Q-0100's body names three and Q-0093 confirmed a fourth; the adapters notice is a fifth,
  and correcting that ticket's body is the human's.**
- **Q-0068's BYOS refusal** — `core`'s, rendered unaltered. The test proving that never spells a key:
  it makes `check()` reject with a sentence of its own invention and asserts the CLI reproduces it.
- **Q-0066's probe crash** — preserved, and now *visible* from outside the process: a case feeds the
  stub that exact shape and asserts the CLI renders a perfect login as unusable.
- **The exit-0-with-no-CLI defect** — preserved, with the test name, its comment and the module
  header naming **Q-0090's GA-4**, the register `main.ts:78` already cites for the identical zero.
- **The `owner` default** (`backlog.ts:190`) — untouched; fixtures supply `--owner qa`.
- **`--json` as a combined stream** — the JSON follows the human lines, asserted by index.
- **`runs`' missing snapshot** — named in `READ_ONLY`'s JSDoc, not built here.
- **OQ-5's six copies of the `loadProject`-and-`die` block** — this ticket makes it six, as measured.
  Registered in both new modules' comments; the rule is Q-0091 E-6's and inherited.

---

## 8. Two things a reviewer should look at

1. **`docs/04-architecture.md` was edited and no criterion names it.** Line 70 said *"Since Q-0094 it
   dispatches six commands"*, which this change makes false. The docs rule requires fixing it in the
   same change, and Q-0091, Q-0092, Q-0093 and Q-0094 each moved that same sentence. I did **not**
   touch `06-development-plan.md`: Q-0094's E-3(a) records that its bullets are rewritten by hand at
   each plan pass, so an edit there costs a review finding and buys nothing.
2. **A pre-existing lint warning, not mine.** `pnpm turbo run lint` reports
   `packages/core/src/backlog/backlog.ts:276 — unused eslint-disable directive (no-control-regex)`.
   That file is untouched by this change (`git status` confirms), the task exits 0, and fixing it is
   not traceable to any criterion here. Reported rather than repaired in passing.

---

## 9. Sizing, as built

**New production modules: 2** (254 lines). **New test files: 2** (897 lines). **Modified: 7 source
and test files plus one numbered document.** **New `@quorum/core` barrel symbols: none** — the first
command child of the cut for which that is true, and it is asserted in `package.test.ts` against the
21-name register and the 26-key barrel rather than observed.
