# Q-0120 — Scenario review (qa-red, run 3, iteration 2)

**Verdict: `revise`.**

Both halves of what this gate is asked to check **pass**. Coverage is complete — twelve criteria,
twelve covered, each with a test that is actually red. The red phase is genuine — **0 compile,
resolve or collection errors across all four failing packages**, 46 failing assertions, every
solutioning stub at its final path.

What stops the gate is **satisfiability**, for the second iteration running. **Four failing tests
across two files cannot be turned green by any task in `tasks.yaml`**, because the only possible fix
to each is an edit to a `*.test.ts` file — and **all nine tasks** end with the clause *"Do not …
modify any `*.test.ts` file"* (verified: nine of nine). `harness/architecture.md:135–137`, written by
hand at this ticket's own requirements gate, states the disposition:

> `packages/**/*.test.ts` belongs to qa-red, and every development task is told not to modify tests.
> A scenario that can only be satisfied by editing a test file is therefore unsatisfiable, and **is a
> finding for the scenario gate rather than a red test**.

Both blockers are the first of the two failure modes this role checks for — *the fix lies in a file
no task owns* — so each wants an **owner**, and the owner is `write-tests` in this iteration.

**Two corrections to my own iteration-1 review are recorded below rather than quietly folded in.**
§4's blocker was already red in `red-report-iter-1.md` and I read it as correct red; §5's C4 clause
was already in that report and I wrote *"six clauses"* and named only C2 and C3. Both have therefore
survived a round because of this gate, not because of `write-tests`. §6 of that review told iteration
2 not to re-litigate `source.test.ts`; **that instruction is withdrawn.**

---

## 1. Coverage — passes

Twelve criteria, twelve covered. Every one maps to a test that is actually red, measured from the
untrimmed prove-red output rather than from the committed report (§8).

| AC | Scenarios | Red test observed |
| --- | --- | --- |
| AC-12 | 12.1–12.7 | `packages/shared/src/wire.test.ts`, `packages/server/src/index.test.ts:58`, `apps/web/test/source.test.ts:67` **(unsatisfiable — §4)** |
| AC-13 | 13.1–13.10 | `apps/web/test/daemon-endpoints.test.ts` — 7 failures |
| AC-14 | 14.1–14.9 | `apps/web/src/frame-parser.test.ts` — 11 failures |
| AC-15 | 15.1–15.10 | `apps/web/src/connection-state.test.ts` — 6 failures |
| AC-16 | 16.1–16.4 | `apps/web/src/run-connection.test.ts` |
| AC-17 | 17.1–17.6 | `apps/web/src/run-connection.test.ts`, `src/shell.test.ts:242` |
| AC-18 | 18.1–18.4 | `apps/web/src/run-connection.test.ts` |
| AC-19 | 19.1–19.3 | `apps/web/test/source.test.ts` — green, and correctly so (§8) |
| AC-20 | 20.1–20.5 | `apps/web/src/shell.test.ts:242`, `:251`, `test/source.test.ts:79` |
| AC-21 | 21.1–21.5 | `packages/core/src/turbo-inputs.test.ts` clauses A, B, Q-0073 ×2 |
| AC-22 | 22.1–22.3 | `apps/web/test/package.test.ts:130` |
| AC-23 | 23.1–23.6 | `packages/shared/src/docs.test.ts` — 2 failures |

No criterion is uncovered. No scenario asks a development task to write a test file — the document
states that rule in §4 and the scenarios honour it. The defects below are in the **tests
`write-tests` produced**, not in the scenarios that specified them.

## 2. The red phase is assertion-shaped — passes

Measured rather than inferred, because the committed report does not show it (§8). Over the whole
untrimmed output, the count of `Cannot find module`, `Failed to load url`, `Failed to resolve
import`, `error TS…`, `Failed to parse`, `SyntaxError`, `Unhandled Error` and `No test files found`
is **0**.

```
@quorum/shared  Test Files  2 failed | 11 passed (13)          3 failing assertions
@quorum/web     Test Files  7 failed |  3 passed (10)         35 failing assertions
@quorum/core    Test Files  1 failed | 60 passed | 1 skipped   7 failing assertions
@quorum/server  Test Files  1 failed |  7 passed (8)           1 failing assertion
```

The characteristic failure is

```
AssertionError: expected [Function] to not throw an error but 'Error: not implemented' was thrown
```

Every import resolves. `frame-parser.ts`, `connection-state.ts`, `daemon-endpoints.ts`,
`run-connection.ts` and `packages/shared/src/wire.ts` are typed stubs at their final paths;
`packages/shared/src/index.ts` carries `export * from './wire.js'`, so `apps/web`'s **value** import
of `wireMessageSchema` resolves. That is *"A typed stub lives at its final path; `contracts/` holds
what is not code"* (2026-09-11) working as intended, and it is the half of this gate in good shape.

