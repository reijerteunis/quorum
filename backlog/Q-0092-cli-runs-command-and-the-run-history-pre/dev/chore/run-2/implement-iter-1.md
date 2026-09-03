# Q-0092 implement — run 2, iteration 1

`quorum runs` ships: registered in the frame, one command module, over six names newly on
`@quorum/core`'s public surface and one reader that did not exist. Thirteen criteria, no split, no
blocker, nothing under `spike/` touched.

**Two files added, eleven changed, 415 insertions.** Nothing in `spike/`, `backlog/` or
`docs/decisions/`.

---

## 1. The one thing to read before the diff

**Four tests in `packages/cli/src/build.test.ts` fail in this worktree, and the cause is that the
worktree is uncommitted.** They are not a defect in this change and they are not a defect in that
file.

`build.test.ts`'s `isolate()` builds its corpus from `git ls-files -- <package directory>`, and its
own comment at `:362` says why — *"the copy's source and therefore the commit's"*. `src/runs.ts` is
untracked until the harness commits, so the isolated copy holds a `main.ts` that imports `./runs.js`
and no `runs.ts` to resolve it.

Diagnosed by reproduction rather than by reading, in **both** directions — I rebuilt that helper's
copy by hand and ran the real `turbo run build --force` in it twice:

```
--- tracked set only (what isolate() builds today) ---
@quorum/cli:build: src/main.ts(28,22): error TS2307: Cannot find module './runs.js'
                   or its corresponding type declarations.
 ERROR  run failed: command  exited (2)
--- tracked set plus this ticket's two new files ---
BUILD OK
```

Exit code 2 is what the four failures report, and `TS2307` is the whole of it. The real workspace
build — the same `tsc` over the same sources with the file present — succeeds:
`pnpm turbo run build --force` → **3 successful, 0 cached**.

So: at review and at `integrate` the files are tracked and those four pass. **I have not observed
them passing through Vitest**, because I cannot without staging or committing, and ground rule 5 of
the role says I commit nothing. That is stated rather than implied, and it is the one green tick in
this report I am relaying by proxy rather than by execution.

The same four failures are why `pnpm sweep:git-identity` exits 1. Its own phases are clean —
`git-identity sweep: environment discriminates (negative and positive probes both as expected)`,
spike suite green — and it fails in the `workspace suite` phase on exactly those four. No test in
this change takes a verdict from git's identity resolution.

---

## 2. File by file

### `packages/core/src/run-history/reader.ts` — +76

**`readRun(runsRoot, token)` and the `RunRead` result it answers with.** AC-3, and the case ground
rule 4 contemplates in its own words: the reading is all in `core` except this. `readRunsDir` parses
every sibling manifest and both the frozen contract and Q-0034 AC-13 forbid using it for a detail
request; `resolveRunDirectory` returns a *path* and nothing opens it. So `core` gained one function,
not a subsystem.

Three outcomes, discriminated on `outcome`:

- `run` — the resolved directory, the manifest path and the parsed document, a cast and never a
  check, exactly as `RunEntry.manifest` is;
- `malformed` — **the parser's own words**, so the CLI quotes rather than paraphrases. It covers an
  absent `manifest.json` as well as an unparseable one, which is preserved behaviour:
  `spike/bin/harness.js:490–497` reaches the same `catch` for both;
- `not-a-run` — carrying nothing at all, which is `resolveRunDirectory`'s `null` contract. It
  discloses nothing about the token's target, including whether anything is there.

OQ-1 was ruled and I implemented the ruling rather than the alternative; the JSDoc records why, in
one paragraph and with a pointer, not a transcription.

The module's landed properties are unchanged and were re-checked: it imports no writer, it names no
vendor, it holds no money formatter, it performs no filesystem write, and it does not name
`RUN_HISTORY_ROOT` — the runs root is still a parameter, so `writer.ts` remains the only file in
`core` naming it as a value.

### `packages/core/src/index.ts` — +16

