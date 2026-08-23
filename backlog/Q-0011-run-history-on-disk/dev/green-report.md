# Test output

```
2m·[0m architecture-review: wrote solution/review.md
[32m✓[0m [1marchitecture-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[33m![0m architecture-review: revise — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m architecture-review: iteration 1/2 → goto architect
[2m·[0m architect: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__contracts (harness/T-0001/contracts)
[2m·[0m architect: base harness/T-0001/integration does not exist yet — nothing to sync
[36m▸[0m [1marchitect[0m [2mmock role=principal-architect[0m
[2m·[0m architect: wrote solution/draft.md
[2m·[0m architect: 1 file(s) committed on harness/T-0001/contracts
[32m✓[0m [1marchitect[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1marchitecture-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m architecture-review: wrote solution/review.md
[32m✓[0m [1marchitecture-review[0m [2mverdict=approve cost=$0.010 20ms[0m
[36m▸[0m [1mfinalize[0m [2mmock role=principal-architect[0m
[2m·[0m finalize: wrote solution/solution.md
[32m✓[0m [1mfinalize[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mtasks[0m [2mmock role=principal-architect[0m
[2m·[0m tasks: wrote solution/tasks.yaml
[32m✓[0m [1mtasks[0m [2mcost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[36m▸[0m [1mmerge-contracts[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m merge-contracts: merged harness/T-0001/contracts
[32m✓[0m [1mmerge-contracts[0m [2m1 branch(es) on harness/T-0001/integration[0m
[2m·[0m run #2 completed: requirements → solutioned   cost $0.06  tokens 5851
✓ solutioning flow completes
✓ review loop bounced back to architect once
✓ solution.md written
✓ stage advanced to solutioned
✓ architect ran in its own worktree/branch
✓ user working tree untouched except backlog/
✓ tasks.yaml emitted
✓ contracts merged into ticket branch
[2m·[0m run #3  flow=qa-red  ticket=T-0001  solutioned → red
[36m▸[0m [1mscenarios[0m [2mmock/sonnet role=automation-qa[0m
[2m·[0m scenarios: wrote qa/scenarios.md
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[2m·[0m write-tests: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__tests (harness/T-0001/tests)
[36m▸[0m [1mwrite-tests[0m [2mmock role=automation-qa[0m
[2m·[0m write-tests: 1 file(s) committed on harness/T-0001/tests
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mprove-red[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m prove-red: merged harness/T-0001/tests
[2m·[0m prove-red: install exit 0
[2m·[0m prove-red: tests exit 1, expected fail
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[36m▸[0m [1mscenario-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m scenario-review: wrote qa/scenario-review.md
[32m✓[0m [1mscenario-review[0m [2mverdict=revise cost=$0.010 20ms[0m
[33m![0m scenario-review: revise — major: src/mock.ts:1 (mock) placeholder finding
[33m![0m scenario-review: iteration 1/1 → goto scenarios
[36m▸[0m [1mscenarios[0m [2mmock/sonnet role=automation-qa[0m
[2m·[0m scenarios: wrote qa/scenarios.md
[32m✓[0m [1mscenarios[0m [2mcost=$0.010 20ms[0m
[2m·[0m write-tests: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__tests (harness/T-0001/tests)
[2m·[0m write-tests: synced to harness/T-0001/integration
[36m▸[0m [1mwrite-tests[0m [2mmock role=automation-qa[0m
[2m·[0m write-tests: no file changes on harness/T-0001/tests
[32m✓[0m [1mwrite-tests[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mprove-red[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m prove-red: merged harness/T-0001/tests
[2m·[0m prove-red: install exit 0
[2m·[0m prove-red: tests exit 1, expected fail
[32m✓[0m [1mprove-red[0m [2m1 branch(es) on harness/T-0001/integration, tests red as expected[0m
[36m▸[0m [1mscenario-review[0m [2mmock/opus role=architecture-reviewer[0m
[2m·[0m scenario-review: wrote qa/scenario-review.md
[32m✓[0m [1mscenario-review[0m [2mverdict=approve cost=$0.010 20ms[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #3 completed: solutioned → red   cost $0.06  tokens 5287
✓ qa-red flow completes
✓ suite proven red on the ticket branch
✓ stage advanced to red
[2m·[0m run #4  flow=development  ticket=T-0001  red → green
[2m·[0m developers: 2 task(s) in 2 wave(s)
[2m·[0m developers: wave 1: T-0001.1(backend)
[2m·[0m dev:T-0001.1: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__T-0001.1 (harness/T-0001/T-0001.1)
[2m·[0m dev:T-0001.1: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.1[0m [2mmock role=developer-backend[0m
[2m·[0m dev:T-0001.1: 1 file(s) committed on harness/T-0001/T-0001.1
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[2m·[0m developers: wave 2: T-0001.2(frontend)
[2m·[0m dev:T-0001.2: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__T-0001.2 (harness/T-0001/T-0001.2)
[2m·[0m dev:T-0001.2: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.2[0m [2mmock/sonnet role=developer-frontend[0m
[2m·[0m dev:T-0001.2: no file changes on harness/T-0001/T-0001.2
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mintegrate[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m integrate: merged harness/T-0001/T-0001.1
[2m·[0m integrate: merged harness/T-0001/T-0001.2
[2m·[0m integrate: install exit 0
[33m![0m integrate: tests exit 1, expected pass
[33m![0m integrate: iteration 1/3 → goto developers
[33m![0m developers: scoped to failing tasks: T-0001.1, T-0001.2
[2m·[0m developers: 2 task(s) in 2 wave(s)
[2m·[0m developers: wave 1: T-0001.1(backend)
[2m·[0m dev:T-0001.1: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__T-0001.1 (harness/T-0001/T-0001.1)
[2m·[0m dev:T-0001.1: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.1[0m [2mmock role=developer-backend[0m
[2m·[0m dev:T-0001.1: 1 file(s) committed on harness/T-0001/T-0001.1
[32m✓[0m [1mdev:T-0001.1[0m [2mcost=$0.010 20ms[0m
[2m·[0m developers: wave 2: T-0001.2(frontend)
[2m·[0m dev:T-0001.2: worktree /private/var/folders/7j/zkvx86bd4ns6ppww3ddpynj00000gn/T/harness-smoke-e2wBtx/.harness/worktrees/harness__T-0001__T-0001.2 (harness/T-0001/T-0001.2)
[2m·[0m dev:T-0001.2: synced to harness/T-0001/integration
[36m▸[0m [1mdev:T-0001.2[0m [2mmock/sonnet role=developer-frontend[0m
[2m·[0m dev:T-0001.2: 1 file(s) committed on harness/T-0001/T-0001.2
[32m✓[0m [1mdev:T-0001.2[0m [2mcost=$0.010 20ms[0m
[36m▸[0m [1mintegrate[0m [2mintegrate → harness/T-0001/integration[0m
[2m·[0m integrate: merged harness/T-0001/T-0001.1
[2m·[0m integrate: merged harness/T-0001/T-0001.2
[2m·[0m integrate: install exit 0
[2m·[0m integrate: tests exit 0, expected pass
[32m✓[0m [1mintegrate[0m [2m2 branch(es) on harness/T-0001/integration, tests green[0m
[2m·[0m gate: auto-advanced (human)
[2m·[0m run #4 completed: red → green   cost $0.04  tokens 4429
✓ development flow completes
✓ tasks fanned out in dependency waves
✓ failed integration re-ran fan-out scoped to failing tasks
✓ integrated branch is green
✓ stage advanced to green
✓ ticket branch holds contracts, tests and both implementations
✓ user working tree still untouched
✓ integrate runs commands.install in the integration worktree before the tests
[32m✓[0m T-0002 created at backlog/T-0002-second-ticket (stage: draft)
[31m✗ [0mticket T-0001 is at stage "draft", flow "solutioning" consumes "requirements"

```
