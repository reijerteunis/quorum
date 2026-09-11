# A finding is a claim about the change; anything else is an observation — 2026-09-11

## Decision

**A finding is a claim about the change the step produced or reviewed.** That is what the verdict
rules govern, and they are unchanged: the affirmative verdict carries findings prefixed `nit: ` and
nothing else, exactly as *"A nit does not contradict an approval"* (2026-08-28) ruled. `proceed`
beside `major: my own work is broken` is a contradiction and stays refused.

**Anything else a step has to say is an observation**, tagged `observation: ` and **exempt from the
verdict rule** — the environment it ran in, an obligation that belongs to somebody else, a defect in
code it was not sent to touch. It contradicts no verdict because it is not about the change.

**It is a tag on an entry, not a fourth severity and not a second array.** `findings` is already a
list of tagged statements where the prefix is the discriminator — `blocker: `, `major: `, `nit: `.
`observation: ` joins that vocabulary as a **kind**, while `FINDING_SEVERITIES` stays the three it
was: a severity answers *how bad is this claim about the change*, and an observation is answering a
different question.

**It carries no `file:line`, and that is the point rather than a relaxation.** `FINDING_PATTERN`
gains a second alternative without one, because an observation is not about a line of the change and
requiring a location would force it to invent one — which is how *"the suite is intermittently red"*
ends up filed against an arbitrary file.

**The exemption exempts nothing else.** `observations: ` plural, `observation` without a colon, and
every severity remain refused beside an affirmative verdict. A tag that could be approximated would
be a way round the rule rather than a channel beside it.

## Alternatives considered

**A separate `observations` field on the step-output schema.** The first choice, and it was refused
**on measurement**: it breaks **48 tests across two packages**, because the mock adapter's output
flows through the whole end-to-end suite and every producer must then supply the key. That cost was
not visible when the shape was chosen and it changed the answer.

It also fought a constraint that decides the matter on its own. `packages/core/test/strict-schema.ts`
encodes the rule that every property a schema sends a vendor must appear in `required`, because
OpenAI strict structured outputs reject anything else and **the error that comes back looks exactly
like a broken login** — which is how `adapters --probe` reported codex unusable while the login was
fine (Q-0034). So the field could not be optional; and required, it is a breaking contract change
for every existing producer. The tag needs neither.

**A fourth severity beside `blocker`, `major` and `nit`.** Refused on what it models: it keeps
environment reports and other people's obligations inside *claims about the change*, which is the
conflation that produced the problem.

**Make the nit rule declared per flow rather than inferred.** The mechanical defect is real —
`adapters.ts` treats `verdicts[0]` as "the approving verdict", which was written for `review`'s
`approve|revise` and inherited by `implement`'s `proceed|blocked`, where the first verdict means
*nothing blocks* rather than *I have no objections*. Refused because *"The verdict file is scoped by
default, because no flow author writes its path"* (2026-09-01) already ruled this shape: a rule that
holds only where somebody remembered a key is not a rule. Fixing what a finding *is* fixes both
vocabularies at once and needs no key.

**Exempt `proceed` by name.** Smallest possible diff, and it hard-codes one flow's vocabulary into
the contract layer, so the next verdict pair inherits the same wrong assumption.

**Do nothing and let steps use `summary`.** This is what happened twice, and it is why the entry
exists: the summary is one paragraph the next step reads as context, so a measured observation either
bloats it or is dropped. Neither instance chose it.

## Why

**It cost $111.48 in one day.** Two chore runs — Q-0115's and Q-0074's — finished their work, wrote
it to disk, and were then refused by the engine, so nothing was recorded and both were completed by
hand. Every finding in both outputs was correct. In one, the step had caught a defect in its own test
before a reviewer could.

**The two instances differ in a way that decides the shape.** Q-0115's step reported a gate
obligation *unmet*: it had measured the suite intermittently red and said so. Q-0074's reported one
**structurally undischargeable from where the step stands** — *"GO-4 is not discharged and cannot be
from here"*, which is literally true, since GO-4 requires verification on `main` after a merge that
has not happened. The second is not a claim about the change under any reading, and no severity could
make it one.

**The alternative was dishonesty with a cost attached.** Faced with the refusal an agent has two
moves: drop the observation, or relabel a real one as `nit`. The first loses a measurement somebody
paid for; the second corrupts the vocabulary the review loop runs on — and `chore.yaml` routes on
*nits alone approve*, so a misfiled observation can end a loop.

**It completes *"A refused finding is a gate, not another round"* (2026-08-31).** That entry gave an
implementer a channel for *this criterion is wrong*, which shipped as Q-0083's `blocked`. The gap
beside it was *my work is done and this other thing is true*, which had no channel at all. Both are
the same underlying error — an agent with something correct to say and no encoding for it — and this
is the second half.

**Not superseding the 2026-08-28 nit rule, and that is the test of the design.** If this entry needed
to weaken that one it would be the wrong fix: the rule is right, and what was wrong is that a claim
about the change was the only thing a step could say.
