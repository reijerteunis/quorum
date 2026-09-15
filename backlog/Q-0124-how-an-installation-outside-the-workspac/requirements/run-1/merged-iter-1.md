« Q-0124 — How an installation outside the workspace obtains the UI

*Merged requirement, run 1, iteration 1, 2026-09-15. Two candidates were judged and merged; §12 records
which contributed what and what was struck. **Thirteen acceptance criteria**, down from the claude
candidate's fifteen and the codex candidate's nineteen — three of the latter were not criteria at all,
and one of those three named a surface the chore flow may not write.*

---

## 0. What was measured, where the accounts disagree, and what a criterion may rest on

The ticket body carries a block headed *"Measured 2026-09-15, after Q-0125 and Q-0126 both landed"*.
The claude candidate re-ran it and reports **eight of its claims false**. That correction is carried
here because it changes the shape of the work in three places — and it is carried **as a claim to be
re-derived, not as a settled fact**, because this is the fourth consecutive ticket in this cut where a
body re-measured hours earlier was refuted by the run that read it, and the lesson recorded then was
*a measurement copied from a document is not a measurement* (Q-0099). Where a criterion depends on one
of these numbers, its `Test:` clause re-derives it rather than asserting it.

### 0.1 Carried as holding

- The manifest table in the body is exact: `apps/web` `private: true`, no `files`, no `exports`;
  `packages/server` `private: true`, no `files`, an `exports` map; `@quorum/cli` with `@quorum/core`
  and `@quorum/shared` required, `@quorum/server` optional, `files: ["dist", "templates"]`.
- **`build.test.ts`'s census permits a cross-package asset copy.** The body's correction of its own
  earlier claim stands: the clause filters writes against *every emitting package's own* `dist/`, so a
  copy into `packages/cli/dist/web/` sits inside a permitted prefix. The displaced alternative is
  refused on other grounds (§7), not on that one.
- **`private: true` is orthogonal to local distribution**, and the proof is stronger than the hand
  check the body cites: all three currently distributed packages are private and are packed by
  `build.test.ts`'s fixture on every CI run. The property is already under test. **078(d) is
  untouched and Q-0029 stays in M6.**

### 0.2 Carried as corrections, each re-derived by the criterion that uses it

**(a) The daemon's install closure is four packages, not three.** `@hono/node-ws` depends on `ws`,
which the fixture's own `collect` walks — reported as `hono` 2.8 M, `@hono/node-server` 376 K,
`@hono/node-ws` 60 K, `ws` 196 K, ≈ **3.4 MB / 652 files**, against the body's *"1.7 MB across
three"*. AC-8 asserts the closure as an **identity** with `ws` named, so the arithmetic cannot be the
thing that is wrong.

**(b) `apps/web`'s closure is three packages, not two** — `react-dom` pulls `scheduler`. Immaterial to
the outcome and material to the mirror loop, which iterates packages rather than megabytes.

**(c) Three emitted-byte figures in the body are stale.** Carried, and **no criterion asserts a byte
count** (Q-0096 E-1, Q-0098 E-1 each retired one here for the same reason). AC-13 records them.

**(d) The react demotion is one package too narrow.** The emitted bundle is reported to contain zero
bare specifiers **and zero occurrences of `@quorum/shared`** — consistent with the browser reading
that package for types only, which vanish at build. So `@quorum/shared` is build-time for the tarball
by exactly the argument the body makes for React, and AC-2 moves all three. **This is a pick against
the codex candidate**, whose AC-9 leaves `@quorum/shared` *"in the dependency class required by the
build"* — ambiguous wording for a field whose whole meaning is which class it is in. It would not
break the packed install (`@quorum/shared` is itself distributed), which is precisely why it would
survive unnoticed while asserting that a browser bundle needs a Node package installed beside it.

**(e) `DISTRIBUTION` is not "the one list to move", and this is the highest-value finding in either
candidate.** Five helpers turn a register member into a directory with
`path.join(WORKSPACE, 'packages', name)` — the pack loop, the packer-agreement loop, `manifestOf`,
`versionOf`, `workspaceDepsOf` — and **`apps/web` is not under `packages/`**. A bare `'web'` entry
resolves to a directory that does not exist. AC-7 exists separately for this, and its `Test:` clause
bounds *how the wrong implementation must fail*, because the likely failure is an `ENOENT` from inside
a `JSON.parse` — which gets "fixed" with a `try`/`catch`.

**(f) `@quorum/cli#build` is reported to already depend on `@quorum/server#build`**, turbo's
topological edges including `optionalDependencies`. If so, **no build-ordering work is owed for the
daemon** — which neither the body nor the codex candidate says, and which a reader would otherwise
budget for. AC-4 re-derives it.

**(g) Neither new distribution member declares a `license`.** The three already distributed carry
`Apache-2.0`. A tarball is where that field starts mattering; AC-1 and AC-3 add it.

**(h) Two line citations in the body send a reader to the wrong assertion.** The packed refusal is
`build.test.ts:2461–2462`; **`:2482` is the *damaged daemon* case**, and the workspace assertion is
`:2134`. Recorded so an implementer does not chase the wrong subject. The ticket body is the human's
to correct.

