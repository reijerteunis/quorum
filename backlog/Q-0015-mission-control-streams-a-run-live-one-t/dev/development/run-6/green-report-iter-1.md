# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[32m@quorum/templates:test: [0mcache bypass, force executing [2m21ad9f624311426b[0m
[35m@quorum/shared:test: [0mcache bypass, force executing [2m0149c12a59beee9e[0m
[36m@quorum/compiler:test: [0mcache bypass, force executing [2m3e89b576fb1a8333[0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler
[36m@quorum/compiler:test: [0m> vitest run
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared
[35m@quorum/shared:test: [0m> vitest run
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates
[32m@quorum/templates:test: [0m> vitest run
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates[39m
[36m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler[39m
[36m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared[39m
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[36m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m   Start at [22m 01:48:26
[32m@quorum/templates:test: [0m[2m   Duration [22m 119ms[2m (transform 9ms, setup 0ms, import 14ms, tests 1ms, environment 0ms)[22m
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m   Start at [22m 01:48:26
[36m@quorum/compiler:test: [0m[2m   Duration [22m 120ms[2m (transform 9ms, setup 0ms, import 14ms, tests 1ms, environment 0ms)[22m
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 16[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 25[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 13[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 37[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 65[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m85 tests[22m[2m)[22m[32m 83[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 142[2mms[22m[39m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m14 passed[39m[22m[90m (14)[39m
[35m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m247 passed[39m[22m[90m (247)[39m
[35m@quorum/shared:test: [0m[2m   Start at [22m 01:48:26
[35m@quorum/shared:test: [0m[2m   Duration [22m 363ms[2m (transform 1.08s, setup 0ms, import 1.83s, tests 424ms, environment 1ms)[22m
[35m@quorum/shared:test: [0m
[33m@quorum/web:test: [0mcache bypass, force executing [2me0fb208359098657[0m
[34m@quorum/core:test: [0mcache bypass, force executing [2m91f5bf426d08ba99[0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core
[34m@quorum/core:test: [0m> vitest run
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web
[33m@quorum/web:test: [0m> vitest run
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web[39m
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core[39m
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m [32m✓[39m src/request-state.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/connection-state.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/routes.test.ts [2m([22m[2m34 tests[22m[2m)[22m[32m 21[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 140[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/daemon-client.test.ts [2m([22m[2m47 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 23[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/q0050.source.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 31[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/mission-control-model.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/test-discovery.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 29[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 23[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/lint/lint.test.ts [2m([22m[2m120 tests[22m[2m)[22m[32m 137[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/caught-failures.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[33m 492[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/daemon-endpoints.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 645[2mms[22m[39m
[33m@quorum/web:test: [0m     [33m[2m✓[22m[39m Q-0126 AC-5 — the dev proxy and `quorum open` resolve one declared port, not two literals [33m 629[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/mission-control-status.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 101[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/cli-version.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 168[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle-routing.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 34[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/lint-coverage.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 774[2mms[22m[39m
[33m@quorum/web:test: [0m     [33m[2m✓[22m[39m and ESLint itself resolves the three rules for a .tsx file, at error severity [33m 770[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/mission-control-trace.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 68[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/test-command.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 737[2mms[22m[39m
[34m@quorum/core:test: [0m     [33m[2m✓[22m[39m a variable this repository declares arrives; one it does not is stripped [33m 310[2mms[22m[39m
[34m@quorum/core:test: [0m     [33m[2m✓[22m[39m and the declaration is load-bearing: the same task without it strips the switch too [33m 318[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/adapters.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 118[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/runs-screen.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 42[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/backlog-board.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 123[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/mission-control-screen.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 49[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/ticket-page.test.ts [2m([22m[2m25 tests[22m[2m)[22m[32m 183[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/run-history/reader.test.ts [2m([22m[2m29 tests[22m[2m)[22m[32m 77[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/backlog/backlog.test.ts [2m([22m[2m84 tests[22m[2m)[22m[33m 576[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/shell.test.ts [2m([22m[2m41 tests[22m[2m)[22m[32m 133[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/gate-screen.test.ts [2m([22m[2m43 tests[22m[2m)[22m[32m 164[2mms[22m[39m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[2m Test Files [22m [1m[32m20 passed[39m[22m[90m (20)[39m
[33m@quorum/web:test: [0m[2m      Tests [22m [1m[32m356 passed[39m[22m[90m (356)[39m
[33m@quorum/web:test: [0m[2m   Start at [22m 01:48:27
[33m@quorum/web:test: [0m[2m   Duration [22m 1.45s[2m (transform 1.90s, setup 0ms, import 3.93s, tests 2.50s, environment 5.57s)[22m
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m [32m✓[39m src/browser/browser.source.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 92[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/git-identity.test.ts

… 32600 characters of output omitted from the middle …

sts[22m[2m)[22m[33m 2263[2mms[22m[39m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[2m Test Files [22m [1m[32m9 passed[39m[22m[90m (9)[39m
[36m@quorum/server:test: [0m[2m      Tests [22m [1m[32m212 passed[39m[22m[90m (212)[39m
[36m@quorum/server:test: [0m[2m   Start at [22m 01:49:03
[36m@quorum/server:test: [0m[2m   Duration [22m 2.61s[2m (transform 1.38s, setup 0ms, import 2.27s, tests 7.23s, environment 0ms)[22m
[36m@quorum/server:test: [0m
[35m@quorum/cli:test: [0mcache bypass, force executing [2mc1d0c046d078180a[0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m> @quorum/cli@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli
[35m@quorum/cli:test: [0m> vitest run
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 17[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m25 tests[22m[2m)[22m[33m 423[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 349[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 168[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m48 tests[22m[2m)[22m[33m 636[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 256[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 59[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 112[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 212[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/open.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 575[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and 0 is accepted, because that is the one value the daemon already gives a meaning [33m 406[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 707[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 864[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 907[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2059[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2334[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 465[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 350[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6296[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a passing run answered advance completes and exits 0 [33m 310[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 330[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 307[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 6333[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6698[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1731[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1336[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1291[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1229[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1102[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m44 tests[22m[2m)[22m[33m 7958[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 398[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 508[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-10 — a project with no remote gains not one word, and neither does a pushed one [33m 302[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 409[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 314[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 362[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 340[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 517[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 9276[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 9694[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m87 tests[22m[2m)[22m[33m 66479[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 5426[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 4481[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 4020[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0122 AC-3(b) — a rebuild drops what the current source no longer produces, in every emit [33m 7746[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 4129[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 4167[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a stale emit is cleared, and what replaces it is the production modules and no test [33m 3946[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `exclude` is load-bearing — without it the build stops rather than emitting [33m 3011[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 4021[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 588[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 657[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 895[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-7 — the EMITTED open module resolves the daemon statically, never from an expression [33m 523[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 956[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 4491[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 2237[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 1562[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-2(d) — and what each packer writes for @quorum/web's dev-section workspace range is measured [33m 487[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 4573[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 881[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 834[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 714[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 791[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 785[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 511[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m26 passed[39m[22m[90m (26)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m692 passed[39m[22m[90m (692)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 01:49:06
[35m@quorum/cli:test: [0m[2m   Duration [22m 66.76s[2m (transform 4.37s, setup 0ms, import 7.27s, tests 122.08s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m7 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m47.999s[0m [0m


```
