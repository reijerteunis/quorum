# Q-0094 — `quorum run`, the gate reader and its flags

*Merged requirement, run 1, iteration 1, 2026-09-04. Written against the tree. Every line number,
line count and register claim below was re-derived today; §0 records the four places the ticket body
disagrees with what is on disk, and §9 records which candidate contributed what.*

---

## 0. What was measured, and where the ticket body is wrong

The body is the human's and an agent's edits under `backlog/` are discarded, so these are stated for
the gate to apply rather than corrected in place. All four were re-verified at this gate against the
files themselves, not relayed from either candidate.

**(a) The gate-site arithmetic cannot hold as written.** The body says *"the five throw sites that
Q-0040 classified … Three of them mean nobody was there … the other five are operator errors"* —
three plus five against a stated total of five. Measured in `spike/bin/harness.js`'s `ui.gate`
(`:74–121`) there are **five** sites, of which one is a `reject` rather than a `throw`:

| site | line | what it is | class | run status | exit |
| --- | --- | --- | --- | --- | --- |
| 1 | `:86` | `--gate-answer` is not an allowed word for *this* gate | `FlowError` | `failed` | 1 |
| 2 | `:97` | answers exhausted and stdin is not a terminal | `GateUnansweredError` (`answers-exhausted`) | `undecided` | 3 |
| 3 | `:111` | stdin closed while the question was open (a `reject`) | `GateUnansweredError` (`stdin-closed`) | `undecided` | 3 |
| 4 | `:116` | an empty answer on a terminal | `FlowError` | `failed` | 1 |
| 5 | `:120` | an answer the reader does not understand | `FlowError` | `failed` | 1 |

So it is **two** undecided sites and **three** operator errors *in this package*. The third
`GateUnansweredCondition` — `no-answer-channel` — is `core`'s, at
`packages/core/src/engine/routing.ts:26–28`, already ported and unreachable from this CLI, which
always supplies an `answerGate`. That is where the body's "three" came from: it is right about the
product and wrong about this ticket. `packages/core/src/spike-parity.test.ts:249` already states the
correct split — *"the two where no answer was available exit 3, the three operator errors exit 1"* —
so the register and the ticket body have disagreed since the ticket was written, and the register is
the one that is right.

**(b) The inherited-coverage figure is wrong in shape, not only in arithmetic.** This is the fifth
consecutive child of Q-0010 to carry a bad one, and the plan asks that it be re-derived at the gate
rather than treated as a target. The body names two files — `q0077-base-flag.js` *(195)* and
`q0034-review-fixes.js` *(158)*, *"353 lines"*. Measured with `wc -l`: **194** and **157**. Neither
number is what transfers, and the two files named are the two *smallest* contributors; the body omits
the two that carry most of the work:

| file | whole file | the half that is **this ticket's** | measured |
| --- | --- | --- | --- |
| `q0040-undecided.js` | 413 | `cliFixture` at `:276` through the last CLI scenario ending before `:368` — the five gate sites with their exit codes, exit 3 as its own code, and `--gate-answer undecided` refused | **≈96** |
| `q0033-surface.js` | 476 | `:284–329` (S10.1–S10.7 / E3 / E4, plus the skipped `S10.5`) and `:445–451` (E7) | **≈53** |
| `q0077-base-flag.js` | 194 | `:111–125` (B5) and `:164–192` (B7) | **≈44** |
| `q0034-review-fixes.js` | 157 | B3's binary claim — the exit code and message a `FlowError` is routed to. No CLI lines exist to translate; it is one new assertion | **0** |
| | **1,240** | | **≈193** |

The parity register routes both omitted files here already: `:249` is `q0040-undecided.js`'s *"five
gate sites … Q-0010"*, and `q0033-surface.js`'s `binaryHalf` ends *"What remains is the gate answers
a terminal supplies — **Q-0094**"*, which `spike-parity.test.ts:1594` asserts by name. The body's
two-file list does not simplify the register; it contradicts it.

**(c) `q0040-undecided.js:368–411` is *not* this ticket's**, and is excluded above deliberately: those
two scenarios read the frozen `run-manifest.schema.json` enums and drive `harness validate`, whose
binary half `packages/cli/src/validate.test.ts` has carried since Q-0091. Claiming them would read as
more done than was done — Q-0092's rule, and the same reason Q-0080's row went without a
`binaryCarriedBy` until Q-0093.

**(d) The body's "35 lines in the switch" is right and misleading.** `spike/bin/harness.js:534–568`
is 35 lines and the gate reader beneath it is `:63–124`. But the real size is neither: because
`runFlow` is now an `AsyncIterable<Event>` (`packages/core/src/engine/engine.ts:390`), **the whole of
the `ui` object becomes this package's code** rather than an object handed to the engine, and two
things the spike kept in `spike/src/engine.js` move here as well — the exit code (`process.exit(130)`
at `:111`) and the signal handler (`:113–114`). This is the first command child of Q-0010 whose
subject grew when it was measured.

---

## 1. Problem

`quorum` can lint, validate, list run history, scaffold a project and create a ticket. It cannot
**run a flow** — the one thing the product exists to do. `packages/cli/src/main.ts` says so in as many
words, and `COMMANDS` has six entries where the spike has eight cases.

Three things make this command different from its five siblings, and each is a reason it was cut
last:

1. **It consumes a stream rather than calling a function.** Q-0050's one authorised behaviour change
   made `runFlow` return a lazy, single-consumer `AsyncIterable<Event>`. The spike handed the engine
   a `ui` object and got a result back; this CLI must render nine event kinds itself and read the
   run's outcome off the final `terminal` event. Nothing in `packages/cli` renders an event today.
2. **It owns the interactive gate.** A gate is where the human sits, and the reader — the readline
   handle, the TTY test, the five sites in §0(a) — is the last piece of the spike CLI with real
   behaviour in it rather than formatting.
3. **It owns the signal handler.** `core` installs none (Q-0050 AC-5), and `packages/cli/src/exit.ts`
   already carries `SIGNAL = 130` as *"a row of this table and nothing more … the handler that
   produces this code is Q-0094's to place."* `frame.source.test.ts:605` currently asserts that **no
   file in this package registers one**. That guard is correct today, and this ticket is what
   falsifies it.

Until this lands, `pnpm exec quorum` is a tool that can inspect a project and never move one, the
cold-clone path stops at `quorum init`, and Q-0095 — M2's done-when — has no binary to point its mock
end-to-end suite at.

## 2. User stories

- **maintainer (scripted)** — I run `quorum run chore Q-0094 --adapter mock --gate-answer advance` in
  a script and, from the exit code alone, I can tell "it worked" (0) from "I stopped it" (2) from
  "nobody was there to answer" (3) from "it failed" (1) from "I hit Ctrl-C" (130), without parsing
  output.
