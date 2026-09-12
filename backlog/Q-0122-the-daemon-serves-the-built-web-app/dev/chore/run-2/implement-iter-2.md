# Q-0122 — implement report, run 2, iteration 2

**Verdict: `proceed`.** A revision round against one blocker. It was real, it is fixed, and it was
shown red before green. Nothing else moved: no criterion's scope changed, no document changed, and
the diff is two files — `packages/server/src/static.ts` and `packages/server/src/static.test.ts`,
100 insertions and 7 deletions.

---

## 1. The finding, verified before it was believed

> **blocker:** `packages/server/src/static.ts:170` — Navigation fallback reads `index.html` through
> the precomputed `path.join` result instead of `confinedFile`, while `bundleRefusal` accepts a
> symlink because `statSync` follows it. A bundle whose `index.html` links outside the supplied root
> therefore passes startup validation and serves that outside file on every navigation, violating
> AC-17's mandatory confinement guarantee on this unauthenticated surface.

**Correct in both halves, and the two halves are two separate defences.**

`mountStatic` computed `const entry = path.join(bundle, BUNDLE_ENTRY)` once at mount and clause 2
answered every navigation with `sendFile(c, entry)` — a `readFileSync` on a path that had been
through no boundary at all. `bundleRefusal` asked `fs.statSync(entry)?.isFile()`, and `stat` follows
a link, so the directory read as holding a build.

**What makes it the defect rather than the policy is the inconsistency it produced.** `GET
/index.html` for the same escaping file was *correctly refused* — clause 1 goes through
`confinedFile`, `pathInside` resolves the leaf with `realpathSync`, the link is refused, then
`looksLikeAFile('/index.html')` is true so clause 4 takes it and it 404s. The identical file was
served, with a `text/html` content type and a 200, to `GET /runs/run-3`. One file, two answers, and
the one that leaked was the one no caller had to name.

The requirement's own framing is what settles it: AC-17 is *"no path outside the bundle root is
served"*, and E-1 names that criterion as **not eligible for trimming** because this is the first
surface in the product that turns a URL into a file read from an unauthenticated process. A path the
module chooses for itself is still a path this process reads. There is no reading of the criterion
under which the entry is exempt, and the module's own docblock had already said `confinedFile` is
*"the centre of the module rather than a detail of it"* while the code carried an exception to it —
a comment promising what the code beneath it does not do, which is this repository's most-recorded
class.

---

## 2. What changed, file by file

### `packages/server/src/static.ts`

**`ENTRY_PATH`, new module constant.** `` `/${BUNDLE_ENTRY}` `` — the entry as a *URL path*, so it
reaches `confinedFile` in the shape every other file reaches it in. A constant rather than an inline
template so the two call sites cannot spell it differently.

**`mountStatic` — the entry is resolved per request, through `confinedFile`.** The mount-time
`path.join` is gone. Clause 2 now asks `confinedFile(bundle, ENTRY_PATH)` and answers only if it gets
a path back.

**Per request rather than once at mount, and that choice is load-bearing.** A bundle is rebuilt while
the daemon runs, so an entry confined at startup is an answer that was true earlier — the same
reasoning `confine.ts`'s own header gives for caching nothing (*"a real path computed once per
instance is an answer that was true earlier"*). It is also what the finding asked for in as many
words: *the same confinement path used for assets*, and assets are resolved per request. The cost is
one `realpathSync` plus one `statSync` per navigation on a local daemon serving one browser.
§3's second test is what makes the choice checkable rather than merely stated.

**What happens when the entry is not servable at request time** — deleted, or turned into a link out
of the bundle after startup — is `next()`: rule 3, *"the request falls through to the JSON routes and
their 404s"*. There is no shell to answer a navigation with, so it is not a request this route can
serve. Previously that case reached `sendFile` and 404'd from inside the handler; the status is the
same and the rule the code follows is now the one the docblock states.

**`bundleRefusal` — through `confinedFile` rather than `statSync`.** Startup and the route now ask
one question of one primitive, so neither can accept what the other refuses.

