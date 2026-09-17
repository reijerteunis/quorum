# Q-0131 — implement report, run 2, iteration 2

*Verdict: `proceed`. One review finding, addressed as written. Full forced suite green in 7/7 tasks, 0 cached; `lint` and `typecheck` 14/14; `quorum lint` 6/6; `pnpm sweep:git-identity` green. Four mutations across three sites, each red with a discriminating message, each reverted.*

---

## 0. The finding, and what it was right about

> **major:** `apps/web/test/source.test.ts:115` AC-6 requires the new guard to forbid the literal `run #` anywhere under `apps/web/src`, but `LITERAL_PERMITTED` exempts two source files and expressly allows that literal to remain. This turns the required corpus-wide prohibition into a register of exceptions and leaves those files dependent on an incomplete extraction-pattern scan. Assemble the refusal-condition fixture text so it does not contain the literal in source, remove the exemptions, and assert that the complete `apps/web/src` corpus is literal-free.

**Accepted in full, and the remedy is the one the finding names.** AC-6's words are *"A new clause forbids the literal `run #` … anywhere under `apps/web/src`"*, and a register of exceptions is a narrower claim than that wearing the criterion's name. The argument against the exemptions that I did not make and the reviewer did: **an exemption forgives a FILE rather than a USE.** The two exempted files were exempted because their three sites are fixtures of the daemon's `lock-held` **refusal condition** — a different field from an event message, prose this app renders verbatim — but the exemption does not know that. A parse written inside either of them would have been invisible to the literal clause and left to `extractsFromMessage` alone, which is one incomplete pattern standing in for a prohibition. That is this repository's most-recorded shape, an exemption register reading as coverage, and it was mine.

The reviewer's remedy is available because nothing about those fixtures needs the literal spelled: this file's own rule — *"Every needle here is assembled anyway — one rule rather than four judgements"* — applies one directory over. A corpus under a prohibition is written so it is not its own subject, exactly as a needle is.

---

## 1. File by file

### `apps/web/src/daemon-client.test.ts` — two of the three sites

Added `LOCK_HELD_CONDITION`, a module-scope constant beside `CLOCK`, assembled as `` `held by run${' '}#7` `` — so the source carries `held by run$` and the literal appears nowhere in it. Both sites in the Q-0130 AC-3 refusal clause now use it: the fixture the daemon answers with, and the assertion that the condition reaches the caller unaltered. **Nothing about what that test proves moved** — it still drives a real 409 through `startRun` and still asserts the daemon's own words arrive byte-identical; what changed is that the bytes are named once rather than written twice.

Its JSDoc states the rule where the next person writing a fixture in this file will meet it, and says which file enforces it.

### `apps/web/src/ticket-page.test.ts` — the third site

The same, as `LOCK_HELD_CONDITION` beside `TICKET`, assembled as `` `run lock refused: ticket Q-0130 is held by run${' '}#7` ``. The AC-10 clause's two following assertions are untouched and still discriminate: it still asserts this surface's own sentence for `lock-held` **and** `run lock refused` — the daemon's own condition — reach the page separately.

### `apps/web/test/source.test.ts` — the register deleted, the prohibition made corpus-wide

