# The emit serves the binary, and no test verdict moves behind it — 2026-09-02

*Owed by Q-0096's AC-0 and written by hand at its requirements gate, because no step on the chore
route may write a decision entry (`harness/roles/developer-generalist.md:23`). It rules seven things
for Q-0096, Q-0097 and Q-0098, and nothing in any of the three may be implemented before it.*

**Decision:** **(a) The emit strategy is `tsc` per consumable package, ruled against the workspace as it will
stand after Q-0091 to Q-0094, not against today's.** Each package that something outside the
workspace consumes — `@quorum/shared`, `@quorum/core`, `@quorum/cli` — emits JavaScript and
declarations to its own `dist/`, with a `build` task ordered by `dependsOn: ["^build"]`. No bundler
and no new dependency: `tsc` is already the typecheck gate.

The ruling is made against the later tree deliberately. Measured today, `packages/cli`'s only
cross-package **production** import is `import type { RunTerminalEvent }` at `exit.ts:12`, which is
erased at emit — so a `tsc` emit of `packages/cli` alone would work right now, and would stop
working at Q-0091's first value import of `@quorum/core`. A strategy that expires at the next
sibling forces the ruling to be re-made inside a command child by a step that does not own it.

**(b) The workspace suites keep resolving TypeScript source. The emitted artifact is what Node and a
packed install resolve, and nothing else.** Each consumable package's `exports` becomes a
conditional map in which a workspace-only condition resolves `./src/index.ts` and the default
resolves `./dist/index.js`; `tsconfig.base.json` (TypeScript 5.9.3, `moduleResolution: nodenext`)
gains `customConditions` so `tsc` honours the same condition, and the Vitest configuration is
made to honour it too. **The exact configuration keys are the implementer's to establish and must be
demonstrated in both directions** — a resolution proof from `tsc` and one from Vitest, plus a proof
that a plain `node` process, which knows no such condition, gets `dist/`. Naming a mechanism that
has not been run is the thing this repository keeps paying for.

The consequence, which is the point of the whole ruling: **`test` and `typecheck` gain no `^build`
edge, and no verdict that exists today moves behind a build artifact.** Re-derived for this entry
rather than transcribed, per Q-0010 ground rule 5 — one forced run, 2026-09-02:
`@quorum/shared` **142**, `@quorum/core` **1,280 passed and 2 skipped**, `@quorum/cli` **94**, plus
one test each in the four stub packages `server`, `web`, `compiler` and `templates`. Under (b) all
1,520 keep proving source. Under the rejected Shape B every one of them would prove an artifact.

**(c) `build` is a root task, and it is owed by the packages that emit rather than by every
package.** Root `turbo.json` declares it beside `lint`, `typecheck` and `test`, with
`dependsOn: ["^build"]` and `outputs` naming the emit directory — **non-empty, which is the property
no task in this workspace has ever had**, all three existing tasks declaring `[]`. Package-level
`turbo.json` files continue to declare `inputs` and nothing else, so root `turbo.json` stays the one
place `env` is decided and the merge keeps `QUORUM_REAL_CLI` (Q-0065).

`@quorum/shared`, `@quorum/core` and `@quorum/cli` declare a `build` script. The four stub packages
do not, and turbo skips a package with no script **in silence** — which is exactly why
`packages/core/src/test-discovery.test.ts:59` and `packages/cli/src/package.test.ts:76` may not go
on hand-writing `['lint','typecheck','test']`. The sentence those registers assert becomes: *every
package owes lint, typecheck and test; build is owed by the packages that emit, and the register
names which.* Derived from `turbo.json` and from the emitting set, so neither can narrow without
failing. That is Q-0097's AC-13 and it is the reason `build` being a root task is ruled here rather
than left to the implementer.

**(d) `npx quorum` may claim two paths and not three.** Supported and tested: the **workspace-local**
path, and a **locally packed tarball** installed into a temporary project outside the repository.
**Registry-resolved `npx quorum` is refused, not deferred** — every package is `"private": true`,
`npx quorum` resolves against the public registry today, and what it would fetch is a stranger's
package or nothing. No README, architecture document, plan bullet, test name or success message may
assert that a cold machine can obtain Quorum from the registry. That claim is Q-0029's, in M6.

**(e) The artifact sits in `dist/` inside its own package, and `files` is declared.** The location is
load-bearing rather than cosmetic: `spike/bin/harness.js:321` resolves the shipped templates as
`path.join(here, '..', 'templates', 'harness')` — **relative to the binary's own file** — so the
depth from the `bin` target to the template assets is fixed by this ruling and inherited by Q-0093
rather than discovered by it. `packages/templates` is today a stub of two files and holds no assets,
so this entry states the constraint and does not satisfy it; **Q-0093 does not build `init` against
a guess.** `files` is declared because `npm pack --dry-run` on `packages/cli` **exits 0 despite
`"private": true`** and ships 22 files and 90.6 kB — three `.turbo/turbo-*.log` build logs and nine
test files, `frame.source.test.ts` at 17.9 kB among them, with no `bin` target. Measured 2026-09-02.

