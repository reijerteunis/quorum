# Q-0071 — implementation report

*Chore flow, `implement` step, iteration 3 (revision round). Written 2026-08-27.*

One review finding from iteration 2, addressed in full. One file changed this round;
four files changed in total against `main`.

---

## The review finding, and what I did about it

> **major** — `packages/core/src/test-command.test.ts:235` The guard only recognizes cache keys
> whose value starts with `turbo-`, so a Turbo result-cache key such as `v1-turbo-${{ github.sha }}`
> would evade the assertion even though AC-4(b) explicitly requires rejecting any `turbo-` cache key.
> Check for `turbo-` anywhere in the relevant cache configuration value, and add a fixture case
> proving a prefixed Turbo cache key fails the guard.

**The finding is correct.** AC-4(b)'s words are *"no workflow step restores or saves a turbo result
cache (no `path: .turbo`, no `turbo-` cache key)"*. `startsWith('turbo-')` implements a narrower
rule than that — *a key that begins with `turbo-`* — and `v1-turbo-${{ github.sha }}` is a turbo
result cache key by any reading. Both halves of the finding are actioned: the predicate, and the
fixture.

### Why it survived two rounds, which is the part worth recording

The guard already carried a subject fixture, and the subject fixture is what hid this. `BEFORE_Q0071`
is the pre-ticket workflow verbatim, and its cache step carries **both** markers:

```yaml
path: .turbo
key: turbo-${{ runner.os }}-${{ github.sha }}
```

`restoresTaskCache` is a disjunction, so `.turbo` alone makes that fixture fail the assertion. The
key half could have been `startsWith('nothing-at-all')` and the subject test would still have gone
green. **The demonstration that a guard has a subject proves the guard fires, not that each of its
clauses does** — a single fixture tripping a disjunction leaves every other clause unexercised. That
is a smaller cousin of this ticket's own subject: a check reporting success over something it did not
actually examine.

The new fixture is built to defeat exactly that, and each of its two departures from realism is
load-bearing.

---

## What changed this round

### `packages/core/src/test-command.test.ts` — the predicate (AC-4(b))

```diff
-        .some((value) => value.includes('.turbo') || value.startsWith('turbo-'))));
+        .some((value) => value.includes('.turbo') || value.includes('turbo-'))));
```

Its JSDoc gains the reason, so the next reader does not narrow it back:

> Both markers match anywhere in the value, never only at its start: AC-4(b) refuses a `turbo-`
> cache key, and `v1-turbo-${{ github.sha }}` is one. Matching the whole `with` block rather than a
> list of cache-action key names errs toward refusing too much — an unrelated value containing
> `turbo-` would fail this loudly, which is the right direction for a guard whose subject is a check
> that reports green having examined nothing.

**One judgment inside the fix, stated because the finding could be read either way.** The reviewer
says *"the relevant cache configuration value"*, which admits two implementations: keep scanning
every `with` value and widen the match, or scope the scan to `path`/`key`/`restore-keys` and widen
it there. I kept the wide scan.

Scoping to a list of key names would buy immunity from a false positive — a hypothetical
`path: apps/turbo-web/dist` — and would pay for it by re-introducing an evasion of exactly the shape
just found: a cache action that names its inputs something other than those three would slip past.
Trading a loud, one-line-to-diagnose false positive for a silent false negative is the wrong
direction in a ticket whose entire subject is a check that reports green having examined nothing.
The wide scan is also strictly a superset of the scoped one, so it satisfies the finding as written.
Note the scan reads `step.with` only and never `uses:`, so an action *named* `turbo-cache-action`
does not false-positive; the current file's `with` values are `.nvmrc`, `pnpm`, `0`,
`${{ github.head_ref || github.ref }}`, `${{ github.head_ref || github.ref_name }}` and
`origin/main`, none of which carries either marker.

### `packages/core/src/test-command.test.ts` — the fixture (AC-4(b)'s second subject)

`PREFIXED_TURBO_CACHE`, a workflow whose only defect is its cache:

```yaml
      - uses: actions/cache@v4
        with:
          path: node_modules/.cache/turbo
          key: v1-turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            v1-turbo-${{ runner.os }}-
      - run: pnpm turbo run lint --force
      - run: pnpm turbo run typecheck --force
      - run: pnpm turbo run test --force
```

Three deliberate properties:

1. **The key is prefixed** — `v1-turbo-…` — which is the evasion the reviewer named.
2. **The path is turbo's `--cache-dir` pointed away from `.turbo`.** `node_modules/.cache/turbo`
   contains no `.turbo` substring (it is `.cache/turbo`, and the marker needs a dot immediately
   before `turbo`). Without this the `.turbo` clause would carry the assertion again and the fixture
   would prove nothing about the key clause — the same defect as `BEFORE_Q0071`, reproduced. It is
   also the realistic shape, since a workflow caching a relocated turbo directory is what you would
   actually write.
