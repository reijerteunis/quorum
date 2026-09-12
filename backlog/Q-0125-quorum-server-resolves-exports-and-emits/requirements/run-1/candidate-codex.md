# Q-0125 — `@quorum/server` resolves, exports and emits

## Problem

The local daemon exists in `packages/server`, but other workspace packages cannot import it as `@quorum/server` because the package declares no export surface. It also has no build task, so the workspace build produces no server artifact for plain Node to load.

This blocks the CLI surface planned in Q-0126. The emitted CLI runs under plain Node, which does not select the workspace-only `quorum-source` condition used by TypeScript and Vitest. When the CLI later imports `@quorum/server`, Node must therefore resolve the package's default export to an existing JavaScript file.

This ticket touches package infrastructure used by the CLI surface. It does not add a CLI command or change the local daemon or Studio behavior.

## User story

As a **maintainer**, I want `@quorum/server` to have a buildable package export so that a workspace package can import the daemon by package name and the workspace-local build produces the JavaScript and declarations that plain Node will resolve.

## Acceptance criteria

1. **Package root export.** `packages/server/package.json` declares an `exports` entry for `.` with both of these resolution paths:
   - the `quorum-source` condition exposes `packages/server/src/index.ts` for both types and runtime resolution inside the workspace; and
   - the fallback `types` and `default` conditions expose `packages/server/dist/index.d.ts` and `packages/server/dist/index.js` respectively.

2. **Public surface remains the existing index.** Importing the root of `@quorum/server` exposes the public values and types already exported by `packages/server/src/index.ts`. This ticket does not add a subpath export or make an internal module directly importable by package subpath.

3. **Dedicated emit configuration.** `packages/server` has a build-specific TypeScript configuration that:
   - extends its existing package TypeScript configuration;
   - reads production TypeScript under `src/`;
   - excludes test files;
   - writes JavaScript to `dist/` with `src/` as the stable source root;
   - writes declaration files; and
   - does not enable incremental or composite output.

4. **Build task.** `packages/server/package.json` declares a `build` script that removes the package's previous `dist/` and then runs TypeScript with the build-specific configuration. Running the script from a checkout with no existing `packages/server/dist/` exits successfully and creates at least `dist/index.js` and `dist/index.d.ts`.

5. **No stale or test output.** Starting with a sentinel file under `packages/server/dist/`, a successful server build removes that sentinel. The resulting `dist/` contains the JavaScript and declaration counterparts of production source modules and contains no emitted test module, test declaration, source test file, or TypeScript build-information file.

6. **Plain Node resolution.** In an isolated workspace copy that begins without emitted artifacts, the workspace build completes and a plain Node process can import `@quorum/server` by name. Node resolves the package root through the default condition to `packages/server/dist/index.js`, and the resolved file exists. The proof must not add a custom Node condition or run through Vitest, a TypeScript loader, or a source execution tool.

7. **Source-based development verdicts.** TypeScript and Vitest continue to resolve `@quorum/server` through `packages/server/src/index.ts` under the existing `quorum-source` configuration. Their proofs run without first building `packages/server`, so neither verdict can be satisfied by a stale or pre-existing `dist/`.

8. **No build dependency for verdict tasks.** Root Turbo configuration keeps `test` and `typecheck` free of a `^build` dependency. No package test, lint, or typecheck script is changed to build `@quorum/server` first. This preserves *“The emit serves the binary, and no test verdict moves behind it”* (2026-09-02).

9. **Fifth emitter register.** The workspace's derived emitting-package register reports exactly these five packages, in its established deterministic order: `apps/web`, `packages/cli`, `packages/core`, `packages/server`, and `packages/shared`. The corresponding explicit identity assertion is updated from four emitters to five.

10. **Non-emitter rule remains derived.** The test that requires non-emitting packages to omit `scripts.build` continues to derive that set by subtracting the emitting packages from all workspace packages. It passes with `packages/server` removed from the non-emitting set; it is not replaced by a separately maintained list.

11. **Turbo build coverage.** `pnpm turbo run build --dry=json` reports a real `build` command for `@quorum/server`, and `pnpm turbo run build` produces its declared `dist/**` output. The root `build` task retains `dependsOn: ["^build"]` and its existing non-empty output declaration.

12. **Build regression suite follows the derived set.** Every build test that obtains its subject through `emitting()` continues to pass with five emitters, including removal-before-build, isolated-copy construction, exact output auditing, cache restoration, stale-artifact replacement, and source/input invalidation. Expectations must remain derived from Turbo's dry-run result except for the explicit five-package identity register required by AC-9.

13. **Turbo input expectations.** The Turbo input census is updated where `packages/server` changes from a non-emitter to an emitter. Any `NOT_READ` or equivalent expected-input row remains an explicit assertion about files the server build must not read; no row is deleted merely to make the census pass.

