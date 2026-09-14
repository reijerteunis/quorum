# An optional edge says the daemon may be absent, and never why — 2026-09-14

## Decision

`packages/cli` declares `optionalDependencies: { "@quorum/server": "workspace:*" }` and reaches the
daemon through a **dynamic** import inside the `open` handler. That is a third dependency kind in a
workspace that has used two, and it is ruled here rather than chosen by an implementer because it
moves a claim this repository makes about itself.

1. **Both halves are required, and the measurement is why.** Reproduced against Q-0098's own packed
   fixture before the ticket ran: with `dependencies` the packed `npm install` **dies** —
   `ECONNREFUSED`, `requiredBy: node_modules/@quorum/cli` — because `pnpm pack` rewrites
   `workspace:*` to `0.0.0` and only three tarballs are supplied, so the install fails **before any
   module loads**. With `optionalDependencies` and a *static* import the install succeeds and
   `quorum help` then dies `ERR_MODULE_NOT_FOUND`. Only the pair keeps both installation paths
   working. **A dynamic import cannot rescue a manifest and an optional manifest cannot rescue a
   static import**; neither half is a style choice.

2. **What an optional edge claims: nothing.** It says the daemon *may* be absent, and it may never
   be read as saying *why*. `quorum open` reports **what failed to resolve here** and names the
   workspace path that carries the daemon — it does not report that the daemon was deliberately
   omitted, because an unresolvable dynamic import cannot tell an intentionally daemon-less
   three-tarball install from a damaged one. That is *"A probe that could not answer is not a
   negative"* (2026-09-10) holding at a new site, and it is the clause this entry exists for: the
   silence an optional dependency creates is exactly the *probe fails → read as absence* shape
   Q-0074 and Q-0115 were opened to remove.

3. **Quality pillar 7's claim narrows, and narrows precisely.** `harness/product-context.md` says the
   workspace-local and locally packed paths *"both work since Q-0098"*. After this ticket that stays
   true of every command it describes and becomes false of one command it does not: **`quorum open`
   works on the workspace-local path and refuses, with a sentence, on the packed one.** The pillar is
   amended to say so. It is fed to every product-manager step at run time, which is why a false
   installation claim there is one every future requirement inherits — Q-0098's own finding, and the
   reason this is an entry rather than a footnote.

4. **It is provisional against Q-0124, and says so in advance.** Decisions *"A fourth package emits,
   and what it emits is served rather than shipped"* (2026-09-12) and *"A fifth package emits, and
   `resolved` is not a synonym for `distributed`"* (2026-09-12) each routed *how an installation
   outside the workspace obtains the UI or the daemon* to Q-0124 **by name**. This answers part of
   that question for one consumer and does not settle it. **When Q-0124 rules a distribution route,
   the optional edge becomes a required one, the import may become static, and this entry is
   superseded rather than amended** — the exemption it authorises is deleted, not widened.

5. **The exemption it authorises is exactly one, and it is the first of its kind.**
   `packages/core/src/adapters/cli-version.test.ts`'s clause D asserts
   `namedAsWritten(sources, ['import(', 'require('])` is empty over every production module of
   `packages/core/src` and `packages/cli/src` — `toStrictEqual([])`, **with no register and no
   exemption anywhere in the file**. Admitting one dynamic import creates that clause's **first
   permitted entry**, which is a different act from widening a register that already discriminates.
   The entry is keyed by file, carries the authority line the engineering rules require, and the
   clause must still fail for an unregistered second one.

## Alternatives considered

**Declare `@quorum/server` a normal dependency and let the packed install break.** Refused by
measurement rather than by taste: it is not a degradation but a **regression on a tested path** —
`quorum help` and `quorum init` stop working in a packed install, which Q-0098's fixture asserts and
CI runs. A p1 feature may not break two shipped commands to reach a third.

**Hold the ticket until Q-0124 rules the distribution set.** The honest alternative, and the one that
lands the end state once instead of twice. Refused on sequencing rather than on merit: Q-0126 owns a
line of M3's own done-when and is `p1`, Q-0124 is `p2` and `draft`, and row 3 does not foreclose row
4 — every part of it is deleted rather than reworked when that ruling arrives. What was weighed is
whether a p1 milestone line waits on a p2 draft ticket, and it does not.

**Ship `quorum open` only in the workspace and give the packed CLI no such command.** Refused because
a command that exists in one installation and not another is a worse lie than one that exists and
explains itself: `COMMANDS` drives the help text, so the packed binary would either list a command it
does not have or print a different help from the workspace one, and neither is a thing this
repository can then assert about.

**Grant `pnpm-lock.yaml` to `developer-generalist` so an implement step can land the edge itself.**
Refused as out of scope in the strong sense: it is a harness edit with effects on every future chore
ticket, and taking it as a side effect of this one is how a permission grows without anybody deciding
it. The lockfile is landed by hand on the integration branch instead.

## Why

**Because an optional dependency is a silence, and this repository has spent four tickets removing
silences that were read as answers.** Q-0074 and Q-0115 exist because a failed git probe was rendered
as a proven negative; *"A probe that could not answer is not a negative"* (2026-09-10) states the
rule; containment, push lag and verified version each keep a state meaning *could not tell*. An
unresolvable optional import is the same shape arriving through packaging rather than through git —
and the temptation it creates is exactly the one those entries refuse, because *"the daemon is not
installed"* is the convenient sentence and *"`@quorum/server` did not resolve here"* is the true one.
Clause 2 is the whole reason this is an entry and not a manifest edit.

**The narrowing in clause 3 is the part that will be read later, and it is deliberately small.**
Pillar 7 is not weakened to *"the packed path mostly works"*; it keeps its claim for every command it
covered and names the one exception by name. A pillar that hedges is one no future requirement can be
held to, which is worse than a pillar with an exception written into it.