**Six values and seven types.** `readRunsDir`, `sortRuns`, `isIncomplete`, `occurrenceSeq`,
`vendorTokenTotal`, `readRun`; `RunEntry`, `RunWarning`, `RunRead`, `RunManifest`, `VendorRollup`,
`Occurrence`, `OccurrenceUsage`, each by name and never wholesale, so no type adds a runtime key.
The barrel doc says which command needs what, and why two names stayed off it.

**One deviation from AC-4's parenthetical, flagged rather than slipped in.** AC-4's normative clause
is *"plus the types the signatures name"* and its parenthetical enumerates six. I export a seventh,
`RunRead`, because it is the type AC-3's signature answers with and without it a caller cannot hold
the discriminated result in a variable it has declared — M3's server will want to. It adds no
runtime key, so `package.test.ts`'s identity and length pins are untouched by it, and the assertion
`'a type export adds no runtime key'` covers it. If the reviewer reads the parenthetical as
exhaustive, deleting the line costs nothing but the name; I did not want to make that call silently.

`manifestShapeError` is **not** exported (M-7: no command calls it), nor is `TICKET_ID_PATTERN` —
OQ-2 ruled the CLI's grammar is `@quorum/shared`'s `parseTicketId`, which is what
`spike/bin/harness.js:505` already calls — nor `resolveRunDirectory`, whose only correct use is to
be opened immediately. All three are pinned as withheld, in two files.

### `packages/cli/src/runs.ts` — new, 287 lines

The command and the ten functions the ticket body names, in one module, because M-3 forces it: a
helper module would be a *frame* module forbidden to name `vendorTokenTotal`. It imports `node:path`
and no `node:fs`.

`repoDirOf` duplicates six lines of `lint.ts` and the JSDoc says the duplication is **forced** rather
than accepted — a shared helper holding `loadProject` would be a frame module naming a domain
symbol, which the AC-10 partition refuses.

The module comment carries OQ-4's ruling (the contract's opening *location* claim, which the port
necessarily falsifies, as it did for `lint` and `validate`) and the **five-item preserved-defect
register** AC-12 asks for, each with a one-line authority and none repaired.

### `packages/cli/src/runs.test.ts` — new, 36 tests

The translated binary half of four spike files, organised by criterion rather than by source file —
which is the shape of a command child, and Q-0091's E-4 arriving on the next one.

**B2 is two blocks, not one, and that is the point.** Q-0037 re-aimed the `tokens=1100` double-count
guard at the **list**, where `vendorTokenTotal` runs; it had been on the detail view, which renders
no roll-up at all, so it was matching the per-step usage line. R-3 warned that following the ticket
body literally would restore exactly that. The list block asserts `claude: … tokens=1100`, no `1350`
anywhere, and `codex: … tokens=n/a`; the detail block asserts the four measures at their own values,
no `1350`, and **`unpriced_steps` absent from the whole detail output** — plus that the detail view
renders no `tokens=1100` at all, which is the structural form of the same claim.

One naming note the reviewer will otherwise ask about: `q0034-review-fixes.js` B4 plants a directory
called `secret`; here it is `elsewhere`, because that word is one `frame.source.test.ts`'s
package-wide BYOS scan looks for and a test naming it would be an offender rather than a subject. I
met that failure and it is recorded in the fixture's JSDoc. The token *shapes* B4 drives — relative
escape, nested path, absolute path, `..`, `.` — are unchanged, and a companion test proves the
planted document is readable and says `LEAKED`, so *"discloses nothing"* is not a claim about
nothing.

### The five moved pins, each shown red against what it replaced

R-1 named moving a pin by adjustment as the failure mode. Every one carries a companion assertion
refusing its superseded value, which is the pattern Q-0091 and Q-0096 established:

| pin | from | to |
| --- | --- | --- |
| `frame.source.test.ts` `DOMAIN` | 14 | 20 |
| `frame.source.test.ts` command partition | `['lint.ts','validate.ts']` | `+ 'runs.ts'` |
| `frame.source.test.ts` `FRAME_ONLY_IO` | `['lint.ts']` | `['lint.ts','runs.ts']` |
| `package.test.ts` `domain()` length | 14 | 20 |
| `run-history.source.test.ts` reader identity | 8 values | 9 values, both spellings |
| `spike-parity.test.ts` `binaryCarriedBy` claimants | 2 rows | 4 rows |
| `commands.test.ts` registry / help | 3 names | 4 names |

