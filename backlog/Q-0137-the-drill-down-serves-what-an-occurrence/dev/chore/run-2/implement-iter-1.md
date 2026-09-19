# Q-0137 — implement report, run 2, iteration 1

*The drill-down serves what an occurrence retained. Fourteen criteria, all satisfied. Verdict:
`proceed`.*

---

## 0 What was built, in one paragraph

`@quorum/core` gained two functions and returns no path from either. `@quorum/shared` gained five
`.strict()` wire shapes, each with a schema. `packages/server` gained two routes that compose no
filesystem path at any point. `apps/web`'s history drill-down names what each occurrence retained,
with its size, and opens one file at a time. Four documents and six registers moved with them.

**Everything is green, forced, in this worktree**: `pnpm turbo run test lint typecheck --force
--continue` → **21/21 tasks successful, 0 cached**; `pnpm exec quorum lint` → 6/6; `pnpm run
sweep:git-identity` → *"the workspace suite executed and green with no resolvable git identity"*;
`pnpm turbo run build --force` → 5/5. Nothing is committed and nothing is staged — the harness
commits the worktree.

**1,567 insertions across 20 tracked files, plus 1,870 lines in six new test files.**

---

## 1 File by file

### `packages/core/src/run-history/reader.ts` — the two functions (AC-1, AC-2, AC-3, AC-6)

`listRetainedFiles(runsRoot, token)` and `readRetainedFile(runsRoot, token, seq, name)`, with five
types beside them. Both go through the module's own `readRun`, so the run token is confined exactly
as it already was and **neither takes or returns a path** — §4.3's rule, and the reason
`resolveRunDirectory` stays off the barrel (Q-0092 OQ-1).

- **Confinement is `pathInside` and deliberately not `isFolderIn`**, imported from
  `../backlog/confine.js` — the import `writer.ts:38` already makes, which is what AC-3's register
  clause asks for. `isFolderIn` requires the candidate one component below the root and an
  occurrence directory is `steps/NNN-<step id>`, **two** — it would refuse every legitimate
  occurrence, which is a failure that looks safe and is total. The JSDoc says so where the code is.
- **The listing opens nothing an occurrence retained.** A name comes from `readdir` and a size from
  `lstat` — `lstat` rather than `stat`, so a symlink is judged as itself and skipped rather than
  measured, which is AC-1's *not a regular file* clause.
- **The reader opens one descriptor with `O_RDONLY | O_NOFOLLOW`, `fstat`s it, and reads from it.**
  `readTicketFileBytes`'s discipline, which is Q-0122's TOCTOU fix reused; `O_NOFOLLOW` is what
  closes the half a re-open by name leaves. It returns a `Buffer` and never text.
- **Membership is enumerated for the invocation that reads**, so a listing a client fetched earlier
  grants nothing — which is what makes a name `persist` *could* have written and did not unreadable.
- **Warnings name a condition and never a path.** The manifest's `occurrence_dir` is the untrusted
  value here, so quoting a refused `../escape` back would put a path nobody asked for into an answer.
- `manifestOccurrences` guards both `steps` not being an array and an element not being an object —
  `readRun` casts rather than checks, and `manifestShapeError` does not run on a single-run read.

### `packages/core/src/index.ts` — the barrel

`listRetainedFiles`, `readRetainedFile` and five types. The header records why they are a pair
rather than `resolveRunDirectory` plus a reader, and that no command reaches either.

### `packages/shared/src/wire.ts` — five shapes (AC-9)

`WireRunHistoryRetainedFile`, `…RetainedOccurrence`, `…RetainedWarning`, `…Retained` (the listing
envelope) and `…RetainedText`, each with a `.strict()` schema. Named inside the `WireRunHistory`
family; none reuses `manifest` (Q-0127 E-2's homograph rule) or `artifact` (spent on **Emitted
artifact**). `bytes` is what was **read**, never what was listed.

### `packages/server/src/read.ts` — two routes (AC-4, AC-5, AC-6, AC-7)

`GET /history/:id/retained` and `GET /history/:id/file?occurrence=&name=`. Both query values are
validated **before any retained file is read**; the occurrence is addressed by `seq` and
`occurrence_dir` is accepted under no spelling. A single refused occurrence is a **warning beside a
200**, never a 422 for the whole run — `failSoftly`'s distinction, which is what decided §4.1 against
widening `GET /history/:id`. UTF-8 goes through the existing `asUtf8`, one decoder for both stores.

