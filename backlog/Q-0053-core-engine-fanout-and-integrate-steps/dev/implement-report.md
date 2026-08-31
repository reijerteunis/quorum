# Q-0053 implement — round 2

*Revision round against `review/chore/run-2/chore-iter-1.md`. Two majors: **one accepted and
fixed**, **one refused, preserved, registered and pinned**. Re-derived at this branch's own SHA
(`833c391`) rather than from any earlier line map, per the requirement's Risk 9.*

---

## Finding 2 — accepted and fixed

> *major: `packages/core/src/engine/composite.ts:319` The report-routing predicate calls
> `target.includes(...)` on the original flow-authored value even though AC-13 requires every
> `writesOf(step)` entry to be coerced at its call site.*

**Correct, and the failure reproduces exactly as stated.** The line interpolated `String(target)`
and then routed on `target.includes('report')`, so the coercion did nothing for the very failure it
exists to prevent. A `writes:` entry that YAML parses as a number reaches `includes` and throws.

`writesOf` is typed `readonly string[]` (`loaders.ts:57`), but that type comes from a cast over a
`looseObject` flow block, not from a parse — which is precisely why AC-13's table lists the entry as
*flow-authored*. The type was a claim, not a guarantee, and the `String()` one line above is the
admission that the requirement already knew it.

```ts
  for (const target of writesOf(step)) {
    // One coercion serves both uses of the entry: a path is routed by the same string it is
    // written to, so a flow-authored non-string cannot be interpolated and then fail the routing.
    const writePath = String(target);
    context.backlog.writeFile(
      ticket,
      interpolate(writePath, context.vars),
      writePath.includes('report') ? testReport(cmd, out) : notes.join('\n'),
    );
  }
```

**Demonstrated red before green**, over the reverted line rather than asserted:

```
FAIL  composite.test.ts > Q-0053 AC-13 … > a non-string write path is coerced once …
TypeError: target.includes is not a function
 ❯ runIntegrate src/engine/composite.ts:325:14
```

The new test is the one the finding asked for, and it discriminates in **both** directions rather
than only proving the absence of a crash: a step declaring `output: { write: 2, writes:
['dev/{run}-report.md'] }` writes the notes to `2` — which carries no `report` — and the test report
to `dev/4-report.md`, so a coercion that broke the routing would fail it just as a missing one does.

The sibling `writesOf` loop on the base-conflict path (`:256`) already coerced and interpolates only;
it is unchanged.

**One consequence, stated rather than buried.** Against a numeric write path the spike throws a
`TypeError` and `core` now writes a file. That divergence is what AC-13 is for — its own words are
that the spike's *"silent pass-through"* is the thing being replaced — and it is unreachable from
any shipped flow, since all six spell string paths. I am naming it because it is a behaviour
difference, not because I think it needs a ruling.

---

## Finding 1 — refused, preserved, registered, and pinned

> *major: `packages/core/src/engine/composite.ts:255` The base-conflict path throws after allocating
> an integrate occurrence but bypasses `persistArtifact` and `terminalOccurrence`. This violates
> AC-12's requirement that `output.txt` is always persisted, empty included, and that conflict
> outcomes close the occurrence as failed.*

**The observation is right. The repair is one charter §2 forbids me to make, and AC-12 does not ask
for it.** Four measurements, in the order that decides it.

### 1. The spike does exactly this, so the port is faithful

`spike/src/engine.js:1113–1120` — artifacts, then the log line, then the throw. No
`persistArtifact`, no `terminalOccurrence`:

```js
      for (const w of writesOf(step)) backlog.writeFile(ticket, interpolate(w, ctx.vars), notes.join('\n'));
      backlog.log(ticket, `run=${ctx.runId} step=${step.id} base-conflict base=${base} files=${m.conflicts.join(',') || '?'}`);
      throw new FlowError( … );
```

### 2. The requested change is externally observable, so it is a behaviour change

`harness/port-charter.md` §2 names *"what is written to `backlog/`, `.quorum/` and `runs.log` and in
what format"* as externally observable. Adding the two calls creates a
`steps/NNN-integrate/output.txt` that does not exist today and flips an occurrence's `status` from
`running` to `failed` in the manifest. That is `.quorum/` content, not internal layout.

§2 gives exactly two routes for a deliberate change: *"its own `docs/DECISIONS.md` entry or a dated
erratum in the child's folder, written and accepted **before** it is implemented."* Neither exists
for this. Shipping it inside a revise round is the *"silent improvement discovered in review"* the
sentence forbids by name — and it is the same shape as Q-0052's round 3, where the loop shipped a
behaviour change and then approved it.

### 3. AC-12 does not reach this path, and reading it so makes it contradict AC-8

- **AC-12's own citation is `engine.js:1155–1179`** — the tail block, well after the base-conflict
  throw at `:1113–1120`, which AC-8 cites.
