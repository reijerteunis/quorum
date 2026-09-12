# Review verdict — Q-0120, round 2

**Ticket:** Q-0120 — The web app holds a live connection to the daemon
**Panel:** claude (3 majors, 6 nits, 3 observations) · codex (5 majors)
**Verdict:** `changes-requested` — **0 blockers, 5 majors, 9 nits, 1 refused, 2 observations**

---

## How this was judged

Every finding below was read at `harness/Q-0120/integration` with `git show` rather than taken from
either report, and every claim in this document was re-derived there. That is not ceremony, for the
second round running: **the panel contradicted itself again on the same file.** Codex's second major
calls `apps/web/src/connection-state.ts:76` a defect; claude's *"checked and found right"* section
names the close-code precedence at the same site correct by design. Round 1 hit exactly this
collision, on exactly this line, and adjudicated it **N-2**. A judge deduplicating on titles would
have propagated one of the two and never noticed the other existed — which is the argument for the
verdict step being a step rather than a merge, made twice now by the same line of code.

**Two of codex's five findings had already been ruled**, and both rulings were read before they were
weighed rather than after. Its parser finding is the subject of erratum **E-3(c)**, a landed
ruling that `parseFrame`'s third branch is *stated, not invented*; it is **refused** below rather
than downgraded, because a review may not re-open a landed erratum. Its close-handling finding is
round 1's **N-2**, adjudicated and handed to the fan-out as a nit; it is carried as a nit again, and
the escalation from nit to major against a subject that has not moved is the shape *"a criterion's
*Test:* clause bounds the instrument"* (Q-0067 E-1) refuses.

**The reviews were again not comparable in reach.** Claude read the tests, the guards, the manifests,
the shared package and zod's own declaration files, and verified the round-1 fixes it did not need to
report. Codex read three files under `apps/web/src`, named no test, no register, nothing under
`packages/` and nothing about what round 1 had owed. Two of its three surviving contributions are
real and one of them — the naturally closed socket — is a clause of AC-17 that claude read past.

**Nothing below is a red test**, and both reviewers established that from the artifact rather than
from a claim. Every finding is an unmet criterion, an unmet gate exemption, or a guard weaker than it
reads.

---

## What this round delivered, and what it did not

Recorded first because it is the most useful thing in this document. Erratum **E-4** handed the
development round eleven findings. Measured at the tip:

| round 1 | status at the tip |
| --- | --- |
| **B-1** — the dev proxy swallows seven of twelve routes | **fixed.** `vite.config.ts:51`'s `bypassNavigation` returns `/index.html` for a `GET` whose `Accept` carries `text/html`, contexts still derived from `DAEMON_ENDPOINTS`. One of the two shapes round 1 recommended, and the one that closes all seven rows at once. |
| **B-2** — the connection region is silent off a run route | **behaviour fixed, guard missing.** `app.tsx:120` composes an idle `ShellConnectionProps` unconditionally, so the region always renders. The one-line assertion E-4 exempted was not added — see **M-5**. |
| **M-1** — the state renders kebab-case and `no daemon` never names the URL | **not fixed.** See **M-1** below; both round-2 reviewers found it independently. |
| **M-2** — the proxy port is not read from the environment | **fixed.** `vite.config.ts:46` is `Number(process.env.QUORUM_DAEMON_PORT ?? 7717)`, no test reads it. |
| **M-3** — a same-handle navigation discards the trace | **fixed.** `app.tsx:117`'s dependency is `[handle, pageOrigin]`, which is exactly what `runEventsUrl` consumes. |
| **N-1** — the parser accepts a pre-parsed value | **ruled** by E-3(c). Residual JSDoc half still owed; folded into **N-8**. |
| **N-2** — any close after a terminal event is `ended` | **not fixed**, in either of the two directions round 1 offered. See **N-1**. |
| **N-4** — the `Q-0014 codes against` sentences | **not fixed.** See **N-3**. |
| **N-6** — the accepted-event list is copied per event | **not fixed**, and not annotated either. See **N-2**. |
| M-4, M-5, N-3, N-5 | fixed by hand at the gate, per E-4. Verified: the statement walk, the hoisted `FakeSocket` and factory guard, the 659-character glossary slice, and the reasoned exception register are all in place. |

