# Q-0124 — implement, run 2 iteration 2

**Verdict: `proceed`.** A revision round against run 2 iteration 1's three majors. **All three were
real**, all three are addressed, and every new clause was shown red by mutation before being trusted
green. `pnpm turbo run test lint typecheck --force --continue` is **21/21 tasks, 0 cached, 2,757
passed | 2 skipped**; `quorum lint` 6/6; the git-identity sweep exit 0; `pnpm install
--frozen-lockfile` clean.

**Only two files changed, both tests**: `packages/cli/src/build.test.ts` and
`packages/cli/src/open.test.ts`. **No production source moved** — `open.ts` is byte-identical to
`57ca37f`, verified with `git diff` after the mutations were reverted.

---

## 1. Major 1 — `open.test.ts:403`, AC-6(b) had no execution coverage

**The finding is right and it is the one that mattered.** AC-6(b) asks for the refusal to be asserted
*"by running `quorum open` against an installation whose `@quorum/web/dist` has been removed and
checking the named directory is inside that installation and **not** `node_modules/apps/web`"*. What
stood there instead was `runOpen(bundle, …)`, which reaches the handler through
`openOn({ bundle: pathToFileURL(root) })` with a fixture root injected — so `BUNDLE` is never
evaluated, `import.meta.resolve` is never called, and **the locator this whole ticket is about could
be reverted with that test green**.

### What I added

**The packed half** (`build.test.ts`, inside AC-19(b)'s fixture, after `quorum init` scaffolds a
project and before the serving block). It saves `node_modules/@quorum/web/dist`, renames it away,
runs the installed shim, and asserts four things:

- the command refuses (non-zero);
- the refusal names `<realpath(project)>/node_modules/@quorum/web/dist` — *inside this installation*;
- the refusal does **not** contain `node_modules/apps/web` — the counterfactual;
- it stopped at the bundle rather than upstream (no project imperative in the message).

Then it restores in a `finally` and **asserts the restore**, in the shape AC-10(d) uses one block up,
because every assertion after it meets whichever installation that paragraph leaves behind.

**Why in `build.test.ts` and not where the finding was raised.** `open.test.ts`'s own header rules
that *"nothing here spawns anything"* and routes emit-level claims to `build.test.ts` under Q-0098
AC-15(c). More importantly the claim is not portable: **only a packed install discriminates**. From
`packages/cli/dist/`, the module-relative locator answered `<workspace>/apps/web/dist`, which is
*correct* in the workspace; it is `node_modules/apps/web/dist` only outside it.

**The workspace half** is a new test beside the AC-7 workspace spawn: a plain `node` process rooted
at `packages/cli/dist` resolves `@quorum/web/bundle` and must answer inside
`<workspace>/apps/web/dist/`, ending at the entry document. This is what makes *"one expression
answers both installations"* a claim rather than a coincidence — the packed assertion alone is
satisfied by a locator that had simply stopped working here. Run through plain `node` rather than
Vitest because the suites resolve through `quorum-source` and a packed install through `default`
(R-6).

**And `open.test.ts`'s AC-4 block now says what it does not establish**, so it cannot be read as
AC-6(b) coverage again. It is kept rather than deleted: it is still the place the refusal's *wording*
is checked, over a root that file controls.

### Shown red

| mutation | result |
| --- | --- |
| `BUNDLE` back to `new URL('../../../apps/web/dist/', import.meta.url)` | **red** — *"the refusal does not name the bundle directory inside this installation"* |
| the same, with the clause above it relaxed | **red** — *"the refusal names the path a module-relative locator produces … expected not to contain `node_modules/apps/web`"* |

Both clauses fire **independently**, and the second confirms the counterfactual is the literal string
AC-6(b) names rather than an inference.

---

## 2. Major 2 — `build.test.ts:2277`, the shutdown was never asserted

**Right, and the mechanism is exactly as reported.** `stop()` returned `Promise<void>`; its
thirty-second timer sends `SIGKILL` and resolves, so *the rescue against a hung daemon was
indistinguishable from a clean shutdown*. AC-10(b)'s *"stopped through the existing shutdown path and
exits cleanly"* had no subject at all.

`stop` now returns `Stopped { code, signal, forced }` and **still never asserts**, which is what lets
the one call site use it twice: once at the end of the `try`, where the result is the criterion, and
once in the `finally` as the rescue. An `expect` inside the helper would fire on the way out of
whichever assertion above failed and report the wrong thing.

Three clauses, each with its own subject:

- `forced === false` — `SIGTERM` was honoured rather than escalated to `SIGKILL`;
- `signal === null` — the process left by itself rather than being ended by the kernel, which is what
  says `close()` ran and released every live run;
- `code === SIGNAL` — through the exit path `quorum open` documents, not some other zero.

### Shown red

| mutation to `open.ts` | result |
| --- | --- |
| `untilStopped` stops listening for `SIGTERM` (default action kills the child) | **red** — *"the packed daemon was ended by a signal rather than exiting through close(): expected 'SIGTERM' to be null"* |
| `SIGTERM` handled by a no-op, so the daemon hangs | **red** in 38.8 s — *"the packed daemon ignored SIGTERM and had to be killed — it did not shut down"* |
| `process.exit(SIGNAL)` → `process.exit(0)` | **red** — *"did not exit through the signal path quorum open documents: expected +0 to be 130"* |