`COMMAND_DOMAIN` gains a `runs.ts` row, and I added a mutation test aimed at **that row** in both
directions rather than relying on the two existing rows' fixtures — an entry permitting a symbol the
module does not name fails, and a symbol the module names that the entry omits fails. Beside it, a
small assertion that `\breadRun\b` is not satisfied by `readRunsDir`: the two names differ by a
suffix and the word boundary is the only thing keeping the register honest about which one is
present.

`package.test.ts:352`'s barrel identity and `:1434–1435`'s counterpart arithmetic (31 distinct, 53
total) are **untouched**, as AC-13 requires — this ticket adds no library counterpart.

### `packages/core/src/spike-parity.test.ts` — AC-13, four rows

- **`q0011-runs-cli.js`** — gains `packages/cli/src/runs.test.ts`; the prose no longer says the
  listing and detail are owed, and now says nothing of the file's binary half is.
- **`q0011-run-history.js`** — re-attributed from the generic *"— Q-0010"*, gains the field, and its
  prose scopes what transferred (its one invocation) against what did not (the process-separation
  half, which is Q-0095's).
- **`q0034-review-fixes.js`** — its `binaryHalf` named only B3, which was **incomplete rather than
  unattributed**: B2 and B4 both drive `runs`. Now names both as carried here and keeps B3 as
  Q-0094's.
- **`q0080-allocation.js`** — prose only, per OQ-3, with the reason written in a comment so a
  reviewer does not have to ask why one of the four census rows has no field.

Two new tests: `(j)` shows the claimant identity moved and pins the two shapes E-2's field has to
admit — one spike file carried by two suites, one suite carrying three spike files — and `(k)`
re-derives the five line totals and the transfer share and asserts them **unmoved**, from the same
computation rather than from a sentence. No file under `spike/` changed, so `220 / 2739 / 2469 /
5428` and 55% hold; *"it did not move"* is stated as a measurement rather than skipped.

### `commands.ts`, `main.ts`, `commands.test.ts`

`runs` is registered last, because `spike/bin/harness.js:10` is the last line of that header.
Description rewritten in the product's own name and aligned to the shared column — with a test that
computes the column for all four lines and requires one distinct value, shown discriminating against
a line one space short.

### `docs/04-architecture.md`

*"Since Q-0091 it dispatches two commands"* → three, plus one paragraph on where the run-history
division falls and why the public surface grew by six names rather than one. Status line bumped with
the date and what changed, per the docs rule.

---

## 3. Verification

Installed first (`pnpm install --frozen-lockfile`, `npm install --prefix spike`), then:

| check | result |
| --- | --- |
| `pnpm turbo run test --force` | shared 150, core 1300 (+1 skipped), cli 266 — **4 failed**, all §1 |
| `npm test --prefix spike` | **19/19 files** |
| `pnpm turbo run lint typecheck --force` | 14/14 tasks, 0 cached, 0 errors |
| `pnpm turbo run build --force` | 3/3, 0 cached |
| `node spike/bin/harness.js lint` | 6/6 |
| `pnpm sweep:git-identity` | probes discriminate, spike green, fails only on §1's four |

### The binary, executed rather than reported

R-7 says a reviewer may be unable to run the suite, so exit codes and `--json` shapes were verified
**through the built binary** (`node packages/cli/dist/quorum.js`). All six rows of §10's table:

```
ok   help exit=0     quorum runs [ticket|run-id] [--json]    run history: list, filter by ticket, …
ok   exit=0 (want 0)  runs over a clean store
ok   exit=0 (want 0)  runs over an empty store            · no runs found
ok   exit=1 (want 1)  runs over a store with a damaged sibling
       warning line: ! bad: malformed manifest.json (Expected property name or '}' … position 1)
ok   exit=0 (want 0)  runs <ticket> with zero matches, clean store
ok   exit=0 (want 0)  runs <run-id> beside a damaged sibling      names the sibling? no
ok   exit=1 (want 1)  runs ../elsewhere --json                    discloses? no
ok   runs --json parses: yes, escapes: none
ok   runs <id> --json parses: yes, escapes: none
```

### Byte-for-byte against the spike

Charter §2 preserves behaviour, and for this command the behaviour *is* the printed bytes and the
status. So I ran the same 24 invocations against `spike/bin/harness.js` and against
`packages/cli/dist/quorum.js` over identical fixtures — the listing, both filters, three refused
grammars, detail, an incomplete run with a failed occurrence and an unparseable occurrence prefix, a
manifest that will not parse, a manifest that parses and has no shape, all five confinement tokens,
and every `--json` mode including both errors:

```
24/24 invocations byte-identical to the spike (stdout, stderr and exit status).
control — help differs as it must: yes
```

The control is there because a comparator that answers *"identical"* for everything proves nothing:
`help` must differ, since Q-0090 rewrote that text deliberately, and it does.

### The two properties that are invisible unless run (R-6)

Both checked by **mutation**, not by reading:

1. **AC-2 / AC-11's IO boundary.** Adding `import fs from 'node:fs'` to `runs.ts` turns the
   package-wide prohibition red, naming the module: `expected [ 'runs.ts' ] to strictly equal []`.
   Reverted.
2. **AC-11's read count.** Hoisting a single `listRuns()` call above the token branch — the exact
   mistake the spike's closure and its comment exist to prevent — turns the count guard red with the
   sibling's path in the message: `the damaged sibling was read: expected [ Array(1) ] to strictly
   equal []`. Reverted, and the revert verified (`grep -c "node:fs" runs.ts` → 0).

The counted form of AC-11 lives in `packages/cli`, not in `core`, and that placement was **forced by
a guard rather than chosen**: my first draft counted reads in `reader.test.ts` by aliasing
`fs.readFileSync`, and `turbo-inputs.test.ts`'s clause C4 refused it —
*"takes fs.readFileSync as a value rather than calling it"* — which is Q-0070 meeting the same
refusal, working as designed. `packages/cli` is deliberately outside that audit
(`turbo-inputs.test.ts:129–148`), so the count belongs there; what `core` asserts instead is the
observable half, that two damaged siblings leave the good run's answer identical to the answer it
gives alone, with `readRunsDir` shown reporting both so the fixture is not empty. The same guard
also decided a fixture name: the escaping directory in `reader.test.ts` is `secret` because
`../secret` is the token that file already drives and whose registration `turbo-inputs.test.ts`
holds — **no new registration was earned on the way in**, in either package.

---

## 4. What I deliberately did not do

- **No change to `spike/`.** Not `spike/src` (ground rule 1), not `spike/test` (ground rule 2). No
  freeze re-record is owed, and the parity register's line totals are re-derived unmoved as evidence
  of that rather than assumed.
- **No preserved defect fixed.** All five of AC-12's are registered with authority; the symlink
  disagreement and `vendorTokenTotal`'s `n/a` are pinned by assertion so a later fix is a deliberate
  act, and the other three are comments. Q-0059, Q-0060, Q-0066 and Q-0068 are untouched, and the
  `harness` in `ProjectNotFoundError`'s sentence is left exactly as it is for Q-0100.
- **No new command, no colour policy, no cap, no sorting flag, no cross-vendor total, no write of
  any kind.** Non-goals 1 and 5–11.
- **No decision entry.** Non-goal 12 holds: every ruling this rests on is already written.
- **`readRunsDir`'s eager sibling parse is not optimised** (non-goal 9). AC-11 is about not calling
  it, and `readRun` is how.

## 5. Reported and not fixed

- **A pre-existing lint warning**, in a file this ticket does not touch:
  `packages/core/src/backlog/backlog.ts:276 — Unused eslint-disable directive (no problems were
  reported from 'no-control-regex')`. `lint` exits 0, it is outside this change, and migrating it in
  passing is the scope creep the role forbids.
- **The four `build.test.ts` failures of §1**, which are the worktree's state and not the commit's.
