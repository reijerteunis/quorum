# Q-0090 — CLI package skeleton, `bin` entry and `npx quorum`

**Merged requirement, run 1, iteration 1. Written 2026-09-01 against `main` (`7a5bece`).**

Every figure below was re-measured at the gate, including the figures the candidates measured
themselves. Two of them did not survive, and both corrections change a ruling rather than a
sentence — which is why the re-measurement is recorded in Appendix A instead of being trusted.
Where this document contradicts the ticket body, the body is named and the measurement is shown.

---

## Problem

`packages/cli` is a stub. `src/index.ts` is `export const name = '@quorum/cli';`, its manifest
declares three scripts and nothing else, and its entire suite asserts that the stub is a stub. Five
sibling tickets — Q-0091 to Q-0095 — cannot start until it is a package that runs.

That much the ticket body says. What the body does not say, and what decides this ticket's size and
route, is four probes run today:

**1. Nothing under `packages/**` has ever been executed by Node.** No `build` script exists in any
of the seven packages or in `apps/web`; `turbo.json` declares `lint`, `typecheck`, `test` and no
fourth task, all three with `"outputs": []`; `tsconfig.base.json` sets no `outDir` and no
`declaration`; every package's `typecheck` is `tsc --noEmit`. Vitest, through Vite's transform, is
the only thing that has ever loaded a `.ts` file in this workspace.
`packages/core/src/shared-resolution.test.ts:3–6` says so in the repository's own words, written at
Q-0041 — and one of its three clauses has since changed, because `@quorum/shared` now declares
`exports`, alone among seven packages.

**2. Node cannot run this workspace's TypeScript, and the reason is not the version.** Run from
`packages/core`, which declares the dependency, on the machine's Node **v24.15.0** — a version where
type stripping is on by default:

```
FAIL ERR_MODULE_NOT_FOUND | Cannot find module
  '…/packages/shared/src/constants.js' imported from '…/packages/shared/src/index.ts'
```

Node **found** the package, **loaded** `index.ts` and **stripped its types**, then failed: the source
writes `./constants.js` and `moduleResolution: nodenext` maps that to `constants.ts` at compile time,
while Node's stripping does no such mapping. The extension convention this workspace follows is a
compile-time convention with no runtime counterpart. Every one of `shared`'s re-exports and every
cross-file import in `core` has that shape. Raising the `engines` floor fixes nothing.

**3. The packaged path is closed a second time, independently.** A package whose entry is a `.ts`
file, installed under `node_modules`, is refused outright:

```
FAIL ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
```

Reproduced directly today with a two-file fixture, not inferred from the presence of the string in
the binary. `npx` and `pnpm pack` both unpack into `node_modules`; the workspace symlinks pnpm
creates are resolved to their real paths before that check fires, which is why probe 2 got as far as
it did and why a symlink-based test would never have found this.

**4. `@quorum/core` is not resolvable at all.** `import('@quorum/core')` from inside `packages/core`
fails `ERR_MODULE_NOT_FOUND | Cannot find package`. Its manifest declares neither `exports` nor
`main`, and `src/index.ts` is a one-line stub. The ticket requires `@quorum/cli` to depend on it: the
dependency is **declarable and not resolvable**, and the first sibling that imports it — Q-0091, for
`board` — discovers that instead of inheriting it.

So **Q-0090 is not "add a `bin` field to a manifest."** It is the ticket that introduces emitted
JavaScript to a workspace that has never emitted anything, which is a change to
`docs/04-architecture.md`'s shape rather than a change inside one package. §OQ-1 routes it, and §OQ-3
routes the size consequence.

A fifth fact bounds the headline: **all seven packages and `apps/web` are `"private": true`**,
nothing is published, `npm publish` is Q-0029's in M6, and the root manifest already holds the name
`quorum` privately. An acceptance test written as *"run `npx quorum`"* would either fetch a
stranger's package from the registry or be quietly reinterpreted into something weaker — *"a check
that skips its subject must not report success"* (2026-08-25) arriving in this ticket's headline
criterion. §OQ-2 routes it.

### What is *not* the problem

The domain logic. Q-0010 §1 checked eleven helpers by name and found all eleven already in
`packages/core`. Nothing here ports a helper. What is unbuilt is a frame: argv, a colour helper,
`die`, an exit-status module, a `bin` entry, and the packaging that makes the binary run.

---

## User stories

**Cold-clone adopter.** I clone the repository, follow the README, and the first command in it
produces output rather than a module-resolution stack trace. I never have to know the project is
written in TypeScript, and I am never asked for an API key.

**Solo maintainer.** I wrap `quorum run` in a shell script. Its exit code tells me which of five
things happened — it finished, it errored, a human stopped it, nobody answered a gate, or I
interrupted it — and that mapping is one typed table in one module rather than nine `process.exit`
calls I have to find by reading.

**Sibling child (Q-0091 to Q-0095) and any later contributor.** I add a command by writing one module
against a frame that already parses argv, already owns the error path and already owns the exit
codes. I do not invent a second flag parser, I cannot introduce a sixth exit code by accident, and if
a domain helper I need is genuinely missing from `core` I stop and report rather than copying one
out of the spike.

---

## Acceptance criteria

Surfaces: **CLI** (`packages/cli`), repository configuration (`turbo.json`, `tsconfig*.json`,
`pnpm-lock.yaml`, `.github/workflows/ci.yml`) and **docs**. No criterion names a `harness/` or
`backlog/` surface, and none names `docs/decisions/`.

AC-2, AC-10 and AC-12 state what they ask under either ruling of the blocker they depend on, so each
is testable the moment the ruling exists and none is a criterion an implement step could satisfy by
choosing for itself.

---

**AC-1 — `packages/cli` is a real workspace package, and the lockfile moves in the same commit.**

`packages/cli/package.json` declares:

- `"bin": { "quorum": … }` — the command name is `quorum` (§OQ-5), pointing at the runtime entry
  §OQ-1 selects;
