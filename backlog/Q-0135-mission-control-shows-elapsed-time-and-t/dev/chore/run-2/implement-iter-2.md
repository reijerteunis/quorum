# Q-0135 — implement report, run 2, iteration 2

*Round 2, a revision round. `review/chore/run-2/chore-iter-1.md` returned two majors and one nit.
All three are addressed below, each **shown red by mutation before it was trusted green**.*

**Verified forced in this worktree**: `pnpm install --frozen-lockfile` → *Already up to date*, then
`pnpm turbo run test lint typecheck --force --continue` → **21 of 21 tasks successful, 0 cached**,
and `pnpm exec quorum lint` → **6/6**. The web suite went from 508 tests to **510**.

---

## 1. Review finding 1 (major) — the timer guard's binding analysis

> *`apps/web/test/source.test.ts:912` — a function's captured text ends at the next nested
> `const`/`let`/`var`/`function` … The fixed five propagation passes also miss longer call chains.*

**Both halves are real, and both are closed at the analysis rather than at a fixture.**

### 1a. The extent now ends at a sibling, not at a nested binding

`bindings` computed each name's extent as *head → next head of any kind*. So
`function reload() { const path = …; fetchRun(…); }` had its body cut at `const path`: the call
after it was credited to `path`, nothing calls `path(`, and `reload` was never collected — a timer
calling `reload` passed a clause whose whole subject is that call.

Bracket depth is now computed at each head **in one pass over the module** (rather than one pass per
head, which is quadratic over a 450-line test file), and the extent ends at the next head at the
**same or shallower depth**. A nested declaration no longer terminates its own enclosure.

**The new extent contains the old one by construction, so this cannot be weaker than what it
replaces**, and that property is what lets it skip a tokeniser: both extents end at a head or at the
end of the file, and *the next head at depth ≤ 0* is at or after *the next head of any kind* —
whatever the depth walk makes of a bracket inside a string or a comment. So no per-file balance has
to hold for the clause to be sound, and the residual is the same one the docblock already stated: it
can credit a name with a sibling's code, which over-collects and never under-collects.

### 1b. The propagation is a fixpoint

`for (let pass = 0; pass < 5; …)` became `for (;;)` with the existing no-change break. Each round
adds a name or is the last, and the set is bounded by the module's bindings, so it terminates in at
most `bound.length` rounds and follows a chain of any length.

**The cap bit in the order a reader actually writes a chain** — caller above callee — which costs a
round per hop, because the inner loop only propagates forward through the binding list.

### 1c. The two fixtures the finding asked for

Both are in the existing clause, beside the four that were there:

| Fixture | What it stages |
| --- | --- |
| `nested` | a helper declaring a local of its own, called from a timer — the form every reader in this app is written in |
| `chain` | **seven hops**, declared caller-first, so it needs **eight** rounds |

Each is asserted twice: once against `requestingNames` by value, so the walk's own output is the
subject, and once through `pollers`, so the clause is.

### 1d. One hardening inside the helper, stated rather than slipped in

`asNeedle` escapes `$` before interpolating a bound name into a pattern. `$` is legal in an
identifier and means end-of-input in a regex, so `\bfoo$bar[ \t]*\(` matches nothing — the same
silent-miss class the finding is about. No such identifier exists under `apps/web/src`; this is
hardening inside the function I was replacing, not a defect closed.

---

## 2. Review finding 2 (major) — a vendor in the run with no roll-up row

> *`CostRegion` only knows the history roll-up and emits the absent-vendor sentence when the entire
> roll-up is empty … The second vendor is therefore blank.*

**Correct, and it is the case AC-16 names as its own**: *"a vendor in the run but absent from the
roll-up, having finished no billed step — which is not the same claim as unpriced."* Round 1
answered it only where **every** vendor was absent, which is the state a reader least often sees.

### What shipped

* **`mission-control-model.ts` exports `vendorOf`.** `spawn` and `retry` are the two events carrying
  a vendor label, and that is written down once — so a third label-carrying event is a change there
  rather than a second register free to go on naming two.
* **`observedVendors(events)`** — the distinct labels this browser has seen, in first-appearance
  order. Its docblock states what bounds it: the event tail is bounded and head-evicting and a late
  joiner is replayed only what the daemon retained, **so it is a lower bound and never a roster**.
  What is rendered from it is a positive claim about a vendor that *was* observed, and never a claim
  about one that was not.
* **`absentVendors(history, events)`** — the observed vendors the roll-up has no row for. A row
  exists only once a billed occurrence has **finished** (`VendorRollup.step_count` is documented
  *"Never zero — a row without one is absent"*), so this is a third claim beside *priced* and
  *unpriced*.
* **`absentVendorText(vendor)`** in the copy contract, and a `data-vendor-absent` line per vendor in
  `CostRegion`, rendered in its own `<ul>` beneath the rows.

### Two judgements inside it

**The list is separate from `[data-vendor-row]`, deliberately.** An absence is not a cost row, and
AC-13's clause counts rows — folding the two together would have made *"a third entry was composed"*
a check with a shifting subject.

**The general sentence gives way to the specific one.** `NO_ROLLUP_ROWS_TEXT` now renders only when
there is nothing else to say — an empty roll-up with no vendor observed, which is the state before
any `spawn`, or a run whose events this browser was never sent. A reader is never shown both a
statement that the roll-up names none and a list of the ones it does not name.

