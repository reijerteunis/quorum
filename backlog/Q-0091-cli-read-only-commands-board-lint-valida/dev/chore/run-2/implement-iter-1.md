# Q-0091 implement — `quorum lint` and `quorum validate`

Run 2, iteration 1. Scope is `requirements/merged.md` §5 **AC-1 to AC-13**, per erratum **E-1**;
Appendix A is Q-0099's and nothing here touches it. Errata E-2, E-3 and E-4 are treated as binding.

---

## 1. What changed, file by file

### New — `packages/cli/src/lint.ts` (62 lines)

`quorum lint`. Calls `lintDirectory(<harnessDir>/flows)` and renders its records: `✓ <filename>` in
green, or `✗ <filename>` in red followed by one `  - <problem>` line per problem. Nothing else is
added — `flattenProblems` in `core` has already split the multi-line messages and stripped the
leading hyphens, so no copy of that regex exists here (AC-5).

`flowsDir()` is the one place `loadProject` is reached, and it catches `ProjectNotFoundError`
**narrowly** — anything else re-throws to `main().catch(dieOnUnexpected)`, which is what the spike
does (AC-4). The aggregate verdict goes through `failSoftly()` rather than `process.exit(ok ? 0 : 1)`
(AC-6), with `fail.ts`'s own recorded reason cited in the module doc.

### New — `packages/cli/src/validate.ts` (89 lines)

`quorum validate <schema.json> <file…>`. Usage failure and unreadable schema die hard; per-file
outcomes go through one `validateArtifact` call each, and the loop continues past a throw. The skip
notice is a module constant, `SKIPPED_NOTICE`, and is **the sentence Q-0037 shipped** — E-3's
ruling, with the authority line pointing at `spike/bin/harness.js:442–445` rather than transcribing
the argument.

`inapplicable()` reads `semantic.ran` **and** `semantic.reason`, so `structurally-invalid` stays
silent: there the contract was recognised and merely suppressed, and the sentence would be false of
it. That is the Codex candidate's contribution folded into AC-8.

### New — `packages/cli/test/invoke.ts` (110 lines)

A shared `invoke(argv)` that runs `main(argv)` with the console bound to two streams it owns and
`process.exit` replaced by a throw, reporting `{ stdout, stderr, exitCode, hard }`. `hard` is the
`die` path; `exitCode` on that path is the argument `die` handed `process.exit`, never
`process.exitCode`, which `die` deliberately does not set.

A `test/` directory rather than a fourth copy of `sink()` — the convention `packages/core/test/`
already uses. Not collected by any include (it is not `*.test.ts`), typechecked and linted like
everything else. `main.test.ts` and `fail.test.ts` keep their own helpers; I did not refactor files
I was not sent to change.

### New — `packages/cli/src/lint.test.ts` (22 tests) and `src/validate.test.ts` (23 tests)

The translated binary halves. `lint.test.ts` carries `q0033-surface.js`'s three lint sites — S1.3
over the shipped flow directory, S6.2–S6.10's return chains, S9's multi-file aggregation — with that
file's `flowDiagnostic` extraction (`:38–46`) translated with them, because the *shape* of the block
is the claim. `validate.test.ts` carries `q0011-runs-cli.js`'s eight validate invocations: the AC-14
structural mutations, the EDGE-13 annotation cases, and the six notice clauses.

Two things worth a reviewer's attention:

- **The notice is asserted by its clauses and never as one string.** AC-9 requires exactly one copy
  of that sentence under `packages/**`; a `toBe(theWholeSentence)` in the test would have been the
  second one. The clauses are the ones the frozen contract is about.
- **`validate.test.ts`'s S6-equivalent for the single-read property counts `fs.readFileSync` calls**,
  which is how `q0011-runs-cli.js:190` counts it too — "reads once" is invisible in the output. Each
  artifact is asserted at exactly 1; the schema at 3 over two artifacts (AC-7's early read plus one
  per call), which is the spike's own count.

`lint.test.ts` writes its own `reviewWith` fixture rather than reading
`contracts/Q-0006/review-flow.contract.yaml` as the spike does: that frozen file is `core`'s lint
suite's subject, and reading it would make this package's verdict depend on a document it does not
own.

### `packages/core/src/index.ts` — AC-3

Gains `readData`, `ProjectNotFoundError`, and two types by name (`ArtifactValidationResult`,
`FlowFileReport`). Sixteen value symbols → eighteen. The doc comment says which command needs each.

### `packages/cli/src/commands.ts`, `main.ts`, `index.ts` — AC-1, AC-2

