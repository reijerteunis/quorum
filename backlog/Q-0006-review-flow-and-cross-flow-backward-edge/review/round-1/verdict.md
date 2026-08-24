# Q-0006 — Review verdict, round 1

**Step:** verdict · **Panel:** `code-reviewer` on claude + codex · **Round 1**
**Verdict: changes-requested** — 3 blockers, 5 majors, 3 nits survive deduplication.

---

## 0. Read this before the findings: the panel reviewed an empty diff

The `## Diff to review` section delivered to both reviewers carried an empty `git diff --stat` and an empty patch. This is not a prompt-assembly accident. `harness/Q-0006/integration` has already been merged into `main` and *is* the merge-base (`998f397`), so the three-dot range AC-11 mandates is legitimately empty:

```
git merge-base --is-ancestor harness/Q-0006/integration main   →  true
git diff --stat main...harness/Q-0006/integration              →  (empty)
```

Two consequences, and both matter more than any individual finding below.

**First, this is blocker B1 happening rather than being predicted.** The engine materialised an empty range, spent two paid reviewer calls on it, and handed me — a step explicitly instructed to judge the reviews and not the code — no way to detect that the panel saw nothing. Had the Claude reviewer not reconstructed the change set from branch history and returned findings anyway, the overwhelmingly likely outcome was `approve` with empty findings, advancing `green → reviewed` on zero evidence. That is the closed loop with no outside opinion in it that `requirements/merged.md` §Problem names as the reason this ticket exists, with the additional insult that `review/round-1/` would record a review as having formally happened.

**Second, this round is not a complete review and should not be treated as one.** Claude reviewed a reconstruction; Codex reviewed what it was given, which was nothing plus its own reading of the tree. Reconstruction is not a property this flow can rely on. **The maintainer should re-run this round against a non-empty range before treating the finding list as exhaustive** — the findings below are real, but the absence of further findings proves nothing.

---

## 1. Deduplication and how the panel performed

Codex returned a single finding. Claude returned eleven. They overlap on exactly one:

| Claude | Codex | Resolution |
| --- | --- | --- |
| B3 — `PROBE_SCHEMA` omits `summary` from `required` | major — same defect, same file, same line | **Merged. Kept as blocker.** |

I kept the higher of the two assigned severities. Both reviewers reached it independently, on different vendors, citing the same documented invariant — that is the strongest confidence signal this panel produced, and it is the one finding no reviewer had to reconstruct anything to see. Claude's impact argument is also the stronger one: `adapters --probe` exists because M0 watched `check()` report ✓ on a login that was already dead, so a probe that fails closed on the vendor it was built for is a safety-net regression, not a cosmetic schema slip.

**On the asymmetry.** One finding against eleven is a thin contribution from a panel whose whole premise is cross-vendor critique, and it is worth recording honestly rather than glossing. The likeliest explanation is §0: given an empty patch, the reviewer that did not go looking beyond its prompt had almost nothing to review. That reading is supported by Codex's finding being the one defect visible from the file alone, without any diff. It is a further argument for re-running the round rather than a judgement about the reviewer.

**Verification.** I checked every surviving claim against the code as it stands on `main`, not against the reviewers' assertions. All eleven hold. Note that Q-0033 merged on top of Q-0006, so **the line numbers below are current `main`**, and differ from the `998f397` citations in `review/round-1/claude.md`. Nothing else moved: Q-0033's `run` preflight validates the flow directory, not git refs, so it does not close M5.

---

## 2. Blockers

### B1 — An empty diff range is materialised silently, and the whole panel is billed for it
`spike/src/engine.js:438`

`materialiseDiff` verifies that `repo.base_branch` resolves (`:436`) and that `harness/<id>/integration` exists (`:437`), then embeds whatever `git diff` returns with no check on `stat.trim().length`. Both refs can exist and the range still be empty — after the branch is merged (this run), before any task commits, or if `base_branch` is set to the integration branch itself.

**Impact.** Demonstrated above. Two reviewer calls plus a verdict call against nothing, an audit trail recording a review that did not happen, and a stage advance on no evidence. The requirement anticipated the truncation direction of this risk (Risk 2) but not the empty one.