**Spelling:** `/retained` and `/file`, which is §4.1's recommendation. It is explicitly not pinned
there (Q-0094 E-3), and both registers and the architecture document move together.

### `apps/web` — the screen (AC-8, AC-10, AC-11, AC-12, AC-13)

`daemon-endpoints.ts` gains `historyRetainedPath` and `historyFilePath` with two registered segment
literals; `daemon-client.ts` gains two readers and two in-flight states; `history-text.ts` gains the
kind-keyed vocabulary; `history-screen.tsx` renders it.

- **One listing request per opened row**, beside the detail it already made, and **no request per
  occurrence**. A file's text is fetched only when a reader chooses that name with its size in front
  of them — which is what stands in for a cap, there being none.
- **AC-8's three sentences are keyed on `kind`**, total over the three including the `script` this
  product has never produced, with an unplaceable kind named rather than dropped. A missing output
  is two sentences and not one.
- **Four request states for a file**, loaded-empty distinguished from in-flight, and a late answer
  for a superseded selection lands nowhere.
- **A file name is a button, not a link.** `PROMPT_FILE`/`OUTPUT_FILE` decide only what the two
  absence sentences say; the list is the directory's contents, so a third name opens for free.

### Documents (AC-14, erratum E-2)

`docs/04-architecture.md` — a new `packages/server` paragraph naming both routes and the three
properties AC-14 requires, a new status line, and the two sentences E-2 names. `docs/05-design-prompt.md`
— a new status line and a new screen-8 divergence paragraph; the clause saying nothing there opens a
file is **discharged** rather than moved. `docs/GLOSSARY.md` — **Confinement** gains the clause about
the second path inside the run-history root, why the predicate differs, and `isFolderIn` named as the
trap; the existing run-history sentence is extended rather than replaced.

### Registers moved

| register | what moved |
| --- | --- |
| `packages/server/src/package.test.ts` | route identity 15 → **17** |
| `packages/cli/src/frame.source.test.ts` | `DOMAIN` 29 → **31**, with the shown-red-against-29 clause |
| `packages/cli/src/package.test.ts` | `domain()` 29 → 31, barrel 34 → **36** |
| `packages/core/src/run-history/run-history.source.test.ts` | `reader.ts` exports 12 → **19**, runtime 9 → **11**; barrel re-exports 6 → **8**; JSDoc field walk 62 → **70**; the write-verb clause narrowed (see §3) |
| `packages/core/src/turbo-inputs.test.ts` | `READ_BASES` + 2 files, `ESCAPING_LITERALS` + 2 entries, `INDIRECT_ROUTES` + 1 |
| `apps/web/test/routes.test.ts` | `EXCEPTION_REASONS` + 8 rows; a new Q-0137 describe |
| `apps/web/test/source.test.ts` | `NAMES_THE_TOTAL` + 1 row |

### New test files

`packages/core/src/run-history/retained.test.ts` (25 tests) · `packages/server/src/retained.test.ts`
(20) · `packages/shared/src/wire-retained.test.ts` (7) · `packages/shared/src/docs-retained.test.ts`
(6) · `apps/web/src/history-retained.test.ts` (15) · `apps/web/src/daemon-client-retained.test.ts` (10).

**R-1 honoured: every fixture for AC-3, AC-7, AC-1's third clause and AC-8's `script` case is
constructed.** All 940 `occurrence_dir` values on this machine are well-formed, nothing under a run
directory is anything but a regular file, no retained file fails a UTF-8 decode, and `kind: 'script'`
has never occurred — so a fixture drawn from `.quorum/runs` would have passed over an implementation
with no confinement at all. AC-3's traversing shapes include one carrying a readable `steps/NNN-`
prefix, so the occurrence is **addressable** and the confinement is what refuses it rather than the
sequence lookup failing first.

---

## 2 Two defects the new suites caught in my own work

**A code disagreement between two routes.** `core` answers `not-a-run` and the file route derived its
refusal code from the outcome's own name, so it answered `not-a-run` where the listing route beside
it — and `GET /history/:id` since Q-0119 — answers `no-such-run`. A client switching on the code
would have had to know which route it had asked. `RETAINED_REFUSAL` now declares a `code` per row,
and a test asserts all three routes answer **one** code for each of the two conditions they share.