So **five of the eleven arrived and four did not**, and the four that did not are the four this round
re-reports. One of them — M-1 — has a structural reason it could not arrive, stated under that
finding.

---

## Majors

### M-1 — the connection region renders a state token, not plain language, and `no daemon` never names the URL

`apps/web/src/shell.tsx:102` · **found independently by both reviewers** (claude M-2, codex major 1)
· **this is round 1's M-1, unfixed**

```tsx
<span className="text-idle" title={text}>{snapshot.state.kind}</span>
```

What a user sees is `no-daemon`, `no-such-run`, `protocol-error`, `live`. The sentence
`connectionStateText` produces — `Could not reach the daemon at wss://…/runs/…/events. Is it
running?` — is put in a `title`, which is not the page's text, is unreachable from a keyboard that
never hovers, and does not exist on touch. `ShellConnectionProps.text` is composed at `app.tsx:120`
and consumed by that attribute alone, so the whole plain-language layer is unrendered.

AC-15 requires each state to render *"in plain language"* and **no daemon** to name *"the URL the
client requested"*; the `adopter` story asks for the app to tell them the daemon is not answering
*"and names the URL it asked for"*. Neither holds. The load-bearing pair — *no daemon* is "start the
daemon", *no such run* is "that handle is wrong" — reaches the user as two hyphenated identifiers.

**The test still pins the wrong half.** `shell.test.ts:282` asserts `toContain('live')`, and
`connectionStateText({kind:'live', …})` returns `Connected to …`, which contains no occurrence of
the word `live`. The assertion passes *because* the kebab token is what renders.

**Why it did not arrive, which the next gate needs rather than another round.** E-4 exempted one
test addition for this finding — *"asserting over the rendered region that `no-daemon` names the
requested URL"* — and exempted nothing else. Fixing the render turns `shell.test.ts:282` red, and
`shell.test.ts` is a file `development.yaml` forbids every task to modify. **So the finding as
assigned was not deliverable**: the implementer could either leave the render wrong or break a test
it may not repair. Handing it to the loop again unchanged repeats that. The exemption must be
widened to cover re-aiming `:282`, or the pair fixed by hand.

**Recommendation.** Render `text` as the region's visible content and keep `state.kind` as a
`data-state` attribute if a machine-readable hook is wanted. Then re-aim `:282` at the sentence and
add E-4's owed assertion: `no-daemon` contains the requested URL, `no-such-run` produces a different
sentence.

---

### M-2 — a naturally closed socket stays current, and its callbacks can still mutate state

`apps/web/src/run-connection.ts:110` · codex major 3 · **new; claude read the neighbouring mechanism
and recorded it correct, which it is**

```ts
next.onclose = (closeEvent) => {
  if (socket !== next) return;
  dispatch({ type: 'close', code: closeEvent.code, reason: closeEvent.reason });
  notify();
};
```

The handler neither nulls `socket` nor detaches the transport. Every other path invalidates —
`connect()` and `retry()` both call `closeCurrentSocket()`, which nulls `socket` *and*
`detachAndClose`s, and `dispose()` does the same — so a **superseded** socket is inert by two
mechanisms, exactly as claude reports. A socket that closed **on its own** is inert by neither:
`socket === next` still holds, so a later `message` appends events or replaces `missedCount`, and a
later `close` overwrites the rendered state.

AC-17 names all three cases in one sentence: *"Once a socket is **superseded, closed or disposed**,
none of its `open`, `message`, `error` or `close` callbacks may change connection state, accepted
events or the incomplete-replay notice."* The middle one is unimplemented. The frozen contract's
*Lifetime* paragraph says only *"Disposed or superseded"*, which is how the gap survived solutioning;
the criterion is the wider of the two and it governs.

**And no test reaches it.** `run-connection.test.ts:44` and `:96` drive late callbacks only after a
**replacement**. AC-17's *Test:* clause puts the whole criterion on a fake transport, which is the
one place this case is reachable at all — a real `WebSocket` delivers nothing after `close`, so the
honest statement of impact is that the invariant is unmet and the browser cannot currently exhibit
it. That is worth a major because the invariant is what the next consumer will rely on: Q-0015 reads
this same snapshot, and Q-0121 will hold several controllers at once.

**Recommendation.** Invalidate in the close handler without closing again — null `socket` after
dispatching, or detach the four handlers — and add the late-callback case after a **natural** close
beside the existing replacement case.

