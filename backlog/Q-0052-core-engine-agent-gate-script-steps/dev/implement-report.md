# Q-0052 implement — run 3 (revision round)

*Three files changed, all under `packages/core/src/engine/`. `spike/` untouched. One finding
addressed, and it is a reversal of run 2's ruling rather than a refinement of it.*

---

## The finding, and why run 3 answers it differently from run 2

Both reviews in this run's folder carry **one `major`, and it is the same one**:

> `resolveModel` returns a role default model when `role.meta.adapter` is absent, so an adapter-less
> role can pass a vendor-specific model to any resolved adapter. This directly contradicts AC-4(a)
> … the cited spike tests are minimum frozen coverage, not authority to override the criterion.
> Change the logic to return the role model only on explicit adapter equality, remove the
> preserved-defect marker/pin, and add the adapter-less cross-vendor regression case with an
> expected result of `undefined`.

**Run 2 declined it and registered a preservation. Run 3 implements it.** The reviewer's second
sentence is the one that settles it, and I agree with it.

### What the two readings actually are

`spike/src/engine.js:702–707`:

```js
export function resolveModel(step, role, adapterName) {
  if (step.model) return step.model;
  const roleAdapter = role.meta?.adapter;
  if (roleAdapter && roleAdapter !== adapterName) return undefined;
  return role.meta?.model;
}
```

The guard suppresses on **inequality**, not on **absence**. A role carrying `model:` and no
`adapter:` therefore hands its model to whichever adapter resolved — codex included.

AC-4(a) says the opposite, without hedging: *"a role default is inherited **only** when
`role.meta.adapter` equals the resolved adapter name; otherwise `undefined`, so the CLI picks a
model its own login supports."* The ticket body says the same, in the same words. Q-0047's erratum
E-1 says it too, which is where both got it.

### Why run 2's argument does not hold up

Run 2 argued that `resolveModel`'s return **is** "what an adapter is invoked with", which charter §2
names as externally observable, so the strict form is a behaviour change the chore route may not
make in passing. That argument is not wrong about §2; it is wrong about which instrument authorises
the change, and I now think it inverted the burden.

1. **AC-4(a) is itself the written-and-accepted authorisation charter §2 asks for.** §2's own text
   names the route for a deliberate behaviour change as *"its own `docs/DECISIONS.md` entry **or a
   dated erratum in the child's folder**, written and accepted before it is implemented, never a
   silent improvement discovered in review."* A criterion in a merged requirement that went through
   the requirements gate and was advanced by the maintainer is that instrument at a higher grade
   than an erratum, and it names the behaviour explicitly rather than implying it. There is nothing
   silent about it and nothing discovered in review: it was on the page before run 1 started.
2. **Charter §2's register is the operative half, and row 2 is an invariant, not a preserved
   defect.** Row 2's third clause reads *"a role's default model never crosses vendors"*, and this
   ticket's *Invariants inherited* line names row 2's cross-vendor clause explicitly. The loose form
   permits exactly the crossing the row forbids. Contrast row 20, which is how the charter spells a
   defect the port must carry: it is *named in the register as such*. Row 2 is not.
3. **The frozen coverage does not discriminate, which is the reviewer's point.** All three
   assertions at `smoke.js:620–626` set `adapter: 'claude'`, so they pass under both readings. Run 2
   cited them as evidence the strict form is a change; they are evidence of nothing either way. The
   requirement's own risk R-9 anticipated this shape — *"Re-measure anything inherited before it
   enters a durable record"* — and run 2 did the re-measuring but then let a non-discriminating
   oracle outrank an unambiguous criterion.
4. **It is unreachable in every shipped configuration in both trees, and I measured that again.**
   Of the 21 role files in `harness/roles/` and `spike/templates/harness/roles/`, every one that
   declares `model:` also declares `adapter:`; `code-reviewer.md` declares neither. So for every
   role either tree ships, strict and loose produce byte-identical adapter invocations. The port's
   independent-witness property is intact: no run either tree can perform observes a difference.
5. **The strict form is the fail-safe one**, and it is what *"Flows never pin a vendor model name"*
   (2026-08-22) wants: pass nothing and let the CLI choose a model its own login supports, rather
   than pass one that may be another vendor's. `model: opus` reached a codex step once already
   (Q-0001), which is the money this row was bought with.
