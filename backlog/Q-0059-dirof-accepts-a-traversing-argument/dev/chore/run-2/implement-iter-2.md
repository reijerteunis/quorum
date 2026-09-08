# Q-0059 — implement, run 2 iteration 2

A revision round with one finding. It was real on all three sites it named, it is fixed, and the
fix is narrower than the finding because one of the four methods was never a gap.

**Verdict: `proceed`.** Nothing here required something I am not permitted to do.

---

## 1. The finding, reproduced before it was believed

> major: `readFiles` validates only the requested directory or pattern base, then reads every
> enumerated file without resolving that file … The same leaf-path gap exists for `write` at line
> 153 and `log` at line 284 when `ticket.md` or `runs.log` is a symlink.

Staged against the real `Backlog` — a ticket folder inside a sandbox backlog root, one link planted,
nothing mocked:

| site | before this round |
| --- | --- |
| `readFiles(ticket, 'dev/*.md')` | `[{"rel":"dev/leak.md","text":"SECRET\n"}]` — an outside file's bytes, under an inside `rel` |
| `readFiles(ticket, 'dev/')` | the same |
| `write` through a symlinked `ticket.md` | the frontmatter **replaced a file outside the backlog root** |
| `log` through a symlinked `runs.log` | the line **appended to a file outside the backlog root** |
| `writeFile(ticket, 'dev/leak.md', 'X')` | already **refused**, and the outside file untouched |
| `read` through a symlinked `ticket.md` | returned `id: SECRET-1` |

**The diagnosis the reproduction changes.** The finding reads as *the predicate is too weak*; it is
not. `pathInside` resolves the **deepest existing ancestor**, and where the leaf exists that *is*
the leaf — which is why `writeFile` refused, and why a pattern naming the link outright refused too.
The gap was in **enumeration**, not in the predicate: three call sites built their leaf with
`path.join` instead of asking. `readFiles` fixes the directory and lets the filesystem supply the
names under it, so the name it opens is one no caller asked for and no check on the base can see;
`write` and `log` join a constant onto a folder that was verified while the name was not.

So the reviewer named exactly the right three, and `writeFile` is correctly not among them.

---

## 2. What changed

### `packages/core/src/backlog/backlog.ts` — +58 / −20

- **`fileInside(root, ticket, rel)`**, module-private beside `folderOf`: the folder against the
  root, then the leaf against the folder. `write`, `writeFile` and `log` all go through it, so the
  three sites that had three shapes now have one.
- **`readFiles`** gains one reader used by **both** branches, which checks each enumerated file
  before opening it. Every accepted path is byte-identical to before — `rel` is the same
  `path.relative` in both branches, the walk keeps the walk's own order, the readdir branch stays
  sorted by basename, and an absent directory is still `[]`.
