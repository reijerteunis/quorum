# Q-0100 — implement report, run 2 iteration 1

*Written against `main` at `da29526`. Fourteen criteria, all satisfied. Three of the requirement's
own measurements were short and are corrected below with the evidence; nothing was struck.*

---

## 1. Verification, up front

| what | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks, 0 cached** |
| `@quorum/cli` suite | **560 passed** across 24 files (was 552 across 23) |
| `pnpm exec quorum lint` | **6/6** flows |
| `pnpm sweep:git-identity` | **green**, and *"environment discriminates (negative and positive probes both as expected)"* |
| AC-10 — each of the eight rows shown red before green | **done, per row, named below** |
| AC-9 — the six commands through a spawned binary | **8 tests, all green**, plus verified by hand through the real emit |

`pnpm install --frozen-lockfile` was run before the suite, per `harness/rules.md`. The one lint
warning (`backlog.ts:276`, unused `eslint-disable` for `no-control-regex`) is **pre-existing and not
in this diff** — that line is untouched.

---

## 2. What changed, file by file

**24 files changed, 211 insertions, 107 deletions, plus one new file of 221 lines.**

### 2.1 The eight sentences (AC-1, AC-2)

Each is the *after* text exactly: em dashes, middle dots, the `…` in `<file…>`, the two-space indent
on `init`'s line and the `padEnd(14)` column on the board's are all unchanged.

| # | file | change |
| --- | --- | --- |
| 1 | `packages/cli/src/adapters.ts:112` | ``run `quorum adapters --probe` before a real run`` |
| 2 | `packages/cli/src/board.ts:114` | `→ quorum run ${next.name} <id>` |
| 3 | `packages/cli/src/init.ts:50` | `  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001` |
| 4 | `packages/cli/src/run.ts:50–51` | `usage: quorum run <flow> <ticket> …` — one constant concatenated from two source lines, **both halves moved** |
| 5 | `packages/cli/src/run.ts:144` | `--base needs a revision: quorum run <flow> <ticket> --base <ref>` |
| 6 | `packages/cli/src/ticket.ts:68` | `usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]` |
| 7 | `packages/cli/src/validate.ts:60` | `usage: quorum validate <schema.json> <file…>` |
| 8 | `packages/core/src/backlog/project.ts:41` | ``no harness/harness.yaml found — run `quorum init` in your repo`` |

**Row 8 is the one that discriminates a ruling from a substitution**, and it is the only row where
the requirement had to reason rather than look up. `harness/harness.yaml` survives byte for byte;
only the backticked command moved. `packages/cli` gains nothing — all six catch sites go on printing
`error.message` unaltered, which is what keeps one sentence in one place.

AC-2 is landed unconditionally, per §5's ruling: the architecture question about whether an
imperative belongs in a library error at all is a successor's (GO-4), the fix here is one line and
the successor's deletion is one line, and leaving a known dead command standing on the cold-clone
path to protect an unbuilt HTTP surface is the move `docs/06` records this cut making twice.

### 2.2 The deferral comments (AC-3)

All fifteen — see §3.1, where three of them are the correction. Each is removed or rewritten to the
ruling, none is left citing a deleted document, and **no past-tense provenance JSDoc was touched**:
the 48 `spike/bin/harness.js` citations across 17 modules stand exactly as they were (Q-0103 AC-19).

One consequential shape: `runs.ts`'s header enumerated **five** preserved defects and its item 3 was
*"`ProjectNotFoundError` calls the binary `harness`"*, which this ticket closes. Removing it makes
the list four, so the count sentence and the numbering moved with it. Leaving `Five` over four items
would have been the "comment promising what the code no longer does" defect landed by the ticket
whose whole subject is a sentence disagreeing with reality. The pre-existing *"Two are pinned by
assertion … three are recorded where they are reached"* split was **already imprecise** — four of
the five are pinned, `runs.test.ts:569` covering the `warnings` one — so rather than transcribe a
new wrong count I removed the counts from that clause and left the claim. Flagged here because it is
prose I was not sent to change and a reviewer may want to rule it.

### 2.3 The new guard (AC-4, AC-5, AC-6) — `packages/cli/src/binary-name.test.ts`, new, 221 lines

Seven tests. Subject: **whitespace-bearing string literals** in the production modules of
`packages/cli/src` plus `packages/core/src/backlog/project.ts`, with `/harness\/\S*/g` stripped.