`COMMANDS` is `['help', 'lint', 'validate']`, `HELP` gains two lines in the spike header's own
relative order (`:6` before `:8`), `HANDLERS` gains two entries — and `Record<Command, CommandHandler>`
is what makes a name without a handler, or a handler without a name, fail to compile. Handlers take
the whole `ParsedArgv`; neither module touches `process.argv` or `parseArgv`.

The help column is 42, which is Q-0090's, not the spike's 40 — `quorum validate <schema.json>
<file…>` fits inside it, so no existing line moved.

### `packages/cli/src/frame.source.test.ts` — AC-2, AC-5, AC-10, AC-11

The largest change (+222 lines) and the riskiest, so it is the one written as functions over inputs.

- **The frame/command split is derived from `COMMANDS`**, not hand-listed: a module is a command
  module exactly when its basename is a registered command name. A command module with no
  `COMMAND_DOMAIN` row, and a row with no module, both fail.
- **`domainOffenders(frame, commands, allowed)`** replaces the flat prohibition. Frame modules may
  name no `DOMAIN` symbol; a command module may name only its own — a `validate.ts` reaching
  `probeAdapter` fails, and so does a row permitting a symbol its module does not name, which is
  what stops the list rotting. Four mutations demonstrate each direction.
- **`IO_MODULE` split rather than shrunk.** `node:path` moved to `FRAME_ONLY_IO`; the other five
  specifiers are unchanged and package-wide. Both halves are shown discriminating over text, and the
  negative case — a *mention* of `node:path` in prose — is shown not to trip it (Q-0079 round 1's
  lesson).
- AC-2's source scan and AC-5's flattening-regex scan, each with a subject clause.

### `packages/cli/src/main.test.ts` — AC-12