**Fix.** Fail before the spawn, in the same class and message style as the two ref errors above it — naming `repo.base_branch`, its current value, and the integration branch. Failing costs nothing and preserves AC-12's before-any-agent property. An explicit `## Notice` in the prompt is the absolute minimum alternative, but an empty review is not a cheaper review, it is a false one.

### B2 — A review-specific findings format was added to the generic schema and now binds three other shipped flows
`spike/src/engine.js:367`, enforced at `spike/src/adapters/index.js:187`

`schemaFor` is the schema builder for every step in every flow. The citation pattern `^(blocker|major|nit): .+:[1-9][0-9]* .+` is applied unconditionally to any step declaring `output.verdict`. Four shipped flows do:

| Flow | Step | Enum | Does its role teach the format? |
| --- | --- | --- | --- |
| `review.yaml:33` | `verdict` | `approve\|changes-requested` | yes |
| `requirements.yaml:24` | `head-of-product` | `ready\|needs-input` | **no** |
| `solutioning.yaml:27` | `architecture-review` | `approve\|revise` | **no** |
| `qa-red.yaml:43` | `scenario-review` | `approve\|revise` | **no** |

The contradiction is on disk and citable: `harness/roles/architecture-reviewer.md:8` documents the format that role should use, and its own worked example — *"Task 3 references contracts/billing.openapi.yaml but that file has no downgrade endpoint"* — fails the pattern on both counts, no severity prefix and no line number. `head-of-product` is worse suited still: it is asked for a scoping judgement about a whole document, not a citation.

**Impact.** The next real `requirements` run returning `needs-input`, and the next `solutioning` or `qa-red` round returning `revise`, hard-fails on `"findings" item has invalid format` after the vendor has been billed. Three of four shipped flows lose their rejection path. `review-artifacts.schema.json` is scoped to review artifacts; applying it globally exceeds what the contract asks for.

**Why the suite missed it.** `Q0006-mock-switch` emits a conforming finding for *all* verdict schemas, so every flow's mock run passes. This is `requirements/merged.md` Risk 6 landing exactly as written.

**Fix.** Derive from the declared enum — only review declares `changes-requested` — or add an explicit opt-in flow field set in `review.yaml` only. Either way add a test that a `ready|needs-input` step accepts a prose finding; the current suite cannot distinguish the two designs.

### B3 — `PROBE_SCHEMA` breaks the codex strict-mode rule the repository documents *(both reviewers)*
`spike/src/adapters/index.js:133`

```js
properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
required: ['ok'], additionalProperties: false,
```

`summary` is declared but not required. The comment at `:128-129` states the rule being broken and `docs/03-adapter-contract.md:140-141` records it as verified fact: codex enforces OpenAI strict structured outputs, every property must appear in `required`. `schemaFor` complies (`engine.js:364-368` pushes every property onto `required`); this schema no longer does, and it goes straight to `codex exec --output-schema` via `probeAdapter` (`:144`).

**Impact.** `harness adapters --probe` is the one command that proves a subscription answers before a paid multi-step run starts. If codex rejects the probe schema, the safety net fails closed on the vendor it was built for.

**Standard of evidence.** Neither reviewer verified this against the live CLI — a probe is a paid round-trip and this is a read-only review. The citation is the repository's own previously-verified invariant, which is sufficient to act on given a one-line fix.

**Fix.** `required: ['ok', 'summary']` — this also preserves the evident intent, which is to stop `additionalProperties: false` from rejecting a vendor that volunteers a summary. Then run `harness adapters --probe --json` against both CLIs and save the report in the ticket folder. A claim about strict-mode behaviour should not ship on inference, the panel's included.

---

## 3. Majors

### M1 — `interrupted` is written to ticket history, and the frozen state schema forbids it
`spike/src/engine.js:41`, history push at `spike/src/engine.js:316`

`finish` now appends a history entry for every outcome, not only `completed` and `regressed` — correct for AC-22. But the signal handler calls `finish(ctx, ticket.meta.stage, 'interrupted', …)`, and `contracts/Q-0006/ticket-review-state.schema.json:23` constrains history `status` to `completed|regressed|exhausted|aborted|failed`. Every Ctrl-C now writes frontmatter its own frozen persistence contract rejects, and `grep -rn interrupted spike/test/ contracts/Q-0006/` returns nothing, so no test can see it.