3. **All three tasks are forced**, so the fixture *passes* AC-4(a) and can only fail on (b). That
   makes it a test of the cache assertion specifically rather than a second copy of the first
   fixture.

The test asserts both directions — that the three tasks are recognised as executed, and that the
workflow is nevertheless refused:

```
test('and a prefixed key is refused too — `turbo-` is read anywhere in the value', …)
```

### Demonstrated to have a subject before it was trusted

Q-0069's rule, applied to this round's own work rather than only quoted. I reverted the predicate to
`startsWith('turbo-')` and re-ran the file:

```
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
 ❯ src/test-command.test.ts:352
   expect(restoresTaskCache(workflow(PREFIXED_TURBO_CACHE)), 'v1-turbo-… names a turbo result cache')
   - Expected: true
   + Received: false
```

**Exactly one test failed, and it is the new one.** That is the finding reproduced under laboratory
conditions and it confirms the diagnosis above from the other side: the fifteen pre-existing tests —
`BEFORE_Q0071` among them — are all green over the defective predicate, which is precisely why two
review rounds passed over it. The predicate was then restored and the file re-run: **16 passed**.

---

## Verification, criterion by criterion

Re-run this round against the current tree, not carried forward.

| | how it was verified | result |
| --- | --- | --- |
| AC-1 | `pnpm turbo run lint\|typecheck\|test --force`, separately and combined | `0 cached` on every task, every run |
| AC-2 | read the file; `git diff main -- .github/workflows/ci.yml` | cache step, its `key`, its `restore-keys` and its comment gone; `cache: pnpm` byte-identical |
| AC-3 | two forced `test` runs in succession at the same commit, `.turbo` left in place | **`0 cached, 7 total` both times** — 26.797 s then 26.419 s |
| AC-4 | `vitest run src/test-command.test.ts`; then the revert-and-re-run above | **16 passed** (was 15); the new fixture fails under the old predicate and nothing else does |
| AC-5 | read the file | comment present above `workspace:`, cites 2026-08-25 rather than transcribing it |
| AC-6 | read §Testing and the status line; sweep every numbered doc | present; the contradiction iteration 2 closed stays closed |
| AC-7 | `git diff --stat main -- package.json harness/harness.yaml`; `git grep TURBO_FORCE` | **empty**. Four `TURBO_FORCE` hits, all pre-existing: two prose lines in `docs/`, two in Q-0065's landed guard asserting its *absence*. No new hit |
| AC-8 | `git diff --stat main -- turbo.json` | **empty** |
| AC-9 | `git diff main -- .github/workflows/ci.yml` | last changed line is 37; `jobs.port-freeze-policy` begins at 43. No `if:` touched, no line of the four other jobs changed |
| AC-10 | below | re-measured, eight cells plus a combined run |
| AC-11 | `git diff --stat main -- docs/DECISIONS.md` | **empty**; naming paragraph below |
| AC-12 | `pnpm turbo run lint typecheck test --force` | **21 successful, 21 total, 0 cached.** Spike half unverifiable here — see below |

`git diff --stat main` in total — note this is two-dot, against the working tree, since the harness
has not committed this round yet:

```
 .github/workflows/ci.yml               |  22 +++--
 docs/04-architecture.md                |   3 +-
 docs/06-development-plan.md            |  34 +++++--
 packages/core/src/test-command.test.ts | 168 +++++++++++++++++++++++++++++++++
 4 files changed, 207 insertions(+), 20 deletions(-)
```

This round is the 46-line growth in `test-command.test.ts` and nothing else.

**OQ-3, confirmed as the requirement asks.** `package.json` declares `turbo ^2.10.11`; no
`TURBO_TOKEN` or `TURBO_TEAM` is set in `ci.yml` and `turbo.json` configures no remote cache, so
there is no remote cache to bypass today. `--force` is documented as overriding the cache for both
local and remote replay on this version, and every forced run above reported `0 cached` against a
demonstrably warm local cache — the replayed control in the same table reports `FULL TURBO`.

### AC-12's spike half is still unverified here, and still not by anything this ticket did

`spike/node_modules` is absent in this worktree and `npm ci --prefix spike` is refused by this
environment. 11 of 12 files fail, all with `Cannot find package 'yaml' imported from
spike/bin/harness.js`; the twelfth (`q0063-stdin-epipe.js`) needs no dependency and passes 5/5, which
is the control confirming the cause is the missing install rather than the tree. Nothing under
`spike/` is touched by this ticket — the four-file diff above is the whole change — and the port
freeze is not in play. The chore's `integrate` step performs both installs before running
`harness.yaml`'s `commands.test`, so that half is exercised there. **Reported as unverified rather
than as passing: an unrun check is not a passed one**, which is this ticket's own subject.