---

### M-3 — the anti-inert guard cannot match the sentence it forbids

`packages/shared/src/docs.test.ts:82` · claude M-1 · **verified independently**

```ts
expect(repoFile('harness/architecture.md')).not.toMatch(/frontend(?:`)? and data remain inert/i);
```

The sentence on `main` is, byte for byte at `harness/architecture.md:108`:

```
`frontend` and `data` remain inert. `apps/web` exists since Q-0008, but `packages/ui`,
```

The needle tolerates one optional backtick after `frontend` and then requires the literal
`` and data remain inert``; the text has backticks around `data` that the pattern cannot consume.
Measured rather than reasoned about — `git show main:harness/architecture.md | grep -cE 'frontend`?
and data remain inert'` answers **0**. So the assertion is green over the *unchanged* file: green on
`main`, green on the branch, and green on any tree where the correction was reverted.

The documentation edit itself is correct and shipped (`architecture.md:108` now reads *"`frontend` is
active for `apps/web`; `data` remains inert"*). What is missing is any means of keeping it, and
AC-23's clause for that sentence is the one clause in the criterion whose subject is a **harness
context file** — *"that file is fed to the architect on every run, so a stale sentence there is one
every future solution inherits"*. *"A check is not established by reading it"* (2026-08-29), in the
guard added to enforce the correction.

**Recommendation.** Anchor on what the file says — a backtick-tolerant needle, demonstrated red
against `main`'s text before it is trusted — and add the positive half, that the file now names
`frontend` as active, so the clause fails in both directions. Claude checked the two neighbouring
clauses and they do have subjects; I did not re-derive that.

---

### M-4 — the forbidden-literal scan proves nothing about itself

`apps/web/test/daemon-endpoints.test.ts:38` · claude M-3 · **verified**

```ts
const forbidden = [/['"`]wss?:/, /127\.0\.0\.1/, /7717/];
const walk = (dir: string): string[] => …;
for (const source of walk(path.join(ROOT, 'src'))) {
  for (const needle of forbidden) expect(needle.test(source)).toBe(false);
}
```

No assertion that the walk found anything, and no fixture showing that any of the three needles
fires. An empty walk — a filter added, a directory renamed, a `flatMap` that stops descending —
skips every assertion and reports success, and a mistyped pattern is indistinguishable from a clean
tree. AC-13's *Test:* clause names the missing half in as many words: *"a scan over `apps/web/src`
for the forbidden literals **with a positive control that it found source**."*

Every sibling scan in this package already carries both halves — `test/source.test.ts:216`'s
`names.length > 5` and its per-needle fixture at `:250`, `test/package.test.ts:111`'s `files.length
> 1` and its credential demonstration at `:122`, `test/routes.test.ts:171`'s dedicated *"the scan
finds component files at all"*. This file is the exception, and it is the file this ticket added.

Supporting rather than a second demand, and raised as context for choosing fixtures only: the needle
set is narrower than AC-13(a)'s normative half, which forbids *"no absolute URL, hostname, port,
`ws:` or `wss:` literal"* — `localhost` and any port other than `7717` pass. The *Test:* clause
bounds the instrument and I am not raising the job it gives it (Q-0067 E-1).

**Recommendation.** `expect(sources.length, 'the walk found no source — this scan proves nothing')
.toBeGreaterThan(5)` and one discriminating fixture per needle, in the shape `source.test.ts:250`
already uses, with the fixture's own literals assembled so the scan does not become its own subject.
Carry the file name into the assertion message; `expect(needle.test(source)).toBe(false)` names
neither the file nor the needle when it fails.

---

### M-5 — both of E-4's exempted assertions are missing, so a fixed blocker is guarded by nothing

`apps/web/src/shell.test.ts:259` · **raised by neither reviewer**

E-4 granted exactly two exemptions from the no-tests rule, *"for this round only, because the
criterion they serve is unmet without them and the assertion is one line each"*:

> restoring the idle-region assertion at `RAIL[0].path` (B-2) and asserting over the rendered region
> that `no-daemon` names the requested URL (M-1).

Neither is in the file. `shell.test.ts` contains no occurrence of `idle`, `Not connected`,
`no-daemon` or `requestedUrl`, and the AC-20 describe at `:259` asserts only that a non-run route
constructs no socket and that a run route's header carries five substrings.

B-2 was a **blocker** — the region silent on nine of twelve routes, which round 1 scored above major
because it made the shipped app worse than `main`. Its behaviour is now right, at `app.tsx:120`. Its
check is still the one round 1 described as *"removed rather than replaced"*: AC-9's
`occurrences(text, NOT_LOADED) === TOP_BAR_REGIONS.length` is blind to the connection region by
construction, so returning `connection` to `undefined` at `app.tsx:120`, or restoring
`shell.tsx:132`'s `null` branch as the live path, is green everywhere.

The second exemption is M-1's and is unwritable until M-1's render is fixed; it is listed here so the
gate rules both at once rather than discovering the second after the first lands.

**Recommendation.** Add the B-2 assertion now — at `RAIL[0].path` the header contains
`connectionStateText({ kind: 'idle' })` — and demonstrate it red by reverting `app.tsx:120` to the
optional form. Add M-1's with M-1's fix.

---

## Nits

### N-1 — any close after a terminal event is `ended`, and the test name claims otherwise

`apps/web/src/connection-state.ts:76` · *codex raised this as a major; **round 1 already adjudicated
it as N-2** and the escalation is not upheld* · **unfixed from round 1**

```ts
if (machine.terminalSeen) return { ...machine, state: { kind: 'ended' } };
```

Codex is literally right that the frozen contract's clause 3 says *"a **normal** close after an
accepted terminal event"* and the code ignores the code. Claude's position — the same as round 1's —
is that AC-15's *Test:* clause endorses the shipped reading (*"`ended` asserted to require a
`terminal` event rather than a close code alone"*) and that no false claim reaches the user: a
terminal event means the stream completed, so a 1006 after it lost nothing and *"The run has
finished."* is true, while the `interrupted` codex wants would imply an incomplete trace. **Neither
the criterion's enumeration nor the contract's covers an abnormal close after a terminal event** —
clause 3 is normal-after-terminal and clause 4 is anything-before-terminal — so this is a gap being
filled, not a clause being broken. It stays a nit.

What is sharper than either report, and is new: `connection-state.test.ts:29` is named **`'only a
normal close after a terminal event is ended'`** and asserts neither half of that "only" — its two
cases are terminal+1000 → `ended` and no-terminal+1000 → `interrupted`. A test name that claims a
property the test does not check is this repository's most-recorded class, and it is the concrete
thing to repair.

