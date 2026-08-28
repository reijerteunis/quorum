# Q-0072 — implementation report (revision round 3)

*One file changed this round: `packages/core/src/turbo-inputs.test.ts` (+324 / −14). No
configuration file moved. `git status --short` shows that file and nothing else.*

The review of round 2 returned exactly one major, and it is the third in a row on the same clause —
each different, each correct. `requirements/errata.md` **E-1**, decided by the human at the
exhaustion gate of run 2, rules how it is to be closed. This round implements that ruling and
nothing else.

---

## 1. The finding, and what closed it

`review/chore-iter-3.md`:

> Clause C2 recognizes only a finite list of root-derivation tokens and does not inspect filesystem
> read APIs, so a new test can derive the repository with an unlisted primitive such as
> `path.dirname(path.dirname(fs.realpathSync('.')))` and read a computed out-of-package path
> without triggering C1, C2, C3, or the manifest check.

The finding is right, and it is right about the shipped code: `realpathSync` was in no list, the
literals in that expression are all package-relative, no route is named, and the path being read is
computed. Every clause was silent.

**What E-1 rules, and why the obvious fix is refused.** Adding `realpathSync` to `DERIVATIONS`
would close this instance and nothing else — and it is precisely the move that produced findings 2
and 3, each of which was "the list is finite" one primitive further along. E-1 §2:

> Extending C2's list is refused as a remedy… the set of ways to compute a string is not
> enumerable. The set of ways to *read a file* in Node is small, stable and enumerable, and it is
> the last point every bypass must pass through.

So the remedy is a fourth clause anchored on the read rather than on the derivation. That converts
an open-ended hunt for bad primitives into a closed question over a stable API surface.

### C4, as implemented

`READ_APIS` enumerates Node's twenty-six filesystem read calls — both spellings of each, because
`fs/promises` and the callback form reach the same bytes as the synchronous one. **The list is
itself part of the register**, as E-1 §2 requires, stated in the file rather than argued in prose:
a name missing from it is the one way past the clause, which makes adding one a visible act.

Every read site is then required to take a path that is one of three things, the first two being
hand-offs to clauses that already own that shape rather than holes:

| shape | who owns it |
| --- | --- |
| a quoted literal **clause B collects** | clause B, which requires it declared as an input |
| an expression naming a **route**, under whatever local name the file imported it as | clause C1, which already requires that route's path to be a literal or registered |
| anything else | **`READ_BASES`**, with a stated reason |

The hand-offs are asserted rather than assumed — there is a test showing that
`fs.readFileSync(path.join(repoRoot, relative))` is left to C1 *and* that C1 does in fact report it,
and that with no binding for `repoRoot` the same line becomes C4's problem.

### The one judgement call: the register is keyed by base, not by site

E-1 §2 says "every filesystem read site … must take a path that is … (c) an entry in a register
with a stated reason". I register the **base** the path is rooted at rather than the whole site, and
I flag it here because it is the only place I read the ruling rather than transcribed it.

Two reasons, both in the file:

1. **Measured.** The scan finds **113 computed reads** across the two suites, but only **55
   distinct (file, base) pairs**. Thirty-one of the 113 are product modules — `backlog.ts`,
   `fanout.ts`, `git.ts`, `lint.ts`, `contracts.ts` — where the honest entry is "the path this
   function was handed", 31 times. That is the register-full-of-entries-carrying-no-information
   this module comment already refuses for `os.tmpdir`, and a register nobody rereads is a register
   that decays.
2. **The base is the whole question.** `dir` reaches whatever `dir` is; every read joined onto it
   inherits that answer. A reviewer weighing `git.test.ts: dir → repo(), forked(), … all under
   os.tmpdir` has answered every read in that file at once, and answered it at the level where the
   answer actually lives.

`path.join`, `resolve`, `relative` and `normalize` are unwrapped to find the base — offsets found in
the blanked code, the value rendered from source, so a comma inside a string cannot end an argument
early.

**What this does not weaken.** Adding a read that reuses a base already vetted in that file needs no
new entry — which is correct, because the base is the security property. What the name can be
rebound *to* is still constrained from four directions: a route reports at C1, a derivation at C2,
an escaping literal at C3, and another read at C4. That is stated as residual limit 2 rather than
left implicit.

