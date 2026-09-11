# Q-0120 — architecture review, run 2, iteration 4

*Reviewed 2026-09-11 against `harness/Q-0120/contracts` at `8e731d4` — 12 files, 272 insertions — the merged requirement, and `harness/architecture.md` as filled by GO-2. Every claim below was re-derived from the tree rather than from the draft.*

**Verdict: revise.** Two blockers, both in `contracts/Q-0120/live-connection.contract.md` — the file iteration 4 itself promoted to authoritative for `write-tests`. Neither requires a committed code contract to move.

---

## 0. What iteration 4 fixed, verified rather than taken from the report

Iteration 3 blocked on three things. All three are closed, and two of them were closed by measurement, which is what makes them worth recording rather than merely ticking.

**The route-literal exception model (iteration 3 blocker 2.1) is right, and the eight rows are exact.** I re-ran the scan the criterion describes — a recursive walk of `apps/web/src`, `pathLiterals`' own regex, against `ROUTES` + `redirectTo` + `RAIL`. The unregistered set is precisely:

`/project`, `/tickets` (`daemon-endpoints.ts`) · `/backlog/`, `/har`, `/runs/<handle>` (`router.ts`) · `/runs/run%20one`, `/nowhere/at/all`, `/backlog/%E0%A4%A` (`shell.test.ts`)

Eight, no more and no fewer, matching the contract's table row for row. Comments and tests stay in the corpus, the endpoint rows are checked against `DAEMON_ENDPOINTS` so the table cannot become a second endpoint register, and unused entries fail. "Measured baseline, not a frozen count" is the correct framing and it is now backed by a measurement.

**The shared schema has a real consumer, and the dependency edge it forced is correct.** `apps/web/src/frame-parser.ts:1` imports `wireMessageSchema` and `eventSchema` as **values**, so AC-12's browser reachability, AC-21's dependency and AC-22's Vite condition all have a non-vacuous subject. The staged model — non-text → JSON → non-object → unknown discriminant → `wireMessageSchema.safeParse` → `eventSchema` — keeps all six refusals distinguishable without reading Zod issue trees, which is the right answer to iteration 2's blocker 2.2.

And the new `frontend-frame-parser → backend-wire-schema` edge is not defensive: I confirmed against this workspace's zod 4.4.3 that

```
z.custom(() => { throw new Error('not implemented') }).safeParse(x)   →  THROWS
```

`safeParse` does not contain a throwing custom check. So the committed stub really would fail the parser's own task if they landed in the same wave. The architect's stated reason is true.

**Waves propagate, so the edge buys what it claims.** `packages/core/src/engine/composite.ts:201–214` merges each wave's task branches onto the ticket branch before the next wave runs, and `fanout.ts:187` tells the dependent agent its predecessors are "already merged into your base branch". The chain is mechanically sound. (Its cost is M-2 below.)

**Two smaller things also verified true.** `tsconfig.base.json` sets `strict` without `noUnusedLocals`, and `eslint.config.js` enables only three rules and no `no-unused-vars` — so `frame-parser.ts`'s value imports, unused while the body throws, break neither gate. And `packages/shared/src/wire.ts` contains no `@quorum/` literal, so `index.test.ts`'s scope scan survives the enlarged corpus.

Nine of the twelve criteria now map cleanly to an owned task. What follows is what stops QA starting today.

---

## 1. Blockers

### B-1 — AC-12's declaration scan is refused by the architect's own contracts

**Which kind:** the fix lies in files no task can safely change. Not the red-phase-only kind.

The requirement's Test (i) is *"a scan over every file under `src/` reporting any `interface` or `type` alias declaring those members"* — `type`, `event`, `count`. The committed contracts declare all three:

| file | line | declaration |
| --- | --- | --- |
| `apps/web/src/frame-parser.ts` | `:8` | `{ readonly kind: 'unknown-type'; readonly type: unknown }` |
| `apps/web/src/frame-parser.ts` | `:10` | `{ readonly kind: 'invalid-count'; readonly count: unknown }` |
| `apps/web/src/frame-parser.ts` | `:14` | `{ readonly type: 'event'; readonly event: Event }` |
| `apps/web/src/connection-state.ts` | `:17–23` | every `ConnectionAction` branch declares `type` |
| `apps/web/src/connection-state.ts` | `:19` | `{ readonly type: 'event'; readonly event: Event }` |

`contracts/Q-0120/live-connection.contract.md:73–74` assigns *"declaration duplication"* to `apps/web/test/source.test.ts` and **states no predicate**. So the scan as the requirement specifies it is red the moment it is written, and the only way to green is to change types that `frontend-run-connection` and `frontend-react-connection` are contracted against. `frame-parser.ts:14` is the sharpest case: it is literally the frame union's event branch restated with a validated payload, which is the whole point of `ParsedFrame`.

**This criterion has now been found unsatisfiable twice.** Requirement §0.18 was the first — it repaired the object-literal form because that form refused the ticket's own fixtures — and the declaration form it produced is the one the contracts violate. A qa-red agent handed "declaration duplication" and no rule will invent one, and the obvious narrowings are worse than the problem: *skip files importing `@quorum/shared`* exempts `frame-parser.ts`, the only plausible restatement site, giving a check that cannot fail.

