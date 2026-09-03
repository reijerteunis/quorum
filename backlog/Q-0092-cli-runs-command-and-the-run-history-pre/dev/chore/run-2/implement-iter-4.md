# Q-0092 — implement, run 2, iteration 4

Revision round. Review iteration 3 returned **revise** with one major and one nit; both are
addressed below. Two files changed, `packages/cli/src/runs.ts` and `packages/cli/src/runs.test.ts`.
Nothing else in the tree moved.

---

## The major: `occurrenceFields` rendered `undefined` where AC-9 asks for `n/a`

> *major: packages/cli/src/runs.ts:172 — `occurrenceFields` does not render `n/a` for every absent
> occurrence value as AC-9 requires: absent `kind` and `started_at` interpolate as `undefined`,
> absent `attempts` becomes `undefined` through `String`, and absent `status` is passed to
> `statusLabel` and likewise rendered as `undefined`.*

**Accepted, reproduced, and fixed.** The finding is exactly right, including its account of why it is
reachable.

### What was there, and why it was there

The previous spelling put a fallback on precisely the four fields
`packages/core/src/run-history/manifest.ts` declares nullable and on none of the four it declares
required:

| field | declared type (`manifest.ts:95–125`) | previous rendering when absent |
| --- | --- | --- |
| `kind` | `OccurrenceKind` | `kind=undefined` |
| `adapter` | `string \| null` | `adapter=n/a` |
| `model` | `string \| null` | `model=n/a` |
| `status` | `RunStatus` | `undefined`, painted dim |
| `started_at` | `string` | `started_at=undefined` |
| `duration_ms` | `number \| null` | `duration_ms=n/a` |
| `attempts` | `number` | `attempts=undefined` |
| `verdict` | `string \| null` | `verdict=n/a` |

So it was type-faithful and criterion-unfaithful, and the reviewer's reachability argument is the
one that decides it: **a detail read validates no schema at all.** `readRun` parses and returns;
`manifestShapeError` is not on that path, and even where it is, it proves five things about a
manifest and none of them is an occurrence's shape — which AC-12 defect 4 rules deliberate. The
declared nullability is therefore a statement about what the *writer* produces, not about what the
*reader* meets, and following it renders `undefined` on exactly the hand-edited, truncated or
partially-written document a maintainer opens this view to understand.

### The change

One helper, applied to all eight:

```ts
const occurrenceField = (value: string | number | null | undefined): string =>
  (value == null ? 'n/a' : String(value));
```

`status` reaches it as `statusLabel(step.status ?? 'n/a')` rather than through the helper, because it
is the one field rendered bare and painted rather than as `key=value`; `'n/a'` is neither `completed`
nor `running`, so it takes `statusLabel`'s dim branch, and `statusLabel` itself is untouched — which
matters, because `runHeaderLine` calls it too.

The helper carries its authority in a `Why:` line, since `?? 'n/a'` against a non-nullable declared
type is counterintuitive on purpose and is the thing a later reader will want explained.

### Demonstrated red before green

Reverting `occurrenceFields` to the previous spelling and running the new test alone:

```
Expected: "kind=n/a adapter=n/a model=n/a n/a started_at=n/a duration_ms=n/a attempts=n/a verdict=n/a"
Received: "kind=undefined adapter=n/a model=n/a undefined started_at=undefined duration_ms=n/a attempts=undefined verdict=n/a"
```

One assertion, naming all four defects at once, in the order the review named them. The fix restores
it and the other 37 tests in the file are unaffected.

### The new test, and its second half

`runs.test.ts` gains one test in the AC-9 block — *"an occurrence the document does not fill in reads
n/a in all eight fields"*. It is the *"parseable malformed-manifest test covering the absent values"*
the review asked for: a well-formed manifest whose one occurrence carries `step_id` and
`occurrence_dir` and nothing else, written through `put`, which takes `unknown`, so no cast is
needed to build a document the type forbids. The whole field line is asserted as a **`toBe`
identity** rather than by eight `toContain`s, so a ninth field, a reordering or a separator change
fails as loudly as a missing fallback.