- **AC-12's log clause is decisive**: *"`runs.log` gains **exactly** `run=<n> step=<id>
  merged=<kept − conflicts>/<kept> tests=<ok|fail|invalid|->`"*. This path writes
  `base-conflict base=<base> files=<…>`. If AC-12 governed it, AC-12 and AC-8 would contradict each
  other on the log line of the same code path.
- **AC-12's "on conflicts"** pairs with the message form it prescribes in the same clause —
  `integration conflicts: <branches>` — which is the source-branch list `conflicts`, not the base.
- **AC-8 is this path's criterion and enumerates it exhaustively**: *"writes `notes` to every path in
  `writesOf(step)`; appends … to `runs.log`; then **throws**"*, with a verification asking only for
  the artifacts, the log line and an unmoved counter.

So AC-12's *"always"* quantifies over the outcomes that reach `:1155–1179`, which is what makes
*"empty included"* meaningful there. This is the AC-7/AC-11 bounding shape Q-0072's errata E-1 and
E-2 settled, arriving on a different pair of criteria.

### 4. It is nonetheless a real defect, so it is registered rather than argued away

`run-history/writer.ts:383`'s `finalise` sweeps nothing — it sets the run's status and re-serialises
the array, and never touches a still-`running` occurrence. The semantic pass accepts it
(`contracts/run-manifest.ts:163`: `running` requires only a null `duration_ms`), so nothing
downstream reports it either. A run that stops on a base conflict therefore leaves a finalised
manifest holding an integrate step at `running` with no artifact beside it, and a reader of run
history cannot tell why that step ended.

**Preserved and marked** (`composite.ts`, immediately above the throw):

```ts
      // Why: preserved defect, see Q-0053 AC-8 — this exit closes neither the occurrence allocated
      // above nor its `output.txt`, so the finalised manifest keeps an integrate step at `running`
      // with no artifact beside it. Reported at the gate rather than repaired here.
```

**Pinned, and the pin demonstrated to have a subject.** `composite.test.ts` gains
*"AC-14(7) — the throw leaves its occurrence open, which review round 1 asked to be closed"*: the
occurrence is allocated once, `persistArtifact` and `terminalOccurrence` are never called. Run
against exactly the change the finding requested, it fails:

```
AssertionError: expected "persistArtifact" to not be called at all, but actually been called 1 times
 ❯ composite.test.ts:660