**Remedy — freeze the predicate in the prose contract.** The discriminating shape is the union, not the member names: **no `interface` or `type` alias in `apps/web` may pair `type: 'missed'` with `count`.** That is the frame union's only unique signature, and no contract module declares it — `ParsedFrame` reaches the missed branch through `Extract<WireMessage, { type: 'missed' }>` at `:15`, a **reference rather than a restatement**, which is exactly the distinction the criterion is about and which the contract should say out loud. Shown to have a subject by a fixture that re-declares `WireMessage` in full; shown to *discriminate* by leaving `FrameRefusal` and `ConnectionAction` green, which is the clause that separates this from a scan that merely fires.

### B-2 — the authoritative qa-red map names `packages/server` zero times

Draft-iter-4 states that `contracts/Q-0120/live-connection.contract.md` is authoritative and its own section is *"a summary, not a competing copy"*. `grep -n 'packages/server'` over that contract returns **nothing**. Two consequences, and the second is an unownable red.

**(a) AC-13(e) is assigned to nobody.** The criterion requires *"a read of `packages/server/src/*.ts` and its manifest asserting neither gained the string `cors`"*, together with the retained no-export-surface assertions. Iteration 3 carried a `backend-cors-guard` task; iteration 4 correctly removed it as a test edit and the assignment was never picked up anywhere else. `packages/server/src/package.test.ts` exists and is where it belongs.

**(b) The re-export assertion is routed into a package that cannot declare the read.** Contract line 78 gives `packages/shared/src/wire.test.ts` the *"server re-export text"*. That is a read of `packages/server/src/wire.ts` from `@quorum/shared#test`:

- `packages/shared/turbo.json` declares no `../server/**` input;
- `packages/core/src/turbo-inputs.test.ts`'s `MANIFEST['@quorum/shared#test']` holds no such row, and its own comment says that map *"holds only reads that must appear as declared inputs"*;
- so `turbo-inputs.test.ts` goes red, and the only task owning `packages/shared/turbo.json` — `backend-lockfile-test-input` — is scoped by its own description to `../../pnpm-lock.yaml` alone and forbidden `packages/core/**`.

A developer agent obeying `development.yaml`'s *"If a contract is missing or contradictory, stop and say so"* stops. A red no task can clear is the thing this review exists to catch before the loop spends its budget discovering it.

It also contradicts the requirement in two places that already reasoned it out: **AC-12 Test (ii)** — *"In `packages/server`: … asserted over the file's own text"*, with the explicit rule *"each inside the package it is about"* — and **§0.14**, which gives the cache-coverage reason. And it contradicts draft-iter-4's own summary, which assigns the re-export to `packages/server/src/index.test.ts`. The contract is the copy `write-tests` reads, so the contract is the one that binds.

**Remedy.** Add two rows to the contract's file list and strike three words from a third:

- `packages/server/src/index.test.ts` — `WireMessage` is re-exported from shared, with the existing runtime `SURFACE` register unchanged.
- `packages/server/src/package.test.ts` — no CORS middleware, header or dependency in source or manifest; the six no-export-surface assertions at `:138–147` retained.
- line 78 — delete *"server re-export text"*, leaving `wire.test.ts` the schema and the lockfile importer.

---

## 2. Majors

**M-1 — `apps/web/package.json` and `pnpm-lock.yaml` have no development owner.** Both were landed at contract time, which GO-1 authorised for the lockfile and which is defensible for the happy path; I verified the lockfile edit is a correct `link:../../packages/shared` importer under `apps/web:`. But `frontend` is granted `apps/*`, so the *manifest* could have an owner and does not, and AC-21's registers are test edits that cannot correct a wrong manifest. GO-1 named this cost — *"if a later round needs that file changed, no task can change it"* — and *"need no development owner"* asserts the happy path rather than answering it. Cheapest fix: give `apps/web/package.json` to `frontend-dev-proxy`, which already imports from the package it configures, and state in the contract that a lockfile correction is a human act at a gate.

**M-2 — the chain is four waves deep, and each boundary is a warn-and-continue.** `backend-wire-schema → frontend-frame-parser → frontend-run-connection → frontend-react-connection`. Mechanically sound, as verified above — but `composite.ts:209–212` carries a preserved defect: *"a wave merge that failed warns and the run continues, so the next wave can build on a tree missing its predecessor's work."* Four boundaries are four places a silent warn produces a wave working against an absent contract. It also means the two-vendor fan-out exists **only in wave 1**; waves 2 to 4 are one claude task each, which is the parallelism §7 asked for and this shape does not deliver.

The `backend-wire-schema` edge should stay — the zod measurement above proves it is load-bearing. The three *frontend* edges are the ones to re-examine: `frontend-run-connection` is contracted against the **interfaces** of the parser and reducer, not their bodies, and drives its own code through a fake transport, so it plausibly needs no wait. Collapsing waves 2–4 where the contract already carries the interface would restore concurrency without weakening anything.

