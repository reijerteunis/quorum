# Q-0014 — The web app has a shell, a theme, routes and a live connection

*Merged requirement, run 1, iteration 1. 2026-09-11. Verdict: **needs-input** — three blockers in §7,
of which the first is the size.*

**Surfaces:** `apps/web`, `eslint.config.js`, `docs/04-architecture.md`, and — under the child in §5 —
`packages/shared` and `packages/server/src/wire.ts`. **Not** `packages/core`, not `packages/server`'s
behaviour, not `harness/`, not `backlog/`, not `docs/decisions/`, not `CLAUDE.md`, not `turbo.json`,
not `vitest.shared.js`, not `tsconfig.base.json`, not CI.

---

## 0. What was measured, and where each candidate is wrong

Everything below was run against the tree on 2026-09-11. Both candidates' shared measurements of the
stub are confirmed exactly: `apps/web` is six tracked files, `src/index.ts` is
`export const name = '@quorum/web';`, `vite.config.ts` is `defineConfig({})`, the manifest declares
`lint`, `typecheck`, `test`, **no `build`** and **no dependencies of any kind**, and there is no
`apps/web/turbo.json` and **no `index.html`**. `docs/04-architecture.md:22` and `:182–183` have said
React + Vite, Tailwind and the dark "ground control" theme since 2026-08-22.

### 0.1 — `@quorum/server` cannot be imported by name, so codex's AC-13 is impossible today

`packages/server/package.json` declares **no `exports`, no `main` and no `types`**, and a grep across
`packages`, `apps`, `docs`, `harness` and `.github` finds **no file that imports the package by
name** — the only occurrences are its own manifest, its own JSDoc, its own two tests and three
`.turbo` logs. Under `tsconfig.base.json`'s `moduleResolution: nodenext` a specifier with no `exports`
and no `main` does not resolve, and that is true of a type-only import as well: TypeScript has to find
the package before it can erase the import.

This is verbatim the state Q-0096 measured for `@quorum/core` — *"declares no `exports`, `main` or
`types`, so it is unresolvable at typecheck as well as at runtime"* — which took six criteria to fix
and split a ticket in three.

**The sharpest part is that Q-0118 recorded the opposite intent in two JSDocs.**
`packages/server/src/wire.ts`'s header calls itself *"the contract Q-0014 codes against"*, and the
barrel says *"Q-0014 codes against {@link WireRefusal}, {@link WireRun} and {@link WireMessage}, which
is why the wire shapes are on this surface"*. The intent is on the surface and the manifest cannot
deliver it. **Codex's AC-13 mandates the import that does not compile; claude's §0.2 caught it.**
Claude wins, and the consequence is §7's blocker B-2: an implementer handed either candidate reaches
for the import, finds it does not resolve, and writes the three interfaces into `apps/web` — which is
exactly the copy that drifts, arrived at by following the sentence forbidding it.

### 0.2 — `apps/web/vitest.config.js` is pinned byte for byte, so codex's AC-24 collides with a landed guard

`packages/core/src/test-discovery.test.ts:176` asserts, for every workspace package expanded from
`pnpm-workspace.yaml` — `apps/*` included — that its `vitest.config.js` equals
`export { default } from '../../vitest.shared.js';`, with its own stated reason: *"a package that
stopped re-exporting the shared file could narrow its own collection silently."* `vitest.shared.js`
sets no `environment`, so every test in this workspace runs in Node.

Codex's AC-24 requires DOM coverage of navigation, placeholders and theme tokens and never notices
this. **Claude noticed and over-corrected**: its OQ-D rules DOM tests out entirely, which is why its
fourteen criteria can be satisfied in full **without the application ever mounting**. Neither answer
is right. The escape hatch that moves no guard is Vitest's **per-file `@vitest-environment` docblock**
— a property of the test file, not of the configuration — so this document takes the middle: **one**
DOM smoke test (AC-2), everything else register-driven.

### 0.3 — `.tsx` is linted by nothing

`eslint.config.js:19` is `files: ['packages/**/*.ts', 'apps/**/*.ts']`, and a flat-config `**/*.ts`
pattern does not match `.tsx`. So `no-explicit-any`, `ban-ts-comment` and `no-deprecated` would reach
**no line** of the largest body of new source in the milestone. That is Q-0069's failure — *"nobody
owned it, and `lint` and `typecheck` both reported green"* — arriving on a new corpus. `tsc --noEmit`
does cover `.tsx` once `jsx` is configured, so `typecheck` is not the gap; `lint` is, and it is silent
about it. **Claude's finding; the ticket body and codex both miss it.** AC-4.

### 0.4 — a new test file must be `*.test.ts`, and a `.test.tsx` is invisible twice over

`test-discovery.test.ts`'s walk collects `*.test.ts` only, while `vitest.shared.js`'s include is
Vitest's default and **would run** a `.test.tsx`. And `packages/core/turbo.json:72–74` declares
`../../apps/*/package.json`, `../../apps/*/vitest.config.js` and `../../apps/*/**/*.test.ts` — the
third of which does not match `.tsx` either. So a `.test.tsx` runs, is invisible to the guard that
checks every test file is collected by something, **and** is an undeclared input of the task that
reads it. Claude found the first half (its R-3) and not the other two.

The cheap answer is a naming rule rather than a guard change, and it is taken: **every new test file
in this ticket is `*.test.ts`**, importing `.tsx` components where it needs one. Widening
`testFilesIn` is `packages/core`'s surface and somebody else's ticket; it is reported in §8 R-3 and
deliberately not fixed in passing.

### 0.5 — the rail is seven entries and does not map onto the screens

The ticket body says *"the design brief names eight screens and a left rail"*; `04-architecture.md:183`
lists nine items. Neither count is the useful one. `docs/05-design-prompt.md`'s *Layout skeleton* names
**seven** rail entries, and three of them have no M3 screen ticket at all:

