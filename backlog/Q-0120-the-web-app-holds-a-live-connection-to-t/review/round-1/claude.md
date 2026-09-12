# Code review — Q-0120, review round 1 (claude)

**Ticket:** Q-0120 — The web app holds a live connection to the daemon
**Diff:** `main...harness/Q-0120/integration`, 31 files, +1,129 / −64
**Read at:** the branch tip, via `git show harness/Q-0120/integration:<path>` for every file, rather than from the patch text
**Verdict:** `revise` — 2 blockers, 5 majors, 4 nits

---

## Summary

The shape of the change is right and the hard parts are done well. `WireMessage` moves to `@quorum/shared` with a runtime schema beside it and `packages/server` re-exports it type-only, so the runtime `SURFACE` register does not move and that package gains no export surface — AC-12(a)'s central claim holds. The parser is genuinely staged and non-throwing, and each of its six refusals is distinguishable by value. The reducer's close-code precedence matches the contract exactly, including the case the contract is subtlest about: a 1008 refusal wins over an already-accepted `terminal` event. The controller detaches handlers **and** guards on socket identity, so a late callback is inert by two mechanisms rather than one. `integrate` is green across all seven packages (136 tests in `@quorum/web`), so nothing below is a red test — every finding is an unmet criterion, a user-visible behaviour the criteria forbid, or a guard weaker than it reads.

Two things dominate. First, the development proxy AC-13(d) asks for is matched by **prefix**, and four of the app's own twelve routes sit under those prefixes — including `/projects`, the home route, and `/runs/<handle>`, the one route this ticket exists for. Second, the connection region renders **nothing at all** on every non-run route, where AC-20 says in as many words that it must say `idle` and AC-15 says no member of the set is silence; the Q-0014 test that asserted the region said *something* was deleted and not replaced.

Both are cheap to fix, and neither is visible from the suite. That is why they are worth a round.

---

## Blockers

### B-1 — the development proxy swallows four of the app's own routes, including `/runs/<handle>`

`apps/web/vite.config.ts:34–35`

```ts
const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.values(DAEMON_ENDPOINTS).map((prefix) => [prefix, { target: DAEMON_TARGET, ws: true }]),
);
```

**Measured in the installed Vite rather than reasoned about.** `vite@8.2.2`, `dist/node/chunks/node.js:19297`:

```js
function doesProxyContextMatchUrl(context, url) {
  return context[0] === "^" && new RegExp(context).test(url) || url.startsWith(context);
}
```

and the registration order at `:26636`, `:26653`, `:26656` — `proxyMiddleware` is installed **before** `htmlFallbackMiddleware` and `indexHtmlMiddleware`, in `vite dev` and again in `vite preview` (`:35845`, `:35862`, `:35866`). A proxied path never reaches the SPA fallback.

Against `ROUTES` in `apps/web/src/routes.ts`:

| request | matching prefix | what the browser gets |
| --- | --- | --- |
| `GET /projects` (`HOME_PATH`) | `/project` — `'/projects'.startsWith('/project')` is **true** | the daemon serves `GET /project`, not `/projects` → Hono **404** |
| `GET /runs/<handle>` | `/runs` | the daemon has only `POST /runs`, `POST /runs/:id/gate`, `POST /runs/:id/stop`, `GET /runs/:id/events` → **404** |
| `GET /runs/<handle>/gate`, `/runs/<handle>/steps/<id>` | `/runs` | **404** |
| `GET /flows`, `GET /history` | `/flows`, `/history` | Q-0119's **JSON**, rendered as the page |

**Impact.** In-app navigation is `pushState`, so clicking the rail still works — which is exactly why this stays hidden until somebody reloads or types a URL. A reload on the **home screen** returns the daemon's 404. And §9 R-1 states this ticket's acceptance path in as many words: *"start a run with `POST /runs` by hand, read the handle, type `/runs/<handle>`."* That path does not work under the dev server this criterion built, so the deliverable cannot be demonstrated the way the requirement says to demonstrate it. GO-4 — the browser measured against a real dev server with the daemon down and up — hits this before it gets to the daemon.

AC-13's *Test:* clause deliberately does not claim the proxy's runtime behaviour, so no assertion is missing and this is not a criterion the implementer skipped. What happened is that the criterion asked for five prefixes without noticing three of them are shell routes, and one of them is a prefix of a fourth.

