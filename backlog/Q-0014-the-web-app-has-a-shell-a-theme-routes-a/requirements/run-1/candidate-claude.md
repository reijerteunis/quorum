# Q-0014 — The web app has a shell, a theme, routes and a live connection

*Requirements, run 1, candidate-claude. 2026-09-11.*

**Surfaces:** `apps/web` (new), `packages/shared` (three declarations), `eslint.config.js`,
`docs/04-architecture.md`. **Not** `packages/server`'s behaviour, `packages/core`, `harness/`,
`backlog/`, `docs/decisions/`.

---

## 0. What was measured, and where the ticket body is wrong

Everything below was run against the tree on 2026-09-11 rather than taken from the body. The body's
own measurements are confirmed; four things it does not say are load-bearing, and one thing it does
say is false in the direction that matters.

### 0.1 — Confirmed exactly

`apps/web` is six tracked files — `package.json`, `src/index.ts`, `src/index.test.ts`,
`tsconfig.json`, `vite.config.ts`, `vitest.config.js`. `src/index.ts` is
`export const name = '@quorum/web';`. `vite.config.ts` is `defineConfig({})`. The manifest declares
`lint`, `typecheck`, `test`, no `build`, and no dependencies of any kind. No `apps/web/turbo.json`
exists and root `turbo.json` names no package. `docs/04-architecture.md:22` and `:182–183` have said
React + Vite, Tailwind and the dark "ground control" theme since 2026-08-22.

### 0.2 — The body's central claim is true of existence and false of reachability

> *"The wire contract exists and is not this ticket's to invent. Q-0118 exports `WireRefusal`,
> `WireRun`, `WireMessage` … A second description of any of them here would be the copy that
> drifts."*

Measured, `packages/server/package.json` declares **no `exports`, no `main` and no `types`**, and
`grep -rn "from '@quorum/server'"` across the workspace returns nothing — **no file imports that
package by name, because none can.** Under `tsconfig.base.json`'s `moduleResolution: nodenext` a
specifier with no `exports` map and no `main` does not resolve, and that is true of a type-only
import as well: TypeScript still has to find the package before it can erase the import.

This is **verbatim the state Q-0096 measured for `@quorum/core`** — *"`packages/core` declares no
`exports`, `main` or `types`, so it is unresolvable at typecheck as well as at runtime"* — which
took six criteria to fix and split a ticket in three. And it is Q-0092's finding in the same words:
*"true of existence and false of reachability."*

**The consequence for this ticket is concrete.** An implementer handed the body as written reaches
for `import type { WireRun } from '@quorum/server'`, finds it does not compile, and writes the three
interfaces into `apps/web` — which is exactly the copy that drifts, arrived at by following the
sentence forbidding it. So *where the wire shapes live* is not a detail this ticket inherits; it is
the first thing it has to settle. §OQ-A.

### 0.3 — `.tsx` is linted by nothing

`eslint.config.js:19` is `files: ['packages/**/*.ts', 'apps/**/*.ts']`. A flat-config `**/*.ts`
pattern does not match `.tsx`, and no other config block names one. So the three rules
`harness/rules.md` states and this workspace enforces — `no-explicit-any`, `ban-ts-comment`,
`no-deprecated` — **would not reach a single line of the new UI**, which is about to be the largest
body of new source in the milestone.

That is Q-0069's failure exactly: *"`tsc --noEmit` does not error on `@deprecated` … so nobody owned
it, and `lint` and `typecheck` both reported green over 21 deprecated calls."* Here nobody would own
`any` either. `tsc --noEmit` does cover `.tsx` once `jsx` is configured, so `typecheck` is not the
gap; `lint` is, and it is silent about it. The ticket body does not mention it.

### 0.4 — `apps/web` cannot choose its own test environment

