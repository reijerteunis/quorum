# Q-0095 — The mock end-to-end suite runs against the CLI binary

*Requirements, run 1, 2026-09-04. Candidate: claude.*

---

## 0. Read this first: what was measured, and what moved

The plan's instruction for every child of Q-0010 is **read `packages/core/src/spike-parity.test.ts`
first, do not re-derive from scratch, and do not trust the ticket body's coverage figure** — five
consecutive children measured one wrong at their requirements gates. That was done. The register
was right twice where this ticket's body is wrong, which is the third time that has happened.

### 0.1 The inherited figures are wrong, in both of the recorded ways

| claim | source | measured 2026-09-04 | verdict |
| --- | --- | --- | --- |
| `smoke.js` is **781 lines** | ticket body §1; `06-development-plan.md` Q-0095 bullet | **780** (`wc -l`) | the systematic **+1 per file** this cut has recorded six times |
| `smoke.js` has **151 assertions** | ticket body §1; plan bullet | **158** `assert(` sites | expired three tickets ago |
| *the* mock end-to-end, 151 assertions, transfers | body's framing | **76 of 158** are the binary half | **scope** error, the larger kind |

The line count is not merely stale. `151` was true at commit `dad6254` (Q-0035), when the file was
**739** lines. So *"781 lines and 151 assertions"* is a composite of two different moments plus an
off-by-one, and **describes no commit that has ever existed**. Traced:

```
c69cd99  asserts=124  lines=626
bfb90c0  asserts=146  lines=729
dad6254  asserts=151  lines=739      ← where "151" was true
8323c2a  asserts=154  lines=764
d66450f  asserts=154  lines=772      ← Q-0088's re-aim
56d6a7a  asserts=158  lines=780      ← HEAD
```

`06-development-plan.md` contradicts itself inside one document: Q-0010's bullet says
*"`smoke.js`'s **780** among them"* (Q-0090 re-derived it), while Q-0095's bullet three screens
below says **781**. Both were written from the register; one was transcribed and one was not.

### 0.2 The four buckets, because there are four and not two

The body says the file is `split` and *"only the binary half transfers"*. True, and incomplete —
the split is not two-way. Classified by mapping all 158 `assert(` line numbers onto the file's
blocks:

| bucket | sites | share | who carries it |
| --- | --- | --- | --- |
| **binary half** — reaches `bin/harness.js` through `run()` or a direct `spawnSync`, or reads state only such a spawn produced | **76** | 48% | **nobody. This ticket.** |
| **library half** — the fifteen `await import('../src/…')` blocks | 70 | 44% | the eleven `packages/core` suites the register's `carriedBy` names |
| **repository-consistency** — the shipped-template model pin (`:216`) and the `harness/architecture.md` role table (`:462–:483`) | **8** | 5% | **nobody, on either side of the port** — see §0.4 |
| **runner discovery** — `spike/test/run.js` finding a newly written failing file (`:595–:603`) | 4 | 3% | `packages/core/src/test-discovery.test.ts` (Q-0054), whose header carries the same reasoning |

76 + 70 + 8 + 4 = 158. Nothing is unclassified.

**Anyone sizing this ticket from "151 assertions" is sizing roughly twice the work.** Anyone sizing
it from 76 alone is under-sizing it, because §0.3 adds a second file and §0.5 adds a mechanism that
does not exist yet.

### 0.3 The register says this ticket owes **two** files, not one

The body's whole scope statement is `smoke.js`. Measured against `spike-parity.test.ts`:

- **`smoke.js`** — the only row in the register carrying a `binaryHalf` with **no**
  `binaryCarriedBy`. The body's claim that this is the last owed binary half is correct, and this
  is the mechanical statement of it. `spike-parity.test.ts:1714` asserts it by name:
  `expect(REGISTER['smoke.js'].binaryCarriedBy, "smoke.js is still Q-0095's to translate").toBeUndefined()`.
- **`q0033-surface.js`** — its `binaryHalf` prose ends, verbatim:
  *"What remains is **S3.2/S3.3's two-path end-to-end through the shipped review flow — Q-0095**"*,
  and two register clauses assert that the row still names this ticket (`:1617`, `:1694`,
  both `.toMatch(/Q-0095/)`). That file's row has five counterparts from Q-0091, Q-0093, Q-0094 and
  Q-0099; this is the sixth and last.

The ticket body mentions `q0033-surface.js` nowhere. Twelve lines, six assertion sites, two
executions. It is small — and a child that ships without it leaves two register clauses asserting
that Q-0095 still owes something after Q-0095 has closed, which is exactly the contradiction
`binaryCarriedBy` was ruled into existence to make impossible (Q-0091 erratum E-2).

### 0.4 Eight assertions belong to neither half, and the cutover deletes them

`smoke.js:211–217` and `:456–485` are neither CLI nor library. They are consistency checks over
**this repository's own harness**:

- `:216` — no shipped flow or role template pins a `model: gpt-…`. Grep across `packages/**`
  returns two *fixtures* using `model: gpt-5` and **no counterpart assertion**. `q0033-surface.js:161`
  covers `review.yaml` alone.
