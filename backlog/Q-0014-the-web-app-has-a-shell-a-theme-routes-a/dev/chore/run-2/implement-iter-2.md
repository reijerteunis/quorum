# Q-0014 — implement, run 2, iteration 2

*Revision round. One review finding, confirmed, and broader than it was stated. Verdict: **proceed**.
Three files changed: two one-line source edits and the lockfile. 21/21 turbo tasks forced, 0 cached.*

---

## 1. The finding, verified before it was acted on

> major: apps/web/package.json:16 `jsdom@^30.0.1` requires Node `^22.22.2 || ^24.15.0 || >=26`, while
> the workspace supports Node `>=22.13.0`.

**Confirmed against the tree, and it is worse than stated.** The engine ranges are exactly as the
reviewer read them — `pnpm-lock.yaml` records `jsdom@30.0.1` with
`engines: {node: ^22.22.2 || ^24.15.0 || >=26.0.0}`, against root `package.json`'s
`engines: {node: ">=22.13.0"}`, `packages/cli`'s identical published range, and `README.md:42`'s
documented *Node ≥ 22.13.0*.

The finding names one manifest line; the defect was **three packages**. `undici@8.10.2` and
`whatwg-url@17.1.1` are jsdom 30's own dependencies and carry `>=22.19.0` and
`^22.14.0 || >=24.0.0`. I checked whether they were pre-existing before saying so — they are not,
they arrived with jsdom 30 and leave with it.

Measured over both lockfiles, per package, with `semver.satisfies`:

| Node | HEAD (jsdom 30) | this branch (jsdom 29) |
| --- | --- | --- |
| **22.13.0** — the declared floor | **3 unsatisfied** — jsdom@30.0.1, undici@8.10.2, whatwg-url@17.1.1 | **0** |
| 22.20.0 | 1 — jsdom@30.0.1 | 0 |
| 24.0.0 | 1 — jsdom@30.0.1 | 0 |
| 24.14.0 | 1 — jsdom@30.0.1 | 0 |
| 25.0.0 | 1 — jsdom@30.0.1 | 0 |

That is the red-before-green demonstration, and it is why the reviewer was right to block: the
excluded set was not a sliver at the bottom of the range. `^24.15.0` is a caret, so **Node 25.x was
excluded too**, and this machine runs 24.15.0 — the exact boundary at which jsdom 30 starts working,
which is why nothing local ever complained.

## 2. Why jsdom 29 and not jsdom 26

The finding offered two routes and I took the first — *"select a jsdom version compatible with the
full workspace engine range"* — rather than raising the workspace minimum, which the finding itself
scopes to *"a separately authorized change"* and which would move `README.md`, root and
`packages/cli` `engines`, and the published compatibility promise. That is not this ticket's.

Two candidates, measured from the registry rather than assumed:

| version | `engines.node` | gap against `>=22.13.0` |
| --- | --- | --- |
| 26.1.0 | `>=18` | none |
| 29.x | `^20.19.0 \|\| ^22.13.0 \|\| >=24.0.0` | Node 23.x only |
| 30.x | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | 22.13–22.22.1, 23.x, 24.0–24.14, 25.x |

**jsdom 29.1.1**, because its Node 22 floor is `^22.13.0` — byte-identical to the workspace's own
`>=22.13.0` floor — and because its one remaining gap is not one it opens. The Node 23.x hole is
already held open by **`eslint@10.9.0`** (`^20.19.0 || ^22.13.0 || >=24`) and **`vitest@4.1.11`**
(`^20.0.0 || ^22.0.0 || >=24.0.0`), both root devDependencies that predate this ticket, plus sixteen
others. Going four majors back to jsdom 26 would close a hole eslint and vitest keep open anyway, so
it would buy nothing and cost three majors of divergence from the ecosystem the rest of the
workspace tracks.

At Node 23.5.0 the branch reports 18 unsatisfied packages, of which jsdom@29.1.1 is one and eslint
and vitest are two. That number is stated rather than hidden: **jsdom 29 joins a pre-existing gap
and does not widen it**, which is the whole claim.

## 3. The part the manifest edit did not fix

**Changing `apps/web/package.json` alone left the defect in place, and a green suite would have hidden
it.** This is the finding worth more than the fix.

After the edit, `pnpm install` and even `pnpm install --force` kept `jsdom@30.0.1` in the lockfile,
linked into the root `vitest` instance:

```
vitest@4.1.11(@types/node@26.3.0)(jsdom@30.0.1)(vite@8.2.2…)
      jsdom: 30.0.1
```

So I probed which jsdom the AC-2 smoke test **actually** mounts into, rather than inferring it from
the manifest. A throwaway test in `apps/web`, driven through the same
`// @vitest-environment jsdom` docblock AC-2 uses:

```
app=29.1.1   ua=Mozilla/5.0 (darwin) … jsdom/30.0.1
```