---

## AC-10 — cost, re-measured this round

**Re-measured rather than carried over.** AC-10's rule is *"no figure is inherited … without being
re-run"*, and iteration 2's numbers are inheritance even though they are mine. The figure is turbo's
own reported `Time:`; `cached` is its `Cached: n cached, 7 total` line. Every replayed cell was taken
from a genuinely warm cache — each was preceded by a populating run in the same command.

| task | replayed | forced | cached, forced |
| --- | --- | --- | --- |
| `lint` | 6 ms (7 of 7 cached, `FULL TURBO`) | **1.713 s** | 0 of 7 |
| `typecheck` | 8 ms (7 of 7 cached, `FULL TURBO`) | **931 ms** | 0 of 7 |
| `test` | 8 ms (7 of 7 cached, `FULL TURBO`) | **26.797 s**, and **26.419 s** on the AC-3 repeat | 0 of 7, both runs |
| all three in one invocation | — | **25.2 s** | **0 cached, 21 total** |

**Net cost of this ticket: ≈ 29.1 s per push** as three separate steps (1.713 + 0.931 + 26.419)
against ≈ 22 ms replayed. Iteration 1 gave ≈ 28.2 s and iteration 2 ≈ 28.9 s; three independent
samples now agree within a second, and nothing in the re-measurement changes the conclusion or the
risk-1 fallback.

Worth one line, because it is a real result and not a rounding artefact: the **combined** invocation
is 25.2 s — *faster* than the three separate steps summed, because turbo overlaps the three task
graphs. CI runs them as three steps anyway, so the 29.1 s figure is the one that applies; combining
them is a legal AC-1 form that would save ~4 s and cost the three-way step attribution in the Actions
UI. I did not make that change (see below).

**These remain developer-machine numbers, not ubuntu-runner numbers.** macOS (Darwin 25.3.0), Node
v24.15.0, turbo 2.10.11, inside `.harness/worktrees/harness__Q-0071__implement`, which shares the main
checkout's turbo cache as Q-0065 established — so the replayed cells are genuine hits and not a
cold-worktree artefact. An ubuntu runner is typically slower per core, so half a minute is a floor.

---

## What was left alone

Everything from iterations 1 and 2 stands unchanged, and this round added no new scope:

- **`turbo.json`** (AC-8), **`package.json`** and **`harness/harness.yaml`** (AC-7) — untouched. The
  hash-input defect is the successor's, and AC-8 exists precisely to stop an implementer fixing it in
  passing.
- **The four other CI jobs** (AC-9), including the `port-freeze-*` jobs' `if:` conditions.
- **The `workspace` job's name** — a rename can break a branch-protection rule to buy a label.
- **The README badge** — there is none, and adding one is a new surface with its own claim.
- **Combining the three `run:` steps into one turbo invocation** — measured above at ~4 s cheaper,
  and not done. It is a change no criterion asks for, and it would collapse three separately
  reportable ticks into one, which is a legibility cost against the ticket's own subject.
- **Scoping `restoresTaskCache` to cache-action key names** — considered as an alternative fix and
  rejected above.
- **`docs/DECISIONS.md:1396–1397`**, which describes the defect in the present tense inside Q-0065's
  *"Not decided here"* paragraph. `DECISIONS.md` is append-only, my role forbids writing it, AC-6's
  clause is about *numbered* docs, and the passage ends *"Carried by **Q-0071**"* — it is a correct
  record of what was true when Q-0065 was decided. Ruud's AC-11 entry supersedes it. Flagged again so
  it is not read as a missed instance.
- **The `git.test.ts` containment flake** (Q-0061, absorbed into Q-0064). Forcing makes it visible;
  it does not fix it. It did not fire in any run this round.
- **`docs/06-development-plan.md`'s Q-0071 entry** — rewritten in iteration 2 and correct as it
  stands. It still carries *"(Implemented 2026-08-27; not yet `reviewed`, and not contained in
  `main`.)"*, which **will need one more edit when the ticket lands**, to `reviewed` and
  `main:contained` as Q-0065's and Q-0035's entries carry. Named here again so it is not forgotten at
  the gate.
- **No `Q-0072` line.** The requirement drafts the hash-input successor in full and suggests that id;
  allocating an id is the human's, and the rewritten entry names the obligation without one, following
  the precedent of Q-0038's entry and the *"Carried into M2 … not yet ticketed"* paragraph.

