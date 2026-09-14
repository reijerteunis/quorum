# Q-0126 — `quorum open` starts the daemon and opens a browser

*Merged requirement, run 1, iteration 2. Written against the tree at `889a750`, 2026-09-14. Every
measurement was re-taken from the working tree rather than transcribed from either candidate, from
the ticket body, or from iteration 1. **Three findings are new and one of them changes the work** —
§0.1, §0.2 and §0.3.*

---

## 0. What iteration 2 re-measured, and what moved

### 0.0 The tree has not moved, and this iteration cannot clear its own blockers

Stated first, because it bounds what the rest of this document is worth. The tip is `889a750`,
unchanged; `docs/decisions/` still ends at **093**; `Q-0126` is still the highest allocated id; and
`git status` carries nothing but this run's own `requirements/` and `runs.log`. So **none of
iteration 1's three blockers has been discharged**, and none of them can be discharged by this
flow — the size ruling is the gate's, the decision entry is one `developer-generalist` is forbidden
to write, and `pnpm-lock.yaml` is outside that role's `paths:`.

This is the fifth recorded instance of *a retry on an unchanged tree cannot rule its own blocker*
(Q-0090, Q-0096, Q-0105, Q-0122) and the third where the second pass **found something anyway**.
What it found is below. **The gate should discharge the three and answer `advance`, not `retry`**: a
third iteration would re-measure the same tree and return the same verdict, which is the loop Q-0070
and Q-0079 both ended by advancing.

### 0.1 NEW, and it makes iteration 1's AC-3 unimplementable: the bundle root cannot be a string in `packages/cli`

Iteration 1's AC-3 said the root is `new URL('../../../apps/web/dist/', import.meta.url)`
**"or equivalent"**. Measured, there is no equivalent that `packages/cli` is permitted to write.

- `packages/server/src/serve.ts:84` declares `readonly bundle?: string` — a **filesystem directory
  path**, not a URL. `static.ts` consumes it through `pathInside(bundle, relative)` and
  `realpathSync`, so it is a real path and not a specifier.
- `packages/cli/src/frame.source.test.ts:186` is
  `IO_MODULE = /from '(node:fs[^']*|node:child_process|node:os|node:url)'/`, asserted
  `toStrictEqual([])` over `production()` at `:603`. **`node:url` is refused**, so `fileURLToPath`
  is not available to any production module of that package.
- The only `node:url`-free conversion is `new URL(…).pathname`, and it is **measurably wrong**: it
  does not decode percent-encoding. An installation under a path containing a space yields a root
  spelled `…/My%20Project/…`, `realpathSync` refuses it, and `bundleRefusal` then reports
  `no built web app at …` — **AC-4's refusal firing on a machine where the build is present**, which
  is the worst available failure because it names the right condition for the wrong reason.

**The precedent is exact and one parameter wide, and it is the house answer to this exact
constraint.** `packages/core/src/backlog/scaffold.ts:73` is
`initProject(dir: string, templates: string | URL)`, and `packages/cli/src/init.ts:39` keeps
`new URL('../templates/harness/', import.meta.url)` **as a URL** and hands it across the boundary —
precisely because that package may not convert one. `fs.cpSync` accepts a URL natively.

**Ruled here rather than carried, because the measurement and the precedent are both in hand:**
`ServeOptions.bundle` becomes `string | URL`, converted at the one site in `packages/server` that
needs a path. The package that owns the confined root does the conversion, which is `initProject`'s
shape at a second site. **No decision entry is owed** — the widening is additive, precedented, and
contradicts no landed entry. The two alternatives are refused by measurement: exempting `open.ts`
from `IO_MODULE` edits the clause the successor's AC-14 requires stay unedited, and whose own
comment calls the `node:readline` split deliberate rather than incidental; and `.pathname` is wrong
as above. **Non-goal 3's clause excluding any change to `@quorum/server`'s surface is struck to this
extent and to no other** (§5).

### 0.2 NEW: clause D reads raw text, so the authority comment the rules ask for would trip it

`cli-version.test.ts`'s `namedAsWritten` is `filesWhere(sources, needles, (text) => text)` — the
**unfolded, un-blanked** view, where its sibling `namedIn` passes `scannable`. The needles are the
bare substrings `'import('` and `'require('`.

So a JSDoc in **any** production module of `packages/core/src` or `packages/cli/src` that writes the
literal `import(` while explaining why `open.ts` defers its specifier **fails clause D from a file
that is not registered**. That is a live trap rather than a hypothetical: `.claude/rules/engineering.md`
requires *one line naming the authority* wherever behaviour is deliberately counterintuitive, and a
dynamic import inside a handler is exactly that. The natural place to write it — `main.ts`'s dispatch
comment — is not `open.ts` and would not be covered by AC-8's register.

AC-8 now states it: the register is keyed by **file**, the authority line lives in the registered
file, and any sibling explaining the deferral names the mechanism without spelling `import(`.

### 0.3 NEW: `SELF_LOCATING` moves two assertions, not one

Iteration 1's AC-3 named only the both-directions demonstration. `frame.source.test.ts:566` also
carries a separate identity pin, `expect(Object.keys(SELF_LOCATING)).toStrictEqual(['init.ts'])`,
inside a test whose own comment reads *"Asserted here beside the rows that did move, so the two that
did not are a measurement rather than a silence."* Adding `open.ts` moves that literal too, and a
criterion naming one of the two is one an implementer satisfies while leaving the suite red.

### 0.4 The registry goes to ten, not nine

`packages/cli/src/commands.ts:40` is already **nine** names —
`['help','init','ticket','board','run','lint','adapters','validate','runs']` — because `help` is one
of them. Adding `open` makes `COMMANDS` **ten**, and `commandModules()`, which excludes `help`
because there is no `help.ts`, goes **eight to nine**. Claude's AC-1 (*"nine names"*) and AC-10
(*"the nine-command help"*) are each off by one. `commands.test.ts:130` asserts `[...COMMANDS]` and
`mentioned(HELP)` against **one** literal, so the help text and the registry move together or
neither does.

### 0.5 The new documentation guard may not live in `packages/shared`