Its second half is a boundary pin, and it is the part I would ask a reviewer to read closely. The
same fixture omits `flow`, so the **header** renders `undefined` — and the test asserts that it
does. That is deliberate: AC-8 specifies the header's rendering field by field and gives it exactly
two fallbacks, `?` for an absent stage endpoint and `duration=n/a` for a null duration. AC-9's rule
is the occurrence line's. Widening it upward is a change no criterion asks for, so the assertion
exists to make doing it a deliberate act instead of the obvious next tidy-up — and to answer, in
place, the question a fifth review round would otherwise raise.

### The judgement call, stated rather than buried

**This is a divergence from the spike, and it is the one decision of this round I want ruled at the
gate rather than assumed.** `spike/bin/harness.js:270` renders those four fields exactly as the
previous port spelling did:

```js
`kind=${s.kind}`, `adapter=${s.adapter ?? 'n/a'}`, `model=${s.model ?? 'n/a'}`, statusLabel(s.status),
`started_at=${s.started_at}`, `duration_ms=${s.duration_ms ?? 'n/a'}`, `attempts=${s.attempts}`, `verdict=${s.verdict ?? 'n/a'}`,
```

so after this change the two trees render a truncated occurrence differently. I took AC-9 over the
spike for three reasons, and no erratum is owed on my reading:

1. **AC-12 enumerates the preserved set exhaustively** — five defects, named — and this rendering is
   not among them. Ground rule 3's own examples are all open tickets that land in both trees
   (Q-0059, Q-0060, Q-0066, Q-0068). A requirement that lists what must be preserved has decided
   what is not on the list.
2. **AC-12 defect 4's deliberateness is about refusing, not about rendering.** It rules that the
   command does not *reject* a document that only parses — *"refusing here would make a listing fail
   on a sibling's damage"*. It says nothing about how an absent field prints, and AC-9 does.
3. **Nothing observes the old rendering.** `grep -rn 'kind=\|attempts=\|started_at=' spike/test/`
   returns two hits, both in `q0040-undecided.js` and both about a gate's `kind=human`. No spike
   scenario drives a truncated occurrence through the detail view, so the transfer is unobserved on
   both sides and the spike suite is green untouched (19/19).

If the gate reads ground rule 3 as binding here instead, the repair is to revert `occurrenceFields`
and delete the new test — one commit, and no other criterion depends on it.

---

## The nit: a stale `removeEmit()` count

> *nit: packages/cli/src/runs.test.ts:15 — the new header comment says `build.test.ts` removes the
> emit "twice," but the implementation report and the new `build.test.ts` banner correctly count
> four `removeEmit()` sites.*

**Accepted and fixed, counted in the tree rather than transcribed.** `grep -n removeEmit
packages/cli/src/build.test.ts` gives the definition at `:203` and four call sites — `:761`, `:995`,
`:1233`, `:1868`. The header now says four, and names where the "twice" came from: the Q-0098 banner
at `build.test.ts:1248–1253`, which says *"this file deletes that directory twice"* and names two of
them. That banner is Q-0098's prose, predates the two sites added since, and is **reported and not
edited** — `build.test.ts:1904`, added in an earlier round of this ticket, already records the
discrepancy in place. Correcting another ticket's banner is not this ticket's surface, and the nit
asked for the count in *this* file.

The correction is a nit about a nit's own subject: the sentence I wrote to explain where a test lives
had inherited a measurement instead of taking one, which is the failure mode this repository keeps
recording. Fixed the way that rule says to fix it.

---

## File by file

**`packages/cli/src/runs.ts`** — `occurrenceField` added as a module-private helper with its
authority line; `occurrenceFields` rewritten to route all eight fields through it, `status` through
`statusLabel(step.status ?? 'n/a')`; `occurrenceFields`'s doc comment gains the paragraph stating
that the header keeps AC-8's two fallbacks and gains none, so the asymmetry is documented where a
reader meets it. Nothing else in the file moved — not `runHeaderLine`, not `statusLabel`, not the
two JSON shapes, not the selection logic, not the module banner's five preserved defects. AC-2's ten
named functions are all still in this module and nowhere else; `occurrenceField` is module-private
and names no symbol in `DOMAIN`, so the frame/command partition is unaffected.

