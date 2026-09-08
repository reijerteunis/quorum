# Q-0067 — implement report, chore run 2, iteration 3

*Revision round. Two majors, both accepted and addressed. Seven files, +159/−29. Verified forced in
this worktree: 21/21 turbo tasks, 0 cached, lint and typecheck clean, the git-identity sweep green,
and every one of the five guard clauses shown red by a genuine on-disk mutation before it was
trusted — each reverted, with the working tree confirmed clean of all of them afterwards.*

**Not one line of shipped behaviour moved this round.** Every production edit is a comment; the only
executable changes are in the guard and in two line-number citation pins.

---

## 1. Major 1 — the AC-6 guard was bypassable by a computed key

> *`packages/core/src/adapters/cli-version.test.ts:104` — the AC-6 guard misses a third reader
> written as `entry['version' + '_state']`, as the iteration-2 report itself acknowledges … Use a
> structural scan that resolves static computed property names, or enforce the boundary through an
> API/module structure that cannot be bypassed this way, and add this exact mutation case.*

**Accepted.** Iteration 2 named this limit in its own report and left it open, which is the weaker
half of *"stated rather than claimed closed"*: a limit worth stating is worth measuring first, and
this one turned out to be closable. The reviewer offered two remedies; **both are taken**, because
they close different halves and neither is complete alone.

### (a) The scan resolves a static concatenation

`namedIn` read the file as written. It now reads the file **and** the same file with every static
concatenation of string literals folded into the one literal it spells, to a fixpoint — so
`'version' + '_state'` and `'ver' + 'sion' + '_state'` both read as `version_state`, which is clause
B's own needle for the `--json` key.

