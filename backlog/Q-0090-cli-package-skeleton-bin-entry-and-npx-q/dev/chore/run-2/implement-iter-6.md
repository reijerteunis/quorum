# Q-0090 — implement report, run 2, iteration 6

**Revision round.** `review/chore/run-2/chore-iter-5.md` returned two majors, both on
`packages/cli/src/main.ts`, and both are accepted and fixed. Nothing else in the branch moved: the
change is **two files, 115 insertions, 9 deletions**, and no criterion outside AC-8's frame is
touched.

Neither finding needed an erratum. Both are ordinary defects in the change under review rather than
contradictions with `requirements/merged.md`, so the channel *"An erratum is the last repair, not the
first"* (2026-08-30) reserves for a provable contradiction is not used here, and none is owed.

---

## Finding 1 — `main.ts:45`: the dispatch discarded three quarters of the parsed command line

> `main` retains only `cmd` from `parseArgv` and discards `rest`, `flags`, and `gateAnswers`; the
> handler table at line 32 consequently accepts no parsed context. Q-0091–Q-0094 would have to
> modify the shared frame or parse argv again […]

**Accepted, and it is the sharper of the two**, because the deliverable is defined by what the
siblings can build on it: the merged requirement's first user story is *"I add a command by writing
one module against a frame that already parses argv"*, and a handler receiving nothing satisfies the
letter of AC-2 (the parser is preserved and exported) while defeating the sentence that says why
AC-2 is here.

**The spike settles the shape rather than taste.** `spike/bin/harness.js:40–42` binds `cmd`, `rest`
and `gateAnswers` at module scope beside `flags`, so **every one of the eight `case` blocks sees all
four** — `board` reads `flags`, `runs` reads `rest[0]`, `run` reads `rest`, `flags` and
`gateAnswers`. The closest faithful port of that arrangement into a table is a handler handed the
whole `ParsedArgv`, which is what shipped:

```ts
export type CommandHandler = (argv: ParsedArgv) => void | Promise<void>;
```

`HANDLERS` is now `Readonly<Record<Command, CommandHandler>>`, and `main` parses **once** and passes
the result:

```ts
const parsed = parseArgv(argv);
const { cmd } = parsed;
if (cmd !== undefined && isCommand(cmd)) {
  await HANDLERS[cmd](parsed);
  return;
}
```

The one registered handler still declares no parameter (`help: () => { console.log(HELP); }`), which
is assignable and leaves no unused-parameter noise; the contract is what the type declares, not what
today's single entry happens to use.

**Reported rather than assumed: the review's alternative was considered and not taken.** The finding
offers *"or its command-relevant fields"*. Passing a subset would mean this ticket deciding, for four
tickets that have not been written, which fields a command may see — the same objection round 2 made
to a `bin` target assumed to end in `.js`, one layer up. `ParsedArgv` is already the parser's whole
output and is already exported, so handing it over costs nothing and pre-empts nothing.

---

## Finding 2 — `main.ts:47`: the handler was invoked without `await`

> handlers are invoked without `await`, while `HANDLERS` is typed as returning only `void`. Future
> command handlers perform asynchronous work; a rejected handler promise would be detached,
> `main()` would resolve successfully, and Q-0096's required `main().catch(dieOnUnexpected)` wiring
> could not report it through `die`.

**Accepted, and the spike agrees in both halves.** `spike/bin/harness.js`'s `main` is `async` and its
`run` case awaits the engine *inside `main`'s own body*, so a failure propagates to `:569`'s
`main().catch((e) => die(e.stack ?? String(e)))`. A dispatch that calls the handler without awaiting
resolves `main` first, leaves the promise detached, and hands the failure to Node's
unhandled-rejection path — which neither prints through the error path nor exits with `ERROR`. The
frame already ports that `catch` as `dieOnUnexpected` (`fail.ts`), so the property it depends on had
to exist before Q-0096 wires it.

Fixed by the union in the type above plus `await HANDLERS[cmd](parsed)`. The module JSDoc's
*"It is `async` with nothing to await"* paragraph was rewritten in the same change, because it had
become the argument for the defect.

---

## The check I wrote first could not see its own subject

This is the part of the round worth reading, and it is this repository's most-recorded defect class
arriving inside the guard written to close a finding about it.