| rail entry | screen | ticket | in M3? |
| --- | --- | --- | --- |
| Projects | projects home | **none** | no ticket exists |
| Backlog | board + ticket page | Q-0017 | yes |
| Harness | harness editor | Q-0021 | M4 |
| Flows | flow editor | Q-0020 | M4 |
| Runs | mission control | Q-0015 | yes |
| History | run history | Q-0018 | yes |
| Settings | — | **none** | no ticket exists |

The gate screen is Q-0016 and step chat is Q-0022; both are reached from a run rather than from the
rail. **Claude's table, confirmed against the brief.** Codex's route map is the better half here — it
carries the dynamic segments (`/backlog/:ticketId`, `/runs/:handle`, `/runs/:handle/gate`) that
claude's seven-entry register has nowhere to put, which leaves claude's own connection criteria with
no route to mount in.

### 0.6 — there is no `GET /runs`, so a reloaded browser cannot find a live run

Nine routes are registered and this is the complete set, read from `http.ts`, `read.ts` and `serve.ts`:

```
POST /runs   POST /runs/:id/gate   POST /runs/:id/stop   GET /runs/:id/events (WS)
GET  /project   GET /tickets   GET /flows   GET /history   GET /history/:id
```

`RunHost` exposes `view(handle)` and **no enumeration**, and no route exposes even `view`. The only way
a client learns a handle is the `201` from its own `POST /runs`, so a browser that refreshes has lost
it and `DEFAULT_RETENTION`'s late-joiner buffer — built for *"a browser reopened after a refresh"* — is
unreachable. `04-architecture.md:183` forbids the storage workaround. **Claude's finding.** It is not
fixed here; it is opened as a ticket at this gate (GO-4, Appendix A) rather than left in prose, because
three obligations in one week were found living only inside a closed ticket or a source comment.

### 0.7 — no static serving and no CORS, which decides two things

`packages/server` serves no file and declares no CORS middleware; `04-architecture.md:149–151` says so
in its own words — *"It **will** serve `apps/web`'s build output — that app has no build task and emits
nothing today."* So a bundle built now has **no consumer at all**, which is the inverse of *"The emit
serves the binary"* (2026-09-02); and a browser served by Vite is a different origin from the daemon,
so the two ways out are CORS on an unauthenticated loopback daemon that starts agent runs — which
widens exactly what `BIND_HOSTNAME`'s own JSDoc refuses to widen — or Vite's dev proxy, which needs no
daemon change and leaves the client's URLs byte-identical on the day something does serve the bundle.
**Claude's, and it decides B-3 and AC-13 on evidence rather than on preference.**

### 0.8 — `plan-backlog.test.ts` never held a `Q-0014` row

`UNCREATED` holds exactly `Q-0012`, `Q-0015`, `Q-0016`, `Q-0017`, `Q-0018`, `Q-0019`. The ticket body
says *"`plan-backlog.test.ts`'s `UNCREATED` loses its `Q-0014` row in the same change"* and codex's
AC-25 asserts it as a criterion. **Both are void:** the register was already correct when the folder
was created, and the guard's third direction — *"the register names only uncreated bullets"* — would
have gone red the moment it was not. A criterion that is already satisfied is not a criterion, and
this is the sixth consecutive ticket whose inherited measurement was wrong. Mine, not either
candidate's.

### 0.9 — what would move if a build task landed

Recorded so B-3 is answered on cost. `test-discovery.test.ts:271`'s `emittingPackages()` register
becomes a four-element list led by `apps/web`, which its own comment calls *"a visible act"*.
`docs/GLOSSARY.md`'s **Emitted artifact** goes false in two clauses — the emitted files are *"JavaScript
and declaration files"* (a bundle carries neither) and the three emitting packages *"are also the local
distribution set"* (a bundle is served, not published or installed). `.gitignore` already carries
`dist/` and `packages/core/turbo.json` already declares `../../apps/*/package.json`, so **no new turbo
input and no gitignore change is owed** — checked, not assumed.

