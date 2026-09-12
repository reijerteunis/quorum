# Q-0122 — implement report, run 2, iteration 1

**Verdict: `proceed`.** Twenty criteria under erratum E-1, all satisfied. Nothing required a
`docs/decisions/` entry (092 landed at the gate, E-2), a file outside `developer-generalist`'s
paths, or behaviour a landed decision preserves.

---

## 0. What was measured before anything was written

The requirement's **R-3** says the isolated copy may not build and that this is unproven, and that
the answer decides OQ-3. It was taken first.

| measurement | result |
| --- | --- |
| `vite build` in the real workspace | 116 modules, 3 files under `dist/`, **309 ms**; nothing written outside `dist/`, no `node_modules/.vite` |
| `turbo run build --dry` after the script landed | **four** emitting tasks, each resolving `outputs: ["dist/**"]`, `dependsOn: ["^build"]`; `emitting()[0]` is still `@quorum/cli`, so `build.test.ts`'s mutation target does not move |
| `build.test.ts`'s isolated census with four emitters | **65/65 pass, no edit** |
| forced four-package build, real workspace | **3.20 s** (2.46 s in the second row) against 2.1 s for three |
| `end-to-end.test.ts` whole file | 5.57 s / 5.67 s, against 4.8–5.9 s recorded for three · budget 90 s |
| `failure-paths.test.ts` whole file | 5.22 s / 5.44 s, against 5.0–5.8 s recorded for three · budget 60 s per invocation |
| `step-id.test.ts` whole file | 3.26 s / 3.26 s · budget **180 s**, 55× |
| the three together, four emitters vs three | 6.34 s vs 6.16 s — **within noise** |

**OQ-3 is answered by measurement, and the answer is the one the requirement said to take if the
build was cheap: leave `isolate()` alone.** It is not parameterised, the distribution set is not
substituted for the emitting set, and **no timeout moves**. What moves is the prose in three
docblocks that described a build that no longer happens (AC-6).

---

## 1. What changed, file by file

### The emit half

