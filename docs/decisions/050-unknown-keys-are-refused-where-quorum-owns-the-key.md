# Unknown keys are refused where Quorum owns the key set, and preserved where it does not — 2026-08-25

**Decision:** Every zod object in `packages/shared` — and every schema the later children add —
takes one of two dispositions for a key it does not declare, and the choice is made by asking **who
owns the object's key set**, never by taste or by which is stricter.

- **Someone other than Quorum may legitimately carry keys Quorum does not read** — a flow file, a
  `ticket.md` frontmatter block, a role file. Unknown keys are **passed through**. Stripping them is
  silent data loss on any parse-then-write path, and rejecting them is Quorum vetoing a key in
  somebody else's file. `backlog/Q-0033-…/ticket.md` already carries a hand-added `depends_on` that
  nothing reads, and it must survive being parsed.
- **Quorum owns the key set entirely** — the trace/event union, and a step's `output:` block.
  Unknown keys are **rejected explicitly**. There is no third party whose data could be lost, the
  consumer reads the object exhaustively, and a key nobody will ever act on is a defect that should
  fail loudly at the boundary rather than travel.

Never a third disposition: zod's default of silently stripping is not available to any schema in
this package.

**This is the general form of a rule already recorded twice, and it does not change either.**
*"Zod describes structure and types; the flow lint keeps the semantics"* (2026-08-25) states it as
rule 4 — *"nothing is discarded"* — with the `output:` block as a lone exception justified by the
engine reading that block exhaustively. Q-0041's `requirements/errata.md` E-3 then decided the same
question for the event union and framed it as **files preserve, values constructed in memory
reject**. That framing gives the right answer for the union and is the wrong rule: the `output:`
block lives in a YAML file a human wrote, and it rejects. Ownership explains both cases; the
file/memory line explains one and contradicts the other. E-3 stands for what it decided; this entry
is the rule the later children should cite.

**Alternatives considered:**

**(a) Passthrough everywhere, with the `output:` block as a permanent one-off.** The status quo
before this entry, and the cheapest thing to write down. Rejected because "one exception, for
reasons" is not a rule a reviewer can apply to the next schema, and there will be many — thirteen
children still to land, several of which define objects Quorum wholly owns (occurrences, roll-ups,
manifests). Each would relitigate the question, and the answers would diverge.

**(b) `.strict()` everywhere, on the grounds that a schema should describe exactly what exists.**
Rejected by the corpus, and the evidence is already on the record: `loadFlow` assigns `flow.file`
onto the parsed object before lint sees it (`engine.js:15–20`), so a strict flow schema rejects all
six shipped flows on a key that appears in no YAML file. More generally it makes Quorum refuse to
read files it has no business refusing — a user annotating their own flow with a key we do not
know is not committing an error.

**(c) Passthrough everywhere including the event union, since preservation is never *wrong*.**
Rejected on what `.passthrough()` does to the **type**, which is the reason the union exists.
Zod widens the inferred type to admit `{[k: string]: unknown}`, so a vendor-specific field can enter
the union without anyone writing one down — which is exactly the outcome *"Vendor identity is one
neutral, open label"* is there to prevent, arriving through a type rather than through a line of
code. A rule defeated by its own schema is worse than no rule, because it reads as enforced.

**Why:** the two dispositions look like a strictness dial and are not. They answer different
questions. Over a file, the question is *whose bytes are these?* — and the answer is not Quorum's,
so the honest behaviour is to carry what we do not understand and hand it back unchanged. Over an
object Quorum builds and Quorum consumes, the question is *does anything act on this key?* — and
if nothing does, passing it through means a misspelled field travels the whole system doing nothing,
which is how a bug becomes a feature nobody can find. Asking "who owns the key set" gets both right
and requires no judgement about how strict to be.

The cost accepted is that ownership is occasionally a judgement call, and the `output:` block is the
proof — it is Quorum's key set inside somebody else's file. The tell, when it is unclear: **if an
unknown key appeared, is there anyone who could reasonably have put it there on purpose?** If yes,
preserve it. If the only way it gets there is a mistake, refuse it.

**Found by:** Q-0041's chore review, round 3, which read `.passthrough()` on the event variants as
violating AC-4 rule 3 — correct in its conclusion and wrong in its premise, since rule 3 explicitly
permits preservation. Settled by erratum E-3 so the revise loop did not relitigate the premise, and
generalised here because thirteen later children inherit it and an errata file inside one ticket
folder is not where a child's reviewer will look.

**Note — 2026-08-27 (Q-0069):** preservation is now spelled `z.looseObject({ … })`. zod 4.4.3 marks
`.passthrough()` `@deprecated`, so the 21 calls in `packages/shared` moved to the constructor zod
documents, and `@typescript-eslint/no-deprecated` refuses the method from here on. **Nothing this
entry decides changes.** The rule is about *who owns the key set*, not about a method name; both
dispositions, their reasons and the tell at the end stand exactly as written, and
`z.object({ … }).passthrough()` and `z.looseObject({ … })` produce the identical `core.$loose`
config, so no schema's accepted or rejected set moved. The prose above is deliberately left in its
own vocabulary: it says `.passthrough()` because that is what the code said when it was written.
See "Type-aware linting is on for exactly one rule" (2026-08-27).
