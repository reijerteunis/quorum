– # Q-0120 — Scenario review (qa-red, run 3, iteration 3)

**Verdict: approve.** Coverage is 12/12. The suite fails on assertions and not on compile errors —
45 failing assertions across four packages, zero unresolved imports, zero transform failures. Every
failing assertion's fix lies in a production or documentation file with exactly one owner in
`tasks.yaml`. The two satisfiability blockers that reached the qa-red exhaustion gate are discharged
**by measurement rather than by document**: the rulings in `solution/errata.md` E-3(a) and E-3(b) are
implemented in the shipped test files, not only described in §0 of the scenario document.

---

## 0. The bound on this verdict, stated before anything rests on it

**The red-phase half could not be answered from the artifact this step is given.**
`qa/run-3/red-report-iter-3.md` omits **183,770 characters from its middle**, and the whole of
`@quorum/web`'s and `@quorum/core`'s output falls inside that gap. Eight of this ticket's twelve
criteria — AC-13 to AC-20 — are `apps/web`'s. What survives the trim is `@quorum/shared`,
`@quorum/server` and `@quorum/cli`; for the other two packages the artifact carries one line each,
`command (…/apps/web) … exited (1)`, which does not distinguish an assertion from a load error.

A probe that could not answer is not a negative (*"A probe that could not answer is not a negative"*,
2026-09-08), so rather than block on what I could not see, I read the untrimmed logs **the same run
wrote**, in the worktree the report names:

```
.harness/worktrees/harness__Q-0120__integration/apps/web/.turbo/turbo-test.log      (40 KB)
.harness/worktrees/harness__Q-0120__integration/packages/core/.turbo/turbo-test.log (38 KB)
```

Worktree tip `b01af53`, the merge of `harness/Q-0120/tests` into `harness/Q-0120/integration` — the
same commit the report was produced from. Everything in §2 and §3 below is read out of those two
files and out of the tree beside them, not inferred from the document under review.

---

## 1. Coverage — 12 of 12

| AC | scenarios | subject |
| --- | --- | --- |
| AC-12 | 12.1–12.7 | bounded declaration scan, the server re-export, the shared barrel, the six house rules |
| AC-13 | 13.1–13.13 | scheme derivation, four hostile handles, the object proxy target, the port default, the endpoint register, the recursive route scan, no CORS |
| AC-14 | 14.1–14.11 | eight parse cases, the invalid-count table, the already-parsed branch, never-throws |
| AC-15 | 15.1–15.11 | all nine states, plus the declared close-code precedence |
| AC-16 | 16.1–16.5 | count surfaced, zero retained, replaced not accumulated, survives retry, no ANSI |
| AC-17 | 17.1–17.6 | one socket, replacement, unmount, late callbacks, idempotent dispose, injectable constructor |
| AC-18 | 18.1–18.5 | which states offer Retry and which do not, one replacement, preservation, no auto-reconnect |
| AC-19 | 19.1–19.3 | the storage scan with its positive control, `pushState` not flagged, empty fresh snapshot |
| AC-20 | 20.1–20.5 | no socket off-route, placeholders unchanged, exactly one socket, retired sentence gone, panel fields only |
| AC-21 | 21.1–21.5 | manifest, justification register, lockfile importer, turbo input, no registration owed, resolution |
| AC-22 | 22.1–22.3 | additive condition, no build script, the compensated fact pinned |
| AC-23 | 23.1–23.6 | architecture sentence, status line, inert correction, glossary term, term lists untouched, role table |

No criterion is uncovered. **Three clauses are stronger than iteration 2's** and are worth naming,
because iteration 2's review is on record as finding coverage sound and the natural risk of a third
pass is that it trades rigour for satisfiability:

- **15.11** — a `terminal` event *followed by* a 1008 close must be `no-such-run`, not `ended`. That
  is the one transition where the declared precedence and the terminal rule disagree, and iteration 2
  did not exercise it. The shipped test carries it (`gives a 1008 refusal precedence even after a
  terminal event`).
- **17.6** — the injectable constructor asserted on its own, explicitly *not* through Q-0014's
  throwing global, with the reason stated: a throwing global proves absence and cannot drive a
  callback.
