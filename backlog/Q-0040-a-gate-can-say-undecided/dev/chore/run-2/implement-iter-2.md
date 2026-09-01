# Q-0040 implement — run 2, iteration 2

*A revision round. Review round 1 returned two majors; this document addresses both explicitly, and
the disposition of each was ruled by the human rather than chosen here.*

---

## What this round did, in one paragraph

Both majors were **confirmed by measurement before anything was changed**, and then routed by
`requirements/errata.md`, which the human wrote at **17:52 today** — after this round's prompt was
built. **Major 2 is declined**, on E-1's explicit instruction that round 2 must not attempt it.
**Major 1 is landed in full**: the five frozen contracts now carry `undecided`, the occurrence enum
is untouched, and `harness validate` accepts a manifest the shipped engine can produce. Closing it
required moving one guard nobody had named — `q0033-surface.js` S11.5 byte-freezes
`contracts/Q-0006` — which is the finding of this round and is flagged for the reviewer below.

Twelve files changed. No `spike/src`, no `docs/decisions/`, no `backlog/`.

---

## A process note that should not be buried

**`requirements/errata.md` was not in this step's inputs.** `chore.yaml:12` lists it, and the file
exists — but it was written at `17:52:40` and this iteration's prompt carries `merged.md`,
`review/chore/run-2/chore-iter-1.md`, `rules.md` and `architecture.md` and not the erratum. It was
read from the main worktree, which is a granted directory, and it is the authority this round
followed on both findings.

Stated because the consequence is general rather than local: **an erratum written after a round's
prompt is built does not reach that round**, and the erratum channel is precisely the one the
2026-08-31 decision routes a refused finding through. A round that had not gone looking would have
re-litigated major 2 and refused major 1 on role paths — the opposite of both rulings.

---

## Review finding 1 — the frozen contracts. **Landed.**

> *major: `contracts/Q-0011/run-manifest.schema.json:23` … Land the five contract updates and
> required erratum specified by AC-11 while leaving the occurrence enum at line 68 unchanged.*

### Confirmed before it was acted on

The reviewer is right, and it is not a reading of the schema — it is the command a maintainer runs:

```
$ node spike/bin/harness.js validate contracts/Q-0011/run-manifest.schema.json <manifest status:undecided>
✗ … /status: must be equal to one of the allowed values          exit 1
```

Iteration 1 had put `undecided` in `TERMINAL_STATUSES` in both trees (`spike/src/contracts.js:51`,
`packages/core/src/contracts/run-manifest.ts:24`), so the **semantic** pass admitted it while the
**structural** schema refused it. After the change, the same command exits 0, and the occurrence
case still exits 1 naming `/steps/0/status`.

### Why iteration 1 refused it, and why this round did not

Iteration 1 declined on role paths, and that reading was defensible: `contracts/` appears in **no**
role's `paths:` frontmatter — not `developer-generalist`, not `backend`, not `tooling` — and
`harness/architecture.md`'s table agrees, with `smoke.js` asserting the two agree mechanically.
Every commit in the repository's history that touches `contracts/` is either an `architect:` step or
a hand commit; **no chore implement step has ever written there.**

E-1 overrules that: *"AC-10 and AC-11 name the five contract updates and the erratum they need, the
occurrence enum at `:68` stays as it is, and all of it is the implementer's."* That is the human
granting the surface at the gate, which is the authority the role prose answers to.

### The five files

| # | File | Change |
| --- | --- | --- |
| 1 | `contracts/Q-0011/run-manifest.schema.json:23` | run-level `status` enum gains `undecided`. **`$defs.step.status` at `:68` untouched.** |
| 2 | `contracts/Q-0006/ticket-review-state.schema.json:23` | history enum gains `interrupted` **and** `undecided` (ruling R-B). |
| 3 | `contracts/Q-0050/run-flow-api.contract.ts:6, :18` | `RunStatus` and `NonRegressionRunOutcome` gain it. **`finaliseActiveOccurrences` at `:14` left `'failed' \| 'interrupted'`.** |
| 4 | `contracts/Q-0050/lifecycle-routing.contract.md:15, :24` | terminal-line list; and the branch-reset clause now **answers** the question instead of leaving it to inference. |
| 5 | `contracts/Q-0050/run-events.contract.md:45` | terminal-event union, with a note that `:80` needs no amendment. |