**M-3 — the barrel register is explicit, and the contract should name the symbols.** `packages/shared/src/index.test.ts`'s *"the entry point exposes every module"* is a hand-written list of eighteen symbols, not a directory walk — so the requirement's AC-12(c) claim that the barrel line is *"forced rather than remembered"* is wrong, and the contract (line 80–81) is right to say so. What is missing is the consequence: name `wireMessageSchema` as the symbol to add, and note that `WireMessage` is **type-only** and therefore cannot be asserted with `toHaveProperty`. A qa-red agent adding a type name to a runtime-property register writes an assertion that cannot pass.

---

## 3. What is right and should not move

- **`ParsedFrame`'s `Extract<WireMessage, { type: 'missed' }>`.** A reference, not a copy — the correct shape, and the key to B-1's predicate.
- **`missedCount: number | null`** with `count: 0` asserted as `0` rather than `null`. Closes the exact gap iteration 3 flagged, and the contract records the reason (`http.ts:109–111` never sends a zero) beside the test.
- **Staged validation.** The right call, and the rejected alternative — one catch-all parse — is refused with the reason that survives.
- **URL tests in `apps/web/test/daemon-endpoints.test.ts`.** Outside the `src` literal scan, and correct under `harness/architecture.md`'s boundary 4, which sends a suite that reads the repository to `test/`. The runtime-assembly rule for `http:`/`https:`/`ws:`/`wss:`/scope needles is what keeps a guard from becoming its own subject.
- **Refusing CORS, a string proxy target and a scan exemption.** Vite's `ProxyTargetUrl` object form is the right instrument, and *"adding an exemption to the scan that forbids network literals"* is the narrowing Q-0014's round 2 already paid for.
- **The `packages/shared/turbo.json` lockfile input, with the `turbo-inputs.test.ts` `MANIFEST` row assigned beside it.** Declaring the input without registering the read would have been half a fix.
- **No qa-red tasks in `tasks.yaml`.** Correct, and the reason given is the right one.

---

## 4. Criterion → owner

| AC | owner | state |
| --- | --- | --- |
| 12 | `backend-wire-schema` + qa-red scans | **B-1** (predicate), **B-2(b)** (re-export misrouted), M-3 |
| 13 | `frontend-daemon-endpoints`, `frontend-dev-proxy` | **B-2(a)** — (e) unassigned |
| 14 | `frontend-frame-parser`, `backend-wire-schema` | ✓ |
| 15 | `frontend-connection-state` | ✓ |
| 16 | `frontend-run-connection`, `frontend-react-connection` | ✓ |
| 17 | `frontend-run-connection` | ✓ |
| 18 | `frontend-run-connection`, `frontend-react-connection` | ✓ |
| 19 | `frontend-run-connection`, `frontend-react-connection` + scan | ✓ |
| 20 | `frontend-react-connection` | ✓ — `app.tsx` composes `<Shell>{children}</Shell>`, so the panel lands without touching `views.tsx` |
| 21 | landed at contract time | M-1 |
| 22 | `frontend-dev-proxy` | ✓ |
| 23 | `backend-connection-docs` | ✓ — `packages/shared/turbo.json` already declares all three documents |

---

## 5. What a revision must do

1. **B-1** — write the `type: 'missed'` + `count` pairing predicate into the prose contract, with the `Extract<…>`-is-a-reference reasoning and the discrimination clause.
2. **B-2** — add `packages/server/src/index.test.ts` and `packages/server/src/package.test.ts` to the contract's qa-red file list; strike *"server re-export text"* from line 78.
3. **M-1** — give `apps/web/package.json` an owner; state the lockfile's human-at-a-gate path.
4. **M-2** — justify or collapse the three frontend wave edges; keep the `backend-wire-schema` one.
5. **M-3** — name `wireMessageSchema` for the barrel register, and note `WireMessage` is type-only.

Nothing here asks a committed code contract to move, and nothing asks for new criteria. Five edits to the architect's own prose contract, plus one task-ownership line.

## 6. Observations

Not claims about this change, and deliberately not fixed here.

- **`observation:`** `harness/flows/review.yaml`'s `verdict` instruction is still spliced mid-sentence, as requirement §11 records. It is the flow this ticket's own `review` stage runs, and it wants a one-line fix by hand in the shipped file, its byte-shared template mirror and `docs/02-sdlc-pipeline-spec.md` §5 before Q-0120 reaches `review`.
- **`observation:`** This iteration was reached through a `retry` at the exhaustion gate authorising exactly one further traversal (`runs.log`, 20:25:58Z), so this `revise` returns to that gate. Both blockers are writable **as errata at the gate** if the human prefers that to spending the traversal — B-1 is one predicate, B-2 is two file assignments and a deletion. Recording it so the choice is made deliberately rather than by default.
- **`observation:`** The zod fact behind the new dependency edge is worth keeping beyond this ticket: a `z.custom` stub whose validator throws propagates through `safeParse`, not only `parse`. Any future typed stub that a red suite drives through `safeParse` inherits the same wave-ordering constraint, and `harness/architecture.md`'s contract-conventions section does not mention it.