**One distinction neither candidate drew, and it decides who may write what.** *Amending* an existing
glossary entry touches `docs/GLOSSARY.md` alone, which `developer-generalist`'s `paths:` permits.
*Coining a new term* moves `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's and
which is **not** in that role's paths. And codex's AC-22 additionally requires *"a new append-only
decision entry"*, which that role's own instructions name as the first example of `blocked`. **As
written, codex's AC-22 would stop the run** — a requirement naming a surface its flow cannot write
(2026-08-25), which this repository has now paid for four times.

---

## 1. Problem

Q-0013, Q-0118 and Q-0119 built the entire server side of M3's browser half — a run host, three POST
routes, a WebSocket carrying one event per message, and a read-only REST surface over project, backlog,
flows and history — and **nothing consumes any of it**. `apps/web` is a six-file stub whose whole
content is a string equal to its own package name.

Every M3 screen (Q-0015 mission control, Q-0016 gate, Q-0017 backlog board, Q-0018 run history) needs
the same four things before it can render anything: somewhere to mount, a way to be navigated to, a
palette to be drawn in, and a live connection. Four screens each building their own is four palettes,
four connection lifecycles and four answers to *what does the browser do when the daemon is not
running*.

Two narrower problems are cheap to fix in the ticket that creates the first `.tsx` file and expensive
in the fourth: the shapes the browser and the daemon must agree on live in a package nothing can
import (§0.1), and the new source would be outside the lint config's reach (§0.3).

## 2. User stories

**`maintainer`** — *I open the web app and see the project the daemon has open, a rail I can navigate,
and a shell that renders whether or not the daemon is running — instead of a blank page I have to
diagnose.*

**`maintainer`** — *I click a rail entry whose screen has not been built yet and am told which ticket
builds it, rather than meeting an empty panel or a spinner for something that is never coming.*

**`maintainer`** *(the child in §5)* — *I attach to a run and the stream appears, including how many
events I missed by arriving late; when it is not there the page tells me whether the daemon is down or
the handle is wrong, which are two different things I do two different things about.*

**`contributor`** — *I add a component and `pnpm lint` tells me about the `any` I wrote, the same as
anywhere else in this workspace.*

**`adopter`** — n/a to the screens; the cold-clone path is CLI-only, and what this ticket may lengthen
is the workspace install, which is R-1's measurement.

---

## 3. The cut, which is this document's central judgement

**Merged honestly, this requirement is nineteen criteria — the number Q-0013 was refused at**, and for
the same reason: reviewers find blockers faster than one loop can close them, and a bounded revise loop
exhausts on scaffolding rather than on the deliverable. Claude reaches fourteen only by deferring the
build task *and* ruling out any proof that the application mounts; codex reaches thirty by asserting
responsiveness at 320 CSS pixels, font stacks and a real-socket integration test in a package that
cannot configure a DOM.

**The seam is the shell against the live connection**, and three things argue for it rather than one:

1. **It is additive, not a redesign.** The shell ships a route that holds a run and a top-bar region
   for connection status; the child fills both. That is the test Q-0013's gate applied when it
   *refused* the single-watcher/fan-out seam — *"the fan-out is not an enhancement of single-watcher
   streaming; it is what makes single-consumer safe"* — and this seam passes it where that one failed.
2. **It is also the route seam.** The shell half is a scaffold, machinery by definition, with no
   behaviour a test could fail on before it exists — the chore flow's own stated rationale. The
   connection half has behaviour a red test can fail on, and is the first M3 work that does. M2's
   closing measurement is that `solutioning`, `qa-red` and `development` were exercised by four tickets
   in total, three of them M1's, against fifty-five chore runs — so **the flows M3's feature work will
   use are the least exercised thing in this repository**, and Q-0013 already deferred this argument
   once. §10.
3. **The blocker is confined.** B-2 — where the three wire shapes live — blocks the connection half and
   not the shell, so the shell can start the moment the cut is ruled.

**Criteria are numbered continuously across both children**, per the Q-0106/Q-0107 convention, so a
criterion keeps its name if the gate moves the cut.

| | criteria | route recommended |
| --- | --- | --- |
| **Q-0014** — the shell | AC-1 … AC-11 (eleven) | chore |
| **child** — the live connection | AC-12 … AC-19 (eight) | full pipeline, §10 |

---

## 4. Acceptance criteria — Q-0014, the shell

Each ***Test:*** clause **bounds the instrument**. Per Q-0067 erratum E-1 a reviewer may find that an
instrument fails the job its *Test:* clause gives it, and **may not raise the job**.

**AC-1 — `apps/web` declares what it needs, each with a reason, and no credential path exists.**
The manifest gains its dependencies — at minimum React, a React DOM renderer, the Vite React plugin,
Tailwind and its Vite adapter, a router or the decision not to use one, and `jsdom` for AC-2 — and the
implement report carries the one-line justification `.claude/rules/engineering.md` requires for **each**.
No dependency, script, environment variable, comment, fixture or example anywhere under `apps/web`
mentions or accepts an API key, a token or a credential.
***Test:*** a test reads `apps/web/package.json` and asserts every declared dependency appears in the
implement report's justification list; a scan over every file under `apps/web`, configuration included,
asserts the literals `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CODEX_API_KEY`, `apiKey` and `api_key`
appear nowhere, **and** asserts the scan collected more than one file, so it cannot pass over an empty
corpus. R-1's install measurement is a gate obligation and is not a test.

**AC-2 — the application mounts into a real document and renders with no daemon running.**
`apps/web` gains an `index.html` and a React entry that mounts the shell into it. One smoke test
renders the shell in a DOM and asserts it produced the rail and the top bar without throwing, **with
nothing listening on any port**. `apps/web/vitest.config.js` is unchanged **byte for byte** and
`vitest.shared.js` is not edited: the DOM comes from a per-file `@vitest-environment jsdom` docblock.
Every test file this ticket adds is named `*.test.ts` (§0.4).
***Test:*** the smoke test itself is the instrument, and `packages/core/src/test-discovery.test.ts`
stays green — which is the guard on the configuration and is not re-implemented here. A second
assertion lists the test files `apps/web` now holds and asserts every one ends `.test.ts`, so the
discovery guard and the turbo input that reads it keep their subject.

**AC-3 — `tsc --noEmit` covers every new file, `.tsx` included.**
`apps/web/tsconfig.json` gains what a React app needs on top of `tsconfig.base.json` — at minimum a
`jsx` setting and the DOM lib — and relaxes nothing the base decides.
***Test:*** `pnpm --filter @quorum/web typecheck` exits 0 over the shipped tree; and a test asserts
`apps/web/tsconfig.json` sets neither `strict: false` nor any `strict*`-family override, so the one
property the base exists to guarantee cannot be relaxed by a local file.

**AC-4 — the three lint rules this workspace enforces reach the UI.**
`eslint.config.js`'s `files` covers `apps/**/*.tsx` as well as `apps/**/*.ts`. Nothing is added to
`ignores` and **no rule is added, removed or downgraded** — this widens a corpus and changes no policy.
***Test:*** **demonstrated red before green.** A `.tsx` fixture containing an explicit `any` is asserted
to be matched by nothing under the pre-change pattern list and reported under the post-change one, as
two separate assertions over the two patterns, so the guard cannot pass by the new pattern matching
everything.

**AC-5 — no file under `apps/web/src` reaches for something a browser does not have.**
No import of a `node:` specifier or a bare Node builtin, and no import of `@quorum/core`.
***Test:*** the shape `packages/shared/src/index.test.ts` already uses, aimed at `apps/web` — the same
builtin list plus `@quorum/core` — and asserted to have a subject by requiring the walk to find more
than a floor of source files, because every failure mode of a walk hides files rather than inventing
them.

**AC-6 — the rail and the routes are one register, and no component names a route the register does not hold.**
A single exported table declares every rail entry — id, label, path, and whether its screen exists —
holding the **seven** entries `docs/05-design-prompt.md`'s *Layout skeleton* names: Projects, Backlog,
Harness, Flows, Runs, History, Settings. Beside it the route table holds the paths the shell
recognises, including the dynamic ones the screens will mount in: `/` redirecting to `/projects`,
`/backlog`, `/backlog/:ticketId`, `/harness`, `/flows`, `/runs`, `/runs/:handle`, `/runs/:handle/gate`,
`/history`, `/settings`. The router is built **from** the tables rather than beside them, and the rail
marks the entry matching the current URL as active.
***Test:*** a register of identities and not a count (Q-0073): the seven rail ids are asserted with
`toStrictEqual` in the brief's order, every path is asserted unique, and a source scan asserts that no
route-path literal appears in a component file that the tables do not hold. A count-based assertion is
explicitly insufficient, because a member swapped out satisfies one.

**AC-7 — a route whose screen does not exist says what it is waiting for and fabricates nothing.**
Each placeholder names its screen, names the ticket that builds it where one exists (Backlog → Q-0017,
Runs → Q-0015, History → Q-0018, Harness → Q-0021, Flows → Q-0020, and the gate and step-chat routes →
Q-0016 and Q-0022), and says plainly that it does not exist yet. **Projects and Settings have no
ticket** (§0.5) and their placeholders say so rather than inventing one; Projects additionally states
that this daemon holds one project, which is what `GET /project` can answer, and Runs states that the
daemon reports no run listing yet (§0.6). A placeholder presents **no** fabricated project,
subscription, run, ticket, gate or cost data, and **no** control that appears to start, stop, answer or
mutate anything. No placeholder is a blank panel, a spinner or a skeleton loader — a screen that looks
like it is loading something that is never coming is the reassurance-by-silence this repository has
refused in three other surfaces. A placeholder for a dynamic route displays the decoded segment the URL
supplied.
***Test:*** each placeholder's rendered text is asserted to contain its screen's name and a non-empty
explanation taken from the register rather than from the component; the two ticketless entries are
asserted **not** to contain a `Q-` id, so a later reader cannot quietly attach one screen's ticket to
another's placeholder; and one assertion drives a dynamic placeholder with a percent-encoded segment
and asserts the decoded value is shown.

**AC-8 — an unmatched URL is a Not found view inside the same shell.**
It names the path that was requested, offers a keyboard-reachable link to Projects, and renders inside
the rail and top bar rather than replacing them. A malformed percent-encoding reaches this view rather
than an uncaught exception.
***Test:*** driven with an unmatched path and with a malformed-encoding path; both assert the view
rendered, the shell is still present, and nothing threw.

**AC-9 — the top bar reserves its regions and asserts nothing it has not loaded.**
It carries the regions the brief names — current project, git branch, subscription status, a primary
"Run flow" control, and a connection-status region the child in §5 fills. Until their owning tickets
supply data, each data region reads a single explicit not-loaded string and the primary control is
visibly disabled. The shell **infers no value**: no project name, branch or login state is guessed,
defaulted or derived.
***Test:*** the rendered top bar is asserted to contain the not-loaded string once per data region and
the control is asserted disabled; a source scan asserts no vendor name and no product name from
`docs/05-design-prompt.md`'s mockup data appears in `apps/web/src`.

**AC-10 — the theme is defined once, no component names a colour, and nothing is fetched from a network.**
The ground-control palette is declared in exactly one file as semantic tokens — background, surface,
border, primary text, muted text, accent, and the five status colours the brief names: running,
waiting-on-human, passed, failed, idle — and every component refers to them by name. The type stack is
local: UI text and code-like identifiers use system stacks, and loading the shell makes **no**
third-party font or asset request. No decorative gradient and no glassmorphism.
***Test:*** a scan over every `apps/web/src` file asserts no hex literal, `rgb(`, `rgba(` or `hsl(`
outside the one palette file, with that file named as the single exemption and asserted to exist and be
non-empty; the eleven token names are asserted present in it, so a palette defining nine of them fails
rather than passing with a gap; and a scan asserts no `http://`, `https://` or `//fonts.` literal
anywhere under `apps/web`. **The mechanism is deliberately not asserted** — CSS custom properties,
a Tailwind theme extension, or both — see GO-5; what is asserted is the one-definition property, which
holds under any of the three.

**AC-11 — `docs/04-architecture.md`'s `apps/web` section describes what shipped.**
The section is rewritten from the 2026-08-22 proposal to the state after this ticket: what exists
(shell, theme, rail, routes, placeholders), what each rail entry is waiting for, that the app emits
nothing and why, and that the live connection is its child's. Its status line gains this ticket's id
and the landing date, the convention this document has used since Q-0098. **No other numbered document
changes and `docs/GLOSSARY.md` gains no term** — GO-3's recommended answer is what makes that true.
***Test:*** `packages/shared/src/docs.test.ts` gains an assertion that the status line contains
`Q-0014` and the landing date, in the shape that file already uses for `Q-0098`, plus one anchor
assertion that the `apps/web` section names the rail register by the term it ships under. **The
assertion lives in `packages/shared/src/docs.test.ts` and not in an `apps/web` test**, which is
measured rather than stylistic: that suite already declares `docs/04-architecture.md` as a turbo input,
where an `apps/web` test reading a repository file would earn `apps/web` its first `turbo.json` and a
`turbo-inputs.test.ts` registration for one anchor. Nothing asserts the prose beyond those two anchors,
because a document held against its own paraphrase is a check with no subject.

---

## 5. Acceptance criteria — the child, the live connection

*Written out in full so the obligation is a ticket's worth of text at the gate rather than a sentence in
a closed document. The id is the allocator's at the gate, as Q-0118's and Q-0119's were.*

**Problem.** Q-0118 shipped a WebSocket carrying one event per message, an envelope that tells a late
subscriber how many events it missed, and a refusal body carrying a code, `core`'s own condition and a
remedy. Nothing consumes any of it, and the shapes it exports cannot be imported (§0.1). Until a client
exists, `DEFAULT_RETENTION`, the 1013 backpressure close and the 1008 unknown-run close are behaviour
no test outside `packages/server` has ever exercised.

**AC-12 — the three wire shapes have exactly one definition, and it is reachable from a browser bundle.**
`WireRefusal`, `WireRun` and `WireMessage` are declared in one place `apps/web` can import, a runtime
schema for the envelope sits beside them, and `packages/server` continues to export every name
Q-0118's barrel exports today. No interface, type alias or object literal in `apps/web` restates any of
their fields.
***Test:*** a source scan asserts that `condition`, `remedy` and `handle` appear in `apps/web` only in
expression position and never in a declaration, and that the module holding the definitions is imported
both by `packages/server/src/wire.ts` and by at least one `apps/web` source file; the scan is shown to
have a subject by reporting a violation over a fixture that re-declares `WireRun`.

**AC-13 — the client reaches the daemon same-origin, and the dev server is what bridges it.**
Every request and the WebSocket upgrade use a path relative to the page's own origin; no absolute URL,
hostname, port, `ws://` or `wss://` literal appears in `apps/web/src`, and a socket URL derives its
scheme from the page's (`ws:` for `http:`, `wss:` for `https:`) with the handle encoded as one path
segment. `apps/web/vite.config.ts` proxies `/runs`, `/project`, `/tickets`, `/flows` and `/history`,
WebSocket upgrade included, to a target read from configuration with a documented default. **No CORS
middleware, header or dependency is added to `packages/server`, and `BIND_HOSTNAME` does not move.**
***Test:*** a source scan over `apps/web/src` for the forbidden literals, with `vite.config.ts` the one
exemption; a separate assertion reads `packages/server/src/*.ts` and its manifest and asserts neither
gained the string `cors`. The proxy's own correctness is an integration concern and is deliberately
**not** claimed by this test — the bound is that the source is same-origin, which is what makes the
eventually-served bundle work unchanged.

**AC-14 — a frame is parsed, never cast, and each refusal is distinguishable.**
Every frame is validated before it is read: an `event` frame's payload through `@quorum/shared`'s
`eventSchema`, a `missed` frame's `count` as a number, and anything else refused and surfaced rather
than ignored. *"Errors are explicit … never default silently"* is the rule, and a `JSON.parse` result
assigned to `WireMessage` is a silent default.
***Test:*** the parser is a pure function driven with (a) a valid event frame, (b) a valid missed frame,
(c) an unknown `type`, (d) an event that fails `eventSchema`, (e) a non-object and (f) a non-text
message. Each of (c) to (f) produces a **distinguishable** refusal asserted by value, because a single
catch-all satisfies a weaker assertion while telling the user the same wrong thing four times.

**AC-15 — the connection has a named state for every case and none of them is silence.**
At minimum: *connecting*, *live*, **no daemon** (the socket could not be opened at all), *no such run*
(the daemon answered and closed 1008), *ended* (a terminal event then a normal close), *interrupted* (a
close before a terminal event, carrying the browser's close reason as text where one exists), *dropped*
(1013, this subscriber fell behind) and *protocol error* (AC-14). Each is rendered in the top bar's
connection region in plain language, and **no daemon** names the address the client tried. The
distinction between *no daemon* and *no such run* is the load-bearing one: they are "start the daemon"
and "that handle is wrong", and a single "disconnected" tells the user neither.
***Test:*** the state machine is a pure reducer driven over each transition and asserted **by value**;
*no daemon* and *no such run* are asserted to produce different states **and** different user-facing
strings, which is the clause a single catch-all fails.

**AC-16 — a `missed` count is reported, and a refusal renders what it carries.**
A `{type:'missed', count: n}` frame is surfaced with its count and never dropped and never emitted as an
event. A refusal is rendered from its `condition` — `core`'s sentence, displayed unaltered — and its
`remedy` where one is present; a `code` this client does not recognise **still renders its condition**
rather than being replaced by a generic message. No ANSI escape, colour code or vendor branching is
introduced into anything that crosses the wire.
***Test:*** the refusal renderer is driven with a known code carrying a remedy, a known code with
`remedy: null`, and an **invented** code, asserting the exact `condition` string appears in all three
and that the unknown code did not suppress it; the missed handler is driven with `count: 0` and
`count: 7`, and the second must surface the number 7.

**AC-17 — one socket at a time, and leaving closes it.**
Leaving the run route, changing the handle, or unmounting closes the active socket and prevents its
callbacks from updating anything afterwards. At most one socket owned by that route is open at any
moment.
***Test:*** driven against a fake socket transport: asserted that a handle change closes the first and
opens exactly one replacement, that a late callback from the closed socket changes no state, and that
unmount closes. The assertion is over the transport's own close record rather than over "the run still
exists", which is true whether or not anything was released — the shape Q-0118's round 2 caught.

**AC-18 — retry is explicit, and retrying preserves what arrived.**
An interrupted, refused or errored connection offers a Retry action. **The client does not reconnect
automatically**: without a resume cursor an automatic reconnection either duplicates events or hides a
missed prefix, and Q-0118's envelope exists precisely so a gap is reported rather than smoothed over.
Retry closes any previous socket, opens exactly one replacement, and clears neither the events already
accepted nor the incomplete-replay notice.
***Test:*** driven over the fake transport; asserted that no socket is created without an explicit
retry, that exactly one replacement is created, and that the prior events and the missed notice survive.

**AC-19 — nothing is persisted in the browser.**
Route content, events, the incomplete-replay notice, the connection state and the run handle are held in
memory only. No use of local storage, session storage, IndexedDB, cookies or any other browser-side
store is added — `04-architecture.md:183` permits *"no client-side persistence beyond UI preferences"*,
and a run handle is not a preference.
***Test:*** a source scan over `apps/web/src` for `localStorage`, `sessionStorage`, `indexedDB`,
`document.cookie` and `caches`, asserted to have a subject by reporting a violation over a fixture that
uses one.

---

## 6. Non-goals

1. **Every screen** — Q-0015 mission control, Q-0016 gate, Q-0017 backlog board and ticket page, Q-0018
   run history. This ticket renders a placeholder where each will go and no part of any of them.
2. **The M4 editors and step chat** (Q-0020, Q-0021, Q-0022) and `quorum open`.
3. **A `build` task and everything it implies** — the emitting-set register, the glossary's **Emitted
   artifact** sentence, `04-architecture.md`'s distribution-set paragraph, and a static route on the
   daemon. GO-3 and Appendix B.
4. **`GET /runs`, `GET /runs/:id` or any new server route**, and reconnecting to a run across a page
   reload, which is not achievable without them (§0.6, Appendix A).
5. **Authentication and any widening of the bind.** `BIND_HOSTNAME` does not move and no CORS
   middleware is added.
6. **"Override with reason."** The gate answer vocabulary is exactly `advance`, `retry`, `abort`;
   `gateAnswerEnvelopeSchema` is `.strict()` over those three and `askGate` raises on anything else. No
   route, control, register entry or string mentions an override or a reason field.
   `docs/05-design-prompt.md` screen 6 offers *"Advance anyway (override, requires a one-line reason)"*
   — **that is the mockup brief**, already ruled as such by Q-0013 and corrected in both documents that
   promised it; widening the envelope is Q-0016's, with an entry of its own.
7. **Multi-project anything.** `createDaemon` takes one project and `GET /project` answers one
   repository, so a projects grid is not a screen this daemon can feed.
8. **Light theme, a theme switcher, theme persistence, a design system, a component library or
   `packages/ui`** — that package does not exist.
9. **Responsive behaviour below 1024 CSS pixels as a criterion.** Codex's AC-11 is a real property and
   the wrong ticket's: it is testable only against a laid-out DOM, and every screen that would prove it
   belongs to somebody else. The shell is built not to forbid it; nothing here asserts it.
10. **Migrating, upgrading or reconfiguring any existing dependency**, and any change to
    `vitest.shared.js`, `tsconfig.base.json`, `turbo.json`, `CLAUDE.md`, `docs/decisions/` or CI.
11. **Widening `testFilesIn` to see `.test.tsx`** (§0.4, R-3) — `packages/core`'s surface, reported and
    not fixed.

---

## 7. Open questions — three blocking

### B-1 (blocking) — take the cut. *Owner: the gate.*

Nineteen criteria is the number Q-0013 was refused at, and both candidates reach a smaller figure by
dropping something load-bearing (§3). **Recommended: two children at the shell/connection seam,
AC-1…AC-11 and AC-12…AC-19, in that order, numbered continuously.** If the gate keeps one ticket, it
should say which criteria it is prepared to lose, because nineteen is not a size this repository has
ever run to a convergent loop.

### B-2 (blocking) — where do the three wire shapes live? *Owner: the gate, before the child starts.*

§0.1 measured that `@quorum/server` cannot be imported by name. Two answers:

**(A) Give `@quorum/server` an export surface** mirroring `@quorum/core`'s. *Cost:* it is Q-0096's six
criteria arriving inside another ticket; the `default` condition would name a `dist/` this package has
no build script to produce, which is the artifact-that-does-not-exist decision 078 rejects; and it
leaves a value import one keystroke from pulling `hono`, `@quorum/core` and `node:` builtins into a
browser bundle, where AC-5 is a guard and a guard is weaker than an impossibility.

**(B) Recommended. Move the three interfaces into `@quorum/shared` with a `WireMessage` schema beside
them**, and have `packages/server/src/wire.ts` re-export so Q-0118's barrel keeps every name it exports
today. *Why:* AC-14 needs a runtime **parser**, not a type — a type buys nothing against `JSON.parse` —
so the schema has to live where a browser can execute it; `@quorum/shared` is the only package with an
`exports` map, a browser-safety guard, and a header that **names this app as its reason**. The three
interfaces are free of host types: `WireRefusal` is three strings, `WireRun` four primitives,
`WireMessage`'s event field `unknown`. The three status tables stay in `packages/server`, being typed
against `AnswerRefusal` and `StopRefusal`. The direction is `server → shared`, the normal one.

**One measured caveat neither candidate has, and it will cost a round if it is not said here:**
`packages/shared/src/index.test.ts` asserts the literal `@quorum/` appears in **no file under
`packages/shared/src`, tests included** — which is why that file assembles the needle at run time. The
JSDoc moving with the interfaces currently reads *"`event` is `@quorum/shared`'s `Event` unaltered"* and
must be reworded, or the move turns that guard red on arrival.

**No decision entry is owed under either answer**: neither reverses a landed entry, and
`04-architecture.md:61` already states the boundary (B) executes. It is a gate question rather than an
entry because *which package a cross-surface type lives in* is a boundary an implementer must not
invent.

### B-3 (blocking) — does a `build` task land here? *Owner: the gate.*

**Recommended: no**, on the measurement rather than on taste: `packages/server` serves no file (§0.7),
so a bundle built today has no consumer at all — the inverse of *"The emit serves the binary, and no
test verdict moves behind it"* (2026-09-02), whose whole argument is that a non-empty `outputs` replays
an **artifact** and therefore needs something that executes it. `04-architecture.md:149–151` hedges in
the same direction in its own words.

**It is blocking rather than a preference because of who may write the answer.** If the gate says yes,
the ticket owes a decision entry classifying `apps/web/dist/` — and `developer-generalist`'s own
instructions name a `docs/decisions/` entry as the first example of `blocked`. So that entry must land
**before** the run, not inside it; a run launched without it is the sixteenth appearance of a loop
handed work no agent in it can perform, and the fifteen before it are on the record. Codex's AC-22
requires exactly that entry as a criterion and would stop the run on its first round. §0.9 is the
register of what else moves, and the amend-versus-coin distinction there is what decides whether
`CLAUDE.md` — which no role may write — is in scope.

### GO-4 (not blocking) — open the `GET /runs` successor **at this gate**, not in this document.

§0.6, body in Appendix A. Three obligations in one week were found living only inside a closed ticket's
prose or a source comment, one of them since 2026-09-02; Q-0105 is the counter-example that opened its
two at its own close.

### GO-5 (not blocking) — the palette's mechanism, and the router.

**Palette: recommended CSS custom properties as the single definition with Tailwind's theme referring
to them**, so one declaration serves utility classes and any raw CSS a trace column later needs. AC-10
asserts the one-definition property and does not pin the mechanism, so this can change without moving a
criterion. **Router:** the implementer selects the smallest maintained one that satisfies AC-6's tables
and browser-history navigation, or writes none and satisfies them directly, with the one-line
justification AC-1 requires. This is deliberately *not* raised to a blocker as codex's OQ-2 does: under
the recommended chore route there is no architect step, and AC-6 asserts the route map rather than the
library.

---

## 8. Risks

**R-1 — the workspace install grows, and the cold-clone path is the workspace-local install.** React,
Vite's React plugin, Tailwind, `jsdom` and their transitive trees land in `pnpm-lock.yaml`, and quality
pillar 7's first supported path is `pnpm install && pnpm turbo run build`. Nobody has measured what this
costs. **Obligation:** record `pnpm install --frozen-lockfile` wall time and `node_modules` size from a
clean store, before and after, in the implement report. A measurement rather than a criterion because no
threshold is defensible without the first number — and an unmeasured regression on the cold-clone path
is what four documents claimed was fine until Q-0104 ran it on a clean machine.

**R-2 — zod enters the browser bundle** once AC-14 parses rather than casts. That is the right price and
it should be named rather than discovered: after React it is the app's largest dependency.

**R-3 — a `.test.tsx` is run by Vitest, invisible to the guard that checks collection, and undeclared as
a turbo input** (§0.4). Fail-open, inside the guard written to close that class — the
`q0050.source.test.ts` shape Q-0051 found and the `pathLiterals` shape Q-0108 found. Bounded here by a
naming rule (AC-2), reported and not fixed.

**R-4 — AC-4 edits a root `globalDependency`.** `eslint.config.js` is one of four files root
`turbo.json` hashes for every task, so the change invalidates every package's cache and costs one full
re-run. Correct behaviour; named so nobody reads a workspace-wide re-execution as a symptom.

**R-5 — the shell is where four later tickets will be tempted to put shared state.** *"Files are the
database"* is `core`'s rule and `04-architecture.md:183` is the browser's analogue. A cached ticket
list or a stored containment token would each be the UI holding truth the files hold — and containment
and push lag are derived per request **by design**, with two landed entries forbidding a stored copy.
AC-19 is the narrow instance; this is the class, and it belongs in the implement report.

**R-6 — a review round will want to raise AC-6's or AC-10's instrument.** Both assert a *property* — one
definition; the tables are the source of the routes — and deliberately do not assert a mechanism.
Q-0067 erratum E-1 governs, and it is named in advance because that escalation has been paid for five
times here.

**R-7 — an `apps/web` test that reads a repository file earns `apps/web` its first `turbo.json`.**
`turbo-inputs.test.ts`'s corpus is `packages` **and** `apps`, so the registration is demanded rather
than optional. AC-11 is written to avoid it; a later criterion that needs such a read should expect the
cost.

---

## 9. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | **AC-1.** No key path anywhere under `apps/web`; the browser holds no credential. The daemon is unauthenticated *and* loopback-only, which is the same decision from the other side; AC-13 forbids the CORS change that would weaken it. |
| **Worktree safety** | **n/a.** Nothing in `apps/web` writes to the repository; the browser can reach a worktree only through `POST /runs`, which is `core`'s path with `core`'s lock. No UI copy claims the browser enforces it. |
| **Gate behaviour** | **Untouched and fenced** — non-goal 6. Vocabulary stays `advance`, `retry`, `abort`; the gate screen is Q-0016's. |
| **File format / schema** | **One addition, under B-2(B):** a `WireMessage` schema in `@quorum/shared`, derived from Q-0118's envelope rather than invented. No flow, ticket, role or manifest format moves. |
| **Lint rules** | **AC-4**, a corpus widening and not a policy change. |
| **Cold-clone impact** | **Measured rather than asserted — R-1.** The screens are not on the README path; what may grow is install time. |
| **Glossary / new terms** | **None owed under the recommended answers.** B-3 records the one that would be, and §0.9 records who may write it. |
| **Decision entry** | **None owed** for the stack: `04-architecture.md:22` and `:182` have said React + Vite + Tailwind since 2026-08-22, and Q-0118 ruled that *executing a landed document is not changing the architecture*. One **is** owed if B-3 is answered yes, and it is the human's. |
| **Product-agnostic** | AC-9's scan: no `acme-billing`, no vendor mockup data, no SaaS name in shipped strings. |
| **Cross-vendor rule** | n/a to the deliverable; satisfied by the route in §10. |

---

## 10. Route, and the sizing question

**Q-0014, the shell: the chore flow.** `developer-generalist` already carries `apps` in its `paths:`, so
no role grant is needed and no round is spent on a correct refusal — Q-0013's GO-1 precedent. A scaffold
has no behaviour a test could fail on before it exists, which is the chore flow's own stated rationale.

**The child, the live connection: recommended for the full pipeline, and the gate should take that
deliberately.** M2's closing measurement is that `solutioning`, `qa-red` and `development` were
exercised by four tickets in the whole project, three of them M1's, against fifty-five chore runs — so
the flows M3's feature work will use have the least evidence behind them of anything here. Q-0013's
gate deferred this argument rather than refuting it, and its child is the first M3 work with behaviour a
red test can fail on: a frame parser, a state machine and a socket lifecycle are exactly what a
contract-then-red-then-green route is for. Deferring it again makes Q-0015 the next candidate and the
argument one ticket older. The cost is real and is the gate's to weigh; what this document refuses is
deferring it silently.

**On size:** eleven and eight. Both are inside the ceiling with room, which is the point of the cut.

---

## 11. Provenance

**Claude's candidate is the stronger document and wins every disagreement of fact**, because it measured
rather than assumed. Taken from it substantially unchanged: §0.1's finding that `@quorum/server` is
unimportable and the B-2 ruling that follows (its OQ-A); §0.2's byte-pin on `vitest.config.js`; §0.3's
`.tsx` lint gap, which nothing else in this repository had noticed; §0.5's rail table; §0.6's absent
`GET /runs` and Appendix A; §0.7's same-origin-not-CORS argument (AC-13); B-3's build-task
recommendation and §0.9's register; the *Test:*-clause-bounds-the-instrument discipline; AC-5, AC-6's
register-not-count shape, AC-10's one-definition property, AC-14, AC-15 and AC-16; and R-1 to R-6.

**Codex's candidate supplies the coverage claude's omits**, and each of these is taken because the gap
was real: the route map with its dynamic segments (AC-6) — without which claude's own connection
criteria have no route to mount in; the placeholder contract's *fabricates nothing, mutates nothing*
clause and the decoded dynamic segment (AC-7); the Not found view (AC-8); the top bar's reserved
regions and explicit not-loaded strings (AC-9); the semantic token list and the local-font rule
(AC-10); socket lifecycle cleanup (AC-17); manual retry with its reasoning about a missing resume
cursor (AC-18); and the no-persistence rule (AC-19), which claude carried only as a risk.

**Struck from codex:** AC-13's import of `@quorum/server`, which does not compile (§0.1); AC-24's DOM
and integration suite, which cannot be configured where it is asked for (§0.2); AC-22's decision entry
as a criterion, which names a surface the flow cannot write (§0.9) and would stop the run on round one;
AC-11's sub-1024px responsiveness, which is the right property in the wrong ticket (non-goal 9);
AC-25's `UNCREATED` clause, already satisfied (§0.8); and the twelve conformance criteria (AC-26 to
AC-30 and their neighbours) that restate standing rules without adding a testable obligation — those are
§9's checklist, not criteria.

**Struck from claude:** the DOM-tests-are-out-of-scope ruling (its OQ-D), because it leaves fourteen
criteria satisfiable without the application ever mounting.

**Mine, in neither candidate:** the cut itself and the argument that it is also the route seam (§3);
§0.4's `.test.tsx` triple blind spot and the naming rule that bounds it; §0.8's already-satisfied
`UNCREATED` criterion, which corrects the ticket body as well as codex; §0.9's amend-versus-coin
distinction, which is what decides whether `CLAUDE.md` is in scope; B-2's measured caveat that
`packages/shared/src` may not contain the string `@quorum/` anywhere, which the recommended answer
walks into; AC-2's per-file `@vitest-environment` route through the byte pin; and R-7, with AC-11's
test deliberately placed in `docs.test.ts` to avoid earning `apps/web` a `turbo.json` for one anchor.

---

## Appendix A — successor body: the daemon reports its live runs

**Problem.** `RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that. Nine
routes are registered and `POST /runs` is the only one that ever tells a client a handle (§0.6). A
browser that refreshes has lost every live run, and `DEFAULT_RETENTION`'s late-joiner buffer — 500
events, built precisely for *"a browser opened after a run began, or reopened after a refresh"* — is
unreachable, because the reopened browser cannot name the run.

**What it owes.** A `GET /runs` listing the host's live runs as `WireRun`s and a `GET /runs/:id`
answering one. Both are reads over state the host already holds; neither adds domain logic. The open
question is whether `RunHost` gains an enumeration or the transport keeps its own index — the first is
where the state is, the second keeps the host's surface at what Q-0013 proved.

**What it must not do.** Persist a handle in the browser: `04-architecture.md:183` permits no
client-side persistence beyond UI preferences, and a run handle is not a preference. And it must not
report a run it cannot back — a handle whose stream has ended is `ended`, a state `RunView` already
carries, not an absence.

**Sequencing.** After Q-0014, which creates a browser that can reload, and before or with Q-0015, whose
mission control is useless without it.

## Appendix B — successor body: the daemon serves the built web app

**Problem.** `04-architecture.md:149–151` says the server *"will serve `apps/web`'s build output"*, and
today `apps/web` has no build task and `packages/server` serves no file. M3's done-when includes
`quorum open` starting the daemon and a browser, which needs both.

**What it owes.** A `build` script and task for `apps/web`; a static route on the daemon; and **the
glossary ruling this ticket deferred** — whether a served bundle is an **emitted artifact**, or a third
kind beside the artifact and the binary. The glossary as written says the emitted files are *"JavaScript
and declaration files"* and that the three emitting packages *"are also the local distribution set"*; a
bundle has neither property, so one of those sentences moves whichever way it is ruled. **Amending that
entry is `docs/GLOSSARY.md` alone and is within the role's paths; coining a new term moves `CLAUDE.md`'s
list, which no role may write, and the decision entry is the human's either way** — so both clauses are
gate obligations and may not be criteria (2026-08-25).

**What moves, measured.** `test-discovery.test.ts:271`'s register becomes four entries led by
`apps/web`, `PACKAGES` being sorted; `docs.test.ts` holds four clauses of the glossary term. Nothing
else: `.gitignore` already carries `dist/`, `packages/core/turbo.json` already declares
`../../apps/*/package.json`, and `build.test.ts`'s dependents register is over the three packed packages
and does not move. All four checked rather than assumed.

**Read first.** *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02): its
argument is that a non-empty `outputs` replays an **artifact** where the other three tasks replay a
verdict, and a bundle inherits that hazard the moment something executes it.
