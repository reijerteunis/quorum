# Q-0067 — The per-adapter version report, and what an unsupported CLI version does

*Requirements, run 1, candidate (claude). Written against the tree at `92a6f06`, measured 2026-09-08.*

---

## 0. What was measured, and what of the ticket body did not survive

The body was corrected on 2026-09-07 after the cutover and is right about the paths. Four of its
statements about *behaviour* are still wrong, and three of them make the ticket smaller. Each was
measured rather than reasoned about, and each is cited so the next reader does not re-derive it.

**M-1 — The version probe already runs. This ticket adds no CLI invocation.**
The body's central argument for deferring is that a probe *"adds a CLI invocation"*. It does not.
`claude.ts:96` and `codex.ts:90` already spawn `[...CAPABILITIES.versionArgs]`, and `check()`
returns `probe.stdout.trim()` — the version string, in hand, on every call. `packages/cli/src/adapters.ts:89`
already receives it and already prints it: `✓ claude: 2.1.236 (Claude Code)`. **What is missing is
the comparison, and nothing else.** No new spawn, no new latency, no new failure mode. The
deferral's reasoning was sound for a general probe design and is false of the smallest one
available, which is why this ticket is much cheaper than its body predicts.

**M-2 — `check()` does not run behind `board`, `run` or `lint`, and never did.**
The body reasons about surfaces on the premise that `check()` is *"cheap and runs behind `board`,
`run` and `lint`"*, and concludes that a refusal there *"breaks a cold-clone adopter"*. Measured
over `packages/core/src` and `packages/cli/src` with tests excluded, `check()` has **exactly one
production call site in the workspace**: `packages/cli/src/adapters.ts:89`. `run` reaches the vendor
through `getAdapter(...).run(...)` at `engine/steps.ts:194` and calls `check()` at no point; `board`
and `lint` never construct an adapter at all. The same is true of the deleted tree — at
`92a6f06~200`, `spike/bin/harness.js` calls `check()` at `:482` inside the `adapters` command and
nowhere else, and `spike/src/engine.js` never calls it. *"check() proves presence; only `adapters
--probe` proves login"* (2026-08-22) says a paid `check()` *would* put a request behind those three
commands; that is a statement about a hypothesis, and the body read it as a statement about the
tree. **Consequence:** the hazard that made question 2 hard does not exist. A version verdict can
only be met by someone who typed `quorum adapters`, which is a command a person runs on purpose.

**M-3 — One vendor-agnostic extractor reads both real version strings.**
Measured on this machine, 2026-09-08:

| command | stdout | exit |
| --- | --- | --- |
| `claude --version` | `2.1.236 (Claude Code)` | 0 |
| `codex --version` | `codex-cli 0.150.1` | 0 |

The formats disagree — the version leads one string and trails the other — but the first match of
`\d+\.\d+\.\d+` answers `2.1.236` and `0.150.1` respectively, because `codex-cli` carries no digit.
So **no per-vendor parsing rule is needed today**, and the capabilities modules can stay what
`capabilities.source.test.ts` requires them to be: data with no function, no branch and no version
selection. This is a two-sample measurement and is treated as one (R-2).

**M-4 — The distinction the body does not draw: a floor ages safely, a ceiling does not.**
Question 1 asks where a *supported range* lives and answers, correctly, that it is the maintenance
liability *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) refused. That
argument applies to a **ceiling** — every vendor release invalidates it, and refusing on it is *"a
pinned model alias"* arriving by another route. It does not apply to a **recorded past
measurement**. `docs/03-adapter-contract.md:130` already carries one: *"Q-0001 probe, 2026-08-22,
Claude Code 2.1.220 and codex-cli 0.149.0"*. A stale ceiling **lies** — it calls a working CLI
unsupported. A stale verified-at marker **tells the truth** — it says nobody has re-verified since
2.1.220, which is exactly what has happened. **The whole design follows from this asymmetry: this
ticket records provenance and never a range.**

**M-5 — The gap is wider than the body records, and widened again on the day it was re-measured.**
`docs/03-adapter-contract.md:130` still says 2.1.220 / 0.149.0, and `:144` still describes the JSONL
*"as observed on 0.149.0"*. Machine on 2026-08-27: 2.1.231 / 0.149.1. On 2026-09-07: 2.1.236 /
0.150.1. On 2026-09-08, re-measured for this document: **2.1.236 / 0.150.1** — codex has crossed a
minor version and nothing anywhere noticed, three measurements running. The instrument specified
below **fires on the maintainer's own machine the day it lands**, on both vendors, which is what
this repository requires of a check before it is worth its line.

---

## 1. Problem

Two facts exist and are never compared.

The **installed** version is read on every `quorum adapters` invocation and printed verbatim. The
version this repository's adapters were **verified against** is written in
`docs/03-adapter-contract.md` and read by nobody. Between them sits every flag the two adapters
pass and every JSONL field they read, and the only evidence that those still exist is a table
pinned to a CLI release from 2026-08-22.

The consequence today is silence, not breakage. Nothing has broken; nothing would say if it had.
`check()` proves the binary *runs*, and a CLI that has renamed a flag still runs — it would fail
later, inside a paid step, with a vendor error the adapter would translate as best it could. That
is the shape of the failure *"check() proves presence; only `adapters --probe` proves login"*
(2026-08-22) was written after: two green ticks followed by a vendor stack trace, several seconds
into a run that had already been paid for.

`docs/04-architecture.md:88` promises the instrument and records that it is not built:
*"a per-adapter `capabilities.ts` **with a version probe**, so a CLI update breaks one file … the
version probe is deferred to Q-0067"*. Both capabilities modules carry `versionArgs: ['--version']`
as inert data, each naming this ticket, so the half that was deferred is one comparison wide.

What has to be decided is not the plumbing. It is what the product is entitled to *say* when the
two numbers disagree, and — the question this repository has paid for twice — what it must never
say. A ceiling that refuses a newer CLI reproduces the pinned-model failure. A line that appears
every morning is trained away, which is Q-0102's surviving half. Silence is what got us here.

---

## 2. User stories

**`maintainer`.** As the solo maintainer, when I run `quorum adapters --probe` before a real run, I
want to be told that the flags my adapters pass were last verified against an older CLI than the one
installed, so that a flag removed by a vendor release is something I read in one dim line rather
than something I discover in a paid step. I do not want to be told this every time I list my
adapters, and I do not want a green tick claiming the versions agree when all anyone checked is a
number.

**`adopter`.** As a stranger trying Quorum on my own repository, I want `quorum adapters` to behave
exactly as the README says it does, whatever version of the vendor CLIs I happen to have installed.
I must never be refused, never be told to downgrade a CLI I did not choose, and never be shown a
warning about a repository's internal verification record that I have no way to act on.

**`contributor`.** As someone adding a vendor adapter, I want the version report to be something I
inherit by recording one string in my capabilities module, the way I inherit `authError`'s
translation by doing nothing at all — and I want the product to refuse to let me branch on a
version, so that "support two CLI versions" is a decision somebody takes deliberately and not one
my adapter drifts into.

**Surfaces touched:** the **CLI** (`quorum adapters`, both forms), `packages/core`'s adapter layer,
`packages/shared`'s vocabulary, and three documents. No flow, no gate, no run, no `harness/` file.

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

`as-verified` is deliberately not called `verified`: the same JSON entry already carries
`login: 'verified'`, and two unrelated facts sharing a word on one line is how a reader comes to
believe the wrong one.

**The rule that governs every rendered word**, taken from *"The board reports push lag, and never a
CI conclusion"* (2026-09-06) and applying here for the same reason: **the instrument may warn and
may never reassure.** A matching version proves that two numbers are equal. It does not prove a flag
exists, a field is still spelled the same way, or that anything was tested. Nothing rendered from
this state set may carry wording equivalent to "supported", "unsupported", "compatible",
"validated" or "verified working".

---

## 4. Acceptance criteria

### The vocabulary

**AC-1 — The state set is declared once, in `packages/shared`, as declarations only.**
A new `packages/shared/src/cli-version.ts`, exported by `index.ts`'s existing `export *` list,
declaring the four states above as a `const` tuple plus its derived type, and the result shape. It
contains no derivation and no rendering, in the shape `containment.ts` and `push-lag.ts` already set
— *"`core` answers; the surface decides whether the answer is worth printing"* (2026-09-06, standing
rule 2). Neither `core` nor `packages/cli` may spell one of these strings a second time.
*Test:* the module exports the tuple and the type and nothing that runs; a scan of
`packages/core/src` and `packages/cli/src` finds no second literal spelling of any state name.

**AC-2 — Each capabilities module records one string, and it is still only data.**
`CLAUDE_CAPABILITIES` and `CODEX_CAPABILITIES` each gain exactly one key, `verifiedVersion`, placed
immediately after `versionArgs`, holding `'2.1.220'` and `'0.149.0'` respectively — the two numbers
`docs/03-adapter-contract.md:130` already records. The two `toStrictEqual` key registers in
`capabilities.source.test.ts` move to `['bin', 'versionArgs', 'verifiedVersion', 'flags', 'values',
'envelope', 'usage']` and `['bin', 'versionArgs', 'verifiedVersion', 'flags', 'values', 'jsonl',
'usage']`. Every existing clause of that file still passes unchanged: the modules hold nothing but
strings, contain no `=>`, `function `, `if (`, `import `, `require(`, `process.` or `node:`, and
pin no model alias.
*Test:* the two registers, plus the unchanged inertness clauses, plus `literalsOf` still returning
strings only.

**AC-3 — The recorded value is the version the table was verified at, and this ticket does not bump
it.** `2.1.220` and `0.149.0` are what M0 measured. Changing either is a claim that somebody re-ran
the flag-by-flag verification, which this ticket does not do (Non-goal 5). Each key carries one
authority line saying so, in the `Why:` form `engineering.md` prescribes, and the value is kept in
agreement with the document rather than copied once: a test reads the two numbers out of
`docs/03-adapter-contract.md` and compares them with the modules', so a future re-verification that
updates one and not the other is red.
*Test:* the doc-to-module equality, extended from `capabilities.source.test.ts`'s existing AC-11
block, which already reads that document; shown red by changing one side.

### The comparison

**AC-4 — One exported function at the contract layer, and it lives beside `authError` for
`authError`'s reason.** `packages/core/src/adapters/adapters.ts` gains one exported function taking
a vendor label, the string `check()` returned, and the recorded version, and answering one of the
four states. It is at the contract layer rather than in a vendor file so a contributor's adapter
inherits it by recording one string — the same argument the file already makes for `authError`
(*"so a contributor's adapter inherits actionable auth failures without writing any of this"*). The
folder stays **eight files**; `adapters.source.test.ts:72`'s register moves from eight exported
names to nine, and `:87`'s `FOLDER` register does not move.
*Test:* both registers, and the new name present in the first.

**AC-5 — The extraction rule is the first `\d+\.\d+\.\d+`, and it is tested against the strings the
real CLIs print.** Comparison is over the three numbers, left to right, as integers. Where a triple
cannot be read from either side the answer is `indeterminate`, which is **never inferred as
`as-verified`, `ahead` or `behind`** — the closed-set discipline *"never report an unanswerable
question as one of the answerable states"* (2026-09-06).
*Test:* a table including the two strings measured 2026-09-08 — `2.1.236 (Claude Code)` against
`2.1.220` is `ahead`, `codex-cli 0.150.1` against `0.149.0` is `ahead` — plus equality, a `behind`
row, `2.1.9` against `2.1.10` proving numeric and not lexical ordering, and at least three shapes
that must answer `indeterminate`: an empty string, a string with no triple (`claude beta`), and a
two-part version (`2.1`).

**AC-6 — Nothing branches on a version, and a guard holds that door shut.** No production file in
`packages/core/src` or `packages/cli/src` may select an argv token, a flag name, a JSONL field, a
schema or any other behaviour from a version or from one of these states. The state is produced at
exactly one site and read at exactly one site, and the two are named in the guard.
*Test:* a source scan over both packages' production corpora, allowing the producing function and
the rendering clause by name and failing on any third reader; demonstrated red by adding a fourth
site to a fixture copy. This is Non-goal 1 made executable rather than promised.

**AC-7 — `@quorum/core`'s barrel gains the function, and the pinned surface moves deliberately.**
`packages/cli/src/package.test.ts:455`'s `toHaveLength(28)` becomes 29 and the domain register at
`:379` gains the name — the register whose own message is *"the barrel moved and no ticket said
so"*, so this ticket says so.
*Test:* the two register assertions.

### The surface

**AC-8 — The human line prints under `--probe` and not on the bare listing.**
`quorum adapters --probe` appends at most one dim clause to the vendor's existing `✓ <name>:
<version>` line for `ahead`, `behind` and `indeterminate`, and appends nothing for `as-verified`.
Bare `quorum adapters` prints exactly what it prints today, byte for byte.
The reasoning is the ruling and belongs in the criterion: `--probe` is **the check** and the bare
listing is **the report** — *"What an exit code may claim, and the three zeros it was asked about"*
(2026-09-08), and `docs/03-adapter-contract.md:97` already frames `--probe` as the thing to run
*"before trusting any green tick in this document"*, which is precisely what a verification record
is. It also answers R-1: a line that prints on every incidental listing is trained away, and one
that prints when a person has deliberately asked *is this machine ready* is not.
*Test:* the bare-form output is asserted unchanged against the existing AC-7 fixtures; the probing
form gains one clause per non-equal state; `as-verified` adds no characters.

**AC-9 — What the clause may say, and what it may never say.** It names the installed version and
the recorded one and stops. No rendered state, legend or help text may use wording equivalent to
"supported", "unsupported", "compatible", "incompatible", "validated" or "verified working", may
advise upgrading or downgrading a vendor CLI, or may suggest the run will fail. `indeterminate`
says the version could not be read and never that it is wrong.
*Test:* the forbidden vocabulary asserted absent from every rendered string and from
`commands.ts`'s help line, over all four states, in the shape `push-lag`'s render guard already
uses.

**AC-10 — The `--json` report carries the two new facts in both forms, additively.** Every entry
with `installed: true` gains `version_state` and `verified_version` — snake_case, matching
`cost_usd` in the probe result this object already spreads. Existing keys keep their names, their
values and their order, and the probe result is still spread **last** (Q-0099 AC-7(5)). The report
carries the state whether or not `--probe` was passed: a machine reader asked for the whole record
and has no noise budget, which is the difference between it and AC-8's human lines.
*Test:* both forms; the key order of the pre-existing keys asserted unchanged; a probing entry
still showing the spread last.

**AC-11 — A version state never changes an exit code.** Bare `quorum adapters` exits 0 whatever the
state, as `Q-0110` ratified. `quorum adapters --probe` sets ERROR on `login !== 'verified'` and on
nothing else — a version is not a login, and an unverified *record* is not a failed *check*. No
state reaches `failSoftly()` or `die()`.
*Test:* `--probe` with a verified login and an `ahead` state exits 0; with a failed login and an
`as-verified` state exits 1; both asserted through a spawned process rather than a spied
`process.exit`, per Q-0101's finding that the two are different claims.

**AC-12 — Nothing else about the command moves.** `check()`'s signature stays `(): Promise<string>`,
so the `Adapter` interface and every contributor adapter are untouched. No second `--version` spawn
is added (M-1). The BYOS guard still runs *before* the version spawn in both adapters, so a refused
`check()` yields no version and therefore no state. The command still writes nothing — the existing
`adapters.test.ts` AC-9 snapshot must pass unchanged — persists nothing, caches nothing, and makes
no network call.
*Test:* the interface pin; the existing BYOS ordering tests; the existing writes-nothing snapshot;
a scan asserting one `versionArgs` spawn per adapter.

### The documents

**AC-13 — Three documents say what shipped, and the glossary gains the term.**
`docs/04-architecture.md:88`'s paragraph is rewritten from *"the version probe is deferred to
Q-0067"* to what exists, keeping the *"a CLI update breaks one file"* claim it is evidence for;
`capabilities.source.test.ts:129`'s assertion that the architecture doc records the deferral is
re-aimed rather than deleted, so the document cannot silently stop describing the code.
`docs/03-adapter-contract.md` gains one paragraph under §"check() is not proof of login" stating
that the table's version is a recorded measurement rather than a supported range, and its status
line is bumped with the date and what changed. `docs/GLOSSARY.md` gains **Verified version** with
its decision cited, stating what it is not: not a supported range, not a minimum, not a maximum, not
a compatibility claim, and not a synonym for the `verified` a `--probe` login reports.
*Test:* `docs.test.ts` already reads all three; the glossary clause follows the shape used for
**Confinement** and **Push lag**, including the "what it is not" half.

---

## 5. Non-goals

1. **A compatibility shim.** Branching capability sets so an older CLI keeps working is a much
   larger ticket needing its own case, as the body says. AC-6 makes it structurally impossible to
   arrive at by accident.
2. **A supported range, a minimum, or a ceiling.** Nothing recorded here is a policy about which
   versions may run. M-4 is the argument.
3. **Refusing, failing, or exiting non-zero on a version.** In any command, in either form.
4. **Making `check()` authenticate, or calling it from `board`, `run` or `lint`.** Whether the
   engine should check presence before spending is a real question (M-2 measured that it does not),
   and it is not this one.
5. **Re-verifying the M0 flag table.** Bumping `2.1.220` / `0.149.0` means re-running Q-0001's
   flag-by-flag verification against the installed CLIs. Worth doing; a separate ticket; AC-3
   deliberately forbids doing it in passing here.
6. **A dependency.** No `semver` package. AC-5's rule is five lines and needs no justification in a
   solution document.
7. **A test-suite oracle over the vendor's release cadence.** An assertion that the installed CLI
   matches the recorded one turns this repository's suite red because a vendor shipped — a verdict
   that is a property of the machine, which *"A test's verdict is a property of the commit, not of
   the checkout or the account"* (2026-08-30) forbids, and a red nobody can fix, which is Q-0102's
   surviving half. `real-cli.probe.test.ts` was considered as its home, on the grounds that it is
   already `skipIf`-gated and already exists for what CI cannot answer; refused for the same two
   reasons. **The maintainer meets this fact by running the product**, which is what the product is
   for.
8. **Asking anything over the network** — the latest release, a vendor's changelog, a registry.
   `docs/04-architecture.md` principle 1 refuses it before preference enters, exactly as it did for
   a CI conclusion (2026-09-06 (a)).
9. **`gemini`.** It inherits AC-4 by construction and needs nothing here.
10. **Anything in `harness/`, `backlog/` or a flow.** No flow file, lint rule, gate or run behaviour
    changes.

---

## 6. Open questions

**OQ-1 — the term. Owner: the gate. Not blocking implementation; blocking the *word*.**
This document proposes **Verified version**. The alternative considered and set aside is *version
drift*: `drift` is not a glossary term today but M5 ships **drift detection** for the harness
compiler, and one word for two unrelated facts is the synonym collision `harness/rules.md` forbids.
Whatever word the gate picks, GO-2 applies to it unchanged.

**OQ-2 — should the human clause print on the bare listing too? Owner: the gate.**
AC-8 rules it out, on Q-0110's report/check split and R-1. The counter-argument is real and is
recorded rather than dismissed: the bare listing is what the README tells an adopter to run first,
so a maintainer who never types `--probe` never sees the line. It is set aside because a maintainer
who never types `--probe` has a larger problem — `docs/03-adapter-contract.md:97` says to run it
before every real run — and because the adopter is the person the bare listing is for. Reversing
this changes one condition in AC-8 and no other criterion.

**OQ-3 — should `ahead` and `behind` be one state? Owner: the gate. Not blocking.**
Collapsing them to `differs` removes the numeric comparison entirely and leaves equality, which
cannot be wrong. Four states are proposed because `behind` is the actionable one — a CLI older than
the recorded version may genuinely lack a flag the adapter passes — and because the ordering is
five lines with no dependency. If the gate prefers two, AC-5's table shrinks and nothing else moves.

**OQ-4 — is `--json`'s report a frozen shape? Owner: the gate. Answer before AC-10 is built.**
`Report` is `Record<string, unknown>[]` with no schema, no validator and no consumer in this
repository, and Q-0099 preserved it key for key from the spike. AC-10 is additive and preserves
every existing key, its value and its position, which is the reading this document takes. If the
gate reads Q-0099 AC-7(5) as freezing the *key set* rather than the *existing keys*, AC-10 is struck
and the state appears on the human lines only.

---

## 7. Gate obligations

**GO-1 — the decision entry lands before the chore run, and the run is not launched without it.
Blocking.** The ticket says so and this document agrees: recording a version and reporting a verdict
is behaviour. `developer-generalist`'s own role file forbids writing `docs/decisions/`, and its
`blocked` verdict exists for exactly this. This repository has recorded **sixteen** appearances of a
loop handed work no agent in it can perform; Q-0062's GO-1 named the hazard in advance and the run
was launched anyway, costing three implement rounds. Drafted title and content:

> **An adapter records the version it was verified against, and never a version it supports**
> — (a) the datum is a past measurement, not a policy: no ceiling, no minimum, no range; (b) the
> product reports and never refuses, and no version changes an exit code; (c) nothing branches on a
> version, so a compatibility shim is a decision and never a drift; (d) the report belongs to
> `quorum adapters --probe`, which is the check, and not to the bare listing, which is the report.
> Extends *"check() proves presence; only `adapters --probe` proves login"* (2026-08-22) with a
> third question the same command answers, and follows *"The board reports push lag, and never a CI
> conclusion"* (2026-09-06) in ruling that the instrument may warn and may never reassure.

**GO-2 — `CLAUDE.md`'s term list gains the term, by hand, before the chore run. Blocking, and it is
a measured red rather than a courtesy.** `docs.test.ts`'s Q-0108 block compares `CLAUDE.md`'s and
`docs/README.md`'s vocabularies as **ordered lists** and fails with *"CLAUDE.md and docs/README.md
state different vocabularies"*. AC-13 adds the term to `docs/GLOSSARY.md` and `docs/README.md`,
which the implementer may write; `CLAUDE.md` is **not** in `developer-generalist`'s paths and
Q-0103's erratum E-2 makes it the human's. So an implementer that satisfies AC-13 turns `integrate`
red on a file it is forbidden to touch. This is *"A requirement may not name a surface its flow
cannot write"* (2026-08-25) caught before the run rather than at the fifth instance.

**GO-3 — confirm AC-3.** The two recorded numbers stay at `2.1.220` and `0.149.0`. If the gate wants
them re-verified, that is Non-goal 5 becoming its own ticket, not a criterion added here.

**GO-4 — `harness/Q-0067/integration` exists before the chore run.** `review` diffs against it and
only `integrate`, which runs later, creates it (`02-sdlc-pipeline-spec.md` §5.8).

**GO-5 — verify in both environment rows and confirm CI green before closing.** Q-0072's
both-rows finding and Q-0105's GO-3, which is the strongest evidence this repository has that a
local green is not a green: every local signal passed and CI was red on all three jobs.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | Unchanged and re-asserted. The API-key refusal still precedes the version spawn in both adapters (AC-12), so a refused `check()` produces no version and no state. No code path, test or example accepts a key. Nothing here reads or reports one. |
| **Worktree safety** | n/a. No flow writes, no worktree, no branch. The command still writes nothing (AC-12), pinned by the existing snapshot. |
| **Gate behaviour** | n/a. No gate, no `auto`, no `human-locked`, no exhaustion bound changes. |
| **File format and schema** | One additive change: two keys on each installed entry of `quorum adapters --json` (AC-10, OQ-4). No zod schema, no contract artifact and no `harness.yaml` key is touched. `verifiedVersion` is a source constant, not configuration — deliberately **not** a `harness.yaml` key, because an adopter cannot know what this repository verified. |
| **Lint rules** | n/a. No flow-lint rule, no `cross_vendor` change. `@typescript-eslint/no-deprecated` applies as it does everywhere; no deprecated API is used. |
| **Cold-clone impact** | Bare `quorum adapters` is byte-identical (AC-8), so the adopter's first command does not move. `--probe` gains at most one dim clause per vendor. AC-9 forbids every word that would send an adopter to change a CLI version. Net effect on the first 30 minutes: none. |
| **Errors are explicit** | `indeterminate` is a first-class answer that says the version could not be read; it is never defaulted to a comparison that did not happen. |
| **Product-agnostic** | No SaaS product is named. Two vendor CLIs are named, which is what an adapter is. |

---

## 9. Risks

**R-1 — a line that prints every day is trained away.** `ahead` is the state on this machine right
now for both vendors and will stay so until somebody re-verifies. Unlike push lag, **this state does
not clear when you act** — it clears when the *record* is updated. Mitigated by AC-8 (only under
`--probe`, which is a deliberate act) and by AC-9 (one dim clause, no alarm). Not eliminated, and
stated here rather than discovered: if the maintainer starts ignoring it, the answer is to re-run
the verification and bump the record, which is the behaviour the instrument exists to prompt.

**R-2 — the extraction rule rests on two samples.** M-3 measured two strings on one day. A vendor
that ships `v3.0.0-beta.1` or drops the patch component gets `indeterminate` or a triple read out of
a prerelease tag. `indeterminate` is the honest answer and is a designed state, not a crash; the
prerelease case is the one that could read as `ahead` when it is a preview. Accepted: the clause is
provenance, not a gate, so a wrong-by-one comparison misinforms nobody about whether a run will
work.

**R-3 — the record is a second copy of a documented fact.** `verifiedVersion` and
`docs/03-adapter-contract.md:130` say the same thing in two places, which is the drift this
repository has recorded seven directions of. AC-3's equality test is the whole mitigation and is why
that criterion exists rather than being folded into AC-2.

**R-4 — the emitted `dist/` copies.** `packages/core/dist/adapters/*-capabilities.d.ts` carry the
Q-0067 JSDoc today. They are gitignored build output, reproducible from the commit, and must not be
edited; the build regenerates them. Named so an implementer does not "fix" them and so a reviewer
does not report them missing.

**R-5 — scope creep toward the shim.** A ticket that reads a version invites *"and then branch on
it"*. AC-6 is the executable answer and Non-goal 1 the stated one. A reviewer seeing a second reader
of the state should treat it as a blocker rather than a design discussion.

**R-6 — this ticket makes a false claim easier to write.** Recording a "verified" version in source
tempts a future contributor to bump it when they upgrade their CLI, converting a measurement into a
guess. AC-3's authority line and AC-13's glossary "what it is not" clause are aimed squarely at that
reader, and the doc-to-module test at least makes the bump a two-file act.