`packages/core/src/test-discovery.test.ts` asserts, for every workspace package, that its
`vitest.config.js` is byte-identical to `export { default } from '../../vitest.shared.js';`, with its
own reason: *"a package that stopped re-exporting the shared file could narrow its own collection
silently."* `apps/web` is in that set, expanded from `pnpm-workspace.yaml`. So **`environment:
'jsdom'` cannot be put in `apps/web/vitest.config.js`** without turning a landed guard red, and
`vitest.shared.js` sets no environment, so every test in this workspace runs in Node.

This decides the shape of the deliverable more than anything else in the ticket: **the shell's
structure and its connection have to be testable without a DOM**, or the ticket has to move a guard.
The criteria below take the first route — the rail, the routes, the connection state machine and the
frame parser are data and pure functions, and the components derive from them, which is the
`frame.source.test.ts` idiom (`COMMANDS` drives the frame/command rule) applied to a UI.

A related fail-open is worth recording and is deliberately not fixed here: `testFilesIn` walks for
`*.test.ts` only, while `vitest.shared.js`'s include is Vitest's default and collects `.test.tsx`.
A `.test.tsx` therefore **runs** but is invisible to the guard that checks every test file is
collected by something. Named in R-3, routed to §OQ-D.

### 0.5 — The rail is seven entries, three of which have an M3 ticket

The body says *"the design brief names eight screens and a left rail"*. The brief numbers eight
screens; `docs/04-architecture.md:183` names **nine**, listing the ticket page separately. Neither
count is the useful one, because **the rail is seven entries and they do not map onto the screens
one-to-one**:

| rail entry (design prompt, *Layout skeleton*) | screen | ticket | exists in M3? |
| --- | --- | --- | --- |
| Projects | 1, projects home | — | **no ticket at all** |
| Backlog | 2, board + ticket page | Q-0017 | yes |
| Harness | 3, harness editor | Q-0021 | **M4** |
| Flows | 4, flow editor | Q-0020 | **M4** |
| Runs | 5, mission control | Q-0015 | yes |
| History | 8, run history | Q-0018 | yes |
| Settings | — | — | **no ticket at all** |

Screens 6 (gate) and 7 (step chat) are reached from a run rather than from the rail; the gate screen
is Q-0016 and step chat is Q-0022, in M4.

**And "Projects" has no server surface and cannot acquire one cheaply.** `createDaemon` takes one
`project`, `RunHost.project` is singular, and `GET /project` answers one repository — so a projects
*grid* is not a screen this daemon can feed. That is not a defect to fix here; it is the reason the
Projects route's placeholder has to say something true rather than render an empty grid.

### 0.6 — There is no `GET /runs`, so a reloaded browser cannot find a live run

Nine routes are registered, and this is the complete set:

```
POST /runs                POST /runs/:id/gate      POST /runs/:id/stop
GET  /runs/:id/events (WS)
GET  /project   GET /tickets   GET /flows   GET /history   GET /history/:id
```

`RunHost` exposes `view(handle)` but **no enumeration**, and no route exposes even `view`. So the
only way a client learns a handle is the `201` from its own `POST /runs`. A browser that refreshes
has lost it, and `DEFAULT_RETENTION`'s late-joiner buffer is unreachable without one.

`docs/04-architecture.md:183` says *"no client-side persistence beyond UI preferences"*, which is the
sentence that would otherwise make `sessionStorage` the easy answer. So the shell can honestly offer
**attach to a run this page session started**, and nothing more, until a run listing exists. Named,
scoped out, and written up as a successor in §Appendix A rather than left in this document to
expire — three obligations in one week (Q-0110, Q-0111, Q-0112) were found living only inside a
closed ticket's prose or a source comment.

### 0.7 — There is no static serving and no CORS, which decides two things

`grep -rn 'serveStatic|cors|static'` over `packages/server/src` returns nothing, and the manifest
declares `hono`, `@hono/node-server`, `@hono/node-ws` and the two workspace packages — no CORS
middleware.

**First:** a built bundle today would be served by nothing. `docs/04-architecture.md:149–151` is
already careful about this — *"It **will** serve `apps/web`'s build output — that app has no build
task and emits nothing today"* — so a `build` task added here produces an artifact with no consumer,
which is the opposite of *"The emit serves the binary"* (2026-09-02). This is the evidence behind the
recommendation in §OQ-B.

**Second:** a browser served from Vite's dev server is a different origin from the daemon, so every
`fetch` and the WebSocket upgrade are cross-origin. There are two ways out and only one is
acceptable: adding CORS headers to an **unauthenticated loopback daemon that starts agent runs and
writes to a git repository** widens exactly the surface `BIND_HOSTNAME`'s own JSDoc refuses to widen
(*"a flag whose only use is to make the product unsafe is not a feature"*). The other is Vite's dev
proxy, which keeps the client same-origin, needs no daemon change — and leaves the client's URLs
byte-identical on the day something does serve the bundle. AC-10.

### 0.8 — `@quorum/shared` is the browser-facing package, in writing

`packages/shared/src/index.ts`'s own header:

> *"No file under `src/` reads the filesystem, spawns anything or looks at the environment — **apps/web
> will generate the flow editor's form from `flowSchema`**, so this has to be safe to put in a browser
> bundle."*

and `packages/shared/src/index.test.ts` enforces it — *"no source file imports a runtime capability
apps/web cannot have"*, plus a second clause refusing `fs.`, `process.`, `child_process` and
`require(`. So the package that can be imported from a browser already exists, is already guarded,
and already names this app as the reason. That is the ground for §OQ-A's recommendation.

### 0.9 — What would and would not move if a `build` task landed

Recorded so §OQ-B is answered on cost rather than on preference.

- `test-discovery.test.ts:271` is `expect(emittingPackages()).toStrictEqual(['packages/cli',
  'packages/core', 'packages/shared'])`, derived from which manifests declare a `build` script, and
  `PACKAGES` is sorted — so the register becomes a **four**-element list led by `apps/web`. Its own
  comment calls that *"a visible act"*, which is the guard working, not an obstacle.
- `docs/GLOSSARY.md`'s **Emitted artifact** would go false in two clauses: the emitted files are
  *"JavaScript and declaration files"* (a bundle carries no declarations) and the three emitting
  packages *"are also the **local distribution set**"* (a bundle is neither published nor installed).
  `packages/shared/src/docs.test.ts` holds four clauses of that term.
- `.gitignore` already carries `dist/`, and `packages/core/turbo.json` already declares
  `../../apps/*/package.json`, so **no new turbo input and no gitignore change is owed** — checked
  rather than assumed.
- `packages/cli/src/build.test.ts:1916`'s `dependents` register is over `DISTRIBUTION`, the three
  packed packages, so it does **not** move. Also checked.

---

## 1. Problem

The `maintainer` can start a run, watch it and answer its gate only from a terminal. Q-0013, Q-0118
and Q-0119 built the whole server side of the browser half of M3 — a run host, three POST routes, a
WebSocket carrying one event per message, and a read-only REST surface over project, backlog, flows
and history — and **nothing consumes any of it.** `apps/web` is a six-file stub whose entire content
is a string equal to its own package name.

Every M3 screen ticket (Q-0015 mission control, Q-0016 gate screen, Q-0017 backlog board, Q-0018 run
history) needs the same four things before it can render anything: a place to be mounted, a way to be
navigated to, a palette to be drawn in, and a live connection to the daemon. Four screens each
building their own is four palettes, four connection lifecycles and four answers to *what does the
browser do when the daemon is not running*. The shell is what stops that.

There is also a narrower problem the milestone will hit immediately if it is not settled now: the
browser and the daemon have to agree on shapes that, measured, **live in a package nothing can
import** (§0.2), and the new UI would be **outside the lint config's reach** (§0.3). Both are cheap
to fix in the ticket that creates the first `.tsx` file and expensive in the fourth.

---

## 2. User stories

**`maintainer`** — *I run the web app's dev server, open the browser, and see the project the daemon
has open, a rail I can navigate, and a connection indicator that tells me whether the daemon is
actually there. When it is not, the page says so and names the address it tried, instead of showing
me an empty screen I have to diagnose.*

**`maintainer`** — *I start a run from the terminal, give its handle to the browser, and the event
stream appears — including how many events I missed by arriving late, rather than a stream that
silently begins in the middle.*

**`maintainer`** — *I click a rail entry whose screen has not been built yet and am told which ticket
builds it, rather than meeting a blank panel that looks like a bug.*

**`contributor`** — *I add a component and `pnpm lint` tells me about the `any` I wrote, the same as
it would anywhere else in this workspace.*

**`adopter`** — *n/a for the screens; the cold-clone path is CLI-only and this ticket must not
lengthen it beyond the install cost recorded in R-1.*

---

## 3. Acceptance criteria

Fourteen, against the fifteen the sizing decision of 2026-08-22 puts on a ticket. It is fourteen
rather than Q-0013's eighteen because **§OQ-B's recommendation removes four** — the build task, the
emitting-set register, the glossary ruling and the `04-architecture.md` distribution-set sentence —
and because every screen is somebody else's.

Each criterion's ***Test:*** clause **bounds the instrument**. Per Q-0067 erratum E-1, a reviewer may
find that an instrument fails the job its *Test:* clause gives it, and may not raise the job.

### Scaffold and toolchain

**AC-1 — `apps/web` declares what it needs, each with a reason, and none of it is an API key path.**
The manifest gains its dependencies, and the implement report carries the one-line justification
`.claude/rules/engineering.md` requires for each. `@quorum/shared` is a **runtime** workspace
dependency (it is what parses events and wire frames). No dependency, script, environment variable,
comment or example anywhere in `apps/web` mentions or accepts an API key, a token or a credential;
the word for what authenticates an agent is **subscription**, and the browser holds none of it.
***Test:*** a test reads `apps/web/package.json` and asserts `@quorum/shared` is `workspace:*`; a
scan over every file under `apps/web` (configuration included) asserts the literals
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CODEX_API_KEY`, `apiKey` and `api_key` appear nowhere, and
asserts the scan collected more than one file so it cannot pass over an empty corpus. The
install-cost measurement is R-1's obligation, taken at the gate, and is not a test.

**AC-2 — `tsc --noEmit` covers every new file, including `.tsx`.** `apps/web/tsconfig.json` gains
what a React app needs on top of `tsconfig.base.json` — at minimum a `jsx` setting and the DOM lib —
and changes nothing the base decides: `strict` stays on, and `customConditions: ["quorum-source"]`
stays reachable so `@quorum/shared` resolves to source in the workspace.
***Test:*** `pnpm --filter @quorum/web typecheck` exits 0 over the shipped tree; and a test asserts
that `apps/web/tsconfig.json` sets neither `strict: false` nor any `strict*`-family override, so the
one property the base exists to guarantee cannot be relaxed by a local file.

**AC-3 — the lint rules this workspace enforces reach the UI.** `eslint.config.js`'s `files` covers
`apps/**/*.tsx` as well as `apps/**/*.ts`. Nothing is added to `ignores`, and no rule is added,
removed or downgraded — this criterion widens a corpus and changes no policy.
***Test:*** **demonstrated red before green.** A fixture file under `apps/web/src` containing an
explicit `any` is linted and must be reported; the same file is matched by nothing under the
pre-change `files` list, asserted over the two patterns rather than by editing the config. The before
and after halves are separate assertions, so the guard cannot pass by the new pattern matching
everything.

**AC-4 — `apps/web/vitest.config.js` is unchanged, byte for byte, and every new test runs under it.**
The shared configuration is not narrowed, widened or overridden, and `vitest.shared.js` is not
edited. The shell's structure and its connection are therefore expressed as data and pure functions
that a Node-environment test can reach.
***Test:*** `packages/core/src/test-discovery.test.ts` stays green — which is the guard, and is not
re-implemented here — and `pnpm --filter @quorum/web test` reports passing tests from more than the
scaffold's single `index.test.ts`, asserted with the file list rather than as a bare count, so the
clause cannot be satisfied by the pre-existing test alone.

### The wire contract

**AC-5 — the three wire shapes have exactly one definition in the workspace, and it is reachable from
a browser bundle.** `WireRefusal`, `WireRun` and `WireMessage` are declared in one place `apps/web`
can import, and `packages/server` continues to export them under the names Q-0118 put on its barrel.
No interface, type alias or object literal in `apps/web` restates any of their fields.
***Test:*** a source scan asserts that `condition`, `remedy` and `handle` appear in `apps/web` only
in expression position and never in a declaration (`interface`/`type`), and that the module holding
the definitions is imported both by `packages/server/src/wire.ts` and by at least one `apps/web`
source file. The scan is shown to have a subject by asserting it reports a violation over a fixture
that re-declares `WireRun`.

**AC-6 — a WebSocket frame is parsed, never cast.** Every frame the client receives is validated
before it is read: a `{type:'event'}` frame's payload goes through `@quorum/shared`'s `eventSchema`,
a `{type:'missed'}` frame's `count` is checked to be a number, and anything else is refused and
surfaced rather than ignored. *"Errors are explicit … Never default silently"* is the rule, and a
`JSON.parse` result assigned to `WireMessage` is a silent default.
***Test:*** the parser is a pure function and is driven directly with (a) a valid event frame, (b) a
valid missed frame, (c) a frame whose `type` is a third word, (d) a frame whose `event` fails
`eventSchema`, and (e) a non-object. Each of (c), (d) and (e) produces a **distinguishable** refusal,
asserted by value rather than as "not ok" — a single catch-all would satisfy a weaker assertion while
telling the user the same wrong thing three times.

**AC-7 — no file under `apps/web/src` reaches for something a browser does not have.** No import of a
`node:` specifier or a bare Node builtin, no import of `@quorum/core`, and no **value** import of
`@quorum/server`; a type-only import of the latter is permitted and is erased.
***Test:*** the shape `packages/shared/src/index.test.ts` already uses, aimed at `apps/web` — the
same builtin list, plus `@quorum/core` and a value-import check for `@quorum/server`. Asserted to
have a subject by requiring the walk to find more than a floor of source files, because every failure
mode of a walk hides files rather than inventing them.

### The shell

**AC-8 — the rail and the routes are one register, and a component may not name a route it does not
hold.** A single exported table declares every rail entry: its id, its label, its path, and whether
its screen exists. It holds the **seven** entries `docs/05-design-prompt.md`'s *Layout skeleton*
names — Projects, Backlog, Harness, Flows, Runs, History, Settings — and the router is built from it
rather than beside it.
***Test:*** a register of identities and not a count (Q-0073): the ids are asserted with
`toStrictEqual` against the seven in the brief's order; every entry's path is asserted unique; and a
source scan asserts that no route path literal appears in a component file that the table does not
hold. A count-based assertion is explicitly insufficient, because a member swapped out satisfies one.

**AC-9 — a route whose screen does not exist says so, and says what it is waiting for.** Each of the
four entries with no M3 screen renders a placeholder naming the screen, naming the ticket that builds
it where one exists (Harness → Q-0021, Flows → Q-0020), and saying plainly that it does not exist
yet. **Projects and Settings have no ticket**, and their placeholders say that rather than inventing
one; Projects additionally states that this daemon has one project open, which is what `GET /project`
can answer. No placeholder is a blank panel, a spinner or a skeleton loader — a screen that looks
like it is loading something that is never coming is the reassurance-by-silence this repository has
refused in three other surfaces.
***Test:*** each placeholder route's rendered text is asserted to contain the screen's name and a
non-empty explanation, taken from the register rather than from the component; and the two ticketless
entries are asserted **not** to contain a `Q-` id, so a later reader cannot quietly attach one
screen's ticket to another's placeholder.

**AC-10 — the client reaches the daemon same-origin, and the dev server is what bridges it.** Every
request and the WebSocket upgrade use a path relative to the page's own origin; no absolute URL,
hostname, port or `ws://` literal appears in `apps/web/src`. `apps/web/vite.config.ts` proxies the
daemon's paths — `/runs`, `/project`, `/tickets`, `/flows`, `/history` — including the WebSocket
upgrade, to a target read from configuration with a documented default. **No CORS middleware, header
or dependency is added to `packages/server`**, and `BIND_HOSTNAME` does not move.
***Test:*** a source scan over `apps/web/src` asserts no `http://`, `https://`, `ws://` or `wss://`
literal and no `127.0.0.1`/`localhost` literal outside `vite.config.ts`; a separate assertion reads
`packages/server/src/*.ts` and `packages/server/package.json` and asserts neither gained the string
`cors`. The proxy's own correctness is an integration concern and is deliberately **not** claimed by
this test — the bound is that the source is same-origin, which is what makes the eventual served
bundle work unchanged.

**AC-11 — the theme is defined once, and no component names a colour.** The ground-control palette —
near-black desaturated ground, one restrained accent, and the five status colours the brief names
(running, waiting-on-human, passed, failed, idle) — is declared in exactly one place, and every
component refers to it by name.
***Test:*** a scan over every `apps/web/src` file asserts that no hex literal, `rgb(`, `rgba(` or
`hsl(` appears outside the one palette file, with that file named as the single exemption and
asserted to exist and be non-empty; and the five status names are asserted present in it, so a
palette defining three of them fails rather than passing with a gap. Whether the mechanism is a
Tailwind theme extension, CSS custom properties or both is **not** asserted — see §OQ-C; what is
asserted is the one-definition property, which holds under any of the three.

### The connection

**AC-12 — the connection has a named state for every case, and none of them is silence.** The client
distinguishes, at minimum: *connecting*, *live*, **no daemon** (the socket could not be opened at
all), *no such run* (the daemon answered and closed with 1008), *ended* (the run finished and the
stream closed normally), and *dropped* (closed 1013 because this subscriber fell behind). Each is
rendered in the top bar; **no daemon** names the address the client tried. The distinction between
*no daemon* and *no such run* is the load-bearing one — they are "start the daemon" and "that handle
is wrong", and a single "disconnected" state tells the user neither.
***Test:*** the state machine is a pure reducer, driven directly over each transition and asserted
**by value**. The *no daemon* and *no such run* cases are asserted to produce different states and
different user-facing strings, which is the clause a single catch-all would fail. Rendering is not
asserted here — AC-8's register carries the top bar's contents.

**AC-13 — a `missed` count is reported, and a refusal is rendered by what it carries.** A
`{type:'missed', count: n}` frame is surfaced with its count and never dropped, because the whole
point of Q-0118's envelope is that a late subscriber is *told* rather than handed a truncated stream.
A refusal body is rendered from its `condition` — which is `core`'s sentence, displayed unaltered —
and its `remedy` where one is present; a `code` this client does not recognise still renders,
carrying its condition, rather than being replaced by a generic message. No ANSI escape, colour code
or vendor branching is introduced into anything that crosses the wire: the browser decides how a
thing looks (`docs/04-architecture.md:169`).
***Test:*** the refusal renderer is driven with (a) a known code carrying a remedy, (b) a known code
with `remedy: null`, and (c) an **invented** code — asserting in every case that the exact
`condition` string appears in the output, and in (c) that the unknown code did not suppress it. The
missed handler is driven with `count: 0` and `count: 7`; the second must surface the number 7.

### Documentation

**AC-14 — `docs/04-architecture.md`'s `apps/web` section describes what shipped.** The section is
rewritten from the 2026-08-22 proposal to the state after this ticket: what exists (shell, theme,
rail, routes, connection), what each rail entry is waiting for, that the app emits nothing and why,
and where the wire shapes live. Its status line gains this ticket's id and the landing date, which is
this document's convention since Q-0098. **No other numbered document changes**, and
`docs/GLOSSARY.md` gains no term — §OQ-B's recommended answer is what makes that true, and §OQ-B
records what would be owed under the other answer.
***Test:*** `packages/shared/src/docs.test.ts` gains an assertion that `docs/04-architecture.md`'s
status line contains `Q-0014` and the landing date, in the shape that file already uses for `Q-0098`;
and one anchor assertion that the `apps/web` section names the rail register by the term this ticket
ships it under. Nothing asserts the prose beyond those two anchors, because a document held against
its own paraphrase is a check with no subject.

---

## 4. Non-goals

Explicit, because a shell ticket attracts screens.

1. **Every screen.** Q-0015 mission control, Q-0016 gate screen, Q-0017 backlog board and ticket
   page, Q-0018 run history. This ticket renders a placeholder where each will go and no part of any
   of them.
2. **The M4 editors and step chat** — Q-0020, Q-0021, Q-0022 — and `quorum open`, which is M3's
   done-when and belongs with whoever serves the bundle.
3. **A `build` task and everything it would imply** — the emitting-set register, the glossary's
   **Emitted artifact** sentence, `docs/04-architecture.md`'s distribution-set paragraph, and a
   static route on the daemon. §OQ-B and §Appendix B.
4. **`GET /runs`, `GET /runs/:id` or any new server route.** §0.6, §Appendix A.
5. **Reconnecting to a run across a page reload.** Not achievable without (4), and
   `docs/04-architecture.md:183` forbids the storage workaround.
6. **Authentication, and any widening of the bind.** `BIND_HOSTNAME` does not move and no CORS
   middleware is added — §0.7.
7. **"Override with reason."** The gate answer vocabulary is exactly `advance`, `retry`, `abort`;
   `gateAnswerEnvelopeSchema` is `.strict()` over those three and `askGate` raises on anything else.
   No route, control, register entry or placeholder string in this ticket mentions an override or a
   reason field. Q-0013's §1.4 already ruled that `docs/05-design-prompt.md`'s override line is a
   **mockup brief** rather than a document promising a contract, and that ruling is inherited here
   rather than re-litigated — but the brief is this ticket's visual authority, so the exclusion is
   stated rather than assumed. Widening the envelope is Q-0016's, with an entry of its own.
8. **Multi-project anything.** The daemon is single-project by construction (§0.5).
9. **A design system, a component library, or `packages/ui`.** That package does not exist; the role
   table names it for a role whose paths are aspirational.
10. **Migrating, upgrading or reconfiguring any existing dependency**, and any change to
    `vitest.shared.js`, `tsconfig.base.json`, `turbo.json` or CI.

---

## 5. Open questions

Four. **OQ-A is blocking** — an implementer that answers it by choosing produces the drift the ticket
exists to prevent. The other three have recommendations the criteria already hold under, and each
says what moves if the gate answers otherwise.

### OQ-A (blocking) — where do the three wire shapes live? *Owner: the gate, before implementation.*

§0.2 measured that `@quorum/server` cannot be imported by name. Two answers:

**(A) Give `@quorum/server` an export surface**, mirroring `@quorum/core`'s — a `quorum-source`
condition onto `./src/index.ts` and a `default` onto `./dist/index.js`. `apps/web` then does
`import type { … } from '@quorum/server'`.
*Cost:* it is Q-0096's six criteria arriving inside this ticket, and the `default` condition would
point at a `dist/` this package has no `build` script to produce — declaring an artifact that does
not exist, which is what decision 078 rejects for the stub packages. It also leaves a value import
one keystroke away from pulling `hono`, `node:path` and `@quorum/core` into a browser bundle; AC-7 is
the guard, and a guard is weaker than an impossibility.

**(B) Recommended. Move the three interfaces into `@quorum/shared`, with a zod schema for
`WireMessage` beside them,** and have `packages/server/src/wire.ts` re-export them so Q-0118's barrel
keeps every name it exports today.
*Why:* `@quorum/shared` is already resolvable, already browser-safe by construction and already
guarded as such — and its own header **names this app as the reason** (§0.8). The three interfaces
are free of any host type: `WireRefusal` is three strings, `WireRun` is four primitives, and
`WireMessage`'s event field is `unknown`. The three **status tables** (`START_REFUSAL_STATUS` and its
two siblings) stay in `packages/server`, because they are typed against `AnswerRefusal` and
`StopRefusal` — host vocabulary — and the client reads HTTP status codes rather than a table. And
AC-6 needs a runtime **parser**, not a type: a type buys nothing against `JSON.parse`, so the schema
has to live somewhere a browser can execute it, which is `shared` by definition.
*What it touches:* `packages/shared/src/index.ts` gains one `export * from './wire.js';` line — its
`index.test.ts` pins that file to re-exports matching `/^export \* from '\.\/[a-z-]+\.js';$/`, which
`./wire.js` satisfies, and the companion "exposes every module" assertion gains the new names.
`packages/server/src/wire.ts` loses three declarations and gains a re-export.
*What it does not touch:* the dependency direction. `docs/04-architecture.md:61` forbids `shared`
importing from `server`; this is the reverse, which is the normal direction and already how
`packages/server` works.
**No decision entry is owed under either answer** — neither reverses a landed entry, and
`04-architecture.md:61` already states the boundary that (B) executes. It is a gate question rather
than an entry because *which package a cross-surface type lives in* is a boundary an implementer must
not invent.