- `"dependencies"`: `"@quorum/core": "workspace:*"` and `"@quorum/shared": "workspace:*"`, and no
  third-party dependency. It gains nothing merely because `spike/package.json` has it;
- `"files"`, so a pack contains the runnable artifact rather than `src/**` alone;
- `"type": "module"` and an `"engines".node` floor consistent with the root's `>=22.13.0`;
- the entry file carries a `#!/usr/bin/env node` shebang and is mode-executable on POSIX.

`pnpm-lock.yaml:35` currently reads `packages/cli: {}`. It gains an importer block in the **same
commit**, or `commands.install`'s `pnpm install --frozen-lockfile` fails in the `integrate` worktree
and the run stops after the implement step has been paid for.

*Test:* `pnpm install --frozen-lockfile` from a clean checkout of the branch exits 0; a test reads the
manifest and asserts the two workspace dependencies and the absence of any other; a test asserts the
lockfile's `packages/cli` importer is non-empty; a test asserts the shebang and the executable bit on
the `bin` target.

*Authority:* `pnpm-lock.yaml` is **not** in `developer-generalist`'s `paths`
(`harness/roles/developer-generalist.md:2`, verified today). It is authorised here by name, for this
change only, limited to workspace importer entries — §OQ-4. A lockfile diff containing a new
third-party package is a blocker, not a nit.

---

**AC-2 — the binary runs under Node, from this repository, with no loader flag.**

Whatever §OQ-1 rules: from a clean clone, after the workspace's supported install and build steps,
invoking the `bin` target through Node prints the help text and exits 0 — with no `--experimental-*`
flag, no `NODE_OPTIONS` and no loader.

Under the recommended ruling (emit JavaScript) this additionally means: a `build` task exists in
`turbo.json` with its `outputs` declared; `test`, `lint` and `typecheck` relate to it such that a
suite never runs against a stale or absent emit; **no new third-party dependency** — `typescript` is
already a root `devDependency`; and `.gitignore` needs no change, already ignoring `dist/` and
`*.tsbuildinfo`.

*Test:* a Vitest test in `packages/cli` spawns the `bin` target with `node` through
`node:child_process`, asserting exit 0 and the first line of stdout. It runs inside the ordinary
suite, so `integrate` sees it — a proof that exists only as a command in an implement report is not a
test. **Demonstrate red before green:** the same test against the pre-change tree must fail, and the
failure must be probe 2's resolution error rather than a missing file.

*Why not a bare command:* `.claude/settings.json` allows `Bash(node spike/*)` and **not**
`Bash(node packages/*)` (verified today). See R-1.

---

**AC-3 — argv parsing is preserved exactly, including the behaviours nobody would choose.**

`spike/bin/harness.js:25–42` is the specification — the declarations at `:25–27`, the loop at
`:28–39`, `const [cmd, ...rest]` at `:40` and the `gateAnswers` queue at `:42`. Seven behaviours,
each pinned separately:

1. `process.argv.slice(2)`; tokens not starting with `--` are collected as positionals in order, and
   `const [cmd, ...rest] = positional`.
2. `--k v` sets `flags.k = 'v'` when `v` does not start with `--`; otherwise `flags.k = true` and `v`
   is re-parsed as the next flag.
3. **Only `gate-answer` accumulates**, into an array, in command-line order. Every other flag is
   last-wins (`:32–36`, Q-0033).
4. A single-dash token is a **positional**, not a flag: `-v` lands in `rest`. The test is
   `startsWith('--')` and nothing else.
5. `--` is **not** a terminator: it parses as a flag named `''` and swallows the following token as
   its value.
6. Flag values are strings or the boolean `true`; nothing is coerced to a number.
7. Repeated positionals are all kept; nothing is de-duplicated.

Behaviours 4 and 5 are preserved defects under ground rule 3 — reported, not fixed — and pinned so a
later change to either is deliberate. **No parse error is invented**: the spike has none, and adding
one is a behaviour change (see Provenance, codex AC-8).

*Test:* a table-driven test over argv arrays, one row per behaviour, asserting the parsed
`{cmd, rest, flags, gateAnswers}` shape. The parser is exported so a test supplies an array directly:
no verdict depends on the invoking shell, the terminal, git configuration, an installed vendor CLI or
an existing ignored directory. Rows 4 and 5 carry an authority line naming this criterion.

---

**AC-4 — `die` and the colour helper are preserved, and their two limits are registered.**

- The colour helper is six functions — `dim`, `bold`, `amber`, `green`, `red`, `teal` — emitting
  exactly the escape sequences at `spike/bin/harness.js:44`.
- `die(m)` writes `c.red('✗ ') + m` to **stderr** and exits 1. The space sits inside the red span,
  unlike every other call site in the file, and that is preserved.
- An uncaught rejection reaches `die(e.stack ?? String(e))` (`:569`), so an unexpected throw prints a
  Node stack through the error path and exits 1. Preserved.

Two limits are **reported and not fixed**: the helper performs no TTY test, so escape sequences are
written into a pipe or a file, and it honours neither `NO_COLOR` nor `FORCE_COLOR`. Both are current
behaviour on the cold-clone path. **No colour-disable mechanism is added** — inventing one to make a
test convenient is the behaviour change ground rule 3 forbids. §OQ-6 asks whether a successor is
owed.

*Test:* assertions over the exact escape sequences, and over `die`'s stream, message shape and exit
code, each naming this criterion. `die` is tested without terminating the test process.

---

**AC-5 — one exit-status module: named constants, a status map, and exhaustiveness derived.**

The ticket body's table is organised by *code → source line*, which is how it was measured and not
how it can be enforced. Reorganised by what decides a code, over the six members of `RunStatus`
(`packages/core/src/engine/types.ts:63`):

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
a seventh `RunStatus` member fails to compile rather than falling through to 0. Production CLI code
and CLI tests refer to the constants rather than repeating these numeric literals.

