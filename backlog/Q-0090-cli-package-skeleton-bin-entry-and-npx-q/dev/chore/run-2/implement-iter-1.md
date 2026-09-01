# Q-0090 — implement report, run 2, iteration 1

**Written 2026-09-01 in `harness/Q-0090/implement`, against `0773b7e`.**

Twelve criteria, all satisfied. Nothing needed an erratum: both of the document's genuinely open
measurements resolved in favour of what it had provisionally assumed, and the one register question
it declined to predict turned out to have a real answer that changed the shape of the change.

---

## What shipped

`packages/cli` was a stub — `src/index.ts` was one line, the manifest had three scripts and nothing
else, and the suite was one assertion that the stub was a stub. It is now a package with a frame:
**six production modules, eight test files, 79 assertions, 1,406 lines including the two manifests.**
No command is implemented, nothing is executable, and nothing in the package reads or writes a file.

### `packages/cli/package.json` — AC-1

Gains `"dependencies"` (`@quorum/core` and `@quorum/shared`, both `workspace:*`, **no third-party
dependency**), `"bin": { "quorum": "./bin/quorum.js" }`, and `"engines": { "node": ">=22.13.0" }`.
`name`, `private`, `type` and the three scripts are unchanged.

**The `bin` target's *path* is provisional and Q-0096's to confirm; only the key name is fixed
here.** AC-1 spells the key (`quorum`, because that is what the README will type and
`product-boundaries.md` forbids `harness`) and leaves the value as `…`, and the gate ruled the
executable itself to Q-0096. Every string is a guess, so I picked the one that encodes least:
`./bin/quorum.js` mirrors `spike/bin/harness.js`, the repository's existing idiom for where an
executable lives, and assumes no `dist/`-shaped emit — which is exactly the decision Q-0096 owes an
entry for. `package.test.ts` asserts the key, asserts the target ends `.js` (a `bin` pointing at
TypeScript does not run under Node), and asserts the target **does not exist**, with an authority
line naming Q-0096.

### `packages/cli/src/argv.ts` — AC-2

`parseArgv(argv)` → `{ cmd, rest, flags, gateAnswers }`, `spike/bin/harness.js:25–42` line for line.
All seven behaviours preserved, including the two the requirement classes as preserved defects
(behaviour 4, a single-dash token is a positional; behaviour 5, `--` parses as a flag named `''` and
swallows the next token). **No parse error is invented** — the spike has none.

The module JSDoc says why it is not a library: a well-behaved parser would silently fix 4 and 5, and
fixing them before a single command is ported would change flag semantics under the eight commands
about to arrive (non-goal 13).

### `packages/cli/src/colour.ts` — AC-3, colour half

Six functions emitting the exact sequences at `:44`. Both limits are **reported and not fixed**: no
TTY test, and neither `NO_COLOR` nor `FORCE_COLOR` is honoured. No colour-disable mechanism was
added.

### `packages/cli/src/fail.ts` — AC-3, `die` half, and AC-5

Three exports, and they are three because the mechanisms are:

- `die(message): never` — `console.error(c.red('✗ ') + message)` then `process.exit(ERROR)`. The
  space sits **inside** the red span, unlike every other call site in the spike, and is preserved
  with an authority line.
- `failSoftly(): void` — `process.exitCode = ERROR`, the mechanism the four `runs` warning paths
  (`:499`, `:517`, `:523`, `:531`) rely on.
