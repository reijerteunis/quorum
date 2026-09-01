# Q-0090 — CLI package skeleton, `bin` entry and `npx quorum`

**Merged requirement, run 1, iteration 2. Written 2026-09-01 against `main` (`7a5bece`).**

Iteration 1 returned `needs-input` on four findings and nothing has answered them: the tree is the
same commit, `docs/decisions/` still ends at 077, there is no `requirements/errata.md`, and
`git branch --list 'harness/Q-0090*'` is still empty. Repeating three blockers over an unchanged
tree is the Q-0062 round-2 failure — a round handed a blocker it cannot clear, answering by making
the finding larger. So this iteration re-measured every claim that decides a ruling and spent the
result on **closing findings rather than restating them**. Three of the four are ruled below; one
blocker remains, and it is a size ruling this gate exists to make.

Four corrections came out of the re-measurement. Two change a criterion, and one of them is a defect
**iteration 1 introduced while merging** — recorded in Appendix A rather than quietly fixed, because
a document that corrects its own predecessor is the only evidence that the re-measurement happened.

---

## Problem

`packages/cli` is a stub. `src/index.ts` is `export const name = '@quorum/cli';`, its manifest
declares three scripts and nothing else, and its entire suite asserts that the stub is a stub. Five
sibling tickets — Q-0091 to Q-0095 — cannot start until it is a package that runs.

That much the ticket body says. What the body does not say, and what decides this ticket's size and
route, is four probes, all re-run today on the machine's **Node v24.15.0** — a version where type
stripping is on by default, so nothing here is fixed by raising the `engines` floor.

**1. Nothing under `packages/**` has ever been executed by Node.** No `build` script exists in any of
the seven packages or in `apps/web` — checked one manifest at a time, not inferred. `turbo.json`
declares `lint`, `typecheck` and `test` and no fourth task, **all three with `"outputs": []`**.
`tsconfig.base.json` sets `target`, `module`, `moduleResolution`, `strict` and `skipLibCheck` and
nothing else: no `outDir`, no `declaration`, and **no `paths`**. Every package's `typecheck` is
`tsc --noEmit`. Vitest, through Vite's transform, is the only thing that has ever loaded a `.ts`
file in this workspace. `packages/core/src/shared-resolution.test.ts:3–6` says so in the
repository's own words, written at Q-0041 — and one of its three clauses has since changed, because
`@quorum/shared` now declares `exports`, alone among seven packages.

**2. Node cannot run this workspace's TypeScript, and the reason is not the version.** Run from
`packages/core`, which declares the dependency:

```
FAIL ERR_MODULE_NOT_FOUND | Cannot find module
  '…/packages/shared/src/constants.js' imported from '…/packages/shared/src/index.ts'
```

Node **found** the package, **loaded** `index.ts` and **stripped its types**, then failed: the
source writes `./constants.js`, `moduleResolution: nodenext` maps that to `constants.ts` at compile
time, and Node's stripping does no such mapping. The extension convention this workspace follows is
a compile-time convention with no runtime counterpart. Every one of `shared`'s nine re-exports and
every cross-file import in `core` has that shape.

**3. The packaged path is closed a second time, independently.** A package whose entry is a `.ts`
file, installed under `node_modules`, is refused outright with
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Reproduced by iteration 1 with a two-file fixture
rather than inferred from the presence of the string in the binary; not re-reproduced this round,
and labelled as inherited-once-reproduced in Appendix A rather than presented as measured twice.
`npx` and `pnpm pack` both unpack into `node_modules`; the workspace symlinks pnpm creates are
resolved to their real paths before that check fires, which is why probe 2 got as far as it did and
why a symlink-based test would never have found this.

**4. `@quorum/core` is not resolvable at all — and, corrected this round, not at typecheck either.**
`import('@quorum/core')` from inside `packages/core` fails `ERR_MODULE_NOT_FOUND | Cannot find
package`. Its manifest declares no `exports`, no `main` and no `types`; `src/index.ts` is a one-line
stub; and `tsconfig.base.json` declares **no `paths`**, so TypeScript resolving `@quorum/core`
through pnpm's workspace symlink finds a manifest with no entry point and falls back to a package-root
`index.js` that does not exist. Iteration 1 framed this as a runtime question. It is also a
typecheck question, and that matters: **a type-only import of `RunStatus` from `@quorum/core` does
not compile today**, which is why AC-5 has been retyped off `@quorum/shared` (Appendix A, correction
2). The ticket requires `@quorum/cli` to depend on `core`: the dependency is **declarable and not
resolvable in either direction**, and the first sibling that imports it — Q-0091, for `board` —
discovers that instead of inheriting it.

So **Q-0090 is not "add a `bin` field to a manifest."** It is the ticket that introduces emitted
JavaScript to a workspace that has never emitted anything, which is a change to
`docs/04-architecture.md`'s shape rather than a change inside one package. §OQ-1 routes it and
§OQ-2 rules that it is a separate ticket.

A fifth fact bounds the headline: **all seven packages and `apps/web` are `"private": true`, and
none declares a `bin`**. Nothing is published, `npm publish` is Q-0029's in M6, and the root manifest
already holds the name `quorum` privately. An acceptance test written as *"run `npx quorum`"* would
either fetch a stranger's package from the registry or be quietly reinterpreted into something
weaker — *"a check that skips its subject must not report success"* (2026-08-25) arriving in this
ticket's one headline criterion. §OQ-3 rules it.

### What is *not* the problem

The domain logic. Q-0010 §1 checked eleven helpers by name and found all eleven already in
`packages/core`. Nothing here ports a helper. What is unbuilt is a frame: argv, a colour helper,
`die`, an exit-status module, a `bin` entry, and the packaging that makes the binary run.

---

## The seam, stated before the criteria because it decides which ticket each one belongs to

Every criterion below carries a tag. **`[frame]`** is Q-0090's; **`[emit]`** belongs to the
predecessor §OQ-2 recommends. If the split is refused at the gate, the tags are inert and this is one
thirteen-criterion document. If it is approved, the tags are the cut, and no criterion needs rewriting
to move.

The load-bearing property is that **every `[frame]` criterion is satisfiable and testable today, over
source, with no emit**: Vitest already transforms `packages/cli/src/**.ts`, `@quorum/shared` already
resolves, and the one criterion that needs a child process (AC-6) can spawn a `.mjs` fixture it writes
to a temporary directory. That is measured, not assumed, and it is what makes the seam real rather
than administrative.

---

## User stories

