# Q-0126 — `quorum open` starts the daemon and opens a browser

*Requirements, run 1, candidate (claude). Written against the tree at `9bef7d0` + Q-0125 merged,
2026-09-14. Every measurement below was taken from the working tree rather than transcribed from the
ticket body, and **three of the body's own claims moved** — §0.1, §0.2 and §0.3.*

---

## 0. What was measured, and what moved

The ticket body carries a measurement taken on 2026-09-14 and instructs the requirement to *"weigh
row 3 rather than adopt it"*. That instruction is followed. Re-measuring also corrected the body in
three places, and one of those corrections is a **launch blocker rather than a criterion**.

### 0.1 The body names the wrong half of clause D, and the difference decides the remedy

The body says the failing clause is *"the namespace-import route check"*, and that
`await import('@quorum/server')` *"binds every export under one identifier, which is that clause's
stated subject"*.

Measured: `packages/core/src/adapters/cli-version.test.ts:295` — *"clause D"* — makes **two**
independent assertions over a corpus that is `packages/core/src` **and** `packages/cli/src`
(`:39–42`):

```
expect(workspaceNamespaceImports(sources), …).toStrictEqual([]);          // :302–305
expect(namedAsWritten(sources, ['import(', 'require(']), …).toStrictEqual([]);  // :306–309
```