- `dieOnUnexpected(error): never` — `spike/bin/harness.js:569`'s `main().catch((e) => die(e.stack ??
  String(e)))`, preserved as a named handler because the binary that wires it is Q-0096's.

### `packages/cli/src/exit.ts` — AC-4

Five named read-only constants (`SUCCESS`, `ERROR`, `ABORTED`, `UNDECIDED`, `SIGNAL`), an `ExitCode`
union of them, and `EXIT_CODE_FOR_STATUS` typed `Readonly<Record<RunTerminalEvent['status'],
ExitCode>>` — so a seventh status added to `@quorum/shared` fails to compile here rather than
falling through to `SUCCESS`, which is exactly how `regressed` came to share `completed`'s code.
`regressed: SUCCESS` carries its authority line. `SIGNAL` is a row and nothing more; no handler is
installed.

### `packages/cli/src/commands.ts` — AC-7

`COMMANDS` (`['help']`), the `Command` type, `isCommand`, and `HELP` as **owned data**. The spike's
mechanism — reading the binary's own source and slicing lines 1–10 — is gone, because it cannot
survive any emit strategy and would have arrived inside Q-0096 as an unrelated surprise. The text
says Quorum, never harness, and lists only `help`, which is the only command the frame dispatches.

### `packages/cli/src/main.ts` — AC-6, AC-8

`main(argv): Promise<void>`, a `HANDLERS` table keyed by `Command`, and the preserved `default`
behaviour: an unknown or absent command prints the help and returns, so the process exits 0.

**Two design points that are load-bearing rather than stylistic, both stated in the module JSDoc.**
`main` returns nothing rather than an exit code: a `main` returning a number would be spent as
`process.exit(main(argv))`, and that call overrides `process.exitCode` — collapsing the two
mechanisms `fail.ts` exists to keep apart, which is precisely what AC-5 forbids. And `main` is
`async` with nothing to await, because `:569` is `main().catch(…)` and the uncaught-rejection path
needs a promise to attach to.

`HANDLERS` being `Record<Command, …>` is what stops the registry and the dispatch drifting: a
handler added without its name fails to compile, and a name added without its handler fails to
compile too. That coupling is what `commands.test.ts`'s help check relies on.

### `packages/cli/src/index.ts`

Was `export const name = '@quorum/cli'`. Now re-exports the six modules. Appendix A's finding held:
nothing outside this package pins it, so no register moved — the opposite of `packages/core`'s
index, and worth saying because a reviewer who knows that story will look for the same cost here.
`src/index.test.ts`, which asserted the stub, is deleted.

### `packages/cli/turbo.json` — new, and the answer to AC-10(a)

Declares `$TURBO_DEFAULT$`, `../../pnpm-lock.yaml` and `../../package.json`, and nothing else — no
`env`, no `outputs`, so root `turbo.json` stays the one place `env` is decided and the merge keeps
`QUORUM_REAL_CLI`. Verified from turbo's report rather than from the file's text: **21 inputs, both
declared paths present, `env: ["QUORUM_REAL_CLI"]`, `dependsOn: ["^test"]`.**

---

## The two open measurements, and how they came out

### AC-1 — will pnpm accept a `bin` naming a target that does not exist?

**Yes, and no erratum is owed.** Measured rather than reasoned about:

```
pnpm install                     → Done. lockfile importer packages/cli populated (8 insertions)
pnpm install --frozen-lockfile   → Lockfile is up to date … Done. exit 0
ls node_modules/.bin             → acorn eslint tsc tsserver turbo vite vitest yaml   (no `quorum`)
```

pnpm exits 0 and creates **no shim**, and the reason is worth recording rather than the result
alone: pnpm links a workspace package's `bin` into a *dependent's* `node_modules/.bin`, and nothing
in this workspace depends on `@quorum/cli`, so pnpm is never asked to resolve the target at all. The
`bin` line stays here; Q-0096 inherits it with the target still to build.

### AC-10(a) — does the tmpdir fixture earn a `SUITES` entry, a `READ_BASES` base, or neither?

**Neither, for the fixture — but the criterion's question was narrower than the situation, and the
honest answer moved the change.** The measurement is per read, not per suite:

| what the CLI suite reads outside itself | hashed by | verdict |
| --- | --- | --- |
| `os.tmpdir()` — AC-5's two children, AC-8's project fixture | nothing, and nothing can | not a repository path; turbo cannot hash it, so it is neither an input nor a `READ_BASES` base |
| `packages/core/package.json` — AC-9 | the `@quorum/core#test` edge | covered |
| `packages/shared/package.json` — AC-9 | the `@quorum/shared#test` edge | covered |
| `tsconfig.base.json` — AC-9 | root `globalDependencies` | covered |
| `pnpm-lock.yaml` — AC-1 | **nothing this package declares** | reaches the task only through `@quorum/core#test`'s own input list, which is not this package's to rely on |
| root `package.json` — AC-1 | **nothing at all** | no task in the workspace declares it |

