# Q-0090 — CLI package skeleton, `bin` entry and `npx quorum`

**Requirement, run 1, candidate: claude. Written 2026-09-01 against the tree at `main` (`7a5bece`).**

Every figure below was measured today. Where it contradicts the ticket body, the ticket body is
named and the measurement is shown, because this repository has been wrong three times in a week
about what a body contains — and once, here, within an hour of writing one.

---

## Problem

`packages/cli` is a stub. `src/index.ts` is `export const name = '@quorum/cli';`, its
`package.json` declares three scripts and nothing else, and its whole test suite asserts that the
stub is a stub. Five sibling tickets — Q-0091 to Q-0095 — cannot start until it is a package that
runs.

That much the ticket body says. What the body does not say, and what changes the size and the
route of this ticket, is measured in three probes:

**1. Nothing under `packages/**` has ever been executed by Node.** There is no `build` script in
any of the seven packages or in `apps/web`; `turbo.json` declares `lint`, `typecheck` and `test`
and no fourth task; `tsconfig.base.json` sets no `outDir` and no `declaration`; every package's
`typecheck` is `tsc --noEmit`. Vitest — through Vite's transform — is the only thing that has ever
loaded a `.ts` file in this workspace. `packages/core/src/shared-resolution.test.ts:3–6` states
this in the repository's own words, written at Q-0041: *"no package declared `exports`,
`turbo.json` has no `build` task and `tsconfig.base.json` emits nothing, so `@quorum/shared`
resolves from its TypeScript source."* One of those three clauses has since changed —
`@quorum/shared` now declares `exports` — and it is the only package in seven that does.

**2. Node cannot run this workspace's TypeScript, and the reason is not the one you would guess.**
Run from `packages/core`, which does declare the dependency:

```
$ node --input-type=module -e "import('@quorum/shared')…"
FAIL ERR_MODULE_NOT_FOUND | Cannot find module
  '…/packages/shared/src/constants.js' imported from '…/packages/shared/src/index.ts'
```

Node **found** the package, **loaded** `index.ts` and **stripped its types** — and then failed,
because the source writes `./constants.js` and `moduleResolution: nodenext` maps that to
`constants.ts` at compile time while Node's type stripping does no such mapping. The workspace's
extension convention is a compile-time convention with no runtime counterpart. Every one of
`shared`'s nine re-exports and every cross-file import in `core` has this shape.

**3. The `npx` path is closed a second time, independently.** `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`
is present in the Node binary: Node refuses to strip types for a file under `node_modules`, which
is precisely where `npx` unpacks a package. The workspace symlinks pnpm creates are resolved to
their real paths before that check, which is why probe 2 got as far as it did and why a
symlink-based test would not have found this.

So **Q-0090 is not "add a `bin` field to a manifest."** It is the ticket that introduces emitted
JavaScript to a workspace that has never emitted anything, and that is a change to
`docs/04-architecture.md`'s shape rather than a change inside one package. §OQ-1 routes it.

Two further gaps, smaller and equally load-bearing:

**`@quorum/core` exports nothing.** Its `package.json` has no `exports` and no `main`;
`src/index.ts` is one line. The ticket requires `@quorum/cli` to depend on it. The dependency is
declarable and **not resolvable**, and the first sibling that imports it — Q-0091, for `board` —
discovers that instead of inheriting it. `src/index.ts` is byte-pinned by **eight** tests across
seven files (`adapters`, `backlog`, `contracts`, `fanout`, `git`, `lint`, `run-history` source
tests, plus `packages/shared/src/index.test.ts:68`), each carrying a comment saying its own child
added no public re-export. Opening that surface is a deliberate act against eight landed pins, not
an incidental one. §OQ-3 routes it.

**`npx quorum` cannot mean what it says today.** All seven packages and `apps/web` are
`"private": true`. Nothing is published; `npm publish` is Q-0029's, in M6. The root
`package.json` already holds the name `quorum` (private, and not a workspace member). An
acceptance test written as *"run `npx quorum`"* would either fetch a stranger's package from the
registry or be quietly reinterpreted into something weaker — which is *"a check that skips its
subject must not report success"* (2026-08-25) arriving in this ticket's headline criterion.
§OQ-2 routes it.

### What is *not* the problem

The domain logic. Q-0010 §1 checked eleven helpers by name and found all eleven already in
`packages/core`. Nothing in this ticket ports a helper. What is unbuilt here is a frame: argv, a
colour helper, `die`, an exit-code table, a `bin` entry, and the packaging that makes the binary
run.

---

## User stories

**`adopter` (cold-clone adopter).** I clone the repository, follow the README, and the first
command in it produces output rather than a module-resolution stack trace. I never have to know
that the project is written in TypeScript, and I am never asked for an API key.

**`maintainer` (solo maintainer).** I wrap `quorum run` in a shell script. Its exit code tells me
which of five things happened — it finished, it errored, a human stopped it, nobody answered a
gate, or I interrupted it — and that mapping is one table in one file rather than nine
`process.exit` calls I have to find by reading.

**`contributor` (adapter contributor)** and the five sibling tickets. I add a command by writing
one module against a frame that already parses argv, already owns the error path, and already owns
the exit codes. I do not invent a second flag parser, and I cannot introduce a sixth exit code by
accident.

