# Q-0059 — implement, run 2 iteration 3

A revision round with two findings, a blocker and a major. Both were real, both are fixed, and the
blocker was reproduced before it was believed — it is worse than the review's wording suggests on
three methods and milder on the fourth, and the report says which is which.

**Verdict: `proceed`.** Nothing here required something I am not permitted to do. The fix is one
clause inside a module OQ-1 already ruled mine to write, and the documentation change is to a source
docblock rather than to a numbered document or a decision entry.

---

## 1. The blocker, reproduced

> blocker: `confine.ts:55` `deepestExisting` treats every `realpathSync` failure as if that path did
> not exist and continues to its parent. A dangling symlink inside a ticket folder whose target is a
> nonexistent path outside the folder therefore falls back to an accepted in-folder parent; `write`,
> `writeFile`, or `log` then follows the symlink and creates the outside target.

Staged against the real `Backlog`, **each case in its own tree** so that no earlier case's write
could make a later case's link resolvable — which is the mistake a single-fixture reproduction of
this makes, and which I made on the first attempt and threw away.

| site | before this round |
| --- | --- |
| `writeFile(ticket, 'dev/leak.md', 'PWNED')` | **returned the inside path**, and `elsewhere/never-created.md` **existed afterwards, holding `PWNED\n`** |
| `write` through a dangling `ticket.md` | returned, and the outside file **was created** |
| `log` through a dangling `runs.log` | returned, and the outside file **was created** |
| `readFiles(ticket, 'dev/*.md')` | admitted the name, then `ENOENT: … open '<inside path>'` |
| `readFiles(ticket, 'dev/')` | the same |
| `writeFile(ticket, 'dev/rounds/x.md')` — the twin | returned and wrote, correctly |

**The mechanism, stated because the fix is one line and the line is not self-explaining.**
`realpathSync` on a dangling link fails with `ENOENT`, which is the same error a path nobody has
created gives — so the loop could not tell *nothing is there* from *something is there and resolves
to nothing*, and climbed. The parent it climbed to is `dev`, a real directory genuinely inside the
ticket folder, so the destination was admitted. Then `fs.writeFileSync` opens with `O_CREAT`, which
**follows the link and creates its target**. The guard was not merely too weak: it handed the write
a path it had certified, and the write created the file the certification said could not exist.

**Where the review's wording is wider than the defect and where it is narrower.** Wider:
`readFiles` leaked no bytes through a dangling link, because there is nothing at the other end to
read — it admitted the name and then died on a raw `ENOENT` quoting an *inside* path for a failure
about an *outside* one, which is a worse error message rather than a disclosure. Narrower: the three
write paths did not merely follow a link to somewhere that already existed, they **brought a file
outside the backlog root into existence**, which is the strongest form this defect has.

---

## 2. What changed

### `packages/core/src/backlog/confine.ts` — +26 / −3

**One clause.** `deepestExisting` gains `if (present(at)) return null;` between the resolve attempt
and the climb, where `present` asks `lstatSync` — a question about the **name** rather than about
what it points at, so a link is present whether or not anything is at the far end of it.

**No new predicate, no new export, and no new `realpathSync`.** AC-8's two-file register and
`backlog.source.test.ts`'s "reaches its boundary through `./confine.js`" pin both hold unedited.
`isFolderIn` and `pathInside` are otherwise unchanged, and the three exports are the same three.

**The rule this restores is the module's own, not a new one.** `isFolderIn` already refuses a
candidate `realPath` cannot resolve — that is how a dangling link at `<root>/Q-0009-alias` has always
been `ticket not found`. `pathInside` was the one place an unresolvable name was climbed past
instead. So the change makes the module answer *unresolvable* the same way twice rather than adding a
second policy, and the JSDoc says exactly that in one sentence.

**`present` reads every `lstat` failure as absence, deliberately, and the JSDoc says why.** The two
shapes that matter are `ENOENT` for a path nobody created and `ENOTDIR` for one whose parent is a
file, and both must climb or every write of a new file is refused. A failure for any other reason —
`EACCES` on a component, say — is one the caller could not act on either: a name it cannot stat is a
name it cannot open, so admitting it costs an error at the write rather than an escape. Checked
rather than assumed: with a link to an outside *file* at `folder/link`, `lstat('folder/link/x')`
fails `ENOTDIR`, the loop climbs to `folder/link`, which **resolves** — outside — and is refused by
the existing clause.

