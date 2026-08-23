# Test output

```
ssing
  ✗ S6.4 unloadable
    S6.4 unloadable
  ✗ dead end
    dead end
  ✗ ambiguity
    ambiguity
  ✗ cycle/repeated pair
    cycle/repeated pair
  ✗ self target
    self target
✗ S6.2-S6.10 — return-chain validation handles multi-hop, missing, unloadable, dead-end, ambiguity and cycles
  S6.3 missing: S6.3 missing
S6.4 unloadable: S6.4 unloadable
dead end: dead end
ambiguity: ambiguity
cycle/repeated pair: cycle/repeated pair
self target: self target

6 !== 0

  ✗ S7.4
    Missing expected exception.
  ✗ S7.5
    Missing expected exception.
  ✗ S7.6
    Missing expected exception.
  ✗ S7.7
    Missing expected exception.
✗ S7.1-S7.7 — bounds and counter spelling reject every invalid form
  S7.4: Missing expected exception.
S7.5: Missing expected exception.
S7.6: Missing expected exception.
S7.7: Missing expected exception.

4 !== 0

✗ S8.1-S8.4 — same-role review panels must span at least two adapters
  Missing expected exception.
✗ S9.1-S9.4/E1 — run uses the same pristine whole-directory preflight before overrides and side effects
  Expected "actual" to be strictly unequal to: 0
✗ S10.1-S10.7/E3/E4 — gate answers accumulate in order, are exact, and never come from auto or closed stdin
  The input did not match the regular expression /gate/i. Input:

"✗ Error: ENOENT: no such file or directory, open '/private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/q0033-LOtOGy/harness/flows/review.yaml'\n" +
  '    at Object.readFileSync (node:fs:441:20)\n' +
  '    at loadFlow (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/src/engine.js:15:30)\n' +
  '    at loadFlowByName (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/src/engine.js:433:10)\n' +
  '    at main (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/bin/harness.js:179:20)\n' +
  '    at file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/bin/harness.js:196:1\n' +
  '    at ModuleJob.run (node:internal/modules/esm/module_job:437:25)\n' +
  '    at async node:internal/modules/esm/loader:639:26\n' +
  '    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)\n'

✗ S11.1-S11.4 — suite wiring, explicit gates, and board counter/cost compatibility are pinned
  The input was expected to not match the regular expression /stdin closed without one/i. Input:

'· run #1  flow=requirements  ticket=T-0001  draft → requirements\n' +
  '▸ pm-claude mock/opus role=product-manager\n' +
  '▸ pm-codex mock role=product-manager\n' +
  '· pm-claude: wrote requirements/candidate-claude.md\n' +
  '✓ pm-claude cost=$0.010 20ms\n' +
  '· pm-codex: wrote requirements/candidate-codex.md\n' +
  '✓ pm-codex cost=$0.010 20ms\n' +
  '▸ head-of-product mock/opus role=head-of-product\n' +
  '· head-of-product: wrote requirements/merged.md\n' +
  '✓ head-of-product verdict=needs-input cost=$0.010 20ms\n' +
  '! head-of-product: needs-input — major: src/mock.ts:1 (mock) placeholder finding\n' +
  '! head-of-product: iteration 1/1 → goto head-of-product\n' +
  '▸ head-of-product mock/opus role=head-of-product\n' +
  '· head-of-product: wrote requirements/merged.md\n' +
  '✓ head-of-product verdict=needs-input cost=$0.010 20ms\n' +
  '! head-of-product: needs-input — major: src/mock.ts:1 (mock) placeholder finding\n' +
  '! head-of-product: loop exhausted (1) → human gate\n' +
  '\n' +
  '■ GATE (human-locked) loop exhausted at head-of-product (requirements.head-of-product = 2, limit 1); choose: advance (accept as is), retry (exactly one more head-of-product), abort\n' +
  '  inspect: /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/q0033-MA682C/backlog/T-0001-exhaustion-fixture\n' +
  '  advance / retry / abort > · run #1 failed: draft → draft   cost $0.04  tokens 3896\n' +
  '✗ gate (human-locked) "loop exhausted at head-of-product (requirements.head-of-product = 2, limit 1); choose: advance (accept as is), retry (exactly one more head-of-product), abort" needs an answer and stdin closed without one — run it interactively, or answer it on stdin\n'

✗ S13.1 — the review-failure arrow returns reviewed to red
  review-failure connector endpoints resolve to green → reviewed
+ actual - expected

  [
+   'green',
-   'red',
    'reviewed'
  ]

✗ S13.2-S13.4 — the documented review flow, config and M1 decision match the contracts
  The input did not match the regular expression /\{base\}\.\.\.harness\/\{id\}\/integration/. Input:

'\n' +
  '```yaml\n' +
  'name: review\n' +
  'consumes: green\n' +
  'produces: reviewed\n' +
  'steps:\n' +
  '  - parallel:\n' +
  '    - id: reviewer-claude\n' +
  '      role: code-reviewer\n' +
  '      adapter: claude\n' +
  '      model: opus\n' +
  '      input: { diff: "harness/T-{id}..main", backlog: [requirements/merged.md, solution/solution.md], harness: [rules.md] }\n' +
  '      output: { write: "review/round-{iter}/claude.md", findings: true }\n' +
  '    - id: reviewer-codex\n' +
  '      role: code-reviewer\n' +
  '      adapter: codex\n' +
  '      model: gpt-5\n' +
  '      input: { diff: "harness/T-{id}..main", backlog: [requirements/merged.md, solution/solution.md], harness: [rules.md] }\n' +
  '      output: { write: "review/round-{iter}/codex.md", findings: true }\n' +
  '\n' +
  '  - id: verdict\n' +
  '    type: judge\n' +
  '    adapter: claude\n' +
  '    model: opus\n' +
  '    input: { findings: [reviewer-claude, reviewer-codex] }\n' +
  '    output: { write: "review/round-{iter}/verdict.md", verdict: approve|changes-requested, tasks: true }\n' +
  '    instructions: >\n' +
  '      Deduplicate findings, drop nits, keep blockers and majors. If any blocker\n' +
  '      remains, emit a tasks list (same schema as tasks.yaml) for the fix round.\n' +
  '    on_fail:\n' +
  '      goto: flow:development              # cross-flow backward edge\n' +
  '      with: { tasks: "review/round-{iter}/verdict.md#tasks" }\n' +
  '      counter: iterations.review\n' +
  '      max_iterations: 3\n' +
  '      on_exhausted: gate\n' +
  '  - gate: human\n' +
  'cross_vendor: required\n' +
  '```\n'