**Recommendation, unchanged from round 1 and now owed twice.** Move one of the two: the reducer
requires the normal code, or clause 3 and AC-15's fourth precedence line say *any* close after a
terminal event. The test name moves with whichever. The contract file is the branch's own, not a
criterion, so no erratum is owed for the second route — but the test name is a test file, so see the
partition below.

### N-2 — the accepted-event list is copied per event

`apps/web/src/run-connection.ts:98` · **round 1's N-6, unfixed; claude round 2 filed it as an
observation, which it is not**

`events = [...events, result.frame.event];` is quadratic on a stream whose whole purpose is to be
long. It is a nit and not an observation because it is a claim about code this change introduced —
*"A finding is a claim about the change; anything else is an observation"* (2026-09-11) — and
round 1 classified it as one and assigned it. Round 1's own remedy included the do-nothing branch:
*"either push into a mutable array and hand out a frozen view, or leave it deliberately — but say so
rather than let it surface later."* Neither was done; there is no note. AC-19 correctly asks for
memory only and not for a cap, so the cap question is genuinely not this ticket's (see the
observations).

### N-3 — the sentence that caused the drift is still in place

`packages/server/src/wire.ts:4` and `packages/server/src/index.ts:31` · claude N-4 · **round 1's
N-4, unfixed**

*"Kept apart from `http.ts` so the contract Q-0014 codes against can be read without reading the
routing"*, and *"Q-0014 codes against {@link WireRefusal}, {@link WireRun} and {@link WireMessage},
which is why the wire shapes are on this surface."* Both are now false twice over: Q-0014 codes
against none of them, Q-0120 codes against `WireMessage` alone, and `WireMessage` can no longer *be
read* in `wire.ts`, being a bare re-export. This is the sentence the ticket body names as the
**cause** — *"an implementer copies the interfaces into the app, the drift arrived at by obeying the
sentence forbidding it"* — and §0.17 sends Q-0015's or Q-0121's implementer to the same file for the
other two shapes. The solution gave `packages/server/src/wire.ts` to `backend-wire-schema` with the
orphaned-JSDoc repair named; `index.ts` has no owner and is a gate repair.

