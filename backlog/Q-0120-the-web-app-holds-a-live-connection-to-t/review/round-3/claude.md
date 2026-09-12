# Q-0120 — review round 3

Read-only review of `main...harness/Q-0120/integration` (tip `53ae8c9`), against the merged
requirement (AC-12 to AC-23) and `contracts/Q-0120/live-connection.contract.md`. No repository file
was changed. Every finding below was checked against the branch rather than against the patch, and
the two that turn on a regex or a substring were **executed** rather than read.

**Nine findings: three majors, six nits. No blocker.**

The code itself is in good shape. The staged parser, the close-code precedence, the two-mechanism
socket invalidation (identity guard *and* detachment), and the `no-daemon` / `no-such-run`
separation all do what AC-14, AC-15 and AC-17 ask, and I verified the close codes the reducer
branches on (`1008`, `1013`, `1000`) against the ones `packages/server/src/serve.ts:196,208,215`
actually sends, the event fixtures against `eventSchema`'s real members, and `defaultClientConditions`
against the installed `vite@8.2.2`. All four agree.

**What the findings have in common is the instrument, not the change.** Two majors are criteria that
are met in prose but not by any assertion that could fail; the third is a criterion that is not met
at all, and whose guard cannot see that it is not met. That is the class this repository has recorded
more than any other, and all three are cheap to close.

---

## Major

### M-1 — AC-23's `packages/server` clause is unmet, and its guard is satisfied by the status line alone

`docs/04-architecture.md` · `packages/shared/src/docs.test.ts:53-54`

AC-23 requires that `docs/04-architecture.md`'s **`packages/server` section** gain *"the one sentence
that the frame union is declared in `shared` and re-exported here, and why"*.

It did not. The change touches exactly two places in that document: the status line (`:3`) and the
**`apps/web`** section (`:191`). The `### packages/server` section is unedited — I printed it in
full, and it still describes the transport, the refusal envelope and the three dependencies with no
mention of where `WireMessage` lives. A reader arriving at the section about the package that
re-exports the union learns nothing about the seam, which is the one thing that section was supposed
to gain.

The guard cannot report this, because both of its positive clauses are document-wide:

```ts
expect(architecture).toMatch(/frame union[\s\S]*@quorum\/shared/i);
expect(architecture).toMatch(/packages\/server[\s\S]*re-export/i);
```

`[\s\S]*` spans the whole file, so each clause asks only *do these two strings both occur, in this
order, anywhere*. Executed against **line 3 alone** — the status line, with the entire rest of the
document removed — both return `true`. So the `apps/web` paragraph at `:191` could be deleted
outright and this test would still pass on the status line's own dated entry, which contains "frame
union", "@quorum/shared", "packages/server" and "re-exported" in exactly that order.

Only `:52`'s `not.toContain('There is no connection to the daemon')` has a real subject here.

**Impact.** An unmet criterion shipping green, and — worse for the next ticket — a guard that will go
on reporting AC-23 as satisfied whatever happens to the prose it is supposed to be holding.

**Recommendation.** Add the sentence to the `### packages/server` section, and scope both clauses to
the section they are about rather than to the file: slice the document from `### packages/server` to
the next `### ` heading, assert within that slice, and assert the slice's length as an
anti-over-slice guard — exactly the shape the new glossary clause at `:60-66` already uses, and for
exactly the reason its own comment gives (`\n**` vs `\n- **`, round 1 N-3). The same scoping fixes
the `apps/web` clause.

### M-2 — nothing proves a non-zero missed count is rendered; the assertion is satisfied by the URL

`apps/web/src/shell.test.ts:291`

AC-16 requires that a `missed` frame *"is surfaced with its count"*, and its Test clause requires
that `count: 7` **"must surface the number"**. The only render-level check is:

```ts
socket.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 2 }) });
...
for (const expected of ['Connected to', '2', '3', 'step', 'implement']) expect(text).toContain(expected);
```

`text` is the whole header, and the header's connection sentence is
`Connected to wss://page.test/runs/run%20one/events.` — the fixture handle is `run one`, which
`runEventsPath` percent-encodes to `run%20one`. **So `toContain('2')` is satisfied by `%20`,
independently of the missed notice.** The same file asserts that encoded form reaches the header at
`:340` (`toContain('/runs/run%20one/events')`), so this is not hypothetical — it is the same string.

