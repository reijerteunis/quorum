# Q-0069 — A deprecated zod API is in use, and nothing in the repository can detect one

*Requirement, 2026-08-27. Author: product-manager (claude). Stage: draft → requirements.*

---

## Problem

`packages/shared` calls `.passthrough()` 21 times. zod 4.4.3 marks that method `@deprecated` in its
own typings. The workspace's two gates — `pnpm lint` and `pnpm typecheck`, 14 tasks across 7
packages — are green over every one of those calls, and neither is lying about what it checked.
The gap is between them: `tsc --noEmit` does not error on `@deprecated` (it is an editor
strikethrough), and the one rule that would, `@typescript-eslint/no-deprecated`, needs type
information that `eslint.config.js:3` deliberately switches off with the sentence *"Type-aware
linting is deliberately off — `tsc --noEmit` owns types."* That sentence is true of types and false
of deprecation. `tsc` does not own this and never claimed to, so nobody does.

The 21 calls are a morning's work. The blind spot is the subject: they accumulated through a
landed, cross-vendor-reviewed ticket (Q-0041) without either gate having anything to say. This is
the repository's own named failure — *"a check that skips its subject must not report success"*
(`docs/DECISIONS.md`, 2026-08-25) — reached this time through a configuration comment rather than a
preflight. It is the second time this shape has cost something: Q-0065 records `turbo.json`
declaring no `passThroughEnv`, so a test that needs an environment variable can never run. Both are
a good decision with a consequence nobody enumerated, sitting in a file that reads as settled.

**Surfaces touched:** `packages/shared` (the source), the repository's own tooling
(`eslint.config.js`), `harness/rules.md` and its `.claude/rules/` copy, and `docs/`. **No CLI
surface, no flow, no ticket format and no adapter behaviour changes.**

### Evidence, re-derived rather than inherited

Every figure in the ticket body was re-checked against the tree at `f1211b1` before it entered this
document. All of them held.

| Claim | Command | Result |
| --- | --- | --- |
| 21 call sites, four files | `grep -c '\.passthrough(' packages/shared/src/*.ts` | `flow.ts` 11, `project.ts` 7, `ticket.ts` 2, `role.ts` 1 = **21** |
| A naive grep says 22 | same, including tests | `flow.test.ts:106` has the string **in a comment**, not a call |
| zod marks it deprecated | `zod/v4/classic/schemas.d.cts:460–461` | `/** @deprecated Use z.looseObject() or .loose() instead. */` |
| `.loose()` is the next thing steered away from | same file `:462–463` | `/** Consider z.looseObject(A.shape) instead */` — **no** `@deprecated` |
| `.strict()` / `.strip()` are not deprecated | same file `:464–467` | *"Consider `z.strictObject`"* / *"This is the default behavior"*, **no marker** |
| 12 `.strict()` sites exist and must be left alone | `grep -c '\.strict('` | `events.ts` 8, `flow.ts` 1, `step-output.ts` 3 |
| The rule ships and is in the `strict` preset | `@typescript-eslint/eslint-plugin@8.67.0` | `dist/rules/no-deprecated.js`; `configs/…/strict-type-checked.js:21` |
| Both gates green today | `npx eslint packages`; `tsc --noEmit` | 0 problems, 0 errors — **0.72s** and **0.55s** |
| "14/14" is 7 packages × 2 tasks | `turbo run lint typecheck --dry=json` | 14 tasks, `@quorum/web` included |
| `harness/Q-0069/integration` exists | `git branch --list` | present — the chore flow's first-pass prerequisite is already met |

**Four things the ticket body does not have, found while checking it.** Each changes a decision
below, so they are stated here rather than buried in a criterion.

1. **Every one of the 21 sites is an inline `z.object({ … })` literal.** Not one applies
   `.passthrough()` to a named schema, so no site needs `.shape` re-derived. The migration to
   `z.looseObject({ … })` is a one-token substitution per site — move the call to the front, delete
   the chain — and it is the same size as the `.loose()` diff the ticket calls minimal. Four sites
   in `project.ts` chain `.optional()` afterwards and keep it; two in `flow.ts` spread
   `...agentStepFields` and are unaffected. **This removes diff size as an argument entirely.**
