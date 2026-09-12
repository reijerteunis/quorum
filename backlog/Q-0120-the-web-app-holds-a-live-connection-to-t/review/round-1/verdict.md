# Review verdict — Q-0120, round 1

**Ticket:** Q-0120 — The web app holds a live connection to the daemon
**Panel:** claude (2 blockers, 5 majors, 4 nits) · codex (4 majors)
**Verdict:** `changes-requested` — **2 blockers, 5 majors, 6 nits, 2 observations**

---

## How this was judged

Every finding below was read at the branch tip with `git show harness/Q-0120/integration:<path>` rather than taken from either report. That was not ceremony: **the panel contradicts itself outright on one finding**, codex calling `connection-state.ts`'s close handling a major defect while claude's *"checked and found correct"* section names the same line as correct by design. A judge that deduplicated on titles alone would have propagated one of the two without noticing the other existed.

Both reviewers found two of the same defects independently, from different starting points — the silent connection region and the kebab-case render. That is the panel spanning vendors doing what it is for, and both survive.

The two reviews are not comparable in reach. Claude read the tests, the guards, the manifests and the shared package; codex read three files under `apps/web/src` and named no test, no register and nothing under `packages/`. Both of codex's unique findings are downgraded below, but neither is dismissed — one of them is the sharpest observation in the round about what the AC-14 table actually proves.

**Nothing below is a red test.** `dev/development/run-4/integration-iter-2.md` records `pnpm turbo run test --force --continue` green across all seven packages at `387a832`. Every finding is an unmet criterion, a user-visible behaviour the criteria forbid, or a guard weaker than it reads.

---

## Blockers

### B-1 — the development proxy swallows seven of the shell's twelve routes

`apps/web/vite.config.ts:34`

```ts
const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.values(DAEMON_ENDPOINTS).map((prefix) => [prefix, { target: DAEMON_TARGET, ws: true }]),
);
```

Claude measured vite's own matcher rather than reasoning about it — `doesProxyContextMatchUrl` is `url.startsWith(context)` for a non-`^` key, and the proxy middleware is registered ahead of the SPA fallback in both `dev` and `preview`. I confirmed the collision from the registers themselves:

`HOME_PATH` is `'/projects'` (`apps/web/src/routes.ts:65`) and `DAEMON_ENDPOINTS.project` is `'/project'`, so `'/projects'.startsWith('/project')` is **true**. And `/runs`, `/flows` and `/history` are *simultaneously* rail entry paths and daemon prefixes.

| route | prefix | what a direct load gets |
| --- | --- | --- |
| `/projects` (home) | `/project` | daemon has `GET /project`, not `/projects` → **404** |
| `/runs` (rail) | `/runs` | daemon has no `GET /runs` at all → **404** |
| `/runs/:handle`, `/gate`, `/steps/:stepId` | `/runs` | **404** |
| `/flows`, `/history` (rail) | `/flows`, `/history` | Q-0119's **JSON**, rendered as the page |

Claude reported four rows; it is **seven of twelve**, because the rail's own `/runs`, `/flows` and `/history` entries are inside the same prefixes. The finding is understated rather than overstated.

**Impact.** In-app navigation is `pushState`, so the rail keeps working — which is exactly why this stays hidden until somebody reloads or types a URL. §9 R-1 states this ticket's acceptance path in as many words: *"start a run with `POST /runs` by hand, read the handle, type `/runs/<handle>`."* **That path does not work under the dev server this criterion built.** GO-4 — the browser measured against a real dev server with the daemon down and up — meets this before it gets anywhere near the daemon.

AC-13's *Test:* clause deliberately does not claim the proxy's runtime behaviour, so no assertion was skipped. The criterion asked for five prefixes without noticing three of them are rail paths and one is a prefix of a fourth.

**Recommendation.** Narrow the proxied contexts so they cannot match a shell route, still deriving them from `DAEMON_ENDPOINTS` as AC-13(d) requires — regex keys (`^/runs/[^/]+/events$` plus exact forms), or one `bypass` returning `/index.html` for a `GET` whose `Accept` includes `text/html`, which closes all seven rows at once. If the five-prefix wording is to stand, it needs an erratum **at the gate**, with the unreachable routes recorded.

---

### B-2 — the connection region is silent on every route but a run route

`apps/web/src/shell.tsx:132`, with `apps/web/src/app.tsx:114–117`

