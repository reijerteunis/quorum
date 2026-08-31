# Q-0054 — implement report, chore run 2, round 3 (revision)

Branch at start: `1857b39`. One file changed: `packages/core/src/spike-parity.test.ts`
(+262 / −39, now 1,280 lines). No register verdict moved.

---

## 1. The review finding, and whether it was real

`review/chore/run-2/chore-iter-2.md`, one major:

> `childProcessNames` recognizes only named imports from `node:child_process`. A file using
> `import * as cp from 'node:child_process'` (or a dynamic namespace import) can call
> `cp.spawnSync(process.execPath, [candidate])` while also importing `../src/`; the launch is never
> inspected, so an unresolved binary path produces no problem and the file may be accepted as
> `ported`. Support these import forms or explicitly reject them, and add a demonstrated case
> proving an unresolved namespace-qualified launch fails closed.

**Real, and traced end to end before it was fixed.** `childProcessNames` matched
`import\s*\{([^}]*)\}\s*from\s*['"]node:child_process['"]` and nothing else. A namespace import
passes `specifiersOf` cleanly — `ALLOWED_SPECIFIER` admits `node:[a-z_/]+` — so the file raised no
problem there either; the launcher set was then empty, `launchSites` iterated over nothing, and
`launchesBinary` came back `false` with an empty problem list. That is the exact failure mode AC-2
exists to stop: not a wrong answer, a **quiet** one.

It is the same class as round 1's major (a name assembled across an interpolation), arriving one
layer out: round 1 was a launch target the scan could not read, this is a launch **site** the scan
could not see. Closing it turned up two more instances of the same class in the code I was already
in, both recorded below.

**No corpus file is affected today.** All fifteen `spike/test/` files that take `node:child_process`
take it as a plain named import, verified by reading every one; the three-way classification and its
line totals are unchanged. This was a fail-open in the guard, not a mis-filed file.

---

## 2. What changed, and why each piece

All in `packages/core/src/spike-parity.test.ts`.

### `childProcessNames` → `childProcessBindings` (replaces ~10 lines with a binding reader)

Reads how the file binds the module rather than matching one clause shape, and returns four things:
`functions` (local name → the export it names), `namespaces` (locals bound to the whole module),
`rest` (the code with those import statements blanked, so a clause is never read as a use of its own
name), and `problems`.