The first version of the async check was a handler suspended on one `await Promise.resolve()` setting
a flag, with the flag read after `await main(argv)`. Run against the deliberately broken dispatch
(`void HANDLERS[cmd](parsed)`) it **passed**: the handler's continuation is queued ahead of the
caller's, so the flag is already `true` by the time the assertion runs. A check that reports success
over a subject it cannot see — *"a check that skips its subject must not report success"*
(2026-08-25), found by mutation rather than by reading, which is the only way it is ever found.

What shipped instead holds the handler open behind a promise the test alone settles, and drains a
**macrotask** before asserting, so every microtask an unawaited dispatch could hide behind has run:

```ts
const held = new Promise<void>((resolve) => { release = resolve; });
vi.spyOn(HANDLERS, name).mockImplementation(async () => { await held; finished = true; });
const running = invoke([name]).then(() => { resolved = true; });
await new Promise((resolve) => setTimeout(resolve, 0));
expect(resolved, 'main resolved while its handler was still waiting').toBe(false);
```

The earlier shape and why it failed are written into the test as a comment, so the next person
narrowing this check knows which weaker form has already been tried.

---

## A claim in my own comment was false, and is corrected rather than softened

The first draft of that comment said the `async` mock implementation was *"the typecheck half of the
same claim"* — that a table typed `() => void` would fail to compile at that line. **Measured, and it
does not.** TypeScript deliberately accepts a function returning `Promise<void>` wherever `void` is
declared, so narrowing `CommandHandler` back to `(argv: ParsedArgv) => void`:

- leaves `pnpm --filter @quorum/cli typecheck` **green**, and
- leaves all **94** of this package's tests **green**.

So the union declares what a handler may do and **only the `await` in `main` makes it true**; a
behavioural check is the only thing that can hold it. The comment now says that, with the measurement
in it. This is the kind of sentence that would otherwise go stale silently and read as coverage —
*"A check is not established by reading it"* (2026-08-29) applied to a claim *about* a check.

---

## Red before green, by mutation

Every clause was shown to fire on its own before the fix was trusted. Three mutations, run against
the shipped tests:

| mutation to `main.ts` | result |
| --- | --- |
| `await HANDLERS[cmd](parsed)` → `void HANDLERS[cmd](parsed)` | **2 red**: *"main does not resolve until an asynchronous help handler does"* and *"a rejecting help handler rejects main, which is what carries it to die"*; 92 pass |
| `HANDLERS[cmd](parsed)` → `HANDLERS[cmd]({ cmd, rest: [], flags: {}, gateAnswers: [] })` — a handler given only its own name, which is exactly what the review objected to | **1 red**: *"the help handler receives exactly what parseArgv returned"*; 93 pass |
| `CommandHandler` narrowed to `(argv: ParsedArgv) => void` | **green** — typecheck and all 94 tests. Recorded above and in the test, not hidden |

The fourth check, *"the registry is what the type says it is, and the spies restore it"*, asserts that
`vi.restoreAllMocks()` really put the table back, so a later test in the file cannot silently run
against a mocked frame. It discriminates: without the restore, `vi.isMockFunction(HANDLERS.help)` is
`true`.

---

## Files changed

**`packages/cli/src/main.ts`** (+37 / −9)

- New exported `CommandHandler` type: `(argv: ParsedArgv) => void | Promise<void>`, with the JSDoc
  citing `spike/bin/harness.js:40–42` for why a handler gets all four fields and `:569` for why it
  may return a promise.
- `HANDLERS` is re-typed to it and **exported**. Justification, because it is the one judgement call
  in this round: it is the frame's registry rather than an implementation detail — Q-0091 to Q-0094
  each add an entry to it — and exporting it is what let the two new checks run over
  `COMMANDS`-derived entries rather than over a command invented for the test. The alternative
  considered was an optional handler-table parameter on `main`; rejected as a test seam the
  requirement does not ask for, and as an argument no production caller would ever pass.
- `main` parses once, destructures `cmd` from the result, and `await`s the handler with the whole
  parsed value.
- Module JSDoc: the *"async with nothing to await"* paragraph replaced by what is now true, naming
  the detached-rejection failure it prevents.
- One prose line rewrapped to the file's 100-column style.

**`packages/cli/src/main.test.ts`** (+87 / −1)