**Fix.** The contract is frozen, so pick one explicitly: map the signal path to `aborted` (leaving `runs.log` free to say `interrupted`), or add erratum E-4 admitting `interrupted` to the enum in the form of E-1. I lean to the erratum — a signal and a human choosing `abort` are genuinely different events, and the Q-0004 decision names all four terminal outcomes including `interrupted`, so the schema is simply behind. Add the covering test either way.

### M2 — The cross-flow regression report hard-codes the counter name `review`
`spike/src/engine.js:61`

`handleFail` resolves the counter generically (`:256`, `f.counter ?? '${flow}.${step.id}'`) but the report reads `ctx.counters.review` literally. The shipped flow declares `counter: review`, so it is correct today by coincidence. Any other flow with a `goto: flow:<name>` under a different counter reports `count: undefined` and `remaining: limit` — telling the operator they have their full budget at the moment they spent some of it. This lands in Q-0012, whose `qa-final.yaml` regresses cross-flow and will not use a counter called `review`. It also sits oddly beside AC-13, which derives the regression stage rather than hard-coding it: the stage is derived, the counter beside it is not.

**Fix.** Return `counter` on the result from both `handleFail` and the retry path, and read `ctx.counters[res.counter]`.

### M3 — The UTF-8 trim discards the patch from the first invalid byte while claiming it truncated at the limit
`spike/src/engine.js:444`

```js
while (bytes.length && Buffer.from(bytes.toString('utf8')).compare(bytes) !== 0) bytes = bytes.subarray(0, -1);
```

The round-trip comparison is over the **whole** buffer, so any invalid UTF-8 anywhere in the first `limit` bytes never round-trips and the loop trims all the way back to it. Claude reproduced the three cases: a single latin-1 byte ten bytes into a 32-byte window reduced it to ten bytes after 22 trims; ASCII kept 32; a split character kept 31. At the shipped `max_diff_bytes: 200000`, one stray non-UTF-8 byte early in a large diff silently discards everything after it.

**Impact.** Reviewers get a patch truncated far below the configured limit, under a notice at `:447` stating the opposite, with nothing in `runs.log` distinguishing it from ordinary truncation. It only fires on diffs over the limit — the forty-file ticket of Risk 2, exactly the case where a reviewer is least able to notice material is missing.

**Fix.** Trim at most three bytes (all a split sequence can require) and let interior invalid bytes become replacement characters; report the real kept length in both the notice and the `runs.log` line.

### M4 — The verdict/findings coupling hard-codes review's enum values
`spike/src/adapters/index.js:192-193`

The coupling tests the literal strings `approve` and `changes-requested`, while `schemaFor` already states the general rule to the vendor — *"Empty when the verdict is the first option"* — and the enum is available on the schema object being checked. Enforcement across shipped flows is therefore partial and silently so:

| Flow | pass + findings caught? | fail + no findings caught? |
| --- | --- | --- |
| `review` | yes | yes |
| `solutioning`, `qa-red` | yes | **no** |
| `requirements` | **no** | **no** |

So `head-of-product` can return `ready` alongside a list of blockers and the engine advances the ticket to `solutioned` — the exact routing bug the DECISIONS entry *"Step-output validation is Quorum's contract with its own agents"* was written to close, still open in the flow that gates every other flow.

**Fix.** Derive both halves from `schema.properties.verdict.enum` (first option = pass). Fix together with **B2**, or `requirements` gains an enforced coupling on findings it cannot format.

### M5 — AC-12's "before any agent is spawned" holds by step ordering, not by construction
`spike/src/engine.js:431`, called from `buildPrompt` at `:387` inside `runAgentStep`

The ref preflight lives inside `materialiseDiff`. For `review.yaml` as shipped the guarantee holds — the panel is step 1, and both parallel members call `buildPrompt` before either reaches `adapter.run`. But it is satisfied by position. Put any agent step ahead of the diff step — a triage step, a context step, the `qa-final.yaml` Q-0012 will write against this same machinery — and a missing `repo.base_branch` is discovered only after that step has been spawned and billed. I confirmed that Q-0033's `run` preflight (`spike/bin/harness.js:212`) validates the flow directory, not refs, so it does not cover this.

**Impact.** An acceptance criterion that reads as a structural guarantee is a positional coincidence, in an engine whose stated value is that safety properties hold by construction. It will regress silently the first time someone reorders a flow.

