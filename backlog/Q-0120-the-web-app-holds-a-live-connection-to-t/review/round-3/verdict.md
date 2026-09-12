# Q-0120 — review round 3, verdict

Panel: `review/round-3/claude.md` (three majors, six nits) and `review/round-3/codex.md` (three
majors). Deduplicated against `harness/Q-0120/integration` at `53ae8c9`.

**Five majors, five nits, two observations. No blocker. Verdict: changes-requested.**

The panel agrees on one finding and disagrees about its weight; two of codex's three are things
claude did not reach; three of claude's are things codex did not reach. Every disputed claim was
executed against the branch rather than taken from either report, and that moved three of them —
one promotion, one demotion, and one prior observation closed.

**What the majors have in common is the instrument, not the change.** Four of the five are a
criterion that is met in prose, or not met at all, with a guard that cannot tell the difference:
a document-wide regex satisfied by the status line, a `toContain` satisfied by a percent-encoded
handle, a fake socket with no close record, and a test that pins the opposite of the criterion
it sits under. The fifth is a state that is surfaced and then erased. The production code is in
good shape, and the reason this is `changes-requested` is that four of its load-bearing claims
currently rest on assertions that cannot fail.

---

## Major

### M-1 — AC-23's `packages/server` clause is unmet, and both of its guard's clauses are satisfied by the status line alone

`packages/shared/src/docs.test.ts:53` · `docs/04-architecture.md:63`

*From claude M-1. Reproduced.*

AC-23 requires that `docs/04-architecture.md`'s **`packages/server` section** gain *"the one
sentence that the frame union is declared in `shared` and re-exported here, and why"*.

Printed on the branch, the `### packages/server` section at `:63` is unedited — it still describes
the bind, the routes, the refusal envelope, the three dependencies and the run host, with no
mention of where `WireMessage` lives. The sentence AC-23 asks for exists, correctly and with its
reason, but it is at `:191` in the **`apps/web`** section. A reader arriving at the section about
the package that performs the re-export learns nothing about the seam.

The guard cannot report that, because both positive clauses span the whole document:

```ts
expect(architecture).toMatch(/frame union[\s\S]*@quorum\/shared/i);
expect(architecture).toMatch(/packages\/server[\s\S]*re-export/i);
```

Executed against **line 3 alone** — the status line, with the rest of the document removed — both
return true: the Q-0120 dated entry contains *"The frame union is owned by `@quorum/shared` and
re-exported by `packages/server`"*, and `packages/server` occurs earlier in the same line from the
Q-0098 entry, so the second clause's ordering is satisfied too. The `:191` paragraph could be
deleted outright and this test stays green on a dated entry every ticket writes.

Only `:52`'s `not.toContain('There is no connection to the daemon')` has a subject here.

**Impact.** A criterion clause shipping unmet, and a guard that will go on reporting AC-23 as
satisfied whatever happens to the prose it is holding — including for the next ticket that edits
this file.

**Recommendation.** Add the sentence to `### packages/server`, and scope both clauses to that
section rather than to the file: slice from `### packages/server` to the next `### ` heading,
assert inside the slice, and assert the slice's length as an anti-over-slice clause — the shape
the glossary guard at `:60-66` already uses, for the reason its own comment records.

### M-2 — nothing proves a non-zero missed count is rendered; the assertion is satisfied by the socket URL

`apps/web/src/shell.test.ts:291`

*From claude M-2. Reproduced.*

AC-16's Test clause requires `count: 7` to **surface the number**. The only render-level check is

```ts
socket.onmessage?.({ data: JSON.stringify({ type: 'missed', count: 2 }) });
...
for (const expected of ['Connected to', '2', '3', 'step', 'implement']) expect(text).toContain(expected);
```

`text` is the whole header, and `connectionStateText` renders
`Connected to wss://page.test/runs/run%20one/events.` — the fixture handle is `run one`, which
`runEventsPath` percent-encodes to `run%20one`. **`toContain('2')` is satisfied by `%20`**,
independently of the notice; the same file asserts that encoded form reaches the header at `:340`,
so it is the same string rather than a hypothetical one. `'Connected to'` comes from the state
sentence, `'3'` from the event count, `'step'` and `'implement'` from the latest-event identity.
Delete the `missed {n}` span from `ConnectionRegion` and all five clauses still pass. The sibling
zero-case test asserts `not.toContain('missed')`, which is also green with the span gone, and
`run-connection.test.ts` proves only `snapshot.missedCount === 7` — a fact about the controller.

**Impact.** The whole rendering half of AC-16 — the notice Q-0118's `missed` envelope was built
for, and the reason this ticket consumes it — is held by nothing and can regress silently.