### OQ-B — does this ticket add a `build` task? *Owner: the gate.*

**Recommended: no, and the reason is measured rather than aesthetic.** `packages/server` registers
nine routes and serves no file (§0.7), so a bundle built today has **no consumer at all** — the
precise inverse of *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02),
whose whole argument is that a non-empty `outputs` replays an *artifact* and therefore needs
something that executes it. `docs/04-architecture.md:149–151` already hedges in the same direction in
its own words.

Deferring removes four criteria, the emitting-register change, and a glossary ruling that is
genuinely unsettled: **a web bundle is not an emitted artifact as the glossary defines one** — it
carries no declarations and is neither published nor installed — so the term either widens or a third
kind is coined beside *artifact* and *binary*, and coining one means `CLAUDE.md`'s term list, which
Q-0103 erratum E-2 makes the human's to write and which no step of any flow may edit.

**If the gate answers otherwise**, §0.9 is the register of what moves, the criteria count rises to
roughly eighteen, and the ticket should be split at the build-task seam rather than run at
eighteen — which is the number Q-0013 was refused at.

### OQ-C — where does the palette live? *Owner: the gate; low stakes.*

**Recommended: CSS custom properties as the single definition, with Tailwind's theme referring to
them**, so one declaration serves utility classes and any raw CSS a chart or a trace column later
needs. AC-11 asserts the *one-definition* property and deliberately does not pin the mechanism, so
this answer can change without moving a criterion.