---

## Acceptance criteria

Surfaces: **CLI** (`packages/cli`), plus repository configuration (`turbo.json`, `tsconfig*.json`,
`pnpm-lock.yaml`, `.github/workflows/ci.yml`) and **docs**. No `harness/` or `backlog/` surface is
named by any criterion.

Criteria AC-2, AC-8 and AC-10 depend on rulings owed at the gate (§OQ-1, §OQ-3, §OQ-2). Each states
what it asks under either ruling, so the criterion is testable once the ruling exists and is
*not* a criterion an implement step could satisfy by choosing for itself.

---

**AC-1 — `packages/cli` is a real workspace package, and the lockfile moves with it.**

`packages/cli/package.json` declares:

- `"bin"` mapping the command name (§OQ-6) to the executable entry;
- `"dependencies"`: `"@quorum/core": "workspace:*"` and `"@quorum/shared": "workspace:*"`, and no
  third-party dependency;
- `"files"`, so a pack contains the runnable artifact and not `src/**` alone;
- `"type": "module"` and an `"engines".node` floor consistent with the root's `>=22.13.0`.

`pnpm-lock.yaml` line 35 currently reads `packages/cli: {}`. It gains an importer block in the
**same commit**, or `commands.install`'s `pnpm install --frozen-lockfile` fails in the `integrate`
worktree and the run stops after paying for the implement step.

*Test:* `pnpm install --frozen-lockfile` from a clean checkout of the branch exits 0; a test reads
`packages/cli/package.json` and asserts the two workspace dependencies and the absence of any
other; a test asserts the lockfile's `packages/cli` importer is non-empty.

*Authority:* `pnpm-lock.yaml` is **not** in `developer-generalist`'s `paths`
(`harness/roles/developer-generalist.md:2`). It is authorised here by name, for this change only,
and the change is limited to workspace importer entries. A lockfile diff containing a new
third-party package is a blocker, not a nit.

---

**AC-2 — the binary runs under Node, from this repository, with no loader flag.**

Whatever §OQ-1 rules, the following holds: from a clean clone, after `pnpm install`, invoking the
CLI's `bin` target through Node prints the help text and exits 0 — with no `--experimental-*` flag,
no `NODE_OPTIONS`, and no loader.

Under the recommended ruling (emit JavaScript) this additionally means: a `build` task exists in
`turbo.json` with its `outputs` declared; `test`, `lint` and `typecheck` relate to it such that a
suite never runs against a stale or absent emit; **no new third-party dependency is added** —
`typescript` is already a root `devDependency`; and `dist/` needs no `.gitignore` change, being
ignored already.

*Test:* a Vitest test in `packages/cli` spawns the `bin` target with `node` through
`node:child_process`, asserts exit 0 and asserts the first line of stdout. It must run inside the
ordinary suite, so `integrate` sees it — a proof that exists only as a command in an implement
report is not a test. **Demonstrate red before green:** the same test against the pre-change tree
must fail, and the failure must be the resolution error probe 2 produced rather than a missing
file.

---

**AC-3 — argv parsing is preserved exactly, including the four behaviours nobody would choose.**

`spike/bin/harness.js:25–39` is the specification. Seven behaviours, each pinned separately:

1. `process.argv.slice(2)`; tokens not starting with `--` are collected as positionals in order,
   and `const [cmd, ...rest] = positional`.
2. `--k v` sets `flags.k = 'v'` when `v` does not start with `--`; otherwise `flags.k = true` and
   `v` is re-parsed as the next flag.
3. **Only `gate-answer` accumulates**, into an array, in command-line order. Every other flag is
   last-wins. (`:32–36`, Q-0033.)
4. A single-dash token is a **positional**, not a flag: `-v` lands in `rest`. The test is
   `startsWith('--')` and nothing else.
5. `--` is **not** a terminator: it parses as a flag named `''` and swallows the following token as
   its value.
6. Flag values are strings or the boolean `true`; nothing is coerced to a number.
7. Repeated positionals are all kept; nothing is de-duplicated.

Behaviours 4 and 5 are preserved defects under ground rule 3, reported and not fixed. They are
pinned so a later change to either is deliberate.

*Test:* a table-driven test over argv arrays, one row per behaviour, asserting the parsed
`{cmd, rest, flags, gateAnswers}` shape. Behaviours 4 and 5 carry an authority line naming this
criterion.

---

**AC-4 — `die` and the colour helper are preserved byte for byte, and their two known limits are
registered.**

- The colour helper is six functions — `dim`, `bold`, `amber`, `green`, `red`, `teal` — emitting
  exactly the escape sequences at `spike/bin/harness.js:44`.
- `die(m)` writes `c.red('✗ ') + m` to **stderr** and exits 1. The space is inside the red span,
  unlike every other call site in the file, and that is preserved.
- An uncaught rejection reaches `die(e.stack ?? String(e))` (`:569`), so an unexpected throw prints
  a Node stack through the error path and exits 1. Preserved.

Two limits are **reported and not fixed**: the helper performs no TTY test, so escape sequences are
written into a pipe or a file; and it honours neither `NO_COLOR` nor `FORCE_COLOR`. Both are
current behaviour on the cold-clone path. §OQ-5 asks whether a successor is owed.