**Recommendation.** Narrow the proxied contexts so they cannot match a shell route, still deriving them from `DAEMON_ENDPOINTS` as AC-13(d) requires. Either regex keys (`^/runs/[^/]+/events$` for the socket plus exact forms for the three POSTs and the read routes), or one `bypass` that returns `/index.html` for a `GET` whose `Accept` includes `text/html` — the second keeps one entry per prefix and closes all four rows at once. If the five-prefix wording is to stand as written, it needs an erratum **at the gate** saying so, with the four unreachable routes recorded.

---

### B-2 — the connection region is silent on every route but a run route

`apps/web/src/shell.tsx:132`, with `apps/web/src/app.tsx:114–117`

```tsx
{connection === undefined ? null : <ConnectionRegion connection={connection} />}
```

```ts
const connection: ShellConnectionProps | undefined =
  handle === undefined || snapshot === null ? undefined : { … };
```

On nine of the twelve routes `handle` is `undefined`, so `connection` is `undefined`, so the region renders `null`.

AC-20 is explicit about the one thing this may not be:

> `CONNECTION_PENDING` … is **retired by replacement, not deletion**: the region renders the AC-15 state, and **on every route but the run route that state is `idle` and says so** — the top bar is global and the socket is the run route's.

and AC-15: *"the connection has a named state for every case and **none of them is silence**"*, with `idle` first in the closed set.

**Impact.** `idle` is a member of the shipped union and `connectionStateText({ kind: 'idle' })` returns `'Not connected.'` — reachable only from `connection-state.test.ts`, never from the app. The region Q-0014 reserved, and deliberately filled with a sentence so it would not be blank, is now blank. That is the failure this shell's own module header says it refuses, arriving as its inverse: an empty region where the state exists, is known, and has text written for it.

**Nothing catches it, because the check was removed rather than replaced.** The deleted test read:

```ts
expect(text, 'the connection region is silent about there being no connection').toContain(CONNECTION_PENDING);
```

Its replacement (`shell.test.ts:246–250`) asserts only that a **non-run** route opens no socket. AC-9's surviving `occurrences(text, NOT_LOADED) === TOP_BAR_REGIONS.length` passes whether the connection region is present or absent, the connection region never having been one of the three `TOP_BAR_REGIONS`.

**Recommendation.** Render the region unconditionally — pass `snapshot ?? { state: { kind: 'idle' }, events: [], missedCount: null }`, or make `ShellConnectionProps` non-optional with an idle default composed in `app.tsx`. `canRetry({ kind: 'idle' })` is already `false`, so no control appears. Then restore the assertion the deleted test was making: at `RAIL[0].path` the header contains the idle text.

---

## Majors

### M-1 — the state renders as a kebab-case identifier, and `no daemon` never names the URL

`apps/web/src/shell.tsx:102`

```tsx
<span className="text-idle" title={text}>{snapshot.state.kind}</span>
```

AC-15: *"Each state renders in the top bar's connection region **in plain language**, and **no daemon** names **the URL the client requested**."* What renders is `no-daemon`, `no-such-run`, `protocol-error`. The sentence — `Could not reach the daemon at ws://…/runs/…/events. Is it running?` — goes into a `title` attribute, which is not the page's text, is unreachable from a keyboard, and does not exist on touch.

The inline comment justifies it by asserting the URL *"does not belong in the page's visible text"*, citing AC-13. AC-13 governs how the URL is **constructed**; AC-15 governs what `no daemon` must **name**, and §0.7 narrows it to the requested URL precisely so the client never prints an address it does not hold. The comment overrides a criterion rather than implementing it — and it is the load-bearing half, since *no daemon* and *no such run* are "start the daemon" and "that handle is wrong".

**The new test passes *because* of the shortcut.** `shell.test.ts:259` asserts `expect(text).toContain('live')`, satisfied by the rendered `kind` rather than by `Connected to …`; `connection-state.test.ts:45` asserts `connectionStateText(absent)).toContain(url)`, which is the pure function naming the URL. Nothing asserts the rendered surface does either thing, so AC-15 is verified one layer below where the criterion places it.