**Cold-clone adopter.** I clone the repository, follow the README, and the first command in it
produces output rather than a module-resolution stack trace. I never have to know the project is
written in TypeScript, and I am never asked for an API key.

**Solo maintainer.** I wrap `quorum run` in a shell script. Its exit code tells me which of five
things happened — it finished, it errored, a human stopped it, nobody answered a gate, or I
interrupted it — and that mapping is one typed module rather than nine `process.exit` calls I have to
find by reading.

**Sibling child (Q-0091 to Q-0095) and any later contributor.** I add a command by writing one module
against a frame that already parses argv, already owns the error path and already owns the exit
codes. I do not invent a second flag parser, I cannot introduce a sixth exit code by accident, and if
a domain helper I need is genuinely missing from `core` I stop and report rather than copying one out
of the spike.

---

## Acceptance criteria

Surfaces: **CLI** (`packages/cli`), repository configuration (`turbo.json`, `tsconfig*.json`,
`pnpm-lock.yaml`, `.github/workflows/ci.yml`) and **docs**. No criterion names a `harness/` or
`backlog/` surface, and none names `docs/decisions/`. All of these except `pnpm-lock.yaml` are inside
`developer-generalist`'s declared paths; the lockfile is addressed in AC-1 and is not an authored
edit.

---

**AC-1 `[frame]` — `packages/cli` is a real workspace package, and the lockfile moves in the same
commit as a product of `pnpm install`.**

`packages/cli/package.json` declares:

- `"dependencies"`: `"@quorum/shared": "workspace:*"` and `"@quorum/core": "workspace:*"`, and **no
  third-party dependency**. It gains nothing merely because `spike/package.json` has it;
- `"type": "module"` and an `"engines".node` floor consistent with the root's `>=22.13.0`.

`pnpm-lock.yaml:35` currently reads `packages/cli: {}`. It gains an importer block in the **same
commit**, or `commands.install`'s `pnpm install --frozen-lockfile` fails in the `integrate` worktree
and the run stops after the implement step has been paid for.

*Authority, corrected this round and stated so the implementer does not stop where it need not:*
`pnpm-lock.yaml` is absent from `developer-generalist`'s `paths`
(`harness/roles/developer-generalist.md:2`), and that list is **not mechanically enforced** — the
engine's `writesOf` (`packages/core/src/engine/loaders.ts:57`) reads `step.output.writes`, `loadRole`
is read for adapter and model defaults, and the spike's only use of a role's paths is `samplePaths`
(`engine.js:714–715`) feeding the discarded-edit warning. It is a boundary to respect, not a gate
that refuses. The lockfile does not want an authored edit in any case: it moves as the **output of
`pnpm install`**, which `Bash(pnpm *)` allows. Authorised here by name, limited to workspace importer
entries. **A third-party package appearing in that diff is a blocker, not a nit.**

*Test:* `pnpm install --frozen-lockfile` from a clean checkout of the branch exits 0; a test reads the
manifest and asserts the two workspace dependencies and the absence of any other; a test asserts the
lockfile's `packages/cli` importer is non-empty.

---

**AC-2 `[emit]` — the binary runs under Node, from this repository, with no loader flag.**

Whatever §OQ-1 rules: from a clean clone, after the workspace's supported install and build steps,
invoking the `bin` target through Node prints the help text and exits 0 — with no `--experimental-*`
flag, no `NODE_OPTIONS` and no loader. The manifest additionally declares `"bin": { "quorum": … }`
(§OQ-4) and a `"files"` field, so a pack contains the runnable artifact rather than `src/**` alone;
the entry carries a `#!/usr/bin/env node` shebang and is mode-executable on POSIX.

Under the recommended ruling (emit JavaScript) this additionally means: a `build` task exists in
`turbo.json` with its `outputs` declared; `test`, `lint` and `typecheck` relate to it such that a
suite never runs against a stale or absent emit; **no new third-party dependency** — `typescript` is
already a root `devDependency`; and `.gitignore` needs no change, already ignoring `dist/` at `:4`
and `*.tsbuildinfo` at `:9`.

*Test:* a Vitest test in `packages/cli` spawns the `bin` target with `node` through
`node:child_process`, asserting exit 0, the first line of stdout, the shebang and the executable bit.
It runs inside the ordinary suite, so `integrate` sees it — a proof that exists only as a command in
an implement report is not a test. **Demonstrate red before green:** the same test against the
pre-change tree must fail, and the failure must be probe 2's resolution error rather than a missing
file.

*Why not a bare command:* `.claude/settings.json` allows `Bash(pnpm *)`, `Bash(npm test*)`,
`Bash(npm install --prefix spike*)` and `Bash(node spike/*)`, and **not** `Bash(node packages/*)`
(re-verified today). See R-1.

---

**AC-3 `[frame]` — argv parsing is preserved exactly, including the behaviours nobody would choose.**

`spike/bin/harness.js:25–42` is the specification — the declarations at `:25–27`, the loop at
`:28–39`, `const [cmd, ...rest]` at `:40` and the `gateAnswers` queue at `:42`, all re-read this round.
Seven behaviours, each pinned separately:

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
one is a behaviour change (Provenance, struck codex AC-8).

*Test:* a table-driven test over argv arrays, one row per behaviour, asserting the parsed
`{cmd, rest, flags, gateAnswers}` shape. The parser is exported so a test supplies an array directly:
no verdict depends on the invoking shell, the terminal, git configuration, an installed vendor CLI or
an existing ignored directory. Rows 4 and 5 carry an authority line naming this criterion.

---

**AC-4 `[frame]` — `die` and the colour helper are preserved, and their two limits are registered.**

- The colour helper is six functions — `dim`, `bold`, `amber`, `green`, `red`, `teal` — emitting
  exactly the escape sequences at `spike/bin/harness.js:44` (`\x1b[2m`, `\x1b[1m`, `\x1b[33m`,
  `\x1b[32m`, `\x1b[31m`, `\x1b[36m`, each closed with `\x1b[0m`).
- `die(m)` writes `c.red('✗ ') + m` to **stderr** via `console.error` and exits 1 (`:124`). The space
  sits inside the red span, unlike every other call site in the file, and that is preserved.
- An uncaught rejection reaches `die(e.stack ?? String(e))` (`:569`), so an unexpected throw prints a
  Node stack through the error path and exits 1. Preserved.