```

That is the difference between a refusal and an opinion: a later change to this line is now
deliberate, and the test names who asked for it.

### The channel I could not use, which is the run's own finding

Charter §2's remedy is a dated erratum in `requirements/errata.md`, written **during** the loop —
*"A refused finding is a gate, not another round"* (2026-08-31). I cannot write one: `backlog/` is
outside `developer-generalist`'s write paths and the engine discards a step's backlog write, so the
file would silently not exist. `docs/decisions/` is the human's.

`chore.yaml`'s `implement` step declares no `verdict`, so I have no way to tell the engine this round
is a refusal rather than a revision. My only channel is this document, read at the human gate. That
is **Risk 7 of the merged requirement, arriving on schedule at round 1**, and it is Q-0083's exact
subject. Two paths at the gate, both fine by me:

- **Rule the refusal** — the human writes E-2 in `requirements/errata.md` recording that AC-12 is
  bounded by AC-8 on this path, and the branch stands as it is; or
- **Rule the repair** — the human writes the erratum authorising the two calls, and a following round
  adds them, removes the marker, and moves the register from 19 back to 18.

What must not happen is a third round shipping the change with no erratum, because that is the
Q-0052 sequence this project has already paid for once.

---

## Changed, file by file

**`packages/core/src/engine/composite.ts`** — two edits, ten lines net.

1. `:318–326` — the report-routing coercion above. Finding 2.
2. `:260–262` — the preserved-defect authority line above the base-conflict throw. Finding 1.

Nothing else in the file moved. `runFanOut`, `syncBaseIntoTicketBranch`, the branch resolution, the
evidence block, the install/test sequence and the terminal block are byte-identical to round 1.

**`packages/core/src/engine/composite.test.ts`** — two tests added, none changed or removed.

1. `Q-0053 AC-8 › AC-14(7) — the throw leaves its occurrence open …` — the refusal's pin.
2. `Q-0053 AC-13 › a non-string write path is coerced once …` — the finding's requested test.

**`packages/core/src/engine/q0050.source.test.ts`** — the register arithmetic, moved with its prose.

- `REGISTERED['composite.ts']` gains a tenth entry, `'preserved defect/Q-0053'`.
- The cross-file `preserved defect/` count moves **18 → 19**.
- The prose comment above it moves in the same edit — *"Q-0053 adds seven"* → *"adds eight"*,
  *"TWO were found by porting"* → *"THREE"*, with the third named and with the sentence recording
  that review round 1 asked for the repair and charter §2 refuses it. The header sentence moves too
  (*"Eighteen authority lines"* → *"Nineteen"*).

  This is obligation 2 inherited from Q-0052's body and Risk 5 of the requirement: *a change that
  moves the number and not the comment leaves a comment describing a number that is no longer
  there.* Both moved.

No other file in the branch was touched this round.

---

## Deliberately left alone

- **The two calls the finding asked for.** Argued above. The refusal is the round's main output.
- **`packages/core/src/git/git.ts`, `suite-output.ts`, `routing.ts`, `steps.ts`, `types.ts`,
  `q0053.source.test.ts`, `git.source.test.ts`, `git.test.ts`, `run-composition.test.ts`,
  `turbo-inputs.test.ts`, `diff.test.ts`** — round 1's work, unreported against, untouched.
- **`spike/**`** — byte-unchanged, measured: `git diff --name-only main -- spike/` returns nothing.
- **The pre-existing lint warning.** `packages/core/src/backlog/backlog.ts:276` reports *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. That file is
  untouched by this branch (`git diff --stat main -- packages/core/src/backlog/` is empty), so the
  warning is Q-0080's and pre-existing. Reported, not fixed — it is another ticket's file and this
  ticket names no criterion over it.
- **The sweep script's worktree limitation** — see below. `.github/` is inside my paths and this is
  still not my change to make: it is Q-0079's subject, this ticket names no `.github/` surface, and
  Q-0065's implement step set the precedent by refusing exactly that.

---

## Verification

Run in the implement worktree, which has no `node_modules` until it installs them: `pnpm install
--frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` first.

| Check | Result |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — `@quorum/core` 52 files, **1156 passed**, 2 skipped |
| `pnpm turbo run lint --force` | 7/7, 0 cached — **0 errors**, 1 pre-existing warning in `backlog/backlog.ts` (above) |
| `pnpm turbo run typecheck --force` | 7/7, 0 cached — `tsc --noEmit` clean |
| `npm test --prefix spike` | **17/17 files** |
| `harness lint` (run **inside** the worktree) | 6/6 flows ✓ |
| `spike/**` byte-unchanged | ✓ measured directly, not inferred |
| Mutation: revert the coercion | AC-13 test **fails**, `TypeError: target.includes is not a function` |
| Mutation: add the two calls the finding asked for | AC-14(7) test **fails**, `persistArtifact … called 1 times` |

**Two checks AC-15 names could not be run here, with their causes measured rather than guessed.**

- **`pnpm sweep:git-identity` — unrun.** The shipped script spells `GIT_CONFIG_GLOBAL` as
  `"${repo_root}/.git/sweep-gitconfig-absent"` (`.github/scripts/git-identity-sweep.sh:69`). In a
  **linked git worktree `.git` is a file, not a directory**, so `rm -f` on a path under it fails
  with `ENOTDIR` and the script fails closed in its isolation phase:

  ```
  rm: …/.harness/worktrees/harness__Q-0053__implement/.git/sweep-gitconfig-absent: Not a directory
  ::error::git-identity sweep failed in phase 'isolation': cannot ensure … is absent
  ```

  It fails **closed**, which is the right direction, and it is not a property of this change — the
  sweep has evidently never run inside a worktree, because CI runs it on an ordinary clone and
  `integrate` runs `commands.test`, which does not include it. I attempted a faithful hand
  reproduction of the same environment with only that one path moved out of `.git`; this run's
  permission configuration refused to execute it, so I stopped rather than working around the
  allowlist — Q-0038 lost three rounds to that mistake.

  **The sweep's tripwire half did run and is green**: `packages/core/src/git-identity.test.ts` is
  inside the ordinary suite and passed in the forced run above, over the new tests' git calls. The
  oracle half is owed on `main` after the merge, which AC-15's second environment row requires
  anyway.

- **`.github/scripts/port-freeze-guard.sh` — unrun**, refused by the same permission configuration.
  Its subject is discharged directly instead: `spike/**` is byte-unchanged against `main`, and this
  branch is `harness/Q-0053/implement`, a child on `port-charter.md`'s `children:` list.

Both are stated as *skipped*, not as passing — *"a check that skips its subject must not report
success"* (2026-08-25).

**The second environment row is owed.** Per Q-0072's closing finding, everything above must be
re-run forced on `main` after the merge, where `.harness/worktrees` and `.quorum/runs` exist and
where the sweep and the freeze guard can both run. That is the gate's, not this step's.

---

## For the gate

1. **Finding 1 needs a ruling, and either ruling is cheap.** Rule the refusal and write E-2, or rule
   the repair and authorise the two calls in an erratum for a following round. The branch is
   consistent under the first and one small edit away from the second.
2. **The erratum I could not write is the mechanism Q-0083 exists for.** An implement step that can
   answer `blocked` would have made this refusal visible to the engine at round 1 instead of at the
   gate. Seventh recorded instance of a loop handed work no agent on its route can perform, and the
   second on this port where the missing verdict is the whole cost.
3. **The sweep cannot run in a linked worktree.** Worth its own ticket: every remaining port child
   runs in one, and AC-15-style criteria will keep asking for a check that structurally cannot
   answer there. Not opened here — this ticket names no `.github/` surface.
