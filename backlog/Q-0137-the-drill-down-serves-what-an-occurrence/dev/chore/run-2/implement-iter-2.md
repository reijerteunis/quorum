# Q-0137 — implement report, run 2, iteration 2

*A revision round. Review round 1 returned **two majors and no blocker**; both were real, both are
fixed, and **each was demonstrated red by mutation before it was trusted green**. Verdict:
`proceed`.*

**161 insertions across 5 files.** Everything is green, forced, in this worktree:
`pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks successful, 0 cached**;
`pnpm exec quorum lint` → **6/6**; `pnpm run sweep:git-identity` → *"the workspace suite executed
and green with no resolvable git identity"*. Nothing is committed and nothing is staged.

---

## 1 Major 1 — the listing offered a name the read beside it refuses

> *`packages/core/src/run-history/reader.ts:519` — the directory listing publishes every regular-file
> entry without applying `isRetainedName`. On POSIX, a regular file named `a\b` is therefore listed
> even though AC-1 forbids backslashes and `readRetainedFile` rejects the same name at line 605.*

**Accepted in full, and the reviewer identified the right site.** `isRetainedName` was applied to
what a caller *supplies* and not to what the listing *offers*, so the two halves of this ticket
answered differently about one file: `listRetainedFiles` named `a\b.txt` with its size, and
`readRetainedFile` refused it `not-a-file-name`. AC-1's *"Each `name` is one leaf name … containing
no `/` or `\`"* is a statement about the listing's output, and the listing did not enforce it.

**The fix is the reviewer's first offered remedy — filter** (`reader.ts`, one line in `retainedIn`):
an entry the predicate refuses is skipped exactly as a non-regular entry already is, so the
occurrence is still listed and its other files are still named. **Warning instead was measured and
refused**, for a reason in the shipped screen rather than a preference: `history-screen.tsx`'s
`retainedFor` is either/or — an occurrence found in `occurrences` never consults `warnings` — so a
warning beside a listed occurrence would render nowhere, and making it render is per-file warning
rendering no criterion asks for. Filtering keeps one property rather than adding a channel:
**nothing listed is unfetchable and nothing fetchable is unlisted**, which is the sentence AC-6
already makes about a colliding `seq`.

**What the skip drops is stated where the code is** (Q-0135 E-3's discipline, and this repository's
rule against a silent bound): `readdir` never answers `''`, `.`, `..` or a name holding `/`, so the
**only reachable case is a backslash in a POSIX filename** — which `persist` cannot create, its two
callers passing constants, and which therefore means somebody put the file there by hand.

**The test is constructed, because the corpus cannot teach it** (R-1): no name in this repository's
own store carries a backslash, so a fixture drawn from `.quorum/runs` would pass over an
implementation with no clause at all. `retained.test.ts` writes `a\b.txt` beside `prompt.txt`,
asserts the fixture really holds it **and that the operating system really reports it as a regular
file** — so what omits it below is the name clause rather than the `isFile` clause above it — then
asserts the listing names only `prompt.txt` **and** that `readRetainedFile` refuses the same string,
which is the two halves agreeing rather than each being checked alone.

**Shown red before green.** With the clause removed:

```
AssertionError: a name this module will not join was offered as addressable:
  expected [ { name: 'a\b.txt', bytes: 9 }, …(1) ] to strictly equal [ { name: 'prompt.txt', bytes: 3 } ]
