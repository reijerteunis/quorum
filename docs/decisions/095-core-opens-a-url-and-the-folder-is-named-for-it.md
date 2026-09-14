# `core` opens a URL, and the ninth folder is named for what it is about — 2026-09-14

## Decision

`packages/core/src` gains a **ninth folder**, `browser/`, holding one exported primitive that opens a
URL in the platform's default browser. Principle 1's enumeration widens by one to name it.

1. **`core` is the only place it can live, and that is settled before taste enters.**
   `packages/cli`'s AC-11 (`frame.source.test.ts:186`) refuses `node:child_process` in **every**
   production module of that package, on the stated ground that *"every read and every spawn goes
   through `@quorum/core`"*. Opening a browser is a spawn — `open` on darwin, `xdg-open` on Linux.
   So the browser half of `quorum open` cannot sit in the package whose command it serves, which is
   Q-0093's precedent exactly: `init`'s scaffolding became `core/backlog/scaffold.ts` for this rule
   and the command kept one expression.

2. **Principle 1's enumeration widens; its rule does not change.**
   `04-architecture.md:51` reads *"`core` has no I/O it doesn't own. It spawns CLIs, reads/writes the
   project folder and git."* That sentence is a **description of the I/O `core` had**, not a closed
   list of the I/O it may have — the rule is the first clause, and the enumeration illustrates it. It
   becomes *"It spawns CLIs, opens a URL in the platform's default browser, reads/writes the project
   folder and git."* Everything else principle 1 forbids is untouched and is repeated here so the
   widening cannot be read as general: **never the network, never a secret, never an API key.**
   Handing a URL to a local launcher is not reaching the network — `core` opens no socket and learns
   nothing about what is at the other end.

3. **A ninth folder, because no existing one is about this — measured, not felt.**
   `packages/core/src` is `adapters`, `backlog`, `contracts`, `engine`, `fanout`, `git`, `lint`,
   `run-history`, each named after what it is about (Q-0064). Against them: **`fanout/` is closed** —
   `fanout.source.test.ts:44` pins *"the folder is exactly the two files"* as a design constraint
   Q-0070 landed deliberately. **`adapters/` is the wrong kind** — `harness/architecture.md` says
   vendor-specific knowledge lives in the adapter and nowhere else, and `exec.ts`'s own docblock
   calls itself *"the only file in this folder that may reach for `node:child_process`"*, for a
   **vendor CLI**; a browser is not one, and widening that sentence to cover it would make the
   folder's name stop selecting its contents. The remaining six are each about something this is not.
   **A folder placed where it is not about anything is how a layout stops meaning what Q-0064 made it
   mean**, so the ninth folder is the cheaper answer, and it is a visible act by construction.

4. **It spawns an executable with the URL as an argv element, and never composes a command string.**
   `open <url>` and `xdg-open <url>` are executables taking the URL as one argument. No shell, no
   interpolation, and therefore no injection surface — which is the property that makes clause 2's
   widening safe to state at all.

5. **Windows is `unsupported`, explicitly, and is not a silently claimed row.** Windows `start` is a
   **`cmd.exe` builtin rather than an executable**, so an argument-based spawn cannot exec it, and
   the alternative — composing a URL into a `cmd /c start …` string — is exactly the injection
   surface clause 4 exists to refuse. This repository has never claimed Windows support and Q-0098
   registered the POSIX-only build as owed a ticket *only if it ever does*. So the platform table
   answers the **`unsupported platform`** member of the primitive's own closed result set, which
   already exists for this purpose, rather than a row that claims a launch nobody has run.

6. **The primitive reports what it spawned, never what a browser did.** It cannot observe whether a
   page opened: it knows the process it started and how that process exited. *launched* therefore
   means *the launcher was spawned and exited zero*, never *a browser is showing this page*, and a
   failure is never rendered as *there is no browser*. Containment's, push lag's and verified
   version's discipline at a fourth subject, and *"A probe that could not answer is not a negative"*
   (2026-09-10) at the site Q-0074 and Q-0115 spent two tickets removing instances of.

## Alternatives considered

**Put it in `adapters/`, beside the one file already permitted to spawn.** The strongest alternative,
and it has the mechanism right — `exec.ts` already owns process spawning and its retry and error
translation are exactly what a launcher wants. Refused on what the folder *means*: that docblock
permits the spawn **for a vendor CLI**, and `harness/architecture.md` confines vendor knowledge to
that folder. A browser launcher there would either be vendor knowledge that is not about a vendor, or
force that sentence to widen so far that `adapters/` stops naming its own contents. The mechanism can
still be shared without the location being.

**Put it in `engine/`, since `quorum open` is a command the engine does not run.** Refused as the
same error one folder over: `engine/` is about running a flow, and nothing about opening a URL is.

**Leave principle 1's enumeration alone and treat a browser launch as covered by "spawns CLIs".**
Tempting because it needs no document edit, and refused because it is false: `open` and `xdg-open`
are not CLIs this product orchestrates, and reading the enumeration loosely enough to swallow them
makes it stop constraining anything. An enumeration that can be read to permit whatever arrives is
not a boundary.

**A tenth package, `@quorum/launcher`.** Refused on cost against benefit: it moves five registers,
adds a sixth emitter three days after Q-0125 made the fifth, and buys separation nothing has asked
for. `core` is already the package that owns I/O.

**Ship `quorum open` with no browser at all and print the URL.** Genuinely defensible — it is what
`--no-open` does, and it needs no ruling. Refused because M3's done-when says *"starts daemon +
browser"* and a command that prints a URL is the thing that line exists to improve on.

## Why

**Because the question GO-4 asked is not "where is it convenient" but "what does a folder name
claim".** Q-0064 made `packages/core/src` one folder per subject so that a reader could find code by
what it is about, and every argument for putting a browser launcher in an existing folder is an
argument for making one of those names less true. The cost of a ninth folder is one directory and one
sentence in a numbered document; the cost of the alternative is paid by every later reader who looks
in `adapters/` for vendor knowledge and finds a `xdg-open` table.

**The widening in clause 2 is the part that will be quoted later, and it is deliberately narrow.**
What moved is one item in an enumeration, not the principle: `core` still has no I/O it does not own,
still never touches the network, still never stores a secret. A future change that wants to widen it
again writes its own entry, and the enumeration is the thing it has to name — which is what makes
this a boundary rather than a list that grew.

**Clause 5 is what stops this being a claim the product cannot back.** Naming Windows `unsupported`
is a smaller promise than a `cmd /c start` row nobody has run on Windows, and the closed result set
already had the member to say it with. This repository has been wrong in that direction before —
Q-0098's own `chmod +x` finding is the POSIX-only build registered rather than fixed — and the
correction there was to say so, not to claim the platform.
