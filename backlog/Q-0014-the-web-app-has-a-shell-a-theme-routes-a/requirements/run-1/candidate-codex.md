# Q-0014 — The web app has a shell, a theme, routes and a live connection

## Problem

The Studio has no usable application frame. `apps/web` is a six-file stub with no React entry point, navigation, theme, routes, production build or connection to the daemon. The M3 screens therefore have no shared place to render, and a maintainer cannot distinguish a quiet run from a daemon or WebSocket that is unavailable.

This ticket establishes the browser shell every later Studio screen uses. It does not implement those screens.

Surfaces touched: the Studio (`apps/web`), workspace build configuration, tests, and documentation describing build output.

## User story

As a **solo maintainer**, I want the Studio to open into a consistent dark shell, navigate to every planned M3/M4 surface, and state whether its live connection is healthy, so that I can orient myself and never mistake a connection failure for an idle run.

As a **cold-clone adopter**, I want the Studio shell to explain unavailable and unfinished surfaces plainly, so that I can tell the difference between an installation problem, a daemon that is not listening, and a screen scheduled for a later ticket.

## Acceptance criteria

1. **Application entry point.** `apps/web` mounts a React application through Vite into a real HTML document. The page loads without a runtime exception when no daemon is running.

2. **Shared shell.** Every application route renders inside the same shell, containing:
   - a persistent left rail;
   - a persistent top bar;
   - a main-content region with a programmatically associated page heading; and
   - a connection-status region that is exposed to assistive technology as a status message.

3. **Left-rail destinations.** The rail contains destinations labelled Projects, Backlog, Harness, Flows, Runs, History and Settings. Each destination is reachable by keyboard, has a visible focus state, and marks the destination matching the current URL as active.

4. **Route map.** Client-side routing recognizes these URLs without a full-page navigation:
   - `/` redirects to `/projects`;
   - `/projects` — Projects home, owned by a later screen ticket;
   - `/backlog` — backlog board, owned by Q-0017;
   - `/backlog/:ticketId` — ticket page, owned by Q-0017;
   - `/harness` — harness editor, owned by M4;
   - `/flows` — flow editor, owned by M4;
   - `/runs` — Runs landing placeholder;
   - `/runs/:handle` — mission control, owned by Q-0015;
   - `/runs/:handle/gate` — gate screen, owned by Q-0016;
   - `/runs/:handle/steps/:stepId` — step chat, owned by M4;
   - `/history` — run history, owned by Q-0018;
   - `/settings` — Settings placeholder; and
   - every unmatched URL — Not found.

5. **Placeholder contract.** Until its owning ticket replaces it, each recognized route renders its destination name, the owning ticket or milestone, and the sentence “This screen is not available yet.” A placeholder presents no fabricated project, subscription, run, ticket, gate or cost data and contains no action that appears to mutate a file or start, stop or answer a run.

6. **Dynamic route values.** Placeholders for dynamic routes display the decoded `ticketId`, run `handle` or `stepId` supplied by the URL. Malformed percent-encoding is handled by the Not found view rather than causing an uncaught exception.

7. **Unknown route.** The Not found view identifies the requested path and offers a keyboard-accessible link to Projects. It renders inside the shared shell.

8. **Top bar.** The top bar contains reserved regions for current project, git branch and subscription status, plus the label “Run flow”. Until their owning tickets provide real data and behavior, each data region reads “Not loaded” and “Run flow” is visibly disabled. The shell does not infer or fabricate any of these values.

9. **Theme ownership.** The ground-control palette is defined once as semantic CSS custom properties for background, surface, border, primary text, muted text, accent, running, waiting, passed, failed and idle. Tailwind maps utilities to those variables; components do not introduce duplicate literal palette values.

10. **Theme appearance.** The default and only theme in this ticket uses a near-black desaturated background, restrained electric-teal accent, readable light text and the documented status colors. It uses no decorative gradient or glassmorphism. UI text uses an included system sans-serif stack and code-like identifiers use an included system monospace stack; loading the shell makes no third-party font request.

