# Q-0120 — Scenario review (qa-red, run 3, iteration 1)

**Verdict: `revise`.**

Coverage is complete and the red phase is genuine. What stops this gate is **satisfiability**: three
failing tests cannot be turned green by any task in `tasks.yaml`, because the only possible fix to
each is an edit to a `*.test.ts` file. `harness/architecture.md:135–137` — written by hand at this
ticket's own requirements gate, discharging GO-2 — states the disposition in as many words:

> `packages/**/*.test.ts` belongs to qa-red, and every development task is told not to modify tests.
> A scenario that can only be satisfied by editing a test file is therefore unsatisfiable, and **is a
> finding for the scenario gate rather than a red test**.

All three are that case. Each is the first of the two failure modes this role checks for — *the fix
lies in a file no task owns* — so each wants an **owner**, and the owner is `write-tests` in this
iteration, not the development loop.

---

## 1. Coverage — passes

Twelve criteria, twelve covered. Every one maps to a test that is actually red.

| AC | Scenarios | Red test observed |
| --- | --- | --- |
| AC-12 | 12.1–12.7 | `test/source.test.ts`, `packages/server/src/index.test.ts:58` |
| AC-13 | 13.1–13.10 | `test/daemon-endpoints.test.ts`, `test/routes.test.ts`, `test/source.test.ts` |
| AC-14 | 14.1–14.9 | `src/frame-parser.test.ts` — 11 failures |
| AC-15 | 15.1–15.10 | `src/connection-state.test.ts` — 6 failures |
| AC-16 | 16.1–16.4 | `src/run-connection.test.ts` |
| AC-17 | 17.1–17.6 | `src/run-connection.test.ts` |
| AC-18 | 18.1–18.4 | `src/run-connection.test.ts` |
| AC-19 | 19.1–19.3 | `test/source.test.ts` |
| AC-20 | 20.1–20.5 | `src/shell.test.ts:248`, `:264` |
| AC-21 | 21.1–21.5 | `test/package.test.ts`, `packages/core/src/turbo-inputs.test.ts` |
| AC-22 | 22.1–22.3 | `test/package.test.ts:130` |
| AC-23 | 23.1–23.6 | `packages/shared/src/docs.test.ts` — 2 failures |

No criterion is uncovered. No scenario asks a development task to write a test file — the document's
own preamble states that rule and the scenarios honour it. The three defects below are in the
**tests write-tests produced**, not in the scenarios that specified them.

## 2. The red phase is assertion-shaped — passes

Measured rather than inferred, because the report does not show it (§5).

```
compile / resolve / collection errors, all three failing packages:
  apps/web        0        packages/core   0        packages/shared 0
  (Cannot find module | Failed to load url | Failed to resolve import | error TS…)

apps/web        Test Files  8 failed | 2 passed (10)
packages/core   Test Files  1 failed | 60 passed | 1 skipped (62)
packages/shared Test Files  2 failed | 11 passed (13)
```

The characteristic failure is

```
AssertionError: expected [Function] to not throw an error but 'Error: not implemented' was thrown
```

Every import resolves. Solutioning's stubs are at their final paths, declare real types, and throw —
`frame-parser.ts`, `connection-state.ts`, `daemon-endpoints.ts`, `run-connection.ts`,
`packages/shared/src/wire.ts`. `packages/shared/src/index.ts:17` carries `export * from './wire.js'`,
so `apps/web/test/package.test.ts`'s **value** import of `wireMessageSchema` resolves. This is the
ruling of *"A typed stub lives at its final path; `contracts/` holds what is not code"* (2026-09-11)
working as intended, and it is the half of this gate that is in good shape.

## 3. Blocker 1 — the lockfile assertion can never be green

`packages/shared/src/wire.test.ts:119–125`:

```ts
const scope = `@${'quorum'}/shared`;
expect(importer).toContain(`${scope}:`);        // needle: @quorum/shared:
```

The lockfile writes the key **quoted**, as pnpm always does:

```
  apps/web:
    dependencies:
      '@quorum/shared':
        specifier: workspace:*
```