2. **`sharedSourceFiles()` excludes `*.test.ts`** (`packages/shared/test/corpus.ts:94–100`). That is
   what makes the proposed source assertion possible at all — a test whose needle is the literal
   `'.passthrough('` would otherwise fail on itself — and it is also why that assertion **cannot**
   see the two surviving prose references, at `packages/shared/src/flow.test.ts:106` and
   `packages/core/src/backlog/backlog.test.ts:192`. Those need a criterion of their own.
3. **`integrate` never runs `lint`.** `harness/harness.yaml`'s `commands.test` is
   `npm test --prefix spike && pnpm turbo run test`. So the type-aware rule would be enforced by CI
   alone, and a chore ticket's `integrate` step can report green over a lint-red tree. This is the
   reason the source assertion ships **as well** — it lands in the `test` gate, which is the gate
   `integrate` actually executes. It stops being a hedge and starts being the half that the flow's
   own proof can see.
4. **The lint-cost question has a number.** Type-aware linting builds the same program `tsc` builds:
   0.55s in `shared`, 0.79s in `core`, 84 TS files across the workspace. The expected cost is about
   one extra second per package — a measurable overhead, not a category change.

---

## User stories

**`contributor` — the one this is for.** *As an open-source contributor writing a schema or an
adapter, I want the workspace's own gates to tell me when I reach for a method a dependency has
deprecated, so that I find out from `pnpm lint` in ten seconds rather than from a reviewer, a
release note, or a version bump six months from now that removes it.* Today the answer is that
nothing tells them — `harness/rules.md:11–18` says so in as many words, which is honest and is not
a substitute for a check.

**`maintainer`.** *As the solo maintainer, I want two green ticks to mean something specific about
deprecation, so I am not reading 21 deprecated calls under a passing build and calling it reviewed.*
The cost of the current state is already on the record: these landed through a cross-vendor review
that had no instrument pointed at them.

**`adopter` — explicitly unaffected.** Nothing on the cold-clone path changes. `pnpm lint` is a
contributor gate in this repository; an adopter runs `quorum` against their own repo and never sees
it. The first 30 minutes are the same length.

---

## The target form: `z.looseObject({ … })`

Decided here rather than left open, because the argument is short and the repository has already
committed to the answer.

- **`.loose()` is not the destination.** It carries *"Consider `z.looseObject(A.shape)` instead"*
  three lines below the deprecation it replaces. Migrating there buys one release of quiet and then
  this ticket again.
- **`harness/rules.md:17–18` already decides it** — *"prefer the constructor a library documents to
  the chained method it merely still accepts"* — a rule written by this ticket's own discovery and
  already committed. Choosing `.loose()` would contradict a rule in the tree.
- **The diff-size objection does not survive contact with the code.** All 21 sites are inline object
  literals (evidence item 1 above), so both options are one token per site.
- **The result type is identical.** `passthrough(): ZodObject<Shape, core.$loose>` against
  `looseObject(shape): ZodObject<util.Writeable<T>, core.$loose>` — same config parameter, so the
  inferred type, the accepted set and the rejected set are unchanged. Nothing in the workspace can
  observe the difference except the deprecation marker.

---

## Acceptance criteria

Each is independently testable from a clean clone at the change's head.

1. **Every `.passthrough()` in `packages/shared/src` is gone, replaced by `z.looseObject({ … })`.**
   All 21 sites: `flow.ts` (11), `project.ts` (7), `ticket.ts` (2), `role.ts` (1). Where a site
   chains `.optional()` — `project.ts:66, 75, 85, 90` — the `.optional()` is preserved. After the
   change, no non-test source file under `packages/` or `apps/` contains the string `.passthrough(`.

