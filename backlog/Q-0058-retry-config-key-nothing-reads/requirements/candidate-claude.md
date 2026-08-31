# Q-0058 — `harness.yaml` documents a retry key nothing reads

*Requirements candidate (claude), 2026-08-31. Every measurement below was taken against the working
tree today; where this document and the ticket body disagree, this document is the later
measurement and says so explicitly.*

---

## Problem

`harness/harness.yaml:11` and `spike/templates/harness/harness.yaml:11` both carry, byte for byte:

```yaml
    # retry: { attempts: 5, base_delay_ms: 5000 }   # transient network/5xx only; never auth or model errors
```

`withRetry` destructures `{ attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000 }` —
`spike/src/adapters/index.js:68` and `packages/core/src/adapters/adapters.ts:345`, identically in
both trees. `attempts` is honoured. `base_delay_ms` is read by nothing. `maxDelayMs` is documented
in no file at all.

The failure is silent and self-concealing. An adopter who uncomments the line gets exactly the
behaviour they asked for, because the discarded value and the default are both `5000`. Any *other*
value is discarded without a word, and the first evidence is a retry storm or a run that gives up
early against a flaky connection — the failure `withRetry` exists for. `harness init` copies the
template into every adopter's repository (`spike/bin/harness.js:397`), so this is on the cold-clone
path.

Underneath the typo is the class: **nothing in this repository can tell that a shipped
`harness.yaml` names a key spelling no code reads.** `harness lint` lints flows only —
`packages/core/src/lint/` and `spike/src/lint.js` contain no reference to `harness.yaml`.
`projectConfigSchema` (`packages/shared/src/project.ts:56`) declares the shape and is called by no
production file in either tree. `packages/shared/src/project.test.ts:24–31` does parse both shipped
files and assert no key is added or removed — but it parses the *live* YAML, and the defect has
lived in a **comment** for months, invisible to it. A guard that cannot see the shape the defect
takes is not coverage for it.

---

## Measurements taken today, and where they correct the ticket body

The ticket body was re-derived by hand on 2026-08-31. Four of its claims were re-checked and hold;
two are corrected here, and both corrections change what a shape costs.

