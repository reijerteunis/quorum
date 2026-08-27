# Q-0065 — implementation report

*Chore implement step. Branch `harness/Q-0065/implement`. Every criterion below is from
`requirements/merged.md`, which per `developer-generalist.md:9` is the whole specification; the
ticket body's buffer section is superseded by §4 of that document and is **not** implemented here.*

---

## 0. Read this first: one of the requirement's own measurements is wrong

**§0.1 concludes that a worktree has no turbo cache and that `integrate` therefore runs cold.** The
observation behind it is right — there is no `.turbo/cache` inside a worktree — and the inference is
wrong. **Turborepo 2.10 deliberately points every git worktree at the main checkout's cache.**

Measured in this worktree today, transcribed rather than summarised:

```
[DEBUG] turborepo_shim::run: Repository Root: …/.harness/worktrees/harness__Q-0065__implement
[DEBUG] turborepo_config: Using shared worktree cache at: /Users/…/Development/quorum/.turbo/cache
[DEBUG] turborepo_lib::opts: cache_dir_result: path=/Users/…/quorum/.turbo/cache, is_shared_worktree=true
 • Remote caching disabled, using shared worktree cache
@quorum/cli:test: cache hit, replaying logs 97d99d559fa7ed54
```

That is the same `/Users/…/quorum/.turbo/cache` §0.1 counted at **756 entries** and then ruled
unreachable. Three further witnesses, of different kinds:

| # | Question | How it was asked | Answer |
| --- | --- | --- | --- |
| 1 | Does a *fresh* worktree replay? | `pnpm install --frozen-lockfile`, then the first `pnpm turbo run test` ever run here | `Tasks: 7 successful` / `Cached: 7 cached` / `Time: 19ms` — nothing executed |
| 2 | Is that turbo's own view? | `pnpm turbo run test --dry=json` | `@quorum/core` → `"cache": {"local": true, "remote": false, "status": "HIT", "source": "LOCAL", "timeSaved": 28713}` |
| 3 | Is the shared cache written from a worktree too, not only read? | ran `--force` here, then plain `pnpm turbo run test` over my **modified** tree | `7 cached`, `9ms` — my forced run's entries came back |

`turboVersion 2.10.11`, `envMode strict`.

**What this changes.** Nothing about the criteria — AC-1 is right either way, as §0.1 itself argues
(*"`--force` is correct whether the cost is zero or two minutes"*). It changes two things a reader of
AC-10 would otherwise get wrong:

1. **The hazard is not confined to human verification.** `integrate` has been running warm on every
   chore ticket in this repository. Q-0043's false green was reproducible from a worktree.
2. **The cost is not nearly free.** §0.1 expects `--force` to cost ~0; it costs **25.3–30.1 s** (§3).

One consequence worth stating because it is worse than "sometimes replays": turbo's cache key is a
per-package content hash. **A chore ticket that touches only `harness/` and `docs/` replays all seven
packages** — it never runs a line of the workspace suite — and a ticket that edits one package still
replays the other six. Q-0065 and Q-0069 are both that shape.

**So AC-10's instruction to record *"§0.1's finding that the hazard is presently confined to human
verification and to any future shared-cache arrangement"* should not be transcribed as written.** The
draft entry in §5 gives the corrected sentence.

I have not edited `merged.md` — it is under `backlog/`, which no step may write.

---

## 1. What changed, file by file

### `harness/harness.yaml` — AC-1, AC-2

```yaml
  # `--force` because turbo replays a cached pass without executing it while `integrate` reads only
  # the exit code, and a worktree shares the main checkout's cache, so this step runs warm (Q-0065).
  test: npm test --prefix spike && pnpm turbo run test --force
```

One sentence, as AC-2 asks; it cites Q-0065 and transcribes nothing. The `npm test --prefix spike`
half is untouched — `node test/run.js` caches nothing. The clause *"a worktree shares the main
checkout's cache"* is the §0 correction, and it is what makes the flag load-bearing here rather than
merely prudent.

### `spike/templates/harness/harness.yaml` — AC-4