*Test:* assertions over the exact escape sequences and over `die`'s stream, message shape and exit
code, each naming this criterion.

---

**AC-5 — the exit-code table is one owned artifact, organised by run status, and exhaustive.**

The ticket body's table is organised by *code → source line*, which is how it was measured and not
how it can be enforced. Reorganised by what actually decides a code, over the six members of
`RunStatus` (`packages/core/src/engine/types.ts:63`):

| run status | code | how it is reached in `spike/bin/harness.js` today |
| --- | --- | --- |
| `completed` | `0` | fallthrough of the three-way at `:557` |
| `regressed` | `0` | **the same fallthrough** — `regressed` is named nowhere in the expression |
| `aborted` | `2` | `:557` |
| `undecided` | `3` | `:557`, added by Q-0040 on 2026-09-01 |
| `failed` | `1` | never via `:557`; via `die` at `:124`, from the `catch` at `:558` or from `main().catch` at `:569` |
| `interrupted` | `130` | **not the CLI's at all today** — `spike/src/engine.js:111` calls `process.exit(130)` from its own `SIGINT` handler |

Non-status exits, preserved: `lint` exits `0`/`1` at `:404`; `validate` exits `1`/`0` at `:460`;
`run`'s lint preflight exits `1` at `:548`.

The criterion:

(a) **One table, in one module**, mapping run status to code. It is typed such that a seventh
`RunStatus` member fails to compile rather than falling through to 0.

(b) **Exhaustiveness is derived, not transcribed.** A test extracts the status literals from
`packages/shared`'s `runTerminalEventSchema` (`packages/shared/src/events.ts:210–223`, a
discriminated union whose two members carry `regressed` and the other five) and asserts the table's
key set equals it. A status added to `shared` and not to the table turns the suite red without
anyone remembering. *This is why `@quorum/shared` is the dependency that must resolve first;
`@quorum/core` is not needed for it.*

(c) **`regressed` → 0 is preserved and registered**, with an authority line. It is current
behaviour and it is not obviously right; ground rule 3 forbids fixing it here.

(d) **`130` is a row of this table.** The handler that produces it is Q-0094's — `core` installs no
signal handler (Q-0050 AC-5, `docs/04-architecture.md` principle 2), so it becomes the CLI's. The
table declares the code; the sibling wires a producer to it. A test asserts the row exists.

(e) **Hard exit and soft exit are two mechanisms and stay two.** `process.exitCode = 1` at `:499`,
`:517`, `:523`, `:531` sets the status and lets the process finish writing; `process.exit`
truncates. The table exposes both, and a test **demonstrates the difference** rather than asserting
it: a child that sets the soft code and then writes a large payload to stdout exits 1 with the
payload complete, and the same child using `process.exit` loses it.

*Test:* the derivation in (b); a mutation test for (a) — adding a status to the fixture union fails
the guard; assertions for (c), (d); and the two-child demonstration for (e).

*Correction to the ticket body, stated because the body forbids re-deriving its table from any
other source:* five of its six rows verify exactly at the line numbers given (`:124`, `:404`,
`:460`, `:499`, `:517`, `:523`, `:531`, `:548`, `:557`). The sixth is stale — `process.exit(130)`
is at `spike/src/engine.js:111`, not `:87`; line 87 today is `diffInputs: new Map(), …`. The row's
*claim* is unaffected. It is the one row pointing outside the file the body measured, which is
exactly the shape of the error the body warns about, one file over.

---

**AC-6 — an unknown or absent command prints help and exits 0, preserved and pinned.**

`spike/bin/harness.js:560–562`: the `default:` branch prints usage and returns, so `main()`
resolves and the process exits 0. `quorum`, `quorum nonsense` and `quorum --help` all exit 0.

This is preserved under ground rule 3 and **registered as a defect**, because a shell script cannot
distinguish "did the thing" from "did not understand you". §OQ-5 asks whether a successor is owed.
It is registered rather than quietly carried, because this ticket's whole deliverable is the exit
table and a row nobody wrote down is the row that is wrong.

*Test:* three invocations, each asserting exit 0 and non-empty stdout, each naming this criterion.

---

**AC-7 — the help text is owned data, and it says Quorum.**

`:561` produces help by **reading the binary's own source file** and stripping `// ` from lines
2–10. That mechanism cannot survive AC-2 under any ruling: emitted JavaScript does not carry the
comment block at those line numbers, and reading `import.meta.url`'s file from inside a package
under `node_modules` is not a thing to build a help system on.

So the mechanism changes and the **content is preserved**: the help lists the same eight commands
with the same usage lines and the same ordering.

Two constraints on the text:

- It **must not** call the product a harness. `.claude/rules/product-boundaries.md` and
  `harness/product-context.md` forbid it; the spike's first help line is
  `harness — spike CLI. Commands:` and the command names inside it are `harness …`. Writing
  `quorum` is **not** fixing Q-0068 — that ticket's subject is the BYOS refusal string in
  `claude.js:12` / `codex.js:21` and their ported twins, which this ticket does not touch. Say so
  in the implement report so the reviewer does not read new correct text as an unauthorised fix.