- **18.1** — the negative half. `idle`, `connecting`, `live` and `ended` must **not** offer Retry,
  which a scenario asserting only that failures do offer it cannot see.

---

## 2. The red phase is assertions, measured

**Zero compile failures anywhere.** Grepping both untrimmed logs for `Failed to load url`,
`Cannot find module`, `ERR_MODULE_NOT_FOUND` and `Transform failed` returns **0** in each. Every
failed test file loaded, transformed and ran its tests.

| package | files | tests | failing |
| --- | --- | --- | --- |
| `@quorum/web` | 7 failed, 3 passed (10) | 136 | **37** |
| `@quorum/core` | 1 failed, 60 passed, 1 skipped (62) | 1,513 | **4** |
| `@quorum/shared` | `wire.test.ts` 1 of 2, `docs.test.ts` 2 of 59 | — | **3** |
| `@quorum/server` | `index.test.ts` 1 of 129, 7 of 8 files green | — | **1** |
| `@quorum/cli`, `templates`, `compiler` | all green (628 + 1 + 1) | — | 0 |

The dominant failure shape is the one a red phase against typed stubs should produce:

```
AssertionError: expected [Function] to not throw an error but 'Error: not implemented' was thrown
 ❯ runEventsUrl       src/daemon-endpoints.ts:17:9
 ❯ runEventsPath      src/daemon-endpoints.ts:12:9
 ❯ parseFrame         src/frame-parser.ts:24:9
 ❯ reduceConnection   src/connection-state.ts:34:9
 ❯ connectionStateText src/connection-state.ts:39:9
```

The stubs resolve, typecheck and are *called*; what fails is the assertion about what they returned.
That is the distinction `scenario-review` exists to draw, and it holds.

The remainder are text and structural assertions against production files, each naming what it
expected and what the file holds:

- `expected '/**\n * The dev server and bundler co…' to contain 'defaultClientConditions'` — AC-22,
  `apps/web/vite.config.ts`.
- `expected … to contain "from './src/daemon-endpoints.js'"` — AC-13(d), the same file.
- `expected [ 'shell.tsx' ] to strictly equal []` — AC-20.4, the retired `CONNECTION_PENDING`
  sentence still in `apps/web/src/shell.tsx`.
- `expected [] to have a length of 1 but got +0` — AC-20.3, the run route constructs no socket yet.
- `expected 'Projectnot loaded…no live connection yet — Q-0120 opens one…' to contain '3'` — AC-20.5,
  the panel not rendering the accepted-event count.
- `expect(text).toMatch(/import\s+type\s+\{\s*WireMessage\s*\}\s+from…/)` at
  `packages/server/src/index.test.ts:58` — AC-12, with the whole of `packages/server/src/wire.ts`
  printed as the received value.

**Criterion → failing assertion**, so that no criterion is red for a reason that is not its own:

AC-12 → `packages/server/src/index.test.ts` · AC-13 → `apps/web/test/daemon-endpoints.test.ts`, 7 of
8 · AC-14 → `apps/web/src/frame-parser.test.ts`, 12 of 12 · AC-15 →
`apps/web/src/connection-state.test.ts`, 7 of 7 · AC-16/17/18 →
`apps/web/src/run-connection.test.ts`, 7 of 7 · AC-20 → `apps/web/src/shell.test.ts` ×2 and
`apps/web/test/source.test.ts` ×1 · AC-21 → `packages/core/src/turbo-inputs.test.ts` ×4 · AC-22 →
`apps/web/test/package.test.ts` · AC-23 → `packages/shared/src/docs.test.ts` ×2 and
`packages/shared/src/wire.test.ts` (AC-12's schema) ×1.

---

## 3. Satisfiability — the iteration-2 blockers are green by measurement

Iteration 2 blocked on three predicates whose only possible fix was an edit to a `*.test.ts` file.
All three are checked here against the shipped files rather than against §0's account of them.

**E-3(a) — the bounded declaration scan.** `apps/web/test/source.test.ts`'s
`duplicateMissedDeclarations` extracts **brace-balanced declaration bodies** — it matches
`interface`/`type … {`, walks to depth zero, and tests `type: 'missed'` against `count` *within one
body*. Its corpus is `sourceFiles()`, every file under `src/` with no filter, under a header that
says in as many words why it is not narrowed to "shipping files". The file reports **one** failure
and it is AC-20's retired sentence — so `src/run-connection.test.ts` and `src/shell.test.ts` are not
flagged, which is scenarios 12.2 and 12.3 green. The whole-file predicate is gone.

**E-3(b) — the lockfile read.** `packages/shared/src/wire.test.ts:3` is
`import { repoFile } from '../test/corpus.js';` and `:15` is `repoFile('pnpm-lock.yaml')`. No
`fileURLToPath`, no `import.meta.url` root climb. `turbo-inputs.test.ts`'s four failures name
`pnpm-lock.yaml` and nothing else — `ROOT_DERIVATIONS` and `ESCAPING_LITERALS` demand no row, which
is scenario 21.4 green and the iteration-2 blocker dissolved rather than worked around.

**The lockfile needle.** `the web importer declares shared in the lockfile` ✓ in all of iterations 2
and 3. Iteration 2's correction held.

**Every failing assertion has exactly one owner.** Checked file by file against §1's table:

| failing assertion | file the fix is in | owner |
| --- | --- | --- |
| AC-12 re-export | `packages/server/src/wire.ts` | `backend-wire-schema` |
| AC-12 schema | `packages/shared/src/wire.ts` | `backend-wire-schema` |
| AC-13 ×7 | `apps/web/src/daemon-endpoints.ts`, `apps/web/vite.config.ts` | `frontend-daemon-endpoints`, `frontend-dev-proxy` |
| AC-14 ×12 | `apps/web/src/frame-parser.ts` | `frontend-frame-parser` |
| AC-15 ×7 | `apps/web/src/connection-state.ts` | `frontend-connection-state` |
| AC-16/17/18 ×7 | `apps/web/src/run-connection.ts` | `frontend-run-connection` |
| AC-20 ×3 | `apps/web/src/shell.tsx`, `app.tsx` | `frontend-react-connection` |
| AC-21 ×4 | `packages/shared/turbo.json` | `backend-lockfile-test-input` |
| AC-22 | `apps/web/vite.config.ts` | `frontend-dev-proxy` |
| AC-23 ×2 | `docs/04-architecture.md`, `docs/GLOSSARY.md` | `backend-connection-docs` |

No row is a test file. No row is unowned. `packages/server/src/wire.ts` has an owner because GO-1
answer (ii) granted `packages/server` to `backend` at the requirements gate — the grant is
load-bearing here and the red phase is where that would have shown up as an unfixable failure if it
had not been made.

**Nothing is red that must go green by becoming false.** I checked the second unsatisfiability mode
specifically: no scenario asserts a fact true only during the red phase. The nearest candidates are
permanent negatives — the no-CORS guard, the persistence scan, the network-literal scans — which are
green now and must stay green, and each carries a positive control or a named fixture, so none is a
check without a subject.

---

## 4. What I did not verify, and what the gate still owes

- **GO-4** (the browser's real behaviour with the daemon down, which R-3 reasons about rather than
  measures), **GO-5** (the empty-store install delta), **GO-6** (a `vite build` with
  `packages/shared/dist` absent) and **GO-7** (both environment rows) are measurements against a
  running system. None is a red-phase assertion and the document is right to say so in §14.
- The four `apps/web` scenarios that assert *rendered strings* (15.9's two user-facing sentences,
  20.5's panel fields) are red today for the right reason, but what finally satisfies them is prose
  an implementer chooses. They are checkable, not specified — that is inherent and not a defect.
- I did not run anything. Every number above is read out of a log the run itself wrote, or out of the
  worktree's files.

---

## 5. Findings

Four nits and five observations, none of which contradicts the approval (*"A nit does not contradict
an approval"*, 2026-08-28; *"A finding is a claim about the change; anything else is an
observation"*, 2026-09-11). Three of the nits are the document describing an instrument **more
weakly than the instrument actually is** — which matters in one direction only: a later reader who
tightens the sentence loses nothing, and one who loosens the scan to match the sentence
reintroduces a defect this repository has already paid for.

See the findings list accompanying this review.