### One detail that matters more than it looks

A literal base is exempt **only when clause B collects it** — not merely when it is a literal.
`'.'` carries no separator, so clause B never sees it. Exempting every literal would have handed
the round-3 fixture its root for free, one call before the read that used it. There is a test on
exactly this:

```
readSites("fs.realpathSync('.')")          → ["realpathSync → '.'"]        reported
readSites("fs.readFileSync('/etc/passwd')") → ["readFileSync → '/etc/passwd'"] reported
readSites("fs.readFileSync('docs/GLOSSARY.md')") → []                       clause B's
```

---

## 2. The bypass, demonstrated against real code and reverted

E-1 §4 makes this the condition of approval. I inserted round 3's expression verbatim into a real
suite file — `packages/shared/src/stages.test.ts`, chosen because `shared` contributes **zero**
computed reads today, so nothing there could mask the result:

```ts
const bypassRoot = path.dirname(path.dirname(fs.realpathSync('.')));
const bypassed = fs.readFileSync(path.join(bypassRoot, wantedDoc), 'utf8');
```

Result — `Tests 1 failed | 46 passed (47)`:

```
AssertionError: expected [ …(2) ] to deeply equal []
+ [
+   "packages/shared/src/stages.test.ts: '.'",
+   "packages/shared/src/stages.test.ts: bypassRoot",
+ ]
```

Three things worth reading off that output:

- **It is caught twice** — at the derivation (`realpathSync('.')`, a read whose literal base clause
  B drops) and again at the read rooted on it. Either alone would have failed the round.
- **Exactly one assertion failed.** Clauses A, B, C1, C2 and C3 all stayed green over the same
  file. That is the proof that C4 is what caught it, rather than an existing clause I happened to
  widen — the distinction Q-0071 records as *demonstrating that a guard has a subject proves the
  guard fires, not that each of its clauses does*.
- **It reached `packages/shared`,** which the scan otherwise finds nothing in. The positive control
  now states that emptiness is a fact rather than an omission: `shared`'s suite touches the
  filesystem only through corpus routes, so C1 governs all of it.

Reverted. `git diff -- packages/shared/src/stages.test.ts` is empty.

### The isolated fixtures

Per Q-0071's rule, each C4 case is exercised on its own, and the round-3 fixture asserts the silence
of every other clause so it can only fail on C4:

| fixture | proves |
| --- | --- |
| `path.dirname(path.dirname(fs.realpathSync('.')))` + computed read | C4 reports it; `derivationSites` **empty**, `routeImports` empty, `routeSites` empty, `escapingLiterals` empty, `pathLiterals` empty |
| `realpathSync('.')`, `readFileSync('/etc/passwd')`, `readFileSync('docs/GLOSSARY.md')` | the literal exemption is "a literal clause B collects", not "a literal" |
| `readFileSync(path.join(repoRoot, relative))`, with and without the binding | the C1 hand-off is real in both directions |
| the same calls in a `//` comment, a `/** */` block and a quoted string | no over-collection, so register entries stay meaningful |

---

## 3. Residual limits, stated in the file

E-1 §3 — *a residual gap is acceptable when it is registered and stated, and is not when it is
silent* — is the ticket's own subject turned on its instrument. Four are now written into the module
comment:

1. **A subprocess that reads a file on a suite's behalf is not covered.** `execFileSync('cat',
   [somewhere])` reaches bytes without touching `READ_APIS`, because the path travels in argv.
   Following it is the dataflow analysis E-1 declined to buy: it needs a real syntax tree, and
   declaring `typescript` rewrites `pnpm-lock.yaml`, which CI installs `--frozen-lockfile`, which
   `contracts.source.test.ts` asserts on, and which is a declared input of the very task this ticket
   changes.
2. **A base is registered by name, per file** — rebinding that name inherits its entry, bounded as
   described above.
3. **The two `test/corpus.ts` modules are exempt from clause C**, unchanged: they are where routes
   are defined and taking a computed path is their purpose.
4. **C2 omits `os.tmpdir`**, unchanged — and now with the complement stated, that C4 registers the
   sandbox *bases* instead, where the entry does carry information: it is the sentence
   distinguishing a directory the test created from a root it climbed to.

The exhaustiveness argument at the top of the file was rewritten from three parts to four, and now
names where C1–C3 stopped and what walked through the gap.

---

## 4. Files changed

### This round

**`packages/core/src/turbo-inputs.test.ts`** — the only file.

- Module comment: C4 added to the clause list; the exhaustiveness argument rewritten for four
  parts; a new paragraph on why the anchor is the read and not the derivation, citing E-1; the "two
  limits" paragraph replaced by four numbered residual limits.
- `READ_APIS` — 26 names, documented as itself part of the register.
- `baseSpan` — unwraps `path.join`/`resolve`/`relative`/`normalize` to the base.
- `readSites` / `ReadSite` — the scan, with its three exemptions documented as hand-offs.
- `READ_BASES` — 55 entries across 20 files, each naming where that base comes from.
- Seven tests: the register check, the stale-entry check, the positive control, and four isolated
  fixtures.

`git.test.ts`'s `process.cwd()` is registered as a base **in its own right**, with the reason saying
it is the one base in that file that could reach the repository — deliberately duplicating the C2
entry for the same file, because the two answer different questions (*this file derives a root* vs
*this read is rooted there*).

### Rounds 1–2, recapped because the review diffs `integration...implement`

- `packages/shared/turbo.json`, `packages/core/turbo.json` — **new**; per-task `test` inputs as
  `["$TURBO_DEFAULT$", …out-of-package globs…]`.
- `turbo.json` — `dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]`. `globalDependencies`,
  `outputs` and `env` untouched.
- `packages/core/src/test-command.test.ts` — AC-9's parity guard (+58).
- `.github/workflows/ci.yml` — AC-10(a), the comment corrected: it was the guard's *subject* that
  nothing hashed, never the guard file.
- `docs/04-architecture.md` — AC-10(b), what a hit now claims, and that CI's claim is different and
  stronger because CI forces.

---

## 5. Verification

Run after the final edit, all forced:

| check | result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21 successful, 0 cached, 27.887 s** |
| `@quorum/core` suite | 31 files / **704 passed**, 1 file / 2 skipped |
| `@quorum/shared` suite | 10 files / **99 passed** |
| `turbo-inputs.test.ts` + `test-command.test.ts` | **66 passed** |
| `npm test --prefix spike` | **all 12 test files passed** |
| `git status --short` | one file, nothing else |

Core went 697 → 704, which is the seven tests added this round; `turbo-inputs.test.ts` went 40 → 47.
The skipped file is `real-cli.probe`, skipped without `QUORUM_REAL_CLI` exactly as before.

**One thing I did not re-run, said plainly.** The 18-sample cost matrix and the `dependsOn`
consequence measurements in §6 below are **round 2's, inherited**. The configuration files are
byte-identical to round 2 — this round changed one test file — so they still describe what ships,
but they are not fresh numbers and I am not presenting them as such. The forced-gate timings above
are this round's. This repository's rule about inherited measurements is why the distinction is
drawn rather than glossed.

---

## 6. The decision entry, for Ruud to write (AC-13)

Carried forward unchanged, because this file is overwritten each round and it is what gets lifted at
the gate. I did not touch `docs/DECISIONS.md`.

**Proposed title:** *A cache hit names what the task reads, not what its package holds — 2026-08-28*

**The sentence that is the ticket.** After Q-0072 a cache hit means: **no file this task reads, and
no same-kind task in a package it depends on, has changed since the cached successful result.** It
no longer means only that files inside the task's own package have not changed.

**Shape chosen: (2) + (3).** Per-task `inputs` as `["$TURBO_DEFAULT$", …]` plus same-kind `^lint` /
`^typecheck` / `^test` edges. Both halves verified on turbo 2.10.11 through a real cache, not only a
dry run.

**Shapes rejected:**

- **(1) `globalDependencies`** — one virtue, zero drift risk, which AC-7's guard answers directly;
  its cost is invalidating all 21 task-package pairs on every `docs/` edit, in a repository where
  `docs/` changes every ticket.
- **(4) relocating the corpus assertions** — touches landed, reviewed tests in two packages to make
  a configuration file easier. The guard turned out to be practical instead.
- **Root-level `inputs` via `futureFlags.globalConfiguration`** — turbo 2.10.11 offers it behind an
  experimental flag. Adopting an experimental configuration surface is a decision, not an
  implementation choice; the chosen shape needed no flag.

**Granularity (OQ-1), by cost rather than symmetry.** `@quorum/core#test` is the 27-second task and
reads only `docs/03` and `docs/04`, so it gets those by name and **no blanket `docs/**`**.
Directory globs only where a suite genuinely walks a tree.