14. **Checkout-independent tests.** New or changed tests derive their verdict from tracked and unignored files, an isolated copy they create, package-local files, or values they set themselves. They do not rely on an existing `dist/`, `node_modules` created by an earlier user action inside a fixture, git identity, gitignored run state, or a custom condition supplied by the invoking account.

15. **Distribution boundary.** `@quorum/server` remains `private: true` and gains no `files`, `bin`, publishing configuration, or packed-install fixture entry. The local distribution set remains `@quorum/shared`, `@quorum/core`, and `@quorum/cli`; only the emitting set grows to five, consistent with *“A fourth package emits, and what it emits is served rather than shipped”* (2026-09-12).

16. **No consumer introduced.** No production file outside `packages/server` imports `@quorum/server` as part of this ticket. In particular, `packages/cli` gains neither a dependency on `@quorum/server` nor code that starts the daemon; that integration belongs to Q-0126.

17. **Required verification.** After installing dependencies with `pnpm install --frozen-lockfile`, all of the following complete successfully from a clean emitted-artifact state:
   1. `pnpm turbo run build`;
   2. `pnpm turbo run test --force --continue`;
   3. `pnpm lint`; and
   4. `pnpm typecheck`.

18. **Cross-cutting constraints.** The change introduces:
   - no subscription or environment-variable handling, so BYOS refusal behavior is unchanged;
   - no flow execution or filesystem-writing path, so worktree containment is unchanged;
   - no gate behavior;
   - no persistent file format or schema;
   - no adapter contract or vendor-specific behavior;
   - no product-specific reference; and
   - no additional cold-clone step beyond the already documented workspace-local build.

## Non-goals

- Implementing `quorum open` or any other CLI command.
- Adding a production dependency or import from `packages/cli` to `@quorum/server`.
- Starting the daemon, choosing its port, opening a browser, or changing daemon behavior.
- Changing HTTP routes, WebSocket behavior, run hosting, gate handling, static serving, or the contents of the server's existing public index.
- Adding subpath exports.
- Making `@quorum/server` a distribution package, adding it to a packed-install fixture, publishing it, or removing `private: true`.
- Resolving how a packed `@quorum/cli` will obtain the server or web bundle. That distribution decision belongs to Q-0124 and becomes a required integration concern in Q-0126.
- Adding `main` or top-level `types` compatibility fields in addition to the conditional `exports` map unless an accepted open-question decision requires them.
- Adding a bundler, a new dependency, or a second build system.
- Adding `^build` to `test`, `typecheck`, or `lint`.
- Changing the root Turbo cache contract beyond recognizing the fifth emitter.
- Changing any harness flow, ticket schema, adapter contract, gate, or worktree behavior.

## Open questions

1. **Does the fifth emitter require a new decision entry?** Owner: requirements gate. The implementation follows the already accepted TypeScript-emitter shape and the emitting/distribution split established on 2026-09-12, so no new architecture choice is apparent. However, the accepted decision says a later third emitted-artifact shape owes an entry; the gate must confirm that `@quorum/server` is the existing resolved shape rather than a new shape. This is a blocker only if the gate determines that an existing decision would otherwise be contradicted.

2. **Are legacy `main` and top-level `types` fields required?** Owner: requirements gate. Existing consumable workspace packages use the conditional `exports` map without those fields, and the supported Node and TypeScript paths resolve through `exports`. The proposed scope therefore omits them. If compatibility with a tool that ignores `exports` is claimed, that tool and its executable proof must be named before implementation; otherwise this remains out of scope.

## Risks

- **False confidence from Vitest.** Vitest selects `quorum-source`, so a package-name test under Vitest can pass while plain Node still has no usable artifact. AC-6 requires an independent plain Node proof after a real build.

- **A stale artifact can hide a broken build.** An existing `dist/index.js` could make resolution appear successful even if the new build task emitted nothing. The isolated-copy and clean-artifact requirements ensure the artifact is produced by the tested commit.

- **The derived build suite may expose assumptions about four emitters.** Its call sites are intentionally derived, but an assertion, comment, input row, or fixture may still encode the old count or assume every TypeScript emitter is distributed. Each failure must be classified against the five-emitter/three-distribution boundary rather than patched by weakening the census.

- **Packed CLI distribution remains incomplete once Q-0126 adds the dependency.** This ticket deliberately adds no consumer, so the existing packed CLI is not broken by this change alone. Q-0126 must not add the runtime import without resolving Q-0124's distribution decision.

- **Build configuration drift could move test verdicts behind emitted output.** Reusing the package's ordinary `tsconfig.json` for emission, narrowing that configuration, or adding `^build` to verdict tasks would violate the source-first test contract. A separate build configuration and no-build resolution proofs contain this risk.