**Found independently by both reviewers.**

```tsx
{connection === undefined ? null : <ConnectionRegion connection={connection} />}
```

```ts
const connection: ShellConnectionProps | undefined =
  handle === undefined || snapshot === null ? undefined : { … };
```

On nine of the twelve routes `handle` is `undefined`, so the region renders `null`.

AC-20 is explicit about the one thing this may not be: `CONNECTION_PENDING` is *"retired by replacement, not deletion: the region renders the AC-15 state, and **on every route but the run route that state is `idle` and says so**"*. AC-15: *"the connection has a named state for every case and **none of them is silence**"*.

`idle` is a shipped member of the union and `connectionStateText({ kind: 'idle' })` returns `'Not connected.'` — reachable only from `connection-state.test.ts`, never from the app. The region Q-0014 reserved and deliberately filled with a sentence so it would not be blank is now blank. **This change makes the shipped app worse than `main` on nine routes**, which is what puts it above major.

**Nothing catches it, because the check was removed rather than replaced.** The deleted Q-0014 assertion was `expect(text).toContain(CONNECTION_PENDING)`; its replacement (`shell.test.ts:246–250`) asserts only that a non-run route opens no socket. AC-9's surviving `occurrences(text, NOT_LOADED) === TOP_BAR_REGIONS.length` passes either way — I confirmed `NOT_LOADED` is rendered exactly three times, by the three `TOP_BAR_REGIONS`, and the connection region was never one of them.

**Recommendation.** Render the region unconditionally, with an idle default composed in `app.tsx`. `canRetry({ kind: 'idle' })` is already `false`, so no control appears. Then restore the assertion: at `RAIL[0].path` the header contains the idle text.

---

## Majors

### M-1 — the state renders as a kebab-case identifier, and `no daemon` never names the URL

`apps/web/src/shell.tsx:102` **Found independently by both reviewers.** (codex cited `:99`.)

```tsx
<span className="text-idle" title={text}>{snapshot.state.kind}</span>
```

What renders is `no-daemon`, `no-such-run`, `protocol-error`. The sentence — `Could not reach the daemon at ws://…/runs/…/events. Is it running?` — goes into a `title`, which is not the page's text, is unreachable from a keyboard, and does not exist on touch.

AC-15 requires each state to render *"in plain language"* and `no daemon` to name *"the URL the client requested"*. The inline comment justifies the shortcut by citing AC-13 — but AC-13 governs how the URL is **constructed** and AC-15 governs what `no daemon` must **name**. The comment overrides a criterion rather than implementing it, and it is the load-bearing half: *no daemon* and *no such run* are "start the daemon" and "that handle is wrong".

**The new test passes *because* of the shortcut.** `shell.test.ts` asserts `toContain('live')`, satisfied by the rendered `kind` rather than by `Connected to …`; the URL assertion lives in `connection-state.test.ts`, one layer below where AC-15 places it. So the criterion is verified against the pure function and never against the surface.

**Recommendation.** Render `text`. React escapes text nodes and `runEventsPath` already percent-encodes the handle one segment at a time, so the stated risk is not one. Keep the `kind` as a `data-` attribute if a machine-readable token is wanted, then assert over the rendered region that `no-daemon` contains the requested URL and `no-such-run` produces a different sentence.

### M-2 — the proxy target's port is not read from the environment

`apps/web/vite.config.ts:32`

```ts
const DAEMON_TARGET = { host: '127.0.0.1', port: 7717, protocol: 'http' } as const;
```

AC-13(c): *"The target port **is read from the environment with a documented default** … **No test reads the variable**, so `turbo.json`'s `test` task `env` list stays `["QUORUM_REAL_CLI"]`."* There is no `process.env` read in the file; the JSDoc documents the convention and then says *"Nothing here reads it back."*

§0.6 is why this is not pedantic: `serve.ts` defaults `port = 0`, so the daemon asks the OS for an ephemeral port. **7717 is a port nothing binds** unless an operator passes it explicitly, so the environment override is the only practical way to aim the dev server at a running daemon. As shipped, an adopter whose daemon printed `:53412` edits source — the `adopter` story failing on its second sentence.

Worth recording where the clause was lost: `contracts/Q-0120/live-connection.contract.md` does not mention the variable, so the contract dropped it and development implemented the contract. **Recommendation:** `port: Number(process.env.QUORUM_DAEMON_PORT ?? 7717)`, comment unchanged, no test reading it.