### OQ-D — are DOM rendering tests in scope? *Owner: the gate.*

**Recommended: no, for this ticket.** §0.4 measured that `apps/web/vitest.config.js` is pinned byte
for byte, so a DOM environment cannot be configured there; the escape hatch that does not move that
guard is Vitest's per-file `@vitest-environment` docblock, which needs `jsdom` and a testing library
as two further dependencies. The criteria above are written so the shell's *behaviour* — the
register, the parser, the reducer, the renderer — is covered without one, which is the stronger
arrangement anyway: a test asserting that a rail renders seven anchors is weaker than one asserting
the register holds seven ids and the router is built from it.
**If the gate wants DOM tests**, they are additive: two dependencies, the docblock, and R-3's
`.test.tsx` fail-open becomes worth closing in the same change.

---

## 6. Risks

**R-1 — the workspace install grows, and the cold-clone path is the workspace-local install.** React,
a Vite React plugin, Tailwind and their transitive trees land in `pnpm-lock.yaml`, and quality pillar
7's first supported path is `pnpm install && pnpm turbo run build`. Nobody has measured what this
costs. **Obligation:** record `pnpm install --frozen-lockfile` wall time and `node_modules` size from
a clean store, before and after, in the implement report. A measurement rather than a criterion
because no threshold is defensible without the first number — and an unmeasured install regression on
the cold-clone path is exactly the kind of thing four documents claimed was fine until Q-0104 ran it
on a clean machine.

