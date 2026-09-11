# Q-0014 — implement, run 2, iteration 1

*The shell: AC-1 to AC-11. Verdict: **proceed**. Thirteen new files, seven modified. 21/21 turbo
tasks forced, 0 cached, 2,541 tests passed and 2 skipped.*

---

## 1. What shipped, file by file

### New, under `apps/web`

| file | what it is |
| --- | --- |
| `index.html` | The Vite entry. Links `src/theme.css` rather than importing it from TypeScript, so no source file needs a module declaration for CSS and `tsconfig.json` needs no `types` override. Carries no font link and no URL of any kind. |
| `src/routes.ts` | **The two registers AC-6 asks for.** `RAIL` is the seven entries `05-design-prompt.md:21` names, in its order; `ROUTES` is the twelve paths, one of them the `/` redirect. Each screen row carries its screen name, its ticket or an explicit `null`, and the sentence the placeholder shows. |
| `src/router.ts` | Matching, and nothing else. `resolve`, `resolveFinal` (a redirect followed, hops bounded by the register's own size), `activeRailPath` (segment-boundary prefix, so `/runs/<handle>` lights Runs and `/harnessed` lights nothing). Never throws: a segment that will not decode fails the match rather than the process. |
| `src/shell.tsx` | Rail, top bar, layout. Exports `NOT_LOADED`, `TOP_BAR_REGIONS`, `CONNECTION_PENDING`, `RUN_FLOW_LABEL` so the test derives the region count rather than hard-coding it. |
| `src/views.tsx` | `Placeholder` and `NotFound`. |
| `src/app.tsx` | Current path, `pushState` navigation, a `popstate` listener, and the `replaceState` that corrects the address bar after a redirect has already decided what is drawn. |
| `src/main.tsx` | Mounts into `#root`, refusing rather than defaulting when it is absent. |
| `src/theme.css` | **The one place a colour is written down.** Eleven semantic tokens plus the two local type stacks. |
| `src/package.test.ts` | AC-1, AC-3. |
| `src/routes.test.ts` | AC-6. |
| `src/shell.test.ts` | AC-2, AC-7, AC-8, AC-9 — the only file with a DOM. |
| `src/source.test.ts` | AC-5, AC-9's name scan, AC-10. |
| `src/lint-coverage.test.ts` | AC-4. |

### Modified

| file | change |
| --- | --- |
| `apps/web/package.json` | Two dependencies, six devDependencies. **No `build` script** — non-goal 3. |
| `apps/web/tsconfig.json` | `jsx: react-jsx` and `lib: [es2023, dom, dom.iterable]`. Nothing in the `strict` family, and it still extends the one base. |
| `apps/web/vite.config.ts` | The two plugins. No `build` section, no `base`, no proxy. |
| `eslint.config.js` | `files` gains `apps/**/*.tsx`. Nothing else moved: no rule added, removed or downgraded, nothing added to `ignores`. |
| `docs/04-architecture.md` | §`apps/web` rewritten to what shipped; the status line records `Q-0014` and `2026-09-11`. |
| `packages/shared/src/docs.test.ts` | AC-11's two anchors plus an anti-vacuity clause. |
| `pnpm-lock.yaml` | The consequence of AC-1. See §5. |

---

## 2. The two open mechanisms (GO-2), and how each was taken

**The palette.** Tailwind v4's `@theme` is both halves of GO-2's recommendation in one declaration:
it emits the tokens as CSS custom properties on `:root`, so raw CSS a later trace column needs can
reach them, *and* it registers the utility namespace, so a component says `bg-surface` and never a
colour. AC-10 asserts the one-definition property and not the mechanism, so this can change without
moving a criterion.

**The router: none.** Justified in `router.ts`'s own header. The register is twelve closed paths with
at most two dynamic segments, and AC-6 requires the router be built *from* that register in any case
— so a library would be adapted to the table rather than replacing it. It is about forty lines
against a dependency on the cold-clone install path R-1 is about.

**The accent is teal, and it is derived rather than chosen.** `05-design-prompt.md:17` offers
*"electric teal or amber — pick one"* and then, in the same paragraph, assigns
`waiting-on-human = amber` and `running = accent pulse`. An amber accent puts *a human must act* and
*the machine is working* one animation apart. `source.test.ts` asserts the property — accent ≠
waiting-on-human, and running = accent — rather than the particular hex, so the reasoning survives a
palette tweak.

**Nothing is fetched from a network**, which is the deliberate divergence §1.7 authorises, recorded
in `theme.css` in place with its reason and enforced by a scan over the whole package.

---

## 3. Criterion by criterion

**AC-1.** Eight dependencies, each with a line. **The instrument was read and not followed
literally, and this is the one place I substituted one — stated rather than done quietly.** The
*Test:* clause asks that every declared dependency "appears in the implement report's justification
list". No test can read that: the report is written by the engine *after* this step, into a
run-scoped path under `backlog/`, which is a surface no role may write and which does not exist
while the suite runs. So the list is held in `JUSTIFICATIONS` in `src/package.test.ts`, asserted
against the manifest **in both directions** — a dependency with no reason fails, a reason whose
dependency has gone fails — and reproduced below verbatim. That is what the criterion's normative
half actually asks for, and it is what `packages/server/src/package.test.ts` already does for
Q-0118's three. A list nobody can read is not a check.

> `react` — the UI framework `docs/04-architecture.md:182` names; nothing here is a second choice of framework.
> `react-dom` — React's renderer for a browser document — the half that actually mounts, and what AC-2's smoke test drives.
> `@vitejs/plugin-react` — teaches this package's Vite build to compile JSX; without it no `.tsx` file is transformed at all.
> `tailwindcss` — the styling system `docs/04-architecture.md:182` names, and where the palette is declared as theme tokens.
> `@tailwindcss/vite` — Tailwind v4's Vite integration; v4 is a Vite plugin rather than a PostCSS step, so this is how it runs at all.
> `jsdom` — the document AC-2 mounts into, selected by one test file's own environment docblock rather than by configuration.
> `@types/react` — React ships no types of its own, so this is what makes `tsc --noEmit` cover the app's components.
> `@types/react-dom` — the same, for the renderer half.

**No router dependency**, which AC-1 permits as "the recorded decision to write none" — §2 above.

The peer ranges were measured on the way in rather than discovered by a user (Q-0118's lesson):
`@vitejs/plugin-react@6.1.1` peers on `vite: ^8.0.0` against the root's `^8.2.2`, and its three other
peers are `optional: true`. The install reports no unmet peer.

The credential scan covers **every** file in the package, configuration included, and its five
needles are assembled at run time — the scan reads its own file, so a written-out needle would report
the check itself. It asserts the walk collected more than one file, and a companion clause shows the
same five needles finding two in a fixture that leaks.

**AC-2.** `index.html` plus `src/main.tsx`; one smoke test renders `App` into a real document and
asserts a rail, a top bar and a view region without throwing. **"With no daemon running" is asserted
rather than arranged**: `fetch` and `WebSocket` are replaced with recording, throwing stubs for the
duration and the recording is asserted empty, so a shell that reached for the network would fail here
instead of quietly rendering an empty state. `apps/web/vitest.config.js` is **untouched, byte for
byte**, and `vitest.shared.js` is not edited — the DOM comes from a per-file
environment docblock, which is a property of the file rather than of the configuration, so
`test-discovery.test.ts:176`'s byte pin does not move. **Every test file this ticket adds ends
`.test.ts`**, and `shell.test.ts`'s header records why.

**AC-3.** `pnpm --filter @quorum/web typecheck` exits 0 over the shipped tree. The test asserts the
package still extends the one base, that `jsx` and a DOM lib are set, and that `strict` is
`undefined` **and** that no `strict*`-family key is set locally at all.

**AC-4.** See §4 — demonstrated red before green with the real tool as well as with the pattern
lists.

**AC-5.** The `packages/shared/src/index.test.ts:102` shape aimed at `apps/web`, with the same
builtin list plus `@quorum/core`. Scoped to **shipping** files — non-test `.ts`/`.tsx` — which is
what that source shape does and what the criterion is about; this file itself imports two of the
things it forbids. Both needles are assembled. The floor clause requires more than five shipping
files *and* names one by hand, so a walk that had lost its subject cannot pass.

**AC-6.** The seven rail ids by `toStrictEqual` in the brief's order; the twelve paths by
`toStrictEqual` in declaration order; uniqueness; every rail entry static and resolvable; the router
driven through **the register's own patterns** with dynamic segments filled, so it is exercised over
exactly what the table declares rather than a hand-written sample. The component scan collects quoted
literals beginning with `/` from the `.tsx` files and refuses any the tables do not hold — over raw
text rather than code alone, which over-collects, and that is the safe direction. A fixture clause
shows it reporting an invented path while passing a registered one.

**AC-7.** Every screen route's placeholder is rendered and asserted to contain its screen name, the
absent-screen sentence, and **the register's own explanation string** — not a paraphrase. Routes with
a ticket show it; the three without render no ticket line at all and are asserted to contain no `Q-`
id, with a companion clause asserting there are exactly three of them so the negative does not run
over nothing. A percent-encoded segment is driven end to end and the decoded value asserted present
*and* the raw encoding asserted absent. A further clause asserts no placeholder renders a currency
figure, a token count, a button or an input.

**AC-8.** Driven with an unmatched path and with `/backlog/%E0%A4%A`; both assert the view rendered,
the path shown as text, and the rail and top bar still present. A third clause asserts
`decodeURIComponent` really does throw on that string, so the second row is a malformed-encoding case
rather than a second unmatched path.

**AC-9.** The not-loaded string is counted, not merely found: `occurrences(headerText, NOT_LOADED)`
must equal `TOP_BAR_REGIONS.length`, so a region that is loaded, empty or duplicated fails. The
control is asserted `disabled`. The connection region is asserted to carry its sentence and to name a
successor. The mockup's three project names and two SaaS names are scanned for under `src` with
assembled needles and a discriminating fixture.

**AC-10.** One palette file, named as the single exemption and asserted to exist and be substantial;
the eleven token names asserted present, with the count pinned at eleven so a palette declaring nine
fails rather than passing with a gap; no hex, `rgb(`, `rgba(` or `hsl(` in any other file under
`src`. The needles are assembled and a fixture clause shows each shape found — **and the palette
itself is asserted to contain a hex value**, so the "no colour elsewhere" clause is known not to be
excusing an empty set. Plus: background not pure black, accent ≠ waiting-on-human, running = accent,
no gradient or backdrop filter, and no `http://`, `https://` or `//fonts.` anywhere in the package —
that last scan asserted to reach `index.html` and `package.json`, because a font link belongs in the
HTML more naturally than anywhere else.

**AC-11.** §`apps/web` rewritten; status line records the ticket and the date. The two anchors live in
`docs.test.ts` and not in an `apps/web` test, for the measured reason the criterion gives. The
section is **sliced** rather than searched — this page's package map and its status line both name
`apps/web`, so a whole-document search would be satisfied by a sentence written in August. The slice
ends at the next `##` rather than the next `###`, because `apps/web` is the last `###` on the page.

---

## 4. What was demonstrated rather than read

**AC-4, red before green, with ESLint itself.** A `.tsx` file containing `(value: any)` was written
into `apps/web/src`, and `pnpm --filter @quorum/web lint` run twice against it:

- under the **pre-change** `files` list — `['packages/**/*.ts', 'apps/**/*.ts']` — the `any` is
  reported by **nothing** and the command exits **0**;
- under the **shipped** list it is
  `error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any` and the
  command exits **1**.

The fixture was then deleted. That run also surfaced a real defect in my own first draft — an
`eslint-disable-next-line no-var` in `shell.test.ts` that disabled a rule this config does not
configure, reported as `Unused eslint-disable directive` — now removed, the comment replaced with the
reason `var` is what a global declaration takes.

Beside that, the test holds **two assertions over two pattern lists** as the criterion asks, with the
shipped list read out of the file rather than transcribed and a matcher that *refuses* a glob shape
it does not understand; a discrimination clause showing the new list does not match everything
(`.ts` in, `.css`, `.html` and a doc out); a clause pinning the three rules and the four `ignores`
entries, so a policy change fails here; and a clause asking **ESLint's own** `calculateConfigForFile`
whether the three rules resolve at error severity for a real `.tsx` path.

**Six guards mutated on shipped files, each red with a distinct message.**

| mutation | what failed |
| --- | --- |
| `views.tsx` reaches for `'/dashboard'` | `a component names a path the register does not: [ 'views.tsx: /dashboard' ]` |
| a hex literal in `shell.tsx` | `a colour is written outside the palette: [ 'shell.tsx: a hex literal' ]` |
| the `Run flow` control loses `disabled` | `the control is enabled with nothing behind it` |
| `/runs` borrows `Q-0015` | `expected [ '/projects', '/settings' ] to strictly equal [ '/projects', '/runs', '/settings' ]` |
| the status line drops `Q-0014` | `the status line does not record this change` |
| the section says "routing table" | `the section does not name the route register` |

**The Vite config is exercised by no test, so it was exercised by hand.** Vitest loads
`vitest.config.js`, which re-exports `vitest.shared.js`, so `vite.config.ts` is never read by the
suite and neither plugin is loaded during a test run. `vite build` was run once: 20 modules
transformed, the CSS carrying `color-accent:#2dd4bf` and the generated utilities, 226 kB of JS. The
output was removed (`dist/` is gitignored). Recorded as an observation, not closed: a criterion
covering it needs a build task, which is Q-0122's.

**Four wrong assumptions of mine, caught by writing each criterion's test in the same pass.** This is
Q-0119's discipline and it paid the same way.

1. A JSDoc line quoting the `apps` test glob contained `*/`, which **closed the block comment** and
   broke the file's parse. Caught by the first run of the file, not by reading it.
2. Vitest scans the **whole file** for `@vitest-environment`, not only its first comment — so writing
   that token inside a dependency justification string made the runner try to load an environment
   called `docblock` and fail before collecting a single test.
3. Two needle self-hits: `source.test.ts` carried literal hex values and a literal `//fonts.` inside
   its own fixtures, which its own scans then reported. Both assembled now; the second correction
   also made the fixture clause *stronger*, since a font link legitimately trips two of the three
   needles rather than one.
4. **`App`'s `= {}` default parameter made `createElement(App, { initialPath })` a type error while
   every Vitest run stayed green**, because Vitest strips types. Six test files and 93 green tests
   said nothing; `tsc --noEmit` said `'initialPath' does not exist in type 'Attributes'` at eight
   sites. The argument for running the typecheck rather than trusting a green suite, in one measured
   instance.

---

## 5. R-1 and GO-4 — the install measurement, and the half I could not take

Both sides measured on this machine, from an **empty `node_modules`** for the before row.

| | packages | `node_modules` | `pnpm install --frozen-lockfile` |
| --- | --- | --- | --- |
| before | 143 | 131,012 KB (128 MB) | 660 ms, warm store |
| after | 200 (+67, −10 by dedupe) | 196,924 KB (192 MB) | **not comparably measured** |

**The disk half is comparable and is the answer: +65,912 KB, +50.3%.** Both rows are a full
`node_modules` for the whole workspace on the same machine.

**The wall-time half is not, and I am not going to present it as if it were.** The `after` install was
*incremental* — 2.9 s on top of an already-populated tree — which is not the same measurement as the
`before` row. Re-taking it needs either removing `node_modules` or installing a copy of the manifests
into a temp workspace with a temp store, and **both routes were refused in this environment**
(`rm -rf node_modules …` denied; the temp-workspace staging command denied). The `before` row is also
a **warm** store rather than the clean store GO-4 names, so it under-states a genuine cold-clone
install on both sides equally. **Left for the gate**, which GO-4 explicitly permits ("taken at the
gate or in the implement report"): what is owed is one clean-store timed install per side.

---

## 6. Verification

Run in this implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`.

- `pnpm turbo run lint typecheck test --force --continue` → **21 successful, 21 total, 0 cached.**
- Tests: `@quorum/web` 6 files / **93**, `@quorum/core` 61 / 1,511 (1 file, 2 tests skipped — the
  live-CLI probe), `@quorum/cli` 25 / 628, `@quorum/shared` 12 / 180, `@quorum/server` 8 / 127,
  `@quorum/compiler` 1 / 1, `@quorum/templates` 1 / 1. **2,541 passed, 2 skipped.**
- `pnpm turbo run build` → 3/3.
- `pnpm exec quorum lint` → **6/6 flows**.
- `pnpm sweep:git-identity` → `environment discriminates (negative and positive probes both as
  expected)` and `the workspace suite executed and green with no resolvable git identity`, 7/7 tasks
  forced, 0 cached. It runs in this linked worktree, which is Q-0058's fix holding.
- `pnpm lint` is clean apart from one **pre-existing** warning in `packages/core` — see the
  observations.

The second environment row — forced on `main` after the merge — is `integrate`'s and the gate's, per
Q-0072's closing finding.

Guards that could have moved and did not, checked rather than assumed:
`test-discovery.test.ts`'s emitting register is still `['packages/cli', 'packages/core',
'packages/shared']` and its stub clause still finds `apps/web`'s `scripts.build` undefined;
`apps/web/vitest.config.js` is byte-identical; `turbo-inputs.test.ts` is green with no new
registration, `eslint.config.js` being a root `globalDependency` and `docs/04-architecture.md`
already a declared input of `@quorum/shared#test`.

---

## 7. What I deliberately left alone

- **The build task and everything it implies** — non-goal 3. `apps/web` declares no `build` script,
  so `emittingPackages()` is still three, the stub clause below it still holds, and
  `04-architecture.md:149–151` stays true. The glossary is untouched and **no term is added**:
  whether a served bundle is an **emitted artifact** is Q-0122's, with the task.
- **The live connection** — non-goal 2. No WebSocket client, no frame parser, no connection state
  machine. The top bar reserves the region and names Q-0120.
- **`GET /runs`, any server route, and reconnecting across a reload** — non-goal 4.
- **The three wire shapes.** Nothing in `apps/web` imports or re-declares `WireRun`, `WireRefusal` or
  `WireMessage`; `packages/server` is untouched.
- **Authentication, the bind, CORS** — non-goal 5. `packages/server` is untouched.
- **"Override with reason"** — non-goal 6. No route, control, register entry or string mentions an
  override or a reason field.
- **Responsive behaviour below 1024 px** — non-goal 9. Nothing forbids it; nothing asserts it.
- **Widening `testFilesIn` to see `.test.tsx`** — non-goal 10, R-3. Bounded by the naming rule
  instead, with the reasoning in `shell.test.ts`'s header.
- **`docs/06-development-plan.md`** — non-goal 11.
- **`turbo.json`, `vitest.shared.js`, `tsconfig.base.json`, `CLAUDE.md`, `docs/GLOSSARY.md`,
  `docs/decisions/`, CI** — non-goal 12. None edited.
- **`apps/web/src/index.ts` and `src/index.test.ts`**, the stub's own module and its test, left
  exactly as they were. Nothing sent me to change them.
- **The screens** — Q-0015 to Q-0018, Q-0020 to Q-0022, `quorum open`.

---

## 8. Two tensions in the requirement, resolved and reported

**The surfaces header against AC-11.** §0's header lists `packages/shared` under **Not**, while AC-11
instructs in as many words that the assertion lives in `packages/shared/src/docs.test.ts` and gives a
measured reason. I followed the criterion, which is the more specific instruction and the one with
the argument attached; the header is about the production surfaces this ticket does not touch, and no
`packages/shared` source file moved — only its suite gained a block.

**`pnpm-lock.yaml` against my role's `paths:`.** That file is not in the list, and AC-1 mandates
dependencies, which cannot be installed without it; leaving it stale would break CI, which installs
frozen. I judged this the mechanical consequence of a change to `package.json` — which *is* in the
list — rather than a surface I decided to touch, and the precedent is unambiguous: eight prior
`implement:` commits wrote it (Q-0008, Q-0041, Q-0043, Q-0045, Q-0090, Q-0098 and Q-0013 through the
flows; Q-0118 by hand). Not `blocked`, and reported here so the gate can rule it rather than
discover it.

**§1.2's "one DOM smoke test, everything else register-driven"** bounds AC-2's instrument; AC-7, AC-8
and AC-9 each have *Test:* clauses that require rendered text and cannot be satisfied without a
document. All four live in one file behind one environment docblock, and nothing else in the package
uses a DOM.
