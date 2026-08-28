# Q-0072 — implementation report

*Revision round, 2026-08-28. One finding carried in: `review/chore-iter-4.md`. Governed by
`requirements/errata.md` **E-2**, decided by the human at the second exhaustion gate of run 2 and
binding on this round and on the review that judges it. **E-1 stands unchanged.***

---

## The finding, and what it is an instance of

`chore-iter-4.md` is correct, and it checked E-1's allowance for itself before raising, which was
right:

> C4 detects filesystem reads only by matching the original API name immediately before `(`; it does
> not resolve imports or aliases as C1 does.

So `import { realpathSync as canonical, readFileSync as slurp } from 'node:fs'` produced a read C1
could not see (no route), C2 could not see (no listed derivation), C3 could not see (no escaping
literal), clause B could not see (the path is assembled from `'docs'` and `'GLOSSARY.md'`, never
written whole), and C4 could not see either — because it was looking for `readFileSync`, and the
file had called it `slurp`.

This is not an unenumerated route past a closed class. It is **an internal inconsistency introduced
by round 4 itself**: C1 learnt to resolve bindings in round 2, and C4 — written two rounds later —
matched raw names. E-2 names the shape, and it is this repository's own: *"review the fix round, not
only the feature round"* (Q-0034). I have written that reasoning into the module comment rather than
only into this report, because the report is not read again after the gate.

## What changed

**One file: `packages/core/src/turbo-inputs.test.ts`** (+297 / −49). No other file in the repository
is touched by this round — `turbo.json`, the two per-package `turbo.json` files,
`.github/workflows/ci.yml`, `docs/04-architecture.md` and `packages/core/src/test-command.test.ts`
are exactly as the previous round left them.

### 1. The import machinery is now shared, which is E-2 item 1

Three new declarations sit between `resolveModule` and `routeImports`, and they are the *whole*
mechanism both clauses now use:

- **`statements(text)`** — every static `… from '…'` statement and the specifier of every dynamic
  `import()`, over blanked code so a statement quoted as an example is not read as one. This is
  `routeImports`'s old scanning loop, lifted verbatim.
- **`Clause` / `readClause(clause)`** — a clause decomposed into its `namespace`, its
  `defaultBinding`, its `members`, and the forms the scan could not read. This is `routeImports`'s
  old clause parsing, lifted and made to return its answer instead of reporting it.
- **`Member` / `Statement`** — the two syntax-level records those produce. `Member` is deliberately
  not `Binding`: `Member` is what the clause *said*, `Binding` is a route that has been *resolved*,
  and `Binding`'s own field documentation is about `repoRoot`'s special handling, which has no
  meaning for a filesystem read.

`readClause`'s doc comment states where the two clauses diverge and why, because that divergence is
the thing a later reader will otherwise assume is an oversight.

**`routeImports` is rewritten onto this and its behaviour is preserved.** Every problem message a
test asserts on is unchanged — `as a namespace`, `default binding`, `re-exports`, `dynamically`,
`neither a route nor inert`. Two differences a reviewer should see rather than discover:

- One message no test asserts is reworded, because the caller now wraps a fragment: `imports a
  member of X this scan cannot read: Y` became `imports X with a member this scan cannot read: Y`.
- A clause carrying *both* a default binding and an unreadable trailing binding now reports both,
  where the old `continue` chain reported only the first. Strictly more reporting; both fail.

### 2. `READ_MODULES`, `ReadBinding`, `readImports` — E-2 items 1 and 2

`readImports(file, text)` sits directly beneath `READ_APIS`, which is what it classifies against. It
returns the local names in one file that reach a read, and every form it cannot follow.