**R-2 — zod enters the browser bundle.** `@quorum/shared` depends on `zod@^4`, and AC-6 makes the
client import it. That is the price of parsing rather than casting and it is the right price, but it
should be named rather than discovered: it is the app's largest dependency after React.

**R-3 — a `.test.tsx` is collected by Vitest and invisible to the guard that checks collection.**
§0.4. Fail-open, inside the guard written to close exactly that class — the `q0050.source.test.ts`
shape Q-0051 found and the `pathLiterals` shape Q-0108 found. Reported, not fixed here, routed to
§OQ-D.

**R-4 — AC-3 edits a root `globalDependency`.** `eslint.config.js` is one of four files root
`turbo.json` hashes for every task, so the change invalidates every package's cache. That is correct
behaviour and costs one full re-run; named so nobody reads a workspace-wide re-execution as a
symptom.

**R-5 — the shell will be where four later tickets are tempted to put shared state.** *"Files are the
database. The daemon holds no hidden state"* is a `core` rule, and the browser's analogue is
`docs/04-architecture.md:183`'s *"no client-side persistence beyond UI preferences"*. A connection
handle, a cached ticket list or a stale containment token in the shell would each be the UI holding
truth the files hold — and containment and push lag in particular are derived per request **by
design**, with two landed entries forbidding a stored copy. Non-goal 5 is the narrow instance; this
is the class, and it belongs in the implement report rather than being discovered at Q-0017.