### N-4 — `declarationBodies` over-runs past an interface

`apps/web/test/source.test.ts:73` · claude N-1

The statement walk breaks at the first `;` at depth zero after the head. An `interface` body is not
followed by a `;`, so after collecting its own body the loop keeps scanning and collects the next
`{ … }` it meets. It can only over-report, never under-report, so no re-declaration escapes — but it
makes the acceptance fixture narrower than it reads:

```ts
expect(duplicateMissedDeclarations([['separate.ts',
  "type Reference = { value: string };\nconst frame = { type: 'missed', count: 7 };"]])).toStrictEqual([]);
```

That clause is the guard's promise that a **value literal is not a declaration**, and it holds only
because the `type` alias terminates. Spelled `interface Reference { value: string }`, the same value
literal is swallowed into the interface's statement and reported — and `interface` is the likelier
spelling in `apps/web`, where `AppProps`, `ShellProps`, `SocketTransport` and `RunConnection` are all
interfaces. Stop the scan at an interface's own closing brace and add the interface spelling of the
fixture.

### N-5 — retry eligibility is asserted in one direction only

`apps/web/src/connection-state.test.ts:48` · claude N-2

Five failure states are asserted `canRetry === true`; nothing asserts `false` for `idle`,
`connecting`, `live` or `ended`. `canRetry = () => true` passes this file and the rest of the suite —
a Retry button only adds `Retry` to the header text, which no assertion forbids. The frozen
contract's clause *"only failure states offer explicit retry"* has no check behind it, and the
consequence is not theoretical: a Retry offered while `live` tears down a healthy socket and
re-accumulates the replayed prefix. The implementation is correct; the guard is one-directional. One
`false` loop beside the existing one.

### N-6 — `invalid-count` is reported for a frame whose count is valid

`apps/web/src/frame-parser.ts:59` · claude N-5

`wireMessageSchema`'s `missed` branch is `.strict()`, so `{type:'missed',count:7,extra:1}` fails the
envelope and is refused as `invalid-count` carrying `count: 7`. AC-14's closed set has no member for
an unknown key, so the mapping is forced; what is avoidable is the payload, and the rendered
sentence — *"Protocol error: invalid-count"* — for a frame whose count is fine. Re-check the count
shape before choosing the refusal, drop the `count` field when the envelope failed for another
reason, or say in one line that an unknown key lands here.

### N-7 — the `count: 0` rendering clause is asserted nowhere

`apps/web/src/shell.test.ts:282` · claude N-6

The frozen contract says of the zero case: *"it asserts `snapshot.missedCount === 0`, distinct from
`null`, and an unchanged event list; **the rendered surface shows no notice**."* The first two halves
are at `run-connection.test.ts:56–60`. The third is not: the AC-20 render drives `count: 2` only, so
`shell.tsx:103`'s `missedCount === 0 ? null : …` branch — the one clause separating *"the daemon sent
a zero, which it never does"* from *"a notice is due"* — is executed by no test. One render with
`count: 0` asserting the header carries no `missed` text.

### N-8 — five new modules ship with no module-level JSDoc

`packages/shared/src/wire.ts:1`, `apps/web/src/daemon-endpoints.ts:1`, `apps/web/src/frame-parser.ts:1`,
`apps/web/src/connection-state.ts:1`, `apps/web/src/run-connection.ts:1` · claude N-3

All five begin with an import or with a symbol comment. `.claude/rules/engineering.md` asks for JSDoc
*"on modules, exported symbols and non-obvious fields"*, and every existing module either side of
this change carries one — `packages/shared/src/events.ts`, `packages/server/src/wire.ts`,
`apps/web/src/app.tsx`, `shell.tsx`, `router.ts`, `routes.ts`.