So the tmpdir answer is "neither", and it is the same shape as Q-0070's `command.ts`: a directory the
test created, which earned a `READ_BASES` *entry* rather than an input — and `READ_BASES` is keyed by
files inside the two scanned directories, which `packages/cli` is not one of.

The two escaping reads are a different matter, and they are a real under-declaration: a cache hit on
`@quorum/cli#test` would have claimed that nothing it reads had changed while the root manifest and
the lockfile were both invisible to it. Hence `packages/cli/turbo.json`.

**`@quorum/cli` does not become a third `SUITES` member, and that is a decision rather than an
omission.** The three floors clause A and clause B carry are calibrated for the two large suites:
`inputs.size > 24`, a `MANIFEST` of more than five named reads, and `scanFiles(directory).length >
5`. Measured, `@quorum/cli#test` has **21 inputs and 2 manifestable reads** — the other three are
edge- or global-covered, which `MANIFEST`'s own documentation says are deliberately omitted. Adding
it would mean re-deriving two floors written by another ticket to protect against exactly the
failure they would then stop protecting against ("an empty input set is not a small one"). That is
somebody else's guard, and it belongs to whichever ticket grows this package — realistically Q-0091,
which adds the first four commands and their tests.

What I did instead is correct the sentence that stopped being true.
`packages/core/src/turbo-inputs.test.ts`'s `SUITES` said *"The two packages whose suites read
outside themselves. The other five read nothing outside."* It now says which two are **audited
here**, that `@quorum/cli` reads outside and declares it, what the floors are and why widening them
is not this ticket's, and that its declaration is checked by its own suite. **This is a comment
change and no assertion moved.** A register that quietly stops covering something is the defect that
file exists to close, so leaving the old sentence standing was not an option, and neither was
widening the guard on the way past.

The declaration is kept honest from this side by `package.test.ts`'s AC-10(a) block, which carries
the five-read audit with a reason each, asserts the two undeclared ones appear in `turbo.json`, and
asserts every path in the audit still exists — so the register cannot rot in either direction.

---

## The check that could have passed over a sixth of its subject — AC-4(b), R-6

The requirement was right that this is where the ticket's own guard could fail, and the shape of the
answer is the part worth reading.

`runTerminalEventSchema` is a `z.discriminatedUnion` whose first member is
`status: z.literal('regressed')` and whose second is `status: z.enum([…five])`. A derivation that
walked the members looking for literals sees **one** status, compares it against a one-key map, and
passes.

**The derivation does not walk the members at all.** It hands the schema
`{ type: 'terminal', status: '__no_such_status__' }` and reads the `invalid_union` issue zod raises,
which carries `options: ['regressed', 'completed', 'aborted', 'failed', 'interrupted', 'undecided']`
— zod's own discriminator index, built from *both* members. No member shape is privileged, and a
member that changed from a literal to an enum or the reverse would still be read. It throws rather
than returning an empty list wherever the schema declines to answer, because a derivation that
quietly yielded nothing would make every comparison in the file vacuous.

**`packages/cli` declares no third-party dependency, so there is no zod here to build fixture unions
with.** That ruled out the obvious "remove a status from each member" fixture, and the replacement is
better rather than merely available: the file defines the two **one-sided derivations** R-6 names —
`literalMembersOnly` and `enumMembersOnly` — and runs each over the *real* schema:

- `literalMembersOnly()` is exactly `['regressed']`, one of six, and the table's key set is asserted
  **not** to equal it;
- `enumMembersOnly()` is exactly the five, never contains `regressed`, and the key set is asserted
  not to equal it either;
- and `discriminatorValues()` is asserted to equal the two concatenated and sorted — so nothing is
  dropped and nothing invented.

Each member is shown to be load-bearing on its own, which is what "shown red for each separately"
buys, and it is demonstrated against the shipped subject rather than against a fixture.

The compile-time half of AC-4(a) is demonstrated too, since no assertion can reach it: a
`@ts-expect-error` sits over a `Record<RunTerminalEvent['status'], ExitCode>` literal that omits
`interrupted`, so the refusal is exhibited rather than described.

---

## Things worth a reviewer's attention

**Vitest intercepts `console`, so the first version of `die`'s test proved nothing.** Spying on
`process.stderr.write` never fired, because Vitest routes console output through its own
interception before it reaches the stream. Spying on `console.error` instead would have asserted the
*function* and not the *stream*, which is what AC-3 asks for. Both test files now bind
`globalThis.console` to a real `node:console` over two distinct `Writable` sinks they own, so the
bytes have to arrive in one stream or the other and "writes to stderr" is a claim about the stream.
`die` is asserted to put nothing on stdout, which is the half that makes it the error stream rather
than merely a stream.

**AC-5 is demonstrated and the assertion is deliberately loose in one direction.** Two `.mjs`
children written to a fresh `mkdtemp` directory, each writing a 1 MiB payload and then ending —
one with `process.exitCode = 1`, one with `process.exit(1)`. Both exit 1, which is what makes the
difference between them about output; the soft child's stdout arrives **complete** (`toBe(1048576)`)
and the hard child's is asserted `toBeLessThan(PAYLOAD_BYTES)` rather than at an exact count, so
what is pinned is that output was lost and not how much. Non-goal 12 stands: POSIX only, not claimed
for Windows.

**AC-7's mechanism check is anchored on the import, not on the call.** Scanning `commands.ts` and
`main.ts` for the strings `readFileSync` / `import.meta.url` would have gone red on the JSDoc that
*describes* the spike's mechanism — a guard firing on text it does not execute, which is the same
defect as one that can be talked out of firing by it (Q-0079 round 1). It scans for
`import … from 'node:fs' | 'node:url' | 'node:path'` instead: without a filesystem reader there is
no `readFileSync`, and without `node:url` there is no `fileURLToPath`. The clause is shown to have a
subject by matching against the test file itself, which does import one.

**Two guards refuse to run over a missing subject rather than reporting success.** The BYOS scan
asserts that its self-exclusion selects **exactly** `frame.source.test.ts` and nothing else, so the
exclusion cannot grow into a filter; and the `DOMAIN` scan is shown to match all thirteen symbol
names where they are written down, so the regexes are known to match real text rather than never
matching anything.

**One runtime check counts before and after rather than asserting zero.** AC-4(d)'s "nothing is
listening" test records `process.listenerCount('SIGINT'|'SIGTERM')`, imports the frame, and asserts
the counts are unchanged. Asserting `0` would have made the verdict a property of whatever the test
runner installs for itself, which is the rule this repository wrote down on 2026-08-30.

---

## AC-11 — the two documents

**(a) is a verification, not an edit, and I ran it rather than assuming it.** The Q-0096 bullet
already stands in `docs/06-development-plan.md` at lines 487 and 522, landed at the gate as GA-1
recommended, so `plan-backlog.test.ts` is green: the first forced run on the untouched tree reported
**7 of 7 turbo tasks successful, 0 cached**, with `@quorum/shared` passing. The requirement's own
Appendix A had reproduced it red an iteration earlier; it is green now, and the run did not start on
a red suite.