- `:462–:483` — `harness/architecture.md`'s role table agrees with `harness/roles/developer-*.md`
  frontmatter, prose and vendor spread. `packages/core/src/turbo-inputs.test.ts:301` states the
  position outright: *"`harness/architecture.md`: role.test.ts asserts this string appears in
  role.ts's own doc comment; **no suite opens the file**"*. `packages/shared/src/role.ts:30` says
  the same from the other end — `smoke.js` *"is the only thing that checks it at all"*.

Q-0011 opened the second of these because `developer-tooling.md` existed on disk while being
invisible to the architect, and every Q-0033 task defaulted to backend — a single-vendor fan-out
where the point is two. **The cutover deletes `spike/test/**` wholesale**, so on the day
`spike/` goes, both checks stop existing and nothing reports it.

`:459`'s `if (fs.existsSync(arch))` is additionally the shape *"a check that skips its subject must
not report success"* (2026-08-25) forbids: in the spike the file is always there, so the guard has
never fired, and a translation that carries it over into a fixture-relative location would skip
silently and stay green.

This is registered rather than absorbed — see **GO-2**. It is not this ticket's subject, it is not
the CLI's, and inventing a home for it inside a command suite would be scope creep wearing a
translation's clothes.

### 0.5 The decisive finding: the six siblings' execution model cannot carry this suite

Every command child so far drives its command **in process** through `packages/cli/test/invoke.ts`,
which calls `main(argv)` and captures two streams. That was correct for six commands and is
**structurally unable to carry `smoke.js`'s spine.**

`packages/core/src/adapters/mock.ts:16–21`, in its own words:

> The call counter is MODULE-SCOPED and no reset is exported. In the spike every run is a fresh
> process, so the counter is per-run; under Vitest a test file shares this module for its lifetime.
> […] **Adding a reset export would be a behaviour change (charter §2)**, and Q-0054 inherits this
> constraint.

`smoke.js`'s spine depends on the mock's *natural* first-call-fails-then-passes behaviour at three
load-bearing places, none of which any forcing switch can reproduce:

| assertion | line | what it needs |
| --- | --- | --- |
| `backward edge counter persisted (needs-input → retry once)`, `head-of-product: 1` | `:59` | the counter at 0 for that key, then exactly one loop |
| `review loop bounced back to architect once` — `iteration 1/2 → goto architect` | `:65` | the same, for `solutioning.review` |
| `failed integration re-ran fan-out scoped to failing tasks` | `:94` | `MOCK_DEV_FLAKY=1` **and** `n === 1` for that task key |

`MOCK_ALWAYS_PASS` and `MOCK_ALWAYS_FAIL` force the verdict either way and therefore **destroy the
loop being asserted** — which is why `run.test.ts` sets one of the two on every single test and why
it never exercises a convergent loop. Confirmed by reading it: 659 lines, `MOCK_ALWAYS_*` stubbed
in every block, and `requirements` is the only flow it ever runs.

**So the translated spine must spawn a real process per invocation.** That is not a preference; it
is the only route that reproduces the semantics without the charter §2 change `mock.ts` forbids by
name.

And that collides with **Q-0098 AC-15(c)**, cited by name in four places
(`run.test.ts:17`, `init.test.ts:16`, `runs.test.ts:14`, `gate.ts:21`), which names `build.test.ts`
as the one file that may spawn the emit. `init.test.ts:16` even anticipates this ticket:
*"the emitted target's own assertions live in `build.test.ts` … **and the end-to-end suite is
Q-0095's**"*.

**The collision is ruled here rather than deferred, by reading AC-15(c) instead of the summaries of
it.** `build.test.ts:1293–1296`:

> Q-0098's merged requirement measures this (§3 M-12) and names exactly **two safe shapes** in
> AC-15(c) — **assert inside an isolated copy**, or put the real-workspace assertions here.

The hazard AC-15(c) exists to close is one-directional and specific: `build.test.ts` calls
`removeEmit()` at four sites, `vitest.shared.js` sets no `fileParallelism: false`, so a second file
reading `packages/cli/dist` would intermittently meet an emit that had just been deleted. **A suite
that never touches `packages/cli/dist` is outside that hazard**, and the isolated copy is AC-15(c)'s
own first safe shape. `packages/cli/src/build-fixture.test.ts` is the standing precedent — a second
file that builds, in a throwaway workspace, for the neighbouring reason that mutating this checkout
would be *"a test with a side effect on the tree it is judging"*.

**Consequence: no erratum, no decision entry and no amendment to a landed criterion is owed.** The
route this requirement specifies is one AC-15(c) already permits. That is stated explicitly because
the alternative reading — *"AC-15(c) names one file, so this ticket must amend it"* — would hand the
chore loop a blocker no step on it may clear, which is the pattern this cut has now recorded
eleven times.

### 0.6 One more thing nothing in the workspace has ever done

No suite under `packages/**` runs `qa-red` or `development` through the CLI. `run.test.ts` runs
`requirements` and nothing else; `build.test.ts:2084` and `runs.test.ts:98` merely spell
`flow: 'development'` inside a hand-written manifest fixture. `packages/core` covers fan-out,
integrate and the red phase at unit level (`engine/composite.test.ts`, `suite-output.test.ts`).

So the largest genuinely new thing here is not a translation at all: **the chain has never been
driven end to end in this workspace**, and that is precisely the gap M2's done-when names.

