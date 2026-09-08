# Q-0067 — implement report, chore run 2, iteration 1

*The per-adapter version report. Thirteen criteria, all satisfied; ~1,039 insertions across 22 files
(20 modified, 2 new). Verified forced in this worktree: 21/21 turbo tasks, 0 cached, lint and
typecheck clean, the git-identity sweep green, and the shipped behaviour exercised through the built
binary rather than read off a report.*

---

## 1. What shipped, in one sentence

Each adapter records the CLI version it was last verified against; `core` compares that with the
version `check()` already returned; and `quorum adapters --probe` says so in at most one dim clause
and two `--json` keys — refusing nothing, changing no exit code, adding no spawn, and standing beside
the login verdict as provenance rather than as a second verdict.

**Nothing branches on a version**, and that is held shut by a guard rather than promised in prose.

---

## 2. File by file

### New

**`packages/shared/src/cli-version.ts`** (58 lines) — AC-1. `CLI_VERSION_STATES` as a `const` tuple
(`as-verified`, `ahead`, `behind`, `indeterminate`), `CliVersionState` derived from it, and
`CliVersionResult` carrying the state with both strings **unparsed**. Declarations only: no
derivation, no rendering table, no import — the shape `containment.ts` and `push-lag.ts` already set.

The result is a two-arm union and the first arm derives its states from the tuple
(`Exclude<CliVersionState, 'indeterminate'>`) rather than listing them, so the impossible combination
is unrepresentable: a comparison happened only where both sides could be read, so only
`indeterminate` may carry `verified: null`. That also means a fourth *comparable* state added to the
tuple lands in the union automatically instead of silently falling outside it.

`as-verified` is deliberately not spelled `verified`: the same report carries `login: 'verified'` two
lines up, and two unrelated facts sharing a word on one line is how a reader comes to believe the
wrong one.

**`packages/core/src/adapters/cli-version.test.ts`** (250 lines) — AC-1's scan, AC-4, AC-5, AC-6 and
AC-12. Detailed in §4.

### `packages/shared`

- **`index.ts`** — `export * from './cli-version.js';`, first in the list.
- **`docs.test.ts`** — AC-13's four assertions (§4).
- **`step-output.ts`** — two line citations moved 548 → 616 and 511 → 579. Not a tidy-up: `cliVersion`
  landed above both declarations in `adapters.ts`, and `step-output.test.ts` requires each cited line
  to still begin `export function`. It went red on the first forced run and is the citation pin doing
  its job.
- **`step-output.test.ts`** — the same two numbers in its `cited` register, with the reason.

### `packages/core`

- **`adapters/claude-capabilities.ts`**, **`adapters/codex-capabilities.ts`** — AC-2 and AC-3. One key
  each, `verifiedVersion: '2.1.220'` / `'0.149.0'`, placed **immediately after `versionArgs`** so the
  two facts about a version sit together. Each carries a one-line `Why:` naming the decision and the
  document that holds the same number, per `engineering.md` — cited, not transcribed. Both module
  headers stop calling the probe deferred, because it is not.
- **`adapters/adapters.ts`** — AC-4 and AC-5. A private `VERIFIED_VERSIONS` map over the two
  capabilities modules, a private `versionTriple` (first `\d+\.\d+\.\d+`, one rule for both vendors),
  and one exported `cliVersion(vendor, installed)`. **Two arguments, not three**: the caller cannot
  supply the record, because the capabilities modules are not on the barrel and a third argument
  would force either a second vendor-data export or a transcription of the two numbers into
  `packages/cli` — R-3 made worse. The module header moves from "four things this layer does" to
  five.
- **`adapters/adapters.source.test.ts`** — the eight-name register is nine, shown red against the
  eight it replaced; `VERIFIED_VERSIONS` asserted module-private; the barrel-contribution register
  moves to three.
- **`adapters/capabilities.source.test.ts`** — the two key registers gain `verifiedVersion` in
  position; the architecture-deferral test is **re-aimed rather than deleted** (AC-13), now holding
  §Adapters to what exists and sliced out of the document rather than searched across it, because the
  status line names every ticket that ever edited that file; and a new `Q-0067 AC-3` block reads the
  two numbers out of the verification-status line and compares them as an **identity** with the
  modules'.