11. **Responsive shell.** At viewport widths of 1024 CSS pixels and above, the rail and top bar remain visible while the main region scrolls. Below 1024 CSS pixels, the rail can collapse behind a labelled navigation control, all destinations remain reachable, and the page has no horizontal overflow at 320 CSS pixels caused by the shell.

12. **WebSocket client boundary.** `apps/web` exposes one reusable live-run client used by the `/runs/:handle` route. It constructs `/runs/:handle/events` against the page’s current origin, using `ws:` for an `http:` page and `wss:` for an `https:` page. The run handle is encoded as one URL path segment.

13. **Wire authority.** The client imports `WireMessage` from `@quorum/server` and parses the `event` member of an event message with `eventSchema` from `@quorum/shared`. It does not redeclare `WireMessage`, `WireRun`, `WireRefusal`, the Event union, a gate-answer vocabulary or any HTTP refusal-status table.

14. **Accepted WebSocket messages.** For each valid `{ type: "event" }` message, the client emits exactly one parsed Event to its consumer, in received order. For a valid `{ type: "missed", count }` message, it reports the count separately as an incomplete-replay notice and never passes it to the Event consumer.

15. **Invalid WebSocket messages.** Non-text messages, invalid JSON, unknown message types, invalid missed counts and events rejected by `eventSchema` move the client to an explicit protocol-error state. The offending value is not rendered as an Event, and the failure is not converted into an empty or idle run.

16. **Connection states.** The live-run client exposes distinguishable `connecting`, `open`, `closed` and `error` states. The mission-control placeholder renders each state in plain language. While connecting it says that the Studio is connecting; when open it says the live connection is active; and when unavailable it says that the daemon or live connection is unavailable rather than showing an empty mission control view.

17. **Socket closure.** A normal server close after a terminal Event is reported as ended. A close before a terminal Event, including the server’s unknown-run close, is reported as interrupted and includes the browser-provided close reason when one exists. Close reasons are rendered as text, not HTML.

18. **Retry behavior.** An interrupted or failed connection presents an explicit Retry action. The client does not retry automatically in this ticket. Activating Retry closes any previous socket, creates exactly one replacement socket and clears no previously accepted Events or incomplete-replay notice.

19. **Lifecycle cleanup.** Leaving `/runs/:handle`, changing the handle, or unmounting the application closes the active socket and prevents callbacks from that socket from updating the new route. At most one socket owned by the mission-control route is active at a time.

20. **No client-side persistence.** Route content, WebSocket Events, incomplete-replay notices and connection errors are held in memory only. The ticket adds no use of local storage, session storage, IndexedDB, cookies or another browser-side database.

21. **Production build.** `apps/web` declares a real `build` script that produces a deployable Vite bundle under `apps/web/dist/`. A clean `pnpm turbo run build` produces that bundle, and a second build can use Turborepo’s declared `dist/**` output without moving any test, lint or typecheck verdict behind the cached output.

22. **Build classification decision.** Before the build script lands, a new append-only decision entry records that `apps/web/dist/` is a served web bundle, not a member of the local distribution set installed from the three package tarballs. `docs/GLOSSARY.md` is updated in the same change so “emitted artifact” no longer implies that every workspace build output belongs to the local distribution set. The emitter/distribution tests are updated to distinguish the served bundle explicitly rather than silently adding `apps/web` to the three-package distribution set.

23. **Dependency justification.** The solution document gives a one-line justification for every new direct dependency, including React, the React DOM renderer, the selected client-side router, Tailwind and any Tailwind/Vite adapter. No architecture decision is added merely to repeat the already-landed React, Vite and Tailwind choice.

