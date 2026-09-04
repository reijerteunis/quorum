---
id: Q-0099
title: CLI board and adapters, the two commands that always exit 0
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0099/integration
priority: p2
created: 2026-09-03
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-04T09:33:27.180Z
    cost: 12.811
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-04T10:23:58.559Z
    cost: 38.939
---
**Split from Q-0091 at its requirements gate on 2026-09-03**, where the merged requirement measured
**21 criteria against a ceiling of fifteen** and the head-of-product loop exhausted at limit 1 with
the split as its first finding. Q-0091 keeps `lint` and `validate` (AC-1 to AC-13); this ticket takes
`board` and `adapters` (AC-1 to AC-8, numbered from 1 because a new ticket starts its own numbering).
**Runs after Q-0091**, which decides the module layout, moves the five guards, adds the two barrel
symbols and settles the register's shape — after which this ticket *extends* four registers whose
form is already ruled.

**The body below is Appendix A of
`backlog/Q-0091-cli-read-only-commands-board-lint-valida/requirements/merged.md`, transcribed in
full rather than referenced**, because `input.backlog` resolves against **this** folder and nothing
injects a sibling's document into this ticket's run.

**Why it is separate.** The seam is in the spike source: `board` (`harness.js:398`) and `adapters`
(`:425`) end in `return;` and can only exit 0, where `lint` and `validate` carry an exit-code
contract. Q-0091 landed the guard migration, the two barrel symbols and the register's shape against
the smallest command surface; this ticket extends four registers whose form is already ruled.
**Runs after Q-0091.** Ground rules 1 to 5 of Q-0010 apply verbatim and must be copied into the
body, because a child cannot read its parent.

**Measured, and not to be re-derived from Q-0010's body:** `board`'s whole binary half is
`q0036-board-containment.js` (220 lines, scenarios C1–C10) plus one row at `q0033-surface.js:342`.
**`adapters` inherits nothing** — the single occurrence of the string in `q0033-surface.js` is
`:249`, a flow-lint scenario about review panels spanning two adapters, not the command; its only
inherited proof is `smoke.js:126–132`, which is Q-0095's. So every `adapters` assertion is new.
`board` reaches `loadFlow` (`harness.js:355`) and **not** `currentBranch`, which is defined at `:287`
and called only at `:326` inside `init`.

**AC-1 — the frame registers `board` and `adapters`.** As Q-0091's AC-1, for the remaining two
names and their help lines, with `adapters`' line carrying `[--probe] [--json]`. The spike's
`CLIs installed + no API keys` may not survive as written; the word is **subscription**.
*Test:* each pin shown red against the value Q-0091 left.

