# Q-0067 — implement report, chore run 2, iteration 2

*Revision round. Two majors, both addressed; nothing else from iteration 1 moved. Eight files,
+175/−137. Verified forced in this worktree: 21/21 turbo tasks, 0 cached, the git-identity sweep
green, and every clause of the rewritten guard shown red by a genuine on-disk mutation before it was
trusted.*

---

## 1. Major 1 — the version-branching guard was bypassable three ways

> *`packages/core/src/adapters/cli-version.test.ts:55` — the AC-1/AC-6 guard searches only
> single-quoted forms of three states, so a third production reader can branch on `"ahead"`, a
> template literal, or the serialized `version_state` value without naming any identifier in
> `VOCABULARY`, and the suite remains green.*

**Accepted in full.** The finding is correct in all three directions, and the third — the serialized
field — is the one I would not have found by re-reading, because it defeats *both* clauses at once:
a reader of `entry.version_state` names no exported identifier and, if it compares against a
variable, no literal either.

### What the scan is now

**Clause A is quote-independent.** `OWN_STATE_LITERALS` was `["'as-verified'", "'ahead'",
"'behind'"]`; it is now those three states through `quotedForms`, which spells each in all three
JavaScript string syntaxes — nine needles where there were three. A bypass that cost one keystroke
now costs a rewrite of the value into a variable, which clause B sees.

**Comments are deliberately not blanked first**, and the reason is in the guard: a lexer that got it
wrong would fail **open**, and a prose mention of a quoted state failing this guard is the safe
direction. It is the shape `turbo-inputs.test.ts` already takes, whose own comment records that a
quoted path in a comment is collected as one. Measured rather than assumed: across the whole
production corpus of both packages the nine needles select exactly the two `STATE_SITES` today, with
no prose false positive — `git.ts:390`'s `` `%(ahead-behind:<ref>)` `` is not an exact match, and the
backticked `` `indeterminate` `` in `adapters/adapters.ts`'s own JSDoc is in an allowed file.

**Clause B gained the two serialized spellings.** `VOCABULARY` is six names rather than four:
`cliVersion`, `CliVersionResult`, `CliVersionState`, `CLI_VERSION_STATES`, **`version_state`** and
**`verified_version`**. Those last two are the `--json` report's own keys, and they are exactly the
route the review named — a file holding a state while naming nothing this module exports. Neither
string occurs anywhere in production but `packages/cli/src/adapters.ts:148`, so the allowed set is
unchanged at the two sites plus the barrel.

**Clause C is new, and it is how `indeterminate` gets covered without a register of exemptions.**
The reviewer asked for all four literals with the unrelated uses distinguished *structurally*. The
structure is this: to hold one of **our** `indeterminate`s a file must have obtained a result, which
means calling the derivation, typing the answer, or reading the serialized key — which is precisely
the set clause B pins. So clause C scans **all four** literals over the vocabulary-naming files
alone, and requires them to be the two sites; the barrel names the vocabulary and spells no state.

Between the three clauses, every production file either cannot obtain a state (clause A: it spells
none of the three, and a second derivation of its own would have to spell one, since nothing
answering more than `indeterminate` can avoid it) or is one of three known files (clauses B and C).

**`board.ts` is not exempted — it is unambiguous.** That distinction is worth stating because it is
the difference between a rule and a hole, and mutation 2 below measured it: `board.ts`'s
`'indeterminate'` is containment's for exactly as long as that file has no way to hold one of ours.
The moment it names `version_state`, clause C reports its literal too. The comment says so, with
*measured by mutation* rather than *by construction*.

**AC-6's adapters-folder scan takes all four literals**, where the corpus-wide clause A can only take
three. The folder itself is the structural distinction there: no other vocabulary in this workspace
spells `indeterminate` inside `packages/core/src/adapters/`.

### Shown red, one mutation at a time, on disk

The three planted-fixture tests ship inside the suite and run against the genuine corpus with one
entry replaced. I did not trust them from their own passing: each was also applied as a real edit to
a real production file, run alone, and reverted.

| mutation | file | what fired |
| --- | --- | --- |
| `const q0067Probe = state === "ahead";` | `core/src/engine/routing.ts` | **clause A** — *expected [ Array(3) ] to strictly equal [ Array(2) ]*. The double-quoted reader, which is the reviewer's own example. |
| `const q0067Stale = entry.version_state;` | `cli/src/board.ts` | **clause B** — *expected [ Array(4) ] to strictly equal [ Array(3) ]*, with **clause A green**, which is the proof that clause A genuinely cannot see this one. Clause C fired too, and correctly: that file now holds our vocabulary beside its own `indeterminate`. |
| `const q0067Unread = 'indeterminate';` | `core/src/index.ts` | **clause C alone** — 1 failed, 31 passed. Aimed at the barrel, which clause B already allows and clause A cannot see, so neither neighbour fires. |