**`apps/web/package.json`** — `"build": "rm -rf dist && vite build"`, and `vite@^8.2.2` in
`devDependencies` (OQ-4's recommendation, AC-10). `dependencies` is untouched at
`@quorum/shared`, `react`, `react-dom`, so nothing new reaches a browser. `private: true` stays and
no `exports`, `files`, `main`, `types` or `bin` is added.

**`pnpm-lock.yaml`** — three lines, the `vite` entry for `apps/web` at the root's own resolved
`8.2.2`. Landed with the manifest, so `pnpm install --frozen-lockfile` does not fail after the
implement step has been paid for (AC-10).

**`packages/core/src/test-discovery.test.ts`** — the Q-0097 AC-13 register is
`['apps/web', 'packages/cli', 'packages/core', 'packages/shared']`, still a `toStrictEqual`
identity over sorted entries and never a count (AC-4). Its comment now says four/fifth and cites
092 by title and date. The stub clause below it gained a note — see §3.

**`packages/core/src/turbo-inputs.test.ts`** — a fourth `NOT_READ` row for `'apps/web'`, beside the
three siblings it matches exactly (AC-5). **Not both**: no declaration was added to
`packages/core/turbo.json`.

**`apps/web/test/package.test.ts`** — `the app remains non-emitting` and the `build` half of AC-3's
task clause are **inverted rather than deleted** (Q-0116's precedent): a new
`Q-0122 — the app emits, and what it emits is served rather than shipped` block asserts the build
script and its `rm -rf dist &&` prefix, and asserts `private: true` with none of the five keys that
would make it packable (AC-4, AC-11). The task clause asks for four tasks. `JUSTIFICATIONS` gained
`vite` with the reason it is declared here rather than resolved by directory walk.

**`packages/cli/src/build.test.ts`** — **no existing clause changed.** One test added,
`Q-0122 AC-3(b)`: build the isolated copy, plant a file in every emitter's `dist/`, force a rebuild,
assert each planted file is **gone** — asked as a removal, since a rebuild that merely wrote over it
would satisfy the question phrased the other way. Derived over `emitting()` with `apps/web`
asserted present, so it fails loudly if the package it was written for leaves the set.

**`packages/cli/src/end-to-end.test.ts`, `failure-paths.test.ts`, `step-id.test.ts`** — the three
budget docblocks re-derived against the four-package build (AC-6). No constant moved; the
measurement is what says so.

**`packages/core/tsconfig.build.json`, `packages/cli/tsconfig.build.json`** — *"The three emitting
packages declare the same four options"* → *"The three **distribution** packages"*, with the reason
the fourth has no `tsconfig.build.json` at all.

**`docs/GLOSSARY.md`** (AC-7) — **Build task** runs in four packages and cites 092. **Emitted
artifact** stops saying *"The JavaScript and declaration files"* and stops equating the emitting set
with the local distribution set; it names both sets with their members, states the difference, gives
the two shapes 092 names — **resolved** and **served** — **re-scopes** the *"not a bundle"* clause
rather than deleting it (so it still forbids calling `core`'s `dist/index.js` a bundle while no
longer denying that the served one is one), carries clause 5's stale-page hazard, and cites the
entry by title and date. Both clauses `docs.test.ts` pins survive verbatim; `docs/README.md`'s
`build task, emitted artifact` substring is untouched; **no term is coined**, so neither 22-term
list moves and `CLAUDE.md` is not touched.

**`docs/04-architecture.md`** (AC-8) — the **Shape** paragraph's *"three emitting packages"* → three
**distribution** packages, with the correction named; the cache-hit paragraph names four emitters
and what the fourth declares; §`apps/web` says the app emits; §`packages/server` describes the
static route; the package map's `server/` and `shared/` lines; the status line records `Q-0122` and
`2026-09-12`. `` `dist/**` `` still occurs **exactly once**.

**`harness/product-context.md`** (AC-9) — pillar 7 names the three **distribution** packages. No
installation claim gained or lost. It matters more than an ordinary comment because this file is fed
to every product-manager step at run time.

**`packages/server/src/package.test.ts`** — the comment at the `it emits nothing` clause named the
distribution set and reasoned about the emitting set (AC-11). Corrected; its assertions are
unaffected, a package that emits nothing and ships nothing being outside both.

**`packages/shared/src/docs.test.ts`** — a new `Q-0122 AC-8` clause over the `apps/web` section,
holding it against the claim that the app emits **and** refusing the superseded wording by name,
with a fixture proving the negatives have a subject. Shown red over the previous sentence.

### The serve half

**`packages/shared/src/navigation.ts`** (new, AC-18) — `isNavigationRequest(method, accept)`. The
one definition, in the one package both ends may import, **importing nothing at all**. `HEAD` counts
beside `GET`; a request with no `Accept` is not a navigation.

**`packages/shared/src/index.ts`** — one `export *` line.

**`apps/web/vite.config.ts`** — `bypassNavigation` now calls the shared predicate instead of
spelling the rule itself. The header records the build-script change and the source-path import (§3).

**`packages/core/src/index.ts`** — `pathInside` on the barrel. **`packages/core/src/backlog/confine.ts`**
gained a paragraph saying it has a second caller and why the module stays where it is.

**`packages/cli/src/frame.source.test.ts`, `packages/cli/src/package.test.ts`** — `DOMAIN` 24 → 25
and the three length pins that guard it. See §3 for what that cost.

**`packages/server/src/static.ts`** (new) — the route. The rule is stated once in the header and
implemented once below it: a file under the bundle root is served whatever it accepts; otherwise a
navigation that does not look like a file gets `index.html`; otherwise `next()`. A file-like path
absent from the build is a 404 and never the shell. Confinement is `core`'s `pathInside` and nothing
is added to it; `decodeURIComponent` failures and NUL bytes are refused before it. Content types
come from a closed table whose default is `application/octet-stream` and never `text/html`.
Registered with **`app.get('/*', …)`** deliberately — `registeredRoutes()` does not match `app.use`
at all, so a middleware mount would be invisible to the guard that holds the route set against the
architecture document.

**`packages/server/src/http.ts`** — `AppOptions.bundle`, and `mountStatic` called **first**, ahead of
every other route.

**`packages/server/src/serve.ts`** — `bundle` on `ServeOptions` and `createDaemon`; a supplied root
holding no build **rejects before `serveNode` is reached**.

**`packages/server/src/index.ts` / `index.test.ts`** — seven names on the barrel and in `SURFACE`.

**`packages/server/turbo.json`** (new) — declares the two `apps/web` reads `static.test.ts` makes.
See §3.

**`packages/server/src/static.test.ts`** (new, 19 tests) — AC-12 to AC-18. Everything over a **real
socket** with a raw `node:http` client, because `fetch` builds a `URL` and a `URL` resolves `..`
before a byte leaves the process, so a traversal suite driven through `fetch` would report every
escape refused while never sending one. The bundle is built by the test, not read from
`apps/web/dist`, so no verdict depends on whether anyone had run a build.

---

## 2. Criteria, and how each was established

| | how |
| --- | --- |
| AC-1 | four tasks from `dry('build')`, each resolving the root's declared `outputs`/`dependsOn`; no package-level `turbo.json` for `apps/web` (OQ-5); "at least one file under `dist/`" is `agreesWithTheDeclaration`'s existing per-package clause, which fails if `dist/**` matches nothing the build wrote |
| AC-2 | `build.test.ts`'s two clauses, one on the file and one **through turbo**; both shown red by adding `^build` to the root `test` task |
| AC-3 | (a) the isolated census passes with four emitters, and names a stray when one is written; (b) the new guard, shown red on a `tsc` emitter |
| AC-4 | three of four shown red — see §3 |
| AC-5 | shown red **before** the row was added, in three clauses, naming `apps/web (a directory, and no audited walk covers it)` |
| AC-6 | all three suites pass; the shape taken is *leave `isolate()` alone*; wall-clocks in §0; both docblocks and `step-id.test.ts`'s 180 s re-derived |
| AC-7 | glossary amended; `docs.test.ts` green, both pinned clauses verbatim; 092 cited by title and date; nothing coined |
| AC-8 | four prose sites plus the package map; `dist/**` once (shown red at two); status line; new `docs.test.ts` clause shown red over the previous wording |
| AC-9 | pillar 7 |
| AC-10 | `JUSTIFICATIONS` agrees with the manifest in both directions; `dependencies` unchanged; lockfile moved with the manifest |
| AC-11 | the five keys asserted absent and `private: true` asserted true; `DISTRIBUTION` and `DECLARED_FILES` unmoved; the conflating comment corrected |
| AC-12 | no bundle → no HTML at any path under any `Accept`, and `/project` still answers; `static.ts` names no `import.meta.url`, `import.meta.dirname`, `process.cwd(` or `__dirname` |
| AC-13 | rejects naming `index.html` and the remedy; **shown to bind nothing** by refusing on a port another server already holds — an `EADDRINUSE` would prove the check ran too late, and the holder still answers afterwards |
| AC-14 | twelve paths read out of `ROUTES`, all answering the shell over a socket; **shown red** against the same handler registered after the JSON routes, failing on exactly `/flows`, `/history`, `/runs`, `/runs/q0122` |
| AC-15 | two daemons, one with a bundle and one without, compared on eight `GET`s (including the socket route without an upgrade) under `application/json` and `*/*`, plus the three `POST`s; `HEAD` matches `GET` with the same content-length and no body; the WebSocket upgrades (101) |
| AC-16 | four missing file-like paths 404 under three `Accept`s, with the existing asset served under all three so the clause discriminates; and no shell route looks like a file, asked of `ROUTES` |
| AC-17 | eight traversal spellings over a raw request line against a real file beside the bundle; symlink-out and dangling-link at unit level; directory, empty path, NUL, undecodable escape; content type never `text/html` |
| AC-18 | declared in `@quorum/shared`, that module importing nothing; both ends import it and neither declares one; seven behavioural cases |
| AC-19 | `registeredRoutes()` is twelve with `GET /*`; the architecture section names it; a clause records that `app.use` is unmatched, so the shape chosen is the one the guard can see |
| AC-20 | six documents — see §1 |

---

## 3. What the requirement did not predict, or predicted wrongly

**(a) AC-4 names four assertions; only three are falsified.** `test-discovery.test.ts`'s stub clause
— *"`${pkg}` declares a build script and emits nothing"* — did **not** go red, and cannot: `stubs`
is `PACKAGES.filter(pkg => !emittingPackages().includes(pkg))`, so the fourth emitter *left* that
set rather than failing inside it. Four stubs became three and nothing had to move. The body's
re-measurement §(f) asserted both clauses fail; measured, one does. Recorded in the clause's own
comment, because a prediction of red that does not come true is worth as much as one that does.
**Nothing was changed there to manufacture a red.**

**(b) `build.test.ts` needed no edit.** §7 lists thirteen `emitting()` sites as *"behaviour extends
to a fourth task"*, which is exactly right — all thirteen are derived and all 65 tests passed on the
first run with four emitters. The only addition is AC-3(b)'s new guard.

**(c) AC-3(b)'s mutation does not fire for the package it was written about.** Removing
`rm -rf dist &&` from `apps/web` turns **nothing** red, because Vite empties `outDir` itself.
Removing it from `packages/shared` turns the new guard red naming the survivor
(`packages/shared/dist/q0122-stale.js`). So for three of four the clean step is what the guard
establishes, and for the fourth the property holds by a bundler default this repository does not
own. The `rm -rf` **stays** — uniform with its siblings, and not resting on a default that can move
— but it is **not load-bearing there today**, and both the guard and the manifest pin say so rather
than letting a green be read as evidence it is.

**(d) `vite.config.ts` cannot import `@quorum/shared` by package name.** AC-18 asks that both ends
reach one definition. The obvious import breaks the dev server: Vite bundles its config with its own
resolver, which knows nothing of the `quorum-source` condition, so `from '@quorum/shared'` resolves
to `packages/shared/dist/index.js`. **Measured** by renaming that directory away — the package-name
import dies in `bundleAndLoadConfigFile`, the source-path import builds. The `build` task's `^build`
edge hides this on the build path and not on the dev server, which is the one that file exists for.
Imported as `'../../packages/shared/src/navigation.js'`, with the measurement in the header.

**(e) `packages/server`'s listener guard scanned the tests and never bound them.** *"nothing in this
package opens or listens on anything"* runs over `packageFiles()`, and `static.test.ts` needs
`node:http` for the reason in §1. Rather than exempt the file, the corpus was split by what each
half is about: hand-rolled-transport patterns (`node:net`, `node:tls`, `node:dgram`,
`createServer(`, `.listen(`, `from 'ws'`) stay **whole-package**, and `node:http`/`node:https` narrow
to **production**. The honest half is that this clause never bound the tests anyway —
`serve.test.ts` has driven real sockets since Q-0118 and passes only because `fetch` is a global
needing no import. Both halves have discriminating demonstrations, including that a second server is
still refused in a test.

**(f) A genuinely undeclared read, found by measuring rather than by a red test.** `static.test.ts`
reads `apps/web/src/routes.ts` (AC-14's own instruction) and `apps/web/vite.config.ts` (AC-18).
`turbo-inputs.test.ts`'s `SUITES` is `@quorum/shared#test` and `@quorum/core#test`, so
**`packages/server` is scanned by nobody** and nothing would have reported the omission. Measured:
with no configuration, appending a line to `routes.ts` left `@quorum/server#test`'s hash at
`5d08bff32eb9ceac` — a cached pass would have stood over a changed register. `packages/server/turbo.json`
declares both; re-measured, the hash now moves. **Q-0121's measurement was re-run rather than
inherited** and still holds: `docs/04-architecture.md` moves the hash transitively through
`@quorum/shared#test`, so it is deliberately **not** declared, and that package's comment — which
said *"with no package configuration here at all"* — is corrected with today's hashes.

**(g) Exporting `pathInside` grows a `packages/cli` register for a `packages/server` need.**
`@quorum/core`'s barrel is pinned by exact equality to `frame.source.test.ts`'s `DOMAIN` plus
`ERRORS`, and `DOMAIN` is scoped as *"helpers the frame is forbidden to reimplement"*. `pathInside`
is the **first entry no command names**. That is legal by the register's own shape — `domainOffenders`
never requires a caller — and the entry is true of it, but the cost is real and is stated rather
than hidden. It was taken because `04-architecture.md` principle 3 and `docs/GLOSSARY.md`'s
**Confinement** — *"Enforced in `core`, so the CLI and M3's server inherit one rule instead of each
writing a weaker one"* — both say so, and a third `realpathSync`-based confinement in a third
package is the drift this repository keeps paying for.

**(h) `docs.test.ts`'s `length < 12000` was a proxy that a growing section falsifies.** Documenting
the static route took §`packages/server` to 13,245 characters. **Retired by replacement rather than
by raising the number**: the slice is now asserted not to carry the next heading and not to carry the
status line — the property the ceiling stood in for, in the shape `packages/server`'s own slice
guard already uses — with a loose floor for anti-vacuity.

**(i) Two false sentences found while editing around them, corrected and named.** The package map
said the Hono daemon *"is Q-0118's and does not exist"*, falsified on 2026-09-11 and named by no
criterion here. And `shared/`'s *"ten leaf modules"* was stale by two before this change added a
thirteenth. Both are recorded in the status line.

**(j) The dangling-symlink clause is over-determined on this route.** Replacing `pathInside` with
the lexical check it exists to refuse makes the **escaping** link followed and the test red; the
**dangling** one stays refused, because a read asks `statSync(...).isFile()` and a link to nothing
does not stat. The clause is kept — the criterion names it, and the two are one primitive — but the
test says in its own comment that confinement is not what produces its green, and that where the
clause is load-bearing is a *write* (`O_CREAT` follows a dangling link), which this route never does.

---

## 4. Verification

**Both environment rows, forced.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`;
both were then created inside it and everything re-run.

| | bare row | populated row |
| --- | --- | --- |
| `turbo run build --force` | 4/4, 0 cached, 3.20 s | 4/4, 0 cached, 2.46 s |
| `turbo run build lint typecheck test --force --continue` | **25/25 tasks, 0 cached** | 7/7 test, 0 cached |
| tests | **2,644 passed, 2 skipped** | 2,644 passed, 2 skipped |

`pnpm sweep:git-identity` → **exit 0**, *"the workspace suite executed and green with no resolvable
git identity"*. `pnpm exec quorum lint` → **6/6** through the built binary.

**GO-5 — six discriminating mutations, each shown red and then reverted.**

1. remove the `build` script → the emitting register (`expected [ 'packages/cli', …(2) ] to strictly equal [ 'apps/web', …]`) and both `apps/web` clauses
2. `^build` on the root `test` task → *"test gained a ^build edge"* on the file, and *"@quorum/cli#test waits for a build"* through turbo
3. `&& echo stray > q0122-stray.txt` in the build → *"the build wrote outside every emitting package's dist/: [ 'apps/web/q0122-stray.txt' ]"*
4. no `NOT_READ` row → three clauses naming *"apps/web (a directory, and no audited walk covers it)"*
5. `` `dist/**` `` twice in the architecture document → *"describes the outputs pattern dist/** 2 times, not once"*
6. `pathInside` → `path.join` + `startsWith` → *"a symlink out of the bundle was followed"*

Plus two permanent in-suite demonstrations rather than one-off mutations: AC-14's late-registration
app, which reproduces Q-0120's B-1 and fails on exactly the four colliding routes, and AC-8's
superseded-wording fixture.

**End to end against the real emitted bundle**, beside the suite, because the suite deliberately
builds its own:

```
GET /runs/run-3       (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history          (navigation)  200  text/html; charset=utf-8         693 bytes
GET /flows            (navigation)  200  text/html; charset=utf-8         693 bytes
GET /backlog/Q-0122   (navigation)  200  text/html; charset=utf-8         693 bytes
GET /                 (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history          (json)        200  application/json                  25 bytes
GET /flows            (json)        200  application/json                 575 bytes
GET /runs             (json)        200  application/json                  11 bytes
GET /project          (json)        200  application/json                 240 bytes
GET /assets/index-DyDp4y-o.js       200  text/javascript; charset=utf-8  307030 bytes
GET /assets/index-DcfvevsF.css      200  text/css; charset=utf-8           9553 bytes
GET /assets/gone.js   (missing)     404  text/plain                        13 bytes
HEAD /runs/run-3                    200  content-length 693, body 0 bytes
GET /../package.json  (traversal)   404
GET /%2e%2e/package.json            404
the real shell was served: yes
```

Three of those five navigations — `/history`, `/flows`, `/runs/run-3` — are the paths that 404 on a
reload without this ticket, and they answer the shell while the same paths under
`application/json` answer the daemon's JSON unchanged.

---

## 5. Deliberately not done

- **`docs/06-development-plan.md` is untouched.** Q-0094 erratum E-3(a) ruled that this page's
  bullets are rewritten by hand at each plan pass, and that an implement step editing it turns a
  harmless revert into a review finding.
- **`CLAUDE.md` is untouched** and no term is coined (092 clause 6, E-2). Neither 22-term list moves.
- **Non-goals 1–13 hold.** No `quorum open` (Q-0124's), no screen, no packed UI, no publishing, no
  `testFilesIn` widening, no change to the root `build` task, no `^build` edge, no `public/`, no
  non-`/` `base`, no service worker, no cache headers, no chunking, no change to any REST, refusal,
  frame or gate-answer contract, and the shell's route register is read and never edited.
- **Windows.** A fourth `rm -rf` under Q-0098's registered POSIX-only limit; not lifted.
- **OQ-6 (cache headers) and the *is `index.html` for an unrecognised navigation a silent default?*
  question** are solutioning's per E-1 and are not answered in code. No `Cache-Control` header is set
  at all, which is the conservative default and leaves the question open.

## 6. Reported and not fixed

- **`packages/core/src/backlog/backlog.ts:330`** — `pnpm lint` reports *"Unused eslint-disable
  directive (no problems were reported from 'no-control-regex')"*. **Pre-existing**: that file is not
  in this change and the warning is on the branch as inherited. It is a warning, so `lint` exits 0.
  Not touched — it is not this ticket's surface and fixing it in passing is the scope creep the role
  forbids.
- **A transient `warning: could not add .quorum/ to /tmp/…/.git/info/exclude: no space left on
  device`** appeared once during a parallel forced run and the test passed anyway; `df` reports
  253 GiB free afterwards. Recorded because this change adds one more `isolate()` copy and two more
  forced builds to `build.test.ts` (34.5 s → 38.5 s), so `/tmp` pressure during a forced sweep is
  marginally higher than it was.
- **`packages/server` is scanned by no input guard** (§3(f)). `packages/server/turbo.json` is
  written from a measurement rather than in answer to a red test, and its own header states the
  standing residual: a later out-of-package read from this package is covered by nobody's guard.
