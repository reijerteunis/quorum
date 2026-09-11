---
id: Q-0014
title: The web app has a shell, a theme, routes and a live connection
stage: draft
owner: ruud
repos: []
branch: harness/Q-0014/integration
priority: p1
created: 2026-09-11
iterations: {}
history: []
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