`parseImportClause` handles the four static forms and **only** those: a named list with optional
aliases, `* as ns`, a default, and a default beside either. A default counts as a namespace because
Node's builtins expose the whole module object as their default, so `import cp from
'node:child_process'` reaches `cp.spawnSync` exactly as `import * as cp` does. A clause it cannot
parse returns `null` and its caller reports it — the point being that binding *nothing* is what made
a launch site invisible, so silence is the one outcome not allowed.

A **dynamic** `import('node:child_process')` is refused by name rather than followed. Its binding is
an expression — the awaited value, a destructuring of it, an inline member — and following one is
the general dataflow question this file declines everywhere else. Refusing is the same fail-closed
direction as an unresolvable launch target, and no corpus file takes it that way. This is the
"explicitly reject them" half of the review's instruction, stated in the code and in the JSDoc rather
than left as a gap.

### `launchSites` — a second scan, and a bound on what a namespace may do

The per-call resolution is unchanged and is now `inspect(label, open)`, called from two places:

- **Directly bound launchers.** Membership of `FILE_LAUNCHERS` is now asked of the **export** while
  the call site is found under the **local** name. Previously both were the local name, so
  `{ spawnSync as run }` bound a launcher under a name the set does not contain and was neither
  recognised nor reported — the same fail-open under an alias rather than under an import form. Found
  while fixing the reported one; it is inside the code the finding sent me to, not a defect found by
  reading elsewhere.
- **Namespace bindings.** `ns.spawnSync(…)` is a launch site like any other. Every *other* use of a
  namespace binding is a problem naming the text — a computed member `cp['spawnSync'](…)`, a
  destructuring `const { spawnSync } = cp`, the name handed to a helper. What it is then called as is
  unreadable from here, so it stops rather than defaulting.

`blankQuoted` spaces out string bodies (length preserved) before the namespace scan, because the
binding's name occurring inside prose is not a use of it — the corpus has such prose, e.g. the word
`spawn` inside an assertion message in `q0063-stdin-epipe.js`. The per-call resolution still reads
the unblanked `code`, which is where the paths live.

`factsOf` now passes `quoted` into `launchSites`. The three bounds `launchSites` documents are now
three rather than two, the new one being what a namespace may do.

### Header and JSDoc

The module header gains a paragraph recording round 2's finding beside round 1's, in the same shape:
what was invisible, why, and which oracle now covers it. `Facts` and `factsOf`'s contract notes are
updated to say that the launch oracle now also reports bindings it cannot follow to a call at all.

### Tests: two new, one repaired

- **`a launcher reached through an import form other than a plain named one is read, not missed`** —
  the demonstration the review asked for. A namespace-qualified and a default-qualified launch with
  an unresolvable target each produce `cp.spawnSync() runs a script this scan cannot resolve, from
  'candidate'` instead of nothing; a namespace-qualified launch that *does* resolve to the binary
  returns `launchesBinary: true` for both corpus spellings, and one resolving to `git` returns
  `false`; and the alias case is pinned.
- **`and a binding of node:child_process this scan cannot follow stops the file`** — the reject half.
  Computed member, namespace handed to a helper, namespace destructured, dynamic import, and an
  unparseable clause (a string import name) each produce exactly one problem. Beside them, the three
  discriminations that keep it usable, because a guard that fires on everything is not a guard: a
  non-launcher member call (`cp.exec`) is not reported, prose holding the binding's name is not a
  use, and a plain named import — what all fifteen corpus files take — is unchanged.
- **Repaired:** the fixture at `'a launch site whose target the scan cannot resolve stops the file'`
  asserted `execFileSync('git', args, { cwd })` resolves cleanly under a header importing only
  `spawnSync`. `execFileSync` was never bound, so the call was never inspected and the assertion
  passed on nothing while its comment claimed a resolution. I wrote that in round 1. The header now
  imports both launchers and the line asserts what it says it does.

---

## 3. A fail-open I introduced this round, and closed before finishing

My first `CHILD_PROCESS_IMPORT` was line-bounded (`[^\n;]*?`). Round 2's regex bounded the clause by
its own braces (`[^}]*`) and therefore **did** handle a formatter-wrapped named import; mine would
have bound nothing for

```js
import {
  execFileSync,
  spawnSync,
} from 'node:child_process';
```

putting the launch site back out of sight — the reported defect re-created under a formatter instead
of under an import form, in the fix for it. Caught by re-reading the region rather than by a test,
which is worth saying plainly.

The pattern is now two alternatives: a braced clause, which may span lines because its braces bound
it, and everything else bounded to its line. The line bound on the second alternative is
load-bearing in the other direction — an unbounded clause runs from an earlier `import` on another
line straight through to this specifier and captures both. Both directions are pinned: the wrapped
list resolves, and an earlier `import fs from 'node:fs'` is not swallowed, asserted with **and
without** a terminating semicolon.

---

## 4. Red before green

Every new assertion was shown to fail against the code it was written for, not just to pass against
the new code.

**Round 2's classifier, reconstructed in place** (named imports only, no alias mapping, no
namespace/default/dynamic bindings, no clause problems — five targeted mutations, each reverted
individually afterwards):

```
× a launcher reached through an import form other than a plain named one is read, not missed
× and a binding of node:child_process this scan cannot follow stops the file
  Tests  2 failed | 22 passed (24)