### M-3 — a page-URL change with the same handle silently discards the accepted trace

`apps/web/src/app.tsx:109–111`, with `apps/web/src/run-connection.ts:124–131`

```ts
useEffect(() => {
  if (handle === undefined || pageHref === undefined) return;
  connectionRef.current?.connect(handle, new URL(pageHref));
}, [handle, pageHref]);
```

Confirmed at `run-connection.ts:129`: `connect()` runs `events = []; missedCount = null;` unconditionally. `pageHref` is `window.location.href` and changes on **every** navigation, while `runEventsUrl` reads only `page.protocol` and `page.host`. So `/runs/X` → `/runs/X/gate`, or Back between the two, re-enters `connect`, closes the live socket, **clears every accepted event and the missed notice**, and opens a replacement.

AC-17 authorises replacement on *"changing the handle"*. AC-18 requires a replacement to clear *"neither the events already accepted nor the incomplete-replay notice"* — `retry()` honours that; `connect()` does not, and `connect()` is the path a same-handle navigation takes.

**Latent today, live at the next ticket.** No shipped control navigates between two run routes. The moment Q-0015 links mission control to the gate screen — both already register rows — that link throws away the run's trace and opens a second subscription. Q-0118 built the `missed` envelope so a gap is *reported*; a gap the client creates is reported by nothing.

**Recommendation.** Depend on the origin: `const pageOrigin = page?.origin`, deps `[handle, pageOrigin]`. That is exactly as much of the page URL as `runEventsUrl` consumes. A fake-transport test driving two run paths under one handle — one socket, unchanged event list — is the clause that keeps it.

### M-4 — the AC-12 declaration guard cannot see the one shape the ticket opened on

`apps/web/test/source.test.ts:63`

```ts
const heads = /\b(?:interface|type)\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]*>)?\s*(?:=\s*)?\{/g;
```

Verified both ways. Written multi-line, a union alias has `|` between `=` and `{`, so the head never matches and `declarationBodies` returns `[]`. Written on one line, the head matches but the brace walk `break`s after the **first** balanced body, so the `missed` member is never scanned. Either way **a copied `WireMessage` union passes silently** — precisely the drift the ticket exists to forbid.

The frozen contract named the fixture and the shipped fixtures are not it:

> The guard must be shown to have a subject with a fixture that re-declares the **complete `WireMessage` union**, while the legitimate `FrameRefusal` and `ConnectionAction` declarations remain accepted.

The shipped fixtures are a single `interface` and a single non-union `type` alias. The second half proves nothing either: `ParsedFrame`, `FrameRefusal` and `ConnectionAction` are all unions, so they were never under the scan that "accepts" them. *"A check is not established by reading it"* (2026-08-29), inside the guard drafted to close this class.

**Recommendation.** Walk every top-level `{ … }` from the head to the statement's `;`, union members included. Add the union fixture the contract requires, shown red before green, and keep a negative fixture proving the three legitimate unions still pass.

### M-5 — a unit test opens a real WebSocket to `localhost:3000`

`apps/web/src/shell.test.ts:156`

```ts
const container = await render(createElement(App, { initialPath: '/runs/run%20one' }));
```

This Q-0014 test renders `App` at a **run** route with no `socketFactory` and no `pageUrl`, so the new mount effect reaches `defaultSocketFactory` and constructs `new WebSocket('ws://localhost:3000/runs/run%20one/events')` under jsdom, whose default URL is `http://localhost:3000/`.

**Impact.** The `@quorum/web` suite makes an outbound connection on every run. Port 3000 is a very common local listener; where one exists the socket **opens**, the app moves to `live`, and `setSnapshot` runs outside `act()` — a test doing materially different work depending on what else is running on the machine, which *"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) forbids. AC-17 made the constructor injectable so a throwing global could prove a socket was *not* opened; this is the one place in the suite where the un-injected default runs, and it runs against the network.

**Recommendation.** Pass the same fake factory and `pageUrl` the AC-20 tests two blocks down already use. One prop; the test keeps asserting exactly what it asserts today.

---

## Nits

### N-1 — the parser accepts a pre-parsed value, so "text frames only" is unenforced

`apps/web/src/frame-parser.ts:43` — *codex raised this as a major; downgraded, with the measurement.*

