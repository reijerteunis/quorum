---
id: Q-0037
title: Run-history review remainder — one major and eight nits
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0037/integration
priority: p3
created: 2026-08-24
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-31T22:40:57.336Z
    cost: 8.587
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-01T00:13:13.188Z
    cost: 44.539
---
Opened under AC-2 of Q-0034, which allows review findings to become follow-up tickets rather than
forcing another revise loop on a branch that is already stale. These are what survived Q-0011's two
review rounds (`backlog/Q-0011-run-history-on-disk/review/round-2/`) when it landed on `main`.
Nothing here blocks the feature; all four blockers and thirteen of fourteen majors were closed
before landing.

**The one major.** `runGate` holds a one-second `setTimeout` that exists only to keep a hanging-gate
test fixture alive — a TTY gate owns a readline handle and a non-interactive gate throws before
awaiting, so neither shipped path needs it. After the second elapses the loop can drain and the
process exit 0 with the manifest still reading `running`.

**Eight nits**, all from round 2 and cited by file: the stage guard in `initialiseRunHistory` is
unreachable through the CLI; every terminal occurrence re-serialises the whole manifest and `fsync`s
it, so cost is quadratic in occurrence count on a path every integrate step runs (unmeasured); a
`manifest.json.tmp` survives a `SIGKILL` between write and rename and nothing names or cleans it;
the per-step `usage:` line reuses `formatVendorSummary` with a synthesised `unpriced_steps`, printing
a roll-up field on a single occurrence and collapsing four measures into one total; `readData`
re-reads and re-parses a file `validateFile` parsed a line earlier; the validator's skip notice names
run-manifest checks for every schema, so validating an unrelated contract prints "run-manifest
semantic checks skipped"; and `vendorTokenTotal` returns null when input and output are both null
while the cache fields are populated, printing `tokens=n/a` beside real counts.

**One is Quorum's own record.** The `x-quorum-contract` decision entry sat mid-file in
`docs/DECISIONS.md` rather than appended, which `.claude/rules/docs-and-decisions.md` calls
append-only. It arrived there from the Q-0034 merge, which unioned two append-only files and
preserved date order at the cost of position.

---

## Re-measured against both trees on 2026-09-01, before this ticket's requirements run

**Everything below supersedes the four paragraphs above where they disagree, and they do disagree.**
The body was written on 2026-08-24 against one tree. The port closed on 2026-08-31, Q-0045 answered two
of these nits on its way through, one was closed before landing and one has been dissolved by a
change to how decisions are stored. **Do not re-derive the list from the paragraphs above** — the
count of eight is right only if the DECISIONS item is counted among them, and one of round 2's nine
is missing from them entirely.

### The major is this ticket's outright, and its escape route is closed

The previous revision of this body said the timer "is already invited to be fixed by Q-0052, whose
new Vitest fixtures do not inherit the frozen-`spike/test/**` constraint that blocked it here".
**That invitation was spent and declined**, recorded out of band at
`backlog/Q-0052-core-engine-agent-gate-script-steps/runs.log:17` on 2026-08-30: *"the signalWindow
invitation is SPENT and askGate's 1-second timer is permanently preserved … This is the third
consecutive decline — Q-0050, then R-7, then this gate … Q-0037 still carries the underlying
finding."* The reason it was declined is the one worth carrying into the requirement: a sibling
reversing a landed preservation with no test needing it gone is the quiet fix charter §2 exists to
stop. **This ticket is the one that may do it, because removing it is this ticket's subject rather
than a side effect of one.**

What it costs, measured today rather than estimated:

- `spike/src/engine.js:614` — the `setTimeout`, with its ten-line comment.
- `spike/test/q0011-run-history.js:227` — the fixture the timer exists for. Its gate is
  `gate:()=>new Promise(()=>{})`, a promise owning no libuv handle, and the scenario then spawns a
  child, waits for a manifest and `SIGTERM`s it. **Give that promise its own handle and the engine's
  timer has nothing left to do.** The `spike/test/**` freeze that blocked this in August was
  Q-0011's qa-red artifact rule, not the port freeze; Q-0062 re-aimed four assertions in
  `spike/test/smoke.js` on 2026-08-31, so the constraint the original comment names is gone.
- `packages/core/src/engine/routing.ts:27` — the ported copy, carrying
  `// Why: preserved defect, see Q-0050 AC-4.` **In `core` the timer's stated purpose does not
  exist**: its comment says it holds libuv open for the signal path, and Q-0050's AC-5 removed
  signal handling from `core` entirely — cancellation is the caller's `AbortSignal`. It is dead
  weight there in a stronger sense than in the spike.
- `packages/core/src/engine/q0050.source.test.ts` — **three pins move together or the suite is
  wrong**: the `AC-4h` test at `:127–131` asserting the marker and the literal `1000`; the
  `REGISTERED` entry `'routing.ts': ['preserved defect/AC-4', …]`, which is a `toStrictEqual`
  identity register and not a count; and the arithmetic comment below it that says how many of the
  authority lines are Q-0050's own. Deleting the line and leaving the register is a red suite;
  deleting both and leaving the comment is a true record made false, which is the third of R-7's
  four reasons.

### The nits, each re-measured in both trees