```

Exactly the two new tests fail; all 22 pre-existing pass. So the new tests have a subject and are not
passing on something else.

**The multi-line clause, separately** — restoring only the line-bounded regex fails only the second
test (`1 failed | 23 passed`), which is the clause-bounding claim demonstrated on its own rather than
riding on the import-form one.

After reverting every mutation: **24 passed (24)**, up from 22.

---

## 5. AC-12 evidence

Re-run in full this round because code changed. Dependencies installed first — `pnpm install
--frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`; an earlier attempt of the
latter ran with a stale shell cwd and created an empty `spike/test/spike/` holding a lockfile, which
was removed before anything was measured. Both trees present and verified before any suite ran.

### 12.1 — discovery proved by execution

Probe written to `packages/core/test/q0054-discovery-probe.test.ts`, **deliberately outside `src/`**,
which is a location collected by nothing before this ticket. Marker
`Q0054-DISCOVERY-PROBE-4f7a2c`.

| command | result |
| --- | --- |
| `pnpm --filter @quorum/core test` | **exit 1**, marker reported at `test/q0054-discovery-probe.test.ts:6`; `1 failed \| 1228 passed \| 2 skipped (1231)`, 56 files vs 55 |
| `pnpm turbo run test --force` | **exit 1**, `Failed: @quorum/core#test`, `6 successful, 7 total` |

Removed afterwards; `git status --short` shows only `M packages/core/src/spike-parity.test.ts`.

### 12.2 — the hash link

`pnpm turbo run test --dry=json`, `@quorum/core#test`:

| | hash |
| --- | --- |
| before the probe | `20e6bcbb2fc81cd2` |
| with the probe | `ef53231b9ae7019b` |
| after removing it | `20e6bcbb2fc81cd2` |

A new file moves the task hash, so a cached pass cannot stand over one.

### 12.3 — both environment rows, per command

Populated row created exactly as CI's `git-identity-sweep-populated` job does
(`mkdir -p .harness/worktrees .quorum/runs`), then removed for the bare row.

| command | bare (neither directory) | populated (both) |
| --- | --- | --- |
| `pnpm turbo run lint --force` | 7/7, **0 cached**, 0 errors | 7/7, **0 cached**, 0 errors |
| `pnpm turbo run typecheck --force` | 7/7, **0 cached** | 7/7, **0 cached** |
| `pnpm turbo run test --force` | 7/7, **0 cached**; core 54 files passed / 1 skipped, 1,228 passed / 2 skipped | identical |
| `npm test --prefix spike` | **17/17 files** | **17/17 files** |

Nothing here is UNRUN. `pnpm lint` unforced was also run and is green, but it replayed 7/7 from cache
on a second invocation (`FULL TURBO`), so the forced row above is the load-bearing result — a
replayed tick is what Q-0071 closed.

The 1 skipped file / 2 skipped tests are `src/adapters/real-cli.probe.test.ts`, confirmed by running
it alone: `1 skipped (1)` without `QUORUM_REAL_CLI`. AC-6(b)'s BYOS clause holds under the widened
include.

### AC-11, re-verified at this branch

- `git diff --name-only main...HEAD -- spike/` — **empty**.
- `harness/port-charter.md:265` still `freeze-sha: 7b6bc70421094ae31eb44257807f84b8f732a20a`; no
  exemption added.
- `packages/core/src/engine/routing.ts:27` still `const signalWindow = setTimeout(() => {}, 1000); //
  Why: preserved defect, see Q-0050 AC-4.` — intact, and no fixture this round touches it.
- No dependency added: `package.json`, `pnpm-lock.yaml` and both package manifests are unchanged
  against `main`.

### AC-9

No new repository read was introduced. The guard reads `spike/test/**` and its own source, both
already declared in `packages/core/turbo.json`; `turbo-inputs.test.ts` passes as part of the
workspace suite.

### Round 1's nit, re-checked rather than assumed

