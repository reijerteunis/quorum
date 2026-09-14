# Q-0126 — implement report, run 2, iteration 2

**Verdict: `proceed`. AC-12 to AC-16 are complete; AC-1 to AC-11 were verified on the branch rather
than re-done.**

Round 1's `blocked` was correct and erratum E-2 ruled its subject. Decision **095** is on this branch
at `76f2c71` — verified present before anything was written — so the folder question, the principle-1
widening, the argv contract and the Windows refusal are all *implemented* here rather than decided.

---

## 0. What was already on the branch, and was not re-done

Round 1 (`9ee8e2c`) landed **AC-1 to AC-11** and `806cd31` landed GO-2's manifest and lockfile before
the run. Verified rather than assumed: a forced `pnpm turbo run test lint typecheck` over the
unchanged branch returned **7/7 tasks, 0 cached, 0 failures** before I touched anything. Round 1's
files are otherwise untouched except where a criterion of *this* round required a line to move —
`open.ts`, `open.test.ts`, `commands.ts`, `commands.test.ts`, `frame.source.test.ts`,
`package.test.ts` and the four documents.

---

## 1. File by file

### New — `packages/core/src/browser/`, the ninth folder

**`browser.ts`** — one exported function, `openUrl(url, options)`, and one exported type beside it.

- `LAUNCHER` is a **table** (`darwin: 'open'`, `linux: 'xdg-open'`) rather than a chain of
  conditionals, so a platform is a row that is present or absent and never a branch that fell
  through. **Windows is absent deliberately** and answers `unsupported-platform`, which is entry
  clause 5 — a smaller promise than a `cmd /c start` row nobody has run. The BSDs are absent for the
  same reason: `xdg-open` exists there, this product has run on neither, and naming them would be a
  claim rather than a measurement.
- The URL is one argv element. `spawnLauncher` uses `spawn`, never `exec` or `execSync`, and asks for
  no shell.
- **`detached: true` and `unref()` are load-bearing and are not tidying.** Without `detached` the
  launcher — and on Linux a browser `xdg-open` execs rather than hands off to — shares this process's
  group, so the Ctrl-C that stops `quorum open` would reach a browser the operator is reading at that
  moment. Stated in place.
- `stdio: 'ignore'` because `core` prints nothing, with the bound stated: a `launch-failed` reason can
  name the exit code and not the launcher's own sentence.

**`browser.test.ts`** — 18 tests, every one over an injected spawn, so **nothing in this file can open
a browser on the machine running it**.

**`browser.source.test.ts`** — AC-12's whole-workspace scan. See §3, which is where the design work is.

### Changed

| File | What moved |
| --- | --- |
| `packages/core/src/index.ts` | `openUrl` exported, `BrowserLaunch` re-exported as a type; header count re-derived (§4) |
| `packages/cli/src/open.ts` | the launch, `--no-open`, `launchWarning`, the `launcher` seam, signal handlers armed before the launch |
| `packages/cli/src/open.test.ts` | AC-15's four tests, `neverCalled`, `recordingSpawn`, `runOpenLaunching` |
| `packages/cli/src/commands.ts` | the help line gains the `--no-open` flag and says the command opens the URL |
| `packages/cli/src/commands.test.ts` | AC-1's help-line clause asserts both halves |
| `packages/cli/src/frame.source.test.ts` | `DOMAIN` + `openUrl`, `COMMAND_DOMAIN['open.ts']` + `openUrl`, AC-14's test, the size pin 25 to 26 |
| `packages/cli/src/package.test.ts` | AC-16's test; `domain()` 25 to 26 and the barrel 30 to 31, each with the superseded value refused |
| `packages/core/src/turbo-inputs.test.ts` | two `WALKS` rows, one `INDIRECT_ROUTES` entry, one `READ_BASES` entry |
| `packages/core/turbo.json` | five declarations for the new walk (§3) |
| `docs/04-architecture.md` | principle 1, the package map, the folder sentence, `quorum open`'s paragraph, a second paragraph on what the launcher may claim, the status line |
| `harness/architecture.md` | principle 2, which carries the same sentence as principle 1 |
| `docs/06-development-plan.md` | M3's done-when line, this ticket's bullet |
| `docs/USAGE.md`, `README.md` | the browser, the opt-out flag, and what Quorum cannot tell you |

---

## 2. AC-13 — the one place the criterion left a choice, and how it was taken

AC-13 names four states and then says *"a spawner that throws produces the could not tell member and
never the negative one."* Read literally against a four-member set, that would leave
`executable-unavailable` unreachable — a member of a closed set nothing can produce, which is worse
than the ambiguity.

**Taken as: `ENOENT` alone produces `executable-unavailable`; every other throw is `launch-failed`.**
`ENOENT` is the one failure that is an *observation* rather than the absence of one — the operating
system looked for that executable and reported it is not there — and even then the state names the
**launcher**, never a browser. Everything else (a permission, a resource limit, a plain `Error`, a
non-`Error` throw) is the *could not tell* member. Both directions are red tests: a generic throw is
asserted to be `launch-failed` **and** asserted not to be `executable-unavailable`, and `ENOENT` is
asserted to be the observation so that member is not dead.