- Because no command is implemented here (AC-8), the help lists what the CLI *will* accept and each
  unimplemented command must be honest about that when invoked, or must not be listed. Pick one and
  state which; do not list a command that silently exits 0 through AC-6's default branch, which
  would be a green tick over a subject that does not exist.

*Test:* the help constant is asserted to contain the eight command names and to contain no
occurrence of the word `harness` outside a path literal such as `harness/harness.yaml`; the
mechanism is asserted **not** to read its own source (no `fileURLToPath(import.meta.url)` +
`readFileSync` pair in the help path).

---

**AC-8 — no command is implemented, and a guard says so.**

The deliverable is the frame plus help. `board`, `ticket`, `init`, `run`, `lint`, `adapters`,
`validate` and `runs` are Q-0091 to Q-0094.

*Test:* a source-level guard over `packages/cli/src/**` asserting that no file imports a
run-executing or backlog-writing symbol, and that the module set is the frame's — the shape
`packages/core/src/engine/q0050.source.test.ts` uses, with its file list **derived from the
directory** rather than hand-written, which is the failure Q-0051 found in that file.

---

**AC-9 — the two `spike/bin/harness.js` behaviours the frame owns and the siblings must not
re-derive are extracted with their reasons.**

`gateAnswers` (`:42`) is a queue the frame owns even though only `run` consumes it, because argv
parsing is here. `flags.project` is read by `loadProject` (`:55`) and by nothing else. Both are
frame-level and are declared here so that Q-0091 to Q-0094 inherit them rather than each parsing
argv again.

Nothing else moves. `findProject`, `loadProject`, `lintDirectory`, `containment`,
`overrideAdapters` and the six run-history readers stay in `packages/core` (Q-0010 §1, eleven of
eleven).

*Test:* the flag surface the frame exposes is asserted as an identity — an exact list, not a
count — so a sibling adding a frame-level flag is a visible act.

---

**AC-10 — whether `@quorum/core` is importable is settled here, and the answer is recorded either
way.**

Under §OQ-3's ruling, one of:

(a) The surface is opened — `packages/core/package.json` gains an `exports` map — and the eight
byte pins on `src/index.ts` are either untouched (if the map reaches subpaths without a barrel) or
moved **deliberately**, each with its `Q-0090` authority line and each demonstrated red before
green.

(b) The surface stays closed, and a test in `packages/cli` **proves** it — asserting that
`@quorum/core` resolves to nothing today — with the finding written into **Q-0091's ticket body**
by the human at this ticket's gate, because a `packages/cli` that declares an unusable dependency
is a trap for the next child and an obligation recorded only in a closed ticket's report expires.

Either way, the declared dependency in AC-1 is unchanged: the ticket requires it, and declaring it
is what makes turbo's `^test` edge exist.

*Test:* under (a), an import of a real `core` symbol from `packages/cli` that compiles and runs.
Under (b), the resolution assertion, plus a `runs.log` note naming Q-0091.

---

**AC-11 — every register this change earns is moved, and the numbers are re-derived rather than
adjusted.**

Named individually, because each fails differently:

(a) `packages/core/src/turbo-inputs.test.ts` — `SUITES` (`:131–134`) says *"The two packages whose
suites read outside themselves. The other five read nothing outside."* If `packages/cli`'s tests
read any repository path outside the package — the spike binary's header for AC-7's derivation is
the likely one — `@quorum/cli#test` becomes the third, and `SUITES`, `MANIFEST` and the package's
own `turbo.json` all move together. If they read nothing outside, that is a *measured* claim to
state, not an omission. This guard has stopped four tickets on the way in; stopping is correct.

(b) `packages/core/src/test-discovery.test.ts` — every workspace package must declare all three
scripts and every `*.test.ts` must be collected by the configured include. A new `build` script is
additive and must not displace `test`.

(c) `packages/core/src/test-command.test.ts` — `CI_JOBS` (`:506`) is an exact seven-key register of
`.github/workflows/ci.yml`'s jobs. If AC-2's proof adds a CI job, the register gains a row **and a
sentence saying what that job's green tick claims**. If it does not, say so.

(d) `packages/core/src/spike-parity.test.ts` — ground rule 5. This ticket translates **no**
`spike/test/` file, so the four pinned totals (`binary-only` 220, `both` 2739, `library-only` 2469,
total 5428, share **55%**) should not move. **Re-derive them and say they did not**, from the
failing-pin output rather than from arithmetic on the diff; that is the method that caught the
share crossing 54% → 55% on nineteen lines in Q-0040's fourth round.

---

**AC-12 — the two documents that describe this package are corrected, and one of them is stale
today.**

(a) `docs/04-architecture.md` — the `packages/cli` paragraph and the *Shape* section must state
how the binary executes once §OQ-1 is ruled, since *"One command (`npx quorum`) starts a local
daemon"* is written there and is not achievable as written. Bump the status line with the date and
what changed, per the docs rules.

(b) `docs/06-development-plan.md:481` reads **"2,515 lines across eight `spike/test/` files carry a
binary half and transfer here, half the spike suite by line, `smoke.js`'s 773 among them."**
Measured today against `spike-parity.test.ts`'s own register: **nine** files — one `binary-only`
plus eight `both` — **2,959 lines**, **55%**, and `smoke.js` is **780**. Four figures, all stale,
in the bullet describing this ticket's parent. `docs/04-architecture.md` already says 55%, so the
two documents disagree with each other as well as with the register.