Round 2 rewrote the `port-freeze-sha` register description. `ci.yml:95` reads `if:
needs.port-freeze-policy.outputs.freeze_sha != 'not-yet-recorded'` and the charter records a SHA, so
the job is live and its tick is an executed claim — which is what the description now says.

---

## 6. What I deliberately left alone

- **Every register verdict, counterpart and note.** Zero register-row lines changed this round
  (`git diff | grep -c 'verdict:|carriedBy:|note:|binaryHalf:'` → 0). The finding was about the
  classifier; the audit was not in question and moving a row to accommodate a scanner change would be
  the wrong direction.
- **The `exec`/`execSync` bound.** Still not resolved as launch sites — they take a shell command
  line, which `binarySpellings` reads whole and `binaryAssemblies` covers across an interpolation.
  Documented in `launchSites`, unchanged.
- **`spike/**`, the cutover, the `spike` CI job, the freeze SHA, `spike/test/run.js`.** Charter §3 and
  §5, and the requirement's non-goals.
- **The nine library-only files.** Not translated. Charter §1 ∧ §5 leave the translation set empty.
- **`docs/`, `vitest.shared.js`, `turbo.json`, `test-command.test.ts`, `test-discovery.test.ts`,
  `turbo-inputs.test.ts`, the three helper headers.** Landed in rounds 1–2 and not reopened; nothing
  in this round's finding reaches them.
- **The generalised version of the namespace clause.** A *directly bound* launcher used other than as
  a call (`const f = spawnSync; f(bin)`) is still not reported. It is the same class, but it is
  outside the finding, and the obvious guard would fire on any string literal containing the word
  `spawn` — the corpus has three — so it trades a fail-open for a false-positive surface. Named here
  rather than chosen for you.

---

## 7. Reported and not fixed

**1. Q-0079's identity sweep cannot run inside a linked worktree.** `pnpm sweep:git-identity` fails
here in phase `isolation`:

```
rm: …/.git/sweep-gitconfig-absent: Not a directory
::error::git-identity sweep failed in phase 'isolation'
```

`.github/scripts/git-identity-sweep.sh:69` sets `GIT_CONFIG_GLOBAL="${repo_root}/.git/…"`, which
assumes `.git` is a directory. In a linked worktree it is a 96-byte gitdir pointer **file**, so the
sweep cannot run in any chore implement step — which is every run of this flow. **CI is unaffected**:
both sweep jobs use `actions/checkout`, where `.git` is a real directory. Pre-existing (the script is
untouched by this branch), named by no criterion, and outside this ticket's non-goals list, so it is
reported per charter §2 rather than fixed. Its tripwire half,
`packages/core/src/git-identity.test.ts`, runs inside the ordinary suite and is green in both
environment rows.

**2. One pre-existing ESLint warning.** `packages/core/src/backlog/backlog.ts:276` — *Unused
eslint-disable directive (no problems were reported from 'no-control-regex')*, from Q-0080's
`8f31fb5` on `main`, in a file this branch does not touch. Lint reports **0 errors**, so every gate
is green; recorded so the warning in the transcript is not read as this branch's.

---

## 8. For the gate

- **R8's signal.** This is chore run 2, implement round 3 — charter §9's *more than three chore runs
  on one child* threshold is untouched, but the requirement's own line was *"if it needs more than two
  implement rounds, that is the signal the cut was wrong, and it is said at the gate rather than
  absorbed."* Saying it: three rounds, and all three findings were in the **classifier**, not in the
  register or the documents. Each was correct and each was a different route to one hole — a name the
  scan could not read, a call site the scan could not see, and (found in the fix) an alias and a
  wrapped clause. That reads to me as the classifier being the hard part rather than the cut being
  wrong, but it is your call and the evidence is above.
- **OQ-1 is still unanswered and still not blocking.** The audit produced **zero `uncovered` rows**,
  so no per-row ruling is owed. Recorded because the requirement routed the question to this gate.
- Nothing in this round needed a decision entry, and none is implied.