**It skips comments with a character scanner, not a regular expression, and that is the load-bearing
design decision.** R-3 says a comment-reading guard would fire 48 times and demand a forbidden edit;
what the requirement does not say is *why a regex cannot avoid that*. In JSDoc a markdown backtick
pair is lexically indistinguishable from a template literal, so the obvious regex
(`` /'…'|"…"|`…`/g ``) reads half this repository's prose as product output — including
`project.ts`'s own new header, where `` `harness/harness.yaml` is the **folder** `` would have been
collected as a printed string. The scanner tracks `//`, `/* */` and the three quote forms, so a
comment is not a literal. **This is not a simplification; it is what makes the guard's demands
legal.**

- **AC-6 — the file list is derived, never written down.** `readdirSync(SRC, { recursive: true })`,
  filtered to `.ts` and not `.test.ts`, exactly as `frame.source.test.ts:39–48` computes its own
  subject and for the reason its JSDoc records: `q0050.source.test.ts` scanned six hand-written
  names while a seventh engine file went unread and the suite reported green (Q-0051). A third test
  asserts the derivation covers every production module on disk, so it cannot silently narrow.
- **The one register is `CORE_SUBJECTS`**, one entry, and it is a register rather than a derivation
  because its membership is a *judgement* — which `core` sentences a user reads — where the walk's
  is a fact about the tree. Every entry is required to exist, so a moved file fails rather than being
  skipped. OQ-2 taken as recommended: not all of `core`.
- **AC-5 — the discrimination is demonstrated in four directions, not three.** The three the
  criterion names, plus one I added: a `//` line comment must stop at the newline, because a scanner
  that ran to end-of-file would swallow every literal below the first `//` in a module and report a
  clean tree. That is the guard's own version of the failure it exists to catch.
- **It is proved non-vacuous.** A scanner returning `[]` for every file would satisfy the main
  assertion over any tree at all — *"a check that skips its subject must not report success"*
  (2026-08-25) at its most embarrassing, inside the check written to enforce this rule. A separate
  test requires the scan to find `init.ts`'s next-steps line and `project.ts`'s sentence by value.
- **AC-12 honoured:** `commands.test.ts` is untouched and green, including its Q-0093 clause proving
  the pre-widening `harness\/\S+` spelling could not admit `harness/`. `FOLDER` is restated here
  rather than imported — no test file in this workspace imports another — and the second copy is
  demonstrated on its own subjects rather than taken on trust.

**No `turbo.json` change was needed and that was checked rather than assumed.**
`packages/cli/turbo.json` already declares `../../packages/*/src/**`, so the `core` read is hashed;
and `turbo-inputs.test.ts`'s `SUITES` is `packages/shared` and `packages/core` only, so a
`packages/cli` test is outside its clause B/C scan by that file's own stated design.

### 2.4 The tests that move (AC-7, AC-8)

Seventeen assertion sites across ten files. **Three preservation pins were inverted rather than
deleted**, on Q-0037 AC-4h's precedent — each now pins the new name *and* refuses the old, because
without the negative half a line naming neither binary would pass:

- `init.test.ts:180` → *"Q-0100 — and that line calls the binary `quorum`…"*
- `run.test.ts:109` → *"Q-0100 — the usage line says `quorum`…"*
- `ticket.test.ts:120` → *"Q-0100 — and that usage line calls the binary `quorum`…"*

`board.test.ts:225–226`'s padding is **still 9 and 2**. It is `stage.padEnd(14)` and independent of
the hint's text; I added a line saying so, because AC-7 predicted a round would "fix" it.

`backlog.source.test.ts`'s *"the sentence is the CLI's, byte for byte"* was a byte-identity against a
tree that no longer exists. Its title and body now pin the distinction that made this a ruling: the
command in one assertion, **the folder in a second assertion of its own**, so the half a blanket
`sed` would destroy can fail on its own.

**AC-8's four folder-only assertions are untouched and pass.** See §3.3 — one of the four is not
actually a regression check, which I verified rather than assumed.

### 2.5 Through the binary (AC-9) — `end-to-end.test.ts`

Three new invocations (`run-usage`, `ticket-usage`, `validate-usage`) added to the existing chain,
and a `Q-0100 AC-9` describe block of eight tests. `init`, `board` and `adapters` were already
invoked and needed only assertions.

- **Reused what the package has**, per AC-9: no seventh spawn helper. This is
  `end-to-end.test.ts`'s own `invoke`, which spawns a binary the suite built in an isolated copy —
  one of the two shapes Q-0098 AC-15(c) permits, and the shape `init.test.ts:15–17` names.
- **The refusals are recorded before the last porcelain reading**, not after, so they fall inside
  AC-6's *"nothing was written to the user's working tree"* claim as well. That is a stronger
  placement than appending them, and it is why it was chosen.