---

## 1. Problem

The `maintainer` cannot yet trust `quorum` the way they trust `harness`. Six command children have
each proven their own command in isolation, in process, with the mock forced to one answer. Nothing
has ever taken one ticket from `init` to `stage: green` through the built binary — six flows, two
convergent loops, a two-wave fan-out, a scoped retry, three worktrees created and given back, a
rollback, an exhaustion gate and an `undecided` exit — which is what `spike/test/smoke.js` does on
every spike run and what `06-development-plan.md` means by *"the mock end-to-end through the
binary"*.

Until that exists, three things are stuck. **M2's done-when is unmet.** **The cutover cannot
happen** — deleting `spike/`, retiring its CI job and retiring `harness/port-charter.md` — because
the spike suite is still the only place the chain is proven. And **CI carries two required suites**
where one would do, which every contributor pays for on every push.

The `contributor` has the sharper version of the same problem: the spike suite is the artifact that
tells them their adapter or flow template did not break the product, and it is scheduled for
deletion with no successor.

## 2. User stories

- As the **maintainer**, I want one ticket walked from `quorum init` to `stage: green` through the
  built binary, so that a merge which breaks the chain between two commands turns `pnpm test` red
  rather than being found on the next real run.
- As the **maintainer**, I want the register to say the binary half is carried rather than owed, so
  that I can open the cutover ticket knowing what `spike/test/**` still holds that nothing else
  does.
- As the **contributor**, I want the regression suite that judges my adapter to live in the package
  I am changing, so that it survives the deletion of `spike/`.
- As the **adopter**, I want the flows I get from `quorum init` to be the flows this suite proves,
  so that the first thing I run is the thing that was tested.

**Surface:** CLI (`packages/cli`) and the test suites under it; `packages/core/src/spike-parity.test.ts`
as the register ground rule 5 binds. No production behaviour in `core`, `shared` or the CLI changes.
Nothing under `spike/` is written.

---

## 3. Acceptance criteria

> Every criterion below is independently testable. Where one asserts an *absence* or a *rename*, it
> says what turns it red, because *"a check is not established by reading it"* (2026-08-29).

**AC-1 — The scope is the two files the register names, and the register says so on both rows.**
The change carries (a) `spike/test/smoke.js`'s binary half — the 76 assertion sites enumerated in
Appendix A — and (b) `spike/test/q0033-surface.js` S3.2/S3.3, the two-path end-to-end through the
shipped review flow (`:170–:181`). A translation of (a) alone leaves `q0033-surface.js`'s row
naming Q-0095 as owing work after Q-0095 has closed.
*Test:* AC-12's register clauses; and the review-flow scenario asserted by AC-11.

**AC-2 — Every binary invocation in the translated spine is a separate operating-system process, and
the reason is pinned where a later change would meet it.**
The suite does not reach the spine through `test/invoke.ts`. The file's header states the measured
cause — the module-scoped mock counter of `packages/core/src/adapters/mock.ts:16–21`, and that a
reset export is a charter §2 behaviour change — and cites it, rather than transcribing it.
*Test:* a source-level assertion in the new suite's own file that it imports no symbol from
`../test/invoke.js`, with the header sentence required to be present. Shown red by adding the
import.

**AC-3 — The suite spawns an artifact it built itself in an isolated copy, and never
`packages/cli/dist`.**
This is AC-15(c)'s first named safe shape and needs no amendment to it (§0.5). The suite reads and
executes only a temporary workspace it created; it calls no `removeEmit`, and it does not depend on
whether `packages/cli/dist` exists, so its verdict cannot move with another file's build state.
*Test:* the suite asserts that the path it spawns is under `os.tmpdir()` and is not
`binTarget()`; and a run with `packages/cli/dist` deleted passes.
*Note:* whether `isolate()` and `buildIn()` are extracted from `build.test.ts` into
`packages/cli/test/` or rebuilt locally in the shape `build-fixture.test.ts` uses is the
implementer's call — see R-2, which rules the banner sentence a description rather than a
prohibition.

**AC-4 — One ticket walks the whole chain, and each stage is asserted from the ticket file the
binary wrote.**
In one fixture repository, in order: `init` → `lint` → `ticket new` → `requirements` →
`solutioning` → `qa-red` → `development`, with `stage:` read back after each as `draft`,
`requirements`, `solutioned`, `red`, `green`; a flow whose `consumes` does not match the ticket's
stage is refused; and the integration branch holds contracts, tests and both implementations at the
end (`smoke.js:48`, `:52–:58`, `:64–:67`, `:81–:82`, `:86–:88`, `:92–:98`).
*Test:* the translated spine. Shown red by reverting any one stage transition in a copy of the
fixture flows.

**AC-5 — The three convergent behaviours that need a fresh mock counter are asserted, and are the
proof AC-2 exists for.**
(a) the requirements backward edge running head-of-product twice and persisting
`head-of-product: 1`; (b) solutioning printing `iteration 1/2 → goto architect` exactly once;
(c) `MOCK_DEV_FLAKY=1` producing `2 task(s) in 2 wave(s)`, then `tests exit 1, expected pass`,
`scoped to failing tasks` and `tests green`.
*Test:* each of the three. This criterion is what fails if somebody later moves the suite in
process, which is the point of writing it separately from AC-4.

