# Q-0135 — implement report, run 2, iteration 3

*Round 3, a revision round. `review/chore/run-2/chore-iter-2.md` returned **one major** and no nits.
Both halves of it are real, both were **reproduced as fixtures before anything was changed**, and
both are closed at the analysis rather than at a fixture.*

**Verified forced in this worktree**: `pnpm install --frozen-lockfile` → *Already up to date*, then
`pnpm turbo run test lint typecheck --force --continue` → **21 of 21 tasks successful, 0 cached**,
and `pnpm exec quorum lint` → **6/6**. The diff is **one file**: `apps/web/test/source.test.ts`.

**The web suite stays at 510 tests and that is not an omission** — every assertion below is inside
the existing AC-11 clause, which is the test the finding is about. What moved is what that one test
asserts: eight new fixtures in it, six of them shown red first.

---

## 1. The finding, reproduced before it was fixed

> *`apps/web/test/source.test.ts:974` — the AC-11 guard parses timer callbacks by counting every
> bracket character without recognizing strings, templates, regexes, or comments … The final
> helper-call check at line 1002 also interpolates identifiers directly instead of using `asNeedle` …
> concrete false negatives.*

Both cited lines were exactly the two defects — `:974` the `timerCallbacks` walk, `:1002` the raw
needle. **Six false negatives, every one measured against the guard as it stood:**

| Fixture | Reported before the fix | Required |
| --- | --- | --- |
| a fetch after `'))'` in the callback | **0** | 1 |
| a fetch after `` `}}` `` | **0** | 1 |
| a fetch after `/\)\)/` | **0** | 1 |
| a fetch after `/* )) */` | **0** | 1 |
| a timer calling `reload$now()` | **0** | 1 |
| a timer calling `$reload()` | **0** | 1 |

The two `$` rows are the sharper half, and the run separates the two causes rather than lumping
them: `requestingNames` **does** collect the helper in both cases — the name is a binding whose body
reaches the daemon — so the walk was never the problem and the needle at the callback boundary lost
a call it had already been handed. That pair of assertions sits in the clause permanently, because a
row that only asserts the end state cannot say which half moved.

**Both halves are latent rather than live**, and the measurement is worth recording so the fix is not
presented as closing something that was open: **no identifier under `apps/web/src` carries a `$`**
(`grep -rlE "(const|let|var|function) [A-Za-z_0-9]*[$]"` → nothing), and no timer callback in the
corpus contains a literal at all. What the finding is about is what the clause would fail to see, not
what it was failing to see — which is the right standard for a prohibition.

---

## 2. What shipped

### `codeOnly` — the scanner, new

The same text with every comment, quoted string, template literal and regex literal blanked to
spaces. **Index- and length-preserving** (`split('')` splits by UTF-16 code unit, which is the unit a
`RegExp` match index is in), so an offset into the blanked text is the same offset into the text as
written — and **nothing reads the blanked text for content**. Every slice this file reports still
comes from the text as written; the only thing that changed is which bracket characters a depth walk
counts.

Comments, quoted strings and template literals need no context to lex and are exact here, **including
a template's `${…}` interpolations**, which are lexed as the code they are — so a nested template, a
string holding a `}`, and a brace inside an interpolation all fall out of the one loop rather than
needing a special case.

**The one genuine ambiguity in JavaScript is `/`, and it is decided the way the language decides it**:
a `/` after a value — an identifier that is not one of thirteen keywords, a number, `)`, `]`, or a
literal that has just closed — is a division; anything else opens a regex. Two exactness rules follow
from the language rather than from a guess: a candidate regex that reaches a line break opens none,
a regex literal holding no line terminator; and a quote that does not close on its own line opens no
string, because blanking a partial line is the one thing here that could remove an **opening** bracket
from the count, and a shorter region is the direction that hides a poll.

**The property the clause now rests on, stated as such: over syntactically valid code the walk closes
a timer's argument list exactly where the language does.** The code between a callback's `{` and a
request written after a literal is balanced, so once no literal contributes a bracket there is
nothing left that can return the count to zero early — which is the whole of the finding.

### `depthsOf` — one reading, over the blanked text