### `packages/core/src/backlog/backlog.ts` — +11 / −5, comments only

The major. The module docblock said **"It reads and writes inside its own root and nowhere else"**,
which is false of `read` and `list` — they join `ticket.md` onto a verified folder and open it
unchecked, so a link planted there is still read. That is behaviour AC-11 requires be left untouched
and which iteration 2 pinned by test and named in `04-architecture.md`; the docblock was the one
place still overclaiming, which is exactly the reviewer's *"source-level security contract
contradicting … the corrected numbered documentation"*.

It now states the guarantee by naming its four methods — `write`, `writeFile`, `readFiles`, `log` —
and gives the exception its own paragraph with a single `Why:` line citing AC-11, per the
engineering rules' *cite, do not transcribe*. **No code changed in this file.**

### `packages/core/src/backlog/backlog.test.ts` — +99

Seven tests, inside the existing AC-6 describe.

Three for the methods the reviewer named — `writeFile`, `write`, `log` — each asserting the sentence
**and** that the link's target was never brought into existence, with the tree outside the root
snapshotted around the call. R-3's criterion is that nothing happened, not that the call threw, and
here that distinction is the whole finding: the old code threw nothing *and* created the file.

Two for `readFiles`, one per branch rather than one test asserting both, because a case whose first
expectation dies proves the guard fires and says nothing about the second (Q-0071) — the same split
iteration 2 arrived at the hard way.

**Two twins, and they are not decoration.** One is a destination with nothing at all below the ticket
folder (`review/chore/run-9/chore-iter-1.md`), which is the case that separates *resolves to nothing*
from *nothing is there* and which the over-refusing implementation of this clause kills. The other is
the named behaviour change below.

---

## 3. A named behaviour change

**A dangling link pointing *inside* the ticket folder is now refused too.** `dev/alias.md` →
`dev/not-yet.md`, where the target does not exist, used to be written through and creates
`dev/not-yet.md`; it is now `not a path inside the ticket folder: 'dev/alias.md'`.

Stated here and pinned by a test rather than left to be discovered, and the reasoning is that
deciding where a dangling link *would have* pointed means reading its target and joining it
lexically — which is the string test this module exists to avoid, is worse for a chain of them, and
would be a second predicate beside the one AC-1 says declares the whole boundary. No shipped flow
plants a link in a ticket folder (M-8 measured 68 declared paths, none traversing, and none of them
creates a link at all), and of the two directions available, refusing is the one that cannot create a
file outside the root.

If the reviewer reads AC-6's *"the deepest existing ancestor … is resolved for real and must be
inside the resolved ticket folder"* as requiring a dangling link to be admitted when its own target
string points inward, that is the line to argue with, and the cost of the other answer is a second
predicate and a lexical clause the module currently has nowhere to put.

---

## 4. AC-12 — the new clause, shown red both ways

| # | mutation | red | message |
| --- | --- | --- | --- |
| M12 | the `present(at)` clause removed — the code as the reviewer found it | **6** | three `expected null to be 'not a path inside the ticket folder: …'` (the write paths, which returned normally), two `expected 'ENOENT: no such file or directory, op…' to be 'not a path inside …'` (the `readFiles` branches), one for the inside-dangling case |
| M13 | `deepestExisting` returning `null` for every name it cannot resolve — the over-refusal | **20** | the twins, `writeFile creates parents…`, `log appends timestamped lines…`, `create writes a branch NAME…`, and **AC-10's flow census**: *"every write path and backlog glob the six flows declare, in both copies, is accepted"* |

**M12 is discriminating rather than blunt: exactly the six new escape cases fail and all 72 others
pass**, including every twin. That is the property a confinement mutation has to demonstrate, since a
guard can be made red by breaking it in a way that has nothing to do with its subject.

**M13 is the check on the check** (R-2). It is the implementation a reader reaching for "refuse what
you cannot resolve" writes first, it satisfies all six of M12's cases, and it takes the shipped
flows' own write paths down with it — because most of what a flow writes is a file that does not
exist yet. The two mutations together say the clause fires on its subject and only on its subject.

---

## 5. Verification

