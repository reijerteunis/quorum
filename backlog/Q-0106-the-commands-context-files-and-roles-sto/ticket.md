---
id: Q-0106
title: The commands, context files and roles stop naming the spike
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0106/integration
priority: p2
created: 2026-09-05
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-05T19:20:04.805Z
    cost: 9.99
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-05T19:56:14.064Z
    cost: 11.384
---
**Child A of the cutover, ruled at Q-0103's requirements gate 2026-09-05.** Order is
**A → B → C**, one at a time — Q-0039 is unfixed, so two concurrent runs on one ticket share a
worktree and compute the same run id. This is A. **Q-0107** is B and **Q-0103** is C, which keeps the
deletion its title describes.

**Its criteria are AC-1 to AC-7 of
`backlog/Q-0103-the-cutover-delete-the-spike-retire-its-/requirements/merged.md`**, numbered
continuously across the three children so a criterion keeps its name if the cut moves. Read them
there; they are not transcribed, because `input.backlog` resolves against **this** folder and a
transcription is the failure mode this repository keeps recording — see §12 of that document, *"what
a reader should not re-derive"*.

## Why A exists as its own child, and why it must run first

`runFlow` receives `config` as a parameter (`spike/src/engine.js:61`) and never re-reads it, and
`integrate` reads `ctx.config.commands.install/.test` (`:1306`, `:1309`). So **this child's own
`integrate` runs the OLD commands** — the ones naming `spike` — which still work, because `spike/`
is still on disk. That is the whole reason A is separable: it changes the commands without being
killed by them.

**`spike/` stays.** Nothing here deletes it, and every assertion that reads it keeps working.

## What it covers

The **configuration and context** half: `harness.yaml`'s two commands and the comment blocks claiming
two dependency sets and two suites; `harness/rules.md`'s one-suite statement; `harness/architecture.md`
ceasing to describe the spike as a live tree; the three role files; and **AC-7**, which the
requirements run measured and which is not a maybe — `developer-tooling`'s `paths:` is
`[spike/bin, spike/test, packages/core, packages/shared]`, and stripping the spike halves leaves a
proper subset of `developer-backend`'s list that **excludes `packages/cli`**, the package
`harness/architecture.md:29` says the role exists for. It gains `packages/cli`.

## Gate obligations

**GO-1 — ground rule 2 of Q-0103 is an exit condition and this child cannot satisfy it.** A is not
proven until a real `integrate` has run the **new** commands, and A's own `integrate` runs the old
ones. **The proof is Q-0107's `integrate`**, which is also why Q-0103 must not launch until that is
seen green.

**GO-2 — the harness files this child edits are read by every future run.** `harness/rules.md` and
`harness/architecture.md` are fed to steps at run time, so an error here is inherited by every
requirement written afterwards — the class Q-0098 found in `product-context.md`. `.claude/rules/` is a
**derived copy** and is not a surface a criterion may name (2026-08-27).

## Non-goals

- Deleting anything under `spike/` — C's, and not before B.
- The 25 `packages/**` dependencies — **Q-0107's**, and they are the reason B exists.

Belongs to M2. Child A of **Q-0103**; runs before **Q-0107**.
