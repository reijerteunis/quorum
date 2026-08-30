# Errata — Q-0052

Corrections to `requirements/merged.md` after it landed. An erratum is written when a contradiction
between the requirement and an authority is provable, and it is the last repair rather than the
first — see *"An erratum is the last repair, not the first"* (`docs/DECISIONS.md`, 2026-08-30).

## E-1 — AC-4(a)'s prose is stricter than the code it describes; the port preserves the code — 2026-08-31

**Ruled: `resolveModel` ports byte-for-byte from the spike. AC-4(a) is amended to describe what the
function does. The strict form is Q-0081, landing in both trees.**

### What was measured

`spike/src/engine.js:702–707` suppresses a role's default model when the role names a **different**
adapter than the one that resolved, and falls through when the role names **none** — so a role with
`model:` and no `adapter:` lends that model to whichever adapter resolved. AC-4(a) says the
opposite: *"inherited **only** when `role.meta.adapter` equals the resolved adapter name"*. Absent is
not equal, so the criterion and the code disagree, and they have since Q-0047 erratum E-1 wrote the
clause on 2026-08-27.

**The frozen coverage this criterion cites cannot tell the two apart.** `spike/test/smoke.js:621–627`
is three assertions over one fixture, `{ adapter: 'claude', model: 'opus' }`, and every row names an
adapter. AC-4(a) cited it as its authority; it does not reach the disputed row.

**The defect is latent.** All 21 role files in `harness/roles/` and `spike/templates/harness/roles/`
carry an `adapter:` wherever they carry a `model:`. No shipped flow reaches it.

### Why the criterion moves and not the code

Charter §2 preserves behaviour, and *"The port preserves behaviour; one exception is authorised and
everything else stops the child"* (2026-08-25) spent that one exception on Q-0050's event stream.
A defect found while reading is reported, never fixed in passing. Q-0081 carries the strict form,
where the choice between changing the code and correcting the three documents that state it can be
made deliberately rather than inside a review loop.

### AC-4(a), as amended

> `resolveModel(step, role, adapterName)`: the step's own `model` always wins. A role's default is
> suppressed when the role names a **different** adapter than the one that resolved. A role naming
> **no** adapter is not suppressed and lends its model to whichever adapter resolved — the spike's
> behaviour, preserved, and narrower than register row 2's third clause reads. The divergence is
> registered as a preserved defect and owned by Q-0081. Frozen coverage:
> `spike/test/smoke.js:621–627`, which does not reach the absent-adapter row; the row that
> discriminates is added in `steps.test.ts` and pins the preserved behaviour.

### How the run reached the wrong answer, which is the part worth keeping

Review round 1 raised the finding correctly. Round 2's implementer refused it on charter §2 and
added the authority line `.claude/rules/engineering.md` prescribes. Round 2's reviewer refused the
refusal, answering only the frozen-coverage half — *"the cited spike tests are minimum frozen
coverage, not authority to override the criterion"*, which is true and is not what the implementer
had argued. Round 3 shipped the strict form and deleted the pin; round 3's reviewer approved and
named the deletion approvingly. That is *"A reviewer approves the change it asked for"* (2026-08-29),
second occurrence in this port.

**And it shows a gap in that decision's own remedy.** It prescribes writing the erratum *during* the
loop, as soon as the contradiction is provable. The contradiction was provable after round 1. But
`chore.yaml` has no step at which a human must read a review, so three implement rounds and three
reviews completed in about an hour and the loop reached an approval before any ruling could be
written into it. The remedy assumes an attended loop and the flow does not provide one. That is a
finding about the flow rather than about this ticket, and it is not fixed here.

**The repair was made after the gate, not by editing the branch the gate approved** — Q-0073's and
Q-0080's precedent. `resolveModel` and its `Why:` line are restored on `main`, the register entry
and its arithmetic are restored with them, and the discriminating row in `steps.test.ts` now asserts
the preserved behaviour. The restore was demonstrated red before green: against the strict form the
two guards fail with `expected 'sonnet' to be undefined` and a `toStrictEqual` on the register, and
28 sibling assertions stay green, so each guard was shown to have this subject and not another.

### What this erratum does not settle

Whether the code or the three documents move — that is Q-0081's, deliberately. Nothing else in
`merged.md`; no other criterion is touched. And the gate obligations GO-1 and GO-2 are unaffected
and still outstanding.
