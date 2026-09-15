# Q-0124 — How an installation outside the workspace obtains the UI

## Problem

A cold-clone adopter can run most Quorum commands from either the workspace-local installation or a locally packed installation outside the repository. `quorum open` is the exception: the packed installation does not contain `@quorum/server` or `@quorum/web`, so the command refuses before it can start the daemon or serve the UI.

This is now a deliberate but provisional state. The emitting set contains five packages, while the local distribution set contains only `@quorum/shared`, `@quorum/core`, and `@quorum/cli`. `@quorum/cli` therefore declares `@quorum/server` as optional, and its bundle path points back into the source workspace. Neither arrangement can make `quorum open` work after the packages have been installed elsewhere.

The maintainer has ruled that the locally packed installation consists of all five emitting packages. This ticket must make `@quorum/server` and `@quorum/web` distributable without making them public-registry packages, make the CLI locate both by package name, and prove that `quorum open` works in the packed installation with the registry unavailable.

Surfaces touched: CLI, local daemon and web UI, package manifests and local packing, build and packed-install regression tests, architecture and product documentation. The harness, backlog file format, flow behavior, gate behavior, and adapter contract are not changed.

## User story

As a **cold-clone adopter**, I want the locally packed Quorum installation to include everything `quorum open` needs, so that I can start the daemon and open the web UI outside the Quorum workspace without fetching an unpublished package or reconstructing a workspace-relative path.

As a **maintainer**, I want the emitting set and local distribution set to be the same explicit five packages, so that the workspace-local and locally packed installation paths exercise the same daemon and UI artifacts and packaging failures remain covered by one derived register.

## Acceptance criteria

1. **An append-only decision precedes the behavior change.** A new decision entry is added to `docs/decisions/` and indexed at the end of `docs/DECISIONS.md` before production code is implemented. It records all of the following independently:
   - the emitting set and local distribution set are the same five packages: `@quorum/shared`, `@quorum/core`, `@quorum/cli`, `@quorum/server`, and `@quorum/web`;
   - this reverses the distribution split introduced by *“A fourth package emits, and what it emits is served rather than shipped”* (2026-09-12) and extended by *“A fifth package emits, and resolved is not a synonym for distributed”* (2026-09-12), without editing either landed entry;
   - it supersedes *“An optional edge says the daemon may be absent, and never why”* (2026-09-14), as that entry anticipated;
   - `@quorum/cli` has required package edges to both `@quorum/server` and `@quorum/web`;
   - `react` and `react-dom` are build-time dependencies of the self-contained web bundle, not packages that an adopter must install beside that bundle;
   - all five packages remain `private: true`, because local packing is distribution for the supported packed path and is not publication to a registry;
   - the web package exposes a locator for its served artifact, not a browser-importable JavaScript API.

2. **The local distribution register contains exactly five packages.** The single `DISTRIBUTION` register used by the packed-install fixture contains exactly `@quorum/shared`, `@quorum/core`, `@quorum/cli`, `@quorum/server`, and `@quorum/web`. The fixture builds and packs each member and installs all five tarballs together outside the repository. A test fails if an emitting package is absent from this register, an additional package is inserted, or either new tarball is not actually consumed by the fixture.

3. **Both new tarballs contain their runtime artifacts.** `@quorum/server` declares `files` so its tarball contains the files addressed by its runtime `exports` map. `@quorum/web` declares `files` so its tarball contains the complete served contents of `apps/web/dist`, including `index.html`, the JavaScript bundle, and the stylesheet. Package tests inspect packed contents rather than inferring them from manifests. Neither tarball contains source-only, test, or unrelated workspace files.

4. **Privacy remains independent of local distribution.** The package manifests for all five distribution packages retain `private: true`. A manifest test fails if this ticket removes privacy from `@quorum/server` or `@quorum/web`. No documentation, test name, or success message claims that any package can be obtained from a public registry or through registry-resolved `npx quorum`.

5. **The CLI has required package edges to the daemon and web bundle.** `packages/cli/package.json` lists both `@quorum/server` and `@quorum/web` under `dependencies` using the repository’s workspace version convention. `@quorum/server` is removed from `optionalDependencies`, and no equivalent optional or peer edge remains. The lockfile records the required edges and the packed manifests contain installable concrete versions rather than unresolved `workspace:*` values.