2. **Nothing a schema accepts or rejects changes, and the existing tests prove it unedited.** These
   three, which exist today and are not touched by this change, pass: `flow.test.ts`'s *"an accepted
   flow survives parsing with no key or value removed or added"*, *"unknown keys are preserved, not
   stripped, at every depth"*, and *"`route` is carried untouched, not given a shape"*. So does
   `packages/core/src/backlog/backlog.test.ts`'s *"an unknown key keeps its POSITION, not merely its
   presence"*. No test file is edited except the comment corrections in AC-9 and the new guard in
   AC-7. `pnpm test` is green across the workspace, and `npm test --prefix spike` is untouched and
   green.

3. **Inferred types are unchanged and no consumer is edited.** `pnpm typecheck` is green on all 7
   packages with no change to any `tsconfig.json`, no `.d.ts`, and no edit to
   `packages/core/src/backlog/project.ts` or any other importer of `Flow`, `FlowStep`, `Ticket`,
   `Role` or `ProjectConfig`. Each of those types keeps the index signature `$loose` gives it.

4. **`.strict()`, `.strip()` and `.catchall()` are untouched.** No line containing `.strict(`
   changes in this diff. The 12 `.strict()` sites carry no `@deprecated` marker; widening them to
   `z.strictObject()` is a legibility preference that needs its own argument, and taking a free ride
   on this one would put an unreviewed change into `events.ts` and `step-output.ts`, where the
   *"Unknown keys are refused where Quorum owns the key set"* decision lives.

5. **`@typescript-eslint/no-deprecated` is enabled with type information, and it is the only rule
   added.** Not the `strict` or `strict-type-checked` preset — those bring dozens of rules nobody
   has argued for. Type information is supplied by `parserOptions.projectService`. The rule applies
   to exactly the file set the config already covers (`packages/**/*.ts`, `apps/**/*.ts`);
   `spike/**` stays in `ignores` and nothing is added to that list. `pnpm lint` is green, 14/14.

6. **The rule is proven to fail on its subject, not merely to pass over a clean tree.** The change's
   implementation record states the rule's output over the unmigrated tree (**21 errors, every one
   `passthrough`, all under `packages/shared/src`**) and over the migrated tree (**0**), with the
   commands and refs a reviewer can re-run. A guard whose only evidence is a green run has not been
   shown to have a subject — *"skipped is not passed"* (`docs/DECISIONS.md`, 2026-08-25).

7. **A source-text assertion ships in `packages/shared`, over `sharedSourceFiles()`, and cannot fail
   on itself.** It follows the existing `.default(` / `.catch(` check in `flow.test.ts` exactly:
   iterate `sharedSourceFiles()`, fail naming the file. It must be sound with respect to its own
   text — `sharedSourceFiles()` excludes `*.test.ts` today, and if the assertion is ever moved into
   a scanned file the needle is assembled at run time, as `index.test.ts` already does for the
   workspace scope. Its purpose is stated in a comment: it is the **pin for this migration**, in the
   gate `integrate` runs, and it is not the general net — that is AC-5.

8. **The migration lands before the guard, in one change, and no commit in it is lint-red.**
   Enabling the rule over the current tree fails 21 times, so a change that enables it first cannot
   reach a green `integrate`. Verifiable by running `pnpm lint` at each commit of the change.

9. **The two comments that name the old method are corrected.** `packages/shared/src/flow.test.ts:106`
   explains union selection in terms of what *"`.passthrough()` keeps"*, and
   `packages/core/src/backlog/backlog.test.ts:192` describes *"a read through
   `ticketSchema.passthrough().parse()`"*. Both are prose about a mechanism that will be spelled
   differently, and both sit where AC-7's guard cannot see them — one is a test file, the other is
   in another package. The corrected comments say the same thing about the same mechanism.

10. **`eslint.config.js`'s header comment is rewritten, not contradicted.** It currently states a
    policy this change reverses. The replacement says which gate owns what: `tsc --noEmit` owns
    types; one type-aware ESLint rule is on, because `tsc` does not error on `@deprecated` and
    nothing else in the repository can see one. A config whose comment describes the opposite of its
    rules is worse than a config with no comment.