**Fix.** Resolve and verify the refs once at run start, beside the `{base}` and `{round}` population at `spike/src/engine.js:29`, whenever the flow contains a step with `input.diff`. `materialiseDiff` keeps its checks as the defensive second line — which is how the runtime contract already frames runtime target loading. This also closes N2 and N3 for free.

---

## 4. Nits

- **N1 — The exhaustion gate borrows `human-locked` and the audit log cannot tell them apart.** `spike/src/engine.js:266` presents the gate as `human-locked` to defeat the `--auto` bypass at `:274`, so `runs.log` records it identically to an author-declared deploy gate. GLOSSARY defines *human-locked gate* as deploy's, and the DECISIONS entry of 2026-08-23 is explicit that the engine-presented exhaustion gate is distinct. A dedicated kind added to the bypass condition carries the distinction into the log for free and lets the CLI word the prompt for what it actually is.
- **N2 — `materialiseDiff` runs `git diff` once per reviewer.** `spike/src/engine.js:431`. Two reviewers over one range means the full patch is computed and buffered twice per round — harmless at 200 KB, wasteful at scale, and in principle the two reviewers could see different bytes. Computing it once at run start (see M5) removes both.
- **N3 — The validated refs and the diffed range can diverge.** `spike/src/engine.js:432-438`. `hasRef` checks `base` and a locally reconstructed integration branch, but the diff runs on `interpolate(step.input.diff, ctx.vars)`. A flow author writing any other range gets a preflight that validates refs the command never touches and errors naming refs that are not the problem.

---

## 5. What the panel got right about the implementation

Recorded because the finding list above is not proportionate to the ticket, and because a verdict that only enumerates defects misrepresents the work. I verified these too:

- **Derived regression** (`engine.js:57-63`) loads the target flow and takes its `consumes` — AC-13 satisfied, and `goto: flow:qa-red` remains the promised one-line reversal.
- **Round numbering from the filesystem** (`engine.js:422-429`) counts only directories containing `verdict.md`, so an aborted round reuses its number and a completed round is never overwritten. D2 implemented exactly as specified, including the approval-then-later-regression case that killed the counter-derived alternative.
- **All-settled panel semantics** (`engine.js:266-280`) keep the survivor's artifact, name it in the error, and let the `FlowError` reach `finish(…, 'failed')` — so stage and counter are untouched and the verdict never runs on half a panel. AC-24 satisfied.
- **The exhaustion event** (`engine.js:264`) is recorded with `cost: 0` before the gate is presented, with the full cost carried once on the later terminal event. The double-counting fix, in the right order.
- **The `retry` value** (`engine.js:280`) persists `max_iterations`, which contradicts `review-runtime.contract.md` §retry — but `solution/errata.md` E-1 supersedes exactly that clause with the traversal arithmetic worked through, and DECISIONS records it. **This is not a finding.** The engine implements the erratum correctly, and the in-code comment explains why the alternatives grant two traversals or refund unrelated loops.
- **`{base}` populated at `engine.js:29`**, before any interpolation, so a missing base can no longer leak into git as the literal string `{base}...`.
- **The mock switches** reject `MOCK_ALWAYS_PASS` and `MOCK_ALWAYS_FAIL` together and preserve the call-count fallback — `mock-adapter-switches.contract.md` satisfied clause for clause. B2 objects to where the finding format was applied in the engine, not to the mock honouring its contract.
- **Ownership of `spike/src/adapters/index.js`**, absent from both task descriptions in `tasks.yaml`, is granted to `Q0006-runtime` by errata E-3. In scope; not a finding.

---

## 6. What happens next

Under D8 a surviving blocker or major produces `changes-requested`, so this round regresses the ticket to the stage `development` consumes, `iterations.review` becomes 1, and the maintainer's next command is `harness run development Q-0006`.

Two requests that sit outside the finding list:

1. **Re-run round 2 against a non-empty diff range** once B1 is fixed. This round's findings are sound, but they came from a reconstruction, and the flow cannot promise that a future round will get one.
2. **Fix B2 and M4 together.** They are the same mistake seen from two sides — review-specific rules living in files shared by every flow — and fixing B2 alone leaves `requirements` with an enforced coupling on a findings format its role cannot produce.