Two limits are **reported and not fixed**: the helper performs no TTY test, so escape sequences are
written into a pipe or a file, and it honours neither `NO_COLOR` nor `FORCE_COLOR`. Both are current
behaviour on the cold-clone path. **No colour-disable mechanism is added** — inventing one to make a
test convenient is the behaviour change ground rule 3 forbids (Provenance, struck codex AC-10).
§OQ-5 rules whether a successor is owed.

*Test:* assertions over the exact escape sequences, and over `die`'s stream, message shape and exit
code, each naming this criterion. `die` is tested without terminating the test process.

---

**AC-5 `[frame]` — one exit-status module: named constants, a status map, and exhaustiveness derived
from a symbol that is actually exported.**

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
a seventh status fails to compile rather than falling through to 0. Production CLI code and CLI tests
refer to the constants rather than repeating these numeric literals.

**The map is typed off `@quorum/shared`, not off `@quorum/core`.** Corrected this round: `RunStatus`
is a *type* in `core`, erased at runtime, and `@quorum/core` does not resolve at typecheck either
(probe 4), so `Record<RunStatus, number>` does not compile from `packages/cli` today. The equivalent
that does is `RunTerminalEvent['status']`, exported from `@quorum/shared`
(`packages/shared/src/events.ts:264`, reachable through `index.ts`'s `export * from './events.js'`).

(b) **Exhaustiveness is derived, not transcribed.** A test extracts the status literals from the
**exported** `runTerminalEventSchema` — `packages/shared/src/events.ts:232`, a discriminated union
whose first member carries `regressed` and whose second carries the other five — and asserts the map's
key set equals it. **Not `runTerminalStatusSchema`**, which is the module-private `const` at `:210`
that iteration 1 named and which cannot be imported. A status added in `shared` and not here turns the
suite red without anyone remembering. **This derivation needs `@quorum/shared` only, resolved by
Vitest over source; it needs no emit and no `@quorum/core` import**, which is what keeps the whole
criterion on the `[frame]` side of the seam and independent of every blocker.

(c) **`regressed` → 0 is preserved and registered**, with an authority line naming this criterion. It
is current behaviour, it is not obviously right, and ground rule 3 forbids fixing it here.

(d) **`130` is a row of this table and no handler is installed.** `core` installs no signal handler
(Q-0050 AC-5, `04-architecture.md` principle 2), so the handler becomes the CLI's and is **Q-0094's**
to place. Note for that ticket, re-verified today: the spike's engine registers **both** `SIGINT` and
`SIGTERM` through one `onSignal` (`spike/src/engine.js:113–114`), not `SIGINT` alone, and each is
`process.once`. A test asserts the row exists and that `packages/cli` registers no signal handler.

*Test:* the derivation in (b); a mutation test for (a) — adding a status to a fixture union fails the
guard; assertions for (c) and (d).

*Correction to the ticket body, stated because the body forbids re-deriving its table from any other
source:* every line number in it verifies exactly (`:124`, `:404`, `:460`, `:499`, `:517`, `:523`,
`:531`, `:548`, `:557`) **except one**. `process.exit(130)` is at `spike/src/engine.js:111`, not
`:87`; `:87` today is `diffInputs: new Map(), deferredDiffs: new Map(),`. The row's *claim* is
unaffected. It is the one row pointing outside the file the body measured — the exact shape of the
error the body warns about, one file over.

---

**AC-6 `[frame]` — hard exit and soft exit are two mechanisms and stay two.**

`process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` (all four re-verified) sets the status and
lets the process finish writing; `process.exit` truncates. The frame exposes both and the shared
numeric meaning does not collapse them into one implementation. A port that collapses them loses
output on the `runs` warning paths.

*Test:* **demonstrated, not asserted.** A child process that sets the soft code and then writes a
large payload to stdout exits 1 with the payload complete; the same child using `process.exit` loses
it. Both rows in one test. The child is a `.mjs` fixture the test writes to a temporary directory, so
this criterion needs no emit — which is what puts it on the `[frame]` side.

---

**AC-7 `[frame]` — an unknown or absent command prints help and exits 0, preserved and registered.**

`spike/bin/harness.js:560–562`: the `default:` branch prints usage and returns, so `main()` resolves
and the process exits 0. `quorum`, `quorum nonsense` and `quorum --help` all exit 0.

This is preserved under ground rule 3 and **registered as a defect**, because a shell script cannot
distinguish "did the thing" from "did not understand you". It is registered rather than quietly
carried, because this ticket's whole deliverable is the exit table and a row nobody wrote down is the
row that is wrong. §OQ-5 rules whether a successor is owed.

*Ruling, against the codex candidate's AC-7:* changing this to exit 1 is a behaviour change, on the
one surface a stranger meets first, decided inside a ticket whose stated scope is a frame. It is
defensible and it is not this ticket's to take.

*Test:* three invocations, each asserting exit 0 and non-empty stdout, each naming this criterion.

---

**AC-8 `[frame]` — the help text is owned data, it says Quorum, and it claims only what the build
dispatches.**

`:561` produces help by **reading the binary's own source file** —
`fs.readFileSync(fileURLToPath(import.meta.url))`, slicing lines 1–10 and stripping `// `. That
mechanism cannot survive AC-2 under any ruling: emitted JavaScript does not carry the comment block at
those line numbers, and reading `import.meta.url`'s file from inside a package under `node_modules` is
not a thing to build a help system on. So the mechanism changes to owned data.

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

*Test:* the help is asserted to contain the usage form and the product name; asserted to contain no
occurrence of the word `harness` outside a path literal such as `harness/harness.yaml`; the mechanism
is asserted **not** to read its own source (no `fileURLToPath(import.meta.url)` + `readFileSync` pair
in the help path); and — the derived clause — **every command name appearing in the help is a member
of the frame's registered-command set**, so a sibling that documents a command without registering it
turns the suite red.

---

**AC-9 `[frame]` — no command is implemented, no domain helper is copied, and the scaffold writes
nothing.**

The deliverable is the frame plus help. `board`, `ticket`, `init`, `run`, `lint`, `adapters`,
`validate` and `runs` are Q-0091 to Q-0094; `smoke.js` is Q-0095's.

`packages/core` already holds every domain helper (Q-0010 §1, eleven of eleven). If one appears to be
missing, implementation **stops and reports the absence** rather than adding it to CLI scope
(ground rule 4).

Running the executable with no arguments, `--help`, an unknown command or a malformed argv creates or
changes no file in the working tree, `backlog/`, `harness/`, `.quorum/` or `.harness/worktrees/`, and
starts no daemon, probes no adapter and runs no flow.

*Test:* a source-level guard over `packages/cli/src/**` asserting that no file imports a
run-executing or backlog-writing symbol, with its file list **derived from the directory** rather than
hand-written — the failure Q-0051 found in `q0050.source.test.ts`'s third list, which failed open.
Plus a filesystem test: snapshot a temporary project directory, run all four invocation shapes, assert
the tree is unchanged.

---

**AC-10 `[emit]` — whether `@quorum/core` is importable is settled, and recorded either way.**

**A measured correction that makes this cheap, confirmed again this round.** The claude candidate
framed opening `core`'s surface as an act against eight landed pins. It is not. The eight assertions
live in seven `packages/core/src/**/*.source.test.ts` files (`adapters`, `backlog`, `contracts`,
`fanout`, `git`, `lint`, `run-history`) plus `packages/shared/src/index.test.ts:68`, and every one of
them pins the **bytes of `packages/core/src/index.ts`** — `expect(repoFile(…)).toBe("export const name
= '@quorum/core';\n")`. **No test asserts that `packages/core/package.json` declares no `exports`.**
A manifest-level `exports` map moves *zero* pins; only a barrel re-export through `index.ts` costs
anything, and nothing in this ticket or its siblings needs the barrel.

What remains is entailed by §OQ-1 — an `exports` map can only name a target that exists. Under the
ruling, one of:

(a) **`core` emits and declares `exports`.** `packages/cli` imports one real symbol and AC-2's spawn
test proves a cross-package runtime import rather than only that a self-contained file runs. The byte
pins stay untouched, because the map names emitted paths and not the barrel.

(b) **`core` stays unresolvable.** A test in `packages/cli` **proves** it — asserting that
`@quorum/core` resolves to nothing, **at runtime and at typecheck**, which is the clause iteration 1
did not have — and the finding is written into **Q-0091's ticket body by the human at this gate**,
because a `packages/cli` that declares an unusable dependency is a trap for the next child and an
obligation recorded only in a closed ticket's report expires.

Either way AC-1's declared dependency is unchanged: the ticket body requires it, and declaring it is
what makes turbo's `^build` / `^test` edge exist.

*Test:* under (a), an import of a real `core` symbol from `packages/cli` that compiles and runs under
AC-2's spawned binary. Under (b), the two resolution assertions plus a `runs.log` note naming Q-0091.

---

**AC-11 `[emit]` — every register this change earns is moved, and the numbers are re-derived rather
than adjusted.**

Named individually, because each fails differently. All four re-read today.

(a) `packages/core/src/turbo-inputs.test.ts` — `SUITES` (`:129–133`) says *"The two packages whose
suites read outside themselves. The other five read nothing outside."* If `packages/cli`'s tests read
any repository path outside the package, `@quorum/cli#test` becomes the third, and `SUITES`,
`MANIFEST` and the package's own `turbo.json` move together. If they read nothing outside, that is a
**measured** claim to state, not an omission. This guard has stopped four tickets on the way in;
stopping is the correct behaviour.

(b) `packages/core/src/test-discovery.test.ts` — every workspace package declares `lint`, `typecheck`
and `test`, and every `*.test.ts` is collected by the configured include. Measured rather than
assumed: `TASKS` asserts the three **exist**, not that only three do, so a `build` script is additive
and breaks nothing — but it must not displace `test`.

(c) `packages/core/src/test-command.test.ts` — `CI_JOBS` (`:506`) is an exact seven-key register of
`.github/workflows/ci.yml`'s jobs (verified: `workspace`, `port-freeze-policy`,
`port-freeze-branch-scope`, `port-freeze-sha`, `spike`, `git-identity-sweep-bare`,
`git-identity-sweep-populated`). If AC-2's proof adds a CI job, the register gains a row **and a
sentence saying what that job's green tick claims**. If it does not, say so.