**Holds.** Both line-11 references are byte-identical in the two files. Both trees still destructure
camelCase (`spike/src/adapters/index.js:68`; `packages/core/src/adapters/adapters.ts:345`, with the
arithmetic at `:385` and `getAdapter`'s `withRetry(factory(cfg), cfg.retry)` at `:275`).
`retryPolicySchema` is module-private at `packages/shared/src/project.ts:36`. `git branch --list
'harness/*'` is empty, so charter §8's first item is live for the *chore* run.

**Correction 1 — the convention census counts the wrong unit, and the answer inverts.** The body
counts the whole file and reports "five snake_case to one camelCase", concluding that correcting the
templates "makes the retry block match the code and mismatch its five neighbours". Split by subtree,
there is no mismatch to make. Every multi-word key spelling Quorum **reads**:

| Key path | Spelling | Read at |
| --- | --- | --- |
| `adapters.<v>.extraArgs` | camelCase | `claude.js:28`, `codex.js:48`, `claude.ts:114`, `codex.ts:112` |
| `adapters.mock.delayMs` | camelCase | `mock.js:67`, `mock.ts:106` |
| `adapters.<v>.retry.baseDelayMs` | camelCase | `index.js:68`, `adapters.ts:345` |
| `adapters.<v>.retry.maxDelayMs` | camelCase | `index.js:68`, `adapters.ts:345` |
| `repo.base_branch` | snake_case | `engine.js:57` |
| `repo.max_diff_bytes` | snake_case | `engine.js:928`, `engine/diff.ts:314` |
| `commands.timeout_ms` | snake_case | `engine.js:529`, `engine/steps.ts:78` |
| `budget.per_run_usd` | snake_case | typed only |
| `budget.per_ticket_usd` | snake_case | typed only |

**Ten spellings, five and five, and not one exception in either direction.** Every camelCase key
lives under `adapters.<vendor>`; every snake_case key lives outside it. `base_delay_ms` is the
single counterexample in the repository, and it is the one nothing reads.

The split is principled rather than accidental, which is what makes it worth stating.
`getAdapter` selects `config[name] ?? {}` and hands **the whole object through, unread**, to the
factory and to `withRetry`, which destructure JavaScript identifiers. Everything outside
`adapters.<vendor>` is read key by key by Quorum's own code, which chose snake_case. So the rule
that predicts all ten is: *inside `adapters.<vendor>` a key is a JavaScript property name an
adapter destructures; outside it a key is Quorum's own vocabulary.* It also tells a `contributor`
adding a Gemini adapter what to name their keys, which nothing does today.

**Correction 2 — the body's fourth shape cannot deliver what it promises.** Renaming the code's two
fields to `base_delay_ms`/`max_delay_ms` leaves `extraArgs` and `delayMs` camelCase in the same
`adapters.<vendor>` block, so the file still has two conventions — now with the split running
*through* the adapters subtree instead of around it. Delivering one convention means renaming
`extraArgs` too, which is a live key an adopter may already have uncommented in a copied template,
and it means giving up the pass-through property: every key a contributor's adapter invents would
need a mapping entry in `packages/shared` before it could be configured.

**Two further facts the body does not state.**

- The core-side pin is **wider** than reported. `packages/core/src/backlog/backlog.source.test.ts`
  asserts `.parse(`/`.safeParse(` are absent from `project.ts` (`:115–116`) *and* that **no file in
  `packages/core` imports zod at all** (`:117–120`, over `coreSourceFiles()`). Any validation shape
  is more constrained than "move one pin".
- A strict `retryPolicySchema` would have **no subject today**.
  `packages/shared/src/project.test.ts:24–31` parses both shipped files and asserts
  `result.data` equals the input exactly; the retry example is commented out, so it is not in the
  parsed data. The guard would acquire a subject only when someone uncomments the line — the shape
  this project has already had to fix twice (Q-0069, Q-0071).

---

## User story

**`adopter` (cold-clone), CLI + `harness/`.** I ran `harness init`, opened
`harness/harness.yaml`, and uncommented the retry example because my connection drops. I set
`base_delay_ms: 30000`. I want that number to take effect, or to be told it will not — not to find
out from a retry storm three weeks later that the harness has been backing off from 5 seconds the
whole time.

**`maintainer`, `harness/`.** I read `harness.yaml` to learn what I can configure. I want the file
to name every field of a policy it invites me to write, at the spelling that works, and I want a
key the file names but nothing reads to fail a suite rather than sit there for months.

**`contributor`, `harness/` + `packages/shared`.** I am adding an adapter. I want to know what to
call my configuration keys without reverse-engineering four existing ones, and I want the
declaration in `packages/shared` to be true about what the shipped files contain.

---

## Recommendation

**Shape 1 (correct the templates), plus a parity guard that can see commented examples, plus the
convention stated where a reader of the config looks.** No code changes in either tree.

The guard is the part that matters. Shape 3's stated advantage — *"the only one that stops the next
instance of the same class"* — is delivered here without any of shape 3's costs, because the class
is precisely *"a shipped `harness.yaml` names a key spelling nothing reads"*, and a test that
uncomments every example line before checking it against the schema is aimed exactly at that. It
needs no schema call on a load path, moves neither landed pin, changes no exit code, and has a
demonstrated subject **today**: both shipped files fail it before the fix.

Shape 2 is refuted by the pass-through property — a second accepted spelling cannot be maintained
for keys a contributor's adapter has not invented yet. Shape 4 is refuted by Correction 2. Shape 3
is deferred with reasons, in Non-goals.

**This shape touches no code and no `spike/src/` file**, so the port-freeze SHA half stays green and
no re-record is required (`harness/port-charter.md` §3). The Q-0066 / Q-0068 / Q-0070 "both trees
together" constraint does not apply: there is no behaviour to mirror.

---

## Acceptance criteria

Numbered, independently testable. Surfaces: `harness/` (both shipped `harness.yaml` files,
`harness/port-charter.md`) and `packages/shared`. No CLI, daemon, flow or role surface.

**AC-1 — Both shipped `harness.yaml` files spell the retry example as the code reads it, and name
all three fields.** `harness/harness.yaml:11` and `spike/templates/harness/harness.yaml:11` become

```yaml
    # retry: { attempts: 5, baseDelayMs: 5000, maxDelayMs: 60000 }   # transient network/5xx only; never auth or model errors
```

The trailing sentence is preserved unchanged; the example stays commented; its indentation and
position under `adapters.codex` are unchanged.
*Test:* for each of the two files, the text contains `baseDelayMs`, contains `maxDelayMs`, and does
**not** contain `base_delay_ms`. Read via `repoFile` and `spikeSource`
(`packages/shared/test/corpus.ts`), which throw on a missing subject.

**AC-2 — Uncommenting the example is a no-op, checked against both trees rather than asserted.**
Each value in the example equals the default the code destructures. The oracle is the source text of
`spike/src/adapters/index.js` and `packages/core/src/adapters/adapters.ts`, not a literal retyped
into the test, so a later change to a default turns this red instead of silently converting the
example into a trap.
*Test:* extract `{ attempts = N, baseDelayMs = N, maxDelayMs = N }` from `withRetry`'s parameter
list in each tree; assert the two trees agree; parse the example line from each shipped file and
assert every field equals the corresponding default. The extraction must fail loudly if the
destructure cannot be located — a regex that matches nothing must throw, not report a pass over
zero fields.

**AC-3 — `retryPolicySchema` and `adapterConfigSchema` are exported from `packages/shared`.**
Both are currently module-private (`packages/shared/src/project.ts:36`, `:50`).
`packages/shared/src/index.ts` re-exports `./project.js` with `export *`, so no index edit is
needed. No new dependency; `packages/shared/package.json`'s `dependencies` stays exactly `["zod"]`,
which `backlog.source.test.ts:130` already pins.
*Test:* `import { retryPolicySchema, adapterConfigSchema } from './project.js'` resolves and both
are zod object schemas exposing `.shape`.

**AC-4 — A parity guard: every key path in the two shipped configs is declared in the schema.**
A new test in `packages/shared/src/project.test.ts` builds, for each shipped file, the *uncommented*
document — the live YAML plus every commented example line restored — walks every key path in it to
any depth, and asserts each path is declared in `projectConfigSchema` or the nested schema reached
along that path (`adapters` being a `z.record` whose value schema is `adapterConfigSchema`).
The guard applies to **these two files only**. It does not constrain an adopter's own config: the
top level stays loose, per *"Unknown keys are refused where Quorum owns the key set, and preserved
where it does not"* (2026-08-25). What Quorum *ships* naming a key Quorum does not read is a
different question from what an adopter may write.
*Test:* the assertion passes over both files after AC-1, and the failure message names the file, the
full key path, and the nearest declared sibling spellings.

**AC-5 — The guard sees commented examples, and this is demonstrated rather than claimed.** The
uncommenting step is the load-bearing half: a guard reading only live YAML passes over the defect
that has existed since the file was written.
*Test:* two assertions, both required. (a) A fixture equal to the current shipped text — the retry
example commented, spelled `base_delay_ms` — fails the AC-4 check, with the failure naming
`adapters.codex.retry.base_delay_ms`. (b) The same fixture with that line's `#` removed also fails,
so the guard is not accidentally dependent on the comment marker. A guard whose only evidence is a
green run has not been shown to have a subject (Q-0069, Q-0071).

**AC-6 — The uncommenting step cannot skip an example silently.** Only lines matching a comment
whose body is a `key:` mapping are restored; a prose comment is left alone. The number of example
lines restored per file is **pinned**, and the pin is 3 for each shipped file today
(`adapters.claude.extraArgs`, `adapters.codex.retry`, `adapters.codex.extraArgs`). A restored line
that does not parse as YAML fails the test rather than being dropped.
*Test:* assert the restored-line count per file equals its pin, and assert that deleting one example
line from a fixture moves the count and fails. *A silently skipped example would make the guard
report coverage over a file it had not read.*

**AC-7 — The convention is stated where a reader of the config looks, and it is enforced.** Both
shipped `harness.yaml` files gain one short comment stating the rule the census measures: keys under
`adapters.<vendor>` are camelCase because that block is passed through to the adapter verbatim
(`getAdapter`, `spike/src/adapters/index.js:31`, `packages/core/src/adapters/adapters.ts:275`);
every other key is snake_case. Prose, two lines at most — this is on the cold-clone path.
*Test:* over the uncommented documents from AC-4, every multi-word key path under `adapters.` is
camelCase and every multi-word key path outside it is snake_case, with both halves demonstrated to
have a subject (a fixture with `repo.baseBranch` fails; a fixture with
`adapters.codex.retry.base_delay_ms` fails).

**AC-8 — `packages/shared/src/project.ts`'s doc comment stops reporting a defect that is fixed.**
Lines 28–35 currently say both shipped files show `base_delay_ms` "which nothing reads; that
mismatch is reported rather than repaired". After AC-1 that sentence is false. It is replaced by one
that states where the three fields are read in **both** trees and cites this ticket. A false promise
left in a comment is the nit class Q-0053 fixed by hand after its gate; it does not need to recur
here.
*Test:* `packages/shared/src/project.ts` does not contain `base_delay_ms`, and contains a `Q-0058`
authority reference.

**AC-9 — Nothing is validated on any load path, and the two landed pins are untouched.** This
ticket does not call `projectConfigSchema` from production code in either tree.
`packages/core/src/backlog/project.ts` keeps its type-only import; `backlog.source.test.ts:115–120`
and `project.test.ts:110–114` are unedited and still pass; no file in `packages/core` gains an
import of zod. `projectConfigSchema`'s only callers remain tests.
*Test:* the two existing pin tests pass unmodified — verified by their being absent from the diff,
and by the suite being green.

**AC-10 — The port charter stops pointing the cutover at this ticket's id.**
`harness/port-charter.md:430` and `:493` propose **Q-0058** as the id for the cutover follow-up.
That id is this ticket. The charter is reached from `harness/architecture.md`, which `chore.yaml`
injects at `input.harness`, so the wrong pointer is in a document *this ticket's own implement step
reads*. Both sentences are corrected to say the cutover follow-up is unopened and has no id. The
historical note at `:4` — recording that the id shifted from `Q-0055` to `Q-0058` — is a record of
what happened and is **left alone**, on the same reasoning that keeps a landed decision entry
unedited.
*Test:* `harness/port-charter.md` contains no `proposed **Q-0058**`; the sentence at `:4` is
unchanged, asserted by its exact text.

---

## Non-goals

- **No validation on a load path (shape 3), and no strict schema.** Deferred, with three reasons
  stated so this is a decision rather than an omission: it reverses *"declared and validated
  nowhere"* (Q-0043 AC-11) and therefore owes a decision entry no step in this flow may write; it
  moves two landed pins, one of which forbids zod in `packages/core` entirely; and a strict
  `retryPolicySchema` has **no subject today**, because the example is commented and
  `project.test.ts:24–31` parses only live YAML. AC-4 delivers the benefit shape 3 was wanted for.
- **No second accepted spelling (shape 2), and no rename of the code's fields (shape 4).** Refuted
  by measurement in Correction 1 and Correction 2, not by preference.
- **No rename of `extraArgs` or `delayMs`.** Both are read, both are camelCase, both are correct
  under AC-7's rule.
- **No code change in either tree.** `withRetry` already reads what AC-1 writes. Nothing under
  `spike/src/` is touched, so the freeze-SHA half of the port guard stays green and no re-record is
  owed (`harness/port-charter.md` §3).
- **No change to the retry defaults or to the transient-error list.** `5 / 5000 / 60000` and the
  `TRANSIENT` table are out of scope; AC-2 pins the defaults so they cannot move in passing.
- **`budget.per_run_usd`, `budget.per_ticket_usd` and `backlog.layout` stay unenforced.** They are
  typed and read by nothing — an unread **value**, which `packages/shared/src/project.ts:22–25`
  already states out loud, against an unread **spelling**, which nothing states anywhere. Different
  class, different ticket.
- **No `harness lint` rule and no new CLI command for `harness.yaml`.** The guard is a test, not a
  product surface. Giving the config a linter is a product decision with a cold-clone cost.
- **No notice to adopters whose copied `harness.yaml` already carries the wrong spelling.** No
  mechanism exists; see OQ-4.
- **No `docs/decisions/` entry written by any step.** `harness/roles/developer-generalist.md`
  forbids it in as many words, and *"`.claude/rules/` is a derived copy"* (2026-08-27) makes naming
  an unwritable surface in a criterion the failure Q-0069's AC-11(b) recorded. The entry is named in
  OQ-2 and asserted by nothing.
- **Not the cutover ticket.** AC-10 corrects a pointer; it does not adopt the work the pointer
  describes.

---

## Open questions

**OQ-1 — Which shape? (Blocking. Owner: human, at this requirements gate.)** The recommendation is
shape 1 plus the AC-4 guard, on the census in Correction 1. If the gate rules for shape 4
(snake_case in the file), AC-1, AC-2, AC-7 and AC-8 invert, and the ruling must also say what
happens to `extraArgs` and `delayMs` — leaving them camelCase keeps two conventions, and renaming
them is a breaking change to keys adopters may have uncommented. If the gate rules for shape 3,
AC-9 is replaced and this becomes a materially larger ticket with two pins to argue. Blocking
because the criteria are written for one answer and an erratum is the honest way to change them
mid-run (*"An erratum is the last repair, not the first"*, 2026-08-30).

**OQ-2 — Does the convention need a decision entry, and when is it written? (Blocking. Owner:
human.)** AC-7 states a rule that predicts every key spelling in the product's config, which is the
kind of thing that gets re-litigated by the next person to add a key. `docs/decisions/` is outside
the implementer's write paths and adding to it is explicitly forbidden by the role, so **no
criterion may name it** — this is the precondition-external-to-the-document shape Q-0070 hit, on its
sixth appearance. Two workable answers: the human writes the entry before the chore run, or the
convention lives only in AC-7's comment and AC-7's test until someone wants the entry. The criteria
above are written so that neither answer changes them.

**OQ-3 — Where does the guard live, and what does it cost turbo? (Non-blocking. Owner:
implementer.)** Recommend `packages/shared/src/project.test.ts`, which already holds the corpus
helpers and already reads both shipped configs. `packages/shared/turbo.json` already declares
`../../harness/harness.yaml`, `../../spike/templates/harness/harness.yaml` and `../../spike/src/**`,
so AC-1, AC-4–AC-7 need no new input. **AC-2 does:** it reads
`packages/core/src/adapters/adapters.ts`, which is not among shared's declared inputs (only
`../core/package.json`, `../core/src/index.ts`, `../core/src/backlog/project.ts` are). That file
must be added to `packages/shared/turbo.json`'s `test.inputs` **and** registered in
`packages/core/src/turbo-inputs.test.ts`, or the guard passes from a cache hit taken over a changed
default — Q-0072's rule, and the interaction Q-0070's requirement named as the one nobody flags. The
precedent for a shared test reading a core file as text already exists at `project.test.ts:110`.
AC-10's assertions over `harness/port-charter.md` need the same treatment; that path currently
appears in `turbo-inputs.test.ts:280` as *"named in doc comments in both packages, opened by
neither"*, which stops being true.

