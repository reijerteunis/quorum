---
id: Q-0008
title: Monorepo scaffold and CI
stage: draft
owner: ruud
repos: []
branch: harness/Q-0008/integration
priority: p1
created: 2026-08-24
iterations: {}
history: []
---
Everything Quorum runs today is plain Node ESM in `spike/`, with two dependencies and a
hand-rolled test runner, and CLAUDE.md's instruction not to extend it past M0/M1 needs is now
binding — M1 closed, so the next line of engine code belongs in a typed package that does not
exist yet. This ticket builds the shell the rest of M2 ports into: a pnpm workspace with
Turborepo, TypeScript strict and Node ≥ 22, the empty package boundaries `04-architecture.md`
already names (`core`, `shared`, `cli`, and whatever else earns its place before M3), Vitest as
the runner the spike's 30-check smoke test will become, ESLint, and a CI workflow that runs
test, lint and typecheck on every push. It is deliberately the first M2 ticket and it deliberately
carries no engine logic: Q-0009 cannot port a module into a workspace that has no build, and
Q-0010 cannot publish a `quorum` binary from a repo with no package boundaries. Belongs to M2 in
docs/06-development-plan.md.

Two questions this ticket raised are settled and are not reopened. **The id is Q-0008**, which
the development plan reserves for this work, even though Q-0004 is the lowest numerically free
id: Q-0004, Q-0005 and Q-0007 are permanently uncreated, and the plan and DECISIONS.md already
record why — Q-0004's work was done and closed as an engine finding ("Red for the right reason is
an engine property", 2026-08-22), and Q-0005's fan-out and Q-0007's targeted retry were done
inside Q-0011 and Q-0033. **Q-0008 does not go through the full SDLC.** Per the 2026-08-23
decision on harness-machinery work — the one Q-0033 paid roughly $41 in qa-red attempts to learn
— contracts and a red phase are the wrong instrument for configuration work, so this ticket runs
requirements → chore → human gates, per the chore-flow decision of 2026-08-24.

## Scope, decided — do not re-litigate it

The scope is exactly the skeleton `docs/04-architecture.md` already draws, and nothing beyond it.
Create `packages/core`, `packages/server`, `packages/cli`, `packages/compiler`, `packages/templates`,
`packages/shared` and `apps/web` as **empty** packages: a `package.json`, a `tsconfig.json`
extending the root, a placeholder `src/index.ts`, and one passing placeholder test each. No code is
ported and no feature is implemented — that is Q-0009 and Q-0010, and a scaffold that quietly
starts porting is the scope creep this ticket most needs to avoid.

- **Workspace:** pnpm workspaces plus Turborepo.
- **TypeScript:** strict everywhere, from a single root `tsconfig.base.json` that every package
  extends. Node ≥ 22, enforced through `engines` and `.nvmrc`.
- **Tests:** Vitest, run at the root through turbo. The spike's 30-check smoke test is **not**
  ported here (Q-0009), and `spike/`'s own `npm test` must keep passing untouched — the spike stays
  the working regression suite until core replaces it.
- **Lint:** ESLint flat config, one shared configuration, no per-package divergence.
- **CI:** GitHub Actions, one workflow, on push and pull request: install with pnpm and a frozen
  lockfile, then turbo lint, typecheck and test, with turbo caching enabled. One Node version.

**Non-goals.** No publish or release pipeline. No changesets or versioning. No bundler decision for
`apps/web` beyond a Vite placeholder. No Docker. No renovate or dependabot. No README rewrite.

**Shape of the requirement.** At most ten acceptance criteria, each independently checkable by
running a single command. Ten is the ceiling this repository already pays for exceeding — see the
2026-08-22 decision on ticket size, where thirty criteria hit the iteration bound at every stage.