Each of the three prose/TS files carries an inline supersession note in the file's own existing
style — `run-events.contract.md:84` and `:104` already do this (*"Superseded by solution/errata.md
E-12"*). The two JSON schemas carry none: neither file has a `$comment` anywhere, and inventing that
convention to annotate an edit would be an unrequested default. **Their record is the erratum**,
which is what "superseded by erratum, not edited silently" means.

### R-B has a committed witness, which the requirement did not have

R-B was argued from the engine writing `interrupted`. It is stronger than that:
**`backlog/Q-0011-run-history-on-disk/ticket.md:122` carries `status: interrupted` and has failed
the frozen Q-0006 contract for as long as it has carried it** — today, and independently of Q-0040.
That artifact is now the fixture in `contracts.test.ts` rather than a synthetic entry, because the
divergence was never hypothetical: nothing validated a real ticket against that file.

---

## ⚠ The finding this round produced: S11.5 byte-freezes `contracts/Q-0006`

**Named by no candidate, no iteration, no reviewer, and not by AC-11.** `spike/test/q0033-surface.js`
S11.5 was:

```js
git(repo, 'cat-file', '-e', '5d16e06^{commit}');
assert.equal(git(repo, 'diff', '--name-only', '5d16e06', '--', 'contracts/Q-0006'), '');
```

**Any** byte of `contracts/Q-0006/` turns it red. So AC-10 and AC-11 item 2 were **unsatisfiable in
any form** without moving it — and reversing R-B at the gate does not avoid this, because narrowing
item 2 to `undecided` alone still edits the same file. AC-11's own *Test* names `contracts.test.ts`
and `validate-artifact.test.ts` and not this guard.

It also explains a precedent that looked contradictory: **Q-0073's E-4 superseded two frozen Q-0006
contracts and never edited them.** Git history confirms no Q-0073 commit touches `contracts/`. This
is the first authorised change to land inside that freeze.

**What was done, and why that shape.** The guard is **narrowed**, not re-baselined and not deleted:

- a newer baseline commit would freeze whatever else happened to be in the tree at it;
- deleting the assertion leaves seven contract files unguarded.

It now asserts the changed set is exactly `ticket-review-state.schema.json`; that the enum **gained
exactly** `interrupted` and `undecided`; that it **removed nothing**; and that restoring the
baseline enum makes the file byte-identical again.

**All four clauses demonstrated failing on their own**, per Q-0071's rule that showing a guard has a
subject proves it fires and not that each clause does:

| Probe | Clause that fired |
| --- | --- |
| a newline appended to `review-lint.contract.md` | `only the superseded file differs` |
| `failed` removed from the enum | `an erratum adds, it never removes` |
| `paused` added instead of `undecided` | the added-pair deep-equal |
| `"title"` edited | `nothing outside the status enum moved` |

**This is the one change in this round the requirement did not name, and a reviewer should judge it
directly.** Editing another ticket's freeze guard is a decision. The alternative was to leave the
suite red or to drop a criterion the human had just ruled mine.

---

## Review finding 2 — the decision entry's `--auto` sentence. **Declined, on instruction.**

> *major: `docs/decisions/076-…:46` … Correct the sentence so the decision does not contradict
> shipped behavior.*

**The finding is correct.** Line 46 reads *"`--auto` cannot produce `undecided`"* and then, in the
same sentence, *"…and is undecided for the same reason."* The shipped suite settles it:
`spike/test/smoke.js:112–117` runs `--auto` into a `human-locked` exhaustion gate and asserts
`r.status === 3`.

**It is not this step's to fix, and E-1 says so in as many words**: *"Round 2 must **not** attempt
major 2, and a round that declines it is declining correctly."* Three independent reasons:

1. `harness/roles/developer-generalist.md:23` forbids this step from adding to `docs/decisions/`.
2. `harness/rules.md` forbids **anyone** from editing a landed entry; the repair is a new entry.
3. E-1 discharges it through
   `docs/decisions/077-erratum-auto-does-reach-an-unanswered-gate.md`, the human's.

E-1's last clause was checked rather than assumed: *"Any criterion, test or document that says
`--auto` cannot produce `undecided` is wrong for the same reason and moves with it."* A sweep of
`docs/`, `packages/`, `spike/` and `harness/` for `--auto` co-occurring with `undecided` returns
**one hit — line 46 itself**. Nothing of mine moves with it. **The shipped behaviour is correct and
was not changed to match the wrong clause.**

---

## What AC-11 asks for that is still outstanding: the erratum, drafted

E-1 covers only the decision entry and says so. AC-11 additionally requires an erratum **naming each
of the five files**. `backlog/` is not writable by any agent step in any flow — `commitAll`
(`spike/src/fanout.js:81–86`) runs `git checkout -- backlog` and `git clean -qfd -- backlog` before
every step commits — so this is the human's. Drafted in full so the commit is transcription rather
than authoring, on the precedent decision 047 praises:

> ### E-2 — the five frozen contracts superseded for the `undecided` vocabulary
>
> **Round 1's major 1, accepted and landed.** The engine persists `status: undecided` while five
> frozen contracts closed their status unions before the word existed. Measured: `harness validate`
> exits 1 with `/status: must be equal to one of the allowed values` on a manifest valid new
> behaviour produces.
>
> 1. `contracts/Q-0011/run-manifest.schema.json:23` — run-level enum gains `undecided`. `:68`, the
>    **occurrence** enum, is unchanged: a gate allocates no occurrence, so nothing one level down
>    can be undecided.
> 2. `contracts/Q-0006/ticket-review-state.schema.json:23` — history enum gains `undecided` **and**
>    `interrupted` (R-B). The second is not scope creep:
>    `backlog/Q-0011-run-history-on-disk/ticket.md:122` carries an `interrupted` and has failed this
>    contract since it did.
> 3. `contracts/Q-0050/run-flow-api.contract.ts:6, :18` — both closed unions.
>    `finaliseActiveOccurrences` at `:14` stays `'failed' | 'interrupted'`.
> 4. `contracts/Q-0050/lifecycle-routing.contract.md:15` — the terminal-line list; and `:24`, whose
>    branch-reset rule stayed literally true and became incomplete, now states that `undecided` does
>    not reset. `:16–19` is unchanged and still true. **`:58` is not superseded** — see below.
> 5. `contracts/Q-0050/run-events.contract.md:45` — the terminal union. `:80` needs no amendment,
>    being already conditioned on *failure*.
>
> **`spike/test/q0033-surface.js` S11.5 is superseded with them.** It byte-froze `contracts/Q-0006`
> against `5d16e06`, so item 2 was unsatisfiable while it stood. Narrowed to admit exactly this
> supersession rather than re-baselined or deleted.

---

## AC-11 item 4 cites a line that is not about statuses. **Reported, not changed.**

AC-11 names `lifecycle-routing.contract.md:58`, quoting *"its seven terminal regression values"*.
Measured, that is **not** a status enumeration: `run-events.contract.md:49` defines it — *"The
regression payload has seven values in the spike: target flow, stage before, stage after, counter,
count, limit, and remaining"* — which is `RegressionFields`' seven fields, and the clause's own tail
(*"clamp remaining at zero"*) names one of them.

`undecided` is not a regression, so nothing about that clause moves. It is left byte-unchanged.
Editing it would have made a true sentence false to satisfy a citation. The likely cause is reading
*"seven terminal … values"* as a status count.

---

## File by file

### The five contracts

| File | Change |
| --- | --- |
| `contracts/Q-0011/run-manifest.schema.json` | one line: run-level enum. Diff verified to be exactly that line. |
| `contracts/Q-0006/ticket-review-state.schema.json` | one line: history enum, `+interrupted +undecided`. |
| `contracts/Q-0050/run-flow-api.contract.ts` | two unions widened, one JSDoc naming the supersession and why the occurrence type is not widened. |
| `contracts/Q-0050/lifecycle-routing.contract.md` | `:15` list; `:24` gains the explicit `undecided` answer with its authority. |
| `contracts/Q-0050/run-events.contract.md` | `:45` union; a paragraph recording the supersession and that `:80` is untouched. |

### Pins moved with the change

**`packages/core/src/run-history/manifest.test.ts`** — iteration 1 had rewritten this to register
the divergence, saying *"the day the erratum lands this assertion goes red and has to move with
it"*. It landed; it moved. Restored to its original title, with the hole iteration 1 correctly
identified now closed: the expected list is a `satisfies Record<RunStatus, true>` rather than a
`RunStatus[]`, so it is exhaustive in **both** directions — a new member is a missing key and a
removed one an excess key, each a compile error — and the schema list is derived from it instead of
being a second copy. The old array form could not fail in the direction that mattered, which is why
widening `RunStatus` left it green while its own title stopped being true.

**`packages/core/src/run-history/writer.test.ts:549`** — *"whichever of the **six** terminal
statuses … and only those six"* was about to become a false promise in a test. Now seven, with
`undecided` round-tripped through `finalise` like any other; `onDisk` does no schema validation, so
this was addable and simply had not been.

**`packages/core/src/contracts/contracts.test.ts`** — `q0006Frontmatter()` generalised to
`frontmatterOf(file)` with a thin wrapper, so no existing call site moved. Two tests added: Q-0011's
committed frontmatter validating (the witness), and both new statuses admitted while `paused` is
still refused — *widening is not opening*.

**`packages/core/src/turbo-inputs.test.ts`** — Q-0072's guard refused the new read site until it was
registered, which is the machinery working. `INDIRECT_ROUTES` gains `'repoFile → file'` for
`contracts.test.ts` with the reason its call sites pass literals; `COLLECTED_BASELINE` gains one
**occurrence** of a literal it already held from `reader.test.ts`, so distinct literals stay at 40
and the pinned count goes **72 → 73**.

> **A nit found on the way in.** The register's prose chain ended *"Seventy-one over forty"* while
> the assertion below it read `72`. The prose was one behind before this change. The new count is
> re-derived from the array rather than continued from the sentence, and the paragraph says so, so
> the jump of two is explained rather than silently absorbed.

**`packages/core/src/spike-parity.test.ts`** — re-derived **twice**, not adjusted: once for
`q0040-undecided.js` 345 → 380, then again once S11.5 took `q0033-surface.js` +24 net. Both files
are entangled, so all of it lands in one bucket: `both` 2647 → **2706**, total 5336 → **5395**,
`binary-only` 220 and `library-only` 2469 unchanged, share **54% either side**. The unchanged share
is stated rather than skipped, because *"it did not move"* is a measurement.

**`spike/test/q0040-undecided.js`** — the AC-10 scenario had only the negative half (the occurrence
enum refusing the word), because the positive half was false when it was written. It now asserts the
run-level enum too, and a **new end-to-end scenario runs `harness validate` in both directions** —
which is not the same check as reading the enums, since the schema is reached through a `$defs`
indirection and a semantic pass.

**`spike/test/q0033-surface.js`** — S11.5, above.

### Red before green

Every new assertion was demonstrated failing against the unchanged tree before it was trusted:

- run-level enum reverted → both new AC-10 checks red (`the run-level enum admits it, …` and
  `a run that ended undecided validates`);
- `undecided` added to **both** enums → the negative halves red, so the check is not satisfied by a
  schema that admits the word everywhere;
- the four S11.5 probes above.

---

## Deliberately left alone

| Subject | Why |
| --- | --- |
| `docs/decisions/076-…:46` | E-1: not this step's, and a landed entry is never edited by anyone. |
| `run-manifest.schema.json:68` — occurrence enum | The reviewer said so, AC-10 says so, and it is the boundary the criterion exists to draw. |
| `run-history-writer.contract.md:75`, `finaliseActiveOccurrences` | Occurrence-level. AC-10's "and nowhere it is not". |
| `lifecycle-routing.contract.md:16–19` | *"Move the stage only for completed and regressed"* stays true. AC-11 says not to edit it. |
| `lifecycle-routing.contract.md:58` | Regression payload fields, not statuses. Reported above. |
| `run-events.contract.md:80` | Already conditioned on *failure*; ruling R-A rests on that. |
| `requirements/errata.md` E-2 | `backlog/` is reverted by `commitAll`. Drafted above. |
| `harness/port-charter.md` freeze-SHA (AC-14 step 2) | A commit cannot contain its own hash — Q-0037 E-1. The human's follow-up commit after the merge. |
| `spike/src/**` | Untouched this round. Iteration 1 owns those changes. |
| `packages/core/src/backlog/backlog.ts:276` | Pre-existing lint **warning** (unused eslint-disable), in a file this ticket does not touch. 0 errors. Reported, not fixed. |

---

## Verification

Run in this worktree after `pnpm install --frozen-lockfile` and `npm install --prefix spike`, on the
exact tree being handed over.

| Check | Result |
| --- | --- |
| `npm test --prefix spike` | **19/19 test files passed** |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached** |
| `@quorum/core` vitest | 57 passed, 1 skipped (58) |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `harness validate` — run-level `undecided` | exit 0 |
| `harness validate` — occurrence `undecided` | exit 1, `/steps/0/status` |

`pnpm lint` reports 0 errors and the one pre-existing warning above.

**Not verified here, and not claimable from this worktree:** AC-14's two environment rows. The
`integrate` worktree and the post-merge `main` run are the flow's and the human's, and the
freeze-SHA half is expected red at the merge by design.

---

## For the human at the gate

1. **`docs/decisions/077-…`** — E-1 names it; it is not in the tree yet.
2. **`requirements/errata.md` E-2** — drafted above verbatim.
3. **Rule S11.5.** The narrowing is the one change here the requirement did not authorise, and it
   was unavoidable if AC-10 and AC-11 item 2 were to be satisfied at all. The alternative — drop the
   Q-0006 edit and register the contradiction — is one sentence at this gate.
4. **AC-11 item 4's `:58`** is a misreading and the line is unchanged; worth ratifying so a later
   reader does not report it as an omission.
5. **The erratum did not reach this round's prompt.** Worth a successor: an artifact written to
   satisfy a review finding, after the round's prompt is built, is invisible to the round it was
   written for.