Reproduced against the file: needle `'@quorum/shared:'` → **False**; `'workspace:*'` → True. The
character between `shared` and `:` is `'`, so the needle cannot match.

**This is not a missing file.** `pnpm-lock.yaml` is already in its final, correct state — the human
discharged it at the solutioning gate per GO-1 — and `red-integration-iter-1.md` records
`pnpm install --frozen-lockfile → exit 0`. So there is nothing for anyone to write.

**And no task owns it anyway.** Every task in `tasks.yaml` forbids it: `backend-wire-schema`,
`frontend-daemon-endpoints` and `frontend-dev-proxy` each say *"Do not touch … pnpm-lock.yaml"*, and
`backend-lockfile-test-input` — despite listing `pnpm-lock.yaml` under `contracts:` — says *"Own
`packages/shared/turbo.json` only. … Do not touch the lockfile itself"*. The scenario document's own
Finding 5 says the same. The only fix is one character in a test file.

**Scenario 21.3 is not at fault, and the fix is already written down in it.** It specifies *"in the
same shape `packages/server/src/package.test.ts:129–136` already asserts for its own"*, and that
precedent is correct because it omits the colon:

```ts
expect(lock).toContain('packages/server:');
expect(lock.slice(lock.indexOf('packages/server:'))).toContain('@quorum/core');   // no trailing ':'
```

The implementation departed from the precedent it cited in the one character that makes it
unsatisfiable. Drop the `:` from the needle, or match `'@quorum/shared':` including the quotes.

## 4. Blocker 2 — `turbo-inputs.test.ts` C2 and C3 consult registers, not declarations

`packages/core#test` fails six clauses. Four are satisfiable and two are not.

**Satisfiable (A, B, and the two Q-0073 clauses).** `packages/shared/turbo.json` does not declare
`../../pnpm-lock.yaml`, while `MANIFEST['@quorum/shared#test']` gained the row at
`turbo-inputs.test.ts:166` naming Q-0120 AC-21. `backend-lockfile-test-input` owns
`packages/shared/turbo.json` and exists precisely for this. Correct red — leave it.

**Not satisfiable (C2 and C3).**

```ts
// C2
derivationSites(text).filter((token) => ROOT_DERIVATIONS[file]?.[token] === undefined)
// C3
escapingLiterals(text).filter((value) => ESCAPING_LITERALS[file]?.[value] === undefined)
```

Neither clause reads a `turbo.json`. They compare the scanned corpus against two hand-audited
registers and nothing else, so declaring the input cannot move them.

`packages/shared/src/wire.test.ts` is the only file this branch adds to that corpus
(`git diff --name-status main...HEAD` over `packages/{shared,core}/src`: one `A` for `wire.ts`, one
for `wire.test.ts`). It carries two derivation tokens — `fileURLToPath` and `import.meta.url` at
`:3` and `:9` — and one escaping literal, `'../../..'`. That matches the failures exactly: C2
reports 2 items, C3 reports 1.

`write-tests` had `turbo-inputs.test.ts` open and filled **one** of the three registers it needed.
`ROOT_DERIVATIONS` and `ESCAPING_LITERALS` have no `wire.test.ts` entry. Both live in a `*.test.ts`.

Two admissible fixes, and the second is worth preferring: register the two entries with their
reasons, **or** have `wire.test.ts` reach the lockfile without deriving the root — which removes the
subject rather than excusing it.

## 5. Blocker 3 — qa-red's widened scan refuses qa-red's own fixture

`apps/web/test/routes.test.ts:188`:

```
AssertionError: a component names a path the register does not:
  expected [ 'run-connection.test.ts: /B/events' ] to strictly equal []
```

AC-13(d) asked for the route-literal corpus to be widened *"from a flat `.tsx` listing to a recursive
walk of every file under `src/`"*, closing §0.13's two blindnesses. It was widened correctly. The
consequence is that it now collects literals out of the test files that `src/` holds — which R-7 and
`test/package.test.ts:143` both record as holding them **by identity**.

`apps/web/src/run-connection.test.ts` asserts an expected URL for handle `B`, and `/B/events` is
collected as an unregistered route path.