| clause member | disposition | why |
| --- | --- | --- |
| `import { readFileSync as slurp }` | binding `{ local: 'slurp', api: 'readFileSync' }` | the finding |
| `import fs from 'node:fs'` | binding `{ local: 'fs', api: null }` | reads are member calls under an API name |
| `import * as fs from 'node:fs'` | binding `{ local: 'fs', api: null }` | the same |
| `import { promises as fsp }` / `{ default as fs }` | binding `{ local, api: null }` | both are objects whose members are those APIs |
| a member not in `READ_APIS` | no binding, no problem | `READ_APIS` is the standing claim about what can read a file |
| `export { readFileSync } from 'node:fs'` | **problem** | a reader under another module's name |
| `import('node:fs')` | **problem** | no static scan follows it |
| `require('node:fs')` | **problem** | a binding no import clause declares |
| a clause it cannot parse | **problem** | fail closed on syntax |
| a resolved name **not** immediately called | **problem** | `const alias = fs.readFileSync` is a read under a name it will not see called |

The last row is not in E-2's list and is there because it is the bypass the binding resolution would
otherwise open one step further along. The `require` row is belt-and-braces and its doc says so:
this workspace is ESM, so reaching `require` at all needs `createRequire`, which `ROOT_DERIVATIONS`
already makes somebody answer for.

### 3. `readSites` gains the alias patterns beside the name backstop

`readSites(text, routes, reads)` now matches an API under **both** its own name — which is what it
always did, and which still catches `fs.readFileSync(` and a bare `readFileSync(` from any module —
**and** under each alias `readImports` resolved. Sites are keyed by source offset and sorted, so the
two patterns matching the same call produce one site.

The backstop is kept on purpose. Removing it and matching only through resolved bindings would have
made the clause *weaker* than the one it replaces: a file with no `node:fs` import at all, calling a
reader re-exported by a local module, would have gone from reported to invisible. **This list only
ever adds sites**, which is stated in the parameter documentation.

### 4. Four new tests, each isolated — E-2 item 3 and Q-0071's rule

`47 → 51` tests in the file.

- **`every import of a read module is one this scan can follow`** — the fail-closed half over the
  real corpus, C1's own test one clause over. `readImports(...).problems` is empty for all 26 files.