24. **Automated behavior coverage.** Tests independently cover route recognition, active navigation, placeholders, Not found behavior, theme tokens, WebSocket URL construction, valid event parsing, missed-message handling, invalid-message refusal, close-state classification, manual retry, and socket cleanup. A WebSocket integration test connects the browser client to a real Q-0118 server and observes at least one Event rather than testing only a mock callback.

25. **Workspace checks.** After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck` and `pnpm turbo run build` pass. `plan-backlog.test.ts` no longer lists Q-0014 in `UNCREATED`.

26. **BYOS.** The browser, source, tests, fixtures and documentation add no path for entering or transmitting an API key. Existing subscription-login behavior remains the only adapter login path.

27. **Safety by construction.** The shell and WebSocket client do not write project files, start a flow, answer a gate or implement worktree behavior. No UI copy claims the browser enforces worktree safety; that guarantee remains in core.

28. **Gate behavior.** This ticket adds no gate-answer control. In particular, it introduces no “override with reason” route, action or copy. Later gate behavior must use the existing `advance`, `retry` and `abort` contract unless a later decision changes that contract.

29. **Files are the database.** The shell introduces no persistent daemon or browser state. It does not cache or repair values read from `backlog/`, `harness/` or `.quorum/`.

30. **Product-agnostic and cold-clone impact.** Production code and default placeholders contain no product-specific demo names. The ticket adds no installation step beyond the existing workspace install and build commands and makes no claim that registry-resolved `npx quorum` works.

## Non-goals

- Implementing Projects home, the backlog board, ticket page, mission control traces, gate screen, run history, harness editor, flow editor or step chat.
- Starting, stopping or answering a run from the browser.
- Implementing `quorum open` or making the daemon serve the bundle.
- Authentication, authorization, remote access or a configurable non-loopback bind.
- Automatic WebSocket reconnection, event resumption or recovery of Events the server reports as missed.
- Persisting Events or UI state in the browser.
- Inventing a second wire contract, Event union, refusal mapping or gate-answer vocabulary.
- Rendering vendor-specific event shapes or calculating a blended cost.
- Light theme, user-selectable themes or theme persistence.
- A desktop shell, cloud sync, multi-user behavior, plugin marketplace, visual node canvas, eval suites or a Gemini adapter.
- Reintroducing “override with reason”.

## Open questions

1. **Blocker — build classification. Owner: maintainer at the requirements gate.** Confirm the recommendation in AC-21 and AC-22: add the production build now and classify its output as a served web bundle outside the local distribution set. Deferring the build would remove AC-21 and AC-22 and leave daemon delivery to the ticket that first serves the Studio, but it would also leave the architecture’s promised build output unproven.

2. **Blocker — router dependency. Owner: principal architect at solutioning.** Select the smallest maintained client-side router that supports the route map and browser-history navigation. If no dependency is selected, the solution must specify and test an equivalent internal router before implementation; history handling must not be improvised during development.

3. **Non-blocking — top-bar data owner. Owner: product manager for Q-0015 or the Projects ticket.** Which later ticket replaces “Not loaded” with project, branch and subscription data? This does not change this ticket’s placeholder behavior, but the owner should be recorded in the development plan so the placeholder does not become permanent.

## Risks

- Treating every package with a build script as part of the local distribution set could make the packed-install guarantee include a browser bundle that is neither published nor installed. AC-22 requires the distinction to be explicit.
- A WebSocket implementation that treats malformed input or an early close as an empty run would recreate reassurance by silence. The protocol-error and interrupted states are therefore required behavior.
- Automatic reconnection without a resume cursor could duplicate Events or hide a missed prefix. This ticket uses manual retry and preserves the server’s incomplete-replay notice.
- Route placeholders can accidentally become fake screens. Their content and available actions are deliberately constrained.
- Loading third-party fonts or assets would make a local-first shell depend on internet access. The theme uses local system stacks.
- Browser-style tests alone can pass without opening the real Q-0118 socket. The integration criterion requires a real server connection.
