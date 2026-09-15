« Q-0124 — How an installation outside the workspace obtains the UI

*Merged requirement, run 1, **iteration 2**, 2026-09-15. **Fourteen acceptance criteria**, from the
claude candidate's fifteen and the codex candidate's nineteen. §13 records what moved since iteration
1 and why; §12 records which candidate contributed what.*

---

## 0. What iteration 2 re-measured, and what it found

**The tree has not moved since iteration 1, and this document says so first.** `docs/decisions/`
still ends at **095**; there is no `backlog/Q-0124-…/requirements/errata.md`; the git tip is still
`e5e56cd`. GO-1's blocker is therefore unchanged, and *a retry on an unchanged tree cannot rule its
own blocker* (Q-0090, Q-0096, Q-0105). What follows is the other half of that discipline: every
measurement iteration 1 rested a criterion on was re-run, and **five findings arrived anyway** — the
third recorded instance of a second pass finding something on an unchanged tree, after Q-0105 and
Q-0125.

### 0.1 Held, re-verified rather than transcribed

- The manifest table is exact. `apps/web`: `private: true`, no `files`, no `exports`.
  `packages/server`: `private: true`, no `files`, an `exports` map. `@quorum/cli`: `@quorum/core`
  and `@quorum/shared` required, `@quorum/server` optional, `files: ["dist", "templates"]`.
- **The emitted bundle is self-contained.** `apps/web/dist/assets/index-*.js` carries **zero** bare
  `from '<name>'` specifiers, **zero** occurrences of `@quorum/shared` and **zero** `import(`. AC-2's
  evidence holds as stated.
- **`private: true` is orthogonal to local distribution.** All three currently distributed packages
  are private and are packed by `build.test.ts`'s fixture on every CI run. **078(d) is untouched and
  Q-0029 stays in M6.**
- **`@quorum/cli#build` already depends on `@quorum/server#build`** — measured from
  `turbo run build --dry=json`, turbo's topological edges including `optionalDependencies`. So **no
  build-ordering work is owed for the daemon**, which neither the ticket body nor the codex candidate
  says. `@quorum/cli#build` does **not** depend on `@quorum/web#build`; that edge arrives with AC-4
  and is what makes AC-13(d) necessary.
- **Neither new distribution member declares a `license`**, where all three distributed carry
  `Apache-2.0`.
- **`deferredOffenders` and `locationOffenders` both fire in both directions**, which is what decides
  OQ-1 and forces AC-6(d).

### 0.2 New in iteration 2, and the first two change the shape of the work

**(a) A live predicate in `packages/core` forbids exactly what AC-4 does.**
`test-discovery.test.ts`'s `namesTheDaemon` is not a comment and not a register — it is an executing
rule applied to **every manifest in the workspace**, and its first branch is:

```
if (name === 'packages/cli/package.json') {
  if (required) return `${name} requires @quorum/server, which kills the packed install`;
  if (!optional) return `${name} declares no optional @quorum/server, so quorum open cannot reach it`;
```

Moving the daemon to `dependencies` turns it red **with a sentence that states this ticket's ruling
is a defect**, and a fixture pair (`hostile` / `permitted`) asserts both sentences by identity.
Neither candidate, the ticket body, nor iteration 1's merge names it; iteration 1's AC-11 named only
this file's *comment* about the split. It is **AC-5** now, because a criterion the implementer meets
as a red suite in round one is a round spent rediscovering what a requirement could have said.

**(b) The offline mirror cannot walk the daemon's closure at all.** `collect` resolves each
dependency with `createRequire(path.join(from, 'noop.js')).resolve(`${name}/package.json`)`.
Measured against the installed tree:

| dependency | `resolve('<name>/package.json')` |
| --- | --- |
| `hono`, `@hono/node-server`, `@hono/node-ws` | **`ERR_PACKAGE_PATH_NOT_EXPORTED`** |
| `ajv`, `ajv-formats`, `yaml`, `zod`, `react`, `react-dom` | resolves |

Every package the mirror carries today exports `./package.json`; **all three the daemon needs do
not.** So `collect` throws before the mirror is built, and iteration 1's §0.2(a) — *"`ws`, which the
fixture's own `collect` **does** walk"* — is refuted: that walk was performed by reading manifests,
not by the fixture's resolver. **AC-9 is design work rather than a register extension**, and it is
the one genuinely open piece of engineering in this ticket.

**(c) The closure identity iteration 1 asserted would have shipped red.** It gave
`['@hono/node-server', '@hono/node-ws', 'ajv', 'ajv-formats', 'hono', 'ws', 'yaml', 'zod']` — which
**omits `ajv`'s four transitive dependencies the current mirror already carries**. Re-derived, the
set today is eight and after this ticket **twelve**:

```
@hono/node-server  @hono/node-ws  ajv  ajv-formats  fast-deep-equal  fast-uri
hono  json-schema-traverse  require-from-string  ws  yaml  zod
```

**(d) Both size accounts are wrong, in different halves.** Re-derived by walking `dependencies`
transitively through the installed tree and summing file bytes:

| closure | packages | files | bytes |
| --- | --- | --- | --- |
| `packages/server` | **4** | 652 | **1.72 MB** |
| `apps/web` | **3** | 85 | 7.94 MB |
| distributed today | 8 | 1,503 | 6.28 MB |

The ticket body said the daemon is *3 packages / 1.7 MB* — **count wrong, size right**. Iteration 1
said *4 packages / 3.4 MB / 652 files* — **count and files right, size wrong by about 2×**, because
2.8 M for `hono` is a `du` block figure and its byte total is 1.33 MB. The mirror grows by **+4
packages, +652 files, +1.72 MB**, and `apps/web` contributes **nothing** *provided* AC-2's demotion
happens; left as `dependencies` it would add +3 packages, +85 files and **+7.94 MB**.

The emitted-byte figures everyone has quoted are `du -k` too. Byte-exact:

```
apps/web/dist         3 files   317,278     packages/cli/dist      38 files   166,360
packages/server/dist 22 files   133,931     packages/core/dist     68 files   566,437
                                            packages/shared/dist   28 files   156,501
```

Distributed today **889,298 B**; five, **1,340,507 B** — **+451,209 B, +51%**, not *"+492 K on
1,168 K"*. AC-14 re-derives these and records the unit.

**(e) The `packages/<name>` defect is worse than "carry a path per member", and it appears at a third
site.** Iteration 1 named five helpers. Measured, the resolution that breaks is not keyed on a
register member at all: `versionOf(dependency)` is called with **a dependency name read out of a
manifest** —