**R-6 — a review round will want to raise AC-11's or AC-8's instrument.** Both assert a *property*
(one definition; the register is the source of the routes) and deliberately do not assert a
mechanism. Q-0067 erratum E-1 governs: a reviewer may find the instrument fails the job the *Test:*
clause gives it, and may not raise the job. Named in advance because that escalation has been paid
for five times in this repository.

---

## 7. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | **AC-1.** No key path, and the browser holds no credential of any kind. The daemon is unauthenticated *and* loopback-only, which is the same decision from the other side; AC-10 forbids the CORS change that would weaken it. |
| **Worktree safety** | **n/a.** Nothing in `apps/web` writes to the repository. The browser can start a worktree only through `POST /runs`, which is `core`'s path with `core`'s lock. |
| **Gate behaviour** | **Untouched, and explicitly fenced.** Non-goal 7: the vocabulary stays `advance`, `retry`, `abort`; no control or string in this ticket mentions an override; the gate screen is Q-0016's. |
| **File format and its schema** | **One addition, under OQ-A(B):** a `WireMessage` schema in `@quorum/shared`, derived from Q-0118's existing envelope rather than invented. No flow, ticket, role or manifest format moves, and no existing schema changes. |
| **Lint rules** | **AC-3**, a corpus widening rather than a policy change: `apps/**/*.tsx` joins `files`, no rule is added or downgraded, `ignores` untouched. |
| **Cold-clone impact** | **Measured rather than asserted — R-1.** The screens are not on the README path, so the first 30 minutes gain no step; what they may gain is install time, which is why the obligation is a number in the implement report. |
| **Glossary / new terms** | **None owed under the recommended answers**, and §OQ-B records the one that would be — a web bundle is not an **emitted artifact** as that term is written. |
| **Decision entry** | **None owed.** The stack is `docs/04-architecture.md:22` and `:182`'s since 2026-08-22, and Q-0118 already ruled that *executing a landed document is not changing the architecture*. Each dependency still owes its one-line justification (AC-1). |
| **Product-agnostic** | Placeholder and demo strings name no SaaS product. The design prompt's `acme-billing` is mockup data and does not ship. |
| **Cross-vendor rule** | n/a to the deliverable; satisfied by the route below. |