**OQ-4 — What tells an adopter whose copy is already wrong? (Non-blocking. Owner: human / M6.)**
`harness init` copies once and never revisits. Nothing here reaches a copy already on disk. Options
are a README note, a `harness init --check` in M6's cold-clone work, or accepting it. Recommend
accepting it and recording the fact, since the wrong spelling is a silent no-op rather than a
failure, and the population of adopters is currently zero.

**OQ-5 — Should `adapters.mock.delayMs` be declared in `adapterConfigSchema`? (Non-blocking. Owner:
implementer.)** It is read (`mock.js:67`, `mock.ts:106`) and undeclared. It appears in neither
shipped file, so AC-4 never sees it and nothing is wrong today. Recommend **leaving it undeclared**
and noting it in AC-8's replacement comment: declaring it is one line, but it is the mock's key
rather than an adopter's, and adding a key the requirement did not ask for is exactly what the
implementer's role forbids. Raised so a reviewer reads it as a decision rather than an oversight.

**OQ-6 — Does `docs/06-development-plan.md`'s Q-0058 entry get rewritten by this run?
(Non-blocking. Owner: human.)** `docs/` is inside the implementer's paths, so it *could*. Every port
child's plan entry has been rewritten by hand at close (Q-0052, Q-0053, Q-0054, Q-0057, Q-0080).
Recommend keeping that: it is the human's closing act and would collide with the implementer's write
otherwise. No criterion names it.