Bracket depth before every position, counted over `codeOnly`'s output and indexed by offsets into the
text as written. `bindings` and `timerCallbacks` both take it.

**The heads and the timer calls are still matched over the text as written, and the asymmetry is
deliberate.** A head found inside a comment is a name that does not exist — it adds an entry and can
never remove the real one, so it only widens what the walk collects. A head or a `setInterval(`
**lost** to a lexer mistake would take a real body out of the walk, which is the one direction that
hides a poll. So the blanked text decides no head and no timer; it decides only a depth.

### `asNeedle` — hardened at both boundaries, not only escaped

`\b` → a not-an-identifier-character assertion on each side, with `$` escaped. Escaping alone closes
`reload$now` and **leaves `$reload` open**, because `\b` is no boundary before a name starting with
`$` — neither a space nor a `$` is a word character. That is this repository's most-recorded failure
in one line, so it is closed at the class and **both directions are fixtured**: `other$reload(` is
also no longer read as a call to `reload`, which is a correction rather than a narrowing — it never
was one.

### `pollers` — reuses it

The raw `new RegExp(\`\\b${called}…\`)` at the callback boundary is gone; it calls `asNeedle`.

---

## 3. A hazard the finding did not name, which this fix would have introduced

**`</span></p>` is a `/` preceded by `<` with another `/` later on the same line** — so without a
clause for it, a closing tag's slash opens a regex candidate and the JSX between the two slashes is
blanked, taking its brackets out of the count. **Measured before choosing: four live sites, in
`diff-view.tsx` (`:223`, `:225`) and `gate-screen.tsx` (`:364`, `:412`).**

Neither of those files schedules anything, so nothing would have been reported wrongly today. That is
luck rather than design, and **a scanner introducing the very class it was added to remove** is the
shape this repository records most — so the `/` of a JSX closing tag opens no regex. A self-closing
tag needs no clause and does not get one: a tag name precedes its `/`, so the value test already
reads it as a division. The only regex this refuses is one written directly after a `<`, which is not
an expression position.

The fixture is the property rather than the spelling — every bracket a walk should count survives a
realistic JSX line — and without the clause it loses **seven, four of them openers**:
`expected '{}))}' to be '{}{(()({}))}'`.

---

## 4. What I wrote, measured, and took out again

A **second depth reading over the text as written**, with every region taken as the longer of the two.
It has a genuinely attractive property: the region can then only grow against what it replaced, so
the clause would be immune to a lexer mistake rather than dependent on the lexer being right.

**It came out because no fixture could tell it from the fix.** Measured: with the blanked reading
alone the whole suite passes, all 50 tests, every new fixture included — the only shapes that separate
the two readings are ones the scanner gets right. Machinery no fixture discriminates is machinery a
later reader cannot check, which is the standard this file holds everything else to. What carries the
clause instead is the exactness argument above, the whole-tail fallback for text that closes nowhere,
and the head/timer asymmetry. The removal and its reason are recorded on `depthsOf` rather than left
out of the record.

---

## 5. Mutations run, rather than a green suite read

| Mutation | What went red |
| --- | --- |
| `codeOnly` returns the text unchanged | all four literal rows report **0** — the finding's own mechanism, in each of its four kinds |
| the regex branch disabled | **the regex row alone**, 1 → 0, the other three still 1 — so each kind is discriminated separately rather than by one fixture standing in for four |
| `pollers` back to the raw needle | **both** `$` rows, 1 → 0 |
| `asNeedle` back to `\b` plus escaping | the mid-name row passes and **`$reload` stays 0** — fixing the instance and not the class, demonstrated rather than argued |
| the JSX clause removed | *a JSX closing tag was read as opening a regex: expected `'{}))}'` to be `'{}{(()({}))}'`* |
| both depth readings instead of one | **all 50 pass** — which is why the second reading is not in the change |

The four literal rows and the two `$` rows were each shown red **before** the helpers moved, not only
by reverting them afterwards.

---

## 6. What I deliberately left alone