(b) **Exhaustiveness is derived, not transcribed.** A test extracts the status literals from
`packages/shared`'s `runTerminalStatusSchema` — a discriminated union whose first member carries
`regressed` and whose second carries the other five — and asserts the map's key set equals it. A
status added in `shared` and not here turns the suite red without anyone remembering. **This
derivation needs `@quorum/shared` only, resolved by Vitest over source; it needs no emit and no
`@quorum/core` import**, which is why AC-10 does not block it.

(c) **`regressed` → 0 is preserved and registered**, with an authority line naming this criterion. It
is current behaviour, it is not obviously right, and ground rule 3 forbids fixing it here.

(d) **`130` is a row of this table and no handler is installed.** `core` installs no signal handler
(Q-0050 AC-5, `04-architecture.md` principle 2), so the handler becomes the CLI's and is **Q-0094's**
to place. Note for that ticket, measured today: the spike's engine registers **both** `SIGINT` and
`SIGTERM` (`spike/src/engine.js:113–114`), not `SIGINT` alone. A test asserts the row exists and that
`packages/cli` registers no signal handler.

*Test:* the derivation in (b); a mutation test for (a) — adding a status to the fixture union fails
the guard; assertions for (c) and (d).

*Correction to the ticket body, stated because the body forbids re-deriving its table from any other
source:* every line number in it verifies exactly (`:124`, `:404`, `:460`, `:499`, `:517`, `:523`,
`:531`, `:548`, `:557`) **except one**. `process.exit(130)` is at `spike/src/engine.js:111`, not
`:87`; `:87` today is `diffInputs: new Map(), deferredDiffs: new Map(),`. The row's *claim* is
unaffected. It is the one row pointing outside the file the body measured — the exact shape of the
error the body warns about, one file over.

---

**AC-6 — hard exit and soft exit are two mechanisms and stay two.**

`process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` sets the status and lets the process finish
writing; `process.exit` truncates. The frame exposes both and the shared numeric meaning does not
collapse them into one implementation. A port that collapses them loses output on the `runs` warning
paths.

*Test:* **demonstrated, not asserted.** A child process that sets the soft code and then writes a
large payload to stdout exits 1 with the payload complete; the same child using `process.exit` loses
it. Both rows in one test.

---

**AC-7 — an unknown or absent command prints help and exits 0, preserved and registered.**

`spike/bin/harness.js:560–562`: the `default:` branch prints usage and returns, so `main()` resolves
and the process exits 0. `quorum`, `quorum nonsense` and `quorum --help` all exit 0.

This is preserved under ground rule 3 and **registered as a defect**, because a shell script cannot
distinguish "did the thing" from "did not understand you". It is registered rather than quietly
carried, because this ticket's whole deliverable is the exit table and a row nobody wrote down is the
row that is wrong. §OQ-6 asks whether a successor is owed.

*Ruling, against the codex candidate's AC-7:* changing this to exit 1 is a behaviour change, on the
one surface a stranger meets first, decided inside a ticket whose stated scope is a frame. It is
defensible and it is not this ticket's to take.

*Test:* three invocations, each asserting exit 0 and non-empty stdout, each naming this criterion.

---

**AC-8 — the help text is owned data, it says Quorum, and it claims only what the build dispatches.**

`:561` produces help by **reading the binary's own source file** and stripping `// ` from lines 2–10.
That mechanism cannot survive AC-2 under any ruling: emitted JavaScript does not carry the comment
block at those line numbers, and reading `import.meta.url`'s file from inside a package under
`node_modules` is not a thing to build a help system on. So the mechanism changes to owned data.

Two constraints on the text:

- It **must not** call the product a harness. `.claude/rules/product-boundaries.md` and
  `harness/product-context.md` forbid it; the spike's first help line is `harness — spike CLI.
  Commands:` and every command name inside it is `harness …`. Writing `quorum` is **not** fixing
  Q-0068 — that ticket's subject is the BYOS refusal string in `claude.js:12` / `codex.js:21` and
  their ported twins, which this ticket does not touch. Say so in the implement report, so a reviewer
  does not read correct new text as an unauthorised fix.
- **The help lists only commands the frame dispatches**, which today is the help itself. The eight
  command lines are the siblings' to add as each lands, preserving the spike header's wording and
  ordering at that point. *Ruled here* because the alternative — listing eight commands that all fall
  through AC-7's default branch to help and exit 0 — is a green tick over a subject that does not
  exist, on the cold-clone path. The cost is that Q-0091 to Q-0095 each add their own line; the
  benefit is that no invocation can ever look like success for a command that is not there.

*Test:* the help is asserted to contain the usage form and the product name; it is asserted to contain
no occurrence of the word `harness` outside a path literal such as `harness/harness.yaml`; the
mechanism is asserted **not** to read its own source (no `fileURLToPath(import.meta.url)` +
`readFileSync` pair in the help path); and — the derived clause — **every command name appearing in
the help is a member of the frame's registered-command set**, so a sibling that documents a command
without registering it turns the suite red.

---

**AC-9 — no command is implemented, no domain helper is copied, and the scaffold writes nothing.**

The deliverable is the frame plus help. `board`, `ticket`, `init`, `run`, `lint`, `adapters`,
`validate` and `runs` are Q-0091 to Q-0094; `smoke.js` is Q-0095's.

`packages/core` already holds every domain helper (Q-0010 §1, eleven of eleven). If one appears to be
missing, implementation **stops and reports the absence** rather than adding it to CLI scope
(ground rule 4).

Running the executable with no arguments, `--help`, an unknown command or a malformed argv creates or
changes no file in the working tree, `backlog/`, `harness/`, `.quorum/` or `.harness/worktrees/`, and
starts no daemon, probes no adapter and runs no flow.

*Test:* a source-level guard over `packages/cli/src/**` asserting that no file imports a
run-executing or backlog-writing symbol, with its file list **derived from the directory** rather
than hand-written — the failure Q-0051 found in `q0050.source.test.ts`'s third list, which failed
open. Plus a filesystem test: snapshot a temporary project directory, run all four invocation shapes,
assert the tree is unchanged.

---

**AC-10 — whether `@quorum/core` is importable at runtime is settled here, and recorded either way.**

**A measured correction that makes this cheap.** The claude candidate framed opening `core`'s surface
as an act against eight landed pins. It is not. Verified today: the eight assertions live in seven
`packages/core/src/**/*.source.test.ts` files plus `packages/shared/src/index.test.ts:68`, and every
one of them pins the **bytes of `packages/core/src/index.ts`**. **No test asserts that
`packages/core/package.json` declares no `exports`.** So a manifest-level `exports` map moves *zero*
pins; only a barrel re-export through `index.ts` costs anything, and nothing in this ticket or its
siblings needs the barrel.

What remains is therefore entailed by §OQ-1 rather than independent of it — an `exports` map can only
name a target that exists. Under the ruling, one of:

(a) **`core` emits and declares `exports`.** `packages/cli` imports one real symbol and AC-2's spawn
test proves a cross-package runtime import rather than only that a self-contained file runs. The
byte pins stay untouched, because the map names emitted paths and not the barrel.

(b) **`core` stays unresolvable.** A test in `packages/cli` **proves** it — asserting that
`@quorum/core` resolves to nothing today — and the finding is written into **Q-0091's ticket body by
the human at this gate**, because a `packages/cli` that declares an unusable dependency is a trap for
the next child, and an obligation recorded only in a closed ticket's report expires
(*deferred criteria need successor bodies*).

Either way AC-1's declared dependency is unchanged: the ticket requires it, and declaring it is what
makes turbo's `^build` / `^test` edge exist.

*Test:* under (a), an import of a real `core` symbol from `packages/cli` that compiles and runs under
AC-2's spawned binary. Under (b), the resolution assertion plus a `runs.log` note naming Q-0091.

---

**AC-11 — every register this change earns is moved, and the numbers are re-derived rather than
adjusted.**

Named individually, because each fails differently:

(a) `packages/core/src/turbo-inputs.test.ts` — `SUITES` (`:129–133`) says *"The two packages whose
suites read outside themselves. The other five read nothing outside."* If `packages/cli`'s tests read
any repository path outside the package, `@quorum/cli#test` becomes the third, and `SUITES`,
`MANIFEST` and the package's own `turbo.json` move together. If they read nothing outside, that is a
**measured** claim to state, not an omission. This guard has stopped four tickets on the way in;
stopping is the correct behaviour.

(b) `packages/core/src/test-discovery.test.ts` — every workspace package declares `lint`, `typecheck`
and `test` (`TASKS`, `:59`; asserted per package at `:209–215`), and every `*.test.ts` is collected by
the configured include. A `build` script is additive and must not displace `test`.

(c) `packages/core/src/test-command.test.ts` — `CI_JOBS` (`:506`) is an exact seven-key register of
`.github/workflows/ci.yml`'s jobs (verified: `workspace`, `port-freeze-policy`,
`port-freeze-branch-scope`, `port-freeze-sha`, `spike`, `git-identity-sweep-bare`,
`git-identity-sweep-populated`). If AC-2's proof adds a CI job, the register gains a row **and a
sentence saying what that job's green tick claims**. If it does not, say so.

(d) `packages/core/src/spike-parity.test.ts` — ground rule 5. This ticket translates **no**
`spike/test/` file, so the four pinned totals — `binary-only` 220, `both` 2739, `library-only` 2469,
total 5428, share **55%** — should not move. **Re-derive them and state that they did not**, from the
failing-pin output rather than from arithmetic on the diff. That is the method that caught the share
crossing 54% → 55% on nineteen lines during Q-0040.

---

**AC-12 — the two documents that describe this package are corrected, and one is stale today.**

(a) `docs/04-architecture.md` — the `packages/cli` paragraph (`:51–52`) and the *Shape* section
(`:7`) must state how the binary executes once §OQ-1 is ruled. *"One command (`npx quorum`) starts a
local daemon and opens the browser UI"* is written there and is not achievable as written. Bump the
status line with the date and what changed, per the docs rules.

