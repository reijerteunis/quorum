# Q-0090 — errata to `requirements/merged.md`

Written at the second exhaustion gate, per *"An erratum is the last repair, not the first"*
(2026-08-30): the tension below is provable now, and a round that rediscovers it spends a budget on
a question already settled.

---

## E-1 — the BYOS scan walks the filesystem, and *"Membership is a git question"* does not govern it

**Review round 4's finding stands.** `git ls-files --cached --others --exclude-standard` drops every
**ignored** file, so a gitignored fixture, documentation example, shell script or local config
carrying a credential passes a guard whose criterion (AC-12) covers all of `packages/cli/**`. The
implementer's own sandbox demonstrates the hole.

**The objection this ruling exists to pre-empt.** A reader — or a fifth round — will reach for
*"Membership is a git question, not a filesystem one"* (2026-08-28) and conclude that
`--exclude-standard` is not merely allowed but required. **It does not govern this guard**, and the
reason is in that entry's own words: it is scoped to `packages/core/src/turbo-inputs.test.ts`, and
its argument is that *"a declaration can only cover what turbo hashes — so the question is what
turbo hashes, asked directly rather than inferred."* That rationale has **no analogue here**. The
BYOS guard does not ask what a build tool hashes; it asks whether a credential is present in this
package's tree. A credential in an ignored file is still on disk, still readable by any agent given
`input.repo: true`, and still one `git add -f` from being published — so the question is what
**exists**, and existence is a filesystem question.

The two guards ask different questions and correctly use different inventories. That is not an
inconsistency to be tidied away, and neither entry needs amending.

**The ruling.** Walk `packages/cli/**` on the filesystem. Exclusions are **narrow, enumerated and
asserted** — generated and binary paths only, `node_modules/`, `.turbo/` and any emitted output
among them — never a blanket ignore rule, and each one is a named entry a later reader can weigh
rather than a silent filter. The guard's own file stays excluded and that exclusion stays asserted
load-bearing, per Q-0079.

**Third narrowing of one guard, and that is the reason for a ruling rather than another round.**
Round 3 found it scanning `src/**/*.ts` only; round 4 found the `git ls-files` replacement blind to
ignored files. That is *"A check is not established by reading it"* (2026-08-29) and Q-0050's
one-defect-at-four-depths, arriving on the guard that enforces a **product boundary** — BYOS is one
of the four things `.claude/rules/product-boundaries.md` states absolutely. A guard for that rule is
worth getting right at the cost of one more round; it is not worth a fifth spent rediscovering which
decision applies.

**Not amended:** AC-12's wording, which already says *"in source, test, fixture, help text or
documentation example"* and *"a scan over `packages/cli/**`"*. The criterion was right and only the
implementations were narrow.
