# Q-0069 — A deprecated zod API is in use, and nothing in the repository can detect one

*Merged requirement, 2026-08-27. Judged and merged by `head-of-product` from candidate-claude and
candidate-codex. Stage: draft → requirements.*

---

## Problem

`packages/shared` calls `.passthrough()` 21 times. zod 4.4.3 marks that method `@deprecated` in its
own typings. The workspace's two gates — `pnpm lint` and `pnpm typecheck`, 14 tasks across 7
packages — are green over every one of those calls, and neither is lying about what it checked.

The gap is between them. `tsc --noEmit` does not error on `@deprecated`; it is an editor
strikethrough and nothing more. The one rule that would catch it, `@typescript-eslint/no-deprecated`,
requires type information, and `eslint.config.js:3` deliberately switches that off with the sentence
*"Type-aware linting is deliberately off — `tsc --noEmit` owns types."* That sentence is true of
types and false of deprecation. `tsc` does not own this and never claimed to, so nobody does.

The 21 calls are a morning's work. The blind spot is the subject: they accumulated through a landed,
cross-vendor-reviewed ticket without either gate having anything to say. This is the repository's own
named failure — *"a check that skips its subject must not report success"* (`docs/DECISIONS.md`,
2026-08-25) — reached through a configuration comment rather than a preflight. It is the second time
this shape has cost something: Q-0065 records `turbo.json` declaring no `passThroughEnv`, so a test
that needs an environment variable can never run. Both are a good decision with a consequence nobody
enumerated, sitting in a file that reads as settled.

**Surfaces touched:** `packages/shared/src` (the source), the repository's own tooling
(`eslint.config.js`), the rules files (`harness/rules.md` and its `.claude/` copy), and `docs/`. No
CLI surface, no flow, no ticket format, no adapter behaviour and no user-visible output changes.

**No criterion below names `backlog/`.** Every surface this ticket touches is writable by a chore
flow's implementer, per *"A requirement may not name a surface its flow cannot write"* (2026-08-25).

### Evidence, re-derived at the gate rather than inherited

Every figure both candidates carried was re-checked against the tree at `f1211b1` before it entered
this document, per *"verify inherited measurements"*. All of them held; two are sharpened.

| Claim | How checked | Result |
| --- | --- | --- |
| 21 call sites, four files | `grep -c '\.passthrough(' packages/shared/src/*.ts` | `flow.ts` 11, `project.ts` 7, `ticket.ts` 2, `role.ts` 1 = **21** |
| A workspace-wide grep says 23, not 22 | same over `packages/` and `apps/` | 21 calls **plus two prose references**, in `packages/shared/src/flow.test.ts:106` and `packages/core/src/backlog/backlog.test.ts:192` — candidate-claude found one of the two |
| zod marks it deprecated | `zod@4.4.3/v4/classic/schemas.d.cts:460–461` | `/** @deprecated Use z.looseObject() or .loose() instead. */` |
| `.loose()` is the next thing steered away from | same file `:462–463` | `/** Consider z.looseObject(A.shape) instead */` — **no** `@deprecated` |
| `.strict()` / `.strip()` are not deprecated | same file `:464–467` | *"Consider `z.strictObject(A.shape)`"* / *"This is the default behavior"*, **no marker** |
| 12 `.strict()` sites exist and are out of scope | `grep -c` over non-test src | `events.ts` 8, `step-output.ts` 3, `flow.ts` 1 = **12** |
| The rule ships and needs type info | `typescript-eslint@8.67.0` in root `devDependencies` | present; the rule is `requiresTypeChecking` and sits in that project's `strict` preset |
| Type-aware linting is off by decision | `eslint.config.js:1–4`, `:13–14` | header comment as quoted; `languageOptions.parser` only, no `parserOptions` |
| 14 tasks = 7 packages × 2 | `ls packages/*/ apps/*/`, `find … tsconfig.json` | 6 packages + `apps/web`, each with a `tsconfig.json` |
| `sharedSourceFiles()` excludes tests | `packages/shared/test/corpus.ts:94–99` | `.filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))`, flat read of `src` |
| The source-check precedent exists | `packages/shared/src/flow.test.ts:342–347` | *"no field in the package carries a zod default or a swallowed error"*, iterating `sharedSourceFiles()` |
| A run-time-assembled needle is precedented | `packages/shared/src/index.test.ts:9, 35` | *"assembled rather than written, so the grep below can cover EVERY file"* |
| `integrate` cannot see a lint failure | `harness/harness.yaml`, `commands.test` | `npm test --prefix spike && pnpm turbo run test` — **two suites, no lint, no typecheck** |
| `harness/Q-0069/integration` exists | `git branch --list` | present; the chore flow's first-pass prerequisite is met |
| The rules file states the gap in prose | `harness/rules.md:11–18` | *"**Nothing here detects one today** (Q-0069)"* — becomes false with this change |