**The module resolution from `apps/web` was 29.1.1 and the DOM environment was still jsdom 30.0.1.**
Vitest constructs its jsdom environment from its own peer-linked copy, not from the package under
test. The mechanism is in the lockfile header — `settings: autoInstallPeers: true` — and vitest
declares `jsdom: '*'` as an optional peer, so pnpm resolved it to the latest published version
independently of what `apps/web` asked for.

Had I stopped at the manifest line, the suite would have been green, the diff would have looked like
the fix the reviewer asked for, and the smoke test would still have been running on jsdom 30 on
every machine. That is *"A check is not established by reading it"* (2026-08-29) arriving on a
dependency pin.

**How it was cleared, and what was then removed again.** I added a root `pnpm.overrides` entry for
`jsdom` to flush the stale peer resolution, which worked — the lockfile moved to
`vitest@4.1.11(…)(jsdom@29.1.1)` and the probe then reported `ua=… jsdom/29.1.1`. I then tested
whether the override was load-bearing by removing it and forcing a fresh resolution: **it is not**.
Once jsdom@30.0.1 was out of the lockfile, a `pnpm install --force` re-resolves vitest's peer to
29.1.1 on its own; the earlier `--force` had been held by lockfile inertia rather than by a standing
preference for the latest. So the override came back out and **root `package.json` is unmodified** —
`git status` reports it clean. A workspace-wide pin that nothing needs is a decision taken on the
next person's behalf, and it would silently cap jsdom for any future consumer.

Final state verified three ways: no `overrides` residue in the lockfile, `pnpm install
--frozen-lockfile` reports *"Lockfile is up to date"*, and the probe reports `jsdom/29.1.1`.

## 4. What changed, file by file

| file | change |
| --- | --- |
| `apps/web/package.json` | One line: `"jsdom": "^30.0.1"` → `"^29.1.1"`. Nothing else; no `build` script, no new dependency, no removal. |
| `apps/web/src/package.test.ts` | One line: AC-1's `JUSTIFICATIONS` entry for `jsdom` now carries why it is held below the latest major. See below. |
| `pnpm-lock.yaml` | 40 insertions, 40 deletions — the jsdom subtree swapping versions. |

**The justification line is not decoration and is not scope creep.** Pinning a dependency one major
below the latest is deliberately counterintuitive, and `.claude/rules/engineering.md` asks for *one
line naming the authority* exactly there. AC-1 already requires a justification per dependency and
already holds them in a map the suite checks in both directions, so the reason lives in the artifact
the criterion created for it rather than in a comment `package.json` cannot carry. It states both
ranges and the floor they are measured against, so the next person bumping jsdom meets the
constraint rather than rediscovering it.

**The lockfile churn is confined to jsdom's subtree, checked rather than asserted.** Every
`package@version` identity the diff touches:

- `jsdom` 30.0.1 → 29.1.1
- `undici` 8.10.2 → 7.29.1
- `whatwg-url@17.1.1` removed (16.0.1 was already present)
- `@asamuzakjp/css-color` 6.0.7 → 5.1.11, `@asamuzakjp/dom-selector` 8.3.2 → 7.1.1, plus
  `@asamuzakjp/generational-cache@1.0.1` and `@asamuzakjp/nwsapi@2.3.9`

`vite@8.2.2`, `vitest@4.1.11`, `@types/node@26.3.0`, `jiti@2.7.0` and `yaml@2.9.0` appear in the diff
only inside the changed peer-resolution key string; **none of their versions moved**. The lockfile
resolves 251 packages against HEAD's 250 — jsdom 29's subtree is one package larger.

## 5. Verification