**Recommendation.** Drive `count: 7` and assert the phrase rather than the digit:
`expect(text).toContain('missed 7')`. `7` occurs nowhere else in that header; keep the existing
digit clauses for the event count.

### M-3 — AC-17's React half is untested, and the shell's fake socket cannot record a close

`apps/web/src/shell.test.ts:83` · `apps/web/src/app.tsx:103`

*From claude M-3. Reproduced.*

AC-17 binds three closes — *"Leaving the run route, changing the handle, or unmounting closes the
active socket"* — asserted **"over the transport's own close record"**.

`run-connection.test.ts` covers the controller: replacement closes (`:43`), a natural close that
issues no second close (`:80`), repeated retry (`:125`), idempotent dispose (`:136`). None of those
proves that `app.tsx` ever calls `dispose()`, which is the effect cleanup at `:103-109` and the one
place the route-to-controller binding lives.

No test at the React layer covers any of the three. No test navigates away from a run route, none
changes a handle within one mount, and `afterEach` unmounts and asserts nothing. It could not
assert anything if it tried, because the fake used there keeps no record:

```ts
class FakeSocket implements SocketTransport {
  ...
  close(): void {}
}
```

`run-connection.test.ts:10-11` has `closes = 0; close(): void { this.closes += 1; }` — the
recording half was written for the controller's fake and omitted from the shell's. That is
Q-0118's round-2 finding met in one file and not in the other.

**Impact.** Deleting `controller.dispose()` from the effect cleanup, or returning no cleanup,
leaves every socket a user ever opened attached for the life of the tab, with the suite green —
the leak AC-17 is entirely about, in the layer AC-17's own Test clause names.

**Recommendation.** Give `shell.test.ts`'s `FakeSocket` the same `closes` counter, then two
assertions on the existing `render`/`mounted` machinery: unmount a run route and assert
`closes === 1`; and render a run route, re-render the same root at `RAIL[0].path`, and assert the
socket closed and no replacement was constructed.

### M-4 — a protocol error is not terminal for its socket, and a later close erases it

`apps/web/src/run-connection.ts:121` · `apps/web/src/connection-state.ts:86`

*Found by both reviewers independently — claude N-2 and codex's third major — from different
starting points. **Promoted from claude's nit**, on the grounds below.*

On a refused frame the controller dispatches `protocol-error` and returns without closing or
invalidating the socket. Three consequences follow, none covered by any test:

- Later frames keep being accepted, so the event count and the missed notice keep moving under a
  permanent *"Protocol error: invalid-json."* sentence.
- `canRetry('protocol-error')` is `true` (`connection-state.ts:120-127`), so a Retry action is
  offered over a socket that is healthy, and the only action offered destroys a working connection.
- When the run's `terminal` event later arrives, `terminalSeen` is set, and the close at 1000 takes
  the `terminalSeen` branch → **`ended`**. The user finishes at *"The run has finished."* with no
  record that a frame was refused.

**Why major rather than nit.** Claude's own text concedes the outcome — *"A surfacing that a later
close silently overwrites is, at the end of the run, ignored"* — which is AC-14's *"refused and
surfaced rather than ignored"* defeated at exactly the moment it matters, and is the silence §1 of
this ticket's own requirement refuses in as many words. Two independent reviewers reaching it from
different directions is the strongest signal this repository records. And the Retry incoherence is
not an undecided intent: AC-18 lists `protocol-error` among the states that offer Retry, which is
only coherent if the connection is actually broken.

**Recommendation.** Close and invalidate the current socket when parsing fails, preserving
`protocol-error` as the rendered state — which makes AC-18's Retry honest and makes the state
terminal, as the module currently reads as though it already were. The alternative (keep the
socket, make the refusal sticky so a later `ended` still reports it) is defensible and must then
be written into the module header; what may not ship is the present shape, where the code reads
as terminal and is not.

### M-5 — the parser accepts non-text object messages, and a test pins that as intended behaviour

`apps/web/src/frame-parser.ts:50` · `apps/web/src/frame-parser.test.ts:26`

*From codex's second major. Reproduced, and kept major on a ground codex did not state.*

AC-14 says **"Text frames only."** `parseFrame` ends its input triage with

```ts
} else {
  parsed = data;
}
```

so any input that is neither a string nor one of the recognised binary shapes is treated as
already-parsed JSON. `{ type: 'event', event: {...} }` handed in as an object is therefore
**accepted as a valid frame**, and `non-text-message` is produced only for `ArrayBuffer`,
`ArrayBufferView` and `Blob`.

The production reach is nil — a browser `MessageEvent.data` is a string, a `Blob` or an
`ArrayBuffer` — and that is not why this is a major. It is a major because **the test suite pins
the violation as behaviour**:

- `:26` — `test.each(['7', -1, 1.5, Infinity])` drives `parseFrame({ type: 'missed', count })`,
  an object, so all four invalid-count rows are proven over a path no socket uses. `Infinity` is
  worse than that: `JSON.stringify({count: Infinity})` yields `null`, so that row asserts a refusal
  carrying a value **no JSON frame can carry**.
- `:30` — *"treats a non-string, non-binary input as already parsed before the object check"*
  asserts the fall-through directly.

So correcting the parser to AC-14's stated rule means **deleting an assertion rather than
satisfying one**, which is the shape this repository has ruled against repeatedly — an assertion
that codifies the opposite of its criterion makes the correct behaviour a future regression.

**Recommendation.** Refuse every non-string input as `non-text-message`, and drive the non-object
and invalid-count scenarios over JSON text: `JSON.stringify({ type: 'missed', count: -1 })`,
`'42'`, and so on. Drop the `Infinity` row or re-aim it at the `null` a real frame produces, and
retire `:30` by replacement rather than leaving it beside the fixed behaviour.

---

## Nits

### N-1 — the two `app.tsx` effects have mismatched dependency sets, so a controller can be created and never connected

`apps/web/src/app.tsx:110`

```ts
}, [handle !== undefined, socketFactory]);   // creates the controller
}, [handle, pageOrigin]);                    // connects it
```

If `socketFactory`'s identity changes while `handle` stays the same, effect 1 disposes the old
controller and builds a new one and effect 2 does not fire, so the replacement is never connected —
leaving the region at `idle`, which `canRetry` reports as offering no Retry. A state with no user
action, which is what AC-15 exists to forbid.

Unreachable today: `main.tsx` renders `App` with no `socketFactory`, and each test mounts fresh. But
`AppProps` is exported and `socketFactory` is the documented injection seam, and the idiomatic call
is an inline arrow — which is exactly what `shell.test.ts:281` writes. Worth closing while the
coupling is one line. The comment at `:96-99` explains why the boolean dependency is deliberate;
what it does not cover is what happens when the other dependency moves.

**Recommendation.** Read `socketFactory` from a ref and drop it from effect 1's dependencies, or
merge the two effects on `[handle, pageOrigin, socketFactory]` and let `connect` do the replacement
it already performs.

### N-2 — the run route's identity is the presence of a `:handle` param, so both child routes hold a socket, and nothing tests either reading

`apps/web/src/app.tsx:83`

*Codex's first major, **demoted**, with the factual half preserved.*

The claim is correct: `ROUTES` gives `:handle` to `/runs/:handle`, `/runs/:handle/gate` and
`/runs/:handle/steps/:stepId`, and `app.tsx` derives `handle` from `'handle' in rendered.params`, so
all three open and retain a socket and render a non-idle connection region. AC-15 defines `idle` as
*"every route but the run route"* and AC-20's heading says *"a non-run route still opens no
socket"*, both of which read as naming one route.

It is demoted for two reasons. The reading is **deliberate and documented in place** — the comment
at `:83-85` names the two children explicitly — and it is the reading Q-0016's gate screen and
Q-0022's step chat will need, so codex's recommended narrowing to an exact `/runs/:handle` match
would be a regression dressed as a fix. And AC-20's own *Test* clause names `RAIL[0].path` as the
discriminator, which the shipped test uses and passes.

What is genuinely owed is smaller than a rewrite: **neither reading is pinned**. No test navigates
to a child route, so a later change in either direction is invisible.

**Recommendation.** Add one test — navigate `/runs/X` → `/runs/X/gate` and assert the socket is
retained with exactly one constructed, and that the region is not idle — and say in the same place
that this is a deliberate widening of AC-15's wording. If the gate prefers the strict reading, that
is an erratum at a gate rather than a change an implementer may make on a reviewer's say-so.

### N-3 — the route-literal exception register's reason column is never asserted

`apps/web/test/routes.test.ts:73`

`EXCEPTION_REASONS` was made a `Record<string, string>` in round 1 (N-5) so the reason is *"what a
reviewer weighs instead of re-deriving"*, and the frozen contract requires every exception to carry
a non-empty reason. Only the keys are used — `EXCEPTIONS = new Set(Object.keys(EXCEPTION_REASONS))`
— and no assertion reads a value. Every reason could be `''` and the suite stays green, which is the
register-as-documentation failure one level down from the one this register was created to fix.

**Recommendation.** One line beside the exercised-use assertion:
`for (const [k, v] of Object.entries(EXCEPTION_REASONS)) expect(v.trim(), k).not.toBe('')`.

### N-4 — `bypassNavigation` is new behaviour, fixing a blocker, with no test and no way to write one

`apps/web/vite.config.ts:49`