---

## 8. Route, and the sizing question

**Recommended route: the chore flow**, on Q-0013's GO-1 precedent. `developer-generalist` carries
`apps` in its `paths:` and `harness/architecture.md`'s role table grants it `apps/`, so no role grant
is needed and no round is spent on a correct refusal. The scaffold half is machinery by definition,
and *"a scaffold has no behaviour a test could fail on before it exists"* is the chore flow's own
stated rationale.

**The argument against is recorded rather than dismissed**, because this is the second consecutive
ticket to defer it. M2's closing measurement is that `solutioning`, `qa-red` and `development` were
exercised by four tickets, three of them M1's, while the chore route has fifty-five — so the flows
M3's feature work will use are the least exercised thing in the repository. The connection half of
this ticket (AC-6, AC-12, AC-13) **does** have behaviour a red test could fail on, which is the
strongest case yet for the full pipeline. It is deferred rather than refuted, and the gate should
take it deliberately: if not here, the next ticket with real behaviour is Q-0015, and the argument
will be one ticket older.

**On size:** fourteen criteria, against the fifteen the sizing decision puts on a ticket and the
eighteen Q-0013 was refused at. It stays at fourteen only under §OQ-B's recommended answer; if the
gate adds the build task, split at that seam rather than run at eighteen.