- **Two registers in that file refused the new invocations, which is them working.** The steering
  register at `:865` says in its own comment that a thirteenth invocation *"has to be classified here
  instead of arriving with an empty expectation of its own"* — it now names fifteen. The
  *"every run selects the mock"* identity at `:892` mapped `argv[1]` and got `undefined` from a bare
  `run`. I did **not** filter it out: it joins the identity list as `<no flow>`, so it is still
  accounted for, and the mock claim is applied only to invocations naming a flow — with **the
  exclusion itself pinned** (`toStrictEqual(['run'])`), because an exclusion nobody pins is one that
  widens. A bare `run` dies in argument validation before any project is opened, so it reaches no
  adapter and "selects the mock" is not a claim that can be made about it.
- Each row is a positive **and** a negative pin, for the same reason as the three inverted tests.
- The eighth sentence is proved by spawning the binary in an orphan temporary directory and asserting
  all three things at once: the command moved, `harness/harness.yaml` survived, and
  `quorum/quorum.yaml` is absent.

### 2.6 The documents (AC-11)

Measured independently and confirmed at **15 command-shaped occurrences across 11 lines in 3 files**,
exactly the requirement's table. `docs/01`, `docs/04`, `docs/05`, `docs/README.md`, `README.md` and
`CLAUDE.md` hold none — verified, not assumed.

**The three mixed-sense lines were edited word by word, not line by line**:
`02-sdlc-pipeline-spec.md:470` (`harness/{id}/` beside `harness lint`), `:474`
(`harness/{id}/{task.id}`) and `:595` (`harness/<id>/integration`). Paths untouched; commands moved.

`:607`'s `harness init --template sdlc` and `harness template diff` moved to `quorum` **and gained a
sentence saying they do not exist** — no `--template` flag, no `template` subcommand — routed to M5
rather than invented into being.

Status lines bumped on `02` and `03` with the date and what changed. **Both existing status-line
guards still hold**: `docs.test.ts:196` requires `Q-0041` in both (kept), and `:489`'s `EDITED` list
is `04`/`01`/`06`/`product-context.md`, which this change does not touch. `GLOSSARY.md` has no status
line and needs none. The §5 YAML blocks are byte-identical to `harness/flows/` and were not touched.

### 2.7 One repair outside AC-13's literal list, flagged for ruling

`packages/core/src/backlog/backlog.ts:155` read:

> `// Why: `harness init` prints `harness run requirements T-0001` as the next command`

**My change to `init.ts` made that sentence false** — it now prints `quorum run requirements T-0001`.
Two words changed; the comment's actual argument (that `T-0001` is the id the product advertises) is
untouched and still correct.

I judged this in scope rather than improvised it: AC-13's list is a boundary against surfaces the
role **may not write** — `contracts/`, `docs/decisions/`, `docs/06`, `CLAUDE.md`, `.claude/rules/` —
and `backlog.ts` is ordinary source inside the role's `paths:`. AC-3's normative half forbids leaving
a comment that disagrees with the code, and this one disagrees *because of this change*. Repairing a
quotation my own edit invalidated is making the change correct, not widening it. **Stated plainly so
a reviewer can rule it the other way**; if it should be reverted, the revert is two words.

I swept for others of this exact shape (a comment *quoting* one of the eight strings) and found only
this one and `q0080-allocation.json`, which §4 explicitly makes optional — see §4.2.

---

## 3. Three measurements in the requirement were short

Each was found by re-measuring rather than by working to the document, per Q-0099's
*"a measurement copied from a document is not a measurement"*. All three are corrections to the
requirement, not defects in it; none changed a criterion's intent.

### 3.1 AC-3's twelve deferral comments are **fifteen**

AC-3 derives its subject as eleven production citations of `Q-0100` plus `project.ts:29–30`, and
warns — correctly — that *"a scan keyed on the string `Q-0100` is insufficient"*. **It is
insufficient twice over.** Three more production comments defer or misdescribe the spelling and cite
neither `Q-0100` nor any document:

| site | what it said |
| --- | --- |
| `packages/cli/src/validate.ts:60–61` | *"preserved verbatim, including the binary name this one is not called — see the **OQ-2 successor**"* |
| `packages/cli/src/lint.ts:36–38` | *"the message is `core`'s, byte for byte, **including the `harness` the binary is not called**: Why: preserved defect, see `backlog/Q-0091-…/requirements/merged.md` OQ-2"* |
| `packages/cli/src/run.ts:224` | *"the message is `core`'s byte for byte, **`harness` included**"* |

