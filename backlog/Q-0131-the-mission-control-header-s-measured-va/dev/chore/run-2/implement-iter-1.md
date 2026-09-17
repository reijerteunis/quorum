# Q-0131 — implement report, run 2, iteration 1

*Verdict: `proceed`. Seven criteria, AC-1 to AC-7, all implemented. Full forced suite green in 7/7 tasks; `lint` and `typecheck` 14/14; `quorum lint` 6/6; `pnpm sweep:git-identity` green. Eight mutations across six sites, each shown red with a discriminating message.*

---

## 0. What shipped, in one paragraph

`RunFlowOptions` gained **one optional callback**, `reportRunNumber`, declared beside `answerGate` and documented as the same kind of channel. `engine.ts` calls it once per run at the existing run-start site — immediately before the `info` that already carries the number in prose, **outside the `if (!dry)` guard**, with the call isolated so that a throwing caller costs one `warn` and nothing else. `host.start` passes a closure that sets `record.runId`, at the call site that already passes `answerGate`. `WireRun` therefore carries a live run's number on `GET /runs/:handle` and `GET /runs` **with no wire shape change at all**, and mission control's header renders it from the metadata read it already performs for `flow` and `ticketId`.

**No event gained a field. The event union is unchanged at nine members. No schema moved.**

---

## 1. File by file

### `packages/core/src/engine/types.ts` — AC-1

Added `ReportRunNumber`, a `(runId: number) => void`, declared immediately after `AnswerGate`, and `reportRunNumber?: ReportRunNumber` on `RunFlowOptions`, immediately after `answerGate`.