---

## Risks

**R-1 — The uncommenting step mis-parses prose as configuration.** Both files are more comment than
config. Mitigated by AC-6: only a comment whose body is a `key:` mapping is restored, a restored
line that does not parse fails the test, and the per-file count is pinned — so a prose line
accidentally matching, or an example line silently skipped, is loud rather than invisible. *"No
silent caps"*: a guard that quietly reads two of three examples reports coverage it does not have.

**R-2 — AC-4's guard loses its subject after the fix.** Before AC-1 both shipped files fail it;
afterwards its only subject is a fixture. Mitigated by AC-5 requiring the pre-fix text to be
retained as a fixture and demonstrated red, rather than the red being observed once and discarded.
This is the exact failure mode Q-0069 and Q-0071 each cost a round to.

**R-3 — AC-2's oracle silently matches nothing.** A regex over `withRetry`'s parameter list that
stops matching after a refactor would extract zero defaults and compare zero fields, passing.
Mitigated by AC-2 requiring the extraction to throw on no match — the `corpus.ts` house rule that
a reader fails loudly rather than reporting a pass over nothing.

**R-4 — The convention in AC-7 is stated by this ticket and ruled by nobody.** If OQ-1 goes the
other way after implementation starts, AC-7's test enforces a rule the project has rejected. This is
why OQ-1 is blocking and settled at the gate rather than in review.

