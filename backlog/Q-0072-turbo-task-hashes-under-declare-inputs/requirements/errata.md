# Q-0072 — errata

## E-1 — AC-7's escape-route clause is bounded by AC-11, and is anchored on read APIs — 2026-08-28

**Status:** decided at the exhaustion gate of run 2 (`chore.review = 3`, limit 2), by the human at
that gate. Binding on the next implement round and on the review that judges it.

**Nothing in `requirements/merged.md` is withdrawn.** This erratum decides how AC-7's sentence —
*"a read added by a new … call cannot bypass the manifest unnoticed"* — is to be read where it
meets AC-11's *"No new dependency"*, because three review rounds have established that the two
cannot both be satisfied absolutely.

### What the three rounds established

Each round returned exactly one major, each was different, each was real, and each was closed:

1. Quoted-literal scanning missed template literals and computed arguments → clause C added.
2. Clause C matched a fixed list of helper names and one root primitive, so an import alias or a
   `process.cwd()`-derived root evaded it → C1 now resolves route names through each file's own
   import bindings, C2 refuses twelve root-derivation primitives against a register, and the
   implementer additionally found and closed C3 (`'../../…'` literals were being discarded).
3. C2's list is finite, so an unlisted primitive — `fs.realpathSync('.')` — still reaches the
   repository root.

Finding 3 is correct and its remedy as stated is not reachable here. *"Fail closed around
filesystem read calls **and their path provenance**"* requires following a computed string to the
call that consumes it, which is dataflow analysis over a real syntax tree. The implementer costed
that in round 2 and refused it for a reason AC-11 supplies directly: declaring `typescript` rewrites
`pnpm-lock.yaml`, which CI installs with `--frozen-lockfile`, which
`contracts.source.test.ts` asserts on, and which is a declared hashed input of the very task this
ticket changes.

### The decision

1. **Absolute non-bypassability is not required by AC-7 and is not achievable under AC-11.** OQ-2
   already says so in the requirement's own words: the manifest half is *"the floor"* and the
   escape-route half may be *"reported as unachieved rather than faked"*. What has shipped is the
   floor plus three escape clauses, two registers and a stated exhaustiveness argument. A reviewer
   may not treat the existence of some unenumerated route as a blocker or a major on its own.

2. **The remaining work is anchored on filesystem read APIs, not on root-derivation primitives.**
   Extending C2's list is refused as a remedy: it is the move that produced findings 2 and 3, and
   the set of ways to compute a string is not enumerable. The set of ways to *read a file* in Node
   is small, stable and enumerable, and it is the last point every bypass must pass through. So:
   every filesystem read site in the two suites must take a path that is (a) a quoted
   package-relative literal clause B already collects, (b) the return of a route call clause C1
   already resolves, or (c) an entry in a register with a stated reason. The enumerated API list is
   itself part of the register and is stated in the file.

3. **A residual gap is acceptable when it is registered and stated, and is not when it is silent.**
   That distinction is the whole of this ticket's subject. The module comment states what the clause
   cannot see, in the same voice as the existing "residual limits" section.

4. **What closes this for the reviewer.** Approve when (2) is implemented with an isolated fixture
   per clause per Q-0071's rule, when the round-3 bypass
   (`path.dirname(path.dirname(fs.realpathSync('.')))` reading a computed out-of-package path) is
   demonstrated to fail against real code and then reverted, and when the residual limits are
   stated. A further unenumerated route, named without a demonstration that it reaches an
   out-of-package file past clauses A–C and the read-API anchor, is a **nit** and does not block.

### Why this is an erratum and not another round

`retry` at this gate authorises exactly one more traversal. Spending it on a fourth correct refusal
would buy nothing — the loop was not failing, it was reporting a contradiction between two criteria
in the same document, and this project's rule is that a criterion no agent in the loop can satisfy
is settled by erratum or by hand, never by iteration. The contradiction is between AC-7's absolute
wording and AC-11's dependency ban; both were written before anyone knew what the guard would cost.

### Cost of this decision

The guard does not reach provenance grade, so a sufficiently determined future test can still add an
undeclared out-of-package read. What limits the damage is that it must now evade a manifest, three
escape clauses and a read-API anchor, and that both gates that matter — CI and `integrate` — force
everything and so never rely on a hash at all. If provenance turns out to be worth its dependency,
that is a successor ticket with its own decision entry, not a fourth round here.

---

## E-2 — C4 resolves bindings as C1 does, and that closes AC-7 — 2026-08-28

**Status:** decided at the second exhaustion gate of run 2, by the human at that gate. Binding on
the next implement round and on the review that judges it. **E-1 stands unchanged.**

**The round-4 finding is correct and E-1 does not cover it.** The reviewer checked that itself and
was right to. E-1 §4 downgrades *"a further unenumerated route, named without a demonstration"* to a
nit; this is neither unenumerated nor undemonstrated. It is an **internal inconsistency introduced
by round 4 itself**: C1 resolves route names through each file's import bindings — which is what
round 2's finding taught — and C4, written two rounds later, matches raw API names immediately
before `(`. So `import { readFileSync as slurp } from 'node:fs'` is invisible to it. The same lesson,
missed in a clause written after learning it, is exactly the shape Q-0034 recorded as *"review the
fix round, not only the feature round"*.

### What closes it

1. **Parity, not a new mechanism.** C4 resolves `node:fs` and `node:fs/promises` bindings the way
   C1 already resolves route bindings, reusing that machinery rather than adding a second scanner.
   An alias is followed under whatever local name the file bound it to.
2. **Fail closed on the forms it cannot follow** — namespace import, default binding, re-export,
   dynamic `import()`, `require`, and any member form the classification does not cover — reported
   rather than passing as an absence of read sites. C1 already does this for routes; C4 does the
   same for reads.
3. **One isolated fixture** proving the aliased bypass is rejected, containing only its own trigger,
   with the other clauses asserted silent — the standard every clause in this file already meets.
4. **The round-4 exploit, demonstrated against real code and reverted**, as E-1 §4 required for
   round 3's.

### The standard for the review that judges this

Approve when 1–4 are in place. **This clause is then closed.** A fifth finding on the escape-route
machinery blocks only if it demonstrates a bypass that is *not* an instance of a class already
closed here — binding resolution, unfollowable import forms, escaping literals, derived roots, and
read APIs are all closed classes as of this erratum. An instance of a closed class is a nit and is
recorded as one.

This is a stopping rule, not a lowered bar. The panel has returned four findings, all correct and
all different, and that is the loop working. What it cannot do is decide when a guard is finished,
because there is no configuration of a textual scanner with no bypass at all — E-1 §1 settled that
absolute non-bypassability is not required, and this names the point at which the agreed scope is
met.

### Cost of this decision

If a genuinely new class appears in round 5 it will be recorded as a nit and carried to a successor
rather than fixed here. That is the trade accepted for ending a loop that has cost roughly $80 in
implement rounds against a guard over a cache configuration.