**AC-2 — the columns and the hint.** Every stage of `@quorum/shared`'s `STAGES`, in that order, its
name bold-padded to 14 characters; an empty column is skipped **except** `draft`, `requirements` and
`solutioned`, which always render; a column whose stage some flow `consumes` carries the dim hint
`→ harness run <flow> <id>` (the binary name in it is Q-0091's OQ-2 ruling). `board` reaches the
flow set through `lintFlowDirectory(path.join(harnessDir, 'flows'))` (`lint/lint.ts:283`), keeping
the records that carry a `flow`, rather than re-implementing the spike's `readdirSync` + `loadFlow` +
`catch`; a missing `flows/` directory yields no hint rather than a raw `ENOENT`.
**A ruled divergence, registered as one:** the spike's `readdirSync` order is unspecified,
`lintFlowDirectory` sorts, and `chore.yaml` and `solutioning.yaml` **both** `consume: requirements`,
so that column's hint is order-dependent today. Measured on this machine `readdirSync` already
returns sorted order, so `chore` wins under both and no rendered byte moves; what changes is a
latent non-determinism.
*Test:* the rendered column set over a two-stage fixture; the `requirements` hint asserted to be
`chore` over the six shipped flows with the reason carried in the assertion; and a fixture with no
`flows/` directory rendering and exiting 0.

**AC-3 — the ticket row, byte for byte.**
`  <teal id> <title>  <dim>owner=<owner> cost=$<n.nn> iter=<json><token></dim>`, with `cost` the sum
of `history[].cost` to two decimals and `iter` `JSON.stringify(meta.iterations ?? {})`.
*Test:* the assertions `q0033-surface.js:342` **actually** makes — `/iter=.*review.*2/` and
`/cost=\$1\.25/` after ANSI stripping, over a fixture that rewrites `iterations` and appends two
history rows. The `owner=qa cost=$0.00 iter={}` form one Q-0091 candidate cited exists nowhere under
`spike/test/`; a zero-cost, empty-iterations row is asserted in full instead, so both ends of each
format are covered.

**AC-4 — containment is rendered in the glossary's vocabulary and nothing else.** One token per row,
inside the dim span: ` <base>:contained`, ` <base>:not-contained(+<n>)`,
` <base>:indeterminate(<reason>)`. `<base>` is read from `config.repo.base_branch`, defaulted to
`main` at the reading site and never substituted for a different configured value. The board says
"contained" and never "merged", "landed" or "shipped". A `no branch` result renders **only** at
`solutioned`, `red`, `green`, `reviewed`, `qa-passed`, `deployed`, and is suppressed at `draft`,
`requirements`, `blocked`, `abandoned` and wherever `containment` returned `null`. `board` passes
the branch value through `core`'s interface and constructs no git argument itself.
*Test:* `q0036-board-containment.js` C1–C10 translated in full — contained; `not-contained(+2)`
counting `base..branch` and never the symmetric difference; C10's ten-stage sweep; an absent
`branch:` key; a missing base ref; a genuinely shallow clone; a non-git project; a `master`-based
project where the string `main` appears nowhere; the `--upload-pack=` injection value, asserted to
add no git option and create no file; and a tag sharing the branch name.

**AC-5 — the two legends, each printed only when a row earned it.** The cost legend prints when any
ticket has a non-empty `history` and carries the tokens-only qualification; the indeterminate legend
prints when any *rendered* row was indeterminate, exactly once, naming all four reasons and that
indeterminate does not mean the code is missing.
*Test:* C4's `output.split('git could not answer').length - 1 === 1`, plus a no-history fixture
asserting the cost legend absent and a with-history one asserting it present.

**AC-6 — `adapters`: presence, probe and JSON.** For `claude` then `codex` in that order:
`✓ <name>: <version>` on a successful `check()`, `✗ <name>: <message>` on a throw, the failing
adapter contributing `{ adapter, installed: false, error }` and the loop continuing. Without
`--probe`, `probeAdapter` is **not called**, successes record `login: 'unverified'`, and the dim
presence-only notice prints. With `--probe`, each successful check is probed with the resolved
`repoDir`, and an indented second line reads `✓ login verified — round-trip <ms>ms`, plus
`, $<cost to 4dp>` when `cost_usd` is non-null and `, <n> tokens` when `tokens` is truthy, or
`✗ login not usable: <error>`. With `--json`, `{ probed, adapters }` at two-space indent **after**
the human lines, which is deliberate and not a JSON-only stream.
*Test:* driven against a stubbed `getAdapter`/`probeAdapter` so no vendor CLI is required — present,
absent, probe ok, probe failed, `cost_usd: null` (which must not render `$0.0000`), `tokens: 0`, and
both flags together. There is no inherited coverage to translate: every assertion is new.

**AC-7 — BYOS, and the three defects reported rather than fixed.**
(a) No file anywhere in `packages/cli` matches any pattern in `frame.source.test.ts:227`'s
`CREDENTIAL` list. The refusal is `core`'s `check()` and the CLI's only job is to render the message
it throws, verbatim. **The test proving that rendering creates no key never spells one:** it makes
`check()` reject with a sentence the test does not have to know, and asserts the CLI reproduces
whatever the adapter threw.
(b) The refusal still says *"Harness runs on subscription OAuth only"*. **Q-0068's** — the CLI must
not rewrite it on the way through, and a test pins that it reaches the terminal unaltered.
(c) **`adapters` exits 0 even when both CLIs are absent** (`harness.js:424` `return`s). Preserved
and registered with an authority line rather than carried silently: an adopter's CI step running
`quorum adapters` reports success on a machine with no vendor CLI at all.
(d) **Q-0066's crash** — `probeAdapter` dereferencing a null `usage`, so a perfect login answers
`✗ login not usable: Cannot read properties of null` — preserved and not caught in passing.
*Test:* a case asserting exit 0 with both adapters failing, whose name and comment say the zero is
preserved and name the successor.

**AC-8 — both commands write nothing, and the four registers are extended in the same change.**
`main.test.ts`'s `INVOCATIONS` gains `board` and `adapters` (the latter against a stubbed registry)
and the byte-identical property holds; the per-module symbol map gains `board.ts` and `adapters.ts`;
the `node:path` admission covers them; and `binaryCarriedBy` is applied to
`q0036-board-containment.js`, whose whole binary half this ticket carries. **`adapters` moves no
register entry**, because no `spike/test/` file outside `smoke.js` exercises it — stated in the
entry rather than left as a silence. The four pinned totals (220 / 2739 / 2469 / 5428 and 55%) are
re-derived and shown unmoved.

**Risks it inherits:** the `board` fixtures **cannot use `quorum init` or `quorum ticket new`**,
which is how `q0036-board-containment.js` builds all ten of its projects — both are Q-0093's. Build
the project directly (write `harness/harness.yaml`, as `main.test.ts`'s AC-8 fixture already does)
and create the ticket with **`Backlog.create()` from `@quorum/core`**, the same code path
`ticket new` will call, so the frontmatter stays *"exactly what the product writes"*, which
`q0036-board-containment.js:44–46` asks for; hand-written YAML loses it. And a shallow clone or a
missing ref must never be reported as `not-contained` — turning missing evidence into a negative
claim is the failure the glossary's three-state vocabulary exists to prevent, so AC-4's C4 and C5
assert the *reason token* rather than the absence of `contained`.

---

## 11. Provenance

**The Claude candidate is the base**, and its §0 is why: it was written against the tree rather than
against the ticket body, and all four of its corrections survived re-measurement in both iterations
— the 476/220 line counts, the five-file coverage spread, `currentBranch` belonging to `init`, and
`readData`/`ProjectNotFoundError` missing from the barrel. Its decisive contribution is M-5: reading
`admissible()` and `audit()` and finding ground rule 5 **unsatisfiable** without a schema change is
the kind of finding that would otherwise have arrived as a failing test in review round 2. Taken
largely intact: the guard inventory and its three re-scopings (AC-10 to AC-12), the renderer
retirement (AC-9), the `flowsDir` alternative registered as rejected, the fixture strategy in
Appendix A, and OQ-2 and OQ-5.

**The Codex candidate contributed four things Claude did not have**, each folded in by name: the
single-read property — `validateArtifact` called exactly once per artifact, never re-reading to
select a semantic check — which is what Q-0037 AC-9 exists to pin and is now in AC-8; the
structurally-invalid run manifest that must **not** print the skip notice, also AC-8 and confirmed
against `validate-artifact.test.ts:215–217`; the packed-install non-regression, now a cross-cutting
row rather than a criterion because Q-0098's fixture already guards it; and the machine-dependence
risks that became R-6. Its non-goals list was the more exhaustive of the two and §6 is largely its
shape.

**Where they disagreed, and how it was ruled.** Codex's 38 criteria are not a larger scope but the
same scope restated — seven of them are one rendering rule, and several assert `core` behaviour
(Q-0059's `dirOf`, the BYOS refusal ordering) that no CLI test can reach; they are compressed into
Appendix A's AC-4 and AC-7. Its AC-1 (*"appears in CLI help with its supported arguments and
flags"*) is not independently testable and is replaced by the compile-time coupling through
`Record<Command, CommandHandler>`. **Its AC-16 is struck outright** (M-9) and routed to Q-0094.
Its open question 1 — *what are the real line totals?* — is answered here by measurement rather than
deferred to the implementer, which is where a question with a `wc -l` answer belongs. Where the two
disagreed on `project.test.ts`'s line, **Claude was right and iteration 1's merge was wrong** (M-10).

**What iteration 2 changed, and what it did not.** It changed **nothing about the design**: the
seam, the two groups, the criteria and every measurement are iteration 1's, re-verified rather than
revised. It changed the **shape**: §5 is now the ticket rather than a partition of a larger one, and
the successor's body is Appendix A rather than a second half of §4, so an implement step reading
this document under `advance` builds thirteen criteria and the deferred obligation survives in
writing. And it re-ran every load-bearing measurement rather than inheriting it — which found two
citation errors iteration 1's own merge had introduced while correcting a third (M-10). That is
*"a measurement copied from a document is not a measurement"* arriving inside the instrument written
to enforce it, and it is the argument for the re-run rather than for the iteration.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. Q-0010's children are not in `harness/port-charter.md`'s
   `children:` list, so the branch-scope job reports them out of scope rather than failing them —
   the rule is this body's, not the guard's. If a change there is genuinely required, stop and say
   so; it takes §3's mirror-and-re-record path and is a decision, not a step.
2. **The spike's own tests are not deleted or edited to make room.** A child *adds* coverage under
   `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059's
   traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash and Q-0068's product name
   in the BYOS refusal are open tickets landing in both trees; do not close one here. **Q-0100** now
   carries the three user-facing sentences that name a binary called `harness`, including the
   board's own hint — preserve them verbatim.
4. **`packages/core` already holds the logic.** `containment`, `lintDirectory`, `lintFlowDirectory`,
   `getAdapter` and `probeAdapter` are all exported from `packages/core/src/index.ts` — verified at
   Q-0091's gate. If something appears to need porting, look there first and say so if it is
   genuinely absent; the CLI is a presentation layer over an API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change**, with its line totals
   **re-derived rather than adjusted**. Use the `binaryCarriedBy` field Q-0091 adds — see GO-2.

## Gate obligations

**GO-1 — Q-0091 must be `reviewed` before this ticket's chore run.** It lands the guard migration,
the barrel symbols and the register schema this ticket depends on. Running the two concurrently is
refused for a second reason: Q-0039 is unfixed, so two runs on one ticket share a worktree and
compute the same run id.

**GO-2 — the register schema is Q-0091's ruling and is inherited, not re-litigated.** Ground rule 5
was **unsatisfiable as written** for `q0036-board-containment.js`, verified structurally at Q-0091's
gate: `admissible()` (`spike-parity.test.ts:887`) permits a binary-spawning file that imports no
spike source **only** the verdict `cli`, and `audit()` (`:945`) fails a `cli` entry that names
counterparts — so no edit could record a translated binary half, and the register would go on
reading "the work is still owed" after it had been done. Q-0091 adds
`Entry.binaryCarriedBy?: readonly string[]`, permitted on `cli` and `split` and validated exactly as
`carriedBy` is. Use it; do not add a fourth verdict.

**GO-3 — `harness/Q-0099/integration` must exist before the first chore run**, per
`docs/02-sdlc-pipeline-spec.md` §5.8: `review` diffs against that branch and only `integrate`, which
runs later, creates it. A first-pass run refuses in the preflight rather than billing (Q-0038).

**GO-4 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on has
no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31); the remedy is
an erratum written **during** the loop, as soon as the contradiction is provable.

## Non-goals

- `lint` and `validate` — **Q-0091's**, and it runs first.
- `runs` — Q-0092's · `init` and `ticket` — Q-0093's · `run` and the gate reader — Q-0094's.
- The three user-facing sentences naming `harness` — **Q-0100's**; preserve them verbatim here.
- The BYOS refusal's product name — Q-0068's, and distinct from Q-0100.
- Any change to `spike/`.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, split from **Q-0091**.