| # | Round-2 nit | `spike/` | `packages/core/` |
| --- | --- | --- | --- |
| 1 | stage guard in `initialiseRunHistory` unreachable from the CLI | present, `engine.js:373–382`, and **undocumented** | **already ruled — keep.** `run-history/writer.ts:230` preserves it with `Why: preserved as-is, see Q-0037 — unreachable from the command line … and reachable from a caller that builds a ticket record itself, which is what the daemon will be` |
| 2 | every terminal occurrence re-serialises the whole manifest and `fsync`s it | present, `engine.js:478` | present and identical, `run-history/writer.ts:289` |
| 3 | a `manifest.json.tmp` survives a `SIGKILL` between write and rename | present, same function | present and identical, same function |
| 4 | the decision entry sits mid-file in `docs/DECISIONS.md` | **dissolved** — see below | n/a |
| 5 | per-step `usage:` line reuses `formatVendorSummary` with a synthesised `unpriced_steps` | present, `bin/harness.js:258` | **no counterpart.** `packages/cli` does not exist until Q-0010 |
| 6 | `authErrorCategory(vendor, message)` never uses `vendor` | **closed** — the function was deleted with round-2 major 11 before Q-0011 landed. It is absent from both trees, and it is the round-2 nit the paragraphs above omit | n/a |
| 7 | `readData(f)` re-reads a file `validateFile` parsed a line earlier | present, `bin/harness.js:522` | **already fixed.** Q-0045's `validateArtifact` reads each file once and its JSDoc names this ticket's subject: *"read count is internal and charter §2 does not preserve it, and reading once removes a race between the two reads rather than changing any outcome"* |
| 8 | the skip notice names run-manifest checks for every schema | present, `bin/harness.js:519` | **the mechanism is already there.** `SemanticOutcome` returns `{ contract: null, ran: false, reason: 'unrecognised-annotation' }`, so a caller can phrase the notice generically without inferring anything. Only the wording is owed, and only on the spike's CLI |
| 9 | `vendorTokenTotal` returns null when both totals are null while the cache fields are populated | present, `bin/harness.js:198` | present and identical, `run-history/reader.ts:184` |

So the live set is **one major plus seven items, not eight**, and it is three different shapes rather
than one list:

- **both trees together** — the major, and nits 2, 3, 9. The Q-0066 / Q-0068 / Q-0070 shape.
- **`spike/` alone, because `core` has already answered it** — nits 7 and 8, where the requirement's
  job is to decide whether the spike's CLI is worth changing at all when `packages/cli` will inherit
  `core`'s answer, and nit 5, which has no counterpart to inherit yet.
- **a documentation alignment rather than a code change** — nit 1. `core` carries the ruling and the
  spike carries the same guard with no note saying why it stays. One of the two is misleading a
  reader and it is not the ported one.

**Nit 9 may be a ruling rather than a fix, and the requirement should say which.** The cache measures
are a breakdown and never summands — the adapter folds both into `input_tokens` before a manifest
sees one — so a row with both totals null and cache fields populated is a *malformed* manifest, and
`tokens=n/a` is arguably the honest answer for it rather than the defective one. Round 2 itself
noted it is reachable only from a malformed manifest. Deciding it costs a sentence; fixing it without
deciding it changes a number in the one place run history exists to report.

### Nit 4 dissolved, and what survives it is a question the rule cannot answer

The entry is now `docs/decisions/031-product-level-schema-annotations-select-semantic-validation.md`,
one file among many since *"A decision is a file; this page is the index"* (2026-08-28). **There is no
mid-file position left to be wrong**, and the entry's own date is defensible: it was authored on the
Q-0011 implement branch at `8a9ac0f` on 2026-08-23 and reached `main` through the Q-0034 merge on
2026-08-24, so the date records when it was decided rather than when it landed.

What survives is the general question the previous revision of this body raised, one layer up and
unchanged by the split: `docs/DECISIONS.md` is *"append-only, newest last"* and is also grouped by
date, and **the two cannot both hold** for an entry written on one date that lands after entries
written later. The index would take that entry's line under an earlier date heading, which is
mid-file by another name. `packages/shared/src/docs.test.ts` fails if the index and the folder
disagree, and asserts nothing about order.

**This owes a decision entry, and no step on this ticket's route may write one.** That is the
precondition-external-to-the-document shape that has now exhausted a loop eight times in this
repository — Q-0069, Q-0070, Q-0079, Q-0062 among them, the last of which had the hazard named in
its own requirement and was launched anyway. It is named here as a **gate action**, to be settled
before an implement step starts, and deliberately not as a criterion.

### Which trees, settled by events rather than by choice

The previous revision left this open: *"re-targeting at both trees is the recommendation and is
Ruud's call."* The choice no longer exists, and neither of the two options the old
`harness/port-charter.md` §3 offered — *"land in the spike before the freeze, or be re-targeted at
`core`"* — is available:

- **The port closed on 2026-08-31.** All fourteen children are `reviewed` and `main:contained`, so
  every module this ticket touches exists in both trees. A fix in one leaves the port's independent
  witness disagreeing, which is the divergence the freeze exists to expose.
- **The freeze SHA is recorded**, `a6e529a` (§3's machine-readable block). "Before the freeze" is in
  the past. §3's own answer to a `spike/src` change on the base is now a two-step procedure — mirror
  into `packages/core`, and re-record `freeze-sha` in the same commit — and Q-0062 walked it first on
  2026-08-31. §3's stale block naming this ticket as one of five blockers was corrected on
  2026-09-01, in the same session that rewrote this body.
- **The port-freeze branch-scope guard does not bind this ticket.** `children:` is Q-0041 to Q-0054;
  Q-0037 is not among them, so the job reports out of scope rather than passing silently. Q-0038 and
  Q-0057 are the precedent, both of which landed in both trees in one commit without an exemption
  trailer.

So: **both trees together, in one commit, re-recording the freeze SHA** — for the items that have a
counterpart. Nits 5, 7 and 8 do not, and the requirement should not manufacture one; `packages/cli`
is Q-0010's.

Belongs to M2 in `docs/06-development-plan.md`. Small and unrelated to each other, so this is a
good candidate for the chore flow, or for being split further if anyone would rather.
