# Q-0090 — CLI package skeleton, `bin` entry and `npx quorum`

**Merged requirement, run 1, iteration 3. Written 2026-09-01 against `main` (`7a5bece`).**

**This iteration opens on a ruled gate, which is what makes it different from the two before it.**
The exhaustion gate answered `retry`, authorising exactly one further traversal, and the ticket body
now carries the ruling: the build system is **Q-0096 — "The workspace emits JavaScript, and quorum is
a runnable binary"**, whose folder exists with a full body; Q-0010's cut is seven children; Q-0090
delivers the frame **as importable modules with tests that run in process**; and the `npx quorum`
acceptance test is **withdrawn**, because every package is `"private": true` and `npx quorum`
resolves against the public registry today.

So this iteration did not re-argue anything. It cut the document along the ruled seam and re-measured
what survives. Iteration 2 tagged every criterion `[frame]` or `[emit]` precisely so this cut would
need no rewriting, and that is what happened: **AC-2, AC-10, AC-11(a)–(c) and AC-12(a) are gone to
Q-0096**, and what is left is twelve criteria, every one of them satisfiable over source today with
no emit — verified, not assumed.

**One finding is new, and neither candidate could have had it, because the gate created it.** The
workspace suite is **red on the working tree right now**. It is one line to fix and it is in scope;
§Gate obligations GA-1 and AC-11(a) carry it.

---

## Problem

`packages/cli` is a stub. `src/index.ts` is `export const name = '@quorum/cli';`, its manifest
declares three scripts and nothing else, and its entire suite is one assertion that the stub is a
stub. Four sibling tickets — Q-0091 to Q-0094 — cannot start until it is a package with a frame.

What is unbuilt is a **presentation layer**, and specifically the part of it that every sibling would
otherwise invent separately: argv parsing, a colour helper, `die`, and an exit-status table. Q-0010
§1 checked eleven domain helpers by name and found all eleven already in `packages/core`. Nothing
here ports a helper.

**What is no longer this ticket's problem, and why.** Iterations 1 and 2 established, with four
probes, that this workspace has never emitted JavaScript and that Node cannot execute the TypeScript
it compiles: `moduleResolution: nodenext` maps a `./constants.js` specifier to `constants.ts` at
compile time and Node's type stripping does no such mapping, so `import('@quorum/shared')` fails
`ERR_MODULE_NOT_FOUND`; a TypeScript entry under `node_modules` is refused outright with
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`; `tsconfig.base.json` declares no `paths` and
`packages/core/package.json` no `exports`, `main` or `types`, so `@quorum/core` is unresolvable at
**typecheck** as well as at runtime. All of that is now **Q-0096's**, together with the emit strategy,
the `build` task and its `outputs`, the `exports` maps, the executable the `bin` entry points at, and
what `npx quorum` is allowed to mean. Q-0096 owes the decision entry, for the reason its own body
gives: a `build` task with real `outputs` replays an **artifact** rather than a verdict, which is a
class this repository has never had.

**What that leaves is genuinely smaller than this ticket's title suggests, and the ruling says so.**
Q-0090 declares the package manifest and its `bin` field; it does not have to produce a runnable
binary. Nothing in this workspace runs outside Vitest today, and making that untrue is Q-0096's
subject.

### The one thing that changed underneath this ticket since iteration 2

`backlog/Q-0096-…/ticket.md` now exists on disk. `packages/shared/src/plan-backlog.test.ts`'s
**backlog → plan** direction is absolute by design — *"a ticket that exists is work in flight, and
the plan is where this project records what is in flight"* — and `ticketFiles()` reads
`fs.readdirSync('backlog')`, not git. `docs/06-development-plan.md` names no `Q-0096` anywhere.

Reproduced rather than reasoned about, `pnpm turbo run test --force --continue`:

```
Tasks:    6 successful, 7 total   ·   Failed: @quorum/shared#test
@quorum/core:test:  57 passed | 1 skipped (58)   ·   1280 passed | 2 skipped (1282)