**Recommendation.** Render `text`. React escapes text nodes and `runEventsPath` already percent-encodes the handle a segment at a time, so the stated risk is not one. Keep the `kind` as a `data-` attribute or a short badge if a machine-readable token is wanted. Then assert, over the rendered region, that `no-daemon` contains the requested URL and that `no-such-run` produces a different sentence — the clause a single catch-all fails, at the layer AC-15 names.

### M-2 — the proxy target's port is not read from the environment

`apps/web/vite.config.ts:32`

```ts
const DAEMON_TARGET = { host: '127.0.0.1', port: 7717, protocol: 'http' } as const;
```

AC-13(c): *"The target port **is read from the environment with a documented default**, and the comment beside it records that the daemon has no default port … **No test reads the variable**, so `turbo.json`'s `test` task `env` list stays `["QUORUM_REAL_CLI"]`."* There is no `process.env` read anywhere in the file; the JSDoc documents the convention and then says *"Nothing here reads it back."*

This is not pedantic, and §0.6 is the reason: `packages/server/src/serve.ts:188` defaults `port = 0`, so the daemon asks the operating system for an ephemeral port. **7717 is a port nothing binds** unless an operator passes it explicitly, so the environment override is the only practical way to aim the dev server at a running daemon. As shipped, an adopter whose daemon printed `:53412` must edit source — which is the `adopter` story in §2 failing on its second sentence.

Worth recording where the clause was lost: `contracts/Q-0120/live-connection.contract.md` does not mention the variable at all, so the contract dropped it and the development task implemented the contract. No test covers it, so the gap is invisible from the suite.

**Recommendation.** `port: Number(process.env.QUORUM_DAEMON_PORT ?? 7717)`, comment unchanged, and no test reading it — which is what AC-13(c) asks for and what keeps the `env` list at one entry.

### M-3 — a page-URL change with the same handle silently discards the accepted trace

`apps/web/src/app.tsx:109–111`, with `apps/web/src/run-connection.ts:124–131`

```ts
useEffect(() => {
  if (handle === undefined || pageHref === undefined) return;
  connectionRef.current?.connect(handle, new URL(pageHref));
}, [handle, pageHref]);
```

```ts
connect(nextHandle: string, nextPage: URL): void {
  …
  events = [];
  missedCount = null;
  open(runEventsUrl(nextPage, nextHandle));
}
```

`pageHref` is `window.location.href` (`app.tsx:85`) and changes on **every** navigation, while `runEventsUrl` reads only `page.protocol` and `page.host` (`daemon-endpoints.ts:24–25`). So any navigation that keeps the handle and changes the path — `/runs/X` → `/runs/X/gate`, or Back between the two — re-enters `connect`, which closes the live socket, **clears every accepted event and the missed notice**, and opens a replacement.

AC-17 authorises replacement on *"changing the handle"*. AC-18 requires a replacement to clear *"neither the events already accepted nor the incomplete-replay notice"* — `retry()` honours that correctly; `connect()` does not, and `connect()` is the path a same-handle path change takes.

**Latent today, live at the next ticket.** No shipped control navigates between two run routes: the rail's seven entries all leave the run route, where disposing is correct. The moment Q-0015 or Q-0016 links mission control to the gate screen — both are register rows already, `/runs/:handle` and `/runs/:handle/gate` — clicking that link silently throws away the run's trace, resets the visible event count with no explanation, and opens a second subscription against the daemon. Q-0118 built the `missed` envelope so a gap is reported rather than smoothed over; a gap the **client** creates is reported by nothing.

**Recommendation.** Depend on the origin rather than the href: `const pageOrigin = page?.origin`, deps `[handle, pageOrigin]`, `new URL(pageOrigin)` at the call. That is exactly as much of the page URL as `runEventsUrl` consumes, so the dependency then says what the connection actually reads. A fake-transport test driving two run paths under one handle — one socket, unchanged event list — is the clause that keeps it.

### M-4 — AC-12's declaration guard cannot see the one shape the ticket opened on

`apps/web/test/source.test.ts:63`, fixtures at `:88–89`

```ts
const heads = /\b(?:interface|type)\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]*>)?\s*(?:=\s*)?\{/g;
```

**Measured, not read.** Running `duplicateMissedDeclarations` over a verbatim copy of the union:

```ts
type WireMessage =
  | { readonly type: 'event'; readonly event: unknown }
  | { readonly type: 'missed'; readonly count: number };
```