`pnpm install --frozen-lockfile`, then `pnpm turbo run test lint typecheck --force --continue`:
**21/21 tasks, 0 cached, all green** — core **1378 passed / 2 skipped** (both pre-existing, up from
1371 by the seven new tests), cli 606, shared 158, and the four scaffolds. `pnpm sweep:git-identity`
green.

**Through the built emit, not only under Vitest's source condition.** `pnpm turbo run build --force`,
then a plain `node` process — which knows no `quorum-source` condition and therefore resolves
`@quorum/core` to `dist/index.js` — staged the dangling escape and got
`refused: not a path inside the ticket folder: 'dev/leak.md'` with `fs.existsSync(target)` **false**.
That is the same fixture that created the file before this round, run against the artifact a packed
install would execute. `quorum board` renders the real backlog through the changed `dirOf`/`list`
path, and `quorum run chore ../../etc --dry` still refuses with
`✗ Error: not a ticket token: '../../etc' — a ticket is one folder directly under the backlog root`.

**AC-7 and AC-11's "passes unedited" demonstrated twice rather than asserted**, and the second is the
one this round owes. `backlog.test.ts` taken byte-identical from `c47302f` — the tree as it stood
*before* this ticket, whose last edit to that file was Q-0112 — passes **46/46** against this round's
source, which is M-12's own count. And the file taken byte-identical from `HEAD`, iteration 2's
commit, passes **71/71**: so this round moved no landed assertion, and the seven new tests are purely
additive. Both copies were removed afterwards; the working tree is three modified files and nothing
else.

**The symlink fixtures still probe rather than assume** (R-7): `NO_SYMLINKS` attempts one link once,
and a case skips only where the operating system refuses to stage it, naming what could not be
staged. None skipped here — M12 turning them red is what proves they executed.

---

## 6. Reported, not fixed

- **`read` and `list` still follow an escaping `ticket.md` symlink.** Unchanged and now correctly
  described in all three places that describe it — the module docblock, `04-architecture.md`
  principle 6, and the test that pins it. AC-11 requires both behaviourally untouched. The asymmetry
  is the safe direction: a planted link is listed and read, and the store refuses to write back
  through it, so bytes stop leaving the root.
- **`ticket not found: <token>` does not escape control characters.** AC-9 and OQ-3 rule that
  sentence unchanged and AC-4 pins it byte for byte.
- **`quorum run` prints a stack trace for a `core` refusal**, which is Q-0090's `e.stack` behaviour
  and not this surface. Confirmed again through the built binary above.
- **The pre-existing ESLint warning** — *"Unused eslint-disable directive"* — is at
  `backlog.ts:330` in this round and at `:325` at `HEAD`, moved only by the five lines this round
  added to the module docblock. The directive itself is byte-identical and appears in no hunk of my
  diff. Iteration 2's report cites it at `:310`, which was already off; the number is corrected here
  rather than copied forward, since a measurement copied from a document is not a measurement.
  `lint` exits 0.
- **Time-of-check/time-of-use** is open by non-goal 7, and `list()`'s silent skip of a symlinked
  entry (M-6) is untouched.
- **Cost:** one extra `lstatSync` per path component below the deepest existing ancestor, and only
  on the paths that were already being resolved. Nothing is cached, deliberately — `create()` may
  create the root. The forced sweep is unchanged at about a minute.

---

## 7. Deliberately untouched

`confine.ts`'s three exports and both other predicates — the fix needed no new one.
`run-history/reader.ts` (OQ-1). `packages/cli`, which still needs no change, the six
`die(error.message)` sites rendering `core`'s sentence unaltered. **`docs/04-architecture.md` and
`docs/GLOSSARY.md`**, which iteration 2 already narrowed to the four methods and the stated
exception: this round makes the code match what those documents say rather than the reverse, so
neither sentence moves and neither status line is bumped. `turbo.json` and `turbo-inputs.test.ts` —
the new tests introduce no path literal and no new read base, and Q-0072's guard passed unprompted
for the first time on this ticket. The prefix-match `readdir` non-determinism, authority line
standing (non-goal 1). Q-0060's `parseFrontmatter`. Validation on read — the no-zod pins pass
unedited. `parseTicketId` at the CLI. `harness/`, `backlog/` and `docs/decisions/`. The flow-lint
rule, which is Q-0113's. And the `docs/06-development-plan.md` Q-0113 bullet added in iteration 1
stays as it was.