- **`the clause has a subject — a read API imported under an alias is reported`** — round 4's
  exploit as the fixture, containing only its own trigger. It asserts the bindings resolve, that the
  sites are reported through them, **and that every other clause is silent on it**: `readSites`
  without the bindings returns `[]` (*"matching the API's own name is exactly what this bypass
  evades"*), `derivationSites` `[]`, `routeImports(...).bindings` `[]`, `routeSites` `[]`,
  `escapingLiterals` `[]`, `pathLiterals` `[]`.
- **`and every unfollowable read-module import form is reported rather than passed over`** — one
  fixture per form, each checked on its own, plus the three forms that must *not* be reported, so a
  check that refused every import cannot pass this.
- **`and a whole-module binding is followed under whatever name it was bound to`** — the half the
  raw-name match already covered, asserted rather than assumed. This is what makes accepting the two
  forms C1 refuses a checked claim rather than a convenience.

### 5. The module comment

The C4 bullet, the exhaustiveness argument and the "no clause is a TypeScript parser" paragraph now
say that a reader is identified through the calling file's own bindings, and a fifth residual limit
is stated: `READ_APIS` is a list, and a reader `fs` gains that nobody adds to it is not seen. Per
E-1 item 3, a registered and stated gap is acceptable and the same gap unmentioned is the defect.

---

## E-2 item 4 — the exploit demonstrated against real code, and reverted

Appended to `packages/core/src/corpus.test.ts`, a real file in the scanned set, the exact shape
`chore-iter-4.md` names:

```ts
import { realpathSync as canonical, readFileSync as slurp } from 'node:fs';
function bypass(): string {
  const bypassRoot = path.dirname(path.dirname(canonical('.')));
  return slurp(path.join(bypassRoot, 'docs', 'GLOSSARY.md'), 'utf8');
}
```

**Before — the guard as it stood at `85f8559`**, restored into place with
`git show HEAD:packages/core/src/turbo-inputs.test.ts > …`, run against that same file:

```
 Test Files  1 passed (1)
      Tests  47 passed (47)
```

Green, over a real undeclared out-of-package read. That is the finding, reproduced.

**After — this round's guard**, same file, same read:

```
 FAIL  src/turbo-inputs.test.ts > AC-7 clause C4 … > every base a read is rooted at is registered
AssertionError: expected [ …(2) ] to deeply equal []
+ [
+   "packages/core/src/corpus.test.ts: '.'",
+   "packages/core/src/corpus.test.ts: bypassRoot",
+ ]
```

Both the derived root and the read rooted at it are named, with the file that holds them.

**Reverted.** `corpus.test.ts` restored from `HEAD`, the guard restored from its backup, the backup
removed. `git status --short` reports one modified file, which is the guard.

---

## Where I read E-2 rather than followed its wording, and why

**E-2 item 2 lists "namespace import, default binding" among the forms to fail closed on. C4
follows both instead.** This is the one place I have not done what the erratum literally says, so it
is stated here rather than left in the diff.

Every filesystem import in the scanned set — all 26 of them, in both packages — is
`import fs from 'node:fs'`, called as `fs.readFileSync(…)`. Refusing a default binding for a read
module would report all 26 files on every run. That is not failing closed; it is failing always, and
a guard that always fails is a guard somebody deletes.

The list in E-2 is C1's list, and E-2 introduces it as *"the forms it **cannot follow**"*. For a
route, a namespace or default binding genuinely cannot be followed — a route reached as
`corpus.repoFile(x)` is invisible to a scan watching the name `repoFile`. For a read the opposite is
true: `fs.readFileSync(` is still called under an API name, so the member form is exactly what the
scan already matches. E-2 item 1's requirement — *"An alias is followed under whatever local name
the file bound it to"* — is met, and following is what it asks for.

The claim is not left as an argument: `and a whole-module binding is followed under whatever name it
was bound to` asserts it over a namespace import, and the corpus-wide fail-closed test asserts that
no import of a read module escapes classification. If the reviewer reads E-2 as requiring the
refusal regardless, that is a judgement above my role and I would want it settled by the human at
the gate rather than by another implement round — because the refusal cannot be implemented without
the whole guard failing.

---

## What I deliberately left alone

- **`READ_APIS` is not widened.** E-2's stopping rule makes read APIs a closed class; an unlisted
  reader is a nit and is now a stated residual limit rather than a silent one. Widening the list to
  pre-empt a fifth finding is the move that produced rounds 2 and 3.
- **No new dependency.** AC-11 and E-1 both refuse `typescript`, and for a reason that reaches this
  ticket directly: it rewrites `pnpm-lock.yaml`, which CI installs `--frozen-lockfile` and which is
  a declared hashed input of the task this ticket changes. No provenance analysis was attempted.
- **C1's refusal of namespace and default bindings is unchanged**, and C1 gains no `require` scan.
  The asymmetry is real, it is stated in `readImports`'s doc comment, and closing it is not this
  round's finding.
- **`readImports`'s problems get no register.** Parity with `routeImports`, whose problems must
  simply be empty. The conservatism this buys is worth naming: an alias that collides with an
  unrelated local name in the same file would be reported and would have to be renamed. There is no
  such case in the corpus, and over-collection that fails loudly is this file's stated preference.
- **`turbo.json`, both per-package `turbo.json` files, `.github/workflows/ci.yml`,
  `docs/04-architecture.md`, `test-command.test.ts`** — the substance of AC-2, AC-3, AC-4, AC-8,
  AC-9, AC-10 and AC-11, untouched. This round is one finding.
- **No test was relocated.** Shape (4) is a non-goal; the guard did not turn out to be impractical.

## What this round did **not** re-derive

Stated so nothing here is mistaken for a fresh measurement, which is a lesson this repository has
paid for more than once.

**The hash-movement evidence for AC-1, AC-2, AC-5, AC-6 and AC-12 belongs to the earlier rounds of
this run and is not restated in this document.** I attempted to re-derive the baseline input counts,
the two AC-5 reproductions and the AC-6 control live, so that this report would stand on its own;
the probe writes to tracked files and the sandbox refused it. Rather than restate numbers I could
not verify, I have left them where they were established. The reviewer should read this report
beside the earlier ones for those criteria, and beside the diff for this one.

## Verification, this round

| Check | Result |
| --- | --- |
| `pnpm --filter @quorum/core exec vitest run src/turbo-inputs.test.ts` | **51 passed** (47 before this round) |
| `pnpm turbo run lint typecheck test --force` | **21 successful, 0 cached, 21 total** |
| `@quorum/core` suite | 31 files passed, 1 skipped · **708 passed**, 2 skipped |
| `npm test --prefix spike` | **12/12 files passed** — the frozen witness, untouched |
| `git status --short` | `M packages/core/src/turbo-inputs.test.ts` — nothing else |

---

## The decision, named and not written (AC-13)

`developer-generalist` may not append to `docs/DECISIONS.md`. Carried forward so it does not expire
with the round that first drafted it.

**Proposed title:** *A cache hit names what the task reads, not what its package contains.*

**The sentence the entry turns on.** After this ticket a hit means *no file this task reads, and no
same-kind task in a package it depends on, has changed since the cached successful result.* Before
it, a hit meant only *nothing inside this package has changed* — and the two are far apart in a
repository where both real suites assert over `docs/`, `harness/`, `spike/`, `contracts/`,
`backlog/` and each other.

**The shape chosen:** (2) per-task `inputs` as `["$TURBO_DEFAULT$", …out-of-package globs…]`, plus
(3) same-kind `^lint` / `^typecheck` / `^test` edges. Declared in each package's own `turbo.json`;
the root keeps its four `globalDependencies` and gains the three `dependsOn` entries.

**Shapes rejected.** (1) `globalDependencies` for the shared corpus — one place and zero drift risk,
rejected because it invalidates all 21 task-package pairs on any `docs/` edit, in a repository where
`docs/` changes on every ticket. (4) relocating the cross-tree assertions into a task whose inputs
can cover them — rejected as a non-goal: it touches landed, reviewed tests in two packages, and the
configuration being awkward is not a reason to move a test.

**The two consequences of `dependsOn`, stated rather than discovered.** The task graph gains edges,
so `shared` completes before `core` and a forced run goes from one parallel wave to two. And a
failure in a dependency now **skips** its dependents rather than reporting them, so a developer sees
fewer failures per run unless `--continue` is passed. `--filter @quorum/core` also now pulls
`@quorum/shared#test` with it, which moves the behaviour of the probe invocation Q-0065 AC-8 pins in
`real-cli.probe.test.ts` — that assertion is on the file's text, so it still passes, but the
documented command does more than it did.

**The guard, and what four rounds of review taught about it.** AC-7's drift guard is
`packages/core/src/turbo-inputs.test.ts`: a manifest of audited out-of-package reads checked against
what turbo reports, plus four escape-route clauses. Each of the four review rounds returned exactly
one major, each different, each real, and each closed — quoted-literal scanning, import aliases,
root-derivation primitives, and finally the read-API anchor's own failure to resolve aliases. The
generalisable lesson is the last one, and it is E-2's: **a clause written after a lesson can still
miss it.** The remedy was not another list but a shared decomposition, so the syntax question is
answered in one place and cannot be answered two ways.

E-1 and E-2 also settle what "done" means for this instrument, and that belongs in the entry:
absolute non-bypassability is not achievable for a textual scanner under AC-11's dependency ban, and
what makes a residual gap acceptable is that it is **registered and stated** rather than silent —
which is this ticket's own subject, arriving inside the tool built to enforce it.