- **`index.ts`** — AC-7. `cliVersion` on the barrel; `CliVersionResult` re-exported (see §5);
  a paragraph in the header, and its two stale counts corrected.
- **`turbo-inputs.test.ts`** — one `INDIRECT_ROUTES` registration for the new cross-package scan. The
  guard refused the read until it was declared with its reason; that is Q-0072's machinery working
  as designed, and the fourth ticket to earn one on the way in.

### `packages/cli`

- **`adapters.ts`** — AC-8, AC-10, AC-12. `VERSION_CLAUSE`, a **total map over the closed
  vocabulary** so a fifth state cannot be added to `shared` without this file failing to compile; and
  `versionClause`, returning `string | null`, the shape `board.ts`'s `pushLagLegend` already sets.
  The clause prints under `--probe` only, after the login line, dim. The `--json` entry gains
  `version_state` and `verified_version` after `version` in **both** forms, with the probe result
  still spread **last**. The exit rule is untouched.
- **`adapters.test.ts`** — the two moved registers, plus a `Q-0067` block: AC-8 (four states, exact
  lines, dim asserted on the raw stream, bare listing pinned line by line), AC-9 (forbidden
  vocabulary over all four states and the help line, with an anti-vacuity clause), AC-10 (both forms,
  the unreadable case, the absent adapter).
- **`build.test.ts`** — AC-11's spawned proof (§3).
- **`frame.source.test.ts`** — `DOMAIN` gains `cliVersion`, `COMMAND_DOMAIN['adapters.ts']` gains it
  with its reason, the length pin moves 23 → 24 shown red against 23, and the register's JSDoc records
  that `adapters.ts` is the second row to grow **after** its command shipped.
- **`package.test.ts`** — 23 → 24 and 28 → 29, each shown red against the value it replaced, with
  `cliVersion` asserted present and callable on the barrel. The closing clause about `@quorum/shared`
  is corrected: Q-0067 *did* add a vocabulary there, and that is the same rule rather than an
  exception — a new closed set is a new subject for the vocabulary package, where a shape a command
  merely renders is not.

### Documents

- **`docs/04-architecture.md`** — §Adapters describes the report that shipped. The claim the modules
  exist for — *"a CLI update breaks one file"* — is kept, because it is what the sentence is evidence
  for. Status line bumped.
- **`docs/03-adapter-contract.md`** — one paragraph above the verification table saying what that
  line is: a record of what was measured, **never a supported range**, with the same two numbers now
  in source and held equal by a test, and bumping either a claim that somebody re-ran the
  flag-by-flag verification. Status line bumped.
- **`docs/GLOSSARY.md`** — **Verified version**, in the shape **Confinement** and **Push lag** use,
  including the "what it is not" half: not a supported range, not a minimum, not a maximum, not an
  allow-list, not a compatibility claim, and **not a synonym for the `verified` a `--probe` login
  reports**.
- **`docs/README.md`** — the term list gains `verified version` **after `push lag`**, which is where
  GO-2 put it in `CLAUDE.md`; `docs.test.ts` compares the two as ordered lists, so the position is
  the criterion. Status line bumped.

---

## 3. AC-11, and why it is a real process boundary

The criterion asks for both exit-code cells **through a spawned process**. Two obvious readings are
refused: `invoke()`'s status is the argument handed to a spied `process.exit` (Q-0101's finding), and
spawning against the real vendor CLIs would bill a subscription and make the verdict a property of
the installed CLI — which `adapters.test.ts`'s own header, Non-goal 9 and *"A test's verdict is a
property of the commit, not of the checkout or the account"* (2026-08-30) all forbid.

The third reading is the one that works and needs no new product surface: `adapters.<vendor>.bin` is
already the shipped way to name the executable. So `build.test.ts` — which owns `runBuild()` and
`binTarget()`, and which Q-0092 already used for a spawned-reader proof — gains a fixture project
whose two adapters are POSIX scripts answering `--version` and one probe invocation. **No production
code, environment variable, export or test-only branch was added to manufacture any of this.**

