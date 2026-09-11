# Q-0014 — The web app has a shell, a theme and routes

*Merged requirement, run 1, iteration 2. 2026-09-11. Verdict: **ready** — eleven criteria, no
blocker, three gate obligations that are the human's to discharge.*

**Surfaces:** `apps/web`, `eslint.config.js`, `docs/04-architecture.md`. **Not** `packages/core`,
`packages/server`, `packages/shared`, `harness/`, `backlog/`, `docs/decisions/`, `CLAUDE.md`,
`docs/GLOSSARY.md`, `turbo.json`, `vitest.shared.js`, `tsconfig.base.json`,
`docs/06-development-plan.md`, CI.

---

## 0. Iteration 2 opened on an unchanged tree, and says so

The tip is still `b08be68`, `docs/decisions/` still ends at `090`, there is no
`requirements/errata.md`, and `ticket.md` is byte-identical to the commit that created it. So this
pass could not rule iteration 1's three blockers by reading an answer — *"a retry on an unchanged
tree cannot rule its own blocker"* (Q-0090, Q-0096, Q-0105), fourth recorded instance.

What it did instead is Q-0105's remedy rather than another instance of the pattern: **re-measure, and
move what can be moved by deciding rather than by asking.** Two of the three blockers were
reclassified on the merits of iteration 1's own measurements, and the third was cured by stating a
non-goal. None of iteration 1's recommendations is reversed — every one is carried unchanged, and
what moved is where it sits.

| iteration 1 | iteration 2 | why it moved |
| --- | --- | --- |
| **B-1** — take the cut | **taken**, §3 | Iteration 1's §3 argued the seam and then shipped one nineteen-criterion document asking the gate to choose, so a complete recommendation read as a blocked one. This document *is* the shell; the connection is Appendix A, a successor body written out in full. |
| **B-2** — where the wire shapes live | **not this ticket's**, Appendix A | Iteration 1 measured that B-2 confines to the connection half and then listed it as a blocker of the whole. The shell imports no wire shape, so `@quorum/server`'s missing `exports` map cannot reach it. |
| **B-3** — does a `build` task land | **stated as a non-goal**, §6.3 | The hazard was the *yes* answer, which owes a `docs/decisions/` entry the chore role is forbidden to write. Answering *no* with its measurement removes the hazard; a gate that wants *yes* rules it and lands the entry before the run, which is the correct sequence either way. |

**Four measurements are new**, and three of them correct iteration 1 rather than adding to it.
§1.4, §1.5, §1.6 and §1.7.

---

## 1. What was measured

Run against the tree on 2026-09-11. Both candidates' stub measurements are confirmed exactly:
`apps/web` is six tracked files with **no `index.html`**, `src/index.ts` is
`export const name = '@quorum/web';`, `vite.config.ts` is `defineConfig({})`, `tsconfig.json` is
`{"extends": "../../tsconfig.base.json"}` and nothing else, the manifest declares `lint`,
`typecheck`, `test`, **no `build`** and **no dependencies of any kind**, and there is no
`apps/web/turbo.json`. `docs/04-architecture.md:22` and `:182–183` have said React + Vite, Tailwind
and the dark "ground control" theme since 2026-08-22.

### 1.1 — `@quorum/server` cannot be imported by name (claude's finding, confirmed)

`packages/server/package.json` declares **no `exports`, no `main`, no `types`**, and no file in the
workspace imports it by name. Under `moduleResolution: nodenext` that specifier does not resolve,
type-only imports included — TypeScript must find the package before it can erase the import. It is
verbatim the state Q-0096 measured for `@quorum/core`.

The sharp part is that Q-0118 recorded the opposite intent in two JSDocs: `wire.ts`'s header calls
itself *"the contract Q-0014 codes against"*. **Codex's AC-13 mandates an import that does not
compile.** It is the child's blocker (Appendix A) and reaches nothing here.

### 1.2 — `apps/web/vitest.config.js` is pinned byte for byte (claude's finding, confirmed; both candidates' conclusions struck)

`packages/core/src/test-discovery.test.ts:177` asserts, for every package expanded from
`pnpm-workspace.yaml` — `apps/*` included — that `vitest.config.js` equals
`export { default } from '../../vitest.shared.js';`, because *"a package that stopped re-exporting
the shared file could narrow its own collection silently."* And `vitest.shared.js`, read in full,
sets `include`, `exclude` and `testTimeout` and **no `environment`**, so every test here runs in
Node.

Codex's AC-24 asks for DOM coverage and never notices. Claude noticed and over-corrected: its OQ-D
rules DOM tests out entirely, which is why its fourteen criteria are satisfiable **without the
application ever mounting**. Neither is right. The route that moves no guard is Vitest's per-file
`@vitest-environment` docblock — a property of the test file, not of the configuration — so this
document takes the middle: **one** DOM smoke test (AC-2), everything else register-driven.

### 1.3 — `.tsx` is linted by nothing (claude's finding, confirmed)

`eslint.config.js:19` is `files: ['packages/**/*.ts', 'apps/**/*.ts']`, and a flat-config `**/*.ts`
pattern does not match `.tsx`. So `no-explicit-any`, `ban-ts-comment` and `no-deprecated` reach **no
line** of the largest body of new source in the milestone. That is Q-0069's failure — *"nobody owned
it, and `lint` and `typecheck` both reported green"* — arriving on a new corpus. `tsc --noEmit`
covers `.tsx` once `jsx` is configured, so `typecheck` is not the gap; `lint` is, silently. Neither
the ticket body nor codex mentions it. AC-4.

### 1.4 — new: a `build` script turns *two* clauses red, not one, and falsifies a third sentence

Iteration 1's register named `test-discovery.test.ts:271`'s `emittingPackages()` identity. Measured,
there is a second clause immediately below it — *"and a package that emits nothing is not required to
declare a no-op build script"* — which asserts `scripts.build` is `undefined` **for every
non-emitting package**, with its own stated reason: *"a no-op build in the four stub packages would
declare an artifact that does not exist."* And `docs/04-architecture.md:149–151` says in as many
words that *"that app has no build task and emits nothing today"*, which goes false the moment one
lands.

So the build task is three moving parts plus a glossary ruling, not one register row. It does **not**
by itself make the answer *no* — a Vite bundle is not a no-op build, so the second clause's reasoning
is not automatically decisive — but it is the cost, and §6.3 rules on it.

### 1.5 — new: the wire move is smaller than iteration 1 described