**Additive rather than substitutive**, and that is the whole safety argument for writing a folding
rule by hand rather than reaching for a parser: `scannable()` hands every scan the raw text *and*
the folded text together, so a fold that got something wrong can only fail to find a violation the
raw text already shows — never hide one. Same fail-open-is-the-safe-direction reasoning the
`QUOTES` comment already records for leaving comments unblanked, and the same reason a dependency
was not added for this (Non-goal 8's spirit: the rule is six lines).

`namedAsWritten` — the unfolded predicate that shipped in iteration 2 — is **kept rather than
deleted**, because it is what lets a mutation prove which clause caught it. A bypass found by both
predicates would say nothing about the fold.

### (b) The boundary is structural, and clauses D and E are what say so

Folding closes one spelling. It does not answer *why a text scan is the right instrument at all*,
which is the reviewer's second remedy and the more durable half. Measured over both production
corpora:

| property | measured |
| --- | --- |
| namespace imports of a workspace or relative module | **none** — the one `import * as` in production is `ajv-formats` |
| dynamic `import(` | **none** |
| `require(` | **none** |

So every module edge in production is a **static ESM named import**, whose specifier and imported
names are literal syntax that no computed expression can stand in for. A file holding this
vocabulary therefore has to write one of its names down — which is exactly what clause B scans for.
That is what makes clauses A to C *exhaustive* rather than merely diligent, and it is now **clause
D**, asserted rather than argued.

**Clause E** closes the other half of the reviewer's own example, and no scan closes it: `entry[…]`
needs an `entry`, and outside `packages/cli/src/adapters.ts` there is nowhere to get one. The report
is a local array of a module-private type and that command module exports one thing — the handler.
A second export, or `export type Report`, fails by name.

### The guard is now five clauses

**A** finds a state literal in any quoting · **B** finds a file naming the vocabulary, the two
`--json` keys included · **C** covers `indeterminate`, which three vocabularies spell, over the files
B has already identified · **D** establishes that the corpus offers no route to a symbol that does
not name it · **E** that the report never leaves the module that builds it. A and B additionally
read a static concatenation as the string it spells.

The tests were also **reordered to A → B → C → D → E**, which they were not after the insert, and
clause D's extraction was factored into `workspaceNamespaceImports` so the clause and its mutation
run *the same expression* rather than two descriptions of one.

### Shown red on disk, one mutation at a time

The planted-fixture tests ship inside the suite and run against the genuine corpus with one entry
replaced. As in iteration 2 I did not trust them from their own passing: each was also applied as a
real edit to a real production file, run alone, and reverted.

| mutation | file | what fired |
| --- | --- | --- |
| `const q0067Bypass = entry['version' + '_state'];` | `cli/src/board.ts` | **clause B** — *expected [ Array(4) ] to strictly equal [ Array(3) ]*. **The reviewer's exact case, on disk.** |
| `const q0067Bypass = entry['ver' + 'sion' + '_state'];` | `core/src/engine/routing.ts` | **clause B** again — the fixpoint loop, so three parts fold as readily as two |
| `import * as q0067 from '@quorum/core';` | `cli/src/board.ts`, then `core/src/engine/routing.ts` | **clause D** — *a namespace import of a workspace module reaches cliVersion without naming it*; re-run after the refactor to confirm the shared helper still fires |
| `const q0067Late = await import('@quorum' + '/core');` | `cli/src/board.ts` | **clause D**, second half, **alone** — 1 failed, 35 passed, so no neighbour is what refused it |
| `export type Report = …` | `cli/src/adapters.ts` | **clause E** **alone** — *a second export from the command module could hand the report to a third file* |

The in-suite bypass test additionally asserts that `namedAsWritten` **does not** see the planted line
and that clause A does not either — *"the unfolded scan already saw it, so the fold is not what
caught it"*. That is the finding reproduced immediately before it is closed, and it is what makes
this a demonstration rather than a coincidence (Q-0107).

### What still cannot be reached, and why it now has no site

A member access off a **runtime** value — `entry[k]` — names and spells nothing, and no source scan
reaches it. That is unchanged and is stated in the guard's header. What changed is that it no longer
has anywhere to live: clause D means nothing may obtain `cliVersion` without naming it, and clause E
means an entry does not exist outside the module that builds it. The residual is a file that
re-parses the command's own JSON out of a subprocess, which is not a production shape anywhere in
this workspace and would be a far larger finding than this guard.

---

## 2. Major 2 — the decision was still restated in production JSDoc

> *`packages/core/src/adapters/adapters.ts:312` … the same pattern remains at
> `claude-capabilities.ts:25`, `codex-capabilities.ts:24`, and `packages/cli/src/adapters.ts:102` …
> iteration 2 did not fully address the prior finding.*

**Accepted, and the finding is right that round 2 stopped short.** I trimmed the banner headers and
the rationale paragraphs and left the *clause-shaped sentences* standing, on the reading that a
sentence describing what a function does is a contract. It is not, where the sentence is the
decision's own list: *"nothing here selects a flag, a field or a schema, and no state it returns
reaches an exit code"* is clauses (b) and (c) transcribed, and it is a **test's** claim rather than a
comment's — clause D and AC-6's folder scan are what hold it.

All four named sites are trimmed to local contract plus one `Why:`:

| site | removed | kept |
| --- | --- | --- |
| `core/adapters/adapters.ts` `cliVersion` | *reports and never refuses; selects no flag, field or schema; no exit code* | what it is, that it lives at the contract layer so a contributor inherits it, `@param`/`@returns`, one `Why:` |
| `claude-capabilities.ts` `verifiedVersion` | *and nothing else — not a minimum, a maximum or a range* | what the field records, one `Why:`, the pointer to the test holding it equal to the document |
| `codex-capabilities.ts` `verifiedVersion` | the same | the same |
| `cli/src/adapters.ts` `versionClause` | *no word here means supported, compatible or validated, advises changing a vendor CLI, or says a run will fail* | what it renders, the `pushLagLegend` shape, one `Why:` pointing at `adapters.test.ts`'s AC-9 block, **which is what actually enforces the removed list** |

### Two more sites the finding did not name

The pattern this repository records against itself most often is fixing the instance a reviewer names
rather than the class — three times over on Q-0112, and round 2's own report claimed to have fixed
the class and had not. So both remaining instances went with them:

- **`claude-capabilities.ts`'s module header** — *"a recorded measurement, which is what keeps this
  file data"* is clause (a) at one remove. Now *"is the version they were last verified against
  (Q-0067)"*, which also makes the two capabilities headers symmetric.
- **`cli/src/adapters.ts`'s Q-0067 header paragraph** — *"It refuses nothing, changes no exit code
  and adds no spawn: it says what the login evidence above it was collected against"* is clauses (b)
  and (d). Trimmed to what the command does, plus the `Why:`.

### What was deliberately left standing

`packages/shared/src/cli-version.ts`'s header (*declarations only; core derives, the CLI renders*) is
AC-1's rule about **this module**, not the decision's about the product — it is the local contract a
reader needs to know before editing the file. `VERSION_CLAUSE`'s docblock is a compile-time fact.
`versionTriple`'s prerelease line is one sentence plus a Q-0067 R-2 citation. The two inline comments
at the call site are one remark each plus an authority. `packages/core/src/index.ts`'s Q-0067
paragraph explains barrel membership, which is what its five siblings in that docblock do.

---

## 3. What the trims broke, which is the pin working — for the third time

Cutting nine more lines of comment out of `adapters/adapters.ts` moved the two declarations
`packages/shared/src/step-output.ts` cites by line, and the suite went red on itself:

> `packages/core/src/adapters/adapters.ts:607 must still be the declaration it names: expected
> '  const problems: string[] = [];' to match /^export function/`

Re-derived from the file rather than adjusted by arithmetic: `checkAgainstSchema` 607 → **606**,
`extractJson` 570 → **569**, in the source comment and in `step-output.test.ts`'s register together.
The register's note now records that Q-0067 shifted them three times — 68 lines when `cliVersion`
landed above them, then 59 and 58 as two review rounds cut transcribed rationale out — and that the
pin caught it on all three occasions. A citation that stops naming a declaration is exactly what it
exists to catch.

---

## 4. File by file

| file | what changed |
| --- | --- |
| `packages/core/src/adapters/cli-version.test.ts` | `FOLDABLE`, `foldLiterals` and `scannable`; `filesWhere` extracted so `namedIn` (folded) and `namedAsWritten` (raw) are one predicate under two views; `vocabularyNamers` folds too; `NAMESPACE_IMPORT` and `workspaceNamespaceImports`; the reviewer's exact bypass as a test beside clause B; clauses **D** and **E** with a mutation test each; header rewritten to name the five clauses and the residual; tests reordered A → B → C → D → E. Five tests where there were one. |
| `packages/core/src/adapters/adapters.ts` | `cliVersion`'s docblock trimmed to contract plus one `Why:`. **No code changed.** |
| `packages/cli/src/adapters.ts` | the module header's Q-0067 paragraph and `versionClause`'s docblock trimmed the same way. **No code changed.** |
| `packages/core/src/adapters/claude-capabilities.ts` | field docblock and one header clause trimmed. **No value changed** — still `2.1.220`. |
| `packages/core/src/adapters/codex-capabilities.ts` | field docblock trimmed. Still `0.149.0`. |
| `packages/shared/src/step-output.ts` | two cited line numbers, 607 → 606 and 570 → 569. |
| `packages/shared/src/step-output.test.ts` | the same two in the register, with the reason. |

---

## 5. What I deliberately left alone

- **Everything else from iterations 1 and 2.** All eleven non-goals still hold, the recorded versions
  are unbumped, `check()`'s signature is untouched, no spawn was added, and Q-0066's preserved crash
  is still preserved.
- **`containment.ts` and `push-lag.ts`.** They carry the same `//` banner-header shape that round 2's
  Major 2 corrected in `cli-version.ts`. Outside this ticket; sweeping them would be scope creep
  wearing a review finding's clothes. Reported, not fixed.
- **`CLAUDE.md`** (GO-2's, landed on the integration branch; not in this role's `paths:`) and
  **`docs/06-development-plan.md`** (rewritten by hand at each plan pass — Q-0094 E-3(a)).

---

## 6. Verification

Run in this worktree after `pnpm install --frozen-lockfile`, with `commands.install` and
`commands.test` verbatim:

- `pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks, 0 cached**. Core **1416
  passed / 2 skipped** (1412 before — the four new clause tests), CLI 620, shared 162, four scaffolds
  1 each. Lint and typecheck clean.
- `pnpm sweep:git-identity` → **exit 0**, re-run after the last edit rather than before it.
- `pnpm exec quorum lint` → 6/6 flows clean.
- **The product, on this machine**: `pnpm exec quorum adapters --json` prints the two human lines
  unchanged and reports `"version_state": "ahead"` for both vendors against `2.1.220` and `0.149.0`
  — byte-identical to iterations 1 and 2, which is what a comment-only production diff must produce.
- `git status --short` lists exactly the seven intended files, so every mutation above was reverted.

**Not done, stated rather than implied:** `--probe` was not run by hand — it bills a subscription,
and `build.test.ts`'s three spawned AC-11 cells prove both exit-code cells across a real process
boundary and pass unchanged. GO-5's second environment row and CI are the gate's.

## 7. One remark for the reviewer

Clause D will go red on the first production file that legitimately uses a dynamic import or a
namespace import of a workspace module, and the failure will name Q-0067 for a change that has
nothing to do with versions. That is the tripwire working — such a file genuinely re-opens the route
around clauses A to C — and the assertion messages say so in as many words rather than leaving the
next reader to work it out. If a future ticket needs one, the honest move is to exempt the site by
name in this register, not to delete the clause.
