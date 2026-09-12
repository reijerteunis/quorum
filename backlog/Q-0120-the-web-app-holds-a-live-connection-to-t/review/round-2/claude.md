# Q-0120 — review round 2

*Reviewer: claude. Read-only. Verified against the tree at `harness/Q-0120/integration`, not against the patch text: every claim below was re-derived from the files themselves, and two of them from running the guard's own predicate over `main`.*

**Findings: 3 major, 6 nits, no blocker.** The connection machinery is sound — the parser's staging, the close-code precedence, the one-socket lifecycle, retry preservation, the same-origin URL derivation and the endpoint register all hold under inspection, and the route-literal register, the turbo input registration and the lockfile importer are each correct (see §*What I checked and found right*). Every major below is in an **instrument** or in the **rendering**, which is where this cut's defects have consistently been.

---

## Findings

| # | Severity | Site | Claim |
| --- | --- | --- | --- |
| M-1 | major | `packages/shared/src/docs.test.ts:82` | The "frontend is no longer inert" guard cannot match its own subject: it is green before and after the change |
| M-2 | major | `apps/web/src/shell.tsx:102` | AC-15's normative half is unmet — the region renders `no-daemon`, not plain language, and never names the requested URL |
| M-3 | major | `apps/web/test/daemon-endpoints.test.ts:38` | The new forbidden-literal scan has no positive control and no fixture; AC-13's *Test:* clause requires one |
| N-1 | nit | `apps/web/test/source.test.ts:73` | `declarationBodies` over-runs past an `interface`'s closing brace, so its acceptance clause is true for one spelling only |
| N-2 | nit | `apps/web/src/connection-state.test.ts:48` | `canRetry` is asserted in one direction; `canRetry = () => true` passes the whole suite |
| N-3 | nit | `packages/shared/src/wire.ts:1` and four others | Five new modules ship with no module-level JSDoc |
| N-4 | nit | `packages/server/src/index.ts:31`, `wire.ts:4` | Both headers still say Q-0014 codes against the wire shapes, and that the contract can be read in `wire.ts` |
| N-5 | nit | `apps/web/src/frame-parser.ts:59` | An extra key on a `missed` frame is reported as `invalid-count` carrying a valid count |
| N-6 | nit | contract §*Test-authoring*, `run-connection.test.ts:62` | "the rendered surface shows no notice" for `count: 0` is asserted nowhere |

---

### M-1 — major — `packages/shared/src/docs.test.ts:82`: the guard cannot match the sentence it forbids