(b) `docs/06-development-plan.md` (Q-0010's bullet, the paragraph ending *"…`smoke.js`'s 773 among
them"*) reads **"2,515 lines across eight `spike/test/` files carry a binary half and transfer here,
half the spike suite by line, `smoke.js`'s 773 among them."** Measured today against
`spike-parity.test.ts`'s own register: **nine** files — one `binary-only` plus eight `both`, which the
adjacent spelling test corroborates independently at 4 + 5 — **2,959 lines**, **55%**, and `smoke.js`
is **780**. Four figures, all stale, in the bullet describing this ticket's parent.
`docs/04-architecture.md` already says 55%, so the two documents disagree with each other as well as
with the register.

This is in scope as ground rule 5's second half: a register is re-derived rather than transcribed, and
a transcription of it that has drifted is what the register exists to catch. It is one edit, checkable
against a test that already runs.

**`backlog/Q-0010-…/ticket.md` §2 carries the same four stale figures and is not touched**: the
backlog belongs to the harness, the engine discards an agent's edits under it, and the role file says
so. Correcting it is the human's at this gate. It is named here so the obligation does not expire.

---

**AC-13 — the cross-cutting pillars, checked rather than assumed.**

- **BYOS.** No file in `packages/cli` mentions an API key, an environment variable named `*_API_KEY`,
  a token or a credential — in source, test, fixture, help text or documentation example. No adapter
  is probed by any scaffold invocation and `check()` is untouched. *Test:* a scan over
  `packages/cli/**` asserting zero occurrences, the guard excluding itself and the exclusion asserted
  load-bearing.
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

## Non-goals

1. **Any command.** `board`, `lint`, `validate`, `adapters` (Q-0091); `runs` (Q-0092); `init`,
   `ticket` (Q-0093); `run` and the gate reader (Q-0094). Implementing one to have something to
   demonstrate is out of scope — the help plus AC-2's invocation is the proof the binary runs.
2. **The signal handler and the 130 exit path.** Q-0094's; this ticket declares the row and asserts no
   handler is registered.
3. **Translating any `spike/test/` file.** Q-0091 to Q-0095 inherit them; `smoke.js` is Q-0095's.
4. **Publishing.** `npm publish`, the published package name, versioning and the registry are
   Q-0029's, in M6.
5. **Fixing a known defect.** Q-0059 (`dirOf` traversal), Q-0060 (silent frontmatter), Q-0066 (probe
   crash), Q-0068 (the product name in the BYOS refusal) and Q-0067's version probe are open and land
   in both trees.
6. **Any change to `spike/src/`.** Ground rule 1. `harness/port-charter.md` records a live
   `freeze-sha` and the `port-freeze-sha` CI job is live, so a `spike/src` change turns `main` red and
   owes §3's mirror-and-re-record. Q-0090 is **not** in the charter's `children:` list, so the
   branch-scope job reports it out of scope — the rule is the ticket body's, not the guard's, and the
   guard is therefore not a safety net here.
7. **`spike/test/**`.** Ground rule 2 — added to, never edited or deleted, until the cutover.
8. **A UI, a daemon, `quorum open`, `quorum compile`, `quorum history`.** M3 and M5, whatever
   `04-architecture.md:52` currently promises.
9. **`@quorum/templates`.** `init` reads `spike/templates/harness` today; giving the CLI its own
   shipped templates is Q-0093's, and will move AC-1's `files` field again.
10. **Colour policy** (`NO_COLOR`, TTY detection), **an unknown-command exit code**, and
    **`regressed` → 0** — all reported under AC-4, AC-7 and AC-5(c), and fixed by whatever §OQ-6 opens.
11. **Windows.** The `bin` shim's behaviour on Windows is not claimed and not tested; CI and the
    developer machines are POSIX. Stated rather than silently assumed (see R-8).
12. **A parser library.** The frame preserves the spike's parser; selecting a library would change
    flag semantics before any command is ported (see R-9).

---

## Open questions

**Three block. Each changes what gets built, and none can be answered by an implement step.** Two owe
a `docs/decisions/` entry, which `developer-generalist` is explicitly forbidden to write
(`harness/roles/developer-generalist.md:23`).

This has now happened nine times in this repository, and Q-0062 is the case to read: its requirement
named the precondition by name as GO-1, the run was launched without it, and **rounds 1 to 3 —
$80.04 of an $88.49 ticket — went entirely on a blocker no step on the route could clear.** Round 2,
handed a blocker and given only prose as a channel, made the finding *larger*. Answering these at the
gate is what makes the chore run worth launching.

---

**OQ-1 (BLOCKER, owner: Ruud, before the chore run) — how does the binary execute, and how far does
the emit reach?**

The workspace emits nothing and Node cannot load its TypeScript (probes 1–3). Four shapes, three
refuted by measurement:

| shape | verdict |
| --- | --- |
| Point `bin` at a `.ts` file and rely on Node's type stripping | **Refused.** Probe 2: stripping does not map `.js` specifiers to `.ts`, so the first cross-file import fails — on Node v24, where stripping is on by default. Probe 3: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` closes the installed/packed path regardless. |
| Write `packages/cli`'s runtime in plain JavaScript | **Refused.** `harness/rules.md` — TypeScript strict, no exceptions; ESLint's scope is `packages/**/*.ts`, and `packages/*/src` holds zero `.js` files. |
| Bundle with esbuild / tsup into one self-contained file | **Not recommended.** A new dependency needs a justification and, changing architecture, a decision entry — and it puts a third-party package in `pnpm-lock.yaml`, which is outside the role's write paths. It buys one thing the next shape does not: a tarball with no `workspace:*` dependencies, which is §OQ-2's problem. |
| **`tsc` emit** — `outDir`, a turbo `build` task with declared `outputs`, `bin` → the emitted entry | **Recommended.** No new dependency (`typescript` is a root `devDependency`); `dist/` and `*.tsbuildinfo` are already gitignored; and the `.js`-specifier convention the source already follows is exactly what `nodenext` emit resolves correctly. It also gives `packages/server` and `apps/web` the emit they need in M3. |

**The ruling must also fix the emit's reach**, because that is the size question (§OQ-3):

- **(a) `cli` only.** Smallest. The frame imports nothing from `core` or `shared` at runtime — AC-5(b)'s
  derivation is a *test* over source and needs no emit — so this works today. AC-2 then proves the
  `bin` entry, the shebang, the executable bit and the packaging, but **not** that a workspace import
  resolves. Q-0091 hits that wall, inside a ticket about four read-only commands.
- **(b) `cli` + `shared`.** AC-2 additionally proves one cross-package runtime import.
- **(c) `cli` + `shared` + `core`.** The full path every sibling needs, and what makes AC-10(a)
  possible.

**Recommended: (c), and split the ticket** — see §OQ-3. The reason (c) is not a free widening:
`@quorum/shared`'s `exports` currently names `./src/index.ts`, and **every `packages/**` test resolves
`@quorum/shared` through it**. Retargeting that to `dist` makes 1,378 existing tests run against
emitted output, where a stale `dist/` silently changes what they are testing. Keeping Vitest on source
while Node reads `dist` needs conditional exports or a Vitest alias, decided deliberately. That is
design work with a decision entry, not a criterion.

Three consequences to settle inside the same ruling, so no implement step is asked to choose:

- **Does `test` depend on `build`?** `commands.test` in `harness.yaml` runs no build. If AC-2's spawn
  test needs an emit, either `test` gains `dependsOn: ["build"]` or the CLI's own `test` script builds
  first. The former is cleaner and changes `turbo.json` for every package.
- **`erasableSyntaxOnly`?** Setting it in `tsconfig.base.json` makes `tsc` refuse syntax that cannot be
  stripped, keeping a future stripping route open at zero cost. It is a default, so it is a decision
  and not a tidy-up.
- **What does a `build` cache hit claim?** `turbo.json`'s three tasks all declare `"outputs": []`; a
  `build` task declares real outputs and therefore a real restore path — a *verdict* replay in the
  sense `04-architecture.md` distinguishes from a *download* replay. CI forces; a developer's local run
  and `integrate` are the cells to think about. Name it in the entry rather than discovering it.

**The decision entry is owed before code.** A candidate title: *"The workspace emits JavaScript,
because Node cannot run the TypeScript it compiles"*.

---

**OQ-2 (BLOCKER, owner: Ruud, at the gate) — what does "`npx quorum` from a clean clone" mean, given
nothing is published?**

All seven packages and `apps/web` are `"private": true`; publishing is Q-0029's, in M6; the root
manifest already carries the name `quorum` locally. `npx quorum` today resolves against the public
registry — a stranger's package, or nothing.

`pnpm pack` rewrites `workspace:*` to a concrete version, but `@quorum/core@0.0.0` and
`@quorum/shared@0.0.0` are installable from nowhere, so a packed `@quorum/cli` tarball cannot have its
dependencies resolved outside this workspace. Under a bundler (OQ-1 shape 3) it could.

**Recommended: a two-part acceptance test, both parts automated, and the third part named as not
claimed.**

1. **Workspace path.** Clean clone → install → build → the `bin` runs and prints help, exit 0.
2. **Packaging path.** `pnpm pack` the CLI, install the tarball into a temporary directory *together
   with* locally packed `core` and `shared` tarballs, and run the linked binary. This proves `files`,
   `bin`, the shebang, the executable bit and the emit — the things a workspace symlink hides — and it
   is the closest honest proxy for `npx`. It must assert that **no package is resolved or downloaded
   from the public registry**, or the test can pass by fetching a stranger's `quorum`.
3. **`npx quorum` against the registry is Q-0029's and is *not* claimed by this ticket.** Say so in
   `docs/06-development-plan.md` and in the implement report. Reporting it as done would be exactly the
   failure this repository has recorded most often.

If a single self-contained bundle is preferred so that part 2 needs no sibling tarballs, that is OQ-1
shape 3 and the two questions are answered together.

---

**OQ-3 (BLOCKER, owner: Ruud, at the gate) — one ticket or two?**

This document carries **thirteen** criteria, at the ceiling, and three of them (AC-2, AC-11, AC-12) are
wider than they read. The frame itself is not splittable — it is one thing and five children wait on
it — but **the emit is a separate subject that only looks like part of it**, and OQ-1's ruling decides
which.

- **If OQ-1 rules (a) — `cli` emits alone —** Q-0090 stays one ticket at thirteen criteria. Accept that
  AC-2 proves a narrower subject than the ticket's headline suggests, and that AC-10(b)'s obligation
  into Q-0091's body is what stops it becoming a trap.
- **If OQ-1 rules (b) or (c) —** split, in this order:
  - **Q-0090a — "The workspace emits JavaScript."** `outDir`, `declaration`, the turbo `build` task and
    its `outputs`, `exports` maps for `core` and `shared`, and the rule that keeps Vitest resolving
    source while Node resolves `dist`. Owes the decision entry. Roughly eight to ten criteria, and it
    is where AC-2's build half, AC-11(a)–(c) and AC-12(a) belong.
  - **Q-0090b — the CLI frame.** This document minus that half: AC-1, AC-3 to AC-10, AC-12(b), AC-13.
    Roughly ten criteria, and unblocked by Q-0090a.
  - Q-0091 to Q-0095 queue behind Q-0090b exactly as Q-0010's cut says.

**Recommended: rule OQ-1 to (c) and split.** The emit question is what blocks all five children and it
deserves its own requirement rather than being absorbed as one criterion inside a ticket whose stated
scope is "no command is implemented". Shape (a) is defensible and cheaper today, and it buys that by
handing Q-0091 a half-built build system to finish while it ports four commands.

---

**OQ-4 (owner: Ruud, at the gate) — is the `pnpm-lock.yaml` change authorised?**

`pnpm-lock.yaml` is not in `developer-generalist`'s `paths` (verified today). AC-1's dependency
declaration forces it to move, and `commands.install`'s `pnpm install --frozen-lockfile` fails at
`integrate` if it does not. **Recommended: yes, by name, limited to workspace importer entries.** A
third-party package appearing in that diff is a blocker.

---

**OQ-5 (owner: Ruud, at the gate) — the package name and the `bin` name.**

The `bin` key must be `quorum`: that is what the README will type, and `product-boundaries.md` forbids
`harness`. The **package** name is the open half — `@quorum/cli` is what the workspace has, and
`quorum` is what a published `npx quorum` requires but is already taken locally by the private root
manifest. **Recommended: keep `@quorum/cli`, declare `"bin": { "quorum": … }`, and leave the published
name to Q-0029**, recording the collision so that ticket inherits it rather than rediscovering it.

---

**OQ-6 (owner: Ruud, at the gate) — are successors owed for the three preserved defects?**

(a) An unknown or absent command exits **0** (AC-7). (b) Colour is emitted into a pipe, with no
`NO_COLOR` and no TTY test (AC-4). (c) `regressed` exits **0**, sharing the fallthrough with
`completed` (AC-5(c)).

All three are current behaviour and ground rule 3 forbids fixing them here. (a) and (c) are exit codes,
so they are this ticket's *subject* even though they are not its scope. Per *resolve rather than open a
successor*: none changes a verdict, and each needs a decision about what the code should be, so each is
a ticket rather than a gate fix. **Recommendation: one successor covering (a) and (c) — the exit
table's two zeros that should not be zero — and none for (b) until the README exists to say what a
stranger sees.**

---

## Risks

**R-1 — the permission allowlist refuses the command this ticket needs.** `.claude/settings.json`
allows `Bash(pnpm *)` and `Bash(node spike/*)`, and **not** `Bash(node packages/*)` (verified today).
An implementer verifying the binary with `node packages/cli/…` is refused. This is Q-0038's rounds 1
to 3 exactly — three implement rounds and most of $13.86 spent on a harness misconfiguration, where
the reviewer was right on substance and the implementer's measurements were wrong. *Mitigation, which
is why AC-2 is written as it is:* exercise the binary from inside a Vitest test through
`node:child_process`, which the allowed `pnpm turbo run test` runs; `pnpm exec` is also allowed. Do not
write a criterion whose only verification is a bare `node packages/…` command.

**R-2 — the decision entries are preconditions no step on the chore route can satisfy.** OQ-1 and
possibly OQ-2 owe entries; the role forbids writing one. Nine prior appearances; Q-0062's is the
expensive one. *Mitigation:* rule both at this gate, before the chore run is launched. If a round
nevertheless finds itself blocked, the channel is an erratum in `requirements/errata.md` written
**during** the loop as soon as the contradiction is provable (*"An erratum is the last repair, not the
first"*, 2026-08-30) — not a fourth round.

**R-3 — this is a first-pass ticket, so `harness/Q-0090/integration` does not exist.** Verified today:
`git branch --list 'harness/Q-0090*'` returns nothing. `chore.yaml`'s `review` step diffs
`harness/{id}/integration...harness/{id}/implement`, and only `integrate` — which runs later — creates
it. Since Q-0038 the preflight **refuses** rather than billing, so the run stops at run start.
*Mitigation:* create the branch by hand from the requirements tip before the chore run, per charter §8
and Q-0037's GA-2, cut deliberately rather than from whatever `HEAD` holds.

**R-4 — `integrate` runs `commands.install` with `--frozen-lockfile`.** See AC-1 and OQ-4. A manifest
change without a lockfile change fails the install after the implement step is paid for.

**R-5 — this ticket blocks five others.** Q-0091 to Q-0095 queue behind it, and the cutover and M3
queue behind them. A ruling deferred here is a ruling deferred six times. **Q-0039 (one run at a time
per ticket) becomes a blocker the moment two siblings run concurrently** — two runs on one ticket share
a worktree and compute the same `nextRunId` — and it is open, at `draft`, with no lock of any kind in
either tree.

**R-6 — the emit and the suite can disagree.** Vitest transforms `.ts` directly and never reads
`dist/`, so every existing test passes over source while the binary runs over emit. A stale or absent
`dist/` is invisible to 1,378 passing tests and visible only to AC-2's spawn test. That is the one test
standing between a green suite and a broken binary, which is a thin place: state it, and consider a
second assertion that the emitted entry is newer than its source.

**R-7 — retargeting `@quorum/shared`'s exports changes what every test resolves.** Under OQ-1 (b) or
(c). Named separately from R-6 because it is the reverse hazard: not a stale `dist` invisible to the
suite, but a `dist` the *whole suite silently starts testing*. This is the single largest hidden cost
in the ticket and the reason OQ-3 recommends a split.

**R-8 — cross-platform executable behaviour.** POSIX executable bits, shebang handling and Windows
command shims differ, and testing `node <file>` alone does not exercise the package-manager-created
shim. OQ-2's part 2 covers the POSIX shim. Windows is explicitly not claimed (non-goal 11).

**R-9 — parser drift.** Adopting a convenient argument-parsing library without fixture-level spike
parity would change flag semantics before any command is ported, silently — behaviours 4 and 5 of AC-3
are exactly what a well-behaved library would "fix".

**R-10 — hidden domain migration.** A scaffold can absorb helper logic that already belongs to `core`,
creating two sources of truth. AC-9's source guard and ground rule 4 are the check; the implement
report names anything it believed was missing rather than adding it.

---

## Provenance

**From the claude candidate, and it is the backbone of this document.** The four probes and the
finding that reframes the ticket — the workspace emits nothing, Node cannot load its TypeScript, and
`bin` therefore has nothing to point at. The correction to the ticket body's `spike/src/engine.js:87`
row. The exit table reorganised by run status rather than by source line, with `regressed` → 0 found as
an unnamed fallthrough. The derived exhaustiveness check over `packages/shared`. The seven pinned argv
behaviours including the two preserved defects. The register list (AC-11) and the four stale figures in
the development plan (AC-12(b)). R-1 through R-6 are substantially its risks. Its `--help` mechanism
finding — that reading the binary's own source cannot survive an emit — is AC-8's premise.

**From the codex candidate.** Named, read-only exit constants as one exported definition rather than a
bare table (its AC-12), which is the better shape and is now AC-5(a). The negative assertion that the
clean-clone test must not resolve or download an unrelated registry package (its AC-16), now in OQ-2
part 2 — the claude candidate gestured at this and did not make it a check. Parser independence from
the invoking shell and terminal (its AC-9), now in AC-3's test clause. No-persistent-side-effects as a
criterion rather than an assumption (its AC-21), now the second half of AC-9. "If a domain helper is
genuinely absent from core, stop and report" as a criterion (its AC-20). The cross-platform executable
risk (R-8) and parser drift (R-9), both absent from the other candidate.

**Struck from the codex candidate, with the reason.** Its AC-7 (unknown command → error, exit 1)
contradicts `spike/bin/harness.js:560–562` and ground rule 3; preserved and registered as AC-7 here
instead. Its AC-8 clause requiring "unsupported syntax must produce an explicit parse error" invents
behaviour the spike does not have — the parser has no error path at all. Its AC-10 requiring a
demonstrated colour-**disabled** rendering invents a mechanism the helper does not have; the absence is
reported under AC-4 instead. Its AC-1, AC-2 and AC-5 are not independently testable as written
("appropriate Node executable entry", "deterministic, non-empty help response") and are replaced by
AC-1's enumerated manifest fields and AC-2's spawn assertion. Twenty-four criteria against a ~ten
target, with several restating one property, is the size failure this gate exists to catch.

**Neither candidate's, added here.** The measured correction that **no test pins the absence of
`exports` on `packages/core`** — the eight byte pins are on `src/index.ts`'s content, so a
manifest-level export map costs zero pins and only the barrel nobody needs is expensive. That collapses
the claude candidate's third blocker into OQ-1 and makes AC-10 cheap. AC-8's ruling that the help lists
only commands the frame dispatches, checked as a **subset** of the registered set rather than
transcribed. The finding that the spike's engine registers `SIGTERM` as well as `SIGINT`
(`spike/src/engine.js:113–114`), carried into AC-5(d) for Q-0094. And OQ-3, the size seam.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-13. No API-key path in source, test, fixture, help text or documentation example; a scan proves it. `check()` untouched — this ticket adds no adapter code. |
| **Worktree safety** | n/a to the deliverable; AC-9 asserts the scaffold writes nothing anywhere. Relevant to the *run*: R-3 (the integration branch must exist) and Q-0062's cleanup, which now removes what the run obtained. |
| **Gate behaviour** | n/a to the deliverable. Q-0094 owns the gate reader. AC-5 declares the `undecided` → 3 and `aborted` → 2 rows a gate produces; AC-3 carries `gateAnswers` in the frame so no sibling re-parses argv. |
| **File format and schema** | No new file format. AC-5(b) *reads* `packages/shared`'s `runTerminalStatusSchema` and changes nothing in it. `package.json`, `turbo.json`, `tsconfig*.json` and `pnpm-lock.yaml` change under AC-1/AC-2. |
| **Lint rules** | AC-13. `packages/cli` enters ESLint's `packages/**/*.ts` scope, including type-aware `no-deprecated`. `harness lint` (the flow linter) is unaffected — no flow file changes. |
| **Cold-clone impact** | This *is* the cold-clone path. A build step lengthens a stranger's first 30 minutes by whatever `pnpm install && pnpm build` costs, and OQ-1 owes that number rather than an assurance. AC-2's clean-clone proof is the measurement. |
| **Product boundaries** | AC-8. New help text says Quorum and never "harness"; Q-0068's separate defect is preserved and untouched, and the implement report says so. |
| **Cross-vendor rule** | Satisfied by `chore.yaml` — `implement` on claude, `review` on codex. Nothing here changes it. |

---

## Appendix A — what was re-measured at the gate, and what did not survive

| claim | source | measured 2026-09-01 | verdict |
| --- | --- | --- | --- |
| argv block at `spike/bin/harness.js:25–26` | ticket body | declarations `:25–27`, loop `:28–39`, destructuring `:40`, `gateAnswers` `:42` | ✅ block confirmed, extent widened |
| colour helper `:44`, `die` `:124` | ticket body | exact | ✅ |
| `0`/`1` at `:404`, `:460`; `1` at `:548`; three-way at `:557` | ticket body | all exact | ✅ |
| soft `process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` | ticket body | all exact | ✅ |
| `process.exit(130)` at `spike/src/engine.js:87` | ticket body | **`:111`**; `:87` is `diffInputs: new Map(), …` | ❌ stale, claim unaffected |
| the engine handles `SIGINT` | both candidates | `SIGINT` **and** `SIGTERM`, `:113–114` | ⚠️ widened, carried to Q-0094 |
| Node cannot resolve `@quorum/shared` from source | claude probe 2 | reproduced verbatim on Node v24.15.0 | ✅ |
| `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` closes the packed path | claude probe 3 | reproduced **directly** with a fixture, not inferred from the binary's strings | ✅ strengthened |
| `@quorum/core` declares no `exports`/`main` | claude | confirmed; `import('@quorum/core')` fails `ERR_MODULE_NOT_FOUND` | ✅ |
| opening `core`'s surface costs eight landed pins | claude | **eight assertions in eight files, all pinning `src/index.ts`'s bytes; none pins the manifest.** An `exports` map moves zero pins | ❌ corrected — changes the OQ-3 ruling |
| `pnpm-lock.yaml:35` is `packages/cli: {}` | claude | exact | ✅ |
| `spike-parity` pins 220 / 2739 / 2469 / 5428, share 55% | claude | exact; entangled 2,959 | ✅ |
| eight `spike/test/` files carry a binary half; 2,515 lines; 50%; `smoke.js` 773 | plan, Q-0010 §2 | **nine files; 2,959 lines; 55%; `smoke.js` 780** — corroborated by the spelling test's independent 4 + 5 | ❌ stale, four figures |
| `CI_JOBS` is an exact seven-key register | claude | seven jobs, register at `test-command.test.ts:506` | ✅ |
| `SUITES` is two packages | claude | `packages/shared`, `packages/core` at `turbo-inputs.test.ts:129–133` | ✅ |
| `Bash(node packages/*)` is not allowed | claude | confirmed; `Bash(pnpm *)` and `Bash(node spike/*)` are | ✅ |
| `pnpm-lock.yaml` absent from the role's paths | claude | confirmed, and `docs/decisions/` forbidden by the role's prose | ✅ |
| `harness/Q-0090/integration` does not exist | R-3 | confirmed absent | ✅ |
| adding a `build` script breaks `test-discovery` | — | it does not: `TASKS` asserts the three exist, not that only three do | ✅ measured, not assumed |
| `.gitignore` already covers `dist/`, `*.tsbuildinfo` | claude | `:4` and `:9` | ✅ |
| all seven packages and `apps/web` are private; only `spike/package.json` declares a `bin` | claude | confirmed | ✅ |
| `04-architecture.md` says 55% while the plan says 50% | claude | confirmed — the architecture doc was corrected by Q-0040 on 2026-09-01 and the plan was not | ✅ |

`docs/04-architecture.md:7` still promises *"One command (`npx quorum`) starts a local daemon and opens
the browser UI"*, and `:52` promises `quorum open`, `quorum compile` and `quorum history` — none of
which exists or is in scope. AC-12(a) is what makes that paragraph describe the tree.