**AC-6 — Worktree safety and the user's working tree, end to end.**
The architect ran on `harness/T-0001/contracts` in its own worktree and the step said so as it cut
it; the finished run gave that worktree back, **directory and registration together**, while
keeping the branch; `git status --porcelain` shows nothing outside `backlog/` and `harness/`; no
`src/` appears in the fixture's working tree; and `commands.install` ran **in the integration
worktree** before the tests, evidenced by the marker written outside it (`smoke.js:72–:79`, `:99`,
`:104–:106`).
*Test:* all six. The worktree-return half goes red if `finish()` stops removing what it obtained
(Q-0062).

**AC-7 — The exhaustion gate, its exit code and the retry grant.**
`--auto` does not walk through a human-locked exhaustion gate; the run says which gate it could not
answer and what it kept; it exits **3** and not merely non-zero; an unanswered non-TTY gate records
`undecided` in `runs.log`, is not recorded as `failed`, rolls nothing back, does not advance the
stage and does not refund its iteration counter; and `--gate-answer retry` grants **exactly one**
further traversal — three `step=head-of-product` lines, `gate=retry counter=requirements.head-of-product set=1`,
the loop ending one past its limit, and an unrelated counter untouched
(`smoke.js:113–:121`, `:234–:245`, `:259–:267`).
*Test:* each. Exit 3 is asserted as `=== 3`, never as `!== 0` — the spike's own comment says why.

**AC-8 — The failed-parallel-sibling scenario, with both re-aimed assertions shown red against a
deliberately broken binary.**
A failed parallel branch fails the run; the surviving sibling keeps its output at
`requirements/run-1/candidate-codex.md`; **the negative assertion searches `requirements/`
recursively** for `candidate-claude.md` rather than testing one path; the failure is recorded in
`runs.log` and does not advance the stage; a failed step records what it cost and the run's cost
includes it; and the next attempt gets its own run id (`smoke.js:141–:162`).
*Test:* **the two re-aimed assertions must be demonstrated red against a deliberately broken
binary, not observed green.** The single-path form of the negative assertion went green the moment
Q-0088 moved the file, proving the writer had failed only by accident. A translation that
re-flattens either one re-opens that hole and passes.

**AC-9 — Both rollback paths.**
(a) a failing `integrate` with no `on_fail` aborts the run, leaves the ticket branch at exactly the
SHA it started from, removes the abandoned merge so the next red phase measures a clean base,
leaves the work intact on its own branch, and records `rolled-back branch=` in `runs.log`;
(b) a base-sync conflict fails the run, names the two branches, says re-running the developers
cannot fix it, **does not consume the iteration budget**, and is distinguishable in `runs.log` as
`base-conflict base=` (`smoke.js:359–:365`, `:394–:398`).

**AC-10 — The commands that ride the chain rather than being its subject.**
`lint` exits 0 over the shipped flow directory the fixture was scaffolded with; `board` lists the
ticket; `adapters` with all three API-key variables set refuses **both** vendors before probing
either CLI; `validate` exits 0 on a conforming artifact and 1 on a non-conforming one so a `qa-red`
script step can fail on it (`smoke.js:40`, `:123`, `:130–:131`, `:647–:648`).
*Note:* single-command assertions overlapping Q-0091's, Q-0093's and Q-0099's suites are **not**
duplication. Those prove the command; this proves it inside the chain, against state five earlier
commands produced. The claim is the sequence.

**AC-11 — `q0033-surface.js` S3.2/S3.3: the shipped review flow traverses both paths.**
Over the shipped `review.yaml`, both rows: `MOCK_ALWAYS_FAIL` + `--gate-answer abort` ends at
`stage: red` with a changes-requested/development/red word in the output; `MOCK_ALWAYS_PASS` +
`--gate-answer advance` ends at `stage: reviewed`, says `approve`, and writes
`review/verdict.md`. Both exit 0.
*Note:* this scenario uses the **forcing** switches, so it does not depend on the mock counter and
**may run in process** through `invoke()`. Where it lives is the implementer's call; if it lives in
`run.test.ts`, that file's *"Nothing here spawns the binary"* header stays true.

**AC-12 — The register's three Q-0095 clauses are inverted rather than deleted, and both rows move
with their prose.**
`smoke.js` gains a `binaryCarriedBy`; `q0033-surface.js` gains its sixth counterpart; both rows'
`binaryHalf` prose stops naming Q-0095 as owing anything. The three standing clauses —
`spike-parity.test.ts:1617` and `:1694` (`.toMatch(/Q-0095/)`) and `:1714`
(`.toBeUndefined()`) — are **rewritten to assert the new state**, never removed.
*Why inverted:* Q-0094's own note on the clause it moved: it read `.toMatch(/Q-0094/)` and *"the old
expression would have gone on passing while meaning the opposite, which is worse than going red"*.
Same shape as Q-0037's AC-4h pin, inverted rather than deleted.
*Test:* shown red against the superseded values first, in the shape every child of this cut has
written for its own move.

