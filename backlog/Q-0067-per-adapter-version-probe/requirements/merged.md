# Q-0067 — The per-adapter version report, and what an unsupported CLI version does

*Requirements, run 1, merged (iteration 1). Judged and merged against the tree at `92a6f06`; every
measurement below was re-run on 2026-09-08 rather than relayed from either candidate.*

---

## 0. What was measured, and what of the two candidates did not survive

Both candidates were checked against the tree rather than against each other. Six measurements
decide the shape of this document; four of them correct a candidate, and three make the ticket
smaller.

**M-1 — The version probe already runs. This ticket adds no CLI invocation.**
The ticket body's central argument for deferring is that a probe *"adds a CLI invocation"*. It does
not. `claude.ts:90` and `codex.ts:85` already spawn `[...CAPABILITIES.versionArgs]` and return
`probe.stdout.trim()`, and `packages/cli/src/adapters.ts:89` already receives that string and prints
it. **What is missing is the comparison, and nothing else** — no new spawn, no new latency, no new
failure mode. The deferral's reasoning was sound for a general probe design and is false of the
smallest one available. From the claude candidate (M-1), verified.

**M-2 — `check()` does not run behind `board`, `run` or `lint`, and never did.**
The ticket body reasons about surfaces on the premise that `check()` is *"cheap and runs behind
`board`, `run` and `lint`"*, and concludes that a refusal there *"breaks a cold-clone adopter"*.
Measured over `packages/core/src` and `packages/cli/src` with tests excluded, `check()` has **exactly
one production call site**: `packages/cli/src/adapters.ts:89`. `run` reaches a vendor through
`getAdapter(...).run(...)` and calls `check()` nowhere; `board` and `lint` construct no adapter at
all. *"check() proves presence; only `adapters --probe` proves login"* (2026-08-22) says that a
**paid** `check()` would put a request behind those commands; that is a statement about a hypothesis,
and the body read it as a statement about the tree. **Consequence: the hazard that made question 2
hard does not exist.** A version verdict can only be met by somebody who typed `quorum adapters`.
From the claude candidate (M-2), verified.

**M-3 — One vendor-agnostic extractor reads both real version strings.** Measured on this machine,
2026-09-08:

| command | stdout | exit |
| --- | --- | --- |
| `claude --version` | `2.1.236 (Claude Code)` | 0 |
| `codex --version` | `codex-cli 0.150.1` | 0 |

The formats disagree — the version leads one string and trails the other — but the first match of
`\d+\.\d+\.\d+` answers `2.1.236` and `0.150.1`, because `codex-cli` carries no digit. So **no
per-vendor parsing rule is needed today**, and the capabilities modules stay what
`capabilities.source.test.ts` requires them to be. Two samples, treated as two (R-2). From the claude
candidate (M-3), verified by execution.

**M-4 — A floor ages safely; a ceiling lies.** Question 1 asks where a *supported range* lives and
answers, correctly, that it is the maintenance liability *"Codex cost is reported as tokens, never
priced locally"* (2026-08-22) refused. That argument governs a **ceiling** — every vendor release
invalidates it, and refusing on one is a pinned model alias arriving by another route. It does not
govern a **recorded past measurement**: `docs/03-adapter-contract.md:130` already carries one, *"Q-0001
probe, 2026-08-22, Claude Code 2.1.220 and codex-cli 0.149.0"*. A stale ceiling **lies** — it calls a
working CLI unsupported. A stale verified-at marker **tells the truth** — it says nobody has
re-verified since 2.1.220, which is exactly what has happened. **The whole design follows: this
ticket records provenance and never a range.** From the claude candidate (M-4), adopted.

**M-5 — The gap widened again, on the day it was re-measured.** `docs/03-adapter-contract.md:130`
still says 2.1.220 / 0.149.0 and `:144` still describes the JSONL *"as observed on 0.149.0"*. Machine
on 2026-08-27: 2.1.231 / 0.149.1. On 2026-09-07: 2.1.236 / 0.150.1. On 2026-09-08, re-measured for
this document: **2.1.236 / 0.150.1**. Codex has crossed a minor version, three measurements running,
and nothing anywhere noticed. **The instrument specified below fires on the maintainer's own machine
the day it lands, on both vendors** — which is what this repository requires of a check before it is
worth its line.