The state set is also asserted to name no browser, and `launched`'s shape is pinned at two keys so it
cannot grow one.

---

## 3. AC-12's scan — the part that needed design, and the gap it nearly shipped with

"A whole-workspace scan finds no second site launching a browser" is a claim about every package, so
it can only be answered by reading every package. Three things came out of that.

**Two clauses, because neither sees what the other does.** Clause A is keyed on the launcher *name*
over every `.ts` and `.tsx` file including tests — which is what backs AC-13's *no test opens a real
browser*. Clause B is keyed on the *shape*: a production module that both imports `node:child_process`
and reads the platform. Measured, that is exactly one file. Clause B is what would catch a launcher
that never wrote the name, and it is shown red over a darwin-only fixture clause A is blind to.

**The needle is `xdg-open` and not `open`, and that is measured.** `open` is a command of this product
since round 1 and is a quoted literal in **sixteen** files that launch nothing — the registry, the
help, every test of either. A scan keyed on it would have reported the whole command. Stated as the
residual, together with the one every literal scan here carries: an assembled specifier is invisible
to clause A, and clause B closes that for a production module and not for a test.

**The gap I nearly shipped: clause B of `turbo-inputs.test.ts` passed while the walk was undeclared.**
That file registers walks by task and directory, and `packages` and `apps` were **already registered**
for a different suite under a narrower rule — so my scan's literals were accepted and nothing asserted
that the files it reads are hashed inputs. `packages/server/src`, `apps/web/src` and every `test/`
helper would have been read by a cached-clean task. That is the fail-open shape this repository keeps
finding, in the guard built to close it. Closed by adding **two `WALKS` rows of my own** — which then
*force* the declaration — and five `inputs` lines. Demonstrated: removing the server source
declaration reports twelve files by name.

**`packages/shared` is excluded from the walk, and the bound is checked rather than argued.** It is
`@quorum/core`'s workspace dependency, and `turbo-inputs.test.ts` asserts in as many words that core
covers it *by the edge and never by an input* — so walking it would be that edge's claim written
twice. `caught-failures.source.test.ts` states the same bound over the same package. What it costs is
made checkable: that package's own suite refuses `child_process` among the specifiers any of its
sources may import, and this guard reads that clause.

**And that check was vacuous when I first wrote it**, which is worth more than the check. It asserted
the file *contains* `child_process` — true of a second list and of prose — so deleting the guard left
it **green**. Found by mutating rather than by reading. It now matches the clause's own mechanism and
goes red when that clause is removed.

---

## 4. Corrections this round made that no criterion asked for

**`packages/core/src/index.ts`'s export count was already wrong.** Its header read *"Twenty-nine value
symbols"* against a file exporting **thirty**: Q-0122 added `pathInside` to the register and left the
prose. Nothing checks it — what `package.test.ts` pins is the register's length and the error list's,
never a number in that docblock. **Re-derived to 31 rather than incremented from a figure that was
already wrong**, with the correction recorded in place.

**`open.ts`'s docblock named `initProject` and failed AC-10 from a comment.** That scan reads a
module's whole text and a command may name no other command's domain symbol, so the *prose* explaining
which precedent this follows broke it. The prose was reworded; the scan was not narrowed. Third
instance of that family in this ticket, after round 1's two.

**The first warning wording was refused by its own test.** *"Quorum knows no browser launcher for
win32"* contains the phrase *no browser*, and the clause forbidding a sentence that claims a browser is
absent fired on it. It reads *"Quorum has no launcher for"* now — what is absent is a row in a table,
never a browser on the machine.

**`capture`'s `hard` cannot discriminate here**, and an assertion of mine rested on it. `quorum open`
ends every successful run through `process.exit(SIGNAL)`, so `hard` is true whether or not anything
failed. Replaced with the exit code, which is what actually separates a warning from a refusal, and
the reason is written beside it.

---

## 5. Two things I did beyond the letter of the criteria, with reasons

**Signal handlers are armed before the launch, and the launch is raced against the stop.** A launcher
can block: `xdg-open` may exec a browser in the foreground where no desktop opener answers. Without
this, Ctrl-C during that window would reach a process with no handler installed and kill it
ungracefully — contradicting `docs/USAGE.md`'s existing claim that Ctrl-C stops the command and
releases every live run first. Three lines, defending a claim the documentation already makes.

**`BrowserLaunch` is declared in `packages/core` and not in `@quorum/shared`, which is a departure from
the three unions decision 095 compares this to.** Containment, push lag and verified version each live
there because a second *package* renders them and `shared` is what two packages define against — the
wire and the browser bundle among them. This one has a single consumer, reached through the same
barrel as the function it comes from, and `shared` is declarations a browser bundle may hold, which is
the last place a launcher's vocabulary belongs. What 095 compares is the **discipline** — a closed set,
never an answer the probe did not give — and that is carried. **Stated here as a visible judgement
rather than left as an omission**; if a reviewer reads 095 clause 6 as binding the *location*, moving
it is a file, a barrel line and two register entries.

