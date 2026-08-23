# Q-0006 — Review of the engine half

**Reviewer:** code-reviewer (claude) · **Round 1** · Verdict: **changes-requested**

---

## 0. What I actually reviewed, and why that is not what I was given

The `## Diff to review` section of my prompt arrived with an empty `git diff --stat` and an empty patch. That is not a prompt-assembly accident — I verified it:

```
$ git merge-base --is-ancestor harness/Q-0006/integration main  →  true
$ git diff --stat main...harness/Q-0006/integration             →  (empty)
```

`harness/Q-0006/integration` has already been merged into `main` (it is the merge-base itself, `998f397`), so the three-dot range AC-11 mandates is legitimately empty. The panel was asked to review a change that, from `main`'s point of view, no longer exists as a difference.

I reconstructed the change set from branch history rather than return "no findings". The subject of this review is therefore the two development commits:

| Commit | Task | Files |
| --- | --- | --- |
| `de44ea4` | `Q0006-mock-switch` | `spike/src/adapters/mock.js` (+10 −3) |
| `700b5f6` | `Q0006-runtime` | `spike/src/engine.js` (+55 −11), `spike/src/adapters/index.js` (+24 −2), `harness/flows/development.yaml` + template copy (+1 −1 each) |

All line citations below are against `998f397:spike/src/…` — the integration tip, which is what this ticket delivered. Where `main` has since moved because Q-0033 merged on top, I say so explicitly.

**Two things I checked before calling them defects, and did not:**

- The `retry` value. `contracts/Q-0006/review-runtime.contract.md` §retry says `max_iterations - 1` (persisted `2`); `spike/src/engine.js:272` persists `max_iterations` (`3`). This is **not** a violation — `solution/errata.md` E-1 supersedes exactly that clause, with the traversal arithmetic worked through, and DECISIONS records it. The engine implements the erratum correctly.
- Ownership of `spike/src/adapters/index.js`. It appears in neither task description in `tasks.yaml`, but errata E-3 grants it to `Q0006-runtime`. In scope.
- The fan-out sync conflict warning. The contract requires it to name the task; `spike/src/engine.js:446` sets `tpl.id = interpolate(tpl.id ?? '${step.id}:{task.id}', …)` before `runAgentStep`, so `engine.js:163`'s warning reads `dev:Q0006-runtime: could not sync base: …`. Satisfied.

---

## Blockers

### B1 — An empty diff is materialised silently, and two reviewers are billed for it

`spike/src/engine.js:406-422` (`materialiseDiff`)

`materialiseDiff` verifies that `repo.base_branch` resolves (`engine.js:411`) and that `harness/<id>/integration` exists (`engine.js:412`), then unconditionally embeds whatever `git diff` returns:

```js
const stat = execFileSync('git', ['diff', '--stat', range], …);   // engine.js:413
const full = execFileSync('git', ['diff', range], …);             // engine.js:414
…
return `\n## Diff to review\n\n### git diff --stat ${range}\n\n${stat.trim()}\n\n## Patch (${range})\n\n${bytes.toString('utf8')}${notice}`;
```

Both refs can exist and the range can still be empty — after the branch is merged (this run), before any task commits, or if `base_branch` is mistakenly set to the integration branch itself. Nothing checks `stat.trim().length`.

**Impact.** This is the failure I am living inside. Two paid reviewer calls plus a verdict call run against an empty patch. The verdict step is instructed to "judge the reviews, not the code diff" (`harness/flows/review.yaml:38`) and has no way to know the panel saw nothing, so the overwhelmingly likely outcome is `approve` with empty findings — which advances the ticket `green → reviewed` on zero evidence and completes the flow. That is precisely the closed loop with no outside opinion in it that `requirements/merged.md` §Problem says this ticket exists to prevent, except now it is worse: the audit trail in `review/round-N/` records a review that formally happened.

The requirement anticipated the truncation direction of this problem (Risk 2: "this diff is too large to review as one change" is a legitimate finding) but not the empty direction.

**Recommendation.** After computing `stat`, treat an empty range as a hard stop, in the same class as the missing-ref errors two lines above and with the same named-cause message style:

```js
if (!stat.trim()) throw new FlowError(
  `${range} is empty: nothing to review. Check repo.base_branch in harness/harness.yaml ` +
  `(currently "${base}") and that harness/${ctx.ticket.meta.id}/integration carries commits since it diverged.`);