It costs something concrete here, and **this is where round 1's N-1 residual lands**. The staged
validation ruled by E-3(c) — why `wireMessageSchema.safeParse` is called *after* the discriminant
check so four refusals stay four, and why a non-string non-binary value is treated as already parsed
— exists only in `contracts/Q-0120/live-connection.contract.md` and in an erratum, neither of which a
maintainer reading `frame-parser.ts` in six months opens. Round 1's N-1 recommended exactly this if
the door were kept, and the door was kept by ruling. One header per module: contract, plus the one
non-obvious decision, plus one line naming the authority rather than transcribing it.

### N-9 — a synchronous socket-construction failure escapes instead of producing `no-daemon`

`apps/web/src/run-connection.ts:76` · *codex raised this as a major; downgraded with the measurement*

`const next = factory(url);` is unguarded, so a constructor that throws escapes `connect()` and the
React effect, and the controller is left in `connecting` with `socket === null` and no Retry —
`canRetry({kind:'connecting'})` is `false` — which is a state AC-15 calls silence.

It is a nit rather than a major because the path is very nearly unreachable, which codex did not
measure. `defaultSocketFactory` is `new WebSocket(url)` over a URL derived from the page's own
origin, so there is no malformed URL, no blocked port and no mixed-content case: `runEventsUrl`
gives `wss:` for an `https:` page. The failure AC-15 is actually about — a daemon that is not
listening — does **not** throw; it fires `error` then `close`, and both are handled and both land on
`no-daemon`, which round 1 verified. And E-4's M-5 fix added a guard reporting any run route rendered
without a factory, so the test-side hazard is closed. Wrapping the construction and the
`runEventsUrl` call above it is still cheap and still right.

---

## Refused

**codex major 4 — *"the text-only parser accepts arbitrary non-text objects as already-parsed
frames"*** (`apps/web/src/frame-parser.ts:43`).

The behaviour is real and is **ruled**. Erratum **E-3(c)**, landed at the qa-red gate, states it in
as many words:

> Its input is `unknown`, and the branch order is: a binary message is `non-text-message`; a string
> is `JSON.parse`d and a failure is `invalid-json`; **anything else is treated as already parsed**,
> which is what `frame-parser.test.ts:26` asserts by handing it a plain object.

Round 1 reached the same place independently and recorded the measurement codex's report does not
have: a `WebSocket`'s `message.data` is `string | ArrayBuffer | Blob`, both non-string forms are
caught by `isBinaryMessage`, and **every AC-14 case that can arrive from a socket lands on the right
refusal identity**. Codex's claim that a numeric input is *"required"* to be `non-text-message`
over-reads the criterion's case (f), which is the binary one. Nothing is cast: a pre-parsed value
still runs the full non-object, discriminant, envelope and `eventSchema` chain.

A review may not re-open a landed erratum, and this one was written against a measurement rather than
a preference. The residual round 1 left — say in the module why the door exists, and that the rows
using it are unit convenience rather than wire coverage — is **N-8**. Codex's suggestion to express
the count rows as JSON text is worth having if anyone touches that table, and would also let the
`Infinity` row stand, `JSON.parse('{"count":1e999}')` yielding `Infinity`; but it edits a test file,
which is the next section's subject.

---

## Which findings the fan-out may act on

Stated here rather than left for the gate to find, because E-4 had to rule exactly this a round ago
and the rule it set has not stopped applying. `development.yaml`'s fan-out instruction is *"Do not
modify tests"*, and `qa-red`, whose `automation-qa` role owns them, consumes `solutioned` and cannot
be re-entered from `red`.