6. **Run 2's authority line was wrong on its own terms**, and the reviewer was right to say so. It
   read `Why: preserved defect, see Q-0052 AC-4a` — citing, as the authority for preserving the
   behaviour, the very criterion that forbids it. If the preservation had been right, its authority
   was charter §2 and the spike, never AC-4(a).

**This is nonetheless a divergence from the spike**, and I am not going to present it as anything
else. See *Reported, not fixed* item 1 for what it costs and who has to rule on it.

---

## File by file

### `packages/core/src/engine/steps.ts` — the change itself

`resolveModel` now suppresses on absence as well as on inequality:

```ts
  if (step.model) return step.model as string;
  const meta = block<{ adapter?: string; model?: string }>(role.meta);
  if (meta?.adapter !== adapterName) return undefined;
  return meta.model;
```

`adapterName` is always a non-empty string (`resolveAdapterName` defaults to `'claude'`), so a role
with no `meta` and a role with no `adapter:` both fall to `undefined` through the same comparison
rather than through a second branch.

**Run 2's `Why: preserved defect, see Q-0052 AC-4a` line is deleted.** A marker registers a
preservation; there is no longer one to register, and leaving it would make the register describe
code that does not exist.

The JSDoc is rewritten to state the rule the code now implements and to say *why* an adapter-less
role inherits nothing — it names no vendor its model could be right for. It still cites register
row 2's third clause and Q-0047 E-1, and it still names Q-0001 as the incident. It does not
transcribe the ticket body or a decision entry (`harness/rules.md` — *cite, do not transcribe*).

Nothing else in the file moved. `resolveModel`'s only caller is `runAgentStep` at `steps.ts:182`;
I grepped `packages/core` for other callers and there are none.

### `packages/core/src/engine/steps.test.ts` — the pin becomes the regression case

Run 2's `PIN: a role naming no adapter passes its model to any vendor, as the spike does` is
removed with its sixteen-line justification, and replaced by the case the reviewer asked for:

```ts
  test('a role naming no adapter names no vendor, so it lends its model to none', () => {
    expect(resolveModel({}, { meta: { model: 'sonnet' }, body: '' }, 'codex')).toBeUndefined();
    expect(resolveModel({}, { meta: { model: 'sonnet' }, body: '' }, 'claude')).toBeUndefined();
  });
```

Both rows return `'sonnet'` under the spike's guard, which is what makes them the discriminating
ones and not decoration — the `claude` row matters as much as the `codex` row, because it is the
one that proves the rule is *equality* rather than *not-codex*. The comment above says which spike
lines it diverges from and why, so a reader meets the divergence here rather than deducing it.

The four criteria-level tests above it are unchanged and still hold: AC-4(a)'s three
`smoke.js:620–626` rows, and *"a role naming no model passes none"*. That last one now passes for a
second reason as well as its first, which is harmless — its subject is a missing `model`, not a
missing `adapter`.

### `packages/core/src/engine/q0050.source.test.ts` — the register is corrected in both halves

- `REGISTERED['steps.ts']` returns to `['behaviour-from-spike', 'preserved defect/Q-0052']`, one
  entry rather than run 2's two.
- The cross-file `preserved defect/` count returns from `11` to **`10`**, which is the number run 1
  landed. Run 2 raised it; run 3 puts it back.
- The comment above the count is rewritten to match — Q-0052 adds **two** markers (`prompt.ts`'s
  read of the Q-0078 cache, and `steps.ts`'s unguarded `usage` in the step's `runs.log` line) — and
  records that a third was registered in run 2 and withdrawn in run 3. Risk R-5 in the requirement
  is explicit that the comment must move with the number or it describes a number that is no longer
  there.

---

## How each half was demonstrated rather than claimed

The requirement is emphatic that a check asserted only by reading it is not established
(*"A check is not established by reading it"*, 2026-08-29). Both halves of this round were run in
both directions.

**The new test discriminates.** I restored the spike's exact guard in `steps.ts`, ran
`pnpm turbo run test --force`, and got:

```
FAIL src/engine/steps.test.ts > Q-0052 AC-4a … > a role naming no adapter names no vendor, so it lends its model to none
AssertionError: expected 'sonnet' to be undefined
Test Files  1 failed | 48 passed | 1 skipped (50)
```

