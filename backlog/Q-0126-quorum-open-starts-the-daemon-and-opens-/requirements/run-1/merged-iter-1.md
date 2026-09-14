Q-0126 — `quorum open` starts the daemon and opens a browser

*Merged requirement, run 1, iteration 1. Written against the tree at `9bef7d0` with Q-0125 merged,
2026-09-14. Every measurement below was re-taken from the working tree rather than transcribed from
either candidate or from the ticket body. **Six claims moved, and two of them change the work** —
see §0.*

---

## 0. What was re-measured, and what moved

Both candidates rest criteria on measurements. All of them were re-run. Four held; six did not.

### 0.1 Clause D's failing half is the dynamic-import assertion, not the namespace one — claude is right and the ticket body is wrong

The ticket body says the failing clause is *"the namespace-import route check"* and codex's AC-16
inherits that framing verbatim (*"the existing namespace-import route check is updated narrowly"*).
Measured, `packages/core/src/adapters/cli-version.test.ts`'s clause D makes **two** independent
assertions:

```
expect(workspaceNamespaceImports(sources), 'a namespace import … reaches cliVersion without naming it').toStrictEqual([]);
expect(namedAsWritten(sources, ['import(', 'require(']), 'a dynamic import or a require resolves a module from an expression …').toStrictEqual([]);
```

