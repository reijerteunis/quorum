# Q-0094 — implement report, chore run 2, iteration 1

`quorum run`, the gate reader and its flags. Fourteen criteria, all met. Three new production
modules, three new test suites, three landed guards re-aimed, one register updated, two documents
corrected.

---

## 1. What shipped, file by file

### New — `packages/cli/src/run.ts` (228 lines)

The command. `runOn(terminal): CommandHandler` and `run = runOn({})`.

- **AC-1** — `USAGE` preserved verbatim from `spike/bin/harness.js:536`, `harness` included; the bare
  `--base` refusal sits beside it and before any project is opened.
- **AC-2** — the preflight in the spike's order: `loadProject` → `lintDirectory` over the whole flow
  directory → `loadFlowByName` → `--adapter` → `backlog.read`. A clean lint prints nothing; a failing
  one prints every record through `lint.ts`'s renderer and `process.exit(ERROR)` with no `✗` line of
  its own, because the spike prints none.
- **AC-9/AC-10** — `exitCodeFor(terminal)` reads `EXIT_CODE_FOR_STATUS`; there is no second table and
  no inline ternary. The interrupted branch exits 130 without `die`; a `FlowError` or an
  `IntegrationError` is one red sentence; anything else is rethrown.
- **AC-11** — one `AbortController`, `process.on('SIGINT'/'SIGTERM')` installed when the run starts
  and removed in a `finally` on every path, aborting with the **string** reasons `received SIGINT` /
  `received SIGTERM` that `interruptionNote` reads.
- **AC-13** — `dry`, `auto`, `base`, `signal`, `answerGate` and the adapter override, with
  `project: project, backlog: project.backlog` rather than the spike's `...proj` spread.

Two exports beyond the handler, and both exist to give a criterion a subject rather than for tidiness:

- `consumeRun(events, reader, verbose)` — the render loop. **Nothing in its body awaits** (R-5), and
  it returns the closing error instead of throwing it, so a caller has the terminal event *and* the
  failure. AC-9(2) is unreachable through `runFlow`, so this is the only way to hand the exit mapping
  a stream that ended without a terminal event.
- `exitCodeFor(terminal)` — the mapping, so the "no terminal event is not success" refusal can be
  observed rather than read.

### New — `packages/cli/src/gate.ts` (234 lines)

`createGateReader({ answers, input, output, isTTY })`, returning `{ answerGate, announce }`.

- **AC-5** — an invocation-local copy of `gateAnswers`, `shift()`ed one per gate, compared exactly
  after `trim().toLowerCase()`; an invalid word throws and the queue does **not** advance past it.
- **AC-6** — `GateUnansweredError` imported from `@quorum/core`, condition `answers-exhausted`,
  message byte for byte, and **stdin is never read** on that path.
- **AC-7** — readline over the injected streams, prefix matching, both refusals, the `stdin-closed`
  rejection with its own distinct sentence, and the handle closed on every path.
- **AC-8** — `{ gateId: question.gateId, answer }`, the question's own id and never a kept one.

### New — `packages/cli/src/trace.ts` (84 lines)

`renderEvent(event, verbose)`. Nine arms, the bytes of `spike/bin/harness.js:63–73`, a `never`
binding in the default arm so a tenth union member is a compile error, and `terminal` printing
nothing.

### Changed

| file | what |
| --- | --- |
| `packages/cli/src/commands.ts` | `run` added to `COMMANDS` and one `HELP` line between `ticket` and `lint`, at the shared description column |
| `packages/cli/src/main.ts` | `run` in `HANDLERS`; the header's command count |
| `packages/cli/src/index.ts` | `gate.js`, `run.js`, `trace.js` re-exported; the header says what the two frame modules are |
| `packages/cli/src/lint.ts` | `render` → **exported** `renderFlowReport`, so the run preflight reuses it (AC-2) |
| `packages/cli/test/invoke.ts` | `invoke` refactored onto a new exported `capture(body)`; the twenty lines stay in one place |
| `packages/cli/src/frame.source.test.ts` | three registers moved — see §3 |
| `packages/cli/src/commands.test.ts` | the registry pin, the column count 6 → 7, and a Q-0094 block |
| `packages/core/src/spike-parity.test.ts` | four rows and three assertions — see §4 |
| `docs/04-architecture.md` | six commands, and where `run`'s division falls |
| `docs/06-development-plan.md` | **one clause corrected** — see §6, please read |