**One** test file failed and **one** assertion inside it. That is worth stating as its own result:
nothing else in `packages/core` — no golden prompt, no `step`-event message, no fixture — depends
on the loose behaviour, so the change is as surgical as the measurement in §4 above predicted. Then
I restored the strict form and the suite went green again.

**The register still fails closed.** I put the withdrawn marker back into `REGISTERED` while
leaving the source without it, and the register caught it:

```
FAIL src/engine/q0050.source.test.ts > … > AC-13d: every preserved defect is a registered site, and none transcribes a document
AssertionError: expected { 'diff.ts': [ …(5) ], …(6) } to strictly equal { 'diff.ts': [ …(5) ], …(6) }
```

That is the *added-an-unregistered-marker* direction's mirror — a registered entry with no marker in
the source — and it is the direction that matters here, because this round removes a marker. AC-1(e)
requires that register to be demonstrably live in both directions, since it is this ticket's **only**
pin on the Q-0078 preservation; run 1 demonstrated the throw-on-unclassifiable direction, and this
round re-demonstrated the map direction after editing it.

---

## Verification

Clean install first, per `harness/rules.md` — a chore worktree has no `node_modules`:
`pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`, both exit 0.

| Gate | Result |
| --- | --- |
| `pnpm turbo run test --force` | **7 successful, 7 total, 0 cached**; `@quorum/core` 49 files passed, 1 skipped; 1073 tests passed, 2 skipped |
| `npm test --prefix spike` | **all 17 test files passed** |
| `pnpm lint` | 7/7 successful, **0 errors** (one pre-existing warning, below) |
| `pnpm typecheck` | 7/7 successful, `tsc --noEmit` clean, no `any`, no `@ts-ignore` |
| `git status` | exactly the three files above; `git diff HEAD -- spike/` is **empty** (charter §3) |
| `packages/core/src/git-identity.test.ts` | green, inside the forced suite |
| `pnpm sweep:git-identity` | **not run — see *Reported, not fixed* item 2. Reported as skipped, not as passed** |

The only skips are `src/adapters/real-cli.probe.test.ts`'s 2 tests, gated on `QUORUM_REAL_CLI` —
Q-0065's live probe, which is expected to skip without the switch and is unrelated to this change.

AC-15(d) asks for verification **forced in both environment rows**. This worktree is the row that
has neither `.harness/worktrees` nor `.quorum/runs`, and it is forced and green. The second row —
`main` after the merge, where both exist — is the maintainer's to run at the gate, per Q-0072's
closing finding; nothing in this round touches a path either row's guards read.

---

## What I deliberately left alone

- **Everything run 1 landed and run 2 did not touch.** `prompt.ts`, the rest of `steps.ts`,
  `types.ts`, `engine.ts`, `routing.ts`, `q0052.source.test.ts`, and the five new test files are
  unchanged in this round. This was a revision round with one finding; re-opening settled criteria
  would have given the reviewer a diff it has already read, with the one thing it asked for buried
  in it.
- **`spike/**`.** Frozen (charter §3). The spike keeps the loose guard, and `smoke.js:620–626` stays
  green over it. See item 1 below for the consequence.
- **`backlog/`.** Not a writable surface on this route — `commitAll` reverts it — so the erratum
  that would ordinarily record this reversal cannot be written by any step in `chore.yaml`. This
  report is standing in for it, which is a weaker instrument and is named as such.
- **`contracts/`.** Read only (R-9). The new strings still live as exported constants in their own
  test files.
- **The `signalWindow` timer.** R-7 declines it; nothing in this round needed it gone. It remains
  GO-2 at the gate.
- **The preflight deferral report.** R-6 rules it a successor; GO-1 carries its body.
- **Q-0078.** Ported as it stands, registered, not fixed (non-goal 4).
- **The pre-existing lint warning** at `packages/core/src/backlog/backlog.ts:276`, *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is Q-0080's
  file, it is a warning rather than an error so `pnpm lint` exits 0, and it is outside this ticket's
  surfaces. Reported, not fixed.

---

## Reported, not fixed