6. **The provisional dynamic-import exemption is removed.** The production CLI reaches `@quorum/server` through a normal static import. The sole clause-D permitted entry added for Q-0126 is deleted from `packages/core/src/adapters/cli-version.test.ts`; the underlying rule again permits no production `import()` or `require()` occurrence in `packages/core/src` or `packages/cli/src`. The test still fails for a newly introduced dynamic import or `require()` call.

7. **The web package exposes one explicit bundle locator.** `@quorum/web` has an `exports` entry for a documented bundle subpath, with its default target set to `./dist/index.html`. The CLI resolves that subpath with `import.meta.resolve`, derives the containing `dist` URL, and passes that URL through the existing `string | URL` server seam. The export is used only as a location contract: no production code imports or executes `index.html` as a JavaScript module, and no JavaScript API is added to `@quorum/web`.

8. **`quorum open` contains no workspace-relative bundle fallback.** The CLI no longer locates the bundle through `../../../apps/web/dist/` or another path whose meaning depends on the repository layout. It does not import `node:url`, add a CLI-local filesystem conversion, copy the bundle into `@quorum/cli`, or fall back silently when `@quorum/web` cannot be resolved. A source test fails on restoration of the old workspace-relative locator.

9. **The self-contained web bundle does not install React beside itself.** `react` and `react-dom` move from `apps/web/package.json` `dependencies` to `devDependencies`; `@quorum/shared` remains in the dependency class required by the build. The web package test is rewritten to enforce the npm meaning of these fields for a distributed, self-contained bundle. Installing the five packed tarballs with an empty cache and unavailable registry does not request separate `react` or `react-dom` packages.

10. **The bundle remains self-contained.** A test builds `@quorum/web`, inspects its emitted JavaScript, and proves that it contains no bare runtime import that would require React, React DOM, `@quorum/shared`, or another package from the adopter’s `node_modules` when the browser runs it. This check must fail when a bare runtime dependency is deliberately introduced into the emitted JavaScript fixture or build output.

11. **The packed installation succeeds with the registry unavailable.** The existing packed-install regression creates an external project, installs the five locally produced tarballs together while its configured registry refuses connections, and successfully runs the existing packed-path command checks. The test must fail if npm attempts to obtain `@quorum/server`, `@quorum/web`, React, or another required package from that registry. A failed install is a failed criterion, not a skipped runtime check.

12. **Packed `quorum open` starts the daemon and serves the UI.** The existing packed-path assertion that `quorum open` refuses is inverted. From the external packed installation, the test starts `quorum open` against a fixture project, observes the daemon listening on loopback, and requests the UI through the running daemon. The response for `/` is `200`, has the expected HTML content type, and contains the built app shell. The process is then stopped through the existing shutdown path and exits cleanly. The test uses controlled browser-launch behavior and must not open a real browser on the test machine.

13. **The packed test proves it is using packed artifacts.** Before running `quorum open`, the packed fixture makes the Quorum source workspace unavailable to the child process or otherwise demonstrates that the resolved daemon module and bundle URL are inside the external installation’s `node_modules`. The verdict must not depend on an existing workspace `dist`, a repository symlink, or another gitignored directory created by prior local use.

14. **The workspace-local path remains green.** The workspace-local `pnpm exec quorum open` regression continues to start the daemon, serve the same built app shell, and shut down cleanly. Existing CLI commands and the mock-adapter end-to-end regression remain green. Tests distinguish the workspace-local and packed paths so success in one cannot satisfy the other.

15. **Artifact and installation costs are re-measured.** Verification records, from artifacts built at the implementation commit:
   - byte size and file count for `apps/web/dist` and `packages/server/dist`;
   - packed byte size for the two new tarballs;
   - installed third-party closure size and package count added by the daemon;
   - confirmation that React and React DOM are absent from the packed installation’s runtime closure;
   - elapsed cold-cache installation time under the same local conditions used for the before/after comparison.

   The result is compared with the pre-change three-package packed fixture and Q-0014’s recorded 50 MB dependency increase. A probe that cannot complete is reported as inconclusive, not as zero cost or no regression.

16. **Build ownership remains package-local.** `@quorum/web` continues to emit only under `apps/web/dist`, `@quorum/server` continues to emit only under `packages/server/dist`, and `@quorum/cli` does not copy or track either artifact. The build census and Turbo output declarations remain green and fail if a build writes into another package or a built web artifact is committed to git.

