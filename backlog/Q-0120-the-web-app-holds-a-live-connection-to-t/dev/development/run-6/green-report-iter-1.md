# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[35m@quorum/shared:test: [0mcache bypass, force executing [2m14c9a97e90001183[0m
[36m@quorum/templates:test: [0mcache bypass, force executing [2m670cd8e101ceecbf[0m
[32m@quorum/compiler:test: [0mcache bypass, force executing [2me69edbdae925875a[0m
[32m@quorum/compiler:test: [0m
[32m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler
[32m@quorum/compiler:test: [0m> vitest run
[32m@quorum/compiler:test: [0m
[36m@quorum/templates:test: [0m
[36m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates
[36m@quorum/templates:test: [0m> vitest run
[36m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared
[35m@quorum/shared:test: [0m> vitest run
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m
[32m@quorum/compiler:test: [0m
[36m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared[39m
[35m@quorum/shared:test: [0m
[32m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler[39m
[32m@quorum/compiler:test: [0m
[36m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates[39m
[36m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[36m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/compiler:test: [0m
[36m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m   Start at [22m 08:30:01
[36m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m   Duration [22m 121ms[2m (transform 9ms, setup 0ms, import 15ms, tests 1ms, environment 0ms)[22m
[36m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/templates:test: [0m[2m   Start at [22m 08:30:01
[36m@quorum/templates:test: [0m[2m   Duration [22m 121ms[2m (transform 10ms, setup 0ms, import 16ms, tests 1ms, environment 0ms)[22m
[32m@quorum/compiler:test: [0m
[36m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 8[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 15[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 25[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 38[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 59[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m59 tests[22m[2m)[22m[32m 58[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 116[2mms[22m[39m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m13 passed[39m[22m[90m (13)[39m
[35m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m185 passed[39m[22m[90m (185)[39m
[35m@quorum/shared:test: [0m[2m   Start at [22m 08:30:01
[35m@quorum/shared:test: [0m[2m   Duration [22m 319ms[2m (transform 658ms, setup 0ms, import 1.43s, tests 351ms, environment 1ms)[22m
[35m@quorum/shared:test: [0m
[33m@quorum/web:test: [0mcache bypass, force executing [2m3f1679d018c53915[0m
[34m@quorum/core:test: [0mcache bypass, force executing [2m14570eb5b6bad68a[0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core
[34m@quorum/core:test: [0m> vitest run
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web
[33m@quorum/web:test: [0m> vitest run
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web[39m
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m
[34m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core[39m
[34m@quorum/core:test: [0m
[33m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 24[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/connection-state.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 2[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/daemon-endpoints.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/routes.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/q0050.source.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 29[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle.test.ts [2m([22m[2m27 tests[22m[2m)[22m[32m 17[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/caught-failures.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 268[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/lint/lint.test.ts [2m([22m[2m120 tests[22m[2m)[22m[32m 132[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/cli-version.test.ts [2m([22m[2m36 tests[22m[2m)[22m[32m 137[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/lifecycle-routing.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 30[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/lint-coverage.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 512[2mms[22m[39m
[33m@quorum/web:test: [0m     [33m[2m✓[22m[39m and ESLint itself resolves the three rules for a .tsx file, at error severity [33m 508[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/adapters.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 115[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/run-history/reader.test.ts [2m([22m[2m29 tests[22m[2m)[22m[32m 94[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/backlog/backlog.test.ts [2m([22m[2m78 tests[22m[2m)[22m[33m 509[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/test-command.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 726[2mms[22m[39m
[34m@quorum/core:test: [0m     [33m[2m✓[22m[39m a variable this repository declares arrives; one it does not is stripped [33m 385[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/shell.test.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 83[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/git-identity.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 70[2mms[22m[39m
[33m@quorum/web:test: [0m
[33m@quorum/web:test: [0m[2m Test Files [22m [1m[32m10 passed[39m[22m[90m (10)[39m
[33m@quorum/web:test: [0m[2m      Tests [22m [1m[32m137 passed[39m[22m[90m (137)[39m
[33m@quorum/web:test: [0m[2m   Start at [22m 08:30:02
[33m@quorum/web:test: [0m[2m   Duration [22m 1.10s[2m (transform 453ms, setup 0ms, import 808ms, tests 658ms, environment 645ms)[22m
[33m@quorum/web:test: [0m
[34m@quorum/core:test: [0m [32m✓[39m src/run-history/run-history.source.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 67[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/fanout/fanout.source.test.ts [2m([22m[2m25 tests[22m[2m)[22m[32m 54[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/test-discovery.test.ts [2m([22m[2m36 tests[22m[2m)[22m[32m 20[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/probe-consumers.source.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 79[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/structured-output.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/mock.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 176[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/git/git.source.test.ts [2m([22m[2m17 tests[22m[2m)[22m[32m 21[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/turbo-inputs.test.ts [2m([22m[2m63 tests[22m[2m)[22m[33m 1219[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/contracts/validate-artifact.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 112[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/contracts/run-manifest.test.ts [2m([22m[2m25 tests[22m[2m)[22m[32m 25[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/backlog/backlog.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 27[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/adapters/adapters.source.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 45[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/steps.test.ts [2m([22m[2m20 tests[22m[2m)[22m[33m 329[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/run-history/manifest.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[34m@quorum/core:test: [0m [32m✓[39m src/engine/engine.test.ts 

… 30270 characters of output omitted from the middle …

m@quorum/cli:test: [0m
[36m@quorum/server:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/server[39m
[36m@quorum/server:test: [0m
[35m@quorum/cli:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/cli[39m
[35m@quorum/cli:test: [0m
[36m@quorum/server:test: [0m [32m✓[39m src/gates.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/broadcast.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 18[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m23 tests[22m[2m)[22m[33m 482[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 416[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 200[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 703[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 253[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[33m 343[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m29 tests[22m[2m)[22m[33m 608[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 93[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 332[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m47 tests[22m[2m)[22m[33m 849[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m every invocation shape leaves the working tree and the ref namespace as it found them [33m 372[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/read.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 1122[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/serve.test.ts [2m([22m[2m12 tests[22m[2m)[22m[33m 1181[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 1122[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 1154[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/http.test.ts [2m([22m[2m24 tests[22m[2m)[22m[33m 1447[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2398[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2548[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 628[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 389[2mms[22m[39m
[36m@quorum/server:test: [0m [32m✓[39m src/host.test.ts [2m([22m[2m30 tests[22m[2m)[22m[33m 3520[2mms[22m[39m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[2m Test Files [22m [1m[32m8 passed[39m[22m[90m (8)[39m
[36m@quorum/server:test: [0m[2m      Tests [22m [1m[32m129 passed[39m[22m[90m (129)[39m
[36m@quorum/server:test: [0m[2m   Start at [22m 08:30:36
[36m@quorum/server:test: [0m[2m   Duration [22m 4.09s[2m (transform 1.87s, setup 0ms, import 2.82s, tests 7.89s, environment 0ms)[22m
[36m@quorum/server:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 4487[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6563[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a passing run answered advance completes and exits 0 [33m 498[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --gate-answer abort ends the run aborted and exits 2 [33m 320[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 355[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 330[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 7223[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6383[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1687[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1304[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1186[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1099[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1099[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 7848[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m40 tests[22m[2m)[22m[33m 7860[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m every stage with tickets renders, plus the three that always do, in STAGES order [33m 338[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 375[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 485[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 371[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [32m 300[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 342[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 319[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 513[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m65 tests[22m[2m)[22m[33m 35654[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 3862[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 3081[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 2737[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 2682[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 2834[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 2623[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 445[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 652[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 792[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 877[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 2956[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 1367[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 944[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 3094[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 652[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 679[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 636[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 647[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 705[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 436[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m25 passed[39m[22m[90m (25)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m628 passed[39m[22m[90m (628)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 08:30:36
[35m@quorum/cli:test: [0m[2m   Duration [22m 36.00s[2m (transform 4.59s, setup 0ms, import 6.92s, tests 86.53s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m7 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m11.919s[0m [0m


```
