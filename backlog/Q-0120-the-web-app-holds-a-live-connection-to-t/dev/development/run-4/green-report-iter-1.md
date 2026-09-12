# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[32m@quorum/templates:test: [0mcache bypass, force executing [2m7ee4f36fb3139073[0m
[35m@quorum/compiler:test: [0mcache bypass, force executing [2m7da2b26c6cba408c[0m
[36m@quorum/shared:test: [0mcache bypass, force executing [2me29ae46fb5f654a5[0m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared
[36m@quorum/shared:test: [0m> vitest run
[36m@quorum/shared:test: [0m
[35m@quorum/compiler:test: [0m
[35m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler
[35m@quorum/compiler:test: [0m> vitest run
[35m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates
[32m@quorum/templates:test: [0m> vitest run
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m
[35m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates[39m
[32m@quorum/templates:test: [0m
[35m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler[39m
[35m@quorum/compiler:test: [0m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared[39m
[36m@quorum/shared:test: [0m
[35m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[35m@quorum/compiler:test: [0m
[35m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/compiler:test: [0m[2m   Start at [22m 01:09:10
[35m@quorum/compiler:test: [0m[2m   Duration [22m 120ms[2m (transform 11ms, setup 0ms, import 17ms, tests 1ms, environment 0ms)[22m
[35m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m   Start at [22m 01:09:10
[32m@quorum/templates:test: [0m[2m   Duration [22m 125ms[2m (transform 12ms, setup 0ms, import 19ms, tests 1ms, environment 0ms)[22m
[32m@quorum/templates:test: [0m
[36m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 7[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 19[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 26[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 37[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m59 tests[22m[2m)[22m[32m 69[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 69[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 122[2mms[22m[39m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m13 passed[39m[22m[90m (13)[39m
[36m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m185 passed[39m[22m[90m (185)[39m
[36m@quorum/shared:test: [0m[2m   Start at [22m 01:09:10
[36m@quorum/shared:test: [0m[2m   Duration [22m 322ms[2m (transform 669ms, setup 0ms, import 1.46s, tests 393ms, environment 1ms)[22m
[36m@quorum/shared:test: [0m
[34m@quorum/core:test: [0mcache bypass, force executing [2m8fa301693e527d02[0m
[33m@quorum/web:test: [0mcache bypass, force executing [2mfb122723ffa96c69[0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web
[33m@quorum/web:test: [0m> vitest run
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core
[34m@quorum/core:test: [0m> vitest run
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web[39m
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core[39m
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/connection-state.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 2[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/daemon-endpoints.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m19 tests[22m[2m)[22m[32m 25[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/routes.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 13[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/q0050.source.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 30[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 20[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/lint/lint.test.ts [2m([22m[2m120 tests[22m[2m)[22m[32m 125[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/caught-failures.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[33m 328[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/cli-version.test.ts [2m([22m[2m36 tests[22m[2m)[22m[32m 145[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle-routing.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 35[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/lint-coverage.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 519[2mms[22m[39m
[33m@quorum/web:test: [0m     [33m[2m✓[22m[39m and ESLint itself resolves the three rules for a .tsx file, at error severity [33m 516[2mms[22m[39m
[33m@quorum/web:test: [0m [31m❯[39m src/shell.test.ts [2m([22m[2m0 test[22m[2m)[22m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[31m⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Suites 1 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[41m[1m FAIL [22m[49m src/shell.test.ts[2m [ src/shell.test.ts ][22m
[33m@quorum/web:test: [0m[31m[1mError[22m: Failed to resolve import "@quorum/shared" from "src/frame-parser.ts". Does the file exist?[39m
[33m@quorum/web:test: [0m  Plugin: [35mvite:import-analysis[39m
[33m@quorum/web:test: [0m  File: [36m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web/src/frame-parser.ts[39m:1:77
[33m@quorum/web:test: [0m[33m  1  |  import { eventSchema, wireMessageSchema } from "@quorum/shared";
[33m@quorum/web:test: [0m     |                                                  ^
[33m@quorum/web:test: [0m  2  |  /** True for the binary WebSocket message shapes a text-only protocol refuses. */
[33m@quorum/web:test: [0m  3  |  function isBinaryMessage(data) {[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m TransformPluginContext._formatLog ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m31147:39[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m TransformPluginContext.error ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m31144:14[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m normalizeUrl ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m28083:18[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m28153:30[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m TransformPluginContext.transform ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m28119:4[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m EnvironmentPluginContainer.transform ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m30932:14[22m[39m
[33m@quorum/web:test: [0m[90m [2m❯[22m loadAndTransform ../../node_modules/.pnpm/vite@8.2.2_@types+node@26.3.0_jiti@2.7.0_yaml@2.9.0/node_modules/vite/dist/node/chunks/node.js:[2m20671:26[22m[39m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[2m Test Files [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m9 passed[39m[22m[90m (10)[39m
[33m@quorum/web:test: [0m[2m      Tests [22m [1m[32m99 passed[39m[22m[90m (99)[39m
[33m@quorum/web:test: [0m[2m   Start at [22m 01:09:11
[33m@quorum/web:test: [0m[2m   Duration [22m 886ms[2m (transform 421ms, setup 0ms, import 769ms, tests 587ms, environment 639ms)[22m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[41m[30m ELIFECYCLE [39m[49m [31mTest failed. See above for more details.[39m
[34m@quorum/core:test: [0m [32

… 34563 characters of output omitted from the middle …

solves [33m 489[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 195[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 213[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 728[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[33m 364[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 90[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m29 tests[22m[2m)[22m[33m 784[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 391[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m47 tests[22m[2m)[22m[33m 1014[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m every invocation shape leaves the working tree and the ref namespace as it found them [33m 341[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/read.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 1268[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/serve.test.ts [2m([22m[2m12 tests[22m[2m)[22m[33m 1380[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 1275[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 1359[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/http.test.ts [2m([22m[2m24 tests[22m[2m)[22m[33m 1655[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2725[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2793[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 707[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 467[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/host.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 3824[2mms[22m[39m
[36m@quorum/server:test: [0m     [33m[2m✓[22m[39m two runs of one host take two handles, and a handle nobody minted answers nothing [33m 393[2mms[22m[39m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m
[36m@quorum/server:test: [0m[2m      Tests [22m [1m[32m129 passed[39m[22m[90m (129)[39m
[36m@quorum/server:test: [0m[2m   Start at [22m 01:09:41
[36m@quorum/server:test: [0m[2m   Duration [22m 4.39s[2m (transform 1.61s, setup 0ms, import 2.98s, tests 8.92s, environment 0ms)[22m
[36m@quorum/server:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 4562[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6773[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a passing run answered advance completes and exits 0 [33m 435[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --gate-answer abort ends the run aborted and exits 2 [33m 350[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m exit 3 is its own code, nothing is rolled back, and the stage does not move [33m 318[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 370[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 330[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a run installs one SIGINT and one SIGTERM listener and removes both, twice over [33m 322[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6609[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1876[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1321[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1195[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1107[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1101[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 7516[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 8076[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m40 tests[22m[2m)[22m[33m 8104[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m every stage with tickets renders, plus the three that always do, in STAGES order [33m 333[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the hint names the first flow consuming that stage, sorted rather than in directory order [33m 338[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 306[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 405[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 493[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 361[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 302[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 347[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 329[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 517[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m65 tests[22m[2m)[22m[33m 35879[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 4129[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 3080[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 2735[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 2767[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 2795[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 2587[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 384[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 690[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 752[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 830[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 3032[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 1382[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 946[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 3039[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 685[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 635[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 642[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 660[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 655[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 413[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m25 passed[39m[22m[90m (25)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m628 passed[39m[22m[90m (628)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 01:09:41
[35m@quorum/cli:test: [0m[2m   Duration [22m 36.19s[2m (transform 4.32s, setup 0ms, import 6.73s, tests 89.32s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m6 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m8.333s[0m [0m
[1mFailed:    [31m[1m@quorum/web#test[0m[0m

• turbo 2.10.11
[1m@quorum/web#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/web#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[31;40m ERROR [0m [31;49mrun failed: command  exited (1)[0m

```