Five comment lines above `test:`; the default stays `npm test`. It states that `integrate` trusts the
exit result and nothing else, that Turbo, Nx, Gradle and Bazel all cache by default and can satisfy
it by replaying an earlier pass, that the adopter's command must defeat their runner's cache, and why
the default is left alone. Product-agnostic: the runners are named as examples of a general hazard,
and no Quorum dogfood path appears.

**Verified the comment survives `harness init`**: `spike/bin/harness.js:404-410` uses
`YAML.parseDocument` + `setIn` + `toString` specifically so comments and formatting survive the
`base_branch` edit, and says so in its own comment. A parse/stringify round trip would have dropped
it, and AC-4 would have shipped a warning no adopter ever sees.

### `turbo.json` — AC-6

```json
    "test": {
      "outputs": [],
      "env": ["QUORUM_REAL_CLI"]
    }
```

`env`, not `passThroughEnv`, per AC-6: selecting the paid probes must move the task's cache identity,
or a cheap run and an expensive one share an entry.

### `packages/shared/src/project.test.ts` — AC-3 (+2 tests)

A `Q-0065 AC-3` block at the foot of the file, plus two header lines saying why it is there. The file
is where both shipped `harness.yaml` files are already read and where `commands.test` is already
asserted to be a string — the precedent AC-3 points at.

The check is a **pure function of the command string**, `forcesTurbo(command)`: split the shell chain
on `&&`, find the segment running `turbo run test`, require `--force` among its whitespace-separated
tokens. AC-3's *"must not depend on a local cache happening to be warm or cold"* holds by
construction — no process is spawned and no cache is consulted.

The second test **demonstrates the check has a subject** before it is trusted (the Q-0069 rule): the
command as it stood before this ticket returns `false`; the new one returns `true`; a `--force` on the
spike half returns `false`; `--force-something` returns `false`; and a command that has stopped
running turbo at all returns `false` rather than being silently reported as forcing.

### `packages/core/src/test-command.test.ts` — AC-5, AC-6, AC-7, AC-8 (new file, 9 tests)

Placed in `core` because that is where AC-5's subject lives and where the recursive corpus reader
(`coreSourceFiles()`, since Q-0064) and `repoFile` already are; at the root of `src/` beside the other
package-wide test-only files (`corpus.test.ts`, `shared-resolution.test.ts`).

- **AC-5, no engine coupling.** Sweeps every non-test source under `packages/core/src` (via the
  corpus) and every `.js` under `spike/src` (via a local recursive walk that throws on an empty
  corpus) for `\bturbo\b`, `\bnx\b`, `\bgradle\b`, `\bbazel\b` and `TURBO_FORCE` — **on code lines
  only**. A doc-comment naming Turbo is documentation; a line of code naming one is the runner
  knowledge that must stay out of the engine. A third test refuses `cache hit`, `Cached:` and
  `FULL TURBO` anywhere in either tree, which is the output-parsing shape (2) this ticket declined.
  *One needle was withdrawn during implementation:* `'cached, '` matched
  `cached_input_tokens: cached, cache_write_input_tokens` in both mock adapters — vendor token usage,
  not a runner's cache report.
- **AC-6.** `turbo.json`'s `test` task lists exactly `["QUORUM_REAL_CLI"]` under `env`, and
  `passThroughEnv` is absent.
- **AC-7, propagation.** Builds a throwaway npm workspace in a temp dir whose one package's `test`
  script prints every `QUORUM_`-prefixed variable it can see, gives it **this repository's `test` task
  definition read verbatim from `turbo.json`**, and runs the real `node_modules/.bin/turbo`. Two
  assertions in one run: `QUORUM_REAL_CLI=1` **arrives**, and an undeclared `QUORUM_NOT_DECLARED=1` is
  **stripped** — the control, without which a green tick would look identical to a turbo that passed
  everything through. A second test hands the same fixture `turbo.json`'s *previous* task definition
  (`{outputs: []}`) and shows the switch stripped, which is why the documented command reported
  `skipped`, always. About 190 ms per run; it spends no subscription round-trip and calls no vendor
  CLI, so it runs in CI. A missing turbo binary throws rather than skips, and a fixture run that
  printed no `SEEN ` line throws rather than letting a negative assertion pass over silence.
  *Why not run this repository's own suite:* that would make the check spawn the run it is running
  inside. What the fixture proves is that the declaration form, as this repo declares it, propagates
  under the real binary — AC-11 remains the end-to-end evidence.
