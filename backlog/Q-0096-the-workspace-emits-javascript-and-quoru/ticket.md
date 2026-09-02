---
id: Q-0096
title: The workspace emits JavaScript, and quorum is a runnable binary
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0096/integration
priority: p1
created: 2026-09-01
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-01T23:59:43.559Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-02T05:43:54.000Z
    cost: 10.593
---
Opened 2026-09-01 from Q-0090's requirements run, which blocked twice on it and was right both
times. **The seventh child of Q-0010, and the cut moved because a run measured something the cut
assumed.**

**The finding, verified against `main` rather than inherited.** This workspace has never emitted
JavaScript, and nothing in it is arranged to:

- there is **no `build` task** — not in `turbo.json`, not in any `packages/*/package.json`;
- `tsconfig.base.json` declares **no `paths`**, and `packages/core/package.json` declares no
  `exports`, no `main` and no `types` — so `@quorum/core` is unresolvable at **typecheck** as well as
  at runtime, and even a type-only import of it fails;
- `@quorum/shared`'s `exports` names **`./src/index.ts`** for both `types` and `default`, so a
  consumer imports TypeScript source;
- all seven packages are `"private": true`, and `npm publish` is Q-0029's in M6;
- all three turbo tasks declare `"outputs": []`.

It works today because **Vitest transpiles**. Nothing else ever runs the code.

**Why this is a ticket and not a step of Q-0090.** Q-0090's body called the `bin` entry
"scaffolding", which was wrong: a `bin` pointing at a `.ts` file does not run under Node, so making
`quorum` executable is the first time this project needs a runtime story at all — and the choice
between a build step (`tsc`, `tsup`, `esbuild`), a runtime transpiler, and Node's type stripping is
architectural, affects every package, and is not the CLI's to make alone. Node's type stripping is
already known not to close it: `import('@quorum/shared')` from `packages/core` fails
`ERR_MODULE_NOT_FOUND` because stripping does not map a `.js` specifier to a `.ts` file.

**It owes a decision entry before code, and the reason is Q-0065's.** A `build` task with real
`outputs` is a **new hashed task with an artifact-replay path**, in a workspace where all three
existing tasks declare `"outputs": []` and therefore replay nothing but a verdict. *"A cache hit
names what the task reads, not what its package contains"* (2026-08-28) and *"The test command
defeats its own cache"* (2026-08-27) are both about a replayed **verdict**; replaying an **artifact**
is a class this repository has never had, and a stale `dist/` that a downstream task then executes is
a worse failure than a stale green tick. The entry rules the emit strategy, whether `exports` moves
off `src/*.ts` (and what that does to the 142 shared and 1,280 core tests that resolve through it
today), and what `outputs` a build task declares.

**What `npx quorum` may mean is settled here too**, because Q-0090 cannot claim it: nothing is
published and `npx quorum` currently resolves against the **public registry** — a stranger's package
or nothing at all. The achievable claims are the workspace path and a `pnpm pack`ed tarball, both
automated, with an explicit assertion that no registry resolution occurred. Registry `npx` is
Q-0029's in M6 and must not be asserted before then.

**Sequencing.** Q-0090 delivers the frame as importable modules tested in process, and does not need
this. Q-0091 to Q-0094 implement commands against that frame and do not need this either. **Q-0095
does** — the mock end-to-end runs the binary — so this ticket lands before Q-0095 and may run in
parallel with the four command children.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. If a change there is genuinely required, stop and say so.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.**
4. **`packages/core` already holds the logic** — look there before porting anything.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   re-derived rather than adjusted.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**.