`workspaceNamespaceImports` matches `/import\s+\*\s+as\s+\w+\s+from\s+['"`]([^'"`]+)['"`]/g`
(`:161`), which a dynamic `await import('…')` does not satisfy. What a dynamic import trips is the
**second** assertion, whose message reads *"a dynamic import or a require resolves a module from an
expression, which no source scan can follow"*.

That is not pedantry, because the two halves have different shapes. The namespace half already has a
notion of an allowed set elsewhere in the file (`ALLOWED_NAMERS`, `STATE_SITES`); the dynamic half
asserts `toStrictEqual([])` — **zero, with no register and no exemption anywhere in the file**. So
admitting a dynamic import means *creating* the first permitted entry in a clause that has never had
one, and the criterion has to say what such an entry is and what still fires without it. AC-8 does.

### 0.2 "Six registers" is at least nine surfaces, and three of them are silent rather than red

The six the body measured are real and are confirmed by reading. Beyond them:

**Two more that fail, on work the ticket owes and does not name.**

- `frame.source.test.ts:269` **`SELF_LOCATING`** — exactly one production module may resolve its own
  location, and it is `init.ts`. The bundle root `createDaemon` requires is package-relative (the
  daemon *"cannot compute it, the bundle's location being package-relative while the daemon's
  working directory is the operator's project"* — `static.ts` header), so `open.ts` has to resolve
  it the way `init.ts` resolves the templates. That is a second entry, and the register's own prose
  says *"a second command module doing it would mean two places knew where the package is"* — so the
  entry is a decision, not a line.
- `frame.source.test.ts:837` **`SIGNAL_HANDLER_OWNER = ['src/run.ts']`** — exactly one file in the
  package may install a process signal handler, asserted by `toStrictEqual` and demonstrated in both
  directions at `:852`. A command that owns a daemon's lifetime owns a handler.

**Three that do not fail and should be made to say something**, which is the more interesting class
— a register that is *silent* about the key you added reads as coverage:

- `packages/cli/src/package.test.ts:43–47` pins `own.dependencies` with `toStrictEqual` and
  `own.devDependencies` to `undefined`. It says **nothing about a third dependency key**. An
  `optionalDependencies` block lands entirely outside the assertion that exists to describe this
  manifest's dependencies.
- `packages/cli/src/build.test.ts:2220` `workspaceDepsOf` reads `dependencies` only. It feeds
  `:2444`'s register `expect(dependents).toStrictEqual(['cli', 'core'])` and the loop under it,
  which is the **only** check that pnpm still rewrites `workspace:*` to a resolvable version — the
  fact Q-0098 AC-19(b)'s packed install rests on. A `workspace:*` in `optionalDependencies` is
  rewritten by pnpm to `0.0.0` in the packed manifest and **no assertion sees it**.
- `apps/web/test/package.test.ts:89` derives its justification register from
  `dependencies` + `devDependencies`. Not this package, but the same shape, and it is the register
  `04-architecture.md` cites as *"the whole of the protection"* keeping the browser off
  `@quorum/server`.

### 0.3 The launch blocker: the implementer cannot write the lockfile

**This is the finding that should be settled before a run is launched, not by one.**

`developer-generalist`'s `paths:` are `[package.json, pnpm-workspace.yaml, turbo.json,
tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, harness, docs, README.md,
eslint.config.js, vitest.shared.js]`. **`pnpm-lock.yaml` is not among them**, and it is tracked at
the repository root (`git ls-files pnpm-lock.yaml` returns it).

`harness/harness.yaml:34` is `install: pnpm install --frozen-lockfile`, and
`packages/core/src/engine/composite.ts`'s `runIntegrate` runs it in the integration worktree before
the suite.

So an implement step that adds a dependency edge to `packages/cli/package.json` — which is the whole
of the packaging half — writes a manifest it *may* write, cannot write the lockfile that manifest
now requires, and `integrate` refuses with `ERR_PNPM_OUTDATED_LOCKFILE` before a test runs. The
ticket body records the same fact from the other end (*"`pnpm install --frozen-lockfile` refuses
until the lockfile is committed, which is the flag CI uses"*) without connecting it to the role.

That is *"A requirement may not name a surface its flow cannot write"* (2026-08-25), and the
development plan records this family as *a loop handed work no agent in it can perform* at least
fifteen times. **GO-2 below is the remedy**, and it is Q-0067 GO-2's precedent rather than a new
invention: the manifest edge and its lockfile are landed by the human **on
`harness/Q-0126/integration`** — the branch `chore.yaml:10` cuts the implement worktree from — and
not on `main`, where `test-discovery.test.ts:345` would be red until the ticket merged.

### 0.4 What the tree gives the command to work with

- `createDaemon({ project, port = 0, retain, bundle })` (`serve.ts`) returns `{ port, host, close }`,
  where `close` shuts the host down and then the socket, in that order and for a stated reason.
- `BIND_HOSTNAME = '127.0.0.1'` and *"not configurable, and that is the decision rather than an
  omission"*.
- A `bundle` holding no `index.html` **refuses before anything binds** — `serve` throws rather than
  starting and answering 404 at `/`. `NO_BUNDLE_REMEDY` is already composed and carries no shell
  imperative, per *"A `core` error names the condition; the remedy belongs to the surface"*
  (2026-09-07).
- `openProject(dir?)` (`failures.ts`) returns a result rather than throwing, and already classifies
  `ProjectNotFoundError`.
- `apps/web/vite.config.ts:31` reads `Number(process.env.QUORUM_DAEMON_PORT ?? 7717)` and its header
  says in as many words that *"`quorum open` is what will later have to agree with this value"*.
- `packages/cli/src/run.ts:168–200` is the precedent for installing `SIGINT`/`SIGTERM` handlers
  around an operation and removing them in a `finally`.
- Depth: `packages/cli/{src,dist}/open.ts` is three levels below the repository root either way, so
  `new URL('../../../apps/web/dist/', import.meta.url)` resolves identically under the
  `quorum-source` condition and under a plain `node` — the same uniformity 078(e) gives `init`.

---

## 1. Problem

**`maintainer`.** After Q-0122 the daemon serves a built web app at `GET /*` and after Q-0125 the
daemon can be imported by name. Neither is reachable: `packages/cli` declares no dependency on
`@quorum/server`, there is no `open` command, and the daemon has only ever run under its own test
suite. The product has a UI nobody can open, and the only way to see it is to write a script.

**`adopter`.** `README.md`'s command table lists eight commands and none of them shows the UI the
project describes itself as. M3's own done-when — *"`quorum open` starts daemon + browser"* — has no
ticket behind it and `04-architecture.md:251` has promised the command since 2026-08-22.

**`contributor`.** `apps/web/vite.config.ts` runs the app against a daemon on port 7717 by
convention, with its own header recording that nothing has yet agreed to that number. A contributor
running the dev server and a contributor running the shipped daemon are using two different,
unreconciled conventions.

---

## 2. User stories

- As a **`maintainer`**, I run `quorum open` in my repository and get a URL I can open, so that the
  backlog board and mission control are reachable without me writing a process.
- As a **`maintainer`**, I press Ctrl-C and the daemon releases every live run through the same
  abandonment path a shutdown uses, so that stopping the UI never leaves a ticket locked.
- As an **`adopter`**, if the web app has not been built, I am told which directory was expected to
  hold it and what to run — before anything binds — rather than being handed a port that answers 404.
- As an **`adopter`** on a packed install, `quorum help` and every other command keep working, and
  `quorum open` tells me truthfully that this installation does not carry the daemon rather than
  claiming something it cannot establish.

---

## 3. The recommended cut, and why it is at the browser

**Recommendation: cut this ticket in two, at the browser spawn. OQ-2 is blocking and this is the
gate's to rule.**

The ticket calls the spawn ban *"the constraint that shapes it, and it is not the obvious one"*.
Measured, it is the constraint that **separates cleanly from everything else in the ticket**, which
is the opposite of shaping:

| | needs a spawn | needs a `core` symbol | needs the manifest edge | delivers |
| --- | --- | --- | --- | --- |
| the daemon half | no | no | yes | the UI is reachable |
| the browser half | yes | yes | no | the UI opens by itself |

A child that starts the daemon, serves the bundle and prints the URL touches `packages/cli` and one
manifest. It needs no `node:child_process`, no per-platform launcher table, no new `core` folder,
no new barrel name and no ruling against `04-architecture.md`'s principle 1.

**Splitting at the primitive instead is refused**, and the reason is a rule rather than taste:
`packages/core/src/index.ts`'s own header says a name is added to the barrel *"because a command
needs it rather than because its module exports it"* — Q-0092 withheld `manifestShapeError` and
Q-0093 withheld `currentBranch` on exactly that clause. A child that lands a browser primitive with
no command to use it violates the rule it would have to edit.

**Criteria are numbered continuously across the children** (Q-0103's practice), so a criterion keeps
its name if the gate moves the cut. **AC-1 to AC-11 are this ticket. AC-12 to AC-16 are the
successor, whose body is Appendix A, written out in full** so that the obligation cannot expire in
this document — the failure the plan records seven times.

If the gate refuses the split, this is one ticket of **sixteen** criteria, against a role ceiling of
fifteen, an eighteen that split Q-0013 and a twenty-one that split Q-0091 and Q-0096. Q-0122 was
accepted at twenty and spent three implement rounds. **Name the seam in the erratum if the split is
refused**, so the remedy on exhaustion is a second erratum promoting Appendix A out, not a fourth
round.

---

## 4. Acceptance criteria — this ticket (AC-1 to AC-11)

Each is independently testable. A *Test:* clause **bounds the instrument**: a reviewer may find that
the instrument fails the job the clause gives it, and may not raise the job — *"An adapter records
the version it was verified against"* (2026-09-08), erratum E-1, fifth instance.

### AC-1 — `open` is a registered command, and every derived register accepts it without a hand-written list

`COMMANDS` gains `'open'` **appended last, after `runs`**. Appending is the only position that
changes no existing relative order: `commands.ts`'s header records that every insertion since
Q-0090 has preserved `spike/bin/harness.js`'s header order, and that header has no `open` line to
insert against. `HELP` gains one line in the same position, in the existing two-column shape.
`packages/cli/src/index.ts` re-exports `./open.js`.

*Test:* `commands.test.ts:130`'s registry identity moves to nine names with a superseded-value
assertion added beside the existing ones, in the shape that file already uses
(`not.toStrictEqual([… the eight …])`, so a register that quietly shrinks back fails naming the
ticket it shrank past). `frame.source.test.ts:283`'s partition and `:313`'s derived barrel clause
pass **with no edit to either**, because both derive from `COMMANDS`; the partition's expected list
gains `open.ts` and one more superseded-value line.

### AC-2 — the command opens a project, starts the daemon, prints one URL, and does not return while it serves

`quorum open` resolves the project exactly as every other project-opening command does — through
`loadProject`, honouring `flags.project`, with `ProjectNotFoundError` rendered by
`packages/cli/src/fail.ts`'s existing `dieNoProject`, so the sentence a stranger sees is the one
Q-0111 made single. It starts the daemon with that project and the bundle root, prints **one** line
carrying the URL including the bind address, and then awaits a stop.

The bind address is `@quorum/server`'s and **no flag may move it**. The command declares no `--host`
and names none in its help.

*Test:* the command is driven in process against a real port with a temporary project and a
temporary bundle; a `GET /` over that port answers the bundle's `index.html` and `GET /project`
answers JSON. The printed line is asserted to contain `127.0.0.1` and the bound port, and the
package's own text is asserted to contain no `--host` and no second hostname literal.

### AC-3 — the bundle root is resolved relative to the module's own location, and `open.ts` is the second entry in `SELF_LOCATING` with its reason

The root is `new URL('../../../apps/web/dist/', import.meta.url)` or equivalent — relative to the
running module and to nothing else. Not `process.cwd()`, which answers the operator's directory, and
not an environment variable, which answers whatever was exported: `static.ts`'s header already rules
both out for the daemon and the same argument reaches the caller.

`SELF_LOCATING` gains `'open.ts'` with a one-sentence reason naming this criterion.

*Test:* the register's existing both-directions demonstration at `frame.source.test.ts:740` is
extended to the new entry — an entry permitting a self-location its module does not perform fails,
and a self-location with no entry fails. Separately, the resolved path is asserted **identical from
`src/` and from `dist/`**, by computing it from both module URLs, so the depth property is measured
rather than assumed.

### AC-4 — a directory holding no build refuses before anything binds, and the CLI composes the remedy

`serve` throws on a bundle root with no `index.html`. The command catches that one condition and
renders it as the frame's single red sentence and exit 1: the **condition** is `@quorum/server`'s
(`NO_BUNDLE_REMEDY` already carries no shell imperative), and any imperative a shell user reads is
composed in `packages/cli`. Nothing binds, no port is printed, and no browser is involved.

*Test:* the command is run against a directory that exists and holds no `index.html`; the process
exits 1, the output names the directory and the missing entry, and **no socket was opened** —
asserted by attempting a connection to the port that would have been used, or by asserting the
listener count, rather than by reading the message alone.

### AC-5 — the port has exactly one declared default, the dev server and the command agree on it, and a port in use refuses rather than drifting

The default is **7717**, declared in **one** place both readers can reach, and read by
`apps/web/vite.config.ts` and by `open.ts`. Recommended home: `@quorum/shared`, which is
declarations-only, is what `vite.config.ts` already imports from by source path for a measured
reason, and is the package `index.test.ts` keeps mechanically closed. `--port <n>` overrides it; the
daemon itself keeps no default and goes on binding what it is given.

A port already in use **refuses, naming the port**, and never silently selects another. The run-lock
precedent is the argument: *"a second run refuses and names the holder; it never waits"* — and here
the cost of drifting is concrete, because the dev proxy and any bookmarked URL both assume the
default.

*Test:* a single assertion reads the constant and the value `vite.config.ts` resolves, and requires
them equal — shown red by changing one. A second listener is opened on a port and the command is
asked for it; the process exits non-zero with the port in the message, and the message does not name
a different port.

### AC-6 — the daemon's lifetime is the command's, `close()` runs on a signal, and `SIGNAL_HANDLER_OWNER` gains one entry demonstrated both ways

`SIGINT` and `SIGTERM` close the daemon — `createDaemon`'s `close()`, which releases every live run
through the host's abandonment path and only then stops the socket. Handlers are installed when the
command starts serving and removed in a `finally`, never at module scope.

`SIGNAL_HANDLER_OWNER` becomes two entries, each carrying why.

*Test:* `frame.source.test.ts:846`'s clause is asserted over the two-entry register and `:852`'s
both-directions demonstration is extended: a third owner fails, and a register naming two owners is
not satisfied by a tree with one. `:871`'s runtime count — importing `./index.js` adds no listener —
is unchanged and must stay green, which is what proves the registration is not at module scope. The
close path is asserted by starting the command in process, delivering the signal, and requiring that
the host reports no running run and the socket refuses a connection afterwards.

### AC-7 — the manifest declares the daemon as an optional dependency, and the three silent registers stop being silent

`packages/cli/package.json` gains
`"optionalDependencies": { "@quorum/server": "workspace:*" }` — **not** `dependencies`, which
§0's row 1 measures as killing the packed install outright.

Three registers that currently say nothing about a third dependency key are made to say something:

- `packages/cli/src/package.test.ts:43` asserts the **whole dependency shape** — `dependencies`
  strictly equal to the two workspace names, `devDependencies` undefined, and `optionalDependencies`
  strictly equal to the one name, with a sentence saying why it is optional rather than required.
- `build.test.ts:2220`'s `workspaceDepsOf` reads optional edges too, so `:2444`'s register and the
  pnpm-rewrites-`workspace:*` loop under it cover the new edge. The register moves from
  `['cli', 'core']` to whatever the derivation then gives, **re-derived and not adjusted**.
- The packed manifest is asserted to carry the rewritten `0.0.0` for the optional edge, which is the
  fact AC-10's install rests on.

*Test:* each of the three is shown red against the manifest as it stands today and green after, and
the `workspaceDepsOf` widening is shown to change the derivation rather than to leave it identical.

### AC-8 — the import is dynamic, inside the handler, and clause D admits it by identity while still firing on anything else

`open.ts` reaches `@quorum/server` through `await import('@quorum/server')` **inside the command
handler**, never at module scope, so a packed install that skipped the optional dependency loads
every other command normally.

`cli-version.test.ts` clause D's dynamic-import assertion (`:306–309`) gains its **first** permitted
entry: a register of `file → reason`, on the `STATE_SITES`/`SELF_LOCATING` shape already used twice
in that file, rather than a relaxed predicate.

*Test:* the clause is shown to still fire — a second, unregistered dynamic import planted in a copy
of the corpus is reported by name — and the register is shown to fire the other way: an entry
permitting a dynamic import its module does not perform fails. The namespace half (`:302–305`) is
asserted **unchanged and still empty**, because §0.1 is the correction this criterion exists to
make durable.

### AC-9 — `test-discovery.test.ts` AC-13 is widened by identity, and the rule it states is narrowed rather than dropped

`namesTheDaemon` (`:337`) currently permits one occurrence in `packages/server/package.json` and
none anywhere else. It becomes: one occurrence in the daemon's own manifest as its `name`, and one
in `packages/cli/package.json` **under `optionalDependencies`** — the key checked, not merely the
count, because a count cannot tell the permitted edge from a required one.

*Test:* the hostile fixture at `:383` is kept and **still fails** — a `dependencies` edge from
`packages/cli` is reported by name — and a second fixture is added for the permitted optional edge.
The predicate is applied to real manifests and to fixtures through the same function, which is the
shape iteration 2 of Q-0125 adopted after reporting the opposite as a nit.

### AC-10 — the packed path keeps every command it had, and `quorum open` there says something true

Q-0098's fixture — *"the packed set installs outside the workspace with the registry dead, and
runs"* (`build.test.ts:2301`) — stays green with no change to `DISTRIBUTION`, and `quorum help`
works in the packed project.

`quorum open` in that project **refuses with a sentence that distinguishes what it knows from what
it does not**. It may say that this installation does not carry the daemon; it may **not** say the
daemon is missing, broken or not installed anywhere, and it may not present a failed load as proof
of absence. *"A probe that could not answer is not a negative"* (2026-09-10) and Q-0074/Q-0115 are
the authority, and the reason this criterion exists is stated in the ticket body: an install that
genuinely half-failed and an install working exactly as designed reach the same code path.

**The emit must be proven to load the module, not merely to contain it.** The ticket body records a
first probe that passed while proving nothing, because `main.ts` imported `open` without using it
and `tsc` elided the import.

*Test:* the packed fixture executes `quorum help` (exit 0, the nine-command help) and
`quorum open` (non-zero, the sentence above) **through the installed shim**, so the subject is the
emitted binary and not a source module. The sentence is asserted by its bytes against the literal
the CLI declares, so the two cannot drift. Separately, the workspace path is exercised through
`node packages/cli/dist/quorum.js open` with a temporary project and bundle, which is what proves
the emit loads the daemon rather than merely naming it.

### AC-11 — every document that promises this command is corrected, and nothing gains a claim the tree does not support

- `docs/04-architecture.md:251` — `quorum open` stops being one of three future commands and becomes
  shipped, with what it does and what it does not.
- `docs/04-architecture.md:336` — *"`@quorum/server`'s is consumed by nothing yet: it exists so that
  Q-0126's `quorum open` resolves to a file"* is now false in its first clause and true in its
  second; it moves to what happened.
- `docs/04-architecture.md`'s `packages/cli` section gains the sentence that this package now has a
  **conditional** consumer, and why the edge is optional.
- `docs/06-development-plan.md` — this ticket's bullet, and M3's done-when line, which is **half**
  satisfied: the daemon and browser half by this cut, the *"CLI and UI can both answer the same
  gate"* half by nothing here.
- `README.md`'s command table and `docs/USAGE.md`'s `## Commands` section each gain one entry, and
  **each states that the packed path does not carry the daemon**, because README's install section
  claims both paths work and a table listing a ninth command silently fails one of them
  (`product-context.md` quality pillar 7).

*Test:* `packages/shared/src/docs.test.ts` holds the README and USAGE command tables against
`COMMANDS` — derived, so a tenth command fails until it is documented — and the architecture
document's route/command sentences are checked against the registry the same way
`packages/server/src/package.test.ts` already checks its routes. Shown red by removing one entry.

---

## 5. Non-goals

1. **The browser.** AC-12 to AC-16, Appendix A — under the recommended cut.
2. **The other half of M3's done-when**, *"CLI and UI can both answer the same gate"*. This ticket
   makes the UI reachable; the gate screen is Q-0016's and nothing here widens
   `gateAnswerEnvelopeSchema`, whose three answers are closed by *What a run's event stream carries*
   (2026-08-28).
3. **The distribution ruling.** Whether `@quorum/server` or `@quorum/web` is ever packed is
   **Q-0124's**, deliberately left open by *"A fifth package emits, and `resolved` is not a synonym
   for `distributed`"* (2026-09-12). Nothing here changes `DISTRIBUTION`, `files`, `private` or
   `bin` on any package.
4. **Any screen.** `apps/web` fetches nothing today (`grep "fetch("` returns nothing under `src/`),
   so what this command makes reachable is the shell and its placeholders. Saying so is the point;
   fixing it is Q-0015 to Q-0018.
5. **Building the bundle.** `quorum open` does not run a build, invoke turbo, or shell out to a
   package manager. A command that builds is a second build system and a much larger surface; a
   missing bundle refuses with a remedy (AC-4).
6. **`--bundle <dir>`.** One way to find the bundle, for the reason `SELF_LOCATING` gives. An
   operator with a bundle somewhere else is Q-0124's case, not a flag here. (OQ-6.)
7. **`--host` and any non-loopback bind.** Refused by `BIND_HOSTNAME`'s own ruling, and restated
   here so nobody adds it as a convenience.
8. **Authentication, multi-user, a remote daemon, cloud sync** — v1 exclusions.
9. **Resumable runs after a daemon restart** — Q-0019.
10. **`quorum compile` and `quorum history`**, the two other commands `04-architecture.md:251`
    promises beside this one.

---

## 6. Open questions

**OQ-1 (BLOCKING) — the packaging shape.** Three answers, and the ticket's own measurement rules out
two of them:

- Row 1, `dependencies` + static import: the **packed install dies**, `ECONNREFUSED`, before any
  module loads. Refused by measurement.
- Row 2, `optionalDependencies` + static import: `quorum help` dies with `ERR_MODULE_NOT_FOUND`.
  Refused by measurement.
- Row 3, `optionalDependencies` + dynamic import: both paths keep working, and `quorum open` works
  on **one** of the two installation paths this repository claims.
- Row 4, hold for Q-0124: rule the distribution set first, ship the command on both paths, and owe
  no clause-D admission and no optional-dependency silence.

**Recommendation: row 3.** The ticket is p1 and owns a milestone done-when line; the change is
additive, and the honesty cost row 3 carries is closable by a criterion (AC-10) rather than
structural. Row 4 is the **end state** and row 3 does not foreclose it: when Q-0124 rules, the edge
becomes required, the import may become static, and the clause-D entry is deleted rather than
amended. What the gate is choosing is whether a p1 milestone line waits on a p2 `draft` ticket.

**OQ-2 (BLOCKING) — the split.** §3. Recommendation: split at the browser, eleven criteria here and
five in Appendix A.

**OQ-3 — a port already in use.** Refuse naming the port (recommended, run-lock precedent), or bind
0 and print whatever was given. Drifting breaks the dev proxy's assumption and any bookmark, and
`--port` is the escape hatch for two projects at once.

**OQ-4 — the exit code on a signal.** `exit.ts`'s table is closed at five and `run.ts` exits 130 on
an interrupted run. But Ctrl-C is the **documented way to stop `quorum open`**, so 130 reports an
interruption for the normal termination of a command whose whole job is to keep running.
Recommendation: **130**, on the convention every other tool follows and on the ground that widening
or re-interpreting a closed table is a decision this ticket should not take in passing. Worth one
sentence either way; it is the one question here where the answer is genuinely close.

**OQ-5 — where the port default is declared.** `@quorum/shared` (recommended), or declared in
`open.ts` with a test holding `vite.config.ts`'s literal against it. The first is one declaration;
the second is the transcription-plus-check shape `docs.test.ts` uses, which works but leaves two
numbers. Note that the shared home slightly promotes 7717 from *"a dev-server convention, not a
contract"* to a shipped default, which is what it is becoming either way.

**OQ-6 — `--bundle <dir>`.** Recommendation: no, per non-goal 6. Raised because it is the obvious
mitigation for AC-10's refusal and should be declined on the record rather than forgotten.

**OQ-7 — does `quorum open` report the runs the daemon can already back?** Q-0121 landed
`GET /runs`. Recommendation: no — the command prints one URL and a stop instruction. A second line
is a screen's job.

---

## 7. Gate obligations

**GO-1 (blocking, before a line of code) — a decision entry is owed on OQ-1.** It is owed for three
reasons, any one of which would be enough:

1. `optionalDependencies` is a **third dependency kind** in a workspace that has used two, and it
   makes a *silent skip* the normal case on a claimed installation path. This repository refuses
   that shape elsewhere by name.
2. `harness/product-context.md` quality pillar 7 states that **two installation paths are claimed
   and both work**. After this ticket one of them has a command that does not. A claim is moving, and
   `.claude/rules/docs-and-decisions.md` says an entry is what moves one.
3. Decisions 092 and 093 routed *how an installation outside the workspace obtains the UI or the
   daemon* to Q-0124 **explicitly**. Declaring the first consumer answers part of that question, and
   answering part of a question a landed entry deferred is not something to do silently.

The entry should state what an optional edge claims, what it refuses, and that it is provisional
against Q-0124 — so that ticket reads a ruling rather than an accident.

**GO-2 (blocking, before the run is launched) — the lockfile.** §0.3. The manifest edge and its
`pnpm-lock.yaml` update are landed **by the human, on `harness/Q-0126/integration`**, before the
chore run starts, together with AC-9's widening of `test-discovery.test.ts` so that branch is green.
Not on `main`, where AC-13 would be red until the merge — Q-0067 GO-2's precedent, the first time
this repository had to sequence a change against its own guard.

The alternative — granting `pnpm-lock.yaml` to `developer-generalist` — is a harness edit with
effects on every future chore ticket and should not be taken as a side effect of this one.

**GO-3 — OQ-2, the split**, and if it is refused, an erratum that names the seam in advance and says
that the remedy on exhaustion is a second erratum rather than a fourth round (Q-0122 E-1's shape).

**GO-4 — where the browser primitive lives** (the successor's, but the argument belongs to a gate).
`04-architecture.md`'s principle 1 enumerates `core`'s I/O as *"spawns CLIs, reads/writes the project
folder and git"*. A browser is none of the three, and `packages/core/src` is one folder per port
child (Q-0064), so a ninth folder is a visible act. Settle whether principle 1's list widens or
whether the primitive sits in an existing folder, before the successor runs.

**GO-5 — no glossary term is coined and none is owed.** *Daemon* is used throughout
`04-architecture.md` and appears in **Connection state**'s own text, and this ticket introduces no
new noun: the bundle root, the port and the lifetime all have names already. Recorded so it is not
re-litigated at the implement step. If the gate disagrees, the term lands **on the integration
branch** and not on `main`, for Q-0067 GO-2's reason and Q-0108's check.

**GO-6 — verification.** Forced in both environment rows (a worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge), `quorum lint`, the git-identity
sweep, and — because eight registers move — **each widened register shown red in both directions**
rather than observed green. A register widened and not demonstrated is the failure this repository
records most often.

---

## 8. Risks

**R-1 — the command works on one of the two paths this repository claims.** Stated rather than
mitigated: under OQ-1's recommended row 3, a packed install refuses `quorum open`. That is not a
regression, there being no `open` today, and the end state stays Q-0124's. AC-10 and AC-11 are what
keep it honest rather than hidden.

**R-2 — eight registers move, and a widened register is the shape this repository keeps getting
wrong.** Q-0107's rule applies throughout: *a guard shown red by its neighbour has not been
established*. Every widening in AC-7 to AC-9 names the clause it isolates.

**R-3 — the daemon has no authentication, and this command makes starting it a single word.** The
bind is loopback and not configurable, which is the whole of the defence. The risk is that a later
convenience flag erodes it; non-goal 7 and AC-2's assertion that the package names no second
hostname are the tripwires.

**R-4 — two ways to serve the same app.** A contributor running `vite dev` on 7717 and a
`quorum open` daemon on 7717 collide, and the two serve *different builds*. AC-5's refusal is what
turns that into a message instead of a mystery.

**R-5 — what the command reveals is a shell.** `apps/web` fetches nothing, so a `maintainer` who
runs this sees a rail, a theme and placeholders naming the tickets that will fill them. AC-11's
documentation entries should say what the UI does today, not what it will do.

**R-6 — a filtered build leaves no bundle.** `pnpm turbo run build` builds every emitter, but
`--filter=@quorum/cli` does not build `apps/web`, because no manifest edge orders them. AC-4's
refusal names the directory, which is the right failure; worth one sentence in USAGE.

**R-7 — `optionalDependencies` and `--frozen-lockfile` interact.** Beyond GO-2, a future
`pnpm install` in an environment configured to omit optional dependencies leaves a workspace where
`quorum open` refuses while everything else works. Acceptable and worth naming in the entry GO-1
asks for.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no credential, no key, no token. `frame.source.test.ts:911`'s `CREDENTIAL` scan covers `open.ts` automatically, being over every file the package carries. |
| **Worktree safety** | The command writes nothing to the user's working tree and creates no worktree, no branch and no run. It reads the project and a bundle directory, and serves. |
| **Gate behaviour** | Unchanged. The command starts no run, so it takes no **run lock** and answers no gate; the daemon's existing gate route is untouched and the three answers stay three. |
| **File format and schema** | No new persisted file, no new schema. The port constant, if it lands in `@quorum/shared` (OQ-5), is a declaration and adds no runtime behaviour there. |
| **Lint rules** | None added. `@typescript-eslint/no-deprecated` covers the new module as it covers every `packages/**/*.ts`. |
| **Cold-clone impact** | One command in the README table and one section in USAGE. No install-time cost in the workspace; the optional edge adds one workspace link and no download. The packed install's caveat is AC-11's to state. |
| **Product boundaries** | The command is `quorum open`; nothing calls the product a harness and nothing renames the `harness/` folder. |
| **Flow route** | `requirements` → `chore`. Nothing here changes a flow or an engine module a run loads at start, so the run can benefit from its own change — unlike Q-0083, Q-0086 to Q-0089 and Q-0117. GO-2 is the one thing that must happen outside it. |

---

## Appendix A — the successor, written out in full

*Transcribed here rather than referenced, because an obligation recorded only inside a closed
ticket's prose is one that quietly expires — the failure `docs/06-development-plan.md` records for
Q-0100's, Q-0110's, Q-0111's and Q-0112's obligations. If the gate refuses the split, these become
AC-12 to AC-16 of this ticket and this appendix is promoted by erratum. If it accepts, this is the
successor's body.*

### Q-01xx — `quorum open` opens a browser

**Depends on Q-0126**, strictly: there is no URL to open until the daemon starts.

**The gap.** Q-0126 prints a URL a human pastes. M3's done-when says *"starts daemon + browser"*.

**The constraint.** `packages/cli/src/frame.source.test.ts:599` refuses `node:child_process` in
**every** production module of that package, with the stated reasoning that *"every read and every
spawn goes through `@quorum/core`"*. Opening a browser is a spawn — `open` on darwin, `xdg-open` on
Linux, `start` on Windows — so the launcher cannot live in `packages/cli` at all. Q-0093's precedent
is exact: `init`'s scaffolding became `core/backlog/scaffold.ts` for this rule, and the command kept
one expression.

**What it must decide first (GO-4 above).** `04-architecture.md`'s principle 1 enumerates `core`'s
I/O as *"spawns CLIs, reads/writes the project folder and git"*. A browser launcher is none of those.
Either principle 1 widens — which is a decision entry — or the primitive sits in an existing folder
and the argument for which one is written down. `core` already spawns at
`packages/core/src/adapters/exec.ts` and `packages/core/src/fanout/fanout.ts`, so there is a house
style to follow; `packages/core/src` being one folder per port child (Q-0064) means a ninth folder
is a visible act rather than a tidy-up.

**AC-12** — `core` gains exactly one exported primitive that opens a URL in the platform's default
browser, and it is the only place in the workspace that spawns for that purpose. The per-platform
command is a table, not a chain of conditionals, and the platform it cannot serve is a state rather
than a crash. *Test:* the table is asserted per platform over an injected spawner, and a
whole-workspace scan finds no second site launching a browser.

**AC-13** — its result is drawn from a **closed set**, and a launcher that failed is never rendered
as an answer it did not give. The primitive cannot observe whether a browser opened: it knows what it
spawned and what that process exited with, and nothing more. So `opened` may not mean *a browser is
showing this page*, and a non-zero exit may not be reported as *there is no browser*. This is
containment's, push lag's and verified version's discipline at a fourth subject, and it is *"A probe
that could not answer is not a negative"* (2026-09-10) at the site Q-0074 and Q-0115 spent two
tickets removing instances of. *Test:* each state is produced over an injected spawner and asserted
by name; a spawner that throws produces the *could not tell* member and never the negative one.

**AC-14** — `packages/cli` still spawns nothing. `IO_MODULE` is unchanged, `open.ts` appears in no
exemption, and `frame.source.test.ts:599` passes without an edit. *Test:* the clause's existing
subject demonstration at `:606` is unchanged and the register is asserted to have gained no entry.

**AC-15** — `--no-open` serves without launching, and the URL is printed either way, so the line
Q-0126 added is never conditional on a browser. Whether opening is the default is the ticket's to
rule; the argument for defaulting to open is that the command's name says so, and the argument
against is that an SSH session is a common case with no display. *Test:* both invocations are driven
against an injected spawner; the URL line is byte-identical in both, and exactly one of them spawns.

**AC-16** — the barrel gains the name by the rule it states (a command needs it), `@quorum/core`'s
export count moves with a sentence, `04-architecture.md`'s principle 1 says what it now says, and
the decision entry GO-4 asks for is landed before a line of code.

**Non-goals**: a browser chooser, a `--browser <cmd>` flag, remote display forwarding, and any
attempt to detect whether a browser actually rendered the page.