### New test suites — 75 tests

`run.test.ts` (40), `gate.test.ts` (25), `trace.test.ts` (10). The package is 19 files / **420 tests**.

---

## 2. The two design decisions a reviewer should check first

### (a) The banner/prompt split is a rendezvous, not an ordering

`askGate` emits the gate question and calls `answerGate` **synchronously**, before the consumer can
render anything. A reader that simply prompted would put its prompt above the `■ GATE` banner the
loop is about to print. So `answerGate` awaits `bannerFor(question.gateId)`, and the loop calls
`reader.announce(event.gateId)` the moment it has rendered the banner.

The rendezvous keeps a resolver map **and** a set of already-announced ids, so it is correct
whichever arrives first. Pinning it to today's ordering would make a correct engine change look like
a hang.

This is also what keeps R-5 closed: the loop's body awaits nothing at all. The alternative I
considered — the loop reading the answer itself and resolving a parked promise — needs a
"no pending question" branch that cannot be reached or tested, and a Ctrl-C then deadlocks the
consumer at exactly the moment `core` needs it to keep pulling. `gate.test.ts`'s first two tests
assert the ordering over **one buffer** (`console.log` and the reader's output stream routed into the
same array), because two sinks cannot show it.

### (b) AC-11(5) — the Ctrl-C race, closed and mutation-tested

`rl.on('SIGINT')` sets a local flag, closes the handle and re-raises `SIGINT` at the process. The
`close` handler then **suppresses** its own `GateUnansweredError`, leaving the promise pending, so
`askGate`'s abort listener wins the race and `core` classifies `interrupted`.

Shown red before green rather than described: deleting `|| interruptedBySignal` from that one line
makes the end-to-end test report **exit 3** where it must report **130** — R-1 reproduced exactly,
which is a maintainer's deliberate interrupt recorded as *nobody was there*. Restored and re-run
green.

---

## 3. AC-12 — the landed guards, re-aimed rather than deleted

Three moved, not one. The extra one is named in the guard's own prose, so it is not a surprise.

**AC-4(d), clause 1.** *"No file in this package registers a signal handler"* became
`SIGNAL_HANDLER_OWNER = ['src/run.ts']` over the same `packageFiles()` scan with the same
self-exclusion, behind a `signalHandlers(files)` function so each direction fires on a mutated copy:
a second owner fails, **and the pre-Q-0094 tree fails too** (no offender → the register unsatisfied).
A blanket `src/**` exemption is refused in the register's own comment.

**AC-4(d), clause 2** is untouched and gained a second meaning — it is now what fails if a
registration moves to module scope (AC-11(1)) — stated in the block so a later reader does not delete
it as redundant, and **demonstrated firing** over a listener the test adds and removes.

**AC-11's IO clause, split.** `node:readline` left `IO_MODULE` and became `TERMINAL_IO` with a
`TERMINAL_OWNER` register naming `gate.ts`. The clause's own comment has said since Q-0090 that this
would need *"splitting again rather than deleting"*. Both directions fire, and the split is shown red
against the regex it replaced: the pre-Q-0094 list matched `gate.ts`'s import and the new one does
not, while all five other specifiers are still refused.

**`COMMAND_DOMAIN`** gains `run.ts`: `['runFlow', 'loadFlowByName', 'lintDirectory', 'loadProject',
'overrideAdapters']`. `DOMAIN` itself does not grow — every symbol was already on it, and the three
error classes are not domain helpers. The partition list, the `FRAME_ONLY_IO` list and the
`commands.test.ts` pins each gained their entry **and** a negative refusing the value it replaced.

---

## 4. AC-14 — the parity register

- `q0040-undecided.js` — first `binaryCarriedBy` (`gate.test.ts`, `run.test.ts`); prose rewritten to
  say which of the five sites each file carries and that `:368–411` is **not** claimed, being
  `harness validate`'s and Q-0091's (§0(c)).