The third is the one that matters for *"a guard shown red by its neighbour has not been established"*
(Q-0107): clause C is demonstrated on a subject that only clause C can refuse.

Each in-suite mutation test also asserts that its neighbours stay at their expected sets, with the
message saying so — *"clause A sees this one too, so it proves nothing about clause B"* — so a later
widening that made one clause subsume another turns those messages red rather than quietly reducing
three checks to one.

Working tree confirmed clean of all three mutations before the final run: `git status --short` lists
only the eight intended files.

### What it still cannot see, stated rather than claimed closed

`entry['version' + '_state']` names nothing and spells nothing. No source scan reaches that, and
saying otherwise would be the vacuous-coverage claim this repository keeps finding. It is a limit of
the instrument, not a gap left open by choice, and it is in the guard's own comment.

---

## 2. Major 2 — the decision was transcribed into production source

> *`packages/shared/src/cli-version.ts:1` — multi-paragraph transcription of the governing decision
> … conflicts with `.claude/rules/engineering.md` and GO-1 … the same pattern recurs in the new JSDoc
> around the derivation and renderer.*

**Accepted.** The rule is explicit — *"never transcribe DECISIONS.md or a ticket body into a source
file"*, and *"one line naming the authority"* — and GO-1 said **cite it rather than restating it** in
as many words. I read AC-1's *"in the shape those two modules already set"* as licence for the banner
header; re-read, that clause is about **content** (declarations only, `core` answers and the surface
prints) and says nothing about comment style. Nothing in the requirement asked for the header, and
the policy now lives where AC-13 put it: the decision entry and `docs/GLOSSARY.md`'s **Verified
version**, including the "what it is not" half.

**`packages/shared/src/cli-version.ts`**: 29 lines of `//` banner — *A PAST MEASUREMENT, NEVER A
POLICY* and *PROVENANCE, NEVER A SECOND VERDICT* — replaced by a 10-line JSDoc stating what the
module is, that it is declarations only, and one `Why:` naming the decision and the glossary. The two
export docblocks lost their rationale and kept their contracts: which arm may carry `null`, and that
`indeterminate` is never inferred as one of the other three.

**The derivation** (`packages/core/src/adapters/adapters.ts`): `cliVersion`'s docblock loses the
past-measurement/provenance paragraph and keeps *"it reports and it never refuses: nothing here
selects a flag, a field or a schema, and no state it returns reaches an exit code"* — which is the
function's contract — plus the `Why:` line. `VERIFIED_VERSIONS` and `versionTriple` are trimmed the
same way; the prerelease behaviour now cites Q-0067 R-2 instead of describing it.

**The renderer** (`packages/cli/src/adapters.ts`): `versionClause`'s docblock keeps the one sentence
that binds the code — it names the two versions and stops — and points at `adapters.test.ts`'s AC-9
block, which is what actually holds the rendered strings to it. `VERSION_CLAUSE` keeps the
compile-time exhaustiveness fact and loses the trained-away-line argument. The inline comment at the
call site is two lines instead of four.

### I fixed the class, not the two instances

The reviewer named the shared module and *"the derivation and renderer"*. The same pattern was in a
third place neither named: both capabilities modules' `verifiedVersion` fields carried *"not a
minimum, not a maximum and not a range. Nothing branches on it and no comparison with it refuses
anything"* — decision clauses (a) and (b) restated at a field. Both are trimmed to the field's
contract plus one `Why:` and a pointer to the test that holds the value equal to the document.

This is deliberate. The pattern this repository records against itself most often is fixing the
instance a reviewer names rather than the class it belongs to — three times over on Q-0112 — and two
of these three sites would have survived a literal reading of the finding.

### One judgement call, named for the gate

The old header was `//` because `containment.ts` and `push-lag.ts` are, and those two files have no
statement for a JSDoc to attach to. `engineering.md` says module comments are JSDoc, and the finding
cites that file, so I converted rather than propagating a violation of the rule I was just corrected
against. The consequence is that `cli-version.ts` now differs in *marker* from its two siblings while
matching them in content. **If the gate prefers the siblings' shape, it is one comment marker in one
file.** Both siblings are left alone: they are outside this ticket, and sweeping them would be scope
creep wearing a review finding's clothes.