---

## Appendix A — successor body: the daemon reports its live runs

*Written out in full so the obligation is a ticket's worth of text at the gate rather than a sentence
in a closed document. Three obligations found in one week — Q-0110's, Q-0111's and Q-0112's — had
lived only inside a closed ticket's prose or a source comment, one of them since 2026-09-02.*

**Problem.** `RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that.
Measured over `packages/server/src`: nine routes, of which `POST /runs` is the only one that ever
tells a client a handle. So a browser that refreshes has lost every live run, and
`DEFAULT_RETENTION`'s late-joiner buffer — 500 events, built precisely for *"a browser opened after a
run began, or reopened after a refresh"* — is unreachable, because the reopened browser cannot name
the run.

**What it owes.** A `GET /runs` listing the host's live runs as `WireRun`s, and a `GET /runs/:id`
answering one. Both are reads over state the host already holds; neither adds domain logic. The open
question is whether `RunHost` gains an enumeration or the transport keeps its own index — the first
is where the state is, the second keeps the host's surface at what Q-0013 proved.

**What it must not do.** Persist a handle in the browser: `docs/04-architecture.md:183` says *"no
client-side persistence beyond UI preferences"*, and a run handle is not a preference. And it must
not report a run it cannot back — a handle whose stream has ended is `ended`, a state `RunView`
already carries, not an absence.

**Sequencing.** After Q-0014, which is what creates a browser that reloads, and before or with
Q-0015, whose mission control is the screen that is useless without it.

---

## Appendix B — successor body: the daemon serves the built web app

*The other half of §OQ-B, written out for the same reason.*

**Problem.** `docs/04-architecture.md:149–151` says the server *"will serve `apps/web`'s build
output"*, and today `apps/web` has no `build` task and `packages/server` serves no file. M3's
done-when includes `quorum open` starting the daemon and a browser, which needs both.

**What it owes.** A `build` script and task for `apps/web`; a static route on the daemon; and **the
glossary ruling this ticket deferred** — whether a web bundle is an **emitted artifact**, or a third
kind beside the artifact and the binary. The glossary as written says the emitted files are
*"JavaScript and declaration files"* and that the three emitting packages *"are also the local
distribution set"*; a bundle has no declarations and is served rather than distributed, so one of
those sentences moves whichever way it is ruled. Coining a new term means `CLAUDE.md`'s term list,
which Q-0103 erratum E-2 makes the human's to write — **so that clause is a gate obligation and may
not be a criterion**, on the 2026-08-25 rule that a requirement may not name a surface its flow
cannot write.

**What moves, measured at Q-0014's gate.** `test-discovery.test.ts:271`'s emitting register becomes
four entries led by `apps/web` (`PACKAGES` is sorted); four clauses of `docs.test.ts` hold the
glossary term. **Nothing else:** `.gitignore` already carries `dist/`, `packages/core/turbo.json`
already declares `../../apps/*/package.json`, and `build.test.ts:1916`'s dependents register is over
the three packed packages and does not move. All four checked rather than assumed.

**Read first.** *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) —
because its whole argument is that a non-empty `outputs` replays an **artifact** where the other
three tasks replay a verdict, and a bundle inherits that hazard the moment something executes it.