1. **`extractsFrom` (`:193–195`) and `messageAliases` (`:170`) interpolate a bound name raw**, which
   is the same class as the finding's second half at a site the finding does not name. **Reported and
   not fixed**, on round 2's own precedent in this ticket and for three reasons: they are **Q-0015
   AC-6's** clause rather than this ticket's, no criterion of Q-0135 names them, and `asNeedle` cannot
   be reused there — those needles are not call needles, so it would mean a second escaping helper and
   a predicate change to a shipped prohibition that no erratum rules. Latent for the same measured
   reason as this round's: no identifier under `apps/web/src` carries a `$`.
2. **`messageAliases`' capped five passes** — round 2's residual, unchanged and still reported.
3. **Everything outside the AC-11 clause.** No `src` file, no `packages/`, no `docs/`, no flow file
   and no contract is touched: this round's finding is about one guard, and the diff is that guard.
4. **The `[data-mission-control-header]` assertion** (AC-14) — byte-identical, still green, still
   shown to have a subject.
5. **The four existing timer fixtures**, `REACHES_THE_DAEMON`, `TIMERS`, the `scheduling` identity and
   the persistence half — unchanged, so the eight new fixtures are added coverage rather than a
   replacement. The narrowing E-2 ruled is still proven *necessary*: the pre-narrowing clause still
   refuses the shipped elapsed tick.
6. **`RequestState` at five, `MISSION_CONTROL_DISCLOSURES` at five, `COUNT_FIELDS` at four,
   `vendorCostRows`, the roll-up's order and the no-sum rule** — untouched.
7. **GO-4 and GO-5 are the gate's**, as in rounds 1 and 2: one needs the review prompt this round
   produces, the other a browser and a running daemon.

---

## 7. Residuals, stated rather than left to be found

1. **Two residuals in the scanner, and neither is weaker than the walk it replaces.** A regex written
   directly after `)` or `}` — `if (x) /re/.test(y)`, which no file here writes — is read as a
   division and its brackets are counted, which is what the walk did with *every* regex everywhere
   before this. And two apostrophes in one line of JSX text would be read as a string, which
   over-blanks a balanced region and so moves nothing. Both are on `codeOnly`, where the next person
   editing it will look.
2. **Text that is not valid at all closes nowhere and is collected whole**, so it fails this clause
   rather than passing over it. That is unchanged from what it replaced and is deliberate.
3. **Rounds 1 and 2's residuals stand** and are not re-litigated: the observed-vendor set is a lower
   bound and says so; `unpriced_steps` is disclosed wherever it is non-zero, which is AC-13's literal
   wording; `unreadable-start` is a seventh state AC-16 does not enumerate, named in prose rather than
   rendered as `NaN`; AC-17's sentence clause stays scoped to the three mission-control renderers.
4. `pnpm turbo run lint` reports **one pre-existing warning** in `packages/core`
   (`448:3 Unused eslint-disable directive`), which this diff does not touch. Reported, not fixed —
   the third round in a row to report it.
5. **An environment note, not a finding.** The forced run printed
   `warning: could not add .quorum/ to /tmp/…/.git/info/exclude: no space left on device` from a
   `@quorum/core` fixture's own temp repository; the test passed, and `df` reports 271 GiB free on
   that volume, so it is a transient condition of this machine under a fully parallel forced run and
   not a property of the commit. Nothing in this diff reaches `packages/core`.

---

## 8. Verification, in full

```
pnpm install --frozen-lockfile        → Already up to date
pnpm turbo run test lint typecheck --force --continue
                                      → Tasks: 21 successful, 21 total   Cached: 0 cached, 21 total
   @quorum/shared   279 passed        @quorum/web      510 passed
   @quorum/core    1598 passed (2 skipped)             @quorum/server   242 passed
   @quorum/cli      692 passed        @quorum/compiler / @quorum/templates  1 each
pnpm exec quorum lint                 → 6/6
git status                            → one modified file
```

No decision entry is owed: this round changes a test guard's predicate, which erratum **E-2** ruled at
the gate as a permitted change to the predicate and nothing beside it — and the narrowing ships with
**no file-level exemption, no comment token and no register of permitted callers**, which is what E-2
forbids. No criterion or finding named a surface this flow cannot write: the single changed file is
under `apps/`, and `contracts/` — outside this role's roots — is untouched, its note having been
written by hand at the gate (`ccbcc2b`).