**R-5 — `harness/Q-0058/integration` does not exist.** `git branch --list 'harness/*'` returns
nothing in this repository today. `chore.yaml`'s `review` step diffs
`harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later, creates
the left endpoint. Charter §8's first checklist item is live: the branch must be created by hand
before the **chore** run. It is not a precondition of this requirements run. Since Q-0038, a
first-pass run refuses in the preflight rather than billing the implementer first — so this costs a
restart rather than the $13.86 it cost Q-0035 — but it still costs a restart.

**R-6 — The change looks trivial and will be reviewed as a typo fix.** Nine of the ten criteria are
about the guard, the convention and the stale pointer; only AC-1 is the typo. A reviewer reading the
diff for "did they fix the spelling" will approve a change that has silently dropped AC-5's
demonstration or AC-6's pin, both of which are invisible unless run. Stated here so the review has
been warned in writing, which is the cheapest available mitigation.

**R-7 — AC-10 edits a governance document.** `harness/port-charter.md` is live and its §3 is enforced
by CI. AC-10 touches §10's prose only — a proposal about an id, not a rule — and leaves the
machine-readable block at `:264–265` and every enforcement clause untouched. If a reviewer reads a
charter edit as out of scope, the answer is that the wrong pointer is injected into this ticket's own
implement step and names this ticket as the cutover.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example here accepts or mentions a key. The example line's trailing sentence (*"never auth or model errors"*) is preserved unchanged. |
| **Worktree safety** | n/a — nothing here writes to a working tree. The chore run's implementer writes in its own worktree as always. |
| **Gate behaviour** | Unchanged. No flow, role or gate is edited. OQ-1 and OQ-2 are answered at *this* requirements gate, not by a step. |
| **File format and its schema** | This is the ticket's subject. `harness/harness.yaml`'s key spellings change in a comment only; `projectConfigSchema`'s declared shape is unchanged, and two of its constituents become exported (AC-3). No file the product writes back is affected — nothing writes `harness.yaml`, which `project.test.ts:33–41` already records. |
| **Lint rules** | No `harness lint` rule is added or changed; `lintFlow` does not read `harness.yaml` in either tree. The new guard is a Vitest assertion in `packages/shared`, visible at `integrate` because it runs in `commands.test`. |
| **Cold-clone impact** | Net positive and bounded. The retry example gains one field and the file gains at most two lines of prose (AC-7). An `adopter` who uncomments the line now gets the behaviour the line describes, which is the first 30 minutes getting *more* trustworthy rather than longer. |
| **Port freeze** | No `spike/src/` file is touched, so no freeze-SHA re-record is owed. Q-0058 is not in `children:` (`harness/port-charter.md:264`), so the branch-scope job reports this branch out of scope rather than passing silently — the Q-0038 / Q-0057 precedent. |
| **Both trees** | Does not apply. The Q-0066 / Q-0068 / Q-0070 constraint governs a *behaviour* change that would leave the port and its witness disagreeing; here both trees already read camelCase and neither changes. |