- `q0077-base-flag.js` — first `binaryCarriedBy` (`run.test.ts`); prose says nothing is owed.
- `q0034-review-fixes.js` — `run.test.ts` added; the *"What remains is B3 — Q-0094"* clause replaced
  with what was carried, and why B3 contributed no CLI lines to translate.
- `q0033-surface.js` — `gate.test.ts` and `run.test.ts` added (four suites now); the
  *"What remains is the gate answers a terminal supplies — Q-0094"* clause replaced, and the row now
  names **Q-0095 and Q-0099** as owing the rest.

Three assertions moved with them:

- `(l)`'s `toHaveLength(2)` became an `arrayContaining` of Q-0093's own two files. A length would have
  passed at four whether or not Q-0093's pair was still there.
- `(l)`'s `.toMatch(/Q-0094/)` is the one AC-14(4) names. It **would have gone on passing** — the row
  now says *"carried since Q-0094"* — so it was moved rather than left: it is now
  `not.toMatch(/— Q-0094\b/)` plus a positive on Q-0095, with the reason in place.
- New `(n)` — the identity of every claiming row, shown red against the five it held before; and
  `run.test.ts` carrying the binary half of **four** spike files, which is Q-0092's three-file
  property one wider.
- New `(o)` — the five line totals **re-derived** and unmoved (220 / 2739 / 2469 / 5428, share 55%).
  Nothing under `spike/` was written; four of its files were read.

---