- **AC-8.** `real-cli.probe.test.ts` is **unmodified**; this pins it — it contains
  `QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core`, contains no rival `vitest`
  spelling, and still carries `describe.skipIf(!process.env.QUORUM_REAL_CLI)`.

---

## 2. Criteria

| | Status | Where |
| --- | --- | --- |
| AC-1 `--force` on the turbo half | done | `harness/harness.yaml:39-41` |
| AC-2 one-sentence comment citing Q-0065 | done | `harness/harness.yaml:39-40` |
| AC-3 automated check, cache-independent | done, 2 tests | `packages/shared/src/project.test.ts` |
| AC-4 template cache warning, default kept | done | `spike/templates/harness/harness.yaml` |
| AC-5 no engine coupling | done, 3 tests | `packages/core/src/test-command.test.ts` |
| AC-6 `env`, not `passThroughEnv` | done, 2 tests | `turbo.json`; same test file |
| AC-7 propagation proved in CI | done, 2 tests | same test file |
| AC-8 one documented invocation | done, 2 tests; probe untouched | same test file |
| AC-9 measured cost + worktree state | §3 below | this report |
| AC-10 **[H]** DECISIONS entry | draft supplied, §5 | human commit |
| AC-11 **[G]** paid-probe evidence | not mine to take | §7 |

---

## 3. AC-9 — the measurement

Node v24.15.0, turbo 2.10.11, this worktree, `main` plus this ticket's changes, suite green
throughout. Wall clock is turbo's own `Time:` summary.

| Invocation | Result | Wall |
| --- | --- | --- |
| `pnpm turbo run test` — first ever in this worktree, straight after `pnpm install --frozen-lockfile` | 7 successful, **7 cached** | **19 ms** |
| `pnpm turbo run test` — three further samples, one after my edits | 7 successful, 7 cached | **9 ms** each |
| `pnpm turbo run test --force` — three samples | 7 successful, 0 cached | **30.10 s**, 25.34 s, 25.36 s |
| `pnpm turbo run test lint typecheck --force` — final verification, twice | 21 successful, 0 cached | 25.34 s, 26.39 s |

**AC-1 costs about 25–30 seconds per `integrate`.** The first forced sample is the outlier because
Vitest's transform cache was cold as well.

**Was `integrate` already running cold?** No — see §0. The worktrees carry no `.turbo/cache` of their
own, which is what §0.1 observed, but turbo resolves a worktree's cache to the main checkout's and
says so in as many words. I could confirm this only for **this** worktree: the session's file access
is scoped to it, so I could not list the other seventeen. The mechanism is a turbo feature keyed on
"is this root a git worktree", not on anything ticket-specific, so it applies to every one of them —
and OQ-1's *"does any future arrangement give worktrees a shared cache?"* has an answer today, with no
configuration at all.

**The spike half was not measured.** `npm install --prefix spike` was not permitted in this
environment, so `npm test --prefix spike` could not run. Its runner caches nothing, so the whole of
AC-9's delta is the turbo half above. This is also why the workspace suite is my only execution
evidence; see §6.

---

## 4. What I deliberately left alone

- **The buffer half.** `spike/src/fanout.js` and `packages/core/src/fanout/command.ts` are untouched,
  per §4 and §7. Creating **Q-0070** from `merged.md` §8 is a gate action.