**AC-13 — `spike-parity.test.ts`'s five line totals are re-derived and shown unmoved.**
This change edits **no** file under `spike/test/`, so `binary-only 220`, `both 2739`,
`library-only 2469`, `total 5428` and the **55%** share are expected to be unchanged. Ground rule 5
requires them re-derived rather than adjusted, and *"it did not move" is a measurement* — the
precedent is clause (m)'s Q-0093 derivation and Q-0091's unmoved one.
*Test:* the existing pins, re-run; and the ticket's report states the five numbers it observed.

**AC-14 — The two orphan buckets are recorded in the register rather than silently dropped.**
`smoke.js`'s row states, in its `binaryHalf` or a sibling note, that eight of its assertions are
**neither half** — the template model pin and the `harness/architecture.md` role table — that
nothing under `packages/**` carries them, that `turbo-inputs.test.ts:301` and
`packages/shared/src/role.ts:30` both say so, and that the cutover deletes them. The four runner
assertions are recorded as carried by `packages/core/src/test-discovery.test.ts`.
*Why a record and not a fix:* a home for a harness-consistency check is not a CLI question, and
inventing one inside a command suite is the scope creep this cut has refused four times. The
successor is **GO-2**.

**AC-15 — The suite is honest about what it could not run.**
No block of the translated spine is guarded by a condition that lets it skip and still report
success. Where a check cannot run on this platform — the fixture's `sh -c` commands are POSIX, the
same registered class as Q-0098's `chmod +x` — it **refuses or is asserted absent**, never silently
passes. `smoke.js:459`'s `if (fs.existsSync(arch))` and the `if (assert(contractsSurvives, …))` at
`:418` are the two shapes to look at: the second is already correct (Q-0062 made the subject an
assertion), the first is not and is not translated (AC-14).
*Test:* the suite's own source scan, in the shape `smoke.js:418`'s comment describes.

---

## 4. Non-goals

1. **`spike/src/**` and `spike/test/**` are not touched.** Ground rules 1 and 2. `spike/test/smoke.js`
   keeps running and keeps its 158 assertions until the cutover deletes it wholesale. This ticket
   *adds* coverage under `packages/cli`.
2. **The cutover itself.** Deleting `spike/`, retiring the `spike` CI job and retiring
   `harness/port-charter.md` are Q-0010 §5's follow-up. This ticket unblocks them; it does not do
   them. See **GO-1**.
3. **The library half is not re-translated.** Seventy of the 158 sites are carried by eleven
   `packages/core` suites the register names. A second description of each would be two descriptions
   that drift apart silently — Q-0054's own stated reason for having an empty translation set.
4. **No known defect is closed in passing.** Q-0059's traversing `dirOf`, Q-0060's silent
   frontmatter, Q-0066's probe crash, Q-0068's *"Harness runs on subscription OAuth only"* (asserted
   verbatim at `smoke.js:130`/`:131` and quoted at `:505`), Q-0100's `harness`-spelled usage lines
   and the `owner` default at `backlog.ts:190` are all preserved and asserted as they are.
5. **No mock reset export, and no test-only switch, command, environment variable or production
   branch** is added to make the suite easier — `mock.ts` names the reset a charter §2 behaviour
   change, and Q-0098 AC-15 refused the general shape.
6. **`fileParallelism: false` is not set workspace-wide.** AC-3's isolated copy removes the reason
   to want it, and the setting would slow every package's suite to solve one file's problem.
7. **A homed replacement for the eight orphan assertions** (§0.4). Registered, routed to GO-2, not
   built here.
8. **Windows support.** The fixture rewrites `commands.install`/`commands.test` to `sh` chains, as
   the spike does. All seven CI jobs are `ubuntu-latest`; this repository has never claimed Windows,
   and the ticket for it is owed only if it ever does.

---

## 5. Findings the implementer should not re-derive

- **R-1 — Read `spike-parity.test.ts`, not the ticket body, for scope.** §0.1–§0.3. The body's
  figures are wrong in both recorded ways and its scope statement is short by one file.
- **R-2 — `build.test.ts`'s *"nothing was extracted from it"* is a description, not a prohibition.**
  It records what Q-0098 did. Reading it as a contract is the class of error Q-0094's E-3 named —
  *a requirement describes what must be conveyed; only a fixture, a frozen contract's own file, or a
  criterion quoting bytes pins bytes.* Extraction of `isolate()`/`buildIn()` into
  `packages/cli/test/` is permitted; so is `build-fixture.test.ts`'s shape of building its own.
- **R-3 — `packages/core` genuinely holds everything the spine needs.** Ground rule 4 checked: the
  mock adapter (`adapters/mock.ts`, with all four `MOCK_*` switches), the engine, fan-out, integrate,
  worktrees and run history are all in `core` and reachable through `@quorum/core`'s barrel, which
  Q-0092 extended by the run-history subsystem. Nothing needs porting. What is missing is the
  **process boundary**, not an API.
- **R-4 — No `pnpm install` is needed inside the fixture.** `smoke.js:34–39` rewrites
  `commands.install` to `sh -c "pwd > ../../install-cwd"` and `commands.test` to `sh tests/check.sh`.
  The install marker is written **two levels up, outside the worktree** — deliberately, since Q-0062:
  written inside, it leaves the integration worktree permanently dirty, the run keeps it, and the
  suite never exercises removal on the one worktree every code-writing flow makes.