`INVOCATIONS` (AC-6's four shapes) is split from a new `READ_ONLY`, which adds `help`, `lint` and
`validate` — growing the writes-nothing subject without breaking AC-6, which the old shared list
would have. The fixture gained `harness/flows/sample.yaml`, a schema and an artifact so both
commands do real work rather than dying on the way in, and that is asserted separately.

**The snapshot gained its ref half**, which AC-12 asks for and which it did not have: the fixture is
now a git repository with two refs, `.git` is pruned from the tree walk, and `git for-each-ref` is
compared beside the bytes — a branch is a thing a command can leave behind that a file walk cannot
see. And the *loop* is now shown to have a subject: a registered handler is replaced with a stub
that writes a file **and** creates a branch, and both halves of the snapshot move. The existing
`:226` clause is untouched.

The git calls go through a helper named `git(` with the `-c` identity pairs spelled at the call
site, deliberately: `packages/core/src/git-identity.test.ts` is anchored on that helper name, and an
`execFileSync('git', …)` would have been invisible to the guard that exists to police exactly this.

### `packages/cli/src/package.test.ts` — AC-3, and the read registers

Counts moved 13 → 14 and 3 → 4, each shown red against the value it replaced. A new clause asserts
that a **type** export adds no runtime key, so the identity above stays the value surface and a
dropped `type` keyword fails with a message about the right thing. `OUTSIDE` and `DECLARED` gain the
two new reads.

### `packages/cli/turbo.json`

Two inputs added: `../../harness/flows/*.yaml` (AC-5 lints the shipped directory) and
`../../packages/*/src/**` (AC-9 walks every workspace package). **This corrects §9's cross-cutting
row**, which said this task would need no new entry — that row also said *"confirm rather than
assume (Q-0072)"*, and confirming it is what found the two. The second glob over-declares `core` and
`shared`, which already arrive through the `^test` edge; the four scaffold packages the scan reads
arrive through nothing, so the choice was over-declaring two or under-declaring four.

### `packages/core/src/contracts/validate-artifact.test.ts` — AC-9

The `render` helper transcribed from `spike/bin/harness.js:425–459` is gone, **retired by
replacement**: what stays is that the four outcomes a renderer distinguishes are decidable from
`validateArtifact`'s return value alone, plus a new assertion that no string it returns carries a
terminal escape byte — the property the departed helper demonstrated implicitly. The block's doc
names `packages/cli/src/validate.test.ts` as the owner of the rendering.

### `packages/core/src/spike-parity.test.ts` — AC-13, E-2

`Entry.binaryCarriedBy?: readonly string[]`, permitted on `cli` and `split` only, validated exactly
as `carriedBy` is — the two columns now share one loop, so existence and collection stay two
failures for both. `q0033-surface.js` and `q0011-runs-cli.js` each name their `packages/cli`
counterpart, and their `binaryHalf` prose now says what remains and whose it is instead of ending at
*"— Q-0010"*. Four new clauses demonstrated on mutated registers, plus an identity of the rows that
claim a translation, so a row losing one is visible.

**The four pinned totals are re-derived and unmoved** — 220 / 2739 / 2469 / 5428 and 55% — which is
the expected result, no file under `spike/test/` having been edited. Stated rather than skipped.

### `packages/core/src/backlog/backlog.source.test.ts`, `contracts.source.test.ts`

Two per-folder barrel pins moved with AC-3, each with the reason the symbol is that folder's public
contribution rather than an implementation detail. These were found by the suite, not by reading.

### `packages/core/src/index.test.ts`, `turbo-inputs.test.ts`, `docs/04-architecture.md`

Comment corrections my change would otherwise have made false. The `turbo-inputs.test.ts` note
carried `@quorum/cli has 21 and 2` as a present-tense figure; it was already stale (Q-0097 and
Q-0098 added five inputs between them) and is now dated to Q-0090's measurement, with the claim it
supports — that the floors were calibrated for `shared` and `core` — left standing. The
architecture doc gains one paragraph and a status-line entry.

---

## 2. Two criteria I did not implement as written, and why

Both are ground-rule-3 questions, both are measured, and **both need a ruling at the gate** — an
implement step may not write `requirements/errata.md`.

### (a) AC-4: `validate` does not open a project, and never did

AC-4 says *"Both commands call `loadProject()` first"*. `spike/bin/harness.js:426–461` calls it
**nowhere**. Verified by execution rather than by reading:

```
$ node spike/bin/harness.js validate .probe/s.json .probe/d.json --project .probe
· .probe/d.json: no recognised x-quorum-contract annotation, …
✓ .probe/d.json matches s.json
```

`--project` aimed at a directory holding no `harness/harness.yaml`, and it validates normally —
because the flag is only read inside a `loadProject` this command never reaches.

Implementing AC-4 literally would newly break `quorum validate` run outside a checkout, on the one
command in the set with a **machine** consumer: §2 of the merged requirement says so itself — a
`qa-red` `type: script` step reads its exit code. That is a behaviour change on a port ticket, which
ground rule 3 and non-goal 10 both forbid. I preserved the behaviour, wrote the measurement into the
module's doc comment, and pinned it with a test that runs `validate` from a directory with no
project and asserts it still works.

AC-4 is satisfied in full for `lint`, which is the command that does open a project.

### (b) AC-2: `lint` does read one flag, and dropping it would be a silent regression

AC-2's parenthetical says *"`validate` reads `rest`, `lint` reads neither"*. `lint` calls
`loadProject`, and `spike/bin/harness.js:52` is `flags.project ? path.resolve(flags.project) :
findProject()` — so `harness lint --project <dir>` lints that project today. Dropping it would make
`quorum lint --project x` silently lint the working directory instead, which is the silent-wrong-
answer shape this repository has spent four tickets closing.

`lint.ts` therefore passes `flags.project` through, with the `--project`-with-no-value case
**preserved as a raise** rather than coerced: `path.resolve(true)` throws inside `loadProject`
exactly as it throws in the spike, where a `String()` would have answered `<cwd>/true`. AC-2's
*testable* content — no command re-parses the command line — is satisfied and scanned for; only the
parenthetical is inaccurate, and it is pinned by a test that would fail if the flag stopped working.

---

## 3. Four tests are red, the cause is proven, and it is the uncommitted worktree

`packages/cli/src/build.test.ts` — the four tests that call `buildIn(isolate())`:

```
× audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else
× and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file
× and it reports an artifact hidden beside a turbo log, which the exemption used to swallow
× the same chain runs in an isolated copy — tracked files, install, build, execute
```

`isolate()` copies **tracked files only** — its own doc says so, and it is Q-0097's deliberate
choice, *"so the copy is the commit rather than the checkout"*. `git ls-files packages/cli` does not
list `src/lint.ts` or `src/validate.ts`, because an implement step commits nothing. The copy
therefore carries the *modified* `main.ts` and `index.ts`, which import modules that are not there.

Reproduced rather than inferred — the two modules moved aside and `tsc -p tsconfig.build.json` run
over exactly the file set the copy holds:

```
src/index.ts(11,15): error TS2307: Cannot find module './lint.js' …
src/index.ts(13,15): error TS2307: Cannot find module './validate.js' …
src/main.ts(27,22):  error TS2307: Cannot find module './lint.js' …
src/main.ts(28,26):  error TS2307: Cannot find module './validate.js' …
Command failed with exit code 2
```

Exit 2 and those four errors are exactly what the isolated build reports. The same build over the
real workspace, which does have the files, exits 0 — `pnpm turbo run build --force`, 3/3 tasks.

`git add -N` on the five new files would clear it; the permission was declined, and staging is close
enough to "you commit nothing" that I did not press. **These four clear the moment the harness
commits the worktree**, which is before `integrate` runs the suite. Nothing here is a code defect,
and no assertion was weakened to make it pass. Flagged rather than quietly reported as green,
because a reviewer cannot tell an uninstalled or uncommitted suite from a red one.

`pnpm sweep:git-identity` is blocked by the same four. Its earlier phases pass — it prints
*"environment discriminates (negative and positive probes both as expected)"*, the spike suite is
green under a configuration resolving no identity, and the workspace failure is the same four tests
with the same message. So no verdict here depends on git's identity resolution; the sweep is
downstream of the artifact above.

---

## 4. Verification

| | |
| --- | --- |
| install | `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`, before either suite |
| spike suite | **19/19 files green**, and `git diff --stat -- spike` is **empty** — 0 edits under `spike/**` |
| workspace suite | forced, `--force`, 0 cached: shared 150, core 1290 (+2 skipped), cli 222 of 226 — the four above |
| lint / typecheck | forced, 14/14 tasks, 0 errors. One warning, `backlog.ts:276`, **pre-existing** and not in my diff |
| build | `pnpm turbo run build --force`, 3/3, and `pnpm exec quorum help` lists both new commands |
| packed install | `build.test.ts`'s three-tarball fixture is among the 47 passing there |

**The manual proof §10 asks for**, run in this repository and compared line for line:

| | `pnpm exec quorum` | `node spike/bin/harness.js` |
| --- | --- | --- |
| `lint` | six `✓ <flow>.yaml`, exit 0 | identical, byte for byte |
| `validate s.json good.json bad.json` | notice + `✓`, notice + `✗` with the error indented four spaces, exit 1 | identical, byte for byte |
| `validate <schema>` (no artifact) | `✗ usage: harness validate <schema.json> <file…>`, exit 1 | identical |
| `validate <schema> ticket.md` | `✗ …: No number after minus sign in JSON at position 1` | identical |

Every difference is one AC-6 rules (`failSoftly` where the spike calls `process.exit`, same external
status) or one OQ-2 owns (`harness` in the usage line, preserved verbatim).

**Mutations run, each reverted:**

| mutation | result |
| --- | --- |
| `node:path` restored to the package-wide `IO_MODULE` | 2 red — the prohibition and its discriminator |
| `  - ` → `- ` in `lint.ts`'s renderer | 3 red across three scenarios |
| AC-9's scan **before** the `core` edit | red, naming both holders — red before green |

Plus the mutations that live in the suite permanently: four for AC-10, four for AC-13, one for
AC-11's split, one for AC-9's extraction, and the AC-1 pins asserted against the value they replaced.

---

## 5. Reported and not fixed

1. **The `DOMAIN` scan is anchored on the word, not on the use.** `validate.ts`'s doc comment
   originally said *"never calls `loadProject`"* and the scan reported it — a guard firing on text it
   does not execute, which is Q-0079 round 1's shape from the other side. I reworded the comment
   rather than re-anchoring the scan, which is AC-8's design and not mine to change. Registered so
   the next command child meets the reasoning rather than the failure.
2. **`frame.source.test.ts`'s `CREDENTIAL` scan refused a test I wrote**, which is merged.md **OQ-5**
   arriving early: a test asserting the help spells no credential word must spell those words. Fixed
   by deleting the duplicate — the package-wide scan already reads `commands.ts` and therefore `HELP`
   — rather than by earning an exemption. Q-0095 inherits the same collision with `smoke.js`, where
   it is a real finding and not a duplicate; a note in `commands.test.ts` says so.
3. **The `harness` in two user-facing sentences** — `validate`'s usage line and
   `ProjectNotFoundError`'s message — is preserved verbatim, per OQ-2 and the Q-0100 body.
4. `packages/core/src/backlog/backlog.ts:276`'s unused-directive lint warning is pre-existing.

## 6. What the gate owes

Two rulings, both from §2 above, both work no chore step may perform:

- **AC-4's scope.** Either the criterion's prose moves to name `lint` alone, or the behaviour change
  is authorised for `validate` against ground rule 3. I implemented the first reading; the code and
  its tests would need one commit to move to the second.
- **AC-2's parenthetical.** *"`lint` reads neither"* is false of the spike. The correction is a
  sentence, not a change: `--project` works today and works here.

Neither blocks anything. No decision entry is implied by this ticket's work — E-2 already ruled the
register's shape, and every other choice sits under an existing one.