## 5. Verification — by execution, not from a report

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck build --force` | **24/24 tasks, 0 cached** |
| `packages/cli` suite | 19 files, **420 tests** |
| `npm test --prefix spike` | **19/19 files** |
| `node spike/bin/harness.js lint` | **6/6** |
| `pnpm sweep:git-identity` | green, both suites, both checkout shapes |

**And through the emitted binary** (`packages/cli/dist/quorum.js`, after `turbo run build`), against
a throwaway project scaffolded by `quorum init` + `quorum ticket new`:

| invocation | exit | what it printed |
| --- | --- | --- |
| `run` (no args) | 1 | `✗ usage: harness run <flow> <ticket> …` |
| `run review T-9 --base` | 1 | `✗ --base needs a revision: …` |
| `run requirements T-0001 --adapter mock` | **3** | banner, then `needs an answer and stdin closed without one — pass --gate-answer` |
| the same with `advance` piped on stdin | **3** | identical — stdin is not read |
| `--gate-answer advance` | 0 | `advance / abort > advance  (from --gate-answer)`, stage → `requirements` |
| `--gate-answer abort` | **2** | |
| `--gate-answer ad` | 1 | `expected exactly one of: advance / abort (no abbreviations)` |
| `--gate-answer undecided` | 1 | same refusal |
| `--auto` against a failing loop | **3** | `loop exhausted … → human gate`, never `auto-advanced (human-locked)` |
| `--dry` | 0 | `gate (human): would pause here`, no banner, no `runs.log` |
| `--gate-answer advance --gate-answer abort` | 2 | `gate=human-locked answer=advance` then `gate=human answer=abort` in `runs.log` |

The banner appears above the echo in every real run; `runs.log` carries the `undecided-gate … 
rollback=none` line and the `interrupted … error="received SIGINT"` line.

The three sites that need a terminal are not reachable through a spawned binary without a pty; they
are asserted in `gate.test.ts` over the injected streams, which is what AC-7 authorises, and
end to end through `runOn({ … })` for the exit codes.

---

## 6. Reported and not fixed — please read

**(a) The plan's gate-site arithmetic, corrected in `docs/06-development-plan.md`.** This is the one
edit outside the criteria and I want it seen rather than found. The Q-0094 bullet said the five throw
sites include *"three meaning nobody was there"* — three plus five against a stated total of five,
which cannot hold. Measured: **two** are `GateUnansweredError` in this package and three are operator
errors; the third condition, `no-answer-channel`, is `core`'s at `routing.ts:26–28` and is unreachable
from a CLI that always supplies an `answerGate`. `spike-parity.test.ts:249` has carried the correct
split since Q-0040. I corrected that clause only and left the rest of the bullet — which is the
human's to rewrite at the close — alone. Strike it if you would rather it waited.

**(b) The `DOMAIN` scan reads raw text, so a frame module may not even *mention* a domain symbol.**
`gate.ts` and `trace.ts` were flagged for the word `runFlow` **in a JSDoc sentence**. The guard is
deliberately text-based, and `resolvesOwnLocation` next door reads `codeOf()` for the opposite
reason. I reworded the two comments rather than weakening `domainOffenders`: no criterion authorises
that change, R-3 warns about exactly this reflex, and the rule survives intact. It is a real rough
edge in the guard and it is registered here, not repaired.

**(c) `--project` at a directory that is not a project prints a stack, not a sentence.**
`loadProject(dir)` resolves an explicit directory and reads, so `ProjectNotFoundError` is raised only
on the *discovery* path. A non-project directory raises `ENOENT`, which reaches `dieOnUnexpected`.
Preserved — `spike/bin/harness.js:53–55` behaves identically — and the AC-2(1) test reaches the
sentence the way the spike does, from a working directory with no project above it.

**(d) A pre-existing ESLint warning**, untouched by this change:
`packages/core/src/backlog/backlog.ts:276  warning  Unused eslint-disable directive`.

**(e) The mock adapter emits no `spawn` and no `retry`** (`mock.ts:105` emits `stdout` alone), so
AC-3's clause that `--verbose` does not gate those two cannot be shown end to end. It is asserted in
`trace.test.ts` over the renderer, with both `verbose` values, and `run.test.ts` says in place that
without that companion its own pair would be satisfied by a renderer dropping all three.

**(f) Q-0059, Q-0060, Q-0066, Q-0068 were not met and are not closed.** Q-0100 **is** met and is
registered rather than fixed: the usage line says `harness`, pinned in both directions so a rename is
a deliberate act, matching `validate.ts:62` and `ticket.ts:68`.

---

## 7. Coverage, criterion by criterion

| | covered by | notes |
| --- | --- | --- |
| AC-1 | `run.test.ts` ×3 | verbatim usage, the Q-0100 pin, B5 |
| AC-2 | `run.test.ts` ×4 | clean lint silent; the shared renderer producing the *identical block* as `quorum lint`; the panel fixture for ordering; no project |
| AC-3 | `trace.test.ts` ×7, `run.test.ts` ×2 | all nine kinds, exhaustiveness derived from the schema, the `run #N` line counted at exactly one |
| AC-4 | `gate.test.ts` ×2, `run.test.ts` ×1 | ordering over one buffer, order-independence, no banner under `--dry`/`--auto` |
| AC-5 | `run.test.ts` ×7, `gate.test.ts` ×5 | including AC-5(4) asserted twice — the same reader asked again, and the run failing rather than aborting |
| AC-6 | `run.test.ts` ×2, `gate.test.ts` ×4 | AC-6(2)'s type-vs-text pair driven through `runFlow` |
| AC-7 | `gate.test.ts` ×10 | **S10.5 written for the first time**; handle-closure asserted by input-listener count |
| AC-8 | `gate.test.ts` ×2 | the envelope, and both `routing.ts` failures shown happening to a wrong reader and not to this one |
| AC-9 | `run.test.ts` ×5 | all six statuses; `completed`, `aborted`, `undecided`, `failed`, `regressed` and `interrupted` each reached by a real run |
| AC-10 | `run.test.ts` ×3 | stage mismatch (one line, no stack, no terminal event); a gate refusal; the unknown adapter's stack over a single-step flow, because a `parallel:` group wraps it into a `FlowError` |
| AC-11 | `run.test.ts` ×2, `gate.test.ts` ×2 | counted before/during/after — the *during* sample is what stops the count passing over a run that installed neither |
| AC-12 | `frame.source.test.ts` ×5 | both clauses shown red |
| AC-13 | `run.test.ts` ×8 | including B7 **and** its counterpart, the same unresolvable value blamed on the configuration file with no flag |
| AC-14 | `spike-parity.test.ts` ×3 | rows, identities, totals |

Ground rules: nothing under `spike/` or `backlog/` was written — `git status` shows ten modified and
six new files, none under either. No decision entry is owed; none was needed, and nothing in the
implementation raised one.
