# Q-0126 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at or after its gate and binding on the implementer
and the reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — OQ-2 is refused: one ticket of sixteen. OQ-1 is ruled row 3 and its entry is landed — 2026-09-14

**Supersedes** OQ-1's and OQ-2's *BLOCKING* status, GO-1's first half, GO-2's *"before the run is
launched"* instruction as work still owed, and GO-3's conditional. `merged.md` is otherwise unamended
and all **sixteen** of its criteria stand as written.

### OQ-2 — refused: Q-0126 is one ticket of sixteen criteria

The gate refused the split its own document recommends, and **that costs something, which is written
down here rather than presented as fine.** Sixteen is past the fifteen this role uses, past the
**eighteen** Q-0013 was refused at, and short of the **twenty-one** that split Q-0091 and Q-0096. The
precedent says a ticket this size either splits or spends the difference in review rounds: Q-0122 was
accepted at **twenty** and paid three implement rounds and $79.41 for it.

**The seam stays measured and written out for as long as this ticket runs.** It is at the browser:
**AC-1 to AC-11** need no spawn, no new `core` symbol and no new barrel name; **AC-12 to AC-16**
need all three, and Appendix A already carries them in full.

**Named in advance, on Q-0122 E-1's precedent: if the revise loop exhausts on the browser half, the
remedy is a second erratum promoting AC-12 to AC-16 into a successor at that gate — NOT a fourth
implement round.** Q-0091 and Q-0101 priced rounds spent on unrulable blockers at $14.28 and $31.16.

**Not eligible for trimming**, for reasons measured rather than asserted: **AC-7** and **AC-8** are
the packaging shape this ticket exists to land and the only clause-D exemption the workspace has;
**AC-9** is the guard that must keep failing for a `dependencies` edge while passing for an optional
one, which is the whole difference between the two; **AC-3** carries the `string | URL` widening
without which `bundleRefusal` reports *"no built web app"* on a machine where the build is present;
and **AC-10** is the refusal sentence decision 094 clause 2 governs.

### OQ-1 — ruled row 3, and the entry is landed

`packages/cli` declares `optionalDependencies: { "@quorum/server": "workspace:*" }` and reaches the
daemon through a **dynamic** import inside the `open` handler. Rows 1 and 2 are refused by the
measurement in §0 — the packed install dies at `npm install` under row 1 and `quorum help` dies under
row 2 — and row 4, holding for Q-0124, is refused on sequencing: a `p1` milestone line does not wait
on a `p2` `draft` ticket, and row 3 forecloses nothing.

**The entry is landed. It is *"An optional edge says the daemon may be absent, and never why"*
(2026-09-14)**, `docs/decisions/094-an-optional-edge-says-the-daemon-may-be-absent.md`, indexed in
`docs/DECISIONS.md` under `## 2026-09-14`. Cite it by **title and date**, never by number or file
name. What it rules, which AC-7, AC-8 and AC-10 now implement rather than decide:

1. **Both halves are required** — an optional manifest and a dynamic import. Neither is a style
   choice and neither rescues the other.
2. **An optional edge claims nothing about *why*.** `quorum open` reports what failed to resolve
   **here** and names the workspace path that carries the daemon; it may not report that the daemon
   was deliberately omitted, because the import cannot tell an intentionally daemon-less install from
   a damaged one. *"A probe that could not answer is not a negative"* (2026-09-10) at a new site, and
   this is AC-10's binding clause.
3. **Quality pillar 7 narrows precisely** — `harness/product-context.md`'s claim that both
   installation paths work keeps its force for every command it covered and names `quorum open` as
   the one exception. It is **not** weakened to *"mostly works"*.
4. **It is provisional against Q-0124**: when that ticket rules a distribution route, the optional
   edge becomes required, the import may become static, and 094 is **superseded rather than
   amended** — the exemption is deleted, not widened.