**(b) is done, and the four figures were re-derived rather than transcribed.** `:481` said *"2,515
lines across eight `spike/test/` files … half the spike suite by line, `smoke.js`'s 773 among
them."* All four were stale. Re-derived from `spike-parity.test.ts`'s pinned identities — one
`binary-only` file plus eight `both`, 220 + 2,739 of 5,428 — the sentence now reads **nine files,
2,959 lines, 55%, `smoke.js`'s 780**, and says where the numbers come from, that
`04-architecture.md:73` already said 55% so the two documents had drifted from each other as well,
and that `backlog/Q-0010-…/ticket.md` §2 carries the same four and is the human's to correct.

I re-derived the pins by **breaking one and reading the actual** rather than by trusting a green
tick: `expect(linesOf(named('binary-only'))).toBe(-1)` reports `expected 220 to be -1`, so 220 is
computed from the tree and not read back from the literal. The pin was restored immediately and the
whole assertion — 220 / 2,739 / 2,469 / 5,428 / 55% — passes, which is the same measurement for the
other four. **This ticket translates no `spike/test/` file, and none of the five moved.**

**One edit beyond AC-11's letter, flagged rather than slipped in.** Q-0090's own bullet at `:503`
promised *"the frame and a binary that runs from a clean clone, which is also M6's cold-clone
path"*, which the gate ruling had already falsified before this run started. Leaving it would have
made the plan lie about this change in the same commit that lands it, against *"when code and docs
disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them in the same change"*.
It now states what the deliverable is, quotes what it used to say, and names the ruling. The status
line at the top is bumped with both corrections, per the living-document convention.

**What I did not touch in the plan:** `:483`'s *"the cut was agreed on 2026-09-01 and the six
children exist, Q-0090 to Q-0095"*. It reads as a statement about the cut as agreed, and `:487`
already adds Q-0096 as the seventh child opened later. It is not one of AC-11(b)'s four figures and
correcting it is a judgement about how that paragraph should be phrased, not a stale measurement.

## AC-10 — the other three registers

| register | outcome |
| --- | --- |
| `test-discovery.test.ts` (b) | **Nothing moved.** `TASKS` asserts the three scripts *exist* (`not.toBe('')`), not that only three do, and `PACKAGES` is derived from the workspace globs. `packages/cli` already declared all three and its `src/**/*.test.ts` files are already collected by the configured include. Green forced. |
| `test-command.test.ts` (c) | **Nothing moved.** This ticket adds no CI job; `CI_JOBS` is still the same exact seven-key register. Green forced. |
| `spike-parity.test.ts` (d) | **Nothing moved**, re-derived as above. |

I also checked, before adding `packages/cli/turbo.json`, that nothing enumerates `packages/*/turbo.json`
— `test-command.test.ts` reads the root one only — so the new file moves no register of its own.

---

## AC-12 — the cross-cutting pillars, run rather than claimed

- **BYOS.** Nine credential spellings scanned across every `.ts` in `packages/cli/src`, source and
  test alike, with the guard excluding only itself and the exclusion asserted to select exactly one
  file. Zero occurrences. No adapter is probed by any frame invocation; `check()` is untouched.
- **Lint and typecheck.** `pnpm turbo run lint typecheck --force` green over the new package, which
  falls inside ESLint's `packages/**/*.ts` scope. No `any`. One `@ts-expect-error`, with its reason
  on the same line — and it is load-bearing rather than a suppression, because an unused
  `@ts-expect-error` is itself an error, so when Q-0096 opens `packages/core`'s export surface
  `tsc` fails there too. The trap closes loudly at typecheck as well as at runtime.