**M-6 — `probeAdapter` validates structured output, so `login: verified` already carries the
compatibility claim.** `adapters.ts:485–488` runs the adapter with `PROBE_SCHEMA` and checks the
result with `checkAgainstSchema` before answering `ok`. This closes the codex candidate's own OQ-1 —
it asked whether the probe validates only login, in which case its verdict must be renamed — and it
**refutes that candidate's central criterion**. Its AC-5/AC-6/AC-10 add `compatibility:
verified|unverified` to an entry that already carries `login: verified|failed`, derived from the same
boolean, on the same line. Two words for one fact is the synonym `harness/rules.md` forbids, and it is
worse here than in prose: a reader meeting `login: verified, compatibility: verified` will conclude the
two were separately established. **The codex design ships no comparison at all** — the version stays
opaque, and questions 1 and 3 of the ticket are answered by not asking them. That is a defensible
minimum and it is not this ticket, which was opened to decide what the product may say when the two
numbers disagree.

**What the codex candidate contributes, and it is not small.** Its framing is adopted whole and
governs §3 and AC-9: **the installed version is diagnostic evidence, the probe is the verdict, and
Quorum refuses nothing on a version string.** Its AC-8 representative forms strengthen AC-5, its
AC-13 and AC-18 become non-goals with their reasons, and its risk that a narrow verdict reads as a
broad guarantee is R-6.

**One correction the claude candidate needs before it is buildable**, and it is a signature rather
than a detail. Its AC-4 has the function take *"a vendor label, the string `check()` returned, and the
recorded version"*. The caller cannot supply the third: the capabilities modules are not on
`@quorum/core`'s barrel, `packages/cli` may not reach a package's internals, and
`frame.source.test.ts`'s AC-10 partition forbids a command deriving a domain fact itself — so a
three-argument signature forces either a second barrel export of vendor data or a transcription of the
two numbers into the CLI, which is R-3 made worse. `adapters.ts` already imports `./claude.js` and
`./codex.js`, so the lookup belongs there and costs nothing. **Two arguments** (AC-4).

**Two of its register citations are wrong and are corrected in AC-7.** `DOMAIN` is not in
`package.test.ts:379`; it is `frame.source.test.ts:344–350`, parsed out of that file by
`package.test.ts` so the two cannot drift. The length pins are `package.test.ts:372` and `:453`
(`toHaveLength(23)`) and `:455` (`toHaveLength(28)`). Naming the wrong assertion is how a criterion
gets satisfied against a guard that was never the subject.

---

## 1. Problem

Two facts exist and are never compared.

The **installed** version is read on every `quorum adapters` invocation and printed verbatim
(`adapters.ts:89`). The version this repository's adapters were **verified against** is written in
`docs/03-adapter-contract.md:130` and read by nobody. Between them sits every flag the two adapters
pass and every JSONL field they read, and the only evidence that those still exist is a table pinned
to a CLI release from 2026-08-22.

The consequence today is silence, not breakage. `check()` proves the binary *runs*, and a CLI that
has renamed a flag still runs — it would fail later, inside a paid step, with a vendor error the
adapter would translate as best it could. That is the shape of failure *"check() proves presence;
only `adapters --probe` proves login"* (2026-08-22) was written after: two green ticks followed by a
vendor error, several seconds into a run that had already been paid for.

`docs/04-architecture.md` §Adapters promises the instrument and records that it is not built — *"a
per-adapter `capabilities.ts` **with a version probe**, so a CLI update breaks one file … the version
probe is deferred to Q-0067"* — and both capabilities modules carry `versionArgs: ['--version']` as
inert data, each naming this ticket. The half that was deferred is one comparison wide (M-1).

What has to be decided is not the plumbing. It is what the product is entitled to *say* when the two
numbers disagree, and — the question this repository has paid for twice — what it must never say. A
ceiling that refuses a newer CLI reproduces the pinned-model failure. A line that appears every
morning is trained away, which is Q-0102's surviving half. Silence is what got us here.

---

## 2. User stories

**`maintainer`.** As the solo maintainer, when I run `quorum adapters --probe` before a real run, I
want to be told that the flags my adapters pass were last verified against an older CLI than the one
installed, so that a flag a vendor removed is something I read in one dim line rather than something
I discover inside a paid step. I do not want to be told this every time I list my adapters, and I do
not want a green tick claiming the two versions agree when all anyone compared is a number.

**`adopter`.** As a stranger trying Quorum on my own repository, I want `quorum adapters` to behave
exactly as the README says, whatever version of the vendor CLIs I happen to have. I must never be
refused, never be told to downgrade a CLI I did not choose, and never meet a warning about a
repository's internal verification record that I have no way to act on.

**`contributor`.** As somebody adding a vendor adapter, I want the version report to be something I
inherit by recording one string in my capabilities module, the way I inherit `authError`'s
translation by doing nothing at all — and I want the product to refuse to let me branch on a version,
so that *"support two CLI versions"* is a decision somebody takes deliberately rather than one my
adapter drifts into.

**Surfaces touched:** the CLI (`quorum adapters`, both forms), `packages/core`'s adapter layer,
`packages/shared`'s vocabulary, and four documents. No flow, no gate, no run, no `harness/` file, no
`harness.yaml` key.

---

## 3. What ships

One sentence: **each adapter records the CLI version it was last verified against, `core` compares
that with the version `check()` already read, and `quorum adapters --probe` says so in at most one
dim clause — never refusing, never changing an exit code, and never claiming the two agree.**

Four states, closed, on the model of `containment.ts` and `push-lag.ts`:

| state | meaning | rendered |
| --- | --- | --- |
| `as-verified` | the installed version equals the recorded one | nothing |
| `ahead` | the installed version is numerically greater | one dim clause |
| `behind` | the installed version is numerically less | one dim clause |
| `indeterminate` | no version could be read from one side or the other | one dim clause |

`as-verified` is deliberately not called `verified`: the same JSON entry already carries `login:
'verified'`, and two unrelated facts sharing a word on one line is how a reader comes to believe the
wrong one. That is also the reason the codex candidate's `compatibility` field is not adopted (M-6).

**The rule that governs every rendered word**, taken from *"The board reports push lag, and never a CI
conclusion"* (2026-09-06) and applying here for the same reason: **the instrument may warn and may
never reassure.** A matching version proves that two numbers are equal. It does not prove a flag
exists, a field is still spelled the same way, or that anything was tested. **The only compatibility
evidence this product has is a successful `--probe`, which validates structured output through the
adapter contract (M-6) and is already reported as `login`.** The version state stands beside that as
provenance and is never a second verdict.

---

## 4. Acceptance criteria

### The vocabulary

**AC-1 — The state set is declared once, in `packages/shared`, as declarations only.**
A new `packages/shared/src/cli-version.ts`, added to `index.ts`'s existing `export *` list beside
`containment.js` and `push-lag.js`, declaring the four states above as a `const` tuple, its derived
type, and the result shape carrying the state with the installed and recorded strings. It contains no
derivation and no rendering table, in the shape those two modules already set — `core` answers and the
surface decides whether the answer is worth printing. Exactly **two** production sites may name a state
literal: the derivation in `packages/core` (AC-4) and the single rendering function in `packages/cli`
(AC-8).
*Test:* the module exports the tuple and the types and nothing that runs; a scan of
`packages/core/src` and `packages/cli/src` production files finds no third literal spelling of a state
name, demonstrated red by planting one in a fixture copy.

**AC-2 — Each capabilities module records one string, and it is still only data.**
`CLAUDE_CAPABILITIES` and `CODEX_CAPABILITIES` each gain exactly one key, `verifiedVersion`, placed
immediately after `versionArgs`, holding `'2.1.220'` and `'0.149.0'` — the two numbers
`docs/03-adapter-contract.md:130` already records. The two `toStrictEqual` key registers at
`capabilities.source.test.ts:72–73` gain it in that position. Every existing clause of that file
passes unchanged: the modules hold nothing but strings, contain no `=>`, `function `, `if (`,
`import `, `require(`, `process.` or `node:`, and pin no model alias.
*Test:* the two moved registers, plus the unchanged inertness clauses.

**AC-3 — The recorded value is the version the table was verified at, and this ticket does not bump
it.** `2.1.220` and `0.149.0` are what M0 measured. Changing either is a claim that somebody re-ran
the flag-by-flag verification, which this ticket does not do (Non-goal 5). Each key carries one
authority line saying so, in the `Why:` form `engineering.md` prescribes. The value is **kept in
agreement with the document rather than copied once**: a test reads the two numbers out of
`docs/03-adapter-contract.md`'s verification-status line and compares them with the modules', so a
future re-verification that updates one and not the other is red.
*Test:* the doc-to-module equality, extended from `capabilities.source.test.ts`'s existing AC-11
block, which already reads that document; shown red by changing one side.

### The comparison

**AC-4 — One exported function at the contract layer, taking two arguments, with the lookup inside
`core`.** `packages/core/src/adapters/adapters.ts` gains one exported function taking a **vendor label
and the string `check()` returned**, and answering the result shape AC-1 declares. The caller does not
supply the recorded version: the capabilities modules are not on the barrel and `packages/cli` may not
reach a package's internals, so a third argument would force either a second barrel export of vendor
data or a transcription of the two numbers into the CLI (M-6 correction, R-3). `adapters.ts` already
imports `./claude.js` and `./codex.js`, so the lookup is free there, and it is the contract layer for
`authError`'s reason — *"so a contributor's adapter inherits actionable auth failures without writing
any of this"*. A vendor with no recorded version — `mock`, or a contributor's adapter — answers
`indeterminate` and never throws. The folder stays **eight files**.
*Test:* the "adapters.ts exports exactly the eight runtime names" register becomes nine; the "the
folder is eight files, and none of them is a barrel" register does **not** move; the unrecorded-vendor
row answers `indeterminate`.

**AC-5 — The extraction rule is the first `\d+\.\d+\.\d+`, and it is tested against the strings the
real CLIs print.** Comparison is over the three numbers, left to right, as integers. Where a triple
cannot be read from either side the answer is `indeterminate`, which is **never inferred as**
`as-verified`, `ahead` or `behind` — the closed-set discipline *"never report an unanswerable question
as one of the answerable states"* (2026-09-06). **Every input in the table is a literal in the test
file**, so no verdict depends on the installed CLI, the login or the account (2026-08-30).
*Test:* a table containing at least — `2.1.236 (Claude Code)` against `2.1.220` → `ahead`;
`codex-cli 0.150.1` against `0.149.0` → `ahead`, both measured 2026-09-08; equality → `as-verified`;
`2.1.219` against `2.1.220` → `behind`; `2.1.9` against `2.1.10` → `behind`, the row that proves
numeric rather than lexical ordering; a version not named anywhere in the repository, which is
compared like any other; and four `indeterminate` shapes — the empty string, `claude beta`, `2.1`,
and an installed string the function can read against a recorded string it cannot. A prerelease such
as `3.0.0-beta.1` reads as its triple and answers `ahead`; that row is **pinned with its reason**, so
R-2's known misreading is deliberate rather than discovered later.

**AC-6 — Nothing branches on a version, and a guard holds that door shut.** No production file in
`packages/core/src` or `packages/cli/src` may select an argv token, a flag name, a JSONL field, a
schema, a retry rule or a model from a version string or from one of these states. The state is
produced at exactly one site and rendered at exactly one site, and the two are named in the guard.
*Test:* a source scan over both production corpora, allowing the producing function and the rendering
function by name and failing on any third reader; demonstrated red by adding a fourth site to a
fixture copy. This is Non-goal 1 made executable rather than promised.

**AC-7 — The barrel and the registers derived from it move deliberately.**
`packages/core/src/index.ts` exports the function and its result type; `frame.source.test.ts`'s
`DOMAIN` register (`:344–350`) gains the name and its per-command map grants it to `adapters.ts`
alone; `package.test.ts:372` and `:453` go 23 → 24 and `:455` goes 28 → 29 — the last of which carries
the message *"the barrel moved and no ticket said so"*, so this ticket says so.
*Test:* the four register assertions, and the existing barrel/`DOMAIN` equality that derives one from
the other.

### The surface

**AC-8 — The clause prints under `--probe`, and the bare listing does not move.**
Under `--probe`, each installed vendor's section carries at most one dim clause for `ahead`, `behind`
and `indeterminate`, and nothing for `as-verified`. It is composed by one function in
`packages/cli/src/adapters.ts` returning `string | null`, the shape `board.ts`'s `pushLagLegend`
(`:149`) already sets for exactly this job. Bare `quorum adapters` prints what it prints today, byte
for byte.
**The ruling belongs in the criterion.** `--probe` is **the check** and the bare listing is **the
report** — *"What an exit code may claim, and the three zeros it was asked about"* (2026-09-08) — and
`docs/03-adapter-contract.md:97` already tells a reader to run `--probe` *"before trusting any green
tick in this document"*, which is precisely what a verification record is. It also answers R-1 and the
cold-clone objection together: both vendors are `ahead` on this machine today and stay so until
somebody re-verifies, so on the bare listing an **adopter's first command** would carry two permanent
dim clauses about *this repository's* record, which they cannot act on and would learn to skip.
*Test:* every existing bare-form assertion passes unchanged, including the two entry registers at
`adapters.test.ts:166–171`; the probing form gains one clause per non-equal state; `as-verified` adds
no characters.

**AC-9 — What the clause may say, and what it may never say.** It names the installed version and the
recorded one and stops. No rendered state, legend or help text may use wording equivalent to
"supported", "unsupported", "compatible", "incompatible", "validated" or "verified working", may
advise upgrading or downgrading a vendor CLI, or may suggest that a run will fail. `indeterminate`
says the version could not be read and never that it is wrong. The clause may not be phrased so that
it reads as a second compatibility verdict beside `login` (M-6).
*Test:* the forbidden vocabulary asserted absent from every rendered string over all four states and
from the command's help line, in the shape push-lag's render guard already uses.

**AC-10 — The `--json` report carries the two new facts in both forms, additively, and the pinned key
register moves with them.** Every entry with `installed: true` gains `version_state` and
`verified_version` — snake_case, matching `cost_usd` in the probe result this object already spreads —
positioned after `version`, so the probe result is still spread **last** (Q-0099 AC-7(5)). Existing
keys keep their names, values and order. `adapters.test.ts:262–264`'s `toStrictEqual` key-order
register moves to the new list and is **not** relaxed to a length, a `toContain` or a `toMatchObject`.
An entry with `installed: false` gains neither key: there is no version, so there is no state, which is
the same rule that already withholds `version` and `login` from it. The two keys appear whether or not
`--probe` was passed — a machine reader asked for the whole record and has no noise budget, which is
the difference between it and AC-8's human lines.
*Test:* both forms; the moved key-order register; the absent-adapter entry asserted unchanged.

**AC-11 — A version state never changes an exit code.** Bare `quorum adapters` exits 0 whatever the
state, as Q-0110 ratified. `quorum adapters --probe` keeps **exactly** its current rule —
`report.some((entry) => entry.login !== 'verified')` — which also fires for an absent adapter, whose
entry carries no `login` key at all; that is existing behaviour, it is not this ticket's to change,
and it is not to be "fixed" in passing. A version is not a login, and an unverified *record* is not a
failed *check*. No state reaches `failSoftly()` or `die()`.
*Test:* `--probe` with a verified login and an `ahead` state exits 0; with a failed login and an
`as-verified` state exits 1; both through a spawned process rather than a spied `process.exit`, per
Q-0101's finding that the two are different claims.

**AC-12 — Nothing else about the command moves.** `check()` keeps its `(): Promise<string>` signature,
so the `Adapter` interface and every contributor adapter are untouched. No second `--version` spawn is
added (M-1). The BYOS guard still precedes the version spawn in both adapters, so a refused `check()`
yields no version and therefore no state. The command still writes nothing — the existing
writes-nothing snapshot must pass unchanged — persists nothing, caches nothing, and makes no network
call.
*Test:* the interface pin; the existing BYOS ordering tests; the existing writes-nothing snapshot; a
scan asserting one `versionArgs` spawn per adapter.

### The documents

**AC-13 — Four documents say what shipped, and the glossary gains the term.**
`docs/04-architecture.md` §Adapters is rewritten from *"the version probe is deferred to Q-0067"* to
what exists, keeping the *"a CLI update breaks one file"* claim it is evidence for; **and
`capabilities.source.test.ts`'s architecture-deferral test (`:124–130`) is re-aimed rather than
deleted**, so the document cannot silently stop describing the code. `docs/03-adapter-contract.md`
gains one paragraph stating that its verification line is a recorded measurement and not a supported
range, and its status line is bumped with the date and what changed. `docs/GLOSSARY.md` gains
**Verified version** with its decision cited, stating what it is not: not a supported range, not a
minimum, not a maximum, not a compatibility claim, and not a synonym for the `verified` a `--probe`
login reports. `docs/README.md`'s *"use exactly these terms"* list gains the term.
*Test:* `docs.test.ts` already reads all four; the glossary clause follows the shape used for
**Confinement** and **Push lag**, including the "what it is not" half. `CLAUDE.md`'s half of that list
is GO-2's and is not the implementer's.

---

## 5. Non-goals

1. **A compatibility shim.** Branching capability sets so an older CLI keeps working is a much larger
   ticket needing its own case. AC-6 makes it structurally impossible to arrive at by accident.
2. **A supported range, a minimum, a maximum, an allowlist or a denylist.** Nothing recorded here is a
   policy about which versions may run. M-4 is the argument.
3. **Refusing, failing, or exiting non-zero on a version**, in any command, in either form.
4. **Making `check()` authenticate, or calling it from `board`, `run` or `lint`.** Whether the engine
   should prove presence before spending is a real question — M-2 measured that it does not today —
   and it is not this one.
5. **Re-verifying the M0 flag table.** Bumping `2.1.220` / `0.149.0` means re-running Q-0001's
   flag-by-flag verification against the installed CLIs. Worth doing, a separate ticket, and AC-3
   deliberately forbids doing it in passing here.
6. **A second compatibility field.** The codex candidate's `compatibility: verified|unverified` is
   `login` under another name, derived from the same boolean, on the same entry (M-6). Not shipped,
   and AC-9 forbids the version clause from reading as one.
7. **Treating an empty version string as a failed presence check** (codex AC-7). That changes what
   `check()` and the presence listing report, which is behaviour beyond this ticket's subject and
   would need its own criterion set. An empty string answers `indeterminate`, which is what the closed
   state set is for. Reported, not fixed.
8. **A dependency.** No `semver` package. AC-5's rule is five lines.
9. **A test-suite oracle over the vendor's release cadence.** An assertion that the installed CLI
   matches the recorded one turns this suite red because a vendor shipped — a verdict that is a
   property of the machine, which *"A test's verdict is a property of the commit, not of the checkout
   or the account"* (2026-08-30) forbids, and a red nobody can fix, which is Q-0102's surviving half.
   `real-cli.probe.test.ts` was considered as its home, being `skipIf`-gated already, and is refused
   for the same two reasons. **The maintainer meets this fact by running the product.**
10. **Asking anything over the network** — a latest release, a changelog, a registry.
    `docs/04-architecture.md` principle 1 refuses it before preference enters, exactly as it did for a
    CI conclusion (2026-09-06).
11. **`gemini`**, which inherits AC-4 by construction; and anything in `harness/`, `backlog/`, a flow,
    a lint rule, a gate or run behaviour.

---

## 6. Open questions

**None blocks solutioning.** Three of the claude candidate's four were closed by measurement rather
than passed to the gate, and each is recorded with what closed it so the gate can reopen one
deliberately rather than re-derive it.

**OQ-1 — the term. Owner: the gate. Blocks the *word*, not the design.**
This document proposes **Verified version**. The alternative considered and set aside is *version
drift*: `drift` is not a glossary term today, but M5 ships **drift detection** for the harness
compiler, and one word for two unrelated facts is the synonym collision the vocabulary rule forbids.
Whatever the gate picks, GO-2 applies to it unchanged.

**Closed — should the clause print on the bare listing too?** Ruled in AC-8: `--probe` only. The
counter-argument is real and is recorded rather than dismissed — the bare listing is what the README
tells an adopter to run first, so a maintainer who never types `--probe` never sees the line. It loses
to two things: `docs/03-adapter-contract.md:97` already instructs that `--probe` is what to run before
trusting a green tick, and an adopter meeting two permanent dim clauses about *this repository's*
verification record on their first command can act on neither. Reversing it changes one condition in
AC-8 and no other criterion.

**Closed — should `ahead` and `behind` be one state?** Four, ruled here. Collapsing them to `differs`
removes the comparison and leaves equality, which cannot be wrong — but `behind` is the actionable
half: a CLI **older** than the recorded version may genuinely lack a flag the adapter passes, which is
the failure this instrument exists to surface, while `ahead` is the ordinary state. The ordering is
five lines and no dependency (AC-5). If the gate prefers two, AC-5's table shrinks and nothing else
moves.

**Closed — is `--json`'s report a frozen shape?** Measured: `adapters.test.ts:262–264` pins the entry's
key **order** with a `toStrictEqual`, and `:166–171` pin the two non-probe shapes the same way. That is
a **register**, not a freeze — Q-0099 preserved the shape key for key and registers move when a ticket
says so, which is what Q-0092 did to `DOMAIN` (14 → 20) and Q-0093 to `build.test.ts`'s single
`toStrictEqual`. AC-10 is therefore admissible and names the move; what is forbidden is relaxing the
assertion instead of moving it.

**Closed — does the probe verify structured output, or only login?** The codex candidate made its
verdict's name conditional on this. Measured at `adapters.ts:485–488`: it runs the adapter against
`PROBE_SCHEMA` and validates with `checkAgainstSchema`. So `login: 'verified'` already means a
schema-valid structured round-trip through the adapter contract, which is what makes a second field a
synonym (M-6).

---

## 7. Gate obligations

**GO-1 — the decision entry lands before the chore run, and the run is not launched without it.
Blocking.** Recording a version and reporting a verdict is behaviour, and
*"The port preserves behaviour"* (2026-08-25) routes behaviour through an entry accepted before
implementation. `developer-generalist`'s role file forbids writing `docs/decisions/`, which is why
this is an obligation and **not a criterion** — the codex candidate's AC-1 makes it one, and that is
*"A requirement may not name a surface its flow cannot write"* (2026-08-25) exactly. This repository
has recorded sixteen appearances of a loop handed work no agent in it can perform; Q-0062's GO-1 named
the hazard in advance and the run was launched anyway, at three implement rounds. Drafted title and
content:

> **An adapter records the version it was verified against, and never a version it supports**
> — (a) the datum is a past measurement, not a policy: no ceiling, no minimum, no range; (b) the
> product reports and never refuses, and no version changes an exit code; (c) nothing branches on a
> version, so a compatibility shim is a decision and never a drift; (d) the only compatibility
> evidence this product has is a successful `--probe`, which is already reported as `login`, so the
> version state stands beside it as provenance and never as a second verdict; (e) the report belongs
> to `quorum adapters --probe`, which is the check, and not to the bare listing, which is the report.
> Extends *"check() proves presence; only `adapters --probe` proves login"* (2026-08-22) with a third
> question the same command answers, and follows *"The board reports push lag, and never a CI
> conclusion"* (2026-09-06) in ruling that the instrument may warn and may never reassure.

**GO-2 — the term is added to `CLAUDE.md` on the integration branch, before the run. Blocking, and
where it lands is half the obligation.** `docs.test.ts:628–643` compares `CLAUDE.md`'s and
`docs/README.md`'s vocabularies as ordered lists and fails with *"CLAUDE.md and docs/README.md state
different vocabularies"*. AC-13 adds the term to `docs/GLOSSARY.md` and `docs/README.md`, which the
implementer may write; `CLAUDE.md` is **not** in `developer-generalist`'s `paths:` and Q-0103's erratum
E-2 makes it the human's. So the two halves must land in one tree, and **the tree is
`harness/Q-0067/integration`, not `main`**: `chore.yaml`'s `implement` declares
`base: harness/{id}/integration`, so a `CLAUDE.md` edit committed there is in the implementer's
worktree and in `integrate`'s merge, while the same edit on `main` leaves `main` red from the moment
it lands until the ticket merges. Neither candidate said where; both would have produced a red tree in
one direction or the other.

**GO-3 — confirm AC-3.** The two recorded numbers stay at `2.1.220` and `0.149.0`. If the gate wants
them re-verified, that is Non-goal 5 becoming its own ticket, not a criterion added here.

**GO-4 — `harness/Q-0067/integration` exists before the chore run.** `review` diffs against it and only
`integrate`, which runs later, creates it (`02-sdlc-pipeline-spec.md` §5.8). GO-2's commit is what
first puts something on it.

**GO-5 — verify in both environment rows and confirm CI green before closing.** Q-0072's both-rows
finding and Q-0105's GO-3, which is the strongest evidence this repository has that a local green is
not a green: every local signal passed and CI was red on all three jobs.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | Unchanged and re-asserted. The API-key refusal still precedes the version spawn in both adapters (AC-12), so a refused `check()` produces no version and no state. No code path, test or example accepts a key; nothing here reads or reports one. |
| **Worktree safety** | n/a. No flow writes, no worktree, no branch. The command still writes nothing (AC-12), pinned by the existing snapshot. |
| **Gate behaviour** | n/a. No gate, no `auto`, no `human-locked`, no bound changes. |
| **File format and schema** | One additive change: two keys on each installed entry of `quorum adapters --json`, with the pinned key-order register moved rather than relaxed (AC-10). No zod schema, no contract artifact and no `harness.yaml` key is touched. `verifiedVersion` is a source constant and deliberately **not** configuration — an adopter cannot know what this repository verified. |
| **Lint rules** | n/a. No flow-lint rule, no `cross_vendor` change, no deprecated API. |
| **Cold-clone impact** | Bare `quorum adapters` is byte-identical (AC-8), so the adopter's first command does not move. `--probe` gains at most one dim clause per vendor. AC-9 forbids every word that would send an adopter to change a CLI version. Net effect on the first 30 minutes: none. |
| **Errors are explicit** | `indeterminate` is a first-class answer meaning the version could not be read; it is never defaulted to a comparison that did not happen (AC-5). |
| **Product-agnostic** | No SaaS product is named. Two vendor CLIs are named, which is what an adapter is. |

---

## 9. Risks

**R-1 — a line that prints every day is trained away.** `ahead` is the state for both vendors on this
machine right now and stays so until somebody re-verifies. Unlike push lag, **this state does not
clear when you act** — it clears when the *record* is updated. Mitigated by AC-8 (only under `--probe`,
a deliberate act) and AC-9 (one dim clause, no alarm). Not eliminated, and stated rather than
discovered: if the maintainer starts ignoring it, the remedy is to re-run the verification and bump
the record, which is the behaviour the instrument exists to prompt.

**R-2 — the extraction rule rests on two samples.** M-3 measured two strings on one day. A vendor that
drops the patch component gets `indeterminate`, which is the honest answer and a designed state. A
prerelease such as `3.0.0-beta.1` reads as `3.0.0` and answers `ahead` when it is a preview — pinned as
a row in AC-5 so the behaviour is deliberate. Accepted: the clause is provenance rather than a gate, so
a wrong-by-one comparison misinforms nobody about whether a run will work.

**R-3 — the record is a second copy of a documented fact.** `verifiedVersion` and
`docs/03-adapter-contract.md:130` say the same thing twice, which is the drift this repository has
recorded seven directions of. AC-3's equality test is the whole mitigation, which is why that criterion
stands apart from AC-2 — and why AC-4 takes two arguments rather than three, since a third copy in
`packages/cli` would make it worse.

**R-4 — the emitted `dist/` copies.** `packages/core/dist/adapters/*-capabilities.d.ts` carry the
Q-0067 JSDoc today. They are gitignored build output, reproducible from the commit, and must not be
edited; the build regenerates them. Named so an implementer does not "fix" them and a reviewer does not
report them missing.

**R-5 — scope creep toward the shim.** A ticket that reads a version invites *"and then branch on it"*.
AC-6 is the executable answer and Non-goal 1 the stated one. A reviewer seeing a second reader of the
state should treat it as a blocker rather than a design discussion.

**R-6 — a narrow verdict read as a broad guarantee.** From the codex candidate. `login: verified` means
one schema-valid round-trip completed; it says nothing about a flag used only by longer runs. AC-9 and
AC-13 both state the narrow meaning in the words a reader meets, and this ticket does not reduce the
need for adapter regression tests against real CLIs.

**R-7 — this ticket makes a false claim easier to write.** Recording a "verified" version in source
tempts a future contributor to bump it when they upgrade their own CLI, converting a measurement into a
guess. AC-3's authority line and AC-13's glossary "what it is not" clause are aimed at that reader, and
the doc-to-module test at least makes the bump a two-file act.

---

## 10. Provenance

**The design is the claude candidate's**, and it is chosen rather than averaged. It answers all three
of the ticket's questions with the version it was opened about: where the datum lives (a recorded past
measurement, never a range — M-4), what an unsupported version does (nothing; it is reported under
`--probe` and never refused), and whether anything branches on it (nothing, held shut by a guard). Its
M-1 and M-2 measurements are what make the ticket small, and both were re-run here.

**The codex candidate is not adopted as a design and is not discarded.** Its central criterion —
`compatibility: verified|unverified` derived from the probe — is refused on measurement (M-6): it
duplicates `login` on the same entry under a second word, and it ships no comparison, so the ticket's
own questions go unanswered rather than decided. What it contributes and what this document takes: the
framing that **the installed version is diagnostic evidence and the probe is the verdict** (§3, AC-9,
GO-1(d)); the representative version forms that widen AC-5's table, including a prerelease and an
unfamiliar future version; its AC-13 and AC-18, which become Non-goals 4 and 9 with their reasons; its
AC-19 (no dependency) as Non-goal 8; its empty-string case, refused as Non-goal 7 with the reason
rather than folded in; and its risk that a narrow verdict reads as a broad guarantee, as R-6. Its own
OQ-1 is closed by M-6 and its OQ-2 by the register measurement in §6.

**What the merge corrected in both.** Codex's AC-1 makes the decision entry a criterion, which is a
surface its flow cannot write — moved to GO-1. Claude's AC-4 signature could not be built as written —
corrected to two arguments in §0 and AC-4. Claude's register citations for `package.test.ts` named the
wrong assertions — corrected in AC-7, with `DOMAIN` located at `frame.source.test.ts:344–350`. Claude's
GO-2 did not say which tree the `CLAUDE.md` edit lands in, and both available answers are red in one
direction — corrected in GO-2. Its OQ-2, OQ-3 and OQ-4 are ruled here rather than carried, with what
closed each recorded so the gate can reopen one deliberately.

**Size.** Thirteen criteria against a ceiling of fifteen: the codex candidate's twenty include six
ratifications of behaviour that already holds and one that is a gate obligation, and the claude
candidate's thirteen survive as thirteen. No seam is proposed — the vocabulary, the comparison and the
surface are one change and splitting them would ship a state set nothing produces.
