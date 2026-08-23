# Test output

```
rtifact
[31m✗[0m bad.json violates c.schema.json:
    /stage: must be equal to one of the allowed values
✓ harness validate exits 1 so a red test can fail on it
✓ a priced step shows money
✓ an unpriced step shows tokens, not $0.000
✓ an unpriced step is never displayed as free
✓ role model applies on its own vendor
✓ role model does not leak to another vendor
✓ an explicit step model always wins

all good — /var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-zw1anM

──── q0006-engine.js ────
✓ AC-7/AC-28/EDGE-3 — mock verdict switches are valid, deterministic, scoped, and exclusive
✓ EDGE-2/AC-23 — every frozen verdict-schema clause is enforced without a validator dependency
✓ AC-5/AC-10/AC-11/EDGE-4/EDGE-5 — buildPrompt materialises the configured three-dot diff safely
✓ AC-12/EDGE-5 — a missing configured base ref fails before any adapter call
✓ EDGE-17 — a missing integration ref has its own pre-adapter diagnostic
✓ AC-4/AC-6/AC-8/AC-9 — a real review run writes numbered panel/verdict artifacts and stable latest verdict
✓ AC-13/AC-14/AC-15/AC-16 — three separate rejection rounds regress to the target consumes stage and persist exact counts
✓ AC-17/AC-18/EDGE-1/EDGE-12 — fourth rejection exhausts; retry persists max and grants one traversal only
✓ AC-17/AC-18/EDGE-10 — advance and abort are distinct and advance keeps exhaustion loaded
✓ AC-22/AC-24 — asymmetric panel failure retains its sibling and records failed without deciding
✓ AC-20/AC-21/AC-27 — rework task starts from integration and receives an optional latest verdict
✓ EDGE-11 — legacy ticket history remains readable and unchanged
✓ AC-29/EDGE-13 — suite discovery and frozen contracts remain intact with no new dependency

──── q0011-run-history.js ────
✓ EDGE-21 — error category vocabulary is frozen and exhaustive
✓ EDGE-1 — task ownership remains two-vendor and disjoint

──── q0011-runs-cli.js ────
✓ AC-14 — real schema validation rejects structural mutations
[31m✗ [0mticket T-0001 is at stage "draft", flow "solutioning" consumes "requirements"
[31m✗ [0m1 of 2 parallel step(s) failed:
  - pm-claude: mock: simulated adapter failure for candidate-claude.md
  kept: pm-codex (already written to the ticket; a re-run will overwrite them)
Preparing worktree (checking out 'harness/T-0001/task-a')
✗ AC-1 — initialises exclusively before work and dry-run writes nothing
  non-dry run did not create exactly one manifest

0 !== 1

✗ AC-2/EDGE-7 — excludes history, leaks no environment, and persists relative paths
  expected exactly one persisted run manifest

0 !== 1

✗ AC-1 — fatal initialisation failure happens before adapter billing
  Missing expected rejection.
✗ AC-3/AC-4/AC-5/AC-8 — atomic manifest records every real occurrence and exact artifacts
  expected exactly one persisted run manifest

0 !== 1

✗ AC-9/AC-10/EDGE-4 — mock preserves per-call usage and billed failure detail
  Expected values to be strictly equal:

'mock' !== 'claude'

✗ AC-3 — parallel terminal updates retain both step records
  expected exactly one persisted run manifest

0 !== 1

✗ AC-9/EDGE-19 — unknown measures remain null and malformed mock switches fail explicitly
  Expected values to be strictly equal:
+ actual - expected

+ undefined
- null

✗ AC-8/AC-10 — retry wrapper exposes exact attempts and preserves billed usage on success and failure
  Expected values to be strictly equal:

3 !== 9

✗ AC-11 — roll-up groups reported usage without inventing cross-vendor money
  Missing expected rejection.
✗ EDGE-21 — structured-output and script failures map to their exact categories
  expected exactly one persisted run manifest

0 !== 1

✗ EDGE-2/EDGE-3 — integrate phases allocate one occurrence including empty command configuration
  expected exactly one persisted run manifest

0 !== 1

✗ AC-4/AC-5 — gates allocate nothing and script output is captured without a prompt
  expected exactly one persisted run manifest

0 !== 1

✗ AC-3/AC-10/EDGE-9 — signal finalisation records interruption while hard-kill state remains honestly running
  harness process never initialised its manifest
✗ EDGE-6 — post-initialisation persistence failures warn without discarding the run
  expected exactly one persisted run manifest

0 !== 1

✗ AC-4/EDGE-8 — backward edge revisits one id without overwriting either occurrence
  expected exactly one persisted run manifest

0 !== 1

✗ EDGE-5/EDGE-8/EDGE-14 — allocator does not collide, truncate, or emit exhausted
  expected exactly one persisted run manifest

0 !== 1


✗ 16 Q-0011 writer scenario group(s) failed
✗ q0011-run-history.js exited 1
✗ AC-12/EDGE-10/EDGE-11 — lists, filters, warns, and applies the specified selection grammar/order
  Expected "actual" to be strictly unequal to: 0
✗ AC-12 — missing history is an explicit successful empty state
  The input did not match the regular expression /no runs|empty/i. Input:

'harness — spike CLI. Commands:\n' +
  '  harness init [dir]                      copy templates into <dir>/harness and create backlog/\n' +
  '  harness ticket new "<title>" [--intent "..."] [--owner name]\n' +
  '  harness board                           kanban of tickets by stage\n' +
  '  harness run <flow> <ticket> [--auto] [--dry] [--adapter mock]\n' +
  '  harness lint                            lint all flows\n' +
  '  harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login\n' +
  '  harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure\n'

✗ AC-13/EDGE-9 — detail is ordered and honestly reports incomplete manifests
  The input did not match the regular expression /incomplete/i. Input:

'harness — spike CLI. Commands:\n' +
  '  harness init [dir]                      copy templates into <dir>/harness and create backlog/\n' +
  '  harness ticket new "<title>" [--intent "..."] [--owner name]\n' +
  '  harness board                           kanban of tickets by stage\n' +
  '  harness run <flow> <ticket> [--auto] [--dry] [--adapter mock]\n' +
  '  harness lint                            lint all flows\n' +
  '  harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login\n' +
  '  harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure\n'

✗ AC-13/EDGE-20 — detail exposes every attempt including usage-null failures and all contracted fields
  The input did not match the regular expression /steps\/001-step-1/. Input:

'harness — spike CLI. Commands:\n' +
  '  harness init [dir]                      copy templates into <dir>/harness and create backlog/\n' +
  '  harness ticket new "<title>" [--intent "..."] [--owner name]\n' +
  '  harness board                           kanban of tickets by stage\n' +
  '  harness run <flow> <ticket> [--auto] [--dry] [--adapter mock]\n' +
  '  harness lint                            lint all flows\n' +
  '  harness adapters [--probe] [--json]     CLIs installed + no API keys; --probe also proves login\n' +
  '  harness validate <schema.json> <file…>  check artifacts against a contract; exit 1 on failure\n'

✗ AC-13/EDGE-12 — --json is one ANSI-free document for list, detail, warning, and error modes
  Got unwanted exception: stdout must be one JSON document, got: harness — spike CLI. Commands:
  harness init [dir]                      copy templates into <dir>/harness and create ba
Actual message: "Unexpected token 'h', "harness — "... is not valid JSON"
✗ AC-14/EDGE-13 — annotation activates roll-up semantics and generic schemas announce skips
  Expected values to be strictly equal:

0 !== 1

✗ EDGE-15/EDGE-16 — semantic validation rejects duplicate occurrence directories and vendors
  Expected values to be strictly equal:

0 !== 1

✗ EDGE-17/EDGE-18 — semantic validation rejects lifecycle and kind/nullability contradictions
  Expected values to be strictly equal:

0 !== 1


✗ 8 Q-0011 CLI scenario group(s) failed
✗ q0011-runs-cli.js exited 1

✗ 2 of 4 test file(s) failed

```
