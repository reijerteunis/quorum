# Q-0126 — implement report, run 2, iteration 1

**Verdict: `blocked`, on AC-16 and the AC-12–AC-15 it gates. AC-1 to AC-11 are complete, verified
and green.**

Read §7 first if you are the gate: it is one sentence of ruling and the run finishes.

---

## 0. What was already on the branch, and was not re-done

`806cd31` landed GO-2 by hand before this run, exactly as erratum E-1 said it would. Verified rather
than assumed:

- `packages/cli/package.json` already carried `optionalDependencies: { "@quorum/server":
  "workspace:*" }`, and `pnpm-lock.yaml` with it — **AC-7's manifest edge**.
- `packages/core/src/test-discovery.test.ts`'s `namesTheDaemon` was already keyed on the **key**
  rather than the count, with the hostile and permitted fixtures differing in the key alone — **AC-9
  in full**.

Neither was touched. AC-7's *other three* registers were not landed by that commit and are this
round's (§3).

---

## 1. File by file

### New

**`packages/cli/src/open.ts`** — the command. Resolves the daemon through `await
import('@quorum/server')` inside the handler, then the project through `@quorum/core`'s
`loadProject` (rendered by `fail.ts`'s existing `dieNoProject`, so the sentence a stranger sees is
still the single one Q-0111 made single), then the port, then `createDaemon`. Prints one line, awaits
a signal, closes, exits `SIGNAL`.

Four things in it are rulings rather than code, and each carries its authority in place:

- `BUNDLE` is `new URL('../../../apps/web/dist/', import.meta.url)` and crosses the package boundary
  **unconverted** (AC-3, §0.1 of the requirement).
- `NO_DAEMON_CONDITION` / `NO_DAEMON_REMEDY` are exported so the packed fixture can assert the
  refusal **by bytes**, and they claim what failed to resolve *here* and nothing about why (094
  clause 2).
- `portFrom` accepts a **digit string** rather than coercing, because `Number` swallows the two
  interesting failures — `argv.ts:54` gives a valueless `--port` the boolean `true` (the port `1`)
  and `--port ""` is `0` (ask the OS). `0` is accepted deliberately: it is `serve`'s own meaning.
- `openOn({ bundle })` / `open = openOn()` is `run.ts`'s `runOn({ … })` seam at a second site. **It
  is not a `--bundle` flag** (non-goal 6): the operator surface stays one way to find the bundle.
  What it buys is §5's hazard, avoided.

