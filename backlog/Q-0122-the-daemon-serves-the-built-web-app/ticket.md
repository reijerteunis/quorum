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
