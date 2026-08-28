# A green tick names what it examined, and CI's names execution — 2026-08-27

**Decision:** `.github/workflows/ci.yml`'s `workspace` job runs `lint`, `typecheck` and `test`
**forced** — `pnpm turbo run <task> --force` — and restores no turbo result cache. A developer's
local `pnpm test` stays unforced and keeps its cache; `package.json`'s three scripts,
`harness/harness.yaml` and `turbo.json` are unchanged. The line is drawn by **what the tick is
being claimed for**, never by whether caching is good: on a required check and at `integrate` the
claim is *this tree, at this commit, is green*, while a content-hash hit supports only the weaker
*a task with these inputs passed once*. At a developer's terminal no claim is being made to
anyone, and replaying an untouched package is exactly what a cache is for.

**Settles the paragraph *"The test command defeats its own cache, in configuration and not in the
engine"* (2026-08-27) left open.** That entry closed `integrate`'s replay and named CI's identical
hazard under **Not decided here** — *"a CI job can also report green from a replay"* — carrying it
to Q-0071 so it could not be mistaken for having been considered and kept. It is decided here. The
two paths remain independent by construction, which is the reason one fix could not reach the
other: `integrate` runs `harness/harness.yaml`'s `commands.test`, CI runs `package.json`'s, and
after this entry CI runs neither — see consequence 2 below.

**Two caches, and only one of them can lie.** `actions/setup-node`'s `cache: pnpm` replays a
**download** and stays. A turbo result cache replays a **verdict** and goes. Naming that difference
is most of the decision, because "we removed caching from CI" is not what happened and would be the
wrong thing to inherit.

**Why all three tasks and not `test` alone**, which is what the ticket proposed as cheapest and
what the codex requirement candidate wanted made binding. *"Type-aware linting is on for exactly
one rule"* (2026-08-27) records that `commands.test` runs neither `lint` nor `typecheck`, so
Q-0069's deprecation rule *"is enforced by CI alone"* — a cached lint tick was the only thing
standing between this repository and a silently reintroduced deprecated API. And `turbo.json`
declares no `dependsOn` while `packages/shared/package.json` exports `./src/index.ts`, so `core`
compiles `shared`'s source and a change there moves none of `core`'s three hashes. Forcing only
`test` would have left replayable precisely the two ticks whose blindness Q-0069 already paid for.
Measured cost of the other two: **2.6 s**.

**Alternatives considered.** (a) **Narrow the cache key** so `restore-keys` cannot serve another
commit's entry — the ticket's own second shape, which invited someone to *"check before building
it"*. Checked, and refuted on both counts: turbo's key is content-addressed, so narrowing removes
no incorrect hit, and an exact-SHA key can only hit on a **re-run of the same commit**, which is
the one moment a flake must not be replayed. No speed and no honesty. (b) **A second, forced,
required job beside the cached one** — doubles the workflow to preserve a cache worth tens of
seconds. Rejected on cost, not on principle. (c) **`TURBO_FORCE=1` as a job-level `env`** — a
preference rather than a rule, and worth saying so: Q-0065's stronger objection, that it would put
a runner's name inside `core`, does not transfer here because `ci.yml` is already turbo-aware. A
flag on the command line is legible at the point of use; an environment variable is legible only to
someone who goes looking. (d) **A `test:ci` script in `package.json`** — moves the force one
indirection away from the file a reader of a CI result actually opens, and gives the repository two
answers to "what does `pnpm test` do". (e) **Parsing turbo's summary as CI evidence**, so the check
fails if it cannot establish that execution was requested — struck as a log parser wearing a
criterion's clothes: it makes a required tick depend on a presentation string that turbo's own
release notes warn goes stale.

**Why: the inference was already an observation, and nobody had looked.** Q-0071's merged
requirement established the mechanism conclusively from `turbo.json`'s declarations and said
plainly, as its fifth risk, that *"nobody read a GitHub Actions log for this requirement"* — how
often CI had actually replayed was an inference. Read at the gate, from four **green** runs on
`main` dated 2026-08-26, the `turbo run test` summary is identical in each:

    Tasks:    7 successful, 7 total
    Cached:    7 cached, 7 total
      Time:    15ms >>> FULL TURBO

Runs `32948821903`, `32946589639`, `32952943001` and `32953000129`, between 15 and 19 ms. A
required check named `workspace (lint, typecheck, test)` reporting green having executed nothing,
in turbo's own words. Run `32972098840` also shows the fallback working as described — saved under
`turbo-Linux-e07f13a8…`, restored from `turbo-Linux-9fefbc9e…` — though the cross-commit fallback
is the thing to be *least* alarmed by: it widens the window a stale conclusion survives and makes a
hit routine, and it is not itself a route to a wrong answer.

**It had already hidden something, and then it hid something again while the ticket was open.**
Q-0043's containment flake survived behind a cached pass and surfaced only when a forced re-run
failed 1 of 123 on 2026-08-26 — *a flaky test behind a cache reports its last mood*. On the evening
this ticket ran, `pnpm turbo run test` reported `7 cached / 9ms / FULL TURBO` and exit 0 over a
genuinely failing suite: Q-0071's own `ticket.md` carried an 85-column title that
`backlog.test.ts`'s round-trip assertion refuses, and `--force` failed 1 of 649. That test walks
**every `ticket.md` in the repository**, which is an input turbo does not hash, so the verdict
would have replayed indefinitely. Fixed by shortening the title, the same remedy as `4fa077b`.