Three cases, all through `node dist/quorum.js`:

| case | status |
| --- | --- |
| verified login, `ahead` state, `--probe` | **0**, and both clauses printed |
| failed login, `as-verified` state, `--probe` | **1**, and the agreeing state printed nothing |
| bare listing, `ahead` state | **0**, no clause at all |

Two details are load-bearing and are recorded in the fixture rather than left to be rediscovered.
The fake codex writes its final message through the path `-o` names **and** reports usage on a JSONL
line, because a stream reporting nothing answers `usage: null` and trips Q-0066's preserved crash
instead of the login verdict the case is about. And the three BYOS variable names are **assembled
rather than written**: `frame.source.test.ts`'s AC-12 scan reads every file in the package for those
spellings and excuses exactly one — itself — so writing them out would have grown an exclusion that
is deliberately not allowed to grow. That guard caught it on the first forced run.

---

## 4. What the guards actually claim

**AC-1 / AC-6 — two production sites, and no third reader.** Two clauses over both corpora, the
`backlog.source.test.ts` two-root shape:

- **Clause A** — the three states only this vocabulary spells (`'as-verified'`, `'ahead'`,
  `'behind'`) appear in exactly `packages/core/src/adapters/adapters.ts` and
  `packages/cli/src/adapters.ts`. `indeterminate` is **excluded and the exclusion is stated**:
  containment and push lag both spell it, so including it would report `git.ts` and `board.ts` as
  readers of a vocabulary they have never heard of — the same reason `missing ref`, `shallow clone`
  and `git failed` sit in two reason sets at once, where `git.source.test.ts` already records that a
  shared string is not a shared question.
- **Clause B** closes the hole that exclusion opens from the other side: to *read* a state a file must
  name `cliVersion`, `CliVersionResult`, `CliVersionState` or `CLI_VERSION_STATES`, and exactly three
  production files do — the two above plus the barrel, which re-exports and reads nothing.

Plus: no file in the adapters folder except the two capabilities modules names `verifiedVersion`, no
vendor file names any of the vocabulary, the derivation reaches none of `CAPABILITIES.flags`,
`.values`, `.envelope`, `.jsonl` or `.usage`, and no state appears inside a `die(` or `failSoftly(`.

**AC-5's table** covers all four states — asserted, so no arm goes unread — including the two rows
measured on this machine on 2026-09-08, a prerelease pinned with its reason (R-2), and `2.1.9`
against the record, which discriminates numeric from lexical ordering. The discrimination is
asserted rather than described: `'2.1.9' > '2.1.220'` is shown true beside the `behind` verdict.

**Shown red by mutation, not read.** Three, each with a distinct signature:

| mutation | what fired |
| --- | --- |
| `verifiedVersion` → `'2.1.221'` | AC-3: *expected { claude: '2.1.220', … } to strictly equal { claude: '2.1.221', … }* |
| the vocabulary named in `packages/cli/src/board.ts` | AC-1 clause B: the allowed set grew to four |
| `verifiedVersion` named in `adapters/claude.ts` | AC-6: *adapters/claude.ts must not name the record* |

A fourth was free: AC-1's third-site scan carries its own planted-fixture demonstration over the
genuine corpus, and AC-13's two document guards were **red before the documents were edited** — they
failed on the run that preceded the doc pass, which is what makes them checks rather than
descriptions. The second mutation also exposed a cosmetic defect in my own failure message
(`adapters/adapters/claude.ts`), fixed.

---

## 5. The one judgement call, named rather than absorbed

**AC-7 says the barrel exports "the function and its result type"; AC-1 puts that type in
`@quorum/shared`.** Both cannot be satisfied by declaring it in `core`, so `core/index.ts` carries
`export type { CliVersionResult } from '@quorum/shared';` — a re-export, never a second declaration,
so nothing can drift. It costs no runtime key, which is why AC-7's counts (23 → 24, 28 → 29) still
hold, and `package.test.ts` already asserts that a type export adds none.