## 3. What iteration 2 discharged — two of three, and the third made worse

Stated first so the round is credited for what it did.

| owed | outcome |
| --- | --- |
| §8.1 — the lockfile needle in `wire.test.ts` | **Fixed.** It now matches the quoted key `'@quorum/shared':`. *"the web importer declares shared in the lockfile"* passes. |
| §8.3 — `routes.test.ts` exception for `run-connection.test.ts:/B/events` | **Fixed.** `test/routes.test.ts` passes 27/27, and the anti-vacuity clause at `:189` confirms the new row has a live subject. |
| §8.2 — the `turbo-inputs.test.ts` registers | **Half fixed, and one clause newly broken.** `ROOT_DERIVATIONS` is right and C2 now passes. `ESCAPING_LITERALS` was given the wrong key, which left the real literal unregistered *and* created a stale-entry failure that did not exist before. `READ_BASES` was never touched. See §5. |

Net: `@quorum/shared` 4 → 3 failures, `@quorum/web` 36 → 35, `@quorum/core` 7 → **7**.

## 4. Blocker 1 — the AC-12 declaration scan can never be green, and it will arm against the implementer

`apps/web/test/source.test.ts:67`:

```
AssertionError: expected [ 'run-connection.test.ts', 'shell.test.ts' ] to strictly equal []
```

The instrument, at `:61`:

```ts
function duplicateMissedDeclarations(files: [string, string][]): string[] {
  return files.filter(([, text]) =>
    /(?:interface|type)\s+\w+[\s\S]*?type\s*:\s*['"]missed['"][\s\S]*?count\s*[?:]/m.test(text)
  ).map(([name]) => name);
}
```

**It is not a declaration scan.** `[\s\S]*?` spans the whole file, so the three fragments need only
*occur in that order anywhere in it*. Measured against the two files it flags:

| file | fragment 1 | fragment 2 + 3 | apart |
| --- | --- | --- | --- |
| `src/run-connection.test.ts` | `:3` — `import { createRunConnection, type SocketTransport } from './run-connection.js';` | `:42` — `JSON.stringify({ type: 'missed', count: 0 })` | 39 lines |
| `src/shell.test.ts` | `:31` — `import type { SocketTransport } from './run-connection.js';` | `:261` — `JSON.stringify({ type: 'missed', count: 2 })` | 230 lines |

Neither file declares anything. In both, fragment 1 is an **inline `type` import specifier** and
fragments 2–3 are an **object literal** in an unrelated test. That is exactly the confusion erratum
E-1 and the requirement's §0.18 exist to remove: AC-12(b) says *"the compiler owns literals; the scan
owns declarations"*, and this scan owns neither.

**Nothing can fix it.** The two flagged files are `*.test.ts`; the scanner is `*.test.ts`; all nine
tasks forbid editing a `*.test.ts`. No production edit removes either match.

**And it is worse than two false positives today.** `apps/web/src/frame-parser.ts:15` declares
`| Extract<WireMessage, { type: 'missed' }>`, and the file is currently unflagged only because no
`count:` appears *below* line 15. `frame-parser.test.ts:26` requires

```ts
expect(parseFrame({ type: 'missed', count })).toStrictEqual({ ok: false, refusal: { kind: 'invalid-count', count } });
```

so `frontend-frame-parser` must return a refusal carrying the offending count. The obvious
implementation — `return { ok: false, refusal: { kind: 'invalid-count', count: value.count } };` —
writes `count:` below line 15 and turns this guard red **on the implementer's own production file,
with the remedy outside the implementer's reach**. Only the shorthand `{ kind: 'invalid-count', count }`
escapes, and nothing tells anyone that. A guard whose verdict turns on whether a property was written
shorthand is not measuring what AC-12 names.

