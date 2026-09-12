---
id: Q-0122
title: The daemon serves the built web app
stage: draft
owner: ruud
repos: []
branch: harness/Q-0122/integration
priority: p2
created: 2026-09-11
iterations: {}
history: []
---
Successor C of Q-0014, from Appendix C. A build script and task for apps/web, a static route on the daemon, and the glossary ruling Q-0014 deferred: whether a served bundle is an emitted artifact or a third kind beside the artifact and the binary.

Opened **2026-09-11 at Q-0014's requirements gate**, transcribed **in full** from that ticket's
merged requirement rather than referenced — three obligations found in one week (Q-0110, Q-0111,
Q-0112) had lived only inside a closed ticket's prose or a source comment.

**Allocated at the allocator's next id**, not a planned one: M3's `Q-0015`–`Q-0019` are the screens.

## Transcribed from Q-0014, Appendix C

**Problem.** `04-architecture.md:149–151` says the server *"will serve `apps/web`'s build output"*, and
today `apps/web` has no build task and `packages/server` serves no file. M3's done-when includes
`quorum open` starting the daemon and a browser, which needs both.

**What it owes.** A `build` script and task for `apps/web`; a static route on the daemon; and **the
glossary ruling Q-0014 deferred** — whether a served bundle is an **emitted artifact**, or a third kind
beside the artifact and the binary. The glossary as written says the emitted files are *"JavaScript and
declaration files"* and that the three emitting packages *"are also the local distribution set"*; a
bundle has neither property, so one of those sentences moves whichever way it is ruled.

**Who may write which half, read off the role file rather than inferred (§1.6).** *Amending*
`docs/GLOSSARY.md` is within `developer-generalist`'s `paths:` and may be a criterion. *Coining* a new
term moves `CLAUDE.md`'s list, which is not in those paths at all and which Q-0103 erratum E-2 makes
the human's. The **decision entry is the human's either way**, that role's own instructions naming
`docs/decisions/` as the first example of `blocked`. So the entry and any coined term are gate
obligations and **may not be criteria** — *"A requirement may not name a surface its flow cannot
write"* (2026-08-25), which this repository has paid for four times.

**What moves, measured.** `test-discovery.test.ts:271`'s emitting register becomes four entries led by
`apps/web`, `PACKAGES` being sorted; **the stub clause below it asserts `scripts.build` is `undefined`
for every non-emitting package and goes red too** — iteration 1 named only the first;
`04-architecture.md:149–151`'s *"that app has no build task and emits nothing today"* becomes false;
and `docs.test.ts` holds four clauses of the glossary term. **Nothing else:** `.gitignore` already
carries `dist/`, `packages/core/turbo.json` already declares `../../apps/*/package.json`,
`vitest.shared.js`'s `exclude` already carries `**/dist/**` so an emitted test cannot be collected, and
`build.test.ts`'s dependents register is over the three packed packages and does not move. All five
checked rather than assumed.

**Read first.** *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02): its
argument is that a non-empty `outputs` replays an **artifact** where the other three tasks replay a
verdict, and a bundle inherits that hazard the moment something executes it.

## Re-measured against the tree, 2026-09-12, before the run

The body above was transcribed at **Q-0014's** requirements gate on 2026-09-11. **Q-0120 and Q-0121
both shipped on 2026-09-12**, between that gate and this run. Every claim was re-run rather than
relayed; seven hold, one line reference drifted, and **two findings change the shape of the work**.