Round 1's B-1 found the proxy contexts are matched as prefixes, so `/project` swallows the shell's
own `/projects`. `bypassNavigation` is the fix, and it is a module-local `const` in a file no test
imports; both criteria governing this file are satisfied by `readFileSync` + `toContain`, so nothing
executes it. AC-13's carve-out — *"The proxy's own runtime behaviour is deliberately not claimed"* —
is correct and is **not** disputed here: the discriminator is a pure function of `(method, accept)`,
not proxy runtime, and `.claude/rules/engineering.md`'s *"Every behaviour change ships with a test"*
reaches it. Two things a test would have caught: it answers only for `GET`, so a `HEAD` navigation
to `/projects` is proxied; and it requires `text/html` specifically where Vite's own SPA fallback
also accepts `*/*` and an absent `Accept`, so `curl http://localhost:5173/projects` reaches the
daemon rather than the app.

**Recommendation.** Move the predicate into `daemon-endpoints.ts`, which `vite.config.ts` already
imports, export it, and drive it over the four cases — keeping `vite.config.ts` a configuration
file at no cost in new modules. Consider matching Vite's own accept rule rather than a narrower one.

### N-5 — the `harness/architecture.md` MANIFEST row names one reader and there are now two

`packages/core/src/turbo-inputs.test.ts:167`

The cache is correct — `harness/architecture.md` is already declared in
`packages/shared/turbo.json:49` by Q-0107 AC-18, so the new `docs.test.ts` read is hashed and
nothing replays stale. What is stale is the register's provenance: the row still names
`role.test.ts` alone while the MANIFEST header calls itself *"the call site that performs each"*. A
hand-audited register whose reasons have started drifting is one a reviewer stops trusting.

**Recommendation.** Append the second reader to that row's reason, as the neighbouring
`packages/core/src/adapters/*.ts` rows already do for their three readers each.

---

## Observations

**`connecting` has no timeout and offers no Retry, and the code is right about it.** A socket that
neither opens nor closes — a proxy or daemon accepting the TCP connection without completing the
handshake, which is what a daemon that is starting looks like — leaves the region at *"Connecting
to ws://…"* until the browser's own handshake timeout fires. `connection-state.ts`'s `canRetry`
matches AC-18 exactly, which enumerates five retryable states and does not include `connecting`, and
AC-15 lists `connecting` in its closed set. So this is a gap in the requirement rather than a
deviation from it, and the amendment is the gate's rather than the implementer's — recorded here
because AC-15's governing sentence is *"none of them is silence"*, and a state a user cannot leave
is the nearest thing to silence in the set. Claude filed this as N-5; it is an observation rather
than a nit because there is nothing here for this change to fix.

**The merged requirement's §11 observation about `harness/flows/review.yaml` is closed.** That
document reported the `verdict` step's instruction spliced mid-sentence by Q-0117's paragraph, and
asked that it be fixed *"before this ticket reaches `review`"*. Read on `main` at this round:
`harness/flows/review.yaml:33-43` now appends the observation paragraph after a complete sentence
(*"Judge the reviews, not the code diff."*), so the clause requiring a finding on
`changes-requested` parses. It was fixed; a later round should not re-raise it from that document.

---

## Checked and clear

Recorded so round 4 does not re-derive them. Each was executed against `53ae8c9` rather than read.

- **Both reports' close-code claims** — the reducer's `1008` / `1013` / `1000` branches
  (`connection-state.ts:83-89`) match what `serve.ts` sends, and `terminalSeen` is what separates
  `ended` from `interrupted` rather than the code alone.
- **The natural-close invalidation** — round 2's M-2 fix is present at `run-connection.ts`'s
  `onclose`, and `run-connection.test.ts:80` asserts invalidating issues no second close.
- **The constructor-throws guard** (`run-connection.ts:95-107`) dispatches both `error-before-open`
  and a synthetic 1006 close, so a throwing factory cannot strand the controller in `connecting`.
- **AC-16's zero case** is covered on all three halves — `missedCount === 0` distinct from `null` at
  the controller, the event list unchanged, and `shell.test.ts:302` proving no rendered notice. Only
  the **non-zero** render is unheld, which is M-2.
- **`parseFrame` never throws** — asserted for every refusal row and for a lone surrogate.
- **The `invalid-count` unknown-key case** is stated rather than repaired, with its reasoning in
  place and the refusal name named as the thing that is wrong; that ruling stands and is not
  reopened here.
- **Claude's own verification list** — the `z.unknown()`-in-`.strict()` behaviour, Vite 8.2.2's
  `defaultClientConditions`, the `bypass` call on the upgrade path, `vite.config.ts` being
  typechecked and linted, the AC-12 declaration scan over `ParsedFrame`/`FrameRefusal`/
  `ConnectionAction`, the assembled `@quorum/` and scheme needles, the lockfile slice bounds and the
  glossary entry slice — was spot-checked and no claim in it failed.