Claude's AC-11 *Test:* clause put a derived command-table check in
`packages/shared/src/docs.test.ts`. Two things are wrong with it. No such guard exists — that file
reads `docs/README.md`, `docs/GLOSSARY.md`, `docs/04-architecture.md`, `harness/architecture.md`,
`docs/02-sdlc-pipeline-spec.md` and the flow files, and holds no command table. And deriving from
`COMMANDS` means `packages/shared` reading `packages/cli/src/commands.ts`: the dependency direction
`04-architecture.md` forbids, and **the exact refusal Q-0089 hit** — *"putting both trees' checks in
`packages/shared` made it read a `packages/core` source … the guard refused it as an undeclared
read."* The check belongs in `packages/cli` beside `commands.test.ts`, and earns a
`turbo-inputs.test.ts` registration for reading `README.md` and `docs/USAGE.md`, root-level literals
being visible to `pathLiterals` since Q-0108 corrected the no-separator rule.

### 0.6 A third architecture sentence goes false, which neither candidate lists

`docs/04-architecture.md:255`: *"Since Q-0099 it dispatches **eight** commands as well as its help …
so the frame now lists every command it dispatches and dispatches every command it lists."* Claude
names `:251` (the `quorum open` promise) and `:336` (*"consumed by nothing yet"*) and not this one.

### 0.7 Widening the daemon guard moves a fixture's expected bytes, and a count cannot see the key

`test-discovery.test.ts:337`'s `namesTheDaemon` is a **count** keyed on path:
`allowed = name === 'packages/server/package.json' ? 1 : 0`. An `optionalDependencies` edge and a
`dependencies` edge are **both one occurrence of the string** — so relaxing the count to 1 for
`packages/cli` would silently admit the required edge that kills the packed install. That is the
whole of AC-9.

And `:384–385` asserts the **exact message**,
`'packages/cli/package.json names @quorum/server 1 time, and may name it none'`, so the fixture's
expected bytes move with the predicate. The widening must keep that fixture **red** for a
`dependencies` edge while the real manifest passes with an optional one.

### 0.8 Codex's AC-3 and AC-4 collide

AC-3 requires the end-to-end test to bind `127.0.0.1:7717` and print *"that exact URL"*; AC-4
requires that no test depend on port 7717 being free. Those cannot both hold for one test. The merge
splits them: the **default** is asserted as a constant against `vite.config.ts`'s resolved value,
and the **end-to-end** runs on an operating-system-assigned port.

### 0.9 What held, re-verified

- `harness/roles/developer-generalist.md:3`'s `paths:` are
  `[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
  packages, apps, harness, docs, README.md, eslint.config.js, vitest.shared.js]`. **No path reaches
  the tracked root-level `pnpm-lock.yaml`** (`git ls-files pnpm-lock.yaml` returns it), while
  `harness/harness.yaml:34` is `install: pnpm install --frozen-lockfile`. §0.10 / GO-2.