11. **`harness/rules.md` and `.claude/rules/engineering.md` stop saying nothing detects one.**
    `harness/rules.md:11–18` and `.claude/rules/engineering.md:4` currently end at *"Nothing here
    detects one today (Q-0069)"*, which becomes false. Both name the rule that detects it, the file
    set it covers, and the one place it does not — `spike/**` is outside ESLint's scope entirely, so
    the freeze's independent witness is unlinted and nobody should assume otherwise.
    `harness/rules.md` is canonical and the `.claude/` copy matches it, per that file's own header.

12. **The documents agree with the code in the same change.** Two edits, neither of which reverses
    anything. (a) A dated note inside *"Unknown keys are refused where Quorum owns the key set, and
    preserved where it does not"* (`docs/DECISIONS.md`, 2026-08-25), which uses `.passthrough()` as
    its vocabulary at `:1111` and `:1130`, recording that the code now spells preservation
    `z.looseObject` — the rule is about *who owns the key set*, not about a method name, and is
    untouched. (b) A new appended entry, in the required Decision / Alternatives considered / Why
    shape, for turning type-aware linting on for one rule, naming the config comment it supersedes.
    `docs/06-development-plan.md`'s Q-0069 entry is updated to reflect what shipped.

---

## Non-goals

- **`.strict()` → `z.strictObject()`, and `.strip()` → nothing.** Neither is deprecated; see AC-4.
- **`.loose()` as the target.** Argued above and rejected.
- **The `strict` or `strict-type-checked` preset, or any second type-aware rule.** One rule, argued
  for, is the whole change. A preset is dozens of rules nobody has read arriving under one flag.
- **`spike/`.** It uses no zod, it is plain Node ESM with its own tooling, and it is frozen
  (`harness/port-charter.md` §3). It is already in ESLint's `ignores` and stays there. This ticket
  is not one of Q-0009's children, so the freeze is not in its way — there is simply nothing to
  change.
- **Upgrading zod, or auditing any dependency beyond what the rule reports.** The audit that found
  this already checked Node APIs, runtime deprecation warnings and `turbo.json`'s `tasks` key, and
  found nothing else. Re-doing it by hand is what the rule is for.
- **Making `integrate` run `lint` and `typecheck`** — see OQ-1. Changing `commands.test` changes
  every ticket's `integrate` and belongs with Q-0065, not here.
- **Any new zod rule, `.default()` or `.catch()`.** Forbidden by *"Zod describes structure and
  types; the flow lint keeps the semantics"* (2026-08-25) and by the guard that already enforces it.
- **The flow linter.** `lintFlow` is untouched. The word "lint" means two different things in this
  repository and this ticket concerns only ESLint; no flow, no `harness lint` rule and no flow file
  changes.
- **Any user-visible behaviour.** No CLI output, no exit code, no file written by a run, no adapter
  invocation, no branch or worktree changes.

---

## Open questions

None is a blocker: none changes a file format, a schema's accepted set, or the adapter contract.

- **OQ-1 — Should `commands.test` also run `lint` and `typecheck`?** *(owner: Ruud, at the
  requirements gate.)* `harness/harness.yaml`'s test command runs the two suites only, so `integrate`
  — the step that blesses a chore ticket — cannot see a lint failure. The new rule would be enforced
  by CI alone. **This requirement works around it rather than fixing it** (AC-7 puts a pin in the
  `test` gate), because changing that command affects every ticket's `integrate` and is the same
  argument Q-0065 is already carrying. Worth its own ticket either way.
- **OQ-2 — Does turbo's `lint` cache invalidate when a *dependency's* typings change?** *(owner:
  implementer; resolvable inside the change.)* `lint` is a cached task, CI restores `.turbo` across
  runs, and the task's result now depends on `node_modules` rather than only on the package's own
  files. If a zod bump that deprecates something new does not invalidate the hash, CI replays a green
  lint over it — Q-0065's shape one layer down, in the guard this ticket is installing. The
  implementer states which it is; if it does not invalidate, `pnpm-lock.yaml` joins
  `globalDependencies` in `turbo.json`.