- **`LITERAL_PERMITTED` is gone.** No file under `src` is forgiven the literal, and there is no per-file disposition to read.
- `named(exempt: boolean)` is replaced by `carriers(files)`, which takes its corpus as an argument — so the same predicate runs over the shipped tree and over a fixture, rather than a fixture-shaped copy of it being written beside it. (Q-0130's round-2 major: a demonstration that inlines a copy of the predicate leaves the real one covered by nothing.)
- The docblock is rewritten to say the literal is banned outright, why the exemption was weaker than the criterion, and what replaced it. The old text also said *"Three files under `src` carry `run #`"*; it was **three sites in two files**, and that is corrected rather than carried.
- `ASSEMBLED_FIXTURES` is added and is **not** a replacement register: it grants nothing and excuses nothing. It names the two files whose fixtures were assembled, and the clause asserts they are **still in the corpus** and **still carry the refusal condition as prose** — see §2.

---

## 2. The anti-vacuity property is replaced rather than dropped, which is the one judgement here

The clause the finding removed was doing two jobs. Forgiving the two files was the defect. But `expect(named(false).length).toBeGreaterThan(0)` under the message *"the literal needle matches nothing at all"* was also what proved the needle had a subject **in the real corpus** — and with the corpus now literal-free by construction, that evidence is gone with the register that supplied it. An emptiness over a corpus nobody looked at reads the same as an emptiness over one that is clean.

So two clauses stand in for it, and I am flagging them because they are slightly more than the finding asked for:

1. **The needle's subject is now a fixture.** `carriers([['bad.ts', …]])` must report `bad.ts`, and `carriers([['ok.ts', "const label = 'run-9'; // see issue #7"]])` must report nothing — the word and the hash present but not adjacent, so the clause is about the literal rather than about either half of it.
2. **The corpus is asserted to still contain the sites the prohibition was written for**, and each is asserted to still carry `held by run` as prose. Without it, deleting the two fixtures outright satisfies a corpus-wide prohibition perfectly — the remedy this finding asks for and the remedy that guts the coverage are indistinguishable to a clause that only checks for absence. Mutation C in §3 is that case shown red.

Clause 2 names two files, which is a shape a reviewer may reasonably read twice. The distinction from the register it replaces: `LITERAL_PERMITTED` **excluded** those files from a scan, and `ASSEMBLED_FIXTURES` **requires** them to be in one. A file leaving the corpus fails here; nothing is forgiven anything.

---

## 3. Every changed clause shown red by mutation

| # | Mutation | Red, with the message it produced |
| --- | --- | --- |
| A | `LOCK_HELD_CONDITION` in `daemon-client.test.ts` written out raw | *"a file under src names the run-number literal: expected `[ 'daemon-client.test.ts' ]` to strictly equal `[]`"* |
| B | the same in `ticket-page.test.ts` | the same clause, naming `ticket-page.test.ts` — so the two sites fail independently rather than one standing in for both |
| C | the `daemon-client` fixture's prose replaced rather than assembled | *"daemon-client.test.ts no longer carries the refusal condition its fixture was about"* — the delete-instead-of-assemble remedy, refused |
| D | an extraction from a message added to `daemon-client.test.ts`, with **no** literal in it | *"a file under src takes a value out of an event message: expected `[ 'daemon-client.test.ts' ]`"* — the half the exemption used to hide, now firing in a file that used to be forgiven |

**D was injected as a comment line rather than as a statement**, and that is stated rather than glossed: the clause is a text scan, so a comment is a faithful subject for it, and a live statement would have needed a binding this fixture has no reason to introduce. It demonstrates that the extraction needle reaches the formerly-exempted file, which is the property the finding says the register was leaning on.

Each mutation was reverted and the file re-run green before the next.

---

## 4. What I deliberately left alone

- **The six `MESSAGE_PARSE_NEEDLES`, their count assertion and their own discriminating fixture.** AC-6 requires the existing scan to pass *unmodified*; it is untouched, including the `[role="progressbar"]` acceptance case.
- **`extractsFromMessage`.** Its needles, its `[ \t]` gaps and its four fixtures are unchanged — the finding is about the literal clause, and weakening or widening the extraction half while addressing it would be a second change under one finding's cover.
- **Everything AC-1 to AC-5 and AC-7 shipped in iteration 1.** No production file changed this round: the diff is three test files, 59 insertions and 26 deletions.
- **`contracts/Q-0015/mission-control.contract.md`** — `contracts/` is not among `developer-generalist`'s fourteen roots, the merged requirement says in as many words that **no criterion may name this file**, and it is GO-2, the human's at the gate. Unchanged and unnamed.
- **`docs/06-development-plan.md`** (Q-0094 E-3(a)) and **`docs/05-design-prompt.md`**.
- **`RUN_EVENT_RETENTION`'s value and `DEFAULT_RETENTION`** — AC-7 is honoured by not revisiting the figure.
- **`packages/core/src/engine/run-number.test.ts:206`**, which assembles the run-start narration from its own parts. It is in `packages/core`, which is the **producer** of that narration and outside AC-6's corpus by the criterion's own words; forbidding the literal there would forbid the engine from emitting it.
- **Iteration 1's report.** It is in `backlog/`, which this role does not write, and its §2 table row describing the two-site exemption register is superseded by this document rather than edited.

---

## 5. Verification

- `pnpm install --frozen-lockfile` → *"Already up to date"*, then `pnpm turbo run test --force --continue` — **7/7 tasks, 0 cached**, all green (`@quorum/cli` 26 files / 692 tests among them).
- `pnpm turbo run lint typecheck --force --continue` — **14/14 tasks**, 0 errors.
- `pnpm exec quorum lint` — **6/6**.
- `pnpm sweep:git-identity` — green: *"the workspace suite executed and green with no resolvable git identity"*.
- `apps/web` alone, over the three changed files — 147 tests passed.
- The four mutations in §3, each red with a discriminating message and each reverted.

GO-3 (the product run by hand against a real daemon, with the transcript recorded), GO-4 (the truncated review's omitted tail read cross-vendor) and GO-5 (both environment rows after the merge) are the operator's at the gate and are not claimed here.

---

## 6. One thing worth recording, because it is the ticket's own subject arriving in my fix

The first run of the corrected guard **failed on my own JSDoc**. Both new constants carried a comment explaining that the fixture is assembled *"so no file under `apps/web/src` carries the `run #` literal at all"* — which spells the literal, in a file under `apps/web/src`, inside the comment announcing that it is not spelled there. The scan is over every file in the tree and every byte of it, comments included, so it reported both files by name.

It is worth a paragraph rather than a quiet fix for two reasons. It is the shape this repository records most — a check written about a subject that the writing itself becomes — and it is the argument for the finding being right: had the exemptions stayed, those two comments would have been exempted along with the fixtures, and the guard would have reported nothing at all. **The prohibition catching its own author's explanation on the first run is the strongest evidence I have that it is now the corpus-wide claim AC-6 asks for.** Both comments now name the literal without spelling it, which is the same rule the fixtures are under.
