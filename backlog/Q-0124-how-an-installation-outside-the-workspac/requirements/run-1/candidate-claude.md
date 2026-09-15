# Q-0124 — How an installation outside the workspace obtains the UI

*Requirements, run 1, 2026-09-15. Every measurement below was taken against the tree at this
session's tip rather than transcribed from the ticket body; where the two disagree, §0 says so and
the criteria follow the measurement.*

---

## 0. What was measured, and where the ticket body is wrong

The body carries a block headed *"Measured 2026-09-15, after Q-0125 and Q-0126 both landed"*. Its
claims were re-run. **Four hold, and eight do not** — and the class is the same in almost every case,
this repository's most-recorded one: a direct enumeration standing in for a transitive walk, or a
register named by its most visible member rather than by its shape.

### 0.1 What holds

- The manifest table is exact. `apps/web` is `private: true` with no `files` and no `exports`;
  `packages/server` is `private: true` with no `files` and an `exports` map; `packages/cli` carries
  `@quorum/core` and `@quorum/shared` under `dependencies`, `@quorum/server` under
  `optionalDependencies`, and `files: ["dist", "templates"]`.
- `apps/web/dist` is **316 K in 3 files** and `packages/server/dist` is **176 K in 22 files**.
- **`build.test.ts`'s census permits a cross-package asset copy.** The body's correction of its own
  earlier claim is right: `:582`'s clause filters writes against *every emitting package's own*
  `dist/`, so a copy into `packages/cli/dist/web/` is inside a permitted prefix.
- **`private: true` is orthogonal to local distribution, and the proof is stronger than the hand
  check the body cites.** All three packages distributed today carry `private: true`, and
  `build.test.ts`'s packed fixture packs all three with `pnpm pack` on every CI run. The property is
  already under test; it does not rest on one `pnpm pack --dir packages/core` at a gate.

### 0.2 What does not hold

**(a) The daemon's install closure is 3.4 MB across four packages, not 1.7 MB across three.**
The body walks `packages/server`'s three direct dependencies and stops. `@hono/node-ws` depends on
`ws`, which the fixture's own `collect` *does* walk:

| package | size | files |
| --- | --- | --- |
| `hono` | 2.8 M | 568 |
| `@hono/node-server` | 376 K | 55 |
| `@hono/node-ws` | 60 K | 10 |
| **`ws`** (transitive) | 196 K | 19 |
| **total** | **≈ 3.4 MB** | **652** |

**(b) `apps/web`'s closure is three packages, not two** — `react-dom` depends on `scheduler`
(120 K, 15 files). The 8.2 MB total is right; the count is not, and the count is what the mirror
loops over.

**(c) Three emitted-byte figures are stale.** `packages/cli/dist` is **256 K** (body: 220 K) and
`packages/core/dist` is **696 K** (body: 680 K); `@quorum/shared` is 216 K as stated. The derived
figure the body offers — *"+492 K on ~1.1 M"* — is arithmetically right and rests on two wrong
addends. Today's distributed emit is **1,168 K**; the five-package emit is **1,660 K**.

**(d) The react demotion is one package too narrow. `@quorum/web`'s runtime dependency set becomes
empty.** The body rules that `react` and `react-dom` move to `devDependencies`. Measured, the served
bundle contains **zero** bare `from '…'` specifiers and **zero** occurrences of the string
`@quorum/shared` — so `@quorum/shared` is build-time-only for the tarball by exactly the argument the
body makes for React. A distributed `@quorum/web` that keeps it under `dependencies` would oblige npm
to resolve a sibling tarball for a bundle that does not read it.

**(e) `DISTRIBUTION` is not "the one list to move", and the reason is structural.** Five helpers in
`build.test.ts` turn a register entry into a directory with `path.join(WORKSPACE, 'packages', name)`
— the pack loop, the packer-agreement loop, `manifestOf`, `versionOf` and `workspaceDepsOf`.
**`apps/web` is not under `packages/`.** An entry `'web'` resolves to `packages/web`, which does not
exist, so the register must carry a *path* per member rather than a bare name. This is the likeliest
place a wrong implementation passes vacuously, and is why AC-8 exists separately.

**(f) `@quorum/cli#build` already depends on `@quorum/server#build`.** Turbo's topological edges
include `optionalDependencies`, measured from `turbo run build --dry`:

```
@quorum/cli#build     deps: ["@quorum/core#build", "@quorum/server#build", "@quorum/shared#build"]
@quorum/web#build     deps: ["@quorum/shared#build"]
```

So **no build-ordering work is owed for the daemon**, which the body does not say and which a reader
would otherwise budget for. `@quorum/cli#build` does *not* depend on `@quorum/web#build` — that edge
arrives with AC-4's manifest change and is what makes AC-14's documentation correction necessary.

**(g) Neither new distribution member declares a `license`.** `@quorum/cli`, `@quorum/core` and
`@quorum/shared` each carry `Apache-2.0`; `@quorum/server` and `apps/web` carry none. A tarball is
where that field starts mattering.