The type's JSDoc carries the ruling in the code's own authority comment, which is what GO-1 asks for (Q-0108's precedent): the in-band `start` member is named as the refused alternative, with the reason — three landed sentences are each about *an event*, so a callback leaves all three true verbatim where a member makes all three false by one word — and with its cost stated rather than waved past, that in the worst case the number reaches a reader one read later than an in-band event would.

**The `Why:` line uses the vocabulary the register already recognises.** It first read `Why: ruled at Q-0131's gate, see erratum E-1`, and `q0050.source.test.ts`'s `classifyAuthority` threw on it: that classifier recognises exactly three forms and a fourth is not something to widen it for. It now reads `Why: deliberate addition, not preservation — Q-0131, whose erratum E-1 refuses the in-band alternative`, which is the form Q-0116 established for exactly this shape — a new behaviour rather than a preserved defect.

### `packages/core/src/engine/engine.ts` — AC-1

Destructured `reportRunNumber` from the options, and added the guarded call above the run-start `emit`. **The `info` message's text is byte-identical**, which AC-1 requires and which the AC-1 source clause asserts: it is narration for a human and stays one, so every existing reader of `runs.log` and of the trace is untouched.

The value passed is `context.runId` rather than a recomputation.

### `packages/server/src/host.ts` — AC-2, AC-3

- `reportRunNumber: (runId) => { record.runId = runId; }` added to the `runFlow({…})` call, beside `answerGate`.
- `RunView.runId`'s JSDoc corrected. It said the number is *correlated when the terminal event arrives*, which is a claim about **when** rather than about **who**, and which this change makes false. It now says `core` is the sole authority and that the number arrives out of band at run start, with the terminal event carrying the same number as a second delivery of one authority's value.
- `observe`'s block gained a paragraph explaining why the number it assigns is no longer the first one the record holds, and why the assignment stays rather than becoming conditional. **Its two existing sentences are unchanged**, both being true and the first being one of AC-3's three untouched sentences.

**No wire shape changed**: `wireRunOf` already projects `record.runId`, and `WireRun.runId` has been `number | null` since Q-0121.

### `packages/shared/src/wire.ts` — AC-3

`WireRun`'s JSDoc corrected in one clause. It said `runId` *is `null` until the terminal event carries it*; it now says the number is reported out of band at run start and is `null` only before a run is under way, and records that the field itself did not move.

### `apps/web/src/mission-control-status.tsx` — AC-4, AC-5

- `terminalRunId(events)` replaced by `loadedRunId(metadata)`. The module docblock is rewritten to say why: the socket was chosen originally **not** because metadata is the wrong home for a run's identity but because a running run's `runId` there was always `null`, and that premise is what this ticket removes.
- `Header` no longer takes `snapshot` at all. That is deliberate and the docblock says so: every value it renders comes from the one metadata read, and a parameter carrying the event stream is what a later change would reach for to recover a number from a terminal event.
- The disclosure filter now reads `loadedRunId(metadata) === null`, so the first sentence retires exactly where a number was loaded and survives where one was not — a read in flight, and a read that failed.
- The now-unused `Event` type import removed.

### `apps/web/src/mission-control-text.ts` — AC-5

`MISSION_CONTROL_DISCLOSURES[0]` rewritten from *"The run's number is not on the wire until the run ends; its handle identifies it meanwhile."* to *"The run's number has not been read from the daemon; its handle identifies it meanwhile."*

**It changed subject rather than retiring**, and the array's own JSDoc records that: the old sentence stopped being true the day `core` began reporting the number at run start, but the *state* it describes did not stop happening, because a metadata read still in flight or one that failed supplies no number either. So it names the read rather than the run's age.

### `apps/web/src/run-connection.ts` — AC-7

`RUN_EVENT_RETENTION` **does not move**. Its JSDoc gained the record AC-7 requires: Q-0015's demonstration (`events 10 · missed 0 · peak concurrent columns 3`), that the run was a `--dry` walk which invokes no adapter and so emits no `stdout`, the 165-run occurrence distribution (median 4, p90 11, max 55, ≈275 non-`stdout` events for the largest), and that the missing real-traffic figure **cannot be recovered from run history**, an occurrence's `output.txt` being the adapter's final message rather than the stdout stream.

---

## 2. Tests

### New

**`packages/core/src/engine/run-number.test.ts`** (AC-1, 8 clauses). Over real mock-adapter runs:

- the number reaches the caller with **zero events yet delivered** to the consumer, and equals **3** — the fixture seeds `runs.log` to `run=2`, so a hard-coded 1, an iteration counter or anything recomputed downstream cannot answer it — and the same 3 appears in `runs.log`'s start line, in the run-history directory name, and on the terminal event;
- a `--dry` walk reports its number too, asserted **specifically** (R-5: it is the first case anyone exercising this will meet), with a companion clause proving the walk really was dry;
- a flow traversing a backward edge reports **once**, with the loop's two traversals asserted first so the "once" has a subject;
- a throwing callback leaves the terminal status `completed`, emits exactly one `warn` carrying the caller's own words, and leaves the step's document on disk;
- a run supplying no callback is unchanged and warns about nothing;
- a real run emits nothing the event union does not admit, beside the union's own refusal of a `start` event;
- the run-start `info` literal is unchanged, matched through `coreSourceFiles()`;
- the number is reported from **one** site, and that site is the run loop.

**`packages/server/src/run-identity.source.test.ts`** (AC-3, 3 clauses). Both directions in one file, because the failure it guards against is a partial correction:

- neither corrected site still dates the number to the end of the run, each needle shown to have a subject, and each corrected site shown to say the **true** thing rather than merely not saying the false one (a deletion would satisfy an absence clause);
- the three sentences a callback did **not** make false are byte-identical — `docs/GLOSSARY.md`'s **Event** term, `packages/shared/src/events.ts`'s header, `host.ts`'s terminal-event statement;
- the host reads no event `message` and takes no `gateId` apart, with both needles shown to fire and the benign forms shown not to be reported.

It adds **no turbo input**: `packages/shared`'s source reaches this task through the workspace dependency edge, and `docs/GLOSSARY.md` reaches it the way `docs/04-architecture.md` already does and which `packages/server/turbo.json` states at length. The transitive coverage is said out loud in the file header rather than assumed (Q-0072 E-1's discipline).