---

## 1. Problem

**In the `adopter`'s words.** *"I installed Quorum into my project the way the README told me to —
three tarballs — and the first thing the documentation shows me is a web app I cannot open.
`quorum open` tells me `@quorum/server` did not resolve from this installation. It is a true sentence
and it does not help me: I did exactly what the README said, and the product's own mission control is
not in what it shipped me."*

**In the `maintainer`'s words.** *"Two packages emit and neither is packed. I ruled that a deliberate
gap twice — decision 092 on the UI, decision 093 on the daemon — and both entries routed the question
here by name. Q-0126 then shipped a command that has to apologise for it on one of the two
installation paths this repository claims and tests. The apology is correct, and it is the third
artefact in a row built on an unanswered question."*

**Mechanically.** The **local distribution set** is three tarballs and the **emitting set** is five;
`apps/web` and `packages/server` are the difference. `@quorum/cli` reaches the daemon through
`optionalDependencies` plus a dynamic import, which keeps the packed install *working* at the price of
one command that cannot run there. And `open.ts` finds the bundle at
`new URL('../../../apps/web/dist/', import.meta.url)`, which from `node_modules/@quorum/cli/dist/`
resolves to `node_modules/apps/web/dist` — a path with no meaning outside the workspace, which is why
that module's refusal order puts the bundle check last.

**The maintainer ruled the answer at the gate on 2026-09-15: tarballs four and five.** This document
implements that ruling; it does not reopen it. §7 records the alternative it displaces and why,
because a requirement that does not say what was refused invites the next reader to re-derive it.

---

## 2. User stories

- **As the `adopter`**, I install Quorum into my own project from a local pack and run `quorum open`,
  and a browser shows me mission control — so that the packed path and the workspace-local path are
  the same product and the README's install section has no footnote attached to it.
- **As the `maintainer`**, one ruling covers both packages that emit and are not distributed, so the
  next emitter inherits a decided rule rather than a third instance of an open question.
- **As the `contributor`**, one register says what emits and one says what is packed, and after this
  change they name the same five — so *emits* and *ships* stop being two facts I hold apart while
  reading five files.

---

## 3. Surfaces

`packages/cli` (manifest, `open.ts`, `build.test.ts`'s packed fixture, `package.test.ts`,
`frame.source.test.ts`), `apps/web` and `packages/server` (**manifests only; no source in either
changes**), `packages/core` (`cli-version.test.ts`'s clause-D register, `test-discovery.test.ts`'s
comment, `turbo-inputs.test.ts`'s two `NOT_READ` rows), and the documents — `docs/04-architecture.md`,
`docs/GLOSSARY.md`, `docs/06-development-plan.md`, `README.md`, `docs/USAGE.md`,
`harness/product-context.md` — with `packages/shared/src/docs.test.ts`'s registers over them.

**No daemon route, no browser source, no screen, no flow file and no schema changes.**

---

## 4. Gate obligations

These are the human's and are settled **before** the chore run starts. Each is here rather than as a
criterion because no step on the route may perform it — *"A requirement may not name a surface its flow
cannot write"* (2026-08-25), whose fifth instance in this cut is the codex candidate's AC-1.

**GO-1 (BLOCKING) — the decision entry lands at this gate, and is named in `requirements/errata.md`.**
Several criteria below replace an authority comment with a citation of it, so they are literally
unsatisfiable until it exists on disk. It must rule, in this order:

1. **The local distribution set is five, and it is the emitting set again** — naming *"A fourth package
   emits, and what it emits is served rather than shipped"* (2026-09-12) and *"A fifth package emits,
   and `resolved` is not a synonym for `distributed`"* (2026-09-12) as the entries whose open question
   it closes. Neither is edited. **The vocabulary separating *resolved* from *distributed* is not
   withdrawn**: the two axes stay independent and merely coincide again, which is the state 092 was
   written under and which is exactly what made its first wording go false. An entry saying *"the
   distinction was temporary"* re-creates the defect 093 removed.
2. **It supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14)**,
   which names this ticket and this act in its own clause. The exemption that entry authorises is
   **deleted, not widened**, and the entry says so — with the consequence stated rather than implied:
   the import becomes static (§8, OQ-1, ruled).
3. **`react`, `react-dom` and `@quorum/shared` become `devDependencies` of `@quorum/web`**, on the
   measured ground that *what a bundle contains* and *what npm must install beside a tarball* select
   **opposite** sets for a self-contained bundle. **The entry states the evidence, not the conclusion**
   — zero bare specifiers in the emitted bundle — because the rule it replaces is correct under its own
   framing and a reader meeting only the conclusion will restore it.
4. **`private: true` stays on all five**, with the reason written down: `pnpm pack` does not refuse a
   private package and only `npm publish` does. **078(d)'s refusal of registry-resolved `npx quorum` is
   untouched and Q-0029 stays in M6.** This clause exists so a later reader does not read *distributed*
   as *published*.
5. **What a distributed-but-unpublished package owes**: `files`, a `license`, and nothing else.