```

Failing before the spawn keeps AC-12's "stops before any agent is spawned" property and costs nothing. If you would rather not fail, the absolute minimum is an explicit `## Notice` in the prompt saying the range is empty, so a reviewer can return `changes-requested` instead of rubber-stamping — but I would fail, because an empty review is not a cheaper review, it is a false one.

---

### B2 — A review-specific findings format was added to the generic schema, and now constrains three other shipped flows

`spike/src/engine.js:341` and `spike/src/adapters/index.js:187`

`schemaFor` is the schema builder for **every** step in **every** flow. The runtime task added the review artifact contract's citation pattern to it unconditionally:

```js
// engine.js:341
props.findings = { type: 'array', items: { type: 'string',
  pattern: '^(blocker|major|nit): .+:[1-9][0-9]* .+' }, … };
```

and `checkAgainstSchema` now enforces it (`adapters/index.js:187`), with a failure routed to the invalid-output path — raw dump, run stops (`engine.js:191-194`).

Four shipped flows have `output.verdict`, not one:

| Flow | Step | Enum | Role that writes the findings |
| --- | --- | --- | --- |
| `review.yaml:33` | `verdict` | `approve\|changes-requested` | `code-reviewer` — **does** teach severity + `file:line` |
| `requirements.yaml:24` | `head-of-product` | `ready\|needs-input` | `head-of-product` — teaches neither |
| `solutioning.yaml:27` | `architecture-review` | `approve\|revise` | `architecture-reviewer` — teaches neither |
| `qa-red.yaml:43` | `scenario-review` | `approve\|revise` | (same) |

The contradiction is on disk and citable. `harness/roles/architecture-reviewer.md:8-9` documents the format that role should use:

> Your findings are concrete and actionable ("Task 3 references contracts/billing.openapi.yaml but that file has no downgrade endpoint").

That literal example fails `^(blocker|major|nit): .+:[1-9][0-9]* .+` on both counts — no severity prefix, no line number. `harness/roles/head-of-product.md` is worse suited still: it is told to return `needs-input` and "say where the natural seam is, and describe the two or three tickets it should become", which is a scoping judgement about a whole document, not a citation.

**Impact.** The next real `harness run requirements <id>` that comes back `needs-input`, and the next real `solutioning` or `qa-red` round that comes back `revise`, hard-fails on `"findings" item has invalid format` after the vendor has already been billed. Two of the four shipped flows lose their rejection path; the third loses its. `review-artifacts.schema.json` is titled "Review structured output" and scoped to review artifacts — applying it globally is outside what the contract asks for.

**Why the suite did not catch it.** `Q0006-mock-switch` changed the mock to emit `major: src/mock.ts:1 (mock) placeholder finding` for *all* verdict schemas (`mock.js:74-76`), so every flow's mock run conforms. `spike/test/q0006-engine.js:83-85` exercises the pattern only through `approve`/`changes-requested` shapes. This is `requirements/merged.md` Risk 6 — "mock switches hiding real routing bugs" — landing exactly as written.

**Recommendation.** Scope the pattern to the steps whose contract demands it. The cleanest cut that needs no flow-schema change is to derive it from the declared enum, since only review declares `changes-requested`:

```js
const opts = String(step.output.verdict).split('|');
const cited = opts.includes('changes-requested');
props.findings = { type: 'array', items: { type: 'string',
  ...(cited ? { pattern: '^(blocker|major|nit): .+:[1-9][0-9]* .+' } : {}) }, … };
```

If you prefer it explicit, add an opt-in flow field (`output: { findings: cited }`) and set it in `review.yaml` only. Either way, please add a test that a `ready|needs-input` step accepts a prose finding — the current suite cannot tell these two designs apart.

---

### B3 — `PROBE_SCHEMA` now violates the codex strict-mode rule the repo documents

