# Q-0122 — implement report, run 2, iteration 3

**Verdict: `proceed`.** A revision round against one blocker. It was real, it is fixed, and it was
shown red before green. Nothing else moved: no criterion's scope changed, no document changed, and
the diff is two files — `packages/server/src/static.ts` and `packages/server/src/static.test.ts`,
**173 insertions and 21 deletions**.

---

## 1. The finding, verified before it was believed

> **blocker:** `packages/server/src/static.ts:218` — `confinedFile()` validates the path and returns
> its name, but `sendFile()` subsequently reopens that name with `readFileSync`. Between those
> operations, a rebuild or local filesystem actor can replace the validated file or one of its parent
> directories with a symlink, causing the read to escape the supplied bundle root. … AC-17
> unconditionally requires that no outside path is served.

**Correct, and reproducible in one line.** The check ended at
`fs.statSync(full).isFile() === true ? full : null` and the read began at `fs.readFileSync(file)`.
Two syscalls, and between them nothing holds the name still. Measured on a fixture: validate
`/assets/index-abc.js`, replace that leaf with a symlink to a file beside the bundle, read — the
outside bytes come back. Replace the `assets/` **directory** instead and the same thing happens, and
that half is the one worth naming: an `O_NOFOLLOW` open governs the **last component only**, so a
flag on the open would have closed the first case and not the second.

**What makes it a defect rather than the policy, which is the part I had to settle before writing
anything.** `docs/GLOSSARY.md`'s **Confinement** says in as many words that it is *"not a claim about
a race — it says where a path is at the moment it is checked, and nothing about who may then open
it"*, and AC-17 names that primitive as its mechanism. So there is a reading under which this finding
raises the job the criterion gives the instrument, which is Q-0067 E-1's shape and would be an
erratum rather than a round. **I did not take it**, and the reasons are short: E-1 names AC-17 as the
one criterion *"not eligible for the trimming a reviewer might otherwise propose"*; the criterion's
normative half is *"no path outside the bundle root is served"*, which is about what is **served**
rather than about what a helper decided; and the fix is cheap, deterministic and testable, which
makes arguing about it more expensive than doing it. The glossary sentence still stands unamended —
confinement is what it was, and this module now does one thing **beyond** it rather than
reinterpreting it.

---

## 2. What changed, file by file

### `packages/server/src/static.ts`

**`ConfinedFile`, a new exported interface.** `{ path, dev, ino }` — the path `pathInside` answered
with, and the identity of the file that was approved. `bigint` rather than `number`, because an inode
is a 64-bit value `Number` cannot hold on every filesystem, which is the whole reason Node offers
`{ bigint: true }`; an identity comparison that silently rounded would be a check that cannot fail on
exactly the filesystems where it matters.

**`confinedFile` answers with that rather than a path.** One line of behaviour change —
`fs.statSync(full, { bigint: true, throwIfNoEntry: false })` — and the same two refusals as before
(nothing there, not a regular file). Every existing refusal is untouched: decode failure, NUL, empty
path, `pathInside`, directory. **Nothing was added to `core`'s confinement rule**, which is what the
finding asked and what keeps a third `realpathSync`-based boundary from growing in a third package.

**`readConfined(file: ConfinedFile): Buffer | null`, new.** Open the path, `fstat` **the descriptor**,
refuse unless it is still a regular file carrying the approved `dev`/`ino`, then `readFileSync` **on
that descriptor**. So there is no third resolution of the name between agreeing and reading, and a
leaf replaced by a link, a parent replaced by one, and a file moved away with another put in its
place are all one answer — a different identity, and a refusal. The handle is closed in a `finally`
covering every exit.

**Why an identity comparison rather than `O_NOFOLLOW`, stated in the module docblock.** Two reasons,
and the second is why the finding's own suggested shape would have been worse:

1. `O_NOFOLLOW` reaches the **last component** only. The parent case needs `openat` walked component
   by component, and **Node exposes no `openat`** — so the flag cannot deliver *"equivalent
   protection for replaceable parent components"* and the comparison can. What the comparison gives
   up is refusing *early*; what it gives is that the bytes returned came from the inode confinement
   approved, whatever happened to the names on the way.
2. `O_NOFOLLOW` would also refuse a symlink **inside** the root, which `pathInside` deliberately
   admits — its own docblock calls an in-root alias *"an alias rather than an escape"*. Narrowing the
   route past `core`'s rule would be this module writing a boundary of its own, which is the drift
   `docs/GLOSSARY.md`'s **Confinement** entry exists to stop.

**`sendFile` reads through `readConfined` and answers 404 when it will not stand behind the bytes.**
Same status as before for a file that vanished, now also for one that was swapped. Deliberately not a
refusal naming what it found: a daemon telling a browser which inode it declined to read is telling
it about the disk.