Tests  1 failed | 25 passed (26)
```

One clause, naming the defect, with the other twenty-five green — so it discriminates rather than
being shown red by a neighbour.

---

## 2 Major 2 — the file route ignored a query key instead of refusing it

> *`packages/server/src/read.ts:695` — the file handler reads only `occurrence` and `name` and
> silently ignores additional query keys … The test currently covers only replacing the required
> `occurrence` query, so it passes because `occurrence` is missing rather than because the forbidden
> key was rejected.*

**Accepted, and the sharper half is the second sentence: my AC-6 test proved nothing.** Every case
in it omitted `occurrence`, so it would have passed over a route that ignored the forbidden key
entirely — which is what the route did.

**The fix is a declared accepted key set rather than a register of forbidden spellings.**
`RETAINED_FILE_QUERY` is `['occurrence', 'name']` and `unexpectedQuery` refuses anything else,
**before** either value is read, so a malformed request still opens nothing. That makes AC-6's
*"under every spelling"* a property instead of a list somebody has to keep adding to:
`occurrenceDir`, `dir`, `path`, `Occurrence` and anything nobody has thought of are refused by not
being one of two. It is *"Unknown keys are refused where Quorum owns the key set, and preserved
where it does not"* (2026-08-25) applied to a request rather than to a body — the same entry AC-9
already cites for the wire shapes — and Quorum owns this route's query entirely.

**Two judgement calls, stated rather than buried, because each is a place a reviewer could
reasonably want the other answer.**

**(a) The code stays `not-a-file-name` and AC-5's table gains no tenth row.** That code is already
this route's shape refusal for a malformed **occurrence** as well as a malformed name — AC-5's own
row reads *"the occurrence or name query value is missing or malformed"* — so it is the
request-shape code by the criterion's own construction, and the condition sentence names the
offending key. A new code would extend a table the criterion declares closed and would add a branch
every client carries for ever.

**(b) The listing route is deliberately left answering 200.** The finding names the file handler,
and the asymmetry is principled rather than an omission: **that query selects and this one does
not.** A client sending `occurrence=1&occurrence_dir=steps/999-other` was served occurrence 1's file
and told nothing, so an unhonoured selector reads as an honoured one; the listing's answer is a
function of the run token alone, so an unread key there can mislead nobody. Giving it a 400 would
add a fourth answer AC-4 does not enumerate, for a request that selects nothing. **This is not left
as an assumption** — a new clause asserts the listing's body is `toStrictEqual`-identical with each
forbidden key present, so *ignored rather than honoured* is checked rather than argued.

**The tests are what the reviewer asked for, and the old clause is kept with its limit written
down.** Three clauses now stand where one did:

- **substitution** — the directory key *in place of* the sequence number, which is the original
  loop. Its comment now records that it cannot tell *why* it refuses and would pass over a route
  that ignored the key; it stays because a client substituting the directory for the identity is
  the substitution itself.
- **beside** — the new one. It first asserts `occurrence=1&name=prompt.txt` answers **200**, so the
  fixture is one that serves, then appends each forbidden spelling plus `Occurrence`, `Name` and
  `anything-nobody-thought-of` and asserts 400 with the code. **What refuses it is the key**, which
  is the discrimination round 1's clause could not make. It also asserts the refusal names the key
  and **does not quote back what the key selected**.
- **structural** — the source identity is unchanged (`['name','occurrence','path']`, `path` being
  `GET /tickets/:id/file`'s and excluded from the per-key loop for that reason rather than
  overlooked), plus a new clause pinning that the key check is still wired. Its comment now says
  that the argument-less `c.req.query()` reads every key and is what refuses them, so the identity
  bounds what this route looks up **by name** rather than what it inspects — the two not being the
  same claim.

**Shown red before green.** With the check stubbed to `null`:

```
FAIL  a directory key BESIDE both valid values is refused, rather than ignored while the rest is served
AssertionError: occurrence_dir was ignored rather than refused: expected 200 to be 400
FAIL  the handler reads no query key naming the occurrence directory, under any spelling
AssertionError: the key check is gone, so nothing refuses an unknown key: expected false to be true
Tests  2 failed | 21 passed (23)
```

The defect reproduced in its own words. The substitution clause and the listing clause stayed
**green** under that mutation, which is correct and is the reviewer's point made mechanically.

---

## 3 The document that claimed the property without saying how

`docs/04-architecture.md` is AC-14's surface and already said *"neither route accepts it under any
spelling"* — true in the weak sense that neither read it, and about to be true in two different
ways. The sentence now says which: the file route declares the keys it accepts and refuses any
other, citing the 2026-08-25 entry, and the listing route reads no query value at all. One
paragraph, the one this ticket wrote.

---

## 4 What I deliberately left alone

1. **The reviewer's `observation:` is not acted on here** — it reports that the supplied patch was
   truncated and names the five files it read off the branch instead. That is GO-4's subject and the
   gate's; the measurement is in my findings rather than silently dropped.
2. **No new refusal code, no new wire field, no schema change.** The nine codes are AC-5's and the
   five shapes are AC-9's; both fixes are behaviour behind them.
3. **`readRun` is unchanged**, still *"a cast, never a check"*, and a traversing `occurrence_dir` is
   still reported by `GET /history/:id` exactly as it sits on disk.
4. **Nothing else in the branch moved.** No tidying, no register renumbered, no criterion re-opened
   — the diff is the two fixes, their tests, and one sentence of a document this ticket owns.

---

## 5 Verification

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks, 0 cached** |
| `pnpm exec quorum lint` | **6/6** |
| `pnpm run sweep:git-identity` | green, 7/7 tasks 0 cached, *"no resolvable git identity"* |
| mutation — the listing's name clause removed | 1 red, discriminating, 25 green |
| mutation — the route's key check stubbed | 2 red, discriminating, 21 green |

**GO-6's first row is done here**: this worktree has neither `.harness/worktrees` nor `.quorum/runs`
and is green forced. The `main`-after-merge row and **GO-5** — running the product against a real
daemon and transcribing what it rendered — are the gate's; an implement step can perform neither.