**A Retry that repeated a request nobody asked for.** `onRetry` under a failed detail was wired to
`openRun`, which was correct while a row issued one read and stopped being correct the moment it
issued two: a Retry would have re-issued the retained listing as well, replacing an answer already on
screen with an in-flight sentence. `openDetail` and `openRetained` each repeat only their own read
(AC-11), and each read has its own generation counter so neither cancels the other's work.

**And one refinement from a self-review pass**: the remedy was attached to every refusal, including
`no-such-run` — advice telling a reader to ask a run that is not there. It is per row now, and three
rows carry `null`, which is *"A `core` error names the condition; the remedy belongs to the surface"*
read the way round it is usually needed.

---

## 3 What I deliberately left alone

1. **Q-0018's half is not reopened** (§6.1). The listing, the table, the wire shapes and the
   occurrence timeline are untouched; two of its request-count tests moved because a row now issues
   two reads, and both became identities over the paths rather than counts.
2. **`GET /history/:id` is not widened** (§6.3) and its *"reads exactly one file"* property is
   preserved. A test asserts it answers exactly what it answered before over a damaged store.
3. **`readRun` is unchanged** (§6.4). *"A cast, never a check"* and *"repairs nothing"* both stand;
   the confinement lives at the join. A traversing `occurrence_dir` is still reported by that route
   exactly as it sits on disk, asserted.
4. **The CLI is unchanged** (§6.5). `quorum runs <id>` still prints an occurrence's path and renders
   no file.
5. **No cap, retention policy or eviction** (§6.6). The read-side answer is **none**, measured: one
   file at a time caps a response at 355,744 B. The design does not cross into Q-0076.
6. **No manifest is repaired** (§6.7), including one whose `occurrence_dir` is refused — asserted by
   a whole-store byte snapshot across every outcome both functions and both routes produce.
7. **The `output.txt`-as-a-directory defect is not fixed** (§6.10). It is landed preserved behaviour;
   AC-8's third sentence is what declining to trip over it costs, and a listing test uses exactly
   that shape as its non-regular-entry fixture.
8. **No dependency, no adapter invocation, no worktree, no gate change, no API-key path** (§6.12).
   The diff renderer question is Q-0134's and nothing here renders one.
9. **`contracts/` is untouched** — outside this role's paths. E-3's note is already on disk and was
   verified rather than assumed.
10. **`packages/core/src/backlog/backlog.ts` is untouched**, including its pre-existing unused
    `eslint-disable` warning (see the findings).

---

## 4 Gate obligations

- **GO-1 — discharged.** `requirements/errata.md` E-1 ratifies OQ-1: a route may serve a file under
  `.quorum/` and **no decision entry is owed**. The ruling is in `listRetainedFiles`'s own authority
  comment — one line naming the condition and citing E-1, never a transcription of the reasoning —
  plus AC-14's sentence in `docs/04-architecture.md`. I did not treat OQ-1 as live and did not stop
  on it. No `docs/decisions/` entry was written.
- **GO-2** — fourteen criteria, not split; nothing was trimmed, AC-3 and AC-14 included.
- **GO-3 — nothing owed.** Verified on disk.
- **GO-4 — owed, and the prediction it rests on is refuted.** See the findings: the diff measures
  ≈265,000 B against the 200,000 cap, so a hand pass over the alphabetical tail is required.
- **GO-5 — the human's.** It requires running the product against a real daemon and transcribing
  what it rendered, which an implement step cannot do.
- **GO-6 — one row done here.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`
  and is green forced at 21/21 tasks, 0 cached, with `quorum lint` 6/6 and the git-identity sweep
  green. The `main`-after-merge row is the gate's.

---

## 5 Measurements this run produced

- The retained-file diff is **≈265,000 B** against a 200,000-byte cap — 157,484 B tracked plus
  107,076 B of new test files.
- `packages/server/src/retained.test.ts` is 26,744 B, `packages/core/src/run-history/retained.test.ts`
  31,628 B, `packages/shared/src/docs-retained.test.ts` 9,234 B and
  `packages/shared/src/wire-retained.test.ts` 8,413 B — between them the bulk of what falls past the
  cut.
- The `fs.rmSync` re-entrancy the TOCTOU fixtures hit is worth recording: `rmSync` lstats what it
  removes, so an unguarded `lstatSync` hook overflows the stack before the code under test runs. Both
  staging helpers are one-shot and use `unlinkSync`, and the delegate is `statSync` rather than the
  real `lstatSync` because taking a read API as a **value** — including in a type position — is a
  shape `turbo-inputs.test.ts` clause C4 reports rather than skips.