### Extended

- **`packages/shared/src/events.test.ts`** — AC-1's union clause: nine members, a `start` event refused, and both shown to discriminate against a real `z.discriminatedUnion` carrying the member.
- **`apps/web/test/source.test.ts`** — AC-6's new clause (the `run #` literal with a two-site exemption register, plus an **unexempted** extraction needle) and AC-7's bound clause.
- **`apps/web/src/mission-control-status.test.ts`** — AC-4 and AC-5.
- **`packages/server/src/serve.test.ts`** — AC-2, over a real port.

### Re-aimed, not deleted — seven landed pins asserted the old behaviour

| Pin | What it said | What it says now |
| --- | --- | --- |
| `host.test.ts` AC-3 | `expect(outcome.run.runId).toBeNull()` | the start outcome carries the number, and the terminal event agrees with it |
| `http.test.ts` Q-0121 AC-4 | a running run has no number; the number arrives with the terminal event | a live run **is** listed with its number, `state` is what moves across the two reads, and the number is unchanged between them |
| `package.test.ts` AC-3 | one assignment to `record.runId`, from `event.runId` | a two-entry register keyed on **whose value it is**, with a structural assertion that the second really is the callback's argument, and a fixture showing a derived assignment is collected |
| `mission-control-status.test.ts` ×2 | a metadata `runId` must be **ignored**; a terminal event supplies the number | the metadata number is rendered and the socket's different number is **not**, both branches asserted |
| `q0050.source.test.ts` AC-13d | nine files carry `Why:` lines | ten; `types.ts` added with why, and the `preserved defect/` count of 14 is untouched |
| `turbo-inputs.test.ts` clause C4 | — | `run-number.test.ts`'s two read bases registered with what each is for |

---

## 3. Every guard shown red by mutation

A guard read is not a guard established. Eight mutations, each producing a discriminating message, each reverted:

| # | Mutation | Red |
| --- | --- | --- |
| A | the `reportRunNumber` call disabled in `engine.ts` | 4 core clauses **and** 3 server clauses, across two packages |
| B | `loadedRunId` returns a number that is not the metadata's | both AC-4/AC-5 clauses |
| C | disclosure 0 retired unconditionally | the AC-4 clause **and** the five-disclosures clause |
| D | `RUN_EVENT_RETENTION` → 1000 | AC-7, naming the bound |
| E | a `run #` parse added under `src` | AC-6's literal clause, naming the file |
| E2 | an extraction from a message with **no** literal | AC-6's extraction clause, alone — so the two halves fire independently |
| F | the retired wording restored in `wire.ts` | AC-3's first clause, naming the file |
| G | one of the three untouched sentences rewritten in `host.ts` | AC-3's second clause, naming the file |
| H | a tenth member added to `eventSchema` | the shared union clause |

---

## 4. Three instrument defects of my own, found and fixed

Recorded rather than quietly corrected, because each is a class this repository records.

1. **A needle whose `\s*` crossed a newline.** AC-6's extraction needle `\.\s*(?:exec|test)\s*\([^)]*\bmessage\b` matched a comment ending in a full stop, crossed the blank line after it, and hit vitest's own `test('… a non-string message never reaches JSON', …)` — reporting `frame-parser.test.ts`, which parses no message and never did. Every gap is now `[ \t]` and the file says why. A guard that reports a file doing nothing of the kind is one a reader learns to override.

2. **A `*/` inside a JSDoc.** The AC-7 comment cited `backlog/Q-0015-*/runs.log`, which closes the block comment — the **Vite build** failed, and with it four `packages/cli` build tests. Caught by the forced suite rather than by reading. The citation is rephrased.