**(h) Two line citations send a reader to the wrong assertion.** The packed refusal is
`build.test.ts:2461–2462`. **`:2482` is the *damaged daemon* case**, not the workspace one — the
workspace assertion (*"the workspace emit failed to resolve the daemon"*) is **`:2134`**, inside the
Q-0126 AC-8 block.

### 0.3 The clause-D citation is right, and is worth locating precisely

The body's *"`cli-version.test.ts`'s clause-D register"* is correct. The register is
`DEFERRED_SPECIFIER` and its one entry is `packages/cli/src/open.ts`. It lives in
**`packages/core/src/adapters/cli-version.test.ts`** — in `core`, not in `cli`, which is where a
reader will look first. What the body does not record, and what makes the register self-closing, is
that `deferredOffenders` fires in **both** directions: an unregistered dynamic import is reported,
*and* so is `its entry permits a deferred specifier the module does not use`. So the register cannot
be left behind if the import becomes static, and cannot be deleted if it does not. That is the whole
of OQ-1.

---

## 1. Problem

**In the `adopter`'s words.** *"I installed Quorum into my project the way the README told me to —
three tarballs — and the first thing the docs show me is a web app I cannot open. `quorum open` says
`@quorum/server did not resolve from this installation`. It is a true sentence and it does not help
me: I did what the README said, and the product's own mission control is not in what it shipped
me."*

**In the `maintainer`'s words.** *"Two packages emit and neither is packed. I ruled that a deliberate
gap twice — decision 092 on the UI and decision 093 on the daemon — and both entries routed the
question here by name. Q-0126 then shipped a command that has to apologise for it on one of the two
installation paths this repository claims. The apology is correct, and it is the third artefact in a
row built on an unanswered question."*

**Mechanically.** The **local distribution set** is three tarballs — `@quorum/shared`,
`@quorum/core`, `@quorum/cli` — and the **emitting set** is five. `apps/web` and `packages/server`
are the difference. `@quorum/cli` reaches the daemon through `optionalDependencies` plus a dynamic
import, which keeps the packed install *working* at the price of one command that cannot run there;
and `open.ts` finds the bundle at `new URL('../../../apps/web/dist/', import.meta.url)`, which from
`node_modules/@quorum/cli/dist/` resolves to `node_modules/apps/web/dist` — a path with no meaning,
which is why that module's refusal order puts the bundle check last.

**The maintainer ruled the answer at the gate on 2026-09-15: tarballs four and five.** This document
implements that ruling. It does not re-open it, and §7 records the alternative it displaces and why,
because a requirement that does not say what was refused invites the next reader to re-derive it.

---

## 2. User stories

- **As the `adopter`**, I install Quorum into my own project from a local pack and run
  `quorum open`, and a browser shows me mission control — so that the packed path and the
  workspace-local path are the same product, and the README's install section does not have a
  footnote attached to it.
- **As the `maintainer`**, I have one ruling that covers both packages that emit and are not
  distributed, so that the next emitter inherits a decided rule rather than a third instance of an
  open question.
- **As the `contributor`**, I read one register that says what is packed and one that says what
  emits, and after this change they name the same five — so that *"emits"* and *"ships"* stop being
  two facts I have to hold apart while reading five files.

---

## 3. Surfaces