I ran both header texts, with and without the notice: all five `toContain` clauses pass either way.
Deleting the `missed {n}` span from `ConnectionRegion` (`apps/web/src/shell.tsx:110-112`) leaves this
test green. The sibling zero-case test at `:302` asserts `not.toContain('missed')`, which is also
green with the span gone, and `run-connection.test.ts` proves only that `snapshot.missedCount === 7`
— a fact about the controller, not about the page.

So the whole rendering half of AC-16 — the notice AC-16 exists for — is currently held by nothing.

**Impact.** The one user-facing consequence of Q-0118's `missed` envelope, which is the reason that
envelope was built, can regress silently.

**Recommendation.** Use a count the URL cannot supply and assert the rendered phrase, not the digit:
`expect(text).toContain('missed 7')` with `count: 7` (`7` occurs nowhere else in that header), and
keep the digit assertions for the event count. Cheapest discriminating form; no new fixture needed.

### M-3 — AC-17's React half is untested, and the instrument cannot test it

`apps/web/src/shell.test.ts:78-83` · `apps/web/src/app.tsx:100-110`

AC-17 binds three closes: *"Leaving the run route, changing the handle, or unmounting closes the
active socket"*, asserted **"over the transport's own close record"**.

`run-connection.test.ts` covers the controller: replacement closes (`:43`), repeated retry
(`:125`), and `dispose()` idempotence (`:136`). None of those proves that `app.tsx` ever calls
`dispose()` — that is the effect cleanup at `:103-109`, and it is the part most likely to be wrong,
being the one place two effects with different dependency sets meet (see N-1).

There is no test at the React layer for any of the three. No test navigates away from a run route,
none changes a handle within one mount, and no test asserts anything about unmount — `afterEach`
(`:50-53`) unmounts and asserts nothing.

It could not assert anything if it wanted to, because the fake used at the React layer keeps no
record:

```ts
class FakeSocket implements SocketTransport {
  ...
  close(): void {}
}
```

`run-connection.test.ts:10-11` has `closes = 0; close(): void { this.closes += 1; }` — the recording
half was written for the controller's fake and omitted from the shell's. That is Q-0118's round-2
finding — *assert over the transport's close record, never over "the run still exists"* — met in one
file and not in the other.

**Impact.** Deleting `controller.dispose()` from the effect cleanup, or returning no cleanup at all,
leaves every socket a user ever opened attached for the life of the tab, with the whole suite green.
That is the leak AC-17 is entirely about, in the layer AC-17's own Test clause names.

**Recommendation.** Give `shell.test.ts`'s `FakeSocket` the same `closes` counter, then add two
assertions using the existing `mounted`/`render` machinery: unmount a run route and assert
`closes === 1`; and render at a run route, then re-render the same root at a non-run route, and
assert the socket closed and no replacement was constructed. Both are three lines against the
instrument that already exists.

---

## Nits

### N-1 — the two `app.tsx` effects have mismatched dependency sets, so a controller can be created and never connected

`apps/web/src/app.tsx:110,118`

```ts
}, [handle !== undefined, socketFactory]);   // creates the controller
}, [handle, pageOrigin]);                    // connects it
```

The first effect re-runs when `socketFactory`'s identity changes; the second does not. If
`socketFactory` changes while `handle` stays the same, effect 1 disposes the old controller and
builds a new one, effect 2 does not fire, and **the replacement is never connected** — leaving the
region at `idle`, which `canRetry` (`connection-state.ts:126`) reports as offering no Retry. An
unrecoverable state with no user action, which is what AC-15 exists to forbid.

Not reachable today: `main.tsx` renders `App` with no `socketFactory`, and a props object is stable
across state-driven re-renders, so the tests do not hit it either. But `AppProps` is **exported**
and `socketFactory` is documented as the injection seam, and the idiomatic call — an inline arrow,
which is exactly what `shell.test.ts:281` writes — is what trips it. Worth closing while the
coupling is one line rather than after a consumer finds it.

**Recommendation.** Either key both effects on the same thing (drop `socketFactory` from effect 1 and
read it from a ref, since it is an injection seam rather than a value the connection depends on), or
merge the two into one effect keyed on `[handle, pageOrigin, socketFactory]` and let `connect` do the
replacement it already does. The comment at `:96-99` explains why the boolean is deliberate; what it
does not cover is what happens when the *other* dependency moves.

### N-2 — a protocol error leaves the socket open, and is then overwritten

`apps/web/src/run-connection.ts:121-127` · `apps/web/src/connection-state.ts:86-94`

On a refused frame the controller dispatches `protocol-error` and returns — it does not close the
socket. Three consequences, none of which any test covers:

- Later frames keep being accepted, so the event count rises under a permanent "Protocol error:
  invalid-json." sentence.
- `canRetry('protocol-error')` is `true`, so a Retry button is offered over a socket that is healthy;
  pressing it tears down a working connection.
- When the run's terminal event eventually arrives, `terminalSeen` is set, and the close at `1000`
  takes the `terminalSeen` branch (`connection-state.ts:91`) → **`ended`**. The refusal is erased,
  and the user finishes at "The run has finished." with no record that a frame was refused.

AC-14 requires a refused frame be *"refused and surfaced rather than ignored"*. A surfacing that a
later close silently overwrites is, at the end of the run, ignored.

**Recommendation.** Decide the intent and write it down either way: either close the socket on a
protocol error (which makes `protocol-error` terminal and makes Retry honest), or keep the socket and
make the refusal sticky so a later `ended` still says a frame was refused. Nothing here needs a
requirement change; what it needs is the choice recorded in the module header, since today the code
reads as though the state were terminal and it is not.

### N-3 — the route-literal exception register's reason column is never asserted

`apps/web/test/routes.test.ts:63-73,196`

`EXCEPTION_REASONS` was made a `Record<string, string>` in round 1 (N-5) so that the reason is *"what
a reviewer weighs instead of re-deriving"*, and `contracts/Q-0120/live-connection.contract.md` requires
every exception to *"carry a non-empty reason"*. But only the keys are ever used —
`EXCEPTIONS = new Set(Object.keys(EXCEPTION_REASONS))` — and no assertion reads a value. Every reason
could be `''` and the suite stays green, which is the register-as-documentation failure one level
down from the one this register was created to fix.

**Recommendation.** One line beside the exercised-use assertion:
`for (const [k, v] of Object.entries(EXCEPTION_REASONS)) expect(v.trim(), k).not.toBe('')`.

### N-4 — `bypassNavigation` is new behaviour, fixing a blocker, with no test and no way to write one

`apps/web/vite.config.ts:49-50`