This is in scope as ground rule 5's second half — a register is re-derived rather than transcribed,
and a transcription of it that has drifted is the thing the register exists to catch. It is one
edit and it is checkable against a test that already runs.

**`backlog/Q-0010-…/ticket.md` §2 carries the same four stale figures and is not touched**: the
backlog belongs to the harness, the engine discards an agent's edits under it, and the role file
says so. Correcting it is the human's at this ticket's gate. It is named here so the obligation
does not expire.

---

**AC-13 — the cross-cutting quality pillars, checked rather than assumed.**

- **BYOS.** No file in `packages/cli` mentions an API key, an environment variable named
  `*_API_KEY`, a token or a credential — in source, test, fixture or help text. *Test:* a scan over
  `packages/cli/**` asserting zero occurrences, with the guard excluding itself and the exclusion
  asserted load-bearing.
- **Lint and typecheck.** `pnpm turbo run lint --force` and `pnpm turbo run typecheck --force` are
  green over the new package. It is inside ESLint's `packages/**/*.ts` scope, so
  `@typescript-eslint/no-deprecated`, `no-explicit-any` and `ban-ts-comment` all apply. No `any`,
  no `@ts-ignore` without an inline reason.
- **Both suites.** `npm test --prefix spike` and `pnpm turbo run test --force` are both green, run
  **forced**, and **in both environment rows** per Q-0072's closing finding: in the `integrate`
  worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after
  the merge, where both exist.
- **The git-identity sweep.** `pnpm sweep:git-identity` is green. Any new test that builds a
  repository sets its own identity with `-c`; a verdict may not depend on the account
  (*"A test's verdict is a property of the commit"*, 2026-08-30).

---

## Non-goals

1. **Any command.** `board`, `lint`, `validate`, `adapters` (Q-0091); `runs` (Q-0092); `init`,
   `ticket` (Q-0093); `run` and the gate reader (Q-0094). Implementing one to have something to
   demonstrate is out of scope — the help text plus AC-2's invocation is the proof the binary runs.
2. **The `SIGINT` handler and the 130 exit path.** Q-0094's. This ticket declares the row.
3. **Translating any `spike/test/` file.** Q-0091 to Q-0095 inherit them; `smoke.js` is Q-0095's.
4. **Publishing.** `npm publish`, the published package name, versioning and the registry are
   Q-0029's, in M6.
5. **Fixing a known defect.** Q-0059 (`dirOf` traversal), Q-0060 (silent frontmatter), Q-0066
   (probe crash), Q-0068 (the product name in the BYOS refusal) are open and land in both trees.
   Q-0067's version probe likewise.
6. **Any change to `spike/src/`.** Ground rule 1. `harness/port-charter.md:279` records
   `freeze-sha: 7fd540b…` and the `port-freeze-sha` CI job is live, so a `spike/src` change turns
   `main` red and owes §3's mirror-and-re-record. Q-0090 is not in the charter's `children:` list
   (`:278` is Q-0041 to Q-0054), so the branch-scope job reports it out of scope — the rule is the
   ticket body's, not the guard's, and the guard is therefore not a safety net here.
7. **`spike/test/**`.** Ground rule 2 — added to, never edited or deleted, until the cutover.
8. **A UI, a daemon, `quorum open`, `quorum compile`.** M3 and M5.
9. **`@quorum/templates`.** `init` reads `spike/templates/harness` today; giving the CLI its own
   shipped templates is Q-0093's, and will move AC-1's `files` field again.
10. **Colour policy** (`NO_COLOR`, TTY detection) and **unknown-command exit codes** — reported
    under AC-4 and AC-6, fixed by whatever §OQ-5 opens.

---

## Open questions

**Three are blockers. All three change what gets built, and none can be answered by an implement
step.** Two of them owe a `docs/decisions/` entry, which `developer-generalist` is explicitly
forbidden to write.

This has now happened nine times in this repository, and Q-0062 is the case to read: its
requirement named the precondition by name as GO-1, the run was launched without it, and **rounds 1
to 3 — $80.04 of a $88.49 ticket — went entirely on a blocker no step on the route could clear.**
Round 2, handed a blocker and given only prose as a channel, made the finding *larger*. That is
what these three questions are for, and answering them at the gate is what makes the chore run
worth launching.

---

**OQ-1 (BLOCKER, owner: Ruud, before the chore run) — how does the binary execute?**

The workspace emits nothing and Node cannot load its TypeScript (Problem, probes 2 and 3). Four
shapes, three of them refuted by measurement:

| shape | verdict |
| --- | --- |
| Point `bin` at a `.ts` file and rely on Node's type stripping | **Refused.** Probe 2: stripping does not map `.js` specifiers to `.ts`, so the first cross-file import fails. Probe 3: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` closes the `npx` path regardless. And `engines.node: ">=22.13.0"` is below the version where stripping is on by default. |
| Write `packages/cli`'s runtime in plain JavaScript | **Refused.** `harness/rules.md` — TypeScript strict, no exceptions; ESLint's scope is `packages/**/*.ts`, and `packages/*/src` currently holds zero `.js` files. |
| Bundle with esbuild / tsup into one self-contained file | **Not recommended.** A new dependency needs a justification and, changing architecture, a decision entry — and it puts a third-party package in `pnpm-lock.yaml`, which is outside the role's write paths (AC-1). It buys one thing the next shape does not: a tarball with no `workspace:*` dependencies, which is §OQ-2's problem. |
| **`tsc` emit** — `outDir`, a turbo `build` task with declared `outputs`, `bin` → the emitted entry | **Recommended.** No new dependency (`typescript` is already a root `devDependency`); `dist/` and `*.tsbuildinfo` are already in `.gitignore`; and the `.js`-specifier convention the source already follows is exactly what `nodenext` emit resolves correctly. It also gives `packages/server` and `apps/web` the emit they will need in M3. |

**The decision entry is owed before code**, against *"A cache hit names what the task reads"*
(2026-08-28) and the testing-strategy section of `docs/04-architecture.md`, because a `build` task
introduces a fourth hashed task and a new `outputs` claim into a workspace whose three tasks all
declare `"outputs": []`. Naming it: a candidate title is *"The workspace emits JavaScript, because
Node cannot run the TypeScript it compiles"*.

Three consequences to settle inside the same ruling, so the implement step is not asked to choose:

- **Does `test` depend on `build`?** `commands.test` in `harness.yaml` is
  `npm test --prefix spike && pnpm turbo run test --force --continue` — it runs no build. If AC-2's
  spawn test needs an emit, either `test` gains `dependsOn: ["build"]` or the CLI's own `test`
  script builds first. The first is cleaner and changes `turbo.json` for every package.
- **Do `core` and `shared` also emit?** They must, if the CLI imports them at runtime under Node.
  That widens the change from one package to three and moves `@quorum/shared`'s `exports` off
  `./src/index.ts`, which every `packages/**` test currently resolves through. **This is the largest
  hidden cost in the ticket** and the reason to rule it at the gate rather than in round 2.
- **`erasableSyntaxOnly`?** Setting it in `tsconfig.base.json` makes `tsc` refuse the syntax that
  cannot be stripped, keeping a future stripping route open at zero cost. A default, so it is a
  decision and not a tidy-up.

---

**OQ-2 (BLOCKER, owner: Ruud, at the gate) — what does "`npx quorum` from a clean clone" mean,
given nothing is published?**

All seven packages and `apps/web` are `"private": true`; publishing is Q-0029's, M6; the root
`package.json` already carries the name `quorum` locally. `npx quorum` today resolves against the
public registry — a stranger's package or nothing.

`pnpm pack` rewrites `workspace:*` to a concrete version, but `@quorum/core@0.0.0` and
`@quorum/shared@0.0.0` are not installable from anywhere, so a packed `@quorum/cli` tarball cannot
have its dependencies resolved outside this workspace. Under a bundler (OQ-1 shape 3) it could.

**Recommended: a two-part acceptance test, both parts automated, and the third part named as not
claimed.**

1. **Workspace path.** Clean clone → `pnpm install` → the `bin` runs and prints help, exit 0.
2. **Packaging path.** `pnpm pack` the CLI, install the tarball into a temporary directory
   *together with* locally packed `core` and `shared` tarballs, and run the linked binary. This is
   what proves `files`, `bin`, the shebang, the executable bit and the emit — the things a
   workspace symlink hides. It is the closest honest proxy for `npx`.
3. **`npx quorum` against the registry is Q-0029's and is *not* claimed by this ticket.** Say so in
   `docs/06-development-plan.md` and in the implement report. Reporting it as done would be exactly
   the failure at the top of this list of rules.

If Ruud prefers a single self-contained bundle so that part 2 needs no sibling tarballs, that is
OQ-1 shape 3 and the two questions are answered together.

---

**OQ-3 (BLOCKER, owner: Ruud, at the gate) — does Q-0090 open `@quorum/core`'s public surface?**

`@quorum/core` has no `exports` and no `main`, and its `src/index.ts` is a one-line stub pinned
byte-for-byte by eight tests whose comments each say their own child added no public re-export.

- **Open it here.** Q-0091 to Q-0094 all need it; opening it once is cheaper than four children
  each discovering it. Cost: eight landed pins, each to be moved deliberately and demonstrated red
  before green, on a ticket whose stated scope is "no command is implemented."
- **Leave it closed, prove it, and write the finding into Q-0091's body** (AC-10(b)). Cost: the
  first sibling pays. Benefit: this ticket stays a frame, and Q-0091 — which is the first child
  that actually imports something — is where the shape of the export map can be judged against a
  real caller rather than guessed.

**Recommended: leave it closed and record it.** The ticket body says *"the deliverable is the frame
plus one trivial command or `--help`"*, and an `exports` map designed with no importer is a default
taken on four siblings' behalf, which is the one thing `developer-generalist`'s own role file names
as out of bounds. Note that AC-5(b) — the exit table's exhaustiveness — needs **`@quorum/shared`**
only, and `shared` already declares `exports`, so nothing in this ticket is blocked by leaving
`core` closed.

---

**OQ-4 (owner: Ruud, at the gate) — is the `pnpm-lock.yaml` change authorised?**