`declarationBodies` returns `[]` and the predicate returns `false`. The head pattern requires `{` immediately after the optional `=`, and a union alias has `| ` between them — so **no union type alias is scanned at all**, and the guard is blind to precisely the drift it exists to forbid: an implementer who copies `packages/server/src/wire.ts`'s former declaration into `apps/web` passes it silently.

The contract named the fixture and the shipped fixtures are not it:

> The guard must be shown to have a subject with a fixture that re-declares the **complete `WireMessage` union**, while the legitimate `FrameRefusal` and `ConnectionAction` declarations remain accepted.

`:88` is a single `interface`, `:89` a single object alias — shapes nobody would write. It also means the "legitimate declarations remain accepted" half proves nothing: `ParsedFrame`, `FrameRefusal` and `ConnectionAction` are all unions, so they were never under the scan that accepts them. *"A check is not established by reading it"* (2026-08-29), inside the guard drafted to close this class.

**Recommendation.** Collect every brace-balanced object body inside a declaration, union members included — scan from the head to the statement's `;` and walk each top-level `{ … }`. Add the union fixture the contract requires, shown red before green, and keep a negative fixture proving `Extract<WireMessage, { type: 'missed' }>` and the three legitimate unions still pass.

### M-5 — a unit test opens a real WebSocket to `localhost:3000`

`apps/web/src/shell.test.ts:152–156`

```ts
test('a dynamic route shows the decoded segment the URL supplied', async () => {
  const container = await render(createElement(App, { initialPath: '/runs/run%20one' }));
```

This existing Q-0014 test renders `App` at a **run** route with no `socketFactory` and no `pageUrl`, so the new mount effect reaches `defaultSocketFactory` (`app.tsx:40`) → `new WebSocket('ws://localhost:3000/runs/run%20one/events')` under `@vitest-environment jsdom`, whose default URL is `http://localhost:3000/`.

**Verified against the installed jsdom@29.1.1:** that construction returns `readyState 0` and then fires `error` followed by `close` code `1006` — a real TCP connection was attempted.

**Impact.** The `@quorum/web` suite now makes an outbound connection on every run. Port 3000 is a very common local listener; where one exists the socket **opens**, the app moves to `live`, and `setSnapshot` runs outside `act()` — React act-warnings, and a test doing materially different work depending on what else is running on the machine. AC-17 made the constructor injectable so that *"a throwing global … can prove a socket was not opened"*; this is the one place in the suite where the un-injected default runs, and it runs against the network.

**Recommendation.** Pass the same fake factory and `pageUrl` the AC-20 tests already use (`shell.test.ts:247`, `:254`). One prop, and the test keeps asserting exactly what it asserts today.

---

## Nits

### N-1 — the glossary guard's entry delimiter never matches, and the term is missing one required clause

`packages/shared/src/docs.test.ts:61`

```ts
const entry = glossary.slice(start, glossary.indexOf('\n- **', start + 1) < 0 ? undefined : glossary.indexOf('\n- **', start + 1));
```

`docs/GLOSSARY.md` entries are not bullets — they are `**Term**:` at line start — so `'\n- **'` occurs zero times, `indexOf` returns `-1`, and the slice runs to EOF. Measured: the "entry" is **17,593 of the file's 22,260 characters**. Three clauses are then satisfied by neighbouring entries — `derived|per moment`, `never (?:stored|persisted)|memory`, and the words `ended` and `live`. The nine-state list still discriminates (gutting the entry leaves eight of nine missing), so the guard has a subject; it just is not the scoped one it reads as having. `'\n**'` is the delimiter that isolates it.

Second half: AC-23 requires the term to carry *"the rule that **no member of it is silence**"*. `docs/GLOSSARY.md:27` does not state it and the test does not ask for it — the same shape as B-2 one layer up, so fix them together.

### N-2 — the sentence that caused the drift is still in place

`packages/server/src/wire.ts:4` — *"Kept apart from `http.ts` so the contract Q-0014 codes against can be read without reading the routing"* — and `packages/server/src/index.ts`, *"Q-0014 codes against `WireRefusal`, `WireRun` and `WireMessage`, which is why the wire shapes are on this surface"*.