**`packages/cli/src/runs.test.ts`** — one test added to the AC-9 block; the file header's
`removeEmit()` count corrected. 37 tests → 38, all passing.

---

## What I deliberately left alone

- **`runHeaderLine` and `statusLabel`.** An absent `flow`, `run_id` or `ticket_id` still renders as
  the document leaves it. AC-8 enumerates the header's rendering and gives it two fallbacks; adding
  more would be an unrequested default, and `statusLabel` is shared with the header so a fallback
  inside it would have changed both views. Pinned instead.
- **`build.test.ts`'s Q-0098 banner**, which still says the emit is removed twice. Reported above and
  already noted in place at `:1904`.
- **`spike/`** — nothing under `spike/src/` or `spike/test/` is touched (ground rules 1 and 2;
  `git diff HEAD -- spike/` is empty). No freeze re-record is owed.
- **`spike-parity.test.ts`**, `packages/core`, `packages/cli`'s frame modules, `docs/` — untouched
  this round. The register rows, the barrel, the reader and the architecture paragraph landed in
  earlier iterations and no finding of this round reaches them.
- **The five AC-12 preserved defects**, all still preserved and pinned; and Q-0059, Q-0060, Q-0066,
  Q-0068, Q-0100, none of which is closed here.

---

## Verification

Installed first (`pnpm install --frozen-lockfile` — already up to date in 183 ms;
`npm install --prefix spike --no-audit --no-fund`), then everything forced.

| check | result |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — `@quorum/cli` 13 files, **274 tests** passed |
| `npm test --prefix spike` | **19/19 test files passed** |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `pnpm turbo run build --force` | 3/3 tasks, 0 cached |
| `node spike/bin/harness.js lint` | 6/6 flows ✓ |
| `pnpm sweep:git-identity` | *"both suites executed and green with no resolvable git identity"* |

### Through the built binary, not from a report

R-7 is why: a reviewer under `--sandbox read-only` cannot execute this, so §10's six statuses are
claimed by running `packages/cli/dist/quorum.js` against fixtures.

| invocation | expected | observed |
| --- | --- | --- |
| `runs`, damaged sibling present | 1, listing **and** warning | exit 1, listing ✓ warning ✓ |
| `runs` over an empty store | 0, `· no runs found` | exit 0, that exact line |
| `runs Q-0011-2` beside damage | 0, detail, sibling unnamed | exit 0, occurrence ✓, `bad` absent ✓ |
| `runs Q-9999`, clean store | 0 | exit 0 |
| `runs Q-9999`, corrupt store | 1 (E-4) | exit 1 |
| `runs ../SECRET.txt --json` | non-zero, nothing disclosed | exit 1, `{"error":"unknown run or ticket: ../SECRET.txt"}`, no `LEAKED` |

And this round's subject, through the same binary, on a manifest holding one truncated occurrence
beside one complete occurrence:

```
kind=n/a adapter=n/a model=n/a n/a started_at=n/a duration_ms=n/a attempts=n/a verdict=n/a
kind=adapter adapter=mock model=n/a completed started_at=2026-08-23T10:00:00.000Z duration_ms=5 attempts=1 verdict=n/a
```

The second line is the discriminating half: a filled-in occurrence renders byte for byte as it did
before, so the change reaches absent values and only absent values.

The `q0011-runs-cli.js:29–82` parity check from round 1 was re-run and still holds — `quorum runs ""`
lists exactly what `quorum runs` lists, same stdout, same exit code.

Verification in the second environment row (Q-0072's closing finding) is owed at the merge: this
worktree has neither `.harness/worktrees` nor `.quorum/runs`, so both suites want re-running forced
on `main` afterwards.

---

## Not done, and why

Nothing in the merged requirement is unimplemented. No decision entry is owed — §6 non-goal 12
stands, every ruling this ticket rests on is already written — and no erratum is owed on my reading
of the divergence above, which is set out in full so the gate can rule otherwise cheaply if it
disagrees.