**Three findings that change a decision below**, so they are stated here rather than buried.

1. **Every one of the 21 sites is an inline `z.object({ … })` literal.** No site applies
   `.passthrough()` to a named schema, so no site needs `.shape` re-derived. Four sites in
   `project.ts` chain `.optional()` afterwards and keep it. The migration is therefore one token per
   site either way, which **removes diff size as an argument** between `.loose()` and
   `z.looseObject()`.
2. **`turbo.json`'s `globalDependencies` already lists `eslint.config.js`** but not
   `pnpm-lock.yaml`, and the `lint` task declares no `inputs`. So this change's own config edit will
   invalidate the lint cache, and a *future* dependency bump that deprecates a new symbol may not.
   That is OQ-2, and it is the guard's own version of Q-0065.
3. **`integrate` runs neither `lint` nor `typecheck`.** The type-aware rule will be enforced by CI
   alone. This is why the source assertion ships **as well** rather than instead: it lands in the
   `test` gate, which is the gate a chore run's `integrate` actually executes. It stops being a
   hedge and becomes the half the flow's own proof can see.

---

## User stories

**`contributor` — the one this is for.** *As an open-source contributor writing a schema or an
adapter, I want the workspace's own gates to tell me when I reach for a method a dependency has
deprecated, so that I find out from `pnpm lint` in ten seconds rather than from a reviewer, a release
note, or a version bump six months from now that removes it.* Today `harness/rules.md:11–18` answers
that nothing tells them — honest, and not a substitute for a check.

**`maintainer`.** *As the solo maintainer, I want two green ticks to mean something specific about
deprecation, so I am not reading 21 deprecated calls under a passing build and calling it reviewed.*

**`adopter` — explicitly unaffected.** Nothing on the cold-clone path changes. `pnpm lint` is a
contributor gate in this repository; an adopter runs `quorum` against their own repo and never sees
it. The first 30 minutes are the same length.

---

## The target form: `z.looseObject({ … })`

Both candidates chose it and both arguments survive. Decided here rather than left open:

- **`.loose()` is not the destination.** It carries *"Consider `z.looseObject(A.shape)` instead"*
  three lines below the deprecation it replaces. Migrating there buys one release of quiet and then
  this ticket again.
- **`harness/rules.md:17–18` already decides it** — *"prefer the constructor a library documents to
  the chained method it merely still accepts"* — a rule written by this ticket's own discovery and
  already committed. `.loose()` would contradict a rule in the tree.
- **The diff-size objection does not survive contact with the code.** All 21 sites are inline object
  literals (evidence item 1), so both options are one token per site.
- **The result type is identical.** `passthrough(): ZodObject<Shape, core.$loose>` against
  `looseObject(shape): ZodObject<util.Writeable<T>, core.$loose>` — the same config parameter, so the
  inferred type, the accepted set and the rejected set are unchanged. Nothing in the workspace can
  observe the difference except the deprecation marker.

---

## Acceptance criteria

Each is independently testable from a clean clone at the change's head.