`spike/src/adapters/index.js:130-134`

```js
const PROBE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
  required: ['ok'], additionalProperties: false,
};
```

`summary` was added to `properties` but not to `required`. The comment three lines above it (`adapters/index.js:127-129`) states the rule being broken, and `docs/03-adapter-contract.md:140-141` states it as verified fact:

> Codex enforces OpenAI strict structured outputs: every object needs `additionalProperties: false` and every property listed in `required`. `schemaFor()` already complies.

`schemaFor` does comply — `engine.js:337-343` pushes every property it defines onto `required`. This schema no longer does, and it is handed straight to `codex exec --output-schema` via `probeAdapter` (`adapters/index.js:144`).

**Impact.** `harness adapters --probe` is the command M0 created for one reason: to catch a dead or model-restricted login *before* a paid multi-step run starts, after `check()` reported ✓ on an already-expired Codex token. If codex rejects the probe schema, that safety net fails closed on the vendor it was built for.

I could not verify this against the live CLI — a probe is a paid round-trip and this is a read-only review — so I am citing the repository's own documented, previously-verified invariant rather than a run. That is enough to act on: the change is inconsistent with a rule this file explicitly commits to, and the fix is one line.

**Recommendation.** `required: ['ok', 'summary']`. The intent is clearly to stop the new `additionalProperties: false` enforcement (`adapters/index.js:174`) from rejecting a vendor that volunteers a `summary`; requiring it achieves that and keeps strict mode satisfied. Then re-run `harness adapters --probe --json` against both CLIs and record the result in the ticket folder — this is exactly the kind of claim that should not ship on inference, mine included.

---

## Majors

### M1 — `interrupted` is written into ticket history, and the frozen state schema forbids it

`spike/src/engine.js:75` and `spike/src/engine.js:303`

`finish` previously appended a history entry only for `completed` and `regressed`. The diff moved the push outside that guard so every outcome is recorded:

```js
// engine.js:303 — now unconditional
ticket.meta.history = [...(ticket.meta.history ?? []), outcome(ctx, from, ticket.meta.stage, status, round(ctx.stats.cost))];
```

That is the right change for AC-22, but the signal handler at `engine.js:75` calls `finish(ctx, ticket.meta.stage, 'interrupted', …)`, and `contracts/Q-0006/ticket-review-state.schema.json` constrains history `status` to:

```json
"status": { "enum": ["completed", "regressed", "exhausted", "aborted", "failed"] }
```

`interrupted` is not in it. Before this change the interrupted path wrote only to `runs.log`, so the schema held; now every Ctrl-C writes a frontmatter entry that its own frozen persistence contract rejects.

**Impact.** Ticket state stops validating against the contract development is graded on, and it fails on the one path where the audit trail matters most — Q-0004 added interruption recording precisely because a silent interrupt was "an undocumented way to buy unlimited retries". `grep -rn interrupted spike/test/ contracts/Q-0006/` returns nothing, so no test covers it and the red suite cannot see the breakage.

**Recommendation.** Pick one and make it explicit, since the contract is frozen:
1. Map the signal path to an allowed status — `finish(ctx, ticket.meta.stage, 'aborted', 'received SIGINT')` — keeping `runs.log` free to say `interrupted`; or
2. Add an erratum (E-4) admitting `interrupted` to the enum, in the same form as E-1.

I lean to (2): `interrupted` and `aborted` are genuinely different events (a signal versus a human choosing `abort` at a gate) and the DECISIONS entry for Q-0004 names all four terminal outcomes including `interrupted`. The schema is simply behind. Either way, add the covering test.

---

### M2 — The cross-flow regression report hard-codes the counter name `review`

`spike/src/engine.js:95`

```js
count: ctx.counters.review, limit: res.limit,
remaining: Math.max(0, (res.limit ?? 0) - (ctx.counters.review ?? 0)),
```