`write-tests` knew the corpus reaches test files — `EXCEPTIONS` already carries
`shell.test.ts:/runs/run%20one`, `shell.test.ts:/nowhere/at/all` and
`shell.test.ts:/backlog/%E0%A4%A` — and then missed the one its own new file introduced. Both halves,
the literal and the register, are in `*.test.ts` files. No development task can reach either.

Register `run-connection.test.ts:/B/events`, or choose a fixture handle whose URL the register
already holds. Note the second clause at `:189` pins the register against vacuity in the other
direction, so an entry added must have a live subject.

## 6. What is sound — do not re-litigate in round 2

Stated so the next iteration spends itself on the three findings and not on re-deriving what holds:

- **Coverage is complete**, 12/12, and each scenario has a real red test behind it.
- **The stub strategy is right** and the red phase fails on assertions, not on missing symbols — 0
  compile/collection errors in all three failing packages.
- **The lockfile is correct and `--frozen-lockfile` passes.** §0.10's trap — a manifest ahead of the
  lockfile, whose install failure `prove-red` would read as proof of red — did **not** fire.
- **`wire.test.ts` importing `node:fs` is not a violation.** `packages/shared/src/index.test.ts:102`
  and `:111` scan `sharedSourceFiles()`, not every file, so the browser-safety guard is untouched and
  passed 9/9.
- **`test/package.test.ts:130` and `src/shell.test.ts:248/:264` are correct red.** The first needs
  `defaultClientConditions` in `vite.config.ts` (`frontend-dev-proxy`); the others need the panel and
  the retired sentence (`frontend-react-connection`). Both owned.
- **The two `docs.test.ts` failures are owned** by `backend-connection-docs`.

## 7. Observations

Recorded because they are true and worth keeping, and are **not claims about this change**.

- **`observation:` the red report artifact does not evidence the thing this gate must check.**
  `qa/run-3/red-report-iter-1.md` is 221 lines and carries `… 196302 characters of output omitted
  from the middle …`, which swallows the entire `@quorum/web` and `@quorum/core` output — eight of
  the twelve criteria — and its header reads *"No lines in the output looked like test results."* The
  four failing packages are named only in turbo's closing summary. This is `testReport`'s head-and-
  tail trim working as designed (12,000 bytes each end), and the design predates a seven-package
  workspace: at this size the packages that fail in the middle are exactly the ones a reviewer needs.
  I established the verdict from `.turbo/turbo-test.log` instead. Not this ticket's surface — no
  criterion names the engine — but a reviewer who trusted the artifact could neither confirm nor
  refuse §2.
- **`observation:` `backend-lockfile-test-input` lists `pnpm-lock.yaml` under `contracts:` while its
  description forbids touching it.** Harmless today, since `contracts:` is what the task reads and the
  prose is what binds, but the two read as contradicting each other and an implementer may spend a
  round deciding which wins.
- **`observation:` scenario 23.3's subject is already green.** *"the repository architecture no longer
  calls frontend inert"* passes in the red report, because `harness/architecture.md` was corrected by
  hand at the requirements gate discharging GO-2. It remains a sound permanent acceptance test under
  *"A red test is a permanent acceptance test"* (2026-08-23); it is simply not evidence of red, and
  the report should not be read as proving that half of AC-23 was implemented here.

## 8. What this iteration owes

Three edits, all in files `write-tests` owns, none in a development task's surface:

1. `packages/shared/src/wire.test.ts` — drop the trailing `:` from the lockfile needle, or match the
   quoted key. Follow the precedent scenario 21.3 already names.
2. `packages/core/src/turbo-inputs.test.ts` — add the `wire.test.ts` rows to `ROOT_DERIVATIONS` and
   `ESCAPING_LITERALS`, or remove the root derivation from `wire.test.ts` so both clauses lose their
   subject honestly.
3. `apps/web/test/routes.test.ts` — register `run-connection.test.ts:/B/events`, or rename the
   fixture handle.

Leave everything else exactly as it is. The `packages/shared/turbo.json` input remains
`backend-lockfile-test-input`'s and must stay red.
