# Test output

`pnpm turbo run test --force --continue`

_No lines in the output looked like test results._

## Output

```

   • Packages in scope: @quorum/cli, @quorum/compiler, @quorum/core, @quorum/server, @quorum/shared, @quorum/templates, @quorum/web
   • Running test in 7 packages
   • Remote caching disabled, using shared worktree cache

[32m@quorum/templates:test: [0mcache bypass, force executing [2m8752bec13583c75a[0m
[36m@quorum/compiler:test: [0mcache bypass, force executing [2m8d59138e5652c2f4[0m
[35m@quorum/shared:test: [0mcache bypass, force executing [2mbdaf08db82ffbce7[0m
[35m@quorum/shared:test: [0m
[35m@quorum/shared:test: [0m> @quorum/shared@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared
[35m@quorum/shared:test: [0m> vitest run
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m> @quorum/templates@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates
[32m@quorum/templates:test: [0m> vitest run
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m> @quorum/compiler@0.0.0 test /Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler
[36m@quorum/compiler:test: [0m> vitest run
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared[39m
[35m@quorum/shared:test: [0m
[36m@quorum/compiler:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/compiler[39m
[32m@quorum/templates:test: [0m[1m[30m[46m RUN [49m[39m[22m [36mv4.1.11 [39m[90m/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/templates[39m
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[32m@quorum/templates:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[36m@quorum/compiler:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 1[2mms[22m[39m
[32m@quorum/templates:test: [0m
[32m@quorum/templates:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[32m@quorum/templates:test: [0m[2m   Start at [22m 23:26:41
[32m@quorum/templates:test: [0m[2m   Duration [22m 124ms[2m (transform 11ms, setup 0ms, import 18ms, tests 1ms, environment 0ms)[22m
[32m@quorum/templates:test: [0m
[36m@quorum/compiler:test: [0m
[36m@quorum/compiler:test: [0m[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m      Tests [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[36m@quorum/compiler:test: [0m[2m   Start at [22m 23:26:41
[36m@quorum/compiler:test: [0m[2m   Duration [22m 125ms[2m (transform 11ms, setup 0ms, import 18ms, tests 1ms, environment 0ms)[22m
[36m@quorum/compiler:test: [0m
[35m@quorum/shared:test: [0m [32m✓[39m src/constants.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.q0050.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m [31m❯[39m src/wire.test.ts [2m([22m[2m2 tests[22m[2m | [22m[31m2 failed[39m[2m)[22m[32m 7[2mms[22m[39m
[35m@quorum/shared:test: [0m[31m     [31m×[31m accepts only the two envelope shapes and finite non-negative integer counts[39m[32m 2[2mms[22m[39m
[35m@quorum/shared:test: [0m[31m     [31m×[31m the web importer declares shared in the lockfile[39m[32m 2[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/stages.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/step-output.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 7[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/events.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/role.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 15[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/project.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 26[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/index.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 11[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/flow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[32m 38[2mms[22m[39m
[35m@quorum/shared:test: [0m [32m✓[39m src/ticket.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 61[2mms[22m[39m
[35m@quorum/shared:test: [0m [31m❯[39m src/docs.test.ts [2m([22m[2m59 tests[22m[2m | [22m[31m2 failed[39m[2m)[22m[32m 65[2mms[22m[39m
[35m@quorum/shared:test: [0m[31m     [31m×[31m architecture replaces the obsolete no-connection account with shared ownership and re-export[39m[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m[31m     [31m×[31m the glossary defines the closed, derived, memory-only connection state separately from run state[39m[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the repository architecture no longer calls frontend inert[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m both entries are present, dated, and carry Decision / Alternatives considered / Why[32m 8[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the entries are appended, not inserted[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the event disposition table is in the entry, with a member or a stated reason per row[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m register row 22's operative reading is recorded for a child's reviewer[32m 4[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m every entry file is listed once, in the order the folder holds them[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m each entry opens with the title and date the line linking to it carries[32m 3[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the dates never go backwards — the index is append-only, newest last[32m 6[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m every section printing a shipped flow prints exactly that file[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m every §5 yaml block is either a shipped flow or a registered sketch[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m no registered sketch names a flow that now has a file[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m grepping either document for the event kinds yields one answer[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the status line of every document this change edits was bumped[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m Q-0097 AC-24 — the emit is described once, and its declaration is read out of turbo.json[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the ticket.md example shows the iterations keys and the history entry the engine writes[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary carries Event, and says it without introducing a synonym[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary and architecture state every accepted stream rule[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m §3.3 and TERMINAL_STATUSES name the same seven words[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the spec says what undecided does, not only that it exists[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary carries the term with its decision, and introduces no synonym for it[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m each edited document names the two claimed paths and the one that is refused[32m 5[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m no edited document claims a cold machine can obtain Quorum from the public registry[32m 5[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the plan's narrowed surface still holds the sentence this ticket corrected[32m 7[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and that scan has a subject — it recognises an unqualified claim where one is written[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the decisions are exempt, and the exemption is load-bearing rather than a widened filter[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary defines both new terms with their decision, and says what each is not[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the status line of every numbered document this change edits records Q-0098[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary defines the term, its derivation, and what it is not[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m README's term list gains it, under an assertion that fails when it is missing[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m both numbered documents state it, and their status lines record Q-0105[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m each document refuses the reading its own subject makes available[32m 2[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m both files state the vocabulary rule, and the extractor finds the real list[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the two lists are the same terms in the same order[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the rule is in §4 beside the cross-vendor row, not only in the code that enforces it[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and both exemptions are stated there, because a rule with unstated exceptions is folklore[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the status line records the change, as every edit to a numbered document must[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary defines the term, its four states, and its decision[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the "what it is not" half, each refusal asserted on its own[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the adapter contract says its verification line is a record rather than a range[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the status line of every numbered document this change edits records Q-0067[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the glossary defines the term, its subject, its lifetime and its decision[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the release guarantee is bounded to what two syscalls deliver[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the "what it is not" half, each refusal asserted on its own[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m the architecture document states the rule and records the change[32m 1[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m USAGE.md quotes the shipped sentence in full, product named rather than elided[32m 0[2mms[22m[39m
[35m@quorum/shared:test: [0m     [32m✓[39m and the second vendor's refusal shares one tail with the first[32m 0[2mms

… 196302 characters of output omitted from the middle …

al event carries it, which is a fact about the engine rather than about this transport.
[36m@quorum/server:test: [0m */
[36m@quorum/server:test: [0mexport interface WireRun {
[36m@quorum/server:test: [0m  readonly handle: string;
[36m@quorum/server:test: [0m  readonly flow: string;
[36m@quorum/server:test: [0m  readonly runId: number | null;
[36m@quorum/server:test: [0m  readonly state: string;
[36m@quorum/server:test: [0m}
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m/** {@link StartOutcome}'s run, narrowed to what crosses the wire. */
[36m@quorum/server:test: [0mexport function wireRunOf(outcome: StartOutcome): WireRun {
[36m@quorum/server:test: [0m  const { handle, flow, runId, state } = outcome.run;
[36m@quorum/server:test: [0m  return { handle, flow, runId, state };
[36m@quorum/server:test: [0m}
[36m@quorum/server:test: [0m"
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[36m [2m❯[22m src/index.test.ts:[2m58:18[22m[39m
[36m@quorum/server:test: [0m    [90m 56|[39m   test('wire.ts imports and re-exports the shared WireMessage type', (…
[36m@quorum/server:test: [0m    [90m 57|[39m     const text = fs.readFileSync(new URL('./wire.ts', import.meta.url)…
[36m@quorum/server:test: [0m    [90m 58|[39m     expect(text).toMatch(/import\s+type\s+\{\s*WireMessage\s*\}\s+from…
[36m@quorum/server:test: [0m    [90m   |[39m                  [31m^[39m
[36m@quorum/server:test: [0m    [90m 59|[39m     [34mexpect[39m(text)[33m.[39m[34mtoMatch[39m([36m/export\s+type\s+\{\s*WireMessage\s*\}/[39m)[33m;[39m
[36m@quorum/server:test: [0m    [90m 60|[39m   })[33m;[39m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[2m Test Files [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m7 passed[39m[22m[90m (8)[39m
[36m@quorum/server:test: [0m[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m128 passed[39m[22m[90m (129)[39m
[36m@quorum/server:test: [0m[2m   Start at [22m 23:27:16
[36m@quorum/server:test: [0m[2m   Duration [22m 4.72s[2m (transform 1.82s, setup 0ms, import 3.36s, tests 8.92s, environment 0ms)[22m
[36m@quorum/server:test: [0m
[36m@quorum/server:test: [0m[41m[30m ELIFECYCLE [39m[49m [31mTest failed. See above for more details.[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/step-id.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 4844[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/run.test.ts [2m([22m[2m42 tests[22m[2m)[22m[33m 6900[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a passing run answered advance completes and exits 0 [33m 390[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --gate-answer abort ends the run aborted and exits 2 [33m 377[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a backward edge to another flow regresses the ticket, and 0 is the ruled answer [33m 342[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-5(1) — the queue is invocation-local, so two runs in one process each get all of it [33m 383[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 — --verbose gates stdout, end to end [33m 319[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/failure-paths.test.ts [2m([22m[2m34 tests[22m[2m)[22m[33m 7658[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build-fixture.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 6839[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a rebuilt package executes the new source, not the artifact from the old one [33m 1981[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and a changed build configuration moves the emit too, not only a changed source [33m 1385[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a removed source entry does not survive as an executable emitted file [33m 1227[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same inputs produce the same paths and the same bytes, emit present or absent [33m 1122[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m turbo prunes no output directory itself, which is why the build script does [33m 1114[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/end-to-end.test.ts [2m([22m[2m43 tests[22m[2m)[22m[33m 8198[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/board.test.ts [2m([22m[2m40 tests[22m[2m)[22m[33m 8293[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m every stage with tickets renders, plus the three that always do, in STAGES order [33m 310[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a project with no flows directory renders every column, prints no hint, and exits 0 [33m 308[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C3 — an unresolvable branch, an absent branch key and an empty backlog all render as today [33m 387[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C5 — a shallow clone is indeterminate (shallow clone), with no ahead count [33m 368[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m C10 — `no branch` is reported once the stage claims the work is done, and not before [33m 539[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-6 — the count is upstream..base, and a symmetric difference would read one more [33m 379[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-8 — the legend borrows none of containment's vocabulary [33m 320[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-3 and AC-5 — a base tracking nothing says so, in the repository's own names [33m 334[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-4 — it reads: no ref moves, no file appears, and FETCH_HEAD is untouched [33m 338[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m AC-11 — every outcome still exits 0, including the ones git could not answer [33m 497[2mms[22m[39m
[35m@quorum/cli:test: [0m [32m✓[39m src/build.test.ts [2m([22m[2m65 tests[22m[2m)[22m[33m 36937[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m audited whole in an isolated copy, the build writes its emit and turbo's metadata and nothing else [33m 4175[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and that audit reports a build that writes into .git, .harness or .quorum, or deletes a file [33m 3119[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it reports an artifact hidden beside a turbo log, which the exemption used to swallow [33m 2818[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the real workspace builds, and its emit and the declaration agree in both directions [33m 2883[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a cache hit restores an artifact a plain node process can import and use [33m 2852[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the same chain runs in an isolated copy — tracked files, install, build, execute [33m 2702[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and it runs when executed directly, which is the difference the mode bit makes [33m 405[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm links a shim from the root devDependency, and it resolves inside this package [33m 677[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and `pnpm exec quorum help` — the command AC-18 selected — runs, with nothing to fall back to [33m 769[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m each of the three declares files, and the pack result carries the emit and nothing repository-only [33m 874[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m the packed set installs outside the workspace with the registry dead, and runs [33m 3009[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m pnpm pack and npm pack agree on the file list, for every package in the distribution set [33m 1406[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and they disagree on the packed manifest, which is why the fixture above packs with pnpm [33m 981[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a hit restores the file with its shebang, its mode bit and its behaviour intact [33m 3163[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a verified login with an ahead state exits 0, and the clause still prints [33m 720[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m a failed login with an as-verified state exits 1, and the agreeing state did not soften it [33m 666[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the presence listing exits 0 whatever the state, printing no clause at all [33m 659[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --probe reports both logins verified and exits 0 [33m 767[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m and the same fixture measuring its answer still reports both numbers, so the omission is the absence [33m 714[2mms[22m[39m
[35m@quorum/cli:test: [0m     [33m[2m✓[22m[39m --json carries the distinction the human line does not [33m 434[2mms[22m[39m
[35m@quorum/cli:test: [0m
[35m@quorum/cli:test: [0m[2m Test Files [22m [1m[32m25 passed[39m[22m[90m (25)[39m
[35m@quorum/cli:test: [0m[2m      Tests [22m [1m[32m628 passed[39m[22m[90m (628)[39m
[35m@quorum/cli:test: [0m[2m   Start at [22m 23:27:16
[35m@quorum/cli:test: [0m[2m   Duration [22m 37.28s[2m (transform 4.82s, setup 0ms, import 7.60s, tests 91.55s, environment 1ms)[22m
[35m@quorum/cli:test: [0m

[1m Tasks:    [32m[1m3 successful[0m, 7 total[0m
[1mCached:    [1m0 cached[0m, 7 total[0m
[1m  Time:    [1m1m13.46s[0m [0m
[1mFailed:    [31m[1m@quorum/core#test[0m, [31m[1m@quorum/server#test[0m, [31m[1m@quorum/shared#test[0m, [31m[1m@quorum/web#test[0m[0m

• turbo 2.10.11
[1m@quorum/shared#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/web#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/core#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/server#test: [0m[33m[1m[7m WARNING [0m [33mcommand finished with error, but continuing...[0m
[1m@quorum/shared#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/shared) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[1m@quorum/web#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/apps/web) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[1m@quorum/core#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/core) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[1m@quorum/server#test: [0m[31m[1m ERROR [0m [31m[1mcommand (/Users/ruudvanengelenhoven/Development/quorum/.harness/worktrees/harness__Q-0120__integration/packages/server) /Users/ruudvanengelenhoven/.local/share/mise/installs/node/lts/bin/pnpm run test exited (1)[0m
[31;40m ERROR [0m [31;49mrun failed: command  exited (1)[0m

```