The consumer side went the other way: `packages/cli/src/adapters.ts` imports the type from
`@quorum/shared`, matching `board.ts`, which takes `PushLagResult` from the package that owns the
vocabulary — the rule `package.test.ts`'s Q-0105 clause states in as many words. The consequence is
that core's re-export is public API without an in-repo consumer today. I judged that the lesser of
the two irregularities, because the alternative makes two commands import one kind of thing two ways.
**If the gate prefers the other reading, it is one import line in `packages/cli/src/adapters.ts`.**

---

## 6. What I deliberately left alone

Every non-goal, and each was reachable from something I touched:

1. **No compatibility shim.** AC-6 makes it structurally impossible to arrive at by accident.
2. **No range, minimum, maximum, allow-list or deny-list.** The record answers *what was this checked
   against* and nothing else.
3. **No refusal and no non-zero exit** on a version, in either form. `--probe`'s exit rule is
   byte-identical: `report.some((entry) => entry.login !== 'verified')`, which also fires for an
   absent adapter — existing behaviour, not this ticket's, and not "fixed" in passing.
4. **`check()` is unchanged** — `(): Promise<string>`, one `versionArgs` read per adapter, no new call
   site, and the BYOS guard still ahead of the version spawn in both.
5. **The M0 numbers are not bumped.** This machine runs 2.1.236 / 0.150.1 and the record says
   2.1.220 / 0.149.0; that difference is the datum working, and re-verifying is its own ticket.
6. **No `compatibility` field** beside `login`, and AC-9 forbids the clause from reading as one.
7. **An empty version string still answers `indeterminate`** rather than being read as a failed
   presence check — reported, not fixed.
8. **No dependency.** The rule is five lines.
9. **No oracle over the vendor's release cadence**, in the ordinary suite or in
   `real-cli.probe.test.ts`: every version in every test is a literal.
10. **No network.** Nothing on this path fetches anything.
11. **`gemini` inherits AC-4 by construction**; `harness/`, `backlog/`, the flows, the lint rules,
    the gates and run behaviour are untouched.

Also untouched by rule rather than by choice: **`CLAUDE.md`** (GO-2 landed it on the integration
branch; it is not in this role's paths) and **`docs/06-development-plan.md`** (rewritten by hand at
each plan pass — Q-0094's E-3(a) is the precedent for an implementer's edit there being reverted).
Q-0066's preserved crash reaches this command and is **preserved**: the AC-8(d) pin is unchanged, and
the AC-11 fixture works *around* it rather than through it.

---

## 7. Verification

Run in this worktree after `pnpm install --frozen-lockfile`, with `commands.install` and
`commands.test` verbatim:

- `pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks, 0 cached**. Core
  1407 passed / 2 skipped, CLI 620 passed, shared 162 passed, four scaffolds 1 each.
- `pnpm sweep:git-identity` → exit 0. The three new spawned tests pass with no resolvable git
  identity, which is the row that matters for a test that shells out.
- `pnpm exec quorum lint` → 6/6 flows clean.
- **The product, on this machine**: `pnpm exec quorum adapters --json` prints the two human lines
  unchanged and reports `"version_state": "ahead"` for **both** vendors against `2.1.220` and
  `0.149.0`. That is M-5's argument arriving as evidence rather than as a prediction — the instrument
  fires on the maintainer's own machine the day it lands, on both vendors, over a gap that widened
  twice in eleven days while nothing noticed.

`--probe` was **not** run by hand: it bills a subscription, and the spawned fixture already proves
both of its exit-code cells across a real process boundary.

**Not done, stated rather than implied:** no cross-vendor review has happened — that is the next step
of this flow — and GO-5's second environment row and CI are the gate's, not this step's.

## 8. One remark for the reviewer

The four items in my findings list are nits and none of them is this ticket's subject; three are
stale counts or citations that my change made *visibly* wrong and that were already wrong before it,
and the fourth is a pre-existing lint warning in a file I did not touch. I corrected the three that
sit inside lines I was already editing and left the fourth alone, on the ground that a warning in
`backlog.ts` is Q-0059's surface and not mine.