Scenarios **12.1** (*"it reports zero violations"*) and **12.3** (*"a `type` field or an `Extract`
reference is not a restatement"*) are both refuted by the artifact. The scenarios are right and the
instrument is wrong.

**Remedy — bound the match to one declaration body.** The subject AC-12(a) names is *a second
declaration of the union*, so the scan should walk brace-balanced `interface`/`type` bodies and
require `type: 'missed'` and `count` **inside the same one**. `packages/core/src/turbo-inputs.test.ts`
already carries the primitives for the cheaper form — `codeOnly` and `withoutImports` — and blanking
imports alone removes both of today's false positives, but it leaves the `frame-parser.ts` trap
standing, so it is the minimum rather than the answer. Whichever is chosen, show it three ways:
the inline fixture at `:68` still flags, `run-connection.test.ts` and `shell.test.ts` do not, and a
file carrying `type: 'missed'` and `count:` in **one** declaration does.

## 5. Blocker 2 — three `turbo-inputs.test.ts` clauses, in a file no task owns

`packages/core#test` fails seven clauses. **Four are correct red and owned; three are not.**

**Correct red — leave them.** Clause A, clause B and both Q-0073 clauses all report the same one
fact: `MANIFEST['@quorum/shared#test']` gained the `pnpm-lock.yaml` row at `:166` while
`packages/shared/turbo.json` does not declare `../../pnpm-lock.yaml` — confirmed by reading that
file. `backend-lockfile-test-input` owns it and exists for this. The fourth clause's hand-written
four-element expectation resolves with the same edit.

**Not satisfiable — three clauses, all consulting hand-audited registers that no `turbo.json` can
move.**

```
C3 (:2344)  unregistered: "packages/shared/src/wire.test.ts: ../../.."
C3 (:2351)  stale:        "packages/shared/src/wire.test.ts: .."
C4 (:2386)  unregistered: "packages/shared/src/wire.test.ts: ROOT"
```

`wire.test.ts:9` is `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')`. What
iteration 2 wrote, at `turbo-inputs.test.ts:1203`:

```ts
'packages/shared/src/wire.test.ts': {
  '..': 'the normalised workspace-root climb used only to read the lockfile …',
},
```

**The normalisation that key assumes does not exist.** `escapingLiterals` at `:1153` is
`scanSource(text).strings.filter(escapes)` — the verbatim literal, no normalisation — and the file's
own fixture at `:2358` says so: `expect(escapingLiterals(fixture)).toEqual(['../../docs/GLOSSARY.md'])`.
The `'..'` rows elsewhere belong to files whose literal *is* `'..'`. The scenario document's §0 item 2
asserted the convention *"e.g. `git.ts`'s `'..'` rows"* from those neighbours rather than from the
scanner, while `red-report-iter-1.md` had already printed `../../..` by name. One failure became two.

`READ_BASES` has **no** `wire.test.ts` entry at all, so C4 is untouched. It was in iteration 1's
report and my review of it said *"six clauses"* and named C2 and C3 — that miss is mine, and it is
why this clause is now two iterations old.

**Remedy — three rows, exactly.**

1. `ESCAPING_LITERALS['packages/shared/src/wire.test.ts']`: **replace** the `'..'` key with
   `'../../..'`. Replace, not add — `:2351` fails on a registered key with no live subject.
2. `READ_BASES`: add `'packages/shared/src/wire.test.ts': { ROOT: '<reason>' }`, in the shape the
   rows above it use.
3. Leave `ROOT_DERIVATIONS['packages/shared/src/wire.test.ts']` exactly as it is. It is correct and
   C2 passes.

**The alternative iteration 1 preferred — remove the root derivation from `wire.test.ts` so all
three clauses lose their subject — is still admissible and now carries a warning: all three registers
have a stale clause (`:2310`, `:2351`, `:2391`), so removing the derivation means removing the two
`ROOT_DERIVATIONS` rows in the same edit, or C2 fails the way `ESCAPING_LITERALS` just did.**

## 6. What is sound — do not re-litigate in round 3

Stated so the next iteration spends itself on §4 and §5 and not on re-deriving what holds. Everything
here was checked against the tree this round, not carried from iteration 1.

- **Coverage is complete**, 12/12, and each criterion has a real red test behind it.
- **The stub strategy is right**: 0 compile, resolve or collection errors in all four failing
  packages; `--frozen-lockfile` passes; §0.10's trap did not fire.
- **The lockfile needle and the routes exception are fixed.** Do not touch either again.
- **`packages/shared/turbo.json` must stay red.** It is `backend-lockfile-test-input`'s, and clauses
  A, B and the two Q-0073 clauses are its correct subject.
- **The three `apps/web/src` unit suites are correct, owned red** — `frame-parser.test.ts` (11),
  `connection-state.test.ts` (6), `run-connection.test.ts` (6) — driving pure functions and a fake
  transport, with no DOM, per R-6.
- **`test/daemon-endpoints.test.ts`'s seven failures are owned** by `frontend-daemon-endpoints` and
  `frontend-dev-proxy`, and its eighth test — the source-only `ws:`/`wss:`/hostname/port scan — is
  green and stays green under a `page.protocol.replace(…)` derivation (§7).
- **`test/package.test.ts:130`, `src/shell.test.ts:242/:251`, `test/source.test.ts:79`, the two
  `docs.test.ts` failures, the `wire.test.ts` schema failure and `packages/server/src/index.test.ts:58`
  are each owned** — `frontend-dev-proxy`, `frontend-react-connection`, `backend-connection-docs`,
  `backend-wire-schema` respectively.
- **`wire.test.ts` importing `node:fs` is still not a violation**; `index.test.ts` scans
  `sharedSourceFiles()` and passed 9/9.

## 7. Findings that are not blockers

- **The `ws:`/`wss:` derivation is one keystroke from arming a currently-green guard.**
  `test/daemon-endpoints.test.ts:38` forbids `/['"`]wss?:/` anywhere under `src/`, while the same file
  requires `runEventsUrl` to return `ws:` for an `http:` page and `wss:` for an `https:` one. The
  satisfiable form is `page.protocol.replace('http', 'ws')`; the natural first draft
  — `page.protocol === 'https:' ? 'wss:' : 'ws:'` — turns that guard red, and the guard is in a file
  `frontend-daemon-endpoints` may not edit. Not a blocker, because a satisfiable implementation
  exists. Worth one sentence in the contract or the task description so it does not cost a round.
- **`parseFrame`'s input contract is ambiguous between two of its own tests.**
  `frame-parser.test.ts:16` passes `JSON.stringify('text')` and expects `non-object`; `:19` passes an
  `ArrayBuffer` and expects `non-text-message`; `:26` passes a **plain object** and expects
  `invalid-count`. So a string is JSON-parsed, a binary value is refused, and any other value is
  treated as already-parsed — which the prose contract's *"After text and JSON checks, the parser
  rejects non-objects"* does not describe. Implementable, and untested for `parseFrame(42)`. It is a
  gap in the contract rather than a defect in the tests, and it will be argued in a round unless
  `contracts/Q-0120/live-connection.contract.md` says which branch a non-string non-binary takes.
- **Scenario 19.3 has no test behind it.** *"A fresh mount for the same handle starts from an empty
  snapshot"* — `run-connection.test.ts` has six tests and none asserts that a newly constructed
  controller's snapshot is `{ events: [], missedCount: null }`. AC-19 is still covered, by 19.1 and
  19.2 in `test/source.test.ts`, so this is not a coverage failure; the scenario is simply
  unimplemented and should either be written or struck rather than left reading as coverage.

## 8. Observations

Recorded because they are true and worth keeping, and are **not claims about this change**.

- **`observation:` the committed red report still does not evidence the thing this gate must check.**
  `qa/run-3/red-report-iter-2.md` carries `… 186994 characters of output omitted from the middle …`,
  which swallows the whole of `@quorum/web` and `@quorum/core` — eight of the twelve criteria — and
  its header reads *"No lines in the output looked like test results."* I established §1, §2, §4 and
  §5 from `.quorum/runs/Q-0120-3/steps/007-prove-red/output.txt` instead. This is `testReport`'s
  head-and-tail trim (12,000 bytes each end) working as designed against a seven-package workspace,
  and at this size the packages that fail in the middle are exactly the ones a reviewer needs. Raised
  identically at iteration 1 and unchanged; not this ticket's surface — no criterion names the engine.
- **`observation:` `backend-lockfile-test-input` still lists `pnpm-lock.yaml` under `contracts:`
  while its description forbids touching it.** Harmless, since `contracts:` is what the task reads,
  but the two read as contradicting each other.
- **`observation:` the prose contract's test-authoring section named one register and there are
  four.** It says *"`packages/core/src/turbo-inputs.test.ts` adds `../../pnpm-lock.yaml` to the
  hand-audited `@quorum/shared#test` read register"* and says nothing about `ROOT_DERIVATIONS`,
  `ESCAPING_LITERALS` or `READ_BASES`, each of which a new file under a scanned package earns. That
  under-specification is the proximate cause of §5 surviving two iterations. The information was in
  the red report either way, so this explains rather than excuses it.
