# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[36m@quorum/compiler:test: [0mcache bypass, force executing [2m83d73da31970e28c[0m
[35m@quorum/shared:test: [0mcache bypass, force executing [2m746ac892ace37097[0m
[32m@quorum/templates:test: [0mcache bypass, force executing [2m48bf5af888719294[0m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared
[35m@quorum/shared:test: [0m> vitest run
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates
[32m@quorum/templates:test: [0m> vitest run
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler
[36m@quorum/compiler:test: [0m> vitest run
[36m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m
[36m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/templates[39m
[35m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/shared[39m
[32m@quorum/templates:test: [0m
[35m@quorum/shared:test: [0m
[36m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/compiler[39m
[36m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m   Start at [22m 00:22:41
[32m@quorum/templates:test: [0m[2m   Duration [22m 115ms[2m (transform 13ms, setup 0ms, import 19ms, tests 1ms, environment 0ms)[22m
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m   Start at [22m 00:22:41
[36m@quorum/compiler:test: [0m[2m   Duration [22m 119ms[2m (transform 11ms, setup 0ms, import 18ms, tests 1ms, environment 0ms)[22m
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 5[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 8[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 18[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 24[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/wire.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 13[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 39[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 22[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 80[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/docs.test.ts [2m([22m[2m85 tests[22m[2m)[22m[32m 90[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/plan-backlog.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 147[2mms[22m[39m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m[2m Test Files [22m [1m[32m14 passed[39m[22m[90m (14)[39m
[35m@quorum/shared:test: [0m[2m      Tests [22m [1m[32m247 passed[39m[22m[90m (247)[39m
[35m@quorum/shared:test: [0m[2m   Start at [22m 00:22:41
[35m@quorum/shared:test: [0m[2m   Duration [22m 355ms[2m (transform 851ms, setup 0ms, import 1.67s, tests 461ms, environment 1ms)[22m
[35m@quorum/shared:test: [0m
[34m@quorum/web:test: [0mcache bypass, force executing [2mb923044efd314cd6[0m
[33m@quorum/core:test: [0mcache bypass, force executing [2m1724efd35e03cd00[0m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m> @quorum/web@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web
[34m@quorum/web:test: [0m> vitest run
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m> @quorum/core@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core
[33m@quorum/core:test: [0m> vitest run
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m
[34m@quorum/web:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web[39m
[34m@quorum/web:test: [0m
[33m@quorum/core:test: [0m
[33m@quorum/core:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/core[39m
[33m@quorum/core:test: [0m
[34m@quorum/web:test: [0m [31m❯[39m src/mission-control-model.test.ts [2m([22m[2m6 tests[22m[2m | [22m[31m6 failed[39m[2m)[22m[32m 3[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m groups alternating exact ids in first-appearance and arrival order[39m[32m 2[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m does not reinterpret an exact literal undefined id[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m keeps id-less events and prefixed prose in run activity without loss[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m uses the latest spawn or retry vendor[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m distinguishes starts, ends, terminal-unmatched starts, and evicted starts[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m does not invent a row for run-level fan-out narration[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m [31m❯[39m test/routes.test.ts [2m([22m[2m34 tests[22m[2m | [22m[31m3 failed[39m[2m)[22m[32m 19[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the seven ids, as an identity[32m 1[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m every rail entry points at a static path the route table holds[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m Q-0015 AC-14 — the backlog and runs rail entries have screens[39m[32m 3[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the ticket route names Q-0127 and no longer says it is waiting for a route[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m exactly five route rows claim a screen, and app selects every one by its registered constant[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m Q-0016 AC-14 — the gate row names the screen it built and the ticket that adds the rest[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and the board's own path is a register constant both tables are built from[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the ticket path is built by substitution into the registered pattern[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the twelve, as an identity in declaration order[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m every path is unique[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m every screen route carries a screen name, and a ticket or an explicit absence[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the one redirect aims at a path the table holds[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m[31m     [31m×[31m the claim that became false is gone, and the one that is still true stays[39m[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and it says what it is now waiting for, which is a screen rather than a daemon[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /projects resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /backlog resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /backlog/:ticketId resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /harness resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /flows resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /runs resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /runs/:handle resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /runs/:handle/gate resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /runs/:handle/steps/:stepId resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /history resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m /settings resolves to its own row[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m a dynamic segment is captured under the name the pattern gives it[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and the matcher discriminates, so "resolves" is not a constant[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m a redirect is followed to what is drawn, and reports where the browser should be[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and a register that redirected in a circle stops rather than spinning[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the rail marks the entry the current URL sits under, not only the one it equals[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and it matches on segment boundaries rather than on string prefixes[32m 0[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m the scan finds component files at all[32m 9[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m every route-path literal a component carries is one the register holds[32m 2[2mms[22m[39m
[34m@quorum/web:test: [0m     [32m✓[39m and the clause has a subject — the same scan repo

… 80009 characters of output omitted from the middle …

[0mcache bypass, force executing [2m7a6a39718dbab172[0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m> @quorum/cli@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli
[35m@quorum/cli:test: [0m> vitest run
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/packages/cli[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m [32m✓[39m src/package.test.ts [2m([22m[2m25 tests[22m[2m)[22m[33m 453[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m importing it under the workspace condition resolves [33m 372[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/frame.source.test.ts [2m([22m[2m48 tests[22m[2m)[22m[33m 588[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/templates.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 222[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/runs.test.ts [2m([22m[2m38 tests[22m[2m)[22m[32m 217[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/open.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 546[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and 0 is accepted, because that is the one value the daemon already gives a meaning [33m 423[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/main.test.ts [2m([22m[2m50 tests[22m[2m)[22m[33m 650[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/fail.test.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 98[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/binary-name.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 22[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/commands.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 917[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/init.test.ts [2m([22m[2m19 tests[22m[2m)[22m[33m 928[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/lint.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 84[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/trace.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 6[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/argv.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 8[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/colour.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/validate.test.ts [2m([22m[2m23 tests[22m[2m)[22m[32m 147[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/exit.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/adapters.test.ts [2m([22m[2m28 tests[22m[2m)[22m[33m 2292[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/gate.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 2500[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6(2) — the classification is by type, not by the words [33m 408[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and each of the two failures is what a run gets when the envelope is wrong [33m 439[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 7038[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 7151[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1817[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1488[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1346[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1308[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1166[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6768[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 338[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 316[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a run installs one SIGINT and one SIGTERM listener and removes both, twice over [33m 334[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m44 tests[22m[2m)[22m[33m 8458[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 404[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 412[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 532[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-10 — a project with no remote gains not one word, and neither does a pushed one [33m 366[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 409[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 344[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 351[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 356[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 534[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 9699[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 10168[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m87 tests[22m[2m)[22m[33m 68121[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 5769[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 4589[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 4208[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0122 AC-3(b) — a rebuild drops what the current source no longer produces, in every emit [33m 8152[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 4278[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 4416[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a stale emit is cleared, and what replaces it is the production modules and no test [33m 4052[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `exclude` is load-bearing — without it the build stops rather than emitting [33m 3160[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 4101[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 546[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 672[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 877[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 948[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 4615[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 2299[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 1609[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m Q-0124 AC-2(d) — and what each packer writes for @quorum/web's dev-section workspace range is measured [33m 501[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 4544[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 681[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 724[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 837[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 799[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 830[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 489[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m26 passed[39m[22m[90m (26)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m692 passed[39m[22m[90m (692)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 00:23:21
[35m@quorum/cli:test: [0m[2m   Duration [22m 68.42s[2m (transform 4.19s, setup 0ms, import 7.24s, tests 127.09s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m6 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m49.1s[0m [0m
[1mFailed:    [31m[1m@quorum/web#test[0m[0m

• turbo 2.10.11
[1m@quorum/web#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/web#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0015__integration/apps/web) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[31;40m ERROR [0m [31;49mrun failed: command  exited (1)[0m

```
