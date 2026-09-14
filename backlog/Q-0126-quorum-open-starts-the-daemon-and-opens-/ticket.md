---
id: Q-0126
title: quorum open starts the daemon and opens a browser
stage: draft
owner: ruud
repos: []
branch: harness/Q-0126/integration
priority: p1
created: 2026-09-12
iterations: {}
history: []
---
M3's done-when names quorum open and no ticket builds it. packages/cli declares no dependency on @quorum/server, there is no open command, and the CLI's AC-11 forbids every production module from importing node:child_process — so the browser spawn cannot happen in packages/cli at all.

Opened **2026-09-12**, the same day as **Q-0125**, which it depends on. It is **(b) of Q-0124's
body**, lifted out at the moment it acquired a blocker Q-0124 does not share — see *What it collides
with* below. `p1`: it owns a line of M3's own done-when that no ticket owned.

## The gap, measured 2026-09-12

M3's done-when says *"`quorum open` starts daemon + browser; CLI and UI can both answer the same
gate."* Measured against the tree: **`packages/cli` declares no dependency on `@quorum/server`**,
there is **no `open` command** in `packages/cli/src/`, and M3's ticket list is Q-0013 to Q-0019 plus
Q-0118 to Q-0126. So nothing in the CLI can start a daemon, and **the daemon has only ever run under
its own test suite**.

After Q-0122 that is the sharper problem rather than a loose end: `apps/web` emits a 316 K bundle and
`packages/server` serves it on `GET /*`, so **the product has a UI nobody can open**.

## The constraint that shapes it, and it is not the obvious one

**`packages/cli` may not spawn a process.** `frame.source.test.ts:599`'s AC-11 —
*"no production module imports a filesystem or process-spawning module"* — refuses
`node:child_process`, `node:fs`, `node:os` and `node:url` in **every** production module of that
package, with the reasoning that *"every read and every spawn goes through `@quorum/core`"*.

Opening a browser **is** a spawn: `open` on darwin, `xdg-open` on Linux, `start` on Windows. So the
browser half of this command cannot live in `packages/cli` at all. The precedent is exact and is
Q-0093's: `init`'s scaffolding became `core/backlog/scaffold.ts` for this same rule, and what the
command kept was one expression. `core` already spawns in two places — `adapters/exec.ts` and
`fanout/fanout.ts` — so the primitive has somewhere to go and a house style to follow.

**That primitive is the ticket's real design question**, and it is larger than it looks: which
command per platform, what a failure to launch means (the daemon is up and the browser is not — a
warning, surely, and not a failed run), whether a browser is opened at all under `--no-open` or over
SSH, and whether `core` is even the right home for something that is neither git, backlog, adapter
nor engine. **Read `04-architecture.md`'s principle 1 before choosing**: *"`core` has no I/O it
doesn't own"*.

## What it collides with, and this is why it is its own ticket

**A packed install breaks the moment `packages/cli` imports `@quorum/server`.** `@quorum/cli` is one
of the three tarballs the local distribution set packs; `@quorum/server` is `private: true` with no
`files` and — after Q-0125 — emits but is still not distributed. `workspace:*` either rewrites to a
`0.0.0` the registry does not have or stays literally invalid outside a workspace (Q-0098 M-8, which
is why that fixture installs three tarballs together).

So this command has **two** paths and they do not behave alike:

- **The workspace-local path** — `pnpm turbo run build`, `pnpm exec quorum open` — works once Q-0125
  lands, and is one of the two paths this repository claims and tests.
- **The packed path** — three tarballs installed into a project outside the repository — does not,
  and `quorum help` may break there too if the handler table imports the command statically.
  `main.ts` dispatches `HANDLERS[cmd](parsed)` from a **static** table, so an `open` module importing
  `@quorum/server` is loaded whatever command was typed. **Q-0098's packed fixture would go red on
  `quorum help`**, which is a regression on a tested path rather than a missing feature.

**That is a blocking question for this ticket's gate and it has at least three answers**: make
`@quorum/server` a fourth tarball (which is **Q-0124(a)**'s question for a different package, and
which decision 092 deliberately left open); import the command dynamically at dispatch so the packed
install refuses `open` with a sentence and keeps every other command; or hold this ticket until
Q-0124 rules the distribution set. **Measure before choosing, and measure the fixture first** — the
claim above that `quorum help` breaks is reasoned from `main.ts`'s static dispatch and has **not**
been reproduced.

### Measured 2026-09-14, and the paragraph above is wrong about where it breaks

The instruction was followed before this ticket was launched. A throwaway worktree off `main` at
`9bef7d0` carried a production `packages/cli/src/open.ts` reaching `@quorum/server`, wired into
`HANDLERS` **and** `COMMANDS` so the emit really loads it, and each shape was run against Q-0098's own
fixture — *"the packed set installs outside the workspace with the registry dead, and runs"*, which
executes `quorum help` and `quorum init` in the packed project.