That is the sentence the ticket body names as the **cause**: *"an implementer copies the interfaces into the app, the drift arrived at by obeying the sentence forbidding it."* `WireMessage` is now declared in `@quorum/shared` and only re-exported here, so the claim is false for one of the three shapes — and §0.17 explicitly defers `WireRefusal` and `WireRun` to Q-0015 or Q-0121, whose implementer reads the same sentence and finds the same unimportable package. The orphaned `WireMessage` JSDoc was correctly removed; the header pointing at it was not. One line in each file: the frame union is declared in `@quorum/shared` and re-exported here, and a browser imports the shared module.

### N-3 — the route-literal exception register carries no reasons

`apps/web/test/routes.test.ts:59–67`. The contract requires identities of `(file, literal, reason)` and that each *"carry a non-empty reason"*; the shipped `EXCEPTIONS` is a bare `Set` of `file:literal` strings, with the reasons living only in `contracts/Q-0120/live-connection.contract.md`. The exercised-use assertion is good and does the important half — a stale row fails. But the reason column is the point of the register idiom here: it is what a reviewer weighs instead of re-deriving, and a contract file is not where the next person editing the scan looks. A `Record<string, string>` costs nothing and leaves the assertion unchanged.

### N-4 — the accepted-event list is copied per event

`apps/web/src/run-connection.ts:98` — `events = [...events, result.frame.event];` — quadratic in the number of events, on a stream whose whole purpose is to be long. Nothing caps it, correctly: AC-19 asks for memory only, not a cap. Q-0015 renders mission control from this same snapshot, so either push into a mutable array and hand out a frozen view, or leave it deliberately — but say so rather than let it surface later.

---

## What I verified, and what I did not

**Verified by measurement rather than by reading:**

- the AC-12 head regex against a real union re-declaration (M-4) — collects nothing;
- `vite@8.2.2`'s `doesProxyContextMatchUrl` and the middleware registration order (B-1) — prefix match, proxy ahead of the SPA fallback, in dev and in preview;
- `jsdom@29.1.1` WebSocket construction (M-5) — connection attempted, `error` then `close 1006`;
- `turbo run test --dry=json` (**no finding**) — `globalCacheInputs.files` is `.nvmrc`, `eslint.config.js`, `tsconfig.base.json`, `vitest.shared.js`, and the lockfile is **not** among them, so the new `../../pnpm-lock.yaml` input and its `MANIFEST` row are genuinely needed rather than the redundant re-declaration Q-0108's review rejected; clause A holds because `packages/shared` + `../../pnpm-lock.yaml` normalises to `pnpm-lock.yaml`;
- the glossary guard's slice length, and that a gutted entry still fails it (N-1);
- `import.meta.resolve` is already established here (`packages/server/src/package.test.ts:165–166`), so `apps/web/test/package.test.ts`'s AC-22 assertion follows a landed shape;
- `apps/web/test/source.test.ts`'s AC-5 scan forbids `node:`, the builtin list and `@quorum/core` only — it is not an allow-list, so the new `@quorum/shared` imports are admissible and no guard needed widening.

**Checked and found correct**, recorded so the next round does not re-derive it: the close-code precedence including 1008-after-terminal; `terminalSeen` as the discriminator for `ended` rather than the close code alone; `error`-then-`close` both landing on `no-daemon` while `opened` is false; handle percent-encoding confined to one segment for `/`, `?`, `#` and a space; the socket scheme derived by substring replacement so no scheme literal is written under `src`; `ws: true` on every proxy entry; the `SURFACE` register unmoved because the re-export is type-only; `@quorum/shared` already a declared dependency of `packages/server`; the scope needle in `packages/shared/src/wire.test.ts` assembled so `index.test.ts`'s no-workspace-import scan keeps its subject; and no new `@quorum/` literal, `node:` import or filesystem reach in `packages/shared/src`'s production files.

**Not claimed.** I did not execute the suite — the working tree is `main`, and checking out the branch is a write this review may not make. `dev/development/run-4/integration-iter-2.md` records `pnpm install --frozen-lockfile` exit 0 and `pnpm turbo run test --force --continue` exit 0 with all seven packages green at `387a832`, and I have taken that as the suite's verdict. Every finding above is therefore an unmet criterion, a behaviour the criteria forbid, or a guard weaker than it reads — none is a red test. GO-4 (the browser with the daemon down), GO-5 (the empty-store comparison) and GO-6 (a tree with no `packages/shared/dist`) are gate measurements outside a read-only review; B-1 is what I expect GO-4 to meet first.