5. **The clause-D exemption is exactly one and it is that clause's first.**
   `cli-version.test.ts`'s `namedAsWritten(sources, ['import(', 'require('])` is `toStrictEqual([])`
   with no register anywhere in the file, so AC-8 creates the first permitted entry, keys it by
   file, carries the authority line, and the clause must still fail for an unregistered second.

**The implementer is therefore NOT blocked on OQ-1 or OQ-2**, and `blocked` is the wrong verdict for
either. Both are ruled, the entry is on `main`, and what remains is to implement them. `blocked`
remains correct for any *other* criterion needing something outside `developer-generalist`'s
authority.

### GO-2 — discharged before the run, by hand, and why it could not be a criterion

`developer-generalist`'s `paths:` do not reach the tracked root-level `pnpm-lock.yaml`, while
`harness/harness.yaml:34` runs `pnpm install --frozen-lockfile` in the integration worktree **before
the suite** — so an implement step that added the AC-7 manifest edge would write a manifest it may
write, be unable to write the lockfile that manifest requires, and `integrate` would die
`ERR_PNPM_OUTDATED_LOCKFILE` after implement and review had been paid for. Q-0103's shape.

So the manifest edge, its lockfile update and AC-9's widening are landed **by hand on
`harness/Q-0126/integration`**, the branch `chore.yaml` cuts the implement worktree from, before the
run starts — and deliberately **not on `main`**, where Q-0125's AC-13 would be red until the merge.
Q-0067 GO-2's precedent. **Granting `pnpm-lock.yaml` to the role was refused** as a harness edit
affecting every future chore ticket, which is decision 094's own fourth alternative.

**What this means for the implementer:** AC-7 and AC-9 may already be satisfied on the branch you
start from. Verify rather than assume, and if they are, say so in your report and do not re-do them.

### What the gate does not amend

§0's measurements stand, including the correction that the ticket body and codex's AC-16 both named
the wrong half of clause D, and the ruling that `ServeOptions.bundle` widens to `string | URL` with
no decision entry owed. GO-4, GO-5 and GO-6 stand unchanged.

## E-2 — GO-4 is ruled and its entry is landed; the `blocked` was right and E-1 was not — 2026-09-14

**Supersedes** E-1's *"GO-4, GO-5 and GO-6 stand unchanged"* as it applies to **GO-4**, and AC-16's
requirement as work still owed. GO-5 and GO-6 are unaffected. `merged.md` is otherwise unamended and
all sixteen criteria stand.

### The `blocked` verdict was correct, and E-1 is what made it necessary

Round 1 completed **AC-1 to AC-11** and stopped on **AC-16**, which requires *"the decision entry
GO-4 asks for is landed before a line of code"* — work `developer-generalist` may not do. That is
this repository's own definition of `blocked` and the step applied it correctly, including refusing
to choose a folder when its measurement showed none was selected.

**The gap was in E-1, and it is recorded rather than smoothed over.** GO-4 reads *"(the successor's,
but the argument belongs to a gate) … settle this before the successor runs."* That parenthetical was
true under the recommended split and false the moment the gate refused it: **refusing the split made
this run the successor**, so GO-4 stopped being deferred work and became a second blocking
precondition beside GO-1. E-1 carried it forward as *unchanged* and did not notice. The cost is one
implement round that ended at eleven of sixteen criteria rather than sixteen — $57.30, of which
nothing is wasted, the eleven being complete and green on the branch.

### The ruling

**The entry is landed. It is *"`core` opens a URL, and the ninth folder is named for what it is
about"* (2026-09-14)**, `docs/decisions/095-core-opens-a-url-and-the-folder-is-named-for-it.md`,
indexed in `docs/DECISIONS.md`. Cite it by **title and date**. It is committed on
`harness/Q-0126/implement` — the branch this worktree is on — rather than on `main`, so it arrives
with the merge; Q-0067 GO-2's reason a second time. **Verify it is present and do not re-create it.**

What it rules, which AC-12 to AC-16 now implement rather than decide:

1. **The primitive lives in a ninth folder, `packages/core/src/browser/`**, holding one exported
   symbol. The measurement round 1 supplied is adopted as the reason: `fanout/` is closed by
   `fanout.source.test.ts:44`'s landed pin, `adapters/` is confined to vendor knowledge by
   `harness/architecture.md` and `exec.ts`'s own docblock, and the remaining six folders are each
   about something this is not.
2. **Principle 1's enumeration widens by one item and its rule does not move.**
   `docs/04-architecture.md:51` becomes *"It spawns CLIs, opens a URL in the platform's default
   browser, reads/writes the project folder and git."* The clauses it keeps — never the network,
   never a secret, never an API key — are restated in the entry so the widening cannot be read as
   general. **That document edit is AC-16's, in this round.**
3. **The launcher spawns an executable with the URL as one argv element and never composes a command
   string.** `open` on darwin, `xdg-open` on Linux.
4. **Windows is `unsupported`, explicitly.** `start` is a `cmd.exe` builtin rather than an
   executable, so an argument-based spawn cannot exec it, and the string form is the injection
   surface clause 3 refuses. This answers Appendix A's blocking question: the platform table returns
   the **`unsupported platform`** member AC-13's closed set already carries, and does **not** claim a
   Windows row. Q-0098's POSIX-only registration is the precedent.
5. **The result reports what was spawned, never what a browser did.** *launched* means the launcher
   exited zero, never *a browser is showing this page*, and a failure is never rendered as *there is
   no browser* — AC-13's own wording, which this entry ratifies rather than changes.

### What this does not amend

**AC-1 to AC-11 are done and are not to be re-done.** Round 1 verified `806cd31`'s GO-2 work rather
than repeating it and says so; do the same with round 1's own. E-1's no-split ruling stands, as does
its named remedy: **if this round exhausts on the browser half, the remedy is a third erratum
promoting AC-12 to AC-16 into a successor — not a further implement round.** GO-5 and GO-6 stand.

**The implementer is not blocked on GO-4 or AC-16's precondition.** Both are ruled and the entry is
on this branch. `blocked` remains correct for anything else outside the role's authority.
