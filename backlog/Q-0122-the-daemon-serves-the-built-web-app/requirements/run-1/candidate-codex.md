# Q-0122 — The daemon serves the built web app

## Problem

The Studio cannot be opened from the shipped daemon. `apps/web` has no build script, and the daemon serves no web files. A maintainer can use the Vite development server, but that does not prove the built Studio works through the same local daemon that owns the REST and WebSocket routes.

Adding static serving also creates a routing conflict. Studio paths such as `/runs/run-3` overlap the daemon's JSON routes. A browser navigation to such a path must receive the Studio entry page, while a client requesting run data from the same path must still receive JSON. Missing static assets must not be mistaken for Studio navigations. Without an explicit matching rule, either deep-link reloads return 404 or the Studio fallback shadows daemon routes.

The web build also changes the workspace's emitting set from three packages to four. Existing build and discovery tests derive behavior from that set, while the glossary currently defines an **emitted artifact** only as JavaScript and declaration files produced by the three-package local distribution set. A human ruling is required before the glossary can describe the web output truthfully.

Surfaces touched: local daemon, Studio, workspace build configuration, tests, and project documentation.

## User story

As a **maintainer**, I want the local daemon to serve the built Studio, including direct navigation to a Studio route, so that the shipped daemon and browser UI work together without a separate development server and without changing the daemon's REST or WebSocket behavior.

As a **cold-clone adopter**, I want the documented workspace-local build to produce everything the daemon needs, and I want an explicit error when that output is unavailable, so that setup does not appear successful while opening the Studio yields an unexplained 404 or blank page.

## Acceptance criteria

1. **Studio build task.** `apps/web` declares a `build` script that performs a production Vite build. Running `pnpm turbo run build --force` from an installed workspace succeeds and writes a non-empty web build under `apps/web/dist/`.

2. **Contained build output.** A clean forced workspace build writes the web build only beneath `apps/web/dist/`, apart from Turborepo metadata already exempted by the existing whole-copy census. It removes no tracked or unignored workspace file and writes no other tracked or unignored path outside the emitting packages' `dist/` directories.

3. **Declared cache output.** Turborepo resolves the web build with the root `build` task's existing `outputs: ["dist/**"]` and `dependsOn: ["^build"]`. The web package does not introduce a package-level `outputs`, `dependsOn`, or environment override.

4. **Emitting-set discovery.** The workspace's emitting register contains exactly these four sorted directories: `apps/web`, `packages/cli`, `packages/core`, and `packages/shared`. The non-emitting-package assertion continues to require every other workspace package to omit `scripts.build`.

5. **Distribution set unchanged.** The locally packed distribution remains `@quorum/cli`, `@quorum/core`, and `@quorum/shared`. `apps/web` is not packed, installed as a fourth tarball, or added to the hand-written packed-package or dependent-package registers.

6. **Static files through the daemon.** With a successful web build present, the production daemon answers a browser request for `/` with the built `index.html` and answers requests for files named by that page, including hashed assets, with the corresponding files from `apps/web/dist/` and an appropriate content type.

7. **Studio navigation fallback.** For `GET` or `HEAD` requests whose `Accept` header includes `text/html`, the daemon returns the built `index.html` for a Studio navigation path that has no matching static file. This includes a direct navigation or reload at `/runs/run-3`. `HEAD` returns the same status and headers as `GET` without a response body.

8. **API requests retain precedence.** A request not asking for HTML continues to reach the existing daemon route even where its path overlaps a Studio route. At minimum, `GET /runs` and `GET /runs/:id` with an `Accept` value of `application/json` or `*/*` retain their existing JSON status and body contracts rather than returning `index.html`.

9. **All daemon contracts remain reachable.** Static serving does not change the behavior of `POST /runs`, `POST /runs/:id/gate`, `POST /runs/:id/stop`, `GET /project`, `GET /tickets`, `GET /flows`, `GET /history`, `GET /history/:id`, `GET /runs`, `GET /runs/:id`, or the WebSocket upgrade at `/runs/:id/events`. Method-specific requests and WebSocket upgrades are never handled by the Studio fallback.

10. **Missing assets are not navigations.** A request for a file-like path that is absent from the build output, including a missing path beneath the built asset directory, returns 404. It does not return `index.html`, even when the request accepts HTML.

11. **Static-root confinement.** URL decoding, dot segments, repeated separators, and symbolic links cannot make a static request read a file outside the configured web build directory. A refused traversal returns a non-success response and does not disclose the outside file's contents.

12. **Missing build output is explicit.** Starting the production daemon when its expected web entry file is absent refuses with an error that identifies the missing Studio build output and tells the maintainer to build the workspace. It must not start a listener that later answers an unexplained 404 for `/`. Tests that exercise the Hono app without a production listener may supply an isolated fixture build directory.

13. **Development behavior remains separate.** `apps/web` development continues to use Vite and its daemon proxy. The production static route neither starts Vite nor depends on a Vite development server.