**What is passed in is the snapshot, not a computed set.** The review named the observed set;
`MeasuredRegion` already holds the snapshot, so the reduction happens in the pure module beside the
rule that consumes it — one fewer prop to keep in step, and the head-evicting caveat sits next to the
reduction it bounds.

---

## 3. Review finding 3 (nit) — the dry sentence

> *adds "Nothing was spent either," although AC-16 deliberately requires the absence to be explained
> by nothing having been recorded.*

Accepted and removed. AC-16 contrasts the two in as many words, and the distinction holds up: *what a
walk spent* and *what a walk wrote* are claims about different subjects, and only the second is why
this screen has no figures. The docblock now records why the clause went rather than leaving the
deletion unexplained, and the rule is pinned — the dry case's rendered text is asserted not to match
`\bspent\b`, which is what stops the sentence drifting back.

---

## 4. File by file

| File | What changed |
| --- | --- |
| `apps/web/test/source.test.ts` | `bindings` depth-aware extent, in one pass; `requestingNames` a fixpoint; `asNeedle`; the `nested` and `chain` fixtures; `absentVendorText` added to the copy-import register |
| `apps/web/src/mission-control-model.ts` | `vendorOf` exported, with the reason |
| `apps/web/src/mission-control-measures.ts` | `observedVendors`, `absentVendors`; imports `vendorOf` and `Event`; the `dry` member's docblock |
| `apps/web/src/mission-control-text.ts` | `MEASURED_DRY_TEXT` loses the spent clause; `NO_ROLLUP_ROWS_TEXT`'s docblock narrows to the general case; `absentVendorText` added |
| `apps/web/src/mission-control-status.tsx` | `CostRegion` takes the snapshot and renders the absences; the general sentence is conditional on there being nothing else |
| `apps/web/src/mission-control-measures.test.ts` | the observed/absent reduction by value, including the one-row-then-two-row transition and what it must not claim |
| `apps/web/src/mission-control-status.test.ts` | the DOM transition; the `\bspent\b` clause; `absentVendorText` in the distinctness register |

---

## 5. Mutations run, rather than a green suite read

| Mutation | What went red |
| --- | --- |
| the extent back to *next head of any kind* | *a helper that declares a local of its own is not collected: expected `[ 'path' ]` to include `'reload'`* — the finding's own mechanism, reproduced verbatim |
| the propagation back to five passes | *the walk stopped short of the end of the chain: expected `[ 'h0', 'h1', 'h2', 'h3', 'h4' ]` to strictly equal `[ …, 'h7' ]`* |
| `absentVendors` back to an emptiness check | 2 tests — *a vendor seen running with no row of its own was not named* (by value) and *…was rendered as nothing* (DOM) |
| `MEASURED_DRY_TEXT` back to the spent clause | *the dry sentence explains the absence by what was spent rather than by what was recorded* |

---

## 6. What I deliberately left alone

* **`messageAliases` (`source.test.ts:167`) has the same capped loop**, and its own docblock says
  *"to a fixpoint"*. It is a **Q-0131** clause with a different subject that neither a criterion nor
  this review names, so it is **reported and not fixed** — changing what a shipped clause collects is
  not this round's work. Latent: the corpus aliases a message exactly once.
* **The four existing timer fixtures** — unchanged and still passing, so the two new ones are added
  coverage rather than a replacement.
* **`[data-mission-control-header]`'s assertion** (AC-14) — byte-identical, still green.
* **`vendorCostRows`, the roll-up's order, the no-sum rule, `RequestState` at five,
  `MISSION_CONTROL_DISCLOSURES` at five** — untouched.
* **`repo.max_diff_bytes`, `argv.ts`, `packages/core`, `packages/server`, `packages/shared`,
  `docs/`** — nothing in this round's findings reaches them, and this diff touches none of them.

## 7. Residuals, stated rather than left to be found

1. **The observed-vendor set is a lower bound**, because the browser's event tail is bounded and
   head-evicting. Stated in both docblocks and asserted: an empty stream reports no absence, which is
   silence about the run rather than a claim that it has none.
2. **Round 1's three residuals stand** and are not re-litigated: `unpriced_steps` is disclosed
   wherever it is non-zero (AC-13's literal wording), so a fully unpriced row carries two
   complementary sentences; `unreadable-start` is a seventh state AC-16 does not enumerate, named in
   prose rather than rendered as `NaN`; and AC-17's sentence clause stays scoped to the three
   mission-control renderers.
3. **GO-4 and GO-5 are the gate's.** Neither can be discharged from an implement step — one needs the
   review prompt this round produces, the other a browser and a running daemon.
4. `pnpm turbo run lint` reports **one pre-existing warning** in `packages/core`, which this diff does
   not touch. Reported, not fixed.

## 8. Verification, in full

```
pnpm install --frozen-lockfile        → Already up to date
pnpm turbo run test lint typecheck --force --continue
                                      → Tasks: 21 successful, 21 total   Cached: 0 cached, 21 total
   @quorum/shared   279 passed        @quorum/web      510 passed
   @quorum/core    1598 passed (2 skipped)             @quorum/server   242 passed
   @quorum/cli      692 passed        @quorum/compiler / @quorum/templates  1 each
pnpm exec quorum lint                 → 6/6
```

No decision entry is owed. No criterion or finding named a surface this flow cannot write: every file
above is under `apps/`, and `contracts/` — which is outside this role's roots — is untouched, its
note having been written by hand at the gate (`ccbcc2b`).
