# Q-0124 — implement, run 2 iteration 3

**Verdict: `proceed`.** A revision round against run 2 iteration 2's single major. **It was real**,
it is addressed, and every new clause was shown red by mutation before being trusted green.
`pnpm turbo run test lint typecheck --force --continue` is **21/21 tasks, 0 cached**; `quorum lint`
6/6; the git-identity sweep exit 0 in both checkout shapes; `pnpm install --frozen-lockfile` clean.

**Two files changed**: `docs/USAGE.md` and `packages/cli/src/build.test.ts`. **No production source
moved** — `open.ts`, `main.ts` and `pnpm-lock.yaml` are byte-identical to `57ca37f`, verified with
`git diff` rather than asserted.

---

## 1. The major — `docs/USAGE.md:288`, a documented flag this turbo rejects

**The finding is right, and I confirmed it by execution before changing anything** rather than
reasoning from the report. The paragraph advising how to end up *without* a bundle named
`--filter=@quorum/cli --no-deps`:

```
$ pnpm exec turbo run build --filter=@quorum/cli --no-deps --dry=json
ERROR  unexpected argument '--no-deps' found
  tip: a similar argument exists: '--global-deps'
```

turbo 2.10.11 refuses it **before planning anything**, so the one command documented to produce the
refusal the paragraph illustrates could not run at all. The advice described nothing, and nothing
held it against the CLI it describes.

### The replacement, verified rather than proposed

`--only` is in turbo's own options list — it is what the error's usage block prints, two lines below
the `--global-deps` tip that is a red herring. Measured:

```
--filter=@quorum/cli --only   → tasks: [@quorum/cli#build]           dependencies: []
--filter=@quorum/cli          → tasks: [@quorum/cli#build, @quorum/core#build,
                                        @quorum/server#build, @quorum/shared#build,
                                        @quorum/web#build]
```

So `--only` excludes `@quorum/web#build` — the property the prose needs — and the bare filter reaches
it, which is the paragraph's *other* claim one sentence earlier. **Both halves of the paragraph are
now true and both are tested.**

The sentence reads:

> The filter that leaves you without a bundle is one that excludes it: `--filter=@quorum/cli --only`
> runs the CLI's own build and none of the builds it depends on, and the refusal above is what that
> looks like.

Rewritten rather than patched in place, because *"`--no-deps` among them"* implied a class of flags
where the supported form is one flag with one meaning, and leaving that framing would have invited
the next reader to guess a second member.

### The coverage — `packages/cli/src/build.test.ts`

The finding's second half: *"add coverage that executes or otherwise validates the documented command
so the advice cannot drift from the installed Turbo CLI."*

`Q-0124 AC-13(d) — every turbo filter USAGE.md documents is one this turbo accepts, and selects what
the prose claims`, placed beside the existing AC-2/AC-4 build-graph test, which is the other
assertion in this file about what turbo plans.

**The fragments are taken OUT of the document rather than transcribed into the test.** That is what
makes it anti-drift in both directions, which is what the finding asks for: a prose edit naming a
flag this turbo rejects fails here, *and* a turbo upgrade that retires a documented flag fails here
too. Neither direction is covered by a test that spells the flag itself.

Three clauses, each with its own subject:

1. **Every documented `--filter=` fragment is accepted** — `turbo run build <fragment> --dry=json`
   must exit 0, and the failure message carries the fragment *and* turbo's own reason. This is the
   defect class, and it is uniform: it catches `--no-deps` on any span, not just the one that had it.
2. **One documented filter reaches the bundle** — or *"builds the web app too"* has no example.
3. **One documented filter excludes it** — or the refusal the paragraph illustrates is unreachable.

**Clauses 2 and 3 are asserted by OUTCOME rather than by naming either fragment**, which is what
keeps the test from being the prose written twice. The paragraph makes two opposite claims; the test
requires both to be represented among what it measured, without knowing which span is which.

`--dry=json` plans and executes nothing, so this adds no build to the suite. The whole test runs in
**206 ms**.

### Shown red — three mutations, three distinct messages

| mutation | result |
| --- | --- |
| `--only` → `--no-deps` in the document | **red** — ``turbo rejected `--filter=@quorum/cli --no-deps`, which docs/USAGE.md documents: ERROR unexpected argument '--no-deps' found`` |
| `--only` dropped, leaving a filter turbo **accepts** but which does not exclude | **red** — *"no documented filter excludes the bundle, so the refusal USAGE.md illustrates cannot be produced"* |
| the bare `--filter=@quorum/cli` span removed from line 286 | **red** — *"no documented filter reaches the bundle, so USAGE.md's 'builds the web app too' has no example"* |