**`packages/cli/src/open.test.ts`** — 13 tests. AC-2's serving proof runs over a real socket on an
OS-assigned port: `GET /` answers the bundle, `GET /project` answers JSON, `GET /runs/run-3` with
`accept: text/html` answers 200 (the deep link Q-0120's B-1 was about), then `process.emit('SIGINT')`
and the socket is gone. AC-4's refusal is asserted **by attempting a connection**, not by reading the
message. AC-5's occupied-port refusal is required to carry exactly one number, so *"bound 51234
instead"* fails.

### Changed

| File | What moved |
| --- | --- |
| `packages/shared/src/constants.ts` | `DEFAULT_DAEMON_PORT = 7717`, one declaration, two readers (AC-5, OQ-6's recommendation) |
| `apps/web/vite.config.ts` | reads that constant instead of the literal; its header's *"`quorum open` is what will later have to agree with this value"* rewritten to what happened |
| `packages/server/src/serve.ts` | `ServeOptions.bundle` and `createDaemon`'s `bundle` take `string | URL`; one conversion site, `bundleDir` |
| `packages/server/src/static.test.ts` | AC-3's round trip: a bundle root under a path **containing a space**, served through a `URL` |
| `packages/cli/src/commands.ts` | `COMMANDS` gains `'open'` **appended last**; one help line at the same description column |
| `packages/cli/src/main.ts`, `index.ts` | handler registered, module re-exported; `main.ts`'s docblock says why dispatch stays static |
| `packages/cli/src/commands.test.ts` | registry ten, superseded value refused, AC-11's derived documentation guard |
| `packages/cli/src/frame.source.test.ts` | `COMMAND_DOMAIN['open.ts']`, the partition, `SELF_LOCATING`, `SIGNAL_HANDLER_OWNER`, AC-3's two new demonstrations |
| `packages/cli/src/package.test.ts` | `Manifest.optionalDependencies`, AC-7's whole-shape assertion, three `OUTSIDE` rows, two `DECLARED` entries |
| `packages/cli/src/build.test.ts` | `workspaceDepsOf` reads both sections; packed-manifest assertions; AC-8's emit clause; AC-10's packed `quorum open` |
| `packages/cli/turbo.json` | `README.md` and `docs/USAGE.md` declared |
| `packages/core/src/adapters/cli-version.test.ts` | clause D's **first** permitted entry, with both directions and the raw-text trap |
| `apps/web/test/daemon-endpoints.test.ts` | AC-5's agreement, by **resolving** the config's proxy target rather than reading its text |
| `docs/04-architecture.md`, `docs/06-development-plan.md`, `docs/USAGE.md`, `README.md`, `harness/product-context.md` | AC-11 |

---

## 2. The corrections this round made to the requirement's own design

**AC-3 as iteration 1 wrote it was unimplementable, and §0.1 is right about why.** Confirmed by
building it: `packages/cli` may import no `node:url` (`IO_MODULE`, asserted `toStrictEqual([])` over
every production module), and `new URL(…).pathname` leaves percent-encoding in place. That is now a
red test rather than a paragraph — `static.test.ts` asserts that `.pathname` over a root containing a
space yields a directory `bundleRefusal` correctly refuses, and that the `URL` itself round-trips and
is served.

**§0.2's trap fired, twice, on me.** Clause D reads raw text, so the authority line lives in the
registered file. It cost me two guards on first writing:

1. An AC-3 clause asserting `open.ts` contains no `.pathname` was satisfied by the **docblock
   explaining why `.pathname` is refused**. Fixed by reading through `codeOf`, with a third assertion
   requiring the prose to still be there — so the distinction is load-bearing rather than incidental.
2. The comment in `open.test.ts` explaining why that file installs no signal handler **was read as
   installing one** by `SIGNAL_HANDLER_OWNER`'s scan, and turned that register red. Reworded around
   the literal, and the paragraph now says so.

Both are the class `codeOf` exists for, met inside the ticket that was warned about it.

**AC-2's `--host` scan had to be narrowed, and the boundary is measured.** A package-wide scan
reports `build.test.ts` (its closed-registry fixture) and `open.test.ts` (every `fetch`). The corpus
is stated as *what ships* — production modules under `src/` — with the two readers named as the
reason, plus a separate by-name assertion over the help text.

**AC-11's *Test:* clause names a guard that would not have fired.** It says the new check "earns its
`turbo-inputs.test.ts` registration". That file's `SUITES` is `@quorum/shared#test` and
`@quorum/core#test` and its own header says `@quorum/cli`'s declaration "is checked by its own suite
rather than by this file". So the registration landed where it is actually enforced —
`package.test.ts`'s `DECLARED` and `OUTSIDE` — and `packages/cli/turbo.json` declares both reads. The
substance of the clause is met; the instrument it named is the wrong one.

---

## 3. AC-7's third register, and a measurement nobody asked for

`workspaceDepsOf` read `.dependencies` alone — exact while no manifest declared anything else, and
**blind to the one edge whose rewriting AC-19(b)'s install depends on**. Widened to both sections,
and the widening is shown to *change* the derivation rather than leave it identical (a widening that
changes nothing has not been established). The packed `@quorum/cli` manifest is now asserted to carry
the rewritten version under `optionalDependencies` **and not** under `dependencies`, because a packer
that promoted the key would rewrite it correctly and still kill the install.

**Measured rather than assumed:** the `optionalDependencies` edge creates the same turbo `^test` edge
a required one would. Appending a line to `packages/server/package.json` moved `@quorum/cli#test`
from `e381d3d003a8d31e` to `45b8b67c3f133524` with nothing declared, and the probe was reverted. So
`build.test.ts`'s new read of that manifest is covered transitively and declaring it would be the
same claim twice. Recorded in the `OUTSIDE` row with both hashes — Q-0121's discipline.

---

## 4. GO-6 — every widened register shown red, one mutation at a time

Each was reverted immediately after. None was shown red by a neighbour (Q-0107).

| Mutation | Red, and how |
| --- | --- |
| `SELF_LOCATING` loses `open.ts` | 3 tests, incl. `open.ts: it resolves its own location and no entry says why it may` |
| `SIGNAL_HANDLER_OWNER` loses `src/open.ts` | 2 tests, incl. the superseded-value clause by name |
| `DEFERRED_SPECIFIER` emptied | 3 tests, incl. clause D itself |
| manifest `optionalDependencies` → `dependencies` | `test-discovery` *"requires @quorum/server, which kills the packed install"*; `package.test.ts` 2 tests |
| `workspaceDepsOf` back to `.dependencies` | *"the optional daemon edge is invisible to the workspace-protocol check"* |
| README loses the `open` row | 2 tests, incl. the dispatched-set comparison |
| `ServeOptions.bundle` back to `string` | **compile** failure, `TS2322`, in two packages |

`COMMANDS`, the partition and the help column are covered by the superseded-value assertions written
beside each (the shape every command child before this one used).

---

## 5. One hazard found and designed around, rather than shipped

AC-2 asks the command to be driven "with a temporary project and a temporary bundle". The shipped
bundle root is module-relative by AC-3 and names `apps/web/dist`, so the obvious fixture parks the
workspace's emit and copies a fixture there. **That races `build.test.ts`'s own `runBuild()`**, which
builds `apps/web/dist`, in the same package, under Vitest's parallel workers. A crash mid-test would
also leave a `dist.q0126-parked` behind.

Refused, and `openOn({ bundle })` used instead — `run.ts`'s own seam, which `test/invoke.ts`'s
`capture` documents for exactly this case. The registered `open` still uses `BUNDLE`, and
`frame.source.test.ts` asserts both that the default is that expression and that it is what reaches
`createDaemon`.

---

## 6. Verification

- `pnpm install --frozen-lockfile` clean. `pnpm turbo run test lint typecheck --force --continue` →
  **21/21 tasks, 0 cached, 0 errors**, run four times across the round.
- `pnpm turbo run build --force` → 5/5. `pnpm exec quorum help` through the installed shim lists ten
  commands at one description column.
- **The command was run by hand**: `pnpm exec quorum open` printed
  `✓ Quorum is serving http://127.0.0.1:7717 — press Ctrl-C to stop` and served until stopped.
- `pnpm exec quorum lint` 6/6.
- `pnpm sweep:git-identity` → *"environment discriminates (negative and positive probes both as
  expected)"* and *"the workspace suite executed and green with no resolvable git identity"*.

---

## 7. Why this is `blocked`, and what unblocks it

**Erratum E-1 refused the split, so AC-12 to AC-16 are this ticket's.** AC-1 to AC-11 are done.
AC-12 to AC-16 are not, and one sentence is the whole reason.

**AC-16 requires, verbatim, that "the decision entry GO-4 asks for is landed before a line of
code".** `developer-generalist` may not write one — it is the first case my role names for this
verdict, and E-1 preserved it explicitly: *"`blocked` remains correct for any other criterion needing
something outside `developer-generalist`'s authority."*

**GO-4 stands unchanged** (E-1 says so) and asks a gate to settle *whether principle 1 widens or
whether the primitive sits in an existing folder*, **before the successor runs**. With the split
refused, this run is the successor, and it was not settled.

**I measured the folder question rather than choosing for it**, because the answer decides whether an
entry is owed at all:

- **`fanout/` is closed.** `fanout.source.test.ts:44` pins *"the folder is exactly the two files"*,
  which Q-0070's requirement landed as a design constraint rather than churn.
- **`adapters/` is the wrong kind.** `harness/architecture.md` says vendor-specific knowledge lives
  in the adapter and nowhere else, and `exec.ts`'s own docblock calls itself *"the only file in this
  folder that may reach for `node:child_process`"* — for a vendor CLI. A browser is not one.
- **`backlog/`, `engine/`, `git/`, `lint/`, `run-history/`, `contracts/`** are each named after what
  they are about, and none of them is about this.
- **A ninth folder is branch (a)**, which Appendix A itself says costs a decision entry.

So **no folder a measurement selects** — which is an argument *for* GO-4 being a real ruling, not
against the ticket. Choosing one anyway would be the thing my role forbids in as many words: *"Where
the requirement does not cover a case, you stop and report it instead of choosing for it."*

**What a `retry` needs**, so round 2 is cheap:

1. The GO-4 entry landed on `harness/Q-0126/integration` (not `main` — Q-0067 GO-2's reason applies
   again), saying whether `04-architecture.md` principle 1's *"spawns CLIs, reads/writes the project
   folder and git"* widens, and naming the folder either way.
2. Then AC-12 to AC-15 are ordinary work and I can finish them in one round: the launcher table, the
   closed-set result union, `--no-open`, the byte-identical URL line, and AC-14's assertion that
   `IO_MODULE` passes **without an edit** — which AC-3's `string | URL` widening already protects.

Appendix A's own blocking question — **Windows**, where `start` is a `cmd.exe` builtin rather than an
executable — should be ruled at the same gate. This repository has never claimed Windows support
(Q-0098 registered the POSIX-only build), which argues for the explicit `unsupported` state rather
than a silently claimed row.

**Everything AC-1 to AC-11 asks for is on the branch and green.** If the gate would rather ship the
daemon half than hold it, `advance` costs nothing here: the successor's body is already written out
in full in Appendix A, and nothing in what shipped presupposes the browser.

---

## 8. Reported and not fixed

- **`harness/architecture.md:25` says "Four packages emit and three are packed"**, and
  `harness/product-context.md`'s pillar 7 carries the same clause. Both are stale since **Q-0125**
  made `@quorum/server` the fifth emitter — `docs/04-architecture.md:317` says five. These are
  context files fed to agents at run time, which is Q-0098's argument for why it matters. Not fixed:
  it is another ticket's claim with its own register sites (Q-0125 §0.2 counted sixteen), and moving
  one of two would make the drift worse rather than better. I edited pillar 7's *adjacent* clause
  because decision 094 clause 3 rules that one, and left the count alone.
- **`packages/core/src/backlog/backlog.ts:330`** — `Unused eslint-disable directive (no problems were
  reported from 'no-control-regex')`. Pre-existing, in a file this change does not touch, 0 errors.
- **`turbo-inputs.test.ts` does not scan `packages/cli`** (§2). Its own header says so and calls
  admitting a third member *"whichever ticket re-derives them"*. Not this one.
- **`loadProject(dir)` with an explicit `--project` raises `ENOENT` rather than
  `ProjectNotFoundError`**, so the friendly sentence is reachable only through `findProject`. That is
  `core`'s behaviour and every command's, not this one's; AC-2's test asserts the class through a
  projectless working directory and says why.

## 9. Process note

I edited `harness/product-context.md` at the **main checkout's** path first, which is the user's
working tree and forbidden. Reverted there — confirmed 0 occurrences remain — and re-applied inside
the worktree. Recorded because the additional-working-directory paths make it easy to do and hard to
notice, and the next implement step will meet the same trap.