- **`observation:` scenario 23.3's subject is already green**, `harness/architecture.md` having been
  corrected by hand at the requirements gate. It remains a sound permanent acceptance test under *"A
  red test is a permanent acceptance test"* (2026-08-23); it is simply not evidence of red. The same
  holds for AC-19's whole suite, which is a prohibition and correctly green from the start.

## 9. What this iteration owes

Four edits, all in files `write-tests` owns, none in any development task's surface:

1. `apps/web/test/source.test.ts:61` — make `duplicateMissedDeclarations` bound its match to a single
   declaration body. Demonstrate three ways: the inline fixture still flags, `run-connection.test.ts`
   and `shell.test.ts` do not, and a single declaration carrying both members does.
2. `packages/core/src/turbo-inputs.test.ts:1203` — **replace** the `'..'` key with `'../../..'`.
3. `packages/core/src/turbo-inputs.test.ts` — add `'packages/shared/src/wire.test.ts': { ROOT: … }`
   to `READ_BASES`.
4. Optional and preferred, in place of 2 and 3: remove the root derivation from `wire.test.ts`
   entirely — **and remove its two `ROOT_DERIVATIONS` rows in the same edit**, or C2's stale clause
   fails exactly as `ESCAPING_LITERALS`' just did.

Leave everything else exactly as it is. `packages/shared/turbo.json` stays
`backend-lockfile-test-input`'s and stays red.
