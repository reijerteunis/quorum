# Q-0069 — requirements errata

This file wins over `merged.md` **only for the clauses it names**, and only in the direction it
states. Everything else in the requirement stands as written. Each entry was measured at the
requirements gate on 2026-08-27, against the tree at `f1211b1`, before the chore run started;
the commands are recorded so any of it can be re-run rather than believed.

Written because two of the requirement's three open questions resolve to *"no change needed"*,
and one of those two proposes a remedy whose premise is false — an implementer acting on it in
good faith would make the repository worse. Per *"verify inherited measurements"*: a measured
claim is re-run before it becomes a durable record, and one figure below did not survive.

---

## E-1 — OQ-2 resolves to **no change**, and its proposed remedy must not be applied

**Supersedes:** `merged.md:244–250`, the whole of OQ-2, in particular *"if it does not
invalidate, `pnpm-lock.yaml` joins `globalDependencies`"* (:250).

**Replacement:** Turbo already tracks external dependencies per task.
`hashOfExternalDependencies` is a per-task hash input and already differs per package:

    $ npx turbo run lint --dry=json
    @quorum/shared#lint    extDeps=60fb483d1592f738     ← the only package declaring zod
    @quorum/core#lint      extDeps=302c0a2b20f806a6
    the other five         extDeps=459c029558afe716

A zod bump that deprecates a new symbol therefore changes `@quorum/shared`'s external-dependency
hash, and its `lint` task re-runs rather than replaying. **`pnpm-lock.yaml` is not added to
`globalDependencies`, and no `inputs` key is added to the `lint` task.** `turbo.json` is not
edited by this ticket at all.

**Why the requirement was wrong:** its premise — *"the task's result now depends on `node_modules`
rather than only on the package's own files"* (:246–247) — assumes Turbo hashes only a package's
own files plus `globalDependencies`. It does not; external dependencies have been a first-class
hash input since Turbo 2. The proposed remedy is also blunter than what already happens: adding
the lockfile to `globalDependencies` invalidates **every** task on **any** dependency change,
trading a replay that does not occur for a cache that never hits.

**What this erratum does not settle:** whether `turbo.json` should declare explicit `inputs` for
other reasons. Nothing here asks for that, and it is out of scope.

---

## E-2 — OQ-3 resolves to **no**

**Supersedes:** `merged.md:251–253`, OQ-3.

**Replacement:** `parserOptions.projectService` needs no `allowDefaultProject` and drops no file.
Measured by enabling `projectService: true` with `tsconfigRootDir: import.meta.dirname` and
running `npx turbo run lint --force` over all seven packages: **zero parser errors, zero
`was not found by the project service`, zero files outside a project.** All 7 packages carry a
`tsconfig.json` extending the base with no `include`, so each covers everything beneath it.

AC-5's binding constraint — *"named at the gate with the override it needs, never removed from
lint coverage"* — therefore has nothing to name. It still governs if the implementer's own run
disagrees with this one; if that happens, say so rather than adding an `ignores` entry.

**What this erratum does not settle:** it does not authorise `tsconfigRootDir` to be written any
other way. The config file sits at the repo root, so `import.meta.dirname` is the value measured
here, and a cwd-relative path would resolve differently under the per-package `eslint .`
invocations (`packages/*/package.json`). Write it as `import.meta.dirname`.

---

## E-3 — the lint-cost figure in Risks is corrected

**Supersedes:** `merged.md:276–279`, *"roughly one extra second per package across 84 TS files"*.

**Replacement:** **+0.7s wall for the entire workspace**, not per package.

| Run | Wall | User |
| --- | --- | --- |
| `npx turbo run lint --force`, config as shipped | 0.95s | 4.94s |
| `npx turbo run lint --force`, + `projectService` + `no-deprecated` | 1.66s | 11.74s |

**Why the requirement was wrong:** it reasoned from "type-aware parsing builds the program `tsc`
already builds" to a per-package cost, without measuring. Seven packages build seven programs in
parallel, so the wall-clock cost is roughly one program, not seven. The estimate is high by about
7×.

**What this erratum does not settle:** AC-9 still requires the implementer to run every gate with
`--force` and record the output. These numbers are the baseline to compare against, not a
substitute for that run.

---

## Not an erratum — supporting evidence for AC-6, recorded so it can be checked

AC-6 (`merged.md:152–158`) requires the implementer to state the rule's output over the
**unmigrated** tree. That demonstration was performed at the gate, so the implementer's version
can be checked against an independently taken number instead of believed:

    # with no-deprecated + projectService enabled, over packages/shared/src at f1211b1
    $ npx turbo run lint --force
    @quorum/shared#lint FAILED — ✖ 21 problems (21 errors, 0 warnings)
    error classes seen: 21 × @typescript-eslint/no-deprecated, and nothing else
    6 of 7 packages clean

**This does not discharge AC-6.** The implementer still produces the evidence from the change's
own head, by the route AC-6 describes; the count above is what it should come to. The config used
here was restored byte-identical afterwards (`git diff eslint.config.js` clean) and nothing
deprecated was committed.

## Not an erratum — a line AC-10 draws deliberately, stated so review does not relitigate it

Besides the 21 calls and the two `.passthrough(` prose references AC-10 names, `flow.ts` carries
three **bare-word** "passthrough" mentions at `:162`, `:340` and `:358` — *"carried untouched by
passthrough"*, *"a passthrough object"*, *"left to passthrough"*. AC-10 does not name them and
should not: it corrects references to the **method**, and leaves **concept** vocabulary alone,
which is the same line AC-12a draws for the 2026-08-25 DECISIONS entry. Leaving those three
unchanged is correct, not an omission.