14. **Regression coverage.** Automated tests independently cover: serving `/`; serving a hashed asset; HTML fallback for a deep Studio route; JSON behavior for both overlapping run routes; an existing non-overlapping JSON route; a POST route; the WebSocket upgrade; a missing asset; path traversal; `HEAD`; and startup with missing build output. The tests build or create their own isolated output and do not depend on a pre-existing gitignored `dist/` directory.

15. **Build regression coverage.** The existing whole-copy build census and per-emitter output-declaration checks run with `apps/web` as their fourth subject. The test must fail if the web build writes outside `apps/web/dist/`, emits nothing, or ceases to match the root task's declared output.

16. **Documentation matches shipped behavior.** `docs/04-architecture.md` is updated in the same change to remove the claims that `apps/web` has no build task, emits nothing, and is not yet served. It describes the HTML-navigation versus daemon-request matching rule and continues to enumerate every daemon REST and WebSocket route. The Q-0122 deferral in the header of `apps/web/vite.config.ts` is removed or replaced with the shipped boundary rather than retained as a live obligation.

17. **Glossary follows the human ruling.** After the blocking vocabulary decision in Open question 1 is recorded by the human, `docs/GLOSSARY.md` is amended within the role's writable surface so that **build task**, **emitted artifact**, the web output, and the three-package **local distribution set** do not contradict one another. The existing documentation tests are updated to enforce the resulting clauses and package counts. This criterion does not require the implementing role to create a decision entry, coin a term, or edit `CLAUDE.md`.

18. **Required checks.** After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. No test verdict gains a dependency on `build`; the build task may be invoked by build-specific tests, but existing `test` and `typecheck` task definitions retain empty outputs and no `^build` edge.

19. **Cross-cutting constraints.** The change introduces no subscription-authentication path, writes no persistent daemon state, changes no flow, gate, worktree, adapter, contract, or backlog file format, and adds no product-specific behavior. It does not add a network dependency to rendering the Studio.

20. **Cold-clone impact.** The supported workspace-local sequence remains `pnpm install`, `pnpm turbo run build`, then `pnpm exec quorum`. The locally packed three-tarball path remains supported. Tests, documentation, and messages do not claim that registry-resolved `npx quorum` works.

## Non-goals

- Implementing `quorum open` or browser-launch behavior.
- Building any of the M3 or M4 screens; this ticket serves the existing Studio shell and routes.
- Changing the Studio's route register or renaming daemon routes.
- Changing any REST request, REST response, refusal, status-code, WebSocket frame, or gate-answer contract.
- Adding client-side persistence, daemon persistence, cloud sync, remote access, multi-user behavior, or authentication.
- Serving the daemon on a non-loopback interface.
- Adding a desktop shell, plugin marketplace, visual flow canvas, eval suite, or new adapter.
- Publishing `apps/web`, adding it to the local distribution set, or changing the three-tarball installation fixture.
- Moving `test` or `typecheck` behind the build task.
- Adding a new static-serving dependency; `@hono/node-server` is already available to `packages/server`. The implementation may use its existing export or another dependency-free approach.
- Replacing Vite, changing the browser application's source architecture, or optimizing chunking and asset size.
- Writing the required decision entry, editing `docs/DECISIONS.md`, coining a glossary term, or editing `CLAUDE.md` from the implementing role.

## Open questions

1. **Blocker — how is the served web output classified? Owner: human at the requirements gate.** Is the reproducible content of `apps/web/dist/` an **emitted artifact**, with that term widened beyond JavaScript and declaration files and separated from the three-package local distribution set; or is it a newly named third kind beside an emitted artifact and the binary? The human must record the decision before implementation. If a new term is chosen, the human must also add it to the repository-wide term list because the implementing role cannot write that surface.

2. **Non-blocking — cache policy for static responses. Owner: solutioning.** What cache headers should the daemon send for `index.html` and hashed assets? The answer may vary by file class, but it must not change route selection or require network access. If no explicit policy is selected, normal local-server behavior with no long-lived cache is acceptable for this ticket.

## Risks

- Content negotiation is shared by two meanings of `/runs/:id`. A broad HTML fallback can shadow JSON; unconditional API precedence can reproduce the deep-link 404 fixed in the development server.
- Treating every unknown path as a Studio navigation can return a successful HTML document for a missing JavaScript or CSS asset, producing a blank page with a misleading 200 response.
- Static path handling can expose files outside the build directory if decoded traversal segments or symbolic links are not confined.
- Tests can pass accidentally against a developer's existing gitignored `apps/web/dist/`. Isolated fixtures and forced builds are required to keep the verdict a property of the commit.
- Adding `scripts.build` automatically expands every test that derives the emitting set. Updating only the discovery register would leave the whole-copy census and resolved-task checks unmeasured.
- Widening **emitted artifact** without preserving the separate local distribution set would imply that `apps/web` is packed and installed, contradicting the supported installation path.
- Serving output relative to the current working directory can work in the repository and fail from a locally packed installation or another launch directory. Solutioning must establish a location rule that is independent of the caller's working directory.