- **OQ-3 — Does `parserOptions.projectService` need `allowDefaultProject`?** *(owner: implementer.)*
  Checked today and the answer looks like no: all 7 packages carry a `tsconfig.json` extending the
  base with no `include`, so every `.ts` file the config lints is covered — including
  `apps/web/vite.config.ts` and `packages/shared/test/corpus.ts`. If a file turns out to fall
  outside, it is **named in the implementation report**, not quietly added to `ignores`.
- **OQ-4 — Is the new DECISIONS entry (AC-12b) warranted, or is the rewritten config comment
  enough?** *(owner: Ruud.)* The type-aware-off choice was recorded in a config comment rather than
  in `docs/DECISIONS.md`, so reversing it is not literally reversing an entry. The recommendation is
  to write one anyway: the durable question is *what each gate owns*, the next person to consider
  another type-aware rule needs the argument, and a config comment is not where anyone looks. The
  criterion requires the entry; the gate can strike it.

---

## Risks

- **The rule can turn `pnpm lint` red for a reason outside the change under review.** A dependency
  bump that deprecates something makes lint fail on code nobody touched. That is the point of the
  rule and it is still a real cost — mitigated by it being one rule whose message names the symbol
  and its replacement.
- **`packages/shared` is imported by every package, so a mis-migration is workspace-wide.** Mitigated
  by the substitution being mechanical (all sites inline, evidence item 1), by the type being
  provably identical, and by AC-2's existing round-trip and key-position tests being required to
  pass **unedited** — a mis-migration that also edited its own proof is the failure the port charter
  exists to prevent.
- **The source assertion catches one string.** It is a pin, not coverage; AC-7 requires the comment
  that says so, and AC-5 is the general net. If OQ-1 and OQ-2 both go the wrong way, the pin is the
  only enforcement a flow run can see.
- **`spike/` remains unlinted.** Not a regression — it is out of ESLint's scope by design — but AC-11
  requires it stated, because "the workspace detects deprecated APIs" would otherwise read as
  covering the tree the freeze depends on.
- **Six children of Q-0009 are still to land** and inherit the rule. A child that reaches for a
  deprecated API now fails `lint` instead of landing it, which is the benefit; the exposure is a
  child blocked by a deprecation it did not introduce. Small, and `packages/shared` itself is
  finished as of Q-0041, so the 21-site count is stable and will not grow underneath this change.
- **Lint gets slower.** Measured bound above: roughly one extra second per package. If the real
  figure lands materially above that, it is reported at the gate rather than absorbed.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no environment variable is read, no key appears on any path, in any test, fixture or example. `packages/shared` is already forbidden from touching `process.` by its own `index.test.ts`, and that test is untouched. |
| **Worktree safety** | n/a. No flow behaviour changes. The chore flow's implementer writes in its own worktree as it always does; nothing writes to the user's working tree. |
| **Gate behaviour** | Unchanged. One gate fact is load-bearing and is recorded rather than changed: `integrate` runs `commands.test` only, so it cannot see a lint failure — OQ-1, and the reason for AC-7. |
| **File format and its schema** | No format changes. `z.object({…}).passthrough()` and `z.looseObject({…})` both produce `core.$loose`, so every flow file, `ticket.md`, role file and `harness.yaml` in the repository and in any adopter's repo parses exactly as before, unknown keys preserved at every depth. |
| **Lint rules** | The **flow** linter (`lintFlow`, `harness lint`) is not touched — no new rule, no changed message. This ticket concerns ESLint only, and AC-10 and AC-11 are what keep the two from being confused in the documents. |
| **Cold-clone impact** | None. `pnpm lint` is a contributor gate; the adopter path is `npx quorum` and is untouched. The first 30 minutes are the same length. |

---

## Sizing note

Twelve criteria, at the size the 2026-08-22 sizing decision asks for. The work divides cleanly into
two commits in a fixed order — the 21-site migration, then the two guards and the four documents —
which is what AC-8 requires and what makes this a chore-flow ticket rather than a full-SDLC one:
there is no behaviour to write a failing test against, because the behaviour is required to be
byte-for-byte identical. `harness/Q-0069/integration` already exists, so the chore flow's
first-pass prerequisite is met and the run will not fail after paying its implementer.