The last two are the sharper find: after AC-2 they are not merely stale deferrals but **factually
false statements about what the code contains**. All three now read that `core`'s message is rendered
unaltered, which is the property those comments exist to record. The eleven + `project.ts` are done
as specified. Swept and confirmed clean: every surviving `Q-0100` mention in production is a
past-tense record of the ruling.

### 3.2 AC-7's sixteen assertion sites are **seventeen**

`packages/cli/src/ticket.test.ts:124` asserts `toContain('harness ticket new')` and is not in AC-7's
list. It is a substring of the usage line, **so it would have shipped red** had I worked to the list.
It sits inside the preservation pin at `:120`, which AC-3 does move — so the criterion reaches it by
one route and its own enumeration misses it by the other. It is now the negative half of that
inverted pin.

This is the same failure mode AC-7 documents for `init.test.ts:186` and `main.test.ts:341`: a search
keyed on the printed constant does not find it. The bare-word grep that found those two also finds
this one, which suggests the earlier sweep filtered by file rather than by site.

### 3.3 AC-8's four folder-only assertions are **three**

AC-8 says *"a change that corrupted the path turns all four red"*. Measured, by actually corrupting
it — `no quorum/quorum.yaml found` substituted into `project.ts`:

| assertion | fires? |
| --- | --- |
| `run.test.ts:518` | **red** — *"a directory with no project above it refuses with core's own sentence"* |
| `runs.test.ts:324` | **red** — *"a missing project is the one hard exit, and it prints core's own sentence"* |
| `ticket.test.ts:169` | **red** — *"AC-2(1) — no project is a sentence and exit 1"* |
| `fail.test.ts:110–111` | **green — it cannot fail** |

`fail.test.ts:109` is `observe(() => die('no harness/harness.yaml found'))` — the sentence is a
**literal the test constructs itself**, so it is a test of `die`'s rendering that happens to use that
string as a sample, and it can never respond to a change in `project.ts`. It is not a regression
check on the folder half and never was.

The criterion's *claim* holds — a corrupted path does turn assertions red, and I demonstrated it —
but its **evidence set is three, not four**, and the fourth would have been cited as coverage it does
not provide. `packages/core/src/backlog/backlog.source.test.ts`'s new second assertion is a real
fourth, added deliberately for this reason.

---

## 4. What I deliberately left alone

### 4.1 AC-13's boundary — nothing outside the named surfaces

`git diff --name-only` is `packages/cli/src`, `packages/core/src/backlog/{project,backlog}.ts`, their
tests, and the three documents. **Not touched:** `docs/decisions/**`, `contracts/**`,
`docs/06-development-plan.md`, `harness/**`, `CLAUDE.md`, `.claude/rules/**`,
`packages/cli/templates/**`, `backlog/**`. `harness/**` and `packages/cli/templates/**` were
re-measured as holding **zero** command-shaped occurrences, so an adopter's scaffolded `harness/`
needs no edit and `templates.test.ts`'s byte-parity guard is undisturbed.

### 4.2 Reported, not fixed

- **Four frozen contracts name a binary that does not exist.** `contracts/` is outside the implement
  role's `paths:` and frozen besides. **Correction to the requirement's count: 12 occurrences across
  11 lines, not 11 occurrences** — `Q-0006/review-lint.contract.md:3` carries `harness lint` *and*
  `harness run` on one line, so the per-file figures (1, 3, 3, 4) are line counts. Q-0091 erratum E-3
  already ruled that this contract prose states what must be *conveyed*, so no erratum is owed.
- **Q-0068's pin list names `smoke.js:464`, a deleted file.** Owed to that ticket, per §4.
- **The stale-citation sweep has no ticket id.** `adapters.test.ts:7`, `board.test.ts:7`,
  `end-to-end.test.ts:10` and `:737`, `failure-paths.test.ts:9`, `docs/04-architecture.md:97` cite
  the deleted `spike-parity.test.ts`. **One more for that sweep, not in §4's list:**
  `packages/shared/src/constants.ts:94` cites `spike/src/backlog.js` and spells the grammar
  `harness runs <token>` — same class, different register.