1. **Every `.passthrough()` in `packages/shared/src` is gone, replaced by `z.looseObject({ … })`,
   and not by `.loose()`.** All 21 sites: `flow.ts` (11), `project.ts` (7), `ticket.ts` (2),
   `role.ts` (1). Where a site chains `.optional()` — four in `project.ts` — the `.optional()` is
   preserved. After the change no non-test source file under `packages/` or `apps/` contains the
   string `.passthrough(`.

2. **Nothing a schema accepts or rejects changes, and the existing tests prove it unedited.** These
   four, which exist today, pass with no edit: `flow.test.ts`'s *"an accepted flow survives parsing
   with no key or value removed or added"*, *"unknown keys are preserved, not stripped, at every
   depth"* and *"`route` is carried untouched, not given a shape"*, and
   `packages/core/src/backlog/backlog.test.ts`'s *"an unknown key keeps its POSITION, not merely its
   presence"*. No test file is edited except the comment corrections in AC-10 and the new guard in
   AC-7. `pnpm test` is green across the workspace and `npm test --prefix spike` is untouched and
   green.

3. **Inferred types are unchanged and no consumer is edited.** `pnpm typecheck` is green on all 7
   packages with no change to any `tsconfig.json`, no `.d.ts`, and no edit to any importer of
   `Flow`, `FlowStep`, `Ticket`, `Role` or `ProjectConfig`. Each of those types keeps the index
   signature `$loose` gives it.

4. **`.strict()`, `.strip()` and `.catchall()` are untouched.** No line containing `.strict(`
   changes in this diff. The 12 `.strict()` sites carry no `@deprecated` marker; widening them to
   `z.strictObject()` is a legibility preference needing its own argument, and a free ride on this
   one would put an unreviewed change into `events.ts` and `step-output.ts`, where the *"Unknown keys
   are refused where Quorum owns the key set"* decision lives.

5. **`@typescript-eslint/no-deprecated` is enabled at error severity with type information, it is
   the only rule added, and the linted file set does not narrow.** Type information comes from
   `parserOptions.projectService` or the supported equivalent for `typescript-eslint@8.67.0`. Not the
   `strict` or `strict-type-checked` preset — those are dozens of rules nobody has argued for. The
   rule applies to exactly the file set the config already covers (`packages/**/*.ts`,
   `apps/**/*.ts`); **nothing is added to `ignores`**, and `spike/**` stays there as it already is.
   If a file cannot be resolved by `projectService`, it is **named at the gate with the override it
   needs** — never removed from lint coverage, because a file dropped to make the guard install is
   the same blind spot arriving through the fix. `pnpm lint` is green, 14/14.

6. **The rule is demonstrated to fail on its subject, not merely to pass over a clean tree.** The
   implementation record states the rule's output over the *unmigrated* tree — **21 errors, every one
   `passthrough`, all under `packages/shared/src`** — and over the migrated tree (**0**), with the
   exact commands a reviewer can re-run from the change's head, e.g. restoring `packages/shared/src`
   from the base ref, running ESLint, and restoring it again. Nothing deprecated is committed to
   produce this evidence. A guard whose only evidence is a green run has not been shown to have a
   subject — *"skipped is not passed"* (`docs/DECISIONS.md`, 2026-08-25).

7. **A source-text assertion ships in `packages/shared`, over `sharedSourceFiles()`, and cannot fail
   on itself.** It follows the existing `.default(` / `.catch(` check at `flow.test.ts:342–347`
   exactly: iterate `sharedSourceFiles()`, fail naming the file. It must be sound with respect to its
   own text — `sharedSourceFiles()` excludes `*.test.ts` today, and if the assertion is ever moved
   into a scanned file the needle is assembled at run time, as `index.test.ts:9, 35` already does for
   the workspace scope. A comment states its purpose: it is the **pin for this migration**, in the
   gate `integrate` runs, and it is not the general net — that is AC-5.

8. **The migration lands before the guard, in one change, and no commit in it is lint-red.**
   Enabling the rule over the current tree fails 21 times, so a change that enables it first cannot
   reach a green `integrate`. Verifiable by running `pnpm lint` at each commit of the change.