- **`packages/core/src/fanout/command.ts:55` is now one flag out of date.** Its JSDoc quotes this
  repository's configured command as ``(`npm test --prefix spike && pnpm turbo run test`)`` to explain
  why `runCommand` goes through a shell. AC-1 makes that quotation stale. **§7 of the requirement says
  in as many words that an implementer touching that file on this ticket is out of scope**, so I have
  not corrected it — reported instead. It is a one-word edit (`--force`) for whichever ticket opens the
  file legitimately; Q-0070 opens it next. Nothing pins the sentence, and the AC-5 sweep tolerates it
  because it is a comment.
- **CI's own cache is not covered by any criterion, and has the same shape.**
  `.github/workflows/ci.yml` restores `.turbo` across runs (`restore-keys: turbo-${{ runner.os }}-`)
  and runs `pnpm test` → `turbo run test` **without** `--force`, so a CI job can report green having
  replayed. For an unchanged package that is what a cache is for; the difference at `integrate` is that
  a gate is being told the merged tree is green. It is also how the Q-0043 flake stayed invisible. No
  criterion names `.github/`, and changing CI's caching is exactly the unrequested default a chore must
  not take — so it is reported, not decided.
- **No automated check for AC-4.** AC-3 is the only mechanism the requirement asks for, and the natural
  home for a template-text assertion is `spike/test/q0033-surface.js` — which CI does not run. Pinning
  prose there would cost more than it protects. Flagged as a deliberate omission.
- **`real-cli.probe.test.ts`**, `packages/shared/src/project.ts`, every flow file, every role file,
  `docs/**` and `backlog/**`: unmodified.
- **`--no-daemon`** was removed from the fixture's turbo invocation after turbo warned it is deprecated
  in 2.10 and removed in 3.0 (`harness/rules.md`: no deprecated API in new code).

---

## 5. AC-10 — draft entry for the human to transcribe

`developer-generalist.md:23` forbids me appending to `docs/DECISIONS.md`. Below is the entry in the
required shape, written so it can be pasted; the fourth paragraph is the part that differs from what
AC-10 anticipated, and it is the part that matters.

> ## The test command defeats its own cache, in configuration and not in the engine — 2026-08-27
>
> **Decision:** `harness/harness.yaml`'s `commands.test` ends `pnpm turbo run test --force`. The
> repository defeats its runner's cache in the file a user reads, and `core` learns nothing about any
> runner: an `integrate` step still executes the configured string as written. `turbo.json`'s `test`
> task declares `"env": ["QUORUM_REAL_CLI"]` — `env` rather than `passThroughEnv`, because selecting
> paid probes must move the task's cache identity. The shipped template keeps `npm test` and gains a
> comment telling an adopter that `integrate` trusts an exit result and that a caching runner can
> satisfy it from a replay.
>
> **Alternatives considered:** (2) Have `integrate` parse the runner's output for a cache-hit signal and
> fail closed — more general, and it puts one tool's output format inside the engine, where a vendor's
> dialect must never live. (3) Set `TURBO_FORCE=1` in the environment `integrate` runs its command with
> — leaves the configured command honest-looking while the engine still knows one specific tool's name,
> and it is invisible in the file the user reads. Both are refused by the no-coupling rule, which now
> has a test.
>
> **Why:** `integrate` makes the only claim worth making about a chore — *this suite is green on the
> merged result* — and a replay satisfies it without executing anything. That is *"skipped is not
> passed"* (2026-08-25) one layer down, and it has already cost once: a cached 7/7 stood over a suite
> whose forced re-run failed 1 of 123 (Q-0043, 2026-08-26).
>
> **Corrects the requirement that produced it.** Q-0065's merged requirement, §0.1, concluded that a
> worktree has no turbo cache and that `integrate` was therefore running cold. The observation was
> right and the inference was not: turbo 2.10 resolves a git worktree's cache to the **main
> checkout's** — `Using shared worktree cache at: …/quorum/.turbo/cache`, `is_shared_worktree=true` —
> and the first `pnpm turbo run test` ever run in a freshly created worktree reports `7 successful,
> 7 cached` in 19 ms. `integrate` has been running warm on every chore ticket in this repository. Worse
> than "sometimes replays": turbo's key is a per-package content hash, so a ticket touching only
> `harness/` and `docs/` replays **all seven** packages and executes nothing at all.
>
> **Cost accepted:** every `integrate` now spends **25–30 s** on the workspace suite it previously
> replayed in 9 ms (measured, four cached and three forced samples, 2026-08-27). That is the price of
> the claim being true. The spike half is unaffected — `node test/run.js` caches nothing.
>
> **Not decided here:** CI restores `.turbo` between runs and its `pnpm test` carries no `--force`, so a
> CI job can also report green from a replay. Outside Q-0065's scope, and named so it is not mistaken
> for having been considered and kept.
>
> **Found by:** Q-0064's requirements run (OQ-2), which correctly refused to change a default affecting
> every ticket's `integrate`; the environment half at Q-0047's gate; the shared-worktree cache by
> Q-0065's implement step, re-measuring what its own requirement had inferred.