- **maintainer (interactive)** — I run a flow at a terminal, watch each step, and when the gate
  arrives I am asked a question that names the ticket folder I should go and look at, and I answer it
  in one word.
- **adopter** — my very first run reaches a gate with nothing on stdin. It does not hang, does not
  invent an answer, and does not roll back the branch it just proved: it tells me exactly which flag
  to pass or to run it in a terminal, and exits with a code that is not shared with a crash.
- **adapter contributor** — the run command passes adapter selection into the existing core API and
  renders the shared event contract with no vendor-specific branch, so a new adapter needs no change
  here.
- **contributor** — I read one module to learn how an event becomes a line on a terminal, and the
  vendor never appears in it, because nothing above the adapter layer knows which one produced an
  event.

## 3. What already exists, measured

**Ground rule 4 holds, and — unlike Q-0092 — nothing is owed on the barrel.** Every *runtime* symbol
this command needs is exported from `packages/core/src/index.ts` today, checked by name:
`loadProject` and `ProjectNotFoundError` (`:46`), `lintDirectory` and `FlowError` (`:55`),
`loadFlowByName` (`:51`), `overrideAdapters` (`:44`), `runFlow` (`:50`), `GateUnansweredError`
(`:52`), `IntegrationError` (`:53`), `Backlog` (`:45`). The event union comes from `@quorum/shared`,
which this package already imports.

**No type export is owed either, and this is stated so nobody opens a core change for it.**
`RunFlowOptions` (`engine/types.ts:81`) and `Project` (`backlog/project.ts:40`) are **not** in the
barrel. Neither needs to be: the options object is a literal checked structurally against
`runFlow`'s own parameter type, and `Project` and `TicketRecord` arrive by inference from
`loadProject()` and `backlog.read()`. Widening the barrel would move the surface `package.test.ts`
counts for no gain. This is Q-0092's lesson run in the opposite direction — check reachability, and
say plainly when the answer is *nothing is owed*.