9. **Every gate is proven green without a cached result.** `pnpm lint`, `pnpm typecheck` and
   `pnpm test` are each run with Turbo's cache defeated (`--force`) and the output recorded, in
   addition to `npm test --prefix spike`. *"Turbo cache replays green"* (Q-0065) is live in this
   repository, and a guard whose installation was blessed by a replay has not been installed.

10. **The two prose references to the old method are corrected.**
    `packages/shared/src/flow.test.ts:106` explains union selection in terms of what
    *"`.passthrough()` keeps"*, and `packages/core/src/backlog/backlog.test.ts:192` describes *"a
    read through `ticketSchema.passthrough().parse()`"*. Both are prose about a mechanism that will
    be spelled differently, and both sit where AC-7's guard cannot see them — one is a test file, the
    other is in another package. The corrected comments say the same thing about the same mechanism.

11. **The config header and the rules files stop describing a policy that no longer holds.**
    (a) `eslint.config.js:1–4` is **rewritten, not contradicted**: it says which gate owns what —
    `tsc --noEmit` owns types; one type-aware ESLint rule is on, because `tsc` does not error on
    `@deprecated` and nothing else in the repository can see one. A config whose comment describes
    the opposite of its rules is worse than a config with no comment. (b) `harness/rules.md:11–18`
    and `.claude/rules/engineering.md:4` currently end at *"nothing here detects one today"*, which
    becomes false; both name the rule that detects it, the file set it covers, and the one place it
    does not — **`spike/**` is outside ESLint's scope entirely, so the freeze's independent witness
    stays unlinted and nobody should assume otherwise.** `harness/rules.md` is canonical and the
    `.claude/` copy matches it, per that file's own header.

12. **The documents agree with the code in the same change.** Three edits, none of which reverses
    anything. (a) A dated note inside *"Unknown keys are refused where Quorum owns the key set, and
    preserved where it does not"* (`docs/DECISIONS.md`, 2026-08-25), which uses `.passthrough()` as
    its vocabulary throughout, recording that the code now spells preservation `z.looseObject` — the
    rule is about *who owns the key set*, not about a method name, and its historical text is not
    rewritten. (b) A **new appended entry**, in the required Decision / Alternatives considered / Why
    shape, for turning type-aware linting on for exactly one rule — naming the config comment it
    supersedes and stating what each gate owns. (c) `docs/06-development-plan.md`'s Q-0069 line
    updated to what shipped.

---

## Non-goals

- **`.strict()` → `z.strictObject()`, and `.strip()` → nothing.** Neither is deprecated; see AC-4.
- **`.loose()` as the target,** as an intermediate or as the destination. Argued above and rejected.
- **The `strict` or `strict-type-checked` preset, or any second type-aware rule.** One rule, argued
  for, is the whole change. A preset is dozens of rules nobody has read arriving under one flag.
- **`spike/`.** It uses no zod, it is plain Node ESM with its own tooling, it is frozen
  (`harness/port-charter.md` §3), and it is already in ESLint's `ignores`. This ticket is not one of
  Q-0009's children, so the freeze is not in its way — there is simply nothing there to change.
- **Making `integrate` run `lint` and `typecheck`** — OQ-1. Changing `commands.test` changes every
  ticket's `integrate` and is the argument Q-0065 already carries.
- **Upgrading zod, TypeScript, ESLint or typescript-eslint; adding any dependency; auditing
  anything beyond what the rule reports.** The audit that found this already checked Node APIs,
  runtime deprecation warnings and `turbo.json`'s `tasks` key and found nothing else. Re-doing that
  by hand is what the rule is for.
- **Any new zod rule, `.default()` or `.catch()`.** Forbidden by *"Zod describes structure and types;
  the flow lint keeps the semantics"* (2026-08-25) and by the guard that already enforces it.
- **The flow linter.** `lintFlow` is untouched — no new rule, no changed message, no flow file
  edited. "Lint" means two things in this repository; this ticket concerns ESLint only.