`handleFail` resolves the counter generically — `const counter = f.counter ?? '${ctx.flow.name}.${step.id}'` (`engine.js:243`) — and `review.yaml:42` happens to declare `counter: review`, so the shipped flow reports correctly. Any other flow with a `goto: flow:<name>` under a different counter reports `count: undefined` and `remaining: limit`, i.e. it tells the operator they have their full budget left at the moment they spent some of it.

This is latent today and lands in Q-0012: `qa-final.yaml` is specified to regress cross-flow to development or solutioning, and it will not use a counter called `review`.

**Impact.** Wrong operator-facing numbers on a safety bound, in the one message whose whole job is telling a human how much loop budget remains. It also sits oddly beside AC-13, which makes a point of deriving the regression target rather than hard-coding it — the stage is derived, the counter beside it is not.

**Recommendation.** `handleFail` and `runGate` already know the name. Carry it on the result object next to `limit`:

```js
// engine.js:248
return { goto: f.goto, limit: f.max_iterations, counter };
// engine.js:274
return { goto: step.retryTarget, limit: step.retryMax, counter: step.retryCounter };
// engine.js:95
count: ctx.counters[res.counter], limit: res.limit,
remaining: Math.max(0, (res.limit ?? 0) - (ctx.counters[res.counter] ?? 0)),
```

---

### M3 — The UTF-8 truncation loop discards the patch from the first invalid byte, and still claims it truncated at the limit

`spike/src/engine.js:414-421`

