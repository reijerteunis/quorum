# Errata — Q-0041 requirements

Amendments to `requirements/merged.md`, agreed at the exhaustion gate of run 2. The implementer
reads this file beside the requirement (`chore.yaml`'s `implement` and `review` steps both list
`requirements/errata.md` among their inputs); where this file and the requirement disagree, this
file wins **for the clauses it names and no others**. Each entry is dated and names the clause it
supersedes. Nothing here widens scope — an erratum resolves a contradiction, it does not add
requirements.

Run 2 exhausted its revise loop (`chore.review = 3`, limit 2) at $40.47 and 53.4M Codex tokens
across three implement passes and three `revise` verdicts. Every round was correct on its own
terms, which is the tell: the implementer could not satisfy two criteria at once, the reviewer
could not approve a criterion left unmet, and neither is entitled to amend a merged requirement.
That is the fifth appearance of *"a loop spending its budget on work no agent in it can perform"*
(`docs/DECISIONS.md`, M1's closing entry, and the 2026-08-25 entry on unwritable surfaces), in a
variant those entries do not cover: the work no agent can perform is **deciding between two
clauses of the requirement itself**.

## E-1 — 2026-08-25 — AC-3's implication governs which keys must be present, not what their values may be

**Supersedes:** the binding property of **AC-3** in `requirements/merged.md:150`, as literally
worded:

> For any flow object, `lintFlow` succeeding implies the flow schema parsing succeeding.

**Replacement:**

> For any flow object, `lintFlow` succeeding implies the flow schema **requires no key that is
> absent**. Where a key is present, its type is zod's to judge, and a type zod rejects is not a
> counterexample to this property.

Every other word of AC-3 stands: the six step kinds in the engine's presence-based precedence
order, both `branches` shapes, the pipe-delimited `output.verdict`, the `id`-less gate step, the
comment naming the file or line behind each permissive choice, and the corpus test that parses all
six `harness/flows/*.yaml` with `file` set as `loadFlow` sets it.

**The test AC-3 asks for changes with it.** The clause *"the property is asserted against at least
one object `lintFlow` accepts that a naive `.strict()` schema would reject"* stands unchanged. What
is added: the property test imports the real `lintFlow` from `spike/src/lint.js` and asserts the
implication in the form above over a table of objects — presence cases must parse, and the
type-divergence cases are asserted as **lint accepts / schema rejects**, named as the boundary this
erratum draws rather than as exceptions to a property. An assertion that documents a criterion away
is what round 2 correctly refused; an assertion that documents a *decided boundary* is a test.

**Why the requirement was wrong.** AC-3's property and **AC-4 rule 1** (`merged.md:165`, *"Zod
describes structure and types"*) cannot both hold, because `lintFlow` type-checks almost nothing.
Verified by running it in this repository, not by reading it — the implementer's transcript, and
independently at the gate:

| object | `lintFlow` |
| --- | --- |
| `{id: 'a', adapter: 42}` | `true` |
| `{id: 42}` | `true` |
| `{gate: 42}` | `true` |
| `cross_vendor: 42` | `true` |
| a bare string where a step object belongs | `true` |

Where a value reaches `lintFlow` at all it reaches `String()` or `.includes()`, which accept
anything. So the set of objects lint accepts contains objects with wrongly typed values, and any
schema that checks types rejects some of them. Holding AC-3 literally means `z.unknown()` on every
field — a schema that describes nothing, returning thirteen consumers to re-deriving what a flow
file is from `YAML.parse`'s return, which is the state the ticket's Problem statement exists to
end and the opposite of its user story's *"a type instead of each re-deriving one"*.

**Why this direction and not the other.** AC-4 rule 1 is the load-bearing half. It is what keeps
`lintFlow`'s sixteen messages authoritative — fourteen of them prefixed with the step id a reader
greps for, against zod's `steps[3].on_fail.max_iterations`, which names an index — and AC-3's own
purpose is to stop zod quietly becoming a second linter. That purpose is served entirely by the
presence half: a schema that requires a key lint does not require **is** zod adding a rule, and
that is the failure AC-3 was written to prevent. A schema that types a value lint never looked at
is not adding a rule to the flow format; it is describing the format, which is the package's
reason to exist. The implementer had already conceded the presence half unprompted in round 3 —
`name` and `steps` are optional because `lint.js:127` prints `flow.name ?? flow.file` and
`flattenSteps(steps = [])` at `lint.js:7` defaults `steps` away — and `consumes`/`produces` stay
required because `lint.js:124` requires them too. That concession was right and is now the whole
of the property.

**One shape that is not part of the residue,** recorded so it is not re-argued: `steps` present but
not an array. `steps: null` and `steps: [null]` both throw a `TypeError` out of `flattenSteps`, so
`lintFlow` does not succeed on them and rejecting them narrows nothing.

**What this erratum does not settle.** It does not authorise zod to reject anything on semantic
grounds. AC-4 rule 1's boundary is untouched: duplicate ids, goto resolution, counter prefixes,
verdict-must-route, the two cross-vendor rules, loop convergence, the deploy gate and the
`input.diff` range rule stay in `lintFlow`, and no zod issue may replace a lint message in
`quorum lint`'s output. The round-1 finding on `consumes`/`produces` — that typing them as the
ten-member `stageSchema` adds a membership rule lint does not have — was correct and remains
correct; they are structurally strings.

## E-2 — 2026-08-25 — `route` is carried untouched, not given a shape

**Supersedes:** the appearance of `route` in the ticket body's Scope list
(`ticket.md:48`), so far as it asks for a zod schema covering `route`.

**Replacement:** `route` is preserved by passthrough and deliberately not typed, with a comment
naming why — which is what **AC-3** already asks for at `merged.md:155`, where `route` is listed
among the permissive choices whose comment must name the file or line that forced it, beside the
`file` key and the `id`-less gate step.

**Why the requirement was ambiguous rather than wrong.** Both readings can quote the document —
Q-0034's *"a frozen artifact can be under-specified rather than wrong"* category, whose tell is
exactly that. The ticket body lists `route` among the shapes to schematise; AC-3 lists it among the
shapes to leave alone. AC-3 is the criterion and it is the more specific statement, so it governs.

**And the evidence settles it independently of which clause governs.** There is no "existing route
structure" to declare:

- **No shipped flow uses it.** `grep -rn route harness/flows/ packages/templates` returns nothing.
- **Lint knows only that it is truthy.** `lint.js:77` tests `!step.route` inside
  `step.output?.verdict && !step.on_fail && !step.route`. It never looks inside.
- **The only sketch is prose for an unshipped flow, and it disagrees with lint about where `route`
  even lives.** `docs/02-sdlc-pipeline-spec.md:370` draws `- route:` as a step of its own in
  `qa-final.yaml`'s step list; `lint.js:77` reads `route` as a property of the step that carries
  the verdict. Two incompatible shapes, no user, no implementation.

Declaring a shape from that would be inventing one, which **AC-4 rule 2** forbids, and the
requirement's own non-goals already name *"`route` is linted (`lint.js:77`) and never implemented"*
as one of the nine stop-and-report items (`merged.md:344`). The reviewer's round-3 finding at
`flow.ts:122` asked for the one thing three separate clauses of this requirement forbid.

**What this erratum does not settle.** Whether `route` should exist at all, and which of the two
shapes is right, belongs to Q-0012, which ships `qa-final.yaml`. A by-product worth carrying there:
`qa-final.yaml` as sketched at `02-sdlc-pipeline-spec.md:365–374` would **fail** `lintFlow` today —
its verdict step at `:369` carries neither `on_fail` nor `route`, so `lint.js:77` fires. Reported,
not fixed.

## E-3 — 2026-08-25 — event variants reject unknown keys; file-derived schemas preserve them

**Supersedes:** nothing in the requirement's words. It decides which of the two dispositions
**AC-4 rule 3** permits (`merged.md:174–177`, *"either preserved in the parsed result or rejected
explicitly — never dropped"*) is the one **AC-8** means by *"fields verbatim"* and **AC-9** means by
*"nothing else in the union is vendor-specific"*.

**Replacement:** the event variants in `packages/shared/src/events.ts` are **strict** — an unknown
key is a parse error, not a passthrough. The `vendor` label stays an open string, exactly as AC-9
requires and for the reason AC-9 gives. A test asserts that a vendor-specific extra such as
`session_id` fails to parse.

**The rule this draws, which the later children inherit.** The disposition follows the direction the
data travels, and the two are not alike:

- **Schemas over files a human or another tool wrote** — flow, ticket, role — **preserve unknown
  keys.** A parsed object gets written back, and a stripped key is data loss; `backlog/Q-0033-…/`
  already carries a hand-added `depends_on` that nothing reads. This is AC-4 rule 3's own argument
  and it stands untouched.
- **Schemas over values Quorum itself constructs in memory** — the event union — **reject them.**
  Nothing round-trips through a file, so there is no key to lose, and the whole value of a
  discriminated union here is an exact inferred type. `.passthrough()` widens the inferred type to
  admit `{[k: string]: unknown}`, which is precisely how a vendor-specific field would enter the
  union without anyone writing one down — the thing AC-9 exists to prevent, defeated by a type
  rather than by a line of code.

**Why it is an erratum and not a review finding to carry.** Round 3's `events.ts:84` finding is
correct in its conclusion and wrong in its premise: it reads `.passthrough()` as violating AC-4
rule 3, when rule 3 explicitly permits preservation. Left as a finding, the next round would
relitigate the premise. Decided here, the implementer has one sentence to act on.