**Its condition sentence moved, and it had to.** It read `no built web app at <root>: index.html is
not there`, which is **false** of the escaping case — the name is there. It now reads
`no built web app at <root>: index.html is not a file inside that directory`, which is the predicate
the check actually asks and is true of the absent entry and the escaping one alike. **The alternative
was two sentences**, chosen by a second `lstat` to distinguish *absent* from *escaping*: rejected
because it buys a nicer diagnostic with a second syscall whose only job is to choose prose and a
second claim to keep true, and because the shipped sentence's *"inside that directory"* already tells
an operator with a symlinked entry what was wrong. No test asserted the old wording — checked by
grep across the workspace; AC-13's three assertions are over `BUNDLE_ENTRY`, the root path and
`NO_BUNDLE_REMEDY`, all of which survive. `NO_BUNDLE_REMEDY` is unchanged.

**Module docblock.** Clause 2's paragraph now records why the entry is confined and why it is
resolved per request — the *"one line naming the authority"* the engineering rules ask for where
behaviour is deliberately shaped, on the one clause of this module that has already been got wrong
once. `bundleRefusal`'s docblock carries the same in two sentences rather than the four it first
had, per the Q-0111 nit about rationale paragraphs in JSDoc.

**One dead import removed.** `refusalOf` was imported in iteration 1 and never used — `bundleRefusal`
builds its own literal because it carries a remedy. No `no-unused-vars` rule is configured in
`eslint.config.js`, so nothing reported it. Removed rather than left: it is an import in the function
I was sent to rewrite, and a module whose header argues about refusal composition should not name a
constructor it does not use. `type Refusal` stays.

### `packages/server/src/static.test.ts`

Two tests added under the existing `Q-0122 AC-17` block, and `Hono` imported as a value.

**`and the entry itself is confined: an index.html linked out of the bundle is refused, never
served`.** The fixture is a bundle root whose `index.html` is a symlink to an HTML file beside it,
with a real asset alongside so the directory is otherwise a plausible build. Four clauses:

- **The fixture discriminates**, asserted rather than assumed: `statSync(entry).isFile()` is `true`
  and `lstatSync(entry).isSymbolicLink()` is `true`, so what refuses it below is confinement and not
  an entry that was never there. Without this the test could pass over an empty directory.
- **Startup refuses it** — `bundleRefusal` is non-null and names `index.html`, and `serve()` rejects.
- **The route refuses it on its own**, driven through `mountStatic(new Hono(), root)` so the startup
  check is not standing in front of it. The two are separate defences and a fixture proving only the
  first would leave the handler free to serve what startup happened to reject. `app.request` rather
  than a socket here deliberately, and against this file's own header: the reason that header gives
  for sockets is URL normalisation of traversal paths and handler ordering, and neither applies to
  `/runs/run-3` with a symlink on disk — the attack surface is the filesystem, not the request line.
  It also cannot be a socket, because `serve()` now refuses this bundle, which is the point.
- **Anti-vacuity**: the same instrument over a real bundle answers `/runs/run-3` with 200 and the
  shell, so the 404 above is a refusal rather than a handler that never answers a navigation.

**`and the entry is resolved per request, so a link swapped in under a running daemon is refused`.**
Over a real socket: a valid bundle serves the shell, its `index.html` is then replaced with a link
out of the root while the daemon runs, and the next navigation must not carry the outside bytes.
**This is the clause that makes *per request* load-bearing** — against a mount-time confined
resolution it goes red while the test above still passes, so a reader can tell which of the two
shapes shipped.

---

## 3. Red before green

`static.ts` was restored to its `HEAD` state (`git show HEAD:…`) and the two new tests run against
it. Both red, each on the clause it is about:

```
× and the entry itself is confined: an index.html linked out of the bundle is refused, never served
  AssertionError: a bundle whose entry resolves outside it was accepted at startup:
    expected null not to be null

× and the entry is resolved per request, so a link swapped in under a running daemon is refused
  AssertionError: the entry was resolved once at mount, so a link swapped in later was served:
    expected '<!doctype html><body>q0122-outside-th…' not to contain 'q0122-outside-the-bundle'
    Received: "<!doctype html><body>q0122-outside-the-bundle</body>"
```

The second is the blocker itself, reproduced over a real socket: the daemon returned the file from
outside the bundle. The fix was then restored and the file passes 21/21.

---

## 4. Verification