**(a) The "Nothing else moves" list is incomplete, and the missing half is the larger one.**
`build.test.ts`'s `DISTRIBUTION` register *is* a hand-written `['cli', 'core', 'shared']`
(`build.test.ts:1604`) over the three **packed** packages, and it does not move — the body is right
about that. But **`emitting()` is derived, not hand-written**: `packages/cli/test/workspace.ts:107`
is `dry('build').tasks.filter((task) => task.command !== NO_SCRIPT)`, so the moment `apps/web`
declares a `build` script it returns **four** tasks, and at least four sites in `build.test.ts` loop
over it —
`:144` (clears every emitting package's `dist/` before a build), `:357` (*"turbo resolves the same
definition for every emitting package"*, asserting each task's resolved `outputs` equals the root's
declared `["dist/**"]` and its `dependsOn` equals `["^build"]`), `:558` (a whole-copy census
asserting **the build wrote nothing outside every emitting package's `dist/`**) and `:568`
(`agreesWithTheDeclaration` per task). A Vite bundle is not `tsc` output, so this is where the
ticket meets the build test rather than only the discovery test, and **`:558` is the one to measure
first**: it is a census over every git-visible path the build touched.

**(b) The static route inherits Q-0120's B-1 as a production hazard, and the body names neither
half.** Q-0120 review round 1's blocker was that the dev proxy matched by prefix, so **seven of
twelve routes 404'd on a reload** while in-app navigation kept working and hid it. That was fixed
for the **dev server** by `vite.config.ts`'s `bypassNavigation`, which steps aside for a top-level
navigation — `req.headers.accept?.includes('text/html')` → `/index.html`. A static route on the
daemon has the same two problems in the **shipped** product and none of that fix: a deep link such
as `/runs/run-3` must be answered with `index.html` rather than 404, or the built app reproduces
B-1 exactly; and a mount that matches too broadly **shadows the daemon's own JSON routes**, which
**Q-0121 has just taken from three to five** — `GET /runs` and `GET /runs/:id` now sit precisely
where an SPA fallback would want to answer `index.html`. So the route's matching rule is the
ticket's central design question, and it is one the body does not ask.

**(c) No new dependency is needed, measured rather than assumed.**
`@hono/node-server` already declares `./serve-static` in its `exports` map and is already a
dependency of `packages/server` (`^1.19.11`, installed 1.19.17). So *"a new dependency needs a
one-line justification and, if it changes architecture, a DECISIONS entry"* does not fire, and the
question does not need a gate. Whether to use it or to read the file directly stays solutioning's.

**(d) One line reference drifted; the sentence is unchanged and there is now a second, better one.**
The *"will serve `apps/web`'s build output … that app has no build task and emits nothing today"*
sentence is at **`04-architecture.md:190–191`**, not `:149–151`. Q-0120 added a richer statement at
**`:233`** which already routes all three halves here by name: *"the build task, the static route
that serves its output, and the ruling on whether a served bundle is an **emitted artifact** at all
are **Q-0122's**"*. `apps/web/vite.config.ts`'s own header says the same in its first paragraph. So
three live sites point at this ticket and all three move with it.

**(e) Seven claims verified unchanged.** `apps/web` declares `lint`, `typecheck` and `test` and **no
`build`**; `packages/server` serves no file (no `serveStatic`, `sendFile` or `createReadStream` in
its production source); `.gitignore:4` is `dist/`; `packages/core/turbo.json:72–74` declares
`../../apps/*/package.json` and two siblings; `vitest.shared.js:61` is
`exclude: [...configDefaults.exclude, '**/dist/**']`; `docs/GLOSSARY.md:202` says *"The JavaScript
and declaration files"* and `:204` *"which is also the **local distribution set**"*, the two clauses
one of which must move; and `harness/roles/developer-generalist.md:3`'s `paths:` carries `docs` and
**not** `CLAUDE.md`, so §1.6's split — amending the glossary may be a criterion, coining a term and
writing the entry may not — holds as written.

**(f) Both `test-discovery.test.ts` clauses do go red, and the mechanism is confirmed.**
`PACKAGES` is `workspacePackages()`, derived from `pnpm-workspace.yaml`'s `packages/*` **and
`apps/*`**, so `apps/web` is already a member: `:271`'s
`toStrictEqual(['packages/cli', 'packages/core', 'packages/shared'])` and `:289`'s stub clause —
*"`${pkg}` declares a build script and emits nothing"* over every non-emitting package — both fail
on a fourth emitter, as the body says.