AssertionError: docs/06-development-plan.md names no entry for Q-0096 —
a ticket exists in backlog/ and the plan does not know.
```

One task, one assertion, one cause. The ruling that unblocked this ticket turned the suite red as a
side effect. It is one bullet line under M2, `docs/` is inside `developer-generalist`'s paths, and
AC-11(a) closes it.

---

## User stories

**Sibling child (Q-0091 to Q-0094) and any later contributor.** I add a command by writing one module
against a frame that already parses argv, already owns the error path and already owns the exit
codes. I do not invent a second flag parser, I cannot introduce a sixth exit code by accident, and if
a domain helper I need is genuinely missing from `core` I stop and report rather than copying one out
of the spike.

**Solo maintainer.** I will wrap `quorum run` in a shell script. Its exit code will tell me which of
five things happened — it finished, it errored, a human stopped it, nobody answered a gate, or I
interrupted it — and that mapping is one typed module rather than nine `process.exit` calls I have to
find by reading.

**Cold-clone adopter.** Not served by this ticket, and that is stated rather than implied: the binary
a stranger runs is Q-0096's. What this ticket buys them is that when it exists, its argv handling and
its exit codes are the spike's, preserved, rather than whatever four command tickets each decided
separately.

---

## Acceptance criteria

Surfaces: **CLI** (`packages/cli`), repository configuration (`pnpm-lock.yaml`) and **docs**. No
criterion names a `harness/`, `backlog/` or `docs/decisions/` surface. Twelve criteria; §Size states
the judgement.

---

**AC-1 — `packages/cli` is a real workspace package, and the lockfile moves in the same commit as a
product of `pnpm install`.**

`packages/cli/package.json` declares:

- `"dependencies"`: `"@quorum/shared": "workspace:*"` and `"@quorum/core": "workspace:*"`, and **no
  third-party dependency**. It gains nothing merely because `spike/package.json` has it;
- `"bin": { "quorum": … }` — the name is `quorum`, because that is what the README will type and
  `product-boundaries.md` forbids `harness`. The package name stays `@quorum/cli`;
- `"type": "module"` (already present) and an `"engines".node` floor consistent with the root's
  `>=22.13.0`.

`pnpm-lock.yaml:35` currently reads `packages/cli: {}`. It gains an importer block in the **same
commit**, or `commands.install`'s `pnpm install --frozen-lockfile` fails in the `integrate` worktree
and the run stops after the implement step has been paid for.

**The `bin` target does not exist until Q-0096, and that is a measured unknown rather than a
decision.** A `bin` entry naming a path pnpm cannot find at install time may make pnpm refuse or warn
when it creates the shim. This criterion does not guess: it requires that `pnpm install
--frozen-lockfile` **exits 0 with the manifest as declared**, and that the result is stated. If pnpm
refuses the absent target, the `bin` line moves to Q-0096 through `requirements/errata.md` written
during the loop — the authorised channel, and not a further review round (*"An erratum is the last
repair, not the first"*, 2026-08-30).

*Authority for the lockfile:* `pnpm-lock.yaml` is absent from `developer-generalist`'s `paths`
(`harness/roles/developer-generalist.md:2`), and that list is **not mechanically enforced** — the
engine's `writesOf` reads `step.output.writes`, `loadRole` supplies adapter and model defaults, and
the spike's only use of a role's paths is `samplePaths` (`engine.js:714–715`) feeding a discarded-edit
warning. It is a boundary to respect, not a gate that refuses. The lockfile wants no authored edit in
any case: it moves as the **output of `pnpm install`**, which `Bash(pnpm *)` allows. Authorised here
by name, limited to workspace importer entries. **A third-party package appearing in that diff is a
blocker, not a nit.**

*Test:* `pnpm install --frozen-lockfile` from a clean checkout of the branch exits 0; a test reads the
manifest and asserts the two workspace dependencies, the `bin` key and the absence of any other
dependency; a test asserts the lockfile's `packages/cli` importer is non-empty.

---

**AC-2 — argv parsing is preserved exactly, including the behaviours nobody would choose.**

`spike/bin/harness.js:25–42` is the specification — declarations `:25–27`, loop `:28–39`,
`const [cmd, ...rest]` at `:40`, the `gateAnswers` queue at `:42`, all re-read this iteration. Seven
behaviours, each pinned separately:

1. `process.argv.slice(2)`; tokens not starting with `--` are collected as positionals in order, and
   `const [cmd, ...rest] = positional`.
2. `--k v` sets `flags.k = 'v'` when `v` does not start with `--`; otherwise `flags.k = true` and `v`
   is re-parsed as the next flag.
3. **Only `gate-answer` accumulates**, into an array, in command-line order. Every other flag is
   last-wins (`:32–36`, Q-0033). `gateAnswers` is a separate copy taken at `:42`.
4. A single-dash token is a **positional**, not a flag: `-v` lands in `rest`. The test is
   `startsWith('--')` and nothing else.
5. `--` is **not** a terminator: it parses as a flag named `''` and swallows the following token as
   its value.
6. Flag values are strings or the boolean `true`; nothing is coerced to a number.
7. Repeated positionals are all kept; nothing is de-duplicated.

Behaviours 4 and 5 are preserved defects under ground rule 3 — reported, not fixed — and pinned so a
later change to either is deliberate. **No parse error is invented**: the spike has none, and adding
one is a behaviour change.

*Test:* a table-driven test over argv arrays, one row per behaviour, asserting the parsed
`{cmd, rest, flags, gateAnswers}` shape. The parser is exported so a test supplies an array directly:
no verdict depends on the invoking shell, the terminal, git configuration, an installed vendor CLI or
an existing ignored directory. Rows 4 and 5 carry an authority line naming this criterion.

---

**AC-3 — `die` and the colour helper are preserved, and their two limits are registered.**

- The colour helper is six functions — `dim`, `bold`, `amber`, `green`, `red`, `teal` — emitting
  exactly the escape sequences at `spike/bin/harness.js:44`: `\x1b[2m`, `\x1b[1m`, `\x1b[33m`,
  `\x1b[32m`, `\x1b[31m`, `\x1b[36m`, each closed with `\x1b[0m`.
- `die(m)` writes `c.red('✗ ') + m` to **stderr** via `console.error` and exits 1 (`:124`). The space
  sits inside the red span, unlike every other call site in the file, and that is preserved.
- An uncaught rejection reaches `die(e.stack ?? String(e))` (`:569`), so an unexpected throw prints a
  Node stack through the error path and exits 1. Preserved.

Two limits are **reported and not fixed**: the helper performs no TTY test, so escape sequences are
written into a pipe or a file, and it honours neither `NO_COLOR` nor `FORCE_COLOR`. **No
colour-disable mechanism is added** — inventing one to make a test convenient is exactly the
behaviour change ground rule 3 forbids.

*Test:* assertions over the exact escape sequences, and over `die`'s stream, message shape and exit
code, each naming this criterion. **`die` is tested without terminating the test process** — the
frame is library code and its tests run in process, so `process.exit` is observed rather than
suffered.

---

**AC-4 — one exit-status module: named constants, a status map, and exhaustiveness derived from a
symbol that is actually exported.**

The ticket body's table is organised by *code → source line*, which is how it was measured and not
how it can be enforced. Reorganised by what decides a code, over the six run statuses:

| run status | code | how it is reached in `spike/bin/harness.js` today |
| --- | --- | --- |
| `completed` | `0` | fallthrough of the three-way at `:557` |
| `regressed` | `0` | **the same fallthrough** — `regressed` is named nowhere in the expression |
| `aborted` | `2` | `:557` |
| `undecided` | `3` | `:557`, added by Q-0040 on 2026-09-01 |
| `failed` | `1` | never via `:557`; via `die` at `:124`, the `catch` at `:558`, or `main().catch` at `:569` |
| `interrupted` | `130` | **not the CLI's today** — `spike/src/engine.js:111`, from its own handler |

Non-status exits, preserved: `lint` exits `0`/`1` at `:404`; `validate` exits `1`/`0` at `:460`;
`run`'s lint preflight exits `1` at `:548`.

(a) **One module owns both spellings.** Named, read-only constants — `SUCCESS = 0`, `ERROR = 1`,
`ABORTED = 2`, `UNDECIDED = 3`, `SIGNAL = 130` — and one map from run status to code, typed such that
a seventh status fails to compile rather than falling through to 0. Production CLI code and CLI tests
refer to the constants rather than repeating these numeric literals.

**The map is typed off `@quorum/shared`, not off `@quorum/core`.** `RunStatus` is a *type* in
`packages/core/src/engine/types.ts:63`, erased at runtime, and `@quorum/core` does not resolve at
typecheck either (AC-9), so `Record<RunStatus, number>` does not compile from `packages/cli` today.
The equivalent that does is `RunTerminalEvent['status']`, exported from `@quorum/shared` —
`packages/shared/src/events.ts:264`, reachable through `index.ts:8`'s `export * from './events.js'`.

(b) **Exhaustiveness is derived, not transcribed.** A test extracts the status literals from the
**exported** `runTerminalEventSchema` (`events.ts:232`) and asserts the map's key set equals it. **Not
`runTerminalStatusSchema`**, which is the module-private `const` at `:210` that iteration 1 named and
which cannot be imported.

**The derivation has a trap, and closing it is part of the criterion.** That schema is a
`z.discriminatedUnion` whose **first member carries `status: z.literal('regressed')` and whose second
carries `status: z.enum(['completed', 'aborted', 'failed', 'interrupted', 'undecided'])`**. A
derivation that reads literals and not enums sees one status, compares it against a one-key map, and
**passes while examining a sixth of its subject** — *"a check that skips its subject must not report
success"* (2026-08-25) waiting inside this ticket's own guard. So the test asserts the derived set has
**six** members by identity, and is shown red when a status is removed from **each** union member
separately. Showing it red once proves the guard fires, not that both clauses do (Q-0071).

(c) **`regressed` → 0 is preserved and registered**, with an authority line naming this criterion. It
is current behaviour, it is not obviously right, and ground rule 3 forbids fixing it here.

(d) **`130` is a row of this table and no handler is installed.** `core` installs no signal handler
(Q-0050 AC-5, `04-architecture.md` principle 2), so the handler becomes the CLI's and is **Q-0094's**
to place. Note for that ticket, verified this iteration: the spike's engine registers **both** `SIGINT`
and `SIGTERM` through one `onSignal` (`spike/src/engine.js:113–114`), each `process.once`, and the
`process.exit(130)` is at `:111`. A test asserts the row exists and that `packages/cli` registers no
signal handler.

*Test:* the derivation and its two red demonstrations in (b); a mutation test for (a) — adding a
status to a fixture union fails the guard; assertions for (c) and (d).

*Correction to the ticket body, stated because the body forbids re-deriving its table from any other
source:* every line number in it verifies exactly (`:124`, `:404`, `:460`, `:499`, `:517`, `:523`,
`:531`, `:548`, `:557`) **except one**. `process.exit(130)` is at `spike/src/engine.js:111`; `:87`
today is `diffInputs: new Map(), deferredDiffs: new Map(),`. The row's *claim* is unaffected. It is
the one row pointing outside the file the body measured — the exact shape of error the body warns
about, one file over.

---

**AC-5 — hard exit and soft exit are two mechanisms and stay two.**

`process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` (all four re-verified) sets the status and
lets the process finish writing; `process.exit` truncates. The frame exposes both and the shared
numeric meaning does not collapse them into one implementation. A port that collapses them loses
output on the `runs` warning paths — which is Q-0092's subject, inheriting this frame.

*Test:* **demonstrated, not asserted.** A child process that sets the soft code and then writes a
large payload to stdout exits 1 with the payload complete; the same child using `process.exit` loses
it. Both rows in one test. The child is a plain `.mjs` fixture the test writes to a temporary
directory and spawns — **no emit, no package resolution, nothing outside Vitest** — which is what
keeps this criterion on Q-0090's side of the ruled seam. See AC-10(a): the temporary-directory read
may earn a register entry, and that is the correct outcome rather than an obstacle.

---

**AC-6 — an unknown or absent command prints help and exits 0, preserved and registered.**

`spike/bin/harness.js:560–562`: the `default:` branch prints usage and returns, so `main()` resolves
and the process exits 0. `quorum`, `quorum nonsense` and `quorum --help` all exit 0.

Preserved under ground rule 3 and **registered as a defect**, because a shell script cannot
distinguish "did the thing" from "did not understand you". Registered rather than quietly carried,
because this ticket's whole deliverable is the exit table and a row nobody wrote down is the row that
is wrong.

*Ruling, against the codex candidate's proposal to make it exit 1:* that is a behaviour change, on the
one surface a stranger meets first, decided inside a ticket whose stated scope is a frame. It is
defensible and it is not this ticket's to take. GA-4 opens the successor.

*Test:* three invocations through the frame's entry, each asserting exit code 0 and non-empty stdout,
each naming this criterion.

---

**AC-7 — the help text is owned data, it says Quorum, and it claims only what the frame dispatches.**

`:561` produces help by **reading the binary's own source file** —
`fs.readFileSync(fileURLToPath(import.meta.url))`, slicing lines 1–10 and stripping `// `. That
mechanism cannot survive Q-0096 under any emit strategy: emitted JavaScript does not carry the comment
block at those line numbers, and reading `import.meta.url`'s file from inside a package under
`node_modules` is not a thing to build a help system on. So the mechanism changes to owned data **here**,
where it costs one constant, rather than in Q-0096, where it would arrive as an unrelated surprise.

Two constraints on the text:

- It **must not** call the product a harness. `.claude/rules/product-boundaries.md` and
  `harness/product-context.md` forbid it; the spike's first help line is `harness — spike CLI.
  Commands:` and every command name inside it is `harness …`. Writing `quorum` is **not** fixing
  Q-0068 — that ticket's subject is the BYOS refusal string in `claude.js:12` / `codex.js:21` and
  their ported twins, which this ticket does not touch. Say so in the implement report, so a reviewer
  does not read correct new text as an unauthorised fix.
- **The help lists only commands the frame dispatches**, which today is the help itself. The eight
  command lines are the siblings' to add as each lands, preserving the spike header's wording and
  ordering at that point. Ruled here because the alternative — listing eight commands that all fall
  through AC-6's default branch to help and exit 0 — is a green tick over a subject that does not
  exist. The cost is that Q-0091 to Q-0094 each add their own line; the benefit is that no invocation
  can look like success for a command that is not there.

*Test:* the help is asserted to contain the usage form and the product name; asserted to contain no
occurrence of the word `harness` outside a path literal such as `harness/harness.yaml`; the mechanism
is asserted **not** to read its own source (no `fileURLToPath(import.meta.url)` + `readFileSync` pair
in the help path); and — the derived clause — **every command name appearing in the help is a member
of the frame's registered-command set**, so a sibling that documents a command without registering it
turns the suite red.

---

**AC-8 — no command is implemented, no domain helper is copied, and the frame writes nothing.**

The deliverable is the frame plus help. `board`, `lint`, `validate`, `adapters` (Q-0091); `runs`
(Q-0092); `init`, `ticket` (Q-0093); `run` and the gate reader (Q-0094); `smoke.js` (Q-0095).

`packages/core` already holds every domain helper (Q-0010 §1, eleven of eleven). If one appears to be
missing, implementation **stops and reports the absence** rather than adding it to CLI scope (ground
rule 4).

Invoking the frame with no arguments, `--help`, an unknown command or a malformed argv creates or
changes no file in the working tree, `backlog/`, `harness/`, `.quorum/` or `.harness/worktrees/`, and
starts no daemon, probes no adapter and runs no flow.

*Test:* a source-level guard over `packages/cli/src/**` asserting that no file imports a
run-executing or backlog-writing symbol, with its file list **derived from the directory** rather than
hand-written — the failure Q-0051 found in `q0050.source.test.ts`'s third list, which failed open.
Plus a filesystem test: snapshot a temporary project directory, drive all four invocation shapes
through the frame's entry in process, assert the tree is unchanged.

---

**AC-9 — the `@quorum/core` dependency is declared, proven unusable, and routed to Q-0091.**

AC-1 declares it because the ticket body requires it and because declaring it is what makes turbo's
`^test` edge exist. It does **not** resolve, in either direction, and that is Q-0096's to change:
`packages/core/package.json` declares no `exports`, no `main` and no `types`; `tsconfig.base.json`
declares no `paths`; `import('@quorum/core')` fails `Cannot find package`.

A `packages/cli` that declares an unusable dependency is a trap for the next child, so the state is
**proven rather than described**:

- a runtime assertion that `import('@quorum/core')` rejects;
- assertions over the two facts that cause it — the manifest's three absent keys and the absent
  `paths` — since a test cannot assert a compile failure directly and asserting the cause is honest
  where asserting the effect is not.

**The assertion carries an authority line naming Q-0096 as the ticket that makes it fail**, so that
when the export surface opens the red reads as *the trap is closed* rather than as a regression. This
is a check whose whole purpose is to expire, and saying so is the difference between a pin and a
tripwire nobody understands.

*Test:* the two assertions above, plus a `runs.log` note. **GA-5 is the human's half**: the finding is
written into **Q-0091's ticket body** at this gate, because Q-0091 is the first sibling that imports
something and an obligation recorded only in a closed ticket's report expires.

---

**AC-10 — every register this change earns is moved, and the numbers are re-derived rather than
adjusted.**

(a) `packages/core/src/turbo-inputs.test.ts` — `SUITES` (`:129–133`) says *"The two packages whose
suites read outside themselves. The other five read nothing outside."* AC-5's spawned fixture reads
and writes under `os.tmpdir()`, which is the shape that earned `command.ts` a `READ_BASES` entry at
Q-0070. Whether that makes `@quorum/cli#test` a third member of `SUITES`, a new `READ_BASES` base, or
neither is a **measured** answer this criterion requires and does not predict; if it is neither, that
is a claim to state, not an omission. This guard has stopped four tickets on the way in and stopping
is the correct behaviour.

(b) `packages/core/src/test-discovery.test.ts` — every workspace package declares `lint`, `typecheck`
and `test`, and every `*.test.ts` is collected by the configured include. Measured rather than
assumed: `TASKS` (`:59`) asserts the three **exist** (`not.toBe('')`), not that only three do, so
Q-0096's later `build` script is additive. `packages/cli` already declares all three and is already
collected; state that nothing moved.

(c) `packages/core/src/test-command.test.ts` — `CI_JOBS` (`:506`) is an exact seven-key register of
`.github/workflows/ci.yml`'s jobs. This ticket adds no CI job, so the register does not move: say so.

(d) `packages/core/src/spike-parity.test.ts` — ground rule 5. This ticket translates **no**
`spike/test/` file, so the four pinned totals must not move: `binary-only` 220, `both` 2739,
`library-only` 2469, total 5428, share **55%** (`:1134–1140`). **Re-derive them from the failing-pin
output and state that they did not move**, rather than doing arithmetic on the diff.

**A trap in that re-derivation, recorded because the next person will walk into it.** The register
carries *two* vocabularies. The `verdict:` field is a four-way **audit** verdict — `cli`, `ported`,
`split`, `uncovered`, counting 2 / 10 / 8 / 0 today — while `binary-only` / `both` / `library-only`
are **computed** by `classOf` (`:992–993`) from `facts.reachesBinary` and `facts.importsSource`.
Counting the `verdict:` strings gives **ten** entangled files; the pinned identities at `:1047–1051`
give **nine** — one `binary-only` (`q0036-board-containment.js`) plus eight `both`. Nine is the
answer. This is the same class as `smoke.js`'s misclassification that Q-0054's audit corrected: a
count taken from the nearest-looking field rather than from the assertion that decides it.

---

**AC-11 — the two documents this ticket owes are corrected, and one of them is red today.**

(a) **`docs/06-development-plan.md` gains a Q-0096 bullet under M2.** Not housekeeping: without it
`packages/shared/src/plan-backlog.test.ts` fails, and it fails **now**, on the working tree, because
the gate ruling created `backlog/Q-0096-…/` and that check's backlog→plan direction is absolute and
reads the filesystem. Reproduced forced this iteration: 6 of 7 turbo tasks green, `@quorum/core` 1280
passed, `@quorum/shared` failing on that one assertion and nothing else. The bullet says what Q-0096
is, that it owes a decision entry before code, and that Q-0095 depends on it while Q-0090 to Q-0094
do not. If GA-1 has already landed it, this criterion is a **verification the implement step states**
rather than an edit it performs — and the verification is the point either way, because the suite must
be green before the frame's own tests mean anything.

(b) **`docs/06-development-plan.md:481` carries four stale figures.** It reads *"2,515 lines across
eight `spike/test/` files carry a binary half and transfer here, half the spike suite by line,
`smoke.js`'s 773 among them."* Re-derived this iteration from `spike-parity.test.ts`'s own pinned
identities: **nine** files — one `binary-only` plus eight `both` — **2,959 lines**, **55%**, and
`wc -l spike/test/smoke.js` is **780**. `docs/04-architecture.md:73` already says 55%, so the two
documents disagree with each other as well as with the register. In scope as ground rule 5's second
half: a register is re-derived rather than transcribed, and a drifted transcription of it is exactly
what the register exists to catch.

**`backlog/Q-0010-…/ticket.md` §2 carries the same four stale figures and is not touched** — the
backlog belongs to the harness, the engine discards an agent's edits under it, and the role file says
so. Correcting it is the human's (GA-3), named here so the obligation does not expire.

*Test:* (a) is checked by `plan-backlog.test.ts` itself, which must be green; (b) is checked against
`spike-parity.test.ts`'s pins, which already run.

---

**AC-12 — the cross-cutting pillars, checked rather than assumed.**

- **BYOS.** No file in `packages/cli` mentions an API key, an environment variable named `*_API_KEY`,
  a token or a credential — in source, test, fixture, help text or documentation example. No adapter
  is probed by any frame invocation and `check()` is untouched. *Test:* a scan over `packages/cli/**`
  asserting zero occurrences, the guard excluding itself and the exclusion asserted load-bearing.
- **Lint and typecheck.** `pnpm turbo run lint --force` and `pnpm turbo run typecheck --force` green
  over the new package. It falls inside ESLint's `packages/**/*.ts` scope, so
  `@typescript-eslint/no-deprecated`, `no-explicit-any` and `ban-ts-comment` all apply. No `any`, no
  `@ts-ignore` without an inline reason.
- **Both suites.** `npm test --prefix spike` and `pnpm turbo run test --force` both green, run
  **forced**, and **in both environment rows** per Q-0072's closing finding: in the `integrate`
  worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the
  merge, where both exist.
- **The git-identity sweep.** `pnpm sweep:git-identity` green. Any new test that builds a repository
  sets its own identity with `-c`; a verdict may not depend on the account (*"A test's verdict is a
  property of the commit, not of the checkout or the account"*, 2026-08-30).
- **Vocabulary and boundaries.** New user-facing text uses the glossary's terms, references no SaaS
  product, and introduces no new file format, schema, flow rule, gate behaviour or adapter contract.

---

## Size

Twelve criteria, against the ~ten target and the fifteen ceiling. Iteration 2 was thirteen with two
wider than they read; the ruled split removed five build criteria and this document adds AC-9 (the
declared-and-unusable dependency, previously the surviving half of iteration 2's AC-10) and AC-11(a)
(the red suite). AC-12 is a checklist rather than a feature, and AC-10 is four register statements of
which three are expected to be *"it did not move, and here is the re-derivation"*. The real
implementation surface is AC-1 to AC-8: one manifest, one parser, one colour helper, one `die`, one
exit-status module, one help constant. That is the right size, and it is smaller than the ticket's
title still suggests.

---

## Non-goals

1. **The emit, the build task, `exports`, the runnable binary and `npx quorum`.** All **Q-0096's** by
   the gate ruling of 2026-09-01. This ticket declares the `bin` **field**; it does not make it run.
2. **Any command.** `board`, `lint`, `validate`, `adapters` (Q-0091); `runs` (Q-0092); `init`,
   `ticket` (Q-0093); `run` and the gate reader (Q-0094). Implementing one to have something to
   demonstrate is out of scope.
3. **The signal handler and the 130 exit path.** Q-0094's; this ticket declares the row and asserts no
   handler is registered.
4. **Translating any `spike/test/` file.** Q-0091 to Q-0095 inherit them; `smoke.js` is Q-0095's, and
   Q-0095 depends on Q-0096 rather than on this ticket.
5. **Publishing.** `npm publish`, the published package name, versioning and the registry are
   Q-0029's, in M6. The `@quorum/cli` / `quorum` name collision is recorded there rather than solved
   here.
6. **Fixing a known defect.** Q-0059 (`dirOf` traversal), Q-0060 (silent frontmatter), Q-0066 (probe
   crash), Q-0068 (the product name in the BYOS refusal) and Q-0067's version probe are open and land
   in both trees.
7. **Any change to `spike/src/`.** Ground rule 1. `harness/port-charter.md` records a live
   `freeze-sha` (re-recorded at `8bc4c9b` after Q-0040) and the `port-freeze-sha` CI job is live, so a
   `spike/src` change turns `main` red and owes §3's mirror-and-re-record. Q-0090 is **not** in the
   charter's `children:` list, so the branch-scope job reports it out of scope — the rule is the
   ticket body's, not the guard's, and the guard is therefore not a safety net here.
8. **`spike/test/**`.** Ground rule 2 — added to, never edited or deleted, until the cutover.
9. **A UI, a daemon, `quorum open`, `quorum compile`, `quorum history`.** M3 and M5, whatever
   `04-architecture.md:52` currently promises.
10. **`@quorum/templates`.** `init` reads `spike/templates/harness` today; giving the CLI its own
    shipped templates is Q-0093's.
11. **Colour policy** (`NO_COLOR`, TTY detection), **an unknown-command exit code**, and
    **`regressed` → 0** — reported under AC-3, AC-6 and AC-4(c), and routed to GA-4.
12. **Windows.** The `bin` shim's behaviour on Windows is not claimed and not tested; CI and the
    developer machines are POSIX. Stated rather than silently assumed, and it belongs to Q-0096 in any
    case, since nothing here produces a shim that runs.
13. **A parser library.** The frame preserves the spike's parser; a library would "fix" AC-2's
    behaviours 4 and 5 silently.

---

## Gate obligations

None of these blocks solutioning. Each is work no step on the chore route can perform, listed so it
does not expire in a report.

**GA-1 — add the Q-0096 bullet to `docs/06-development-plan.md` before launching the chore run.**
AC-11(a) can close it, but a run launched onto a red suite hands its implementer a failure it did not
cause and cannot distinguish from its own. One bullet under M2. **Recommended: land it at this gate**,
at which point AC-11(a) becomes a verification.

**GA-2 — cut `harness/Q-0090/integration` by hand from the requirements tip.** Verified absent again
this iteration: `git branch --list 'harness/Q-009*'` returns nothing. `chore.yaml`'s `review` step
diffs `harness/{id}/integration...harness/{id}/implement`, only `integrate` creates that branch, and
since Q-0038 the preflight **refuses** rather than billing — so the run stops at run start. Cut
deliberately rather than from whatever `HEAD` holds, per charter §8 and Q-0037's GA-2.

**GA-3 — correct `backlog/Q-0010-…/ticket.md` §2's four stale figures** to nine files / 2,959 lines /
55% / `smoke.js` 780. The backlog is not agent-writable; AC-11(b) closes the plan's copy only.

**GA-4 — open the successor for the exit table's two zeros.** An unknown or absent command exits 0
(AC-6), and `regressed` shares `completed`'s fallthrough (AC-4(c)). Both are this ticket's *subject*
though not its scope, and each needs a decision about what the code should be rather than a gate fix
— so, per *resolve rather than open a successor*, they are one ticket between them. **None is opened
for colour policy** until a README exists to say what a stranger sees.

**GA-5 — write AC-9's finding into Q-0091's ticket body.** `@quorum/core` is declared as a dependency
and resolves to nothing until Q-0096; Q-0091 is the first sibling that imports it, and an obligation
recorded only in a closed ticket's report expires.

---

## Open questions

**None blocks.** Iteration 1 raised three blockers and one ruling; iteration 2 closed three of the
four by measurement and left one; the gate granted that one, created Q-0096 and ruled the ticket's
shape. What follows is recorded so it is not re-litigated from the 2026-09-01 body.

**Ruled at the gate:** the build system is Q-0096's, seven children rather than six; Q-0090 delivers
the frame as importable modules tested in process; the `npx quorum` acceptance test is withdrawn;
Q-0090 remains the prerequisite for Q-0091 to Q-0094 and is no longer the prerequisite for running
anything; **Q-0095 depends on Q-0096.**

**Ruled in iteration 2 and unchanged:** the `bin` key is `quorum` and the package stays `@quorum/cli`,
with the published name left to Q-0029; the `pnpm-lock.yaml` question dissolves, because the role's
`paths:` list is advisory prompt text rather than an enforced gate and the lockfile moves as
`pnpm install`'s output; one successor covers the two zeros and none is opened for colour.

**One item is genuinely open and is deliberately not a blocker:** whether pnpm will create a `bin`
shim for a target that does not exist yet. AC-1 does not guess — it requires the install to be run and
the result stated, with the erratum channel named if it refuses. That is a measurement an implement
step can take, which is the definition of not-a-blocker.

---

## Risks

**R-1 — the permission allowlist refuses the command an implementer would reach for.**
`.claude/settings.json` allows `Bash(pnpm *)`, `Bash(npm test*)`, `Bash(npm install --prefix spike*)`
and `Bash(node spike/*)`, and **not** `Bash(node packages/*)` (re-verified this iteration). This is
Q-0038's rounds 1 to 3 exactly — three implement rounds and most of $13.86 on a harness
misconfiguration. *Mitigation, and the reason every criterion here is a Vitest test:* the frame is
library code, its tests run in process, and AC-5's one child process is spawned from inside a test
through `node:child_process`, which the allowed `pnpm turbo run test` runs. **Do not write a
verification whose only form is a bare `node packages/…` command.**

**R-2 — the run starts on a red suite.** Live today, reproduced above. GA-1 and AC-11(a). Called out
separately from R-4 because it is not about what this ticket builds: it is about the state the ticket
is handed, and it is the cheapest failure in this document to avoid.

**R-3 — this is a first-pass ticket, so `harness/Q-0090/integration` does not exist.** GA-2. The
preflight refuses at run start rather than billing, so the cost of forgetting is a stopped run rather
than a wasted implement step — but it is a stopped run.

**R-4 — `integrate` runs `commands.install` with `--frozen-lockfile`.** AC-1. A manifest change
without a lockfile change fails the install after the implement step has been paid for.

**R-5 — this ticket blocks four others, and a fifth waits on Q-0096.** Q-0091 to Q-0094 queue behind
it; Q-0095, the cutover and M3 queue behind them and behind Q-0096. **Q-0039 (one run at a time per
ticket) becomes a blocker the moment two siblings run concurrently** — two runs on one ticket share a
worktree and compute the same `nextRunId` — and it is open, at `draft`, with no lock of any kind in
either tree. Q-0096 may run in parallel with the four command children, which makes that collision
more likely rather than less.

**R-6 — the exhaustiveness derivation can pass over a sixth of its subject.** AC-4(b)'s union has a
`z.literal` member and a `z.enum` member; a derivation that reads only literals sees `regressed` and
nothing else. Named as a risk as well as a criterion clause because it is the failure mode this
repository has recorded most often, arriving inside the guard the ticket exists to install.

**R-7 — parser drift.** Adopting an argument-parsing library without fixture-level spike parity would
change flag semantics before any command is ported, silently — AC-2's behaviours 4 and 5 are exactly
what a well-behaved library would "fix".

**R-8 — hidden domain migration.** A frame can absorb helper logic that already belongs to `core`,
creating two sources of truth. AC-8's source guard and ground rule 4 are the check; the implement
report names anything it believed was missing rather than adding it.

**R-9 — a declared dependency that does not resolve is a trap with a delayed fuse.** AC-9 proves the
state and GA-5 writes it into Q-0091, but the assertion is designed to go red when Q-0096 lands. If
its authority line is dropped, that red reads as a regression rather than as the trap closing.

---

## Provenance

**From the claude candidate, and still the backbone.** The four probes and the finding that reframed
the ticket — the workspace emits nothing, Node cannot load its TypeScript, and `bin` has nothing to
point at — which is what produced Q-0096 and therefore this document's shape. The correction to the
ticket body's `spike/src/engine.js:87` row. The exit table reorganised by run status rather than by
source line, with `regressed` → 0 found as an unnamed fallthrough. The derived exhaustiveness check
over `packages/shared`. The seven pinned argv behaviours including the two preserved defects. The
register list and the four stale figures in the development plan. Its finding that the help mechanism
cannot survive an emit is AC-7's premise. R-1, R-3, R-4, R-5 are substantially its risks.

**From the codex candidate.** Named, read-only exit constants as one exported definition rather than a
bare table (its AC-12), now AC-4(a). Parser independence from the invoking shell and terminal (its
AC-9), now AC-2's test clause. No-persistent-side-effects as a criterion rather than an assumption
(its AC-21), now AC-8's third paragraph. "If a domain helper is genuinely absent from core, stop and
report" as a criterion (its AC-20). The negative assertion that a clean-clone test must not resolve a
registry package (its AC-16) — now Q-0096's, and named in that ticket's body. Parser drift (R-7).

**Struck from the codex candidate, with the reason.** Its AC-7 (unknown command → exit 1) contradicts
`spike/bin/harness.js:560–562` and ground rule 3; preserved and registered as AC-6 instead, with the
successor routed to GA-4. Its AC-8 clause requiring "unsupported syntax must produce an explicit parse
error" invents behaviour the spike does not have — the parser has no error path at all. Its AC-10
requiring a demonstrated colour-**disabled** rendering invents a mechanism the helper does not have;
the absence is reported under AC-3 instead. Its AC-1, AC-2 and AC-5 are not independently testable as
written ("appropriate Node executable entry", "deterministic, non-empty help response"). Twenty-four
criteria against a ~ten target is the size failure this gate exists to catch.

**From iteration 1, kept.** The measured correction that **no test pins the absence of `exports` on
`packages/core`** — the eight byte pins are on `src/index.ts`'s content — which is why AC-9 asserts
the manifest's absent keys rather than treating the surface as expensive to open. The ruling that the
help lists only commands the frame dispatches, checked as a **subset** of the registered set. The
finding that the engine registers `SIGTERM` as well as `SIGINT`, carried into AC-4(d) for Q-0094.

**From iteration 2, kept.** The two corrections that changed criteria: `runTerminalStatusSchema` is
module-private and the exported symbol is `runTerminalEventSchema`, so the derivation is retyped off
`RunTerminalEvent['status']`; and `@quorum/core` is unresolvable at typecheck as well as at runtime.
The `[frame]` / `[emit]` tags, which are what let this iteration cut the document without rewriting a
criterion. The unconditional split recommendation, which the gate granted. The `pnpm-lock.yaml`
authority finding, which the gate confirmed independently through Q-0040's E-2.

**Iteration 3's own.** The red suite, reproduced rather than predicted, and its routing to AC-11(a)
and GA-1. The `z.literal` / `z.enum` asymmetry inside AC-4(b)'s union, which turns a derivation into a
check that can pass over a sixth of its subject. The `verdict:` versus `classOf` trap in AC-10(d),
found by getting it wrong first — the audit vocabulary counts ten entangled files and the pinned
identities count nine. The measured unknown in AC-1 about a `bin` target that does not exist yet, with
the erratum channel named instead of a guess. AC-9's authority line, so an assertion designed to
expire says so. And the observation that nothing outside `packages/cli` pins its stub, so replacing
`index.test.ts` moves no register — the opposite of `packages/core`'s index, and worth stating because
a reviewer who knows the `core` story will look for the same cost here.

---

## Appendix A — what was measured this iteration

Everything below was run against `main` at `7a5bece` on 2026-09-01, after the exhaustion gate answered
`retry`.

| claim | source | measured this iteration | verdict |
| --- | --- | --- | --- |
| the workspace suite is green | assumed by both candidates | **red**: `pnpm turbo run test --force --continue` → 6 of 7 tasks successful, `@quorum/shared#test` failed, one assertion — `plan-backlog.test.ts` "every ticket in backlog/ is named in the plan", `[Q-0096]`. `@quorum/core` 1280 passed, 2 skipped | ❌ **new, AC-11(a) / GA-1** |
| `plan-backlog.test.ts` reads git | — | `ticketFiles()` is `fs.readdirSync('backlog')` (`packages/shared/test/corpus.ts:58–67`), so an untracked folder counts; the backlog→plan direction has no exceptions by design | ✅ cause confirmed |
| `docs/06-development-plan.md` names Q-0096 | — | it does not — `grep -rn "Q-0096" docs/` returns nothing | ❌ |
| `backlog/Q-0096-…/` exists with a body | gate ruling | ticket.md present, `stage: draft`, `branch: harness/Q-0096/integration`, body carries the emit finding and the artifact-replay argument | ✅ |
| entangled = nine files / 2,959 lines / 55% | iterations 1–2 | `named('binary-only')` is exactly `['q0036-board-containment.js']` and `named('both')` is exactly eight files (`spike-parity.test.ts:1047–1051`); 220 + 2739 = 2959 of 5428 → 55% | ✅ |
| the `verdict:` field gives the same count | **this iteration's own first attempt** | it does not: `verdict:` is a four-way audit vocabulary counting 2 `cli` / 10 `ported` / 8 `split`, while `classOf` (`:992–993`) computes the three-way class from `reachesBinary` / `importsSource`. Counting verdicts gives **ten** entangled files | ❌ **corrected, recorded in AC-10(d)** |
| `wc -l spike/test/smoke.js` is 780 | iteration 2 | 780 | ✅ |
| plan `:481` says eight files / 2,515 lines / half / `smoke.js` 773 | plan | all four stale; `04-architecture.md:73` already says 55%, so the two documents also disagree with each other | ❌ AC-11(b) |
| `runTerminalStatusSchema` is private, `runTerminalEventSchema` exported | iteration 2 | `const runTerminalStatusSchema` at `events.ts:210`; `export const runTerminalEventSchema = runTerminalStatusSchema` at `:232`; `export type RunTerminalEvent` at `:264`; `index.ts:8` re-exports `./events.js` | ✅ |
| the union's six statuses are reachable by one derivation | assumed | **member 1 is `z.literal('regressed')`, member 2 is `z.enum([...five])`** — a literals-only derivation sees one status and passes | ⚠️ **new hazard, AC-4(b) / R-6** |
| `process.exit(130)` at `engine.js:87` | ticket body | `:111`; `:87` is `diffInputs: new Map(), deferredDiffs: new Map(),`; `process.once('SIGINT'…)` and `('SIGTERM'…)` at `:113–114` | ❌ stale, claim unaffected |
| argv `:25–42`, colour `:44`, `die` `:124` | ticket body | declarations `:25–27`, loop `:28–39`, destructuring `:40`, `gateAnswers` `:42`; escape sequences read out at `:44`; `die` writes via `console.error` and exits 1 at `:124` | ✅ |
| `0`/`1` at `:404`, `:460`; `1` at `:548`; three-way at `:557`; soft `1` at `:499`, `:517`, `:523`, `:531` | ticket body | all exact; `:557` is the single three-way `r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0` | ✅ |
| `packages/cli` is a stub with three scripts | ticket body | manifest has `name`, `version`, `private`, `type`, three scripts; no `bin`, no dependencies; `src/index.ts` is one line; `tsconfig.json` and `vitest.config.js` already exist, so its suite already runs | ✅ |
| something outside pins `packages/cli/src/index.ts` | — | nothing does; its own `index.test.ts` asserts the stub and is this ticket's to replace | ✅ no register moves |
| `@quorum/core` declares no `exports`/`main`/`types`; `tsconfig.base.json` no `paths` | iteration 2 | confirmed; `@quorum/shared` is the only package declaring `exports`, naming `./src/index.ts` for both conditions | ✅ AC-9 |
| `TASKS` in `test-discovery.test.ts` asserts three scripts exist | iteration 2 | `:59`, checked with `not.toBe('')` at `:214–216` — existence, not exclusivity | ✅ additive |
| `CI_JOBS` is an exact seven-key register | iteration 1 | `test-command.test.ts:506` | ✅ |
| `SUITES` is two packages | iteration 1 | `turbo-inputs.test.ts:129–133`, with the claim that the other five read nothing outside | ✅ AC-10(a) |
| `Bash(node packages/*)` is not allowed | iterations 1–2 | confirmed; `Bash(pnpm *)`, `Bash(npm test*)`, `Bash(npm install --prefix spike*)`, `Bash(node spike/*)` are | ✅ R-1 |
| `harness/Q-0090/integration` does not exist | R-3 | `git branch --list 'harness/Q-009*'` returns nothing | ✅ GA-2 |
| `docs/decisions/` ends at 077 | iteration 2 | still 077 — Q-0096 owes the next one, and it is not this ticket's | ✅ |
| the gate answered | runs.log | `gate=human-locked answer=retry`, `counter=requirements.head-of-product set=1` — one further traversal authorised, which is this document | ✅ |

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-12. No API-key path in source, test, fixture, help text or documentation example; a scan proves it. `check()` untouched — this ticket adds no adapter code. |
| **Worktree safety** | n/a to the deliverable; AC-8 asserts the frame writes nothing anywhere. Relevant to the *run*: GA-2 (the integration branch must exist) and Q-0062's cleanup, which now removes what the run obtained. |
| **Gate behaviour** | n/a to the deliverable. Q-0094 owns the gate reader. AC-4 declares the `undecided` → 3 and `aborted` → 2 rows a gate produces; AC-2 carries `gateAnswers` in the frame so no sibling re-parses argv. |
| **File format and schema** | No new file format. AC-4(b) *reads* `packages/shared`'s exported `runTerminalEventSchema` and changes nothing in it. `package.json` and `pnpm-lock.yaml` change under AC-1; `turbo.json` and `tsconfig*.json` do not, being Q-0096's. |
| **Lint rules** | AC-12. `packages/cli` enters ESLint's `packages/**/*.ts` scope, including type-aware `no-deprecated`. `harness lint` (the flow linter) is unaffected — no flow file changes. |
| **Cold-clone impact** | Deferred with the binary. Q-0096 owns the cold-clone path and owes the measured cost of a build step; this ticket adds no step a stranger runs. |
| **Product boundaries** | AC-7. New help text says Quorum and never "harness"; Q-0068's separate defect is preserved and untouched, and the implement report says so. |
| **Cross-vendor rule** | Satisfied by `chore.yaml` — `implement` on claude, `review` on codex. Nothing here changes it. |