**The entry must be landed before the chore run is launched, and its presence in the implement step's
actual prompt must be verified rather than assumed.** Q-0062 lost three rounds to a run launched
without an entry its own requirement had named in advance; Q-0097 lost two errata by not checking a
landed one reached the step; Q-0115 and Q-0125 both verified it by reading the prompt, and that is the
check to repeat. **And it must be named in `requirements/errata.md`, not only in `ticket.md`** — the
chore `implement` step reads the errata file and not the body, which is the measured reason Q-0125
owed a gate erratum: without it the implementer reads a live blocker and returns `blocked` on round one.

**GO-2 — OQ-3's successor is opened as a ticket at this gate**, body written out in full, if the
ruling is that `resolvesOwnLocation` widens. Three obligations this month lived only inside a closed
ticket's prose or a source comment and were each lost for a week (Q-0110, Q-0111, Q-0112); Q-0113 and
Q-0114 are the precedent for the opposite.

**GO-3 — verification in both environment rows, forced, and CI green on the merged commit.** The
implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the
merge (Q-0072's closing finding). CI is named explicitly because the packed fixture is the one test in
this repository that has been **red on CI while green locally for three days** (Q-0104), and this
ticket doubles what it installs.

**GO-4 — the seam and the remedy are named in advance.** Thirteen criteria is inside the ceiling, and
R-3 measures that the obvious split makes the product worse in the interval. **If the revise loop
exhausts, the remedy is a second erratum splitting at that gate — not a fourth implement round**
(Q-0122 E-1). **AC-5 and AC-9 are not eligible for trimming**: they are the only two criteria whose
subject is the thing the ticket exists for.

---

## 5. Acceptance criteria

*Thirteen. Each `Test:` clause bounds the instrument: a reviewer may find that the instrument fails the
job the clause gives it, and may not raise the job (Q-0067 E-1).*

---

### AC-1 — `apps/web` declares what a tarball needs, and nothing more

`apps/web/package.json` gains `files: ["dist"]`, `license: "Apache-2.0"`, and **one named
bundle-locator `exports` entry** whose target is `./dist/index.html` (shape ruled at §8 OQ-2). It keeps
`private: true` and declares no `main`, no `types`, no `bin` and **no `"."` entry** — nothing imports
the bundle as a module, and a `"."` added by reflex would make a 300 K bundle importable as JavaScript.

**Test:** `apps/web/test/package.test.ts`'s block *"and it emits without being distributed — no
exports, files, main, types or bin"* is **inverted rather than deleted**, and its authority comment
replaced with a citation of GO-1's entry. Shown red in **both** directions against fixtures: the
manifest as it stood before this ticket must fail the new block, and the new manifest must fail the old
one — because the cheapest wrong implementation is deleting the clauses that now fail, and that is
indistinguishable from the right one without the pair.

---

### AC-2 — `@quorum/web` has no runtime dependency, and the emitted bundle is the evidence

`react`, `react-dom` and `@quorum/shared` move to `devDependencies`; `dependencies` is absent or empty;
`JUSTIFICATIONS` keeps one entry per declared package.

**Test:** three parts, because the claim has three halves and only one of them is a manifest read.

(a) **The manifest.** The existing test *"the two that ship to a browser are dependencies, and the
build-time ones are not"* is **rewritten rather than deleted**, and its comment states the measured
reason — *what npm must install beside a tarball*, not *what the bundle contains*.

(b) **The evidence, asserted over the emitted bundle rather than argued.** The built
`apps/web/dist/assets/*.js` carries no bare import specifier — nothing matching `from '<name>'` where
`<name>` begins with neither `.` nor `/` — and no occurrence of `@quorum/shared`. **The needle is shown
to discriminate** against a fixture containing `from 'react'`, or the scan proves nothing.

(c) **The build graph survives the demotion**, measured after the move rather than assumed:
`turbo run build --dry` still reports `@quorum/web#build` depending on `@quorum/shared#build`. **If the
edge is lost, the remedy is an explicit `dependsOn` and this criterion gains a clause** — it is not
silently accepted, because a bundle built against a stale `@quorum/shared` is decision 092 clause 5's
hazard on a new artifact.

---

### AC-3 — `packages/server` declares what a tarball needs

`packages/server/package.json` gains `files: ["dist"]` and `license: "Apache-2.0"`, keeps `private:
true` and its existing `exports` map, and declares no `main`, `types` or `bin`.

**Test:** `packages/server/src/package.test.ts`'s `emitsAndIsNotDistributed` invariant is the subject.
The clauses that forbid `files` invert, and **the predicate is renamed to what it now asserts** — a
function called `emitsAndIsNotDistributed` returning `[]` for a distributed package is a name that
lies. The existing both-directions demonstration is kept and re-aimed: the pre-Q-0125 fixture must
still fail the emission half **by name**, and a fixture with `files` removed must now fail the
distribution half **by name**, so deleting the failing clauses is distinguishable from satisfying them.

---

### AC-4 — `@quorum/cli` requires the daemon and declares the web app

`@quorum/server` moves from `optionalDependencies` to `dependencies`; `@quorum/web` is added to
`dependencies`, without which `import.meta.resolve` in AC-5 cannot answer; `optionalDependencies` is
removed entirely.

**Test:** `packages/cli/src/package.test.ts`'s Q-0126 AC-7 block moves, in three separately-red parts:
(a) `dependencies` is exactly `@quorum/core`, `@quorum/server`, `@quorum/shared`, `@quorum/web` at the
workspace range convention; (b) `optionalDependencies` is `undefined` and `devDependencies` stays
`undefined`; (c) **the key-set derivation is kept** — every key ending `dependencies` — and becomes
`['dependencies']`, so a fourth section still cannot arrive unremarked. That derivation is not replaced
by three literal checks: it is the clause Q-0126 added precisely because an optional edge was invisible
to a strict read of `dependencies` alone.

And `turbo run build --dry` is re-derived: `@quorum/cli#build` now depends on `@quorum/web#build`, and
whether it already depended on `@quorum/server#build` (§0.2(f)) is reported rather than assumed — it is
the fact AC-12(d)'s documentation correction rests on.

---

### AC-5 — `quorum open` finds the bundle by package name, and one expression answers both installations

`packages/cli/src/open.ts` replaces `new URL('../../../apps/web/dist/', import.meta.url)` with a
resolution through `import.meta.resolve` against `@quorum/web`'s bundle locator, deriving the containing
`dist/` URL and handing it to `ServeOptions.bundle` **unconverted**. `packages/cli` imports no
`node:url` (`frame.source.test.ts:186`), so `fileURLToPath` is unavailable and `.pathname` is not a
substitute — the `string | URL` seam Q-0126 widened is what carries it. No workspace-relative fallback
survives, and there is no silent fallback when the locator cannot resolve.

**Test:** four parts.

(a) **Both installations, by execution rather than by reading.** In the workspace, a plain `node`
process running the built `packages/cli/dist/quorum.js`; in the packed fixture (AC-9), the same emit
resolving inside `node_modules/@quorum/web/`. **One expression answers both** — the property the
relative path did not have, and which no unit test of the expression alone establishes.

(b) **A missing build still refuses with the module's own sentence**, naming a directory that exists in
the installation the reader is standing in. `import.meta.resolve` answers from the manifest without the
target existing, so the bundle refusal stays reachable; asserted by running `quorum open` against an
installation whose `@quorum/web/dist` has been removed and checking the named directory is inside that
installation and not `node_modules/apps/web`.

(c) **A source test fails on restoration of the old workspace-relative locator**, so the fix cannot be
undone silently.

(d) **The `SELF_LOCATING` register moves, forced rather than tidy.** `resolvesOwnLocation` matches
`import.meta.(url|dirname|filename)` and not `import.meta.resolve`, and that register fires in **both**
directions — so with `open.ts`'s entry left in place the suite reports *"its entry permits a
self-location the module does not perform"*, demonstrated. The register returns to `{'init.ts': …}` and
the assertion Q-0126 added to refuse that value is inverted with a comment naming this ticket, in the
shape every superseded register in that file already takes.

(e) **The docblock's stated reason is corrected.** The refusal order is daemon → project → bundle
*because* the bundle path was meaningless on a packed install. That reason goes. The order may stay;
the reason may not — a docblock giving a reason that has stopped being true is the defect this
repository records most often.

---

### AC-6 — the daemon specifier stops being deferred, and the register that permitted it goes

`open.ts` imports `@quorum/server` statically. `daemon()`, `isDaemonUnresolved`,
`NO_DAEMON_CONDITION` and `NO_DAEMON_REMEDY` are deleted with their tests.
`packages/core/src/adapters/cli-version.test.ts`'s `DEFERRED_SPECIFIER` register is deleted and clause D
returns to an empty result with **no register and no exemption** — the state decision 094 describes as
the one it departed from.

**Test:** `build.test.ts`'s Q-0126 AC-8 block **inverts**: the emitted `open.js` must carry a static
`from '@quorum/server'` and must not carry `import('@quorum/server')`, both needles keeping their
existing discrimination checks over planted fixtures. Clause D's both-directions demonstration is kept:
a planted dynamic import anywhere in `packages/core/src` or `packages/cli/src` production source is
still reported by name — so deleting the register is shown to be a **return to a stricter rule** rather
than a relaxation.

---

### AC-7 — `DISTRIBUTION` is five, and carries a path per member across both workspace roots

`build.test.ts`'s register becomes five members, and every helper that turns a member into a directory
derives it from the register rather than from `path.join(WORKSPACE, 'packages', name)` — the pack loop,
the packer-agreement loop, `manifestOf`, `versionOf`, `workspaceDepsOf`. `DECLARED_FILES` gains
`web: ['dist']` and `server: ['dist']`.

**Test:** the register is shown **root-aware rather than name-keyed by the failure it produces**: a
member whose recorded root is wrong must fail naming that member and that path, **not** with an
`ENOENT` raised from inside a `JSON.parse`. That clause is the whole point of the criterion — it is the
one place a wrong implementation passes vacuously or fails in a way that gets repaired with a
`try`/`catch`. And the derivation is shown not to have quietly narrowed: `dependents` — the members
declaring a workspace dependency — is re-derived and asserted as an identity, which after AC-2 and AC-4
no longer includes `web`.

The build census is re-run unchanged and must stay green: each package still emits only under its own
`dist/`, and nothing copies an artifact across packages (§6 non-goal 3).

---

### AC-8 — the offline mirror covers the widened closure, and names what it covered

The packed fixture's third-party closure grows by the daemon's packages. The existing per-package
completeness guard — which compares a mirrored tarball's entry count against the installed tree's file
count and names the package on a shortfall (Q-0104) — must cover them.

**Test:** the closure the fixture's own `collect` produces is asserted as an **identity, never a count**
(Q-0073), with **`ws` named explicitly** — it is reached only transitively and is the package the ticket
body's own walk missed. The measured delta is recorded in the fixture's comment beside the figure it
supersedes, and **that `apps/web` contributes nothing** is recorded with it: it is AC-2's measured
payoff and the reason the demotion belongs to this ticket rather than being a tidy-up.

---

### AC-9 — the packed install carries the UI, and `quorum open` serves a page there

The fixture packs and installs **five** tarballs together into a project outside the repository with the
registry unavailable, and `quorum open` in that installation starts, binds loopback and serves the shell.

**Test:** five parts, and the first three are the criterion.

(a) **The install is part of the criterion, not a precondition.** It must fail if npm reaches the
registry for any of the five, for React, or for anything in the daemon's closure. **A failed install is
a failed criterion, not a skipped runtime check.**

(b) **A served page, not an exit code.** The assertions at `build.test.ts:2461–2462` — that packed
`quorum open` refuses with the daemon condition and remedy — **invert to a positive**: the command is
started against a fixture project with browser launching suppressed (`--no-open`; **no real browser is
opened on the test machine**), the daemon's URL is taken from what the command prints, `GET /` over the
real socket answers **200 `text/html`** carrying the built shell, and the process is stopped through the
existing shutdown path and exits cleanly. **An existence check on `node_modules/@quorum/web/dist` is
explicitly not sufficient** — it is the assertion that passes over a tarball shipping an empty
directory, which is the failure Q-0093 AC-5(d) exists to prevent at the neighbouring site.

(c) **The test proves it used the packed artifacts.** Before starting, the fixture makes the source
workspace unreachable to the child process, or demonstrates that the resolved daemon module and the
resolved bundle URL are both inside the external installation's `node_modules`. The verdict may not
depend on a workspace `dist`, a repository symlink or any gitignored directory left by prior local use
— *"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30),
and the resolver differs between the suites' `quorum-source` condition and a packed install's
`default`.

(d) **The damaged-daemon assertion at `:2482` is re-aimed rather than deleted.** With a required
dependency, a daemon that resolves and then fails is still a real state, and what must hold is that its
own error reaches the operator rather than being rendered as a packaging sentence.

(e) **The workspace-local path stays green and stays distinguishable.** The workspace `quorum open`
regression still starts, serves the same shell and shuts down; success in one installation may not
satisfy the other's assertion.

---

### AC-10 — every other command in the packed install is unchanged

`quorum help` prints the ten-entry command list, `quorum init` scaffolds all twenty template files, and
the shim resolves inside the temporary project rather than back into the repository.

**Test:** the existing assertions are kept **unaltered** and are the regression guard, not new work.
This criterion exists because decision 094's *Alternatives considered* refused the required edge
precisely on the ground that it breaks `quorum help` and `quorum init` in a packed install. **Shipping
the daemon voids that refusal, and this criterion proves the voiding rather than assuming it.**

---

### AC-11 — every register, comment and document stating the old split moves, and the append-only entries do not

`test-discovery.test.ts`'s comment that the emitting set is five and the distribution set three,
`turbo-inputs.test.ts`'s `NOT_READ` rows for `apps/web` and `packages/server` each stating its subject
is *not distributed*, `docs/04-architecture.md`'s count-bearing sites, `docs/GLOSSARY.md`'s **Emitted
artifact** entry and `docs/06-development-plan.md`'s M3 boundary are corrected. The sentences that go
false are precisely *"the local distribution set is the first three"*, *"`@quorum/web` and
`@quorum/server` are the difference"* and *"how an installation outside this workspace obtains the UI
**or the daemon** is an open question"*. **The definitions of *resolved* and *served* are not touched**:
they are defined by mechanism since decision 093, and this ticket changes neither mechanism.

**Test:** the assertion that `emittingPackages()` is the five is **unchanged** — this ticket adds no
emitter — and the comments beside it are held against the register they describe. `docs.test.ts`'s
`LIVE` / `SUPERSEDED` / `HISTORICAL` triple is extended in the shape it already has: every sentence
stating the old split goes to `SUPERSEDED` with its negative shown to have a subject against a fixture
reproducing today's text, every new sentence to `LIVE`, and `HISTORICAL` gains nothing but is re-run —
**so a blanket find-and-replace over "three" fails as loudly as an omission**, decisions 092 and 093
being append-only and required to go on reading as they do.

---

### AC-12 — the installation documents describe the install a stranger will actually perform

Four corrections, and the fourth is the one no existing register would have caught:

(a) `README.md`'s packed-install block: **five** tarballs, and its pack loop rewritten to cover both
workspace roots.
(b) `README.md`'s paragraph beginning *"`quorum open` works from the workspace and not from a packed
install"* is **deleted**, not softened.
(c) `docs/USAGE.md` §`quorum open`'s equivalent paragraph is deleted, and the two sentences routing the
question to Q-0124 with it.
(d) **`docs/USAGE.md` says `--filter=@quorum/cli` does not build the web app and shows what that failure
looks like. AC-4 makes that false**, `@quorum/cli#build` gaining a `^build` edge to `@quorum/web#build`.
The sentence is **corrected rather than removed** — the advice it gives is still needed and its example
is now the other way round.

`harness/product-context.md`'s quality pillar 7 moves in the same change: decision 094's named
`quorum open` exception is deleted, the distribution set becomes five, and the sentence routing the
question to this ticket is replaced by the answer.

**Test:** `docs.test.ts` holds the tarball count in `README.md` against `DISTRIBUTION`'s size rather
than a literal, and the pillar-7 clause against the same register — so a sixth distributed package
fails until both documents move. **Pillar 7 is asserted first of the four**: it is fed to every
product-manager step at run time, which is Q-0098's finding and the reason a false installation claim
there is one every future requirement inherits.

---

### AC-13 — the cold-clone cost is re-derived, recorded beside what it supersedes, and compared with M6's budget

Measured after the change rather than predicted: emitted bytes now distributed, the mirror's growth in
size and package count, the packed install's cold wall-clock against Q-0014's baseline — that ticket
measured the app's *dependencies* doubling a cold store to 10.4 s and +50 MB, and this ticket ships
**none** of them, which is the comparison worth making — and **`quorum help`'s startup before and
after**, because `main.ts` loads every command module and AC-6 makes the daemon a static import paid on
every invocation.

**Test:** recorded in the implement report and in the fixture's comments **beside the figures they
supersede**, in the shape Q-0125 used for its three re-measured budgets, so the movement is visible
rather than silent. **No criterion asserts a byte count or a duration** — Q-0096 E-1 and Q-0098 E-1 each
retired a count assertion here for the same reason, and re-introducing one is the mistake those errata
exist to prevent. **A probe that cannot complete is reported as inconclusive, never as zero cost.**

---

## 6. Non-goals

1. **Registry publication.** `npx quorum` from a public registry stays refused while every package is
   `private: true`; it is Q-0029's, in M6, per decision 078(d). *Distributed* here means *locally packed
   and installed*, and GO-1 clause 4 exists so the two are never read as one.
2. **Dropping `private: true` from any package.** Measured: `pnpm pack` does not refuse a private
   package, and all three currently distributed packages are private and pack on every CI run.
3. **The cross-package asset copy** — `@quorum/cli` carrying `apps/web/dist` beside its templates.
   Displaced by the gate ruling; §7 records what it would have cost.
4. **Tracking a built bundle in git.** It contradicts **Emitted artifact**'s *"gitignored and
   reproducible from the commit"*, and the Q-0093 templates precedent does not transfer:
   `packages/cli/templates/` is twenty *tracked source* files and `apps/web/dist` is gitignored output.
5. **A JavaScript API for `@quorum/web`.** Its export is a stable locator for a served artifact; nothing
   imports it, and AC-1 adds no `"."` entry.
6. **A `--bundle` flag or any second way for an operator to point at a bundle** (Q-0126 non-goal 6).
   AC-5 keeps the number of ways at one, and adds no download-a-missing-package fallback.
7. **Supporting an installation given only a subset of the five tarballs.** The fixture installs them
   together and that is the supported shape.
8. **Any change to the daemon's routes, host lifecycle, browser-launch behaviour, the web UI's
   contents, or the `quorum open` contract** beyond resolving the packaged daemon and bundle. The
   screens are Q-0015 to Q-0018.
9. **Optimising, externalising or splitting the web bundle** beyond the manifest demotion.
10. **Any change to a flow, gate, adapter, ticket schema, backlog format, run-history format, turbo
    test/lint/typecheck topology, or `.quorum/` behaviour.**
11. **Windows.** `openUrl` names it `unsupported` explicitly and this ticket does not revisit it.
12. **Q-0123** — the run-host record that is never released. Different subject, still p3.

---

## 7. The alternative the gate displaced, recorded rather than dropped

**The cross-package copy — `@quorum/cli#build` copies `apps/web/dist` into its own `dist/`.** It is
**not** refused by the build census, which the ticket body first claimed and then corrected: the census
permits a write inside any emitting package's own `dist/`. It is refused on three grounds, two of them
measured here and named in neither earlier account:

- `@quorum/cli#build` does not depend on `@quorum/web#build` today — `dependsOn: ["^build"]` is
  topological and the manifest edge does not exist — so the copy would read a `dist/` that may not
  exist yet. Declaring the edge makes the tarball route available anyway.
- `apps/web/dist` would have to become a declared **input** of `@quorum/cli#build`, or a cache hit
  replays a stale bundle — **verbatim decision 092 clause 5's hazard, on the artifact it was written
  about.**
- **It does nothing for the daemon**, which is executable code with a multi-megabyte install closure no
  asset copy can carry. The two packages needed *different* answers under the copy shape and the *same*
  answer under the tarball shape, which is the strongest argument for the ruling taken.

---

## 8. Open questions

**OQ-1 — does the daemon import become static? Ruled: yes, and it is not open.** The claude candidate
marked this blocking and the codex candidate asserted the answer; the pick is the codex answer with the
claude candidate's mechanism as the reason. Decision 094 says of itself that *"the exemption it
authorises is deleted, not widened"*, and the ticket body's gate ruling says the clause-D register is
*"deleted rather than kept"*. `deferredOffenders` fires in **both** directions — an unregistered dynamic
import is reported, *and* so is an entry permitting a specifier the module does not use — so a deleted
exemption **forces** a static import unless clause D itself is relaxed, which is the widening 094
forbids. The cost the claude candidate raises is real and is answered rather than hedged: a required
dependency that fails to load breaks every command, which is **already true of `@quorum/core` and
`@quorum/shared`**, so the behaviour becomes uniform with the other two required edges rather than
special. AC-13 measures the startup half. **If that measurement argues the other way, the remedy is a
new entry at a gate, never an implementer's choice.**

**OQ-2 — what shape is `@quorum/web`'s `exports` map? Ruled: one named bundle-locator subpath whose
target is `./dist/index.html`, no `"."` entry, and the caller derives the containing directory from the
resolved URL.** Picked over the claude candidate's `"./dist/*"` wildcard: a single documented locator
keeps the package's internal layout private, so a later change to the emitted filenames does not move
the CLI, and it exposes one path rather than every emitted file. **If Node or pnpm rejects that export
shape under the red test, the engineer stops and returns the measured failure to the gate** — they must
not substitute a workspace-relative path, a package-root reach-through, a copied artifact or an
undocumented export.

**OQ-3 — does `resolvesOwnLocation` widen to see `import.meta.resolve`?** Not blocking, and **not this
ticket**. The register entry must be *removed* either way (AC-5(d)), because it fires in both
directions. Whether the predicate widens is a guard-idiom question reaching every production module in
`packages/cli`, a surface this ticket does not otherwise touch — and it is **a guard keyed on a name
rather than on the behaviour it is about**, the family this repository has now recorded seven times.
Recommended: widen, in its own ticket, opened at this gate (GO-2).

**OQ-4 — is `Apache-2.0` the right licence for both?** Assumed, matching the three already distributed.
If not, AC-1 and AC-3 name a different value and nothing else moves.

**Nothing above blocks solutioning. The one blocker is GO-1** — the decision entry several criteria
cite does not yet exist and no step on the route may write it.

---

## 9. Risks

**R-1 — the packed fixture grows, and it is already the slowest thing in the suite.** Two more tarballs
to pack and a multi-megabyte closure to mirror, on a test that runs a full build first. Mitigated by
AC-2: `apps/web` contributes nothing to the mirror, where keeping React under `dependencies` would have
added roughly 8 MB. Re-measure the fixture's wall-clock at the gate; if it approaches its budget **the
budget moves and the measurement is recorded beside it** (Q-0125's shape), never the coverage.

**R-2 — the mirror meets peer dependencies at scale for the first time.** `@hono/node-server` peers on
`hono` and `@hono/node-ws` on both; `collect` walks `dependencies` only, so peers are satisfied
incidentally by siblings already mirrored. `ajv-formats` peers on `ajv` and the fixture handles it
today, which is the precedent — but three peer edges against a dead registry is a new load, and a
failure surfaces as an opaque npm resolution error rather than as a named shortfall.

**R-3 — this ticket cannot be shipped on the obvious seam, and that is measured rather than asserted.**
Distributing `@quorum/server` alone makes the daemon resolve, after which packed `quorum open` falls
through to the **bundle** refusal and names `node_modules/apps/web/dist` — a meaningless path, strictly
worse than the honest, tested sentence shipped today, with `build.test.ts:2461` red either way. The seam
that *does* work is AC-5 / AC-6 plus AC-9 — the `open.ts` half — and splitting there leaves a packed
install carrying a bundle nothing can find. **Both halves ship together or neither does**, and GO-4
names the remedy if the loop exhausts anyway.

**R-4 — thirteen criteria is inside the ceiling and near it.** Q-0013 was refused at eighteen and
Q-0122 accepted twenty at the cost of three implement rounds. Three of the codex candidate's nineteen
were struck as not being criteria at all (§12), which is where most of the reduction came from rather
than from trimming subject matter.

**R-5 — a required dependency changes how a damaged installation fails.** Today a broken
`@quorum/server` costs one command; statically imported, it costs all ten. A consequence of the ruling
rather than a defect in it, uniform with the other two required edges, and AC-9(d) is what keeps the
failure legible.

**R-6 — `import.meta.resolve` may answer differently under Vitest than under plain Node.** The suites
resolve through `quorum-source` and a packed install through `default`. AC-5(a) and AC-9(c) require the
proof from a plain `node` process against the built emit in **both** installations, for exactly this
reason — a Vitest-only assertion proves the wrong resolver.

**R-7 — the `packages/<name>` assumption is where a wrong implementation passes vacuously.** Five
helpers build a path that way and `apps/web` is not under `packages/`. AC-7's `Test:` clause bounds it
by requiring the failure to name the member and the path.

---

## 10. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | No credential on any path, and no new dependency accepts a key. `apps/web`'s credential scan must stay green — and after this ticket it covers a package that is *distributed*, which raises what it is worth rather than changing it. |
| **Worktree safety** | n/a. No flow writes anything here and no code path touches the adopter's working tree. |
| **Gate behaviour** | n/a to the code. The ticket's own route carries four gate obligations (§4); GO-1 is blocking. |
| **File format and schema** | n/a. No zod schema, artifact shape, `harness.yaml` key or run-history field changes. The only files whose *format* moves are `package.json` manifests, and npm owns that schema. |
| **Lint rules** | n/a. No flow-lint rule and no ESLint configuration moves. |
| **Cold-clone impact** | **The point of the ticket**, and it cuts both ways: the packed install grows by two tarballs and the daemon's closure, and in exchange the adopter's installation gains the product's UI. AC-13 re-derives every figure against M6's thirty minutes. Q-0014's +50 MB for the app's own dependencies is explicitly **not** incurred, which is AC-2's purpose. |
| **Product boundaries** | No product-specific reference. *Distributed* stays the word for what a tarball needs; *published* is Q-0029's, and GO-1 clause 4 keeps them apart. |
| **Vocabulary** | **No new glossary term is coined and none is owed.** *Emitting set*, *local distribution set*, *resolved*, *served* and **Emitted artifact** all exist; this ticket changes a membership, not a vocabulary. Neither term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). |

---

## 11. Sequencing

**After Q-0125 and Q-0126**, both landed. **p2**, unchanged: on the cold-clone path M6 turns on, and
nothing is broken for a workspace user today.

**It closes three routed questions at once** — decisions 092's, 093's and 094's, each of which names
Q-0124 by name — which is the argument for ruling it here rather than a fourth time at the next emitter.

**It is M3 work despite living on M6's path**: the milestone's own done-when says *"`quorum open` starts
daemon + browser"*, and a command that does so on one of two claimed installation paths meets that line
with a footnote. This removes the footnote.

---

## 12. Provenance

**From the claude candidate**, kept largely intact: §0's re-measurement of the ticket body and its eight
corrections; **the `packages/<name>` register-shape finding (AC-7)**, which is the highest-value
structural finding in either document and appears in neither the body nor the codex candidate; the
bidirectional reading of `deferredOffenders` that *decides* OQ-1; the `SELF_LOCATING` consequence
(AC-5(d)); the gate-obligation structure; the both-directions inversion discipline on every register
that moves; **R-3's measured argument against the obvious seam**; the closure-as-identity clause with
`ws` named; the `LIVE`/`SUPERSEDED`/`HISTORICAL` shape for the documents; the `--filter=@quorum/cli`
sentence in `USAGE.md` that AC-4 makes false; the `@quorum/shared` half of the demotion; the licence
gap; and the corrected line citations.

**From the codex candidate**, taken where it was sharper: **AC-9(c) — that the packed test must prove
it used the packed artifacts**, the anti-vacuity half neither other account carried as a requirement,
and the criterion most likely to have produced a false green given this repository's own history;
**the named bundle-locator export shape and the instruction to stop and return a measured failure to
the gate if Node rejects it** (OQ-2), picked over the wildcard; *"a failed install is a failed
criterion, not a skipped runtime check"*; the explicit *"must fail if npm reaches the registry"*;
*"must not open a real browser on the test machine"*; the ruling that the answer is **static** rather
than an open question; and the framing that build ownership stays package-local.

**Struck.** The codex candidate's **AC-1 (the decision entry as an acceptance criterion)** — it names a
surface the chore flow cannot write, which is *"A requirement may not name a surface its flow cannot
write"* (2026-08-25) and the fifth instance in this cut; it is **GO-1** instead. Its **AC-18**
(cross-cutting constraints unchanged) is §10, not a criterion. Its **AC-19** (install, test, lint,
typecheck pass) is the standing definition of done and GO-3, not a criterion. Its **AC-4** (privacy
retained) and **AC-11** (install succeeds with the registry dead) are folded into AC-1/AC-3 and AC-9 as
clauses, being one manifest read and one property of an existing fixture. Its **AC-16** is a non-goal
with a regression clause on AC-7. Its **AC-9** wording leaving `@quorum/shared` *"in the dependency
class required by the build"* is replaced by the explicit demotion, with the reason in §0.2(d).

The claude candidate's **AC-6** is folded into AC-5 as clause (d) — it is a forced mechanical
consequence of AC-5 in the same change — and its **AC-12** into AC-11, both being *"every register or
document stating the old split moves"*. Its **OQ-1** is ruled rather than escalated, and its **OQ-2**
is ruled rather than left; the reasons are in §8.

**Net: nineteen and fifteen become thirteen**, and the reduction is three non-criteria struck and three
pairs consolidated rather than any subject dropped.