- **Any user-visible behaviour.** No CLI output, no exit code, no file written by a run, no adapter
  invocation, no branch or worktree change, no persistent format change.
- **Fixing lint findings other than the deprecated-symbol findings this change creates.**

---

## Open questions

None blocks solutioning: none changes a file format, a schema's accepted set, or the adapter
contract. Candidate-codex's OQ-1 was conditionally blocking; it is **converted into AC-5's binding
constraint** — the file set may not narrow — which removes the condition.

- **OQ-1 — Should `commands.test` also run `lint` and `typecheck`?** *(owner: Ruud, at the gate.)*
  `harness/harness.yaml`'s test command runs the two suites only, so `integrate` — the step that
  blesses a chore ticket — cannot see a lint failure, and the new rule is enforced by CI alone. **This
  requirement works around it rather than fixing it** (AC-7 puts a pin in the `test` gate), because
  changing that command affects every ticket's `integrate` and is Q-0065's argument. Worth its own
  ticket either way.
- **OQ-2 — Does Turbo's `lint` cache invalidate when a *dependency's* typings change?** *(owner:
  implementer; resolvable inside the change.)* `globalDependencies` lists `eslint.config.js` but not
  `pnpm-lock.yaml`, and `lint` declares no `inputs`, so the task's result now depends on
  `node_modules` rather than only on the package's own files. If a zod bump that deprecates something
  new does not invalidate the hash, CI replays a green lint over it — Q-0065's shape inside the guard
  this ticket installs. The implementer states which it is; if it does not invalidate,
  `pnpm-lock.yaml` joins `globalDependencies`.
- **OQ-3 — Does `parserOptions.projectService` need `allowDefaultProject`?** *(owner: implementer.)*
  All 7 packages carry a `tsconfig.json` extending the base, so the answer looks like no. If a file
  falls outside, AC-5 governs: name it and the override it needs, never remove it from coverage.
- **Settled here, not left open:** whether a new `docs/DECISIONS.md` entry is warranted. It is —
  AC-12b. The candidates disagreed; the ruling and its reasoning are in Provenance below.

---

## Risks

- **The rule can turn `pnpm lint` red for a reason outside the change under review.** A dependency
  bump that deprecates something makes lint fail on code nobody touched. That is the point of the
  rule and it is still a real cost — mitigated by it being one rule whose message names the symbol
  and its replacement, and by `harness/rules.md`'s standing instruction that such a migration is its
  own change rather than a passing fix.
- **`packages/shared` is imported by every package, so a mis-migration is workspace-wide.** Mitigated
  by the substitution being mechanical (all sites inline), by the type being provably identical, and
  by AC-2 requiring the round-trip and key-position tests to pass **unedited** — a mis-migration that
  also edited its own proof is the failure the port charter exists to prevent.
- **The source assertion catches one string.** It is a pin, not coverage; AC-7 requires the comment
  that says so and AC-5 is the general net. If OQ-1 and OQ-2 both go the wrong way, the pin is the
  only enforcement a flow run can see.
- **`spike/` remains unlinted.** Not a regression — it is out of scope by design — but AC-11 requires
  it stated, because "the workspace detects deprecated APIs" would otherwise read as covering the
  tree the freeze depends on.
- **Lint gets slower.** Type-aware parsing builds the program `tsc` already builds — roughly one
  extra second per package across 84 TS files. Measured on a `--force` run and reported at the gate
  rather than absorbed; if it lands materially above that, a separate type-aware lint command is
  Ruud's call.
- **Six children of Q-0009 are still to land** and inherit the rule. A child that reaches for a
  deprecated API now fails `lint` instead of landing it, which is the benefit; the exposure is a
  child blocked by a deprecation it did not introduce. Small, and `packages/shared` is finished as of
  Q-0041, so the 21-site count is stable and will not grow underneath this change.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no environment variable is read, no key appears on any path, in any test, fixture or example. `packages/shared` is already forbidden from touching `process.` by its own `index.test.ts`, and that test is untouched. |