Run in this implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`.

- `pnpm install --frozen-lockfile` → *"Lockfile is up to date, resolution step is skipped"*, exit 0.
  This is the check that matters for a cold clone and for CI, both of which install frozen.
- `pnpm turbo run lint typecheck test --force --continue` → **21 successful, 21 total, 0 cached.**
- `@quorum/web` **6 files / 93 tests passed** — unchanged from iteration 1, so the DOM smoke test,
  the placeholder assertions and the scans all still hold under jsdom 29.
- `@quorum/core` 61 passed / 1 skipped, `@quorum/cli` 25 / 628, `@quorum/shared` 12, `@quorum/server`
  8, `@quorum/compiler` 1, `@quorum/templates` 1.
- `pnpm turbo run build --force` → 3/3, 0 cached.
- `pnpm exec quorum lint` → **6/6 flows**.
- `pnpm sweep:git-identity` → 7/7 forced, 0 cached, *"the workspace suite executed and green with no
  resolvable git identity"*.
- `pnpm lint` → 7/7 tasks, clean apart from the **same single pre-existing warning** in
  `packages/core` iteration 1 reported (`Unused eslint-disable directive`, `no-control-regex`). Not
  mine and not touched.

**Guards that could have moved and did not**, checked rather than assumed: `apps/web/vitest.config.js`
is byte-identical and `test-discovery.test.ts` passes 36/36, so the emitting register is still the
three distribution packages and the stub clause still finds `apps/web`'s `scripts.build` undefined.
Nothing under `packages/`, `docs/` or `eslint.config.js` moved this round — `git status` is three
files.

The second environment row — forced on `main` after the merge — is `integrate`'s and the gate's, per
Q-0072's closing finding.

## 6. What I deliberately left alone

- **The workspace Node minimum.** Root `engines`, `packages/cli`'s published `engines`, `README.md:42`
  and `.nvmrc` are untouched. That was the finding's second route and it explicitly scopes it to a
  separately authorized change.
- **Root `package.json`.** The `pnpm.overrides` entry was tried, measured as not load-bearing, and
  removed. The file is unmodified.
- **`vitest`, `eslint`, `vite` and every other dependency.** Non-goal 12 forbids migrating or
  upgrading an existing dependency, and the Node 23.x gap they hold open is not this ticket's.
- **Everything iteration 1 left alone**, unchanged: the build task and the glossary ruling (non-goal
  3, Q-0122), the live connection (non-goal 2, Q-0120), `GET /runs` (non-goal 4, Q-0121), the wire
  shapes, authentication and the bind (non-goal 5), "override with reason" (non-goal 6), sub-1024px
  responsiveness (non-goal 9), `testFilesIn` (non-goal 10), `docs/06-development-plan.md` (non-goal
  11), and `turbo.json` / `vitest.shared.js` / `tsconfig.base.json` / `CLAUDE.md` /
  `docs/GLOSSARY.md` / `docs/decisions/` / CI (non-goal 12).
- **The three throwaway instruments** — the jsdom-version probe, the lockfile engine audit and the
  extracted HEAD lockfile — were deleted after use, as iteration 1's AC-4 fixture was.

## 7. Observations

*Not claims about this change — recorded so the gate rules them rather than discovering them.*

**observation: nothing stops jsdom 30 coming back, and I did not add a guard.** The pin is correct
today and is held only by a version range and a justification string. A future `pnpm update`, or
anyone bumping the range, reintroduces the defect — and it would be **invisible on any machine
running Node ≥ 24.15.0**, which is most of them, this one included. The check that would catch it is
small: read the engine ranges out of `pnpm-lock.yaml`, read the floor out of root `package.json`, and
assert every range admits the floor. I did not write it, for two reasons that are the gate's to weigh
rather than mine to decide. No criterion asks for it — AC-1's *Test:* clause bounds its instrument to
the justification list and the credential scan, and Q-0067 erratum E-1 is the standing rule that a
reviewer may find an instrument fails the job its clause gives it and may not raise the job. And it
has a measured cost the requirement deliberately engineered around: **R-7** — an `apps/web` test
reading a repository-root file earns `apps/web` its first `turbo.json` plus a `turbo-inputs.test.ts`
registration and a `READ_BASES` audit row, which is precisely why AC-11 put its two anchors in
`docs.test.ts` instead. Where such a check should live is a decision, and this ticket does not
authorise one.

**observation: the workspace's declared `>=22.13.0` is not honoured at Node 23.x, and predates this
ticket.** Eighteen packages exclude it, including `eslint@10.9.0` and `vitest@4.1.11` at the root.
Node 23 is an odd-numbered line that never went LTS, so the practical exposure is near zero, and the
honest statement is that the repository's engine range is a floor nobody has audited against its own
tree rather than a supported set. Not mine to fix — non-goal 12 — and not caused here.

**observation: R-1's `node_modules` size figure cannot be re-taken in this worktree, and I am not
going to present a contaminated one as a measurement.** Iteration 1 recorded 192 MB after the change.
My repeated `pnpm install --force` runs this round left orphaned directories in the virtual store —
`node_modules/.pnpm` holds 269 entries against the lockfile's 251, and `jsdom@30.0.1` is still on disk
unreferenced — so `du` now reports a number that measures my debugging rather than the commit. What
*is* comparable and is a property of the commit: the lockfile resolves **251 packages against HEAD's
250**, so this change moves the install by one package and R-1's figure is materially unchanged. The
clean-store timed install GO-4 asks for is still owed at the gate, unchanged from iteration 1, where
both routes to taking it were refused by the environment.

**observation: `pnpm-lock.yaml` is still outside my role's `paths:`, as iteration 1 reported.** AC-1
mandates dependencies and a dependency change cannot be expressed without it; leaving it stale breaks
CI, which installs frozen. I continue to treat it as the mechanical consequence of a `package.json`
change rather than a surface I chose, on the same eight-commit precedent iteration 1 named. Not
`blocked`, and re-stated so the gate can rule it rather than meet it twice.