(d) `packages/core/src/spike-parity.test.ts` — ground rule 5. This ticket translates **no**
`spike/test/` file, so the four pinned totals — `binary-only` 220, `both` 2739, `library-only` 2469,
total 5428, share **55%** (re-read at `:1134–1140`) — should not move. **Re-derive them and state that
they did not**, from the failing-pin output rather than from arithmetic on the diff. That is the method
that caught the share crossing 54% → 55% on nineteen lines during Q-0040.

---

**AC-12 — the two documents that describe this package are corrected, and one is stale today.**

(a) `[emit]` `docs/04-architecture.md` — the `packages/cli` section (`:52`) and the *Shape* line
(`:7`) must state how the binary executes once §OQ-1 is ruled. `:7` promises *"One command (`npx
quorum`) starts a local daemon and opens the browser UI"* and `:52` promises `quorum open`, `quorum
compile` and `quorum history` — none of which exists or is in scope. Bump the status line with the
date and what changed, per the docs rules.

(b) `[frame]` `docs/06-development-plan.md:481` reads **"2,515 lines across eight `spike/test/` files
carry a binary half and transfer here, half the spike suite by line, `smoke.js`'s 773 among them."**
Measured today against `spike-parity.test.ts`'s own register: **nine** files — one `binary-only` plus
eight `both`, corroborated independently by the adjacent spelling test's 4 + 5 — **2,959 lines**,
**55%**, and `wc -l spike/test/smoke.js` is **780**. Four figures, all stale, in the bullet describing
this ticket's parent. `docs/04-architecture.md:73` already says 55%, so the two documents disagree with
each other as well as with the register.

This is in scope as ground rule 5's second half: a register is re-derived rather than transcribed, and
a transcription of it that has drifted is what the register exists to catch. It is one edit, checkable
against a test that already runs, and `docs` is inside the role's paths.

**`backlog/Q-0010-…/ticket.md` §2 carries the same four stale figures and is not touched**: the backlog
belongs to the harness, the engine discards an agent's edits under it, and the role file says so.
Correcting it is the human's at this gate. It is named here so the obligation does not expire.

---

**AC-13 — the cross-cutting pillars, checked rather than assumed.**

- **BYOS `[frame]`.** No file in `packages/cli` mentions an API key, an environment variable named
  `*_API_KEY`, a token or a credential — in source, test, fixture, help text or documentation example.
  No adapter is probed by any scaffold invocation and `check()` is untouched. *Test:* a scan over
  `packages/cli/**` asserting zero occurrences, the guard excluding itself and the exclusion asserted
  load-bearing.
- **Lint and typecheck `[frame]`.** `pnpm turbo run lint --force` and `pnpm turbo run typecheck
  --force` green over the new package. It falls inside ESLint's `packages/**/*.ts` scope, so
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
   `freeze-sha` (re-recorded at `8bc4c9b` after Q-0040) and the `port-freeze-sha` CI job is live, so a
   `spike/src` change turns `main` red and owes §3's mirror-and-re-record. Q-0090 is **not** in the
   charter's `children:` list, so the branch-scope job reports it out of scope — the rule is the ticket
   body's, not the guard's, and the guard is therefore not a safety net here.
7. **`spike/test/**`.** Ground rule 2 — added to, never edited or deleted, until the cutover.
8. **A UI, a daemon, `quorum open`, `quorum compile`, `quorum history`.** M3 and M5, whatever
   `04-architecture.md:52` currently promises.
9. **`@quorum/templates`.** `init` reads `spike/templates/harness` today; giving the CLI its own
   shipped templates is Q-0093's, and will move AC-2's `files` field again.
10. **Colour policy** (`NO_COLOR`, TTY detection), **an unknown-command exit code**, and
    **`regressed` → 0** — all reported under AC-4, AC-7 and AC-5(c), and fixed by the successor §OQ-5
    opens.
11. **Windows.** The `bin` shim's behaviour on Windows is not claimed and not tested; CI and the
    developer machines are POSIX. Stated rather than silently assumed (R-8).
12. **A parser library.** The frame preserves the spike's parser; selecting a library would change flag
    semantics before any command is ported (R-9).

---

## Open questions

**One blocks, and it is a size ruling rather than a design unknown.** Iteration 1 raised three
blockers and one ruling; three of the four are ruled below on measurements taken this round, so the
gate answer needed here is one decision plus a decision entry rather than four.

---

**OQ-1 (BLOCKER, owner: Ruud, before any code) — how does the binary execute, and how far does the
emit reach?**

The workspace emits nothing and Node cannot load its TypeScript (probes 1–4). Four shapes, three
refuted by measurement:

| shape | verdict |
| --- | --- |
| Point `bin` at a `.ts` file and rely on Node's type stripping | **Refused.** Probe 2: stripping does not map `.js` specifiers to `.ts`, so the first cross-file import fails — on Node v24.15.0, where stripping is on by default, so the `engines` floor is not the cause and raising it is not the cure. Probe 3: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` closes the installed and packed paths regardless. |
| Write `packages/cli`'s runtime in plain JavaScript | **Refused.** `harness/rules.md` — TypeScript strict, no exceptions; ESLint's scope is `packages/**/*.ts`, and `packages/*/src` holds zero `.js` files. |
| Bundle with esbuild / tsup into one self-contained file | **Not recommended.** A new dependency needs a justification and, changing architecture, a decision entry — and it puts a third-party package in `pnpm-lock.yaml`. It buys one thing the next shape does not: a tarball with no `workspace:*` dependencies, which is §OQ-3's problem. |
| **`tsc` emit** — `outDir`, a turbo `build` task with declared `outputs`, `bin` → the emitted entry | **Recommended.** No new dependency (`typescript` is a root `devDependency`); `dist/` and `*.tsbuildinfo` are already gitignored; and the `.js`-specifier convention the source already follows is exactly what `nodenext` emit resolves correctly. It also gives `packages/server` and `apps/web` the emit they need in M3. |

**The ruling must also fix the emit's reach:**

- **(a) `cli` only.** Smallest. The frame imports nothing from `core` or `shared` at runtime — AC-5(b)'s
  derivation is a *test* over source — so this works today. AC-2 then proves the `bin` entry, the
  shebang, the executable bit and the packaging, but **not** that a workspace import resolves. Q-0091
  hits that wall inside a ticket about four read-only commands.
- **(b) `cli` + `shared`.** AC-2 additionally proves one cross-package runtime import.
- **(c) `cli` + `shared` + `core`.** The full path every sibling needs, and what makes AC-10(a)
  possible.

**Recommended: (c).** The reason (c) is not a free widening is R-7: `@quorum/shared`'s `exports` names
`./src/index.ts` for both `types` and `default`, and **56 files import `@quorum/shared`, 33 of them
test files**, every one resolving through that target. Retargeting it to `dist` makes them run against
emitted output, where a stale `dist/` silently changes what they are testing. Keeping Vitest on source
while Node reads `dist` needs conditional exports or a Vitest alias, decided deliberately.

Three consequences to settle inside the same ruling:

- **Does `test` depend on `build`?** `commands.test` in `harness.yaml` runs no build. If AC-2's spawn
  test needs an emit, either `test` gains `dependsOn: ["build"]` or the CLI's own `test` script builds
  first. The former is cleaner and changes `turbo.json` for every package.
- **`erasableSyntaxOnly`?** Setting it in `tsconfig.base.json` makes `tsc` refuse syntax that cannot be
  stripped, keeping a future stripping route open at zero cost. It is a default, so it is a decision
  and not a tidy-up.
- **What does a `build` cache hit claim?** All three existing tasks declare `"outputs": []`; a `build`
  task declares real outputs and therefore a real restore path — a *verdict* replay in the sense
  `04-architecture.md` distinguishes from a *download* replay. CI forces; a developer's local run and
  `integrate` are the cells to think about. Name it in the entry rather than discovering it.

**The decision entry is owed before code**, and `developer-generalist.md:23` forbids the implement step
from writing one. A candidate title: *"The workspace emits JavaScript, because Node cannot run the
TypeScript it compiles"*.

---

**OQ-2 (BLOCKER, owner: Ruud, at the gate) — one ticket or two? Recommended: two, unconditionally.**

Iteration 1 made this contingent on OQ-1's reach. Two measurements taken this round remove the
condition, so it is now a recommendation rather than a fork:

1. **A `build` task owes a decision entry under every shape, including (a).** The three existing tasks
   declare `"outputs": []`; the first task with real outputs introduces a real verdict-replay path into
   a repository that has ruled on what a green tick claims four times (*"the test command defeats its
   own cache"*, *"a green tick names what it examined"*, *"a cache hit names what the task reads"*, *"a
   red tick names what failed"*). That is not a criterion.
2. **The `exports` retarget has its own risk profile.** 56 importers, 33 of them tests, all resolving
   through `./src/index.ts`. R-7 is not a footnote on AC-2; it is the subject of a requirement.

**Recommended shape — a new predecessor rather than a renumbering:**

- **Q-0096 (the id the allocator answers today; the backlog's maximum is Q-0095) — "The workspace emits
  JavaScript."** `outDir`, `declaration`, the turbo `build` task and its `outputs`, the reach ruling,
  `exports` maps for `core` and `shared`, and the rule that keeps Vitest resolving source while Node
  resolves `dist`. Owes OQ-1's decision entry. Takes **AC-2, AC-10, AC-11(a)–(c), AC-12(a)** from this
  document plus its own build-specific criteria — roughly ten.
- **Q-0090 keeps its id, its title and its body**, minus the build half: **AC-1, AC-3 to AC-9,
  AC-12(b), AC-13** — roughly ten criteria, every one of them satisfiable over source today.

A new predecessor rather than a Q-0090a/Q-0090b split because **`Q-0090a` is not a legal id** under the
grammar `/^[A-Z]+-[0-9]{4}$/`, and because Q-0090 is cited by id as the siblings' prerequisite in five
ticket bodies and in `docs/06-development-plan.md`; this way every one of those citations stays true.

**Order:** Q-0096 → Q-0090 → Q-0091–Q-0094 (any order) → Q-0095. **The cost, stated rather than
implied:** the chain to the siblings grows by one ticket, and Q-0010's "Q-0090 is the prerequisite, and
the only one" becomes "Q-0096 and Q-0090 are, in that order".

**The alternative, if you want work startable before the entry is written:** invert the order. Every
`[frame]` criterion is testable by Vitest over source today, so Q-0090 could run first as library code
with no `bin`, and Q-0096 add the emit and the binary behind it. Not recommended — it moves this
ticket's own headline into its successor — but it is the only shape in which a chore run can be
launched this evening.

**If the split is refused,** the tags are inert, this is one thirteen-criterion document at the ceiling,
and OQ-1's ruling plus its decision entry are owed before the chore run exactly as they are above.

---

**OQ-3 — RULED HERE, not asked: what "`npx quorum` from a clean clone" is allowed to mean.**

All seven packages and `apps/web` are `"private": true`, none declares a `bin`, publishing is Q-0029's
in M6 by non-goal 4, and `pnpm pack` rewrites `workspace:*` to `@quorum/core@0.0.0` and
`@quorum/shared@0.0.0`, installable from nowhere. So registry `npx quorum` cannot be built by this
ticket under any answer short of pulling M6 work forward — a milestone reordering, not a design choice
inside this ticket. The measurement is dispositive, so this is ruled rather than escalated:

1. **Workspace path, claimed and automated.** Clean clone → install → build → the `bin` runs and prints
   help, exit 0.
2. **Packaging path, claimed and automated.** `pnpm pack` the CLI, install the tarball into a temporary
   directory *together with* locally packed `core` and `shared` tarballs, and run the linked binary.
   This proves `files`, `bin`, the shebang, the executable bit and the emit — the things a workspace
   symlink hides — and it is the closest honest proxy for `npx`. It **must assert that no package is
   resolved or downloaded from the public registry**, or the test can pass by fetching a stranger's
   `quorum`.
3. **Registry `npx quorum` is Q-0029's and is *not* claimed.** Said in `docs/06-development-plan.md` and
   in the implement report.

This narrows the ticket body's headline, which is yours to overturn at the gate; the build is the same
either way, so it does not block solutioning. If a single self-contained bundle is preferred so part 2
needs no sibling tarballs, that is OQ-1 shape 3 and the two are answered together.

---

**OQ-4 — RULED HERE: the package name and the `bin` name.**

The `bin` key is `quorum`: that is what the README will type, and `product-boundaries.md` forbids
`harness`. The **package** stays `@quorum/cli` — `quorum` is what a published `npx quorum` would
require and is already taken locally by the private root manifest. The published name is left to
Q-0029, with the collision recorded so that ticket inherits it rather than rediscovering it.

---

**OQ-5 — RULED HERE: one successor for the two zeros, none for colour.**

(a) An unknown or absent command exits **0** (AC-7). (b) Colour is emitted into a pipe, with no
`NO_COLOR` and no TTY test (AC-4). (c) `regressed` exits **0**, sharing the fallthrough with
`completed` (AC-5(c)).

All three are current behaviour and ground rule 3 forbids fixing them here. (a) and (c) are exit codes,
so they are this ticket's *subject* even though they are not its scope, and each needs a decision about
what the code should be rather than a gate fix — so, per *resolve rather than open a successor*, they
are a ticket. **One successor covering (a) and (c)**, the exit table's two zeros that should not be
zero, opened by the human at this gate. **None for (b)** until the README exists to say what a stranger
sees.

**The lockfile question iteration 1 raised as OQ-4 is withdrawn**, not deferred: the role's `paths:`
list is not mechanically enforced and the lockfile is not an authored edit. See AC-1's *Authority*
clause.

---

## Risks

**R-1 — the permission allowlist refuses the command this ticket needs.** `.claude/settings.json`
allows `Bash(pnpm *)`, `Bash(npm test*)`, `Bash(npm install --prefix spike*)` and `Bash(node spike/*)`,
and **not** `Bash(node packages/*)` (re-verified today). An implementer verifying the binary with `node
packages/cli/…` is refused. This is Q-0038's rounds 1 to 3 exactly — three implement rounds and most of
$13.86 spent on a harness misconfiguration, where the reviewer was right on substance and the
implementer's measurements were wrong. *Mitigation, which is why AC-2 is written as it is:* exercise the
binary from inside a Vitest test through `node:child_process`, which the allowed `pnpm turbo run test`
runs; `pnpm exec` is also allowed. Do not write a criterion whose only verification is a bare `node
packages/…` command.

**R-2 — the decision entry is a precondition no step on the chore route can satisfy.** OQ-1 owes one and
`developer-generalist.md:23` forbids writing it. Nine prior appearances; Q-0062's is the expensive one —
its requirement named the precondition as GO-1, the run was launched without it, and rounds 1 to 3 went
entirely on a blocker no step could clear. *Mitigation:* write it at this gate, before the chore run. If
a round nevertheless finds itself blocked, the channel is an erratum in `requirements/errata.md` written
**during** the loop as soon as the contradiction is provable (*"An erratum is the last repair, not the
first"*, 2026-08-30) — not a fourth round.

**R-3 — this is a first-pass ticket, so `harness/Q-0090/integration` does not exist.** Re-verified
today: `git branch --list 'harness/Q-0090*'` returns nothing. `chore.yaml`'s `review` step diffs
`harness/{id}/integration...harness/{id}/implement`, and only `integrate` — which runs later — creates
it. Since Q-0038 the preflight **refuses** rather than billing, so the run stops at run start.
*Mitigation:* create the branch by hand from the requirements tip before the chore run, per charter §8
and Q-0037's GA-2, cut deliberately rather than from whatever `HEAD` holds. The same applies to Q-0096
if the split is approved.

**R-4 — `integrate` runs `commands.install` with `--frozen-lockfile`.** See AC-1. A manifest change
without a lockfile change fails the install after the implement step is paid for.

**R-5 — this ticket blocks five others.** Q-0091 to Q-0095 queue behind it, and the cutover and M3 queue
behind them. A ruling deferred here is a ruling deferred six times — and, if the split is approved,
seven. **Q-0039 (one run at a time per ticket) becomes a blocker the moment two siblings run
concurrently** — two runs on one ticket share a worktree and compute the same `nextRunId` — and it is
open, at `draft`, with no lock of any kind in either tree.

**R-6 — the emit and the suite can disagree.** Vitest transforms `.ts` directly and never reads `dist/`,
so every existing test passes over source while the binary runs over emit. A stale or absent `dist/` is
invisible to the whole workspace suite and visible only to AC-2's spawn test. That is the one test
standing between a green suite and a broken binary, which is a thin place: state it, and consider a
second assertion that the emitted entry is newer than its source.

**R-7 — retargeting `@quorum/shared`'s exports changes what every importer resolves.** Under OQ-1 (b) or
(c). Named separately from R-6 because it is the reverse hazard: not a stale `dist` invisible to the
suite, but a `dist` the suite silently starts testing. Measured this round: **56 files import
`@quorum/shared`, 33 of them test files**, and the manifest names `./src/index.ts` for both `types` and
`default`. This is the single largest hidden cost in the ticket and the first of OQ-2's two reasons to
split.

**R-8 — cross-platform executable behaviour.** POSIX executable bits, shebang handling and Windows
command shims differ, and testing `node <file>` alone does not exercise the package-manager-created
shim. OQ-3's part 2 covers the POSIX shim. Windows is explicitly not claimed (non-goal 11).

**R-9 — parser drift.** Adopting a convenient argument-parsing library without fixture-level spike parity
would change flag semantics before any command is ported, silently — behaviours 4 and 5 of AC-3 are
exactly what a well-behaved library would "fix".

**R-10 — hidden domain migration.** A scaffold can absorb helper logic that already belongs to `core`,
creating two sources of truth. AC-9's source guard and ground rule 4 are the check; the implement report
names anything it believed was missing rather than adding it.

---

## Provenance

**From the claude candidate, and it is the backbone of this document.** The probes and the finding that
reframes the ticket — the workspace emits nothing, Node cannot load its TypeScript, and `bin` therefore
has nothing to point at. The correction to the ticket body's `spike/src/engine.js:87` row. The exit table
reorganised by run status rather than by source line, with `regressed` → 0 found as an unnamed
fallthrough. The derived exhaustiveness check over `packages/shared`. The seven pinned argv behaviours
including the two preserved defects. The register list (AC-11) and the four stale figures in the
development plan (AC-12(b)). R-1 through R-6 are substantially its risks. Its `--help` mechanism finding
— that reading the binary's own source cannot survive an emit — is AC-8's premise.

**From the codex candidate.** Named, read-only exit constants as one exported definition rather than a
bare table (its AC-12), which is the better shape and is now AC-5(a). The negative assertion that the
clean-clone test must not resolve or download an unrelated registry package (its AC-16), now OQ-3 part 2
— the claude candidate gestured at this and did not make it a check. Parser independence from the
invoking shell and terminal (its AC-9), now AC-3's test clause. No-persistent-side-effects as a criterion
rather than an assumption (its AC-21), now the third paragraph of AC-9. "If a domain helper is genuinely
absent from core, stop and report" as a criterion (its AC-20). The cross-platform executable risk (R-8)
and parser drift (R-9), both absent from the other candidate.

**Struck from the codex candidate, with the reason.** Its AC-7 (unknown command → error, exit 1)
contradicts `spike/bin/harness.js:560–562` and ground rule 3; preserved and registered as AC-7 here
instead. Its AC-8 clause requiring "unsupported syntax must produce an explicit parse error" invents
behaviour the spike does not have — the parser has no error path at all. Its AC-10 requiring a
demonstrated colour-**disabled** rendering invents a mechanism the helper does not have; the absence is
reported under AC-4 instead. Its AC-1, AC-2 and AC-5 are not independently testable as written
("appropriate Node executable entry", "deterministic, non-empty help response") and are replaced by
AC-1's and AC-2's enumerated manifest fields and spawn assertion. Twenty-four criteria against a ~ten
target, several restating one property, is the size failure this gate exists to catch.

**From iteration 1 of this merge, kept.** The measured correction that **no test pins the absence of
`exports` on `packages/core`** — the eight byte pins are on `src/index.ts`'s content, so a manifest-level
export map costs zero pins and only the barrel nobody needs is expensive; re-verified this round. AC-8's
ruling that the help lists only commands the frame dispatches, checked as a **subset** of the registered
set. The finding that the spike's engine registers `SIGTERM` as well as `SIGINT`, carried into AC-5(d)
for Q-0094.

**Iteration 2's own, and two of them correct iteration 1.** The four corrections in Appendix A. The seam
tags on every criterion, and the measurement behind them — that every `[frame]` criterion is satisfiable
over source today, which is what makes OQ-2's split a cut rather than an administrative boundary. The
unconditional split recommendation and its two grounds (a `build` task owes an entry under every shape;
56 importers resolve through `shared`'s source `exports`). The predecessor-rather-than-renumber shape,
because `Q-0090a` is not a legal id and Q-0090 is cited by id in five sibling bodies. And the three
questions ruled here rather than escalated, which is what took the gate answer from four findings to one.

---

## Appendix A — what was re-measured this iteration, and the four corrections

Everything below was run against `main` at `7a5bece` on 2026-09-01, after iteration 1's verdict. The
first two corrections change a criterion.

| # | claim | source | measured this round | verdict |
| --- | --- | --- | --- | --- |
| **1** | derive the exit table's exhaustiveness from `runTerminalStatusSchema` | **iteration 1's own AC-5(b)** | that is a module-private `const` at `events.ts:210`; the exported symbol is `runTerminalEventSchema` at `:232` | ❌ **corrected** — the check as written could not compile. The claude candidate named the exported one; the merge broke it |
| **2** | opening `core` is a runtime question | iteration 1, AC-10 | `tsconfig.base.json` declares **no `paths`** and the manifest no `exports`/`main`/`types`, so `@quorum/core` fails **typecheck** too — a type-only import of `RunStatus` does not compile | ❌ **corrected** — AC-5(a) retyped off `RunTerminalEvent['status']` from `@quorum/shared`, which resolves |
| **3** | `pnpm-lock.yaml` is outside the role's paths, so authorisation is owed | iteration 1, OQ-4 | true of the list, but the list is **not enforced**: `writesOf` reads `step.output.writes`, `loadRole` gives adapter/model defaults, `samplePaths` (`engine.js:714–715`) feeds a warning. And the lockfile moves as `pnpm install`'s output, which `Bash(pnpm *)` allows | ❌ **withdrawn as a blocker**, folded into AC-1 |
| **4** | the split is contingent on OQ-1's reach | iteration 1, OQ-3 | a `build` task declares real `outputs` against three tasks at `"outputs": []` — a verdict-replay path owing an entry under **every** shape; and 56 files (33 tests) resolve `@quorum/shared` through `./src/index.ts` | ❌ **strengthened** to unconditional |
| | `process.exit(130)` at `spike/src/engine.js:87` | ticket body | **`:111`**; `:87` is `diffInputs: new Map(), deferredDiffs: new Map(),` | ❌ stale, claim unaffected |
| | the engine handles `SIGINT` | both candidates | `SIGINT` **and** `SIGTERM`, both `process.once` on one `onSignal`, `:113–114` | ⚠️ widened, carried to Q-0094 |
| | argv block at `:25–26` | ticket body | declarations `:25–27`, loop `:28–39`, destructuring `:40`, `gateAnswers` `:42` | ✅ block confirmed, extent widened |
| | colour helper `:44`, `die` `:124` | ticket body | exact, escape sequences read out | ✅ |
| | `0`/`1` at `:404`, `:460`; `1` at `:548`; three-way at `:557` | ticket body | all exact; `:557` is the single three-way | ✅ |
| | soft `process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` | ticket body | all four exact | ✅ |
| | Node cannot resolve `@quorum/shared` from source | claude probe 2 | reproduced verbatim on Node v24.15.0 | ✅ |
| | `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` closes the packed path | claude probe 3 | **not re-reproduced this round**; inherited from iteration 1's fixture reproduction | ⚠️ inherited, labelled |
| | `@quorum/core` declares no `exports`/`main` | claude | confirmed; `import('@quorum/core')` fails `Cannot find package` | ✅ |
| | opening `core`'s surface costs eight landed pins | claude | eight assertions in eight files, all pinning `packages/core/src/index.ts`'s bytes; **none pins the manifest** | ✅ iteration 1's correction holds |
| | no `build` script anywhere; only `shared` declares `exports`; none declares `bin`; all private | claude | confirmed, manifest by manifest across seven packages and `apps/web` | ✅ |
| | `pnpm-lock.yaml:35` is `packages/cli: {}` | claude | exact | ✅ |
| | `spike-parity` pins 220 / 2739 / 2469 / 5428, share 55% | claude | exact, at `:1134–1140`; entangled 2,959 | ✅ |
| | eight `spike/test/` files carry a binary half; 2,515 lines; 50%; `smoke.js` 773 | plan `:481`, Q-0010 §2 | **nine files; 2,959 lines; 55%; `smoke.js` 780** (`wc -l`) — corroborated by the spelling test's independent 4 + 5 | ❌ stale, four figures |
| | `CI_JOBS` is an exact seven-key register | claude | seven jobs at `test-command.test.ts:506`, read out by name | ✅ |
| | `SUITES` is two packages | claude | `packages/shared`, `packages/core` at `turbo-inputs.test.ts:129–133` | ✅ |
| | adding a `build` script breaks `test-discovery` | iteration 1 | it does not: `TASKS` asserts the three exist, not that only three do | ✅ |
| | `Bash(node packages/*)` is not allowed | claude | confirmed; `Bash(pnpm *)`, `Bash(npm test*)`, `Bash(npm install --prefix spike*)`, `Bash(node spike/*)` are | ✅ |
| | `.gitignore` already covers `dist/`, `*.tsbuildinfo` | claude | `:4` and `:9` | ✅ |
| | `harness/Q-0090/integration` does not exist | R-3 | confirmed absent | ✅ |
| | `04-architecture.md` says 55% while the plan says 50% | claude | confirmed — `:73`; the architecture doc was corrected by Q-0040 and the plan was not | ✅ |
| | root `engines.node` is `>=22.13.0`, `typescript` is a root devDependency | — | confirmed | ✅ |
| | the backlog's highest id is Q-0095 | OQ-2 | confirmed, 71 ticket folders | ✅ so the allocator answers Q-0096 |

`docs/04-architecture.md:7` still promises *"One command (`npx quorum`) starts a local daemon and opens
the browser UI"*, and `:52` promises `quorum open`, `quorum compile` and `quorum history` — none of
which exists or is in scope. AC-12(a) is what makes that section describe the tree.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | AC-13. No API-key path in source, test, fixture, help text or documentation example; a scan proves it. `check()` untouched — this ticket adds no adapter code. |
| **Worktree safety** | n/a to the deliverable; AC-9 asserts the scaffold writes nothing anywhere. Relevant to the *run*: R-3 (the integration branch must exist) and Q-0062's cleanup, which now removes what the run obtained. |
| **Gate behaviour** | n/a to the deliverable. Q-0094 owns the gate reader. AC-5 declares the `undecided` → 3 and `aborted` → 2 rows a gate produces; AC-3 carries `gateAnswers` in the frame so no sibling re-parses argv. |
| **File format and schema** | No new file format. AC-5(b) *reads* `packages/shared`'s exported `runTerminalEventSchema` and changes nothing in it. `package.json`, `turbo.json`, `tsconfig*.json` and `pnpm-lock.yaml` change under AC-1/AC-2. |
| **Lint rules** | AC-13. `packages/cli` enters ESLint's `packages/**/*.ts` scope, including type-aware `no-deprecated`. `harness lint` (the flow linter) is unaffected — no flow file changes. |
| **Cold-clone impact** | This *is* the cold-clone path. A build step lengthens a stranger's first 30 minutes by whatever `pnpm install && pnpm build` costs, and OQ-1 owes that number rather than an assurance. AC-2's clean-clone proof is the measurement. |
| **Product boundaries** | AC-8. New help text says Quorum and never "harness"; Q-0068's separate defect is preserved and untouched, and the implement report says so. |
| **Cross-vendor rule** | Satisfied by `chore.yaml` — `implement` on claude, `review` on codex. Nothing here changes it. |