```ts
} else {
  parsed = data;
}
```

Codex is right that AC-14 says *"Text frames only"* and this does not enforce it. It is **not** a major, for a reason codex did not measure: a `WebSocket`'s `message.data` is `string | ArrayBuffer | Blob`, both non-string forms are caught by `isBinaryMessage`, and **every AC-14 case that can arrive from a socket lands on the right refusal identity** — `JSON.stringify('text')` → `non-object`, `new ArrayBuffer(2)` → `non-text-message`, `'not json at all {'` → `invalid-json`. Codex's claim that numeric input is *"required"* to be `non-text-message` over-reads (f), which is the binary case. And nothing is cast: the pre-parsed value still runs the full non-object, discriminant and schema chain.

What survives is sharper than the severity claimed. `frame-parser.test.ts:26` drives all four invalid-count rows as **raw objects**, and one of them cannot arise from the wire at all: `JSON.stringify({ count: Infinity })` yields `{"count":null}`, so the `Infinity` row asserts over an input no daemon can send. Four of the eight AC-14 rows are driven through a door the product does not have, which is weaker evidence about the wire than the table reads as giving.

**Recommendation.** Either refuse every non-string input as `non-text-message` and express the count rows as JSON text — dropping `Infinity`, which JSON cannot carry — or keep the door and say in the JSDoc why it exists and that the rows using it are unit convenience rather than wire coverage.

### N-2 — any close after a terminal event becomes `ended`, where the contract says a normal close

`apps/web/src/connection-state.ts:76` — *codex raised this as a major; claude reviewed the same line and recorded it correct. Adjudicated.*

```ts
if (machine.terminalSeen) return { ...machine, state: { kind: 'ended' } };
```

Codex reads the frozen contract's clause 3 — *"A **normal** close after an accepted terminal event produces `ended`"* — and is literally right that the code ignores the close code. Claude read AC-15's *Test:* clause — *"`ended` asserted to require a `terminal` event rather than a close code alone"* — and is literally right that the code matches it. **The contract is genuinely ambiguous, and two reviewers reading it reached opposite verdicts, which is the finding.**

It is not a major because no false claim reaches the user. A terminal event means the stream completed; a 1006 after it lost nothing, so *"The run has finished."* is true, and the Retry codex wants offered would reconnect to a run that is over. The implementer's comment states the rule openly rather than arriving there by accident.

**Recommendation.** Make one of the two move so the next reader is not sent round this loop: either the reducer requires the normal code, or clause 3 and AC-15's fourth precedence line say *any* close after a terminal event. The *Test:* clause endorses the shipped reading, so the cheaper repair is the sentence — and it is the branch's own contract file, not a criterion, so no erratum is owed.

### N-3 — the glossary guard's entry delimiter never matches, and the term is missing a required clause

`packages/shared/src/docs.test.ts:61`

```ts
const entry = glossary.slice(start, glossary.indexOf('\n- **', start + 1) < 0 ? undefined : …);
```

`docs/GLOSSARY.md` entries are `**Term**:` at line start, not bullets, so `'\n- **'` occurs zero times and the slice runs to EOF — claude measured the "entry" at 17,593 of the file's 22,260 characters. Three clauses are then satisfied by neighbouring entries (`derived|per moment`, `never (?:stored|persisted)|memory`, and the words `ended` and `live`). The nine-state list still discriminates, so the guard has a subject; it is not the scoped one it reads as having. `'\n**'` is the delimiter that isolates it.

Second half: AC-23 requires the term to carry *"the rule that **no member of it is silence**"*. The glossary does not state it and the test does not ask for it — the same shape as B-2 one layer up, so fix them together.

### N-4 — the sentence that caused the drift is still in place

`packages/server/src/wire.ts:4` and `packages/server/src/index.ts:31–32`

*"Kept apart from `http.ts` so the contract Q-0014 codes against can be read without reading the routing"*, and *"Q-0014 codes against `WireRefusal`, `WireRun` and `WireMessage`, which is why the wire shapes are on this surface."*

That is the sentence the ticket body names as the **cause**: *"an implementer copies the interfaces into the app, the drift arrived at by obeying the sentence forbidding it."* `WireMessage` is now declared in `@quorum/shared` and only re-exported here, so the claim is false for one of the three shapes — and §0.17 defers the other two to Q-0015 or Q-0121, whose implementer reads the same sentence and finds the same unimportable package. One line in each file.

### N-5 — the route-literal exception register carries no reasons

`apps/web/test/routes.test.ts:59`. The frozen contract requires identities of `(file, literal, reason)`, each carrying a non-empty reason; the shipped `EXCEPTIONS` is a bare `Set` of `file:literal` strings with the reasons living only in the contract document. The exercised-use assertion beside it does the important half — a stale row fails — but the reason column is what a reviewer weighs instead of re-deriving, and a contract file is not where the next person editing the scan looks. A `Record<string, string>` costs nothing and leaves the assertion unchanged.

### N-6 — the accepted-event list is copied per event

`apps/web/src/run-connection.ts:98` — `events = [...events, result.frame.event];`, quadratic on a stream whose whole purpose is to be long. Nothing caps it, correctly: AC-19 asks for memory only, not a cap. Q-0015 renders mission control from this same snapshot, so either push into a mutable array and hand out a frozen view, or leave it deliberately — but say so rather than let it surface later.

---

## Observations

`observation:` **The shell's URL namespace and the daemon's overlap on three prefixes, by the design of three earlier tickets.** `/runs`, `/flows` and `/history` are rail entry paths (Q-0014) and daemon routes (Q-0118, Q-0119). B-1 is that collision meeting a prefix-matching dev proxy, and is this change's to fix. **The collision itself is not**, and it does not go away when the proxy does: Q-0122 serves the built bundle *from the daemon*, where the same process must answer `GET /runs` as JSON and `GET /runs/<handle>` as HTML with no proxy to reconcile them. That is a design question Q-0122 should meet with a decision rather than discover in a middleware ordering.

`observation:` **The `review.yaml` splice the merged requirement's §11 recorded does not reproduce, and that pre-review obligation is discharged.** §11 reported the Q-0117 paragraph inserted between *"at least one"* and *"finding."*, and said it *"should be fixed before this ticket reaches `review`"*. Read at `harness/flows/review.yaml:35–43`, the paragraph is appended **after** a complete sentence — *"…there must be at least one finding. Judge the reviews, not the code diff."* — exactly as `chore.yaml` carries it; the line break §11 read as a splice is the folded scalar's own wrapping. Nothing is owed, and the next reader of that section should not re-derive it.

---

## What I verified, and what I did not

**Measured at the branch tip rather than read:** the proxy's seven-route collision against `ROUTES` and `DAEMON_ENDPOINTS` (B-1, one row wider than the report); `connection === undefined ? null` and that `NOT_LOADED` renders exactly three times so AC-9's count cannot see the missing region (B-2); the `title` render and that the passing assertion is satisfied by the `kind` (M-1); the absence of any `process.env` read in `vite.config.ts` (M-2); `connect()`'s unconditional `events = []` against the `[handle, pageHref]` dependency (M-3); the head regex against both a multi-line and a single-line union re-declaration, and the `break`-after-first-body walk (M-4); the un-injected `App` render at `/runs/run%20one` (M-5); the four invalid-count rows driven as raw objects and that `Infinity` cannot survive `JSON.stringify` (N-1); the reducer's `terminalSeen`-before-`opened` ordering (N-2); the glossary delimiter (N-3); both server header sentences (N-4); the bare `Set` (N-5).

**Checked and found correct**, recorded so round 2 does not re-derive it: the 1008/1013 precedence ahead of everything, including 1008 after an accepted terminal; `error`-then-`close` both landing on `no-daemon` while `opened` is false; socket-identity guards on all four callbacks *and* handler detachment, so a late callback is inert by two mechanisms; `retry()` correctly preserving `events` and `missedCount` where `connect()` does not; handle percent-encoding confined to one segment; the socket scheme derived by substring replacement so no scheme literal is written under `src`; `ws: true` on every proxy entry; the type-only re-export leaving `packages/server`'s runtime `SURFACE` register and its six no-export-surface assertions unmoved; `defaultClientConditions` spread rather than replaced.

**Not claimed.** I did not execute the suite; `integration-iter-2.md` records it green across seven packages at `387a832` and I took that as its verdict. GO-4 (the browser against a real dev server), GO-5 (the empty-store comparison) and GO-6 (a tree with no `packages/shared/dist`) are gate measurements outside a read-only review — **B-1 is what I expect GO-4 to meet first**, and it will meet it before the daemon is reached at all.