- **Test-facing names**, which §4 makes optional and names by id:
  `q0080-allocation.json:16` and `:83`, `backlog.test.ts:444`. Also `lint.test.ts:307` and
  `validate.ts:12`, both comments; the latter is past-tense provenance (*"verified by running the
  spike"*) and is Q-0103 AC-19 territory.
- **AC-14's preserved defects are all still preserved**, verified through the binary:
  Q-0068's *"… Harness runs on subscription OAuth only"*, `adapters` exiting 0 with both CLIs absent,
  an unknown command printing help and exiting 0, `probeAdapter`'s null `usage`, and
  `Backlog.create` defaulting `owner` to `process.env.USER`.
- **OQ-3 — is `p2` right?** Raised, not changed: `backlog/` is not agent-writable. The evidence is
  now stronger than when the requirement raised it — see §5, where the dead command was reproduced on
  the cold-clone path through the real binary.

### 4.3 GO-4 — the successor is the human's to allocate

`backlog/` is not agent-writable and its body is written out in full in the merged requirement §6.
Named here so the obligation does not expire with this run. **No decision entry is owed by this
ticket** (GO-1 discharged): the entry against `04-architecture.md` is that successor's precondition.

---

## 5. AC-10 — every row shown red before green

Each row reverted on its own, the named test recorded, then restored. `git diff --stat` was checked
against its pre-mutation state afterwards.

| row | reverted | tests that went red |
| --- | --- | --- |
| 1 | `adapters.ts` notice | `adapters.test.ts` *"both present — one line each…"*; guard |
| 2 | `board.ts` hint | `board.test.ts` ×3 (sorted hint, shipped flows, **padding**); `main.test.ts` *"the three read-only commands really ran inside it"*; guard |
| 3 | `init.ts` next steps | `init.test.ts` *"Q-0100 — and that line calls the binary `quorum`"*; guard ×2 (main + subject) |
| 4 | `run.ts` USAGE | `run.test.ts` *"no flow and no ticket each print the usage line verbatim"* and the Q-0100 pin; guard |
| 5 | `run.ts` `--base` refusal | `run.test.ts` *"B5 — a valueless --base is refused…"*; guard |
| 6 | `ticket.ts` USAGE | `ticket.test.ts` *"AC-2(a)/(b)"* and the Q-0100 pin; guard |
| 7 | `validate.ts` usage | `validate.test.ts` ×2 (both usage rows); guard |
| 8 | `project.ts` command | `lint.test.ts`; `project.test.ts`; `backlog.source.test.ts`; guard ×2 |
| — | **blanket `sed` on `project.ts`** | `backlog.source.test.ts`, `project.test.ts`, `lint.test.ts`, `runs.test.ts`, `run.test.ts`, `ticket.test.ts` |

**Eight rows, eight discriminating failures**, and the guard is separately demonstrated red by every
one of them with a message naming the file and the exact sentence, e.g.
`+ "validate.ts: usage: harness validate <schema.json> <file…>"`.

The last row is the one this ticket exists for: a blanket substitution that takes the folder with the
command turns the folder-half assertions red while every command criterion still passes.

**Verified through the real emitted binary as well**, because the reviewer on five of the last six
chore runs could not execute the suite under `--sandbox read-only`:

```
$ pnpm exec quorum board | head -1
draft         → quorum run requirements <id>          ← padEnd(14) intact: 9 spaces

$ pnpm exec quorum init /tmp/q0100-init-check
✓ harness/ and backlog/ created in /tmp/q0100-init-check      ← the folder, kept
  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001

$ pnpm exec quorum run       → ✗ usage: quorum run <flow> <ticket> […]
$ pnpm exec quorum ticket    → ✗ usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]
$ pnpm exec quorum validate  → ✗ usage: quorum validate <schema.json> <file…>
$ pnpm exec quorum adapters  → · presence only — logins NOT verified; run `quorum adapters --probe` …
```

That second block is **the exact defect Q-0093 confirmed on a real packed install** — a stranger who
had just installed `quorum` being told three times to run `harness` — reproduced fixed. It is also
the AC-9 assertions' subject, so the proof is committed rather than performed at a gate: Q-0101
measured that the previous exit-3 proof *"was performed by hand at a gate and never committed"*.

---

## 6. Ambiguity encountered, and how I resolved it

**One, and I resolved it rather than stopping, because stopping would have shipped the defect.**
AC-3 forbids leaving a comment that disagrees with the code; AC-13 confines the change to a file set
that excludes `backlog.ts`, which carries a comment *quoting* one of the eight strings. The two
cannot both be satisfied. I read AC-13 as a permission boundary — every surface it names is either
outside the role's `paths:` or append-only, and `backlog.ts` is neither — and treated repairing a
quotation my own edit falsified as part of making the change correct. §2.7 states it plainly so a
reviewer can rule the other way at a cost of two words.

Nothing else required a judgement the requirement does not authorise. The three short measurements
in §3 are corrections of *fact*, not of intent: in each case the criterion's normative half already
covered what its enumeration missed, so working to the wider reading is following the criterion
rather than improvising past it.
