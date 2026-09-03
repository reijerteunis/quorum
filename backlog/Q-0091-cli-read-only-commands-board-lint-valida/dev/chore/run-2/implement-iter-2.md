# Q-0091 — implement, run 2, iteration 2

*A revision round. Both of review round 1's findings are **refused on ground rule 3**, and both
refusals are routed to the human gate rather than answered with another round — see
*"A refused finding is a gate, not another round"* (2026-08-31). **No product behaviour changed this
iteration.** What changed is that each refusal is now a measurement rather than an argument, each is
held by a guard demonstrated red against the change the criterion asks for, and one of those two
guards had a defect that would have let the criterion's own change pass unnoticed.*

**Two errata are owed at the gate. I cannot write them** — `backlog/` is not an agent-writable
surface and the engine discards an agent's edits under it — so §5 drafts both in the wording they
need.

---

## 1. The two findings, and why both are refused

The reviewer's own text offers the gate-erratum route for each ("*Add a gate erratum limiting AC-4
to `lint`, or change the implementation*"; "*Correct AC-2 at the gate or change the handler*"), and
in both cases grants the substance ("*The spike evidence makes AC-4 appear incorrect*"; "*Preserving
the spike's existing `--project` behavior is well-supported*"). The objection is that the divergence
is unauthorised, not that it is wrong. That is correct and I am not disputing it. What I can do is
refuse on the other binding document, prove the refusal by execution, and hand the gate a ruling it
can make in one line.

Yielding was considered and rejected on this repository's own record: Q-0052's round 2 refused on
charter §2, round 3 yielded to a reviewer that had never been asked *which of the two documents
should move*, and the plan's entry records the yield as the mistake — repaired by hand after the
gate, with the ticket body saying explicitly not to adopt the round-3 draft.

### The measurement both findings turn on

`spike/bin/harness.js` reads `--project` **inside** `loadProject`, at `:55`:

```js
54  function loadProject() {
55    const repoDir = flags.project ? path.resolve(flags.project) : findProject();
```

`loadProject` is a closure over the module-level `flags` object, and **every call site calls it with
no argument** — `lint` at `:401` among them. So the `lint` case block names no flag, and a reader
checking only that block concludes the command needs nothing from argv. That is exactly the reading
AC-2's aside encodes, and it is wrong about the behaviour.

Run rather than read — the two probes, executed against the spike in this worktree:

| probe | command | result |
| --- | --- | --- |
| **A** | `node spike/bin/harness.js validate <schema> <good.json> --project <dir with no harness.yaml>` | prints the notice, `✓ … matches`, **exit 0** — the flag is ignored and no project is opened |
| **B** | `node spike/bin/harness.js lint --project <same dir>` | **exit 1**, `ENOENT … /harness/harness.yaml`, stack showing `at loadProject (harness.js:58)` ← `at main (harness.js:401)` |

Probe B's stack is also an independent oracle for the line numbers, which is what caught §3's
citation defect.

### Finding 1 — `validate` does not call `loadProject()` (AC-4)

**Refused. Behaviour preserved.** Probe A shows the spike's `validate` opens no project, so AC-4's
*"Both commands call `loadProject()` first"* is true of `lint` and was **never** true of `validate`.
Implementing it literally makes `quorum validate` refuse to run outside a checkout — a behaviour
change on the one command in this ticket with a *machine* consumer, where a `qa-red` `type: script`
step reads the exit code. Ground rule 3 and §6 non-goal 15 both forbid it.

AC-4's own *Test:* clause confirms the contradiction rather than resolving it: "*each command run
from a directory with no project, asserting the sentence, exit 1*". Applied to `validate`, that
asserts an outcome the spike does not produce.

### Finding 2 — `lint` reads `flags.project` (AC-2)

**Refused. Behaviour preserved.** Probe B shows the spike's `lint` honours `--project`. Dropping it
would silently stop the flag deciding which project is linted.

Worth separating the two halves of AC-2, because only one of them is in question. Its **normative**
content — the headline *"no command re-parses the command line"*, and the *Test:* clause, a source
scan for `process.argv`/`parseArgv(` plus a behavioural test through `main(argv)` — is **fully
satisfied**: `lint` reads the value the frame parsed, from the `ParsedArgv` it was handed, and
`lint.test.ts`'s first AC-2 test is what proves that. What is wrong is the **descriptive aside**,
"`validate` reads `rest`, `lint` reads neither". That is a sentence about the tree, and it is false.

---

## 2. What I changed, file by file

Four files, all under `packages/cli/src`. No `spike/**` change (ground rule 1), no edit or deletion
under `spike/test/**` (ground rule 2), nothing under `backlog/` or `docs/decisions/`.

### `packages/cli/src/validate.test.ts` — a guard that could not see its subject

**This is the substantive change of the round.** The pin protecting the disputed `validate`
behaviour created an orphan temp directory and `chdir`'d into it, but **never asserted the directory
was actually orphaned**. `findProject` walks *upwards*, so on a machine whose temp directory sat
inside a checkout, an AC-4-literal `validate` would have found that ancestor project, succeeded, and
left the test green **over the exact behaviour change it exists to catch**. The verdict was a
property of where the machine puts `os.tmpdir()`.

`lint.test.ts`'s `inAnOrphanDirectory` helper, three lines away in the same package, has carried
`expect(findProject(orphan)).toBeNull()` since it was written. The stricter shape was already in the
tree; this test just did not use it.

Added that assertion, with a comment naming why it is load-bearing and citing *"A test's verdict is
a property of the commit, not of the checkout or the account"* (2026-08-30) — a machine property may
refuse a run and may never be the oracle. Added the `findProject` import from `@quorum/core`.

Also extended the block comment to name the owed erratum, so a reader meeting AC-4 first finds the
answer at the code.

### `packages/cli/src/lint.test.ts` — citation, and the reasoning behind the divergence

Corrected `:52` → `:55` at two sites. Rewrote the AC-2 `--project` test's comment to record *why*
the aside is wrong rather than only *that* it is: the closure over `flags`, the case block that
names no flag, the execution evidence, and the separation of AC-2's normative half (met) from its
descriptive aside (owed an erratum).

### `packages/cli/src/lint.ts` — citation, and a one-line authority

Corrected `:52` → `:55` and `296–311` → `299–311`. Extended `flowsDir`'s `@param` with one clause
naming the criterion diverged from and the erratum owed, per the engineering rules' *"one line
naming the authority"*. The pre-existing `path.resolve(true)` preserved-defect note is unchanged.

### `packages/cli/src/validate.ts` — one-line authority

Extended the module JSDoc's existing `Why: preserved, ground rule 3` with the AC-4 pointer and the
owed erratum. No code change.

---

## 3. A defect found while checking the refusals: the citations drift by three

Verifying my own refusal meant verifying its citations, and they were wrong — in the same direction,
by the same amount, at four sites:

| cited | actual | what is at the cited line |
| --- | --- | --- |
| `harness.js:52` (×3) | **`:55`** | `}` — the closing brace of `findProject` (46–52) |
| `harness.js:296–311` | **`299–311`** | mid-comment; `function lintDirectory` opens at 299 |

A consistent off-by-three is a line map transcribed and then shifted, not four independent slips —
the shape Q-0057 found (`runId` at `:44`, not `:49`) and Q-0051 found twice. Confirmed two ways:
`grep -n` for each anchor, and probe B's stack trace, which names `loadProject (harness.js:58)` and
`main (harness.js:401)` and so fixes the numbering independently of anything I typed.

Every other spike citation in the four files was checked and is **correct**: `:404`, `:460`,
`:426–461`, `:430`, `:442–445`.

---

## 4. Verification

**Both refusals are demonstrated red**, which is what makes them safe to advance past. Each mutation
was applied, measured, and reverted; `git diff` confirms neither survives.

| mutation | result |
| --- | --- |
| `validate` calls `loadProject()` first, AC-4 literal | **1 failed**, 22 passed — `and it opens no project…`: `expected 1 to be +0` |
| `lint` ignores `flags.project`, AC-2 aside literal | **3 failed**, 19 passed — incl. `expected '✓ in-the-cwd.yaml\n' to be '✓ over-there.yaml\n'` |

The first fails one test and leaves 22 green, so the guard is precise rather than broad. The second
shows the flag is load-bearing on two AC-4 error paths as well.

**Suites, all forced, after both reverts:**

- `pnpm turbo run test --force` — **7/7 tasks, 0 cached**; `@quorum/cli` 12 files, **226 tests passed**
- `npm test --prefix spike` — **19/19 files passed**, and `git diff` shows **0 edits under `spike/**`**
- `pnpm turbo run lint typecheck --force` — **14/14 tasks, 0 cached**
- `pnpm sweep:git-identity` — green: *"both suites executed and green with no resolvable git identity"*
- `pnpm turbo run build` — 3/3; the packed-install fixture ran inside the CLI suite (*"the packed set
  installs outside the workspace with the registry dead, and runs"*)

**§10's manual proof — the shipped binary against the spike, line for line.** Byte-identical on
every path compared, escape bytes included:

| case | agreement |
| --- | --- |
| `lint` over the six shipped flows | identical, exit 0 |
| `validate` — notice path, then a violation, loop continuing | identical, exit 1 |
| `validate` against the recognised `run-manifest` contract | identical; correctly **no** notice on the structurally-invalid path |
| `validate` with no arguments | identical, incl. the preserved `usage: harness validate …` |
| **`lint --project <no-config dir>`** | identical — ENOENT from `loadProject`, as in probe B |
| **`validate … --project <same dir>`** | identical — validates normally, as in probe A |

The last two rows are the disputed behaviours themselves: the shipped binary reproduces both.

---

## 5. The two errata owed at the gate

Neither is mine to write. Both are one ruling each, and under both the code is already correct, so
`advance` needs no further implement round.

**E-5 — AC-4 governs `lint` alone; `validate` opens no project.** Measured: `spike/bin/harness.js`'s
`validate` case (`:426–461`) never calls `loadProject`, and running it with `--project` aimed at a
directory holding no `harness/harness.yaml` validates normally and exits 0. AC-4's *"Both commands"*
is true of `lint` and was never true of `validate`. Requiring a project would be a behaviour change
on the command's machine-facing surface, where a `qa-red` `type: script` step reads the exit code —
refused by ground rule 3 and §6 non-goal 15. AC-4's headline, its sentence and its no-stack-trace
clause are unchanged for `lint`.

**E-6 — AC-2's aside is wrong about `lint`; its normative half stands.** `spike/bin/harness.js:55`
reads `flags.project` *inside* `loadProject`, which `lint` calls at `:401` with no argument, so
`harness lint --project <dir>` lints that project. AC-2's clause *"`validate` reads `rest`, `lint`
reads neither"* describes the case block rather than the behaviour. What binds is the headline — no
command re-parses the command line — which the shipped `lint` satisfies: it reads the value the
frame parsed, calls no `parseArgv`, touches no `process.argv`, and defines no second flag table.

---

## 6. Deliberately left alone

- **`spike/src/**` and `spike/test/**`** — untouched (ground rules 1 and 2). Nothing in this round
  needed a spike change; if it had, I would have stopped and said so.
- **`requirements/errata.md` and every other path under `backlog/`** — not an agent-writable surface.
- **`docs/decisions/`** — a decision is the human's to record. Neither erratum above rises to one.
- **The `harness`-named sentences** — `usage: harness validate …` and ``run `harness init` in your
  repo`` are preserved verbatim: Q-0100's, per E-1 and OQ-2, not this child's.
- **Q-0068's *"Harness runs on subscription OAuth only"*** — this ticket renders no adapter output.
- **`path.resolve(true)` on a valueless `--project`** — preserved defect, already pinned.
- **The eleven criteria the review did not raise** (AC-1, AC-3, AC-5 to AC-13) — approved in round 1
  and not reopened. I re-ran them rather than re-reading them; all green.
- **Anything not traceable to a criterion or a finding.** The citation fix is in scope only because
  the citations are the evidence the refusals rest on.

---

## 7. One thing the reviewer should weigh

My refusals and the reviewer's findings are not in conflict about the facts — we agree on what the
spike does. The disagreement is about who may resolve a contradiction between two binding documents,
and there the reviewer is right that I may not. So the honest state of this branch is: **the code is
correct against the tree and unauthorised against two sentences**, held meanwhile by two guards that
are now demonstrated to fire. A second revise round cannot change that; only the gate can. That is
the condition *"A refused finding is a gate, not another round"* (2026-08-31) names, and Q-0083 —
an implement step that can return `blocked` — is the mechanism this round would have used if it
existed. This is its tenth appearance.