**1. `core` and `spike` now disagree about `resolveModel`, and no port child may close it.**
This is the cost of the change above and the thing the gate has to rule on. `spike/src/engine.js`
keeps the loose guard until the cutover; `packages/core` is strict from this branch on. Measured
consequence: **none for any shipped configuration** — every role file in both trees that declares
`model:` also declares `adapter:`, so no flow either tree can run reaches the branch, and both
suites are green over their own tree. The exposure is an adopter's role that names a model without
an adapter, which is the configuration register row 2 exists to forbid.

The shape this wants is Q-0066's and Q-0068's: a fix that lands in `spike` and `packages/core`
**together**, as its own ticket, because a change in one tree alone is the divergence the freeze
exists to expose. I cannot open that ticket (`backlog/` is unwritable here) and I cannot make it
(charter §3). If the maintainer instead judges that run 2 was right and the spike's behaviour should
have been preserved, the reversal is one commit against these same three files plus the erratum that
should have preceded it — and in that case the review loop needs to be told, because it has now
returned the same `major` twice and a third round would return it again. *"A reviewer approves the
change it asked for"* (2026-08-29) is the entry that predicts this exact standoff, and its ruling is
that an erratum is what gives the loop a subject. That erratum is a write no step on this route can
perform.

**2. `pnpm sweep:git-identity` cannot run in a git worktree, so AC-15(d)'s sweep clause is
*skipped*, not passed.** `.github/scripts/git-identity-sweep.sh:69–70` does:

```sh
export GIT_CONFIG_GLOBAL="${repo_root}/.git/sweep-gitconfig-absent"
rm -f "${GIT_CONFIG_GLOBAL}" || fail "cannot ensure ${GIT_CONFIG_GLOBAL} is absent"
```

In a `.harness/worktrees/` checkout `.git` is a **96-byte gitdir pointer file**, not a directory, so
that path has a non-directory component, `rm -f` exits non-zero with `Not a directory`, and the
sweep aborts in its `isolation` phase before running a single test:

```
::error::git-identity sweep failed in phase 'isolation': cannot ensure …/.git/sweep-gitconfig-absent is absent
```

It is pre-existing — this round's diff is three TypeScript files — and it is not a verdict about any
test. But it means **every chore implement step and every `integrate` step in this repository runs
in a checkout the sweep refuses**, since both run in worktrees; only CI's plain clone and the
maintainer's own checkout can execute it. That is Q-0079's own decision — *"A test's verdict is a
property of the commit, not of the checkout"* (2026-08-30) — with its enforcer's *runnability*
depending on the checkout. The fix is small (a temp path outside `.git`, or `git rev-parse
--git-common-dir`), and `.github/` is inside this role's paths, but it is not a surface this
requirement names, the sweep is another ticket's guard, and *"a defect found while reading is
reported, never fixed in passing"* (charter §2) is the rule I have already spent this round's one
exception against. Reporting it as skipped rather than green is the discipline
*"Q-0035 accepted: a check that skips its subject must not report success"* (2026-08-25) requires.

The tripwire half of AC-15(d) — `packages/core/src/git-identity.test.ts` — **is** green, inside the
forced suite, and this change adds no git invocation of any kind.

**3. Items 2, 3 and 4 of run 1's report stand unchanged**: `harness/port-charter.md` §3's prose
contradicting its own machine-readable block; the stale line-number citations in
`spike/test/q0034-probe-schema.js`'s header and `packages/shared/src/step-output.ts`; and
`q0050.source.test.ts`'s transcription corpus not being widened to this ticket's body (ruled *no* by
the requirement, registered for whichever ticket next touches that scan).

---

## Gate obligations, unchanged by this round

**GO-1 — open the successor to Q-0051's OQ-1.** Its body is written out in full in
`requirements/merged.md`. Nothing in this round touches `buildPrompt`'s placeholder, which ports
byte-identically.

**GO-2 — spend the `signalWindow` invitation or record it as spent.** R-7 declines it and names the
four sites. Not a blocker either way.

**And a third, created by this round:** rule on item 1 above — either open the two-tree ticket that
brings `spike/src/engine.js:702–707` into line with AC-4(a), or reverse this round with the erratum
that should have authorised run 2's preservation. Leaving it unruled leaves the two trees quietly
disagreeing, which is the one outcome charter §2 is written to prevent.