```ts
test('the repository architecture no longer calls frontend inert', () => {
  expect(repoFile('harness/architecture.md')).not.toMatch(/frontend(?:`)? and data remain inert/i);
});
```

The sentence it is aimed at is, byte for byte on `main` (`harness/architecture.md:108`):

```
`frontend` and `data` remain inert. `apps/web` exists since Q-0008, but `packages/ui`,
```

The needle allows **one optional backtick after `frontend`** and then requires the literal `` and data remain inert``. The text has `` and `data` remain inert`` — backticks around `data` that the pattern has no way to consume. **Measured rather than reasoned about:** `git show main:harness/architecture.md | grep -cE 'frontend`? and data remain inert'` answers **0**.

So the assertion passes over the *unchanged* file. It is green on `main`, green on the branch, and green on any tree where the correction was reverted or never made. AC-23's clause — *"Where a `frontend` task lands work, `harness/architecture.md`'s `frontend` and `data` remain inert is corrected in the same change — that file is fed to the architect on every run, so a stale sentence there is one every future solution inherits"* — is the one clause in AC-23 whose subject is a **harness context file**, and it is the clause with no working check behind it.

This is *"A check is not established by reading it"* (2026-08-29) and *"a check that skips its subject must not report success"* (2026-08-25), in the file the ticket added to enforce a correction.

**Impact.** The documentation edit itself is correct and shipped; what is missing is any means of keeping it. A later edit restoring the old sentence — or an `architecture.md` rewrite that reinstates it — turns the architect's context stale again with the suite green, which is exactly the failure mode AC-23 names.

**Recommendation.** Anchor on what the file actually says, and demonstrate the guard red before trusting it: assert the absence of a needle that *does* match `main`'s text (e.g. `/remain inert/` scoped to the roles section, or the backtick-tolerant `` /`?frontend`? and `?data`? remain inert/i ``), and add the positive half — that the file now names `frontend` as active — so the clause fails in both directions. The neighbouring `/frame union[\s\S]*@quorum\/shared/i` and `/packages\/server[\s\S]*re-export/i` clauses I checked and they *do* have subjects: neither `frame union` nor `re-export` occurs anywhere in `main`'s `docs/04-architecture.md`.

---

### M-2 — major — `apps/web/src/shell.tsx:102`: the connection region renders a state token, not plain language, and never names the URL

```tsx
<span className="text-idle" title={text}>{snapshot.state.kind}</span>
```

What a user sees on a failed connection is the literal `no-daemon` (or `no-such-run`, `protocol-error`). The plain-language sentence `connectionStateText` produces — *"Could not reach the daemon at ws://…/runs/<handle>/events. Is it running?"* — is placed in a `title` attribute and rendered nowhere.

AC-15's normative half is explicit on both counts:

> Each state renders in the top bar's connection region **in plain language** … **No daemon** names **the URL the client requested** — the page's own origin and the path — and never an address it does not hold.

and the ticket's own `adopter` story:

> *I run the dev server before I have a daemon, and the app tells me the daemon is not answering **and names the URL it asked for**, instead of drawing an empty panel.*

A `title` is hover-only: unavailable on touch, invisible to a keyboard user who never hovers, and not part of the page's text. `ShellConnectionProps.text` is computed in `app.tsx:120` and consumed by nothing but that attribute, so the whole of the plain-language layer is unrendered.

**The test codifies the defect rather than catching it.** `shell.test.ts:283` asserts `text).toContain('live')`, and `connectionStateText({kind:'live', …})` returns *"Connected to …"* — which contains no occurrence of the word `live`. The assertion therefore only passes because the kebab token is what is rendered, so the suite now pins the wrong half of AC-15.

The in-code justification — *"`connectionStateText`'s sentence can carry a requested URL (percent-encoded, correctly, per AC-13), which does not belong in the page's visible text"* — is a design judgement taken against a criterion rather than under it, and the criterion anticipated the URL: it asks for it by name. A percent-encoded handle in the sentence is what a reader pastes into a terminal, which §0.7 of the merged requirement gives as the reason for naming the requested URL rather than the proxy target.

**Impact.** The one distinction the ticket calls load-bearing — *no daemon* is "start the daemon" and *no such run* is "that handle is wrong" — reaches the user as two hyphenated identifiers, and the actionable half is behind a hover. For the `adopter` story, which is running the dev server with no daemon, this is the primary output of the ticket.

**Recommendation.** Render `text` as the region's visible content and keep `state.kind` as a machine-readable hook (`data-state`, or a class) if one is wanted. Then re-aim `shell.test.ts`'s AC-20 assertion at the sentence — asserting the rendered header contains the requested URL for `no-daemon` and a *different* sentence for `no-such-run` — which is the clause AC-15's *Test:* half names and which no rendering test currently makes.

---

### M-3 — major — `apps/web/test/daemon-endpoints.test.ts:38`: the forbidden-literal scan proves nothing about itself

```ts
test('browser source contains no socket scheme, daemon hostname, or chosen daemon port', () => {
  const forbidden = [/['"`]wss?:/, /127\.0\.0\.1/, /7717/];
  const walk = (dir: string): string[] => …;
  for (const source of walk(path.join(ROOT, 'src'))) {
    for (const needle of forbidden) expect(needle.test(source)).toBe(false);
  }
});
```

There is **no assertion that the walk found anything**, and **no fixture showing that any of the three needles fires**. If the walk ever returns an empty list — a filter added, a directory renamed, a `flatMap` that stops descending — every assertion is skipped and the test reports success. And because no needle is ever shown to match, a mistyped pattern is indistinguishable from a clean tree.

AC-13's *Test:* clause names the missing half in as many words:

> a scan over `apps/web/src` for the forbidden literals **with a positive control that it found source**

Every sibling scan in this package already carries both halves and is the model: `test/source.test.ts:216` asserts `names.length > 5` before scanning and `:250` isolates each needle over a fixture; `test/package.test.ts:111` asserts `files.length > 1` and `:122` demonstrates the credential needles; `test/routes.test.ts:171` is a dedicated *"the scan finds component files at all"* test. This one file is the exception, and it is the file added by this ticket.

Supporting, not a separate demand: the needle set is also narrower than AC-13(a)'s normative half, which forbids *"no absolute URL, hostname, port, `ws:` or `wss:` literal"*. `localhost` and a bare port other than `7717` pass. I raise this only as context for choosing the fixtures — the *Test:* clause bounds the instrument and I am not raising the job it gives it (Q-0067 E-1).

**Recommendation.** Add `expect(sources.length, 'the walk found no source — this scan proves nothing').toBeGreaterThan(5)` and a discriminating fixture per needle, in the shape `source.test.ts:250` already uses — assembling the fixture's own literals so the scan does not become its own subject. Also carry the file name into the assertion message; `expect(needle.test(source)).toBe(false)` names neither the file nor the needle when it fails.

---

### N-1 — nit — `apps/web/test/source.test.ts:73`: `declarationBodies` over-runs past an interface

The statement walk breaks at the first `;` found at depth zero after the head. An `interface` body is **not** followed by a `;`, so after collecting its own body the loop keeps scanning forward and collects the next `{ … }` it meets — a function body, an object literal, anything — until a `;` turns up.

Today this is harmless in both directions (it can only over-report, never under-report: each declaration head matches independently, so a real re-declared union always gets its own body). But it makes one of the round-1 fixtures narrower than it reads:

```ts
expect(duplicateMissedDeclarations([['separate.ts',
  "type Reference = { value: string };\nconst frame = { type: 'missed', count: 7 };"]])).toStrictEqual([]);
```

That clause is the guard's promise that a **value literal** is not a declaration — and it holds only because `type Reference = … ;` terminates. Spelled `interface Reference { value: string }`, the same value literal is swallowed into the interface's statement and reported as a re-declaration. So the accepting half is proved for the alias spelling and is false for the interface spelling, which is the likelier one in `apps/web` (`AppProps`, `ShellProps`, `SocketTransport`, `RunConnection` are all interfaces).

**Recommendation.** Stop the statement scan at the interface's own closing brace — an `interface` head has exactly one body, a `type` head runs to its `;` — and add the interface spelling of the `separate.ts` fixture so the acceptance clause covers both.

---

### N-2 — nit — `apps/web/src/connection-state.test.ts:48`: retry eligibility is asserted in one direction only

```ts
for (const state of [absent, wrong, { kind: 'interrupted', … }, { kind: 'dropped' },
  { kind: 'protocol-error', … }] as ConnectionState[]) expect(canRetry(state)).toBe(true);
```

Nothing asserts `canRetry` is **false** for `idle`, `connecting`, `live` or `ended`. `canRetry = () => true` passes this file, passes `shell.test.ts` (a Retry button adds `Retry` to the header text, which no assertion forbids), and passes the rest of the suite. The frozen contract's clause — *"only failure states offer explicit retry"* — has no check behind it.

The consequence is real rather than theoretical: a Retry control offered while `live` lets a user tear down a healthy socket and, because `retry()` calls `connect`-less `open()`, re-subscribe and re-accumulate a replayed prefix. The implementation is correct; the guard is one-directional.

**Recommendation.** One `expect(canRetry(state)).toBe(false)` loop over the four non-failure kinds, beside the existing loop.

---

### N-3 — nit — five new modules carry no module-level JSDoc

`packages/shared/src/wire.ts:1`, `apps/web/src/daemon-endpoints.ts:1`, `apps/web/src/frame-parser.ts:1`, `apps/web/src/connection-state.ts:1` and `apps/web/src/run-connection.ts:1` all begin with an import. `.claude/rules/engineering.md` asks for JSDoc *"on modules, exported symbols and non-obvious fields"*, and every existing module on both sides of this change carries one — `packages/shared/src/events.ts`, `ticket.ts`, `flow.ts`, `packages/server/src/wire.ts`, `apps/web/src/app.tsx`, `shell.tsx`, `router.ts`, `routes.ts`.

It costs something concrete here. The staged-validation decision (why `wireMessageSchema` is called *after* the discriminant check, so that `non-object`, `unknown-type`, `invalid-count` and `invalid-event` stay four refusals rather than one Zod error) and the socket-lifetime invariants (detach-then-close, `socket !== next` on every callback, idempotent disposal) exist only in `contracts/Q-0120/live-connection.contract.md`, which a maintainer reading `frame-parser.ts` in six months will not open.

**Recommendation.** One header per module, contract plus the one non-obvious decision, in the style the sibling modules use — and one line naming the authority rather than a transcription of the contract, per the same rule.

---

### N-4 — nit — `packages/server/src/index.ts:31` and `wire.ts:4` still point at Q-0014

```
 * socket, and `serve` is what opens one. Q-0014 codes against {@link WireRefusal}, {@link WireRun}
 * and {@link WireMessage}, which is why the wire shapes are on this surface …
```

and, in `wire.ts`'s header:

```
 * Kept apart from `http.ts` so the contract Q-0014 codes against can be read without reading the
 * routing …
```

Both are now false twice over. Q-0014 shipped a shell that codes against none of them; Q-0120 is the consumer and it codes against `WireMessage` alone. And `WireMessage` can no longer *be read* in `wire.ts` — it is a bare `export type { WireMessage }` over an import from `@quorum/shared`.

This is worth fixing rather than leaving because **this exact sentence is why the ticket exists**: the body opens on it — *"`wire.ts`'s own header calls itself the contract Q-0014 codes against. An implementer who obeys that sentence finds it unresolvable and copies the union into `apps/web`: the drift arrived at by obeying the sentence forbidding it."* The union moved; the sentence that sent implementers to the wrong file did not.

Neither file is owned by a task in `tasks.yaml` for this purpose (`backend-wire-schema` owns `packages/server/src/wire.ts` and was told to repair the orphaned JSDoc; `packages/server/src/index.ts` has no owner at all), so this is a gate-time repair rather than a round.

**Recommendation.** In `wire.ts`, say where `WireMessage` now lives and why the re-export exists. In `index.ts`, name Q-0120 and `@quorum/shared` in place of Q-0014.

---

### N-5 — nit — `apps/web/src/frame-parser.ts:59`: an unknown key on a `missed` frame reports a valid count

```ts
if (!envelope.success) {
  return { ok: false, refusal: { kind: 'invalid-count', count: (parsed as Record<string, unknown>).count } };
}
```

`wireMessageSchema`'s `missed` branch is `.strict()`, so `{type:'missed', count:7, extra:1}` fails the envelope and is refused as `invalid-count` carrying `count: 7` — a refusal naming a field that is, in fact, valid. AC-14's closed set has no member for an unknown key, so the mapping is forced; what is avoidable is the misleading payload. The rendered protocol-error sentence would read *"Protocol error: invalid-count"* for a frame whose count is fine.

**Recommendation.** Either re-check the count shape before choosing the refusal, or drop the `count` field from the refusal when the envelope failed for a reason other than the count. A one-line comment saying an unknown key lands here would do as well and costs nothing.

---

### N-6 — nit — the `count: 0` rendering clause is asserted nowhere

The frozen contract says, of the zero case: *"it asserts `snapshot.missedCount === 0`, distinct from `null`, and an unchanged event list; **the rendered surface shows no notice**."* The first two halves are asserted at `run-connection.test.ts:62–66`. The third is not: `shell.test.ts`'s AC-20 rendering test drives `count: 2` only, so `shell.tsx:103`'s `missedCount === 0 ? null : …` branch — the one clause that distinguishes *"the daemon sent a zero, which it never does"* from *"a notice is due"* — is executed by no test.

**Recommendation.** One render with `count: 0` asserting the header carries no `missed` text, beside the existing `count: 2` case.

---

## What I checked and found right

Recorded so the next round does not re-derive it.

- **The route-literal register is exact.** I enumerated every quoted literal beginning with `/` across all seventeen files under `apps/web/src` on the branch and classified each against `registered()` ∪ `DAEMON_ENDPOINTS`. The residue is exactly the seven rows of `EXCEPTION_REASONS`, and all seven are exercised — so the widened recursive walk (`routes.test.ts:27`) and the exercised-use clause at `:194` both hold, including the newly-scanned `.ts`, `.test.ts` and `theme.css` files that the old flat `.tsx` listing never saw. `/` is registered as the redirect row, which is what keeps the assembled `'/' + '/'` needles in three test files from being reported.
- **The turbo registration is complete.** `pnpm-lock.yaml` is now collected by `pathLiterals` (Q-0108 widened the classifier to root-level files), it is declared at `packages/shared/turbo.json:12` as `../../pnpm-lock.yaml`, and the `MANIFEST` row at `turbo-inputs.test.ts:166` satisfies both clause A assertions — existence on disk and coverage by the reported input set — as well as clause B's *"this file is audited by its own lists"*.
- **`packages/shared`'s house rules survive the new module.** `wire.ts` imports only `zod`; the barrel line matches `index.test.ts:131`'s pattern; `wireMessageSchema` is on the explicit runtime register at `:140`; and the `@quorum/` ban at `:56` — which scans *every* file under `src`, tests included — is respected by both new files, `wire.test.ts` assembling its scope needle and `docs.test.ts`'s new regex carrying a backslash before the slash.
- **No type hazard in `z.ZodType<WireMessage>`.** I read zod 4.4.3's `$InferObjectOutput` and `OptionalOutSchema` out of the installed `.d.cts`: optionality is keyed on `_zod.optout === 'optional'`, which `$ZodUnknownInternals` does not set, so `z.unknown()` yields a **required** `event` key and the annotation holds. (Under zod 3's rule it would not have.)
- **The connection behaviour matches the contract.** Close precedence 1008 → 1013 → terminal → opened → pre-open is implemented and driven by value; `detachAndClose` nulls all four handlers before closing and every callback re-checks `socket !== next`, so a superseded socket is inert; `retry()` preserves `events` and `missedCount` while `connect()` resets them, which is the AC-18/AC-17 split; and `runEventsUrl`'s `page.protocol.replace('http','ws')` gives `ws:` from `http:` and `wss:` from `https:` while writing no scheme literal.
- **The shell's existing guards still have their subjects.** AC-2's throwing-`WebSocket` smoke test renders `RAIL[0].path`, where `handle` is undefined and no controller is created, so `reached === []` is an absence rather than an arrangement; AC-9's `occurrences(text, NOT_LOADED) === TOP_BAR_REGIONS.length` is unaffected by the connection region, which carries none of that string.
- **The glossary entry is scoped correctly.** The `\n**` delimiter finds `**Containment**` 662 characters later, well under the 2,000 the new guard asserts, so the anti-over-slice clause added in round 1 is live rather than nominal.

---

## Observations

Not claims about this change; recorded so they are not rediscovered at the gate.

- **`integrate` does not run `typecheck` or `lint`.** `harness/harness.yaml:42`'s `commands.test` is `pnpm turbo run test --force --continue`, and the root `test` task declares `dependsOn: ["^test"]` only. A type error or a deprecated API in this branch would be caught by CI's `workspace` job and by nothing before it. GO-7 already asks for both forced in both environment rows; this is the reason it matters more than usual on a ticket that adds a new package dependency and a new `exports` consumer.
- **AC-22's instrument does not cover the site that actually failed.** The criterion's structural assertion (`package.test.ts:129`) reads `apps/web/vite.config.ts`. What broke when `apps/web` gained `@quorum/shared` was `vitest.shared.js`'s **client** condition list — the jsdom-environment file resolved through Vite's client pipeline and stopped loading entirely — and that was fixed by hand on `main` in `5b81cc4`, outside this ticket's criteria and outside this diff. Worth knowing that AC-22 as written would not have caught it, and that the two files now spell the list in opposite orders (`[...defaultClientConditions, 'quorum-source']` here, `['quorum-source', ...defaultClientConditions]` there) — harmless, conditions being a set, but the `package.test.ts:132` regex pins the first spelling, so the two cannot be made to match without moving the guard.
- **`apps/web` holds no cap on accepted events.** `run-connection.ts:14`'s `events` array grows for the life of the route, and a retry re-appends the daemon's replayed prefix (deduplication is non-goal 7). Nothing in M3 makes that acute; Q-0015's mission control is where it stops being an in-memory list.