```js
const full = execFileSync('git', ['diff', range], { cwd: ctx.repoDir });   // Buffer
let bytes = full; let truncated = bytes.length > limit;
if (truncated) {
  bytes = bytes.subarray(0, limit);
  while (bytes.length && Buffer.from(bytes.toString('utf8')).compare(bytes) !== 0) bytes = bytes.subarray(0, -1);
  …
}
const notice = truncated ? `\n\n## Truncation notice\n\nPatch truncated to ${limit} UTF-8 bytes.` : '';
```

The loop trims until the buffer round-trips through UTF-8 unchanged. That is correct for the intended case — a multi-byte character split at the boundary — but the comparison is over the **whole** buffer, so any invalid UTF-8 *anywhere* in the first `limit` bytes never round-trips, and the loop keeps trimming all the way back to that byte. I reproduced the three cases:

```
invalid-utf8 case  -> kept bytes: 10 of limit 32 after 22 trims
ascii case         -> kept bytes: 32 after 0 trims
split-char case    -> kept bytes: 31 after 1 trims
```

A single latin-1 byte 10 bytes into the patch reduced a 32-byte window to 10. At the shipped `max_diff_bytes: 200000` that means a stray non-UTF-8 byte early in a large diff — a legacy-encoded source file, a `.properties`, a fixture — silently throws away everything after it.

**Impact.** Reviewers receive a patch truncated far below the configured limit, under a notice that states the opposite ("truncated to 200000 UTF-8 bytes"), with nothing in `runs.log` distinguishing it from an ordinary truncation. It only fires on diffs over the limit, which is exactly the forty-file ticket the requirement's Risk 2 is about — the case where a reviewer is least able to notice that material is missing.

**Recommendation.** Trim at most 3 bytes, which is all a split UTF-8 sequence can require, and leave interior invalid bytes to the replacement character:

```js
for (let i = 0; i < 3 && bytes.length; i++) {
  const tail = bytes.subarray(-4);
  if (Buffer.from(tail.toString('utf8')).compare(tail) === 0) break;
  bytes = bytes.subarray(0, -1);
}
```

Then report the real kept length in both the notice and the `runs.log` line (`engine.js:420`), so `truncated=… kept=…` is checkable.

---

### M4 — The verdict/findings coupling hard-codes review's enum values instead of deriving them

`spike/src/adapters/index.js:192-193`

```js
if (obj.verdict === 'approve' && Array.isArray(obj.findings) && obj.findings.length) problems.push('approve requires empty findings');
if (obj.verdict === 'changes-requested' && Array.isArray(obj.findings) && !obj.findings.length) problems.push('changes-requested requires findings');
```

`schemaFor` already establishes the general rule in the description it sends to the vendor — "Empty when the verdict is the first option" (`engine.js:341`) — and the enum is right there in `schema.properties.verdict.enum`. Hard-coding the two review strings gives inconsistent enforcement across shipped flows:

| Flow | Pass value | Fail value | `pass + findings` caught? | `fail + no findings` caught? |
| --- | --- | --- | --- | --- |
| `review` | `approve` | `changes-requested` | yes | yes |
| `solutioning`, `qa-red` | `approve` | `revise` | yes | **no** |
| `requirements` | `ready` | `needs-input` | **no** | **no** |

So `head-of-product` can return `ready` with a list of blockers and the engine advances the ticket to `solutioned` — which is the exact routing bug the DECISIONS entry "Step-output validation is Quorum's contract with its own agents" was written to close, still open for the flow that gates every other flow.

**Impact.** The invariant is enforced for one of four flows and silently absent for the other three, with no signal that it is partial.

**Recommendation.** `checkAgainstSchema` receives the schema; derive from it:

```js
const opts = schema.properties?.verdict?.enum;
if (opts && 'verdict' in obj && Array.isArray(obj.findings)) {
  if (obj.verdict === opts[0] && obj.findings.length) problems.push(`"${opts[0]}" requires empty findings`);
  if (obj.verdict !== opts[0] && !obj.findings.length) problems.push(`"${obj.verdict}" requires findings`);
}
```

This is strictly more faithful to the contract's intent and removes review-specific strings from a file shared by every flow. Note it interacts with **B2**: fix both together, or `requirements` gains an enforced coupling on findings it cannot format.

---

### M5 — AC-12's "before any agent is spawned" holds only because the panel is step 1

`spike/src/engine.js:406` called from `engine.js:361` (`buildPrompt`)

The base/integration ref preflight lives inside `materialiseDiff`, which runs inside `buildPrompt`, which runs inside `runAgentStep` (`engine.js:166`). AC-12 and the runtime contract both require the run to stop "before any agent is spawned" / "before spawning any adapter".

For `review.yaml` as shipped this is satisfied: the panel is the first step, and within the parallel group both members call `buildPrompt` before either reaches `adapter.run` (`engine.js:173`). But it is satisfied by step ordering, not by structure. Put any agent step ahead of the diff step — a triage step, a context-gathering step, the `qa-final.yaml` that Q-0012 will write against this same machinery — and a missing `repo.base_branch` is discovered only after that step has been spawned and billed.

**Impact.** An acceptance criterion that reads as a structural guarantee is currently a positional coincidence, in an engine whose entire value proposition is that its safety properties hold by construction. It will regress silently the first time someone edits the flow.

**Recommendation.** Resolve and verify the refs once at run start, beside the `{base}` and `{round}` variable population at `engine.js:66`, when the flow contains any step with `input.diff`. `materialiseDiff` keeps its checks as the defensive second line, exactly as the runtime contract already frames runtime target loading ("defensive but not the first point at which a bad target is discovered"). That also fixes **N2** below for free.

---

## Nits

### N1 — The exhaustion gate borrows `human-locked`, and the audit log cannot tell the two apart

`spike/src/engine.js:253`, logged at `engine.js:264`

`handleFail` presents the exhaustion gate as `gate: 'human-locked'` to get past the `--auto` bypass at `engine.js:261`. That achieves AC-17, but `runs.log` then records `gate=human-locked answer=advance` for it — indistinguishable from an author-declared deploy gate. `docs/GLOSSARY.md` defines **Human-locked gate** as "a gate that cannot be flipped to `auto` (deploy)", and the DECISIONS entry of 2026-08-23 is explicit that the engine-presented exhaustion gate "is distinct from an author-declared `human-locked` deploy gate even though both use the gate mechanism".

Suggest a distinct kind — `gate: 'exhaustion'` — added to the bypass condition at `engine.js:261` alongside `human-locked`. The log line then carries the distinction for free, and the CLI can word the prompt for what it actually is.

### N2 — `materialiseDiff` runs `git diff` once per reviewer

`spike/src/engine.js:406`

The shipped panel is two reviewers over one identical range, so the full patch is computed and buffered twice per round. Harmless at 200 KB, wasteful at scale, and it means the two reviewers could in principle see different bytes if the repo changed between the calls. Computing it once at run start (see **M5**) removes both.

### N3 — The validated refs and the diffed range can diverge

`spike/src/engine.js:409-414`

`hasRef` is checked against `base` and a locally reconstructed `harness/<id>/integration`, but the actual diff runs on `range = interpolate(step.input.diff, ctx.vars)`. If a flow author writes any other range in `input.diff`, the preflight validates two refs that the command never touches and the error messages name refs that are not the problem. Deriving the range from the same two values — or validating each ref parsed out of `range` — keeps the error messages truthful.

---

## What is right

Worth recording, because most of this ticket is correct and the list above is not proportionate to it:

- **Derived regression** (`engine.js:91-96`) loads the target flow and takes its `consumes` — AC-13 satisfied, and `goto: flow:qa-red` remains the promised one-line reversal.
- **Round numbering from the filesystem** (`engine.js:397-404`) reads directories that contain `verdict.md`, so an aborted round reuses its number and a completed round is never overwritten. This is D2 implemented exactly as specified, including the approval-then-later-regression case that killed the counter-derived alternative.
- **All-settled panel semantics** (`engine.js:118-133`) keep the survivor's artifact, name it in the error, and let the `FlowError` reach `finish(…, 'failed')` at `engine.js:108` — so stage and counter are untouched and the verdict never runs on half a panel. AC-24 satisfied.
- **The exhaustion event** (`engine.js:251`) is recorded with `cost: 0` before the gate is presented, and the later terminal event carries the full cost once. That is the double-counting fix M2-of-round-2 asked for, done in the right order.
- **Unconditional rework sync** (`engine.js:455`, `syncBase: true`) closes the stale-worktree hole, and because `runFanOut` interpolates the task id into `tpl.id` first, the conflict warning at `engine.js:163` names the task as the contract requires.
- **`{base}` populated at `engine.js:66`**, before any interpolation, so a missing base can no longer leak into git as the literal string `{base}...harness/<id>/integration`. That was minor N5 of round 3 and it is properly closed.
- **The mock switches** (`mock.js:65-77`) reject `MOCK_ALWAYS_PASS` and `MOCK_ALWAYS_FAIL` together before emitting a verdict, and preserve the call-count fallback when neither is set — `mock-adapter-switches.contract.md` satisfied clause for clause. My objection in **B2** is to where the finding format was applied in the engine, not to the mock implementing its contract.

---

## Summary of required changes

| # | Severity | File:line | Change |
| --- | --- | --- | --- |
| B1 | blocker | `spike/src/engine.js:413` | Fail (or at minimum announce) when the diff range is empty |
| B2 | blocker | `spike/src/engine.js:341` | Scope the `blocker\|major\|nit: file:line` pattern to review steps |
| B3 | blocker | `spike/src/adapters/index.js:132` | Add `summary` to `PROBE_SCHEMA.required`; re-run `adapters --probe` |
| M1 | major | `spike/src/engine.js:75` | Reconcile `interrupted` with the frozen status enum (map it, or erratum E-4) |
| M2 | major | `spike/src/engine.js:95` | Carry the counter name on the result instead of hard-coding `review` |
| M3 | major | `spike/src/engine.js:419` | Bound the trim to 3 bytes; report the real kept length |
| M4 | major | `spike/src/adapters/index.js:192` | Derive the verdict/findings coupling from the declared enum |
| M5 | major | `spike/src/engine.js:406` | Hoist the ref preflight to run start |
| N1 | nit | `spike/src/engine.js:253` | Give the exhaustion gate its own kind |
| N2 | nit | `spike/src/engine.js:406` | Compute the diff once per run |
| N3 | nit | `spike/src/engine.js:409` | Validate the refs the diff actually uses |

**One request for the maintainer, outside the code.** This round should be re-run against a non-empty diff before the verdict is trusted. B1 explains why the panel saw nothing, but it does not tell you what a reviewer would have found in the 112 lines had they been delivered by the harness rather than reconstructed by hand — and reconstructing them is not a property this flow can rely on.