`workspaceNamespaceImports` matches `/import\s+\*\s+as\s+\w+\s+from\s+['"`]([^'"`]+)['"`]/` — which
`await import('@quorum/server')` does not satisfy. What a dynamic import trips is the **second**
assertion.

This is not pedantry, because the two halves have different shapes and therefore different remedies.
The namespace half has a notion of an allowed set elsewhere in the file (`ALLOWED_NAMERS`,
`STATE_SITES`). The dynamic half is `toStrictEqual([])` with **no register and no exemption anywhere
in the file**. So admitting one dynamic import means creating the *first permitted entry in an
assertion that has never had one*, which is a different act from widening a register that already
discriminates. **AC-8 is written to that, and codex's AC-16 is unsatisfiable as worded** — it asks
for a narrow update to a check that does not fire.

Also confirmed: the corpus is two roots, `packages/core/src` **and** `packages/cli/src`
(`cli-version.test.ts:39–42`), so this clause genuinely reaches a CLI module.

### 0.2 The registry goes to ten, not nine — claude's AC-1 and AC-10 are off by one

`packages/cli/src/commands.ts:40` is already **nine** names:

```
['help', 'init', 'ticket', 'board', 'run', 'lint', 'adapters', 'validate', 'runs']
```

`help` is one of them. Adding `open` makes `COMMANDS` **ten**, and `commandModules()` — the
frame/command partition, which excludes `help` because there is no `help.ts` — goes **eight to
nine**. Claude's AC-1 (*"moves to nine names"*) and AC-10 (*"the nine-command help"*) both describe
the tree as it stands rather than as it will stand. A criterion carrying the wrong number is one an
implementer satisfies by leaving something out.

`commands.test.ts:130` asserts **both** halves strictly — `[...COMMANDS]` and `mentioned(HELP)` —
against one literal, so the help text and the registry move together or neither does.

### 0.3 The new documentation guard may not live in `packages/shared` — claude's AC-11 *Test:* clause is refused by the dependency direction

Claude's AC-11 says `packages/shared/src/docs.test.ts` should hold the README and USAGE command
tables against `COMMANDS`, *"derived, so a tenth command fails until it is documented"*. Two things
are wrong with it.

First, **no such guard exists today**. `docs.test.ts` reads `docs/README.md` for term lists and
`docs/USAGE.md` for one quoted refusal sentence; it does not read `COMMANDS` and holds no command
table. So this is new work, not an extension.

Second, and decisively: deriving from `COMMANDS` means `packages/shared` reading
`packages/cli/src/commands.ts`. That is the dependency direction `04-architecture.md` forbids, and
it is **exactly the refusal Q-0089 hit** — *"putting both trees' checks in `packages/shared` made it
read a `packages/core` source, which `04-architecture.md` forbids; the guard refused it as an
undeclared read, the same finding arriving through a different door."*

The derived check belongs in **`packages/cli`**, beside `commands.test.ts`, which already reads
`HELP` and already owns the registry's identity. It earns a `turbo-inputs.test.ts` registration for
reading `README.md` and `docs/USAGE.md` — root-level literals being visible to `pathLiterals` since
Q-0108 corrected the no-separator rule. AC-11 is written to that.

### 0.4 A third architecture sentence goes false, which neither candidate listed

Claude names `04-architecture.md:251` and `:336`. There is a third, in the same document's
`packages/cli` section: *"Since Q-0099 it dispatches **eight** commands as well as its help … so the
frame now lists every command it dispatches and dispatches every command it lists."* The count moves
to nine. Confirmed by reading; neither candidate has it.

### 0.5 Widening the daemon guard also moves a fixture's expected bytes

`packages/core/src/test-discovery.test.ts:337` is a **count** predicate:

```
const allowed = name === 'packages/server/package.json' ? 1 : 0;
const occurrences = [...text.matchAll(/@quorum\/server/g)].length;
```

Claude's AC-9 is right that a count cannot tell the permitted optional edge from a forbidden required
one, and that the key must be checked. What neither candidate says is that `:384–385`'s hostile
fixture asserts the **exact message string** — `'packages/cli/package.json names @quorum/server 1
time, and may name it none'` — so the fixture's expected bytes move with the predicate, and the
widening has to keep that fixture red for a `dependencies` edge while the real manifest passes with
an `optionalDependencies` one. That is the whole of the criterion.

### 0.6 The launch blocker: the implementer cannot write the lockfile

**This is the finding that must be settled before a run is launched, not by one.** Claude has it;
codex records the same fact (AC-20) without connecting it to the role.

`harness/roles/developer-generalist.md`'s `paths:` are
`[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
packages, apps, harness, docs, README.md, eslint.config.js, vitest.shared.js]`. **`pnpm-lock.yaml`
is not among them**, and `git ls-files pnpm-lock.yaml` returns it — it is tracked at the repository
root, which no listed path reaches.

`harness/harness.yaml`'s `install:` is `pnpm install --frozen-lockfile`, run by
`runIntegrate` in the integration worktree before the suite.

So an implement step that adds a dependency edge to `packages/cli/package.json` — which is the whole
of AC-7 — writes a manifest it *may* write, cannot write the lockfile that manifest now requires,
and `integrate` refuses with `ERR_PNPM_OUTDATED_LOCKFILE` before a test runs. That is *"A
requirement may not name a surface its flow cannot write"* (2026-08-25), and the development plan
records this family as *a loop handed work no agent in it can perform* sixteen times. **GO-2 is the
remedy.**

### 0.7 What held

- `frame.source.test.ts`'s AC-11 refuses `IO_MODULE` in every production module, with the stated
  reasoning *"every read and every spawn goes through `@quorum/core`"*. The browser spawn cannot
  live in `packages/cli`. Both candidates are right.
- `SELF_LOCATING` is one entry, `init.ts`, and its prose says *"a second command module doing it
  would mean two places knew where the package is"* — so a second entry is a decision, not a line.
- `SIGNAL_HANDLER_OWNER = ['src/run.ts']`, asserted `toStrictEqual` with a both-directions
  demonstration at `:852` and a runtime listener count at `:871` that proves the registration is not
  at module scope.
- `packages/cli/src/package.test.ts`'s `Manifest` interface declares no `optionalDependencies` field
  at all, and `:43` asserts `dependencies` strictly and `devDependencies` undefined. An optional
  block is entirely invisible to the register that exists to describe this manifest's dependencies.
- `build.test.ts:2220`'s `workspaceDepsOf` reads `.dependencies` only, feeding `:2444`'s
  `toStrictEqual(['cli', 'core'])` and the pnpm-rewrite loop under it — the only check that
  `workspace:*` still becomes a resolvable version.
- `createDaemon({ project, port = 0, retain = DEFAULT_RETENTION, bundle })` exists at `serve.ts:208`
  and returns `Listening & { host }`, closing the host *before* the socket with the reason stated in
  place. `serve` is the lower-level entry that takes a host. Claude's §0.4 is right; the command
  should use `createDaemon`, which is *"the one place that chooses a retention capacity"*.
- `main.ts` statically imports every command module and `index.ts` `export * from`s every one, so a
  dynamic import must be **inside the handler body** — the module itself is loaded either way.

### 0.8 One collision inside codex's own document

Codex's AC-3 requires the end-to-end test to bind `127.0.0.1:7717` and print *"that exact URL"*,
while its AC-4 requires that tests *"do not require the developer machine's port 7717 to be free"*.
Those cannot both hold for the same test. The merge splits them: the **default** is asserted as a
constant against `vite.config.ts`'s resolved value, and the **end-to-end** runs on an
operating-system-assigned port.

---

## 1. Problem

**`maintainer`.** After Q-0122 the daemon serves a built web app at `GET /*`, and after Q-0125 the
daemon can be imported by name and emits. Neither is reachable: `packages/cli` declares no
dependency on `@quorum/server`, there is no `open` command, and the daemon has only ever run under
its own test suite. **The product has a UI nobody can open**, and the only way to see it is to write
a script.

**`adopter`.** `README.md`'s command table lists eight commands and none of them shows the UI the
project describes itself as. M3's own done-when — *"`quorum open` starts daemon + browser"* — has no
ticket behind it, and `04-architecture.md`'s `packages/cli` section has promised the command since
2026-08-22.

**`contributor`.** `apps/web/vite.config.ts:60` runs the app against a daemon on port 7717 by
convention, and its own header records that nothing has yet agreed to that number: *"the daemon
itself has no default port … so `quorum open` is what will later have to agree with this value."*
This is that later.

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

A child that starts the daemon, serves the bundle and prints the URL touches `packages/cli` and one
manifest. It needs no `node:child_process`, no per-platform launcher table, no new `core` folder, no
new barrel name, and no ruling against `04-architecture.md`'s principle 1.

**The two halves are also different flow shapes, which is the argument the size table does not
make.** The daemon half is registers, a manifest and one thin command module — chore-shaped, like
Q-0121, Q-0122 and Q-0125. The browser half is a closed-set result union, a per-platform table and a
contract a stub can be written against — which is what `solutioning` and `qa-red` are for, and
Q-0120's entry records that solutioning *"paid for itself"* on exactly that shape. Splitting routes
each half to the flow that fits it.

**Splitting at the primitive instead is refused**, on a rule rather than taste:
`packages/core/src/index.ts`'s own header says a name is added to the barrel *"because a command
needs it rather than because its module exports it"* — Q-0092 withheld `manifestShapeError` and
Q-0093 withheld `currentBranch` on exactly that clause. A child landing a browser primitive with no
command to use it violates the rule it would have to edit.

**Criteria are numbered continuously across the children** (Q-0103's practice), so a criterion keeps
its name if the gate moves the cut. **AC-1 to AC-11 are this ticket. AC-12 to AC-16 are the
successor, whose body is Appendix A, written out in full** so the obligation cannot expire in this
document — the failure `docs/06-development-plan.md` records for Q-0100's, Q-0110's, Q-0111's and
Q-0112's obligations.

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

The counts are **ten** for `COMMANDS` (nine commands beside `help`) and **nine** for
`commandModules()` (§0.2).

*Test:* `commands.test.ts:130`'s registry literal moves to ten names, with a superseded-value
assertion added beside the existing ones in the shape that file already uses — `not.toStrictEqual([…
the nine …])`, so a register that quietly shrinks back fails naming the ticket it shrank past.
`frame.source.test.ts`'s partition and derived-barrel clauses pass **with no change to their
derivation**, both being computed from `COMMANDS`; the partition's expected list gains `open.ts` and
one more superseded-value line.

### AC-2 — the command opens a project, starts the daemon, prints one URL, and does not return while it serves

`quorum open` resolves the project through **`@quorum/core`'s `loadProject`**, honouring
`flags.project`, with `ProjectNotFoundError` rendered by `packages/cli/src/fail.ts`'s existing
`dieNoProject`, so the sentence a stranger sees is the single one Q-0111 made single. It then starts
the daemon through `createDaemon` — not `serve`, which takes a host and would make this command the
second place choosing a retention capacity — prints **one** line carrying the URL including the bind
address, and awaits a stop.

**It does not use `@quorum/server`'s `openProject`**, and that is measured rather than stylistic:
that symbol lives in the package that may not be installed, so routing project resolution through it
would make *no project here* unreportable on exactly the installation where the daemon is absent.

It accepts no positional argument. The bind address is `@quorum/server`'s `BIND_HOSTNAME` and **no
flag may move it**: the command declares no `--host` and names none in its help.

*Test:* the command is driven in process against an operating-system-assigned port with a temporary
project and a temporary bundle; `GET /` over that port answers the bundle's `index.html` and
`GET /project` answers JSON. The printed line is asserted to contain `127.0.0.1` and the bound port.
The package's own text is asserted to contain no `--host` and no second hostname literal.

### AC-3 — the bundle root is resolved relative to the module's own location, and `open.ts` is `SELF_LOCATING`'s second entry with its reason

The root is resolved relative to the running module (`new URL('../../../apps/web/dist/',
import.meta.url)` or equivalent) and to nothing else. Not `process.cwd()`, which answers the
operator's directory, and not an environment variable, which answers whatever was exported —
`static.ts`'s header rules both out for the daemon and the same argument reaches the caller.

`SELF_LOCATING` gains `'open.ts'` with a one-sentence reason naming this criterion, against that
register's own prose refusing a second command module by default.

*Test:* the register's existing both-directions demonstration is extended to the new entry — an entry
permitting a self-location its module does not perform fails, and a self-location with no entry
fails. Separately, the resolved path is asserted **identical computed from `src/` and from `dist/`**,
so the depth uniformity 078(e) gives `init` is measured here rather than assumed.

### AC-4 — a directory holding no build refuses before anything binds, and the CLI composes the remedy

`serve` already throws on a bundle root with no `index.html`, *"before anything binds"*. The command
catches that one condition and renders it as the frame's single red sentence and exit 1: the
**condition** is the library's (`bundleRefusal` composes it and carries no shell imperative, per *"A
`core` error names the condition; the remedy belongs to the surface"*, 2026-09-07), and any
imperative a shell user reads is composed in `packages/cli`. Nothing binds, no port is printed.

**Ordering is ruled: the daemon-absent refusal of AC-10 comes first**, and the reason is concrete
rather than aesthetic. In a packed install `open.js` sits at `node_modules/@quorum/cli/dist/`, so
AC-3's self-location resolves to a path with no meaning there; checking the bundle first would report
*no build at `node_modules/apps/web/dist`* — a nonsense path — instead of the true thing, which is
that this installation does not carry the daemon. Cheap to reverse if the gate disagrees.

*Test:* the command runs against a directory that exists and holds no `index.html`; the process exits
1, the output names the directory and the missing entry, and **no socket was opened** — asserted by
attempting a connection to the port that would have been used, rather than by reading the message.

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

`SIGINT` and `SIGTERM` close the daemon through `createDaemon`'s `close()`, which releases every live
run through the host's abandonment path and only then stops the socket — that order being the one
`serve.ts` states and Q-0013's shutdown exists to preserve. Handlers are installed when the command
starts serving and removed in a `finally`, **never at module scope**, on `run.ts:168–200`'s precedent.
A repeated signal does not accumulate listeners (codex AC-13).

`SIGNAL_HANDLER_OWNER` becomes two entries, each carrying why. Shutdown failure is reported and exits
non-zero rather than being swallowed.

*Test:* the clause is asserted over the two-entry register and the existing both-directions
demonstration is extended — a third owner fails, and a register naming two owners is not satisfied by
a tree with one. The runtime listener count (`frame.source.test.ts:871`) is **unchanged and must stay
green**, which is what proves the registration is not at module scope. The close path is asserted by
starting the command in process, delivering the signal, and requiring that the host reports no
running run and the socket refuses a connection afterwards. Repeated signals are asserted not to grow
`process.listenerCount`.

### AC-7 — the manifest declares the daemon as an optional dependency, and the three silent registers stop being silent

`packages/cli/package.json` gains `"optionalDependencies": { "@quorum/server": "workspace:*" }` —
**not** `dependencies`, which the ticket body's row 1 measures as killing the packed install outright
with `ECONNREFUSED` before any module loads.

Three registers that currently say nothing about a third dependency key are made to say something
(§0.7):

- `packages/cli/src/package.test.ts` asserts the **whole dependency shape** — its `Manifest`
  interface gains the field, `dependencies` stays strictly the two workspace names,
  `devDependencies` stays undefined, and `optionalDependencies` is strictly the one name, with a
  sentence saying why it is optional rather than required.
- `build.test.ts`'s `workspaceDepsOf` reads optional edges too, so `:2444`'s register and the
  pnpm-rewrites-`workspace:*` loop under it cover the new edge. The register is **re-derived, not
  adjusted**.
- The packed `@quorum/cli` manifest is asserted to carry the rewritten `0.0.0` for the optional edge,
  which is the fact AC-10's install rests on.

*Test:* each of the three is shown red against the manifest as it stands today and green after, and
the `workspaceDepsOf` widening is shown to **change** the derivation rather than leave it identical —
a widening that changes nothing has not been established.

### AC-8 — the import is dynamic and inside the handler, and clause D admits it by identity while still firing on everything else

`open.ts` reaches `@quorum/server` through `await import('@quorum/server')` **inside the command
handler**. `main.ts` statically imports every command module and `index.ts` `export *`s every one, so
the module is loaded whatever command was typed; what must be deferred is the **specifier**, not the
module.

`cli-version.test.ts` clause D's **dynamic-import assertion** — the second one, §0.1 — gains its
**first** permitted entry: a register of `file → reason` on the `STATE_SITES`/`SELF_LOCATING` shape
already used twice in that file, never a relaxed predicate. The **namespace half is asserted
unchanged and still empty**, which is what keeps §0.1's correction durable.

*Test:* the clause is shown to still fire — a second, unregistered dynamic import planted in a copy
of the corpus is reported by name — and the register fires the other way: an entry permitting a
dynamic import its module does not perform fails. Separately, and per the ticket body's own
methodological note, the **emitted** `dist/open.js` is asserted to carry no static resolution of
`@quorum/server`, because `import type` is erased and the claim is about what Node loads rather than
about what the source says.

### AC-9 — `test-discovery.test.ts` AC-13 is widened by key rather than by count, and its fixture moves with it

`namesTheDaemon` becomes: one occurrence in the daemon's own manifest as its `name`, and one in
`packages/cli/package.json` **under `optionalDependencies`** — the key checked, not merely the count,
because a count cannot tell the permitted edge from a required one.

*Test:* the hostile fixture is kept and **still fails** — a `dependencies` edge from `packages/cli` is
reported by name, with its expected message updated to whatever the new predicate says (§0.5) — and a
second fixture is added for the permitted optional edge. Real manifests and fixtures go through the
**same predicate**, which is the shape Q-0125 iteration 2 adopted after reporting the opposite as a
nit, and which that file's own comment at `:376` already demands.

### AC-10 — the packed path keeps every command it had, and `quorum open` there says something true

Q-0098's fixture — *"the packed set installs outside the workspace with the registry dead, and
runs"* — stays green with **no change to `DISTRIBUTION`**, and `quorum help` works in the packed
project.

`quorum open` there **refuses with a sentence that distinguishes what it observed from what it cannot
establish**. It may say that `@quorum/server` did not resolve from this installation and name the
workspace path that carries the daemon. It may **not** say the daemon is missing, broken or not
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

- `04-architecture.md`'s `packages/cli` section: `quorum open` stops being one of three future
  commands and becomes shipped, with what it does and what it does not.
- The same section's *"Since Q-0099 it dispatches **eight** commands as well as its help"* becomes
  nine (§0.4).
- `04-architecture.md`'s emit paragraph: *"`@quorum/server`'s is consumed by nothing yet: it exists
  so that Q-0126's `quorum open` resolves to a file"* is now false in its first clause and true in
  its second; it moves to what happened, and the `packages/cli` section gains the sentence that this
  package now has a **conditional** consumer and why the edge is optional.
- `06-development-plan.md`: this ticket's bullet, and M3's done-when line, which is **half**
  satisfied — the daemon half by this cut, *"CLI and UI can both answer the same gate"* by nothing
  here.
- `README.md`'s command table and `docs/USAGE.md`'s `## Commands` section each gain one entry, and
  **each states that the packed path does not carry the daemon**, because README's install section
  claims both paths work and a table listing a ninth command silently fails one of them
  (`harness/product-context.md` quality pillar 7).

*Test:* a guard in **`packages/cli`** — not `packages/shared` (§0.3) — holds the README and USAGE
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
   for `distributed`"* (2026-09-12). Nothing here changes `DISTRIBUTION`, `files`, `private` or `bin`
   on any package.
4. **Any screen.** `apps/web` fetches nothing today, so what this command makes reachable is the
   shell and its placeholders. Saying so is the point; filling them is Q-0015 to Q-0018.
5. **Building the bundle.** `quorum open` runs no build, invokes no turbo and shells out to no
   package manager. A missing bundle refuses with a remedy (AC-4).
6. **`--bundle <dir>`.** One way to find the bundle, for the reason `SELF_LOCATING` gives. An
   operator with a bundle elsewhere is Q-0124's case. (OQ-6.)
7. **`--host` and any non-loopback bind.** Refused by `BIND_HOSTNAME`'s own ruling, restated so
   nobody adds it as a convenience.
8. **A detached or background daemon**, reusing or discovering an already-running one, and
   terminating whatever holds the port.
9. **Persisting a port, a browser preference or any daemon registry** — files are the database, and
   this command adds no file.
10. **Authentication, multi-user, a remote daemon, cloud sync, TLS, telemetry, desktop shell** — v1
    exclusions.
11. **Resumable runs after a daemon restart** — Q-0019.
12. **`quorum compile` and `quorum history`**, the two other commands `04-architecture.md` promises
    beside this one.
13. **Registry-resolved `npx quorum`** — Q-0029, in M6, refused while every package is `private`.

---

## 6. Open questions

**OQ-1 (BLOCKING) — the packaging shape, and the entry it owes.** Four answers; the ticket body's own
measurement rules out two:

- Row 1, `dependencies` + static import: the **packed install dies**, `ECONNREFUSED`, before any
  module loads. Refused by measurement.
- Row 2, `optionalDependencies` + static import: `quorum help` dies with `ERR_MODULE_NOT_FOUND`.
  Refused by measurement.
- Row 3, `optionalDependencies` + dynamic import: both paths keep working, and `quorum open` works on
  **one** of the two installation paths this repository claims.
- Row 4, hold for Q-0124: rule the distribution set first, ship the command on both paths, owe no
  clause-D admission and no optional-dependency silence.

**Recommendation: row 3.** The ticket is p1 and owns a milestone done-when line; the change is
additive; the honesty cost is closable by a criterion (AC-10) rather than structural; and row 3 does
not foreclose row 4 — when Q-0124 rules, the edge becomes required, the import may become static, and
the clause-D entry is deleted rather than amended. What the gate is choosing is whether a p1
milestone line waits on a p2 `draft` ticket.

**It is blocking because of GO-1, not because the recommendation is weak.** Row 3 owes a decision
entry, and `developer-generalist` may not write one — so an implement step meeting AC-7 returns
`blocked` on round one, which is Q-0062's three wasted rounds exactly.

**OQ-2 (BLOCKING) — the split.** §3. Recommendation: split at the browser, eleven criteria here and
five in Appendix A. Unsplit this is sixteen against a ceiling of fifteen, and the two halves want
different flows.

**OQ-3 (BLOCKING before launch, not before code) — the lockfile.** §0.6. This is GO-2 and it is a
launch condition rather than a design question: without it `integrate` refuses before a test runs.

**OQ-4 — a port already in use.** Refuse naming the port (recommended, run-lock precedent), or bind 0
and print whatever was given. Drifting breaks the dev proxy's assumption and any bookmark; `--port`
is the escape hatch for two projects at once.

**OQ-5 — the exit code on a signal.** `exit.ts`'s table is closed at five and `run.ts` exits 130 on an
interrupted run. But Ctrl-C is the **documented way to stop `quorum open`**, so 130 reports an
interruption for the normal termination of a command whose whole job is to keep running.
Recommendation: **130**, on the convention every other tool follows and on the ground that
re-interpreting a closed table is not a decision to take in passing. The one question here where the
answer is genuinely close.

**OQ-6 — where the port default is declared.** `@quorum/shared` (recommended: declarations-only, and
`vite.config.ts` already imports from it by source path for a measured reason), or declared in
`open.ts` with a test holding `vite.config.ts`'s literal against it. The shared home slightly
promotes 7717 from *"a dev-server convention, not a contract"* to a shipped default — which is what it
is becoming either way, and the promotion should be stated rather than absorbed.

**OQ-7 — `--bundle <dir>`.** Recommendation: no, per non-goal 6. Raised because it is the obvious
mitigation for AC-10's refusal and should be declined on the record rather than forgotten.

**OQ-8 — does `quorum open` report the runs the daemon can already back?** Q-0121 landed `GET /runs`.
Recommendation: no — one URL and a stop instruction. A second line is a screen's job.

**Closed rather than carried: codex's OQ-2**, on what evidence distinguishes an intentional omission
from a broken install. AC-10 answers it without build metadata: the sentence reports what failed to
resolve *here* and claims nothing about why, which is the only honest answer a probe that could not
answer is allowed to give.

---

## 7. Gate obligations

**GO-1 (blocking, before a line of code) — a decision entry is owed on OQ-1.** Three reasons, any one
sufficient:

1. `optionalDependencies` is a **third dependency kind** in a workspace that has used two, and it
   makes a *silent skip* the normal case on a claimed installation path. This repository refuses that
   shape elsewhere by name.
2. `harness/product-context.md` quality pillar 7 states that two installation paths are claimed and
   both work. After this ticket one of them has a command that does not. A claim is moving, and
   `.claude/rules/docs-and-decisions.md` says an entry is what moves one.
3. Decisions 092 and 093 routed *how an installation outside the workspace obtains the UI or the
   daemon* to Q-0124 **explicitly**. Declaring the first consumer answers part of a question a landed
   entry deferred, which is not something to do silently.

The entry states what an optional edge claims, what it refuses, and that it is provisional against
Q-0124 — so that ticket reads a ruling rather than an accident.

**GO-2 (blocking, before the run is launched) — the lockfile.** §0.6. The manifest edge and its
`pnpm-lock.yaml` update are landed **by the human, on `harness/Q-0126/integration`** — the branch
`chore.yaml` cuts the implement worktree from — before the chore run starts, together with AC-9's
widening of `test-discovery.test.ts` so that branch is green. **Not on `main`**, where Q-0125's AC-13
would be red until the merge: Q-0067 GO-2's precedent, the first time this repository had to sequence
a change against its own guard.

The alternative — granting `pnpm-lock.yaml` to `developer-generalist` — is a harness edit with effects
on every future chore ticket, and should not be taken as a side effect of this one.

**GO-3 — OQ-2, the split.** If refused, an erratum naming the seam in advance and saying that the
remedy on exhaustion is a second erratum rather than a fourth round (Q-0122 E-1's shape).

**GO-4 — where the browser primitive lives** (the successor's, but the argument belongs to a gate).
`04-architecture.md`'s principle 1 enumerates `core`'s I/O as *"spawns CLIs, reads/writes the project
folder and git"*. A browser is none of the three, and `packages/core/src` is one folder per port child
(Q-0064), so a ninth folder is a visible act. Settle whether principle 1 widens or whether the
primitive sits in an existing folder, before the successor runs.

**GO-5 — no glossary term is coined and none is owed.** *Daemon* is used throughout
`04-architecture.md` and appears in **Connection state**'s own text; this ticket introduces no new
noun. Recorded so it is not re-litigated at the implement step. If the gate disagrees, the term lands
**on the integration branch** and not on `main`, for GO-2's reason and Q-0108's check.

**GO-6 — verification.** Forced in both environment rows (a worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge), `quorum lint`, the git-identity
sweep, and — because **eight registers move** — each widened register shown red **in both
directions** rather than observed green. Q-0107's rule applies throughout: *a guard shown red by its
neighbour has not been established*.

---

## 8. Risks

**R-1 — the command works on one of the two paths this repository claims.** Stated rather than
mitigated: under row 3 a packed install refuses `quorum open`. Not a regression, there being no
`open` today, and the end state stays Q-0124's. AC-10 and AC-11 keep it honest rather than hidden.

**R-2 — eight registers move, and a widened register is the shape this repository keeps getting
wrong.** Every widening in AC-7 to AC-9 names the clause it isolates, because a guard shown red by
its neighbour has not been established.

**R-3 — the daemon has no authentication, and this command makes starting it a single word.** The
loopback bind is the whole of the defence. The risk is a later convenience flag eroding it; non-goal
7 and AC-2's assertion that the package names no second hostname are the tripwires.

**R-4 — two ways to serve the same app.** A contributor running `vite dev` on 7717 and a `quorum
open` daemon on 7717 collide, and the two serve *different builds*. AC-5's refusal turns that into a
message instead of a mystery.

**R-5 — what the command reveals is a shell.** `apps/web` fetches nothing, so a maintainer who runs
this sees a rail, a theme and placeholders naming the tickets that will fill them. AC-11's
documentation should say what the UI does today, not what it will do.

**R-6 — a filtered build leaves no bundle.** `pnpm turbo run build` builds every emitter, but
`--filter=@quorum/cli` does not build `apps/web`, no manifest edge ordering them. AC-4's refusal names
the directory, which is the right failure; worth one sentence in USAGE.

**R-7 — `optionalDependencies` and `--frozen-lockfile` interact beyond GO-2.** A future `pnpm install`
in an environment configured to omit optional dependencies leaves a workspace where `quorum open`
refuses while everything else works. Acceptable, and worth naming in GO-1's entry.

**R-8 — foreground lifecycle occupies the terminal.** Background daemon management is deliberately out
of scope, but adopters may expect the command to return. One sentence in USAGE.

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
| **Flow route** | `requirements` → `chore`, for this half. Nothing here changes a flow or an engine module a run loads at start, so the run can benefit from its own change — unlike Q-0083, Q-0086 to Q-0089 and Q-0117. **GO-2 is the one thing that must happen outside it.** The successor is pipeline-shaped (§3). |

---

## 10. Provenance

**Base document: claude.** Eleven criteria against codex's twenty-nine, a measured split at the
browser spawn, and the register inventory (`SELF_LOCATING`, `SIGNAL_HANDLER_OWNER`, and the three
*silent* registers — `package.test.ts`'s missing field, `workspaceDepsOf`'s `dependencies`-only read,
`apps/web`'s justification derivation) that codex does not have at all. Its §0.1 correction of the
ticket body is right and is the single most useful thing either document produced: the body and
codex's AC-16 both name the wrong half of clause D, and the remedy differs between them. Its §0.3
lockfile finding is the launch blocker. AC-1 to AC-7, AC-9 and the gate obligations are substantially
its work.

**Taken from codex**, four things claude missed:

- **The Windows launch contract** (its OQ-4): `start` is normally a `cmd.exe` builtin rather than an
  executable, so a no-shell requirement does not fall out of using an argument-based API. Claude's
  appendix asserts a per-platform table without noticing that one row of it cannot be written the way
  the other two are. Moved into Appendix A as AC-12's blocking question.
- **The typed closed-set launcher contract** (its AC-15): *launched, unsupported platform, executable
  unavailable, launch failed*, no `any`, no shell for macOS or Linux, and unit tests proving the
  selected executable and argument list per platform. Stronger than claude's AC-12.
- **The bounded signal-listener clause** (its AC-13), folded into AC-6.
- **The sharpest statement of the honest-refusal problem** (its AC-18 and OQ-2), which is what AC-10's
  wording is built from — though it is **ruled here rather than carried as a blocker**, because it
  changes one sentence rather than the design.

**Refused from codex.** Twenty-nine criteria is roughly double the ceiling and the document does not
notice: criteria 25 to 29 restate standing repository rules (BYOS, worktree safety, files are the
database, gate behaviour, product scope) as acceptance criteria, which is what the cross-cutting
checklist is for, and 21 to 23 are a verification plan rather than criteria. Its AC-16 is
unsatisfiable as worded (§0.1). Its AC-3 and AC-4 collide (§0.8). Its non-goal refusing a port flag
leaves AC-5's occupied-port refusal with no escape hatch.

**Corrections to both, made against the tree.** §0.2, the registry is nine names and goes to ten, not
nine — claude's AC-1 and AC-10 are off by one. §0.3, claude's AC-11 puts a new derived guard in
`packages/shared`, which would make that package read `packages/cli/src/commands.ts`: the dependency
direction `04-architecture.md` forbids, and the exact refusal Q-0089 hit. §0.4, a third architecture
sentence goes false that neither document lists. §0.5, the daemon guard's hostile fixture asserts an
exact message that moves with the predicate. §0.7, `createDaemon` rather than `serve` is the right
entry, because it is *"the one place that chooses a retention capacity"*.

**New here, in neither candidate.** AC-2's ruling that project resolution goes through
`@quorum/core`'s `loadProject` and never `@quorum/server`'s `openProject` — that symbol lives in the
package that may not be installed, so routing through it makes *no project here* unreportable on
exactly the installation where the daemon is absent. AC-4's ordering ruling, that the daemon-absent
refusal precedes the bundle check, because a packed `open.js` sits at `node_modules/@quorum/cli/dist/`
and AC-3's self-location would otherwise report a nonsense path. AC-8's clause that the **emit** is
what must be asserted, since `import type` is erased. And §3's observation that the two halves are
different *flow* shapes, which is an argument for the split that the size table does not make.

---

## Appendix A — the successor, written out in full

*Transcribed rather than referenced, because an obligation recorded only inside a closed ticket's
prose is one that quietly expires — the failure `docs/06-development-plan.md` records for Q-0100's,
Q-0110's, Q-0111's and Q-0112's obligations. If the gate refuses the split these become AC-12 to
AC-16 of this ticket and this appendix is promoted by erratum; if it accepts, this is the successor's
body.*

### Q-01xx — `quorum open` opens a browser

**Depends on Q-0126**, strictly: there is no URL to open until the daemon starts.

**The gap.** Q-0126 prints a URL a human pastes. M3's done-when says *"starts daemon + browser"*.

**The constraint.** `packages/cli/src/frame.source.test.ts`'s AC-11 refuses `node:child_process` in
**every** production module of that package, with the stated reasoning that *"every read and every
spawn goes through `@quorum/core`"*. Opening a browser is a spawn, so the launcher cannot live in
`packages/cli` at all. Q-0093's precedent is exact: `init`'s scaffolding became
`core/backlog/scaffold.ts` for this rule and the command kept one expression. `core` already spawns
at `adapters/exec.ts` and `fanout/fanout.ts`, so there is a house style.

**What it must decide first (GO-4 above).** `04-architecture.md`'s principle 1 enumerates `core`'s
I/O as *"spawns CLIs, reads/writes the project folder and git"*. A browser launcher is none of those.
Either principle 1 widens — a decision entry — or the primitive sits in an existing folder and the
argument for which one is written down.

**AC-12** — `core` gains exactly one exported primitive that opens a URL in the platform's default
browser, and it is the only place in the workspace that spawns for that purpose. The per-platform
command is a **table**, not a chain of conditionals, and the URL is passed as one literal argument
through an argument-based process API — **never composed into a shell string**. *Test:* the table is
asserted per platform over an injected spawner, and a whole-workspace scan finds no second site
launching a browser.

> **Blocking question, from codex's OQ-4: Windows.** `start` is normally a `cmd.exe` builtin rather
> than an executable, so *"use an argument-based API"* does not by itself give a safe Windows row.
> The ticket must either specify a proven `cmd.exe` argument contract, choose a small justified
> dependency, or **refuse Windows explicitly** — in which case AC-12's table says so and the platform
> is an `unsupported` state rather than a silently claimed one. It must not be treated as supported
> by default. Note that this repository has never claimed Windows support (Q-0098 registered the
> POSIX-only build and named the ticket as owed only if it ever does), which is an argument for the
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
exemption, and `frame.source.test.ts`'s AC-11 passes **without an edit**. *Test:* the clause's
existing subject demonstration is unchanged and the register is asserted to have gained no entry.

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

**Non-goals**: a browser chooser, `--browser <cmd>`, remote display forwarding, container/WSL/headless
detection, and any attempt to detect whether a browser actually rendered the page.