**`readConfined` is deliberately NOT on `index.ts`'s barrel**, where `confinedFile` is, and the
module says why: the barrel carries predicates a caller can reason with, and this one opens a file.
`index.ts` and `index.test.ts`'s `SURFACE` register are therefore untouched.

### `packages/server/src/static.test.ts`

**Three call sites take `?.path`** — `:465`, `:466` and the repeated-separator clause — because
`confinedFile` now answers with a record. No assertion weakened; each still names the file it expects.

**`approved(root, urlPath)`, a small helper that throws.** The swap tests are only about anything if
the check **passed** first; a `null` travelling into them would turn every refusal they assert into a
refusal of something that was never admitted.

**Three tests added, all under the existing `Q-0122 AC-17` block.**

- **`a leaf swapped between them is refused`.** Validate the asset, read it (so the fixture is known
  good), then replace the leaf with a link out of the bundle and read again. The fixture is asserted
  to discriminate — the swapped name still `stat`s as a file — so what refuses the read is the
  identity comparison and not a path that stopped resolving. It ends with the defect kept as a
  permanent demonstration rather than as a sentence about a commit nobody can run: reading
  `file.path` directly hands back `q0122-outside-the-bundle`.
- **`a parent directory swapped between them is refused too, which no open flag covers`.** The
  `assets/` directory is renamed away and a symlink to an outside directory put in its place after
  the check. The swap is asserted to have taken — the same name now reaches outside bytes through the
  filesystem — before the refusal is asserted.
- **`the module performs exactly one read, on the descriptor it checked`.** An identity rather than a
  count (Q-0073): every `readFileSync(…)` argument in the module's code, comments blanked, must be
  exactly `['handle']`. A second read anywhere here is a second resolution of a name, which is this
  blocker however carefully it is written. Its anti-vacuity clause shows the scan **discriminates**
  — over `fs.readFileSync(file.path)` it yields `['file.path']` — rather than merely matching.

**Deterministic, and at unit level on purpose.** The check and the read are two calls, the swap
happens between them on this thread, and nothing races. A socket puts one request across both steps,
so an end-to-end version could not open the window at all — which is the same reason the existing
symlink clause is asked of `confinedFile` directly.

---

## 3. Red before green

`static.ts`'s `readConfined` was reduced to what the previous shape did — `return fs.readFileSync(file.path)`,
with the `fstat` comparison removed — and the file re-run. All three new tests red, each on the
clause it is about, and the two behavioural ones report the outside bytes:

```
× and the check and the read name one file: a leaf swapped between them is refused
  AssertionError: the read resolved the name a second time and followed the new link:
    expected Buffer[ 113, 48, 49, 50, 50, 45, …(-86) ] to be null

× and a parent directory swapped between them is refused too, which no open flag covers
  AssertionError: a parent replaced after the check was followed:
    expected Buffer[ 113, 48, 49, 50, 50, 45, …(-86) ] to be null

× and the module performs exactly one read, on the descriptor it checked
  AssertionError: expected [ 'file.path' ] to strictly equal [ 'handle' ]

Tests  3 failed | 21 passed (24)
```

`113, 48, 49, 50, 50, 45` is `q0122-`, so what the previous shape returned is the file outside the
bundle. The fix was restored and the file passes **24/24**, up from 21.

---

## 4. Verification