**Both environment rows, forced.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`;
both were then created inside it, everything re-run, and both removed again — `git status` is the two
intended files and nothing else.

| | bare row | populated row |
| --- | --- | --- |
| `turbo run build lint typecheck test --force --continue` | **25/25 tasks, 0 cached** | **25/25 tasks, 0 cached** |
| `@quorum/server` | 9 files, 168 tests passed | 9 files, 168 tests passed |
| workspace suite | 7/7 test tasks, 0 cached | 7/7 test tasks, 0 cached |

`pnpm sweep:git-identity` → **exit 0**, *"the workspace suite executed and green with no resolvable
git identity"* — run because this round adds two tests that create symlinks and temp directories.
`pnpm exec quorum lint` → **6/6** through the built binary.

**End to end against the real emitted bundle**, beside the suite, which deliberately builds its own.
A throwaway spec was used for this and deleted; `git status` confirms it left nothing.

```
GET /runs/run-3          (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history             (navigation)  200  text/html; charset=utf-8         693 bytes
GET /flows               (navigation)  200  text/html; charset=utf-8         693 bytes
GET /backlog/Q-0122      (navigation)  200  text/html; charset=utf-8         693 bytes
GET /                    (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history             (json)        200  application/json                  25 bytes
GET /flows               (json)        200  application/json                 103 bytes
GET /runs                (json)        200  application/json                  11 bytes
GET /project             (json)        200  application/json                 190 bytes
GET /assets/index-DcfvevsF.css         200  text/css; charset=utf-8          9553 bytes
GET /assets/index-DyDp4y-o.js          200  text/javascript; charset=utf-8 307032 bytes
GET /assets/gone.js      (missing)     404  text/plain; charset=UTF-8
HEAD /runs/run-3                       200  content-length 693, body 0 bytes
GET /../package.json     (traversal)   404  carries "name": false
GET /%2e%2e/package.json (traversal)   404  carries "name": false
the real shell was served: yes
a real bundle whose index.html links outside it:
  no built web app at <root>: index.html is not a file inside that directory
```

The last line is the blocker's own scenario against a copy of the real build: refused at startup,
where before this round it was accepted and then served.

---

## 5. What was deliberately left alone

- **No criterion moved and no erratum is sought.** The finding is a defect in the implementation of
  AC-17, not a contradiction in the requirement; E-1 already rules that criterion the one not
  eligible for trimming, and nothing here needed a ruling.
- **`confinedFile` and `pathInside` are unchanged.** The fix is entirely *where the primitive is
  called*, which is what the finding said. Nothing was added to `core`'s confinement rule, and
  `@quorum/core`'s barrel did not move again.
- **`NO_BUNDLE_REMEDY`, `AppOptions.bundle`, `ServeOptions.bundle`, `createDaemon` and the route
  register are untouched.** `registeredRoutes()` still derives `GET /*`.
- **No document changed.** AC-7 to AC-9 and AC-20's six documents are as iteration 1 left them; the
  condition sentence that moved is a runtime string, quoted in no document and asserted verbatim by
  no test (checked by grep across `packages`, `apps`, `docs` and `harness`).
- **`docs/06-development-plan.md` and `CLAUDE.md` remain untouched**, per Q-0094 E-3(a) and 092
  clause 6.
- **Non-goals 1–13 hold**, unchanged from iteration 1.

## 6. Reported and not fixed

Both carried from iteration 1 unchanged, neither touched by this round:

- **`packages/core/src/backlog/backlog.ts:330`** — `pnpm lint` reports *"Unused eslint-disable
  directive (no problems were reported from 'no-control-regex')"*. Pre-existing on the branch as
  inherited; a warning, so `lint` exits 0. Not this ticket's surface.
- **`packages/server` is scanned by no input guard.** `turbo-inputs.test.ts`'s `SUITES` is
  `@quorum/shared#test` and `@quorum/core#test`, so `packages/server/turbo.json` was written from a
  measurement rather than in answer to a red test, and a later out-of-package read from this package
  is covered by nobody's guard. Stated in that file's own header.

One new observation, from this round:

- **No `no-unused-vars` rule is configured** in `eslint.config.js`, which is why a dead named import
  sat in `static.ts` through a full forced lint and a cross-vendor review. Whether one should be
  enabled is a workspace-wide configuration decision with its own subject, and is not taken here.