3. **Shape introspection on a union member that is itself a union.** The first AC-1 union clause read `option.shape.type.value` over `eventSchema.options`; the ninth member, `runTerminalEventSchema`, has no `.shape`. Replaced by a member count plus a `safeParse` refusal of the shape the erratum is about, which says something about the refused alternative that a count cannot.

A fourth is a design consequence rather than a defect: **the retired wordings were originally quoted inside the corrected JSDocs**, in this repository's usual style, which would have made AC-3's absence needle match its own subject and pass over a revert. The quotations were removed.

---

## 5. What I deliberately left alone

- **`contracts/Q-0015/mission-control.contract.md`.** `contracts/` is not among `developer-generalist`'s fourteen roots — which cost Q-0129 an implement round one ticket ago — and the merged requirement says in as many words that **no criterion may name this file**. It is GO-2, the human's at the gate. I have not named it in any criterion and have not touched it.
- **`docs/06-development-plan.md`.** Q-0094 erratum E-3(a) ruled that a development-plan edit by an implement step is a revert waiting to happen, this page's bullets being rewritten by hand at each plan pass.
- **`docs/05-design-prompt.md`.** The brief specifies `run #42` as a design target; this change satisfies it rather than contradicting it.
- **`RUN_EVENT_RETENTION`'s value**, and `DEFAULT_RETENTION`. AC-7's instruction is honoured by not revisiting the figure.
- **`packages/cli`.** No criterion reaches it; the CLI prints the number from the narration as it always has, and its 692 tests pass untouched.
- **The `formatCost` message, elapsed time, and the per-vendor split** — Q-0135's, and non-goals 3 and 6 here.
- **`packages/core/src/backlog/backlog.ts`'s unused `eslint-disable`**, a pre-existing warning in a file this ticket does not touch.

---

## 6. Deviations a reviewer should weigh

1. **AC-1's union member-count clause is in `packages/shared/src/events.test.ts`, not `packages/core`.** The discriminating fixture must be a real `z.discriminatedUnion`, and `packages/core` declares no zod dependency — `backlog.source.test.ts` pins that no `core` **source** file imports it, and while `coreSourceFiles()` excludes tests, importing it from a core test would still be an undeclared dependency. The union is declared in `shared` and so is the clause; `core` keeps the half a count cannot make.

2. **AC-3's `observe`-block correction is an addition, not a rewrite.** Measured, that block's sentences are all still true, and its first is one of the three AC-3 requires be byte-identical. The host sentence that actually goes false is `RunView.runId`'s. Both are asserted.

3. **`docs/04-architecture.md` was corrected, and no criterion names it.** Line 344 stated *"`runId` is `null` for a live run's whole life"* and named Q-0131 by id; the status line described Q-0129. `.claude/rules/docs-and-decisions.md` requires code and docs disagreeing to be fixed in the same change, and `docs` is in this role's paths. I took that as an obligation rather than scope creep, and I am flagging it because it is a judgement call.

4. **The §3.2 residual is measurably closed for a start made through the host**, which is stronger than the document predicted: `host.start` does not answer until the run's first pull returns, and the callback fires before the first event, so the start outcome already carries the number. What remains is the state AC-4 covers — a metadata read in flight or failed.

---

## 7. Verification

- `pnpm install --frozen-lockfile`, then `pnpm turbo run test --force --continue` — **7/7 tasks, 0 cached**, all green.
- `pnpm turbo run lint typecheck --force --continue` — **14/14 tasks**, 0 errors, 1 pre-existing warning in a file not touched here.
- `pnpm exec quorum lint` — **6/6**.
- `pnpm sweep:git-identity` — green: *"the workspace suite executed and green with no resolvable git identity"*.
- The eight mutations in §3, each red with a discriminating message and each reverted.

GO-3 (the product run by hand against a real daemon, with the transcript recorded) and GO-5 (both environment rows after the merge) are the operator's at the gate and are not claimed here.