---

## 3. What the trims broke, which is the pin working

Cutting nine lines of comment from `adapters/adapters.ts` moved the two declarations
`packages/shared/src/step-output.ts` cites by line. The suite went red on itself:

> `packages/core/src/adapters/adapters.ts:616 must still be the declaration it names: expected
> '    const value = record[key];' to match /^export function/`

Re-derived rather than adjusted: `checkAgainstSchema` 616 → **607**, `extractJson` 579 → **570**, in
the source comment and in `step-output.test.ts`'s register together. The register's own note now
records that Q-0067 shifted them twice — 68 lines when `cliVersion` landed above them, 59 once this
round cut the transcription — because a citation that stops naming a declaration is exactly what that
pin exists to catch, and it caught this one both times.

---

## 4. File by file

| file | what changed |
| --- | --- |
| `packages/core/src/adapters/cli-version.test.ts` | The guard. `QUOTES` and `quotedForms`; `OWN_STATE_LITERALS` quote-independent; `ALL_STATE_LITERALS`; `VOCABULARY` 4 → 6 names; `ALLOWED_NAMERS`, `vocabularyNamers` and `withPlanted` extracted; clauses A, B and C with a mutation test each — five tests where there were two. Header converted to JSDoc and trimmed. AC-6's folder scan takes all four literals. |
| `packages/shared/src/cli-version.ts` | 29-line banner header → 10-line JSDoc with one `Why:`. Both export docblocks trimmed to contract. No declaration changed. |
| `packages/core/src/adapters/adapters.ts` | `VERIFIED_VERSIONS`, `versionTriple` and `cliVersion` docblocks trimmed to contract plus authority. **No code changed.** |
| `packages/cli/src/adapters.ts` | `VERSION_CLAUSE` and `versionClause` docblocks trimmed; two inline comments shortened. **No code changed.** |
| `packages/core/src/adapters/claude-capabilities.ts` | `verifiedVersion`'s field docblock trimmed; one clause of the module header shortened. **No value changed** — still `2.1.220`. |
| `packages/core/src/adapters/codex-capabilities.ts` | The same trim. Still `0.149.0`. |
| `packages/shared/src/step-output.ts` | Two cited line numbers, 616 → 607 and 579 → 570. |
| `packages/shared/src/step-output.test.ts` | The same two in the register, with the reason. |

**Not one line of shipped behaviour moved this round.** Every production edit is a comment; the only
executable changes are in the guard and in two line-number pins.

---

## 5. What I deliberately left alone

- **Everything else from iteration 1.** The eleven non-goals in that report all still hold, the
  recorded versions are unbumped, `check()`'s signature is untouched, and Q-0066's preserved crash is
  still preserved.
- **`containment.ts` and `push-lag.ts`.** Same header pattern, outside this ticket. Reported above.
- **`packages/core/src/index.ts`'s Q-0067 paragraph.** It explains barrel membership, which is what
  its five siblings in that docblock do; trimming only mine would make the register inconsistent.
- **`CLAUDE.md`** (GO-2's, on the integration branch, not in this role's paths) and
  **`docs/06-development-plan.md`** (rewritten by hand at each plan pass — Q-0094 E-3(a)).

---

## 6. Verification

Run in this worktree after `pnpm install --frozen-lockfile`, with `commands.install` and
`commands.test` verbatim:

- `pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks, 0 cached**. Core **1412
  passed / 2 skipped** (1407 before — the five new clause tests), CLI 620, shared 162, four scaffolds
  1 each. Lint and typecheck clean.
- `pnpm sweep:git-identity` → **exit 0**, re-run after the last edit rather than before it.
- `pnpm exec quorum lint` → 6/6 flows clean.
- **The product, on this machine**: `pnpm exec quorum adapters --json` prints the two human lines
  unchanged and reports `"version_state": "ahead"` for both vendors against `2.1.220` and `0.149.0` —
  byte-identical to iteration 1, which is what a comment-only production diff should produce.
- `build.test.ts`'s three spawned AC-11 cells pass unchanged: verified login with `ahead` → 0 with
  both clauses printed, failed login with `as-verified` → 1, bare listing → 0 with no clause.

**Not done, stated rather than implied:** `--probe` was not run by hand — it bills a subscription,
and the spawned fixture proves both exit-code cells across a real process boundary. GO-5's second
environment row and CI are the gate's.