**The development round can deliver these:** M-2 (`run-connection.ts`, frontend), N-1's code half
(`connection-state.ts`, frontend), N-2 (`run-connection.ts`, frontend), N-3 (`packages/server/src`,
backend — writable since this ticket's requirements gate; `index.ts` has no task owner), N-6
(`frame-parser.ts`, frontend), N-8 (both roles), N-9 (`run-connection.ts`, frontend).

**These name test files and no development task may write one:** M-3
(`packages/shared/src/docs.test.ts`), M-4 (`apps/web/test/daemon-endpoints.test.ts`), M-5
(`apps/web/src/shell.test.ts`), N-4 (`apps/web/test/source.test.ts`), N-5
(`apps/web/src/connection-state.test.ts`), N-7 (`apps/web/src/shell.test.ts`), and N-1's test-name
half.

**M-1 is in both and is why it did not arrive.** Its production half is `shell.tsx`, which frontend
owns; its fix necessarily turns `shell.test.ts:282`'s `toContain('live')` red, and E-4's exemption
covered *adding* an assertion rather than re-aiming one. Assigning it again on the same terms asks
the loop to choose between an unfixed criterion and a test it may not repair — the seventeenth
instance of a loop handed work no agent in it can perform, and the second on this ticket.

The remedy is E-4's, applied again: fix the test-file findings by hand at the gate, or widen the
exemption in writing, and hand the round only what it can act on.

---

## Observations

`observation:` **`integrate` runs neither `typecheck` nor `lint`.** `harness/harness.yaml:42`'s
`commands.test` is `pnpm turbo run test --force --continue`, and `turbo.json:18`'s root `test` task
declares `dependsOn: ["^test"]` and nothing else. A type error or a deprecated API on this branch is
caught by CI's `workspace` job and by nothing before it. GO-7 already asks for both forced in both
environment rows; this is why it matters more than usual on a ticket that adds a package dependency
and a new `exports` consumer.

`observation:` **AC-22's instrument does not cover the site that actually failed.** The criterion's
structural assertion (`apps/web/test/package.test.ts:129`) reads `apps/web/vite.config.ts`. What
broke when `apps/web` gained `@quorum/shared` was `vitest.shared.js`'s **client** condition list —
the jsdom-environment file resolved through Vite's client pipeline and stopped loading — and it was
fixed by hand on `main` in `5b81cc4`, outside this ticket's criteria and outside this diff. AC-22 as
written would not have caught it. The two files now spell the list in opposite orders — `[...default
ClientConditions, 'quorum-source']` in `vite.config.ts:65`, `['quorum-source', ...defaultClient
Conditions]` at `vitest.shared.js:41` — which is harmless, conditions being a set, and is recorded
because `package.test.ts`'s regex pins the first spelling, so the two cannot be made to match
without moving the guard.

---

## What I verified, and what I did not

**Measured at the branch tip rather than read:** the `title` render and that
`connectionStateText({kind:'live'})` contains no occurrence of `live`, so `shell.test.ts:282` passes
only because of the shortcut (M-1); `next.onclose` nulling nothing against `closeCurrentSocket`'s two
mechanisms, and that no test drives a late callback after a natural close (M-2); the anti-inert
needle against `main:harness/architecture.md`, by `grep -c`, which answers 0 (M-3); the absence of a
length assertion or a fixture in the new scan, against the three sibling scans that have both (M-4);
that `shell.test.ts` contains no `idle`, `Not connected`, `no-daemon` or `requestedUrl`, so neither
E-4 exemption was written (M-5); the reducer's unconditional `terminalSeen` branch and its test's
name (N-1); `events = [...events, …]` (N-2); both server header sentences (N-3);
`declarationBodies`' statement scan against the interface spelling (N-4); the one-directional
`canRetry` loop (N-5); `.strict()` on both envelope branches (N-6); `count: 2` as the only rendered
missed case (N-7); the five module heads (N-8); the unguarded `factory(url)` (N-9). And, for the
delivery table: `bypassNavigation`, `Number(process.env.QUORUM_DAEMON_PORT ?? 7717)`, the
`[handle, pageOrigin]` dependency, and `app.tsx:120`'s unconditional connection.

**Checked and found correct**, recorded so a third round does not re-derive it: the 1008 → 1013 →
terminal → opened → pre-open precedence, including 1008 after an accepted terminal; `error`-then-
`close` both reaching `no-daemon` while `opened` is false; `retry()` preserving `events` and
`missedCount` where `connect()` resets them; the handle confined to one percent-encoded segment and
the scheme derived by substring replacement so no scheme literal is written under `src`;
`wireMessageSchema` as a strict discriminated union whose `event` payload stays `unknown` and is
re-checked by `eventSchema`; `packages/server`'s six no-export-surface assertions unmoved by a
type-only re-export; and E-4's four hand repairs all present.

**Not claimed.** I did not execute the suite. GO-4 (a real dev server with the daemon down and up),
GO-5 (the empty-store comparison), GO-6 (a tree with no `packages/shared/dist`) and GO-7 (both
environment rows forced) are gate measurements outside a read-only review. GO-4 is now unobstructed
by B-1 and is the one that will first exercise M-1's sentence — which is the finding it will meet
first, and the reason to fix it before the measurement rather than after.