```
for (const dependency of workspaceDepsOf(name)) { const substituted = versionOf(dependency); … }
```

— so after AC-4, `workspaceDepsOf('cli')` yields `@quorum/web`, `versionOf` calls `manifestOf('web')`
and `read(WORKSPACE, 'packages', 'web', 'package.json')` raises **`ENOENT` from inside a
`JSON.parse`**. A path column on `DISTRIBUTION` does **not** fix that. What is needed is a
**name → directory map spanning both workspace roots**. And the same assumption is encoded in
`README.md:74`'s documented pack loop, `for p in shared core cli; do (cd "packages/$p" …)`, which is
a third site and a user-facing one.

**(f) Deleting the clause-D exemption requires `open.ts` to carry no occurrence of the literal
`import(`.** `deferredOffenders` scans through `namedAsWritten`, which passes `(text) => text` —
**comments count, and the register's own docblock says so**. `open.ts` holds three `import(`
occurrences and **one of them is prose** (`:213`, *"the return type is a `typeof import(...)`
query"*). The natural rewrite — a docblock explaining that the import *used to* be dynamic — re-arms
it.

**(g) Three assertion groups invert in the packed fixture, not one**, and one of them is a deletion
rather than an inversion: the positive existence check that `@quorum/server` is **absent** from the
installed tree (`:2429–2430`), the refusal pair (`:2461–2462`), and the four-word loop forbidding
`missing`, `not installed`, `broken`, `omitted` — decision 094's central clause, which **loses its
subject** when the edge becomes required and must go with the entry rather than passing vacuously.

**(h) The damaged-daemon block deletes the installed daemon and asserts it stays deleted.** Under a
required edge the real package is present, so the fixture must **save and restore** rather than
create and remove, and every assertion after it — including AC-10's serving proof — becomes
order-dependent on that restore.

**(i) `engines` is not uniform across the distributed set.** Only `@quorum/cli` declares one. So a
distributed package owes `files` and a `license` and **not** `engines`; AC-1 and AC-3 say so, to
foreclose an implementer adding it by symmetry.

**(j) `docs/04-architecture.md` has at least four count-bearing sites**, not the three iteration 1
named: the **Shape** paragraph (`:12–14`), §`packages/server` (`:160–161`), the Testing-strategy line
(`:239`) and §`apps/web` (`:287`).

**(k) Two line citations in the ticket body point at the wrong assertion.** The packed refusal is
`build.test.ts:2461–2462`; **`:2482` is the damaged-daemon case**, and the workspace assertion is
**`:2134`**, inside the Q-0126 AC-8 block. The ticket body is the human's to correct.

---

## 1. Problem

**In the `adopter`'s words.** *"I installed Quorum into my project the way the README told me to —
three tarballs — and the first thing the documentation shows me is a web app I cannot open.
`quorum open` tells me `@quorum/server did not resolve from this installation`. It is a true
sentence and it does not help me: I did exactly what the README said, and the product's own mission
control is not in what it shipped me."*

**In the `maintainer`'s words.** *"Two packages emit and neither is packed. I ruled that a deliberate
gap twice — decision 092 on the UI, decision 093 on the daemon — and both entries routed the question
here by name. Q-0126 then shipped a command that has to apologise for it on one of the two
installation paths this repository claims and tests. The apology is correct, and it is the third
artefact in a row built on an unanswered question."*

**Mechanically.** The **local distribution set** is three tarballs and the **emitting set** is five;
`apps/web` and `packages/server` are the difference. `@quorum/cli` reaches the daemon through
`optionalDependencies` plus a dynamic import, which keeps the packed install *working* at the price
of one command that cannot run there. And `open.ts` finds the bundle at
`new URL('../../../apps/web/dist/', import.meta.url)`, which from `node_modules/@quorum/cli/dist/`
resolves to `node_modules/apps/web/dist` — a path with no meaning outside the workspace, which is
why that module's refusal order puts the bundle check last.

**The maintainer ruled the answer at the gate on 2026-09-15: tarballs four and five.** This document
implements that ruling; it does not reopen it. §7 records the alternative it displaces and why.

---

## 2. User stories

- **As the `adopter`**, I install Quorum into my own project from a local pack and run `quorum open`,
  and a browser shows me mission control — so the packed path and the workspace-local path are the
  same product and the README's install section has no footnote attached to it.
- **As the `maintainer`**, one ruling covers both packages that emit and are not distributed, so the
  next emitter inherits a decided rule rather than a third instance of an open question.
- **As the `contributor`**, one register says what emits and one says what is packed, and after this
  change they name the same five — so *emits* and *ships* stop being two facts I hold apart while
  reading five files.

---

## 3. Surfaces

`packages/cli` (manifest, `open.ts`, `open.test.ts`, `package.test.ts`, `frame.source.test.ts`, and
`build.test.ts`'s packed fixture), `apps/web` and `packages/server` (**manifests and their own
manifest guards only; no production source in either changes**), `packages/core`
(`test-discovery.test.ts`'s `namesTheDaemon` and its comment, `cli-version.test.ts`'s clause-D
register, `turbo-inputs.test.ts`'s two `NOT_READ` rows), and the documents —
`docs/04-architecture.md`, `docs/GLOSSARY.md`, `docs/06-development-plan.md`, `README.md`,
`docs/USAGE.md`, `harness/product-context.md` — with `packages/shared/src/docs.test.ts`'s registers
over them.

**No daemon route, no browser source, no screen, no flow file and no schema changes.**

---

## 4. Gate obligations

These are the human's and are settled **before** the chore run starts. Each is here rather than as a
criterion because no step on the route may perform it — *"A requirement may not name a surface its
flow cannot write"* (2026-08-25), whose fifth instance in this cut is the codex candidate's AC-1.

**GO-1 (BLOCKING, unchanged from iteration 1 and still unmet) — the decision entry lands at this
gate.** Verified at 2026-09-15: `docs/decisions/` ends at **095** and no entry rules this. AC-1,
AC-3, AC-5, AC-7 and AC-12 each replace an authority comment with a citation of it, so they are
literally unsatisfiable until it exists on disk. It must rule, in this order:

1. **The local distribution set is five, and it is the emitting set again** — naming *"A fourth
   package emits, and what it emits is served rather than shipped"* (2026-09-12) and *"A fifth
   package emits, and `resolved` is not a synonym for `distributed`"* (2026-09-12) as the entries
   whose open question it closes. Neither is edited. **The vocabulary separating *resolved* from
   *distributed* is not withdrawn**: the two axes stay independent and merely coincide again, which
   is the state 092 was written under and exactly what made its first wording go false. An entry
   saying *"the distinction was temporary"* re-creates the defect 093 removed.
2. **It supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14)**,
   which names this ticket and this act in its own clause. The exemption that entry authorises is
   **deleted, not widened**, and the consequence is stated rather than implied: the import becomes
   static (§8 OQ-1, ruled), the clause-D register goes, and **the four-word guard forbidding
   `missing` / `not installed` / `broken` / `omitted` goes with the entry that authorised it rather
   than passing over an unreachable branch** (§0.2(g)).
3. **`react`, `react-dom` and `@quorum/shared` become `devDependencies` of `@quorum/web`**, on the
   measured ground that *what a bundle contains* and *what npm must install beside a tarball* select
   **opposite** sets for a self-contained bundle. **The entry states the evidence, not the
   conclusion** — zero bare specifiers and zero `@quorum/shared` in the emitted bundle, against 7.94
   MB the tarball would otherwise oblige an adopter to install — because the rule it replaces is
   correct under its own framing and a reader meeting only the conclusion will restore it.
4. **`private: true` stays on all five**, with the reason written down: `pnpm pack` does not refuse a
   private package and only `npm publish` does. **078(d)'s refusal of registry-resolved `npx quorum`
   is untouched and Q-0029 stays in M6.** This clause exists so a later reader does not read
   *distributed* as *published*.
5. **What a distributed-but-unpublished package owes**: `files`, a `license`, and nothing else —
   `engines` explicitly not, because it is not uniform across the three already distributed (§0.2(i)).

**The entry must be landed before the chore run is launched, and its presence in the implement step's
actual prompt must be verified rather than assumed.** Q-0062 lost three rounds to a run launched
without an entry its own requirement had named in advance; Q-0097 lost two errata by not checking a
landed one reached the step; Q-0115 and Q-0125 both verified it by reading the prompt, and that is
the check to repeat.

**GO-2 (BLOCKING as a mechanism) — the landed entry is named in `requirements/errata.md`, not only in
`ticket.md`.** The chore `implement` step reads the errata file and **not** the body — Q-0125's
measured reason for owing a gate erratum — so without it the implementer reads a live blocker and
`blocked` is the verdict it correctly returns on round one.

**GO-3 — OQ-3's successor is opened as a ticket at this gate**, body written out in full, if the
ruling is that `resolvesOwnLocation` widens. Three obligations this month lived only inside a closed
ticket's prose or a source comment and were each lost for a week (Q-0110, Q-0111, Q-0112); Q-0113 and
Q-0114 are the precedent for the opposite.

**GO-4 — the seam and the remedy are named in advance.** Fourteen criteria is inside the ceiling and
near it, and R-3 measures that the obvious split makes the product **worse** in the interval. **If
the revise loop exhausts, the remedy is a second erratum splitting at that gate — not a fourth
implement round** (Q-0122 E-1). **AC-6, AC-9 and AC-10 are not eligible for trimming**: the first two
are the only genuinely unbuilt work, and the third is the thing the ticket exists for. The one piece
of separable work, if a split is forced, is **AC-9** — the mirror's resolver is a defect in a fixture
rather than a consequence of distribution.

**GO-5 — verification in both environment rows, forced, and CI green on the merged commit.** The
implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the
merge (Q-0072's closing finding). CI is named explicitly because the packed fixture is the one test
here that has been **red on CI while green locally for three days** (Q-0104), and this ticket both
doubles what it installs and changes how the mirror is built.

---

## 5. Acceptance criteria

*Fourteen. Each `Test:` clause bounds the instrument: a reviewer may find that the instrument fails
the job the clause gives it, and may not raise the job (Q-0067 E-1).*

---

### AC-1 — `apps/web` declares what a tarball needs, and nothing more

`apps/web/package.json` gains `files: ["dist"]`, `license: "Apache-2.0"`, and **one named
bundle-locator `exports` entry** whose target is `./dist/index.html` (shape ruled at §8 OQ-2). It
keeps `private: true` and declares no `main`, no `types`, no `bin`, **no `engines`** and **no `"."`
entry** — nothing imports the bundle as a module, and a `"."` added by reflex would make a 317 KB
bundle importable as JavaScript.

**Test:** `apps/web/test/package.test.ts`'s block *"and it emits without being distributed — no
exports, files, main, types or bin"* is **inverted rather than deleted**, and its authority comment
replaced with a citation of GO-1's entry. `exports` and `files` become required, `main`/`types`/`bin`
stay forbidden, `private` stays `true`. Shown red in **both** directions against fixtures: the
manifest as it stood before this ticket must fail the new block, and the new manifest must fail the
old one — because the cheapest wrong implementation is deleting the clauses that now fail, and that
is indistinguishable from the right one without the pair.

---

### AC-2 — `@quorum/web` has no runtime dependency, and the emitted bundle is the evidence

`react`, `react-dom` and `@quorum/shared` move to `devDependencies`; `dependencies` is absent or
empty. `JUSTIFICATIONS` keeps one entry per declared package, which it already does across both
sections, so the move costs no re-justification.

**Test:** four parts, because the claim has four halves and only one is a manifest read.

(a) **The manifest.** The existing test *"the two that ship to a browser are dependencies, and the
build-time ones are not"* is **rewritten rather than deleted**, and its comment states the measured
reason — *what npm must install beside a tarball*, not *what the bundle contains*.

(b) **The evidence, asserted over the emitted bundle rather than argued.** The built
`apps/web/dist/assets/*.js` carries no bare import specifier — nothing matching `from '<name>'` where
`<name>` begins with neither `.` nor `/` — and no occurrence of `@quorum/shared`. **The needle is
shown to discriminate** against a fixture containing `from 'react'`, or the scan proves nothing.

(c) **The build graph survives the demotion**, measured after the move rather than assumed:
`turbo run build --dry` still reports `@quorum/web#build` depending on `@quorum/shared#build`, as it
does today. **If the edge is lost, the remedy is an explicit `dependsOn` and this criterion gains a
clause** — a bundle built against a stale `@quorum/shared` is decision 092 clause 5's hazard on a new
artifact.

(d) **What a packer writes for a `workspace:` range in `devDependencies` is measured, not assumed.**
The packed-manifest test asserts rewriting for `dependencies` and `optionalDependencies` only. If
`pnpm pack` leaves `@quorum/shared` as a literal `workspace:*` in the shipped `@quorum/web` manifest,
that is recorded — latent, because npm does not install a dependency's `devDependencies`, and
therefore **reported rather than repaired here**. What is refused is shipping it unmeasured.

---

### AC-3 — `packages/server` declares what a tarball needs

`packages/server/package.json` gains `files: ["dist"]` and `license: "Apache-2.0"`, keeps
`private: true` and its existing `exports` map, and declares no `main`, `types`, `bin` or `engines`.

**Test:** `packages/server/src/package.test.ts`'s `emitsAndIsNotDistributed` invariant is the
subject. The clause forbidding `files` inverts; `bin` stays forbidden and `private` stays required;
and **the predicate is renamed to what it now asserts** — a function called
`emitsAndIsNotDistributed` returning `[]` for a distributed package is a name that lies. The existing
both-directions demonstration is kept and re-aimed: the pre-Q-0125 fixture must still fail the
emission half **by name**, and a fixture with `files` removed must now fail the distribution half
**by name**, so deleting the failing clause is distinguishable from satisfying it.

---

### AC-4 — `@quorum/cli` requires the daemon and declares the web app

`@quorum/server` moves from `optionalDependencies` to `dependencies`; `@quorum/web` is added to
`dependencies`, without which `import.meta.resolve` in AC-6 cannot answer; `optionalDependencies` is
removed entirely.

**Test:** `packages/cli/src/package.test.ts`'s Q-0126 AC-7 block moves, in three separately-red
parts: (a) `dependencies` is exactly `@quorum/core`, `@quorum/server`, `@quorum/shared`,
`@quorum/web` at the workspace range convention; (b) `optionalDependencies` is `undefined` and
`devDependencies` stays `undefined`; (c) **the key-set derivation is kept** — every key ending
`dependencies` — and becomes `['dependencies']`, so a fourth section still cannot arrive unremarked.
That derivation is not replaced by three literal checks: it is the clause Q-0126 added precisely
because an optional edge was invisible to a strict read of `dependencies` alone.

And `turbo run build --dry` is re-derived: `@quorum/cli#build` now depends on `@quorum/web#build`,
which is the fact AC-13(d)'s documentation correction rests on. Its dependence on
`@quorum/server#build` is **unchanged** and is asserted as such, because §0.1 measures that edge as
already present through the optional key.

---

### AC-5 — the rule that forbids a required daemon edge is inverted, predicate and fixtures together

`packages/core/src/test-discovery.test.ts`'s `namesTheDaemon` **states in code that AC-4 is a
defect** — *"packages/cli/package.json requires @quorum/server, which kills the packed install"* —
and its sibling clause reports a `packages/cli` that declares **no** optional edge. Both branches
move: a required edge on `packages/cli` becomes the permitted shape, an optional one becomes the
reported problem, and the rest of the rule — that no other manifest may depend on the daemon, and
that `packages/server` may name it once as its own `name` — is unchanged.

**Test:** the existing `hostile` / `permitted` fixture pair is **inverted rather than deleted**, run
through the same predicate the real manifests go through, and the assertion that the two differ **in
the key alone** — equal occurrence counts — is kept, because it is what forbids a later predicate
going back to counting. The authority comment citing decision 094 is replaced with a citation of
GO-1's entry. **A `@quorum/web` edge on `packages/cli` is new to this rule's subject**: the criterion
states whether `namesTheDaemon` widens to cover it or whether the web edge is deliberately
ungoverned, and either answer is written down rather than left to be inferred from silence.

---

### AC-6 — `quorum open` finds the bundle by package name, and one expression answers both installations

`packages/cli/src/open.ts` replaces `new URL('../../../apps/web/dist/', import.meta.url)` with a
resolution through `import.meta.resolve` against `@quorum/web`'s bundle locator, deriving the
containing `dist/` URL and handing it to `ServeOptions.bundle` **unconverted**. `packages/cli` imports
no `node:url` (`frame.source.test.ts:186`), so `fileURLToPath` is unavailable and `.pathname` is not a
substitute — the `string | URL` seam Q-0126 widened is what carries it. No workspace-relative fallback
survives, and there is no silent fallback when the locator cannot resolve.

**Test:** five parts.

(a) **Both installations, by execution rather than by reading.** In the workspace, a plain `node`
process running the built `packages/cli/dist/quorum.js`; in the packed fixture (AC-10), the same emit
resolving inside `node_modules/@quorum/web/`. **One expression answers both** — the property the
relative path did not have, and which no unit test of the expression alone establishes.

(b) **A missing build still refuses with `packages/server`'s own sentence**, naming a directory that
exists in the installation the reader is standing in. `import.meta.resolve` answers from the manifest
without the target existing, so the `NO_BUNDLE_CODE` refusal stays reachable; asserted by running
`quorum open` against an installation whose `@quorum/web/dist` has been removed and checking the named
directory is inside that installation and **not** `node_modules/apps/web`.

(c) **A source test fails on restoration of the old workspace-relative locator**, so the fix cannot be
undone silently.

(d) **The `SELF_LOCATING` register moves, forced rather than tidy.** `resolvesOwnLocation` matches
`/\bimport\.meta\.(url|dirname|filename)\b/` over `codeOf(text)` and **does not match
`import.meta.resolve`**; `locationOffenders` fires in both directions, so with `open.ts`'s entry left
in place the suite reports *"its entry permits a self-location the module does not perform"* —
demonstrated. The register returns to `{'init.ts': …}`, the assertion Q-0126 added at
`frame.source.test.ts:605` to **refuse** that value (`.not.toStrictEqual(['init.ts'])`) is inverted
with a comment naming this ticket, and **the register's docblock paragraph arguing why Q-0126 admitted
a second entry moves with it** rather than being left describing a register that no longer has one.

(e) **The refusal order becomes two members and its stated reason is corrected.** The order is ruled
today as daemon → project → bundle *because* the bundle path was meaningless on a packed install.
AC-7 removes the first member and this criterion removes the reason for the third's position. The
resulting order is stated afresh; what may not survive is a docblock giving a reason that has stopped
being true, which is the defect this repository records most often.

---

### AC-7 — the daemon specifier stops being deferred, and the register that permitted it goes

`open.ts` imports `@quorum/server` statically. `daemon()`, `isDaemonUnresolved`,
`NO_DAEMON_CONDITION` and `NO_DAEMON_REMEDY` are deleted, with their tests in `open.test.ts` and the
`build.test.ts:49` import that reads them. `packages/core/src/adapters/cli-version.test.ts`'s
`DEFERRED_SPECIFIER` register is deleted and clause D returns to an empty result with **no register
and no exemption** — the state decision 094 describes as the one it departed from.

**Test:** three parts.

(a) `build.test.ts`'s Q-0126 AC-8 block **inverts**: the emitted `open.js` must carry a static
`from '@quorum/server'` and must not carry `import('@quorum/server')`, both needles keeping their
existing discrimination checks over planted fixtures.

(b) Clause D's both-directions demonstration is kept — a planted dynamic import anywhere in
`packages/core/src` or `packages/cli/src` production source is still reported by name — so deleting
the register is shown to be a **return to a stricter rule** rather than a relaxation, and the
register-emptiness assertion moves from `['packages/cli/src/open.ts']` to `[]`.

(c) **`open.ts` carries zero occurrences of the literal `import(` and `require(`, comments
included.** `namedAsWritten` passes `(text) => text`, so the prose at `open.ts:213` re-enters the
file into `found` with no entry and the suite reports *"it resolves a module from an expression and
no entry says why it may"*. This clause is stated because the natural rewrite — a docblock explaining
that the specifier **used to** be deferred — re-arms it, and because that failure reads as unrelated
to the change that caused it.

---

### AC-8 — the distribution register is five, and a package name resolves to a directory across both workspace roots

`build.test.ts`'s `DISTRIBUTION` becomes five members, and **every resolution of a package to a
directory is derived rather than spelled `path.join(WORKSPACE, 'packages', name)`**. That covers the
register loops (`DECLARED_FILES`, the pack loop, the packer-agreement loop, the closure loop) **and**
`manifestOf`/`versionOf`, which are reached with a **dependency name read out of a manifest** rather
than with a register member — `versionOf('@quorum/web')` is the call that arrives from
`workspaceDepsOf('cli')`. `DECLARED_FILES` gains `web: ['dist']` and `server: ['dist']`.

**Test:** the mapping is shown **root-aware by the failure it produces**: a member or a dependency
whose recorded root is wrong must fail naming that name and that path, **not** with an `ENOENT`
raised from inside a `JSON.parse` — the one place a wrong implementation fails in a way that gets
repaired with a `try`/`catch`. And the derivation is shown not to have quietly narrowed: `dependents`
— the members declaring a workspace dependency, read through `declaredDeps`, which reads
`dependencies` and `optionalDependencies` and not `devDependencies` — is re-derived and asserted as
an identity, which after AC-2 and AC-4 gains `server` and does **not** gain `web`.

The build census is re-run unchanged and must stay green: each package still emits only under its own
`dist/`, and nothing copies an artifact across packages (§6 non-goal 3).

---

### AC-9 — the offline mirror can walk a closure whose packages restrict `./package.json`, and names what it covered

`collect` resolves each dependency with `createRequire(…).resolve('<name>/package.json')`, which
**every one of the daemon's three dependencies refuses** with `ERR_PACKAGE_PATH_NOT_EXPORTED` while
every dependency the mirror carries today allows it (§0.2(b)). The walk must therefore stop depending
on a subpath the dependency chooses whether to export.

**Test:** four parts.

(a) **The resolver is shown to handle both kinds**, by walking the real closure and by a fixture
package that declares an `exports` map without `./package.json` — so the fix is established against
the shape that breaks it rather than against the shape that already worked.

(b) **The closure is asserted as an identity, never a count** (Q-0073), and the identity is the
twelve measured in §0.2(c), with **`ws` named explicitly** — it is reached only transitively and is
the package every earlier account missed.

(c) The existing per-package completeness guard — a mirrored tarball's entry count against the
installed tree's file count, naming the package on a shortfall (Q-0104) — covers the four new
members.

(d) The measured delta is recorded in the fixture's comment **beside the figure it supersedes**, and
**that `apps/web` contributes nothing** is recorded with it: it is AC-2's measured payoff and the
reason the demotion belongs to this ticket rather than being a tidy-up.

---

### AC-10 — the packed install carries the UI, and `quorum open` serves a page there

The fixture packs and installs **five** tarballs together into a project outside the repository with
the registry unavailable, and `quorum open` in that installation starts, binds loopback and serves
the shell.

**Test:** six parts, and the first three are the criterion.

(a) **The install is part of the criterion, not a precondition.** It must fail if npm reaches the
registry for any of the five, for React, or for anything in the daemon's closure. **A failed install
is a failed criterion, not a skipped runtime check.** The positive existence check asserting
`@quorum/server` is **absent** from the installed tree inverts with it (§0.2(g)).

(b) **A served page, not an exit code.** The refusal assertions at `build.test.ts:2461–2462` invert
to a positive: the command is started against a fixture project with browser launching suppressed
(`--no-open`; **no real browser is opened on the test machine**), the URL is taken from what the
command prints, `GET /` over the real socket answers **200 `text/html`** carrying the built shell,
and the process is stopped through the existing shutdown path and exits cleanly. **An existence check
on `node_modules/@quorum/web/dist` is explicitly not sufficient** — it is the assertion that passes
over a tarball shipping an empty directory, which is the failure Q-0093 AC-5(d) exists to prevent at
the neighbouring site.

(c) **The test proves it used the packed artifacts.** Before starting, the fixture makes the source
workspace unreachable to the child process, or demonstrates that the resolved daemon module and the
resolved bundle URL are both inside the external installation's `node_modules`. The verdict may not
depend on a workspace `dist`, a repository symlink or any gitignored directory left by prior local
use — *"A test's verdict is a property of the commit, not of the checkout or the account"*
(2026-08-30), and the resolver differs between the suites' `quorum-source` condition and a packed
install's `default`.

(d) **The damaged-daemon block is re-aimed and its fixture inverted in kind.** Today it *creates* a
fake `@quorum/server`, damages it, and deletes it, asserting it stays deleted. Under a required edge
the real package is present, so it must **save, replace and restore**, and the restore must be
asserted — otherwise every assertion after it, including (b), runs against an installation this
paragraph broke. What must hold is unchanged: a daemon that resolved and then failed reports its own
error rather than a packaging sentence.

(e) **The four-word guard goes with the entry that authorised it.** `missing`, `not installed`,
`broken`, `omitted` is decision 094's central clause and has no subject once the edge is required;
it is deleted with the supersession rather than left passing over an unreachable branch.

(f) **The workspace-local path stays green and stays distinguishable.** The workspace assertion at
`:2134` still holds and success in one installation may not satisfy the other's.

---

### AC-11 — every other command in the packed install is unchanged

`quorum help` prints the frame's command list, `quorum init` scaffolds the shipped template tree, and
the shim still resolves inside the temporary project rather than back into the repository.

**Test:** the existing assertions are kept **unaltered** and are the regression guard, not new work —
including that the list is **derived from `HELP` rather than transcribed**, which is what keeps this
criterion from pinning a count. This criterion exists because decision 094's *Alternatives
considered* refused the required edge precisely on the ground that it breaks `quorum help` and
`quorum init` in a packed install. **Shipping the daemon voids that refusal, and this criterion
proves the voiding rather than assuming it.** The comment at `build.test.ts:2443–2448` explaining
that the deferred specifier is *what keeps every other command working* moves with the mechanism.

---

### AC-12 — every register, comment and document stating the old split moves, and the append-only entries do not

`test-discovery.test.ts`'s comment that the emitting set is five and the distribution set three, and
the three sentences in the same file claiming *"the three tarballs"* as a measured consequence of the
required edge; `turbo-inputs.test.ts`'s `NOT_READ` rows for `apps/web` and `packages/server`, each
stating its subject is *not distributed*; `docs/04-architecture.md`'s **four** count-bearing sites
(§0.2(j)); `docs/GLOSSARY.md`'s **Emitted artifact** entry; and `docs/06-development-plan.md`'s M3
boundary. The sentences that go false are precisely *"the local distribution set is the first
three"*, *"`@quorum/web` and `@quorum/server` are the difference"* and *"how an installation outside
this workspace obtains the UI **or the daemon** is an open question"*. **The definitions of *resolved*
and *served* are not touched**: they are defined by mechanism since decision 093, and this ticket
changes neither mechanism.

**Test:** the assertion that `emittingPackages()` is the five is **unchanged** — this ticket adds no
emitter — and the comments beside it are held against the register they describe. `docs.test.ts`'s
`LIVE` / `SUPERSEDED` / `HISTORICAL` triple is extended in the shape it already has: every sentence
stating the old split goes to `SUPERSEDED` with its negative shown to have a subject against a
fixture reproducing today's text, every new sentence to `LIVE`, and `HISTORICAL` gains nothing but is
re-run — **so a blanket find-and-replace over "three" fails as loudly as an omission**, decisions 092,
093 and 094 being append-only and required to go on reading as they do.

---

### AC-13 — the installation documents describe the install a stranger will actually perform

Four corrections, and the fourth is the one no existing register would have caught:

(a) `README.md`'s packed-install block: **five** tarballs, and `:74`'s
`for p in shared core cli; do (cd "packages/$p" …)` rewritten to cover **both workspace roots** —
`apps/web` is not under `packages/`, which is §0.2(e)'s finding at a user-facing site.
(b) `README.md:161–162`'s paragraph beginning *"`quorum open` works from the workspace and not from a
packed install"* is **deleted**, not softened.
(c) `docs/USAGE.md:288–293`'s equivalent paragraph is deleted, and the two sentences routing the
question to Q-0124 with it.
(d) **`docs/USAGE.md:286` says `--filter=@quorum/cli` does not build the web app and shows what that
failure looks like. AC-4 makes that false**, `@quorum/cli#build` gaining a `^build` edge to
`@quorum/web#build`. The sentence is **corrected rather than removed** — the advice it gives is still
needed and its example is now the other way round.

`harness/product-context.md`'s quality pillar 7 moves in the same change: decision 094's named
`quorum open` exception is deleted, the distribution set becomes five, and the sentence routing the
question to this ticket is replaced by the answer.

**Test:** `docs.test.ts` holds the tarball count in `README.md` against the distribution register's
size rather than a literal, and the pillar-7 clause against the same register — so a sixth
distributed package fails until both documents move. **Pillar 7 is asserted first of the four**: it
is fed to every product-manager step at run time, which is Q-0098's finding and the reason a false
installation claim there is one every future requirement inherits.

---

### AC-14 — the cold-clone cost is re-derived, recorded beside what it supersedes, and compared with M6's budget

Measured after the change rather than predicted: emitted bytes now distributed, packed tarball bytes,
the mirror's growth in size and package count, the packed install's cold wall-clock against Q-0014's
baseline — that ticket measured the app's *dependencies* doubling a cold store to 10.4 s and +50 MB,
and this ticket ships **none** of them, which is the comparison worth making — and **`quorum help`'s
startup before and after**, because `main.ts` loads every command module and AC-7 makes the daemon a
static import paid on every invocation.

**Test:** recorded in the implement report and in the fixture's comments **beside the figures they
supersede**, in the shape Q-0125 used for its three re-measured budgets, so the movement is visible
rather than silent. **Every figure names its unit and its method**: §0.2(d) measures that the numbers
carried by the ticket body and by iteration 1 of this document disagree with each other because some
are `du` block sizes and some are byte sums, and a record that does not say which is a transcription
waiting to happen. **No criterion asserts a byte count or a duration** — Q-0096 E-1 and Q-0098 E-1
each retired a count assertion here for the same reason. **A probe that cannot complete is reported
as inconclusive, never as zero cost.**

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
   `packages/cli/templates/` is twenty *tracked source* files and `apps/web/dist` is gitignored output.
5. **A JavaScript API for `@quorum/web`.** Its export is a stable locator for a served artifact;
   nothing imports it, and AC-1 adds no `"."` entry.
6. **A `--bundle` flag or any second way for an operator to point at a bundle** (Q-0126 non-goal 6).
   AC-6 keeps the number of ways at one, and adds no download-a-missing-package fallback.
7. **Supporting an installation given only a subset of the five tarballs.** The fixture installs them
   together and that is the supported shape.
8. **Optimising, externalising or splitting the web bundle** beyond the manifest demotion.
9. **Any change to the daemon's routes, host lifecycle, browser-launch behaviour, the web UI's
   contents, or the `quorum open` contract** beyond resolving the packaged daemon and bundle. The
   screens are Q-0015 to Q-0018.
10. **Any change to a flow, gate, adapter, ticket schema, backlog format, run-history format, turbo
    test/lint/typecheck topology, or `.quorum/` behaviour.**
11. **Windows.** `openUrl` names it `unsupported` explicitly and this ticket does not revisit it.
12. **Q-0123** — the run-host record that is never released. Different subject, still p3.

---

## 7. The alternative the gate displaced, recorded rather than dropped

**The cross-package copy — `@quorum/cli#build` copies `apps/web/dist` into its own `dist/`.** It is
**not** refused by the build census, which the ticket body first claimed and then corrected: the
census permits a write inside any emitting package's own `dist/`. It is refused on three grounds:

- `@quorum/cli#build` does **not** depend on `@quorum/web#build` — measured from
  `turbo run build --dry=json` — so the copy would read a `dist/` that may not exist yet. Declaring
  the edge makes the tarball route available anyway.
- `apps/web/dist` would have to become a declared **input** of `@quorum/cli#build`, or a cache hit
  replays a stale bundle — **verbatim decision 092 clause 5's hazard, on the artifact it was written
  about.**
- **It does nothing for the daemon**, which is executable code with a 1.72 MB install closure no asset
  copy can carry. The two packages needed *different* answers under the copy shape and the *same*
  answer under the tarball shape, which is the strongest argument for the ruling taken.

---

## 8. Open questions

**OQ-1 — does the daemon import become static? Ruled: yes, and it is not open.** Decision 094 says of
itself that *"the exemption it authorises is deleted, not widened"*, and `deferredOffenders` fires in
**both** directions — an unregistered dynamic import is reported, *and* so is an entry permitting a
specifier the module does not use. So a deleted exemption **forces** a static import unless clause D
itself is relaxed, which is the widening 094 forbids. The cost is answered rather than hedged: a
required dependency that fails to load breaks every command, which is **already true of
`@quorum/core` and `@quorum/shared`**, so the behaviour becomes uniform with the other two required
edges rather than special. AC-14 measures the startup half. **If that measurement argues the other
way, the remedy is a new entry at a gate, never an implementer's choice.**

**OQ-2 — what shape is `@quorum/web`'s `exports` map? Ruled: one named bundle-locator subpath whose
target is `./dist/index.html`, no `"."` entry, and the caller derives the containing directory from
the resolved URL.** Picked over a `"./dist/*"` wildcard: a single documented locator keeps the
package's internal layout private, so a later change to the hashed emitted filenames does not move
the CLI, and it exposes one path rather than every emitted file. **If Node or pnpm rejects that export
shape under the red test, the engineer stops and returns the measured failure to the gate** — they
must not substitute a workspace-relative path, a package-root reach-through, a copied artifact or an
undocumented export.

**OQ-3 — does `resolvesOwnLocation` widen to see `import.meta.resolve`?** Not blocking, and **not
this ticket**. The register entry must be *removed* either way (AC-6(d)), because it fires in both
directions. Whether the predicate widens is a guard-idiom question reaching every production module in
`packages/cli`, a surface this ticket does not otherwise touch — and it is **a guard keyed on a name
rather than on the behaviour it is about**, the family this repository has now recorded seven times.
Recommended: widen, in its own ticket, opened at this gate (GO-3).

**OQ-4 — is `Apache-2.0` the right licence for both?** Assumed, matching the three already
distributed. If not, AC-1 and AC-3 name a different value and nothing else moves.

**OQ-5 — how does the mirror resolve a dependency that does not export `./package.json`?** Not
blocking on the *ruling* and blocking on the *implementation*, which is why it is AC-9 rather than a
question: walking `node_modules` upward from the importer, resolving the package's main entry and
walking up to its root, and reading the manifest off disk are all admissible; guessing is not. The
criterion requires the chosen shape to be demonstrated against a fixture that reproduces the
restriction.

**Nothing above blocks solutioning. The blockers are GO-1 and GO-2** — the decision entry several
criteria cite does not exist, no step on the route may write one, and the errata file the implement
step actually reads does not name it.

---

## 9. Risks

**R-1 — the packed fixture grows, and it is already the slowest thing in the suite.** Two more
tarballs to pack, four more packages to mirror (+652 files, +1.72 MB), and a resolver change, on a
test with a 300 s budget that runs a full `runBuild()` first. Mitigated by AC-2: `apps/web`
contributes nothing, where keeping React under `dependencies` would have added 7.94 MB and 85 files.
Re-measure the fixture's wall-clock at the gate; if it approaches the budget **the budget moves and
the measurement is recorded beside it** (Q-0125's shape), never the coverage.

**R-2 — the mirror meets peer dependencies at scale for the first time.** `@hono/node-server` peers on
`hono` and `@hono/node-ws` on both; `collect` walks `dependencies` only, so peers are satisfied
incidentally by siblings already mirrored. `ajv-formats` peers on `ajv` and the fixture handles it
today, which is the precedent — but three peer edges against a dead registry is a new load, and a
failure surfaces as an opaque npm resolution error rather than as a named shortfall.

**R-3 — this ticket cannot be shipped on the obvious seam, and that is measured rather than asserted.**
Distributing `@quorum/server` alone makes the daemon resolve, after which packed `quorum open` falls
through to the **bundle** refusal and names `node_modules/apps/web/dist` — verified by resolving
`../../../apps/web/dist/` from `node_modules/@quorum/cli/dist/` — a meaningless path, strictly worse
than the honest, tested sentence shipped today, with `build.test.ts:2461` red either way. The seam
that *does* work is AC-6 / AC-7 plus AC-10 — the `open.ts` half — and splitting there leaves a packed
install carrying a bundle nothing can find. **Both halves ship together or neither does**, and GO-4
names AC-9 as the one separable piece and the erratum remedy if the loop exhausts anyway.

**R-4 — fourteen criteria, one more than iteration 1, and near the ceiling.** Q-0013 was refused at
eighteen and Q-0122 accepted twenty at the cost of three implement rounds. The addition is AC-5,
which is a criterion because the alternative is an implement round spent meeting it as a red suite.
Three of the codex candidate's nineteen were struck for not being criteria at all (§12), which is
where the reduction came from rather than from trimming subject matter.

**R-5 — a required dependency changes how a damaged installation fails.** Today a broken
`@quorum/server` costs one command; statically imported, it costs all ten. A consequence of the
ruling rather than a defect in it, uniform with the other two required edges, and AC-10(d) is what
keeps the failure legible.

**R-6 — `import.meta.resolve` may answer differently under Vitest than under plain Node.** The suites
resolve through `quorum-source` and a packed install through `default`. AC-6(a) and AC-10(c) require
the proof from a plain `node` process against the built emit in **both** installations, for exactly
this reason — a Vitest-only assertion proves the wrong resolver.

**R-7 — the `packages/<name>` assumption is where a wrong implementation passes vacuously**, and it
now has three sites: five loops in `build.test.ts`, the `manifestOf`/`versionOf` pair reached with a
dependency name, and `README.md:74`'s documented shell loop. AC-8's `Test:` clause bounds the first
two by requiring the failure to name the subject and the path; AC-13(a) covers the third.

**R-8 — the authority prose in `open.ts` is six paragraphs of decision 094's reasoning**, and AC-7
removes its subject. `.claude/rules/engineering.md` asks for one line naming the authority and
forbids transcribing a decision into a source file; a rewrite that explains at length why the import
is no longer dynamic is the violation a cross-vendor review caught in Q-0067 and Q-0111 within two
days of each other — and, per AC-7(c), the one most likely to re-arm clause D by writing `import(`
in prose.

---

## 10. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | No credential on any path, and no new dependency accepts a key. `apps/web`'s credential scan must stay green — and after this ticket it covers a package that is *distributed*, which raises what it is worth rather than changing it. |
| **Worktree safety** | n/a. No flow writes anything here and no code path touches the adopter's working tree. |
| **Gate behaviour** | n/a to the code. The ticket's own route carries five gate obligations (§4); GO-1 and GO-2 are blocking. |
| **File format and schema** | n/a. No zod schema, artifact shape, `harness.yaml` key or run-history field changes. The only files whose *format* moves are `package.json` manifests, and npm owns that schema. |
| **Lint rules** | n/a. No flow-lint rule and no ESLint configuration moves. |
| **Cold-clone impact** | **The point of the ticket**, and it cuts both ways: +451 KB of emit across two tarballs and +1.72 MB of daemon closure, and in exchange the adopter's installation gains the product's UI. AC-14 re-derives every figure against M6's thirty minutes. Q-0014's +50 MB for the app's own dependencies is explicitly **not** incurred, which is AC-2's purpose. |
| **Product boundaries** | No product-specific reference. *Distributed* stays the word for what a tarball needs; *published* is Q-0029's, and GO-1 clause 4 keeps them apart. |
| **Vocabulary** | **No new glossary term is coined and none is owed.** *Emitting set*, *local distribution set*, *resolved*, *served* and **Emitted artifact** all exist; this ticket changes a membership, not a vocabulary. Neither term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). |

---

## 11. Sequencing

**After Q-0125 and Q-0126**, both landed. **p2**, unchanged: on the cold-clone path M6 turns on, and
nothing is broken for a workspace user today.

**It closes three routed questions at once** — decisions 092's, 093's and 094's, each of which names
Q-0124 by name — which is the argument for ruling it here rather than a fourth time at the next
emitter.

**It is M3 work despite living on M6's path**: the milestone's own done-when says *"`quorum open`
starts daemon + browser"*, and a command that does so on one of two claimed installation paths meets
that line with a footnote. This removes the footnote.

---

## 12. Provenance

**From the claude candidate**, kept: §0's method of re-measuring the ticket body rather than
transcribing it; the `packages/<name>` register-shape finding, sharpened at §0.2(e) and AC-8; the
bidirectional reading of `deferredOffenders` that decides OQ-1; the `SELF_LOCATING` consequence; the
gate-obligation structure; the both-directions inversion discipline on every register that moves;
R-3's measured argument against the obvious seam; the `LIVE`/`SUPERSEDED`/`HISTORICAL` shape for the
documents; the `--filter=@quorum/cli` sentence in `USAGE.md` that AC-4 makes false; the
`@quorum/shared` half of the demotion; and the licence gap.

**From the codex candidate**, taken where it was sharper: **AC-10(c) — that the packed test must prove
it used the packed artifacts**, the anti-vacuity half neither other account carried as a requirement,
and the criterion most likely to have produced a false green given this repository's own history; the
named bundle-locator export shape and the instruction to stop and return a measured failure to the
gate if Node rejects it; *"a failed install is a failed criterion, not a skipped runtime check"*; the
explicit *"must fail if npm reaches the registry"*; *"must not open a real browser on the test
machine"*; the ruling that the answer is **static** rather than an open question; and the framing that
build ownership stays package-local.

**Struck.** The codex candidate's **AC-1** (the decision entry as an acceptance criterion) names a
surface the chore flow cannot write — *"A requirement may not name a surface its flow cannot write"*
(2026-08-25), the fifth instance in this cut — and is **GO-1** instead. Its **AC-18** (cross-cutting
constraints unchanged) is §10. Its **AC-19** (install, test, lint, typecheck pass) is the standing
definition of done and GO-5. Its **AC-4** and **AC-11** are folded into AC-1/AC-3 and AC-10 as
clauses. Its **AC-16** is a non-goal with a regression clause on AC-8. Its **AC-9** wording leaving
`@quorum/shared` *"in the dependency class required by the build"* is replaced by the explicit
demotion.

The claude candidate's **AC-6** is folded into AC-6 as clause (d), and its **AC-12** into AC-12.

---

## 13. What iteration 2 changed, and why

The tree did not move, so **the verdict does not move**: GO-1 is unmet and no step on the route can
meet it. What moved is the document.

1. **AC-5 is new** — `namesTheDaemon` is a live rule in `packages/core` that forbids AC-4 by name,
   with a fixture pair asserting both of its sentences. Iteration 1 named only this file's *comment*.
2. **AC-9 was rewritten from a register extension into real work** — `collect`'s resolver cannot walk
   the daemon's closure at all, which also refutes iteration 1's §0.2(a).
3. **The closure identity iteration 1 asserted was corrected from eight names to twelve**; as written
   it omitted `ajv`'s four transitive dependencies and would have shipped red.
4. **Every size figure was re-derived byte-exact** and both earlier accounts were found wrong in
   different halves; AC-14 now requires each recorded figure to name its unit and method.
5. **AC-8 was sharpened** from *"carry a path per member"* to a name-to-directory map spanning both
   roots, because the call that breaks is reached with a dependency name rather than a register
   member — and the same assumption was found in `README.md`'s documented pack loop (AC-13(a)).
6. **AC-7 gained clause (c)** — `open.ts` must carry no literal `import(` in its text, comments
   included.
7. **AC-10 gained (d) and (e)** — the damaged-daemon fixture must save and restore rather than create
   and delete, and decision 094's four-word guard goes with the entry rather than passing vacuously.
8. **GO-2 was promoted to a blocker of its own**, because naming the entry in `ticket.md` alone does
   not reach the step that has to read it.