**The two consequences, stated rather than discovered:** the graph gains edges, so `shared`
completes before `core` and a forced run goes from one wave to two (~0.5 s); and a failing
dependency now **skips** its dependents — 6 tasks in the run instead of 7 — unless `--continue` is
passed. A third, confirmed: `--filter @quorum/core` now also runs `@quorum/shared`'s same-kind task,
so Q-0065 AC-8's documented probe command's behaviour has moved even though the assertion pinning
its text still passes.

**Cost accepted:** a local `pnpm test` after a `docs/` edit goes from 9 ms to ~27 s; after a
`packages/shared/src` edit from ~0.5 s to ~27 s. An unchanged run still replays under 10 ms. Third
time this repository has bought honesty with wall time, first time the bill lands on the
maintainer's own keystrokes.

**Worth carrying in, as the general lesson:** `backlog/*/ticket.md` is now an input of
`@quorum/shared#test`, so every ticket edit invalidates it — including a run's own ticket folder,
mid-run. Correct, exactly the miss Q-0071's evening produced, harmless while `integrate` forces, and
not to be rediscovered later as a defect.

**A candidate paragraph for the entry, from this round.** The guard took three review rounds and an
erratum, and each round was a correct finding about the same clause one primitive further along.
What ended it was not a longer list but a change of anchor: from *how did you compute this string*,
which is unbounded, to *what did you read*, which is not. The generalisable form — **when a guard's
register keeps needing one more entry, the anchor is on the wrong side of the operation** — is worth
more than the guard.

---

## 7. What I deliberately left alone

- **`docs/DECISIONS.md`** — the role's own instruction. Named above, not written.
- **Anything under `backlog/`** — reverted by `commitAll` before every agent commit.
- **Every configuration file.** `turbo.json`, both package configs, `package.json`,
  `harness/harness.yaml`, `.github/workflows/ci.yml` are byte-identical to round 2. The finding was
  about the guard, and only the guard changed.
- **`DERIVATIONS`.** Not extended — E-1 refuses that as the remedy, and extending it is what
  produced findings 2 and 3. `realpathSync` is *not* in C2's list, and the fixture asserts that
  emptiness so nobody quietly adds it later and reports the clause as strengthened.
- **`packages/shared/src/stages.test.ts`** — used as the live demonstration subject and reverted;
  its diff is empty.
- **The product modules** whose bases are now registered (`backlog.ts`, `fanout.ts`, `git.ts`,
  `lint.ts`, `contracts.ts`, `project.ts`, `codex.ts`). Registered with reasons, not changed. Their
  `process.cwd()` calls are product behaviour this ticket does not authorise touching.
- **Shape (4).** No landed test was relocated to make the guard easier.
- **Successor A** (an automated real-cache fixture on CI) and **Successor B** (CI's command
  surface). Both are non-goals; AC-9's guard is the evidence B will need.
- **The spike.** Not a turbo task, hashes nothing, unchanged, 12/12 green.

## 8. Open questions

`OQ-1`, `OQ-3` and `OQ-4` were answered in earlier rounds and are recorded in §6 and in the guard's
own comments. **OQ-2** — *can the guard identify reads without becoming a second fragile TypeScript
parser?* — is the one this round finishes answering. The answer is yes, and it is four fail-closed
clauses over two registers rather than a parser. Its floor was never at risk; its ceiling is stated
as residual limit 1 rather than claimed, which is what E-1 §1 permits in the requirement's own words
— the escape-route half may be *"reported as unachieved rather than faked"*.

Per E-1 §4, a further unenumerated route named without a demonstration that it reaches an
out-of-package file past clauses A–C and the read-API anchor is a **nit** and does not block.
