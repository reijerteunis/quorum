# Test output

```
1/verdict.md\n' +
  '      round-2/...\n' +
  '    runs.log             # append-only: run id, flow, stage before/after, cost\n' +
  '```\n' +
  '\n' +
  "Tests themselves are **not** stored in the backlog: they are committed to the target repo on the ticket branch (`harness/T-0012/tests`, beside the integration branch `harness/T-0012/integration`) so the developers' worktrees inherit them.\n" +
  '\n' +
  '### 3.3 `ticket.md` frontmatter\n' +
  '\n' +
  '```yaml\n' +
  '---\n' +
  'id: T-0012\n' +
  'title: Subscription downgrade mid-cycle\n' +
  'stage: solutioned          # see state machine\n' +
  'owner: ruud                # human who owns the *current* stage\n' +
  'repos: [my-saas-api]       # only meaningful for central layout\n' +
  'branch: harness/T-0012/integration   # ticket integration branch (git refs: a branch cannot be both a ref and a directory, so step branches sit beside it)\n' +
  'priority: p1\n' +
  'created: 2026-08-21\n' +
  'iterations:\n' +
  '  review: 0                # review↔dev loop counter\n' +
  '  qa: 0                    # final-qa → dev/solution loop counter\n' +
  'history:\n' +
  '  - {stage: requirements, run: 41, at: 2026-08-21T09:12Z, cost: 0.84}\n' +
  '  - {stage: solutioned,   run: 42, at: 2026-08-21T10:40Z, cost: 1.92}\n' +
  '---\n' +
  'Clinics can downgrade their plan mid-cycle. Define what happens to active\n' +
  'subscriptions, proration and the patient-facing side.\n' +
  '```\n' +
  '\n' +
  '### 3.4 State machine\n' +
  '\n' +
  '```\n' +
  'draft ──▶ requirements ──▶ solutioned ──▶ red ──▶ green ──▶ reviewed ──▶ qa-passed ──▶ deployed\n' +
  '                                          ▲        │  ▲        │            │\n' +
  '                                          │        │  └────────┘ (review fail, ≤3)\n' +
  '                                          │        └────────────────────────┘ (qa: dev issue, ≤2)\n' +
  '                                          └─────────────────────────────────┘ (qa: design issue, ≤1)\n' +
  '```\n' +
  '\n' +
  "Plus `blocked` (human parked it) and `abandoned` from any stage. A flow may only start on a ticket whose `stage` equals the flow's `consumes`. The Studio's backlog board is a kanban over this field.\n" +
  '\n' +
  '### 3.5 `tasks.yaml` (output of solutioning)\n' +
  '\n' +
  '```yaml\n' +
  'tasks:\n' +
  '  - id: T-0012.1\n' +
  '    role: backend\n' +
  '    title: Proration service + downgrade endpoint\n' +
  '    contracts: [contracts/billing.openapi.yaml, contracts/ProrationService.ts]\n' +
  '    depends_on: []\n' +
  '  - id: T-0012.2\n' +
  '    role: data\n' +
  '    title: "Migration: subscription_changes table"\n' +
  '    contracts: [contracts/migrations/0042_subscription_changes.sql]\n' +
  '    depends_on: []\n' +
  '  - id: T-0012.3\n' +
  '    role: frontend\n' +
  '    title: Downgrade confirmation flow in clinic dashboard\n' +
  '    contracts: [contracts/billing.openapi.yaml]\n' +
  '    depends_on: [T-0012.1]\n' +
  '```\n' +
  '\n' +
  '`role` selects which developer profile (prompt + model + allowed paths) picks up the task. Roles are defined per project in `harness/roles/*.md`.\n' +
  '\n' +
  '## 4. Flow engine additions (beyond locked v1)\n' +
  '\n' +
  '| Addition | Why |\n' +
  '|---|---|\n' +
  '| `consumes` / `produces` on a flow | Stage chaining; the Studio can list "runnable now" tickets per flow |\n' +
  '| `backlog` step input type | Steps receive ticket files as context without ad-hoc prompting |\n' +
  '| `write` step output → backlog path | Declarative persistence of artifacts |\n' +
  '| `on_fail: goto` + `max_iterations` + `on_exhausted: gate` | Bounded loops |\n' +
  '| `fan_out: tasks.yaml by role` | Dynamic parallelism: N tasks → N worktrees |\n' +
  '| `integrate` step | Merge N task branches onto the ticket branch, run tests |\n' +
  '| `cross_vendor: required` lint | Writer/reviewer vendor separation |\n' +
  '| `gate: human-locked` | Gate that cannot be set to auto (deploy) |\n' +
  '\n' +
  'Everything else reuses v1 primitives: `adapter`, `model`, `worktree: true`, `parallel`, `judge`, `gate`.\n' +
  '\n' +
  '## 5. The seven flows\n' +
  '\n' +
  'All examples use `claude` and `codex` adapters. Model names are placeholders — set them per project.\n' +
  '\n' +
  '### 5.1 `requirements.yaml` — PM×2 + Head of Product\n' +
  '\n' +
  '```yaml\n' +
  'name: requirements\n' +
  'consumes: draft\n' +
  'produces: requirements\n' +
  'steps:\n' +
  '  - parallel:\n' +
  '    - id: pm-claude\n' +
  '      role: product-manager\n' +
  '      adapter: claude\n' +
  '      model: opus\n' +
  '      input: { backlog: [ticket.md], harness: [rules.md, architecture.md, product-context.md] }\n' +
  '      output: { write: requirements/candidate-claude.md }\n' +
  '    - id: pm-codex\n' +
  '      role: product-manager\n' +
  '      adapter: codex\n' +
  '      model: gpt-5\n' +
  '      input: { backlog: [ticket.md], harness: [rules.md, architecture.md, product-context.md] }\n' +
  '      output: { write: requirements/candidate-codex.md }\n' +
  '\n' +
  '  - id: head-of-product\n' +
  '    role: head-of-product\n' +
  '    adapter: claude\n' +
  '    model: opus\n' +
  '    input: { backlog: [ticket.md, requirements/candidate-*.md] }\n' +
  '    output: { write: requirements/merged.md }\n' +
  '    instructions: >\n' +
  '      Judge both candidates for completeness, testability and scope discipline.\n' +
  '      Produce one merged requirement with acceptance criteria, non-goals and\n' +
  '      open questions. Note which candidate contributed what.\n' +
  '  - gate: human        # PM owner approves the merged requirement\n' +
  '```\n' +
  '\n' +
  'Optional: make `pm-*` interactive (step chat) so the PM can answer clarifying questions — this is the existing grill pattern.\n' +
  '\n' +
  '### 5.2 `solutioning.yaml` — Architect writes (Codex), Claude reviews\n' +
  '\n' +
  '```yaml\n' +
  'name: solutioning\n' +
  'consumes: requirements\n' +
  'produces: solutioned\n' +
  'steps:\n' +
  '  - id: architect\n' +
  '    role: principal-architect\n' +
  '    adapter: codex\n' +
  '    model: gpt-5\n' +
  '    worktree: true                       # may read the repo, may write contracts/\n' +
  '    input: { backlog: [requirements/merged.md], harness: [architecture.md, rules.md], repo: true }\n' +
  '    output:\n' +
  '      writes: [solution/draft.md, solution/tasks.yaml]\n' +
  '      write_dir: solution/contracts/\n' +
  '    instructions: >\n' +
  '      Produce a solution document, machine-checkable contracts (interfaces,\n' +
  '      schemas, stubs, migration skeletons) and a task breakdown tagged by role.\n' +
  '      Every task must reference at least one contract.\n' +
  '  - id: architecture-review\n' +
  '    role: architecture-reviewer\n' +
  '    adapter: claude\n' +
  '    model: opus\n' +
  '    input: { backlog: [requirements/merged.md, solution/draft.md, solution/contracts/, solution/tasks.yaml], repo: true }\n' +
  '    output: { write: solution/review.md, verdict: approve|revise }\n' +
  '    on_fail: { goto: architect, max_iterations: 2, on_exhausted: gate }\n' +
  '  - id: finalize\n' +
  '    adapter: codex\n' +
  '    model: gpt-5\n' +
  '    input: { backlog: [solution/draft.md, solution/review.md] }\n' +
  '    output: { write: solution/solution.md }\n' +
  '  - gate: human        # architect owner approves; contracts are committed to the ticket branch\n' +
  'cross_vendor: required\n' +
  '```\n' +
  '\n' +
  '### 5.3 `qa-red.yaml` — Automation QA writes failing tests\n' +
  '\n' +
  '```yaml\n' +
  'name: qa-red\n' +
  'consumes: solutioned\n' +
  'produces: red\n' +
  'steps:\n' +
  '  - id: scenarios\n' +
  '    role: automation-qa\n' +
  '    adapter: claude\n' +
  '    model: sonnet\n' +
  '    input: { backlog: [requirements/merged.md, solution/solution.md, so'... 9593 more characters


✗ 14 Q-0033 scenario group(s) failed
✗ q0033-surface.js exited 1

✗ 1 of 3 test file(s) failed

```
