# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[35m@quorum/templates:test: [0mcache bypass, force executing [2m0494cd0d3e64008f[0m
[36m@quorum/compiler:test: [0mcache bypass, force executing [2m6253ff1707ff70a6[0m
[32m@quorum/shared:test: [0mcache bypass, force executing [2m676201fc6d6119c4[0m
[32m@quorum/shared:test: [0m
[32m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared
[32m@quorum/shared:test: [0m> vitest run
[32m@quorum/shared:test: [0m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates
[35m@quorum/templates:test: [0m> vitest run
[35m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler
[36m@quorum/compiler:test: [0m> vitest run
[36m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m
[32m@quorum/shared:test: [0m
[36m@quorum/compiler:test: [0m
[32m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared[39m
[36m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler[39m
[35m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates[39m
[35m@quorum/templates:test: [0m
[32m@quorum/shared:test: [0m
[36m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m   Start at [22m 01:25:34
[35m@quorum/templates:test: [0m[2m   Duration [22m 153ms[2m (transform 13ms, setup 0ms, import 20ms, tests 1ms, environment 0ms)[22m
[35m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m   Start at [22m 01:25:34
[36m@quorum/compiler:test: [0m[2m   Duration [22m 155ms[2m (transform 12ms, setup 0ms, import 19ms, tests 1ms, environment 0ms)[22m
[36m@quorum/compiler:test: [0m
[32m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 7[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 2[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 18[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 25[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 40[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 70[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m59 tests[22m[2m)[22m[32m 67[2mms[22m[39m
[32m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 116[2mms[22m[39m
[32m@quorum/shared:test: [0m
[32m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m13 passed[39m[22m[90m (13)[39m
[32m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m185 passed[39m[22m[90m (185)[39m
[32m@quorum/shared:test: [0m[2m   Start at [22m 01:25:34
[32m@quorum/shared:test: [0m[2m   Duration [22m 363ms[2m (transform 729ms, setup 0ms, import 1.64s, tests 379ms, environment 1ms)[22m
[32m@quorum/shared:test: [0m
[33m@quorum/core:test: [0mcache bypass, force executing [2m3ce1dde14b3b1539[0m
[34m@quorum/web:test: [0mcache bypass, force executing [2m7cb534192ba9b776[0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core
[33m@quorum/core:test: [0m> vitest run
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web
[34m@quorum/web:test: [0m> vitest run
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web[39m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core[39m
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m [32m✓[39m src/connection-state.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 2[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/daemon-endpoints.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/routes.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m19 tests[22m[2m)[22m[32m 23[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/lint-coverage.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 508[2mms[22m[39m
[34m@quorum/web:test: [0m     [33m[2m✓[22m[39m and ESLint itself resolves the three rules for a .tsx file, at error severity [33m 504[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/shell.test.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 72[2mms[22m[39m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m[2m Test Files [22m [1m[32m10 passed[39m[22m[90m (10)[39m
[34m@quorum/web:test: [0m[2m      Tests [22m [1m[32m136 passed[39m[22m[90m (136)[39m
[34m@quorum/web:test: [0m[2m   Start at [22m 01:25:35
[34m@quorum/web:test: [0m[2m   Duration [22m 1.03s[2m (transform 515ms, setup 0ms, import 952ms, tests 643ms, environment 664ms)[22m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/engine.test.ts [2m([22m[2m20 tests[22m[2m)[22m[33m 2580[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/agent-run.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 3080[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-4b — the run's override, then the step's, then the role's, then claude [33m 448[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-5d — a missing key, a bad enum member and an undeclared property each stop the step [33m 311[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m an occurrence records the branch it ran on and a REPOSITORY-RELATIVE worktree [33m 345[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/run-composition.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 3564[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m the merge an aborted run made is rolled back, and the rollback says so [33m 345[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/adapters/registry.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 3695[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m claude resolves to a retry-wrapped adapter billing under its own name [33m 380[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m codex resolves to a retry-wrapped adapter billing under its own name [33m 1049[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m each vendor's harness.yaml entry reaches that vendor's argv, and not the other's [33m 2249[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/agent-step.test.ts [2m([22m[2m14 tests[22m[2m)[22m[33m 3682[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-7b/7c — an existing branch is synced to its base, and the sync says so [33m 324[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-7c — a merge that conflicts warns with git's reason, never an empty one [33m 378[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-7d — more than four discarded paths are cut to four and say so [33m 321[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/backlog/scaffold.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 445[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/test-command.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 563[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/run-lock.test.ts [2m([22m[2m16 tests[22m[2m)[22m[33m 1723[2mms[22m[39m
[33m@quorum/core:test: [0m[90mstderr[2m | src/run-history/writer.test.ts[2m > [22m[2mQ-0039 AC-2/AC-7/AC-10 — the claim is exclusive, its subject is the ticket, and a refusal states a condition[2m > [22m[2ma create that succeeds and then fails takes back the file it made, and names the first failure
[33m@quorum/core:test: [0m[22m[39mwarning: could not add .quorum/ to /tmp/q0042-repo-jUnmdY/.git/info/exclude: no space left on device
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/steps.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 297[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/backlog/backlog.test.ts [2m([22m[2m78 tests[22m[2m)[22m[33m 322[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/caught-failures.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 260[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/turbo-inputs.test.ts [2m([22m[2m63 tests[22m

… 29878 characters of output omitted from the middle …

trees/harness__Q-0120__integration/packages/server[39m
[35m@quorum/server:test: [0m
[35m@quorum/server:test: [0m [32m✓[39m src/gates.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/broadcast.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 160[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m23 tests[22m[2m)[22m[33m 635[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 550[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 841[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and loading the frame adds none at runtime — which is now AC-11(1) as well [33m 429[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 255[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m29 tests[22m[2m)[22m[33m 666[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 70[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 236[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 27[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 177[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/read.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 1110[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 8[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 7[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/serve.test.ts [2m([22m[2m12 tests[22m[2m)[22m[33m 1182[2mms[22m[39m
[35m@quorum/server:test: [0m     [33m[2m✓[22m[39m a client that walks away releases its subscription, so the run is not fanned out to a ghost [33m 334[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m47 tests[22m[2m)[22m[33m 950[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/http.test.ts [2m([22m[2m24 tests[22m[2m)[22m[33m 1590[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 1306[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 1309[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2450[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2648[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 563[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 485[2mms[22m[39m
[35m@quorum/server:test: [0m [32m✓[39m src/host.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 3791[2mms[22m[39m
[35m@quorum/server:test: [0m
[35m@quorum/server:test: [0m[2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m
[35m@quorum/server:test: [0m[2m      Tests [22m [1m[32m129 passed[39m[22m[90m (129)[39m
[35m@quorum/server:test: [0m[2m   Start at [22m 01:26:05
[35m@quorum/server:test: [0m[2m   Duration [22m 4.36s[2m (transform 1.80s, setup 0ms, import 3.02s, tests 8.35s, environment 1ms)[22m
[35m@quorum/server:test: [0m
[36m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 5091[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6917[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 2062[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1333[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1319[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1099[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1093[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6530[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a passing run answered advance completes and exits 0 [33m 369[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --gate-answer abort ends the run aborted and exits 2 [33m 322[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a backward edge to another flow regresses the ticket, and 0 is the ruled answer [33m 303[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m exit 3 is its own code, nothing is rolled back, and the stage does not move [33m 307[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 355[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 7536[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 8061[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m40 tests[22m[2m)[22m[33m 7819[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the hint names the first flow consuming that stage, sorted rather than in directory order [33m 306[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 303[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 375[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 461[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 369[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 329[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 326[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 516[2mms[22m[39m
[36m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m65 tests[22m[2m)[22m[33m 35334[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 3869[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 3044[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 2749[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 2749[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 2757[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 2579[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 385[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 675[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 728[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 823[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 2929[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 1356[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 944[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 3018[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 641[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 622[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 657[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 653[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 660[2mms[22m[39m
[36m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 418[2mms[22m[39m
[36m@quorum/cli:test: [0m
[36m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m25 passed[39m[22m[90m (25)[39m
[36m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m628 passed[39m[22m[90m (628)[39m
[36m@quorum/cli:test: [0m[2m   Start at [22m 01:26:05
[36m@quorum/cli:test: [0m[2m   Duration [22m 35.64s[2m (transform 5.20s, setup 0ms, import 7.65s, tests 88.38s, environment 1ms)[22m
[36m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m7 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m6.979s[0m [0m


```