✗ S13.5 — the development plan records the Q-0006/Q-0033 split
  M1 Done when must name the shipped Q-0033 surface
✗ S13.6 — DECISIONS contains both complete review-flow decisions
  The expression evaluated to a falsy value:

  assert.ok(at >= 0)

✗ S13.7 — the Gate glossary entry distinguishes declared and exhaustion gates
  The input did not match the regular expression /author.declared[\s\S]*deploy/is. Input:

'**Gate**: The checkpoint between flow steps. Human-gated by default (user sees verdict + diffs + reasoning, then advances/re-runs/overrides); can be set to `auto` per gate in the flow file.\n'

✗ E7 — unused explicit gate answers are ignored after a gate-free regression
  ✗ Error: ENOENT: no such file or directory, open '/private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/q0033-l4H7V7/harness/flows/review.yaml'
    at Object.readFileSync (node:fs:441:20)
    at loadFlow (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/src/engine.js:15:30)
    at loadFlowByName (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/src/engine.js:433:10)
    at main (file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/bin/harness.js:179:20)
    at file:///Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0033__integration/spike/bin/harness.js:196:1
    at ModuleJob.run (node:internal/modules/esm/module_job:437:25)
    at async node:internal/modules/esm/loader:639:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)


1 !== 0


✗ 19 Q-0033 scenario group(s) failed
✗ q0033-surface.js exited 1

✗ 2 of 3 test file(s) failed

```