| `@quorum/cli` declares | import shape | packed `npm install` | packed `quorum help` | workspace `quorum open` |
| --- | --- | --- | --- | --- |
| `dependencies` | static | **FAILS** — `ECONNREFUSED`, `requiredBy: node_modules/@quorum/cli` | never reached | works |
| `optionalDependencies` | static | passes | **FAILS** — `ERR_MODULE_NOT_FOUND` from `dist/open.js` | works |
| `optionalDependencies` | **dynamic** | **passes** | **passes** | **works** |

**The prediction above is row 2 and the tree gives row 1.** `pnpm pack` rewrites `workspace:*` to
`0.0.0` — verified by unpacking the tarball's own manifest, which reads
`{"@quorum/core":"0.0.0","@quorum/shared":"0.0.0","@quorum/server":"0.0.0"}` — so npm reaches for a
registry that is not there and **the install dies before any module loads**. `quorum help` is never
reached, so the failure is a dependency-resolution failure and not a module-resolution one.

**Therefore the second of the three answers does not work on its own, and the body names only one
half of it.** A dynamic import cannot help a manifest: with `dependencies`, the install fails
whatever shape the import takes. What works is **both** — `optionalDependencies`, so npm skips an
unresolvable optional and the install completes, **plus** a dynamic import inside the handler, so the
absence is catchable and `quorum open` can print a sentence while every other command is untouched.
Row 3 is that combination and it is demonstrated rather than proposed.

**This unblocks the ticket from Q-0124 rather than settling Q-0124.** The third answer — hold until
the distribution set is ruled — becomes optional rather than necessary. **The caveat is stated rather
than buried: under row 3 a packed install still cannot open the UI.** That is not a regression, there
being no `open` today, but it means this ticket ships a command that works on **one** of the two
paths this repository claims, and the end state stays Q-0124's. Whether that is acceptable is a gate
question, not a measurement.

**The requirement should weigh row 3 rather than adopt it.** It is the cheapest shape that keeps both
paths alive, and it has a cost the gate should price: `optionalDependencies` makes a *silent* skip the
normal case, so an adopter whose install genuinely half-failed and one whose install is working as
designed reach the same sentence. That is the shape this repository refuses elsewhere — *"a failed
probe read as a proven negative"* (Q-0074, Q-0115) — and saying `the daemon is not installed here`
when the real cause is something else is exactly that class. Whether the command can tell the two
apart is worth a criterion.

### The blast radius, measured the same way: six registers, and the first is Q-0125's own

A full forced suite under the probe shape failed **6 tests across 2 packages**, every one a guard
working as designed:

- `packages/core/src/test-discovery.test.ts` — **Q-0125 AC-13**, *"nothing depends on
  `@quorum/server`"*, whose own comment reads *"This is Q-0126's first line, and it must fail here."*
  It did. The criterion shipped the day before, firing on exactly the change it was written for.
- `packages/core/src/adapters/cli-version.test.ts` **clause D** — the namespace-import route check.
  `await import('@quorum/server')` binds every export under one identifier, which is that clause's
  stated subject. **Whether it genuinely reaches this use or is a false positive here is a ruling this
  requirement owes**, and it matters because it means row 3's shape is not free: it trips a guard in a
  package this ticket does not otherwise touch.
- `packages/cli/src/commands.test.ts` — the registry is *"help plus the spike's eight … and nothing
  else"*, so a ninth command fails it.
- `packages/cli/src/frame.source.test.ts` ×3 — the frame/command partition, the derived barrel
  re-export, and the frame-implements-no-command clause.

And `pnpm install --frozen-lockfile` refuses until the lockfile is committed, which is the flag CI
uses.

**One methodological note, because it nearly cost the measurement.** The first probe passed the packed
fixture and proved nothing: `main.ts` imported `open` without using it, so `tsc` elided the import and
the module was never loaded. Wiring `open` into `HANDLERS` is what made the emit carry it. *A check is
not established by reading it* (2026-08-29), inside the measurement written to settle this question —
so a criterion here must assert that the emit **loads** the module, not merely that a file imports it.

## What else it owes

The **port**. `apps/web/vite.config.ts`'s header records that `QUORUM_DAEMON_PORT`'s 7717 is *"a
dev-server convention, not a contract: the daemon itself has no default port (`packages/server`
binds whatever the OS hands back), so `quorum open` is what will later have to agree with this
value."* This is that later. Deciding it here means deciding what a second `quorum open` does when
the first holds the port.

And **lifecycle**: `createDaemon` resolves to a `close()` that shuts the host down before the socket,
and `RunHost.shutdown()` releases every live run through the abandonment path. A command that starts
a daemon owns when that runs — on SIGINT, on the browser closing (which it cannot observe), or never.
`core` installs no signal handler by *"What a run's event stream carries"* (2026-08-28); the CLI does
its own aborting at `run.ts:179–180`, which is the precedent.

## Non-goals

The gate screen (Q-0016) — this ticket does not make *"CLI and UI can both answer the same gate"*
true, it makes the UI reachable; the distribution ruling (Q-0124); the export surface (Q-0125); and
any screen.

**Depends on Q-0125**, strictly: there is nothing to import until that lands.