---

## AC-11 — the decision this change implies, named for Ruud to write

Unchanged across all three rounds and repeated so the report stands alone. `git diff` over
`docs/DECISIONS.md` is empty.

> **A green tick names what it examined, and CI's names execution — 2026-08-27**
>
> **Decision.** `.github/workflows/ci.yml`'s `workspace` job runs `lint`, `typecheck` and `test`
> forced, and restores no turbo result cache. A developer's local `pnpm test` is unforced and keeps
> its cache; `package.json`'s three scripts and `harness/harness.yaml` are unchanged. The line is
> drawn by **what the tick is being claimed for**, not by whether caching is good: at `integrate`
> and on a required check, the claim is *this tree, at this commit, is green*, and a content-hash hit
> is the weaker claim *a task with these inputs passed once*. At a developer's terminal there is no
> claim being made to anyone, and replaying an untouched package is exactly what a cache is for.
>
> Two caches, and only one of them can lie. `actions/setup-node`'s `cache: pnpm` replays a
> **download** and stays. A turbo result cache replays a **verdict** and goes. Naming the difference
> is most of the decision, because "we removed caching from CI" is not what happened.
>
> **Why all three tasks and not only `test`.** Q-0069's deprecation rule is enforced by CI alone —
> `commands.test` runs neither `lint` nor `typecheck` — and turbo declares no `dependsOn`, so a
> change in `shared` leaves `core`'s lint hash untouched while `core` compiles `shared`'s source.
> Forcing only `test` would leave replayable exactly the two ticks whose blindness Q-0069 already
> paid for. Measured cost of the other two: **2.6 s**.
>
> **Alternatives considered.** Narrowing the cache key so `restore-keys` cannot serve another
> commit's entry — refuted on its own invitation to check first: turbo's key is content-addressed,
> so narrowing removes no incorrect hit, and an exact-SHA key can only hit on a re-run of the same
> SHA, which is precisely the moment a flake must not be replayed. Worst of both. A second, forced,
> required job beside the cached one — doubles the workflow to preserve a cache worth tens of
> seconds. `TURBO_FORCE=1` as a job-level `env` — a preference, not a rule: Q-0065's stronger
> objection (a runner's name inside `core`) does not transfer, since `ci.yml` is already
> turbo-aware, but a flag on the command line is legible at the point of use and an environment
> variable is legible only to someone who goes looking. A `test:ci` script — moves the force one
> indirection from the file a reader of a CI result opens, and gives the repository two answers to
> "what does `pnpm test` do".
>
> **Cost accepted: ≈ 29 s per push**, measured three times on a developer machine and expected to be
> worse on an ubuntu runner.
>
> **The thing this fixes and the thing it hides.** It has already cost once: Q-0043's containment
> flake survived behind a cached pass and surfaced only when a forced re-run failed 1 of 123 on
> 2026-08-26 — a flaky test behind a cache reports its last mood. What it *hides* is larger and is
> the successor's: `turbo.json` declares no `inputs` and no `dependsOn`, so both suites assert on
> files well outside their own package's hash. `packages/shared/src/project.test.ts:130` is the
> demonstration — it asserts that `harness/harness.yaml`'s `commands.test` forces turbo, and
> `harness.yaml` is not one of that task's hashed inputs, so **Q-0065's enforcement is invisible to
> the cache it exists to defeat.** After this ticket both gates that matter execute everything, so
> nothing will surface that again until someone trusts a cached result — which is exactly how it
> survived Q-0065. Carried by the successor drafted in Q-0071's merged requirement.

---

## Limits of the guard, restated

Both are deliberate and unchanged; repeated because they are the two places AC-4's test asserts less
than the criterion's words, and a reviewer should see them beside the diff. This round narrows the
first one's blast radius but does not remove it.

**It pins the shipped form, not the property.** `executes()` accepts `turbo run <task> … --force` in
any word order and accepts one step naming several tasks, but would reject `TURBO_FORCE: 1` as a
job-level `env` block or `--cache=local:w,remote:w` written longhand — both of which AC-1 permits. A
later ticket choosing another legal form must update this guard. That is the right direction of
error: it fails loudly on a change rather than passing quietly over one. The same reasoning now
governs the widened cache match.

**It reads structure, not text.** `restoresTaskCache()` inspects each step's `with` block, so a turbo
cache restored by a hand-rolled `run:` step would slip past it. Structural was right regardless:
AC-5's comment has to name both the cache and the flag to say what the tick claims, and a
text-matching guard would fail on the comment written to explain it.

---

No product contract changes, no behaviour changes, no new dependency, no flow, schema or `backlog/`
file touched. The work is machinery, which is the route it took.
