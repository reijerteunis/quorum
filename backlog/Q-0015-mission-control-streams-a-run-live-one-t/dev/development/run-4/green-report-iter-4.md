# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[35m@quorum/templates:test: [0mcache bypass, force executing [2m228f1c625416410a[0m
[32m@quorum/compiler:test: [0mcache bypass, force executing [2m23ed9b2f9268f2c0[0m
[36m@quorum/shared:test: [0mcache bypass, force executing [2m763702a00e93f4c4[0m
[32m@quorum/compiler:test: [0m
[32m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler
[32m@quorum/compiler:test: [0m> vitest run
[32m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m
[35m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates
[35m@quorum/templates:test: [0m> vitest run
[35m@quorum/templates:test: [0m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared
[36m@quorum/shared:test: [0m> vitest run
[36m@quorum/shared:test: [0m
[32m@quorum/compiler:test: [0m
[36m@quorum/shared:test: [0m
[35m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler[39m
[35m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates[39m
[32m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m
[36m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared[39m
[36m@quorum/shared:test: [0m
[32m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[35m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/compiler:test: [0m
[32m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/compiler:test: [0m[2m   Start at [22m 01:05:40
[35m@quorum/templates:test: [0m
[32m@quorum/compiler:test: [0m[2m   Duration [22m 121ms[2m (transform 13ms, setup 0ms, import 22ms, tests 1ms, environment 0ms)[22m
[32m@quorum/compiler:test: [0m
[35m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[35m@quorum/templates:test: [0m[2m   Start at [22m 01:05:40
[35m@quorum/templates:test: [0m[2m   Duration [22m 121ms[2m (transform 10ms, setup 0ms, import 18ms, tests 1ms, environment 0ms)[22m
[35m@quorum/templates:test: [0m
[36m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 7[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 10[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 17[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 27[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 13[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 41[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 81[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m85 tests[22m[2m)[22m[32m 93[2mms[22m[39m
[36m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 144[2mms[22m[39m
[36m@quorum/shared:test: [0m
[36m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m14 passed[39m[22m[90m (14)[39m
[36m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m247 passed[39m[22m[90m (247)[39m
[36m@quorum/shared:test: [0m[2m   Start at [22m 01:05:40
[36m@quorum/shared:test: [0m[2m   Duration [22m 363ms[2m (transform 968ms, setup 0ms, import 1.82s, tests 461ms, environment 1ms)[22m
[36m@quorum/shared:test: [0m
[33m@quorum/web:test: [0mcache bypass, force executing [2m560bfd0ae5e550f5[0m
[34m@quorum/core:test: [0mcache bypass, force executing [2m7f0431ef83e598c8[0m
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
[33m@quorum/web:test: [0m [31m❯[39m test/routes.test.ts [2m([22m[2m34 tests[22m[2m | [22m[31m1 failed[39m[2m)[22m[32m 19[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the seven ids, as an identity[32m 1[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m every rail entry points at a static path the route table holds[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m Q-0015 AC-14 — the backlog and runs rail entries have screens[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the ticket route names Q-0127 and no longer says it is waiting for a route[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m[31m     [31m×[31m exactly five route rows claim a screen, and app selects every one by its registered constant[39m[32m 3[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m Q-0016 AC-14 — the gate row names the screen it built and the ticket that adds the rest[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and the board's own path is a register constant both tables are built from[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the ticket path is built by substitution into the registered pattern[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the twelve, as an identity in declaration order[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m every path is unique[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m every screen route carries a screen name, and a ticket or an explicit absence[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the one redirect aims at a path the table holds[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the claim that became false is gone, and the one that is still true stays[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and it says what it is now waiting for, which is a screen rather than a daemon[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /projects resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /backlog resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /backlog/:ticketId resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /harness resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /flows resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /runs resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /runs/:handle resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /runs/:handle/gate resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /runs/:handle/steps/:stepId resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /history resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m /settings resolves to its own row[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m a dynamic segment is captured under the name the pattern gives it[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and the matcher discriminates, so "resolves" is not a constant[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m a redirect is followed to what is drawn, and reports where the browser should be[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and a register that redirected in a circle stops rather than spinning[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the rail marks the entry the current URL sits under, not only the one it equals[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and it matches on segment boundaries rather than on string prefixes[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m the scan finds component files at all[32m 9[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m every route-path literal a component carries is one the register holds[32m 2[2mms[22m[39m
[33m@quorum/web:test: [0m     [32m✓[39m and the clause has a subject — the same scan reports one that is not registered[32m 0[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/source.test.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 149[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m test/package.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 40[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/run-connection.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 36[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/daemon-client.test.ts [2m([22m[2m47 tests[22m[2m)[22m[32m 12[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/frame-parser.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/request-state.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/mission-control-model.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[33m@quorum/web:test: [0m [32m✓[39m src/connection-

… 46787 characters of output omitted from the middle …

[0mcache bypass, force executing [2m5450c854d7d1929e[0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m> @quorum/cli@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli
[35m@quorum/cli:test: [0m> vitest run
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m25 tests[22m[2m)[22m[33m 464[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 388[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m48 tests[22m[2m)[22m[33m 664[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 218[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/open.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 520[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and 0 is accepted, because that is the one value the daemon already gives a meaning [33m 404[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 197[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 637[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 33[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 172[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 152[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 929[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 1054[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 94[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2263[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2483[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 411[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 458[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6933[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1554[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1602[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1267[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1323[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1159[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 6919[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6524[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 305[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 320[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a run installs one SIGINT and one SIGTERM listener and removes both, twice over [33m 317[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m44 tests[22m[2m)[22m[33m 8138[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 344[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 383[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 517[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-7 — one unpushed commit prints, so the threshold is 1 and there is no floor [33m 314[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 402[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 351[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 376[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 350[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 536[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 9460[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 9884[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m87 tests[22m[2m)[22m[33m 67092[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 5669[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 4425[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 4084[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0122 AC-3(b) — a rebuild drops what the current source no longer produces, in every emit [33m 7983[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 4237[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 4290[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a stale emit is cleared, and what replaces it is the production modules and no test [33m 4009[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `exclude` is load-bearing — without it the build stops rather than emitting [33m 3115[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 4038[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 556[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 702[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 796[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 963[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 4570[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 2301[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 1586[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-2(d) — and what each packer writes for @quorum/web's dev-section workspace range is measured [33m 508[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 4745[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 686[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 677[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 750[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 711[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 787[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 466[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m26 passed[39m[22m[90m (26)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m692 passed[39m[22m[90m (692)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 01:06:19
[35m@quorum/cli:test: [0m[2m   Duration [22m 67.41s[2m (transform 4.68s, setup 0ms, import 7.68s, tests 124.85s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m6 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m47.805s[0m [0m
[1mFailed:    [31m[1m@quorum/web#test[0m[0m

• turbo 2.10.11
[1m@quorum/web#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/web#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[31;40m ERROR [0m [31;49mrun failed: command  exited (1)[0m

```
