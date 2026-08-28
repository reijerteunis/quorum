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