- Clause D's failing half is the **dynamic-import** assertion, not the namespace one.
  `NAMESPACE_IMPORT` is `/import\s+\*\s+as\s+\w+\s+from\s+['"`]([^'"`]+)['"`]/g`, which
  `await import('@quorum/server')` does not satisfy. The half that fires is
  `namedAsWritten(sources, ['import(', 'require('])`, `toStrictEqual([])` with **no register and no
  exemption anywhere in the file** — so admitting one means creating that clause's first permitted
  entry. The ticket body and codex's AC-16 both name the wrong half, which is why **codex's AC-16 is
  unsatisfiable as worded**. The corpus is two roots, `packages/core/src` and `packages/cli/src`
  (`:39–42`), so it genuinely reaches a CLI module.
- `SIGNAL_HANDLER_OWNER = ['src/run.ts']` (`:837`), `toStrictEqual` at `:849`, with a
  both-directions demonstration at `:852–869` and a runtime listener count at `:871`.
- `FRAME_ONLY_IO = /from 'node:path'/` — *"the one module a command may import and the frame may
  not"* — so `open.ts` may use `node:path`, and may not use `node:url`.
- `packages/cli/src/package.test.ts`'s `Manifest` interface declares **no `optionalDependencies`
  field at all**; `:43` asserts `dependencies` strictly and `:51` `devDependencies` undefined. An
  optional block is invisible to the register that exists to describe this manifest's dependencies.
- `build.test.ts:2220`'s `workspaceDepsOf` reads `.dependencies` only, feeding `:2444` and the
  pnpm-rewrite loop — the only check that `workspace:*` still becomes a resolvable version.
  `DISTRIBUTION = ['cli','core','shared']` at `:2133`.
- `createDaemon({ project, port = 0, retain = DEFAULT_RETENTION, bundle })` at `serve.ts:209`;
  `BIND_HOSTNAME = '127.0.0.1'` at `:29`; `serve` refuses a bundle holding no `index.html`
  **before anything binds** (`:105–107`).
- `main.ts:26–36` statically imports every command module and `:115` dispatches
  `HANDLERS[cmd](parsed)`, so the module is loaded whatever command was typed: what must be deferred
  is the **specifier**, not the module.
- `apps/web/vite.config.ts:60` is `Number(process.env.QUORUM_DAEMON_PORT ?? 7717)`, and its header
  says *"`quorum open` is what will later have to agree with this value."*
- `04-architecture.md:51` principle 1: *"It spawns CLIs, reads/writes the project folder and git."*
  A browser is none of the three.

### 0.10 The launch blocker, restated because it is unchanged

An implement step that adds the AC-7 manifest edge writes a manifest it *may* write, cannot write
the lockfile that manifest now requires, and `integrate` refuses with `ERR_PNPM_OUTDATED_LOCKFILE`
before a test runs. That is *"A requirement may not name a surface its flow cannot write"*
(2026-08-25), which `docs/06-development-plan.md` records as *a loop handed work no agent in it can
perform* sixteen times. **GO-2 is the remedy.**

---

## 1. Problem

**`maintainer`.** After Q-0122 the daemon serves a built web app at `GET /*`, and after Q-0125 it
can be imported by name and emits. Neither is reachable: `packages/cli` declares no dependency on
`@quorum/server`, there is no `open` command, and the daemon has only ever run under its own test
suite. **The product has a UI nobody can open**, and the only way to see it is to write a script.

**`adopter`.** `README.md`'s command table lists eight commands and none of them shows the UI the
project describes itself as. M3's own done-when — *"`quorum open` starts daemon + browser"* — has no
ticket behind it, and `04-architecture.md:251` has promised the command since 2026-08-22.

**`contributor`.** `apps/web/vite.config.ts:60` runs the app against a daemon on port 7717 by
convention, and its own header records that nothing has yet agreed to that number. This is that
later.

---

## 2. User stories

- As a **`maintainer`**, I run `quorum open` in my repository and get a URL I can open, so that the
  backlog board and mission control are reachable without me writing a process.
- As a **`maintainer`**, I press Ctrl-C and the daemon releases every live run through the same
  abandonment path a shutdown uses, so that stopping the UI never leaves a ticket locked.
- As an **`adopter`**, if the web app has not been built, I am told which directory was expected to
  hold it and what to run — **before anything binds** — rather than being handed a port that answers
  404.
- As an **`adopter`** on a packed install, `quorum help` and every other command keep working, and
  `quorum open` tells me truthfully what did not resolve *here* rather than claiming the daemon is
  missing everywhere.

---

## 3. The recommended cut, and why it is at the browser

**Recommendation: cut this ticket in two, at the browser spawn. OQ-2 is blocking and the ruling is
the gate's.**

The ticket body calls the spawn ban *"the constraint that shapes it, and it is not the obvious one"*.
Measured, it is the constraint that **separates cleanly from everything else here**, which is the
opposite of shaping:

| | needs a spawn | needs a new `core` symbol | needs the manifest edge | delivers |
| --- | --- | --- | --- | --- |
| the daemon half | no | no | yes | the UI is reachable |
| the browser half | yes | yes | no | the UI opens by itself |

A child that starts the daemon, serves the bundle and prints the URL touches `packages/cli`, one
manifest and one parameter of `ServeOptions`. It needs no `node:child_process`, no per-platform
launcher table, no new `core` folder, no new barrel name, and no ruling against principle 1.

**The two halves are also different flow shapes**, which is the argument the size table does not
make. The daemon half is registers, a manifest and one thin command module — chore-shaped, like
Q-0121, Q-0122 and Q-0125. The browser half is a closed-set result union, a per-platform table and a
contract a stub can be written against, which is what `solutioning` and `qa-red` are for; Q-0120's
entry records that solutioning *"paid for itself"* on exactly that shape.

**Splitting at the primitive instead is refused**, on a rule rather than taste:
`packages/core/src/index.ts`'s own header says a name is added to the barrel *"because a command
needs it rather than because its module exports it"* — Q-0092 withheld `manifestShapeError` and
Q-0093 withheld `currentBranch` on exactly that clause. A child landing a browser primitive with no
command to use it violates the rule it would have to edit.

**Criteria are numbered continuously across the children** (Q-0103's practice), so a criterion keeps
its name if the gate moves the cut. **AC-1 to AC-11 are this ticket. AC-12 to AC-16 are the
successor, whose body is Appendix A, written out in full** so the obligation cannot expire here —
the failure `docs/06-development-plan.md` records for Q-0100's, Q-0110's, Q-0111's and Q-0112's
obligations.

If the gate refuses the split, this is one ticket of **sixteen**, against a role ceiling of fifteen,
the eighteen that refused Q-0013 and the twenty-one that split Q-0091 and Q-0096. Q-0122 was
accepted at twenty and spent three implement rounds. **Name the seam in the erratum if the split is
refused**, so the remedy on exhaustion is a second erratum promoting Appendix A out rather than a
fourth round (Q-0122 E-1's shape).

---

## 4. Acceptance criteria — this ticket (AC-1 to AC-11)

Each is independently testable. A *Test:* clause **bounds the instrument**: a reviewer may find the
instrument fails the job the clause gives it, and may not raise the job — *"An adapter records the
version it was verified against"* (2026-09-08) erratum E-1, fifth instance.

### AC-1 — `open` is a registered command, and the registry goes from nine names to ten

`COMMANDS` gains `'open'` **appended last, after `runs`**. Appending is the only position that
changes no existing relative order: `commands.ts`'s header records that every insertion since Q-0090
preserved `spike/bin/harness.js`'s header order, and that header has no `open` line to insert
against. `HELP` gains one line in the same position and the existing two-column shape, because
`commands.test.ts:130` asserts `mentioned(HELP)` and `[...COMMANDS]` against **one** literal.
`packages/cli/src/index.ts` re-exports `./open.js`.

The counts are **ten** for `COMMANDS` and **nine** for `commandModules()` (§0.4).

*Test:* `commands.test.ts:130`'s registry literal moves to ten names, with a superseded-value
assertion beside the existing ones in the shape that file already uses —
`not.toStrictEqual([… the nine …])`, so a register that quietly shrinks back fails naming the ticket
it shrank past. `frame.source.test.ts`'s partition and derived-barrel clauses pass **with no change
to their derivation**, both being computed from `COMMANDS`; the partition's expected list gains
`open.ts` and one more superseded-value line.

### AC-2 — the command opens a project, starts the daemon, prints one URL, and does not return while it serves

`quorum open` resolves the project through **`@quorum/core`'s `loadProject`**, honouring
`flags.project`, with `ProjectNotFoundError` rendered by `packages/cli/src/fail.ts`'s existing
`dieNoProject`, so the sentence a stranger sees is the single one Q-0111 made single. It starts the
daemon through `createDaemon` — not `serve`, which takes a host and would make this command the
second place choosing a retention capacity — prints **one** line carrying the URL including the bind
address, and awaits a stop.

**It does not use `@quorum/server`'s `openProject`**, and that is measured rather than stylistic:
that symbol lives in the package that may not be installed, so routing project resolution through it
would make *no project here* unreportable on exactly the installation where the daemon is absent.

It accepts no positional argument. The bind address is `BIND_HOSTNAME` and **no flag may move it**:
the command declares no `--host` and names none in its help.

*Test:* the command is driven in process against an operating-system-assigned port with a temporary
project and a temporary bundle; `GET /` over that port answers the bundle's `index.html` and
`GET /project` answers JSON. The printed line is asserted to contain `127.0.0.1` and the bound port.
The package's own text is asserted to contain no `--host` and no second hostname literal.

### AC-3 — the bundle root is a `URL` resolved relative to the module, handed across the boundary unconverted, and `SELF_LOCATING`'s two assertions both move

**This criterion is rewritten from iteration 1 on §0.1, which measured its previous form
unimplementable.**

`open.ts` computes `new URL('../../../apps/web/dist/', import.meta.url)` — relative to the running
module and to nothing else. Not `process.cwd()`, which answers the operator's directory, and not an
environment variable, which answers whatever was exported; `static.ts`'s header rules both out for
the daemon and the same argument reaches the caller.

**It hands that `URL` across the package boundary without converting it**, because
`frame.source.test.ts:186`'s `IO_MODULE` refuses `node:url` in every production module of this
package and `new URL(…).pathname` does not decode percent-encoding. `ServeOptions.bundle` therefore
widens to **`string | URL`**, and `packages/server` converts at the one site that needs a path. That
is `initProject(dir: string, templates: string | URL)`'s shape at a second site, which is the
precedent `init.ts:39` already follows for this exact reason. **No decision entry is owed**: the
widening is additive, precedented, and contradicts no landed entry.

`SELF_LOCATING` gains `'open.ts'` with a one-sentence reason naming this criterion, against that
register's own prose refusing a second command module by default.

*Test:* **both** `SELF_LOCATING` assertions move and are shown red in both directions —
`locationOffenders(…)` at `frame.source.test.ts:568`, and the identity pin
`expect(Object.keys(SELF_LOCATING)).toStrictEqual(['init.ts'])` at `:566` (§0.3): an entry
permitting a self-location its module does not perform fails, and a self-location with no entry
fails. `IO_MODULE`'s clause at `:603` is asserted **unchanged and still empty**, which is what proves
the widening was taken instead of an exemption. The round trip is asserted over a root whose path
contains a **space**, so the percent-encoding defect §0.1 measured is a red test rather than a
paragraph. And the resolved location is asserted **identical computed from `src/` and from `dist/`**,
so the depth uniformity 078(e) gives `init` is measured here rather than assumed.

### AC-4 — a directory holding no build refuses before anything binds, and the CLI composes the remedy

`serve` already throws on a bundle root holding no `index.html`, before anything binds. The command
catches that one condition and renders it as the frame's single red sentence and exit 1: the
**condition** is the library's — `bundleRefusal` composes it and carries no shell imperative, per
*"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) — and any
imperative a shell user reads is composed in `packages/cli`. Nothing binds and no port is printed.

**Ordering is ruled: the daemon-absent refusal of AC-10 comes first.** In a packed install `open.js`
sits at `node_modules/@quorum/cli/dist/`, so AC-3's self-location resolves somewhere with no meaning
there; checking the bundle first would report *no build at `node_modules/apps/web/dist`* — a nonsense
path — instead of the true thing, which is that this installation does not carry the daemon. Cheap
to reverse if the gate disagrees.

*Test:* the command runs against a directory that exists and holds no `index.html`; the process
exits 1, the output names the directory and the missing entry, and **no socket was opened** —
asserted by attempting a connection to the port that would have been used, rather than by reading
the message.

### AC-5 — the port has exactly one declared default, the dev server and the command agree on it, and a port in use refuses rather than drifting

The default is **7717**, declared in **one** place both readers can reach and read by
`apps/web/vite.config.ts` and by `open.ts`. `--port <n>` overrides it; the daemon itself keeps no
default and goes on binding what it is given.

A port already in use **refuses, naming the port**, and never silently selects another. The run-lock
precedent is the argument — *"a second run refuses and names the holder; it never waits"* — and here
the cost of drifting is concrete, because the dev proxy and any bookmarked URL both assume the
default. `--port` is what makes that refusal a message rather than a dead end, which is why the flag
is in scope against codex's non-goal.

*Test:* one assertion reads the declared constant and the value `vite.config.ts` resolves and
requires them equal, shown red by changing one. A second listener is opened on an
operating-system-assigned port and the command is asked for that port; the process exits non-zero
with the port in the message, and the message names no different port. **No test requires 7717 to be
free** (§0.8).

### AC-6 — the daemon's lifetime is the command's, `close()` runs on a signal, and `SIGNAL_HANDLER_OWNER` gains one entry demonstrated both ways

`SIGINT` and `SIGTERM` close the daemon through `createDaemon`'s `close()`, which releases every
live run through the host's abandonment path and only then stops the socket — that order being the
one `serve.ts` states and Q-0013's shutdown exists to preserve. Handlers are installed when the
command starts serving and removed in a `finally`, **never at module scope**, on `run.ts:168–200`'s
precedent. A repeated signal does not accumulate listeners (codex AC-13). Shutdown failure is
reported and exits non-zero rather than being swallowed.

`SIGNAL_HANDLER_OWNER` becomes two entries, each carrying why.

*Test:* `frame.source.test.ts:849`'s clause is asserted over the two-entry register and `:852`'s
both-directions demonstration is extended — a third owner fails, and a register naming two owners is
not satisfied by a tree with one. `:871`'s runtime listener count is **unchanged and must stay
green**, which is what proves the registration is not at module scope. The close path is asserted by
starting the command in process, delivering the signal, and requiring that the host reports no
running run and the socket refuses a connection afterwards. Repeated signals are asserted not to
grow `process.listenerCount`.

### AC-7 — the manifest declares the daemon as an optional dependency, and the three silent registers stop being silent

`packages/cli/package.json` gains `"optionalDependencies": { "@quorum/server": "workspace:*" }` —
**not** `dependencies`, which the ticket body's row 1 measures as killing the packed install
outright with `ECONNREFUSED` before any module loads.

Three registers that currently say nothing about a third dependency key are made to say something
(§0.9):

- `packages/cli/src/package.test.ts` asserts the **whole dependency shape** — its `Manifest`
  interface gains the field, `dependencies` stays strictly the two workspace names,
  `devDependencies` stays undefined, and `optionalDependencies` is strictly the one name, with a
  sentence saying why it is optional rather than required.
- `build.test.ts:2220`'s `workspaceDepsOf` reads optional edges too, so `:2444`'s register and the
  pnpm-rewrites-`workspace:*` loop under it cover the new edge. The register is **re-derived, not
  adjusted**.
- The packed `@quorum/cli` manifest is asserted to carry the rewritten `0.0.0` for the optional
  edge, which is the fact AC-10's install rests on.

*Test:* each of the three is shown red against the manifest as it stands today and green after, and
the `workspaceDepsOf` widening is shown to **change** the derivation rather than leave it identical
— a widening that changes nothing has not been established.

### AC-8 — the import is dynamic and inside the handler, clause D admits it by identity while still firing on everything else, and the authority line does not trip the guard

`open.ts` reaches `@quorum/server` through `await import('@quorum/server')` **inside the command
handler**. `main.ts:26–36` statically imports every command module and `index.ts` `export *`s every
one, so the module is loaded whatever command was typed; what must be deferred is the **specifier**,
not the module.

`cli-version.test.ts` clause D's **dynamic-import assertion** — the second one, §0.9 — gains its
**first** permitted entry: a register of `file → reason` on the `STATE_SITES`/`SELF_LOCATING` shape
already used twice in that file, never a relaxed predicate. The **namespace half is asserted
unchanged and still empty**, which keeps §0.9's correction durable.

**The register is keyed by file, and that clause reads raw text** (§0.2): `namedAsWritten` passes
`(text) => text`, not `scannable`, so comments count. The one-line authority comment
`.claude/rules/engineering.md` requires lives **in `open.ts`**, the registered file; any sibling
explaining the deferral — `main.ts`'s dispatch block is the natural one — names the mechanism
without spelling the literal `import(`.

*Test:* the clause is shown to still fire — a second, unregistered dynamic import planted in a copy
of the corpus is reported by name — and the register fires the other way: an entry permitting a
dynamic import its module does not perform fails. A third assertion plants the literal `import(`
**in a comment** of an unregistered production file and requires it reported, so §0.2's trap is a
red test rather than a paragraph. Separately, and per the ticket body's own methodological note, the
**emitted** `dist/open.js` is asserted to carry no static resolution of `@quorum/server`, because
`import type` is erased and the claim is about what Node loads rather than about what the source
says.

### AC-9 — `test-discovery.test.ts` AC-13 is widened by key rather than by count, and its fixture moves with it

`namesTheDaemon` becomes: one occurrence in the daemon's own manifest as its `name`, and one in
`packages/cli/package.json` **under `optionalDependencies`** — the key checked, not merely the
count, because §0.7 measures that a count cannot tell the permitted edge from a required one, both
being one occurrence of the same string.

*Test:* the hostile fixture at `:383` is kept and **still fails** — a `dependencies` edge from
`packages/cli` is reported by name, with its expected message updated to whatever the new predicate
says (§0.7) — and a second fixture is added for the permitted optional edge. Real manifests and
fixtures go through the **same predicate**, which is the shape Q-0125 iteration 2 adopted after
reporting the opposite as a nit and which that file's own comment at `:376` already demands. The
self-dependency clauses at `:391–394` are asserted unchanged.

### AC-10 — the packed path keeps every command it had, and `quorum open` there says something true

Q-0098's fixture — *"the packed set installs outside the workspace with the registry dead, and
runs"* — stays green with **no change to `DISTRIBUTION`**, and `quorum help` works in the packed
project.

`quorum open` there **refuses with a sentence that distinguishes what it observed from what it
cannot establish**. It may say that `@quorum/server` did not resolve from this installation and name
the workspace path that carries the daemon. It may **not** say the daemon is missing, broken or not
installed, and it may not present a failed load as proof of absence. *"A probe that could not answer
is not a negative"* (2026-09-10) and the class Q-0074 and Q-0115 spent two tickets removing are the
authority; the ticket body states the reason in as many words, that an install which genuinely
half-failed and one working exactly as designed reach the same code path. **This closes codex's OQ-2
without needing build metadata**: the sentence reports what failed to resolve *here* and claims
nothing about why, which is the honest form of an answer a probe cannot give.

*Test:* the packed fixture executes `quorum help` (exit 0, the ten-entry help) and `quorum open`
(non-zero, the sentence above) **through the installed shim**, so the subject is the emitted binary
rather than a source module. The sentence is asserted by its bytes against the literal the CLI
declares, so the two cannot drift. Separately the workspace path is exercised through
`node packages/cli/dist/quorum.js open`, which is what proves the emit **loads** the daemon rather
than merely naming it — the ticket body's first probe passed while proving nothing, because `tsc`
elided an unused import.

### AC-11 — every document that promises this command is corrected, and the derived check lives where the dependency direction allows

- `04-architecture.md:251` — `quorum open` stops being one of three future commands and becomes
  shipped, with what it does and what it does not.
- `04-architecture.md:255` — *"Since Q-0099 it dispatches **eight** commands as well as its help"*
  becomes nine (§0.6).
- `04-architecture.md:336` — *"`@quorum/server`'s is consumed by nothing yet: it exists so that
  Q-0126's `quorum open` resolves to a file"* is now false in its first clause and true in its
  second; it moves to what happened, and the `packages/cli` section gains the sentence that this
  package now has a **conditional** consumer and why the edge is optional. The same section records
  that `ServeOptions.bundle` takes a `URL`, with AC-3's reason.
- `06-development-plan.md` — this ticket's bullet, and M3's done-when line, which is **half**
  satisfied: the daemon half by this cut, *"CLI and UI can both answer the same gate"* by nothing
  here.
- `README.md`'s command table and `docs/USAGE.md`'s `## Commands` section each gain one entry, and
  **each states that the packed path does not carry the daemon**, because README's install section
  claims both paths work and a table listing a ninth command silently fails one of them
  (`harness/product-context.md` quality pillar 7).

*Test:* a guard in **`packages/cli`** — not `packages/shared` (§0.5) — holds the README and USAGE
command lists against `COMMANDS`, derived so that an eleventh command fails until it is documented,
and earns its `turbo-inputs.test.ts` registration for the two new read sites. Shown red by removing
one entry, and shown to discriminate by adding an undocumented name rather than only by deleting a
documented one.

---

## 5. Non-goals

1. **The browser.** AC-12 to AC-16, Appendix A — under the recommended cut.
2. **The other half of M3's done-when**, *"CLI and UI can both answer the same gate"*. This ticket
   makes the UI reachable; the gate screen is Q-0016's, and nothing here widens
   `gateAnswerEnvelopeSchema`, whose three answers are closed by *"What a run's event stream
   carries"* (2026-08-28).
3. **The distribution ruling.** Whether `@quorum/server` or `@quorum/web` is ever packed is
   **Q-0124's**, deliberately left open by *"A fifth package emits, and `resolved` is not a synonym
   for `distributed`"* (2026-09-12). Nothing here changes `DISTRIBUTION`, `files`, `private` or
   `bin` on any package. **`ServeOptions.bundle` widening to `string | URL` is the one exception,
   ruled in §0.1 and scoped to that parameter**; no other part of Q-0125's export surface moves.
4. **Any screen.** `apps/web` fetches nothing today, so what this command makes reachable is the
   shell and its placeholders. Saying so is the point; filling them is Q-0015 to Q-0018.
5. **Building the bundle.** `quorum open` runs no build, invokes no turbo and shells out to no
   package manager. A missing bundle refuses with a remedy (AC-4).
6. **`--bundle <dir>`.** One way to find the bundle, for the reason `SELF_LOCATING` gives. An
   operator with a bundle elsewhere is Q-0124's case. (OQ-7.)
7. **`--host` and any non-loopback bind.** Refused by `BIND_HOSTNAME`'s own ruling, restated so
   nobody adds it as a convenience.
8. **A detached or background daemon**, reusing or discovering an already-running one, and
   terminating whatever holds the port.
9. **Persisting a port, a browser preference or any daemon registry** — files are the database, and
   this command adds no file.
10. **Authentication, multi-user, a remote daemon, cloud sync, TLS, telemetry, desktop shell** — v1
    exclusions.
11. **Resumable runs after a daemon restart** — Q-0019.
12. **`quorum compile` and `quorum history`**, the two other commands `04-architecture.md:251`
    promises beside this one.
13. **Registry-resolved `npx quorum`** — Q-0029, in M6, refused while every package is `private`.

---

## 6. Open questions

**OQ-1 (BLOCKING) — the packaging shape, and the entry it owes.** Four answers; the ticket body's
own measurement rules out two:

- Row 1, `dependencies` + static import: the **packed install dies**, `ECONNREFUSED`, before any
  module loads. Refused by measurement.
- Row 2, `optionalDependencies` + static import: `quorum help` dies with `ERR_MODULE_NOT_FOUND`.
  Refused by measurement.
- Row 3, `optionalDependencies` + dynamic import: both paths keep working, and `quorum open` works
  on **one** of the two installation paths this repository claims.
- Row 4, hold for Q-0124: rule the distribution set first, ship on both paths, owe no clause-D
  admission and no optional-dependency silence.

**Recommendation: row 3.** The ticket is p1 and owns a milestone done-when line; the change is
additive; the honesty cost is closable by a criterion (AC-10) rather than structural; and row 3 does
not foreclose row 4 — when Q-0124 rules, the edge becomes required, the import may become static,
and the clause-D entry is deleted rather than amended. What the gate is choosing is whether a p1
milestone line waits on a p2 `draft` ticket.

**It is blocking because of GO-1, not because the recommendation is weak.** Row 3 owes a decision
entry, and `developer-generalist` may not write one — so an implement step meeting AC-7 returns
`blocked` on round one, which is Q-0062's three wasted rounds exactly.

**OQ-2 (BLOCKING) — the split.** §3. Recommendation: split at the browser, eleven criteria here and
five in Appendix A. Unsplit this is sixteen against a ceiling of fifteen, and the two halves want
different flows.

**OQ-3 (BLOCKING before launch, not before code) — the lockfile.** §0.10. This is GO-2 and it is a
launch condition rather than a design question: without it `integrate` refuses before a test runs.

**OQ-4 — a port already in use.** Refuse naming the port (recommended, run-lock precedent), or bind
0 and print whatever was given. Drifting breaks the dev proxy's assumption and any bookmark;
`--port` is the escape hatch for two projects at once.

**OQ-5 — the exit code on a signal.** `exit.ts`'s table is closed at five and `run.ts` exits 130 on
an interrupted run. But Ctrl-C is the **documented way to stop `quorum open`**, so 130 reports an
interruption for the normal termination of a command whose whole job is to keep running.
Recommendation: **130**, on the convention every other tool follows and on the ground that
re-interpreting a closed table is not a decision to take in passing. The one question here where the
answer is genuinely close.

**OQ-6 — where the port default is declared.** `@quorum/shared` (recommended: declarations-only, and
`vite.config.ts` already imports from it by source path for a measured reason), or declared in
`open.ts` with a test holding `vite.config.ts`'s literal against it. The shared home slightly
promotes 7717 from *"a dev-server convention, not a contract"* to a shipped default — which is what
it is becoming either way, and the promotion should be stated rather than absorbed.

**OQ-7 — `--bundle <dir>`.** Recommendation: no, per non-goal 6. Raised because it is the obvious
mitigation for AC-10's refusal and should be declined on the record rather than forgotten.

**OQ-8 — does `quorum open` report the runs the daemon can already back?** Q-0121 landed
`GET /runs`. Recommendation: no — one URL and a stop instruction. A second line is a screen's job.

**Closed rather than carried.** Codex's OQ-2, on what evidence distinguishes an intentional omission
from a broken install: AC-10 answers it without build metadata. **And the bundle-root question
(§0.1)**, which iteration 2 opened and ruled in the same pass: `ServeOptions.bundle` widens to
`string | URL` on `initProject`'s precedent, no entry owed, non-goal 3 struck to that extent. It is
not carried as a blocker because the measurement and the precedent are both in hand, and a head of
product who blocks on what they can rule makes the three real blockers cheaper to ignore.

---

## 7. Gate obligations

**GO-1 (blocking, before a line of code) — a decision entry is owed on OQ-1.** Three reasons, any
one sufficient:

1. `optionalDependencies` is a **third dependency kind** in a workspace that has used two, and it
   makes a *silent skip* the normal case on a claimed installation path. This repository refuses
   that shape elsewhere by name.
2. `harness/product-context.md` quality pillar 7 states that two installation paths are claimed and
   both work. After this ticket one of them has a command that does not. A claim is moving, and
   `.claude/rules/docs-and-decisions.md` says an entry is what moves one.
3. Decisions 092 and 093 routed *how an installation outside the workspace obtains the UI or the
   daemon* to Q-0124 **explicitly**. Declaring the first consumer answers part of a question a
   landed entry deferred, which is not something to do silently.

The entry states what an optional edge claims, what it refuses, and that it is provisional against
Q-0124 — so that ticket reads a ruling rather than an accident. **Verify it appears in the implement
step's actual prompt** rather than assuming it, which is the check Q-0097 lost two errata by not
making.

**GO-2 (blocking, before the run is launched) — the lockfile.** §0.10. The manifest edge and its
`pnpm-lock.yaml` update are landed **by the human, on `harness/Q-0126/integration`** — the branch
`chore.yaml` cuts the implement worktree from — before the chore run starts, together with AC-9's
widening of `test-discovery.test.ts` so that branch is green. **Not on `main`**, where Q-0125's
AC-13 would be red until the merge: Q-0067 GO-2's precedent, the first time this repository had to
sequence a change against its own guard.

The alternative — granting `pnpm-lock.yaml` to `developer-generalist` — is a harness edit with
effects on every future chore ticket, and should not be taken as a side effect of this one.

**GO-3 — OQ-2, the split.** If refused, an erratum naming the seam in advance and saying that the
remedy on exhaustion is a second erratum rather than a fourth round (Q-0122 E-1's shape).

**GO-4 — where the browser primitive lives** (the successor's, but the argument belongs to a gate).
`04-architecture.md:51`'s principle 1 enumerates `core`'s I/O as *"spawns CLIs, reads/writes the
project folder and git"*. A browser is none of the three, and `packages/core/src` is one folder per
port child (Q-0064), so a ninth folder is a visible act. Settle whether principle 1 widens or
whether the primitive sits in an existing folder, before the successor runs.

**GO-5 — no glossary term is coined and none is owed.** *Daemon* is used throughout
`04-architecture.md` and appears in **Connection state**'s own text; this ticket introduces no new
noun. Recorded so it is not re-litigated at the implement step. If the gate disagrees, the term
lands **on the integration branch** and not on `main`, for GO-2's reason and Q-0108's check.

**GO-6 — verification.** Forced in both environment rows (a worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge), `quorum lint`, the
git-identity sweep, and — because **nine registers move** — each widened register shown red **in
both directions** rather than observed green. Q-0107's rule applies throughout: *a guard shown red
by its neighbour has not been established.*

---

## 8. Risks

**R-1 — the command works on one of the two paths this repository claims.** Stated rather than
mitigated: under row 3 a packed install refuses `quorum open`. Not a regression, there being no
`open` today, and the end state stays Q-0124's. AC-10 and AC-11 keep it honest rather than hidden.

**R-2 — nine registers move, and a widened register is the shape this repository keeps getting
wrong.** Every widening in AC-3 and AC-7 to AC-9 names the clause it isolates.

**R-3 — the daemon has no authentication, and this command makes starting it a single word.** The
loopback bind is the whole of the defence. The risk is a later convenience flag eroding it;
non-goal 7 and AC-2's assertion that the package names no second hostname are the tripwires.

**R-4 — two ways to serve the same app.** A contributor running `vite dev` on 7717 and a
`quorum open` daemon on 7717 collide, and the two serve *different builds*. AC-5's refusal turns
that into a message instead of a mystery.

**R-5 — what the command reveals is a shell.** `apps/web` fetches nothing, so a maintainer who runs
this sees a rail, a theme and placeholders naming the tickets that will fill them. AC-11's
documentation should say what the UI does today, not what it will do.

**R-6 — a filtered build leaves no bundle.** `pnpm turbo run build` builds every emitter, but
`--filter=@quorum/cli` does not build `apps/web`, no manifest edge ordering them. AC-4's refusal
names the directory, which is the right failure; worth one sentence in USAGE.

**R-7 — `optionalDependencies` and `--frozen-lockfile` interact beyond GO-2.** A future
`pnpm install` in an environment configured to omit optional dependencies leaves a workspace where
`quorum open` refuses while everything else works. Acceptable, and worth naming in GO-1's entry.

**R-8 — foreground lifecycle occupies the terminal.** Background daemon management is deliberately
out of scope, but adopters may expect the command to return. One sentence in USAGE.

**R-9 — the `URL` widening touches a surface that shipped yesterday.** `ServeOptions` is
`@quorum/server`'s public interface and Q-0125 landed it on 2026-09-12. The widening is additive and
precedented, and the risk is that a reviewer reads non-goal 3 rather than its exception and blocks
correctly on a ruling this document already took. AC-3's own text names the exception, which is what
makes that a nit rather than a round.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no credential, key or token. `frame.source.test.ts`'s `CREDENTIAL` scan covers `open.ts` automatically, being over every file the package carries. No fixture, help text or document introduced here accepts an API key. |
| **Worktree safety** | The command writes nothing to the user's working tree and creates no worktree, branch or run. It reads the project and a bundle directory and serves. Any flow later started through the daemon stays subject to `core`'s existing enforcement. |
| **Gate behaviour** | Unchanged. The command starts no run, takes no **run lock** and answers no gate; the daemon's gate route is untouched and the three answers stay three. |
| **File format and schema** | No new persisted file, no new schema, no port file, no preference. The port constant, if it lands in `@quorum/shared` (OQ-6), is a declaration and adds no runtime behaviour there. |
| **Lint rules** | None added. `@typescript-eslint/no-deprecated` covers the new module as it covers every `packages/**/*.ts`. |
| **Cold-clone impact** | One README row, one USAGE section. No install-time cost in the workspace; the optional edge adds one workspace link and no download. The packed caveat is AC-11's to state. |
| **Product boundaries** | The command is `quorum open`; nothing calls the product a harness and nothing renames the `harness/` folder. |
| **Flow route** | `requirements` → `chore`, for this half. Nothing here changes a flow or an engine module a run loads at start, so the run can benefit from its own change — unlike Q-0083, Q-0086 to Q-0089 and Q-0117. **GO-1 and GO-2 are the two things that must happen outside it.** The successor is pipeline-shaped (§3). |

---

## 10. Provenance

**Base document: claude.** Eleven criteria against codex's twenty-nine, a measured split at the
browser spawn, and the register inventory — `SELF_LOCATING`, `SIGNAL_HANDLER_OWNER`, and the three
*silent* registers (`package.test.ts`'s missing field, `workspaceDepsOf`'s `dependencies`-only read,
`apps/web`'s justification derivation) — which codex does not have at all. Its §0.1 correction of
the ticket body is right and is the single most useful thing either candidate produced: the body and
codex's AC-16 both name the wrong half of clause D, and the remedy differs between them. Its
lockfile finding is the launch blocker. AC-1, AC-2, AC-4 to AC-7, AC-9 and the gate obligations are
substantially its work.

**Taken from codex**, four things claude missed:

- **The Windows launch contract** (its OQ-4): `start` is normally a `cmd.exe` builtin rather than an
  executable, so a no-shell requirement does not fall out of using an argument-based API. Claude's
  appendix asserts a per-platform table without noticing that one row cannot be written the way the
  other two are. Moved into Appendix A as AC-12's blocking question.
- **The typed closed-set launcher contract** (its AC-15) — *launched, unsupported platform,
  executable unavailable, launch failed*, no `any`, no shell for macOS or Linux, unit tests proving
  the selected executable and argument list per platform. Stronger than claude's AC-12.
- **The bounded signal-listener clause** (its AC-13), folded into AC-6.
- **The sharpest statement of the honest-refusal problem** (its AC-18 and OQ-2), which AC-10's
  wording is built from — though it is **ruled here rather than carried as a blocker**, because it
  changes one sentence rather than the design.

**Refused from codex.** Twenty-nine criteria is roughly double the ceiling and the document does not
notice: 25 to 29 restate standing repository rules (BYOS, worktree safety, files are the database,
gate behaviour, product scope) as acceptance criteria, which is what the cross-cutting checklist is
for, and 21 to 23 are a verification plan rather than criteria. Its AC-16 is unsatisfiable as worded
(§0.9). Its AC-3 and AC-4 collide (§0.8). Its non-goal refusing a port flag leaves AC-5's
occupied-port refusal with no escape hatch.

**Corrections to both, made against the tree.** §0.4, the registry is nine names and goes to ten,
not nine — claude's AC-1 and AC-10 are off by one. §0.5, claude's AC-11 puts a new derived guard in
`packages/shared`, which would make that package read `packages/cli/src/commands.ts`: the dependency
direction `04-architecture.md` forbids, and the exact refusal Q-0089 hit. §0.6, a third architecture
sentence goes false that neither candidate lists. §0.7, the daemon guard's hostile fixture asserts an
exact message that moves with the predicate, and a count cannot see the key at all. `createDaemon`
rather than `serve` is the right entry, being *"the one place that chooses a retention capacity"*.

**New in iteration 2, in neither candidate and not in iteration 1.** §0.1, the bundle root:
iteration 1's AC-3 is unimplementable, because `ServeOptions.bundle` is a `string` while
`IO_MODULE` refuses `node:url` and `.pathname` does not decode percent-encoding — ruled onto
`initProject`'s `string | URL` precedent, with a space-in-the-path round trip as the red test. §0.2,
clause D reads **raw** text, so the authority comment the engineering rules require would itself trip
the guard from an unregistered file. §0.3, `SELF_LOCATING` moves two assertions rather than one.

**New in iteration 1 and carried.** AC-2's ruling that project resolution goes through
`@quorum/core`'s `loadProject` and never `@quorum/server`'s `openProject`, that symbol living in the
package that may not be installed. AC-4's ordering ruling. AC-8's clause that the **emit** is what
must be asserted, since `import type` is erased. And §3's observation that the two halves are
different *flow* shapes, which is an argument for the split the size table does not make.

---

## Appendix A — the successor, written out in full

*Transcribed rather than referenced, because an obligation recorded only inside a closed ticket's
prose is one that quietly expires — the failure `docs/06-development-plan.md` records for Q-0100's,
Q-0110's, Q-0111's and Q-0112's obligations. If the gate refuses the split these become AC-12 to
AC-16 of this ticket and this appendix is promoted by erratum; if it accepts, this is the
successor's body.*

### Q-01xx — `quorum open` opens a browser

**Depends on Q-0126**, strictly: there is no URL to open until the daemon starts.

**The gap.** Q-0126 prints a URL a human pastes. M3's done-when says *"starts daemon + browser"*.

**The constraint.** `packages/cli/src/frame.source.test.ts:186`'s `IO_MODULE` refuses
`node:child_process` in **every** production module of that package, asserted `toStrictEqual([])` at
`:603`, with the stated reasoning that *"every read and every spawn goes through `@quorum/core`"*.
Opening a browser is a spawn, so the launcher cannot live in `packages/cli` at all. Q-0093's
precedent is exact: `init`'s scaffolding became `core/backlog/scaffold.ts` for this rule and the
command kept one expression. `core` already spawns at `adapters/exec.ts` and `fanout/fanout.ts`, so
there is a house style.

**What it must decide first (GO-4 above).** `04-architecture.md:51`'s principle 1 enumerates
`core`'s I/O as *"spawns CLIs, reads/writes the project folder and git"*. A browser launcher is none
of those. Either principle 1 widens — a decision entry — or the primitive sits in an existing folder
and the argument for which one is written down.

**AC-12** — `core` gains exactly one exported primitive that opens a URL in the platform's default
browser, and it is the only place in the workspace that spawns for that purpose. The per-platform
command is a **table**, not a chain of conditionals, and the URL is passed as one literal argument
through an argument-based process API — **never composed into a shell string**. *Test:* the table is
asserted per platform over an injected spawner, and a whole-workspace scan finds no second site
launching a browser.

> **Blocking question, from codex's OQ-4: Windows.** `start` is normally a `cmd.exe` builtin rather
> than an executable, so *"use an argument-based API"* does not by itself give a safe Windows row.
> The ticket must either specify a proven `cmd.exe` argument contract, choose a small justified
> dependency, or **refuse Windows explicitly** — in which case AC-12's table says so and the
> platform is an `unsupported` state rather than a silently claimed one. It must not be treated as
> supported by default. This repository has never claimed Windows support (Q-0098 registered the
> POSIX-only build and named that ticket as owed only if it ever does), which argues for the
> explicit refusal.

**AC-13** — the result is drawn from a **closed set** — at least *launched*, *unsupported platform*,
*executable unavailable*, *launch failed* — typed, with no `any`, and a launcher that failed is never
rendered as an answer it did not give. The primitive cannot observe whether a browser opened: it
knows what it spawned and what that process exited with. So *launched* may not mean *a browser is
showing this page*, and a non-zero exit may not be reported as *there is no browser*. Containment's,
push lag's and verified version's discipline at a fourth subject, and *"A probe that could not answer
is not a negative"* (2026-09-10) at the site Q-0074 and Q-0115 spent two tickets removing instances
of. *Test:* each state is produced over an injected spawner and asserted by name; a spawner that
throws produces the *could not tell* member and never the negative one. No test opens a real browser.

**AC-14** — `packages/cli` still spawns nothing. `IO_MODULE` is unchanged, `open.ts` appears in no
exemption, and `frame.source.test.ts:603` passes **without an edit** — which Q-0126's AC-3 already
protects by widening `ServeOptions.bundle` rather than exempting the module. *Test:* the clause's
existing subject demonstration at `:606` is unchanged and the register is asserted to have gained no
entry.

**AC-15** — a browser-launch failure is a **warning, not a failed run**: the daemon is listening, the
warning carries the URL and says the daemon is still running, and nothing shuts down. `--no-open`
serves without launching. **The URL line is byte-identical whether or not a browser is launched**, so
the line Q-0126 added is never conditional on a spawn. SSH is **not** detected and does not silently
change the default (codex's OQ-6, declined: an environment oracle would make a fixture's verdict a
property of the machine, which *"A test's verdict is a property of the commit"* (2026-08-30)
forbids). *Test:* both invocations are driven against an injected spawner; the URL line is compared
byte for byte, and exactly one of them spawns.

**AC-16** — the barrel gains the name by the rule it states (*a command needs it*), `@quorum/core`'s
export count moves with a sentence, `04-architecture.md`'s principle 1 says what it now says, and the
decision entry GO-4 asks for is landed **before a line of code**.

**Non-goals**: a browser chooser, `--browser <cmd>`, remote display forwarding, container/WSL/
headless detection, and any attempt to detect whether a browser actually rendered the page.