Relatedly, `openOn`'s new `launcher` parameter is typed off `openUrl`'s own parameter list rather than
by adding a `LaunchSpawn` name to the barrel — which is what keeps AC-16's export count at exactly
one. The test supplies the **spawn** and drives the shipped table, the shipped four states and the
shipped refusal to infer, where a stubbed `openUrl` would have proved only that this module calls
something.

---

## 6. GO-6 — fourteen mutations, one at a time, each red with its own message

None was shown red by a neighbour (Q-0107). Each was reverted immediately.

| Mutation | Red, and how |
| --- | --- |
| barrel loses `openUrl` | 3 tests — *"openUrl is not a function on the barrel"*, the surface identity, the 30-count |
| `COMMAND_DOMAIN['open.ts']` loses it | *"open.ts: openUrl is not one of [loadProject]"* |
| `open.ts` imports `node:child_process` | AC-11 and AC-14, the second naming the module |
| a launcher name in `packages/cli/src/open.ts` | clause A, by file name |
| a platform-chosen spawn in `packages/server/src/serve.ts` | clause B — **on a file naming no launcher**, which is the half clause A cannot see |
| the server source declaration dropped from `turbo.json` | the new `WALKS` row, listing twelve unhashed files |
| help line loses the opt-out flag | AC-1's clause by name |
| warning reworded to claim *no browser* | AC-15's forbidden-claim clause |
| `--no-open` ignored | 3 tests, including the AC-2 fixture where `neverCalled` fired as designed |
| any coded error read as `executable-unavailable` | *"EACCES was classified as an observation"* |
| a `win32` row added to the table | 2 tests — the row, and the closed set's members |
| the URL composed into a `/bin/sh -c` string | 3 tests — the executable, the argv, the source clause |
| `shared` drops `child_process` from its refused builtins | the bound's own check (after it was fixed — see §3) |
| a second file in `browser/` | the one-file clause |

---

## 7. Verification

- `pnpm install --frozen-lockfile` clean. `pnpm turbo run test lint typecheck build --force --continue`
  → **26/26 tasks, 0 cached, 0 errors**, run four times across the round; the final forced pass after
  the last edit is 21/21 with 0 cached.
- **The real spawn path was exercised end to end through the emit**, from a plain `node` process, with
  no side effect: this machine is darwin, so the linux row names an executable that is not here and the
  operating system answered `ENOENT` — returning
  `{"state":"executable-unavailable","command":"xdg-open"}`. That proves `spawnLauncher`, its error
  handler and the `ENOENT` classification against the artifact rather than the source. `win32` and
  `freebsd` returned `unsupported-platform` and spawned nothing; the barrel reported **31** exports.
- **The command was run through the installed shim**: `pnpm exec quorum open --port 7719 --no-open`
  printed `✓ Quorum is serving http://127.0.0.1:7719 — press Ctrl-C to stop` and served until stopped,
  launching nothing.
- `pnpm exec quorum lint` green. `pnpm sweep:git-identity` → *"the workspace suite executed and green
  with no resolvable git identity"*, 7/7 forced 0 cached.

**Not exercised, stated rather than implied: a real `open` spawn on this machine.** That is the one
path that would open a browser window on the maintainer's desktop, and I did not run it unprompted
mid-run. What stands in for it: the argv and the executable are asserted per platform over the shipped
table, the real `spawnLauncher` is proven by the `ENOENT` round trip above, and AC-15 drives the real
`openUrl` through the real command with only the spawn supplied. Worth thirty seconds at the gate.

---

## 8. Reported and not fixed

- **`harness/architecture.md:25` and `harness/product-context.md:80` still say "four packages emit"**,
  stale since Q-0125 made `@quorum/server` the fifth; `docs/04-architecture.md:327` says five. Round 1
  reported this and left it, and I am leaving it for the same reason: it is Q-0125's claim with its own
  sixteen register sites, and it is not this requirement's subject. I edited principle 2 of that file
  because decision 095 rules that sentence; I did not touch the count beside it.
- **`packages/core/src/backlog/backlog.ts:330`** — `Unused eslint-disable directive`. Pre-existing, in
  a file this change does not touch, 0 errors.
- **`turbo-inputs.test.ts` registers walks by task and directory and accepts a literal any registered
  walk names**, whatever rule that walk applies. My two rows close it for this suite; the general
  shape — a second walk of an already-registered directory being invisible to clause B — is still there
  for the next one. Registered rather than fixed: it is that file's own design question.
- **`launchWarning` cannot report a launcher's own error text**, only its exit code, because
  `spawnLauncher` ignores the child's streams. Stated in the module rather than closed; capturing them
  means buffering, which is `exec.ts`'s job one folder over.