**The first mutation is the reported defect reproduced verbatim**, which is the evidence that the
finding is closed rather than worked around. **The second is the one that matters beyond this
instance**: it is a flag turbo *accepts*, so an acceptance-only check would have passed over it — the
advice has to work, not merely parse.

The third was run because I had claimed that clause in a comment, and a clause asserted but never
shown red is the defect class this repository records most.

**The runner's own discrimination is pinned too**: an invented flag must be refused, or the
acceptance clause cannot fail. It uses `--quorum-not-a-turbo-flag` rather than `--no-deps`
deliberately — what is pinned is that this runner reports a flag turbo does not know, **not turbo's
flag table at one version**, so a later turbo restoring `--no-deps` does not turn this red for a
reason that has nothing to do with the commit.

---

## 2. Verification

```
pnpm install --frozen-lockfile                          clean ("Already up to date")
pnpm turbo run test lint typecheck --force --continue   21/21 tasks, 0 cached
  shared 206 · web 149 · core 1537 (+2 skipped) · server 178 · cli 686 · compiler 1 · templates 1
pnpm exec quorum lint                                   6/6
pnpm sweep:git-identity                                 exit 0, both checkout shapes
```

`@quorum/cli` goes **685 → 686** — exactly the one new test, and the count is the check that nothing
else was added or lost.

The sweep printed its own premise line, *"environment discriminates (negative and positive probes
both as expected)"*, so it certified rather than passing vacuously.

This worktree is the **bare environment row** — it has neither `.harness/worktrees` nor
`.quorum/runs`, confirmed rather than assumed. The populated row on `main` after the merge is GO-5's
and the gate's.

### The new read is covered, and that was measured rather than assumed

`build.test.ts` now reads `docs/USAGE.md`, which `packages/cli/turbo.json` already declares — Q-0126
added it for `commands.test.ts`. Relying on a sibling reader's declaration without measuring it is
the residual Q-0121 recorded, so I measured it:

```
@quorum/cli#test   cd9150443ec6b894   (before)
                   cd9fdc0a9ea542dc   (a line appended to docs/USAGE.md)
                   cd9150443ec6b894   (restored)
```

The hash moves, so a cached pass cannot stand over an edited paragraph. **No `turbo.json` change was
needed and none was made** — declaring it a second time would be the same claim twice, free to drift.

---

## 3. What I deliberately left alone

- **Every other site.** `--no-deps` occurred **exactly once** in the repository, at the line the
  review named. `README.md`'s two `pnpm turbo run build` invocations and `harness/product-context.md`'s
  are unfiltered, so no other documented surface carried the claim. Checked rather than assumed,
  because *fixing the instance rather than the class* is what this repository records most often —
  here the instance **is** the class, and the grep is what establishes that.
- **`packages/cli/test/workspace.ts`.** My first design extended `dry()` to take extra turbo
  arguments. It was unnecessary: `turboBin`, `turboEnv` and the `attempt` helper are all already in
  scope at the insertion point, and `attempt` is the right runner here because it **reports** a
  non-zero exit instead of throwing — which is precisely what clause 1 has to read. A shared helper
  changed for one caller is the speculative abstraction this role is told not to add.
- **Production source, and the lockfile.** `open.ts`, `main.ts` and `pnpm-lock.yaml` are unchanged
  since `57ca37f`. Nothing in this finding reaches them.
- **`open.test.ts`.** Iteration 2's AC-6(b) work is not touched; this finding is about a document and
  the command it names.
- **`docs/06-development-plan.md` and `docs/decisions/**`.** Q-0094 erratum E-3(a) rules the plan's
  ticket bullets the human's, and the entries are append-only.
- **OQ-3** — whether `resolvesOwnLocation` widens to see `import.meta.resolve`. Unchanged from
  iterations 1 and 2: registered, not answered.

---

## 4. For the gate

**Nothing new is owed.** The two items iterations 1 and 2 raised are unchanged and neither is
affected by this round:

1. **`pnpm-lock.yaml`** — adopted by erratum E-3, verified clean again this round, untouched.
2. **67 ms on every command** from the static daemon import, accepted by decision 096 clause 4
   without a number. The number stands as measured in iteration 1; OQ-1's remedy if it argues the
   other way is a new entry at a gate, not an implementer's choice.