- **No new refusal sentence.** All three raise AC-9's fourth, `not a path inside the ticket
  folder: '<rel>'`, quoting the entry name for a `readFiles` leaf and `ticket.md` / `runs.log` for
  the other two. AC-9 fixed the vocabulary at four *so that no implement step invents one*, and the
  condition here is the one that sentence already states.
- **No new `realpathSync`.** AC-8's two-file register and the "reaches its boundary through
  `./confine.js`" pin both hold unedited; `confine.ts`'s logic is unchanged.
- JSDoc on the three methods and the new helper says what the leaf clause is for.

### `packages/core/src/backlog/confine.ts` — +9 / −4, comments only

`pathInside`'s contract now states the half this round leans on: the deepest existing ancestor is
`rel` **itself** where `rel` exists, so a link standing at the destination is refused rather than
followed. That was already the behaviour — it is what made `writeFile` safe — and it was not
written down, which is how three callers were built around it without using it.

### `packages/core/src/backlog/backlog.test.ts` — +106

Seven tests, each escape case with its benign twin.

**The two branches are two tests, not one.** My first attempt asserted both in one case; the M8
mutation below killed it at the first expectation and the walk branch never ran — a case proving
the guard fires and saying nothing about the second clause (Q-0071). Split, M8 turns both red.

Also: the sibling-alias twin (a leaf link pointing **inside** the folder is still read and still
written through, which is OQ-6's ruling one level down); a twin recording that the link *named
outright* was already refused by the base check, so the two cases above are a gap in enumeration
rather than in the predicate; and a pin on `read` — see §4.

### `packages/core/src/turbo-inputs.test.ts` — +3 / −2

Q-0072's guard refused the change on the way in, three times, and one of them is the interesting
one. Two new read bases registered (`file`, the enumerated file `readFiles` opens; `target`, the
outside file the new tests read back to prove nothing was appended to it), and **one stale row
removed** — `f`, the base of the walk lambda my rewrite renamed. Clause C4's stale half caught it,
which is the register refusing to go on excusing a read that no longer exists.

### `docs/04-architecture.md` — 1 sentence, plus its status line

The reviewer's second clause — *"contradicts … the new architecture statement"* — is right, and it
stays right after the fix for one method. Principle 6 said the store *"reads and writes only inside
a ticket folder"*; that is now true of `write`, `writeFile`, `readFiles` and `log`, and **false of
`read` and `list`**, which AC-11 requires be left behaviourally untouched. So the sentence names the
four it holds for, says "at a folder *or at a leaf*", and states the one read outside the guarantee.

**The glossary needed nothing**: `Confinement` already named exactly `write`, `writeFile`,
`readFiles` and `log` and never claimed `read`. Checked rather than assumed.

---

## 3. AC-12 — the new clauses, each shown red

| # | mutation | red | message |
| --- | --- | --- | --- |
| M8 | the `readFiles` leaf check removed | **2** | both branch tests: `expected null to be 'not a path inside the ticket folder: …'` |
| M9 | `write` reverted to `path.join(folderOf(…), 'ticket.md')` | **2** | the write case, and the `read` pin's second half |
| M10 | `log` reverted to `path.join(folderOf(…), RUNS_LOG_FILE)` | **1** | `expected null to be 'not a path inside the ticket folder: …'` |
| M11 | the leaf guard replaced by one refusing **every** symlink | **1** | the sibling-alias twin **alone**; both escape tests stay green |

**M11 is the one worth reading.** R-2's hazard is that a confinement guard passes every negative
test ever written by refusing everything, and M11 is that guard: it satisfies both escape cases and
fails only the twin. That is the check on the check, and it is why the twins are not decoration.

M9 turning **two** red rather than one is also load-bearing: the second is the `read` pin's *"and
the write does not go back"* half, so the asymmetry in §4 is pinned by something that fails.

---

## 4. Reported, not fixed — and the one I judged rather than inherited

**`read` and `list` still follow an escaping `ticket.md` symlink.** AC-11 requires both
behaviourally untouched, and the review named `write` and `log` rather than these. I left them and
**pinned the behaviour** so a later change is deliberate rather than silent, named it in
`04-architecture.md` rather than letting the document overclaim, and did not open a successor,
because whether `read` should refuse one is a question about `list` and `quorum board` too and does
not fit in this ticket's criteria.

The asymmetry is the safe direction and is worth stating plainly: a planted link is still listed and
still read, and the store now refuses to write back through it — so bytes stop leaving the root,
which is the half that matters. A run whose ticket carried such a link now stops with an explicit
error at `finish()` instead of silently writing outside; *errors are explicit*.

Unchanged from iteration 1 and still true: `ticket not found: <token>` does not escape control
characters (AC-4 pins it byte for byte); `quorum run` prints a stack trace for a `core` refusal,
which is Q-0090's `e.stack` behaviour and not this surface; time-of-check/time-of-use is open by
non-goal 7; `list()`'s silent skip of a symlinked entry (M-6) is untouched; and the pre-existing
ESLint warning at `backlog.ts:310` is still pre-existing, with `lint` at exit 0.

**Cost, stated because it is a real change:** `readFiles` now makes two `realpathSync` calls per
enumerated file where the walk branch previously made none. Nothing is cached, deliberately —
`create()` may create the root, so a resolved path held per instance is an answer that *was* true.
The forced sweep is unchanged at about a minute.

---

## 5. Verification

`pnpm install --frozen-lockfile`, then `pnpm turbo run test lint typecheck --force --continue`:
**21/21 tasks, 0 cached, all green** — core **1371 passed / 2 skipped** (both pre-existing), cli
606, shared 158. `pnpm sweep:git-identity` green. Built, then through the binary: `quorum board`
renders the real backlog through the changed `dirOf`/`list`/`read` path, `quorum lint` 6/6, and
`quorum run chore ../../etc --dry` still refuses with
`✗ Error: not a ticket token: '../../etc' — a ticket is one folder directly under the backlog root`.

**AC-7 and AC-11's "passes unedited" was demonstrated rather than asserted.** I took
`backlog.test.ts` byte-identical from `HEAD`, ran it against the changed source, and it passes
**64/64**. That also corrected my own arithmetic: I had *inferred* the base at 63 from a delta and
it is 64, so the seven new tests are seven and not eight. A count derived from a subtraction is not
a measurement either.

**The symlink fixtures still probe rather than assume** (R-7): `NO_SYMLINKS` attempts one link once,
and a case skips only where the operating system refuses to stage it, naming what could not be
staged. None skipped on this machine — the mutations above prove they executed.

---

## 6. Deliberately untouched

`confine.ts`'s logic, and its three exports — the fix needed no new predicate. `run-history/reader.ts`
(OQ-1). The prefix-match `readdir` non-determinism, authority line standing (non-goal 1). Q-0060's
`parseFrontmatter`. Validation on read — the no-zod pins pass unedited. `parseTicketId` at the CLI.
`packages/cli`, which still needs no change, the six `die(error.message)` sites rendering `core`'s
sentence unaltered. `harness/`, `backlog/` and `docs/decisions/`. The flow-lint rule, which is
Q-0113's. And the `docs/06-development-plan.md` Q-0113 bullet added in iteration 1 stays as it was —
`plan-backlog.test.ts` requires it and no criterion of this round touches it.