`pnpm-lock.yaml` is not in `developer-generalist`'s `paths`. AC-1's dependency declaration forces it
to move, and `commands.install`'s `--frozen-lockfile` fails at `integrate` if it does not.
**Recommended: yes, by name, limited to workspace importer entries.** A third-party package
appearing in that diff is a blocker.

---

**OQ-5 (owner: Ruud, at the gate) — are successors owed for the three preserved defects?**

(a) An unknown or absent command exits **0** (AC-6). (b) Colour is emitted into a pipe; no
`NO_COLOR`, no TTY test (AC-4). (c) `regressed` exits **0**, sharing the fallthrough with
`completed` (AC-5(c)).

All three are current behaviour and ground rule 3 forbids fixing them here. (a) and (c) are exit
codes, so they are this ticket's *subject* even though they are not its scope, and a successor for
them is defensible. Per *"resolve rather than open a successor"*: none of the three changes a
verdict, and each needs a decision about what the code should be, so each is a ticket rather than a
gate fix. **Recommendation: one successor covering (a) and (c) — the exit table's two zeros that
should not be zero — and none for (b) until the README exists to say what a stranger sees.**

---

**OQ-6 (owner: Ruud, at the gate) — the package name and the `bin` name.**

The `bin` key must be `quorum` — that is what `npx quorum` and the README will type, and
`product-boundaries.md` forbids `harness`. The **package** name is the open half: `@quorum/cli` is
what the workspace has, and `quorum` is what `npx quorum` requires of a published package but is
already taken locally by the private root manifest. **Recommended: keep `@quorum/cli`, declare
`"bin": { "quorum": … }`, and leave the published name to Q-0029** — recording that decision so
Q-0029 inherits it rather than rediscovering the collision.

---

## Risks

**R-1 — the permission allowlist refuses the command this ticket needs.**
`.claude/settings.json` allows `Bash(node spike/*)` and **not** `Bash(node packages/*)`. An
implementer verifying the binary with `node packages/cli/…` is refused. This is Q-0038's rounds 1
to 3 exactly — three implement rounds and most of $13.86 spent on a harness misconfiguration, where
the reviewer was right on substance and the implementer's measurements were wrong. *Mitigation,
which is why AC-2 is written the way it is:* exercise the binary from inside a Vitest test through
`node:child_process`, which the allowed `pnpm turbo run test` runs; `pnpm exec` is also allowed.
Do not write a criterion whose only verification is a bare `node packages/…` command.

**R-2 — the decision entries are preconditions no step on the chore route can satisfy.** OQ-1 and
possibly OQ-2 owe entries; `developer-generalist.md:23` forbids writing one. Nine prior
appearances; Q-0062's is the expensive one. *Mitigation:* rule both at this gate, before the chore
run is launched. If a round nevertheless finds itself blocked on one, the channel is an erratum in
`requirements/errata.md` written **during** the loop as soon as the contradiction is provable
(*"An erratum is the last repair, not the first"*, 2026-08-30) — not a fourth round.

**R-3 — this is a first-pass ticket, so `harness/Q-0090/integration` does not exist.**
`chore.yaml`'s `review` step diffs `harness/{id}/integration...harness/{id}/implement`, and only
`integrate` — which runs later — creates that branch. Since Q-0038 the preflight **refuses** rather
than billing, so the run stops at run start. *Mitigation:* create the branch by hand from the
requirements tip before the chore run, per charter §8 and Q-0037's GA-2, and cut it deliberately
rather than from whatever `HEAD` holds.

**R-4 — `integrate` runs `commands.install` with `--frozen-lockfile`.** See AC-1 and OQ-4. A
manifest change without a lockfile change fails the install after the implement step is paid for.

**R-5 — this ticket blocks five others.** Q-0091 to Q-0095 all queue behind it, and the cutover and
M3 queue behind them. A ruling deferred here is a ruling deferred six times.
**Q-0039 (one run at a time per ticket) becomes a blocker the moment two siblings run
concurrently** — two runs on one ticket share a worktree and compute the same `nextRunId` — and it
is open, at `draft`, with no lock of any kind in either tree.

**R-6 — a `build` task changes what a green tick claims, in a repository that has ruled on that
four times.** `turbo.json`'s three tasks all declare `"outputs": []`; a `build` task declares real
outputs and therefore a real cache-restore path, which is a *verdict* replay in the sense
`docs/04-architecture.md` distinguishes from a *download* replay. CI forces, so CI is safe; a
developer's local run and `integrate` are the cells to think about. Name it in the decision entry
rather than discovering it.

**R-7 — the emit and the suite can disagree.** Vitest transforms `.ts` directly and never reads
`dist/`, so every existing test passes over source while the binary runs over emit. A stale or
absent `dist/` is invisible to 1,378 passing tests and visible only to AC-2's spawn test. That is
the one test standing between a green suite and a broken binary, which is a thin place: state it,
and consider a second assertion that the emitted entry is newer than its source.