17. **Architecture and installation documentation match the shipped paths.** In the same change:
   - `docs/04-architecture.md` describes five emitting and five locally distributed packages, the required CLI edges, and package-name resolution of the bundle;
   - `harness/product-context.md` removes the `quorum open` exception from cold-clone quality pillar 7 and states that both supported installation paths run it;
   - `docs/06-development-plan.md` records Q-0124’s delivered M3 boundary without claiming public-registry installation;
   - the glossary’s existing **emitted artifact** definition no longer says that either resolved or served artifacts are undistributed;
   - user-facing installation documentation is updated wherever it enumerates the tarballs or describes packed `quorum open` as unavailable.

   Documentation cites the new decision by title and date and leaves decisions 092, 093, and 094 unchanged.

18. **Cross-cutting product constraints remain unchanged.** Tests and review establish that this packaging change adds no subscription-secret path; does not alter adapter checks; does not write to the adopter’s working tree from a flow; does not change worktree, branch, gate, human-locked gate, cross-vendor rule, ticket, flow, harness, or `.quorum/` file behavior; introduces no hidden daemon persistence; and adds no product-specific SaaS knowledge. Where a pillar is not exercised by the packaging behavior, the implementation report marks it `n/a` with this scope reason rather than inventing new coverage.

19. **Repository verification is complete.** After installing dependencies with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. The packed-install test is included in the forced test run and cannot report success after skipping its external install, daemon start, HTTP assertion, or shutdown assertion.

## Non-goals

- Publishing any Quorum package to a public registry or enabling registry-resolved `npx quorum`; that remains Q-0029.
- Removing `private: true` from any package.
- Copying the web bundle or daemon emit into `@quorum/cli`, tracking built output in git, or introducing a sixth packaging wrapper.
- Adding a JavaScript API for `@quorum/web`; its export is only a stable locator for the served artifact.
- Changing the contents, navigation, styling, or behavior of the web UI.
- Changing daemon routes, host lifecycle, browser-launch behavior, or the `quorum open` command contract except where required to resolve the packaged daemon and bundle.
- Supporting installations where only a subset of the five local tarballs is supplied.
- Adding a fallback that downloads a missing package or bundle.
- Optimizing, externalizing, or splitting the web bundle beyond moving redundant runtime manifest dependencies.
- Changing Turbo’s test, lint, or typecheck dependency topology.
- Changing any flow, gate, adapter, ticket schema, backlog format, run-history format, or persistence behavior.
- A remote daemon, cloud sync, desktop shell, multi-user operation, plugin marketplace, visual node canvas, eval suite, or new adapter.

## Open questions

None blocking. The maintainer’s 2026-09-15 gate ruling settles the distribution shape, required daemon edge, React dependency class, and continued package privacy.

The bundle locator is specified as a dedicated `@quorum/web` export targeting `dist/index.html`. If Node or pnpm rejects that export shape during the red test, the engineer must stop and return the measured failure to the gate; they must not substitute a workspace-relative path, package-root reach-through, copied artifact, or undocumented export.

## Risks

- **Package resolution differs between workspace and packed installations.** Workspace links can hide a missing file, invalid export, or unresolved workspace version. The external five-tarball fixture with an unavailable registry is the acceptance oracle.
- **A test can accidentally use the source workspace.** Existing `dist` directories and workspace symlinks could produce a false green result. The packed test must prove the daemon and bundle resolve inside its external installation.
- **The web export could be mistaken for a module API.** Exporting a named bundle locator and testing that it is resolved but never imported limits that interpretation.
- **Manifest dependency changes can create duplicate or missing runtime closure.** Demoting React removes an 8.2 MB duplicate only if the bundle remains self-contained; emitted-code inspection and the packed runtime test cover both sides.
- **Required daemon dependencies can make installation fail before any CLI command runs.** Installing all five tarballs together with the registry unavailable directly covers the failure that caused Q-0126’s optional edge.
- **Documentation can retain the provisional three-package exception.** The decision and documentation criteria name every known durable register while repository searches and existing documentation tests remain responsible for detecting additional stale claims.
- **Cold-clone cost can grow despite small emitted artifacts.** The daemon’s runtime dependency closure, rather than its emitted byte count, is the main expected increase. The before/after installation measurement makes that cost visible against the 30-minute cold-clone objective.