| **Worktree safety** | n/a. No flow behaviour changes. The chore flow's implementer writes in its own worktree as always; nothing writes to the user's working tree. |
| **Gate behaviour** | Unchanged. One gate fact is load-bearing and is recorded rather than changed: `integrate` runs `commands.test` only, so it cannot see a lint failure — OQ-1, and the reason for AC-7. |
| **File format and its schema** | No format changes. `z.object({…}).passthrough()` and `z.looseObject({…})` both produce `core.$loose`, so every flow file, `ticket.md`, role file and `harness.yaml` in this repository and in any adopter's parses exactly as before, unknown keys preserved at every depth. |
| **Lint** | The **flow** linter (`lintFlow`, `harness lint`) is not touched. This ticket concerns ESLint only; AC-11 and the non-goals are what keep the two from being confused in the documents. |
| **Cross-vendor rule** | n/a. No reviewing or judging step changes. |
| **Product agnosticism** | No product-specific behaviour, name or example is added. |
| **Cold-clone impact** | None. `pnpm lint` is a contributor gate; the adopter path is `npx quorum` and is untouched. The first 30 minutes are the same length. |

---

## Provenance

**Candidate-claude supplied the shape of this document** — the evidence table, the argument for
`z.looseObject()`, the observation that all 21 sites are inline literals (which retires diff size as
an argument), the finding that `integrate` never runs lint (which turns the source assertion from a
hedge into the half the flow can see), the two prose comments at `flow.test.ts:106` and
`backlog.test.ts:192`, the rules-file criterion, and the constraint that the source assertion must be
sound with respect to its own text.

**Candidate-codex supplied three things the other missed.** Its AC-15 — *no cached result required
for success* — is AC-9 here, and it is the sharpest contribution in either document: this repository
has already been shown a green Turbo replay of a suite it never ran, and a guard installed under a
replay has not been installed. Its AC-10 forced the question of how a guard proves it has a subject
rather than assuming it. Its OQ-1 named the risk that `projectService` might push files out of lint
coverage, which is now AC-5's binding constraint.

**Three disagreements were settled rather than averaged.**

1. **How the rule proves it has a subject.** Codex wanted a committed fixture that lint rejects;
   Claude wanted a re-runnable demonstration recorded at the gate. **Claude's is taken.** A committed
   deprecated fixture is either inside lint's scope — in which case `pnpm lint` is permanently red —
   or outside it, in which case the guard is proven over a path the real gate does not cover, which
   is precisely this ticket's own failure one layer down. Codex's rigour is kept: AC-6 requires the
   commands, the counts and the refs, so a reviewer re-runs the demonstration rather than believing
   it.
2. **Whether a new `docs/DECISIONS.md` entry is written.** Claude required one and left it as OQ-4;
   Codex forbade one outright. **It is required** (AC-12b). The reversed policy lives in a config
   comment rather than in an entry, so this is not literally reversing one — but the durable question
   is *what each gate owns*, `harness/rules.md` currently states the gap in prose that AC-11 makes
   false and needs something citable in its place, and the next person weighing another type-aware
   rule needs the argument. A config comment is not where anyone looks. Codex's real concern is
   preserved verbatim: the 2026-08-25 unknown-keys entry gets a dated note and is **not** rewritten.
3. **Criterion count and shape.** Codex's AC-18 bundled eight cross-cutting checks into one
   criterion, which is not independently testable; it became the checklist table. Codex's AC-11 and
   AC-12 described one assertion from two sides and merged into AC-7; its AC-6, AC-7 and AC-9 merged
   into AC-5 with the coverage constraint added.

**Sizing.** Twelve criteria, inside the band the 2026-08-22 sizing decision asks for. The work
divides into two commits in a fixed order — the 21-site migration, then the two guards and the four
documents — which is what AC-8 requires and what makes this a chore-flow ticket rather than a
full-SDLC one: there is no behaviour to write a failing test against, because the behaviour is
required to be identical. `harness/Q-0069/integration` already exists, so the chore flow's first-pass
prerequisite is met and the run will not fail after paying its implementer.