`wire.ts` holds three interfaces *and* three functions. `badRequest` is free of host types;
**`wireRefusalOf(code, refusal: Refusal)` and `wireRunOf(outcome: StartOutcome)` are not** — they
import from `./host.js` and `./refusal.js`. Iteration 1 said the three status tables stay in
`packages/server` and did not notice the two constructors, which stay for the same reason. What moves
under the recommended answer is **three interfaces and one new schema**, nothing else. Carried into
Appendix A so the child is not sized from a wrong description.

### 1.6 — new: the role's frontmatter is what makes the amend-versus-coin distinction actionable

`harness/roles/developer-generalist.md`'s `paths:` is, verbatim: `package.json`,
`pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.npmrc`, `.gitignore`, `.github`, `packages`,
`apps`, `harness`, `docs`, `README.md`, `eslint.config.js`, `vitest.shared.js`.

So: `eslint.config.js` **is** writable, which is what makes AC-4 a criterion rather than a gate
obligation. `docs/GLOSSARY.md` **is** writable, so *amending* the **Emitted artifact** entry is in
reach. `CLAUDE.md` is **not in the list at all** — only `README.md` is — so *coining* a term is out.
And the role's own body forbids `docs/decisions/` in as many words, naming it the first example of
`blocked`. Iteration 1 drew the distinction from the plan's prose; this reads it off the file the
engine loads.

### 1.7 — new: the no-third-party-font clause contradicts the document it cites

`docs/05-design-prompt.md:7` says *"no external assets **except Google Fonts**"*, and `:17` names
*"Inter or IBM Plex Sans for UI, JetBrains Mono for code/traces/costs"*. Codex's AC-10 forbids a
third-party font request and iteration 1 adopted it unexamined, so a criterion contradicted its own
visual authority with nothing recording that it had.

It ships anyway, as a **deliberate divergence with its reason written down**, on exactly the
precedent Q-0013 set for the same document's *"override with reason"* line: the brief describes a
*"single-file HTML clickable prototype … a design validation mockup, not a real app"*, and Quorum is
**local-first**. A shell that fetches a font from a third party on every page load makes a local-first
tool require the internet and leaks a request off the machine. AC-10 says so in place.

The same paragraph also **forces the accent colour**, which neither candidate noticed: the brief
offers *"electric teal or amber — pick one"* and then assigns `waiting-on-human = amber` and
`running = accent pulse`. With amber as the accent those two states are one colour apart, which is
the palette's version of the failure this repository refuses. The accent is teal, derived rather than
chosen.

### 1.8 — the rail is seven entries and does not map onto the screens (claude's table, confirmed)

`05-design-prompt.md:21` names **Projects, Backlog, Harness, Flows, Runs, History, Settings** — seven
— and three of them have no M3 screen ticket. The gate screen (Q-0016) and step chat (Q-0022) are
reached from a run rather than from the rail. Codex's **route map** is the better half here: it
carries the dynamic segments a seven-entry register has nowhere to put.

| rail entry | path | screen | owner |
| --- | --- | --- | --- |
| Projects | `/projects` | projects home | **no ticket** |
| Backlog | `/backlog`, `/backlog/:ticketId` | board + ticket page | Q-0017 |
| Harness | `/harness` | harness editor | Q-0021 (M4) |
| Flows | `/flows` | flow editor | Q-0020 (M4) |
| Runs | `/runs` | runs landing | **no ticket**, and §1.9 |
| — | `/runs/:handle` | mission control | Q-0015 |
| — | `/runs/:handle/gate` | gate screen | Q-0016 |
| — | `/runs/:handle/steps/:stepId` | step chat | Q-0022 (M4) |
| History | `/history` | run history | Q-0018 |
| Settings | `/settings` | — | **no ticket** |

**And Projects cannot become a grid.** `createDaemon` takes one project, `RunHost.project` is
singular and `GET /project` answers one repository, so a projects grid is not a screen this daemon
can feed. That is not a defect to fix here; it is why AC-7 makes that placeholder say something true.

### 1.9 — there is no `GET /runs` (claude's finding, confirmed)

Nine routes are registered and this is the complete set, read from `http.ts`, `read.ts` and
`serve.ts`:

```
POST /runs   POST /runs/:id/gate   POST /runs/:id/stop   GET /runs/:id/events (WS)
GET  /project   GET /tickets   GET /flows   GET /history   GET /history/:id
```

`RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that. The only way a
client learns a handle is the `201` from its own `POST /runs`, so a reloaded browser has lost it and
`DEFAULT_RETENTION`'s late-joiner buffer is unreachable. `04-architecture.md:183` forbids the storage
workaround. Opened as a successor **at this gate** (GO-3, Appendix B).

### 1.10 — `plan-backlog.test.ts` never held a `Q-0014` row

`UNCREATED` holds exactly `Q-0012`, `Q-0015`, `Q-0016`, `Q-0017`, `Q-0018`, `Q-0019`. The ticket body
says *"`UNCREATED` loses its `Q-0014` row in the same change"* and codex's AC-25 asserts it. **Both
are void**: the register was already correct when the folder was created, and the guard's own third
direction — *"the register names only uncreated bullets"* — would have gone red otherwise. A criterion
that is already satisfied is not a criterion. Sixth consecutive ticket whose inherited measurement was
wrong.

### 1.11 — turbo inputs, checked so no criterion earns an unexpected registration

`eslint.config.js` is a root **`globalDependency`**, hashed for every task, so AC-4's read is covered
without `apps/web` earning its first `turbo.json` — the rule Q-0108 landed when `covered` began
honouring `globalCacheInputs.files`. `packages/core/turbo.json` already declares
`../../apps/*/package.json`, `../../apps/*/vitest.config.js` and `../../apps/*/**/*.test.ts`, so
adding `*.test.ts` files under `apps/web` needs no declaration — **and a `.test.tsx` would be run by
Vitest, be invisible to `testFilesIn`, which matches `.test.ts` only, and be hashed by nothing.**
Bounded by a naming rule (AC-2) rather than by widening a `packages/core` guard; reported as R-3.

---

## 2. Problem

Q-0013, Q-0118 and Q-0119 built the whole server side of M3's browser half — a run host, three POST
routes, a WebSocket carrying one event per message, and a read-only REST surface over project,
backlog, flows and history — and **nothing consumes any of it**. `apps/web` is a six-file stub whose
entire content is a string equal to its own package name.

Every M3 screen (Q-0015, Q-0016, Q-0017, Q-0018) needs the same things before it can render anything:
somewhere to mount, a way to be navigated to, and a palette to be drawn in. Four screens each building
their own is four palettes, four route conventions and four answers to *what does a route render
before its screen exists*.

Two narrower problems are cheap in the ticket that creates the first `.tsx` file and expensive in the
fourth: the new source would be outside the lint config's reach (§1.3), and a test file named `.tsx`
would be outside two guards and one turbo input (§1.11).

## 3. The cut, taken

Merged honestly, the two candidates are **nineteen** independently testable criteria — the number
Q-0013 was refused at, and for the same reason: reviewers find blockers faster than one bounded loop
can close them. Claude reaches fourteen only by deferring the build task *and* ruling out any proof
that the application mounts; codex reaches thirty by asserting responsiveness at 320 CSS pixels, font
stacks and a real-socket integration test in a package that cannot configure a DOM.

**The seam is the shell against the live connection**, and three things argue for it:

1. **It is additive, not a redesign.** The shell ships the routes that hold a run and the top-bar
   region that holds connection status; the child fills both. That is the test Q-0013's gate applied
   when it *refused* the single-watcher/fan-out seam — *"the fan-out is not an enhancement of
   single-watcher streaming; it is what makes single-consumer safe"* — and this seam passes it where
   that one failed.
2. **It is also the route seam.** The shell is a scaffold with no behaviour a test could fail on
   before it exists, which is the chore flow's own stated rationale. The connection half has
   behaviour a red test can fail on, and is the first M3 work that does.
3. **The one genuinely open design question is confined to the child.** §1.1 blocks the connection and
   reaches nothing in the shell, so the shell can start now.

**This document is the shell.** The connection half is **Appendix A**, a successor body written out in
full — the Q-0091 → Q-0099, Q-0039 → Q-0114 and Q-0013 → Q-0118/Q-0119 pattern, where a gate
allocates a successor from a body written in advance rather than leaving an obligation in prose.
Criteria are numbered continuously across both, per the Q-0106/Q-0107 convention, so a criterion keeps
its name if the gate moves the cut.

| | criteria | route |
| --- | --- | --- |
| **Q-0014** — the shell | AC-1 … AC-11 | chore |
| **its child** — the live connection | AC-12 … AC-19 | full pipeline recommended, §10 |

**The ticket's title now over-describes its criteria**, which is Q-0052's shape and is stated rather
than left to be found: *"and a live connection"* belongs to the child. Retitling `ticket.md` is the
gate's, the backlog being a surface no role may write. GO-1.

## 4. User stories

**`maintainer`** — *I run the web app's dev server, open the browser, and get a shell that renders
whether or not the daemon is running: a rail I can navigate, a top bar whose regions are visibly empty
rather than invented, and a page that never looks like it is loading something that is never coming.*

**`maintainer`** — *I click a rail entry whose screen has not been built and am told which ticket
builds it — or, for the three that have no ticket, that there is no ticket — rather than meeting a
blank panel that reads as a bug.*

**`contributor`** — *I add a component and `pnpm lint` tells me about the `any` I wrote, the same as
anywhere else in this workspace.*

**`adopter`** — n/a to the screens; the cold-clone path is CLI-only. What this ticket may lengthen is
the workspace install, which is R-1's measurement rather than a criterion.

---

## 5. Acceptance criteria

Eleven. Each ***Test:*** clause **bounds the instrument**: per *"An adapter records the version it was
verified against"* (2026-09-08) erratum E-1, a reviewer may find that an instrument fails the job its
*Test:* clause gives it, and **may not raise the job**.

**AC-1 — `apps/web` declares what it needs, each with a reason, and no credential path exists.**
The manifest gains its dependencies — at minimum React, a React DOM renderer, the Vite React plugin,
Tailwind with its Vite adapter, `jsdom` for AC-2, and a router or the recorded decision to write none
— and the implement report carries the one-line justification `.claude/rules/engineering.md` requires
for **each**. No dependency, script, environment variable, comment, fixture or example anywhere under
`apps/web` mentions or accepts an API key, a token or a credential; what authenticates an agent is a
**subscription**, and the browser holds none of it.
***Test:*** a test reads `apps/web/package.json` and asserts every declared dependency and
devDependency appears in the implement report's justification list; a scan over every file under
`apps/web`, configuration included, asserts the literals `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`CODEX_API_KEY`, `apiKey` and `api_key` appear nowhere, **and** asserts the scan collected more than
one file, so it cannot pass over an empty corpus. R-1's install measurement is a gate obligation, not
a test.

**AC-2 — the application mounts into a real document and renders with no daemon running.**
`apps/web` gains an `index.html` and a React entry that mounts the shell into it. **One** smoke test
renders the shell in a DOM and asserts it produced the rail and the top bar without throwing, with
nothing listening on any port. `apps/web/vitest.config.js` is unchanged **byte for byte** and
`vitest.shared.js` is not edited: the DOM comes from a per-file `// @vitest-environment jsdom`
docblock. **Every test file this ticket adds is named `*.test.ts`** (§1.11), importing `.tsx`
components where it needs one.
***Test:*** the smoke test is itself the instrument, and `packages/core/src/test-discovery.test.ts`
stays green — the guard on the configuration, not re-implemented here. A second assertion lists the
test files `apps/web` holds and asserts every one ends `.test.ts`, so the discovery guard and the
turbo input that reads it keep their subject.

**AC-3 — `tsc --noEmit` covers every new file, `.tsx` included.**
`apps/web/tsconfig.json` gains what a React app needs on top of `tsconfig.base.json` — at minimum a
`jsx` setting and the DOM lib — and relaxes nothing the base decides.
***Test:*** `pnpm --filter @quorum/web typecheck` exits 0 over the shipped tree; and a test asserts
`apps/web/tsconfig.json` sets neither `strict: false` nor any `strict*`-family override, so the one
property the base exists to guarantee cannot be relaxed by a local file.

**AC-4 — the three lint rules this workspace enforces reach the UI.**
`eslint.config.js`'s `files` covers `apps/**/*.tsx` as well as `apps/**/*.ts`. Nothing is added to
`ignores`, and **no rule is added, removed or downgraded** — this widens a corpus and changes no
policy.
***Test:*** **demonstrated red before green.** A `.tsx` fixture containing an explicit `any` is
asserted to be matched by nothing under the pre-change pattern list and reported under the post-change
one, as **two separate assertions over the two pattern lists**, so the guard cannot pass by the new
pattern matching everything. Where the assertion lives is the implementer's: the file it reads is a
root `globalDependency` either way (§1.11).

**AC-5 — no file under `apps/web/src` reaches for something a browser does not have.**
No import of a `node:` specifier or a bare Node builtin, and no import of `@quorum/core`.
***Test:*** the shape `packages/shared/src/index.test.ts:102` already uses — *"no source file imports
a runtime capability apps/web cannot have"* — aimed at `apps/web`, with the same builtin list plus
`@quorum/core`. Asserted to have a subject by requiring the walk to find more than a floor of source
files, because every failure mode of a walk hides files rather than inventing them.