- New `describe` block, four tests, all `test.each([...COMMANDS])` where they can be, so a sibling's
  handler inherits the checks rather than needing its own:
  1. the handler receives exactly what `parseArgv` returned — asserted structurally **and** field by
     field, because a structural comparison against the parser's own output would still hold if both
     sides lost a field;
  2. `main` does not resolve until an asynchronous handler does (the held-promise form above);
  3. a rejecting handler rejects `main`, which is what carries it to `die`;
  4. the registry is restored after the spies.
- Imports widened to `parseArgv`, `ParsedArgv`, `COMMANDS` and `HANDLERS`. The existing `invoke`
  helper and the existing `afterEach` restore are reused unchanged.

`main.test.ts` goes from 8 tests to 12; the package from 90 to 94.

---

## What I deliberately left alone

- **No command is implemented**, and none was tempted into existence to give the new checks a
  subject — the spies stand in for one, which is why they run over `COMMANDS` rather than over a
  registered fixture. AC-8 and non-goal 2 hold.
- **`frame.source.test.ts`'s AC-8 scan was not weakened.** It fired on my first draft, because the
  module JSDoc named `runFlow` while describing the spike's `run` case — a text-anchored guard
  catching a comment. That is the safe direction of that guard's failure mode (it can be tripped by
  prose; it cannot be talked out of firing by prose, which is Q-0079 round 1's defect), so I reworded
  the comment to *"awaits the engine"* rather than exempting comments from the scan.
- **The other six modules are untouched** — `argv.ts`, `colour.ts`, `commands.ts`, `exit.ts`,
  `fail.ts`, `index.ts` — as are `package.json`, `turbo.json` and `pnpm-lock.yaml`. No new
  dependency, third-party or workspace.
- **Every preserved defect stays preserved and pinned**: argv behaviours 4 and 5 (`-v` is a
  positional; `--` swallows the next token), `die`'s space inside the red span, `dieOnUnexpected`'s
  two raising rows, an unknown or absent command exiting 0 (AC-6), and `regressed` sharing
  `completed`'s code (AC-4(c)). GA-4 is still owed for the last two.
- **No signal handler was added** (AC-4(d), non-goal 3), and `packages/cli` still registers none —
  asserted over the package and at runtime.
- **The `@quorum/core` trap is unchanged**: declared, proven unresolvable, with the authority line
  naming Q-0096 as the ticket that turns that assertion red. GA-5 still owes the note in Q-0091's
  body.
- **No register moved.** `spike-parity.test.ts` is untouched — this round translated no `spike/test/`
  file, so its four pinned totals (220 / 2739 / 2469 / 5428, 55%) are unchanged and were not
  adjusted. `turbo-inputs.test.ts` carries the registration earned in an earlier round;
  `test-command.test.ts`'s seven-job register is unmoved (no CI job added); `test-discovery.test.ts`
  needed nothing, this package already declaring all three tasks. The `docs/06-development-plan.md`
  bullet for Q-0096 (AC-11(a)) landed in an earlier round and is still green.
- **`backlog/` is untouched**, including Q-0010 §2's four stale figures — GA-3, the human's.

---

## Verification

All run in this implement worktree, forced, after the change:

| what | result |
| --- | --- |
| `pnpm --filter @quorum/cli test` | 8 files, **94 passed** |
| `pnpm turbo run test --force` | **7 successful, 7 total; 0 cached**, 27.8 s |
| `pnpm turbo run lint --force` | 7 successful, 7 total; 0 cached |
| `pnpm turbo run typecheck --force` | 7 successful, 7 total; 0 cached |
| `npm test --prefix spike` | **all 19 test files passed** |
| `node spike/bin/harness.js lint` | 6/6 flows ✓ |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

Dependencies were installed in this worktree before any of it (`harness/rules.md`: an implement
worktree has none until it installs them). The second environment row — forced on `main` after the
merge, per Q-0072's closing finding — is `integrate`'s and the human's, not this step's.

---

## Nothing else is claimed

This round changed the dispatch and its tests. It did not make anything run: the workspace still
emits no JavaScript, `bin` still points at a target that does not exist, and `npx quorum` is still
withdrawn — all Q-0096's by the gate ruling of 2026-09-01. The frame remains importable modules with
tests that run in process, which is what Q-0090 was cut down to.