**R-8 — scope.** Twelve criteria against the sizing decision's ~ten, and three of them (AC-2,
AC-11, AC-12) are wider than they look. The ticket is not splittable — the frame is one thing and
five children wait on it — but if the gate rules OQ-1 toward emitting `core` and `shared` as well,
the build half is a real second ticket and should be split there rather than absorbed.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-13. No API-key path in source, test, fixture or help text; a scan proves it. `check()` is untouched — this ticket adds no adapter code. |
| **Worktree safety** | n/a to the deliverable — no flow behaviour changes and nothing writes to a working tree. Relevant to the *run*: R-3 (the integration branch must exist) and Q-0062's cleanup, which now removes what the run obtained. |
| **Gate behaviour** | n/a to the deliverable. Q-0094 owns the gate reader. AC-5 declares the `undecided` → 3 and `aborted` → 2 rows the gate produces, and AC-9 carries `gateAnswers` in the frame. |
| **File format and schema** | No new file format. AC-5(b) *reads* `packages/shared`'s `runTerminalEventSchema` and changes nothing in it. `package.json`, `turbo.json`, `tsconfig*.json` and `pnpm-lock.yaml` change under AC-1/AC-2. |
| **Lint rules** | AC-13. `packages/cli` enters ESLint's `packages/**/*.ts` scope, including the type-aware `no-deprecated`. `harness lint` (the flow linter) is unaffected — no flow file changes. |
| **Cold-clone impact** | This *is* the cold-clone path. A build step lengthens a stranger's first 30 minutes by whatever `pnpm install && pnpm build` costs, and OQ-1 owes that number rather than an assurance. AC-2's clean-clone proof is the measurement. |
| **Product boundaries** | AC-7. New help text says Quorum and never "harness"; Q-0068's separate defect is preserved and not touched. |
| **Cross-vendor rule** | Satisfied by `chore.yaml` — `implement` on claude, `review` on codex. Nothing in this ticket changes it. |

---

## Appendix A — what was measured, and where the ticket body and the plan disagree with it

| claim | source | measured today | verdict |
| --- | --- | --- | --- |
| argv at `spike/bin/harness.js:25–26` | ticket body | `:25–26` | ✅ |
| colour helper at `:44` | ticket body | `:44` | ✅ |
| `die` at `:124` | ticket body | `:124` | ✅ |
| exit `0`/`1` at `:404`, `:460`; `1` at `:548`; three-way at `:557` | ticket body | all four exact | ✅ |
| soft `process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` | ticket body | all four exact | ✅ |
| `process.exit(130)` at `spike/src/engine.js:87` | ticket body | **`:111`**; `:87` is `diffInputs: new Map(), …` | ❌ stale, claim unaffected |
| eight `spike/test/` files carry a binary half | plan `:481`, Q-0010 §2 | **nine** — 1 `binary-only` + 8 `both` | ❌ stale |
| 2,515 lines / 50% of the suite | plan `:481`, Q-0010 §2 | **2,959 lines / 55%** (`spike-parity.test.ts:1137–1139`) | ❌ stale |
| `smoke.js` is 773 lines | plan `:481`, Q-0010 §2 | **780** | ❌ stale |
| `packages/cli/src/index.ts` is one line | ticket body | one line | ✅ |
| every domain helper is already in `core` | Q-0010 §1 | eleven of eleven, spot-checked | ✅ |
| `packages/core` holds the logic and the CLI is a layer over "an API that exists" | ground rule 4 | the logic exists; **the API does not** — no `exports`, `index.ts` is a stub | ⚠️ §OQ-3 |

`docs/04-architecture.md` already carries 55%, so the plan and the architecture document disagree
with each other today as well as with the register. AC-12(b) closes the plan's half; Q-0010's body
is the human's at the gate.

## Appendix B — measurements taken for this requirement

- No `build` script in any of seven packages or `apps/web`; `turbo.json` declares three tasks;
  `tsconfig.base.json` sets no `outDir` and no `declaration`.
- `@quorum/shared` is the only package declaring `exports`; `@quorum/core` declares neither
  `exports` nor `main`.
- Node loading `@quorum/shared` fails at `packages/shared/src/constants.js` — stripping succeeded,
  specifier mapping did not.
- `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` is present in the Node binary.
- `pnpm-lock.yaml:35` is `packages/cli: {}`.
- All seven packages plus `apps/web` are `"private": true`; only `spike/package.json` declares a
  `bin`.
- `.gitignore` already ignores `dist/` and `*.tsbuildinfo`.
- `developer-generalist.md:2` paths: `package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json,
  .npmrc, .gitignore, .github, packages, apps, spike, harness, docs` — `pnpm-lock.yaml` absent,
  `docs/decisions/` forbidden by the role's prose.
- `.claude/settings.json` allows `Bash(pnpm *)` and `Bash(node spike/*)`; `Bash(node packages/*)` is
  not allowed.
- `RunStatus` has six members (`packages/core/src/engine/types.ts:63`);
  `runTerminalEventSchema` covers all six across two union members
  (`packages/shared/src/events.ts:210–223`).
- `harness/port-charter.md:278–279`: `children:` is Q-0041–Q-0054; `freeze-sha: 7fd540b…` recorded,
  so `port-freeze-sha` is live.
- `spike-parity.test.ts:1137–1139`: 220 / 2739 / 2469 / 5428, share 55%.
- `test-command.test.ts:506`: `CI_JOBS` is an exact seven-key register.
- `turbo-inputs.test.ts:131–134`: `SUITES` is two packages, with the claim that the other five read
  nothing outside themselves.
