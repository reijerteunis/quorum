# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[35m@quorum/templates:test: [0mcache bypass, force executing [2m15489863b6d94789[0m
[32m@quorum/compiler:test: [0mcache bypass, force executing [2mb7651ea5eed01b6c[0m
[36m@quorum/shared:test: [0mcache bypass, force executing [2mb5a99a2acd4fc306[0m
[32m@quorum/compiler:test: [0m
[32m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler
[32m@quorum/compiler:test: [0m> vitest run
[32m@quorum/compiler:test: [0m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared
[36m@quorum/shared:test: [0m> vitest run
[36m@quorum/shared:test: [0m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates
[35m@quorum/templates:test: [0m> vitest run
[35m@quorum/templates:test: [0m
[36m@quorum/shared:test: [0m
[35m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m
[36m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared[39m
[36m@quorum/shared:test: [0m
[32m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler[39m
[32m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates[39m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m   Start at [22m 01:13:59
[35m@quorum/templates:test: [0m[2m   Duration [22m 116ms[2m (transform 13ms, setup 0ms, import 20ms, tests 1ms, environment 0ms)[22m
[35m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/compiler:test: [0m
[32m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m   Start at [22m 01:13:59
[32m@quorum/compiler:test: [0m[2m   Duration [22m 119ms[2m (transform 12ms, setup 0ms, import 20ms, tests 1ms, environment 0ms)[22m
[32m@quorum/compiler:test: [0m
[36m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 16[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 26[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 13[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 39[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 69[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m85 tests[22m[2m)[22m[32m 90[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 147[2mms[22m[39m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m14 passed[39m[22m[90m (14)[39m
[36m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m247 passed[39m[22m[90m (247)[39m
[36m@quorum/shared:test: [0m[2m   Start at [22m 01:13:59
[36m@quorum/shared:test: [0m[2m   Duration [22m 334ms[2m (transform 846ms, setup 0ms, import 1.69s, tests 442ms, environment 1ms)[22m
[36m@quorum/shared:test: [0m
[33m@quorum/core:test: [0mcache bypass, force executing [2m3f866c8e61331a8e[0m
[34m@quorum/web:test: [0mcache bypass, force executing [2ma8fe5f64fc18023c[0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core
[33m@quorum/core:test: [0m> vitest run
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web
[34m@quorum/web:test: [0m> vitest run
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core[39m
[34m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web[39m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m [32m✓[39m test/routes.test.ts [2m([22m[2m34 tests[22m[2m)[22m[32m 19[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/request-state.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 169[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/daemon-client.test.ts [2m([22m[2m47 tests[22m[2m)[22m[32m 14[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 20[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/mission-control-model.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/daemon-endpoints.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 131[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/connection-state.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 2[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 3[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m test/lint-coverage.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 500[2mms[22m[39m
[34m@quorum/web:test: [0m     [33m[2m✓[22m[39m and ESLint itself resolves the three rules for a .tsx file, at error severity [33m 497[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/mission-control-trace.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 19[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/mission-control-status.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 67[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/runs-screen.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 35[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/backlog-board.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 79[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/mission-control-screen.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 47[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/ticket-page.test.ts [2m([22m[2m25 tests[22m[2m)[22m[32m 147[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/shell.test.ts [2m([22m[2m41 tests[22m[2m)[22m[32m 113[2mms[22m[39m
[34m@quorum/web:test: [0m [32m✓[39m src/gate-screen.test.ts [2m([22m[2m43 tests[22m[2m)[22m[32m 135[2mms[22m[39m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m[2m Test Files [22m [1m[32m20 passed[39m[22m[90m (20)[39m
[34m@quorum/web:test: [0m[2m      Tests [22m [1m[32m355 passed[39m[22m[90m (355)[39m
[34m@quorum/web:test: [0m[2m   Start at [22m 01:14:00
[34m@quorum/web:test: [0m[2m   Duration [22m 1.27s[2m (transform 2.09s, setup 0ms, import 3.55s, tests 1.52s, environment 5.05s)[22m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/engine.test.ts [2m([22m[2m20 tests[22m[2m)[22m[33m 2399[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/agent-run.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 2765[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-4b — the run's override, then the step's, then the role's, then claude [33m 518[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-5d — a missing key, a bad enum member and an undeclared property each stop the step [33m 309[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/run-composition.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 3191[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m the merge an aborted run made is rolled back, and the rollback says so [33m 340[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/engine/agent-step.test.ts [2m([22m[2m14 tests[22m[2m)[22m[33m 3271[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-7b/7c — an existing branch is synced to its base, and the sync says so [33m 310[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m AC-7c — a merge that conflicts warns with git's reason, never an empty one [33m 378[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/adapters/registry.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 3772[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m codex resolves to a retry-wrapped adapter billing under its own name [33m 912[2mms[22m[39m
[33m@quorum/core:test: [0m     [33m[2m✓[22m[39m each vendor's harness.yaml entry reaches that vendor's argv, and not the other's [33m 2583[2mms[22m[39m
[33m@quorum/core:test: [0m [32m✓[39m src/backlog/backlog.test.ts [2m([22m[2m84 tests[22m[2m)[22m[33m 540[2mms[22m[39m
[33m@quorum/core:test: [0m[90mstderr[2m | src/run-history/writer.test.ts[2m > [22m[2mQ-0039 AC-2/AC-7/AC-10 — the claim is exclusive, its subject is the ticket, and a refusal states a condition[2m > [22m[2ma create that succeeds and then fails takes

… 31384 characters of output omitted from the middle …

0m[2m      Tests [22m [1m[32m212 passed[39m[22m[90m (212)[39m
[36m@quorum/server:test: [0m[2m   Start at [22m 01:14:36
[36m@quorum/server:test: [0m[2m   Duration [22m 2.70s[2m (transform 1.43s, setup 0ms, import 2.35s, tests 7.43s, environment 0ms)[22m
[36m@quorum/server:test: [0m
[35m@quorum/cli:test: [0mcache bypass, force executing [2m740ec41e93b53e13[0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m> @quorum/cli@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli
[35m@quorum/cli:test: [0m> vitest run
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m25 tests[22m[2m)[22m[33m 454[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 389[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m48 tests[22m[2m)[22m[33m 624[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 202[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 89[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/open.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 537[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and 0 is accepted, because that is the one value the daemon already gives a meaning [33m 405[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 694[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 190[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 86[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 20[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 844[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 949[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 20[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 150[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2245[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2402[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 378[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 397[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 6845[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6997[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1740[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1488[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1289[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1318[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1131[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6593[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 337[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 323[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a run installs one SIGINT and one SIGTERM listener and removes both, twice over [33m 324[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m44 tests[22m[2m)[22m[33m 8176[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 394[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 334[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 536[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-10 — a project with no remote gains not one word, and neither does a pushed one [33m 308[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 401[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 323[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 365[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 340[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 526[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 9507[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 9880[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m87 tests[22m[2m)[22m[33m 67778[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 5609[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 4500[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 4182[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0122 AC-3(b) — a rebuild drops what the current source no longer produces, in every emit [33m 7909[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 4180[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 4246[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a stale emit is cleared, and what replaces it is the production modules and no test [33m 3934[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `exclude` is load-bearing — without it the build stops rather than emitting [33m 3130[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 4216[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 498[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 841[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 1099[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-7 — the EMITTED open module resolves the daemon statically, never from an expression [33m 307[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 979[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 4448[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 2291[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 1554[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-2(d) — and what each packer writes for @quorum/web's dev-section workspace range is measured [33m 499[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 4826[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 815[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 746[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 769[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 732[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 729[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 525[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m26 passed[39m[22m[90m (26)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m692 passed[39m[22m[90m (692)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 01:14:39
[35m@quorum/cli:test: [0m[2m   Duration [22m 68.10s[2m (transform 4.48s, setup 0ms, import 7.39s, tests 125.30s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m7 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m48.415s[0m [0m


```