**CLI** (`packages/cli` — manifest, `open.ts`, `build.test.ts`'s packed fixture),
**`apps/web`** and **`packages/server`** (manifests only; no source in either changes),
`packages/core` (`cli-version.test.ts`'s clause-D register, `test-discovery.test.ts`'s comment,
`turbo-inputs.test.ts`'s two `NOT_READ` rows), and the documents: `docs/04-architecture.md`,
`docs/GLOSSARY.md`, `harness/product-context.md`, `README.md`, `docs/USAGE.md`, plus
`packages/shared/src/docs.test.ts`'s registers over them.

**No daemon route, no browser source and no flow file changes.**

---

## 4. Gate obligations

These are the human's and are settled **before** the implement step runs. Each is here rather than as
a criterion because no step on the chore route may perform it.

**GO-1 — the decision entry lands first.** It is `developer-generalist`-forbidden work, and AC-1 to
AC-15 are unsatisfiable without it because several of them invert assertions whose authority comments
cite decisions 092, 093 and 094 by title. It must rule, in this order:

1. **The local distribution set is five, and it is the emitting set again.** Naming *"A fourth
   package emits, and what it emits is served rather than shipped"* (2026-09-12) and *"A fifth
   package emits, and `resolved` is not a synonym for `distributed`"* (2026-09-12) as the entries
   whose open question it closes. Neither is edited. **The vocabulary that separated *resolved* from
   *distributed* is not withdrawn**: the two axes stay independent and merely coincide again, which
   is the state 092 was written under and which is exactly what made its first wording go false. An
   entry saying *"the distinction was temporary"* would re-create the defect 093 removed.
2. **It supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14)**,
   which names this ticket and this act in its own clause 4. The exemption that entry authorises —
   `DEFERRED_SPECIFIER`'s one row — is **deleted, not widened**, and the entry says whether the
   import becomes static (see OQ-1, which this entry answers).
3. **`react`, `react-dom` and `@quorum/shared` become `devDependencies` of `@quorum/web`**, on the
   measured ground that *what a bundle contains* and *what npm must install beside a tarball* select
   **opposite** sets for a self-contained bundle. The entry states the evidence — zero bare
   specifiers in the emitted bundle — rather than the conclusion, because the rule it replaces is
   also correct under its own framing and a reader meeting only the conclusion will restore it.
4. **`private: true` stays on all five**, with the reason written down: `pnpm pack` does not refuse a
   private package and only `npm publish` does, so local distribution and publication are different
   acts. **078(d)'s refusal of registry-resolved `npx quorum` is untouched and Q-0029 stays in M6.**
   This clause exists so that a later reader does not read *distributed* as *published*.
5. **What a distributed-but-unpublished package owes**: `files`, a `license`, and nothing else — the
   class 093 clause 3 created for the opposite case, stated for this one.

**GO-2 — OQ-1 is ruled at this gate and written into the ticket body**, not left for an implementer.
It changes AC-7, AC-10 and AC-11, and it is the one question in this document whose two answers
produce different products.

**GO-3 — the successor for `resolvesOwnLocation`** (OQ-3) is opened as a ticket at this gate if the
ruling is that the predicate widens, on Q-0113's and Q-0114's precedent: an obligation recorded only
in this document's prose is one that three tickets have already been lost to this month.

**GO-4 — verification in both environment rows**, forced, per Q-0072's closing finding: the implement
worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge. CI
green on the merged commit, because AC-10's fixture is the criterion this ticket turns on and it has
failed on CI while passing locally before (Q-0104).

---

## 5. Acceptance criteria

*Fifteen. Each `Test:` clause bounds the instrument: a reviewer may find that the instrument fails
the job the clause gives it, and may not raise the job (Q-0067 E-1).*

---

### AC-1 — `apps/web` declares what a tarball needs, and nothing more

`apps/web/package.json` gains `files: ["dist"]`, a `license` of `Apache-2.0`, and an `exports` map
that makes the built bundle resolvable by package name (shape ruled by OQ-2). It keeps
`private: true`. It declares no `main`, no `types` and no `bin`.

**Test:** `apps/web/test/package.test.ts`'s block *"and it emits without being distributed — no
exports, files, main, types or bin"* is **inverted rather than deleted**, and its authority comment
replaced with a citation of GO-1's entry. The loop asserting five keys absent becomes one asserting
`exports` and `files` present and `main`, `types` and `bin` absent, with `private` still `true`.
Shown red in **both** directions over a fixture: the manifest as it stood before this ticket must
fail the new block, and the new manifest must fail the old one — because the cheapest wrong
implementation of this criterion is deleting the clauses that now fail, and that is indistinguishable
from the right one without the pair.

---

### AC-2 — `@quorum/web` has no runtime dependency, and the bundle is why

`react`, `react-dom` and `@quorum/shared` move to `devDependencies`. `dependencies` is absent or
empty. `JUSTIFICATIONS` keeps one entry per declared package, as it does today.

**Test:** three parts, because the claim has three halves and only one of them is a manifest read.

(a) The manifest: `dependencies` is empty or absent and the three names appear under
`devDependencies`. The existing test *"the two that ship to a browser are dependencies, and the
build-time ones are not"* is **rewritten rather than deleted**, and its comment states the measured
reason — *what npm must install beside a tarball*, not *what the bundle contains*.

(b) The evidence, asserted over the **emitted bundle** rather than argued: the built
`apps/web/dist/assets/*.js` carries no bare import specifier — nothing matching `from '<name>'` where
`<name>` does not begin with `.` or `/` — and no occurrence of `@quorum/shared`. The needle must be
shown to discriminate: the same scan over a fixture string containing `from 'react'` finds it.

(c) The build graph survives the demotion: `turbo run build --dry` still reports `@quorum/web#build`
depending on `@quorum/shared#build`. **Measured after the move rather than assumed** — turbo's
topological edges are documented to include `devDependencies`, and this criterion is where that is
established rather than relied on.

---

### AC-3 — `packages/server` declares what a tarball needs

`packages/server/package.json` gains `files: ["dist"]` and a `license` of `Apache-2.0`, keeps
`private: true` and its existing `exports` map, and declares no `main`, `types` or `bin`.

**Test:** `packages/server/src/package.test.ts`'s `emitsAndIsNotDistributed` invariant is the
subject. Two of its seven clauses invert — `files` is now required rather than forbidden — and the
predicate is **renamed to what it now asserts**, because a function called `emitsAndIsNotDistributed`
returning `[]` for a distributed package is a name that lies. The existing both-directions
demonstration is kept and re-aimed: the pre-Q-0125 fixture must still fail the emission half by name,
and a fixture with `files` removed must now fail the distribution half by name. **Deleting the two
clauses that fail is the wrong implementation and must be distinguishable from the right one**, which
is what the fixture pair is for.

---

### AC-4 — `@quorum/cli` requires the daemon and declares the web app

`@quorum/server` moves from `optionalDependencies` to `dependencies`. `@quorum/web` is added to
`dependencies` — without which `import.meta.resolve` in AC-5 cannot answer. `optionalDependencies` is
removed entirely.

**Test:** `packages/cli/src/package.test.ts`'s Q-0126 AC-7 block moves. Three assertions, each
separately red before the change:

(a) `dependencies` is exactly `{'@quorum/core', '@quorum/server', '@quorum/shared', '@quorum/web'}`
with `workspace:*` ranges;
(b) `optionalDependencies` is `undefined` and `devDependencies` stays `undefined`;
(c) the key-set derivation — `Object.keys(own).filter(k => k.toLowerCase().endsWith('dependencies'))`
— becomes `['dependencies']`, so a fourth section still cannot arrive unremarked. That derivation is
kept rather than replaced by three literal checks: it is the clause Q-0126 added precisely because an
optional edge had been invisible to a strict read of `dependencies` alone.

And `turbo run build --dry` reports `@quorum/cli#build` now depending on `@quorum/web#build` —
asserted, because it is the fact AC-14(d)'s documentation correction rests on.

---

### AC-5 — `quorum open` finds the bundle by package name, and one expression answers both installations

`packages/cli/src/open.ts` replaces `new URL('../../../apps/web/dist/', import.meta.url)` with a
resolution through `import.meta.resolve` against `@quorum/web`, yielding a `URL` handed to
`ServeOptions.bundle` unconverted. `packages/cli` imports no `node:url`, so `fileURLToPath` is not
available and `.pathname` is not a substitute — the `string | URL` seam Q-0126 widened is what carries
it.

**Test:** three parts.

(a) **Both installations, by execution rather than by reading.** In the workspace, a plain `node`
process running the built `packages/cli/dist/quorum.js` reaches the daemon and the bundle; in the
packed fixture (AC-10) the same emit resolves `node_modules/@quorum/web/dist/`. One expression
answers both, which is the property the old relative path did not have and which no unit test of the
expression alone establishes.

(b) **A missing build still refuses with `packages/server`'s own sentence**, naming a directory that
exists in the installation the reader is standing in. `import.meta.resolve` answers from the manifest
without the target existing, so the bundle refusal (`NO_BUNDLE_CODE`) stays reachable; asserted by
running `quorum open` against an installation whose `@quorum/web/dist` has been removed, and checking
that the named directory is inside that installation and not `node_modules/apps/web`.

(c) The refusal **order** is re-examined and its docblock corrected. The order is ruled today as
daemon → project → bundle *because* the bundle path was meaningless on a packed install. That reason
goes. The order may stay; the stated reason may not, because a docblock giving a reason that has
stopped being true is the defect this repository has recorded most often.

---

### AC-6 — the self-location registers move deliberately, in both directions

`frame.source.test.ts`'s `resolvesOwnLocation` matches `import.meta.(url|dirname|filename)` and
**does not match `import.meta.resolve`**. So after AC-5 `open.ts` silently leaves `SELF_LOCATING` —
and that register fires in both directions (`its entry permits … the module does not`), so the entry
must be removed or the suite is red.

**Test:** `SELF_LOCATING` is `{'init.ts': …}` again, and the assertion that it is *not* `['init.ts']`
— added by Q-0126 to refuse the superseded value — is inverted with its own comment naming the ticket
that moved it back, in the shape every superseded register in that file already takes. The removal is
shown to be **forced rather than tidy**: with the entry left in place, `locationOffenders` reports
`open.ts: its entry permits a self-location the module does not perform`, demonstrated.

Whether `resolvesOwnLocation` *widens* to see `import.meta.resolve` is **OQ-3** and is not decided
here.

---

### AC-7 — the daemon specifier stops being deferred, and the register that permitted it goes

*(Written for OQ-1's recommended answer. If the gate rules the other way, this criterion is replaced
by the alternative stated below.)*

`open.ts` imports `@quorum/server` statically. `daemon()`, `isDaemonUnresolved`,
`NO_DAEMON_CONDITION` and `NO_DAEMON_REMEDY` are deleted with their tests.
`cli-version.test.ts`'s `DEFERRED_SPECIFIER` register is deleted and clause D returns to
`toStrictEqual([])` with no register and no exemption — the state decision 094 clause 5 describes as
the one it departed from.

**Test:** `build.test.ts`'s Q-0126 AC-8 block **inverts**: the emitted `open.js` must now carry a
static `from '@quorum/server'` and must not carry `import('@quorum/server')`. Both needles keep their
existing discrimination checks, which already exist and already pass over planted fixtures. And
clause D's both-directions demonstration is kept: a planted dynamic import in any production module
of `packages/core/src` or `packages/cli/src` is still reported by name, so deleting the register is
shown to be a **return to a stricter rule** rather than a relaxation.

**The alternative, if the gate rules the import stays dynamic:** `DEFERRED_SPECIFIER` keeps its one
entry, its authority line is rewritten to cite GO-1's entry rather than 094 — which is superseded —
and the entry states the *new* reason for deferral (startup cost, not resolvability). AC-10's refusal
assertions are then deleted rather than inverted, because a refusal for an unresolvable *required*
dependency has no reachable subject. **The one thing that may not happen is the entry being left
citing a superseded decision.**

---

### AC-8 — `DISTRIBUTION` is five, and carries a path per member across both workspace roots

`build.test.ts`'s register becomes five members, and every helper that turns a member into a
directory derives it from the register rather than from `path.join(WORKSPACE, 'packages', name)`. The
five are the pack loop, the packer-agreement loop, `manifestOf`, `versionOf` and `workspaceDepsOf`.
`DECLARED_FILES` gains the two new members: `web: ['dist']`, `server: ['dist']`.

**Test:** the register is shown to be **root-aware rather than name-keyed**, by the failure it
produces rather than by inspection: a member whose recorded root is wrong must fail naming that member
and that path, not with `ENOENT` from inside `JSON.parse`. And the derivation is shown not to have
quietly narrowed — `dependents` (the members declaring a workspace dependency) is re-derived and
asserted as an identity, which after AC-2 and AC-4 is `['cli', 'core', 'server']` and no longer
includes `web`, `@quorum/shared` having moved to `devDependencies`.

---

### AC-9 — the offline mirror covers the widened closure, and says what it covered

The packed fixture's third-party closure grows by the daemon's four packages. The existing
per-package completeness guard — which compares a mirrored tarball's entry count against the
installed tree's file count and names the package on a shortfall — must cover them.

**Test:** the closure the fixture's own `collect` produces is asserted as an **identity**, not a
count (Q-0073): `['@hono/node-server', '@hono/node-ws', 'ajv', 'ajv-formats', 'hono', 'ws', 'yaml',
'zod']`. `ws` is named explicitly, because it is reached only transitively and is the package the
ticket body's own walk missed. The measured delta is recorded in the fixture's comment: **+3.4 MB and
+652 files on a 9.9 MB / 1,432-file mirror**, and that `apps/web` contributes **nothing** — which is
AC-2's measured payoff and the number that says why the demotion belongs to this ticket rather than
being a tidy-up.

---

### AC-10 — the packed install carries the UI, and `quorum open` serves a page there

The fixture packs and installs **five** tarballs together, and `quorum open` in that installation
starts, binds and serves the shell.

**Test:** the assertions at `build.test.ts:2461–2462` — that the packed `quorum open` refuses with
`NO_DAEMON_CONDITION` and `NO_DAEMON_REMEDY` — **invert to a positive**, and the positive is a served
page rather than an exit code: the command is started on an ephemeral port (`--port 0`, which `serve`
already supports) with `--no-open`, and `GET /` over the real socket answers **200 `text/html`**
carrying the shell. An existence check on `node_modules/@quorum/web/dist` is explicitly **not**
sufficient — it is the assertion that would pass over a tarball shipping an empty directory, which is
the failure Q-0093 AC-5(d) exists to prevent at the neighbouring site.

The **damaged-daemon** assertion at `:2482` is re-aimed rather than deleted: with a required
dependency, a daemon that resolves and then fails is still a real state, and what must hold is that
its own error reaches the operator rather than being rendered as a packaging sentence. Under OQ-1's
recommended answer that failure now kills every command rather than one, which is R-5 and is stated
in the fixture's comment rather than discovered later.

---

### AC-11 — every other command in the packed install is unchanged

`quorum help` prints the ten-entry command list, `quorum init` scaffolds all twenty template files,
and the shim still resolves inside the temporary project rather than back into the repository.

**Test:** the existing assertions are kept **unaltered** and are the regression guard, not new work.
This criterion exists because decision 094's *Alternatives considered* refused the required edge
precisely on the ground that it breaks `quorum help` and `quorum init` in a packed install — that
refusal is voided by shipping the daemon, and this criterion proves the voiding rather than assuming
it. Under OQ-1's recommended answer, `quorum help` now loads `@quorum/server` on every invocation;
AC-15(4) measures what that costs.

---

### AC-12 — the emitting set and the distribution set are the same five, in every register naming either

`test-discovery.test.ts`'s Q-0097 AC-13 comment — *"The emitting set is five and the local
distribution set is three, and TWO packages are now the difference rather than one"* — and
`turbo-inputs.test.ts`'s `NOT_READ` rows for `apps/web` and `packages/server`, each of which states
that its subject is *"NOT distributed"*, are corrected.

**Test:** the assertion that `emittingPackages()` is `['apps/web', 'packages/cli', 'packages/core',
'packages/server', 'packages/shared']` is **unchanged** — this ticket adds no emitter — and the
comments beside it are held against the register they describe. The `stubs` anti-vacuity clause is
re-checked and reported: it stands at **two** (`packages/compiler`, `packages/templates`), which that
file's own comment already names as the smallest it has been, and this ticket does not move it.

---

### AC-13 — the numbered documents and the glossary state five and five, and the historical sentences are untouched

`docs/04-architecture.md`'s three count-bearing sites and `docs/GLOSSARY.md`'s **Emitted artifact**
entry move. The sentences that go false are precisely: *"the local distribution set is the first
three"*, *"`@quorum/web` and `@quorum/server` are the difference"*, and *"how an installation outside
this workspace obtains the UI **or the daemon** is an open question"*. The definitions of *resolved*
and *served* are **not** touched: they are defined by mechanism since 093, and this ticket changes
neither mechanism.

**Test:** `docs.test.ts`'s `LIVE` / `SUPERSEDED` / `HISTORICAL` triple is extended in the shape it
already has. Every sentence stating the old split goes into `SUPERSEDED`, with its negative shown to
have a subject against a fixture reproducing today's text; every new sentence goes into `LIVE`; and
`HISTORICAL` gains nothing but is re-run, so **a blanket find-and-replace over "three" fails as
loudly as an omission** — decisions 092 and 093 are append-only and must still read as they do.

---

### AC-14 — `README.md` and `docs/USAGE.md` describe the install a stranger will actually perform

Four corrections, and the fourth is the one no existing register would have caught:

(a) `README.md`'s *"As a packed install, into another project"* block: **five** tarballs, and its
`for p in shared core cli` loop rewritten to cover both workspace roots.
(b) `README.md`'s paragraph beginning *"`quorum open` works from the workspace and not from a packed
install"* is **deleted**, not softened.
(c) `docs/USAGE.md` §`quorum open`'s paragraph *"It works from the workspace and not from a packed
install"* is deleted, and the two sentences routing the question to Q-0124 with it.
(d) **`docs/USAGE.md` §`quorum open` says *"`--filter=@quorum/cli` does not build the web app, and
this is the failure that looks like"*. AC-4 makes that false**, because `@quorum/cli#build` gains a
`^build` edge to `@quorum/web#build`. The sentence is corrected rather than removed — the advice it
gives is still needed, and its example is now the opposite way round.

`harness/product-context.md`'s quality pillar 7 moves in the same change: the named `quorum open`
exception decision 094 clause 3 added is **deleted**, the distribution set becomes five, and the
sentence *"How an installation outside this repository obtains the UI or the daemon is Q-0124's and
is open"* is replaced by the answer.

**Test:** `docs.test.ts` holds the tarball count in `README.md` against `DISTRIBUTION`'s size rather
than against a literal, and the pillar-7 clause against the same register — so a sixth distributed
package fails until both documents move. Pillar 7 matters most of the four and is asserted first: it
is fed to every product-manager step at run time, which is Q-0098's finding and the reason a false
installation claim there is one every future requirement inherits.

---

### AC-15 — the cold-clone cost is re-derived, recorded, and compared against M6's budget

Four figures, measured after the change rather than predicted, recorded where the next reader meets
them:

1. **Emitted bytes** now distributed: today 1,168 K across three, after this 1,660 K across five.
2. **The offline mirror's growth**: +3.4 MB and +652 files (AC-9).
3. **The packed install's wall-clock**, against Q-0014's measured cold-store baseline — that ticket
   measured the app's *dependencies* doubling a cold store to 10.4 s and +50 MB, and this ticket ships
   **none** of them, which is the comparison worth making.
4. **`quorum help`'s startup, before and after**, if OQ-1 rules the import static — because `main.ts`
   loads every command module, so a static daemon import is paid on every invocation. This is the one
   figure that can argue OQ-1 back the other way, and it is measured rather than reasoned about.

**Test:** recorded in the ticket's implement report and in `build.test.ts`'s fixture comments beside
the figures they supersede, in the shape Q-0125 used for its three re-measured budgets — **the old
number kept beside the new one**, so the movement is visible rather than silent. No criterion asserts
a byte count or a duration: Q-0096 E-1 and Q-0098 E-1 each retired a count assertion here for the same
reason, and re-introducing one is the mistake those errata exist to prevent.

---

## 6. Non-goals

1. **Registry publication.** `npx quorum` from a public registry stays refused while every package is
   `private: true`; it is Q-0029's, in M6, per decision 078(d). *Distributed* here means *locally
   packed and installed*, and GO-1 clause 4 exists so the two are never read as one.
2. **Dropping `private: true` from any package.** Measured: `pnpm pack` does not refuse a private
   package, and all three currently distributed packages are private and pack on every CI run.
3. **The cross-package asset copy** — `@quorum/cli` carrying `apps/web/dist` beside its templates.
   Displaced by the gate ruling; §7 records what it would have cost.
4. **Tracking a built bundle in git.** It contradicts **Emitted artifact**'s *"gitignored and
   reproducible from the commit"*, and the Q-0093 templates precedent does not transfer:
   `packages/cli/templates/` is twenty *tracked source* files and `apps/web/dist` is gitignored
   output.
5. **A `--bundle` flag, or any second way for an operator to find the bundle.** Q-0126 non-goal 6, and
   AC-5 keeps the number of ways at one.
6. **Any change to the daemon's routes, the browser's source, the shell's screens or a flow file.**
   The screens are Q-0015 to Q-0018.
7. **Q-0123** — the run-host record that is never released. Different subject, still p3.
8. **Windows.** `openUrl` names it `unsupported` explicitly and this ticket does not revisit it.
9. **Making `@quorum/web` importable as a module.** Its `exports` map exists to make a *path*
   resolvable; nothing imports the bundle, and AC-1 does not add a `"."` entry.

---

## 7. The alternative the gate displaced, recorded rather than dropped

**The cross-package copy — `@quorum/cli#build` copies `apps/web/dist` into its own `dist/`.** It is
*not* refused by `build.test.ts`'s census, which the ticket body originally claimed and then
corrected: the census permits a write inside any emitting package's own `dist/`. It is refused on two
obstacles measured here and named in neither account:

- `@quorum/cli#build` does **not** depend on `@quorum/web#build` today, so the copy would read a
  `dist/` that may not exist yet. `dependsOn: ["^build"]` is topological and the edge does not exist
  until a manifest declares it — at which point the tarball route is available anyway.
- `apps/web/dist` would have to become a declared **input** of `@quorum/cli#build`, or a cache hit
  replays a stale bundle — verbatim decision 092 clause 5's hazard, on the artifact it was written
  about.

And it does nothing for the daemon, which is executable code with a 3.4 MB install closure no asset
copy can carry. **The two packages needed different answers under the copy shape and the same answer
under the tarball shape**, which is the strongest argument for the ruling taken.

---

## 8. Open questions

**OQ-1 (BLOCKING) — does the daemon import become static?** Owner: the gate, at GO-2.

Decision 094 clause 4 says *"the import **may** become static"* and, in the same sentence, *"the
exemption it authorises is **deleted**, not widened"*. Those two point the same way once the
register's shape is read: `deferredOffenders` fires in both directions, so the exemption cannot be
deleted while the import stays dynamic. **Recommended: static.** Against it, and measured rather than
hypothetical: `main.ts` imports every command module, so a static daemon import is loaded on
`quorum board`, `quorum lint` and every other invocation — and a `@quorum/server` damaged in place
would then break **every** command rather than only `open`, which is a real loss of a distinction
Q-0126 paid a review round to build. AC-15(4) measures the first cost; the second is a judgement.
**If the gate rules dynamic, AC-7's stated alternative applies and GO-1 clause 2 must say so
explicitly**, because the register would then outlive the entry that authorised it.

**OQ-2 — what shape is `@quorum/web`'s `exports` map?** Recommended: a subpath pattern
(`"./dist/*": "./dist/*"`) rather than a named alias, so `import.meta.resolve` can ask for a known
file inside the bundle and the caller derives the directory from it. Worth ruling rather than leaving
to an implementer, because this is the first package here whose `exports` exists to make a *path*
resolvable rather than a module importable, and a `"."` entry added by reflex would make a 316 K
bundle importable as JavaScript. Non-blocking: any shape AC-5 can resolve satisfies the criterion.

**OQ-3 — does `resolvesOwnLocation` widen to see `import.meta.resolve`?** The predicate matches
`import.meta.(url|dirname|filename)` only, so after AC-5 a module can locate a sibling package with no
register entry and no assertion. That is a guard keyed on a **name** rather than on the **behaviour**
it is about — the family this repository has now recorded seven times, most recently inside Q-0122's
own requirements run. Recommended: widen, in its own ticket (GO-3), not here —
`frame.source.test.ts` is `packages/cli`'s guard idiom and widening it reaches every production module
in that package, a surface this ticket does not otherwise touch.

**OQ-4 — is `Apache-2.0` the right licence for both?** Assumed, matching the three packages already
distributed. If it is not, AC-1 and AC-3 name a different value and nothing else moves.

**OQ-5 — does `@quorum/web#build` keep its `^build` edge to `@quorum/shared#build` after the
demotion?** Turbo's topological edges are documented to include `devDependencies`, and the edge is
measured to exist today with the dependency under `dependencies`. AC-2(c) measures it after the move
rather than assuming it, which is the whole of the question; it is listed here because if the answer
is no, the demotion needs an explicit `dependsOn` entry and AC-2 gains a clause.

---

## 9. Risks

**R-1 — the packed fixture grows and it is already the slowest thing in the suite.** +3.4 MB and +652
files to mirror, +2 tarballs to pack, on a test with a 300 s budget that does a full `runBuild` first.
Mitigated by AC-2: `apps/web` contributes nothing to the mirror, where keeping React under
`dependencies` would have added 8.2 MB and 85 files. Re-measure the fixture's wall-clock at the gate;
if it approaches the budget, the budget moves and the measurement is recorded beside it (Q-0125's
shape), never the coverage.

**R-2 — the mirror meets peer dependencies at scale for the first time.** `@hono/node-server` peers on
`hono`, and `@hono/node-ws` on both. `collect` walks `dependencies` only, so peers are satisfied
incidentally by siblings already in the mirror. `ajv-formats` peers on `ajv` and the fixture handles it
today, which is the precedent — but three peer edges against a dead registry is a new load, and a
failure here surfaces as an opaque npm resolution error rather than as a named shortfall.

**R-3 — this ticket cannot be shipped in halves on the obvious seam, and that is measured.**
Distributing `@quorum/server` alone makes the daemon resolve, after which `quorum open` on a packed
install falls through to the **bundle** refusal and names `node_modules/apps/web/dist` — a meaningless
path, strictly worse than the honest, tested sentence shipped today, and `build.test.ts:2461` goes red
either way. **The seam that does work is AC-5 / AC-6 / AC-7 plus AC-10** — the `open.ts` half — and
splitting there still leaves a packed install carrying a bundle nothing can find. Both halves ship
together or neither does.

**R-4 — fifteen criteria is at the ceiling.** Q-0013 was refused at eighteen and Q-0122 accepted twenty
at the cost of three implement rounds. The seam is named above **in advance**, and the remedy if the
loop exhausts is a **second erratum splitting at that gate, not a fourth implement round** — Q-0122
E-1's precedent, stated here so it is available rather than invented under pressure. **AC-5 and AC-10
are not eligible for trimming**: they are the only two criteria whose subject is the thing the ticket
exists for.

**R-5 — a required dependency changes how a damaged installation fails.** Today a broken
`@quorum/server` costs one command; statically imported, it costs all ten. That is a consequence of
the ruling rather than a defect in it, and AC-10's re-aimed damaged-daemon assertion is what keeps the
failure legible.

**R-6 — `import.meta.resolve` may answer differently under Vitest than under plain Node.** The
workspace suites resolve through the `quorum-source` condition and a packed install resolves through
`default`. AC-5(a) requires the proof to come from a plain `node` process against the built emit in
both installations, for exactly this reason — a Vitest-only assertion would prove the wrong resolver.

**R-7 — the `packages/<name>` assumption is where a wrong implementation passes vacuously.** Five
helpers build a path that way and `apps/web` is not under `packages/`. A register entry resolving to a
non-existent directory will fail somewhere, but it may fail as `ENOENT` from inside `JSON.parse`
rather than as a named register problem — which is a failure that gets "fixed" with a try/catch.
AC-8's `Test:` clause bounds this by requiring the failure to name the member and the path.

---

## 10. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | No credential on any path. `apps/web/test/package.test.ts`'s credential scan covers every file in that package and must stay green — and after this ticket it covers a package that is *distributed*, which raises what it is worth rather than changing it. No new dependency accepts a key. |
| **Worktree safety** | n/a. No flow writes anything here and no code path touches the user's working tree. |
| **Gate behaviour** | n/a to the code. The ticket's own route carries four gate obligations (§4); GO-1 is blocking. |
| **File format and schema** | n/a. No zod schema, no artifact shape, no `harness.yaml` key and no run-history field changes. The only files whose *format* changes are `package.json` manifests, and npm owns that schema. |
| **Lint rules** | n/a. No flow-lint rule moves and no ESLint configuration moves. `@quorum/web` gaining `files` and `exports` is invisible to both. |
| **Cold-clone impact** | **The point of the ticket**, and it cuts both ways: the packed install grows by 492 K of emit and 3.4 MB of `hono` closure, and in exchange the adopter's installation gains the product's UI. AC-15 re-derives all four figures against M6's thirty-minute budget. Q-0014's measured +50 MB for the app's own dependencies is explicitly **not** incurred, which is AC-2's purpose. |
| **Product boundaries** | No product-specific reference. The word for what a tarball needs stays *distributed*; *published* is Q-0029's, and GO-1 clause 4 keeps the two apart. |
| **Vocabulary** | **No new glossary term is coined and none is owed.** *Emitting set*, *local distribution set*, *resolved*, *served* and **Emitted artifact** all exist; this ticket changes a membership, not a vocabulary. So neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). |

---

## 11. Sequencing

**After Q-0125 and Q-0126**, both landed. **p2**, unchanged: it is on the cold-clone path M6 turns on,
and nothing is broken for a workspace user today.

**It closes three routed questions at once** — decisions 092's, 093's and 094's, each of which names
Q-0124 by name — which is the argument for ruling it here rather than a fourth time at the next
emitter.

**It is M3 work rather than M6 work**, despite living on M6's path: the milestone's own done-when says
*"`quorum open` starts daemon + browser"*, and a command that starts them on one of two claimed
installation paths meets that line with a footnote. This removes the footnote.