**Cost accepted: ≈ 29–30 s per push**, measured three times independently — twice by the
implementer across separate rounds, once at the gate in `integrate`'s own worktree — and agreeing
within a second on every task: forced `test` 26.4–26.9 s against 8–10 ms replayed, forced `lint`
1.7–2.5 s, forced `typecheck` 0.9–1.3 s, every forced run reporting `0 cached, 7 total`.
Developer-machine numbers on macOS, not ubuntu-runner numbers, so half a minute is a floor.
Against a job that already spends longer than that on checkout and
`pnpm install --frozen-lockfile` it is small, and if a runner disagrees the
fallback is one line at the documented price that the other two ticks become replayable again.

**Two consequences that are part of this decision rather than side effects.**

1. **The guard is itself unhashed.** `packages/core/src/test-command.test.ts` asserts over
   `.github/workflows/ci.yml`, which is in no package's hashed inputs. It is trustworthy today only
   because both gates that matter now execute — CI by this entry, `integrate` by Q-0065 — so a
   later ticket restoring a cached CI path would silence its own guard. The comment above the
   `workspace` job says exactly that, which is where it belongs.
2. **CI no longer runs `package.json`'s scripts.** The job invokes `pnpm turbo run <task> --force`
   directly, so `lint`, `typecheck` and `test` in `package.json` are no longer the definition of
   what CI does. They are identical today and nothing asserts they stay so. Found at the gate, not
   by any criterion, and carried by **Q-0072** rather than patched here.

**What this fixes and what it hides.** After this entry both gates execute everything, so the
under-declared task hashes underneath stop mattering *at a gate* — which means nothing will surface
them again until someone trusts a cached result. That is precisely how they survived Q-0065.
`turbo.json` declares no `inputs` and no `dependsOn`, and the demonstration is
`packages/shared/src/project.test.ts:130`: Q-0065's own guard, asserting that
`harness/harness.yaml`'s `commands.test` forces turbo, over a file that is not among that task's
hashed inputs. **Delete the flag and no hash moves.** Q-0071's requirements run drafted that
successor in full rather than describing it, and it is **Q-0072**.

**A rule about guards, general enough to outlive this ticket.** Q-0069 established that a guard
whose only evidence is a green run has not been shown to have a subject. Q-0071's review found the
next layer down. Its guard *did* carry a subject fixture — the pre-ticket workflow, verbatim — and
a cache-key check that read `startsWith('turbo-')`, which `v1-turbo-${{ github.sha }}` evades. The
fixture never caught it, because the predicate is a disjunction and that fixture also carries
`path: .turbo`: one marker tripped it and the key clause was never exercised. The predicate could
have read `startsWith('nothing-at-all')` and the demonstration would still have gone green.
**Demonstrating that a guard has a subject proves the guard fires; it does not prove that each of
its clauses does.** A second fixture now carries both evasions at once — a prefixed key *and*
turbo's `--cache-dir` pointed away from `.turbo` — and is deliberately *forced* on the
execution half so that it can only fail on the cache half. This is the ticket's own subject arriving
inside the instrument built to enforce it — a check reporting success over something it did not
actually examine.

**Note — 2026-08-28: measured on the runner, and the estimate above was right for the wrong
reason.** The paragraph on cost says these are developer-machine numbers and that *"half a minute
is a floor"*, on the stated reasoning that an ubuntu runner is slower per core. The first forced
run — `33126447905`, on `main` at 23:29Z, all four active jobs green and the freeze-SHA job
correctly skipped — reports `cache bypass, force executing` **21 times**, seven packages by three
tasks, and `0 cached, 7 total` on each:

| task | ubuntu-latest | this macOS machine |
| --- | --- | --- |
| `lint` | **13.59 s** | 1.7–2.5 s |
| `typecheck` | **8.07 s** | 0.9–1.3 s |
| `test` | **9.96 s** | 26.4–26.9 s |
| all three | **31.6 s** | ≈ 29–30 s |

The `workspace` job went from 15 s and 21 s on its last two replayed runs to **45 s**. So the total
held to within two seconds and **every component of it was wrong**, one of them inverted: `test` is
nearly three times *faster* on the runner, while `lint` and `typecheck` are five to nine times
slower. Half a minute was not a floor; it was a coincidence between two errors. No cause is
asserted here beyond the measurement — a cold runner has no warm file cache and no previously built
TypeScript program, and a 31-file vitest suite is cheaper on Linux than on macOS, but neither was
tested.

Nothing this entry decides changes: the decision is about what a tick claims, and the cost was
accepted at a figure the runner has now confirmed. What changes is the confidence anyone should
place in the *reasoning*, and it earns its place in the file for the same reason
*"verify inherited measurements"* keeps recurring here — the estimate was mine and the implementer's
independently, agreed to within a second across three samples, and still described the wrong
machine. **An aggregate that matches is not evidence that its parts do.** Which is, one level up,
the same shape as the guard rule two paragraphs above.

**Found by:** Q-0065's implement step, which reported the hazard and correctly refused to change CI
on a ticket naming no `.github/` surface. The requirement was `ready` on its first pass with zero
findings, and corrected five things in the ticket body it was written from. The chore run took three
implement passes to two `revise` verdicts and an `approve`; the second finding, and round 3's
diagnosis of why it survived, are the paragraph above. Verified at the gate in `integrate`'s own
worktree rather than from its tick: forced `test` reporting `0 cached` twice at the same commit,
and `npm test --prefix spike` 12/12, which closed the one criterion the implementer had twice
reported as unverified rather than claiming — *an unrun check is not a passed one*.