- **R-5 — `q0033-surface.js` S3.2/S3.3 does not need the spawn.** It uses the forcing switches
  (§AC-11). Sizing it with the spine is over-sizing it.
- **R-6 — The plan's own Q-0095 bullet needs correcting**, and this is the human's edit: `781` there
  against `780` in Q-0010's bullet, and `151 assertions` presented as the transferring quantity when
  76 transfer. `backlog/Q-0095-…/ticket.md` carries the same pair; the backlog belongs to the harness
  and an agent's edits under it are discarded.

---

## 6. Open questions

| # | question | owner | blocking? |
| --- | --- | --- | --- |
| **OQ-1** | **Does the suite build an isolated copy per file, or is `isolate()`/`buildIn()` extracted from `build.test.ts` into `packages/cli/test/`?** Recommendation: extract. Two independent copies of a sixty-line workspace-copier is the drift this repository keeps finding, and `build-fixture.test.ts` only avoided it because its fixture is a *synthetic* workspace rather than a copy of this one. R-2 rules the banner sentence non-binding. | implementer | no |
| **OQ-2** | **How long does the spine take, and does it need one timeout or several?** `build.test.ts` uses `300_000` for build-and-spawn blocks; this suite adds ~14 spawns each running a full flow with real git worktrees on top of one `tsc` build of three packages. Unmeasured — measure before choosing, and state the number in the report rather than picking 300 s by analogy. | implementer | no |
| **OQ-3** | **Where does AC-11 live — the new suite, or `run.test.ts`?** It needs no spawn (R-5). `run.test.ts`'s header claims *"Nothing here spawns the binary"*; putting it there keeps that true and keeps the review-flow scenario beside the other `quorum run` claims. Recommendation: `run.test.ts`. | implementer | no |
| **OQ-4** | **Is one new suite file right, or two?** The spine is one long stateful sequence over a shared fixture and must not be split across files — Vitest parallelises *files*, and two files sharing one fixture repository would reproduce Q-0039's collision (two runs on one ticket compute the same run id and share a worktree) inside the test suite. Recommendation: one file, tests sequential by default, the fixture private to it. | implementer | no |
| **OQ-5** | **Should this ticket's close also retire `packages/cli/src/build.test.ts`'s standing as the only spawning file, by rewording AC-15(c)'s citation in the four headers that quote it?** Four files say *"`build.test.ts` is the one file Q-0098 AC-15(c) rules may spawn the emit"*, which stays literally true under §0.5's reading (the new suite spawns a copy, not the emit) but will read as false to the next person. **Recommended: yes, as a one-line clarification in each of the four, not as an erratum** — nothing is being overturned. | **human, at the gate** | **yes, if the answer is "erratum"** |

**OQ-5 is the only blocker, and it blocks a wording rather than the work.** If the human rules that
the four citations must be amended by erratum rather than clarified in place, that is a document an
implement step may not write and the run should not start without it.

---

## 7. Gate obligations — work no step on the chore route may perform

These are named as obligations rather than criteria because of *"A requirement may not name a
surface its flow cannot write"* (2026-08-25) and *"`.claude/rules/` is a derived copy"* (2026-08-27).
Writing them as AC-14b, AC-16 and so on would be the twelfth appearance of a loop handed work no
agent on it can perform — the pattern this cut has now priced with numbers (Q-0091's E-7: two rounds,
$14.28, one of them changing no files at all).