**AC-6 — the rail and the routes are one register, and no component names a route the register does
not hold.** One exported table declares every rail entry — id, label, path, and whether its screen
exists — holding the **seven** entries `05-design-prompt.md:21` names, in that order: Projects,
Backlog, Harness, Flows, Runs, History, Settings. A second table declares every path the shell
recognises, §1.8's twelve: `/` redirecting to `/projects`, `/projects`, `/backlog`,
`/backlog/:ticketId`, `/harness`, `/flows`, `/runs`, `/runs/:handle`, `/runs/:handle/gate`,
`/runs/:handle/steps/:stepId`, `/history`, `/settings`. The router is built **from** the tables rather
than beside them; the rail marks the entry matching the current URL as active; every entry is
reachable by keyboard and has a visible focus state. The M4 paths are declared now because the
register is the one place a route may be named, so four later tickets inherit a URL shape rather than
each inventing one.
***Test:*** a register of identities and not a count (*"A cache hit names what the task reads"*,
2026-08-28): the seven rail ids are asserted with `toStrictEqual` in the brief's order, every path is
asserted unique, and a source scan asserts that no route-path literal appears in a component file that
the tables do not hold. A count-based assertion is explicitly insufficient, because a member swapped
out satisfies one.

**AC-7 — a route whose screen does not exist says what it is waiting for, and fabricates nothing.**
Each placeholder names its screen, names the ticket that builds it where one exists (§1.8's table),
and says plainly that it does not exist yet. **Projects, Runs and Settings have no ticket** and their
placeholders say so rather than inventing one; Projects additionally states that this daemon holds one
project, which is what `GET /project` can answer, and Runs states that the daemon reports no run
listing yet (§1.9). A placeholder presents **no** fabricated project, subscription, run, ticket, gate
or cost data, and **no** control that appears to start, stop, answer or mutate anything. No
placeholder is a blank panel, a spinner or a skeleton loader — a screen that looks like it is loading
something that is never coming is the reassurance-by-silence this repository has refused in three other
surfaces. A placeholder for a dynamic route displays the decoded segment the URL supplied.
***Test:*** each placeholder's rendered text is asserted to contain its screen's name and a non-empty
explanation taken from the register rather than from the component; the three ticketless entries are
asserted **not** to contain a `Q-` id, so a later reader cannot quietly attach one screen's ticket to
another's placeholder; and one assertion drives a dynamic placeholder with a percent-encoded segment
and asserts the decoded value is shown.

**AC-8 — an unmatched URL is a Not found view inside the same shell.**
It names the path that was requested, offers a keyboard-reachable link to Projects, and renders inside
the rail and top bar rather than replacing them. A malformed percent-encoding reaches this view rather
than an uncaught exception, and the requested path is rendered as text.
***Test:*** driven with an unmatched path and with a malformed-encoding path; both assert the view
rendered, that the shell is still present, and that nothing threw.

**AC-9 — the top bar reserves its regions and asserts nothing it has not loaded.**
It carries the four regions `05-design-prompt.md:21` names — current project, git branch, subscription
status, and a primary "Run flow" control — plus a **connection-status region the child in Appendix A
fills**. Until their owning tickets supply data, each data region reads one explicit not-loaded string
and the primary control is visibly disabled. The shell **infers no value**: no project name, branch or
login state is guessed, defaulted or derived. The connection region reads that there is no live
connection yet and names the ticket that adds one.
***Test:*** the rendered top bar is asserted to contain the not-loaded string once per data region and
the control asserted disabled; a source scan asserts that none of the brief's mockup project names —
`acme-billing`, `heyruud.com`, `northwind-crm` — and no SaaS product name appears anywhere under
`apps/web/src`, which is `product-boundaries.md`'s rule rather than a style preference.

**AC-10 — the theme is defined once, no component names a colour, and nothing is fetched from a
network.** The ground-control palette is declared in exactly **one** file as eleven semantic tokens:
background, surface, border, primary text, muted text, accent, and the five statuses the brief names —
running, waiting-on-human, passed, failed, idle. Every component refers to them by name. The
background is near-black and desaturated rather than pure black; there is no decorative gradient and
no glassmorphism. **The accent is teal, derived rather than chosen**: the brief offers *"electric teal
or amber — pick one"* and then assigns amber to waiting-on-human, so an amber accent puts `running`
and `waiting-on-human` one pulse apart. The type stack is **local system sans and system mono**, and
loading the shell makes no third-party font or asset request — which is a **deliberate divergence**
from `05-design-prompt.md:7`'s *"except Google Fonts"*, recorded in place with its reason: that
document describes a single-file clickable mockup, and Quorum is local-first, so a shell that fetches
a font makes the product require the internet and leak a request off the machine on every page load.
The four non-status tokens are this requirement's extension of the brief and are named as such.
***Test:*** a scan over every file under `apps/web/src` asserts no hex literal, `rgb(`, `rgba(` or
`hsl(` outside the one palette file, with that file named as the single exemption and asserted to
exist and be non-empty; the eleven token names are asserted present in it, so a palette defining nine
of them fails rather than passing with a gap; and a scan asserts no `http://`, `https://` or
`//fonts.` literal appears anywhere under `apps/web`. **The mechanism is deliberately not asserted** —
CSS custom properties, a Tailwind theme extension, or both — see GO-2; what is asserted is the
one-definition property, which holds under all three.

**AC-11 — `docs/04-architecture.md`'s `apps/web` section describes what shipped.**
The section is rewritten from the 2026-08-22 proposal to the state after this ticket: what exists
(shell, theme, rail, routes, placeholders), what each rail entry is waiting for, that the app emits
nothing and why, and that the live connection is its child's. Its status line gains this ticket's id
and the landing date, the convention that file has used since Q-0098. **No other numbered document
changes and `docs/GLOSSARY.md` gains no term** — §6.3's ruling is what makes that true.
***Test:*** `packages/shared/src/docs.test.ts` gains an assertion that the status line contains
`Q-0014` and the landing date, in the shape that file already uses, plus one anchor assertion that the
`apps/web` section names the rail register by the term it ships under. **The assertion lives in
`docs.test.ts` and not in an `apps/web` test**, which is measured rather than stylistic: that suite
already declares `docs/04-architecture.md` as a turbo input, where an `apps/web` test reading a
repository file earns that package its first `turbo.json` and a `turbo-inputs.test.ts` registration
for one anchor (R-7). Nothing asserts the prose beyond those two anchors, because a document held
against its own paraphrase is a check with no subject.

---

## 6. Non-goals

1. **Every screen** — Q-0015 mission control, Q-0016 gate screen, Q-0017 backlog board and ticket
   page, Q-0018 run history. This ticket renders a placeholder where each will go and no part of any
   of them. The M4 editors and step chat (Q-0020, Q-0021, Q-0022) likewise, and `quorum open`.
2. **The live connection** — the WebSocket client, the frame parser, the connection states, retry and
   socket lifecycle. Appendix A, and the reason is §3 rather than convenience.
3. **A `build` task, and everything it implies** — the emitting-set register, the stub-package clause
   (§1.4), `docs/GLOSSARY.md`'s **Emitted artifact** sentence, `04-architecture.md:149–151`, a static
   route on the daemon, and the decision entry classifying `apps/web/dist/`.
   **Ruled rather than deferred, on measurement:** `packages/server` registers nine routes and serves
   no file, so a bundle built today has **no consumer at all** — the inverse of *"The emit serves the
   binary, and no test verdict moves behind it"* (2026-09-02), whose whole argument is that a
   non-empty `outputs` replays an **artifact** and therefore needs something that executes it.
   `04-architecture.md:149–151` already hedges in the same direction in its own words. Appendix C is
   the successor. **If the gate rules otherwise it must land the decision entry before the run**, not
   inside it: `developer-generalist`'s own instructions name a `docs/decisions/` entry as the first
   example of `blocked`, so codex's AC-22 as written would stop the run on its first round, and
   launching without the entry would be the sixteenth appearance of a loop handed work no agent in it
   can perform.
4. **`GET /runs`, `GET /runs/:id` or any new server route**, and reconnecting to a run across a page
   reload, which is not achievable without them (§1.9, Appendix B).
5. **Authentication and any widening of the bind.** `BIND_HOSTNAME` does not move and no CORS
   middleware, header or dependency is added to `packages/server`. The same-origin arrangement that
   makes that unnecessary is the child's AC-13.
6. **"Override with reason."** The gate answer vocabulary is exactly `advance`, `retry`, `abort`;
   `gateAnswerEnvelopeSchema` is `.strict()` over those three and `askGate` raises on anything else.
   No route, control, register entry or string in this ticket mentions an override or a reason field.
   `05-design-prompt.md:35` offers *"Advance anyway (override, requires a one-line reason)"* — **that
   is the mockup brief**, already ruled as such by Q-0013 and corrected in both documents that
   promised it. Widening the envelope is Q-0016's, with an entry of its own.
7. **Multi-project anything** (§1.8), a projects grid included.
8. **Light theme, a theme switcher, theme persistence, vendor badge colours** — no screen here shows an
   agent, so those tokens are Q-0015's — **and a design system, a component library or `packages/ui`**,
   which does not exist.
9. **Responsive behaviour below 1024 CSS pixels as a criterion.** Codex's AC-11 is a real property in
   the wrong ticket: it is testable only against a laid-out DOM, and every screen that would prove it
   belongs to somebody else. The shell is built not to forbid it; nothing here asserts it.
10. **Widening `testFilesIn` to see `.test.tsx`** (§1.11, R-3) — `packages/core`'s surface, reported
    and not fixed, bounded here by AC-2's naming rule.
11. **`docs/06-development-plan.md`.** Its bullets are rewritten by hand at each plan pass, and an
    implementer's edit there is churn that becomes a review finding — Q-0094 erratum E-3(a), which
    withdrew the opposite ruling for exactly this reason.
12. **Migrating, upgrading or reconfiguring any existing dependency**, and any change to
    `vitest.shared.js`, `tsconfig.base.json`, `turbo.json`, `CLAUDE.md`, `docs/decisions/` or CI.

---

## 7. Open questions, and the gate obligations

**None blocks an implementer.** The two that were open on the merits are ruled by measurement above
(§6.3, §1.7); the third belongs to the child.

### GO-1 — allocate the child, and retitle this ticket. *The gate's.*

Appendix A is a ticket's worth of text at an allocator's disposal. **Allocate it at this gate**, as
Q-0118 and Q-0119 were at Q-0013's and Q-0114 at Q-0039's — three obligations in one week (Q-0110,
Q-0111, Q-0112) were found living only inside a closed ticket's prose or a source comment, and Q-0105
is the counter-example that opened its two at its own close. And `ticket.md`'s title still promises
*"and a live connection"*, which the criteria no longer deliver; the backlog is a surface no role may
write, so the retitle is necessarily the gate's.

### GO-2 — two mechanisms the criteria deliberately leave open. *The implementer's, recorded here so a review round does not raise them.*

**The palette's mechanism.** Recommended: CSS custom properties as the single definition, with
Tailwind's theme referring to them, so one declaration serves utility classes and any raw CSS a trace
column later needs. AC-10 asserts the one-definition property and does not pin the mechanism, so this
can change without moving a criterion. **The router.** The implementer picks the smallest maintained
one that satisfies AC-6's tables and browser-history navigation, or writes none and satisfies them
directly, with the one-line justification AC-1 requires. Deliberately *not* raised to a blocker as
codex's OQ-2 does: under the chore route there is no architect step, and AC-6 asserts the route map
rather than the library.

### GO-3 — open the `GET /runs` successor at this gate. *The gate's.*

§1.9, body in Appendix B. Not this ticket's work and not a line in its closing entry.

### GO-4 — R-1's install measurement, taken at the gate or in the implement report. *Not a criterion.*

§8 R-1. A measurement rather than a threshold, because no threshold is defensible without the first
number.

---

## 8. Risks

**R-1 — the workspace install grows, and the cold-clone path is the workspace-local install.** React,
Vite's React plugin, Tailwind, `jsdom` and their transitive trees land in `pnpm-lock.yaml`, and
quality pillar 7's first supported path is `pnpm install && pnpm turbo run build`. Nobody has measured
what this costs. **Obligation:** record `pnpm install --frozen-lockfile` wall time and `node_modules`
size from a clean store, before and after, in the implement report. An unmeasured regression on the
cold-clone path is what four documents claimed was fine until Q-0104 ran it on a clean machine.

**R-2 — `apps/web` acquiring dependencies changes nothing in the emitting registers, and that is
checked rather than assumed.** `test-discovery.test.ts`'s stub clause asserts `scripts.build` is
`undefined` and that `lint`, `typecheck` and `test` are declared; it says nothing about dependencies.
So AC-1 moves no register. It is §6.3's answer that keeps it that way.

**R-3 — a `.test.tsx` is run by Vitest, invisible to `testFilesIn`, and hashed by no turbo input**
(§1.11). Fail-open, inside the guards written to close that class — the `q0050.source.test.ts` shape
Q-0051 found and the `pathLiterals` shape Q-0108 found. Bounded by AC-2's naming rule; reported and
not fixed.

**R-4 — AC-4 edits a root `globalDependency`.** `eslint.config.js` is one of four files root
`turbo.json` hashes for every task, so the change invalidates every package's cache and costs one full
re-run. Correct behaviour; named so nobody reads a workspace-wide re-execution as a symptom.

**R-5 — the shell is where four later tickets will be tempted to put shared state.** *"Files are the
database"* is `core`'s rule and `04-architecture.md:183`'s *"no client-side persistence beyond UI
preferences"* is the browser's analogue. A cached ticket list or a stored containment token would each
be the UI holding truth the files hold — and containment and push lag are derived per request **by
design**, with two landed entries forbidding a stored copy. The child's AC-19 is the narrow instance;
this is the class, and it belongs in the implement report.

**R-6 — a review round will want to raise AC-6's or AC-10's instrument.** Both assert a *property* —
one register, one palette definition — and deliberately do not assert a mechanism. Q-0067 erratum E-1
governs, and it is named in advance because that escalation has been paid for five times here.

**R-7 — an `apps/web` test that reads a repository file earns `apps/web` its first `turbo.json`.**
`turbo-inputs.test.ts`'s corpus is `packages` **and** `apps`, so the registration is demanded rather
than optional, and a path derived from the repository root additionally earns a `READ_BASES` audit
row. AC-11 is written to avoid it; a later criterion that needs such a read should expect the cost.

---

## 9. Cross-cutting checklist

| concern | answer |
| --- | --- |
| **BYOS** | **AC-1.** No key path anywhere under `apps/web`; the browser holds no credential. The daemon is unauthenticated *and* loopback-only, which is the same decision from the other side; non-goal 5 forbids the CORS change that would weaken it. |
| **Worktree safety** | **n/a.** Nothing in `apps/web` writes to the repository, and nothing here can start a run at all. No UI copy claims the browser enforces worktree safety; that guarantee stays in `core`. |
| **Gate behaviour** | **Untouched and fenced** — non-goal 6. Vocabulary stays `advance`, `retry`, `abort`; the gate screen is Q-0016's. |
| **File format / schema** | **Nothing moves.** No flow, ticket, role, manifest or wire schema changes; the one schema addition the merge contemplated is the child's (Appendix A, AC-12). |
| **Lint rules** | **AC-4**, a corpus widening and not a policy change. |
| **Cold-clone impact** | **Measured rather than asserted — R-1, GO-4.** The screens are not on the README path; what may grow is install time. |
| **Glossary / new terms** | **None owed**, and that is a consequence of §6.3 rather than an accident — Appendix C records the ruling deferred and who may write each half. |
| **Decision entry** | **None owed.** `04-architecture.md:22` and `:182` have said React + Vite + Tailwind since 2026-08-22, and Q-0118 ruled that *executing a landed document is not changing the architecture*. One **is** owed if the gate reverses §6.3, and it is the human's. |
| **Product-agnostic** | **AC-9's scan.** No mockup project name and no SaaS name in shipped strings. |
| **Cross-vendor rule** | n/a to the deliverable; satisfied by the route in §10. |

---

## 10. Route, and size

**Q-0014, the shell: the chore flow.** `developer-generalist`'s frontmatter carries `apps`, `docs` and
`eslint.config.js` (§1.6), so every surface this ticket names is writable, no role grant is needed and
no round is spent on a correct refusal — Q-0013's GO-1 precedent. A scaffold has no behaviour a test
could fail on before it exists, which is the chore flow's own stated rationale.

**The child: recommended for the full pipeline, and the gate should take that deliberately.** M2's
closing measurement is that `solutioning`, `qa-red` and `development` were exercised by four tickets in
the whole project, three of them M1's, against fifty-five chore runs — so the flows M3's feature work
will use have the least evidence behind them of anything here. Q-0013's gate deferred this argument
rather than refuting it, and the child is the first M3 work with behaviour a red test can fail on: a
frame parser, a state machine and a socket lifecycle are exactly what a contract-then-red-then-green
route is for. Deferring it again makes Q-0015 the next candidate and the argument one ticket older.
The cost is real and is the gate's to weigh; what this document refuses is deferring it *silently*.

**On size: eleven, against the fifteen the 2026-08-22 sizing decision permits and the eighteen and
nineteen Q-0013 and this merge were refused at.** The child is eight. Both are inside the ceiling with
room, which is the point of the cut.

---

## 11. Provenance

**Claude's candidate is the stronger document and wins every disagreement of fact**, because it
measured rather than assumed. Taken from it substantially unchanged: §1.1's finding that
`@quorum/server` is unimportable; §1.2's byte pin on `vitest.config.js`; §1.3's `.tsx` lint gap, which
nothing else in this repository had noticed; §1.8's rail table; §1.9's absent `GET /runs` and Appendix
B; the same-origin-not-CORS argument (child AC-13); §6.3's build-task recommendation; the
*Test:*-clause-bounds-the-instrument discipline; AC-5, AC-6's register-not-count shape, AC-10's
one-definition property, and child AC-14, AC-15, AC-16; and R-1 to R-6.

**Codex's candidate supplies the coverage claude's omits**, and each of these is taken because the gap
was real: the route map with its dynamic segments (AC-6), without which claude's own connection
criteria have no route to mount in; the placeholder contract's *fabricates nothing, mutates nothing*
clause and the decoded dynamic segment (AC-7); the Not found view (AC-8); the top bar's reserved
regions and explicit not-loaded strings (AC-9); the semantic token list (AC-10); socket lifecycle
cleanup (child AC-17); manual retry with its reasoning about a missing resume cursor (child AC-18);
and the no-persistence rule (child AC-19), which claude carried only as a risk.

**Struck from codex:** AC-13's import of `@quorum/server`, which does not compile (§1.1); AC-24's DOM
and integration suite, which cannot be configured where it is asked for (§1.2); AC-22's decision entry
as a criterion, which names a surface the flow cannot write (§1.6) and would stop the run on round
one; AC-11's sub-1024px responsiveness, the right property in the wrong ticket (non-goal 9); AC-25's
`UNCREATED` clause, already satisfied (§1.10); the electric-teal literal, which the brief offers as a
choice and which is instead **derived** (§1.7); and the twelve conformance criteria (AC-26 to AC-30
and neighbours) that restate standing rules without adding a testable obligation — those are §9's
checklist, not criteria.

**Struck from claude:** the DOM-tests-are-out-of-scope ruling (its OQ-D), because it leaves fourteen
criteria satisfiable without the application ever mounting.

**From iteration 1 of this merge, carried:** the cut and the argument that it is also the route seam
(§3); §1.11's `.test.tsx` triple blind spot and the naming rule that bounds it; §1.10's
already-satisfied `UNCREATED` criterion; AC-2's per-file `@vitest-environment` route through the byte
pin; and AC-11's placement in `docs.test.ts` to avoid earning `apps/web` a `turbo.json` for one
anchor.

**New in iteration 2, and none of it from either candidate:** §1.4, that a `build` script turns **two**
clauses of `test-discovery.test.ts` red and falsifies `04-architecture.md:149–151` besides, where
iteration 1 named one register row; §1.5, that `wireRefusalOf` and `wireRunOf` are typed against host
types and stay behind, so the move is three interfaces and a schema; §1.6, the role's frontmatter read
off the file the engine loads, which is what makes the amend-versus-coin distinction actionable; §1.7,
that the no-third-party-font clause contradicts the very document it cites and that the brief's own
status table forces the accent colour; and §0's reclassification of two blockers, which is this
iteration's whole reason for existing.

---

## Appendix A — successor body: the live connection

*Written out in full so the obligation is a ticket's worth of text at the gate rather than a sentence
in a closed document. The id is the allocator's at this gate, as Q-0118's and Q-0119's were.*

**Problem.** Q-0118 shipped a WebSocket carrying one event per message, an envelope that tells a late
subscriber how many events it missed, and a refusal body carrying a code, `core`'s own condition and a
remedy. **Nothing consumes any of it**, and the shapes it exports cannot be imported (§1.1). Until a
client exists, `DEFAULT_RETENTION`, the 1013 backpressure close and the 1008 unknown-run close are
behaviour no test outside `packages/server` has ever exercised. Q-0014 ships the route that holds a run
and the top-bar region that holds connection status; this fills both.

**Its one blocking question, inherited: where do the three wire shapes live?** *Owner: that ticket's
gate, before implementation.* Two answers.

**(A) Give `@quorum/server` an export surface** mirroring `@quorum/core`'s. *Cost:* it is Q-0096's six
criteria arriving inside another ticket; the `default` condition would name a `dist/` this package has
no build script to produce, which is the artifact-that-does-not-exist decision 078 rejects; and it
leaves a value import one keystroke from pulling `hono`, `@quorum/core` and `node:` builtins into a
browser bundle, where AC-5 is a guard and a guard is weaker than an impossibility.

**(B) Recommended. Move the three interfaces into `@quorum/shared` with a `WireMessage` schema beside
them**, and have `packages/server/src/wire.ts` re-export so Q-0118's barrel keeps every name it exports
today. *Why:* AC-14 needs a runtime **parser**, not a type — a type buys nothing against `JSON.parse` —
so the schema must live where a browser can execute it; `@quorum/shared` is the only package with an
`exports` map, a browser-safety guard, and a header that **names this app as its reason**. The three
interfaces are free of host types: `WireRefusal` is three strings, `WireRun` four primitives,
`WireMessage`'s event field `unknown`. The direction is `server → shared`, the normal one
`04-architecture.md:61` already states.

**What moves is smaller than it looks, measured (§1.5):** the three interfaces and a new schema.
`badRequest`, `wireRefusalOf(code, refusal: Refusal)` and `wireRunOf(outcome: StartOutcome)` stay, the
last two being typed against `./host.js` and `./refusal.js`, and so do the three status tables, typed
against `AnswerRefusal` and `StopRefusal`.

**Two measured caveats that will each cost a round if they are not said in advance.**
`packages/shared/src/index.test.ts` asserts the literal `@quorum/` appears in **no file under
`packages/shared/src`, tests included** — which is why that file assembles the needle at run time — so
`WireMessage`'s JSDoc, which currently reads *"`event` is `@quorum/shared`'s `Event` unaltered"*, must
be reworded, and any new test for the moved schema must assemble its needles too. And the same file
asserts every import specifier under `src/` is `./…` or `zod`, so nothing moved may bring an import
with it.

**AC-12 — the three wire shapes have exactly one definition, and it is reachable from a browser
bundle.** No interface, type alias or object literal in `apps/web` restates any of their fields, and
`packages/server` continues to export every name Q-0118's barrel exports today. ***Test:*** a source
scan asserts `condition`, `remedy` and `handle` appear in `apps/web` only in expression position and
never in a declaration, and that the module holding the definitions is imported both by
`packages/server/src/wire.ts` and by at least one `apps/web` source file; shown to have a subject by
reporting a violation over a fixture that re-declares `WireRun`.

**AC-13 — the client reaches the daemon same-origin, and the dev server is what bridges it.** Every
request and the WebSocket upgrade use a path relative to the page's own origin; no absolute URL,
hostname, port, `ws://` or `wss://` literal appears in `apps/web/src`, and a socket URL derives its
scheme from the page's (`ws:` for `http:`, `wss:` for `https:`) with the handle encoded as one path
segment. `apps/web/vite.config.ts` proxies `/runs`, `/project`, `/tickets`, `/flows` and `/history`,
WebSocket upgrade included, to a target read from configuration with a documented default. **No CORS
middleware, header or dependency is added to `packages/server`, and `BIND_HOSTNAME` does not move** —
adding CORS to an unauthenticated loopback daemon that starts agent runs widens exactly what that
constant's own JSDoc refuses to widen. ***Test:*** a source scan for the forbidden literals with
`vite.config.ts` the one exemption; a separate assertion reads `packages/server/src/*.ts` and its
manifest and asserts neither gained the string `cors`. The proxy's own correctness is an integration
concern and is deliberately **not** claimed — the bound is that the source is same-origin, which is
what makes the eventually-served bundle work unchanged.

**AC-14 — a frame is parsed, never cast, and each refusal is distinguishable.** An `event` frame's
payload goes through `@quorum/shared`'s `eventSchema`, a `missed` frame's `count` is checked to be a
number, and anything else is refused and surfaced rather than ignored — *"Errors are explicit … never
default silently"*, and a `JSON.parse` result assigned to `WireMessage` is a silent default.
***Test:*** the parser is a pure function driven with (a) a valid event frame, (b) a valid missed
frame, (c) an unknown `type`, (d) an event that fails `eventSchema`, (e) a non-object and (f) a
non-text message; each of (c) to (f) produces a **distinguishable** refusal asserted by value, because
a single catch-all satisfies a weaker assertion while telling the user the same wrong thing four
times.

**AC-15 — the connection has a named state for every case and none of them is silence.** At minimum:
*connecting*, *live*, **no daemon** (the socket could not be opened at all), *no such run* (the daemon
answered and closed 1008), *ended* (a terminal event then a normal close), *interrupted* (a close
before a terminal event, carrying the browser's close reason as **text**), *dropped* (1013, this
subscriber fell behind) and *protocol error* (AC-14). Each renders in the top bar's connection region
in plain language, and **no daemon** names the address the client tried. The distinction between *no
daemon* and *no such run* is load-bearing: they are "start the daemon" and "that handle is wrong".
***Test:*** the state machine is a pure reducer driven over each transition and asserted **by value**;
those two are asserted to produce different states **and** different user-facing strings, which is the
clause a single catch-all fails.

**AC-16 — a `missed` count is reported, and a refusal renders what it carries.** A
`{type:'missed', count:n}` frame is surfaced with its count, never dropped and never emitted as an
event. A refusal renders from its `condition` — `core`'s sentence unaltered — and its `remedy` where
one is present; a `code` this client does not recognise **still renders its condition** rather than
being replaced by a generic message. No ANSI escape, colour code or vendor branching is introduced into
anything that crosses the wire. ***Test:*** the renderer is driven with a known code carrying a remedy,
a known code with `remedy: null`, and an **invented** code, asserting the exact `condition` string
appears in all three and that the unknown code did not suppress it; the missed handler is driven with
`count: 0` and `count: 7`, and the second must surface the number 7.

**AC-17 — one socket at a time, and leaving closes it.** Leaving the run route, changing the handle, or
unmounting closes the active socket and prevents its callbacks from updating anything afterwards.
***Test:*** driven against a fake transport: a handle change closes the first and opens exactly one
replacement, a late callback from the closed socket changes no state, and unmount closes. Asserted over
the transport's own close record rather than over "the run still exists", which is true whether or not
anything was released — the shape Q-0118's round 2 caught.

**AC-18 — retry is explicit, and retrying preserves what arrived.** An interrupted, refused or errored
connection offers a Retry action. **The client does not reconnect automatically**: without a resume
cursor an automatic reconnection either duplicates events or hides a missed prefix, and Q-0118's
envelope exists precisely so a gap is reported rather than smoothed over. Retry closes any previous
socket, opens exactly one replacement, and clears neither the events already accepted nor the
incomplete-replay notice. ***Test:*** over the fake transport; asserted that no socket is created
without an explicit retry, that exactly one replacement is created, and that prior events and the
missed notice survive.

**AC-19 — nothing is persisted in the browser.** Route content, events, the incomplete-replay notice,
the connection state and the run handle are held in memory only. `04-architecture.md:183` permits *"no
client-side persistence beyond UI preferences"*, and a run handle is not a preference. ***Test:*** a
source scan over `apps/web/src` for `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`
and `caches`, shown to have a subject by reporting a violation over a fixture that uses one.

**Sequencing.** After Q-0014, whose AC-6 creates the route it mounts in and whose AC-9 creates the
region it fills. Before or with Q-0015, whose mission control is the first screen that needs it.

---

## Appendix B — successor body: the daemon reports its live runs

**Problem.** `RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that. Nine
routes are registered and `POST /runs` is the only one that ever tells a client a handle (§1.9). A
browser that refreshes has lost every live run, and `DEFAULT_RETENTION`'s late-joiner buffer — built
precisely for *"a browser opened after a run began, or reopened after a refresh"* — is unreachable,
because the reopened browser cannot name the run.

**What it owes.** A `GET /runs` listing the host's live runs as `WireRun`s and a `GET /runs/:id`
answering one. Both are reads over state the host already holds; neither adds domain logic. The open
question is whether `RunHost` gains an enumeration or the transport keeps its own index — the first is
where the state is, the second keeps the host's surface at what Q-0013 proved.

**What it must not do.** Persist a handle in the browser — `04-architecture.md:183` permits no
client-side persistence beyond UI preferences. And it must not report a run it cannot back: a handle
whose stream has ended is `ended`, a state `RunView` already carries, not an absence.

**Sequencing.** After Q-0014, which creates a browser that can reload, and before or with Q-0015.

---

## Appendix C — successor body: the daemon serves the built web app

**Problem.** `04-architecture.md:149–151` says the server *"will serve `apps/web`'s build output"*, and
today `apps/web` has no build task and `packages/server` serves no file. M3's done-when includes
`quorum open` starting the daemon and a browser, which needs both.

**What it owes.** A `build` script and task for `apps/web`; a static route on the daemon; and **the
glossary ruling Q-0014 deferred** — whether a served bundle is an **emitted artifact**, or a third kind
beside the artifact and the binary. The glossary as written says the emitted files are *"JavaScript and
declaration files"* and that the three emitting packages *"are also the local distribution set"*; a
bundle has neither property, so one of those sentences moves whichever way it is ruled.

**Who may write which half, read off the role file rather than inferred (§1.6).** *Amending*
`docs/GLOSSARY.md` is within `developer-generalist`'s `paths:` and may be a criterion. *Coining* a new
term moves `CLAUDE.md`'s list, which is not in those paths at all and which Q-0103 erratum E-2 makes
the human's. The **decision entry is the human's either way**, that role's own instructions naming
`docs/decisions/` as the first example of `blocked`. So the entry and any coined term are gate
obligations and **may not be criteria** — *"A requirement may not name a surface its flow cannot
write"* (2026-08-25), which this repository has paid for four times.

**What moves, measured.** `test-discovery.test.ts:271`'s emitting register becomes four entries led by
`apps/web`, `PACKAGES` being sorted; **the stub clause below it asserts `scripts.build` is `undefined`
for every non-emitting package and goes red too** — iteration 1 named only the first;
`04-architecture.md:149–151`'s *"that app has no build task and emits nothing today"* becomes false;
and `docs.test.ts` holds four clauses of the glossary term. **Nothing else:** `.gitignore` already
carries `dist/`, `packages/core/turbo.json` already declares `../../apps/*/package.json`,
`vitest.shared.js`'s `exclude` already carries `**/dist/**` so an emitted test cannot be collected, and
`build.test.ts`'s dependents register is over the three packed packages and does not move. All five
checked rather than assumed.

**Read first.** *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02): its
argument is that a non-empty `outputs` replays an **artifact** where the other three tasks replay a
verdict, and a bundle inherits that hazard the moment something executes it.