**Both environment rows, forced.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`;
both were created inside it, everything re-run, and both removed again — `git status` is the two
intended files and nothing else.

| | bare row | populated row |
| --- | --- | --- |
| `turbo run build lint typecheck test --force --continue` | **25/25 tasks, 0 cached** | **25/25 tasks, 0 cached** |
| `@quorum/server` | 9 files, **171 tests passed** (was 168) | 9 files, 171 tests passed |
| workspace suite | **2,650 passed, 2 skipped** across 7 test tasks | same |

`pnpm sweep:git-identity` → **exit 0**, *"the workspace suite executed and green with no resolvable
git identity"* — run because this round adds two tests that create symlinks, rename directories and
write outside the bundle root. `pnpm exec quorum lint` → **6/6** through the built binary.

**End to end against the real emitted bundle**, beside the suite, which deliberately builds its own.
A throwaway spec was used and deleted; `git status` confirms it left nothing.

```
GET /runs/run-3            (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history               (navigation)  200  text/html; charset=utf-8         693 bytes
GET /flows                 (navigation)  200  text/html; charset=utf-8         693 bytes
GET /backlog/Q-0122        (navigation)  200  text/html; charset=utf-8         693 bytes
GET /                      (navigation)  200  text/html; charset=utf-8         693 bytes
GET /history               (json)        200  application/json                  25 bytes
GET /flows                 (json)        200  application/json                 103 bytes
GET /runs                  (json)        200  application/json                  11 bytes
GET /project               (json)        200  application/json                 190 bytes
GET /assets/index-DyDp4y-o.js            200  text/javascript; charset=utf-8 307032 bytes
GET /assets/index-DcfvevsF.css           200  text/css; charset=utf-8           9553 bytes
GET /assets/gone.js        (missing)     404  text/plain; charset=UTF-8
HEAD /runs/run-3                         200  content-length 693, body 0 bytes
GET /../package.json       (traversal)   404  carries "name": false
GET /%2e%2e/package.json   (traversal)   404  carries "name": false
the real shell was served: yes
after swapping that asset for a link out of the bundle:
  GET /assets/index-DyDp4y-o.js → 404, carries outside bytes: false
```

**What that last line does and does not prove, said plainly.** Between two requests the swap is
caught by `confinedFile` itself, because the leaf is then an escaping symlink — so the end-to-end run
shows the shipped route refusing it and does **not** exercise the window this round closed. The
window is only reachable between the check and the read inside one request, which is why the
regression tests are at unit level and why this paragraph is here rather than a green socket being
presented as the proof.

---

## 5. What the fix does not claim

Stated rather than left for a reader to discover, because a boundary that claims more than it
delivers is worse than none — which is `confine.ts`'s own sentence:

- **The approved inode is what is served, not the approved name.** If that inode is also linked
  somewhere outside the root, or has bytes appended to it after the check, those are the bytes
  returned. Both are the same file confinement approved, and neither is a path outside the root being
  served.
- **This is detection, not exclusion.** A parent component cannot be held still without `openat`,
  which Node does not expose; what is guaranteed is that a swap is **refused** rather than
  **prevented**. The route answers 404 and reads nothing.
- **It is not a defence against an actor who can already write into the bundle's path chain**, who is
  by construction the same local user the daemon runs as and can read those files directly. What the
  round closes is the case AC-17 states unconditionally, and the realistic trigger the finding names:
  a rebuild under a running daemon.

---

## 6. What was deliberately left alone

- **No criterion moved and no erratum is sought.** §1 records that one was available under Q-0067
  E-1's reading and why it was not taken.
- **No document changed.** AC-7 to AC-9 and AC-20's six documents are as iteration 1 left them.
  `docs/GLOSSARY.md`'s **Confinement** is untouched and nothing in it became false: this module does
  something beyond confinement, and says so in its own header rather than widening the term. No term
  is coined, so neither 22-term list moves (092 clause 6, E-2).
- **`packages/core` is untouched.** `pathInside` and `confine.ts` are unchanged, and
  `@quorum/core`'s barrel did not move again — the fix is entirely on this side of it, which is what
  the finding asked for.
- **`index.ts`, `index.test.ts`'s `SURFACE`, `NO_BUNDLE_REMEDY`, `AppOptions.bundle`,
  `ServeOptions.bundle`, `createDaemon` and the route register are untouched.**
  `registeredRoutes()` still derives `GET /*`, and `bundleRefusal`'s condition sentence is as
  iteration 2 left it.
- **`docs/06-development-plan.md` and `CLAUDE.md` remain untouched**, per Q-0094 E-3(a) and 092
  clause 6.
- **Non-goals 1–13 hold**, unchanged from iterations 1 and 2.

## 7. Reported and not fixed

Carried from the earlier rounds, neither touched here:

- **`packages/core/src/backlog/backlog.ts:330`** — `pnpm lint` reports *"Unused eslint-disable
  directive (no problems were reported from 'no-control-regex')"*. Pre-existing on the branch as
  inherited; a warning, so `lint` exits 0. Not this ticket's surface.
- **`packages/server` is scanned by no input guard.** `turbo-inputs.test.ts`'s `SUITES` is
  `@quorum/shared#test` and `@quorum/core#test`, so `packages/server/turbo.json` was written from a
  measurement rather than in answer to a red test, and a later out-of-package read from this package
  is covered by nobody's guard. Stated in that file's own header.
- **No `no-unused-vars` rule is configured** in `eslint.config.js` (iteration 2's observation).
  Whether one should be enabled is a workspace-wide configuration decision with its own subject.

One new one, found while rewriting the read and outside what the finding is about:

- **A FIFO swapped in for a bundle file blocks the open.** `openSync` on a named pipe with no writer
  waits, so a request would hang rather than 404. It is **not a regression** — `readFileSync(path)`
  had the identical behaviour before this round — and it is a denial rather than an escape, so it is
  outside AC-17. Closing it is one flag (`O_NONBLOCK`, a no-op on regular files), and I did not add
  it: it is not traceable to a criterion or to this finding, and a flag that changes what a read does
  on a descriptor is a decision about the route rather than a repair to it. Recorded so the choice is
  visible rather than absent.