**(f) Registered divergence: the suites prove source and the binary ships emit.** Under (b) that gap
is real and nothing closes it until Q-0095 runs the mock end-to-end through the built binary. It is
recorded here rather than discovered later, and it is the price of (b) — accepted because the
alternative prices every verdict in the workspace instead.

**(g) Registered limit: the packed-tarball fixture proves the easy case.** While `packages/cli` has
no runtime cross-package dependency, a tarball that installs and runs anywhere proves less than it
appears to. It acquires its real subject at Q-0091's first value import. Q-0098's AC-19 either
sequences after Q-0091 or states this limit in its implement report; silence is refused.

**Alternatives considered:**

**Shape B — `exports` moved wholesale to `dist/`, suites resolving the artifact.** Rejected on
measured cost. `packages/core/src` holds **53 `.ts` files** naming `@quorum/shared` — 21 production,
of which 14 carry a value import, and 32 tests — and 57 files across `packages` and `apps` do
(re-measured 2026-09-02; the requirement's "55" matches neither figure). Both `test` and `typecheck`
would need a `^build` edge, since declarations would resolve through `dist/` too. Every test in the
workspace would then sit behind a build artifact, and `harness/harness.yaml`'s `commands.test`,
CI's `workspace` job and `.github/scripts/git-identity-sweep.sh` would each grow a build phase.
**A stale `dist/` that a downstream task executes is a worse failure than a stale green tick**, and
this workspace has never had the first class of failure — all three existing tasks declare
`"outputs": []` and replay a verdict rather than an artifact.

**Shape C — `tsc` emit of `packages/cli` alone.** Works today and is kept as evidence rather than as
a strategy: it passes every criterion in Q-0096's merged requirement and expires at Q-0091's first
value import. Its existence is precisely why (a) is ruled against the later tree.

**Shape D — bundle the CLI with `core` and `shared` inlined (`esbuild`).** Rejected today for want
of a subject: there is nothing to inline, so the new dependency would buy a capability the artifact
does not use, against `harness/rules.md`'s one-line-justification requirement. **The door is left
open on purpose** — it becomes a live option once a command child lands a value import, and a later
reader should not read this entry as having closed it on principle.

**Shape E — Node type stripping, no build at all.** Refuted **twice, independently**, and both are
recorded because a reader who fixes one would otherwise think the door had reopened. (1) Stripping
resolves `@quorum/shared`, strips `index.ts` and dies on the `./constants.js` specifier; closing
that means rewriting every relative specifier with `allowImportingTsExtensions` and
`rewriteRelativeImportExtensions`, a mass edit colliding with four source-scanning guards. (2) Both
the root and `packages/cli` manifests declare `engines.node: ">=22.13.0"`, and unflagged stripping
landed in 22.18 — so the declared support floor forbids it whatever the specifiers say. No *source*
construct forbids it: production source holds no enum, namespace or decorator.

**Making `build` owed by every package, stubs included.** Rejected: a no-op build script in four
packages that emit nothing declares an artifact that does not exist, which is the under- and
over-declaration hazard (c) exists to avoid. The register naming which packages emit is the honest
form, and it fails closed when a fifth package starts emitting.

**Why:** Because the question this workspace has never had to answer is **what a cache hit gives back**.
*"The test command defeats its own cache, in configuration and not in the engine"* (2026-08-27) and
*"A cache hit names what the task reads, not what its package contains"* (2026-08-28) are both about
a replayed **verdict** — a green tick claimed for work that did not run. A `build` task with real
`outputs` introduces a replayed **artifact**, and an artifact a downstream task then *executes* fails
in a way a stale tick cannot: the tick lies about the past, the artifact lies about the present.

So the ruling is arranged to keep the two classes apart. The emit exists because a `bin` entry
pointing at a `.ts` file does not run under Node and Node's own type stripping does not close it —
that is a real requirement and Q-0090's body was wrong to call the `bin` entry scaffolding. But the
emit is consumed by exactly one thing, the binary, and by exactly one suite, Q-0095's, which is the
suite whose whole purpose is to exercise the binary. Every other verdict in the repository goes on
proving source, so the new failure class has one narrow place to live instead of standing behind all
1,520 tests.

The second reason is that a strategy is ruled against the tree it will run on. `packages/cli` today
has no runtime workspace dependency, and three of the five shapes look fine under that measurement.
Q-0091 lands a value import of `@quorum/core` and two of them stop working. Ruling against today's
frame would have handed the re-ruling to a command child — to a step forbidden to write a decision
entry, appealing in prose the human does not read until the gate. That is the failure this
repository has now recorded ten times, most sharply on Q-0062, whose requirement named the hazard by
name and whose run was launched without the entry anyway.

The third is that (c) is a decision and not a detail. Adding a fourth task to a workspace whose two
task registers are hand-written arrays turns two doc comments false and makes turbo skip four
packages in silence — verbatim the failure the first of those registers exists to close. A ruling
that added `build` without saying who owes it would have shipped that hole; deriving the register is
Q-0097's AC-13, and it exists because this entry ruled the task's scope rather than leaving it
implicit.