---

## 6. Verification performed

- `pnpm turbo run test lint typecheck --force` → **21 successful, 0 cached, 647 passed, 2 skipped** (the
  two paid probes, correctly skipped without the switch). Run twice, at 25.34 s and 26.39 s.
- `pnpm turbo run test --force --filter @quorum/core` repeatedly while iterating on the fixture.
- `packages/shared` goes 97 → **99** tests; `packages/core` 640 → **649** (647 passed + the 2 skipped).
- **Not run: the spike suite.** `npm install --prefix spike` was not permitted in this environment, so
  `npm test --prefix spike` could not execute. My only spike-tree change is a **comment** in
  `templates/harness/harness.yaml`. Two things bound the risk: `spike/test/q0033-surface.js:157-160` and
  `:176` assert that both `harness.yaml` files match `/#.*base branch/i`, `/#.*(diff|byte|size)/i` and
  `/#.*install/i` — all additive-safe, since I removed no comment — and
  `packages/shared/src/project.test.ts` parses the template through `YAML.parse` and compares it key for
  key, which is green. `integrate` runs the spike suite for real.
- **Port freeze:** `spike/src/` is untouched, and Q-0065 is not one of Q-0009's fourteen children, so
  `port-freeze-guard.sh` exits 0 for this branch — as the merged requirement verified on 2026-08-27. I
  could not execute the guard here; running it needed an approval this session cannot give.

```
 M harness/harness.yaml
 M packages/shared/src/project.test.ts
 M spike/templates/harness/harness.yaml
 M turbo.json
?? packages/core/src/test-command.test.ts
```

---

## 7. For the reviewer, and for the gate

**Reviewer.** Three things that would otherwise cost a round:

1. **My `harness.yaml` comment contradicts the requirement's §0.1 on purpose.** §0 above is the
   evidence. If you read `merged.md` §0.1 first, the comment looks wrong; it is the correction.
2. **AC-1 cannot be proved by this run's own `integrate`.** `runFlow` stores `config` at run start
   (`engine.js:37,43`) and the integrate step reads `ctx.config.commands?.test` (`:1031`), never
   re-reading it from the integration worktree — so this ticket's own `integrate` executes the **old**,
   unforced command. That is why AC-3 is a file assertion, and `merged.md` §5 says so. Do not ask for
   runtime evidence of AC-1 on this run; it cannot exist.
3. **AC-5 is asserted on code lines, not on whole files**, so the pre-existing Turbo reference in
   `fanout/command.ts`'s JSDoc survives deliberately. §4 explains why that file is untouched.

**Gate — the two actions `merged.md` §7 names, plus one:**

1. **AC-11's evidence.** Run `QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core` and
   confirm `src/adapters/real-cli.probe.test.ts` reports its two probes **executed** rather than
   `skipped` (~$0.39 on claude, per M0). Neither implementer nor reviewer may spend that round-trip. The
   hermetic fixture proves turbo now passes the variable; only this proves the probe file itself reaches
   a real subscription.
2. **Create Q-0070** from `merged.md` §8 and add its line to `docs/06-development-plan.md`. Its body is
   already drafted with the measurements; `backlog/` is unwritable from a step.
3. **AC-10's entry** — §5 above, transcribed, with the correction paragraph rather than §0.1's sentence.