**One shape mismatch the spike's spread hides.** The spike calls `runFlow({ flow, ticket, ...proj,
ui, … })`, where `proj` is `{ repoDir, harnessDir, config, backlog }`. `RunFlowOptions` wants
`project` and `backlog` as **two named fields**, so the port is `project: proj, backlog:
proj.backlog` and not a spread.

**The frame is ready and its shape decides several criteria below.** `EXIT_CODE_FOR_STATUS`
(`exit.ts:57`) is already keyed on `RunTerminalEvent['status']` and already carries all six statuses,
including `regressed: SUCCESS` as a registered preserved defect. `argv.ts` already accumulates
`--gate-answer` and last-wins everything else. `fail.ts` already separates `die` from `failSoftly`
and owns `dieOnUnexpected`. `test/invoke.ts` already runs a command line in process through `main`
over owned streams.

**Three landed guards constrain the design, and one of them must move.**

- `frame.source.test.ts:605` — *"AC-4(d) — 130 is a row of the table and nothing installs a handler
  for it"*, two clauses: a scan of every **package** file (not `src/**`) except the guard itself for
  `process\.(on|once|addListener)\s*\(\s*['"]SIG`, and a runtime count showing that importing
  `./index.js` adds no listener. **Clause 1 is what this ticket falsifies.**
- `frame.source.test.ts:317` — `COMMAND_DOMAIN`, which fails both ways: a command module naming a
  `DOMAIN` symbol its row does not permit, *and* a row permitting a symbol its module does not name.
  Measured: `DOMAIN` **already carries** `runFlow`, `loadFlowByName`, `lintDirectory`, `loadProject`,
  `overrideAdapters` and `Backlog`, so the list does not grow — only a `run.ts` row is added. The
  error classes (`FlowError`, `GateUnansweredError`, `IntegrationError`, `ProjectNotFoundError`) are
  **not** `DOMAIN` symbols, which is what makes OQ-1's answer safe.
- `frame.source.test.ts:583` — the lint-message flattening lives in `core` and may not be copied into
  a command module; the scan looks for the two literals `\^-\+` and `invalid:\$`.

**The channel already guarantees the ordering the exit mapping depends on**
(`packages/core/src/engine/channel.ts`): whatever is queued is drained first, *"which is what lets a
terminal event be observed before the failure it reports is thrown"*. So a failed run delivers its
`terminal` event **and then** throws, and both are available.

**`core` already prints the run's own summary line.** `lifecycle.ts:155` emits an `info` reading
`run #N <status>: <before> → <after>   cost $X  tokens Y` immediately **before** it emits the
`terminal` event. That is why AC-3 makes `terminal` print nothing.

---

## 4. Acceptance criteria

Fourteen, each independently testable, each naming its surface. Surface is **CLI** throughout, plus
`packages/core/src/spike-parity.test.ts` in AC-14.

### AC-1 — the frame dispatches `run`, and its two argument refusals are the spike's

**CLI.** `run` is added to `COMMANDS`, to `HANDLERS`, to `HELP`, and re-exported from `index.ts`. Its
`HELP` line is placed **between `ticket` and `lint`**, because `commands.ts` fixes the rule — the
spike header's own order, where `run` is `:6` and `lint` is `:7`. `commands.test.ts`'s derivation of
names out of `HELP` covers the registration without a new assertion.

1. `quorum run` with no flow, or with a flow and no ticket, calls `die` with **verbatim**
   `usage: harness run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock] [--verbose] [--gate-answer advance|retry|abort]`
   and exits 1. The string keeps `harness`, because it is preserved spike text and both landed
   siblings keep theirs — `validate.ts:62` and `ticket.ts:68`. Q-0100 owns the class; this is its
   **fifth** instance, after the three in that ticket's body and Q-0093's `init` next-steps line. Do
   not fix it here (ground rule 3), and do not spell it `quorum`, which would make this command
   disagree with its two neighbours.
2. `--base` with no value (`FlagValue === true`) calls `die` with
   `--base needs a revision: harness run <flow> <ticket> --base <ref>` and exits 1, **before any
   project is loaded** — `spike/bin/harness.js:539` sits beside the other argument validation for
   exactly that reason, and `q0077-base-flag.js` B5 asserts both the refusal and that the usage line
   names the flag.
3. The handler reads `cmd`, `rest`, `flags` and `gateAnswers` off the `ParsedArgv` it is given and
   calls no parser of its own (Q-0091 AC-2, enforced by `frame.source.test.ts:563`).

### AC-2 — the preflight runs in the spike's order, and the lint report is silent when it passes

**CLI.** `spike/bin/harness.js:540–547`, in this order and no other:

1. `loadProject(flags.project)`. A `ProjectNotFoundError` is caught and its message passed to `die`
   — as `lint.ts` does it, for the same reason: uncaught it reaches `dieOnUnexpected` and prints a
   Node stack where the spike prints a sentence.
2. `lintDirectory(path.join(harnessDir, 'flows'))` over the **whole directory**. When it passes,
   **nothing is printed** — a difference from `quorum lint`, which prints a line per file. When it
   fails, every record is printed and the process exits 1 **hard** (`die`-class, not `failSoftly`).
3. `loadFlowByName(flowName, harnessDir)`.
4. Only then, `--adapter`. The lint **must** run before the override: a directory declaring a
   legitimate cross-vendor panel must not appear single-vendor because execution later points every
   step at one adapter (Q-0033). A test that reorders these two and still passes has not tested this
   criterion, and the ordering is asserted rather than assumed.
5. `backlog.read(ticketId)`.

Per-record rendering is the marker, the colour and the two-space indent and nothing else;
`flattenProblems` has already done the splitting in `core`, and a second copy fails
`frame.source.test.ts:583`. **Reuse rather than re-spell**: `lint.ts`'s `render` is module-private
today, so it is either exported or moved to a module both import. Whichever is chosen, a copy of the
two regexes in the run module fails a landed guard.

### AC-3 — one renderer turns an `Event` into the spike's bytes, and `--verbose` gates exactly one kind

**CLI.** A single function from `Event` to terminal output, reproducing `spike/bin/harness.js:63–73`
exactly. All nine kinds are handled and the function is **exhaustive over the union**, so a tenth
member added to `@quorum/shared` fails to compile here:

| event | output | notes |
| --- | --- | --- |
| `info` | `dim('·') + ' ' + message` | `console.log` |
| `warn` | `amber('!') + ' ' + message` | `console.log`, **not** stderr — preserved |
| `step` | `teal('▸') + ' ' + bold(stepId) + ' ' + dim(message)` | |
| `done` | `green('✓') + ' ' + bold(stepId) + ' ' + dim(message)` | |
| `stdout` | `dim('  [' + stepId + '] ' + line.slice(0, 160))` | **only when `--verbose`** |
| `spawn` | `dim('  [' + stepId + '] $ ' + cmd)` | always |
| `retry` | `amber('↻') + ' ' + stepId + ': ' + reason + ' — attempt ' + attempt + '/' + of + ' failed, retrying in ' + Math.round(delayMs / 1000) + 's' + dim('\n    ' + message)` | always: *"a run that goes quiet for 30s should say why"* |
| `gate` | AC-4 | |
| `terminal` | **nothing** | |

`terminal` printing nothing is the criterion, not an omission: `core` already emits the human line as
an `info` (`lifecycle.ts:155`), so a renderer that also formats the `terminal` event prints the run's
outcome twice. Its only consumers are AC-9's exit mapping and AC-10(4). Asserted by counting: the
lines matching `run #\d+ \w+:` are exactly one.

`--verbose` is read once and gates `stdout` alone. A test asserting that a quiet run shows no
`stdout` lines must also assert that `spawn` and `retry` still appear, or it is satisfied by a
renderer that drops all three.

### AC-4 — the gate banner is printed from the event, and the reader prints only the answer

**CLI.** The spike's `ui.gate` printed the banner and read the answer in one function. Under an event
stream these are two moments and the split must be exact, or the banner is printed twice or not at
all:

1. On a `gate` event the renderer prints, verbatim:
   `'\n' + amber('■ GATE') + ' (' + kind + ') ' + reason`, then `dim('  inspect: ' + ticketDir)`.
2. The gate reader (AC-5–AC-7) prints **only** the echo line or the prompt, never the banner.
3. Under `--auto` and under `--dry` **no banner appears**, because `askGate`
   (`routing.ts:14–21`) returns before `context.emit(request)` in both cases. The `info` lines it
   emits instead — `gate: auto-advanced (<kind>)` and `gate (<kind>): would pause here` — are
   rendered by AC-3's `info` row and need no special case. A test must show a `--dry` run producing
   neither `■ GATE` nor a prompt.

### AC-5 — `--gate-answer` is a queue: in order, exact, once each, invocation-local, and leftovers are silent

**CLI.** `spike/bin/harness.js:82–90`.

1. The reader holds an **invocation-local mutable copy** of `ParsedArgv.gateAnswers` and `shift()`s
   one per gate. The parsed array itself is not mutated, so consumption cannot leak between two
   invocations in one process — which is what the in-process fixture makes reachable and the spike's
   spawned binary never could.
2. Answers are consumed in command-line order across gates, never matched to gates by kind.
   `q0033-surface.js` S10.1/S10.2: `--gate-answer advance --gate-answer abort` against a failing
   requirements run yields `gate=human-locked answer=advance` then `gate=human answer=abort` in
   `runs.log`, and the run ends `aborted`.
3. The answer is compared **exactly** after `trim().toLowerCase()`, against
   `['advance','retry','abort']` when the question carries `retry` and `['advance','abort']` when it
   does not. **No abbreviation**: `--gate-answer ad` is refused (S10.3), which is the asymmetry with
   AC-7 and is deliberate.
4. **An answer that is invalid for *this* gate is an error, not a skip**: the queue does not advance
   past it and the following queued answer is not consumed in its place. Stated as its own claim
   because a reader that fell through would satisfy every message assertion in (5) while silently
   answering a gate with a word meant for the next one.
5. A refusal is a `FlowError` reading
   `gate (<kind>) "<reason>" received --gate-answer "<raw>" — expected exactly one of: <opts> (no abbreviations)`,
   where `<opts>` is `advance / retry / abort` or `advance / abort`. A **valueless** `--gate-answer`
   is the boolean `true`, which normalises to `''`, fails the membership test, and is reported with
   `String(raw)` — so the message names `true`. Preserved, and pinned as its own row.
6. An accepted answer echoes `dim('  ' + opts + ' > ' + answer + '  (from --gate-answer)')`.
7. Unconsumed answers are **ignored without comment**: `q0033-surface.js` E7 asserts the output
   matches none of `/unused|unconsumed|leftover/i` and the run still exits 0.
8. `--gate-answer undecided` is refused by (5): `undecided` is a run status and never a gate answer
   (`q0040-undecided.js:358–366`, exit 1).

### AC-6 — answers exhausted with no terminal is `undecided`, not a failure, and the class is proven by type

**CLI.** `spike/bin/harness.js:96–98`. When the queue is empty and stdin is not a terminal, the reader
throws `GateUnansweredError` — **imported from `@quorum/core`**, because the engine classifies on
`instanceof` and a locally declared class of the same name would be classified `failed` — with
`condition: 'answers-exhausted'` and the message, verbatim:

```
gate (<kind>) "<reason>" needs an answer and stdin closed without one — pass --gate-answer <advance|retry|abort or advance|abort> (repeatable, consumed in order), or run interactively
```

1. Observable end to end: the run ends `undecided`, **the process exits 3**, the ticket's stage does
   not move, the branch is not rolled back, every worktree is kept, and the output carries
   `nothing was rolled back` and `run #1 undecided` (`q0040-undecided.js:345–356`). Nothing in this
   package computes any of that — it is `core`'s, at `engine.ts:363–366` — and the criterion is that
   the CLI's error **reaches** it: a reader that catches its own throw, or wraps it, produces a
   `failed` run and a rollback while every message assertion still passes.
2. **The classification is by type and the test must say so**, translating
   `q0040-undecided.js:254–269`: a `GateUnansweredError` carrying an **empty message** is still
   `undecided`, and the verbatim words of (1) thrown as a plain `FlowError` are still `failed`. A
   suite that only asserts sentences is satisfied by a message-text classifier, which is the defect
   this pair exists to make unreachable.
3. `stdin` is **not read** on this path: the reader does not fall back to whatever happens to be
   piped. `q0033-surface.js` S10.4 pipes `advance\n` and still expects the refusal.

### AC-7 — the interactive reader: readline, abbreviations, and a handle that always closes

**CLI.** `spike/bin/harness.js:99–120`, reachable only when stdin is a terminal.

1. A `readline` interface over the reader's input and output streams; the prompt is
   `'  ' + opts + ' > '`.
2. `rl.on('SIGINT')` closes the handle and **re-raises** `SIGINT` at this process, because readline
   swallows Ctrl-C on a TTY and the handler AC-11 installs would otherwise never run.
3. The answer is matched by **prefix**, unlike AC-5: `startsWith('ad')` → `advance`;
   `startsWith('r')` → `retry`, *only when the question offers one*; `startsWith('ab')` → `abort`.
4. An empty answer is a `FlowError`:
   `gate (<kind>) "<reason>" was given an empty answer — say advance, retry or abort; a gate is never assumed`.
5. Anything else is a `FlowError`:
   `gate (<kind>) "<reason>" did not understand "<typed>" — expected <opts>`, where `<typed>` is the
   trimmed input **before** lower-casing.
6. stdin closing while the question is open rejects with `GateUnansweredError`,
   `condition: 'stdin-closed'`, message
   `gate (<kind>) "<reason>" needs an answer and stdin closed without one — run it interactively, or answer it on stdin`
   — a different sentence from AC-6's, and the two must stay different, because which one a
   maintainer reads is what tells them whether to pass a flag or open a terminal.
7. The handle is closed on every path, including both refusals, and is not leaked across gates or
   past the end of the run.

**All five sites of §0(a) must be reachable from the workspace suite.** The spike reached three of
them only by spawning the binary under a one-line `--import` preload that sets `process.stdin.isTTY`
(`q0040-undecided.js:8–13, 282–305`), and `packages/cli` may not take that route: `build.test.ts` is
the one file Q-0098 AC-15(c) rules may spawn the emit, and requiring a build to test a gate would
make this suite's verdict a property of whether `dist/` exists — the defect Q-0096's round 2 retired
an assertion for. **The reader therefore takes its input stream, its output stream and its TTY
predicate as parameters**, defaulting to `process.stdin`, `process.stdout` and
`() => Boolean(process.stdin.isTTY)`. That is a shape change and not a behaviour change — the port
charter says the spike's module boundary is not the one to reproduce, and `test/invoke.ts` already
made the same move for `console` with the same reasoning. A test that asserts a site by mutating the
real `process.stdin` inside a Vitest worker is refused. **`q0033-surface.js`'s `S10.5`, skipped in the
spike for want of a TTY, is written for the first time here.**

### AC-8 — the answer travels back as a correlated envelope

**CLI.** `answerGate` returns `{ gateId: question.gateId, answer }` — the envelope
`routing.ts:41–47` validates. Two failures are one line apart and both must be shown not to happen:
returning the bare word fails `gateAnswerEnvelopeSchema.safeParse` and every gate becomes
`gate <id> (<kind>: <reason>) received an invalid answer`; returning a stale or synthesised `gateId`
fails the correlation check with `received stale answer for <id>`. Both are `FlowError`s, so both
would present as an operator error the operator did not make. This is the one place where the spike's
interface and `core`'s differ in kind rather than in shape, and it has no counterpart to preserve.

### AC-9 — the exit code is read off the terminal event through the table that already exists

**CLI.** The handler records the last `terminal` event it saw and exits with
`EXIT_CODE_FOR_STATUS[status]` (`exit.ts:57`). No second table, no inline ternary — the spike's
`process.exit(r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0)` is what that table was
extracted from and must not be re-spelled. Demonstrated for all six statuses:

| status | code | reached by |
| --- | --- | --- |
| `completed` | 0 | a passing run answered `advance` |
| `regressed` | 0 | a backward edge to another flow — **preserved defect**, Q-0090 AC-4(c) |
| `aborted` | 2 | `--gate-answer abort` |
| `undecided` | 3 | AC-6 |
| `failed` | 1 | AC-5's refusal, AC-7's two refusals |
| `interrupted` | 130 | AC-11 |

Two further clauses:

1. A test asserting only that a failure is "non-zero" does not satisfy this criterion: 1, 2 and 3 are
   the distinction the ticket exists to preserve.
2. **A terminal event is required, never inferred.** An iteration that ends without one is not
   success: the handler must not exit 0 because the iterable merely finished. Stated as a claim
   because the failure mode is a silent false green, and the channel's drain-then-throw contract is
   what makes it detectable rather than a race.

### AC-10 — error routing: one sentence for a `FlowError`, a stack for anything else

**CLI.** `spike/bin/harness.js:559`.

1. A `FlowError` or an `IntegrationError` escaping the stream is passed to `die` as its `message` —
   one red sentence on stderr, exit 1, **no stack**. This is `q0034-review-fixes.js` B3's binary half:
   the file proves `runFlow` rejects with a `FlowError` naming the colliding run directory and
   carrying no `EEXIST`; what is owed here is that the terminal shows that sentence and nothing else.
2. Anything else is rethrown, so `main().catch(dieOnUnexpected)` prints its stack. A bad `--adapter`
   name is the reachable example: `getAdapter` throws a plain `Error`, so the spike prints a stack
   for it. Preserved.
3. A failure raised **before** any terminal event — the stage mismatch at `engine.ts:189–191`, thrown
   before the run's `try` — still reaches (1). The handler must not require a terminal event to have
   arrived, which is the other side of AC-9(2) and is why the two are separate claims.
4. When the terminal status is `interrupted`, the throw that follows it is **not** passed to `die`:
   the process exits 130 having printed only the run's own line. The spike prints no `✗` on this path
   because `process.exit(130)` fires inside its signal handler before the throw propagates
   (`spike/src/engine.js:106–114`), and a port that dies here adds a line the spike never printed.

### AC-11 — the signal handler is this package's, installed per run, and Ctrl-C is never `undecided`

**CLI.** `core` installs none (`types.ts`, Q-0050 AC-5), so this is the only place it can be.

1. The handler is installed **when a run starts and removed when it ends**, on every path — return,
   throw, or failure to start — and never at module scope. Registering at import would leak a
   listener into every process that loads the frame and would break AC-12(2). **Repeated in-process
   invocations do not accumulate listeners**, asserted by counting before and after.
2. Both `SIGINT` and `SIGTERM`, as `spike/src/engine.js:113–114` registers both.
3. The handler aborts the `AbortController` whose signal is passed as `RunFlowOptions.signal`, with
   the **string** reason `received SIGINT` / `received SIGTERM`. The string is load-bearing:
   `interruptionNote` (`engine.ts:161–165`) reads `signal.reason` only when it is a non-empty string,
   and that is how the spike's `runs.log` note is reproduced. Aborting with no reason, or with an
   `Error`, silently substitutes the thrown message.
4. The run then ends `interrupted` through `core`'s own path — active occurrences finalised, the
   terminal record written — and the process exits 130 per AC-9 and AC-10(4). The CLI does **not**
   exit before `core` has concluded, or the run history and terminal record are lost.
5. **Ctrl-C at an interactive gate ends the run `interrupted` and exits 130, never `undecided` and
   never 3.** This has no counterpart in the spike, where `process.exit(130)` fires synchronously
   inside the handler and no race exists. Here, AC-7(2)'s `rl.close()` fires the `'close'` handler,
   which would reject with `GateUnansweredError('stdin-closed')`, while the re-raised signal aborts
   the controller — two rejections for one event. `core` prefers the abort (`engine.ts:361–363`,
   *"Abort keeps precedence over the missing answer"*) **only if `signal.aborted` is already true when
   the catch runs**, which the ordering does not guarantee. The reader must therefore suppress its
   own `stdin-closed` rejection once it has re-raised the signal. Tested by asserting the terminal
   status and the exit code, not by reading the code.

### AC-12 — `frame.source.test.ts`'s AC-4(d) guard is re-aimed, not deleted

**CLI.** The guard at `frame.source.test.ts:605` is the one landed check this ticket falsifies, and it
is a register that must keep a subject:

1. Clause 1 — *"no file in this package registers a signal handler"* — becomes *exactly one file
   does*, named by identity, with the same scan over `packageFiles()` and the same self-exclusion. A
   second file registering one, or the named file ceasing to, fails. A blanket exemption for `src/**`
   is refused: it would excuse a handler in a command that has no business owning one.
2. Clause 2 — *"loading the frame adds none at runtime"* — is **unchanged and gains a new meaning**:
   it is now the check that AC-11(1) holds, since a module-scope registration would turn it red.
   State that in the block's own comment, so a later reader does not delete it as redundant.
3. Both clauses shown red before green: clause 1 against the pre-change tree (no offender → the new
   register is unsatisfied), clause 2 against a deliberate module-scope registration.
4. `COMMAND_DOMAIN` gains a `run.ts` row, and the row is exactly the `DOMAIN` symbols that module
   names — the guard fails both on an unlisted symbol and on a listed one the module does not use.
   **`DOMAIN` itself does not grow**: every symbol this command reaches is already in it, and the
   error classes are not `DOMAIN` symbols at all.

### AC-13 — the flags reach the run, and `--base` moves the anchor and nothing else

**CLI.** `spike/bin/harness.js:556`. `RunFlowOptions` receives `dry`, `auto`, `base`, `signal`,
`answerGate` and, through the mutated project, the adapter override. `--project` selects the project
through AC-2(1) and is not restated here.

1. `--dry` → `dry: true`. A dry run writes nothing and its gates report *would pause here*.
2. `--auto` → `auto: true`, and it **cannot** answer a `human-locked` gate or a synthesised
   exhaustion gate (`types.ts:86–96`). `q0033-surface.js` S10.6 and S11: the output names
   `human-locked` or `loop exhausted` and never `auto-advanced (human-locked)`. With no
   `--gate-answer` beside it the run ends **`undecided`, exit 3** — *"Erratum: `--auto` does reach an
   unanswered gate, and can end a run undecided"* (2026-09-01) is the reading to build against, and
   decision 076's earlier sentence is not.
3. `--base <ref>` → `base: <ref>`, threaded as a `string` or omitted. The spike passes
   `flags.base ?? null` and `core` writes `base ?? null` into `baseOverride`, so passing `undefined`
   where the spike passes `null` is identical in effect; passing the string `"true"` is not, which is
   what AC-1(2) prevents. It moves the diff anchor only, and never `repo.base_branch`, the
   integration branch, or the branch a rework step merges from.
4. An unresolvable `--base` is blamed on **the flag**, end to end: the message names `--base` and the
   revision, and names neither `repo.base_branch` nor `harness.yaml` (`q0077-base-flag.js` B7),
   including when the supplied value equals the configured base. This is a rendering claim about what
   a maintainer reads, on top of the library claim `diff.test.ts` already carries.
5. `--adapter <name>` calls `overrideAdapters(flow, name)` **and** sets
   `project.config.adapterOverride`, because the walk deliberately does not descend into a `fan_out`
   step's `step:` template and the config value is what reaches it. Repeating the flag is last-wins
   (`q0033-surface.js` E3). A **valueless** `--adapter` is preserved rather than refused — the spike
   does not refuse it, and inventing a second refusal beside AC-1(2)'s would be a behaviour change —
   with a `Why:` line at the one cast that lets a non-string through.
6. `--verbose` reaches the renderer per AC-3 and gates nothing else.

### AC-14 — the parity register records what moved, re-derived rather than adjusted

**`packages/core/src/spike-parity.test.ts`.** Ground rule 5.

1. `q0040-undecided.js` gains `binaryCarriedBy` naming this ticket's test file(s), and its
   `binaryHalf` prose is rewritten from *"— Q-0010"* to what was carried and what was not: the five
   gate sites and their exit codes are carried here; `:368–411`'s schema-and-`validate` half is
   Q-0091's and is named as such (§0(c)).
2. `q0077-base-flag.js` gains `binaryCarriedBy`; its `binaryHalf` says nothing is owed.
3. `q0034-review-fixes.js`'s existing `binaryCarriedBy` gains this file, and its prose loses
   *"What remains is B3 … — Q-0094"*.
4. `q0033-surface.js`'s prose loses *"What remains is the gate answers a terminal supplies —
   Q-0094"*, which `spike-parity.test.ts:1594` asserts by name — so that assertion moves in the same
   change or the suite is red. Where a row's claim spans two files, the `binaryCarriedBy` entry says
   why, on Q-0092's precedent.
5. The file's pinned line totals and the transfer share are **re-derived**, not edited to fit. If no
   `spike/test/**` line changes they do not move, and the criterion is satisfied by showing that
   rather than by silence.

---

## 5. Non-goals

1. **`board` and `adapters`** — Q-0099's, including the containment token and the `→ harness run …`
   hint that names this command.
2. **The mock end-to-end suite through the binary** — Q-0095's. This ticket adds command-level
   coverage; it does not translate `smoke.js`.
3. **Renaming the binary in user-facing text.** AC-1(1)'s usage line says `harness`. Q-0100 owns the
   class; this is its fifth instance and is registered, not fixed.
4. **Fixing `regressed`'s exit code** or the unknown-command zero — Q-0090's GA-4.
5. **Any change to `spike/src/`** (ground rule 1) and any deletion or edit of `spike/test/**` (ground
   rule 2). Not an acceptance criterion: it is a constraint on every child of Q-0010, and a criterion
   asserting it would be a green tick over work nobody did. If satisfying a criterion appears to
   require changing `spike/src/`, **stop and report** — it is the charter's mirror-and-re-record path
   and a decision, not a step.
6. **Q-0059, Q-0060, Q-0066, Q-0068** — reported if met, never closed here (ground rule 3).
7. **Resuming an interrupted or undecided run** — Q-0019, M3.
8. **A `--json` mode for `run`.** The spike has none; `runs` is the command with one.
9. **Concurrency.** Two runs on one ticket share a worktree and compute the same run id; that is
   Q-0039's, and it becomes acute the moment two command children run at once.
10. **A colour policy** — no TTY test for colour, no `NO_COLOR`, no `FORCE_COLOR`. Q-0090 non-goal 11
    stands and `colour.ts` is unchanged. (The TTY predicate AC-7 injects is about *input*, not colour.)
11. **Emitting an `info` for a deferred diff range** — Q-0082's, and it owes a decision entry first.
12. **Budget enforcement, new gate answers, event-schema changes, timestamps or sequence numbers, a
    new persistent format, an adapter, or any vendor-specific rendering.**
13. **Widening `@quorum/core`'s barrel.** §3 measures that nothing is owed; adding `RunFlowOptions` or
    `Project` as type exports would move `package.test.ts`'s counted surface for no gain.

## 6. Open questions — all ruled at this gate, none blocking

**OQ-1 — module layout. Ruled: three modules.** `run.ts` for the command, `gate.ts` for the reader,
`trace.ts` for the renderer. The worry that this puts two run-only modules into the set
`frame.source.test.ts` calls "the frame" is answered by measurement rather than by taste: a frame
module may name **no** `DOMAIN` symbol, and `GateUnansweredError`, `FlowError` and
`IntegrationError` are not `DOMAIN` symbols — only `run.ts` reaches any, so only `run.ts` needs a
`COMMAND_DOMAIN` row. Three modules is therefore legal today. The reader is ~60 lines with five error
sites and the renderer is a nine-arm exhaustive switch; folding both into `run.ts` gives a ~250-line
command module, and the two are exactly the pieces M3's server will want to import *without* the
command. Each file's header states its classification. **Not blocking either way**: AC-12(1) names the
handler's file by identity, and the identity is whichever file the implementation picks — the
criterion is parameterised, not pre-decided.

**OQ-2 — the test fixture. Ruled: build it out of this package's own commands.**
`packages/core/test/run-fixture.ts` cannot be imported — another package's test helper, and reaching
for it is an undeclared cross-package read Q-0072's guard refuses. Instead:
`invoke(['init', dir])`, then `invoke(['ticket', 'new', …])`, then
`invoke(['run', …, '--project', dir, '--adapter', 'mock'])` — which is exactly what
`q0040-undecided.js:276–307` does with the spike binary. Verified available at this gate: `init` and
`ticket` landed with Q-0093, `test/invoke.ts` already runs a command line in process over owned
streams, and `MOCK_ALWAYS_PASS` / `MOCK_ALWAYS_FAIL` exist in `packages/core/src/adapters/mock.ts:9–10`
and are set with `vi.stubEnv`. No build is required, so the suite's verdict does not depend on whether
`dist/` exists.

**OQ-3 — `packages/cli/turbo.json` inputs. Ruled: confirm, add nothing unmeasured.** The fixture above
reads only this package's own `templates/`, which `$TURBO_DEFAULT$` covers. If the implementation
instead copies `harness/flows/*.yaml`, those are already declared (Q-0091). Confirm by measurement at
implementation time — that is what Q-0091's own row asked for and got right — and declare only what is
read.

**OQ-4 — size. Ruled: do not split, and the seam is recorded rather than re-derived later.** Fourteen
criteria is inside the ceiling but at the top of it, so the ruling is stated with its reasoning rather
than assumed. The natural seam is **scripted vs interactive**: AC-1 to AC-6 plus AC-8 to AC-10, AC-13
and AC-14 give a `run` that CI and Q-0095 can use; AC-7, AC-11 and AC-12 are the terminal-only half.
Three reasons that seam is refused here:

- **It is three criteria, not five.** AC-8 is unavoidable in the first half — no gate can be answered
  scripted without the envelope either — so the second ticket falls well under the size at which a
  separate requirements run pays for itself.
- **It puts two tickets inside one function.** The scripted queue and the interactive reader are the
  same 48-line `ui.gate`, and the second ticket's implement step would rewrite the first's file. That
  is the shared-file failure the sizing rule exists to prevent, arriving at the smallest possible
  scale.
- **The first half would ship the automation half of a human-gated product.** A `run` that cannot
  serve a human at a gate is not a shippable half of *the command the product exists for*.

The counter-argument is real and is written down rather than dismissed: AC-7 and AC-11 carry the
ticket's only novel defect (R-1), and a three-criterion ticket whose whole subject is a race would get
attention this one has to share. If the chore run exhausts twice on the gate reader, that is the
evidence for splitting it at that point, and this paragraph is what a later gate should read.

**OQ-5 — the `q0033-surface.js` row's boundary. Ruled: as written in AC-14(4).** S3.2/S3.3 are a
two-path end-to-end through the shipped review flow (Q-0095's shape) and S11's remaining half is board
compatibility (Q-0099's); neither is claimed here. The row's prose can only be written once, so it
says what this ticket carried and names the two tickets that still owe the rest.

**No decision entry is owed.** The two rulings this ticket rests on already exist — *"A run nobody
answered is undecided, and keeps the branch it proved"* (2026-09-01) and its erratum *"`--auto` does
reach an unanswered gate, and can end a run undecided"* (2026-09-01) — and the injectable-stream shape
change is charter-permitted layout rather than behaviour. If the implementation finds one owed, that is
a **stop-and-report**, not a step: no agent on the chore route may write one, and eight tickets in this
repository have now paid for a loop discovering that mid-run.

## 7. Risks

**R-1 — the Ctrl-C race (AC-11(5)) is the one defect this ticket can introduce that the spike could
not have.** The spike exits 130 synchronously inside its handler; here the abort and the readline
`close` rejection are two asynchronous paths to one outcome, and if the wrong one wins, a maintainer's
deliberate interrupt is recorded as *nobody was there*. That inverts the distinction Q-0040 exists to
draw. Invisible to reading; must be tested by outcome.

**R-2 — a renderer that prints the terminal event.** `core` emits both a human `info` line and a
structured `terminal` event for the same moment. An exhaustive switch that "handles" every member
prints the run's outcome twice, and the doubling reads as a formatting nit rather than the misreading
of the interface that it is. AC-3 names it and asserts the line count.

**R-3 — the guard at `frame.source.test.ts:605` will look like an obstacle.** The cheapest way past it
is to delete the file scan and keep the runtime count, which loses the only check that a *second*
handler cannot appear, in the one package that owns process-level behaviour. AC-12 forbids that
reading in advance.

**R-4 — `GateUnansweredError` identity.** Classification is `instanceof` against `packages/core`'s
class. A reader that declares its own error of the same name, or wraps the throw in its own
`FlowError`, produces a `failed` run with a rollback — and every message assertion still passes,
because the wording is unchanged. The discriminating test is the *status and the branch*, not the
sentence; AC-6(2) is what makes that non-optional.

**R-5 — event backpressure.** `runFlow` is lazy and single-consumer. Rendering and gate answering must
happen inside one asynchronous iteration; a handler that stops pulling to await something else can
deadlock a gate or leave core work unobserved.

**R-6 — the fixture is slow and writes worktrees.** A real run under Vitest creates git worktrees and
branches in a temp directory. `packages/core`'s suite already does this, so the precedent and the
cleanup pattern exist, but this is the first `packages/cli` suite to do it and it will be the package's
slowest file. Budget for it rather than trimming coverage to avoid it. Its fixtures set their own git
identity and build their own repositories, so the verdict is a property of the commit and not of the
developer's configuration — *"A test's verdict is a property of the commit"* (2026-08-30).

**R-7 — measurements have a shelf life.** Every line number here was re-derived on 2026-09-04, and the
last five children of Q-0010 each found an inherited figure stale within hours. Re-derive AC-14's
totals at implementation time; do not transcribe §0(b)'s table into a source comment.

## 8. Cross-cutting checklist

These are constraints on the change, not acceptance criteria — a criterion asserting them would be a
tick over a subject nobody touched.

| | |
| --- | --- |
| **BYOS** | No credential path is added. `frame.source.test.ts:638`'s scan covers every file in the package including new ones, and its patterns catch `token`-adjacent spellings — the renderer's `retry` row and the run's cost line must not acquire one. `--adapter` names an adapter, never a subscription. |
| **Worktree safety** | Nothing in this package writes to a repository. Every write, spawn and worktree is `core`'s, reached only through `runFlow`. AC-6's *keeps every worktree* is asserted as an observation of `core`'s behaviour, not implemented here. |
| **Gate behaviour** | Human-gated by default is preserved exactly: `--auto` is opt-in and cannot answer `human-locked` or an exhaustion gate (AC-13(2)); a gate is never defaulted, never assumed, and never invented (AC-5, AC-6(3), AC-7). |
| **File format / schema** | None added. The gate answer travels through `@quorum/shared`'s existing `gateAnswerEnvelopeSchema`; the event union is unchanged and must stay so. |
| **Cross-vendor rule** | Directory linting runs before the adapter override (AC-2(4)), so an override cannot conceal an invalid declared flow. |
| **Lint rules** | None added. `harness lint` is *used* by AC-2's preflight and not changed. |
| **Product-agnostic** | No vendor appears above the adapter layer; no SaaS name appears anywhere. |
| **Vocabulary** | `undecided`, `gate`, `flow`, `step`, `adapter`, `run history`, `preflight`, `dry run` used as `docs/GLOSSARY.md` defines them. No new term, so no glossary edit. A gate is not a "checkpoint"; a flow is not a "pipeline". |
| **Cold-clone impact** | Positive and it is the point: this is the command the README's 30 minutes end at. It adds no prompt, no configuration step and no dependency. No output claims registry-resolved `npx quorum`, which is Q-0029's in M6. |
| **Quality** | TypeScript strict, no `any`, no unjustified `@ts-ignore`, no deprecated API; `npm test --prefix spike`, `pnpm lint` and `pnpm turbo run test --force` green in both environment rows. Definition of done for every ticket here, restated because both candidates raised it. |
| **Docs** | No numbered doc claims anything this changes. `docs/02-sdlc-pipeline-spec.md`'s §5 snippets are generated from `harness/flows/` and are untouched. |

---

## 9. Provenance

**The claude candidate is the base**, and it earned that by measuring. Its §0 is the reason: it found
that the ticket body's gate-site arithmetic (*three plus five, of five*) cannot hold, that the body's
two-file inherited-coverage list **contradicts `spike-parity.test.ts` rather than simplifying it**, and
that the body's two named files are the two smallest contributors while the two largest go unnamed. It
also found the one thing that changes the shape of the work — that `runFlow` becoming an
`AsyncIterable` moves the whole `ui` object and two things from `spike/src/engine.js` into this
package, so this is the first command child whose subject grew when measured. Its analysis of the three
landed `frame.source.test.ts` guards, its ruling on injectable streams (which is what finally lets
`S10.5` be written), its `terminal`-prints-nothing criterion, and its parity-register work are carried
essentially intact.

**The codex candidate sharpened five things, and each is merged as a sub-claim rather than a
criterion**, because each belongs inside one that already existed:

- *an invalid scripted answer must not consume the next queued one* → **AC-5(4)**. The sharpest single
  contribution: a reader that fell through would pass every message assertion in the candidate that
  omitted it.
- *a terminal event is required, never inferred from the iterable ending* → **AC-9(2)**. A silent false
  green neither candidate's exit table would otherwise catch.
- *repeated in-process invocations do not accumulate listeners* → **AC-11(1)**, which is newly reachable
  precisely because OQ-2's fixture runs in process.
- *the gate queue is invocation-local and does not mutate `ParsedArgv`* → **AC-5(1)**, from its
  flag-mutation risk.
- *event backpressure can deadlock a gate* → **R-5**.

Its risk list also contributed R-5 and the git-identity clause in §8.

**What was struck, and why.** Codex's criteria 24, 25 and 26 — *"the spike remains unchanged"*,
*"quality verification"* and the cross-cutting checklist — are not acceptance criteria. The first two
are constraints binding every child of Q-0010 and the definition of done for every ticket in this
repository; asserting them as criteria produces a green tick over work nobody performed, which is the
defect class this project has recorded most often. They are now non-goal 5 and the §8 checklist.

**Where the two disagreed, one was picked and the reason is stated rather than averaged.**

- **The usage line.** Codex spells it `usage: quorum run <flow> <ticket> …`; claude preserves
  `harness` verbatim. **Claude wins, and by measurement rather than by preference**: `ticket.ts:68` and
  `validate.ts:62` both keep `harness` in their landed usage lines while `commands.ts`'s help — new
  text — says `quorum`. The rule this repository has actually been applying is *preserved text keeps
  its wording, new text is written correctly*, and codex's spelling would make this command disagree
  with its two neighbours while pre-empting Q-0100's ruling.
- **Criteria count.** 26 against 14. Codex's granularity is real analysis, but split at that grain the
  document stops being sizeable: eleven of its criteria are sub-claims of five behaviours, and a gate
  cannot tell an oversized ticket from a finely-described one at 26 rows.
- **The gate-site table.** Codex reproduces the ticket body's classification without measuring it.
  Claude measured it and found the body wrong; §0(a) is claude's and is re-verified here.
- **`base: null` vs omitted.** Codex requires `null` when absent; claude measures that `core` writes
  `base ?? null` so the two are identical in effect. Claude's reading, in AC-13(3), with the
  equivalence stated so an implementer does not think it matters.

**What this gate added that neither candidate had.** The §3 finding that **no barrel export is owed**,
including the *type* exports — `RunFlowOptions` and `Project` are absent from `packages/core/src/index.ts`
and neither is needed, because the options object is checked structurally and both types arrive by
inference. Q-0092's requirement found the opposite and the ground rule says to state which it is, so
stating "nothing is owed" is the discharge, and non-goal 13 stops the barrel being widened out of
caution. Also this gate's: the observation that `loadProject()` returns a `Project` whose `backlog` is a
member, while `RunFlowOptions` wants both as named fields — so the spike's `...proj` spread does not
port; and the measurement behind OQ-1's ruling, that `DOMAIN` does not grow and the error classes are
not `DOMAIN` symbols, which is what makes the three-module layout legal without touching that register.

---

## Appendix A — the inherited coverage, scenario by scenario

What each translated assertion *claims*, so the implementer translates the claim and not the fixture.
Line numbers are 2026-09-04 and are to be re-derived.

**`q0040-undecided.js` — the CLI block, `cliFixture` at `:276` through `:366`, ≈96 lines, the largest
single inheritance.** `cliFixture` (`:276–307`) builds a git repository, runs `init` and `ticket new`
through the binary, and offers two invokers: a piped one and a TTY one. `:309–343` is the table in
§0(a) — five sites, each checked for *both* the exit code and a discriminating message fragment, with
failures collected so one bad row does not hide the other four. `:345–356` is exit 3 as its own code,
plus `nothing was rolled back`, `run #1 undecided`, and the ticket's stage unmoved. `:358–366` is
`--gate-answer undecided` refused. `:254–269` — outside the CLI block but the source of AC-6(2) — is the
type-not-text pair. `:368–411` is **not** this ticket's (§0(c)).

**`q0033-surface.js:284–329` and `:445–451` — ≈53 lines.** S10.1/S10.2 ordered consumption across two
gates, read out of `runs.log`. S10.3 exactness. S10.4 no default from a non-terminal **even when input
is piped** — the fixture pipes `advance\n` and still expects a refusal, which is the assertion a reader
that falls back to stdin fails. S10.6 `--auto` cannot answer an exhaustion gate. S10.7 a `retry` answer
persists the counter. E3 other flags stay last-wins. E4 an explicit exhaustion answer avoids the stdin
refusal. E7 leftover answers ignored silently, exit 0. **`S10.5` is `skipped` in the spike for want of a
TTY** — AC-7's injectable streams are what let it finally be written.

**`q0077-base-flag.js:111–125` (B5) and `:164–192` (B7) — ≈44 lines.** B5: the CLI threads `--base` to
the run and refuses the bare flag, and the usage line names it. B7: an unresolvable override is blamed
on the flag end to end, and the message names neither `repo.base_branch` nor `harness.yaml`. B1–B4 and
B6 are the library half and `diff.test.ts` already carries them.

**`q0034-review-fixes.js` B3 — no lines, one claim.** A colliding run directory is refused by name; what
transfers here is that the CLI routes that `FlowError` to one sentence and exit 1 with no `EEXIST` and
no stack.

## Appendix B — what changed under the CLI because `runFlow` became a stream

For the implementer, and because four of the criteria only make sense against it.

| the spike | here | why it matters |
| --- | --- | --- |
| `ui` object passed into `runFlow` | a renderer over `AsyncIterable<Event>` | AC-3; the vendor never appears, and the union is exhaustive so a tenth event kind is a compile error |
| `ui.gate` prints *and* reads | the `gate` **event** prints, `answerGate` reads | AC-4; two moments, one banner |
| `ui.gate` returns `'advance'` | `answerGate` returns `{gateId, answer}` | AC-8; the only interface difference with no spike counterpart |
| `const r = await runFlow(...)`, read `r.status` | the last `terminal` event, required not inferred | AC-9 |
| `...proj` spread into the options | `project: proj, backlog: proj.backlog` | §3; `Project` carries `backlog`, `RunFlowOptions` wants both by name |
| `process.exit(130)` inside `spike/src/engine.js` | a per-run handler in this package | AC-11, AC-12 |
| the engine installs `SIGINT`/`SIGTERM` | `core` installs none; the caller's `AbortSignal` is the mechanism | AC-11(3); the abort **reason** is what reproduces the spike's `runs.log` note |

The channel's own contract is what makes AC-9 and AC-10 compatible: queued events are drained before
the closing error is thrown, so a failed run delivers its terminal event *and* its exception, and the
handler needs neither to be optional.