- **Both suites, forced, in both environment rows** (Q-0072's closing finding). In the bare row this
  worktree is — neither `.harness/worktrees` nor `.quorum/runs` — **21/21 turbo tasks, 0 cached**,
  and **spike 19/19**. Then both directories created by hand and everything re-run: **21/21, 0
  cached**, **spike 19/19**. Both removed again; `git status` clean of them. The second row of
  Q-0072's real check — on `main` after the merge — is `integrate`'s and the human's.
- **The git-identity sweep.** `pnpm sweep:git-identity` → *"both suites executed and green with no
  resolvable git identity"*. No test here builds a repository, so no `-c` was needed; the new test
  files enter `git-identity.test.ts`'s corpus automatically, since it walks `packages` recursively
  for `*.test.ts`, and they raise the corpus floor rather than lowering it.
- **Vocabulary and boundaries.** The help text says Quorum and never harness; no SaaS product is
  named; no new file format, schema, flow rule, gate behaviour or adapter contract is introduced.
  `harness lint` was not run because no flow file changed.

---

## What I deliberately left alone

- **`spike/src/` and `spike/test/`** — ground rules 1 and 2. `git diff --name-only HEAD -- spike/`
  is empty. No freeze re-record is owed.
- **`backlog/`** — ground rule and role file. `backlog/Q-0010-…/ticket.md` §2 carries the same four
  stale figures AC-11(b) fixed in the plan and is GA-3's; I named the obligation in the plan's own
  text so it does not expire in a report.
- **`docs/decisions/`** — the human's. Q-0096 owes the build-system entry; nothing here implies a
  second one.
- **Every command.** `board`, `lint`, `validate`, `adapters` (Q-0091); `runs` (Q-0092); `init`,
  `ticket` (Q-0093); `run` and the gate reader (Q-0094). I implemented none to have something to
  demonstrate — `help` exists because AC-7 requires the help to list only what the frame dispatches,
  and it is the frame's own output rather than a command over `core`.
- **The signal handler.** Q-0094's. The frame declares the `130` row and asserts nothing registers a
  handler, in source and at runtime.
- **The four preserved defects** — Q-0059, Q-0060, Q-0066, Q-0068 — untouched. Writing `quorum`
  rather than `harness` in **new** help text is not a fix for Q-0068, whose subject is the BYOS
  refusal string in `claude.js:12` / `codex.js:21` and their ported twins; those are untouched and
  the distinction is written into `commands.ts`'s JSDoc so a reviewer does not read correct new text
  as an unauthorised fix.
- **The three the ticket registers and does not fix** — the unknown-command zero (AC-6),
  `regressed → 0` (AC-4(c)) and the colour policy (AC-3). Each carries an authority line where the
  behaviour lives, and the first two are routed to GA-4.
- **`packages/core/src/turbo-inputs.test.ts`'s assertions.** Only the `SUITES` JSDoc sentence
  changed. No floor was weakened and no suite was added.
- **No domain helper was copied, and none was found missing.** Ground rule 4 held: the frame needed
  nothing from `core`, and `frame.source.test.ts` enforces that no production module here names
  `runFlow`, `Backlog`, `loadProject`, `getAdapter`, `probeAdapter`, `containment` or the seven
  others.

## Still open, for the gate

- **GA-3** — `backlog/Q-0010-…/ticket.md` §2's four figures → nine files / 2,959 lines / 55% /
  `smoke.js` 780. Not agent-writable.
- **GA-4** — one successor for the exit table's two zeros (unknown command exits 0; `regressed`
  shares `completed`'s fallthrough). Both are registered in code with authority lines.
- **GA-5** — AC-9's finding into Q-0091's ticket body: `@quorum/core` is declared and resolves to
  nothing until Q-0096, and Q-0091 is the first sibling that imports it.
- **New, from this run:** `@quorum/cli#test` reads outside itself and declares it, but is **not**
  audited by `turbo-inputs.test.ts`'s clauses A, B or C. Widening `SUITES` to a third member needs
  its three floors re-derived, which is the work of whichever ticket grows this package. Written
  into the `SUITES` JSDoc where the next person editing it will look, and named here so it is not
  only in a comment.
