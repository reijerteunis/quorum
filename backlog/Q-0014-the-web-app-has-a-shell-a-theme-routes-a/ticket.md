---
id: Q-0014
title: The web app has a shell, a theme and routes
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0014/integration
priority: p1
created: 2026-09-11
iterations:
  requirements.head-of-product: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-11T14:46:00.729Z
    cost: 18.173
---
M3's first UI ticket. apps/web is a six-file stub with no dependencies; it becomes the shell every screen sits in — left rail, top bar, dark ground-control theme, client-side routes, and a WebSocket client over Q-0118's wire contract. The screens themselves are Q-0015 onward.

Created **2026-09-11** at the id `docs/06-development-plan.md` has named for this work since M3 was
written, using `--id` rather than the allocator's next number, as Q-0013 was.
`plan-backlog.test.ts`'s `UNCREATED` loses its `Q-0014` row in the same change.

## What is there today, measured

**`apps/web` is a six-file stub with no dependencies.** `src/index.ts` is one line, `vite.config.ts`
is `defineConfig({})`, and the manifest declares `lint`, `typecheck` and `test` and **no `build`**.
Nothing in `turbo.json` names it.

**The stack is already chosen, so no decision entry is owed for it.** `docs/04-architecture.md:22`
and `:182` say **React + Vite, Tailwind, dark "ground control" theme** and have since 2026-08-22 —
the same standing Hono had, and Q-0118 already ruled that *executing a landed document is not
changing the architecture*. Each dependency still owes the one-line justification
`.claude/rules/engineering.md` asks for.

**The wire contract exists and is not this ticket's to invent.** Q-0118 exports `WireRefusal`,
`WireRun`, `WireMessage` and the three status tables, and `@quorum/shared`'s `eventSchema` is what a
client parses an event with. A second description of any of them here would be the copy that drifts.

## The one real decision: a build task makes this a fourth emitter

`packages/core/src/test-discovery.test.ts` asserts
`emittingPackages()` is exactly `['packages/cli', 'packages/core', 'packages/shared']`, and its own
comment says **"a fourth package that starts emitting … is a visible act"**. Membership is decided
the way pnpm decides it — a `package.json` on disk under `packages/*` or `apps/*` — so **`apps/web`
is already a member**, and giving it a `build` script turns that register red on purpose.

**Moving it is not enough, because the glossary disagrees too.** `docs/GLOSSARY.md`'s **Emitted
artifact** says the emitted files are *"the JavaScript and declaration files a build task writes
under a package's `dist/`"* and that *"the three emitting packages … are also the **local
distribution set**"*. A web bundle is neither: it is not published, not installed, and carries no
declarations — it is **served**. So the question this ticket owes is whether `apps/web`'s output is
an emitted artifact at all, or a third kind beside the artifact and the binary, and whichever answer
it takes, one sentence in the glossary moves with it.

**Decision 078 is the entry that governs and it should be read before choosing.** *"The emit serves
the binary, and no test verdict moves behind it"* (2026-09-02) ruled what a `build` task means here,
including that `outputs` being non-empty is what makes a cache hit replay an *artifact* rather than
a verdict. A bundle inherits that hazard.

## Open, and to be settled at the gate

1. **Does this ticket add the build task at all**, or does the shell ship as source that only Vite's
   dev server runs, leaving the bundle to whoever first needs the daemon to serve it? The second is
   smaller and defers the glossary question; the first is honest about `04-architecture.md`'s claim
   that the server *"will serve `apps/web`'s build output"*.
2. **What routes exist before any screen does.** The design brief names eight screens and a left
   rail; this ticket is the rail, the top bar, the theme and the routing — so the routes are
   placeholders, and what a placeholder renders is a product decision rather than a stub.
3. **What the WS client does when the socket is not there.** The daemon is loopback-only and may
   simply not be running; a browser that shows an empty mission control rather than *"nothing is
   listening"* is the reassurance-by-silence this repository has refused three times in other
   surfaces.
4. **Where the theme lives.** Tailwind is named by the document; whether the ground-control palette
   is a Tailwind theme extension, CSS variables, or both is not.

## Not in scope

The screens themselves (Q-0015 mission control, Q-0016 gate screen, Q-0017 backlog board and ticket
page, Q-0018 run history). Step chat and the editors, which are M4. `quorum open`. Authentication.
**And "override with reason"** — two documents promised it and were corrected by Q-0013 and Q-0118;
the gate answer vocabulary is exactly `advance`, `retry`, `abort`, and a route or a control that
reintroduces it would be reinstating what `gateAnswerEnvelopeSchema` refuses.

## Ruled at the requirements gate, 2026-09-11

**Cut at nineteen criteria**, the number Q-0013 was refused at. This ticket is **the shell**
(AC-1 to AC-11); **Q-0120** is the live connection (AC-12 to AC-19), numbered continuously so a
criterion keeps its name. The seam passes the test Q-0013's gate applied when it *refused* a seam:
it is additive rather than a redesign — the shell ships the routes that hold a run and the top-bar
region that holds connection status, and the child fills both.

**GO-1 discharged**: Q-0120 allocated and this ticket retitled, the title having promised *"and a
live connection"* the criteria no longer deliver.

**GO-3 discharged, and it is a hole in Q-0118's own work**: there is no `GET /runs`. Nine routes are
registered and `POST /runs` is the only one that ever tells a client a handle, so a browser that
refreshes has lost every live run — which makes `DEFAULT_RETENTION`'s late-joiner buffer, built
precisely for *"a browser reopened after a refresh"*, **unreachable**. **Q-0121**.

**A third successor the appendices carried and this body had not**: **Q-0122**, the daemon serving
the built web app — which is where the build task and **the glossary ruling this ticket deferred**
now live. Whether a served bundle is an **emitted artifact** or a third kind beside the artifact and
the binary is answered there, with the `apps/web` build task, rather than inside a shell.

**Q-0120 takes the full pipeline.** Its half has behaviour a red test can fail on where the shell has
none, and M2's closing measurement is that `solutioning`, `qa-red` and `development` have four
tickets of evidence between them, all from August. The argument was deferred at Q-0013's gate and
again at Q-0118's; it is taken here.

**One correction to the merged requirement, recorded because it is a claim about this body.** §1.10
says `plan-backlog.test.ts` *"never held a `Q-0014` row"* and that the register *"was already correct
when the folder was created"*, calling this body's sentence void and counting it as the sixth
consecutive wrong inherited measurement. **Measured: commit `b08be68` removed that row**, in the same
change that created this folder, exactly as the body said. The run read the tree *after* that commit
and inferred history from it — right that nothing is left to do, wrong about why, and the sixth-in-a-
row tally does not include this one. The operational conclusion stands: there is no criterion here.