**The first of those three is the proof the finding was real**: under the old `stop()` a child killed
by `SIGTERM` fired `once('exit')`, the helper resolved, and the fixture passed.

---

## 3. Major 3 — `build.test.ts:2921`, AC-2(d)'s measurement was absent, and the comment was false

**Right, and stronger than reported.** The register excluded `@quorum/web` on the stated ground that
a `workspace:` range in `devDependencies` is one *"a packer does not rewrite, because npm never
installs them"*. That was an unverified claim about a tool — and **it is wrong for pnpm**. Measured on
this tree by packing `apps/web` with each packer and reading the manifest out of the tarball:

```
pnpm pack  →  devDependencies["@quorum/shared"] = "0.0.0"        (rewritten)
npm  pack  →  devDependencies["@quorum/shared"] = "workspace:*"   (literal)
```

**The same divergence as the runtime loop, in a section that loop cannot see** — `workspaceDepsOf`
reads `dependencies` and `optionalDependencies` only, which is why the sentence went unchallenged.

A new test measures it, and it is **kept outside `dependents`** as the finding requires: an edge in
that register failing to be rewritten breaks a packed install, and one here does not. One list
meaning both is how a real failure comes to read as an accepted one. `PackedManifest` gained a
`devDependencies` field whose docblock says it is read by AC-2(d) alone and deliberately not by
`declaredDeps`.

**Recorded rather than repaired**, per AC-2(d)'s own words. Why it is latent is written down so a
later reader does not "fix" it: npm does not install a dependency's dev section, so neither spelling
is resolved by AC-19(b)'s install against the dead registry — which is the whole reason `react` and
`@quorum/shared` were moved there (AC-2, and the 7.94 MB the 100 K bundle already contains).

The test also asserts the two packers **differ**, because the divergence is the finding: a future
where both agreed would satisfy each clause separately while making the sentence they support false.

### Shown red

| mutation | result |
| --- | --- |
| `@quorum/shared` moved back to `apps/web`'s `dependencies` | **red** — *"@quorum/web no longer declares its sibling in the dev section — this measurement has no subject"* |

The comment on the `dependents` register was corrected in the same change: it now says
`workspaceDepsOf` does not *read* that section and points at the separate measurement, rather than
asserting what a packer does.

---

## 4. Verification

```
pnpm install --frozen-lockfile                          clean ("Already up to date")
pnpm turbo run test lint typecheck --force --continue   21/21 tasks, 0 cached
  shared 206 · web 149 · core 1537 (+2 skipped) · server 178 · cli 685 · compiler 1 · templates 1
pnpm exec quorum lint                                   6/6
pnpm sweep:git-identity                                 exit 0, both checkout shapes
```

`packages/cli` goes **683 → 685** tests: the workspace locator test and the AC-2(d) measurement. The
AC-6(b) block is clauses inside the existing packed fixture rather than a new test.

**The packed fixture's wall-clock is 4.65 s** against its 300 s budget, so R-1 still does not arise
and **the budget does not move**.

This worktree is the bare environment row — it has neither `.harness/worktrees` nor `.quorum/runs`,
confirmed rather than assumed. The populated row on `main` after the merge is GO-5's and the gate's.

**The lockfile question E-3 settled is holding**: `pnpm-lock.yaml` is on the branch at `57ca37f`, the
frozen install is clean, and I did not touch it this round.

---

## 5. What I deliberately left alone

- **`open.test.ts`'s AC-4 fixture tests.** The review did not ask for their deletion and they are
  still the coverage for the refusal's *content*. What was wrong was that nothing distinguished them
  from AC-6(b); a note now does.
- **The workspace missing-build *refusal*.** Asserted in the packed install only, which is a bound I
  am stating rather than hiding: the counterfactual `node_modules/apps/web` is unreachable in the
  workspace by construction, and removing `apps/web/dist` mid-run would race `runBuild()` and the
  AC-2 bundle scan in the same file. The workspace half asserts where the locator answers instead.
- **The `workspace:*` divergence itself.** AC-2(d) says measure and record; non-goal 7 keeps
  resolving it with Q-0091.
- **OQ-3** — whether `resolvesOwnLocation` widens to see `import.meta.resolve`. Unchanged from
  iteration 1: registered, not answered.
- **`docs/06-development-plan.md`, `docs/decisions/**`, `pnpm-lock.yaml`.** Untouched, per Q-0094
  E-3(a), append-only, and E-3's ruling respectively.

---

## 6. For the gate

Nothing new is owed. The two items iteration 1 raised are unchanged and still the human's:

1. **`pnpm-lock.yaml`** — adopted by erratum E-3 and verified clean this round; no further action.
2. **67 ms on every command** from the static daemon import, accepted by decision 096 clause 4
   without a number. The number stands as measured in iteration 1; OQ-1's remedy if it argues the
   other way is a new entry at a gate, not an implementer's choice.