- **GO-1 — The cutover ticket is opened at this child's close, with its body written out in full.**
  The ticket body asks for this in as many words: *"it has no ticket, and it should get one at this
  child's close rather than being remembered."* It cannot be a criterion — `backlog/` is not an
  agent-writable surface and the engine discards an agent's edits under it. The body must carry, at
  minimum: what `spike/test/**` still holds that nothing else does (the eight orphan assertions of
  §0.4 and GO-2's disposition of them), the `spike` CI job, `harness/port-charter.md`, the
  `port-freeze-*` jobs that read the freeze SHA, and `spike-parity.test.ts` itself, which is deleted
  with its subject.
- **GO-2 — A ruling on the eight orphan assertions, and a successor if the ruling is "keep them".**
  Three readings: re-home the role-table and model-pin checks in `packages/shared` or a new
  `harness`-consistency suite; accept their loss at the cutover and say so; or fold them into GO-1's
  body as part of what the cutover deletes deliberately. Whichever it is, it must be *written down*
  before the cutover, because after it there is no record that they existed.
- **GO-3 — The plan's and the ticket body's figures are corrected by hand** (R-6): `781` → `780`, and
  the assertion count restated as *158, of which 76 transfer*. Both surfaces are the human's.

---

## 8. Cross-cutting checklist

| pillar | answer |
| --- | --- |
| **BYOS** | Asserted, not merely unbroken: AC-10 requires the three key variables set and both vendors refused **before** either CLI is probed. No key is introduced on any path; `smoke.js:505`'s key string is a `transientError` fixture and is preserved verbatim. Q-0068's *"Harness"* wording is preserved (non-goal 4). |
| **Safety by construction** | AC-6 is the whole of it, end to end: worktrees under `.harness/worktrees/`, branches beside `harness/<id>/integration`, the user's working tree untouched outside `backlog/`, and the finished run giving back what it obtained. Every fixture is a temporary directory the suite created; nothing writes into this repository. |
| **Human-gated by default** | AC-7. `--auto` does not walk a human-locked exhaustion gate, an unanswered gate is `undecided` and exits 3, and `retry` grants exactly one traversal. |
| **Files are the database** | Every assertion reads the file the binary wrote — `ticket.md`, `runs.log`, the ticket branch — rather than the run's memory. That is what a spawned process makes checkable and an in-process call does not. |
| **Cross-vendor rule** | n/a to the change; AC-11 exercises the shipped `review.yaml`, whose panel spans vendors, through the mock. |
| **Product-agnostic** | n/a. The fixture ticket is *"Subscription downgrade mid-cycle"* — generic demo data, preserved. |
| **Cold-clone test** | Improved, not lengthened. No new dependency, no new command, no new flag. The adopter's first `harness/flows` is the directory this suite proves. |
| **Errors are explicit** | AC-9's two rollback paths and AC-8's failed step are all about a run stopping with a stated reason and a recorded cost. |
| **File format / schema** | Unchanged. No flow, ticket, role or manifest schema moves. |
| **Lint rules** | Unchanged. `harness lint` over the shipped directory is asserted (AC-10), not modified. |
| **Turbo inputs (Q-0072)** | **Owed.** The new suite reads outside its package — at minimum this repository's tracked file list for the isolated copy, and `harness/flows/*.yaml` if the fixture is scaffolded from them rather than from `packages/cli/templates`. `packages/cli/turbo.json` already declares nine `inputs`; anything the new suite opens that is not among them must be added, or a cache hit on `@quorum/cli#test` will claim nothing it reads has changed. Registered here so it is not found by the guard. |
| **Q-0079 (git identity)** | The fixture creates commits. Every commit-creating call supplies `-c user.email` / `-c user.name` explicitly, as `smoke.js` already does at six sites, or the suite's verdict becomes a property of the account. The tripwire sees literals only, so a subcommand held in a variable is invisible to it. |
| **Q-0099's `owner=` finding** | If any translated assertion reads an `owner=` value, the fixture must pass `--owner` explicitly: `Backlog.create` defaults owner to `process.env.USER` (the preserved defect at `backlog.ts:190`), so an assertion that does not supply one takes its verdict from the account. |

---

## 9. Risks

| # | risk | mitigation |
| --- | --- | --- |
| **RK-1** | **The suite is slow enough that people stop running it locally.** One `tsc` build of three packages plus ~14 spawned flow runs with real git worktrees. If it is minutes, it changes the cost of every `pnpm test` in this repository. | Measure first (OQ-2) and report the number. One build per file in a `beforeAll`, not per test. If it is genuinely long, that is a finding for the gate, not something to absorb. |
| **RK-2** | **A translated assertion passes for the wrong reason.** This has already happened once in this exact file — Q-0088's negative assertion went green because nothing was at the old address. Two more shapes are in the file: the `commitAll` block that became a silent no-op when Q-0062 started returning worktrees, and `:459`'s existence guard. | AC-8 requires the two re-aimed assertions demonstrated **red against a deliberately broken binary**. AC-15 requires no block to be skippable-and-green. |
| **RK-3** | **The register move is made and its three guards are deleted rather than inverted**, so the suite goes green over a claim nobody checks. | AC-12, with the Q-0094 precedent quoted: the old expression would have gone on passing while meaning the opposite. |
| **RK-4** | **A second spawning suite meets `build.test.ts` mid-`removeEmit()`** and flakes in a way that reads as a code defect. | AC-3: the suite never touches `packages/cli/dist`. This is the hazard AC-15(c) was written for, and the isolated copy is its own first answer. |
| **RK-5** | **The chore route's implement step cannot run the suite it is writing.** `harness/rules.md`: a step's worktree has no dependencies until it installs them, and `commands.install` runs only in an `integrate` worktree. A suite that builds an isolated copy needs `node_modules` present to symlink. | The implementer runs `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` before either suite, and reports a suite it could not run as **unrun** rather than green. A reviewer cannot tell an uninstalled suite from a red one. |
| **RK-6** | **The reviewer cannot execute anything.** Codex runs `--sandbox read-only`; this has been recorded on five consecutive children, and an approve on reading alone is not evidence for a suite whose whole subject is execution. | Verify at the gate by execution or by mutation, not from the report — the discipline Q-0051, Q-0091, Q-0092, Q-0093 and Q-0099 each wrote for themselves. Against 42 of 59 chore reviews returning `revise`, a first-round approve here should be distrusted. |
| **RK-7** | **Two Vitest files share one fixture repository** and reproduce Q-0039's collision — same run id, same worktree — inside the suite, as an intermittent failure that looks like a product defect. | OQ-4: one file, one private fixture. Q-0039 is a real open ticket and this suite must not be the thing that makes it acute. |
| **RK-8** | **`integrate` reports `tests=ok` from a replay.** The chore run's own verification is subject to Q-0065's and Q-0072's hazard, and this ticket adds a large slow suite whose replay is the most tempting of all. | Verify **forced** in both environment rows per Q-0072's closing finding: in the integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge, where both exist. |
| **RK-9** | **The eight orphan assertions are quietly lost.** Nobody is looking for them; they are inside a file scheduled for deletion, and the only two documents that mention them say *"no suite opens the file"*. | AC-14 records them in the register; GO-2 rules them. This is the mechanism *"deferred criteria need successor bodies"* exists for. |

---

## Appendix A — the 158 assertion sites, classified

Line numbers are `spike/test/smoke.js` at HEAD (780 lines). **Bold** rows are this ticket's.

| block | lines | sites | bucket |
| --- | --- | --- | --- |
| **`init`, `lint`, `ticket new`, first stage, wrong-stage refusal** | 24, 40, 41, 45, 48 | **5** | **binary** |
| **requirements: parallel PMs, backward edge, run-scoped candidates** | 52, 56–59 | **5** | **binary** |
| **solutioning: worktree, revise loop, branch kept, tree untouched, contracts merged** | 64–67, 72, 74, 76, 79, 81, 82 | **10** | **binary** |
| **qa-red: red proven on the ticket branch** | 86–88 | **3** | **binary** |
| **development: two waves, scoped retry, green, install cwd** | 92–96, 98, 99, 104 | **8** | **binary** |
| **exhaustion gate: `--auto` refused, exit 3, nothing rolled back** | 113–115, 118–121 | **7** | **binary** |
| **`board` lists tickets** | 123 | **1** | **binary** |
| **`adapters` refuses three keys before probing** | 130, 131 | **2** | **binary** |
| **failed parallel sibling, cost, run-id uniqueness** | 141, 142, 148–150, 154, 157, 162 | **8** | **binary** |
| auth-failure translation, claude envelope, probe | 170–172, 177, 178, 180, 201, 202, 206 | 9 | library |
| shipped templates pin no `gpt-` model | 216 | 1 | **orphan** |
| **`retry` grants exactly one traversal** | 234, 241, 242, 244, 245 | **5** | **binary** |
| **unanswered non-TTY gate is `undecided`** | 259, 261–263, 265, 267 | **6** | **binary** |
| `lintFlow` convergence | 285, 286, 289, 300 | 4 | library |
| `mergeFailure` | 308–311 | 4 | library |
| **base-sync reporting read off the solutioning run's stdout** | 317–319 | **3** | **binary** |
| `testReport` truncation | 329–332, 335 | 5 | library |
| **abandoned merge rolled back** | 359–361, 363, 365 | **5** | **binary** |
| **base conflict does not loop** | 394–398 | **5** | **binary** |
| **the `commitAll` block's subject: the contracts branch outlives its run** | **418** | **1** | **binary** ¹ |
| `commitAll` refuses backlog edits | 439, 440, 442–446, 448 | 8 | library |
| `harness/architecture.md` role table | 462, 466, 468, 471, 474, 478, 483 | 7 | **orphan** |
| `withRetry` / `transientError` | 501, 510, 526–528, 535, 541 | 7 | library |
| `environmentFailure` | 557, 566, 579, 583 | 4 | library |
| `spike/test/run.js` discovers a new failing file | 595, 599, 600, 603 | 4 | runner ² |
| contract validator | 629, 640 | 2 | library |
| **`validate` exits 0 and 1 from the CLI** | 647, 648 | **2** | **binary** |
| `formatCost` | 655, 657, 658 | 3 | library |
| `resolveModel` | 665–667 | 3 | library |
| `materialiseDiff` empty-range diagnostic | 692, 697, 699–703, 706, 707 | 9 | library |
| `waves` / `scopeToFailing` | 716, 720, 723–726, 729 | 7 | library |
| `syncBaseIntoTicketBranch` | 751, 753, 757, 770, 771 | 5 | library |
| | | **158** | 76 binary · 70 library · 8 orphan · 4 runner |

¹ `:418` is the one assertion that belongs to both halves: the block below it tests `commitAll`
(library, carried by `packages/core/src/fanout/fanout.test.ts`), but its *subject* is a branch only
the binary's solutioning run created. Its translated form largely restates AC-6's `:72`/`:76`
claim; the implementer should say which of the two carries it rather than writing both.

² Carried by `packages/core/src/test-discovery.test.ts`, whose header states the same reasoning:
qa-red proves a red phase by writing new test files, so a runner blind to them reports green while
`integrate --expect fail` loops to a gate having proved nothing.

---

## Appendix B — the three register clauses to invert

All in `packages/core/src/spike-parity.test.ts`.

| site | current expression | what it means today | after |
| --- | --- | --- | --- |
| `:1617`, clause (n) | `expect(REGISTER['q0033-surface.js'].binaryHalf, 'the surface row names no successor for the rest').toMatch(/Q-0095/)` | Q-0095 still owes the review-flow half | the row names **no** successor; the prose says Q-0095 carried it |
| `:1694`, clause (p) | the same assertion, second copy | ditto | ditto |
| `:1714`, clause (p) `adapters` | `expect(REGISTER['smoke.js'].binaryCarriedBy, "smoke.js is still Q-0095's to translate").toBeUndefined()` | the last binary half is owed | it names the new suite |

Each must be **shown red against its superseded value** before the new one is trusted, which is the
demonstration Q-0092, Q-0093, Q-0094 and Q-0099 each wrote for their own move — and each must be
rewritten rather than removed, because a deleted clause and a satisfied one are indistinguishable in
a green run.