Round 1's B-1 found that `/runs`, `/flows`, `/history`, `/project` are matched by Vite's proxy as
**prefixes** — I confirmed this against `doesProxyContextMatchUrl` in
`node_modules/vite/dist/node/chunks/node.js:19294`, which is `url.startsWith(context)`, so `/project`
does swallow the shell's own `/projects`. `bypassNavigation` is the fix, and it is a module-local
`const` in a file no test imports. Both criteria that govern this file (AC-13's proxy clause, AC-22)
are satisfied by `readFileSync` + `toContain`, so nothing executes it.

I am **not** raising AC-13's explicit carve-out — *"The proxy's own runtime behaviour is deliberately
not claimed"* — which is correct and which this finding does not dispute. The point is narrower: the
discriminator itself is a **pure function of `(method, accept)`**, it is not proxy runtime, and the
implementation chose a shape that makes it unreachable. `.claude/rules/engineering.md`'s *"Every
behaviour change ships with a test"* reaches it.

Two things a test would have caught, both real and both minor:

- It answers only for `GET`. A `HEAD` navigation to `/projects` is proxied.
- It requires `text/html` specifically, where Vite's own SPA fallback
  (`node.js:19303`) also accepts `*/*` and an absent `Accept`. `curl http://localhost:5173/projects`
  sends `Accept: */*` and is proxied to the daemon rather than served the app — a difference from
  Vite's own rule that will read as a bug to whoever meets it.

**Recommendation.** Move the predicate next to the register it belongs with — `daemon-endpoints.ts`,
which `vite.config.ts` already imports — export it, and drive it over the four cases. That keeps
`vite.config.ts` a configuration file and costs no new module. While doing it, consider matching
Vite's own accept rule rather than a narrower one.

### N-5 — `connecting` offers no Retry and has no timeout

`apps/web/src/connection-state.ts:120-127`

A socket that neither opens nor closes — a proxy or daemon that accepts the TCP connection but never
completes the handshake, which is a plausible state while the daemon is starting — leaves the region
at "Connecting to ws://… " indefinitely, with no Retry, until the browser's own handshake timeout
fires minutes later.

This matches the requirement as written: AC-15 lists `connecting` and AC-18 enumerates the five
states that offer Retry, `connecting` not among them. So it is a gap in the requirement rather than a
deviation from it, and is registered here rather than treated as a defect. Worth stating because
AC-15's governing sentence is *"none of them is silence"*, and a state a user cannot leave is the
nearest thing to silence in the set.

### N-6 — the `harness/architecture.md` MANIFEST row names one reader and there are now two

`packages/core/src/turbo-inputs.test.ts:167`

The cache is correct — `harness/architecture.md` was already declared in
`packages/shared/turbo.json:49` by Q-0107 AC-18, so the new `docs.test.ts` read at `:74` is hashed
and nothing replays stale. What is now stale is the register's own provenance: the row still reads
*"role.test.ts — Q-0107 AC-18, the role table's third column…"*, and the MANIFEST's header calls
itself *"the call site that performs each"*. A hand-audited register whose reasons have started
drifting is one a reviewer stops trusting.

**Recommendation.** Append the second reader to that row's reason, as the neighbouring
`packages/core/src/adapters/*.ts` rows already do for their three readers each.

---

## Checked and clear

Recorded so a later round does not re-derive them:

- **Close codes** — the reducer's `1008` / `1013` / `1000` match `serve.ts:196`, `:208`, `:215`.
- **Event fixtures** — `{type:'step',stepId,message}` and the `terminal` fixture both satisfy
  `eventSchema`'s real members (`events.ts:146,199-222`).
- **`z.unknown()` in a `.strict()` object** — executed against the installed `zod@4.4.3`:
  `{type:'event'}` with no `event` key is **rejected** (`expected nonoptional`), so `WireMessage`'s
  required `event` and the `z.ZodType<WireMessage>` annotation agree, and the staged fallthrough to
  `invalid-event` is reached the way the header claims.
- **`defaultClientConditions`** — exists in `vite@8.2.2` and is
  `["module","browser","development|production"]`, so AC-22's spread is a real spread.
- **`bypass` on the WebSocket upgrade path** — Vite does call it (`node.js:19242`, with
  `res === undefined`), the one-argument signature is compatible, and browsers send no `Accept`
  header on a WS handshake, so the upgrade is proxied rather than bypassed.
- **`vite.config.ts` is typechecked and linted** — `apps/web/tsconfig.json` declares no `include`, so
  `tsc --noEmit` reaches it, and `eslint.config.js:25`'s `apps/**/*.ts` matches it. The `ProxyOptions`
  and `ProxyTargetUrl` typings are real (`vite/dist/node/index.d.ts:365,570`).
- **`./src/daemon-endpoints.js` from the config** — Vite's default `configLoader` is `"bundle"`
  (`node.js:36958`) → esbuild, which implements TypeScript's `.js` → `.ts` resolution.
- **`packages/shared/src/wire.test.ts`'s `'../test/corpus.js'` import** — permitted;
  `sharedSourceFiles()` excludes tests, and `docs.test.ts:5` is the standing precedent.
- **The `@quorum/` literal rule** — `wire.ts`'s header and `wire.test.ts`'s needle are both
  assembled, so `index.test.ts:49`'s whole-corpus scan keeps its subject.
- **The AC-12 declaration scan** — I traced `declarationBodies` over the real `ParsedFrame`,
  `FrameRefusal` and `ConnectionAction`, and over both fixture spellings of a copied union. It
  collects every union member, accepts the `Extract<WireMessage, { type: 'missed' }>` reference, and
  reports both copied forms. Round 1's M-4 and round 2's N-4 are genuinely closed.
- **The forbidden-literal scans** — `/['"`]wss?:/`, `/127\.0\.0\.1/` and `/7717/` over `apps/web/src`:
  `page.protocol.replace('http', 'ws')` spells no scheme literal, and every fixture
  (`` `${'w'+'s'+':'}` ``, `` `https:${'/'+'/'}` ``) is assembled past both these needles and Q-0014's
  whole-package one.
- **Turbo inputs** — `pnpm-lock.yaml` is declared in `packages/shared/turbo.json:11` and registered in
  the MANIFEST; every other new read is in-package and covered by `$TURBO_DEFAULT$`.
- **Lockfile slicing** — `apps/web:` is followed by `\n  packages/cli:` in the real lockfile, so
  `wire.test.ts`'s slice bounds are correct, and a missing importer fails rather than passing
  vacuously.
- **The glossary entry slice** — `\n**` correctly finds `**Containment**`; the entry is one line, the
  `< 2000` anti-over-slice clause holds, and all nine state names, the derived/never-persisted
  clauses, the *not a run state* clause and the never-silence clause are each asserted.
- **`harness/architecture.md`'s frontend correction** — asserted in both directions with a needle
  shown to match the superseded sentence in the spelling that actually shipped. Round 2's own finding
  about the backtick-tolerant needle is correctly closed.
